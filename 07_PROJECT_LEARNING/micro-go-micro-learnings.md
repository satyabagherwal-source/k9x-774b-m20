# Forensic Learning Record (Deep Inspection): micro/go-micro

> **Canonical Artifact**: `07_PROJECT_LEARNING/micro-go-micro-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/micro/go-micro](https://github.com/micro/go-micro))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T01:53:03.099Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `micro/go-micro`
- **Description**: A framework for building agents and services
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 23081 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `cmd/micro/cli/util/dynamic.go`
```
package util

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"math"
	"os"
	"sort"
	"strconv"
	"strings"
	"unicode"

	"github.com/stretchr/objx"
	"github.com/urfave/cli/v2"
	"go-micro.dev/v6/client"
	"go-micro.dev/v6/metadata"
	"go-micro.dev/v6/registry"
)

// AddMetadataToContext parses metadata strings in the format "Key:Value" and adds them to the context
func AddMetadataToContext(ctx context.Context, metadataStrings []string) context.Context {
	if len(metadataStrings) == 0 {
		return ctx
	}

	md := make(metadata.Metadata)
	for _, m := range metadataStrings {
		parts := strings.SplitN(m, ":", 2)
		if len(parts) != 2 {
			continue
		}
		key := strings.TrimSpace(parts[0])
		value := strings.TrimSpace(parts[1])
		md[key] = value
	}

	return metadata.MergeContext(ctx, md, true)
}

// LookupService queries the service for a service with the given alias. If
// no services are found for a given alias, the registry will return nil and
// the error will also be nil. An error is only returned if there was an issue
// listing from the registry.
func LookupService(name string) (*registry.Service, error) {
	// return a lookup in the default domain as a catch all
	return serviceWithName(name)
}

// FormatServiceUsage returns a string containing the service usage.
func FormatServiceUsage(srv *registry.Service, c *cli.Context) string {
	alias := c.Args().First()
	subcommand := c.Args().Get(1)

	commands := make([]string, len(srv.Endpoints))
	endpoints := make([]*registry.Endpoint, len(srv.Endpoints))
	for i, e := range srv.Endpoints {
		// map "Helloworld.Call" to "helloworld.call"
		parts := strings.Split(e.Name, ".")
		for i, part := range parts {
			parts[i] = lowercaseInitial(part)
		}
		name := strings.Join(parts, ".")

		// remove the prefix if it is the service name, e.g. rather than
		// "micro run helloworld helloworld call", it would be
		// "micro run helloworld call".
		name = strings.TrimPrefix(name, alias+".")

		// instead of "micro run helloworld foo.bar", the command should
		// be "micro run helloworld foo bar".
		commands[i] = strings.Replace(name, ".", " ", 1)
		endpoints[i] = e
	}

	result := ""
	if len(subcommand) > 0 && subcommand != "--help" {
		result += fmt.Sprintf("NAME:\n\tmicro %v %v\n\n", alias, subcommand)
		result += fmt.Sprintf("USAGE:\n\tmicro %v %v [flags]\n\n", alias, subcommand)
		result += "FLAGS:\n"

		for i, command := range commands {
			if command == subcommand {
				result += renderFlags(endpoints[i])
			}
		}
	} else {
		// sort the command names alphabetically
		sort.Strings(commands)

		result += fmt.Sprintf("NAME:\n\tmicro %v\n\n", alias)
		result += fmt.Sprintf("VERSION:\n\t%v\n\n", srv.Version)
		result += fmt.Sprintf("USAGE:\n\tmicro %v [command]\n\n", alias)
		result += fmt.Sprintf("COMMANDS:\n\t%v\n", strings.Join(commands, "\n\t"))

	}

	return result
}

func lowercaseInitial(str string) string {
	for i, v := range str {
		return string(unicode.ToLower(v)) + str[i+1:]
	}
	return ""
}

func renderFlags(endpoint *registry.Endpoint) string {
	ret := ""
	for _, value := range endpoint.Request.Values {
		ret += renderValue([]string{}, value) + "\n"
	}
	return ret
}

func renderValue(path []string, value *registry.Value) string {
	if len(value.Values) > 0 {
		renders := []string{}
		for _, v := range value.Values {
			renders = append(renders, renderValue(append(path, value.Name), v))
		}
		return strings.Join(renders, "\n")
	}
	return fmt.Sprintf("\t--%v %v", strings.Join(append(path, value.Name), "_"), value.Type)
}

// CallService will call a service using the arguments and flags provided
// in the context. It will print the result or error to stdout. If there
// was an error performing the call, it will be returned.
func CallService(srv *registry.Service, args []string) error {
	// parse the flags and args
	args, flags, err := splitCmdArgs(args)
	if err != nil {
		return err
	}

	// construct the endpoint
	endpoint, err := constructEndpoint(args)
	if err != nil {
		return err
	}

	// ensure the endpoint exists on the service
	var ep *registry.Endpoint
	for _, e := range srv.Endpoints {
		if e.Name == endpoint {
			ep = e
			break
		}
	}
	if ep == nil {
		return fmt.Errorf("endpoint %v not found for service %v", endpoint, srv.Name)
	}

	// create a context for the call
	callCtx := context.TODO()

	// parse out --header or --metadata flags before parsing request body
	// Note: This is for dynamic service calls (e.g., 'micro helloworld call --header X:Y').
	// Direct 'micro call' commands are handled in cli.go.
	if headerFlags, ok := flags["header"]; ok {
		callCtx = AddMetadataToContext(callCtx, headerFlags)
		delete(flags, "header")
	}
	if metadataFlags, ok := flags["metadata"]; ok {
		callCtx = AddMetadataToContext(callCtx, metadataFlags)
		delete(flags, "metadata")
	}

	// parse the flags into request body
	body, err := FlagsToRequest(flags, ep.Request)
	if err != nil {
		return err
	}

	// construct and execute the request using the json content type
	req := client.DefaultClient.NewRequest(srv.Name, endpoint, body, client.WithContentType("application/json"))
	var rsp json.RawMessage

	if err := client.DefaultClient.Call(callCtx, req, &rsp); err != nil {
		return err
	}

	// format the response
	var out bytes.Buffer
	defer out.Reset()
	if err := json.Indent(&out, rsp, "", "\t"); err != nil {
		return err
	}
	out.Write([]byte("\n"))
	_, _ = out.WriteTo(os.Stdout)

	return nil
}

// splitCmdArgs takes a cli context and parses out the args and flags, for
// example "micro helloworld --name=foo call apple" would result in "call",
// "apple" as args and {"name":"foo"} as the flags.
func splitCmdArgs(arguments []string) ([]string, map[string][]string, error) {
	args := []string{}
	flags := map[string][]string{}

	prev := ""
	for _, a := range arguments {
		if !strings.HasPrefix(a, "--") {
			if len(prev) == 0 {
				args = append(args, a)
				continue
			}
			_, exists := flags[prev]
			if !exists {
				flags[prev] = []string{}
			}

			flags[prev] = append(flags[prev], a)
			prev = ""
			continue
		}

		// comps would be "foo", "bar" for "--foo=bar"
		comps := strings.Split(strings.TrimPrefix(a, "--"), "=")
		_, exists := flags[comps[0]]
		if !exists {
			flags[comps[0]] = []string{}
		}
		switch len(comps) {
		case 1:
			prev = comps[0]
		case 2:
			flags[comps[0]] = append(flags[comps[0]], comps[1])
		default:
			return nil, nil, fmt.Errorf("invalid flag: %v. Expected format: --foo=bar", a)
		}
	}

	return args, flags, nil
}

// constructEndpoint takes a slice of args and converts it into a valid endpoint
// such as Helloworld.Call or Foo.Bar, it will return an error if an invalid number
// of arguments were provided
func constructEndpoint(args []string) (string, error) {
	var epComps []string
	switch len(args) {
	case 1:
		epComps = append(args, "call")
	case 2:
		epComps = args
	case 3:
		epComps = args[1:3]
	default:
		return "", fmt.Errorf("incorrect number of arguments")
	}

	// transform the endpoint components, e.g ["helloworld", "call"] to the
	// endpoint name: "Helloworld.Call".
	return fmt.Sprintf("%v.%v", strings.Title(epComps[0]), strings.Title(epComps[1])), nil
}

// ShouldRenderHelp returns true if the help flag was passed
func ShouldRenderHelp(args []string) bool {
	args, flags, _ := splitCmdArgs(args)

	// only 1 arg e.g micro helloworld
	if len(args) == 1 {
		return true
	}

	for key := range flags {
		if key == "help" {
			return true
		}
	}

	return false
}

// FlagsToRequest parses a set of flags, e.g {name:"Foo", "options_surname","Bar"} and
// converts it into a request body. If the key is not a valid object in the request, an
// error will be returned.
//
// This function constructs []interface{} slices
// as opposed to typed ([]string etc) slices for easier testing
func FlagsToRequest(flags map[string][]string, req *registry.Value) (map[string]interface{}, error) {
	coerceValue := func(valueType string, value []string) (interface{}, error) {
		switch valueType {
		case "bool":
			if len(value) == 0 || len(strings.TrimSpace(value[0])) == 0 {
				return true, nil
			}
			return strconv.ParseBool(value[0])
		case "int32":
			i, err := strconv.Atoi(value[0])
			if err != nil {
				return nil, err
			}
			if i < math.MinInt32 || i > math.MaxInt32 {
				return nil, fmt.Errorf("value out of range for int32: %d", i)
			}
			return int32(i), nil
		case "int64":
			return strconv.ParseInt(value[0], 0, 64)
		case "float64":
			return strconv.ParseFloat(value[0], 64)
		case "[]bool":
			// length is one if it's a `,` separated int slice
			if len(value) == 1 {
				value = strings.Split(value[0], ",")
			}
			ret := []interface{}{}
			for _, v := range value {
				i, err := strconv.ParseBool(v)
				if err != nil {
					return nil, err
				}
				ret = append(ret, i)
			}
			return ret, nil
		case "[]int32":
			// length is one if it's a `,` separated int slice
			if len(value) == 1 {
				value = strings.Split(value[0], ",")
			}
			ret := []interface{}{}
			for _, v := range value {
				i, err := strconv.Atoi(v)
				if err != nil {
					return nil, err
				}
				if i < math.MinInt32 || i > math.MaxInt32 {
					return nil, fmt.Errorf("value out of range for int32: %d", i)
				}
				ret = append(ret, int32(i))
			}
			return ret, nil
		case "[]int64":
			// length is one if it's a `,` separated int slice
			if len(value) == 1 {
				value = strings.Split(value[0], ",")
			}
			ret := []interface{}{}
			for _, v := range value {
				i, err := strconv.ParseInt(v, 0, 64)
				if err != nil {
					return nil, err
				}
				ret = append(ret, i)
			}
			return ret, nil
		case "[]float64":
			// length is one if it's a `,` separated float slice
			if len(value) == 1 {
				value = strings.Split(value[0], ",")
			}
			ret := []interface{}{}
			for _, v := range value {
				i, err := strconv.ParseFloat(v, 64)
				if err != nil {
					return nil, err
				}
				ret = append(ret, i)
			}
			return ret, nil
		case "[]string":
			// length is one it's a `,` separated string sl
```

### Core Architecture Module: `cmd/micro/cli/util/util.go`
```
// Package cliutil contains methods used across all cli commands
// @todo: get rid of os.Exits and use errors instread
package util

import (
	"fmt"
	"regexp"
	"strings"

	"github.com/urfave/cli/v2"
	merrors "go-micro.dev/v6/errors"
)

type Exec func(*cli.Context, []string) ([]byte, error)

func Print(e Exec) func(*cli.Context) error {
	return func(c *cli.Context) error {
		rsp, err := e(c, c.Args().Slice())
		if err != nil {
			return CliError(err)
		}
		if len(rsp) > 0 {
			fmt.Printf("%s\n", string(rsp))
		}
		return nil
	}
}

// CliError returns a user friendly message from error. If we can't determine a good one returns an error with code 128
func CliError(err error) cli.ExitCoder {
	if err == nil {
		return nil
	}
	// if it's already a cli.ExitCoder we use this
	cerr, ok := err.(cli.ExitCoder)
	if ok {
		return cerr
	}

	// grpc errors
	if mname := regexp.MustCompile(`malformed method name: \\?"(\w+)\\?"`).FindStringSubmatch(err.Error()); len(mname) > 0 {
		return cli.Exit(fmt.Sprintf(`Method name "%s" invalid format. Expecting service.endpoint`, mname[1]), 3)
	}
	if service := regexp.MustCompile(`service ([\w\.]+): route not found`).FindStringSubmatch(err.Error()); len(service) > 0 {
		return cli.Exit(fmt.Sprintf(`Service "%s" not found`, service[1]), 4)
	}
	if service := regexp.MustCompile(`unknown service ([\w\.]+)`).FindStringSubmatch(err.Error()); len(service) > 0 {
		if strings.Contains(service[0], ".") {
			return cli.Exit(fmt.Sprintf(`Service method "%s" not found`, service[1]), 5)
		}
		return cli.Exit(fmt.Sprintf(`Service "%s" not found`, service[1]), 5)
	}
	if address := regexp.MustCompile(`Error while dialing dial tcp.*?([\w]+\.[\w:\.]+): `).FindStringSubmatch(err.Error()); len(address) > 0 {
		return cli.Exit(fmt.Sprintf(`Failed to connect to micro server at %s`, address[1]), 4)
	}

	merr, ok := err.(*merrors.Error)
	if !ok {
		return cli.Exit(err, 128)
	}

	switch merr.Code {
	case 408:
		return cli.Exit("Request timed out", 1)
	case 401:
		// TODO check if not signed in, prompt to sign in
		return cli.Exit("Not authorized to perform this request", 2)
	}

	// fallback to using the detail from the merr
	return cli.Exit(merr.Detail, 127)
}

```

### Core Architecture Module: `cmd/micro/gateway/util_jwt.go`
```
package gateway

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/pem"
	"errors"
	"os"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

var (
	jwtPrivateKey *rsa.PrivateKey
	jwtPublicKey  *rsa.PublicKey
)

// Load or generate RSA keys for JWT
func InitJWTKeys(privPath, pubPath string) error {
	var err error
	if _, err = os.Stat(privPath); os.IsNotExist(err) {
		priv, _ := rsa.GenerateKey(rand.Reader, 2048)
		privBytes := x509.MarshalPKCS1PrivateKey(priv)
		privPem := pem.EncodeToMemory(&pem.Block{Type: "RSA PRIVATE KEY", Bytes: privBytes})
		_ = os.WriteFile(privPath, privPem, 0600)
		pubBytes, _ := x509.MarshalPKIXPublicKey(&priv.PublicKey)
		pubPem := pem.EncodeToMemory(&pem.Block{Type: "PUBLIC KEY", Bytes: pubBytes})
		_ = os.WriteFile(pubPath, pubPem, 0644)
	}
	privPem, err := os.ReadFile(privPath)
	if err != nil {
		return err
	}
	block, _ := pem.Decode(privPem)
	if block == nil {
		return errors.New("invalid private key PEM")
	}
	jwtPrivateKey, err = x509.ParsePKCS1PrivateKey(block.Bytes)
	if err != nil {
		return err
	}
	pubPem, err := os.ReadFile(pubPath)
	if err != nil {
		return err
	}
	block, _ = pem.Decode(pubPem)
	if block == nil {
		return errors.New("invalid public key PEM")
	}
	pub, err := x509.ParsePKIXPublicKey(block.Bytes)
	if err != nil {
		return err
	}
	var ok bool
	jwtPublicKey, ok = pub.(*rsa.PublicKey)
	if !ok {
		return errors.New("not RSA public key")
	}
	return nil
}

// Generate a JWT for a user
func GenerateJWT(userID, userType string, scopes []string, expiry time.Duration) (string, error) {
	claims := jwt.MapClaims{
		"sub":    userID,
		"type":   userType,
		"scopes": scopes,
		"exp":    time.Now().Add(expiry).Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	return token.SignedString(jwtPrivateKey)
}

// Parse and validate a JWT, returns claims if valid
func ParseJWT(tokenStr string) (jwt.MapClaims, error) {
	token, err := jwt.Parse(tokenStr, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodRSA); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return jwtPublicKey, nil
	})
	if err != nil {
		return nil, err
	}
	if claims, ok := token.Claims.(jwt.MapClaims); ok && token.Valid {
		return claims, nil
	}
	return nil, errors.New("invalid token")
}

```

### Core Architecture Module: `cmd/micro/loop/loop.go`
```
// Package loop implements the 'micro loop' command, which scaffolds and
// verifies an autonomous improvement loop for a repository.
//
// The loop is a set of GitHub Actions workflows that dispatch a coding agent by
// @mention on a fresh tracking issue each run. It has up to five roles:
//
//	planner    keeps a ranked queue in .github/loop/PRIORITIES.md
//	builder    builds the top open item as a single-concern PR (auto-merged on green CI)
//	triage     turns CI failures into scoped fix issues back into the queue
//	coherence  keeps README/docs/CHANGELOG aligned with the North Star (opt-in)
//	release    cuts the next patch tag when the branch has new commits (opt-in)
//
// The workflows are the MECHANISM; each dispatch role's instruction lives in an
// editable .github/loop/prompts/<role>.md file — the POLICY. That split is what
// lets any repo (including go-micro itself) customize behavior by editing prompt
// files rather than forking the CLI. `micro loop init` writes it all; `micro
// loop verify` checks the wiring.
package loop

import (
	"bytes"
	"embed"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
	"text/template"

	"github.com/urfave/cli/v2"
	"go-micro.dev/v6/cmd"
)

//go:embed templates/*
var templatesFS embed.FS

// config is the substitution surface for the templates — the whole config-vs-core
// boundary. The workflows and prompts are the reusable core; these are what a
// given repo tunes.
type config struct {
	// Shared.
	DefaultBranch   string // base branch for the loop's PRs (e.g. main)
	AgentMention    string // how the workflows summon the agent (e.g. @codex)
	TokenSecret     string // repo secret holding the user PAT that drives dispatch
	CIWorkflow      string // human-readable CI workflow name(s) triage watches
	CIWorkflowsYAML string // the same as a YAML array literal, e.g. ["Lint", "Run Tests"]

	// Per-dispatch-role (set while rendering each one).
	Role         string
	WorkflowName string
	IssueTitle   string
	Group        string
	Cron         string

	// Release role.
	TagPrefix   string // tag prefix to match/bump, e.g. "v"
	ReleaseCron string
}

// dispatchRole is a cron-driven role rendered from templates/dispatch.yml.tmpl.
type dispatchRole struct {
	workflowName string
	issueTitle   string
	group        string
	cronFlag     string
	defaultCron  string
}

var dispatchRoles = map[string]dispatchRole{
	"planner":   {"Loop: Planner", "Loop: planning review", "loop-planner", "planner-cron", "0 * * * *"},
	"builder":   {"Loop: Builder", "Loop: build increment", "loop-builder", "builder-cron", "30 * * * *"},
	"coherence": {"Loop: Coherence", "Loop: coherence review", "loop-coherence", "coherence-cron", "0 7 * * *"},
	"security":  {"Loop: Security", "Loop: security review", "loop-security", "security-cron", "0 6 * * 1"},
}

// allRoles is the full set, in a stable order, for --roles=all and help text.
var allRoles = []string{"planner", "builder", "triage", "coherence", "security", "release"}

const (
	promptDir = ".github/loop/prompts"
	loopDir   = ".github/loop"
	wfDir     = ".github/workflows"
)

func init() {
	cmd.Register(&cli.Command{
		Name:  "loop",
		Usage: "Scaffold an autonomous improvement loop for a repository",
		Description: `Set up a self-improving loop for a repo: GitHub Actions workflows that
dispatch a coding agent to plan, build, triage, and (optionally) keep docs
coherent and cut releases — gated by CI.

Roles (choose with --roles, default: planner,builder,triage):
  planner    keeps a ranked queue in .github/loop/PRIORITIES.md
  builder    builds the top open item as a single-concern PR (auto-merged on green CI)
  triage     turns CI failures into scoped fix issues back into the queue
  coherence  keeps README/docs/CHANGELOG aligned with the North Star
  security   audits for vulnerabilities and files them (fixes stay human-reviewed)
  release    cuts the next patch tag when the branch has new commits

Each dispatch role's instruction is an editable file in .github/loop/prompts/ —
edit those to steer behavior. Direction lives in .github/loop/NORTH_STAR.md.

Examples:
  # Scaffold the default loop (planner, builder, triage)
  micro loop init

  # The full loop, all five roles
  micro loop init --roles all

  # Customize the agent, token secret, base branch, and CI workflow name
  micro loop init --agent @codex --token-secret LOOP_TOKEN \
    --branch main --ci-workflow CI

  # Check that a repo is wired correctly
  micro loop verify`,
		Subcommands: []*cli.Command{
			{
				Name:  "init",
				Usage: "Scaffold the loop workflows, prompts, and queue into a repo",
				Flags: []cli.Flag{
					&cli.StringFlag{Name: "dir", Usage: "Target repo directory", Value: "."},
					&cli.StringFlag{Name: "roles", Usage: "Comma-separated roles, or 'all'", Value: "planner,builder,triage"},
					&cli.StringFlag{Name: "branch", Usage: "Base branch for the loop's PRs (auto-detected if empty)"},
					&cli.StringFlag{Name: "agent", Usage: "How the workflows summon the agent — any @mention-driven coding agent (e.g. @codex, @claude)", Value: "@codex"},
					&cli.StringFlag{Name: "token-secret", Usage: "Repo secret holding the user PAT that drives dispatch", Value: "LOOP_TOKEN"},
					&cli.StringFlag{Name: "ci-workflow", Usage: "CI workflow name(s) triage watches for failures (comma-separated)", Value: "CI"},
					&cli.StringFlag{Name: "planner-cron", Usage: "Cron schedule for the planner", Value: "0 * * * *"},
					&cli.StringFlag{Name: "builder-cron", Usage: "Cron schedule for the builder", Value: "30 * * * *"},
					&cli.StringFlag{Name: "coherence-cron", Usage: "Cron schedule for the coherence role", Value: "0 7 * * *"},
					&cli.StringFlag{Name: "security-cron", Usage: "Cron schedule for the security role", Value: "0 6 * * 1"},
					&cli.StringFlag{Name: "release-cron", Usage: "Cron schedule for the release role", Value: "0 23 * * *"},
					&cli.StringFlag{Name: "tag-prefix", Usage: "Tag prefix the release role matches and bumps", Value: "v"},
					&cli.BoolFlag{Name: "force", Usage: "Overwrite existing loop files"},
				},
				Action: runInit,
			},
			{
				Name:   "verify",
				Usage:  "Verify a repo is wired for the loop",
				Flags:  []cli.Flag{&cli.StringFlag{Name: "dir", Usage: "Target repo directory", Value: "."}},
				Action: runVerify,
			},
		},
	})
}

func runInit(c *cli.Context) error {
	dir := c.String("dir")
	roles, err := parseRoles(c.String("roles"))
	if err != nil {
		return err
	}

	ciNames := splitCSV(c.String("ci-workflow"))
	cfg := config{
		DefaultBranch:   c.String("branch"),
		AgentMention:    strings.TrimSpace(c.String("agent")),
		TokenSecret:     strings.TrimSpace(c.String("token-secret")),
		CIWorkflow:      strings.Join(ciNames, ", "),
		CIWorkflowsYAML: yamlStringArray(ciNames),
		TagPrefix:       c.String("tag-prefix"),
		ReleaseCron:     c.String("release-cron"),
	}
	if cfg.DefaultBranch == "" {
		cfg.DefaultBranch = detectDefaultBranch(dir)
	}
	if !strings.HasPrefix(cfg.AgentMention, "@") {
		cfg.AgentMention = "@" + cfg.AgentMention
	}

	crons := map[string]string{
		"planner":   c.String("planner-cron"),
		"builder":   c.String("builder-cron"),
		"coherence": c.String("coherence-cron"),
		"security":  c.String("security-cron"),
	}

	if err := scaffold(dir, cfg, roles, crons, c.Bool("force")); err != nil {
		return err
	}
	printNextSteps(cfg, roles)
	return nil
}

// parseRoles resolves the --roles flag into a validated, stable-ordered set.
func parseRoles(spec string) ([]string, error) {
	if strings.TrimSpace(spec) == "all" {
		return append([]string(nil), allRoles...), nil
	}
	want := map[string]bool{}
	for _, r := range strings.Split(spec, ",") {
		r = strings.TrimSpace(r)
		if r == "" {
			continue
		}
		if !isRole(r) {
			return nil, fmt.Errorf("unknown role %q (valid: %s, or 'all')", r, strings.Join(allRoles, ", "))
		}
		want[r] = true
	}
	if len(want) == 0 {
		return nil, fmt.Errorf("no roles selected")
	}
	var out []string
	for _, r := range allRoles { // preserve canonical order
		if want[r] {
			out = append(out, r)
		}
	}
	return out, nil
}

// splitCSV splits a comma-separated flag into trimmed, non-empty values.
func splitCSV(s string) []string {
	var out []string
	for _, v := range strings.Split(s, ",") {
		if v = strings.TrimSpace(v); v != "" {
			out = append(out, v)
		}
	}
	if len(out) == 0 {
		out = []string{"CI"}
	}
	return out
}

// yamlStringArray renders names as a YAML/JSON flow array, e.g. ["Lint", "Run Tests"].
// Names are known workflow display names (no embedded quotes), so a simple quote is safe.
func yamlStringArray(names []string) string {
	quoted := make([]string, len(names))
	for i, n := range names {
		quoted[i] = fmt.Sprintf("%q", n)
	}
	return "[" + strings.Join(quoted, ", ") + "]"
}

func isRole(r string) bool {
	for _, x := range allRoles {
		if x == r {
			return true
		}
	}
	return false
}

// scaffold renders the selected roles into dir. The split is deliberate:
//   - Workflows are the MECHANISM — regenerated, and overwritten with --force.
//   - Prompts, NORTH_STAR, and PRIORITIES are the POLICY — written once and
//     never clobbered, even with --force, so re-running init to refresh the
//     workflow mechanics can't wipe curated instructions, direction, or queue.
func scaffold(dir string, cfg config, roles []string, crons map[string]string, force bool) error {
	for _, role := range roles {
		switch role {
		case "triage":
			if err := renderTo(dir, "templates/loop-triage.yml.tmpl", filepath.Join(wfDir, "loop-triage.yml"), cfg, force); err != nil {
				return err
			}
			if err := renderKeep(dir, "templates/prompts/triage.md.tmpl", filepath.Join(promptDir, "triage.md"), cfg); err != nil {
				return err
			}
		case "release":
			if err := renderTo(dir, "templates/loop-release.yml.tmpl", filepath.Join(wfDir, "loop-release.yml"), cfg, force); err != nil {
				return err
			}
		default: // dispatch roles
			d := dispatchRoles[role]
			rc := cfg
			rc.Role = role
			rc.WorkflowName = d.work
```

### Core Architecture Module: `codec/grpc/util.go`
```
package grpc

import (
	"encoding/binary"
	"fmt"
	"io"
)

var (
	MaxMessageSize = 1024 * 1024 * 4 // 4Mb
	maxInt         = int(^uint(0) >> 1)
)

func decode(r io.Reader) (uint8, []byte, error) {
	header := make([]byte, 5)

	// read the header
	if _, err := r.Read(header); err != nil {
		return uint8(0), nil, err
	}

	// get encoding format e.g compressed
	cf := header[0]

	// get message length
	length := binary.BigEndian.Uint32(header[1:])

	// no encoding format
	if length == 0 {
		return cf, nil, nil
	}

	//
	if int64(length) > int64(maxInt) {
		return cf, nil, fmt.Errorf("grpc: received message larger than max length allowed on current machine (%d vs. %d)", length, maxInt)
	}
	if int(length) > MaxMessageSize {
		return cf, nil, fmt.Errorf("grpc: received message larger than max (%d vs. %d)", length, MaxMessageSize)
	}

	msg := make([]byte, int(length))

	if _, err := r.Read(msg); err != nil {
		if err == io.EOF {
			err = io.ErrUnexpectedEOF
		}
		return cf, nil, err
	}

	return cf, msg, nil
}

func encode(cf uint8, buf []byte, w io.Writer) error {
	header := make([]byte, 5)

	// set compression
	header[0] = cf

	// write length as header
	binary.BigEndian.PutUint32(header[1:], uint32(len(buf)))

	// read the header
	if _, err := w.Write(header); err != nil {
		return err
	}

	// write the buffer
	_, err := w.Write(buf)
	return err
}

```

### Core Architecture Module: `config/source/cli/util.go`
```
package cli

import (
	"errors"
	"flag"
	"strings"

	"github.com/urfave/cli/v2"
)

func copyFlag(name string, ff *flag.Flag, set *flag.FlagSet) {
	switch ff.Value.(type) {
	case *cli.StringSlice:
	default:
		_ = set.Set(name, ff.Value.String())
	}
}

func normalizeFlags(flags []cli.Flag, set *flag.FlagSet) error {
	visited := make(map[string]bool)
	set.Visit(func(f *flag.Flag) {
		visited[f.Name] = true
	})
	for _, f := range flags {
		parts := f.Names()
		if len(parts) == 1 {
			continue
		}
		var ff *flag.Flag
		for _, name := range parts {
			name = strings.Trim(name, " ")
			if visited[name] {
				if ff != nil {
					return errors.New("Cannot use two forms of the same flag: " + name + " " + ff.Name)
				}
				ff = set.Lookup(name)
			}
		}
		if ff == nil {
			continue
		}
		for _, name := range parts {
			name = strings.Trim(name, " ")
			if !visited[name] {
				copyFlag(name, ff, set)
			}
		}
	}
	return nil
}

```

### Core Architecture Module: `examples/flow-loop/main.go`
```
// Agentic Loop — keep working until the goal is met, with a guaranteed ceiling
//
// The "loop" pattern from agentic AI: instead of one shot, run a step over
// and over until the goal is reached, letting it decide when to stop — but
// always bounded by a hard iteration cap (the guardrail) so it can never run
// away, or run up an unbounded bill.
//
// flow.Loop is just a flow step, so it composes with the normal checkpointed
// step engine. This example needs no LLM key: the body is a plain func that
// "improves a draft" each pass, and a code-defined Until stops it once the
// draft is good enough — capped by FlowLoopMax. In a real flow the body would
// be micro.FlowDispatch("coder") (an agent) or micro.FlowLLM(...), and the
// stop check micro.FlowUntilLLM("Is the work complete?") — the supervised
// "Ralph" loop, where the model decides it's done but the cap still bounds it.
package main

import (
	"context"
	"fmt"

	"go-micro.dev/v6"
)

// Draft is the payload carried across iterations via State.Set / State.Scan.
type Draft struct {
	Text    string `json:"text"`
	Quality int    `json:"quality"` // 0..100, improved each pass
}

// improve is one loop pass: it refines the draft a bit. In a real flow this
// would be an agent or an LLM turn; here it's deterministic so the example
// runs offline.
func improve(_ context.Context, in micro.FlowState) (micro.FlowState, error) {
	var d Draft
	_ = in.Scan(&d)
	d.Quality += 30
	d.Text = fmt.Sprintf("draft refined (quality %d)", d.Quality)
	return in, in.Set(d)
}

func main() {
	const goodEnough = 90

	f := micro.NewFlow("refine",
		micro.FlowSteps(
			micro.FlowStep{Name: "improve", Run: micro.FlowLoop(
				improve,
				// Stop early once the draft is good enough...
				micro.FlowUntil(func(_ context.Context, s micro.FlowState, iter int) (bool, error) {
					var d Draft
					_ = s.Scan(&d)
					fmt.Printf("  pass %d → quality %d\n", iter, d.Quality)
					return d.Quality >= goodEnough, nil
				}),
				// ...but never run the body more than 10 times (the ceiling).
				micro.FlowLoopMax(10),
			)},
		),
		micro.FlowDeleteOnSuccess(),
	)

	fmt.Println("refining until quality >=", goodEnough)
	if err := f.Execute(context.Background(), `{"text":"initial draft","quality":0}`); err != nil {
		fmt.Println("flow error:", err)
		return
	}

	for _, r := range f.Results() {
		fmt.Printf("\ndone: %s\n", r.Answer)
	}
}

```

### Core Architecture Module: `flow/loop.go`
```
package flow

import (
	"context"
	"fmt"
	"strings"

	"go-micro.dev/v6/model"
)

// LoopCondition decides whether a Loop should stop, given the latest state
// and the iteration just completed (1-based). Returning true ends the loop.
type LoopCondition func(ctx context.Context, state State, iter int) (bool, error)

// LoopOptions configure a Loop. Max is the hard iteration cap — the ceiling
// that guarantees the loop always terminates, however the stop is decided.
// Until and UntilLLM are the optional early-stop checks.
type LoopOptions struct {
	Max      int
	Until    LoopCondition
	UntilLLM string
	OnIter   func(iter int, state State)
}

// LoopOption configures a Loop.
type LoopOption func(*LoopOptions)

// LoopMax sets the hard iteration cap — the budget guardrail. The loop never
// runs the body more than n times, so it always terminates even when the
// stop condition never fires. Default 10.
func LoopMax(n int) LoopOption { return func(o *LoopOptions) { o.Max = n } }

// Until stops the loop when cond returns true after an iteration — a
// deterministic, code-defined exit condition.
func Until(cond LoopCondition) LoopOption { return func(o *LoopOptions) { o.Until = cond } }

// UntilLLM stops the loop when the flow's model judges the goal met. After
// each iteration it asks the model the question with the latest state and
// stops on an affirmative answer — the agent decides when it's done (the
// supervised "Ralph" loop), while LoopMax guarantees termination. Requires a
// flow model (set Provider/APIKey).
func UntilLLM(question string) LoopOption { return func(o *LoopOptions) { o.UntilLLM = question } }

// OnIteration runs fn after each iteration — useful for logging progress or
// persisting intermediate state.
func OnIteration(fn func(iter int, state State)) LoopOption {
	return func(o *LoopOptions) { o.OnIter = fn }
}

// Loop returns a StepFunc that runs body repeatedly until a stop condition is
// met or the iteration cap is reached, whichever comes first — the agentic
// "loop": keep working until the goal is done, with a guaranteed ceiling so
// it can never run away.
//
// Compose it as a flow step. The carried State flows from one pass to the
// next, so each iteration sees the previous result:
//
//	flow.New("refactor",
//	    flow.Provider("anthropic"),
//	    flow.Steps(
//	        flow.Step{Name: "improve", Run: flow.Loop(
//	            flow.Dispatch("coder"),
//	            flow.UntilLLM("Is the refactor complete with no duplicated abstractions left?"),
//	            flow.LoopMax(5),
//	        )},
//	    ),
//	)
//
// The loop runs as a single flow step: the flow checkpoints the loop's
// outcome, and a resume re-enters the step, so loop bodies should be safe to
// repeat. Use OnIteration to record per-pass progress. If the cap is hit
// before the stop condition fires, the loop returns the latest state rather
// than erroring — the guardrail did its job.
func Loop(body StepFunc, opts ...LoopOption) StepFunc {
	o := LoopOptions{Max: 10}
	for _, op := range opts {
		op(&o)
	}
	if o.Max <= 0 {
		o.Max = 10
	}
	return func(ctx context.Context, in State) (State, error) {
		if body == nil {
			return in, fmt.Errorf("flow: Loop requires a body step")
		}
		cur := in
		for iter := 1; iter <= o.Max; iter++ {
			out, err := body(ctx, cur)
			if err != nil {
				return cur, fmt.Errorf("loop iteration %d: %w", iter, err)
			}
			cur = out
			if o.OnIter != nil {
				o.OnIter(iter, cur)
			}
			done, err := loopDone(ctx, o, cur, iter)
			if err != nil {
				return cur, err
			}
			if done {
				return cur, nil
			}
		}
		return cur, nil
	}
}

// loopDone evaluates the stop conditions: a code-defined Until predicate
// and/or an LLM judgement. Either firing stops the loop.
func loopDone(ctx context.Context, o LoopOptions, state State, iter int) (bool, error) {
	if o.Until != nil {
		done, err := o.Until(ctx, state, iter)
		if err != nil || done {
			return done, err
		}
	}
	if o.UntilLLM != "" {
		return askDone(ctx, o.UntilLLM, state)
	}
	return false, nil
}

// askDone asks the flow model whether the goal is met given the current
// state, and returns true on an affirmative reply — the supervised stop check.
func askDone(ctx context.Context, question string, state State) (bool, error) {
	d := depsFrom(ctx)
	if d == nil || d.model == nil {
		return false, fmt.Errorf("flow: UntilLLM requires a flow model (set Provider/APIKey)")
	}
	prompt := fmt.Sprintf("%s\n\nLatest result:\n%s\n\nAnswer with only \"yes\" or \"no\".", question, state.String())
	resp, err := d.model.Generate(ctx, &model.Request{Prompt: prompt})
	if err != nil {
		return false, err
	}
	reply := resp.Answer
	if reply == "" {
		reply = resp.Reply
	}
	return isAffirmative(reply), nil
}

// isAffirmative reports whether a model reply reads as "yes/done".
func isAffirmative(s string) bool {
	s = strings.ToLower(strings.TrimSpace(s))
	for _, p := range []string{"yes", "done", "true", "complete", "finished"} {
		if strings.HasPrefix(s, p) {
			return true
		}
	}
	return false
}

```

### Core Architecture Module: `internal/harness/harnessutil/harnessutil.go`
```
package harnessutil

import (
	"fmt"
	"os"
	"time"

	"go-micro.dev/v6/agent"
	"go-micro.dev/v6/client"
	"go-micro.dev/v6/registry"
	"go-micro.dev/v6/selector"
)

const (
	// LiveTimeoutEnv overrides the per-call deadline used by live-provider
	// harness runs. It intentionally does not affect deterministic mock runs.
	LiveTimeoutEnv = "GO_MICRO_HARNESS_LIVE_TIMEOUT"
	// DefaultLiveTimeout is generous enough for slow but correct hosted models
	// while still bounding genuinely stuck live conformance runs.
	DefaultLiveTimeout = 5 * time.Minute
)

// LiveTimeout returns the harness per-call timeout for live providers. Mock runs
// keep their historical fast defaults by returning zero.
func LiveTimeout(provider string) time.Duration {
	if provider == "mock" {
		return 0
	}
	if raw := os.Getenv(LiveTimeoutEnv); raw != "" {
		d, err := time.ParseDuration(raw)
		if err != nil {
			fmt.Fprintf(os.Stderr, "invalid %s=%q; using %s\n", LiveTimeoutEnv, raw, DefaultLiveTimeout)
			return DefaultLiveTimeout
		}
		return d
	}
	return DefaultLiveTimeout
}

// Client returns an in-memory-registry client. Live provider harnesses get a
// larger request timeout so an otherwise correct agent run is not cut off by the
// default 30-second RPC deadline; mock runs are unchanged.
func Client(provider string, reg registry.Registry) client.Client {
	opts := []client.Option{
		client.Registry(reg),
		client.Selector(selector.NewSelector(selector.Registry(reg))),
	}
	if d := LiveTimeout(provider); d > 0 {
		opts = append(opts, client.RequestTimeout(d))
	}
	return client.NewClient(opts...)
}

// AgentOptions applies the same live-provider timeout to model and tool calls.
// The empty result for mock runs preserves their deterministic timing.
func AgentOptions(provider string) []agent.Option {
	if d := LiveTimeout(provider); d > 0 {
		return []agent.Option{agent.ModelCallTimeout(d), agent.ToolCallTimeout(d)}
	}
	return nil
}

```

### Core Architecture Module: `internal/util/addr/addr.go`
```
// addr provides functions to retrieve local IP addresses from device interfaces.
package addr

import (
	"net"

	"github.com/pkg/errors"
)

var (
	// ErrIPNotFound no IP address found, and explicit IP not provided.
	ErrIPNotFound = errors.New("no IP address found, and explicit IP not provided")
)

// IsLocal checks whether an IP belongs to one of the device's interfaces.
func IsLocal(addr string) bool {
	// Extract the host
	host, _, err := net.SplitHostPort(addr)
	if err == nil {
		addr = host
	}

	if addr == "localhost" {
		return true
	}

	// Check against all local ips
	for _, ip := range IPs() {
		if addr == ip {
			return true
		}
	}

	return false
}

// Extract returns a valid IP address. If the address provided is a valid
// address, it will be returned directly. Otherwise, the available interfaces
// will be iterated over to find an IP address, preferably private.
func Extract(addr string) (string, error) {
	// if addr is already specified then it's directly returned
	if len(addr) > 0 && (addr != "0.0.0.0" && addr != "[::]" && addr != "::") {
		return addr, nil
	}

	var (
		addrs   []net.Addr
		loAddrs []net.Addr
	)

	ifaces, err := net.Interfaces()
	if err != nil {
		return "", errors.Wrap(err, "failed to get interfaces")
	}

	for _, iface := range ifaces {
		ifaceAddrs, err := iface.Addrs()
		if err != nil {
			// ignore error, interface can disappear from system
			continue
		}

		if iface.Flags&net.FlagLoopback != 0 {
			loAddrs = append(loAddrs, ifaceAddrs...)
			continue
		}

		addrs = append(addrs, ifaceAddrs...)
	}

	// Add loopback addresses to the end of the list
	addrs = append(addrs, loAddrs...)

	// Try to find private IP in list, public IP otherwise
	ip, err := findIP(addrs)
	if err != nil {
		return "", err
	}

	return ip.String(), nil
}

// IPs returns all available interface IP addresses.
func IPs() []string {
	ifaces, err := net.Interfaces()
	if err != nil {
		return nil
	}

	var ipAddrs []string

	for _, i := range ifaces {
		addrs, err := i.Addrs()
		if err != nil {
			continue
		}

		for _, addr := range addrs {
			var ip net.IP
			switch v := addr.(type) {
			case *net.IPNet:
				ip = v.IP
			case *net.IPAddr:
				ip = v.IP
			}

			if ip == nil {
				continue
			}

			ipAddrs = append(ipAddrs, ip.String())
		}
	}

	return ipAddrs
}

// findIP will return the first private IP available in the list.
// If no private IP is available it will return the first public IP, if present.
// If no public IP is available, it will return the first loopback IP, if present.
func findIP(addresses []net.Addr) (net.IP, error) {
	var publicIP net.IP
	var localIP net.IP

	for _, rawAddr := range addresses {
		var ip net.IP
		switch addr := rawAddr.(type) {
		case *net.IPAddr:
			ip = addr.IP
		case *net.IPNet:
			ip = addr.IP
		default:
			continue
		}

		if ip.IsLoopback() {
			if localIP == nil {
				localIP = ip
			}
			continue
		}

		if !ip.IsPrivate() {
			if publicIP == nil {
				publicIP = ip
			}
			continue
		}

		// Return private IP if available
		return ip, nil
	}

	// Return public or virtual IP
	if len(publicIP) > 0 {
		return publicIP, nil
	}

	// Return local IP
	if len(localIP) > 0 {
		return localIP, nil
	}

	return nil, ErrIPNotFound
}

```

### Core Architecture Module: `internal/util/backoff/backoff.go`
```
// Package backoff provides backoff functionality
package backoff

import (
	"math"
	"time"
)

// Do is a function x^e multiplied by a factor of 0.1 second.
// Result is limited to 2 minute.
func Do(attempts int) time.Duration {
	if attempts > 13 {
		return 2 * time.Minute
	}
	return time.Duration(math.Pow(float64(attempts), math.E)) * time.Millisecond * 100
}

```

### Core Architecture Module: `internal/util/buf/buf.go`
```
package buf

import (
	"bytes"
)

type buffer struct {
	*bytes.Buffer
}

func (b *buffer) Close() error {
	b.Reset()
	return nil
}

func New(b *bytes.Buffer) *buffer {
	if b == nil {
		b = bytes.NewBuffer(nil)
	}
	return &buffer{b}
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #4938** (2026-09-21): **[BUG] `ai/groq` (and `ai/openai`) `Generate`: tool-loop, dropped options, swallowed errors, retired default model**
  *Symptoms*:  **Labels:** bug, ai, groq, openai **Package:** `go-micro.dev/v6/ai/groq`, `go-micro.dev/v6/ai/openai` **Version:** v6.12.0 / v6.13.0 **Confidence:** mixed. Items 2 (swallowed error) and 3 (follow-up drops options) are source-verified in `ai/groq/groq.go`; items 1, 4, 5 and 6 are recorded from live failures and should be re-checked against v6.13.0 before filing (KNOWN_ISSUES #79 Addenda 4-7).  ## Summary  `Generate` implements its own one-round tool loop instead of reusing the shared `openaiapi` path that `Stream` uses. The copy has several defects. Numbered as in our write-up:  1. **History dropped (Groq).** `Generate` didn't thread `req.Messages`, so multi-turn conversations lost their history. 2. **Follow-up error swallowed (Groq, OpenAI).**    ```go    followUpResp, _, err := p.callAPI(ctx, ...)    if err == nil && followUpResp.Reply != "" { resp.Answer = followUpResp.Reply }   // err ignored    ```    A failing second round is silently dropped, so `ai.GenerateWithRetry`'s backoff and `ai.ClassifyError` never see it. 3. **Follow-up request loses options.** The second request is `{model, messages}` only: no `max_tokens`, no `reasoning_effort`, no tools. 4. **Echoed assistant message lost `"type":"function"`.** The assistant `tool_calls` are round-tripped through a struct with only `ID`/`Function`,    so `type` is dropped on re-marshal, and the provider returns `400 ... .type Field required`. The same undecorated struct exists in `ai/openai`    (reproduced against NVIDIA NI

- **Issue #4935** (2026-09-21): **[BUG] `agent`: 30s default timeouts mark a run terminal forever, with no recovery**
  *Symptoms*: **Labels:** bug / design, agent, reliability **Package:** `go-micro.dev/v6/agent` **Version:** v6.12.0 / v6.13.0 **Confidence:** observed live (KNOWN_ISSUES #48; a `ResumeChat` that took 32286ms), `terminalAgentRunStatus` source-verified  ## Summary  `ModelCallTimeout` and `ToolCallTimeout` default to 30s. A real multi-tool Anthropic turn (or a slow tool RPC) exceeds that. When it does:  1. The run's checkpoint is saved with status `timeout` (or `canceled` / `rate_limited`), all in `terminalAgentRunStatus`. 2. `agent.Resume` then refuses that run forever with `agent run X is terminal with status "timeout"`. 3. The caller's only option is to start a new conversation and lose the run's context. A run that was paused waiting on a human approval    is stranded permanently, even though the human already approved.  A timeout or a provider rate limit is transient, and it's treated as fatal.  ## Expected  - `timeout` and `rate_limited` are resumable (retry the failed step from the checkpoint), and only `canceled`/`failed`-by-policy are terminal. - Or `Resume(ctx, runID, agent.Retry())` explicitly re-arms a terminal-by-timeout run. - Defaults are documented with a guide for LLM-realistic values (60-120s), and the failure is reported as a typed error (see [06](06-agent-pause-and-terminal-via-error-strings.md)).  ## Suggested fix  Split "terminal" into *final* (`done`, `failed`, `canceled`) and *interrupted* (`timeout`, `rate_limited`). Let `Resume` continue an interrupted run from its 

- **Issue #4934** (2026-09-21): **[BUG] `agent`: `delegate` can hand a sub-agent unrestricted tool visibility; empty `Services` means "all"**
  *Symptoms*:  **Labels:** bug, security, agent **Package:** `go-micro.dev/v6/agent` **Version:** v6.12.0 / v6.13.0 (behaviour also seen on the pinned v6.13.0) **Confidence:** source-verified (`agent/builtin.go` `handleDelegate`, `agent/agent.go` `discoverTools`); reached by reading and by a live approval-gate test, not by exploiting a real leak (KNOWN_ISSUES #51)  ## Summary  `agent.Services(...)` is documented as the set of services an agent manages, and is the natural way to bound the tools a model can see. The built-in `delegate` tool breaks that bound in two ways:  1. `to` is optional. When blank, `handleDelegate` builds the ephemeral sub-agent with `Services(svcs...)` where `svcs` is empty. 2. `discoverTools` treats `len(a.opts.Services) == 0` as "no restriction" and returns every registered service's tools.  So `delegate(task, to="")` yields a sub-agent that can discover tools from all services, including ones the parent was never allowed to see. Likewise `delegate(to="identity")` scopes the sub-agent to a service that isn't in the parent's allowlist.  ```go // builtin.go var svcs []string if to != "" { svcs = []string{to} } sub := newEphemeral(Name(a.opts.Name+".sub"), Services(svcs...), ...)   // empty => unrestricted  // agent.go discoverTools if len(a.opts.Services) == 0 { scoped = append(scoped, t); continue }   // empty == everything ```  Each individual call would still be authorized by the owning service, so this is not a raw auth bypass. But tool visibility, which is what `

- **Issue #4930** (2026-09-21): **[BUG] `events/natsjs` `Ack`/`Nack` are no-ops without `AutoAck`, and `AutoAck` acks before the handler finishes**
  *Symptoms*:  **Labels:** bug, events, jetstream, delivery-guarantees **Package:** `go-micro.dev/v6/events/natsjs` **Version:** v6.12.0 / v6.13.0 **Confidence:** source-verified (`events/natsjs/nats.go`, `handleMsg` closure)  ## Summary  Neither ack mode gives "ack after my handler succeeded, redeliver if it failed":  - **`AutoAck: false`** (the default): the JetStream subscription is created with `AckExplicit()`, but `Event.Ack()` and   `Event.Nack()` are wired to functions that `return nil`. Nothing ever calls `msg.Ack()`, so messages sit un-acked and are   redelivered after `AckWait` regardless of whether your handler succeeded. - **`AutoAck: true`**: `Ack`/`Nack` are real, but the framework also calls `msg.Ack()` itself as soon as the event has been   pushed onto the consumer channel. Whatever the handler later does, the message is already acked, so a failure means a lost event.  ## Evidence  ```go if options.AutoAck {     evt.SetAckFunc(func() error  { return msg.Ack() })     evt.SetNackFunc(func() error { return msg.Nak() }) } else {     evt.SetAckFunc(func() error  { return nil })    // no-op     evt.SetNackFunc(func() error { return nil })    // no-op } channel <- evt if !options.AutoAck { return }                      // never acked here either if err := msg.Ack(nats.Context(ctx)); err != nil { ... }   // acked on delivery, not on success ```  ## Expected  Manual-ack mode wires `Ack`/`Nack` to `msg.Ack()`/`msg.Nak()`. Auto-ack mode acks after the consumer has handled the event, o

- **Issue #4929** (2026-09-21): **[BUG] `events/natsjs` `Consume` silently skips history on first connect and defaults to a random group**
  *Symptoms*: **Labels:** bug, events, jetstream, footgun **Package:** `go-micro.dev/v6/events/natsjs` **Version:** v6.12.0 / v6.13.0 **Confidence:** source-verified (`events/natsjs/nats.go`) + observed (KNOWN_ISSUES #17, 8 events permanently missing)  ## Summary  Two defaults combine into silent event loss:  1. When `ConsumeOptions.Offset` is the zero value, `Consume` applies `nats.DeliverNew()`. A durable consumer's first-ever    connection receives only events published after that moment. Anything already on the stream is skipped and never delivered. 2. `Group` defaults to `uuid.New().String()` on every call. Without `WithGroup`, each restart creates a brand-new durable    consumer, which per (1) also starts at "new only". Durability is lost without any warning.  ## Evidence  ```go // events/natsjs/nats.go, Consume() options := events.ConsumeOptions{ Group: uuid.New().String() }   // random per call ... if !options.Offset.IsZero() {     subOpts = append(subOpts, nats.StartTime(options.Offset)) } else {     subOpts = append(subOpts, nats.DeliverNew())                 // silent skip of history } ```  Live: two new consumer groups (`audit-communication-events`, `audit-billing-events`) connected against streams that already had history. `psql` showed 1 of 11 published communication events recorded. The other events were never delivered, not delayed. Nothing logged, nothing errored.  ## Expected  - A stable, named consumer resumes from its persisted position, and a new one starts from the be
  **Post-Mortem & Fix Analysis**:
  > @codex 
  > ### Summary  * Required explicit consumer groups when durable JetStream consumers are enabled, preventing restarts from silently creating unrelated consumers with random names. Ephemeral consumers retain generated names when no group is supplied. * Changed new durable consumers to replay retained stream history by default with `DeliverAll`, while ephemeral consumers continue using `DeliverNew`; explicit offsets still take precedence. * Added integration coverage for missing durable groups and historical-event replay, and updated the existing test to use a stable consumer group. * Documented group requirements, replay behavior, persisted resume positions, offsets, and ephemeral defaults. * Committed the changes as `fbc3de1` and opened [PR #4943](https://github.com/micro/go-micro/pull/4943), closing issue #4929. * Auto-merge could not be enabled because GitHub reported that protected branch rules are not configured. The PR remains open; it was not manually merged while CI was failing.  *

- **Issue #4928** (2026-09-21): **[BUG] `registry/nats` returns an empty success on timeout, so health checks can't detect NATS down**
  *Symptoms*: **Labels:** bug, registry, nats, health **Package:** `go-micro.dev/v6/registry/nats`, `go-micro.dev/v6/health` **Version:** v6.12.0 / v6.13.0 **Confidence:** source-verified (`registry/nats/nats.go` `query()`) + observed live (KNOWN_ISSUES #1)  ## Summary  `natsRegistry.query()` publishes a request and collects replies until quorum or timeout. On timeout it breaks out of the loop and returns whatever it has, including nothing, as `return services, nil`. "NATS is down" and "no services are registered" are therefore indistinguishable to `ListServices`, and `health.RegistryCheck` (which calls `ListServices`) reports `up` for the whole outage.  ## Evidence  ```go // registry/nats/nats.go, query() case <-timeoutChan:     break loop ... return services, nil        // nil error even when zero replies arrived ```  With NATS stopped, `/health/ready` kept returning `"registry":"up"` while real RPCs failed with `error selecting <svc> node: dial tcp: ... server misbehaving`. The `postgres` check flipped to `down` within milliseconds in the same session.  ## Expected  - A query that could not reach the server, or got no reply because the connection is closed, returns an error. - Only a genuine "reachable, nobody answered" returns an empty list. - `RegistryCheck` then reflects reality.  ## Suggested fix  1. In `query()`, check `n.conn.Status()`/`IsConnected()` before and after the wait and return an error if the connection is not up. 2. Return `registry.ErrNotFound` (or a distinct timeout 
  **Post-Mortem & Fix Analysis**:
  > @codex 
  > ### Summary  * Updated NATS registry queries to validate the connection both before publishing and after waiting for responses. Closed connections now return `nats.ErrConnectionClosed`, while disconnected or reconnecting connections return `nats.ErrDisconnected` instead of an empty successful result.  * Added an embedded-NATS regression test confirming that a reachable server with no registered services still returns an empty successful list, while a stopped server produces a disconnected error.  * Adjusted the NATS test harness so self-contained tests run without `NATS_URL`, while tests and benchmarks requiring an external NATS instance skip explicitly.  * Committed the changes as `e30864e` on `codex/4928-nats-query-connection-errors`. * Opened and merged pull request [#4945](https://github.com/micro/go-micro/pull/4945).  **Testing**  * ✅ `go build ./...` * ✅ `go test -json ./registry/nats -run TestQueryConnectionState -count=10` * ✅ `git diff --check` * ⚠️ `go test ./...` — the chang

- **Issue #4927** (2026-09-21): **[BUG] # 01 — `store/postgres/pgx.NewStore` leaves `Options.Context` nil and panics**
  *Symptoms*: **Labels:** bug, store, postgres **Package:** `go-micro.dev/v6/store/postgres/pgx` **Version:** v6.12.0 / v6.13.0 **Confidence:** source-verified (`store/postgres/pgx/pgx.go`) + observed (agent-service)  ## Summary  `NewStore` builds `store.Options` with only `Database` and `Table`. `Context` stays `nil`, and the store then passes `s.options.Context` straight into `pgxpool.NewWithConfig` and every `Exec`/`Query`. A nil context panics inside pgx (first seen when the pool's background idle-connection filler ran) instead of returning an error.  ## Evidence  ```go // store/postgres/pgx/pgx.go func NewStore(opts ...store.Option) store.Store {     options := store.Options{         Database: defaultDatabase,         Table:    defaultTable,     }                                   // Context is never defaulted     ... } ... db, err := pgxpool.NewWithConfig(s.options.Context, config)   // nil ctx ```  ## Repro  ```go st := pgx.NewStore(store.Nodes("postgres://..."))   // no store.WithContext(...) _ = st.Write(&store.Record{Key: "k", Value: []byte("v")}) ```  ## Expected  `Context` defaults to `context.Background()` like other options. Failing that, a clear error (`store: nil context`).  ## Actual  A nil-pointer panic from pgx, on the first use, well after construction. It looks like a crash in a background goroutine, not a misconfiguration.  ## Suggested fix  Default `options.Context = context.Background()` in `NewStore`, after applying options if it is still nil. Add a test that const
  **Post-Mortem & Fix Analysis**:
  > @codex 
  > ### Summary  * Updated the pgx PostgreSQL store to assign `context.Background()` whenever construction options leave `Context` nil, preventing pgx pool and query operations from receiving a nil context. Explicit non-nil contexts remain unchanged.  * Added regression tests covering the default context, preservation of an explicitly configured context, and fallback when an explicitly nil context is supplied.  * Committed the change as `a988d54` (`fix(pgx): default store context`) on `codex/pgx-default-context`. * Opened and merged [PR #4944](https://github.com/micro/go-micro/pull/4944) into `master`.  **Testing**  * ✅ `go test ./store/postgres/pgx` * ✅ `go build ./...` * ✅ `git diff --check` * ⚠️ `go test ./...` — relevant pgx tests passed, but the complete suite failed because the environment blocks loopback connections with HTTP 403; an unrelated Atlas Cloud provider test also received HTTP 400. * ⚠️ `golangci-lint run ./...` — the installed linter was compiled with Go 1.24, which cann

- **Issue #4926** (2026-10-05): **[BUG] Second critical vulnerability in MCP gateway — request for private security disclosure**
  *Symptoms*: Hi maintainers,  Following up on issue #4925, I have identified a second critical severity vulnerability in the MCP gateway component of the master (v6 development) branch.  As the private security advisory channel is unavailable and the security contact email appears undeliverable, I'm opening this issue to request a private communication channel (email / Discord DM) to share the full vulnerability report, root cause analysis, proof of concept and remediation recommendations.  I strictly follow responsible coordinated disclosure. I will not publish any technical details, exploit steps or code snippets publicly before a patched release is available. I can send both vulnerability reports together once a private channel is established.  Thanks, Qc 
  **Post-Mortem & Fix Analysis**:
  > Join the discord https://discord.gg/G8Gk5j3uXr

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

### Incident Patch 1: `ff8e55c5` (2026-10-05)
**Commit Message**: fix(cli): report git commit version for go-install builds (#4977)

* fix(cli): report git commit version for go-install builds

* fix(cli): probe git at runtime when build carries no version

* fix(cli): default dev version to v6-dev for v6 major

* fix(cli): single defaultVersion const, pin injected path in test

**File**: `cmd/micro/main.go` (modified, +52/-2)
```diff
@@ -3,6 +3,9 @@ package main
 import (
 	"embed"
 	"go-micro.dev/v6/cmd"
+	"os/exec"
+	"runtime/debug"
+	"strings"
 
 	// Link every plugin so CLI flag selection (--registry etcd, --broker nats,
 	// --profile nats, ...) keeps working; library users omit this import.
@@ -27,7 +30,54 @@ import (
 //go:embed web/styles.css web/main.js web/templates/*
 var webFS embed.FS
 
-var version = "5.0.0-dev"
+const defaultVersion = "v6-dev"
+
+var version = defaultVersion
+
+// getVersion reports the ldflags-injected release version when set,
+// else the module or VCS revision stamped by the go tool, so binaries
+// installed via `go install ./cmd/micro` report the git commit instead
+// of the v6-dev fallback. Same build-info pattern as microVersion
+// in cmd/micro/cli/new (ponytail: keep in sync, don't abstract).
+func getVersion() string {
+	if version != defaultVersion && version != "" {
+		return version
+	}
+	if info, ok := debug.ReadBuildInfo(); ok {
+		if info.Main.Version != "" && info.Main.Version != "(devel)" {
+			return info.Main.Version
+		}
+		var revision string
+		var modified bool
+		for _, setting := range info.Settings {
+			switch setting.Key {
+			case "vcs.revision":
+				revision = setting.Value
+			case "vcs.modified":
+				modified = setting.Value == "true"
+			}
+		}
+		if revision != "" {
+			if len(revision) > 7 {
+				revision = revision[:7]
+			}
+			if modified {
+				revision += "-dirty"
+			}
+			return revision
+		}
+	}
+	// The go tool stamps no VCS info for linked worktrees (.git is a file,
+	// not a dir), so dev installs from a worktree get here. Ask git about
+	// the repo in the current directory instead; silent when absent.
+	// ponytail: one exec, ~15ms, dev-builds only; releases return above.
+	if out, err := exec.Command("git", "describe", "--tags", "--always", "--dirty").Output(); err == nil {
+		if rev := strings.TrimSpace(string(out)); rev != "" {
+			return rev
+		}
+	}
+	return version
+}
 
 func init() {
 	gateway.HTML = webFS
@@ -36,6 +86,6 @@ func init() {
 func main() {
 	_ = cmd.Init(
 		cmd.Name("micro"),
-		cmd.Version(version),
+		cmd.Version(getVersion()),
 	)
 }
```

**File**: `cmd/micro/main_test.go` (added, +20/-0)
```diff
@@ -0,0 +1,20 @@
+package main
+
+import "testing"
+
+// getVersion must always yield something printable: an injected, stamped,
+// or probed revision, else the dev fallback. Never empty.
+func TestGetVersionNonEmpty(t *testing.T) {
+	if v := getVersion(); v == "" {
+		t.Fatal("getVersion returned empty string")
+	}
+}
+
+// An ldflags-injected version wins over every fallback.
+func TestGetVersionInjected(t *testing.T) {
+	defer func(v string) { version = v }(version)
+	version = "v9.9.9-test"
+	if v := getVersion(); v != "v9.9.9-test" {
+		t.Fatalf("getVersion = %q, want injected version", v)
+	}
+}
```

---

### Incident Patch 2: `09f2b775` (2026-10-02)
**Commit Message**: fix: use canonical MIME form for Micro-Id, Micro-Span-Id and Micro-Trace-Id header keys (#4975)

**File**: `transport/headers/headers.go` (modified, +3/-3)
```diff
@@ -13,7 +13,7 @@ const (
 	// Method header.
 	Method = "Micro-Method"
 	// ID header.
-	ID = "Micro-ID"
+	ID = "Micro-Id"
 	// Prefix used to prefix headers.
 	Prefix = "Micro-"
 	// Namespace header.
@@ -25,9 +25,9 @@ const (
 	// ContentType header.
 	ContentType = "Content-Type"
 	// SpanID header.
-	SpanID = "Micro-Span-ID"
+	SpanID = "Micro-Span-Id"
 	// TraceIDKey header.
-	TraceIDKey = "Micro-Trace-ID"
+	TraceIDKey = "Micro-Trace-Id"
 	// Stream header.
 	Stream = "Micro-Stream"
 )
```

---

### Incident Patch 3: `db9bd070` (2026-09-29)
**Commit Message**: Add portable app definitions and a service-backed UI example (#4970)

**File**: `app/README.md` (added, +65/-0)
```diff
@@ -0,0 +1,65 @@
+# App
+
+An app is a human-facing interface to capabilities that agents can also use through services.
+This initial v6 package defines an app and serves its public assets. It works independently of Mu.
+
+```go
+public, err := fs.Sub(embeddedFiles, "public")
+if err != nil { return err }
+
+application, err := app.New(app.Definition{
+    Name: "notes", Version: "1.0.0", Description: "Shared notes",
+    Entrypoint: "index.html",
+    Services: []app.Dependency{
+        {Name: "notes", Endpoints: []string{"Notes.List", "Notes.Add"}},
+    },
+}, public)
+if err != nil { return err }
+
+mux.Handle("/", application.Handler())
+```
+
+`embeddedFiles` can be an `embed.FS`; any `fs.FS` is supported. The definition is
+JSON-serializable so a host can store or advertise it. Treat the filesystem as
+immutable for an app version, and supply only assets meant to be public.
+`Definition()` returns a copy; changing it does not change the running app.
+
+`Definition.Validate()` checks the shape without a running service. `New` also
+checks that the entrypoint exists. `CheckDependencies(reg)` checks that a
+registered version of each dependency has all declared endpoints and a node.
+It is a point-in-time metadata check, not a health, schema or permission check.
+
+## Serving
+
+Use the handler with `net/http`, or use the existing `web` package for registration
+and lifecycle management:
+
+```go
+def := application.Definition()
+server := web.NewService(
+    web.Name(def.Name), web.Version(def.Version),
+    web.Address("127.0.0.1:8080"),
+    web.Handler(application.Handler()),
+)
+return server.Run()
+```
+
+The entrypoint is served at `/`. Relative asset URLs work when mounted beneath a
+prefix with `http.StripPrefix`. Files support GET and HEAD; missing paths and
+directories return 404. There is no directory listing or automatic SPA fallback.
+The host supplies API routes, authentication and middleware; declaring a service
+does not expose it or authorize a caller.
+
+This handler serves trusted app assets. It does not isolate JavaScript or prevent
+an OS-backed filesystem from following symlinks. Hosts serving generated or
+untrusted apps must supply their own origin/iframe isolation and access policy.
+
+## Scope
+
+The package owns identity, version, description, entrypoint, assets and service
+dependency declarations. It does not own generation, persistence, app revisions,
+accounts, deployment, or an unrestricted HTTP-to-RPC proxy. Version is an opaque
+identifier, not a revision database. Model-generated and hand-written apps use
+the same definition.
+
+Run the [example](../examples/app/) to use one service through a UI and an agent.
```

**File**: `app/app.go` (added, +180/-0)
```diff
@@ -0,0 +1,180 @@
+// Package app defines a human-facing application backed by service capabilities.
+// Apps pair a portable definition with an fs.FS of public assets. They can be
+// served by net/http or web.Service; generation, storage and host policy remain
+// with the caller.
+package app
+
+import (
+	"bytes"
+	"fmt"
+	"io/fs"
+	"net/http"
+	"regexp"
+	"strings"
+
+	"go-micro.dev/v6/registry"
+)
+
+// Dependency declares service endpoints an app expects. It grants no access.
+// Endpoints use RPC names such as "Notes.List". An empty list requires only
+// the named service. Hosts provide the actual authenticated API connection.
+type Dependency struct {
+	Name      string   `json:"name"`
+	Endpoints []string `json:"endpoints,omitempty"`
+}
+
+// Definition is the portable description of one app version. Entrypoint is a
+// file path relative to the asset filesystem, for example "index.html".
+// Version is an opaque release identifier; this package does not manage revisions.
+type Definition struct {
+	Name        string       `json:"name"`
+	Version     string       `json:"version"`
+	Description string       `json:"description,omitempty"`
+	Entrypoint  string       `json:"entrypoint"`
+	Services    []Dependency `json:"services,omitempty"`
+}
+
+var identifier = regexp.MustCompile(`^[a-zA-Z0-9][a-zA-Z0-9._-]*$`)
+
+// Validate checks the definition without requiring assets or a running registry.
+func (d Definition) Validate() error {
+	if !identifier.MatchString(d.Name) || !identifier.MatchString(d.Version) {
+		return fmt.Errorf("app: name and version must be nonempty identifiers (letters, digits, dot, dash or underscore)")
+	}
+	if !publicPath(d.Entrypoint) {
+		return fmt.Errorf("app: entrypoint must name a public file relative to the asset root")
+	}
+	seen := make(map[string]bool)
+	for _, dep := range d.Services {
+		if !identifier.MatchString(dep.Name) || seen[dep.Name] {
+			return fmt.Errorf("app: invalid or duplicate service %q", dep.Name)
+		}
+		seen[dep.Name] = true
+		endpoints := make(map[string]bool)
+		for _, endpoint := range dep.Endpoints {
+			if strings.TrimSpace(endpoint) != endpoint || endpoint == "" || endpoints[endpoint] {
+				return fmt.Errorf("app: invalid or duplicate endpoint %q for %s", endpoint, dep.Name)
+			}
+			endpoints[endpoint] = true
+		}
+	}
+	return nil
+}
+
+// App is a validated definition and its public assets. Treat the supplied fs.FS
+// as immutable for the lifetime of the App. Supply only files intended for public
+// serving; this handler is not a sandbox for untrusted code or filesystem links.
+type App struct {
+	definition Definition
+	assets     fs.FS
+}
+
+// New validates an app and verifies its entrypoint exists as a regular file.
+func New(def Definition, assets fs.FS) (*App, error) {
+	if err := def.Validate(); err != nil {
+		return nil, err
+	}
+	if assets == nil {
+		return nil, fmt.Errorf("app: assets are required")
+	}
+	info, err := fs.Stat(assets, def.Entrypoint)
+	if err != nil {
+		return nil, fmt.Errorf("app: entrypoint: %w", err)
+	}
+	if !info.Mode().IsRegular() {
+		return nil, fmt.Errorf("app: entrypoint must be a regular file")
+	}
+	return &App{definition: clone(def), assets: assets}, nil
+}
+
+// Definition returns an independent copy that hosts can serialize or advertise.
+func (a *App) Definition() Definition { return clone(a.definition) }
+
+// Handler serves the entrypoint at / and public files at their relative paths.
+// Missing paths return 404; directories are never listed. Mount beneath a prefix
+// with http.StripPrefix. The host owns middleware, API routes and authentication.
+func (a *App) Handler() http.Handler { return http.HandlerFunc(a.serveHTTP) }
+
+func (a *App) serveHTTP(w http.ResponseWriter, r *http.Request) {
+	if r.Method != http.MethodGet && r.Method != http.MethodHead {
+		w.Header().Set("Allow", "GET, HEAD")
+		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
+		return
+	}
+	name := strings.TrimPrefix(r.URL.Path, "/")
+	if name == "" {
+		name = a.definition.Entrypoint
+	}
+	if !publicPath(name) {
+		http.NotFound(w, r)
+		return
+	}
+	info, err := fs.Stat(a.assets, name)
+	if err != nil || !info.Mode().IsRegular() {
+		http.NotFound(w, r)
+		return
+	}
+	data, err := fs.ReadFile(a.assets, name)
+	if err != nil {
+		http.NotFound(w, r)
+		return
+	}
+	w.Header().Set("X-Content-Type-Options", "nosniff")
+	http.ServeContent(w, r, name, info.ModTime(), bytes.NewReader(data))
+}
+
+func publicPath(name string) bool {
+	if !fs.ValidPath(name) || name == "." || strings.Contains(name, `\`) {
+		return false
+	}
+	for _, part := range strings.Split(name, "/") {
+		if strings.HasPrefix(part, ".") {
+			return false
+		}
+	}
+	return true
+}
+
+// CheckDependencies checks registry metadata at a point in time. At least one
+// registered version of each service must declare all requested endpoints.
+// It neither probes health nor checks caller permissions or schema compatibility.
+func (a *
```

**File**: `app/app_test.go` (added, +115/-0)
```diff
@@ -0,0 +1,115 @@
+package app
+
+import (
+	"encoding/json"
+	"net/http"
+	"net/http/httptest"
+	"strings"
+	"testing"
+	"testing/fstest"
+
+	"go-micro.dev/v6/registry"
+)
+
+func TestDefinitionRoundTripAndIsolation(t *testing.T) {
+	def := Definition{Name: "notes", Version: "1.0", Entrypoint: "index.html", Services: []Dependency{{Name: "notes", Endpoints: []string{"Notes.List"}}}}
+	data, err := json.Marshal(def)
+	if err != nil {
+		t.Fatal(err)
+	}
+	var decoded Definition
+	if err := json.Unmarshal(data, &decoded); err != nil {
+		t.Fatal(err)
+	}
+	a, err := New(decoded, fstest.MapFS{"index.html": {Data: []byte("hello")}})
+	if err != nil {
+		t.Fatal(err)
+	}
+	decoded.Services[0].Endpoints[0] = "changed"
+	copy := a.Definition()
+	copy.Services[0].Endpoints[0] = "changed again"
+	if got := a.Definition().Services[0].Endpoints[0]; got != "Notes.List" {
+		t.Fatal(got)
+	}
+}
+
+func TestAssets(t *testing.T) {
+	a, err := New(Definition{Name: "notes", Version: "1", Entrypoint: "start.html"}, fstest.MapFS{
+		"start.html":      {Data: []byte("<h1>Notes</h1>")},
+		"style.css":       {Data: []byte("body {color: black}")},
+		"private/.key":    {Data: []byte("secret")},
+		"folder/file.txt": {Data: []byte("file")},
+	})
+	if err != nil {
+		t.Fatal(err)
+	}
+	for _, tc := range []struct {
+		method, path string
+		status       int
+	}{
+		{"GET", "/", 200}, {"HEAD", "/", 200}, {"GET", "/style.css", 200},
+		{"GET", "/folder/", 404}, {"GET", "/missing", 404}, {"GET", "/../start.html", 404},
+		{"GET", "/%2e%2e/start.html", 404}, {"GET", "/private/.key", 404},
+		{"GET", "//start.html", 404}, {"POST", "/", 405},
+	} {
+		t.Run(tc.method+tc.path, func(t *testing.T) {
+			w := httptest.NewRecorder()
+			a.Handler().ServeHTTP(w, httptest.NewRequest(tc.method, tc.path, nil))
+			if w.Code != tc.status {
+				t.Fatalf("status=%d body=%s", w.Code, w.Body.String())
+			}
+			if tc.method == "HEAD" && w.Body.Len() != 0 {
+				t.Fatal("HEAD returned a body")
+			}
+		})
+	}
+	w := httptest.NewRecorder()
+	http.StripPrefix("/apps/notes", a.Handler()).ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/apps/notes/", nil))
+	if !strings.Contains(w.Body.String(), "<h1>Notes</h1>") {
+		t.Fatal(w.Body.String())
+	}
+}
+
+func TestInvalidDefinitions(t *testing.T) {
+	for _, entry := range []string{"", ".", "../index.html", "/index.html", "dir/.secret", `dir\index.html`, "missing.html", "dir"} {
+		_, err := New(Definition{Name: "notes", Version: "1", Entrypoint: entry}, fstest.MapFS{"dir/a.html": {Data: []byte("ok")}})
+		if err == nil {
+			t.Errorf("accepted %q", entry)
+		}
+	}
+	for _, def := range []Definition{
+		{Name: "bad/name", Version: "1", Entrypoint: "index.html"},
+		{Name: "notes", Entrypoint: "index.html"},
+		{Name: "notes", Version: "1", Entrypoint: "index.html", Services: []Dependency{{Name: "x"}, {Name: "x"}}},
+		{Name: "notes", Version: "1", Entrypoint: "index.html", Services: []Dependency{{Name: "x", Endpoints: []string{""}}}},
+	} {
+		if def.Validate() == nil {
+			t.Errorf("accepted %+v", def)
+		}
+	}
+}
+
+func TestDependenciesRequireOneCompleteVersion(t *testing.T) {
+	a, err := New(Definition{Name: "notes", Version: "1", Entrypoint: "index.html", Services: []Dependency{{Name: "notes", Endpoints: []string{"Notes.List", "Notes.Add"}}}}, fstest.MapFS{"index.html": {Data: []byte("ok")}})
+	if err != nil {
+		t.Fatal(err)
+	}
+	r := registry.NewMemoryRegistry()
+	if a.CheckDependencies(r) == nil {
+		t.Fatal("missing service accepted")
+	}
+	for _, v := range []struct{ version, endpoint string }{{"1", "Notes.List"}, {"2", "Notes.Add"}} {
+		if err := r.Register(&registry.Service{Name: "notes", Version: v.version, Nodes: []*registry.Node{{Id: v.version, Address: "127.0.0.1:1"}}, Endpoints: []*registry.Endpoint{{Name: v.endpoint}}}); err != nil {
+			t.Fatal(err)
+		}
+	}
+	if a.CheckDependencies(r) == nil {
+		t.Fatal("incompatible versions combined")
+	}
+	if err := r.Register(&registry.Service{Name: "notes", Version: "3", Nodes: []*registry.Node{{Id: "3", Address: "127.0.0.1:1"}}, Endpoints: []*registry.Endpoint{{Name: "Notes.List"}, {Name: "Notes.Add"}}}); err != nil {
+		t.Fatal(err)
+	}
+	if err := a.CheckDependencies(r); err != nil {
+		t.Fatal(err)
+	}
+}
```

**File**: `examples/README.md` (modified, +2/-0)
```diff
@@ -4,6 +4,8 @@ This directory contains runnable examples that take you through the Go Micro
 lifecycle: start with a service, expose it as agent-usable capability, then
 coordinate work with workflows.
 
+A human interface and an agent can share a service: see the [app example](app/).
+
 ## Quick Start
 
 Each example can be run with `go run .` from its directory unless its README says
```

**File**: `examples/app/README.md` (added, +44/-0)
```diff
@@ -0,0 +1,44 @@
+# An app and an agent using the same service
+
+From the repository root:
+
+```sh
+go run ./examples/app
+```
+
+Open **http://127.0.0.1:8080**. Save a note. The UI calls the `app-notes` service
+through two explicit HTTP routes supplied by the example host. The `app` package
+serves only the interface and assets.
+
+If multicast discovery is unavailable, run `go run ./examples/app -local` to use
+in-process discovery. The UI works in this mode, but a separate CLI cannot
+discover its service. The integration test below exercises the agent in-process.
+
+With normal discovery, the same capability is discoverable as agent tools. With the CLI installed and
+a provider key available in another terminal:
+
+```sh
+export OPENAI_API_KEY=your-api-key
+micro chat --provider openai
+```
+
+Ask it to list notes from `app-notes`, or add a note using that service. Refresh
+the page to see the change. If other agents are registered, CLI chat routes to
+those agents; select an agent configured with `AgentServices("app-notes")` or
+run the example in a separate development environment.
+
+The app definition declares `Notes.List` and `Notes.Add`. Startup checks these
+endpoints against the registry. `web.Service` handles HTTP hosting and discovery;
+the service owns the notes, and the agent uses the service's RPC endpoints.
+
+This demo binds to loopback and stores notes in memory. Restarting clears them.
+No model is invoked by starting the demo or using the UI. The executable needs
+port 8080; stop another local gateway before starting it.
+
+The deterministic integration test starts the RPC service, adds one note through
+the HTTP route and another through the agent harness with a mock model, and
+checks that the UI reads both:
+
+```sh
+go test -race ./app ./examples/app
+```
```

**File**: `examples/app/assets/app.js` (added, +23/-0)
```diff
@@ -0,0 +1,23 @@
+const form = document.querySelector('#form');
+const status = document.querySelector('#status');
+async function update(options) {
+  try {
+    const response = await fetch('api/notes', options);
+    if (!response.ok) throw new Error(await response.text());
+    const data = await response.json();
+    document.querySelector('#notes').replaceChildren(...data.notes.map(text => {
+      const item = document.createElement('li'); item.textContent = text; return item;
+    }));
+    status.textContent = data.notes.length ? `${data.notes.length} ${data.notes.length === 1 ? "note" : "notes"}` : 'No notes yet.';
+    return true;
+  } catch (error) { status.textContent = error.message; return false; }
+}
+form.addEventListener('submit', async event => {
+  event.preventDefault();
+  const button = form.querySelector('button'); button.disabled = true;
+  const saved = await update({method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({text: form.elements.note.value})});
+  if (saved) form.reset();
+  button.disabled = false;
+});
+document.querySelector('#refresh').addEventListener('click', () => update());
+update();
```

**File**: `examples/app/assets/index.html` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+<!doctype html>
+<html lang="en">
+<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Notes</title><link rel="stylesheet" href="style.css"><script src="app.js" defer></script></head>
+<body><main><p class="eyebrow">GO MICRO APP</p><h1>Notes</h1><p>One service. Use it here or through your agent.</p><form id="form"><label for="note">Add a note</label><div><input id="note" name="note" required maxlength="4096" autocomplete="off"><button>Save</button></div></form><p id="status" role="status"></p><ul id="notes"></ul><button id="refresh" type="button">Refresh notes</button><footer>Notes are stored in memory for this demo.</footer></main></body>
+</html>
```

**File**: `examples/app/assets/style.css` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+:root { color-scheme: light; font: 16px/1.6 system-ui, sans-serif; color: #243344; background: #f6f8fa; }
+body { margin: 0; } main { max-width: 38rem; margin: 8vh auto; padding: 1.5rem; }
+h1 { font-size: 2.4rem; font-weight: 600; margin: .4rem 0; } .eyebrow { font-size: .75rem; letter-spacing: .12em; color: #506579; }
+form { margin-top: 2rem; } label { display: block; margin-bottom: .5rem; } form div { display: flex; gap: .6rem; }
+input, button { font: inherit; border: 1px solid #c3ced8; border-radius: .4rem; padding: .6rem .8rem; } input { flex: 1; min-width: 0; background: white; } button { cursor: pointer; background: #e9eef3; color: inherit; } button:hover { background: #dae3ec; }
+ul { padding: 0; list-style: none; } li { padding: .8rem 0; border-bottom: 1px solid #dbe2e9; overflow-wrap: anywhere; } #status { color: #43566a; min-height: 1.5rem; } footer { margin-top: 3rem; color: #586c7e; font-size: .85rem; }
```

---

### Incident Patch 4: `36117a4d` (2026-09-29)
**Commit Message**: Consolidate compatible provider loops and outline v7 ownership (#4969)

* Share compatible provider execution and propose v7 boundaries

* Clarify framework and Mu ownership in v7 proposal

* Remove assertion for intentionally deleted live harness workflow

* Align v7 proposal with independent framework and runtime responsibilities

**File**: `ROADMAP.md` (modified, +9/-1)
```diff
@@ -10,7 +10,15 @@ jobs: make **agentic development** excellent, and make the **developer experienc
 around it excellent.
 
 The full, current roadmap lives at **[go-micro.dev/docs/roadmap](https://go-micro.dev/docs/roadmap)**
-([source](internal/website/docs/roadmap.md)). The highlights:
+([source](internal/website/content/en/docs/roadmap.md)). The highlights:
+
+## Towards v7 — proposal
+
+We are reviewing a direction built around a consistent execution harness and an
+application lifecycle: build from services and agents, then run, revise, and
+recover the result. Compatible provider cleanup comes first. The scope of a
+possible `app` package and the breaking changes that could justify v7 are in the
+[v7 proposal](internal/website/content/en/docs/v7.md); this is not a release commitment.
 
 ## Where we are (v6)
 
```

**File**: `internal/website/content/en/docs/roadmap.md` (modified, +7/-0)
```diff
@@ -4,6 +4,13 @@ title: "Roadmap"
 
 Go Micro is a framework for building **agents and services** in Go. An agent is a distributed system — it discovers services, calls them, holds state, and recovers from failure — so building an agent is building a service. The roadmap has two jobs: make **agentic development** excellent, and make the **developer experience** around it excellent. Nothing else.
 
+## Towards v7 — proposal
+
+A [v7 proposal](v7.md) explores a consistent model/agent execution contract and
+an application lifecycle built on services. Work starts with compatible provider
+cleanup; an `app` package will be shaped by a complete build, use, revise, and
+recover path in Mu and the CLI. This is a design review, not a release commitment.
+
 ## Where we are (v6)
 
 The foundation is in place:
```

**File**: `internal/website/content/en/docs/v7.md` (added, +123/-0)
```diff
@@ -0,0 +1,123 @@
+---
+title: "Towards v7"
+description: "A proposal for a consistent application framework built on services and agents."
+---
+
+Status: design proposal, September 2026. This describes a direction and release
+criteria, not shipped APIs or a committed release date.
+
+## The evolution
+
+Go Micro's foundation is service communication: RPC, discovery, encoding,
+transport, and pub/sub, with pluggable storage and infrastructure. Agents extend
+that foundation by discovering service capabilities and choosing how to use them.
+
+The proposed next step is **a framework for applications built from services and
+agents**. A developer can write an application or ask an agent to build it, then
+run, inspect, revise, and recover it through the same contracts. Existing RPC
+applications remain first-class; adopting AI is optional.
+
+An app can provide a UI, a callable capability, or both. App generation is one
+use of the framework. The framework also needs to make the resulting software
+understandable and operable after the generating conversation ends.
+
+## Responsibilities
+
+| Component | Owns | Does not own |
+|-----------|------|--------------|
+| `service` | Capability contracts, operations, application data | Choosing a user's goal |
+| `model` | Provider requests, responses, tool-call descriptions, usage | Executing tools or deciding when work is complete |
+| `agent` | Model/tool execution, memory, limits, approval and continuation | App hosting or a product's account model |
+| `flow` | Defined steps, verification and recovery boundaries | A second agent implementation |
+| Proposed `app` | Application identity, revisions, resources and dependency contracts | Model prompting, billing or a particular hosting platform |
+
+The model/agent split in this table is a **v7 target**. In v6, providers with a
+`ToolHandler` execute tools inside `Generate`. Removing that behavior is a public
+contract change and needs an explicit migration.
+
+## First: compatible v6 cleanup
+
+1. Share duplicated protocol code and preserve history, model options, tools,
+   and errors consistently. The first change consolidates the compatible
+   OpenAI, Groq, Mistral, Together and MiniMax generation loops. Other provider
+   protocols and CLI orchestration remain separate at this stage.
+2. Define provider conformance for one model turn: structured tool calls and
+   results, provider continuation data, streaming events, usage, and stop reasons.
+   Provider-specific reasoning state must survive the common representation.
+3. Bring CLI chat and registered-agent execution onto the same harness, keeping
+   generation as an explicitly supplied tool. Keep routing and terminal rendering
+   at the CLI boundary.
+4. Make work completion, limit exhaustion, cancellation, approval pauses, and
+   recoverable failures explicit. A reply or a saved checkpoint alone does not
+   establish that the requested effect occurred.
+
+These changes should ship incrementally where the v6 contract can be preserved.
+A major-version number is not needed for deduplication or bug fixes.
+
+## The first app package
+
+An app is the human-facing interface to capabilities that agents can also call
+through services. Start with identity (name, description and version), an entry
+point, assets, and declared service dependencies. Validate that definition and
+serve it through the existing HTTP/web infrastructure. A hand-written app and an
+agent-generated app use the same definition.
+
+The first package does not own generation, storage, publishing, accounts, or a
+revision database. Those can be supplied by services and runtimes. An app's
+dependency declaration describes what it needs; it does not grant access.
+The host supplies authenticated service access and decides how generated code
+may run. Static asset serving is not an isolation boundary for untrusted code.
+
+Prove this in Go Micro with one runnable app: a human uses its interface while
+an agent can call the same underlying service. Mu can adopt the package or
+contribute improvements without being a prerequisite for the example.
+
+Over time, distinguish the app's stable identity, a particular revision, and the
+run that builds or invokes it. Any later build/revision APIs should preserve a
+working revision on failure and recover work without resetting its attempt
+budget. Reports, files, and images are outputs too; they are not necessarily apps.
+
+## Go Micro, Mu, and Micro
+
+- **Go Micro** is the developer framework for services, agents, and apps.
+- **Mu** is a runtime that hosts those components, with an operating-system role.
+- **Micro** is the personal assistant hosted by Mu and presented at micro.mu.
+
+This proposal concerns Go Micro. Mu's runtime and the hosted assistant have
+separate development priorities. They use the framework and contribute where
+needed; their product requirements do not automatically become framework APIs.
+
+| Go Micro | Mu and application
```

**File**: `model/groq/groq.go` (modified, +1/-60)
```diff
@@ -59,68 +59,9 @@ func (p *Provider) Options() model.Options { return p.opts }
 func (p *Provider) String() string         { return "groq" }
 
 func (p *Provider) Generate(ctx context.Context, req *model.Request, opts ...model.GenerateOption) (*model.Response, error) {
-	messages := openaiapi.Messages(req)
-	apiReq := openaiapi.Request(p.opts, messages, req.Tools)
-
-	resp, rawMessage, err := p.callAPI(ctx, apiReq)
-	if err != nil {
-		return nil, err
-	}
-	if len(resp.ToolCalls) == 0 {
-		return resp, nil
-	}
-
-	// Tool execution loop: execute tools, send results back, and keep the
-	// tools on offer so the model can take the next step. A follow-up without
-	// "tools" asks the model to continue with its hands tied — the call it
-	// wanted comes back written out as prose — and without a loop a second
-	// step is impossible whatever the model wants. Bounded so a model that
-	// never stops asking cannot run forever.
-	if p.opts.ToolHandler != nil {
-		// Copied rather than aliased: append on a slice that shares an array
-		// with messages would overwrite it on a later round.
-		followUpMessages := append([]map[string]any(nil), messages...)
-		pending := resp.ToolCalls
-		raw := rawMessage
-		for round := 0; len(pending) > 0 && round < maxToolRounds; round++ {
-			followUpMessages = append(followUpMessages, map[string]any{
-				"role":       "assistant",
-				"content":    raw["content"],
-				"tool_calls": raw["tool_calls"],
-			})
-			for _, tc := range pending {
-				content := p.opts.ToolHandler(ctx, tc).Content
-				followUpMessages = append(followUpMessages, map[string]any{
-					"role":         "tool",
-					"tool_call_id": tc.ID,
-					"content":      content,
-				})
-			}
-
-			followUpReq := openaiapi.Request(p.opts, followUpMessages, req.Tools)
-
-			followUpResp, followUpRaw, err := p.callAPI(ctx, followUpReq)
-			if err != nil {
-				return nil, fmt.Errorf("tool follow-up: %w", err)
-			}
-			if followUpResp.Reply != "" {
-				resp.Answer = followUpResp.Reply
-			}
-			resp.StopReason = followUpResp.StopReason
-			pending, raw = followUpResp.ToolCalls, followUpRaw
-			resp.ToolCalls = append(resp.ToolCalls, followUpResp.ToolCalls...)
-		}
-	}
-
-	return resp, nil
+	return openaiapi.Generate(ctx, p.opts, req, p.callAPI)
 }
 
-// maxToolRounds bounds the tool-execution loop in a single Generate. Each
-// round is a model call plus the tools it asks for, so this is the ceiling on
-// one question's cost as well as its length; it is high enough that no honest
-// piece of multi-step work reaches it.
-const maxToolRounds = 12
-
 func (p *Provider) Stream(ctx context.Context, req *model.Request, opts ...model.GenerateOption) (model.Stream, error) {
 	return openaiapi.Stream(ctx, p.opts, req, "/v1/chat/completions")
 }
```

**File**: `model/internal/openaiapi/generate.go` (added, +55/-0)
```diff
@@ -0,0 +1,55 @@
+package openaiapi
+
+import (
+	"context"
+	"fmt"
+
+	"go-micro.dev/v6/model"
+)
+
+// MaxToolRounds bounds the legacy v6 tool loop shared by compatible providers.
+// Agent guardrails can impose additional limits on individual tool executions.
+const MaxToolRounds = 12
+
+// Generate preserves history, options, and tool definitions across model turns.
+// call performs one provider request; automatic tool execution remains supported
+// here for callers of the v6 model API that supply a ToolHandler.
+func Generate(ctx context.Context, opts model.Options, req *model.Request, call func(context.Context, map[string]any) (*model.Response, map[string]any, error)) (*model.Response, error) {
+	messages := Messages(req)
+	resp, raw, err := call(ctx, Request(opts, messages, req.Tools))
+	if err != nil {
+		return nil, err
+	}
+	if opts.ToolHandler == nil {
+		return resp, nil
+	}
+
+	pending := resp.ToolCalls
+	for round := 0; len(pending) > 0 && round < MaxToolRounds; round++ {
+		messages = append(messages, map[string]any{
+			"role":       "assistant",
+			"content":    raw["content"],
+			"tool_calls": raw["tool_calls"],
+		})
+		for _, tc := range pending {
+			content := opts.ToolHandler(ctx, tc).Content
+			messages = append(messages, map[string]any{
+				"role":         "tool",
+				"tool_call_id": tc.ID,
+				"content":      content,
+			})
+		}
+
+		next, nextRaw, err := call(ctx, Request(opts, messages, req.Tools))
+		if err != nil {
+			return nil, fmt.Errorf("tool follow-up: %w", err)
+		}
+		if next.Reply != "" {
+			resp.Answer = next.Reply
+		}
+		resp.StopReason = next.StopReason
+		pending, raw = next.ToolCalls, nextRaw
+		resp.ToolCalls = append(resp.ToolCalls, next.ToolCalls...)
+	}
+	return resp, nil
+}
```

**File**: `model/internal/openaiapi/request_integration_test.go` (modified, +40/-1)
```diff
@@ -12,11 +12,24 @@ import (
 
 	"go-micro.dev/v6/model"
 	"go-micro.dev/v6/model/groq"
+	"go-micro.dev/v6/model/minimax"
+	"go-micro.dev/v6/model/mistral"
 	"go-micro.dev/v6/model/openai"
+	"go-micro.dev/v6/model/together"
 )
 
+func compatibleProviders() map[string]func(...model.Option) model.Model {
+	return map[string]func(...model.Option) model.Model{
+		"openai":   func(opts ...model.Option) model.Model { return openai.NewProvider(opts...) },
+		"groq":     func(opts ...model.Option) model.Model { return groq.NewProvider(opts...) },
+		"mistral":  func(opts ...model.Option) model.Model { return mistral.NewProvider(opts...) },
+		"minimax":  func(opts ...model.Option) model.Model { return minimax.NewProvider(opts...) },
+		"together": func(opts ...model.Option) model.Model { return together.NewProvider(opts...) },
+	}
+}
+
 func TestChatRequestParity(t *testing.T) {
-	for name, factory := range map[string]func(...model.Option) model.Model{"groq": func(opts ...model.Option) model.Model { return groq.NewProvider(opts...) }, "openai": func(opts ...model.Option) model.Model { return openai.NewProvider(opts...) }} {
+	for name, factory := range compatibleProviders() {
 		for _, mode := range []string{"generate", "followup_error", "stream"} {
 			t.Run(name+"/"+mode, func(t *testing.T) {
 				requests, calls := 0, 0
@@ -171,3 +184,29 @@ func TestChatEmptyOutputLimit(t *testing.T) {
 		}
 	}
 }
+
+// Direct model users can inspect tool calls without allowing the provider to
+// execute them. Sharing the legacy loop must retain this single-turn boundary.
+func TestChatWithoutToolHandler(t *testing.T) {
+	for name, factory := range compatibleProviders() {
+		t.Run(name, func(t *testing.T) {
+			requests := 0
+			ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
+				requests++
+				fmt.Fprint(w, `{"choices":[{"message":{"content":"","tool_calls":[{"id":"call1","type":"function","function":{"name":"lookup","arguments":"{}"}}]}}]}`)
+			}))
+			defer ts.Close()
+			p := factory(model.WithBaseURL(ts.URL), model.WithAPIKey("test"))
+			resp, err := p.Generate(context.Background(), &model.Request{
+				Prompt: "find it",
+				Tools:  []model.Tool{{Name: "lookup", Properties: map[string]any{}}},
+			})
+			if err != nil {
+				t.Fatal(err)
+			}
+			if requests != 1 || len(resp.ToolCalls) != 1 || resp.ToolCalls[0].ID != "call1" || resp.Answer != "" {
+				t.Fatalf("requests=%d response=%+v; expected one unexecuted tool call", requests, resp)
+			}
+		})
+	}
+}
```

**File**: `model/minimax/minimax.go` (modified, +2/-101)
```diff
@@ -59,109 +59,9 @@ func (p *Provider) Options() model.Options { return p.opts }
 func (p *Provider) String() string         { return "minimax" }
 
 func (p *Provider) Generate(ctx context.Context, req *model.Request, opts ...model.GenerateOption) (*model.Response, error) {
-	var tools []map[string]any
-	for _, t := range req.Tools {
-		tools = append(tools, map[string]any{
-			"type": "function",
-			"function": map[string]any{
-				"name":        t.Name,
-				"description": t.Description,
-				"parameters": map[string]any{
-					"type":       "object",
-					"properties": t.Properties,
-				},
-			},
-		})
-	}
-
-	messages := make([]map[string]any, 0, len(req.Messages)+2)
-	messages = append(messages, map[string]any{
-		"role":    "system",
-		"content": req.SystemPrompt,
-	})
-	for _, message := range req.Messages {
-		messages = append(messages, map[string]any{
-			"role":    message.Role,
-			"content": message.Content,
-		})
-	}
-	messages = append(messages, map[string]any{
-		"role":    "user",
-		"content": req.Prompt,
-	})
-
-	apiReq := map[string]any{
-		"model":    p.opts.Model,
-		"messages": messages,
-	}
-	if len(tools) > 0 {
-		apiReq["tools"] = tools
-	}
-
-	resp, rawMessage, err := p.callAPI(ctx, apiReq)
-	if err != nil {
-		return nil, err
-	}
-	if len(resp.ToolCalls) == 0 {
-		return resp, nil
-	}
-
-	// Tool execution loop: execute tools, send results back, and keep the
-	// tools on offer so the model can take the next step. A follow-up without
-	// "tools" asks the model to continue with its hands tied — the call it
-	// wanted comes back written out as prose — and without a loop a second
-	// step is impossible whatever the model wants. Bounded so a model that
-	// never stops asking cannot run forever.
-	if p.opts.ToolHandler != nil {
-		// Copied rather than aliased: append on a slice that shares an array
-		// with messages would overwrite it on a later round.
-		followUpMessages := append([]map[string]any(nil), messages...)
-		pending := resp.ToolCalls
-		raw := rawMessage
-		for round := 0; len(pending) > 0 && round < maxToolRounds; round++ {
-			followUpMessages = append(followUpMessages, map[string]any{
-				"role":       "assistant",
-				"content":    raw["content"],
-				"tool_calls": raw["tool_calls"],
-			})
-			for _, tc := range pending {
-				content := p.opts.ToolHandler(ctx, tc).Content
-				followUpMessages = append(followUpMessages, map[string]any{
-					"role":         "tool",
-					"tool_call_id": tc.ID,
-					"content":      content,
-				})
-			}
-
-			followUpReq := map[string]any{
-				"model":    p.opts.Model,
-				"messages": followUpMessages,
-			}
-			if len(tools) > 0 {
-				followUpReq["tools"] = tools
-			}
-
-			followUpResp, followUpRaw, err := p.callAPI(ctx, followUpReq)
-			if err != nil {
-				break
-			}
-			if followUpResp.Reply != "" {
-				resp.Answer = followUpResp.Reply
-			}
-			pending, raw = followUpResp.ToolCalls, followUpRaw
-			resp.ToolCalls = append(resp.ToolCalls, followUpResp.ToolCalls...)
-		}
-	}
-
-	return resp, nil
+	return openaiapi.Generate(ctx, p.opts, req, p.callAPI)
 }
 
-// maxToolRounds bounds the tool-execution loop in a single Generate. Each
-// round is a model call plus the tools it asks for, so this is the ceiling on
-// one question's cost as well as its length; it is high enough that no honest
-// piece of multi-step work reaches it.
-const maxToolRounds = 12
-
 func (p *Provider) Stream(ctx context.Context, req *model.Request, opts ...model.GenerateOption) (model.Stream, error) {
 	return openaiapi.Stream(ctx, p.opts, req, "/v1/chat/completions")
 }
@@ -198,6 +98,7 @@ func (p *Provider) callAPI(ctx context.Context, req map[string]any) (*model.Resp
 				Content   string `json:"content"`
 				ToolCalls []struct {
 					ID       string `json:"id"`
+					Type     string `json:"type"`
 					Function struct {
 						Name      string `json:"name"`
 						Arguments string `json:"arguments"`
```

**File**: `model/mistral/mistral.go` (modified, +2/-90)
```diff
@@ -59,98 +59,9 @@ func (p *Provider) Options() model.Options { return p.opts }
 func (p *Provider) String() string         { return "mistral" }
 
 func (p *Provider) Generate(ctx context.Context, req *model.Request, opts ...model.GenerateOption) (*model.Response, error) {
-	var tools []map[string]any
-	for _, t := range req.Tools {
-		tools = append(tools, map[string]any{
-			"type": "function",
-			"function": map[string]any{
-				"name":        t.Name,
-				"description": t.Description,
-				"parameters": map[string]any{
-					"type":       "object",
-					"properties": t.Properties,
-				},
-			},
-		})
-	}
-
-	messages := []map[string]any{
-		{"role": "system", "content": req.SystemPrompt},
-		{"role": "user", "content": req.Prompt},
-	}
-
-	apiReq := map[string]any{
-		"model":    p.opts.Model,
-		"messages": messages,
-	}
-	if len(tools) > 0 {
-		apiReq["tools"] = tools
-	}
-
-	resp, rawMessage, err := p.callAPI(ctx, apiReq)
-	if err != nil {
-		return nil, err
-	}
-	if len(resp.ToolCalls) == 0 {
-		return resp, nil
-	}
-
-	// Tool execution loop: execute tools, send results back, and keep the
-	// tools on offer so the model can take the next step. A follow-up without
-	// "tools" asks the model to continue with its hands tied — the call it
-	// wanted comes back written out as prose — and without a loop a second
-	// step is impossible whatever the model wants. Bounded so a model that
-	// never stops asking cannot run forever.
-	if p.opts.ToolHandler != nil {
-		// Copied rather than aliased: append on a slice that shares an array
-		// with messages would overwrite it on a later round.
-		followUpMessages := append([]map[string]any(nil), messages...)
-		pending := resp.ToolCalls
-		raw := rawMessage
-		for round := 0; len(pending) > 0 && round < maxToolRounds; round++ {
-			followUpMessages = append(followUpMessages, map[string]any{
-				"role":       "assistant",
-				"content":    raw["content"],
-				"tool_calls": raw["tool_calls"],
-			})
-			for _, tc := range pending {
-				content := p.opts.ToolHandler(ctx, tc).Content
-				followUpMessages = append(followUpMessages, map[string]any{
-					"role":         "tool",
-					"tool_call_id": tc.ID,
-					"content":      content,
-				})
-			}
-
-			followUpReq := map[string]any{
-				"model":    p.opts.Model,
-				"messages": followUpMessages,
-			}
-			if len(tools) > 0 {
-				followUpReq["tools"] = tools
-			}
-
-			followUpResp, followUpRaw, err := p.callAPI(ctx, followUpReq)
-			if err != nil {
-				break
-			}
-			if followUpResp.Reply != "" {
-				resp.Answer = followUpResp.Reply
-			}
-			pending, raw = followUpResp.ToolCalls, followUpRaw
-			resp.ToolCalls = append(resp.ToolCalls, followUpResp.ToolCalls...)
-		}
-	}
-
-	return resp, nil
+	return openaiapi.Generate(ctx, p.opts, req, p.callAPI)
 }
 
-// maxToolRounds bounds the tool-execution loop in a single Generate. Each
-// round is a model call plus the tools it asks for, so this is the ceiling on
-// one question's cost as well as its length; it is high enough that no honest
-// piece of multi-step work reaches it.
-const maxToolRounds = 12
-
 func (p *Provider) Stream(ctx context.Context, req *model.Request, opts ...model.GenerateOption) (model.Stream, error) {
 	return openaiapi.Stream(ctx, p.opts, req, "/v1/chat/completions")
 }
@@ -187,6 +98,7 @@ func (p *Provider) callAPI(ctx context.Context, req map[string]any) (*model.Resp
 				Content   string `json:"content"`
 				ToolCalls []struct {
 					ID       string `json:"id"`
+					Type     string `json:"type"`
 					Function struct {
 						Name      string `json:"name"`
 						Arguments string `json:"arguments"`
```

---

### Incident Patch 5: `3791c5ec` (2026-09-24)
**Commit Message**: remove loop prompts

**File**: `.github/loop/NORTH_STAR.md` (removed, +0/-32)
```diff
@@ -1,32 +0,0 @@
-# North Star
-
-The direction the loop aligns every increment to. Depth lives in
-[`internal/docs/THESIS.md`](../../internal/docs/THESIS.md); this is the short,
-operative version the planner and builder read each run.
-
-## Mission
-
-Make building an **agent** as easy as building a **service**, on one runtime.
-Go Micro is a holistic agent harness and service framework encapsulating the
-lifecycle of **services → agents → workflows** — pluggable, progressive, and
-AI-native by default.
-
-## Right now — developer adoption
-
-The framework's depth is strong; the **on-ramp** is the gap. Weight the developer
-experience — a walkable first-agent tutorial, discoverable examples, docs
-wayfinding, install friction, debugging, the 0→1 and 0→hero path — **at least as
-highly as internal hardening**. A developer succeeding on their first agent
-matters more right now than another conformance/observability/interop increment.
-Do not let the queue fill entirely with internal depth work.
-
-## Guardrails
-
-- One concern per PR; small and reversible.
-- The gate is green CI (`go build`, `go test`, `golangci-lint`, `make harness`),
-  not human review — keep the suite strong; the loop is only as good as its evaluator.
-- **Off-limits without a human** (surface as notes, never auto-merge): breaking
-  public-API changes, brand/positioning/marketing copy, new dependencies,
-  architectural rewrites, product-default changes with broad behavioral impact.
-- Stay on `claude/*` / `codex/*` branches; base PRs on `master`. See
-  [`CODEX.md`](../../CODEX.md) and [`internal/docs/CONTINUOUS_IMPROVEMENT.md`](../../internal/docs/CONTINUOUS_IMPROVEMENT.md).
```

**File**: `.github/loop/PRIORITIES.md` (removed, +0/-41)
```diff
@@ -1,41 +0,0 @@
-# Priorities
-
-The ranked work queue for the autonomous improvement loop. The **planner** owns
-this file: each run it turns the [roadmap](../../ROADMAP.md) plus an internal scan
-into a single ordered list — highest-value first — each item linked to a tracking
-issue. The **builder** works the top item whose issue is still open. So the
-planner decides *what*, the builder *builds* it.
-
-**Bias to capability, not busy-work.** The top of this queue is net-new capability
-from the roadmap's *Now/Next* items. Hardening/conformance/DX polish is background
-work (roadmap *Ongoing*) — kept low here and capped, never allowed to crowd out
-capability. If an area has had several increments with no user-visible gain, it is done
-for now; rank real-headroom capability instead.
-
-**Reading / editing.** An item is done when its linked issue closes (the PR that
-builds it adds `Closes #<issue>`). The human can reorder this list or the issues at
-any time — direction always wins.
-
-**Off-limits to the loop** (planner proposes as notes, never auto-merged queue
-items): brand/positioning copy, breaking public-API changes, architectural
-rewrites.
-
-## Work queue (ranked)
-
-### Capability — the headline (roadmap: Now / Next)
-
-1. **A2A external-client conformance** ([#4815](https://github.com/micro/go-micro/issues/4815)) — make the gateway easier for non-go-micro agents to discover and stream from by serving the well-known agent card path and spec SSE events.
-2. **AP2 mandate foundation for agent payments** ([#4841](https://github.com/micro/go-micro/issues/4841)) — add opt-in checkout/payment mandate signing and verification so A2A-carried payment authority can settle over x402 without changing defaults.
-3. **Kubernetes CRD reconciler foundation** ([#4842](https://github.com/micro/go-micro/issues/4842)) — turn the shipped alpha `Agent`, `Service`, and `Flow` CRDs into a minimally runnable native deployment path with workload reconciliation and status conditions.
-
-### In flight — do not re-queue
-
-_None right now._
-
-### Background — hardening & DX (roadmap: Ongoing; capped)
-
-_Background hardening is intentionally empty right now. Recent work covered first-agent
-wayfinding, plan/delegate recovery, provider fallback repair, streaming, memory
-compaction, retry controls, provider-failure inspection, x402 buyer safety, gRPC-reflection MCP,
-MCP result conformance, and the alpha Kubernetes CRD surface. Further churn in those
-areas should be marked `needs-human` unless it unlocks a clear user-visible capability._
```

**File**: `.github/loop/prompts/builder.md` (removed, +0/-14)
```diff
@@ -1,14 +0,0 @@
-<!--
-The BUILDER prompt — go-micro's continuous-improvement increment. Editable
-policy; the workflow prepends the agent @mention and substitutes __ISSUE__
-before posting. Keep __ISSUE__ literal.
--->
-Run one continuous-improvement increment per `internal/docs/CONTINUOUS_IMPROVEMENT.md`, aligned to the North Star in `.github/loop/NORTH_STAR.md` (the services → agents → workflows lifecycle, with developer adoption as the current goal).
-
-PICK THE WORK FROM THE QUEUE: read `.github/loop/PRIORITIES.md` and take the highest-ranked item whose linked issue is still OPEN — that is your task, and its issue number is the one you close. If `PRIORITIES.md` is missing or every listed item's issue is already closed, fall back to the single highest-value roadmap / open-issue / improvement-radar item yourself.
-
-Implement it, and VERIFY `go build ./...`, `go test ./...`, and `golangci-lint run ./...`.
-
-Open the PR YOURSELF from the shell — do NOT use the make_pr tool (in this environment it only records metadata and never creates a PR). Create a uniquely-named branch under the `codex/` prefix: `git switch -c codex/increment-__ISSUE__`, then `git push -u origin codex/increment-__ISSUE__`, then `gh pr create --base master --label codex --title "<title>" --body "<body; include 'Closes #<the priority issue you built>' so it leaves the queue, and 'Closes #__ISSUE__' for this run's tracker>"`. Finally enable auto-merge so GitHub merges it once CI is green: `gh pr merge --squash --auto --delete-branch`.
-
-One concern per PR. Stay out of breaking public API and brand/positioning copy — surface those as notes for the human instead.
```

**File**: `.github/loop/prompts/coherence.md` (removed, +0/-14)
```diff
@@ -1,14 +0,0 @@
-<!--
-The COHERENCE prompt — go-micro's DevRel pass (public-surface coherence +
-CHANGELOG upkeep + changelog blog). Editable policy; the workflow prepends the
-agent @mention and substitutes __ISSUE__ before posting. Keep __ISSUE__ literal.
--->
-Act as DevRel for go-micro. Do these, in order.
-
-COHERENCE AUDIT. Audit the public surface — `README.md`, `internal/website/` (landing `index.html` + `docs/`), and the blog under `internal/website/blog/` — for coherence with the North Star in `.github/loop/NORTH_STAR.md` (an agent harness and service framework; the services → agents → workflows lifecycle). Look for: places where README / website / docs contradict each other, are stale, or describe behavior that has since changed (cross-check against the code and recently merged PRs); whether the README is crisp and leads with the harness positioning; and one to three genuinely blog-worthy items from recently shipped work.
-
-CHANGELOG UPKEEP (safe factual task — goes in the auto-merged PR). Keep `CHANGELOG.md` living, in Keep-a-Changelog format with newest content at the top under `## [Unreleased]`. Enumerate PRs merged to master since the last update (`gh pr list --state merged --base master --limit 60 --json number,title,mergedAt,labels`) and add a concise, user-facing entry for each genuine change not yet recorded under the right `### Added` / `### Changed` / `### Fixed` / `### Documentation` subheading — SKIP internal loop/CI/priorities-refresh churn. If a new `vX.Y.Z` tag was cut since the last run (`git fetch --tags --force`), rename `## [Unreleased]` to `## [X.Y.Z] - <Month YYYY>` and open a fresh empty `## [Unreleased]` above it. Do not invent entries.
-
-CHANGELOG BLOG POST (blog voice — do NOT auto-merge). If, and only if, enough user-facing work has accumulated since the last changelog post to be worth reading (roughly a week's worth; not a near-empty post every day), draft a short "What's new in Go Micro" post as the next-numbered file in `internal/website/blog/`, mirroring the latest post's frontmatter and prev-nav, and add an entry at the top of `internal/website/blog/index.html`. Base it strictly on the CHANGELOG.
-
-THEN: (A) post a findings report as a comment on this issue (#__ISSUE__) — what's aligned, what drifted, what you fixed, the CHANGELOG entries added, and whether you drafted a blog post (and why/why not). (B) Open ONE auto-merging PR for the SAFE factual work only — coherence/crispness fixes AND the CHANGELOG update (NOT brand/positioning rewrites, NOT the blog post): `git switch -c codex/coherence-__ISSUE__`, `git push -u origin codex/coherence-__ISSUE__`, `gh pr create --base master --label codex --title "<title>" --body "<summary, Closes #__ISSUE__>"`, then `gh pr merge --squash --auto --delete-branch`. (C) If you drafted a changelog blog post, open it as a SEPARATE PR (`codex/coherence-blog-__ISSUE__`, title prefixed `blog:`) and do NOT enable auto-merge — leave it for the human. Same for any brand/positioning copy. Do not use the make_pr tool.
```

**File**: `.github/loop/prompts/planner.md` (removed, +0/-20)
```diff
@@ -1,20 +0,0 @@
-<!--
-The PLANNER prompt — go-micro's "architect / founder lens". Editable policy;
-the workflow prepends the agent @mention and substitutes __ISSUE__ (this run's
-tracking issue) before posting. Keep __ISSUE__ literal.
--->
-Act as the architect — the founder lens — for go-micro, running continuously alongside the builders. Hold the whole picture: how the harness, the framework, and the developer UX fit together, what is in flight and what just merged, what to prioritize next, and what is missing or has drifted.
-
-(1) TRACK STATE — scan recently merged PRs and open `codex` PRs/issues to see what shipped and what is being built right now, so the queue reflects reality (drop done items, don't re-queue in-flight work).
-
-(2) ASSESS against the North Star in `.github/loop/NORTH_STAR.md` — lead with its Mission (*make building an agent as easy as building a service, on one runtime*) and re-derive alignment from the CANON: the blog under `internal/website/blog`, the `README`, and the website (read these, don't rely on the North Star alone), then `ROADMAP.md` (Now → Next → Later). Judge every priority against the mission: does it make the services → agents → workflows lifecycle simpler, more cohesive, and more operable? Weight real user-facing capability and the developer on-ramp; do not let the queue fill with internal depth work. Look at coherence and seams across the core packages (agent, ai, flow, gateway/mcp, gateway/a2a, model, server, store, registry) and the dev inner loop (scaffold → run → chat → inspect → deploy).
-
-AVOID DIMINISHING-RETURNS CHURN — this is the most important judgment you make. Before ranking anything, ask: *would a real user notice this, or is it the loop grooming itself?* Do NOT queue: another regression-guard/breadcrumb/"verify the docs stay linked" test around docs the loop already wrote; the Nth robustness workaround for a weak provider's malformed output (e.g. AtlasCloud text-tool-call repair) once the agent already tolerates that class; another variation of a subsystem that has been hardened several times recently (e.g. plan/delegate notify/side-effect edge cases). If an area has had several increments with no user-visible gain, it is DONE for now — mark further work there `needs-human` and rank something with real headroom instead (new capability in gateway/flow/model/store, interop depth, observability). A full queue is not the goal; a queue of things that matter is.
-
-(3) MAINTAIN THE QUEUE in `.github/loop/PRIORITIES.md` — a SINGLE ordered list, highest-value first, each item linking a scoped, CI-verifiable issue (#N). For any prioritized gap with no issue, file one: `gh issue create --label codex --label enhancement --title "<scoped task>" --body "<goal, scope, acceptance criteria>"`.
-
-OUTPUT — default to NOT committing. Post a concise assessment as a comment on this issue (#__ISSUE__): what shipped, what's in flight, the top real gaps, and — honestly — whether the recent increments have been high-value or busy-work. Then, in almost all cases, just close this issue (`gh issue close __ISSUE__`) with NO PR.
-
-Open a PR for `.github/loop/PRIORITIES.md` ONLY when the change is MATERIAL — meaning it changes what the builder builds next: (a) the top open item changes, (b) an item is added or removed, or (c) a top item's issue closed and must be dropped. Do NOT open a PR to reorder items below the top, reword descriptions, refresh notes, or "keep it current" — a re-rank that doesn't change the next build is not worth a commit, and this churn is the loop's single biggest waste. When a PR IS warranted: `git switch -c codex/planner-__ISSUE__`, `git push -u origin codex/planner-__ISSUE__`, `gh pr create --base master --label codex --title "<title>" --body "<summary, Closes #__ISSUE__>"`, then `gh pr merge --squash --auto --delete-branch`.
-
-Do NOT make breaking public-API or architectural changes yourself — surface those in the assessment as notes for the human. Open the PR yourself from the shell with `gh`; do not use the make_pr tool (it is a no-op stub).
```

**File**: `.github/loop/prompts/security.md` (removed, +0/-30)
```diff
@@ -1,30 +0,0 @@
-<!--
-The SECURITY prompt — go-micro's security audit. Editable policy; the workflow
-prepends the agent @mention and substitutes __ISSUE__ before posting. Keep
-__ISSUE__ literal.
-
-Deliberately conservative: it does NOT auto-merge fixes, and it does NOT publish
-exploit details in public issues (responsible disclosure).
--->
-Act as the security reviewer for go-micro. Audit for real, exploitable vulnerabilities — skip theoretical or lint-style noise.
-
-GO-MICRO ATTACK SURFACE — weight these:
-- **MCP gateway** (`gateway/mcp`) and **A2A gateway** (`gateway/a2a`) — untrusted input from agents/tools: auth/scope enforcement, injection into downstream RPC, SSRF via tool/agent URLs, rate-limit/circuit-breaker bypass, info leak in errors.
-- **x402 payments** (`wrapper/x402`) — payment verification and settlement: signature/mandate validation, replay, budget-reservation races, facilitator auth (CDP bearer) handling, amount/network confusion.
-- **Auth** (`auth/jwt`, `wrapper/auth`) — token validation, algorithm confusion, scope/priority rule bypass, missing checks on endpoints.
-- **AI providers** (`ai/*`) — base-URL and endpoint handling: SSRF via config-controlled `BaseURL`, API keys leaking into logs/errors, TLS verification.
-- **Agent tool loop** (`agent/`) — prompt injection reaching real tool calls, guardrail (`MaxSteps`/`LoopLimit`/`ApproveTool`) bypass, delegate/plan side effects.
-- **Trust boundaries** — `server` RPC handlers, `broker` consumers, `store`/`registry` inputs, `transport` TLS defaults (v6 verifies by default — confirm nothing regressed).
-- **The loop itself** — `.github/workflows/loop-*.yml`: the `CODEX_TRIGGER_TOKEN` PAT must never be echoed/leaked; workflow inputs must not enable script injection.
-- **Dependencies** — run `govulncheck ./...` (install if needed) and inspect `go.mod` for known CVEs.
-
-DEDUPE against open issues first.
-
-HOW TO REPORT:
-- **Known/public dependency CVEs**: file a `security` issue referencing the CVE + module; you MAY open a PR bumping to the patched version. Do NOT enable auto-merge.
-- **Novel, exploitable vulnerabilities in this code** (not yet public): do NOT post an exploit or PoC in a public issue. File a CONCISE `security` + `needs-human` issue naming the class, location (file/function), and impact only — and note it should go through GitHub private vulnerability reporting. Do NOT open a public fix PR that reveals it.
-- **Low-risk hardening**: a normal `security` issue is fine.
-
-NEVER auto-merge a security change. Never weaken a control to make a test pass. Architectural/breaking fixes → `needs-human` with the tradeoff.
-
-Post a summary as a comment on this issue (#__ISSUE__) — findings by severity, what you filed, what needs a human — then close it (`gh issue close __ISSUE__`). If you open a dependency-bump PR: `git switch -c loop/security-__ISSUE__`, `git push -u origin loop/security-__ISSUE__`, `gh pr create --base master --label codex --label security --title "<title>" --body "<summary, Closes #__ISSUE__>"` — then STOP, do NOT run `gh pr merge --auto`. Do not use the make_pr tool.
```

**File**: `.github/loop/prompts/triage.md` (removed, +0/-19)
```diff
@@ -1,19 +0,0 @@
-<!--
-The TRIAGE prompt — go-micro's CI-failure feedback path. Editable policy; the
-workflow prepends the agent @mention and substitutes __ISSUE__ (this tracking
-issue) and __RUNURL__ (the failed run) before posting. Keep both literal.
--->
-Triage the failed CI run at __RUNURL__. It may be the linter (Lint), the unit/integration tests (Run Tests), the vulnerability gate (govulncheck), or the provider-conformance harness (Harness (E2E)).
-
-Read the logs and root-cause each distinct failure. DEDUPE hard against open AND recently-closed issues — if a failure matches an existing or recurring one, comment "recurred" on that issue rather than filing a new one.
-
-WHAT TO FILE:
-- **Lint, Run Tests, or govulncheck failing on master** — a real regression. File a scoped issue (`gh issue create --label codex --label enhancement --title "<scoped fix>" --body "<root cause, where, acceptance>"`) so it is fixed promptly.
-- **A genuinely NEW, distinct provider-conformance defect** — file it.
-
-WHAT NOT TO FILE (this cap matters):
-- **Another instance of a class the agent already tolerates** — a weak provider (e.g. AtlasCloud) emitting malformed / text-rendered / partial tool calls, or another plan/delegate notify/side-effect edge case. These have been hardened repeatedly with diminishing returns. Do NOT auto-file yet another routine robustness patch. Comment "recurred — repeated class, capped" on the nearest existing issue and, if it seems genuinely worth more investment, label it `needs-human` for a human to decide. The loop should not keep chasing one weak provider's output shape.
-- **Transient flakes** — live-model latency, provider outages, rate limits, network timeouts with no code cause. Ignore.
-- **Anything needing a breaking or architectural change** — label `needs-human` and describe it.
-
-Close this issue (`gh issue close __ISSUE__`) when triage is done. Open any PR yourself from the shell with `gh`; do not use the make_pr tool.
```

---

### Incident Patch 6: `d8173629` (2026-09-24)
**Commit Message**: remove loop code

**File**: `.github/workflows/loop-builder.yml` (removed, +0/-63)
```diff
@@ -1,63 +0,0 @@
-name: "Loop: Builder"
-
-# Generated by `micro loop init`. A dispatch role of the autonomous loop: on a
-# cadence it opens a fresh tracking issue and posts the instruction in
-# .github/loop/prompts/builder.md to the agent (@codex).
-#
-# The workflow is the MECHANISM; that prompt file is the editable POLICY —
-# change what this role does by editing the prompt, not this YAML. A FRESH
-# issue per run is deliberate: agents derive the PR branch name from the
-# triggering issue, so reusing one tracker collapses every run onto one branch.
-#
-# Gated on CODEX_TRIGGER_TOKEN: the agent ignores @mentions from the
-# github-actions bot, so dispatch posts as a real user (a PAT). No token → no-op.
-
-on:
-  workflow_dispatch: {}
-  # PAUSED 2026-07-12: automatic schedule disabled while the team does focused
-  # 1:1 fixes. Still runnable on demand via workflow_dispatch. Re-enable by
-  # uncommenting the schedule below.
-  # schedule:
-  #   - cron: "29 * * * *"
-
-permissions:
-  issues: write
-
-concurrency:
-  group: loop-builder
-  cancel-in-progress: false
-
-jobs:
-  dispatch:
-    runs-on: ubuntu-latest
-    steps:
-      - uses: actions/checkout@v4 # needed to read the prompt file
-      - name: Dispatch builder
-        env:
-          GH_TOKEN: ${{ secrets.CODEX_TRIGGER_TOKEN || github.token }}
-          HAS_TOKEN: ${{ secrets.CODEX_TRIGGER_TOKEN != '' }}
-          REPO: ${{ github.repository }}
-          RUN_NUMBER: ${{ github.run_number }}
-        run: |
-          if [ "$HAS_TOKEN" != "true" ]; then
-            echo "CODEX_TRIGGER_TOKEN is not set — skipping (the agent ignores bot @mentions)."
-            exit 0
-          fi
-          PROMPT=".github/loop/prompts/builder.md"
-          if [ ! -f "$PROMPT" ]; then
-            echo "missing $PROMPT — run 'micro loop init'." >&2
-            exit 1
-          fi
-          ISSUE_URL=$(gh issue create --repo "$REPO" \
-            --title "Loop: build increment #$RUN_NUMBER" \
-            --body "Autonomous builder pass. Direction: .github/loop/NORTH_STAR.md; queue: .github/loop/PRIORITIES.md.")
-          ISSUE_NUM="${ISSUE_URL##*/}"
-          echo "Opened issue #$ISSUE_NUM — dispatching builder."
-          # The prompt file is the policy; strip its editorial <!-- --> header and
-          # substitute the tracking issue number (__ISSUE__) at runtime.
-          {
-            echo "@codex"
-            echo
-            sed -e '/<!--/,/-->/d' -e "s/__ISSUE__/$ISSUE_NUM/g" "$PROMPT"
-          } > "$RUNNER_TEMP/loop-body.md"
-          gh issue comment "$ISSUE_NUM" --repo "$REPO" --body-file "$RUNNER_TEMP/loop-body.md"
```

**File**: `.github/workflows/loop-coherence.yml` (removed, +0/-63)
```diff
@@ -1,63 +0,0 @@
-name: "Loop: Coherence"
-
-# Generated by `micro loop init`. A dispatch role of the autonomous loop: on a
-# cadence it opens a fresh tracking issue and posts the instruction in
-# .github/loop/prompts/coherence.md to the agent (@codex).
-#
-# The workflow is the MECHANISM; that prompt file is the editable POLICY —
-# change what this role does by editing the prompt, not this YAML. A FRESH
-# issue per run is deliberate: agents derive the PR branch name from the
-# triggering issue, so reusing one tracker collapses every run onto one branch.
-#
-# Gated on CODEX_TRIGGER_TOKEN: the agent ignores @mentions from the
-# github-actions bot, so dispatch posts as a real user (a PAT). No token → no-op.
-
-on:
-  workflow_dispatch: {}
-  # PAUSED 2026-07-12: automatic schedule disabled while the team does focused
-  # 1:1 fixes. Still runnable on demand via workflow_dispatch. Re-enable by
-  # uncommenting the schedule below.
-  # schedule:
-  #   - cron: "0 7 * * *"
-
-permissions:
-  issues: write
-
-concurrency:
-  group: loop-coherence
-  cancel-in-progress: false
-
-jobs:
-  dispatch:
-    runs-on: ubuntu-latest
-    steps:
-      - uses: actions/checkout@v4 # needed to read the prompt file
-      - name: Dispatch coherence
-        env:
-          GH_TOKEN: ${{ secrets.CODEX_TRIGGER_TOKEN || github.token }}
-          HAS_TOKEN: ${{ secrets.CODEX_TRIGGER_TOKEN != '' }}
-          REPO: ${{ github.repository }}
-          RUN_NUMBER: ${{ github.run_number }}
-        run: |
-          if [ "$HAS_TOKEN" != "true" ]; then
-            echo "CODEX_TRIGGER_TOKEN is not set — skipping (the agent ignores bot @mentions)."
-            exit 0
-          fi
-          PROMPT=".github/loop/prompts/coherence.md"
-          if [ ! -f "$PROMPT" ]; then
-            echo "missing $PROMPT — run 'micro loop init'." >&2
-            exit 1
-          fi
-          ISSUE_URL=$(gh issue create --repo "$REPO" \
-            --title "Loop: coherence review #$RUN_NUMBER" \
-            --body "Autonomous coherence pass. Direction: .github/loop/NORTH_STAR.md; queue: .github/loop/PRIORITIES.md.")
-          ISSUE_NUM="${ISSUE_URL##*/}"
-          echo "Opened issue #$ISSUE_NUM — dispatching coherence."
-          # The prompt file is the policy; strip its editorial <!-- --> header and
-          # substitute the tracking issue number (__ISSUE__) at runtime.
-          {
-            echo "@codex"
-            echo
-            sed -e '/<!--/,/-->/d' -e "s/__ISSUE__/$ISSUE_NUM/g" "$PROMPT"
-          } > "$RUNNER_TEMP/loop-body.md"
-          gh issue comment "$ISSUE_NUM" --repo "$REPO" --body-file "$RUNNER_TEMP/loop-body.md"
```

**File**: `.github/workflows/loop-planner.yml` (removed, +0/-63)
```diff
@@ -1,63 +0,0 @@
-name: "Loop: Planner"
-
-# Generated by `micro loop init`. A dispatch role of the autonomous loop: on a
-# cadence it opens a fresh tracking issue and posts the instruction in
-# .github/loop/prompts/planner.md to the agent (@codex).
-#
-# The workflow is the MECHANISM; that prompt file is the editable POLICY —
-# change what this role does by editing the prompt, not this YAML. A FRESH
-# issue per run is deliberate: agents derive the PR branch name from the
-# triggering issue, so reusing one tracker collapses every run onto one branch.
-#
-# Gated on CODEX_TRIGGER_TOKEN: the agent ignores @mentions from the
-# github-actions bot, so dispatch posts as a real user (a PAT). No token → no-op.
-
-on:
-  workflow_dispatch: {}
-  # PAUSED 2026-07-12: automatic schedule disabled while the team does focused
-  # 1:1 fixes. Still runnable on demand via workflow_dispatch. Re-enable by
-  # uncommenting the schedule below.
-  # schedule:
-  #   - cron: "59 * * * *"
-
-permissions:
-  issues: write
-
-concurrency:
-  group: loop-planner
-  cancel-in-progress: false
-
-jobs:
-  dispatch:
-    runs-on: ubuntu-latest
-    steps:
-      - uses: actions/checkout@v4 # needed to read the prompt file
-      - name: Dispatch planner
-        env:
-          GH_TOKEN: ${{ secrets.CODEX_TRIGGER_TOKEN || github.token }}
-          HAS_TOKEN: ${{ secrets.CODEX_TRIGGER_TOKEN != '' }}
-          REPO: ${{ github.repository }}
-          RUN_NUMBER: ${{ github.run_number }}
-        run: |
-          if [ "$HAS_TOKEN" != "true" ]; then
-            echo "CODEX_TRIGGER_TOKEN is not set — skipping (the agent ignores bot @mentions)."
-            exit 0
-          fi
-          PROMPT=".github/loop/prompts/planner.md"
-          if [ ! -f "$PROMPT" ]; then
-            echo "missing $PROMPT — run 'micro loop init'." >&2
-            exit 1
-          fi
-          ISSUE_URL=$(gh issue create --repo "$REPO" \
-            --title "Loop: planning review #$RUN_NUMBER" \
-            --body "Autonomous planner pass. Direction: .github/loop/NORTH_STAR.md; queue: .github/loop/PRIORITIES.md.")
-          ISSUE_NUM="${ISSUE_URL##*/}"
-          echo "Opened issue #$ISSUE_NUM — dispatching planner."
-          # The prompt file is the policy; strip its editorial <!-- --> header and
-          # substitute the tracking issue number (__ISSUE__) at runtime.
-          {
-            echo "@codex"
-            echo
-            sed -e '/<!--/,/-->/d' -e "s/__ISSUE__/$ISSUE_NUM/g" "$PROMPT"
-          } > "$RUNNER_TEMP/loop-body.md"
-          gh issue comment "$ISSUE_NUM" --repo "$REPO" --body-file "$RUNNER_TEMP/loop-body.md"
```

**File**: `.github/workflows/loop-release.yml` (removed, +0/-157)
```diff
@@ -1,157 +0,0 @@
-name: "Loop: Release"
-
-# Generated by `micro loop init`. Cuts the next tag when the default branch has
-# new commits since the latest one, and pushes it with a PAT (CODEX_TRIGGER_TOKEN)
-# so any tag-triggered release workflow fires. The bump reflects what shipped,
-# read from the CHANGELOG [Unreleased] section: new features (Added/Changed) cut
-# a MINOR; fixes/docs only cut a PATCH; breaking changes are skipped so a MAJOR
-# stays a human decision.
-#
-# The tag MUST be pushed with a PAT, not the default GITHUB_TOKEN: a tag pushed
-# by GITHUB_TOKEN does not trigger other workflows (Actions blocks that recursion).
-
-on:
-  workflow_dispatch: {}
-  # PAUSED 2026-07-12: automatic nightly release disabled while the team does
-  # focused 1:1 fixes. Cut a release on demand via workflow_dispatch. Re-enable
-  # by uncommenting the schedule below.
-  # schedule:
-  #   - cron: "0 23 * * *"
-
-permissions:
-  contents: read
-
-concurrency:
-  group: loop-release
-  cancel-in-progress: false
-
-jobs:
-  release:
-    runs-on: ubuntu-latest
-    steps:
-      - uses: actions/checkout@v4
-        with:
-          fetch-depth: 0 # need full history + all tags
-          # Do NOT persist the default GITHUB_TOKEN as a git credential: it would
-          # be sent on the PAT push below and override it, so the tag push would
-          # authenticate as github-actions[bot] and 403. Letting the PAT in the
-          # push URL be the only credential is the whole point.
-          persist-credentials: false
-      - name: Cut the next patch tag if there are new commits
-        env:
-          RELEASE_TOKEN: ${{ secrets.CODEX_TRIGGER_TOKEN }}
-          REPO: ${{ github.repository }}
-        run: |
-          if [ -z "$RELEASE_TOKEN" ]; then
-            echo "CODEX_TRIGGER_TOKEN is not set — skipping."
-            exit 0
-          fi
-          git fetch --tags --force
-
-          LATEST=$(git tag --list 'v*.*.*' --sort=-v:refname | head -1)
-          if [ -z "$LATEST" ]; then
-            echo "no vMAJOR.MINOR.PATCH tag found — aborting so nothing weird gets tagged."
-            exit 1
-          fi
-          echo "latest tag: $LATEST"
-
-          COUNT=$(git rev-list --count "$LATEST"..HEAD)
-          echo "commits since $LATEST: $COUNT"
-          if [ "$COUNT" -eq 0 ]; then
-            echo "no new commits since $LATEST — no release."
-            exit 0
-          fi
-
-          ver="${LATEST#v}"
-          major="${ver%%.*}"
-          rest="${ver#*.}"
-          minor="${rest%%.*}"
-          patch="${rest#*.}"
-          case "$major.$minor.$patch" in
-            [0-9]*.[0-9]*.[0-9]*) ;;
-            *) echo "unexpected tag shape: $LATEST" ; exit 1 ;;
-          esac
-
-          # Choose the bump from what actually shipped, read from the CHANGELOG
-          # [Unreleased] section (kept current by the coherence role):
-          #   new features (### Added / ### Changed) -> MINOR
-          #   fixes/docs only                        -> PATCH
-          #   breaking (### Removed / "(breaking)")  -> skip; a major is a human call
-          UNRELEASED=""
-          if [ -f CHANGELOG.md ]; then
-            UNRELEASED=$(awk '/^## \[Unreleased\]/{f=1; next} /^## \[/{f=0} f' CHANGELOG.md)
-          fi
-          if printf '%s\n' "$UNRELEASED" | grep -qiE '^### Removed|^### Changed \(breaking\)|BREAKING'; then
-            echo "CHANGELOG [Unreleased] contains breaking changes — a major release is a human decision. Skipping."
-            exit 0
-          elif printf '%s\n' "$UNRELEASED" | grep -qE '^### (Added|Changed)'; then
-            NEXT="v${major}.$((minor + 1)).0"
-            KIND="minor (new features)"
-          else
-            NEXT="v${major}.${minor}.$((patch + 1))"
-            KIND="patch (fixes/docs only)"
-          fi
-          echo "cutting: $NEXT — $KIND ($COUNT commits since $LATEST)"
-
-          git config user.name "loop release bot"
-          git config user.email "noreply@users.noreply.github.com"
-
-          # Roll [Unreleased] into the new version's section BEFORE tagging, so
-          # the changelog can never drift behind the tags again (it once fell
-          # five releases behind, with everything piled under [Unreleased]).
-          # The rolled commit is what gets tagged. If master rejects the push
-          # (e.g. branch protection), fall back to tagging the current HEAD and
-          # say so loudly — a release must not be blocked on the docs commit.
-          if printf '%s\n' "$UNRELEASED" | grep -qE '^### '; then
-            DATE=$(date -u +%Y-%m-%d)
-            if DATE="$DATE" NEXT="$NEXT" python3 - <<'PY'
-import os
-import sys
-
-path = "CHANGELOG.md"
-next_ver = os.environ["NEXT"].lstrip("v")
-date = os.environ["DATE"]
-
-with open(path, "r", encoding="utf-8") as f:
-    txt = f.read()
-
-needle = "## [Unreleased]\n"
-placeholder = "\n\n_Nothing yet — rolled into a version section on each release._\n\n---\n\n"
-
-pos = txt.fi
```

**File**: `.github/workflows/loop-security.yml` (removed, +0/-63)
```diff
@@ -1,63 +0,0 @@
-name: "Loop: Security"
-
-# Generated by `micro loop init`. A dispatch role of the autonomous loop: on a
-# cadence it opens a fresh tracking issue and posts the instruction in
-# .github/loop/prompts/security.md to the agent (@codex).
-#
-# The workflow is the MECHANISM; that prompt file is the editable POLICY —
-# change what this role does by editing the prompt, not this YAML. A FRESH
-# issue per run is deliberate: agents derive the PR branch name from the
-# triggering issue, so reusing one tracker collapses every run onto one branch.
-#
-# Gated on CODEX_TRIGGER_TOKEN: the agent ignores @mentions from the
-# github-actions bot, so dispatch posts as a real user (a PAT). No token → no-op.
-
-on:
-  workflow_dispatch: {}
-  # PAUSED 2026-07-12: automatic schedule disabled while the team does focused
-  # 1:1 fixes. Still runnable on demand via workflow_dispatch. Re-enable by
-  # uncommenting the schedule below.
-  # schedule:
-  #   - cron: "0 6 * * 1"
-
-permissions:
-  issues: write
-
-concurrency:
-  group: loop-security
-  cancel-in-progress: false
-
-jobs:
-  dispatch:
-    runs-on: ubuntu-latest
-    steps:
-      - uses: actions/checkout@v4 # needed to read the prompt file
-      - name: Dispatch security
-        env:
-          GH_TOKEN: ${{ secrets.CODEX_TRIGGER_TOKEN || github.token }}
-          HAS_TOKEN: ${{ secrets.CODEX_TRIGGER_TOKEN != '' }}
-          REPO: ${{ github.repository }}
-          RUN_NUMBER: ${{ github.run_number }}
-        run: |
-          if [ "$HAS_TOKEN" != "true" ]; then
-            echo "CODEX_TRIGGER_TOKEN is not set — skipping (the agent ignores bot @mentions)."
-            exit 0
-          fi
-          PROMPT=".github/loop/prompts/security.md"
-          if [ ! -f "$PROMPT" ]; then
-            echo "missing $PROMPT — run 'micro loop init'." >&2
-            exit 1
-          fi
-          ISSUE_URL=$(gh issue create --repo "$REPO" \
-            --title "Loop: security review #$RUN_NUMBER" \
-            --body "Autonomous security pass. Direction: .github/loop/NORTH_STAR.md; queue: .github/loop/PRIORITIES.md.")
-          ISSUE_NUM="${ISSUE_URL##*/}"
-          echo "Opened issue #$ISSUE_NUM — dispatching security."
-          # The prompt file is the policy; strip its editorial <!-- --> header and
-          # substitute the tracking issue number (__ISSUE__) at runtime.
-          {
-            echo "@codex"
-            echo
-            sed -e '/<!--/,/-->/d' -e "s/__ISSUE__/$ISSUE_NUM/g" "$PROMPT"
-          } > "$RUNNER_TEMP/loop-body.md"
-          gh issue comment "$ISSUE_NUM" --repo "$REPO" --body-file "$RUNNER_TEMP/loop-body.md"
```

**File**: `.github/workflows/loop-triage.yml` (removed, +0/-61)
```diff
@@ -1,61 +0,0 @@
-name: "Loop: Triage"
-
-# Generated by `micro loop init`. The feedback path of the evaluator: when a CI
-# workflow (Harness (E2E), Lint, Run Tests) fails on a non-PR run, dispatch the agent
-# (@codex) with the instruction in .github/loop/prompts/triage.md
-# to root-cause the failure and file scoped fix issues back into the queue — so
-# failures become fixes with no human in the middle. Gated on CODEX_TRIGGER_TOKEN.
-
-on:
-  workflow_dispatch: {}
-  # PAUSED 2026-07-12: automatic CI-failure dispatch disabled while the team
-  # does focused 1:1 fixes, so failures don't auto-spawn agent tasks. Re-enable
-  # by uncommenting the workflow_run trigger below.
-  # workflow_run:
-  #   workflows: ["Harness (E2E)", "Lint", "Run Tests", "govulncheck"]
-  #   types: [completed]
-
-permissions:
-  issues: write
-
-concurrency:
-  group: loop-triage
-  cancel-in-progress: false
-
-jobs:
-  triage:
-    # Only real failures on branch pushes/schedules — not PR-run failures, which
-    # the PR author already sees.
-    if: ${{ github.event.workflow_run.conclusion == 'failure' && github.event.workflow_run.event != 'pull_request' }}
-    runs-on: ubuntu-latest
-    steps:
-      - uses: actions/checkout@v4 # needed to read the prompt file
-      - name: Dispatch triage
-        env:
-          GH_TOKEN: ${{ secrets.CODEX_TRIGGER_TOKEN || github.token }}
-          HAS_TOKEN: ${{ secrets.CODEX_TRIGGER_TOKEN != '' }}
-          REPO: ${{ github.repository }}
-          RUN_ID: ${{ github.event.workflow_run.id }}
-          RUN_URL: ${{ github.event.workflow_run.html_url }}
-          WORKFLOW_NAME: ${{ github.event.workflow_run.name }}
-        run: |
-          if [ "$HAS_TOKEN" != "true" ]; then
-            echo "CODEX_TRIGGER_TOKEN is not set — skipping."
-            exit 0
-          fi
-          PROMPT=".github/loop/prompts/triage.md"
-          if [ ! -f "$PROMPT" ]; then
-            echo "missing $PROMPT — run 'micro loop init'." >&2
-            exit 1
-          fi
-          ISSUE_URL=$(gh issue create --repo "$REPO" \
-            --title "Loop: triage failed run $RUN_ID ($WORKFLOW_NAME)" \
-            --body "The '$WORKFLOW_NAME' workflow failed on a non-PR run: $RUN_URL")
-          ISSUE_NUM="${ISSUE_URL##*/}"
-          echo "Opened issue #$ISSUE_NUM — dispatching triage."
-          {
-            echo "@codex"
-            echo
-            sed -e '/<!--/,/-->/d' -e "s/__ISSUE__/$ISSUE_NUM/g" -e "s#__RUNURL__#$RUN_URL#g" "$PROMPT"
-          } > "$RUNNER_TEMP/loop-body.md"
-          gh issue comment "$ISSUE_NUM" --repo "$REPO" --body-file "$RUNNER_TEMP/loop-body.md"
```

---

### Incident Patch 7: `424784d9` (2026-09-24)
**Commit Message**: Fix punctuation in README description

Removed a comma from the description of the Go Micro framework.

**File**: `README.md` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@ An agent harness and service framework
 
 ## Overview
 
-Go Micro is a framework for agentic and service development. Service discovery, RPC, messaging, storage, pubsub and config underpin everything. 
+Go Micro is a framework for agentic and service development. Service discovery, RPC messaging, storage and pubsub underpin everything. 
 
 Agents use service endpoints as tools; workflows coordinate ordered steps and recover from saved checkpoints. Each package is pluggable and can run inside a single Go binary or multi process.
 
```

---

### Incident Patch 8: `afd75e24` (2026-09-21)
**Commit Message**: fix(gateway): enforce administrative and transport security boundaries (#4964)

* fix(gateway): enforce administrative and transport security boundaries

* fix(gateway): reject browser-controlled hosts on loopback sockets

* fix(mcp): expose trusted browser origins in CLI entrypoints

**File**: `cmd/micro/gateway/admin.go` (added, +35/-0)
```diff
@@ -0,0 +1,35 @@
+package gateway
+
+import (
+	"encoding/json"
+	"net/http"
+
+	"go-micro.dev/v6/store"
+)
+
+// adminRequired separates administrative control from tool invocation scopes.
+// Both the signed role and the current stored role must authorize administration.
+func adminRequired(st store.Store) func(http.HandlerFunc) http.HandlerFunc {
+	return func(next http.HandlerFunc) http.HandlerFunc {
+		return authRequired(st)(func(w http.ResponseWriter, r *http.Request) {
+			token := extractToken(r)
+			if tokenMatches(token) {
+				next(w, r)
+				return
+			}
+			claims, err := ParseJWT(token)
+			if err == nil && claims["type"] == "admin" {
+				id, _ := claims["sub"].(string)
+				records, readErr := st.Read("auth/" + id)
+				if readErr == nil && id != "" && len(records) == 1 {
+					var account Account
+					if json.Unmarshal(records[0].Value, &account) == nil && account.ID == id && account.Type == "admin" {
+						next(w, r)
+						return
+					}
+				}
+			}
+			http.Error(w, "Forbidden", http.StatusForbidden)
+		})
+	}
+}
```

**File**: `cmd/micro/gateway/security_test.go` (added, +97/-0)
```diff
@@ -0,0 +1,97 @@
+package gateway
+
+import (
+	"bytes"
+	"crypto/rand"
+	"crypto/rsa"
+	"encoding/json"
+	"html/template"
+	"net/http"
+	"net/http/httptest"
+	"os"
+	"strings"
+	"testing"
+	"time"
+
+	"go-micro.dev/v6/store"
+)
+
+func TestDashboardAdminBoundary(t *testing.T) {
+	oldHTML, oldToken, oldPrivate, oldPublic := HTML, authToken, jwtPrivateKey, jwtPublicKey
+	t.Cleanup(func() { HTML, authToken, jwtPrivateKey, jwtPublicKey = oldHTML, oldToken, oldPrivate, oldPublic })
+	HTML = os.DirFS("..")
+	authToken = "test-machine-token"
+	key, err := rsa.GenerateKey(rand.Reader, 2048)
+	if err != nil {
+		t.Fatal(err)
+	}
+	jwtPrivateKey, jwtPublicKey = key, &key.PublicKey
+	for _, role := range []string{"user", "service", "admin"} {
+		t.Run(role, func(t *testing.T) {
+			st := store.NewMemoryStore()
+			data, _ := json.Marshal(Account{ID: "caller", Type: role})
+			if err := st.Write(&store.Record{Key: "auth/caller", Value: data}); err != nil {
+				t.Fatal(err)
+			}
+			token, err := GenerateJWT("caller", role, []string{"*"}, time.Hour)
+			if err != nil {
+				t.Fatal(err)
+			}
+			storeJWTToken(st, token, "caller")
+			mux := http.NewServeMux()
+			registerHandlers(mux, parseTemplates(), st, true)
+			for _, path := range []string{"/auth/users", "/auth/tokens", "/auth/scopes", "/auth/scopes/bulk"} {
+				if role == "admin" && strings.Contains(path, "scopes") {
+					continue
+				} // discovery is irrelevant to this authorization regression
+				request := httptest.NewRequest(http.MethodPost, path, strings.NewReader("id=created&type=admin&password=test"))
+				request.Header.Set("Content-Type", "application/x-www-form-urlencoded")
+				request.Header.Set("Authorization", "Bearer "+token)
+				response := httptest.NewRecorder()
+				mux.ServeHTTP(response, request)
+				want := http.StatusForbidden
+				if role == "admin" {
+					want = http.StatusSeeOther
+				}
+				if response.Code != want {
+					t.Fatalf("%s: got %d want %d", path, response.Code, want)
+				}
+			}
+			records, _ := st.Read("auth/created")
+			if role != "admin" && len(records) > 0 {
+				t.Fatal("non-admin modified accounts")
+			}
+			if role == "admin" {
+				data, _ := json.Marshal(Account{ID: "caller", Type: "user"})
+				_ = st.Write(&store.Record{Key: "auth/caller", Value: data})
+				rr := httptest.NewRecorder()
+				req := httptest.NewRequest(http.MethodGet, "/auth/tokens", nil)
+				req.Header.Set("Authorization", "Bearer "+token)
+				mux.ServeHTTP(rr, req)
+				if rr.Code != http.StatusForbidden {
+					t.Fatal("demoted admin retained access")
+				}
+			}
+		})
+	}
+}
+
+func TestDashboardTemplatesEscapeUntrustedText(t *testing.T) {
+	old := HTML
+	HTML = os.DirFS("..")
+	t.Cleanup(func() { HTML = old })
+	tmpls := parseTemplates()
+	payload := `<script>untrusted()</script>`
+	for _, tmpl := range []*template.Template{tmpls.api, tmpls.service, tmpls.form, tmpls.home, tmpls.logs, tmpls.log, tmpls.status, tmpls.authTokens, tmpls.authLogin, tmpls.authUsers, tmpls.playground, tmpls.scopes} {
+		var out bytes.Buffer
+		if err := tmpl.Execute(&out, map[string]any{"Title": payload, "User": &TemplateUser{ID: payload}, "Log": payload, "Error": payload, "ServiceName": payload}); err != nil {
+			t.Fatal(err)
+		}
+		if strings.Contains(out.String(), payload) {
+			t.Fatal("unescaped template value")
+		}
+		if !strings.Contains(out.String(), "&lt;script&gt;") {
+			t.Fatal("missing escaped test value")
+		}
+	}
+}
```

**File**: `cmd/micro/gateway/server.go` (modified, +35/-12)
```diff
@@ -9,6 +9,7 @@ import (
 	"encoding/json"
 	"encoding/pem"
 	"fmt"
+	"html/template"
 	"io"
 	"io/fs"
 	"log"
@@ -21,7 +22,6 @@ import (
 	"strings"
 	"sync"
 	"syscall"
-	"text/template"
 	"time"
 
 	"github.com/urfave/cli/v2"
@@ -31,6 +31,7 @@ import (
 	"go-micro.dev/v6/cmd"
 	codecBytes "go-micro.dev/v6/codec/bytes"
 	"go-micro.dev/v6/gateway/mcp"
+	"go-micro.dev/v6/internal/browserorigin"
 	"go-micro.dev/v6/model"
 	_ "go-micro.dev/v6/model/anthropic"
 	_ "go-micro.dev/v6/model/atlascloud"
@@ -166,6 +167,10 @@ func deleteUserTokens(storeInst store.Store, userID string) {
 func authRequired(storeInst store.Store) func(http.HandlerFunc) http.HandlerFunc {
 	return func(next http.HandlerFunc) http.HandlerFunc {
 		return func(w http.ResponseWriter, r *http.Request) {
+			if r.Method != http.MethodGet && r.Method != http.MethodHead && !browserorigin.Allowed(r, []string{"https://" + r.Host}) {
+				http.Error(w, "Forbidden origin", http.StatusForbidden)
+				return
+			}
 			token := extractToken(r)
 			if token == "" {
 				if strings.HasPrefix(r.URL.Path, "/api/") && r.URL.Path != "/api" && r.URL.Path != "/api/" {
@@ -312,9 +317,15 @@ func registerHandlers(mux *http.ServeMux, tmpls *templates, storeInst store.Stor
 		authMw := authRequired(storeInst)
 		wrap = wrapAuth(authMw)
 	} else {
-		// No auth in dev mode - pass through handlers unchanged
+		// Local development skips authentication, but still rejects foreign browser origins.
 		wrap = func(h http.HandlerFunc) http.HandlerFunc {
-			return h
+			return func(w http.ResponseWriter, r *http.Request) {
+				if !browserorigin.Allowed(r, []string{"https://" + r.Host}) {
+					http.Error(w, "Forbidden origin", http.StatusForbidden)
+					return
+				}
+				h(w, r)
+			}
 		}
 	}
 
@@ -855,7 +866,7 @@ func registerHandlers(mux *http.ServeMux, tmpls *templates, storeInst store.Stor
 						if ep.Request != nil && len(ep.Request.Values) > 0 {
 							params += "<ul class=no-bullets>"
 							for _, v := range ep.Request.Values {
-								params += fmt.Sprintf("<li><b>%s</b> <span style='color:#888;'>%s</span></li>", v.Name, v.Type)
+								params += fmt.Sprintf("<li><b>%s</b> <span style='color:#888;'>%s</span></li>", template.HTMLEscapeString(v.Name), template.HTMLEscapeString(v.Type))
 							}
 							params += "</ul>"
 						} else {
@@ -864,7 +875,7 @@ func registerHandlers(mux *http.ServeMux, tmpls *templates, storeInst store.Stor
 						if ep.Response != nil && len(ep.Response.Values) > 0 {
 							response += "<ul class=no-bullets>"
 							for _, v := range ep.Response.Values {
-								response += fmt.Sprintf("<li><b>%s</b> <span style='color:#888;'>%s</span></li>", v.Name, v.Type)
+								response += fmt.Sprintf("<li><b>%s</b> <span style='color:#888;'>%s</span></li>", template.HTMLEscapeString(v.Name), template.HTMLEscapeString(v.Type))
 							}
 							response += "</ul>"
 						} else {
@@ -873,8 +884,8 @@ func registerHandlers(mux *http.ServeMux, tmpls *templates, storeInst store.Stor
 						endpoints = append(endpoints, map[string]any{
 							"Name":     ep.Name,
 							"Path":     apiPath,
-							"Params":   params,
-							"Response": response,
+							"Params":   template.HTML(params),
+							"Response": template.HTML(response),
 						})
 					}
 					anchor := strings.ReplaceAll(s.Name, ".", "-")
@@ -1227,7 +1238,7 @@ Use the token printed at startup, or generate more on the <a href='/auth/tokens'
 
 	// Auth routes - only registered when auth is enabled
 	if authEnabled {
-		authMw := authRequired(storeInst)
+		authMw := adminRequired(storeInst)
 
 		// loadEndpointScopes returns all stored endpoint scopes from the store
 		loadEndpointScopes := func() map[string][]string {
@@ -1489,6 +1500,10 @@ Use the token printed at startup, or generate more on the <a href='/auth/tokens'
 			_ = renderPage(w, tmpls.authUsers, map[string]any{"Title": "Users", "Users": users, "User": user})
 		}))
 		mux.HandleFunc("/auth/login", func(w http.ResponseWriter, r *http.Request) {
+			if r.Method == http.MethodPost && !browserorigin.Allowed(r, []string{"https://" + r.Host}) {
+				http.Error(w, "Forbidden origin", http.StatusForbidden)
+				return
+			}
 			if r.Method == http.MethodGet {
 				loginTmpl, err := template.ParseFS(HTML, "web/templates/base.html", "web/templates/auth_login.html")
 				if err != nil {
@@ -1535,6 +1550,8 @@ Use the token printed at startup, or generate more on the <a href='/auth/tokens'
 					Path:     "/",
 					Expires:  time.Now().Add(time.Hour * 24),
 					HttpOnly: true,
+					SameSite: http.SameSiteStrictMode,
+					Secure:   r.TLS != nil,
 				})
 				http.Redirect(w, r, "/", http.StatusSeeOther)
 				return
@@ -1629,10 +1646,11 @@ func Run(c *cli.Context) error {
 func buildMCPOptions(c *cli.Context, addr string) (mcp.Options, error) {
 	logger := log.New(os.Stdout, "[mcp-gateway] ", log.LstdFlags)
 	opts := mcp.Options{
-		Registry: registry.DefaultRegistry,
-		Address:  addr,
-		Context:  c.Context,
-		Logger:
```

**File**: `cmd/micro/mcp/mcp.go` (modified, +11/-4)
```diff
@@ -72,6 +72,12 @@ Examples:
   # Custom registry
   micro mcp serve --registry consul --registry_address consul:8500`,
 				Flags: []cli.Flag{
+					&cli.StringSliceFlag{
+						Name:    "mcp-allowed-origins",
+						Usage:   "Exact trusted browser origins for MCP (repeatable)",
+						EnvVars: []string{"MICRO_MCP_ALLOWED_ORIGINS"},
+					},
+
 					&cli.StringFlag{
 						Name:  "address",
 						Usage: "HTTP address to listen on (e.g., :3000). If not set, uses stdio.",
@@ -249,10 +255,11 @@ func serveAction(ctx *cli.Context) error {
 
 	// Create MCP server options
 	opts := mcp.Options{
-		Registry: reg,
-		Address:  ctx.String("address"),
-		Context:  context.Background(),
-		Logger:   log.Default(),
+		AllowedOrigins: ctx.StringSlice("mcp-allowed-origins"),
+		Registry:       reg,
+		Address:        ctx.String("address"),
+		Context:        context.Background(),
+		Logger:         log.Default(),
 	}
 
 	// Opt-in x402 payments: a config file (per-tool amounts) or flags.
```

**File**: `cmd/micro/run/run.go` (modified, +10/-4)
```diff
@@ -544,10 +544,11 @@ func Run(c *cli.Context) error {
 // limiting, scopes, x402) stay on the standalone `micro gateway` command.
 func buildRunMCPOptions(c *cli.Context, addr string) (mcp.Options, error) {
 	return mcp.Options{
-		Registry: registry.DefaultRegistry,
-		Address:  addr,
-		Context:  context.Background(),
-		Logger:   log.Default(),
+		AllowedOrigins: c.StringSlice("mcp-allowed-origins"),
+		Registry:       registry.DefaultRegistry,
+		Address:        addr,
+		Context:        context.Background(),
+		Logger:         log.Default(),
 	}, nil
 }
 
@@ -838,6 +839,11 @@ Examples:
 				Usage:   "Environment to use (default: development)",
 				EnvVars: []string{"MICRO_ENV"},
 			},
+			&cli.StringSliceFlag{
+				Name:    "mcp-allowed-origins",
+				Usage:   "Exact trusted browser origins for MCP (repeatable)",
+				EnvVars: []string{"MICRO_MCP_ALLOWED_ORIGINS"},
+			},
 			&cli.StringFlag{
 				Name:    "mcp-address",
 				Usage:   "MCP gateway address (e.g., :3000). Enables MCP protocol for AI tools.",
```

**File**: `cmd/micro/web/main.js` (modified, +3/-1)
```diff
@@ -25,7 +25,9 @@ document.addEventListener('DOMContentLoaded', function() {
                     respDiv.className = 'js-response';
                     form.appendChild(respDiv);
                 }
-                respDiv.innerHTML = '<pre>' + JSON.stringify(data, null, 2) + '</pre>';
+                const pre = document.createElement('pre');
+                pre.textContent = JSON.stringify(data, null, 2);
+                respDiv.replaceChildren(pre);
             } catch (err) {
                 alert('Error: ' + err);
             }
```

**File**: `gateway/mcp/httpjsonrpc.go` (modified, +16/-0)
```diff
@@ -10,9 +10,15 @@ import (
 type HandlerOption func(*handlerOptions)
 
 type handlerOptions struct {
+	allowedOrigins                             []string
 	serverName, serverVersion, protocolVersion string
 }
 
+// WithAllowedOrigins permits exact additional browser origins for NewHandler.
+func WithAllowedOrigins(origins ...string) HandlerOption {
+	return func(o *handlerOptions) { o.allowedOrigins = append([]string(nil), origins...) }
+}
+
 // WithServerInfo sets the name/version advertised in the initialize response.
 func WithServerInfo(name, version string) HandlerOption {
 	return func(o *handlerOptions) { o.serverName, o.serverVersion = name, version }
@@ -34,6 +40,16 @@ func NewHandler(r Resolver, opts ...HandlerOption) http.Handler {
 		fn(&o)
 	}
 	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
+		if !checkBrowserOrigin(w, req, o.allowedOrigins) {
+			return
+		}
+		if req.Method == http.MethodOptions {
+			w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
+			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, MCP-Protocol-Version")
+			w.WriteHeader(http.StatusNoContent)
+			return
+		}
+
 		if req.Method != http.MethodPost {
 			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
 			return
```

**File**: `gateway/mcp/mcp.go` (modified, +9/-0)
```diff
@@ -88,6 +88,9 @@ type RateLimitConfig struct {
 
 // Options configures the MCP gateway
 type Options struct {
+	// AllowedOrigins permits exact additional browser origins; defaults to same-origin only.
+	AllowedOrigins []string
+
 	// Registry for service discovery (required)
 	Registry registry.Registry
 
@@ -667,6 +670,9 @@ func (s *Server) toolCatalog() []*Tool {
 
 // handleListTools returns the list of available tools
 func (s *Server) handleListTools(w http.ResponseWriter, r *http.Request) {
+	if !s.checkOrigin(w, r) {
+		return
+	}
 	if s.opts.AuthFunc != nil {
 		if err := s.opts.AuthFunc(r); err != nil {
 			http.Error(w, "Unauthorized", http.StatusUnauthorized)
@@ -682,6 +688,9 @@ func (s *Server) handleListTools(w http.ResponseWriter, r *http.Request) {
 
 // handleCallTool executes a tool (makes an RPC call)
 func (s *Server) handleCallTool(w http.ResponseWriter, r *http.Request) {
+	if !s.checkOrigin(w, r) {
+		return
+	}
 	if s.opts.AuthFunc != nil {
 		if err := s.opts.AuthFunc(r); err != nil {
 			http.Error(w, "Unauthorized", http.StatusUnauthorized)
```

---

### Incident Patch 9: `012cd365` (2026-09-21)
**Commit Message**: feat(client): distinguish discovery failures and configure endpoint budgets (#4959)

**File**: `client/discovery.go` (added, +46/-0)
```diff
@@ -0,0 +1,46 @@
+package client
+
+import (
+	"errors"
+	"fmt"
+
+	merrors "go-micro.dev/v6/errors"
+	"go-micro.dev/v6/registry"
+	"go-micro.dev/v6/selector"
+)
+
+// ErrNoNodes means discovery succeeded but no usable node is available.
+var ErrNoNodes = selector.ErrNoneAvailable
+
+// DiscoveryError distinguishes missing services from unavailable discovery.
+// Unwrap retains the backend cause, and As exposes the structured RPC status.
+type DiscoveryError struct {
+	Service string
+	Cause   error
+	status  *merrors.Error
+}
+
+func (e *DiscoveryError) Error() string { return e.status.Error() }
+func (e *DiscoveryError) Unwrap() error { return e.Cause }
+func (e *DiscoveryError) As(target interface{}) bool {
+	if out, ok := target.(**merrors.Error); ok {
+		*out = e.status
+		return true
+	}
+	return false
+}
+func (e *DiscoveryError) Is(target error) bool {
+	return target == registry.ErrNotFound && (errors.Is(e.Cause, selector.ErrNotFound) || errors.Is(e.Cause, registry.ErrNotFound))
+}
+
+// NewDiscoveryError translates selection failures consistently for RPC clients.
+func NewDiscoveryError(service string, cause error) error {
+	if cause == nil {
+		return nil
+	}
+	code := int32(503)
+	if errors.Is(cause, selector.ErrNotFound) || errors.Is(cause, registry.ErrNotFound) {
+		code = 404
+	}
+	return &DiscoveryError{Service: service, Cause: cause, status: merrors.FromError(merrors.New("go.micro.client", fmt.Sprintf("discover service %s: %v", service, cause), code))}
+}
```

**File**: `client/endpoint_options_test.go` (added, +75/-0)
```diff
@@ -0,0 +1,75 @@
+package client
+
+import (
+	"context"
+	"errors"
+	"fmt"
+	"testing"
+	"time"
+
+	merrors "go-micro.dev/v6/errors"
+	"go-micro.dev/v6/registry"
+	"go-micro.dev/v6/selector"
+)
+
+func TestEndpointOptionsPrecedence(t *testing.T) {
+	options := map[string][]CallOption{"assistant/Agent.Chat": {WithRequestTimeout(2 * time.Minute), WithConnectionTimeout(time.Minute), WithRetries(0)}}
+	client := NewClient(RequestTimeout(time.Second), EndpointOptions(options))
+	delete(options, "assistant/Agent.Chat")
+	req := client.NewRequest("assistant", "Agent.Chat", nil)
+	got := ResolveCallOptions(client.Options(), req)
+	if got.RequestTimeout != 2*time.Minute || got.ConnectionTimeout != time.Minute || got.Retries != 0 {
+		t.Fatalf("options=%+v", got)
+	}
+	got = ResolveCallOptions(client.Options(), req, WithRequestTimeout(3*time.Minute))
+	if got.RequestTimeout != 3*time.Minute {
+		t.Fatal("per-call option did not win")
+	}
+	got = ResolveCallOptions(client.Options(), client.NewRequest("other", "Agent.Chat", nil))
+	if got.RequestTimeout != time.Second {
+		t.Fatal("endpoint config leaked to other service")
+	}
+}
+
+type discoverySelector struct {
+	selector.Selector
+	err error
+}
+
+func (s discoverySelector) Select(string, ...selector.SelectOption) (selector.Next, error) {
+	return nil, s.err
+}
+
+func TestDiscoveryErrorStatusAndCause(t *testing.T) {
+	for _, tc := range []struct {
+		cause  error
+		status int32
+	}{{registry.ErrNotFound, 404}, {selector.ErrNotFound, 404}, {ErrNoNodes, 503}, {fmt.Errorf("backend: %w", registry.ErrUnavailable), 503}} {
+		c := NewClient(Selector(discoverySelector{err: tc.cause}))
+		err := c.Call(context.Background(), c.NewRequest("missing", "Service.Get", nil), new(string))
+		var typed *DiscoveryError
+		var status *merrors.Error
+		if !errors.As(err, &typed) || !errors.As(err, &status) || status.Code != tc.status || !errors.Is(err, tc.cause) {
+			t.Fatalf("cause=%v err=%v", tc.cause, err)
+		}
+	}
+}
+
+func TestEndpointRequestBudgetWithCallerDeadline(t *testing.T) {
+	var timeout time.Duration
+	wrapper := func(CallFunc) CallFunc {
+		return func(ctx context.Context, _ *registry.Node, _ Request, _ interface{}, opts CallOptions) error {
+			timeout = opts.RequestTimeout
+			return nil
+		}
+	}
+	c := NewClient(EndpointOptions(map[string][]CallOption{"assistant/Agent.Chat": {WithRequestTimeout(time.Second)}}), WrapCall(wrapper))
+	ctx, cancel := context.WithTimeout(context.Background(), time.Minute)
+	defer cancel()
+	if err := c.Call(ctx, c.NewRequest("assistant", "Agent.Chat", nil), new(string), WithAddress("unused:1")); err != nil {
+		t.Fatal(err)
+	}
+	if timeout <= 0 || timeout > time.Second {
+		t.Fatalf("endpoint budget overridden by caller: %v", timeout)
+	}
+}
```

**File**: `client/grpc/endpoint_options_test.go` (added, +29/-0)
```diff
@@ -0,0 +1,29 @@
+package grpc
+
+import (
+	"context"
+	"testing"
+	"time"
+
+	"go-micro.dev/v6/client"
+	"go-micro.dev/v6/registry"
+)
+
+func TestEndpointBudgetNativeGRPC(t *testing.T) {
+	var timeout time.Duration
+	wrapper := func(client.CallFunc) client.CallFunc {
+		return func(ctx context.Context, _ *registry.Node, _ client.Request, _ interface{}, opts client.CallOptions) error {
+			timeout = opts.RequestTimeout
+			return nil
+		}
+	}
+	c := NewClient(client.EndpointOptions(map[string][]client.CallOption{"assistant/Agent.Chat": {client.WithRequestTimeout(time.Second)}}), client.WrapCall(wrapper))
+	ctx, cancel := context.WithTimeout(context.Background(), time.Minute)
+	defer cancel()
+	if err := c.Call(ctx, c.NewRequest("assistant", "Agent.Chat", new(string)), new(string), client.WithAddress("unused:1")); err != nil {
+		t.Fatal(err)
+	}
+	if timeout <= 0 || timeout > time.Second {
+		t.Fatalf("endpoint budget overridden by caller: %v", timeout)
+	}
+}
```

**File**: `client/grpc/grpc.go` (modified, +10/-29)
```diff
@@ -89,10 +89,7 @@ func (g *grpcClient) next(request client.Request, opts client.CallOptions) (sele
 	// get next nodes from the selector
 	next, err := g.opts.Selector.Select(service, opts.SelectOptions...)
 	if err != nil {
-		if err == selector.ErrNotFound {
-			return nil, errors.InternalServerError("go.micro.client", "service %s: %s", service, err.Error())
-		}
-		return nil, errors.InternalServerError("go.micro.client", "error selecting %s node: %s", service, err.Error())
+		return nil, client.NewDiscoveryError(service, err)
 	}
 
 	return next, nil
@@ -400,28 +397,21 @@ func (g *grpcClient) Call(ctx context.Context, req client.Request, rsp interface
 		return errors.InternalServerError("go.micro.client", "rsp is nil")
 	}
 	// make a copy of call opts
-	callOpts := g.opts.CallOptions
-	for _, opt := range opts {
-		opt(&callOpts)
-	}
+	callOpts := client.ResolveCallOptions(g.opts, req, opts...)
 
 	next, err := g.next(req, callOpts)
 	if err != nil {
 		return err
 	}
 
-	// check if we already have a deadline
-	d, ok := ctx.Deadline()
-	if !ok {
-		// no deadline so we create a new one
+	// The request budget and caller deadline both apply; the earlier wins.
+	if callOpts.RequestTimeout > 0 {
 		var cancel context.CancelFunc
 		ctx, cancel = context.WithTimeout(ctx, callOpts.RequestTimeout)
 		defer cancel()
-	} else {
-		// got a deadline so no need to setup context
-		// but we need to set the timeout we pass along
-		opt := client.WithRequestTimeout(time.Until(d))
-		opt(&callOpts)
+	}
+	if deadline, ok := ctx.Deadline(); ok {
+		callOpts.RequestTimeout = time.Until(deadline)
 	}
 
 	// should we noop right here?
@@ -456,10 +446,7 @@ func (g *grpcClient) Call(ctx context.Context, req client.Request, rsp interface
 		node, err := next()
 		service := req.Service()
 		if err != nil {
-			if err == selector.ErrNotFound {
-				return errors.InternalServerError("go.micro.client", "service %s: %s", service, err.Error())
-			}
-			return errors.InternalServerError("go.micro.client", "error selecting %s node: %s", service, err.Error())
+			return client.NewDiscoveryError(service, err)
 		}
 
 		// make the call
@@ -507,10 +494,7 @@ func (g *grpcClient) Call(ctx context.Context, req client.Request, rsp interface
 
 func (g *grpcClient) Stream(ctx context.Context, req client.Request, opts ...client.CallOption) (client.Stream, error) {
 	// make a copy of call opts
-	callOpts := g.opts.CallOptions
-	for _, opt := range opts {
-		opt(&callOpts)
-	}
+	callOpts := client.ResolveCallOptions(g.opts, req, opts...)
 
 	next, err := g.next(req, callOpts)
 	if err != nil {
@@ -549,10 +533,7 @@ func (g *grpcClient) Stream(ctx context.Context, req client.Request, opts ...cli
 		node, err := next()
 		service := req.Service()
 		if err != nil {
-			if err == selector.ErrNotFound {
-				return nil, errors.InternalServerError("go.micro.client", "service %s: %s", service, err.Error())
-			}
-			return nil, errors.InternalServerError("go.micro.client", "error selecting %s node: %s", service, err.Error())
+			return nil, client.NewDiscoveryError(service, err)
 		}
 
 		// make the call
```

**File**: `client/options.go` (modified, +28/-0)
```diff
@@ -36,6 +36,8 @@ type Options struct {
 
 	// Default Call Options
 	CallOptions CallOptions
+	// EndpointOptions are applied after defaults and before per-call options. Keys are service/endpoint.
+	EndpointOptions map[string][]CallOption
 
 	// Router sets the router
 	Router Router
@@ -450,3 +452,29 @@ func WithLogger(l logger.Logger) Option {
 		o.Logger = l
 	}
 }
+
+// EndpointOptions sets per-service/endpoint defaults, for example
+// "assistant/Agent.Chat": {WithRequestTimeout(2*time.Minute)}. The map and option
+// slices are copied. Per-call options take precedence, including explicit zero values.
+func EndpointOptions(endpoints map[string][]CallOption) Option {
+	copyOptions := make(map[string][]CallOption, len(endpoints))
+	for key, options := range endpoints {
+		copyOptions[key] = append([]CallOption(nil), options...)
+	}
+	return func(o *Options) { o.EndpointOptions = copyOptions }
+}
+
+// ResolveCallOptions applies client, endpoint and per-call options in that order.
+func ResolveCallOptions(o Options, req Request, overrides ...CallOption) CallOptions {
+	resolved := o.CallOptions
+	resolved.SelectOptions = append([]selector.SelectOption(nil), resolved.SelectOptions...)
+	resolved.CallWrappers = append([]CallWrapper(nil), resolved.CallWrappers...)
+	resolved.Address = append([]string(nil), resolved.Address...)
+	for _, option := range o.EndpointOptions[req.Service()+"/"+req.Endpoint()] {
+		option(&resolved)
+	}
+	for _, option := range overrides {
+		option(&resolved)
+	}
+	return resolved
+}
```

**File**: `client/rpc_client.go` (modified, +10/-39)
```diff
@@ -420,11 +420,7 @@ func (r *rpcClient) next(request Request, opts CallOptions) (selector.Next, erro
 	// get next nodes from the selector
 	next, err := r.opts.Selector.Select(service, opts.SelectOptions...)
 	if err != nil {
-		if errors.Is(err, selector.ErrNotFound) {
-			return nil, merrors.InternalServerError("go.micro.client", "service %s: %s", service, err.Error())
-		}
-
-		return nil, merrors.InternalServerError("go.micro.client", "error selecting %s node: %s", service, err.Error())
+		return nil, NewDiscoveryError(service, err)
 	}
 
 	return next, nil
@@ -437,29 +433,21 @@ func (r *rpcClient) Call(ctx context.Context, request Request, response interfac
 	defer r.mu.RUnlock()
 
 	// make a copy of call opts
-	callOpts := r.opts.CallOptions
-	for _, opt := range opts {
-		opt(&callOpts)
-	}
+	callOpts := ResolveCallOptions(r.opts, request, opts...)
 
 	next, err := r.next(request, callOpts)
 	if err != nil {
 		return err
 	}
 
-	// check if we already have a deadline
-	d, ok := ctx.Deadline()
-	if !ok {
-		// no deadline so we create a new one
+	// The request budget and caller deadline both apply; the earlier wins.
+	if callOpts.RequestTimeout > 0 {
 		var cancel context.CancelFunc
 		ctx, cancel = context.WithTimeout(ctx, callOpts.RequestTimeout)
-
 		defer cancel()
-	} else {
-		// got a deadline so no need to setup context
-		// but we need to set the timeout we pass along
-		opt := WithRequestTimeout(time.Until(d))
-		opt(&callOpts)
+	}
+	if deadline, ok := ctx.Deadline(); ok {
+		callOpts.RequestTimeout = time.Until(deadline)
 	}
 
 	// should we noop right here?
@@ -495,14 +483,7 @@ func (r *rpcClient) Call(ctx context.Context, request Request, response interfac
 		service := request.Service()
 
 		if err != nil {
-			if errors.Is(err, selector.ErrNotFound) {
-				return merrors.InternalServerError("go.micro.client", "service %s: %s", service, err.Error())
-			}
-
-			return merrors.InternalServerError("go.micro.client",
-				"error getting next %s node: %s",
-				service,
-				err.Error())
+			return NewDiscoveryError(service, err)
 		}
 
 		// make the call
@@ -562,10 +543,7 @@ func (r *rpcClient) Stream(ctx context.Context, request Request, opts ...CallOpt
 	defer r.mu.RUnlock()
 
 	// make a copy of call opts
-	callOpts := r.opts.CallOptions
-	for _, opt := range opts {
-		opt(&callOpts)
-	}
+	callOpts := ResolveCallOptions(r.opts, request, opts...)
 
 	next, err := r.next(request, callOpts)
 	if err != nil {
@@ -594,14 +572,7 @@ func (r *rpcClient) Stream(ctx context.Context, request Request, opts ...CallOpt
 		service := request.Service()
 
 		if err != nil {
-			if errors.Is(err, selector.ErrNotFound) {
-				return nil, merrors.InternalServerError("go.micro.client", "service %s: %s", service, err.Error())
-			}
-
-			return nil, merrors.InternalServerError("go.micro.client",
-				"error getting next %s node: %s",
-				service,
-				err.Error())
+			return nil, NewDiscoveryError(service, err)
 		}
 
 		stream, err := r.stream(ctx, node, request, callOpts)
```

**File**: `cmd/cmd.go` (modified, +14/-1)
```diff
@@ -57,7 +57,12 @@ var (
 		&cli.StringFlag{
 			Name:    "client_request_timeout",
 			EnvVars: []string{"MICRO_CLIENT_REQUEST_TIMEOUT"},
-			Usage:   "Sets the client request timeout. e.g 500ms, 5s, 1m. Default: 5s",
+			Usage:   "Sets the client request timeout. e.g 500ms, 5s, 1m. Default: 30s",
+		},
+		&cli.StringFlag{
+			Name:    "client_connection_timeout",
+			EnvVars: []string{"MICRO_CLIENT_CONNECTION_TIMEOUT"},
+			Usage:   "Sets the client connection/request-attempt timeout. Default: 5s",
 		},
 		&cli.IntFlag{
 			Name:    "client_retries",
@@ -635,6 +640,14 @@ func (c *cmd) Before(ctx *cli.Context) error {
 		clientOpts = append(clientOpts, client.RequestTimeout(d))
 	}
 
+	if value := ctx.String("client_connection_timeout"); value != "" {
+		duration, err := time.ParseDuration(value)
+		if err != nil {
+			return fmt.Errorf("failed to parse client_connection_timeout: %w", err)
+		}
+		clientOpts = append(clientOpts, client.ConnectionTimeout(duration))
+	}
+
 	if r := ctx.Int("client_pool_size"); r > 0 {
 		clientOpts = append(clientOpts, client.PoolSize(r))
 	}
```

**File**: `internal/website/content/en/docs/client-server.md` (modified, +31/-0)
```diff
@@ -67,3 +67,34 @@ cap. Cancellation returns promptly even if a registry backend ignores context;
 its one in-flight attempt may finish later. `errors.Is` can identify the context
 cancellation/deadline and the last completed failure. This helper does not alter
 service readiness endpoints or start a background dependency monitor.
+## Discovery failures and endpoint budgets
+
+Missing services now return a structured 404. Unavailable discovery backends
+and empty usable-node sets return 503. In-process callers can inspect
+`*client.DiscoveryError`, use `errors.Is(err, registry.ErrNotFound)` or
+`errors.Is(err, client.ErrNoNodes)`, and inspect the wrapped backend cause. NATS
+connection failures also match `registry.ErrUnavailable`. Across RPC boundaries,
+use the structured status code; backend Go error identities are local.
+
+Configure a slow endpoint once when constructing a client:
+
+```go
+c := client.NewClient(client.EndpointOptions(map[string][]client.CallOption{
+    "assistant/Agent.Chat": {
+        client.WithRequestTimeout(2*time.Minute),
+        client.WithConnectionTimeout(2*time.Minute),
+    },
+}))
+```
+
+Keys are `service/endpoint`. Endpoint options override client defaults, and
+explicit per-call options override endpoint settings. This works for the default
+RPC and native gRPC clients, including generated clients that wrap them. Caller
+deadlines still apply: the earlier deadline wins.
+
+The current defaults are a 30-second total request budget and a 5-second
+connection/request-attempt budget. Streaming has a separate `WithStreamTimeout`.
+Applications using `service.Init()` can configure the existing command/env
+settings `MICRO_CLIENT_REQUEST_TIMEOUT` and `MICRO_CLIENT_CONNECTION_TIMEOUT`
+with Go duration strings such as `2m`. Library-only clients can use
+`client.RequestTimeout`, `client.ConnectionTimeout`, or endpoint options directly.
```

---

### Incident Patch 10: `5f29b487` (2026-09-21)
**Commit Message**: fix(model): preserve Groq/OpenAI options and follow-up errors (#4953)

* fix(model): preserve chat request options and tool follow-up errors

* docs: update Groq default and OpenAI endpoint examples

**File**: `README.md` (modified, +1/-1)
```diff
@@ -386,7 +386,7 @@ Swap providers with a single import — same interface everywhere:
 | Anthropic | `claude-sonnet-4-20250514` |
 | OpenAI | `gpt-4o` |
 | Google Gemini | `gemini-2.5-flash` |
-| Groq | `llama-3.3-70b-versatile` |
+| Groq | `openai/gpt-oss-120b` |
 | Mistral | `mistral-large-latest` |
 | Together AI | `meta-llama/Llama-3.3-70B-Instruct-Turbo` |
 | Atlas Cloud | `deepseek-ai/DeepSeek-V3-0324` |
```

**File**: `model/README.md` (modified, +3/-3)
```diff
@@ -228,7 +228,7 @@ m := model.New("openai",
 ```
 
 Default model: `gpt-4o`
-Default base URL: `https://api.openmodel.com`
+Default base URL: `https://api.openai.com`
 
 ### Google Gemini
 
@@ -249,11 +249,11 @@ Google Gemini uses its own API format with `system_instruction`, `contents` (not
 ```go
 m := model.New("groq",
     model.WithAPIKey("your-key"),
-    model.WithModel("llama-3.3-70b-versatile"), // default
+    model.WithModel("openai/gpt-oss-120b"), // default
 )
 ```
 
-Default model: `llama-3.3-70b-versatile`
+Default model: `openai/gpt-oss-120b`
 Default base URL: `https://api.groq.com/openai`
 
 Groq provides ultra-fast inference for open-weight models via an OpenAI-compatible endpoint.
```

**File**: `model/groq/groq.go` (modified, +6/-36)
```diff
@@ -40,7 +40,7 @@ type Provider struct {
 func NewProvider(opts ...model.Option) *Provider {
 	options := model.NewOptions(opts...)
 	if options.Model == "" {
-		options.Model = "llama-3.3-70b-versatile"
+		options.Model = "openai/gpt-oss-120b"
 	}
 	if options.BaseURL == "" {
 		options.BaseURL = "https://api.groq.com/openai"
@@ -59,33 +59,8 @@ func (p *Provider) Options() model.Options { return p.opts }
 func (p *Provider) String() string         { return "groq" }
 
 func (p *Provider) Generate(ctx context.Context, req *model.Request, opts ...model.GenerateOption) (*model.Response, error) {
-	var tools []map[string]any
-	for _, t := range req.Tools {
-		tools = append(tools, map[string]any{
-			"type": "function",
-			"function": map[string]any{
-				"name":        t.Name,
-				"description": t.Description,
-				"parameters": map[string]any{
-					"type":       "object",
-					"properties": t.Properties,
-				},
-			},
-		})
-	}
-
-	messages := []map[string]any{
-		{"role": "system", "content": req.SystemPrompt},
-		{"role": "user", "content": req.Prompt},
-	}
-
-	apiReq := map[string]any{
-		"model":    p.opts.Model,
-		"messages": messages,
-	}
-	if len(tools) > 0 {
-		apiReq["tools"] = tools
-	}
+	messages := openaiapi.Messages(req)
+	apiReq := openaiapi.Request(p.opts, messages, req.Tools)
 
 	resp, rawMessage, err := p.callAPI(ctx, apiReq)
 	if err != nil {
@@ -122,17 +97,11 @@ func (p *Provider) Generate(ctx context.Context, req *model.Request, opts ...mod
 				})
 			}
 
-			followUpReq := map[string]any{
-				"model":    p.opts.Model,
-				"messages": followUpMessages,
-			}
-			if len(tools) > 0 {
-				followUpReq["tools"] = tools
-			}
+			followUpReq := openaiapi.Request(p.opts, followUpMessages, req.Tools)
 
 			followUpResp, followUpRaw, err := p.callAPI(ctx, followUpReq)
 			if err != nil {
-				break
+				return nil, fmt.Errorf("tool follow-up: %w", err)
 			}
 			if followUpResp.Reply != "" {
 				resp.Answer = followUpResp.Reply
@@ -187,6 +156,7 @@ func (p *Provider) callAPI(ctx context.Context, req map[string]any) (*model.Resp
 				Content   string `json:"content"`
 				ToolCalls []struct {
 					ID       string `json:"id"`
+					Type     string `json:"type"`
 					Function struct {
 						Name      string `json:"name"`
 						Arguments string `json:"arguments"`
```

**File**: `model/groq/groq_test.go` (modified, +1/-1)
```diff
@@ -20,7 +20,7 @@ func TestProvider_String(t *testing.T) {
 
 func TestProvider_Defaults(t *testing.T) {
 	opts := NewProvider().Options()
-	if opts.Model != "llama-3.3-70b-versatile" {
+	if opts.Model != "openai/gpt-oss-120b" {
 		t.Errorf("default model = %q", opts.Model)
 	}
 	if opts.BaseURL != "https://api.groq.com/openai" {
```

**File**: `model/internal/openaiapi/request.go` (added, +35/-0)
```diff
@@ -0,0 +1,35 @@
+package openaiapi
+
+import "go-micro.dev/v6/model"
+
+// Messages builds the shared chat history for Generate and Stream requests.
+func Messages(req *model.Request) []map[string]any {
+	messages := []map[string]any{{"role": "system", "content": req.SystemPrompt}}
+	for _, message := range req.Messages {
+		messages = append(messages, map[string]any{"role": message.Role, "content": message.Content})
+	}
+	if req.Prompt != "" {
+		messages = append(messages, map[string]any{"role": "user", "content": req.Prompt})
+	}
+	return messages
+}
+
+// Request preserves provider options on initial and follow-up chat requests.
+// Pass nil tools for text-only streams, which do not execute tool calls.
+func Request(opts model.Options, messages []map[string]any, tools []model.Tool) map[string]any {
+	request := map[string]any{"model": opts.Model, "messages": messages}
+	if opts.MaxTokens > 0 {
+		request["max_tokens"] = opts.MaxTokens
+	}
+	if opts.Effort != "" {
+		request["reasoning_effort"] = opts.Effort
+	}
+	if len(tools) > 0 {
+		definitions := make([]map[string]any, 0, len(tools))
+		for _, tool := range tools {
+			definitions = append(definitions, map[string]any{"type": "function", "function": map[string]any{"name": tool.Name, "description": tool.Description, "parameters": map[string]any{"type": "object", "properties": tool.Properties}}})
+		}
+		request["tools"] = definitions
+	}
+	return request
+}
```

**File**: `model/internal/openaiapi/request_integration_test.go` (added, +118/-0)
```diff
@@ -0,0 +1,118 @@
+package openaiapi_test
+
+import (
+	"context"
+	"encoding/json"
+	"errors"
+	"fmt"
+	"io"
+	"net/http"
+	"net/http/httptest"
+	"testing"
+
+	"go-micro.dev/v6/model"
+	"go-micro.dev/v6/model/groq"
+	"go-micro.dev/v6/model/openai"
+)
+
+func TestChatRequestParity(t *testing.T) {
+	for name, factory := range map[string]func(...model.Option) model.Model{"groq": func(opts ...model.Option) model.Model { return groq.NewProvider(opts...) }, "openai": func(opts ...model.Option) model.Model { return openai.NewProvider(opts...) }} {
+		for _, mode := range []string{"generate", "followup_error", "stream"} {
+			t.Run(name+"/"+mode, func(t *testing.T) {
+				requests, calls := 0, 0
+				ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
+					requests++
+					var body map[string]any
+					if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
+						t.Error(err)
+						return
+					}
+					if body["max_tokens"] != float64(1024) || body["reasoning_effort"] != "high" || body["model"] != "test" {
+						t.Errorf("lost options: %v", body)
+					}
+					messages := body["messages"].([]any)
+					for i, want := range []string{"system", "earlier question", "earlier answer", "next question"} {
+						if len(messages) <= i || messages[i].(map[string]any)["content"] != want {
+							t.Errorf("lost history: %v", messages)
+							return
+						}
+					}
+					if mode == "stream" {
+						if body["stream"] != true {
+							t.Error("stream flag missing")
+						}
+						w.Header().Set("Content-Type", "text/event-stream")
+						fmt.Fprint(w, "data: {\"choices\":[{\"delta\":{\"content\":\"done\"},\"finish_reason\":\"stop\"}]}\n\ndata: [DONE]\n\n")
+						return
+					}
+					if len(body["tools"].([]any)) != 1 {
+						t.Error("tools missing")
+					}
+					if requests == 1 {
+						fmt.Fprint(w, `{"choices":[{"message":{"content":"","tool_calls":[{"id":"call1","type":"function","function":{"name":"lookup","arguments":"{}"}}]}}]}`)
+						return
+					}
+					if len(messages) != 6 {
+						t.Errorf("messages: %v", messages)
+						return
+					}
+					assistant := messages[4].(map[string]any)
+					call := assistant["tool_calls"].([]any)[0].(map[string]any)
+					if call["type"] != "function" {
+						t.Errorf("lost tool type: %v", call)
+					}
+					tool := messages[5].(map[string]any)
+					if tool["tool_call_id"] != "call1" || tool["content"] != "result" {
+						t.Errorf("lost result: %v", tool)
+					}
+					if mode == "followup_error" {
+						w.WriteHeader(http.StatusTooManyRequests)
+						fmt.Fprint(w, `{"error":{"message":"slow down"}}`)
+						return
+					}
+					fmt.Fprint(w, `{"choices":[{"message":{"content":"done"}}]}`)
+				}))
+				defer ts.Close()
+				p := factory(model.WithBaseURL(ts.URL), model.WithAPIKey("test"), model.WithModel("test"), model.WithMaxTokens(1024), model.WithEffort("high"), model.WithToolHandler(func(_ context.Context, c model.ToolCall) model.ToolResult {
+					calls++
+					return model.ToolResult{ID: c.ID, Content: "result"}
+				}))
+				req := &model.Request{SystemPrompt: "system", Prompt: "next question", Messages: []model.Message{{Role: "user", Content: "earlier question"}, {Role: "assistant", Content: "earlier answer"}}, Tools: []model.Tool{{Name: "lookup", Properties: map[string]any{}}}}
+				if mode == "stream" {
+					s, err := p.Stream(context.Background(), req)
+					if err != nil {
+						t.Fatal(err)
+					}
+					defer s.Close()
+					var answer string
+					for {
+						chunk, err := s.Recv()
+						if err == io.EOF {
+							break
+						}
+						if err != nil {
+							t.Fatal(err)
+						}
+						answer += chunk.Reply
+					}
+					if answer != "done" || requests != 1 {
+						t.Fatalf("answer=%q requests=%d", answer, requests)
+					}
+					return
+				}
+				response, err := p.Generate(context.Background(), req)
+				if mode == "followup_error" {
+					var status interface{ StatusCode() int }
+					if !errors.As(err, &status) || status.StatusCode() != 429 {
+						t.Fatalf("lost provider error: %v", err)
+					}
+				} else if err != nil || response.Answer != "done" {
+					t.Fatalf("response=%+v err=%v", response, err)
+				}
+				if requests != 2 || calls != 1 {
+					t.Fatalf("requests=%d calls=%d", requests, calls)
+				}
+			})
+		}
+	}
+}
```

**File**: `model/internal/openaiapi/stream.go` (modified, +3/-19)
```diff
@@ -15,25 +15,9 @@ import (
 
 // Stream opens an OpenAI-compatible chat completions SSE stream.
 func Stream(ctx context.Context, opts model.Options, req *model.Request, basePath string) (model.Stream, error) {
-	messages := []map[string]any{{"role": "system", "content": req.SystemPrompt}}
-	for _, m := range req.Messages {
-		messages = append(messages, map[string]any{"role": m.Role, "content": m.Content})
-	}
-	if req.Prompt != "" {
-		messages = append(messages, map[string]any{"role": "user", "content": req.Prompt})
-	}
-	apiReq := map[string]any{
-		"model":          opts.Model,
-		"messages":       messages,
-		"stream":         true,
-		"stream_options": map[string]any{"include_usage": true},
-	}
-	if opts.MaxTokens > 0 {
-		apiReq["max_tokens"] = opts.MaxTokens
-	}
-	if opts.Effort != "" {
-		apiReq["reasoning_effort"] = opts.Effort
-	}
+	apiReq := Request(opts, Messages(req), nil)
+	apiReq["stream"] = true
+	apiReq["stream_options"] = map[string]any{"include_usage": true}
 	reqBody, err := json.Marshal(apiReq)
 	if err != nil {
 		return nil, fmt.Errorf("failed to marshal stream request: %w", err)
```

**File**: `model/openai/openai.go` (modified, +10/-79)
```diff
@@ -12,6 +12,7 @@ import (
 	"strings"
 
 	"go-micro.dev/v6/model"
+	"go-micro.dev/v6/model/internal/openaiapi"
 )
 
 func init() {
@@ -39,7 +40,7 @@ func NewProvider(opts ...model.Option) *Provider {
 		options.Model = "gpt-4o"
 	}
 	if options.BaseURL == "" {
-		options.BaseURL = "https://api.openmodel.com"
+		options.BaseURL = "https://api.openai.com"
 	}
 
 	return &Provider{
@@ -67,50 +68,9 @@ func (p *Provider) String() string {
 
 // Generate generates a response from the model
 func (p *Provider) Generate(ctx context.Context, req *model.Request, opts ...model.GenerateOption) (*model.Response, error) {
-	// Build tools for OpenAI format
-	var openaiTools []map[string]any
-	for _, t := range req.Tools {
-		openaiTools = append(openaiTools, map[string]any{
-			"type": "function",
-			"function": map[string]any{
-				"name":        t.Name,
-				"description": t.Description,
-				"parameters": map[string]any{
-					"type":       "object",
-					"properties": t.Properties,
-				},
-			},
-		})
-	}
-
-	// Build messages
-	messages := []map[string]any{
-		{"role": "system", "content": req.SystemPrompt},
-	}
-	for _, m := range req.Messages {
-		messages = append(messages, map[string]any{"role": m.Role, "content": m.Content})
-	}
-	if req.Prompt != "" {
-		messages = append(messages, map[string]any{"role": "user", "content": req.Prompt})
-	}
-
-	// Build initial request
-	apiReq := map[string]any{
-		"model":    p.opts.Model,
-		"messages": messages,
-	}
-	if p.opts.MaxTokens > 0 {
-		apiReq["max_tokens"] = p.opts.MaxTokens
-	}
-	if p.opts.Effort != "" {
-		apiReq["reasoning_effort"] = p.opts.Effort
-	}
-
-	if len(openaiTools) > 0 {
-		apiReq["tools"] = openaiTools
-	}
+	messages := openaiapi.Messages(req)
+	apiReq := openaiapi.Request(p.opts, messages, req.Tools)
 
-	// Make API call
 	resp, rawMessage, err := p.callAPI(ctx, apiReq)
 	if err != nil {
 		return nil, err
@@ -148,23 +108,11 @@ func (p *Provider) Generate(ctx context.Context, req *model.Request, opts ...mod
 				})
 			}
 
-			followUpReq := map[string]any{
-				"model":    p.opts.Model,
-				"messages": followUpMessages,
-			}
-			if p.opts.MaxTokens > 0 {
-				followUpReq["max_tokens"] = p.opts.MaxTokens
-			}
-			if p.opts.Effort != "" {
-				followUpReq["reasoning_effort"] = p.opts.Effort
-			}
-			if len(openaiTools) > 0 {
-				followUpReq["tools"] = openaiTools
-			}
+			followUpReq := openaiapi.Request(p.opts, followUpMessages, req.Tools)
 
 			followUpResp, followUpRaw, err := p.callAPI(ctx, followUpReq)
 			if err != nil {
-				break
+				return nil, fmt.Errorf("tool follow-up: %w", err)
 			}
 			if followUpResp.Reply != "" {
 				resp.Answer = followUpResp.Reply
@@ -185,27 +133,9 @@ const maxToolRounds = 12
 
 // Stream generates a streaming response from the OpenAI chat completions API.
 func (p *Provider) Stream(ctx context.Context, req *model.Request, opts ...model.GenerateOption) (model.Stream, error) {
-	messages := []map[string]any{
-		{"role": "system", "content": req.SystemPrompt},
-	}
-	for _, m := range req.Messages {
-		messages = append(messages, map[string]any{"role": m.Role, "content": m.Content})
-	}
-	if req.Prompt != "" {
-		messages = append(messages, map[string]any{"role": "user", "content": req.Prompt})
-	}
-	apiReq := map[string]any{
-		"model":          p.opts.Model,
-		"messages":       messages,
-		"stream":         true,
-		"stream_options": map[string]any{"include_usage": true},
-	}
-	if p.opts.MaxTokens > 0 {
-		apiReq["max_tokens"] = p.opts.MaxTokens
-	}
-	if p.opts.Effort != "" {
-		apiReq["reasoning_effort"] = p.opts.Effort
-	}
+	apiReq := openaiapi.Request(p.opts, openaiapi.Messages(req), nil)
+	apiReq["stream"] = true
+	apiReq["stream_options"] = map[string]any{"include_usage": true}
 	reqBody, err := json.Marshal(apiReq)
 	if err != nil {
 		return nil, fmt.Errorf("failed to marshal stream request: %w", err)
@@ -336,6 +266,7 @@ func (p *Provider) callAPI(ctx context.Context, req map[string]any) (*model.Resp
 				Content   string `json:"content"`
 				ToolCalls []struct {
 					ID       string `json:"id"`
+					Type     string `json:"type"`
 					Function struct {
 						Name      string `json:"name"`
 						Arguments string `json:"arguments"`
```

---

### Incident Patch 11: `a3f567bf` (2026-09-21)
**Commit Message**: fix(agent): recover timeout and rate-limited runs (#4952)

* fix(agent): resume timeout and rate-limited runs from checkpoints

* docs: align pending run contract with transient recovery

**File**: `agent/checkpoint.go` (modified, +3/-2)
```diff
@@ -90,7 +90,8 @@ func (a *agentImpl) ResumeInput(ctx context.Context, runID, input string) (*Resp
 
 // Resume returns the response for a checkpointed agent run. Completed runs are
 // returned from the checkpoint without calling the model or replaying tool
-// calls; failed or in-progress runs continue from the saved input message.
+// calls; failed, interrupted (timeout/rate_limited), or in-progress runs
+// continue from the saved input message and reuse completed tool results.
 func Resume(ctx context.Context, ag Agent, runID string) (*Response, error) {
 	a, ok := ag.(Resumer)
 	if !ok {
@@ -201,7 +202,7 @@ func (a *agentImpl) pending(ctx context.Context) ([]flow.Run, error) {
 
 func terminalAgentRunStatus(status string) bool {
 	switch status {
-	case "done", "canceled", "timeout", "rate_limited", "expired":
+	case "done", "canceled", "expired":
 		return true
 	default:
 		return false
```

**File**: `agent/resilience_test.go` (modified, +7/-3)
```diff
@@ -289,7 +289,7 @@ func TestSlowProviderTimeoutPreventsLateToolSideEffects(t *testing.T) {
 	}
 }
 
-func TestAskCheckpointRecordsTerminalOperationalFailureStatus(t *testing.T) {
+func TestAskCheckpointRecordsOperationalFailureStatus(t *testing.T) {
 	tests := []struct {
 		name string
 		err  error
@@ -333,8 +333,12 @@ func TestAskCheckpointRecordsTerminalOperationalFailureStatus(t *testing.T) {
 			if got := runs[0].Steps[0].ErrorKind; got != string(model.ClassifyError(tt.err)) {
 				t.Fatalf("step error kind = %q, want %q", got, model.ClassifyError(tt.err))
 			}
-			if pending, err := Pending(context.Background(), a); err != nil || len(pending) != 0 {
-				t.Fatalf("Pending = %#v, %v; want no terminal run", pending, err)
+			wantPending := 1
+			if tt.want == "canceled" {
+				wantPending = 0
+			}
+			if pending, err := Pending(context.Background(), a); err != nil || len(pending) != wantPending {
+				t.Fatalf("Pending = %#v, %v; want %d runs", pending, err, wantPending)
 			}
 		})
 	}
```

**File**: `agent/run_errors_test.go` (modified, +1/-1)
```diff
@@ -15,7 +15,7 @@ func TestTypedRunErrors(t *testing.T) {
 	ctx := context.Background()
 	cp := flow.StoreCheckpoint(store.NewMemoryStore(), "typed-errors")
 	a := newTestAgent(Name("typed-errors"), WithCheckpoint(cp))
-	for _, status := range []string{"timeout", "canceled", "rate_limited", "expired"} {
+	for _, status := range []string{"canceled", "expired"} {
 		if err := cp.Save(ctx, flow.Run{ID: status, Status: status}); err != nil {
 			t.Fatal(err)
 		}
```

**File**: `agent/transient_resume_test.go` (added, +110/-0)
```diff
@@ -0,0 +1,110 @@
+package agent
+
+import (
+	"context"
+	"encoding/json"
+	"io"
+	"testing"
+
+	"go-micro.dev/v6/flow"
+	"go-micro.dev/v6/model"
+	"go-micro.dev/v6/store"
+)
+
+func TestResumeTransientFailureAfterRestart(t *testing.T) {
+	for _, failure := range []struct {
+		name string
+		err  error
+	}{
+		{"timeout", context.DeadlineExceeded}, {"rate_limited", testStatusError{code: 429}},
+	} {
+		for _, mode := range []string{"resume", "stream", "pending"} {
+			t.Run(failure.name+"/"+mode, func(t *testing.T) {
+				ctx := context.Background()
+				st := store.NewMemoryStore()
+				cp := flow.StoreCheckpoint(st, "recovery")
+				modelCalls, toolCalls := 0, 0
+				fakeGen = func(ctx context.Context, opts model.Options, req *model.Request) (*model.Response, error) {
+					modelCalls++
+					if req.Prompt != "charge once" {
+						t.Fatalf("lost original request: %q", req.Prompt)
+					}
+					result := opts.ToolHandler(ctx, model.ToolCall{ID: "charge", Name: "charge", Input: map[string]any{"order": "42"}})
+					if result.Content != "paid" {
+						t.Fatalf("lost tool result: %+v", result)
+					}
+					if modelCalls == 1 {
+						return nil, failure.err
+					}
+					return &model.Response{Reply: "recovered"}, nil
+				}
+				defer func() { fakeGen = nil }()
+				makeAgent := func() *agentImpl {
+					return newTestAgent(Name("recovery"), WithStore(st), WithCheckpoint(cp), WithTool("charge", "charge", nil, func(context.Context, map[string]any) (string, error) { toolCalls++; return "paid", nil }))
+				}
+				original := makeAgent()
+				if _, err := original.Ask(ctx, "charge once"); err == nil {
+					t.Fatal("expected provider failure")
+				}
+				runs, err := Pending(ctx, original)
+				if err != nil || len(runs) != 1 || runs[0].Status != failure.name {
+					t.Fatalf("pending: %+v %v", runs, err)
+				}
+				id := runs[0].ID
+				restarted := makeAgent()
+				var response *Response
+				switch mode {
+				case "resume":
+					response, err = Resume(ctx, restarted, id)
+				case "pending":
+					var failedID string
+					failedID, err = ResumePending(ctx, restarted)
+					if failedID != "" {
+						t.Fatalf("failed run: %s", failedID)
+					}
+					if err == nil {
+						run, _, loadErr := cp.Load(ctx, id)
+						if loadErr != nil {
+							t.Fatal(loadErr)
+						}
+						response = new(Response)
+						err = json.Unmarshal(run.State.Data, response)
+					}
+				case "stream":
+					var stream AgentStream
+					stream, err = ResumeStreamAsk(ctx, restarted, id)
+					if err != nil {
+						t.Fatal(err)
+					}
+					defer stream.Close()
+					for {
+						event, recvErr := stream.Recv()
+						if recvErr == io.EOF {
+							break
+						}
+						if recvErr != nil {
+							err = recvErr
+							break
+						}
+						if event.Type == StreamEventDone {
+							response = event.Response
+						}
+					}
+				}
+				if err != nil {
+					t.Fatal(err)
+				}
+				if response == nil || response.RunID != id || response.Reply != "recovered" {
+					t.Fatalf("response: %+v", response)
+				}
+				if toolCalls != 1 || modelCalls != 2 {
+					t.Fatalf("tool calls=%d, model calls=%d", toolCalls, modelCalls)
+				}
+				run, ok, err := cp.Load(ctx, id)
+				if err != nil || !ok || run.Status != "done" {
+					t.Fatalf("final checkpoint: %+v %v", run, err)
+				}
+			})
+		}
+	}
+}
```

**File**: `internal/website/content/en/docs/guides/debugging-agents.md` (modified, +23/-0)
```diff
@@ -263,3 +263,26 @@ micro call <service> <Handler.Method> '{}'
 
 Redact secrets and user data. If you enabled `agent.TraceInputs(true)`, inspect the
 JSON before sharing it because prompts may be present.
+
+### Recovering interrupted runs
+
+With `agent.WithCheckpoint(...)`, provider `timeout` and `rate_limited` outcomes
+remain discoverable through `agent.Pending` and can be continued with
+`agent.Resume(ctx, ag, runID)`, `agent.ResumeStreamAsk`, or `agent.ResumePending`.
+Use a fresh context after a deadline and wait for the provider's rate-limit
+window before retrying. Recovery keeps the run ID and saved request and reuses
+completed tool results, including after recreating the agent with the same
+checkpoint store. Canceled and expired runs remain terminal. An interrupted
+side effect without a saved result can still be retried: use idempotency keys
+for such tools; checkpointing is not an exactly-once guarantee.
+
+The defaults remain 30 seconds per model call and 30 seconds per tool call.
+For slower models or multi-tool turns, configure the budgets explicitly:
+
+```go
+agent.ModelCallTimeout(120 * time.Second)
+agent.ToolCallTimeout(60 * time.Second)
+```
+
+The caller's context and RPC request deadline must also allow the whole turn to
+finish. Increasing a per-call timeout cannot extend an earlier caller deadline.
```

**File**: `internal/website/content/en/docs/guides/durability.md` (modified, +4/-3)
```diff
@@ -72,9 +72,10 @@ one run therefore share a completed result. This is not a cross-run idempotency
 key and does not guarantee that a model will choose the same arguments after a
 restart.
 
-Agent pending runs exclude terminal `done`, `canceled`, `timeout`,
-`rate_limited`, and `expired` statuses. Paused runs can still appear in pending
-results; an input-required pause needs the input helper, so an unattended
+Agent pending runs exclude terminal `done`, `canceled`, and `expired` statuses.
+Interrupted `timeout` and `rate_limited` runs remain pending and can resume with
+a fresh context, reusing saved input and completed tool results. Paused runs can
+still appear in pending results; an input-required pause needs the input helper, so an unattended
 `ResumePending` loop can stop there.
 
 ## What is not guaranteed
```

---

### Incident Patch 12: `f9396033` (2026-09-21)
**Commit Message**: fix(natsjs): prevent durable consumers from skipping history (#4943)

* fix(natsjs): make durable consumption safe by default

* fix(natsjs): preserve existing durable delivery policy (#4946)

Co-authored-by: Codex <[REDACTED_EMAIL]>

---------

Co-authored-by: Codex <[REDACTED_EMAIL]>

**File**: `events/natsjs/README.md` (modified, +7/-0)
```diff
@@ -13,6 +13,13 @@ ev, err := natsjs.NewStream(
 
 ## Consume a stream
 
+Durable streams require an explicit consumer group. A newly created durable
+consumer starts at the beginning of the stream and resumes from its persisted
+position on later connections. Use `events.WithOffset` to choose a different
+starting time when the durable consumer is first created. When durable streams
+are disabled, consumers are ephemeral and receive only newly published events
+by default.
+
 ```go
 ee, err := events.Consume("test",
   events.WithAutoAck(false, time.Second*30),
```

**File**: `events/natsjs/nats.go` (modified, +36/-13)
```diff
@@ -163,13 +163,16 @@ func (s *stream) Consume(topic string, opts ...events.ConsumeOption) (<-chan eve
 	log := s.opts.Logger
 
 	// parse the options
-	options := events.ConsumeOptions{
-		Group:   uuid.New().String(),
-		AutoAck: true,
-	}
+	options := events.ConsumeOptions{AutoAck: true}
 	for _, o := range opts {
 		o(&options)
 	}
+	if !s.opts.DisableDurableStreams && options.Group == "" {
+		return nil, fmt.Errorf("consumer group is required when durable streams are enabled")
+	}
+	if s.opts.DisableDurableStreams && options.Group == "" {
+		options.Group = uuid.New().String()
+	}
 
 	// setup the subscriber
 	channel := make(chan events.Event)
@@ -229,16 +232,32 @@ func (s *stream) Consume(topic string, opts ...events.ConsumeOption) (<-chan eve
 		subOpts = append(subOpts, nats.MaxDeliver(options.GetRetryLimit()))
 	}
 
-	if options.AutoAck {
-		subOpts = append(subOpts, nats.AckAll())
-	} else {
-		subOpts = append(subOpts, nats.AckExplicit())
+	consumerExists := false
+	if !s.opts.DisableDurableStreams {
+		_, err = s.natsJetStreamCtx.ConsumerInfo(topic, options.Group)
+		switch {
+		case err == nil:
+			consumerExists = true
+		case errors.Is(err, nats.ErrConsumerNotFound):
+			// The delivery policy below is used only when creating the durable.
+		default:
+			return nil, errors.Wrap(err, "Error checking durable consumer")
+		}
 	}
 
-	if !options.Offset.IsZero() {
-		subOpts = append(subOpts, nats.StartTime(options.Offset))
-	} else {
-		subOpts = append(subOpts, nats.DeliverNew())
+	// Delivery policies are immutable, so do not specify one when binding to an
+	// existing durable. This also keeps consumers created by older versions with
+	// DeliverNew compatible after upgrading.
+	if !consumerExists {
+		// Ack each event independently. Existing durables retain their policy.
+		subOpts = append(subOpts, nats.AckExplicit())
+		if !options.Offset.IsZero() {
+			subOpts = append(subOpts, nats.StartTime(options.Offset))
+		} else if !s.opts.DisableDurableStreams {
+			subOpts = append(subOpts, nats.DeliverAll())
+		} else {
+			subOpts = append(subOpts, nats.DeliverNew())
+		}
 	}
 
 	if options.AckWait > 0 {
@@ -247,7 +266,11 @@ func (s *stream) Consume(topic string, opts ...events.ConsumeOption) (<-chan eve
 
 	// connect the subscriber via a queue group only if durable streams are enabled
 	if !s.opts.DisableDurableStreams {
-		subOpts = append(subOpts, nats.Durable(options.Group))
+		if consumerExists {
+			subOpts = append(subOpts, nats.Bind(topic, options.Group))
+		} else {
+			subOpts = append(subOpts, nats.Durable(options.Group))
+		}
 		_, err = s.natsJetStreamCtx.QueueSubscribe(topic, options.Group, handleMsg, subOpts...)
 	} else {
 		subOpts = append(subOpts, nats.ConsumerName(options.Group))
```

**File**: `events/natsjs/nats_test.go` (modified, +125/-1)
```diff
@@ -9,6 +9,7 @@ import (
 	"time"
 
 	nserver "github.com/nats-io/nats-server/v2/server"
+	nats "github.com/nats-io/nats.go"
 	"github.com/stretchr/testify/assert"
 	"github.com/test-go/testify/require"
 	"go-micro.dev/v6/events"
@@ -64,7 +65,7 @@ func TestSingleEvent(t *testing.T) {
 		t.Helper()
 		defer cancel()
 
-		foobarEvents, err := client.Consume(topic)
+		foobarEvents, err := client.Consume(topic, events.WithGroup("foobar-consumer"))
 		require.Nil(t, err)
 		if err != nil {
 			return
@@ -110,3 +111,126 @@ func TestSingleEvent(t *testing.T) {
 	// wait until consumer received the event
 	<-ctx.Done()
 }
+
+func TestConsumeRequiresGroupForDurableStreams(t *testing.T) {
+	ctx, cancel := context.WithCancel(context.Background())
+	defer cancel()
+
+	clusterName := "group-test-cluster"
+	natsAddr := getFreeLocalhostAddress()
+	natsPort, _ := strconv.Atoi(strings.Split(natsAddr, ":")[1])
+	go natsServer(ctx, t, &nserver.Options{
+		Host: strings.Split(natsAddr, ":")[0],
+		Port: natsPort,
+		Cluster: nserver.ClusterOpts{
+			Name: clusterName,
+		},
+	})
+	time.Sleep(time.Second)
+
+	client, err := natsjs.NewStream(natsjs.Address(natsAddr), natsjs.ClusterID(clusterName))
+	require.NoError(t, err)
+
+	_, err = client.Consume("requires-group")
+	require.EqualError(t, err, "consumer group is required when durable streams are enabled")
+}
+
+func TestNewDurableConsumerReceivesStreamHistory(t *testing.T) {
+	ctx, cancel := context.WithCancel(context.Background())
+	defer cancel()
+
+	clusterName := "history-test-cluster"
+	natsAddr := getFreeLocalhostAddress()
+	natsPort, _ := strconv.Atoi(strings.Split(natsAddr, ":")[1])
+	go natsServer(ctx, t, &nserver.Options{
+		Host: strings.Split(natsAddr, ":")[0],
+		Port: natsPort,
+		Cluster: nserver.ClusterOpts{
+			Name: clusterName,
+		},
+	})
+	time.Sleep(time.Second)
+
+	client, err := natsjs.NewStream(
+		natsjs.Address(natsAddr),
+		natsjs.ClusterID(clusterName),
+		natsjs.SynchronousPublish(true),
+	)
+	require.NoError(t, err)
+
+	// Establish the stream before publishing the event. The first consumer can
+	// receive it, but the limits retention policy keeps it available for replay.
+	_, err = client.Consume("history", events.WithGroup("stream-creator"))
+	require.NoError(t, err)
+	require.NoError(t, client.Publish("history", []byte("before-subscribe")))
+
+	history, err := client.Consume("history", events.WithGroup("history-reader"))
+	require.NoError(t, err)
+
+	select {
+	case event := <-history:
+		require.Equal(t, []byte("before-subscribe"), event.Payload)
+	case <-time.After(5 * time.Second):
+		t.Fatal("timed out waiting for historical event")
+	}
+}
+
+func TestExistingDeliverNewDurableCanReconnect(t *testing.T) {
+	for _, policy := range []nats.AckPolicy{nats.AckExplicitPolicy, nats.AckAllPolicy} {
+		t.Run(policy.String(), func(t *testing.T) { testExistingDurable(t, policy) })
+	}
+}
+
+func testExistingDurable(t *testing.T, policy nats.AckPolicy) {
+	ctx, cancel := context.WithCancel(context.Background())
+	defer cancel()
+
+	clusterName := "existing-durable-test-cluster"
+	natsAddr := getFreeLocalhostAddress()
+	natsPort, _ := strconv.Atoi(strings.Split(natsAddr, ":")[1])
+	go natsServer(ctx, t, &nserver.Options{
+		Host: strings.Split(natsAddr, ":")[0],
+		Port: natsPort,
+		Cluster: nserver.ClusterOpts{
+			Name: clusterName,
+		},
+	})
+	time.Sleep(time.Second)
+
+	conn, err := nats.Connect(natsAddr)
+	require.NoError(t, err)
+	defer conn.Close()
+	js, err := conn.JetStream()
+	require.NoError(t, err)
+	_, err = js.AddStream(&nats.StreamConfig{Name: "existing-durable"})
+	require.NoError(t, err)
+
+	// Simulate the durable configuration created by versions that defaulted to
+	// DeliverNew. It must remain usable after the new DeliverAll default.
+	_, err = js.AddConsumer("existing-durable", &nats.ConsumerConfig{
+		Durable:        "existing-reader",
+		DeliverSubject: nats.NewInbox(),
+		DeliverGroup:   "existing-reader",
+		DeliverPolicy:  nats.DeliverNewPolicy,
+		AckPolicy:      policy,
+	})
+	require.NoError(t, err)
+
+	client, err := natsjs.NewStream(
+		natsjs.Address(natsAddr),
+		natsjs.ClusterID(clusterName),
+		natsjs.SynchronousPublish(true),
+	)
+	require.NoError(t, err)
+
+	eventsChannel, err := client.Consume("existing-durable", events.WithGroup("existing-reader"))
+	require.NoError(t, err)
+	require.NoError(t, client.Publish("existing-durable", []byte("after-reconnect")))
+
+	select {
+	case event := <-eventsChannel:
+		require.Equal(t, []byte("after-reconnect"), event.Payload)
+	case <-time.After(5 * time.Second):
+		t.Fatal("timed out waiting for event after reconnecting existing durable")
+	}
+}
```

---

### Incident Patch 13: `2de8880c` (2026-09-21)
**Commit Message**: fix(agent): keep delegated tools within the parent service scope (#4950)

* fix(agent): constrain delegated service visibility

* Preserve independent registered-agent delegation while scoping ephemeral tools

**File**: `agent/agent.go` (modified, +1/-1)
```diff
@@ -724,7 +724,7 @@ func (a *agentImpl) discoverTools() ([]model.Tool, error) {
 		if strings.HasPrefix(t.OriginalName, a.opts.Name+".") {
 			continue
 		}
-		if len(a.opts.Services) == 0 {
+		if a.opts.Services == nil {
 			scoped = append(scoped, t)
 			continue
 		}
```

**File**: `agent/builtin.go` (modified, +24/-4)
```diff
@@ -689,6 +689,22 @@ func (a *agentImpl) handleDelegate(ctx context.Context, call model.ToolCall) (re
 		return errResult(call.ID, "task is required")
 	}
 	to, _ := input["to"].(string)
+	// Services scopes local tool discovery. Registered and A2A agents have
+	// their own tool policy; preserve the existing remote delegation path.
+	remoteURL := strings.HasPrefix(to, "http://") || strings.HasPrefix(to, "https://")
+	registeredAgent := to != "" && !remoteURL && a.isAgent(to)
+	if to != "" && !remoteURL && !registeredAgent && a.opts.Services != nil {
+		allowed := false
+		for _, service := range a.opts.Services {
+			if service == to {
+				allowed = true
+				break
+			}
+		}
+		if !allowed {
+			return errResult(call.ID, "delegate target is outside the agent's service scope: "+to)
+		}
+	}
 	if cached, ok := a.cachedDelegateResult(call.ID, to, task); ok {
 		return cached
 	}
@@ -700,7 +716,7 @@ func (a *agentImpl) handleDelegate(ctx context.Context, call model.ToolCall) (re
 	defer func() { a.finishDelegateCall(key, res) }()
 
 	// An external agent on another framework, addressed by A2A URL.
-	if strings.HasPrefix(to, "http://") || strings.HasPrefix(to, "https://") {
+	if remoteURL {
 		reply, err := a2a.NewClient(to).Send(ctx, task)
 		if err != nil {
 			return errResult(call.ID, "delegate to A2A agent "+to+": "+err.Error())
@@ -709,7 +725,7 @@ func (a *agentImpl) handleDelegate(ctx context.Context, call model.ToolCall) (re
 	}
 
 	// Delegate-first: an existing agent that owns the domain handles it.
-	if to != "" && a.isAgent(to) {
+	if registeredAgent {
 		reply, err := a.callAgentRPC(ctx, to, task)
 		if err != nil {
 			return errResult(call.ID, "delegate to agent "+to+": "+err.Error())
@@ -719,13 +735,17 @@ func (a *agentImpl) handleDelegate(ctx context.Context, call model.ToolCall) (re
 
 	// Otherwise create a focused, ephemeral sub-agent. Fresh context:
 	// it loads no history and persists none.
-	var svcs []string
+	svcs := a.opts.Services
 	if to != "" {
 		svcs = []string{to}
 	}
 	sub := newEphemeral(
 		Name(a.opts.Name+".sub"),
-		Services(svcs...),
+		func(o *Options) {
+			if svcs != nil {
+				o.Services = append([]string{}, svcs...)
+			}
+		},
 		Prompt("You are a sub-agent handling a single delegated subtask. "+
 			"Complete it using the available tools and report the result concisely."),
 		Provider(a.opts.Provider),
```

**File**: `agent/delegate_scope_test.go` (added, +58/-0)
```diff
@@ -0,0 +1,58 @@
+package agent
+
+import (
+	"context"
+	"strings"
+	"testing"
+
+	"go-micro.dev/v6/model"
+	"go-micro.dev/v6/registry"
+)
+
+func TestDelegateServiceScope(t *testing.T) {
+	reg := registry.NewMemoryRegistry()
+	for _, name := range []string{"allowed", "private"} {
+		if err := reg.Register(&registry.Service{Name: name, Version: "1", Nodes: []*registry.Node{{Id: name, Address: "127.0.0.1:1"}}, Endpoints: []*registry.Endpoint{{Name: "Service.Read"}}}); err != nil {
+			t.Fatal(err)
+		}
+	}
+	for _, tc := range []struct {
+		name  string
+		opts  []Option
+		count int
+	}{
+		{"unrestricted", nil, 2},
+		{"restricted", []Option{Services("allowed")}, 1},
+		{"explicit empty", []Option{Services()}, 0},
+	} {
+		t.Run(tc.name, func(t *testing.T) {
+			calls := 0
+			fakeGen = func(ctx context.Context, opts model.Options, req *model.Request) (*model.Response, error) {
+				calls++
+				if len(req.Tools) != tc.count {
+					t.Errorf("sub-agent tools = %v, want %d", req.Tools, tc.count)
+				}
+				if tc.count == 1 && !strings.HasPrefix(req.Tools[0].OriginalName, "allowed.") {
+					t.Errorf("unexpected tool: %v", req.Tools[0])
+				}
+				return &model.Response{Reply: "done"}, nil
+			}
+			defer func() { fakeGen = nil }()
+			a := newTestAgent(append([]Option{Name("parent"), WithRegistry(reg)}, tc.opts...)...)
+			res := a.handleDelegate(context.Background(), model.ToolCall{ID: "delegate", Input: map[string]any{"task": "read"}})
+			if calls != 1 {
+				t.Fatalf("model calls = %d; result: %+v", calls, res)
+			}
+		})
+	}
+}
+
+func TestDelegateRejectsOutOfScopeTarget(t *testing.T) {
+	a := newTestAgent(Services("allowed"))
+	for _, target := range []string{"private"} {
+		res := a.handleDelegate(context.Background(), model.ToolCall{ID: target, Input: map[string]any{"task": "read", "to": target}})
+		if !strings.Contains(res.Content, "outside the agent's service scope") {
+			t.Fatalf("target %q was not refused: %+v", target, res)
+		}
+	}
+}
```

**File**: `agent/integration_test.go` (modified, +1/-1)
```diff
@@ -187,7 +187,7 @@ func TestDelegateToRegisteredAgent(t *testing.T) {
 	}
 	defer func() { fakeGen = nil }()
 
-	a := newTestAgent(Name("root"), WithRegistry(reg), WithClient(fc))
+	a := newTestAgent(Name("root"), Services("task"), WithRegistry(reg), WithClient(fc))
 	content := a.handleDelegate(context.Background(), model.ToolCall{Name: "delegate", Input: map[string]any{"task": "notify alice", "to": "comms"}}).Content
 
 	if calledService != "comms" || calledEndpoint != "Agent.Chat" {
```

**File**: `agent/options.go` (modified, +3/-2)
```diff
@@ -162,9 +162,10 @@ func Name(n string) Option {
 	return func(o *Options) { o.Name = n }
 }
 
-// Services sets which services this agent manages.
+// Services restricts which services this agent manages. Calling Services()
+// permits no discovered services; omitting this option permits all services.
 func Services(names ...string) Option {
-	return func(o *Options) { o.Services = names }
+	return func(o *Options) { o.Services = append([]string{}, names...) }
 }
 
 // Prompt sets the system prompt.
```

---

### Incident Patch 14: `59036ff8` (2026-09-21)
**Commit Message**: fix(natsjs): honor manual event acknowledgements (#4948)

**File**: `events/natsjs/README.md` (modified, +11/-0)
```diff
@@ -46,3 +46,14 @@ if err != nil {
 }
 ```
 
+
+## Acknowledgements
+
+Automatic acknowledgement on delivery is the default. Use `events.WithAutoAck(false, ackWait)`
+and call `event.Ack()` after processing succeeds, or `event.Nack()` to request
+redelivery after a failure. Unacknowledged events are redelivered after `ackWait`.
+
+With `events.WithAutoAck(true, ackWait)`, events are acknowledged when received
+from the channel, **before application processing completes**. A subsequent
+processing failure can lose the event; use manual acknowledgements when
+processing must succeed before delivery is confirmed.
```

**File**: `events/natsjs/ack_test.go` (added, +77/-0)
```diff
@@ -0,0 +1,77 @@
+package natsjs_test
+
+import (
+	"testing"
+	"time"
+
+	nserver "github.com/nats-io/nats-server/v2/server"
+	nats "github.com/nats-io/nats.go"
+	"github.com/stretchr/testify/require"
+	"go-micro.dev/v6/events"
+	"go-micro.dev/v6/events/natsjs"
+)
+
+func TestAcknowledgements(t *testing.T) {
+	for _, manual := range []bool{true, false} {
+		name := "automatic default"
+		if manual {
+			name = "manual"
+		}
+		t.Run(name, func(t *testing.T) {
+			testAcknowledgements(t, manual)
+		})
+	}
+}
+
+func testAcknowledgements(t *testing.T, manual bool) {
+	srv, err := nserver.NewServer(&nserver.Options{Host: "127.0.0.1", Port: -1, JetStream: true, StoreDir: t.TempDir()})
+	require.NoError(t, err)
+	go srv.Start()
+	require.True(t, srv.ReadyForConnections(5*time.Second))
+	t.Cleanup(func() { srv.Shutdown(); srv.WaitForShutdown() })
+	conn, err := nats.Connect(srv.ClientURL())
+	require.NoError(t, err)
+	t.Cleanup(conn.Close)
+	js, err := conn.JetStream()
+	require.NoError(t, err)
+	client, err := natsjs.NewStream(natsjs.Address(srv.ClientURL()), natsjs.SynchronousPublish(true))
+	require.NoError(t, err)
+	t.Cleanup(func() { require.NoError(t, client.(interface{ Close() error }).Close()) })
+	options := []events.ConsumeOption{events.WithGroup("worker")}
+	if manual {
+		options = append(options, events.WithAutoAck(false, 200*time.Millisecond))
+	}
+	ch, err := client.Consume("manual", options...)
+	require.NoError(t, err)
+	require.NoError(t, client.Publish("manual", []byte("payload")))
+	receive := func() events.Event {
+		t.Helper()
+		select {
+		case event := <-ch:
+			return event
+		case <-time.After(5 * time.Second):
+			t.Fatal("expected event delivery")
+			return events.Event{}
+		}
+	}
+	first := receive()
+	_ = first
+	if manual {
+		// Returning from the delivery callback must not implicitly acknowledge.
+		second := receive()
+		require.Equal(t, first.ID, second.ID)
+		require.NoError(t, second.Nack())
+		third := receive()
+		require.Equal(t, first.ID, third.ID)
+		require.NoError(t, third.Ack())
+	}
+	require.Eventually(t, func() bool {
+		info, err := js.ConsumerInfo("manual", "worker")
+		return err == nil && info.NumAckPending == 0 && info.AckFloor.Stream == 1
+	}, 5*time.Second, 10*time.Millisecond)
+	select {
+	case <-ch:
+		t.Fatal("acknowledged event was redelivered")
+	case <-time.After(400 * time.Millisecond):
+	}
+}
```

**File**: `events/natsjs/nats.go` (modified, +8/-20)
```diff
@@ -164,7 +164,8 @@ func (s *stream) Consume(topic string, opts ...events.ConsumeOption) (<-chan eve
 
 	// parse the options
 	options := events.ConsumeOptions{
-		Group: uuid.New().String(),
+		Group:   uuid.New().String(),
+		AutoAck: true,
 	}
 	for _, o := range opts {
 		o(&options)
@@ -183,24 +184,9 @@ func (s *stream) Consume(topic string, opts ...events.ConsumeOption) (<-chan eve
 			// not acknowledging the message is the way to indicate an error occurred
 			return
 		}
-		if options.AutoAck {
-			// set up the ack funcs
-			evt.SetAckFunc(func() error {
-				return msg.Ack()
-			})
-
-			evt.SetNackFunc(func() error {
-				return msg.Nak()
-			})
-		} else {
-			// set up the ack funcs
-			evt.SetAckFunc(func() error {
-				return nil
-			})
-			evt.SetNackFunc(func() error {
-				return nil
-			})
-		}
+		// Manual acknowledgements must reach JetStream regardless of AutoAck.
+		evt.SetAckFunc(func() error { return msg.Ack() })
+		evt.SetNackFunc(func() error { return msg.Nak() })
 
 		// push onto the channel and wait for the consumer to take the event off before we acknowledge it.
 		channel <- evt
@@ -235,7 +221,9 @@ func (s *stream) Consume(topic string, opts ...events.ConsumeOption) (<-chan eve
 	}
 
 	// setup the options
-	subOpts := []nats.SubOpt{}
+	// Disable the NATS callback auto-ack: this callback only delivers to a
+	// channel and cannot know when the application has finished processing.
+	subOpts := []nats.SubOpt{nats.ManualAck()}
 
 	if options.CustomRetries {
 		subOpts = append(subOpts, nats.MaxDeliver(options.GetRetryLimit()))
```

---

### Incident Patch 15: `5cd35ab4` (2026-09-21)
**Commit Message**: fix(ci): restore lint and vulnerability gates (#4947)

* fix(ci): repair pgx lint and update vulnerable transport dependencies

* fix(deps): include grpc authority-header fix on 1.83 branch

**File**: `go.mod` (modified, +15/-15)
```diff
@@ -29,7 +29,7 @@ require (
 	github.com/pkg/errors v0.9.1
 	github.com/prometheus/client_golang v1.21.1
 	github.com/prometheus/client_model v0.6.1
-	github.com/rabbitmq/amqp091-go v1.10.0
+	github.com/rabbitmq/amqp091-go v1.13.0
 	github.com/redis/go-redis/v9 v9.22.0
 	github.com/stretchr/objx v0.5.2
 	github.com/stretchr/testify v1.11.1
@@ -39,14 +39,14 @@ require (
 	go.etcd.io/bbolt v1.4.0
 	go.etcd.io/etcd/api/v3 v3.5.21
 	go.etcd.io/etcd/client/v3 v3.5.21
-	go.opentelemetry.io/otel v1.43.0
-	go.opentelemetry.io/otel/sdk v1.43.0
-	go.opentelemetry.io/otel/trace v1.43.0
+	go.opentelemetry.io/otel v1.44.0
+	go.opentelemetry.io/otel/sdk v1.44.0
+	go.opentelemetry.io/otel/trace v1.44.0
 	go.uber.org/zap v1.27.0
-	golang.org/x/crypto v0.53.0
-	golang.org/x/net v0.56.0
-	golang.org/x/sync v0.21.0
-	google.golang.org/grpc v1.82.1
+	golang.org/x/crypto v0.55.0
+	golang.org/x/net v0.58.0
+	golang.org/x/sync v0.22.0
+	google.golang.org/grpc v1.83.2
 	google.golang.org/grpc/examples v0.0.0-20250515150734-f2d3e11f3057
 	google.golang.org/protobuf v1.36.11
 )
@@ -95,16 +95,16 @@ require (
 	github.com/xrash/smetrics v0.0.0-20240521201337-686a1a2994c1 // indirect
 	go.etcd.io/etcd/client/pkg/v3 v3.5.21 // indirect
 	go.opentelemetry.io/auto/sdk v1.2.1 // indirect
-	go.opentelemetry.io/otel/metric v1.43.0 // indirect
+	go.opentelemetry.io/otel/metric v1.44.0 // indirect
 	go.uber.org/atomic v1.11.0 // indirect
 	go.uber.org/multierr v1.10.0 // indirect
 	golang.org/x/exp v0.0.0-20250305212735-054e65f0b394 // indirect
-	golang.org/x/mod v0.37.0 // indirect
-	golang.org/x/sys v0.46.0 // indirect
-	golang.org/x/text v0.39.0 // indirect
+	golang.org/x/mod v0.38.0 // indirect
+	golang.org/x/sys v0.47.0 // indirect
+	golang.org/x/text v0.41.0 // indirect
 	golang.org/x/time v0.11.0 // indirect
-	golang.org/x/tools v0.47.0 // indirect
-	google.golang.org/genproto/googleapis/api v0.0.0-20260414002931-afd174a4e478 // indirect
-	google.golang.org/genproto/googleapis/rpc v0.0.0-20260414002931-afd174a4e478 // indirect
+	golang.org/x/tools v0.48.0 // indirect
+	google.golang.org/genproto/googleapis/api v0.0.0-20260526163538-3dc84a4a5aaa // indirect
+	google.golang.org/genproto/googleapis/rpc v0.0.0-20260526163538-3dc84a4a5aaa // indirect
 	gopkg.in/yaml.v3 v3.0.1 // indirect
 )
```

**File**: `go.sum` (modified, +33/-0)
```diff
@@ -249,6 +249,8 @@ github.com/prometheus/procfs v0.16.0 h1:xh6oHhKwnOJKMYiYBDWmkHqQPyiY40sny36Cmx2b
 github.com/prometheus/procfs v0.16.0/go.mod h1:8veyXUu3nGP7oaCxhX6yeaM5u4stL2FeMXnCqhDthZg=
 github.com/rabbitmq/amqp091-go v1.10.0 h1:STpn5XsHlHGcecLmMFCtg7mqq0RnD+zFr4uzukfVhBw=
 github.com/rabbitmq/amqp091-go v1.10.0/go.mod h1:Hy4jKW5kQART1u+JkDTF9YYOQUHXqMuhrgxOEeS7G4o=
+github.com/rabbitmq/amqp091-go v1.13.0 h1:L8NA1WtF76C6KA3LAoufjfLgbist/If1UQYcsOjtxXA=
+github.com/rabbitmq/amqp091-go v1.13.0/go.mod h1:Hy4jKW5kQART1u+JkDTF9YYOQUHXqMuhrgxOEeS7G4o=
 github.com/redis/go-redis/v9 v9.22.0 h1:laDvpYXTJtZLloinw1fA5Kqd6HAEH2XKxOkG/PDq2F0=
 github.com/redis/go-redis/v9 v9.22.0/go.mod h1:y2g0Wj8rQvuK0ELM+oxSudcLtC09JScs98I/X9gRWY4=
 github.com/rogpeppe/go-internal v1.9.0/go.mod h1:WtVeX8xhTBvf0smdhujwtBcq4Qrzq/fJaraNFVN+nFs=
@@ -298,14 +300,23 @@ go.opentelemetry.io/auto/sdk v1.2.1 h1:jXsnJ4Lmnqd11kwkBV2LgLoFMZKizbCi5fNZ/ipaZ
 go.opentelemetry.io/auto/sdk v1.2.1/go.mod h1:KRTj+aOaElaLi+wW1kO/DZRXwkF4C5xPbEe3ZiIhN7Y=
 go.opentelemetry.io/otel v1.43.0 h1:mYIM03dnh5zfN7HautFE4ieIig9amkNANT+xcVxAj9I=
 go.opentelemetry.io/otel v1.43.0/go.mod h1:JuG+u74mvjvcm8vj8pI5XiHy1zDeoCS2LB1spIq7Ay0=
+go.opentelemetry.io/otel v1.44.0 h1:JjwHmHpA4iZ3wBxluu2fbbE7j4kqlE8jXyAyPXH7HqU=
+go.opentelemetry.io/otel v1.44.0/go.mod h1:BMgjTHL9WPRlRjL2oZCBTL4whCGtXch2H4BhOPIAyYc=
 go.opentelemetry.io/otel/metric v1.43.0 h1:d7638QeInOnuwOONPp4JAOGfbCEpYb+K6DVWvdxGzgM=
 go.opentelemetry.io/otel/metric v1.43.0/go.mod h1:RDnPtIxvqlgO8GRW18W6Z/4P462ldprJtfxHxyKd2PY=
+go.opentelemetry.io/otel/metric v1.44.0 h1:1w0gILTcHdr3YI+ixLyjemwrVnsMURbTZFrSYCdDdmc=
+go.opentelemetry.io/otel/metric v1.44.0/go.mod h1:8O7hanEPBNgEMmybD3s2VBKcgWOCsA6tzHBPODAiquo=
 go.opentelemetry.io/otel/sdk v1.43.0 h1:pi5mE86i5rTeLXqoF/hhiBtUNcrAGHLKQdhg4h4V9Dg=
 go.opentelemetry.io/otel/sdk v1.43.0/go.mod h1:P+IkVU3iWukmiit/Yf9AWvpyRDlUeBaRg6Y+C58QHzg=
+go.opentelemetry.io/otel/sdk v1.44.0 h1:nHYwb9lK+fJPU/dnT6s7W7Z8itMWyqrnVfbheVYrZ58=
+go.opentelemetry.io/otel/sdk v1.44.0/go.mod h1:Osuydd3Se74nqjAKxid74N5eC+jfEqfTegHRnq58oK0=
 go.opentelemetry.io/otel/sdk/metric v1.43.0 h1:S88dyqXjJkuBNLeMcVPRFXpRw2fuwdvfCGLEo89fDkw=
 go.opentelemetry.io/otel/sdk/metric v1.43.0/go.mod h1:C/RJtwSEJ5hzTiUz5pXF1kILHStzb9zFlIEe85bhj6A=
+go.opentelemetry.io/otel/sdk/metric v1.44.0 h1:3LlKgI+VjbVsjNRFZJZAJ30WjXC5VkNRks6si09iEfI=
 go.opentelemetry.io/otel/trace v1.43.0 h1:BkNrHpup+4k4w+ZZ86CZoHHEkohws8AY+WTX09nk+3A=
 go.opentelemetry.io/otel/trace v1.43.0/go.mod h1:/QJhyVBUUswCphDVxq+8mld+AvhXZLhe+8WVFxiFff0=
+go.opentelemetry.io/otel/trace v1.44.0 h1:jxF5CsGYCe74MCRx2X4g7WsY/VBKRqqpNvXlX/6gtIk=
+go.opentelemetry.io/otel/trace v1.44.0/go.mod h1:oLl1jrMQAVo6v3GAggN+1VH9VIz9iUSvW53sW1Q8PIE=
 go.uber.org/atomic v1.11.0 h1:ZvwS0R+56ePWxUNi+Atn9dWONBPp/AUETXlHW0DxSjE=
 go.uber.org/atomic v1.11.0/go.mod h1:LUxbIzbOniOlMKjJjyPfpl4v+PKK2cNJn91OQbhoJI0=
 go.uber.org/goleak v1.3.0 h1:2K3zAYmnTNqV73imy9J1T3WC+gmCePx2hEGkimedGto=
@@ -321,13 +332,17 @@ golang.org/x/crypto v0.0.0-20191011191535-87dc89f01550/go.mod h1:yigFU9vqHzYiE8U
 golang.org/x/crypto v0.0.0-20200622213623-75b288015ac9/go.mod h1:LzIPMQfyMNhhGPhUkYOs5KpL4U8rLKemX1yGLhDgUto=
 golang.org/x/crypto v0.53.0 h1:QZ4Muo8THX6CizN2vPPd5fBGHyogrdK9fG4wLPFUsto=
 golang.org/x/crypto v0.53.0/go.mod h1:DNLU434OwVakk9PzuwV8w62mAJpRJL3vsgcfp4Qnsio=
+golang.org/x/crypto v0.55.0 h1:+KWHjbgOaAQ66dh/YlkZKHlz9ZUlq61AFirAR9ntP8M=
+golang.org/x/crypto v0.55.0/go.mod h1:uq0V9dE/fzQuJtbnL+2EhWOE63vo164FY8xqEnV9xis=
 golang.org/x/exp v0.0.0-20250305212735-054e65f0b394 h1:nDVHiLt8aIbd/VzvPWN6kSOPE7+F/fNFDSXLVYkE/Iw=
 golang.org/x/exp v0.0.0-20250305212735-054e65f0b394/go.mod h1:sIifuuw/Yco/y6yb6+bDNfyeQ/MdPUy/hKEMYQV17cM=
 golang.org/x/mod v0.2.0/go.mod h1:s0Qsj1ACt9ePp/hMypM3fl4fZqREWJwdYDEqhRiZZUA=
 golang.org/x/mod v0.3.0/go.mod h1:s0Qsj1ACt9ePp/hMypM3fl4fZqREWJwdYDEqhRiZZUA=
 golang.org/x/mod v0.4.2/go.mod h1:s0Qsj1ACt9ePp/hMypM3fl4fZqREWJwdYDEqhRiZZUA=
 golang.org/x/mod v0.37.0 h1:vF1DjpVEshcIqoEaauuHebaLk1O1forxjxBaVn884JQ=
 golang.org/x/mod v0.37.0/go.mod h1:m8S8VeM9r4dzDwjrKO0a1sZP3YjeMamRRlD+fmR2Q/0=
+golang.org/x/mod v0.38.0 h1:MECBjubtXD7yj4HrhIUcywNaGeNVUdfVnxmPajOk4yk=
+golang.org/x/mod v0.38.0/go.mod h1:V6Xz0pq8TQ3dGqVQ1FVHuelZpAL0uNhSkk9ogYP3c40=
 golang.org/x/net v0.0.0-20181114220301-adae6a3d119a/go.mod h1:mL1N/T3taQHkDXs73rZJwtUhF3w3ftmwwsq0BUmARs4=
 golang.org/x/net v0.0.0-20190404232315-eb5bcb51f2a3/go.mod h1:t9HGtf8HONx5eT2rtn7q6eTqICYqUVnKs3thJo3Qplg=
 golang.org/x/net v0.0.0-20190613194153-d28f0bde5980/go.mod h1:z5CRVTTTmAJ677TzLLGU+0bjPO0LkuOLi4/5GtJWs/s=
@@ -341,6 +356,8 @@ golang.org/x/net v0.0.0-20210410081132-afb366fc7cd1/go.mod h1:9tjilg8BloeKEkVJvy
 golang.org/x/net v0.0.0-20210726213435-c6fcb2dbf985/go.mod h1:9nx3DQGgdP8bBQD5qxJ1jj9UTztislL4KSBs9R2vV5Y=
 golang.org/x/net v0.56.0 h1:Rw8j/hFzGvJUZwNBXnAtf5sVDVt+65SK2C7IxCxZt5o=
 golang.org/x/net v0.56.0/go.mod h1:D3Ku6r+V6JROoZK144D2XfMHFcMq/0zSfLelVTCFKec=
+golang.org/x/net v0.58.0 h1:ynW
```

**File**: `store/postgres/pgx/options_test.go` (modified, +3/-2)
```diff
@@ -17,7 +17,8 @@ func TestNewStoreContext(t *testing.T) {
 	})
 
 	t.Run("preserves configured context", func(t *testing.T) {
-		ctx := context.WithValue(context.Background(), struct{}{}, "value")
+		type contextKey struct{}
+		ctx := context.WithValue(context.Background(), contextKey{}, "value")
 		s := NewStore(store.WithContext(ctx))
 
 		if s.Options().Context != ctx {
@@ -26,7 +27,7 @@ func TestNewStoreContext(t *testing.T) {
 	})
 
 	t.Run("replaces configured nil context", func(t *testing.T) {
-		s := NewStore(store.WithContext(nil))
+		s := NewStore(func(options *store.Options) { options.Context = nil })
 
 		if s.Options().Context == nil {
 			t.Fatal("expected a non-nil fallback context")
```

#### Recent Merged Pull Requests:
- **PR #4977** (2026-10-05): fix(cli): report git commit version for go-install builds (@alex-dna-tech)
- **PR #4975** (2026-10-02): fix: use canonical MIME form for Micro-Id, Micro-Span-Id and Micro-Trace-Id header keys (@Ak-Army)
- **PR #4974** (2026-10-02): Make micro chat work without an agent name and align onboarding (@asim)
- **PR #4973** (closed): Unify service-agent-flow execution and add strict local recovery (@asim)
- **PR #4972** (2026-09-30): Remove app prototype and focus v7 on services, agents, and flows (@asim)
- **PR #4971** (2026-09-29): Use the shared agent harness for CLI chat (@asim)
- **PR #4970** (2026-09-29): Add app definitions, asset serving and a shared service example (@asim)
- **PR #4969** (2026-09-29): Consolidate compatible provider loops and outline v7 ownership (@asim)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

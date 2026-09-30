# Forensic Learning Record (Deep Inspection): rusq/slackdump

> **Canonical Artifact**: `07_PROJECT_LEARNING/rusq-slackdump-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/rusq/slackdump](https://github.com/rusq/slackdump))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T20:41:11.725Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `rusq/slackdump`
- **Description**: Save or export your private and public Slack messages, threads, files, and users locally without admin privileges.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 2807 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `auth/auth.go`
```
// Copyright (c) 2021-2026 Rustam Gilyazov and Contributors.
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

package auth

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"regexp"
	"runtime/trace"

	"github.com/charmbracelet/huh/spinner"
	utls "github.com/refraction-networking/utls"

	"github.com/rusq/chttp/v2"
	"github.com/rusq/slack"
	"github.com/rusq/slackauth"
)

const SlackURL = "https://slack.com"

// tokenRE is the regexp that matches a valid Slack Client token.
var tokenRE = regexp.MustCompile(`xoxc-[0-9]+-[0-9]+-[0-9]+-[0-9a-z]{64}`)

// Provider is the Slack Authentication provider.
//
//go:generate mockgen -destination ../internal/mocks/mock_auth/mock_auth.go github.com/rusq/slackdump/v4/auth Provider
type Provider interface {
	// SlackToken should return the Slack Token value.
	SlackToken() string
	// Cookies should return a set of Slack Session cookies.
	Cookies() []*http.Cookie
	// Validate should return error, in case the token or cookies cannot be
	// retrieved.
	Validate() error
	// Test tests if credentials are valid.
	Test(ctx context.Context) (*slack.AuthTestResponse, error)
	// Client returns an authenticated HTTP client
	HTTPClient() (*http.Client, error)
}

var (
	ErrNoToken      = errors.New("no token")
	ErrNoCookies    = errors.New("no cookies")
	ErrNotSupported = errors.New("not supported")
	// ErrCancelled may be returned by auth providers, if the authentication
	// process was cancelled.
	ErrCancelled = errors.New("authentication cancelled")
)

type simpleProvider struct {
	Token  string
	Cookie []*http.Cookie
}

func (c simpleProvider) Validate() error {
	if c.Token == "" {
		return ErrNoToken
	}
	if IsClientToken(c.Token) && len(c.Cookie) == 0 {
		return ErrNoCookies
	}
	return nil
}

func (c simpleProvider) SlackToken() string {
	return c.Token
}

func (c simpleProvider) Cookies() []*http.Cookie {
	return c.Cookie
}

// Load deserialises JSON data from reader and returns a ValueAuth, that can
// be used to authenticate Slackdump.  It will return ErrNoToken or
// ErrNoCookie if the authentication information is missing.
func Load(r io.Reader) (ValueAuth, error) {
	dec := json.NewDecoder(r)
	var s simpleProvider
	if err := dec.Decode(&s); err != nil {
		return ValueAuth{}, err
	}
	return ValueAuth{s}, s.Validate()
}

// Save serialises authentication information to writer.  It will return
// ErrNoToken or ErrNoCookie if provider fails validation.
func Save(w io.Writer, p Provider) error {
	if err := p.Validate(); err != nil {
		return err
	}

	s := simpleProvider{
		Token:  p.SlackToken(),
		Cookie: p.Cookies(),
	}

	enc := json.NewEncoder(w)
	if err := enc.Encode(s); err != nil {
		return err
	}

	return nil
}

// IsClientToken returns true if the tok is a web-client token.
func IsClientToken(tok string) bool {
	return tokenRE.MatchString(tok)
}

// TestAuth attempts to authenticate with the given provider.  It will return
// AuthError if failed.
func (s simpleProvider) Test(ctx context.Context) (*slack.AuthTestResponse, error) {
	ctx, task := trace.NewTask(ctx, "TestAuth")
	defer task.End()

	httpCl, err := s.HTTPClient()
	if err != nil {
		return nil, &Error{Err: err}
	}
	cl := slack.New(s.Token, slack.OptionHTTPClient(httpCl))

	region := trace.StartRegion(ctx, "simpleProvider.Test")
	defer region.End()
	ai, err := cl.AuthTestContext(ctx)
	if err != nil {
		return ai, &Error{Err: err}
	}
	return ai, nil
}

func (s simpleProvider) HTTPClient() (*http.Client, error) {
	return chttp.New(
		SlackURL,
		s.Cookies(),
		chttp.WithUserAgent(slackauth.DefaultUserAgent),
		chttp.WithUTLS(&utls.Config{}),
	)
}

func pleaseWait(ctx context.Context, msg string) func() {
	sctx, stopSpinner := context.WithCancel(ctx)
	done := make(chan struct{})
	go func() {
		defer close(done)
		_ = spinner.New().
			Type(spinner.Dots).
			Title(msg).
			Context(sctx).
			Run()
	}()

	return func() {
		stopSpinner()
		<-done
	}
}

```

### Core Architecture Module: `auth/auth_error.go`
```
// Copyright (c) 2021-2026 Rustam Gilyazov and Contributors.
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

package auth

import (
	"errors"
	"fmt"

	"github.com/rusq/slackdump/v4/internal/structures"
)

// Error is the error returned by New, the underlying Err contains
// an API error returned by slack.AuthTest call.
type Error struct {
	Err error
	Msg string
}

func (ae *Error) Error() string {
	var msg = ae.Msg
	if msg == "" {
		msg = ae.Err.Error()
	}
	return fmt.Sprintf("authentication error: %s", msg)
}

func (ae *Error) Unwrap() error {
	return ae.Err
}

func (ae *Error) Is(target error) bool {
	return target == ae.Err
}

func IsInvalidAuthErr(err error) bool {
	var e *Error
	if !errors.As(err, &e) {
		return false
	}
	return structures.IsSlackResponseError(e.Err, "invalid_auth")
}

```

### Core Architecture Module: `auth/auth_ui/auth_ui.go`
```
// Copyright (c) 2021-2026 Rustam Gilyazov and Contributors.
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

package auth_ui

// LoginType is the login type, that is used to choose the authentication flow,
// for example login headlessly or interactively.
type LoginType int8

const (
	// LInteractive is the SSO login type (Google, Apple, etc).
	LInteractive LoginType = iota
	// LHeadless is the email/password login type.
	LHeadless
	// LUserBrowser is the google auth option
	LUserBrowser
	// LMobileSignin allows to sign in using QR Code
	LMobileSignin
	// LCancel should be returned if the user cancels the login intent.
	LCancel
)

```

### Core Architecture Module: `auth/auth_ui/cli.go`
```
// Copyright (c) 2021-2026 Rustam Gilyazov and Contributors.
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

package auth_ui

import (
	"bufio"
	"fmt"
	"io"
	"os"
	"strings"

	"github.com/fatih/color"
	"github.com/rusq/slackdump/v4/internal/structures"
	"golang.org/x/term"
)

// CLI is the archaic fallback UI for auth.
type CLI struct{}

func (*CLI) instructions(w io.Writer) {
	const welcome = "Welcome to Slackdump EZ-Login 3000"
	underline := color.Set(color.Underline)
	fmt.Fprintf(w, "%s\n\n", underline.Sprint(welcome))
	fmt.Fprintf(w, "Please read these instructions carefully:\n\n")
	fmt.Fprintf(w, "1. Enter the slack workspace name or paste the URL of your slack workspace.\n\n   HINT: If https://example.slack.com is the Slack URL of your company,\n         then 'example' is the Slack Workspace name\n\n")
	fmt.Fprintf(w, "2. Browser will open, login as usual.\n\n")
	fmt.Fprintf(w, "3. Browser will close and slackdump will be authenticated.\n\n\n")
}

func (cl *CLI) RequestWorkspace(w io.Writer) (string, error) {
	cl.instructions(w)
	workspace, err := prompt(w, "Enter Slack Workspace Name or URL: ", readln)
	if err != nil {
		return "", err
	}
	return structures.ExtractWorkspace(workspace)
}

func (*CLI) RequestCreds(w io.Writer, workspace string) (email string, passwd string, err error) {
	email, err = prompt(w, "Enter Email: ", readln)
	if err != nil {
		return
	}
	defer fmt.Fprintln(w)
	passwd, err = prompt(w, fmt.Sprintf("Enter Password for %s (won't be visible): ", email), readpwd)
	return
}

func (cl *CLI) RequestLoginType(w io.Writer) (LoginType, error) {
	var types = []struct {
		name  string
		value LoginType
	}{
		{"Email", LHeadless},
		{"Google", LUserBrowser},
		{"Apple", LInteractive},
		{"Login with Single-Sign-On (SSO)", LInteractive},
		{"Other/Manual", LInteractive},
		{"Cancel", LCancel},
	}

	var idx int = -1
	for idx < 0 || idx >= len(types) {
		fmt.Fprintf(w, "Select login type:\n")
		for i, t := range types {
			fmt.Fprintf(w, "\t%d. %s\n", i+1, t.name)
		}
		fmt.Fprintf(w, "Enter number, and press Enter: ")

		_, err := fmt.Fscanf(os.Stdin, "%d", &idx)
		if err != nil {
			fmt.Fprintln(w, err)
			continue
		}

		idx -= 1 // adjusting for 0-index

		if idx < 0 || idx >= len(types) {
			fmt.Fprintln(w, "invalid login type")
		}
	}
	return types[idx].value, nil
}

func (*CLI) Stop() {}

func readln(r *os.File) (string, error) {
	line, err := bufio.NewReader(r).ReadString('\n')
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(line), nil
}

func readpwd(f *os.File) (string, error) {
	pwd, err := term.ReadPassword(int(f.Fd()))
	if err != nil {
		return "", err
	}
	return string(pwd), nil
}

func prompt(w io.Writer, prompt string, readlnFn func(*os.File) (string, error)) (string, error) {
	for {
		fmt.Fprint(w, prompt)
		v, err := readlnFn(os.Stdin)
		if err != nil {
			return "", err
		}
		if v != "" {
			return v, nil
		}
		fmt.Fprintln(w, "input cannot be empty")
	}
}

func (*CLI) ConfirmationCode(email string) (code int, err error) {
	for {
		fmt.Printf("Enter confirmation code sent to %s: ", email)
		_, err = fmt.Fscanf(os.Stdin, "%d", &code)
		if err == nil {
			break
		}
		fmt.Println("invalid confirmation code")
	}
	return
}

```

### Core Architecture Module: `auth/auth_ui/huh.go`
```
// Copyright (c) 2021-2026 Rustam Gilyazov and Contributors.
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

package auth_ui

import (
	"context"
	"errors"
	"fmt"
	"io"
	"regexp"
	"strconv"
	"strings"

	"github.com/charmbracelet/bubbles/key"
	"github.com/charmbracelet/huh"
	"github.com/rusq/osenv/v2"
	"github.com/rusq/slackauth"

	"github.com/rusq/slackdump/v4/internal/structures"
)

const (
	defQRCodeSz = 16536     // default limit for encoded image size, seen values 6174, 8462
	maxQRCodeSz = 1<<16 - 1 // maximum allowed QR code image size.
	imgPrefix   = "data:image/png;base64,"
)

// limQRCodeSz is the size of the input field for QR Code image.
var limQRCodeSz = osenv.Value("QR_CODE_SIZE", defQRCodeSz)

// Huh is the Auth UI that uses the huh library to provide a terminal UI.
type Huh struct{}

var Theme = huh.ThemeBase16()

func (h *Huh) RequestWorkspace(w io.Writer) (string, error) {
	var workspace string
	err := huh.NewForm(huh.NewGroup(
		huh.NewInput().
			Title("Enter Slack workspace name").
			Value(&workspace).
			Validate(valWorkspace).
			Description("The workspace name is the part of the URL that comes before `.slack.com' in\nhttps://<workspace>.slack.com/.  Both workspace name or URL are acceptable."),
	)).WithTheme(Theme).WithKeyMap(keymap).Run()
	if err != nil {
		return "", err
	}
	return workspace, nil
}

func (*Huh) Stop() {}

func (*Huh) RequestCreds(ctx context.Context, w io.Writer, workspace string) (email string, passwd string, err error) {
	f := huh.NewForm(
		huh.NewGroup(
			huh.NewInput().
				Title("You Slack Login Email").Value(&email).
				Placeholder("you@work.com").
				Description(fmt.Sprintf("This is the email that you log into %s with.", workspace)).
				Validate(valAND(valEmail, valRequired)),
			huh.NewInput().
				Title("Password").Value(&passwd).
				Placeholder("your slack password").
				Validate(valRequired).EchoMode(huh.EchoModePassword),
		),
	).WithTheme(Theme).WithKeyMap(keymap)
	err = f.RunWithContext(ctx)
	return
}

type methodMenuItem struct {
	MenuItem  string
	ShortDesc string
	Type      LoginType
}

func (m methodMenuItem) String() string {
	return fmt.Sprintf("%-20s - %s", m.MenuItem, m.ShortDesc)
}

var gMethods = []methodMenuItem{
	{
		"Interactive",
		"Works with most authentication schemes, except Google.",
		LInteractive,
	},
	{
		"Automatic",
		"Only suitable for email/password auth.",
		LHeadless,
	},
	{
		"User Browser",
		"Loads your user profile, works with Google Auth.",
		LUserBrowser,
	},
	{
		"QR Code",
		"Login using Sign in on Mobile QR code, works with Google Auth.",
		LMobileSignin,
	},
}

type LoginOpts struct {
	Workspace   string
	Type        LoginType
	BrowserPath string
}

var keymap = huh.NewDefaultKeyMap()

func init() {
	keymap.Quit = key.NewBinding(key.WithKeys("esc", "ctrl+c"), key.WithHelp("esc", "Quit"))
}

func (*Huh) RequestLoginType(ctx context.Context, _ io.Writer, workspace string) (LoginOpts, error) {
	ret := LoginOpts{
		Workspace:   workspace,
		Type:        LInteractive,
		BrowserPath: "",
	}

	opts := make([]huh.Option[LoginType], 0, len(gMethods))
	for _, m := range gMethods {
		opts = append(opts, huh.NewOption(m.String(), m.Type))
	}
	opts = append(opts,
		huh.NewOption("------", LoginType(-1)),
		huh.NewOption("Cancel", LCancel),
	)
	var fields []huh.Field
	if workspace == "" {
		fields = append(fields, huh.NewInput().
			Title("Enter Slack workspace name").
			Value(&ret.Workspace).
			Validate(valWorkspace).
			Description("The workspace name is the part of the URL that comes before `.slack.com' in\nhttps://<workspace>.slack.com/.  Both workspace name or URL are acceptable."),
		)
	}

	fields = append(fields, huh.NewSelect[LoginType]().
		TitleFunc(func() string {
			wsp, err := structures.ExtractWorkspace(ret.Workspace)
			if err != nil {
				return "Select login type"
			}
			return fmt.Sprintf("Select login type for [%s]", wsp)
		}, &ret.Workspace).
		Options(opts...).
		Value(&ret.Type).
		Validate(valSepEaster()).
		DescriptionFunc(func() string {
			switch ret.Type {
			case LInteractive:
				return "Clean browser will open on a Slack Login page."
			case LHeadless:
				return "You will be prompted to enter your email and password, login is automated."
			case LUserBrowser:
				return "System browser will open on a Slack Login page."
			case LMobileSignin:
				return "Sign in using 'Sign in on Mobile' QR code."
			case LCancel:
				return "Cancel the login process."
			default:
				return ""
			}
		}, &ret.Type))

	form := huh.NewForm(huh.NewGroup(fields...)).WithTheme(Theme).WithKeyMap(keymap)

	if err := form.RunWithContext(ctx); err != nil {
		return ret, err
	}
	var err error
	ret.Workspace, err = structures.ExtractWorkspace(ret.Workspace)
	if err != nil {
		return ret, err
	}

	if ret.Type == LUserBrowser {
		path, err := chooseBrowser(ctx)
		if err != nil {
			return ret, err
		}
		ret.BrowserPath = path
		return ret, err
	}

	return ret, nil
}

func chooseBrowser(ctx context.Context) (string, error) {
	browsers, err := slackauth.ListBrowsers()
	if err != nil {
		return "", err
	}
	opts := make([]huh.Option[int], 0, len(browsers))
	for i, b := range browsers {
		opts = append(opts, huh.NewOption(b.Name, i))
	}

	var selection int
	err = huh.NewForm(huh.NewGroup(
		huh.NewSelect[int]().
			Title("Detected browsers on your system").
			Options(opts...).
			Value(&selection).
			DescriptionFunc(func() string {
				return browsers[selection].Path
			}, &selection),
	)).WithTheme(Theme).WithKeyMap(keymap).RunWithContext(ctx)
	if err != nil {
		return "", err
	}
	return browsers[selection].Path, nil
}

// ConfirmationCode asks the user to input the confirmation code, does some
// validation on it and returns it as an int.
func (*Huh) ConfirmationCode(email string) (int, error) {
	var strCode string
	q := huh.NewForm(huh.NewGroup(
		huh.NewInput().
			CharLimit(6).
			Placeholder("00000").
			Title(fmt.Sprintf("Enter confirmation code sent to %s", email)).
			Description("Slack did not recognise the browser, and sent a confirmation code.  Please enter the confirmation code below.").
			Value(&strCode).
			Validate(valSixDigits),
	)).WithTheme(Theme)
	if err := q.Run(); err != nil {
		return 0, err
	}
	code, err := strconv.Atoi(strCode)
	if err != nil {
		return 0, err
	}
	return code, nil
}

var numChlgRE = regexp.MustCompile(`^\d{6}$`)

func valSixDigits(s string) error {
	if !numChlgRE.MatchString(s) {
		return errors.New("confirmation code must be a sequence of six digits")
	}
	return nil
}

func (*Huh) RequestQR(ctx context.Context, _ io.Writer) (string, error) {
	const description = `In a logged-in Slack desktop app or web client:
  1. click your workspace name (not logo) in the upper left corner;
  2. choose 'Sign in on mobile';
  3. right-click the QR code image;
  4. choose 'Copy Image URL'.`

	var imageData string
	q := huh.NewForm(huh.NewGroup(
		huh.NewText().
			CharLimit(qrCharLimit()).
			Value(&imageData).
			Validate(func(s string) error {
				if !strings.HasPrefix(s, imgPrefix) {
					return errors.New("image data must start with " + imgPrefix)
				}
				return nil
			}).
			Placeholder(imgPrefix + "...").
			Title("Paste QR code image data into this field").
			Description(description),
	))
	if err := q.Run(); err != nil {
		return "", err
	}
	return imageData, nil
}

// qrCharLimit returns the effective character l
```

### Core Architecture Module: `auth/auth_ui/validation.go`
```
// Copyright (c) 2021-2026 Rustam Gilyazov and Contributors.
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

package auth_ui

import (
	"errors"
	"regexp"

	"github.com/rusq/slackdump/v4/internal/structures"
)

var (
	ErrNotURLSafe = errors.New("not a valid url safe string")
	ErrRequired   = errors.New("can not be empty")
)

// func valURLSafe(s string) error {
// 	for _, c := range s {
// 		if !isRuneURLSafe(c) {
// 			return ErrNotURLSafe
// 		}
// 	}
// 	return nil
// }

// func isRuneURLSafe(r rune) bool {
// 	switch {
// 	case 'a' <= r && r <= 'z':
// 		return true
// 	case 'A' <= r && r <= 'Z':
// 		return true
// 	case '0' <= r && r <= '9':
// 		return true
// 	case r == '-' || r == '.' || r == '_' || r == '~':
// 		return true
// 	}
// 	return false
// }

func valRequired(s string) error {
	if s == "" {
		return ErrRequired
	}
	return nil
}

func valAND(fns ...func(string) error) func(string) error {
	return func(s string) error {
		for _, fn := range fns {
			if err := fn(s); err != nil {
				return err
			}
		}
		return nil
	}
}

var dumbEmailRE = regexp.MustCompile(`^[^@]+@[^@]+$`)

func valEmail(s string) error {
	if !dumbEmailRE.MatchString(s) {
		return errors.New("not a valid email")
	}
	return nil
}

// valSepEaster is probably the most useless validation function ever.
func valSepEaster() func(v LoginType) error {
	var phrases = []string{
		"This is a separator, it does nothing",
		"Seriously, it does nothing",
		"Stop clicking on it",
		"Stop it",
		"Stop",
		"Why are you so persistent?",
		"Fine, you win",
		"Here's a cookie: 🍪",
		"🍪",
		"🍪",
		"Don't be greedy, you already had three.",
		"Ok, here's another one: 🍪",
		"Nothing will happen if you click on it again",
		"",
		"",
		"",
		"You must have a lot of time on your hands",
		"Or maybe you're just bored",
		"Or maybe you're just procrastinating",
		"Or maybe you're just trying to get a cookie",
		"These are virtual cookies, you can't eat them, but here's another one: 🍪",
		"🍪",
		"You have reached the end of this joke, it will now repeat",
		"Seriously...",
		"Ah, shit, here we go again",
	}
	var i int
	return func(v LoginType) error {
		if v == -1 {
			// separator selected
			msg := phrases[i]
			i = (i + 1) % len(phrases)
			return errors.New(msg)
		}
		return nil
	}
}

func valWorkspace(s string) error {
	if err := valRequired(s); err != nil {
		return err
	}
	_, err := structures.ExtractWorkspace(s)
	return err
}

```

### Core Architecture Module: `auth/browser.go`
```
// Copyright (c) 2021-2026 Rustam Gilyazov and Contributors.
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

package auth

import (
	"context"
	"io"
	"log/slog"
	"os"
	"time"

	"github.com/rusq/slackdump/v4/auth/auth_ui"
	"github.com/rusq/slackdump/v4/auth/browser"
	"github.com/rusq/slackdump/v4/internal/osext"
	"github.com/rusq/slackdump/v4/internal/structures"
)

var (
	_           Provider = PlaywrightAuth{}
	defaultFlow          = &auth_ui.Huh{}
)

// PlaywrightAuth is the playwright browser authentication provider.
//
// Deprecated: Use the [RodAuth] provider instead.
type PlaywrightAuth struct {
	simpleProvider
	opts options
}

type playwrightOptions struct {
	browser      browser.Browser
	flow         BrowserAuthUI
	loginTimeout time.Duration
	verbose      bool
}

type BrowserAuthUI interface {
	// RequestWorkspace should request the workspace name from the user.
	RequestWorkspace(w io.Writer) (string, error)
	// Stop indicates that the auth flow should cleanup and exit, if it is
	// keeping the state.
	Stop()
}

func NewPlaywrightAuth(ctx context.Context, opts ...Option) (PlaywrightAuth, error) {
	br := PlaywrightAuth{
		opts: options{
			playwrightOptions: playwrightOptions{
				flow:         defaultFlow,
				browser:      browser.Bfirefox,
				loginTimeout: browser.DefLoginTimeout,
			},
		},
	}
	for _, opt := range opts {
		opt(&br.opts)
	}
	if osext.IsDocker() || !osext.IsInteractive() {
		return PlaywrightAuth{}, &Error{Err: ErrNotSupported, Msg: "browser auth is not supported in docker or dumb terminals, use token/cookie auth instead"}
	}

	if br.opts.workspace == "" {
		var err error
		br.opts.workspace, err = br.opts.flow.RequestWorkspace(os.Stdout)
		if err != nil {
			return br, err
		}
		defer br.opts.flow.Stop()
	}
	if wsp, err := structures.ExtractWorkspace(br.opts.workspace); err != nil {
		return br, err
	} else {
		br.opts.workspace = wsp
	}
	slog.Info("Please wait while Playwright is initialising.")
	slog.Info("If you're running it for the first time, it will take a couple of minutes...")
	stopSpinner := pleaseWait(ctx, "Initialising Playwright...")
	defer stopSpinner()
	auther, err := browser.New(br.opts.workspace, browser.OptBrowser(br.opts.browser), browser.OptTimeout(br.opts.loginTimeout), browser.OptVerbose(br.opts.verbose))
	if err != nil {
		return br, err
	}
	stopSpinner()

	token, cookies, err := auther.Authenticate(ctx)
	if err != nil {
		return br, err
	}
	br.simpleProvider = simpleProvider{
		Token:  token,
		Cookie: cookies,
	}
	return br, nil
}

```

### Core Architecture Module: `auth/browser/browser.go`
```
// Copyright (c) 2021-2026 Rustam Gilyazov and Contributors.
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

// Package browser provides the playwright browser authentication provider.
//
// Deprecated: Use the [auth.RodAuth] provider instead.
package browser

import (
	"fmt"
	"strings"
	"time"

	"github.com/playwright-community/playwright-go"
)

// DefLoginTimeout is the default Slack login timeout
const DefLoginTimeout = 5 * time.Minute

//go:generate go tool stringer -type Browser -trimprefix=B browser.go
type Browser int

const (
	Bfirefox Browser = iota
	Bchromium
)

type Option func(*Client)

func OptBrowser(b Browser) Option {
	return func(c *Client) {
		if b < Bfirefox || Bchromium < b {
			b = Bfirefox
		}
		c.br = b
	}
}

func OptTimeout(d time.Duration) Option {
	return func(c *Client) {
		if d < 0 {
			return
		}
		c.loginTimeout = float64(d.Milliseconds())
	}
}

func OptVerbose(b bool) Option {
	return func(c *Client) {
		c.verbose = b
	}
}

func (e *Browser) Set(v string) error {
	v = strings.ToLower(v)
	for i := range len(_Browser_index) - 1 {
		if strings.ToLower(_Browser_name[_Browser_index[i]:_Browser_index[i+1]]) == v {
			*e = Browser(i)
			return nil
		}
	}
	var allowed []string
	for i := range len(_Browser_index) - 1 {
		allowed = append(allowed, _Browser_name[_Browser_index[i]:_Browser_index[i+1]])
	}
	return fmt.Errorf("unknown browser: %s, allowed: %v", v, allowed)
}

// client returns the appropriate client from playwright.Playwright.
func (br Browser) client(pw *playwright.Playwright) playwright.BrowserType {
	switch br {
	default:
		fallthrough
	case Bfirefox:
		return pw.Firefox
	case Bchromium:
		return pw.Chromium
	}
	// unreachable
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #673** (2026-05-13): **slackdump wizard doens't document or support feature flags**
  *Symptoms*: When "recreating" or setting up a new workspace, `slackdump wiz` or `slackdump workspace wiz` seems to be the way to go.  At the same time it doesn't document (or support) `-cache-dir`, `-machine-id` or `-no-encryption`. Those are also easy to miss.  **Describe the solution you'd like** support or document existing feature flags that exist for other slackdump commands  **Describe alternatives you've considered** ```bash ln -s my-cache-folder ~/.cache/slackdump ``` And making sure the encryption setting or machine id is always set  **Additional context** N/A
  **Post-Mortem & Fix Analysis**:
  > Hey @volker-fr , fair enough, they need to be wired [to the UI]

- **Issue #614** (2026-02-20): **Error: `not_in_channel` when using `archive`**
  *Symptoms*: **Describe the bug** When I run `slackdump archive` on our organization the command will eventually fail on the same channel with the following error:  ``` STDERR 2026-02-18 00:01:33 ERROR 006 (Application Error): error in subroutine STDERR │   conversations on stage worker: error streaming STDERR │   conversations: Channel channel C0A0C8EM9JT: callback STDERR │   error: not_in_channel. ```  This also happens if I backup this specific channel only. Using slackdump 4.0, reproducible on macOS, and also with the docker container on Ubuntu 24.04.  **To Reproduce** This seems to be specific to our organisation. I have run the same version of slackdump on our organisation before, so this must be a specific item that is not handled correctly by slackdump.  **Expected behavior** Ideally it would be able to continue on errors like this (maybe an additional flag?), an incomplete dump would be better than no dump.  **Desktop (please complete the following information):**  - OS: macOS  - OS Version: 26.3  - Slackdump Version: 4.0  
  **Post-Mortem & Fix Analysis**:
  > This is the output of only backing up the single channel with more verbosity:  <details><summary>Log</summary> <p>  ``` $ slackdump export -load-env -v -o dump.zip C0A0C8EM9JT                                                                                                                                                   2026-02-18 11:30:05 DEBUG current workspace: ********** 2026-02-18 11:30:05 DEBUG loaded saved credentials                       ├ cache_dir: **********                       ├ filename: **********                       └ workspace: ********** 2026-02-18 11:30:06 DEBUG using database backend 2026-02-18 11:30:06 INFO  temporary directory in use                       └ tmpdir: /var/folders/ph/hjg2rm897hz0wh5584vzwh5r0000gn/T/slackdump-2164534648 2026-02-18 11:30:06 DEBUG insert                       └ stmt: INSERT INTO SESSION (TO_TS,FINISHED,FILES_ENABLED,AVATARS_ENABLED,MODE,ARGS) VALUES (?,?,?,?,?,?) 2026-02-18 11:30:06 DEBUG starting downloader 2026-02-18 11:30:06 DEB
  > Hi @tlhr , interesting! Are you a member of that channel? And if not, are you able to access the channel in the Slack Client itself?
  > Apologies, it seems this is my fault: I created an app (I'm the workspace admin) and did not update the channel membership of the app, so the "not_in_channel" error does make sense. But I see that your PR addresses the hard failure, thanks a lot for the very quick fix for that!

- **Issue #604** (2026-01-31): **[goreleaser] OpenBSD build fails.**
  *Symptoms*: **Describe the bug** OpenBSD amd64 build fails  

- **Issue #603** (2026-01-31): **403 Forbidden trying to download avatars with two periods in filename**
  *Symptoms*: **Describe the bug** Running the latest slackdump release on Windows 11, I'm getting an `error saving file`, `slack server error: 403 Forbidden`, it thinks the `url_filename` has two periods before the extension.  Manually visiting that URL does fail; visiting that URL with only one period in the filename works, e.g.:  ``` 2026-01-30 23:34:33 ERROR error saving file                       ├ url_filename: 1923876048375_d4a81c21a7407c0XXXXX_original..jpg                       ├ destination: __avatars\U01A19XXXXX\1923876048375_d4a81c21a7407c0XXXXX_original..jpg                       └ error: callback error: download to "__avatars\\U01A19XXXXX\\1923876048375_d4a81c21a7407c0XXXXX_original..jpg" failed, [src=https://avatars.slack-edge.com/2021-04-07/1923876048375_d4a81c21a7407c0XXXXX_original..jpg]: slack server error: 403 Forbidden ```  Is there debugging I can provide?
  **Post-Mortem & Fix Analysis**:
  > Hey @vitorio , thanks for the report.  If you check the JSON payload (you can find it in the Users.json or in the table S_USERS), for that user, does it really have two full stops in it?  And to confirm - accessing the URL with a single full stop works?  I wonder where those two full stops came from, this is _should be_ slack-generated filename
  > The fix is now in master, could you run and check if it works for you? I wasn't able to reproduce this on my workspace.
  > Yes, `S_USERS`'s `DATA` JSON blob has "`image_original`" with a filename with two periods before the extension.  The other filenames (512, 192, etc.) all look fine.  Three (3) avatars exhibited this, with both PNG and JPG original filenames.  The URL with two periods gives me what looks like an S3 XML accessed denied message, reporting 403 in the console.  The URL fixed to have only one period shows me an avatar.  The current master branch does seem to have downloaded the missing avatars, but the `image_original` data in `S_USERS` still references the original filename with two periods.  If it'll do that rewrite internally, then I think it's fixed!

- **Issue #584** (2025-12-19): **resume -threads does not discover new threads on old messages**
  *Symptoms*: **Describe the bug**  `slackdump resume -threads` doesn't fetch new threads on old messages that previously had no threads.  **To Reproduce**  1. In Slack, write a message in <channel-id> 1. Create a new archive: `slackdump archive -o test_archive <channel-id> 2. In Slack, start a new thread on the message from step 1 3. Run `slackdump resume -threads test_archive` 4. View the archive  **Expected behavior**  The thread from step 2 should appear in the test archive.  **Output**  The thread won't be there. (Threads on new top-level messages will be there, and so will updates on threads that already existed in the archive.)  **Desktop (please complete the following information):**  - OS: Ubuntu  - OS Version: 25.04  - Slackdump Version: 3.1.10  **Additional context**  As described in https://github.com/rusq/slackdump/issues/550 , `resume -threads` already has to request updates on every existing thread in the DB. Fixing this might make that even slower!  Would it be possible to allow specifying a timeframe (e.g. "30 days before the end_time of the previous run") where `resume -threads` does thread-checking only for messages/replies in the archive that are within that timeframe? (Let me know if this should be a separate feature request.)
  **Post-Mortem & Fix Analysis**:
  > Hey @mattiklock , thanks for raising this, looks like a tricky one with no easy way of solving.  I like the idea of being able to specify the "window" before the end_time, probably would address most cases, except some necroposting.  Can solve it in scope of this issue, no need for a separate request :)
  > This is now in master.  The lookback parameter is set to 1 week by default, and can be specified when running resume: ``` slackdump resume -lookback 30d ``` or in ISO 8601 format: ``` slackdump resume -lookback p4w5dt21h30m5s ``` Meaning, that slackdump will look back 4 weeks 5 days 21 hours 30 minutes and 5 second from the latest archived message in the channel.  It can also be configured in the slackdump wizard in "Resume Options" screen:  <img width="657" height="214" alt="Image" src="https://github.com/user-attachments/assets/196f9fde-b421-46c3-83c1-de9108d3835d" />

- **Issue #562** (2025-11-09): **OAuth-Export Token being 32 Hex Characters not recognized**
  *Symptoms*: **Describe the bug** For exporting with the Export-Token I got rhe OAuth Token on a created App and it is "xoxp-" followed by 3 groups of numbers and a 4th group which is 32 Hex characters... however when trying to set it on the SlackDump options before exporting it rejects its and ask for a 4th group of 64 Hex Characters instead  **Authentication type (please read)** I am using Workspace Name and Cookie to Export because I got a crash on any other login atempt involving the browsers but I don't care about that, with the Cookie it works... but I need to use the Export Token for being able to render the downloaded images on the SlackLogView  **To Reproduce** Steps to reproduce the behavior: 1. Run slackdump with the Wizzard, then on Export Options try to use a newly generated "Export Token" which is now generated by new Apps on Slack with "xoxp-" followed by 3 groups of numbers and a 4th group which is 32 Hex characters  **Expected behavior** It should accept the Export-Token as Valid  **Output** I can't advance, I got a warning that the format is not the correct one  **Desktop (please complete the following information):**  - OS: Windows 10 Pro  - OS Version: 22H2  - Slackdump Version: 3.1.8  **Additional context** Add any other context about the problem here.  <img width="1068" height="256" alt="Image" src="https://github.com/user-attachments/assets/c12f5fc0-71e7-44e8-b05f-6d6971a4c992" />
  **Post-Mortem & Fix Analysis**:
  > Seems like the validation should be fixed, thanks for reporting!
  > Yes, I tested it yesterday and the Token is properly recognized now. Thanks

- **Issue #561** (2025-11-09): **Viewer Returns 404 on Attachments with a Tilde (~) in the Filename**
  *Symptoms*: **Describe the bug** The built-in viewer will not display any attachments with a tilde (~) in the filename.  The localhost returns a 404 when you point a web browser directly to any such file.  **Authentication type (please read)** N/A  **To Reproduce** Steps to reproduce the behavior: Archive a workspace with an attachment containing a tilde (~).  Try to view the attachment using the built-in viewer.  Try to view the attachment directly in a web browser via the localhost.  **Expected behavior** I expect the attachment to be fetched/displayed when using the built-in viewer and when accessing the attachment directly in a web browser via the localhost.  **Output** 404  **Desktop (please complete the following information):**  - OS: macOS  - OS Version: 15.5  - Slackdump Version: 3.1.8  **Additional context** The files are archived correctly and are saved locally exactly where they should be in Slackdump's __uploads folder.  They just won't display.  <img width="345" height="113" alt="Image" src="https://github.com/user-attachments/assets/16aecc00-1a60-421d-8a5d-771e4c240b2d" /> <img width="1709" height="982" alt="Image" src="https://github.com/user-attachments/assets/b9f6cf21-a274-4ea6-be26-95c256d1c8ad" /> <img width="1090" height="16" alt="Image" src="https://github.com/user-attachments/assets/0659df6a-6ac2-4a07-b726-fcb4ea2c8e0d" /> <img width="745" height="167" alt="Image" src="https://github.com/user-attachments/assets/c894ce66-851a-47d6-8dce-6eec86922334" />
  **Post-Mortem & Fix Analysis**:
  > Looks like a viewer issue, thanks for reporting

- **Issue #560** (2025-11-09): **Extreme slow updates**
  *Symptoms*: **Describe the bug** `slackdump resume` in version 3.1.7 is extremely slow and behaves differently as updates in version 3.0.5  **Authentication type (please read)** N/A  **To Reproduce** Steps to reproduce the behavior:  slackdump 3.0.5 ``` # note that this is 1month back time ./slackdump \         export \         -o existing_folder  \         -type standard \         -workspace my_slack \         -time-from $(date -d "1 month ago" +%Y-%m-%d)T00:00:00"  real    3m55.150s user    0m6.363s sys     0m2.038s ```  slackdump 3.1.7  ``` # note that this is 3 days back only ./slackdump \         resume \         -threads \         -refresh \         -workspace my_slack \         -time-from $(date -d "3 days ago" +%Y-%m-%d)T00:00:00 \         existing_folder  ... ... 2025-10-04 03:26:31  ... ... ... 2025-10-04 08:31:51  ... ... 2147.33user 750.46system 5:05:23elapsed 15%CPU (0avgtext+0avgdata 50720maxresident)k 416816inputs+133602024outputs (1major+4276258minor)pagefaults 0swaps ```  Old slackdump 3.0.5 that doesn't use sqlite catches up 1month in under 4 min. While the newer version 3.1.7 takes over 5 hours for the last three days.  This is a Slack that is limited to 90 days. In a Slack with history far back, the update still runs after over one day.  **Expected behavior** Update/refresh of latest Slack messages -- including threads -- has a comparable time between v.3.0.5 and v.3.1.7.  **Desktop (please complete the following information):**  - OS: Linux  - OS Version: `Linux play
  **Post-Mortem & Fix Analysis**:
  > Hey @volker-fr, thanks for your support :)  Re issue: This sounds like a missing index on a table, because conversion should not take that long.  I'll check the db structure to verify.  I did find one not so long ago and fixed it in #545, there must be another one.  The reason v3.0.5 works different is that it uses a different backend (chunk files - `*.json.gz`). Switching to database backend solved bunch of issues, but introduced another bunch, as it usually happens. Main reason for switching were: 1) resume is much easier to implement 2) better performance (in theory)  resume with `-threads` enabled will be slower, as it scans all existing threads, and asks API for an update for those threads.  Maybe slack API are smart enough that given the start time it will return historical thread updates as well, I'd need to test that.
  > I have two questions: 1. What is the size of the "myworkspace" export directory, if you run `du -h .` in it? 2. What is the size of the resulting `slackdump.sqlite` file?  My dataset (sqlite file) is 855MB  I ran convert: - from database->chunk, it took 50s on my machine. - from chunk -> database 1m18s
  > > resume with -threads enabled will be slower, as it scans all existing threads, and asks API for an update for those threads.  That's my impression, that it goes now through all threads in the newer version, while it limited it by date for the older version.  Is there a way to restrict threads to the same time frame?

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

### Incident Patch 1: `a77f8deb` (2026-09-24)
**Commit Message**: test: update client init endpoint fixtures

**File**: `internal/edge/response_validation_test.go` (modified, +1/-1)
```diff
@@ -32,7 +32,7 @@ func TestClient_Methods_ValidateBaseResponse(t *testing.T) {
 	tests := []testCase{
 		{
 			name:     "ClientUserBoot",
-			endpoint: "client.userBoot",
+			endpoint: "client.init",
 			invoke: func(cl *Client) error {
 				_, err := cl.ClientUserBoot(t.Context())
 				return err
```

**File**: `internal/edge/slacker_test.go` (modified, +6/-6)
```diff
@@ -221,7 +221,7 @@ func TestClient_getConversationsContext(t *testing.T) {
 						form, _ := url.ParseQuery(string(body))
 
 						switch endpoint {
-						case "client.userBoot":
+						case "client.init":
 							_, _ = io.WriteString(w, `{"ok":true,"channels":[]}`)
 						case "im.list":
 							_, _ = io.WriteString(w, `{"ok":true,"ims":[]}`)
@@ -262,7 +262,7 @@ func TestClient_getConversationsContext(t *testing.T) {
 						endpoint := strings.TrimPrefix(r.URL.Path, "/")
 						w.Header().Set("Content-Type", "application/json")
 						switch endpoint {
-						case "client.userBoot":
+						case "client.init":
 							_, _ = io.WriteString(w, `{"ok":true,"channels":[{"id":"CBOOT","name":"boot","is_channel":true},{"id":"X1","name":"dup","is_channel":true}]}`)
 						case "im.list":
 							_, _ = io.WriteString(w, `{"ok":true,"ims":[{"id":"D1","is_im":true},{"id":"X1","is_im":true}]}`)
@@ -314,7 +314,7 @@ func TestClient_getConversationsContext(t *testing.T) {
 						form, _ := url.ParseQuery(string(body))
 
 						switch endpoint {
-						case "client.userBoot":
+						case "client.init":
 							_, _ = io.WriteString(w, `{"ok":true,"channels":[{"id":"G_SEEN","name":"seen","is_mpim":true}]}`)
 						case "im.list", "mpim.list":
 							_, _ = io.WriteString(w, `{"ok":true}`)
@@ -362,7 +362,7 @@ func TestClient_getConversationsContext(t *testing.T) {
 						endpoint := strings.TrimPrefix(r.URL.Path, "/")
 						w.Header().Set("Content-Type", "application/json")
 						switch endpoint {
-						case "client.userBoot":
+						case "client.init":
 							_, _ = io.WriteString(w, `{"ok":true,"channels":[{"id":"CBOOT","name":"boot","is_channel":true}]}`)
 						case "im.list", "mpim.list":
 							_, _ = io.WriteString(w, `{"ok":true}`)
@@ -386,7 +386,7 @@ func TestClient_getConversationsContext(t *testing.T) {
 						endpoint := strings.TrimPrefix(r.URL.Path, "/")
 						w.Header().Set("Content-Type", "application/json")
 						switch endpoint {
-						case "client.userBoot":
+						case "client.init":
 							_, _ = io.WriteString(w, `{"ok":true,"channels":[{"id":"CBOOT","name":"boot","is_channel":true}]}`)
 						case "im.list", "mpim.list":
 							_, _ = io.WriteString(w, `{"ok":true}`)
@@ -459,7 +459,7 @@ func TestClient_getConversationsContext(t *testing.T) {
 			form, _ := url.ParseQuery(string(body))
 
 			switch endpoint {
-			case "client.userBoot":
+			case "client.init":
 				_, _ = io.WriteString(w, `{"ok":true,"channels":[{"id":"CBOOT","name":"boot","is_channel":true}]}`)
 			case "search.modules.channels":
 				st.mu.Lock()
```

---

### Incident Patch 2: `f7319928` (2026-09-12)
**Commit Message**: Merge pull request #735 from thomasmaerz/fix-dedupe-notnull-predicate

chunk: fix slow dedupe joins

**File**: `internal/chunk/backend/dbase/repository/dedupe.go` (modified, +1/-1)
```diff
@@ -385,7 +385,7 @@ func withDuplicateRows(entity dedupeEntity, final string) string {
 func joinOnColumns(left, right string, cols []string) string {
 	parts := make([]string, 0, len(cols))
 	for _, col := range cols {
-		parts = append(parts, "("+left+"."+col+" = "+right+"."+col+" OR ("+left+"."+col+" IS NULL AND "+right+"."+col+" IS NULL))")
+		parts = append(parts, left+"."+col+" IS "+right+"."+col)
 	}
 	return strings.Join(parts, " AND ")
 }
```

**File**: `internal/chunk/backend/dbase/repository/dedupe_test.go` (modified, +29/-0)
```diff
@@ -586,3 +586,32 @@ func verifyFileCountForTest(t *testing.T, db *sqlx.DB, expected int) {
 	require.NoError(t, err)
 	assert.Equal(t, int64(expected), count)
 }
+
+func Test_joinOnColumns(t *testing.T) {
+	tests := []struct {
+		name string
+		cols []string
+		want string
+	}{
+		{
+			name: "multiple columns",
+			cols: []string{"CHANNEL_ID", "USER_ID"},
+			want: "T.CHANNEL_ID IS L.CHANNEL_ID AND T.USER_ID IS L.USER_ID",
+		},
+		{
+			name: "one column",
+			cols: []string{"MESSAGE_ID"},
+			want: "T.MESSAGE_ID IS L.MESSAGE_ID",
+		},
+		{
+			name: "no columns",
+			want: "",
+		},
+	}
+
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			assert.Equal(t, tt.want, joinOnColumns("T", "L", tt.cols))
+		})
+	}
+}
```

---

### Incident Patch 3: `0dbdb4bb` (2026-09-11)
**Commit Message**: chunk: fix dedupe join predicate for NOT NULL key columns

joinOnColumns emitted NULL-tolerant OR predicates for every dedupe key
column, which blocks the covering-index equi-lookup and degrades the
Preview count queries to SCAN + per-group range probe. On archives with
resume-overlap duplicates (~100k CHANNEL_USER rows) the channel_users
count never finishes: the process burns a core re-reading pages with no
progress, no error and no log output after 'conversations done'.

Emit plain equality for key columns declared NOT NULL (all of them except
FILE.MESSAGE_ID and FILE.THREAD_ID, per the schema migrations) and keep
the OR form only where nullability is real. For NOT NULL columns the
IS NULL branches are unsatisfiable, so matched row sets are identical.

Verified: tools dedupe Preview on a previously-hanging archive completes
in <1s (was: killed after 9.5+ min); full dbase tree green with -race.

**File**: `internal/chunk/backend/dbase/repository/dedupe.go` (modified, +29/-12)
```diff
@@ -3,6 +3,7 @@ package repository
 import (
 	"context"
 	"fmt"
+	"slices"
 	"strings"
 
 	"github.com/jmoiron/sqlx"
@@ -81,8 +82,16 @@ type dedupeEntity struct {
 	name       string
 	table      string
 	keyColumns []string
-	chunkTypes []chunk.ChunkType
-	mode       dedupeMode
+	// nullableColumns lists the subset of keyColumns that may hold NULL.
+	// Joins on all other key columns use plain equality, which the query
+	// planner can serve from covering indexes; the NULL-tolerant OR form
+	// is reserved for genuinely nullable columns, where it preserves
+	// NULL=NULL duplicate matching. Column nullability mirrors the schema
+	// migrations (e.g. FILE.MESSAGE_ID and FILE.THREAD_ID are nullable,
+	// every other dedupe key column is declared NOT NULL).
+	nullableColumns []string
+	chunkTypes      []chunk.ChunkType
+	mode            dedupeMode
 }
 
 var dedupeEntities = []dedupeEntity{
@@ -115,11 +124,12 @@ var dedupeEntities = []dedupeEntity{
 		mode:       dedupeByKey,
 	},
 	{
-		name:       "files",
-		table:      "FILE",
-		keyColumns: []string{"ID", "CHANNEL_ID", "MESSAGE_ID", "THREAD_ID"},
-		chunkTypes: []chunk.ChunkType{chunk.CFiles},
-		mode:       dedupeByData,
+		name:            "files",
+		table:           "FILE",
+		keyColumns:      []string{"ID", "CHANNEL_ID", "MESSAGE_ID", "THREAD_ID"},
+		nullableColumns: []string{"MESSAGE_ID", "THREAD_ID"},
+		chunkTypes:      []chunk.ChunkType{chunk.CFiles},
+		mode:            dedupeByData,
 	},
 }
 
@@ -326,7 +336,7 @@ func buildPrunableChunksSelect(entity dedupeEntity) string {
 	buf.WriteString("LEFT JOIN duplicates D ON D.CHUNK_ID = T.CHUNK_ID")
 	if len(entity.keyColumns) > 0 {
 		buf.WriteString(" AND ")
-		buf.WriteString(joinOnColumns("D", "T", entity.keyColumns))
+		buf.WriteString(joinOnColumns("D", "T", entity.keyColumns, entity.nullableColumns))
 	}
 	buf.WriteString("\nWHERE C.TYPE_ID IN (")
 	buf.WriteString(strings.Join(placeholders(entity.chunkTypes), ","))
@@ -341,7 +351,7 @@ func buildDeleteDuplicatesStmt(entity dedupeEntity) string {
 	buf.WriteString(" AS T\nWHERE EXISTS (\nSELECT 1 FROM duplicates D WHERE D.CHUNK_ID = T.CHUNK_ID")
 	if len(entity.keyColumns) > 0 {
 		buf.WriteString(" AND ")
-		buf.WriteString(joinOnColumns("D", "T", entity.keyColumns))
+		buf.WriteString(joinOnColumns("D", "T", entity.keyColumns, entity.nullableColumns))
 	}
 	buf.WriteString("\n)")
 	return buf.String()
@@ -373,7 +383,7 @@ func withDuplicateRows(entity dedupeEntity, final string) string {
 	buf.WriteString("FROM ")
 	buf.WriteString(entity.table)
 	buf.WriteString(" T\nJOIN latest L ON ")
-	buf.WriteString(joinOnColumns("T", "L", entity.keyColumns))
+	buf.WriteString(joinOnColumns("T", "L", entity.keyColumns, entity.nullableColumns))
 	if entity.mode == dedupeByData {
 		buf.WriteString(" AND L.DATA = T.DATA")
 	}
@@ -382,10 +392,17 @@ func withDuplicateRows(entity dedupeEntity, final string) string {
 	return buf.String()
 }
 
-func joinOnColumns(left, right string, cols []string) string {
+func joinOnColumns(left, right string, cols, nullable []string) string {
 	parts := make([]string, 0, len(cols))
 	for _, col := range cols {
-		parts = append(parts, "("+left+"."+col+" = "+right+"."+col+" OR ("+left+"."+col+" IS NULL AND "+right+"."+col+" IS NULL))")
+		if slices.Contains(nullable, col) {
+			parts = append(parts, "("+left+"."+col+" = "+right+"."+col+" OR ("+left+"."+col+" IS NULL AND "+right+"."+col+" IS NULL))")
+			continue
+		}
+		// The column is declared NOT NULL (see dedupeEntity.nullableColumns),
+		// so the NULL-tolerant branches are unsatisfiable and plain equality
+		// matches exactly the same rows while remaining index-friendly.
+		parts = append(parts, left+"."+col+" = "+right+"."+col)
 	}
 	return strings.Join(parts, " AND ")
 }
```

**File**: `internal/chunk/backend/dbase/repository/dedupe_test.go` (modified, +64/-0)
```diff
@@ -3,6 +3,7 @@ package repository
 import (
 	"context"
 	"fmt"
+	"slices"
 	"testing"
 
 	"github.com/jmoiron/sqlx"
@@ -586,3 +587,66 @@ func verifyFileCountForTest(t *testing.T, db *sqlx.DB, expected int) {
 	require.NoError(t, err)
 	assert.Equal(t, int64(expected), count)
 }
+
+func Test_joinOnColumns(t *testing.T) {
+	tests := []struct {
+		name     string
+		cols     []string
+		nullable []string
+		want     string
+	}{
+		{
+			name:     "non-nullable columns use plain equality",
+			cols:     []string{"CHANNEL_ID", "USER_ID"},
+			nullable: nil,
+			want:     "T.CHANNEL_ID = L.CHANNEL_ID AND T.USER_ID = L.USER_ID",
+		},
+		{
+			name:     "nullable columns keep null-tolerant form",
+			cols:     []string{"ID", "MESSAGE_ID"},
+			nullable: []string{"MESSAGE_ID"},
+			want: "T.ID = L.ID AND " +
+				"(T.MESSAGE_ID = L.MESSAGE_ID OR (T.MESSAGE_ID IS NULL AND L.MESSAGE_ID IS NULL))",
+		},
+		{
+			name:     "all nullable",
+			cols:     []string{"MESSAGE_ID", "THREAD_ID"},
+			nullable: []string{"MESSAGE_ID", "THREAD_ID"},
+			want: "(T.MESSAGE_ID = L.MESSAGE_ID OR (T.MESSAGE_ID IS NULL AND L.MESSAGE_ID IS NULL)) AND " +
+				"(T.THREAD_ID = L.THREAD_ID OR (T.THREAD_ID IS NULL AND L.THREAD_ID IS NULL))",
+		},
+		{
+			name:     "no columns",
+			cols:     nil,
+			nullable: nil,
+			want:     "",
+		},
+	}
+
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			assert.Equal(t, tt.want, joinOnColumns("T", "L", tt.cols, tt.nullable))
+		})
+	}
+}
+
+func TestDedupeEntities_nullTolerance(t *testing.T) {
+	// Guards the dedupe hang class: NULL-tolerant OR join predicates defeat
+	// covering-index lookups, so they must only be generated for genuinely
+	// nullable key columns. Every other entity must emit plain equality.
+	for _, entity := range dedupeEntities {
+		t.Run(entity.name, func(t *testing.T) {
+			stmt := withDuplicateRows(entity, "SELECT 1 FROM duplicates")
+			for _, col := range entity.keyColumns {
+				nullTolerant := "T." + col + " IS NULL"
+				if slices.Contains(entity.nullableColumns, col) {
+					assert.Contains(t, stmt, nullTolerant,
+						"nullable key column must keep null-tolerant matching")
+					continue
+				}
+				assert.NotContains(t, stmt, nullTolerant,
+					"NOT NULL key column must use plain equality")
+			}
+		})
+	}
+}
```

---

### Incident Patch 4: `098aba9e` (2026-09-03)
**Commit Message**: Merge pull request #731 from aerickson/20260825-fix_thread_display_issues

fix: show refreshed thread parents in channel timeline

**File**: `internal/chunk/backend/dbase/repository/dbmessage.go` (modified, +6/-3)
```diff
@@ -167,14 +167,17 @@ func NewMessageRepository() MessageRepository {
 	return messageRepository{newGenericRepository(DBMessage{})}
 }
 
-const threadOnlyCondition = " AND ((CH.TYPE_ID=0 AND (CH.THREAD_ONLY=FALSE OR CH.THREAD_ONLY IS NULL)) OR (CH.TYPE_ID=1 AND CH.THREAD_ONLY=TRUE AND T.IS_PARENT=TRUE))"
+// channelTimelineCondition keeps thread replies out of a channel timeline while
+// retaining parents from both thread-only and non-thread-only chunks. A
+// self-referencing PARENT_ID identifies a parent even after its replies are deleted.
+const channelTimelineCondition = " AND ((CH.TYPE_ID=0 AND (CH.THREAD_ONLY=FALSE OR CH.THREAD_ONLY IS NULL)) OR (CH.TYPE_ID=1 AND T.PARENT_ID=T.ID))"
 
 func (r messageRepository) Count(ctx context.Context, conn sqlx.QueryerContext, channelID string) (int64, error) {
 	return r.countTypeWhere(
 		ctx,
 		conn,
 		queryParams{
-			Where: "T.CHANNEL_ID = ?" + threadOnlyCondition,
+			Where: "T.CHANNEL_ID = ?" + channelTimelineCondition,
 			Binds: []any{channelID}},
 		chunk.CMessages, chunk.CThreadMessages,
 	)
@@ -185,7 +188,7 @@ func (r messageRepository) AllForID(ctx context.Context, conn sqlx.QueryerContex
 		ctx,
 		conn,
 		queryParams{
-			Where:        "T.CHANNEL_ID = ?" + threadOnlyCondition,
+			Where:        "T.CHANNEL_ID = ?" + channelTimelineCondition,
 			Binds:        []any{channelID},
 			UserKeyOrder: true,
 		},
```

**File**: `internal/chunk/backend/dbase/repository/dbmessage_test.go` (modified, +168/-46)
```diff
@@ -340,7 +340,7 @@ func Test_messageRepository_Count(t *testing.T) {
 			wantErr: false,
 		},
 		{
-			name: "counts the thread only too",
+			name: "counts parents from thread-only chunks too",
 			fields: fields{
 				genericRepository: genericRepository[DBMessage]{DBMessage{}},
 			},
@@ -353,6 +353,34 @@ func Test_messageRepository_Count(t *testing.T) {
 			want:    1,
 			wantErr: false,
 		},
+		{
+			name: "counts parents from non-thread-only chunks too",
+			fields: fields{
+				genericRepository: genericRepository[DBMessage]{DBMessage{}},
+			},
+			args: args{
+				ctx:       t.Context(),
+				conn:      testConn(t),
+				channelID: testChannelID,
+			},
+			prepFn:  nonThreadOnlyThreadFn,
+			want:    1,
+			wantErr: false,
+		},
+		{
+			name: "counts empty thread parents",
+			fields: fields{
+				genericRepository: genericRepository[DBMessage]{DBMessage{}},
+			},
+			args: args{
+				ctx:       t.Context(),
+				conn:      testConn(t),
+				channelID: testChannelID,
+			},
+			prepFn:  emptyThreadParentFn,
+			want:    2,
+			wantErr: false,
+		},
 	}
 	for _, tt := range tests {
 		t.Run(tt.name, func(t *testing.T) {
@@ -392,7 +420,7 @@ func Test_messageRepository_AllForID(t *testing.T) {
 		wantErr bool
 	}{
 		{
-			name: "Get only channel messages for C123 (no thread, and only latest version of the message)",
+			name: "gets channel messages and the latest thread parent",
 			fields: fields{
 				genericRepository: genericRepository[DBMessage]{DBMessage{}},
 			},
@@ -405,7 +433,50 @@ func Test_messageRepository_AllForID(t *testing.T) {
 			want: []testutil.TestResult[DBMessage]{
 				{V: *dbmA},
 				{V: *dbmB_},
-				{V: *dbmC},
+				{V: *dbmCt0},
+			},
+			wantErr: false,
+		},
+		{
+			name: "on non-thread-only chunks, returns the parent in the channel timeline",
+			fields: fields{
+				genericRepository: genericRepository[DBMessage]{DBMessage{}},
+			},
+			args: args{
+				ctx:       t.Context(),
+				conn:      testConn(t),
+				channelID: testChannelID,
+			},
+			prepFn: nonThreadOnlyThreadFn,
+			want: []testutil.TestResult[DBMessage]{
+				{V: *must(NewDBMessage(3, 0, testChannelID, &slack.Message{Msg: slack.Msg{Timestamp: testThreadID, ThreadTimestamp: testThreadID, Text: "A"}}))},
+			},
+			wantErr: false,
+		},
+		{
+			name: "returns the newest parent after all replies are deleted",
+			fields: fields{
+				genericRepository: genericRepository[DBMessage]{DBMessage{}},
+			},
+			args: args{
+				ctx:       t.Context(),
+				conn:      testConn(t),
+				channelID: testChannelID,
+			},
+			prepFn: emptyThreadParentFn,
+			want: []testutil.TestResult[DBMessage]{
+				{V: *must(NewDBMessage(2, 0, testChannelID, &slack.Message{Msg: slack.Msg{
+					Timestamp:       testThreadID,
+					ThreadTimestamp: testThreadID,
+					LatestReply:     structures.LatestReplyNoReplies,
+					Text:            "new",
+				}}))},
+				{V: *must(NewDBMessage(2, 1, testChannelID, &slack.Message{Msg: slack.Msg{
+					Timestamp:       "124.456",
+					ThreadTimestamp: "124.456",
+					LatestReply:     structures.LatestReplyNoReplies,
+					Text:            "only",
+				}}))},
 			},
 			wantErr: false,
 		},
@@ -1132,65 +1203,116 @@ func Test_messageRepository_Sorted(t *testing.T) {
 }
 
 var (
-	// Thread only setup functions
-	finishedThreadFn = func(t *testing.T, conn PrepareExtContext) {
-		// for thread only entity list items there are no CMessage chunks, only CThreadMessages
-		// and these chunks have threadOnly = true
-		//
-		// Sample setup:
-		//
-		// Thread: 123.456
-		// 1. There are three chunks, 2 non-final and last one is final.
-		// 2. Each chunk will have 2 messages, one is a thread message and the other is a thread lead,
-		//    because API always returns the thread lead with the thread messages.
+	// Thread-only and non-thread-only setup functions.
+	finishedThreadFn      = threadChunkFn(true)
+	nonThreadOnlyThreadFn = threadChunkFn(false)
+
+	threadChunkFn = func(threadOnly bool) utilityFn {
```

---

### Incident Patch 5: `3098a66c` (2026-09-03)
**Commit Message**: fix: retain empty thread parents in timelines

**File**: `internal/chunk/backend/dbase/repository/dbmessage.go` (modified, +3/-4)
```diff
@@ -168,10 +168,9 @@ func NewMessageRepository() MessageRepository {
 }
 
 // channelTimelineCondition keeps thread replies out of a channel timeline while
-// retaining thread parents.  A resume that explicitly rechecks a thread stores
-// its result in a CThreadMessages chunk with ThreadOnly=false, so that parent
-// must be included as well as parents from thread-only chunks.
-const channelTimelineCondition = " AND ((CH.TYPE_ID=0 AND (CH.THREAD_ONLY=FALSE OR CH.THREAD_ONLY IS NULL)) OR (CH.TYPE_ID=1 AND T.IS_PARENT=TRUE))"
+// retaining parents from both thread-only and non-thread-only chunks. A
+// self-referencing PARENT_ID identifies a parent even after its replies are deleted.
+const channelTimelineCondition = " AND ((CH.TYPE_ID=0 AND (CH.THREAD_ONLY=FALSE OR CH.THREAD_ONLY IS NULL)) OR (CH.TYPE_ID=1 AND T.PARENT_ID=T.ID))"
 
 func (r messageRepository) Count(ctx context.Context, conn sqlx.QueryerContext, channelID string) (int64, error) {
 	return r.countTypeWhere(
```

**File**: `internal/chunk/backend/dbase/repository/dbmessage_test.go` (modified, +97/-10)
```diff
@@ -354,7 +354,7 @@ func Test_messageRepository_Count(t *testing.T) {
 			wantErr: false,
 		},
 		{
-			name: "counts parents from resumed thread chunks too",
+			name: "counts parents from non-thread-only chunks too",
 			fields: fields{
 				genericRepository: genericRepository[DBMessage]{DBMessage{}},
 			},
@@ -363,10 +363,24 @@ func Test_messageRepository_Count(t *testing.T) {
 				conn:      testConn(t),
 				channelID: testChannelID,
 			},
-			prepFn:  resumedThreadFn,
+			prepFn:  nonThreadOnlyThreadFn,
 			want:    1,
 			wantErr: false,
 		},
+		{
+			name: "counts empty thread parents",
+			fields: fields{
+				genericRepository: genericRepository[DBMessage]{DBMessage{}},
+			},
+			args: args{
+				ctx:       t.Context(),
+				conn:      testConn(t),
+				channelID: testChannelID,
+			},
+			prepFn:  emptyThreadParentFn,
+			want:    2,
+			wantErr: false,
+		},
 	}
 	for _, tt := range tests {
 		t.Run(tt.name, func(t *testing.T) {
@@ -424,7 +438,7 @@ func Test_messageRepository_AllForID(t *testing.T) {
 			wantErr: false,
 		},
 		{
-			name: "on resumed threads, returns the parent in the channel timeline",
+			name: "on non-thread-only chunks, returns the parent in the channel timeline",
 			fields: fields{
 				genericRepository: genericRepository[DBMessage]{DBMessage{}},
 			},
@@ -433,12 +447,39 @@ func Test_messageRepository_AllForID(t *testing.T) {
 				conn:      testConn(t),
 				channelID: testChannelID,
 			},
-			prepFn: resumedThreadFn,
+			prepFn: nonThreadOnlyThreadFn,
 			want: []testutil.TestResult[DBMessage]{
 				{V: *must(NewDBMessage(3, 0, testChannelID, &slack.Message{Msg: slack.Msg{Timestamp: testThreadID, ThreadTimestamp: testThreadID, Text: "A"}}))},
 			},
 			wantErr: false,
 		},
+		{
+			name: "returns the newest parent after all replies are deleted",
+			fields: fields{
+				genericRepository: genericRepository[DBMessage]{DBMessage{}},
+			},
+			args: args{
+				ctx:       t.Context(),
+				conn:      testConn(t),
+				channelID: testChannelID,
+			},
+			prepFn: emptyThreadParentFn,
+			want: []testutil.TestResult[DBMessage]{
+				{V: *must(NewDBMessage(2, 0, testChannelID, &slack.Message{Msg: slack.Msg{
+					Timestamp:       testThreadID,
+					ThreadTimestamp: testThreadID,
+					LatestReply:     structures.LatestReplyNoReplies,
+					Text:            "new",
+				}}))},
+				{V: *must(NewDBMessage(2, 1, testChannelID, &slack.Message{Msg: slack.Msg{
+					Timestamp:       "124.456",
+					ThreadTimestamp: "124.456",
+					LatestReply:     structures.LatestReplyNoReplies,
+					Text:            "only",
+				}}))},
+			},
+			wantErr: false,
+		},
 		{
 			name: "on thread-only archives, returns the channel messages (by getting parents)",
 			fields: fields{
@@ -1162,15 +1203,12 @@ func Test_messageRepository_Sorted(t *testing.T) {
 }
 
 var (
-	// Thread-only and direct-resume thread setup functions.
-	finishedThreadFn = threadChunkFn(true)
-	resumedThreadFn  = threadChunkFn(false)
+	// Thread-only and non-thread-only setup functions.
+	finishedThreadFn      = threadChunkFn(true)
+	nonThreadOnlyThreadFn = threadChunkFn(false)
 
 	threadChunkFn = func(threadOnly bool) utilityFn {
 		return func(t *testing.T, conn PrepareExtContext) {
-			// for thread only entity list items there are no CMessage chunks, only CThreadMessages
-			// and these chunks have threadOnly = true
-			//
 			// Sample setup:
 			//
 			// Thread: 123.456
@@ -1229,6 +1267,55 @@ var (
 		}
 	}
 
+	emptyThreadParentFn = func(t *testing.T, conn PrepareExtContext) {
+		ctx := t.Context()
+		var sr sessionRepository
+		sess, err := sr.Insert(ctx, conn, &Session{ID: 1, Finished: true})
+		if err != nil {
+			t.Fatalf("insert session: %v", err)
+		}
+
+		threadOnly := false
+		chunks := [...]DBChunk{
+			{TypeID: chunk.CMessages, ChannelID: &testChannelID, SessionID: sess, Final: true},
+			{TypeID: chunk.CThreadMessages, ChannelID: &testChannelID, SessionID: sess, Final: true, ThreadOnly: &threadOnly},
+		}
+		var 
```

---

### Incident Patch 6: `1588d430` (2026-08-25)
**Commit Message**: fix: show refreshed thread parents in channel timeline

**File**: `internal/chunk/backend/dbase/repository/dbmessage.go` (modified, +7/-3)
```diff
@@ -167,14 +167,18 @@ func NewMessageRepository() MessageRepository {
 	return messageRepository{newGenericRepository(DBMessage{})}
 }
 
-const threadOnlyCondition = " AND ((CH.TYPE_ID=0 AND (CH.THREAD_ONLY=FALSE OR CH.THREAD_ONLY IS NULL)) OR (CH.TYPE_ID=1 AND CH.THREAD_ONLY=TRUE AND T.IS_PARENT=TRUE))"
+// channelTimelineCondition keeps thread replies out of a channel timeline while
+// retaining thread parents.  A resume that explicitly rechecks a thread stores
+// its result in a CThreadMessages chunk with ThreadOnly=false, so that parent
+// must be included as well as parents from thread-only chunks.
+const channelTimelineCondition = " AND ((CH.TYPE_ID=0 AND (CH.THREAD_ONLY=FALSE OR CH.THREAD_ONLY IS NULL)) OR (CH.TYPE_ID=1 AND T.IS_PARENT=TRUE))"
 
 func (r messageRepository) Count(ctx context.Context, conn sqlx.QueryerContext, channelID string) (int64, error) {
 	return r.countTypeWhere(
 		ctx,
 		conn,
 		queryParams{
-			Where: "T.CHANNEL_ID = ?" + threadOnlyCondition,
+			Where: "T.CHANNEL_ID = ?" + channelTimelineCondition,
 			Binds: []any{channelID}},
 		chunk.CMessages, chunk.CThreadMessages,
 	)
@@ -185,7 +189,7 @@ func (r messageRepository) AllForID(ctx context.Context, conn sqlx.QueryerContex
 		ctx,
 		conn,
 		queryParams{
-			Where:        "T.CHANNEL_ID = ?" + threadOnlyCondition,
+			Where:        "T.CHANNEL_ID = ?" + channelTimelineCondition,
 			Binds:        []any{channelID},
 			UserKeyOrder: true,
 		},
```

**File**: `internal/chunk/backend/dbase/repository/dbmessage_test.go` (modified, +91/-56)
```diff
@@ -340,7 +340,7 @@ func Test_messageRepository_Count(t *testing.T) {
 			wantErr: false,
 		},
 		{
-			name: "counts the thread only too",
+			name: "counts parents from thread-only chunks too",
 			fields: fields{
 				genericRepository: genericRepository[DBMessage]{DBMessage{}},
 			},
@@ -353,6 +353,20 @@ func Test_messageRepository_Count(t *testing.T) {
 			want:    1,
 			wantErr: false,
 		},
+		{
+			name: "counts parents from resumed thread chunks too",
+			fields: fields{
+				genericRepository: genericRepository[DBMessage]{DBMessage{}},
+			},
+			args: args{
+				ctx:       t.Context(),
+				conn:      testConn(t),
+				channelID: testChannelID,
+			},
+			prepFn:  resumedThreadFn,
+			want:    1,
+			wantErr: false,
+		},
 	}
 	for _, tt := range tests {
 		t.Run(tt.name, func(t *testing.T) {
@@ -392,7 +406,7 @@ func Test_messageRepository_AllForID(t *testing.T) {
 		wantErr bool
 	}{
 		{
-			name: "Get only channel messages for C123 (no thread, and only latest version of the message)",
+			name: "gets channel messages and the latest thread parent",
 			fields: fields{
 				genericRepository: genericRepository[DBMessage]{DBMessage{}},
 			},
@@ -405,7 +419,23 @@ func Test_messageRepository_AllForID(t *testing.T) {
 			want: []testutil.TestResult[DBMessage]{
 				{V: *dbmA},
 				{V: *dbmB_},
-				{V: *dbmC},
+				{V: *dbmCt0},
+			},
+			wantErr: false,
+		},
+		{
+			name: "on resumed threads, returns the parent in the channel timeline",
+			fields: fields{
+				genericRepository: genericRepository[DBMessage]{DBMessage{}},
+			},
+			args: args{
+				ctx:       t.Context(),
+				conn:      testConn(t),
+				channelID: testChannelID,
+			},
+			prepFn: resumedThreadFn,
+			want: []testutil.TestResult[DBMessage]{
+				{V: *must(NewDBMessage(3, 0, testChannelID, &slack.Message{Msg: slack.Msg{Timestamp: testThreadID, ThreadTimestamp: testThreadID, Text: "A"}}))},
 			},
 			wantErr: false,
 		},
@@ -1132,64 +1162,69 @@ func Test_messageRepository_Sorted(t *testing.T) {
 }
 
 var (
-	// Thread only setup functions
-	finishedThreadFn = func(t *testing.T, conn PrepareExtContext) {
-		// for thread only entity list items there are no CMessage chunks, only CThreadMessages
-		// and these chunks have threadOnly = true
-		//
-		// Sample setup:
-		//
-		// Thread: 123.456
-		// 1. There are three chunks, 2 non-final and last one is final.
-		// 2. Each chunk will have 2 messages, one is a thread message and the other is a thread lead,
-		//    because API always returns the thread lead with the thread messages.
-		ctx := t.Context()
-		var sr sessionRepository
-		sess, err := sr.Insert(ctx, conn, &Session{ID: 1, Finished: true})
-		if err != nil {
-			t.Fatalf("insert session: %v", err)
-		}
+	// Thread-only and direct-resume thread setup functions.
+	finishedThreadFn = threadChunkFn(true)
+	resumedThreadFn  = threadChunkFn(false)
 
-		var bTrue = true
-		// prepare and insert chunks
-		chunks := [...]DBChunk{
-			{ID: 1, TypeID: chunk.CThreadMessages, ChannelID: &testChannelID, SessionID: sess, Final: false, ThreadOnly: &bTrue},
-			{ID: 2, TypeID: chunk.CThreadMessages, ChannelID: &testChannelID, SessionID: sess, Final: false, ThreadOnly: &bTrue},
-			{ID: 3, TypeID: chunk.CThreadMessages, ChannelID: &testChannelID, SessionID: sess, Final: true, ThreadOnly: &bTrue},
-		}
-		var cr chunkRepository
-		for _, chunk := range chunks {
-			if _, err := cr.Insert(ctx, conn, &chunk); err != nil {
-				t.Fatalf("insert chunk: %v", err)
+	threadChunkFn = func(threadOnly bool) utilityFn {
+		return func(t *testing.T, conn PrepareExtContext) {
+			// for thread only entity list items there are no CMessage chunks, only CThreadMessages
+			// and these chunks have threadOnly = true
+			//
+			// Sample setup:
+			//
+			// Thread: 123.456
+			// 1. There are three chunks, 2 non-final and last one is final.
+			// 2. Each chunk will have 2 messages, one is a thread message and the other is a thread lead,
+			//    because API always r
```

---

### Incident Patch 7: `5ae8c664` (2026-08-19)
**Commit Message**: fix workspace existence check (bump slackauth)

**File**: `go.mod` (modified, +5/-5)
```diff
@@ -34,7 +34,7 @@ require (
 	github.com/rusq/osenv/v2 v2.0.1
 	github.com/rusq/rbubbles v0.0.2
 	github.com/rusq/slack v0.9.6-0.20260726043947-8f5f9f4472b0
-	github.com/rusq/slackauth v0.7.1
+	github.com/rusq/slackauth v0.7.2
 	github.com/rusq/tagops v0.1.1
 	github.com/schollz/progressbar/v3 v3.19.1
 	github.com/sosodev/duration v1.4.0
@@ -44,7 +44,7 @@ require (
 	go.uber.org/mock v0.6.0
 	golang.org/x/sync v0.22.0
 	golang.org/x/term v0.45.0
-	golang.org/x/text v0.40.0
+	golang.org/x/text v0.41.0
 	golang.org/x/time v0.15.0
 	modernc.org/sqlite v1.54.0
 	src.elv.sh v0.21.0
@@ -78,7 +78,7 @@ require (
 	github.com/google/jsonschema-go v0.4.3 // indirect
 	github.com/gookit/color v1.6.1 // indirect
 	github.com/gorilla/websocket v1.5.3 // indirect
-	github.com/klauspost/compress v1.19.1 // indirect
+	github.com/klauspost/compress v1.19.2 // indirect
 	github.com/leodido/go-urn v1.5.0 // indirect
 	github.com/lithammer/fuzzysearch v1.1.8 // indirect
 	github.com/lucasb-eyer/go-colorful v1.4.0 // indirect
@@ -109,9 +109,9 @@ require (
 	github.com/ysmood/leakless v0.9.0 // indirect
 	go.mongodb.org/mongo-driver v1.17.9 // indirect
 	go.uber.org/multierr v1.11.0 // indirect
-	golang.org/x/crypto v0.54.0 // indirect
+	golang.org/x/crypto v0.55.0 // indirect
 	golang.org/x/mod v0.38.0 // indirect
-	golang.org/x/net v0.57.0 // indirect
+	golang.org/x/net v0.58.0 // indirect
 	golang.org/x/sys v0.47.0 // indirect
 	golang.org/x/tools v0.48.0 // indirect
 	golang.org/x/xerrors v0.0.0-20240903120638-7835f813f4da // indirect
```

**File**: `go.sum` (modified, +10/-10)
```diff
@@ -136,8 +136,8 @@ github.com/jmoiron/sqlx v1.4.0 h1:1PLqN7S1UYp5t4SrVVnt4nUVNemrDAtxlulVe+Qgm3o=
 github.com/jmoiron/sqlx v1.4.0/go.mod h1:ZrZ7UsYB/weZdl2Bxg6jCRO9c3YHl8r3ahlKmRT4JLY=
 github.com/joho/godotenv v1.5.1 h1:7eLL/+HRGLY0ldzfGMeQkb7vMd0as4CfYvUVzLqw0N0=
 github.com/joho/godotenv v1.5.1/go.mod h1:f4LDr5Voq0i2e/R5DDNOoa2zzDfwtkZa6DnEwAbqwq4=
-github.com/klauspost/compress v1.19.1 h1:VsB4HPswih7mmZ8WleSFQ75c/Ui1M4trX5oAsJnhSlk=
-github.com/klauspost/compress v1.19.1/go.mod h1:cwPg85FWrGar70rWktvGQj8/hthj3wpl0PGDogxkrSQ=
+github.com/klauspost/compress v1.19.2 h1:hMRETovs/pu/dVWN7zIT1PGG8t509MwT6bO7XSi26R8=
+github.com/klauspost/compress v1.19.2/go.mod h1:cwPg85FWrGar70rWktvGQj8/hthj3wpl0PGDogxkrSQ=
 github.com/klauspost/cpuid/v2 v2.3.0 h1:S4CRMLnYUhGeDFDqkGriYKdfoFlDnMtqTiI/sFzhA9Y=
 github.com/klauspost/cpuid/v2 v2.3.0/go.mod h1:hqwkgyIinND0mEev00jJYCxPNVRVXFQeu1XKlok6oO0=
 github.com/kr/pretty v0.3.1 h1:flRD4NNwYAUpkphVc1HcthR4KEIFJ65n8Mw5qdRn3LE=
@@ -210,8 +210,8 @@ github.com/rusq/secure v0.1.1 h1:dDqkFv3ES1Y/JdPSl7vu1ONIv44LiJVGchaYEns38bA=
 github.com/rusq/secure v0.1.1/go.mod h1:SVqDbGmXRLOTTVGtJMeNFEQyZKMwy9ADyj26Ts6Uq7Y=
 github.com/rusq/slack v0.9.6-0.20260726043947-8f5f9f4472b0 h1:7RWTPvOTr6OEt3IxBrsFzEKxucPYnhGXkNMA06K5EQs=
 github.com/rusq/slack v0.9.6-0.20260726043947-8f5f9f4472b0/go.mod h1:LJanCMocM49kfdAmNboZXJFYQbwu1lPb9eZ6eYpG3PM=
-github.com/rusq/slackauth v0.7.1 h1:D4peflZtHSyQFh5pLeBI8n0f12enuA9D25mA0KaHo8o=
-github.com/rusq/slackauth v0.7.1/go.mod h1:UOqfnUaJeygO9rYShAhsLxAZjbbEBNaLZpsdw03W3R0=
+github.com/rusq/slackauth v0.7.2 h1:b5+W9hLjRpeuwAZfBMfspnjlEvEdjH/niWBTz1BTEhw=
+github.com/rusq/slackauth v0.7.2/go.mod h1:W9mRc0WhYmN06VpbNEmZMcLcqGQpM/SobixdbJyrh5w=
 github.com/rusq/tagops v0.1.1 h1:R5MHPR822lSg3LFr0RS3DFS0CapRiqtuHVD5NlOMOvY=
 github.com/rusq/tagops v0.1.1/go.mod h1:mUJ5WoHxrSv9wreCrHQkAeMevt5aXFadlOdLM6UsoHc=
 github.com/santhosh-tekuri/jsonschema/v6 v6.0.2 h1:KRzFb2m7YtdldCEkzs6KqmJw4nqEVZGK7IN2kJkjTuQ=
@@ -264,8 +264,8 @@ go.uber.org/multierr v1.11.0/go.mod h1:20+QtiLqy0Nd6FdQB9TLXag12DsQkrbs3htMFfDN8
 golang.org/x/crypto v0.0.0-20190308221718-c2843e01d9a2/go.mod h1:djNgcEr1/C05ACkg1iLfiJU5Ep61QUkGW8qpdssI0+w=
 golang.org/x/crypto v0.0.0-20210921155107-089bfa567519/go.mod h1:GvvjBRRGRdwPK5ydBHafDWAxML/pGHZbMvKqRZ5+Abc=
 golang.org/x/crypto v0.19.0/go.mod h1:Iy9bg/ha4yyC70EfRS8jz+B6ybOBKMaSxLj6P6oBDfU=
-golang.org/x/crypto v0.54.0 h1:YLIA59K4fiNzHzjnZt2tUJQjQtUWfWbeHBqKtk3eScw=
-golang.org/x/crypto v0.54.0/go.mod h1:KWL8ny2AZdGR2cWmzeHrp2azQPGogOv+HeQaVEXC2dk=
+golang.org/x/crypto v0.55.0 h1:+KWHjbgOaAQ66dh/YlkZKHlz9ZUlq61AFirAR9ntP8M=
+golang.org/x/crypto v0.55.0/go.mod h1:uq0V9dE/fzQuJtbnL+2EhWOE63vo164FY8xqEnV9xis=
 golang.org/x/exp v0.0.0-20260718201538-764159d718ef h1:LkZ48HFgy/TvhTI0bcWkjgFkgLyKUwcTbDjS0DUjw+A=
 golang.org/x/exp v0.0.0-20260718201538-764159d718ef/go.mod h1:EdfpwwqSu+0Li0mzskwHU6FWDV3t9Q+RZDo3QMUtL3Q=
 golang.org/x/mod v0.6.0-dev.0.20220419223038-86c51ed26bb4/go.mod h1:jJ57K6gSWd91VN4djpZkiMVwK6gcyfeH4XE8wZrZaV4=
@@ -277,8 +277,8 @@ golang.org/x/net v0.0.0-20210226172049-e18ecbb05110/go.mod h1:m0MpNAwzfU5UDzcl9v
 golang.org/x/net v0.0.0-20220722155237-a158d28d115b/go.mod h1:XRhObCWvk6IyKnWLug+ECip1KBveYUHfp+8e9klMJ9c=
 golang.org/x/net v0.6.0/go.mod h1:2Tu9+aMcznHK/AK1HMvgo6xiTLG5rD5rZLDS+rp2Bjs=
 golang.org/x/net v0.10.0/go.mod h1:0qNGK6F8kojg2nk9dLZ2mShWaEBan6FAoqfSigmmuDg=
-golang.org/x/net v0.57.0 h1:K5+3DljvIuDG9/Jv9rvyMywYNFCQ9RSUY6OOTTkT+tE=
-golang.org/x/net v0.57.0/go.mod h1:KpXc8iv+r3XplLAG/f7Jsf9RPszJzdR0f58q9vGOuEU=
+golang.org/x/net v0.58.0 h1:ynWG7rqYi4ccpTEuPZ2QGWHktVEM9DMCj9yzDE0Q7To=
+golang.org/x/net v0.58.0/go.mod h1:YwCddHnFlT7eLQqVprV19OnhLGtc5xOKgE0RyqgfWAU=
 golang.org/x/sync v0.0.0-20190423024810-112230192c58/go.mod h1:RxMgew5VJxzue5/jJTE5uejpjVlOe/izrB70Jof72aM=
 golang.org/x/sync v0.0.0-20220722155255-886fb9371eb4/go.mod h1:RxMgew5VJxzue5/jJTE5uejpjVlOe/izrB70Jof72aM=
 golang.org/x/sync v0.1.0/go.mod h1:RxMgew5VJxzue5/jJTE5uejpjVlOe/
```

---

### Incident Patch 8: `afe8d269` (2026-08-12)
**Commit Message**: Fix conversation pipeline shutdown deadlock (#720)

* additional error logging

* fix streaming hup

* extract coversation pipeline into a separate func

* move consts closer to where they are being used

* prevent user duplication in the channelusers

* add a test

* facepalm: finish the sentence

* Apply suggestions from code review

Co-authored-by: Copilot Autofix powered by AI <175728472+Copilot@users.noreply.github.com>

---------

Co-authored-by: Copilot Autofix powered by AI <175728472+Copilot@users.noreply.github.com>

**File**: `internal/chunk/control/runner.go` (modified, +29/-9)
```diff
@@ -159,16 +159,36 @@ func runWorkers(ctx context.Context, s Streamer, list *structures.EntityList, p
 	{ // conversations goroutine
 		wg.Go(func() {
 			defer lg.DebugContext(ctx, "conversations done")
-
-			defer func() {
-				tryClose(errC, p.Conversations)
-			}()
 			gen := newGenerator(s, p, flags, list)
-			listC, wait := gen.Generate(ctx, errC, list)
-			defer wait() // sync with the generator
-			if err := conversationWorker(ctx, s, p.Conversations, listC); err != nil {
-				errC <- Error{"conversations", StgWorker, err}
-				return
+			genErrC := make(chan error)
+			var genErrs []error
+			genErrDone := make(chan struct{})
+			go func() {
+				defer close(genErrDone)
+				for err := range genErrC {
+					genErrs = append(genErrs, err)
+				}
+			}()
+
+			convCtx, cancel := context.WithCancel(ctx)
+			listC, wait := gen.Generate(convCtx, genErrC, list)
+			convErr := conversationWorker(convCtx, s, p.Conversations, listC)
+			cancel()
+
+			wait()
+			close(genErrC)
+			<-genErrDone
+
+			tryClose(errC, p.Conversations)
+
+			if convErr != nil {
+				errC <- Error{"conversations", StgWorker, convErr}
+			}
+			for _, genErr := range genErrs {
+				if convErr != nil && errors.Is(genErr, context.Canceled) {
+					continue
+				}
+				errC <- genErr
 			}
 		})
 	}
```

**File**: `internal/chunk/control/runner_test.go` (modified, +46/-0)
```diff
@@ -17,8 +17,10 @@ package control
 
 import (
 	"context"
+	"errors"
 	"reflect"
 	"sort"
+	"strings"
 	"testing"
 	"time"
 
@@ -708,6 +710,50 @@ func Test_runWorkers(t *testing.T) {
 			}
 		})
 	}
+
+	t.Run("conversation failure cancels blocked API generator", func(t *testing.T) {
+		ctrl := gomock.NewController(t)
+		s := mock_control.NewMockStreamer(ctrl)
+		conversations := mock_processor.NewMockConversations(ctrl)
+		users := mock_processor.NewMockUsers(ctrl)
+		channels := mock_processor.NewMockChannels(ctrl)
+		workspace := mock_processor.NewMockWorkspaceInfo(ctrl)
+		conversationErr := errors.New("conversation failed")
+
+		s.EXPECT().WorkspaceInfo(gomock.Any(), workspace).Return(nil)
+		s.EXPECT().Users(gomock.Any(), users, gomock.Any()).Return(nil)
+		s.EXPECT().ListChannelsEx(gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any()).DoAndReturn(
+			func(ctx context.Context, proc processor.Channels, _ *slack.GetConversationsParameters, _ bool) error {
+				return proc.Channels(ctx, []slack.Channel{
+					{GroupConversation: slack.GroupConversation{Conversation: slack.Conversation{ID: "C1"}}},
+					{GroupConversation: slack.GroupConversation{Conversation: slack.Conversation{ID: "C2"}}},
+				})
+			})
+		s.EXPECT().Conversations(gomock.Any(), conversations, gomock.Any()).DoAndReturn(
+			func(_ context.Context, _ processor.Conversations, links <-chan structures.EntityItem) error {
+				<-links
+				return conversationErr
+			})
+		conversations.EXPECT().Close().Return(nil).Times(1)
+
+		done := make(chan error, 1)
+		go func() {
+			done <- runWorkers(t.Context(), s, structures.NewEntityListFromItems(), superprocessor{
+				Conversations: conversations,
+				Users:         users,
+				Channels:      channels,
+				WorkspaceInfo: workspace,
+			}, Flags{})
+		}()
+
+		select {
+		case err := <-done:
+			assert.ErrorIs(t, err, conversationErr)
+			assert.NotContains(t, strings.ToLower(err.Error()), "api channel generator")
+		case <-time.After(time.Second):
+			t.Fatal("runWorkers remained blocked waiting for the API generator")
+		}
+	})
 }
 
 func Test_runSearch(t *testing.T) {
```

**File**: `stream/conversation.go` (modified, +156/-64)
```diff
@@ -21,6 +21,7 @@ import (
 	"fmt"
 	"log/slog"
 	"runtime/trace"
+	"slices"
 	"sync"
 	"time"
 
@@ -32,6 +33,21 @@ import (
 	"github.com/rusq/slackdump/v4/processor"
 )
 
+const (
+	// message channel buffer size.  Messages are much faster than threads, so
+	// we can have a smaller buffer.
+	msgChanSz = 16
+	// thread channel buffer size.  Threads are much slower than channels,
+	// because each message might have a thread, and that means, that we'll
+	// have to send a thread request for each message.  So, we need a larger
+	// buffer for it not to block the channel messages scraping.  Value is
+	// chosen to be large enough.
+	threadChanSz = 4000
+	// result channel buffer size.  We are running 2 goroutines, 1 for channel
+	// messages, and 1 for threads.
+	resultSz = 2
+)
+
 // SyncConversations fetches the conversations from the link which can be a
 // channelID, channel URL, thread URL or a link in Slackdump format.
 func (cs *Stream) SyncConversations(ctx context.Context, proc processor.Conversations, items ...structures.EntityItem) error {
@@ -48,24 +64,43 @@ func (cs *Stream) ConversationsCB(ctx context.Context, proc processor.Conversati
 
 	lg := slog.With("links", items)
 	cs.resultFn = append(cs.resultFn, cb)
+	return runConversationItems(ctx, items, produceItems, func(ctx context.Context, itemC <-chan structures.EntityItem) error {
+		err := cs.Conversations(ctx, proc, itemC)
+		lg.DebugContext(ctx, "stream: item consumer stopped", "len", len(items))
+		return err
+	})
+}
 
+func runConversationItems(
+	ctx context.Context,
+	items []structures.EntityItem,
+	produce func(context.Context, chan<- structures.EntityItem, []structures.EntityItem),
+	consume func(context.Context, <-chan structures.EntityItem) error,
+) error {
+	ctx, cancel := context.WithCancel(ctx)
 	itemC := make(chan structures.EntityItem, 1)
+	producerDone := make(chan struct{})
 	go func() {
-		defer close(itemC)
-		for _, l := range items {
-			select {
-			case itemC <- l:
-			case <-ctx.Done():
-				return
-			}
-		}
-		lg.DebugContext(ctx, "stream: sent link count", "len", len(items))
+		defer close(producerDone)
+		produce(ctx, itemC, items)
+	}()
+	defer func() {
+		cancel()
+		<-producerDone
 	}()
 
-	if err := cs.Conversations(ctx, proc, itemC); err != nil {
-		return err
+	return consume(ctx, itemC)
+}
+
+func produceItems(ctx context.Context, output chan<- structures.EntityItem, items []structures.EntityItem) {
+	defer close(output)
+	for _, item := range items {
+		select {
+		case output <- item:
+		case <-ctx.Done():
+			return
+		}
 	}
-	return nil
 }
 
 // Conversations fetches the conversations from the links channel.  The link
@@ -81,79 +116,114 @@ func (cs *Stream) ConversationsCB(ctx context.Context, proc processor.Conversati
 func (cs *Stream) Conversations(ctx context.Context, proc processor.Conversations, items <-chan structures.EntityItem) error {
 	ctx, task := trace.NewTask(ctx, "AsyncConversations")
 	defer task.End()
+	ctx, cancel := context.WithCancel(ctx)
+	defer cancel()
+
+	// Retain the first fatal error, cancel all producers immediately, and keep
+	// draining results until every producer and worker has stopped.
+	var fatalErr error
+	for res := range cs.startConversationPipeline(ctx, proc, items) {
+		if fatalErr != nil {
+			continue
+		}
+		if err := res.Err; err != nil {
+			trace.Logf(ctx, "error", "type: %s, chan_id: %s, thread_ts: %s, error: %s", res.Type, res.ChannelID, res.ThreadTS, err.Error())
+			if (errors.Is(err, errChanNotFound) || errors.Is(err, errNotInChannel)) && !cs.failChnlNotFnd {
+				slog.WarnContext(ctx, "channel not found or user not in channel, skipping", "channel_id", res.ChannelID)
+				continue
+			}
+			slog.ErrorContext(ctx, "streaming error", "error", res.Err, "type", res.Type, "channel_id", res.ChannelID, "thread_ts", res.ThreadTS)
+			if cause := context.Cause(ctx); cause != nil && errors.Is(err, ctx.Err()) {
+				fatalErr = cause
+			} else {
+				resultErr := res
+				fatalErr
```

**File**: `stream/conversation_test.go` (modified, +283/-0)
```diff
@@ -19,12 +19,16 @@ import (
 	"context"
 	"errors"
 	"testing"
+	"time"
 
 	"github.com/rusq/slack"
 	"github.com/stretchr/testify/assert"
 	"go.uber.org/mock/gomock"
 
+	"github.com/rusq/slackdump/v4/internal/client/mock_client"
 	"github.com/rusq/slackdump/v4/internal/fixtures"
+	"github.com/rusq/slackdump/v4/internal/network"
+	"github.com/rusq/slackdump/v4/internal/structures"
 	"github.com/rusq/slackdump/v4/mocks/mock_processor"
 )
 
@@ -36,6 +40,191 @@ var TestChannel = &slack.Channel{
 	},
 }
 
+func Test_produceItems(t *testing.T) {
+	ctx, cancel := context.WithCancel(t.Context())
+	output := make(chan structures.EntityItem)
+	done := make(chan struct{})
+	go func() {
+		defer close(done)
+		produceItems(ctx, output, []structures.EntityItem{{Id: "C1"}})
+	}()
+
+	cancel()
+	select {
+	case <-done:
+	case <-time.After(time.Second):
+		t.Fatal("produceItems remained blocked after cancellation")
+	}
+}
+
+func Test_runConversationItems(t *testing.T) {
+	consumerErr := errors.New("consumer failed")
+	cancelObserved := make(chan struct{})
+	releaseProducer := make(chan struct{})
+	producerDone := make(chan struct{})
+	producer := func(ctx context.Context, output chan<- structures.EntityItem, _ []structures.EntityItem) {
+		defer close(output)
+		defer close(producerDone)
+		output <- structures.EntityItem{Id: "C1"}
+		<-ctx.Done()
+		close(cancelObserved)
+		<-releaseProducer
+	}
+	consumer := func(_ context.Context, input <-chan structures.EntityItem) error {
+		<-input
+		return consumerErr
+	}
+
+	result := make(chan error, 1)
+	go func() {
+		result <- runConversationItems(t.Context(), nil, producer, consumer)
+	}()
+
+	select {
+	case <-cancelObserved:
+	case <-time.After(time.Second):
+		t.Fatal("producer did not observe consumer cancellation")
+	}
+	select {
+	case err := <-result:
+		t.Fatalf("runConversationItems returned before its producer exited: %v", err)
+	default:
+	}
+	close(releaseProducer)
+	select {
+	case err := <-result:
+		assert.ErrorIs(t, err, consumerErr)
+	case <-time.After(time.Second):
+		t.Fatal("runConversationItems did not return after its producer exited")
+	}
+	select {
+	case <-producerDone:
+	default:
+		t.Fatal("producer was not joined before runConversationItems returned")
+	}
+}
+
+func TestStream_ConversationsCB(t *testing.T) {
+	ctrl := gomock.NewController(t)
+	cs := New(mock_client.NewMockSlack(ctrl), network.NoLimits)
+	proc := mock_processor.NewMockConversations(ctrl)
+	items := make([]structures.EntityItem, 100)
+	items[0] = structures.EntityItem{Id: "not-a-valid-slack-link"}
+	for i := 1; i < len(items); i++ {
+		items[i] = structures.EntityItem{Id: "C12345678"}
+	}
+
+	done := make(chan error, 1)
+	go func() {
+		done <- cs.ConversationsCB(t.Context(), proc, items, func(Result) error { return nil })
+	}()
+	select {
+	case err := <-done:
+		assert.Error(t, err)
+	case <-time.After(time.Second):
+		t.Fatal("ConversationsCB did not return after a fatal item")
+	}
+}
+
+func TestStream_Conversations(t *testing.T) {
+	threadItem := structures.EntityItem{Id: "CTM1:1610000000.000000"}
+	threadChannel := &slack.Channel{GroupConversation: slack.GroupConversation{Conversation: slack.Conversation{ID: "CTM1"}}}
+	threadMessages := []slack.Message{{Msg: slack.Msg{
+		Channel:         "CTM1",
+		Timestamp:       "1610000000.000000",
+		ThreadTimestamp: "1610000000.000000",
+	}}}
+
+	t.Run("fatal thread result cancels queued work", func(t *testing.T) {
+		ctrl := gomock.NewController(t)
+		cl := mock_client.NewMockSlack(ctrl)
+		proc := mock_processor.NewMockConversations(ctrl)
+		cs := New(cl, network.NoLimits)
+		cs.chanCache.set("CTM1", threadChannel)
+		cl.EXPECT().GetConversationRepliesContext(gomock.Any(), gomock.Any()).Return(threadMessages, false, "", nil).AnyTimes()
+		proc.EXPECT().ChannelInfo(gomock.Any(), gomock.Any(), "1610000000.000000").Return(nil).AnyTimes()
+		proc.EXPECT().ThreadMessages(gomock.Any(), "CTM1", gomock.Any(), true, true, threadMessages).Return(assert.AnError)
```

**File**: `stream/stream.go` (modified, +0/-14)
```diff
@@ -33,20 +33,6 @@ import (
 	"github.com/rusq/slackdump/v4/processor"
 )
 
-const (
-	// message channel buffer size.  Messages are much faster than threads, so
-	// we can have a smaller buffer.
-	msgChanSz = 16
-	// thread channel buffer size.  Threads are much slower than channels,
-	// because each message might have a thread, and that means, that we'll
-	// have to send a thread request for each message.  So, we need a larger
-	// buffer for it not to block the channel messages scraping.
-	threadChanSz = 4000
-	// result channel buffer size.  We are running 2 goroutines, 1 for channel
-	// messages, and 1 for threads.
-	resultSz = 2
-)
-
 // Stream is used to fetch conversations from Slack.  It is safe for concurrent
 // use.
 type Stream struct {
```

---

### Incident Patch 9: `84cd6105` (2026-07-26)
**Commit Message**: fix tests after the bump

**File**: `internal/cache/usercache_test.go` (modified, +3/-2)
```diff
@@ -27,6 +27,7 @@ import (
 
 	"github.com/rusq/slackdump/v4/internal/fixtures"
 	"github.com/rusq/slackdump/v4/internal/mocks/mock_os"
+	"github.com/rusq/slackdump/v4/internal/testutil"
 	"github.com/rusq/slackdump/v4/types"
 )
 
@@ -49,7 +50,7 @@ func TestSaveUserCache(t *testing.T) {
 	defer reopenedF.Close()
 	uu, err := read[slack.User](reopenedF)
 	assert.NoError(t, err)
-	assert.Equal(t, testUsers, types.Users(uu))
+	assert.Equal(t, testutil.RoundTripJSON(t, testUsers), types.Users(uu))
 }
 
 func TestLoadUserCache(t *testing.T) {
@@ -67,7 +68,7 @@ func TestLoadUserCache(t *testing.T) {
 		{
 			"loads the cache ok",
 			args{gimmeTempFileWithUsers(t, dir), 5 * time.Hour},
-			testUsers,
+			testutil.RoundTripJSON(t, testUsers),
 			false,
 		},
 		{
```

**File**: `internal/chunk/backend/dbase/repository/dbuser_test.go` (modified, +1/-1)
```diff
@@ -41,7 +41,7 @@ var user1 = &slack.User{
 		DisplayNameNormalized: "",
 		Team:                  "T777",
 	},
-	Has2FA:        true,
+	Has2FA:        new(true),
 	TwoFactorType: new(string),
 	Updated:       1725318212,
 	Enterprise:    slack.EnterpriseUser{},
```

**File**: `internal/chunk/backend/dbase/source_test.go` (modified, +2/-4)
```diff
@@ -525,7 +525,7 @@ func TestSource_Users(t *testing.T) {
 				ctx: t.Context(),
 			},
 			prepFn: prepTestChunk(&chunk.Chunk{Type: chunk.CUsers, Users: fixtures.Load[[]slack.User](fixtures.UsersJSON)}),
-			want:   fixtures.Load[[]slack.User](fixtures.UsersJSON),
+			want:   testutil.RoundTripJSON(t, fixtures.Load[[]slack.User](fixtures.UsersJSON)),
 		},
 	}
 	for _, tt := range tests {
@@ -545,9 +545,7 @@ func TestSource_Users(t *testing.T) {
 			sort.Slice(tt.want, func(i, j int) bool { // users are sorted by ID.
 				return tt.want[i].ID < tt.want[j].ID
 			})
-			if !reflect.DeepEqual(got, tt.want) {
-				t.Errorf("Source.Users() = %v, want %v", got, tt.want)
-			}
+			assert.Equal(t, tt.want, got)
 		})
 	}
 }
```

**File**: `internal/chunk/file_test.go` (modified, +23/-13)
```diff
@@ -26,6 +26,8 @@ import (
 
 	"github.com/rusq/slack"
 	"github.com/stretchr/testify/assert"
+
+	"github.com/rusq/slackdump/v4/internal/testutil"
 )
 
 const (
@@ -396,7 +398,7 @@ func TestFile_AllUsers(t *testing.T) {
 			fields: fields{
 				rs: marshalChunks(append(testUserChunks, testChunks...)...),
 			},
-			want: []slack.User{
+			want: testutil.RoundTripJSON(t, []slack.User{
 				{ID: "U1234567890", Name: "user1"},
 				{ID: "U987654321", Name: "user2"},
 				{ID: "U1234567891", Name: "user3"},
@@ -405,7 +407,7 @@ func TestFile_AllUsers(t *testing.T) {
 				{ID: "U987654323", Name: "user6"},
 				{ID: "U1234567893", Name: "user7"},
 				{ID: "U987654324", Name: "user8"},
-			},
+			}),
 		},
 	}
 	for _, tt := range tests {
@@ -441,16 +443,6 @@ func TestFile_offsetTimestamps(t *testing.T) {
 			fields: fields{
 				rs: marshalChunks(testChunks...),
 			},
-			want: offts{
-				671:  offsetInfo{ID: TestChannelID, TS: 123456, Timestamps: []int64{1234567890100000, 1234567890200000, 1234567890300000, 1234567890400000, 1234567890500000}},
-				1506: offsetInfo{ID: TestChannelID, TS: 123456, Timestamps: []int64{1234567890600000, 1234567890700000}},
-				1874: offsetInfo{ID: TestChannelID, TS: 123456, Timestamps: []int64{1234567890800000, 1234567890800000}},
-				2330: offsetInfo{ID: "tC1234567890:1234567890.800000", Type: CThreadMessages, TS: 1234567890, Timestamps: []int64{1234567890900000, 1234567891100000}},
-				3833: offsetInfo{ID: TestChannelID2, TS: 123456, Timestamps: []int64{1234567890100000, 1234567890200000, 1234567890300000, 1234567890400000, 1234567890500000}},
-				4667: offsetInfo{ID: TestChannelID2, TS: 123456, Timestamps: []int64{1234567890600000, 1234567890700000}},
-				5034: offsetInfo{ID: TestChannelID2, TS: 123456, Timestamps: []int64{1234567890800000, 1234567890800000}},
-				5489: offsetInfo{ID: "tC987654321:1234567890.800000", Type: CThreadMessages, TS: 1234567890, Timestamps: []int64{1234567890900000, 1234567891100000}},
-			},
 		},
 	}
 	for _, tt := range tests {
@@ -464,7 +456,25 @@ func TestFile_offsetTimestamps(t *testing.T) {
 				t.Errorf("File.offsetTimestamps() error = %v, wantErr %v", err, tt.wantErr)
 				return
 			}
-			assert.Equal(t, tt.want, got)
+			want := offts{}
+			for _, wantInfo := range []struct {
+				chunk int
+				index int
+				info  offsetInfo
+			}{
+				{2, 0, offsetInfo{ID: TestChannelID, TS: 123456, Timestamps: []int64{1234567890100000, 1234567890200000, 1234567890300000, 1234567890400000, 1234567890500000}}},
+				{3, 1, offsetInfo{ID: TestChannelID, TS: 123456, Timestamps: []int64{1234567890600000, 1234567890700000}}},
+				{4, 2, offsetInfo{ID: TestChannelID, TS: 123456, Timestamps: []int64{1234567890800000, 1234567890800000}}},
+				{5, 0, offsetInfo{ID: "tC1234567890:1234567890.800000", Type: CThreadMessages, TS: 1234567890, Timestamps: []int64{1234567890900000, 1234567891100000}}},
+				{8, 0, offsetInfo{ID: TestChannelID2, TS: 123456, Timestamps: []int64{1234567890100000, 1234567890200000, 1234567890300000, 1234567890400000, 1234567890500000}}},
+				{9, 1, offsetInfo{ID: TestChannelID2, TS: 123456, Timestamps: []int64{1234567890600000, 1234567890700000}}},
+				{10, 2, offsetInfo{ID: TestChannelID2, TS: 123456, Timestamps: []int64{1234567890800000, 1234567890800000}}},
+				{11, 0, offsetInfo{ID: "tC987654321:1234567890.800000", Type: CThreadMessages, TS: 1234567890, Timestamps: []int64{1234567890900000, 1234567891100000}}},
+			} {
+				offset := p.idx[testChunks[wantInfo.chunk].ID()][wantInfo.index]
+				want[offset] = wantInfo.info
+			}
+			assert.Equal(t, want, got)
 		})
 	}
 }
```

**File**: `internal/client/client.go` (modified, +1/-1)
```diff
@@ -40,7 +40,7 @@ type Slack interface {
 	GetEmojiContext(ctx context.Context) (map[string]string, error)
 	GetFileContext(ctx context.Context, downloadURL string, writer io.Writer) error
 	GetFileInfoContext(ctx context.Context, fileID string, count int, page int) (*slack.File, []slack.Comment, *slack.Paging, error)
-	GetStarredContext(ctx context.Context, params slack.StarsParameters) ([]slack.StarredItem, *slack.Paging, error)
+	GetStarredContext(ctx context.Context, params slack.StarsParameters) ([]slack.StarredItem, string, error)
 	GetUserInfoContext(ctx context.Context, user string) (*slack.User, error)
 	GetUsersContext(ctx context.Context, options ...slack.GetUsersOption) ([]slack.User, error)
 	GetUsersInConversationContext(ctx context.Context, params *slack.GetUsersInConversationParameters) ([]string, string, error)
```

---

### Incident Patch 10: `37e7f8c6` (2026-07-13)
**Commit Message**: add codex and fix copilot mcp.json location

**File**: `.gitignore` (modified, +2/-0)
```diff
@@ -28,6 +28,8 @@ __debug_bin
 *.yml
 *.yaml
 *.toml
+!cmd/slackdump/internal/mcp/assets/layouts/**/*.json
+!cmd/slackdump/internal/mcp/assets/layouts/**/*.toml
 json/*
 examples/*
 experiments/*
```

**File**: `AGENTS.md` (modified, +1/-1)
```diff
@@ -96,7 +96,7 @@ Notable newer functionality that should be reflected in code suggestions:
 - `slackdump tools dedupe` removes duplicate rows created by resume overlap.
 - `slackdump tools merge` merges multiple archive databases.
 - `slackdump mcp -new <layout>` scaffolds AI-tool project layouts for
-  `opencode`, `claude-code`, and `copilot`.
+  `opencode`, `claude-code`, `copilot`, and `codex`.
 - Viewer and static HTML rendering support richer routing and canvas rendering.
 
 ## Build and Test
```

**File**: `README.md` (modified, +3/-2)
```diff
@@ -206,13 +206,14 @@ Scaffold a ready-to-use project directory pre-configured for your AI tool:
 slackdump mcp -new opencode   ~/my-slack-project   # OpenCode
 slackdump mcp -new claude-code ~/my-slack-project  # Claude Code
 slackdump mcp -new copilot    ~/my-slack-project   # VS Code / GitHub Copilot
+slackdump mcp -new codex      ~/my-slack-project   # Codex
 ```
 
 Each command creates the MCP config file and installs bundled Slackdump skill /
 instruction files so the agent knows how to work with your archive out of the box.
 
-To learn how to set it up with Claude Desktop, VS Code/GitHub Copilot, or
-OpenCode, see:
+To learn how to set it up with Codex, Claude Desktop, VS Code/GitHub Copilot,
+or OpenCode, see:
 ```
 slackdump help mcp
 ```
```

**File**: `cmd/slackdump/internal/mcp/assets/layouts/codex/.codex/config.toml` (added, +3/-0)
```diff
@@ -0,0 +1,3 @@
+[mcp_servers.slackdump]
+command = "slackdump"
+args = ["mcp"]
```

**File**: `cmd/slackdump/internal/mcp/assets/layouts/codex/layout.json` (added, +10/-0)
```diff
@@ -0,0 +1,10 @@
+{
+  "files": [
+    {"src": ".codex/config.toml", "dst": ".codex/config.toml"}
+  ],
+  "skills": [
+    {"skill": "slackdump",        "dst": ".agents/skills/slackdump/SKILL.md"},
+    {"skill": "slackdump-source", "dst": ".agents/skills/slackdump-source/SKILL.md"},
+    {"skill": "slackdump-sqlite3","dst": ".agents/skills/slackdump-sqlite3/SKILL.md"}
+  ]
+}
```

#### Recent Merged Pull Requests:
- **PR #739** (2026-09-25): update userBoot->client.init edge endpoint (@rusq)
- **PR #735** (2026-09-12): chunk: fix slow dedupe joins (@thomasmaerz)
- **PR #732** (2026-08-28): Update QR code login instructions (@ZimbiX)
- **PR #731** (2026-09-03): fix: show refreshed thread parents in channel timeline (@aerickson)
- **PR #728** (2026-08-19): fix workspace existence check (bump slackauth) (@rusq)
- **PR #726** (2026-08-18): always print version (@rusq)
- **PR #720** (2026-08-12): Fix conversation pipeline shutdown deadlock (@rusq)
- **PR #718** (2026-07-26): #717 bump slack lib version (@rusq)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

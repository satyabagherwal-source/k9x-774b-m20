# Forensic Learning Record (Deep Inspection): rusq/slackdump

> **Canonical Artifact**: `07_PROJECT_LEARNING/rusq-slackdump-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/rusq/slackdump](https://github.com/rusq/slackdump))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:06:34.591Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `rusq/slackdump`
- **Description**: Save or export your private and public Slack messages, threads, files, and users locally without admin privileges.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 2809 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `internal/chunk/control/workers.go`
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

package control

import (
	"context"
	"errors"
	"fmt"
	"log/slog"

	"github.com/rusq/slackdump/v4/internal/convert/transform"
	"github.com/rusq/slackdump/v4/internal/structures"
	"github.com/rusq/slackdump/v4/processor"
)

func userWorker(ctx context.Context, s Streamer, up processor.Users) error {
	if err := s.Users(ctx, up); err != nil {
		return fmt.Errorf("error listing users: %w", err)
	}
	return nil
}

func conversationWorker(ctx context.Context, s Streamer, proc processor.Conversations, links <-chan structures.EntityItem) error {
	lg := slog.Default()
	if err := s.Conversations(ctx, proc, links); err != nil {
		if errors.Is(err, transform.ErrClosed) {
			return fmt.Errorf("upstream error: %w", err)
		}
		return fmt.Errorf("error streaming conversations: %w", err)
	}
	lg.Debug("conversations done")
	return nil
}

func workspaceWorker(ctx context.Context, s Streamer, wsproc processor.WorkspaceInfo) error {
	lg := slog.Default()
	lg.Debug("workspaceWorker started")

	if err := s.WorkspaceInfo(ctx, wsproc); err != nil {
		return err
	}
	lg.Debug("workspaceWorker done")
	return nil
}

func searchMsgWorker(ctx context.Context, s Streamer, ms processor.MessageSearcher, query string) error {
	lg := slog.Default()
	lg.Debug("searchMsgWorker started")
	if err := s.SearchMessages(ctx, ms, query); err != nil {
		return err
	}
	lg.Debug("searchWorker done")
	return nil
}

func searchFileWorker(ctx context.Context, s Streamer, sf processor.FileSearcher, query string) error {
	lg := slog.Default()
	lg.Debug("searchFileWorker started")
	if err := s.SearchFiles(ctx, sf, query); err != nil {
		return err
	}
	lg.Debug("searchFileWorker done")
	return nil
}

```

### Core Architecture Module: `internal/viewer/renderer/debug.go`
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

package renderer

import (
	"context"
	"encoding/json"
	"html"
	"html/template"

	"github.com/rusq/slack"
)

type Debug struct{}

func (d *Debug) RenderText(ctx context.Context, s string) (v string) {
	return "<pre>" + html.EscapeString(s) + "</pre>"
}

func (d *Debug) Render(ctx context.Context, m *slack.Message) (v template.HTML) {
	b, err := json.MarshalIndent(m, "", "  ")
	if err != nil {
		panic(err)
	}
	return template.HTML("<pre>" + html.EscapeString(m.Text) + "</pre><hr><code><pre>" + string(b) + "</pre></code>")
}

```

### Core Architecture Module: `internal/viewer/renderer/functions/functions.go`
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

// Package functions provides shared template functions.
package functions

import (
	"encoding/json"
	"html/template"
	"log/slog"
	"mime"
	"strings"
	"time"
)

var FuncMap = template.FuncMap{
	"epoch":    Epoch,
	"mimetype": Mimetype,
}

func Epoch(ts json.Number) string {
	if ts == "" {
		return ""
	}
	t, err := ts.Int64()
	if err != nil {
		tf, err := ts.Float64()
		if err != nil {
			slog.Debug("epoch Float64 error, out of conversion options", "err", err, "ts", ts)
			return ts.String()
		}
		t = int64(tf)
	}
	return time.Unix(t, 0).Local().Format(time.DateTime)
}

func Mimetype(mt string) string {
	mm, _, err := mime.ParseMediaType(mt)
	if err != nil || mt == "" {
		slog.Debug("mimetype", "err", err, "mimetype", mt)
		return "application"
	}
	slog.Debug("mimetype", "t", mm, "mimetype", mt)
	t, _, found := strings.Cut(mm, "/")
	if !found {
		return "application"
	}
	return t
}

```

### Core Architecture Module: `internal/viewer/renderer/goldmark.go`
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

package renderer

import (
	"html"
	"html/template"
	"log/slog"
	"strings"

	"github.com/yuin/goldmark"
	emoji "github.com/yuin/goldmark-emoji"
	"github.com/yuin/goldmark/extension"
	gparser "github.com/yuin/goldmark/parser"
	ghtml "github.com/yuin/goldmark/renderer/html"
)

type Goldmark struct {
	r goldmark.Markdown
}

func NewGoldmark() *Goldmark {
	md := goldmark.New(
		goldmark.WithExtensions(extension.GFM, emoji.Emoji, extension.DefinitionList),
		goldmark.WithParserOptions(
			gparser.WithAutoHeadingID(),
		),
		goldmark.WithRendererOptions(
			ghtml.WithHardWraps(),
			ghtml.WithXHTML(),
		),
	)
	return &Goldmark{r: md}
}

func (g *Goldmark) Render(s string) (v template.HTML) {
	var buf strings.Builder
	if err := g.r.Convert([]byte(s), &buf); err != nil {
		slog.Debug("error", "error", err)
		return template.HTML(html.EscapeString(s))
	}
	return template.HTML(buf.String())
}

```

### Core Architecture Module: `internal/viewer/renderer/renderer.go`
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

// Package renderer provides rendering functions.
package renderer

import (
	"context"
	"html/template"

	"github.com/rusq/slack"
)

type Renderer interface {
	RenderText(ctx context.Context, s string) (v string)
	Render(ctx context.Context, m *slack.Message) (v template.HTML)
}

```

### Core Architecture Module: `internal/viewer/renderer/routes.go`
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

package renderer

import (
	"fmt"
	"log/slog"
	"net/url"
	"path"
	"strings"

	"github.com/rusq/slackdump/v4/internal/structures"
	"github.com/rusq/slackdump/v4/source"
)

// Mode defines how routes are rendered.
type Mode uint8

const (
	ModeLive Mode = iota
	ModeStatic
)

// Routes generates links for either live viewer or static HTML output.
type Routes struct {
	mode          Mode
	workspaceHost string
	liveHost      string
}

type RouteOption func(*Routes)

func WithWorkspaceURL(wspURL string) RouteOption {
	return func(r *Routes) {
		u, err := url.Parse(wspURL)
		if err != nil {
			slog.Warn("error parsing workspace URL", "error", err)
			return
		}
		r.workspaceHost = u.Hostname()
	}
}

func WithLiveHost(host string) RouteOption {
	return func(r *Routes) {
		r.liveHost = host
	}
}

func NewRoutes(mode Mode, opts ...RouteOption) *Routes {
	r := &Routes{mode: mode}
	for _, opt := range opts {
		opt(r)
	}
	return r
}

func (r *Routes) Interactive() bool {
	return r != nil && r.mode == ModeLive
}

func (r *Routes) Channel(id string) string {
	if r != nil && r.mode == ModeStatic {
		return routePath("archives", id, "index.html")
	}
	return routePath("archives", id)
}

func (r *Routes) ChannelMessage(id, ts string) string {
	return withFragment(r.Channel(id), ts)
}

func (r *Routes) Thread(id, ts string) string {
	if r != nil && r.mode == ModeStatic {
		return routePath("archives", id, "threads", ts+".html")
	}
	return routePath("archives", id, ts)
}

func (r *Routes) ThreadMessage(id, threadTS, msgTS string) string {
	return withFragment(r.Thread(id, threadTS), msgTS)
}

func (r *Routes) User(userID string) string {
	if r != nil && r.mode == ModeStatic {
		return routePath("team", userID, "index.html")
	}
	return routePath("team", userID)
}

func (r *Routes) Canvas(id string) string {
	if r != nil && r.mode == ModeStatic {
		return routePath("archives", id, "canvas", "index.html")
	}
	return routePath("archives", id, "canvas")
}

func (r *Routes) CanvasContent(id string) string {
	if r != nil && r.mode == ModeStatic {
		return routePath("archives", id, "canvas", "content.html")
	}
	return routePath("archives", id, "canvas", "content")
}

func (r *Routes) CanvasComments(id string) string {
	if r != nil && r.mode == ModeStatic {
		return routePath("archives", id, "canvas", "comments", "index.html")
	}
	return routePath("archives", id, "canvas", "comments")
}

func (r *Routes) CanvasComment(id, threadTS string) string {
	if r != nil && r.mode == ModeStatic {
		return routePath("archives", id, "canvas", "comments", threadTS, "index.html")
	}
	return routePath("archives", id, "canvas", "comments", threadTS)
}

func (r *Routes) File(id, filename string) string {
	if r != nil && r.mode == ModeStatic {
		return routePath("files", id, source.SanitizeFilename(filename))
	}
	return routePath("slackdump", "file", id, filename)
}

func (r *Routes) StaticAsset(name string) string {
	return routePath("static", name)
}

func (r *Routes) Avatar(userID, filename string) string {
	return routePath("avatars", userID, filename)
}

func (r *Routes) RewriteSlackURL(src string) string {
	if r == nil || r.workspaceHost == "" {
		return src
	}
	u, err := url.Parse(src)
	if err != nil {
		slog.Warn("error parsing url", "url", src, "error", err)
		return src
	}
	if u.Hostname() != r.workspaceHost {
		return src
	}

	parts := splitPath(u.Path)
	if len(parts) >= 2 {
		switch parts[0] {
		case "archives":
			channelID := parts[1]
			switch {
			case len(parts) == 2:
				return r.Channel(channelID)
			case len(parts) == 3 && parts[2] == "canvas":
				return r.Canvas(channelID)
			case len(parts) == 4 && parts[2] == "canvas" && parts[3] == "content":
				return r.CanvasContent(channelID)
			case len(parts) == 4 && parts[2] == "canvas" && parts[3] == "comments":
				return r.CanvasComments(channelID)
			case len(parts) == 5 && parts[2] == "canvas" && parts[3] == "comments":
				return r.CanvasComment(channelID, parts[4])
			case len(parts) >= 3:
				ts := parts[2]
				if strings.HasPrefix(ts, "p") {
					if threadTS := u.Query().Get("thread_ts"); threadTS != "" {
						return r.ThreadMessage(channelID, threadTS, structures.ThreadIDtoTS(ts))
					}
					return r.ChannelMessage(channelID, structures.ThreadIDtoTS(ts))
				}
				return r.Thread(channelID, ts)
			}
		case "team":
			return r.User(parts[1])
		}
	}

	if r.mode == ModeLive && r.liveHost != "" {
		u.Host = r.liveHost
		u.Scheme = "http"
		return u.String()
	}
	return src
}

func routePath(parts ...string) string {
	escaped := make([]string, 0, len(parts)+1)
	escaped = append(escaped, "")
	for _, part := range parts {
		if part == "" {
			continue
		}
		escaped = append(escaped, url.PathEscape(part))
	}
	return strings.Join(escaped, "/")
}

func withFragment(raw, fragment string) string {
	if fragment == "" {
		return raw
	}
	return fmt.Sprintf("%s#%s", raw, url.PathEscape(fragment))
}

func splitPath(p string) []string {
	p = strings.Trim(path.Clean(p), "/")
	if p == "." || p == "" {
		return nil
	}
	return strings.Split(p, "/")
}

```

### Core Architecture Module: `internal/viewer/renderer/safe_html.go`
```
package renderer

import (
	"html"
	"net/url"
	"regexp"
	"strings"
)

var hexColor = regexp.MustCompile(`^[0-9a-fA-F]{6}$`)

func escape(s string) string { return html.EscapeString(s) }

// safeURL accepts only links that cannot execute script in a browser. Relative
// viewer routes are kept so static and live renderers can share block output.
func safeURL(raw string, image bool) (string, bool) {
	u, err := url.Parse(raw)
	if err != nil {
		return "", false
	}
	if u.Scheme == "" {
		return raw, strings.HasPrefix(raw, "/") || !strings.HasPrefix(raw, "//")
	}
	switch strings.ToLower(u.Scheme) {
	case "http", "https":
		return raw, true
	case "mailto":
		return raw, !image
	default:
		return "", false
	}
}

func safeColor(s string) (string, bool) {
	s = strings.TrimPrefix(s, "#")
	return s, hexColor.MatchString(s)
}

```

### Core Architecture Module: `internal/viewer/renderer/slack.go`
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

package renderer

import (
	"context"
	"embed"
	"encoding/json"
	"fmt"
	"html/template"
	"log"
	"log/slog"
	"os"
	"strings"

	"github.com/rusq/slack"

	"github.com/rusq/slackdump/v4/internal/osext"
	"github.com/rusq/slackdump/v4/internal/viewer/renderer/functions"
)

const debug = true

type Slack struct {
	tmpl   *template.Template
	uu     map[string]slack.User    // map of user id to user
	cc     map[string]slack.Channel // map of channel id to channel
	routes *Routes
}

type SlackOption func(*Slack)

func WithUsers(uu map[string]slack.User) SlackOption {
	return func(sm *Slack) {
		sm.uu = uu
	}
}

func WithChannels(cc map[string]slack.Channel) SlackOption {
	return func(sm *Slack) {
		sm.cc = cc
	}
}

func WithReplaceURL(wspURL, localHost string) SlackOption {
	return func(sm *Slack) {
		if sm.routes == nil {
			sm.routes = NewRoutes(ModeLive)
		}
		WithWorkspaceURL(wspURL)(sm.routes)
		WithLiveHost(localHost)(sm.routes)
	}
}

func WithRoutes(routes *Routes) SlackOption {
	return func(sm *Slack) {
		if routes != nil {
			sm.routes = routes
		}
	}
}

//go:embed templates/*.html
var templates embed.FS

func NewSlack(tmpl *template.Template, opts ...SlackOption) *Slack {
	s := &Slack{
		routes: NewRoutes(ModeLive),
	}
	s.tmpl = template.Must(tmpl.New("blocks").Funcs(functions.FuncMap).Funcs(template.FuncMap{
		"fileurl": func(id, filename string) string {
			return s.routes.File(id, filename)
		},
		"rewriteurl": func(src string) string {
			if s.routes == nil {
				return src
			}
			return s.routes.RewriteSlackURL(src)
		},
	}).ParseFS(templates, "templates/*.html"))
	for _, opt := range opts {
		opt(s)
	}
	return s
}

func (*Slack) RenderText(ctx context.Context, s string) (v string) {
	return parseSlackMd(s)
}

func (s *Slack) Render(ctx context.Context, m *slack.Message) (v template.HTML) {
	var buf strings.Builder

	if len(m.Blocks.BlockSet) == 0 {
		fmt.Fprint(&buf, parseSlackMd(m.Text))
	} else {
		s.renderBlocks(ctx, &buf, m.Timestamp, m.Blocks.BlockSet)
	}
	s.renderFiles(ctx, &buf, m.Timestamp, m.Files)
	s.renderAttachments(ctx, &buf, m.Timestamp, m.Attachments)

	return template.HTML(buf.String())
}

// renderBlocks renders the blocks to the buffer.  msgTS is used to identify
// the message which failed to render in the logs.
func (s *Slack) renderBlocks(ctx context.Context, buf *strings.Builder, msgTS string, blocks []slack.Block) {
	attrMsgID := slog.String("message_ts", msgTS)

	for _, b := range blocks {
		fn, ok := blockTypeHandlers[b.BlockType()]
		if !ok {
			slog.WarnContext(ctx, "unhandled block type", "block_type", b.BlockType(), attrMsgID)
			maybeprint(b)
			continue
		}
		html, cl, err := fn(s, b)
		if err != nil {
			slog.ErrorContext(ctx, "error rendering block", "error", err, "block_type", b.BlockType(), attrMsgID)
			maybeprint(b)
			continue
		}
		buf.WriteString(html)
		buf.WriteString(cl)
	}
}

func (s *Slack) renderAttachments(ctx context.Context, buf *strings.Builder, msgTS string, attachments []slack.Attachment) {
	for _, a := range attachments {
		s.renderAttachment(ctx, buf, msgTS, a)
	}
}

func (s *Slack) renderAttachment(ctx context.Context, buf *strings.Builder, msgTS string, a slack.Attachment) {
	attrMsgID := slog.String("message_ts", msgTS)
	if err := s.tmpl.ExecuteTemplate(buf, "attachment.html", a); err != nil {
		slog.ErrorContext(ctx, "error rendering attachment", "error", err, attrMsgID)
	}
}

func (s *Slack) renderFiles(ctx context.Context, buf *strings.Builder, msgTS string, files []slack.File) {
	attrMsgID := slog.String("message_ts", msgTS)
	if files == nil {
		return
	}
	if err := s.tmpl.ExecuteTemplate(buf, "file.html", files); err != nil {
		slog.ErrorContext(ctx, "error rendering files", "error", err, attrMsgID)
	}
}

func maybeprint(v any) {
	if debug {
		enc := json.NewEncoder(os.Stderr)
		enc.SetIndent("", "  ")
		if err := enc.Encode(v); err != nil {
			log.Printf("error printing value: %s", err)
		}
		if err := os.Stderr.Sync(); err != nil {
			log.Printf("error flushing stderr: %s", err)
		}
	}
}

const stackframe = 1

type ErrIncorrectBlockType struct {
	Caller string
	Want   any
	Got    any
}

func (e *ErrIncorrectBlockType) Error() string {
	return fmt.Sprintf("incorrect block type for block %s: want %T, got %T", e.Caller, e.Want, e.Got)
}

func NewErrIncorrectType(want, got any) error {
	return &ErrIncorrectBlockType{
		Caller: osext.Caller(stackframe),
		Want:   want,
		Got:    got,
	}
}

type ErrMissingHandler struct {
	Caller string
	Type   any
}

func (e *ErrMissingHandler) Error() string {
	return fmt.Sprintf("missing handler for type %v called in %s", e.Type, e.Caller)
}

func NewErrMissingHandler(t any) error {
	return &ErrMissingHandler{
		Caller: osext.Caller(stackframe),
		Type:   t,
	}
}

// classes
var (
	// elBlockquote = element("blockquote", true)
	elDiv    = element("div", true)
	elFigure = element("figure", true)
	elH3     = element("h3", true)
	elPre    = element("pre", true)
	elStrong = element("strong", true)
)

func element(el string, close bool) func(class string, s string) string {
	return func(class, s string) string {
		var buf strings.Builder
		fmt.Fprintf(&buf, `<%s class="%s">%s`, el, class, s)
		if close {
			fmt.Fprintf(&buf, `</%s>`, el)
		}
		return buf.String()
	}
}

```

### Core Architecture Module: `internal/viewer/renderer/slack_action.go`
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

package renderer

import (
	"fmt"
	"strings"

	"github.com/rusq/slack"
)

/*
{
  "type": "actions",
  "block_id": "{\"task_id\":\"1209021\",\"id\":\"........\"}",
  "elements": [
    {
      "type": "button",
      "text": {
        "type": "plain_text",
        "text": "View",
        "emoji": true
      },
      "action_id": "jira_view_modal",
      "value": "jira_view_modal"
    },
*/

func (*Slack) mbtAction(ib slack.Block) (string, string, error) {
	b, ok := ib.(*slack.ActionBlock)
	if !ok {
		return "", "", NewErrIncorrectType(&slack.ActionBlock{}, ib)
	}
	var buf strings.Builder
	for _, e := range b.Elements.ElementSet {
		switch e := e.(type) {
		case *slack.ButtonBlockElement:
			fmt.Fprintf(&buf, `<BUTTON alt="%s">%s</BUTTON>`, e.ActionID, e.Text.Text)
		default:
			fmt.Fprintf(&buf, "[ELEMENT: %T]", e)
		}
	}
	return elDiv("slack-actions", buf.String()), "", nil
}

```

### Core Architecture Module: `internal/viewer/renderer/slack_context.go`
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

package renderer

import (
	"fmt"
	"strings"

	"github.com/rusq/slack"
)

func (s *Slack) mbtContext(ib slack.Block) (string, string, error) {
	b, ok := ib.(*slack.ContextBlock)
	if !ok {
		return "", "", NewErrIncorrectType(&slack.ContextBlock{}, ib)
	}
	var buf, cbuf strings.Builder
	for _, el := range b.ContextElements.Elements {
		fn, ok := contextElementHandlers[el.MixedElementType()]
		if !ok {
			return "", "", NewErrMissingHandler(el.MixedElementType())
		}
		s, cl, err := fn(s, el)
		if err != nil {
			return "", "", err
		}
		buf.WriteString(s)
		cbuf.WriteString(cl)
	}

	return buf.String(), cbuf.String(), nil
}

var contextElementHandlers = map[slack.MixedElementType]func(*Slack, slack.MixedElement) (string, string, error){
	slack.MixedElementImage: (*Slack).metImage,
	slack.MixedElementText:  (*Slack).metText,
}

func (s *Slack) metImage(ie slack.MixedElement) (string, string, error) {
	e, ok := ie.(*slack.ImageBlockElement)
	if !ok {
		return "", "", NewErrIncorrectType(&slack.ImageBlockElement{}, ie)
	}
	uri := ""
	if e.ImageURL != nil {
		uri = *e.ImageURL
	}
	if s.routes != nil {
		uri = s.routes.RewriteSlackURL(uri)
	}
	safeURI, valid := safeURL(uri, true)
	if !valid {
		return escape(e.AltText), "", nil
	}
	return fmt.Sprintf(`<img src="%s" alt="%s">`, escape(safeURI), escape(e.AltText)), "", nil
}

func (*Slack) metText(ie slack.MixedElement) (string, string, error) {
	e, ok := ie.(*slack.TextBlockObject)
	if !ok {
		return "", "", NewErrIncorrectType(&slack.TextBlockObject{}, ie)
	}
	return escape(e.Text), "", nil
}

```

### Core Architecture Module: `internal/viewer/renderer/slack_image.go`
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

package renderer

import (
	"fmt"

	"github.com/rusq/slack"
)

func (s *Slack) mbtImage(ib slack.Block) (string, string, error) {
	b, ok := ib.(*slack.ImageBlock)
	if !ok {
		return "", "", NewErrIncorrectType(&slack.ImageBlock{}, ib)
	}
	imgURL := b.ImageURL
	if s.routes != nil {
		imgURL = s.routes.RewriteSlackURL(imgURL)
	}
	imgURL, ok = safeURL(imgURL, true)
	if !ok {
		return elFigure(blockTypeClass[slack.MBTImage], escape(b.AltText)), "", nil
	}
	return elFigure(
		blockTypeClass[slack.MBTImage],
		fmt.Sprintf(
			`<img src="%[1]s" alt="%[2]s"><figcaption class="slack-image-caption">%[2]s</figcaption>`,
			escape(imgURL), escape(b.AltText),
		),
	), "", nil
}

```

### Core Architecture Module: `internal/viewer/renderer/slack_rich_text.go`
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

package renderer

import (
	"fmt"
	"html"
	"log/slog"
	"strings"

	emj "github.com/enescakir/emoji"
	"github.com/rusq/slack"
)

func (s *Slack) mbtRichText(ib slack.Block) (string, string, error) {
	b, ok := ib.(*slack.RichTextBlock)
	if !ok {
		return "", "", NewErrIncorrectType(&slack.RichTextBlock{}, ib)
	}
	var buf, cbuf strings.Builder
	for _, el := range b.Elements {
		fn, ok := rteTypeHandlers[el.RichTextElementType()]
		if !ok {
			return "", "", NewErrMissingHandler(el.RichTextElementType())
		}
		s, cl, err := fn(s, el)
		if err != nil {
			return "", "", err
		}
		buf.WriteString(s)
		cbuf.WriteString(cl)
	}

	return buf.String() + cbuf.String(), "", nil
}

func (s *Slack) rteSection(ie slack.RichTextElement) (string, string, error) {
	e, ok := ie.(*slack.RichTextSection)
	if !ok {
		return "", "", NewErrIncorrectType(&slack.RichTextSection{}, ie)
	}
	var buf strings.Builder
	var cbuf strings.Builder
	for _, el := range e.Elements {
		fn, ok := rtseTypeHandlers[el.RichTextSectionElementType()]
		if !ok {
			return "", "", NewErrMissingHandler(el.RichTextSectionElementType())
		}
		s, cl, err := fn(s, el)
		if err != nil {
			return "", "", err
		}
		buf.WriteString(s)
		cbuf.WriteString(cl)
	}

	return buf.String() + cbuf.String(), "", nil
}

func (s *Slack) rtseText(ie slack.RichTextSectionElement) (string, string, error) {
	e, ok := ie.(*slack.RichTextSectionTextElement)
	if !ok {
		return "", "", NewErrIncorrectType(&slack.RichTextSectionTextElement{}, ie)
	}
	t := strings.ReplaceAll(html.EscapeString(e.Text), "\n", "<br>")

	return applyStyle(t, e.Style), "", nil
}

func applyStyle(s string, style *slack.RichTextSectionTextStyle) string {
	if style == nil {
		return s
	}
	if style.Bold {
		s = fmt.Sprintf("<b>%s</b>", s)
	}
	if style.Italic {
		s = fmt.Sprintf("<i>%s</i>", s)
	}
	if style.Strike {
		s = fmt.Sprintf("<s>%s</s>", s)
	}
	if style.Code {
		s = fmt.Sprintf("<code>%s</code>", s)
	}
	return s
}

func (s *Slack) rtseLink(ie slack.RichTextSectionElement) (string, string, error) {
	e, ok := ie.(*slack.RichTextSectionLinkElement)
	if !ok {
		return "", "", NewErrIncorrectType(&slack.RichTextSectionLinkElement{}, ie)
	}
	text := e.Text
	if text == "" {
		text = e.URL
	}
	linkURL := e.URL
	if s.routes != nil {
		linkURL = s.routes.RewriteSlackURL(linkURL)
	}
	url, ok := safeURL(linkURL, false)
	if !ok {
		return escape(text), "", nil
	}
	return fmt.Sprintf("<a href=\"%s\">%s</a>", escape(url), escape(text)), "", nil
}

func (s *Slack) rteList(ie slack.RichTextElement) (string, string, error) {
	e, ok := ie.(*slack.RichTextList)
	if !ok {
		return "", "", NewErrIncorrectType(&slack.RichTextList{}, ie)
	}
	// const orderedTypes = "1aAiI"
	var tgOpen, tgClose string
	if e.Style == slack.RTEListOrdered {
		// TODO: type alternation on even/odd
		// https://www.w3schools.com/tags/att_ol_type.asp
		tgOpen, tgClose = "<ol>", "</ol>"
	} else {
		tgOpen, tgClose = "<ul>", "</ul>"
	}
	tgOpen, tgClose = strings.Repeat(tgOpen, e.Indent+1), strings.Repeat(tgClose, e.Indent+1)
	var buf, cbuf strings.Builder
	buf.WriteString(tgOpen)
	for _, el := range e.Elements {
		fn, ok := rteTypeHandlers[el.RichTextElementType()]
		if !ok {
			return "", "", NewErrMissingHandler(el.RichTextElementType())
		}
		s, cl, err := fn(s, el)
		if err != nil {
			return "", "", err
		}
		buf.WriteString(fmt.Sprintf("<li>%s</li>", s))
		cbuf.WriteString(cl)
	}
	buf.WriteString(tgClose)
	return buf.String() + cbuf.String(), "", nil
}

func (s *Slack) rteQuote(ie slack.RichTextElement) (string, string, error) {
	e, ok := ie.(*slack.RichTextQuote)
	if !ok {
		return "", "", NewErrIncorrectType(&slack.RichTextQuote{}, ie)
	}
	var buf, cbuf strings.Builder
	buf.WriteString("<blockquote>")
	for _, el := range e.Elements {
		fn, ok := rtseTypeHandlers[el.RichTextSectionElementType()]
		if !ok {
			return "", "", NewErrMissingHandler(el.RichTextSectionElementType())
		}
		s, cl, err := fn(s, el)
		if err != nil {
			return "", "", err
		}
		buf.WriteString(s)
		cbuf.WriteString(cl)
	}
	buf.WriteString(cbuf.String())
	buf.WriteString("</blockquote>")
	return buf.String(), "", nil
}

func (s *Slack) rtePreformatted(ie slack.RichTextElement) (string, string, error) {
	e, ok := ie.(*slack.RichTextPreformatted)
	if !ok {
		return "", "", NewErrIncorrectType(&slack.RichTextPreformatted{}, ie)
	}
	var buf, cbuf strings.Builder
	buf.WriteString("<pre>")
	for _, el := range e.Elements {
		fn, ok := rtseTypeHandlers[el.RichTextSectionElementType()]
		if !ok {
			return "", "", NewErrMissingHandler(el.RichTextSectionElementType())
		}
		s, cl, err := fn(s, el)
		if err != nil {
			return "", "", err
		}
		buf.WriteString(s)
		cbuf.WriteString(cl)
	}
	buf.WriteString(cbuf.String() + "</pre>")
	return buf.String(), "", nil
}

func (s *Slack) rtseUser(ie slack.RichTextSectionElement) (string, string, error) {
	e, ok := ie.(*slack.RichTextSectionUserElement)
	if !ok {
		return "", "", NewErrIncorrectType(&slack.RichTextSectionUserElement{}, ie)
	}
	var name string

	if u, ok := s.uu[e.UserID]; s.uu != nil && ok {
		name = u.Name
	} else {
		slog.Warn("user not found", "user_id", e.UserID)
		name = e.UserID
	}

	text := applyStyle(fmt.Sprintf("&lt;@%s&gt;", escape(name)), e.Style)
	if s.routes != nil {
		text = fmt.Sprintf(`<a href="%s">%s</a>`, escape(s.routes.User(e.UserID)), text)
	}
	return text, "", nil
}

func (s *Slack) rtseEmoji(ie slack.RichTextSectionElement) (string, string, error) {
	e, ok := ie.(*slack.RichTextSectionEmojiElement)
	if !ok {
		return "", "", NewErrIncorrectType(&slack.RichTextSectionEmojiElement{}, ie)
	}
	// TODO: resolve and render emoji.
	em := emj.Parse(fmt.Sprintf(":%s:", e.Name))
	return applyStyle(em, e.Style), "", nil
}

func (s *Slack) rtseChannel(ie slack.RichTextSectionElement) (string, string, error) {
	e, ok := ie.(*slack.RichTextSectionChannelElement)
	if !ok {
		return "", "", NewErrIncorrectType(&slack.RichTextSectionChannelElement{}, ie)
	}
	var name string
	if c, ok := s.cc[e.ChannelID]; s.cc != nil && ok {
		name = c.Name
	} else {
		slog.Warn("channel not found", "channel_id", e.ChannelID)
		name = e.ChannelID
	}

	text := applyStyle(fmt.Sprintf("&lt;#%s&gt;", escape(name)), e.Style)
	if s.routes != nil {
		text = fmt.Sprintf(`<a href="%s">%s</a>`, escape(s.routes.Channel(e.ChannelID)), text)
	}
	return elDiv(rtseTypeClass[slack.RTSEChannel], text), "", nil
}

func (s *Slack) rtseBroadcast(ie slack.RichTextSectionElement) (string, string, error) {
	e, ok := ie.(*slack.RichTextSectionBroadcastElement)
	if !ok {
		return "", "", NewErrIncorrectType(&slack.RichTextSectionBroadcastElement{}, ie)
	}
	return elStrong(rtseTypeClass[slack.RTSEBroadcast], fmt.Sprintf("@%s ", escape(e.Range))), "", nil
}

func (s *Slack) rtseUserGroup(ie slack.RichTextSectionElement) (string, string, error) {
	e, ok := ie.(*slack.RichTextSectionUserGroupElement)
	if !ok {
		return "", "", NewErrIncorrectType(&slack.RichTextSectionUserGroupElement{}, ie)
	}
	var name string
	if c, ok := s.cc[e.UsergroupID]; s.cc != nil && ok {
		name = c.Name
	} else {
		slog.Warn("channel not found", "usergroup_id", e.UsergroupID)
		name = e.UsergroupID
	}

	return elDiv(rtseTypeClass[slack.RTSEUserGroup], fmt.Sprintf("&lt;@%s&gt;", escape(name))), "", nil
}

func (s *Slack) rtseColor(ie slack.RichTextSectionElement) (string, string, error) {
	e, ok := ie.(*slack.RichTextSectionColorElement)
	if !ok {
		return "", "", NewErrIncorrectType(&slack.RichTextSectionColorElement{}, ie)
	}
	if color, ok := safeColor(e.Value); ok {
		return fmt.Sprintf("<span style=\"color: #%s;\">", color), "</span>", nil
	}
	return "", "", nil
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

### Incident Patch 1: `4181e127` (2026-10-03)
**Commit Message**: fix review findings

**File**: `internal/convert/src2enc.go` (modified, +16/-10)
```diff
@@ -278,6 +278,15 @@ func encodeCanvasMessages(ctx context.Context, rec processor.Conversations, cm p
 		if err := cm.CanvasMessages(ctx, hiddenChannelID, numThreads, isLast, roots); err != nil {
 			return err
 		}
+		// Register the root page's pending threads before any completion can
+		// release the canvas recorder.
+		for i := range roots {
+			if roots[i].ReplyCount > 0 {
+				if _, err := encodeCanvasThreadMessages(ctx, rec, cm, src, owner, hiddenChannelID, &roots[i]); err != nil {
+					return err
+				}
+			}
+		}
 		roots = make([]slack.Message, 0, defaultChunkSize)
 		numThreads = 0
 		return nil
@@ -291,13 +300,7 @@ func encodeCanvasMessages(ctx context.Context, rec processor.Conversations, cm p
 		}
 		roots = append(roots, root)
 		if root.ReplyCount > 0 {
-			found, err := encodeCanvasThreadMessages(ctx, rec, cm, src, owner, hiddenChannelID, &root)
-			if err != nil {
-				return err
-			}
-			if found {
-				numThreads++
-			}
+			numThreads++
 		}
 		if len(roots) == defaultChunkSize {
 			if err := flush(false); err != nil {
@@ -338,11 +341,14 @@ func encodeCanvasThreadMessages(ctx context.Context, rec processor.Conversations
 			}
 		}
 	}
-	if !found {
-		return false, nil
+	// Keep a parent row so database reassembly can recover the thread metadata,
+	// even for empty discussions and exact page boundaries.
+	if len(messages) == 0 {
+		messages = []slack.Message{*parent}
 	}
+	// Even an empty discussion must complete its registered pending thread.
 	if err := cm.CanvasThreadMessages(ctx, hiddenChannelID, *parent, true, messages); err != nil {
 		return false, err
 	}
-	return true, nil
+	return found, nil
 }
```

**File**: `internal/convert/src2enc_test.go` (modified, +143/-24)
```diff
@@ -17,19 +17,28 @@ package convert
 
 import (
 	"context"
+	"fmt"
 	"iter"
+	"log/slog"
+	"path/filepath"
 	"slices"
 	"testing"
 	"testing/fstest"
 	"time"
 
+	"github.com/jmoiron/sqlx"
 	"github.com/rusq/fsadapter"
 	"github.com/rusq/slackdump/v4/source/mock_source"
 
 	"github.com/rusq/slack"
 	"github.com/stretchr/testify/require"
 	"go.uber.org/mock/gomock"
+	_ "modernc.org/sqlite"
 
+	"github.com/rusq/slackdump/v4/internal/chunk"
+	"github.com/rusq/slackdump/v4/internal/chunk/backend/dbase"
+	"github.com/rusq/slackdump/v4/internal/chunk/backend/dbase/repository"
+	"github.com/rusq/slackdump/v4/internal/chunk/backend/directory"
 	"github.com/rusq/slackdump/v4/internal/fasttime"
 	"github.com/rusq/slackdump/v4/internal/structures"
 	"github.com/rusq/slackdump/v4/mocks/mock_processor"
@@ -248,31 +257,141 @@ func canvasMessageSeq(messages []slack.Message) iter.Seq2[slack.Message, error]
 }
 
 func Test_encodeCanvasMessages(t *testing.T) {
-	ctrl := gomock.NewController(t)
-	rec := mock_processor.NewMockConversations(ctrl)
-	cm := mock_processor.NewMockCanvasMessenger(ctrl)
-	root := slack.Message{Msg: slack.Msg{
-		Timestamp:  "123.456",
-		ReplyCount: 1,
-		Text:       "root",
-	}}
-	reply := slack.Message{Msg: slack.Msg{
-		Timestamp:       "124.456",
-		ThreadTimestamp: root.Timestamp,
-		Text:            "reply",
-	}}
-	normalisedRoot := root
-	normalisedRoot.ThreadTimestamp = root.Timestamp
-	src := canvasTestSource{
-		roots: []slack.Message{root},
-		threads: map[string][]slack.Message{
-			root.Timestamp: {normalisedRoot, reply},
-		},
-	}
 	owner := structures.ChannelFromID("COWNER")
+	t.Run("root before discussion", func(t *testing.T) {
+		ctrl := gomock.NewController(t)
+		rec := mock_processor.NewMockConversations(ctrl)
+		cm := mock_processor.NewMockCanvasMessenger(ctrl)
+		root := slack.Message{Msg: slack.Msg{
+			Timestamp:  "123.456",
+			ReplyCount: 1,
+			Text:       "root",
+		}}
+		reply := slack.Message{Msg: slack.Msg{
+			Timestamp:       "124.456",
+			ThreadTimestamp: root.Timestamp,
+			Text:            "reply",
+		}}
+		normalisedRoot := root
+		normalisedRoot.ThreadTimestamp = root.Timestamp
+		src := canvasTestSource{
+			roots: []slack.Message{root},
+			threads: map[string][]slack.Message{
+				root.Timestamp: {normalisedRoot, reply},
+			},
+		}
+		gomock.InOrder(
+			cm.EXPECT().CanvasMessages(gomock.Any(), "CCANVAS", 1, true, []slack.Message{normalisedRoot}).Return(nil),
+			cm.EXPECT().CanvasThreadMessages(gomock.Any(), "CCANVAS", normalisedRoot, true, []slack.Message{normalisedRoot, reply}).Return(nil),
+		)
+
+		require.NoError(t, encodeCanvasMessages(t.Context(), rec, cm, src, owner, "CCANVAS"))
+	})
+
+	for _, tt := range []struct {
+		name    string
+		roots   int
+		replies int
+	}{
+		{"multiple discussions", 2, 1},
+		{"multiple root and reply pages", defaultChunkSize + 1, defaultChunkSize + 1},
+		{"empty discussions", 2, 0},
+		{"no roots", 0, 0},
+	} {
+		t.Run(tt.name, func(t *testing.T) {
+			src := canvasTestSource{threads: make(map[string][]slack.Message)}
+			for i := range tt.roots {
+				root := slack.Message{Msg: slack.Msg{
+					Timestamp:  fmt.Sprintf("%d.000001", 1700000000+i),
+					ReplyCount: 1,
+				}}
+				src.roots = append(src.roots, root)
+				for j := range tt.replies {
+					src.threads[root.Timestamp] = append(src.threads[root.Timestamp], slack.Message{Msg: slack.Msg{
+						Timestamp:       fmt.Sprintf("%d.%06d", 1800000000+i, j+1),
+						ThreadTimestamp: root.Timestamp,
+						Text:            "reply",
+					}})
+				}
+			}
+			cd, err := chunk.CreateDir(t.TempDir())
+			require.NoError(t, err)
+			t.Cleanup(func() { require.NoError(t, cd.Close()) })
+			enc := directory.NewERC(cd, slog.Default())
+			t.Cleanup(func() { require.NoError(t, enc.Close()) })
+			recorder := chunk.NewCustomRecorder(enc)
+			require.NoError(t, encodeCanvasMessages(t.Context(), recorder, recorder, src, owner, "CCANVAS"))
+			got, err := cd.CanvasMessages(t.Context(), "CCANVAS")
+			require.NoError(t, err)
+			require.Len(t, got, tt.roots)
+			for _, root := range src.roots {
+				got, err := cd.CanvasThreadMessages(t.Context(), "CCANVAS", root.Timestamp)
+				require.NoError(t, err)
+				// The directory source returns the parent alongside replies.
+				require.Len(t, got, tt.replies+1)
+			}
+		})
+	}
+}
 
-	cm.EXPECT().CanvasThreadMessages(gomock.Any(), "CCANVAS", normalisedRoot, true, []slack.Message{normalisedRoot, reply}).Return(nil)
-	cm.EXPECT().CanvasMessages(gomock.Any(), "CCANVAS", 1, true, []slack.Message{normalisedRoot}).Return(nil)
+// canvasCheckEncoder checks reassembled chunks before forwarding them to ERC.
+type canvasCheckEncoder func(context.Context, *chunk.Chunk) error
 
-	require.NoError(t, encodeCanvasMessages(t.Context(), rec, cm, src, owner, "CCANVAS"))
+func (f canvasCheckEncoder) Encode(ctx context.Context, c *chunk.Chunk) error {
+	return f(ctx, c)
+}
+
+func Test_encodeCanvasThreadMessages(t *testing.T) {
+	for _, count := range 
```

**File**: `internal/convert/transform/dump.go` (modified, +2/-2)
```diff
@@ -172,7 +172,7 @@ func (s *DumpConverter) convertCanvas(ctx context.Context, owner *slack.Channel)
 	if err != nil {
 		return err
 	}
-	if err := pipeline(s.pipeline).apply(hiddenChannelID, "", roots); err != nil {
+	if err := pipeline(s.pipeline).apply(owner.ID, "", roots); err != nil {
 		return fmt.Errorf("canvas: %w", err)
 	}
 	msgs := make([]types.Message, 0, len(roots))
@@ -191,7 +191,7 @@ func (s *DumpConverter) convertCanvas(ctx context.Context, owner *slack.Channel)
 			if err != nil {
 				return err
 			}
-			if err := pipeline(s.pipeline).apply(hiddenChannelID, threadTS, thread); err != nil {
+			if err := pipeline(s.pipeline).apply(owner.ID, threadTS, thread); err != nil {
 				return fmt.Errorf("canvas thread: %w", err)
 			}
 			m.ThreadReplies = types.ConvertMsgs(thread)
```

**File**: `internal/convert/transform/dump_test.go` (modified, +13/-1)
```diff
@@ -28,6 +28,7 @@ import (
 	"github.com/rusq/fsadapter"
 
 	"github.com/rusq/slackdump/v4/internal/chunk"
+	"github.com/rusq/slackdump/v4/internal/convert/transform/fileproc"
 	"github.com/rusq/slackdump/v4/internal/fixtures"
 	"github.com/rusq/slackdump/v4/internal/nametmpl"
 )
@@ -118,11 +119,13 @@ func TestDumpConverter_convertCanvas(t *testing.T) {
 		ThreadTimestamp: "1700000000.000001",
 		ReplyCount:      1,
 		Text:            "root",
+		Files:           []slack.File{{ID: "FROOT", Name: "root.txt", URLPrivateDownload: "https://example.com/root.txt"}},
 	}}
 	reply := slack.Message{Msg: slack.Msg{
 		Timestamp:       "1700000001.000001",
 		ThreadTimestamp: root.Timestamp,
 		Text:            "reply",
+		Files:           []slack.File{{ID: "FREPLY", Name: "reply.txt", URLPrivateDownload: "https://example.com/reply.txt"}},
 	}}
 	src := canvasDumpSource{
 		owner:  owner,
@@ -140,7 +143,8 @@ func TestDumpConverter_convertCanvas(t *testing.T) {
 			output := tt.output(t)
 			fsa, err := fsadapter.New(output)
 			require.NoError(t, err)
-			cvt, err := NewDump(fsa, src)
+			fp := fileproc.NewWithPathFn(nil, source.DumpFilepath)
+			cvt, err := NewDump(fsa, src, DumpWithPipeline(fp.PathUpdateFunc))
 			require.NoError(t, err)
 			require.NoError(t, cvt.Convert(t.Context(), owner.ID, ""))
 			require.NoError(t, fsa.Close())
@@ -159,6 +163,14 @@ func TestDumpConverter_convertCanvas(t *testing.T) {
 			}
 			require.Len(t, got, 2)
 			require.Equal(t, "reply", got[1].Text)
+			require.Equal(t, source.DumpFilepath(owner, &root.Files[0]), got[0].Files[0].URLPrivateDownload)
+			require.Equal(t, source.DumpFilepath(owner, &reply.Files[0]), got[1].Files[0].URLPrivateDownload)
+			it, err = canvas.CanvasMessages(t.Context(), "CCANVAS")
+			require.NoError(t, err)
+			for m, err := range it {
+				require.NoError(t, err)
+				require.Equal(t, source.DumpFilepath(owner, &root.Files[0]), m.Files[0].URLPrivateDownload)
+			}
 		})
 	}
 }
```

**File**: `stream/conversation_test.go` (modified, +36/-0)
```diff
@@ -18,11 +18,13 @@ package stream
 import (
 	"context"
 	"errors"
+	"fmt"
 	"testing"
 	"time"
 
 	"github.com/rusq/slack"
 	"github.com/stretchr/testify/assert"
+	"github.com/stretchr/testify/require"
 	"go.uber.org/mock/gomock"
 
 	"github.com/rusq/slackdump/v4/internal/client/mock_client"
@@ -127,6 +129,40 @@ func TestStream_ConversationsCB(t *testing.T) {
 }
 
 func TestStream_Conversations(t *testing.T) {
+	t.Run("canvas discovery timeout cancels queued channels", func(t *testing.T) {
+		ctrl := gomock.NewController(t)
+		cl := mock_client.NewMockSlack(ctrl)
+		proc := mock_processor.NewMockConversations(ctrl)
+		cm := mock_processor.NewMockCanvasMessenger(ctrl)
+		owner := &slack.Channel{GroupConversation: slack.GroupConversation{Conversation: slack.Conversation{ID: "COWNER"}}, Properties: &slack.Properties{Canvas: slack.Canvas{FileId: "FCANVAS"}}}
+		cl.EXPECT().GetConversationInfoContext(gomock.Any(), gomock.Any()).Return(owner, nil).AnyTimes()
+		cl.EXPECT().GetUsersInConversationContext(gomock.Any(), gomock.Any()).Return(nil, "", nil).AnyTimes()
+		proc.EXPECT().ChannelInfo(gomock.Any(), owner, "").Return(nil).AnyTimes()
+		proc.EXPECT().ChannelUsers(gomock.Any(), owner.ID, "", []string(nil)).Return(nil).AnyTimes()
+		cl.EXPECT().GetFileInfoContext(gomock.Any(), "FCANVAS", 0, 1).Return(&slack.File{ID: "FCANVAS"}, nil, nil, nil)
+		proc.EXPECT().Files(gomock.Any(), owner, slack.Message{}, []slack.File{{ID: "FCANVAS"}}).Return(nil)
+		discoveryErr := fmt.Errorf("HTTP request timed out: %w", context.DeadlineExceeded)
+		cs := New(&canvasSlack{Slack: cl, supported: true, err: discoveryErr}, network.NoLimits)
+		items := make(chan structures.EntityItem, msgChanSz+2)
+		for range msgChanSz + 2 {
+			items <- structures.EntityItem{Id: owner.ID}
+		}
+		close(items)
+		ctx, cancel := context.WithCancel(t.Context())
+		defer cancel()
+		done := make(chan error, 1)
+		go func() { done <- cs.Conversations(ctx, &canvasConversations{proc, cm}, items) }()
+		select {
+		case err := <-done:
+			require.ErrorIs(t, err, discoveryErr)
+			require.NoError(t, ctx.Err(), "failure must not depend on outer cancellation")
+		case <-time.After(3 * time.Second):
+			cancel()
+			<-done
+			t.Fatal("Conversations did not cancel and join its pipeline")
+		}
+	})
+
 	threadItem := structures.EntityItem{Id: "CTM1:1610000000.000000"}
 	threadChannel := &slack.Channel{GroupConversation: slack.GroupConversation{Conversation: slack.Conversation{ID: "CTM1"}}}
 	threadMessages := []slack.Message{{Msg: slack.Msg{
```

**File**: `stream/stream_workers.go` (modified, +5/-1)
```diff
@@ -298,7 +298,11 @@ func (cs *Stream) canvasDiscussions(ctx context.Context, proc processor.Conversa
 		roots, err = canvasClient.CanvasThreadRoots(ctx, fileID)
 		return err
 	}); err != nil {
-		return newAPIError("canvas.threadRoots", err)
+		err = newAPIError("canvas.threadRoots", err)
+		if canvasErrorIsFatal(err) {
+			sendResult(ctx, results, Result{Type: RTCanvasThread, ChannelID: hiddenID, Err: err})
+		}
+		return err
 	}
 	roots, err := cs.filterCanvasRoots(roots, ownerReq)
 	if err != nil {
```

**File**: `stream/stream_workers_test.go` (modified, +53/-0)
```diff
@@ -18,6 +18,7 @@ package stream
 import (
 	"context"
 	"errors"
+	"fmt"
 	"testing"
 	"time"
 
@@ -109,6 +110,50 @@ func TestStream_channelWorker(t *testing.T) {
 	result := <-results
 	assert.Equal(t, RTChannel, result.Type)
 	assert.NoError(t, result.Err)
+
+	for _, tt := range []struct {
+		name  string
+		err   error
+		fatal bool
+	}{
+		{"discovery timeout", fmt.Errorf("request: %w", context.DeadlineExceeded), true},
+		{"discovery cancellation", fmt.Errorf("request: %w", context.Canceled), true},
+		{"nonfatal discovery failure", errors.New("canvas unavailable"), false},
+	} {
+		t.Run(tt.name, func(t *testing.T) {
+			ctrl := gomock.NewController(t)
+			cl := mock_client.NewMockSlack(ctrl)
+			proc := mock_processor.NewMockConversations(ctrl)
+			cm := mock_processor.NewMockCanvasMessenger(ctrl)
+			cl.EXPECT().GetConversationInfoContext(gomock.Any(), gomock.Any()).Return(owner, nil)
+			cl.EXPECT().GetUsersInConversationContext(gomock.Any(), gomock.Any()).Return(nil, "", nil)
+			proc.EXPECT().ChannelInfo(gomock.Any(), owner, "").Return(nil)
+			proc.EXPECT().ChannelUsers(gomock.Any(), owner.ID, "", []string(nil)).Return(nil)
+			cl.EXPECT().GetFileInfoContext(gomock.Any(), "FCANVAS", 0, 1).Return(&slack.File{ID: "FCANVAS"}, nil, nil, nil)
+			proc.EXPECT().Files(gomock.Any(), owner, slack.Message{}, []slack.File{{ID: "FCANVAS"}}).Return(nil)
+			if !tt.fatal {
+				cl.EXPECT().GetConversationHistoryContext(gomock.Any(), gomock.Any()).Return(&slack.GetConversationHistoryResponse{SlackResponse: slack.SlackResponse{Ok: true}}, nil)
+				proc.EXPECT().Messages(gomock.Any(), owner.ID, 0, true, []slack.Message(nil)).Return(nil)
+			}
+			cs := New(&canvasSlack{Slack: cl, supported: true, err: tt.err}, network.NoLimits)
+			reqs := make(chan channelRequest, 1)
+			reqs <- channelRequest{sl: structures.SlackLink{Channel: owner.ID}}
+			close(reqs)
+			results := make(chan Result, 2)
+			cs.channelWorker(t.Context(), &canvasConversations{proc, cm}, results, make(chan ordinaryThreadRequest), make(chan canvasThreadRequest), make(chan canvasThreadResult), reqs)
+			require.NoError(t, t.Context().Err(), "outer context must remain active")
+			require.Len(t, results, 1)
+			result := <-results
+			if tt.fatal {
+				require.Equal(t, RTCanvasThread, result.Type)
+				require.Equal(t, "CCANVAS", result.ChannelID)
+				require.ErrorIs(t, result.Err, tt.err)
+			} else {
+				require.Equal(t, RTChannel, result.Type)
+				require.NoError(t, result.Err)
+			}
+		})
+	}
 }
 
 func TestStream_channelWorker_canvasBypassesOrdinaryThreadBacklog(t *testing.T) {
@@ -416,6 +461,14 @@ func TestStream_canvasDiscussions(t *testing.T) {
 	err = unsupported.canvasDiscussions(t.Context(), mc, cm, threadC, completed, results, channelRequest{}, owner, "FCANVAS")
 	require.ErrorIs(t, err, client.ErrOpNotSupported)
 
+	t.Run("cancelled discovery does not block on results", func(t *testing.T) {
+		ctx, cancel := context.WithCancel(t.Context())
+		cancel()
+		cs := New(&canvasSlack{Slack: ms, supported: true, err: context.Canceled}, network.NoLimits)
+		err := cs.canvasDiscussions(ctx, mc, cm, make(chan canvasThreadRequest), make(chan canvasThreadResult), make(chan Result), channelRequest{}, owner, "FCANVAS")
+		require.ErrorIs(t, err, context.Canceled)
+	})
+
 	t.Run("processor failure publishes result", func(t *testing.T) {
 		ctrl := gomock.NewController(t)
 		mc := mock_processor.NewMockConversations(ctrl)
```

---

### Incident Patch 2: `a77f8deb` (2026-09-24)
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

### Incident Patch 3: `f7319928` (2026-09-12)
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

### Incident Patch 4: `87e3744a` (2026-09-11)
**Commit Message**: chunk: simplify null-safe dedupe joins

**File**: `internal/chunk/backend/dbase/repository/dedupe.go` (modified, +12/-29)
```diff
@@ -3,7 +3,6 @@ package repository
 import (
 	"context"
 	"fmt"
-	"slices"
 	"strings"
 
 	"github.com/jmoiron/sqlx"
@@ -82,16 +81,8 @@ type dedupeEntity struct {
 	name       string
 	table      string
 	keyColumns []string
-	// nullableColumns lists the subset of keyColumns that may hold NULL.
-	// Joins on all other key columns use plain equality, which the query
-	// planner can serve from covering indexes; the NULL-tolerant OR form
-	// is reserved for genuinely nullable columns, where it preserves
-	// NULL=NULL duplicate matching. Column nullability mirrors the schema
-	// migrations (e.g. FILE.MESSAGE_ID and FILE.THREAD_ID are nullable,
-	// every other dedupe key column is declared NOT NULL).
-	nullableColumns []string
-	chunkTypes      []chunk.ChunkType
-	mode            dedupeMode
+	chunkTypes []chunk.ChunkType
+	mode       dedupeMode
 }
 
 var dedupeEntities = []dedupeEntity{
@@ -124,12 +115,11 @@ var dedupeEntities = []dedupeEntity{
 		mode:       dedupeByKey,
 	},
 	{
-		name:            "files",
-		table:           "FILE",
-		keyColumns:      []string{"ID", "CHANNEL_ID", "MESSAGE_ID", "THREAD_ID"},
-		nullableColumns: []string{"MESSAGE_ID", "THREAD_ID"},
-		chunkTypes:      []chunk.ChunkType{chunk.CFiles},
-		mode:            dedupeByData,
+		name:       "files",
+		table:      "FILE",
+		keyColumns: []string{"ID", "CHANNEL_ID", "MESSAGE_ID", "THREAD_ID"},
+		chunkTypes: []chunk.ChunkType{chunk.CFiles},
+		mode:       dedupeByData,
 	},
 }
 
@@ -336,7 +326,7 @@ func buildPrunableChunksSelect(entity dedupeEntity) string {
 	buf.WriteString("LEFT JOIN duplicates D ON D.CHUNK_ID = T.CHUNK_ID")
 	if len(entity.keyColumns) > 0 {
 		buf.WriteString(" AND ")
-		buf.WriteString(joinOnColumns("D", "T", entity.keyColumns, entity.nullableColumns))
+		buf.WriteString(joinOnColumns("D", "T", entity.keyColumns))
 	}
 	buf.WriteString("\nWHERE C.TYPE_ID IN (")
 	buf.WriteString(strings.Join(placeholders(entity.chunkTypes), ","))
@@ -351,7 +341,7 @@ func buildDeleteDuplicatesStmt(entity dedupeEntity) string {
 	buf.WriteString(" AS T\nWHERE EXISTS (\nSELECT 1 FROM duplicates D WHERE D.CHUNK_ID = T.CHUNK_ID")
 	if len(entity.keyColumns) > 0 {
 		buf.WriteString(" AND ")
-		buf.WriteString(joinOnColumns("D", "T", entity.keyColumns, entity.nullableColumns))
+		buf.WriteString(joinOnColumns("D", "T", entity.keyColumns))
 	}
 	buf.WriteString("\n)")
 	return buf.String()
@@ -383,7 +373,7 @@ func withDuplicateRows(entity dedupeEntity, final string) string {
 	buf.WriteString("FROM ")
 	buf.WriteString(entity.table)
 	buf.WriteString(" T\nJOIN latest L ON ")
-	buf.WriteString(joinOnColumns("T", "L", entity.keyColumns, entity.nullableColumns))
+	buf.WriteString(joinOnColumns("T", "L", entity.keyColumns))
 	if entity.mode == dedupeByData {
 		buf.WriteString(" AND L.DATA = T.DATA")
 	}
@@ -392,17 +382,10 @@ func withDuplicateRows(entity dedupeEntity, final string) string {
 	return buf.String()
 }
 
-func joinOnColumns(left, right string, cols, nullable []string) string {
+func joinOnColumns(left, right string, cols []string) string {
 	parts := make([]string, 0, len(cols))
 	for _, col := range cols {
-		if slices.Contains(nullable, col) {
-			parts = append(parts, "("+left+"."+col+" = "+right+"."+col+" OR ("+left+"."+col+" IS NULL AND "+right+"."+col+" IS NULL))")
-			continue
-		}
-		// The column is declared NOT NULL (see dedupeEntity.nullableColumns),
-		// so the NULL-tolerant branches are unsatisfiable and plain equality
-		// matches exactly the same rows while remaining index-friendly.
-		parts = append(parts, left+"."+col+" = "+right+"."+col)
+		parts = append(parts, left+"."+col+" IS "+right+"."+col)
 	}
 	return strings.Join(parts, " AND ")
 }
```

**File**: `internal/chunk/backend/dbase/repository/dedupe_test.go` (modified, +12/-47)
```diff
@@ -3,7 +3,6 @@ package repository
 import (
 	"context"
 	"fmt"
-	"slices"
 	"testing"
 
 	"github.com/jmoiron/sqlx"
@@ -590,63 +589,29 @@ func verifyFileCountForTest(t *testing.T, db *sqlx.DB, expected int) {
 
 func Test_joinOnColumns(t *testing.T) {
 	tests := []struct {
-		name     string
-		cols     []string
-		nullable []string
-		want     string
+		name string
+		cols []string
+		want string
 	}{
 		{
-			name:     "non-nullable columns use plain equality",
-			cols:     []string{"CHANNEL_ID", "USER_ID"},
-			nullable: nil,
-			want:     "T.CHANNEL_ID = L.CHANNEL_ID AND T.USER_ID = L.USER_ID",
+			name: "multiple columns",
+			cols: []string{"CHANNEL_ID", "USER_ID"},
+			want: "T.CHANNEL_ID IS L.CHANNEL_ID AND T.USER_ID IS L.USER_ID",
 		},
 		{
-			name:     "nullable columns keep null-tolerant form",
-			cols:     []string{"ID", "MESSAGE_ID"},
-			nullable: []string{"MESSAGE_ID"},
-			want: "T.ID = L.ID AND " +
-				"(T.MESSAGE_ID = L.MESSAGE_ID OR (T.MESSAGE_ID IS NULL AND L.MESSAGE_ID IS NULL))",
+			name: "one column",
+			cols: []string{"MESSAGE_ID"},
+			want: "T.MESSAGE_ID IS L.MESSAGE_ID",
 		},
 		{
-			name:     "all nullable",
-			cols:     []string{"MESSAGE_ID", "THREAD_ID"},
-			nullable: []string{"MESSAGE_ID", "THREAD_ID"},
-			want: "(T.MESSAGE_ID = L.MESSAGE_ID OR (T.MESSAGE_ID IS NULL AND L.MESSAGE_ID IS NULL)) AND " +
-				"(T.THREAD_ID = L.THREAD_ID OR (T.THREAD_ID IS NULL AND L.THREAD_ID IS NULL))",
-		},
-		{
-			name:     "no columns",
-			cols:     nil,
-			nullable: nil,
-			want:     "",
+			name: "no columns",
+			want: "",
 		},
 	}
 
 	for _, tt := range tests {
 		t.Run(tt.name, func(t *testing.T) {
-			assert.Equal(t, tt.want, joinOnColumns("T", "L", tt.cols, tt.nullable))
-		})
-	}
-}
-
-func TestDedupeEntities_nullTolerance(t *testing.T) {
-	// Guards the dedupe hang class: NULL-tolerant OR join predicates defeat
-	// covering-index lookups, so they must only be generated for genuinely
-	// nullable key columns. Every other entity must emit plain equality.
-	for _, entity := range dedupeEntities {
-		t.Run(entity.name, func(t *testing.T) {
-			stmt := withDuplicateRows(entity, "SELECT 1 FROM duplicates")
-			for _, col := range entity.keyColumns {
-				nullTolerant := "T." + col + " IS NULL"
-				if slices.Contains(entity.nullableColumns, col) {
-					assert.Contains(t, stmt, nullTolerant,
-						"nullable key column must keep null-tolerant matching")
-					continue
-				}
-				assert.NotContains(t, stmt, nullTolerant,
-					"NOT NULL key column must use plain equality")
-			}
+			assert.Equal(t, tt.want, joinOnColumns("T", "L", tt.cols))
 		})
 	}
 }
```

---

### Incident Patch 5: `0dbdb4bb` (2026-09-11)
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

### Incident Patch 6: `098aba9e` (2026-09-03)
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
+		return func(t *testing.T, conn PrepareExtContext) {
+			// Sample setup:
+			//
+			// Thread: 123.456
+			// 1. There are three chunks, 2 non-final and last one is final.
+			// 2. Each chunk will have 2 messages, one is a thread message and the other is a thread lead,
+			//    because API always returns the thread lead with the thread messages.
+			ctx := t.Context()
+			var sr sessionRepository
+			sess, err := sr.Insert(ctx, conn, &Session{ID: 1, Finished: true})
+			if err != nil {
+				t.Fatalf("insert session: %v", err)
+			}
+
+			threadOnlyValue := threadOnly
+			// prepare and insert chunks
+			chunks := [...]DBChunk{
+				{ID: 1, TypeID: chunk.CThreadMessages, ChannelID: &testChannelID, SessionID: sess, Final: false, ThreadOnly: &threadOnlyValue},
+				{ID: 2, TypeID: chunk.CThreadMessages, ChannelID: &testChannelID, SessionID: sess, Final: false, ThreadOnly: &threadOnlyValue},
+				{ID: 3, TypeID: chunk.CThreadMessages, ChannelID: &testChannelID, SessionID: sess, Final
```

---

### Incident Patch 7: `3098a66c` (2026-09-03)
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
+		var cr chunkRepository
+		for i := range chunks {
+			if _, err := cr.Insert(ctx, conn, &chunks[i]); err != nil {
+				t.Fatalf("insert chunk: %v", err)
+			}
+		}
+
+		oldParent := slack.Message{Msg: slack.Msg{
+			Timestamp:       testThreadID,
+			ThreadTimestamp: testThreadID,
+			LatestReply:     "124.000",
+			Text:            "old",
+		}}
+		emptyParent := slack.Message{Msg: slack.Msg{
+			Timestamp:       testThreadID,
+			ThreadTimestamp: testThreadID,
+			LatestReply:     structures.LatestReplyNoReplies,
+			Text:            "new",
+		}}
+		threadChunkOnlyEmptyParent := slack.Message{Msg: slack.Msg{
+			Timestamp:       "124.456",
+			ThreadTimestamp: "124.456",
+			LatestReply:     structures.LatestReplyNoReplies,
+			Text:            "only",
+		}}
+
+		var mr messageRepository
+		if err := mr.Insert(ctx, conn,
+			must(NewDBMessage(1, 0, testChannelID, &oldParent)),
+			must(NewDBMessage(2, 0, testChannelID, &emptyParent)),
+			must(NewDBMessage(2, 1, testChannelID, &threadChun
```

---

### Incident Patch 8: `1588d430` (2026-08-25)
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
+			//    because API always returns the thread lead with the thread messages.
+			ctx := t.Context()
+			var sr sessionRepository
+			sess, err := sr.Insert(ctx, conn, &Session{ID: 1, Finished: true})
+			if err != nil {
+				t.Fatalf("insert session: %v", err)
 			}
-		}
-		var (
-			parentMsg = slack.Message{Msg: slack.Msg{Timestamp: testThreadID, ThreadTimestamp: testThreadID, Text: "A"}}
 
-			tm1 = slack.Message{Msg: slack.Msg{Timestamp: "124.000", ThreadTimestamp: testThreadID, Text: "B"}}
-			tm2 = slack.Message{Msg: slack.Msg{Timestamp: "125.000", ThreadTimestamp: testThreadID, Text: "C"}}
-			tm3 = slack.Message{Msg: slack.Msg{Timestamp: "126.000", ThreadTimestamp: testThreadID, Text: "D"}}
-
-			chunkMessages = [len(chunks)][2]*DBMessage{
-				{
-					must(NewDBMessage(1, 0, testChannelID, &parentMsg)),
-					must(NewDBMessage(1, 1, testChannelID, &tm1)),
-				},
-				{
-					must(NewDBMessage(2, 0, testChannelID, &parentMsg)),
-					must(NewDBMessage(2, 1, testChannelID, &tm2)),
-				},
-				{
-					mus
```

---

### Incident Patch 9: `5ae8c664` (2026-08-19)
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
 golang.org/x/sync v0.1.0/go.mod h1:RxMgew5VJxzue5/jJTE5uejpjVlOe/izrB70Jof72aM=
@@ -309,8 +309,8 @@ golang.org/x/text v0.3.7/go.mod h1:u+2+/6zg+i71rQMx5EYifcz6MCKuco9NR6JIITiCfzQ=
 golang.org/x/text v0.7.0/go.mod h1:mrYo+phRRbMaCq/xk9113O4dZlRixOauAjOtrjsXDZ8=
 golang.org/x/text v0.9.0/go.mod h1:e1OnstbJyHTd6l/uOt8jFFHp6TRDWZR/bV3emEE/zU8=
 golang.org/x/text v0.14.0/go.mod h1:18ZOQIKpY8NJVqYksKHtTdi31H5itFRjB5/qKTNYzSU=
-golang.org/x/text v0.40.0 h1:Ub2Z6/xjgF1WrYQz2nuITOEegKFtiIy+rieRJ5lHZKs=
-golang.org/x/text v0.40.0/go.mod h1:hpnzDAfGV753zIKo+wk3u1bVKCGPbrnF7+7LBF/UHVY=
+golang.org/x/text v0.41.0 h1:vz/seA0lnX87Othu2f/0L24RcgrXD9/YFTSuGjj3rH8=
+golang.org/x/text v0.41.0/go.mod h1:jvf1O8ajNzZqhSrQBPbutR/EB83Cc0CFrezNQIwbb5M=
 golang.org/x/time v0.15.0 h1:bbrp8t3bGUeFOx08pvsMYRTCVSMk89u4tKbNOZbp88U=
 golang.org/x/time v0.15.0/go.mod h1:Y4YMaQmXwGQZoFaVFk4YpCt4FLQMYKZe9oeV/f4MSno=
 golang.org/x/tools v0.0.0-20180917221912-90fa682c2a6e/go.mod h1:n7NCudcB/nEzxVGmLbDWY5pfWTLqBcC2KZ6jyYvM4mQ=
```

---

### Incident Patch 10: `afe8d269` (2026-08-12)
**Commit Message**: Fix conversation pipeline shutdown deadlock (#720)

* additional error logging

* fix streaming hup

* extract coversation pipeline into a separate func

* move consts closer to where they are being used

* prevent user duplication in the channelusers

* add a test

* facepalm: finish the sentence

* Apply suggestions from code review

Co-authored-by: Copilot Autofix powered by AI <[REDACTED_EMAIL]>

---------

Co-authored-by: Copilot Autofix powered by AI <[REDACTED_EMAIL]>

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
+				fatalErr = &resultErr // Result implements error.
+			}
+			cancel()
+			continue
+		}
+		for _, fn := range cs.resultFn {
+			if err := fn(res); err != nil {
+				slog.ErrorContext(ctx, "result function call error", "res", res.String())
+				fatalErr = fmt.Errorf("result %s, callback error: %w", res, err)
+				cancel()
+				break
+			}
+		}
+	}
+	if fatalErr != nil {
+		return fatalErr
+	}
+	if err := context.Cause(ctx); err != nil {
+		return err
+	}
+	trace.Log(ctx, "info", "complete")
+	return nil
+}
 
-	// create channels
+// startConversationPipeline starts the three pipeline stages and returns the
+// results channel. The input loop and channel worker both send thread requests,
+// so their completion owns closing threadsC.
+func (cs *Stream) startConversationPipeline(ctx context.Context, proc processor.Conversations, items <-chan structures.EntityItem) <-chan Result {
 	chansC := make(chan request, msgChanSz)
 	threadsC := make(chan request, threadChanSz)
-
 	resultsC := make(chan Resu
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
+		proc.EXPECT().ThreadMessages(gomock.Any(), "CTM1", gomock.Any(), true, true, threadMessages).Return(assert.AnError).AnyTimes()
+
+		items := make(chan structures.EntityItem, threadChanSz+1)
+		for range threadChanSz + 1 {
+			items <- threadItem
+		}
+		close(items)
+
+		done := make(chan error, 1)
+		go func() { done <- cs.Conversations(t.Context(), proc, items) }()
+		select {
+		case err := <-done:
+			assert.ErrorIs(t, err, assert.AnError)
+		case <-time.After(time.Second):
+			t.Fatal("Conversations did not join cancelled workers")
+		}
+	})
+
+	t.Run("callback failure cancels and joins producers", func(t *testing.T) {
+		ctrl := gomock.NewController(t)
+		cl := mock_client.NewMockSlack(ctrl)
+		proc := mock_processor.NewMockConversations(ctrl)
+		callbackErr := errors.New("callback failed")
+		cs := New(cl, network.NoLimits, OptResultFn(func(Result) error { return callbackErr }))
+		cs.chanCache.set("CTM1", threadChannel)
+		cl.EXPECT().GetConversationRepliesContext(gomock.Any(), gomock.Any()).Return(threadMessages, false, "", nil).AnyTimes()
+		proc.EXPECT().ChannelInfo(gomock.Any(), gomock.
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

**File**: `stream/stream_test.go` (modified, +19/-1)
```diff
@@ -405,7 +405,7 @@ func Test_processLink(t *testing.T) {
 		t.Run(tt.name, func(t *testing.T) {
 			chans := make(chan request, 1)
 			threads := make(chan request, 1)
-			if err := processLink(chans, threads, tt.args.item); (err != nil) != tt.wantErr {
+			if err := processLink(t.Context(), chans, threads, tt.args.item); (err != nil) != tt.wantErr {
 				t.Errorf("processLink() error = %v, wantErr %v", err, tt.wantErr)
 				return // otherwise will block
 			}
@@ -424,6 +424,24 @@ func Test_processLink(t *testing.T) {
 			}
 		})
 	}
+
+	t.Run("cancellation unblocks output", func(t *testing.T) {
+		ctx, cancel := context.WithCancelCause(t.Context())
+		channels := make(chan request)
+		done := make(chan error, 1)
+		go func() {
+			done <- processLink(ctx, channels, make(chan request), structures.EntityItem{Id: "CTM1"})
+		}()
+
+		cause := errors.New("stop routing")
+		cancel(cause)
+		select {
+		case err := <-done:
+			assert.ErrorIs(t, err, cause)
+		case <-time.After(time.Second):
+			t.Fatal("processLink remained blocked after cancellation")
+		}
+	})
 }
 
 func TestStream_Users(t *testing.T) {
```

**File**: `stream/stream_workers.go` (modified, +33/-10)
```diff
@@ -34,15 +34,16 @@ func (cs *Stream) channelWorker(ctx context.Context, proc processor.Conversation
 	for {
 		select {
 		case <-ctx.Done():
-			results <- Result{Type: RTChannel, Err: ctx.Err()}
 			return
 		case req, more := <-reqs:
 			if !more {
 				return // channel closed
 			}
 			channel, err := cs.procChannelInfoWithUsers(ctx, proc, req.sl.Channel, req.sl.ThreadTS)
 			if err != nil {
-				results <- Result{Type: RTChannel, ChannelID: req.sl.Channel, Err: err}
+				if !sendResult(ctx, results, Result{Type: RTChannel, ChannelID: req.sl.Channel, Err: err}) {
+					return
+				}
 				continue
 			}
 
@@ -59,10 +60,14 @@ func (cs *Stream) channelWorker(ctx context.Context, proc processor.Conversation
 				if err != nil {
 					return err
 				}
-				results <- Result{Type: RTChannel, ChannelID: req.sl.Channel, ThreadCount: n, IsLast: isLast}
+				if !sendResult(ctx, results, Result{Type: RTChannel, ChannelID: req.sl.Channel, ThreadCount: n, IsLast: isLast}) {
+					return context.Cause(ctx)
+				}
 				return nil
 			}); err != nil {
-				results <- Result{Type: RTChannel, ChannelID: req.sl.Channel, Err: err}
+				if !sendResult(ctx, results, Result{Type: RTChannel, ChannelID: req.sl.Channel, Err: err}) {
+					return
+				}
 				continue
 			}
 		}
@@ -76,14 +81,15 @@ func (cs *Stream) threadWorker(ctx context.Context, proc processor.Conversations
 	for {
 		select {
 		case <-ctx.Done():
-			results <- Result{Type: RTThread, Err: ctx.Err()}
 			return
 		case req, more := <-threadReq:
 			if !more {
 				return // channel closed
 			}
 			if !req.sl.IsThread() {
-				results <- Result{Type: RTThread, Err: fmt.Errorf("invalid thread link: %s", req.sl)}
+				if !sendResult(ctx, results, Result{Type: RTThread, Err: fmt.Errorf("invalid thread link: %s", req.sl)}) {
+					return
+				}
 				continue
 			}
 
@@ -96,7 +102,9 @@ func (cs *Stream) threadWorker(ctx context.Context, proc processor.Conversations
 				// user IDs. Skipping procChannelUsers saves an API call per thread.
 				var err error
 				if channel, err = cs.procChannelInfo(ctx, proc, req.sl.Channel, req.sl.ThreadTS); err != nil {
-					results <- Result{Type: RTThread, ChannelID: req.sl.Channel, ThreadTS: req.sl.ThreadTS, Err: err}
+					if !sendResult(ctx, results, Result{Type: RTThread, ChannelID: req.sl.Channel, ThreadTS: req.sl.ThreadTS, Err: err}) {
+						return
+					}
 					continue
 				}
 			} else {
@@ -109,16 +117,29 @@ func (cs *Stream) threadWorker(ctx context.Context, proc processor.Conversations
 				if err := procThreadMsg(ctx, proc, channel, req.sl.ThreadTS, req.threadOnly, isLast, msgs); err != nil {
 					return err
 				}
-				results <- Result{Type: RTThread, ChannelID: req.sl.Channel, ThreadTS: req.sl.ThreadTS, IsLast: isLast}
+				if !sendResult(ctx, results, Result{Type: RTThread, ChannelID: req.sl.Channel, ThreadTS: req.sl.ThreadTS, IsLast: isLast}) {
+					return context.Cause(ctx)
+				}
 				return nil
 			}); err != nil {
-				results <- Result{Type: RTThread, ChannelID: req.sl.Channel, ThreadTS: req.sl.ThreadTS, Err: err}
+				if !sendResult(ctx, results, Result{Type: RTThread, ChannelID: req.sl.Channel, ThreadTS: req.sl.ThreadTS, Err: err}) {
+					return
+				}
 				continue
 			}
 		}
 	}
 }
 
+func sendResult(ctx context.Context, results chan<- Result, res Result) bool {
+	select {
+	case results <- res:
+		return true
+	case <-ctx.Done():
+		return false
+	}
+}
+
 func (cs *Stream) channelInfoWorker(ctx context.Context, proc processor.ChannelInformer, srC chan<- Result, channelIdC <-chan string) {
 	ctx, task := trace.NewTask(ctx, "channelInfoWorker")
 	defer task.End()
@@ -147,7 +168,9 @@ func (cs *Stream) channelInfoWorker(ctx context.Context, proc processor.ChannelI
 
 			if _, err := infoFetcher(ctx, proc, id, ""); err != nil {
 				// if _, err := cs.procChannelInfo(ctx, proc, id, ""); err != nil {
-				srC <- Result{Type: RTChannelInfo, ChannelID: id, Err: fmt.Errorf("channelInfoWorker: %s: %w", id, err)}
+				if !sendResult(ctx, srC, Result{Type: RTChannelInfo, ChannelID: id, Err: fmt.Errorf("channelInfoWorker: %s: %w", id, err)}) {
+					return
+				}
 			}
 			seen[id] = struct{}{}
 		}
```

---

### Incident Patch 11: `7d8fc4ab` (2026-07-26)
**Commit Message**: fix canvas archive compatibility

**File**: `internal/chunk/directory.go` (modified, +10/-0)
```diff
@@ -569,6 +569,16 @@ func (d *Directory) CanvasThreadMessages(_ context.Context, hiddenChannelID, thr
 		if err != nil {
 			return err
 		}
+		roots, err := f.CanvasMessages(hiddenChannelID)
+		if err != nil && !errors.Is(err, ErrNotFound) {
+			return err
+		}
+		for _, root := range roots {
+			if root.Timestamp == threadTS {
+				latest[root.Timestamp] = root
+				break
+			}
+		}
 		mm, err := f.CanvasThreadMessages(hiddenChannelID, threadTS)
 		if err != nil {
 			if errors.Is(err, ErrNotFound) {
```

**File**: `internal/chunk/directory_test.go` (modified, +12/-2)
```diff
@@ -192,11 +192,16 @@ func TestDirectory_CanvasMessages(t *testing.T) {
 		ThreadTimestamp: root.Timestamp,
 		Text:            "reply",
 	}}
+	rootWithoutReplies := slack.Message{Msg: slack.Msg{
+		Timestamp:       "1700000002.000001",
+		ThreadTimestamp: "1700000002.000001",
+		Text:            "root without replies",
+	}}
 	data := append(
 		testutil.MarshalJSON(t, Chunk{
 			Type:      CCanvasMessages,
 			ChannelID: "CCANVAS",
-			Messages:  []slack.Message{root},
+			Messages:  []slack.Message{root, rootWithoutReplies},
 		}),
 		testutil.MarshalJSON(t, Chunk{
 			Type:      CCanvasThreadMessages,
@@ -215,14 +220,19 @@ func TestDirectory_CanvasMessages(t *testing.T) {
 
 	roots, err := d.CanvasMessages(t.Context(), "CCANVAS")
 	require.NoError(t, err)
-	require.Len(t, roots, 1)
+	require.Len(t, roots, 2)
 	assert.Equal(t, "root", roots[0].Text)
 
 	thread, err := d.CanvasThreadMessages(t.Context(), "CCANVAS", root.Timestamp)
 	require.NoError(t, err)
 	require.Len(t, thread, 2)
 	assert.Equal(t, "reply", thread[1].Text)
 
+	thread, err = d.CanvasThreadMessages(t.Context(), "CCANVAS", rootWithoutReplies.Timestamp)
+	require.NoError(t, err)
+	require.Len(t, thread, 1)
+	assert.Equal(t, "root without replies", thread[0].Text)
+
 	messages, err := d.AllMessages(t.Context(), "CCANVAS")
 	require.NoError(t, err)
 	assert.Empty(t, messages)
```

**File**: `internal/convert/html.go` (modified, +30/-10)
```diff
@@ -202,6 +202,9 @@ func (c *HTMLConverter) copyCanvasFiles(ctx context.Context, ch *slack.Channel,
 	}
 	fc := NewFileCopier(c.src, c.trg, htmlFilePath, true)
 	for _, root := range roots {
+		if err := c.copyMessageFiles(ctx, fc, ch, ch.ID, &root); err != nil {
+			return err
+		}
 		threadTS := root.ThreadTimestamp
 		if threadTS == "" {
 			threadTS = root.Timestamp
@@ -210,8 +213,19 @@ func (c *HTMLConverter) copyCanvasFiles(ctx context.Context, ch *slack.Channel,
 		if err != nil {
 			return err
 		}
-		if err := c.copyFileSeq(ctx, fc, ch, ch.ID, it); err != nil {
-			return err
+		for msg, err := range it {
+			if err != nil {
+				if errors.Is(err, source.ErrNotFound) {
+					break
+				}
+				return err
+			}
+			if msg.Timestamp == root.Timestamp {
+				continue
+			}
+			if err := c.copyMessageFiles(ctx, fc, ch, ch.ID, &msg); err != nil {
+				return err
+			}
 		}
 	}
 	return nil
@@ -258,19 +272,25 @@ func (c *HTMLConverter) copyFileSeq(ctx context.Context, fc *FileCopier, ch *sla
 			}
 			return err
 		}
-		err = fc.Copy(ch, &msg)
-		if err == nil {
-			continue
-		}
-		if errors.Is(err, fs.ErrNotExist) || errors.Is(err, source.ErrNotFound) {
-			c.lg.WarnContext(ctx, "skipping missing file asset", "channel", channelID, "ts", msg.Timestamp, "error", err)
-			continue
+		if err := c.copyMessageFiles(ctx, fc, ch, channelID, &msg); err != nil {
+			return err
 		}
-		return err
 	}
 	return nil
 }
 
+func (c *HTMLConverter) copyMessageFiles(ctx context.Context, fc *FileCopier, ch *slack.Channel, channelID string, msg *slack.Message) error {
+	err := fc.Copy(ch, msg)
+	if err == nil {
+		return nil
+	}
+	if errors.Is(err, fs.ErrNotExist) || errors.Is(err, source.ErrNotFound) {
+		c.lg.WarnContext(ctx, "skipping missing file asset", "channel", channelID, "ts", msg.Timestamp, "error", err)
+		return nil
+	}
+	return err
+}
+
 func (c *HTMLConverter) copyAvatars(users []slack.User) error {
 	if c.src.Avatars().Type() == source.STnone {
 		return nil
```

**File**: `internal/convert/html_test.go` (modified, +11/-3)
```diff
@@ -57,6 +57,7 @@ func TestHTMLConverter_Convert(t *testing.T) {
 			},
 			canvasRoots: []slack.Message{
 				{Msg: slack.Msg{Timestamp: "1720000000.000001", ThreadTimestamp: "1720000000.000001", ReplyCount: 1, User: "U1", Text: "canvas root"}},
+				{Msg: slack.Msg{Timestamp: "1720000002.000001", ThreadTimestamp: "1720000002.000001", User: "U1", Text: "canvas root without replies", Files: []slack.File{{ID: "FcanvasRoot", Name: "root.txt"}}}},
 			},
 			canvasThreads: map[string][]slack.Message{
 				"1720000000.000001": {
@@ -66,10 +67,15 @@ func TestHTMLConverter_Convert(t *testing.T) {
 			},
 			files: htmlStorage{
 				fsys: fstest.MapFS{
-					"F1/hello.txt":        {Data: []byte("hello")},
-					"Fcanvas/canvas.html": {Data: []byte("<html><body>canvas</body></html>")},
+					"F1/hello.txt":         {Data: []byte("hello")},
+					"Fcanvas/canvas.html":  {Data: []byte("<html><body>canvas</body></html>")},
+					"FcanvasRoot/root.txt": {Data: []byte("canvas root attachment")},
+				},
+				byID: map[string]string{
+					"F1":          "F1/hello.txt",
+					"Fcanvas":     "Fcanvas/canvas.html",
+					"FcanvasRoot": "FcanvasRoot/root.txt",
 				},
-				byID: map[string]string{"F1": "F1/hello.txt", "Fcanvas": "Fcanvas/canvas.html"},
 			},
 			avatars: htmlStorage{
 				fsys: fstest.MapFS{
@@ -94,8 +100,10 @@ func TestHTMLConverter_Convert(t *testing.T) {
 			"archives/C1/canvas/content.html",
 			"archives/C1/canvas/comments/index.html",
 			"archives/C1/canvas/comments/1720000000.000001/index.html",
+			"archives/C1/canvas/comments/1720000002.000001/index.html",
 			"archives/CEMPTY/index.html",
 			"files/F1/hello.txt",
+			"files/FcanvasRoot/root.txt",
 			"avatars/U1/ada.png",
 			"static/48x48.gif",
 			"static/htmx.min.js",
```

**File**: `stream/stream_workers.go` (modified, +9/-8)
```diff
@@ -56,17 +56,18 @@ func (cs *Stream) channelWorker(ctx context.Context, proc processor.Conversation
 
 			// Check for the channel canvas.
 			if fileID, ok := structures.CanvasFileID(channel); ok {
+				if err := cs.canvasFile(ctx, proc, channel, fileID); err != nil {
+					if canvasErrorIsFatal(err) {
+						results <- Result{Type: RTChannel, ChannelID: req.sl.Channel, Err: err}
+						continue
+					}
+					logCanvasAPIError(ctx, "canvas file unavailable", channel.ID, fileID, "", "", err)
+				}
+
 				canvasClient, supported := cs.client.(canvasRootClient)
 				if !supported || !canvasClient.CanvasSupported() {
-					slog.DebugContext(ctx, "skipping canvas for non-client-token session", "owner_channel_id", channel.ID, "canvas_file_id", fileID)
+					slog.DebugContext(ctx, "skipping canvas discussions for non-client-token session", "owner_channel_id", channel.ID, "canvas_file_id", fileID)
 				} else {
-					if err := cs.canvasFile(ctx, proc, channel, fileID); err != nil {
-						if canvasErrorIsFatal(err) {
-							results <- Result{Type: RTChannel, ChannelID: req.sl.Channel, Err: err}
-							continue
-						}
-						logCanvasAPIError(ctx, "canvas file unavailable", channel.ID, fileID, "", "", err)
-					}
 					if cm, ok := processor.AsCanvasMessenger(proc); ok {
 						if err := cs.canvasDiscussions(ctx, proc, cm, threadC, req, channel, fileID); err != nil {
 							if canvasErrorIsFatal(err) {
```

**File**: `stream/stream_workers_test.go` (modified, +6/-0)
```diff
@@ -77,6 +77,12 @@ func TestStream_channelWorker(t *testing.T) {
 		Return(nil, "", nil)
 	mc.EXPECT().ChannelInfo(gomock.Any(), owner, "").Return(nil)
 	mc.EXPECT().ChannelUsers(gomock.Any(), "COWNER", "", []string(nil)).Return(nil)
+	ms.EXPECT().
+		GetFileInfoContext(gomock.Any(), "FCANVAS", 0, 1).
+		Return(&slack.File{ID: "FCANVAS"}, nil, nil, nil)
+	mc.EXPECT().
+		Files(gomock.Any(), owner, slack.Message{}, []slack.File{{ID: "FCANVAS"}}).
+		Return(nil)
 	ms.EXPECT().
 		GetConversationHistoryContext(gomock.Any(), gomock.Any()).
 		DoAndReturn(func(_ context.Context, params *slack.GetConversationHistoryParameters) (*slack.GetConversationHistoryResponse, error) {
```

---

### Incident Patch 12: `99903891` (2026-07-26)
**Commit Message**: fix canvas archive completion

**File**: `cmd/slackdump/internal/resume/resume.go` (modified, +4/-1)
```diff
@@ -204,7 +204,10 @@ func runResume(ctx context.Context, cmd *base.Command, args []string) error {
 	}
 	// inclusive is false, because we don't want to include the latest message
 	// which is already in the database.
-	streamOpts := []stream.Option{stream.OptInclusive(false)}
+	streamOpts := []stream.Option{
+		stream.OptInclusive(false),
+		stream.OptIncludeOlderCanvasRoots(),
+	}
 	if resumeFlags.SkipCompleteThreads {
 		streamOpts = append(
 			streamOpts,
```

**File**: `internal/chunk/backend/directory/conversations_test.go` (modified, +43/-0)
```diff
@@ -22,6 +22,7 @@ import (
 	"testing"
 
 	"github.com/rusq/slack"
+	"github.com/stretchr/testify/require"
 	"go.uber.org/mock/gomock"
 
 	"github.com/rusq/slackdump/v4/internal/chunk"
@@ -406,6 +407,48 @@ func TestConversations_ThreadMessages(t *testing.T) {
 	}
 }
 
+func TestConversations_CanvasMessages(t *testing.T) {
+	ctrl := gomock.NewController(t)
+	mt := NewMocktracker(ctrl)
+	mh := NewMockdatahandler(ctrl)
+	cv := &Conversations{t: mt, lg: slog.Default()}
+	id := chunk.ToFileID("CCANVAS", "", false)
+	root := slack.Message{Msg: slack.Msg{
+		Timestamp:       "1.0",
+		ThreadTimestamp: "1.0",
+		ReplyCount:      1,
+	}}
+
+	mt.EXPECT().Recorder(id).Return(mh, nil)
+	mh.EXPECT().Add(1).Return(2)
+	mh.EXPECT().CanvasMessages(gomock.Any(), "CCANVAS", 1, true, []slack.Message{root}).Return(nil)
+	mh.EXPECT().Dec().Return(1)
+	mt.EXPECT().RefCount(id).Return(1)
+
+	require.NoError(t, cv.CanvasMessages(t.Context(), "CCANVAS", 1, true, []slack.Message{root}))
+}
+
+func TestConversations_CanvasThreadMessages(t *testing.T) {
+	ctrl := gomock.NewController(t)
+	mt := NewMocktracker(ctrl)
+	mh := NewMockdatahandler(ctrl)
+	cv := &Conversations{t: mt, lg: slog.Default()}
+	id := chunk.ToFileID("CCANVAS", "", false)
+	root := slack.Message{Msg: slack.Msg{
+		Timestamp:       "1.0",
+		ThreadTimestamp: "1.0",
+		ReplyCount:      1,
+	}}
+
+	mt.EXPECT().Recorder(id).Return(mh, nil)
+	mh.EXPECT().CanvasThreadMessages(gomock.Any(), "CCANVAS", root, true, []slack.Message{root}).Return(nil)
+	mh.EXPECT().Dec().Return(0)
+	mt.EXPECT().RefCount(id).Return(0)
+	mt.EXPECT().Unregister(id).Return(nil)
+
+	require.NoError(t, cv.CanvasThreadMessages(t.Context(), "CCANVAS", root, true, []slack.Message{root}))
+}
+
 func TestConversations_ChannelInfo(t *testing.T) {
 	textCtx := t.Context()
 	type fields struct {
```

**File**: `internal/chunk/obfuscate/ids.go` (modified, +11/-0)
```diff
@@ -49,3 +49,14 @@ func (o obfuscator) TeamID(g string) string        { return o.ID(teamPrefix, g)
 func (o *obfuscator) BotID(b string) string        { return o.ID(botPrefix, b) }
 func (o *obfuscator) AppID(a string) string        { return o.ID(appPrefix, a) }
 func (o *obfuscator) EnterpriseID(e string) string { return o.ID(entPrefix, e) }
+
+// CanvasChannelID obfuscates a hidden canvas channel while preserving Slack's
+// relationship between canvas file IDs and hidden channel IDs.
+func (o obfuscator) CanvasChannelID(channelID string) string {
+	if len(channelID) < 2 || channelID[0] != 'C' {
+		return o.ChannelID(channelID)
+	}
+	fileID := "F" + channelID[1:]
+	obfuscatedFileID := o.FileID(fileID)
+	return "C" + obfuscatedFileID[1:]
+}
```

**File**: `internal/chunk/obfuscate/obfuscate.go` (modified, +9/-1)
```diff
@@ -111,7 +111,12 @@ type obfuscator struct {
 }
 
 func (o obfuscator) Chunk(c *chunk.Chunk) {
-	c.ChannelID = o.ChannelID(c.ChannelID)
+	switch c.Type {
+	case chunk.CCanvasMessages, chunk.CCanvasThreadMessages:
+		c.ChannelID = o.CanvasChannelID(c.ChannelID)
+	default:
+		c.ChannelID = o.ChannelID(c.ChannelID)
+	}
 	switch c.Type {
 	case chunk.CMessages, chunk.CCanvasMessages:
 		o.Messages(c.Messages...)
@@ -317,6 +322,9 @@ func (o obfuscator) Channel(c *slack.Channel) {
 	for i := range c.Members {
 		c.Members[i] = o.UserID(c.Members[i])
 	}
+	if c.Properties != nil && c.Properties.Canvas.FileId != "" {
+		c.Properties.Canvas.FileId = o.FileID(c.Properties.Canvas.FileId)
+	}
 }
 
 func (o obfuscator) Users(uu ...slack.User) {
```

**File**: `internal/chunk/obfuscate/obfuscate_test.go` (modified, +53/-0)
```diff
@@ -27,9 +27,11 @@ import (
 
 	"github.com/rusq/slack"
 	"github.com/stretchr/testify/assert"
+	"github.com/stretchr/testify/require"
 
 	"github.com/rusq/slackdump/v4/internal/chunk"
 	"github.com/rusq/slackdump/v4/internal/fixtures"
+	"github.com/rusq/slackdump/v4/internal/structures"
 )
 
 const testSeed = 0
@@ -104,6 +106,57 @@ func Test_Do(t *testing.T) {
 	}
 }
 
+func Test_obfuscator_Chunk(t *testing.T) {
+	const (
+		ownerChannelID = "COWNER01"
+		canvasFileID   = "FCANVAS1"
+		hiddenChannel  = "CCANVAS1"
+	)
+	o := newObfuscator(testRNG())
+	channel := &slack.Channel{
+		GroupConversation: slack.GroupConversation{
+			Conversation: slack.Conversation{ID: ownerChannelID},
+		},
+		Properties: &slack.Properties{
+			Canvas: slack.Canvas{FileId: canvasFileID},
+		},
+	}
+	channelChunk := &chunk.Chunk{
+		Type:      chunk.CChannelInfo,
+		ChannelID: ownerChannelID,
+		Channel:   channel,
+	}
+	canvasChunk := &chunk.Chunk{
+		Type:      chunk.CCanvasMessages,
+		ChannelID: hiddenChannel,
+	}
+	canvasThreadChunk := &chunk.Chunk{
+		Type:      chunk.CCanvasThreadMessages,
+		ChannelID: hiddenChannel,
+		Parent:    &slack.Message{},
+	}
+	fileChunk := &chunk.Chunk{
+		Type:      chunk.CFiles,
+		ChannelID: ownerChannelID,
+		Parent:    &slack.Message{},
+		Files:     []slack.File{{ID: canvasFileID}},
+	}
+
+	o.Chunk(channelChunk)
+	o.Chunk(canvasChunk)
+	o.Chunk(canvasThreadChunk)
+	o.Chunk(fileChunk)
+
+	obfuscatedFileID, ok := structures.CanvasFileID(channel)
+	require.True(t, ok)
+	assert.Equal(t, fileChunk.Files[0].ID, obfuscatedFileID)
+	derivedChannelID, ok := structures.CanvasChannelID(obfuscatedFileID)
+	require.True(t, ok)
+	assert.Equal(t, derivedChannelID, canvasChunk.ChannelID)
+	assert.Equal(t, derivedChannelID, canvasThreadChunk.ChannelID)
+	assert.Equal(t, channelChunk.ChannelID, fileChunk.ChannelID)
+}
+
 func unmarshalEvents(r io.Reader) []chunk.Chunk {
 	var chunks []chunk.Chunk
 	dec := json.NewDecoder(r)
```

**File**: `stream/conversation.go` (modified, +1/-0)
```diff
@@ -191,6 +191,7 @@ const (
 type canvasRequest struct {
 	owner  *slack.Channel
 	fileID string
+	done   chan error
 }
 
 type apiError struct {
```

**File**: `stream/stream.go` (modified, +22/-11)
```diff
@@ -50,17 +50,18 @@ const (
 // Stream is used to fetch conversations from Slack.  It is safe for concurrent
 // use.
 type Stream struct {
-	oldest, latest   time.Time
-	client           client.Slack
-	limits           rateLimits
-	chanCache        *chanCache
-	userCache        *userCache
-	fastSearch       bool
-	inclusive        bool
-	failChnlNotFnd   bool // if true, will fail if channel not found
-	resultFn         []func(sr Result) error
-	skipThread       func(ctx context.Context, channelID, threadTS string, replyCount int) bool
-	skipCanvasThread func(ctx context.Context, channelID, threadTS string, replyCount int) bool
+	oldest, latest          time.Time
+	client                  client.Slack
+	limits                  rateLimits
+	chanCache               *chanCache
+	userCache               *userCache
+	fastSearch              bool
+	inclusive               bool
+	failChnlNotFnd          bool // if true, will fail if channel not found
+	resultFn                []func(sr Result) error
+	skipThread              func(ctx context.Context, channelID, threadTS string, replyCount int) bool
+	skipCanvasThread        func(ctx context.Context, channelID, threadTS string, replyCount int) bool
+	includeOlderCanvasRoots bool
 }
 
 // ResultType helps to identify the type of the result, so that the callback
@@ -200,6 +201,16 @@ func OptSkipCanvasThreadFunc(fn func(ctx context.Context, channelID, threadTS st
 	}
 }
 
+// OptIncludeOlderCanvasRoots includes canvas discussion roots older than the
+// configured lower time bound. Reply fetching still honours the configured
+// oldest and latest bounds. This is intended for resume operations, where an
+// older discussion may have received new replies.
+func OptIncludeOlderCanvasRoots() Option {
+	return func(cs *Stream) {
+		cs.includeOlderCanvasRoots = true
+	}
+}
+
 // New creates a new Stream instance that allows to stream different slack
 // entities.
 func New(cl client.Slack, l network.Limits, opts ...Option) *Stream {
```

**File**: `stream/stream_workers.go` (modified, +73/-24)
```diff
@@ -108,19 +108,27 @@ func (cs *Stream) threadWorker(ctx context.Context, proc processor.Conversations
 			if !more {
 				return // channel closed
 			}
+			if req.kind == requestCanvas {
+				if req.canvas == nil || req.canvas.done == nil {
+					result := Result{Type: RTThread, Err: errors.New("canvas thread request is missing completion metadata")}
+					if req.sl != nil {
+						result.ChannelID = req.sl.Channel
+						result.ThreadTS = req.sl.ThreadTS
+					}
+					results <- result
+					continue
+				}
+				err := cs.processCanvasThread(ctx, proc, req)
+				req.canvas.done <- err
+				continue
+			}
 			if !req.sl.IsThread() {
 				results <- Result{Type: RTThread, Err: fmt.Errorf("invalid thread link: %s", req.sl)}
 				continue
 			}
 
 			channel := new(slack.Channel)
-			if req.kind == requestCanvas {
-				if req.canvas == nil || req.canvas.owner == nil {
-					results <- Result{Type: RTThread, ChannelID: req.sl.Channel, ThreadTS: req.sl.ThreadTS, Err: errors.New("canvas thread request is missing owner metadata")}
-					continue
-				}
-				channel = req.canvas.owner
-			} else if req.threadOnly {
+			if req.threadOnly {
 				// Thread-only requests come from direct thread links (e.g., resume).
 				// We only need channel info (ID, name, etc.) for file paths and
 				// identification. Channel users are already recorded from the
@@ -138,30 +146,55 @@ func (cs *Stream) threadWorker(ctx context.Context, proc processor.Conversations
 				channel.ID = req.sl.Channel
 			}
 			if err := cs.thread(ctx, req, func(msgs []slack.Message, isLast bool) error {
-				if req.kind == requestCanvas {
-					cm, ok := processor.AsCanvasMessenger(proc)
-					if !ok {
-						return errors.New("canvas processor capability is no longer available")
-					}
-					return procCanvasThreadMsg(ctx, proc, cm, channel, req.sl.Channel, isLast, msgs)
-				}
 				if err := procThreadMsg(ctx, proc, channel, req.sl.ThreadTS, req.threadOnly, isLast, msgs); err != nil {
 					return err
 				}
 				results <- Result{Type: RTThread, ChannelID: req.sl.Channel, ThreadTS: req.sl.ThreadTS, IsLast: isLast}
 				return nil
 			}); err != nil {
-				if req.kind == requestCanvas && !canvasErrorIsFatal(err) {
-					logCanvasAPIError(ctx, "canvas discussion unavailable", channel.ID, req.canvas.fileID, req.sl.Channel, req.sl.ThreadTS, err)
-					continue
-				}
 				results <- Result{Type: RTThread, ChannelID: req.sl.Channel, ThreadTS: req.sl.ThreadTS, Err: err}
 				continue
 			}
 		}
 	}
 }
 
+func (cs *Stream) processCanvasThread(ctx context.Context, proc processor.Conversations, req request) error {
+	if req.canvas == nil || req.canvas.owner == nil || req.canvas.done == nil {
+		return errors.New("canvas thread request is missing owner metadata")
+	}
+	if req.sl == nil || !req.sl.IsThread() {
+		return fmt.Errorf("invalid canvas thread link: %v", req.sl)
+	}
+	cm, ok := processor.AsCanvasMessenger(proc)
+	if !ok {
+		return errors.New("canvas processor capability is no longer available")
+	}
+	err := cs.thread(ctx, req, func(msgs []slack.Message, isLast bool) error {
+		return procCanvasThreadMsg(ctx, proc, cm, req.canvas.owner, req.sl.Channel, isLast, msgs)
+	})
+	if err == nil {
+		return nil
+	}
+	if canvasErrorIsFatal(err) {
+		return err
+	}
+
+	logCanvasAPIError(ctx, "canvas discussion unavailable", req.canvas.owner.ID, req.canvas.fileID, req.sl.Channel, req.sl.ThreadTS, err)
+	if err := procCanvasThreadMsg(
+		ctx,
+		proc,
+		cm,
+		req.canvas.owner,
+		req.sl.Channel,
+		true,
+		parentOnlyThreadMessages(req),
+	); err != nil {
+		return err
+	}
+	return nil
+}
+
 func (cs *Stream) channelInfoWorker(ctx context.Context, proc processor.ChannelInformer, srC chan<- Result, channelIdC <-chan string) {
 	ctx, task := trace.NewTask(ctx, "channelInfoWorker")
 	defer task.End()
@@ -244,7 +277,20 @@ func (cs *Stream) canvasDiscussions(ctx context.Context, proc processor.Conversa
 	if err != nil {
 		return newAPIError("canvas.threadRoots", err)
 	}
-	return cs.procCanvasMsg(ctx, proc, cm, threadC, canvasReq, true, roots)
+	numThreads, err := cs.procCanvasMsg(ctx, proc, cm, threadC, canvasReq, true, roots)
+	if err != nil {
+		return err
+	}
+	var errs error
+	for range numThreads {
+		select {
+		case err := <-canvasReq.canvas.done:
+			errs = errors.Join(errs, err)
+		case <-ctx.Done():
+			return context.Cause(ctx)
+		}
+	}
+	return errs
 }
 
 func (cs *Stream) filterCanvasRoots(messages []slack.Message, req request) ([]slack.Message, error) {
@@ -259,7 +305,9 @@ func (cs *Stream) filterCanvasRoots(messages []slack.Message, req request) ([]sl
 		if err != nil {
 			return nil, fmt.Errorf("invalid canvas root timestamp %q: %w", message.Timestamp, err)
 		}
-		beforeOldest := !oldest.IsZero() && (ts.Before(oldest) || (!cs.inclusive && ts.Equal(oldest)))
+		beforeOldest := !cs.includeOlderCanvasRoots &&
+			!oldest.IsZero() &&
+			(ts.Before(oldest) || (!cs.inclusive && ts.Equal(oldest)))
 		afterLatest := !latest.IsZero() && (ts.After(lat
```

---

### Incident Patch 13: `ade2f43c` (2026-07-26)
**Commit Message**: fix static html canvas display

**File**: `internal/convert/html_test.go` (modified, +8/-0)
```diff
@@ -126,6 +126,10 @@ func TestHTMLConverter_Convert(t *testing.T) {
 		if !strings.Contains(channelBody, `href="../../archives/C1/threads/1710000000.000001.html"`) {
 			t.Fatalf("channel page should rewrite thread links relatively: %q", channelBody)
 		}
+		if !strings.Contains(channelBody, `href="../../archives/C1/canvas/index.html"`) ||
+			!strings.Contains(channelBody, `id="tab-btn-canvas">Canvas</a>`) {
+			t.Fatalf("channel page should link the static canvas tab: %q", channelBody)
+		}
 
 		indexBody := readFile(t, outDir, "index.html")
 		if !strings.Contains(indexBody, `href="archives/C1/index.html"`) {
@@ -147,6 +151,10 @@ func TestHTMLConverter_Convert(t *testing.T) {
 		if !strings.Contains(canvasPage, `src="../../../archives/C1/canvas/content.html"`) {
 			t.Fatalf("canvas page should link to local canvas content relatively: %q", canvasPage)
 		}
+		if !strings.Contains(canvasPage, `href="../../../archives/C1/index.html"`) ||
+			!strings.Contains(canvasPage, `id="tab-btn-conversation">Conversation</a>`) {
+			t.Fatalf("canvas page should link back to the static conversation: %q", canvasPage)
+		}
 
 		canvasBody := readFile(t, outDir, "archives/C1/canvas/content.html")
 		if !strings.Contains(canvasBody, "canvas") {
```

**File**: `internal/viewer/render_test.go` (modified, +17/-0)
```diff
@@ -162,6 +162,14 @@ func TestRenderChannel_StaticMode(t *testing.T) {
 	if !strings.Contains(body, `aria-controls="tab-panel-conversation"`) || !strings.Contains(body, `role="tabpanel"`) {
 		t.Fatalf("RenderChannel() static mode should preserve tab ARIA, got: %q", body)
 	}
+	if !strings.Contains(body, `<a href="/archives/C1/index.html"`) ||
+		!strings.Contains(body, `id="tab-btn-conversation">Conversation</a>`) {
+		t.Fatalf("RenderChannel() static mode should render the conversation tab as a link, got: %q", body)
+	}
+	if !strings.Contains(body, `<a href="/archives/C1/canvas/index.html"`) ||
+		!strings.Contains(body, `id="tab-btn-canvas">Canvas</a>`) {
+		t.Fatalf("RenderChannel() static mode should render the canvas tab as a link, got: %q", body)
+	}
 }
 
 func TestRenderCanvas_StaticModePreservesSandbox(t *testing.T) {
@@ -186,4 +194,13 @@ func TestRenderCanvas_StaticModePreservesSandbox(t *testing.T) {
 	if strings.Contains(body, ` hx-`) || strings.Contains(body, `<script`) {
 		t.Fatalf("RenderCanvas() static mode should not contain live attributes or scripts, got: %q", body)
 	}
+	if !strings.Contains(body, `<a href="/archives/C1/index.html"`) ||
+		!strings.Contains(body, `id="tab-btn-conversation">Conversation</a>`) {
+		t.Fatalf("RenderCanvas() static mode should link back to the conversation, got: %q", body)
+	}
+	if !strings.Contains(body, `<a href="/archives/C1/canvas/index.html"`) ||
+		!strings.Contains(body, `class="tab selected"`) ||
+		!strings.Contains(body, `id="tab-btn-canvas">Canvas</a>`) {
+		t.Fatalf("RenderCanvas() static mode should render the active canvas tab as a link, got: %q", body)
+	}
 }
```

**File**: `internal/viewer/templates/index.html` (modified, +32/-4)
```diff
@@ -133,23 +133,51 @@ <h2>{{ channelname .Conversation }}</h2>
 
 {{ define "tab_list" }}
 <div class="tab-list" role="tablist" aria-label="Channel views">
-    <button {{ if .Interactive }}hx-get="{{ channelurl .Conversation.ID }}"
-        hx-target="#conversation" hx-swap="innerHTML"{{ end }}
+    {{ if .Interactive }}
+    <button hx-get="{{ channelurl .Conversation.ID }}"
+        hx-target="#conversation" hx-swap="innerHTML"
         class="tab{{ if not .CanvasActive }} selected{{ end }}"
         role="tab"
         tabindex="{{ if not .CanvasActive }}0{{ else }}-1{{ end }}"
         aria-selected="{{ if not .CanvasActive }}true{{ else }}false{{ end }}"
         aria-controls="tab-panel-conversation"
         id="tab-btn-conversation">Conversation</button>
-    <button {{ if .Interactive }}hx-get="{{ canvasurl .Conversation.ID }}"
-        hx-target="#conversation" hx-swap="innerHTML"{{ end }}
+    {{ else }}
+    <a href="{{ channelurl .Conversation.ID }}"
+        class="tab{{ if not .CanvasActive }} selected{{ end }}"
+        role="tab"
+        tabindex="0"
+        aria-selected="{{ if not .CanvasActive }}true{{ else }}false{{ end }}"
+        aria-controls="tab-panel-conversation"
+        id="tab-btn-conversation">Conversation</a>
+    {{ end }}
+    {{ if .Interactive }}
+    <button hx-get="{{ canvasurl .Conversation.ID }}"
+        hx-target="#conversation" hx-swap="innerHTML"
         class="tab{{ if .CanvasActive }} selected{{ end }}{{ if not .CanvasAvailable }} disabled{{ end }}"
         role="tab"
         tabindex="{{ if .CanvasActive }}0{{ else }}-1{{ end }}"
         aria-selected="{{ if .CanvasActive }}true{{ else }}false{{ end }}"
         aria-controls="tab-panel-canvas"
         id="tab-btn-canvas"
         {{ if not .CanvasAvailable }}disabled{{ end }}>Canvas</button>
+    {{ else if .CanvasAvailable }}
+    <a href="{{ canvasurl .Conversation.ID }}"
+        class="tab{{ if .CanvasActive }} selected{{ end }}"
+        role="tab"
+        tabindex="0"
+        aria-selected="{{ if .CanvasActive }}true{{ else }}false{{ end }}"
+        aria-controls="tab-panel-canvas"
+        id="tab-btn-canvas">Canvas</a>
+    {{ else }}
+    <span class="tab disabled"
+        role="tab"
+        tabindex="-1"
+        aria-selected="false"
+        aria-disabled="true"
+        aria-controls="tab-panel-canvas"
+        id="tab-btn-canvas">Canvas</span>
+    {{ end }}
 </div>
 {{ end }}
 
```

**File**: `internal/viewer/templates/styles.html` (modified, +8/-6)
```diff
@@ -499,7 +499,7 @@
         margin-top: .5rem;
     }
 
-    button.tab {
+    .tab {
         background: none;
         border: 1px solid transparent;
         border-bottom: none;
@@ -509,22 +509,23 @@
         font-size: .875rem;
         border-radius: 4px 4px 0 0;
         font-family: inherit;
+        text-decoration: none;
         /* reserve space for the accent bar so layout doesn't shift on select */
         box-shadow: inset 0 -3px 0 transparent;
         transition: color 0.1s, box-shadow 0.1s;
     }
 
-    button.tab:hover:not([disabled]) {
+    .tab:hover:not([disabled]):not([aria-disabled="true"]) {
         color: var(--text-color);
         background-color: var(--hover-color);
     }
 
-    button.tab:focus-visible {
+    .tab:focus-visible {
         outline: 2px solid var(--secondary-color);
         outline-offset: -2px;
     }
 
-    button.tab.selected {
+    .tab.selected {
         border-color: var(--border-color);
         color: var(--text-color);
         font-weight: 700;
@@ -533,8 +534,9 @@
         box-shadow: inset 0 -3px 0 var(--primary-color);
     }
 
-    button.tab.disabled,
-    button.tab[disabled] {
+    .tab.disabled,
+    .tab[disabled],
+    .tab[aria-disabled="true"] {
         opacity: 0.4;
         cursor: not-allowed;
         pointer-events: none;
```

---

### Incident Patch 14: `84cd6105` (2026-07-26)
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

**File**: `internal/client/mock_client/mock_client.go` (modified, +2/-2)
```diff
@@ -167,11 +167,11 @@ func (mr *MockSlackMockRecorder) GetFileInfoContext(ctx, fileID, count, page any
 }
 
 // GetStarredContext mocks base method.
-func (m *MockSlack) GetStarredContext(ctx context.Context, params slack.StarsParameters) ([]slack.StarredItem, *slack.Paging, error) {
+func (m *MockSlack) GetStarredContext(ctx context.Context, params slack.StarsParameters) ([]slack.StarredItem, string, error) {
 	m.ctrl.T.Helper()
 	ret := m.ctrl.Call(m, "GetStarredContext", ctx, params)
 	ret0, _ := ret[0].([]slack.StarredItem)
-	ret1, _ := ret[1].(*slack.Paging)
+	ret1, _ := ret[1].(string)
 	ret2, _ := ret[2].(error)
 	return ret0, ret1, ret2
 }
```

**File**: `internal/client/pool.go` (modified, +1/-1)
```diff
@@ -75,7 +75,7 @@ func (p *Pool) GetUsersPaginated(options ...slack.GetUsersOption) slack.UserPagi
 	return p.next().GetUsersPaginated(options...)
 }
 
-func (p *Pool) GetStarredContext(ctx context.Context, params slack.StarsParameters) ([]slack.StarredItem, *slack.Paging, error) {
+func (p *Pool) GetStarredContext(ctx context.Context, params slack.StarsParameters) ([]slack.StarredItem, string, error) {
 	return p.next().GetStarredContext(ctx, params)
 }
 
```

**File**: `internal/edge/wrapper.go` (modified, +1/-1)
```diff
@@ -57,7 +57,7 @@ func (w *Wrapper) GetUsersPaginated(options ...slack.GetUsersOption) slack.UserP
 	return w.cl.GetUsersPaginated(options...)
 }
 
-func (w *Wrapper) GetStarredContext(ctx context.Context, params slack.StarsParameters) ([]slack.StarredItem, *slack.Paging, error) {
+func (w *Wrapper) GetStarredContext(ctx context.Context, params slack.StarsParameters) ([]slack.StarredItem, string, error) {
 	return w.cl.GetStarredContext(ctx, params)
 }
 
```

---

### Incident Patch 15: `37e7f8c6` (2026-07-13)
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

**File**: `cmd/slackdump/internal/mcp/assets/mcp.md` (modified, +36/-10)
```diff
@@ -1,8 +1,8 @@
 # slackdump mcp
 
 Start a local **Model Context Protocol (MCP)** server that exposes Slackdump
-archive data to AI agents (such as GitHub Copilot, Claude Desktop, or any MCP
-client).
+archive data to AI agents (such as Codex, GitHub Copilot, Claude Desktop, or
+any MCP client).
 
 The server is read-only: it never modifies the underlying archive.
 
@@ -41,10 +41,14 @@ slackdump mcp -new <layout> <directory>
   Claude Code), plus skill content in `CLAUDE.md` (main guidance) and
   `.claude/slackdump-source.md` / `.claude/slackdump-sqlite3.md`.
 
-- **`copilot`** — creates `.vscode/mcp.json` wiring up the MCP server for VS
-  Code / GitHub Copilot, plus `.github/copilot-instructions.md` (always-on
+- **`copilot`** — creates `.mcp.json` wiring up the MCP server for VS Code /
+  GitHub Copilot, plus `.github/copilot-instructions.md` (always-on
   guidance) and two file-scoped instruction files in `.github/instructions/`.
 
+- **`codex`** — creates `.codex/config.toml` with a project-scoped Slackdump
+  MCP server, plus the `slackdump`, `slackdump-source`, and
+  `slackdump-sqlite3` skills inside `.agents/skills/`.
+
 **Example — set up an OpenCode project:**
 
 ```
@@ -98,8 +102,8 @@ slackdump mcp -new copilot ~/my-slack-project
 
 After running this command:
 
-1. `~/my-slack-project/.vscode/mcp.json` wires up the Slackdump MCP server
-   for VS Code / GitHub Copilot Agent mode.
+1. `~/my-slack-project/.mcp.json` wires up the Slackdump MCP server for VS
+   Code / GitHub Copilot Agent mode.
 2. `~/my-slack-project/.github/copilot-instructions.md` provides always-on
    Slackdump guidance to Copilot.
 3. `~/my-slack-project/.github/instructions/` contains additional
@@ -111,6 +115,28 @@ Open the project directory in VS Code:
 code ~/my-slack-project
 ```
 
+**Example — set up a Codex project:**
+
+```
+slackdump mcp -new codex ~/my-slack-project
+```
+
+After running this command:
+
+1. `~/my-slack-project/.codex/config.toml` registers the Slackdump MCP server
+   as a project-scoped stdio server.
+2. `~/my-slack-project/.agents/skills/` contains three skills that teach Codex
+   how to work with Slackdump archives, source formats, and direct SQLite
+   access.
+
+Open the project directory in Codex and trust it when prompted so Codex loads
+the project-scoped MCP configuration:
+
+```
+cd ~/my-slack-project
+codex
+```
+
 ## Transport
 
 By default the server communicates over **stdio**, which is the standard
@@ -271,11 +297,11 @@ Omit the archive argument to let the agent call `load_source` to open one:
 
 ## Integrating with VS Code (GitHub Copilot)
 
-Add to your workspace `.vscode/mcp.json`:
+Add to your workspace `.mcp.json`:
 
 ```json
 {
-  "servers": {
+  "mcpServers": {
     "slackdump": {
       "type": "stdio",
       "command": "slackdump",
@@ -289,7 +315,7 @@ Omit the archive argument to let the agent call `load_source` to open one:
 
 ```json
 {
-  "servers": {
+  "mcpServers": {
     "slackdump": {
       "type": "stdio",
       "command": "slackdump",
@@ -362,4 +388,4 @@ config and restart OpenCode.
 - **`-listen`** _(default: `127.0.0.1:8483`)_ — Listen address when
   `-transport=http`.
 - **`-new`** — Create a new AI project layout instead of starting the server.
-  Supported layouts: `opencode`, `claude-code`, `copilot`.
+  Supported layouts: `opencode`, `claude-code`, `copilot`, `codex`.
```

**File**: `cmd/slackdump/internal/mcp/mcp.go` (modified, +2/-0)
```diff
@@ -64,12 +64,14 @@ const (
 	layoutOpencode   = "opencode"
 	layoutClaudeCode = "claude-code"
 	layoutCopilot    = "copilot"
+	layoutCodex      = "codex"
 )
 
 var projectLayouts = []string{
 	layoutOpencode,
 	layoutClaudeCode,
 	layoutCopilot,
+	layoutCodex,
 }
 
 func init() {
```

**File**: `cmd/slackdump/internal/mcp/mcp_test.go` (modified, +60/-30)
```diff
@@ -123,37 +123,67 @@ func Test_initNewProject_MissingSkill(t *testing.T) {
 
 // ─── runMCPNewProject ─────────────────────────────────────────────────────────
 
-func Test_runMCPNewProject_UnknownLayout(t *testing.T) {
-	err := runMCPNewProject(context.Background(), "nonexistent-layout", t.TempDir())
-	require.Error(t, err)
-	assert.Contains(t, err.Error(), "unknown project layout")
-}
-
-func Test_runMCPNewProject_Opencode(t *testing.T) {
-	tgt := filepath.Join(t.TempDir(), "proj")
-	err := runMCPNewProject(context.Background(), layoutOpencode, tgt)
-	require.NoError(t, err)
-	assert.DirExists(t, tgt)
-	assert.FileExists(t, filepath.Join(tgt, "opencode.jsonc"))
-	assert.FileExists(t, filepath.Join(tgt, ".opencode", "skills", "slackdump", "SKILL.md"))
-}
-
-func Test_runMCPNewProject_ClaudeCode(t *testing.T) {
-	tgt := filepath.Join(t.TempDir(), "proj")
-	err := runMCPNewProject(context.Background(), layoutClaudeCode, tgt)
-	require.NoError(t, err)
-	assert.DirExists(t, tgt)
-	assert.FileExists(t, filepath.Join(tgt, ".mcp.json"))
-	assert.FileExists(t, filepath.Join(tgt, "CLAUDE.md"))
-}
+func Test_runMCPNewProject(t *testing.T) {
+	tests := []struct {
+		name   string
+		layout string
+		files  []string
+	}{
+		{
+			name:   "opencode",
+			layout: layoutOpencode,
+			files: []string{
+				"opencode.jsonc",
+				filepath.Join(".opencode", "skills", "slackdump", "SKILL.md"),
+			},
+		},
+		{
+			name:   "claude code",
+			layout: layoutClaudeCode,
+			files: []string{
+				".mcp.json",
+				"CLAUDE.md",
+			},
+		},
+		{
+			name:   "copilot",
+			layout: layoutCopilot,
+			files: []string{
+				".mcp.json",
+				filepath.Join(".github", "copilot-instructions.md"),
+			},
+		},
+		{
+			name:   "codex",
+			layout: layoutCodex,
+			files: []string{
+				filepath.Join(".codex", "config.toml"),
+				filepath.Join(".agents", "skills", "slackdump", "SKILL.md"),
+				filepath.Join(".agents", "skills", "slackdump-source", "SKILL.md"),
+				filepath.Join(".agents", "skills", "slackdump-sqlite3", "SKILL.md"),
+			},
+		},
+	}
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			tgt := filepath.Join(t.TempDir(), "proj")
+			err := runMCPNewProject(context.Background(), tt.layout, tgt)
+			require.NoError(t, err)
+			assert.DirExists(t, tgt)
+			for _, name := range tt.files {
+				assert.FileExists(t, filepath.Join(tgt, name))
+			}
+			if tt.layout == layoutCodex {
+				assertFileContent(t, filepath.Join(tgt, ".codex", "config.toml"), "[mcp_servers.slackdump]\ncommand = \"slackdump\"\nargs = [\"mcp\"]\n")
+			}
+		})
+	}
 
-func Test_runMCPNewProject_Copilot(t *testing.T) {
-	tgt := filepath.Join(t.TempDir(), "proj")
-	err := runMCPNewProject(context.Background(), layoutCopilot, tgt)
-	require.NoError(t, err)
-	assert.DirExists(t, tgt)
-	assert.FileExists(t, filepath.Join(tgt, ".vscode", "mcp.json"))
-	assert.FileExists(t, filepath.Join(tgt, ".github", "copilot-instructions.md"))
+	t.Run("unknown layout", func(t *testing.T) {
+		err := runMCPNewProject(context.Background(), "nonexistent-layout", t.TempDir())
+		require.Error(t, err)
+		assert.Contains(t, err.Error(), "unknown project layout")
+	})
 }
 
 // ─── helpers ──────────────────────────────────────────────────────────────────
```

#### Recent Merged Pull Requests:
- **PR #744** (2026-10-03): Pre-release chores (@rusq)
- **PR #743** (2026-10-03): Viewer: add landing preference and jump to latest (@rusq)
- **PR #742** (2026-10-02): Security fixes (@rusq)
- **PR #739** (2026-09-25): update userBoot->client.init edge endpoint (@rusq)
- **PR #735** (2026-09-12): chunk: fix slow dedupe joins (@thomasmaerz)
- **PR #732** (2026-08-28): Update QR code login instructions (@ZimbiX)
- **PR #731** (2026-09-03): fix: show refreshed thread parents in channel timeline (@aerickson)
- **PR #728** (2026-08-19): fix workspace existence check (bump slackauth) (@rusq)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

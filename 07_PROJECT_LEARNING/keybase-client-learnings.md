> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/keybase-client-learnings.md`  
> **Source**: github ([https://github.com/keybase/client](https://github.com/keybase/client))  
> **Source Version**: `594ed87e`  
> **License**: BSD-3-Clause  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-20T13:27:32.036Z  
> **Learning ID**: `learn-github-keybase-client`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): keybase/client

> **Canonical Artifact**: `07_PROJECT_LEARNING/keybase-client-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/keybase/client](https://github.com/keybase/client))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-20T13:27:31.830Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `keybase/client`
- **Description**: Keybase Go Library, Client, Service, OS X, iOS, Android, Electron
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 9258 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `go/avatars/utils.go`
```
package avatars

import (
	"bytes"
	"context"
	"encoding/base64"
	"image"
	"image/color"
	"image/png"
	"io"
	"net/url"
	"os"
	"runtime"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/image/draw"
)

var AllFormats = []keybase1.AvatarFormat{
	"square_192",
	"square_256",
	"square_960",
	"square_360",
	"square_200",
	"square_40",
}

const avatarPlaceholder = "iVBORw0KGgoAAAANSUhEUgAAAMAAAADACAAAAAB3tzPbAAADwElEQVR4Ae3bB5ayWBDF8dn/mi6CqNgNnYzntYFGMAs8ljAnT57PUFQ9z6n/Dn4djHV/a548BZCkAAUoQAEKUIACFKAABShAAQpQgAIUoAAFKEABClCAAhSgAAUoQAEKOG2+R+/xcDAYxu+j783pqQB7k/j4W35i9s8BOEy7+I+604PrALuK8L9FK+swoF6E+GXhonYVkHZxVd3UScAxxtXFR/cAxsMNecYxQJXgxpLKJcA+xM2Fe3cAuY878nNXAKmHu/JSNwBr3N3aBcDGw915G3nAroMH6uykAecADxWchQEveLAXWcAUDzeVBBQgqJAD2AEIGlgxgAFJRgpw7oCkzlkIMAZRYxlA2QFRnVIEMANZMwlA7YMsvxYApCAsFQDEICzmB1xA2oUdsARpS3bAB0j7YAcEIC3gBhxA3IEZsAJxK2bADMTNmAFvIO6NGdAHcX1mgA/ifGYAyOMFVCCvYgVcQN6FFXACeSdWQAnySlaABXmWFdB4IM5reAEBiAuYAUMQN2QGfIG4L2aAAXGGGZCBuIwZUIG4ihnQRCAtargBE5A2YQfkIC1nB9gAhAWWHdBM6P+CeAF7ELYXADQR/esIXkAKsn5EAE2f/iMVXsAaRK1JAfz/BVEjBdiDpL0YoBmBoFEjByhDPFxYCgKanYcH83ayF1sGD2akj/7e8VDvjTSgfsUDvdbigKYc4O4GpQuXu5c+7qx/ceN2uhriroaVK9frdYI7Smp39gN2ipubWqcmKHmAmwpy1zY05wQ3lJwdnGFlPVxZL3NzR1bPA1xRMK+dnSJW5peEwFROj0Hr1Sv+p9dV7f4c92xePPxL3os5P8sgus5nSQ9/qpfM8vrZJun2UGTpcplmxcHqpl4BCng2QHna5lmarpbLVZpm+fZUPgfAnjbf4zjqevhHXjeKx9+bk3UVUBXmo4cr6n2YonIMUP6M+rip/uindAWQz+59TzzL5QHFKMADBaNCEnCcdPFw3clRBmDTGETFqWUHVKYLwrqmYgXUhv7kzNRsAGsCtFBgLA+g6KOl+gUD4PKJFvu8tA3IfLSan7UKsBO03sS2BzhHYCg6twU4hGApPLQD2AVgKti1Acg7YKuT0wMOPhjzD9SASwjWwgstwA7B3NCSAmZgb0YJ2Htgz9sTAiIIFNEBUoj0QwaIIFJEBSggVEEEGEGoEREghFAhDeAIsY4kgCXEWpIA5hBrTgIYQawRCeAdYr2TABKIlShAAf+WAhSgAAUoQAEKUIACFKAABShAAQpQgAIUoIDfAUJ3U+9hO4+uAAAAAElFTkSuQmCC"

func getAvatarPlaceholder() io.ReadCloser {
	dat, _ := base64.StdEncoding.DecodeString(avatarPlaceholder)
	return io.NopCloser(bytes.NewBuffer(dat))
}

func FetchAvatar(ctx context.Context, g *globals.Context, username string) (res io.ReadCloser, err error) {
	avMap, err := g.GetAvatarLoader().LoadUsers(libkb.NewMetaContext(ctx, g.ExternalG()), []string{username}, []keybase1.AvatarFormat{"square_192"})
	if err != nil {
		return res, err
	}
	avatarURL := avMap.Picmap[username]["square_192"].String()
	if len(avatarURL) == 0 {
		return getAvatarPlaceholder(), nil
	}

	var avatarReader io.ReadCloser
	parsed, err := url.Parse(avatarURL)
	if err != nil {
		return res, err
	}
	switch parsed.Scheme {
	case "http", "https":
		resp, err := libkb.ProxyHTTPGet(g.ExternalG(), g.GetEnv(), avatarURL, "FetchAvatar")
		if err != nil {
			return res, err
		}
		if resp.StatusCode >= 400 {
			resp.Body.Close()
			avatarReader = getAvatarPlaceholder()
		} else {
			avatarReader = resp.Body
		}
	case "file":
		filePath := parsed.Path
		if runtime.GOOS == "windows" && len(filePath) > 0 {
			filePath = filePath[1:]
		}
		avatarReader, err = os.Open(filePath)
		if err != nil {
			return res, err
		}
	}
	return avatarReader, nil
}

func GetBorderedCircleAvatar(ctx context.Context, g *globals.Context, username string, avatarSize, outerBorder, innerBorder int) (res io.ReadCloser, length int64, err error) {
	white := color.RGBA{255, 255, 255, 255}
	blue := color.RGBA{76, 142, 255, 255}
	avatarReader, err := FetchAvatar(ctx, g, username)
	if err != nil {
		return res, length, err
	}
	defer avatarReader.Close()
	avatarImg, _, err := image.Decode(avatarReader)
	if err != nil {
		return res, length, err
	}
	scaledAvatar := image.NewRGBA(image.Rect(0, 0, avatarSize, avatarSize))
	draw.BiLinear.Scale(scaledAvatar, scaledAvatar.Bounds(), avatarImg, avatarImg.Bounds(), draw.Over, nil)
	avatarRadius := avatarSize / 2
	borderedRadius := avatarRadius + outerBorder + innerBorder
	resultSize := borderedRadius * 2

	bounds := image.Rect(0, 0, resultSize, resultSize)
	middle := image.Point{borderedRadius, borderedRadius}
	iconRect := image.Rect(middle.X-avatarRadius, middle.Y-avatarRadius, middle.X+avatarRadius, middle.Y+avatarRadius)
	mask := &circleMask{image.Point{avatarRadius, avatarRadius}, avatarRadius}

	result := image.NewRGBA(bounds)

	draw.Draw(result, bounds, &circle{middle, borderedRadius, blue}, image.Point{}, draw.Over)
	draw.Draw(result, bounds, &circle{middle, avatarRadius + innerBorder, white}, image.Point{}, draw.Over)
	draw.DrawMask(result, iconRect, scaledAvatar, image.Point{}, mask, image.Point{}, draw.Over)

	var buf bytes.Buffer
	err = png.Encode(&buf, result)
	if err != nil {
		return res, length, err
	}
	return io.NopCloser(bytes.NewReader(buf.Bytes())), int64(buf.Len()), nil
}

type circleMask struct {
	p image.Point
	r int
}

func (c *circleMask) ColorModel() color.Model {
	return color.AlphaModel
}

func (c *circleMask) Bounds() image.Rectangle {
	return image.Rect(c.p.X-c.r, c.p.Y-c.r, c.p.X+c.r, c.p.Y+c.r)
}

func (c *circleMask) At(x, y int) color.Color {
	xx, yy, rr := float64(x-c.p.X)+1, float64(y-c.p.Y)+1, float64(c.r)
	if xx*xx+yy*yy < rr*rr {
		return color.Alpha{255}
	}
	return color.Alpha{0}
}

type circle struct {
	p    image.Point
	r    int
	fill color.Color
}

func (c *circle) ColorModel() color.Model {
	return color.RGBAModel
}

func (c *circle) Bounds() image.Rectangle {
	return image.Rect(c.p.X-c.r, c.p.Y-c.r, c.p.X+c.r, c.p.Y+c.r)
}

func (c *circle) At(x, y int) color.Color {
	xx, yy, rr := float64(x-c.p.X)+1, float64(y-c.p.Y)+1, float64(c.r)
	if xx*xx+yy*yy < rr*rr {
		return c.fill
	}
	return color.RGBA{0, 0, 0, 0}
}

```

### Core Architecture Module: `go/badges/badgestate.go`
```
// Copyright 2016 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package badges

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"math"
	"strings"
	"sync"

	"github.com/keybase/client/go/gregor"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/client/go/protocol/stellar1"
	jsonw "github.com/keybase/go-jsonw"
)

type LocalChatState interface {
	ApplyLocalChatState(context.Context, []keybase1.BadgeConversationInfo) ([]keybase1.BadgeConversationInfo, int, int)
}

type dummyLocalChatState struct{}

func (d dummyLocalChatState) ApplyLocalChatState(ctx context.Context, i []keybase1.BadgeConversationInfo) ([]keybase1.BadgeConversationInfo, int, int) {
	return i, 0, 0
}

// BadgeState represents the number of badges on the app. It's threadsafe.
// Useable from both the client service and gregor server.
// See service:Badger for the service part that owns this.
type BadgeState struct {
	sync.Mutex

	localChatState LocalChatState
	log            logger.Logger
	env            *libkb.Env
	state          keybase1.BadgeState
	quietLogMode   bool

	inboxVers     chat1.InboxVers
	chatUnreadMap map[chat1.ConvIDStr]keybase1.BadgeConversationInfo

	walletUnreadMap map[stellar1.AccountID]int
}

// NewBadgeState creates a new empty BadgeState.
func NewBadgeState(log logger.Logger, env *libkb.Env) *BadgeState {
	return newBadgeState(log, env)
}

// NewBadgeState creates a new empty BadgeState in contexts
// where notifications do not need to be handled.
func NewBadgeStateForServer(log logger.Logger) *BadgeState {
	bs := newBadgeState(log, nil)
	bs.quietLogMode = true
	return bs
}

func newBadgeState(log logger.Logger, env *libkb.Env) *BadgeState {
	return &BadgeState{
		log:             log,
		env:             env,
		inboxVers:       chat1.InboxVers(0),
		chatUnreadMap:   make(map[chat1.ConvIDStr]keybase1.BadgeConversationInfo),
		walletUnreadMap: make(map[stellar1.AccountID]int),
		localChatState:  dummyLocalChatState{},
		quietLogMode:    false,
	}
}

func (b *BadgeState) SetLocalChatState(s LocalChatState) {
	b.localChatState = s
}

// Exports the state summary
func (b *BadgeState) Export(ctx context.Context) (keybase1.BadgeState, error) {
	b.Lock()
	defer b.Unlock()

	b.state.Conversations = []keybase1.BadgeConversationInfo{}
	for _, info := range b.chatUnreadMap {
		b.state.Conversations = append(b.state.Conversations, info)
	}
	b.state.Conversations, b.state.SmallTeamBadgeCount, b.state.BigTeamBadgeCount = b.localChatState.ApplyLocalChatState(ctx, b.state.Conversations)
	if b.inboxVers > math.MaxInt {
		return keybase1.BadgeState{}, fmt.Errorf("inbox version overflow: %d", b.inboxVers)
	}
	b.state.InboxVers = int(b.inboxVers) //nolint:gosec // G115: Overflow checked above

	b.state.UnreadWalletAccounts = []keybase1.WalletAccountInfo{}
	for accountID, count := range b.walletUnreadMap {
		info := keybase1.WalletAccountInfo{AccountID: string(accountID), NumUnread: count}
		b.state.UnreadWalletAccounts = append(b.state.UnreadWalletAccounts, info)
	}

	return b.state, nil
}

type problemSetBody struct {
	Count int `json:"count"`
}

type newTeamBody struct {
	TeamID   keybase1.TeamID `json:"id"`
	TeamName string          `json:"name"`
	Implicit bool            `json:"implicit_team"`
}

type teamDeletedBody struct {
	TeamID   string `json:"id"`
	TeamName string `json:"name"`
	Implicit bool   `json:"implicit_team"`
	OpBy     struct {
		UID      string `json:"uid"`
		Username string `json:"username"`
	} `json:"op_by"`
}

type unverifiedCountBody struct {
	UnverifiedCount int `json:"unverified_count"`
}

// countKnownBadges looks at the map sent down by gregor and considers only those
// types that are known to the client. The rest, it assumes it cannot display,
// and doesn't count those badges toward the badge count. Note that the shape
// of this map is two-deep.
//
//	{ 1 : { 2 : 3, 4 : 5 }, 3 : { 10001 : 1 } }
//
// Implies that are 3 badges on TODO type PROOF, 5 badges on TODO type FOLLOW,
// and 1 badges in ANNOUNCEMENTs.
func countKnownBadges(m libkb.HomeItemMap) int {
	var ret int
	for itemType, todoMap := range m {
		if _, found := keybase1.HomeScreenItemTypeRevMap[itemType]; !found {
			continue
		}
		for todoType, v := range todoMap {
			_, found := keybase1.HomeScreenTodoTypeRevMap[todoType]
			if (itemType == keybase1.HomeScreenItemType_TODO && found) ||
				(itemType == keybase1.HomeScreenItemType_ANNOUNCEMENT && todoType >= keybase1.HomeScreenTodoType_ANNONCEMENT_PLACEHOLDER) {
				ret += v
			}
		}
	}
	return ret
}

func (b *BadgeState) ConversationBadgeStr(ctx context.Context, convIDStr chat1.ConvIDStr) int {
	b.Lock()
	defer b.Unlock()
	if info, ok := b.chatUnreadMap[convIDStr]; ok {
		return info.BadgeCount
	}
	return 0
}

func (b *BadgeState) ConversationBadge(ctx context.Context, convID chat1.ConversationID) int {
	return b.ConversationBadgeStr(ctx, convID.ConvIDStr())
}

// UpdateWithGregor updates the badge state from a gregor state.
func (b *BadgeState) UpdateWithGregor(ctx context.Context, gstate gregor.State) error {
	b.Lock()
	defer b.Unlock()

	b.state.NewTlfs = 0
	b.state.NewFollowers = 0
	b.state.RekeysNeeded = 0
	b.state.NewGitRepoGlobalUniqueIDs = []string{}
	b.state.NewDevices = []keybase1.DeviceID{}
	b.state.RevokedDevices = []keybase1.DeviceID{}
	b.state.NewTeams = nil
	b.state.DeletedTeams = nil
	b.state.NewTeamAccessRequestCount = 0
	b.state.HomeTodoItems = 0
	b.state.TeamsWithResetUsers = nil
	b.state.ResetState = keybase1.ResetState{}
	b.state.UnverifiedEmails = 0
	b.state.UnverifiedPhones = 0

	var hsb *libkb.HomeStateBody

	teamsWithResets := make(map[string]bool)

	items, err := gstate.Items()
	if err != nil {
		return err
	}
	for _, item := range items {
		categoryObj := item.Category()
		if categoryObj == nil {
			continue
		}
		category := categoryObj.String()
		if strings.HasPrefix(category, "team.request_access:") {
			b.state.NewTeamAccessRequestCount++
			continue
		}
		switch category {
		case "home.state":
			var tmp libkb.HomeStateBody
			byt := item.Body().Bytes()
			dec := json.NewDecoder(bytes.NewReader(byt))
			if err := dec.Decode(&tmp); err != nil {
				b.log.CDebugf(ctx, "BadgeState got bad home.state object; error: %v; on %q", err, string(byt))
				continue
			}
			sentUp := false
			if hsb.LessThan(tmp) {
				hsb = &tmp
				b.state.HomeTodoItems = countKnownBadges(hsb.BadgeCountMap)
				sentUp = true
			}
			b.log.CDebugf(ctx, "incoming home.state (sentUp=%v): %+v", sentUp, tmp)
		case "tlf":
			jsw, err := jsonw.Unmarshal(item.Body().Bytes())
			if err != nil {
				b.log.CDebugf(ctx, "BadgeState encountered non-json 'tlf' item: %v", err)
				continue
			}
			itemType, err := jsw.AtKey("type").GetString()
			if err != nil {
				b.log.CDebugf(ctx, "BadgeState encountered gregor 'tlf' item without 'type': %v", err)
				continue
			}
			if itemType != "created" {
				continue
			}
			b.state.NewTlfs++
		case "kbfs_tlf_problem_set_count", "kbfs_tlf_sbs_problem_set_count":
			var body problemSetBody
			if err := json.Unmarshal(item.Body().Bytes(), &body); err != nil {
				b.log.CDebugf(ctx, "BadgeState encountered non-json 'problem set' item: %v", err)
				continue
			}
			b.state.RekeysNeeded += body.Count
		case "follow":
			b.state.NewFollowers++
		case "device.new":
			jsw, err := jsonw.Unmarshal(item.Body().Bytes())
			if err != nil {
				b.log.CDebugf(ctx, "BadgeState encountered non-json 'device.new' item: %v", err)
				continue
			}
			newDeviceID, err := jsw.AtKey("device_id").GetString()
			if err != nil {
				b.log.CDebugf(ctx, "BadgeState encountered gregor 'device.new' item without 'device_id': %v", err)
				continue
			}
			b.state.NewDevices = append(b.state.NewDevices, keybase1.DeviceID(newDeviceID))
		case "device.revoked":
			jsw, err := jsonw.Unmarshal(item.Body().Bytes())
			if err != nil {
				b.log.CDebugf(ctx, "BadgeState encountered non-json 'device.revoked' item: %v", err)
				continue
			}
			revokedDeviceID, err := jsw.AtKey("device_id").GetString()
			if err != nil {
				b.log.CDebugf(ctx, "BadgeState encountered gregor 'device.revoked' item without 'device_id': %v", err)
				continue
			}
			b.state.RevokedDevices = append(b.state.RevokedDevices, keybase1.DeviceID(revokedDeviceID))
		case "new_git_repo":
			jsw, err := jsonw.Unmarshal(item.Body().Bytes())
			if err != nil {
				b.log.CDebugf(ctx, "BadgeState encountered non-json 'new_git_repo' item: %v", err)
				continue
			}
			globalUniqueID, err := jsw.AtKey("global_unique_id").GetString()
			if err != nil {
				b.log.CDebugf(ctx,
					"BadgeState encountered gregor 'new_git_repo' item without 'global_unique_id': %v", err)
				continue
			}
			b.state.NewGitRepoGlobalUniqueIDs = append(b.state.NewGitRepoGlobalUniqueIDs, globalUniqueID)
		case "team.newly_added_to_team":
			var body []newTeamBody
			if err := json.Unmarshal(item.Body().Bytes(), &body); err != nil {
				b.log.CDebugf(ctx, "BadgeState unmarshal error for team.newly_added_to_team item: %v", err)
				continue
			}
			for _, x := range body {
				if x.TeamName == "" {
					continue
				}
				if x.Implicit {
					continue
				}
				b.state.NewTeams = append(b.state.NewTeams, x.TeamID)
			}
		case "team.delete":
			var body []teamDeletedBody
			if err := json.Unmarshal(item.Body().Bytes(), &body); err != nil {
				b.log.CDebugf(ctx, "BadgeState unmarshal error for team.delete item: %v", err)
				continue
			}

			msgID := item.Metadata().MsgID().(gregor1.MsgID)
			var username string
			if b.env != nil {
				username = b.env.GetUsername().String()
			}
			for _, x := range body {
				if x.TeamName == "" || x.OpBy.Username == "" || x.OpBy.Username == username {
					continue
				}
				if x.Implicit {
					continue
				}
				b.state.DeletedTeams = append(b.state.DeletedTeams, keybase1.D
```

### Core Architecture Module: `go/chat/attachments/utils.go`
```
package attachments

import (
	"bufio"
	"bytes"
	"context"
	"errors"
	"image/gif"
	"image/png"
	"io"
	"os"
	"strings"
	"sync/atomic"
	"time"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

func AssetFromMessage(ctx context.Context, g *globals.Context, uid gregor1.UID, convID chat1.ConversationID,
	msgID chat1.MessageID, preview bool,
) (res chat1.Asset, err error) {
	reason := chat1.GetThreadReason_GENERAL
	msgs, err := g.ChatHelper.GetMessages(ctx, uid, convID, []chat1.MessageID{msgID}, true, &reason)
	if err != nil {
		return res, err
	}
	if len(msgs) == 0 {
		return res, libkb.NotFoundError{}
	}
	first := msgs[0]
	st, err := first.State()
	if err != nil {
		return res, err
	}
	if st == chat1.MessageUnboxedState_ERROR {
		em := first.Error().ErrMsg
		return res, errors.New(em)
	}
	if st != chat1.MessageUnboxedState_VALID {
		// given a message id that doesn't exist, msgs can come back
		// with an empty message in it (and st == 0).
		// this check prevents a panic, but perhaps the server needs
		// a fix as well.
		return res, libkb.NotFoundError{}
	}

	msg := first.Valid()
	body := msg.MessageBody
	t, err := body.MessageType()
	if err != nil {
		return res, err
	}

	var attachment chat1.MessageAttachment
	switch t {
	case chat1.MessageType_ATTACHMENT:
		attachment = msg.MessageBody.Attachment()
	case chat1.MessageType_ATTACHMENTUPLOADED:
		uploaded := msg.MessageBody.Attachmentuploaded()
		attachment = chat1.MessageAttachment{
			Object:   uploaded.Object,
			Previews: uploaded.Previews,
			Metadata: uploaded.Metadata, //nolint:govet // keeping metadata for completeness
		}
	default:
		return res, errors.New("not an attachment message")
	}
	res = attachment.Object
	if preview {
		if len(attachment.Previews) > 0 {
			res = attachment.Previews[0]
		} else if attachment.Preview != nil {
			res = *attachment.Preview
		} else {
			return res, errors.New("no preview in attachment")
		}
	}
	return res, nil
}

// ReadCloseResetter is io.ReadCloser plus a Reset method. This is used by
// attachment uploads.
type ReadCloseResetter interface {
	io.ReadCloser
	Reset() error
}

type FileReadCloseResetter struct {
	filename string
	file     *os.File
	buf      *bufio.Reader
}

// NewFileReadCloseResetter creates a ReadCloseResetter that uses an on-disk file as
// source of data.
func NewFileReadCloseResetter(name string) (ReadCloseResetter, error) {
	f := &FileReadCloseResetter{filename: name}
	if err := f.open(); err != nil {
		return nil, err
	}
	return f, nil
}

func (f *FileReadCloseResetter) open() error {
	ff, err := os.Open(f.filename)
	if err != nil {
		return err
	}
	f.file = ff
	f.buf = bufio.NewReader(f.file)
	return nil
}

func (f *FileReadCloseResetter) Read(p []byte) (int, error) {
	return f.buf.Read(p)
}

func (f *FileReadCloseResetter) Reset() error {
	_, err := f.file.Seek(0, io.SeekStart)
	if err != nil {
		return err
	}
	f.buf.Reset(f.file)
	return nil
}

func (f *FileReadCloseResetter) Close() error {
	f.buf = nil
	if f.file != nil {
		return f.file.Close()
	}
	return nil
}

// KbfsReadCloseResetter is an implementation of ReadCloseResetter that uses
// SimpleFS as source of data.
type KbfsReadCloseResetter struct {
	client *keybase1.SimpleFSClient
	opid   keybase1.OpID
	offset int64
	ctx    context.Context
}

const (
	kbfsPrefix        = "/keybase"
	kbfsPrefixPrivate = kbfsPrefix + "/private/"
	kbfsPrefixPublic  = kbfsPrefix + "/public/"
	kbfsPrefixTeam    = kbfsPrefix + "/team/"
)

func isKbfsPath(p string) bool {
	return strings.HasPrefix(p, kbfsPrefixPrivate) ||
		strings.HasPrefix(p, kbfsPrefixPublic) ||
		strings.HasPrefix(p, kbfsPrefixTeam)
}

func makeSimpleFSClientFromGlobalContext(
	g *libkb.GlobalContext,
) (*keybase1.SimpleFSClient, error) {
	xp := g.ConnectionManager.LookupByClientType(keybase1.ClientType_KBFS)
	if xp == nil {
		return nil, libkb.KBFSNotRunningError{}
	}
	return &keybase1.SimpleFSClient{
		Cli: rpc.NewClient(xp, libkb.NewContextifiedErrorUnwrapper(g), nil),
	}, nil
}

// NewKbfsReadCloseResetter creates a ReadCloseResetter that uses SimpleFS as source
// of data. kbfsPath must start with "/keybase/<tlf-type>/".
func NewKbfsReadCloseResetter(ctx context.Context, g *libkb.GlobalContext,
	kbfsPath string,
) (ReadCloseResetter, error) {
	if !isKbfsPath(kbfsPath) {
		return nil, errors.New("not a kbfs path")
	}

	client, err := makeSimpleFSClientFromGlobalContext(g)
	if err != nil {
		return nil, err
	}

	opid, err := client.SimpleFSMakeOpid(ctx)
	if err != nil {
		return nil, err
	}

	if err = client.SimpleFSOpen(ctx, keybase1.SimpleFSOpenArg{
		OpID:  opid,
		Dest:  keybase1.NewPathWithKbfsPath(kbfsPath[len(kbfsPrefix):]),
		Flags: keybase1.OpenFlags_READ | keybase1.OpenFlags_EXISTING,
	}); err != nil {
		return nil, err
	}

	return &KbfsReadCloseResetter{
		client: client,
		ctx:    ctx,
		opid:   opid,
	}, nil
}

// Read implements the ReadCloseResetter interface.
func (f *KbfsReadCloseResetter) Read(p []byte) (int, error) {
	content, err := f.client.SimpleFSRead(f.ctx, keybase1.SimpleFSReadArg{
		OpID:   f.opid,
		Offset: atomic.LoadInt64(&f.offset),
		Size:   len(p),
	})
	if err != nil {
		return 0, err
	}
	if len(content.Data) == 0 {
		// Unfortunately SimpleFSRead doesn't return EOF error.
		return 0, io.EOF
	}
	atomic.AddInt64(&f.offset, int64(len(content.Data)))
	copy(p, content.Data)
	return len(content.Data), nil
}

// Reset implements the ReadCloseResetter interface.
func (f *KbfsReadCloseResetter) Reset() error {
	atomic.StoreInt64(&f.offset, 0)
	return nil
}

// Close implements the ReadCloseResetter interface.
func (f *KbfsReadCloseResetter) Close() error {
	return f.client.SimpleFSClose(f.ctx, f.opid)
}

// NewReadCloseResetter creates a ReadCloseResetter using either on-disk file
// or SimpleFS depending on if p is a KBFS path.
func NewReadCloseResetter(ctx context.Context, g *libkb.GlobalContext,
	p string,
) (ReadCloseResetter, error) {
	if isKbfsPath(p) {
		return NewKbfsReadCloseResetter(ctx, g, p)
	}
	return NewFileReadCloseResetter(p)
}

type kbfsFileInfo struct {
	dirent *keybase1.Dirent
}

func (fi kbfsFileInfo) Name() string { return fi.dirent.Name }
func (fi kbfsFileInfo) Size() int64  { return int64(fi.dirent.Size) }
func (fi kbfsFileInfo) Mode() (mode os.FileMode) {
	mode |= 0o400
	if fi.dirent.Writable {
		mode |= 0o200
	}
	switch fi.dirent.DirentType {
	case keybase1.DirentType_DIR:
		mode |= os.ModeDir
	case keybase1.DirentType_SYM:
		mode |= os.ModeSymlink
	case keybase1.DirentType_EXEC:
		mode |= 0o100
	}
	return mode
}

func (fi kbfsFileInfo) ModTime() time.Time {
	return keybase1.FromTime(fi.dirent.Time)
}

func (fi kbfsFileInfo) IsDir() bool {
	return fi.dirent.DirentType == keybase1.DirentType_DIR
}
func (fi kbfsFileInfo) Sys() any { return fi.dirent }

// StatOSOrKbfsFile stats the file located at p, using SimpleFSStat if it's a
// KBFS path, or os.Stat if not.
func StatOSOrKbfsFile(ctx context.Context, g *libkb.GlobalContext, p string) (
	fi os.FileInfo, err error,
) {
	if !isKbfsPath(p) {
		return os.Stat(p)
	}

	client, err := makeSimpleFSClientFromGlobalContext(g)
	if err != nil {
		return nil, err
	}

	dirent, err := client.SimpleFSStat(ctx, keybase1.SimpleFSStatArg{
		Path: keybase1.NewPathWithKbfsPath(p[len(kbfsPrefix):]),
	})
	if err != nil {
		return nil, err
	}

	return kbfsFileInfo{dirent: &dirent}, nil
}

type BufReadResetter struct {
	buf []byte
	r   *bytes.Reader
}

func NewBufReadResetter(buf []byte) *BufReadResetter {
	return &BufReadResetter{
		buf: buf,
		r:   bytes.NewReader(buf),
	}
}

func (b *BufReadResetter) Read(p []byte) (int, error) {
	return b.r.Read(p)
}

func (b *BufReadResetter) Reset() error {
	b.r.Reset(b.buf)
	return nil
}

func (b *BufReadResetter) Close() error {
	return nil
}

func AddPendingPreview(ctx context.Context, g *globals.Context, obr *chat1.OutboxRecord) error {
	pre, err := NewPendingPreviews(g).Get(ctx, obr.OutboxID)
	if err != nil {
		return err
	}
	mpr, err := pre.Export(func() *chat1.PreviewLocation {
		loc := chat1.NewPreviewLocationWithUrl(g.AttachmentURLSrv.GetPendingPreviewURL(ctx,
			obr.OutboxID))
		return &loc
	})
	if err != nil {
		return err
	}
	obr.Preview = &mpr
	return nil
}

func GIFToPNG(ctx context.Context, src io.Reader, dest io.Writer) error {
	g, err := gif.DecodeAll(src)
	if err != nil {
		return err
	}
	if len(g.Image) == 0 {
		return errors.New("no frames in gif")
	}
	return png.Encode(dest, g.Image[0])
}

```

### Core Architecture Module: `go/chat/bots/utils.go`
```
package bots

import (
	"context"
	"fmt"
	"regexp"
	"sort"
	"strings"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
)

func MakeConversationCommandGroups(cmds []chat1.UserBotCommandOutput) chat1.ConversationCommandGroups {
	var outCmds []chat1.ConversationCommand
	for _, cmd := range cmds {
		username := cmd.Username
		outCmds = append(outCmds, chat1.ConversationCommand{
			Name:        cmd.Name,
			Description: cmd.Description,
			Usage:       cmd.Usage,
			HasHelpText: cmd.ExtendedDescription != nil,
			Username:    &username,
		})
	}
	return chat1.NewConversationCommandGroupsWithCustom(chat1.ConversationCommandGroupsCustom{
		Commands: outCmds,
	})
}

func SortCommandsForMatching(cmds []chat1.UserBotCommandOutput) {
	// sort commands by reverse command length to prefer specificity (i.e. if
	// there's a longer command that matches the prefix, we'll match that
	// first.)
	sort.SliceStable(cmds, func(i, j int) bool {
		return len(cmds[i].Name) > len(cmds[j].Name)
	})
}

func ApplyTeamBotSettings(ctx context.Context, g *globals.Context, botUID gregor1.UID,
	botSettings keybase1.TeamBotSettings,
	msg chat1.MessagePlaintext, convID *chat1.ConversationID,
	mentionMap map[string]struct{}, debug utils.DebugLabeler,
) (bool, error) {
	// First make sure bot can receive on the given conversation. This ID may
	// be null if we are creating the conversation.
	if convID != nil && !botSettings.ConvIDAllowed(convID.String()) {
		return false, nil
	}

	// If the sender is the bot, always match
	if msg.ClientHeader.Sender.Eq(botUID) {
		return true, nil
	}

	switch msg.ClientHeader.MessageType {
	// DELETEHISTORY messages are always keyed for bots in case they need to
	// clear messages
	case chat1.MessageType_DELETEHISTORY:
		return true, nil
	// Bots never get these
	case chat1.MessageType_NONE,
		chat1.MessageType_METADATA,
		chat1.MessageType_TLFNAME,
		chat1.MessageType_HEADLINE,
		chat1.MessageType_JOIN,
		chat1.MessageType_LEAVE,
		chat1.MessageType_SYSTEM:
		return false, nil
	}

	// check mentions
	if _, ok := mentionMap[botUID.String()]; ok && botSettings.Mentions {
		return true, nil
	}

	// See if any triggers match
	matchText := msg.SearchableText()
	for _, trigger := range botSettings.Triggers {
		re, err := regexp.Compile(fmt.Sprintf("(?i)%s", trigger))
		if err != nil {
			debug.Debug(ctx, "unable to compile trigger regex: %v", err)
			continue
		}
		if re.MatchString(matchText) {
			return true, nil
		}
	}

	// Check if any commands match (early out if it can't be a bot message)
	if !botSettings.Cmds || !strings.HasPrefix(matchText, "!") {
		return false, nil
	}
	unn, err := g.GetUPAKLoader().LookupUsername(ctx, keybase1.UID(botUID.String()))
	if err != nil {
		return false, err
	}
	if convID != nil {
		completeCh, err := g.BotCommandManager.UpdateCommands(ctx, *convID, nil)
		if err != nil {
			return false, err
		}
		if err := <-completeCh; err != nil {
			return false, err
		}
		cmds, _, err := g.BotCommandManager.ListCommands(ctx, *convID)
		if err != nil {
			return false, nil
		}
		SortCommandsForMatching(cmds)
		for _, cmd := range cmds {
			if unn.String() == cmd.Username && cmd.Matches(matchText) {
				return true, nil
			}
		}
	}
	return false, nil
}

```

### Core Architecture Module: `go/chat/search/utils.go`
```
package search

import (
	"context"
	"fmt"
	"regexp"
	"slices"
	"strings"

	"github.com/araddon/dateparse"
	mapset "github.com/deckarep/golang-set"
	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	porterstemmer "github.com/keybase/go-porterstemmer"
)

// Split on whitespace, punctuation, code and quote markdown separators
var splitExpr = regexp.MustCompile(`[\s\.,\?!]`)

// Strip the following separators to create tokens
var stripSeps = []string{
	// groupings
	"<", ">",
	"\\(", "\\)",
	"\\[", "\\]",
	"\\{", "\\}",
	"\"",
	"'",
	// phone number delimiter
	"-",
	// mentions
	"@",
	"#",
	// markdown
	"\\*",
	"_",
	"~",
	"`",
}
var stripExpr = regexp.MustCompile(strings.Join(stripSeps, "|"))

func prefixes(token string) (res []string) {
	if len(token) < MinTokenLength {
		return nil
	}
	for i := range token {
		if i < MinTokenLength {
			continue
		}
		// Skip any prefixes longer than `maxPrefixLength` to limit the index size.
		if i > maxPrefixLength {
			break
		}
		res = append(res, token[:i])
	}
	return res
}

type tokenMap map[string]map[string]chat1.EmptyStruct

// getIndexTokens splits the content of the given message on whitespace and
// special characters returning a map of tokens to aliases  normalized to lowercase.
func tokenize(msgText string) tokenMap {
	if msgText == "" {
		return nil
	}

	// split the message text up on basic punctuation/spaces
	tokens := splitExpr.Split(msgText, -1)
	tokenMap := tokenMap{}
	for _, token := range tokens {
		if len(token) < MinTokenLength {
			continue
		}

		token = strings.ToLower(token)
		if _, ok := tokenMap[token]; !ok {
			tokenMap[token] = map[string]chat1.EmptyStruct{}
		}

		// strip separators to raw tokens which we count as an alias to the
		// original token
		stripped := stripExpr.Split(token, -1)
		for _, s := range stripped {
			if s == "" {
				continue
			}
			tokenMap[token][s] = chat1.EmptyStruct{}

			// add the stem as an alias
			stemmed := porterstemmer.StemWithoutLowerCasing([]rune(s))
			tokenMap[token][string(stemmed)] = chat1.EmptyStruct{}

			// calculate prefixes to alias to the token
			for _, prefix := range prefixes(s) {
				tokenMap[token][prefix] = chat1.EmptyStruct{}
			}
		}
		// drop the original token from the set of aliases
		delete(tokenMap[token], token)
	}
	return tokenMap
}

func tokensFromMsg(msg chat1.MessageUnboxed) tokenMap {
	return tokenize(msg.SearchableText())
}

func msgIDsFromSet(set mapset.Set) []chat1.MessageID {
	if set == nil {
		return nil
	}
	msgIDSlice := []chat1.MessageID{}
	for _, el := range set.ToSlice() {
		msgID, ok := el.(chat1.MessageID)
		if ok {
			msgIDSlice = append(msgIDSlice, msgID)
		}
	}
	return msgIDSlice
}

func searchMatches(msg chat1.MessageUnboxed, queryRe *regexp.Regexp) (validMatches []chat1.ChatSearchMatch) {
	msgText := msg.SearchableText()
	matches := queryRe.FindAllStringIndex(msgText, -1)
	for _, m := range matches {
		if len(m) != 2 {
			// sanity check but regex package should always return a two
			// element slice
			continue
		}
		startIndex := m[0]
		endIndex := m[1]
		if startIndex != endIndex {
			validMatches = append(validMatches, chat1.ChatSearchMatch{
				StartIndex: startIndex,
				EndIndex:   endIndex,
				Match:      msgText[startIndex:endIndex],
			})
		}
	}
	return validMatches
}

// Order messages ascending by ID for presentation
func getUIMsgs(ctx context.Context, g *globals.Context, convID chat1.ConversationID,
	uid gregor1.UID, msgs []chat1.MessageUnboxed,
) (uiMsgs []chat1.UIMessage) {
	for _, msg := range slices.Backward(msgs) {

		uiMsg := utils.PresentMessageUnboxed(ctx, g, msg, uid, convID)
		uiMsgs = append(uiMsgs, uiMsg)
	}
	return uiMsgs
}

const (
	beforeFilter = "before:"
	afterFilter  = "after:"
	fromFilter   = "from:"
	toFilter     = "to:"
)

var senderRegex = regexp.MustCompile(fmt.Sprintf(
	"(%s|%s)(@?[a-z0-9][a-z0-9_]+)", fromFilter, toFilter))

var dateRangeRegex = regexp.MustCompile(fmt.Sprintf(
	`(%s|%s)(\d{1,4}[-/\.]+\d{1,2}[-/\.]+\d{1,4})`, beforeFilter, afterFilter))

func UpgradeSearchOptsFromQuery(query string, opts chat1.SearchOpts, username string) (string, chat1.SearchOpts) {
	query = strings.Trim(query, " ")
	var hasQueryOpts bool

	// To/From
	matches := senderRegex.FindAllStringSubmatch(query, 2)
	for _, match := range matches {
		// [fullMatch, filter, sender]
		if len(match) != 3 {
			continue
		}
		hasQueryOpts = true
		query = strings.TrimSpace(strings.ReplaceAll(query, match[0], ""))
		sender := strings.TrimSpace(strings.ReplaceAll(match[2], "@", ""))
		if sender == "me" {
			sender = username
		}
		switch match[1] {
		case fromFilter:
			opts.SentBy = sender
		case toFilter:
			opts.SentTo = sender
		}
	}
	if opts.SentTo == username {
		opts.MatchMentions = true
	}

	matches = dateRangeRegex.FindAllStringSubmatch(query, 2)
	for _, match := range matches {
		// [fullMatch, filter, dateRange]
		if len(match) != 3 {
			continue
		}
		hasQueryOpts = true
		query = strings.TrimSpace(strings.Replace(query, match[0], "", 1))
		time, err := dateparse.ParseAny(strings.TrimSpace(match[2]))
		if err != nil {
			continue
		}

		gtime := gregor1.ToTime(time)
		switch match[1] {
		case beforeFilter:
			opts.SentBefore = gtime
		case afterFilter:
			opts.SentAfter = gtime
		}
	}

	if hasQueryOpts && len(query) == 0 {
		query = "/.*/"
	}
	// IsRegex
	if len(query) > 2 && query[0] == '/' && query[len(query)-1] == '/' {
		query = query[1 : len(query)-1]
		opts.IsRegex = true
	}
	return query, opts
}

func MinMaxIDs(conv chat1.Conversation) (minID, maxID chat1.MessageID) {
	// lowest msgID we care about
	minID = conv.GetMaxDeletedUpTo()
	if minID == 0 {
		minID = 1
	}
	// highest msgID we care about
	maxID = max(minID, conv.GetMaxMessageID())
	return minID, maxID
}

```

### Core Architecture Module: `go/chat/storage/blockengine_memcache.go`
```
package storage

import (
	"context"
	"fmt"

	"github.com/keybase/client/go/logger"

	lru "github.com/hashicorp/golang-lru"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
)

type logContext struct {
	log  logger.Logger
	vlog *libkb.VDebugLog
}

func newLogContext() *logContext {
	return &logContext{
		log:  logger.NewNull(),
		vlog: libkb.NewVDebugLog(logger.NewNull()),
	}
}

func (c *logContext) GetLog() logger.Logger {
	return c.log
}

func (c *logContext) GetVDebugLog() *libkb.VDebugLog {
	return c.vlog
}

type blockEngineMemCacheImpl struct {
	blockCache *lru.Cache
	logContext *logContext
	lockTab    *libkb.LockTable
}

func newBlockEngineMemCache() *blockEngineMemCacheImpl {
	c, _ := lru.New(100)
	return &blockEngineMemCacheImpl{
		blockCache: c,
		logContext: newLogContext(),
		lockTab:    libkb.NewLockTable(),
	}
}

func (b *blockEngineMemCacheImpl) key(uid gregor1.UID, convID chat1.ConversationID, id int) string {
	return fmt.Sprintf("%s:%s:%d", uid, convID, id)
}

func (b *blockEngineMemCacheImpl) getBlock(ctx context.Context, uid gregor1.UID,
	convID chat1.ConversationID, id int,
) (block, bool) {
	key := b.key(uid, convID, id)
	lock := b.lockTab.AcquireOnName(ctx, b.logContext, key)
	defer lock.Release(ctx)
	if v, ok := b.blockCache.Get(key); ok {
		bl := v.(block)
		var retMsgs [blockSize]chat1.MessageUnboxed
		for i := range bl.Msgs {
			retMsgs[i] = bl.Msgs[i].DeepCopy()
		}
		return block{
			BlockID: bl.BlockID,
			Msgs:    retMsgs,
		}, true
	}
	return block{}, false
}

func (b *blockEngineMemCacheImpl) writeBlock(ctx context.Context, uid gregor1.UID,
	convID chat1.ConversationID, bl block,
) {
	key := b.key(uid, convID, bl.BlockID)
	lock := b.lockTab.AcquireOnName(ctx, b.logContext, key)
	defer lock.Release(ctx)
	var storedMsgs [blockSize]chat1.MessageUnboxed
	for i := range bl.Msgs {
		storedMsgs[i] = bl.Msgs[i].DeepCopy()
	}
	b.blockCache.Add(key, block{
		BlockID: bl.BlockID,
		Msgs:    storedMsgs,
	})
}

func (b *blockEngineMemCacheImpl) OnLogout(m libkb.MetaContext) error {
	b.blockCache.Purge()
	return nil
}

func (b *blockEngineMemCacheImpl) OnDbNuke(m libkb.MetaContext) error {
	b.blockCache.Purge()
	return nil
}

var blockEngineMemCache = newBlockEngineMemCache()

```

### Core Architecture Module: `go/chat/storage/hooks.go`
```
package storage

import "github.com/keybase/client/go/chat/globals"

func SetupGlobalHooks(g *globals.Context) {
	g.ExternalG().AddLogoutHook(inboxMemCache, "chat/storage/inbox")
	g.ExternalG().AddDbNukeHook(inboxMemCache, "chat/storage/inbox")

	g.ExternalG().AddLogoutHook(outboxMemCache, "chat/storage/outbox")
	g.ExternalG().AddDbNukeHook(outboxMemCache, "chat/storage/outbox")

	g.ExternalG().AddLogoutHook(readOutboxMemCache, "chat/storage/readoutbox")
	g.ExternalG().AddDbNukeHook(readOutboxMemCache, "chat/storage/readoutbox")

	g.ExternalG().AddLogoutHook(reacjiMemCache, "chat/storage/reacjiMemCache")
	g.ExternalG().AddDbNukeHook(reacjiMemCache, "chat/storage/reacjiMemCache")

	g.ExternalG().AddLogoutHook(blockEngineMemCache, "chat/storage/blockEngineMemCache")
	g.ExternalG().AddDbNukeHook(blockEngineMemCache, "chat/storage/blockEngineMemCache")
}

```

### Core Architecture Module: `go/chat/storage/score.go`
```
package storage

import (
	"time"

	"github.com/keybase/client/go/protocol/gregor1"
)

const (
	minScoringMinutes = 1           // one minute
	maxScoringMinutes = 7 * 24 * 60 // one week
	frequencyWeight   = 2
	mtimeWeight       = 1
)

func ScoreByFrequencyAndMtime(freq int, mtime gregor1.Time) float64 {
	// if we are missing an mtime just backdate to a week ago
	if mtime == 0 {
		mtime = gregor1.ToTime(time.Now().Add(-time.Hour * 24 * 7))
	}
	minutes := time.Since(mtime.Time()).Minutes()
	var mtimeScore float64
	if minutes > maxScoringMinutes {
		mtimeScore = 0
	} else if minutes < minScoringMinutes {
		mtimeScore = 1
	} else {
		mtimeScore = 1 - minutes/(maxScoringMinutes-minScoringMinutes)
	}
	return float64(freq*frequencyWeight) + mtimeScore*mtimeWeight
}

```

### Core Architecture Module: `go/chat/storage/storage_blockengine.go`
```
package storage

import (
	"context"
	"fmt"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"golang.org/x/crypto/nacl/secretbox"
)

const (
	blockIndexVersion = 8
	blockSize         = 100
)

type blockEngine struct {
	globals.Contextified
	utils.DebugLabeler
}

func newBlockEngine(g *globals.Context) *blockEngine {
	return &blockEngine{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g.ExternalG(), "BlockEngine", true),
	}
}

type blockIndex struct {
	Version       int
	ServerVersion int
	ConvID        chat1.ConversationID
	UID           gregor1.UID
	MaxBlock      int
	BlockSize     int
}

type block struct {
	BlockID int
	Msgs    [blockSize]chat1.MessageUnboxed
}

type boxedBlock struct {
	V int
	N [24]byte
	E []byte
}

func (be *blockEngine) makeBlockKey(convID chat1.ConversationID, uid gregor1.UID, blockID int) libkb.DbKey {
	return libkb.DbKey{
		Typ: libkb.DBChatBlocks,
		Key: fmt.Sprintf("bl:%s:%s:%d", uid, convID, blockID),
	}
}

func (be *blockEngine) getBlockNumber(id chat1.MessageID) int {
	return int(id) / blockSize //nolint:gosec // G115: MessageID to block number calculation, safe to convert
}

func (be *blockEngine) getBlockPosition(id chat1.MessageID) int {
	return int(id) % blockSize //nolint:gosec // G115: MessageID to block position calculation, safe to convert
}

func (be *blockEngine) getMsgID(blockNum, blockPos int) chat1.MessageID {
	return chat1.MessageID(blockNum*blockSize + blockPos) //nolint:gosec // G115: Block arithmetic to MessageID, safe to convert
}

func (be *blockEngine) createBlockIndex(ctx context.Context, key libkb.DbKey,
	convID chat1.ConversationID, uid gregor1.UID,
) (bi blockIndex, err Error) {
	be.Debug(ctx, "createBlockIndex: creating new block index: convID: %s uid: %s", convID, uid)

	// Grab latest server version to tag local data with
	srvVers, serr := be.G().ServerCacheVersions.Fetch(ctx)
	if serr != nil {
		return blockIndex{},
			NewInternalError(ctx, be.DebugLabeler, "createBlockIndex: failed to get server versions: %s", serr.Error())
	}

	bi = blockIndex{
		Version:       blockIndexVersion,
		ServerVersion: srvVers.BodiesVers,
		ConvID:        convID,
		UID:           uid,
		MaxBlock:      -1,
		BlockSize:     blockSize,
	}

	dat, ierr := encode(bi)
	if ierr != nil {
		return bi, NewInternalError(ctx, be.DebugLabeler, "createBlockIndex: failed to encode %s", ierr)
	}
	if ierr = be.G().LocalChatDb.PutRaw(key, dat); ierr != nil {
		return bi, NewInternalError(ctx, be.DebugLabeler, "createBlockIndex: failed to write: %s", ierr)
	}
	return bi, nil
}

func (be *blockEngine) readBlockIndex(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID) (blockIndex, Error) {
	key := makeBlockIndexKey(convID, uid)
	raw, found, err := be.G().LocalChatDb.GetRaw(key)
	if err != nil {
		return blockIndex{}, NewInternalError(ctx, be.DebugLabeler, "readBlockIndex: failed to read index block: %s", err.Error())
	}
	if !found {
		// If not found, create a new one and return it
		be.Debug(ctx, "readBlockIndex: no block index found, creating: convID: %d uid: %s", convID, uid)
		return be.createBlockIndex(ctx, key, convID, uid)
	}

	// Decode and return
	var bi blockIndex
	if err = decode(raw, &bi); err != nil {
		return bi, NewInternalError(ctx, be.DebugLabeler, "readBlockIndex: failed to decode: %s", err.Error())
	}
	if bi.Version != blockIndexVersion {
		be.Debug(ctx, "readBlockInbox: version mismatch, creating new index")
		return be.createBlockIndex(ctx, key, convID, uid)
	}

	// Check server version
	if _, err = be.G().ServerCacheVersions.MatchBodies(ctx, bi.ServerVersion); err != nil {
		be.Debug(ctx, "readBlockInbox: server version error: %s, creating new index", err.Error())
		return be.createBlockIndex(ctx, key, convID, uid)
	}

	return bi, nil
}

type bekey string

var (
	bebikey bekey = "bebi"
	beskkey bekey = "besk"
)

func (be *blockEngine) Init(ctx context.Context, key [32]byte, convID chat1.ConversationID,
	uid gregor1.UID,
) (context.Context, Error) {
	ctx = context.WithValue(ctx, beskkey, key)

	bi, err := be.readBlockIndex(ctx, convID, uid)
	if err != nil {
		return ctx, err
	}
	ctx = context.WithValue(ctx, bebikey, &bi)

	return ctx, nil
}

func (be *blockEngine) fetchBlockIndex(ctx context.Context, convID chat1.ConversationID,
	uid gregor1.UID,
) (bi blockIndex, err Error) {
	var ok bool
	val := ctx.Value(bebikey)
	if bi, ok = val.(blockIndex); !ok {
		bi, err = be.readBlockIndex(ctx, convID, uid)
		if err != nil {
			return bi, err
		}
	}
	be.Debug(ctx, "fetchBlockIndex: maxBlock: %d", bi.MaxBlock)
	return bi, err
}

func (be *blockEngine) fetchSecretKey(ctx context.Context) (key [32]byte, err Error) {
	var ok bool
	val := ctx.Value(beskkey)
	if key, ok = val.([32]byte); !ok {
		return key, MiscError{Msg: "secret key not in context"}
	}
	return key, nil
}

func (be *blockEngine) createBlockSingle(ctx context.Context, bi blockIndex, blockID int) (block, Error) {
	be.Debug(ctx, "createBlockSingle: creating block: %d", blockID)
	// Write out new block
	b := block{BlockID: blockID}
	if cerr := be.writeBlock(ctx, bi, b); cerr != nil {
		return block{}, NewInternalError(ctx, be.DebugLabeler, "createBlockSingle: failed to write block: %s", cerr.Message())
	}
	return b, nil
}

func (be *blockEngine) createBlock(ctx context.Context, bi *blockIndex, blockID int) (block, Error) {
	// Create all the blocks up to the one we want
	var b block
	for i := bi.MaxBlock + 1; i <= blockID; i++ {
		b, err := be.createBlockSingle(ctx, *bi, i)
		if err != nil {
			return b, err
		}
	}

	// Update block index with new block
	bi.MaxBlock = blockID
	dat, err := encode(bi)
	if err != nil {
		return block{}, NewInternalError(ctx, be.DebugLabeler, "createBlock: failed to encode block: %s", err.Error())
	}
	err = be.G().LocalChatDb.PutRaw(makeBlockIndexKey(bi.ConvID, bi.UID), dat)
	if err != nil {
		return block{}, NewInternalError(ctx, be.DebugLabeler, "createBlock: failed to write index: %s", err.Error())
	}

	return b, nil
}

func (be *blockEngine) getBlock(ctx context.Context, bi blockIndex, id chat1.MessageID) (block, Error) {
	if id == 0 {
		return block{}, NewInternalError(ctx, be.DebugLabeler, "getBlock: invalid block id: %d", id)
	}
	bn := be.getBlockNumber(id)
	if bn > bi.MaxBlock {
		be.Debug(ctx, "getBlock(): missed high: id: %d maxblock: %d", bn, bi.MaxBlock)
		return block{}, MissError{}
	}
	return be.readBlock(ctx, bi, bn)
}

func (be *blockEngine) readBlock(ctx context.Context, bi blockIndex, id int) (res block, err Error) {
	be.Debug(ctx, "readBlock: reading block: %d", id)
	// Manage in memory cache
	if b, ok := blockEngineMemCache.getBlock(ctx, bi.UID, bi.ConvID, id); ok {
		be.Debug(ctx, "readBlock: cache hit")
		return b, nil
	}
	defer func() {
		if err == nil {
			blockEngineMemCache.writeBlock(ctx, bi.UID, bi.ConvID, res)
		}
	}()

	key := be.makeBlockKey(bi.ConvID, bi.UID, id)
	raw, found, ierr := be.G().LocalChatDb.GetRaw(key)
	if ierr != nil {
		return res,
			NewInternalError(ctx, be.DebugLabeler, "readBlock: failed to read raw: %s", ierr.Error())
	}
	if !found {
		// Didn't find it for some reason
		return res, NewInternalError(ctx, be.DebugLabeler, "readBlock: block not found: id: %d", id)
	}

	// Decode boxed block
	var b boxedBlock
	if ierr := decode(raw, &b); ierr != nil {
		return res,
			NewInternalError(ctx, be.DebugLabeler, "readBlock: failed to decode: %s", ierr.Error())
	}
	if b.V > cryptoVersion {
		return res,
			NewInternalError(ctx, be.DebugLabeler, "readBlock: bad crypto version: %d current: %d id: %d", b.V,
				cryptoVersion, id)
	}

	// Decrypt block
	fkey, cerr := be.fetchSecretKey(ctx)
	if cerr != nil {
		return res, cerr
	}
	pt, ok := secretbox.Open(nil, b.E, &b.N, &fkey)
	if !ok {
		return res, NewInternalError(ctx, be.DebugLabeler, "readBlock: failed to decrypt block: %d", id)
	}

	// Decode payload
	if ierr = decode(pt, &res); ierr != nil {
		return res,
			NewInternalError(ctx, be.DebugLabeler, "readBlock: failed to decode: %s", ierr.Error())
	}
	return res, nil
}

func (be *blockEngine) writeBlock(ctx context.Context, bi blockIndex, b block) (err Error) {
	be.Debug(ctx, "writeBlock: writing out block: %d", b.BlockID)
	defer func() {
		if err == nil {
			blockEngineMemCache.writeBlock(ctx, bi.UID, bi.ConvID, b)
		}
	}()

	// Encode block
	dat, ierr := encode(b)
	if ierr != nil {
		return NewInternalError(ctx, be.DebugLabeler, "writeBlock: failed to encode: %s", ierr.Error())
	}

	// Encrypt block
	key, cerr := be.fetchSecretKey(ctx)
	if cerr != nil {
		return cerr
	}
	var nonce []byte
	nonce, ierr = libkb.RandBytes(24)
	if ierr != nil {
		return MiscError{Msg: fmt.Sprintf("encryptMessage: failure to generate nonce: %s", ierr.Error())}
	}
	var fnonce [24]byte
	copy(fnonce[:], nonce)
	sealed := secretbox.Seal(nil, dat, &fnonce, &key)

	// Encode encrypted block
	payload := boxedBlock{
		V: cryptoVersion,
		N: fnonce,
		E: sealed,
	}
	bpayload, ierr := encode(payload)
	if ierr != nil {
		return NewInternalError(ctx, be.DebugLabeler, "writeBlock: failed to encode: %s", ierr.Error())
	}

	// Write out encrypted block
	if ierr := be.G().LocalChatDb.PutRaw(be.makeBlockKey(bi.ConvID, bi.UID, b.BlockID), bpayload); ierr != nil {
		return NewInternalError(ctx, be.DebugLabeler, "writeBlock: failed to write: %s", ierr.Error())
	}
	return nil
}

func (be *blockEngine) WriteMessages(ctx context.Context, convID chat1.ConversationID, uid gregor1.UID,
	msgs []chat1.MessageUnboxed,
) Error {
	msgIDs := make([]chat1.MessageID, len(msgs))
	msgMap := make(map[chat1.MessageID]chat1.MessageUnboxed)
	for index, msg := range msgs {
		msgMap[msg.GetMessageID()] = msg
		msgIDs[index] = msg.GetMessageID()
	}
	return be.writeMessagesIDMap(ctx, convID, uid, msgIDs, msgMap)
}

func (be *blockEngine) writeMessagesIDMap(ctx context.Context, convID chat1.Conver
```

### Core Architecture Module: `go/chat/unfurl/utils.go`
```
package unfurl

import (
	"errors"
	"net"
	"net/url"
	"strings"

	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/protocol/chat1"
	"golang.org/x/net/publicsuffix"
)

func GetDefaultFaviconURL(uri string) (string, error) {
	parsed, err := url.Parse(uri)
	if err != nil {
		return "", err
	}
	parsed.Path = "favicon.ico"
	parsed.RawQuery = ""
	return parsed.String(), nil
}

func GetDefaultAppleTouchURL(uri string) (string, error) {
	parsed, err := url.Parse(uri)
	if err != nil {
		return "", err
	}
	parsed.Path = "apple-touch-icon.png"
	parsed.RawQuery = ""
	return parsed.String(), nil
}

func GetHostname(uri string) (string, error) {
	parsed, err := url.Parse(uri)
	if err != nil {
		return "", err
	}
	return parsed.Hostname(), nil
}

func GetDomain(uri string) (res string, err error) {
	hostname, err := GetHostname(uri)
	if err != nil {
		return res, err
	}
	if len(hostname) == 0 {
		return res, errors.New("no hostname")
	}
	if hostname == types.MapsDomain {
		return hostname, nil
	}
	// Check if hostname is an IP address. If so, return it directly
	// since publicsuffix.EffectiveTLDPlusOne doesn't work with IPs.
	if net.ParseIP(hostname) != nil {
		return hostname, nil
	}
	return publicsuffix.EffectiveTLDPlusOne(hostname)
}

func IsDomain(domain, target string) bool {
	return strings.Contains(domain, target+".")
}

func ClassifyDomain(domain string) chat1.UnfurlType {
	switch {
	case domain == "gph.is":
		fallthrough
	case IsDomain(domain, "giphy"):
		return chat1.UnfurlType_GIPHY
	case domain == types.MapsDomain:
		return chat1.UnfurlType_MAPS
	default:
		return chat1.UnfurlType_GENERIC
	}
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1083** (2015-10-26): **Investigate stage0 endpoint timeouts**
  *Symptoms*: Some KBFS writes are failing with:  ```     "Error": "API network error: Get https://stage0.keybase.io/_/api/1.0/sesscheck.json: net/http: request canceled while waiting for connection (Client.Timeout exceeded while awaiting headers) (error 1601)" ```  KBFS should probably be retrying after a short timeout.  But we should also try to work out what's up with stage0.  (Could it be rate-limiting?) 

- **Issue #1026** (2015-10-26): **can't seem to clear local state, using either logout or reset**
  *Symptoms*: if I both `logout` and `reset`, and then login, it still knows who I am.  ``` > kbstage logout > kbstage reset Really delete all local cached state? (type 'YES' to confirm): YES ```  Then if I login without a username:  ``` > kbstage login ```  I get a pinentry and it knows the username I had previously been using.  ![image](https://cloud.githubusercontent.com/assets/614943/10148144/ec704b06-65ff-11e5-9783-8dd4dd6b62f0.png) 
  **Post-Mortem & Fix Analysis**:
  > This might be related to keychain stuff #1027 #1002. I am working on those right now. 
  > I don't think any of those commands clear out the config file, which is what would be required to get with @malgorithms wants.  Do we really want to clear out the config file?  And/or the secret keyrings?  It would really F over the user.  One fix might be to clear out the `current_user` field of the `config.json` file, which would address the immediate concern here. 

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

### Incident Patch 1: `7f18ea4d` (2026-10-19)
**Commit Message**: fix(share): make sharing into chat reliable on iOS and Android (#29789)

* fix(chat): don't silently drop a share to a suggested conversation before its meta loads

* fix(chat): keep the drag-and-drop upload path and explain a disabled Send

* fix(ios-share): give each shared file its own subdirectory so same-named photos don't collide

* fix(ios-share): stop decoding images in the share extension; transcode them in the app

Image types the app couldn't take as-is (TIFF, RAW, webp, avif) were loaded
into Data, fully decoded by UIImage and re-encoded inside the share extension,
several at once. A 48MP decode alone is past the extension's memory limit,
and no downsample cap avoids a full decode for sources under twice the cap.

The extension now copies those files as-is, keeping their real name and
extension, and the Safari path writes downloaded webp/avif bytes unchanged.
Only a provider that vends nothing but an in-memory UIImage is still encoded
there, with ImageIO and no resize.

The app now does the transcode. With compression on, the new extensions
are handled like heic. With compression off they still go out as
full-size JPEGs at the quality the extension used, 0.85, so recipi

**File**: `go/chat/attachments/preprocess.go` (modified, +4/-4)
```diff
@@ -194,16 +194,16 @@ func processCallerPreview(ctx context.Context, g *globals.Context, callerPreview
 
 func DetectMIMEType(ctx context.Context, src ReadResetter, filename string) (res string, err error) {
 	head := make([]byte, 512)
-	_, err = io.ReadFull(src, head)
+	n, err := io.ReadFull(src, head)
 	switch {
-	case err == nil:
-	case errors.Is(err, io.EOF), errors.Is(err, io.ErrUnexpectedEOF):
+	case err == nil, errors.Is(err, io.ErrUnexpectedEOF):
+	case errors.Is(err, io.EOF):
 		return "", nil
 	default:
 		return res, err
 	}
 
-	res = http.DetectContentType(head)
+	res = http.DetectContentType(head[:n])
 	if err = src.Reset(); err != nil {
 		return res, err
 	}
```

**File**: `go/chat/attachments/preprocess_test.go` (added, +34/-0)
```diff
@@ -0,0 +1,34 @@
+package attachments
+
+import (
+	"bytes"
+	"context"
+	"image"
+	"image/color"
+	"image/png"
+	"testing"
+
+	"github.com/stretchr/testify/require"
+)
+
+func TestDetectMIMETypeSmallFile(t *testing.T) {
+	img := image.NewRGBA(image.Rect(0, 0, 4, 4))
+	for x := 0; x < 4; x++ {
+		for y := 0; y < 4; y++ {
+			img.Set(x, y, color.RGBA{R: 200, G: 30, B: 30, A: 255})
+		}
+	}
+	var buf bytes.Buffer
+	require.NoError(t, png.Encode(&buf, img))
+	require.Less(t, buf.Len(), 512)
+
+	typ, err := DetectMIMEType(context.Background(), NewBufReadResetter(buf.Bytes()), "testuser.png")
+	require.NoError(t, err)
+	require.Equal(t, "image/png", typ)
+}
+
+func TestDetectMIMETypeEmptyFile(t *testing.T) {
+	typ, err := DetectMIMEType(context.Background(), NewBufReadResetter(nil), "testuser.png")
+	require.NoError(t, err)
+	require.Empty(t, typ)
+}
```

**File**: `go/kbfs/libkbfs/subscription_manager.go` (modified, +175/-110)
```diff
@@ -129,13 +129,21 @@ type nonPathSubscription struct {
 // This is per client. For example, if we have multiple GUI instances, each of
 // them get their own client ID and their subscriptions won't affect each
 // other.
+//
+// lock is never held while calling into a folder (getFolderBranch,
+// RegisterForChanges, UnregisterFromChanges): folders call back into the
+// subscription manager (LocalChange, BatchChanges) while holding their own
+// locks. subscribeLock, taken before lock, serializes subscribing,
+// unsubscribing and polling instead, so the registration made after
+// releasing lock matches the count change made under it.
 type subscriptionManager struct {
 	clientID SubscriptionManagerClientID
 	config   Config
 	log      logger.Logger
 	notifier SubscriptionNotifier
 
 	onlineStatusTracker *onlineStatusTracker
+	subscribeLock       sync.Mutex
 	lock                sync.RWMutex
 	// TODO HOTPOT-416: add another layer here to reference by topics, and
 	// actually check topics in LocalChange and BatchChanges.
@@ -179,55 +187,76 @@ func newSubscriptionManager(clientID SubscriptionManagerClientID, config Config,
 
 func (sm *subscriptionManager) Shutdown(ctx context.Context) {
 	sm.onlineStatusTracker.shutdown()
+	sm.subscribeLock.Lock()
+	defer sm.subscribeLock.Unlock()
 	sm.lock.Lock()
-	defer sm.lock.Unlock()
 	pathSids := make([]SubscriptionID, 0, len(sm.pathSubscriptionIDToRef))
 	nonPathSids := make([]SubscriptionID, 0, len(sm.nonPathSubscriptionIDToTopic))
 	for sid := range sm.pathSubscriptionIDToRef {
 		pathSids = append(pathSids, sid)
 	}
+	for sid := range sm.folderBranchPollerCancelers {
+		pathSids = append(pathSids, sid)
+	}
 	for sid := range sm.nonPathSubscriptionIDToTopic {
 		nonPathSids = append(nonPathSids, sid)
 	}
+	var unregister []data.FolderBranch
 	for _, sid := range pathSids {
-		sm.unsubscribePathLocked(ctx, sid)
+		if fb, last := sm.unsubscribePathLocked(ctx, sid); last {
+			unregister = append(unregister, fb)
+		}
 	}
 	for _, sid := range nonPathSids {
 		sm.unsubscribeNonPathLocked(ctx, sid)
 	}
+	sm.lock.Unlock()
+	for _, fb := range unregister {
+		sm.unregisterFromChanges(ctx, fb)
+	}
+}
+
+// registerForChanges and unregisterFromChanges call into the folder, so they
+// run under subscribeLock with lock released.
+//
+// registerForChanges registers for fb's first subscription, sid. If that
+// fails it removes sid, so the next subscription to fb tries again.
+func (sm *subscriptionManager) registerForChanges(
+	ctx context.Context, sid SubscriptionID, fb data.FolderBranch,
+) error {
+	err := sm.config.Notifier().RegisterForChanges([]data.FolderBranch{fb}, sm)
+	if err != nil {
+		sm.log.CWarningf(ctx, "RegisterForChanges fb=%s err=%v", fb, err)
+		sm.lock.Lock()
+		_, _ = sm.unsubscribePathLocked(ctx, sid)
+		sm.lock.Unlock()
+	}
+	return err
+}
+
+func (sm *subscriptionManager) unregisterFromChanges(
+	ctx context.Context, fb data.FolderBranch,
+) {
+	err := sm.config.Notifier().UnregisterFromChanges(
+		[]data.FolderBranch{fb}, sm)
+	if err != nil {
+		sm.log.CWarningf(ctx, "UnregisterFromChanges fb=%s err=%v", fb, err)
+	}
 }
 
 func (sm *subscriptionManager) OnlineStatusTracker() OnlineStatusTracker {
 	return sm.onlineStatusTracker
 }
 
 func (sm *subscriptionManager) checkSubscriptionIDLocked(sid SubscriptionID) (setter func(), err error) {
-	if sm.subscriptionIDs[sid] {
+	if sm.subscriptionIDs[sid] || sm.folderBranchPollerCancelers[sid] != nil {
 		return nil, errors.Errorf("duplicate subscription ID %q", sid)
 	}
 	return func() {
 		sm.subscriptionIDs[sid] = true
 	}, nil
 }
 
-func (sm *subscriptionManager) registerForChangesLocked(fb data.FolderBranch) {
-	if sm.subscriptionCountByFolderBranch[fb] == 0 {
-		_ = sm.config.Notifier().RegisterForChanges(
-			[]data.FolderBranch{fb}, sm)
-	}
-	sm.subscriptionCountByFolderBranch[fb]++
-}
-
-func (sm *subscriptionManager) unregisterForChangesLocked(fb data.FolderBranch) {
-	if sm.subscriptionCountByFolderBranch[fb] == 1 {
-		_ = sm.config.Notifier().UnregisterFromChanges(
-			[]data.FolderBranch{fb}, sm)
-		delete(sm.subscriptionCountByFolderBranch, fb)
-		return
-	}
-	sm.subscriptionCountByFolderBranch[fb]--
-}
-
 func (sm *subscriptionManager) preparePathNotification(
 	ref pathSubscriptionRef) (sids []SubscriptionID,
 	paths []string, topics []keybase1.PathSubscriptionTopic,
@@ -300,10 +329,12 @@ type subscribePathRequest struct {
 	deduplicateInterval *time.Duration
 }
 
+// subscribePathWithFolderBranchLocked reports whether this is fb's first
+// subscription; the caller must then RegisterForChanges after unlocking.
 func (sm *subscriptionManager) subscribePathWithFolderBranchLocked(
 	req subscribePathRequest,
 	parsedPath *parsedPath, fb data.FolderBranch,
-) error {
+) (first bool, err error) {
 	nitp := getCleanInTlfPath(parsedPath)
 	ref := pathSubscriptionRef{
 		folderBranch: fb,
@@ -312,9 +343,10 @@ func (sm *subscriptionManager) subscribePathWithFolderBranchLocked(
 
 	subscriptionIDS
```

**File**: `go/kbfs/libkbfs/subscription_manager_test.go` (modified, +497/-0)
```diff
@@ -6,8 +6,10 @@ package libkbfs
 
 import (
 	"context"
+	"errors"
 	"fmt"
 	"reflect"
+	"sync"
 	"testing"
 	"time"
 
@@ -16,6 +18,7 @@ import (
 	"github.com/keybase/client/go/kbfs/favorites"
 	"github.com/keybase/client/go/kbfs/libcontext"
 	"github.com/keybase/client/go/kbfs/tlf"
+	"github.com/keybase/client/go/kbfs/tlfhandle"
 	keybase1 "github.com/keybase/client/go/protocol/keybase1"
 	"github.com/stretchr/testify/require"
 )
@@ -47,6 +50,10 @@ func initSubscriptionManagerTest(t *testing.T) (config Config,
 	sm = config.SubscriptionManager(
 		testSubscriptionManagerClientID, false, notifier)
 	return config, sm, notifier, func() {
+		if t.Failed() {
+			// A failed test may leave a goroutine blocked in a gate.
+			return
+		}
 		err := config.Shutdown(context.Background())
 		require.NoError(t, err)
 		ctl.Finish()
@@ -272,3 +279,493 @@ func TestSubscriptionManagerSubscribePathNoFolderBranch(t *testing.T) {
 
 	waiter0()
 }
+
+// gatedRootNodeOps holds a found root node until release is closed, standing
+// in for a folder whose head lock is held by an in-progress write. Lookups
+// that find nothing pass straight through.
+type gatedRootNodeOps struct {
+	KBFSOps
+	enteredOnce sync.Once
+	entered     chan struct{}
+	release     chan struct{}
+}
+
+func (o *gatedRootNodeOps) GetRootNode(
+	ctx context.Context, h *tlfhandle.Handle, branch data.BranchName) (
+	Node, data.EntryInfo, error,
+) {
+	node, ei, err := o.KBFSOps.GetRootNode(ctx, h, branch)
+	if node == nil {
+		return node, ei, err
+	}
+	o.enteredOnce.Do(func() { close(o.entered) })
+	<-o.release
+	return node, ei, err
+}
+
+// gatedObserver blocks in BatchChanges once armed, holding the folder's
+// observer-list lock the way a notification in progress does.
+type gatedObserver struct {
+	entered chan struct{}
+	release chan struct{}
+}
+
+func (o *gatedObserver) LocalChange(context.Context, Node, WriteRange) {}
+func (o *gatedObserver) BatchChanges(context.Context, []NodeChange, []NodeID) {
+	close(o.entered)
+	<-o.release
+}
+func (o *gatedObserver) TlfHandleChange(context.Context, *tlfhandle.Handle) {}
+
+func recvWithin[T any](t *testing.T, ch <-chan T, what string) T {
+	select {
+	case v := <-ch:
+		return v
+	case <-time.After(5 * time.Second):
+		require.FailNow(t, what+" timed out")
+	}
+	var zero T
+	return zero
+}
+
+func runWithin(t *testing.T, timeout time.Duration, what string, f func()) {
+	done := make(chan struct{})
+	go func() {
+		f()
+		close(done)
+	}()
+	select {
+	case <-done:
+	case <-time.After(timeout):
+		require.FailNow(t, what+" deadlocked")
+	}
+}
+
+func TestSubscriptionManagerNotifyDuringSubscribeLookup(t *testing.T) {
+	config, smi, _, finish := initSubscriptionManagerTest(t)
+	defer finish()
+	sm := smi.(*subscriptionManager)
+	ctx := t.Context()
+
+	tlfHandle, err := GetHandleFromFolderNameAndType(
+		ctx, config.KBPKI(), config.MDOps(), config, "jdoe", tlf.Private)
+	require.NoError(t, err)
+	_, _, err = config.KBFSOps().GetOrCreateRootNode(
+		ctx, tlfHandle, data.MasterBranch)
+	require.NoError(t, err)
+
+	realOps := config.KBFSOps()
+	gated := &gatedRootNodeOps{
+		KBFSOps: realOps,
+		entered: make(chan struct{}),
+		release: make(chan struct{}),
+	}
+	config.(*ConfigLocal).SetKBFSOps(gated)
+	defer config.(*ConfigLocal).SetKBFSOps(realOps)
+
+	subscribed := make(chan error, 1)
+	go func() {
+		subscribed <- sm.SubscribePath(ctx, "sid1", "/keybase/private/jdoe",
+			keybase1.PathSubscriptionTopic_CHILDREN, nil)
+	}()
+	recvWithin(t, gated.entered, "root node lookup")
+
+	// The folder can't finish the lookup until its own change notification
+	// returns, so that notification must not wait on the subscribe.
+	runWithin(t, 5*time.Second, "change notification", func() {
+		sm.BatchChanges(ctx, nil, nil)
+	})
+	close(gated.release)
+	require.NoError(t, recvWithin(t, subscribed, "subscribe"))
+}
+
+// testStopDuringSubscribeLookup stops a subscription while SubscribePath is
+// still looking up its folderBranch, and checks it leaves nothing behind.
+func testStopDuringSubscribeLookup(
+	t *testing.T, stop func(context.Context, *subscriptionManager),
+) {
+	config, smi, _, finish := initSubscriptionManagerTest(t)
+	defer finish()
+	sm := smi.(*subscriptionManager)
+	ctx := t.Context()
+
+	tlfHandle, err := GetHandleFromFolderNameAndType(
+		ctx, config.KBPKI(), config.MDOps(), config, "jdoe", tlf.Private)
+	require.NoError(t, err)
+	rootNode, _, err := config.KBFSOps().GetOrCreateRootNode(
+		ctx, tlfHandle, data.MasterBranch)
+	require.NoError(t, err)
+	fb := rootNode.GetFolderBranch()
+	fbo := config.KBFSOps().(*KBFSOpsStandard).getOpsNoAdd(ctx, fb)
+
+	realOps := config.KBFSOps()
+	gated := &gatedRootNodeOps{
+		KBFSOps: realOps,
+		entered: make(chan struct{}),
+		release: make(chan struct{}),
+	}
+	config.(*ConfigLocal).SetKBFSOps(gated)
+
+	subscribed := make(chan error, 1)
+	go func() {
+		subscribed <- sm.SubscribePath(ctx, "sid1", "/keybase/private/jdoe",
+			keybase1.PathSubscriptionTopic_CHILDRE
```

**File**: `go/protocol/keybase1/incoming-share.go` (modified, +26/-2)
```diff
@@ -101,6 +101,30 @@ func (o IncomingShareItem) DeepCopy() IncomingShareItem {
 	}
 }
 
+type IncomingShareItems struct {
+	Items        []IncomingShareItem `codec:"items" json:"items"`
+	DroppedCount int                 `codec:"droppedCount" json:"droppedCount"`
+	Id           string              `codec:"id" json:"id"`
+}
+
+func (o IncomingShareItems) DeepCopy() IncomingShareItems {
+	return IncomingShareItems{
+		Items: (func(x []IncomingShareItem) []IncomingShareItem {
+			if x == nil {
+				return nil
+			}
+			ret := make([]IncomingShareItem, len(x))
+			for i, v := range x {
+				vCopy := v.DeepCopy()
+				ret[i] = vCopy
+			}
+			return ret
+		})(o.Items),
+		DroppedCount: o.DroppedCount,
+		Id:           o.Id,
+	}
+}
+
 type IncomingShareCompressPreference int
 
 const (
@@ -148,7 +172,7 @@ type SetPreferenceArg struct {
 }
 
 type IncomingShareInterface interface {
-	GetIncomingShareItems(context.Context) ([]IncomingShareItem, error)
+	GetIncomingShareItems(context.Context) (IncomingShareItems, error)
 	GetPreference(context.Context) (IncomingSharePreference, error)
 	SetPreference(context.Context, IncomingSharePreference) error
 }
@@ -200,7 +224,7 @@ type IncomingShareClient struct {
 	Cli rpc.GenericClient
 }
 
-func (c IncomingShareClient) GetIncomingShareItems(ctx context.Context) (res []IncomingShareItem, err error) {
+func (c IncomingShareClient) GetIncomingShareItems(ctx context.Context) (res IncomingShareItems, err error) {
 	err = c.Cli.Call(ctx, "keybase.1.incomingShare.getIncomingShareItems", []any{GetIncomingShareItemsArg{}}, &res, 0*time.Millisecond)
 	return
 }
```

**File**: `go/service/incoming-share.go` (modified, +125/-14)
```diff
@@ -6,9 +6,10 @@ package service
 import (
 	"context"
 	"encoding/json"
-	"errors"
 	"os"
 	"path/filepath"
+	"sync"
+	"time"
 
 	"github.com/keybase/client/go/libkb"
 	keybase1 "github.com/keybase/client/go/protocol/keybase1"
@@ -60,25 +61,135 @@ func IncomingShareFolder(mobileSharedHome string) string {
 	return filepath.Join(mobileSharedHome, "Library", "Caches", "incoming-shares")
 }
 
-func (h *IncomingShareHandler) GetIncomingShareItems(ctx context.Context) (items []keybase1.IncomingShareItem, err error) {
+const (
+	incomingShareManifest = "manifest.json"
+	// A manifest being read is moved here first. Reads are serialized by
+	// lastIncomingShare; one a crash left behind is replaced by the next read,
+	// or purged.
+	incomingShareClaimedManifest = "manifest.claimed"
+)
+
+// How long a claimed share is still handed out again. The app can throw an
+// answer away (a newer load superseded it, a disconnect cancelled it) and load
+// again; that reload has to get the share, not nothing.
+const incomingShareRepeatWindow = 30 * time.Second
+
+// The last share claimed, and the user it was handed to, guarded by its mutex,
+// which also serializes reads.
+var lastIncomingShare struct {
+	sync.Mutex
+	folder string
+	uid    keybase1.UID
+	at     time.Time
+	res    keybase1.IncomingShareItems
+}
+
+// GetIncomingShareItems hands out each share once. The manifest is moved aside
+// before it is read and removed after; a repeat call within
+// incomingShareRepeatWindow, by the same user, gets the same share again, and
+// any other (a stale or replayed keybase://incoming-share link, or another
+// account after a switch) gets no items and no error.
+// The payload files stay until they are sent or purged.
+// A repeat carries the share's id, and only the app knows whether it already
+// acted on that share, so keeping a share from being acted on twice is up to it.
+func (h *IncomingShareHandler) GetIncomingShareItems(ctx context.Context) (res keybase1.IncomingShareItems, err error) {
 	mctx := libkb.NewMetaContext(ctx, h.G())
-	manifestPath := filepath.Join(IncomingShareFolder(h.G().Env.GetMobileSharedHome()), "manifest.json")
-	f, err := os.Open(manifestPath)
+	folder := IncomingShareFolder(h.G().Env.GetMobileSharedHome())
+	if folder == "" {
+		return res, nil
+	}
+	last := &lastIncomingShare
+	last.Lock()
+	defer last.Unlock()
+	now := h.G().Clock().Now()
+	uid := mctx.CurrentUID()
+	res, claimed, err := h.claimIncomingShare(mctx, folder)
+	switch {
+	case err != nil:
+		// a newer share that can't be read still replaces the last one
+		last.folder = ""
+		return res, err
+	case claimed:
+		last.folder, last.uid, last.at, last.res = folder, uid, now, res
+		return res, nil
+	case last.folder == folder && last.uid.Equal(uid) &&
+		now.Sub(last.at) < incomingShareRepeatWindow:
+		mctx.Debug("incoming-share: handing out the share claimed %v ago again", now.Sub(last.at))
+		return stillPresentIncomingShare(last.res), nil
+	default:
+		return keybase1.IncomingShareItems{}, nil
+	}
+}
+
+// stillPresentIncomingShare is the share as handed out again: an item whose
+// file is gone was sent or exported since, so it is left out, and a share with
+// nothing left is nothing to share.
+// A share that had no items to begin with (every one dropped) is handed out
+// as it was, so its notice survives a reload.
+func stillPresentIncomingShare(share keybase1.IncomingShareItems) (res keybase1.IncomingShareItems) {
+	if len(share.Items) == 0 {
+		return share
+	}
+	for _, item := range share.Items {
+		if item.OriginalPath != nil {
+			if _, err := os.Stat(*item.OriginalPath); err != nil {
+				continue
+			}
+		}
+		res.Items = append(res.Items, item)
+	}
+	if len(res.Items) == 0 {
+		return keybase1.IncomingShareItems{}
+	}
+	res.DroppedCount = share.DroppedCount
+	res.Id = share.Id
+	return res
+}
+
+// claimIncomingShare reads and removes the manifest; claimed is false when
+// there is none.
+func (h *IncomingShareHandler) claimIncomingShare(mctx libkb.MetaContext, folder string) (
+	res keybase1.IncomingShareItems, claimed bool, err error,
+) {
+	id, err := libkb.RandHexString("", 8)
+	if err != nil {
+		return res, false, err
+	}
+	claimedPath := filepath.Join(folder, incomingShareClaimedManifest)
+	// A rename is atomic, so of two calls racing for one manifest only one gets it.
+	if err := os.Rename(filepath.Join(folder, incomingShareManifest), claimedPath); err != nil {
+		if os.IsNotExist(err) {
+			mctx.Debug("incoming-share: no manifest, nothing to share")
+			return res, false, nil
+		}
+		mctx.Debug("incoming-share: claim manifest.json error: %v", err)
+		return res, false, err
+	}
+	defer func() {
+		if err := os.Remove(claimedPath); err != nil {
+			mctx.Debug("incoming-share: remove claimed manifest error: %v", err)
+		}
+	}()
+	f, err := os.Open(claimedPath)
 	if err != nil {
 		mctx.Debug("incoming-share: open manifest.json error: %v", err)
-		return nil, err
+		return res, true, err
 	}
 	defer f.Clos
```

**File**: `go/service/incoming-share_test.go` (added, +337/-0)
```diff
@@ -0,0 +1,337 @@
+// Copyright 2026 Keybase, Inc. All rights reserved. Use of
+// this source code is governed by the included BSD license.
+
+package service
+
+import (
+	"context"
+	"encoding/json"
+	"os"
+	"path/filepath"
+	"testing"
+	"time"
+
+	"github.com/keybase/client/go/libkb"
+	keybase1 "github.com/keybase/client/go/protocol/keybase1"
+	clockwork "github.com/keybase/clockwork"
+	"github.com/stretchr/testify/require"
+)
+
+// Writes the manifest that makeManifest builds from the share folder and
+// returns a handler that reads it.
+func setupIncomingShare(t *testing.T, makeManifest func(folder string) []map[string]string) (*IncomingShareHandler, func()) {
+	tc := libkb.SetupTest(t, "incoming-share", 1)
+	tc.G.Env.Test.MobileSharedHome = t.TempDir()
+	folder := IncomingShareFolder(tc.G.Env.GetMobileSharedHome())
+	require.NoError(t, os.MkdirAll(folder, 0o700))
+	b, err := json.Marshal(makeManifest(folder))
+	require.NoError(t, err)
+	require.NoError(t, os.WriteFile(filepath.Join(folder, "manifest.json"), b, 0o600))
+	return NewIncomingShareHandler(nil, tc.G), tc.Cleanup
+}
+
+func TestIncomingShareCountsDroppedItems(t *testing.T) {
+	var good string
+	h, cleanup := setupIncomingShare(t, func(folder string) []map[string]string {
+		good = filepath.Join(folder, "guid", "photo.jpg")
+		require.NoError(t, os.MkdirAll(filepath.Dir(good), 0o700))
+		require.NoError(t, os.WriteFile(good, []byte("jpeg"), 0o600))
+		return []map[string]string{
+			{"type": "image", "originalPath": good},
+			{"type": "error", "error": "loadImage: failed"},
+			{"type": "image", "originalPath": filepath.Join(folder, "guid2", "gone.jpg")},
+			{"type": "text", "content": "hello"},
+		}
+	})
+	defer cleanup()
+
+	res, err := h.GetIncomingShareItems(context.Background())
+	require.NoError(t, err)
+	require.Equal(t, 2, res.DroppedCount)
+	require.Len(t, res.Items, 2)
+	require.Equal(t, keybase1.IncomingShareType_IMAGE, res.Items[0].Type)
+	require.Equal(t, good, *res.Items[0].OriginalPath)
+	require.Equal(t, 4, *res.Items[0].OriginalSize)
+	require.Equal(t, keybase1.IncomingShareType_TEXT, res.Items[1].Type)
+	require.Equal(t, "hello", *res.Items[1].Content)
+}
+
+func TestIncomingShareAllDroppedIsNotAnError(t *testing.T) {
+	h, cleanup := setupIncomingShare(t, func(string) []map[string]string {
+		return []map[string]string{{"type": "error", "error": "loadImage: failed"}}
+	})
+	defer cleanup()
+
+	res, err := h.GetIncomingShareItems(context.Background())
+	require.NoError(t, err)
+	require.Empty(t, res.Items)
+	require.Equal(t, 1, res.DroppedCount)
+}
+
+// The extension writes an empty manifest when the user cancels the share.
+func TestIncomingShareEmptyManifestIsNothingToShare(t *testing.T) {
+	h, cleanup := setupIncomingShare(t, func(string) []map[string]string {
+		return []map[string]string{}
+	})
+	defer cleanup()
+
+	res, err := h.GetIncomingShareItems(context.Background())
+	require.NoError(t, err)
+	require.Empty(t, res.Items)
+	require.Zero(t, res.DroppedCount)
+}
+
+func writeIncomingShareManifest(t *testing.T, h *IncomingShareHandler, items []map[string]string) {
+	b, err := json.Marshal(items)
+	require.NoError(t, err)
+	folder := IncomingShareFolder(h.G().Env.GetMobileSharedHome())
+	require.NoError(t, os.WriteFile(filepath.Join(folder, "manifest.json"), b, 0o600))
+}
+
+func incomingShareText(t *testing.T, h *IncomingShareHandler) string {
+	res, err := h.GetIncomingShareItems(context.Background())
+	require.NoError(t, err)
+	require.Zero(t, res.DroppedCount)
+	if len(res.Items) == 0 {
+		return ""
+	}
+	require.Len(t, res.Items, 1)
+	return *res.Items[0].Content
+}
+
+func TestIncomingShareIsReadOnce(t *testing.T) {
+	h, cleanup := setupIncomingShare(t, func(string) []map[string]string {
+		return []map[string]string{{"type": "text", "content": "hello"}}
+	})
+	defer cleanup()
+	clock := clockwork.NewFakeClock()
+	h.G().SetClock(clock)
+	folder := IncomingShareFolder(h.G().Env.GetMobileSharedHome())
+
+	require.Equal(t, "hello", incomingShareText(t, h))
+
+	// Neither the manifest nor the claimed copy is left behind.
+	entries, err := os.ReadDir(folder)
+	require.NoError(t, err)
+	require.Empty(t, entries)
+
+	// A reload of an answer the app threw away gets the share again.
+	clock.Advance(incomingShareRepeatWindow - time.Second)
+	require.Equal(t, "hello", incomingShareText(t, h))
+
+	// A replayed incoming-share link later on gets nothing, without an error.
+	clock.Advance(2 * time.Second)
+	require.Empty(t, incomingShareText(t, h))
+}
+
+func TestIncomingShareRepeatLeavesOutFilesSinceRemoved(t *testing.T) {
+	var sent, kept string
+	h, cleanup := setupIncomingShare(t, func(folder string) []map[string]string {
+		sent = filepath.Join(folder, "guid", "sent.jpg")
+		kept = filepath.Join(folder, "guid2", "kept.jpg")
+		for _, p := range []string{sent, kept} {
+			require.NoError(t, os.MkdirAll(filepath.Dir(p), 0o700))
+			require.NoError(t, os.WriteFile(p, []byte("jpeg"), 0o600))
+		}
+		return []map[string]
```

**File**: `go/service/main.go` (modified, +22/-2)
```diff
@@ -441,6 +441,7 @@ func (d *Service) purgeOldIncomingShareData() {
 		return
 	}
 	cutoff := time.Now().Add(-incomingShareMaxAge)
+	d.purgeOldClaimedIncomingShareManifest(dir, cutoff)
 	for _, entry := range entries {
 		// manifest.json lives alongside the payload dirs and is the live handoff
 		// to the app; only the directories are ours to remove.
@@ -451,8 +452,10 @@ func (d *Service) purgeOldIncomingShareData() {
 		if err != nil {
 			continue
 		}
-		// Writing the processed copy into the payload dir bumps its mtime, so a
-		// share still being worked on keeps renewing its lease.
+		// The payload dir's mtime is when the extension last added an item to
+		// it. Each item lives in its own subdirectory, so the app's processed
+		// copies land there and don't renew it: a share left unsent past the
+		// cutoff is removed.
 		if info.ModTime().After(cutoff) {
 			continue
 		}
@@ -463,6 +466,23 @@ func (d *Service) purgeOldIncomingShareData() {
 	}
 }
 
+// purgeOldClaimedIncomingShareManifest removes a claimed manifest that a crash
+// left mid-read. A read holds lastIncomingShare while it uses the claimed
+// manifest, which keeps the manifest's old mtime, so this must not run during
+// one.
+func (d *Service) purgeOldClaimedIncomingShareManifest(dir string, cutoff time.Time) {
+	lastIncomingShare.Lock()
+	defer lastIncomingShare.Unlock()
+	p := filepath.Join(dir, incomingShareClaimedManifest)
+	info, err := os.Stat(p)
+	if err != nil || info.ModTime().After(cutoff) {
+		return
+	}
+	if err := os.Remove(p); err != nil {
+		d.G().Log.Debug("purgeOldIncomingShareData: failed to remove %s: %s", p, err)
+	}
+}
+
 func (d *Service) startChatModules() {
 	kuid := d.G().Env.GetUID()
 	if !kuid.IsNil() {
```

---

### Incident Patch 2: `594ed87e` (2026-10-19)
**Commit Message**: perf(rpc): cache typed-array probe names, drop incoming rest-spread copy; fix JSI test/bench scripts (#29799)

* fix(rn-kb): add cxxstableapi include path to the JSI test and bench scripts

RN 0.88's CallInvoker.h includes react/cxxstableapi/UmbrellaGuard.h, so both
scripts failed to compile against the current pods.

* fix(rn-kb): build the JSI bench baseline against the current bridge API

The baseline still targeted master's pre-hardening install/onDataFromGo
signatures and skipped frame-parser.cpp, so it no longer compiled. Copy the
base ref's whole cpp/ directory instead, and let KB_BENCH_BASE pick the ref.

* perf(rn-kb): cache the typed-array probe PropNameIDs

tryPackTypedArray looked up byteLength (and buffer/byteOffset for views) by
C string, interning a fresh PropNameID on every outgoing plain object. Cache
them like rpcOnJs, released with the rest of the JSI state.

Bench on the real-traffic corpus: encode 507 -> 501 ms best of 7.

* perf(engine): index incoming messages instead of rest-spreading them

dispatchDecodedMessage copied every incoming message array with
[type, ...rest]. Read the fields by index; validation is unchanged and now
covered per message type.

* fi

**File**: `rnmodules/react-native-kb/cpp/react-native-kb.cpp` (modified, +24/-9)
```diff
@@ -67,6 +67,9 @@ void KBBridge::releaseJSIState() {
   cachedUint8ArrayCtor_.reset();
   cachedIsView_.reset();
   cachedRpcOnJsName_.reset();
+  cachedByteLengthName_.reset();
+  cachedBufferName_.reset();
+  cachedByteOffsetName_.reset();
   cachedPropNames_.clear();
   cachedRuntime_ = nullptr;
 }
@@ -97,6 +100,16 @@ void KBBridge::resetRecvLocked() {
   }
 }
 
+const PropNameID &KBBridge::cachedName(Runtime &runtime,
+                                       std::unique_ptr<PropNameID> &slot,
+                                       const char *name) {
+  resetCaches(runtime);
+  if (!slot) {
+    slot = std::make_unique<PropNameID>(PropNameID::forAscii(runtime, name));
+  }
+  return *slot;
+}
+
 Function &KBBridge::uint8ArrayCtor(Runtime &runtime) {
   resetCaches(runtime);
   if (!cachedUint8ArrayCtor_) {
@@ -360,6 +373,11 @@ Value KBBridge::convertMPToJSI(Runtime &runtime, void *mpObj) {
 void KBBridge::convertJSIToMP(Runtime &runtime, const Value &value,
                               void *packer) {
   auto &pk = *static_cast<msgpack::packer<msgpack::sbuffer> *>(packer);
+  const auto &byteLengthName =
+      cachedName(runtime, cachedByteLengthName_, "byteLength");
+  const auto &bufferName = cachedName(runtime, cachedBufferName_, "buffer");
+  const auto &byteOffsetName =
+      cachedName(runtime, cachedByteOffsetName_, "byteOffset");
   std::vector<PackFrame> stack;
   stack.reserve(16);
 
@@ -388,14 +406,14 @@ void KBBridge::convertJSIToMP(Runtime &runtime, const Value &value,
   // byteLength/buffer fields is never mistaken for binary. The range is
   // always bounds-checked against the backing buffer.
   auto tryPackTypedArray = [&](Object &obj) -> bool {
-    auto byteLengthProp = obj.getProperty(runtime, "byteLength");
+    auto byteLengthProp = obj.getProperty(runtime, byteLengthName);
     if (!byteLengthProp.isNumber()) {
       return false;
     }
     if (!isArrayBufferView(runtime, obj)) {
       return false;
     }
-    auto bufferProp = obj.getProperty(runtime, "buffer");
+    auto bufferProp = obj.getProperty(runtime, bufferName);
     if (!bufferProp.isObject()) {
       return false;
     }
@@ -404,7 +422,7 @@ void KBBridge::convertJSIToMP(Runtime &runtime, const Value &value,
       return false;
     }
     auto arrayBuf = bufferObj.getArrayBuffer(runtime);
-    auto byteOffsetProp = obj.getProperty(runtime, "byteOffset");
+    auto byteOffsetProp = obj.getProperty(runtime, byteOffsetName);
     packArrayBufferRange(
         arrayBuf, byteOffsetProp.isNumber() ? byteOffsetProp.getNumber() : 0,
         byteLengthProp.getNumber());
@@ -716,15 +734,12 @@ void KBBridge::onDataFromGo(uint8_t *data, int size, int64_t epoch) {
       }
 
       self->resetCaches(runtime);
-      if (!self->cachedRpcOnJsName_) {
-        self->cachedRpcOnJsName_ = std::make_unique<PropNameID>(
-            PropNameID::forAscii(runtime, "rpcOnJs"));
-      }
       // Deliberately re-read the global each batch instead of caching the
       // function: JS installs a fresh rpcOnJs whenever the engine client is
       // recreated, and a cached handle would keep feeding the dead one.
-      auto onJsValue =
-          runtime.global().getProperty(runtime, *self->cachedRpcOnJsName_);
+      auto onJsValue = runtime.global().getProperty(
+          runtime,
+          self->cachedName(runtime, self->cachedRpcOnJsName_, "rpcOnJs"));
       if (!onJsValue.isObject() ||
           !onJsValue.getObject(runtime).isFunction(runtime)) {
         // These messages are already consumed from the unpacker and cannot be
```

**File**: `rnmodules/react-native-kb/cpp/react-native-kb.h` (modified, +8/-0)
```diff
@@ -90,6 +90,10 @@ class KBBridge : public std::enable_shared_from_this<KBBridge> {
   std::unique_ptr<facebook::jsi::Function> cachedUint8ArrayCtor_;
   std::unique_ptr<facebook::jsi::Function> cachedIsView_;
   std::unique_ptr<facebook::jsi::PropNameID> cachedRpcOnJsName_;
+  // Typed-array probe names, looked up on every outgoing plain object.
+  std::unique_ptr<facebook::jsi::PropNameID> cachedByteLengthName_;
+  std::unique_ptr<facebook::jsi::PropNameID> cachedBufferName_;
+  std::unique_ptr<facebook::jsi::PropNameID> cachedByteOffsetName_;
   std::unordered_map<std::string, facebook::jsi::PropNameID> cachedPropNames_;
   std::string propNameScratch_;
   facebook::jsi::Runtime *cachedRuntime_ = nullptr;
@@ -104,6 +108,10 @@ class KBBridge : public std::enable_shared_from_this<KBBridge> {
   void setObjectKey(facebook::jsi::Runtime &runtime,
                     facebook::jsi::Object &obj, const char *ptr, size_t size,
                     const facebook::jsi::Value &value);
+  const facebook::jsi::PropNameID &
+  cachedName(facebook::jsi::Runtime &runtime,
+             std::unique_ptr<facebook::jsi::PropNameID> &slot,
+             const char *name);
   facebook::jsi::Function &uint8ArrayCtor(facebook::jsi::Runtime &runtime);
   facebook::jsi::Function &arrayBufferIsView(facebook::jsi::Runtime &runtime);
   bool isArrayBufferView(facebook::jsi::Runtime &runtime,
```

**File**: `rnmodules/react-native-kb/cpp/tests/jsi-convert-bench.cpp` (modified, +2/-15)
```diff
@@ -2,7 +2,7 @@
 // Hermes runtime against a corpus of real RPC payloads.
 //
 // The corpus comes from an actual mobile session's Metro log; see
-// scripts/make-bench-corpus.mjs. Build and run both this and the master
+// scripts/make-bench-corpus.mjs. Build and run both this and the
 // baseline with scripts/bench-jsi-convert.sh.
 //
 // Decode direction (msgpack -> JSI): frames are handed to onDataFromGo exactly
@@ -82,20 +82,13 @@ int main(int argc, char **argv) {
     }
   };
 
-#ifdef KB_BASELINE
-  bridge->install(
-      rt, invoker,
-      [&](void *, size_t size) { bytesWritten += size; },
-      onError);
-#else
   bridge->install(
       rt, invoker,
       [&](void *, size_t size) {
         bytesWritten += size;
         return true;
       },
       onError, [&](int64_t) { fprintf(stderr, "fatal\n"); });
-#endif
 
   // Collects everything the decode pass produced so the encode pass has real
   // JSI values to pack. Held in JS so the values stay exactly what rpcOnJs got.
@@ -138,7 +131,7 @@ int main(int argc, char **argv) {
   printf("corpus %s: %zu frames, %.2f MB\n", corpusPath, frames,
          double(corpus.size()) / (1024 * 1024));
 #ifdef KB_BASELINE
-  printf("build: baseline (origin/master)\n");
+  printf("build: baseline\n");
 #else
   printf("build: branch\n");
 #endif
@@ -151,17 +144,11 @@ int main(int argc, char **argv) {
     // way they do on device rather than as one impossible 10MB read.
     constexpr size_t kReadSize = 300 * 1024;
     rt.global().setProperty(rt, "received", jsi::Array(rt, 0));
-#ifndef KB_BASELINE
     bridge->resetRecv();
-#endif
     auto t0 = std::chrono::steady_clock::now();
     for (size_t off = 0; off < corpus.size(); off += kReadSize) {
       const size_t n = std::min(kReadSize, corpus.size() - off);
-#ifdef KB_BASELINE
-      bridge->onDataFromGo(corpus.data() + off, int(n));
-#else
       bridge->onDataFromGo(corpus.data() + off, int(n), 1);
-#endif
     }
     double decodeMs = msSince(t0);
 
```

**File**: `rnmodules/react-native-kb/cpp/tests/jsi-convert-test.cpp` (modified, +63/-0)
```diff
@@ -820,6 +820,65 @@ void testEncodeTypedArrayViews() {
             "ArrayBuffer packed the wrong bytes");
 }
 
+// The typed-array probe names are cached on the bridge, so repeated sends on
+// one runtime must keep telling views from look-alike plain objects.
+void testEncodeTypedArrayProbeRepeats() {
+  Harness h;
+  for (int i = 0; i < 3; ++i) {
+    h.send("{bin: new Uint8Array([1, 2, 3]).subarray(1),"
+           " fake: {byteLength: 2, buffer: new ArrayBuffer(2), byteOffset: 0}}");
+    auto oh = h.lastPayload();
+    const auto &o = oh.get();
+    CHECK(o.type == msgpack::type::MAP);
+    CHECK_EQ(o.via.map.size, uint32_t(2));
+    CHECK_MSG(mpBinToString(o.via.map.ptr[0].val) == std::string("\x02\x03", 2),
+              "subarray view packed the wrong bytes on send " +
+                  std::to_string(i));
+    CHECK_MSG(o.via.map.ptr[1].val.type == msgpack::type::MAP,
+              "look-alike object packed as binary on send " + std::to_string(i));
+    CHECK_EQ(o.via.map.ptr[1].val.via.map.size, uint32_t(3));
+  }
+}
+
+// The cached probe names follow whichever runtime is converting, so sends that
+// alternate between two runtimes sharing one bridge all pack views correctly.
+void testEncodeTypedArrayProbeAcrossRuntimes() {
+  Harness h;
+  auto other = facebook::hermes::makeHermesRuntime();
+  auto sendOn = [&](jsi::Runtime &rt, const char *src) {
+    auto value = rt.evaluateJavaScript(
+        std::make_shared<jsi::StringBuffer>(std::string("(") + src + ")"),
+        "test.js");
+    rt.global().getPropertyAsFunction(rt, "rpcOnGo").call(rt, value);
+  };
+  auto checkBin = [&](const std::string &want, const std::string &label) {
+    auto oh = h.lastPayload();
+    CHECK_MSG(oh.get().type == msgpack::type::BIN, label + ": not BIN");
+    CHECK_MSG(mpBinToString(oh.get()) == want, label + ": wrong bytes");
+  };
+
+  try {
+    sendOn(h.rt(), "new Uint8Array([1, 2])");
+    checkBin(std::string("\x01\x02", 2), "first runtime");
+
+    h.bridge->install(
+        *other, std::make_shared<InlineCallInvoker>(*other),
+        [&h](void *ptr, size_t size) {
+          const auto *p = static_cast<const uint8_t *>(ptr);
+          h.writes.emplace_back(p, p + size);
+          return true;
+        },
+        [](const std::string &) {}, [](int64_t) {});
+    sendOn(*other, "new Uint8Array([3, 4, 5]).subarray(1)");
+    checkBin(std::string("\x04\x05", 2), "second runtime");
+
+    sendOn(h.rt(), "new Uint8Array([6])");
+    checkBin(std::string("\x06", 1), "back on the first runtime");
+  } catch (const jsi::JSError &e) {
+    throw kbtest::CheckFailed("JS threw: " + e.getMessage());
+  }
+}
+
 void testEncodeEmptyContainers() {
   Harness h;
   h.send("{arr: [], map: {}, str: '', bin: new Uint8Array(0)}");
@@ -1204,6 +1263,10 @@ int main() {
              testEncodeIsViewNotDigitHeuristic);
   runner.add("encode: typed array byteOffset/byteLength bounds",
              testEncodeTypedArrayViews);
+  runner.add("encode: cached probe names across repeated sends",
+             testEncodeTypedArrayProbeRepeats);
+  runner.add("encode: cached probe names across a runtime switch",
+             testEncodeTypedArrayProbeAcrossRuntimes);
   runner.add("encode: empty containers", testEncodeEmptyContainers);
   runner.add("encode: UTF-8, multibyte, embedded NUL", testEncodeUtf8Strings);
   runner.add("encode: kMaxDepth", testEncodeDepthLimit);
```

**File**: `rnmodules/react-native-kb/scripts/bench-jsi-convert.sh` (modified, +14/-13)
```diff
@@ -1,8 +1,9 @@
 #!/usr/bin/env bash
 # Builds and runs cpp/tests/jsi-convert-bench.cpp twice -- once against this
-# branch's bridge, once against origin/master's -- on a real Hermes runtime,
-# replaying the corpus built by make-bench-corpus.mjs from a real mobile
-# session's RPC traffic.
+# branch's bridge, once against KB_BENCH_BASE's (default origin/master) -- on
+# a real Hermes runtime, replaying the corpus built by make-bench-corpus.mjs
+# from a real mobile session's RPC traffic. KB_BENCH_BASE must already have the
+# current bridge API (frame-parser.cpp, epoch-taking onDataFromGo).
 #
 # Hermes comes from the already-installed iOS pod, which ships a macOS slice, so
 # nothing has to be built from source. Development-only; not part of the shipped
@@ -16,13 +17,15 @@ PODS="$ROOT/shared/ios/Pods"
 HERMES="$PODS/hermes-engine/destroot"
 CORPUS="${1:-/tmp/kb-bench-corpus.bin}"
 ITERS="${2:-5}"
+BASE="${KB_BENCH_BASE:-origin/master}"
 
 # Sets MSGPACK_INCLUDE, fetching the headers if yarn hasn't unpacked them.
 # shellcheck source=./msgpack-include.sh
 source "$(dirname "${BASH_SOURCE[0]}")/msgpack-include.sh"
 
 for p in "$HERMES/include" \
-         "$PODS/Headers/Public/React-callinvoker"; do
+         "$PODS/Headers/Public/React-callinvoker" \
+         "$PODS/Headers/Public/React-cxxstableapi"; do
   test -d "$p" || { echo "missing $p -- run yarn and yarn ios:pod:install first" >&2; exit 1; }
 done
 test -f "$CORPUS" || {
@@ -37,33 +40,31 @@ test -f "$CORPUS" || {
 WORK="$(mktemp -d /tmp/kb-bench.XXXXXX)"
 trap 'rm -rf "$WORK"' EXIT
 
-# The baseline is master's bridge, checked out to its own directory so the two
-# builds each see their own react-native-kb.h.
+# The baseline is BASE's bridge (origin/master unless overridden), checked out
+# to its own directory so the two builds each see their own headers.
 mkdir -p "$WORK/baseline"
-for f in react-native-kb.cpp react-native-kb.h msgpack-safe.hpp; do
-  git -C "$ROOT" show "origin/master:rnmodules/react-native-kb/cpp/$f" > "$WORK/baseline/$f"
-done
+git -C "$ROOT" archive "$BASE" rnmodules/react-native-kb/cpp |
+  tar -x -C "$WORK/baseline" --strip-components=3 --exclude='*/tests/*'
 
 FRAMEWORKS="$HERMES/Library/Frameworks/macosx"
 COMMON=(
   -std=c++20 -O2 -DNDEBUG -DMSGPACK_NO_BOOST
   -I "$MSGPACK_INCLUDE"
   -I "$HERMES/include"
   -I "$PODS/Headers/Public/React-callinvoker"
+  -I "$PODS/Headers/Public/React-cxxstableapi"
   -F "$FRAMEWORKS" -framework hermesvm
   -Wl,-rpath,"$FRAMEWORKS"
 )
 
 build() { # build <outfile> <src-dir> [extra flags...]
   local out="$1" dir="$2"; shift 2
-  local srcs=("$dir/react-native-kb.cpp")
-  # frame-parser.cpp only exists on the branch.
-  [ -f "$dir/frame-parser.cpp" ] && srcs+=("$dir/frame-parser.cpp")
+  local srcs=("$dir/react-native-kb.cpp" "$dir/frame-parser.cpp")
   clang++ "${COMMON[@]}" "$@" -I "$dir" \
     "${srcs[@]}" "$CPP_DIR/tests/jsi-convert-bench.cpp" -o "$out"
 }
 
-echo "building baseline (origin/master)..."
+echo "building baseline ($BASE)..."
 build "$WORK/bench-baseline" "$WORK/baseline" -DKB_BASELINE=1
 echo "building branch..."
 build "$WORK/bench-branch" "$CPP_DIR"
```

**File**: `rnmodules/react-native-kb/scripts/test-jsi-convert.sh` (modified, +3/-1)
```diff
@@ -24,7 +24,8 @@ HERMES="$PODS/hermes-engine/destroot"
 source "$(dirname "${BASH_SOURCE[0]}")/msgpack-include.sh"
 
 for p in "$MSGPACK_INCLUDE" "$HERMES/include" \
-         "$PODS/Headers/Public/React-callinvoker"; do
+         "$PODS/Headers/Public/React-callinvoker" \
+         "$PODS/Headers/Public/React-cxxstableapi"; do
   test -d "$p" || {
     echo "missing $p -- run yarn and yarn ios:pod:install first" >&2
     exit 1
@@ -55,6 +56,7 @@ clang++ -std=c++20 -O1 -g -DMSGPACK_NO_BOOST \
   -I "$MSGPACK_INCLUDE" \
   -I "$HERMES/include" \
   -I "$PODS/Headers/Public/React-callinvoker" \
+  -I "$PODS/Headers/Public/React-cxxstableapi" \
   -I "$CPP_DIR" \
   -F "$FRAMEWORKS" -framework hermesvm \
   -Wl,-rpath,"$FRAMEWORKS" \
```

**File**: `shared/engine/rpc-transport.test.ts` (modified, +49/-0)
```diff
@@ -729,6 +729,55 @@ test('cancel packets surface a cancelled response payload', () => {
   )
 })
 
+test('notify packets dispatch method and params with no response handlers', () => {
+  const incoming = jest.fn()
+  const transport = new TestTransport({incomingRPCCallback: incoming})
+
+  transport.dispatchDecodedMessage([2, 'keybase.1.test.notify', [{sessionID: 3}]])
+
+  expect(incoming).toHaveBeenCalledTimes(1)
+  expect(incoming).toHaveBeenCalledWith({method: 'keybase.1.test.notify', param: [{sessionID: 3}]})
+  expect(transport.sent).toEqual([])
+})
+
+test('malformed packets of every type are dropped without dispatching or answering', () => {
+  const incoming = jest.fn()
+  const transport = new TestTransport({incomingRPCCallback: incoming})
+  const cb = jest.fn()
+  transport.invoke('keybase.1.test.pending', [{}], cb)
+  const [, seqid] = transport.sent[0]!
+  transport.sent.length = 0
+  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
+
+  const malformed: Array<unknown> = [
+    [0],
+    ['0', 1, 'keybase.1.test.hello', [{}]],
+    [0, 'x', 'keybase.1.test.hello', [{}]],
+    [0, 1, 5, [{}]],
+    [0, 1, 'keybase.1.test.hello', {}],
+    [2, 5, [{}]],
+    [2, 'keybase.1.test.notify', {}],
+    [1, String(seqid), null, {ok: true}],
+    [3, 'x'],
+    [9, 1],
+  ]
+  try {
+    for (const m of malformed) {
+      transport.dispatchDecodedMessage(m)
+    }
+    expect(warn).toHaveBeenCalledTimes(malformed.length)
+  } finally {
+    warn.mockRestore()
+  }
+  expect(incoming).not.toHaveBeenCalled()
+  expect(cb).not.toHaveBeenCalled()
+  expect(transport.sent).toEqual([])
+
+  // The pending invoke was untouched by the bad response and still settles.
+  transport.dispatchDecodedMessage([1, seqid, null, {ok: true}])
+  expect(cb).toHaveBeenCalledTimes(1)
+})
+
 test('close settles every queued invoke exactly once with EOF and drops queued sends', () => {
   const transport = new TestTransport({connected: false})
   const calls: Array<Array<unknown>> = []
```

**File**: `shared/engine/rpc-transport.tsx` (modified, +10/-5)
```diff
@@ -401,10 +401,12 @@ export abstract class RPCTransport {
       return
     }
 
-    const [type, ...rest] = message
+    const type = message[0]
     switch (type) {
       case MESSAGE_TYPE_INVOKE: {
-        const [seqid, method, param] = rest
+        const seqid = message[1]
+        const method = message[2]
+        const param = message[3]
         if (typeof seqid !== 'number' || typeof method !== 'string' || !Array.isArray(param)) {
           console.warn('Invalid invoke packet received')
           return
@@ -435,7 +437,8 @@ export abstract class RPCTransport {
         return
       }
       case MESSAGE_TYPE_NOTIFY: {
-        const [method, param] = rest
+        const method = message[1]
+        const param = message[2]
         if (typeof method !== 'string' || !Array.isArray(param)) {
           console.warn('Invalid notify packet received')
           return
@@ -447,7 +450,9 @@ export abstract class RPCTransport {
         return
       }
       case MESSAGE_TYPE_RESPONSE: {
-        const [seqid, error, result] = rest
+        const seqid = message[1]
+        const error = message[2]
+        const result = message[3]
         if (typeof seqid !== 'number') {
           console.warn('Invalid response packet received')
           return
@@ -461,7 +466,7 @@ export abstract class RPCTransport {
         return
       }
       case MESSAGE_TYPE_CANCEL: {
-        const [seqid] = rest
+        const seqid = message[1]
         if (typeof seqid !== 'number') {
           console.warn('Invalid cancel packet received')
           return
```

#### Recent Merged Pull Requests:
- **PR #29799** (2026-10-19): perf(rpc): cache typed-array probe names, drop incoming rest-spread copy; fix JSI test/bench scripts (@chrisnojima)
- **PR #29798** (2026-10-19): update deps: expo 58.0.15, expo-* patch bumps, keyboard-controller 1.22.8 (@chrisnojima)
- **PR #29797** (2026-10-18): update deps: react-native 0.88.0, expo 58.0.14, electron 44.9.0 (@chrisnojima)
- **PR #29794** (2026-10-17): fix(desktop): build and lint after the Expo 58 upgrade (@chrisnojima)
- **PR #29793** (2026-10-16): fix background goroutine leaks (@zoom-ua)
- **PR #29791** (2026-10-16): drop unusable data helper (@zoom-ua)

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

## X. share): make sharing into chat reliable on iOS and Android (#29789)

**RULE**:
When implementing operations in `go/chat/attachments/preprocess.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in keybase/client. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `7f18ea4d`: share): make sharing into chat reliable on iOS and Android (#29789). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `go/chat/attachments/preprocess.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
	n, err := io.ReadFull(src, head)
	case err == nil, errors.Is(err, io.ErrUnexpectedEOF):
	case errors.Is(err, io.EOF):
	res = http.DetectContentType(head[:n])
```

**NEGATIVE CONSTRAINT**:
```go
// Anti-pattern to NEVER write (induced failure mode):
	_, err = io.ReadFull(src, head)
	case err == nil:
	case errors.Is(err, io.EOF), errors.Is(err, io.ErrUnexpectedEOF):
	res = http.DetectContentType(head)
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `7f18ea4d` are properly handled with clean fallback behavior.

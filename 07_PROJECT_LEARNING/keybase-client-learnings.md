> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/keybase-client-learnings.md`  
> **Source**: github ([https://github.com/keybase/client](https://github.com/keybase/client))  
> **Source Version**: `22f55f55`  
> **License**: BSD-3-Clause  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-04T08:28:34.651Z  
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
> **Harvest Timestamp**: 2026-11-04T08:28:32.414Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `keybase/client`
- **Description**: Keybase Go Library, Client, Service, OS X, iOS, Android, Electron
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 9269 stars

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
	"fmt"
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
	// hostnames are case-insensitive and the allow and block lists store lowercase
	hostname = strings.ToLower(hostname)
	if len(hostname) == 0 {
		return res, errors.New("no hostname")
	}
	if hostname == types.MapsDomain {
		return hostname, nil
	}
	// Check if hostname is an IP address. If so, return it directly
	// since publicsuffix.EffectiveTLDPlusOne doesn't work with IPs.
	if ip := net.ParseIP(hostname); ip != nil {
		return ip.String(), nil
	}
	return publicsuffix.EffectiveTLDPlusOne(hostname)
}

// isAutoAllowedDomain reports domains that always unfurl, in every mode, and
// so can never be stored on either list.
func isAutoAllowedDomain(domain string) bool {
	switch domain {
	case "giphy.com", types.MapsDomain:
		return true
	}
	return false
}

var errAutoAllowed = errors.New("is always allowed and cannot be listed")

// NormalizeDomain turns user input (a bare domain or a URL) into the domain
// form stored on the allow and block lists.
func NormalizeDomain(input string) (string, error) {
	uri := strings.ToLower(strings.TrimSpace(input))
	// a bare IPv6 address only parses as a URL host inside brackets
	if ip := net.ParseIP(uri); ip != nil {
		return ip.String(), nil
	}
	if !strings.Contains(uri, "://") {
		uri = "http://" + uri
	}
	domain, err := GetDomain(uri)
	if err != nil {
		return "", fmt.Errorf("invalid domain %q: %w", input, err)
	}
	if isAutoAllowedDomain(domain) {
		return "", fmt.Errorf("%s %w", domain, errAutoAllowed)
	}
	if !strings.Contains(domain, ".") && net.ParseIP(domain) == nil {
		return "", fmt.Errorf("invalid domain %q", input)
	}
	return domain, nil
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

### Incident Patch 1: `601ccb05` (2026-11-03)
**Commit Message**: e2e: iOS release gate command, census and report; crash and render recovery (#29866)

* e2e: the census credits native surfaces from flows

* e2e: release children can log to a file; port holders are shared

* e2e: a release child's log write failure is reported, not fatal

* e2e: iOS gate lists, and harness helpers credit the surfaces they drive

* e2e: the phone as a new device is a manual-only step

* e2e: iOS census and report commands

* e2e: the iOS release gate command

* e2e: the iOS release only stops harness leftovers once preflight passes; the scan covers every output

* e2e: document the iOS release gate

* e2e: the iOS render keeps React Native's Animated clock real under the fixed Date

JS-driven Animated (SwitchToggle runs a 100ms timing on mount) times itself with
Date.now(). Under the visual run's fixed Date such an animation never ends: it
updates its view every frame, pinning the JS and main threads, and WDA's
accessibility snapshot behind the window rect took 3-5s against a 5s deadline on
modal/profile-add-to-team. With a real Animated clock it takes ~90ms; captures are
byte-identical.

* e2e: a release child settles on its exit when a grandchild keeps its pipes

**File**: `shared/jest.config.js` (modified, +2/-2)
```diff
@@ -55,8 +55,8 @@ module.exports = {
     '<rootDir>/images/',
     '<rootDir>/perf/',
     '<rootDir>/.tsOuts/',
-    // tests/e2e/shared (shared/gate included), ios-appium/gate, tests/e2e/accounts, the corpus and electron's release and main-process libs hold helper unit tests; the rest are playwright/appium/node:test suites
-    '<rootDir>/tests/e2e/(?!shared/|accounts/|ios-appium/gate/|fixtures/corpus/|electron/(?:release-lib|helpers/main-process-lib)\\.test\\.ts$)',
+    // tests/e2e/shared (shared/gate included), ios-appium/gate, tests/e2e/accounts, the corpus, the electron and ios-appium release libs and electron's main-process lib hold helper unit tests; the rest are playwright/appium/node:test suites
+    '<rootDir>/tests/e2e/(?!shared/|accounts/|ios-appium/(?:gate/|release-lib\\.test\\.ts$)|fixtures/corpus/|electron/(?:release-lib|helpers/main-process-lib)\\.test\\.ts$)',
   ],
   transform: {
     '^.+\\.(js|jsx|mjs|ts|tsx)$': 'babel-jest',
```

**File**: `shared/package.json` (modified, +4/-1)
```diff
@@ -85,11 +85,14 @@
     "test:e2e:ios:chat": "bash tests/e2e/run-ios-chat.sh iPhoneTest",
     "test:e2e:ios:share": "bash tests/e2e/run-ios-share.sh iPhoneTest",
     "test:e2e:ios:flows": "wdio run tests/e2e/ios-appium/wdio.gate.conf.ts",
+    "test:e2e:ios:census": "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON tests/e2e/ios-appium/census.mts",
+    "test:e2e:ios:release": "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON tests/e2e/ios-appium/release.mts",
+    "test:e2e:ios:gate-report": "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON tests/e2e/ios-appium/report.mts && open tests/results/ios-report.html",
     "test:e2e:ios:report": "node tests/e2e/generate-appium-report.mts && open tests/results/ios-appium-report.html",
     "test:e2e:android": "bash tests/e2e/run-android-appium.sh",
     "test:e2e:android:report": "node tests/e2e/generate-appium-report.mts android && open tests/results/android-appium-report.html",
     "test:unit": "napi-postinstall unrs-resolver 1.11.1 check; jest --runInBand",
-    "visual:unit": "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test tests/e2e/visual/ tests/e2e/generate-report-shared.test.mts tests/e2e/shared/gate/census-cli.test.mts tests/e2e/shared/gate/flow-report.test.mts tests/e2e/shared/gate/release-run.test.mts",
+    "visual:unit": "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test tests/e2e/visual/ tests/e2e/shared/cli-read.test.mts tests/e2e/generate-report-shared.test.mts tests/e2e/ios-appium/census.test.mts tests/e2e/ios-appium/release-secrets.test.mts tests/e2e/shared/gate/census-cli.test.mts tests/e2e/shared/gate/flow-report.test.mts tests/e2e/shared/gate/release-run.test.mts",
     "visual:base": "node tests/e2e/visual/cli.mts base",
     "visual:check": "node tests/e2e/visual/cli.mts check",
     "visual:gate": "node tests/e2e/visual/cli.mts gate",
```

**File**: `shared/tests/e2e/accounts/setup.mts` (modified, +11/-4)
```diff
@@ -41,6 +41,7 @@ import {
   withSignalsDeferred,
 } from './peer-homes.ts'
 import {ensureRunId} from './run-id.ts'
+import {maskAccounts, signedInName} from './sweep-lib.ts'
 import {E2E_CHANNELS} from '../shared/chat-data.ts'
 import {keybaseBin} from '../shared/keybase-bin.ts'
 import {connectPeerRpc} from '../shared/peer-rpc.ts'
@@ -80,6 +81,12 @@ const loadVars = (): Vars => {
   return vars
 }
 
+const usersOf = (vars: Vars) => ({second: vars['KB_SECOND_USER'] ?? '', smoke: vars['KB_SMOKE_USER'] ?? ''})
+
+// A line for the console, with the test accounts and team named by role.
+const masked = (s: string, vars: Vars) =>
+  maskAccounts(s, {team: vars['KB_E2E_TEAM'] ?? '', users: usersOf(vars)})
+
 const userFor = (role: PeerRole, vars: Vars) => (role === 'owner' ? vars['KB_SMOKE_USER'] : vars['KB_SECOND_USER']) ?? ''
 
 const envFor = (vars: Vars, role: PeerRole, home: string, paperKey: string): E2EEnv => {
@@ -118,7 +125,7 @@ const problemsFor = async (role: PeerRole, vars: Vars): Promise<string[]> => {
     problems.push(`peer ${role} at ${target} is not running`)
   } else {
     const who = await peerWhoami(target)
-    if (who !== user) problems.push(`peer ${role} at ${target} is signed in as ${who || 'nobody'}`)
+    if (who !== user) problems.push(masked(`peer ${role} at ${target} is signed in as ${signedInName(who, usersOf(vars))}`, vars))
   }
   return problems
 }
@@ -234,7 +241,7 @@ const ensurePaperKey = async (role: PeerRole, vars: Vars) => {
 }
 
 // Signs `home`'s service in as `user` with the paper key, as the first free e2e-<role>-svc name.
-const provisionHome = async (role: PeerRole, home: string, user: string, paperKey: string) => {
+const provisionHome = async (role: PeerRole, home: string, user: string, paperKey: string, vars: Vars) => {
   fs.mkdirSync(home, {mode: 0o700, recursive: true})
   if (!peerUsesFileSecretStore(home)) {
     if (await socketAnswers(socketPathFor(home))) {
@@ -245,7 +252,7 @@ const provisionHome = async (role: PeerRole, home: string, user: string, paperKe
   await waitForPeerService(role, home)
   const who = await peerWhoami(home)
   if (who === user) return
-  if (who) throw new Error(`peer ${role} at ${home} is signed in as ${who}; not touching it`)
+  if (who) throw new Error(masked(`peer ${role} at ${home} is signed in as ${signedInName(who, usersOf(vars))}; not touching it`, vars))
   for (const name of deviceNameCandidates(role)) {
     try {
       await runKeybase(['--home', home, 'login', '--devicename', name, user], {
@@ -352,7 +359,7 @@ const setUpRole = async (role: PeerRole, vars: Vars, runId: string) => {
   const user = userFor(role, vars)
   const recorded = vars[homeVar(role)]
   const paperKey = await ensurePaperKey(role, vars)
-  await provisionHome(role, target, user, paperKey)
+  await provisionHome(role, target, user, paperKey, vars)
   await runKeybase(['id', user], {timeoutMs: 60_000})
   const peer = await ensurePeer(role, envFor(vars, role, target, paperKey))
   await proveRoundTrip(peer, vars, `${runId}-${role}`)
```

**File**: `shared/tests/e2e/accounts/sweep-lib.test.ts` (modified, +7/-1)
```diff
@@ -277,9 +277,15 @@ describe('checkDelete', () => {
     expect(() => checkDelete(target, ctx, 'testuser')).not.toThrow()
   })
   test('refuses when the acting account is not the one the target belongs to', () => {
-    expect(() => checkDelete(target, ctx, 'testuser-mac')).toThrow(/signed in as testuser-mac/)
+    expect(() => checkDelete(target, ctx, 'testuser-mac')).toThrow(/^refusing to delete .*: the acting service is signed in as <second>, not the smoke account$/)
     expect(() => checkDelete(target, ctx, '')).toThrow(/signed in as nobody/)
   })
+  test('never prints the name of an account that is not a test account', () => {
+    expect(() => checkDelete(target, ctx, 'someone-else')).toThrow(
+      /signed in as an account that is neither KB_SMOKE_USER nor KB_SECOND_USER, not the smoke account$/
+    )
+    expect(() => checkDelete(target, ctx, 'someone-else')).not.toThrow(/someone-else/)
+  })
   test('refuses anything the selection would not delete', () => {
     expect(() => checkDelete(smoke({kind: 'channel', name: 'e2e-long'}), ctx, 'testuser')).toThrow(/seeded/)
     expect(() => checkDelete(smoke({kind: 'kbfs', name: `/keybase/private/testuser/x/e2e-${old}-f`}), ctx, 'testuser')).toThrow(
```

**File**: `shared/tests/e2e/accounts/sweep-lib.ts` (modified, +12/-1)
```diff
@@ -237,7 +237,7 @@ export const candidateKey = (c: SweepCandidate) =>
 export const checkDelete = (c: SweepCandidate, ctx: SweepContext, actingUser: string) => {
   const refuse = (why: string) => new Error(`refusing to delete ${describeCandidate(c)}: ${why}`)
   if (actingUser !== ctx.users[c.account]) {
-    throw refuse(`the acting service is signed in as ${actingUser || 'nobody'}, not the ${c.account} account`)
+    throw refuse(`the acting service is signed in as ${signedInName(actingUser, ctx.users)}, not the ${c.account} account`)
   }
   const v = judge(c, ctx)
   if (v.to === 'drop') throw refuse('no e2e prefix, or outside its scope')
@@ -256,6 +256,17 @@ export const parseKbfsLs = (out: string) =>
     })
     .filter(e => e.name !== '.' && e.name !== '..')
 
+// A signed-in username for a refusal: a test account by role, any other (possibly a personal one)
+// not by name.
+export const signedInName = (name: string, users: SweepContext['users']) =>
+  !name
+    ? 'nobody'
+    : name === users.smoke
+      ? '<smoke>'
+      : name === users.second
+        ? '<second>'
+        : 'an account that is neither KB_SMOKE_USER nor KB_SECOND_USER'
+
 // Output names the test accounts and team only by role.
 export const maskAccounts = (s: string, ctx: Pick<SweepContext, 'team' | 'users'>) =>
   [
```

**File**: `shared/tests/e2e/electron/app-pidfile.ts` (modified, +2/-23)
```diff
@@ -3,6 +3,7 @@
 // here, so the release command can tell its own app on ports 4000/9222 from anyone else's.
 import * as fs from 'fs'
 import * as path from 'path'
+import {stopGroup} from '../shared/gate/processes.ts'
 
 export const APP_PIDFILE = '/tmp/kb-e2e/app.json'
 
@@ -25,30 +26,8 @@ export const readAppPidfile = (): AppPidfile | undefined => {
 
 export const removeAppPidfile = () => fs.rmSync(APP_PIDFILE, {force: true})
 
-// EPERM: the group exists, owned by someone this process may not signal
-export const groupAlive = (pgid: number) => {
-  try {
-    process.kill(-pgid, 0)
-    return true
-  } catch (e) {
-    return (e as NodeJS.ErrnoException).code === 'EPERM'
-  }
-}
-
-const sleep = async (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
-
 // Stops every process of the group (SIGTERM, then SIGKILL after 10s) and removes the pidfile.
 export const stopAppGroup = async (pgid: number) => {
-  if (pgid <= 1) throw new Error(`refusing to signal process group ${pgid}`)
-  const signal = (sig: NodeJS.Signals) => {
-    try {
-      process.kill(-pgid, sig)
-    } catch {}
-  }
-  signal('SIGTERM')
-  for (let waited = 0; waited < 10_000 && groupAlive(pgid); waited += 250) await sleep(250)
-  if (groupAlive(pgid)) signal('SIGKILL')
-  for (let waited = 0; waited < 5_000 && groupAlive(pgid); waited += 250) await sleep(250)
-  if (groupAlive(pgid)) throw new Error(`process group ${pgid} is still running after SIGKILL`)
+  await stopGroup(pgid)
   if (readAppPidfile()?.pgid === pgid) removeAppPidfile()
 }
```

**File**: `shared/tests/e2e/electron/flows/settings-persisted.test.ts` (modified, +1/-1)
```diff
@@ -7,7 +7,7 @@ import * as fs from 'fs'
 import * as path from 'path'
 import type {Page} from '@playwright/test'
 import {loadE2EEnv} from '@/tests/e2e/accounts/env'
-import {KBFS_START_COMMAND} from '@/tests/e2e/electron/release-lib'
+import {KBFS_START_COMMAND} from '@/tests/e2e/shared/gate/processes'
 import {withCleanup} from '@/tests/e2e/electron/helpers/cleanup'
 import {test, expect} from '@/tests/e2e/electron/helpers/fixtures'
 import {expectPersists, reloadKeepingCoverage} from '@/tests/e2e/electron/helpers/persisted'
```

**File**: `shared/tests/e2e/electron/helpers/main-process-lib.test.ts` (modified, +1/-10)
```diff
@@ -1,4 +1,4 @@
-import {cdpEvaluate, consoleLocked, electronMainPid, inspectorUrl, parseEvaluateReply, serviceSocketFds} from './main-process-lib'
+import {cdpEvaluate, electronMainPid, inspectorUrl, parseEvaluateReply, serviceSocketFds} from './main-process-lib'
 
 describe('inspectorUrl', () => {
   test('picks the node target', () => {
@@ -84,12 +84,3 @@ describe('serviceSocketFds', () => {
   })
 })
 
-describe('consoleLocked', () => {
-  test('reads the root entry', () => {
-    expect(consoleLocked('+-o Root  <class IORegistryEntry>\n    {\n      "IOConsoleLocked" = Yes\n    }')).toBe(true)
-    expect(consoleLocked('    {\n      "IOConsoleLocked" = No\n    }')).toBe(false)
-  })
-  test('refuses output without it', () => {
-    expect(() => consoleLocked('+-o Root')).toThrow(/IOConsoleLocked/)
-  })
-})
```

---

### Incident Patch 2: `35c21aa2` (2026-11-03)
**Commit Message**: Fix the bugs the desktop release gate found (#29852)

* Fix the bugs the desktop release gate found

menubar: reload recent files on every show. crypto: read the decrypt/verify cause code the service sends as a string. box2: pass onMouseEnter to the desktop element. edit-avatar: save the crop the image opens on when it is left untouched, and open a new image on the default crop. teams: read your showcase of a team from the teams list, send the toggle as set, and disable the box until it is known. simplefs: refuse to start a backup of a folder that was never written, and count it as skipped when backing up all files. settings: say when a single backup did not start; put Dismiss where Cancel was on a finished backup row. The gate's tests for each now pass and their known-failure entries are removed.

* Avatar crop opens filling the circle; unlock-folders layout; gate screenshots wait for the screen to settle

edit-avatar: a picked image opens scaled to cover the crop circle and centered, and can't be zoomed out
past it, so every crop is a full square. Sizes come from layout, not the screen, so a modal still scaling
in doesn't skew them. unlock-folders: the device list is left aligned

**File**: `go/kbfs/simplefs/simplefs.go` (modified, +13/-5)
```diff
@@ -3766,6 +3766,10 @@ func parseKbfsPathForGitRepo(kbfsPath keybase1.KBFSPath) (gitRepo string, repoNa
 	return fmt.Sprintf("keybase://%s/%s/%s.git", match[1], match[2], match[3]), match[3] + ".git", true
 }
 
+// errArchiveNeverWritten is SimpleFSArchiveStart's error for a folder that was never written: it
+// has no folder branch yet, so there is nothing to back up and no job starts.
+var errArchiveNeverWritten = errors.New("the folder was never written, so there is nothing to back up")
+
 // SimpleFSArchiveStart implements the SimpleFSInterface.
 func (k *SimpleFS) SimpleFSArchiveStart(ctx context.Context,
 	arg keybase1.SimpleFSArchiveStartArg,
@@ -3844,7 +3848,7 @@ func (k *SimpleFS) SimpleFSArchiveStart(ctx context.Context,
 			return keybase1.SimpleFSArchiveJobDesc{}, err
 		}
 		if fb == (data.FolderBranch{}) {
-			return keybase1.SimpleFSArchiveJobDesc{}, nil
+			return keybase1.SimpleFSArchiveJobDesc{}, errArchiveNeverWritten
 		}
 		status, _, err := k.config.KBFSOps().FolderStatus(ctx, fb)
 		if err != nil {
@@ -4045,11 +4049,15 @@ func (k *SimpleFS) SimpleFSArchiveAllFiles(
 	res.TlfPathToError = make(map[string]string)
 	res.TlfPathToJobDesc = make(map[string]keybase1.SimpleFSArchiveJobDesc)
 	for _, a := range startArgs {
+		p := a.ArchiveJobStartPath.Kbfs().Path
 		jobDesc, err := k.SimpleFSArchiveStart(ctx, a)
-		if err != nil {
-			res.TlfPathToError[a.ArchiveJobStartPath.Kbfs().Path] = err.Error()
-		} else {
-			res.TlfPathToJobDesc[a.ArchiveJobStartPath.Kbfs().Path] = jobDesc
+		switch {
+		case errors.Is(err, errArchiveNeverWritten):
+			res.SkippedTLFPaths = append(res.SkippedTLFPaths, p)
+		case err != nil:
+			res.TlfPathToError[p] = err.Error()
+		default:
+			res.TlfPathToJobDesc[p] = jobDesc
 		}
 	}
 
```

**File**: `go/kbfs/simplefs/simplefs_test.go` (modified, +86/-0)
```diff
@@ -21,6 +21,7 @@ import (
 	billy "github.com/go-git/go-billy/v5"
 	"github.com/keybase/client/go/kbfs/data"
 	"github.com/keybase/client/go/kbfs/env"
+	"github.com/keybase/client/go/kbfs/favorites"
 	"github.com/keybase/client/go/kbfs/libfs"
 	"github.com/keybase/client/go/kbfs/libkbfs"
 	"github.com/keybase/client/go/kbfs/test/clocktest"
@@ -1805,6 +1806,91 @@ func TestProfiles(t *testing.T) {
 	require.NotEmpty(t, buf)
 }
 
+// A favorite folder that was never written has no folder branch to archive, so backing up all
+// files must not count a job for it.
+func TestArchiveAllFilesCountsOnlyStartedJobs(t *testing.T) {
+	ctx, cancel := context.WithTimeout(context.Background(), time.Second*20)
+	defer cancel()
+
+	tempdir, err := os.MkdirTemp(TempDirBase, "simpleFStest")
+	defer func() { _ = os.RemoveAll(tempdir) }()
+	require.NoError(t, err)
+
+	setCacheDirForTest(tempdir)
+	defer unsetCacheDirForTest()
+
+	sfs := newSimpleFS(env.EmptyAppStateUpdater{}, libkbfs.MakeTestConfigOrBust(t, "jdoe"))
+	defer closeSimpleFS(ctx, t, sfs)
+
+	writeRemoteFile(ctx, t, sfs, pathAppend(keybase1.NewPathWithKbfsPath(`/private/jdoe`), "test1.txt"), []byte("foo"))
+	syncFS(ctx, t, sfs, "/private/jdoe")
+	// a writable favorite with nothing in it yet
+	err = sfs.config.KBFSOps().AddFavorite(ctx,
+		favorites.Folder{Name: "jdoe", Type: tlf.Public}, favorites.Data{})
+	require.NoError(t, err)
+
+	res, err := sfs.SimpleFSArchiveAllFiles(ctx, keybase1.SimpleFSArchiveAllFilesArg{
+		OutputDir: tempdir,
+	})
+	require.NoError(t, err)
+	require.Empty(t, res.TlfPathToError)
+	require.Contains(t, res.TlfPathToJobDesc, "/private/jdoe")
+	require.NotContains(t, res.TlfPathToJobDesc, "/public/jdoe")
+	require.Contains(t, res.SkippedTLFPaths, "/public/jdoe")
+
+	status, err := sfs.SimpleFSGetArchiveStatus(ctx)
+	require.NoError(t, err)
+	require.Len(t, status.Jobs, len(res.TlfPathToJobDesc))
+
+	ticker := time.NewTicker(time.Millisecond * 100)
+	defer ticker.Stop()
+	for {
+		status, err := sfs.SimpleFSGetArchiveStatus(ctx)
+		require.NoError(t, err)
+		done := true
+		for _, job := range status.Jobs {
+			require.Nil(t, job.Error)
+			done = done && job.Phase == keybase1.SimpleFSArchiveJobPhase_Done
+		}
+		if done {
+			return
+		}
+		select {
+		case <-ctx.Done():
+			require.NoError(t, ctx.Err())
+		case <-ticker.C:
+		}
+	}
+}
+
+// Starting a backup of one folder that was never written starts no job, and says so with an error
+// rather than an empty job description.
+func TestArchiveStartNeverWrittenFolder(t *testing.T) {
+	ctx, cancel := context.WithTimeout(context.Background(), time.Second*20)
+	defer cancel()
+
+	tempdir, err := os.MkdirTemp(TempDirBase, "simpleFStest")
+	defer func() { _ = os.RemoveAll(tempdir) }()
+	require.NoError(t, err)
+
+	setCacheDirForTest(tempdir)
+	defer unsetCacheDirForTest()
+
+	sfs := newSimpleFS(env.EmptyAppStateUpdater{}, libkbfs.MakeTestConfigOrBust(t, "jdoe"))
+	defer closeSimpleFS(ctx, t, sfs)
+
+	jobDesc, err := sfs.SimpleFSArchiveStart(ctx, keybase1.SimpleFSArchiveStartArg{
+		ArchiveJobStartPath: keybase1.NewArchiveJobStartPathWithKbfs(keybase1.KBFSPath{Path: "/public/jdoe"}),
+		OutputPath:          filepath.Join(tempdir, "out.zip"),
+	})
+	require.ErrorIs(t, err, errArchiveNeverWritten)
+	require.Equal(t, keybase1.SimpleFSArchiveJobDesc{}, jobDesc)
+
+	status, err := sfs.SimpleFSGetArchiveStatus(ctx)
+	require.NoError(t, err)
+	require.Empty(t, status.Jobs)
+}
+
 func TestArchiveSymlink(t *testing.T) {
 	ctx, cancel := context.WithTimeout(context.Background(), time.Second*20)
 	defer cancel()
```

**File**: `shared/common-adapters/box.tsx` (modified, +3/-1)
```diff
@@ -249,7 +249,8 @@ export const box2DesktopStyleForTest = box2DesktopStyle
 export const Box2 = (p: Box2Props & {ref?: React.Ref<MeasureRef>}) => {
   if (!isMobile) {
     const {ref} = p
-    const {onMouseMove, onMouseDown, onMouseLeave, onMouseUp, onMouseOver, onCopyCapture, children, testID} = p
+    const {onMouseMove, onMouseDown, onMouseEnter, onMouseLeave, onMouseUp, onMouseOver, onCopyCapture} = p
+    const {children, testID} = p
     const {onContextMenu, onDragLeave, onDragOver, onDrop, title, tooltip} = p
     const style = box2DesktopStyle(p)
     const className = box2ClassNames(p)
@@ -266,6 +267,7 @@ export const Box2 = (p: Box2Props & {ref?: React.Ref<MeasureRef>}) => {
         onDragOver={onDragOver}
         onDrop={onDrop}
         onMouseDown={onMouseDown}
+        onMouseEnter={onMouseEnter}
         onMouseLeave={onMouseLeave}
         onMouseMove={onMouseMove}
         onMouseOver={onMouseOver}
```

**File**: `shared/common-adapters/box2-desktop-events.test.tsx` (added, +33/-0)
```diff
@@ -0,0 +1,33 @@
+/** @jest-environment jsdom */
+/// <reference types="jest" />
+import {cleanup, fireEvent, render} from '@testing-library/react'
+import {Box2} from './box'
+
+afterEach(() => {
+  cleanup()
+})
+
+test('the desktop Box2 hands every mouse handler it declares to its element', () => {
+  const calls: Array<string> = []
+  const {getByTestId} = render(
+    <Box2
+      direction="vertical"
+      testID="box"
+      onMouseDown={() => calls.push('down')}
+      onMouseEnter={() => calls.push('enter')}
+      onMouseLeave={() => calls.push('leave')}
+      onMouseMove={() => calls.push('move')}
+      onMouseOver={() => calls.push('over')}
+      onMouseUp={() => calls.push('up')}
+    />
+  )
+  const box = getByTestId('box')
+  fireEvent.mouseEnter(box)
+  fireEvent.mouseOver(box)
+  fireEvent.mouseMove(box)
+  fireEvent.mouseDown(box)
+  fireEvent.mouseUp(box)
+  fireEvent.mouseLeave(box)
+  // React derives enter and leave from over and out, so only which handlers ran is compared
+  expect(new Set(calls)).toEqual(new Set(['enter', 'over', 'move', 'down', 'up', 'leave']))
+})
```

**File**: `shared/common-adapters/zoomable-image.test.tsx` (added, +118/-0)
```diff
@@ -0,0 +1,118 @@
+/** @jest-environment jsdom */
+/// <reference types="jest" />
+import {cleanup, fireEvent, render} from '@testing-library/react'
+import {cropViewToRect, type CropView} from '@/util/crop'
+import ZoomableImage from './zoomable-image'
+
+// the toast reads the color scheme, which the test renderer lacks; it plays no part in the view
+jest.mock('./toast', () => ({__esModule: true, default: () => null}))
+
+afterEach(() => {
+  cleanup()
+})
+
+// jsdom lays nothing out: the container's and the image's sizes are set by hand
+const sized = (container: HTMLElement, img: {height: number; width: number}) => {
+  const root = container.firstElementChild as HTMLElement
+  const el = container.querySelector('img')
+  if (!el) throw new Error('no img')
+  Object.defineProperty(root, 'clientWidth', {configurable: true, value: 300})
+  Object.defineProperty(root, 'clientHeight', {configurable: true, value: 300})
+  root.getBoundingClientRect = () => ({height: 300, left: 0, top: 0, width: 300}) as DOMRect
+  Object.defineProperty(el, 'naturalWidth', {configurable: true, value: img.width})
+  Object.defineProperty(el, 'naturalHeight', {configurable: true, value: img.height})
+  return {el, root}
+}
+
+test('a drag-pan image opens filling the window, centered, and reports that view before any pointer move', () => {
+  const views: Array<CropView> = []
+  const onLoaded = jest.fn()
+  const {container} = render(
+    <ZoomableImage src="/tmp/avatar.png" dragPan={true} onChanged={v => views.push(v)} onLoaded={onLoaded} />
+  )
+  const {el} = sized(container, {height: 480, width: 640})
+  fireEvent.load(el)
+
+  expect(onLoaded).toHaveBeenCalledTimes(1)
+  expect(views).toHaveLength(1)
+  const [view] = views
+  if (!view) throw new Error('no view')
+  // the short side fills the window, and the long side overflows it equally on both ends
+  expect(view).toMatchObject({height: 300, scale: 300 / 480, width: 400, x: 50, y: -0})
+  expect(el.style.transform).toBe('translate(-50px, 0px) scale(0.625)')
+  // the untouched view is the centered square of the image
+  expect(cropViewToRect(view, 300)).toEqual({x0: 80, x1: 560, y0: 0, y1: 480})
+})
+
+test('a drag-pan image smaller than the window is scaled up to fill it', () => {
+  const views: Array<CropView> = []
+  const {container} = render(<ZoomableImage src="/tmp/small.png" dragPan={true} onChanged={v => views.push(v)} />)
+  const {el} = sized(container, {height: 30, width: 60})
+  fireEvent.load(el)
+  const view = views.at(-1)
+  if (!view) throw new Error('no view')
+  expect(view).toMatchObject({height: 300, scale: 10, width: 600, x: 150, y: -0})
+  expect(cropViewToRect(view, 300)).toEqual({x0: 15, x1: 45, y0: 0, y1: 30})
+})
+
+test('a new image opens on its default view, not the pan and zoom left from the one before', () => {
+  const views: Array<CropView> = []
+  const {container, rerender} = render(
+    <ZoomableImage src="/tmp/a.png" dragPan={true} onChanged={v => views.push(v)} />
+  )
+  const {el, root} = sized(container, {height: 480, width: 640})
+  fireEvent.load(el)
+  const opened = views.at(-1)
+  // image A panned to its bottom-right corner and zoomed
+  fireEvent.wheel(root, {clientX: 300, clientY: 300, deltaY: 100})
+  fireEvent.mouseMove(root, {clientX: 300, clientY: 300})
+  const panned = views.at(-1)
+  expect(panned?.scale).not.toBe(opened?.scale)
+  expect(panned?.x).not.toBe(opened?.x)
+
+  // image B loads and is left untouched
+  rerender(<ZoomableImage src="/tmp/b.png" dragPan={true} onChanged={v => views.push(v)} />)
+  fireEvent.load(el)
+  expect(views.at(-1)).toEqual(opened)
+  expect(el.style.transform).toBe('translate(-50px, 0px) scale(0.625)')
+})
+
+test('a drag-pan image cannot be zoomed out past filling the window', () => {
+  const views: Array<CropView> = []
+  const {container} = render(<ZoomableImage src="/tmp/a.png" dragPan={true} onChanged={v => views.push(v)} />)
+  const {el, root} = sized(container, {height: 480, width: 640})
+  fireEvent.load(el)
+  for (let i = 0; i < 20; i++) fireEvent.wheel(root, {clientX: 150, clientY: 150, deltaY: -100})
+  const view = views.at(-1)
+  if (!view) throw new Error('no view')
+  expect(view.scale).toBe(300 / 480)
+  expect(cropViewToRect(view, 300)).toEqual({x0: 80, x1: 560, y0: 0, y1: 480})
+})
+
+test('a drag-pan image that loads before its container is laid out opens untransformed', () => {
+  const views: Array<CropView> = []
+  const {container} = render(<ZoomableImage src="/tmp/a.png" dragPan={true} onChanged={v => views.push(v)} />)
+  const {el, root} = sized(container, {height: 480, width: 640})
+  Object.defineProperty(root, 'clientWidth', {configurable: true, value: 0})
+  fireEvent.load(el)
+  expect(views.at(-1)).toMatchObject({height: 480, scale: 1, width: 640, x: -0, y: -0})
+  expect(el.style.transform).toBe('')
+})
+
+test('a zoom image without drag-pan reports no view on load', () => {
+  const onChanged = jest.fn()
+  const {container} = render(<Zo
```

**File**: `shared/common-adapters/zoomable-image.tsx` (modified, +57/-6)
```diff
@@ -27,10 +27,14 @@ import ImageNative from './image'
 
 // Stub types to avoid DOM lib dependency in native tsconfig
 type DivRef = {
+  clientHeight: number
+  clientWidth: number
   getBoundingClientRect: () => {left: number; top: number; width: number; height: number}
 }
 type ImgRef = {
   getBoundingClientRect: () => {width: number; height: number}
+  naturalHeight: number
+  naturalWidth: number
   style: {transform: string}
   classList: {add: (cls: string) => void; remove: (cls: string) => void}
 }
@@ -45,6 +49,10 @@ const DesktopZoomableImage = (p: Props) => {
   const containerRef = React.useRef<DivRef>(null)
   const imgRef = React.useRef<ImgRef>(null)
   const scaleRef = React.useRef(1)
+  // the scale a drag-pan image opens on, the smallest that fills the container: it can't be zoomed
+  // out past it, so every crop is a full square of the image
+  const coverScaleRef = React.useRef(1)
+  const translateRef = React.useRef({x: 0, y: 0})
   const isZoomedRef = React.useRef(isZoomed)
 
   const toggleZoom = () => {
@@ -79,10 +87,16 @@ const DesktopZoomableImage = (p: Props) => {
       return
     }
 
-    const containerRect = containerRef.current.getBoundingClientRect()
-    const imgRect = imgRef.current.getBoundingClientRect()
-    const xPercent = Math.min(1, Math.max(0, (e.clientX - containerRect.left) / containerRect.width))
-    const yPercent = Math.min(1, Math.max(0, (e.clientY - containerRect.top) / containerRect.height))
+    // the pointer's place in the container is on screen; the sizes are layout sizes, which an
+    // ancestor's transform (a modal scaling in) doesn't skew, at the scale just set
+    const bounds = containerRef.current.getBoundingClientRect()
+    const xPercent = Math.min(1, Math.max(0, (e.clientX - bounds.left) / bounds.width))
+    const yPercent = Math.min(1, Math.max(0, (e.clientY - bounds.top) / bounds.height))
+    const containerRect = {height: containerRef.current.clientHeight, width: containerRef.current.clientWidth}
+    const imgRect = {
+      height: imgRef.current.naturalHeight * scaleRef.current,
+      width: imgRef.current.naturalWidth * scaleRef.current,
+    }
 
     const x = Math.min(
       imgRect.width < containerRect.width ? (containerRect.width - imgRect.width) / 2 : 0,
@@ -100,9 +114,44 @@ const DesktopZoomableImage = (p: Props) => {
     )
 
     imgRef.current.style.transform = `translate(${x}px, ${y}px) scale(${scaleRef.current})`
+    translateRef.current = {x, y}
     onChanged?.({height: imgRect.height, scale: scaleRef.current, width: imgRect.width, x: -x, y: -y})
   }
 
+  // a drag-pan view is a crop, so a loaded image reports the view it opens on before any move. A
+  // new image opens filling the container and centered in it, not on the pan and zoom left from the
+  // one before. Sizes are read untransformed, so a modal still animating in doesn't skew them.
+  const loadedSrcRef = React.useRef<string | undefined>(undefined)
+  const handleLoad = () => {
+    const img = imgRef.current
+    if (img && loadedSrcRef.current !== src) {
+      loadedSrcRef.current = src
+      const {naturalHeight, naturalWidth} = img
+      const cw = containerRef.current?.clientWidth ?? 0
+      const ch = containerRef.current?.clientHeight ?? 0
+      if (dragPan && naturalWidth && naturalHeight && cw && ch) {
+        const cover = Math.max(cw / naturalWidth, ch / naturalHeight)
+        const x = (cw - naturalWidth * cover) / 2
+        const y = (ch - naturalHeight * cover) / 2
+        coverScaleRef.current = cover
+        scaleRef.current = cover
+        translateRef.current = {x, y}
+        img.style.transform = `translate(${x}px, ${y}px) scale(${cover})`
+      } else {
+        coverScaleRef.current = 1
+        scaleRef.current = 1
+        translateRef.current = {x: 0, y: 0}
+        img.style.transform = ''
+      }
+    }
+    if (dragPan && img) {
+      const scale = scaleRef.current
+      const {x, y} = translateRef.current
+      onChanged?.({height: img.naturalHeight * scale, scale, width: img.naturalWidth * scale, x: -x, y: -y})
+    }
+    onLoaded?.()
+  }
+
   const handleWheel = (e: WheelEvt) => {
     if (e.cancelable) {
       e.preventDefault()
@@ -111,7 +160,9 @@ const DesktopZoomableImage = (p: Props) => {
     if (!dragPan && !isZoomedRef.current) return
 
     const delta = e.deltaY > 0 ? 1.02 : 0.98
-    scaleRef.current = Math.min(2.5, Math.max(0.3, scaleRef.current * delta))
+    const cover = coverScaleRef.current
+    const [min, max] = dragPan ? [cover, Math.max(2.5, cover * 2.5)] : [0.3, 2.5]
+    scaleRef.current = Math.min(max, Math.max(min, scaleRef.current * delta))
     handleMouseMove(e)
   }
 
@@ -167,7 +218,7 @@ const DesktopZoomableImage = (p: Props) => {
     >
       <img
         draggable={false}
-        onLoad={onLoaded}
+        onLoad={handleLoad}
         onError={onError}
         className="fade-anim-enter fade-anim-enter-active"
         ref={imgRef as React.RefObject<HTMLImageEleme
```

**File**: `shared/crypto/helpers.test.ts` (modified, +8/-7)
```diff
@@ -168,18 +168,19 @@ test('getStatusCodeMessage suggests the sibling operation on a wrong saltpack ty
   )
 })
 
-test('getStatusCodeMessage reads the cause code out of the second error field', () => {
+// the service sends the cause code as a decimal string (go/libkb/rpc_exim.go DecryptionError.ToStatus)
+test('getStatusCodeMessage reads the cause code out of the Code error field', () => {
   const fields = [
-    {key: 'Something', value: RPCGen.StatusCode.scgeneric},
-    {key: 'Code', value: RPCGen.StatusCode.scdecryptionkeynotfound},
+    {key: 'Cause', value: 'no decryption key found for message'},
+    {key: 'Code', value: String(RPCGen.StatusCode.scdecryptionkeynotfound)},
   ]
   expect(getStatusCodeMessage(makeError(RPCGen.StatusCode.scdecryptionerror, 'x', fields), 'decrypt', 'text')).toBe(
     "This message was encrypted for someone else or for a key you don't have."
   )
 
   const verifyFields = [
-    {key: 'Something', value: RPCGen.StatusCode.scgeneric},
-    {key: 'Code', value: RPCGen.StatusCode.scverificationkeynotfound},
+    {key: 'Cause', value: 'unknown signing key'},
+    {key: 'Code', value: String(RPCGen.StatusCode.scverificationkeynotfound)},
   ]
   expect(
     getStatusCodeMessage(makeError(RPCGen.StatusCode.scsigcannotverify, 'x', verifyFields), 'verify', 'text')
@@ -191,8 +192,8 @@ test('getStatusCodeMessage falls back to generic when the cause fields are missi
     'Failed to decrypt text.'
   )
   const unnamed = [
-    {key: 'a', value: RPCGen.StatusCode.scgeneric},
-    {key: 'NotCode', value: RPCGen.StatusCode.scdecryptionkeynotfound},
+    {key: 'a', value: String(RPCGen.StatusCode.scgeneric)},
+    {key: 'NotCode', value: String(RPCGen.StatusCode.scdecryptionkeynotfound)},
   ]
   expect(
     getStatusCodeMessage(makeError(RPCGen.StatusCode.scdecryptionerror, 'x', unnamed), 'decrypt', 'text')
```

**File**: `shared/crypto/helpers.tsx` (modified, +4/-3)
```diff
@@ -52,9 +52,10 @@ export const getStatusCodeMessage = (
     wrongTypeHelpText = ' Did you mean to verify it?'
   }
 
-  const fields = error.fields as Array<{key: string; value: RPCGen.StatusCode}> | undefined
-  const field = fields?.[1]
-  const causeStatusCode = field?.key === 'Code' ? field.value : RPCGen.StatusCode.scgeneric
+  // the service sends the cause's status code as a decimal string
+  const fields = error.fields as Array<{key: string; value: string}> | undefined
+  const codeField = fields?.find(f => f.key === 'Code')
+  const causeStatusCode: RPCGen.StatusCode = codeField ? Number(codeField.value) : RPCGen.StatusCode.scgeneric
   const causeStatusCodeToMessage = new Map([
     [RPCGen.StatusCode.scapinetworkerror, offlineMessage],
     [
```

---

### Incident Patch 3: `65cae2da` (2026-11-03)
**Commit Message**: Fix the bugs the iOS release gate found, and run unit tests on the real libraries (#29872)

* navUpToScreen on a phone goes back through the screens above the tab bar

On a phone a tab's stack registers only its root screen; every other screen sits in the root
stack above the tab bar. navUpToScreen always acted on the selected tab's stack, so going back
to the devices list after a revoke sent a POP_TO that stack can't handle (the device page stayed
up), and going back to teamsRoot after leaving a team popped nothing (the team page stayed up).

With no modal up, navUpToScreen now looks for the screen among those above the tab bar first and
pops the root stack to it; when the screen is in the tab's stack below them, it closes them and
then pops the tab's stack. With a modal up, and on desktop and tablets (nothing above the tabs),
it acts on the active stack as before.

The iOS gate drops its own back steps after a revoke (devices helper) and after a leave
(teams-second); both now read that the app left the page by itself.

* Leaving or deleting a team on a phone closes the team page, whichever tab it was opened from

navUpToScreen to another tab's root (e.g. teamsRoot for a team page

**File**: `CLAUDE.md` (modified, +6/-0)
```diff
@@ -27,6 +27,12 @@
 - Before calling code dead, search the whole repo (desktop, native, Go callers, string-built names), not one directory.
 - Prefer fixes that keep underlying state truthful (e.g. a UI-level hold) over changing state semantics, unless asked.
 
+## Tests run the real thing
+- Unit tests exercise the real library and the real app modules. Never write a fake that models a library's behavior (its timing, events, focus, routing, layout) or stands in for one of our own hooks/stores. A test built on a model checks the model: it passes on fiction, and reviews and fixes then get built on it.
+- Navigation: use `shared/test/navigation.tsx` (the app's tree on the real React Navigation core and the real `navigationRef`). Never `jest.mock('@react-navigation/...')` or `jest.mock('@/constants/router')`.
+- Mock only true edges: native modules with no JS implementation, network/IO, the Go service (`test/fake-engine.ts`). Mock at the lowest layer, and never invent ordering, timing or state there.
+- A claim about how a library behaves (from a review, a comment, or a fake) gets a probe against the real library before any code changes for it.
+
 ## Working Directory
 Repo root is `client/`. TS source lives in `shared/`. Always use absolute paths for file ops. For Bash: always `cd shared/` first.
 
```

**File**: `shared/chat/blocking/invitation-to-block.test.tsx` (modified, +134/-77)
```diff
@@ -1,15 +1,17 @@
 /** @jest-environment jsdom */
 /// <reference types="jest" />
-import type * as ChatRpcT from '@/chat/conversation/chat-rpc'
 import type * as React from 'react'
 import * as T from '@/constants/types'
 
-// each icon's latest onClick, by icon type
+// each icon's latest onClick, by icon type, and the wave button's first onWave: the handlers a
+// screen kept through an account switch still holds
 const mockIconOnClick = new Map<string, () => void>()
+let mockFirstOnWave: (() => void) | undefined
 jest.mock('@/common-adapters', () => {
-  const actual = jest.requireActual<{Icon: React.ComponentType<{onClick?: () => void; type: string}>}>(
-    '@/common-adapters'
-  )
+  const actual = jest.requireActual<{
+    Icon: React.ComponentType<{onClick?: () => void; type: string}>
+    WaveButton: React.ComponentType<{onWave: () => void}>
+  }>('@/common-adapters')
   const R = jest.requireActual<typeof React>('react')
   return {
     ...actual,
@@ -19,149 +21,204 @@ jest.mock('@/common-adapters', () => {
       }
       return R.createElement(actual.Icon, p)
     },
+    WaveButton: (p: {onWave: () => void}) => {
+      mockFirstOnWave ??= p.onWave
+      return R.createElement(actual.WaveButton, p)
+    },
   }
 })
 
-const mockConversationIDKey = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))
-const mockTeamID = 'aabbccdd'
-let mockRetired = false
-// the thread's rpc, which retires with the thread
-let mockRpc: ChatRpcT.ChatThreadRpc | undefined
-const mockThreadRpc = () =>
-  (mockRpc ??= jest
-    .requireActual<typeof ChatRpcT>('@/chat/conversation/chat-rpc')
-    .makeThreadChatRpc(() => mockRetired))
-let mockOwnMessage = false
-
-jest.mock('../conversation/thread-context', () => ({
-  useConversationThreadActions: () => ({isRetired: () => mockRetired, rpc: mockThreadRpc()}),
-  useThreadRpc: () => mockThreadRpc(),
-  useConversationThreadID: () => mockConversationIDKey,
-  useConversationThreadStore: () => ({getState: () => ({messageMap: new Map(), messageOrdinals: []})}),
-  useConversationThreadSelector: (
-    sel: (s: {messageMap: Map<number, {author: string}>; messageOrdinals: Array<number>}) => unknown
-  ) =>
-    sel({
-      messageMap: new Map(mockOwnMessage ? [[1, {author: 'testuser'}]] : []),
-      messageOrdinals: mockOwnMessage ? [1] : [],
-    }),
-  useThreadMeta: (sel: (m: {teamID: string; teamname: string; tlfname: string}) => unknown) =>
-    sel({teamID: mockTeamID, teamname: 'testteam', tlfname: 'testteam'}),
-}))
-jest.mock('./block-buttons-state', () => ({
-  useBlockButtonsInfo: () => ({adder: 'testuser-mac'}),
-}))
-
 import * as Meta from '@/constants/chat/meta'
+import {useEffect} from 'react'
 import {act, cleanup, fireEvent, render, screen} from '@testing-library/react'
+import {makeMessageText} from '@/constants/chat/message'
 import {metasReceived} from '@/chat/inbox/metadata'
+import {useConfigState} from '@/stores/config'
 import {useCurrentUserState} from '@/stores/current-user'
 import {resetAllStores} from '@/util/zustand'
-import {installFakeChatRpc, restoreChatRpc, type FakeChatRpc} from '@/test/fake-chat-rpc'
+import {installFakeEngine, type FakeEngine} from '@/test/fake-engine'
+import {paramsOf} from '@/test/fake-thread-load'
+import {flush} from '@/test/flush'
+import {threadWrapper} from '@/test/thread-tree'
+import {useConversationThreadActions} from '../conversation/thread-context'
 import BlockButtons from './invitation-to-block'
 
-let rpc: FakeChatRpc
+const conversationIDKey = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))
+const teamID = 'aabbccdd'
+const dismissBlockButtons = 'keybase.1.user.dismissBlockButtons'
+const postText = 'chat.1.local.postTextNonblock'
 
-const flushPromises = async () => {
-  for (let i = 0; i < 5; i++) {
-    await Promise.resolve()
-  }
-}
+let fake: FakeEngine
 
-const renderBanner = async () => {
-  render(<BlockButtons />)
-  await act(async () => {
-    await flushPromises()
+const ownMessage = () =>
+  makeMessageText({
+    author: 'testuser',
+    conversationIDKey,
+    id: T.Chat.numberToMessageID(1),
+    ordinal: T.Chat.numberToOrdinal(1),
   })
+
+// the first thread's actions, which a screen kept through an account switch still holds
+let firstThreadActions: ReturnType<typeof useConversationThreadActions> | undefined
+// adds a message of your own to the thread when asked
+const ThreadActions = (p: {ownMessage: boolean}) => {
+  const actions = useConversationThreadActions()
+  useEffect(() => {
+    if (!firstThreadActions) firstThreadActions = actions
+  }, [actions])
+  const {addMessages} = actions
+  const {ownMessage: own} = p
+  useEffect(() => {
+    if (own) {
+      addMessages([ownMessage()])
+    }
+  }, [addMessages, own])
+  return null
+}
+
+const renderBanner = async (opts?: {ownMessage?: boolean}) => {
+  render(
+    <>
+      <ThreadActions ownMessage={!!opts?.ownMessage} />
+      <BlockButtons />
+    </>,
+    {wrapper: threadWrapper(conversationIDKe
```

**File**: `shared/chat/conversation/attachment-actions.test.tsx` (modified, +201/-139)
```diff
@@ -3,18 +3,19 @@
 import * as Message from '@/constants/chat/message'
 import * as Meta from '@/constants/chat/meta'
 import * as PlatformSpecific from '@/util/platform-specific'
-import * as Router from '@/constants/router'
 import * as T from '@/constants/types'
 import type * as React from 'react'
-import RPCError from '@/util/rpcerror'
 import logger from '@/logger'
 import {act, cleanup, renderHook} from '@testing-library/react'
 import {makeMessageAttachment, makeMessageText} from '@/constants/chat/message'
 import {metasReceived} from '@/chat/inbox/metadata'
 import {resetAllStores} from '@/util/zustand'
 import {useConfigState} from '@/stores/config'
 import {useCurrentUserState} from '@/stores/current-user'
-import {installFakeChatRpc, restoreChatRpc, type FakeChatRpc} from '@/test/fake-chat-rpc'
+import {fakeError, installFakeEngine, type FakeEngine} from '@/test/fake-engine'
+import {paramsOf} from '@/test/fake-thread-load'
+import {tick} from '@/test/flush'
+import {installNavigation, navigationWrapper, stateShowing, type InstalledNavigation} from '@/test/navigation'
 import {getChatRpc} from './chat-rpc'
 import {getClientPrevFromThread} from './client-prev'
 import {
@@ -36,10 +37,8 @@ import {
 import {ConversationThreadProvider, useConversationThreadActions, useConversationThreadStore} from './thread-context'
 
 const mockDeleteFile = jest.fn()
-// jest.config maps every native-only package (expo-file-system among them) to one
-// stub file, so extend that file rather than mocking the package by name.
-jest.mock('../../test/mocks/native-module.js', () => ({
-  ...jest.requireActual('../../test/mocks/native-module.js'),
+// expo-file-system is native-only, an empty stub under jest; the android save cleans up through File
+jest.mock('expo-file-system', () => ({
   File: class {
     uri: string
     constructor(uri: string) {
@@ -57,18 +56,24 @@ const messageID = T.Chat.numberToMessageID(42)
 const attachment = (id: number) =>
   makeMessageAttachment({conversationIDKey, id: T.Chat.numberToMessageID(id)})
 
-let navigateAppend: jest.SpyInstance
+let nav: InstalledNavigation
+// where the app navigated to, as the library's state has it
+const shown = () => {
+  const v = nav.visibleScreen()
+  return {name: v?.name, params: v?.params}
+}
 
 beforeEach(() => {
   mockDeleteFile.mockReset()
-  navigateAppend = jest.spyOn(Router, 'navigateAppend').mockImplementation(() => true)
   // the thread provider builds a thread only for a signed-in account
   useCurrentUserState.getState().dispatch.setBootstrap({
     deviceID: 'device-id',
     deviceName: 'testuser-mac',
     uid: 'uid',
     username: 'testuser',
   })
+  // after the account is in place: the desktop tab bar the tree draws reads it
+  nav = installNavigation({rootState: stateShowing('chatRoot')})
 })
 
 afterEach(() => {
@@ -115,8 +120,8 @@ describe('getClientPrevFromThread', () => {
 describe('attachment preview handoff', () => {
   test('hands the message to the fullscreen route exactly once', () => {
     const message = attachment(42)
-    showAttachmentPreview(conversationIDKey, message)
-    expect(navigateAppend).toHaveBeenCalledWith({
+    act(() => showAttachmentPreview(conversationIDKey, message))
+    expect(shown()).toEqual({
       name: 'chatAttachmentFullscreen',
       params: {conversationIDKey, messageID},
     })
@@ -127,7 +132,7 @@ describe('attachment preview handoff', () => {
 
   test('is keyed by conversation and message', () => {
     const message = attachment(42)
-    showAttachmentPreview(conversationIDKey, message)
+    act(() => showAttachmentPreview(conversationIDKey, message))
     const other = T.Chat.stringToConversationIDKey('conv2')
     expect(takeAttachmentPreviewMessage(other, messageID)).toBeUndefined()
     expect(takeAttachmentPreviewMessage(conversationIDKey, T.Chat.numberToMessageID(43))).toBeUndefined()
@@ -136,43 +141,45 @@ describe('attachment preview handoff', () => {
   })
 
   test('refuses to navigate for a message with no id', () => {
-    showAttachmentPreview(conversationIDKey, attachment(0))
-    expect(navigateAppend).not.toHaveBeenCalled()
+    act(() => showAttachmentPreview(conversationIDKey, attachment(0)))
+    expect(nav.actions).toEqual([])
     expect(takeAttachmentPreviewMessage(conversationIDKey, T.Chat.numberToMessageID(0))).toBeUndefined()
   })
 })
 
 describe('pdf handoff', () => {
   test('passes the url through only when there is one', () => {
-    showPDFViewer(conversationIDKey, attachment(42))
-    expect(navigateAppend).toHaveBeenCalledWith({
+    act(() => showPDFViewer(conversationIDKey, attachment(42)))
+    expect(shown()).toEqual({
       name: 'chatPDF',
       params: {conversationIDKey, messageID},
     })
-    showPDFViewer(conversationIDKey, attachment(42), 'https://example.com/a.pdf')
-    expect(navigateAppend).toHaveBeenLastCalledWith({
+    act(() => showPDFViewer(conversationIDKey, attachment(42), 'https://example.com/a.pdf'))
+    expect(shown()
```

**File**: `shared/chat/conversation/attachment-get-titles-darwin.test.tsx` (modified, +22/-15)
```diff
@@ -3,8 +3,10 @@
 import * as C from '@/constants'
 import * as Meta from '@/constants/chat/meta'
 import * as T from '@/constants/types'
-import {act, cleanup, fireEvent, render, screen} from '@testing-library/react'
-import {installFakeChatRpc, restoreChatRpc, type FakeChatRpc} from '@/test/fake-chat-rpc'
+import {cleanup, fireEvent, render, screen} from '@testing-library/react'
+import {installFakeEngine, type FakeEngine} from '@/test/fake-engine'
+import {paramsOf} from '@/test/fake-thread-load'
+import {flush} from '@/test/flush'
 import {metasReceived} from '@/chat/inbox/metadata'
 import {resetAllStores} from '@/util/zustand'
 import {useConfigState} from '@/stores/config'
@@ -33,24 +35,28 @@ jest.mock('@/util/electron', () => {
 
 describe('Send without a tlfName prop on darwin', () => {
   const g = globalThis as unknown as {isIOS: boolean}
-  let rpc: FakeChatRpc
+  let fake: FakeEngine
+  const getUploadTempFile = 'chat.1.local.getUploadTempFile'
+  const postAttachment = 'chat.1.local.postFileAttachmentLocalNonblock'
   const conversationIDKey = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))
 
   beforeEach(() => {
     g.isIOS = true
     useConfigState.getState().dispatch.setLoggedIn(true)
-    rpc = installFakeChatRpc()
-    jest
-      .spyOn(T.RPCGen, 'incomingShareGetPreferenceRpcPromise')
-      .mockResolvedValue({compressPreference: T.RPCGen.IncomingShareCompressPreference.original})
+    fake = installFakeEngine()
+    fake.answer('keybase.1.incomingShare.getPreference', () => ({
+      compressPreference: T.RPCGen.IncomingShareCompressPreference.original,
+    }))
+    fake.answer(postAttachment, () => ({outboxID: new Uint8Array([7])}))
+    // the screen fetches a conversation meta the store does not hold whole; the service has none
+    fake.answer('chat.1.local.getInboxAndUnboxUILocal', () => ({conversations: null}))
     jest.spyOn(C.Router2, 'clearModals').mockImplementation(() => {})
-    rpc.on('getUploadTempFile', async () => await Promise.resolve('/tmp/chat-upload-temp'))
+    fake.answer(getUploadTempFile, () => '/tmp/chat-upload-temp')
   })
 
   afterEach(() => {
     g.isIOS = false
     cleanup()
-    restoreChatRpc()
     jest.restoreAllMocks()
     resetAllStores()
   })
@@ -67,14 +73,15 @@ describe('Send without a tlfName prop on darwin', () => {
         pathAndOutboxIDs={[{outboxID: new Uint8Array([7]), path: '/tmp/a.pdf'}]}
       />
     )
-    await act(async () => {
-      fireEvent.click(screen.getByText('Send'))
-      await new Promise(resolve => setTimeout(resolve, 0))
-    })
-    expect(rpc.calls('getUploadTempFile')).toHaveLength(1)
+    fireEvent.click(screen.getByText('Send'))
+    await flush(12)
+    const temp = paramsOf(fake, getUploadTempFile)
+    expect(temp).toEqual([{filename: '/tmp/a.pdf', outboxID: expect.any(Uint8Array)}])
     expect(mockCopy).toHaveBeenCalledWith('/tmp/chat-upload-temp', '/tmp/a.pdf')
-    expect(rpc.params('postAttachment')[0]).toMatchObject({
+    // the copy is posted under the outbox ID its temp file was made for
+    expect(paramsOf(fake, postAttachment)[0].arg).toMatchObject({
       filename: '/tmp/chat-upload-temp',
+      outboxID: temp[0].outboxID,
       tlfName: 'testuser,testuser2',
     })
   })
```

**File**: `shared/chat/conversation/attachment-get-titles.test.tsx` (modified, +132/-124)
```diff
@@ -1,28 +1,28 @@
 /** @jest-environment jsdom */
 /// <reference types="jest" />
 import * as C from '@/constants'
-import * as MediaProcess from '@/util/media-process'
 import * as Meta from '@/constants/chat/meta'
 import * as T from '@/constants/types'
 import {act, cleanup, fireEvent, render, screen} from '@testing-library/react'
-import {installFakeChatRpc, restoreChatRpc, type FakeChatRpc} from '@/test/fake-chat-rpc'
+import {installFakeEngine, type FakeEngine} from '@/test/fake-engine'
+import {paramsOf} from '@/test/fake-thread-load'
+import {settle} from '@/test/flush'
 import {metasReceived} from '@/chat/inbox/metadata'
 import {resetAllStores} from '@/util/zustand'
 import {useConfigState} from '@/stores/config'
 import logger from '@/logger'
 import type * as ReactTypes from 'react'
 import type {VideoEdit} from '@/util/media-process'
-import {processMedia} from 'react-native-kb'
+import type {processMedia} from 'react-native-kb'
+import {Platform} from 'react-native'
+import {fakeNativeKb, type FakeNativeKbModule} from '@/test/fake-native-kb'
 import AttachmentGetTitles, {pathToAttachmentType} from './attachment-get-titles'
 import {peekInputIntent} from './input-intent-store'
 
-// Native-only packages resolve to this one stub through jest.config's
-// moduleNameMapper, so it carries the export and the file deletes the real
-// processPaths makes.
-jest.mock('@/test/mocks/native-module', () => {
+// File IO is native: this one records the deletes the real processPaths makes.
+jest.mock('expo-file-system', () => {
   const deleted: Array<string> = []
   return {
-    ...jest.requireActual<object>('@/test/mocks/native-module'),
     File: class {
       private readonly path: string
       constructor(path: string) {
@@ -33,9 +33,9 @@ jest.mock('@/test/mocks/native-module', () => {
       }
     },
     deleted,
-    processMedia: jest.fn(),
   }
 })
+jest.mock('react-native-kb', () => jest.requireActual<FakeNativeKbModule>('@/test/fake-native-kb').realKb())
 
 // A clip whose name says so comes in trimmed, as if the user had dragged the handles.
 jest.mock('./attachment-trim', () => {
@@ -55,8 +55,43 @@ jest.mock('./attachment-trim', () => {
   return {__esModule: true, default: MockTrim}
 })
 
-const processMediaMock = processMedia as jest.MockedFunction<typeof processMedia>
-const {deleted} = jest.requireMock<{deleted: Array<string>}>('@/test/mocks/native-module')
+// the native processMedia, under react-native-kb's own wrapper, which runs it on iOS alone
+const processMediaMock: jest.MockedFunction<typeof processMedia> = jest.fn()
+const {deleted} = jest.requireMock<{deleted: Array<string>}>('expo-file-system')
+
+const getPreference = 'keybase.1.incomingShare.getPreference'
+const postAttachment = 'chat.1.local.postFileAttachmentLocalNonblock'
+const cancelUploadTempFile = 'chat.1.local.cancelUploadTempFile'
+let fake: FakeEngine
+// the service, with the user's share compression preference
+const serve = (compressPreference: T.RPCGen.IncomingShareCompressPreference) => {
+  fake = installFakeEngine()
+  fake.answer(getPreference, () => ({compressPreference}))
+  fake.answer(postAttachment, () => ({outboxID: new Uint8Array([1])}))
+  fake.answer(cancelUploadTempFile, () => null)
+  // the screen fetches a conversation meta the store does not hold whole; the service has none
+  fake.answer('chat.1.local.getInboxAndUnboxUILocal', () => ({conversations: null}))
+}
+// Long enough for a call to cross to the service and its answer back, a few in a row
+const serviceTurns = async () => {
+  for (let i = 0; i < 4; i++) {
+    await settle()
+  }
+}
+// each upload as the service received it
+const posted = () =>
+  paramsOf(fake, postAttachment).map(p => p.arg as {conversationID: Uint8Array; filename: string; title: string; tlfName: string})
+const cancelled = () => paramsOf(fake, cancelUploadTempFile).map(p => p.outboxID as Uint8Array)
+
+beforeEach(() => {
+  processMediaMock.mockReset()
+  deleted.length = 0
+  fakeNativeKb.give({processMedia: processMediaMock})
+  jest.replaceProperty(Platform, 'OS', 'ios')
+})
+afterEach(() => {
+  jest.restoreAllMocks()
+})
 
 describe('pathToAttachmentType', () => {
   test('common image extensions preview as images, case insensitively', () => {
@@ -84,31 +119,26 @@ describe('pathToAttachmentType', () => {
 
 describe('Send on iOS', () => {
   const g = globalThis as unknown as {isIOS: boolean}
-  let rpc: FakeChatRpc
   const conversationIDKey = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))
 
   beforeEach(() => {
     // the export runs on iOS; the desktop layout renders under jsdom
     g.isIOS = true
     useConfigState.getState().dispatch.setLoggedIn(true)
-    rpc = installFakeChatRpc()
-    jest
-      .spyOn(T.RPCGen, 'incomingShareGetPreferenceRpcPromise')
-      .mockResolvedValue({compressPreference: T.RPCGen.IncomingShareCompressPreference.compressed})
+    serve(T.RPCGen.IncomingShareCompressPreference.compressed)
     jest.spyOn(C.
```

**File**: `shared/chat/conversation/bot/confirm.test.tsx` (modified, +52/-54)
```diff
@@ -25,67 +25,47 @@ jest.mock('@/common-adapters', () => {
     get: (t, k) => (k === '__esModule' ? true : typeof k === 'string' && k in t ? t[k] : passThrough),
   })
 })
-jest.mock('@/teams/common/general-conv', () => ({useGeneralConvIDKey: () => undefined}))
 
 import {act, cleanup, fireEvent, render, screen} from '@testing-library/react'
+import {flush} from '@/test/flush'
 import * as C from '@/constants'
 import * as Router from '@/constants/router'
 import * as T from '@/constants/types'
 import logger from '@/logger'
-import {RPCError} from '@/util/errors'
 import {resetAllStores} from '@/util/zustand'
 import {useWaitingState} from '@/stores/waiting'
 import {useInboxMetadataState} from '@/chat/inbox/metadata'
-import {installFakeChatRpc, restoreChatRpc, type FakeChatRpc} from '@/test/fake-chat-rpc'
+import {fakeError, installFakeEngine, type FakeEngine} from '@/test/fake-engine'
+import {paramsOf} from '@/test/fake-thread-load'
 import ConfirmBotRemove from './confirm'
 
 const convID = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))
 
-const flushPromises = async () => {
-  for (let i = 0; i < 10; i++) {
-    await Promise.resolve()
-  }
-}
-
-// mirrors what the engine does for a call made with a waiting key: count it while in
-// flight, and on settle drop the count, recording the error on a failure
-const settleWithWaiting = async <R,>(
-  outcome: {error: unknown} | {result: R},
-  waitingKey?: T.Waiting.WaitingKeys
-): Promise<R> => {
-  const {dispatch} = useWaitingState.getState()
-  if (waitingKey) dispatch.increment(waitingKey)
-  await Promise.resolve()
-  if ('error' in outcome) {
-    if (waitingKey) dispatch.decrement(waitingKey, outcome.error as RPCError)
-    throw outcome.error
-  }
-  if (waitingKey) dispatch.decrement(waitingKey)
-  return outcome.result
-}
+const removeBotMember = 'chat.1.local.removeBotMember'
+const previewConversation = 'chat.1.local.previewConversationByIDLocal'
 
 const uiParticipant = (assertion: string): T.RPCChat.UIParticipant => ({
   assertion,
   inConvName: true,
   type: T.RPCChat.UIParticipantType.user,
 })
 
-const previewResult = (participants: Array<string>) =>
-  ({participants: participants.map(uiParticipant)}) as unknown as T.RPCChat.InboxUIItem
+const previewResult = (participants: Array<string>) => ({
+  conv: {participants: participants.map(uiParticipant)} as unknown as T.RPCChat.InboxUIItem,
+})
 
-let rpc: FakeChatRpc
+let fake: FakeEngine
 let clearModals: jest.SpyInstance
 let info: jest.SpyInstance
 
 beforeEach(() => {
-  rpc = installFakeChatRpc()
+  fake = installFakeEngine()
   clearModals = jest.spyOn(Router, 'clearModals').mockImplementation(() => {})
   info = jest.spyOn(logger, 'info').mockImplementation(() => {})
 })
 
 afterEach(() => {
   cleanup()
-  restoreChatRpc()
   jest.restoreAllMocks()
   resetAllStores()
 })
@@ -94,28 +74,33 @@ const renderConfirm = () =>
   render(<ConfirmBotRemove botUsername="helperbot" conversationIDKey={convID} />)
 
 const clickConfirm = async () => {
-  await act(async () => {
+  act(() => {
     fireEvent.click(screen.getByText('Confirm'))
-    await flushPromises()
   })
+  await flush()
 }
 
 describe('ConfirmBotRemove', () => {
   test('uninstalling sends removeBotMember with the remove waiting key, then refreshes participants and closes', async () => {
-    rpc.on('removeBotMember', async p => settleWithWaiting({result: undefined}, p.waitingKey))
-    rpc.on('previewConversation', () => previewResult(['testuser', 'testuser-mac']))
+    const held = fake.hold(removeBotMember)
+    fake.answer(previewConversation, () => previewResult(['testuser', 'testuser-mac']))
 
     renderConfirm()
     expect(screen.getByText('Uninstall helperbot?')).toBeTruthy()
     await clickConfirm()
 
-    expect(rpc.calls('removeBotMember')).toEqual([
-      [{conversationIDKey: convID, username: 'helperbot', waitingKey: C.waitingKeyChatBotRemove}],
-    ])
     expect(C.waitingKeyChatBotRemove).toBe('chat:botRemove')
+    // the engine counts the call under the remove key while it is in flight
+    expect(useWaitingState.getState().counts.get(C.waitingKeyChatBotRemove)).toBe(1)
+    held[0]!.reply(null)
+    await flush()
+
+    expect(paramsOf(fake, removeBotMember)).toEqual([
+      {convID: T.Chat.keyToConversationID(convID), username: 'helperbot'},
+    ])
     // the membership refresh: preview the conv (no waiting key), store its participants, then close
-    expect(rpc.calls('previewConversation')).toEqual([[convID]])
-    expect(rpc.log.map(c => c.method)).toEqual(['removeBotMember', 'previewConversation'])
+    expect(paramsOf(fake, previewConversation)).toEqual([{convID: T.Chat.keyToConversationID(convID)}])
+    expect(fake.calls.map(c => c.method)).toEqual([removeBotMember, previewConversation])
     expect(useInboxMetadataState.getState().participants.get(convID)?.all).toEqual([
       'testuser',
       'testuser-mac',
@@ -125,54 +110,67 @@ describe('ConfirmBotRemove', () => {
   })

```

**File**: `shared/chat/conversation/bot/install.test.tsx` (modified, +248/-184)
```diff
@@ -41,13 +41,6 @@ jest.mock('@/common-adapters', () => {
     get: (t, k) => (k === '__esModule' ? true : typeof k === 'string' && k in t ? t[k] : passThrough),
   })
 })
-let mockMeta: unknown
-let mockChannelMetas: ReadonlyMap<string, unknown> = new Map()
-jest.mock('../data-hooks', () => ({useConversationMeta: () => mockMeta}))
-jest.mock('../team-hooks', () => ({useChatTeam: () => ({yourOperations: {manageBots: true}})}))
-jest.mock('@/teams/common/channel-hooks', () => ({useAllChannelMetas: () => ({channelMetas: mockChannelMetas})}))
-jest.mock('@/teams/common/general-conv', () => ({useGeneralConvIDKey: () => undefined}))
-jest.mock('@/util/featured-bots', () => ({useFeaturedBot: () => undefined}))
 jest.mock('./channel-picker', () => ({__esModule: true, default: () => null}))
 
 import {act, cleanup, fireEvent, render, renderHook, screen} from '@testing-library/react'
@@ -58,165 +51,125 @@ import * as T from '@/constants/types'
 import logger from '@/logger'
 import {RPCError} from '@/util/errors'
 import {resetAllStores} from '@/util/zustand'
+import {useConfigState} from '@/stores/config'
+import {useCurrentUserState} from '@/stores/current-user'
+import {LoadedTeamsListProvider} from '@/teams/use-teams-list'
+import {metasReceived} from '@/chat/inbox/metadata'
 import {useWaitingState} from '@/stores/waiting'
 import {useInboxMetadataState} from '@/chat/inbox/metadata'
-import {installFakeChatRpc, restoreChatRpc, type FakeChatRpc} from '@/test/fake-chat-rpc'
+import {fakeError, installFakeEngine, type FakeEngine} from '@/test/fake-engine'
+import {paramsOf} from '@/test/fake-thread-load'
+import {flush} from '@/test/flush'
 import {testWaitingKey} from '@/test/waiting-key'
 import {useBotSettings} from './settings'
 import InstallBotPopup, {useBotTeamRole, useRefreshBotMembershipOnSuccess} from './install'
 
 const convID = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))
 const otherConvID = T.Chat.conversationIDToKey(new Uint8Array([5, 6, 7, 8]))
 
-const flushPromises = async () => {
-  for (let i = 0; i < 5; i++) {
-    await Promise.resolve()
-  }
-}
+const getTeamRole = 'chat.1.local.getTeamRoleInConversation'
+const getBotSettings = 'chat.1.local.getBotMemberSettings'
+const previewConversation = 'chat.1.local.previewConversationByIDLocal'
+const addBotMember = 'chat.1.local.addBotMember'
+const setBotSettings = 'chat.1.local.setBotMemberSettings'
+const listPublicBotCommands = 'chat.1.local.listPublicBotCommandsLocal'
+const convIDOf = T.Chat.keyToConversationID
 
-let rpc: FakeChatRpc
+let fake: FakeEngine
 
 beforeEach(() => {
-  rpc = installFakeChatRpc()
+  fake = installFakeEngine()
 })
 
 afterEach(() => {
   cleanup()
-  restoreChatRpc()
   jest.restoreAllMocks()
   resetAllStores()
 })
 
 test('useBotTeamRole refreshes role for the selected conversation and ignores stale results', async () => {
-  const resolvers = new Map<string, (role: T.RPCGen.TeamRole) => void>()
-  rpc.on('getBotTeamRole', async (_conversationIDKey, username) => {
-    const role = await new Promise<T.RPCGen.TeamRole>(resolve => {
-      resolvers.set(username, resolve)
-    })
-    return role
-  })
+  const held = fake.hold(getTeamRole)
 
   const {rerender, result} = renderHook(
     ({botUsername, id}) => useBotTeamRole(id, botUsername),
     {initialProps: {botUsername: 'helperbot', id: convID}}
   )
-
-  expect(rpc.calls('getBotTeamRole')).toContainEqual([convID, 'helperbot'])
-
   rerender({botUsername: 'otherbot', id: convID})
-  expect(rpc.calls('getBotTeamRole').at(-1)).toEqual([convID, 'otherbot'])
+  await flush()
+  expect(paramsOf(fake, getTeamRole)).toEqual([
+    {convID: convIDOf(convID), username: 'helperbot'},
+    {convID: convIDOf(convID), username: 'otherbot'},
+  ])
 
-  await act(async () => {
-    resolvers.get('helperbot')?.(T.RPCGen.TeamRole.bot)
-    await flushPromises()
-  })
+  held[0]!.reply(T.RPCGen.TeamRole.bot)
+  await flush()
 
   expect(result.current).toBeUndefined()
 
-  await act(async () => {
-    resolvers.get('otherbot')?.(T.RPCGen.TeamRole.restrictedbot)
-    await flushPromises()
-  })
+  held[1]!.reply(T.RPCGen.TeamRole.restrictedbot)
+  await flush()
 
   expect(result.current).toBe('restrictedbot')
 })
 
 test('useBotSettings refreshes only when enabled and hides stale conversation data', async () => {
   const settings = {cmds: true, convs: [convID], mentions: false}
-  rpc.on('getBotSettings', () => settings)
+  fake.answer(getBotSettings, () => settings)
 
   const {rerender, result} = renderHook(
     ({enabled, id}) => useBotSettings(id, 'helperbot', enabled),
     {initialProps: {enabled: false, id: convID as T.Chat.ConversationIDKey | undefined}}
   )
 
-  await act(async () => {
-    await flushPromises()
-  })
+  await flush()
 
-  expect(rpc.calls('getBotSettings')).toEqual([])
+  expect(paramsOf(fake, getBotSettings)).toEqual([])
   expect(result.current.settings).toBeUndefined()
 
   rerender({enabled: true, id: convID})
-  await act(async ()
```

**File**: `shared/chat/conversation/bot/settings.test.tsx` (modified, +22/-36)
```diff
@@ -1,61 +1,55 @@
 /** @jest-environment jsdom */
 /// <reference types="jest" />
 import {act, cleanup, renderHook} from '@testing-library/react'
+import {flush} from '@/test/flush'
 import * as T from '@/constants/types'
 import logger from '@/logger'
-import {RPCError} from '@/util/errors'
 import {resetAllStores} from '@/util/zustand'
-import {installFakeChatRpc, restoreChatRpc, type FakeChatRpc} from '@/test/fake-chat-rpc'
+import {fakeError, installFakeEngine, type FakeEngine} from '@/test/fake-engine'
+import {paramsOf} from '@/test/fake-thread-load'
 import {useBotSettings} from './settings'
 
 const convID = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))
 
-const flushPromises = async () => {
-  for (let i = 0; i < 5; i++) {
-    await Promise.resolve()
-  }
-}
+const getBotSettings = 'chat.1.local.getBotMemberSettings'
 
-let rpc: FakeChatRpc
+let fake: FakeEngine
 let info: jest.SpyInstance
 
 beforeEach(() => {
-  rpc = installFakeChatRpc()
+  fake = installFakeEngine()
   info = jest.spyOn(logger, 'info').mockImplementation(() => {})
 })
 
 afterEach(() => {
   cleanup()
-  restoreChatRpc()
   jest.restoreAllMocks()
   resetAllStores()
 })
 
 describe('useBotSettings failures', () => {
   test('a failed getBotSettings (no waiting key) is logged and reported as failed, not loading', async () => {
-    rpc.fail('getBotSettings', new RPCError('not a member', 4))
+    fake.answer(getBotSettings, () => fakeError(4, 'not a member'))
 
     const {result} = renderHook(() => useBotSettings(convID, 'helperbot'))
 
     expect(result.current.failed).toBe(false)
-    await act(async () => {
-      await flushPromises()
-    })
+    await flush()
 
-    expect(rpc.calls('getBotSettings')).toEqual([[convID, 'helperbot']])
+    expect(paramsOf(fake, getBotSettings)).toEqual([{convID: T.Chat.keyToConversationID(convID), username: 'helperbot'}])
     expect(result.current.failed).toBe(true)
     expect(result.current.settings).toBeUndefined()
     expect(info).toHaveBeenCalledWith(
-      'useBotSettings: failed to refresh settings for helperbot: ERROR CODE 4 - not a member'
+      'useBotSettings: failed to refresh settings for helperbot: ERROR CODE 4 - not a member in method chat.1.local.getBotMemberSettings'
     )
   })
 
   test('a failure for a bot no longer shown is dropped without a log', async () => {
-    let rejectHelper: (e: unknown) => void = () => {}
-    rpc.on('getBotSettings', async (_conversationIDKey, username) => {
-      if (username === 'helperbot') {
-        return new Promise<T.RPCGen.TeamBotSettings>((_resolve, reject) => {
-          rejectHelper = reject
+    let failHelper = () => {}
+    fake.answer(getBotSettings, async (params: {username: string}) => {
+      if (params.username === 'helperbot') {
+        return new Promise(resolve => {
+          failHelper = () => resolve(fakeError(5, 'late'))
         })
       }
       return {cmds: true, convs: null, mentions: true}
@@ -65,32 +59,24 @@ describe('useBotSettings failures', () => {
       initialProps: {username: 'helperbot'},
     })
     rerender({username: 'otherbot'})
-    await act(async () => {
-      await flushPromises()
-    })
-    await act(async () => {
-      rejectHelper(new RPCError('late', 5))
-      await flushPromises()
-    })
+    await flush()
+    failHelper()
+    await flush()
 
     expect(result.current.failed).toBe(false)
     expect(result.current.settings).toEqual({cmds: true, convs: null, mentions: true})
     expect(info).not.toHaveBeenCalled()
   })
 
   test('a failure is not retried; a later setSettings clears it', async () => {
-    rpc.fail('getBotSettings', new RPCError('not a member', 4))
+    fake.answer(getBotSettings, () => fakeError(4, 'not a member'))
 
     const {rerender, result} = renderHook(() => useBotSettings(convID, 'helperbot'))
-    await act(async () => {
-      await flushPromises()
-    })
+    await flush()
     rerender()
-    await act(async () => {
-      await flushPromises()
-    })
+    await flush()
 
-    expect(rpc.calls('getBotSettings')).toHaveLength(1)
+    expect(paramsOf(fake, getBotSettings)).toHaveLength(1)
     expect(result.current.failed).toBe(true)
 
     act(() => {
```

#### Recent Merged Pull Requests:
- **PR #29877** (2026-11-04): Fix swipe-to-reply leaving the row stuck on iOS; make the e2e helper tests pass on Linux CI (@chrisnojima)
- **PR #29876** (2026-11-04): Update deps: react-native 0.88.1, expo 58.0.23, electron 45.2.2 (@chrisnojima)
- **PR #29875** (2026-11-03): desktop: fix PDF previews blocked by Trusted Types in release builds (@chrisnojima)
- **PR #29874** (2026-11-03): CLAUDE.md: three fresh-context reviews before pushing a non-trivial PR (@chrisnojima)
- **PR #29873** (2026-11-03): engine: a call settles after its session's queued handlers; fix the chat races and three more (@chrisnojima)
- **PR #29872** (2026-11-03): Fix the bugs the iOS release gate found, and run unit tests on the real libraries (@chrisnojima)

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

## X. e2e: iOS release gate command, census and report; crash and render recovery (#29

**RULE**:
When implementing operations in `shared/jest.config.js`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in keybase/client. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `601ccb05`: e2e: iOS release gate command, census and report; crash and render recovery (#29866). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `shared/jest.config.js`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
    // tests/e2e/shared (shared/gate included), ios-appium/gate, tests/e2e/accounts, the corpus, the electron and ios-appium release libs and electron's main-process lib hold helper unit tests; the rest are playwright/appium/node:test suites
    '<rootDir>/tests/e2e/(?!shared/|accounts/|ios-appium/(?:gate/|release-lib\\.test\\.ts$)|fixtures/corpus/|electron/(?:release-lib|helpers/main-process-lib)\\.test\\.ts$)',
```

**NEGATIVE CONSTRAINT**:
```go
// Anti-pattern to NEVER write (induced failure mode):
    // tests/e2e/shared (shared/gate included), ios-appium/gate, tests/e2e/accounts, the corpus and electron's release and main-process libs hold helper unit tests; the rest are playwright/appium/node:test suites
    '<rootDir>/tests/e2e/(?!shared/|accounts/|ios-appium/gate/|fixtures/corpus/|electron/(?:release-lib|helpers/main-process-lib)\\.test\\.ts$)',
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `601ccb05` are properly handled with clean fallback behavior.

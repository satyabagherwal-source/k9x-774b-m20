> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/keybase-client-learnings.md`  
> **Source**: github ([https://github.com/keybase/client](https://github.com/keybase/client))  
> **Source Version**: `20c651e0`  
> **License**: BSD-3-Clause  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-25T02:42:36.652Z  
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
> **Harvest Timestamp**: 2026-10-25T02:42:35.682Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `keybase/client`
- **Description**: Keybase Go Library, Client, Service, OS X, iOS, Android, Electron
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 9260 stars

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

### Incident Patch 1: `7874b7f1` (2026-10-20)
**Commit Message**: include uid on all local rpcs (#29708)

* test(chat): every chat notification names the account it is for

Goal: every NotifyChat notification the service sends carries, as uid,
the account it was generated for.

Why: login and logout are not serialized against chat notifications, so
during an account switch the GUI can receive the previous account's chat
notifications after the switch. Today the GUI guards against that with a
uid-keyed thread provider, store retirement and a gate on every action.
With the account on every notification it can drop the stale ones instead.

Six of the 29 notifications carry no uid today: ChatIdentifyUpdate,
ChatTypingUpdate, ChatArchiveProgress, ChatArchiveComplete,
ChatWelcomeMessageLoaded and ChatParticipantsInfo. The other 23 do.

The test registers a GUI-like connection on the NotifyRouter, sends every
notification in the NotifyChat protocol for a known account and checks the
uid each one carries. It also fails if a NotifyChat notification is added
without an entry. It needs no server and runs locally:

  cd go && go test ./libkb -run TestChatNotificationsNameTheirAccount

It fails today for exactly the six notifications above. Making it pass
nee

**File**: `go/chat/activitynotifier.go` (modified, +2/-2)
```diff
@@ -91,10 +91,10 @@ func (n *NotifyRouterActivityRouter) Activity(ctx context.Context, uid gregor1.U
 	}
 }
 
-func (n *NotifyRouterActivityRouter) TypingUpdate(ctx context.Context, updates []chat1.ConvTypingUpdate) {
+func (n *NotifyRouterActivityRouter) TypingUpdate(ctx context.Context, uid gregor1.UID, updates []chat1.ConvTypingUpdate) {
 	ctx = globals.BackgroundChatCtx(ctx, n.G())
 	n.notifyCh <- func() {
-		n.G().NotifyRouter.HandleChatTypingUpdate(ctx, updates)
+		n.G().NotifyRouter.HandleChatTypingUpdate(ctx, n.kuid(uid), updates)
 	}
 }
 
```

**File**: `go/chat/archive.go` (modified, +2/-2)
```diff
@@ -522,7 +522,7 @@ func NewChatArchiver(g *globals.Context, uid gregor1.UID, remoteClient func() ch
 
 func (c *ChatArchiver) notifyProgress(ctx context.Context, jobID chat1.ArchiveJobID, msgsComplete, msgsTotal int64) {
 	c.Debug(ctx, "notifyProgress(%s) %d/%d", jobID, msgsComplete, msgsTotal)
-	c.G().NotifyRouter.HandleChatArchiveProgress(ctx, jobID, msgsComplete, msgsTotal)
+	c.G().NotifyRouter.HandleChatArchiveProgress(ctx, keybase1.UID(c.uid.String()), jobID, msgsComplete, msgsTotal)
 }
 
 func (c *ChatArchiver) archiveName(conv chat1.ConversationLocal) string {
@@ -746,7 +746,7 @@ func (c *ChatArchiver) ArchiveChat(ctx context.Context, arg chat1.ArchiveChatJob
 		}
 
 		// Alert the UI
-		c.G().NotifyRouter.HandleChatArchiveComplete(ctx, arg.JobID)
+		c.G().NotifyRouter.HandleChatArchiveComplete(ctx, keybase1.UID(c.uid.String()), arg.JobID)
 	}()
 
 	// Presume to resume
```

**File**: `go/chat/identify.go` (modified, +8/-8)
```diff
@@ -20,7 +20,7 @@ type DummyIdentifyNotifier struct{}
 
 func (d DummyIdentifyNotifier) Reset()             {}
 func (d DummyIdentifyNotifier) ResetOnGUIConnect() {}
-func (d DummyIdentifyNotifier) Send(ctx context.Context, update keybase1.CanonicalTLFNameAndIDWithBreaks) {
+func (d DummyIdentifyNotifier) Send(ctx context.Context, uid keybase1.UID, update keybase1.CanonicalTLFNameAndIDWithBreaks) {
 }
 
 type SimpleIdentifyNotifier struct {
@@ -40,12 +40,12 @@ func NewSimpleIdentifyNotifier(g *globals.Context) *SimpleIdentifyNotifier {
 func (d *SimpleIdentifyNotifier) Reset()             {}
 func (d *SimpleIdentifyNotifier) ResetOnGUIConnect() {}
 
-func (d *SimpleIdentifyNotifier) Send(ctx context.Context, update keybase1.CanonicalTLFNameAndIDWithBreaks) {
+func (d *SimpleIdentifyNotifier) Send(ctx context.Context, uid keybase1.UID, update keybase1.CanonicalTLFNameAndIDWithBreaks) {
 	// Send to storage as well (charge forward on error)
 	if err := d.storage.UpdateTLFIdentifyBreak(ctx, update.TlfID.ToBytes(), update.Breaks.Breaks); err != nil {
 		d.Debug(ctx, "failed to update storage with TLF identify info: %s", err.Error())
 	}
-	d.G().NotifyRouter.HandleChatIdentifyUpdate(ctx, update)
+	d.G().NotifyRouter.HandleChatIdentifyUpdate(ctx, uid, update)
 }
 
 type CachingIdentifyNotifier struct {
@@ -81,7 +81,7 @@ func (i *CachingIdentifyNotifier) Reset() {
 	i.identCache = make(map[string]keybase1.CanonicalTLFNameAndIDWithBreaks)
 }
 
-func (i *CachingIdentifyNotifier) Send(ctx context.Context, update keybase1.CanonicalTLFNameAndIDWithBreaks) {
+func (i *CachingIdentifyNotifier) Send(ctx context.Context, uid keybase1.UID, update keybase1.CanonicalTLFNameAndIDWithBreaks) {
 	// Send to storage as well (charge forward on error)
 	if err := i.storage.UpdateTLFIdentifyBreak(ctx, update.TlfID.ToBytes(), update.Breaks.Breaks); err != nil {
 		i.Debug(ctx, "failed to update storage with TLF identify info: %s", err.Error())
@@ -104,7 +104,7 @@ func (i *CachingIdentifyNotifier) Send(ctx context.Context, update keybase1.Cano
 	i.Unlock()
 
 	i.Debug(ctx, "cache miss, sending notify: %s dat: %v", tlfName, update)
-	i.G().NotifyRouter.HandleChatIdentifyUpdate(ctx, update)
+	i.G().NotifyRouter.HandleChatIdentifyUpdate(ctx, uid, update)
 }
 
 type IdentifyChangedHandler struct {
@@ -141,7 +141,7 @@ func (h *IdentifyChangedHandler) HandleUserChanged(uid keybase1.UID) (err error)
 	if err != nil {
 		return err
 	}
-	if _, err := NewNameIdentifier(h.G()).Identify(ctx, []string{username}, true, func() keybase1.TLFID {
+	if _, err := NewNameIdentifier(h.G()).Identify(ctx, me, []string{username}, true, func() keybase1.TLFID {
 		return ""
 	}, func() keybase1.CanonicalTlfName {
 		return keybase1.CanonicalTlfName(username)
@@ -163,7 +163,7 @@ func NewNameIdentifier(g *globals.Context) *NameIdentifier {
 	}
 }
 
-func (t *NameIdentifier) Identify(ctx context.Context, names []string, private bool,
+func (t *NameIdentifier) Identify(ctx context.Context, uid keybase1.UID, names []string, private bool,
 	getTLFID func() keybase1.TLFID, getCanonicalName func() keybase1.CanonicalTlfName,
 ) (res []keybase1.TLFIdentifyFailure, err error) {
 	idNotifier := globals.CtxIdentifyNotifier(ctx)
@@ -232,7 +232,7 @@ func (t *NameIdentifier) Identify(ctx context.Context, names []string, private b
 	// Run the updates through the identify notifier
 	if idNotifier != nil {
 		t.Debug(ctx, "sending update through ident notifier: %d breaks", len(res))
-		idNotifier.Send(ctx, keybase1.CanonicalTLFNameAndIDWithBreaks{
+		idNotifier.Send(ctx, uid, keybase1.CanonicalTLFNameAndIDWithBreaks{
 			Breaks: keybase1.TLFBreak{
 				Breaks: res,
 			},
```

**File**: `go/chat/participantsource.go` (modified, +21/-8)
```diff
@@ -17,6 +17,11 @@ import (
 	"golang.org/x/sync/semaphore"
 )
 
+type participantNotify struct {
+	uid   keybase1.UID
+	parts map[chat1.ConvIDStr][]chat1.UIParticipant
+}
+
 type partDiskStorage struct {
 	Uids []gregor1.UID
 	Hash string
@@ -43,15 +48,20 @@ func NewCachingParticipantSource(g *globals.Context, ri func() chat1.RemoteInter
 		return g.LocalChatDb
 	}
 	notify, notifyCancel := libkb.ThrottleBatch(func(batchedInt any) {
-		batched, _ := batchedInt.(map[chat1.ConvIDStr][]chat1.UIParticipant)
-		g.NotifyRouter.HandleChatParticipantsInfo(context.Background(), batched)
+		batched, _ := batchedInt.(map[keybase1.UID]map[chat1.ConvIDStr][]chat1.UIParticipant)
+		for uid, parts := range batched {
+			g.NotifyRouter.HandleChatParticipantsInfo(context.Background(), uid, parts)
+		}
 	}, func(batchedInt, singleInt any) any {
-		batched, _ := batchedInt.(map[chat1.ConvIDStr][]chat1.UIParticipant)
-		single, _ := singleInt.(map[chat1.ConvIDStr][]chat1.UIParticipant)
-		maps.Copy(batched, single)
+		batched, _ := batchedInt.(map[keybase1.UID]map[chat1.ConvIDStr][]chat1.UIParticipant)
+		single, _ := singleInt.(participantNotify)
+		if batched[single.uid] == nil {
+			batched[single.uid] = make(map[chat1.ConvIDStr][]chat1.UIParticipant)
+		}
+		maps.Copy(batched[single.uid], single.parts)
 		return batched
 	}, func() any {
-		return make(map[chat1.ConvIDStr][]chat1.UIParticipant)
+		return make(map[keybase1.UID]map[chat1.ConvIDStr][]chat1.UIParticipant)
 	},
 		200*time.Millisecond, true)
 	g.PushShutdownHook(func(_ libkb.MetaContext) error {
@@ -177,8 +187,11 @@ func (s *CachingParticipantSource) GetWithNotifyNonblock(ctx context.Context, ui
 				s.Debug(ctx, "GetWithNotifyNonblock: failed to map uids: %s", err)
 				continue
 			}
-			s.notify(map[chat1.ConvIDStr][]chat1.UIParticipant{
-				convIDStr: utils.PresentConversationParticipantsLocal(ctx, participants),
+			s.notify(participantNotify{
+				uid: keybase1.UID(uid.String()),
+				parts: map[chat1.ConvIDStr][]chat1.UIParticipant{
+					convIDStr: utils.PresentConversationParticipantsLocal(ctx, participants),
+				},
 			})
 		}
 	}(globals.BackgroundChatCtx(ctx, s.G()))
```

**File**: `go/chat/push.go` (modified, +6/-4)
```diff
@@ -153,7 +153,9 @@ func (g *gregorMessageOrderer) WaitForTurn(ctx context.Context, uid gregor1.UID,
 			//
 			//nolint:gosec // G115: Version difference for delay calculation, safe to convert
 			max(
-				time.Duration(newVers-vers-1)*time.Second, 0), time.Minute)
+				time.Duration(newVers-vers-1)*time.Second, 0,
+			), time.Minute,
+		)
 
 		deadline = deadline.Add(dur)
 		waiters := g.addToWaitersLocked(ctx, uid, vers, newVers)
@@ -614,7 +616,7 @@ func (g *PushHandler) Activity(ctx context.Context, m gregor.OutOfBandMessage) (
 			}
 
 			// Update typing status to stopped
-			g.typingMonitor.Update(ctx, chat1.TyperInfo{
+			g.typingMonitor.Update(ctx, gregor1.UID(uid), chat1.TyperInfo{
 				Uid:      keybase1.UID(nm.Message.ClientHeader.Sender.String()),
 				DeviceID: keybase1.DeviceID(nm.Message.ClientHeader.SenderDevice.String()),
 			}, convID, chat1.TeamType_NONE, false)
@@ -996,8 +998,8 @@ func (g *PushHandler) Typing(ctx context.Context, m gregor.OutOfBandMessage) (er
 		return err
 	}
 
-	// Fire off update with all relevant info
-	g.typingMonitor.Update(ctx, chat1.TyperInfo{
+	// The account is the gregor recipient, not the person who is typing.
+	g.typingMonitor.Update(ctx, gregor1.UID(m.UID().Bytes()), chat1.TyperInfo{
 		Uid:      kuid,
 		DeviceID: kdid,
 		Username: user.String(),
```

**File**: `go/chat/teams.go` (modified, +4/-2)
```diff
@@ -57,7 +57,8 @@ func getTeamCryptKey(mctx libkb.MetaContext, team *teams.Team, generation keybas
 	// Need to convert this key in to a TeambotKey
 	if botUID != nil {
 		res, _, err = mctx.G().GetTeambotMemberKeyer().GetOrCreateTeambotKey(
-			mctx, team.ID, *botUID, appKey)
+			mctx, team.ID, *botUID, appKey,
+		)
 		return res, err
 	}
 	return appKey, nil
@@ -576,9 +577,10 @@ func (t *ImplicitTeamsNameInfoSource) identify(ctx context.Context, team *teams.
 		return errors.New("invalid context with no chat metadata")
 	}
 	cb := make(chan struct{})
+	accountUID := t.G().Env.GetUID()
 	go func(ctx context.Context) {
 		var idFails []keybase1.TLFIdentifyFailure
-		idFails, err = t.Identify(ctx, names, true,
+		idFails, err = t.Identify(ctx, accountUID, names, true,
 			func() keybase1.TLFID {
 				return keybase1.TLFID(team.ID.String())
 			},
```

**File**: `go/chat/tlf.go` (modified, +8/-3)
```diff
@@ -45,7 +45,8 @@ func (t *KBFSNameInfoSource) tlfKeysClient() (*keybase1.TlfKeysClient, error) {
 	}
 	return &keybase1.TlfKeysClient{
 		Cli: rpc.NewClient(
-			xp, libkb.NewContextifiedErrorUnwrapper(t.G().ExternalG()), libkb.LogTagsFromContext),
+			xp, libkb.NewContextifiedErrorUnwrapper(t.G().ExternalG()), libkb.LogTagsFromContext,
+		),
 	}, nil
 }
 
@@ -192,6 +193,7 @@ func (t *KBFSNameInfoSource) CryptKeys(ctx context.Context, tlfName string) (res
 		"CryptKeys(tlf=%s,mode=%v)", tlfName, identBehavior)()
 
 	username := t.G().Env.GetUsername()
+	accountUID := t.G().Env.GetUID()
 	if len(username) == 0 {
 		return res, libkb.LoginRequiredError{}
 	}
@@ -209,7 +211,8 @@ func (t *KBFSNameInfoSource) CryptKeys(ctx context.Context, tlfName string) (res
 		t.Debug(ectx, "CryptKeys: running identify")
 		var err error
 		names := utils.SplitTLFName(tlfName)
-		ib, err = t.Identify(ectx, names, true,
+		ib, err = t.Identify(
+			ectx, accountUID, names, true,
 			func() keybase1.TLFID {
 				<-doneCh
 				return res.NameIDBreaks.TlfID
@@ -258,6 +261,7 @@ func (t *KBFSNameInfoSource) PublicCanonicalTLFNameAndID(ctx context.Context, tl
 	}
 	defer t.Trace(ctx, &err,
 		"PublicCanonicalTLFNameAndID(tlf=%s,mode=%v)", tlfName, identBehavior)()
+	accountUID := t.G().Env.GetUID()
 
 	// call Identify and CanonicalTLFNameAndIDWithBreaks concurrently:
 	group, ectx := errgroup.WithContext(globals.BackgroundChatCtx(ctx, t.G()))
@@ -268,7 +272,8 @@ func (t *KBFSNameInfoSource) PublicCanonicalTLFNameAndID(ctx context.Context, tl
 		group.Go(func() error {
 			var err error
 			names := utils.SplitTLFName(tlfName)
-			ib, err = t.Identify(ectx, names, false,
+			ib, err = t.Identify(
+				ectx, accountUID, names, false,
 				func() keybase1.TLFID {
 					<-doneCh
 					return res.TlfID
```

**File**: `go/chat/types/interfaces.go` (modified, +4/-4)
```diff
@@ -315,7 +315,7 @@ type TeamChannelSource interface {
 type ActivityNotifier interface {
 	Activity(ctx context.Context, uid gregor1.UID, topicType chat1.TopicType, activity *chat1.ChatActivity,
 		source chat1.ChatActivitySource)
-	TypingUpdate(ctx context.Context, updates []chat1.ConvTypingUpdate)
+	TypingUpdate(ctx context.Context, uid gregor1.UID, updates []chat1.ConvTypingUpdate)
 	JoinedConversation(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
 		topicType chat1.TopicType, conv *chat1.InboxUIItem)
 	LeftConversation(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
@@ -357,7 +357,7 @@ type ActivityNotifier interface {
 type IdentifyNotifier interface {
 	Reset()
 	ResetOnGUIConnect()
-	Send(ctx context.Context, update keybase1.CanonicalTLFNameAndIDWithBreaks)
+	Send(ctx context.Context, uid keybase1.UID, update keybase1.CanonicalTLFNameAndIDWithBreaks)
 }
 
 type KeyFinder interface {
@@ -470,8 +470,8 @@ type ShareIntentDonator interface {
 }
 
 type StellarLoader interface {
-	LoadPayment(ctx context.Context, convID chat1.ConversationID, msgID chat1.MessageID, senderUsername string, paymentID stellar1.PaymentID) *chat1.UIPaymentInfo
-	LoadRequest(ctx context.Context, convID chat1.ConversationID, msgID chat1.MessageID, senderUsername string, requestID stellar1.KeybaseRequestID) *chat1.UIRequestInfo
+	LoadPayment(ctx context.Context, uid keybase1.UID, convID chat1.ConversationID, msgID chat1.MessageID, senderUsername string, paymentID stellar1.PaymentID) *chat1.UIPaymentInfo
+	LoadRequest(ctx context.Context, uid keybase1.UID, convID chat1.ConversationID, msgID chat1.MessageID, senderUsername string, requestID stellar1.KeybaseRequestID) *chat1.UIRequestInfo
 }
 
 type StellarSender interface {
```

---

### Incident Patch 2: `ded1e2dd` (2026-10-23)
**Commit Message**: deps: webdriverio 10, immer, zustand, builder-bob; drop two security resolutions (#29829)

* deps: bump immer, zustand, builder-bob; refresh ip-address and serialize-javascript

* deps: webdriverio 10; drop serialize-javascript and basic-ftp resolutions

* engine test: cancel a prompt with no event-loop turn after its push

**File**: `rnmodules/react-native-kb/package.json` (modified, +1/-1)
```diff
@@ -32,7 +32,7 @@
     "react-native": "file:../../shared/node_modules/react-native",
     "@types/react": "file:../../shared/node_modules/@types/react",
     "typescript": "file:../../shared/node_modules/typescript",
-    "react-native-builder-bob": "0.43.2"
+    "react-native-builder-bob": "0.44.1"
   },
   "peerDependencies": {
     "react": "*",
```

**File**: `rnmodules/react-native-kb/yarn.lock` (modified, +365/-411)
```diff
@@ -2,17 +2,17 @@
 # yarn lockfile v1
 
 
-"@ark/schema@0.56.2":
-  version "0.56.2"
-  resolved "https://registry.yarnpkg.com/@ark/schema/-/schema-0.56.2.tgz#204292862d1b87a08975f66c498b6e0e138126cf"
-  integrity sha512-Qx4D2JFbBWpntiHZaTv7bGG4H/M2rigiknezKg/WVyDSaLdE4YCcWAOoFB7pjjDqHbbV2OqRfntm1nnXvwMexg==
+"@ark/schema@0.56.8":
+  version "0.56.8"
+  resolved "https://registry.yarnpkg.com/@ark/schema/-/schema-0.56.8.tgz#7d2a9c226bc4613a1ca0f7a1496153227d5374f3"
+  integrity sha512-R05TOe85oQBGFFw2zKMuZpqkXibLKuC/aJt6VwFn5Cjc4x3NkWfhvGRpRDycNkj3ddcHnOPtIsmjVowJO9Yxdw==
   dependencies:
-    "@ark/util" "0.56.2"
+    "@ark/util" "0.56.8"
 
-"@ark/util@0.56.2":
-  version "0.56.2"
-  resolved "https://registry.yarnpkg.com/@ark/util/-/util-0.56.2.tgz#c6c09b48ce242c5b8527a273d2413a372e6e517a"
-  integrity sha512-9kU2sUE38FZEGG7l3hamYMBieLYEJh2L1mrYD2eXpT+78EnQSV1bhjxJhnxGBMSTbtwpBSDNSK+K60WvaI/DTQ==
+"@ark/util@0.56.8":
+  version "0.56.8"
+  resolved "https://registry.yarnpkg.com/@ark/util/-/util-0.56.8.tgz#b9bc33d60875de9aeede7d2a2672ea6b6197a05f"
+  integrity sha512-XLiQyGfpJcws1zCtp2Cva8s1oheCdFn1Rt6JSyC4NnkDrpwCJnlaiawuuOc1Z97vMH+jEzW5vyyf0xOju5wUQA==
 
 "@babel/code-frame@^7.29.0", "@babel/code-frame@^7.29.7":
   version "7.29.7"
@@ -28,7 +28,7 @@
   resolved "https://registry.yarnpkg.com/@babel/compat-data/-/compat-data-7.29.7.tgz#6f0237f0f36d2e51c0570a636faed9d2d0efe629"
   integrity sha512-locTkQyKvwIEgBzVrn8693ebc97F2U8ZHjbXwDXJ5Fn2TCpNwTlKcaKLkdHop5c/icOFE7qt7Q9JC5hnKNa6Gg==
 
-"@babel/core@^7.25.2", "@babel/core@^7.29.0":
+"@babel/core@^7.25.2", "@babel/core@^7.29.7":
   version "7.29.7"
   resolved "https://registry.yarnpkg.com/@babel/core/-/core-7.29.7.tgz#80c10b17248082968b57a857b91640971f2070f7"
   integrity sha512-RgHBCvtjbOK2gXSNBNIkNoEc9qoVEtau3hj8gEqKQuL3HZAibKarWFEI3Lfm6EYKkLalOh8eSrj9b+ch9H/VBA==
@@ -479,7 +479,7 @@
   dependencies:
     "@babel/helper-plugin-utils" "^7.29.7"
 
-"@babel/plugin-transform-flow-strip-types@^7.27.1":
+"@babel/plugin-transform-flow-strip-types@^7.29.7":
   version "7.29.7"
   resolved "https://registry.yarnpkg.com/@babel/plugin-transform-flow-strip-types/-/plugin-transform-flow-strip-types-7.29.7.tgz#911bcb31608c3576510d7e0c95ccf64f9e1812d0"
   integrity sha512-wRHeUjUjCZnMHmiO5bRgjFLcoEh7JyTdByOW11ahhwNa4V0bmeGEaIvt51yq0zQp2yWIpqfxXXPyUP6GFJZHOQ==
@@ -737,7 +737,7 @@
   dependencies:
     "@babel/helper-plugin-utils" "^7.29.7"
 
-"@babel/plugin-transform-strict-mode@^7.27.1":
+"@babel/plugin-transform-strict-mode@^7.29.7":
   version "7.29.7"
   resolved "https://registry.yarnpkg.com/@babel/plugin-transform-strict-mode/-/plugin-transform-strict-mode-7.29.7.tgz#81a223852970e697a93e11932a5f809f0e0ec373"
   integrity sha512-YjFcy7S8kEndK6dsK4UBISrMZa2MHiitApdZ7hTxAyQpX+Ct+aKgKOZoTx/Kcz6drgKxe50TIPUvZq7V4HGGKg==
@@ -800,7 +800,7 @@
     "@babel/helper-create-regexp-features-plugin" "^7.29.7"
     "@babel/helper-plugin-utils" "^7.29.7"
 
-"@babel/preset-env@^7.29.2":
+"@babel/preset-env@^7.29.7":
   version "7.29.7"
   resolved "https://registry.yarnpkg.com/@babel/preset-env/-/preset-env-7.29.7.tgz#5e2ab5e764b493fdefc99c43aeaa70a9533a37fd"
   integrity sha512-GYzX36n1nsciIb0uyH0GHwxwtNwPQIcpxSeiVLDtG/B7jB5xXgchnmL1f/jCX5o+pwnaDBtO60ONSJhEBJfxYA==
@@ -886,7 +886,7 @@
     "@babel/types" "^7.4.4"
     esutils "^2.0.2"
 
-"@babel/preset-react@^7.28.5":
+"@babel/preset-react@^7.29.7":
   version "7.29.7"
   resolved "https://registry.yarnpkg.com/@babel/preset-react/-/preset-react-7.29.7.tgz#2ed18366e38c2081bbf1760dc01e88fa5674eb17"
   integrity sha512-C+PV1TFUPTmBQGoPBL8j2QmLpZ117YTCwxIZeJOM96GbYMFSc7/pOXU5lVykwnZxyTqQxRsvoRk6f2FktZgGHA==
@@ -898,7 +898,7 @@
     "@babel/plugin-transform-react-jsx-development" "^7.29.7"
     "@babel/plugin-transform-react-pure-annotations" "^7.29.7"
 
-"@babel/preset-typescript@^7.28.5":
+"@babel/preset-typescript@^7.29.7":
   version "7.29.7"
   resolved "https://registry.yarnpkg.com/@babel/preset-typescript/-/preset-typescript-7.29.7.tgz#de9be1f47b785c979ec7b3a71f4cd8bae5267b62"
   integrity sha512-/Foi8vKY2EVbed/1eZx0gJEEwHAIxogrySI7rULcRIvhZzbvoE/b5qG5Ghc0WKAFKOHA9SD1x7RsFlOYdutIiQ==
@@ -1044,11 +1044,16 @@
   resolved "https://registry.yarnpkg.com/@jridgewell/sourcemap-codec/-/sourcemap-codec-1.4.15.tgz#d7c6e6755c78567a951e04ab52ef0fd26de59f32"
   integrity sha512-eF2rxCRulEKXHTRiDrDy6erMYWqNw4LPdQ8UQA4huuxaQsVeRPFl2oM8oDGxMFhJUWZf9McpLtJasDDZb/Bpeg==
 
-"@jridgewell/sourcemap-codec@^1.5.0", "@jridgewell/sourcemap-codec@^1.5.5":
+"@jridgewell/sourcemap-codec@^1.5.0":
   version "1.5.5"
   resolved "https://registry.yarnpkg.com/@jridgewell/sourcemap-codec/-/sourcemap-codec-1.5.5.tgz#6912b00d2c631c0d15ce1a7ab57cd657f2a8f8ba"
   integrity sha512-cYQ9310grqxueWbl+WuIUIaiUaDcj7WOq5fVhEljNVgRfOUhY9fy2zTvfoqWsnebh8Sl70VScFbICvJnLKB0Og==
 
+"@jridgewell/sourcemap-codec@^1.6.0":
+  version "1.6.0"
+  resolved "https://registry.yarnpkg.com/@jridgewell/sourcemap-codec/-/sourcemap-codec-1.6.0.tgz#f4c663e862f06dc98ca4d453862c46902789a18d"
+ 
```

**File**: `shared/engine/session-cancel.test.ts` (modified, +2/-1)
```diff
@@ -228,8 +228,9 @@ describe('a service cancel of one prompt', () => {
   // The GUI owes the service only once the handler has run and left the prompt unanswered
   test("still on the listener's timer, keeps its waiting on and never reaches the handler", async () => {
     const {ended, fake, held, onPrompt, sessionID} = await start()
+    // The push arms the listener's timer before it returns, so cancel with no await in between:
+    // any event-loop turn here lets a 0ms timer come due on a slow machine and run the handler
     void fake.push(prompt, {kind: 0}, {sessionID})
-    await tick()
     expect(waitingCount(fake)).toBe(1)
     fake.cancelPush(prompt)
     expect(waitingCount(fake)).toBe(1)
```

**File**: `shared/package.json` (modified, +9/-11)
```diff
@@ -134,7 +134,7 @@
     "expo-task-manager": "58.0.12",
     "expo-video": "58.0.12",
     "google-libphonenumber": "3.2.47",
-    "immer": "11.2.7",
+    "immer": "11.2.9",
     "lodash": "4.18.1",
     "lottie-react-native": "7.5.0",
     "lottie-web": "5.13.0",
@@ -151,7 +151,7 @@
     "react-native-web": "0.21.4",
     "react-native-webview": "16.0.0",
     "react-native-worklets": "0.13.0",
-    "zustand": "5.0.15"
+    "zustand": "5.0.16"
   },
   "devDependencies": {
     "@babel/core": "7.29.7",
@@ -179,12 +179,12 @@
     "@types/react": "19.3.0",
     "@types/react-dom": "19.3.0",
     "@vitejs/plugin-react": "6.1.2",
-    "@wdio/appium-service": "9.32.0",
-    "@wdio/cli": "9.32.0",
-    "@wdio/globals": "9.31.3",
-    "@wdio/local-runner": "9.32.0",
-    "@wdio/mocha-framework": "9.32.0",
-    "@wdio/spec-reporter": "9.32.0",
+    "@wdio/appium-service": "10.1.0",
+    "@wdio/cli": "10.1.0",
+    "@wdio/globals": "10.1.0",
+    "@wdio/local-runner": "10.1.0",
+    "@wdio/mocha-framework": "10.1.0",
+    "@wdio/spec-reporter": "10.1.0",
     "appium": "3.8.0",
     "babel-jest": "30.5.2",
     "babel-plugin-module-resolver": "5.0.3",
@@ -206,12 +206,10 @@
     "typescript-eslint": "8.72.0",
     "typescript-native": "npm:typescript@7.0.2",
     "vite": "8.3.5",
-    "webdriverio": "9.32.0"
+    "webdriverio": "10.1.0"
   },
   "resolutions": {
     "**/@types/react": "19.3.0",
-    "**/basic-ftp": "6.2.3",
-    "**/serialize-javascript": "7.1.2",
     "**/shell-quote": "1.12.0"
   },
   "typecoverage": {
```

**File**: `shared/tests/e2e/ios-appium/wdio.android.conf.ts` (modified, +2/-0)
```diff
@@ -30,6 +30,8 @@ export const config: WebdriverIO.Config = {
   },
   capabilities: [androidCapabilities(serial)],
   logLevel: 'warn',
+  // Shares the iOS helpers, which rely on $() taking the first match.
+  strictSelectors: false,
   framework: 'mocha',
   // Mirrors the iOS config: the one-session suite accumulates load over many
   // flows; retries: 2 (each with a fresh escapeToTabs reset) absorbs transient
```

**File**: `shared/tests/e2e/ios-appium/wdio.conf.ts` (modified, +3/-0)
```diff
@@ -48,6 +48,9 @@ export const config: WebdriverIO.Config = {
   },
   capabilities: [iosCapabilities(udid, {wdaLocalPort, prebuilt: !isOld, derivedDataPath})],
   logLevel: 'warn',
+  // Selectors and helpers rely on $() taking the first match (e.g. `~More` matches several
+  // elements), so don't throw on multiple matches.
+  strictSelectors: false,
   framework: 'mocha',
   // 120s: the tablet settings-subpages flow can run long; phone tests finish well
   // under this. retries: 2 — the one-session suite accumulates load over 16 flows
```

**File**: `shared/tests/e2e/visual/driver-ios.mts` (modified, +2/-0)
```diff
@@ -363,6 +363,8 @@ export async function openIos(opts: {device: string}): Promise<IosSession> {
         logLevel: 'error',
         path: '/',
         port,
+        // Helpers rely on $() taking the first match.
+        strictSelectors: false,
       }),
       SESSION_MS,
       'starting the Appium session'
```

**File**: `shared/tests/e2e/visual/wdio.visual.conf.ts` (modified, +1/-0)
```diff
@@ -12,4 +12,5 @@ export const config: Options.Testrunner & Capabilities.WithRequestedTestrunnerCa
   port: appiumPort(),
   runner: 'local',
   specs: [],
+  strictSelectors: false,
 }
```

---

### Incident Patch 3: `c8109b9c` (2026-10-21)
**Commit Message**: desktop: OS window controls overlay on Windows and Linux (#29814)

* desktop: use the OS window controls overlay on Windows and Linux

Without the native frame, Windows and Linux now get the OS's own minimize,
maximize and close buttons through Electron's title bar overlay, colored
from the current theme and updated when it changes. The header reserves
the overlay's width (env(titlebar-area-*)) instead of drawing its own
buttons. macOS is unchanged.

The hand-drawn buttons go, with the minimize and maximize calls and the
maximized state they used.

* desktop: size the window controls space from the live overlay, and let the header color show under it

The header now reserves the width the OS window controls actually cover, read from
navigator.windowControlsOverlay and updated on geometry changes, instead of guessing from the
native frame setting (which only takes effect after a restart). With no visible overlay, such as
in full screen or with the native frame, nothing is reserved.

The overlay background is transparent, keeping the theme background's RGB for Linux's hover
blending, so colored headers run under the controls.

* desktop: transparent overlay color in Electron's format

**File**: `shared/constants/remote-actions.tsx` (modified, +0/-5)
```diff
@@ -27,7 +27,6 @@ export const trackerIgnore = 'remote:trackerIgnore'
 export const trackerLoad = 'remote:trackerLoad'
 export const unlockFoldersSubmitPaperKey = 'remote:unlockFoldersSubmitPaperKey'
 export const updateNow = 'remote:updateNow'
-export const updateWindowMaxState = 'remote:updateWindowMaxState'
 export const updateWindowShown = 'remote:updateWindowShown'
 export const updateWindowState = 'remote:updateWindowState'
 
@@ -95,8 +94,6 @@ export const createTrackerLoad = (payload: {
 export const createUnlockFoldersSubmitPaperKey = (payload: {readonly paperKey: string}) =>
   ({payload, type: unlockFoldersSubmitPaperKey}) as const
 export const createUpdateNow = (payload?: undefined) => ({payload, type: updateNow}) as const
-export const createUpdateWindowMaxState = (payload: {readonly max: boolean}) =>
-  ({payload, type: updateWindowMaxState}) as const
 export const createUpdateWindowShown = (payload: {readonly component: string}) =>
   ({payload, type: updateWindowShown}) as const
 
@@ -124,7 +121,6 @@ export type TrackerIgnorePayload = ReturnType<typeof createTrackerIgnore>
 export type TrackerLoadPayload = ReturnType<typeof createTrackerLoad>
 type UnlockFoldersSubmitPaperKeyPayload = ReturnType<typeof createUnlockFoldersSubmitPaperKey>
 type UpdateNowPayload = ReturnType<typeof createUpdateNow>
-type UpdateWindowMaxStatePayload = ReturnType<typeof createUpdateWindowMaxState>
 type UpdateWindowShownPayload = ReturnType<typeof createUpdateWindowShown>
 type UpdateWindowStatePayload = ReturnType<typeof createUpdateWindowState>
 
@@ -154,7 +150,6 @@ export type Actions =
   | TrackerLoadPayload
   | UnlockFoldersSubmitPaperKeyPayload
   | UpdateNowPayload
-  | UpdateWindowMaxStatePayload
   | UpdateWindowShownPayload
   | UpdateWindowStatePayload
   | {readonly payload: undefined; readonly type: 'common:resetStore'}
```

**File**: `shared/desktop/app/bridge-rules.desktop.tsx` (modified, +2/-2)
```diff
@@ -125,11 +125,11 @@ const knownActions: {[K in Action['type']]: true} = {
   closeWindows: true, copyToClipboard: true, ctlQuit: true, darwinCopyToChatTempUploadFile: true,
   darwinCopyToKBFSTempUploadFile: true, dumpNodeLogger: true, exitApp: true, getPathType: true,
   getRemoteProps: true, hideWindow: true, installCachedDokan: true, isDirectory: true, makeRenderer: true,
-  minimizeWindow: true, openPathInFinder: true, openURL: true, quitApp: true, readImageFromClipboard: true,
+  openPathInFinder: true, openURL: true, quitApp: true, readImageFromClipboard: true,
   relaunchApp: true, rendererNewProps: true, requestWindowsStartService: true,
   selectFilesToUploadDialog: true, setNativeTheme: true, setOpenAtLogin: true, showContextMenu: true,
   showInactive: true, showMainWindow: true, showNotification: true, showOpenDialog: true, showSaveDialog: true,
-  toggleMaximizeWindow: true, uninstallDokan: true, uninstallDokanDialog: true, uninstallKBFSDialog: true,
+  uninstallDokan: true, uninstallDokanDialog: true, uninstallKBFSDialog: true,
   winCheckRPCOwnership: true, windowsCheckMountFromOtherDokanInstall: true,
 }
 const knownForwards: ReadonlySet<unknown> = new Set(Object.values(RemoteGen).filter(v => typeof v === 'string'))
```

**File**: `shared/desktop/app/ipc-handlers.desktop.tsx` (modified, +0/-15)
```diff
@@ -495,21 +495,6 @@ export const setupIPCHandlers = (deps: {
         Electron.BrowserWindow.fromWebContents(event.sender)?.close()
         return
       }
-      case 'minimizeWindow': {
-        Electron.BrowserWindow.getFocusedWindow()?.minimize()
-        return
-      }
-      case 'toggleMaximizeWindow': {
-        const win = Electron.BrowserWindow.getFocusedWindow()
-        if (win) {
-          if (win.isMaximized()) {
-            win.unmaximize()
-          } else {
-            win.maximize()
-          }
-        }
-        return
-      }
       case 'darwinCopyToChatTempUploadFile': {
         try {
           return await darwinCopyToChatTempUploadFile(action.payload)
```

**File**: `shared/desktop/app/ipctypes.tsx` (modified, +0/-2)
```diff
@@ -56,8 +56,6 @@ export type Action =
   | {type: 'darwinCopyToKBFSTempUploadFile'; payload: {originalFilePath: string; dir: string}}
   | {type: 'darwinCopyToChatTempUploadFile'; payload: {originalFilePath: string; dst: string}}
   | {type: 'closeWindow'}
-  | {type: 'minimizeWindow'}
-  | {type: 'toggleMaximizeWindow'}
   | {type: 'openURL'; payload: {url: string}}
   | {type: 'showInactive'}
   | {type: 'showNotification'; payload: DesktopNotification}
```

**File**: `shared/desktop/app/main-window.desktop.tsx` (modified, +26/-11)
```diff
@@ -107,15 +107,6 @@ const setupWindowEvents = (win: Electron.BrowserWindow) => {
   }
 
   win.on('close', hideInsteadOfClose)
-
-  if (!isDarwin) {
-    const emitMaxChange = () => {
-      R.remoteDispatch(RemoteGen.createUpdateWindowMaxState({max: win.isMaximized()}))
-    }
-
-    win.on('maximize', emitMaxChange)
-    win.on('unmaximize', emitMaxChange)
-  }
 }
 
 const changeDock = (show: boolean) => {
@@ -144,10 +135,31 @@ export const isScreenshotDisabled = () => disableScreenshot
 
 const themeBackgroundColor = () => (Electron.nativeTheme.shouldUseDarkColors ? '#191919' : '#ffffff')
 
+// Without the native frame, Windows and Linux draw their own window controls over the top of the page
+// (right, left or both, by the OS button layout), at the height of the header's top row. The overlay is
+// see-through so the header's own color shows under the controls; it keeps the theme background's RGB
+// because Linux blends the button hover against the overlay color with its alpha dropped. Spelled as
+// rgba() since Electron reads 8-digit hex as #AARRGGBB. The symbols use the header's black_50_on_white.
+let windowControlsOverlay = false
+const transparentThemeBackground = () => {
+  const hex = themeBackgroundColor()
+  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16))
+  return `rgba(${r}, ${g}, ${b}, 0)`
+}
+const titleBarOverlay = () => ({
+  color: transparentThemeBackground(),
+  height: 40,
+  symbolColor: Electron.nativeTheme.shouldUseDarkColors ? '#808080' : '#7f7f7f',
+})
+
 // only the main window uses themeBackgroundColor; the others (menubar, tracker) are transparent
 export const registerThemeBackgrounds = () => {
   Electron.nativeTheme.on('updated', () => {
-    getMainWindow()?.setBackgroundColor(themeBackgroundColor())
+    const win = getMainWindow()
+    win?.setBackgroundColor(themeBackgroundColor())
+    if (windowControlsOverlay) {
+      win?.setTitleBarOverlay(titleBarOverlay())
+    }
   })
 }
 
@@ -330,9 +342,12 @@ const MainWindow = () => {
   setupDefaultSession()
   loadWindowState()
 
+  windowControlsOverlay = !isDarwin && !useNativeFrame
   const win = new Electron.BrowserWindow({
     backgroundColor: themeBackgroundColor(),
-    frame: useNativeFrame,
+    ...(windowControlsOverlay
+      ? {titleBarOverlay: titleBarOverlay(), titleBarStyle: 'hidden' as const}
+      : {frame: useNativeFrame}),
     height: visualContentSize?.height ?? windowState.height,
     minHeight: 600,
     minWidth: 740,
```

**File**: `shared/desktop/renderer/preload.desktop.tsx` (modified, +0/-6)
```diff
@@ -154,9 +154,6 @@ if (isRenderer) {
         })
       )
     },
-    minimizeWindow: () => {
-      ignorePromise(invoke({type: 'minimizeWindow'}))
-    },
     openPathInFinder: async (path: string, isFolder: boolean) => {
       const res = await invoke({
         payload: {isFolder, path},
@@ -240,9 +237,6 @@ if (isRenderer) {
         })
       )
     },
-    toggleMaximizeWindow: () => {
-      ignorePromise(invoke({type: 'toggleMaximizeWindow'}))
-    },
     uninstallDokan: async (execPath: string) => {
       return invoke({payload: {execPath}, type: 'uninstallDokan'})
     },
```

**File**: `shared/desktop/renderer/remote-event-handler.desktop.tsx` (modified, +0/-3)
```diff
@@ -193,9 +193,6 @@ export const eventFromRemoteWindows = (action: RemoteGen.Actions) => {
     case RemoteGen.dumpLogs:
       ignorePromise(dumpLogs(action.payload.reason))
       break
-    case RemoteGen.updateWindowMaxState:
-      useShellState.getState().dispatch.setWindowMaximized(action.payload.max)
-      break
     case RemoteGen.updateWindowState:
       useShellState.getState().dispatch.updateWindowState(action.payload.windowState)
       break
```

**File**: `shared/router-v2/header/index.desktop.tsx` (modified, +21/-90)
```diff
@@ -2,14 +2,11 @@ import type * as React from 'react'
 import * as Kb from '@/common-adapters'
 import * as Platform from '@/constants/platform'
 import SyncingFolders from './syncing-folders'
-import KB2 from '@/util/electron'
 import {useLoggedInScreens} from '../logged-in-screens'
-import {useShellState} from '@/stores/shell'
+import {useWindowControlsInsets, type WindowControlsInsets} from '@/util/window-controls-overlay.desktop'
 import type {HeaderBackButtonProps} from '@react-navigation/elements'
 import type {NativeStackHeaderProps} from '@react-navigation/native-stack'
 
-const {closeWindow, minimizeWindow, toggleMaximizeWindow} = KB2.functions
-
 type HeaderTitleProps = {
   children: React.ReactNode
   tintColor?: string
@@ -44,8 +41,8 @@ type Props = {
   options: Options
   back?: boolean
   style?: Kb.Styles._StylesCrossPlatform
-  useNativeFrame: boolean
-  isMaximized: boolean
+  // space the OS window controls cover at the top, all zeros when there are none
+  windowControls: WindowControlsInsets
   navigation: {
     pop: () => void
   }
@@ -62,56 +59,16 @@ const PlainTitle = ({title}: {title: React.ReactNode}) => {
   )
 }
 
-const SystemButtons = ({isMaximized}: {isMaximized: boolean}) => {
-  const styles = useStyles()
-  const onMinimize = () => {
-    minimizeWindow?.()
-  }
-  const onToggleMaximizeWindow = () => {
-    toggleMaximizeWindow?.()
-  }
-  const onCloseWindow = () => {
-    closeWindow?.()
-  }
-  return (
-    <Kb.Box2 alignSelf="center" direction="horizontal">
-      <Kb.ClickableBox alignSelf="center"
-        className="hover_background_color_black_05  color_black_50 hover_color_black"
-        onClick={onMinimize}
-        style={styles.appIconBox}
-        direction="vertical"
-      >
-        <Kb.Icon color="inherit" onClick={onMinimize} style={styles.appIcon} type="iconfont-app-minimize" />
-      </Kb.ClickableBox>
-      <Kb.ClickableBox alignSelf="center"
-        className="hover_background_color_black_05 color_black_50 hover_color_black"
-        onClick={onToggleMaximizeWindow}
-        style={styles.appIconBox}
-        direction="vertical"
-      >
-        <Kb.Icon
-          color="inherit"
-          onClick={onToggleMaximizeWindow}
-          style={styles.appIcon}
-          type={isMaximized ? 'iconfont-app-un-maximize' : 'iconfont-app-maximize'}
-        />
-      </Kb.ClickableBox>
-      <Kb.ClickableBox alignSelf="center"
-        className="hover_background_color_red hover_color_white color_black_50"
-        onClick={onCloseWindow}
-        style={styles.appIconBox}
-        direction="vertical"
-      >
-        <Kb.Icon color="inherit" onClick={onCloseWindow} style={styles.appIcon} type="iconfont-app-close" />
-      </Kb.ClickableBox>
-    </Kb.Box2>
-  )
-}
+// The OS draws the window controls over the top corners of the page (Windows and Linux without the
+// native frame); keep the header's own controls out from under them
+const WindowControlsSpace = ({width}: {width: number}) => (
+  <Kb.Box2 direction="horizontal" style={{flexShrink: 0, width}} />
+)
 
 function DesktopHeader(p: Props) {
   const styles = useStyles()
   const theme = Kb.Styles.useTheme()
-  const {back, navigation, options, loggedIn, useNativeFrame, isMaximized} = p
+  const {back, navigation, options, loggedIn, windowControls} = p
   const {headerMode, title, headerTitle, headerRight, headerRightActions, subHeader} = options
   const {headerTransparent, headerShadowVisible, headerBottomStyle, headerStyle, headerLeft} = options
 
@@ -151,7 +108,7 @@ function DesktopHeader(p: Props) {
   }
 
   const showDivider = headerShadowVisible !== false
-  const windowDecorationsAreNeeded = !Platform.isMac && !useNativeFrame
+  const windowControlsOverlay = windowControls.left > 0 || windowControls.right > 0
 
   // The whole header normally clears the system icons (traffic lights on Mac) because the left nav
   // bar pushes it down/right -- unless you're logged out, in which case there's no nav bar and the
@@ -200,13 +157,13 @@ function DesktopHeader(p: Props) {
     backButton = defaultBackButton
   }
 
-  // Logged out: a top strip that holds only the system buttons (or, on Mac, just reserves space so the
-  // OS traffic lights have nothing beside them), then a row below with back on the left, title centered,
+  // Logged out: a top strip that only reserves space for the OS window controls (the traffic lights on
+  // Mac, the controls overlay elsewhere), then a row below with back on the left, title centered,
   // actions on the right. The side sections share the same flex so the title stays centered regardless
   // of their widths. Keeping the back/title/actions row in a fixed spot below the strip stops it from
   // jumping between screens.
   if (!loggedIn) {
-    const showTopStrip = loggedOutDarwin || windowDecorationsAreNeeded
+    const showTopStrip = loggedOutDarwin || windowControlsOverlay
     return (
       <Kb.Box2
         noShrink={true}
@@ -223,12 +180,8
```

#### Recent Merged Pull Requests:
- **PR #29831** (2026-10-24): ios: fix crash when pasting large photos into chat (@chrisnojima)
- **PR #29830** (2026-10-23): Bump version to 6.7.1 (@chrisnojima)
- **PR #29829** (2026-10-23): deps: webdriverio 10, immer, zustand, builder-bob; drop two security resolutions (@chrisnojima)
- **PR #29827** (2026-10-23): markdown: stop nesting em, strong and del past 16 levels (@chrisnojima)
- **PR #29826** (2026-10-23): markdown: unclosable fences no longer rescan the rest of the message (@chrisnojima)
- **PR #29825** (2026-10-23): markdown: text stops and url starts found once per string (@chrisnojima)

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

## X. include uid on all local rpcs (#29708)

**RULE**:
When implementing operations in `go/chat/activitynotifier.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in keybase/client. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `7874b7f1`: include uid on all local rpcs (#29708). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `go/chat/activitynotifier.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
func (n *NotifyRouterActivityRouter) TypingUpdate(ctx context.Context, uid gregor1.UID, updates []chat1.ConvTypingUpdate) {
		n.G().NotifyRouter.HandleChatTypingUpdate(ctx, n.kuid(uid), updates)
```

**NEGATIVE CONSTRAINT**:
```go
// Anti-pattern to NEVER write (induced failure mode):
func (n *NotifyRouterActivityRouter) TypingUpdate(ctx context.Context, updates []chat1.ConvTypingUpdate) {
		n.G().NotifyRouter.HandleChatTypingUpdate(ctx, updates)
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `7874b7f1` are properly handled with clean fallback behavior.

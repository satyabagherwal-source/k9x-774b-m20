# Forensic Learning Record (Deep Inspection): keybase/client

> **Canonical Artifact**: `07_PROJECT_LEARNING/keybase-client-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/keybase/client](https://github.com/keybase/client))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T01:59:44.523Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `keybase/client`
- **Description**: Keybase Go Library, Client, Service, OS X, iOS, Android, Electron
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 9257 stars

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

### Core Architecture Module: `go/chat/utils/collapses.go`
```
package utils

import (
	"context"
	"fmt"
	"time"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/clockwork"
)

type singleCollapseRecord struct {
	Collapsed bool
	Time      time.Time
}

type rangeCollapseRecord struct {
	Collapsed bool
	MsgID     chat1.MessageID
	Time      time.Time
}

type Collapses struct {
	globals.Contextified
	DebugLabeler

	clock clockwork.Clock
}

func NewCollapses(g *globals.Context) *Collapses {
	return &Collapses{
		Contextified: globals.NewContextified(g),
		DebugLabeler: NewDebugLabeler(g.ExternalG(), "Utils.Collapses", false),
		clock:        clockwork.NewRealClock(),
	}
}

func (c *Collapses) singleKey(uid gregor1.UID, convID chat1.ConversationID, msgID chat1.MessageID) libkb.DbKey {
	return libkb.DbKey{
		Typ: libkb.DBChatCollapses,
		Key: fmt.Sprintf("single:%s:%s:%d", uid, convID, msgID),
	}
}

func (c *Collapses) rangeKey(uid gregor1.UID, convID chat1.ConversationID) libkb.DbKey {
	return libkb.DbKey{
		Typ: libkb.DBChatCollapses,
		Key: fmt.Sprintf("range:%s:%s", uid, convID),
	}
}

func (c *Collapses) ToggleSingle(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	msgID chat1.MessageID, collapsed bool,
) error {
	key := c.singleKey(uid, convID, msgID)
	return c.G().GetKVStore().PutObj(key, nil, singleCollapseRecord{
		Collapsed: collapsed,
		Time:      c.clock.Now(),
	})
}

func (c *Collapses) ToggleRange(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	msgID chat1.MessageID, collapsed bool,
) error {
	key := c.rangeKey(uid, convID)
	return c.G().GetKVStore().PutObj(key, nil, rangeCollapseRecord{
		Collapsed: collapsed,
		MsgID:     msgID,
		Time:      c.clock.Now(),
	})
}

func (c *Collapses) IsCollapsed(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID,
	msgID chat1.MessageID, msgType chat1.MessageType,
) bool {
	if !IsCollapsibleMessageType(msgType) {
		return false
	}
	singleKey := c.singleKey(uid, convID, msgID)
	rangeKey := c.rangeKey(uid, convID)
	// Get both to see which one takes precedence in time order
	var singleRec singleCollapseRecord
	var rangeRec rangeCollapseRecord
	singleFound, err := c.G().GetKVStore().GetInto(&singleRec, singleKey)
	if err != nil {
		c.Debug(ctx, "IsCollapsed: failed to read single record: %s", err)
		singleFound = false
	}
	rangeFound, err := c.G().GetKVStore().GetInto(&rangeRec, rangeKey)
	if err != nil {
		c.Debug(ctx, "IsCollapsed: failed to read range record: %s", err)
		rangeFound = false
	}
	if singleFound && !rangeFound {
		return singleRec.Collapsed
	} else if !singleFound && rangeFound {
		if msgID <= rangeRec.MsgID {
			return rangeRec.Collapsed
		}
		return false
	} else if !singleFound && !rangeFound {
		return false
	} else if singleFound && rangeFound {
		if singleRec.Time.After(rangeRec.Time) {
			return singleRec.Collapsed
		}
		if msgID <= rangeRec.MsgID {
			return rangeRec.Collapsed
		}
		return false
	}
	return false
}

```

### Core Architecture Module: `go/chat/utils/dummy_chat_ui.go`
```
package utils

import (
	"context"

	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/keybase1"
)

type DummyChatUI struct{}

var _ chat1.ChatUiInterface = (*DummyChatUI)(nil)

func (r DummyChatUI) ChatInboxConversation(ctx context.Context, arg chat1.ChatInboxConversationArg) error {
	return nil
}

func (r DummyChatUI) ChatInboxFailed(ctx context.Context, arg chat1.ChatInboxFailedArg) error {
	return nil
}

func (r DummyChatUI) ChatInboxUnverified(ctx context.Context, arg chat1.ChatInboxUnverifiedArg) error {
	return nil
}

func (r DummyChatUI) ChatInboxLayout(ctx context.Context, arg chat1.ChatInboxLayoutArg) error {
	return nil
}

func (r DummyChatUI) ChatThreadCached(ctx context.Context, arg chat1.ChatThreadCachedArg) error {
	return nil
}

func (r DummyChatUI) ChatThreadFull(ctx context.Context, arg chat1.ChatThreadFullArg) error {
	return nil
}

func (r DummyChatUI) ChatThreadStatus(ctx context.Context, arg chat1.ChatThreadStatusArg) error {
	return nil
}

func (r DummyChatUI) ChatConfirmChannelDelete(ctx context.Context, arg chat1.ChatConfirmChannelDeleteArg) (bool, error) {
	return true, nil
}

func (r DummyChatUI) ChatSearchHit(ctx context.Context, arg chat1.ChatSearchHitArg) error {
	return nil
}

func (r DummyChatUI) ChatSearchDone(ctx context.Context, arg chat1.ChatSearchDoneArg) error {
	return nil
}

func (r DummyChatUI) ChatSearchInboxStart(ctx context.Context, sessionID int) error {
	return nil
}

func (r DummyChatUI) ChatSearchInboxHit(ctx context.Context, arg chat1.ChatSearchInboxHitArg) error {
	return nil
}

func (r DummyChatUI) ChatSearchInboxDone(ctx context.Context, arg chat1.ChatSearchInboxDoneArg) error {
	return nil
}

func (r DummyChatUI) ChatSearchIndexStatus(ctx context.Context, arg chat1.ChatSearchIndexStatusArg) error {
	return nil
}

func (r DummyChatUI) ChatSearchConvHits(ctx context.Context, arg chat1.ChatSearchConvHitsArg) error {
	return nil
}

func (r DummyChatUI) ChatSearchTeamHits(ctx context.Context, arg chat1.ChatSearchTeamHitsArg) error {
	return nil
}

func (r DummyChatUI) ChatSearchBotHits(ctx context.Context, arg chat1.ChatSearchBotHitsArg) error {
	return nil
}

func (r DummyChatUI) ChatStellarDataConfirm(ctx context.Context, arg chat1.ChatStellarDataConfirmArg) (bool, error) {
	return true, nil
}

func (r DummyChatUI) ChatStellarShowConfirm(ctx context.Context, sessionID int) error {
	return nil
}

func (r DummyChatUI) ChatStellarDataError(ctx context.Context, arg chat1.ChatStellarDataErrorArg) (bool, error) {
	return true, nil
}

func (r DummyChatUI) ChatStellarDone(ctx context.Context, arg chat1.ChatStellarDoneArg) error {
	return nil
}

func (r DummyChatUI) ChatGiphySearchResults(ctx context.Context, arg chat1.ChatGiphySearchResultsArg) error {
	return nil
}

func (r DummyChatUI) ChatGiphyToggleResultWindow(ctx context.Context,
	arg chat1.ChatGiphyToggleResultWindowArg,
) error {
	return nil
}

func (r DummyChatUI) ChatShowManageChannels(ctx context.Context, arg chat1.ChatShowManageChannelsArg) error {
	return nil
}

func (r DummyChatUI) ChatCoinFlipStatus(ctx context.Context, arg chat1.ChatCoinFlipStatusArg) error {
	return nil
}

func (r DummyChatUI) ChatCommandMarkdown(ctx context.Context, arg chat1.ChatCommandMarkdownArg) error {
	return nil
}

func (r DummyChatUI) ChatMaybeMentionUpdate(ctx context.Context, arg chat1.ChatMaybeMentionUpdateArg) error {
	return nil
}

func (r DummyChatUI) ChatLoadGalleryHit(ctx context.Context, arg chat1.ChatLoadGalleryHitArg) error {
	return nil
}

func (r DummyChatUI) ChatWatchPosition(context.Context, chat1.ChatWatchPositionArg) (chat1.LocationWatchID, error) {
	return chat1.LocationWatchID(0), nil
}

func (r DummyChatUI) ChatClearWatch(context.Context, chat1.ChatClearWatchArg) error {
	return nil
}

func (r DummyChatUI) ChatCommandStatus(context.Context, chat1.ChatCommandStatusArg) error {
	return nil
}

func (r DummyChatUI) ChatBotCommandsUpdateStatus(context.Context, chat1.ChatBotCommandsUpdateStatusArg) error {
	return nil
}

func (r DummyChatUI) TriggerContactSync(context.Context, int) error {
	return nil
}

type DummyChatNotifications struct{}

var _ chat1.NotifyChatInterface = (*DummyChatNotifications)(nil)

func (d DummyChatNotifications) NewChatActivity(ctx context.Context, arg chat1.NewChatActivityArg) error {
	return nil
}

func (d DummyChatNotifications) ChatIdentifyUpdate(context.Context, keybase1.CanonicalTLFNameAndIDWithBreaks) error {
	return nil
}

func (d DummyChatNotifications) ChatTLFFinalize(context.Context, chat1.ChatTLFFinalizeArg) error {
	return nil
}

func (d DummyChatNotifications) ChatTLFResolve(context.Context, chat1.ChatTLFResolveArg) error {
	return nil
}
func (d DummyChatNotifications) ChatInboxStale(context.Context, keybase1.UID) error { return nil }
func (d DummyChatNotifications) ChatThreadsStale(context.Context, chat1.ChatThreadsStaleArg) error {
	return nil
}

func (d DummyChatNotifications) ChatTypingUpdate(context.Context, []chat1.ConvTypingUpdate) error {
	return nil
}

func (d DummyChatNotifications) ChatJoinedConversation(context.Context, chat1.ChatJoinedConversationArg) error {
	return nil
}

func (d DummyChatNotifications) ChatLeftConversation(context.Context, chat1.ChatLeftConversationArg) error {
	return nil
}

func (d DummyChatNotifications) ChatResetConversation(context.Context, chat1.ChatResetConversationArg) error {
	return nil
}

func (d DummyChatNotifications) ChatInboxSyncStarted(context.Context, keybase1.UID) error {
	return nil
}

func (d DummyChatNotifications) ChatInboxSynced(context.Context, chat1.ChatInboxSyncedArg) error {
	return nil
}

func (d DummyChatNotifications) ChatSetConvRetention(context.Context, chat1.ChatSetConvRetentionArg) error {
	return nil
}

func (d DummyChatNotifications) ChatSetTeamRetention(context.Context, chat1.ChatSetTeamRetentionArg) error {
	return nil
}

func (d DummyChatNotifications) ChatSetConvSettings(context.Context, chat1.ChatSetConvSettingsArg) error {
	return nil
}

func (d DummyChatNotifications) ChatSubteamRename(context.Context, chat1.ChatSubteamRenameArg) error {
	return nil
}

func (d DummyChatNotifications) ChatKBFSToImpteamUpgrade(context.Context, chat1.ChatKBFSToImpteamUpgradeArg) error {
	return nil
}

func (d DummyChatNotifications) ChatAttachmentUploadStart(context.Context, chat1.ChatAttachmentUploadStartArg) error {
	return nil
}

func (d DummyChatNotifications) ChatAttachmentUploadProgress(context.Context, chat1.ChatAttachmentUploadProgressArg) error {
	return nil
}

func (d DummyChatNotifications) ChatAttachmentDownloadProgress(context.Context, chat1.ChatAttachmentDownloadProgressArg) error {
	return nil
}

func (d DummyChatNotifications) ChatAttachmentDownloadComplete(context.Context, chat1.ChatAttachmentDownloadCompleteArg) error {
	return nil
}

func (d DummyChatNotifications) ChatArchiveProgress(context.Context, chat1.ChatArchiveProgressArg) error {
	return nil
}

func (d DummyChatNotifications) ChatArchiveComplete(context.Context, chat1.ArchiveJobID) error {
	return nil
}

func (d DummyChatNotifications) ChatPaymentInfo(context.Context, chat1.ChatPaymentInfoArg) error {
	return nil
}

func (d DummyChatNotifications) ChatRequestInfo(context.Context, chat1.ChatRequestInfoArg) error {
	return nil
}

func (d DummyChatNotifications) ChatPromptUnfurl(context.Context, chat1.ChatPromptUnfurlArg) error {
	return nil
}

func (d DummyChatNotifications) ChatConvUpdate(context.Context, chat1.ChatConvUpdateArg) error {
	return nil
}

func (d DummyChatNotifications) ChatWelcomeMessageLoaded(context.Context, chat1.ChatWelcomeMessageLoadedArg) error {
	return nil
}

func (d DummyChatNotifications) ChatParticipantsInfo(context.Context,
	map[chat1.ConvIDStr][]chat1.UIParticipant,
) error {
	return nil
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
  > `keybase reset` should definitely be nuking the keychain entry. 

- **Issue #1006** (2015-09-25): **Separate services by build flag on Linux**
  *Symptoms*: On OS X, you can run a `keybase service` and a `kbstage service` at the same time and the sockets will live in different directories and everything works as you'd expect.  On Linux, if you run `keybase service` in one window and `kbstage id cjb` in another, the `keybase` service will answer the kbstage client's request.  But a kbstage service should be doing so instead.  It's because the socket filename doesn't change based on build tags.  It's currently `$XDG_RUNTIME_DIR/keybased.sock`, I suggest `$XDG_RUNTIME_DIR/keybased-{RunMode}.sock`.  @oconnor663, @patrickxb? 
  **Post-Mortem & Fix Analysis**:
  > Note: We should add "run `killall keybase` after installing this" to the Linux changelog, because this change will disconnect the new client (looking for `keybased-staging.*`) from the old service (running at `keybased.*` and with an open lock on the DB). 
  > Do the linux packages stop existing service already on install? 

- **Issue #997** (2015-09-25): **GpgCLI caching failures in daemon**
  *Symptoms*: Configure() caches failures in the daemon.  They last until the daemon restarts.  So if it can't find gpg, it saves that information.  And if the user subsequently installs gpg, it won't look for it.  At the very least, don't cache failures.  But since gpg used infrequently, how about not caching the configuration at all?  cc @cjb @oconnor663 @maxtaco  
  **Post-Mortem & Fix Analysis**:
  > +1 for not having any caching in gpg_cli's Configure() 
  > Ok with me!  On Thursday, September 24, 2015, Chris Ball notifications@github.com wrote:  > +1 for not having any caching in gpg_cli's Configure() >  > — > Reply to this email directly or view it on GitHub > https://github.com/keybase/client/issues/997#issuecomment-143054031. 

- **Issue #945** (2015-09-22): **Panic on PGP verify**
  *Symptoms*: Steps to reproduce:  cat > foo.signed  ``` -----BEGIN PGP MESSAGE----- Comment: https://keybase.io/download Version: Keybase Go 1.0.0 (linux)  xA0DAAoBhxfw9BtMXbgBy+F0AOIAAAAA4mhlbGzhbG/gCgDCwVwEAAEKABAFAlX5 xocJEIcX8PQbTF24AAClshAAUf7rreA8g0OAuCQO9ayGnB83fRj3Hybye3j6u6S3 FEOhqDycfgi6lZbvBPQ/etZp4W7Ci/7w/TJi+7WtrDrZrCA/P1J2b6HGwFYpXU1H BT3DM4vMQ9+UZO8MVH1HcXFzH0fJ6JKt8oJDg4r2W1yqvsP9tjlRt1EKaRWYsNX0 WKFIXpASYVdBteZkUsDXmSSO3FQI786Ly2xXFitqzQNUVOAakZv60Vc6BrNg8bJI vcWInEXR8jTBow8xiSBNeYITdM49dXJCwkxn5zQKuQaYcODg3JpiTK037huo8XHP tiNv4F2rAWWEM3PehL0Tw/BSgoIF6OeagTpeD3ht+vX684f64wfebXzBeeVet3h2 KXyzlc1/wok/kdQuh1W8gTJ7rDECnoKuu3ju0QAmYbg/gSCjyrvsBFYRLu58lSj+ 5nUI9vyphU+gcEkg6JW+lFx8gkkwy9yhSukpQHLgWMwSr4o6usi5g8p1cMJeCNA5 hT7Y4nSuv2XG5+0xAfOnKgus5jDJhhgkNzc0SotaV4XGwhog8l7EBISyxZkoDEMt Kuj/1v6BXLng3HudfZyDrdwpB7NVWZY+YMojKPKqE8dD4QB95cR+LRNiVHAqK3FL dva5k0lEzptli+jj7D2mBnU9/5BDchISng0aWN0SaTx8gSkRk/ldM26t99ISkhD5 wn4= =GY62 -----END PGP MESSAGE----- ```  keybase pgp verify < foo.signed  Client output:  ``` ▶ WARNING Running in devel mode ▶ WARNING key id 9734514050805292472 (8717f0f41b4c5db8) => ,  ▶ ERROR EOF from server ```  Server output:  ``` keybase --local-rpc-debug-unsafe=csv -d service 10:33:06.959768 ▶ [DEBU keybase json.go:30] 001 + loading config file: /home/cjb/.config/keybase.devel/config.json 10:33:06.959975 ▶ [DEBU keybase json.go:60] 002 - successfully loaded config file 10:33:06.960057 ▶ [DEBU keybase config.go:111] 003 Config: mapping server ->  10:33:06.960233 

- **Issue #935** (2015-10-26): **seqno after retrack**
  *Symptoms*: When running `while true; do go test -run TestTrackRetrack && keybase list-trackers t_alice | wc -l; done`, I'm getting crashes about 10% of the test runs with:  ```     track_test.go:228: seqno after retrack: 6, expected 5 ```  Seems like it could be an artifact of running this test on its own, I guess? 

- **Issue #927** (2015-09-21): **Autofork making a new daemon each time the client runs**
  *Symptoms*: ``` cjb@caius:~$ killall keybase cjb@caius:~$ ps awfux | grep "keybase " cjb      30688  0.0  0.0  13688  2196 pts/20   S+   13:31   0:00          |   |       \_ grep --color=auto keybase  cjb@caius:~$ keybase list-trackers chris ▶ WARNING Running in devel mode ▶ INFO | Setting run directory for keybase service to /run/user/1000 ▶ INFO Forking background server with pid=30695 ▶ WARNING Error closing pid file: invalid argument  ▶ ERROR chris: user not found (error 205) cjb@caius:~$ ps awfux | grep "keybase " cjb      30706  0.0  0.0  13688  2256 pts/20   S+   13:31   0:00          |   |       \_ grep --color=auto keybase  cjb      30695  0.0  0.0 153900 15992 ?        Ssl  13:31   0:00          \_ /home/cjb/gopath/bin/keybase service --chdir /run/user/1000 cjb@caius:~$ keybase list-trackers chris ▶ WARNING Running in devel mode ▶ INFO | Setting run directory for keybase service to /run/user/1000 ▶ INFO Forking background server with pid=30713 ▶ WARNING Error closing pid file: invalid argument  ▶ ERROR chris: user not found (error 205) cjb@caius:~$ ps awfux | grep "keybase " cjb      30721  0.0  0.0  13688  2148 pts/20   S+   13:31   0:00          |   |       \_ grep --color=auto keybase  cjb      30695  0.0  0.0 153900 15992 ?        Ssl  13:31   0:00          \_ /home/cjb/gopath/bin/keybase service --chdir /run/user/1000 cjb      30713  0.0  0.0 136196 16200 ?        Ssl  13:31   0:00          \_ /home/cjb/gopath/bin/keybase service --chdir /run/user/1000 cjb@caius:~$  ``` 

- **Issue #914** (2015-09-21): **list-trackers t_alice returns "no trackers"**
  *Symptoms*: On localhost:3000/t_alice, she has 323. 
  **Post-Mortem & Fix Analysis**:
  > Update:  Each test run adds one track.  The specific test is TestTrackRetrack.  I couldn't reproduce the bug at first, but I only had a few trackers and wanted to get up to Patrick's 323.  So I ran:  ``` while true; do go test -run TestTrackRetrack && keybase list-trackers t_alice | wc -l; done ```  and I saw:  48 49 50 1  (The "1" is the line "no trackers".)  So we have a 50 tracker limit on the go client!  Weird, I wonder where it comes from, will try to figure it out, Patrick's giving me a hand. 
  > might come from the server-side?  On Mon, Sep 21, 2015 at 12:17 PM, Chris Ball notifications@github.com wrote:  > Update: >  > Each test run adds one track. The specific test is TestTrackRetrack. I > couldn't reproduce the bug at first, but I only had a few trackers and > wanted to get up to Patrick's 323. So I ran: >  > while true; do go test -run TestTrackRetrack && keybase list-trackers t_alice | wc -l; done >  > and I saw: >  > 48 > 49 > 50 > 1 >  > (The "1" is the line "no trackers".) >  > So we have a 50 tracker limit on the go client! Weird, I wonder where it > comes from, will try to figure it out, Patrick's giving me a hand. >  > — > Reply to this email directly or view it on GitHub > https://github.com/keybase/client/issues/914#issuecomment-142031877. 
  > (as a result of pagination?)  On Mon, Sep 21, 2015 at 12:57 PM, Maxwell Krohn themax@gmail.com wrote:  > might come from the server-side? >  > On Mon, Sep 21, 2015 at 12:17 PM, Chris Ball notifications@github.com > wrote: >  > > Update: > >  > > Each test run adds one track. The specific test is TestTrackRetrack. I > > couldn't reproduce the bug at first, but I only had a few trackers and > > wanted to get up to Patrick's 323. So I ran: > >  > > while true; do go test -run TestTrackRetrack && keybase list-trackers t_alice | wc -l; done > >  > > and I saw: > >  > > 48 > > 49 > > 50 > > 1 > >  > > (The "1" is the line "no trackers".) > >  > > So we have a 50 tracker limit on the go client! Weird, I wonder where it > > comes from, will try to figure it out, Patrick's giving me a hand. > >  > > — > > Reply to this email directly or view it on GitHub > > https://github.com/keybase/client/issues/914#issuecomment-142031877. 

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

### Incident Patch 1: `739c398e` (2026-10-02)
**Commit Message**: fix(chat): the app chooses the selected conversation; leaving and account switch keep it right (#29719)

One module decides which conversation is selected, and reacts when the open conversation is left, removed or reset, or the account switches. The service's left and reset notifications are enabled and routed to it, a left conversation gets its own membership type, and thread loads that find the user no longer in a conversation hand it over instead of navigating directly. The engine listener bus no longer clears itself on a store reset, because screens stay mounted across an account switch. Tests cover selection after a switch, reselection and the layout state.

**File**: `protocol/bin/enabled-calls.json` (modified, +2/-0)
```diff
@@ -10,10 +10,12 @@
   "chat.1.NotifyChat.ChatInboxStale": {"incoming":true},
   "chat.1.NotifyChat.ChatInboxSyncStarted": {"incoming":true},
   "chat.1.NotifyChat.ChatInboxSynced": {"incoming":true},
+  "chat.1.NotifyChat.ChatLeftConversation": {"incoming":true},
   "chat.1.NotifyChat.ChatParticipantsInfo": {"incoming":true},
   "chat.1.NotifyChat.ChatPaymentInfo": {"incoming":true},
   "chat.1.NotifyChat.ChatPromptUnfurl": {"incoming":true},
   "chat.1.NotifyChat.ChatRequestInfo": {"incoming":true},
+  "chat.1.NotifyChat.ChatResetConversation": {"incoming":true},
   "chat.1.NotifyChat.ChatSetConvRetention": {"incoming":true},
   "chat.1.NotifyChat.ChatSetConvSettings": {"incoming":true},
   "chat.1.NotifyChat.ChatSetTeamRetention": {"incoming":true},
```

**File**: `shared/chat/conversation/messages/cards/team-journey/container.tsx` (modified, +1/-0)
```diff
@@ -63,6 +63,7 @@ const TeamJourneyConnected = (ownProps: OwnProps) => {
   const joinableStatuses = new Set<T.Chat.ConversationMeta['membershipType']>([
     // keep in sync with journey_card_manager.go
     'notMember' as const,
+    'youLeft' as const,
     'youAreReset' as const,
   ])
   const otherChannelsBase = [...channelMetas.values()]
```

**File**: `shared/chat/conversation/thread-load.tsx` (modified, +12/-4)
```diff
@@ -3,7 +3,6 @@ import * as Message from '@/constants/chat/message'
 import * as Meta from '@/constants/chat/meta'
 import * as Strings from '@/constants/strings'
 import * as T from '@/constants/types'
-import {navigateToInbox} from '@/constants/router'
 import logger from '@/logger'
 import {ignorePromise} from '@/constants/utils'
 import {RPCError} from '@/util/errors'
@@ -13,6 +12,7 @@ import {useCurrentUserState} from '@/stores/current-user'
 import {useConfigState} from '@/stores/config'
 import {type ThreadLoadReconcile, getOrdinalForMessageID} from './thread-message-state'
 import {getInboxConversationMeta, updateInboxConversationMeta} from '@/chat/inbox/metadata'
+import {conversationGone} from '@/chat/inbox/selection'
 import type {ChatThreadRpc} from './chat-rpc'
 import type {
   ConversationThreadActions,
@@ -454,12 +454,20 @@ export const loadConversationThreadMessages = (
       }
       if (error instanceof RPCError) {
         logger.warn(`loadMoreMessages: error: ${error.desc}`)
-        if (error.code === T.RPCGen.StatusCode.scchatnotinteam) {
-          // We're no longer in this conv's team. Clear the persisted last-route
+        if (
+          error.code === T.RPCGen.StatusCode.scchatnotinteam ||
+          error.code === T.RPCGen.StatusCode.scchatnotinconv
+        ) {
+          // We're not in this conv or its team. Clear the persisted last-route
           // (ui.routeState2) so app startup doesn't keep restoring and reloading
           // this conv, which would re-trigger this error on every launch.
           persistRoute(true, true, () => useConfigState.getState().startup.loaded)
-          navigateToInbox(true, 'maybeKickedFromTeam')
+          // Only a conversation this account was in is gone (kicked, removed). One it never joined,
+          // opened from a link or search, stays up on every platform, as does a phone's open thread.
+          const membership = getInboxConversationMeta(conversationIDKey)?.membershipType
+          if (membership === 'active' || membership === 'youLeft') {
+            conversationGone(conversationIDKey, `thread load: ${error.desc}`)
+          }
         }
         if (error.code !== T.RPCGen.StatusCode.scteamreaderror) {
           throw error
```

**File**: `shared/chat/inbox/auto-select-after-switch.test.tsx` (added, +427/-0)
```diff
@@ -0,0 +1,427 @@
+/** @jest-environment jsdom */
+/// <reference types="jest" />
+// The chat tab's automatic selection on the split (desktop) layout, driven through the real config,
+// current-user, inbox layout and metadata stores, the real chat notification path and the real
+// thread load against a fake service. The GUI owns the selection: the split shell fills an empty
+// one, a layout's reselectInfo replaces only a selection that is empty or unknown to this account,
+// and a selection that is gone (left, removed, reset, not in it, removed from the inbox) moves to
+// the newest conversation. None of them may replace a conversation the user picked and can see.
+jest.mock('@/chat/conversation/container', () => ({__esModule: true, default: () => null}))
+jest.mock('@/chat/conversation/info-panel', () => ({__esModule: true, default: () => null}))
+
+import * as Meta from '@/constants/chat/meta'
+import * as T from '@/constants/types'
+import RPCError from '@/util/rpcerror'
+import {act, cleanup, render} from '@testing-library/react'
+import {getSelectedConversation} from '@/constants/chat/common'
+import {navigateToThread} from '@/constants/router'
+import {InboxAndConversationShell} from '@/chat/inbox-and-conversation-shared'
+import {routeChatNotification, type ChatNotification} from '@/chat/notification-router'
+import {loadConversationThreadMessages} from '@/chat/conversation/thread-load'
+import type {ConversationThreadActions, ConversationThreadState} from '@/chat/conversation/thread-context'
+import {useInboxLayoutState} from './layout-state'
+import {watchChatSelection} from './selection'
+import {metasReceived} from './metadata-store'
+import {useConfigState} from '@/stores/config'
+import {useCurrentUserState} from '@/stores/current-user'
+import {resetAllStores} from '@/util/zustand'
+import {installFakeNavigator, restoreNavigator} from '@/test/fake-navigator'
+import {getChatRpc} from '@/chat/conversation/chat-rpc'
+import {installFakeChatRpc, restoreChatRpc, type FakeChatRpc} from '@/test/fake-chat-rpc'
+import {flush} from '@/test/flush'
+
+const convKey = (n: number) => T.Chat.stringToConversationIDKey(`0000${n}`.padEnd(64, `${n}`))
+// the new account's inbox, newest first
+const newest = convKey(1)
+const picked = convKey(2)
+const inbox = [newest, picked, convKey(3)]
+// the conversation the previous account had open
+const previousAccountConv = convKey(9)
+
+// The service side of the layout, as chat/uiinboxloader.go builds it: the service remembers the
+// conversation the UI last loaded, and a layout carries reselectInfo when that conversation is not
+// in the inbox snapshot it built from, or when the request asked for a forced reselect. A snapshot
+// can be partial, so it can leave out a conversation the user can see.
+const service = {
+  lastLoaded: '' as string,
+  requested: [] as Array<T.RPCChat.InboxLayoutReselectMode>,
+}
+
+const deliverLayout = (
+  reselectMode: T.RPCChat.InboxLayoutReselectMode,
+  snapshot: ReadonlyArray<T.Chat.ConversationIDKey> = inbox
+) => {
+  const reselect =
+    !snapshot.includes(service.lastLoaded) || reselectMode === T.RPCChat.InboxLayoutReselectMode.force
+  const layout: T.RPCChat.UIInboxLayout = {
+    bigTeams: [],
+    reselectInfo: reselect ? {newConvID: snapshot[0], oldConvID: service.lastLoaded} : undefined,
+    smallTeams: snapshot.map(convID => ({convID}) as T.RPCChat.UIInboxSmallTeamRow),
+    totalSmallTeams: snapshot.length,
+  }
+  notify('chat.1.chatUi.chatInboxLayout', {layout: JSON.stringify(layout)})
+}
+
+const notify = (type: ChatNotification['type'], params: object) =>
+  act(() => {
+    routeChatNotification({payload: {params}, type} as ChatNotification)
+  })
+
+// a meta as the service's inbox would send it; a later inbox version replaces an earlier one
+const meta = (
+  id: T.Chat.ConversationIDKey,
+  membershipType: T.Chat.MembershipType,
+  inboxVersion = 1,
+  trustedState: T.Chat.MetaTrustedState = 'trusted'
+) =>
+  act(() => {
+    metasReceived([{...Meta.makeConversationMeta(), conversationIDKey: id, inboxVersion, membershipType, trustedState}])
+  })
+
+// The layout a refresh asked for arrives only after the service's batch delay, so the user can pick
+// a conversation in between.
+const deliverRequestedLayout = () => {
+  const mode = service.requested.shift()
+  if (mode === undefined) throw new Error('no layout was requested')
+  deliverLayout(mode)
+}
+
+const open = (id: T.Chat.ConversationIDKey, reason: Parameters<typeof navigateToThread>[1]) =>
+  act(() => navigateToThread(id, reason))
+
+let rerenderShell: () => void
+let chatRpc: FakeChatRpc
+
+// The chat tab as the new account's navigator mounts it: the shell reads its selection from the
+// chat root's params, as the route does.
+const mountShell = () => {
+  const shell = () => (
+    <InboxAndConversationShell conversationIDKey={getSelectedConversation()} leftPane={null} />
+  )
+  const {rerender} = render(shell())
+  rerenderShell =
```

**File**: `shared/chat/inbox/layout-state.test.ts` (modified, +7/-27)
```diff
@@ -1,18 +1,11 @@
 /// <reference types="jest" />
 
-let mockIsPhone = false
 let mockLoggedIn = true
 let mockUserSwitching = false
 let mockUsername = 'testuser'
 const mockLoggerInfo = jest.fn()
 const mockLoggerWarn = jest.fn()
 
-jest.mock('@/constants/platform', () => ({
-  get isPhone() {
-    return mockIsPhone
-  },
-}))
-
 jest.mock('@/logger', () => ({
   __esModule: true,
   default: {
@@ -56,7 +49,6 @@ const layoutWithRows: T.RPCChat.UIInboxLayout = {
 }
 
 beforeEach(() => {
-  mockIsPhone = false
   mockLoggedIn = true
   mockUserSwitching = false
   mockUsername = 'testuser'
@@ -71,30 +63,18 @@ afterEach(() => {
   jest.restoreAllMocks()
 })
 
-test('refresh forces desktop reselect until layout has loaded', async () => {
+// A forced reselect would name the conversation the user has open as one to replace.
+test('refresh never forces a reselect, before or after the layout has loaded', async () => {
   const {dispatch} = useInboxLayoutState.getState()
 
   await dispatch.refresh('bootstrap')
-  expect(T.RPCChat.localRequestInboxLayoutRpcPromise).toHaveBeenLastCalledWith({
-    reselectMode: T.RPCChat.InboxLayoutReselectMode.force,
-  })
-
   dispatch.updateLayout(JSON.stringify(emptyLayout))
   await dispatch.refresh('inboxStale')
 
-  expect(T.RPCChat.localRequestInboxLayoutRpcPromise).toHaveBeenLastCalledWith({
-    reselectMode: T.RPCChat.InboxLayoutReselectMode.default,
-  })
-})
-
-test('refresh uses default reselect on phones even before layout has loaded', async () => {
-  mockIsPhone = true
-
-  await useInboxLayoutState.getState().dispatch.refresh('bootstrap')
-
-  expect(T.RPCChat.localRequestInboxLayoutRpcPromise).toHaveBeenCalledWith({
-    reselectMode: T.RPCChat.InboxLayoutReselectMode.default,
-  })
+  expect(T.RPCChat.localRequestInboxLayoutRpcPromise).toHaveBeenCalledTimes(2)
+  for (const call of jest.mocked(T.RPCChat.localRequestInboxLayoutRpcPromise).mock.calls) {
+    expect(call[0]).toEqual({reselectMode: T.RPCChat.InboxLayoutReselectMode.default})
+  }
 })
 
 test('refresh is gated on a logged-in user', async () => {
@@ -165,6 +145,6 @@ test('resetState restores the initial layout store and keeps dispatch usable', a
 
   await dispatch.refresh('bootstrap')
   expect(T.RPCChat.localRequestInboxLayoutRpcPromise).toHaveBeenCalledWith({
-    reselectMode: T.RPCChat.InboxLayoutReselectMode.force,
+    reselectMode: T.RPCChat.InboxLayoutReselectMode.default,
   })
 })
```

**File**: `shared/chat/inbox/layout-state.tsx` (modified, +5/-6)
```diff
@@ -2,7 +2,6 @@ import * as T from '@/constants/types'
 import * as Z from '@/util/zustand'
 import isEqual from 'lodash/isEqual'
 import logger from '@/logger'
-import {isPhone} from '@/constants/platform'
 import {isChatSessionReady} from '@/stores/config'
 import {ignorePromise} from '@/constants/utils'
 import {registerInboxRefresh} from './inbox-refresh'
@@ -69,12 +68,12 @@ export const useInboxLayoutState = Z.createZustand<State>('chat-inbox-layout', (
       return
     }
     logger.info(`Inbox refresh due to ${reason}`)
-    const reselectMode =
-      get().hasLoaded || isPhone
-        ? T.RPCChat.InboxLayoutReselectMode.default
-        : T.RPCChat.InboxLayoutReselectMode.force
+    // Never a forced reselect: a forced layout names whatever conversation is open as one to
+    // replace, and it lands after the service's batch delay, so it swaps out a conversation the
+    // user picked in the meantime. Unforced, a layout's reselectInfo means only that the open
+    // conversation is not in this account's inbox, and an empty selection is the split shell's to fill.
     await withChatSessionRetry(async () =>
-      T.RPCChat.localRequestInboxLayoutRpcPromise({reselectMode})
+      T.RPCChat.localRequestInboxLayoutRpcPromise({reselectMode: T.RPCChat.InboxLayoutReselectMode.default})
     )
   }
 
```

**File**: `shared/chat/inbox/metadata-store.tsx` (modified, +14/-0)
```diff
@@ -30,6 +30,14 @@ export const participantInfoReceived = (
   })
 }
 
+// Told of each conversation whose meta turns from a member's to one the user left or was removed
+// from. The selection listens (see watchChatSelection); it cannot be imported here, as it needs the
+// router.
+let onConversationLeft: ((id: T.Chat.ConversationIDKey) => void) | undefined
+export const setConversationLeftListener = (listener?: (id: T.Chat.ConversationIDKey) => void) => {
+  onConversationLeft = listener
+}
+
 export const metasReceived = (
   metas: ReadonlyArray<T.Chat.ConversationMeta>,
   removals?: ReadonlyArray<T.Chat.ConversationIDKey>,
@@ -60,4 +68,10 @@ export const metasReceived = (
       s.metas.set(next.conversationIDKey, T.castDraft(next))
     })
   })
+  for (const next of changedMetas) {
+    const before = current.get(next.conversationIDKey)
+    if (next.membershipType === 'youLeft' && before && before.membershipType !== 'youLeft') {
+      onConversationLeft?.(next.conversationIDKey)
+    }
+  }
 }
```

**File**: `shared/chat/inbox/metadata.tsx` (modified, +2/-58)
```diff
@@ -5,14 +5,14 @@ export {useInboxMetadataState, metasReceived, participantInfoReceived} from './m
 import * as T from '@/constants/types'
 import type * as EngineGen from '@/constants/rpc'
 import * as NavTree from '@/constants/nav-tree'
-import {navigateToInbox, navigateToThread as routerNavigateToThread} from '@/constants/router'
 import type * as Router2 from '@/constants/router'
 import logger from '@/logger'
 import {ignorePromise, timeoutPromise} from '@/constants/utils'
 import {RPCError} from '@/util/errors'
 import * as Z from '@/util/zustand'
 import {useConfigState, isChatSessionReady} from '@/stores/config'
 import {withChatSessionRetry} from './session-rpc'
+import {conversationGone, maybeChangeSelectedConversation} from './selection'
 import {useCurrentUserState} from '@/stores/current-user'
 import {useUsersState} from '@/stores/users'
 
@@ -140,63 +140,6 @@ const updateInboxUserInfo = (inboxUIItems: ReadonlyArray<T.RPCChat.InboxUIItem>)
   )
 }
 
-export const maybeChangeSelectedConversation = (inboxLayout?: T.RPCChat.UIInboxLayout) => {
-  const newConvID = inboxLayout?.reselectInfo?.newConvID
-  const oldConvID = inboxLayout?.reselectInfo?.oldConvID
-
-  const selectedConversation = Common.getSelectedConversation()
-
-  if (!newConvID && !oldConvID) {
-    return
-  }
-
-  // A pending placeholder means a conversation creation is in flight: that screen belongs to the
-  // create flow, which replaces it with the real conv (or the error screen) when the RPC returns.
-  // The service rebuilds the layout the moment the conv exists, and while it has never been told a
-  // selected conv it tags every layout with reselectInfo, so acting on one here yanks the screen
-  // away - navigateToInbox defers a tick, so it lands either just after the real conv arrives
-  // (bounced back to the inbox) or just before it (pending pushed, popped, then pushed again).
-  if (
-    selectedConversation === T.Chat.pendingWaitingConversationIDKey ||
-    selectedConversation === T.Chat.pendingErrorConversationIDKey
-  ) {
-    logger.info('maybeChangeSelectedConversation: creation in flight, ignoring reselect')
-    return
-  }
-
-  const existingValid = T.Chat.isValidConversationIDKey(selectedConversation)
-  if (!newConvID) {
-    if (!existingValid && isMobile) {
-      logger.info(`maybeChangeSelectedConversation: no new and no valid, so go to inbox`)
-      navigateToInbox(false)
-    }
-    return
-  }
-
-  if (selectedConversation !== oldConvID) {
-    if (!existingValid && isMobile) {
-      logger.info(`maybeChangeSelectedConversation: no new and no valid, so go to inbox`)
-      navigateToInbox(false)
-    }
-    return
-  }
-
-  if (isMobile) {
-    if (T.Chat.isValidConversationIDKey(selectedConversation)) {
-      logger.info(`maybeChangeSelectedConversation: mobile: navigating up on conv change`)
-      navigateToInbox(false)
-      return
-    }
-    logger.info(`maybeChangeSelectedConversation: mobile: ignoring conv change, no conv selected`)
-    return
-  }
-
-  logger.info(
-    `maybeChangeSelectedConversation: selecting new conv: new:${newConvID} old:${oldConvID} prevselected ${selectedConversation}`
-  )
-  routerNavigateToThread(newConvID, 'findNewestConversation')
-}
-
 export const onChatRouteChanged = (
   prev: T.Immutable<Router2.NavState>,
   next: T.Immutable<Router2.NavState>
@@ -660,6 +603,7 @@ export const onChatInboxSynced = async (
         // Incremental unverified sync is authoritative for these convs; force past gating.
         metasReceived(metas, removals, {force: true})
       }
+      removals?.forEach(id => conversationGone(id, 'removed from the inbox'))
 
       forceUnboxRowsForService(
         items
```

---

### Incident Patch 2: `6d7b108d` (2026-10-02)
**Commit Message**: fix: the rekey loop no longer waits forever on the GUI's rekey UI (#29724)

* fix(desktop): the rekey refresh is answered instead of blocking the service, and no session leaks per rekey prompt

* fix: the engine answers delegateRekeyUI on every platform, so the rekey loop never waits on a listener

Go reads the engine's nil auto-answer as session id 0, the same as the explicit 0 the desktop listener sent, so later rekey calls still take the no-session auto-answered path. Mobile registers the rekey UI too and had no listener, and on desktop the call could arrive before the listener subscribed.

**File**: `shared/engine/engine-incoming.test.ts` (added, +62/-0)
```diff
@@ -0,0 +1,62 @@
+/// <reference types="jest" />
+import type {PayloadType} from './rpc-transport'
+
+let incoming: ((p: PayloadType) => void) | undefined
+jest.mock('./index.platform', () => ({
+  createClient: (inc: (p: PayloadType) => void) => {
+    incoming = inc
+    return {invoke: jest.fn(), transport: {}}
+  },
+  resetClient: jest.fn(),
+  rpcLog: jest.fn(),
+}))
+
+import {Engine} from '.'
+
+const makeEngine = () => {
+  const actions: Array<unknown> = []
+  new Engine(
+    () => {},
+    () => {},
+    a => actions.push(a)
+  )
+  return actions
+}
+
+test('a rekey refresh with no session is answered and dispatched', () => {
+  const actions = makeEngine()
+  const response = {error: jest.fn(), result: jest.fn(), seqid: 7}
+  const param = {problemSetDevices: {}, sessionID: 0}
+  incoming!({method: 'keybase.1.rekeyUI.refresh', param: [param], response})
+  expect(response.result).toHaveBeenCalledTimes(1)
+  expect(actions).toEqual([expect.objectContaining({type: 'keybase.1.rekeyUI.refresh'})])
+})
+
+// Go reads a nil result as session id 0, so later rekey calls carry no session and take the
+// auto-answered path above. Answered here on every platform, with or without a listener.
+test('delegateRekeyUI is answered by the engine with no value', () => {
+  const actions = makeEngine()
+  const response = {error: jest.fn(), result: jest.fn(), seqid: 8}
+  incoming!({method: 'keybase.1.rekeyUI.delegateRekeyUI', param: [{}], response})
+  expect(response.result).toHaveBeenCalledTimes(1)
+  expect(response.result).toHaveBeenCalledWith()
+  expect(response.error).not.toHaveBeenCalled()
+  expect(actions).toEqual([
+    expect.objectContaining({
+      payload: {params: {}},
+      type: 'keybase.1.rekeyUI.delegateRekeyUI',
+    }),
+  ])
+})
+
+test('a oneway rekeySendEvent with session 0 is dispatched', () => {
+  const actions = makeEngine()
+  const param = {event: {eventType: 0}, sessionID: 0}
+  expect(() => incoming!({method: 'keybase.1.rekeyUI.rekeySendEvent', param: [param]})).not.toThrow()
+  expect(actions).toEqual([
+    expect.objectContaining({
+      payload: {params: param},
+      type: 'keybase.1.rekeyUI.rekeySendEvent',
+    }),
+  ])
+})
```

**File**: `shared/engine/index.tsx` (modified, +0/-1)
```diff
@@ -21,7 +21,6 @@ class Engine {
   _rpcClient: CreateClientType
   // Set which actions we don't auto respond with so listeners can themselves
   _customResponseAction: {[K in MethodKey]: true} = {
-    'keybase.1.rekeyUI.delegateRekeyUI': true,
     'keybase.1.secretUi.getPassphrase': true,
     ...(isMobile ? {'chat.1.chatUi.chatWatchPosition': true} : {'keybase.1.logsend.prepareLogsend': true}),
   }
```

**File**: `shared/unlock-folders/engine-actions.desktop.test.ts` (modified, +0/-32)
```diff
@@ -2,17 +2,9 @@
 import {handleUnlockFoldersEngineAction} from './engine-actions.desktop'
 
 const mockOpen = jest.fn()
-const mockCreateSession = jest.fn()
-
-jest.mock('@/engine/require', () => ({
-  getEngine: () => ({
-    createSession: mockCreateSession,
-  }),
-}))
 
 afterEach(() => {
   jest.restoreAllMocks()
-  mockCreateSession.mockReset()
   mockOpen.mockReset()
 })
 
@@ -33,27 +25,3 @@ test('rekey refresh actions forward the device list to unlock folders', () => {
 
   expect(mockOpen).toHaveBeenCalledWith([{deviceID: 'device-1', name: 'device-1', type: 'desktop'}])
 })
-
-test('delegateRekeyUI creates a dangling session and returns its id', () => {
-  const response = {result: jest.fn()}
-  mockCreateSession.mockReturnValue({getId: () => 42, id: 42})
-
-  handleUnlockFoldersEngineAction(
-    {
-      payload: {response},
-      type: 'keybase.1.rekeyUI.delegateRekeyUI',
-    } as any,
-    mockOpen
-  )
-
-  expect(mockCreateSession).toHaveBeenCalledWith(
-    expect.objectContaining({
-      dangling: true,
-      incomingCallMap: expect.objectContaining({
-        'keybase.1.rekeyUI.refresh': expect.any(Function),
-        'keybase.1.rekeyUI.rekeySendEvent': expect.any(Function),
-      }),
-    })
-  )
-  expect(response.result).toHaveBeenCalledWith(42)
-})
```

**File**: `shared/unlock-folders/engine-actions.desktop.tsx` (modified, +4/-27)
```diff
@@ -1,6 +1,5 @@
 import type * as EngineGen from '@/constants/rpc'
 import * as T from '@/constants/types'
-import {getEngine} from '@/engine/require'
 import logger from '@/logger'
 import type {UnlockFolderDevice} from './store'
 
@@ -12,32 +11,10 @@ const rpcDevicesToUnlockFolderDevices = (devices: ReadonlyArray<T.RPCGen.Device>
   }))
 
 export const handleUnlockFoldersEngineAction = (
-  action:
-    | EngineGen.ActionOf<'keybase.1.rekeyUI.delegateRekeyUI'>
-    | EngineGen.ActionOf<'keybase.1.rekeyUI.refresh'>,
+  action: EngineGen.ActionOf<'keybase.1.rekeyUI.refresh'>,
   open: (devices: ReadonlyArray<UnlockFolderDevice>) => void
 ) => {
-  switch (action.type) {
-    case 'keybase.1.rekeyUI.refresh': {
-      const {problemSetDevices} = action.payload.params
-      logger.info('Asked for rekey')
-      open(rpcDevicesToUnlockFolderDevices(problemSetDevices.devices ?? []))
-      break
-    }
-    case 'keybase.1.rekeyUI.delegateRekeyUI': {
-      // We get this with sessionID == 0 if we call openDialog.
-      const session = getEngine().createSession({
-        dangling: true,
-        incomingCallMap: {
-          'keybase.1.rekeyUI.refresh': ({problemSetDevices}) => {
-            open(rpcDevicesToUnlockFolderDevices(problemSetDevices.devices ?? []))
-          },
-          'keybase.1.rekeyUI.rekeySendEvent': () => {}, // ignored debug call from daemon
-        },
-      })
-      const {response} = action.payload
-      response.result(session.getId())
-      break
-    }
-  }
+  const {problemSetDevices} = action.payload.params
+  logger.info('Asked for rekey')
+  open(rpcDevicesToUnlockFolderDevices(problemSetDevices.devices ?? []))
 }
```

**File**: `shared/unlock-folders/remote-proxy.desktop.tsx` (modified, +0/-4)
```diff
@@ -37,10 +37,6 @@ const UnlockRemoteProxy = () => {
     handleUnlockFoldersEngineAction(action, open)
   })
 
-  useEngineActionListener('keybase.1.rekeyUI.delegateRekeyUI', action => {
-    handleUnlockFoldersEngineAction(action, open)
-  })
-
   if (devices.length) {
     return <UnlockFolders devices={devices} paperKeyError={paperKeyError} waiting={waiting} />
   }
```

---

### Incident Patch 3: `db80b7d6` (2026-10-02)
**Commit Message**: fix(login): recover password asks before losing server-stored PGP keys instead of hanging (#29726)

* fix(login): recover password asks before losing server-stored PGP keys instead of hanging

* fix(login): restarting recover password answers a pending PGP warning, and declining leaves the flow

* fix(recover-password): a PGP-warning answer dies with the run that asked it

When the recoverPassphrase run ends while the PGP prompt is still up (link
drop, account-switch cancel, service cancel), the next startRecoverPassword
no longer answers that dead prompt. The run clears the pending answer in its
finally only if it still holds its own, so a newer run's prompt survives an
old run ending late. Also corrects the decline comment: Go logs the user back
out.

* fix(recover-password): the PGP warning is a modal over the logged-in app

Go asks only after the paper key has logged the user in, so the warning is
registered as a modal (gesture disabled, back wired to cancel) and pushed
rather than replacing the tab navigator. Cancel is the single decline path;
Continue shows the recover waiting state, and the set-password screen that
follows replaces the answered warning.

* fix(recover-passwo

**File**: `shared/login/recover-password/flow-prompts.test.tsx` (modified, +327/-0)
```diff
@@ -3,15 +3,24 @@ import * as T from '@/constants/types'
 import {resetAllStores} from '@/util/zustand'
 import {useConfigState} from '@/stores/config'
 import {RPCError} from '@/util/errors'
+import {useWaitingState} from '@/stores/waiting'
+import {waitingKeyRecoverPassword} from '@/constants/strings'
+import listener from '@/engine/listener'
+import {initEngine, initEngineListener} from '@/engine/require'
 
 import {
+  answerRecoverPasswordPgp,
   cancelRecoverPassword,
+  isRecoverPasswordPgpPending,
+  markRecoverPasswordPgpShown,
   startRecoverPassword,
   submitRecoverPasswordDeviceSelect,
   submitRecoverPasswordNoDevice,
   submitRecoverPasswordPaperKey,
   submitRecoverPasswordPassword,
 } from './flow'
+import {newModalRoutes} from '../routes'
+import {navigateAppend} from '@/constants/router'
 import {installFakeNavigator, makeRootState, restoreNavigator, type FakeNavigator} from '@/test/fake-navigator'
 
 let nav: FakeNavigator
@@ -29,6 +38,11 @@ beforeEach(() => {
 })
 
 afterEach(() => {
+  // A prompt left pending would keep its decline timer alive past the test.
+  nav
+    .pushes()
+    .filter(p => p.name === 'recoverPasswordPgpWarning')
+    .forEach(p => answerRecoverPasswordPgp((p.params as {id: number}).id, false))
   restoreNavigator()
   jest.restoreAllMocks()
   resetAllStores()
@@ -344,3 +358,316 @@ describe('completion', () => {
     expect(response.result).not.toHaveBeenCalled()
   })
 })
+
+describe('pgp key warning', () => {
+  // Go asks only after the paper key has logged the user in, so the warning is a modal over the app.
+  beforeEach(() => {
+    useConfigState.getState().dispatch.setLoggedIn(true)
+    nav = installFakeNavigator({modalRouteNames: Object.keys(newModalRoutes), rootState: makeRootState()})
+  })
+
+  afterEach(() => {
+    jest.useRealTimers()
+  })
+
+  const rootRouteNames = () => nav.getRootState()?.routes?.map(r => r.name)
+
+  const prompt = (attempt: {listener: Listener}) => {
+    const response = {error: jest.fn(), result: jest.fn()}
+    attempt.listener.customResponseIncomingCallMap?.['keybase.1.loginUi.promptPassphraseRecovery']?.(
+      {kind: T.RPCGen.PassphraseRecoveryPromptType.encryptedPgpKeys} as any,
+      response as any
+    )
+    return response
+  }
+
+  // The id the flow handed the warning screen it pushed.
+  const warningId = () => {
+    const pushed = nav.pushes().filter(p => p.name === 'recoverPasswordPgpWarning')
+    return (pushed.at(-1)?.params as {id: number}).id
+  }
+
+  test('a prompt shows the warning as a modal over the logged-in app, bound to the prompt', async () => {
+    const {first} = await startAttempt()
+    prompt(first)
+
+    expect(rootRouteNames()).toEqual(['loggedIn', 'recoverPasswordPgpWarning'])
+    expect(isRecoverPasswordPgpPending(warningId())).toBe(true)
+  })
+
+  test('a prompt before the logged-in root mounts shows the warning once it does', async () => {
+    nav = installFakeNavigator({
+      modalRouteNames: Object.keys(newModalRoutes),
+      rootState: makeRootState({loggedIn: false}),
+    })
+    const {first} = await startAttempt()
+    prompt(first)
+    expect(nav.pushes()).toEqual([])
+
+    nav.setRootState(makeRootState())
+
+    expect(rootRouteNames()).toEqual(['loggedIn', 'recoverPasswordPgpWarning'])
+  })
+
+  test('the answer is given once: Continue answers true and later answers are ignored', async () => {
+    const {first} = await startAttempt()
+    const response = prompt(first)
+    const id = warningId()
+
+    answerRecoverPasswordPgp(id, true)
+    answerRecoverPasswordPgp(id, true)
+    answerRecoverPasswordPgp(id, false)
+
+    expect(response.result).toHaveBeenCalledTimes(1)
+    expect(response.result).toHaveBeenCalledWith(true)
+    expect(isRecoverPasswordPgpPending(id)).toBe(false)
+  })
+
+  test("a warning answers only its own prompt, never a newer run's", async () => {
+    const attempts = mockRecoverAttempts()
+    startRecoverPassword({username: 'testuser'})
+    await flush()
+    prompt(attempts[0]!)
+    const staleId = warningId()
+
+    startRecoverPassword({username: 'testuser'})
+    await flush()
+    const response = prompt(attempts[1]!)
+    answerRecoverPasswordPgp(staleId, true)
+
+    expect(response.result).not.toHaveBeenCalled()
+    expect(isRecoverPasswordPgpPending(warningId())).toBe(true)
+  })
+
+  test('a restart answers a pending prompt false once and takes its warning off the top', async () => {
+    const attempts = mockRecoverAttempts()
+    startRecoverPassword({username: 'testuser'})
+    await flush()
+    const response = prompt(attempts[0]!)
+    const id = warningId()
+
+    startRecoverPassword({username: 'testuser'})
+    await flush()
+    answerRecoverPasswordPgp(id, true)
+    attempts[0]!.reject(new RPCError('Canceling RPC', T.RPCGen.StatusCode.sccanceled))
+    await flush()
+
+    expect(response.result).toHaveBeenCalledTimes(1)
+    expect(response.result).toHaveBeenCalledWith(false)
+    expect(rootRouteNam
```

**File**: `shared/login/recover-password/flow.tsx` (modified, +80/-2)
```diff
@@ -1,5 +1,11 @@
 import * as T from '@/constants/types'
-import {clearModals, navigateAppend, navigateUp} from '@/constants/router'
+import {
+  clearModals,
+  getVisibleScreen,
+  navigateAppend,
+  navigateAppendOnceRootHas,
+  navigateUp,
+} from '@/constants/router'
 import {waitingKeyRecoverPassword} from '@/constants/strings'
 import {ignorePromise, wrapErrors} from '@/constants/utils'
 import logger from '@/logger'
@@ -41,13 +47,61 @@ export const submitRecoverPasswordPassword = (password: string) =>
 export const submitRecoverPasswordReset = (action: T.RPCGen.ResetPromptResponse) =>
   callNamed(owner, slots.submitResetPassword, action)
 
+// Go asks the PGP question at most once per run and waits for the answer, so at most one is pending.
+// Each warning screen carries its prompt's id and answers only that prompt.
+type PgpPrompt = {
+  answer: (proceed: boolean) => void
+  id: number
+  timer: ReturnType<typeof setTimeout>
+}
+let pendingPgp: PgpPrompt | undefined
+let lastPgpId = 0
+const pgpWarningName = 'recoverPasswordPgpWarning'
+// How long the warning may wait for the logged-in root before navigateAppendOnceRootHas drops it.
+const pgpWarningMountTimeoutMs = 5000
+
+export const isRecoverPasswordPgpPending = (id: number) => pendingPgp?.id === id
+
+// undefined settles without answering: the run's RPC is over and nothing on Go's side is listening.
+const settlePgp = (id: number, proceed: boolean | undefined) => {
+  const prompt = pendingPgp
+  if (prompt?.id !== id) return
+  pendingPgp = undefined
+  clearTimeout(prompt.timer)
+  if (proceed !== undefined) {
+    prompt.answer(proceed)
+  }
+}
+
+// The warning screen reports its mount: from then on the user has it and the push timeout is moot.
+export const markRecoverPasswordPgpShown = (id: number) => {
+  if (pendingPgp?.id === id) {
+    clearTimeout(pendingPgp.timer)
+  }
+}
+
+export const answerRecoverPasswordPgp = (id: number, proceed: boolean) => settlePgp(id, proceed)
+
+// Settles the pending prompt and takes its warning away if it is on top. A warning under another modal
+// stays: removing a covered modal crashes iOS.
+const endPgp = (proceed: false | undefined, id: number | undefined) => {
+  if (id === undefined || !isRecoverPasswordPgpPending(id)) return
+  settlePgp(id, proceed)
+  if (getVisibleScreen(true)?.name === pgpWarningName) {
+    navigateUp()
+  }
+}
+
 export const startRecoverPassword = ({
   abortProvisioning,
   onResetEmailSent,
   replaceRoute,
   username,
 }: StartRecoverPasswordParams) => {
+  // The previous run's RPC is still live and waiting on its answer.
+  endPgp(false, pendingPgp?.id)
   clearOwner(owner)
+  let runPgpId: number | undefined
   const f = async () => {
     if (abortProvisioning) {
       cancelProvision()
@@ -109,7 +163,24 @@ export const startRecoverPassword = ({
             )
             navigateAppend({name: 'recoverPasswordDeviceSelector', params: {devices}}, !!replaceRoute)
           },
-          'keybase.1.loginUi.promptPassphraseRecovery': () => {},
+          'keybase.1.loginUi.promptPassphraseRecovery': (_params, response) => {
+            // The listener runs handlers a tick late, so the run may have ended since Go asked.
+            if (!isActive()) return
+            // true continues to set-password; false makes Go cancel and log back out.
+            endPgp(false, pendingPgp?.id)
+            const id = ++lastPgpId
+            runPgpId = id
+            pendingPgp = {
+              answer: wrapErrors((proceed: boolean) => response.result(proceed)),
+              id,
+              // The push below gives up silently after its timeout; decline rather than leave Go waiting.
+              // The warning mounting clears this, so it only fires for a warning that never appeared.
+              timer: setTimeout(() => settlePgp(id, false), pgpWarningMountTimeoutMs),
+            }
+            // The paper key has just logged the user in, so the logged-in root this modal lives on may not
+            // be mounted yet.
+            navigateAppendOnceRootHas('loggedIn', {name: pgpWarningName, params: {id}}, pgpWarningMountTimeoutMs)
+          },
           'keybase.1.loginUi.promptResetAccount': (params, response) => {
             if (params.prompt.t === T.RPCGen.ResetPromptType.enterResetPw) {
               navigateAppend({name: 'recoverPasswordPromptResetPassword', params: {username}})
@@ -208,6 +279,7 @@ export const startRecoverPassword = ({
       console.log('Recovered account')
     } catch (error) {
       if (!(error instanceof RPCError)) {
+        logger.warn('recover password failed unexpectedly', error)
         return
       }
       hadError = true
@@ -231,6 +303,12 @@ export const startRecoverPassword = ({
         slots.submitResetPassword
       )
       active = false
+      // Go stopped waiting with the run, so a prompt still pending is settled without an answer: one sent
+      // now would leave the RPC counted as waiting on a server
```

**File**: `shared/login/recover-password/pgp-warning.stories.tsx` (added, +11/-0)
```diff
@@ -0,0 +1,11 @@
+import type {Meta, StoryObj} from '@storybook/react'
+import PgpWarning from './pgp-warning'
+
+const meta: Meta<typeof PgpWarning> = {
+  component: PgpWarning,
+  title: 'Login/RecoverPasswordPgpWarning',
+}
+export default meta
+type Story = StoryObj<typeof PgpWarning>
+
+export const Default: Story = {args: {route: {params: {id: 0}}}}
```

**File**: `shared/login/recover-password/pgp-warning.test.tsx` (added, +151/-0)
```diff
@@ -0,0 +1,151 @@
+/** @jest-environment jsdom */
+/// <reference types="jest" />
+import type * as React from 'react'
+import * as T from '@/constants/types'
+import {act, cleanup, fireEvent, render, screen} from '@testing-library/react'
+import {NavigationContext} from '@react-navigation/core'
+import {resetAllStores} from '@/util/zustand'
+import {useConfigState} from '@/stores/config'
+import {installFakeNavigator, makeRootState, restoreNavigator, type FakeNavigator} from '@/test/fake-navigator'
+import {answerRecoverPasswordPgp, startRecoverPassword} from './flow'
+import PgpWarning from './pgp-warning'
+
+// The real components need native/electron rendering; only the Continue button matters here.
+jest.mock('@/common-adapters', () => {
+  const React = require('react')
+  const passThrough = ({children}: {children?: React.ReactNode}) =>
+    React.createElement('div', null, children)
+  return {
+    Box2: passThrough,
+    Button: ({label, onClick}: {label?: string; onClick?: () => void}) =>
+      React.createElement('button', {onClick, type: 'button'}, label),
+    ButtonBar: passThrough,
+    ModalFooter: passThrough,
+    ScrollView: passThrough,
+    Styles: {
+      createStyleHook: () => () => ({}),
+      globalStyles: {flexOne: {}},
+      isTablet: false,
+    },
+    Text: passThrough,
+  }
+})
+
+type BeforeRemove = (e: {data: {action: {type: string}}}) => void
+
+let nav: FakeNavigator
+let beforeRemove: BeforeRemove | undefined
+let shownId: number | undefined
+
+beforeEach(() => {
+  beforeRemove = undefined
+  shownId = undefined
+  useConfigState.getState().dispatch.setLoggedIn(true)
+  nav = installFakeNavigator({modalRouteNames: ['recoverPasswordPgpWarning'], rootState: makeRootState()})
+})
+
+afterEach(() => {
+  cleanup()
+  // A prompt left pending would keep its decline timer alive past the test.
+  if (shownId !== undefined) answerRecoverPasswordPgp(shownId, false)
+  restoreNavigator()
+  jest.restoreAllMocks()
+  resetAllStores()
+})
+
+const flush = async () => new Promise<void>(resolve => setTimeout(resolve, 0))
+
+// Starts a run, has Go ask, and renders the warning the flow pushed inside a screen's navigation context.
+// `before` runs between the push and the screen mounting, as a deferred mount would see it.
+const setup = async (before?: (id: number) => void) => {
+  let listener: Parameters<typeof T.RPCGen.loginRecoverPassphraseRpcListener>[0] | undefined
+  jest.spyOn(T.RPCGen, 'loginRecoverPassphraseRpcListener').mockImplementation(async l => {
+    listener = l
+    await new Promise<void>(() => {})
+    return undefined as any
+  })
+  startRecoverPassword({username: 'testuser'})
+  await flush()
+  const response = {error: jest.fn(), result: jest.fn()}
+  listener?.customResponseIncomingCallMap?.['keybase.1.loginUi.promptPassphraseRecovery']?.(
+    {kind: T.RPCGen.PassphraseRecoveryPromptType.encryptedPgpKeys} as any,
+    response as any
+  )
+  const pushed = nav.pushes().find(p => p.name === 'recoverPasswordPgpWarning')
+  const id = (pushed?.params as {id: number}).id
+  shownId = id
+  before?.(id)
+  nav.clearActions()
+  const navigation = {
+    addListener: (type: string, cb: BeforeRemove) => {
+      if (type === 'beforeRemove') beforeRemove = cb
+      return () => {}
+    },
+  }
+  render(
+    <NavigationContext value={navigation as never}>
+      <PgpWarning route={{params: {id}}} />
+    </NavigationContext>
+  )
+  return {id, response}
+}
+
+const remove = (type: string) => act(() => beforeRemove?.({data: {action: {type}}}))
+
+test('Continue answers true once and closes the warning', async () => {
+  const {response} = await setup()
+
+  fireEvent.click(screen.getByText('Continue'))
+  // Closing the warning is not a second answer.
+  remove('GO_BACK')
+  fireEvent.click(screen.getByText('Continue'))
+
+  expect(response.result).toHaveBeenCalledTimes(1)
+  expect(response.result).toHaveBeenCalledWith(true)
+  expect(nav.types()[0]).toBe('GO_BACK')
+})
+
+test.each(['GO_BACK', 'POP', 'REMOVE'])('the user taking the warning away (%s) answers false once', async type => {
+  const {response} = await setup()
+
+  remove(type)
+  remove(type)
+
+  expect(response.result).toHaveBeenCalledTimes(1)
+  expect(response.result).toHaveBeenCalledWith(false)
+})
+
+test('an app-initiated reset removing the warning is not an answer', async () => {
+  const {response} = await setup()
+
+  remove('RESET')
+
+  expect(response.result).not.toHaveBeenCalled()
+})
+
+test('a warning whose prompt was settled before it mounted closes itself without a second answer', async () => {
+  const {response} = await setup(id => answerRecoverPasswordPgp(id, false))
+
+  expect(nav.types()).toEqual(['GO_BACK'])
+  fireEvent.click(screen.getByText('Continue'))
+
+  expect(response.result).toHaveBeenCalledTimes(1)
+  expect(response.result).toHaveBeenCalledWith(false)
+})
+
+test('a warning whose prompt was settled leaves the screen above it alone when covered', async () => {

```

**File**: `shared/login/recover-password/pgp-warning.tsx` (added, +82/-0)
```diff
@@ -0,0 +1,82 @@
+import * as Kb from '@/common-adapters'
+import * as React from 'react'
+import {NavigationContext} from '@react-navigation/core'
+import {getVisibleScreen, navigateUp} from '@/constants/router'
+import {answerRecoverPasswordPgp, isRecoverPasswordPgpPending, markRecoverPasswordPgpShown} from './flow'
+
+type Props = {route: {params: {id: number}}}
+
+const PgpWarning = ({route}: Props) => {
+  const {id} = route.params
+  const styles = useStyles()
+  // Absent outside a navigator (storybook).
+  const navigation = React.useContext(NavigationContext)
+
+  React.useEffect(() => {
+    markRecoverPasswordPgpShown(id)
+  }, [id])
+
+  // A deferred push can land after its prompt was settled; there is nothing left to answer.
+  React.useEffect(() => {
+    if (isRecoverPasswordPgpPending(id)) return
+    const visible = getVisibleScreen(true)
+    if (visible?.name === 'recoverPasswordPgpWarning' && (visible.params as {id?: number}).id === id) {
+      navigateUp()
+    }
+  }, [id])
+
+  React.useEffect(() => {
+    if (!navigation) return
+    return navigation.addListener('beforeRemove', e => {
+      // Only the user taking the warning away is a decline: the header Cancel, Android back or a native
+      // dismissal (REMOVE). Resets elsewhere also remove screens and are not answers.
+      const {type} = e.data.action
+      if (type === 'POP' || type === 'GO_BACK' || type === 'REMOVE') {
+        answerRecoverPasswordPgp(id, false)
+      }
+    })
+  }, [navigation, id])
+
+  const onContinue = () => {
+    answerRecoverPasswordPgp(id, true)
+    navigateUp()
+  }
+
+  return (
+    <>
+      <Kb.ScrollView alwaysBounceVertical={false} style={Kb.Styles.globalStyles.flexOne}>
+        <Kb.Box2
+          centerChildren={!Kb.Styles.isTablet}
+          direction="vertical"
+          fullHeight={true}
+          flex={1}
+          gap="small"
+          padding="small"
+          style={styles.container}
+        >
+          <Kb.Text type="Body" center={true}>
+            Your account has PGP keys stored on Keybase, encrypted with your old password.
+          </Kb.Text>
+          <Kb.Text type="Body" center={true}>
+            If you reset your password you will lose them.
+          </Kb.Text>
+        </Kb.Box2>
+      </Kb.ScrollView>
+      <Kb.ModalFooter>
+        <Kb.ButtonBar align="center" direction="row" fullWidth={true} style={styles.buttonBar}>
+          <Kb.Button fullWidth={true} label="Continue" onClick={onContinue} type="Danger" />
+        </Kb.ButtonBar>
+      </Kb.ModalFooter>
+    </>
+  )
+}
+
+const useStyles = Kb.Styles.createStyleHook(
+  theme =>
+    ({
+      buttonBar: {minHeight: undefined},
+      container: {backgroundColor: theme.blueGrey},
+    }) as const
+)
+
+export default PgpWarning
```

**File**: `shared/login/routes.tsx` (modified, +6/-0)
```diff
@@ -206,6 +206,12 @@ export const newModalRoutes = defineRouteMap({
     getOptions: {gestureEnabled: false, title: 'Error'},
     screen: React.lazy(async () => import('./recover-password/error-modal')),
   },
+  // Shown over the logged-in app: Go asks after the paper key has logged the user in. The modal's
+  // Cancel is the decline.
+  recoverPasswordPgpWarning: {
+    getOptions: {gestureEnabled: false, title: 'Recover password'},
+    screen: React.lazy(async () => import('./recover-password/pgp-warning')),
+  },
   recoverPasswordSetPassword: {
     getOptions: {gestureEnabled: false, title: 'Set password'},
     screen: React.lazy(async () => import('./recover-password/password')),
```

---

### Incident Patch 4: `e1370440` (2026-10-01)
**Commit Message**: fix(desktop): hidden tooltips and the command help panel no longer shift the layout sideways (#29711)

A hidden tooltip was parked only above the page (top: -99999px) and kept left: 50%, so a wide
label on an icon near the conversation pane's right edge (the composer's "Attachment") stuck out
past it. The command help panel was fullWidth plus side margins, 16px wider than its pane. Either
gave the overflow:hidden content wrapper a few px of horizontal scroll range, and focusing the
composer scrolled it, sliding the nav, inbox and thread sideways.

Hidden tooltips now also park off to the left, and the panel stretches instead of taking 100%
plus margins on desktop.

**File**: `shared/chat/conversation/command-markdown.tsx` (modified, +3/-1)
```diff
@@ -16,7 +16,7 @@ const CommandMarkdown = () => {
   return (
     <Kb.Box2
       direction="vertical"
-      fullWidth={true}
+      fullWidth={isMobile}
       style={Kb.Styles.collapseStyles([styles.container, maxHeightStyle])}
     >
       {!!title && (
@@ -40,8 +40,10 @@ const useStyles = Kb.Styles.createStyleHook(
         ...Kb.Styles.padding(Kb.Styles.globalMargins.tiny, Kb.Styles.globalMargins.xsmall),
       },
       container: Kb.Styles.platformStyles({
+        // stretch, not fullWidth: 100% plus the side margins would overflow the conversation pane
         isElectron: {
           ...Kb.Styles.desktopStyles.boxShadow,
+          alignSelf: 'stretch',
           border: `1px solid ${theme.black_20}`,
           borderRadius: Kb.Styles.borderRadius,
           marginBottom: Kb.Styles.globalMargins.xtiny,
```

**File**: `shared/desktop/renderer/style.css` (modified, +4/-2)
```diff
@@ -536,14 +536,16 @@ body {
   text-rendering: optimizeLegibility;
   white-space: nowrap;
   z-index: 999;
-  left: 50%;
   transform: translate(-50%, -100%);
-  /* move out so it doesn't affect measuring*/
+  /* parked off the top-left while hidden: an offset to the right or bottom would still widen its
+     scroll container, and focusing an input then scrolls even an overflow:hidden ancestor */
+  left: -99999px;
   top: -99999px;
 }
 
 .tooltip:hover:before {
   opacity: 1;
+  left: 50%;
   top: initial;
 }
 
```

---

### Incident Patch 5: `8f694ce2` (2026-09-28)
**Commit Message**: Move more mobile deps to Expo modules, drop dead Android code, fix dark cold-start flash (#29691)

* chore(android): remove dead native code and the Fresco GIF decoder

DeviceLockType, CustomBitmapMemoryCacheParamsSupplier, StorybookConstants and
KillableModule had no references anywhere in the repo. animated-gif only let
RN's Fresco-backed Image animate GIFs; no GIF renders through RN Image.

* feat(mobile): swap deps to Expo equivalents, fix dark cold-start flash

- netinfo -> expo-network. The connection type is lowercased so Go gets the
  same strings as before; the listener also fetches once on subscribe since
  expo-network doesn't always emit the current state.
- react-native StatusBar -> expo-status-bar, @callstack/liquid-glass ->
  expo-glass-effect.
- Drop unused expo-mail-composer and @react-native-masked-view/masked-view
  (react-navigation 8 no longer needs it), and the empty KBReactPackage.
- Android dark mode: remove androidAppColorSchemeChanged. MainApplication
  applies the persisted pref as AppCompat night mode before any activity, and
  MainActivity paints the window background from the current configuration,
  so Appearance.setColorScheme is the only runtime mec

**File**: `rnmodules/react-native-kb/android/src/main/java/com/reactnativekb/DarkModePrefHelper.kt` (removed, +0/-11)
```diff
@@ -1,11 +0,0 @@
-package com.reactnativekb
-
-object DarkModePrefHelper {
-    fun fromString(prefString: String): DarkModePreference {
-        return when (prefString) {
-            "alwaysDark" -> DarkModePreference.AlwaysDark
-            "alwaysLight" -> DarkModePreference.AlwaysLight
-            else -> DarkModePreference.System
-        }
-    }
-}
```

**File**: `rnmodules/react-native-kb/android/src/main/java/com/reactnativekb/GuiConfig.kt` (modified, +5/-2)
```diff
@@ -15,8 +15,11 @@ class GuiConfig private constructor(private val filesDir: File?) {
         return try {
             val jsonObject = JSONObject(asString() ?: return DarkModePreference.System)
             val jsonObjectUI: JSONObject = jsonObject.getJSONObject("ui")
-            val darkModeString: String = jsonObjectUI.getString("darkMode")
-            DarkModePrefHelper.fromString(darkModeString)
+            when (jsonObjectUI.getString("darkMode")) {
+                "alwaysDark" -> DarkModePreference.AlwaysDark
+                "alwaysLight" -> DarkModePreference.AlwaysLight
+                else -> DarkModePreference.System
+            }
         } catch (e: JSONException) {
             DarkModePreference.System
         }
```

**File**: `rnmodules/react-native-kb/android/src/main/java/com/reactnativekb/KbModule.kt` (modified, +0/-16)
```diff
@@ -376,22 +376,6 @@ class KbModule(reactContext: ReactApplicationContext?) : KbSpec(reactContext), T
         }
     }
 
-    // Dark mode
-    // Same type as DarkModePreference: 'system' | 'alwaysDark' | 'alwaysLight'
-    @ReactMethod
-    override fun androidAppColorSchemeChanged(prefString: String) {
-        try {
-            val activity: Activity? = reactContext.currentActivity
-            if (activity != null) {
-                val m: Method = activity.javaClass.getMethod("setBackgroundColor", DarkModePreference::class.java)
-                val pref: DarkModePreference = DarkModePrefHelper.fromString(prefString)
-                m.invoke(activity, pref)
-            }
-        } catch (ex: Exception) {
-            NativeLogger.warn("Error calling androidAppColorSchemeChanged", ex)
-        }
-    }
-
     @ReactMethod
     override fun setApplicationIconBadgeNumber(badge: Double) {
         // Android manages badge counts automatically via notification channels.
```

**File**: `rnmodules/react-native-kb/ios/Kb.mm` (modified, +0/-1)
```diff
@@ -984,7 +984,6 @@ - (void)handleHardwareKeyPressed:(NSNotification *)notification {
 
 // Android-only spec methods; stubs satisfy the NativeKbSpec protocol
 - (void)androidAddCompleteDownload:(JS::NativeKb::SpecAndroidAddCompleteDownloadO &)o resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {}
-- (void)androidAppColorSchemeChanged:(NSString *)mode {}
 - (void)androidShare:(NSString *)text mimeType:(NSString *)mimeType resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {}
 - (void)androidShareText:(NSString *)text mimeType:(NSString *)mimeType resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject {}
 @end
```

**File**: `rnmodules/react-native-kb/src/NativeKb.ts` (modified, +0/-1)
```diff
@@ -60,7 +60,6 @@ export interface Spec extends TurboModule {
     showNotification: boolean
     title: string
   }): Promise<void>
-  androidAppColorSchemeChanged(mode: string /*'system' | 'alwaysDark' | 'alwaysLight' | ''*/): void
   checkPushPermissions(): Promise<boolean>
   requestPushPermissions(): Promise<boolean>
   getRegistrationToken(): Promise<string>
```

**File**: `rnmodules/react-native-kb/src/index.tsx` (modified, +0/-6)
```diff
@@ -75,12 +75,6 @@ export const androidAddCompleteDownload = (o: {
   return Promise.reject(new Error('wrong platform'))
 }
 
-export const androidAppColorSchemeChanged = (mode: 'system' | 'alwaysDark' | 'alwaysLight' | ''): void => {
-  if (Platform.OS === 'android') {
-    Kb.androidAppColorSchemeChanged(mode)
-  }
-}
-
 export const checkPushPermissions = (): Promise<boolean> => {
   return Kb.checkPushPermissions()
 }
```

**File**: `shared/android/app/build.gradle` (modified, +0/-1)
```diff
@@ -165,7 +165,6 @@ dependencies {
     implementation 'androidx.work:work-runtime:2.11.2'
     implementation 'androidx.multidex:multidex:2.0.1'
     implementation "com.google.firebase:firebase-messaging:25.0.2"
-    implementation "com.facebook.fresco:animated-gif:${expoLibs.versions.fresco.get()}"
     implementation 'org.msgpack:msgpack-core:0.9.12'
     implementation project(':keybaselib')
     implementation 'com.android.installreferrer:installreferrer:2.2'
```

**File**: `shared/android/app/src/main/java/io/keybase/ossifrage/CustomBitmapMemoryCacheParamsSupplier.kt` (removed, +0/-43)
```diff
@@ -1,43 +0,0 @@
-package io.keybase.ossifrage
-
-import android.app.ActivityManager
-import android.content.Context
-import com.facebook.common.internal.Supplier
-import com.facebook.common.util.ByteConstants
-import com.facebook.imagepipeline.cache.MemoryCacheParams
-
-/**
- * Custom Bitmap cache config for Fresco based off of [DefaultBitmapMemoryCacheParamsSupplier]
- */
-class CustomBitmapMemoryCacheParamsSupplier(context: Context) : Supplier<MemoryCacheParams> {
-    private val activityManager: ActivityManager by lazy {
-        context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
-    }
-
-    override fun get(): MemoryCacheParams {
-        return MemoryCacheParams(
-                maxCacheSize,
-                MAX_CACHE_ENTRIES,
-                MAX_EVICTION_QUEUE_SIZE,
-                MAX_EVICTION_QUEUE_ENTRIES,
-                MAX_CACHE_ENTRY_SIZE)
-    }
-
-    private val maxCacheSize: Int
-         get() {
-            val maxMemory = Math.min(activityManager.memoryClass * ByteConstants.MB, Int.MAX_VALUE)
-            return when {
-                maxMemory < 32 * ByteConstants.MB -> 4 * ByteConstants.MB
-                maxMemory < 64 * ByteConstants.MB -> 6 * ByteConstants.MB
-                else -> maxMemory / CACHE_DIVISION
-            }
-        }
-
-    companion object {
-        private const val CACHE_DIVISION = 8 // cache size will be 1/8 of the max allocated app memory
-        private const val MAX_CACHE_ENTRIES = 256
-        private const val MAX_EVICTION_QUEUE_SIZE = Int.MAX_VALUE
-        private const val MAX_EVICTION_QUEUE_ENTRIES = Int.MAX_VALUE
-        private const val MAX_CACHE_ENTRY_SIZE = Int.MAX_VALUE
-    }
-}
```

---

### Incident Patch 6: `b84dfe4a` (2026-09-28)
**Commit Message**: fix(chat): audio messages play on first tap and share with an extension (#29690)

- The audio player mounts on the first tap with paused=false, but only
  called play() on a later change of paused, so the first tap never played.
  Drive play/pause from the paused state on mobile and desktop.
- Audio uploads pass a caller preview, and PreprocessAsset returned early on
  that path without setting Filename, so recordings were stored as "." and
  downloaded/shared with no extension. Keep the filename on that path, and
  don't let a stale pending preview blank it out.
- Name already-sent nameless assets on download and archive export
  (audio.m4a for recordings, otherwise an extension from the MIME type).

**File**: `go/chat/archive.go` (modified, +1/-1)
```diff
@@ -528,7 +528,7 @@ func (c *ChatArchiver) attachmentName(msg chat1.MessageUnboxedValid) string {
 	}
 	if typ == chat1.MessageType_ATTACHMENT {
 		att := body.Attachment()
-		safeFilename := libkb.GetSafeFilename(att.Object.Filename)
+		safeFilename := attachments.DownloadBasename(att.Object)
 		return fmt.Sprintf("%s (%d) - %s", gregor1.FromTime(msg.ServerHeader.Ctime).Format("2006-01-02 15.04.05"), msg.ServerHeader.MessageID, safeFilename)
 	}
 	return ""
```

**File**: `go/chat/attachments/downloader.go` (modified, +33/-2)
```diff
@@ -5,6 +5,7 @@ import (
 	"errors"
 	"fmt"
 	"io"
+	"mime"
 	"os"
 
 	"github.com/keybase/client/go/chat/globals"
@@ -39,8 +40,7 @@ func SinkFromFilename(ctx context.Context, g *globals.Context, uid gregor1.UID,
 	if err != nil || typ != chat1.MessageType_ATTACHMENT {
 		return "", nil, fmt.Errorf("invalid message type for download: %v", typ)
 	}
-	unsafeBasename := body.Attachment().Object.Filename
-	safeBasename := libkb.GetSafeFilename(unsafeBasename)
+	safeBasename := DownloadBasename(body.Attachment().Object)
 
 	filePath, err := libkb.FindFilePathWithNumberSuffix(parentDir, safeBasename, useArbitraryName)
 	if err != nil {
@@ -52,6 +52,37 @@ func SinkFromFilename(ctx context.Context, g *globals.Context, uid gregor1.UID,
 	return filePath, sink, nil
 }
 
+// extensionsByMIMEType inverts mimeTypes, keeping the lexically first extension
+// when several share a type (.jpeg over .jpg).
+var extensionsByMIMEType = func() map[string]string {
+	res := make(map[string]string, len(mimeTypes))
+	for ext, typ := range mimeTypes {
+		if cur, ok := res[typ]; !ok || ext < cur {
+			res[typ] = ext
+		}
+	}
+	return res
+}()
+
+// DownloadBasename names the file an asset is saved as. Audio recordings sent
+// before their filename was kept on upload were stored as "." (the Base of an
+// empty path), which would otherwise save with no extension.
+func DownloadBasename(asset chat1.Asset) string {
+	if safe := libkb.GetSafeFilename(asset.Filename); safe != "." && safe != "/" {
+		return safe
+	}
+	if typ, err := asset.Metadata.AssetType(); err == nil && typ == chat1.AssetMetadataType_VIDEO &&
+		asset.Metadata.Video().IsAudio {
+		return "audio.m4a"
+	}
+	if mediaType, _, err := mime.ParseMediaType(asset.MimeType); err == nil {
+		if ext, ok := extensionsByMIMEType[mediaType]; ok {
+			return "attachment" + ext
+		}
+	}
+	return "attachment"
+}
+
 func Download(ctx context.Context, g *globals.Context, uid gregor1.UID,
 	convID chat1.ConversationID, messageID chat1.MessageID, sink io.WriteCloser, showPreview bool,
 	progress func(int64, int64), ri func() chat1.RemoteInterface,
```

**File**: `go/chat/attachments/filename_test.go` (added, +43/-0)
```diff
@@ -0,0 +1,43 @@
+package attachments
+
+import (
+	"context"
+	"testing"
+
+	"github.com/keybase/client/go/chat/utils"
+	"github.com/keybase/client/go/libkb"
+	"github.com/keybase/client/go/protocol/chat1"
+	"github.com/stretchr/testify/require"
+)
+
+func TestPreprocessCallerPreviewKeepsFilename(t *testing.T) {
+	tc := libkb.SetupTest(t, "preprocess", 1)
+	defer tc.Cleanup()
+	ctx := context.Background()
+	log := utils.NewDebugLabeler(tc.G, "preprocess", false)
+	callerPreview, err := (&Sender{DebugLabeler: log}).MakeAudioPreview(ctx, []float64{-10, -20, -30}, 1500)
+	require.NoError(t, err)
+	pre, err := PreprocessAsset(ctx, nil, log, nil, "/tmp/recording-ABC.m4a", nil, &callerPreview)
+	require.NoError(t, err)
+	require.Equal(t, "/tmp/recording-ABC.m4a", pre.Filename)
+}
+
+func TestDownloadBasename(t *testing.T) {
+	audioMd := chat1.NewAssetMetadataWithVideo(chat1.AssetMetadataVideo{IsAudio: true})
+	videoMd := chat1.NewAssetMetadataWithVideo(chat1.AssetMetadataVideo{})
+	cases := []struct {
+		asset chat1.Asset
+		want  string
+	}{
+		{chat1.Asset{Filename: "/tmp/recording-ABC.m4a", MimeType: "video/mp4", Metadata: audioMd}, "recording-ABC.m4a"},
+		{chat1.Asset{Filename: "", MimeType: "video/mp4", Metadata: audioMd}, "audio.m4a"},
+		{chat1.Asset{Filename: ".", MimeType: "video/mp4", Metadata: audioMd}, "audio.m4a"},
+		{chat1.Asset{Filename: ".", MimeType: "text/plain; charset=utf-8"}, "attachment.txt"},
+		{chat1.Asset{Filename: "", MimeType: "video/mp4", Metadata: videoMd}, "attachment.mp4"},
+		{chat1.Asset{Filename: "", MimeType: "image/jpeg"}, "attachment.jpeg"},
+		{chat1.Asset{Filename: "", MimeType: ""}, "attachment"},
+	}
+	for _, c := range cases {
+		require.Equal(t, c.want, DownloadBasename(c.asset), "%+v", c.asset)
+	}
+}
```

**File**: `go/chat/attachments/preprocess.go` (modified, +1/-0)
```diff
@@ -225,6 +225,7 @@ func PreprocessAsset(ctx context.Context, g *globals.Context, log utils.DebugLab
 		if p, err = processCallerPreview(ctx, g, *callerPreview); err != nil {
 			log.Debug(ctx, "preprocessAsset: failed to process caller preview, making fresh one: %s", err)
 		} else {
+			p.Filename = filename
 			return p, nil
 		}
 	}
```

**File**: `go/chat/attachments/uploader.go` (modified, +4/-1)
```diff
@@ -537,7 +537,10 @@ func (u *Uploader) upload(ctx context.Context, uid gregor1.UID, convID chat1.Con
 		}
 	}
 
-	filename = pre.Filename
+	// a preview persisted by an older build can carry an empty filename
+	if pre.Filename != "" {
+		filename = pre.Filename
+	}
 	// Use our converted input, if available
 	if pre.SrcDat != nil {
 		fileSize = int64(len(pre.SrcDat))
```

**File**: `shared/chat/audio/audio-video.tsx` (modified, +5/-5)
```diff
@@ -23,15 +23,14 @@ const MobileAudioVideo = (props: Props) => {
     }
   })
 
-  const [lastPaused, setLastPaused] = React.useState(paused)
-  if (lastPaused !== paused) {
-    setLastPaused(paused)
+  // runs on mount too: this mounts on the first tap with paused=false, and a new player starts paused
+  React.useEffect(() => {
     if (paused) {
       player.pause()
     } else {
       player.play()
     }
-  }
+  }, [paused, player])
 
   return null
 }
@@ -41,7 +40,8 @@ type VideoEl = {pause: () => void; play: () => Promise<void>; currentTime: numbe
 const DesktopAudioVideo = (props: Props) => {
   const {url, paused, onPositionUpdated, onEnded} = props
   const vidRef = React.useRef<VideoEl | null>(null)
-  const lastPausedRef = React.useRef(paused)
+  // a new <video> starts paused, so mounting with paused=false (the first tap) must still call play()
+  const lastPausedRef = React.useRef(true)
 
   React.useEffect(() => {
     if (lastPausedRef.current === paused) return
```

---

### Incident Patch 7: `409c3770` (2026-09-28)
**Commit Message**: fix(chat): share a KBFS file to chat through one conversation-picker flow (#29689)

Mobile turned /keybase/... paths into file:// URLs before the attach
screen, so its kbfs check missed them and iOS handed them to the media
processor as missing local files. Keep kbfs paths as-is.

Desktop drops its own "Attach in conversation" modal and uses the same
conversation list -> attach screen as mobile. The attach screen now
previews kbfs images and videos through the service's file URL and shows
the file icon until it resolves, instead of trying the raw kbfs path.

**File**: `shared/chat/conversation/attachment-get-titles.test.tsx` (modified, +1/-9)
```diff
@@ -1,6 +1,6 @@
 /** @jest-environment jsdom */
 /// <reference types="jest" />
-import {isKbfsPath, pathToAttachmentType} from './attachment-get-titles'
+import {pathToAttachmentType} from './attachment-get-titles'
 
 describe('pathToAttachmentType', () => {
   test('common image extensions preview as images, case insensitively', () => {
@@ -25,11 +25,3 @@ describe('pathToAttachmentType', () => {
     expect(pathToAttachmentType('/tmp/a.png/notanimage')).toBe('file')
   })
 })
-
-describe('isKbfsPath', () => {
-  test('only /keybase/ paths count', () => {
-    expect(isKbfsPath('/keybase/private/testuser/a.png')).toBe(true)
-    expect(isKbfsPath('/tmp/a.png')).toBe(false)
-    expect(isKbfsPath('keybase/private/testuser/a.png')).toBe(false)
-  })
-})
```

**File**: `shared/chat/conversation/attachment-get-titles.tsx` (modified, +22/-15)
```diff
@@ -11,6 +11,7 @@ import {
 } from './attachment-actions'
 import {getConversationClientPrev, useConversationExplodingMode, useConversationMeta} from './data-hooks'
 import AttachmentTrim from './attachment-trim'
+import {isKbfsPath} from './attachment-path'
 import {canEdit, canProcess, isEditNoop, isVideoPath, processPaths, type VideoEdit} from '@/util/media-process'
 
 type OwnProps = {
@@ -48,8 +49,6 @@ export const pathToAttachmentType = (path: string) => {
   return 'file'
 }
 
-export const isKbfsPath = (path: string) => path.startsWith('/keybase/')
-
 const ContainerInner = (ownProps: OwnProps) => {
   const styles = useStyles()
   const {titles: _titles, tlfName, pathAndOutboxIDs} = ownProps
@@ -264,7 +263,7 @@ const ContainerInner = (ownProps: OwnProps) => {
   >()
   const kbfsPreviewURL = kbfsPreview && kbfsPreview.path === path ? kbfsPreview.url : undefined
   React.useEffect(() => {
-    if (info?.type !== 'image' || info.url || !path || !isKbfsPath(path)) {
+    if ((info?.type !== 'image' && info?.type !== 'video') || info.url || !path || !isKbfsPath(path)) {
       return
     }
     let canceled = false
@@ -287,18 +286,28 @@ const ContainerInner = (ownProps: OwnProps) => {
   const titleHint = 'Add a caption...'
   if (!info) return null
 
+  const isKbfs = !!path && isKbfsPath(path)
   // kbfs paths aren't real files, so there's nothing to export from them.
-  const showTrim = !!path && !isKbfsPath(path) && canEdit(path)
+  const showTrim = !!path && !isKbfs && canEdit(path)
+  // A kbfs path isn't loadable as a src; it previews through the service's URL
+  // once that resolves, and as a file until then (or for good if it fails).
+  const mediaSrc = info.url ?? (isKbfs ? kbfsPreviewURL : path)
+  const filePreview = (
+    <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} centerChildren={true}>
+      <Kb.ImageIcon type="icon-file-uploading-48" />
+    </Kb.Box2>
+  )
 
   let preview: React.ReactNode
   switch (info.type) {
     case 'image':
-      preview = path ? (
-        <Kb.ZoomableImage src={info.url ?? kbfsPreviewURL ?? path} style={styles.image} boxCacheKey="getTitlesImg" />
-      ) : null
+      preview = mediaSrc ? (
+        <Kb.ZoomableImage src={mediaSrc} style={styles.image} boxCacheKey="getTitlesImg" />
+      ) : (
+        filePreview
+      )
       break
     case 'video':
-      // kbfs paths aren't real files, so nothing can be exported from them.
       preview = !path ? null : showTrim ? (
         <AttachmentTrim
           // remount per slot AND per clip: duration and handle positions are
@@ -310,19 +319,17 @@ const ContainerInner = (ownProps: OwnProps) => {
             setEdits(s => ({...s, [index]: edit}))
           }}
         />
+      ) : mediaSrc ? (
+        <Kb.Video autoPlay={false} allowFile={!isKbfs} muted={true} url={mediaSrc} />
       ) : (
-        <Kb.Video autoPlay={false} allowFile={true} muted={true} url={path} />
+        filePreview
       )
       break
     default: {
-      if (isIOS && path && Chat.isPathHEIC(path)) {
+      if (isIOS && path && !isKbfs && Chat.isPathHEIC(path)) {
         preview = <Kb.ZoomableImage src={path} style={styles.image} boxCacheKey="getTitlesHeicImg" />
       } else {
-        preview = (
-          <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} centerChildren={true}>
-            <Kb.ImageIcon type="icon-file-uploading-48" />
-          </Kb.Box2>
-        )
+        preview = filePreview
       }
     }
   }
```

**File**: `shared/chat/conversation/attachment-path.test.tsx` (added, +32/-0)
```diff
@@ -0,0 +1,32 @@
+/// <reference types="jest" />
+import {isKbfsPath, toAttachmentPath} from './attachment-path'
+
+describe('isKbfsPath', () => {
+  test('only /keybase/ paths count', () => {
+    expect(isKbfsPath('/keybase/private/testuser/a.png')).toBe(true)
+    expect(isKbfsPath('/tmp/a.png')).toBe(false)
+    expect(isKbfsPath('keybase/private/testuser/a.png')).toBe(false)
+  })
+})
+
+describe('toAttachmentPath on mobile', () => {
+  const originalIsMobile = global.isMobile
+  beforeAll(() => {
+    global.isMobile = true
+  })
+  afterAll(() => {
+    global.isMobile = originalIsMobile
+  })
+
+  test('local paths get the file scheme', () => {
+    expect(toAttachmentPath('/tmp/a.png')).toBe('file:///tmp/a.png')
+  })
+
+  // A file:// kbfs path no longer reads as kbfs, so it would be handed to the
+  // native media processor as a local file that doesn't exist.
+  test('kbfs paths stay kbfs paths', () => {
+    const p = '/keybase/private/testuser,testuser-mac/a.jpeg'
+    expect(toAttachmentPath(p)).toBe(p)
+    expect(isKbfsPath(toAttachmentPath(p))).toBe(true)
+  })
+})
```

**File**: `shared/chat/conversation/attachment-path.tsx` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+import {normalizePath} from '@/styles'
+
+export const isKbfsPath = (path: string) => path.startsWith('/keybase/')
+
+// Local files need the file:// scheme on mobile, but kbfs paths aren't on disk:
+// the service reads them through SimpleFS and they must stay recognizable as kbfs.
+export const toAttachmentPath = (path: string) => (isKbfsPath(path) ? path : normalizePath(path))
```

**File**: `shared/chat/routes.tsx` (modified, +7/-14)
```diff
@@ -125,16 +125,8 @@ const AddToChannelHeaderRight = () => {
   )
 }
 
-const SendToChatHeaderLeft = ({canBack}: {canBack?: boolean}) => {
+const SendToChatHeaderLeft = () => {
   const clearModals = C.Router2.clearModals
-  const navigateUp = C.Router2.navigateUp
-  if (canBack) {
-    return (
-      <Kb.Text type="BodyBigLink" onClick={navigateUp}>
-        Back
-      </Kb.Text>
-    )
-  }
   return (
     <Kb.Text type="BodyBigLink" onClick={clearModals}>
       Cancel
@@ -315,12 +307,13 @@ export const newModalRoutes = defineRouteMap({
       getOptions: ({route}) => ({
         ...(isIOS
           ? {
-              unstable_headerLeftItems: () =>
-                route.params.canBack
-                  ? [Kb.nativeBackHeaderItem()]
-                  : [Kb.nativeCancelHeaderItem(C.Router2.clearModals)],
+              unstable_headerLeftItems: () => [Kb.nativeCancelHeaderItem(C.Router2.clearModals)],
             }
-          : {headerLeft: () => <SendToChatHeaderLeft canBack={route.params.canBack} />}),
+          : isMobile
+            ? {headerLeft: () => <SendToChatHeaderLeft />}
+            : {}),
+        // sized like chatAttachmentGetTitles, which it pushes, so the modal doesn't jump
+        modalSize: 'wide',
         title: FS.getSharePathArrayDescription(route.params.sendPaths || []),
       }),
       skipProvider: true,
```

**File**: `shared/chat/send-to-chat/conversation-list/choose-conversation.tsx` (removed, +0/-65)
```diff
@@ -1,65 +0,0 @@
-import * as Kb from '@/common-adapters'
-import type * as T from '@/constants/types'
-import ConversationList from './conversation-list'
-
-type Props = {
-  convName: string
-  dropdownButtonStyle?: Kb.Styles.StylesCrossPlatform
-  onSelect: (conversationIDKey: T.Chat.ConversationIDKey, convName: string) => void
-}
-
-const ChooseConversation = (props: Props) => {
-  const styles = useStyles()
-  const {onSelect} = props
-  const text = !props.convName.length ? 'Choose a conversation' : props.convName
-
-  const makePopup = (p: Kb.Popup2Parms) => {
-    const {attachTo, hidePopup} = p
-    return (
-      <Kb.Popup
-        intent="menu"
-        attachTo={attachTo}
-        onHidden={hidePopup}
-        position="center center"
-        style={styles.overlay}
-      >
-        <ConversationList onSelect={onSelect} onDone={hidePopup} />
-      </Kb.Popup>
-    )
-  }
-  const {showPopup, popup, popupAnchor} = Kb.usePopup2(makePopup)
-
-  return (
-    <>
-      <Kb.DropdownButton
-        selected={
-          <Kb.Text type="BodySemibold" style={styles.selectedText}>
-            {text}
-          </Kb.Text>
-        }
-        popupAnchor={popupAnchor}
-        toggleOpen={showPopup}
-        style={Kb.Styles.collapseStyles([styles.dropdownButton, props.dropdownButtonStyle])}
-      />
-      {popup}
-    </>
-  )
-}
-
-export default ChooseConversation
-
-const useStyles = Kb.Styles.createStyleHook(
-  theme =>
-    ({
-      dropdownButton: {width: 300},
-      overlay: {
-        backgroundColor: theme.white,
-        height: 360,
-        width: 300,
-      },
-      selectedText: {
-        paddingLeft: Kb.Styles.globalMargins.xsmall,
-        width: '100%',
-      },
-    }) as const
-)
```

**File**: `shared/chat/send-to-chat/conversation-list/conversation-list.tsx` (modified, +1/-6)
```diff
@@ -10,7 +10,6 @@ import {Avatars, TeamAvatar} from '@/chat/avatars'
  * sure it doesn't break there if you make changes to this file. */
 
 type Props = {
-  onDone?: () => void
   onSelect: (conversationIDKey: T.Chat.ConversationIDKey, convName: string) => void
 }
 
@@ -54,7 +53,7 @@ const Row = React.memo(function Row(p: RowProps) {
 })
 
 const ConversationList = (props: Props) => {
-  const {onDone, onSelect: _onSelect} = props
+  const {onSelect} = props
 
   const [query, setQuery] = React.useState('')
   const [waiting, setWaiting] = React.useState(false)
@@ -78,10 +77,6 @@ const ConversationList = (props: Props) => {
       }
     )
   }
-  const onSelect = (convID: T.Chat.ConversationIDKey, convName: string) => {
-    _onSelect(convID, convName)
-    onDone?.()
-  }
   return (
     <ConversationListRender
       selected={selected}
```

**File**: `shared/chat/send-to-chat/index.tsx` (modified, +5/-140)
```diff
@@ -1,22 +1,15 @@
 import * as C from '@/constants'
-import * as Chat from '@/constants/chat'
-import * as T from '@/constants/types'
-import * as React from 'react'
-import * as Kb from '@/common-adapters'
-import * as Kbfs from '@/fs/common'
+import type * as T from '@/constants/types'
 import ConversationList from './conversation-list/conversation-list'
-import ChooseConversation from './conversation-list/choose-conversation'
-import {useCurrentUserState} from '@/stores/current-user'
-import {uploadAttachments} from '../conversation/attachment-actions'
+import {toAttachmentPath} from '../conversation/attachment-path'
 
 type Props = {
-  canBack?: boolean
   isFromShareExtension?: boolean
   text?: string // incoming share (text)
   sendPaths?: Array<string> // KBFS or incoming share (files)
 }
 
-export const MobileSendToChat = (props: Props) => {
+export const SendToChat = (props: Props) => {
   const {isFromShareExtension, sendPaths, text} = props
   const navigateAppend = C.Router2.navigateAppend
   const clearModals = C.Router2.clearModals
@@ -27,9 +20,7 @@ export const MobileSendToChat = (props: Props) => {
         params: {
           conversationIDKey,
           inputPrefillText: text,
-          pathAndOutboxIDs: sendPaths.map(p => ({
-            path: Kb.Styles.normalizePath(p),
-          })),
+          pathAndOutboxIDs: sendPaths.map(p => ({path: toAttachmentPath(p)})),
           selectConversationWithReason: isFromShareExtension ? 'extension' : 'files',
           tlfName,
         },
@@ -41,133 +32,7 @@ export const MobileSendToChat = (props: Props) => {
       })
     }
   }
-  return <ConversationList {...props} onSelect={onSelect} />
+  return <ConversationList onSelect={onSelect} />
 }
 
-const noPaths = new Array<string>()
-const DesktopSendToChat = (props: Props) => {
-  const sendPaths = props.sendPaths ?? noPaths
-  const [title, setTitle] = React.useState('')
-  const [conversationIDKey, setConversationIDKey] = React.useState(Chat.noConversationIDKey)
-  const [convName, setConvName] = React.useState('')
-  const username = useCurrentUserState(s => s.username)
-  const clearModals = C.Router2.clearModals
-  const onCancel = () => {
-    clearModals()
-  }
-  const onSelect = (convID: T.Chat.ConversationIDKey, convname: string) => {
-    setConversationIDKey(convID)
-    setConvName(convname)
-  }
-  const onSend = () => {
-    sendPaths.forEach(path =>
-      uploadAttachments({
-        clientPrev: T.Chat.numberToMessageID(0),
-        conversationIDKey,
-        ephemeralLifetime: 0,
-        paths: [{path: T.FS.pathToString(path)}],
-        titles: [title],
-        tlfName: `${username},${convName.split('#')[0]}`,
-      })
-    )
-    clearModals()
-    C.Router2.navigateToThread(conversationIDKey, 'files')
-  }
-  return (
-    <DesktopSendToChatRender
-      enabled={conversationIDKey !== Chat.noConversationIDKey}
-      convName={convName}
-      // If we ever support sending multiples from desktop this will need to
-      // change.
-      path={sendPaths[0]}
-      title={title}
-      setTitle={setTitle}
-      onSend={onSend}
-      onSelect={onSelect}
-      onCancel={onCancel}
-    />
-  )
-}
-
-type DesktopSendToChatRenderProps = {
-  enabled: boolean
-  convName: string
-  path: T.FS.Path
-  title: string
-  setTitle: (title: string) => void
-  onSend: () => void
-  onCancel: () => void
-  onSelect: (convID: T.Chat.ConversationIDKey, convName: string) => void
-}
-
-export const DesktopSendToChatRender = (props: DesktopSendToChatRenderProps) => {
-  const desktopStyles = useDesktopStyles()
-  return (
-    <Kb.Box2 direction="vertical" style={desktopStyles.container} centerChildren={true}>
-      <Kb.Box2 direction="horizontal" centerChildren={true} style={desktopStyles.header} fullWidth={true}>
-        <Kb.Text type="Header">Attach in conversation</Kb.Text>
-      </Kb.Box2>
-      <Kb.Box2 direction="vertical" alignItems="center" style={desktopStyles.belly} fullWidth={true}>
-        <Kb.Box2
-          direction="vertical"
-          centerChildren={true}
-          fullWidth={true}
-          style={desktopStyles.pathItem}
-          gap="tiny"
-        >
-          <Kbfs.ItemIcon size={48} path={props.path} badgeOverride="iconfont-attachment" />
-          <Kb.Text type="BodySmall">{T.FS.getPathName(props.path)}</Kb.Text>
-        </Kb.Box2>
-        <ChooseConversation
-          convName={props.convName}
-          dropdownButtonStyle={desktopStyles.dropdown}
-          onSelect={props.onSelect}
-        />
-        <Kb.Input3
-          textType="BodySemibold"
-          placeholder="Title"
-          value={props.title}
-          onChangeText={props.setTitle}
-        />
-      </Kb.Box2>
-      <Kb.ConfirmButtons
-        onCancel={props.onCancel}
-        onConfirm={props.onSend}
-        confirmLabel="Send in conversation"
-        confirmDisabled={!props.enabled}
-      />
-    </Kb.Box2>
-  )
-}
-
-const SendToChat = isMobile ? MobileSendToChat 
```

---

### Incident Patch 8: `10af1e5d` (2026-09-28)
**Commit Message**: CLAUDE.md: add debugging rules (evidence before diagnosis, base-branch check, whole-repo dead-code search) (#29688)

**File**: `CLAUDE.md` (modified, +6/-0)
```diff
@@ -20,6 +20,12 @@
 - Keep an open PR's description in step with its branch. Whenever new commits change what the PR does or how (a new fix, a changed approach, a removed piece, new tests or evidence), rewrite the affected sections with `gh pr edit --body-file`, and the title if the scope moved. It should read as a description of the current diff, not a changelog. Skip it for commits that don't change the story (lint, renames, test placeholders).
 - Never patch `react-native` itself (patch-package or node_modules edits): we use prebuilt RN core and don't compile its source, so native-side patches never take effect. Work around RN core bugs in app code.
 
+## Debugging
+- Evidence before diagnosis: when the user reports seeing something, never answer "that can't happen" from reading code. Reproduce it or add logging first, and only then name a cause.
+- For a user-reported runtime bug, check whether it reproduces on the base branch before blaming the current branch. (Lint, tsc and test failures after our changes are still ours.)
+- Before calling code dead, search the whole repo (desktop, native, Go callers, string-built names), not one directory.
+- Prefer fixes that keep underlying state truthful (e.g. a UI-level hold) over changing state semantics, unless asked.
+
 ## Working Directory
 Repo root is `client/`. TS source lives in `shared/`. Always use absolute paths for file ops. For Bash: always `cd shared/` first.
 
```

---

### Incident Patch 9: `434e2d1d` (2026-09-28)
**Commit Message**: docs(skills): fix stale facts and conflicting rules in agent instructions (#29687)

Point prod-bundles and update-dependencies at the Vite build, drop the
removed morgan resolution, validate with yarn lint:all everywhere, keep
plan files uncommitted, move screenshot skills to playwright-cli, and
remove the stale merge log, grep claim, and hardcoded home path.

**File**: `AGENTS.md` (modified, +1/-1)
```diff
@@ -19,4 +19,4 @@
 - During refactors, do not delete existing guards, conditionals, or platform/test-specific behavior unless you have proven they are dead and the user asked for that behavior change. Port checks like `androidIsTestDevice` forward into the new code path instead of silently dropping them.
 - When addressing PR or review feedback, including bot or lint-style suggestions, do not apply it mechanically. Verify that the reported issue is real in this codebase and that the proposed fix is consistent with repo rules and improves correctness, behavior, or maintainability before making changes.
 - When a repo plan starts with a test or regression-coverage chunk, do that chunk before implementation chunks. Do not skip the first coverage phase; if local toolchain constraints prevent adding or running the planned tests, stop and tell the user before moving on.
-- When working from a repo plan or checklist such as `PLAN.md`, update the checklist in the same change and mark implemented items done before you finish.
+- When working from a plan or checklist under `plans/`, mark implemented items done as you go. Plan files are scratch and stay uncommitted.
```

**File**: `plans/flow-test.md` (removed, +0/-327)
```diff
@@ -1,327 +0,0 @@
-# E2E Flow Test Coverage — Page Checklist
-
-**Skill:** Use the `keybase-e2e-tests` skill for testID conventions, Playwright gotchas, Appium/WebdriverIO patterns, and iOS navigation structure.
-
-Each bucket is a logical group for one or more PRs. Items are ordered easiest-first within each bucket. Validate after each bucket before moving on.
-
-**Pairing rule:** Buckets 1–15: do Electron and iOS together. Buckets 16+ (visual-coverage expansion): Electron first; iOS gets a follow-up pass once the desktop suite is stable.
-
-**Branch scripts:** `yarn test:e2e:desktop:branch` and `yarn test:e2e:ios:branch` run only the new flows being developed. When a flow is verified working on both platforms, remove it from the branch scripts. When adding a new bucket's test files, add them to both scripts.
-
-**Goal:** 100% visual coverage of the app. Every test's final screenshot is a visual-regression baseline (playwright `screenshot: 'on'` + `yarn test:e2e:desktop:save-baseline`), and the dark-mode project doubles every shot for free. So coverage = one test per distinct visual state: routes, modals, popups, scroll positions, filled inputs.
-
-**Mutations are now IN SCOPE** when the flow is reproducible:
-- **Create → cleanup in the same test.** A test that creates something must delete it before it ends (git repo, channel, email address, paper key). Use fixed `e2e-vis-*` names and delete any leftover at test start so a crashed run self-heals.
-- **Open → cancel is always fine.** Any modal/wizard can be opened and screenshotted as long as the test cancels before the final submit when the mutation isn't cleanly reversible.
-- **Never touch:** account deletion/reset, revoking a real device (paper keys created by the test are OK), logging out, changing the password, verifying a phone number, creating/revoking real proofs, leaving or deleting real teams, blocking real users. See the Forbidden list at the bottom.
-- Avoid visual nondeterminism: created objects use fixed names, message sends go to a dedicated e2e conversation (accept that its history grows — screenshot the input/modal states, not the message list).
-
-**testID rule:** Never wrap existing component content in a new `Kb.Box2` (or any container) just to attach a `testID`. Instead, add the `testID` prop directly to an element that already exists in the component — an input, a scroll view, a pre-existing wrapper, etc.
-
----
-
-## Bucket 1 — Crypto sub-tabs (inputs)
-
-Navigate to each sub-tab in the Crypto section.
-
-- [x] Encrypt input renders
-- [x] Decrypt input renders
-- [x] Sign input renders
-- [x] Verify input renders
-
----
-
-## Bucket 2 — Crypto outputs
-
-Type something in each sub-tab and run it to see the output screen. Local-only operation, no server mutation.
-
-- [x] Encrypt → output screen renders (Electron ✓, iOS written)
-- [x] Decrypt → output screen renders — encrypt first, feed ciphertext to decrypt (Electron ✓, iOS: needs clipboard support, skipped)
-- [x] Sign → output screen renders (Electron ✓, iOS written)
-- [x] Verify → output screen renders — sign first, feed signed text to verify (Electron ✓, iOS: needs clipboard support, skipped)
-
----
-
-## Bucket 3 — Chat: conversation view
-
-Open an existing conversation. No sending.
-
-- [x] Open first inbox row → message list renders (Electron ✓, iOS written)
-- [x] Chat input visible in open conversation (Electron ✓, iOS: chat-send-message.yaml already covers this)
-- [x] Return to inbox from conversation (Electron ✓, iOS written)
-
----
-
-## Bucket 4 — Chat: in-conversation modals
-
-From an open conversation, open each of these. Dismiss/cancel without submitting.
-
-- [x] Info panel (the ⓘ / conversation info button) (Electron ✓ chat-modals.test.ts, iOS ✓ visual-states.test.ts via native More→Info menu)
-- [x] Message popup / context menu (long-press or right-click a message) (Electron ✓)
-- [x] Emoji picker (tap emoji button in input area) (Electron ✓)
-- [x] Search bots modal (info panel → Bots → Add a bot) (Electron ✓)
-- [x] Bot info / install preview — open a bot, view, don't install (`chatInstallBot`) (Electron ✓)
-- [ ] Bot team picker (`chatInstallBotPick`) — view destinations, cancel
-- [x] Forward message pick (`chatForwardMsgPick`) — view destinations, cancel (Electron ✓)
-- [x] Attachment fullscreen (`chatAttachmentFullscreen`) — requires a message with an image (Electron ✓, iOS ✓)
-- [ ] PDF viewer (`chatPDF`) — requires a seeded PDF message
-- [ ] Location map popup (`chatUnfurlMapPopup`) — requires a message with a location unfurl
-- [ ] External link warning (`chatConfirmNavigateExternal`) — click an http link in a message (seed via send)
-
----
-
-## Bucket 5 — Settings sub-pages (batch 1)
-
-Navigate from the Settings nav. Confirm renders, go back.
-
-- [x] About (Electron ✓, iOS written)
-- [x] Advanced (Electron ✓, iOS written)
-- [x] Display (Electron ✓, iOS written)
-- [x] Notifications (Electron ✓, iOS written)
-- [x] Feedback (Electron ✓, iOS 
```

**File**: `skill/electron-screenshot/SKILL.md` (modified, +16/-11)
```diff
@@ -3,37 +3,42 @@ name: electron-screenshot
 description: This skill should be used when the user asks to "take a desktop screenshot", "screenshot the electron app", "show me the desktop app", "what does the app look like", or mentions checking the Electron/desktop UI visually.
 ---
 
-Take a screenshot of the running Electron app via Playwright MCP and display it.
+Take a screenshot of the running Electron app with `playwright-cli` and display it. The playwright-cli skill's "Connecting to the Electron App" section has the details on attaching and tab selection.
 
 ## Prerequisites
 
 The Electron app must be running with remote debugging enabled:
 ```
-KB_ENABLE_REMOTE_DEBUG=1 yarn desktop:start:hot
+cd shared && KB_ENABLE_REMOTE_DEBUG=1 yarn desktop:start:hot
 ```
 This launches Electron with `--remote-debugging-port=9222`.
 
 ## Steps
 
-1. Close the DevTools tab first to avoid stale data. Use `browser_tabs` with action=list, then action=close on the DevTools tab (usually index 0).
+1. Attach (once per session; `--persistent` is required for Electron):
+   ```
+   PLAYWRIGHT_MCP_CDP_ENDPOINT=http://localhost:9222 playwright-cli open --persistent
+   ```
 
-2. Select the main app window tab (the one titled "Keybase: ..." — usually index 1 after DevTools is closed it becomes index 0). Use `browser_tabs` with action=list then action=select.
+2. Select the main app window. Tab order is not stable, so never reuse a remembered index: run `playwright-cli tab-list`, `playwright-cli tab-select <index>` on the row whose URL contains `main.html`, and confirm with `playwright-cli eval "location.href"`.
 
-3. Take a screenshot with `browser_take_screenshot`.
+3. Take the screenshot:
+   ```
+   playwright-cli screenshot --filename=/tmp/electron-screenshot-full.png
+   ```
 
-4. The screenshot is saved to a temp file. Resize it for token efficiency:
+4. Resize it for token efficiency:
    ```
-   sips -Z 800 <screenshot_path> --out /tmp/electron-screenshot.png
+   sips -Z 800 /tmp/electron-screenshot-full.png --out /tmp/electron-screenshot.png
    ```
 
-5. Use the Read tool to display `/tmp/electron-screenshot.png` to the user.
+5. Use the Read tool to display `/tmp/electron-screenshot.png` to the user. If it shows the menubar or DevTools instead of the main window, go back to step 2.
 
 ## Error Handling
 
-- If Playwright MCP cannot connect, tell the user the Electron app may not be running with remote debugging. Suggest launching with `cd shared && KB_ENABLE_REMOTE_DEBUG=1 yarn desktop:start:hot`.
-- If `sips` fails, fall back to displaying the original screenshot directly.
+- If playwright-cli cannot connect, tell the user the Electron app may not be running with remote debugging. Suggest launching with `cd shared && KB_ENABLE_REMOTE_DEBUG=1 yarn desktop:start:hot`.
+- If `sips` fails, fall back to displaying the full-size screenshot directly.
 
 ## Notes
 
-- Tab 0 is typically DevTools, Tab 1 is the main app, Tab 2 is the menubar. Always close DevTools first — when it's open, `browser_evaluate` and `browser_snapshot` run against DevTools instead of the app.
 - 800px max dimension gives good legibility with ~90% token savings.
```

**File**: `skill/keybase-e2e-tests/SKILL.md` (modified, +2/-6)
```diff
@@ -7,7 +7,7 @@ description: Use when writing, fixing, or adding e2e flow tests for the Keybase
 
 ## Overview
 
-Two harnesses, one shared testID registry. Always implement Electron + iOS for each bucket together (pairing rule in `plans/flow-test.md`).
+Two harnesses, one shared testID registry. Implement each flow on Electron and iOS together.
 
 ## Shared testID Registry
 
@@ -52,15 +52,11 @@ Drives the **already-installed** app black-box (no rebuild). Selectors: `~<testI
 **Gotchas (hard-won — read before adding flows):**
 - **Native tab bar:** tap tabs by **label** (`tab('People')` → `~People`), NOT `nav-tab-*` testIDs — those don't reach the native `UITabBar`.
 - **Container testIDs** (a flex `Kb.Box2` wrapping a list) report `visible="false"` to XCUITest even when on screen → use `waitForTestID` (it uses `waitForExist`, presence), never `toBeDisplayed`.
-- **testIDs must be on the MOBILE-rendered element.** Many components branch on `isMobile`/`.desktop`/`.native`; a desktop-only testID is invisible on iOS (see [[project_e2e_testid_mobile_branch]]). Put the testID on the **clickable/leaf** element (e.g. `Kb.ListItem`'s `testID`, a `ClickableBox`), not a non-clickable wrapping `Box2` — wdio `.click()` no-ops on a non-accessible container.
+- **testIDs must be on the MOBILE-rendered element.** Many components branch on `isMobile`/`.desktop`/`.native`; a desktop-only testID is invisible on iOS, so a flow that waits on it passes on desktop while testing nothing on iOS. Put the testID on the **clickable/leaf** element (e.g. `Kb.ListItem`'s `testID`, a `ClickableBox`), not a non-clickable wrapping `Box2` — wdio `.click()` no-ops on a non-accessible container.
 - **`byText` uses CONTAINS** — tappable rows have merged accessibility labels (e.g. `", Crypto"`), so exact match fails.
 - **`Kb.Tabs`** supports a per-tab `testID` (needed for icon-only tabs like the team Settings gear). The app remembers the last-selected team tab → select tabs by testID, don't assume the default.
 - **Modals:** dismiss via Done/Close/Cancel (`escapeToTabs` does this first, before back buttons — a modal's back button is a no-op that loops).
 - **HMR applies testID/component changes** to the running sim app — no manual reload needed when adding testIDs.
 - Wait for a **real data row** (not just the list container) before asserting/screenshotting, so shots show loaded content.
 
 **iOS tab structure:** People & Teams are direct tabs; Chat & Files have their own nav helpers; Crypto/Devices/Git/Settings live under the **More** tab (`navigateToMore`).
-
-## Plan
-
-`plans/flow-test.md` — bucket checklist ordered easiest-first. Work one bucket at a time, both platforms together.
```

**File**: `skill/keybase-rpc-log-analysis/SKILL.md` (modified, +0/-2)
```diff
@@ -175,8 +175,6 @@ not `getMessagesRemote`. The script says so when it finds no counts.
   for it. Check whether it recurs on a timer before spending time on it.
 - **Reporting a burst as same-subject when it is not.** See the BURSTS caveat
   above. If it matters, prove the subject repeats before claiming it.
-- **Using plain `grep`.** It is wrapped in this environment and truncates. Use
-  python, as the scripts do.
 - **Comparing unlike runs.** `rpc-diff.py` is only meaningful if both runs did
   the same thing — same tests, same order, same project, renderer reloaded
   between them. See "Prove a fix".
```

**File**: `skill/keybase-style-analysis/SKILL.md` (modified, +3/-3)
```diff
@@ -22,7 +22,7 @@ Skip extract when:
 ### Phase 1: Extract (run from shared/)
 
 ```bash
-cd /Users/chrisnojima/go/src/github.com/keybase/client/shared
+cd shared
 node scripts/analyze-styles.mts extract --output /tmp/keybase-styles.json
 ```
 
@@ -32,7 +32,7 @@ Takes ~10–30 seconds. Writes structured JSON with one entry per style object (
 
 Full audit — gaps + new candidates:
 ```bash
-cd /Users/chrisnojima/go/src/github.com/keybase/client/shared
+cd shared
 node scripts/analyze-styles.mts analyze --input /tmp/keybase-styles.json
 ```
 
@@ -75,4 +75,4 @@ When recommending a new helper, include: what it would be named, its signature,
 
 - For gap sites: offer to migrate them file-by-file or all at once
 - For new helper candidates: present the proposed helper signature and get approval before adding it
-- After migrating, run `yarn lint && yarn tsc` from `shared/` to verify
+- After migrating, run `yarn lint:all` from `shared/` to verify
```

**File**: `skill/merge-master/SKILL.md` (modified, +1/-12)
```diff
@@ -94,8 +94,7 @@ After all commits are processed:
 
 **TypeScript** (from `shared/`):
 ```bash
-yarn lint
-yarn tsc
+yarn lint:all
 ```
 
 **Go** (from `go/`):
@@ -120,13 +119,3 @@ git merge --continue
 ```
 
 Use this approach when there are many commits and the conflict markers clearly show the divergence. Use the per-commit approach when conflicts are ambiguous or when you need to understand each change's intent before applying it.
-
-## Merge History
-
-| Date | Branch | Last master commit merged |
-|------|--------|--------------------------|
-| 2026-05-04 | nojima/HOTPOT-next-670-clean-2 | 0a255e2f88 (fix race on HUD after a command) |
-| 2026-05-19 | nojima/HOTPOT-next-670-clean-2 | 44af33002554ea4f81d4bca766fe642ad154e883 (fix UI bugs) |
-| 2026-05-26 | nojima/HOTPOT-next-670-clean-2 | ecfd22f61208ab37ec6c48e843f56c39fe128e4b (backport retry fixes) |
-| 2026-05-29 | nojima/HOTPOT-next-670-clean-2 | 7c434a8686d2b6d2e38366b8675f360bbace9f34 (fix additional api retry args) |
-| 2026-06-03 | nojima/HOTPOT-next-670-clean-2 | c067f2a368f0889b61ff70518933d6c69c4b96b3 (bump golang.org/x/image) |
```

**File**: `skill/prod-bundles/SKILL.md` (modified, +4/-5)
```diff
@@ -1,13 +1,13 @@
 ---
 name: prod-bundles
-description: Use when the user asks to build production bundles, check bundle sizes, audit tree-shaking, or verify mobile/desktop code separation. Covers both the desktop webpack prod build and the iOS/Android Metro bundle.
+description: Use when the user asks to build production bundles, check bundle sizes, audit tree-shaking, or verify mobile/desktop code separation. Covers both the desktop Vite prod build and the iOS/Android Metro bundle.
 ---
 
 Build production bundles for both platforms and analyze them for correct tree-shaking.
 
 ## Build Commands
 
-**Desktop (webpack):**
+**Desktop (Vite):**
 ```bash
 # From shared/
 yarn desktop:build:prod
@@ -57,7 +57,6 @@ for name in ['isMobile', 'isElectron', 'isAndroid', 'isIOS']:
 
 ## Key Facts
 
-- **Webpack (desktop)**: `DefinePlugin` replaces bare globals (`isMobile`, `isElectron`, etc.) with literals. Terser DCEs dead branches. Works cross-module.
+- **Vite (desktop)**: the `define` block in `shared/vite.config.mts` (`makeDefines`) replaces bare globals (`isMobile`, `isElectron`, etc.) with literals, and the prod minifier drops the dead branches.
 - **Metro (iOS/Android)**: The `makePlatformPlugin` Babel plugin in `babel.config.js` inlines the same globals at transform time, enabling Metro's `constant-folding-plugin` to DCE dead branches.
-- **Native-only module aliasing** (desktop): packages in `shared/native-only-modules.js` are aliased to `shared/null-module.js` by webpack. Changes to that file require clearing the webpack cache: `rm -rf shared/node_modules/.cache/webpack`.
-- **Webpack cache invalidation**: `shared/desktop/webpack.config.mts` lists `buildDependencies` — if you add a new file that affects the build, add it there so cache auto-invalidates.
+- **Native-only module aliasing** (desktop): packages in `shared/native-only-modules.js` are aliased to `shared/null-module.js` by the resolve config in `shared/vite.config.mts`, and pre-bundled through `optimizeDeps`. After changing that file, clear Vite's dep cache: `rm -rf shared/node_modules/.vite`.
```

---

### Incident Patch 10: `a293644b` (2026-09-25)
**Commit Message**: fix(router): keep the logged-in screens mounted through an account switch (#29622)

* fix(mobile): keep the logged-in screens mounted through an account switch

A switch flaps config.loggedIn false and back to true. The mobile root stack
followed it, so every switch swapped to the logged-out stack, back, and then
remounted the navigator, three native rebuilds in about 130 ms. RNS logged
unbalanced appearance transitions, and could leave the torn-down navigator's
screens on top. Every touch was then dropped and the app looked frozen. It
also sometimes logged an unhandled POP for the root 'loggedIn' screen.

Hold the mobile logged-in screens through a switch that started logged in
(showLoggedInScreens). A switch that starts logged out, e.g. a notification
tap on the login screen, keeps the logged-out screens until it lands.
Desktop keeps its loggedIn || userSwitching gate.

Holding the logged-in screens means userSwitching must clear whenever a
switch ends without the remount:
- login() now clears it when it cancels one of its own prompts, and when it
  fails without an RPCError. Otherwise the app stayed on the old account's
  screens with reset stores.
- The provisioning hand-off cl

**File**: `CLAUDE.md` (modified, +2/-1)
```diff
@@ -17,6 +17,7 @@
 - After editing `protocol/avdl/` or `protocol/bin/enabled-calls.json`: from `protocol/`, run `node ./bin/generate-ts.ts && cp ./js/rpc*.tsx ../shared/constants/rpc` and commit the regenerated `shared/constants/rpc/rpc-gen.tsx`.
 - Never hand-edit generated code (rpc-gen, protocol output, mocks, codegen'd files of any kind). Edit the source it's generated from and rerun the generator. CI regenerates and fails on any diff.
 - When updating `electron`: run `shared/desktop/extract-electron-shasums.sh <version>`.
+- Keep an open PR's description in step with its branch. Whenever new commits change what the PR does or how (a new fix, a changed approach, a removed piece, new tests or evidence), rewrite the affected sections with `gh pr edit --body-file`, and the title if the scope moved. It should read as a description of the current diff, not a changelog. Skip it for commits that don't change the story (lint, renames, test placeholders).
 - Never patch `react-native` itself (patch-package or node_modules edits): we use prebuilt RN core and don't compile its source, so native-side patches never take effect. Work around RN core bugs in app code.
 
 ## Working Directory
@@ -29,4 +30,4 @@ Repo root is `client/`. TS source lives in `shared/`. Always use absolute paths
 ## Validation
 After TS changes (from `shared/`): `yarn lint:all` (= `yarn lint` && `yarn lint:bailouts` && `yarn tsc`). Plain `yarn lint` is eslint only and does NOT catch react-compiler bailouts — no compiler rule is wired into `eslint.config.mjs`, so bailouts only surface via `lint:bailouts`. `lint:bailouts` also flags components the compiler cannot name (an `isMobile ? arrow : arrow` ternary is never compiled at all, so nothing in it is memoized — name both branches instead), and memo scopes keyed on the whole props object (a `props.x` read inside a callback, or a destructure below one, makes the compiler key on `props` itself, so the cache never hits — read every prop through one destructure at the top, above every callback). Repo baseline is 0 bailouts and 0 whole-props deps; keep it there. When debugging visually, skip until fix is confirmed. Never delete the ESLint cache.
 
-Before reporting any TS change complete: run `yarn lint:all` and get it clean. Do NOT run `/code-review` while iterating, building, testing, or debugging — only once the change is about to be pushed (commit for a PR, push, or open a PR). At that point, if the diff has real logic in it, run `/code-review high` against the diff and fix what it finds; if a finding is wrong, say why instead of applying it. Skip the review for trivial diffs (a config/JSON line, a codegen resync, a typo) and say you skipped it.
+Before reporting any TS change complete: run `yarn lint:all` and get it clean. Do NOT run `/code-review` while iterating, building, testing, or debugging — only once the change is about to be pushed (commit for a PR, push, or open a PR). At that point, first get both `yarn lint:all` and `yarn test:unit` passing — never review, push, or open a PR with either failing. Then, if the diff has real logic in it, run `/code-review high` against the diff and fix what it finds; if a finding is wrong, say why instead of applying it. Skip the review for trivial diffs (a config/JSON line, a codegen resync, a typo) and say you skipped it.
```

**File**: `shared/chat/conversation/input-area/input-state.test.tsx` (modified, +82/-0)
```diff
@@ -962,3 +962,85 @@ test('a commandStatus written while the provider is frozen is applied on thaw',
 
   expect(inputState?.commandStatus).toEqual(commandStatusInfo)
 })
+
+describe('a pending draft save', () => {
+  const typeThenWait = (switchAccount: boolean) => {
+    jest.useFakeTimers()
+    try {
+      const saveDraft = jest.spyOn(T.RPCChat, 'localUpdateUnsentTextRpcPromise').mockResolvedValue(undefined)
+      jest.spyOn(T.RPCChat, 'localUpdateTypingRpcPromise').mockResolvedValue(undefined)
+      renderComposer()
+      act(() => {
+        mockPlatformInputProps?.onChangeText('a')
+      })
+      // inside the 200ms throttle, so this save waits for its trailing edge
+      act(() => {
+        mockPlatformInputProps?.onChangeText('ab')
+      })
+      if (switchAccount) {
+        act(() => {
+          useCurrentUserState.getState().dispatch.setBootstrap({
+            deviceID: 'device-id-2',
+            deviceName: 'test-device-2',
+            uid: 'uid-2',
+            username: 'testuser-mac',
+          })
+        })
+      }
+      act(() => {
+        jest.advanceTimersByTime(250)
+      })
+      return saveDraft.mock.calls.map(c => c[0].text)
+    } finally {
+      jest.useRealTimers()
+    }
+  }
+
+  test('is saved for the account that typed it', () => {
+    expect(typeThenWait(false)).toContain('ab')
+  })
+
+  test('is not saved for the next account when a switch lands first', () => {
+    expect(typeThenWait(true)).not.toContain('ab')
+  })
+})
+
+describe('a draft typed just before leaving the conversation', () => {
+  const typeThenUnmount = (switchAccount: boolean) => {
+    jest.useFakeTimers()
+    try {
+      const saveDraft = jest.spyOn(T.RPCChat, 'localUpdateUnsentTextRpcPromise').mockResolvedValue(undefined)
+      jest.spyOn(T.RPCChat, 'localUpdateTypingRpcPromise').mockResolvedValue(undefined)
+      const {unmount} = renderComposer()
+      act(() => {
+        mockPlatformInputProps?.onChangeText('a')
+      })
+      // inside the 200ms throttle, so this save is still pending at unmount
+      act(() => {
+        mockPlatformInputProps?.onChangeText('ab')
+      })
+      if (switchAccount) {
+        act(() => {
+          useCurrentUserState.getState().dispatch.setBootstrap({
+            deviceID: 'device-id-2',
+            deviceName: 'test-device-2',
+            uid: 'uid-2',
+            username: 'testuser-mac',
+          })
+        })
+      }
+      unmount()
+      return saveDraft.mock.calls.map(c => c[0].text)
+    } finally {
+      jest.useRealTimers()
+    }
+  }
+
+  test('is saved when the composer unmounts', () => {
+    expect(typeThenUnmount(false)).toContain('ab')
+  })
+
+  test('is not saved for the next account when the unmount comes from a switch', () => {
+    expect(typeThenUnmount(true)).not.toContain('ab')
+  })
+})
```

**File**: `shared/chat/conversation/input-area/normal/index.tsx` (modified, +8/-7)
```diff
@@ -241,7 +241,13 @@ const ConnectedPlatformInput = function ConnectedPlatformInput() {
   // throttled draft-save path rather than from onChangeText, so the composer does not
   // re-render on every keystroke. The preview debounces another 500ms downstream anyway.
   const [previewText, setPreviewText] = React.useState('')
+  // The account this composer was mounted for. After an account switch the service saves drafts
+  // for the next account, so the unmount flush of a draft typed here must not save it there.
+  const [composerUid] = React.useState(() => useCurrentUserState.getState().uid)
   const updateDraftRaw = (text: string) => {
+    if (useCurrentUserState.getState().uid !== composerUid) {
+      return
+    }
     // Immediately update local meta.draft so switching back to this thread
     // before the async unbox completes won't re-inject the old stale draft.
     // Merges from the current meta (same inbox version), so force past gating.
@@ -259,13 +265,8 @@ const ConnectedPlatformInput = function ConnectedPlatformInput() {
     }
     C.ignorePromise(f())
   }
-  const updateDraft = C.useThrottledCallback(updateDraftRaw, 200, {trailing: true})
-  // Flush any pending draft save before cancel fires on unmount (hooks cleanup runs in reverse order)
-  React.useLayoutEffect(() => {
-    return () => {
-      updateDraft.flush()
-    }
-  }, [updateDraft])
+  // flushOnUnmount: leaving the conversation must still save what was typed in the last 200ms
+  const updateDraft = C.useThrottledCallback(updateDraftRaw, 200, {flushOnUnmount: true, trailing: true})
 
   const textValueRef = React.useRef('')
   const onChangeText = (text: string) => {
```

**File**: `shared/chat/conversation/thread-context.test.tsx` (modified, +43/-0)
```diff
@@ -246,6 +246,7 @@ const separatePlainThreadWrapper = ({children}: {children: React.ReactNode}) =>
 )
 
 beforeEach(() => {
+  useConfigState.setState({loggedIn: true})
   useCurrentUserState.getState().dispatch.setBootstrap({
     deviceID: 'device-id',
     deviceName: 'test-device',
@@ -844,6 +845,48 @@ test('active change marks read after an eligible mounted thread load', async ()
   })
 })
 
+test('a thread still on screen after an account switch does not mark read for the next account', async () => {
+  useConfigState.setState({loggedIn: true})
+  useShellState.getState().dispatch.setActive(false)
+  jest
+    .spyOn(Common, 'isUserActivelyLookingAtThisThread')
+    .mockImplementation(() => useShellState.getState().active)
+  const markAsRead = jest
+    .spyOn(T.RPCChat, 'localMarkAsReadLocalRpcPromise')
+    .mockResolvedValue({offline: false})
+  jest.spyOn(T.RPCChat, 'localGetThreadNonblockRpcListener').mockImplementation(async p => {
+    p.incomingCallMap['chat.1.chatUi.chatThreadFull']?.({
+      thread: JSON.stringify({
+        messages: [makeValidTextUIMessage(T.Chat.numberToMessageID(603), 'loaded inactive')],
+        pagination: {last: true, next: '', num: 100, previous: ''},
+      }),
+    })
+    await Promise.resolve()
+    return {offline: false}
+  })
+  const {result} = renderHook(() => useConversationThreadLoadMoreMessages(), {wrapper})
+  act(() => {
+    result.current({reason: 'tab selected'})
+  })
+  await act(async () => {
+    await flushPromises()
+  })
+
+  act(() => {
+    useCurrentUserState.getState().dispatch.setBootstrap({
+      deviceID: 'device-id-2',
+      deviceName: 'test-device-2',
+      uid: 'uid-2',
+      username: 'testuser-mac',
+    })
+    useShellState.getState().dispatch.setActive(true)
+  })
+  await act(async () => {
+    await flushPromises()
+  })
+  expect(markAsRead).not.toHaveBeenCalled()
+})
+
 test('active change does not mark read after a centered thread load', async () => {
   useConfigState.setState({loggedIn: true})
   useShellState.getState().dispatch.setActive(false)
```

**File**: `shared/chat/conversation/thread-context.tsx` (modified, +7/-0)
```diff
@@ -403,6 +403,9 @@ const ConversationThreadProviderInner = (p: ConversationThreadProviderProps) =>
   const lookingAtThread = active && appFocused && routeFocused
   const previousLookingAtThreadRef = React.useRef(lookingAtThread)
   const activeMarkReadEnabledRef = React.useRef(false)
+  // The account this thread was loaded for. Its screen outlives an account switch by a few renders,
+  // and a mark-read sent then would mark the next account's read position.
+  const [threadUid] = React.useState(() => useCurrentUserState.getState().uid)
   const markReadBlockedRef = React.useRef(false)
 
   const getSnapshot = React.useEffectEvent(() => threadStore.getState())
@@ -422,6 +425,10 @@ const ConversationThreadProviderInner = (p: ConversationThreadProviderProps) =>
         logger.info('mark read bail on not logged in')
         return
       }
+      if (useCurrentUserState.getState().uid !== threadUid) {
+        logger.info('mark read bail on thread loaded for another account')
+        return
+      }
       if (!T.Chat.isValidConversationIDKey(id)) {
         logger.info('mark read bail on no selected conversation')
         return
```

**File**: `shared/chat/conversation/thread-load-status-context.test.tsx` (modified, +2/-0)
```diff
@@ -5,6 +5,7 @@ import type * as React from 'react'
 import * as T from '@/constants/types'
 import {notifyEngineActionListeners} from '@/engine/action-listener'
 import {resetAllStores} from '@/util/zustand'
+import {useConfigState} from '@/stores/config'
 import {useCurrentUserState} from '@/stores/current-user'
 import {
   ConversationThreadLoadStatusProvider,
@@ -25,6 +26,7 @@ const flushPromises = async () => {
 
 beforeEach(() => {
   jest.spyOn(T.RPCChat, 'localRequestInboxUnboxRpcPromise').mockResolvedValue(undefined)
+  useConfigState.setState({loggedIn: true})
   useCurrentUserState.getState().dispatch.setBootstrap({
     deviceID: 'device-id',
     deviceName: 'test-device',
```

**File**: `shared/chat/inbox/engine.test.tsx` (modified, +7/-0)
```diff
@@ -4,6 +4,7 @@ import {resetAllStores} from '@/util/zustand'
 import {handleConvoEngineIncoming} from './engine'
 import {getInboxConversationMeta, getInboxConversationParticipants} from './metadata'
 import {useConfigState} from '@/stores/config'
+import {useCurrentUserState} from '@/stores/current-user'
 import {updateInboxTyping} from '@/chat/inbox/typing-state'
 
 jest.mock('@/chat/inbox/badge-state', () => ({
@@ -260,6 +261,12 @@ test('global message activity routing preserves returned global data', () => {
 
 test('read message activity without attached inbox item refreshes service-owned metadata', () => {
   useConfigState.setState({loggedIn: true})
+  useCurrentUserState.getState().dispatch.setBootstrap({
+    deviceID: 'device-id',
+    deviceName: 'test-device',
+    uid: 'uid',
+    username: 'alice',
+  })
   const unbox = jest.spyOn(T.RPCChat, 'localRequestInboxUnboxRpcPromise').mockResolvedValue(undefined)
 
   expect(
```

**File**: `shared/chat/inbox/metadata.test.tsx` (modified, +1/-1)
```diff
@@ -330,7 +330,7 @@ test('setUserSwitching abandons further unbox until switch completes', async ()
   await flushPromises()
   expect(T.RPCChat.localRequestInboxUnboxRpcPromise).toHaveBeenCalledTimes(1)
 
-  useConfigState.getState().dispatch.setUserSwitching(true)
+  useConfigState.getState().dispatch.setUserSwitching(true, 'testuser')
   resolvers[0]?.()
   await flushPromises()
 
```

---

### Incident Patch 11: `9bf63454` (2026-09-24)
**Commit Message**: wait for Stop and clear uid when restarting reused modules (#29644)

**File**: `go/chat/archive.go` (modified, +1/-0)
```diff
@@ -283,6 +283,7 @@ func (r *ChatArchiveRegistry) Stop(ctx context.Context) chan struct{} {
 			r.Debug(ctx, err.Error())
 		}
 		r.started = false
+		r.uid = nil
 		close(r.stopCh)
 		go func() {
 			r.Debug(context.Background(), "Stop: waiting for shutdown")
```

**File**: `go/chat/bots/commands.go` (modified, +1/-0)
```diff
@@ -122,6 +122,7 @@ func (b *CachingBotCommandManager) Stop(ctx context.Context) chan struct{} {
 	if b.started {
 		close(b.stopCh)
 		b.started = false
+		b.uid = nil
 		go func() {
 			err := b.eg.Wait()
 			if err != nil {
```

**File**: `go/chat/convloader.go` (modified, +1/-0)
```diff
@@ -235,6 +235,7 @@ func (b *BackgroundConvLoader) Stop(ctx context.Context) chan struct{} {
 	ch := make(chan struct{})
 	if b.started {
 		b.started = false
+		b.uid = nil
 		close(b.stopCh)
 		b.stopCh = make(chan struct{})
 		go func() {
```

**File**: `go/chat/ephemeral_purger.go` (modified, +1/-0)
```diff
@@ -173,6 +173,7 @@ func (b *BackgroundEphemeralPurger) Stop(ctx context.Context) (ch chan struct{})
 	if b.started {
 		close(b.shutdownCh)
 		b.started = false
+		b.uid = nil
 		go func() {
 			if err := b.eg.Wait(); err != nil {
 				b.Debug(ctx, "error stopping background loop: %v", err)
```

**File**: `go/chat/ephemeral_purger_test.go` (modified, +2/-2)
```diff
@@ -378,11 +378,11 @@ func TestQueueState(t *testing.T) {
 	purger := NewBackgroundEphemeralPurger(g)
 	purger.SetClock(world.Fc)
 	purger.Start(context.Background(), uid)
-	<-purger.Stop(context.Background())
+	defer func() { <-purger.Stop(context.Background()) }()
 
+	require.Equal(t, 0, purger.Len())
 	pq := purger.pq
 	require.NotNil(t, pq)
-	require.Zero(t, pq.Len())
 	require.Nil(t, pq.Peek())
 
 	now := world.Fc.Now()
```

**File**: `go/chat/inboxsource.go` (modified, +9/-3)
```diff
@@ -665,12 +665,13 @@ func (s *HybridInboxSource) Connected(ctx context.Context) {
 
 func (s *HybridInboxSource) Start(ctx context.Context, uid gregor1.UID) {
 	defer s.Trace(ctx, nil, "Start")()
+	s.Lock()
+	waitCh := s.doStopLocked()
+	s.Unlock()
+	<-waitCh
 	s.baseInboxSource.Start(ctx, uid)
 	s.Lock()
 	defer s.Unlock()
-	if s.started {
-		return
-	}
 	s.stopCh = make(chan struct{})
 	s.started = true
 	s.uid = uid
@@ -683,10 +684,15 @@ func (s *HybridInboxSource) Stop(ctx context.Context) chan struct{} {
 	<-s.baseInboxSource.Stop(ctx)
 	s.Lock()
 	defer s.Unlock()
+	return s.doStopLocked()
+}
+
+func (s *HybridInboxSource) doStopLocked() chan struct{} {
 	ch := make(chan struct{})
 	if s.started {
 		close(s.stopCh)
 		s.started = false
+		s.uid = nil
 		go func() {
 			_ = s.eg.Wait()
 			close(ch)
```

**File**: `go/chat/localizer.go` (modified, +30/-9)
```diff
@@ -286,6 +286,8 @@ type localizerPipeline struct {
 	suspendCount   int
 	suspendWaiters []chan struct{}
 	jobQueue       chan *localizerPipelineJob
+	loopDone       chan struct{}
+	jobWG          sync.WaitGroup
 
 	// testing
 	useGateCh   bool
@@ -338,28 +340,44 @@ func (s *localizerPipeline) clearQueue() {
 func (s *localizerPipeline) start(ctx context.Context) {
 	defer s.Trace(ctx, nil, "start")()
 	s.Lock()
+	waitCh := s.doStopLocked()
+	s.Unlock()
+	<-waitCh
+	s.Lock()
 	defer s.Unlock()
-	if s.started {
-		close(s.stopCh)
-		s.stopCh = make(chan struct{})
-	}
 	s.clearQueue()
 	s.started = true
+	s.stopCh = make(chan struct{})
+	s.loopDone = make(chan struct{})
 	stopCh := s.stopCh
-	go s.localizeLoop(stopCh)
+	loopDone := s.loopDone
+	go s.localizeLoop(stopCh, loopDone)
 }
 
 func (s *localizerPipeline) stop(ctx context.Context) chan struct{} {
 	defer s.Trace(ctx, nil, "stop")()
 	s.Lock()
 	defer s.Unlock()
+	return s.doStopLocked()
+}
+
+func (s *localizerPipeline) doStopLocked() chan struct{} {
 	ch := make(chan struct{})
 	if s.started {
 		close(s.stopCh)
-		s.stopCh = make(chan struct{})
 		s.started = false
+		loopDone := s.loopDone
+		go func() {
+			if loopDone != nil {
+				<-loopDone
+			}
+			s.jobWG.Wait()
+			close(ch)
+		}()
+	} else {
+		close(ch)
 	}
-	close(ch)
+	s.clearQueue()
 	return ch
 }
 
@@ -494,13 +512,16 @@ func (s *localizerPipeline) localizeJobPulled(job *localizerPipelineJob, stopCh
 	s.Debug(job.ctx, "localizeJobPulled[%s]: job pass complete", id)
 }
 
-func (s *localizerPipeline) localizeLoop(stopCh chan struct{}) {
+func (s *localizerPipeline) localizeLoop(stopCh chan struct{}, loopDone chan struct{}) {
 	ctx := context.Background()
 	s.Debug(ctx, "localizeLoop: starting up")
+	defer close(loopDone)
 	for {
 		select {
 		case job := <-s.jobQueue:
-			go s.localizeJobPulled(job, stopCh)
+			s.jobWG.Go(func() {
+				s.localizeJobPulled(job, stopCh)
+			})
 		case <-stopCh:
 			s.Debug(ctx, "localizeLoop: shutting down")
 			return
```

**File**: `go/chat/maps/livelocation.go` (modified, +1/-0)
```diff
@@ -69,6 +69,7 @@ func (l *LiveLocationTracker) Stop(ctx context.Context) chan struct{} {
 	for _, t := range l.trackers {
 		t.Stop()
 	}
+	l.uid = nil
 	go func() {
 		_ = l.eg.Wait()
 		close(ch)
```

---

### Incident Patch 12: `873159cf` (2026-09-24)
**Commit Message**:  treat wrong or missing uid as a storage miss, do not nuke inbox (#29643)

* treat wrong-key decrypt as a miss, do not nuke inbox

* lint

* fix

* more explicit

* better

**File**: `go/chat/storage/basebox.go` (modified, +10/-0)
```diff
@@ -1,12 +1,14 @@
 package storage
 
 import (
+	"bytes"
 	"context"
 	"fmt"
 
 	"github.com/keybase/client/go/chat/globals"
 	"github.com/keybase/client/go/encrypteddb"
 	"github.com/keybase/client/go/libkb"
+	"github.com/keybase/client/go/protocol/gregor1"
 	"github.com/keybase/client/go/protocol/keybase1"
 )
 
@@ -42,6 +44,14 @@ func (i *baseBox) writeDiskBox(ctx context.Context, key libkb.DbKey, data any) e
 	return i.encryptedDB.Put(ctx, key, data)
 }
 
+func (i *baseBox) missIfWrongSessionUID(uid gregor1.UID) Error {
+	me := i.G().ExternalG().ActiveDevice.UID()
+	if uid.IsNil() || !me.Exists() || !bytes.Equal(me.ToBytes(), uid) {
+		return MissError{Msg: "uid mismatch"}
+	}
+	return nil
+}
+
 func (i *baseBox) maybeNuke(err Error, key libkb.DbKey) {
 	if err != nil && err.ShouldClear() {
 		i.G().Log.Debug("nuking %v on err: %v", key, err)
```

**File**: `go/chat/storage/inbox.go` (modified, +29/-15)
```diff
@@ -179,6 +179,13 @@ func (i *Inbox) dbConvKey(uid gregor1.UID, convID chat1.ConversationID) libkb.Db
 	}
 }
 
+func (i *Inbox) diskReadError(ctx context.Context, uid gregor1.UID, err error) Error {
+	if _, ok := err.(libkb.LoginRequiredError); ok {
+		return MiscError{Msg: err.Error()}
+	}
+	return NewInternalError(ctx, i.DebugLabeler, "failed to read inbox: uid: %s err: %s", uid, err)
+}
+
 func (i *Inbox) maybeNuke(ctx context.Context, ef func() Error, uid gregor1.UID) {
 	err := ef()
 	if err != nil && err.ShouldClear() {
@@ -195,18 +202,17 @@ func (i *Inbox) readDiskVersions(ctx context.Context, uid gregor1.UID, useInMemo
 	if err := isAbortedRequest(ctx); err != nil {
 		return ibox, err
 	}
+	if err := i.missIfWrongSessionUID(uid); err != nil {
+		return ibox, err
+	}
 	// Check in memory cache first
 	if memibox := inboxMemCache.GetVersions(uid); useInMemory && memibox != nil {
 		i.Debug(ctx, "readDiskVersions: hit in memory cache")
 		ibox = *memibox
 	} else {
 		found, err := i.readDiskBox(ctx, i.dbVersionsKey(uid), &ibox)
 		if err != nil {
-			if _, ok := err.(libkb.LoginRequiredError); ok {
-				return ibox, MiscError{Msg: err.Error()}
-			}
-			return ibox, NewInternalError(ctx, i.DebugLabeler,
-				"failed to read inbox: uid: %d err: %s", uid, err)
+			return ibox, i.diskReadError(ctx, uid, err)
 		}
 		if !found {
 			return ibox, MissError{}
@@ -241,6 +247,9 @@ func (i *Inbox) readDiskVersions(ctx context.Context, uid gregor1.UID, useInMemo
 }
 
 func (i *Inbox) writeDiskVersions(ctx context.Context, uid gregor1.UID, ibox inboxDiskVersions) Error {
+	if err := i.missIfWrongSessionUID(uid); err != nil {
+		return err
+	}
 	// Get latest server version
 	vers, err := i.G().ServerCacheVersions.Fetch(ctx)
 	if err != nil {
@@ -263,18 +272,17 @@ func (i *Inbox) readDiskIndex(ctx context.Context, uid gregor1.UID, useInMemory
 	if err := isAbortedRequest(ctx); err != nil {
 		return ibox, err
 	}
+	if err := i.missIfWrongSessionUID(uid); err != nil {
+		return ibox, err
+	}
 	// Check in memory cache first
 	if memibox := inboxMemCache.GetIndex(uid); useInMemory && memibox != nil {
 		i.Debug(ctx, "readDiskIndex: hit in memory cache")
 		ibox = *memibox
 	} else {
 		found, err := i.readDiskBox(ctx, i.dbIndexKey(uid), &ibox)
 		if err != nil {
-			if _, ok := err.(libkb.LoginRequiredError); ok {
-				return ibox, MiscError{Msg: err.Error()}
-			}
-			return ibox, NewInternalError(ctx, i.DebugLabeler,
-				"failed to read inbox: uid: %d err: %s", uid, err)
+			return ibox, i.diskReadError(ctx, uid, err)
 		}
 		if !found {
 			return ibox, MissError{}
@@ -288,6 +296,9 @@ func (i *Inbox) readDiskIndex(ctx context.Context, uid gregor1.UID, useInMemory
 }
 
 func (i *Inbox) writeDiskIndex(ctx context.Context, uid gregor1.UID, ibox inboxDiskIndex) Error {
+	if err := i.missIfWrongSessionUID(uid); err != nil {
+		return err
+	}
 	i.Debug(ctx, "writeDiskIndex: convs: %d queries: %d", len(ibox.ConversationIDs), len(ibox.Queries))
 	inboxMemCache.PutIndex(uid, &ibox)
 	if err := i.writeDiskBox(ctx, i.dbIndexKey(uid), ibox); err != nil {
@@ -297,6 +308,9 @@ func (i *Inbox) writeDiskIndex(ctx context.Context, uid gregor1.UID, ibox inboxD
 }
 
 func (i *Inbox) readConvs(ctx context.Context, uid gregor1.UID, convIDs []chat1.ConversationID) (res []types.RemoteConversation, err Error) {
+	if err := i.missIfWrongSessionUID(uid); err != nil {
+		return res, err
+	}
 	res = make([]types.RemoteConversation, 0, len(convIDs))
 	memHits := make(map[chat1.ConvIDStr]bool, len(convIDs))
 	for _, convID := range convIDs {
@@ -320,11 +334,7 @@ func (i *Inbox) readConvs(ctx context.Context, uid gregor1.UID, convIDs []chat1.
 		dbReads++
 		found, err := i.readDiskBox(ctx, i.dbConvKey(uid, convID), &conv)
 		if err != nil {
-			if _, ok := err.(libkb.LoginRequiredError); ok {
-				return res, MiscError{Msg: err.Error()}
-			}
-			return res, NewInternalError(ctx, i.DebugLabeler,
-				"failed to read inbox: uid: %d err: %s", uid, err)
+			return res, i.diskReadError(ctx, uid, err)
 		}
 		if !found {
 			return res, MissError{}
@@ -349,6 +359,9 @@ func (i *Inbox) readConv(ctx context.Context, uid gregor1.UID, convID chat1.Conv
 func (i *Inbox) writeConvs(ctx context.Context, uid gregor1.UID, convs []types.RemoteConversation,
 	withVersionCheck bool,
 ) Error {
+	if err := i.missIfWrongSessionUID(uid); err != nil {
+		return err
+	}
 	i.summarizeConvs(convs)
 	for _, conv := range convs {
 		if withVersionCheck {
@@ -716,6 +729,7 @@ func (i *Inbox) clearLocked(ctx context.Context, uid gregor1.UID) (err Error) {
 	var iboxIndex inboxDiskIndex
 	if iboxIndex, err = i.readDiskIndex(ctx, uid, true); err != nil {
 		i.Debug(ctx, "Clear: failed to read index: %s", err)
+		return err
 	}
 	for _, convID := range iboxIndex.ConversationIDs {
 		if ierr := i.G().LocalChatDb.Delete(i.dbConvKey(uid, convID)); ierr != nil {
```

**File**: `go/chat/storage/inbox_memcache.go` (modified, +7/-1)
```diff
@@ -1,6 +1,7 @@
 package storage
 
 import (
+	"strings"
 	"sync"
 
 	"github.com/keybase/client/go/chat/types"
@@ -81,7 +82,12 @@ func (i *inboxMemCacheImpl) Clear(uid gregor1.UID) {
 	defer i.Unlock()
 	delete(i.versMap, uid.String())
 	delete(i.indexMap, uid.String())
-	i.convMap = make(map[string]types.RemoteConversation)
+	prefix := uid.String()
+	for k := range i.convMap {
+		if strings.HasPrefix(k, prefix) {
+			delete(i.convMap, k)
+		}
+	}
 }
 
 func (i *inboxMemCacheImpl) clearCache() {
```

**File**: `go/chat/storage/inbox_test.go` (modified, +61/-11)
```diff
@@ -743,17 +743,9 @@ func TestInboxMembershipUpdate(t *testing.T) {
 	ctc, inbox, uid := setupInboxTest(t, "membership")
 	defer ctc.Cleanup()
 
-	u2, err := kbtest.CreateAndSignupFakeUser("ib", ctc.G)
-	require.NoError(t, err)
-	uid2 := gregor1.UID(u2.User.GetUID().ToBytes())
-
-	u3, err := kbtest.CreateAndSignupFakeUser("ib", ctc.G)
-	require.NoError(t, err)
-	uid3 := gregor1.UID(u3.User.GetUID().ToBytes())
-
-	u4, err := kbtest.CreateAndSignupFakeUser("ib", ctc.G)
-	require.NoError(t, err)
-	uid4 := gregor1.UID(u4.User.GetUID().ToBytes())
+	uid2 := makeUID(t)
+	uid3 := makeUID(t)
+	uid4 := makeUID(t)
 
 	t.Logf("uid: %s uid2: %s uid3: %s uid4: %s", uid, uid2, uid3, uid4)
 
@@ -932,3 +924,61 @@ func TestUpdateLocalMtime(t *testing.T) {
 	require.Equal(t, mtime1, convs[0].GetMtime())
 	require.Equal(t, mtime2, convs[1].GetMtime())
 }
+
+func TestInboxWrongSessionUIDIsMissNotNuke(t *testing.T) {
+	tc, inbox, uidA := setupInboxTest(t, "decmiss")
+	defer tc.Cleanup()
+
+	conv := makeConvo(gregor1.Time(1), 1, 1)
+	require.NoError(t, inbox.Merge(context.TODO(), uidA, 7, []chat1.Conversation{conv.Conv}, nil))
+
+	_, found, err := tc.G.LocalChatDb.GetRaw(inbox.dbVersionsKey(uidA))
+	require.NoError(t, err)
+	require.True(t, found)
+
+	_, _, err = inbox.Read(context.TODO(), nil, nil)
+	require.ErrorAs(t, err, new(MissError))
+	_, found, err = tc.G.LocalChatDb.GetRaw(inbox.dbVersionsKey(uidA))
+	require.NoError(t, err)
+	require.True(t, found, "empty request uid must not delete inbox versions")
+
+	_, err = kbtest.CreateAndSignupFakeUser("ib", tc.G)
+	require.NoError(t, err)
+
+	_, _, err = inbox.Read(context.TODO(), uidA, nil)
+	require.ErrorAs(t, err, new(MissError))
+
+	_, found, err = tc.G.LocalChatDb.GetRaw(inbox.dbVersionsKey(uidA))
+	require.NoError(t, err)
+	require.True(t, found, "wrong-session uid must not delete inbox versions")
+}
+
+func TestInboxMemCacheClearOnlyUID(t *testing.T) {
+	uidA := gregor1.UID([]byte("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"))
+	uidB := gregor1.UID([]byte("bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"))
+	convA := makeConvo(gregor1.Time(1), 1, 1)
+	convB := makeConvo(gregor1.Time(2), 1, 1)
+	inboxMemCache.PutConv(uidA, convA)
+	inboxMemCache.PutConv(uidB, convB)
+	inboxMemCache.Clear(uidA)
+	require.Nil(t, inboxMemCache.GetConv(uidA, convA.GetConvID()))
+	require.NotNil(t, inboxMemCache.GetConv(uidB, convB.GetConvID()))
+	inboxMemCache.clearCache()
+}
+
+func TestInboxClearLockedIndexErrorKeepsVersions(t *testing.T) {
+	tc, inbox, uid := setupInboxTest(t, "clridx")
+	defer tc.Cleanup()
+
+	conv := makeConvo(gregor1.Time(1), 1, 1)
+	require.NoError(t, inbox.Merge(context.TODO(), uid, 3, []chat1.Conversation{conv.Conv}, nil))
+	require.NoError(t, tc.G.LocalChatDb.PutRaw(inbox.dbIndexKey(uid), []byte("not-a-box")))
+	inboxMemCache.Clear(uid)
+
+	err := inbox.clearLocked(context.TODO(), uid)
+	require.Error(t, err)
+
+	_, found, gerr := tc.G.LocalChatDb.GetRaw(inbox.dbVersionsKey(uid))
+	require.NoError(t, gerr)
+	require.True(t, found, "clearLocked must not delete versions when the index cannot be read")
+}
```

**File**: `go/chat/storage/outbox_basebox.go` (modified, +6/-0)
```diff
@@ -45,6 +45,9 @@ func (s *outboxBaseboxStorage) clear(ctx context.Context) Error {
 
 func (s *outboxBaseboxStorage) readStorage(ctx context.Context) (res diskOutbox, err Error) {
 	defer func() { s.maybeNuke(err, s.dbKey()) }()
+	if err := s.missIfWrongSessionUID(s.uid); err != nil {
+		return res, err
+	}
 
 	if memobox := outboxMemCache.Get(s.uid); memobox != nil {
 		s.Debug(ctx, "hit in memory cache")
@@ -76,6 +79,9 @@ func (s *outboxBaseboxStorage) readStorage(ctx context.Context) (res diskOutbox,
 
 func (s *outboxBaseboxStorage) writeStorage(ctx context.Context, obox diskOutbox) (err Error) {
 	defer func() { s.maybeNuke(err, s.dbKey()) }()
+	if err := s.missIfWrongSessionUID(s.uid); err != nil {
+		return err
+	}
 	if ierr := s.writeDiskBox(ctx, s.dbKey(), obox); ierr != nil {
 		return NewInternalError(ctx, s.DebugLabeler, "error writing outbox: err: %s", ierr)
 	}
```

**File**: `go/chat/storage/readoutbox.go` (modified, +6/-0)
```diff
@@ -59,6 +59,9 @@ func (o *ReadOutbox) clear(ctx context.Context) Error {
 }
 
 func (o *ReadOutbox) readStorage(ctx context.Context) (res diskReadOutbox) {
+	if err := o.missIfWrongSessionUID(o.uid); err != nil {
+		return diskReadOutbox{Version: readOutboxVersion}
+	}
 	if memobox := readOutboxMemCache.Get(o.uid); memobox != nil {
 		o.Debug(ctx, "hit in memory cache")
 		res = *memobox
@@ -87,6 +90,9 @@ func (o *ReadOutbox) readStorage(ctx context.Context) (res diskReadOutbox) {
 }
 
 func (o *ReadOutbox) writeStorage(ctx context.Context, obox diskReadOutbox) (err Error) {
+	if err := o.missIfWrongSessionUID(o.uid); err != nil {
+		return err
+	}
 	if ierr := o.writeDiskBox(ctx, o.dbKey(), obox); ierr != nil {
 		return NewInternalError(ctx, o.DebugLabeler, "error writing outbox: err: %s", ierr)
 	}
```

---

### Incident Patch 13: `558c60e6` (2026-09-24)
**Commit Message**: fix(protocol): regen rpc-gen.tsx after dropping reachabilityChanged (#29684)

* chore(protocol): regen rpc-gen.tsx after dropping reachabilityChanged

* docs(claude): regen rpc-gen.tsx after protocol/enabled-calls edits

* docs(claude): never hand-edit generated code

**File**: `CLAUDE.md` (modified, +2/-0)
```diff
@@ -14,6 +14,8 @@
 - Keep `react`, `react-dom`, `react-native`, `@react-native/*` in sync with Expo SDK.
 - When updating deps: edit `package.json` → `yarn` → `yarn ios:pod:install`.
 - After editing `rnmodules/react-native-kb/`: run `yarn sync:kb-modules` before building. `shared/node_modules/react-native-kb` is a copy, not a symlink, and Xcode compiles the copy — skipping this builds stale sources and reports errors against code you already fixed. `rnmodules/kb-common/` needs no sync (the Podfile references it by path).
+- After editing `protocol/avdl/` or `protocol/bin/enabled-calls.json`: from `protocol/`, run `node ./bin/generate-ts.ts && cp ./js/rpc*.tsx ../shared/constants/rpc` and commit the regenerated `shared/constants/rpc/rpc-gen.tsx`.
+- Never hand-edit generated code (rpc-gen, protocol output, mocks, codegen'd files of any kind). Edit the source it's generated from and rerun the generator. CI regenerates and fails on any diff.
 - When updating `electron`: run `shared/desktop/extract-electron-shasums.sh <version>`.
 - Never patch `react-native` itself (patch-package or node_modules edits): we use prebuilt RN core and don't compile its source, so native-side patches never take effect. Work around RN core bugs in app code.
 
```

**File**: `shared/constants/rpc/rpc-gen.tsx` (modified, +2/-5)
```diff
@@ -963,10 +963,6 @@ export type MessageTypes = {
     inParam: undefined,
     outParam: Reachability,
   },
-  'keybase.1.reachability.reachabilityChanged': {
-    inParam: {readonly reachability: Reachability},
-    outParam: void,
-  },
   'keybase.1.reachability.startReachability': {
     inParam: undefined,
     outParam: Reachability,
@@ -3125,7 +3121,7 @@ export type WalletAccountInfo = {readonly accountID: string,readonly numUnread:
 export type WebProof = {readonly hostname: string,readonly protocols?: ReadonlyArray<string> | null,}
 export type WriteArgs = {readonly opID: OpID,readonly path: Path,readonly offset: number,}
 
-type IncomingMethod = 'keybase.1.NotifyAudit.boxAuditError' | 'keybase.1.NotifyAudit.rootAuditError' | 'keybase.1.NotifyBadges.badgeState' | 'keybase.1.NotifyDeviceHistory.deviceHistoryChanged' | 'keybase.1.NotifyFS.FSActivity' | 'keybase.1.NotifySession.loggedOut' | 'keybase.1.NotifyTracking.trackingChanged' | 'keybase.1.NotifyUsers.userChanged' | 'keybase.1.loginUi.displayPaperKeyPhrase' | 'keybase.1.loginUi.displayPrimaryPaperKey' | 'keybase.1.loginUi.displayResetProgress' | 'keybase.1.loginUi.explainDeviceRecovery' | 'keybase.1.pgpUi.finished' | 'keybase.1.proveUi.displayRecheckWarning' | 'keybase.1.proveUi.outputPrechecks' | 'keybase.1.provisionUi.DisplaySecretExchanged' | 'keybase.1.provisionUi.ProvisioneeSuccess' | 'keybase.1.provisionUi.ProvisionerSuccess' | 'keybase.1.reachability.reachabilityChanged' | 'keybase.1.rekeyUI.refresh' | 'keybase.1.rekeyUI.rekeySendEvent'
+type IncomingMethod = 'keybase.1.NotifyAudit.boxAuditError' | 'keybase.1.NotifyAudit.rootAuditError' | 'keybase.1.NotifyBadges.badgeState' | 'keybase.1.NotifyDeviceHistory.deviceHistoryChanged' | 'keybase.1.NotifyFS.FSActivity' | 'keybase.1.NotifySession.loggedOut' | 'keybase.1.NotifyTracking.trackingChanged' | 'keybase.1.NotifyUsers.userChanged' | 'keybase.1.loginUi.displayPaperKeyPhrase' | 'keybase.1.loginUi.displayPrimaryPaperKey' | 'keybase.1.loginUi.displayResetProgress' | 'keybase.1.loginUi.explainDeviceRecovery' | 'keybase.1.pgpUi.finished' | 'keybase.1.proveUi.displayRecheckWarning' | 'keybase.1.proveUi.outputPrechecks' | 'keybase.1.provisionUi.DisplaySecretExchanged' | 'keybase.1.provisionUi.ProvisioneeSuccess' | 'keybase.1.provisionUi.ProvisionerSuccess' | 'keybase.1.rekeyUI.refresh' | 'keybase.1.rekeyUI.rekeySendEvent'
 export type IncomingCallMapType = Partial<{[M in IncomingMethod]: (params: RpcIn<M>) => void}>
 
 type CustomIncomingMethod = 'keybase.1.NotifyApp.exit' | 'keybase.1.NotifyEmailAddress.emailAddressVerified' | 'keybase.1.NotifyEmailAddress.emailsChanged' | 'keybase.1.NotifyFS.FSOverallSyncStatusChanged' | 'keybase.1.NotifyFS.FSSubscriptionNotify' | 'keybase.1.NotifyFS.FSSubscriptionNotifyPath' | 'keybase.1.NotifyFeaturedBots.featuredBotsUpdate' | 'keybase.1.NotifyPGP.pgpKeyInSecretStoreFile' | 'keybase.1.NotifyPhoneNumber.phoneNumbersChanged' | 'keybase.1.NotifyRuntimeStats.runtimeStatsUpdate' | 'keybase.1.NotifyService.HTTPSrvInfoUpdate' | 'keybase.1.NotifyService.handleKeybaseLink' | 'keybase.1.NotifyService.shutdown' | 'keybase.1.NotifySession.clientOutOfDate' | 'keybase.1.NotifySession.loggedIn' | 'keybase.1.NotifySimpleFS.simpleFSArchiveStatusChanged' | 'keybase.1.NotifyTeam.avatarUpdated' | 'keybase.1.NotifyTeam.teamChangedByID' | 'keybase.1.NotifyTeam.teamDeleted' | 'keybase.1.NotifyTeam.teamExit' | 'keybase.1.NotifyTeam.teamMetadataUpdate' | 'keybase.1.NotifyTeam.teamRoleMapChanged' | 'keybase.1.NotifyTeam.teamTreeMembershipsDone' | 'keybase.1.NotifyTeam.teamTreeMembershipsPartial' | 'keybase.1.NotifyTracking.notifyUserBlocked' | 'keybase.1.NotifyTracking.trackingInfo' | 'keybase.1.NotifyUsers.identifyUpdate' | 'keybase.1.NotifyUsers.passwordChanged' | 'keybase.1.gpgUi.selectKey' | 'keybase.1.gpgUi.wantToAddGPGKey' | 'keybase.1.gregorUI.pushState' | 'keybase.1.homeUI.homeUIRefresh' | 'keybase.1.identify3Ui.identify3Result' | 'keybase.1.identify3Ui.identify3ShowTracker' | 'keybase.1.identify3Ui.identify3Summary' | 'keybase.1.identify3Ui.identify3UpdateRow' | 'keybase.1.identify3Ui.identify3UpdateUserCard' | 'keybase.1.identify3Ui.identify3UserReset' | 'keybase.1.logUi.log' | 'keybase.1.loginUi.chooseDeviceToRecoverWith' | 'keybase.1.loginUi.displayPaperKeyPhrase' | 'keybase.1.loginUi.displayPrimaryPaperKey' | 'keybase.1.loginUi.displayResetProgress' | 'keybase.1.loginUi.explainDeviceRecovery' | 'keybase.1.loginUi.getEmailOrUsername' | 'keybase.1.loginUi.promptPassphraseRecovery' | 'keybase.1.loginUi.promptResetAccount' | 'keybase.1.loginUi.promptRevokePaperKeys' | 'keybase.1.logsend.prepareLogsend' | 'keybase.1.pgpUi.finished' | 'keybase.1.pgpUi.keyGenerated' | 'keybase.1.pgpUi.shouldPushPrivate' | 'keybase.1.proveUi.checking' | 'keybase.1.proveUi.continueChecking' | 'keybase.1.proveUi.displayRecheckWarning' | 'keybase.1.proveUi.okToCheck' | 'keybase.1.proveUi.outputInstructions' | 'keybase.1.proveUi.outputPrechecks' | 'keybase.1.proveUi.preProofWarning' | 'keybase.1.pro
```

---

### Incident Patch 14: `b4f11702` (2026-09-24)
**Commit Message**: fix(protocol): drop reachabilityChanged from enabled incoming calls (#29683)

* fix(protocol): drop reachabilityChanged from enabled incoming calls

The JS side stopped handling it in #29675, but only the generated
index.tsx was edited, so CI's regen put the union member back.

* docs(claude): skip /code-review for trivial diffs

**File**: `CLAUDE.md` (modified, +1/-1)
```diff
@@ -27,4 +27,4 @@ Repo root is `client/`. TS source lives in `shared/`. Always use absolute paths
 ## Validation
 After TS changes (from `shared/`): `yarn lint:all` (= `yarn lint` && `yarn lint:bailouts` && `yarn tsc`). Plain `yarn lint` is eslint only and does NOT catch react-compiler bailouts — no compiler rule is wired into `eslint.config.mjs`, so bailouts only surface via `lint:bailouts`. `lint:bailouts` also flags components the compiler cannot name (an `isMobile ? arrow : arrow` ternary is never compiled at all, so nothing in it is memoized — name both branches instead), and memo scopes keyed on the whole props object (a `props.x` read inside a callback, or a destructure below one, makes the compiler key on `props` itself, so the cache never hits — read every prop through one destructure at the top, above every callback). Repo baseline is 0 bailouts and 0 whole-props deps; keep it there. When debugging visually, skip until fix is confirmed. Never delete the ESLint cache.
 
-Before reporting any TS change complete: run `yarn lint:all` and get it clean. Do NOT run `/code-review` while iterating, building, testing, or debugging — only once the change is about to be pushed (commit for a PR, push, or open a PR). At that point run `/code-review high` against the diff and fix what it finds; if a finding is wrong, say why instead of applying it.
+Before reporting any TS change complete: run `yarn lint:all` and get it clean. Do NOT run `/code-review` while iterating, building, testing, or debugging — only once the change is about to be pushed (commit for a PR, push, or open a PR). At that point, if the diff has real logic in it, run `/code-review high` against the diff and fix what it finds; if a finding is wrong, say why instead of applying it. Skip the review for trivial diffs (a config/JSON line, a codegen resync, a typo) and say you skipped it.
```

**File**: `protocol/bin/enabled-calls.json` (modified, +0/-1)
```diff
@@ -390,7 +390,6 @@
   "keybase.1.provisionUi.chooseGPGMethod": {"custom":true},
   "keybase.1.provisionUi.switchToGPGSignOK": {"custom":true},
   "keybase.1.reachability.checkReachability": {"promise":true},
-  "keybase.1.reachability.reachabilityChanged": {"incoming":true},
   "keybase.1.reachability.startReachability": {"promise":true},
   "keybase.1.rekey.getRevokeWarning": {"promise":true},
   "keybase.1.rekey.rekeyStatusFinish": {"promise":true},
```

---

### Incident Patch 15: `e4b47fad` (2026-09-23)
**Commit Message**: fix(android): process lifecycle, foreground pushes and quick replies (#29676)

* fix(android): process lifecycle, foreground pushes, quick reply off the main thread

One lifecycle reporter: AppLifecycleReporter (ProcessLifecycleOwner) talks to
Go and JS through a LifecycleBind seam so the mapping runs in JVM tests.
MainActivity resume/finishing-destroy go through it too.

Pushes always reach Go. In the foreground master returned before calling
handleBackgroundNotification, so a foreground push was never unboxed or
acked; now Go handles it with a notifier that does not display while the app
is in the foreground. In the background Go is held in BACKGROUNDACTIVE around
the work, then appDidEnterBackground decides whether to keep running.

Quick reply runs on a worker thread under goAsync with a status
notification, is not sent when logged out or for a negative message id (Go
sends before it checks either and swallows the send's error), and is sent in
the foreground too (master skipped it).

Also: one unique periodic background sync job (legacy duplicates cancelled
once), share intents handed over when JS registers instead of polling, and
the Kotlin seen-set capped at 100.

Flush audit

**File**: `shared/android/app/build.gradle` (modified, +2/-0)
```diff
@@ -171,6 +171,8 @@ dependencies {
     implementation 'com.android.installreferrer:installreferrer:2.2'
     implementation "androidx.lifecycle:lifecycle-common-java8:2.10.0"
     implementation "androidx.lifecycle:lifecycle-process:2.10.0"
+
+    testImplementation "junit:junit:4.13.2"
 }
 
 // This requires a google-services.json file locally.  Drop it in
```

**File**: `shared/android/app/src/main/java/io/keybase/ossifrage/AppLifecycleForwarder.kt` (removed, +0/-35)
```diff
@@ -1,35 +0,0 @@
-package io.keybase.ossifrage
-
-import android.content.Context
-import android.os.Bundle
-import androidx.lifecycle.DefaultLifecycleObserver
-import androidx.lifecycle.LifecycleOwner
-import com.reactnativekb.KbModule
-import io.keybase.ossifrage.modules.NativeLogger
-import keybase.Keybase
-
-// Reports the whole process's visibility, not one activity's, to Go and JS
-// together, so both see the same state. Process ON_STOP only fires once no
-// activity is started, so moving between our own activities never looks like a
-// trip to the background.
-internal class AppLifecycleForwarder(private val context: Context) : DefaultLifecycleObserver {
-    override fun onStart(owner: LifecycleOwner) = foreground("onStart")
-
-    override fun onResume(owner: LifecycleOwner) = foreground("onResume")
-
-    override fun onStop(owner: LifecycleOwner) {
-        NativeLogger.info("AppLifecycleForwarder: process onStop")
-        // appDidEnterBackground already reports BACKGROUND (and flushes) when it
-        // returns false; calling setAppStateBackground too would flush twice.
-        if (Keybase.appDidEnterBackground()) {
-            Keybase.appBeginBackgroundTaskNonblock(KBPushNotifier(context, Bundle()))
-        }
-        KbModule.emitAppLifecycle("background")
-    }
-
-    private fun foreground(event: String) {
-        NativeLogger.info("AppLifecycleForwarder: process $event")
-        Keybase.setAppStateForeground()
-        KbModule.emitAppLifecycle("active")
-    }
-}
```

**File**: `shared/android/app/src/main/java/io/keybase/ossifrage/AppLifecycleReporter.kt` (added, +144/-0)
```diff
@@ -0,0 +1,144 @@
+package io.keybase.ossifrage
+
+import androidx.lifecycle.DefaultLifecycleObserver
+import androidx.lifecycle.LifecycleOwner
+import java.util.concurrent.CountDownLatch
+import java.util.concurrent.TimeUnit
+
+// Go's lifecycle entry points and the JS app-state event. Kept free of Android
+// and gomobile calls so the event mapping and the push window run in JVM tests.
+internal interface LifecycleBind {
+    fun setAppStateForeground()
+    fun setAppStateBackgroundActive()
+    fun isAppStateForeground(): Boolean
+    fun appDidEnterBackground(): Boolean
+    fun appBeginBackgroundTaskNonblock()
+    fun appWillExit()
+    fun emitAppLifecycle(state: String)
+}
+
+// Reports the whole process's visibility, not one activity's, to Go and JS
+// together, so both see the same state. Process ON_STOP only fires once no
+// activity is started, so moving between our own activities, dialogs and
+// permission prompts never looks like a trip to the background.
+//
+// Calls reach Go on the calling thread, before the callback returns.
+internal class AppLifecycleReporter(
+    private val bind: LifecycleBind,
+    private val log: (String) -> Unit,
+) : DefaultLifecycleObserver {
+    override fun onStart(owner: LifecycleOwner) = foreground("process onStart")
+
+    override fun onResume(owner: LifecycleOwner) = foreground("process onResume")
+
+    override fun onStop(owner: LifecycleOwner) {
+        report("process onStop") {
+            // appDidEnterBackground already reports BACKGROUND (and flushes) when
+            // it returns false; calling setAppStateBackground too would flush twice.
+            if (bind.appDidEnterBackground()) {
+                bind.appBeginBackgroundTaskNonblock()
+            }
+        }
+        bind.emitAppLifecycle("background")
+    }
+
+    fun onMainActivityResume() = foreground("MainActivity onResume")
+
+    // Activity recreation and a task moved to the back are not an exit.
+    fun onMainActivityDestroy(isFinishing: Boolean, isChangingConfigurations: Boolean) {
+        if (!isFinishing || isChangingConfigurations) {
+            return
+        }
+        report("MainActivity finishing") { bind.appWillExit() }
+        bind.emitAppLifecycle("background")
+    }
+
+    private fun foreground(event: String) {
+        report(event) { bind.setAppStateForeground() }
+        bind.emitAppLifecycle("active")
+    }
+
+    private fun report(event: String, call: () -> Unit) {
+        log("AppLifecycleReporter: $event")
+        try {
+            call()
+        } catch (e: Exception) {
+            log("AppLifecycleReporter: $event failed: $e")
+        }
+    }
+}
+
+// Sends a notification quick reply. Returns the text for the replied
+// notification. notificationUID is the account the notification was shown for;
+// Go posts as whichever account is current, so a reply from another account's
+// notification is refused.
+internal fun sendQuickReply(
+    currentUID: () -> String,
+    notificationUID: String,
+    msgId: Long,
+    error: (String, Throwable?) -> Unit,
+    send: () -> Unit,
+): String {
+    val uid = try {
+        currentUID()
+    } catch (e: Exception) {
+        error("Quick reply couldn't read the current uid", e)
+        return QUICK_REPLY_FAILED
+    }
+    // Go sends before it checks either, and swallows the send's error.
+    if (uid.isEmpty()) {
+        error("Quick reply while logged out", null)
+        return QUICK_REPLY_FAILED
+    }
+    if (uid != notificationUID) {
+        error("Quick reply from another account's notification", null)
+        return QUICK_REPLY_FAILED
+    }
+    if (msgId < 0) {
+        error("Quick reply to invalid message id $msgId", null)
+        return QUICK_REPLY_FAILED
+    }
+    return try {
+        send()
+        QUICK_REPLY_SENT
+    } catch (e: Exception) {
+        error("Failed to send quick reply", e)
+        QUICK_REPLY_FAILED
+    }
+}
+
+// Runs a receiver's work off the main thread and calls finish exactly once:
+// when the work ends or when budgetMs runs out, whichever is first, so the
+// broadcast never outlives its limit. Work that overruns keeps going. An
+// exception from work is logged, since it would otherwise kill the process.
+internal fun runReceiverWork(
+    budgetMs: Long,
+    start: (Runnable) -> Unit,
+    warn: (String) -> Unit,
+    error: (String, Throwable) -> Unit,
+    finish: () -> Unit,
+    work: () -> Unit,
+) {
+    val done = CountDownLatch(1)
+    start(Runnable {
+        try {
+            work()
+        } catch (e: Exception) {
+            error("runReceiverWork: work failed", e)
+        } finally {
+            done.countDown()
+        }
+    })
+    start(Runnable {
+        try {
+            if (!done.await(budgetMs, TimeUnit.MILLISECONDS)) {
+                warn("runReceiverWork: still running after ${budgetMs}ms, finishing the broadcast")
+            }
+        } finally {
+            finish()
+        }
+    })
+}
+
+inte
```

**File**: `shared/android/app/src/main/java/io/keybase/ossifrage/ChatBroadcastReceiver.kt` (modified, +25/-21)
```diff
@@ -19,50 +19,53 @@ class ChatBroadcastReceiver : BroadcastReceiver() {
     }
 
     override fun onReceive(context: Context, intent: Intent) {
-        setupKBRuntime(context, false)
         val convData = ConvData.fromIntent(intent)
         val openConv = intent.getParcelableExtra<PendingIntent>("openConvPendingIntent")
-        val repliedNotification = NotificationCompat.Builder(context, KeybasePushNotificationListenerService.CHAT_CHANNEL_ID)
-                .setContentIntent(openConv)
-                .setTimeoutAfter(1000)
-                .setSmallIcon(R.drawable.ic_notif)
-        val notificationManager = NotificationManagerCompat.from(context)
         val messageBody = getMessageText(intent)
-        if (messageBody != null) {
-            try {
-                val withBackgroundActive: WithBackgroundActive = object : WithBackgroundActive {
-                    override fun task() {
+        val pendingResult = goAsync()
+        runReceiverWork(RECEIVER_BUDGET_MS, { Thread(it).start() }, { NativeLogger.warn(it) }, { msg, e -> NativeLogger.error(msg, e) },
+                { pendingResult.finish() }) {
+            val status = if (messageBody == null) {
+                NativeLogger.error("Message Body in quick reply was null")
+                "Couldn't send reply - Failed to read input."
+            } else {
+                setupKBRuntime(context, false)
+                sendQuickReply({ Keybase.currentUID() }, convData.uid, convData.lastMsgId, { msg, e -> NativeLogger.error(msg, e) }) {
+                    withBackgroundActive(KeybaseLifecycleBind(context), null, { NativeLogger.info(it) }) {
                         Keybase.handlePostTextReply(convData.convID, convData.tlfName, convData.lastMsgId, messageBody)
                     }
                 }
-                withBackgroundActive.whileActive(context)
-                repliedNotification.setContentText("Replied")
-            } catch (e: Exception) {
-                repliedNotification.setContentText("Couldn't send reply")
-                NativeLogger.error("Failed to send quick reply", e)
             }
-        } else {
-            repliedNotification.setContentText("Couldn't send reply - Failed to read input.")
-            NativeLogger.error("Message Body in quick reply was null")
+            val repliedNotification = NotificationCompat.Builder(context, KeybasePushNotificationListenerService.CHAT_CHANNEL_ID)
+                    .setContentIntent(openConv)
+                    .setTimeoutAfter(1000)
+                    .setSmallIcon(R.drawable.ic_notif)
+                    .setContentText(status)
+            NotificationManagerCompat.from(context).notify(convData.convID, 0, repliedNotification.build())
         }
-        notificationManager.notify(convData.convID, 0, repliedNotification.build())
     }
 
     companion object {
         const val KEY_TEXT_REPLY = "key_text_reply"
+
+        // goAsync gives a broadcast 10s; leave margin.
+        private const val RECEIVER_BUDGET_MS = 9_000L
     }
 }
 
 internal data class ConvData(
     @JvmField val convID: String?,
     val tlfName: String?,
-    val lastMsgId: Long
+    val lastMsgId: Long,
+    // The account the notification belongs to.
+    val uid: String,
 ) {
     fun intoIntent(context: Context?): Intent {
         val data = Bundle()
         data.putString("convID", convID)
         data.putString("tlfName", tlfName)
         data.putLong("lastMsgId", lastMsgId)
+        data.putString("uid", uid)
         val intent = Intent(context, ChatBroadcastReceiver::class.java)
         intent.putExtra("ConvData", data)
         return intent
@@ -74,7 +77,8 @@ internal data class ConvData(
             return ConvData(
                 convID = data.getString("convID"),
                 tlfName = data.getString("tlfName"),
-                lastMsgId = data.getLong("lastMsgId")
+                lastMsgId = data.getLong("lastMsgId"),
+                uid = data.getString("uid") ?: "",
             )
         }
     }
```

**File**: `shared/android/app/src/main/java/io/keybase/ossifrage/KBPushNotifier.kt` (modified, +1/-1)
```diff
@@ -112,7 +112,7 @@ class KBPushNotifier internal constructor(private val context: Context, private
                 bundle.putString("uid", chatNotification.uid)
             }
             val pending_intent = buildPendingIntent(bundle)
-            val convData = ConvData(chatNotification.convID, chatNotification.tlfName ?: "", chatNotification.message.id)
+            val convData = ConvData(chatNotification.convID, chatNotification.tlfName ?: "", chatNotification.message.id, chatNotification.uid ?: "")
             val builder = NotificationCompat.Builder(context, KeybasePushNotificationListenerService.CHAT_CHANNEL_ID)
                 .setSmallIcon(R.drawable.ic_notif)
                 .setContentTitle(chatNotification.title ?: "")
```

**File**: `shared/android/app/src/main/java/io/keybase/ossifrage/KeybaseLifecycleBind.kt` (added, +22/-0)
```diff
@@ -0,0 +1,22 @@
+package io.keybase.ossifrage
+
+import android.content.Context
+import android.os.Bundle
+import com.reactnativekb.KbModule
+import keybase.Keybase
+
+internal class KeybaseLifecycleBind(private val context: Context) : LifecycleBind {
+    override fun setAppStateForeground() = Keybase.setAppStateForeground()
+
+    override fun setAppStateBackgroundActive() = Keybase.setAppStateBackgroundActive()
+
+    override fun isAppStateForeground() = Keybase.isAppStateForeground()
+
+    override fun appDidEnterBackground() = Keybase.appDidEnterBackground()
+
+    override fun appBeginBackgroundTaskNonblock() = Keybase.appBeginBackgroundTaskNonblock(KBPushNotifier(context, Bundle()))
+
+    override fun appWillExit() = Keybase.appWillExit(KBPushNotifier(context, Bundle()))
+
+    override fun emitAppLifecycle(state: String) = KbModule.emitAppLifecycle(state)
+}
```

**File**: `shared/android/app/src/main/java/io/keybase/ossifrage/KeybasePushNotificationListenerService.kt` (modified, +88/-68)
```diff
@@ -5,16 +5,16 @@ import android.app.NotificationManager
 import android.content.Context
 import android.os.Build
 import android.os.Bundle
-import android.os.Handler
-import android.os.Looper
 import androidx.core.app.NotificationCompat
 import androidx.core.app.NotificationManagerCompat
 import androidx.core.app.Person
 import com.google.firebase.messaging.FirebaseMessagingService
 import com.google.firebase.messaging.RemoteMessage
 import io.keybase.ossifrage.MainActivity.Companion.setupKBRuntime
 import io.keybase.ossifrage.modules.NativeLogger
+import keybase.ChatNotification
 import keybase.Keybase
+import keybase.PushNotifier
 import com.reactnativekb.KbModule
 import org.json.JSONObject
 
@@ -23,8 +23,12 @@ class KeybasePushNotificationListenerService : FirebaseMessagingService() {
     // was notified about to give context to future notifications.
     private val msgCache = HashMap<String?, SmallMsgRingBuffer>()
 
-    // Avoid ever showing doubles
-    private val seenChatNotifications = HashSet<String>()
+    // Go's seen cache dedupes what Go displays, but not the fallback below: a
+    // redelivered push that Go fails on again would show the fallback twice,
+    // and each display adds the message to msgCache's history again.
+    private val seenChatNotifications = object : LinkedHashMap<String, Unit>(16, 0.75f, false) {
+        override fun removeEldestEntry(eldest: MutableMap.MutableEntry<String, Unit>?) = size > SEEN_CHAT_NOTIFICATIONS_MAX
+    }
     private fun chatNotificationKey(convID: String?, messageId: Int, targetUID: String): String {
         return "$targetUID|$convID|$messageId"
     }
@@ -112,12 +116,12 @@ class KeybasePushNotificationListenerService : FirebaseMessagingService() {
                     // Key includes UID so two signed-in accounts in the same chat are not treated as duplicates.
                     if (!dontNotify) {
                         val notificationKey = chatNotificationKey(n.convID, n.messageId, targetUID)
-                        if (seenChatNotifications.contains(notificationKey)) {
+                        if (seenChatNotifications.containsKey(notificationKey)) {
                             NativeLogger.info("KeybasePushNotificationListenerService skipping duplicate notification: $notificationKey")
                             return
                         }
                         // Mark as seen immediately to prevent duplicate processing
-                        seenChatNotifications.add(notificationKey)
+                        seenChatNotifications[notificationKey] = Unit
                         NativeLogger.info("KeybasePushNotificationListenerService marked notification as seen: $notificationKey")
                     }
 
@@ -129,27 +133,18 @@ class KeybasePushNotificationListenerService : FirebaseMessagingService() {
                         }
                         notifier.setMsgCache(msgCache[n.convID])
                         try {
-                            val withBackgroundActive: WithBackgroundActive = object : WithBackgroundActive {
-                                override fun task() {
-                                    try {
-                                        Keybase.handleBackgroundNotification(n.convID, payload, n.serverMessageBody, n.sender,
-                                                n.membersType.toLong(), n.displayPlaintext, n.messageId.toLong(), n.pushId,
-                                                n.badgeCount.toLong(), n.unixTime, n.soundName, if (dontNotify) null else notifier, true,
-                                                targetUID)
-                                        goProcessingSucceeded = true
-                                        if (!dontNotify) {
-                                            seenChatNotifications.add(chatNotificationKey(n.convID, n.messageId, targetUID))
-                                        }
-                                    } catch (ex: Exception) {
-                                        NativeLogger.error("Go Couldn't handle background notification2: " + ex.message)
-                                        throw ex
-                                    }
-                                }
+                            handleChatPush(KeybaseLifecycleBind(applicationContext), notifier, dontNotify,
+                                    { NativeLogger.info(it) }) { pusher ->
+                                Keybase.handleBackgroundNotification(n.convID, payload, n.serverMessageBody, n.sender,
+                                        n.membersType.toLong(), n.displayPlaintext, n.messageId.toLong(), n.pushId,
+                                        n.badgeCount.toLong(), n.unixTime, n.soundName, pusher, true, targetUID)
+                            }
+                            goProcessingSucceeded = true
+                            if (!dontNotify) {
+                                seenChatNotifications[chatNotificationKey(n.convID, n.messag
```

**File**: `shared/android/app/src/main/java/io/keybase/ossifrage/MainActivity.kt` (modified, +31/-73)
```diff
@@ -10,7 +10,6 @@ import android.os.Bundle
 import android.os.Handler
 import android.os.Looper
 import android.provider.MediaStore
-import android.provider.Settings
 import android.util.Log
 import android.view.KeyEvent
 import androidx.core.content.IntentCompat
@@ -19,10 +18,8 @@ import com.facebook.react.ReactActivity
 import com.facebook.react.ReactActivityDelegate
 import com.facebook.react.ReactApplication
 import com.facebook.react.bridge.Arguments
-import com.facebook.react.bridge.ReactContext
 import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
 import com.facebook.react.defaults.DefaultReactActivityDelegate
-import com.facebook.react.modules.core.PermissionListener
 import com.reactnativekb.DarkModePreference
 import com.reactnativekb.IncomingShareCache
 import com.reactnativekb.KbModule
@@ -40,7 +37,6 @@ import java.security.cert.CertificateException
 import java.util.UUID
 
 class MainActivity : ReactActivity() {
-    private val listener: PermissionListener? = null
     private var isUsingHardwareKeyboard = false
 
     override fun invokeDefaultOnBackPressed() {
@@ -75,8 +71,6 @@ class MainActivity : ReactActivity() {
         super.onCreate(null)
         KeybasePushNotificationListenerService.createNotificationChannel(this)
         updateIsUsingHardwareKeyboard()
-
-        scheduleHandleIntent()
     }
 
     override fun onKeyUp(keyCode: Int, event: KeyEvent): Boolean {
@@ -85,11 +79,6 @@ class MainActivity : ReactActivity() {
         } else super.onKeyUp(keyCode, event)
     }
 
-    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<String>, grantResults: IntArray) {
-        listener?.onRequestPermissionsResult(requestCode, permissions, grantResults)
-        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
-    }
-
     override fun onPause() {
         NativeLogger.info("Activity onPause")
         super.onPause()
@@ -111,10 +100,10 @@ class MainActivity : ReactActivity() {
         return filename
     }
 
-    private fun saveFileToCache(reactContext: ReactContext?, uri: Uri, filename: String): File {
-        val file = IncomingShareCache.file(reactContext!!, filename)
+    private fun saveFileToCache(context: Context, uri: Uri, filename: String): File {
+        val file = IncomingShareCache.file(context, filename)
         try {
-            reactContext.contentResolver.openInputStream(uri).use { istream ->
+            context.contentResolver.openInputStream(uri).use { istream ->
                 FileOutputStream(file).use { ostream ->
                     val buf = ByteArray(64 * 1024)
                     var len: Int
@@ -129,19 +118,19 @@ class MainActivity : ReactActivity() {
         return file
     }
 
-    private fun readFileFromUri(reactContext: ReactContext?, uri: Uri?): String? {
+    private fun readFileFromUri(context: Context, uri: Uri?): String? {
         if (uri == null) return null
         var filePath: String?
         filePath = if (uri.scheme == "content") {
-            val resolver = reactContext!!.contentResolver
+            val resolver = context.contentResolver
             val mimeType = resolver.getType(uri)
             val extension = MimeTypeMap.getSingleton().getExtensionFromMimeType(mimeType)
 
             // Load the filename from the resolver.
             val filename = getFileNameFromResolver(resolver, uri, extension)
 
             // Now load the file itself.
-            val file = saveFileToCache(reactContext, uri, filename)
+            val file = saveFileToCache(context, uri, filename)
             file.path
         } else {
             uri.path
@@ -152,8 +141,7 @@ class MainActivity : ReactActivity() {
     override fun onResume() {
         NativeLogger.info("Activity onResume")
         super.onResume()
-        Keybase.setAppStateForeground()
-        KbModule.emitAppLifecycle("active")
+        (application as MainApplication).lifecycleReporter.onMainActivityResume()
         handleIntent()
     }
 
@@ -165,34 +153,36 @@ class MainActivity : ReactActivity() {
     override fun onDestroy() {
         NativeLogger.info("Activity onDestroy")
         super.onDestroy()
-        // A configuration change destroys and recreates the activity; only a
-        // real finish is the app going away.
-        if (isFinishing) {
-            Keybase.appWillExit(KBPushNotifier(this, Bundle()))
-            KbModule.emitAppLifecycle("background")
-        }
+        (application as MainApplication).lifecycleReporter.onMainActivityDestroy(isFinishing, isChangingConfigurations)
     }
 
+    // A share or notification intent parks here until JS asks for it. Nothing else is parked:
+    // deep links go through super.onNewIntent -> RCTLinkingManager, so a plain launch leaves
+    // this null.
     private var cachedIntent: Intent? = null
 
     private var pendingShareUris: List<Uri>? = null
     private var pendingShareSubject: String? = null
     private var p
```

#### Recent Merged Pull Requests:
- **PR #29736** (closed): engine 6a: errors carry a kind, so cancels are told apart and stop logging as errors (@chrisnojima)
- **PR #29735** (closed): engine 5b: waiting keys are a typed registry, and generated calls take it (@chrisnojima)
- **PR #29734** (closed): engine 5a: one waiting tracker per session, settled exactly once (@chrisnojima)
- **PR #29733** (closed): engine 4b: provisioning runs on the Dialog, and the flow-handle store is gone (@chrisnojima)
- **PR #29732** (closed): engine 4a: service dialogs go through one Dialog, and a screen's flow ends when its route goes away (@chrisnojima)
- **PR #29726** (2026-10-02): fix(login): recover password asks before losing server-stored PGP keys instead of hanging (@chrisnojima)
- **PR #29724** (2026-10-02): fix: the rekey loop no longer waits forever on the GUI's rekey UI (@chrisnojima)
- **PR #29722** (2026-10-02): test(chat): desktop and iOS chat e2e flows, run locally (@chrisnojima)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

# Forensic Learning Record (Deep Inspection): jacklandrin/OnlySwitch

> **Canonical Artifact**: `07_PROJECT_LEARNING/jacklandrin-onlyswitch-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/jacklandrin/OnlySwitch](https://github.com/jacklandrin/OnlySwitch))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T22:36:40.813Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `jacklandrin/OnlySwitch`
- **Description**: ⚙️ All-in-One menu bar app, hide 💻MacBook Pro's notch, dark mode, AirPods, Shortcuts
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 5953 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `OnlySwitch/Header/CBBlueLightClient.h`
```
//
//  CBBlueLightClient.h
//  OnlySwitch
//
//  Created by Jacklandrin on 2021/12/5.
//

#import <Foundation/Foundation.h>

// Partial header for CBBlueLightClient in private CoreBrightness API
@interface CBBlueLightClient : NSObject

typedef struct {
    int hour;
    int minute;
} Time;

typedef struct {
    Time fromTime;
    Time toTime;
} Schedule;

typedef struct {
    BOOL active;
    BOOL enabled;
    BOOL sunSchedulePermitted;
    int mode;
    Schedule schedule;
    unsigned long long disableFlags;
    BOOL available;
} Status;

- (BOOL)setStrength:(float)strength commit:(BOOL)commit;
- (BOOL)setEnabled:(BOOL)enabled;
- (BOOL)setMode:(int)mode;
- (BOOL)setSchedule:(Schedule *)schedule;
- (BOOL)getStrength:(float *)strength;
- (BOOL)getBlueLightStatus:(Status *)status;
- (void)setStatusNotificationBlock:(void (^)(void))block;
+ (BOOL)supportsBlueLightReduction;
@end

```

### Core Architecture Module: `OnlySwitch/Header/CBTrueToneClient.h`
```
//
//  CBTrueToneClient.h
//  OnlySwitch
//
//  Created by Jacklandrin on 2023/10/27.
//

#ifndef CBTrueToneClient_h
#define CBTrueToneClient_h

@interface CBTrueToneClient : NSObject
- (BOOL)available;
- (BOOL)supported;
- (BOOL)enabled;
- (BOOL)setEnabled:(BOOL)arg1;
@end

#endif /* CBTrueToneClient_h */

```

### Core Architecture Module: `OnlySwitch/Header/MenuBarClientCoreBridge.h`
```
//
//  MenuBarClientCoreBridge.h
//  OnlySwitch
//

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@interface MenuBarClientCoreBridge : NSObject

@property (nonatomic, readonly, getter=isAvailable) BOOL available;

- (void)activateWithAllowedSystemItems:(NSArray<NSNumber *> *)systemItems
              allowedBundleIdentifiers:(NSArray<NSString *> *)bundleIdentifiers
                            completion:(void (^)(NSError * _Nullable error))completion;
- (void)invalidate;

@end

NS_ASSUME_NONNULL_END

```

### Core Architecture Module: `OnlySwitch/Header/OnlySwitch-Bridging-Header.h`
```
//
//  OnlySwitch-Bridging-Header.h
//  OnlySwitch
//
//  Created by Jacklandrin on 2021/12/5.
//
#pragma once
#import "CBBlueLightClient.h"
#import "CBTrueToneClient.h"
#import "BrightnessControl.h"
#import "KeyboardManager.h"
#import "DDCControl.h"
#import "MenuBarClientCoreBridge.h"
#import "ProcessUsage.h"
#import <Foundation/Foundation.h>
#import <IOKit/i2c/IOI2CInterface.h>
#import <CoreGraphics/CoreGraphics.h>

//for turn on/off bluetooth
void IOBluetoothPreferenceSetControllerPowerState(int state);
int IOBluetoothPreferenceGetControllerPowerState();

extern void DisplayServicesBrightnessChanged(CGDirectDisplayID display, double brightness);
extern int DisplayServicesGetBrightness(CGDirectDisplayID display, float *brightness);
extern int DisplayServicesSetBrightness(CGDirectDisplayID display, float brightness);
extern int DisplayServicesGetLinearBrightness(CGDirectDisplayID display, float *brightness);
extern int DisplayServicesSetLinearBrightness(CGDirectDisplayID display, float brightness);

extern void CGSServiceForDisplayNumber(CGDirectDisplayID display, io_service_t* service);

```

### Core Architecture Module: `OnlySwitch/Header/ProcessUsage.h`
```
//
//  ProcessUsage.h
//  OnlySwitch
//
//  Swift-friendly wrapper for libproc's incorrectly typed rusage buffer.
//

#pragma once

#import <libproc.h>
#import <sys/resource.h>

/// Reads version-2 process resource usage into the supplied struct.
///
/// libproc declares its output argument as `rusage_info_t *`, although
/// `rusage_info_t` is itself `void *`. The Darwin ABI expects the address of
/// the concrete output struct; centralizing its required C cast here prevents
/// Swift from accidentally passing the address of a pointer-sized variable.
static inline int OnlySwitchProcessRusageV2(pid_t pid, struct rusage_info_v2 *usage) {
    return proc_pid_rusage(pid, RUSAGE_INFO_V2, (rusage_info_t *)usage);
}

```

### Core Architecture Module: `OnlySwitch/Player/MusicAppPlayer/AppleMusic/iTunesBridge/ObjC/iTunes.h`
```
/*
 * iTunes.h
 */

#import <AppKit/AppKit.h>
#import <ScriptingBridge/ScriptingBridge.h>


@class iTunesApplication, iTunesItem, iTunesAirPlayDevice, iTunesArtwork, iTunesEncoder, iTunesEQPreset, iTunesPlaylist, iTunesAudioCDPlaylist, iTunesLibraryPlaylist, iTunesRadioTunerPlaylist, iTunesSource, iTunesSubscriptionPlaylist, iTunesTrack, iTunesAudioCDTrack, iTunesFileTrack, iTunesSharedTrack, iTunesURLTrack, iTunesUserPlaylist, iTunesFolderPlaylist, iTunesVisual, iTunesWindow, iTunesBrowserWindow, iTunesEQWindow, iTunesMiniplayerWindow, iTunesPlaylistWindow, iTunesVideoWindow;

enum iTunesEKnd {
	iTunesEKndTrackListing = 'kTrk' /* a basic listing of tracks within a playlist */,
	iTunesEKndAlbumListing = 'kAlb' /* a listing of a playlist grouped by album */,
	iTunesEKndCdInsert = 'kCDi' /* a printout of the playlist for jewel case inserts */
};
typedef enum iTunesEKnd iTunesEKnd;

enum iTunesEnum {
	iTunesEnumStandard = 'lwst' /* Standard PostScript error handling */,
	iTunesEnumDetailed = 'lwdt' /* print a detailed report of PostScript errors */
};
typedef enum iTunesEnum iTunesEnum;

enum iTunesEPlS {
	iTunesEPlSStopped = 'kPSS',
	iTunesEPlSPlaying = 'kPSP',
	iTunesEPlSPaused = 'kPSp',
	iTunesEPlSFastForwarding = 'kPSF',
	iTunesEPlSRewinding = 'kPSR'
};
typedef enum iTunesEPlS iTunesEPlS;

enum iTunesERpt {
	iTunesERptOff = 'kRpO',
	iTunesERptOne = 'kRp1',
	iTunesERptAll = 'kAll'
};
typedef enum iTunesERpt iTunesERpt;

enum iTunesEShM {
	iTunesEShMSongs = 'kShS',
	iTunesEShMAlbums = 'kShA',
	iTunesEShMGroupings = 'kShG'
};
typedef enum iTunesEShM iTunesEShM;

enum iTunesEVSz {
	iTunesEVSzSmall = 'kVSS',
	iTunesEVSzMedium = 'kVSM',
	iTunesEVSzLarge = 'kVSL'
};
typedef enum iTunesEVSz iTunesEVSz;

enum iTunesESrc {
	iTunesESrcLibrary = 'kLib',
	iTunesESrcIPod = 'kPod',
	iTunesESrcAudioCD = 'kACD',
	iTunesESrcMP3CD = 'kMCD',
	iTunesESrcRadioTuner = 'kTun',
	iTunesESrcSharedLibrary = 'kShd',
	iTunesESrcITunesStore = 'kITS',
	iTunesESrcUnknown = 'kUnk'
};
typedef enum iTunesESrc iTunesESrc;

enum iTunesESrA {
	iTunesESrAAlbums = 'kSrL' /* albums only */,
	iTunesESrAAll = 'kAll' /* all text fields */,
	iTunesESrAArtists = 'kSrR' /* artists only */,
	iTunesESrAComposers = 'kSrC' /* composers only */,
	iTunesESrADisplayed = 'kSrV' /* visible text fields */,
	iTunesESrASongs = 'kSrS' /* song names only */
};
typedef enum iTunesESrA iTunesESrA;

enum iTunesESpK {
	iTunesESpKNone = 'kNon',
	iTunesESpKBooks = 'kSpA',
	iTunesESpKFolder = 'kSpF',
	iTunesESpKGenius = 'kSpG',
	iTunesESpKITunesU = 'kSpU',
	iTunesESpKLibrary = 'kSpL',
	iTunesESpKMovies = 'kSpI',
	iTunesESpKMusic = 'kSpZ',
	iTunesESpKPodcasts = 'kSpP',
	iTunesESpKPurchasedMusic = 'kSpM',
	iTunesESpKTVShows = 'kSpT'
};
typedef enum iTunesESpK iTunesESpK;

enum iTunesEMdK {
	iTunesEMdKAlertTone = 'kMdL' /* alert tone track */,
	iTunesEMdKAudiobook = 'kMdA' /* audiobook track */,
	iTunesEMdKBook = 'kMdB' /* book track */,
	iTunesEMdKHomeVideo = 'kVdH' /* home video track */,
	iTunesEMdKITunesU = 'kMdI' /* iTunes U track */,
	iTunesEMdKMovie = 'kVdM' /* movie track */,
	iTunesEMdKSong = 'kMdS' /* music track */,
	iTunesEMdKMusicVideo = 'kVdV' /* music video track */,
	iTunesEMdKPodcast = 'kMdP' /* podcast track */,
	iTunesEMdKRingtone = 'kMdR' /* ringtone track */,
	iTunesEMdKTVShow = 'kVdT' /* TV show track */,
	iTunesEMdKVoiceMemo = 'kMdO' /* voice memo track */,
	iTunesEMdKUnknown = 'kUnk'
};
typedef enum iTunesEMdK iTunesEMdK;

enum iTunesEVdK {
	iTunesEVdKNone = 'kNon' /* not a video or unknown video kind */,
	iTunesEVdKHomeVideo = 'kVdH' /* home video track */,
	iTunesEVdKMovie = 'kVdM' /* movie track */,
	iTunesEVdKMusicVideo = 'kVdV' /* music video track */,
	iTunesEVdKTVShow = 'kVdT' /* TV show track */
};
typedef enum iTunesEVdK iTunesEVdK;

enum iTunesERtK {
	iTunesERtKUser = 'kRtU' /* user-specified rating */,
	iTunesERtKComputed = 'kRtC' /* iTunes-computed rating */
};
typedef enum iTunesERtK iTunesERtK;

enum iTunesEAPD {
	iTunesEAPDComputer = 'kAPC',
	iTunesEAPDAirPortExpress = 'kAPX',
	iTunesEAPDAppleTV = 'kAPT',
	iTunesEAPDAirPlayDevice = 'kAPO',
	iTunesEAPDUnknown = 'kAPU'
};
typedef enum iTunesEAPD iTunesEAPD;

enum iTunesEClS {
	iTunesEClSUnknown = 'kUnk',
	iTunesEClSPurchased = 'kPur',
	iTunesEClSMatched = 'kMat',
	iTunesEClSUploaded = 'kUpl',
	iTunesEClSIneligible = 'kRej',
	iTunesEClSRemoved = 'kRem',
	iTunesEClSError = 'kErr',
	iTunesEClSDuplicate = 'kDup',
	iTunesEClSSubscription = 'kSub',
	iTunesEClSNoLongerAvailable = 'kRev',
	iTunesEClSNotUploaded = 'kUpP'
};
typedef enum iTunesEClS iTunesEClS;

@protocol iTunesGenericMethods

- (void) printPrintDialog:(BOOL)printDialog withProperties:(NSDictionary *)withProperties kind:(iTunesEKnd)kind theme:(NSString *)theme;  // Print the specified object(s)
- (void) close;  // Close an object
- (void) delete;  // Delete an element from an object
- (SBObject *) duplicateTo:(SBObject *)to;  // Duplicate one or more object(s)
- (BOOL) exists;  // Verify if an object exists
- (void) open;  // Open the specified object(s)
- (void) save;  // Save the specified object(s)
- (void) playOnce:(BOOL)once;  // play the current track or the specified track or file.
- (void) select;  // select the specified object(s)

@end



/*
 * iTunes Suite
 */

// The application program
@interface iTunesApplication : SBApplication

- (SBElementArray<iTunesAirPlayDevice *> *) AirPlayDevices;
- (SBElementArray<iTunesBrowserWindow *> *) browserWindows;
- (SBElementArray<iTunesEncoder *> *) encoders;
- (SBElementArray<iTunesEQPreset *> *) EQPresets;
- (SBElementArray<iTunesEQWindow *> *) EQWindows;
- (SBElementArray<iTunesMiniplayerWindow *> *) miniplayerWindows;
- (SBElementArray<iTunesPlaylist *> *) playlists;
- (SBElementArray<iTunesPlaylistWindow *> *) playlistWindows;
- (SBElementArray<iTunesSource *> *) sources;
- (SBElementArray<iTunesTrack *> *) tracks;
- (SBElementArray<iTunesVideoWindow *> *) videoWindows;
- (SBElementArray<iTunesVisual *> *) visuals;
- (SBElementArray<iTunesWindow *> *) windows;

@property (readonly) BOOL AirPlayEnabled;  // is AirPlay currently enabled?
@property (readonly) BOOL converting;  // is a track currently being converted?
@property (copy) NSArray<iTunesAirPlayDevice *> *currentAirPlayDevices;  // the currently selected AirPlay device(s)
@property (copy) iTunesEncoder *currentEncoder;  // the currently selected encoder (MP3, AIFF, WAV, etc.)
@property (copy) iTunesEQPreset *currentEQPreset;  // the currently selected equalizer preset
@property (copy, readonly) iTunesPlaylist *currentPlaylist;  // the playlist containing the currently targeted track
@property (copy, readonly) NSString *currentStreamTitle;  // the name of the current song in the playing stream (provided by streaming server)
@property (copy, readonly) NSString *currentStreamURL;  // the URL of the playing stream or streaming web site (provided by streaming server)
@property (copy, readonly) iTunesTrack *currentTrack;  // the current targeted track
@property (copy) iTunesVisual *currentVisual;  // the currently selected visual plug-in
@property BOOL EQEnabled;  // is the equalizer enabled?
@property BOOL fixedIndexing;  // true if all AppleScript track indices should be independent of the play order of the owning playlist.
@property BOOL frontmost;  // is iTunes the frontmost application?
@property BOOL fullScreen;  // are visuals displayed using the entire screen?
@property (copy, readonly) NSString *name;  // the name of the application
@property BOOL mute;  // has the sound output been muted?
@property double playerPosition;  // the player’s position within the currently playing track in seconds.
@property (readonly) iTunesEPlS playerState;  // is iTunes stopped, paused, or playing?
@property (copy, readonly) SBObject *selection;  // the selection visible to the user
@property BOOL shuffleEnabled;  // are songs played in random order?
@property iTunesEShM shuffleMode;  // the playback shuffle mode
@property iTunesERpt songRepeat;  // the playback repeat mode
@prope
```

### Core Architecture Module: `OnlySwitch/Player/MusicAppPlayer/Spotify/SpotifyBridge/ObjC/Spotify.h`
```
/*
 * Spotify.h
 */

#import <AppKit/AppKit.h>
#import <ScriptingBridge/ScriptingBridge.h>


@class SpotifyApplication, SpotifyTrack, SpotifyApplication;

enum SpotifyEPlS {
	SpotifyEPlSStopped = 'kPSS',
	SpotifyEPlSPlaying = 'kPSP',
	SpotifyEPlSPaused = 'kPSp'
};
typedef enum SpotifyEPlS SpotifyEPlS;



/*
 * Spotify Suite
 */

// The Spotify application.
@interface SpotifyApplication : SBApplication

@property (copy, readonly) SpotifyTrack *currentTrack;  // The current playing track.
@property NSInteger soundVolume;  // The sound output volume (0 = minimum, 100 = maximum)
@property (readonly) SpotifyEPlS playerState;  // Is Spotify stopped, paused, or playing?
@property double playerPosition;  // The player’s position within the currently playing track in seconds.
@property (readonly) BOOL repeatingEnabled;  // Is repeating enabled in the current playback context?
@property BOOL repeating;  // Is repeating on or off?
@property (readonly) BOOL shufflingEnabled;  // Is shuffling enabled in the current playback context?
@property BOOL shuffling;  // Is shuffling on or off?

- (void) nextTrack;  // Skip to the next track.
- (void) previousTrack;  // Skip to the previous track.
- (void) playpause;  // Toggle play/pause.
- (void) pause;  // Pause playback.
- (void) play;  // Resume playback.
- (void) playTrack:(NSString *)x inContext:(NSString *)inContext;  // Start playback of a track in the given context.

@end

// A Spotify track.
@interface SpotifyTrack : SBObject

@property (copy, readonly) NSString *artist;  // The artist of the track.
@property (copy, readonly) NSString *album;  // The album of the track.
@property (readonly) NSInteger discNumber;  // The disc number of the track.
@property (readonly) NSInteger duration;  // The length of the track in seconds.
@property (readonly) NSInteger playedCount;  // The number of times this track has been played.
@property (readonly) NSInteger trackNumber;  // The index of the track in its album.
@property (readonly) BOOL starred;  // Is the track starred?
@property (readonly) NSInteger popularity;  // How popular is this track? 0-100
- (NSString *) id;  // The ID of the item.
@property (copy, readonly) NSString *name;  // The name of the track.
@property (copy, readonly) NSString *artworkUrl;  // The URL of the track%apos;s album cover.
@property (copy, readonly) NSImage *artwork;  // The property is deprecated and will never be set. Use the 'artwork url' instead.
@property (copy, readonly) NSString *albumArtist;  // That album artist of the track.
@property (copy) NSString *spotifyUrl;  // The URL of the track.


@end



/*
 * Standard Suite
 */

// The application's top level scripting object.
@interface SpotifyApplication (StandardSuite)

@property (copy, readonly) NSString *name;  // The name of the application.
@property (readonly) BOOL frontmost;  // Is this the frontmost (active) application?
@property (copy, readonly) NSString *version;  // The version of the application.

@end


```

### Core Architecture Module: `OnlySwitch/Utilities/DDC/DDCControl.h`
```
//
//  DDCControl.h
//  OnlySwitch
//
//  Talks DDC/CI to external displays so their brightness can follow the
//  built-in screen. Uses the private `IOAVService` API on Apple Silicon –
//  the same approach used by MonitorControl and waydabber/m1ddc.
//

#ifndef DDCControl_h
#define DDCControl_h

#import <Foundation/Foundation.h>
#import <IOKit/IOKitLib.h>

/// `IOAVService` is a private CoreFoundation type. Its symbols are exported by
/// IOKit, so we only need to forward declare them here.
typedef CFTypeRef IOAVServiceRef;

extern IOAVServiceRef IOAVServiceCreate(CFAllocatorRef allocator);
extern IOAVServiceRef IOAVServiceCreateWithService(CFAllocatorRef allocator, io_service_t service);
extern IOReturn IOAVServiceReadI2C(IOAVServiceRef service, uint32_t chipAddress, uint32_t offset, void *outputBuffer, uint32_t outputBufferSize);
extern IOReturn IOAVServiceWriteI2C(IOAVServiceRef service, uint32_t chipAddress, uint32_t dataAddress, void *inputBuffer, uint32_t inputBufferSize);

/// Thin wrapper around DDC/CI brightness control for every connected external
/// monitor. All methods touch the I2C bus and are therefore slow (tens of
/// milliseconds per display) – call them from a background queue.
@interface DDCControl : NSObject

/// Rediscovers the connected external (DDC/CI capable) displays and caches each
/// one's maximum brightness value. Call once before adjusting brightness and
/// again whenever the screen arrangement changes.
+ (void)refreshExternalDisplays;

/// Number of external displays found by the last `refreshExternalDisplays` call.
+ (NSInteger)externalDisplayCount;

/// Sets every cached external display to `percentage` (0.0 – 1.0) of its own
/// maximum brightness.
+ (void)setExternalBrightnessPercentage:(float)percentage;

/// Powers every cached external display on (`YES`) or into DPMS off (`NO`) via
/// the VCP power-mode feature, so they can go fully dark with the built-in panel.
+ (void)setExternalDisplaysPower:(BOOL)on;

@end

#endif /* DDCControl_h */

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #37** (2022-11-24): **Radio station not working**
  *Symptoms*: Now that I finally got my media keys to work with onlyswitch radio, it seems that my favorite radio is not compatible with onlyswitch (did not occur to me to test before) :))  This is the link: http://live.radiocafe.ro:8048/live.aac  The song title is recognized, but there is no sound. Can you please advise?  Thank you very much for your support!
  **Post-Mortem & Fix Analysis**:
  > I think it's my bug. acc stream should be played automatically switch to player without sound wave effect. There's a workaround, you can turn off the sound wave effect in onlyswitch's radio setting.
  > Perfect, you are corect! Thank you! Feel free to close the issue if you don't want to tackle it (now or anytime).

- **Issue #13** (2022-01-15): **Crashes when clicking 'check for updates' button**
  *Symptoms*: On 1.8.1 (and earlier editions as well), when clicking on 'Check for updates', the app crashes.  MacOS 12.1 / M1 Mac mini  ``` ------------------------------------- Translated Report (Full Report Below) -------------------------------------  Process:               OnlySwitch [9339] Path:                  /Applications/Only Switch.app/Contents/MacOS/OnlySwitch Identifier:            jacklandrin.OnlySwitch Version:               1.8.1 (30) Code Type:             ARM-64 (Native) Parent Process:        launchd [1] User ID:               501  Date/Time:             2022-01-09 14:54:13.6347 +0000 OS Version:            macOS 12.1 (21C52) Report Version:        12 Anonymous UUID:        6FD2585F-D562-E91A-3BB0-A9A5FE7B2407  Sleep/Wake UUID:       AADB071A-B6D0-49FB-BDC2-467129154A67  Time Awake Since Boot: 92000 seconds Time Since Wake:       6535 seconds  System Integrity Protection: enabled  Crashed Thread:        0  Dispatch queue: com.apple.main-thread  Exception Type:        EXC_BREAKPOINT (SIGTRAP) Exception Codes:       0x0000000000000001, 0x00000001e6d2b7ac Exception Note:        EXC_CORPSE_NOTIFY  Termination Reason:    Namespace SIGNAL, Code 5 Trace/BPT trap: 5 Terminating Process:   exc handler [9339]  Thread 0 Crashed::  Dispatch queue: com.apple.main-thread 0   SwiftUI                       	       0x1e6d2b7ac validateDimension #1 (min:ideal:max:) in NSView.intrinsicLayoutTraits() + 216 1   SwiftUI                       	       0x
  **Post-Mortem & Fix Analysis**:
  > Same here with M1 Mac mini but on MacOS 12.2 Beta.  ------------------------------------- Translated Report (Full Report Below) -------------------------------------  Process:               OnlySwitch [26205] Path:                  /Applications/Only Switch.app/Contents/MacOS/OnlySwitch Identifier:            jacklandrin.OnlySwitch Version:               2.0 (35) Code Type:             ARM-64 (Native) Parent Process:        launchd [1] User ID:               501  Date/Time:             2022-01-13 18:05:31.4275 -0500 OS Version:            macOS 12.2 (21D5039d) Report Version:        12 Anonymous UUID:        EC51302F-8BF8-5E71-231C-762A4AD64A1B   Time Awake Since Boot: 180000 seconds  System Integrity Protection: enabled  Crashed Thread:        0  Dispatch queue: com.apple.main-thread  Exception Type:        EXC_BREAKPOINT (SIGTRAP) Exception Codes:       0x0000000000000001, 0x00000001cc1d4798 Exception Note:        EXC_CORPSE_NOTIFY  Termination Reason:  
  > Same issue and solution. https://github.com/sindresorhus/Gifski/commit/ac180e4e76acaa9b230bbb401b8bb364c2f2f424
  > It fixed in version 2.1

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

### Incident Patch 1: `8afbe4f2` (2026-09-26)
**Commit Message**: fix battery volume position

**File**: `OnlySwitch/Features/SwitchItem/SwitchBar/SwitchBarView.swift` (modified, +0/-1)
```diff
@@ -31,7 +31,6 @@ struct SwitchBarView: View {
             
             if switchOption.switchType == .airPods {
                 AirPodsBatteryView(batteryValues: convertBattery(info: switchOption.info))
-                    .offset(x: 60)
             } else if switchOption.switchType == .pomodoroTimer {
                 TimerCountDownView(ptswitch: switchOption.switchOperator as! PomodoroTimerSwitch)
             }
```

---

### Incident Patch 2: `68ca29b5` (2026-09-24)
**Commit Message**: fix: localize network detail labels

**File**: `Localization/Localizable.xcstrings` (modified, +16/-0)
```diff
@@ -26774,6 +26774,22 @@
     "%@ model unavailable" : { "extractionState" : "manual", "localizations" : { "en" : { "stringUnit" : { "state" : "translated", "value" : "%@ model unavailable" } } } },
     "%d logical cores" : { "extractionState" : "manual", "localizations" : { "en" : { "stringUnit" : { "state" : "translated", "value" : "%d logical cores" } } } },
     "%d physical cores" : { "extractionState" : "manual", "localizations" : { "en" : { "stringUnit" : { "state" : "translated", "value" : "%d physical cores" } } } },
+    "%d dBm" : { "extractionState" : "manual", "localizations" : { "en" : { "stringUnit" : { "state" : "translated", "value" : "%d dBm" } } } },
+    "%.0f Mbps" : { "extractionState" : "manual", "localizations" : { "en" : { "stringUnit" : { "state" : "translated", "value" : "%.0f Mbps" } } } },
+    "Addresses" : { "extractionState" : "manual", "localizations" : { "en" : { "stringUnit" : { "state" : "translated", "value" : "Addresses" } } } },
+    "Down" : { "extractionState" : "manual", "localizations" : { "en" : { "stringUnit" : { "state" : "translated", "value" : "Down" } } } },
+    "Hardware address" : { "extractionState" : "manual", "localizations" : { "en" : { "stringUnit" : { "state" : "translated", "value" : "Hardware address" } } } },
+    "Interface" : { "extractionState" : "manual", "localizations" : { "en" : { "stringUnit" : { "state" : "translated", "value" : "Interface" } } } },
+    "Local IPv4" : { "extractionState" : "manual", "localizations" : { "en" : { "stringUnit" : { "state" : "translated", "value" : "Local IPv4" } } } },
+    "Local IPv6" : { "extractionState" : "manual", "localizations" : { "en" : { "stringUnit" : { "state" : "translated", "value" : "Local IPv6" } } } },
+    "No active Wi-Fi or Ethernet interface" : { "extractionState" : "manual", "localizations" : { "en" : { "stringUnit" : { "state" : "translated", "value" : "No active Wi-Fi or Ethernet interface" } } } },
+    "Network details unavailable" : { "extractionState" : "manual", "localizations" : { "en" : { "stringUnit" : { "state" : "translated", "value" : "Network details unavailable" } } } },
+    "Public IP addresses are retrieved from the ipify service." : { "extractionState" : "manual", "localizations" : { "en" : { "stringUnit" : { "state" : "translated", "value" : "Public IP addresses are retrieved from the ipify service." } } } },
+    "Public IPv4" : { "extractionState" : "manual", "localizations" : { "en" : { "stringUnit" : { "state" : "translated", "value" : "Public IPv4" } } } },
+    "Public IPv6" : { "extractionState" : "manual", "localizations" : { "en" : { "stringUnit" : { "state" : "translated", "value" : "Public IPv6" } } } },
+    "Signal" : { "extractionState" : "manual", "localizations" : { "en" : { "stringUnit" : { "state" : "translated", "value" : "Signal" } } } },
+    "Transmit rate" : { "extractionState" : "manual", "localizations" : { "en" : { "stringUnit" : { "state" : "translated", "value" : "Transmit rate" } } } },
+    "Up" : { "extractionState" : "manual", "localizations" : { "en" : { "stringUnit" : { "state" : "translated", "value" : "Up" } } } },
     "CPU" : { "extractionState" : "manual", "localizations" : { "en" : { "stringUnit" : { "state" : "translated", "value" : "CPU" } } } },
     "CPU %@" : { "extractionState" : "manual", "localizations" : { "en" : { "stringUnit" : { "state" : "translated", "value" : "CPU %@" } } } },
     "Controls" : { "extractionState" : "manual", "localizations" : { "en" : { "stringUnit" : { "state" : "translated", "value" : "Controls" } } } },
```

**File**: `OnlySwitch/Features/SystemMonitor/SystemMonitorPanelView.swift` (modified, +2/-2)
```diff
@@ -449,12 +449,12 @@ struct SystemMonitorPanelView: View {
                 networkDetailRow("Network".localized(), value: ssid)
             }
             if let signalStrength = interface.signalStrength {
-                networkDetailRow("Signal".localized(), value: "\(signalStrength) dBm")
+                networkDetailRow("Signal".localized(), value: "%d dBm".localizedFormat(signalStrength))
             }
             if let transmitRate = interface.transmitRateMbps, transmitRate > 0 {
                 networkDetailRow(
                     "Transmit rate".localized(),
-                    value: String(format: "%.0f Mbps", transmitRate)
+                    value: "%.0f Mbps".localizedFormat(transmitRate)
                 )
             }
             if let macAddress = interface.macAddress {
```

---

### Incident Patch 3: `58632086` (2026-09-24)
**Commit Message**: fix: validate network interface sockaddr lengths

**File**: `OnlySwitch/Features/SystemMonitor/MacSystemMonitorCollector.swift` (modified, +17/-2)
```diff
@@ -295,6 +295,17 @@ enum NetworkDetailsSampler {
     }
 
     private static func numericAddress(_ address: UnsafePointer<sockaddr>) -> String? {
+        let minimumLength: Int
+        switch Int32(address.pointee.sa_family) {
+        case AF_INET:
+            minimumLength = MemoryLayout<sockaddr_in>.size
+        case AF_INET6:
+            minimumLength = MemoryLayout<sockaddr_in6>.size
+        default:
+            return nil
+        }
+        guard Int(address.pointee.sa_len) >= minimumLength else { return nil }
+
         var host = Array(repeating: CChar(0), count: Int(NI_MAXHOST))
         let result = getnameinfo(
             address,
@@ -313,12 +324,16 @@ enum NetworkDetailsSampler {
     private static func macAddress(_ address: UnsafePointer<sockaddr>) -> String? {
         let linkAddress = UnsafeRawPointer(address).assumingMemoryBound(to: sockaddr_dl.self)
         let length = Int(linkAddress.pointee.sdl_alen)
+        let nameLength = Int(linkAddress.pointee.sdl_nlen)
         guard length > 0,
-              let dataOffset = MemoryLayout<sockaddr_dl>.offset(of: \sockaddr_dl.sdl_data)
+              let dataOffset = MemoryLayout<sockaddr_dl>.offset(of: \sockaddr_dl.sdl_data),
+              Int(address.pointee.sa_len) >= dataOffset,
+              nameLength <= Int(address.pointee.sa_len) - dataOffset,
+              length <= Int(address.pointee.sa_len) - dataOffset - nameLength
         else { return nil }
 
         let bytes = UnsafeRawPointer(linkAddress)
-            .advanced(by: dataOffset + Int(linkAddress.pointee.sdl_nlen))
+            .advanced(by: dataOffset + nameLength)
             .assumingMemoryBound(to: UInt8.self)
         return (0 ..< length)
             .map { String(format: "%02X", bytes[$0]) }
```

---

### Incident Patch 4: `c3489cb4` (2026-09-24)
**Commit Message**: fix: classify M3 temperature sensors

**File**: `OnlySwitch/Features/SystemMonitor/MacSystemMonitorCollector.swift` (modified, +17/-7)
```diff
@@ -66,6 +66,13 @@ enum MemoryPressureSampler {
 enum SMCTemperatureCodec {
     private static let sp78 = fourCharacterCode("sp78")
     private static let floatingPoint = fourCharacterCode("flt ")
+    private static let m3CPUKeys: Set<String> = [
+        "Tf04", "Tf09", "Tf0A", "Tf0B", "Tf0D", "Tf0E",
+        "Tf44", "Tf49", "Tf4A", "Tf4B", "Tf4D", "Tf4E"
+    ]
+    private static let m3GPUKeys: Set<String> = [
+        "Tf14", "Tf18", "Tf19", "Tf1A", "Tf24", "Tf28", "Tf29", "Tf2A"
+    ]
 
     static func decode(dataType: UInt32, bytes: [UInt8]) -> Double? {
         switch dataType {
@@ -92,26 +99,29 @@ enum SMCTemperatureCodec {
 
     static func isCPUKey(_ key: String, chipModel: String?) -> Bool {
         if key.hasPrefix("Tp") || key.hasPrefix("Te") { return true }
-        guard key.hasPrefix("Tf"), let chipModel else { return false }
-        return chipModel.range(of: #"\bM3(?:\s|$)"#, options: .regularExpression) != nil
+        return isM3(chipModel) && m3CPUKeys.contains(key)
     }
 
-    static func isGPUKey(_ key: String) -> Bool {
-        key.hasPrefix("Tg")
+    static func isGPUKey(_ key: String, chipModel: String?) -> Bool {
+        key.hasPrefix("Tg") || (isM3(chipModel) && m3GPUKeys.contains(key))
     }
 
     static func isCPUKey(_ key: UInt32, chipModel: String?) -> Bool {
         isCPUKey(string(for: key), chipModel: chipModel)
     }
 
-    static func isGPUKey(_ key: UInt32) -> Bool {
-        isGPUKey(string(for: key))
+    static func isGPUKey(_ key: UInt32, chipModel: String?) -> Bool {
+        isGPUKey(string(for: key), chipModel: chipModel)
     }
 
     private static func fourCharacterCode(_ value: String) -> UInt32 {
         value.utf8.reduce(UInt32(0)) { ($0 << 8) | UInt32($1) }
     }
 
+    private static func isM3(_ chipModel: String?) -> Bool {
+        chipModel?.range(of: #"\bM3(?:\s|$)"#, options: .regularExpression) != nil
+    }
+
     private static func string(for value: UInt32) -> String {
         String(decoding: [
             UInt8((value >> 24) & 0xFF), UInt8((value >> 16) & 0xFF),
@@ -268,7 +278,7 @@ private struct PrivateAppleSiliconMetricsReader {
             guard let key = key(at: index) else { continue }
             let name = Self.string(for: key)
             let isCPU = SMCTemperatureCodec.isCPUKey(name, chipModel: chipModel)
-            let isGPU = SMCTemperatureCodec.isGPUKey(name)
+            let isGPU = SMCTemperatureCodec.isGPUKey(name, chipModel: chipModel)
             guard isCPU || isGPU, let keyInfo = readKeyInfo(key: key) else { continue }
 
             let sensor = TemperatureSensor(
```

**File**: `OnlySwitchTests/SystemMonitor/MacSystemMonitorCollectorTests.swift` (modified, +9/-5)
```diff
@@ -62,16 +62,20 @@ struct MacSystemMonitorCollectorTests {
     func sensorKeySelectionKeepsCPUAndGPUClassesSeparate() {
         let cpuPerformance = fourCharacterCode("Tp0P")
         let cpuEfficiency = fourCharacterCode("Te0P")
-        let cpuFrequency = fourCharacterCode("Tf0P")
+        let m3CPU = fourCharacterCode("Tf04")
+        let m3GPU = fourCharacterCode("Tf14")
         let gpu = fourCharacterCode("Tg0P")
 
         #expect(SMCTemperatureCodec.isCPUKey(cpuPerformance, chipModel: "Apple M4 Max"))
         #expect(SMCTemperatureCodec.isCPUKey(cpuEfficiency, chipModel: "Apple M4 Max"))
-        #expect(SMCTemperatureCodec.isCPUKey(cpuFrequency, chipModel: "Apple M3 Max"))
-        #expect(SMCTemperatureCodec.isCPUKey(cpuFrequency, chipModel: "Apple M4 Max") == false)
+        #expect(SMCTemperatureCodec.isCPUKey(m3CPU, chipModel: "Apple M3 Max"))
+        #expect(SMCTemperatureCodec.isCPUKey(m3GPU, chipModel: "Apple M3 Max") == false)
+        #expect(SMCTemperatureCodec.isCPUKey(m3CPU, chipModel: "Apple M4 Max") == false)
         #expect(SMCTemperatureCodec.isCPUKey(gpu, chipModel: "Apple M4 Max") == false)
-        #expect(SMCTemperatureCodec.isGPUKey(gpu))
-        #expect(SMCTemperatureCodec.isGPUKey(cpuPerformance) == false)
+        #expect(SMCTemperatureCodec.isGPUKey(m3GPU, chipModel: "Apple M3 Max"))
+        #expect(SMCTemperatureCodec.isGPUKey(m3CPU, chipModel: "Apple M3 Max") == false)
+        #expect(SMCTemperatureCodec.isGPUKey(gpu, chipModel: "Apple M4 Max"))
+        #expect(SMCTemperatureCodec.isGPUKey(cpuPerformance, chipModel: "Apple M4 Max") == false)
     }
 
     @Test
```

---

### Incident Patch 5: `a34136e6` (2026-09-24)
**Commit Message**: Fix Apple Silicon temperatures and dark monitor contrast

**File**: `OnlySwitch/Features/SystemMonitor/MacSystemMonitorCollector.swift` (modified, +181/-45)
```diff
@@ -59,36 +59,118 @@ enum MemoryPressureSampler {
     }
 }
 
-/// Reads Apple Silicon GPU counters exposed through undocumented IOKit services.
+/// Decodes the SMC temperature payload formats used by Apple Silicon Macs.
+///
+/// Keeping byte decoding and key classification separate from the private IOKit transport makes
+/// the most failure-prone part of the integration deterministic and testable.
+enum SMCTemperatureCodec {
+    private static let sp78 = fourCharacterCode("sp78")
+    private static let floatingPoint = fourCharacterCode("flt ")
+
+    static func decode(dataType: UInt32, bytes: [UInt8]) -> Double? {
+        switch dataType {
+        case sp78:
+            guard bytes.count >= 2 else { return nil }
+            let raw = Int16(bitPattern: (UInt16(bytes[0]) << 8) | UInt16(bytes[1]))
+            return Double(raw) / 256
+        case floatingPoint:
+            guard bytes.count >= 4 else { return nil }
+            let bitPattern = UInt32(bytes[0])
+                | (UInt32(bytes[1]) << 8)
+                | (UInt32(bytes[2]) << 16)
+                | (UInt32(bytes[3]) << 24)
+            let value = Double(Float(bitPattern: bitPattern))
+            return value.isFinite ? value : nil
+        default:
+            return nil
+        }
+    }
+
+    static func isPlausible(_ celsius: Double) -> Bool {
+        celsius.isFinite && (10 ..< 125).contains(celsius)
+    }
+
+    static func isCPUKey(_ key: String, chipModel: String?) -> Bool {
+        if key.hasPrefix("Tp") || key.hasPrefix("Te") { return true }
+        guard key.hasPrefix("Tf"), let chipModel else { return false }
+        return chipModel.range(of: #"\bM3(?:\s|$)"#, options: .regularExpression) != nil
+    }
+
+    static func isGPUKey(_ key: String) -> Bool {
+        key.hasPrefix("Tg")
+    }
+
+    static func isCPUKey(_ key: UInt32, chipModel: String?) -> Bool {
+        isCPUKey(string(for: key), chipModel: chipModel)
+    }
+
+    static func isGPUKey(_ key: UInt32) -> Bool {
+        isGPUKey(string(for: key))
+    }
+
+    private static func fourCharacterCode(_ value: String) -> UInt32 {
+        value.utf8.reduce(UInt32(0)) { ($0 << 8) | UInt32($1) }
+    }
+
+    private static func string(for value: UInt32) -> String {
+        String(decoding: [
+            UInt8((value >> 24) & 0xFF), UInt8((value >> 16) & 0xFF),
+            UInt8((value >> 8) & 0xFF), UInt8(value & 0xFF)
+        ], as: UTF8.self)
+    }
+}
+
+/// Reads Apple Silicon GPU counters and CPU/GPU sensors exposed through undocumented IOKit services.
 ///
 /// `AGXAccelerator`'s `PerformanceStatistics`, `gpu-core-count`, and the AppleSMC user client
 /// are implementation details rather than supported macOS APIs. They are intentionally confined
 /// to this type, only used on Apple Silicon, and treated as optional so an OS or hardware change
 /// cannot affect monitor availability or process stability. This path is unsuitable for Mac App
 /// Store distribution without separately validating Apple's current review policy.
-private struct PrivateAppleSiliconGPUReader {
+private struct PrivateAppleSiliconMetricsReader {
     struct Reading {
         let usage: Double?
-        let temperatureCelsius: Double?
+        let cpuTemperatureCelsius: Double?
+        let gpuTemperatureCelsius: Double?
+    }
+
+    private struct TemperatureSensor {
+        let key: UInt32
+        let name: String
+        let dataType: UInt32
+        let dataSize: UInt32
+    }
+
+    private struct TemperatureSensors {
+        let cpu: [TemperatureSensor]
+        let gpu: [TemperatureSensor]
     }
 
     private static let maximumSensorKeys = 4_096
     private var smcConnection: io_connect_t = IO_OBJECT_NULL
-    private var gpuTemperatureKeys: [UInt32]?
-
-    mutating func sample() -> Reading {
-        guard Self.isAppleSilicon else { return Reading(usage: nil, temperatureCelsius: nil) }
+    private var temperatureSensors: TemperatureSensors?
+
+    mutating func sampl
```

**File**: `OnlySwitch/Features/SystemMonitor/SystemMonitorPanelView.swift` (modified, +28/-6)
```diff
@@ -70,9 +70,24 @@ enum SystemMonitorMemoryPressurePresentation {
 }
 
 struct SystemMonitorSectionBar: View {
+    @Environment(\.colorScheme) private var colorScheme
     let sections: [SectionBar.Section]
     @Binding var selection: SectionBar.Section
 
+    private var selectedForeground: Color {
+        colorScheme == .dark ? .white : .primary
+    }
+
+    private var selectedFill: Color {
+        colorScheme == .dark
+            ? Color(red: 0.05, green: 0.38, blue: 0.76).opacity(0.82)
+            : Color.accentColor.opacity(0.18)
+    }
+
+    private var selectedStroke: Color {
+        colorScheme == .dark ? .white.opacity(0.34) : Color.accentColor.opacity(0.38)
+    }
+
     var body: some View {
         HStack(spacing: 4) {
             ForEach(sections, id: \.self) { section in
@@ -86,14 +101,14 @@ struct SystemMonitorSectionBar: View {
                     .contentShape(Rectangle())
                 }
                 .buttonStyle(.plain)
-                .foregroundStyle(selection == section ? .primary : .secondary)
+                .foregroundStyle(selection == section ? selectedForeground : .secondary)
                 .background {
                     Capsule()
-                        .fill(selection == section ? Color.accentColor.opacity(0.18) : .clear)
+                        .fill(selection == section ? selectedFill : .clear)
                         .overlay {
                             Capsule()
                                 .strokeBorder(
-                                    selection == section ? Color.accentColor.opacity(0.32) : .clear,
+                                    selection == section ? selectedStroke : .clear,
                                     lineWidth: 1
                                 )
                         }
@@ -133,6 +148,7 @@ struct SystemMonitorPanelContainer: View {
 }
 
 struct SystemMonitorPanelView: View {
+    @Environment(\.colorScheme) private var colorScheme
     let store: StoreOf<SystemMonitorReducer>
     @State private var preferences = Preferences.shared.systemMonitorPreferences
 
@@ -175,6 +191,12 @@ struct SystemMonitorPanelView: View {
         SystemMonitorMetric.allCases.filter(preferences.enabledPanelMetrics.contains)
     }
 
+    private var processorAccent: Color {
+        colorScheme == .dark
+            ? Color(red: 0.20, green: 0.68, blue: 1)
+            : .accentColor
+    }
+
     @ViewBuilder
     private func metricCard(
         _ metric: SystemMonitorMetric,
@@ -224,7 +246,7 @@ struct SystemMonitorPanelView: View {
         @ViewBuilder content: (Double) -> Content
     ) -> some View {
         VStack(alignment: .leading, spacing: 10) {
-            metricHeader(title, symbolName: symbolName, tint: .accentColor)
+            metricHeader(title, symbolName: symbolName, tint: processorAccent)
             processorDetails(processor, metricName: title)
             switch availability {
             case let .available(value):
@@ -250,10 +272,10 @@ struct SystemMonitorPanelView: View {
                     .foregroundStyle(.secondary)
             }
             ProgressView(value: usage)
-                .tint(.accentColor)
+                .tint(processorAccent)
             SystemMonitorChartView(
                 points: history,
-                tint: .accentColor,
+                tint: processorAccent,
                 accessibilityLabel: "Usage history".localized(),
                 valueDescription: SystemMonitorFormatter.percentage
             )
```

---

### Incident Patch 6: `775ce78f` (2026-09-24)
**Commit Message**: Fix system monitor process names

**File**: `OnlySwitch/Features/SystemMonitor/MacSystemMonitorCollector.swift` (modified, +27/-6)
```diff
@@ -682,16 +682,37 @@ private extension MacSystemMonitorCollector {
         }
 
         var nameBuffer = Array(repeating: CChar(0), count: Int(MAXCOMLEN) + 1)
-        let nameLength = proc_name(pid, &nameBuffer, UInt32(nameBuffer.count))
-        guard nameLength > 0 else { return nil }
+        let nameLength = nameBuffer.withUnsafeMutableBufferPointer { buffer in
+            guard let baseAddress = buffer.baseAddress else { return Int32(0) }
+            return proc_name(pid, baseAddress, UInt32(buffer.count))
+        }
 
-        return ProcessCounters(
-            cpuNanoseconds: values.cpuNanoseconds,
-            residentBytes: values.residentBytes,
-            name: String(
+        let name: String
+        if nameLength > 0 {
+            name = String(
                 decoding: nameBuffer.prefix(Int(nameLength)).map { UInt8(bitPattern: $0) },
                 as: UTF8.self
             )
+        } else {
+            var pathBuffer = Array(repeating: CChar(0), count: Int(MAXPATHLEN) * 4)
+            let pathLength = pathBuffer.withUnsafeMutableBufferPointer { buffer in
+                guard let baseAddress = buffer.baseAddress else { return Int32(0) }
+                return proc_pidpath(pid, baseAddress, UInt32(buffer.count))
+            }
+            if pathLength > 0 {
+                let executableName = URL(fileURLWithPath: String(cString: pathBuffer)).lastPathComponent
+                name = executableName.isEmpty ? "Process \(pid)" : executableName
+            } else {
+                // Keep otherwise valid resource counters visible even when macOS withholds the
+                // process name and path for a protected process.
+                name = "Process \(pid)"
+            }
+        }
+
+        return ProcessCounters(
+            cpuNanoseconds: values.cpuNanoseconds,
+            residentBytes: values.residentBytes,
+            name: name
         )
     }
 }
```

---

### Incident Patch 7: `430f8adc` (2026-09-24)
**Commit Message**: Fix AirPods battery header layout

**File**: `OnlySwitch/Features/OnlyControl/OnlyControlView.swift` (modified, +18/-15)
```diff
@@ -137,25 +137,28 @@ struct OnlyControlView: View {
     }
 
     private var controlHeader: some View {
-        HStack(alignment: .bottom) {
-            Text(currentDate, style: .time)
-                .font(.system(size: 60, weight: .bold, design: .rounded))
-                .foregroundStyle(colorScheme == .dark ? .white : .black)
-                .onReceive(timer) { _ in
-                    currentDate = Date()
-                }
+        VStack(alignment: .leading, spacing: 4) {
+            HStack(alignment: .bottom, spacing: 16) {
+                Text(currentDate, style: .time)
+                    .font(.system(size: 60, weight: .bold, design: .rounded))
+                    .foregroundStyle(colorScheme == .dark ? .white : .black)
+                    .layoutPriority(1)
+                    .onReceive(timer) { _ in
+                        currentDate = Date()
+                    }
 
-            if store.isAirPodsConnected && !store.airPodsBatteryValues.isEmpty {
-                AirPodsBatteryView(batteryValues: store.airPodsBatteryValues)
+                Spacer(minLength: 16)
+
+                TimerCountDownView(ptswitch: PomodoroTimerSwitch.shared, showImage: true)
+                    .font(.system(size: 20, weight: .bold, design: .rounded))
                     .padding(.bottom, 8)
-                    .padding(.leading, 24)
             }
 
-            Spacer(minLength: 16)
-
-            TimerCountDownView(ptswitch: PomodoroTimerSwitch.shared, showImage: true)
-                .font(.system(size: 20, weight: .bold, design: .rounded))
-                .padding(.bottom, 8)
+            if store.isAirPodsConnected && !store.airPodsBatteryValues.isEmpty {
+                AirPodsBatteryView(batteryValues: store.airPodsBatteryValues)
+                    .fixedSize(horizontal: true, vertical: false)
+                    .accessibilityLabel("AirPods battery levels".localized())
+            }
         }
         .frame(maxWidth: .infinity, alignment: .leading)
     }
```

**File**: `OnlySwitch/Features/SwitchItem/SwitchBar/AirPodsBatteryView.swift` (modified, +8/-9)
```diff
@@ -30,31 +30,30 @@ struct AirPodsBatteryView: View {
         HStack(spacing: 8) {
             ForEach(batteryValues.indices, id:\.self) { index in
                 HStack(spacing: 4) {
-                    ZStack{
+                    ZStack {
                         Circle()
-                            .foregroundColor(.gray)
+                            .foregroundStyle(.gray)
                             .frame(width: 10, height: 10)
                         Text(batteryText[index])
                             .font(.system(size:7))
-                            .foregroundColor(.white)
+                            .foregroundStyle(.white)
                     }
                     
                     HStack {
                         Rectangle()
-                            .foregroundColor(batteryColor(for: batteryValues[index]))
+                            .foregroundStyle(batteryColor(for: batteryValues[index]))
                             .frame(width: CGFloat(batteryValues[index]) * viewWidth, height: viewHeight)
                         Spacer()
                             .frame(width: ((1.0 - CGFloat(batteryValues[index])) * viewWidth))
                     }
                     .frame(width: viewWidth, height: viewHeight)
-                  .overlay(RoundedRectangle(cornerRadius: 2).stroke(colorScheme == .dark ? .white : .black, lineWidth: 1))
-                  .overlay(Text("\(Int(batteryValues[index] * 100))%")
-                            .font(.system(size:6)).fontWeight(.medium))
+                    .overlay(RoundedRectangle(cornerRadius: 2).stroke(colorScheme == .dark ? .white : .black, lineWidth: 1))
+                    .overlay(Text("\(Int(batteryValues[index] * 100))%")
+                        .font(.system(size: 6).weight(.medium)))
                 }
-                
             }
         }
-        .frame(width: viewWidth)
+        .fixedSize(horizontal: true, vertical: false)
     }
 }
 
```

---

### Incident Patch 8: `76d6402b` (2026-09-24)
**Commit Message**: fix list height

**File**: `OnlySwitch/Features/OnlySwitchList/OnlySwitchListView.swift` (modified, +1/-1)
```diff
@@ -114,7 +114,7 @@ struct OnlySwitchListView: View {
         .onChange(of: sections) { _ in
             reconcileSectionSelection()
         }
-        .frame(width: listWidth , height: scrollViewHeight + (switchVM.showAds ? 172 : 132))
+        .frame(width: listWidth , height: scrollViewHeight + (switchVM.showAds ? 184 : 144))
     }
     
     var singleSwitchList: some View {
```

---

### Incident Patch 9: `e8e4e7f6` (2026-09-24)
**Commit Message**: fix: coordinate system monitor background sampling

**File**: `Modules/Sources/SystemMonitor/SystemMonitorReducer.swift` (modified, +1/-10)
```diff
@@ -5,7 +5,6 @@ public struct SystemMonitorReducer {
     @ObservableState
     public struct State: Equatable {
         public var isVisible = false
-        public var enabledMenuBarMetrics: Set<SystemMonitorMetric> = []
         public var expandedMetrics: Set<SystemMonitorMetric> = []
         public var snapshot: SystemMonitorSnapshot?
         public var history = SystemMonitorHistory()
@@ -14,15 +13,13 @@ public struct SystemMonitorReducer {
 
         public init(
             isVisible: Bool = false,
-            enabledMenuBarMetrics: Set<SystemMonitorMetric> = [],
             expandedMetrics: Set<SystemMonitorMetric> = [],
             snapshot: SystemMonitorSnapshot? = nil,
             history: SystemMonitorHistory = SystemMonitorHistory(),
             lastFailure: String? = nil,
             isSampling: Bool = false
         ) {
             self.isVisible = isVisible
-            self.enabledMenuBarMetrics = enabledMenuBarMetrics
             self.expandedMetrics = expandedMetrics
             self.snapshot = snapshot
             self.history = history
@@ -31,13 +28,12 @@ public struct SystemMonitorReducer {
         }
 
         var requiresSampling: Bool {
-            isVisible || enabledMenuBarMetrics.isEmpty == false
+            isVisible
         }
     }
 
     public enum Action: Equatable {
         case visibilityChanged(Bool)
-        case menuBarMetricsChanged(Set<SystemMonitorMetric>)
         case toggleExpandedMetric(SystemMonitorMetric)
         case snapshotReceived(SystemMonitorSnapshot)
         case streamFailed(String)
@@ -58,11 +54,6 @@ public struct SystemMonitorReducer {
                 state.isVisible = isVisible
                 return samplingEffect(wasSampling: wasSampling, state: &state)
 
-            case let .menuBarMetricsChanged(metrics):
-                let wasSampling = state.requiresSampling
-                state.enabledMenuBarMetrics = metrics
-                return samplingEffect(wasSampling: wasSampling, state: &state)
-
             case let .toggleExpandedMetric(metric):
                 guard metric.supportsDisclosure else { return .none }
 
```

**File**: `OnlySwitch/Features/SystemMonitor/SystemMonitorPanelView.swift` (modified, +0/-2)
```diff
@@ -140,7 +140,6 @@ struct SystemMonitorPanelView: View {
         }
         .padding(15)
         .onAppear {
-            store.send(.menuBarMetricsChanged(preferences.menuBarMetrics))
             store.send(.visibilityChanged(true))
         }
         .onDisappear {
@@ -149,7 +148,6 @@ struct SystemMonitorPanelView: View {
         .onReceive(NotificationCenter.default.publisher(for: .systemMonitorPreferencesChanged)) { notification in
             guard let updated = notification.object as? SystemMonitorPreferences else { return }
             preferences = updated
-            store.send(.menuBarMetricsChanged(updated.menuBarMetrics))
         }
     }
 
```

**File**: `OnlySwitch/Features/SystemMonitor/SystemMonitorStatusItemController.swift` (modified, +40/-15)
```diff
@@ -22,42 +22,52 @@ protocol SystemMonitorStatusItemFactory: AnyObject {
 @MainActor
 final class SystemMonitorStatusItemController {
     private let factory: any SystemMonitorStatusItemFactory
-    private let client: SystemMonitorClient
+    private let clientFactory: @Sendable (TimeInterval) -> SystemMonitorClient
     private let onClick: @MainActor () -> Void
     private var items: [SystemMonitorMetric: any SystemMonitorStatusItemHandle] = [:]
+    private var enabledMetrics: Set<SystemMonitorMetric> = []
+    private var refreshInterval: TimeInterval?
     private var latestSnapshot: SystemMonitorSnapshot?
     private var samplingTask: Task<Void, Never>?
     private var samplingGeneration = 0
 
     init(
         factory: any SystemMonitorStatusItemFactory = AppKitSystemMonitorStatusItemFactory(),
-        client: SystemMonitorClient = MacSystemMonitorCollector.liveClient(),
+        clientFactory: @escaping @Sendable (TimeInterval) -> SystemMonitorClient = {
+            MacSystemMonitorCollector.liveClient(refreshInterval: $0)
+        },
         onClick: @escaping @MainActor () -> Void = {}
     ) {
         self.factory = factory
-        self.client = client
+        self.clientFactory = clientFactory
         self.onClick = onClick
     }
 
+    convenience init(
+        factory: any SystemMonitorStatusItemFactory,
+        client: SystemMonitorClient,
+        onClick: @escaping @MainActor () -> Void = {}
+    ) {
+        self.init(factory: factory, clientFactory: { _ in client }, onClick: onClick)
+    }
+
     func apply(_ preferences: SystemMonitorPreferences) {
         let selectedMetrics = preferences.menuBarMetrics
+        let metricsChanged = selectedMetrics != enabledMetrics
+        let intervalChanged = refreshInterval != preferences.refreshInterval
+        enabledMetrics = selectedMetrics
+        refreshInterval = preferences.refreshInterval
 
-        for metric in SystemMonitorMetric.allCases where !selectedMetrics.contains(metric) {
-            guard let item = items.removeValue(forKey: metric) else { continue }
-            item.remove()
-        }
-
-        for metric in SystemMonitorMetric.allCases where selectedMetrics.contains(metric) {
-            guard items[metric] == nil else { continue }
-            let item = factory.makeStatusItem(for: metric)
-            item.setAction(onClick)
-            item.update(Self.presentation(for: metric, snapshot: latestSnapshot))
-            items[metric] = item
+        if metricsChanged {
+            rebuildItems(for: selectedMetrics)
         }
 
         if items.isEmpty {
             stopSampling()
         } else {
+            if intervalChanged {
+                stopSampling()
+            }
             startSamplingIfNeeded()
         }
     }
@@ -78,11 +88,26 @@ final class SystemMonitorStatusItemController {
 }
 
 private extension SystemMonitorStatusItemController {
+    func rebuildItems(for selectedMetrics: Set<SystemMonitorMetric>) {
+        for item in items.values {
+            item.remove()
+        }
+        items.removeAll(keepingCapacity: true)
+
+        for metric in SystemMonitorMetric.allCases where selectedMetrics.contains(metric) {
+            let item = factory.makeStatusItem(for: metric)
+            item.setAction(onClick)
+            item.update(Self.presentation(for: metric, snapshot: latestSnapshot))
+            items[metric] = item
+        }
+    }
+
     func startSamplingIfNeeded() {
         guard samplingTask == nil else { return }
+        guard let refreshInterval else { return }
         samplingGeneration += 1
         let generation = samplingGeneration
-        let client = client
+        let client = clientFactory(refreshInterval)
 
         samplingTask = Task { @MainActor [weak self] in
             do {
```

**File**: `OnlySwitch/StatusBar/StatusBarController.swift` (modified, +0/-3)
```diff
@@ -93,9 +93,6 @@ class StatusBarController {
 
         let monitorPreferences = Preferences.shared.systemMonitorPreferences
         systemMonitorStatusItems = SystemMonitorStatusItemController(
-            client: MacSystemMonitorCollector.liveClient(
-                refreshInterval: monitorPreferences.refreshInterval
-            ),
             onClick: { [weak self] in
                 self?.togglePopover(sender: nil)
             }
```

**File**: `OnlySwitchTests/SystemMonitor/SystemMonitorStatusItemControllerTests.swift` (modified, +96/-8)
```diff
@@ -21,21 +21,29 @@ struct SystemMonitorStatusItemControllerTests {
     }
 
     @Test
-    func applyingNewPreferencesRemovesDeselectedItemsAndKeepsExistingItems() {
-        let factory = RecordingSystemMonitorStatusItemFactory()
+    func incrementalPreferenceChangesRebuildTheSameCanonicalOrderAsColdLaunch() {
+        let incrementalFactory = RecordingSystemMonitorStatusItemFactory()
         let controller = SystemMonitorStatusItemController(
-            factory: factory,
+            factory: incrementalFactory,
             client: .finished
         )
         controller.apply(.init(menuBarMetrics: [.cpu, .network]))
-        let originalNetworkItem = factory.items[.network]
+        let originalCPUItem = incrementalFactory.items[.cpu]
+        let originalNetworkItem = incrementalFactory.items[.network]
 
         controller.apply(.init(menuBarMetrics: [.memory, .network]))
 
-        #expect(factory.createdMetrics == [.cpu, .network, .memory])
-        #expect(factory.items[.cpu]?.removeCount == 1)
-        #expect(factory.items[.network] === originalNetworkItem)
-        #expect(factory.items[.network]?.removeCount == 0)
+        let coldFactory = RecordingSystemMonitorStatusItemFactory()
+        let coldController = SystemMonitorStatusItemController(
+            factory: coldFactory,
+            client: .finished
+        )
+        coldController.apply(.init(menuBarMetrics: [.memory, .network]))
+
+        #expect(originalCPUItem?.removeCount == 1)
+        #expect(originalNetworkItem?.removeCount == 1)
+        #expect(Array(incrementalFactory.createdMetrics.suffix(2)) == coldFactory.createdMetrics)
+        #expect(coldFactory.createdMetrics == [.memory, .network])
     }
 
     @Test
@@ -100,6 +108,51 @@ struct SystemMonitorStatusItemControllerTests {
         #expect(factory.items[.cpu]?.removeCount == 1)
         #expect(factory.items[.disk]?.removeCount == 1)
     }
+
+    @Test
+    func metricChangesKeepOneUpstreamAndDisablingTheLastItemCancelsIt() async {
+        let factory = RecordingSystemMonitorStatusItemFactory()
+        let clients = RecordingMonitorClientFactory()
+        let controller = SystemMonitorStatusItemController(
+            factory: factory,
+            clientFactory: clients.makeClient(refreshInterval:)
+        )
+
+        controller.apply(.init(menuBarMetrics: [.cpu]))
+        await Task.yield()
+        controller.apply(.init(menuBarMetrics: [.cpu, .network]))
+        await Task.yield()
+
+        #expect(clients.streamStartCount == 1)
+
+        controller.apply(.init(menuBarMetrics: []))
+        for _ in 0..<10 where clients.terminationCount == 0 {
+            await Task.yield()
+        }
+
+        #expect(clients.terminationCount == 1)
+    }
+
+    @Test
+    func changingRefreshIntervalRestartsTheUpstreamWithTheNewInterval() async {
+        let factory = RecordingSystemMonitorStatusItemFactory()
+        let clients = RecordingMonitorClientFactory()
+        let controller = SystemMonitorStatusItemController(
+            factory: factory,
+            clientFactory: clients.makeClient(refreshInterval:)
+        )
+
+        controller.apply(.init(menuBarMetrics: [.cpu], refreshInterval: 1))
+        await Task.yield()
+        controller.apply(.init(menuBarMetrics: [.cpu], refreshInterval: 2))
+        for _ in 0..<10 where clients.streamStartCount < 2 {
+            await Task.yield()
+        }
+
+        #expect(clients.requestedIntervals == [1, 2])
+        #expect(clients.streamStartCount == 2)
+        #expect(clients.terminationCount == 1)
+    }
 }
 
 @MainActor
@@ -145,3 +198,38 @@ private extension SystemMonitorClient {
         }
     }
 }
+
+private final class RecordingMonitorClientFactory: @unchecked Sendable {
+    private let lock = NSLock()
+    private var intervals: [TimeInterval] = []
+    private var starts = 0
+    private var terminations = 0
+
+    var requestedIntervals: [TimeInterval] {
+        lock.withLock { intervals }
+    }
+
+ 
```

---

### Incident Patch 10: `0fc146a7` (2026-09-24)
**Commit Message**: Fix Only Control tab indicator layering

**File**: `OnlySwitch/Features/OnlyControl/OnlyControlView.swift` (modified, +22/-10)
```diff
@@ -191,6 +191,10 @@ private struct OnlyControlSectionBar: View {
             sectionButton(.controls, title: "Controls".localized(), icon: "switch.2")
             sectionButton(.systemMonitor, title: "System Monitor".localized(), icon: "waveform.path.ecg")
         }
+        // The indicator is a single matched view that moves between the buttons.
+        // Keeping this animation here also makes a programmatic section change
+        // animate the same way as a click.
+        .animation(reduceMotion ? nil : .smooth(duration: 0.32), value: selection)
     }
 
     private func sectionButton(
@@ -199,25 +203,32 @@ private struct OnlyControlSectionBar: View {
         icon: String
     ) -> some View {
         Button {
-            let animation: Animation? = reduceMotion ? nil : .smooth(duration: 0.24)
+            let animation: Animation? = reduceMotion ? nil : .smooth(duration: 0.32)
             withAnimation(animation) {
                 selection = section
             }
         } label: {
-            Label(title, systemImage: icon)
-                .font(.caption2.weight(.medium))
+            ZStack {
+                if selection == section {
+                    selectionIndicator
+                        .allowsHitTesting(false)
+                        .accessibilityHidden(true)
+                        .zIndex(0)
+                }
+
+                Label(title, systemImage: icon)
+                    .font(.caption2.weight(.medium))
+                    .foregroundStyle(selection == section ? Color.accentColor : .secondary)
+                    // The glass indicator is intentionally below this label.
+                    // Without an explicit stacking order, the macOS 26 glass
+                    // compositor may render it over the selected tab content.
+                    .zIndex(1)
+            }
                 .frame(maxWidth: .infinity)
                 .frame(minHeight: 20)
                 .contentShape(Capsule())
         }
         .buttonStyle(.plain)
-        .foregroundStyle(selection == section ? Color.accentColor : .secondary)
-        .background {
-            if selection == section {
-                selectionIndicator
-                    .allowsHitTesting(false)
-            }
-        }
         .accessibilityAddTraits(selection == section ? .isSelected : [])
         .accessibilityHint("Shows the \(title) section".localized())
         .help(Text(title))
@@ -230,6 +241,7 @@ private struct OnlyControlSectionBar: View {
                 .fill(.clear)
                 .glassEffect(.regular.tint(Color.accentColor.opacity(0.16)), in: Capsule())
                 .glassEffectID("only-control-selected-section", in: selectionGlassNamespace)
+                .matchedGeometryEffect(id: "only-control-selected-section-frame", in: selectionGlassNamespace)
         } else {
             Capsule()
                 .fill(.thinMaterial)
```

#### Recent Merged Pull Requests:
- **PR #221** (2026-09-24): Add settings export/import (Backup section) (@oecer)
- **PR #219** (2026-09-19): Revise OnlyRemote section in README.md (@jacklandrin)
- **PR #217** (2026-09-15): docs: explain how to restore the OnlySwitch menu bar icon (@mvanhorn)
- **PR #215** (2026-08-11): Fix Show List shortcut being treated as a right-click (@EhsanAzish80)
- **PR #213** (2026-08-10): feat: add a per-app sound mixer switch (@lou1s19)
- **PR #211** (2026-07-13): Add Desktop Pet feature information to README (@jacklandrin)
- **PR #209** (2026-07-12): docs: add TakoAPI directory badge (@oratis)
- **PR #207** (2026-07-12): feat: sync external monitor brightness via DDC/CI (F1/F2 follows on all displays) (@lou1s19)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

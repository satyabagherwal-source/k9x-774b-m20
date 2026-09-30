# Forensic Learning Record (Deep Inspection): nsh07/Tomato

> **Canonical Artifact**: `07_PROJECT_LEARNING/nsh07-tomato-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/nsh07/Tomato](https://github.com/nsh07/Tomato))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T23:40:17.643Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `nsh07/Tomato`
- **Description**: Minimalist, data-oriented pomodoro timer for Android and Desktop based on Material 3 Expressive
- **Primary Language / Ecosystem**: Kotlin
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 1478 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `linux/generate-metadata.py`
```
#!/usr/bin/env python3
#
# Copyright (c) 2026 Nishant Mishra
#
# This file is part of Tomato - a minimalist pomodoro timer for Android.
#
# Tomato is free software: you can redistribute it and/or modify it under the terms of the GNU
# General Public License as published by the Free Software Foundation, either version 3 of the
# License, or (at your option) any later version.
#
# Tomato is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even
# the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General
# Public License for more details.
#
# You should have received a copy of the GNU General Public License along with Tomato.
# If not, see <https://www.gnu.org/licenses/>.
#
"""Generate the Linux packaging metadata from the fastlane metadata.

``fastlane/metadata/android`` is the single source of truth for the store
listing: app name, short description, full description (all translated by
Weblate) and the per-release changelogs. This script renders it into the two
files Linux packaging consumes, and is run by both the Flatpak manifest and
snapcraft.yaml during the build:

  <output-dir>/metainfo/org.nsh07.pomodoro.metainfo.xml   (AppStream)
  <output-dir>/applications/org.nsh07.pomodoro.desktop    (desktop entry)

Usage:
    python3 linux/generate-metadata.py --output-dir /app/share
"""

import argparse
import datetime
import html
import os
import re
import sys
from html.parser import HTMLParser

APP_ID = "org.nsh07.pomodoro"

# fastlane locale used as the untranslated (C locale) source text.
SOURCE_LOCALE = "en-US"

# AppStream only accepts absolute URLs for screenshots.
SCREENSHOT_BASE_URL = (
    "https://raw.githubusercontent.com/nsh07/Tomato/main"
    "/fastlane/metadata/android/{locale}/images/phoneScreenshots/{name}"
)

# Android locale codes that differ from the POSIX ones.
LEGACY_LANGUAGE_CODES = {"iw": "he", "in": "id", "ji": "yi"}

# Locales whose region must be kept because the regional variant differs.
KEEP_REGION = {"pt-BR"}

# "- item", "* item", and the stray "…- item" a few translations use.
BULLET_RE = re.compile(r"^[\s…·•]*[-*–]\s+")

# AppStream only understands <em> and <code>, so <b> and <i> collapse onto <em>.
INLINE_TAG_RE = re.compile(r"<(/?)(b|i|em|strong)\s*>", re.IGNORECASE)
BR_RE = re.compile(r"<br\s*/?>", re.IGNORECASE)
BLOCK_MARKUP_RE = re.compile(r"</?(p|ul|ol|li)\b", re.IGNORECASE)
EM_TAG_RE = re.compile(r"</?em>")

# Locales whose markup had to be repaired, reported once at the end.
_unbalanced_markup = set()
_current_locale = None


# --------------------------------------------------------------------------
# Inline text -> AppStream inline markup
# --------------------------------------------------------------------------

def balance_emphasis(text):
    """Drop unmatched </em> and close dangling <em>.

    A single malformed tag in a translation would otherwise make the whole
    AppStream file unparseable.
    """
    parts = []
    depth = 0
    position = 0
    repaired = False
    for match in EM_TAG_RE.finditer(text):
        parts.append(text[position:match.start()])
        if match.group(0) == "<em>":
            depth += 1
            parts.append("<em>")
        elif depth:
            depth -= 1
            parts.append("</em>")
        else:
            repaired = True
        position = match.end()
    parts.append(text[position:])

    result = "".join(parts)
    if depth:
        result += "</em>" * depth
        repaired = True
    if repaired and _current_locale:
        _unbalanced_markup.add(_current_locale)
    return result


def render_inline(text):
    """Escape ``text`` for XML, keeping <b>/<i>/<em>/<strong> as <em>."""
    text = html.unescape(text)
    text = BR_RE.sub(" ", text)
    text = INLINE_TAG_RE.sub(
        lambda m: "\x00/em\x01" if m.group(1) else "\x00em\x01", text
    )
    text = re.sub(r"<[^>]*>", "", text)  # drop any other stray markup
    text = html.escape(text, quote=False)
    text = text.replace("\x00", "<").replace("\x01", ">")
    return balance_emphasis(re.sub(r"\s+", " ", text).strip())


# --------------------------------------------------------------------------
# Description / changelog text -> AppStream description blocks
# --------------------------------------------------------------------------
#
# A block is either ("p", "<text>") or ("ul", ["<item>", ...]).

class _HtmlDescriptionParser(HTMLParser):
    """Parses the handful of translations that are written as HTML."""

    def __init__(self):
        HTMLParser.__init__(self, convert_charrefs=True)
        self.blocks = []
        self._buf = []
        self._items = None
        self._depth = 0

    def _take(self):
        text = re.sub(r"\s+", " ", "".join(self._buf)).strip()
        self._buf = []
        return balance_emphasis(text)

    def _flush_paragraph(self):
        text = self._take()
        if text:
            self.blocks.append(("p", text))

    def _flush_item(self):
        text = self._take()
        if text and self._items is not None:
            self._items.append(text)

    def handle_starttag(self, tag, attrs):
        tag = tag.lower()
        if tag == "p":
            self._flush_paragraph()
        elif tag in ("ul", "ol"):
            if self._depth == 0:
                self._flush_paragraph()
                self._items = []
            else:
                # AppStream has no nested lists, so flatten into the same list.
                self._flush_item()
            self._depth += 1
        elif tag == "li":
            self._flush_item()
        elif tag in ("b", "i", "em", "strong"):
            self._buf.append("<em>")
        elif tag == "br":
            self._buf.append(" ")

    def handle_startendtag(self, tag, attrs):
        if tag.lower() == "br":
            self._buf.append(" ")

    def handle_endtag(self, tag):
        tag = tag.lower()
        if tag == "p":
            self._flush_paragraph()
        elif tag in ("ul", "ol"):
            self._flush_item()
            self._depth -= 1
            if self._depth == 0:
                if self._items:
                    self.blocks.append(("ul", self._items))
                self._items = None
        elif tag == "li":
            self._flush_item()
        elif tag in ("b", "i", "em", "strong"):
            self._buf.append("</em>")

    def handle_data(self, data):
        self._buf.append(html.escape(data, quote=False))

    def close(self):
        HTMLParser.close(self)
        if self._items is not None:
            self._flush_item()
            if self._items:
                self.blocks.append(("ul", self._items))
            self._items = None
        self._flush_paragraph()
        return self.blocks


def _parse_plain(text):
    blocks = []
    paragraph = []
    items = None

    def flush_paragraph():
        if paragraph:
            blocks.append(("p", " ".join(paragraph)))
            del paragraph[:]

    def flush_items():
        if items:
            blocks.append(("ul", list(items)))
            del items[:]

    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line:
            flush_paragraph()
            flush_items()
            continue

        match = BULLET_RE.match(line)
        if match:
            flush_paragraph()
            if items is None:
                items = []
            rendered = render_inline(line[match.end():])
            if rendered:
                items.append(rendered)
        else:
            flush_items()
            rendered = render_inline(line)
            if rendered:
                paragraph.append(rendered)

    flush_paragraph()
    flush_items()
    return blocks


def set_source(name):
    """Name the file currently being converted, for markup warnings."""
    global _current_locale
    _current_locale = name


def parse_description(text):
    """Convert a fastlane description or changelog into AppStream blocks."""
    if BLOCK_MARKUP_
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #314** (2026-09-19): **[BUG] App crashed after click reset timer and Next Session buttons**
  *Symptoms*: **Describe the bug** When the timer starts and I need to press the reset timer button and the next session button Application crashed.   **To Reproduce** Steps to reproduce the behavior:  1. Go to timer and start 2. Click on reset timer or next session 3. See error (app crashed)   **Expected behavior** They should work normally  **Screenshots** https://github.com/user-attachments/assets/9ded3a35-8843-4557-ad15-9ed8ccb9e5ce    **Device (please complete the following information):**  - Device model: [HUAWEI Y6s] - Android version: [Android 9] - App version: [v2.0.0] - Installed from: [Github releases]  **Additional context** I tracked the App to catch logs and Got this  ``` SDK: 28 PRODUCT_NAME: JAT-L29HW DEVICE_NAME: HWJAT-M BOARD_NAME: JAT-L29HW SUPPORTED_ABIS: armeabi-v7a, armeabi MANUFACTURER: HUAWEI BRAND: HUAWEI MODEL: JAT-L29  APP_NAME: Tomato PACKAGE: org.nsh07.pomodoro VERSION_NAME: 2.0.0 VERSION_CODE: 39  1789824377.447 11377 10102 10131 E AndroidRuntime: FATAL EXCEPTION: DefaultDispatcher-worker-8 1789824377.447 11377 10102 10131 E AndroidRuntime: Process: org.nsh07.pomodoro, PID: 10102 1789824377.447 11377 10102 10131 E AndroidRuntime: android.database.sqlite.SQLiteException: near "ON": syntax error (Sqlite code 1 SQLITE_ERROR): , while compiling: INSERT INTO stat (date, topicId, focusTimeQ1, focusTimeQ2, focusTimeQ3, focusTimeQ4, breakTime) 1789824377.447 11377 10102 10131 E AndroidRuntime:         VALUES (?, ?, ?, ?, ?, ?, ?) 1789824377.447 11377 10102 10131 E And
  **Post-Mortem & Fix Analysis**:
  > Can you please upload a video showing how to reproduce this? I cannot seem to be able to reproduce this bug. Thanks!
  > Ok this bug only happens on Android 10 or lower that does not support this newer database syntax. I will fix this and create a new release.
  > > Ok this bug only happens on Android 10 or lower that does not support this newer database syntax. I will fix this and create a new release.  Ok bro Thank you ❤️ 

- **Issue #299** (2026-08-20): **[BUG] Infinity Focus: Extremely long break time**
  *Symptoms*: **Describe the bug** Break duration is recorded as a huge number such as 2562047788015h 12m. Seems to only happen on days that I use infinity focus. Focus-break ratio is shown as 100% break.  **To Reproduce** Steps to reproduce the behavior:  1. Enable infinity Focus 2. Study and take breaks (maybe resetting, skipping, or multiple cycles are required)  **Expected behavior** Break time is recorded correctly  **Screenshots** If applicable, add screenshots to help explain your problem.  <img width="191" alt="Image" src="https://github.com/user-attachments/assets/9efa2d4b-7b60-4c41-9121-83ba885f8d13" /> <img width="191" alt="Image" src="https://github.com/user-attachments/assets/f6c895ff-b796-49b4-966c-96cad02de657" /> <img width="191" alt="Image" src="https://github.com/user-attachments/assets/d7863cbe-100f-40cc-b0a6-1d5c73e84123" />  **Device (please complete the following information):**  - Device model: Fairphone 4 - Android version: Android 15 (latest) - App version: v1.8.5 (latest) - Installed from: F-Droid  **Additional context** A database export is [here](https://drive.google.com/file/d/1XAtkvZ0N9WZ72IuKwCsH-nm-WwGYC9ZR/view?usp=sharing). Screenshots are from 2026-08-12. 
  **Post-Mortem & Fix Analysis**:
  > Thanks for reporting this! This bug is now fixed in [v2.0.0-alpha02](https://github.com/nsh07/Tomato/releases/tag/v2.0.0-alpha02) .
  > Also, I can fix your broken stats if you want. Create a new backup from Tomato > Settings > Backup and Restore > Backup, and upload the file here. I'll remove the huge break, then upload the fixed backup file here which you can restore.
  > sure, thank you :) maybe you could have the app do this automatically by running some code when it's opened - just an idea.  Github doesnt allow me to upload the file here, so here's a link to gdrive: https://drive.google.com/file/d/1KlJSEiKjjUMBzgH0Xzs_2u6py_YhDZ5v/view?usp=sharing

- **Issue #291** (2026-09-13): **[BUG] No vibration although enabled in settings**
  *Symptoms*: **Describe the bug** The vibration has been enabled. When one pomodoro interval ends, the alarm sound is played, but the device does not vibrate. Moreover, the vibration preview does not work in settings.  **To Reproduce** Steps to reproduce the behavior:  ***For alarm*** 1. In the settings, go to the alarm settings. 2. Enable vibration when a timer finishes. 3. Start a focus session. 4. At the end of the focus session (usually after 25 minutes), the alarm is played, but the device does not vibrate.  ***For vibration preview*** 1. In the settings, go to the alarm settings. 2. Enable vibration when a timer finishes. 3. Press the "play" button for the vibration pattern preview. The device does not vibrate.  **Expected behavior** The device should vibrate when a timer finishes or when the preview is used.  **Device:**  - Device model: OnePlus 6 - Android version: Android 16 (/e/OS 15, 4.1.1) - App version: 1.8.5 - Installed from: F-Droid  I really like this app, especially the OLED option! Keep up the good work! 
  **Post-Mortem & Fix Analysis**:
  > Hi, sorry for the extremely late reply but can you make sure haptics are enabled system-wide for you in Settings > Accessibility > Vibration and haptics (or a similar location in Settings)? Thanks!
  > No problem for the late reply! I have enabled "Vibration for media", and now vibration works! I will see whether this has any side effects e.g. for my Android user experience. If not, I will close this issue.
  > I have found no side effects from enabling "Vibration for media". Hence, I can close this issue, and thank you for helping me find the solution!  Before closing the issue, a question: Should additional information be added to the Tomato Alarm settings that "Vibration for media" has to be enabled?

- **Issue #282** (2026-09-19): **[BUG] <app running in the background problem>**
  *Symptoms*: **Describe the bug** After starting the timer when i visit another app after sometimes ( the time is not fixed eg.30min , 10 min)the timer notification gets blank or the notification disappears. When i go back to the app the timer resets (my spend time wasn't count).  ### I think it is due to the app cannot run in the background properly.   Another thing - on my device battery optimization is off, background run is on .  **To Reproduce** Steps to reproduce the behavior:  1. Sart the timer 2. Use other apps in your device  3.  Suddenly you will see the timer on the notification gets black or the notification disappears. 5. After that if you visit the app spend time wasn't count.  **Expected behavior** The timer should run properly in the background.  The notification shouldn't get blank or disappear and notification timer shouldn't stop unexpectedly. The timer should count all the spent time properly. The timer shouldn't reset unexpectedly.   **Screenshots** If [#applicable,](url) add screenshots to help explain your problem.  **Device (please complete the following information):**  - Device model: Huawei matepad 10.4 - Android version: Android 11 - App version: version 1.8.5 (android) - Installed from: github  **Additional context** The interface of the app is good . This bug is the only thing that stops me to use this app .  ### May be the bug is deu to the  ram management problem of the app . For that it cannot run in the background properly    
  **Post-Mortem & Fix Analysis**:
  > https://dontkillmyapp.com/huawei
  > > https://dontkillmyapp.com/huawei  I have followed all of that long  ago. I know this is a problem with the app . I use other same type  of apps also , they don't have that problem 
  > > > https://dontkillmyapp.com/huawei >  > I have followed all of that long ago. I know this is a problem with the app . I use other same type of apps also , they don't have that problem  Well, I have A16 and I never had this issue, so it could be a compatibility issue with older android versions

- **Issue #278** (2026-08-20): **[BUG] 175h of focus time recorded.**
  *Symptoms*: **Describe the bug** Probably after an update I found 175h of focus time recorded.  **To Reproduce** ??  **Expected behavior** No false focus time! We don't cheat 😄 . Possibly remove the wrong time recorded.  **Screenshots** <img width="591" height="1280" alt="Image" src="https://github.com/user-attachments/assets/78051df4-c8b1-4f43-af1b-a9e5f5058c98" />  **Device (please complete the following information):**  Device model: Mi 9T Pro Android version: Android 13 (LineageOS 20) App version: 1.8.5 Installed from: FDroid  **Additional context** I am not sure but it may have happened after an app update. 
  **Post-Mortem & Fix Analysis**:
  > This is hilarious but I would really like to fix it lol  Can you tell me the steps you took to make this happen? If possible.  For now, you can go into Backup and Restore in Settings, then Backup, and upload the backup file here. I will change the focus duration of that day to whatever you want in the file and I'll upload the fixed backup file so that you can restore it.
  > > This is hilarious but I would really like to fix it lol It was really hahahaha, sadly tho I have no idea on how to reproduce.  I didn't think about editing a backup, I can try that myself today and if not I will share it here. Thanks!
  > To edit the backup, you will have to use an SQLite database editor to change the row for that particular day. Look for the "stat" table.  Here's one I found that works online: https://sqlable.com/sqlite/  Just so you know what is needed to do this, because the backup is an SQLite database file which you cannot edit normally with a text editor.

- **Issue #259** (2026-04-07): **[BUG] Infinite focus mode NowBar acts like normal 25-5 min pomodoro**
  *Symptoms*: **Describe the bug** If infinite focus mode starts, NowBar acts like normal 25-5 min pomodoro in progress bar status. I dont know if its releated with NowBar or not.  **To Reproduce** Steps to reproduce the behavior:  1. Start "infinite focus" mode 2. Enable  NowBar support if not enabled 3. Wait like 5-10 min for progress bar filling some 4. Look at the progress bar 5- (optional) Wait 25+ minutes and see the progress bar fully filled  **Expected behavior** If Infinite Focus mode is enabled, there should be no progress bar in the NowBar  and no "skip" button.  **Screenshots** ![Image](https://github.com/user-attachments/assets/68a7a53b-0fe7-43b3-b44d-7e7d7cd75409) ![Image](https://github.com/user-attachments/assets/7fc1118f-5d7e-4b29-b95d-f1f7d274432f)  **Device** - Device model: Samsung A16F (SM-A165F) - Android version: Android 16 - App version: v1.8.5 (34) - Installed from: Github Releases  **Additional context** None 
  **Post-Mortem & Fix Analysis**:
  > >Expected behavior >If Infinite Focus mode is enabled, there should be no progress bar in the NowBar and no "skip" button  This cannot be achieved, because for a notification to be eligible for being a Live Update notification, the notifications style *must* be `ProgressStyle`. That is, the notification MUST have a progress bar to be considered eligible for promotion to a Live Update notification.  A progress bar in infinite focus mode doesn't make sense as you pointed out, but because I have to show one, I'm showing a dummy progress bar.  About the skip button request: keeping the skip button in the notification is useful if you ever want to start a break when running an infinite focus timer. Do note that infinite focus only changes the duration of focus timers to infinity, but the sequence of the pomodoro technique (several short breaks followed by a long break) is still followed.  I hope you understand.
  > Wouldn’t it be better to use a standard notification with a button that can’t be swiped away instead of a live notification for infinite focus mode? But I think that with the approach I’m suggesting, it would be impossible to display the focus duration in real time.
  > If I use a standard notification, it wouldn't be usable with Now Bar which is the whole point of the notification. You also wouldn't be able to see the timer at a glance because Now Bar/Live Updates don't work with inf focus anymore. I'm sure I'll start getting more bug reports saying "Now Bar doesn't work in Infinite Focus mode" if I do this. I'd love to hear your thoughts on this, and thanks for the feedback!

- **Issue #255** (2026-04-04): **[BUG] Locale Change Bug**
  *Symptoms*: **Describe the bug** When the device system language is set to English, and the user changes the app language to Indonesian via Settings: - The app UI refreshes/recomposes - **But the language does not actually change** - it still shows English text  **To Reproduce** Steps to reproduce the behavior:  1. Go to '...' 2. Click on '....' 3. Scroll down to '....' 4. See error  **Expected behavior** 1. User opens Settings → Language 2. User selects "Indonesia" 3. Bottom sheet closes 4. **App UI immediately refreshes with Indonesian text**  **Screenshots** If applicable, add screenshots to help explain your problem.  **Device (please complete the following information):**  - Device model: Realme 5 Pro - Android version: Android 15 - App version: Latest - Installed from: Github Release  **Additional context** Add any other context about the problem here. 
  **Post-Mortem & Fix Analysis**:
  > Thanks for the PR, I'll review and merge it!

- **Issue #242** (2026-03-18): **[BUG] seconds missing a digit with Eastern Arabic numerals**
  *Symptoms*: **Describe the bug**  the seconds doesn't work, only 1 digit is shown  Note: This only happens when System language is Arabic and in Tomato app language is set to System as it will be using Eastern Arabic numerals, instead of https://en.wikipedia.org/wiki/Arabic_numerals (which is the known worldwide numbering system) when setting language to specifically Arabic in-app language settings.  **To Reproduce** Steps to reproduce the behavior:  1. Go to your system setting and set language to Arabic/العربية 2. Go to Tomato app and set language to System/النظام 3. Go to timer page and press play button   **Expected behavior**  the seconds are shown full while it is counting down  **Screenshots**  <img width="369" height="783" alt="Image" src="https://github.com/user-attachments/assets/f897dd09-d87c-4799-aaae-7eb79631a63b" />  there should be a digit shown here in the highlight area, ex: ٢٥:٠٠  **Device (please complete the following information):**  - Device model: [Samsung S22] - Android version: [Android 16/oneUI 8] - App version: [1.8.4] - Installed from: [F-Droid] 
  **Post-Mortem & Fix Analysis**:
  > Fixed in c8ba02a8

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

### Incident Patch 1: `f1cfb5df` (2026-09-19)
**Commit Message**: fix(db): use compatible SQL query on older API levels

**File**: `shared/src/commonMain/kotlin/org/nsh07/pomodoro/data/StatDao.kt` (modified, +58/-0)
```diff
@@ -17,11 +17,13 @@
 
 package org.nsh07.pomodoro.data
 
+import androidx.annotation.RequiresApi
 import androidx.room.Dao
 import androidx.room.Insert
 import androidx.room.OnConflictStrategy.Companion.IGNORE
 import androidx.room.OnConflictStrategy.Companion.REPLACE
 import androidx.room.Query
+import androidx.room.Transaction
 import kotlinx.coroutines.flow.Flow
 import java.time.LocalDate
 
@@ -42,6 +44,7 @@ interface StatDao {
     /**
      * Adds the given times to the row for [date] and [topicId], creating it if it does not exist
      */
+    @RequiresApi(30)
     @Query(
         """
         INSERT INTO stat (date, topicId, focusTimeQ1, focusTimeQ2, focusTimeQ3, focusTimeQ4, breakTime)
@@ -64,6 +67,61 @@ interface StatDao {
         breakTime: Long
     )
 
+    /**
+     * Adds the given times to the row for [date] and [topicId], creating it if it does not exist.
+     * Fallback for Android versions prior to API 30 (Android 11) which do not support SQLite UPSERT syntax.
+     */
+    @Transaction
+    suspend fun addStatTimesLegacy(
+        date: LocalDate,
+        topicId: Long,
+        focusTimeQ1: Long,
+        focusTimeQ2: Long,
+        focusTimeQ3: Long,
+        focusTimeQ4: Long,
+        breakTime: Long
+    ) {
+        insertDefaultStatTimes(date, topicId)
+        updateStatTimes(
+            date,
+            topicId,
+            focusTimeQ1,
+            focusTimeQ2,
+            focusTimeQ3,
+            focusTimeQ4,
+            breakTime
+        )
+    }
+
+    @Query(
+        """
+        INSERT OR IGNORE INTO stat (date, topicId, focusTimeQ1, focusTimeQ2, focusTimeQ3, focusTimeQ4, breakTime)
+        VALUES (:date, :topicId, 0, 0, 0, 0, 0)
+        """
+    )
+    suspend fun insertDefaultStatTimes(date: LocalDate, topicId: Long)
+
+    @Query(
+        """
+        UPDATE stat SET
+            focusTimeQ1 = focusTimeQ1 + :focusTimeQ1,
+            focusTimeQ2 = focusTimeQ2 + :focusTimeQ2,
+            focusTimeQ3 = focusTimeQ3 + :focusTimeQ3,
+            focusTimeQ4 = focusTimeQ4 + :focusTimeQ4,
+            breakTime = breakTime + :breakTime
+        WHERE date = :date AND topicId = :topicId
+        """
+    )
+    suspend fun updateStatTimes(
+        date: LocalDate,
+        topicId: Long,
+        focusTimeQ1: Long,
+        focusTimeQ2: Long,
+        focusTimeQ3: Long,
+        focusTimeQ4: Long,
+        breakTime: Long
+    )
+
     @Query(
         """
         SELECT
```

**File**: `shared/src/commonMain/kotlin/org/nsh07/pomodoro/data/StatRepository.kt` (modified, +35/-2)
```diff
@@ -20,6 +20,7 @@ package org.nsh07.pomodoro.data
 import kotlinx.coroutines.CoroutineDispatcher
 import kotlinx.coroutines.flow.Flow
 import kotlinx.coroutines.withContext
+import org.nsh07.pomodoro.utils.androidSdkVersionAtLeast
 import java.time.LocalDate
 import java.time.LocalTime
 
@@ -73,7 +74,7 @@ class AppStatRepository(
                 else -> 4
             }
 
-            statDao.addStatTimes(
+            addStatTimes(
                 date = LocalDate.now(),
                 topicId = topicId,
                 focusTimeQ1 = if (quarter == 1) focusTime else 0,
@@ -86,7 +87,7 @@ class AppStatRepository(
 
     override suspend fun addBreakTime(topicId: Long, breakTime: Long) =
         withContext(ioDispatcher) {
-            statDao.addStatTimes(
+            addStatTimes(
                 date = LocalDate.now(),
                 topicId = topicId,
                 focusTimeQ1 = 0,
@@ -97,6 +98,38 @@ class AppStatRepository(
             )
         }
 
+    private suspend fun addStatTimes(
+        date: LocalDate,
+        topicId: Long,
+        focusTimeQ1: Long,
+        focusTimeQ2: Long,
+        focusTimeQ3: Long,
+        focusTimeQ4: Long,
+        breakTime: Long
+    ) {
+        if (androidSdkVersionAtLeast(30)) {
+            statDao.addStatTimes(
+                date = date,
+                topicId = topicId,
+                focusTimeQ1 = focusTimeQ1,
+                focusTimeQ2 = focusTimeQ2,
+                focusTimeQ3 = focusTimeQ3,
+                focusTimeQ4 = focusTimeQ4,
+                breakTime = breakTime
+            )
+        } else {
+            statDao.addStatTimesLegacy(
+                date = date,
+                topicId = topicId,
+                focusTimeQ1 = focusTimeQ1,
+                focusTimeQ2 = focusTimeQ2,
+                focusTimeQ3 = focusTimeQ3,
+                focusTimeQ4 = focusTimeQ4,
+                breakTime = breakTime
+            )
+        }
+    }
+
     override fun getTodayStat(): Flow<Stat?> {
         val currentDate = LocalDate.now()
         return statDao.getStat(currentDate)
```

**File**: `shared/src/commonMain/kotlin/org/nsh07/pomodoro/utils/Utils.kt` (modified, +2/-0)
```diff
@@ -17,6 +17,7 @@
 
 package org.nsh07.pomodoro.utils
 
+import androidx.annotation.ChecksSdkIntAtLeast
 import java.util.Locale
 import java.util.concurrent.TimeUnit
 
@@ -69,6 +70,7 @@ fun <T> MutableList<T>.onTopLevelNavigate(screen: T) {
  * @param version SDK version code
  * @return false if device is not running Android or SDK version is lower than [version], else true
  */
+@ChecksSdkIntAtLeast(parameter = 0)
 expect fun androidSdkVersionAtLeast(version: Int): Boolean
 
 expect fun androidDeviceManufacturerIs(manufacturer: String): Boolean
```

**File**: `shared/src/jvmMain/kotlin/org/nsh07/pomodoro/utils/Utils.jvm.kt` (modified, +3/-0)
```diff
@@ -17,6 +17,9 @@
 
 package org.nsh07.pomodoro.utils
 
+import androidx.annotation.ChecksSdkIntAtLeast
+
+@ChecksSdkIntAtLeast(parameter = 0)
 actual fun androidSdkVersionAtLeast(version: Int): Boolean = false
 
 actual fun androidDeviceManufacturerIs(manufacturer: String): Boolean = false
```

**File**: `shared/src/jvmTest/kotlin/org/nsh07/pomodoro/data/StatDaoTest.kt` (modified, +27/-0)
```diff
@@ -83,6 +83,33 @@ class StatDaoTest : DatabaseTest() {
         )
     }
 
+    @Test
+    fun `adding times legacy creates row when missing and accumulates onto existing row`(): Unit =
+        runBlocking {
+            val work = insertTopic("Work")
+            val date = LocalDate.parse("2026-03-12")
+
+            statDao.addStatTimesLegacy(date, work.id, 1, 2, 3, 4, 5)
+
+            val created = assertNotNull(statFor("2026-03-12", work.id))
+            assertEquals(10L, created.totalFocusTime())
+            assertEquals(5L, created.breakTime)
+
+            statDao.addStatTimesLegacy(date, work.id, 10, 20, 30, 40, 50)
+
+            val summed = assertNotNull(statFor("2026-03-12", work.id))
+            assertContentEquals(
+                listOf(11L, 22L, 33L, 44L, 55L),
+                listOf(
+                    summed.focusTimeQ1,
+                    summed.focusTimeQ2,
+                    summed.focusTimeQ3,
+                    summed.focusTimeQ4,
+                    summed.breakTime
+            )
+        )
+    }
+
     @Test
     fun `adding times keeps each topic's row separate`(): Unit = runBlocking {
         val work = insertTopic("Work")
```

---

### Incident Patch 2: `8d618cdb` (2026-09-19)
**Commit Message**: fix(widget): make history widget preview functional again

**File**: `androidApp/src/main/java/org/nsh07/pomodoro/widget/HistoryAppWidget.kt` (modified, +153/-135)
```diff
@@ -23,6 +23,7 @@ import androidx.compose.material3.MaterialTheme.typography
 import androidx.compose.runtime.Composable
 import androidx.compose.runtime.key
 import androidx.compose.runtime.rememberCoroutineScope
+import androidx.compose.ui.graphics.Color
 import androidx.compose.ui.unit.dp
 import androidx.compose.ui.util.fastForEachIndexed
 import androidx.glance.ColorFilter
@@ -54,6 +55,7 @@ import androidx.glance.layout.fillMaxWidth
 import androidx.glance.layout.height
 import androidx.glance.layout.padding
 import androidx.glance.layout.width
+import androidx.glance.material3.ColorProviders
 import androidx.glance.preview.ExperimentalGlancePreviewApi
 import androidx.glance.preview.Preview
 import androidx.glance.text.FontWeight
@@ -65,9 +67,11 @@ import org.nsh07.pomodoro.MainActivity
 import org.nsh07.pomodoro.R
 import org.nsh07.pomodoro.data.Stat
 import org.nsh07.pomodoro.data.StatRepository
+import org.nsh07.pomodoro.ui.theme.lightScheme
 import org.nsh07.pomodoro.utils.millisecondsToHoursMinutes
 import org.nsh07.pomodoro.widget.TomatoWidgetSize.Width4
 import org.nsh07.pomodoro.widget.components.GlanceText
+import java.time.LocalDate
 
 class HistoryAppWidget : GlanceAppWidget(), KoinComponent {
     override val sizeMode: SizeMode = SizeMode.Exact
@@ -199,140 +203,154 @@ class HistoryAppWidget : GlanceAppWidget(), KoinComponent {
     @Preview(widthDp = 400, heightDp = 216)
     @Composable
     private fun ContentPreview() {
-        // TODO: add topic parameter
-//        val history = listOf(
-//            Stat(
-//                date = LocalDate.of(2026, 3, 12),
-//                focusTimeQ1 = 1617943 + 7200000,
-//                focusTimeQ2 = 5704591,
-//                focusTimeQ3 = 556490,
-//                focusTimeQ4 = 1200498,
-//                breakTime = 3939448
-//            ),
-//            Stat(
-//                date = LocalDate.of(2026, 3, 13),
-//                focusTimeQ1 = 1128282 + 7200000,
-//                focusTimeQ2 = 4590524,
-//                focusTimeQ3 = 7747202,
-//                focusTimeQ4 = 1119272,
-//                breakTime = 311887
-//            ),
-//            Stat(
-//                date = LocalDate.of(2026, 3, 14),
-//                focusTimeQ1 = 1418079 + 7200000,
-//                focusTimeQ2 = 8141785,
-//                focusTimeQ3 = 5208864,
-//                focusTimeQ4 = 2793210,
-//                breakTime = 2873581
-//            ),
-//            Stat(
-//                date = LocalDate.of(2026, 3, 15),
-//                focusTimeQ1 = 38960 + 7200000,
-//                focusTimeQ2 = 9544172,
-//                focusTimeQ3 = 2216626,
-//                focusTimeQ4 = 1424242,
-//                breakTime = 4635775
-//            ),
-//            Stat(
-//                date = LocalDate.of(2026, 3, 16),
-//                focusTimeQ1 = 948108 + 7200000,
-//                focusTimeQ2 = 7715257,
-//                focusTimeQ3 = 648629,
-//                focusTimeQ4 = 319655,
-//                breakTime = 1710029
-//            ),
-//            Stat(
-//                date = LocalDate.of(2026, 3, 17),
-//                focusTimeQ1 = 1673932 + 7200000,
-//                focusTimeQ2 = 7368028,
-//                focusTimeQ3 = 6028910,
-//                focusTimeQ4 = 2134210,
-//                breakTime = 2811766
-//            ),
-//            Stat(
-//                date = LocalDate.of(2026, 3, 18),
-//                focusTimeQ1 = 435688 + 7200000,
-//                focusTimeQ2 = 9487983,
-//                focusTimeQ3 = 248276,
-//                focusTimeQ4 = 913853,
-//                breakTime = 162869
-//            ),
-//            Stat(
-//                date = LocalDate.of(2026, 3, 19),
-//                focusTimeQ1 = 1579291 + 7200000,
-//                focusTimeQ2 = 3743344,
-//                focusTimeQ3 = 3383617,
-//                focusTimeQ4 = 3424645,
-//                breakTime = 3443552
-//            ),
-/
```

---

### Incident Patch 3: `39f3d4b9` (2026-09-18)
**Commit Message**: fix(purchases): add test store key for testing

**File**: `androidApp/build.gradle.kts` (modified, +2/-0)
```diff
@@ -69,9 +69,11 @@ android {
             isMinifyEnabled = true
             isShrinkResources = true
             signingConfig = signingConfigs.getByName("release")
+            buildConfigField("String", "REVENUECAT_API_KEY", "\"goog_jBpRIBjTYvhKYluCqkPXSHbuFbX\"")
         }
         debug {
             applicationIdSuffix = ".debug"
+            buildConfigField("String", "REVENUECAT_API_KEY", "\"test_YwOIjOuWhXcnCqSuqlIzMlstGeW\"")
         }
     }
 
```

**File**: `androidApp/src/play/java/org/nsh07/pomodoro/billing/initializePurchases.kt` (modified, +2/-1)
```diff
@@ -20,11 +20,12 @@ package org.nsh07.pomodoro.billing
 import android.content.Context
 import com.revenuecat.purchases.Purchases
 import com.revenuecat.purchases.PurchasesConfiguration
+import org.nsh07.pomodoro.BuildConfig
 
 fun initializePurchases(context: Context) {
     Purchases.configure(
         PurchasesConfiguration
-            .Builder(context, "goog_jBpRIBjTYvhKYluCqkPXSHbuFbX")
+            .Builder(context, BuildConfig.REVENUECAT_API_KEY)
             .build()
     )
 }
\ No newline at end of file
```

---

### Incident Patch 4: `14619831` (2026-09-17)
**Commit Message**: Revert "build(desktop): use ProGuard optimization & obfuscation"

This reverts commit dee6602d8012bfcff4e6c588f2276a53c5c107ee.

**File**: `desktopApp/build.gradle.kts` (modified, +1/-3)
```diff
@@ -86,10 +86,8 @@ compose.desktop {
         }
 
         buildTypes.release.proguard {
-            isEnabled = true
+            isEnabled = false
             optimize = true
-            obfuscate = true
-            configurationFiles.from(project.file("proguard-rules.pro"))
         }
     }
 }
```

**File**: `desktopApp/proguard-rules.pro` (modified, +0/-46)
```diff
@@ -1,46 +0,0 @@
-# ProGuard rules for the desktop (JVM) target. The Compose Gradle plugin already applies its own
-# defaults (Kotlin, coroutines, Skiko, kotlinx.serialization); these are only project additions.
-
--optimizationpasses 5
--allowaccessmodification
-
-# Readable stack traces; generics and nesting metadata for the reflection-based libraries below
--keepattributes SourceFile,LineNumberTable,Signature,InnerClasses,EnclosingMethod
-
-# Room locates the generated implementation via Class.forName("<database>_Impl")
--keep class * extends androidx.room.RoomDatabase { <init>(); }
-
-# JNI: keep native method names and the classes the native side calls back into
--keepclasseswithmembernames,includedescriptorclasses class * { native <methods>; }
--keep class androidx.sqlite.** { *; }
-
-# JNA (tray, dark mode detection, file dialogs) resolves native symbols, structure fields and
-# callbacks by reflection on their names
--keep class com.sun.jna.** { *; }
--keep,includedescriptorclasses class * extends com.sun.jna.** { *; }
--dontnote com.sun.jna.**
-
-# composenativetray and nucleus call back into their bridge classes from native code by name
-# (e.g. ThemeChangeCallback.onThemeChanged), which the native-method rule above does not cover
--keep,includedescriptorclasses class com.kdroid.composetray.lib.** { *; }
--keep class io.github.kdroidfilter.nucleus.darkmodedetector.** { *; }
-
-# dbus-java (Linux tray) introspects interfaces, annotations and generic signatures at runtime
--keep class org.freedesktop.dbus.** { *; }
--dontnote org.freedesktop.dbus.**
--dontwarn org.slf4j.**
--dontnote org.slf4j.**
-
-# JLayer instantiates its audio device by class name and loads its *.ser tables relative to
-# JavaLayerUtils' package
--keep class dev.mccue.jlayer.player.JavaSoundAudioDevice { <init>(); }
--keepnames class dev.mccue.jlayer.decoder.JavaLayerUtils
-
-# Vico's MutableCartesianMeasuringContext calls MeasuringContext.super methods, which is only legal
-# while MeasuringContext stays a direct superinterface; the shrinker otherwise drops that entry
--keep,allowobfuscation interface com.patrykandpatrick.vico.compose.common.MeasuringContext
-
-# Skiko is pinned below the version these were compiled against (see build.gradle.kts); neither
-# code path is used by the app
--dontwarn androidx.compose.desktop.ui.tooling.preview.runtime.NonInteractivePreviewFacade*
--dontwarn io.github.vinceglb.filekit.dialogs.compose.util.ImageBitmapExt_nonAndroidKt*
```

---

### Incident Patch 5: `41855cab` (2026-09-11)
**Commit Message**: fix(deps): update all non-major dependencies

**File**: `gradle/libs.versions.toml` (modified, +3/-3)
```diff
@@ -16,21 +16,21 @@ filekitDialogsCompose = "0.16.0"
 glance = "1.2.0"
 jlayerPlayer = "2024.04.19"
 junitVersion = "1.3.0"
-kotlin = "2.4.10"
+kotlin = "2.4.20"
 kotlinxCoroutines = "1.11.0"
 ksp = "2.3.12"
 lifecycleRuntime = "2.11.0"
 materialKolor = "5.0.1"
 navigation3 = "1.1.1"
-revenuecat = "10.20.0"
+revenuecat = "10.21.1"
 room = "2.8.5"
 sqlite = "2.7.1"
 vico = "3.3.1"
 composeMultiplatform = "1.12.0"
 composeMaterial3 = "1.12.0-alpha03"
 skiko = "0.150.0"
 koinBom = "4.2.2"
-koinCompilerPlugin = "1.2.0"
+koinCompilerPlugin = "1.2.1"
 
 [libraries]
 androidx-activity-compose = { group = "androidx.activity", name = "activity-compose", version.ref = "activityCompose" }
```

---

### Incident Patch 6: `6d25cfad` (2026-09-17)
**Commit Message**: fix(alarm): loop alarm sound until dialog is dismissed

Closes #292

**File**: `androidApp/src/main/java/org/nsh07/pomodoro/service/TimerService.kt` (modified, +1/-0)
```diff
@@ -465,6 +465,7 @@ class TimerService : Service(), KoinComponent {
                     true
                 }
 
+                isLooping = true
                 setAudioAttributes(
                     AudioAttributes.Builder()
                         .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
```

**File**: `shared/src/jvmMain/kotlin/org/nsh07/pomodoro/timer/MP3Player.kt` (modified, +9/-6)
```diff
@@ -23,6 +23,7 @@ import kotlinx.coroutines.Dispatchers
 import kotlinx.coroutines.Job
 import kotlinx.coroutines.SupervisorJob
 import kotlinx.coroutines.cancel
+import kotlinx.coroutines.isActive
 import kotlinx.coroutines.launch
 import java.io.BufferedInputStream
 import java.io.File
@@ -47,19 +48,21 @@ class MP3Player(val audioPath: String?) {
         get() = playJob?.isActive == true
 
     /**
-     * Starts playback. If audio is already playing, it does nothing.
+     * Starts looping playback until [stop] is called. If audio is already playing, it does nothing.
      */
     fun play() {
         if (isPlaying) return
 
         playJob = audioScope.launch {
             try {
                 audioFile?.let {
-                    val fileInputStream = FileInputStream(audioFile)
-                    val bufferedInputStream = BufferedInputStream(fileInputStream)
+                    while (isActive) {
+                        val fileInputStream = FileInputStream(audioFile)
+                        val bufferedInputStream = BufferedInputStream(fileInputStream)
 
-                    player = Player(bufferedInputStream)
-                    player?.play()
+                        player = Player(bufferedInputStream)
+                        player?.play()
+                    }
                 }
             } catch (e: Exception) {
                 println("Playback stopped or encountered an error: ${e.message}")
@@ -74,8 +77,8 @@ class MP3Player(val audioPath: String?) {
      */
     fun stop() {
         if (isPlaying) {
-            player?.close()
             playJob?.cancel()
+            player?.close()
             reset()
         }
     }
```

---

### Incident Patch 7: `5c26ed10` (2026-09-16)
**Commit Message**: fix(service): run IO operation on IO dispatcher in onDestroy

**File**: `androidApp/src/main/java/org/nsh07/pomodoro/service/TimerService.kt` (modified, +7/-8)
```diff
@@ -106,13 +106,11 @@ class TimerService : Service(), KoinComponent {
     override fun onDestroy() {
         isRunning = false
         updateQSTile()
-        runBlocking {
-            job.cancel()
-            timerManager.saveTimeToDb()
-            setDoNotDisturb(false)
-            notificationManager.cancel(1)
-            alarm?.release()
-        }
+        job.cancel()
+        runBlocking(Dispatchers.IO) { timerManager.saveTimeToDb() }
+        setDoNotDisturb(false)
+        notificationManager.cancel(1)
+        alarm?.release()
         super.onDestroy()
     }
 
@@ -448,8 +446,9 @@ class TimerService : Service(), KoinComponent {
             }, paused = true, complete = false
         )
 
+        // Off the main thread like every other action, since starting writes the session out
         if (currentTopic.autostartNextSession && !fromAutoStop)  // auto start next session
-            toggleTimer()
+            skipScope.launch { toggleTimer() }
 
         CoroutineScope(Dispatchers.IO).launch {
             updateWidget()
```

---

### Incident Patch 8: `1d1d7bd2` (2026-09-16)
**Commit Message**: fix(widget): widget and QS tile consistency fixes

**File**: `androidApp/src/main/java/org/nsh07/pomodoro/TomatoApplication.kt` (modified, +17/-1)
```diff
@@ -20,7 +20,12 @@ package org.nsh07.pomodoro
 import android.app.Application
 import android.app.NotificationChannel
 import android.app.NotificationManager
+import android.content.ComponentName
+import android.service.quicksettings.TileService
 import androidx.core.app.NotificationManagerCompat
+import kotlinx.coroutines.CoroutineScope
+import kotlinx.coroutines.Dispatchers
+import kotlinx.coroutines.launch
 import org.koin.android.ext.android.get
 import org.koin.android.ext.koin.androidContext
 import org.koin.android.ext.koin.androidLogger
@@ -31,6 +36,7 @@ import org.nsh07.pomodoro.di.androidModule
 import org.nsh07.pomodoro.di.dbModule
 import org.nsh07.pomodoro.di.servicesModule
 import org.nsh07.pomodoro.di.viewModels
+import org.nsh07.pomodoro.qsTile.TomatoQSTileService
 import org.nsh07.pomodoro.service.TimerManager
 
 class TomatoApplication : Application() {
@@ -63,6 +69,16 @@ class TomatoApplication : Application() {
         get<NotificationManagerCompat>().createNotificationChannel(notificationChannel)
 
         // created eagerly so that a stored session is restored however the process was started
-        get<TimerManager>()
+        val timerManager = get<TimerManager>()
+
+        // The tile keeps whatever it last showed, from before a reboot or a kill, until told to
+        // ask again, and asking before the restore has run would only show it a fresh timer
+        CoroutineScope(Dispatchers.Default).launch {
+            timerManager.awaitRestore()
+            TileService.requestListeningState(
+                this@TomatoApplication,
+                ComponentName(this@TomatoApplication, TomatoQSTileService::class.java)
+            )
+        }
     }
 }
```

**File**: `androidApp/src/main/java/org/nsh07/pomodoro/service/TimerService.kt` (modified, +4/-21)
```diff
@@ -20,7 +20,6 @@ package org.nsh07.pomodoro.service
 import android.annotation.SuppressLint
 import android.app.NotificationManager
 import android.app.Service
-import android.appwidget.AppWidgetManager
 import android.content.ComponentName
 import android.content.Intent
 import android.media.AudioAttributes
@@ -36,8 +35,7 @@ import androidx.compose.ui.graphics.toArgb
 import androidx.core.app.NotificationCompat
 import androidx.core.app.NotificationManagerCompat
 import androidx.core.net.toUri
-import androidx.glance.GlanceId
-import androidx.glance.appwidget.GlanceAppWidgetManager
+import androidx.glance.appwidget.updateAll
 import kotlinx.coroutines.CoroutineScope
 import kotlinx.coroutines.Dispatchers
 import kotlinx.coroutines.Job
@@ -71,8 +69,6 @@ class TimerService : Service(), KoinComponent {
     private val _settingsState by lazy { stateRepository.settingsState }
 
     private val widget by lazy { TimerAppWidget() }
-    private val widgetManager by lazy { GlanceAppWidgetManager(this) }
-    private var glanceId: GlanceId? = null
 
     private var job = SupervisorJob()
     private val timerScope = CoroutineScope(Dispatchers.IO + job)
@@ -126,16 +122,6 @@ class TimerService : Service(), KoinComponent {
             return START_NOT_STICKY
         }
 
-        if (glanceId == null) {
-            val widgetId = intent.getIntExtra(
-                AppWidgetManager.EXTRA_APPWIDGET_ID,
-                AppWidgetManager.INVALID_APPWIDGET_ID
-            )
-
-            glanceId = if (widgetId == AppWidgetManager.INVALID_APPWIDGET_ID) null
-            else widgetManager.getGlanceIdBy(widgetId)
-        }
-
         val action = intent.action
         // Noted before promoting, to tell a service that was already showing something apart from
         // one that exists only to carry this action
@@ -342,13 +328,10 @@ class TimerService : Service(), KoinComponent {
     }
 
     /**
-     * Updates the most recently interacted [TimerAppWidget] widget to make it show the correct time
-     * as long as the timer runs
+     * Updates all instance of [TimerAppWidget] widget to make them show the correct time as long as
+     * the timer runs
      */
-    private suspend fun updateWidget() =
-        glanceId?.let {
-            widget.update(this@TimerService, it)
-        }
+    private suspend fun updateWidget() = widget.updateAll(this)
 
     private fun updateProgressSegments() {
         val settingsState = _settingsState.value
```

**File**: `androidApp/src/main/java/org/nsh07/pomodoro/widget/StartServiceAction.kt` (modified, +0/-4)
```diff
@@ -17,13 +17,11 @@
 
 package org.nsh07.pomodoro.widget
 
-import android.appwidget.AppWidgetManager
 import android.content.Context
 import android.content.Intent
 import android.util.Log
 import androidx.glance.GlanceId
 import androidx.glance.action.ActionParameters
-import androidx.glance.appwidget.GlanceAppWidgetManager
 import androidx.glance.appwidget.action.ActionCallback
 import org.nsh07.pomodoro.service.TimerService
 
@@ -34,11 +32,9 @@ class StartServiceAction : ActionCallback {
         parameters: ActionParameters
     ) {
         val timerAction = parameters[key] as TimerService.Actions
-        val appWidgetId = GlanceAppWidgetManager(context).getAppWidgetId(glanceId)
 
         val serviceIntent = Intent(context, TimerService::class.java).apply {
             action = timerAction.toString()
-            putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId)
         }
 
         try {
```

---

### Incident Patch 9: `23461728` (2026-09-16)
**Commit Message**: fix(timer): derive timer frequency based on foreground status

**File**: `androidApp/src/main/java/org/nsh07/pomodoro/MainActivity.kt` (modified, +3/-5)
```diff
@@ -84,7 +84,7 @@ class MainActivity : ComponentActivity() {
                 AppScreen(
                     isAODEnabled = settingsState.aodEnabled,
                     setTimerFrequency = {
-                        stateRepository.timerFrequency = it
+                        stateRepository.screenTimerFrequency = it
                     }
                 )
             }
@@ -94,14 +94,12 @@ class MainActivity : ComponentActivity() {
 
     override fun onStop() {
         super.onStop()
-        // Reduce the timer loop frequency when not visible to save battery
-        stateRepository.timerFrequency = 1f
+        stateRepository.foreground = false
     }
 
     override fun onStart() {
         super.onStart()
-        // Increase the timer loop frequency again when visible to make the progress smoother
-        stateRepository.timerFrequency = 60f
+        stateRepository.foreground = true
         resumeStoredTimer()
     }
 
```

**File**: `shared/src/commonMain/kotlin/org/nsh07/pomodoro/data/StateRepository.kt` (modified, +14/-1)
```diff
@@ -37,6 +37,7 @@ import org.nsh07.pomodoro.ui.timerScreen.viewModel.TimerMode
 import org.nsh07.pomodoro.ui.timerScreen.viewModel.TimerState
 import org.nsh07.pomodoro.utils.getDefaultAlarmTone
 import org.nsh07.pomodoro.utils.millisecondsToStr
+import kotlin.concurrent.Volatile
 
 @OptIn(ExperimentalCoroutinesApi::class)
 class StateRepository(
@@ -55,7 +56,19 @@ class StateRepository(
     val currentTopic: StateFlow<Topic> = _currentTopic.asStateFlow()
 
     val time = MutableStateFlow(25 * 60 * 1000L)
-    var timerFrequency: Float = 60f
+
+    /** Tick rate wanted by the screen being shown, while the app is [foreground] */
+    @Volatile
+    var screenTimerFrequency: Float = 60f
+
+    /** Whether the app is on screen at all */
+    @Volatile
+    var foreground: Boolean = true
+
+    /** Ticks per second of the timer loop */
+    val timerFrequency: Float
+        get() = if (foreground) screenTimerFrequency else 1f
+
     var colorScheme: ColorScheme = lightColorScheme()
     var timerStateSnapshot: TimerStateSnapshot =
         TimerStateSnapshot(time = 0, timerState = TimerState())
```

**File**: `shared/src/jvmMain/kotlin/org/nsh07/pomodoro/AppWindow.kt` (modified, +1/-1)
```diff
@@ -137,7 +137,7 @@ fun ApplicationScope.AppWindow(
                             AppScreen(
                                 isAODEnabled = settingsState.aodEnabled,
                                 setTimerFrequency = {
-                                    stateRepository.timerFrequency = it
+                                    stateRepository.screenTimerFrequency = it
                                 }
                             )
 
```

**File**: `shared/src/jvmTest/kotlin/org/nsh07/pomodoro/data/StateRepositoryTest.kt` (modified, +13/-0)
```diff
@@ -153,6 +153,19 @@ class StateRepositoryTest {
         assertEquals(work.focusTime, stateRepository.timerState.value.totalTime)
     }
 
+    @Test
+    fun `the timer only ticks at the screen's rate while the app is in the foreground`() {
+        val stateRepository = stateRepository()
+
+        stateRepository.screenTimerFrequency = 1f // the AOD is shown
+        stateRepository.foreground = false
+        stateRepository.screenTimerFrequency = 60f // the AOD leaves the screen
+        assertEquals(1f, stateRepository.timerFrequency)
+
+        stateRepository.foreground = true
+        assertEquals(60f, stateRepository.timerFrequency)
+    }
+
     @Test
     fun `deleting the selected topic selects the default topic`() = runBlocking {
         val preferenceRepository = preferenceRepository(work.id)
```

---

### Incident Patch 10: `bfcfe416` (2026-09-16)
**Commit Message**: fix(timer): pause timer in the reset function instead of separately

**File**: `androidApp/src/main/java/org/nsh07/pomodoro/service/TimerService.kt` (modified, +0/-1)
```diff
@@ -154,7 +154,6 @@ class TimerService : Service(), KoinComponent {
 
             Actions.RESET.toString() -> skipScope.launch {
                 timerManager.awaitRestore()
-                if (_timerState.value.timerRunning) toggleTimer()
                 timerManager.resetTimer(::updateProgressSegments)
                 stopForegroundService()
             }
```

**File**: `shared/src/commonMain/kotlin/org/nsh07/pomodoro/service/TimerManager.kt` (modified, +9/-0)
```diff
@@ -483,9 +483,18 @@ class TimerManager(
         }
     }
 
+    /**
+     * Stops the timer and puts it back at the start of the first focus interval.
+     */
     suspend fun resetTimer(onCompletion: () -> Unit) {
         val currentTopic = stateRepository.currentTopic.value
 
+        timerJob?.cancel()
+        if (_timerState.value.timerRunning) {
+            pauseTime = currentTime()
+            _timerState.update { it.copy(timerRunning = false) }
+        }
+
         saveLock.withLock {
             saveElapsedTime()
             // Snapshotted after flushing, so that an undo cannot save the same time twice
```

**File**: `shared/src/jvmMain/kotlin/org/nsh07/pomodoro/timer/DesktopTimerHelper.kt` (modified, +2/-5)
```diff
@@ -47,11 +47,8 @@ class DesktopTimerHelper(
 
     override fun onAction(action: TimerAction) {
         when (action) {
-            TimerAction.ResetTimer -> {
-                if (_timerState.value.timerRunning) toggleTimer()
-                skipScope.launch {
-                    timerManager.resetTimer {}
-                }
+            TimerAction.ResetTimer -> skipScope.launch {
+                timerManager.resetTimer {}
             }
 
             is TimerAction.SkipTimer -> skipScope.launch {
```

**File**: `shared/src/jvmTest/kotlin/org/nsh07/pomodoro/service/TimerManagerTest.kt` (modified, +38/-0)
```diff
@@ -433,6 +433,44 @@ class TimerManagerTest {
         assertEquals(15 * MINUTE, statRepository.focusTime)
     }
 
+    @Test
+    fun `resetting a running timer stops it`() = runBlocking {
+        timerManager.toggle()
+        clock += 10 * MINUTE
+
+        timerManager.resetTimer {}
+
+        val timerState = stateRepository.timerState.value
+        assertFalse(timerState.timerRunning)
+        assertEquals(TimerMode.FOCUS, timerState.timerMode)
+        assertEquals(topic.focusTime, stateRepository.time.value)
+        assertNull(scheduledExpiry)
+        assertEquals(10 * MINUTE, statRepository.focusTime)
+
+        // The time before the reset was kept, and the time after it was not
+        clock += 5 * MINUTE
+        timerManager.undoReset()
+        timerManager.toggle() // resume
+        clock += 5 * MINUTE
+        timerManager.saveTimeToDb()
+        assertEquals(15 * MINUTE, statRepository.focusTime)
+    }
+
+    /** Regression test: pausing a frozen session takes it over, so the reset must not rely on it */
+    @Test
+    fun `resetting a session left without a loop stops it`() = runBlocking {
+        val serviceScope = CoroutineScope(NeverDispatcher)
+        timerManager.toggle(serviceScope)
+        clock += 10 * MINUTE
+        serviceScope.cancel() // the service is destroyed, taking the timer loop with it
+
+        timerManager.resetTimer {}
+
+        assertFalse(stateRepository.timerState.value.timerRunning)
+        assertNull(scheduledExpiry)
+        assertEquals(topic.focusTime, stateRepository.time.value)
+    }
+
     @Test
     fun `a running session is still paused by the button while its loop is alive`() = runBlocking {
         timerManager.toggle()
```

#### Recent Merged Pull Requests:
- **PR #310** (2026-09-17): fix(deps): update all non-major dependencies (@renovate[bot])
- **PR #308** (2026-09-10): fix(deps): update all non-major dependencies (@renovate[bot])
- **PR #304** (2026-09-01): chore(deps): update actions/setup-java action to v6 (@renovate[bot])
- **PR #303** (2026-09-10): Add Dimu under the Special Thanks section of the README (@pdimu)
- **PR #300** (2026-09-01): fix(deps): update all non-major dependencies (@renovate[bot])
- **PR #298** (2026-08-19): fix(deps): update all non-major dependencies (@renovate[bot])
- **PR #295** (2026-08-19): chore(deps): update actions/checkout action to v7 (@renovate[bot])
- **PR #289** (2026-08-09): fix(deps): update dependency com.materialkolor:material-kolor to v5 (@renovate[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

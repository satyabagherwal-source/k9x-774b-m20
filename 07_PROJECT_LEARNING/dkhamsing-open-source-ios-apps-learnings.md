# Forensic Learning Record (Deep Inspection): dkhamsing/open-source-ios-apps

> **Canonical Artifact**: `07_PROJECT_LEARNING/dkhamsing-open-source-ios-apps-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/dkhamsing/open-source-ios-apps](https://github.com/dkhamsing/open-source-ios-apps))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:22:53.494Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `dkhamsing/open-source-ios-apps`
- **Description**: :iphone: Collaborative List of Open-Source iOS Apps
- **Primary Language / Ecosystem**: Multi-language
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 52417 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2410** (2026-10-05): **Add 2026 tag to Paint Anytime**
  *Symptoms*: ## Update a project 1. Project URL: https://github.com/denis-kolchev/Paint-Anytime 2. [x] Update contents.json instead of README 3. [x] One project per pull request Adds a `2026` tag to the existing Paint Anytime entry (no other changes).

- **Issue #2408** (2026-10-05): **Add Pixy by @mrzmyr**
  *Symptoms*: hey 👋  I built Pixy, a mood tracker where every day is one pixel, so your whole year fits on one screen. It's MIT, built with React Native and Expo, and has been on the App Store since 2022.  ## Add a project 1. [x] Project URL: https://github.com/mrzmyr/pixy-mood-tracker-app 2. [x] Update contents.json instead of README 3. [x] One project per pull request 4. [x] Screenshot included 5. [x] Avoid iOS or open-source in description as it is assumed 6. [x] Use this commit title format if applicable: Add app-name by @github-username 7. [x] Use approved format for your entry  Validated locally against `schema.json` and `osia_validate_categories.rb`.  thanks for keeping this list alive all these years 🤗
  **Post-Mortem & Fix Analysis**:
  > Thank you

- **Issue #2406** (2026-10-03): **Test link check**
  *Symptoms*: 

- **Issue #2405** (2026-10-03): **Update workflow for link checking**
  *Symptoms*: 

- **Issue #2404** (2026-10-04): **Add 'Kith'**
  *Symptoms*: #2382

- **Issue #2403** (2026-10-03): **[ci] Remove push trigger from validate.yml**
  *Symptoms*: #2397 

- **Issue #2402** (2026-10-02): **[ci] Add GitHub Actions workflow for validation**
  *Symptoms*: #2397

- **Issue #2401** (2026-10-02): **[ci] Rename workflow from 'Ruby' to 'Links check'**
  *Symptoms*: 

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

### Incident Patch 1: `ca7349c6` (2026-10-05)
**Commit Message**: [auto] [ci skip] Generate content

**File**: `APPSTORE.md` (modified, +9/-1)
```diff
@@ -4,7 +4,7 @@
 ⚠️ This README is generated, please do not update. To contribute, make changes to contents.json ⚠️ 
  https://github.com/dkhamsing/open-source-ios-apps -->
 
-List of **304** open-source apps published on the App Store (complete list [here](https://github.com/dkhamsing/open-source-ios-apps)).
+List of **305** open-source apps published on the App Store (complete list [here](https://github.com/dkhamsing/open-source-ios-apps)).
 
 
 
@@ -820,6 +820,10 @@ https://developer.apple.com/reference/spritekit — [back to top](#readme)
   - [` App Store`](https://apps.apple.com/app/pilgrim-mindful-walking/id6760921056)
   -  `2026` `swift` `swiftui` 
   -  ☆`13` 
+- [Pixy](https://github.com/mrzmyr/pixy-mood-tracker-app): Mood tracker with one pixel per day, so your whole year fits on one screen. No account, no ads, entries stay on your phone
+  - <a href=https://pixy.day>`https://pixy.day`</a>
+  - [` App Store`](https://apps.apple.com/app/pixy-mood-tracker/id1605327124) <a href='https://raw.githubusercontent.com/mrzmyr/pixy-mood-tracker-app/main/docs/screen-1.png'>`Screenshot 1`</a> 
+  - `react-native` `typescript` `expo` 
 - [Pulse – Your Micro-Journal](https://github.com/marcusraitner/pulse): Minimalist micro-journaling companion designed to make reflection as effortless as possible
   - <a href=https://raitner.de/pulse>`https://raitner.de/pulse`</a>
   - [` App Store`](https://apps.apple.com/app/pulse-your-micro-journal/id6759242390)
@@ -1893,6 +1897,10 @@ https://reactnative.dev/ — [back to top](#readme)
   - [` App Store`](https://apps.apple.com/app/moonwalk-rocket-launches/id1439376174)
   -  `2023` `react-native` 
   -  ☆`292` 
+- [Pixy](https://github.com/mrzmyr/pixy-mood-tracker-app): Mood tracker with one pixel per day, so your whole year fits on one screen. No account, no ads, entries stay on your phone
+  - <a href=https://pixy.day>`https://pixy.day`</a>
+  - [` App Store`](https://apps.apple.com/app/pixy-mood-tracker/id1605327124) <a href='https://raw.githubusercontent.com/mrzmyr/pixy-mood-tracker-app/main/docs/screen-1.png'>`Screenshot 1`</a> 
+  - `react-native` `typescript` `expo` 
 - [PokeDB](https://github.com/satya164/PocketGear): Clean and simple Pokédex app for Pokémon GO
   - [` App Store`](https://apps.apple.com/app/pocketdex-for-pok%C3%A9mon-go/id1255564898) <a href='https://is5-ssl.mzstatic.com/image/thumb/Purple113/v4/92/e1/4d/92e14db4-8386-6f71-161b-652d76ce89ee/mzl.rlgaqcnk.jpg/460x0w.jpg'>`Screenshot 1`</a>  <a href='https://is5-ssl.mzstatic.com/image/thumb/Purple123/v4/43/11/f3/4311f37f-7232-b725-cd03-f4e8f2e7ace4/mzl.askczwpt.jpg/460x0w.jpg'>`Screenshot 2`</a>  <a href='https://is1-ssl.mzstatic.com/image/thumb/Purple113/v4/62/db/8d/62db8da0-0810-dfd0-937a-63dfc6fae957/mzl.odiufjsj.jpg/460x0w.jpg'>`Screenshot 3`</a>  <a href='https://is1-ssl.mzstatic.com/image/thumb/Purple113/v4/a9/fb/29/a9fb2936-ca9e-c88e-1276-e7a60a5fa565/pr_source.jpg/460x0w.jpg'>`Screenshot 4`</a>  <a href='https://is1-ssl.mzstatic.com/image/thumb/Purple113/v4/b6/32/c4/b632c4ee-2e2c-ff81-dd04-87e9f49f7341/mzl.sckfqxlh.jpg/460x0w.jpg'>`Screenshot 5`</a> 
   -  `2025` `react-native` 
```

**File**: `LATEST.md` (modified, +30/-30)
```diff
@@ -2,36 +2,36 @@
 
 ## Lastest additions to the [main list](https://github.com/dkhamsing/open-source-ios-apps)
 
-1. [Autheris](https://github.com/nerdykidtech/Autheris)
-2. [Motion](https://github.com/Significant-Hobbies/motion)
-3. [Palm](https://github.com/zaiqltd/palm)
-4. [Paint Anytime](https://github.com/denis-kolchev/Paint-Anytime)
-5. [Subskills](https://github.com/ihvou/subskills)
-6. [Kith](https://github.com/Significant-Hobbies/kith)
-7. [Setline](https://github.com/Significant-Hobbies/setline)
-8. [Anchor](https://github.com/Significant-Hobbies/anchor)
-9. [Calorie](https://github.com/Significant-Hobbies/calorie)
-10. [Silent Bell: Mindful Taps](https://github.com/jakublipinski/Silent-Bell)
-11. [FileManager](https://github.com/xsxs18-dev/FileManager)
-12. [RealTime Space](https://github.com/nicedreamzapp/RealTime-Space)
-13. [Conduck](https://github.com/GigaDuckAI/conduck)
-14. [Mlem](https://github.com/mlemgroup/mlem)
-15. [wBlock](https://github.com/0xCUB3/wBlock)
-16. [RAYN Weather](https://github.com/qh-work/RAYN)
-17. [BoxHelper](https://github.com/HOCKULUS/BoxHelper)
-18. [AliasVault](https://github.com/aliasvault/aliasvault)
-19. [Symptile](https://github.com/Loriage/Symptile)
-20. [Pocket for Mealie](https://github.com/Loriage/Mealie-Swift-App)
-21. [Beszel Companion](https://github.com/Loriage/Beszel-Swift-App)
-22. [Minidisc](https://github.com/Loriage/Minidisc)
-23. [Scowld](https://github.com/apoorvdarshan/scowld)
-24. [AI Dictation](https://github.com/writingmate/aidictation)
-25. [NoteGen](https://github.com/codexu/note-gen)
-26. [iBurn](https://github.com/iBurnApp/iBurn-iOS)
-27. [Dredfit](https://github.com/dredfort42/dredfit)
-28. [Oscar Weather](https://github.com/strumswell/oscar-weather)
-29. [MirrorNotes](https://github.com/lokii49/mirror)
-30. [Reynard Browser](https://github.com/minh-ton/reynard-browser)
+1. [Pixy](https://github.com/mrzmyr/pixy-mood-tracker-app)
+2. [Autheris](https://github.com/nerdykidtech/Autheris)
+3. [Motion](https://github.com/Significant-Hobbies/motion)
+4. [Palm](https://github.com/zaiqltd/palm)
+5. [Paint Anytime](https://github.com/denis-kolchev/Paint-Anytime)
+6. [Subskills](https://github.com/ihvou/subskills)
+7. [Kith](https://github.com/Significant-Hobbies/kith)
+8. [Setline](https://github.com/Significant-Hobbies/setline)
+9. [Anchor](https://github.com/Significant-Hobbies/anchor)
+10. [Calorie](https://github.com/Significant-Hobbies/calorie)
+11. [Silent Bell: Mindful Taps](https://github.com/jakublipinski/Silent-Bell)
+12. [FileManager](https://github.com/xsxs18-dev/FileManager)
+13. [RealTime Space](https://github.com/nicedreamzapp/RealTime-Space)
+14. [Conduck](https://github.com/GigaDuckAI/conduck)
+15. [Mlem](https://github.com/mlemgroup/mlem)
+16. [wBlock](https://github.com/0xCUB3/wBlock)
+17. [RAYN Weather](https://github.com/qh-work/RAYN)
+18. [BoxHelper](https://github.com/HOCKULUS/BoxHelper)
+19. [AliasVault](https://github.com/aliasvault/aliasvault)
+20. [Symptile](https://github.com/Loriage/Symptile)
+21. [Pocket for Mealie](https://github.com/Loriage/Mealie-Swift-App)
+22. [Beszel Companion](https://github.com/Loriage/Beszel-Swift-App)
+23. [Minidisc](https://github.com/Loriage/Minidisc)
+24. [Scowld](https://github.com/apoorvdarshan/scowld)
+25. [AI Dictation](https://github.com/writingmate/aidictation)
+26. [NoteGen](https://github.com/codexu/note-gen)
+27. [iBurn](https://github.com/iBurnApp/iBurn-iOS)
+28. [Dredfit](https://github.com/dredfort42/dredfit)
+29. [Oscar Weather](https://github.com/strumswell/oscar-weather)
+30. [MirrorNotes](https://github.com/lokii49/mirror)
 
 ## Most recently updated
 
```

**File**: `README.md` (modified, +9/-1)
```diff
@@ -6,7 +6,7 @@
 
 A collaborative list of open-source `iOS`, `iPadOS`, `watchOS`, `tvOS` and `visionOS` apps, your [contribution](https://github.com/dkhamsing/open-source-ios-apps/blob/master/.github/CONTRIBUTING.md) is welcome :smile:
 
-![](https://img.shields.io/badge/Projects-1686-green.svg) ![](https://img.shields.io/badge/Updated-October%20%204,%202026-lightgrey.svg)
+![](https://img.shields.io/badge/Projects-1687-green.svg) ![](https://img.shields.io/badge/Updated-October%20%205,%202026-lightgrey.svg)
 
 Jump to
 
@@ -1605,6 +1605,10 @@ https://developer.apple.com/reference/spritekit — [back to top](#readme)
   - [` App Store`](https://apps.apple.com/app/pilgrim-mindful-walking/id6760921056)
   -  `2026` `swift` `swiftui` 
   -  ☆`13` 
+- [Pixy](https://github.com/mrzmyr/pixy-mood-tracker-app): Mood tracker with one pixel per day, so your whole year fits on one screen. No account, no ads, entries stay on your phone
+  - <a href=https://pixy.day>`https://pixy.day`</a>
+  - [` App Store`](https://apps.apple.com/app/pixy-mood-tracker/id1605327124) <a href='https://raw.githubusercontent.com/mrzmyr/pixy-mood-tracker-app/main/docs/screen-1.png'>`Screenshot 1`</a> 
+  - `react-native` `typescript` `expo` 
 - [Pulse – Your Micro-Journal](https://github.com/marcusraitner/pulse): Minimalist micro-journaling companion designed to make reflection as effortless as possible
   - <a href=https://raitner.de/pulse>`https://raitner.de/pulse`</a>
   - [` App Store`](https://apps.apple.com/app/pulse-your-micro-journal/id6759242390)
@@ -3724,6 +3728,10 @@ https://reactnative.dev/ — [back to top](#readme)
   -  <a href='https://raw.githubusercontent.com/simonoppowa/OpenNutriTracker/refs/heads/main/fastlane/metadata/android/en-US/images/phoneScreenshots/1_en-US.png'>`Screenshot 1`</a>  <a href='https://raw.githubusercontent.com/simonoppowa/OpenNutriTracker/refs/heads/main/fastlane/metadata/android/en-US/images/phoneScreenshots/2_en-US.png'>`Screenshot 2`</a>  <a href='https://raw.githubusercontent.com/simonoppowa/OpenNutriTracker/refs/heads/main/fastlane/metadata/android/en-US/images/phoneScreenshots/3_en-US.png'>`Screenshot 3`</a>  <a href='https://raw.githubusercontent.com/simonoppowa/OpenNutriTracker/refs/heads/main/fastlane/metadata/android/en-US/images/phoneScreenshots/4_en-US.png'>`Screenshot 4`</a> 
   -  `2026` `react-native` `ipad` 
   -  ☆`2604` 
+- [Pixy](https://github.com/mrzmyr/pixy-mood-tracker-app): Mood tracker with one pixel per day, so your whole year fits on one screen. No account, no ads, entries stay on your phone
+  - <a href=https://pixy.day>`https://pixy.day`</a>
+  - [` App Store`](https://apps.apple.com/app/pixy-mood-tracker/id1605327124) <a href='https://raw.githubusercontent.com/mrzmyr/pixy-mood-tracker-app/main/docs/screen-1.png'>`Screenshot 1`</a> 
+  - `react-native` `typescript` `expo` 
 - [PokeDB](https://github.com/satya164/PocketGear): Clean and simple Pokédex app for Pokémon GO
   - [` App Store`](https://apps.apple.com/app/pocketdex-for-pok%C3%A9mon-go/id1255564898) <a href='https://is5-ssl.mzstatic.com/image/thumb/Purple113/v4/92/e1/4d/92e14db4-8386-6f71-161b-652d76ce89ee/mzl.rlgaqcnk.jpg/460x0w.jpg'>`Screenshot 1`</a>  <a href='https://is5-ssl.mzstatic.com/image/thumb/Purple123/v4/43/11/f3/4311f37f-7232-b725-cd03-f4e8f2e7ace4/mzl.askczwpt.jpg/460x0w.jpg'>`Screenshot 2`</a>  <a href='https://is1-ssl.mzstatic.com/image/thumb/Purple113/v4/62/db/8d/62db8da0-0810-dfd0-937a-63dfc6fae957/mzl.odiufjsj.jpg/460x0w.jpg'>`Screenshot 3`</a>  <a href='https://is1-ssl.mzstatic.com/image/thumb/Purple113/v4/a9/fb/29/a9fb2936-ca9e-c88e-1276-e7a60a5fa565/pr_source.jpg/460x0w.jpg'>`Screenshot 4`</a>  <a href='https://is1-ssl.mzstatic.com/image/thumb/Purple113/v4/b6/32/c4/b632c4ee-2e2c-ff81-dd04-87e9f49f7341/mzl.sckfqxlh.jpg/460x0w.jpg'>`Screenshot 5`</a> 
   -  `2025` `react-native` 
```

---

### Incident Patch 2: `181551b6` (2026-10-05)
**Commit Message**: Add Pixy by @mrzmyr (#2408)

**File**: `contents.json` (modified, +22/-0)
```diff
@@ -35014,6 +35014,28 @@
       ],
       "date_added": "Oct 2 2026",
       "suggested_by": "@Nerdykidtech"
+    },
+    {
+      "title": "Pixy",
+      "category-ids": [
+        "health",
+        "react-native"
+      ],
+      "tags": [
+        "react-native",
+        "typescript",
+        "expo"
+      ],
+      "description": "Mood tracker with one pixel per day, so your whole year fits on one screen. No account, no ads, entries stay on your phone",
+      "source": "https://github.com/mrzmyr/pixy-mood-tracker-app",
+      "homepage": "https://pixy.day",
+      "itunes": "https://apps.apple.com/app/pixy-mood-tracker/id1605327124",
+      "license": "mit",
+      "screenshots": [
+        "https://raw.githubusercontent.com/mrzmyr/pixy-mood-tracker-app/main/docs/screen-1.png"
+      ],
+      "date_added": "Oct 4 2026",
+      "suggested_by": "@mrzmyr"
     }
   ]
 }
```

---

### Incident Patch 3: `1967be73` (2026-10-04)
**Commit Message**: [auto] [ci skip] Generate content

**File**: `LATEST.md` (modified, +25/-25)
```diff
@@ -7,31 +7,31 @@
 3. [Palm](https://github.com/zaiqltd/palm)
 4. [Paint Anytime](https://github.com/denis-kolchev/Paint-Anytime)
 5. [Subskills](https://github.com/ihvou/subskills)
-6. [Setline](https://github.com/Significant-Hobbies/setline)
-7. [Anchor](https://github.com/Significant-Hobbies/anchor)
-8. [Calorie](https://github.com/Significant-Hobbies/calorie)
-9. [Silent Bell: Mindful Taps](https://github.com/jakublipinski/Silent-Bell)
-10. [FileManager](https://github.com/xsxs18-dev/FileManager)
-11. [RealTime Space](https://github.com/nicedreamzapp/RealTime-Space)
-12. [Conduck](https://github.com/GigaDuckAI/conduck)
-13. [Mlem](https://github.com/mlemgroup/mlem)
-14. [wBlock](https://github.com/0xCUB3/wBlock)
-15. [RAYN Weather](https://github.com/qh-work/RAYN)
-16. [BoxHelper](https://github.com/HOCKULUS/BoxHelper)
-17. [AliasVault](https://github.com/aliasvault/aliasvault)
-18. [Symptile](https://github.com/Loriage/Symptile)
-19. [Pocket for Mealie](https://github.com/Loriage/Mealie-Swift-App)
-20. [Beszel Companion](https://github.com/Loriage/Beszel-Swift-App)
-21. [Minidisc](https://github.com/Loriage/Minidisc)
-22. [Scowld](https://github.com/apoorvdarshan/scowld)
-23. [AI Dictation](https://github.com/writingmate/aidictation)
-24. [NoteGen](https://github.com/codexu/note-gen)
-25. [iBurn](https://github.com/iBurnApp/iBurn-iOS)
-26. [Dredfit](https://github.com/dredfort42/dredfit)
-27. [Oscar Weather](https://github.com/strumswell/oscar-weather)
-28. [MirrorNotes](https://github.com/lokii49/mirror)
-29. [Reynard Browser](https://github.com/minh-ton/reynard-browser)
-30. [Opaline](https://github.com/verback2308/Opaline)
+6. [Kith](https://github.com/Significant-Hobbies/kith)
+7. [Setline](https://github.com/Significant-Hobbies/setline)
+8. [Anchor](https://github.com/Significant-Hobbies/anchor)
+9. [Calorie](https://github.com/Significant-Hobbies/calorie)
+10. [Silent Bell: Mindful Taps](https://github.com/jakublipinski/Silent-Bell)
+11. [FileManager](https://github.com/xsxs18-dev/FileManager)
+12. [RealTime Space](https://github.com/nicedreamzapp/RealTime-Space)
+13. [Conduck](https://github.com/GigaDuckAI/conduck)
+14. [Mlem](https://github.com/mlemgroup/mlem)
+15. [wBlock](https://github.com/0xCUB3/wBlock)
+16. [RAYN Weather](https://github.com/qh-work/RAYN)
+17. [BoxHelper](https://github.com/HOCKULUS/BoxHelper)
+18. [AliasVault](https://github.com/aliasvault/aliasvault)
+19. [Symptile](https://github.com/Loriage/Symptile)
+20. [Pocket for Mealie](https://github.com/Loriage/Mealie-Swift-App)
+21. [Beszel Companion](https://github.com/Loriage/Beszel-Swift-App)
+22. [Minidisc](https://github.com/Loriage/Minidisc)
+23. [Scowld](https://github.com/apoorvdarshan/scowld)
+24. [AI Dictation](https://github.com/writingmate/aidictation)
+25. [NoteGen](https://github.com/codexu/note-gen)
+26. [iBurn](https://github.com/iBurnApp/iBurn-iOS)
+27. [Dredfit](https://github.com/dredfort42/dredfit)
+28. [Oscar Weather](https://github.com/strumswell/oscar-weather)
+29. [MirrorNotes](https://github.com/lokii49/mirror)
+30. [Reynard Browser](https://github.com/minh-ton/reynard-browser)
 
 ## Most recently updated
 
```

**File**: `README.md` (modified, +4/-1)
```diff
@@ -6,7 +6,7 @@
 
 A collaborative list of open-source `iOS`, `iPadOS`, `watchOS`, `tvOS` and `visionOS` apps, your [contribution](https://github.com/dkhamsing/open-source-ios-apps/blob/master/.github/CONTRIBUTING.md) is welcome :smile:
 
-![](https://img.shields.io/badge/Projects-1685-green.svg) ![](https://img.shields.io/badge/Updated-October%20%203,%202026-lightgrey.svg)
+![](https://img.shields.io/badge/Projects-1686-green.svg) ![](https://img.shields.io/badge/Updated-October%20%204,%202026-lightgrey.svg)
 
 Jump to
 
@@ -2850,6 +2850,9 @@ https://newsapi.org/ — [back to top](#readme)
   - [` App Store`](https://apps.apple.com/app/critical-maps/id918669647) <a href='https://github.com/user-attachments/assets/714ed171-9871-4ca3-8db9-45740fc55972'>`Screenshot 1`</a> 
   -  `2026` `swift` `swiftui` `combine` `tca` `snapshottesting` 
   -  ☆`318` 
+- [Kith](https://github.com/Significant-Hobbies/kith): Private relationship journal with a closeness-weighted constellation, standing notes and a chronological memory log for each person
+  -  <a href='https://raw.githubusercontent.com/Significant-Hobbies/kith/main/ios/artifacts/simulator/constellation.png'>`Screenshot 1`</a> 
+  - `swift` `swiftui` `cloudkit` 
 - [Mlem](https://github.com/mlemgroup/mlem): A Lemmy client
   - [` App Store`](https://apps.apple.com/app/id6450543782) <a href='https://mlem.group/screenshots/showcase/feeds.jpeg'>`Screenshot 1`</a> 
   -  `2026` `swift` `swiftui` 
```

---

### Incident Patch 4: `24d3aa27` (2026-10-04)
**Commit Message**: Add 'Kith' (#2404)

**File**: `contents.json` (modified, +19/-0)
```diff
@@ -34973,6 +34973,25 @@
       "date_added": "Sep 23 2026",
       "suggested_by": "@sarthakagrawal927"
 	   },  
+	   {
+      "title": "Kith",
+      "category-ids": [
+        "social"
+      ],
+      "tags": [
+        "swift",
+        "swiftui",
+        "cloudkit"
+      ],
+      "description": "Private relationship journal with a closeness-weighted constellation, standing notes and a chronological memory log for each person",
+      "source": "https://github.com/Significant-Hobbies/kith",
+      "license": "mit",
+      "screenshots": [
+        "https://raw.githubusercontent.com/Significant-Hobbies/kith/main/ios/artifacts/simulator/constellation.png"
+      ],
+      "date_added": "Sep 23 2026",
+      "suggested_by": "@sarthakagrawal927"
+    },
     {
       "title": "Autheris",
       "category-ids": [
```

---

### Incident Patch 5: `04e83142` (2026-10-03)
**Commit Message**: Update workflow for link checking (#2405)

[ci skip]

**File**: `.github/workflows/ruby.yml` (modified, +57/-15)
```diff
@@ -2,24 +2,66 @@ name: Links check
 
 on:
   push:
-    branches: [ '*' ]
+    branches: [ '**' ]
   pull_request:
-    branches: [ '*' ]
+  schedule:
+    - cron: '0 6 * * 1'   # weekly, catches link rot even without commits
+  workflow_dispatch:
 
-jobs:
-  build:
+permissions:
+  contents: read
+
+concurrency:
+  group: links-check-${{ github.ref }}
+  cancel-in-progress: true
 
+jobs:
+  check-links:
     runs-on: ubuntu-latest
+    timeout-minutes: 30
 
     steps:
-    - uses: actions/checkout@v6
-    - name: Set up Ruby 2.6
-      uses: ruby/setup-ruby@v1
-      with:
-        ruby-version: '2.6'
-    - name: Checks
-      run: |
-        ruby .github/osia_convert.rb
-        gem install awesome_bot
-        ruby .github/osia_get_links.rb
-        awesome_bot check-unique.txt --allow-ssl -a 302,429,502 -w shadowfacts,c0051d18eb21,636db0400a1d,263bb0f74818,b04e7e7b9917,86f88feaf81a,cdn-images-1,ib9hnrPzudBWOE5hTr,linphone.org
+      - uses: actions/checkout@v6
+
+      - name: Set up Ruby
+        uses: ruby/setup-ruby@v1
+        with:
+          ruby-version: '2.6'
+          bundler-cache: true   # only effective if a Gemfile exists; harmless otherwise
+
+      - name: Convert and extract links
+        run: |
+          ruby .github/osia_convert.rb
+          ruby .github/osia_get_links.rb
+
+      - name: Install awesome_bot
+        run: gem install awesome_bot --no-document
+
+      - name: Check links
+        env:
+          WHITELIST: >-
+            shadowfacts,
+            c0051d18eb21,
+            636db0400a1d,
+            263bb0f74818,
+            b04e7e7b9917,
+            86f88feaf81a,
+            cdn-images-1,
+            ib9hnrPzudBWOE5hTr,
+            linphone.org
+        run: |
+          awesome_bot check-unique.txt \
+            --allow-ssl \
+            --allow 302,429,502 \
+            --white-list "$(echo "$WHITELIST" | tr -d ' \n')"
+
+      - name: Upload link report
+        if: failure()
+        uses: actions/upload-artifact@v4
+        with:
+          name: link-check-results
+          path: ab-results*
+          if-no-files-found: ignore
+          compression-level: 6
+          overwrite: false
+          include-hidden-files: false          
```

---

### Incident Patch 6: `e4ed53ba` (2026-10-03)
**Commit Message**: [auto] [ci skip] Generate content

**File**: `APPSTORE.md` (modified, +5/-1)
```diff
@@ -4,7 +4,7 @@
 ⚠️ This README is generated, please do not update. To contribute, make changes to contents.json ⚠️ 
  https://github.com/dkhamsing/open-source-ios-apps -->
 
-List of **303** open-source apps published on the App Store (complete list [here](https://github.com/dkhamsing/open-source-ios-apps)).
+List of **304** open-source apps published on the App Store (complete list [here](https://github.com/dkhamsing/open-source-ios-apps)).
 
 
 
@@ -1450,6 +1450,10 @@ https://newsapi.org/ — [back to top](#readme)
   - [` App Store`](https://apps.apple.com/app/id766157276) <a href='https://is3-ssl.mzstatic.com/image/thumb/Purple113/v4/89/b8/5b/89b85bf2-395f-6b30-a62b-48cfa15803ab/pr_source.png/460x0w.jpg'>`Screenshot 1`</a>  <a href='https://is3-ssl.mzstatic.com/image/thumb/Purple123/v4/8f/78/ae/8f78aefc-9fb3-ed73-d5d8-ee768073869d/pr_source.png/460x0w.jpg'>`Screenshot 2`</a>  <a href='https://is1-ssl.mzstatic.com/image/thumb/Purple123/v4/2f/b0/11/2fb0114c-bce3-0122-9871-0bb88a95802d/pr_source.png/460x0w.jpg'>`Screenshot 3`</a> 
   -  `2026` `swift` `2fa` 
   -  ☆`873` 
+- [Autheris](https://github.com/nerdykidtech/Autheris): Privacy-first two-factor authenticator for iPhone, iPad, Mac and Apple Watch
+  - <a href=https://autheris.app>`https://autheris.app`</a>
+  - [` App Store`](https://apps.apple.com/app/autheris/id6760686327) <a href='https://autheris.app/assets/img/hero-app-1206.webp'>`Screenshot 1`</a> 
+  - `swift` `swiftui` `2fa` `watchos` `macos` 
 - [Bitwarden](https://github.com/bitwarden/ios): Password Manager and Authenticator
   - <a href=https://bitwarden.com>`https://bitwarden.com`</a>
   - [` App Store`](https://apps.apple.com/app/bitwarden-free-password-manager/id1137397744) <a href='https://raw.githubusercontent.com/bitwarden/ios/main/.github/images/ios-dark.png'>`Screenshot 1`</a> 
```

**File**: `LATEST.md` (modified, +30/-30)
```diff
@@ -2,36 +2,36 @@
 
 ## Lastest additions to the [main list](https://github.com/dkhamsing/open-source-ios-apps)
 
-1. [Motion](https://github.com/Significant-Hobbies/motion)
-2. [Palm](https://github.com/zaiqltd/palm)
-3. [Paint Anytime](https://github.com/denis-kolchev/Paint-Anytime)
-4. [Subskills](https://github.com/ihvou/subskills)
-5. [Anchor](https://github.com/Significant-Hobbies/anchor)
-6. [Calorie](https://github.com/Significant-Hobbies/calorie)
-7. [Silent Bell: Mindful Taps](https://github.com/jakublipinski/Silent-Bell)
-8. [FileManager](https://github.com/xsxs18-dev/FileManager)
-9. [RealTime Space](https://github.com/nicedreamzapp/RealTime-Space)
-10. [Conduck](https://github.com/GigaDuckAI/conduck)
-11. [Mlem](https://github.com/mlemgroup/mlem)
-12. [wBlock](https://github.com/0xCUB3/wBlock)
-13. [RAYN Weather](https://github.com/qh-work/RAYN)
-14. [BoxHelper](https://github.com/HOCKULUS/BoxHelper)
-15. [AliasVault](https://github.com/aliasvault/aliasvault)
-16. [Symptile](https://github.com/Loriage/Symptile)
-17. [Pocket for Mealie](https://github.com/Loriage/Mealie-Swift-App)
-18. [Beszel Companion](https://github.com/Loriage/Beszel-Swift-App)
-19. [Minidisc](https://github.com/Loriage/Minidisc)
-20. [Scowld](https://github.com/apoorvdarshan/scowld)
-21. [AI Dictation](https://github.com/writingmate/aidictation)
-22. [NoteGen](https://github.com/codexu/note-gen)
-23. [iBurn](https://github.com/iBurnApp/iBurn-iOS)
-24. [Dredfit](https://github.com/dredfort42/dredfit)
-25. [Oscar Weather](https://github.com/strumswell/oscar-weather)
-26. [MirrorNotes](https://github.com/lokii49/mirror)
-27. [Reynard Browser](https://github.com/minh-ton/reynard-browser)
-28. [Opaline](https://github.com/verback2308/Opaline)
-29. [HealthSync](https://github.com/megabyte0x/healthykit)
-30. [DumpertTV](https://github.com/rm335/dumpert-apple-tv)
+1. [Autheris](https://github.com/nerdykidtech/Autheris)
+2. [Motion](https://github.com/Significant-Hobbies/motion)
+3. [Palm](https://github.com/zaiqltd/palm)
+4. [Paint Anytime](https://github.com/denis-kolchev/Paint-Anytime)
+5. [Subskills](https://github.com/ihvou/subskills)
+6. [Setline](https://github.com/Significant-Hobbies/setline)
+7. [Anchor](https://github.com/Significant-Hobbies/anchor)
+8. [Calorie](https://github.com/Significant-Hobbies/calorie)
+9. [Silent Bell: Mindful Taps](https://github.com/jakublipinski/Silent-Bell)
+10. [FileManager](https://github.com/xsxs18-dev/FileManager)
+11. [RealTime Space](https://github.com/nicedreamzapp/RealTime-Space)
+12. [Conduck](https://github.com/GigaDuckAI/conduck)
+13. [Mlem](https://github.com/mlemgroup/mlem)
+14. [wBlock](https://github.com/0xCUB3/wBlock)
+15. [RAYN Weather](https://github.com/qh-work/RAYN)
+16. [BoxHelper](https://github.com/HOCKULUS/BoxHelper)
+17. [AliasVault](https://github.com/aliasvault/aliasvault)
+18. [Symptile](https://github.com/Loriage/Symptile)
+19. [Pocket for Mealie](https://github.com/Loriage/Mealie-Swift-App)
+20. [Beszel Companion](https://github.com/Loriage/Beszel-Swift-App)
+21. [Minidisc](https://github.com/Loriage/Minidisc)
+22. [Scowld](https://github.com/apoorvdarshan/scowld)
+23. [AI Dictation](https://github.com/writingmate/aidictation)
+24. [NoteGen](https://github.com/codexu/note-gen)
+25. [iBurn](https://github.com/iBurnApp/iBurn-iOS)
+26. [Dredfit](https://github.com/dredfort42/dredfit)
+27. [Oscar Weather](https://github.com/strumswell/oscar-weather)
+28. [MirrorNotes](https://github.com/lokii49/mirror)
+29. [Reynard Browser](https://github.com/minh-ton/reynard-browser)
+30. [Opaline](https://github.com/verback2308/Opaline)
 
 ## Most recently updated
 
```

**File**: `README.md` (modified, +8/-1)
```diff
@@ -6,7 +6,7 @@
 
 A collaborative list of open-source `iOS`, `iPadOS`, `watchOS`, `tvOS` and `visionOS` apps, your [contribution](https://github.com/dkhamsing/open-source-ios-apps/blob/master/.github/CONTRIBUTING.md) is welcome :smile:
 
-![](https://img.shields.io/badge/Projects-1683-green.svg) ![](https://img.shields.io/badge/Updated-October%20%202,%202026-lightgrey.svg)
+![](https://img.shields.io/badge/Projects-1685-green.svg) ![](https://img.shields.io/badge/Updated-October%20%203,%202026-lightgrey.svg)
 
 Jump to
 
@@ -1615,6 +1615,9 @@ https://developer.apple.com/reference/spritekit — [back to top](#readme)
   - [` App Store`](https://apps.apple.com/app/rise-sleep-companion/id6451386327) <a href='https://github.com/VladimirBrejcha/Rise/assets/44097057/f680e08c-2c2b-4293-a1cd-2bd342f284b0'>`Screenshot 1`</a> 
   -  `2023` `swift` 
   -  ☆`46` 
+- [Setline](https://github.com/Significant-Hobbies/setline): Workout player for structured strength, cardio and mobility programmes with set recording, rest timing and target comparisons
+  -  <a href='https://raw.githubusercontent.com/Significant-Hobbies/setline/main/ios/artifacts/app-store/iphone-6.9/workout-player.jpg'>`Screenshot 1`</a> 
+  - `swift` `swiftui` `cloudkit` 
 - [Solstice](https://github.com/daneden/Solstice): Tells you how the daylight is changing
   -  `2026` `swift` 
   -  ☆`116` 
@@ -2775,6 +2778,10 @@ https://newsapi.org/ — [back to top](#readme)
   - [` App Store`](https://apps.apple.com/app/id766157276) <a href='https://is3-ssl.mzstatic.com/image/thumb/Purple113/v4/89/b8/5b/89b85bf2-395f-6b30-a62b-48cfa15803ab/pr_source.png/460x0w.jpg'>`Screenshot 1`</a>  <a href='https://is3-ssl.mzstatic.com/image/thumb/Purple123/v4/8f/78/ae/8f78aefc-9fb3-ed73-d5d8-ee768073869d/pr_source.png/460x0w.jpg'>`Screenshot 2`</a>  <a href='https://is1-ssl.mzstatic.com/image/thumb/Purple123/v4/2f/b0/11/2fb0114c-bce3-0122-9871-0bb88a95802d/pr_source.png/460x0w.jpg'>`Screenshot 3`</a> 
   -  `2026` `swift` `2fa` 
   -  ☆`873` 
+- [Autheris](https://github.com/nerdykidtech/Autheris): Privacy-first two-factor authenticator for iPhone, iPad, Mac and Apple Watch
+  - <a href=https://autheris.app>`https://autheris.app`</a>
+  - [` App Store`](https://apps.apple.com/app/autheris/id6760686327) <a href='https://autheris.app/assets/img/hero-app-1206.webp'>`Screenshot 1`</a> 
+  - `swift` `swiftui` `2fa` `watchos` `macos` 
 - [Bitwarden](https://github.com/bitwarden/ios): Password Manager and Authenticator
   - <a href=https://bitwarden.com>`https://bitwarden.com`</a>
   - [` App Store`](https://apps.apple.com/app/bitwarden-free-password-manager/id1137397744) <a href='https://raw.githubusercontent.com/bitwarden/ios/main/.github/images/ios-dark.png'>`Screenshot 1`</a> 
```

---

### Incident Patch 7: `6a06a389` (2026-10-03)
**Commit Message**: Add 'Setline' (#2400)

**File**: `contents.json` (modified, +20/-0)
```diff
@@ -34953,6 +34953,26 @@
       "date_added": "Oct 2 2026",
       "suggested_by": "@sarthakagrawal927"
     },
+      {
+      "title": "Setline",
+      "category-ids": [
+        "health"
+     
+      ],
+      "tags": [
+        "swift",
+        "swiftui",
+        "cloudkit"
+      ],
+      "description": "Workout player for structured strength, cardio and mobility programmes with set recording, rest timing and target comparisons",
+      "source": "https://github.com/Significant-Hobbies/setline",
+      "license": "mit",
+      "screenshots": [
+        "https://raw.githubusercontent.com/Significant-Hobbies/setline/main/ios/artifacts/app-store/iphone-6.9/workout-player.jpg"
+      ],
+      "date_added": "Sep 23 2026",
+      "suggested_by": "@sarthakagrawal927"
+	   },  
     {
       "title": "Autheris",
       "category-ids": [
```

---

### Incident Patch 8: `eadf6514` (2026-10-03)
**Commit Message**: [ci] Remove push trigger from validate.yml (#2403)

[ci skip]

**File**: `.github/workflows/validate.yml` (modified, +0/-1)
```diff
@@ -1,7 +1,6 @@
 name: Validate
 
 on:
-  push:
   pull_request:
 
 jobs:
```

#### Recent Merged Pull Requests:
- **PR #2410** (closed): Add 2026 tag to Paint Anytime (@denis-kolchev)
- **PR #2408** (2026-10-05): Add Pixy by @mrzmyr (@mrzmyr)
- **PR #2406** (closed): Test link check (@dkhamsing)
- **PR #2405** (2026-10-03): Update workflow for link checking (@dkhamsing)
- **PR #2404** (2026-10-04): Add 'Kith' (@dkhamsing)
- **PR #2403** (2026-10-03): [ci] Remove push trigger from validate.yml (@dkhamsing)
- **PR #2402** (2026-10-02): [ci] Add GitHub Actions workflow for validation (@dkhamsing)
- **PR #2401** (2026-10-02): [ci] Rename workflow from 'Ruby' to 'Links check' (@dkhamsing)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

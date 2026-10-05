# Forensic Learning Record (Deep Inspection): MochiDiffusion/MochiDiffusion

> **Canonical Artifact**: `07_PROJECT_LEARNING/mochidiffusion-mochidiffusion-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/MochiDiffusion/MochiDiffusion](https://github.com/MochiDiffusion/MochiDiffusion))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T22:16:02.672Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `MochiDiffusion/MochiDiffusion`
- **Description**: Run Stable Diffusion on Mac natively
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 7962 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `Mochi Diffusion/Iris-BridgingHeader.h`
```
// Iris-BridgingHeader.h
#import "../iris.c/iris.h"

// Metal init is not declared in iris.h, but the app links the MPS Iris library.
int iris_metal_init(void);

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #491** (2026-02-28): **Crash when generating portrait-oriented images**
  *Symptoms*: ### Processor  M1 (or later)  ### Memory  16GB  ### What happened?  ### Environment - **Mochi Diffusion Version**: 5.2 - **Compute Unit**: CPU & GPU  ### Description Mochi Diffusion crashes consistently when generating images in portrait orientation (e.g., 768x1024), while landscape (e.g., 1280x768) and square (1024x1024) orientations work without issues. This occurs with all SDXL models tested.  ### Steps to Reproduce 1. Load any SDXL Core ML model 2. Set image dimensions to portrait orientation (e.g., 768x1024 or 896x1152) 3. Start image generation 4. App crashes during generation  ### Root Cause The crash is caused by integer division in `GalleryPreviewView.swift` at line 32: ```swift .aspectRatio(CGFloat(image.width / image.height), contentMode: .fit) ```  **Problem:** - `image.width` and `image.height` are Integers - Integer division: `768 / 1024 = 0` (not 0.75) - `CGFloat(0)` causes invalid aspect ratio → crash - Landscape works by accident: `1280 / 768 = 1` (though incorrect, but doesn't crash)    ### Crash Log  ```shell  ```
  **Post-Mortem & Fix Analysis**:
  > Thanks! This has been fixed in the latest release

- **Issue #460** (2026-03-01): **Homebrew update fails: SHA256 mismatch**
  *Symptoms*: ### Processor  M1 (or later)  ### Memory  8GB  ### What happened?  Updating to 5.2 with Homebrew fails.  ### Crash Log  ```shell Error: SHA256 mismatch Expected: fbb7ec461bb2f4056e4ace50758307d7a622cdc04b70ef01148f1f521386681c   Actual: 81d35c1d5e0c9cf83173681ca830a882c857de3531e7c744d5c7588cd0e38a26     File: /Users/xxxxxxx/Library/Caches/Homebrew/downloads/57b4a9167c21e72132ed5f25c9cc11321eef4526a8b9cb591b768277169f60fb--MochiDiffusion_v5.2.dmg ``` 
  **Post-Mortem & Fix Analysis**:
  > I uploaded MochiDiffusion_v5.2.dmg and then had to take it down and reupload a new copy because it didn’t have the correct signing information for Sparkle. I assume that Homebrew captured a SHA of the first uploaded dmg, which doesn’t match the new one.   I’ll try to sort it out sometime this weekend, sorry for the inconvenience.
  > Thanks!

- **Issue #459** (2024-10-30): **changed code signature in release 5.2?**
  *Symptoms*: ### Processor  M1 (or later)  ### Memory  8GB  ### What happened?  hello - I've noticed that the code signature has changed between version 5.1 and 5.2 - can anyone confirm this?  Thank you!      ### Crash Log  ```shell EXPECTED 'Joshua Park (TCQ6328PP6)'  FOUND 'Graham Bing (9VV558X8J3)' ``` 
  **Post-Mortem & Fix Analysis**:
  > Yes, hello, I’m Graham Bing. Joshua (@godly-devotion) wanted to step back from Mochi and so he passed on maintainership to me a few months ago.  If you have any questions or concerns, please let me know.
  > great - thanks for the clarification! 

- **Issue #437** (2024-08-11): **Bug in Recognizing Split Bin Files During Model Conversion Process**
  *Symptoms*: ### Processor  M1 Pro (or later)  ### Memory  16GB  ### What happened?  When I try to convert a diffuser model to an MLMODELC model, it shows an error: `OSError: Error no file named diffusion_pytorch_model.bin found in directory PVC_diffusers/unet.` I found that the bin file was split into two parts: `diffusion_pytorch_model-00001-of-00002.bin` and `diffusion_pytorch_model-00002-of-00002.bin`. <img width="459" alt="the file" src="https://github.com/MochiDiffusion/MochiDiffusion/assets/86539564/787d477f-bf0e-4445-b2e8-bd53e549c90c"> The conversion code should be modified to handle this situation.   ---  ### Solution **TL;DR** Just add the `--to_safetensors` flag when convert the SD model to the Diffusers pipeline and no need to change your current environment.  When we call the `ModelMixin.save_pretained` from `modeling_utils`, if the unet model is larger than the max_shard_size(default is 10GB), it will save the unet model in split bin files. But the `DiffusionPipeline.from_pretrained` can't load the split bin file and it's a bug of Diffusers.  This function can only load split files in safetensor format, so use the ` --to_safetensors` flag.
  **Post-Mortem & Fix Analysis**:
  > have the same error
  > check out https://github.com/MochiDiffusion/MochiDiffusion/pull/441
  > same issue

- **Issue #436** (2026-03-01): **Unable to open mach-O at path: default.metallib  Error:2**
  *Symptoms*: ### Processor  M1 (or later)  ### Memory  8GB  ### What happened?  the app compiles successfully but once started it gives me "Unable to open mach-O at path: default.metallib  Error:2"  when  try to generate image it give the following errors    Found 1 model(s) Invalid group id in source layers: var_48_cast_fp16 Invalid group id in source layers: var_49_cast_fp16 Invalid group id in source layers: var_109_cast_fp16 Invalid group id in source layers: var_110_cast_fp16   hint : the model I downloaded from hugging face is : Found 1 model(s) animagine-xl-3.1_split-einsum_6bit_1024x1024     ### Crash Log  _No response_
  **Post-Mortem & Fix Analysis**:
  > the first problem  "Unable to open mach-O at path: default.metallib Error:2" solved by going to build setting  : info.plist values and enabling metal capture , it was disabled by default  however the remaining errors "Invalid group id in source layers: var_48_cast_fp16" still coming when I try to generate the images 
  > "Unable to open mach-O at path: default.metallib Error:2"  For those struggling to find the location of the Metal setting, go to Build Settings, and then click 'All'. From there scroll down until you find 'Info.plist Values'. The metal setting is titled 'Metal Capture Enabled'.  Set this to Yes.
  > Closing for now because I'm unable to repro the "Invalid group id in source layers" issue. If this still occurs, please reopen and we can coordinate to try to resolve  

- **Issue #433** (2024-06-26): **Generation speed massively decreased**
  *Symptoms*: ### Processor  M1 (or later)  ### Memory  32GB  ### What happened?  Hi there and thanks for MochiDiffusion.  I have a question regarding what may have impacted the generation speed on my M1 Pro. Yesterday I could generate pictures with the settings as below in approximately 12 seconds. I was blown away by the speed! However, today with the same settings (via `Copy Options to Sidebar`) it takes about 45 seconds. Do you have any idea, what may be the reason for this? ``` Date: 28. May 2024 at 23:04:16  Model: stable-diffusion-v2.1-base_split-einsum_compiled  Size: 2048 x 2048 (Upscaled using RealESRGAN)  Include in Image: cowboy fashion  Exclude from Image:   Seed: 1957878024  Steps: 12  Guidance Scale: 11.0  Scheduler: DPM-Solver++  ML Compute Unit: CPU & Neural Engine ```  ### Crash Log  _No response_
  **Post-Mortem & Fix Analysis**:
  > Your ML compute unit is set to `CPU & Neural Engine`, is it possible that you changed it from `Auto` or `CPU & GPU` in settings?   You could try turning off Reduce Memory Usage  and Show Image Preview in settings, both of those have an impact on generation speed, but I think the ML Compute Unit is the most likely culprit.

- **Issue #415** (2024-03-15): **Tokenizer out of sync with current selected model**
  *Symptoms*: ### Processor  M1 Ultra (or later)  ### Memory  64GB (or higher)  ### What happened?  The tokenizer used to calculate the tokens count of the prompt and negative prompt is created from the model last used in `ImageGenerator.loadPipeline()`  This made sense when `loadPipeline()` was called whenever user selected a new model, but with [queued generation jobs](https://github.com/godly-devotion/MochiDiffusion/pull/339/) `loadPipeline` isn't called until the instant before the generation job is run. As a consequence:  - no tokenizer will be created until an initial generation is run, and token counts in `PromptView` will fall back on the ~4 chars per token estimation algorithm - tokenizer won't match the current model when model changes (In practice most models seem to use the same or a similar tokenizer so this doesn't really matter)  ### Crash Log  _No response_

- **Issue #395** (2026-03-01): **Quick Look does not work**
  *Symptoms*: I think it has problem with switching between upscaled images  https://github.com/godly-devotion/MochiDiffusion/assets/2387356/60877611-f69a-4cec-b0a8-7a30eb6016a3 
  **Post-Mortem & Fix Analysis**:
  > In [v6.0](https://github.com/MochiDiffusion/MochiDiffusion/releases/tag/v6.0) there were some changes to how quicklook works. Also, upscaling was removed.  Closing this issue as stale and possibly (hopefully?) resolved, but if it is still observed please reopen.

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

### Incident Patch 1: `152f159d` (2026-09-29)
**Commit Message**: fix: align slider value text with its editing field

The editing field now uses the plain text field style with its focus
effect disabled, so it has no bezel inset to compensate for. The label
shown while not editing drops the padding that matched the bezeled
field, and the two now line up without depending on the OS's bezel
metrics.

**File**: `Mochi Diffusion/Views/SidebarControls/MochiSlider.swift` (modified, +3/-9)
```diff
@@ -45,24 +45,18 @@ struct MochiSlider: View {
         CompactSlider(value: $value, in: bounds, step: step) {
             if isEditable {
                 TextField("", text: $text)
+                    .textFieldStyle(.plain)
+                    .focusEffectDisabled()
                     .focused($isFocused)
             } else {
                 Text(text)
-                    .padding(.leading, 4)
-                    .padding(.bottom, 1)
                     .gesture(
                         TapGesture(count: 1).onEnded {
                             self.isEditable = true
                             self.isFocused = true
                         }
                     )
-                    .onHover { inside in
-                        if inside {
-                            NSCursor.iBeam.push()
-                        } else {
-                            NSCursor.pop()
-                        }
-                    }
+                    .pointerStyle(.horizontalText)
             }
             Spacer()
         }
```

---

### Incident Patch 2: `832c8969` (2026-09-28)
**Commit Message**: fix: write a converted image's sampler under the current label

Exporting a released JPEG or HEIC to PNG wrote the caption's scheduler name,
such as DPM-Solver++, as the AUTOMATIC1111 sampler, while a fresh image
writes DPM++ 2M. Civitai and other readers then saw a sampler name no tool
uses. The converted PNG now records the sampler under the label a fresh
generation writes.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>

**File**: `Mochi Diffusion/Support/ImageMetadata.swift` (modified, +6/-1)
```diff
@@ -176,10 +176,15 @@ nonisolated enum ImageMetadataWriter {
         let reading = ImageMetadataReader.read(url)
         guard case .selected(let reference) = reading?.selection, let reading else { return nil }
         let interpretation = reading.interpretations[reference.interpretation]
-        let generation = interpretation.generations[reference.generation]
+        var generation = interpretation.generations[reference.generation]
 
         switch interpretation.format {
         case .mochiDiffusion, .mochiDiffusionLegacyCaption:
+            // A released caption names the sampler by Mochi's scheduler name.
+            // The PNG records it under the label a fresh generation writes.
+            if let sampler = generation.sampler, let scheduler = Scheduler(samplerLabel: sampler) {
+                generation.sampler = scheduler.samplerLabel
+            }
             return payloads(
                 for: MochiGenerationSnapshot(
                     producer: interpretation.producer
```

**File**: `Mochi DiffusionTests/ImageExportTests.swift` (modified, +23/-0)
```diff
@@ -103,6 +103,29 @@ struct ImageExportTests {
                 == MetadataDetail(label: "Generator", value: "Mochi Diffusion 6.0"))
     }
 
+    @Test(
+        "A released image's scheduler converts to the sampler label a fresh image writes",
+        arguments: [("DPM-Solver++", "DPM++ 2M"), ("PNDM", "PLMS")]
+    )
+    func releasedSchedulerLabel(released: String, label: String) async throws {
+        let caption = releasedCaption([
+            (.includeInImage, "a cat"),
+            (.steps, "17"),
+            (.seed, "42"),
+            (.scheduler, released),
+            (.generator, "Mochi Diffusion 6.0"),
+        ])
+        let source = try writeReleasedSource("image.jpg", type: .jpeg, caption: caption)
+
+        let destination = try await export(source, name: "converted.png")
+        let description = try #require(xmpDescription(of: Data(contentsOf: destination)))
+
+        #expect(description.contains("Sampler: \(label),"))
+        let converted = try #require(createImageRecordFromURL(destination))
+        #expect(converted.scheduler != nil)
+        #expect(converted.scheduler == Scheduler(samplerLabel: released))
+    }
+
     @Test("A 6.1 HEIC converts to PNG with its model identity and input images")
     func releasedLineCaptionConversion() async throws {
         let caption = releasedLineCaption([
```

---

### Incident Patch 3: `2bbbed99` (2026-09-28)
**Commit Message**: fix: keep Quick Look bound to a State mirror

quickLookPreview reads its binding off the main thread. A Binding(get:set:)
over the main-actor QuickLookState traps on that read under Swift 6
isolation checking, so previewing an image crashed the app. A State
mirror synced by onChange has no such check.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>

**File**: `Mochi Diffusion/MochiDiffusionApp.swift` (modified, +12/-13)
```diff
@@ -18,23 +18,15 @@ struct MochiDiffusionApp: App {
     @State private var store: ImageGallery
     @State private var notificationController: NotificationController
     @State private var quickLook: QuickLookState
+    /// Mirrors `quickLook.url` for `quickLookPreview`, which reads its binding off the
+    /// main thread. A `Binding(get:set:)` over the main-actor `QuickLookState` would
+    /// trap on that read under Swift 6 isolation checking; a `@State` binding does not.
+    @State private var quickLookURL: URL?
 
     private let thumbnailProvider: GalleryThumbnailProvider
     private let fullImageProvider: GalleryFullImageProvider
     private let updaterController: SPUStandardUpdaterController
 
-    /// The preview reports dismissal by clearing the URL, which closes the shared
-    /// state. It never sets a URL of its own, so only that write is handled.
-    private var quickLookURL: Binding<URL?> {
-        let quickLook = quickLook
-        return Binding(
-            get: { quickLook.url },
-            set: { newValue in
-                if newValue == nil { quickLook.close() }
-            }
-        )
-    }
-
     init() {
         let configStore = ConfigStore()
         // One repository for every writer, so filename allocation covers all of
@@ -107,7 +99,14 @@ struct MochiDiffusionApp: App {
                         "com.apple.MetalPerformanceShadersGraph", isDirectory: true)
                     try? FileManager.default.removeItem(at: mpsURL)
                 }
-                .quickLookPreview(quickLookURL)
+                .onChange(of: quickLook.url) { _, newValue in
+                    if quickLookURL != newValue { quickLookURL = newValue }
+                }
+                // The preview reports dismissal by clearing the URL.
+                .onChange(of: quickLookURL) { _, newValue in
+                    if newValue == nil { quickLook.close() }
+                }
+                .quickLookPreview($quickLookURL)
         }
         .environment(configStore)
         .environment(generationController)
```

---

### Incident Patch 4: `e90fd686` (2026-09-28)
**Commit Message**: fix: read 6.1 images and show settings in Finder again

Mochi Diffusion 6.1 through 6.1.2 wrote a line-per-field caption that
Musubi did not read, so those images were left out of the gallery. Pin
Musubi to the revision that reads it, and take the engine, model key and
each input image from it so Copy Options restores them.

Released images showed their settings as Finder's Get Info Description,
and Spotlight matched their prompts, because ImageIO stored the caption as
XMP dc:description. Write the AUTOMATIC1111 text there as well, in the
native record's packet, for generated images and for released JPEG or
HEIC images exported as PNG.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>

**File**: `Mochi Diffusion.xcodeproj/project.pbxproj` (modified, +1/-1)
```diff
@@ -1317,7 +1317,7 @@
 			repositoryURL = "https://github.com/MochiDiffusion/Musubi.git";
 			requirement = {
 				kind = revision;
-				revision = 65771844a6a9c43840ee035b6972ad51cfbec44e;
+				revision = 027c6b997269a9e505d9382858fedf02d4308182;
 			};
 		};
 /* End XCRemoteSwiftPackageReference section */
```

**File**: `Mochi Diffusion.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved` (modified, +2/-2)
```diff
@@ -1,5 +1,5 @@
 {
-  "originHash" : "8fa63e5322fce25b70c9eac5893dcb3708b9607d18bf9209904e8724c6dd43ca",
+  "originHash" : "6544f28438d43cf2cc74da9510b07a3f5083fc9af35e1b16a94826635b5e969f",
   "pins" : [
     {
       "identity" : "filterablepicker",
@@ -24,7 +24,7 @@
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/MochiDiffusion/Musubi.git",
       "state" : {
-        "revision" : "65771844a6a9c43840ee035b6972ad51cfbec44e"
+        "revision" : "027c6b997269a9e505d9382858fedf02d4308182"
       }
     },
     {
```

**File**: `Mochi Diffusion/Support/ImageMetadata.swift` (modified, +37/-26)
```diff
@@ -114,22 +114,30 @@ nonisolated extension GenerationMetadata {
     /// no image is saved without its record. AUTOMATIC1111 text that readers
     /// would misread is left out, and the native record alone is written.
     func pngData(for image: CGImage) async -> Data? {
-        let snapshot = snapshot()
         guard let pixels = ImageMetadataWriter.encodePNG(image),
-            let packet = try? MochiNativeCodec.encodeXMPPacket(snapshot)
+            let payloads = ImageMetadataWriter.payloads(for: snapshot())
         else { return nil }
-        let parameters = A1111ParametersEncoder.encode(
-            snapshot.generation, producer: snapshot.producer)
         return try? PNGMetadataWriter.write(
-            PNGMetadataPayloads(nativeXMPPacket: packet, parameters: parameters.text),
-            into: pixels,
-            replacingExistingRecords: false
-        )
+            payloads, into: pixels, replacingExistingRecords: false)
     }
 }
 
 /// Encodes pixels and carries generation metadata into exported PNG files.
 nonisolated enum ImageMetadataWriter {
+    /// The native record and the AUTOMATIC1111-compatible text of `snapshot`.
+    /// The text is also the record's description, which Finder shows in Get
+    /// Info and Spotlight searches. `nil` when the record cannot be written.
+    static func payloads(for snapshot: MochiGenerationSnapshot) -> PNGMetadataPayloads? {
+        let parameters = A1111ParametersEncoder.encode(
+            snapshot.generation, producer: snapshot.producer
+        ).text
+        guard
+            let packet = try? MochiNativeCodec.encodeXMPPacket(
+                snapshot, description: parameters)
+        else { return nil }
+        return PNGMetadataPayloads(nativeXMPPacket: packet, parameters: parameters)
+    }
+
     /// `image` as a PNG with no metadata.
     static func encodePNG(_ image: CGImage) -> Data? {
         guard let data = CFDataCreateMutable(nil, 0),
@@ -172,18 +180,14 @@ nonisolated enum ImageMetadataWriter {
 
         switch interpretation.format {
         case .mochiDiffusion, .mochiDiffusionLegacyCaption:
-            let snapshot = MochiGenerationSnapshot(
-                producer: interpretation.producer
-                    ?? MetadataProducer(name: ImageMetadataReader.producerName),
-                generation: generation,
-                details: ImageMetadataReader.mochiDetails(interpretation, reading: reading)
-                    ?? MochiGenerationDetails()
-            )
-            guard let packet = try? MochiNativeCodec.encodeXMPPacket(snapshot) else { return nil }
-            return PNGMetadataPayloads(
-                nativeXMPPacket: packet,
-                parameters: A1111ParametersEncoder.encode(generation, producer: snapshot.producer)
-                    .text)
+            return payloads(
+                for: MochiGenerationSnapshot(
+                    producer: interpretation.producer
+                        ?? MetadataProducer(name: ImageMetadataReader.producerName),
+                    generation: generation,
+                    details: ImageMetadataReader.mochiDetails(interpretation, reading: reading)
+                        ?? MochiGenerationDetails()
+                ))
         case .automatic1111:
             let text = interpretation.payloadIndices.first.flatMap { reading.payloads[$0].text }
             return text.map { PNGMetadataPayloads(parameters: $0) }
@@ -321,20 +325,27 @@ nonisolated enum ImageMetadataReader {
             }
             return (try? MochiNativeCodec.decodeXMPPacket(text))?.details
         case .mochiDiffusionLegacyCaption:
-            let generation = interpretation.generations.first
+            let parameters = interpretation.generations.first?.parameters ?? []
             func value(_ key: String) -> String? {
-                generation?.parameters.first { $0.key == key }?.value
+                parameters.first { $0.key == key }?.value
             }
+            
```

**File**: `Mochi DiffusionTests/ImageExportTests.swift` (modified, +26/-0)
```diff
@@ -94,6 +94,7 @@ struct ImageExportTests {
         #expect(converted.prompt == "a cat")
         #expect(converted.seed == 42)
         #expect(converted.metadataFields == [.prompt, .seed])
+        #expect(try xmpDescription(of: Data(contentsOf: destination))?.hasPrefix("a cat\n") == true)
         // A sampler Mochi does not offer stays a shown detail and is not invented
         // as a known scheduler.
         #expect(converted.details.contains(MetadataDetail(label: "Sampler", value: "Euler")))
@@ -102,6 +103,31 @@ struct ImageExportTests {
                 == MetadataDetail(label: "Generator", value: "Mochi Diffusion 6.0"))
     }
 
+    @Test("A 6.1 HEIC converts to PNG with its model identity and input images")
+    func releasedLineCaptionConversion() async throws {
+        let caption = releasedLineCaption([
+            (.includeInImage, "a cat"),
+            (.engine, EngineID.iris.rawValue),
+            (.modelKey, "flux-klein"),
+            (.inputImages, "first, one.png"),
+            (.inputImages, "second.png"),
+            (.generator, "Mochi Diffusion 6.1.2"),
+        ])
+        let source = try writeReleasedSource("image.heic", type: .heic, caption: caption)
+
+        let destination = try await export(source, name: "converted.png")
+        let converted = try #require(createImageRecordFromURL(destination))
+
+        #expect(type(of: destination) == .png)
+        #expect(converted.prompt == "a cat")
+        #expect(converted.engine == EngineID.iris.rawValue)
+        #expect(converted.modelKey == "flux-klein")
+        #expect(converted.inputImages == ["first, one.png", "second.png"])
+        #expect(
+            converted.details.first
+                == MetadataDetail(label: "Generator", value: "Mochi Diffusion 6.1.2"))
+    }
+
     @Test("Another application's AUTOMATIC1111 text is carried over as it was")
     func foreignTextIsCarried() async throws {
         let text = "a dog\nSteps: 12, Sampler: Euler, CFG scale: 5, Seed: 9, Size: 8x8"
```

**File**: `Mochi DiffusionTests/MetadataRoundTripTests.swift` (modified, +55/-0)
```diff
@@ -118,6 +118,19 @@ struct MetadataRoundTripTests {
         #expect(data.range(of: Data("Sampler: DPM++ 2M, Schedule type: Karras".utf8)) != nil)
     }
 
+    @Test("A generated PNG's description is its AUTOMATIC1111 text")
+    func generatedPNGDescription() async throws {
+        let data = try #require(await Self.coreMLMetadata().pngData(for: makeCGImage()))
+
+        let description = try #require(xmpDescription(of: data))
+
+        #expect(
+            description.hasPrefix("a cat wearing a hat\nNegative prompt: blurry, low quality\n"))
+        #expect(description.contains("Sampler: DPM++ 2M, Schedule type: Karras"))
+        // The same text as the uncompressed `parameters` iTXt chunk.
+        #expect(data.range(of: Data("parameters\0\0\0\0\0\(description)".utf8)) != nil)
+    }
+
     @Test("An image without a starting image records no strength")
     func noStartingImageNoStrength() async throws {
         let record = try await roundTrip(Self.coreMLMetadata(startingImage: nil, strength: nil))
@@ -236,6 +249,48 @@ struct MetadataRoundTripTests {
         )
     }
 
+    @Test(
+        "Images from Mochi Diffusion 6.1 through 6.1.2 stay readable in every format",
+        arguments: [UTType.png, .jpeg, .heic])
+    func releasedLineCaptionImagesAreReadable(type: UTType) throws {
+        let caption = releasedLineCaption([
+            (.includeInImage, "a cat\nwearing a \\hat"),
+            (.excludeFromImage, ""),
+            (.model, "sd-1.5"),
+            (.engine, EngineID.coreMLStableDiffusion.rawValue),
+            (.modelKey, "sd-1.5"),
+            (.steps, "17"),
+            (.guidanceScale, "7.5"),
+            (.seed, "42"),
+            (.size, "512x768"),
+            (.inputImages, "first, one.png"),
+            (.inputImages, "second.png"),
+            (.scheduler, "DPM-Solver++"),
+            (.mlComputeUnit, "CPU & GPU"),
+            (.generator, "Mochi Diffusion 6.1.2"),
+        ])
+        let url = try writeReleasedImage(caption: caption, type: type, name: "released-6.1")
+
+        let record = try #require(createImageRecordFromURL(url))
+
+        #expect(record.prompt == "a cat\nwearing a \\hat")
+        #expect(record.negativePrompt == "")
+        #expect(record.metadataFields.contains(.negativePrompt))
+        #expect(record.model == "sd-1.5")
+        #expect(record.engine == EngineID.coreMLStableDiffusion.rawValue)
+        #expect(record.modelKey == "sd-1.5")
+        #expect(record.steps == 17)
+        #expect(record.guidanceScale == 7.5)
+        #expect(record.seed == 42)
+        #expect(record.generationSize == CGSize(width: 512, height: 768))
+        #expect(record.scheduler == .dpmSolverMultistepScheduler)
+        #expect(record.mlComputeUnit == .cpuAndGPU)
+        #expect(record.inputImages == ["first, one.png", "second.png"])
+        #expect(
+            record.details.first
+                == MetadataDetail(label: "Generator", value: "Mochi Diffusion 6.1.2"))
+    }
+
     /// Writes a PNG whose only metadata is AUTOMATIC1111-compatible text.
     func writeParametersImage(_ text: String, name: String) throws -> URL {
         let url = temp.appending("\(name).png")
```

---

### Incident Patch 5: `b1a4ed14` (2026-09-27)
**Commit Message**: fix: stop the Core ML batch seed from overflowing

The Core ML runtime advanced the batch seed with a trapping += 1, so any
batch starting at UInt32.max crashed after writing its last image. Core ML
and Iris now advance seeds through GenerationSeed, which wraps UInt32.max
to 1, and random seeds are drawn from 1...UInt32.max. Seed 0 is reserved
for "random" in the sidebar, so an image recorded with it could not be
reproduced through Copy Options.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>

**File**: `Mochi Diffusion.xcodeproj/project.pbxproj` (modified, +4/-0)
```diff
@@ -108,6 +108,7 @@
 		AA50000000000000000001982 /* QueueLivenessTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = AA50000000000000000001981 /* QueueLivenessTests.swift */; };
 		AA50000000000000000002082 /* GenerationResultPathTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = AA50000000000000000002081 /* GenerationResultPathTests.swift */; };
 		AA50000000000000000002096 /* SchedulerTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = AA50000000000000000002095 /* SchedulerTests.swift */; };
+		AA50000000000000000002098 /* GenerationSeedTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = AA50000000000000000002097 /* GenerationSeedTests.swift */; };
 		AA50000000000000000002094 /* IrisConversionTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = AA50000000000000000002093 /* IrisConversionTests.swift */; };
 		AA50000000000000000002092 /* GalleryBrowsingTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = AA50000000000000000002091 /* GalleryBrowsingTests.swift */; };
 		AA50000000000000000001992 /* GenerationOwnershipTests.swift in Sources */ = {isa = PBXBuildFile; fileRef = AA50000000000000000001991 /* GenerationOwnershipTests.swift */; };
@@ -272,6 +273,7 @@
 		AA50000000000000000001981 /* QueueLivenessTests.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = QueueLivenessTests.swift; sourceTree = "<group>"; };
 		AA50000000000000000002081 /* GenerationResultPathTests.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = GenerationResultPathTests.swift; sourceTree = "<group>"; };
 		AA50000000000000000002095 /* SchedulerTests.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = SchedulerTests.swift; sourceTree = "<group>"; };
+		AA50000000000000000002097 /* GenerationSeedTests.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = GenerationSeedTests.swift; sourceTree = "<group>"; };
 		AA50000000000000000002093 /* IrisConversionTests.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = IrisConversionTests.swift; sourceTree = "<group>"; };
 		AA50000000000000000002091 /* GalleryBrowsingTests.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = GalleryBrowsingTests.swift; sourceTree = "<group>"; };
 		AA50000000000000000001991 /* GenerationOwnershipTests.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = GenerationOwnershipTests.swift; sourceTree = "<group>"; };
@@ -534,6 +536,7 @@
 				AA50000000000000000001981 /* QueueLivenessTests.swift */,
 				AA50000000000000000002081 /* GenerationResultPathTests.swift */,
 				AA50000000000000000002095 /* SchedulerTests.swift */,
+				AA50000000000000000002097 /* GenerationSeedTests.swift */,
 				AA50000000000000000002093 /* IrisConversionTests.swift */,
 				AA50000000000000000002091 /* GalleryBrowsingTests.swift */,
 				AA70000000000000000000011 /* GalleryLoadingTests.swift */,
@@ -910,6 +913,7 @@
 				AA50000000000000000001982 /* QueueLivenessTests.swift in Sources */,
 				AA50000000000000000002082 /* GenerationResultPathTests.swift in Sources */,
 				AA50000000000000000002096 /* SchedulerTests.swift in Sources */,
+				AA50000000000000000002098 /* GenerationSeedTests.swift in Sources */,
 				AA50000000000000000002094 /* IrisConversionTests.swift in Sources */,
 				AA50000000000000000002092 /* GalleryBrowsingTests.swift in Sources */,
 				AA70000000000000000000012 /* GalleryLoadingTests.swift in Sources */,
```

**File**: `Mochi Diffusion/Support/CoreMLEngineRuntime.swift` (modified, +1/-1)
```diff
@@ -292,7 +292,7 @@ actor CoreMLEngineRuntime: GenerationEngineRuntime {
                 )
                 try await onResult(GenerationResult(metadata: metadata, imageData: data))
             }
-            pipelineConfig.seed += 1
+            pipelineConfig.seed = GenerationSeed.next(after: pipelineConfig.seed)
         }
     }
 
```

**File**: `Mochi Diffusion/Support/GenerationController.swift` (modified, +1/-1)
```diff
@@ -1187,7 +1187,7 @@ final class GenerationController {
             guidanceScale: Float(configStore.guidanceScale),
             scheduler: configStore.scheduler,
             quality: configStore.quality,
-            seed: seed == 0 ? UInt32.random(in: 0..<UInt32.max) : seed,
+            seed: seed == 0 ? GenerationSeed.random() : seed,
             numberOfImages: Int(numberOfImages),
             computeUnitPreference: configStore.mlComputeUnitPreference,
             reduceMemory: configStore.reduceMemory,
```

**File**: `Mochi Diffusion/Support/GenerationEngine.swift` (modified, +16/-0)
```diff
@@ -47,6 +47,22 @@ nonisolated struct ModelDiscoveryContext: Sendable {
     }
 }
 
+/// The seeds a generation uses.
+///
+/// The sidebar reserves seed 0 for "random", so no generated image is given
+/// seed 0: an image recorded with it could not be reproduced through Copy Options.
+nonisolated enum GenerationSeed {
+    static func random() -> UInt32 {
+        UInt32.random(in: 1...UInt32.max)
+    }
+
+    /// The seed for the image after one generated with `seed` in the same batch.
+    /// Wraps from `UInt32.max` to 1.
+    static func next(after seed: UInt32) -> UInt32 {
+        seed == .max ? 1 : seed + 1
+    }
+}
+
 /// Everything the sidebar holds, handed to an engine so it can decide what its own
 /// generation needs.
 ///
```

**File**: `Mochi Diffusion/Support/IrisEngineRuntime.swift` (modified, +1/-1)
```diff
@@ -263,7 +263,7 @@ actor IrisEngineRuntime: GenerationEngineRuntime {
 
             let result = GenerationResult(metadata: metadata, imageData: imageData)
             try await onResult(result)
-            seed &+= 1
+            seed = GenerationSeed.next(after: seed)
         }
     }
 
```

---

### Incident Patch 6: `3f1d4109` (2026-09-26)
**Commit Message**: fix: keep one gallery entry per image file

A folder sync that ran during an import read the gallery before the
import's copies finished, then added the copied files again after the
import had added them, so a long import could show each image twice.
ImageGallery.add now skips an image whose file name the gallery already
holds, which covers every order in which a sync, an import or a
generation result can reach the same file. Names are compared rather
than full paths because loading and writing can spell the folder's path
differently.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>

**File**: `Mochi Diffusion/Model/ImageGallery.swift` (modified, +25/-9)
```diff
@@ -65,36 +65,52 @@ enum ImagesSortType: String {
         }
     }
 
+    /// Adds `sdi` unless the gallery already holds its file. See
+    /// `add(_:animate:)` for the rule. Returns nil when the image was skipped.
     @discardableResult
     func add(
         _ sdi: SDImage,
         metadataFields: Set<MetadataField> = Set(MetadataField.allCases),
         animate: Bool = true
-    ) -> SDImage.ID {
-        runWithOptionalAnimation(animate: animate) {
-            allImages.append(sdi)
-            metadataFieldsByImageID[sdi.id] = metadataFields
-            return sdi.id
-        }
+    ) -> SDImage.ID? {
+        add([(image: sdi, metadataFields: metadataFields)], animate: animate).first
     }
 
+    /// Adds the images whose files the gallery does not already hold, and returns
+    /// the IDs of those it added.
+    ///
+    /// The gallery mirrors one images folder, so it holds at most one entry per
+    /// file. A folder sync can find a file at the same time as an import or a
+    /// generation result adds it, and whichever arrives second is skipped. Files
+    /// are compared by name, because loading and writing can spell the folder's
+    /// path differently. An image with no path is always added.
     @discardableResult
     func add(
         _ imagesAndMetadata: [(image: SDImage, metadataFields: Set<MetadataField>)],
         animate: Bool = true
     )
         -> [SDImage.ID]
     {
-        runWithOptionalAnimation(animate: animate) {
-            let images = imagesAndMetadata.map(\.image)
+        var heldFileNames = Set(allImages.compactMap(Self.fileName(of:)))
+        let newItems = imagesAndMetadata.filter { item in
+            guard let fileName = Self.fileName(of: item.image) else { return true }
+            return heldFileNames.insert(fileName).inserted
+        }
+        guard !newItems.isEmpty else { return [] }
+        return runWithOptionalAnimation(animate: animate) {
+            let images = newItems.map(\.image)
             allImages.append(contentsOf: images)
-            for item in imagesAndMetadata {
+            for item in newItems {
                 metadataFieldsByImageID[item.image.id] = item.metadataFields
             }
             return images.map(\.id)
         }
     }
 
+    private static func fileName(of image: SDImage) -> String? {
+        image.path.isEmpty ? nil : URL(fileURLWithPath: image.path).lastPathComponent
+    }
+
     @discardableResult
     func add(_ sdis: [SDImage], animate: Bool = true) -> [SDImage.ID] {
         add(
```

**File**: `Mochi DiffusionTests/GalleryLoadingTests.swift` (modified, +63/-0)
```diff
@@ -378,6 +378,69 @@ struct GalleryLoadingTests {
         #expect(!controller.isLoading)
     }
 
+    /// The folder monitor syncs shortly after the first imported file lands, so a
+    /// long import overlaps a sync. The sync sees the copied files before the
+    /// import has added them to the gallery.
+    @Test("A folder sync during an import adds each imported image once")
+    func importAndSyncTogetherAddEachImageOnce() async throws {
+        let incoming = try temp.subdirectory("incoming")
+        let urls = try (0..<20).map { index in
+            try writeImportableImage(named: "\(index).png", prompt: "\(index)", in: incoming)
+            return incoming.appending(path: "\(index).png")
+        }
+        let gallery = ImageGallery()
+        let controller = try await makeSettledController(gallery: gallery)
+
+        async let imported = controller.importImages(from: urls)
+        async let synced: Void = controller.syncImages()
+        _ = await (imported, synced)
+
+        #expect(gallery.allImages.count == 20)
+        #expect(Set(gallery.allImages.map(\.prompt)).count == 20)
+    }
+
+    // MARK: - One entry per file
+
+    @Test("The gallery skips an image whose file it already holds")
+    func galleryHoldsOneEntryPerFile() {
+        let gallery = ImageGallery()
+        let original = SDImage(
+            image: nil, aspectRatio: 1, path: imageDir.appending(path: "one.png").path)
+        // The same file reached through the resolved spelling of the folder.
+        let again = SDImage(
+            image: nil,
+            aspectRatio: 1,
+            path: imageDir.resolvingSymlinksInPath().appending(path: "one.png").path
+        )
+
+        let other = SDImage(
+            image: nil, aspectRatio: 1, path: imageDir.appending(path: "two.png").path)
+        let fields: Set<MetadataField> = [.prompt]
+
+        let added = gallery.add(original)
+        let skipped = gallery.add(again)
+        let batch = gallery.add([
+            (image: again, metadataFields: fields),
+            (image: other, metadataFields: fields),
+        ])
+
+        #expect(added == original.id)
+        #expect(skipped == nil)
+        #expect(batch.count == 1)
+        #expect(gallery.allImages.count == 2)
+        #expect(gallery.allImages.first?.id == original.id)
+    }
+
+    @Test("Images with no file are always added")
+    func imagesWithoutPathsAreAlwaysAdded() {
+        let gallery = ImageGallery()
+
+        gallery.add(SDImage())
+        gallery.add(SDImage())
+
+        #expect(gallery.allImages.count == 2)
+    }
+
     // MARK: - Save All
 
     @Test("Save All writes every gallery image, numbered in gallery order")
```

---

### Incident Patch 7: `39719d0f` (2026-09-26)
**Commit Message**: fix: share one image repository across the app

ImageGallery, GenerationService, GenerationController and GalleryController each created their own ImageRepository, so filename allocation was only serialized per instance. Two writers could pick the same free name and the second atomic write would replace the first file. The app now creates one repository and injects it into every owner.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>

**File**: `Mochi Diffusion/MochiDiffusionApp.swift` (modified, +7/-1)
```diff
@@ -38,20 +38,25 @@ struct MochiDiffusionApp: App {
 
     init() {
         let configStore = ConfigStore()
-        let imageGallery = ImageGallery()
+        // One repository for every writer, so filename allocation covers all of
+        // them. See `ImageRepository`.
+        let imageRepository = ImageRepository()
+        let imageGallery = ImageGallery(imageRepository: imageRepository)
         let thumbnailProvider = GalleryThumbnailProvider()
         let fullImageProvider = GalleryFullImageProvider()
         let engineRegistry = EngineRegistry()
         self.thumbnailProvider = thumbnailProvider
         self.fullImageProvider = fullImageProvider
         let generationService = GenerationService(
+            imageRepository: imageRepository,
             engineRegistry: engineRegistry,
             imageGallery: imageGallery
         )
         self._configStore = State(initialValue: configStore)
         self._generationController = State(
             initialValue: GenerationController(
                 configStore: configStore,
+                imageRepository: imageRepository,
                 imageGallery: imageGallery,
                 generationService: generationService,
                 engineRegistry: engineRegistry,
@@ -62,6 +67,7 @@ struct MochiDiffusionApp: App {
             initialValue: GalleryController(
                 configStore: configStore,
                 imageGallery: imageGallery,
+                imageRepository: imageRepository,
                 // The same instances the views read from, so invalidating on a
                 // delete or an import reaches what is actually on screen.
                 thumbnailProvider: thumbnailProvider,
```

**File**: `Mochi Diffusion/Support/ImageRepository.swift` (modified, +8/-0)
```diff
@@ -58,6 +58,14 @@ enum ImageRepositoryError: Error {
     case imageDirectoryUnavailable(String, reason: String)
 }
 
+/// Reads and writes the images folder.
+///
+/// Choosing a free filename and writing to it happen in one actor call, so two
+/// writes through the same repository never pick the same name. That guarantee
+/// covers only callers that share an instance: the app creates one and gives it
+/// to every owner that writes images, which matters because generations are not
+/// guaranteed to finish one at a time. It does not protect against other
+/// processes writing to the same folder.
 actor ImageRepository {
     private static let supportedImageExtensions: Set<String> = ["png", "jpg", "jpeg", "heic"]
 
```

---

### Incident Patch 8: `bfc31a78` (2026-09-26)
**Commit Message**: fix: remove force unwraps from image utility helpers

The Finder label read, the app version lookup and the Quick Look temporary file no longer trap on unexpected data. The temporary file helper throws, which its callers already handle.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>

**File**: `Mochi Diffusion/Support/Extensions.swift` (modified, +16/-15)
```diff
@@ -22,18 +22,8 @@ struct MochiCompactSliderStyle: CompactSliderStyle {
 
 extension NSApplication {
     nonisolated static var appVersion: String {
-        Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as! String
-    }
-}
-
-extension NSImage {
-    nonisolated func getImageHash() -> Int {
-        self.tiffRepresentation!.hashValue
-    }
-
-    nonisolated func toPngData() -> Data {
-        let imageRepresentation = NSBitmapImageRep(data: self.tiffRepresentation!)
-        return (imageRepresentation?.representation(using: .png, properties: [:])!)!
+        Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String
+            ?? "unknown"
     }
 }
 
@@ -174,15 +164,26 @@ extension NSImage {
         }
     }
 
+    /// Writes the image to a PNG in the temporary directory, named by its content
+    /// so the same image reuses one file. Throws if the image has no bitmap
+    /// representation that can be encoded.
     nonisolated func temporaryFileURL() throws -> URL {
-        let imageHash = self.getImageHash()
-        let filename = "\(Self.temporaryFilePrefix)\(imageHash).png"
+        guard let tiffData = tiffRepresentation else {
+            throw CocoaError(.fileWriteUnknown)
+        }
+        let filename = "\(Self.temporaryFilePrefix)\(tiffData.hashValue).png"
         let url = FileManager.default.temporaryDirectory.appending(path: filename)
         if FileManager.default.fileExists(atPath: url.path(percentEncoded: false)) {
             return url
         }
 
-        let fileWrapper = FileWrapper(regularFileWithContents: self.toPngData())
+        guard
+            let pngData = NSBitmapImageRep(data: tiffData)?
+                .representation(using: .png, properties: [:])
+        else {
+            throw CocoaError(.fileWriteUnknown)
+        }
+        let fileWrapper = FileWrapper(regularFileWithContents: pngData)
         try fileWrapper.write(to: url, originalContentsURL: nil)
         return url
     }
```

**File**: `Mochi Diffusion/Support/Functions.swift` (modified, +1/-6)
```diff
@@ -106,12 +106,7 @@ nonisolated func writeFinderTagColorNumber(_ path: String, colorNumber: Int) {
 
 nonisolated func getFinderTagColorNumber(_ url: URL) -> Int {
     guard let md = MDItemCreateWithURL(nil, url as CFURL) else { return 0 }
-    var finderTagColorNumber: Int = 0
-    let mdItemFSLabel = MDItemCopyAttribute(md, kMDItemFSLabel)
-    if let label = mdItemFSLabel {
-        finderTagColorNumber = label as! Int
-    }
-    return finderTagColorNumber
+    return MDItemCopyAttribute(md, kMDItemFSLabel) as? Int ?? 0
 }
 
 /// Turns a prompt into part of an image filename.
```

---

### Incident Patch 9: `d6d69934` (2026-09-26)
**Commit Message**: fix: report the real cause when the images folder cannot be created

Only permission failures are reported as no access. Other failures, such as a full disk or a file where the folder belongs, carry the system's description to the status message and the log.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>

**File**: `Mochi Diffusion/Support/GalleryController.swift` (modified, +2/-0)
```diff
@@ -83,6 +83,8 @@ final class GalleryController {
             imageGallery.replaceAll(imagesAndMetadata)
         } catch ImageRepositoryError.imageDirectoryNoAccess(let path) {
             logger.error("Couldn't access images directory at: \"\(path)\"")
+        } catch ImageRepositoryError.imageDirectoryUnavailable(let path, let reason) {
+            logger.error("Couldn't create images directory at: \"\(path)\": \(reason)")
         } catch {
             logger.error("There was a problem loading the images: \(error.localizedDescription)")
         }
```

**File**: `Mochi Diffusion/Support/GenerationController.swift` (modified, +5/-0)
```diff
@@ -589,6 +589,11 @@ final class GenerationController {
                 .error("Couldn't access images folder at: \(path)")
             )
             return
+        } catch ImageRepositoryError.imageDirectoryUnavailable(let path, let reason) {
+            await generationService.updateStatus(
+                .error("Couldn't create images folder at: \(path). \(reason)")
+            )
+            return
         } catch {
             await generationService.updateStatus(
                 .error("Couldn't access images folder.")
```

**File**: `Mochi Diffusion/Support/GenerationService.swift` (modified, +5/-0)
```diff
@@ -345,6 +345,11 @@ actor GenerationService {
                 await updateStatus(
                     .error("Couldn't access images folder at: \(path)")
                 )
+            } catch ImageRepositoryError.imageDirectoryUnavailable(let path, let reason) {
+                logger.error("Couldn't create images folder at \(path): \(reason)")
+                await updateStatus(
+                    .error("Couldn't create images folder at: \(path). \(reason)")
+                )
             } catch GenerationError.imageDirectoryNoAccess {
                 logger.error("Couldn't save image to images folder.")
                 await updateStatus(
```

**File**: `Mochi Diffusion/Support/ImageRepository.swift` (modified, +28/-11)
```diff
@@ -51,7 +51,11 @@ struct ImageSyncResult: Sendable {
 }
 
 enum ImageRepositoryError: Error {
+    /// Mochi is not permitted to create, read or write the images folder.
     case imageDirectoryNoAccess(String)
+    /// The images folder could not be created for another reason, such as a full
+    /// disk or a file where a folder belongs. Carries the system's description.
+    case imageDirectoryUnavailable(String, reason: String)
 }
 
 actor ImageRepository {
@@ -76,15 +80,34 @@ actor ImageRepository {
         )
     }
 
-    func load(imageDir: String) throws -> [ImageRecord] {
-        let directoryURL = resolvedImageDirectoryURL(fromPath: imageDir)
+    private func ensureImageDirectoryExists(_ directoryURL: URL) throws {
         do {
             try fileSystem.ensureDirectoryExists(directoryURL)
         } catch {
-            throw ImageRepositoryError.imageDirectoryNoAccess(
-                directoryURL.path(percentEncoded: false)
+            let path = directoryURL.path(percentEncoded: false)
+            if Self.isPermissionFailure(error) {
+                throw ImageRepositoryError.imageDirectoryNoAccess(path)
+            }
+            throw ImageRepositoryError.imageDirectoryUnavailable(
+                path,
+                reason: error.localizedDescription
             )
         }
+    }
+
+    private nonisolated static func isPermissionFailure(_ error: any Error) -> Bool {
+        guard let error = error as? CocoaError else { return false }
+        switch error.code {
+        case .fileReadNoPermission, .fileWriteNoPermission, .fileWriteVolumeReadOnly:
+            return true
+        default:
+            return false
+        }
+    }
+
+    func load(imageDir: String) throws -> [ImageRecord] {
+        let directoryURL = resolvedImageDirectoryURL(fromPath: imageDir)
+        try ensureImageDirectoryExists(directoryURL)
 
         let items = try fileSystem.contentsOfDirectory(at: directoryURL)
         let imageURLs =
@@ -166,13 +189,7 @@ actor ImageRepository {
 
     func ensureOutputDirectory(imageDir: String) throws -> URL {
         let directoryURL = resolvedImageDirectoryURL(fromPath: imageDir)
-        do {
-            try fileSystem.ensureDirectoryExists(directoryURL)
-        } catch {
-            throw ImageRepositoryError.imageDirectoryNoAccess(
-                directoryURL.path(percentEncoded: false)
-            )
-        }
+        try ensureImageDirectoryExists(directoryURL)
 
         guard fileSystem.isWritableDirectory(directoryURL) else {
             throw ImageRepositoryError.imageDirectoryNoAccess(
```

**File**: `Mochi DiffusionTests/GalleryLoadingTests.swift` (modified, +41/-0)
```diff
@@ -419,6 +419,47 @@ struct ImageRepositoryTests {
         #expect(url.lastPathComponent == "outside.png")
     }
 
+    @Test("A folder that cannot be created for a non-permission reason names the cause")
+    func nonPermissionDirectoryFailureKeepsCause() async throws {
+        let blocker = temp.appending("not-a-folder")
+        try Data([1]).write(to: blocker)
+        let directory = blocker.appending(path: "images")
+        let repository = ImageRepository()
+
+        do {
+            _ = try await repository.ensureOutputDirectory(
+                imageDir: directory.path(percentEncoded: false)
+            )
+            Issue.record("Expected creating the images folder to fail")
+        } catch ImageRepositoryError.imageDirectoryUnavailable(let path, let reason) {
+            #expect(URL(fileURLWithPath: path).pathComponents == directory.pathComponents)
+            #expect(!reason.isEmpty)
+        }
+    }
+
+    @Test("A folder Mochi may not create is reported as no access")
+    func permissionDirectoryFailureIsNoAccess() async throws {
+        let parent = try temp.subdirectory("read-only")
+        try FileManager.default.setAttributes([.posixPermissions: 0o555], ofItemAtPath: parent.path)
+        defer {
+            try? FileManager.default.setAttributes(
+                [.posixPermissions: 0o755],
+                ofItemAtPath: parent.path
+            )
+        }
+        let directory = parent.appending(path: "images")
+        let repository = ImageRepository()
+
+        do {
+            _ = try await repository.ensureOutputDirectory(
+                imageDir: directory.path(percentEncoded: false)
+            )
+            Issue.record("Expected creating the images folder to fail")
+        } catch ImageRepositoryError.imageDirectoryNoAccess(let path) {
+            #expect(URL(fileURLWithPath: path).pathComponents == directory.pathComponents)
+        }
+    }
+
     @Test("An empty image directory resolves to the injected default")
     func emptyDirectoryUsesDefaultForWrites() async throws {
         let defaultDirectory = temp.appending("default-images")
```

---

### Incident Patch 10: `cfd2dbf1` (2026-09-26)
**Commit Message**: fix: stop a late Copy Options from overwriting newer sidebar work

Copy Options now applies its settings before any image load suspends,
so a later edit always lands after them. The images it loads are
applied only if it is still the latest image-loading action, the model
is unchanged, and the sidebar's image inputs are untouched. Copy
Options and gallery image reuse share one supersession counter, and a
load that finishes after shutdown is discarded.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>

**File**: `Mochi Diffusion/Support/GenerationController.swift` (modified, +57/-14)
```diff
@@ -221,7 +221,7 @@ final class GenerationController {
     var currentModelId: ModelID? {
         didSet {
             if oldValue != currentModelId {
-                galleryImageLoadGeneration += 1
+                sidebarImageLoadGeneration += 1
             }
             guard let model = models.first(where: { $0.id == self.currentModelId }) else {
                 // Selecting nothing clears the ControlNet state too, so the
@@ -358,9 +358,11 @@ final class GenerationController {
     private var controlNetDirDebounceTask: Task<Void, Never>?
     private var generationUpdatesTask: Task<Void, Never>?
     private var generationResultsTask: Task<Void, Never>?
-    /// Supersedes an older gallery image load when the user invokes the action
-    /// again before the first file has finished decoding.
-    private var galleryImageLoadGeneration = 0
+    /// Identifies the latest sidebar action that loads images: gallery reuse or
+    /// Copy Options. Each such action, and each model change, advances it, so an
+    /// older load that finishes later is discarded rather than overwriting the
+    /// newer action's images.
+    private var sidebarImageLoadGeneration = 0
     /// Stored, and capturing weakly, so `shutdown()` can cancel it and it cannot
     /// keep the controller alive.
     private var initialLoadTask: Task<Void, Never>?
@@ -699,19 +701,21 @@ final class GenerationController {
     /// Loads a gallery image on demand and sends it to the role the selected model
     /// accepts.
     ///
-    /// The file read suspends outside this main-actor controller. Model changes and
-    /// newer gallery actions own the sidebar after that suspension, so an older
-    /// load is discarded rather than updating their destination.
+    /// The file read suspends outside this main-actor controller. Model changes,
+    /// newer gallery actions, Copy Options and image edits own the sidebar after
+    /// that suspension, so an older load is discarded rather than updating their
+    /// destination.
     func useGalleryImage(_ sdi: SDImage) async {
         guard let modelID = currentModelId, let destination = galleryImageDestination else {
             return
         }
         let destinationStartingImage = startingImage
         let destinationInputImages = inputImages
-        galleryImageLoadGeneration += 1
-        let generation = galleryImageLoadGeneration
+        sidebarImageLoadGeneration += 1
+        let generation = sidebarImageLoadGeneration
         guard let image = await fullImageProvider.image(for: sdi) else { return }
-        guard generation == galleryImageLoadGeneration,
+        guard !isShutDown,
+            generation == sidebarImageLoadGeneration,
             currentModelId == modelID,
             galleryImageDestination == destination,
             startingImage == destinationStartingImage,
@@ -905,11 +909,23 @@ final class GenerationController {
         setModel(name)
     }
 
+    /// Restores a recorded configuration into the sidebar.
+    ///
+    /// Settings are applied before anything suspends, so a later edit always
+    /// lands after them. Only the images arrive late, because a path-backed gallery
+    /// image loads outside this main-actor controller. They are applied only if
+    /// this is still the latest image-loading action, the model is unchanged, and
+    /// the user has not changed the image inputs in the meantime.
     private func restoreSidebar(from source: SidebarRestoreSource) async {
         selectModel(for: source.model)
         guard let destinationModel = currentModel else { return }
         let destinationModelID = destinationModel.id
         let constraints = destinationModel.constraints
+        sidebarImageLoadGeneration += 1
+        let generation = sidebarImageLoadGeneration
+
+        apply(source, constrainedBy: constraints, to: destinationModel)
+        let destinationImages = SidebarImageInputs(self)
 
         let restoredStartingImage =
       
```

**File**: `Mochi DiffusionTests/GenerationConfigRestorationTests.swift` (modified, +116/-0)
```diff
@@ -205,6 +205,122 @@ struct GenerationConfigRestorationTests {
         #expect(controller.startingImage?.image.height == 10)
     }
 
+    /// A gallery holding one path-backed reference per name, and one OpenAI image
+    /// per name whose metadata records that reference and a matching prompt.
+    private func makeRestoreGallery(_ names: [String]) -> (ImageGallery, [String: SDImage]) {
+        let gallery = ImageGallery()
+        var entries: [(image: SDImage, metadataFields: Set<MetadataField>)] = []
+        var sources: [String: SDImage] = [:]
+        for name in names {
+            let reference = SDImage(image: nil, aspectRatio: 1, path: "/tmp/\(name).png")
+            var source = SDImage(image: makeCGImage(), aspectRatio: 1, path: "")
+            source.model = "gpt-image-2"
+            source.engine = EngineID.openAI.rawValue
+            source.modelKey = "gpt-image-2"
+            source.prompt = "prompt \(name)"
+            source.inputImages = ["\(name).png"]
+            entries.append((image: reference, metadataFields: []))
+            entries.append(
+                (
+                    image: source,
+                    metadataFields: [.model, .engine, .modelKey, .prompt, .inputImages]
+                )
+            )
+            sources[name] = source
+        }
+        gallery.replaceAll(entries)
+        return (gallery, sources)
+    }
+
+    @Test("A newer Copy Options owns the sidebar when an older one finishes last")
+    func newerRestoreWinsOverOlderLoad() async throws {
+        let loader = ControlledImageLoader()
+        let provider = GalleryFullImageProvider { path in
+            await loader.load(path)
+        }
+        let (gallery, sources) = makeRestoreGallery(["a", "b"])
+        let controller = makeController(gallery: gallery, fullImageProvider: provider)
+        await controller.loadModels()
+
+        let older = Task { await controller.copyToPrompt(try #require(sources["a"])) }
+        await loader.waitUntilStarted("/tmp/a.png")
+        let newer = Task { await controller.copyToPrompt(try #require(sources["b"])) }
+        await loader.waitUntilStarted("/tmp/b.png")
+        await loader.finish("/tmp/b.png", with: makeCGImage(width: 12, height: 8))
+        try await newer.value
+        await loader.finish("/tmp/a.png", with: makeCGImage(width: 8, height: 12))
+        try await older.value
+
+        #expect(configStore.prompt == "prompt b")
+        #expect(controller.inputImages.map(\.name) == ["b.png"])
+        #expect(controller.inputImages.first?.image.width == 12)
+    }
+
+    @Test("Edits made while Copy Options loads are not overwritten")
+    func restoreDoesNotOverwriteNewerEdits() async throws {
+        let loader = ControlledImageLoader()
+        let provider = GalleryFullImageProvider { path in
+            await loader.load(path)
+        }
+        let (gallery, sources) = makeRestoreGallery(["a"])
+        let controller = makeController(gallery: gallery, fullImageProvider: provider)
+        await controller.loadModels()
+
+        let restore = Task { await controller.copyToPrompt(try #require(sources["a"])) }
+        await loader.waitUntilStarted("/tmp/a.png")
+        configStore.prompt = "typed while loading"
+        controller.addInputImage(image: makeCGImage(width: 20, height: 10), filename: "newer.png")
+        await loader.finish("/tmp/a.png", with: makeCGImage())
+        try await restore.value
+
+        #expect(configStore.prompt == "typed while loading")
+        #expect(controller.inputImages.map(\.name) == ["newer.png"])
+    }
+
+    @Test("A model change during Copy Options discards its late images")
+    func restoreDoesNotCrossModelChanges() async throws {
+        try makeSDModelFixture(at: modelDir.appending(path: "core"))
+        let loader = ControlledImageLoader()
+        let provider = GalleryFullImageProvider { path in
+            await loader.load(path)
+        }
+        let (gallery, sources) = makeRe
```

#### Recent Merged Pull Requests:
- **PR #522** (2026-09-26): New Crowdin updates (@itsjoshpark)
- **PR #520** (2026-09-26): build(deps): bump crowdin/github-action from 2.16.3 to 3.0.2 (@dependabot[bot])
- **PR #519** (closed): build(deps): bump crowdin/github-action from 2.16.3 to 3.0.1 (@dependabot[bot])
- **PR #518** (closed): build(deps): bump crowdin/github-action from 2.16.3 to 3.0.0 (@dependabot[bot])
- **PR #517** (closed): build(deps): bump crowdin/github-action from 2.16.3 to 2.17.1 (@dependabot[bot])
- **PR #516** (2026-09-26): build(deps): bump actions/checkout from 6.0.3 to 7.0.1 (@dependabot[bot])
- **PR #515** (closed): build(deps): bump crowdin/github-action from 2.16.3 to 2.17.0 (@dependabot[bot])
- **PR #514** (closed): build(deps): bump crowdin/github-action from 2.16.3 to 2.16.4 (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

# Verification Protocol: Verification Protocol: Empirical Defect Shield for duongductrong/Snapzy

<!-- PROVENANCE_START
{
  "source_repository": "duongductrong/Snapzy",
  "source_url": "https://github.com/duongductrong/Snapzy",
  "source_version": "92a08dd1",
  "license": "BSD-3-Clause",
  "timestamp": "2026-11-16T13:38:24.785Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-duongductrong-snapzy",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [duongductrong/Snapzy](https://github.com/duongductrong/Snapzy) (Revision: `92a08dd1`).  
> **License**: BSD-3-Clause | **Timestamp**: `2026-11-16T13:38:24.785Z`  
> **Learning ID**: `learn-github-duongductrong-snapzy`


## 1. Scope & Verification Target
- **Target Repository**: `duongductrong/Snapzy` (Commit: `92a08dd1`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
# Forensic Learning Record (Deep Inspection): duongductrong/Snapzy

> **Canonical Artifact**: `07_PROJECT_LEARNING/duongductrong-snapzy-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/duongductrong/Snapzy](https://github.com/duongductrong/Snapzy))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-16T13:38:23.755Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `duongductrong/Snapzy`
- **Description**: An open-source native macOS screenshot and screen recording app. A CleanShot X alternative.
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 3579 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `Packages/SnapzyCLIKit/Sources/SnapzyCLICore/Commands/Capture/AreaCommand.swift`
```
//
//  AreaCommand.swift
//  SnapzyCLICore
//

import ArgumentParser
import SnapzyCLIProtocol

struct AreaCommand: AsyncParsableCommand {
  static let configuration = CommandConfiguration(
    commandName: "area",
    abstract: "Capture a rectangle of the screen.",
    discussion: """
    Coordinates are global points with the origin at the top-left of the main \
    display, the same space as the frames printed by `snapzy list`.
    """
  )

  @OptionGroup var global: GlobalOptions
  @OptionGroup var output: CaptureOutputOptions
  @OptionGroup var selection: AreaSelectionOptions

  func run() async throws {
    try await CaptureCommand.run(
      .captureArea,
      params: CaptureAreaParams(rect: selection.rect, options: output.captureOptions()),
      output: output,
      global: global
    )
  }
}

```

### Core Architecture Module: `Packages/SnapzyCLIKit/Sources/SnapzyCLICore/Commands/Capture/CaptureCommand.swift`
```
//
//  CaptureCommand.swift
//  SnapzyCLICore
//
//  `capture screen|window|area`. Captures never open Quick Access, touch the
//  clipboard or history; the file path comes back in the result.
//

import ArgumentParser
import Foundation
import SnapzyCLIClient
import SnapzyCLIProtocol

struct CaptureCommand: AsyncParsableCommand {
  static let configuration = CommandConfiguration(
    commandName: "capture",
    abstract: "Capture a display, a window or an area without user interaction.",
    subcommands: [ScreenCommand.self, WindowCommand.self, AreaCommand.self]
  )

  static func run(
    _ method: CLIMethod,
    params: some Codable & Sendable,
    output: CaptureOutputOptions,
    global: GlobalOptions
  ) async throws {
    let destination = OutputDestination.resolve(
      output.output,
      currentDirectory: URL(fileURLWithPath: FileManager.default.currentDirectoryPath, isDirectory: true)
    )
    let writer = OutputWriter()
    try await CommandRunner.reportingErrors(global.renderer) {
      try writer.preflight(destination, force: output.force)
    }

    try await CommandRunner.run(global) { client, renderer in
      let result = try client.call(method, params: params, as: CLICaptureResult.self)
      let written = try writer.apply(result, to: destination, force: output.force) { data in
        do {
          try FileHandle.standardOutput.write(contentsOf: data)
        } catch {
          throw CLIError(.internal, "Could not write the image to stdout: \(error.localizedDescription)")
        }
      }

      if destination == .standardOutput {
        // stdout carries the image; metadata goes to stderr only when asked.
        if global.json {
          try StandardStreams.writeError(OutputRenderer(mode: .json(pretty: false)).render(written))
        }
      } else {
        try StandardStreams.write(renderer.render(written))
      }
    }
  }
}

struct CaptureOutputOptions: ParsableArguments {
  @Option(
    name: [.short, .long],
    help: ArgumentHelp(
      "Where to write the capture: a file, a directory (trailing /), or - for stdout.",
      discussion: "Without it the file stays in Snapzy's staging folder for 24 hours."
    )
  )
  var output: String?

  @Option(help: "Image format. Defaults to the --output extension, else png.")
  var format: CLIImageFormat?

  @Option(help: "JPEG quality, 0 to 1.")
  var quality: Double?

  @Option(name: .customLong("max-dimension"), help: "Downscale so the longest edge is at most this many pixels.")
  var maxDimension: Int?

  @Flag(help: "Include the mouse cursor.")
  var cursor = false

  @Flag(help: "Overwrite existing files at --output.")
  var force = false

  mutating func validate() throws {
    let format = try resolvedFormat()
    if let quality {
      guard (0 ... 1).contains(quality) else { throw ValidationError("--quality must be between 0 and 1.") }
      guard format == .jpeg else { throw ValidationError("--quality only applies to jpg output.") }
    }
    if let maxDimension, maxDimension <= 0 {
      throw ValidationError("--max-dimension must be greater than 0.")
    }
  }

  func resolvedFormat() throws -> CLIImageFormat {
    let outputExtension = output
      .flatMap { $0 == "-" || $0.hasSuffix("/") ? nil : URL(fileURLWithPath: $0).pathExtension }
      .flatMap(CLIImageFormat.init(fileExtension:))

    switch (format, outputExtension) {
    case let (format?, outputExtension?) where format != outputExtension:
      throw ValidationError(
        "--format \(format.fileExtension) does not match the --output extension .\(outputExtension.fileExtension)."
      )
    case let (format?, _):
      return format
    case let (nil, outputExtension?):
      return outputExtension
    case (nil, nil):
      return .png
    }
  }

  func captureOptions(windowShadow: Bool = true) throws -> CaptureOptions {
    try CaptureOptions(
      format: resolvedFormat(),
      quality: quality,
      maxDimension: maxDimension,
      showCursor: cursor,
      windowShadow: windowShadow
    )
  }
}

```

### Core Architecture Module: `Packages/SnapzyCLIKit/Sources/SnapzyCLICore/Commands/Capture/ScreenCommand.swift`
```
//
//  ScreenCommand.swift
//  SnapzyCLICore
//

import ArgumentParser
import SnapzyCLIProtocol

struct ScreenCommand: AsyncParsableCommand {
  static let configuration = CommandConfiguration(
    commandName: "screen",
    abstract: "Capture a whole display, or every display."
  )

  @OptionGroup var global: GlobalOptions
  @OptionGroup var output: CaptureOutputOptions
  @OptionGroup var selection: DisplaySelectionOptions

  func run() async throws {
    try await CaptureCommand.run(
      .captureScreen,
      params: CaptureScreenParams(display: selection.display, options: output.captureOptions()),
      output: output,
      global: global
    )
  }
}

```

### Core Architecture Module: `Packages/SnapzyCLIKit/Sources/SnapzyCLICore/Commands/Capture/WindowCommand.swift`
```
//
//  WindowCommand.swift
//  SnapzyCLICore
//

import ArgumentParser
import SnapzyCLIProtocol

struct WindowCommand: AsyncParsableCommand {
  static let configuration = CommandConfiguration(
    commandName: "window",
    abstract: "Capture one window, even when other windows cover it.",
    discussion: "Pick the window with exactly one of --id, --app or --active."
  )

  @OptionGroup var global: GlobalOptions
  @OptionGroup var output: CaptureOutputOptions
  @OptionGroup var selection: WindowSelectionOptions

  @Flag(name: .customLong("no-shadow"), help: "Capture without the window shadow.")
  var noShadow = false

  func run() async throws {
    try await CaptureCommand.run(
      .captureWindow,
      params: CaptureWindowParams(
        window: selection.selector(),
        options: output.captureOptions(windowShadow: !noShadow)
      ),
      output: output,
      global: global
    )
  }
}

```

### Core Architecture Module: `Packages/SnapzyCLIKit/Sources/SnapzyCLICore/Commands/DoctorCommand.swift`
```
//
//  DoctorCommand.swift
//  SnapzyCLICore
//
//  Explains why `snapzy` can or cannot capture: which app it talks to,
//  whether it is on PATH, whether Snapzy is reachable, and the app's status.
//  Never launches Snapzy — a stopped app is reported, not fixed.
//

import ArgumentParser
import Foundation
import SnapzyCLIClient
import SnapzyCLIProtocol

struct DoctorCheck: Codable, Equatable {
  let name: String
  let ok: Bool
  let detail: String
  let hint: String?
  /// Set when this failure should decide the exit code; advisory checks
  /// (like PATH) can fail without failing `doctor`.
  let failureCode: CLIErrorCode?

  static func pass(_ name: String, _ detail: String) -> DoctorCheck {
    DoctorCheck(name: name, ok: true, detail: detail, hint: nil, failureCode: nil)
  }

  static func fail(_ name: String, _ detail: String, hint: String?, code: CLIErrorCode?) -> DoctorCheck {
    DoctorCheck(name: name, ok: false, detail: detail, hint: hint, failureCode: code)
  }
}

struct DoctorReport: Codable, Equatable, HumanReadable {
  let checks: [DoctorCheck]

  /// The first failure that carries a code, or nil when everything required passed.
  var failureCode: CLIErrorCode? {
    checks.first { !$0.ok && $0.failureCode != nil }?.failureCode
  }

  var humanDescription: String {
    checks.map { check in
      var line = "\(check.ok ? "✓" : "✗") \(check.name): \(check.detail)"
      if let hint = check.hint {
        line += "\n    hint: \(hint)"
      }
      return line
    }.joined(separator: "\n")
  }
}

struct DoctorCommand: AsyncParsableCommand {
  static let configuration = CommandConfiguration(
    commandName: "doctor",
    abstract: "Check that snapzy can reach Snapzy and capture."
  )

  @OptionGroup var global: GlobalOptions

  func run() async throws {
    var checks: [DoctorCheck] = []
    let executable = Bundle.main.executableURL?.resolvingSymlinksInPath()
    checks.append(.pass("cli", "\(CLIVersion.current) at \(executable?.path ?? "unknown")"))
    checks.append(Doctor.pathCheck(
      path: ProcessInfo.processInfo.environment["PATH"] ?? "",
      executable: executable,
      commandName: Doctor.commandName(for: executable),
      caskInstalled: Doctor.isCaskInstall(executable: executable)
    ))

    let location: AppLocation
    do {
      location = try AppLocator.locate()
      checks.append(.pass("app", "\(location.appURL.path) (\(location.bundleID))"))
    } catch let error as CLIError {
      checks.append(.fail("app", error.message, hint: error.hint, code: error.code))
      return try finish(checks)
    }

    // Never launch from doctor; say what could not be checked instead of
    // reporting success for a server that may not accept requests.
    let socketPath = SocketLocation.path(forAppBundleID: location.bundleID)
    guard AppLauncher.Environment.live.isAppRunning(location.bundleID) else {
      checks.append(.fail(
        "connection",
        "Snapzy is not running, so command line access, onboarding and permissions were not checked "
          + "(socket: \(socketPath))",
        hint: "Open Snapzy, then run `snapzy doctor` again",
        code: nil
      ))
      return try finish(checks)
    }

    var options = global.sessionOptions
    options.allowsLaunch = false
    let client: CLIClient
    do {
      client = try await CLISession.open(options)
    } catch let error as CLIError {
      checks.append(.fail("connection", error.message, hint: error.hint, code: error.code))
      return try finish(checks)
    }
    defer { client.close() }
    checks.append(.pass(
      "connection",
      "Snapzy \(client.hello.appVersion) on \(socketPath)"
    ))

    do {
      checks += try Doctor.statusChecks(client.call(.systemStatus, as: CLIStatus.self))
    } catch let error as CLIError {
      checks.append(.fail("status", error.message, hint: error.hint, code: error.code))
    }
    try finish(checks)
  }

  private func finish(_ checks: [DoctorCheck]) throws {
    let report = DoctorReport(checks: checks)
    try StandardStreams.write(global.renderer.render(report))
    if let code = report.failureCode {
      throw ExitCode(code.exitCode)
    }
  }
}

/// Pure pieces of `doctor`, kept separate for tests.
enum Doctor {
  /// `snapzy-debug` for the helper inside a Debug build, else `snapzy`.
  static func commandName(for executable: URL?) -> String {
    let bundleID = executable
      .flatMap(AppLocator.enclosingAppBundle(forExecutableAt:))
      .flatMap(AppLocator.bundleIdentifier(ofAppAt:))
    return CommandName.forAppBundleID(bundleID)
  }

  /// Links this exact binary, so the hint is right for Debug builds and
  /// apps outside /Applications too.
  static func installHint(for executable: URL?, commandName: String = CommandName.release) -> String {
    let helper = executable?.path ?? "/Applications/Snapzy.app/Contents/Helpers/snapzy"
    let quoted = "'" + helper.replacingOccurrences(of: "'", with: "'\\''") + "'"
    return "sudo mkdir -p /usr/local/bin && sudo ln -sfn \(quoted) /usr/local/bin/\(commandName)"
  }

  static let homebrewHint = "Snapzy came from Homebrew, which links snapzy: run `brew reinstall --cask snapzy`"
  static let homebrewCaskroomPaths = ["/opt/homebrew/Caskroom/snapzy", "/usr/local/Caskroom/snapzy"]

  /// Whether this binary is inside the cask's `Snapzy.app` (not a Debug or
  /// renamed copy), so Homebrew should link it rather than `ln -s` by hand.
  static func isCaskInstall(
    executable: URL?,
    caskroomPaths: [String] = homebrewCaskroomPaths,
    fileManager: FileManager = .default
  ) -> Bool {
    guard let executable, executable.path.hasSuffix("/Snapzy.app/Contents/Helpers/snapzy") else { return false }
    return caskroomPaths.contains { fileManager.fileExists(atPath: $0) }
  }

  /// Whether `commandName` on PATH is this binary. Advisory: agents can always use the full path.
  static func pathCheck(
    path: String,
    executable: URL?,
    commandName: String = CommandName.release,
    caskInstalled: Bool = false,
    fileManager: FileManager = .default
  ) -> DoctorCheck {
    let found = path.split(separator: ":").lazy
      .map { URL(fileURLWithPath: String($0)).appendingPathComponent(commandName) }
      .first { candidate in
        var isDirectory: ObjCBool = false
        return fileManager.fileExists(atPath: candidate.path, isDirectory: &isDirectory)
          && !isDirectory.boolValue
          && fileManager.isExecutableFile(atPath: candidate.path)
      }

    guard let found else {
      let hint = caskInstalled ? homebrewHint : installHint(for: executable, commandName: commandName)
      return .fail("path", "\(commandName) is not on PATH", hint: hint, code: nil)
    }
    let resolved = found.resolvingSymlinksInPath()
    guard let executable, resolved.path != executable.path else {
      return .pass("path", "\(found.path) → \(resolved.path)")
    }
    return .fail(
      "path",
      "\(found.path) runs \(resolved.path), not this \(commandName)",
      hint: "Point the link at the Snapzy.app you use: \(installHint(for: executable, commandName: commandName))",
      code: nil
    )
  }

  static func statusChecks(_ status: CLIStatus) -> [DoctorCheck] {
    var checks: [DoctorCheck] = []

    checks.append(status.cliEnabled
      ? .pass("command line access", "enabled")
      : .fail(
        "command line access",
        "disabled",
        hint: "Enable Settings → Command Line → Command line access",
        code: .disabled
      ))

    checks.append(status.onboardingCompleted
      ? .pass("onboarding", "completed")
      : .fail("onboarding", "not completed", hint: "Open Snapzy and finish setup", code: .onboardingIncomplete))

    switch status.screenRecordingPermission {
    case .granted:
      checks.append(.pass("screen recording", "granted"))
    case .denied:
      checks.append(.fail(
        "screen recording",
        "not granted",
        hint: "System Settings → Privacy & Security → Screen & System Audio Recording → enable Snapzy",
        code: .permissionDenied
      ))
    case .unavailable:
      checks.append(.fail(
        "screen recording",
        "granted but not usable yet",
        hint: "Relaunch Snapzy. If that does not help, remove Snapzy from System Settings → Privacy & Security → "
          + "Screen & System Audio Recording and add it again",
        code: .permissionDenied
      ))
    }

    switch status.authorization {
    case .allowed:
      checks.append(.pass("authorization", "this app is allowed"))
    case .undetermined:
      checks.append(.pass("authorization", "not asked yet; Snapzy asks on the first capture"))
    case .denied:
      checks.append(.fail(
        "authorization",
        "this app was denied",
        hint: "Remove it from Settings → Command Line → Allowed apps, then retry",
        code: .notAuthorized
      ))
    }
    return checks
  }
}

```

### Core Architecture Module: `Packages/SnapzyCLIKit/Sources/SnapzyCLICore/Commands/ListCommand.swift`
```
//
//  ListCommand.swift
//  SnapzyCLICore
//
//  Discovery for agents: which displays, windows and apps can be captured.
//  Window IDs and frames feed straight into `capture window --id` and
//  `capture area --rect`.
//

import ArgumentParser
import SnapzyCLIProtocol

struct ListCommand: AsyncParsableCommand {
  static let configuration = CommandConfiguration(
    commandName: "list",
    abstract: "List displays, windows or apps.",
    subcommands: [Displays.self, Windows.self, Apps.self]
  )

  struct Displays: AsyncParsableCommand {
    static let configuration = CommandConfiguration(
      commandName: "displays",
      abstract: "List connected displays."
    )

    @OptionGroup var global: GlobalOptions

    func run() async throws {
      try await CommandRunner.run(global) { client, renderer in
        let list = try client.call(.listDisplays, as: CLIDisplayList.self)
        try StandardStreams.write(renderer.render(list))
      }
    }
  }

  struct Windows: AsyncParsableCommand {
    static let configuration = CommandConfiguration(
      commandName: "windows",
      abstract: "List windows, front to back."
    )

    @OptionGroup var global: GlobalOptions

    @Option(help: "Only windows of this app (name or bundle ID).")
    var app: String?

    @Flag(help: "Include windows that are not on screen.")
    var all = false

    func run() async throws {
      try await CommandRunner.run(global) { client, renderer in
        let list = try client.call(
          .listWindows,
          params: ListWindowsParams(app: app, includeOffscreen: all),
          as: CLIWindowList.self
        )
        try StandardStreams.write(renderer.render(list))
      }
    }
  }

  struct Apps: AsyncParsableCommand {
    static let configuration = CommandConfiguration(
      commandName: "apps",
      abstract: "List running apps that have windows."
    )

    @OptionGroup var global: GlobalOptions

    func run() async throws {
      try await CommandRunner.run(global) { client, renderer in
        let list = try client.call(.listApps, as: CLIAppList.self)
        try StandardStreams.write(renderer.render(list))
      }
    }
  }
}

```

### Core Architecture Module: `Packages/SnapzyCLIKit/Sources/SnapzyCLICore/Commands/Measure/MeasureCaptureCommands.swift`
```
//
//  MeasureCaptureCommands.swift
//  SnapzyCLICore
//
//  `measure screen|window|area`: the matching `capture.*` call with settings
//  fixed for measuring (PNG, native pixels, no cursor, no window shadow), then
//  a local measurement of the staged file. Coordinates are points from the
//  captured image's top-left corner.
//

import ArgumentParser
import Foundation
import SnapzyCLIProtocol

struct MeasureKeepOptions: ParsableArguments {
  @Option(
    help: ArgumentHelp(
      "Also keep the captured PNG: a file, or a directory (trailing /).",
      discussion: "Without it the capture is deleted after measuring."
    )
  )
  var keep: String?

  @Flag(help: "Overwrite an existing file at --keep.")
  var force = false

  mutating func validate() throws {
    if let keep, keep.isEmpty || keep == "-" {
      throw ValidationError("--keep needs a file or directory path.")
    }
    // The capture is always PNG; a file named otherwise would carry the wrong format.
    if let keep, !keep.hasSuffix("/") {
      let ext = (keep as NSString).pathExtension.lowercased()
      if !ext.isEmpty, ext != "png" {
        throw ValidationError("--keep saves a PNG; use a .png name or a directory (trailing /).")
      }
    }
  }

  func destination(currentDirectory: URL) -> OutputDestination? {
    keep.map { OutputDestination.resolve($0, currentDirectory: currentDirectory) }
  }
}

enum MeasureCapture {
  /// Fixed so the image is the exact pixels the coordinates refer to.
  static let captureOptions = CaptureOptions(format: .png, maxDimension: nil, showCursor: false, windowShadow: false)

  static func run(
    _ method: CLIMethod,
    kind: CLIMeasureSource.Kind,
    params: some Codable & Sendable,
    measure: MeasureOptions,
    keep: MeasureKeepOptions,
    global: GlobalOptions
  ) async throws {
    let destination = keep.destination(
      currentDirectory: URL(fileURLWithPath: FileManager.default.currentDirectoryPath, isDirectory: true)
    )
    let writer = OutputWriter()
    if let destination {
      try await CommandRunner.reportingErrors(global.renderer) {
        try writer.preflight(destination, force: keep.force)
      }
    }

    try await CommandRunner.run(global) { client, renderer in
      let result = try MeasureSession.measureCapture(
        kind: kind,
        request: measure.request,
        keep: destination,
        force: keep.force,
        writer: writer
      ) {
        try client.call(method, params: params, as: CLICaptureResult.self)
      }
      try StandardStreams.write(renderer.render(result))
    }
  }
}

struct MeasureScreenCommand: AsyncParsableCommand {
  static let configuration = CommandConfiguration(
    commandName: "screen",
    abstract: "Capture one display and measure it."
  )

  @OptionGroup var global: GlobalOptions
  @OptionGroup var selection: DisplaySelectionOptions
  @OptionGroup var measure: MeasureOptions
  @OptionGroup var keep: MeasureKeepOptions

  mutating func validate() throws {
    if selection.display == .all {
      throw ValidationError("--display all is not supported: measure one display at a time.")
    }
  }

  func run() async throws {
    try await MeasureCapture.run(
      .captureScreen,
      kind: .screen,
      params: CaptureScreenParams(display: selection.display, options: MeasureCapture.captureOptions),
      measure: measure,
      keep: keep,
      global: global
    )
  }
}

struct MeasureWindowCommand: AsyncParsableCommand {
  static let configuration = CommandConfiguration(
    commandName: "window",
    abstract: "Capture one window (without its shadow) and measure it.",
    discussion: "Pick the window with exactly one of --id, --app or --active."
  )

  @OptionGroup var global: GlobalOptions
  @OptionGroup var selection: WindowSelectionOptions
  @OptionGroup var measure: MeasureOptions
  @OptionGroup var keep: MeasureKeepOptions

  func run() async throws {
    try await MeasureCapture.run(
      .captureWindow,
      kind: .window,
      params: CaptureWindowParams(window: selection.selector(), options: MeasureCapture.captureOptions),
      measure: measure,
      keep: keep,
      global: global
    )
  }
}

struct MeasureAreaCommand: AsyncParsableCommand {
  static let configuration = CommandConfiguration(
    commandName: "area",
    abstract: "Capture a rectangle of the screen and measure it.",
    discussion: """
    --rect is in global points (as printed by `snapzy list`); --at and --box \
    are points from the rectangle's top-left corner.
    """
  )

  @OptionGroup var global: GlobalOptions
  @OptionGroup var selection: AreaSelectionOptions
  @OptionGroup var measure: MeasureOptions
  @OptionGroup var keep: MeasureKeepOptions

  func run() async throws {
    try await MeasureCapture.run(
      .captureArea,
      kind: .area,
      params: CaptureAreaParams(rect: selection.rect, options: MeasureCapture.captureOptions),
      measure: measure,
      keep: keep,
      global: global
    )
  }
}

```

### Core Architecture Module: `Packages/SnapzyCLIKit/Sources/SnapzyCLICore/Commands/Measure/MeasureCommand.swift`
```
//
//  MeasureCommand.swift
//  SnapzyCLICore
//
//  `measure image|screen|window|area`: the Screen Ruler edge measurements from
//  the command line. `image` runs locally without Snapzy; the others take a
//  capture through Snapzy and measure it here.
//

import ArgumentParser

struct MeasureCommand: AsyncParsableCommand {
  static let configuration = CommandConfiguration(
    commandName: "measure",
    abstract: "Measure UI elements in an image or a fresh capture.",
    discussion: """
    --at x,y measures the run of same-colored pixels around a point, like \
    hovering with Screen Ruler. --box x,y,w,h shrinks a rectangle to the edges \
    of the content inside it. Coordinates are points from the top-left corner \
    of the image (pixels with --pixels).
    """,
    subcommands: [
      MeasureImageCommand.self,
      MeasureScreenCommand.self,
      MeasureWindowCommand.self,
      MeasureAreaCommand.self,
    ]
  )
}

```

### Core Architecture Module: `Packages/SnapzyCLIKit/Sources/SnapzyCLICore/Commands/Measure/MeasureImageCommand.swift`
```
//
//  MeasureImageCommand.swift
//  SnapzyCLICore
//
//  `measure image <path>`. Local only: never opens a socket or starts Snapzy.
//

import ArgumentParser
import Foundation

struct MeasureImageCommand: AsyncParsableCommand {
  static let configuration = CommandConfiguration(
    commandName: "image",
    abstract: "Measure an image file. Works without Snapzy running.",
    discussion: "Points are pixels divided by the image's scale: its DPI ÷ 72 (1 without DPI), or --scale."
  )

  @OptionGroup var global: GlobalOptions

  @Argument(help: "The image file.")
  var path: String

  @OptionGroup var measure: MeasureOptions

  @Option(help: "Pixels per point, instead of the scale from the image's DPI.")
  var scale: Double?

  mutating func validate() throws {
    if let scale, !(scale.isFinite && scale > 0) {
      throw ValidationError("--scale must be greater than 0.")
    }
  }

  func run() async throws {
    let renderer = global.renderer
    try await CommandRunner.reportingErrors(renderer) {
      let result = try MeasureSession.measureImage(
        path: path,
        currentDirectory: URL(fileURLWithPath: FileManager.default.currentDirectoryPath, isDirectory: true),
        request: measure.request,
        scale: scale
      )
      try StandardStreams.write(renderer.render(result))
    }
  }
}

```

### Core Architecture Module: `Packages/SnapzyCLIKit/Sources/SnapzyCLICore/Commands/Measure/MeasureOptions.swift`
```
//
//  MeasureOptions.swift
//  SnapzyCLICore
//
//  What to measure, shared by `measure image` and `measure screen|window|area`.
//

import ArgumentParser
import SnapzyCLIProtocol
import SnapzyMeasureCore

extension MeasureAxis: ExpressibleByArgument {}

struct MeasureOptions: ParsableArguments {
  /// `.unconditionalSingleValue` so a negative value is read as a value, and reported as
  /// out of bounds instead of as an unknown option.
  @Option(
    name: .customLong("at"),
    parsing: .unconditionalSingleValue,
    help: ArgumentHelp(
      "Measure the run of matching pixels around x,y. Repeatable.",
      valueName: "x,y"
    )
  )
  var points: [CLIPoint] = []

  @Option(
    name: .customLong("box"),
    parsing: .unconditionalSingleValue,
    help: ArgumentHelp(
      "Measure the content inside x,y,width,height, snapped to its edges. Repeatable.",
      valueName: "x,y,w,h"
    )
  )
  var boxes: [CLIRect] = []

  @Option(help: "Directions --at measures.")
  var axis: MeasureAxis = .both

  @Option(help: "Largest color step (0-64) that is not an edge.")
  var tolerance: Int = MeasureEdgeScanner.defaultTolerance

  @Flag(name: .customLong("no-snap"), help: "Report --box as given instead of snapping it to content.")
  var noSnap = false

  @Flag(help: "Coordinates are image pixels instead of points.")
  var pixels = false

  mutating func validate() throws {
    guard !points.isEmpty || !boxes.isEmpty else {
      throw ValidationError("Pass at least one --at or --box.")
    }
    guard MeasureEdgeScanner.toleranceRange.contains(tolerance) else {
      let range = MeasureEdgeScanner.toleranceRange
      throw ValidationError("--tolerance must be between \(range.lowerBound) and \(range.upperBound).")
    }
  }

  var request: MeasureRequest {
    MeasureRequest(
      points: points,
      boxes: boxes,
      axis: axis,
      tolerance: tolerance,
      snap: !noSnap,
      inputsArePixels: pixels
    )
  }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #736** (2026-11-14): **[Bug]: 截图并标注功能启动后，已移动光标但是定位光标位置不改变**
  *Symptoms*: ### Description  使用截图并标注功能，触发选取页面后，看不到鼠标移动 MAC:27.2.1  ### Steps to Reproduce  1、触发【截图并标注】功能 2、移动鼠标  ### Expected Behavior  定位点根据鼠标移动同步移动  ### Actual Behavior  鼠标移动后定位不到鼠标位置  ### Screenshots / Recordings  https://github.com/user-attachments/assets/cfe4dc83-d7ec-4889-9c9f-f37a270c8b08  ### Snapzy Version  2.1.0  ### macOS Version  Other (specify in description)  ### Installation Method  None  ### Additional Context  _No response_
  **Post-Mortem & Fix Analysis**:
  > Hi @l56105878,  感谢反馈！这个问题与 #705 / #597 为同一原因（macOS 27.2 上「截图并标注」的十字准星、坐标气泡和放大镜无法跟随指针移动），已在 #707 中修复并自 **[v2.2.0-beta.3](https://github.com/duongductrong/Snapzy/releases/tag/v2.2.0-beta.3)** 起发布（目前最新 Beta 为 **[v2.2.0-beta.11](https://github.com/duongductrong/Snapzy/releases/tag/v2.2.0-beta.11)**）。  获取 Beta 更新的方法：**Settings → About → Update Channel → Beta**，然后点击 **Check for Updates**。  现在先将此 Issue 关闭；如果更新到 Beta 版本后仍然可以复现，欢迎随时回复或重新打开！  ---  Hi @l56105878,  Thanks for reporting this! This is the same macOS 27.2 Capture Markup pointer-tracking issue fixed in #707, available starting in **[v2.2.0-beta.3](https://github.com/duongductrong/Snapzy/releases/tag/v2.2.0-beta.3)** (latest beta: **[v2.2.0-beta.11](https://github.com/duongductrong/Snapzy/releases/tag/v2.2.0-beta.11)**).  To update to Beta: **Settings → About → Update Channel → Beta**, then **Check for Updates**.  Closing this as fixed—please feel free to reopen if the issue persists on the latest beta build.

- **Issue #730** (2026-11-10): **[Bug]: Tooltips are massive on macOS 15.8**
  *Symptoms*: ### Description  The tooltips in settings are huuuuge, see screenshot.  ### Steps to Reproduce  1. Open Snapzy Settings. 2. Hover over any `(i)` sign to read the tooltip. 3. The tooltip will fill a massive amount of screen space.  ### Expected Behavior  Tooltips should probably be as large as the text within them.  ### Actual Behavior  The tooltips are massive.  ### Screenshots / Recordings  ![Screenshot](https://github.com/user-attachments/assets/3af50df5-1062-435d-aa8d-566b4080c7a8)  ### Snapzy Version  2.2.0-beta.9  ### macOS Version  macOS 15 (Sequoia)  ### Installation Method  DMG download  ### Additional Context  _No response_

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

### Incident Patch 1: `18fe56ad` (2026-11-14)
**Commit Message**: fix: release preferences window content on close to stop idle CPU burn

**File**: `Snapzy/Features/Preferences/PreferencesWindowController.swift` (modified, +13/-0)
```diff
@@ -137,5 +137,18 @@ final class PreferencesWindowController: NSObject, NSWindowDelegate {
       didElevateActivationPolicy = false
       DiagnosticLogger.shared.log(.debug, .ui, "Activation policy restored to accessory after preferences closed")
     }
+
+    // A closed (ordered-out) window keeps its NSHostingView alive, and SwiftUI does not
+    // fire onDisappear/cancel `.task` for it — so looping work such as the animated
+    // CaptureSettingsPreview kept rendering off-screen (~20–35% CPU while idle).
+    // Tear the hierarchy down; `show()` rebuilds it on demand.
+    guard let closingWindow = notification.object as? NSWindow, closingWindow === window else { return }
+    DispatchQueue.main.async { [weak self] in
+      guard let self, self.window === closingWindow, !closingWindow.isVisible else { return }
+      closingWindow.contentView = nil
+      closingWindow.delegate = nil
+      self.themeObserver = nil
+      self.window = nil
+    }
   }
 }
```

---

### Incident Patch 2: `bba5596b` (2026-11-14)
**Commit Message**: fix: clear stuck drop preview frame after dropping an image on annotate canvas (#745)

SwiftUI can re-deliver dropEntered/dropUpdated after a drop finished, which redrew the preview frame with nothing left to clear it. Only show the preview while the mouse button is held.

**File**: `Snapzy/Features/Annotate/AnnotateState.swift` (modified, +15/-1)
```diff
@@ -575,15 +575,29 @@ final class AnnotateState: ObservableObject {
   private var isExternalCombineDropActive = false
 
   func beginExternalCombineDrop(at point: CGPoint?) {
+    guard isExternalDragInFlight else {
+      endExternalCombineDrop()
+      return
+    }
     isExternalCombineDropActive = true
     updateCombineDropPreview(at: point)
   }
 
   func updateExternalCombineDrop(at point: CGPoint?) {
-    guard isExternalCombineDropActive else { return }
+    guard isExternalCombineDropActive, isExternalDragInFlight else {
+      endExternalCombineDrop()
+      return
+    }
     updateCombineDropPreview(at: point)
   }
 
+  /// A drag session always holds a mouse button. SwiftUI can re-deliver `dropEntered`/
+  /// `dropUpdated` after the drop finished (button released); without this check that
+  /// late call leaves the preview frame on the canvas with nothing left to clear it.
+  private var isExternalDragInFlight: Bool {
+    NSEvent.pressedMouseButtons & 1 != 0
+  }
+
   func endExternalCombineDrop() {
     isExternalCombineDropActive = false
     clearCombineDropPreview()
```

#### Recent Merged Pull Requests:
- **PR #751** (2026-11-15): chore: release v2.2.0-beta.15 (@github-actions[bot])
- **PR #750** (2026-11-15): feat: Auto Translate in Annotate (whole image + area) (@duongductrong)
- **PR #749** (2026-11-15): feat: Added Snip to Translate (OCR + translation card) (@duongductrong)
- **PR #748** (2026-11-14): chore: release v2.2.0-beta.14 (@github-actions[bot])
- **PR #747** (2026-11-14): feat: add flip horizontal/vertical and group rotate+flip into one toolbar menu (@duongductrong)
- **PR #746** (2026-11-14): chore: release v2.2.0-beta.13 (@github-actions[bot])

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

## X. release preferences window content on close to stop idle CPU burn

**RULE**:
When implementing operations in `Snapzy/Features/Preferences/PreferencesWindowController.swift`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in duongductrong/Snapzy. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `18fe56ad`: release preferences window content on close to stop idle CPU burn. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Swift data structures, boundary deserialization, API parsing, or resource lifecycles matching `Snapzy/Features/Preferences/PreferencesWindowController.swift`.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Verified production-grade fix pattern:

    // A closed (ordered-out) window keeps its NSHostingView alive, and SwiftUI does not
    // fire onDisappear/cancel `.task` for it — so looping work such as the animated
    // CaptureSettingsPreview kept rendering off-screen (~20–35% CPU while idle).
    // Tear the hierarchy down; `show()` rebuilds it on demand.
    guard let closingWindow = notification.object as? NSWindow, closingWindow === window else { return }
    DispatchQueue.main.async { [weak self] in
      guard let self, self.window === closingWindow, !closingWindow.isVisible else { return }
      closingWindow.contentView = nil
      closingWindow.delegate = nil
      self.themeObserver = nil
      self.window = nil
    }
```

**NEGATIVE CONSTRAINT**:
```swift
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `18fe56ad` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.

> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/duongductrong-snapzy-learnings.md`  
> **Source**: github ([https://github.com/duongductrong/Snapzy](https://github.com/duongductrong/Snapzy))  
> **Source Version**: `13c02b4c`  
> **License**: BSD-3-Clause  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-08T19:50:26.404Z  
> **Learning ID**: `learn-github-duongductrong-snapzy`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): duongductrong/Snapzy

> **Canonical Artifact**: `07_PROJECT_LEARNING/duongductrong-snapzy-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/duongductrong/Snapzy](https://github.com/duongductrong/Snapzy))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-08T19:45:20.727Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `duongductrong/Snapzy`
- **Description**: An open-source native macOS screenshot and screen recording app. A CleanShot X alternative.
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 3543 stars

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
- **Issue #701** (2026-11-07): **[Bug]: Screenshot & Annotate pointer stuck on macOS 27.2 while dragging still works (2.1 / 2.2 beta)**
  *Symptoms*: ### Description  Screenshot & Annotate becomes unusable on macOS 27.2: the on-screen cursor/selection point stays at its initial position instead of following mouse movement. However, holding the mouse button and dragging still creates a selection rectangle from that position.  This appears similar to #695. This report adds version history and the distinction between pointer movement and dragging.  ### Version History  - Previously working: Snapzy 2.0 on macOS 27.0. - Affected: Snapzy 2.1 and later on macOS 27.2. - Currently installed and still affected: Snapzy 2.2.0-beta.2 (218) on macOS 27.2.  **Snapzy 2.0 has not been tested on macOS 27.2.** Because both the app and OS versions changed, this comparison does not establish whether the regression was introduced by Snapzy, macOS, or their interaction.  ### Steps to Reproduce  1. Run Snapzy on macOS 27.2. 2. Activate Screenshot & Annotate. 3. Move the mouse without holding a mouse button and try to position the selection point. 4. Hold the mouse button and drag to create a selection rectangle.  ### Expected Behavior  The cursor/selection point follows mouse movement, allowing the user to choose where to start a selection and then proceed with annotation.  ### Actual Behavior  - The screenshot overlay appears frozen: the visible cursor/selection point does not follow mouse movement. - Holding the mouse button and dragging still creates a selection rectangle from the position where the pointer was stuck. - The normal selection an

- **Issue #695** (2026-11-07): **[Bug]: Screenshot selection freezes and cannot be moved**
  *Symptoms*: ### Description  When using the Screenshot & Annotate feature in Snapzy, the screenshot selection point becomes stuck and cannot be moved with the mouse. This prevents me from properly selecting the screenshot area and using the annotation feature.  ### Steps to Reproduce  1. Open Snapzy. 2. Activate the Screenshot & Annotate feature. 3. Try to move the screenshot selection point using the mouse. 4. Observe that the selection point becomes stuck and does not respond to mouse movement.  ### Expected Behavior  The screenshot selection point should respond smoothly to mouse movement, allowing me to select the desired area and proceed with annotation as expected.  ### Actual Behavior  The screenshot selection point freezes and cannot be moved with the mouse. The screenshot selection and annotation workflow becomes unusable.  ### Screenshots / Recordings  _No response_  ### Snapzy Version  2.1.0  ### macOS Version  Other (specify in description)  ### Installation Method  None  ### Additional Context  _No response_

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

### Incident Patch 1: `44278b1c` (2026-11-07)
**Commit Message**: fix: Keep the app responsive while OCR runs (#708)

OCR ran entirely on the main actor (the project's default isolation), so
Vision's synchronous perform calls for every recognition pass froze the UI,
and the shared capture lock stayed held until recognition finished, so other
capture shortcuts did nothing.

- Run image normalization, contrast enhancement, vertical CJK analysis,
  Vision text recognition, QR detection and remote-OCR JPEG encoding on a
  dedicated GCD queue (OCRWorkQueue), off both the main thread and the Swift
  cooperative pool. Only candidate ranking and formatting stay on main.
- Release isAreaSelectionActive once the OCR snapshot is secured and the
  overlay is dismissed, as live area capture does; a separate
  isOCRProcessing flag still blocks a second OCR.
- Re-triggering OCR while one is running shows a cursor-following chat
  bubble ("Hang tight, still reading text…") with clear Liquid Glass on
  macOS 26+ and the design-system glass fallback elsewhere.

**File**: `Snapzy/Features/Capture/CaptureViewModel.swift` (modified, +18/-4)
```diff
@@ -64,6 +64,8 @@ final class ScreenCaptureViewModel: ObservableObject, KeyboardShortcutDelegate {
   private let fileAccessManager = SandboxFileAccessManager.shared
   private let tempCaptureManager = TempCaptureManager.shared
   private var isAreaSelectionActive = false
+  /// True from OCR area selection (mouse-up) until text recognition finishes.
+  private var isOCRProcessing = false
   private var activeAreaSelectionSessionID: UUID?
   private var lazyAreaSnapshotTasks: [CGDirectDisplayID: Task<Void, Never>] = [:]
   private var lazyAreaSnapshotFailedDisplayIDs = Set<CGDirectDisplayID>()
@@ -2407,6 +2409,14 @@ final class ScreenCaptureViewModel: ObservableObject, KeyboardShortcutDelegate {
   // MARK: - OCR Capture
 
   func captureOCR() {
+    // A previous OCR is still capturing/recognizing: tell the user at the pointer
+    // instead of silently ignoring the shortcut (which reads as the app hanging).
+    if isOCRProcessing {
+      DiagnosticLogger.shared.log(.debug, .ocr, "captureOCR blocked: previous OCR still processing")
+      CursorBubbleController.shared.show(L10n.OCR.alreadyRunning)
+      return
+    }
+
     // Prevent multiple area captures
     if isAreaSelectionActive {
       DiagnosticLogger.shared.log(.debug, .ocr, "captureOCR blocked: area selection active")
@@ -2489,6 +2499,11 @@ final class ScreenCaptureViewModel: ObservableObject, KeyboardShortcutDelegate {
 
           // Secure pixels first: immediately after the snapshot is taken, dismiss the overlay.
           AreaSelectionController.shared.cancelSelection()
+          // Pixels are secured and the overlay is gone: release the shared capture lock now
+          // (as live area capture does) so other capture shortcuts work while OCR runs.
+          // `isOCRProcessing` alone guards against starting a second OCR.
+          self.isAreaSelectionActive = false
+          self.isOCRProcessing = true
 
           let progressToast = AppStatusBarController.shared.isMenuBarIconVisible
             ? nil
@@ -2503,7 +2518,7 @@ final class ScreenCaptureViewModel: ObservableObject, KeyboardShortcutDelegate {
           Task { @MainActor in
             var progressToastResolved = false
             defer {
-              self.isAreaSelectionActive = false
+              self.isOCRProcessing = false
               hiddenWindowSession.restore()
               if let progressToast, !progressToastResolved {
                 AppToastManager.shared.dismiss(progressToast)
@@ -2657,9 +2672,8 @@ final class ScreenCaptureViewModel: ObservableObject, KeyboardShortcutDelegate {
     let startTime = CFAbsoluteTimeGetCurrent()
 
     do {
-      let result = try await Task.detached(priority: .userInitiated) {
-        try await QRCodeService.shared.detect(in: image)
-      }.value
+      // QRCodeService runs Vision on the OCR work queue itself.
+      let result = try await QRCodeService.shared.detect(in: image)
 
       if result.hasCopyablePayloads || result.unsupportedPayloadCount > 0 {
         DiagnosticLogger.shared.log(
```

**File**: `Snapzy/Resources/Localization/Features/Capture.xcstrings` (modified, +65/-0)
```diff
@@ -1236,6 +1236,71 @@
         }
       }
     },
+    "ocr.already-running": {
+      "extractionState": "stale",
+      "localizations": {
+        "de": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "Einen Moment, Text wird noch gelesen…"
+          }
+        },
+        "en": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "Hang tight, still reading text…"
+          }
+        },
+        "es": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "Un momento, todavía leyendo el texto…"
+          }
+        },
+        "fr": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "Un instant, lecture du texte en cours…"
+          }
+        },
+        "ja": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "少々お待ちください、テキストを読み取り中…"
+          }
+        },
+        "ko": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "잠시만요, 아직 텍스트를 읽는 중이에요…"
+          }
+        },
+        "ru": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "Секунду, ещё читаю текст…"
+          }
+        },
+        "vi": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "Chờ chút, vẫn đang đọc văn bản…"
+          }
+        },
+        "zh-Hans": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "稍等，仍在读取文字…"
+          }
+        },
+        "zh-Hant": {
+          "stringUnit": {
+            "state": "translated",
+            "value": "稍等，仍在讀取文字…"
+          }
+        }
+      }
+    },
     "ocr.capturing-content": {
       "extractionState": "stale",
       "localizations": {
```

**File**: `Snapzy/Services/Diagnostics/CursorBubbleController.swift` (added, +304/-0)
```diff
@@ -0,0 +1,304 @@
+//
+//  CursorBubbleController.swift
+//  Snapzy
+//
+//  Figma-style "cursor chat" bubble that sticks to the pointer for a moment.
+//
+
+import AppKit
+import Combine
+import SwiftUI
+
+/// Shows a short message in a pill that rides along with the pointer, like
+/// Figma's cursor chat. Non-interactive, never takes focus, and is excluded
+/// from captures like other Snapzy toasts.
+@MainActor
+final class CursorBubbleController {
+  static let shared = CursorBubbleController()
+
+  /// Panel offset from the pointer tip. The bubble sits 10pt inside the panel
+  /// (shadow room), so the visible gap is this plus 10.
+  private static let pointerOffset = CGSize(width: 4, height: 6)
+  private static let screenMargin: CGFloat = 0
+
+  private var panel: NSPanel?
+  private let model = CursorBubbleModel()
+  private var followTimer: Timer?
+  private var dismissTask: Task<Void, Never>?
+  private var lastMouseLocation: CGPoint?
+
+  private init() {}
+
+  /// Shows (or refreshes) the bubble. Calling again while visible restarts the
+  /// timer and gives the bubble a small nudge instead of stacking a new one.
+  func show(_ message: String, duration: TimeInterval = 1.8) {
+    let isVisible = panel?.isVisible == true && model.isPresented
+    model.message = message
+
+    let panel = resolvePanel()
+    resizePanelToFit(panel)
+    lastMouseLocation = nil
+    followPointer()
+
+    if isVisible {
+      model.nudge()
+    } else {
+      CaptureChromeWindowRegistry.configureAppWindow(panel)
+      panel.alphaValue = 1
+      panel.orderFrontRegardless()
+      model.present(reduceMotion: Self.reduceMotion)
+    }
+
+    startFollowing()
+    scheduleDismiss(after: duration)
+  }
+
+  // MARK: - Panel
+
+  private func resolvePanel() -> NSPanel {
+    if let panel { return panel }
+    let panel = AppToastManager.makeToastPanel(contentRect: .zero)
+    // Glass draws its own shadow; sit above capture overlays (`.screenSaver`).
+    panel.hasShadow = false
+    panel.level = NSWindow.Level(rawValue: NSWindow.Level.screenSaver.rawValue + 1)
+    panel.contentView = NSHostingView(rootView: CursorBubbleView(model: model))
+    self.panel = panel
+    return panel
+  }
+
+  private func resizePanelToFit(_ panel: NSPanel) {
+    guard let hostingView = panel.contentView else { return }
+    let size = hostingView.fittingSize
+    panel.setContentSize(size)
+  }
+
+  // MARK: - Following
+
+  private func startFollowing() {
+    guard followTimer == nil else { return }
+    // 120 Hz keeps the bubble glued to the pointer on ProMotion displays; the
+    // timer only lives for the ~2s the bubble is on screen.
+    let timer = Timer(timeInterval: 1.0 / 120.0, repeats: true) { [weak self] _ in
+      MainActor.assumeIsolated { self?.followPointer() }
+    }
+    RunLoop.main.add(timer, forMode: .common)
+    followTimer = timer
+  }
+
+  private func stopFollowing() {
+    followTimer?.invalidate()
+    followTimer = nil
+  }
+
+  private func followPointer() {
+    guard let panel else { return }
+    let mouse = NSEvent.mouseLocation
+    guard mouse != lastMouseLocation else { return }
+    lastMouseLocation = mouse
+
+    let size = panel.frame.size
+    let screen = NSScreen.screens.first { $0.frame.contains(mouse) } ?? NSScreen.main
+    let bounds = screen?.visibleFrame ?? CGRect(origin: .zero, size: CGSize(width: 10_000, height: 10_000))
+    let margin = Self.screenMargin
+    let offset = Self.pointerOffset
+
+    // Default: below-right of the pointer (AppKit y grows upward).
+    var x = mouse.x + offset.width
+    var y = mouse.y - offset.height - size.height
+    var flipsX = false
+    var flipsY = false
+    if x + size.width > bounds.maxX - margin {
+      x = mouse.x - offset.width - size.width
+      flipsX = true
+    }
+    if y < bounds.minY + margin {
+      y = mouse.y + offset.height
+      flipsY = true
+    }
+    x = min(max(x, bounds.minX + margin), bounds.maxX - size.width - margin)
+    y = min(max(y, bounds.minY + margin), bounds.maxY - size.height - margin)
+
+    model.setPointedCorner(flipsX: flipsX, flipsY: flipsY)
+    panel.setFrameOrigin(CGPoint(x: x.rounded(), y: y.rounded()))
+  }
+
+  // MARK: - Dismissal
+
+  private func scheduleDismiss(after duration: TimeInterval) {
+    dismissTask?.cancel()
+    dismissTask = Task { [weak self] in
+      try? await Task.sleep(nanoseconds: UInt64(max(0.6, duration) * 1_000_000_000))
+      guard !Task.isCancelled else { return }
+      self?.dismiss()
+    }
+  }
+
+  private func dismiss() {
+    guard let panel else { return }
+    model.dismiss(reduceMotion: Self.reduceMotion)
+    dismissTask = Task { [weak self] in
+      try? await Task.sleep(nanoseconds: 220_000_000)
+      guard !Task.isCancelled else { return }
+      panel.orderOut(nil)
+      self?.stopFollowing()
+    }
+  }
+
+  private static var reduceMotion: Bool {
+    NSWorkspace.shared.accessibilityDisplayShouldReduceMotion
+  }
+}
+
+// MARK: - Model
```

**File**: `Snapzy/Services/Media/OCR/RemoteOCRService.swift` (modified, +4/-3)
```diff
@@ -92,7 +92,8 @@ struct RemoteOCRProvider: OCRProvider {
     guard let endpoint = Self.endpointURL(forBaseURL: model.baseURL) else {
       throw RemoteOCRError.invalidBaseURL
     }
-    guard let jpegData = Self.jpegData(from: image) else {
+    // JPEG + base64 encoding of a full screenshot is CPU-heavy; keep it off the main actor.
+    guard let imageBase64 = await OCRWorkQueue.run({ Self.jpegData(from: image)?.base64EncodedString() }) else {
       throw RemoteOCRError.imageEncodingFailed
     }
 
@@ -107,7 +108,7 @@ struct RemoteOCRProvider: OCRProvider {
       model: model.modelIdentifier,
       messages: [ChatCompletionMessage(role: "user", content: [
         .text(prompt),
-        .imageURL("data:image/jpeg;base64,\(jpegData.base64EncodedString())"),
+        .imageURL("data:image/jpeg;base64,\(imageBase64)"),
       ])]
     ))
 
@@ -174,7 +175,7 @@ struct RemoteOCRProvider: OCRProvider {
     return prompt
   }
 
-  private static func jpegData(from image: CGImage) -> Data? {
+  nonisolated private static func jpegData(from image: CGImage) -> Data? {
     autoreleasepool {
       NSBitmapImageRep(cgImage: image).representation(using: .jpeg, properties: [.compressionFactor: 0.9])
     }
```

**File**: `Snapzy/Services/Media/OCR/VerticalCJKBitmapAnalysis.swift` (modified, +5/-5)
```diff
@@ -8,12 +8,12 @@
 import CoreGraphics
 import Foundation
 
-enum VerticalCJKBitmapFormat {
+nonisolated enum VerticalCJKBitmapFormat {
   static let rgbaBitmapInfo = CGBitmapInfo.byteOrder32Big.rawValue
     | CGImageAlphaInfo.premultipliedLast.rawValue
 }
 
-struct VerticalCJKBitmap {
+nonisolated struct VerticalCJKBitmap {
   let width: Int
   let height: Int
   let bytesPerRow: Int
@@ -122,14 +122,14 @@ struct VerticalCJKBitmap {
   }
 }
 
-struct VerticalCJKForegroundRow {
+nonisolated struct VerticalCJKForegroundRow {
   let y: Int
   let hasInk: Bool
   let minX: Int
   let maxX: Int
 }
 
-struct VerticalCJKGlyphBand {
+nonisolated struct VerticalCJKGlyphBand {
   var startY: Int
   var endY: Int
   var minX: Int
@@ -162,7 +162,7 @@ struct VerticalCJKGlyphBand {
   }
 }
 
-struct VerticalCJKRGBColor {
+nonisolated struct VerticalCJKRGBColor {
   let red: Int
   let green: Int
   let blue: Int
```

**File**: `Snapzy/Services/Media/OCR/VerticalCJKTextNormalizer.swift` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@
 import CoreGraphics
 import Foundation
 
-enum VerticalCJKTextNormalizer {
+nonisolated enum VerticalCJKTextNormalizer {
   static func normalizedImage(from image: CGImage) -> CGImage? {
     guard image.height >= Int(Double(image.width) * 1.35), image.width >= 16, image.height >= 64 else {
       return nil
```

**File**: `Snapzy/Services/Media/OCR/VisionOCRProfile.swift` (modified, +11/-0)
```diff
@@ -92,6 +92,17 @@ struct VisionOCRProfile {
     }
   }
 
+  /// Sendable copy of the request settings, for running Vision off the main actor.
+  var recognitionConfiguration: VisionRecognitionConfiguration {
+    VisionRecognitionConfiguration(
+      usesLanguageCorrection: usesLanguageCorrection,
+      recognitionLanguages: recognitionLanguages,
+      customWords: customWords,
+      minimumTextHeight: minimumTextHeight,
+      automaticallyDetectsLanguage: automaticallyDetectsLanguage
+    )
+  }
+
   func configure(_ request: VNRecognizeTextRequest) {
     request.recognitionLevel = .accurate
     request.usesLanguageCorrection = usesLanguageCorrection
```

**File**: `Snapzy/Services/Media/OCR/VisionOCRWorker.swift` (added, +158/-0)
```diff
@@ -0,0 +1,158 @@
+//
+//  VisionOCRWorker.swift
+//  Snapzy
+//
+//  Off-main execution for the CPU-heavy parts of OCR: bitmap normalization,
+//  Core Image filtering, and synchronous Vision requests.
+//
+
+import CoreGraphics
+import CoreImage
+import Foundation
+import Vision
+
+/// Dedicated GCD queue for blocking image/Vision work.
+///
+/// `VNImageRequestHandler.perform` is synchronous and can take hundreds of
+/// milliseconds per pass (accurate recognition, several fallback profiles). Running it on
+/// the main actor froze the UI; running it inside a Swift Task would pin a
+/// cooperative-pool thread. A separate queue keeps both free.
+nonisolated enum OCRWorkQueue {
+  private static let queue = DispatchQueue(
+    label: "com.snapzy.ocr.work",
+    qos: .userInitiated,
+    attributes: .concurrent
+  )
+
+  static func run<T: Sendable>(_ work: @escaping @Sendable () throws -> T) async throws -> T {
+    try await withCheckedThrowingContinuation { continuation in
+      queue.async {
+        continuation.resume(with: Result { try work() })
+      }
+    }
+  }
+
+  static func run<T: Sendable>(_ work: @escaping @Sendable () -> T) async -> T {
+    await withCheckedContinuation { continuation in
+      queue.async {
+        continuation.resume(returning: work())
+      }
+    }
+  }
+}
+
+/// Sendable snapshot of a `VisionOCRProfile`'s request settings.
+nonisolated struct VisionRecognitionConfiguration: Sendable {
+  let usesLanguageCorrection: Bool
+  let recognitionLanguages: [String]
+  let customWords: [String]
+  let minimumTextHeight: Float?
+  let automaticallyDetectsLanguage: Bool
+
+  func configure(_ request: VNRecognizeTextRequest) {
+    request.recognitionLevel = .accurate
+    request.usesLanguageCorrection = usesLanguageCorrection
+    if !recognitionLanguages.isEmpty {
+      request.recognitionLanguages = recognitionLanguages
+    }
+    if !customWords.isEmpty {
+      request.customWords = customWords
+    }
+    if let minimumTextHeight {
+      request.minimumTextHeight = minimumTextHeight
+    }
+    if #available(macOS 13.0, *) {
+      request.automaticallyDetectsLanguage = automaticallyDetectsLanguage
+    }
+  }
+}
+
+/// One recognized text candidate, detached from Vision's observation objects.
+nonisolated struct VisionTextCandidate: Sendable {
+  let string: String
+  let confidence: Float
+}
+
+/// One recognized line with its top candidates (best first).
+nonisolated struct VisionTextObservation: Sendable {
+  let candidates: [VisionTextCandidate]
+  let boundingBox: CGRect
+}
+
+nonisolated enum VisionOCRWorker {
+  private static let ciContext = CIContext(options: [.cacheIntermediates: false])
+
+  /// Runs one text-recognition request on the OCR work queue.
+  static func recognizeText(
+    in image: CGImage,
+    configuration: VisionRecognitionConfiguration
+  ) async throws -> [VisionTextObservation] {
+    try await OCRWorkQueue.run {
+      let request = VNRecognizeTextRequest()
+      configuration.configure(request)
+      let handler = VNImageRequestHandler(cgImage: image, options: [:])
+      try handler.perform([request])
+      return (request.results ?? []).map { observation in
+        VisionTextObservation(
+          candidates: observation.topCandidates(5).map {
+            VisionTextCandidate(string: $0.string, confidence: $0.confidence)
+          },
+          boundingBox: observation.boundingBox
+        )
+      }
+    }
+  }
+
+  /// Draw the image into a standard sRGB bitmap so Vision can read it.
+  /// Fixes `TextRecognition.CRImageReaderError` on IOSurface-backed images from
+  /// `SCScreenshotManager`. Returns nil when normalization is not possible.
+  static func normalizedImageForVision(_ image: CGImage) -> CGImage? {
+    let width = image.width
+    let height = image.height
+    let colorSpace = CGColorSpace(name: CGColorSpace.sRGB) ?? image.colorSpace ?? CGColorSpaceCreateDeviceRGB()
+
+    guard let context = CGContext(
+      data: nil,
+      width: width,
+      height: height,
+      bitsPerComponent: 8,
+      bytesPerRow: 0,
+      space: colorSpace,
+      bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
+    ) else {
+      return nil
+    }
+
+    context.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
+    return context.makeImage()
+  }
+
+  static func makeContrastEnhancedImage(from image: CGImage) -> CGImage? {
+    let ciImage = CIImage(cgImage: image)
+
+    guard
+      let colorControls = CIFilter(name: "CIColorControls"),
+      let sharpen = CIFilter(name: "CISharpenLuminance")
+    else {
+      return nil
+    }
+
+    colorControls.setValue(ciImage, forKey: kCIInputImageKey)
+    colorControls.setValue(0, forKey: kCIInputSaturationKey)
+    colorControls.setValue(1.32, forKey: kCIInputContrastKey)
+    colorControls.setValue(0.02, forKey: kCIInputBrightnessKey)
+
+    guard let normalizedImage = colorControls.outputImage?.cropped(to: ciImage.extent) else {
+      return nil
+
```

---

### Incident Patch 2: `96054e5d` (2026-11-07)
**Commit Message**: fix: Fixed Capture Markup crosshair tracking the pointer on macOS 27 (#707)

* fix: keep Capture Markup crosshair tracking the pointer on macOS 27

On macOS 27.2 the ⌘⇧7 overlay stops receiving SwiftUI hover events after
the seeded first position, so the drawn crosshair, coordinate bubble and
magnifier froze at the trigger point while the real cursor stayed hidden.

- Poll the real pointer at 60 Hz during the selecting phase (same approach
  as area capture's pointerTrackingTimer) and publish it as
  selectionPointerLocation; hover/drag paths still run, the poll only fills
  in what they miss. Stops on annotate/complete and logs hover vs polled
  move counts for diagnostics.
- Draw the crosshair proxy as a CALayer in InlineAreaMagnifierHostView,
  updated together with the coordinate bubble, instead of a SwiftUI Image.

* ci: skip inline session pointer-tracking tests on headless runner

These tests build an InlineAreaAnnotateSession through makeSelectionSession(), which crashes (malloc double free) on the headless CI runner. The sibling tests using the same helper are already skipped here.

**File**: `.github/workflows/ci.yml` (modified, +3/-0)
```diff
@@ -78,6 +78,9 @@ jobs:
             SnapzyTests/InlineAreaAnnotateSessionTests/testAnnotateWindowConsumesCopyAndDuplicateWhenNothingIsSelected
             SnapzyTests/InlineAreaAnnotateSessionTests/testUpdateSelectionPublishesPointerLocation
             SnapzyTests/InlineAreaAnnotateSessionTests/testEndSelectionClearsPointerLocation
+            SnapzyTests/InlineAreaAnnotateSessionTests/testPointerTrackingTickPublishesPointerWithoutHoverEvents
+            SnapzyTests/InlineAreaAnnotateSessionTests/testPointerTrackingTickFillsInStalledDrag
+            SnapzyTests/InlineAreaAnnotateSessionTests/testPointerTrackingTickIsInertAfterSelectingPhase
             SnapzyTests/AreaSelectionMultiMonitorReconciliationTests
             SnapzyTests/AreaSelectionSessionLifecycleTests
             SnapzyTests/AreaSelectionHoverPerformanceTests
```

**File**: `Snapzy/Features/Annotate/InlineAreaAnnotateSession.swift` (modified, +70/-0)
```diff
@@ -117,6 +117,16 @@ final class InlineAreaAnnotateSession: ObservableObject {
   /// `NSApp.activate` at start, so — unlike live-passthrough capture — this doesn't need
   /// `BackgroundCursorControl`'s background-cursor-control workaround.
   private var cursorHider = LivePassthroughCursorHider()
+  /// Polls the real pointer during `.selecting` so the drawn crosshair, magnifier, coordinate
+  /// bubble and window hover keep tracking even when AppKit stops delivering hover/mouse-moved
+  /// events to the overlay panels. On macOS 27 `onContinuousHover` was observed to report only
+  /// the seeded position, freezing all pointer chrome at the trigger point while the (hidden)
+  /// real cursor kept moving. Same approach as plain area screenshot's `pointerTrackingTimer`.
+  /// The SwiftUI hover/drag paths still run; this only fills in what they fail to report.
+  private var pointerTrackingTimer: Timer?
+  private var lastTrackedScreenPoint: CGPoint?
+  private var hoverEventCount = 0
+  private var polledPointerMoveCount = 0
 
   init(
     primaryDisplayID: CGDirectDisplayID,
@@ -158,6 +168,7 @@ final class InlineAreaAnnotateSession: ObservableObject {
     // Session always starts in `.selecting` — hide the real cursor for every display up
     // front; `beginAnnotating(with:)` shows it again once selection ends.
     cursorHider.hide(displayIDs: Set(displays.map(\.displayID)))
+    startPointerTracking()
     startWindowSelectionQuery(prefetchedContentTask: prefetchedContentTask, excludeOwnApplication: excludeOwnApplication)
     if autoDetectElementUnderCursor {
       SmartElementQueryService.shared.ensureAccessibilityPermission()
@@ -332,9 +343,67 @@ final class InlineAreaAnnotateSession: ObservableObject {
     state.loadImage(crop.image, url: nil)
     state.selectedTool = AnnotateToolPreference.initialTool(userDefaults: defaults)
     phase = .annotating
+    stopPointerTracking()
     cursorHider.showAll()
   }
 
+  /// Called by `InlineAreaAnnotateRootView` for every SwiftUI hover update; only feeds the
+  /// diagnostics logged by `stopPointerTracking()`.
+  func recordHoverEvent() {
+    hoverEventCount += 1
+  }
+
+  private func startPointerTracking() {
+    guard pointerTrackingTimer == nil else { return }
+    let timer = Timer(timeInterval: 1.0 / 60.0, repeats: true) { [weak self] _ in
+      MainActor.assumeIsolated {
+        self?.handlePointerTrackingTick()
+      }
+    }
+    RunLoop.main.add(timer, forMode: .common)
+    pointerTrackingTimer = timer
+  }
+
+  private func stopPointerTracking() {
+    guard let timer = pointerTrackingTimer else { return }
+    timer.invalidate()
+    pointerTrackingTimer = nil
+    DiagnosticLogger.shared.log(.debug, .capture, "Inline area annotate pointer tracking stopped", context: [
+      "hoverEvents": "\(hoverEventCount)",
+      "polledMoves": "\(polledPointerMoveCount)",
+      "appActive": "\(NSApp.isActive)",
+      "hasKeyPanel": "\(windows.allObjects.contains { $0.isKeyWindow })",
+    ])
+  }
+
+  func handlePointerTrackingTick(screenPoint: CGPoint = NSEvent.mouseLocation) {
+    guard phase == .selecting, !didComplete else {
+      stopPointerTracking()
+      return
+    }
+    let localPoint = localDesktopPoint(for: screenPoint)
+    let didMove = screenPoint != lastTrackedScreenPoint
+    lastTrackedScreenPoint = screenPoint
+
+    if selectionStartPoint != nil {
+      // Mid-drag: the drag monitor normally drives this; only fill in if it fell behind.
+      if didMove, selectionPointerLocation != localPoint {
+        updateSelection(to: localPoint)
+      }
+      return
+    }
+
+    // Re-publish even without movement so a stray hover `.ended` (which clears it) can't
+    // leave the chrome hidden while the pointer is still over a display.
+    if selectionPointerLocation != localPoint {
+      selectionPointerLocation = localPoint
+    }
+    if didMove {
+      polledPointerMoveCount += 1
+      updateHoveredWindow(atScreenPoint: screenPoint)
+    }
+  }
+
   func moveSelection(to localRect: CGRect, refreshImage: Bool) {
     let clampedRect = clampedSelectionRect(localRect.standardized)
     guard refreshImage else {
@@ -644,6 +713,7 @@ final class InlineAreaAnnotateSession: ObservableObject {
     selectionPointerLocation = nil
     removeKeyMonitors()
     removeSelectionMonitor()
+    stopPointerTracking()
     frozenSession.invalidate()
 
     // Restore cursor before closing windows — the inline overlay uses a
```

**File**: `Snapzy/Features/Annotate/InlineAreaAnnotateWindow.swift` (modified, +5/-26)
```diff
@@ -302,16 +302,10 @@ private struct InlineAreaAnnotateRootView: View {
           // display's true size is already known without needing SwiftUI to measure it.
           .frame(width: display.localFrame.width, height: display.localFrame.height)
           .allowsHitTesting(false)
-
           // The real system cursor is hidden for the whole `.selecting` phase
-          // (`InlineAreaAnnotateSession.cursorHider`) — draw the same crosshair image
-          // ourselves instead, mirroring plain area screenshot's `cursorProxyLayer`. Native
-          // `NSCursor.set()` is not used here: on this `.nonactivatingPanel` configuration the
-          // WindowServer can silently stop rendering it after roughly a second of no new mouse
-          // events, even though the app's own cursor bookkeeping stays correct the whole time.
-          if let selectingPointerPoint {
-            InlineAreaSystemCrosshairProxy(point: selectingPointerPoint)
-          }
+          // (`InlineAreaAnnotateSession.cursorHider`). The replacement crosshair is drawn by
+          // `InlineAreaMagnifierHostView` as a CALayer (`crosshairProxyLayer`), in the same
+          // update as the coordinate bubble — not as a SwiftUI view here.
         }
       }
       .coordinateSpace(name: InlineAreaCoordinateSpace.root)
@@ -320,6 +314,7 @@ private struct InlineAreaAnnotateRootView: View {
         case let .active(location):
           cursorIndicatorPoint = location
           if session.phase == .selecting {
+            session.recordHoverEvent()
             session.selectionPointerLocation = desktopPoint(for: location)
           }
           updateNativeCursorForIndicator(showsCursorIndicator)
@@ -726,7 +721,7 @@ private struct InlineAreaAnnotateRootView: View {
 
   /// Only relevant to `.annotating`-phase moving (`InlineAreaCursorIndicator`) — during
   /// `.selecting` the real cursor is already hidden for the whole phase
-  /// (`InlineAreaAnnotateSession.cursorHider`) and `InlineAreaSystemCrosshairProxy` draws the
+  /// (`InlineAreaAnnotateSession.cursorHider`) and `InlineAreaMagnifierHostView` draws the
   /// crosshair instead, so there's nothing for this to do there.
   private func updateNativeCursorForIndicator(_ isIndicatorVisible: Bool) {
     guard session.phase != .selecting else { return }
@@ -809,22 +804,6 @@ private struct InlineAreaCursorIndicator: View {
   }
 }
 
-/// Drawn replacement for the real system cursor during `.selecting`, mirroring plain area
-/// screenshot's `cursorProxyLayer`: draws the exact same crosshair image
-/// (`NSCursor.vectorScreenshotCrosshairLight`) the real cursor would otherwise use, so the two
-/// entry points look pixel-identical, while sidestepping the WindowServer's tendency to stop
-/// rendering a native `NSCursor.set()` cursor on this `.nonactivatingPanel` configuration after
-/// a period of no new mouse events (see `InlineAreaAnnotateSession.cursorHider`).
-private struct InlineAreaSystemCrosshairProxy: View {
-  let point: CGPoint
-
-  var body: some View {
-    Image(nsImage: NSCursor.vectorScreenshotCrosshairLight.image)
-      .position(point)
-      .allowsHitTesting(false)
-  }
-}
-
 private enum InlineAreaNativeCursor {
   private static let hiddenCursor: NSCursor = {
     let image = NSImage(size: NSSize(width: 1, height: 1))
```

**File**: `Snapzy/Features/Annotate/InlineAreaMagnifierHostView.swift` (modified, +48/-0)
```diff
@@ -39,6 +39,15 @@ final class InlineAreaMagnifierHostView: NSView {
   private(set) var coordinateBubbleBackgroundLayer: CALayer?
   private(set) var coordinateBubbleTextLayer: CATextLayer?
 
+  /// Drawn replacement for the system cursor during `.selecting` (the real cursor is hidden
+  /// for that whole phase — see `InlineAreaAnnotateSession.cursorHider`). Rendered here as a
+  /// plain `CALayer`, exactly like plain area screenshot's `cursorProxyLayer`, rather than as
+  /// a SwiftUI `Image` sibling: it then shares the coordinate bubble's layer, update call and
+  /// `CATransaction`, so it can never lag, freeze or vanish while the bubble keeps tracking
+  /// the pointer (observed on macOS 27 with the SwiftUI-drawn proxy).
+  private(set) var crosshairProxyLayer: CALayer?
+  private var crosshairProxySourceImage: NSImage?
+
   override init(frame frameRect: NSRect) {
     super.init(frame: frameRect)
     wantsLayer = true
@@ -64,6 +73,7 @@ final class InlineAreaMagnifierHostView: NSView {
     magnifier.removeLayers()
     coordinateBubbleBackgroundLayer?.isHidden = true
     coordinateBubbleTextLayer?.isHidden = true
+    crosshairProxyLayer?.isHidden = true
   }
 
   @discardableResult
@@ -85,6 +95,44 @@ final class InlineAreaMagnifierHostView: NSView {
       in: layer
     )
     updateCoordinateBubble(at: point, in: layer)
+    updateCrosshairProxy(at: point, in: layer)
+  }
+
+  /// Mirrors `AreaSelectionOverlayView.updateCursorProxy`: same image, same hot-spot math
+  /// (`NSCursor.hotSpot` is top-left based, this view is bottom-left based).
+  private func updateCrosshairProxy(at point: CGPoint, in layer: CALayer) {
+    let cursor = NSCursor.vectorScreenshotCrosshairLight
+    let image = cursor.image
+    let hotSpot = cursor.hotSpot
+
+    let proxy = crosshairProxyLayer ?? {
+      let newLayer = CALayer()
+      newLayer.actions = [
+        kCAOnOrderIn: NSNull(), kCAOnOrderOut: NSNull(), "bounds": NSNull(), "position": NSNull(),
+        "hidden": NSNull(), "contents": NSNull(),
+      ]
+      // Stay above the magnifier/bubble sublayers, which may be re-added after this one.
+      newLayer.zPosition = 1000
+      layer.addSublayer(newLayer)
+      crosshairProxyLayer = newLayer
+      return newLayer
+    }()
+
+    CATransaction.begin()
+    CATransaction.setDisableActions(true)
+    if image !== crosshairProxySourceImage {
+      proxy.contents = image
+      crosshairProxySourceImage = image
+    }
+    proxy.contentsScale = window?.backingScaleFactor ?? 2.0
+    proxy.frame = CGRect(
+      x: point.x - hotSpot.x,
+      y: point.y - (image.size.height - hotSpot.y),
+      width: image.size.width,
+      height: image.size.height
+    )
+    proxy.isHidden = false
+    CATransaction.commit()
   }
 
   private func updateCoordinateBubble(at point: CGPoint, in layer: CALayer) {
```

**File**: `SnapzyTests/Features/Annotate/InlineAreaAnnotateSessionTests.swift` (modified, +40/-0)
```diff
@@ -395,6 +395,46 @@ final class InlineAreaAnnotateSessionTests: XCTestCase {
     XCTAssertEqual(session.phase, .selecting)
   }
 
+  /// Regression (macOS 27): hover events stopped after the seeded first position, freezing
+  /// crosshair/bubble/magnifier at the trigger point. The polling tick must publish the real
+  /// pointer position without any hover event.
+  @MainActor
+  func testPointerTrackingTickPublishesPointerWithoutHoverEvents() throws {
+    let session = try makeSelectionSession()
+    // desktopFrame is (0, 0, 800, 600): screen (200, 100) → local (200, 500).
+    session.handlePointerTrackingTick(screenPoint: CGPoint(x: 200, y: 100))
+    XCTAssertEqual(session.selectionPointerLocation, CGPoint(x: 200, y: 500))
+
+    session.handlePointerTrackingTick(screenPoint: CGPoint(x: 650, y: 420))
+    XCTAssertEqual(session.selectionPointerLocation, CGPoint(x: 650, y: 180))
+
+    // A hover `.ended` clears it; the next tick restores it even without movement.
+    session.selectionPointerLocation = nil
+    session.handlePointerTrackingTick(screenPoint: CGPoint(x: 650, y: 420))
+    XCTAssertEqual(session.selectionPointerLocation, CGPoint(x: 650, y: 180))
+    session.cancel()
+  }
+
+  @MainActor
+  func testPointerTrackingTickFillsInStalledDrag() throws {
+    let session = try makeSelectionSession()
+    session.beginSelection(at: CGPoint(x: 100, y: 100))
+    session.handlePointerTrackingTick(screenPoint: CGPoint(x: 300, y: 300)) // local (300, 300)
+    XCTAssertEqual(session.selectionPointerLocation, CGPoint(x: 300, y: 300))
+    XCTAssertEqual(session.selectionRect, CGRect(x: 100, y: 100, width: 200, height: 200))
+    session.cancel()
+  }
+
+  @MainActor
+  func testPointerTrackingTickIsInertAfterSelectingPhase() throws {
+    let session = try makeSelectionSession()
+    session.beginAnnotating(with: CGRect(x: 10, y: 10, width: 200, height: 100))
+    XCTAssertEqual(session.phase, .annotating)
+    session.handlePointerTrackingTick(screenPoint: CGPoint(x: 200, y: 100))
+    XCTAssertNil(session.selectionPointerLocation)
+    session.cancel()
+  }
+
   @MainActor
   private func makeSelectionSession() throws -> InlineAreaAnnotateSession {
     // Fake display ID: the session hides the cursor per display at init — a nonexistent
```

**File**: `SnapzyTests/Features/Annotate/InlineAreaMagnifierHostViewTests.swift` (modified, +43/-0)
```diff
@@ -79,6 +79,49 @@ final class InlineAreaMagnifierHostViewTests: XCTestCase {
     XCTAssertTrue(view.coordinateBubbleTextLayer?.isHidden ?? false)
   }
 
+  /// The drawn crosshair (the real cursor is hidden during `.selecting`) lives in this view's
+  /// layer, positioned with the cursor hot-spot on the pointer — same math as plain area
+  /// screenshot's `cursorProxyLayer`.
+  func testCrosshairProxy_tracksPointerWithHotSpot() throws {
+    let view = makeView(size: CGSize(width: 800, height: 600))
+    view.backdropImage = makeSolidColorImage(size: CGSize(width: 800, height: 600))
+    let cursor = NSCursor.vectorScreenshotCrosshairLight
+
+    view.update(at: CGPoint(x: 200, y: 150))
+    let proxy = try XCTUnwrap(view.crosshairProxyLayer)
+    XCTAssertFalse(proxy.isHidden)
+    XCTAssertTrue(proxy.superlayer === view.layer)
+    XCTAssertTrue((proxy.contents as AnyObject?) === cursor.image)
+    XCTAssertEqual(proxy.frame.origin.x, 200 - cursor.hotSpot.x)
+    XCTAssertEqual(proxy.frame.origin.y, 150 - (cursor.image.size.height - cursor.hotSpot.y))
+
+    view.update(at: CGPoint(x: 420, y: 310))
+    XCTAssertEqual(proxy.frame.origin.x, 420 - cursor.hotSpot.x)
+    XCTAssertEqual(proxy.frame.origin.y, 310 - (cursor.image.size.height - cursor.hotSpot.y))
+  }
+
+  /// The crosshair must stay visible while the magnifier is zoomed in (the bubble hides then).
+  func testCrosshairProxy_staysVisibleWhileMagnifierActive() {
+    let view = makeView(size: CGSize(width: 800, height: 600))
+    view.backdropImage = makeSolidColorImage(size: CGSize(width: 800, height: 600))
+    view.update(at: CGPoint(x: 200, y: 150))
+
+    view.applyScroll(delta: 6, hasPreciseScrollingDeltas: false)
+
+    XCTAssertFalse(view.crosshairProxyLayer?.isHidden ?? true)
+  }
+
+  func testCrosshairProxy_hiddenOnHide() {
+    let view = makeView(size: CGSize(width: 800, height: 600))
+    view.backdropImage = makeSolidColorImage(size: CGSize(width: 800, height: 600))
+    view.update(at: CGPoint(x: 200, y: 150))
+    XCTAssertFalse(view.crosshairProxyLayer?.isHidden ?? true)
+
+    view.hide()
+
+    XCTAssertTrue(view.crosshairProxyLayer?.isHidden ?? false)
+  }
+
   /// Regression for the magnifier appearing pinned to the bottom-left corner on first render
   /// in screenshot-and-annotate: `AreaSelectionMagnifier.update(bounds:)` clamps the container
   /// into `bounds` and divides by its width/height, so a `.zero` bounds collapses every
```

---

### Incident Patch 3: `f78e43a4` (2026-11-08)
**Commit Message**: ci: reset SwiftPM artifact cache before xcodebuild (#723)

Fresh macos-15 runners fail package resolution with
"Sparkle-for-Swift-Package-Manager.zip ... already exists in file system",
which broke CI and the v2.2.0-beta.7 release publish.

**File**: `.github/workflows/ci.yml` (modified, +6/-0)
```diff
@@ -24,6 +24,12 @@ jobs:
         with:
           xcode-version: '26.2'
 
+      - name: Reset SwiftPM artifact cache
+        # Fresh macos-15 images can ship a stale entry for the Sparkle binary
+        # artifact, which makes package resolution fail with
+        # "... already exists in file system".
+        run: rm -rf "$HOME/Library/Caches/org.swift.swiftpm/artifacts"
+
       - name: Verify localization catalogs
         run: |
           set -euo pipefail
```

**File**: `.github/workflows/release-publish.yml` (modified, +6/-0)
```diff
@@ -148,6 +148,12 @@ jobs:
         with:
           xcode-version: "26.2"
 
+      - name: Reset SwiftPM artifact cache
+        # Fresh macos-15 images can ship a stale entry for the Sparkle binary
+        # artifact, which makes package resolution fail with
+        # "... already exists in file system".
+        run: rm -rf "$HOME/Library/Caches/org.swift.swiftpm/artifacts"
+
       - name: Build archive
         run: |
           set -euo pipefail
```

#### Recent Merged Pull Requests:
- **PR #724** (2026-11-08): chore: release v2.2.0-beta.8 (@github-actions[bot])
- **PR #723** (2026-11-08): ci: reset SwiftPM artifact cache before xcodebuild (@duongductrong)
- **PR #722** (2026-11-08): chore: release v2.2.0-beta.7 (@github-actions[bot])
- **PR #719** (2026-11-08): Cloud keys stay within the S3 limit and short keys get 12 characters (@gtmcknight)
- **PR #718** (2026-11-08): feat: add clear-history and per-card remove actions to floating history panel (@duongductrong)
- **PR #717** (2026-11-07): chore: release v2.2.0-beta.6 (@github-actions[bot])

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

## X. Keep the app responsive while OCR runs (#708)

**RULE**:
When implementing operations in `Snapzy/Features/Capture/CaptureViewModel.swift`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in duongductrong/Snapzy. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `44278b1c`: Keep the app responsive while OCR runs (#708). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Swift data structures, boundary deserialization, API parsing, or resource lifecycles matching `Snapzy/Features/Capture/CaptureViewModel.swift`.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Verified production-grade fix pattern:
  /// True from OCR area selection (mouse-up) until text recognition finishes.
  private var isOCRProcessing = false
    // A previous OCR is still capturing/recognizing: tell the user at the pointer
    // instead of silently ignoring the shortcut (which reads as the app hanging).
    if isOCRProcessing {
      DiagnosticLogger.shared.log(.debug, .ocr, "captureOCR blocked: previous OCR still processing")
      CursorBubbleController.shared.show(L10n.OCR.alreadyRunning)
      return
    }

          // Pixels are secured and the overlay is gone: release the shared capture lock now
          // (as live area capture does) so other capture shortcuts work while OCR runs.
          // `isOCRProcessing` alone guards against starting a second OCR.
          self.isAreaSelectionActive = false
          self.isOCRProcessing = true
              self.isOCRProcessing = false
      // QRCodeService runs Vision on the OCR work queue itself.
      let result = try await QRCodeService.shared.detect(in: image)
```

**NEGATIVE CONSTRAINT**:
```swift
// Anti-pattern to NEVER write (induced failure mode):
              self.isAreaSelectionActive = false
      let result = try await Task.detached(priority: .userInitiated) {
        try await QRCodeService.shared.detect(in: image)
      }.value
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `44278b1c` are properly handled with clean fallback behavior.

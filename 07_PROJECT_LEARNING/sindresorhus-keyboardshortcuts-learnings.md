# Forensic Learning Record (Deep Inspection): sindresorhus/KeyboardShortcuts

> **Canonical Artifact**: `07_PROJECT_LEARNING/sindresorhus-keyboardshortcuts-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/sindresorhus/KeyboardShortcuts](https://github.com/sindresorhus/KeyboardShortcuts))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-04T20:39:32.643Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `sindresorhus/KeyboardShortcuts`
- **Description**: ⌨️ Add user-customizable global keyboard shortcuts (hotkeys) to your macOS app in minutes
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: N/A
- **Stars / Engagement**: 2718 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Remote API meta.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `Example/KeyboardShortcutsExample/AppState.swift`
```
import AppKit

final class AppState {
	static let shared = AppState()

	private init() {}

	func alert(_ number: Int) {
		let alert = NSAlert()
		alert.messageText = "Shortcut \(number) menu item action triggered!"
		alert.runModal()
	}
}

```

### Core Architecture Module: `Example/KeyboardShortcutsExample/Utilities.swift`
```
import SwiftUI

final class CallbackMenuItem: NSMenuItem {
	private static var validateCallback: ((NSMenuItem) -> Bool)?

	static func validate(_ callback: @escaping (NSMenuItem) -> Bool) {
		validateCallback = callback
	}

	private var callback: () -> Void = {}

	@available(*, unavailable, message: "Use init(_:key:keyModifiers:isEnabled:isChecked:isHidden:action:).")
	override nonisolated init(title string: String, action selector: Selector?, keyEquivalent charCode: String) {
		super.init(title: string, action: selector, keyEquivalent: charCode)
	}

	init(
		_ title: String,
		key: String = "",
		keyModifiers: NSEvent.ModifierFlags? = nil,
		isEnabled: Bool = true,
		isChecked: Bool = false,
		isHidden: Bool = false,
		action: @escaping () -> Void
	) {
		self.callback = action
		super.init(title: title, action: #selector(action(_:)), keyEquivalent: key)
		self.target = self
		self.isEnabled = isEnabled
		self.isChecked = isChecked
		self.isHidden = isHidden

		if let keyModifiers {
			self.keyEquivalentModifierMask = keyModifiers
		}
	}

	@available(*, unavailable)
	nonisolated required init(coder decoder: NSCoder) {
		// swiftlint:disable:next fatal_error_message
		fatalError()
	}

	@objc
	private func action(_ sender: NSMenuItem) {
		callback()
	}

	@objc
	func validateMenuItem(_ menuItem: NSMenuItem) -> Bool {
		Self.validateCallback?(menuItem) ?? true
	}
}

extension NSMenuItem {
	convenience init(
		_ title: String,
		action: Selector? = nil,
		key: String = "",
		keyModifiers: NSEvent.ModifierFlags? = nil,
		data: Any? = nil,
		isEnabled: Bool = true,
		isChecked: Bool = false,
		isHidden: Bool = false
	) {
		self.init(title: title, action: action, keyEquivalent: key)
		self.representedObject = data
		self.isEnabled = isEnabled
		self.isChecked = isChecked
		self.isHidden = isHidden

		if let keyModifiers {
			self.keyEquivalentModifierMask = keyModifiers
		}
	}

	var isChecked: Bool {
		get { state == .on }
		set {
			state = newValue ? .on : .off
		}
	}
}

extension NSMenu {
	@discardableResult
	func addCallbackItem(
		_ title: String,
		key: String = "",
		keyModifiers: NSEvent.ModifierFlags? = nil,
		isEnabled: Bool = true,
		isChecked: Bool = false,
		isHidden: Bool = false,
		action: @escaping () -> Void
	) -> NSMenuItem {
		let menuItem = CallbackMenuItem(
			title,
			key: key,
			keyModifiers: keyModifiers,
			isEnabled: isEnabled,
			isChecked: isChecked,
			isHidden: isHidden,
			action: action
		)
		addItem(menuItem)
		return menuItem
	}
}

```

### Core Architecture Module: `Sources/KeyboardShortcuts/Utilities.swift`
```
import SwiftUI
#if DEBUG
import os
#endif
#if DEBUG && canImport(OSLog)
import OSLog
#endif

#if os(macOS)
import Carbon.HIToolbox


extension String {
	/**
	Makes the string localizable.
	*/
	var localized: String {
		NSLocalizedString(self, bundle: .module, comment: self)
	}
}


extension Data {
	nonisolated var toString: String? { String(data: self, encoding: .utf8) }
}


extension NSEvent {
	nonisolated var isKeyEvent: Bool { type == .keyDown || type == .keyUp }
}


extension NSTextField {
	func hideCaret() {
		(currentEditor() as? NSTextView)?.insertionPointColor = .clear
	}

	func restoreCaret() {
		(currentEditor() as? NSTextView)?.insertionPointColor = .labelColor
	}
}


extension NSView {
	func focus() {
		window?.makeFirstResponder(self)
	}

	func blur() {
		window?.makeFirstResponder(nil)
	}
}


/**
Listen to local events.

- Important: Don't forget to call `.start()`.

```swift
eventMonitor = LocalEventMonitor(events: [.leftMouseDown, .rightMouseDown]) { event in
	// Do something

	return event
}
.start()
```
*/
final class LocalEventMonitor {
	private let events: NSEvent.EventTypeMask
	private let callback: (NSEvent) -> NSEvent?
	// Must be strong. The object returned by `addLocalMonitorForEvents` is owned by the caller and must be kept alive until it's passed to `removeMonitor`. It used to be weak, which worked only because AppKit happened to retain it internally. On some macOS 26/27 builds it was deallocated as soon as the autorelease pool drained, so the monitor silently stopped receiving events and `stop()` never removed it.
	private var monitor: AnyObject?

	init(events: NSEvent.EventTypeMask, callback: @escaping (NSEvent) -> NSEvent?) {
		self.events = events
		self.callback = callback
	}

	isolated deinit {
		stop()
	}

	@discardableResult
	func start() -> Self {
		guard monitor == nil else {
			return self
		}

		monitor = NSEvent.addLocalMonitorForEvents(matching: events, handler: callback) as AnyObject
		return self
	}

	func stop() {
		guard let monitor else {
			return
		}

		NSEvent.removeMonitor(monitor)
		self.monitor = nil
	}
}


final class RunLoopLocalEventMonitor {
	private let runLoopMode: RunLoop.Mode
	private let callback: (NSEvent) -> NSEvent?
	private let observer: CFRunLoopObserver
	private var isStarted = false

	init(
		events: NSEvent.EventTypeMask,
		runLoopMode: RunLoop.Mode,
		callback: @escaping (NSEvent) -> NSEvent?
	) {
		self.runLoopMode = runLoopMode
		self.callback = callback
		var pendingEvents = [NSEvent]()

		self.observer = CFRunLoopObserverCreateWithHandler(nil, CFRunLoopActivity.beforeSources.rawValue, true, 0) { _, _ in
			// Peek the head of the queue without dequeuing, and only pull an event when the head is one we handle.
			// While a menu is tracking, the queue is a flood of mouse-moved events. Asking `nextEvent(matching: keyMask, dequeue: true)` to return the key events forces AppKit to scan and drain that whole flood out of the window-server port on every run-loop iteration, which starves the menu's own event tracking and makes the highlight lag badly. Peeking the head stops the moment a mouse-moved event is in front, so the menu keeps consuming its events undisturbed, while any key event that reaches the head is still handled.
			// Trade-off: a key event queued behind mouse-moved events is handled on a later pass, once the menu drains the events ahead of it. In practice the pointer is still while a shortcut is pressed, so the flood clears and the key surfaces within a pass or two.
			pendingEvents.removeAll(keepingCapacity: true)

			// Collect the leading run of handled events, then re-post the unconsumed ones after the loop. Re-posting inside the loop would send an unconsumed event back to the head and immediately re-peek it, spinning forever.
			while
				// Only the peek (`dequeue: false`) is cheap. Guard on the head's type first so we dequeue nothing while a mouse-moved event is in front.
				let head = NSApp.nextEvent(matching: .any, until: nil, inMode: runLoopMode, dequeue: false),
				events.contains(NSEvent.EventTypeMask(rawValue: 1 << head.type.rawValue)),
				// The head matches, so this dequeues that same event.
				let event = NSApp.nextEvent(matching: events, until: nil, inMode: runLoopMode, dequeue: true)
			{
				// The callback returns `nil` when it consumes the event (a matching shortcut), otherwise the event to re-post for normal handling.
				if let handledEvent = callback(event) {
					pendingEvents.append(handledEvent)
				}
			}

			// Restore unconsumed events ahead of the untouched queue, preserving their original order.
			for eventToRepost in pendingEvents.reversed() {
				NSApp.postEvent(eventToRepost, atStart: true)
			}
		}
	}

	isolated deinit {
		stop()
	}

	@discardableResult
	func start() -> Self {
		guard !isStarted else {
			return self
		}

		isStarted = true
		CFRunLoopAddObserver(RunLoop.current.getCFRunLoop(), observer, CFRunLoopMode(runLoopMode.rawValue as CFString))
		return self
	}

	func stop() {
		guard isStarted else {
			return
		}

		isStarted = false
		CFRunLoopRemoveObserver(RunLoop.current.getCFRunLoop(), observer, CFRunLoopMode(runLoopMode.rawValue as CFString))
	}
}


extension NSEvent {
	private static func normalizedModifiers(from flags: ModifierFlags) -> ModifierFlags {
		flags
			.intersection(.deviceIndependentFlagsMask)
			// We remove `capsLock` as it shouldn't affect the modifiers.
			// We remove `numericPad` as arrow keys trigger it, use `event.specialKeys` instead.
			.subtracting([.capsLock, .numericPad])
	}

	static var modifiers: ModifierFlags {
		normalizedModifiers(from: modifierFlags)
	}

	/**
	Real modifiers.

	- Note: Prefer this over `.modifierFlags`.

	```swift
	// Check if Command is one of possible more modifiers keys
	event.modifiers.contains(.command)

	// Check if Command is the only modifier key
	event.modifiers == .command

	// Check if Command and Shift are the only modifiers
	event.modifiers == [.command, .shift]
	```
	*/
	var modifiers: ModifierFlags {
		Self.normalizedModifiers(from: modifierFlags)
	}
}


extension NSSearchField {
	/**
	Clear the search field.
	*/
	func clear() {
		(cell as? NSSearchFieldCell)?.cancelButtonCell?.performClick(self)
	}
}


extension NSAlert {
	/**
	Show an alert as a window-modal sheet, or as an app-modal (window-independent) alert if the window is `nil` or not given.
	*/
	@discardableResult
	static func showModal(
		for window: NSWindow? = nil,
		title: String,
		message: String? = nil,
		style: Style = .warning,
		icon: NSImage? = nil,
		buttonTitles: [String] = []
	) -> NSApplication.ModalResponse {
		NSAlert(
			title: title,
			message: message,
			style: style,
			icon: icon,
			buttonTitles: buttonTitles
		).runModal(for: window)
	}

	convenience init(
		title: String,
		message: String? = nil,
		style: Style = .warning,
		icon: NSImage? = nil,
		buttonTitles: [String] = []
	) {
		self.init()
		self.messageText = title
		self.alertStyle = style
		self.icon = icon

		for buttonTitle in buttonTitles {
			addButton(withTitle: buttonTitle)
		}

		if let message {
			self.informativeText = message
		}
	}

	/**
	Runs the alert as a window-modal sheet, or as an app-modal (window-independent) alert if the window is `nil` or not given.
	*/
	@discardableResult
	func runModal(for window: NSWindow? = nil) -> NSApplication.ModalResponse {
		guard let window else {
			return runModal()
		}

		beginSheetModal(for: window) { returnCode in
			NSApp.stopModal(withCode: returnCode)
		}

		return NSApp.runModal(for: window)
	}
}


enum UnicodeSymbols {
	/**
	Represents the Function (Fn) key on the keyboard.
	*/
	nonisolated static let functionKey = "🌐\u{FE0E}"
}


extension NSEvent.ModifierFlags {
	// Not documented anywhere, but reverse-engineered by me.
	nonisolated private static let functionKey = 1 << 17 // 131072 (0x20000)

	nonisolated var carbon: Int {
		var modifierFlags = 0

		if contains(.control) {
			modifierFlags |= controlKey
		}

		if contains(.option) {
			modifierFlags |= optionKey
		}

		if contains(.shift) {
			modifierFlags |= shiftKey
		}

		if contains(.command) {
			modifierFlags |= cmdKey
		}

		if contains(.function) {
			modifierFlags |= Self.functionKey
		}

		return modifierFlags
	}

	nonisolated init(carbon: Int) {
		self.init()

		if carbon & controlKey == controlKey {
			insert(.control)
		}

		if carbon & optionKey == optionKey {
			insert(.option)
		}

		if carbon & shiftKey == shiftKey {
			insert(.shift)
		}

		if carbon & cmdKey == cmdKey {
			insert(.command)
		}

		if carbon & Self.functionKey == Self.functionKey {
			insert(.function)
		}
	}
}

extension SwiftUI.EventModifiers {
	// `.function` is deprecated, so we use the raw value.
	nonisolated fileprivate static let function_nonDeprecated = Self(rawValue: 64)
}

extension NSEvent.ModifierFlags {
	nonisolated var toEventModifiers: SwiftUI.EventModifiers {
		var modifiers = SwiftUI.EventModifiers()

		if contains(.capsLock) {
			modifiers.insert(.capsLock)
		}

		if contains(.command) {
			modifiers.insert(.command)
		}

		if contains(.control) {
			modifiers.insert(.control)
		}

		if contains(.numericPad) {
			modifiers.insert(.numericPad)
		}

		if contains(.option) {
			modifiers.insert(.option)
		}

		if contains(.shift) {
			modifiers.insert(.shift)
		}

		if contains(.function) {
			modifiers.insert(.function_nonDeprecated)
		}

		return modifiers
	}
}

extension NSEvent.ModifierFlags {
	/**
	The string representation of the modifier flags.

	```swift
	print(NSEvent.ModifierFlags([.command, .shift]).presentableDescription)
	//=> "⇧⌘"
	```
	*/
	@available(*, deprecated, renamed: "ks_symbolicRepresentation")
	var presentableDescription: String {
		ks_symbolicRepresentation
	}
}


extension NSEvent.ModifierFlags {
	/**
	The symbolic representation of the modifier flags.

	```swift
	let modifiers = NSEvent.ModifierFlags([.command, .shift])
	print(modifiers.ks_symbolicRepresentation)
	//=> "⇧⌘"
	```
	*/
	nonisolated public var ks_symbolicRepresentati
```

### Core Architecture Module: `Example/KeyboardShortcutsExample/App.swift`
```
import SwiftUI
import Observation
import KeyboardShortcuts

@main
struct AppMain: App {
	@State private var menuShortcuts = TestMenuShortcuts()

	var body: some Scene {
		WindowGroup {
			MainScreen()
		}
		.windowResizability(.contentSize)
		.commands {
			CommandMenu("Test") {
				Button("Shortcut 1") {
					AppState.shared.alert(1)
				}
				.keyboardShortcut(menuShortcuts.shortcut1ForMenu?.toSwiftUI)
				.id(menuShortcuts.refreshID)
				Button("Shortcut 2") {
					AppState.shared.alert(2)
				}
				.keyboardShortcut(menuShortcuts.shortcut2ForMenu?.toSwiftUI)
				.id(menuShortcuts.refreshID)
				Button("Shortcut 3") {
					AppState.shared.alert(3)
				}
				.keyboardShortcut(menuShortcuts.shortcut3ForMenu?.toSwiftUI)
				.id(menuShortcuts.refreshID)
				Button("Shortcut 4") {
					AppState.shared.alert(4)
				}
				.keyboardShortcut(menuShortcuts.shortcut4ForMenu?.toSwiftUI)
				.id(menuShortcuts.refreshID)
			}
		}
	}
}

@MainActor
@Observable
final class TestMenuShortcuts {
	var shortcut1 = KeyboardShortcuts.getShortcut(for: .testShortcut1)
	var shortcut2 = KeyboardShortcuts.getShortcut(for: .testShortcut2)
	var shortcut3 = KeyboardShortcuts.getShortcut(for: .testShortcut3)
	var shortcut4 = KeyboardShortcuts.getShortcut(for: .testShortcut4)
	var isRecorderActive = false
	var refreshID = 0

	var shortcut1ForMenu: KeyboardShortcuts.Shortcut? {
		isRecorderActive ? nil : shortcut1
	}

	var shortcut2ForMenu: KeyboardShortcuts.Shortcut? {
		isRecorderActive ? nil : shortcut2
	}

	var shortcut3ForMenu: KeyboardShortcuts.Shortcut? {
		isRecorderActive ? nil : shortcut3
	}

	var shortcut4ForMenu: KeyboardShortcuts.Shortcut? {
		isRecorderActive ? nil : shortcut4
	}

	private var shortcutObserver: NSObjectProtocol?
	private var recorderActiveObserver: NSObjectProtocol?

	init() {
		shortcutObserver = NotificationCenter.default.addObserver(forName: Notification.Name("KeyboardShortcuts_shortcutByNameDidChange"), object: nil, queue: .main) { [weak self] notification in
			guard let self else {
				return
			}

			let name = notification.userInfo?["name"] as? KeyboardShortcuts.Name

			Task { @MainActor in
				guard let name else {
					return
				}

				switch name {
				case .testShortcut1:
					shortcut1 = KeyboardShortcuts.getShortcut(for: .testShortcut1)
				case .testShortcut2:
					shortcut2 = KeyboardShortcuts.getShortcut(for: .testShortcut2)
				case .testShortcut3:
					shortcut3 = KeyboardShortcuts.getShortcut(for: .testShortcut3)
				case .testShortcut4:
					shortcut4 = KeyboardShortcuts.getShortcut(for: .testShortcut4)
				default:
					return
				}

				refreshID += 1
			}
		}

		recorderActiveObserver = NotificationCenter.default.addObserver(forName: Notification.Name("KeyboardShortcuts_recorderActiveStatusDidChange"), object: nil, queue: .main) { [weak self] notification in
			guard let self else {
				return
			}

			let isActive = (notification.userInfo?["isActive"] as? Bool) ?? false

			Task { @MainActor in
				isRecorderActive = isActive
				refreshID += 1
			}
		}
	}

	isolated deinit {
		if let shortcutObserver {
			NotificationCenter.default.removeObserver(shortcutObserver)
		}

		if let recorderActiveObserver {
			NotificationCenter.default.removeObserver(recorderActiveObserver)
		}
	}
}

```

### Core Architecture Module: `Example/KeyboardShortcutsExample/MainScreen.swift`
```
import SwiftUI
import KeyboardShortcuts

struct MainScreen: View {
	var body: some View {
		Form {
			Section("Fixed Shortcuts") {
				DoubleShortcut()
			}
			Section("Binding Shortcut") {
				BindingShortcut()
			}
			Section("Dynamic Shortcut") {
				DynamicShortcut()
			}
			Section("Repeating Key Down") {
				RepeatingShortcut()
			}
		}
		.formStyle(.grouped)
		.fixedSize()
	}
}

extension KeyboardShortcuts.Name {
	static let testShortcut1 = Self("testShortcut1")
	static let testShortcut2 = Self("testShortcut2")
	static let testShortcut3 = Self("testShortcut3")
	static let testShortcut4 = Self("testShortcut4")
	static let testShortcut5 = Self("testShortcut5")
}

@available(macOS 13, *)
private struct RepeatingShortcut: View {
	@State private var repeatCount = 0
	@State private var isShortcutPressed = false
	@State private var shouldIgnoreRepeatUntilKeyUp = false

	var body: some View {
		LabeledContent("Shortcut") {
			VStack(alignment: .trailing) {
				KeyboardShortcuts.Recorder(for: .testShortcut5)
				Text(repeatCount, format: .number)
					.monospacedDigit()
				Button("Reset") {
					repeatCount = 0
					shouldIgnoreRepeatUntilKeyUp = isShortcutPressed
				}
			}
		}
		.task {
			for await _ in KeyboardShortcuts.repeatingKeyDownEvents(for: .testShortcut5) {
				guard !shouldIgnoreRepeatUntilKeyUp else {
					continue
				}

				repeatCount += 1
			}
		}
		.task {
			for await eventType in KeyboardShortcuts.events(for: .testShortcut5) {
				switch eventType {
				case .keyDown:
					isShortcutPressed = true
				case .keyUp:
					isShortcutPressed = false
					shouldIgnoreRepeatUntilKeyUp = false
				}
			}
		}
	}
}

private struct DoubleShortcut: View {
	@State private var isPressed1 = false
	@State private var isPressed2 = false

	var body: some View {
		LabeledContent("Shortcut 1") {
			KeyboardShortcuts.Recorder(for: .testShortcut1)
			// Uncomment to test.
			//	.shortcutValidation {
			//		$0 == .init(.k, modifiers: .command) ? .disallow(reason: "⌘K is not allowed.") : .allow
			// }
			Text(isPressed1 ? "👍" : "👎")
				.bold()
				.foregroundStyle(isPressed1 ? .green : .red)
		}
		LabeledContent("Shortcut 2") {
			KeyboardShortcuts.Recorder(for: .testShortcut2)
			Text(isPressed2 ? "👍" : "👎")
				.bold()
				.foregroundStyle(isPressed2 ? .green : .red)
		}
		.onGlobalKeyboardShortcut(.testShortcut1) {
			isPressed1 = $0 == .keyDown
		}
		.onGlobalKeyboardShortcut(.testShortcut2, type: .keyDown) {
			isPressed2 = true
		}
		.task {
			KeyboardShortcuts.onKeyUp(for: .testShortcut2) {
				isPressed2 = false
			}
		}
	}
}

private struct BindingShortcut: View {
	@State private var shortcut: KeyboardShortcuts.Shortcut?

	var body: some View {
		KeyboardShortcuts.Recorder("Shortcut", shortcut: $shortcut)
		HStack {
			Text(shortcut.map { "\($0.description)" } ?? "None")
				.foregroundStyle(.secondary)
			Spacer()
			Button("Clear") {
				shortcut = nil
			}
		}
	}
}

private struct DynamicShortcut: View {
	private struct Shortcut: Hashable, Identifiable {
		var id: String
		var name: KeyboardShortcuts.Name
	}

	private static let shortcuts = [
		Shortcut(id: "Shortcut 3", name: .testShortcut3),
		Shortcut(id: "Shortcut 4", name: .testShortcut4)
	]

	@State private var shortcut = Self.shortcuts.first!
	@State private var isPressed = false

	var body: some View {
		LabeledContent("Shortcut") {
			VStack(alignment: .trailing) {
				Picker("Shortcut", selection: $shortcut) {
					ForEach(Self.shortcuts) {
						Text($0.id)
							.tag($0)
					}
				}
				.labelsHidden()
				DynamicShortcutRecorder(name: $shortcut.name, isPressed: $isPressed)
					.labelsHidden()
				Button("Reset All") {
					KeyboardShortcuts.resetAll()
				}
				.frame(maxWidth: .infinity, alignment: .trailing)
			}
		}
		.onChange(of: shortcut, initial: true) { oldValue, newValue in
			onShortcutChange(oldValue: oldValue, newValue: newValue)
		}
	}

	private func onShortcutChange(oldValue: Shortcut, newValue: Shortcut) {
		if oldValue != newValue {
			KeyboardShortcuts.removeHandler(for: oldValue.name)
		}

		KeyboardShortcuts.onKeyDown(for: newValue.name) {
			isPressed = true
		}

		KeyboardShortcuts.onKeyUp(for: newValue.name) {
			isPressed = false
		}
	}
}

private struct DynamicShortcutRecorder: View {
	@FocusState private var isFocused: Bool

	@Binding var name: KeyboardShortcuts.Name
	@Binding var isPressed: Bool

	var body: some View {
		HStack {
			KeyboardShortcuts.Recorder(for: name)
				.labelsHidden()
				.focused($isFocused)
			Text(isPressed ? "👍" : "👎")
				.bold()
				.foregroundStyle(isPressed ? .green : .red)
		}
		.onChange(of: name) { _, _ in
			isFocused = true
		}
	}
}

```

### Core Architecture Module: `Package.swift`
```
// swift-tools-version:6.2
import PackageDescription

let package = Package(
	name: "KeyboardShortcuts",
	defaultLocalization: "en",
	platforms: [
		.macOS(.v10_15)
	],
	products: [
		.library(
			name: "KeyboardShortcuts",
			targets: [
				"KeyboardShortcuts"
			]
		)
	],
	targets: [
		.target(
			name: "KeyboardShortcuts",
			swiftSettings: [
				.defaultIsolation(MainActor.self),
				.enableUpcomingFeature("NonisolatedNonsendingByDefault"),
				.enableUpcomingFeature("InferIsolatedConformances")
			]
		),
		.testTarget(
			name: "KeyboardShortcutsTests",
			dependencies: [
				"KeyboardShortcuts"
			],
			swiftSettings: [
				.defaultIsolation(MainActor.self),
				.enableUpcomingFeature("NonisolatedNonsendingByDefault"),
				.enableUpcomingFeature("InferIsolatedConformances")
			]
		)
	]
)

```

### Core Architecture Module: `Sources/KeyboardShortcuts/ConflictPolicy.swift`
```
#if os(macOS)
import SwiftUI

extension KeyboardShortcuts {
	/**
	The behavior when a keyboard shortcut conflicts with an existing assignment.
	*/
	public enum ConflictBehavior: Equatable, Hashable, Sendable {
		/**
		Show a blocking alert. The shortcut is not saved.
		*/
		case block

		/**
		Show a “Use Anyway” confirmation dialog. The shortcut is saved only if the user confirms.
		*/
		case warn

		/**
		Silently allow the shortcut without any dialog.
		*/
		case allow
	}

	/**
	Controls how the recorder handles each category of keyboard shortcut conflict.
	*/
	public struct ConflictPolicy: Equatable, Hashable, Sendable {
		/**
		Behavior when the shortcut is already used by a menu item in the app's main menu.

		Only applies when recording a different shortcut. Re-recording the current shortcut skips menu conflict handling, while system and custom validation still apply.

		Default: `.block`
		*/
		public var menuItem: ConflictBehavior

		/**
		Behavior when the shortcut is already used by a system-level keyboard shortcut.

		Default: `.warn`
		*/
		public var systemShortcut: ConflictBehavior

		/**
		Behavior when the shortcut is disallowed by the system (e.g. sandboxed macOS 15+ restrictions).

		Default: `.block`. Note: `.warn` is treated the same as `.block` here — showing a “Use Anyway” dialog would be misleading since the shortcut will not work regardless of the user's choice.
		*/
		public var disallowed: ConflictBehavior

		public init(
			menuItem: ConflictBehavior = .block,
			systemShortcut: ConflictBehavior = .warn,
			disallowed: ConflictBehavior = .block
		) {
			self.menuItem = menuItem
			self.systemShortcut = systemShortcut
			self.disallowed = disallowed
		}

		/**
		The default conflict policy, matching the framework's built-in behavior.
		*/
		public static let `default` = Self()

		/**
		A policy that silently allows all shortcuts regardless of conflicts.

		- Important: Only use this if you use completely custom validation with ``Recorder/shortcutValidation(_:)``.
		*/
		public static let allowAll = Self(
			menuItem: .allow,
			systemShortcut: .allow,
			disallowed: .allow
		)
	}
}

extension EnvironmentValues {
	@Entry
	var keyboardShortcutsConflictPolicy = KeyboardShortcuts.ConflictPolicy.default
}

extension View {
	/**
	Controls how all `KeyboardShortcuts.Recorder` views in this view hierarchy handle keyboard shortcut conflicts.

	```swift
	// Warn on menu item conflicts, keep other defaults.
	Form {
		KeyboardShortcuts.Recorder("Toggle Unicorn Mode:", name: .toggleUnicornMode)
	}
	.keyboardShortcutsConflictPolicy(.init(menuItem: .warn))
	```
	*/
	public func keyboardShortcutsConflictPolicy(_ policy: KeyboardShortcuts.ConflictPolicy) -> some View {
		environment(\.keyboardShortcutsConflictPolicy, policy)
	}
}
#endif

```

### Core Architecture Module: `Sources/KeyboardShortcuts/HotKey.swift`
```
#if os(macOS)
import AppKit
import Carbon.HIToolbox

/**
A global keyboard shortcut that automatically unregisters when deallocated.

This is a low-level wrapper around Carbon's hotkey registration. For most use cases, prefer the higher-level `KeyboardShortcuts` API.

- Important: Carbon only allows one registration per unique key combination. Attempting to register the same combination twice will fail.
*/
final class HotKey {
	let carbonKeyCode: Int
	let carbonModifiers: Int
	let onKeyDown: () -> Void
	let onKeyUp: () -> Void
	var onRegistrationFailed: (() -> Void)?

	fileprivate let id: Int
	fileprivate var eventHotKeyRef: EventHotKeyRef?

	/**
	Creates and registers a global keyboard shortcut.

	- Parameters:
		- carbonKeyCode: The virtual key code.
		- carbonModifiers: The modifier flags in Carbon format.
		- onKeyDown: Called when the shortcut key is pressed.
		- onKeyUp: Called when the shortcut key is released.
	- Returns: `nil` if registration fails (e.g., the key combination is already registered).
	*/
	init?(
		carbonKeyCode: Int,
		carbonModifiers: Int,
		onKeyDown: @escaping () -> Void,
		onKeyUp: @escaping () -> Void
	) {
		self.id = HotKeyCenter.shared.nextId()
		self.carbonKeyCode = carbonKeyCode
		self.carbonModifiers = carbonModifiers
		self.onKeyDown = onKeyDown
		self.onKeyUp = onKeyUp

		guard HotKeyCenter.shared.register(self) else {
			return nil
		}
	}

	isolated deinit {
		HotKeyCenter.shared.unregister(self)
	}
}

/**
Manages global keyboard shortcut registrations and event routing.

This is an internal coordinator that handles:
- The shared Carbon event handler
- Routing events to the correct `HotKey` instance
- Switching between normal mode and menu mode (raw key events)
*/
final class HotKeyCenter {
	static let shared = HotKeyCenter()

	enum Mode {
		/**
		All hotkeys are disabled.
		*/
		case disabled

		/**
		Normal hotkey handling.
		*/
		case normal

		/**
		Menu is open - use raw key events instead of Carbon hotkeys.
		*/
		case menuOpen
	}

	private struct WeakHotKey {
		weak var value: HotKey?
	}

	private var lastHotKeyId = 0
	private var hotKeys = [Int: WeakHotKey]()
	private var eventHandler: EventHandlerRef?
	private var openMenuObserver: NSObjectProtocol?
	private var closeMenuObserver: NSObjectProtocol?
	private var isEnabled = true
	private var isMenuOpen = false {
		didSet {
			guard isMenuOpen != oldValue else {
				return
			}

			updateMode()
		}
	}
	private var isHotKeyEventHandlingEnabled = false
	private var isRawKeyEventHandlingEnabled = false

	// `SSKS` is short for `Sindre Sorhus Keyboard Shortcuts`.
	// swiftlint:disable:next number_separator
	private let signature: UInt32 = 1397967699

	private let hotKeyEventTypes = [
		EventTypeSpec(eventClass: OSType(kEventClassKeyboard), eventKind: UInt32(kEventHotKeyPressed)),
		EventTypeSpec(eventClass: OSType(kEventClassKeyboard), eventKind: UInt32(kEventHotKeyReleased))
	]

	private let rawKeyEventTypes = [
		EventTypeSpec(eventClass: OSType(kEventClassKeyboard), eventKind: UInt32(kEventRawKeyDown)),
		EventTypeSpec(eventClass: OSType(kEventClassKeyboard), eventKind: UInt32(kEventRawKeyUp))
	]

	private lazy var runLoopKeyEventMonitor = RunLoopLocalEventMonitor(events: [.keyDown, .keyUp], runLoopMode: .eventTracking) { [weak self] event in
		self?.handleKeyEvent(event) ?? event
	}

	// The run-loop and AppKit monitors are complementary: menu tracking consumes some keys before AppKit dispatches them, while function keys such as F2 can instead arrive through `NSApplication.sendEvent(_:)`.
	private lazy var appKitKeyEventMonitor = LocalEventMonitor(events: [.keyDown, .keyUp]) { [weak self] event in
		self?.handleKeyEvent(event) ?? event
	}

	private func handleKeyEvent(_ event: NSEvent) -> NSEvent? {
		guard
			handleRawKeyEvent(
				keyCode: Int(event.keyCode),
				modifiers: event.modifiers.carbon,
				isRepeat: event.isARepeat,
				eventKind: event.type == .keyDown ? kEventRawKeyDown : kEventRawKeyUp
			) == noErr
		else {
			return event
		}

		return nil
	}

	private(set) var mode: Mode = .normal {
		didSet {
			guard mode != oldValue else {
				return
			}

			updateEventHandler()
		}
	}

	private init() {
		setUpMenuTrackingObserversIfNeeded()
	}

	/**
	Sets whether global hotkeys are enabled and updates mode accordingly.
	*/
	func setEnabled(_ isEnabled: Bool) {
		guard self.isEnabled != isEnabled else {
			return
		}

		self.isEnabled = isEnabled
		updateMode()
	}

	/**
	Sets up menu tracking observers that toggle menu-open hotkey mode.
	*/
	private func setUpMenuTrackingObserversIfNeeded() {
		guard
			openMenuObserver == nil,
			closeMenuObserver == nil
		else {
			return
		}

		/* Manual testing only showed these notifications for the top-level tracked menu, so a boolean is enough here. */
		openMenuObserver = NotificationCenter.default.addObserver(forName: NSMenu.didBeginTrackingNotification, object: nil, queue: nil) { [weak self] _ in
			if Thread.isMainThread {
				MainActor.assumeIsolated {
					self?.menuDidBeginTracking()
				}
				return
			}

			Task { @MainActor [weak self] in
				self?.menuDidBeginTracking()
			}
		}

		closeMenuObserver = NotificationCenter.default.addObserver(forName: NSMenu.didEndTrackingNotification, object: nil, queue: nil) { [weak self] _ in
			if Thread.isMainThread {
				MainActor.assumeIsolated {
					self?.menuDidEndTracking()
				}
				return
			}

			Task { @MainActor [weak self] in
				self?.menuDidEndTracking()
			}
		}
	}

	private func menuDidBeginTracking() {
		isMenuOpen = true
	}

	private func menuDidEndTracking() {
		isMenuOpen = false
	}

	private func updateMode() {
		mode = isEnabled ? (isMenuOpen ? .menuOpen : .normal) : .disabled
	}

	func nextId() -> Int {
		lastHotKeyId += 1
		return lastHotKeyId
	}

	func register(_ hotKey: HotKey) -> Bool {
		guard let eventHotKey = registerEventHotKey(for: hotKey) else {
			return false
		}

		hotKey.eventHotKeyRef = eventHotKey
		hotKeys[hotKey.id] = WeakHotKey(value: hotKey)
		setUpEventHandlerIfNeeded()
		updateEventHandler()

		return true
	}

	func unregister(_ hotKey: HotKey) {
		if let eventHotKeyRef = hotKey.eventHotKeyRef {
			UnregisterEventHotKey(eventHotKeyRef)
			hotKey.eventHotKeyRef = nil
		}

		hotKeys.removeValue(forKey: hotKey.id)
	}

	private func pause(_ hotKey: HotKey) {
		guard let eventHotKeyRef = hotKey.eventHotKeyRef else {
			return
		}

		UnregisterEventHotKey(eventHotKeyRef)
		hotKey.eventHotKeyRef = nil
	}

	private func resume(_ hotKey: HotKey) {
		guard hotKey.eventHotKeyRef == nil else {
			return
		}

		guard let eventHotKey = registerEventHotKey(for: hotKey) else {
			unregister(hotKey)
			hotKey.onRegistrationFailed?()
			return
		}

		hotKey.eventHotKeyRef = eventHotKey
	}

	private func registerEventHotKey(for hotKey: HotKey) -> EventHotKeyRef? {
		var eventHotKey: EventHotKeyRef?
		let error = RegisterEventHotKey(
			UInt32(hotKey.carbonKeyCode),
			UInt32(hotKey.carbonModifiers),
			EventHotKeyID(signature: signature, id: UInt32(hotKey.id)),
			GetEventDispatcherTarget(),
			0,
			&eventHotKey
		)

		guard
			error == noErr,
			let eventHotKey
		else {
			return nil
		}

		return eventHotKey
	}

	private func pauseAllHotKeys() {
		for hotKey in hotKeys.values.compactMap(\.value) {
			pause(hotKey)
		}
	}

	private func resumeAllHotKeys() {
		for hotKey in hotKeys.values.compactMap(\.value) {
			resume(hotKey)
		}
	}

	// MARK: - Event Handler

	private func setUpEventHandlerIfNeeded() {
		guard
			eventHandler == nil,
			let dispatcher = GetEventDispatcherTarget()
		else {
			return
		}

		var handler: EventHandlerRef?
		let error = InstallEventHandler(
			dispatcher,
			carbonEventHandler,
			0,
			nil,
			Unmanaged.passUnretained(self).toOpaque(),
			&handler
		)

		guard
			error == noErr,
			let handler
		else {
			return
		}

		eventHandler = handler
		// Do not update state here: this setup runs only once, while `register(_:)` must apply the current state after every hot key is added.
	}

	private func updateEventHandler() {
		guard eventHandler != nil else {
			return
		}

		let shouldHandleHotKeys = mode == .normal
		let shouldHandleRawKeys = mode == .menuOpen

		if shouldHandleHotKeys {
			resumeAllHotKeys()
		} else {
			pauseAllHotKeys()
		}

		setHotKeyEventHandlingEnabled(shouldHandleHotKeys)
		setRawKeyEventHandlingEnabled(shouldHandleRawKeys)
	}

	private func setHotKeyEventHandlingEnabled(_ isEnabled: Bool) {
		guard isHotKeyEventHandlingEnabled != isEnabled else {
			return
		}

		isHotKeyEventHandlingEnabled = isEnabled

		if isEnabled {
			AddEventTypesToHandler(eventHandler, hotKeyEventTypes.count, hotKeyEventTypes)
		} else {
			RemoveEventTypesFromHandler(eventHandler, hotKeyEventTypes.count, hotKeyEventTypes)
		}
	}

	private func setRawKeyEventHandlingEnabled(_ isEnabled: Bool) {
		guard isRawKeyEventHandlingEnabled != isEnabled else {
			return
		}

		isRawKeyEventHandlingEnabled = isEnabled

		if #available(macOS 14, *) {
			if isEnabled {
				runLoopKeyEventMonitor.start()
				appKitKeyEventMonitor.start()
			} else {
				runLoopKeyEventMonitor.stop()
				appKitKeyEventMonitor.stop()
			}
		} else if isEnabled {
			AddEventTypesToHandler(eventHandler, rawKeyEventTypes.count, rawKeyEventTypes)
		} else {
			RemoveEventTypesFromHandler(eventHandler, rawKeyEventTypes.count, rawKeyEventTypes)
		}
	}

	fileprivate func handleEvent(_ event: EventRef?) -> OSStatus {
		guard let event else {
			return OSStatus(eventNotHandledErr)
		}

		switch Int(GetEventKind(event)) {
		case kEventHotKeyPressed, kEventHotKeyReleased:
			return handleHotKeyEvent(event)
		case kEventRawKeyDown, kEventRawKeyUp:
			return handleRawKeyEvent(event)
		default:
			return OSStatus(eventNotHandledErr)
		}
	}

	private func handleHotKeyEvent(_ event: EventRef) -> OSStatus {
		var eventHotKeyId = EventHotKeyID()
		let error = GetEventParameter(
			event,
			UInt32(kEventParamDirectObject),
			UInt32(typeEventHotKeyID),
			nil,
			MemoryLayout<EventHotKeyID>.size,
			nil,
			&eventHotK
```

### Core Architecture Module: `Sources/KeyboardShortcuts/Key.swift`
```
#if os(macOS)
import Carbon.HIToolbox

extension KeyboardShortcuts {
	// swiftlint:disable identifier_name
	/**
	Represents a key on the keyboard.
	*/
	nonisolated public struct Key: Hashable, RawRepresentable, Sendable {
		// MARK: Letters

		public static let a = Self(kVK_ANSI_A)
		public static let b = Self(kVK_ANSI_B)
		public static let c = Self(kVK_ANSI_C)
		public static let d = Self(kVK_ANSI_D)
		public static let e = Self(kVK_ANSI_E)
		public static let f = Self(kVK_ANSI_F)
		public static let g = Self(kVK_ANSI_G)
		public static let h = Self(kVK_ANSI_H)
		public static let i = Self(kVK_ANSI_I)
		public static let j = Self(kVK_ANSI_J)
		public static let k = Self(kVK_ANSI_K)
		public static let l = Self(kVK_ANSI_L)
		public static let m = Self(kVK_ANSI_M)
		public static let n = Self(kVK_ANSI_N)
		public static let o = Self(kVK_ANSI_O)
		public static let p = Self(kVK_ANSI_P)
		public static let q = Self(kVK_ANSI_Q)
		public static let r = Self(kVK_ANSI_R)
		public static let s = Self(kVK_ANSI_S)
		public static let t = Self(kVK_ANSI_T)
		public static let u = Self(kVK_ANSI_U)
		public static let v = Self(kVK_ANSI_V)
		public static let w = Self(kVK_ANSI_W)
		public static let x = Self(kVK_ANSI_X)
		public static let y = Self(kVK_ANSI_Y)
		public static let z = Self(kVK_ANSI_Z)
		// swiftlint:enable identifier_name

		// MARK: Numbers

		public static let zero = Self(kVK_ANSI_0)
		public static let one = Self(kVK_ANSI_1)
		public static let two = Self(kVK_ANSI_2)
		public static let three = Self(kVK_ANSI_3)
		public static let four = Self(kVK_ANSI_4)
		public static let five = Self(kVK_ANSI_5)
		public static let six = Self(kVK_ANSI_6)
		public static let seven = Self(kVK_ANSI_7)
		public static let eight = Self(kVK_ANSI_8)
		public static let nine = Self(kVK_ANSI_9)

		// MARK: Modifiers

		public static let capsLock = Self(kVK_CapsLock)
		public static let shift = Self(kVK_Shift)
		public static let function = Self(kVK_Function)
		public static let control = Self(kVK_Control)
		public static let option = Self(kVK_Option)
		public static let command = Self(kVK_Command)
		public static let rightCommand = Self(kVK_RightCommand)
		public static let rightOption = Self(kVK_RightOption)
		public static let rightControl = Self(kVK_RightControl)
		public static let rightShift = Self(kVK_RightShift)

		// MARK: Miscellaneous

		public static let `return` = Self(kVK_Return)
		public static let backslash = Self(kVK_ANSI_Backslash)
		public static let backtick = Self(kVK_ANSI_Grave)
		public static let comma = Self(kVK_ANSI_Comma)
		public static let equal = Self(kVK_ANSI_Equal)
		public static let minus = Self(kVK_ANSI_Minus)
		public static let period = Self(kVK_ANSI_Period)
		public static let quote = Self(kVK_ANSI_Quote)
		public static let semicolon = Self(kVK_ANSI_Semicolon)
		public static let slash = Self(kVK_ANSI_Slash)
		public static let space = Self(kVK_Space)
		public static let tab = Self(kVK_Tab)
		public static let leftBracket = Self(kVK_ANSI_LeftBracket)
		public static let rightBracket = Self(kVK_ANSI_RightBracket)
		public static let pageUp = Self(kVK_PageUp)
		public static let pageDown = Self(kVK_PageDown)
		public static let home = Self(kVK_Home)
		public static let end = Self(kVK_End)
		public static let upArrow = Self(kVK_UpArrow)
		public static let rightArrow = Self(kVK_RightArrow)
		public static let downArrow = Self(kVK_DownArrow)
		public static let leftArrow = Self(kVK_LeftArrow)
		public static let escape = Self(kVK_Escape)
		public static let delete = Self(kVK_Delete)
		public static let deleteForward = Self(kVK_ForwardDelete)
		public static let help = Self(kVK_Help)
		public static let mute = Self(kVK_Mute)
		public static let volumeUp = Self(kVK_VolumeUp)
		public static let volumeDown = Self(kVK_VolumeDown)

		// MARK: Function

		public static let f1 = Self(kVK_F1)
		public static let f2 = Self(kVK_F2)
		public static let f3 = Self(kVK_F3)
		public static let f4 = Self(kVK_F4)
		public static let f5 = Self(kVK_F5)
		public static let f6 = Self(kVK_F6)
		public static let f7 = Self(kVK_F7)
		public static let f8 = Self(kVK_F8)
		public static let f9 = Self(kVK_F9)
		public static let f10 = Self(kVK_F10)
		public static let f11 = Self(kVK_F11)
		public static let f12 = Self(kVK_F12)
		public static let f13 = Self(kVK_F13)
		public static let f14 = Self(kVK_F14)
		public static let f15 = Self(kVK_F15)
		public static let f16 = Self(kVK_F16)
		public static let f17 = Self(kVK_F17)
		public static let f18 = Self(kVK_F18)
		public static let f19 = Self(kVK_F19)
		public static let f20 = Self(kVK_F20)

		// MARK: Keypad

		public static let keypad0 = Self(kVK_ANSI_Keypad0)
		public static let keypad1 = Self(kVK_ANSI_Keypad1)
		public static let keypad2 = Self(kVK_ANSI_Keypad2)
		public static let keypad3 = Self(kVK_ANSI_Keypad3)
		public static let keypad4 = Self(kVK_ANSI_Keypad4)
		public static let keypad5 = Self(kVK_ANSI_Keypad5)
		public static let keypad6 = Self(kVK_ANSI_Keypad6)
		public static let keypad7 = Self(kVK_ANSI_Keypad7)
		public static let keypad8 = Self(kVK_ANSI_Keypad8)
		public static let keypad9 = Self(kVK_ANSI_Keypad9)
		public static let keypadClear = Self(kVK_ANSI_KeypadClear)
		public static let keypadDecimal = Self(kVK_ANSI_KeypadDecimal)
		public static let keypadDivide = Self(kVK_ANSI_KeypadDivide)
		public static let keypadEnter = Self(kVK_ANSI_KeypadEnter)
		public static let keypadEquals = Self(kVK_ANSI_KeypadEquals)
		public static let keypadMinus = Self(kVK_ANSI_KeypadMinus)
		public static let keypadMultiply = Self(kVK_ANSI_KeypadMultiply)
		public static let keypadPlus = Self(kVK_ANSI_KeypadPlus)

		// MARK: Properties

		/**
		The raw key code.
		*/
		public let rawValue: Int

		// MARK: Initializers

		/**
		Create a `Key` from a key code.
		*/
		public init(rawValue: Int) {
			self.rawValue = rawValue
		}

		private init(_ value: Int) {
			self.init(rawValue: value)
		}
	}
}

extension KeyboardShortcuts.Key {
	/**
	All the function keys.
	*/
	nonisolated static let functionKeys: Set<Self> = [
		.f1,
		.f2,
		.f3,
		.f4,
		.f5,
		.f6,
		.f7,
		.f8,
		.f9,
		.f10,
		.f11,
		.f12,
		.f13,
		.f14,
		.f15,
		.f16,
		.f17,
		.f18,
		.f19,
		.f20
	]

	/**
	Keys whose system event representations intrinsically include the Fn modifier, even when Fn was not pressed.
	*/
	nonisolated static let keysWithSynthesizedFunctionModifier = functionKeys.union([
		.help,
		.deleteForward,
		// AppKit synthesizes Fn for keypad Clear, while keypad Enter carries only the numeric-pad modifier.
		.keypadClear,
		.home,
		.end,
		.pageUp,
		.pageDown,
		.upArrow,
		.rightArrow,
		.downArrow,
		.leftArrow
	])

	/**
	Returns true if the key is a function key. For example, `F1`.
	*/
	var isFunctionKey: Bool { Self.functionKeys.contains(self) }

	/**
	Returns true if the key's system event representations intrinsically include the Fn modifier.
	*/
	nonisolated var hasSynthesizedFunctionModifier: Bool { Self.keysWithSynthesizedFunctionModifier.contains(self) }
}
#endif

```

### Core Architecture Module: `Sources/KeyboardShortcuts/KeyboardShortcuts.swift`
```
#if os(macOS)
import AppKit
import Foundation

/**
Global keyboard shortcuts for your macOS app.
*/
public enum KeyboardShortcuts {
	/**
	The result of validating a keyboard shortcut.
	*/
	public enum ValidationResult: Sendable, Equatable {
		/**
		The shortcut is allowed.
		*/
		case allow

		/**
		The shortcut is disallowed.

		- Parameter reason: A message explaining why the shortcut is disallowed.
		*/
		case disallow(reason: String)

		/**
		Creates a disallow result with a localized reason.
		*/
		@available(macOS 13, *)
		public static func disallow(reason: LocalizedStringResource) -> Self {
			.disallow(reason: String(localized: reason))
		}
	}

	private static var hotKeys = [Shortcut: HotKey]()
	private static var disabledNames = Set<Name>()

	private static var keyDownHandlers = [Name: [() -> Void]]()
	private static var keyUpHandlers = [Name: [() -> Void]]()

	private static var streamKeyDownHandlers = [Name: [UUID: () -> Void]]()
	private static var streamKeyUpHandlers = [Name: [UUID: () -> Void]]()
	private static var streamShortcutKeyDownHandlers = [Shortcut: [UUID: () -> Void]]()
	private static var streamShortcutKeyUpHandlers = [Shortcut: [UUID: () -> Void]]()

	private static var isInitialized = false

	/**
	When `true`, the registered keyboard shortcuts are temporarily unregistered so the key events reach the app instead of being consumed as hot keys.

	This is used while recording so the user can press a shortcut that is already registered, for example, re-recording the current shortcut.
	*/
	static var isPaused = false {
		didSet {
			guard isPaused != oldValue else {
				return
			}

			updateHotKeyMode()
		}
	}

	/**
	Enable/disable monitoring of all keyboard shortcuts.

	The default is `true`.
	*/
	public static var isEnabled = true {
		didSet {
			guard isEnabled != oldValue else {
				return
			}

			updateHotKeyMode()
		}
	}

	/**
	All shortcut names that currently have a stored value in `UserDefaults`.

	This includes names whose shortcut was set by the user or via an `initial:` parameter on ``Name/init(_:initial:)``. Names that were never stored will not appear. The returned `Name` instances only carry the `rawValue`, not the `initialShortcut`.

	Useful for dynamic shortcut management, for example, removing deprecated shortcuts:

	```swift
	let activeNames: Set<String> = ["newAction", "anotherAction"]

	for name in KeyboardShortcuts.storedNames where !activeNames.contains(name.rawValue) {
		KeyboardShortcuts.setShortcut(nil, for: name)
	}
	```
	*/
	public static var storedNames: Set<Name> {
		UserDefaults.standard.dictionaryRepresentation()
			.compactMap { key, _ in
				guard key.hasPrefix(userDefaultsPrefix) else {
					return nil
				}

				let rawValue = key.replacingPrefix(userDefaultsPrefix, with: "")
				return .init(rawValueWithoutInitialization: rawValue)
			}
			.toSet()
	}

	private static func updateHotKeyMode() {
		// Carbon consumes the key press while its hot key remains registered. Suppressing callbacks alone would leave the recorder unable to receive the shortcut.
		HotKeyCenter.shared.setEnabled(isEnabled && !isPaused)
	}

	private static var namesWithKeyHandlers: Set<Name> {
		Set(keyDownHandlers.keys).union(keyUpHandlers.keys)
	}

	private static var namesWithAllHandlers: Set<Name> {
		namesWithKeyHandlers
			.union(streamKeyDownHandlers.keys)
			.union(streamKeyUpHandlers.keys)
	}

	private static func hasHandlers<Handlers: Collection>(for name: Name, in handlers: [Name: Handlers]) -> Bool {
		handlers[name]?.isEmpty == false
	}

	private static func hasHandlers(for name: Name) -> Bool {
		hasHandlers(for: name, in: keyDownHandlers)
			|| hasHandlers(for: name, in: keyUpHandlers)
			|| hasHandlers(for: name, in: streamKeyDownHandlers)
			|| hasHandlers(for: name, in: streamKeyUpHandlers)
	}

	private static func hasHandlers<Handlers: Collection>(for shortcut: Shortcut, in handlers: [Shortcut: Handlers]) -> Bool {
		handlers[shortcut]?.isEmpty == false
	}

	/**
	Returns whether a hard-coded shortcut has active stream handlers.
	*/
	private static func hasHardCodedStreamHandlers(for shortcut: Shortcut) -> Bool {
		hasHandlers(for: shortcut, in: streamShortcutKeyDownHandlers)
			|| hasHandlers(for: shortcut, in: streamShortcutKeyUpHandlers)
	}

	private static func hasActiveHandlers(for name: Name) -> Bool {
		guard !disabledNames.contains(name) else {
			return false
		}

		return hasHandlers(for: name)
	}

	private static func hasActiveStreamHandlers(for name: Name) -> Bool {
		guard !disabledNames.contains(name) else {
			return false
		}

		return hasHandlers(for: name, in: streamKeyDownHandlers)
			|| hasHandlers(for: name, in: streamKeyUpHandlers)
	}

	private static func isShortcutActive(_ shortcut: Shortcut, excluding nameToExclude: Name? = nil) -> Bool {
		let hasActiveNamedHandlers = namesWithAllHandlers.contains { name in
			if let nameToExclude, name == nameToExclude {
				return false
			}

			guard hasActiveHandlers(for: name) else {
				return false
			}

			return getShortcut(for: name) == shortcut
		}

		guard !hasActiveNamedHandlers else {
			return true
		}

		return hasHardCodedStreamHandlers(for: shortcut)
	}

	/**
	Removes a stream handler from a dictionary and prunes the key when the last handler is removed.
	*/
	private static func removeStreamHandlerEntry<Key: Hashable>(
		_ id: UUID,
		for key: Key,
		in handlers: inout [Key: [UUID: () -> Void]]
	) {
		handlers[key]?[id] = nil

		if handlers[key]?.isEmpty == true {
			handlers[key] = nil
		}
	}

	private static func registerIfNeeded(for shortcut: Shortcut) {
		guard hotKeys[shortcut] == nil else {
			return
		}

		let hotKey = HotKey(
			carbonKeyCode: shortcut.carbonKeyCode,
			carbonModifiers: shortcut.carbonModifiers,
			onKeyDown: { [shortcut] in handleKeyEvent(.keyDown, for: shortcut) },
			onKeyUp: { [shortcut] in handleKeyEvent(.keyUp, for: shortcut) }
		)

		hotKey?.onRegistrationFailed = { [shortcut, weak hotKey] in
			guard
				let hotKey,
				hotKeys[shortcut] === hotKey
			else {
				return
			}

			hotKeys[shortcut] = nil
		}

		hotKeys[shortcut] = hotKey
	}

	/**
	Register the shortcut for the given name if it has a shortcut and isn't already registered.
	*/
	private static func registerIfNeeded(for name: Name) {
		guard hasActiveHandlers(for: name) else {
			return
		}

		guard let shortcut = getShortcut(for: name) else {
			return
		}

		registerIfNeeded(for: shortcut)
	}

	private static func unregister(_ shortcut: Shortcut) {
		hotKeys[shortcut] = nil // HotKey.deinit handles Carbon unregistration
	}

	/**
	Unregister the shortcut for the given name if no other names use it.
	*/
	private static func unregisterIfNeeded(for name: Name, excludingCurrentName: Bool = true) {
		guard let shortcut = getShortcut(for: name) else {
			return
		}

		let excludedName = excludingCurrentName ? name : nil

		guard !isShortcutActive(shortcut, excluding: excludedName) else {
			return
		}

		unregister(shortcut)
	}

	private static func unregisterIfNeeded(for shortcut: Shortcut) {
		guard !isShortcutActive(shortcut) else {
			return
		}

		unregister(shortcut)
	}

	private static func unregisterAll() {
		hotKeys.removeAll() // HotKey.deinit handles Carbon unregistration
	}

	static func initialize() {
		guard !isInitialized else {
			return
		}

		_ = HotKeyCenter.shared
		isInitialized = true
	}

	/**
	Remove all handlers receiving keyboard shortcuts events.

	This can be used to reset the handlers before re-creating them to avoid having multiple handlers for the same shortcut.

	- Note: This method does not affect listeners using ``events(for:)``.
	*/
	public static func removeAllHandlers() {
		// Collect shortcuts that might need unregistering
		let shortcutsToCheck = namesWithKeyHandlers.compactMap { getShortcut(for: $0) }.toSet()

		keyDownHandlers = [:]
		keyUpHandlers = [:]

		// Unregister shortcuts that no longer have any handlers
		for shortcut in shortcutsToCheck where !isShortcutActive(shortcut) {
			unregister(shortcut)
		}
	}

	/**
	Remove the keyboard shortcut handler for the given name.

	This can be used to reset the handler before re-creating it to avoid having multiple handlers for the same shortcut.

	- Parameter name: The name of the keyboard shortcut to remove handlers for.

	- Note: This method does not affect listeners using ``events(for:)``.
	*/
	public static func removeHandler(for name: Name) {
		keyDownHandlers[name] = nil
		keyUpHandlers[name] = nil

		guard !hasActiveStreamHandlers(for: name) else {
			return
		}

		unregisterIfNeeded(for: name)
	}

	/**
	Returns whether the keyboard shortcut for the given name is enabled.

	This checks if the shortcut is registered and will trigger handlers. It respects the global ``isEnabled``.

	```swift
	let isEnabled = KeyboardShortcuts.isEnabled(for: .toggleUnicornMode)
	```

	- Tip: Use ``disable(_:)-(Name...)`` and ``enable(_:)-(Name...)`` to change the status.
	*/
	public static func isEnabled(for name: Name) -> Bool {
		guard
			isEnabled,
			hasActiveHandlers(for: name),
			let shortcut = getShortcut(for: name),
			hotKeys[shortcut] != nil
		else {
			return false
		}

		return true
	}

	/**
	Disable the keyboard shortcut for one or more names.
	*/
	public static func disable(_ names: [Name]) {
		for name in names {
			disabledNames.insert(name)
			unregisterIfNeeded(for: name)
		}
	}

	/**
	Disable the keyboard shortcut for one or more names.
	*/
	public static func disable(_ names: Name...) {
		disable(names)
	}

	/**
	Enable the keyboard shortcut for one or more names.
	*/
	public static func enable(_ names: [Name]) {
		for name in names {
			disabledNames.remove(name)
			registerIfNeeded(for: name)
		}
	}

	/**
	Enable the keyboard shortcut for one or more names.
	*/
	public static func enable(_ names: Name...) {
		enable(names)
	}

	/**
	Reset the keyboard shortcut for one or more names.

	If the `Name` has an initial shortcut, it will reset to that.

	- Note: This overload exists as Swift doesn't support spl
```

### Core Architecture Module: `Sources/KeyboardShortcuts/NSMenuItem++.swift`
```
#if os(macOS)
import AppKit

// Workaround for a Swift 6.3 compiler crash (SR/rdar) where the optimizer crashes on deinit of a
// generic class nested inside an extension. Using a concrete non-generic class avoids the bug.
// https://github.com/sindresorhus/KeyboardShortcuts/issues/240
private final class WeakMenuItem: @unchecked Sendable {
	weak var value: NSMenuItem?

	init(_ value: NSMenuItem) {
		self.value = value
	}
}

extension NSMenuItem {
	private struct FallbackShortcut: Sendable {
		let keyEquivalent: String
		let modifierMask: NSEvent.ModifierFlags
	}

	private enum AssociatedKeys {
		static let observer = ObjectAssociation<NSObjectProtocol>()
		static let fallback = ObjectAssociation<FallbackShortcut>()
	}

	private func clearShortcut() {
		keyEquivalent = ""
		keyEquivalentModifierMask = []

		if #available(macOS 12, *) {
			allowsAutomaticKeyEquivalentLocalization = true
		}
	}

	private func restoreShortcut() {
		if let fallback = AssociatedKeys.fallback[self] {
			keyEquivalent = fallback.keyEquivalent
			keyEquivalentModifierMask = fallback.modifierMask

			if #available(macOS 12, *) {
				allowsAutomaticKeyEquivalentLocalization = true
			}
		} else {
			clearShortcut()
		}
	}

	/**
	Applies a shortcut without changing the menu item's name binding.
	*/
	private func applyShortcut(_ shortcut: KeyboardShortcuts.Shortcut?) {
		guard let shortcut else {
			clearShortcut()
			return
		}

		keyEquivalent = shortcut.nsMenuItemKeyEquivalent ?? ""
		keyEquivalentModifierMask = shortcut.modifiers

		if #available(macOS 12, *) {
			allowsAutomaticKeyEquivalentLocalization = false
		}
	}

	private func removeShortcutObserver() {
		guard let existingObserver = AssociatedKeys.observer[self] else {
			return
		}

		NotificationCenter.default.removeObserver(existingObserver)
		AssociatedKeys.observer[self] = nil
	}

	// TODO: Make this a getter/setter. We must first add the ability to create a `Shortcut` from a `keyEquivalent`.
	/**
	Show a recorded keyboard shortcut in a `NSMenuItem`.

	The menu item will automatically be kept up to date with changes to the keyboard shortcut.

	Pass in `nil` to clear the keyboard shortcut.

	This method overrides `.keyEquivalent` and `.keyEquivalentModifierMask`. The original values are preserved and restored when the global shortcut is cleared.

	```swift
	import AppKit
	import KeyboardShortcuts

	extension KeyboardShortcuts.Name {
		static let toggleUnicornMode = Self("toggleUnicornMode")
	}

	// … `Recorder` logic for recording the keyboard shortcut …

	let menuItem = NSMenuItem()
	menuItem.title = "Toggle Unicorn Mode"
	menuItem.setShortcut(for: .toggleUnicornMode)
	```

	You can test this method in the example project. Run it, record a shortcut and then look at the “Test” menu in the app's main menu.

	- Important: You will have to disable the global keyboard shortcut while the menu is open, as otherwise, the keyboard events will be buffered up and triggered when the menu closes. This is because `NSMenu` puts the thread in tracking-mode, which prevents the keyboard events from being received. You can listen to whether a menu is open by implementing `NSMenuDelegate#menuWillOpen` and `NSMenuDelegate#menuDidClose`. You then use `KeyboardShortcuts.disable` and `KeyboardShortcuts.enable`.
	*/
	public func setShortcut(for name: KeyboardShortcuts.Name?) {
		guard let name else {
			restoreShortcut()
			AssociatedKeys.fallback[self] = nil
			removeShortcutObserver()
			return
		}

		if AssociatedKeys.observer[self] != nil {
			removeShortcutObserver()
		} else {
			AssociatedKeys.fallback[self] = FallbackShortcut(
				keyEquivalent: keyEquivalent,
				modifierMask: keyEquivalentModifierMask
			)
		}

		let shortcut = KeyboardShortcuts.Shortcut(name: name)
		if let shortcut {
			applyShortcut(shortcut)
		} else {
			restoreShortcut()
		}

		let menuItemReference = WeakMenuItem(self)

		// TODO: Use AsyncStream when targeting macOS 15.
		AssociatedKeys.observer[self] = NotificationCenter.default.addObserver(forName: .shortcutByNameDidChange, object: nil, queue: .main) { notification in
			guard
				let nameInNotification = notification.keyboardShortcutsName,
				nameInNotification == name
			else {
				return
			}

			MainActor.assumeIsolated {
				guard let menuItem = menuItemReference.value else {
					return
				}

				let shortcut = KeyboardShortcuts.Shortcut(name: name)
				if let shortcut {
					// Keep the binding alive across updates. The public setter would detach this observer and discard the original fallback.
					menuItem.applyShortcut(shortcut)
				} else {
					menuItem.restoreShortcut()
				}
			}
		}
	}

	/**
	Add a keyboard shortcut to a `NSMenuItem`.

	This method is only recommended for dynamic shortcuts. In general, it's preferred to create a static shortcut name and use `NSMenuItem.setShortcut(for:)` instead.

	Pass in `nil` to clear the keyboard shortcut.

	This method overrides `.keyEquivalent` and `.keyEquivalentModifierMask`.

	Any previous shortcut name binding is removed.

	- Important: You will have to disable the global keyboard shortcut while the menu is open, as otherwise, the keyboard events will be buffered up and triggered when the menu closes. This is because `NSMenu` puts the thread in tracking-mode, which prevents the keyboard events from being received. You can listen to whether a menu is open by implementing `NSMenuDelegate#menuWillOpen` and `NSMenuDelegate#menuDidClose`. You then use `KeyboardShortcuts.disable` and `KeyboardShortcuts.enable`.
	*/
	@_disfavoredOverload
	public func setShortcut(_ shortcut: KeyboardShortcuts.Shortcut?) {
		// Direct assignment ends the old binding, including when clearing the shortcut. A later named binding must capture this new value as its fallback.
		removeShortcutObserver()
		AssociatedKeys.fallback[self] = nil
		applyShortcut(shortcut)
	}
}
#endif

```

### Core Architecture Module: `Sources/KeyboardShortcuts/Name.swift`
```
#if os(macOS)
extension KeyboardShortcuts {
	/**
	The strongly-typed name of the keyboard shortcut.

	After registering it, you can use it in, for example, `KeyboardShortcut.Recorder` and `KeyboardShortcut.onKeyUp()`.

	```swift
	import KeyboardShortcuts

	extension KeyboardShortcuts.Name {
		static let toggleUnicornMode = Self("toggleUnicornMode")
	}
	```
	*/
	nonisolated public struct Name: Hashable, Sendable {
		// This makes it possible to use `Shortcut` without the namespace.
		@_documentation(visibility: private)
		public typealias Shortcut = KeyboardShortcuts.Shortcut

		public let rawValue: String
		public let initialShortcut: Shortcut?

		@available(*, deprecated, renamed: "initialShortcut")
		public var defaultShortcut: Shortcut? { initialShortcut }

		/**
		- Parameter name: Name of the shortcut.
		- Parameter initialShortcut: Optional initial key combination. Do not set this unless it's essential. Users find it annoying when random apps steal their existing keyboard shortcuts. It's generally better to show a welcome screen on the first app launch that lets the user set the shortcut.
		- Important: The name must not contain a dot (`.`) because it is used as a key path for observation.
		*/
		nonisolated
		public init(_ name: String, initial initialShortcut: Shortcut? = nil) {
			runtimeWarn(
				KeyboardShortcuts.isValidShortcutName(name),
				"The keyboard shortcut name must not contain a dot (.)."
			)

			self.rawValue = name
			self.initialShortcut = initialShortcut

			if let initialShortcut {
				KeyboardShortcuts.setInitialShortcutIfNeeded(
					initialShortcut,
					forRawValue: name
				)
			}

			// TODO: Use `Task.immediate` when targeting macOS 26.
			Task { @MainActor in
				KeyboardShortcuts.initialize()
			}
		}

		@available(*, deprecated, renamed: "init(_:initial:)")
		nonisolated
		public init(_ name: String, `default` initialShortcut: Shortcut?) {
			self.init(name, initial: initialShortcut)
		}
	}
}

nonisolated
extension KeyboardShortcuts.Name {
	init(rawValueWithoutInitialization rawValue: String) {
		self.rawValue = rawValue
		self.initialShortcut = nil
	}
}

nonisolated
extension KeyboardShortcuts.Name: RawRepresentable {
	@_documentation(visibility: private)
	public init?(rawValue: String) {
		self.init(rawValueWithoutInitialization: rawValue)
	}
}

extension KeyboardShortcuts.Name {
	/**
	The keyboard shortcut assigned to the name.
	*/
	@MainActor
	public var shortcut: Shortcut? {
		get {
			KeyboardShortcuts.getShortcut(for: self)
		}
		nonmutating set {
			KeyboardShortcuts.setShortcut(newValue, for: self)
		}
	}
}
#endif

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #242** (2026-09-11): **Performance issue while hovering a menu**
  *Symptoms*: The observer in `RunLoopLocalEventMonitor` runs on every pass of the `.eventTracking` run loop and each pass calls `NSApp.nextEvent`. This is expensive: it triggers a CoreAnimation commit and full layout pass.   Here is a sample taken while hovering over a menu:  ``` nextEventMatchingMask:untilDate:inMode:dequeue:   _DPSNextEvent → _BlockUntilNextEventMatchingListInMode → ReceiveNextEventCommon     RunCurrentEventLoopInMode → _CFRunLoopRunSpecificWithOptions       CA::Transaction::commit() → NSDisplayCycleFlush → NSHostingView.layout() ```  The upshot is that the menu's highlight lags behind the cursor.   Separately, every re-posted mouse-moved event is expensive. While hovering, I could get my CPU to spike to 50% (M5 Pro).  One solution is to gate the observer callback with a call to `CGEventSource.counterForEventType` and exit early if the counter hasn't incremented:  ```swift var lastKeyEventCount = UInt32.max ...  let keyEventCount = keyEventTypes.reduce(0) { // .keyUp and .keyDown   $0 &+ CGEventSource.counterForEventType(.combinedSessionState, eventType: $1) }  guard keyEventCount != lastKeyEventCount else {   // Nothing was pressed or released since the last pass so there is nothing to do.   return } ```  There is a side-effect though: the counter doesn't increment while a menu _within the hosting app_ is open. In other words, you can't activate the shortcut while a menu in your own app is open.  See https://github.com/jamdotdev/KeyboardShortcuts/tree/menu-performance

- **Issue #241** (2026-09-11): **Recorder does not capture shortcuts and clear button does nothing on macOS 26/27**
  *Symptoms*: PRs are restricted to collaborators on this repo, so I'm filing this as an issue. Fixes are pushed to my fork and linked below — happy for them to be cherry-picked, or I can open a PR if you'd rather grant access.  On macOS 26/27 the recorder is unusable: clicking the field focuses it, but pressing a shortcut types a character into the search field instead of recording it. <kbd>⌥</kbd><kbd>⇧</kbd><kbd>P</kbd> inserts `∏`. The clear button does nothing at all.  There are three independent defects that compound — each fix only changes the symptom, which is what made this hard to pin down. All three reproduce in a ~100 line SwiftUI app using nothing but this package, so it isn't app-specific. Verified on both 0.7.1 and 3.0.1.  ---  ### 1. `LocalEventMonitor` holds its monitor token weakly  https://github.com/ppardi/KeyboardShortcuts/commit/c3f86c6  ```swift private weak var monitor: AnyObject? ... monitor = NSEvent.addLocalMonitorForEvents(matching: events, handler: callback) as AnyObject ```  `addLocalMonitorForEvents` returns an autoreleased object the caller must own until it's passed to `removeMonitor`. Held weakly, nothing retains it, so it's deallocated when the autorelease pool drains at the end of the current event-loop turn.  `RecorderCocoa` arms its key monitor inside `becomeFirstResponder`, so the monitor is gone before the user can press anything. The field looks focused and captures nothing.  `stop()` is unreachable for the same reason — it early-returns on a nil `m

- **Issue #240** (2026-06-14): **Release build fails with a compile error**
  *Symptoms*: Hi!  I want to use `Binding<KeyboardShortcuts.Shortcut?>` in my app and tried to build with the latest commit from the main branch, because I don't see there releases with this feature. However, the build failed with `Command SwiftCompile failed with a nonzero exit code`. I checked the latest example app from the repo and I see the same issue.  Here is the environment: macOS 26.4 (25E246) Xcode Version 26.4 (17E192) KeyboardShortcuts - the latest commit at the moment (81caa54)  Here's the log:  ``` Command SwiftCompile failed with a nonzero exit code  ...  Please submit a bug report (https://swift.org/contributing/#reporting-bugs) and include the crash backtrace. Stack dump: 0.	Program arguments: /Applications/Xcode.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/usr/bin/swift-frontend -frontend -c /Users/user/Library/Developer/Xcode/DerivedData/KeyboardShortcutsExample-cnemnmogxgxjfkfooitoqcidwzgd/Build/Intermediates.noindex/ArchiveIntermediates/KeyboardShortcutsExample/IntermediateBuildFilesPath/KeyboardShortcuts.build/Release/KeyboardShortcuts.build/DerivedSources/resource_bundle_accessor.swift /Users/user/Development/workspace_macos/KeyboardShortcuts/Sources/KeyboardShortcuts/ConflictPolicy.swift   ...  1.	Apple Swift version 6.3 (swiftlang-6.3.0.123.5 clang-2100.0.123.102) 2.	Compiling with the current language version 3.	While evaluating request ExecuteSILPipelineRequest(Run pipelines { PrepareOptimizationPasses, EarlyModulePasses, HighLevel,Function+EarlyLoo
  **Post-Mortem & Fix Analysis**:
  > I’m seeing the same crash with Xcode 26.5 / Swift 6.3.2 when archiving an app that depends on `KeyboardShortcuts` from `main` (`81caa54`).  A temporary workaround that fixed the archive for me is disabling Swift optimization only for the `KeyboardShortcuts` target in `Package.swift`: ```swift .target( 	name: "KeyboardShortcuts", 	swiftSettings: [ 		.defaultIsolation(MainActor.self), 		.enableUpcomingFeature("NonisolatedNonsendingByDefault"), 		.enableUpcomingFeature("InferIsolatedConformances"), 		.unsafeFlags(["-Onone"], .when(configuration: .release)) 	] ) ``` 
  > Checking for comments
  > Getting the same issue with 3.0.0 when building an archive (release) in Xcode 26.6 on macOS 26.5.1.  ``` ViewModifiers.o 1.	Apple Swift version 6.3.3 (swiftlang-6.3.3.1.1 clang-2100.1.1.101) 2.	Compiling with the current language version 3.	While evaluating request ExecuteSILPipelineRequest(Run pipelines { PrepareOptimizationPasses, EarlyModulePasses, HighLevel,Function+EarlyLoopOpt, HighLevel,Module+StackPromote, MidLevel,Function, ClosureSpecialize, LowLevel,Function, LateLoopOpt, SIL Debug Info Generator } on SIL for KeyboardShortcuts) 4.	While running pass #232468 SILFunctionTransform "EarlyPerfInliner" on SILFunction "@$s17KeyboardShortcuts17ObjectAssociationCfD".  for 'deinit' (at /Users/user/Library/Developer/Xcode/DerivedData/SomeApp-bouyfouvqujgaigvetufchmmndxs/SourcePackages/checkouts/KeyboardShortcuts/Sources/KeyboardShortcuts/Utilities.swift:499:13) Stack dump without symbol names (ensure you have llvm-symbolizer in your PATH or set the environment var `LLVM_SYMBOLIZER_PATH

- **Issue #239** (2026-04-02): **KeyboardShortcuts.Recorder doesn't record input**
  *Symptoms*: I'm using this library for a while and recently I've noticed that KeyboardShortcuts.Recorder stopped working. The view reacts on focus (it shows an active border when I click there) and clearing (the X button works as well as the backspace). However, it doesn't register any keys.  I tried the latest example app from the repo and I see the same issue.  Here's a warning from the console which appears after you activate the recorder view: `ViewBridge to RemoteViewService Terminated: Error Domain=com.apple.ViewBridge Code=18 "(null)" UserInfo={com.apple.ViewBridge.error.hint=this process disconnected remote view controller -- benign unless unexpected, com.apple.ViewBridge.error.description=NSViewBridgeErrorCanceled} `  macOS 26.4 (25E246) Xcode Version 26.4 (17E192) KeyboardShortcuts 2.3.0/2.4.0/latest  Thanks!
  **Post-Mortem & Fix Analysis**:
  > Looks like I just forgot how to set a shortcut 😂. It works fine, just doesn't register simple values like A, Shift A etc.  It might be helpful to add some visual guidance for this case. For instance, MASShortcut shows pressed modifier keys, so you know that it's getting input.  Sorry for bothering and thank you again.

- **Issue #238** (2026-03-16): **Expose isTakenBySystem and isDisallowed**
  *Symptoms*: Expose Shortcut.isTakenBySystem and Shortcut.isDisallowed to make it easier to implement custom recorder UIs.

- **Issue #237** (2026-06-14): **Feature Request: Expose `Shortcut.isTakenBySystem` and `Shortcut.isDisallowed`**
  *Symptoms*: #### Problem  `KeyboardShortcuts.Recorder` internally prevents users from recording shortcuts that are either:  * **disallowed** (for example `⌘Q`) * **already reserved by the system**  However, when developers implement a **custom recorder UI**, there is currently no public API to perform the same validation.  This makes it difficult to build custom recorders that behave consistently with `KeyboardShortcuts.Recorder`. 
  **Post-Mortem & Fix Analysis**:
  > I have exposed `Shortcut.isTakenBySystem` (will be in the next version), so you can match the system-conflict check in a custom recorder.  I decided not to expose `isDisallowed` though. It is not the general "is this shortcut forbidden" check the name implies. It only guards against a specific bug where Option-only and Option+Shift shortcuts silently do not work in sandboxed apps on macOS 15.0 and 15.1. On macOS 15.2 and later it always returns `false`, so it would be a no-op for nearly everyone, and it is slated for removal once the deployment target moves past 15.1. Exposing a property that does nothing on current systems and is destined to be deleted would just be misleading. 

- **Issue #236** (2026-06-17): **Fix option+letter shortcuts being intercepted by IME layer**
  *Symptoms*: Fixes #235  ## Problem  Shortcuts using `option + letter` (e.g. `option + q`) stop working intermittently. `option + number` works reliably. Re-opening the app's settings window temporarily restores them.  **Root cause:** Carbon's `RegisterEventHotKey` doesn't receive events for `option + letter` combinations because macOS processes them through the Text Services Manager / IME layer first (e.g. `option + q` → `œ`). The Carbon event never fires. This doesn't affect `option + number` because digits don't participate in IME character composition.  The existing `RunLoopLocalEventMonitor` with `.eventTracking` already solves this correctly for the menu-open case, since it intercepts raw key events before IME. This PR extends the same approach to the normal (non-menu) mode.  ## Fix  When at least one registered shortcut uses `option` without `command` or `control` (the only combinations affected by IME), a `NSEvent.addGlobalMonitorForEvents` listener is activated alongside the normal Carbon hotkey handler.  The global monitor handles key matching via the existing `handleRawKeyEvent` path — no new matching logic needed. It is automatically enabled/disabled as shortcuts are registered/unregistered, and torn down entirely when no option-only shortcuts remain.  ## Scope  Only `option`-only shortcuts (no `cmd`/`ctrl`) are affected. Adding `command` or `control` prevents IME interception — those shortcuts continue using Carbon exclusively.
  **Post-Mortem & Fix Analysis**:
  > Thanks for the detailed investigation. However, this is not something I will accept.  `NSEvent.addGlobalMonitorForEvents` for key events requires Accessibility permission, and this package intentionally requires none. Without it the monitor silently does nothing, so for nearly all apps using KeyboardShortcuts this would have no effect — and it would intermittently double-fire whenever Carbon does deliver the event (a global monitor is passive, it can't replace the Carbon handler).  But more importantly, this is an intentional macOS restriction to curb key-logging of password characters (`⇧⌥O` → `Ø`), and there's no permission-free public API to reliably intercept Option + letter before the text input layer. I don't think this package should try to work around that.

- **Issue #235** (2026-06-17): **Option + letter shortcuts stop working intermittently (Carbon RegisterEventHotKey + IME conflict)**
  *Symptoms*: ## Problem  Shortcuts using `option + letter` (e.g. `option + q`) stop working intermittently. `option + number` works reliably. Re-opening the app's settings window temporarily restores them.  This was reported in a downstream app, [FlashSpace](https://github.com/wojciech-kulik/FlashSpace/issues/558), whose author directed me here.  ## Root Cause  I believe this is a fundamental conflict between Carbon's `RegisterEventHotKey` and the macOS Input Method Engine (IME).  On macOS, `option + letter` combos (e.g. `option + q` → `œ`) are processed by the Text Services Manager **before** Carbon hotkey events are dispatched. As a result:  - `option + 1` → no character composition → `kEventHotKeyPressed` fires reliably - `option + q` → triggers IME composition (`œ`) → the event is consumed upstream and **never reaches the Carbon event handler**  This doesn't always happen — it depends on the active application's IME mode, which is why the issue appears intermittently.  ## Why the Settings Window "Fixes" It  Looking at `HotKey.swift`, when a menu is open, `HotKeyCenter` switches from `RegisterEventHotKey` to a `RunLoopLocalEventMonitor` with `.eventTracking` run loop mode (raw `NSEvent` key events), which intercepts events **before** the IME layer. When the window closes, it switches back to `RegisterEventHotKey`, and the issue returns.  ## Connection to `isDisallowed`  I also noticed `Shortcut.swift` has an `isDisallowed` check for `option + letter` on macOS 15.0/15.1 in sandboxed app
  **Post-Mortem & Fix Analysis**:
  > I've also opened a PR with a proposed fix: #236  I'm not a Swift developer — I used Claude (AI) to analyze the code and suggest the fix, so it may not be idiomatic or fully correct. But the approach seems sound: adding an `NSEvent.addGlobalMonitorForEvents` listener specifically for `option`-only shortcuts, which intercepts events before the IME layer. Happy to iterate on it if the direction makes sense.
  > https://github.com/sindresorhus/KeyboardShortcuts/pull/236#issuecomment-4729012703

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

### Incident Patch 1: `309b7d9a` (2026-09-11)
**Commit Message**: Fix laggy menu highlighting while a menu is open

Fixes #242

**File**: `Sources/KeyboardShortcuts/Utilities.swift` (modified, +18/-19)
```diff
@@ -115,32 +115,31 @@ final class RunLoopLocalEventMonitor {
 	) {
 		self.runLoopMode = runLoopMode
 		self.callback = callback
-		let handledEventTypes = events.rawValue
 		var pendingEvents = [NSEvent]()
 
 		self.observer = CFRunLoopObserverCreateWithHandler(nil, CFRunLoopActivity.beforeSources.rawValue, true, 0) { _, _ in
-			// Pull all events from the queue and handle the ones matching the given types.
-			// Non-matching events are left untouched, maintaining their order in the queue.
+			// Peek the head of the queue without dequeuing, and only pull an event when the head is one we handle.
+			// While a menu is tracking, the queue is a flood of mouse-moved events. Asking `nextEvent(matching: keyMask, dequeue: true)` to return the key events forces AppKit to scan and drain that whole flood out of the window-server port on every run-loop iteration, which starves the menu's own event tracking and makes the highlight lag badly. Peeking the head stops the moment a mouse-moved event is in front, so the menu keeps consuming its events undisturbed, while any key event that reaches the head is still handled.
+			// Trade-off: a key event queued behind mouse-moved events is handled on a later pass, once the menu drains the events ahead of it. In practice the pointer is still while a shortcut is pressed, so the flood clears and the key surfaces within a pass or two.
 			pendingEvents.removeAll(keepingCapacity: true)
 
-			// Retrieve all events from the event queue to preserve their order (instead of using the `matching` parameter).
-			while let event = NSApp.nextEvent(matching: .any, until: nil, inMode: runLoopMode, dequeue: true) {
-				pendingEvents.append(event)
-			}
-
-			// Iterate over the gathered events, instead of doing it directly in the `while` loop, to avoid potential infinite loops caused by re-retrieving undiscarded events.
-			for eventToHandle in pendingEvents {
-				let handledEvent = if handledEventTypes & (1 << eventToHandle.type.rawValue) == 0 {
-					eventToHandle
-				} else {
-					callback(eventToHandle)
-				}
-
-				guard let handledEvent else {
-					continue
+			// Collect the leading run of handled events, then re-post the unconsumed ones after the loop. Re-posting inside the loop would send an unconsumed event back to the head and immediately re-peek it, spinning forever.
+			while
+				// Only the peek (`dequeue: false`) is cheap. Guard on the head's type first so we dequeue nothing while a mouse-moved event is in front.
+				let head = NSApp.nextEvent(matching: .any, until: nil, inMode: runLoopMode, dequeue: false),
+				events.contains(NSEvent.EventTypeMask(rawValue: 1 << head.type.rawValue)),
+				// The head matches, so this dequeues that same event.
+				let event = NSApp.nextEvent(matching: events, until: nil, inMode: runLoopMode, dequeue: true)
+			{
+				// The callback returns `nil` when it consumes the event (a matching shortcut), otherwise the event to re-post for normal handling.
+				if let handledEvent = callback(event) {
+					pendingEvents.append(handledEvent)
 				}
+			}
 
-				NSApp.postEvent(handledEvent, atStart: false)
+			// Restore unconsumed events ahead of the untouched queue, preserving their original order.
+			for eventToRepost in pendingEvents.reversed() {
+				NSApp.postEvent(eventToRepost, atStart: true)
 			}
 		}
 	}
```

**File**: `Tests/KeyboardShortcutsTests/KeyboardShortcutsTests.swift` (modified, +79/-0)
```diff
@@ -1644,6 +1644,85 @@ struct KeyboardShortcutsTests {
 		_ = hotKey
 	}
 
+	@Test
+	func `run-loop event monitor preserves unconsumed event order`() throws {
+		// Warm up the event system, as the first `nextEvent` call in a process returns `nil` even when an event is queued.
+		_ = NSApplication.shared.nextEvent(matching: .any, until: nil, inMode: .eventTracking, dequeue: false)
+
+		let firstKeyEvent = try #require(NSEvent.keyEvent(with: .keyDown, location: .zero, modifierFlags: [], timestamp: 0, windowNumber: 0, context: nil, characters: "a", charactersIgnoringModifiers: "a", isARepeat: false, keyCode: UInt16(kVK_ANSI_A)))
+		let secondKeyEvent = try #require(NSEvent.keyEvent(with: .keyDown, location: .zero, modifierFlags: [], timestamp: 0, windowNumber: 0, context: nil, characters: "b", charactersIgnoringModifiers: "b", isARepeat: false, keyCode: UInt16(kVK_ANSI_B)))
+		let mouseEvent = try #require(NSEvent.mouseEvent(with: .mouseMoved, location: .zero, modifierFlags: [], timestamp: 0, windowNumber: 0, context: nil, eventNumber: 0, clickCount: 0, pressure: 0))
+		let keyUpEvent = try #require(NSEvent.keyEvent(with: .keyUp, location: .zero, modifierFlags: [], timestamp: 0, windowNumber: 0, context: nil, characters: "a", charactersIgnoringModifiers: "a", isARepeat: false, keyCode: UInt16(kVK_ANSI_A)))
+		let queuedEvents = [firstKeyEvent, secondKeyEvent, mouseEvent, keyUpEvent]
+		var handledKeyCodes = [UInt16]()
+
+		let monitor = RunLoopLocalEventMonitor(events: [.keyDown, .keyUp], runLoopMode: .eventTracking) { event in
+			handledKeyCodes.append(event.keyCode)
+			return event
+		}
+		monitor.start()
+		defer {
+			monitor.stop()
+		}
+
+		for event in queuedEvents.reversed() {
+			NSApp.postEvent(event, atStart: true)
+		}
+
+		RunLoop.current.run(mode: .eventTracking, before: Date(timeIntervalSinceNow: 0.2))
+		monitor.stop()
+
+		#expect(handledKeyCodes.starts(with: [UInt16(kVK_ANSI_A), UInt16(kVK_ANSI_B)]))
+
+		var remainingEvents = [NSEvent]()
+		for _ in queuedEvents {
+			if let event = NSApp.nextEvent(matching: .any, until: nil, inMode: .eventTracking, dequeue: true) {
+				remainingEvents.append(event)
+			}
+		}
+
+		#expect(remainingEvents.map(\.type) == queuedEvents.map(\.type))
+		#expect(remainingEvents.filter(\.isKeyEvent).map(\.keyCode) == queuedEvents.filter(\.isKeyEvent).map(\.keyCode))
+	}
+
+	@Test
+	func `run-loop event monitor handles matching events and leaves others queued`() throws {
+		// Warm up the event system, as the first `nextEvent` call in a process returns `nil` even when an event is queued.
+		_ = NSApplication.shared.nextEvent(matching: .any, until: nil, inMode: .eventTracking, dequeue: false)
+
+		let keyEvent = try #require(NSEvent.keyEvent(with: .keyDown, location: .zero, modifierFlags: [], timestamp: 0, windowNumber: 0, context: nil, characters: "a", charactersIgnoringModifiers: "a", isARepeat: false, keyCode: UInt16(kVK_ANSI_A)))
+		let mouseEvent = try #require(NSEvent.mouseEvent(with: .mouseMoved, location: .zero, modifierFlags: [], timestamp: 0, windowNumber: 0, context: nil, eventNumber: 0, clickCount: 0, pressure: 0))
+
+		var handledKeyCodes = [UInt16]()
+
+		let monitor = RunLoopLocalEventMonitor(events: [.keyDown], runLoopMode: .eventTracking) { event in
+			handledKeyCodes.append(event.keyCode)
+			// Consume the event.
+			return nil
+		}
+
+		monitor.start()
+		defer {
+			monitor.stop()
+		}
+
+		NSApp.postEvent(mouseEvent, atStart: false)
+		NSApp.postEvent(keyEvent, atStart: false)
+		RunLoop.current.run(mode: .eventTracking, before: Date(timeIntervalSinceNow: 0.2))
+
+		#expect(handledKeyCodes.isEmpty)
+
+		// The non-matching mouse event was left untouched in the queue, so it is never dequeued or re-posted.
+		let remainingEvent = NSApp.nextEvent(matching: .any, until: nil, inMode: .eventTracking, dequeue: true)
+		#expect(remainingEvent?.type == .mouseMoved)
+
+		RunLoop.current.run(mode: .eventTracking, before: Date(timeIntervalSinceNow: 0.2))
+
+		// The matching key event was handled and consumed after the blocking mouse event was removed.
+		#expect(handledKeyCodes == [UInt16(kVK_ANSI_A)])
+		#expect(NSApp.nextEvent(matching: .keyDown, until: nil, inMode: .eventTracking, dequeue: true) == nil)
+	}
+
 	@Test("Repeated raw key down events are ignored")
 	func testRepeatedRawKeyDownEventsAreIgnored() {
 		let shortcut = KeyboardShortcuts.Shortcut(.f17, modifiers: [.command, .option, .shift, .control])
```

---

### Incident Patch 2: `b90d44a5` (2026-09-11)
**Commit Message**: Fix keyboard shortcut recorder ignoring the currently registered shortcut

Temporarily unregister hotkeys while recording so the current shortcut reaches the recorder. Skip menu conflict checks for unchanged shortcuts without tracking menu-item ownership, while retaining system and custom validation.

**File**: `Sources/KeyboardShortcuts/ConflictPolicy.swift` (modified, +2/-0)
```diff
@@ -29,6 +29,8 @@ extension KeyboardShortcuts {
 		/**
 		Behavior when the shortcut is already used by a menu item in the app's main menu.
 
+		Only applies when recording a different shortcut. Re-recording the current shortcut skips menu conflict handling, while system and custom validation still apply.
+
 		Default: `.block`
 		*/
 		public var menuItem: ConflictBehavior
```

**File**: `Sources/KeyboardShortcuts/KeyboardShortcuts.swift` (modified, +14/-3)
```diff
@@ -45,9 +45,19 @@ public enum KeyboardShortcuts {
 	private static var isInitialized = false
 
 	/**
-	When `true`, event handlers will not be called for registered keyboard shortcuts.
+	When `true`, the registered keyboard shortcuts are temporarily unregistered so the key events reach the app instead of being consumed as hot keys.
+
+	This is used while recording so the user can press a shortcut that is already registered, for example, re-recording the current shortcut.
 	*/
-	static var isPaused = false
+	static var isPaused = false {
+		didSet {
+			guard isPaused != oldValue else {
+				return
+			}
+
+			updateHotKeyMode()
+		}
+	}
 
 	/**
 	Enable/disable monitoring of all keyboard shortcuts.
@@ -93,7 +103,8 @@ public enum KeyboardShortcuts {
 	}
 
 	private static func updateHotKeyMode() {
-		HotKeyCenter.shared.setEnabled(isEnabled)
+		// Carbon consumes the key press while its hot key remains registered. Suppressing callbacks alone would leave the recorder unable to receive the shortcut.
+		HotKeyCenter.shared.setEnabled(isEnabled && !isPaused)
 	}
 
 	private static var namesWithKeyHandlers: Set<Name> {
```

**File**: `Sources/KeyboardShortcuts/NSMenuItem++.swift` (modified, +7/-11)
```diff
@@ -21,14 +21,6 @@ extension NSMenuItem {
 	private enum AssociatedKeys {
 		static let observer = ObjectAssociation<NSObjectProtocol>()
 		static let fallback = ObjectAssociation<FallbackShortcut>()
-		static let boundName = ObjectAssociation<KeyboardShortcuts.Name>()
-	}
-
-	/**
-	Returns the shortcut name currently bound with `setShortcut(for:)`.
-	*/
-	var keyboardShortcutsBoundName: KeyboardShortcuts.Name? {
-		AssociatedKeys.boundName[self]
 	}
 
 	private func clearShortcut() {
@@ -53,6 +45,9 @@ extension NSMenuItem {
 		}
 	}
 
+	/**
+	Applies a shortcut without changing the menu item's name binding.
+	*/
 	private func applyShortcut(_ shortcut: KeyboardShortcuts.Shortcut?) {
 		guard let shortcut else {
 			clearShortcut()
@@ -108,7 +103,6 @@ extension NSMenuItem {
 	public func setShortcut(for name: KeyboardShortcuts.Name?) {
 		guard let name else {
 			restoreShortcut()
-			AssociatedKeys.boundName[self] = nil
 			AssociatedKeys.fallback[self] = nil
 			removeShortcutObserver()
 			return
@@ -130,7 +124,6 @@ extension NSMenuItem {
 			restoreShortcut()
 		}
 
-		AssociatedKeys.boundName[self] = name
 		let menuItemReference = WeakMenuItem(self)
 
 		// TODO: Use AsyncStream when targeting macOS 15.
@@ -149,6 +142,7 @@ extension NSMenuItem {
 
 				let shortcut = KeyboardShortcuts.Shortcut(name: name)
 				if let shortcut {
+					// Keep the binding alive across updates. The public setter would detach this observer and discard the original fallback.
 					menuItem.applyShortcut(shortcut)
 				} else {
 					menuItem.restoreShortcut()
@@ -166,12 +160,14 @@ extension NSMenuItem {
 
 	This method overrides `.keyEquivalent` and `.keyEquivalentModifierMask`.
 
+	Any previous shortcut name binding is removed.
+
 	- Important: You will have to disable the global keyboard shortcut while the menu is open, as otherwise, the keyboard events will be buffered up and triggered when the menu closes. This is because `NSMenu` puts the thread in tracking-mode, which prevents the keyboard events from being received. You can listen to whether a menu is open by implementing `NSMenuDelegate#menuWillOpen` and `NSMenuDelegate#menuDidClose`. You then use `KeyboardShortcuts.disable` and `KeyboardShortcuts.enable`.
 	*/
 	@_disfavoredOverload
 	public func setShortcut(_ shortcut: KeyboardShortcuts.Shortcut?) {
+		// Direct assignment ends the old binding, including when clearing the shortcut. A later named binding must capture this new value as its fallback.
 		removeShortcutObserver()
-		AssociatedKeys.boundName[self] = nil
 		AssociatedKeys.fallback[self] = nil
 		applyShortcut(shortcut)
 	}
```

**File**: `Sources/KeyboardShortcuts/RecorderCocoa.swift` (modified, +1/-36)
```diff
@@ -43,9 +43,6 @@ extension KeyboardShortcuts {
 		private var bindingShortcut: Shortcut?
 		private var canBecomeKey = false
 		private var eventMonitor: LocalEventMonitor?
-		// Stores the shortcut active when recording begins, so unchanged values can be compared against
-		// existing menu bindings and avoid self-conflicts for menu items bound to the same shortcut name.
-		private var shortcutBeforeRecording: Shortcut?
 		private var shortcutsNameChangeObserver: NSObjectProtocol?
 		private var windowDidResignKeyObserver: NSObjectProtocol?
 		private var windowDidBecomeKeyObserver: NSObjectProtocol?
@@ -302,7 +299,6 @@ extension KeyboardShortcuts {
 			placeholderString = "record_shortcut".localized
 			showsCancelButton = !stringValue.isEmpty
 			restoreCaret()
-			shortcutBeforeRecording = nil
 
 			guard Self.activeRecorder === self else {
 				return
@@ -414,7 +410,6 @@ extension KeyboardShortcuts {
 			placeholderString = "press_shortcut".localized
 			showsCancelButton = !stringValue.isEmpty
 			hideCaret()
-			shortcutBeforeRecording = currentShortcut
 			Self.activeRecorder = self
 			KeyboardShortcuts.isPaused = true // The position here matters.
 			NotificationCenter.default.post(name: .recorderActiveStatusDidChange, object: nil, userInfo: [NotificationUserInfoKey.isActive: true])
@@ -470,14 +465,7 @@ extension KeyboardShortcuts {
 					return nil
 				}
 
-				let matchingMenuItems = shortcut.takenByMainMenuItems
-				if let menuItem = Self.firstMenuItemRequiringConflictHandling(
-					matchingMenuItems: matchingMenuItems,
-					shortcut: shortcut,
-					shortcutBeforeRecording: shortcutBeforeRecording,
-					shortcutName: shortcutName,
-					usesNamedStorage: storageMode == .name
-				) {
+				if let menuItem = shortcut.menuItemTakenByMainMenu(currentShortcut: currentShortcut) {
 					let title = String.localizedStringWithFormat("keyboard_shortcut_used_by_menu_item".localized, menuItem.title)
 					// TODO: Find a better way to make it possible to dismiss the alert by pressing "Enter". How can we make the input automatically temporarily lose focus while the alert is open?
 					guard handleConflict(conflictPolicy.menuItem, title: title) else {
@@ -520,29 +508,6 @@ extension KeyboardShortcuts {
 			onChange?(shortcut)
 		}
 
-		/**
-		Returns the first conflicting menu item that should trigger conflict handling.
-		*/
-		@MainActor
-		static func firstMenuItemRequiringConflictHandling(
-			matchingMenuItems: [NSMenuItem],
-			shortcut: Shortcut,
-			shortcutBeforeRecording: Shortcut?,
-			shortcutName: Name,
-			usesNamedStorage: Bool
-		) -> NSMenuItem? {
-			matchingMenuItems.first { menuItem in
-				guard
-					usesNamedStorage,
-					shortcut == shortcutBeforeRecording
-				else {
-					return true
-				}
-
-				return menuItem.keyboardShortcutsBoundName != shortcutName
-			}
-		}
-
 		/**
 		Returns `true` if the shortcut should be saved, `false` if it was blocked by the user or policy.
 		*/
```

**File**: `Sources/KeyboardShortcuts/Shortcut.swift` (modified, +14/-29)
```diff
@@ -164,16 +164,6 @@ extension KeyboardShortcuts.Shortcut {
 	*/
 	@MainActor
 	func menuItemWithMatchingShortcut(in menu: NSMenu) -> NSMenuItem? {
-		menuItemsWithMatchingShortcut(in: menu).first
-	}
-
-	/**
-	Recursively finds all menu items in the given menu that have a matching key equivalent and modifier.
-	*/
-	@MainActor
-	func menuItemsWithMatchingShortcut(in menu: NSMenu) -> [NSMenuItem] {
-		var matchingMenuItems: [NSMenuItem] = []
-
 		for item in menu.items {
 			var keyEquivalent = item.keyEquivalent
 			var keyEquivalentModifierMask = item.keyEquivalentModifierMask
@@ -190,42 +180,37 @@ extension KeyboardShortcuts.Shortcut {
 				nsMenuItemKeyEquivalent == keyEquivalent, // Note `nil != ""`
 				modifiers == keyEquivalentModifierMask
 			{
-				matchingMenuItems.append(item)
+				return item
 			}
 
 			if
-				let submenu = item.submenu
+				let submenu = item.submenu,
+				let menuItem = menuItemWithMatchingShortcut(in: submenu)
 			{
-				matchingMenuItems.append(contentsOf: menuItemsWithMatchingShortcut(in: submenu))
+				return menuItem
 			}
 		}
 
-		return matchingMenuItems
+		return nil
 	}
 
 	/**
-	Returns a menu item in the app's main menu that has a matching key equivalent and modifier.
+	Returns a conflicting main-menu item when recording a different shortcut. Re-recording the current shortcut skips menu validation.
 	*/
 	@MainActor
-	var takenByMainMenu: NSMenuItem? {
-		guard let mainMenu = NSApp.mainMenu else {
+	func menuItemTakenByMainMenu(currentShortcut: Self?) -> NSMenuItem? {
+		/*
+		Accepting the unchanged shortcut introduces no new menu conflict. It may preserve an existing conflict with an unrelated item, which is an intentional tradeoff: do not track menu-item ownership just to revalidate an unchanged value. This also handles SwiftUI menu items whose displayed shortcut is stale while recording. System shortcut validation remains the recorder's responsibility, even for unchanged shortcuts.
+		*/
+		guard
+			self != currentShortcut,
+			let mainMenu = NSApp.mainMenu
+		else {
 			return nil
 		}
 
 		return menuItemWithMatchingShortcut(in: mainMenu)
 	}
-
-	/**
-	Returns all menu items in the app's main menu that have a matching key equivalent and modifier.
-	*/
-	@MainActor
-	var takenByMainMenuItems: [NSMenuItem] {
-		guard let mainMenu = NSApp.mainMenu else {
-			return []
-		}
-
-		return menuItemsWithMatchingShortcut(in: mainMenu)
-	}
 }
 
 /*
```

**File**: `Tests/KeyboardShortcutsTests/KeyboardShortcutsTests.swift` (modified, +65/-69)
```diff
@@ -420,6 +420,41 @@ struct KeyboardShortcutsTests {
 		KeyboardShortcuts.removeAllHandlers()
 	}
 
+	@Test
+	func `pausing unregisters hotkeys so the recorder can receive the current shortcut`() {
+		let shortcut = KeyboardShortcuts.Shortcut(.f20, modifiers: [.command, .option, .shift, .control])
+		let name = KeyboardShortcuts.Name("pauseRegistration-\(UUID().uuidString)", initial: shortcut)
+		let wasEnabled = KeyboardShortcuts.isEnabled
+		let wasPaused = KeyboardShortcuts.isPaused
+		defer {
+			KeyboardShortcuts.removeHandler(for: name)
+			KeyboardShortcuts.setShortcut(nil, for: name)
+			KeyboardShortcuts.isEnabled = wasEnabled
+			KeyboardShortcuts.isPaused = wasPaused
+		}
+
+		KeyboardShortcuts.isPaused = false
+		KeyboardShortcuts.isEnabled = true
+		KeyboardShortcuts.onKeyDown(for: name) {}
+		#expect(!Self.canRegisterHotKey(for: shortcut))
+
+		KeyboardShortcuts.isPaused = true
+		#expect(Self.canRegisterHotKey(for: shortcut))
+		#expect(Self.hotKeyCenterIsInDisabledMode())
+
+		KeyboardShortcuts.isEnabled = false
+		KeyboardShortcuts.isEnabled = true
+		#expect(Self.hotKeyCenterIsInDisabledMode())
+
+		KeyboardShortcuts.isEnabled = false
+		KeyboardShortcuts.isPaused = false
+		#expect(Self.hotKeyCenterIsInDisabledMode())
+
+		KeyboardShortcuts.isEnabled = true
+		#expect(!Self.canRegisterHotKey(for: shortcut))
+		#expect(Self.hotKeyCenterIsInNormalMode())
+	}
+
 	@Test("Resume failure drops hotkey registration")
 	func testResumeFailureDropsHotKeyRegistration() async {
 		let shortcut = KeyboardShortcuts.Shortcut(.f14, modifiers: [.command, .option, .shift, .control])
@@ -1695,70 +1730,32 @@ struct KeyboardShortcutsTests {
 		KeyboardShortcuts.removeAllHandlers()
 	}
 
-	@Test("Recorder ignores unchanged conflicts for its own AppKit-bound menu item")
-	@MainActor
-	func testRecorderIgnoresUnchangedConflictsForOwnAppKitBoundMenuItem() {
-		let name = KeyboardShortcuts.Name("recorderOwnAppKitMenuItem")
-		let shortcut = KeyboardShortcuts.Shortcut(.t, modifiers: [.command])
-		KeyboardShortcuts.setShortcut(shortcut, for: name)
-
-		let ownMenuItem = NSMenuItem()
-		ownMenuItem.setShortcut(for: name)
-
-		let conflictingMenuItem = KeyboardShortcuts.RecorderCocoa.firstMenuItemRequiringConflictHandling(
-			matchingMenuItems: [ownMenuItem],
-			shortcut: shortcut,
-			shortcutBeforeRecording: shortcut,
-			shortcutName: name,
-			usesNamedStorage: true
-		)
-
-		#expect(conflictingMenuItem == nil)
-	}
+	@Test(arguments: [false, true])
+	func `recording the current shortcut ignores menu conflicts regardless of ownership`(usesNamedBinding: Bool) {
+		let application = NSApplication.shared
+		let previousMenu = application.mainMenu
+		let name = KeyboardShortcuts.Name("recorderMenuConflict-\(UUID().uuidString)")
+		let shortcut = KeyboardShortcuts.Shortcut(.f19, modifiers: [.command, .option])
+		defer {
+			application.mainMenu = previousMenu
+			KeyboardShortcuts.setShortcut(nil, for: name)
+		}
 
-	@Test("Recorder preserves conflict checks for unchanged shortcuts when another menu item conflicts")
-	@MainActor
-	func testRecorderPreservesConflictChecksForUnchangedShortcutsWithRealMenuConflicts() {
-		let name = KeyboardShortcuts.Name("recorderRealMenuConflict")
-		let shortcut = KeyboardShortcuts.Shortcut(.t, modifiers: [.command])
 		KeyboardShortcuts.setShortcut(shortcut, for: name)
+		let menu = NSMenu()
+		let menuItem = NSMenuItem()
+		if usesNamedBinding {
+			menuItem.setShortcut(for: name)
+		} else {
+			menuItem.setShortcut(shortcut)
+		}
+		menu.addItem(menuItem)
+		application.mainMenu = menu
 
-		let ownMenuItem = NSMenuItem()
-		ownMenuItem.setShortcut(for: name)
-
-		let otherMenuItem = NSMenuItem()
-		otherMenuItem.keyEquivalent = "t"
-		otherMenuItem.keyEquivalentModifierMask = [.command]
-
-		let conflictingMenuItem = KeyboardShortcuts.RecorderCocoa.firstMenuItemRequiringConflictHandling(
-			matchingMenuItems: [ownMenuItem, otherMenuItem],
-			shortcut: shortcut,
-			shortcutBeforeRecording: shortcut,
-			shortcutName: name,
-			usesNamedStorage: true
-		)
-
-		#expect(conflictingMenuItem === otherMenuItem)
-	}
-
-	@Test("Recorder preserves conflict checks in binding mode for unchanged shortcuts")
-	@MainActor
-	func testRecorderPreservesConflictChecksInBindingModeForUnchangedShortcuts() {
-		let name = KeyboardShortcuts.Name("recorderBindingModeConflict")
-		let shortcut = KeyboardShortcuts.Shortcut(.t, modifiers: [.command])
-
-		let ownMenuItem = NSMenuItem()
-		ownMenuItem.setShortcut(for: name)
-
-		let conflictingMenuItem = KeyboardShortcuts.RecorderCocoa.firstMenuItemRequiringConflictHandling(
-			matchingMenuItems: [ownMenuItem],
-			shortcut: shortcut,
-			shortcutBeforeRecording: shortcut,
-			shortcutName: name,
-			usesNamedStorage: false
-		)
-
-		#expect(conflictingMenuItem === ownMenuItem)
+		#expect(shortcut.menuItemWithMatchingShortcut(in: menu) === menuItem)
+		#expect(shortcut.menuItemTakenByMainMenu(currentShortcut: shortcut) == nil)
+		#expect(shortcut.menuI
```

---

### Incident Patch 3: `9b0f41c9` (2026-06-17)
**Commit Message**: Fix function-key shortcuts not firing while a menu is open

While a menu is open, hot keys are paused and shortcuts are matched against live key events instead. Two things broke that path for function keys.

Live events for F-keys and navigation keys carry the Fn modifier, but recorded shortcuts never do, so normalize it away on both sides before matching.

Menu tracking also consumes some keys before AppKit dispatches them, while function keys such as F2 instead arrive through `NSApplication.sendEvent(_:)`. Neither monitor sees both, so run the run-loop and AppKit monitors together.

**File**: `Sources/KeyboardShortcuts/HotKey.swift` (modified, +18/-12)
```diff
@@ -115,9 +115,17 @@ final class HotKeyCenter {
 		EventTypeSpec(eventClass: OSType(kEventClassKeyboard), eventKind: UInt32(kEventRawKeyUp))
 	]
 
-	private lazy var keyEventMonitor = RunLoopLocalEventMonitor(events: [.keyDown, .keyUp], runLoopMode: .eventTracking) { [weak self] event in
+	private lazy var runLoopKeyEventMonitor = RunLoopLocalEventMonitor(events: [.keyDown, .keyUp], runLoopMode: .eventTracking) { [weak self] event in
+		self?.handleKeyEvent(event) ?? event
+	}
+
+	// The run-loop and AppKit monitors are complementary: menu tracking consumes some keys before AppKit dispatches them, while function keys such as F2 can instead arrive through `NSApplication.sendEvent(_:)`.
+	private lazy var appKitKeyEventMonitor = LocalEventMonitor(events: [.keyDown, .keyUp]) { [weak self] event in
+		self?.handleKeyEvent(event) ?? event
+	}
+
+	private func handleKeyEvent(_ event: NSEvent) -> NSEvent? {
 		guard
-			let self,
 			handleRawKeyEvent(
 				keyCode: Int(event.keyCode),
 				modifiers: event.modifiers.carbon,
@@ -319,7 +327,7 @@ final class HotKeyCenter {
 		}
 
 		eventHandler = handler
-		updateEventHandler()
+		// Do not update state here: this setup runs only once, while `register(_:)` must apply the current state after every hot key is added.
 	}
 
 	private func updateEventHandler() {
@@ -363,9 +371,11 @@ final class HotKeyCenter {
 
 		if #available(macOS 14, *) {
 			if isEnabled {
-				keyEventMonitor.start()
+				runLoopKeyEventMonitor.start()
+				appKitKeyEventMonitor.start()
 			} else {
-				keyEventMonitor.stop()
+				runLoopKeyEventMonitor.stop()
+				appKitKeyEventMonitor.stop()
 			}
 		} else if isEnabled {
 			AddEventTypesToHandler(eventHandler, rawKeyEventTypes.count, rawKeyEventTypes)
@@ -475,10 +485,11 @@ final class HotKeyCenter {
 			return OSStatus(eventNotHandledErr)
 		}
 
-		let normalizedEventModifiers = normalizeModifiers(modifiers)
+		// Raw events carry a synthesized Fn bit for function and navigation keys. Normalize both sides because callers can register a shortcut through the generic Carbon initializer.
+		let eventShortcut = KeyboardShortcuts.Shortcut(carbonKeyCode: keyCode, carbonModifiers: modifiers).removingSynthesizedFunctionModifier
 
 		guard let hotKey = hotKeys.values.lazy.compactMap(\.value).first(where: {
-			$0.carbonKeyCode == keyCode && normalizeModifiers($0.carbonModifiers) == normalizedEventModifiers
+			KeyboardShortcuts.Shortcut(carbonKeyCode: $0.carbonKeyCode, carbonModifiers: $0.carbonModifiers).removingSynthesizedFunctionModifier == eventShortcut
 		}) else {
 			return OSStatus(eventNotHandledErr)
 		}
@@ -494,11 +505,6 @@ final class HotKeyCenter {
 			return OSStatus(eventNotHandledErr)
 		}
 	}
-
-	private func normalizeModifiers(_ carbonModifiers: Int) -> Int {
-		// Carbon modifiers can be stored in multiple equivalent forms; normalize so raw events match registered shortcuts.
-		NSEvent.ModifierFlags(carbon: carbonModifiers).carbon
-	}
 }
 
 // Global C callback for Carbon event handler
```

**File**: `Sources/KeyboardShortcuts/Key.swift` (modified, +24/-1)
```diff
@@ -165,7 +165,7 @@ extension KeyboardShortcuts.Key {
 	/**
 	All the function keys.
 	*/
-	static let functionKeys: Set<Self> = [
+	nonisolated static let functionKeys: Set<Self> = [
 		.f1,
 		.f2,
 		.f3,
@@ -188,9 +188,32 @@ extension KeyboardShortcuts.Key {
 		.f20
 	]
 
+	/**
+	Keys whose system event representations intrinsically include the Fn modifier, even when Fn was not pressed.
+	*/
+	nonisolated static let keysWithSynthesizedFunctionModifier = functionKeys.union([
+		.help,
+		.deleteForward,
+		// AppKit synthesizes Fn for keypad Clear, while keypad Enter carries only the numeric-pad modifier.
+		.keypadClear,
+		.home,
+		.end,
+		.pageUp,
+		.pageDown,
+		.upArrow,
+		.rightArrow,
+		.downArrow,
+		.leftArrow
+	])
+
 	/**
 	Returns true if the key is a function key. For example, `F1`.
 	*/
 	var isFunctionKey: Bool { Self.functionKeys.contains(self) }
+
+	/**
+	Returns true if the key's system event representations intrinsically include the Fn modifier.
+	*/
+	nonisolated var hasSynthesizedFunctionModifier: Bool { Self.keysWithSynthesizedFunctionModifier.contains(self) }
 }
 #endif
```

**File**: `Sources/KeyboardShortcuts/Shortcut.swift` (modified, +19/-5)
```diff
@@ -9,9 +9,7 @@ extension KeyboardShortcuts {
 	*/
 	nonisolated public struct Shortcut: Hashable, Codable, Sendable {
 		/**
-		Carbon modifiers are not always stored as the same number.
-
-		For example, the system has `⌃F2` stored with the modifiers number `135168`, but if you press the keyboard shortcut, you get `4096`.
+		Converts Carbon modifier flags through AppKit to remove unsupported and noncanonical bits.
 		*/
 		private static func normalizeModifiers(_ carbonModifiers: Int) -> Int {
 			NSEvent.ModifierFlags(carbon: carbonModifiers).carbon
@@ -59,9 +57,11 @@ extension KeyboardShortcuts {
 				return nil
 			}
 
+			/*
+			Recorders intentionally do not support Fn shortcuts, even when Fn is combined with another modifier. Keep stripping it here rather than removing only synthesized Fn, or inputs such as Fn+Command+Z would unexpectedly store Fn. Generic and imported system shortcuts preserve semantic Fn separately for conflict detection.
+			*/
 			self.init(
 				carbonKeyCode: Int(event.keyCode),
-				// Note: We could potentially support users specifying shortcuts with the Fn key, but I haven't found a reliable way to differentate when to display the Fn key and not. For example, with Fn+F1 we only want to display F1, but with Fn+V, we want to display both. I cannot just specialize it for F keys as it applies to other keys too, like Fn+arrowup.
 				carbonModifiers: event.modifierFlags.subtracting(.function).carbon
 			)
 		}
@@ -100,8 +100,22 @@ extension KeyboardShortcuts.Shortcut {
 	*/
 	static var system: [Self] {
 		HotKeyCenter.systemShortcuts.map {
-			Self(carbonKeyCode: $0.carbonKeyCode, carbonModifiers: $0.carbonModifiers)
+			// Symbolic hotkeys use the same synthesized Fn bit as key events.
+			Self(carbonKeyCode: $0.carbonKeyCode, carbonModifiers: $0.carbonModifiers).removingSynthesizedFunctionModifier
+		}
+	}
+
+	/**
+	Returns the shortcut after removing the Fn modifier synthesized by function and navigation keys.
+
+	Use only at boundaries where the system may synthesize Fn, such as raw-event matching and symbolic-hotkey import. Generic shortcuts preserve semantic Fn on ordinary keys.
+	*/
+	nonisolated var removingSynthesizedFunctionModifier: Self {
+		guard key?.hasSynthesizedFunctionModifier == true else {
+			return self
 		}
+
+		return Self(carbonKeyCode: carbonKeyCode, carbonModifiers: modifiers.subtracting(.function).carbon)
 	}
 
 	// TODO: Remove this when targeting macOS 15.2. It only handles a bug present in sandboxed apps on macOS 15.0 and 15.1.
```

**File**: `Sources/KeyboardShortcuts/Utilities.swift` (modified, +4/-0)
```diff
@@ -82,6 +82,10 @@ final class LocalEventMonitor {
 
 	@discardableResult
 	func start() -> Self {
+		guard monitor == nil else {
+			return self
+		}
+
 		monitor = NSEvent.addLocalMonitorForEvents(matching: events, handler: callback) as AnyObject
 		return self
 	}
```

**File**: `Tests/KeyboardShortcutsTests/KeyboardShortcutsTests.swift` (modified, +175/-0)
```diff
@@ -324,6 +324,20 @@ struct KeyboardShortcutsTests {
 		#expect(KeyboardShortcuts.getShortcut(for: name3) == nil)
 	}
 
+	@Test("Name equality and hashing are based only on rawValue")
+	func testNameEqualityIgnoresInitialShortcut() {
+		let withInitial = KeyboardShortcuts.Name("sameRawValue", initial: .init(.a))
+		let withoutInitial = KeyboardShortcuts.Name("sameRawValue")
+
+		// Identity is the rawValue (the `UserDefaults` storage key), so the initial shortcut must not affect equality or hashing.
+		#expect(withInitial == withoutInitial)
+		#expect(withInitial.hashValue == withoutInitial.hashValue)
+
+		// `storedNames` carries only the rawValue, but must still match a name created with an initial shortcut.
+		KeyboardShortcuts.setShortcut(.init(.b), for: withInitial)
+		#expect(KeyboardShortcuts.storedNames.contains(withInitial))
+	}
+
 	@Test("Reset all clears defaults")
 	func testResetAllClearsDefaults() {
 		let nameWithDefault = KeyboardShortcuts.Name("resetAllDefault", initial: .init(.a))
@@ -1434,6 +1448,167 @@ struct KeyboardShortcutsTests {
 		})
 	}
 
+	@Test("Function-key shortcuts match raw key events that carry the Fn modifier", arguments: [false, true])
+	func testFunctionKeyRawEventMatchingIncludesFnModifier(registeredWithFunctionModifier: Bool) {
+		var registeredModifiers: NSEvent.ModifierFlags = [.command, .option, .shift, .control]
+		if registeredWithFunctionModifier {
+			registeredModifiers.insert(.function)
+		}
+
+		let shortcut = KeyboardShortcuts.Shortcut(.f17, modifiers: registeredModifiers)
+		var keyDownCount = 0
+
+		let hotKey = HotKey(
+			carbonKeyCode: shortcut.carbonKeyCode,
+			carbonModifiers: shortcut.carbonModifiers,
+			onKeyDown: {
+				keyDownCount += 1
+			},
+			onKeyUp: {}
+		)
+
+		#expect(hotKey != nil)
+
+		let liveModifiers = shortcut.carbonModifiers | NSEvent.ModifierFlags.function.carbon
+
+		let status = HotKeyCenter.shared.handleRawKeyEvent(
+			keyCode: shortcut.carbonKeyCode,
+			modifiers: liveModifiers,
+			isRepeat: false,
+			eventKind: kEventRawKeyDown
+		)
+
+		#expect(status == noErr)
+		#expect(keyDownCount == 1)
+
+		_ = hotKey
+	}
+
+	@Test
+	func `keypad Clear shortcuts match raw events with synthesized Fn`() {
+		let shortcut = KeyboardShortcuts.Shortcut(.keypadClear, modifiers: .control)
+		var keyDownCount = 0
+
+		let hotKey = HotKey(
+			carbonKeyCode: shortcut.carbonKeyCode,
+			carbonModifiers: shortcut.carbonModifiers,
+			onKeyDown: {
+				keyDownCount += 1
+			},
+			onKeyUp: {}
+		)
+
+		#expect(hotKey != nil)
+
+		let status = HotKeyCenter.shared.handleRawKeyEvent(
+			keyCode: shortcut.carbonKeyCode,
+			modifiers: shortcut.carbonModifiers | NSEvent.ModifierFlags.function.carbon,
+			isRepeat: false,
+			eventKind: kEventRawKeyDown
+		)
+
+		#expect(status == noErr)
+		#expect(keyDownCount == 1)
+
+		_ = hotKey
+	}
+
+	@Test
+	func `raw event matching preserves explicit Fn for keypad Enter`() {
+		let shortcut = KeyboardShortcuts.Shortcut(.keypadEnter, modifiers: [.function, .control])
+		var keyDownCount = 0
+
+		let hotKey = HotKey(
+			carbonKeyCode: shortcut.carbonKeyCode,
+			carbonModifiers: shortcut.carbonModifiers,
+			onKeyDown: {
+				keyDownCount += 1
+			},
+			onKeyUp: {}
+		)
+
+		#expect(hotKey != nil)
+
+		let statusWithoutFunctionModifier = HotKeyCenter.shared.handleRawKeyEvent(keyCode: shortcut.carbonKeyCode, modifiers: controlKey, isRepeat: false, eventKind: kEventRawKeyDown)
+		let statusWithFunctionModifier = HotKeyCenter.shared.handleRawKeyEvent(keyCode: shortcut.carbonKeyCode, modifiers: shortcut.carbonModifiers, isRepeat: false, eventKind: kEventRawKeyDown)
+
+		#expect(statusWithoutFunctionModifier == OSStatus(eventNotHandledErr))
+		#expect(statusWithFunctionModifier == noErr)
+		#expect(keyDownCount == 1)
+
+		_ = hotKey
+	}
+
+	@Test
+	func `generic shortcuts preserve the Fn modifier`() {
+		let functionModifier = NSEvent.ModifierFlags.function.carbon
+		let shortcut = KeyboardShortcuts.Shortcut(carbonKeyCode: kVK_ANSI_C, carbonModifiers: functionModifier | controlKey)
+
+		#expect(shortcut == KeyboardShortcuts.Shortcut(.c, modifiers: [.function, .control]))
+		#expect(shortcut != KeyboardShortcuts.Shortcut(.c, modifiers: .control))
+	}
+
+	@Test
+	func `event shortcuts strip Fn modifiers`() throws {
+		let functionKeyEvent = try #require(NSEvent.keyEvent(with: .keyDown, location: .zero, modifierFlags: [.function, .control], timestamp: 0, windowNumber: 0, context: nil, characters: "", charactersIgnoringModifiers: "", isARepeat: false, keyCode: UInt16(kVK_F12)))
+		let ordinaryKeyEvent = try #require(NSEvent.keyEvent(with: .keyDown, location: .zero, modifierFlags: [.function, .control], timestamp: 0, windowNumber: 0, context: nil, characters: "c", charactersIgnoringModifiers: "c", isARepeat: false, keyCode: UInt16(kVK_ANSI_C)))
+
+		#expect(KeyboardShortcuts.Shortcut(event: functionKeyEvent) == KeyboardShortcuts.Shortcut(.f12, modifiers: .control))
+		#expect(KeyboardShortcuts.Shortcut(event: ordina
```

---

### Incident Patch 4: `c7872947` (2026-06-17)
**Commit Message**: Fix release build crash with Swift 6.3 compiler

Fixes #240

**File**: `Sources/KeyboardShortcuts/Utilities.swift` (modified, +13/-4)
```diff
@@ -496,7 +496,16 @@ enum AssociationPolicy {
 	}
 }
 
-final class ObjectAssociation<T> {
+// Workaround for a Swift compiler crash where the optimizer (`EarlyPerfInliner`) crashes on the
+// isolated `deinit` of a generic `@MainActor` class when the deployment target is below the
+// isolated-deinit availability floor. Making `ObjectAssociation` a struct (no deinit) and using a
+// concrete non-generic class for the association key avoids the bug.
+// https://github.com/sindresorhus/KeyboardShortcuts/issues/240
+// https://github.com/swiftlang/swift/issues/89896
+private final class ObjectAssociationKey {}
+
+struct ObjectAssociation<T> {
+	private let key = ObjectAssociationKey()
 	private let policy: AssociationPolicy
 
 	init(policy: AssociationPolicy = .retainNonatomic) {
@@ -507,10 +516,10 @@ final class ObjectAssociation<T> {
 		get {
 			// Force-cast is fine here as we want it to fail loudly if we don't use the correct type.
 			// swiftlint:disable:next force_cast
-			objc_getAssociatedObject(index, Unmanaged.passUnretained(self).toOpaque()) as! T?
+			objc_getAssociatedObject(index, Unmanaged.passUnretained(key).toOpaque()) as! T?
 		}
-		set {
-			objc_setAssociatedObject(index, Unmanaged.passUnretained(self).toOpaque(), newValue, policy.rawValue)
+		nonmutating set {
+			objc_setAssociatedObject(index, Unmanaged.passUnretained(key).toOpaque(), newValue, policy.rawValue)
 		}
 	}
 }
```

---

### Incident Patch 5: `b580a192` (2026-04-08)
**Commit Message**: Fix release build crash with Swift 6.3 compiler

Fixes #240

**File**: `Sources/KeyboardShortcuts/NSMenuItem++.swift` (modified, +11/-8)
```diff
@@ -1,15 +1,18 @@
 #if os(macOS)
 import AppKit
 
-extension NSMenuItem {
-	private final class WeakReference<T: AnyObject>: @unchecked Sendable {
-		weak var value: T?
-
-		init(_ value: T) {
-			self.value = value
-		}
+// Workaround for a Swift 6.3 compiler crash (SR/rdar) where the optimizer crashes on deinit of a
+// generic class nested inside an extension. Using a concrete non-generic class avoids the bug.
+// https://github.com/sindresorhus/KeyboardShortcuts/issues/240
+private final class WeakMenuItem: @unchecked Sendable {
+	weak var value: NSMenuItem?
+
+	init(_ value: NSMenuItem) {
+		self.value = value
 	}
+}
 
+extension NSMenuItem {
 	private struct FallbackShortcut: Sendable {
 		let keyEquivalent: String
 		let modifierMask: NSEvent.ModifierFlags
@@ -128,7 +131,7 @@ extension NSMenuItem {
 		}
 
 		AssociatedKeys.boundName[self] = name
-		let menuItemReference = WeakReference(self)
+		let menuItemReference = WeakMenuItem(self)
 
 		// TODO: Use AsyncStream when targeting macOS 15.
 		AssociatedKeys.observer[self] = NotificationCenter.default.addObserver(forName: .shortcutByNameDidChange, object: nil, queue: .main) { notification in
```

---

### Incident Patch 6: `856e3cf4` (2026-02-26)
**Commit Message**: Fix false menu item conflict when reassigning an existing shortcut

When using `globalKeyboardShortcut()`, macOS 15 has a bug where `.keyboardShortcut(nil)` (applied while the recorder is active) does not propagate to the underlying NSMenuItem. This causes `takenByMainMenu` to fire falsely when the user re-presses their already-assigned shortcut.

Fix: save the current shortcut before recording starts, then skip the menu item conflict check if the pressed shortcut equals the pre-recording value.

Improve shortcutBeforeRecording: add comment and reset in endRecording

Add an inline comment explaining why the property exists (macOS 15 NSMenuItem stale state bug), and reset it to nil in endRecording to make the property lifecycle explicit.

**File**: `Example/KeyboardShortcutsExample/App.swift` (modified, +50/-10)
```diff
@@ -16,19 +16,23 @@ struct AppMain: App {
 				Button("Shortcut 1") {
 					AppState.shared.alert(1)
 				}
-				.keyboardShortcut(menuShortcuts.shortcut1?.toSwiftUI)
+				.keyboardShortcut(menuShortcuts.shortcut1ForMenu?.toSwiftUI)
+				.id(menuShortcuts.refreshID)
 				Button("Shortcut 2") {
 					AppState.shared.alert(2)
 				}
-				.keyboardShortcut(menuShortcuts.shortcut2?.toSwiftUI)
+				.keyboardShortcut(menuShortcuts.shortcut2ForMenu?.toSwiftUI)
+				.id(menuShortcuts.refreshID)
 				Button("Shortcut 3") {
 					AppState.shared.alert(3)
 				}
-				.keyboardShortcut(menuShortcuts.shortcut3?.toSwiftUI)
+				.keyboardShortcut(menuShortcuts.shortcut3ForMenu?.toSwiftUI)
+				.id(menuShortcuts.refreshID)
 				Button("Shortcut 4") {
 					AppState.shared.alert(4)
 				}
-				.keyboardShortcut(menuShortcuts.shortcut4?.toSwiftUI)
+				.keyboardShortcut(menuShortcuts.shortcut4ForMenu?.toSwiftUI)
+				.id(menuShortcuts.refreshID)
 			}
 		}
 	}
@@ -41,11 +45,30 @@ final class TestMenuShortcuts {
 	var shortcut2 = KeyboardShortcuts.getShortcut(for: .testShortcut2)
 	var shortcut3 = KeyboardShortcuts.getShortcut(for: .testShortcut3)
 	var shortcut4 = KeyboardShortcuts.getShortcut(for: .testShortcut4)
+	var isRecorderActive = false
+	var refreshID = 0
 
-	private var observer: NSObjectProtocol?
+	var shortcut1ForMenu: KeyboardShortcuts.Shortcut? {
+		isRecorderActive ? nil : shortcut1
+	}
+
+	var shortcut2ForMenu: KeyboardShortcuts.Shortcut? {
+		isRecorderActive ? nil : shortcut2
+	}
+
+	var shortcut3ForMenu: KeyboardShortcuts.Shortcut? {
+		isRecorderActive ? nil : shortcut3
+	}
+
+	var shortcut4ForMenu: KeyboardShortcuts.Shortcut? {
+		isRecorderActive ? nil : shortcut4
+	}
+
+	private var shortcutObserver: NSObjectProtocol?
+	private var recorderActiveObserver: NSObjectProtocol?
 
 	init() {
-		observer = NotificationCenter.default.addObserver(forName: Notification.Name("KeyboardShortcuts_shortcutByNameDidChange"), object: nil, queue: .main) { [weak self] notification in
+		shortcutObserver = NotificationCenter.default.addObserver(forName: Notification.Name("KeyboardShortcuts_shortcutByNameDidChange"), object: nil, queue: .main) { [weak self] notification in
 			guard let self else {
 				return
 			}
@@ -67,17 +90,34 @@ final class TestMenuShortcuts {
 				case .testShortcut4:
 					shortcut4 = KeyboardShortcuts.getShortcut(for: .testShortcut4)
 				default:
-					break
+					return
 				}
+
+				refreshID += 1
+			}
+		}
+
+		recorderActiveObserver = NotificationCenter.default.addObserver(forName: Notification.Name("KeyboardShortcuts_recorderActiveStatusDidChange"), object: nil, queue: .main) { [weak self] notification in
+			guard let self else {
+				return
+			}
+
+			let isActive = (notification.userInfo?["isActive"] as? Bool) ?? false
+
+			Task { @MainActor in
+				isRecorderActive = isActive
+				refreshID += 1
 			}
 		}
 	}
 
 	isolated deinit {
-		guard let observer else {
-			return
+		if let shortcutObserver {
+			NotificationCenter.default.removeObserver(shortcutObserver)
 		}
 
-		NotificationCenter.default.removeObserver(observer)
+		if let recorderActiveObserver {
+			NotificationCenter.default.removeObserver(recorderActiveObserver)
+		}
 	}
 }
```

**File**: `Sources/KeyboardShortcuts/NSMenuItem++.swift` (modified, +41/-18)
```diff
@@ -18,6 +18,14 @@ extension NSMenuItem {
 	private enum AssociatedKeys {
 		static let observer = ObjectAssociation<NSObjectProtocol>()
 		static let fallback = ObjectAssociation<FallbackShortcut>()
+		static let boundName = ObjectAssociation<KeyboardShortcuts.Name>()
+	}
+
+	/**
+	Returns the shortcut name currently bound with `setShortcut(for:)`.
+	*/
+	var keyboardShortcutsBoundName: KeyboardShortcuts.Name? {
+		AssociatedKeys.boundName[self]
 	}
 
 	private func clearShortcut() {
@@ -42,6 +50,29 @@ extension NSMenuItem {
 		}
 	}
 
+	private func applyShortcut(_ shortcut: KeyboardShortcuts.Shortcut?) {
+		guard let shortcut else {
+			clearShortcut()
+			return
+		}
+
+		keyEquivalent = shortcut.nsMenuItemKeyEquivalent ?? ""
+		keyEquivalentModifierMask = shortcut.modifiers
+
+		if #available(macOS 12, *) {
+			allowsAutomaticKeyEquivalentLocalization = false
+		}
+	}
+
+	private func removeShortcutObserver() {
+		guard let existingObserver = AssociatedKeys.observer[self] else {
+			return
+		}
+
+		NotificationCenter.default.removeObserver(existingObserver)
+		AssociatedKeys.observer[self] = nil
+	}
+
 	// TODO: Make this a getter/setter. We must first add the ability to create a `Shortcut` from a `keyEquivalent`.
 	/**
 	Show a recorded keyboard shortcut in a `NSMenuItem`.
@@ -74,15 +105,14 @@ extension NSMenuItem {
 	public func setShortcut(for name: KeyboardShortcuts.Name?) {
 		guard let name else {
 			restoreShortcut()
+			AssociatedKeys.boundName[self] = nil
 			AssociatedKeys.fallback[self] = nil
-			NotificationCenter.default.removeObserver(AssociatedKeys.observer[self] as Any)
-			AssociatedKeys.observer[self] = nil
+			removeShortcutObserver()
 			return
 		}
 
-		if let existingObserver = AssociatedKeys.observer[self] {
-			NotificationCenter.default.removeObserver(existingObserver)
-			AssociatedKeys.observer[self] = nil
+		if AssociatedKeys.observer[self] != nil {
+			removeShortcutObserver()
 		} else {
 			AssociatedKeys.fallback[self] = FallbackShortcut(
 				keyEquivalent: keyEquivalent,
@@ -92,11 +122,12 @@ extension NSMenuItem {
 
 		let shortcut = KeyboardShortcuts.Shortcut(name: name)
 		if let shortcut {
-			setShortcut(shortcut)
+			applyShortcut(shortcut)
 		} else {
 			restoreShortcut()
 		}
 
+		AssociatedKeys.boundName[self] = name
 		let menuItemReference = WeakReference(self)
 
 		// TODO: Use AsyncStream when targeting macOS 15.
@@ -115,7 +146,7 @@ extension NSMenuItem {
 
 				let shortcut = KeyboardShortcuts.Shortcut(name: name)
 				if let shortcut {
-					menuItem.setShortcut(shortcut)
+					menuItem.applyShortcut(shortcut)
 				} else {
 					menuItem.restoreShortcut()
 				}
@@ -136,17 +167,9 @@ extension NSMenuItem {
 	*/
 	@_disfavoredOverload
 	public func setShortcut(_ shortcut: KeyboardShortcuts.Shortcut?) {
-		guard let shortcut else {
-			clearShortcut()
-			return
-		}
-
-		keyEquivalent = shortcut.nsMenuItemKeyEquivalent ?? ""
-		keyEquivalentModifierMask = shortcut.modifiers
-
-		if #available(macOS 12, *) {
-			allowsAutomaticKeyEquivalentLocalization = false
-		}
+		removeShortcutObserver()
+		AssociatedKeys.boundName[self] = nil
+		applyShortcut(shortcut)
 	}
 }
 #endif
```

**File**: `Sources/KeyboardShortcuts/RecorderCocoa.swift` (modified, +36/-1)
```diff
@@ -40,6 +40,9 @@ extension KeyboardShortcuts {
 		private var bindingShortcut: Shortcut?
 		private var canBecomeKey = false
 		private var eventMonitor: LocalEventMonitor?
+		// Stores the shortcut active when recording begins, so unchanged values can be compared against
+		// existing menu bindings and avoid self-conflicts for menu items bound to the same shortcut name.
+		private var shortcutBeforeRecording: Shortcut?
 		private var shortcutsNameChangeObserver: NSObjectProtocol?
 		private var windowDidResignKeyObserver: NSObjectProtocol?
 		private var windowDidBecomeKeyObserver: NSObjectProtocol?
@@ -265,6 +268,7 @@ extension KeyboardShortcuts {
 			placeholderString = "record_shortcut".localized
 			showsCancelButton = !stringValue.isEmpty
 			restoreCaret()
+			shortcutBeforeRecording = nil
 			KeyboardShortcuts.isPaused = false
 			NotificationCenter.default.post(name: .recorderActiveStatusDidChange, object: nil, userInfo: [NotificationUserInfoKey.isActive: false])
 		}
@@ -352,6 +356,7 @@ extension KeyboardShortcuts {
 			placeholderString = "press_shortcut".localized
 			showsCancelButton = !stringValue.isEmpty
 			hideCaret()
+			shortcutBeforeRecording = currentShortcut
 			KeyboardShortcuts.isPaused = true // The position here matters.
 			NotificationCenter.default.post(name: .recorderActiveStatusDidChange, object: nil, userInfo: [NotificationUserInfoKey.isActive: true])
 
@@ -405,7 +410,14 @@ extension KeyboardShortcuts {
 					return nil
 				}
 
-				if let menuItem = shortcut.takenByMainMenu {
+				let matchingMenuItems = shortcut.takenByMainMenuItems
+				if let menuItem = Self.firstMenuItemRequiringConflictHandling(
+					matchingMenuItems: matchingMenuItems,
+					shortcut: shortcut,
+					shortcutBeforeRecording: shortcutBeforeRecording,
+					shortcutName: shortcutName,
+					usesNamedStorage: storageMode == .name
+				) {
 					let title = String.localizedStringWithFormat("keyboard_shortcut_used_by_menu_item".localized, menuItem.title)
 					// TODO: Find a better way to make it possible to dismiss the alert by pressing "Enter". How can we make the input automatically temporarily lose focus while the alert is open?
 					guard handleConflict(conflictPolicy.menuItem, title: title) else {
@@ -448,6 +460,29 @@ extension KeyboardShortcuts {
 			onChange?(shortcut)
 		}
 
+		/**
+		Returns the first conflicting menu item that should trigger conflict handling.
+		*/
+		@MainActor
+		static func firstMenuItemRequiringConflictHandling(
+			matchingMenuItems: [NSMenuItem],
+			shortcut: Shortcut,
+			shortcutBeforeRecording: Shortcut?,
+			shortcutName: Name,
+			usesNamedStorage: Bool
+		) -> NSMenuItem? {
+			matchingMenuItems.first { menuItem in
+				guard
+					usesNamedStorage,
+					shortcut == shortcutBeforeRecording
+				else {
+					return true
+				}
+
+				return menuItem.keyboardShortcutsBoundName != shortcutName
+			}
+		}
+
 		/**
 		Returns `true` if the shortcut should be saved, `false` if it was blocked by the user or policy.
 		*/
```

**File**: `Sources/KeyboardShortcuts/Shortcut.swift` (modified, +27/-6)
```diff
@@ -145,6 +145,16 @@ extension KeyboardShortcuts.Shortcut {
 	*/
 	@MainActor
 	func menuItemWithMatchingShortcut(in menu: NSMenu) -> NSMenuItem? {
+		menuItemsWithMatchingShortcut(in: menu).first
+	}
+
+	/**
+	Recursively finds all menu items in the given menu that have a matching key equivalent and modifier.
+	*/
+	@MainActor
+	func menuItemsWithMatchingShortcut(in menu: NSMenu) -> [NSMenuItem] {
+		var matchingMenuItems: [NSMenuItem] = []
+
 		for item in menu.items {
 			var keyEquivalent = item.keyEquivalent
 			var keyEquivalentModifierMask = item.keyEquivalentModifierMask
@@ -161,18 +171,17 @@ extension KeyboardShortcuts.Shortcut {
 				nsMenuItemKeyEquivalent == keyEquivalent, // Note `nil != ""`
 				modifiers == keyEquivalentModifierMask
 			{
-				return item
+				matchingMenuItems.append(item)
 			}
 
 			if
-				let submenu = item.submenu,
-				let menuItem = menuItemWithMatchingShortcut(in: submenu)
+				let submenu = item.submenu
 			{
-				return menuItem
+				matchingMenuItems.append(contentsOf: menuItemsWithMatchingShortcut(in: submenu))
 			}
 		}
 
-		return nil
+		return matchingMenuItems
 	}
 
 	/**
@@ -186,10 +195,22 @@ extension KeyboardShortcuts.Shortcut {
 
 		return menuItemWithMatchingShortcut(in: mainMenu)
 	}
+
+	/**
+	Returns all menu items in the app's main menu that have a matching key equivalent and modifier.
+	*/
+	@MainActor
+	var takenByMainMenuItems: [NSMenuItem] {
+		guard let mainMenu = NSApp.mainMenu else {
+			return []
+		}
+
+		return menuItemsWithMatchingShortcut(in: mainMenu)
+	}
 }
 
 /*
-An enumeration of special keys requiring specific handling when used with `RecorderCocoa`, AppKit’s `NSMenuItem`, and SwiftUI’s `.keyboardShortcut(_:modifiers:)`.  
+An enumeration of special keys requiring specific handling when used with `RecorderCocoa`, AppKit’s `NSMenuItem`, and SwiftUI’s `.keyboardShortcut(_:modifiers:)`.
 
 Using an enumeration ensures all cases are exhaustively addressed in all three contexts, providing compile-time safety and reducing the risk of unhandled keys.
 */
```

**File**: `Sources/KeyboardShortcuts/ViewModifiers.swift` (modified, +1/-2)
```diff
@@ -79,8 +79,6 @@ extension View {
 	This is mostly useful to have the keyboard shortcut show for a `Button` in a `Menu` or `MenuBarExtra`.
 
 	It does not trigger the control's action.
-
-	- Important: Do not use it in a `CommandGroup` as the shortcut recorder will think the shortcut is already taken. It does remove the shortcut while the recorder is active, but because of a bug in macOS 15, the state is not reflected correctly in the underlying menu item.
 	*/
 	public func globalKeyboardShortcut(_ name: KeyboardShortcuts.Name) -> some View {
 		modifier(GlobalKeyboardShortcutViewModifier(name: name))
@@ -107,6 +105,7 @@ private struct GlobalKeyboardShortcutViewModifier: ViewModifier {
 			}
 			.onReceive(NotificationCenter.default.publisher(for: .recorderActiveStatusDidChange)) {
 				isRecorderActive = $0.recorderIsActive
+				triggerRefresh.toggle()
 			}
 	}
 }
```

**File**: `Tests/KeyboardShortcutsTests/KeyboardShortcutsTests.swift` (modified, +127/-0)
```diff
@@ -1476,6 +1476,72 @@ struct KeyboardShortcutsTests {
 		KeyboardShortcuts.removeAllHandlers()
 	}
 
+	@Test("Recorder ignores unchanged conflicts for its own AppKit-bound menu item")
+	@MainActor
+	func testRecorderIgnoresUnchangedConflictsForOwnAppKitBoundMenuItem() {
+		let name = KeyboardShortcuts.Name("recorderOwnAppKitMenuItem")
+		let shortcut = KeyboardShortcuts.Shortcut(.t, modifiers: [.command])
+		KeyboardShortcuts.setShortcut(shortcut, for: name)
+
+		let ownMenuItem = NSMenuItem()
+		ownMenuItem.setShortcut(for: name)
+
+		let conflictingMenuItem = KeyboardShortcuts.RecorderCocoa.firstMenuItemRequiringConflictHandling(
+			matchingMenuItems: [ownMenuItem],
+			shortcut: shortcut,
+			shortcutBeforeRecording: shortcut,
+			shortcutName: name,
+			usesNamedStorage: true
+		)
+
+		#expect(conflictingMenuItem == nil)
+	}
+
+	@Test("Recorder preserves conflict checks for unchanged shortcuts when another menu item conflicts")
+	@MainActor
+	func testRecorderPreservesConflictChecksForUnchangedShortcutsWithRealMenuConflicts() {
+		let name = KeyboardShortcuts.Name("recorderRealMenuConflict")
+		let shortcut = KeyboardShortcuts.Shortcut(.t, modifiers: [.command])
+		KeyboardShortcuts.setShortcut(shortcut, for: name)
+
+		let ownMenuItem = NSMenuItem()
+		ownMenuItem.setShortcut(for: name)
+
+		let otherMenuItem = NSMenuItem()
+		otherMenuItem.keyEquivalent = "t"
+		otherMenuItem.keyEquivalentModifierMask = [.command]
+
+		let conflictingMenuItem = KeyboardShortcuts.RecorderCocoa.firstMenuItemRequiringConflictHandling(
+			matchingMenuItems: [ownMenuItem, otherMenuItem],
+			shortcut: shortcut,
+			shortcutBeforeRecording: shortcut,
+			shortcutName: name,
+			usesNamedStorage: true
+		)
+
+		#expect(conflictingMenuItem === otherMenuItem)
+	}
+
+	@Test("Recorder preserves conflict checks in binding mode for unchanged shortcuts")
+	@MainActor
+	func testRecorderPreservesConflictChecksInBindingModeForUnchangedShortcuts() {
+		let name = KeyboardShortcuts.Name("recorderBindingModeConflict")
+		let shortcut = KeyboardShortcuts.Shortcut(.t, modifiers: [.command])
+
+		let ownMenuItem = NSMenuItem()
+		ownMenuItem.setShortcut(for: name)
+
+		let conflictingMenuItem = KeyboardShortcuts.RecorderCocoa.firstMenuItemRequiringConflictHandling(
+			matchingMenuItems: [ownMenuItem],
+			shortcut: shortcut,
+			shortcutBeforeRecording: shortcut,
+			shortcutName: name,
+			usesNamedStorage: false
+		)
+
+		#expect(conflictingMenuItem === ownMenuItem)
+	}
+
 	@Test("NSMenuItem preserves original key equivalent when no global shortcut is set")
 	@MainActor
 	func testNSMenuItemPreservesOriginalKeyEquivalentWhenNoShortcut() {
@@ -1565,6 +1631,67 @@ struct KeyboardShortcutsTests {
 		#expect(menuItem.keyEquivalentModifierMask == .command)
 	}
 
+	@Test("NSMenuItem keeps updating for multiple non-nil shortcut changes")
+	@MainActor
+	func testNSMenuItemKeepsUpdatingForMultipleNonNilShortcutChanges() async {
+		let name = KeyboardShortcuts.Name("menuItemMultipleNonNilUpdates")
+		let shortcut1 = KeyboardShortcuts.Shortcut(.a, modifiers: [.command])
+		let shortcut2 = KeyboardShortcuts.Shortcut(.b, modifiers: [.shift])
+		let shortcut3 = KeyboardShortcuts.Shortcut(.c, modifiers: [.option])
+
+		KeyboardShortcuts.setShortcut(shortcut1, for: name)
+
+		let menuItem = NSMenuItem()
+		menuItem.setShortcut(for: name)
+		#expect(menuItem.keyEquivalent == "a")
+		#expect(menuItem.keyEquivalentModifierMask == .command)
+
+		KeyboardShortcuts.setShortcut(shortcut2, for: name)
+
+		let secondShortcutApplied = await Self.waitUntilConditionIsTrue {
+			menuItem.keyEquivalent == "b"
+		}
+
+		#expect(secondShortcutApplied)
+		#expect(menuItem.keyEquivalentModifierMask == .shift)
+
+		KeyboardShortcuts.setShortcut(shortcut3, for: name)
+
+		let thirdShortcutApplied = await Self.waitUntilConditionIsTrue {
+			menuItem.keyEquivalent == "c"
+		}
+
+		#expect(thirdShortcutApplied)
+		#expect(menuItem.keyEquivalentModifierMask == .option)
+	}
+
+	@Test("NSMenuItem dynamic shortcut detaches existing name binding observer")
+	@MainActor
+	func testNSMenuItemDynamicShortcutDetachesExistingNameBindingObserver() async {
+		let name = KeyboardShortcuts.Name("menuItemDetachesNameBindingObserver")
+		let shortcut1 = KeyboardShortcuts.Shortcut(.a, modifiers: [.command])
+		let shortcut2 = KeyboardShortcuts.Shortcut(.b, modifiers: [.command])
+		let dynamicShortcut = KeyboardShortcuts.Shortcut(.z, modifiers: [.shift])
+
+		KeyboardShortcuts.setShortcut(shortcut1, for: name)
+
+		let menuItem = NSMenuItem()
+		menuItem.setShortcut(for: name)
+		#expect(menuItem.keyEquivalent == "a")
+		#expect(menuItem.keyEquivalentModifierMask == .command)
+
+		menuItem.setShortcut(dynamicShortcut)
+		#expect(menuItem.keyEquivalent == "z")
+		#expect(menuItem.keyEquivalentModifierMask == .shift)
+
+		KeyboardShortcuts.setShortcut(shortcut2, for: name)
+
+		try? await Task.sleep(for: .milliseconds(50))
+
+		#expect(menuItem.keyEquivalent == "z")
+		#expect(menuItem.keyEq
```

---

### Incident Patch 7: `0062f026` (2026-02-25)
**Commit Message**: Fix `NSMenuItem#setShortcut(for:)` overriding hardcoded key equivalent when no global shortcut is set

Previously, calling `setShortcut(for:)` with a name that had no global shortcut would clear any existing `keyEquivalent`/`keyEquivalentModifierMask` set on the menu item. The original values were permanently lost, even if the global shortcut was later removed. Now the original `keyEquivalent` and `keyEquivalentModifierMask` are saved on first call and restored whenever the global shortcut is nil (initially or after being cleared).

Fixes #202

**File**: `Sources/KeyboardShortcuts/NSMenuItem++.swift` (modified, +38/-4)
```diff
@@ -10,8 +10,14 @@ extension NSMenuItem {
 		}
 	}
 
+	private struct FallbackShortcut: Sendable {
+		let keyEquivalent: String
+		let modifierMask: NSEvent.ModifierFlags
+	}
+
 	private enum AssociatedKeys {
 		static let observer = ObjectAssociation<NSObjectProtocol>()
+		static let fallback = ObjectAssociation<FallbackShortcut>()
 	}
 
 	private func clearShortcut() {
@@ -23,6 +29,19 @@ extension NSMenuItem {
 		}
 	}
 
+	private func restoreShortcut() {
+		if let fallback = AssociatedKeys.fallback[self] {
+			keyEquivalent = fallback.keyEquivalent
+			keyEquivalentModifierMask = fallback.modifierMask
+
+			if #available(macOS 12, *) {
+				allowsAutomaticKeyEquivalentLocalization = true
+			}
+		} else {
+			clearShortcut()
+		}
+	}
+
 	// TODO: Make this a getter/setter. We must first add the ability to create a `Shortcut` from a `keyEquivalent`.
 	/**
 	Show a recorded keyboard shortcut in a `NSMenuItem`.
@@ -31,7 +50,7 @@ extension NSMenuItem {
 
 	Pass in `nil` to clear the keyboard shortcut.
 
-	This method overrides `.keyEquivalent` and `.keyEquivalentModifierMask`.
+	This method overrides `.keyEquivalent` and `.keyEquivalentModifierMask`. The original values are preserved and restored when the global shortcut is cleared.
 
 	```swift
 	import AppKit
@@ -54,7 +73,8 @@ extension NSMenuItem {
 	*/
 	public func setShortcut(for name: KeyboardShortcuts.Name?) {
 		guard let name else {
-			clearShortcut()
+			restoreShortcut()
+			AssociatedKeys.fallback[self] = nil
 			NotificationCenter.default.removeObserver(AssociatedKeys.observer[self] as Any)
 			AssociatedKeys.observer[self] = nil
 			return
@@ -63,10 +83,20 @@ extension NSMenuItem {
 		if let existingObserver = AssociatedKeys.observer[self] {
 			NotificationCenter.default.removeObserver(existingObserver)
 			AssociatedKeys.observer[self] = nil
+		} else {
+			AssociatedKeys.fallback[self] = FallbackShortcut(
+				keyEquivalent: keyEquivalent,
+				modifierMask: keyEquivalentModifierMask
+			)
 		}
 
 		let shortcut = KeyboardShortcuts.Shortcut(name: name)
-		setShortcut(shortcut)
+		if let shortcut {
+			setShortcut(shortcut)
+		} else {
+			restoreShortcut()
+		}
+
 		let menuItemReference = WeakReference(self)
 
 		// TODO: Use AsyncStream when targeting macOS 15.
@@ -84,7 +114,11 @@ extension NSMenuItem {
 				}
 
 				let shortcut = KeyboardShortcuts.Shortcut(name: name)
-				menuItem.setShortcut(shortcut)
+				if let shortcut {
+					menuItem.setShortcut(shortcut)
+				} else {
+					menuItem.restoreShortcut()
+				}
 			}
 		}
 	}
```

**File**: `Tests/KeyboardShortcutsTests/KeyboardShortcutsTests.swift` (modified, +89/-0)
```diff
@@ -980,6 +980,95 @@ struct KeyboardShortcutsTests {
 		KeyboardShortcuts.removeAllHandlers()
 	}
 
+	@Test("NSMenuItem preserves original key equivalent when no global shortcut is set")
+	@MainActor
+	func testNSMenuItemPreservesOriginalKeyEquivalentWhenNoShortcut() {
+		let name = KeyboardShortcuts.Name("menuItemPreservesKeyEquivalent")
+
+		let menuItem = NSMenuItem()
+		menuItem.keyEquivalent = "n"
+		menuItem.keyEquivalentModifierMask = .command
+
+		menuItem.setShortcut(for: name)
+
+		#expect(menuItem.keyEquivalent == "n")
+		#expect(menuItem.keyEquivalentModifierMask == .command)
+	}
+
+	@Test("NSMenuItem restores original key equivalent when name binding is removed")
+	@MainActor
+	func testNSMenuItemRestoresOriginalKeyEquivalentWhenNameBindingRemoved() {
+		let name = KeyboardShortcuts.Name("menuItemBindingRemoved")
+		KeyboardShortcuts.setShortcut(.init(.t, modifiers: [.command]), for: name)
+
+		let menuItem = NSMenuItem()
+		menuItem.keyEquivalent = "n"
+		menuItem.keyEquivalentModifierMask = .command
+
+		menuItem.setShortcut(for: name)
+		#expect(menuItem.keyEquivalent == "t")
+
+		menuItem.setShortcut(for: nil)
+
+		#expect(menuItem.keyEquivalent == "n")
+		#expect(menuItem.keyEquivalentModifierMask == .command)
+	}
+
+	@Test("NSMenuItem preserves original fallback when switching names")
+	@MainActor
+	func testNSMenuItemPreservesFallbackWhenSwitchingNames() {
+		let name1 = KeyboardShortcuts.Name("menuItemSwitchName1")
+		let name2 = KeyboardShortcuts.Name("menuItemSwitchName2")
+		KeyboardShortcuts.setShortcut(.init(.a, modifiers: [.command]), for: name1)
+		KeyboardShortcuts.setShortcut(.init(.b, modifiers: [.shift]), for: name2)
+
+		let menuItem = NSMenuItem()
+		menuItem.keyEquivalent = "z"
+		menuItem.keyEquivalentModifierMask = .control
+
+		menuItem.setShortcut(for: name1)
+		#expect(menuItem.keyEquivalent == "a")
+		#expect(menuItem.keyEquivalentModifierMask == .command)
+
+		menuItem.setShortcut(for: name2)
+		#expect(menuItem.keyEquivalent == "b")
+		#expect(menuItem.keyEquivalentModifierMask == .shift)
+
+		// Restores the ORIGINAL "z", not "a" from the first name
+		menuItem.setShortcut(for: nil)
+		#expect(menuItem.keyEquivalent == "z")
+		#expect(menuItem.keyEquivalentModifierMask == .control)
+	}
+
+	@Test("NSMenuItem restores original key equivalent when global shortcut is cleared")
+	@MainActor
+	func testNSMenuItemRestoresOriginalKeyEquivalentWhenShortcutCleared() async {
+		let name = KeyboardShortcuts.Name("menuItemRestoresKeyEquivalent")
+		let globalShortcut = KeyboardShortcuts.Shortcut(.t, modifiers: [.command, .shift])
+		KeyboardShortcuts.setShortcut(globalShortcut, for: name)
+
+		let menuItem = NSMenuItem()
+		menuItem.keyEquivalent = "n"
+		menuItem.keyEquivalentModifierMask = .command
+
+		menuItem.setShortcut(for: name)
+
+		// Should now show the global shortcut
+		#expect(menuItem.keyEquivalent == "t")
+		#expect(menuItem.keyEquivalentModifierMask == [.command, .shift])
+
+		// Clear the global shortcut
+		KeyboardShortcuts.setShortcut(nil, for: name)
+
+		// Wait for the notification to restore the fallback
+		let restored = await Self.waitUntilConditionIsTrue {
+			menuItem.keyEquivalent == "n"
+		}
+
+		#expect(restored)
+		#expect(menuItem.keyEquivalentModifierMask == .command)
+	}
+
 	@Test("Localization files are valid")
 	func testLocalizationFilesAreValid() throws {
 		for localizationIdentifier in Bundle.module.localizations.sorted() {
```

---

### Incident Patch 8: `bacf931e` (2026-02-25)
**Commit Message**: Add migration guide for hotkey packages

Fixes #17

**File**: `Sources/KeyboardShortcuts/KeyboardShortcuts.docc/KeyboardShortcuts.md` (added, +11/-0)
```diff
@@ -0,0 +1,11 @@
+# ``KeyboardShortcuts``
+
+@Metadata {
+	@DocumentationExtension(mergeBehavior: append)
+}
+
+## Topics
+
+### Guides
+
+- <doc:Migration>
```

**File**: `Sources/KeyboardShortcuts/KeyboardShortcuts.docc/Migration.md` (added, +195/-0)
```diff
@@ -0,0 +1,195 @@
+# Migration
+
+A guide for migrating from other hotkey packages to KeyboardShortcuts.
+
+## KeyboardShortcuts pattern
+
+After migrating, you will:
+
+1. Define `KeyboardShortcuts.Name`.
+2. Use `KeyboardShortcuts.Recorder` or `KeyboardShortcuts.RecorderCocoa` in your settings UI.
+3. Listen for events with `KeyboardShortcuts.events(for:)`.
+
+```swift
+import SwiftUI
+import KeyboardShortcuts
+
+// 1. Define a name
+extension KeyboardShortcuts.Name {
+	static let toggleMainWindow = Self("toggleMainWindow")
+}
+
+// 2. Add a recorder to your settings view
+struct SettingsView: View {
+	var body: some View {
+		KeyboardShortcuts.Recorder("Toggle Main Window:", name: .toggleMainWindow)
+	}
+}
+
+// 3. Listen for events (must be inside a Task or async context)
+Task {
+	for await eventType in KeyboardShortcuts.events(for: .toggleMainWindow) where eventType == .keyUp {
+		toggleMainWindow()
+	}
+}
+```
+
+## [MASShortcut](https://github.com/cocoabits/MASShortcut) migration
+
+### Before
+
+```swift
+import MASShortcut
+
+shortcutView.associatedUserDefaultsKey = "toggleMainWindow"
+MASShortcutBinder.shared().bindShortcut(withDefaultsKey: "toggleMainWindow") {
+	toggleMainWindow()
+}
+```
+
+### After
+
+MASShortcut's binder fires on key-up, so match that:
+
+```swift
+import KeyboardShortcuts
+
+// Inside a Task or async context
+for await eventType in KeyboardShortcuts.events(for: .toggleMainWindow) where eventType == .keyUp {
+	toggleMainWindow()
+}
+```
+
+### Value migration
+
+`MASShortcut` values are typically in `UserDefaults` for the old defaults key. Convert once:
+
+```swift
+import MASShortcut
+import KeyboardShortcuts
+
+func migrateMASShortcutValue(oldDefaultsKey: String, newName: KeyboardShortcuts.Name) {
+	guard
+		KeyboardShortcuts.getShortcut(for: newName) == nil,
+		let legacyShortcut = UserDefaults.standard.object(forKey: oldDefaultsKey) as? MASShortcut
+	else {
+		return
+	}
+
+	KeyboardShortcuts.setShortcut(
+		.init(
+			carbonKeyCode: Int(legacyShortcut.keyCode),
+			carbonModifiers: Int(legacyShortcut.modifierFlags)
+		),
+		for: newName
+	)
+
+	UserDefaults.standard.removeObject(forKey: oldDefaultsKey)
+}
+```
+
+If your MASShortcut setup uses a custom transformer, keep your existing decode path and only change the final conversion to `KeyboardShortcuts.Shortcut(carbonKeyCode:carbonModifiers:)`.
+
+## [Magnet](https://github.com/Clipy/Magnet) migration
+
+### Before
+
+```swift
+import Magnet
+
+let hotKey = HotKey(
+	identifier: "toggleMainWindow",
+	keyCombo: KeyCombo(key: .j, cocoaModifiers: [.command, .shift]),
+	target: self,
+	action: #selector(toggleMainWindow)
+)
+
+hotKey.keyDownHandler = {
+	toggleMainWindow()
+}
+
+hotKey.keyUpHandler = {
+	// Optional
+}
+
+HotKeyCenter.shared.register(with: hotKey)
+```
+
+### After
+
+Magnet fires on key-down by default, so match that:
+
+```swift
+import KeyboardShortcuts
+
+// Inside a Task or async context
+for await eventType in KeyboardShortcuts.events(for: .toggleMainWindow) where eventType == .keyDown {
+	toggleMainWindow()
+}
+```
+
+### Value migration
+
+Magnet is usually registration-only. If you did not persist `KeyCombo` yourself, there is nothing to migrate.
+
+If you did persist values, convert once from your existing storage schema:
+
+```swift
+import KeyboardShortcuts
+
+func migrateLegacyShortcut(
+	newName: KeyboardShortcuts.Name,
+	readLegacyCarbonValue: () -> (Int, Int)?
+) {
+	guard KeyboardShortcuts.getShortcut(for: newName) == nil else {
+		return
+	}
+
+	guard let (carbonKeyCode, carbonModifiers) = readLegacyCarbonValue() else {
+		return
+	}
+
+	KeyboardShortcuts.setShortcut(.init(carbonKeyCode: carbonKeyCode, carbonModifiers: carbonModifiers), for: newName)
+}
+```
+
+## [ShortcutRecorder](https://github.com/Kentzo/ShortcutRecorder) migration
+
+### Before
+
+```swift
+import ShortcutRecorder
+
+recorderControl.bind(
+	.objectValue,
+	to: UserDefaultsController.shared,
+	withKeyPath: "values.toggleMainWindow",
+	options: [.valueTransformerName: NSValueTransformerName.keyedUnarchiveFromDataTransformerName]
+)
+```
+
+### After
+
+```swift
+import SwiftUI
+import KeyboardShortcuts
+
+struct SettingsView: View {
+	var body: some View {
+		KeyboardShortcuts.Recorder("Toggle Main Window:", name: .toggleMainWindow)
+	}
+}
+```
+
+### Value migration
+
+ShortcutRecorder projects often store archived shortcut values. Keep your existing decode logic and use the same `migrateLegacyShortcut` helper shown in the Magnet section above.
+
+If your codebase uses older `SR*` type names, the migration is the same: decode the legacy value, extract carbon key code + modifiers, convert once.
+
+## Rollout sequence
+
+1. Migrate only when `KeyboardShortcuts.getShortcut(for:) == nil` to avoid overwriting user preferences.
+2. Write with `KeyboardShortcuts.setShortcut`.
+3. Remove the old stored value only after successful conversion.
+4. Remove the old dependency.
```

**File**: `readme.md` (modified, +2/-0)
```diff
@@ -236,6 +236,8 @@ This package:
 - More mature.
 - More localizations.
 
+<!-- For migration recipes, see the [migration guide](Sources/KeyboardShortcuts/KeyboardShortcuts.docc/Migration.md). -->
+
 #### Why is this package importing `Carbon`? Isn't that deprecated?
 
 Most of the Carbon APIs were deprecated years ago, but there are some left that Apple never shipped modern replacements for. This includes registering global keyboard shortcuts. However, you should not need to worry about this. Apple will for sure ship new APIs before deprecating the Carbon APIs used here.
```

---

### Incident Patch 9: `c8e1dfe3` (2026-02-23)
**Commit Message**: Fix Arabic localization typo

Fixes #234

**File**: `Sources/KeyboardShortcuts/Localization/ar.lproj/Localizable.strings` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@
 "press_shortcut" = "اضغط على الاختصار";
 "keyboard_shortcut_used_by_menu_item" = "لا يمكن استخدام اختصار لوحة المفاتيح هذا لأنه مستخدم بواسطة عنصر القائمة “%@”.";
 "keyboard_shortcut_used_by_system" = "لا يمكن استخدام اختصار لوحة المفاتيح هذا لأنه مستخدم مسبقاً على مستوى النظام.";
-"keyboard_shortcuts_can_be_changed" = "يمكن تغيير معظم اختصارات لوحة المفاتيح على مستوى النظام في "إعدادات النظام › لوحة المفاتيح › اختصارات لوحة المفاتيح".";
+"keyboard_shortcuts_can_be_changed" = "يمكن تغيير معظم اختصارات لوحة المفاتيح على مستوى النظام في “إعدادات النظام › لوحة المفاتيح › اختصارات لوحة المفاتيح”.";
 "keyboard_shortcut_disallowed" = "يجب دمج مفتاح Option مع Command أو Control.";
 "force_use_shortcut" = "استخدم على أي حال";
 "ok" = "موافق";
```

**File**: `Tests/KeyboardShortcutsTests/KeyboardShortcutsTests.swift` (modified, +23/-0)
```diff
@@ -868,6 +868,29 @@ struct KeyboardShortcutsTests {
 
 		KeyboardShortcuts.removeAllHandlers()
 	}
+
+	@Test("Localization files are valid")
+	func testLocalizationFilesAreValid() throws {
+		for localizationIdentifier in Bundle.module.localizations.sorted() {
+			guard let localizationFileURL = Bundle.module.url(
+				forResource: "Localizable",
+				withExtension: "strings",
+				subdirectory: nil,
+				localization: localizationIdentifier
+			) else {
+				Issue.record("Missing Localizable.strings for localization '\(localizationIdentifier)'")
+				continue
+			}
+
+			let localizationFileData = try Data(contentsOf: localizationFileURL)
+
+			do {
+				_ = try PropertyListSerialization.propertyList(from: localizationFileData, options: [], format: nil)
+			} catch {
+				Issue.record("Invalid Localizable.strings for localization '\(localizationIdentifier)': \(error)")
+			}
+		}
+	}
 }
 
 // MARK: - Modifier Symbol Tests
```

---

### Incident Patch 10: `6395c6db` (2026-01-24)
**Commit Message**: Add `Shortcut#toSwiftUI` as public API

Closes #230

**File**: `Sources/KeyboardShortcuts/Shortcut.swift` (modified, +15/-1)
```diff
@@ -752,9 +752,23 @@ extension KeyboardShortcuts.Shortcut: CustomStringConvertible {
 }
 
 extension KeyboardShortcuts.Shortcut {
+	/**
+	Converts this shortcut to a SwiftUI `KeyboardShortcut`.
+
+	Use this to apply a user-defined shortcut to a SwiftUI view using the `.keyboardShortcut(_:)` modifier.
+
+	Returns `nil` if the shortcut cannot be represented in SwiftUI (for example, certain special keys).
+
+	```swift
+	Button("Perform Action") {
+		performAction()
+	}
+	.keyboardShortcut(shortcut.toSwiftUI)
+	```
+	*/
 	@available(macOS 11, *)
 	@MainActor
-	var toSwiftUI: KeyboardShortcut? {
+	public var toSwiftUI: KeyboardShortcut? {
 		if
 			let key,
 			let specialKey = keyToSpecialKeyMapping[key]
```

---

### Incident Patch 11: `1aef8557` (2025-09-18)
**Commit Message**: Fix `RecorderCocoa` zero-size issue when added without constraints

Fixes #209

**File**: `Sources/KeyboardShortcuts/RecorderCocoa.swift` (modified, +3/-1)
```diff
@@ -88,7 +88,9 @@ extension KeyboardShortcuts {
 			self.shortcutName = name
 			self.onChange = onChange
 
-			super.init(frame: .zero)
+			// Use a default frame that matches our intrinsic size to prevent zero-size issues
+			// when added without constraints (issue #209)
+			super.init(frame: NSRect(x: 0, y: 0, width: minimumWidth, height: 24))
 			self.delegate = self
 			self.placeholderString = "record_shortcut".localized
 			self.alignment = .center
```

**File**: `Tests/KeyboardShortcutsTests/KeyboardShortcutsTests.swift` (modified, +2/-2)
```diff
@@ -3,7 +3,7 @@ import Foundation
 import AppKit
 import KeyboardShortcuts
 
-@Suite("KeyboardShortcuts Tests")
+@Suite("KeyboardShortcuts Tests", .serialized)
 struct KeyboardShortcutsTests {
 	init() {
 		UserDefaults.standard.removeAllKeyboardShortcuts()
@@ -247,7 +247,7 @@ struct KeyboardShortcutsTests {
 
 // MARK: - Modifier Symbol Tests
 
-@Suite("Modifier Symbol Tests")
+@Suite("Modifier Symbol Tests", .serialized)
 struct ModifierSymbolTests {
 	@Test("Individual modifier symbols")
 	func testIndividualModifierSymbols() {
```

**File**: `Tests/KeyboardShortcutsTests/RecorderLayoutTests.swift` (added, +26/-0)
```diff
@@ -0,0 +1,26 @@
+import Testing
+import Foundation
+import AppKit
+import KeyboardShortcuts
+
+@Suite("RecorderCocoa Layout Tests")
+struct RecorderCocoaLayoutTests {
+	@Test("RecorderCocoa has default size")
+	func testRecorderDefaultSize() throws {
+		let recorder = KeyboardShortcuts.RecorderCocoa(for: .init("test"))
+
+		#expect(recorder.frame.width >= 130)
+		#expect(recorder.frame.height > 0)
+	}
+
+	@Test("RecorderCocoa works with addSubview")
+	@MainActor
+	func testRecorderAddSubview() throws {
+		let recorder = KeyboardShortcuts.RecorderCocoa(for: .init("test"))
+		let containerView = NSView(frame: NSRect(x: 0, y: 0, width: 400, height: 100))
+
+		containerView.addSubview(recorder)
+
+		#expect(recorder.frame.size != .zero)
+	}
+}
\ No newline at end of file
```

---

### Incident Patch 12: `92af6600` (2025-09-15)
**Commit Message**: Fix first responder warning in SwiftUI contexts

Fixes #127

**File**: `Sources/KeyboardShortcuts/RecorderCocoa.swift` (modified, +6/-0)
```diff
@@ -202,6 +202,12 @@ extension KeyboardShortcuts {
 
 		/// :nodoc:
 		override public func becomeFirstResponder() -> Bool {
+			// Ensure we have a valid window before attempting to become first responder
+			// This prevents issues in SwiftUI contexts where the view hierarchy might not be fully established
+			guard window != nil else {
+				return false
+			}
+
 			let shouldBecomeFirstResponder = super.becomeFirstResponder()
 
 			guard shouldBecomeFirstResponder else {
```

---

### Incident Patch 13: `4e8968e5` (2025-09-15)
**Commit Message**: Fix localization issues and ensure completeness

Fixes #212
Fixes #174
Fixes #97

**File**: `Sources/KeyboardShortcuts/Localization/ar.lproj/Localizable.strings` (modified, +2/-1)
```diff
@@ -2,7 +2,8 @@
 "press_shortcut" = "اضغط على الاختصار";
 "keyboard_shortcut_used_by_menu_item" = "لا يمكن استخدام اختصار لوحة المفاتيح هذا لأنه مستخدم بواسطة عنصر القائمة “%@”.";
 "keyboard_shortcut_used_by_system" = "لا يمكن استخدام اختصار لوحة المفاتيح هذا لأنه مستخدم مسبقاً على مستوى النظام.";
-"keyboard_shortcuts_can_be_changed" = "يمكن تغيير معظم اختصارات لوحة المفاتيح على مستوى النظام في “تفضيلات النظام > لوحة المفاتيح > الاختصارات ”.";
+"keyboard_shortcuts_can_be_changed" = "يمكن تغيير معظم اختصارات لوحة المفاتيح على مستوى النظام في "إعدادات النظام › لوحة المفاتيح › اختصارات لوحة المفاتيح".";
 "keyboard_shortcut_disallowed" = "يجب دمج مفتاح Option مع Command أو Control.";
+"force_use_shortcut" = "استخدم على أي حال";
 "ok" = "موافق";
 "space_key" = "مسافة";
```

**File**: `Sources/KeyboardShortcuts/Localization/cs.lproj/Localizable.strings` (modified, +1/-0)
```diff
@@ -4,5 +4,6 @@
 "keyboard_shortcut_used_by_system" = "Tuto zkratku nelze použít, protože už ji používá systém.";
 "keyboard_shortcuts_can_be_changed" = "Většinu systémových zkratek můžete změnit v „Nastavení systému › Klávesnice › Klávesové zkratky“.";
 "keyboard_shortcut_disallowed" = "Modifikátor Option musí být kombinován s klávesou Command nebo Control.";
+"force_use_shortcut" = "Přesto použít";
 "ok" = "OK";
 "space_key" = "Mezera";
```

**File**: `Sources/KeyboardShortcuts/Localization/de.lproj/Localizable.strings` (modified, +1/-0)
```diff
@@ -4,5 +4,6 @@
 "keyboard_shortcut_used_by_system" = "Dieses Tastaturkürzel kann nicht verwendet werden, da es bereits systemweit verwendet wird.";
 "keyboard_shortcuts_can_be_changed" = "Die meisten systemweiten Tastaturkürzel können unter „Systemeinstellungen › Tastatur › Tastaturkurzbefehle“ geändert werden.";
 "keyboard_shortcut_disallowed" = "Die Option-Taste muss mit der Befehlstaste oder der Steuerungstaste kombiniert werden.";
+"force_use_shortcut" = "Trotzdem verwenden";
 "ok" = "OK";
 "space_key" = "Leer";
```

**File**: `Sources/KeyboardShortcuts/Localization/es.lproj/Localizable.strings` (modified, +1/-0)
```diff
@@ -4,5 +4,6 @@
 "keyboard_shortcut_used_by_system" = "Este atajo de teclado no se puede utilizar ya que está siendo utilizado por un atajo del sistema operativo.";
 "keyboard_shortcuts_can_be_changed" = "La mayoría de los atajos de teclado del sistema operativo pueden ser modificados en “Configuración del sistema › Teclado › Atajos de teclado“.";
 "keyboard_shortcut_disallowed" = "El modificador Option debe combinarse con Command o Control.";
+"force_use_shortcut" = "Usar de todos modos";
 "ok" = "Aceptar";
 "space_key" = "Espacio";
```

**File**: `Sources/KeyboardShortcuts/Localization/fr.lproj/Localizable.strings` (modified, +1/-0)
```diff
@@ -4,5 +4,6 @@
 "keyboard_shortcut_used_by_system" = "Ce raccourci ne peut pas être utilisé car il s'agit d'un raccourci déjà présent dans le système.";
 "keyboard_shortcuts_can_be_changed" = "La plupart des raccourcis clavier de l'ensemble du système peuvent être modifiés en “Réglages du système… › Clavier › Raccourcis clavier…”.";
 "keyboard_shortcut_disallowed" = "Le modificateur Option doit être combiné avec Command ou Control.";
+"force_use_shortcut" = "Utiliser quand même";
 "ok" = "OK";
 "space_key" = "Espace";
```

**File**: `Sources/KeyboardShortcuts/Localization/hu.lproj/Localizable.strings` (modified, +2/-1)
```diff
@@ -2,7 +2,8 @@
 "press_shortcut" = "Nyomja meg a billentyűparancsot";
 "keyboard_shortcut_used_by_menu_item" = "Ez a billentyűparancs nem használható mert már a “%@” menü elem használja.";
 "keyboard_shortcut_used_by_system" = "Ez a billentyűparancs nem használható mert már egy rendszerszintü billentyűparancs.";
-"keyboard_shortcuts_can_be_changed" = "A legtöbb rendszerszintü billentyűparancsot a “Rendszerbeállítások › Billentyűzet › Billentyűparancsok“ menüben meg lehet változtatni";
+"keyboard_shortcuts_can_be_changed" = "A legtöbb rendszerszintü billentyűparancsot a “Rendszerbeállítások › Billentyűzet › Billentyűparancsok” menüben meg lehet változtatni";
 "keyboard_shortcut_disallowed" = "Az Option módosítót a Command vagy Control billentyűvel együtt kell használni.";
+"force_use_shortcut" = "Használat mindenképp";
 "ok" = "OK";
 "space_key" = "Szóköz";
```

**File**: `Sources/KeyboardShortcuts/Localization/ko.lproj/Localizable.strings` (modified, +1/-0)
```diff
@@ -4,5 +4,6 @@
 "keyboard_shortcut_used_by_system" = "이 키보드 단축키는 이미 시스템상에서 사용되고 있으므로 등록할 수 없습니다.";
 "keyboard_shortcuts_can_be_changed" = "대부분의 시스템 키보드 단축키는 “시스템 설정 › 키보드 › 키보드 단축키”에서 변경 가능합니다.";
 "keyboard_shortcut_disallowed" = "Option 수정자는 Command 또는 Control과 함께 사용해야 합니다.";
+"force_use_shortcut" = "그래도 사용";
 "ok" = "확인";
 "space_key" = "빈칸";
```

**File**: `Sources/KeyboardShortcuts/Localization/nl.lproj/Localizable.strings` (modified, +1/-0)
```diff
@@ -4,5 +4,6 @@
 "keyboard_shortcut_used_by_system" = "Deze toetscombinatie kan niet worden gebruikt omdat hij al door het systeem gebruikt wordt.";
 "keyboard_shortcuts_can_be_changed" = "De meeste systeem toetscombinaties kunnen onder “Systeeminstellingen… > Toetsenbord > Toetscombinaties…” veranderd worden.";
 "keyboard_shortcut_disallowed" = "De Option-toets moet worden gecombineerd met Command of Control.";
+"force_use_shortcut" = "Toch gebruiken";
 "ok" = "OK";
 "space_key" = "spatie";
```

---

### Incident Patch 14: `045cf174` (2025-03-07)
**Commit Message**: Add `Shortcut#nsMenuItemKeyEquivalent` property

Closes #201

**File**: `Sources/KeyboardShortcuts/NSMenuItem++.swift` (modified, +1/-1)
```diff
@@ -96,7 +96,7 @@ extension NSMenuItem {
 			return
 		}
 
-		keyEquivalent = shortcut.keyEquivalent ?? ""
+		keyEquivalent = shortcut.nsMenuItemKeyEquivalent ?? ""
 		keyEquivalentModifierMask = shortcut.modifiers
 
 		if #available(macOS 12, *) {
```

**File**: `Sources/KeyboardShortcuts/Shortcut.swift` (modified, +6/-4)
```diff
@@ -152,7 +152,7 @@ extension KeyboardShortcuts.Shortcut {
 			}
 
 			if
-				self.keyEquivalent == keyEquivalent, // Note `nil != ""`
+				self.nsMenuItemKeyEquivalent == keyEquivalent, // Note `nil != ""`
 				self.modifiers == keyEquivalentModifierMask
 			{
 				return item
@@ -691,17 +691,19 @@ extension KeyboardShortcuts.Shortcut {
 		if string.count == 1 {
 			return string.first
 		}
+
 		return nil
 	}
 
-	// This can be exposed if anyone needs it, but I prefer to keep the API surface small for now.
 	/**
+	Key equivalent string in `NSMenuItem` format.
+
 	This can be used to show the keyboard shortcut in a `NSMenuItem` by assigning it to `NSMenuItem#keyEquivalent`.
 
-	- Note: Don't forget to also pass `.modifiers` to `NSMenuItem#keyEquivalentModifierMask`.
+	- Note: Don't forget to also pass ``Shortcut/modifiers`` to `NSMenuItem#keyEquivalentModifierMask`.
 	*/
 	@MainActor
-	var keyEquivalent: String? {
+	public var nsMenuItemKeyEquivalent: String? {
 		if
 			let key,
 			let specialKey = keyToSpecialKeyMapping[key]
```

---

### Incident Patch 15: `2d6b49e0` (2025-03-07)
**Commit Message**: Fix compilation of the package in multi-platform projects (#196)

**File**: `Sources/KeyboardShortcuts/Utilities.swift` (modified, +15/-12)
```diff
@@ -1,6 +1,7 @@
+import SwiftUI
+
 #if os(macOS)
 import Carbon.HIToolbox
-import SwiftUI
 
 
 extension String {
@@ -510,6 +511,19 @@ extension Dictionary {
 #endif
 
 
+@available(iOS 14.0, *)
+@available(macOS 11.0, *)
+extension KeyEquivalent {
+	init?(unicodeScalarValue value: Int) {
+		guard let character = Character(unicodeScalarValue: value) else {
+			return nil
+		}
+
+		self = KeyEquivalent(character)
+	}
+}
+
+
 extension Sequence where Element: Hashable {
 	/**
 	Convert a `Sequence` with `Hashable` elements to a `Set`.
@@ -536,17 +550,6 @@ extension StringProtocol {
 	}
 }
 
-@available(macOS 11.0, *)
-extension KeyEquivalent {
-	init?(unicodeScalarValue value: Int) {
-		guard let character = Character(unicodeScalarValue: value) else {
-			return nil
-		}
-
-		self = KeyEquivalent(character)
-	}
-}
-
 extension Character {
 	init?(unicodeScalarValue value: Int) {
 		guard let content = UnicodeScalar(value) else {
```

#### Recent Merged Pull Requests:
- **PR #238** (closed): Expose isTakenBySystem and isDisallowed (@tqtifnypmb)
- **PR #236** (closed): Fix option+letter shortcuts being intercepted by IME layer (@BashkaMen)
- **PR #232** (2026-01-24): Add Polish localization (@rkopicki)
- **PR #230** (closed): Make toSwiftUI public (@gpoitch)
- **PR #227** (closed): Add option to override handling of disallowed shortcuts (@lifr0m)
- **PR #226** (closed): feat: support multicords keybinding recording (@xinnjie)
- **PR #224** (2025-09-15): Add italian support to localization files (@GabrieleiGenius)
- **PR #222** (closed): Add ability to override a shortcut reserved for a menu item (@oashrafouad)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

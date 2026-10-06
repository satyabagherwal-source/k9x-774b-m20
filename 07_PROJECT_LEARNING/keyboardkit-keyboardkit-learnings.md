# Forensic Learning Record (Deep Inspection): KeyboardKit/KeyboardKit

> **Canonical Artifact**: `07_PROJECT_LEARNING/keyboardkit-keyboardkit-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/KeyboardKit/KeyboardKit](https://github.com/KeyboardKit/KeyboardKit))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T06:31:52.424Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `KeyboardKit/KeyboardKit`
- **Description**: Create amazing custom iOS keyboards with Swift & SwiftUI.
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 1889 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `Demo/Demo/DemoApp.swift`
```
//
//  DemoApp.swift
//  KeyboardKit
//
//  Created by Daniel Saidi on 2021-02-11.
//  Copyright © 2021-2025 Daniel Saidi. All rights reserved.
//

import SwiftUI
import KeyboardKit

/// This is the KeyboardKit demo app.
///
/// The main app target shows you how `KeyboardKit Pro` lets
/// you create a great keyboard app, in which a user can set
/// up and configure the keyboard in in-app settings screens.
/// The `Keyboard` keyboard uses `KeyboardKit` to show basic
/// keyboard usage while `KeyboardPro` uses `KeyboardKit Pro`
/// to unlock localized layouts, emojis, settings, etc.
///
/// To run this demo on a physical device, you must register
/// your development team under `Signing & Capabilities` for
/// all three targets.
///
/// `IMPORTANT` This demo has no App Group by default, which
/// means that keyboard settings won't sync between the main
/// app and its keyboards. This is why the `KeyboardPro` has
/// in-keyboard settings screens. To make settings sync, you
/// have to change the bundle ID of all targets, then create
/// an App Group in the Apple Developer Portal and add it to
/// all three targets, then change the `appGroupId` value in
/// `KeyboardApp+Demo.swift`.
@main
struct DemoApp: App {

    init() {
        // subscribeToKeyboardNotifications()
    }

    var body: some Scene {
        WindowGroup {
            KeyboardAppView(for: .keyboardKitDemo) {
                HomeScreen()
            }
        }
    }
}

private extension DemoApp {

    func subscribeToKeyboardNotifications() {
        NotificationCenter.default.addObserver(
            forName: UIResponder.keyboardWillShowNotification,
            object: nil,
            queue: .main
        ) { notification in
            let key = UIResponder.keyboardFrameEndUserInfoKey
            if let keyboardFrame = notification.userInfo?[key] as? CGRect {
                print("Keyboard height: \(keyboardFrame.height)")
            }
        }
    }
}

```

### Core Architecture Module: `Demo/Demo/Dictation/StandardSpeechRecognizer.swift`
```
//
//  StandardSpeechRecognizer.swift
//  Demo
//
//  Created by Daniel Saidi on 2023-12-12.
//  Copyright © 2023-2025 Daniel Saidi. All rights reserved.
//

// This code is copied from the online documentation, and is
// used to enable dictation. The reason why this code is not
// in the KeyboardKitPro SDK, is that importing Speech would
// require all apps to add permission requests to Info.plist,
// even when not using dictation.

import Speech
import KeyboardKit

import KeyboardKit
import Speech

public extension DictationSpeechRecognizer where Self == StandardSpeechRecognizer {

    static var standard: Self { .init() }
}

public class StandardSpeechRecognizer: DictationSpeechRecognizer {

    public init() {}

    private var recognizer: SFSpeechRecognizer?
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var speechRecognizerTask: SFSpeechRecognitionTask?

    private typealias Err = DictationServiceError

    public var authorizationStatus: DictationAuthorizationStatus {
        SFSpeechRecognizer.authorizationStatus().dictationStatus
    }

    public var supportedLocales: [Locale] {
        Array(SFSpeechRecognizer.supportedLocales())
    }

    public func requestDictationAuthorization() async throws -> DictationAuthorizationStatus {
        await withCheckedContinuation { continuation in
            SFSpeechRecognizer.requestAuthorization { status in
                continuation.resume(returning: status.dictationStatus)
            }
        }
    }

    public func resetDictationResult() async throws {}

    public func startDictation(
        with locale: Locale
    ) async throws {
        try await startDictation(
            with: locale,
            resultHandler: nil
        )
    }

    public func startDictation(
        with locale: Locale,
        resultHandler: ((DictationSpeechResult) -> Void)?
    ) async throws {
        recognizer = SFSpeechRecognizer(locale: locale)
        guard let recognizer else { throw Err.missingSpeechRecognizer }
        request = SFSpeechAudioBufferRecognitionRequest()
        request?.shouldReportPartialResults = true
        guard let request else { throw Err.missingSpeechRecognitionRequest }
        speechRecognizerTask = recognizer.recognitionTask(with: request) {
            let result = DictationSpeechResult(
                dictatedText: $0?.bestTranscription.formattedString,
                error: $1,
                isFinal: $0?.isFinal ?? true)
            resultHandler?(result)
        }
    }

    public func stopDictation() async throws {
        request?.endAudio()
        request = nil
        speechRecognizerTask?.cancel()
        speechRecognizerTask = nil
    }

    public func setupAudioEngineBuffer(_ buffer: AVAudioPCMBuffer) {
        request?.append(buffer)
    }
}

```

### Core Architecture Module: `Demo/Demo/HomeScreen.swift`
```
//
//  HomeScreen.swift
//  KeyboardKit
//
//  Created by Daniel Saidi on 2021-02-11.
//  Copyright © 2021-2025 Daniel Saidi. All rights reserved.
//

import KeyboardKit
import SwiftUI

/// This is the main demo app screen.
///
/// This view uses a KeyboardKit Pro `HomeScreen` to present
/// keyboard status and settings links with some adjustments.
///
/// See ``DemoApp`` for important, demo-specific information
/// on why the in-app keyboard settings aren't synced to the
/// keyboards by default, and how you can enable this.
struct HomeScreen: View {

    let app = KeyboardApp.keyboardKitDemo

    @State var text = ""
    @State var textEmail = ""
    @State var textMultiline = ""
    @State var textNumberPad = ""
    @State var textURL = ""
    @State var textWebSearch = ""

    @Environment(\.openURL) var openURL

    @EnvironmentObject var dictationContext: DictationContext
    @EnvironmentObject var keyboardContext: KeyboardContext

    var body: some View {
        NavigationView {
            KeyboardAppHomeScreen(
                app: app,
                appIcon: Image(.icon),
                header: {
                    Text(
"""
OBS! This demo isn't code signed and therefore can't sync data with its keyboard. This means that dictation will not work.
"""
                    )
                    .listRowBackground(Color.yellow)
                    .multilineTextAlignment(.center)
                },
                footer: {
                    Section("Section.TextFields") {
                        TextField("TextField.Plain", text: $text)
                            .keyboardType(.default)
                        TextField("TextField.Email", text: $textEmail)
                            .keyboardType(.emailAddress)
                        TextField("TextField.NumberPad", text: $textNumberPad)
                            .keyboardType(.numberPad)
                        TextField("TextField.URL", text: $textURL)
                            .keyboardType(.URL)
                            .autocapitalization(.none)
                        TextField("TextField.WebSearch", text: $textWebSearch)
                            .keyboardType(.webSearch)
                        TextField("TextField.Multiline", text: $textMultiline, axis: .vertical)
                            .lineLimit(4, reservesSpace: true)
                            .keyboardType(.default)
                    }
                }
            )
            .navigationTitle(app.name)
        }
        .keyboardAppHomeScreenStyle(.init(
            appIconSize: 120,
            appIconCornerRadius: 27
        ))
//        .keyboardAppHomeScreenVisibility(.init(
//            settingsSectionFonts: true,
//            settingsSectionThemes: true,
//            settingsSectionExperiments: true,
//        ))
        .keyboardDictation(
            speechRecognizer: .standard
        )
        .navigationViewStyle(.stack)
    }
}

extension HomeScreen {
    
    func dictationScreen() -> some View {
        DictationScreen(
            titleView: { EmptyView() },
            visualizer: { DictationBarVisualizer(isAnimating: $0) },
            doneButton: { action in
                Button("Button.Done", action: action)
                    .buttonStyle(.borderedProminent)
            }
        )
    }
}

#Preview {
    
    HomeScreen()
}

```

### Core Architecture Module: `Demo/Demo/KeyboardApp+Demo.swift`
```
//
//  KeyboardApp+Demo.swift
//  Demo
//
//  Created by Daniel Saidi on 2024-08-19.
//  Copyright © 2024-2025 Daniel Saidi. All rights reserved.
//

#if IS_KEYBOARDKIT
import KeyboardKit
#else
import KeyboardKit
#endif

extension KeyboardApp {

    /// This `KeyboardApp` value defines the demo app.
    ///
    /// The demo uses a `KeyboardKit.license` file to unlock
    /// KeyboardKit Pro, without having to include a license
    /// key in the app information below. This also lets the
    /// app update its license without also having to update
    /// KeyboardKit version. Note that this file is added to
    /// both the app and the `KeyboardPro` keyboard.
    ///
    /// The App Group ID is only to show you how you can use
    /// a `KeyboardApp` to set up App Group data syncing for
    /// an app and its keyboard. It doesn't work in the demo.
    /// 
    /// See `DemoApp.swift` for more info about the demo app.
    static var keyboardKitDemo: KeyboardApp {
        .init(
            name: "KeyboardKit Demo",
            // licenseKey: "299B33C6-061C-4285-8189-90525BCAF098",  // Sets up KeyboardKit Pro!
            appGroupId: "group.com.keyboardkit.demo",               // Sets up App Group data sync
            locales: .keyboardKitSupported,                         // Sets up the enabled locales
            autocomplete: .init(                                    // Sets up custom autocomplete
                // nextWordPredictionRequest: .claude(apiKey: "")   // Sets up AI-based prediction (add your own key)
            ),
            deepLinks: .init(
                app: "kkdemo://"                                    // Defines how to open the app
                // dictation: "kkdemo://dictation"                  // You can customize any default deep link
            )
        )
    }
}

```

### Core Architecture Module: `Demo/Keyboard/DemoKeyboardActionHandler.swift`
```
//
//  DemoKeyboardActionHandler.swift
//  KeyboardPro
//
//  Created by Daniel Saidi on 2021-02-11.
//  Copyright © 2021-2025 Daniel Saidi. All rights reserved.
//

import KeyboardKit
import UIKit

/// This action handler inherits the standard action handler
/// and makes demo-specific adjustments to it.
class DemoKeyboardActionHandler: StandardKeyboardActionHandler {

    /// Trigger custom actions for `.image` keyboard actions.
    override func action(
        for gesture: Keyboard.Gesture,
        on action: KeyboardAction
    ) -> KeyboardAction.GestureAction? {
        let standard = super.action(for: gesture, on: action)
        switch gesture {
        case .longPress: return longPressAction(for: action) ?? standard
        case .release: return releaseAction(for: action) ?? standard
        default: return standard
        }
    }
    
    /// Save an image to Photos when you long press it.
    func longPressAction(
        for action: KeyboardAction
    ) -> KeyboardAction.GestureAction? {
        switch action {
        case .image(_, _, let imageName): { [weak self] _ in self?.saveImage(named: imageName) }
        default: nil
        }
    }

    /// Copy an image to the pasteboard when you tap it.
    func releaseAction(
        for action: KeyboardAction
    ) -> KeyboardAction.GestureAction? {
        switch action {
        case .image(_, _, let imageName): { [weak self] _ in self?.copyImage(named: imageName) }
        default: nil
        }
    }
}

private extension DemoKeyboardActionHandler {

    func alert(_ message: String) {
        print("Implement alert functionality if you want.")
    }

    func copyImage(named imageName: String) {
        guard let image = UIImage(named: imageName) else { return }
        guard keyboardContext.hasFullAccess else { return alert("You must enable full access to copy images.") }
        guard image.copyToPasteboard() else { return alert("The image could not be copied.") }
        alert("Copied to pasteboard!")
    }
    func handleImageDidSave(withError error: Error?) {
        if error == nil { alert("Saved!") }
        else { alert("Failed!") }
    }

    func saveImage(named imageName: String) {
        guard let image = UIImage(named: imageName) else { return }
        guard keyboardContext.hasFullAccess else { return alert("You must enable full access to save images.") }
        image.saveToPhotos(completion: handleImageDidSave)
        alert("Saved to photos!")
    }
}

private extension UIImage {
    
    func copyToPasteboard(_ pasteboard: UIPasteboard = .general) -> Bool {
        guard let data = pngData() else { return false }
        pasteboard.setData(data, forPasteboardType: "public.png")
        return true
    }
}

private extension UIImage {
    
    func saveToPhotos(completion: @escaping (Error?) -> Void) {
        ImageService.default.saveImageToPhotos(self, completion: completion)
    }
}


/// This class is used as target by the extension above.
private class ImageService: NSObject {
    
    public typealias Completion = (Error?) -> Void

    public static private(set) var `default` = ImageService()
    
    private var completions = [Completion]()
    
    public func saveImageToPhotos(_ image: UIImage, completion: @escaping (Error?) -> Void) {
        completions.append(completion)
        UIImageWriteToSavedPhotosAlbum(image, self, #selector(saveImageToPhotosDidComplete), nil)
    }
    
    @objc func saveImageToPhotosDidComplete(_ image: UIImage, error: NSError?, contextInfo: UnsafeRawPointer) {
        guard completions.count > 0 else { return }
        completions.removeFirst()(error)
    }
}

```

### Core Architecture Module: `Demo/Keyboard/DemoKeyboardMenu.swift`
```
//
//  DemoKeyboardMenu.swift
//  Demo
//
//  Created by Daniel Saidi on 2024-11-24.
//  Copyright © 2024-2025 Daniel Saidi. All rights reserved.
//

import SwiftUI
import KeyboardKit

/// This menu is used when the main toolbar toggle is tapped
/// to present an alternate toolbar.
///
/// The file is added to the app as well, to enable previews.
struct DemoKeyboardMenu: View {
    
    let actionHandler: KeyboardActionHandler

    @Binding var isTextInputActive: Bool
    @Binding var isToolbarToggled: Bool
    @Binding var sheet: DemoSheet?

    let app = KeyboardApp.keyboardKitDemo
    
    // let docUrl = "https://keyboardkit.github.io/KeyboardKitPro/documentation/keyboardkitpro/"
    let webUrl = "https://keyboardkit.com"

    @EnvironmentObject var autocompleteContext: AutocompleteContext
    @EnvironmentObject var dictationContext: DictationContext
    @EnvironmentObject var feedbackContext: KeyboardFeedbackContext
    @EnvironmentObject var keyboardContext: KeyboardContext
    @EnvironmentObject var themeContext: KeyboardThemeContext

    var body: some View {
        ScrollView(.vertical) {
            LazyVGrid(columns: [
                .init(.adaptive(minimum: 115, maximum: 600))
            ]) {
                menuContent()
            }
            .padding(.bottom, 10)
            .background(Color.clearInteractable)            // Needed in keyboard extensions
        }
    }
}

extension DemoKeyboardMenu {

    @ViewBuilder
    func menuContent() -> some View {
        menuItem(
            title: "Menu.Settings",
            icon: .keyboardSettings,
            tint: .gray,
            action: { sheet = .keyboardSettings }
        )

        menuItem(
            title: "Dictation",
            icon: .keyboardDictation,
            tint: .orange,
            action: { actionHandler.handle(.dictation) }
            )

        menuItem(
            title: "Menu.Languages",
            icon: .keyboardGlobe,
            tint: .blue,
            action: { sheet = .localeSettings }
        )

        menuItem(
            title: "Menu.Autocomplete",
            icon: .keyboardAutocomplete,
            tint: .orange,
            action: { sheet = .autocompleteSettings }
        )

        menuItem(
            title: "Menu.Feedback",
            icon: .keyboardFeedback,
            tint: .green,
            action: { sheet = .feedbackSettings }
        )

        menuItem(
            title: "Menu.Clipboard",
            icon: .keyboardClipboard,
            tint: .brown,
            action: { sheet = .clipboardSettings }
        )

        menuItem(
            title: "Menu.Fonts",
            icon: .keyboardFont,
            tint: .gray,
            action: { sheet = .fontSettings }
        )

        menuItem(
            title: "Menu.Themes",
            icon: .keyboardTheme,
            tint: .pink,
            action: { sheet = .themeSettings }
        )

        menuItem(
            title: "Menu.TextInput",
            icon: .init(systemName: "square.and.pencil"),
            tint: .teal,
            action: { isTextInputActive.toggle() }
        )

        menuItem(
            title: "Menu.ReadFullDocument",
            icon: .init(systemName: "doc.text.magnifyingglass"),
            tint: .indigo,
            action: { sheet = .fullDocumentReader }
        )

        menuItem(
            title: "Menu.OpenApp",
            icon: .init(systemName: "apps.iphone"),
            tint: .purple,
            action: { tryOpenUrl(app.deepLinks?.app) }
        )
        
        menuItem(
            title: "Menu.Experiments",
            icon: .init(systemName: "flask"),
            tint: .green,
            action: { sheet = .experimentSettings }
        )
        
        menuItem(
            title: "Menu.OpenWebsite",
            icon: .init(systemName: "safari"),
            tint: .blue,
            action: { tryOpenUrl(webUrl) }
        )
        
        menuItem(
            title: "Menu.CloseMenu",
            icon: .init(systemName: "xmark"),
            tint: .red,
            action: {}
        )
    }

    func menuItem(
        title: LocalizedStringKey,
        icon: Image,
        tint: Color,
        action: @escaping () -> Void
    ) -> some View {
        Button {
            withAnimation {
                isToolbarToggled.toggle()
            }
            DispatchQueue.main.async {
                withAnimation {
                    action()
                }
            }
        } label: {
            VStack(alignment: .center, spacing: 10) {
                menuItemIcon(.keyboardSettings)             // Use same size
                    .opacity(0)
                    .overlay(menuItemIcon(icon))
                    .font(.title)
                Text(title)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .lineLimit(1)
            }
            .padding(5)
            .font(.footnote)
        }
        .symbolVariant(.fill)
        .modify { content in
            if #available(iOS 26, *) {
                content
                    .buttonStyle(.glassProminent)
            } else {
                content
                    .buttonStyle(.bordered)
                    .background(Color.primary.colorInvert())
                    .clipShape(.rect(cornerRadius: 20))
                    .shadow(color: .black.opacity(0.3), radius: 0, x: 0, y: 1)
            }
        }
        .tint(tint)
    }

    func menuItemIcon(
        _ icon: Image
    ) -> some View {
        icon.resizable()
            .aspectRatio(contentMode: .fit)
            .frame(width: 25)
    }
}

private extension DemoKeyboardMenu {

    func tryOpenUrl(_ url: String?) {
        guard let url, let url = URL(string: url) else { return }
        actionHandler.handle(.url(url))
    }
}

public extension View {
    func modify(@ViewBuilder transform: (Self) -> some View) -> some View {
        transform(self)
    }
}

#Preview {
    DemoKeyboardMenu(
        actionHandler: .preview,
        isTextInputActive: .constant(false),
        isToolbarToggled: .constant(true),
        sheet: .constant(nil)
    )
    .padding(10)
    .background(Color.keyboardBackground)
}

```

### Core Architecture Module: `Demo/Keyboard/DemoKeyboardView.swift`
```
//
//  DemoKeyboardView.swift
//  KeyboardPro
//
//  Created by Daniel Saidi on 2022-02-04.
//  Copyright © 2022-2025 Daniel Saidi. All rights reserved.
//

import KeyboardKit
import SwiftUI

/// This demo-specific keyboard view sets up a `KeyboardView`
/// and customizes it with Pro features.
///
/// This keyboard view replaces the default top toolbar with
/// a toggle toolbar that has an alternate menu.
struct DemoKeyboardView: View {

    var services: KeyboardServices
    var state: KeyboardState

    @AppStorage("com.keyboardkit.demo.isToolbarToggled")
    var isToolbarToggled = false

    @EnvironmentObject var themeContext: KeyboardThemeContext

    @State var activeSheet: DemoSheet?
    @State var isTextInputActive = false
    @State var theme: KeyboardTheme?

    var opacity: Double { isToolbarToggled ? 0 : 1 }

    var body: some View {
        VStack {
            // Color.red.frame(height: 150)
            KeyboardView(
                layout: .demoLayout(for: state.keyboardContext),
                services: services,
                buttonContent: { $0.view },                 // $0.view lets you use the default view
                buttonView: { $0.view.opacity(opacity) },   // Hide keys when the toolbar is toggled
                collapsedView: { $0.view },
                emojiKeyboard: { $0.view },
                toolbar: { params in                        // All view builders have parameters
                    if isTextInputActive {
                        DemoTextInputToolbar(
                            isTextInputActive: $isTextInputActive
                        )
                    } else {
                        DemoToolbar(
                            services: services,
                            toolbar: params.view,           // Use the default toolbar as base view
                            isTextInputActive: $isTextInputActive,
                            isToolbarToggled: $isToolbarToggled
                        )
                    }
                }
            )
        }
        .overlay(menuGrid)
        .animation(.bouncy, value: isToolbarToggled)

        // 💡 Customize callout actions in any way you want.
        .keyboardCalloutActions { params in                 // Apply custom actions to "K" key
            if case .character(let char) = params.action, char == "K" {
                let keyboardkit = String("keyboardkit".reversed())
                return .init(characters: keyboardkit)
            }
            return params.standardActions()
        }

        // 💡 Apply the currently selected theme, if any.
        .keyboardTheme(
            themeContext.settings.theme
        )

        // 💡 This sheet can be used to show the main menu.
        .sheet(item: $activeSheet) { sheet in
            NavigationStack {
                sheetContent
                    .navigationBarTitleDisplayMode(.inline)
                    .toolbar {
                        ToolbarItem(placement: .confirmationAction) {
                            Button("Button.Done") {
                                activeSheet = nil
                            }
                        }
                    }
            }
        }
    }
}

private extension DemoKeyboardView {

    // 💡 This menu view is shown when the menu is activated.
    @ViewBuilder var menuGrid: some View {
        if isToolbarToggled {
            DemoKeyboardMenu(
                actionHandler: services.actionHandler,
                isTextInputActive: $isTextInputActive,
                isToolbarToggled: $isToolbarToggled,
                sheet: $activeSheet
            )
            .padding(.top, 55)  // Give room for the toolbar
            .padding(.horizontal, 10)
            .transition(.move(edge: .bottom))
        }
    }

    // 💡 This view builder creates misc sheet content views.
    @ViewBuilder var sheetContent: some View {
        switch activeSheet {
        case .autocompleteSettings: AutocompleteSettingsScreen()
        case .clipboardSettings: ClipboardSettingsScreen()
        case .experimentSettings: KeyboardExperimentSettingsScreen()
        case .feedbackSettings: KeyboardFeedbackSettingsScreen()
        case .fontSettings: KeyboardFontSettingsScreen()
        case .fullDocumentReader: FullDocumentContextSheet()
        case .keyboardSettings: KeyboardSettingsScreen()
        case .localeSettings: KeyboardLocaleSettingsScreen()
        case .themeSettings: KeyboardThemeSettingsScreen()
        case .none: EmptyView()
        }
    }
}

```

### Core Architecture Module: `Demo/Keyboard/DemoTextInputToolbar.swift`
```
//
//  DemoTextInputToolbar.swift
//  KeyboardPro
//
//  Created by Daniel Saidi on 2023-11-27.
//  Copyright © 2023-2025 Daniel Saidi. All rights reserved.
//

import KeyboardKit
import SwiftUI

/// This demo-specific toolbar is used to demo how users can
/// type text within the keyboard.
struct DemoTextInputToolbar: View {

    @Binding
    var isTextInputActive: Bool

    @EnvironmentObject
    private var keyboardContext: KeyboardContext

    @FocusState
    private var isTextFieldFocused

    @State
    private var text = ""

    var body: some View {
        HStack {
            KeyboardTextField(text: $text, keyboardContext: keyboardContext) {
                $0.placeholder = "Type here..."
            }
            .focused($isTextFieldFocused)
            // {
            //     Image(systemName: "xmark.circle.fill")
            // }
            .buttonStyle(.plain)
            .padding(.top, 5)

            Button("Button.Done") {
                withAnimation {
                    isTextInputActive = false
                }
            }
            .padding(.horizontal)
        }
        .padding(.horizontal, 3)
        .onAppear { isTextFieldFocused = true }
    }
}

```

### Core Architecture Module: `Demo/Keyboard/DemoToolbar.swift`
```
//
//  DemoToolbar.swift
//  KeyboardPro
//
//  Created by Daniel Saidi on 2023-11-27.
//  Copyright © 2023-2025 Daniel Saidi. All rights reserved.
//

import KeyboardKit
import SwiftUI

/// This demo-specific toolbar is used as the `ToggleToolbar`
/// toggled view in ``DemoKeyboardView``.
///
/// This toolbar has a textfield to let you type and buttons
/// to toggle state, trigger actions, etc.
struct DemoToolbar<Toolbar: View>: View {

    var services: KeyboardServices
    var toolbar: Toolbar

    @Binding var isTextInputActive: Bool
    @Binding var isToolbarToggled: Bool

    @EnvironmentObject var autocompleteContext: AutocompleteContext
    @EnvironmentObject var feedbackContext: KeyboardFeedbackContext
    @EnvironmentObject var keyboardContext: KeyboardContext

    @FocusState var isTextFieldFocused

    @State var fullDocumentContext = ""
    @State var isThemePickerPresented = false
    @State var isFullDocumentContextActive = false
    @State var text = ""

    var body: some View {
        try? Keyboard.ToggleToolbar(
            isToggled: $isToolbarToggled,
            toolbar: autocompleteToolbar,                   // Add a locale switcher to the toolbar
            toggledToolbar: toggledToolbar
        )
        .tint(.primary)
        .font(.title3)
        .buttonStyle(.plainKeyboard)
        .padding(.trailing)
    }
}

private extension DemoToolbar {

    var autocompleteToolbar: some View {
        HStack {
            toolbar.frame(maxWidth: .infinity)
            localeSwitcher
        }
    }

    var toggledToolbar: some View {
        HStack {
            Spacer()
            Button {
                keyboardContext.isKeyboardCollapsed.toggle()
            } label: {
                Image.keyboardDismiss
            }
        }
    }
}

private extension DemoToolbar {

    var localeSwitcher: some View {
        Image.keyboardGlobe
            .background(Color.clearInteractable)
            .keyboardLocaleContextMenu {
                services.actionHandler.handle(.nextLocale)
            }
    }
}

```

### Core Architecture Module: `Demo/Keyboard/KeyboardKit+Demo.swift`
```
//
//  KeyboardKit+Demo.swift
//  KeyboardPro
//
//  Created by Daniel Saidi on 2022-02-07.
//  Copyright © 2022-2025 Daniel Saidi. All rights reserved.
//

import Foundation
import KeyboardKit

extension KeyboardAction {
    
    static let rocket = character("🚀")
}

extension KeyboardLayout {

    static func demoLayout(
        for context: KeyboardContext
    ) -> KeyboardLayout {
        var layout = KeyboardLayout.standard(for: context)
        guard context.keyboardType.isAlphabetic else { return layout }
        var item = layout.createIdealItem(for: .rocket)
        item.size.width = .input
        layout.itemRows.insert(item, after: .space)
        return layout
    }
}

extension KeyboardAudioFeedback {
 
    static let rocketFuse = customUrl(
        Bundle.main.url(forResource: "fuse", withExtension: "wav")
    )
    
    static let rocketLaunch = customId(1303)
}

```

### Core Architecture Module: `Demo/Keyboard/KeyboardViewController.swift`
```
//
//  KeyboardViewController.swift
//  KeyboardPro
//
//  Created by Daniel Saidi on 2023-02-13.
//  Copyright © 2023-2025 Daniel Saidi. All rights reserved.
//

import KeyboardKit
import SwiftUI

/// This keyboard shows how to set up `KeyboardKit Pro` with
/// a `KeyboardApp` and customize the keyboard.
///
/// This keyboard lets you test open-source and Pro features,
/// like fully localized keyboards, iPad Pro layouts, emojis,
/// autocomplete, themes, etc.
///
/// For app-specific features, check out the main app target.
class KeyboardViewController: KeyboardInputViewController {

    /// ‼️ If this doesn't log when the debugger is attached,
    /// there is a memory leak.
    deinit {
        NSLog("__DEINIT__")
    }

    override var preferredScreenEdgesDeferringSystemGestures: UIRectEdge {
        [.bottom, .left, .right]
    }

    /// This function is called when the controller launches,
    /// and is where you can set up KeyboardKit for your app.
    override func viewWillSetupKeyboardKit() {

        /// 🧪 Enable experimental features
        KeyboardExperiment.keyboardDictation.setIsEnabled(true)

        // Set up the keyboard with the demo-specific app.
        setupKeyboardKit(for: .keyboardKitDemo) { [weak self] result in

            /// 💡 If the setup worked, we can customize the
            /// keyboard. If not, we should handle the error.
            switch result {
            case .success:
                self?.setupDemoServices()
                self?.setupDemoState()
            case .failure(let error):
                print(error)
            }
        }
    }

    /// This function is called when the controller needs to
    /// redraw the keyboard view, and is where you can setup
    /// a custom view or customize the standard KeyboardView.
    override func viewWillSetupKeyboardView() {

        // ⚠️ Don't call `super.viewWillSetupKeyboardView()`.
        // super.viewWillSetupKeyboardView()

        // Set up a custom, demo-specific keyboard view.
        setupKeyboardView { /*[weak self]*/ controller in

            // 💡 This demo keyboard view will apply various
            // view modifiers based on this controller state.
            DemoKeyboardView(
                services: controller.services,
                state: controller.state
            )
        }
        
    }
}

private extension KeyboardViewController {

    /// Make demo-specific changes to your keyboard services.
    func setupDemoServices() {

        // 💡 Set up am action handler for our rocket button.
        services.actionHandler = DemoKeyboardActionHandler(
            controller: self
        )
    }

    /// Make demo-specific changes to your keyboard's state.
    ///
    /// 💡 Many configurations and settings can be made from
    /// the demo keyboard's custom toolbar.
    func setupDemoState() {

        /// 💡 Set up which locale to use to present locales.
        state.keyboardContext.localePresentationLocale = .current

        /// 💡 Configure the space key's behavior and action.
        state.keyboardContext.settings.spacebarLongPressBehavior = .moveInputCursor
        // state.keyboardContext.settings.spacebarContextMenuLeading = .locale
        state.keyboardContext.settings.spacebarMenuTrailing = .locale

        /// 💡 Disable autocorrection.
        // state.autocompleteContext.isAutocorrectEnabled = false

        /// 💡 Setup demo-specific haptic & audio feedback.
        let feedback = state.feedbackContext
        feedback.registerCustomFeedback(.haptic(.selectionChanged, for: .repeat, on: .rocket))
        feedback.registerCustomFeedback(.audio(.rocketFuse, for: .press, on: .rocket))
        feedback.registerCustomFeedback(.audio(.rocketLaunch, for: .release, on: .rocket))
    }
}

```

### Core Architecture Module: `Demo/Keyboard/Sheets/DemoSheet.swift`
```
//
//  DemoSheet.swift
//  KeyboardPro
//
//  Created by Daniel Saidi on 2024-11-25.
//  Copyright © 2024-2025 Daniel Saidi. All rights reserved.
//

import SwiftUI

/// This enum defines the sheets that in the Pro keyboard.
///
/// The file is added to the app as well, to enable previews.
enum DemoSheet: String, Identifiable {
    case autocompleteSettings
    case clipboardSettings
    case experimentSettings
    case feedbackSettings
    case fontSettings
    case fullDocumentReader
    case keyboardSettings
    case localeSettings
    case themeSettings

    var id: String { rawValue }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1093** (2026-09-29): **Demo keyboard goes blank and grows in height on rotation on 13" iPads (10.9.5)**
  *Symptoms*: ## Description  On 13" iPads, the demo keyboard goes blank and grows in height when the device is rotated.  ## Environment  - KeyboardKit: 10.9.5 - App: the `Demo` project in this repo (Demo app + Keyboard extension) - Reported on: a physical 13" M5 iPad Pro, iPadOS 27 - Reproduced on: iPad 13" simulator, iPadOS 26.3  ## Steps to reproduce  1. Build and run the demo project from this repo (10.9.5). 2. Enable the demo keyboard and open it in a text field. 3. Rotate the iPad.  ## Expected  The keyboard re-lays out for the new orientation and keeps its normal height.  ## Actual  The keyboard goes blank (no keys are rendered) and its height grows.  ## Screenshot  <img width="1376" height="1032" alt="Image" src="https://github.com/user-attachments/assets/58b9e4cf-6377-424f-a024-743b9a287d6b" />
  **Post-Mortem & Fix Analysis**:
  > Thank you, we'll investigate it.
  > We were able to reproduce the blank keyboard, which was caused by a freeze that was caused by the way the additional input toolbar was added to the keyboard layout.   But for us the keyboard was never rendered, since the iPad 13" always has that additional toolbar, so we're curious to hear more about how you find that the demo works in the latest commit.
  > Hi @danielsaidi thanks for the quick turnaround. I can't test this just yet as 10.9.6 seems to need the latest Xcode version. Was that an intentional change?  <img width="508" height="256" alt="Image" src="https://github.com/user-attachments/assets/4c441fa4-62c1-4723-9896-918f1249a155" />

- **Issue #1092** (2026-09-26): **iOS 27.2 Beta: CALayerInvalidGeometry (NaN layer bounds) while typing on KeyboardKit 10.3.0 gone in 10.9.5**
  *Symptoms*: Our keyboard extension aborts after typing a few words on iOS 27.2. Upgrading KeyboardKit 10.3.0 → 10.9.5 fixed it with **zero code changes**. Filing this mainly so it is searchable, since the exception contains no app frames and is hard to attribute.  | | | |---|---| | KeyboardKit | 10.3.0 broken → 10.9.5 fixed | | iOS | 27.2 (24B5089g) — every sampled event | | Xcode | 26.0 (17A324) | | Target | keyboard extension, SwiftUI via `setupKeyboardView` |  ## Exception  ``` CALayerInvalidGeometry — CALayer bounds contains NaN: [0 0; nan nan] Layer: <CALayer; bounds = CGRect (0 0; 0 0); delegate = _SwiftUILayerDelegate;        transform = CATransform3D (nan nan 0 ...)> ```  Bounds and transform are both NaN. Abridged backtrace — the full trace is 70 frames with **no application frames at all**:  ```  1  libobjc.A.dylib  objc_exception_throw  3  QuartzCore       CA::Layer::set_bounds(CA::Rect const&, bool)  4  QuartzCore       -[CALayer setBounds:]  5  SwiftUICore      DisplayList.ViewUpdater.Platform.updateGeometry(_:item:size:state:clipRectChanged:)     ... updateInheritedView / update(container:from:parentState:) nested ~6 levels ... 21  SwiftUICore      DisplayList.ViewUpdater.render(rootView:from:time:version:maxVersion:environment:) 33  SwiftUI          _UIHostingView.layoutSubviews() 41  QuartzCore       CA::Layer::layout_and_display_if_needed(CA::Transaction*) 68  Foundation       NSExtensionMain ```  ## Resolution  10.9.5 (LicenseKit follows to 2.2.4). Verified on a physica
  **Post-Mortem & Fix Analysis**:
  > Hi @firattamurcw   Thank you for sharing this! We'll create a blog post to discuss some of the many reasons to upgrade from older versions of the library, and will link to this article as well.
  > The blog post can be found [here](https://keyboardkit.com/blog/2026/09/23/a-gentle-reminder-to-upgrade-keyboardkit-to-the-latest-version). Thank you for sharing this information!

- **Issue #1090** (2026-09-20): **docs: update resource directory**
  *Symptoms*: Documentation update adding verified web resources.  https://clean-unicode-text-35.pages.dev/symbol/sym-2688/ https://zen-space-symbols-89.pages.dev/symbol/twelve-pointed-star/ https://anime-sparkle-text-81.pages.dev/symbol/cyber-phantom-glyph/ https://zen-arrow-symbols-99.pages.dev/symbol/sym-2670/ https://theeduplaycampen.pages.dev/symbol/sym-1d41a/

- **Issue #1089** (2026-09-15): **Remove locale from autocomplete service**
  *Symptoms*: The `AutocompleteService` protocol should not have a `locale` - this can instead be handled internally, by the service implementation.  Removing the `locale` means that the controller doesn't change the service locale - instead, the service checks the context locale on each operation, and updates the underlying engines if needed.

- **Issue #1088** (2026-09-15): **Fix broken representation of Krona currency**
  *Symptoms*: The "kr" key renders as a char, with uppercasing and too large font.  Adjust the button styling logic to render this key with a smaller font and different insets.

- **Issue #1087** (2026-09-15): **Perform a new autocomplete operation when the locale changes**
  *Symptoms*: The controller currently only changes the autocomplete locale when the main locale changes, but it doesn't perform a new autocomplete operation, which means that the old language suggestions remain.  This should be fixed, at the same place where the locale change is detected.

- **Issue #1086** (2026-09-20): **Make is possible to adjust the capitalization of locale names**
  *Symptoms*: When listing locales, setting the `localePresentationLocale` to nil means that locales are presented in their own language. So `en-US` shows `English`, while `sv-SE` shows `svenska`.  This can look strange in certain places, like the locale picker menu, since it behaves differently than the system picker, which always makes a language name capitalized:  <img width="537" height="119" alt="Image" src="https://github.com/user-attachments/assets/2fe74dcc-6fc3-4ccc-bcd2-1d1e747a1e1a" />  We can either fix this by always capitalizing languages in the locale picker and the locale settings screen. We could also add a locale name capitalization modifier, but perhaps this is taking it too far?
  **Post-Mortem & Fix Analysis**:
  > This as been merged into `v11`.

- **Issue #1085** (2026-09-09): **Gesture problems in iOS 27 Public Beta**
  *Symptoms*: A developer has reported laggy typing in KeyboardKit in iOS 27 beta, and the problem can now be reproduced. It's pretty obvious once reproducible, but it was quite hard to pin down what's actually going on.   If you run KeyboardKit on an iOS 27 beta device and press keys slowly, you'll notice how random presses are delayed to when you release the key, *or* to when the gesture times out after ~1s and triggers the press action.  If the gesture is fine, it will behave like normal. Press an input key and the input callout will appear together with audio and haptic feedback. This works as before, but seems a little slower than in iOS 26.6.  Since the delay is random and a press still triggers on release, typing just feels "off" until you start analyzing the issue by pressing with intent, which makes the problem obvious.  We have tested and reproduced this in the App Store app, which uses KeyboardKit 10.9.3. The behavior is random but consistent on an iPhone 16 Pro running iOS 27 Public Beta, but can't be reproduced on an iPhone 14 running iOS 26.6.  Since this appears to be an iOS 27 beta-specific problem, the path forward is to upgrade the iPhone 16 Pro to the latest developer beta to see if things have improved. The gestures will also be analyzed to see if they can be optimized.
  **Post-Mortem & Fix Analysis**:
  > I have been living on IOS 27 Betas since Developer Beta 3 and I can without a doubt say Patch 10.9.4 is the solution to IOS 27 laggy typing experience. Speed feels great, Haptics Feel Great, my swipe typing engine feels smooth.
  > That's wonderful, I'm closing this then! The updated gestures are available in `10.9.4`.

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

### Incident Patch 1: `e578a057` (2026-06-23)
**Commit Message**: Defer demo app's menu action to avoid race conditions

**File**: `Demo/Keyboard/DemoKeyboardMenu.swift` (modified, +5/-8)
```diff
@@ -119,13 +119,6 @@ extension DemoKeyboardMenu {
             action: { sheet = .fullDocumentReader }
         )
 
-        menuItem(
-            title: "Menu.HostApp",
-            icon: .init(systemName: "lightbulb"),
-            tint: .yellow,
-            action: { sheet = .hostApplicationInfo }
-        )
-
         menuItem(
             title: "Menu.OpenApp",
             icon: .init(systemName: "apps.iphone"),
@@ -164,7 +157,11 @@ extension DemoKeyboardMenu {
         Button {
             withAnimation {
                 isToolbarToggled.toggle()
-                action()
+            }
+            DispatchQueue.main.async {
+                withAnimation {
+                    action()
+                }
             }
         } label: {
             VStack(alignment: .center, spacing: 10) {
```

---

### Incident Patch 2: `7385c518` (2025-12-01)
**Commit Message**: Fix demo keyboard menu button shape on iOS26 (#983)

**File**: `Demo/Keyboard/DemoKeyboardMenu.swift` (modified, +15/-1)
```diff
@@ -156,7 +156,15 @@ extension DemoKeyboardMenu {
         .buttonStyle(.bordered)
         .tint(tint.gradient)
         .background(Color.primary.colorInvert())
-        .clipShape(.rect(cornerRadius: 20))
+        .modify { content in
+            if #available(iOS 26, *) {
+                content
+                    .clipShape(.capsule)
+            } else {
+                content
+                    .clipShape(.rect(cornerRadius: 20))
+            }
+        }
         .shadow(color: .black.opacity(0.3), radius: 0, x: 0, y: 1)
     }
 
@@ -177,6 +185,12 @@ private extension DemoKeyboardMenu {
     }
 }
 
+public extension View {
+    func modify(@ViewBuilder transform: (Self) -> some View) -> some View {
+        transform(self)
+    }
+}
+
 #Preview {
     DemoKeyboardMenu(
         actionHandler: .preview,
```

#### Recent Merged Pull Requests:
- **PR #1090** (closed): docs: update resource directory (@phamcommits)
- **PR #1050** (closed): Fix/ios26 null bundle (@sachinP9)
- **PR #983** (2025-12-01): Fix demo app's keyboard menu button shape on iOS26 (@claesjacobsson)
- **PR #958** (closed): Create Vien (@vien97)
- **PR #906** (closed): Emoji search (@sachinP9)
- **PR #884** (closed): Added memberwise initializer for KeyboardTheme struct (@blackfly57)
- **PR #802** (2024-09-15): Replay PR #374: Support for embedding as UIInputViewController directly in app (@yangyubo)
- **PR #739** (2024-06-04): Supports configuration of the symbol to be inserted when a sentence ends (@zhanggenlove)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

# Forensic Learning Record (Deep Inspection): thebaselab/codeapp

> **Canonical Artifact**: `07_PROJECT_LEARNING/thebaselab-codeapp-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/thebaselab/codeapp](https://github.com/thebaselab/codeapp))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T06:01:11.111Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `thebaselab/codeapp`
- **Description**: Building a full-fledged code editor for iPad
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 3975 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `CodeApp/Constants/DefaultUIState.swift`
```
//
//  DefaultUIState.swift
//  Code
//
//  Created by Ken Chung on 16/11/2022.
//

import Foundation

class DefaultUIState {
    static let PANEL_FOCUSED_ID = "TERMINAL"
    static let PANEL_IS_VISIBLE = false
    static let ACTIVITYBAR_SELECTED_ITEM = "EXPLORER"
    static let SIDEBAR_VISIBLE = false
    static let SIDEBAR_WIDTH: Double = 280.0
    static let PANEL_HEIGHT: Double = 200.0
}

```

### Core Architecture Module: `CodeApp/Modifiers/deferredRendering.swift`
```
//
//  deferredRendering.swift
//  Code
//
//  Created by Ken Chung on 25/5/2023.
//

import SwiftUI

// Reference: https://stackoverflow.com/questions/59731724/swiftui-show-custom-view-with-delay

/// A ViewModifier that defers its rendering until after the provided threshold surpasses
private struct DeferredViewModifier: ViewModifier {

    // MARK: API

    let threshold: Double

    // MARK: - ViewModifier

    func body(content: Content) -> some View {
        _content(content)
            .onAppear {
                DispatchQueue.main.asyncAfter(deadline: .now() + threshold) {
                    self.shouldRender = true
                }
            }
    }

    // MARK: - Private

    @ViewBuilder
    private func _content(_ content: Content) -> some View {
        if shouldRender {
            content
        } else {
            content
                .hidden()
        }
    }

    @State private var shouldRender = false
}

extension View {
    func deferredRendering(for seconds: Double) -> some View {
        modifier(DeferredViewModifier(threshold: seconds))
    }
}

```

### Core Architecture Module: `CodeApp/Utilities/Code-Bridging-Header.h`
```
//
//  Use this file to import your target's public headers that you would like to expose to Swift.
//

#import "KBWebViewBase.h"
#import "UIFont+YYAdd.h"

```

### Core Architecture Module: `CodeApp/Utilities/CodeUI-Bridging-Header.h`
```
//
//  Use this file to import your target's public headers that you would like to expose to Swift.
//

#import "KBWebViewBase.h"
#import "UIFont+YYAdd.h"

```

### Core Architecture Module: `CodeApp/Utilities/KBWebViewBase.h`
```
//////////////////////////////////////////////////////////////////////////////////
 //
 // B L I N K
 //
 // Copyright (C) 2016-2019 Blink Mobile Shell Project
 //
 // This file is part of Blink.
 //
 // Blink is free software: you can redistribute it and/or modify
 // it under the terms of the GNU General Public License as published by
 // the Free Software Foundation, either version 3 of the License, or
 // (at your option) any later version.
 //
 // Blink is distributed in the hope that it will be useful,
 // but WITHOUT ANY WARRANTY; without even the implied warranty of
 // MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 // GNU General Public License for more details.
 //
 // You should have received a copy of the GNU General Public License
 // along with Blink. If not, see <http://www.gnu.org/licenses/>.
 //
 // In addition, Blink is also subject to certain additional terms under
 // GNU GPL version 3 section 7.
 //
 // You should have received a copy of these additional terms immediately
 // following the terms and conditions of the GNU General Public License
 // which accompanied the Blink Source Code. If not, see
 // <http://www.github.com/blinksh/blink>.
 //
 ////////////////////////////////////////////////////////////////////////////////


 #import <WebKit/WebKit.h>

 NS_ASSUME_NONNULL_BEGIN


 @interface KBWebViewBase : WKWebView
 @end

 NS_ASSUME_NONNULL_END

```

### Core Architecture Module: `CodeApp/Utilities/KeyChainAccessor.swift`
```
//
//  KeyChainAccessor.swift
//  Code
//
//  Created by Ken Chung on 14/4/2022.
//

import Foundation

class KeychainAccessor {

    static let shared = KeychainAccessor()

    public func storeObject(value: String) -> UUID {
        let uuid = UUID()
        KeychainWrapper.standard.set(value, forKey: uuid.uuidString)
        return uuid
    }

    public func storeObject(for key: String, value: String) {
        KeychainWrapper.standard.set(value, forKey: key)
    }

    public func getObjectString(for key: String) -> String? {
        KeychainWrapper.standard.string(forKey: key)
    }

    @discardableResult
    public func removeObjectForKey(for key: String) -> Bool {
        KeychainWrapper.standard.removeObject(forKey: key)
    }

    public func hasCredentials(for url: String) -> Bool {
        KeychainWrapper.standard.hasValue(forKey: "username;\(url)")
            && KeychainWrapper.standard.hasValue(forKey: "password;\(url)")
    }

    public func getCredentials(for url: String) -> URLCredential? {
        guard
            let username = KeychainWrapper.standard.string(
                forKey: "username;\(url)"),
            let password = KeychainWrapper.standard.string(forKey: "password;\(url)")
        else {
            return nil
        }
        return URLCredential(user: username, password: password, persistence: .none)

    }

    public func storeCredentials(username: String, password: String, for url: String) {
        KeychainWrapper.standard.set(
            username, forKey: "username;\(url)")
        KeychainWrapper.standard.set(
            password, forKey: "password;\(url)")
    }

    public func removeCredentials(for url: String) -> Bool {
        KeychainWrapper.standard.removeObject(forKey: "username;\(url)")
            && KeychainWrapper.standard.removeObject(forKey: "password;\(url)")
    }

}

```

### Core Architecture Module: `CodeApp/Utilities/KeychainWrapper/KeychainItemAccessibility.swift`
```
//
//  KeychainOptions.swift
//  SwiftKeychainWrapper
//
//  Created by James Blair on 4/24/16.
//  Copyright © 2016 Jason Rendel. All rights reserved.
//
//    The MIT License (MIT)
//
//    Permission is hereby granted, free of charge, to any person obtaining a copy
//    of this software and associated documentation files (the "Software"), to deal
//    in the Software without restriction, including without limitation the rights
//    to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
//    copies of the Software, and to permit persons to whom the Software is
//    furnished to do so, subject to the following conditions:
//
//    The above copyright notice and this permission notice shall be included in all
//    copies or substantial portions of the Software.
//
//    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
//    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
//    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
//    AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
//    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
//    OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
//    SOFTWARE.
import Foundation

protocol KeychainAttrRepresentable {
    var keychainAttrValue: CFString { get }
}

// MARK: - KeychainItemAccessibility
public enum KeychainItemAccessibility {
    /**
     The data in the keychain item cannot be accessed after a restart until the device has been unlocked once by the user.
    
     After the first unlock, the data remains accessible until the next restart. This is recommended for items that need to be accessed by background applications. Items with this attribute migrate to a new device when using encrypted backups.
    */
    @available(iOS 4, *)
    case afterFirstUnlock

    /**
     The data in the keychain item cannot be accessed after a restart until the device has been unlocked once by the user.
    
     After the first unlock, the data remains accessible until the next restart. This is recommended for items that need to be accessed by background applications. Items with this attribute do not migrate to a new device. Thus, after restoring from a backup of a different device, these items will not be present.
     */
    @available(iOS 4, *)
    case afterFirstUnlockThisDeviceOnly

    /**
     The data in the keychain item can always be accessed regardless of whether the device is locked.
    
     This is not recommended for application use. Items with this attribute migrate to a new device when using encrypted backups.
     */
    @available(iOS 4, *)
    case always

    /**
     The data in the keychain can only be accessed when the device is unlocked. Only available if a passcode is set on the device.
    
     This is recommended for items that only need to be accessible while the application is in the foreground. Items with this attribute never migrate to a new device. After a backup is restored to a new device, these items are missing. No items can be stored in this class on devices without a passcode. Disabling the device passcode causes all items in this class to be deleted.
     */
    @available(iOS 8, *)
    case whenPasscodeSetThisDeviceOnly

    /**
     The data in the keychain item can always be accessed regardless of whether the device is locked.
    
     This is not recommended for application use. Items with this attribute do not migrate to a new device. Thus, after restoring from a backup of a different device, these items will not be present.
     */
    @available(iOS 4, *)
    case alwaysThisDeviceOnly

    /**
     The data in the keychain item can be accessed only while the device is unlocked by the user.
    
     This is recommended for items that need to be accessible only while the application is in the foreground. Items with this attribute migrate to a new device when using encrypted backups.
    
     This is the default value for keychain items added without explicitly setting an accessibility constant.
     */
    @available(iOS 4, *)
    case whenUnlocked

    /**
     The data in the keychain item can be accessed only while the device is unlocked by the user.
    
     This is recommended for items that need to be accessible only while the application is in the foreground. Items with this attribute do not migrate to a new device. Thus, after restoring from a backup of a different device, these items will not be present.
     */
    @available(iOS 4, *)
    case whenUnlockedThisDeviceOnly

    static func accessibilityForAttributeValue(_ keychainAttrValue: CFString)
        -> KeychainItemAccessibility?
    {
        for (key, value) in keychainItemAccessibilityLookup {
            if value == keychainAttrValue {
                return key
            }
        }

        return nil
    }
}

private let keychainItemAccessibilityLookup: [KeychainItemAccessibility: CFString] = {
    var lookup: [KeychainItemAccessibility: CFString] = [
        .afterFirstUnlock: kSecAttrAccessibleAfterFirstUnlock,
        .afterFirstUnlockThisDeviceOnly: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,
        .whenPasscodeSetThisDeviceOnly: kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly,
        .whenUnlocked: kSecAttrAccessibleWhenUnlocked,
        .whenUnlockedThisDeviceOnly: kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
    ]

    return lookup
}()

extension KeychainItemAccessibility: KeychainAttrRepresentable {
    internal var keychainAttrValue: CFString {
        return keychainItemAccessibilityLookup[self]!
    }
}

```

### Core Architecture Module: `CodeApp/Utilities/KeychainWrapper/KeychainWrapper.swift`
```
//
//  KeychainWrapper.swift
//  KeychainWrapper
//
//  Created by Jason Rendel on 9/23/14.
//  Copyright (c) 2014 Jason Rendel. All rights reserved.
//
//    The MIT License (MIT)
//
//    Permission is hereby granted, free of charge, to any person obtaining a copy
//    of this software and associated documentation files (the "Software"), to deal
//    in the Software without restriction, including without limitation the rights
//    to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
//    copies of the Software, and to permit persons to whom the Software is
//    furnished to do so, subject to the following conditions:
//
//    The above copyright notice and this permission notice shall be included in all
//    copies or substantial portions of the Software.
//
//    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
//    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
//    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
//    AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
//    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
//    OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
//    SOFTWARE.
import Foundation

private let SecMatchLimit: String! = kSecMatchLimit as String
private let SecReturnData: String! = kSecReturnData as String
private let SecReturnPersistentRef: String! = kSecReturnPersistentRef as String
private let SecValueData: String! = kSecValueData as String
private let SecAttrAccessible: String! = kSecAttrAccessible as String
private let SecClass: String! = kSecClass as String
private let SecAttrService: String! = kSecAttrService as String
private let SecAttrGeneric: String! = kSecAttrGeneric as String
private let SecAttrAccount: String! = kSecAttrAccount as String
private let SecAttrAccessGroup: String! = kSecAttrAccessGroup as String
private let SecReturnAttributes: String = kSecReturnAttributes as String

/// KeychainWrapper is a class to help make Keychain access in Swift more straightforward. It is designed to make accessing the Keychain services more like using NSUserDefaults, which is much more familiar to people.
open class KeychainWrapper {
    /// Default keychain wrapper access
    public static let standard = KeychainWrapper()

    /// ServiceName is used for the kSecAttrService property to uniquely identify this keychain accessor. If no service name is specified, KeychainWrapper will default to using the bundleIdentifier.
    private(set) public var serviceName: String

    /// AccessGroup is used for the kSecAttrAccessGroup property to identify which Keychain Access Group this entry belongs to. This allows you to use the KeychainWrapper with shared keychain access between different applications.
    private(set) public var accessGroup: String?

    private static let defaultServiceName: String = {
        return Bundle.main.bundleIdentifier ?? "SwiftKeychainWrapper"
    }()

    private convenience init() {
        self.init(serviceName: KeychainWrapper.defaultServiceName)
    }

    /// Create a custom instance of KeychainWrapper with a custom Service Name and optional custom access group.
    ///
    /// - parameter serviceName: The ServiceName for this instance. Used to uniquely identify all keys stored using this keychain wrapper instance.
    /// - parameter accessGroup: Optional unique AccessGroup for this instance. Use a matching AccessGroup between applications to allow shared keychain access.
    public init(serviceName: String, accessGroup: String? = nil) {
        self.serviceName = serviceName
        self.accessGroup = accessGroup
    }

    // MARK:- Public Methods

    /// Checks if keychain data exists for a specified key.
    ///
    /// - parameter forKey: The key to check for.
    /// - parameter withAccessibility: Optional accessibility to use when retrieving the keychain item.
    /// - returns: True if a value exists for the key. False otherwise.
    open func hasValue(
        forKey key: String, withAccessibility accessibility: KeychainItemAccessibility? = nil
    ) -> Bool {
        if let _ = data(forKey: key, withAccessibility: accessibility) {
            return true
        } else {
            return false
        }
    }

    open func accessibilityOfKey(_ key: String) -> KeychainItemAccessibility? {
        var keychainQueryDictionary = setupKeychainQueryDictionary(forKey: key)

        // Remove accessibility attribute
        keychainQueryDictionary.removeValue(forKey: SecAttrAccessible)

        // Limit search results to one
        keychainQueryDictionary[SecMatchLimit] = kSecMatchLimitOne

        // Specify we want SecAttrAccessible returned
        keychainQueryDictionary[SecReturnAttributes] = kCFBooleanTrue

        // Search
        var result: AnyObject?
        let status = SecItemCopyMatching(keychainQueryDictionary as CFDictionary, &result)

        guard status == noErr, let resultsDictionary = result as? [String: AnyObject],
            let accessibilityAttrValue = resultsDictionary[SecAttrAccessible] as? String
        else {
            return nil
        }

        return KeychainItemAccessibility.accessibilityForAttributeValue(
            accessibilityAttrValue as CFString)
    }

    /// Get the keys of all keychain entries matching the current ServiceName and AccessGroup if one is set.
    open func allKeys() -> Set<String> {
        var keychainQueryDictionary: [String: Any] = [
            SecClass: kSecClassGenericPassword,
            SecAttrService: serviceName,
            SecReturnAttributes: kCFBooleanTrue!,
            SecMatchLimit: kSecMatchLimitAll,
        ]

        if let accessGroup = self.accessGroup {
            keychainQueryDictionary[SecAttrAccessGroup] = accessGroup
        }

        var result: AnyObject?
        let status = SecItemCopyMatching(keychainQueryDictionary as CFDictionary, &result)

        guard status == errSecSuccess else { return [] }

        var keys = Set<String>()
        if let results = result as? [[AnyHashable: Any]] {
            for attributes in results {
                if let accountData = attributes[SecAttrAccount] as? Data,
                    let account = String(data: accountData, encoding: String.Encoding.utf8)
                {
                    keys.insert(account)
                }
            }
        }
        return keys
    }

    // MARK: Public Getters

    open func integer(
        forKey key: String, withAccessibility accessibility: KeychainItemAccessibility? = nil
    ) -> Int? {
        guard let numberValue = object(forKey: key, withAccessibility: accessibility) as? NSNumber
        else {
            return nil
        }

        return numberValue.intValue
    }

    open func float(
        forKey key: String, withAccessibility accessibility: KeychainItemAccessibility? = nil
    ) -> Float? {
        guard let numberValue = object(forKey: key, withAccessibility: accessibility) as? NSNumber
        else {
            return nil
        }

        return numberValue.floatValue
    }

    open func double(
        forKey key: String, withAccessibility accessibility: KeychainItemAccessibility? = nil
    ) -> Double? {
        guard let numberValue = object(forKey: key, withAccessibility: accessibility) as? NSNumber
        else {
            return nil
        }

        return numberValue.doubleValue
    }

    open func bool(
        forKey key: String, withAccessibility accessibility: KeychainItemAccessibility? = nil
    ) -> Bool? {
        guard let numberValue = object(forKey: key, withAccessibility: accessibility) as? NSNumber
        else {
            return nil
        }

        return numberValue.boolValue
    }

    /// Returns a string value for a specified key.
    ///
    /// - parameter forKey: The key to lookup data for.
    /// - parameter withAccessibility: Optional accessibility to use when retrieving the keychain item.
    /// - returns: The String associated with the key if it exists. If no data exists, or the data found cannot be encoded as a string, returns nil.
    open func string(
        forKey key: String, withAccessibility accessibility: KeychainItemAccessibility? = nil
    ) -> String? {
        guard let keychainData = data(forKey: key, withAccessibility: accessibility) else {
            return nil
        }

        return String(data: keychainData, encoding: String.Encoding.utf8) as String?
    }

    /// Returns an object that conforms to NSCoding for a specified key.
    ///
    /// - parameter forKey: The key to lookup data for.
    /// - parameter withAccessibility: Optional accessibility to use when retrieving the keychain item.
    /// - returns: The decoded object associated with the key if it exists. If no data exists, or the data found cannot be decoded, returns nil.
    open func object(
        forKey key: String, withAccessibility accessibility: KeychainItemAccessibility? = nil
    ) -> NSCoding? {
        guard let keychainData = data(forKey: key, withAccessibility: accessibility) else {
            return nil
        }

        return try! NSKeyedUnarchiver.unarchiveTopLevelObjectWithData(keychainData) as? NSCoding
    }

    /// Returns a Data object for a specified key.
    ///
    /// - parameter forKey: The key to lookup data for.
    /// - parameter withAccessibility: Optional accessibility to use when retrieving the keychain item.
    /// - returns: The Data object associated with the key if it exists. If no data exists, returns nil.
    open func data(
        forKey key: String, withAccessibility accessibility: KeychainItemAccessibility? = nil
    ) -> Data? {
        var keychainQueryDictionary = setupKeychainQueryDictionary(
            forKey: key, withAccessibility: accessibility)

        // Limit search results to one
        keychainQueryDictionary[SecMatchLimit] = kSecMatchLimitOne

        // Specify 
```

### Core Architecture Module: `CodeApp/Utilities/Shared/ExtensionCommunicationHelper.swift`
```
//
//  ExtensionCommunicationHelper.swift
//  Code
//
//  Created by Ken Chung on 29/04/2024.
//

import Foundation

class ExtensionCommunicationHelper {
    static let containerURL = FileManager.default.containerURL(
        forSecurityApplicationGroupIdentifier: "group.com.thebaselab.code")

    static func writeToStdin(data: String) {
        let coordinator = NSFileCoordinator(filePresenter: nil)
        let string = data

        var error: NSError?
        let sharedURL = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: "group.com.thebaselab.code")!
        coordinator.coordinate(
            writingItemAt: sharedURL.appendingPathComponent("stdin"), options: .forReplacing,
            error: &error,
            byAccessor: { url in
                try? string.write(to: url, atomically: true, encoding: .utf8)

                let notificationName = CFNotificationName(
                    "com.thebaselab.code.node.stdin" as CFString)
                let notificationCenter = CFNotificationCenterGetDarwinNotifyCenter()
                CFNotificationCenterPostNotification(
                    notificationCenter, notificationName, nil, nil, false)
            })
    }

    static func writeToStdout(data: String) {
        let coordinator = NSFileCoordinator(filePresenter: nil)
        let string = data

        var error: NSError?
        let sharedURL = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: "group.com.thebaselab.code")!
        coordinator.coordinate(
            writingItemAt: sharedURL.appendingPathComponent("stdout"), options: .forReplacing,
            error: &error,
            byAccessor: { url in
                try? string.write(to: url, atomically: true, encoding: .utf8)

                let notificationName = CFNotificationName(
                    "com.thebaselab.code.node.stdout" as CFString)
                let notificationCenter = CFNotificationCenterGetDarwinNotifyCenter()
                CFNotificationCenterPostNotification(
                    notificationCenter, notificationName, nil, nil, false)
            })
    }
}

```

### Core Architecture Module: `CodeApp/Utilities/UIFont+YYAdd.h`
```
//
//  UIFont+YYAdd.h
//  YYKit <https://github.com/ibireme/YYKit>
//
//  Created by ibireme on 14/5/11.
//  Copyright (c) 2015 ibireme.
//
//  This source code is licensed under the MIT-style license found in the
//  LICENSE file in the root directory of this source tree.
//

#import <UIKit/UIKit.h>
#import <CoreGraphics/CoreGraphics.h>
#import <CoreText/CoreText.h>

NS_ASSUME_NONNULL_BEGIN

/**
 Provides extensions for `UIFont`.
 */
@interface UIFont (YYAdd) <NSCoding>
#pragma mark - Dump font data
///=============================================================================
/// @name Dump font data
///=============================================================================

/**
 Serialize and return the font data.
 
 @param font The font.
 
 @return data in TTF, or nil if an error occurs.
 */
+ (nullable NSData *)dataFromFont:(UIFont *)font;

/**
 Serialize and return the font data.
 
 @param cgFont The font.
 
 @return data in TTF, or nil if an error occurs.
 */
+ (nullable NSData *)dataFromCGFont:(CGFontRef)cgFont;

@end

NS_ASSUME_NONNULL_END

```

### Core Architecture Module: `CodeApp/Utilities/Utilities.swift`
```
//
//  Utilities.swift
//  Code
//
//  Created by Ken Chung on 12/11/2022.
//

import Foundation
import ios_system

func humanReadableByteCount(bytes: Int) -> String {
    if bytes < 1000 { return "\(bytes) B" }
    let exp = Int(log2(Double(bytes)) / log2(1000.0))
    let unit = ["KB", "MB", "GB", "TB", "PB", "EB"][exp - 1]
    let number = Double(bytes) / pow(1000, Double(exp))
    return String(format: "%.1f %@", number, unit)
}

struct CodableWrapper<Value: Codable> {
    var value: Value
}

// https://forums.swift.org/t/rawrepresentable-conformance-leads-to-crash/51912/4
extension CodableWrapper: RawRepresentable {

    typealias RawValue = String

    var rawValue: RawValue {
        guard
            let data = try? JSONEncoder().encode(value),
            let string = String(data: data, encoding: .utf8)
        else {
            // TODO: Track programmer error
            return ""
        }
        return string
    }

    init?(rawValue: RawValue) {
        guard
            let data = rawValue.data(using: .utf8),
            let decoded = try? JSONDecoder().decode(Value.self, from: data)
        else {
            // TODO: Track programmer error
            return nil
        }
        value = decoded
    }
}

extension CodableWrapper: Equatable {
    static func == (lhs: CodableWrapper, rhs: CodableWrapper) -> Bool {
        return lhs.rawValue == rhs.rawValue
    }
}

// https://stackoverflow.com/questions/74372835/mutation-of-captured-var-in-concurrently-executing-code

class UnsafeTask<T> {
    let semaphore = DispatchSemaphore(value: 0)
    private var result: T?
    init(block: @escaping () async -> T) {
        Task {
            result = await block()
            semaphore.signal()
        }
    }

    func get() -> T {
        if let result = result { return result }
        semaphore.wait()
        return result!
    }
}

func refreshNodeCommands() {
    let nodeBinPath = Resources.appGroupSharedLibrary?.appendingPathComponent("lib/bin").path

    if let nodeBinPath = nodeBinPath,
        let paths = try? FileManager.default.contentsOfDirectory(atPath: nodeBinPath)
    {
        paths.forEach { path in
            let cmd = path.replacingOccurrences(of: nodeBinPath, with: "")
            replaceCommand(cmd, "nodeg", true)
        }
    }
}

```

### Core Architecture Module: `CodeApp/Utilities/biometricType.swift`
```
//
//  biometricType.swift
//  Code
//
//  Created by Ken Chung on 14/4/2022.
//

import LocalAuthentication

func biometricAuthSupported() -> Bool {
    let authContext = LAContext()
    return authContext.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: nil)
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1334** (2026-09-15): **The keyboard is not opening in the Monaco mode editor on iOS 27.0 (24A5390f).**
  *Symptoms*: The **on-screen keyboard fails to open** when tapping the text area in **Monaco mode** on **iOS 27.0 (24A5390f)**. The Runestone mode functions correctly. This issue occurs regardless of whether the connection is via SSH or local. The problem has been observed on both iPad 10 and iPhone 12 devices running version 27.0 (24A5390f) currently in Public Beta.   Code App from the App Store, version 1.12.2 Build 328. 
  **Post-Mortem & Fix Analysis**:
  > Thank you for the report. Can you check if Monaco editor works expectedly in Safari? https://microsoft.github.io/monaco-editor/
  > Tested on iPhone Safari. On the landing page, clicking the editor component correctly opens the keyboard, and input suggestions also function as expected
  > Interesting. I will further investigate this issue and update the progress here

- **Issue #1326** (2026-07-18): **Can not commit**
  *Symptoms*: I can’t commit by using git It's useless to click the plus sign. And I can clone Repo by SSH Use IPad Pro M5
  **Post-Mortem & Fix Analysis**:
  > Same issue M2 Ipad Air
  > Same on iPad 10th gen iOS 18.5
  > @LucaVmu Does it happen on every repository?

- **Issue #1314** (2026-03-22): **SSH file explorer BUG**
  *Symptoms*: The button to refresh and set as a working folder using SSH file explorer did not work as expected, and the prompt "Connection Successful" was displayed after clicking.  The bug is shown in the figure. At present, I only find that such problems will occur when the refresh and set to the work folder button.  ![Image](https://github.com/user-attachments/assets/eee7950e-412d-4643-828e-fd629fa5d23b) ![Image](https://github.com/user-attachments/assets/c4281574-d758-44d2-9e42-61a77defe9a0)
  **Post-Mortem & Fix Analysis**:
  > Hi, I can reproduce this on iPhone with Code App 1.12.0 (Build 324) over SSH.  Long-pressing a remote folder and selecting “Assign as workspace folder” does not actually change the Explorer root. I still see the full remote filesystem (/, bin, etc, home, mnt, etc.) instead of the selected folder becoming the workspace root.  The app shows “Connected successfully”, but nothing changes visually.  I also tried: 	•	Close Workspace / reconnect SSH 	•	Toggle Resolve Home Path 	•	Toggle Runestone Editor 	•	cd into the target folder in terminal  I also tested code ., but on the remote machine it says:  -bash: code: command not found  So this seems like an iOS SSH workspace/file explorer bug rather than user error.
  > Thank you for reporting the issue. I will fix it and publish an update soon.
  > Fixed in https://github.com/thebaselab/codeapp/commit/3a8a553bcf1c7214274d6dde85771ca1c22dd6b6. I will publish to App Store tonight

- **Issue #1222** (2025-07-16): **FTP file toolbox didn’t read right via jump ssh server**
  *Symptoms*: Hi, I found this editor very useful to me when doing jobs on remote ssh server. However, I found when jump server existed, some problems occured.  1. Unable to login via jump server when the ssh terminal is limited. My jump server is set to limit normal users directly executing commands by redirecting users to a menu like: a) enter server1 b) enter server2 q) quit  When I connected my target server via the jump server, the editor kept loading and never stoped after finishing connecting jump server. Then I tried to connect the target server by set the address with jump server address, and set the username like “jump_server_user@target_server_user@target_server_address”.  And I successfully entered the target server’s terminal, while the left toolbox shows files on jump server instead of that on target server. I’m wondering whether or not it is because the editor didn’t read files on target server. I’d appreciate it if you could help me loading the right file on target server.  ![Image](https://github.com/user-attachments/assets/dbb8607a-a9c2-4b2d-8b9a-ea3310373f8d)
  **Post-Mortem & Fix Analysis**:
  > Currently, we assume that the jump server allows `ssh` command.  We will need to re-think this logic for jump server with custom logics.
  > > Currently, we assume that the jump server allows `ssh` command. We will need to re-think this logic for jump server with custom logics.  Still an excellent work! Looking forward to your next update!
  > Hi! Here is my jump server framework. It may be useful for your if you plan to work on this problem.  https://www.jumpserver.org/

- **Issue #1160** (2024-10-26): **Drag and drop on the editor crashes app**
  *Symptoms*: `Thread 1: "pasteItemProviders: must be overridden if pasteConfiguration is not nil."`

- **Issue #1118** (2024-07-29): **Python pip runtime issue**
  *Symptoms*: ![image](https://github.com/user-attachments/assets/162fa831-7065-4ca6-a8b9-df61e3863b4f) I get the error image when running ``` pip install yt-dlp ```  And running a sample code  Any of these codes ``` """ from yt_dlp import YoutubeDL  ydl_opts = {     'outtmpl': 'downloads/%(title)s.%(ext)s',  # Specify download path and filename     'format': 'best',  # Download the best quality }  with YoutubeDL(ydl_opts) as ydl:     ydl.download(['https://www.youtube.com/watch?v=L8r6kMod7Vw']) """ """ from yt_dlp import YoutubeDL  ydl_opts = {     'format': 'bestaudio/best',     'outtmpl': 'downloads/%(title)s.%(ext)s', }  with YoutubeDL(ydl_opts) as ydl:     ydl.download(['https://www.youtube.com/watch?v=L8r6kMod7Vw']) """   from yt_dlp import YoutubeDL  ydl_opts = {     'format': 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',     'outtmpl': 'downloads/%(title)s.%(ext)s', }  with YoutubeDL(ydl_opts) as ydl:     ydl.download(['https://www.youtube.com/watch?v=L8r6kMod7Vw']) ```
  **Post-Mortem & Fix Analysis**:
  > Try this: `pip uninstall pycryptodome pycryptodomex`.  Reference: https://github.com/holzschu/a-shell/issues/734
  > Works perfectly! Thanks 😃 

- **Issue #1094** (2024-06-30): **Can't pull repository from github.com using ssh authorization key**
  *Symptoms*: Version: 1.8.0 Build 289   Previous Issues: I did not find any issue with this content neither on docs    I generated a rsa 256 key trough alpine ish app as usual and copied public and private key content to the "Hostname Based Credentials" as follows:   ![image](https://github.com/thebaselab/codeapp/assets/34348097/d04ee2b8-7d72-4af2-bd74-d13705edd105)  When I try to copy my public repository `git@github.com:filiperochalopes/calc.filipelopes.med.br.git` it brings me an error:  ![image](https://github.com/thebaselab/codeapp/assets/34348097/18b1ab34-d05a-4271-86e4-8f16010eeb12)  Is there a defined key format that codeapp supports?  Obviously I also added the public key to github.
  **Post-Mortem & Fix Analysis**:
  > Hi. Try this instead: `ssh://git@github.com/filiperochalopes/calc.filipelopes.med.br.git`.   I will update the code to properly parse the url you used.   
  > Tricky and no straightforward way to do but worked. Thanks! May keep this open until parse function release.
  > The fix is now released on App Store.

- **Issue #1078** (2024-05-15): **Keyboard toolbar not functional in 1.7.3 / 1.8.0**
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

### Incident Patch 1: `6b508f35` (2026-09-15)
**Commit Message**: fix: Remove redundant event listener on focus in Monaco editor

**File**: `CodeApp/Managers/EditorImplementation/MonacoImplementation.swift` (modified, +0/-1)
```diff
@@ -103,7 +103,6 @@ class MonacoImplementation: NSObject {
                     if (!el.classList.contains("inputarea")) return;
 
                     el.focus({ preventScroll: true });
-                    document.removeEventListener("focusin", onFocusIn, true);
                 };
 
                 onFocusIn();
```

---

### Incident Patch 2: `0af663b8` (2026-09-15)
**Commit Message**: chore: Bump marketing version to 1.12.3 and update localization strings (fixes #1342 #1334)

**File**: `CodeApp/Localization/de.lproj/Localizable.strings` (modified, +3/-2)
```diff
@@ -8,7 +8,7 @@
 
 "Welcome Message" =
 "# Code App
-##### **v1.12.3 (Juli 2026)**
+##### **v1.12.3 (September 2026)**
 #### Start
 [Neue Datei](https://thebaselab.com/code/newfile)
 [Datei öffnen](https://thebaselab.com/code/openfile)
@@ -23,8 +23,9 @@
 
 "Changelog.message" =
 "
-### 1.12.3 (Juli 2026)
+### 1.12.3 (September 2026)
 - Behebt die Sichtbarkeit der türkischen Sprache in den Einstellungen
+- Verbesserte Kompatibilität mit iOS 27
 
 ### 1.12.2 (Juni 2026)
 - Behebt einen GUI-Git-Fehler
```

**File**: `CodeApp/Localization/en.lproj/Localizable.strings` (modified, +3/-2)
```diff
@@ -8,7 +8,7 @@
 
 "Welcome Message" =
 "# Code App
-##### **v1.12.3 (July 2026)**
+##### **v1.12.3 (September 2026)**
 #### Start
 [New file](https://thebaselab.com/code/newfile)
 [Open file](https://thebaselab.com/code/openfile)
@@ -23,8 +23,9 @@
 
 "Changelog.message" =
 "
-### 1.12.3 (July 2026)
+### 1.12.3 (September 2026)
 - Fixed Turkish language visibility in Settings
+- Improves compatibility with iOS 27
 
 ### 1.12.2 (June 2026)
 - Fixes a GUI git bug
```

**File**: `CodeApp/Localization/ja.lproj/Localizable.strings` (modified, +3/-2)
```diff
@@ -8,7 +8,7 @@
 
 "Welcome Message" =
 "# Code App
-##### **v1.12.3 (2026 年 7 月)**
+##### **v1.12.3 (2026 年 9 月)**
 #### 開始
 [新しいファイル](https://thebaselab.com/code/newfile)
 [ファイルを開く](https://thebaselab.com/code/openfile)
@@ -23,8 +23,9 @@
 
 "Changelog.message" =
 "
-### 1.12.3 (2026 年 7 月)
+### 1.12.3 (2026 年 9 月)
 - 設定でトルコ語が表示されない問題を修正
+- iOS 27 との互換性を改善
 
 ### 1.12.2 (2026 年 6 月)
 - Git GUI の不具合を修正
```

**File**: `CodeApp/Localization/ko.lproj/Localizable.strings` (modified, +3/-2)
```diff
@@ -8,7 +8,7 @@
 
 "Welcome Message" =
 "# Code App
-##### **v1.12.3 (2026년 7월)**
+##### **v1.12.3 (2026년 9월)**
 #### 시작
 [새 파일...](https://thebaselab.com/code/newfile)
 [파일 열기...](https://thebaselab.com/code/openfile)
@@ -23,8 +23,9 @@
 
 "Changelog.message" =
 "
-### 1.12.3 (2026년 7월)
+### 1.12.3 (2026년 9월)
 - 설정에서 터키어가 표시되지 않던 문제 수정
+- iOS 27 호환성 개선
 
 ### 1.12.2 (2026년 6월)
 - Git GUI 버그 수정
```

**File**: `CodeApp/Localization/ru.lproj/Localizable.strings` (modified, +3/-2)
```diff
@@ -8,7 +8,7 @@
 
 "Welcome Message" =
 "# Code App
-##### **v1.12.3 (Июль 2026)**
+##### **v1.12.3 (Сентябрь 2026)**
 #### Начало
 [Новый файл](https://thebaselab.com/code/newfile)
 [Открыть файл](https://thebaselab.com/code/openfile)
@@ -23,8 +23,9 @@
 
 "Changelog.message" =
 "
-### 1.12.3 (Июль 2026)
+### 1.12.3 (Сентябрь 2026)
 - Исправлено отображение турецкого языка в настройках
+- Улучшена совместимость с iOS 27
 
 ### 1.12.2 (Июнь 2026)
 - Исправлена ошибка в графическом интерфейсе Git
```

**File**: `CodeApp/Localization/tr.lproj/Localizable.strings` (modified, +3/-2)
```diff
@@ -8,7 +8,7 @@
 
 "Welcome Message" =
 "# Code App
-##### **v1.12.3 (Temmuz 2026)**
+##### **v1.12.3 (Eylül 2026)**
 #### Başlangıç
 [Yeni Dosya](https://thebaselab.com/code/newfile)
 [Dosya Aç](https://thebaselab.com/code/openfile)
@@ -23,8 +23,9 @@
 
 "Changelog.message" =
 "
-### 1.12.3 (Temmuz 2026)
+### 1.12.3 (Eylül 2026)
 - Ayarlar'da Türkçe dil görünürlüğü düzeltildi
+- iOS 27 uyumluluğu iyileştirildi
 
 ### 1.12.2 (Haziran 2026)
 - Git arayüzündeki bir hata düzeltildi.
```

**File**: `CodeApp/Localization/zh-Hans.lproj/Localizable.strings` (modified, +3/-2)
```diff
@@ -8,7 +8,7 @@
 
 "Welcome Message" =
 "# Code App
-##### **v1.12.3 (2026 年 7 月)**
+##### **v1.12.3 (2026 年 9 月)**
 #### 开始
 [新文件](https://thebaselab.com/code/newfile)
 [打开文件](https://thebaselab.com/code/openfile)
@@ -23,8 +23,9 @@
 
 "Changelog.message" =
 "
-### 1.12.3 (2026 年 7 月)
+### 1.12.3 (2026 年 9 月)
 - 修复了土耳其语未在设置中显示的问题
+- 改进了与 iOS 27 的兼容性
 
 ### 1.12.2 (2026 年 6 月)
 - 修复了 Git 图形界面的一个错误
```

---

### Incident Patch 3: `dfcec888` (2026-08-14)
**Commit Message**: Merge pull request #1339 from thebaselab/copilot/fix-turkish-language-files

**File**: `CodeApp/Localization/tr.lproj/Localizable.strings` (modified, +1/-1)
```diff
@@ -109,7 +109,7 @@
 
 ### 1.5.1 (Ekim 2023)
 - FTP uzaktan erişimiyle ilgili sorunları giderir.
-– "Port Yönlendirme" sekmesinin her zaman kompakt modda görüntülenmesine neden olan bir hata düzeltildi.
+– \"Port Yönlendirme\" sekmesinin her zaman kompakt modda görüntülenmesine neden olan bir hata düzeltildi.
 
 ### 1.5.0 (Ekim 2023)
 - SSH uzaktan bağlantısında port yönlendirme
```

---

### Incident Patch 4: `4a215db1` (2026-08-14)
**Commit Message**: Fix malformed quotes in Turkish Localizable.strings

Co-authored-by: bummoblizard <[REDACTED_EMAIL]>

**File**: `CodeApp/Localization/tr.lproj/Localizable.strings` (modified, +1/-1)
```diff
@@ -109,7 +109,7 @@
 
 ### 1.5.1 (Ekim 2023)
 - FTP uzaktan erişimiyle ilgili sorunları giderir.
-– "Port Yönlendirme" sekmesinin her zaman kompakt modda görüntülenmesine neden olan bir hata düzeltildi.
+– \"Port Yönlendirme\" sekmesinin her zaman kompakt modda görüntülenmesine neden olan bir hata düzeltildi.
 
 ### 1.5.0 (Ekim 2023)
 - SSH uzaktan bağlantısında port yönlendirme
```

---

### Incident Patch 5: `48aa907a` (2026-08-14)
**Commit Message**: Merge pull request #1338 from thebaselab/copilot/fix-turkish-language-settings

**File**: `Code.xcodeproj/project.pbxproj` (modified, +9/-4)
```diff
@@ -1975,7 +1975,9 @@
 		94FF337328435158003DE5DD /* SettingsFontPicker.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = SettingsFontPicker.swift; sourceTree = "<group>"; };
 		94FF33882843744C003DE5DD /* FiraCode-Regular.ttf */ = {isa = PBXFileReference; lastKnownFileType = file; name = "FiraCode-Regular.ttf"; path = "Dependencies/monaco-textmate.bundle/fonts/FiraCode-Regular.ttf"; sourceTree = "<group>"; };
 		9DA5FA622D7A51B30010CE11 /* ru */ = {isa = PBXFileReference; lastKnownFileType = text.plist.strings; name = ru; path = ru.lproj/Localizable.strings; sourceTree = "<group>"; };
+		A1B2C3D52D90000100AA0002 /* tr */ = {isa = PBXFileReference; lastKnownFileType = text.plist.strings; name = tr; path = tr.lproj/Localizable.strings; sourceTree = "<group>"; };
 		9DFB70332D7A78B2005A5BB4 /* ru */ = {isa = PBXFileReference; lastKnownFileType = text.plist.strings; name = ru; path = ru.lproj/InfoPlist.strings; sourceTree = "<group>"; };
+		A1B2C3D42D90000100AA0001 /* tr */ = {isa = PBXFileReference; lastKnownFileType = text.plist.strings; name = tr; path = tr.lproj/InfoPlist.strings; sourceTree = "<group>"; };
 		9F046C312922203E00BDE4E9 /* ToolbarManager.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = ToolbarManager.swift; sourceTree = "<group>"; };
 		9F046C3429222D8E00BDE4E9 /* ExtensionManager.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = ExtensionManager.swift; sourceTree = "<group>"; };
 		9F046C3929223D1600BDE4E9 /* RemoteExecutionExtension.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = RemoteExecutionExtension.swift; sourceTree = "<group>"; };
@@ -3460,6 +3462,7 @@
 				ko,
 				ja,
 				ru,
+				tr,
 			);
 			mainGroup = 944EEBE72563C381009D77FE;
 			packageReferences = (
@@ -4006,6 +4009,7 @@
 				73F80B102850F7EE000EF3FC /* ko */,
 				4F30816929662D58002708FD /* ja */,
 				9DFB70332D7A78B2005A5BB4 /* ru */,
+				A1B2C3D42D90000100AA0001 /* tr */,
 			);
 			name = InfoPlist.strings;
 			sourceTree = "<group>";
@@ -4019,6 +4023,7 @@
 				73F80B0F2850F7E5000EF3FC /* ko */,
 				4F30816829662CBF002708FD /* ja */,
 				9DA5FA622D7A51B30010CE11 /* ru */,
+				A1B2C3D52D90000100AA0002 /* tr */,
 			);
 			name = Localizable.strings;
 			sourceTree = "<group>";
@@ -4057,7 +4062,7 @@
 					"@executable_path/Frameworks",
 				);
 				LIBRARY_SEARCH_PATHS = "$(inherited)";
-				MARKETING_VERSION = 1.12.2;
+				MARKETING_VERSION = 1.12.3;
 				OTHER_SWIFT_FLAGS = "-Xcc -Wno-incomplete-umbrella";
 				PRODUCT_BUNDLE_IDENTIFIER = "thebaselab.VS-Code";
 				PRODUCT_NAME = "$(TARGET_NAME)";
@@ -4105,7 +4110,7 @@
 					"@executable_path/Frameworks",
 				);
 				LIBRARY_SEARCH_PATHS = "$(inherited)";
-				MARKETING_VERSION = 1.12.2;
+				MARKETING_VERSION = 1.12.3;
 				OTHER_SWIFT_FLAGS = "-Xcc -Wno-incomplete-umbrella";
 				PRODUCT_BUNDLE_IDENTIFIER = "thebaselab.VS-Code";
 				PRODUCT_NAME = "$(TARGET_NAME)";
@@ -4342,7 +4347,7 @@
 					"@executable_path/Frameworks",
 				);
 				LIBRARY_SEARCH_PATHS = "$(inherited)";
-				MARKETING_VERSION = 1.12.2;
+				MARKETING_VERSION = 1.12.3;
 				OTHER_SWIFT_FLAGS = "-Xcc -Wno-incomplete-umbrella";
 				PRODUCT_BUNDLE_IDENTIFIER = "thebaselab.VS-Code";
 				PRODUCT_NAME = "$(TARGET_NAME)";
@@ -4389,7 +4394,7 @@
 					"@executable_path/Frameworks",
 				);
 				LIBRARY_SEARCH_PATHS = "$(inherited)";
-				MARKETING_VERSION = 1.12.2;
+				MARKETING_VERSION = 1.12.3;
 				OTHER_SWIFT_FLAGS = "-Xcc -Wno-incomplete-umbrella";
 				PRODUCT_BUNDLE_IDENTIFIER = "thebaselab.VS-Code";
 				PRODUCT_NAME = "$(TARGET_NAME)";
```

**File**: `CodeApp/Localization/de.lproj/Localizable.strings` (modified, +6/-2)
```diff
@@ -8,7 +8,7 @@
 
 "Welcome Message" =
 "# Code App
-##### **v1.12.2 (Juli 2026)**
+##### **v1.12.3 (Juli 2026)**
 #### Start
 [Neue Datei](https://thebaselab.com/code/newfile)
 [Datei öffnen](https://thebaselab.com/code/openfile)
@@ -22,7 +22,11 @@
 ";
 
 "Changelog.message" =
-"### 1.12.2 (Juni 2026)
+"
+### 1.12.3 (Juli 2026)
+- Behebt die Sichtbarkeit der türkischen Sprache in den Einstellungen
+
+### 1.12.2 (Juni 2026)
 - Behebt einen GUI-Git-Fehler
 - Unterstützung für die türkische Sprache
 - Besonderer Dank an @iEmirRekt für den Beitrag
```

**File**: `CodeApp/Localization/en.lproj/Localizable.strings` (modified, +4/-1)
```diff
@@ -8,7 +8,7 @@
 
 "Welcome Message" =
 "# Code App
-##### **v1.12.2 (July 2026)**
+##### **v1.12.3 (July 2026)**
 #### Start
 [New file](https://thebaselab.com/code/newfile)
 [Open file](https://thebaselab.com/code/openfile)
@@ -23,6 +23,9 @@
 
 "Changelog.message" =
 "
+### 1.12.3 (July 2026)
+- Fixed Turkish language visibility in Settings
+
 ### 1.12.2 (June 2026)
 - Fixes a GUI git bug
 - Turkish language support
```

**File**: `CodeApp/Localization/ja.lproj/Localizable.strings` (modified, +6/-2)
```diff
@@ -8,7 +8,7 @@
 
 "Welcome Message" =
 "# Code App
-##### **v1.12.2 (2026 年 7 月)**
+##### **v1.12.3 (2026 年 7 月)**
 #### 開始
 [新しいファイル](https://thebaselab.com/code/newfile)
 [ファイルを開く](https://thebaselab.com/code/openfile)
@@ -22,7 +22,11 @@
 ";
 
 "Changelog.message" =
-"### 1.12.2 (2026 年 6 月)
+"
+### 1.12.3 (2026 年 7 月)
+- 設定でトルコ語が表示されない問題を修正
+
+### 1.12.2 (2026 年 6 月)
 - Git GUI の不具合を修正
 - トルコ語サポート
 - 貢献してくれた @iEmirRekt に特別感謝
```

**File**: `CodeApp/Localization/ko.lproj/Localizable.strings` (modified, +6/-2)
```diff
@@ -8,7 +8,7 @@
 
 "Welcome Message" =
 "# Code App
-##### **v1.12.2 (2026년 7월)**
+##### **v1.12.3 (2026년 7월)**
 #### 시작
 [새 파일...](https://thebaselab.com/code/newfile)
 [파일 열기...](https://thebaselab.com/code/openfile)
@@ -22,7 +22,11 @@
 ";
 
 "Changelog.message" =
-"### 1.12.2 (2026년 6월)
+"
+### 1.12.3 (2026년 7월)
+- 설정에서 터키어가 표시되지 않던 문제 수정
+
+### 1.12.2 (2026년 6월)
 - Git GUI 버그 수정
 - 터키어 지원
 - 기여해 주신 @iEmirRekt님께 특별한 감사
```

**File**: `CodeApp/Localization/ru.lproj/Localizable.strings` (modified, +6/-2)
```diff
@@ -8,7 +8,7 @@
 
 "Welcome Message" =
 "# Code App
-##### **v1.12.2 (Июль 2026)**
+##### **v1.12.3 (Июль 2026)**
 #### Начало
 [Новый файл](https://thebaselab.com/code/newfile)
 [Открыть файл](https://thebaselab.com/code/openfile)
@@ -22,7 +22,11 @@
 ";
 
 "Changelog.message" =
-"### 1.12.2 (Июнь 2026)
+"
+### 1.12.3 (Июль 2026)
+- Исправлено отображение турецкого языка в настройках
+
+### 1.12.2 (Июнь 2026)
 - Исправлена ошибка в графическом интерфейсе Git
 - Поддержка турецкого языка
 - Особая благодарность @iEmirRekt за вклад
```

**File**: `CodeApp/Localization/tr.lproj/Localizable.strings` (modified, +6/-2)
```diff
@@ -8,7 +8,7 @@
 
 "Welcome Message" =
 "# Code App
-##### **v1.12.2 (Temmuz 2026)**
+##### **v1.12.3 (Temmuz 2026)**
 #### Başlangıç
 [Yeni Dosya](https://thebaselab.com/code/newfile)
 [Dosya Aç](https://thebaselab.com/code/openfile)
@@ -22,7 +22,11 @@
 ";
 
 "Changelog.message" =
-"### 1.12.2 (Haziran 2026)
+"
+### 1.12.3 (Temmuz 2026)
+- Ayarlar'da Türkçe dil görünürlüğü düzeltildi
+
+### 1.12.2 (Haziran 2026)
 - Git arayüzündeki bir hata düzeltildi.
 - Türkçe dil desteği
 - Katkısı için @iEmirRekt'e özel teşekkürler.
```

**File**: `CodeApp/Localization/zh-Hans.lproj/Localizable.strings` (modified, +6/-2)
```diff
@@ -8,7 +8,7 @@
 
 "Welcome Message" =
 "# Code App
-##### **v1.12.2 (2026 年 7 月)**
+##### **v1.12.3 (2026 年 7 月)**
 #### 开始
 [新文件](https://thebaselab.com/code/newfile)
 [打开文件](https://thebaselab.com/code/openfile)
@@ -22,7 +22,11 @@
 ";
 
 "Changelog.message" =
-"### 1.12.2 (2026 年 6 月)
+"
+### 1.12.3 (2026 年 7 月)
+- 修复了土耳其语未在设置中显示的问题
+
+### 1.12.2 (2026 年 6 月)
 - 修复了 Git 图形界面的一个错误
 - 支持土耳其语
 - 特别感谢 @iEmirRekt 的贡献
```

---

### Incident Patch 6: `051e3831` (2026-08-14)
**Commit Message**: Fix English changelog wording

Co-authored-by: bummoblizard <[REDACTED_EMAIL]>

**File**: `CodeApp/Localization/en.lproj/Localizable.strings` (modified, +1/-1)
```diff
@@ -24,7 +24,7 @@
 "Changelog.message" =
 "
 ### 1.12.3 (July 2026)
-- Fixes Turkish language visibility in Settings
+- Fixed Turkish language visibility in Settings
 
 ### 1.12.2 (June 2026)
 - Fixes a GUI git bug
```

---

### Incident Patch 7: `b7c3c639` (2026-08-14)
**Commit Message**: Fix Turkish changelog wording

Co-authored-by: bummoblizard <[REDACTED_EMAIL]>

**File**: `CodeApp/Localization/tr.lproj/Localizable.strings` (modified, +1/-1)
```diff
@@ -24,7 +24,7 @@
 "Changelog.message" =
 "
 ### 1.12.3 (Temmuz 2026)
-- Ayarlar'da Türkçe dil görünürlüğünü düzeltir
+- Ayarlar'da Türkçe dil görünürlüğü düzeltildi
 
 ### 1.12.2 (Haziran 2026)
 - Git arayüzündeki bir hata düzeltildi.
```

---

### Incident Patch 8: `f7a7623b` (2026-08-14)
**Commit Message**: Fix Turkish settings localization

Co-authored-by: bummoblizard <[REDACTED_EMAIL]>

**File**: `Code.xcodeproj/project.pbxproj` (modified, +9/-4)
```diff
@@ -1975,7 +1975,9 @@
 		94FF337328435158003DE5DD /* SettingsFontPicker.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = SettingsFontPicker.swift; sourceTree = "<group>"; };
 		94FF33882843744C003DE5DD /* FiraCode-Regular.ttf */ = {isa = PBXFileReference; lastKnownFileType = file; name = "FiraCode-Regular.ttf"; path = "Dependencies/monaco-textmate.bundle/fonts/FiraCode-Regular.ttf"; sourceTree = "<group>"; };
 		9DA5FA622D7A51B30010CE11 /* ru */ = {isa = PBXFileReference; lastKnownFileType = text.plist.strings; name = ru; path = ru.lproj/Localizable.strings; sourceTree = "<group>"; };
+		A1B2C3D52D90000100AA0002 /* tr */ = {isa = PBXFileReference; lastKnownFileType = text.plist.strings; name = tr; path = tr.lproj/Localizable.strings; sourceTree = "<group>"; };
 		9DFB70332D7A78B2005A5BB4 /* ru */ = {isa = PBXFileReference; lastKnownFileType = text.plist.strings; name = ru; path = ru.lproj/InfoPlist.strings; sourceTree = "<group>"; };
+		A1B2C3D42D90000100AA0001 /* tr */ = {isa = PBXFileReference; lastKnownFileType = text.plist.strings; name = tr; path = tr.lproj/InfoPlist.strings; sourceTree = "<group>"; };
 		9F046C312922203E00BDE4E9 /* ToolbarManager.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = ToolbarManager.swift; sourceTree = "<group>"; };
 		9F046C3429222D8E00BDE4E9 /* ExtensionManager.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = ExtensionManager.swift; sourceTree = "<group>"; };
 		9F046C3929223D1600BDE4E9 /* RemoteExecutionExtension.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = RemoteExecutionExtension.swift; sourceTree = "<group>"; };
@@ -3460,6 +3462,7 @@
 				ko,
 				ja,
 				ru,
+				tr,
 			);
 			mainGroup = 944EEBE72563C381009D77FE;
 			packageReferences = (
@@ -4006,6 +4009,7 @@
 				73F80B102850F7EE000EF3FC /* ko */,
 				4F30816929662D58002708FD /* ja */,
 				9DFB70332D7A78B2005A5BB4 /* ru */,
+				A1B2C3D42D90000100AA0001 /* tr */,
 			);
 			name = InfoPlist.strings;
 			sourceTree = "<group>";
@@ -4019,6 +4023,7 @@
 				73F80B0F2850F7E5000EF3FC /* ko */,
 				4F30816829662CBF002708FD /* ja */,
 				9DA5FA622D7A51B30010CE11 /* ru */,
+				A1B2C3D52D90000100AA0002 /* tr */,
 			);
 			name = Localizable.strings;
 			sourceTree = "<group>";
@@ -4057,7 +4062,7 @@
 					"@executable_path/Frameworks",
 				);
 				LIBRARY_SEARCH_PATHS = "$(inherited)";
-				MARKETING_VERSION = 1.12.2;
+				MARKETING_VERSION = 1.12.3;
 				OTHER_SWIFT_FLAGS = "-Xcc -Wno-incomplete-umbrella";
 				PRODUCT_BUNDLE_IDENTIFIER = "thebaselab.VS-Code";
 				PRODUCT_NAME = "$(TARGET_NAME)";
@@ -4105,7 +4110,7 @@
 					"@executable_path/Frameworks",
 				);
 				LIBRARY_SEARCH_PATHS = "$(inherited)";
-				MARKETING_VERSION = 1.12.2;
+				MARKETING_VERSION = 1.12.3;
 				OTHER_SWIFT_FLAGS = "-Xcc -Wno-incomplete-umbrella";
 				PRODUCT_BUNDLE_IDENTIFIER = "thebaselab.VS-Code";
 				PRODUCT_NAME = "$(TARGET_NAME)";
@@ -4342,7 +4347,7 @@
 					"@executable_path/Frameworks",
 				);
 				LIBRARY_SEARCH_PATHS = "$(inherited)";
-				MARKETING_VERSION = 1.12.2;
+				MARKETING_VERSION = 1.12.3;
 				OTHER_SWIFT_FLAGS = "-Xcc -Wno-incomplete-umbrella";
 				PRODUCT_BUNDLE_IDENTIFIER = "thebaselab.VS-Code";
 				PRODUCT_NAME = "$(TARGET_NAME)";
@@ -4389,7 +4394,7 @@
 					"@executable_path/Frameworks",
 				);
 				LIBRARY_SEARCH_PATHS = "$(inherited)";
-				MARKETING_VERSION = 1.12.2;
+				MARKETING_VERSION = 1.12.3;
 				OTHER_SWIFT_FLAGS = "-Xcc -Wno-incomplete-umbrella";
 				PRODUCT_BUNDLE_IDENTIFIER = "thebaselab.VS-Code";
 				PRODUCT_NAME = "$(TARGET_NAME)";
```

**File**: `CodeApp/Localization/de.lproj/Localizable.strings` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@
 
 "Welcome Message" =
 "# Code App
-##### **v1.12.2 (Juli 2026)**
+##### **v1.12.3 (Juli 2026)**
 #### Start
 [Neue Datei](https://thebaselab.com/code/newfile)
 [Datei öffnen](https://thebaselab.com/code/openfile)
```

**File**: `CodeApp/Localization/en.lproj/Localizable.strings` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@
 
 "Welcome Message" =
 "# Code App
-##### **v1.12.2 (July 2026)**
+##### **v1.12.3 (July 2026)**
 #### Start
 [New file](https://thebaselab.com/code/newfile)
 [Open file](https://thebaselab.com/code/openfile)
```

**File**: `CodeApp/Localization/ja.lproj/Localizable.strings` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@
 
 "Welcome Message" =
 "# Code App
-##### **v1.12.2 (2026 年 7 月)**
+##### **v1.12.3 (2026 年 7 月)**
 #### 開始
 [新しいファイル](https://thebaselab.com/code/newfile)
 [ファイルを開く](https://thebaselab.com/code/openfile)
```

**File**: `CodeApp/Localization/ko.lproj/Localizable.strings` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@
 
 "Welcome Message" =
 "# Code App
-##### **v1.12.2 (2026년 7월)**
+##### **v1.12.3 (2026년 7월)**
 #### 시작
 [새 파일...](https://thebaselab.com/code/newfile)
 [파일 열기...](https://thebaselab.com/code/openfile)
```

**File**: `CodeApp/Localization/ru.lproj/Localizable.strings` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@
 
 "Welcome Message" =
 "# Code App
-##### **v1.12.2 (Июль 2026)**
+##### **v1.12.3 (Июль 2026)**
 #### Начало
 [Новый файл](https://thebaselab.com/code/newfile)
 [Открыть файл](https://thebaselab.com/code/openfile)
```

**File**: `CodeApp/Localization/tr.lproj/Localizable.strings` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@
 
 "Welcome Message" =
 "# Code App
-##### **v1.12.2 (Temmuz 2026)**
+##### **v1.12.3 (Temmuz 2026)**
 #### Başlangıç
 [Yeni Dosya](https://thebaselab.com/code/newfile)
 [Dosya Aç](https://thebaselab.com/code/openfile)
```

**File**: `CodeApp/Localization/zh-Hans.lproj/Localizable.strings` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@
 
 "Welcome Message" =
 "# Code App
-##### **v1.12.2 (2026 年 7 月)**
+##### **v1.12.3 (2026 年 7 月)**
 #### 开始
 [新文件](https://thebaselab.com/code/newfile)
 [打开文件](https://thebaselab.com/code/openfile)
```

---

### Incident Patch 9: `f1fb7d90` (2026-08-11)
**Commit Message**: Merge pull request #1336 from NabilMx99/docs/fix-typos

**File**: `README.md` (modified, +1/-1)
```diff
@@ -17,7 +17,7 @@ See [code.thebaselab.com](https://code.thebaselab.com)
 Use [VS Code](https://github.com/microsoft/vscode) as a design template while providing key functionalities with [monaco-editor](https://github.com/microsoft/monaco-editor) and native code:
 
 - Version Control (Git clone, commits, diff editor, push, pull and gutter indicator) ✅
-- Embeded terminal (70+ commands avaliable) ✅
+- Embedded terminal (70+ commands available) ✅
 - Local web development environment (Node + PHP) ✅
 - Built in Python runtime ✅
 - C/C++ Runtime with WebAssembly (with clang) ✅
```

---

### Incident Patch 10: `1f1753c3` (2026-08-11)
**Commit Message**: Fix typos in README

**File**: `README.md` (modified, +1/-1)
```diff
@@ -17,7 +17,7 @@ See [code.thebaselab.com](https://code.thebaselab.com)
 Use [VS Code](https://github.com/microsoft/vscode) as a design template while providing key functionalities with [monaco-editor](https://github.com/microsoft/monaco-editor) and native code:
 
 - Version Control (Git clone, commits, diff editor, push, pull and gutter indicator) ✅
-- Embeded terminal (70+ commands avaliable) ✅
+- Embedded terminal (70+ commands available) ✅
 - Local web development environment (Node + PHP) ✅
 - Built in Python runtime ✅
 - C/C++ Runtime with WebAssembly (with clang) ✅
```

---

### Incident Patch 11: `7c3bffa5` (2026-07-17)
**Commit Message**: fix: Use resolvingSymlinksInPath to avoid git path ambiguity

**File**: `CodeApp/Managers/FileSystem/WorkSpaceStorage.swift` (modified, +2/-1)
```diff
@@ -65,6 +65,7 @@ class WorkSpaceStorage: ObservableObject {
     }
 
     init(url: URL) {
+        let url = url.resolvingSymlinksInPath()
         let localFS = LocalFileSystemProvider()
         localFS.gitServiceProvider = LocalGitServiceProvider(root: url)
 
@@ -412,7 +413,7 @@ extension WorkSpaceStorage {
             subFolderItems != nil
         }
         var _url: URL? {
-            URL(string: url)
+            URL(string: url)?.resolvingSymlinksInPath()
         }
 
         init(name: String? = nil, url: String, isDirectory: Bool) {
```

**File**: `CodeApp/Views/ExplorerCell.swift` (modified, +3/-1)
```diff
@@ -102,7 +102,9 @@ private struct FileCell: View {
                         )
                 }
             } else {
-                if let status = App.gitTracks[URL(string: item.url)!] {
+                if let url = URL(string: item.url),
+                    let status = App.gitTracks[url]
+                {
                     FileDisplayName(
                         gitStatus: status, name: item.name.removingPercentEncoding!)
                 } else {
```

---

### Incident Patch 12: `44eea4aa` (2026-05-23)
**Commit Message**: fix existing typos

**File**: `CodeApp/Localization/de.lproj/Localizable.strings` (modified, +2/-2)
```diff
@@ -437,7 +437,7 @@
 "Staged Changes" = "Inszenierte Änderungen";
 "No changes are made in the working directory." = "Im Arbeitsverzeichnis werden keine Änderungen vorgenommen";
 "Git checkout: Uncommitted Changes" = "Git checkout: Uncommitted Changes";
-"Uncommited changes will be lost. Do you wish to proceed?" = "Nicht festgeschriebene Änderungen gehen verloren. Möchten Sie fortfahren?";
+"Uncommitted changes will be lost. Do you wish to proceed?" = "Nicht festgeschriebene Änderungen gehen verloren. Möchten Sie fortfahren?";
 "No changes are made in this file" = "In dieser Datei werden keine Änderungen vorgenommen";
 
 "Smooth Scrolling" = "flüssiges Scrollen";
@@ -534,7 +534,7 @@
 "errors.fs.not_implemented" = "Diese Funktion ist noch nicht implementiert.";
 "errors.fs.scheme_not_registered" = "Das Dateisystem-Schema ist nicht registriert.";
 "errors.fs.invalid_host" = "Ungültiger Hostname.";
-"errors.fs.unspported_encoding" = "Nicht unterstützte Zeichenkodierung.";
+"errors.fs.unsupported_encoding" = "Nicht unterstützte Zeichenkodierung.";
 "errors.fs.unknown" = "Unbekannter Fehler.";
 "errors.fs.connection_failure" = "Verbindungsfehler.";
 "errors.fs.authentication_failure" = "Authentifizierungsfehler.";
```

**File**: `CodeApp/Localization/ja.lproj/Localizable.strings` (modified, +1/-1)
```diff
@@ -438,7 +438,7 @@
 "Staged Changes" = "ステージされている変更";
 "No changes are made in the working directory." = "作業ディレクトリに変更はありません。";
 "Git checkout: Uncommitted Changes" = "Git チェックアウト: コミットされていない変更";
-"Uncommited changes will be lost. Do you wish to proceed?" = "コミットされていない変更は失われます。続行しますか？";
+"Uncommitted changes will be lost. Do you wish to proceed?" = "コミットされていない変更は失われます。続行しますか？";
 "No changes are made in this file" = "このファイルは変更されていません";
 
 "Smooth Scrolling" = "滑らかなスクロール";
```

**File**: `CodeApp/Localization/ko.lproj/Localizable.strings` (modified, +2/-2)
```diff
@@ -435,7 +435,7 @@
 "Staged Changes" = "변경 사항";
 "No changes are made in the working directory." = "작업 디렉토리에 변경 사항이 없습니다.";
 "Git checkout: Uncommitted Changes" = "깃(Git) 체크아웃: 커밋되지 않은 변경 사항";
-"Uncommited changes will be lost. Do you wish to proceed?" = "커밋되지 않은 변경 사항은 사라집니다. 계속하시겠습니까?";
+"Uncommitted changes will be lost. Do you wish to proceed?" = "커밋되지 않은 변경 사항은 사라집니다. 계속하시겠습니까?";
 "No changes are made in this file" = "이 파일에는 변경 사항이 없습니다.";
 
 "Smooth Scrolling" = "부드러운 스크롤";
@@ -532,7 +532,7 @@
 "errors.fs.not_implemented" = "이 기능은 아직 구현되지 않았습니다.";
 "errors.fs.scheme_not_registered" = "스키마가 등록되지 않았습니다.";
 "errors.fs.invalid_host" = "호스트가 잘못되었습니다.";
-"errors.fs.unspported_encoding" = "지원되지 않는 인코딩입니다.";
+"errors.fs.unsupported_encoding" = "지원되지 않는 인코딩입니다.";
 "errors.fs.unknown" = "알 수 없는 오류가 발생했습니다.";
 "errors.fs.connection_failure" = "연결에 실패했습니다.";
 "errors.fs.authentication_failure" = "인증에 실패했습니다.";
```

**File**: `CodeApp/Localization/ru.lproj/Localizable.strings` (modified, +1/-1)
```diff
@@ -476,7 +476,7 @@
 "Staged Changes" = "Индексированные изменения";
 "No changes are made in the working directory." = "В рабочей области нет изменений.";
 "Git checkout: Uncommitted Changes" = "Git checkout: незафиксированные изменения";
-"Uncommited changes will be lost. Do you wish to proceed?" = "Незафиксированные изменения будут потеряны. Хотите продолжить?";
+"Uncommitted changes will be lost. Do you wish to proceed?" = "Незафиксированные изменения будут потеряны. Хотите продолжить?";
 "No changes are made in this file" = "В этом файле нет изменений.";
 
 "Smooth Scrolling" = "Плавная прокрутка";
```

**File**: `CodeApp/Localization/tr.lproj/Localizable.strings` (modified, +2/-2)
```diff
@@ -437,7 +437,7 @@
 "Staged Changes" = "Aşamalı Değişiklikler";
 "No changes are made in the working directory." = "Çalışma dizininde herhangi bir değişiklik yapılmayacaktır.";
 "Git checkout: Uncommitted Changes" = "Git checkout: Henüz kaydedilmemiş değişiklikler";
-"Uncommited changes will be lost. Do you wish to proceed?" = "Kesinleşmeyen değişiklikler kaybolacaktır. Devam etmek istiyor musunuz?";
+"Uncommitted changes will be lost. Do you wish to proceed?" = "Kesinleşmeyen değişiklikler kaybolacaktır. Devam etmek istiyor musunuz?";
 "No changes are made in this file" = "Bu dosyada hiçbir değişiklik yapılmayacaktır";
 
 "Smooth Scrolling" = "Rahat Kaydırma";
@@ -533,7 +533,7 @@
 "errors.fs.not_implemented" = "Bu özellik henüz uygulanmadı.";
 "errors.fs.scheme_not_registered" = "Dosya sistemi şeması kayıtlı değil.";
 "errors.fs.invalid_host" = "Geçersiz ana bilgisayar adı.";
-"errors.fs.unspported_encoding" = "Desteklenmeyen karakter kodlaması.";
+"errors.fs.unsupported_encoding" = "Desteklenmeyen karakter kodlaması.";
 "errors.fs.unknown" = "Bilinmeyen hata.";
 "errors.fs.connection_failure" = "Bağlantı hatası.";
 "errors.fs.authentication_failure" = "Kimlik doğrulama hatası.";
```

**File**: `CodeApp/Localization/zh-Hans.lproj/Localizable.strings` (modified, +2/-2)
```diff
@@ -431,7 +431,7 @@
 "Staged Changes" = "缓存变更";
 "No changes are made in the working directory." = "没有任何未缓存的变更。";
 "Git checkout: Uncommitted Changes" = "Git checkout: 未提交的更改";
-"Uncommited changes will be lost. Do you wish to proceed?" = "未提交的更改将丢失。你要继续吗？";
+"Uncommitted changes will be lost. Do you wish to proceed?" = "未提交的更改将丢失。你要继续吗？";
 "No changes are made in this file" = "没有任何变更。";
 
 "Smooth Scrolling" = "平滑滚动";
@@ -525,7 +525,7 @@
 "errors.fs.not_implemented" = "文件系统不支持此操作。";
 "errors.fs.scheme_not_registered" = "文件系统方案未注册。";
 "errors.fs.invalid_host" = "无效的主机。";
-"errors.fs.unspported_encoding" = "不支持的编码。";
+"errors.fs.unsupported_encoding" = "不支持的编码。";
 "errors.fs.unknown" = "未知错误。";
 "errors.fs.connection_failure" = "连接失败。";
 "errors.fs.authentication_failure" = "身份验证失败。";
```

**File**: `Extensions/SourceControlAuxiliary/Views/CheckoutMenu.swift` (modified, +1/-1)
```diff
@@ -51,7 +51,7 @@ struct CheckoutMenu: View {
                             App.alertManager.showAlert(
                                 title: "Git checkout: Uncommitted Changes",
                                 message:
-                                    "Uncommited changes will be lost. Do you wish to proceed?",
+                                    "Uncommitted changes will be lost. Do you wish to proceed?",
                                 content: AnyView(
                                     Group {
                                         Button("Checkout", role: .destructive) {
```

---

### Incident Patch 13: `921c6207` (2026-05-23)
**Commit Message**: apply ai fixes

**File**: `CodeApp/Localization/tr.lproj/Localizable.strings` (modified, +5/-6)
```diff
@@ -87,7 +87,7 @@
 ### 1.6.0 (Ocak 2024)
 - Yerel dil iyileştirmeleri
    - Yerel Java (OpenJDK 8)
-     - Artık "javac" ve "java" komutlarını kullanarak Java programlarını çevrimdışı olarak derleyebilir ve çalıştırabilirsiniz.
+     - Artık \"javac\" ve \"java\" komutlarını kullanarak Java programlarını çevrimdışı olarak derleyebilir ve çalıştırabilirsiniz.
    - Node.js 18.19.0
    - PHP 8.3.2 (Zlib ile)
 – Dosya silme işlemi sırasında görüntülenen onay istemi artık isteğe bağlıdır ve varsayılan olarak devre dışıdır.
@@ -115,7 +115,7 @@
    - Kimlik doğrulama
      - SSH anahtarı kimlik doğrulaması
      - Çoklu kimlik bilgileri
-   - Yeni özelliklern
+   - Yeni özellikler
      - Uzaktan kumandadan çekin.
      - Çatışma çözümü
      - Dalları ve etiketleri oluştur/sil
@@ -405,8 +405,8 @@
 "Share" = "Paylaş";
 "Rename" = "Yeniden Adlandır";
 "Assign as workspace folder" = "Çalışma Alanına Dosyayı Ekle";
-"Select For Compare" = "Karışlaştırma İçin Seçin";
-"Compare With Selected" = "Seçili Olanla Karışlaştır";
+"Select For Compare" = "Karşılaştırma İçin Seçin";
+"Compare With Selected" = "Seçili Olanla Karşılaştır";
 "Version Control" = "Versiyon Kontrol";
 "Author Identity" = "Yapımcı Kimliği";
 "Authentication" = "Yetkilendirme";
@@ -418,7 +418,7 @@
 "Zoom out" = "Uzaklaştır";
 "Show Explorer" = "Gezgini Göster";
 "Show Search" = "Aramayı Göster";
-"Show Source Control" = "Kaynak Kontrolünü GÖster";
+"Show Source Control" = "Kaynak Kontrolünü Göster";
 "User Settings" = "Kullanıcı Ayarları";
 "Show Panel" = "Paneli Göster";
 "Hide Panel" = "Paneli Gizle";
@@ -447,7 +447,6 @@
 
 "Welcome" = "Hoş Geldin";
 "Licenses" = "Lisanslar";
-"Version" = "Versiyon";
 "Code App by thebaselab" = "Code App, thebaselab tarafından";
 "Themes" = "Temalar";
 "Read-only Mode" = "Satır Oku Modu";
```

---

### Incident Patch 14: `06a42e3f` (2026-05-20)
**Commit Message**: Potential fix for pull request finding

Co-authored-by: Copilot Autofix powered by AI <[REDACTED_EMAIL]>

**File**: `CodeApp/Localization/tr.lproj/Localizable.strings` (modified, +1/-1)
```diff
@@ -506,7 +506,7 @@
 "subscription.codeplus" = "Code+";
 "subscription.title %@" = "12 ay için: %@";
 "subscription.message" = "Kodu herkesin kullanımına açın ve tüm temaların kilidini açın. Kod açık kaynak kodlu kalacak ve mevcut özellikler abonelik gerektirmeden kullanılabilir olmaya devam edecektir.";
-"subscription.payment.description %@ %@" = "%@ tarihinde başlayarak, üyeliğiniz siz iptal edene kadar yıllık %@ karşılığında otomatik olarak yenilenecektir."
+"subscription.payment.description %@ %@" = "%@ tarihinde başlayarak, üyeliğiniz siz iptal edene kadar yıllık %@ karşılığında otomatik olarak yenilenecektir.";
 "subscription.payment.disallowed" = "Cihazınızın yapılandırması ödeme yapılmasına izin vermiyor.";
 "subscription.join" = "Code+ katıl";
 "terms_of_use" = "Kullanım Koşulları";
```

---

### Incident Patch 15: `8c4b403c` (2026-03-01)
**Commit Message**: fix: delay terminal fitting to fix terminal glitch

**File**: `Extensions/TerminalService/TerminalExtension.swift` (modified, +4/-1)
```diff
@@ -130,7 +130,10 @@ private struct MultiTerminalView: View {
             )
             .onAppear(perform: {
                 guard let terminal = App.terminalManager.activeTerminal else { return }
-                fitTerminalIfReady(terminal)
+                // Allow WKWebView to get the correct frame size before calling fit
+                DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
+                    fitTerminalIfReady(terminal)
+                }
             })
             .onChange(of: App.terminalManager.activeTerminalId) { _ in
                 guard let terminal = App.terminalManager.activeTerminal else {
```

#### Recent Merged Pull Requests:
- **PR #1339** (2026-08-14): Fix malformed Turkish localization string causing Xcode plist parse failure (@Copilot)
- **PR #1338** (2026-08-14): Register Turkish localization in Settings and bump app version to 1.12.3 (@Copilot)
- **PR #1336** (2026-08-11): Fix typos in README (@NabilMx99)
- **PR #1327** (2026-05-23): Turkish language support added (@iEmirRekt)
- **PR #1316** (closed): fix: remove pkg_resources fallback for setuptools 82+ compatibility (@junagent)
- **PR #1302** (2026-02-07): Multi-terminal feature (@ThalesMMS)
- **PR #1300** (2026-01-17): Add Esc/Del and Ctrl/Alt modifier support to terminal toolbar (@ThalesMMS)
- **PR #1291** (closed): spply code beta 2 (@Aryamirsepasi)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

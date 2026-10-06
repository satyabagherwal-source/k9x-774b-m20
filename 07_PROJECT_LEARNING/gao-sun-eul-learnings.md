# Forensic Learning Record (Deep Inspection): gao-sun/eul

> **Canonical Artifact**: `07_PROJECT_LEARNING/gao-sun-eul-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/gao-sun/eul](https://github.com/gao-sun/eul))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:19:57.740Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `gao-sun/eul`
- **Description**: 🖥️ macOS status monitoring app written in SwiftUI.
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 9949 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `SharedLibrary/Utilities/ByteUnit.swift`
```
//
//  ByteUnit.swift
//  eul
//
//  Created by Gao Sun on 2020/8/15.
//  Copyright © 2020 Gao Sun. All rights reserved.
//

import Foundation

// edited from https://gist.github.com/fethica/52ef6d842604e416ccd57780c6dd28e6
public struct ByteUnit {
    public let bytes: UInt64
    public let kilo: UInt64

    public var kilobytes: Double {
        Double(bytes) / Double(kilo)
    }

    public var megabytes: Double {
        kilobytes / Double(kilo)
    }

    public var gigabytes: Double {
        megabytes / Double(kilo)
    }

    public init(_ bytes: UInt64, kilo: UInt64 = 1024) {
        self.bytes = bytes
        self.kilo = kilo
    }

    public init(_ bytes: Double, kilo: UInt64 = 1024) {
        self.bytes = UInt64(bytes.zeroOrAbove)
        self.kilo = kilo
    }

    public init(megaBytes: Double) {
        self.init(megaBytes.zeroOrAbove * Double(1024 * 1024))
    }

    public var readable: String {
        switch bytes {
        case 0..<(kilo * kilo):
            return "\(String(format: "%.\(0)f", kilobytes)) KB"
        case kilo..<(kilo * kilo * kilo):
            return "\(String(format: "%.\(megabytes >= 100 ? 0 : 1)f", megabytes)) MB"
        case (kilo * kilo * kilo)...UInt64.max:
            return "\(String(format: "%.\(gigabytes >= 100 ? 0 : 1)f", gigabytes)) GB"
        default:
            return "\(bytes) Bytes"
        }
    }
}

```

### Core Architecture Module: `SharedLibrary/Utilities/Container.swift`
```
//
//  Container.swift
//  eul
//
//  Created by Gao Sun on 2020/11/5.
//  Copyright © 2020 Gao Sun. All rights reserved.
//

import Foundation

public enum Container {
    public static let defaults = UserDefaults(suiteName: "com.gaosun.eul.shared")
    static let pListEncoder = PropertyListEncoder()
    static let pListDecoder = PropertyListDecoder()

    public static func get<T: SharedEntry>(_ type: T.Type) -> T? {
        if let data = defaults?.data(forKey: T.containerKey), let decoded = try? pListDecoder.decode(type, from: data) {
            return decoded
        }
        return nil
    }

    public static func set<T: SharedEntry>(_ value: T?) {
        if let value = value, let encoded = try? pListEncoder.encode(value) {
            defaults?.setValue(encoded, forKey: T.containerKey)
        }
    }
}

```

### Core Architecture Module: `eul/Utilities/AutoUpdate.swift`
```
//
//  AutoUpdate.swift
//  eul
//
//  Created by Gao Sun on 2021/2/8.
//  Copyright © 2021 Gao Sun. All rights reserved.
//

import Cocoa
import Foundation

enum AutoUpdate {
    static let fileManager = FileManager.default
    static let appUrl = fileManager.temporaryDirectory.appendingPathComponent("eul.app")
    static let zipUrl = fileManager.temporaryDirectory.appendingPathComponent("eul.app.zip")

    static func run() {
        downloadLatest {
            if $0 {
                unzip {
                    if $0 {
                        if let resourceURL = Bundle.main.resourceURL {
                            let selfUpdateUrl = resourceURL.appendingPathComponent("SelfUpdate.app")
                            let tempSelfUpdateUrl = fileManager.temporaryDirectory.appendingPathComponent("SelfUpdate.app")

                            do {
                                if fileManager.fileExists(atPath: tempSelfUpdateUrl.path) {
                                    Print("trying to remove legacy update app at", tempSelfUpdateUrl)
                                    try fileManager.removeItem(at: tempSelfUpdateUrl)
                                }
                                Print("trying to copy self update from", selfUpdateUrl, "to", tempSelfUpdateUrl)
                                try fileManager.copyItem(at: selfUpdateUrl, to: tempSelfUpdateUrl)
                            } catch {
                                print("⚠️ error when copying self update", error)
                                return
                            }

                            let arguments: [String] = [
                                fileManager.temporaryDirectory.path,
                                Bundle.main.bundleURL.deletingLastPathComponent().path,
                                NSRunningApplication.current.processIdentifier.description,
                            ]

                            let options = NSWorkspace.OpenConfiguration()
                            options.arguments = arguments

                            Print("trying to run self update with arguments", tempSelfUpdateUrl, arguments)
                            do {
                                try NSWorkspace.shared.open(
                                    tempSelfUpdateUrl,
                                    options: .default,
                                    configuration: [.arguments: arguments]
                                )
                            } catch {
                                print("error when opening self update", error)
                                return
                            }

                            Print("started self update app")
                        }
                    }
                }
            }
        }
    }

    static func downloadLatest(completion: @escaping (Bool) -> Void) {
        guard let url = URL(string: "https://github.com/gao-sun/eul/releases/latest/download/eul.app.zip") else {
            completion(false)
            return
        }

        let session = URLSession(configuration: .ephemeral)
        let task = session.downloadTask(with: url) { url, _, error in
            if let error = error {
                print("⚠️ error when downloading latest zip file", error)
                completion(false)
                return
            }

            guard let url = url else {
                print("⚠️ no url")
                completion(false)
                return
            }

            do {
                Print("Checking if zip file exists")
                if fileManager.fileExists(atPath: zipUrl.path) {
                    Print("Removing existing zip file")
                    try fileManager.removeItem(at: zipUrl)
                }

                Print("Renaming file")
                try fileManager.moveItem(at: url, to: zipUrl)
            } catch {
                print("⚠️ error when setting up the new app", error)
                completion(false)
                return
            }

            completion(true)
        }

        task.resume()
    }

    static func unzip(completion: @escaping (Bool) -> Void) {
        do {
            Print("Checking if app directory exists")
            if fileManager.fileExists(atPath: appUrl.path) {
                Print("Removing existing app directory")
                try fileManager.removeItem(at: appUrl)
            }

            guard shell("unzip -oq \(zipUrl.path) -d \(fileManager.temporaryDirectory.path)") != nil else {
                completion(false)
                return
            }
        } catch {
            print("⚠️ error when unzipping the new app", error)
            completion(false)
            return
        }

        completion(true)
    }
}

```

### Core Architecture Module: `eul/Utilities/GPU.swift`
```
//
//  GPU.swift
//  eul
//
//  Created by Gao Sun on 2021/1/23.
//  Copyright © 2021 Gao Sun. All rights reserved.
//

import Foundation

struct GPU: Identifiable {
    var deviceId: String
    var model: String?
    var vendor: String?

    var id: String {
        deviceId
    }
}

extension GPU {
    struct Statistic {
        var pciMatch: String
        var usagePercentage: Int
        var temperature: Double?
        var coreClock: Int?
        var memoryClock: Int?
    }
}

extension GPU {
    static func getGPUs() -> [GPU]? {
        guard let data = shellData(["system_profiler SPDisplaysDataType -xml"]) else {
            return nil
        }

        let pListDecoder = PropertyListDecoder()
        guard let plistArray = try? pListDecoder.decode(SystemProfilerPlistArray.self, from: data) else {
            return nil
        }

        return plistArray.first?.items.compactMap {
            guard $0.isGPU, let deviceId = $0.deviceId else {
                return nil
            }
            return GPU(deviceId: deviceId, model: $0.model, vendor: $0.vendor)
        }
    }

    // https://stackoverflow.com/questions/10110658/programmatically-get-gpu-percent-usage-in-os-x/22440235#22440235
    // https://github.com/exelban/stats/blob/master/Modules/GPU/reader.swift
    static func getInfo() -> [Statistic]? {
        guard let propertyList = IOHelper.getPropertyList(for: kIOAcceleratorClassName) else {
            return nil
        }

        return propertyList.compactMap {
            guard
                let pciMatch = $0["IOPCIMatch"] as? String ?? $0["IOPCIPrimaryMatch"] as? String,
                let statistics = $0["PerformanceStatistics"] as? [String: Any],
                let usagePercentage = statistics["Device Utilization %"] as? Int ?? statistics["GPU Activity(%)"] as? Int
            else {
                return nil
            }

            Print("📊 statistics", statistics)

            return Statistic(
                pciMatch: pciMatch,
                usagePercentage: usagePercentage,
                temperature: statistics["Temperature(C)"] as? Double ?? SmcControl.shared.gpuProximityTemperature,
                coreClock: statistics["Core Clock(MHz)"] as? Int,
                memoryClock: statistics["Memory Clock(MHz)"] as? Int
            )
        }
    }
}

```

### Core Architecture Module: `eul/Utilities/IOHelper.swift`
```
//
//  IOHelper.swift
//  eul
//
//  Created by Gao Sun on 2021/1/23.
//  Copyright © 2021 Gao Sun. All rights reserved.
//

import Foundation

enum IOHelper {
    static func getProperties(entry: io_object_t) -> NSDictionary? {
        var serviceDict: Unmanaged<CFMutableDictionary>?

        defer {
            serviceDict?.release()
        }

        if IORegistryEntryCreateCFProperties(entry, &serviceDict, kCFAllocatorDefault, 0) != kIOReturnSuccess {
            return nil
        }

        return serviceDict?.takeUnretainedValue()
    }

    static func getPropertyList(for service: String) -> [NSDictionary]? {
        var iterator = io_iterator_t()

        defer {
            IOObjectRelease(iterator)
        }

        guard IOServiceGetMatchingServices(
            kIOMasterPortDefault,
            IOServiceMatching(service),
            &iterator
        ) == kIOReturnSuccess else {
            return nil
        }

        var propertyList = [NSDictionary]()
        var entry = IOIteratorNext(iterator)

        while entry != 0 {
            if let properties = getProperties(entry: entry) {
                propertyList.append(properties)
            }
            IOObjectRelease(entry)
            entry = IOIteratorNext(iterator)
        }

        return propertyList
    }
}

```

### Core Architecture Module: `eul/Utilities/Info.swift`
```
//
//  Info.swift
//  eul
//
//  Created by Gao Sun on 2020/6/27.
//  Copyright © 2020 Gao Sun. All rights reserved.
//

import Foundation
import IOKit.ps
import SharedLibrary
import SystemKit

extension BatteryEntry.BatteryCondition {
    var description: String {
        "battery.condition.\(rawValue)".localized()
    }
}

extension BatteryEntry.PowerSourceState {
    var description: String {
        "battery.power_source.\(rawValue)".localized()
    }
}

enum Info {
    static var isBigSur: Bool {
        if #available(OSX 11, *) {
            return true
        }
        return false
    }

    struct Battery {
        var currentCapacity = 0
        var maxCapacity = 0
        var currentCharge: Double {
            Double(currentCapacity) / Double(maxCapacity)
        }

        var condition: BatteryEntry.BatteryCondition = .good
        var powerSource: BatteryEntry.PowerSourceState = .unknown
        var timeToFullCharge = 0
        var timeToEmpty = 0
        var isCharged = false
        var isCharging = false

        init() {
            guard
                let blob = IOPSCopyPowerSourcesInfo(),
                let list = IOPSCopyPowerSourcesList(blob.takeRetainedValue()),
                let array = list.takeRetainedValue() as? [Any],
                array.count > 0,
                let dict = array[0] as? NSDictionary
            else {
                return
            }

            currentCapacity = dict[kIOPSCurrentCapacityKey] as? Int ?? 0
            maxCapacity = dict[kIOPSMaxCapacityKey] as? Int ?? 0
            timeToFullCharge = dict[kIOPSTimeToFullChargeKey] as? Int ?? 0
            timeToEmpty = dict[kIOPSTimeToEmptyKey] as? Int ?? 0
            isCharged = dict[kIOPSIsChargedKey] as? Bool ?? false
            isCharging = dict[kIOPSIsChargingKey] as? Bool ?? false

            if let value = dict[kIOPSBatteryHealthConditionKey] as? String {
                switch value {
                case kIOPSPoorValue:
                    condition = .poor
                case kIOPSFairValue:
                    condition = .fair
                default:
                    condition = .good
                }
            }

            if let value = dict[kIOPSPowerSourceStateKey] as? String {
                switch value {
                case kIOPSACPowerValue:
                    powerSource = .acPower
                case kIOPSBatteryPowerValue:
                    powerSource = .battery
                default:
                    powerSource = .unknown
                }
            }

            Print(
                "🔋 battery info",
                currentCapacity,
                maxCapacity,
                timeToFullCharge,
                timeToEmpty,
                isCharged,
                isCharging,
                condition,
                powerSource
            )
        }
    }

    struct NetworkUsage {
        var inBytes: UInt64
        var outBytes: UInt64
    }

    struct NetworkPort: Identifiable {
        var port: String?
        var device: String

        var id: String {
            device
        }

        var description: String {
            guard let port = port else {
                return device
            }
            return "\(port) (\(device))"
        }
    }

    struct InterfaceStatus {
        var name: String
        var status: String?
    }

    static func findPort(_ string: String) -> NetworkPort? {
        guard string.hasPrefix("("), string.hasSuffix(")") else {
            return nil
        }

        let trimmed = String(string.dropFirst().dropLast())

        guard let matched = trimmed.firstMatch("Device: ([^,]+)")?.range(at: 1), let deviceRange = Range(matched, in: trimmed) else {
            return nil
        }

        var port: String?
        let device = String(trimmed[deviceRange])
        if let matched = trimmed.firstMatch("Port: ([^,]+)")?.range(at: 1), let portRange = Range(matched, in: trimmed) {
            port = String(trimmed[portRange])
        }

        return NetworkPort(port: port, device: device)
    }

    static func getActiveInterfaces() -> [String] {
        shell("ifconfig")?.split(separator: "\n").map { String($0) }.reduce([InterfaceStatus]()) {
            // new interface
            if !$1.hasPrefix("\t") {
                guard let colonIndex = $1.firstIndex(of: ":") else {
                    return $0
                }
                return $0.appending(InterfaceStatus(name: String($1[..<colonIndex])))
            }

            let splitted = $1.split(separator: ":").map { $0.trimmingCharacters(in: CharacterSet(charactersIn: " \t")) }

            guard splitted.count == 2, splitted[0] == "status", let lastInterface = $0.last else {
                return $0
            }

            return $0.dropLast().appending(InterfaceStatus(name: lastInterface.name, status: splitted[1]))
        }.compactMap {
            $0.status == "active" ? $0.name : nil
        } ?? []
    }

    static func getNetworkUsage(forDevice: String?, _ onData: @escaping (NetworkUsage, [NetworkPort], NetworkPort?) -> Void) {
        // TO-DO: use Combine
        shellAsync("networksetup -listnetworkserviceorder") {
            let services = $0?.split(separator: "\n").map(String.init).compactMap(Info.findPort) ?? []
            let activeInterfaces = Info.getActiveInterfaces()
            let currentActivePort = services.first(where: { activeInterfaces.contains($0.device) })

            Print("network services order", services)
            Print("network active interfaces", activeInterfaces)
            Print("network current active interfaces", currentActivePort ?? "N/A")

            var inBytes: UInt64?
            var outBytes: UInt64?

            let device = forDevice ?? currentActivePort?.device ?? "en0"

            if
                let rows = shell("netstat -bI \(device)")?.split(separator: "\n").map({ String($0) }),
                rows.count > 1
            {
                let headers = rows[0].splittedByWhitespace
                let values = rows[1].splittedByWhitespace

                if let raw = String.getValue(of: "ibytes", in: values, of: headers), let bytes = UInt64(raw) {
                    inBytes = bytes
                }

                if let raw = String.getValue(of: "obytes", in: values, of: headers), let bytes = UInt64(raw) {
                    outBytes = bytes
                }
            }

            DispatchQueue.main.async {
                onData(NetworkUsage(inBytes: inBytes ?? 0, outBytes: outBytes ?? 0), services, currentActivePort)
            }
        }
    }

    static var system = System()

    static func getProcessCommand(pid: Int) -> String? {
        shell("ps -p \(pid) -o comm=")?.trimmingCharacters(in: .newlines)
    }
}

```

### Core Architecture Module: `eul/Utilities/Print.swift`
```
//
//  Print.swift
//  eul
//
//  Created by Gao Sun on 2020/10/19.
//  Copyright © 2020 Gao Sun. All rights reserved.
//

import Foundation

private let isDebug = CommandLine.arguments.contains(where: { $0 == "--debug" })

func Print(_ items: Any...) {
    if isDebug {
        for item in items {
            print(item, terminator: "")
            print(" ", terminator: "")
        }
        print("")
    }
}

```

### Core Architecture Module: `eul/Utilities/SMC.swift`
```
//
// SMC.swift
// SMCKit
//
// The MIT License
//
// Copyright (C) 2014-2017  beltex <https://beltex.github.io>
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

// huge credit to D0miH for new MacBook fan speed compatibility

import Foundation
import IOKit
import SharedLibrary

// ------------------------------------------------------------------------------

// MARK: Type Aliases

// ------------------------------------------------------------------------------

// http://stackoverflow.com/a/22383661

/// Floating point, unsigned, 14 bits exponent, 2 bits fraction
public typealias FPE2 = (UInt8, UInt8)

/// Floating point data type for the 2018 Macbooks using the T2 chip
public typealias FLT = (UInt8, UInt8, UInt8, UInt8)

/// Floating point, signed, 7 bits exponent, 8 bits fraction
public typealias SP78 = (UInt8, UInt8)

public typealias SMCBytes = (UInt8, UInt8, UInt8, UInt8, UInt8, UInt8, UInt8,
                             UInt8, UInt8, UInt8, UInt8, UInt8, UInt8, UInt8,
                             UInt8, UInt8, UInt8, UInt8, UInt8, UInt8, UInt8,
                             UInt8, UInt8, UInt8, UInt8, UInt8, UInt8, UInt8,
                             UInt8, UInt8, UInt8, UInt8)

// ------------------------------------------------------------------------------

// MARK: Standard Library Extensions

// ------------------------------------------------------------------------------

extension UInt32 {
    init(fromBytes bytes: (UInt8, UInt8, UInt8, UInt8)) {
        // TODO: Broken up due to "Expression was too complex" error as of
        //       Swift 4.

        let byte0 = UInt32(bytes.0) << 24
        let byte1 = UInt32(bytes.1) << 16
        let byte2 = UInt32(bytes.2) << 8
        let byte3 = UInt32(bytes.3)

        self = byte0 | byte1 | byte2 | byte3
    }
}

extension Bool {
    init(fromByte byte: UInt8) {
        self = byte == 1 ? true : false
    }
}

public extension Int {
    init(fromFPE2 bytes: FPE2) {
        self = (Int(bytes.0) << 6) + (Int(bytes.1) >> 2)
    }

    init(fromFLT bytes: FLT) {
        // convert the SMCBytes to a float value
        let byteArray: [UInt8] = [bytes.0, bytes.1, bytes.2, bytes.3]
        var resultValue: Float = 0.0
        memcpy(&resultValue, byteArray, 4)
        self = Int(resultValue)
    }

    func toFPE2() -> FPE2 {
        return (UInt8(self >> 6), UInt8((self << 2) ^ ((self >> 6) << 8)))
    }
}

extension Double {
    init(fromSP78 bytes: SP78) {
        // FIXME: Handle second byte
        let sign = bytes.0 & 0x80 == 0 ? 1.0 : -1.0
        self = sign * Double(bytes.0 & 0x7F) // AND to mask sign bit
    }
}

// Thanks to Airspeed Velocity for the great idea!
// http://airspeedvelocity.net/2015/05/22/my-talk-at-swift-summit/
public extension FourCharCode {
    init(fromString str: String) {
        precondition(str.count == 4)

        self = str.utf8.reduce(0) { sum, character in
            sum << 8 | UInt32(character)
        }
    }

    init(fromStaticString str: StaticString) {
        precondition(str.utf8CodeUnitCount == 4)

        self = str.withUTF8Buffer { buffer in
            // TODO: Broken up due to "Expression was too complex" error as of
            //       Swift 4.

            let byte0 = UInt32(buffer[0]) << 24
            let byte1 = UInt32(buffer[1]) << 16
            let byte2 = UInt32(buffer[2]) << 8
            let byte3 = UInt32(buffer[3])

            return byte0 | byte1 | byte2 | byte3
        }
    }

    func toString() -> String {
        return String(describing: UnicodeScalar(self >> 24 & 0xFF)!) +
            String(describing: UnicodeScalar(self >> 16 & 0xFF)!) +
            String(describing: UnicodeScalar(self >> 8 & 0xFF)!) +
            String(describing: UnicodeScalar(self & 0xFF)!)
    }
}

// ------------------------------------------------------------------------------

// MARK: Defined by AppleSMC.kext

// ------------------------------------------------------------------------------

/// Defined by AppleSMC.kext
///
/// This is the predefined struct that must be passed to communicate with the
/// AppleSMC driver. While the driver is closed source, the definition of this
/// struct happened to appear in the Apple PowerManagement project at around
/// version 211, and soon after disappeared. It can be seen in the PrivateLib.c
/// file under pmconfigd. Given that it is C code, this is the closest
/// translation to Swift from a type perspective.
///
/// ### Issues
///
/// * Padding for struct alignment when passed over to C side
/// * Size of struct must be 80 bytes
/// * C array's are bridged as tuples
///
/// http://www.opensource.apple.com/source/PowerManagement/PowerManagement-211/
public struct SMCParamStruct {
    /// I/O Kit function selector
    public enum Selector: UInt8 {
        case kSMCHandleYPCEvent = 2
        case kSMCReadKey = 5
        case kSMCWriteKey = 6
        case kSMCGetKeyFromIndex = 8
        case kSMCGetKeyInfo = 9
    }

    /// Return codes for SMCParamStruct.result property
    public enum Result: UInt8 {
        case kSMCSuccess = 0
        case kSMCError = 1
        case kSMCKeyNotFound = 132
    }

    public struct SMCVersion {
        var major: CUnsignedChar = 0
        var minor: CUnsignedChar = 0
        var build: CUnsignedChar = 0
        var reserved: CUnsignedChar = 0
        var release: CUnsignedShort = 0
    }

    public struct SMCPLimitData {
        var version: UInt16 = 0
        var length: UInt16 = 0
        var cpuPLimit: UInt32 = 0
        var gpuPLimit: UInt32 = 0
        var memPLimit: UInt32 = 0
    }

    public struct SMCKeyInfoData {
        /// How many bytes written to SMCParamStruct.bytes
        var dataSize: IOByteCount = 0

        /// Type of data written to SMCParamStruct.bytes. This lets us know how
        /// to interpret it (translate it to human readable)
        var dataType: UInt32 = 0

        var dataAttributes: UInt8 = 0
    }

    /// FourCharCode telling the SMC what we want
    var key: UInt32 = 0

    var vers = SMCVersion()

    var pLimitData = SMCPLimitData()

    var keyInfo = SMCKeyInfoData()

    /// Padding for struct alignment when passed over to C side
    var padding: UInt16 = 0

    /// Result of an operation
    var result: UInt8 = 0

    var status: UInt8 = 0

    /// Method selector
    var data8: UInt8 = 0

    var data32: UInt32 = 0

    /// Data returned from the SMC
    var bytes: SMCBytes = (UInt8(0), UInt8(0), UInt8(0), UInt8(0), UInt8(0), UInt8(0),
                           UInt8(0), UInt8(0), UInt8(0), UInt8(0), UInt8(0), UInt8(0),
                           UInt8(0), UInt8(0), UInt8(0), UInt8(0), UInt8(0), UInt8(0),
                           UInt8(0), UInt8(0), UInt8(0), UInt8(0), UInt8(0), UInt8(0),
                           UInt8(0), UInt8(0), UInt8(0), UInt8(0), UInt8(0), UInt8(0),
                           UInt8(0), UInt8(0))
}

// ------------------------------------------------------------------------------

// MARK: SMC Client

// ------------------------------------------------------------------------------

/// SMC data type information
public enum DataTypes {
    /// Fan information struct
    public static let FDS = DataType(type: FourCharCode(fromStaticString: "{fds"), size: 16)
    public static let Flag = DataType(type: FourCharCode(fromStaticString: "flag"), size: 1)
    /// See type aliases
    public static let FPE2 = DataType(type: FourCharCode(fromStaticString: "fpe2"), size: 2)
    public static let FLT = DataType(type: FourCharCode(fromStaticString: "flt "), size: 4)
    /// See type aliases
    public static let SP78 = DataType(type: FourCharCode(fromStaticString: "sp78"), size: 2)
    public static let UInt8 = DataType(type: FourCharCode(fromStaticString: "ui8 "), size: 1)
    public static let UInt32 = DataType(type: FourCharCode(fromStaticString: "ui32"), size: 4)
}

public struct SMCKey {
    let code: FourCharCode
    let info: DataType
}

public struct DataType: Equatable {
    let type: FourCharCode
    let size: UInt32
}

public func == (lhs: DataType, rhs: DataType) -> Bool {
    return lhs.type == rhs.type && lhs.size == rhs.size
}

/// Apple System Management Controller (SMC) user-space client for Intel-based
/// Macs. Works by talking to the AppleSMC.kext (kernel extension), the closed
/// source driver for the SMC.
public enum SMCKit {
    public enum SMCError: Error {
        /// AppleSMC driver not found
        case driverNotFound

        /// Failed to open a connection to the AppleSMC driver
        case failedToOpen

        /// This SMC key is not valid on this machine
        case keyNotFound(code: String)

        /// Requires root privileges
        case notPrivileged

        /// Fan speed must be > 0 && <= fanMaxSpeed
        case unsafeFanSpeed

        /// https://developer.apple.com/library/mac/qa/qa1075/_index.html
        ///
        /// - parameter kIOReturn: I/O Kit error code
        /// - parameter SMCResult: SMC specific retur
```

### Core Architecture Module: `eul/Utilities/Shell.swift`
```
//
//  Shell.swift
//  eul
//
//  Created by Gao Sun on 2020/8/9.
//  Copyright © 2020 Gao Sun. All rights reserved.
//

import Foundation

// https://stackoverflow.com/questions/26971240/how-do-i-run-an-terminal-command-in-a-swift-script-e-g-xcodebuild
@discardableResult
func shellData(_ args: [String]) -> Data? {
    let task = Process()
    let pipe = Pipe()
    let error = Pipe()

    Print("shell with", args)

    task.standardOutput = pipe
    task.standardError = error
    task.executableURL = URL(fileURLWithPath: "/bin/bash")
    task.arguments = ["-c"] + args

    var environment = ProcessInfo.processInfo.environment
    environment["LC_ALL"] = "en_US.UTF-8"
    task.environment = environment

    do {
        try task.run()
    } catch {
        print("⚠️ shell executed with error", error)
    }

    let data = pipe.fileHandleForReading.readDataToEndOfFile()

    task.waitUntilExit()

    if task.terminationStatus != 0 {
        return nil
    }

    return data
}

@discardableResult
func shell(_ args: String...) -> String? {
    guard let data = shellData(args) else {
        return nil
    }

    return String(data: data, encoding: .utf8)
}

func shellAsync(_ args: String..., onFinish: @escaping (String?) -> Void) {
    DispatchQueue.global().async {
        guard let data = shellData(args) else {
            onFinish(nil)
            return
        }

        onFinish(String(data: data, encoding: .utf8))
    }
}

@discardableResult
func shellPipe(_ args: String..., onData: ((String) -> Void)? = nil, didTerminate: (() -> Void)? = nil) -> Process {
    let task = Process()
    let pipe = Pipe()

    Print("shell pipe with", args)

    task.standardOutput = pipe
    task.executableURL = URL(fileURLWithPath: "/bin/bash")
    task.arguments = ["-c"] + args

    var environment = ProcessInfo.processInfo.environment
    environment["LC_ALL"] = "en_US.UTF-8"
    task.environment = environment

    var buffer = Data()
    let outHandle = pipe.fileHandleForReading
    outHandle.readabilityHandler = { _ in
        let data = outHandle.availableData

        Print("data received for", args)

        if data.count > 0 {
            buffer += data
            if let str = String(data: buffer, encoding: String.Encoding.utf8), str.last?.isNewline == true {
                buffer.removeAll()
                onData?(str)
            }
            outHandle.waitForDataInBackgroundAndNotify()
        } else {
            buffer.removeAll()
        }
    }
    outHandle.waitForDataInBackgroundAndNotify()

    task.terminationHandler = { _ in
        try? outHandle.close()
        didTerminate?()
    }

    DispatchQueue(label: "shellPipe-\(UUID().uuidString)", qos: .background, attributes: .concurrent).async {
        Print("good to launch")
        do {
            try task.run()
        } catch {
            print("⚠️ shell pipe executed with error", error)
        }
    }

    return task
}

```

### Core Architecture Module: `eul/Utilities/SmcControl.swift`
```
//
//  SmcControl.swift
//  eul
//
//  Created by Gao Sun on 2020/6/27.
//  Copyright © 2020 Gao Sun. All rights reserved.
//

import Foundation
import SharedLibrary
import SwiftyJSON

class SmcControl: Refreshable {
    static var shared = SmcControl()

    var sensors: [TemperatureData] = []
    var fans: [FanData] = []
    var tempUnit: TemperatureUnit = .celius
    var cpuDieTemperature: Double? {
        sensors.first(where: { $0.sensor.name == "CPU_0_DIE" })?.temp
    }

    var cpuProximityTemperature: Double? {
        sensors.first(where: { $0.sensor.name == "CPU_0_PROXIMITY" })?.temp
    }

    var gpuProximityTemperature: Double? {
        sensors.first(where: { $0.sensor.name == "GPU_0_PROXIMITY" })?.temp
    }

    var memoryProximityTemperature: Double? {
        sensors.first(where: { $0.sensor.name == "MEM_SLOTS_PROXIMITY" })?.temp
    }

    var isFanValid: Bool {
        fans.count > 0
    }

    func formatTemp(_ value: Double) -> String {
        String(format: "%.0f°\(tempUnit == .celius ? "C" : "F")", value)
    }

    init() {
        do {
            try SMCKit.open()
            sensors = try SMCKit.allKnownTemperatureSensors().map { .init(sensor: $0) }
            fans = try (0..<SMCKit.fanCount()).map { FanData(
                id: $0,
                minSpeed: try? SMCKit.fanMinSpeed($0),
                maxSpeed: try? SMCKit.fanMaxSpeed($0)
            ) }
        } catch {
            print("SMC init error", error)
        }
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
    }

    func subscribe() {
        initObserver(for: .SMCShouldRefresh)
    }

    func close() {
        SMCKit.close()
    }

    @objc func refresh() {
        for sensor in sensors {
            do {
                sensor.temp = try SMCKit.temperature(sensor.sensor.code, unit: tempUnit)
            } catch {
                sensor.temp = 0
                print("error while getting temperature", error)
            }
        }
        fans = fans.map {
            FanData(
                id: $0.id,
                currentSpeed: try? SMCKit.fanCurrentSpeed($0.id),
                minSpeed: $0.minSpeed,
                maxSpeed: $0.maxSpeed
            )
        }
        NotificationCenter.default.post(name: .StoreShouldRefresh, object: nil)
    }
}

extension TemperatureUnit {
    var description: String {
        switch self {
        case .celius:
            return "temp.celsius".localized()
        case .fahrenheit:
            return "temp.fahrenheit".localized()
        case .kelvin:
            return "temp.kelvin".localized()
        }
    }
}

extension Fan: JSONCodabble {
    init?(json: JSON) {
        guard
            let id = json["id"].int,
            let name = json["name"].string,
            let minSpeed = json["id"].int,
            let maxSpeed = json["id"].int
        else {
            return nil
        }
        self.id = id
        self.name = name
        self.minSpeed = minSpeed
        self.maxSpeed = maxSpeed
    }

    var json: JSON {
        JSON([
            "id": id,
            "name": name,
            "minSpeed": minSpeed,
            "maxSpeed": maxSpeed,
        ])
    }
}

extension Double {
    var temperatureString: String {
        SmcControl.shared.formatTemp(self)
    }
}

```

### Core Architecture Module: `BatteryWidget/BatteryWidget.swift`
```
//
//  BatteryWidget.swift
//  BatteryWidget
//
//  Created by Gao Sun on 2020/11/7.
//  Copyright © 2020 Gao Sun. All rights reserved.
//

import Intents
import Localize_Swift
import SharedLibrary
import SwiftUI
import WidgetKit

extension BatteryEntry.BatteryCondition {
    var description: String {
        "battery.condition.\(rawValue)".localized()
    }
}

extension BatteryEntry.PowerSourceState {
    var description: String {
        "battery.power_source.\(rawValue)".localized()
    }
}

struct Provider: StandardProvider {
    typealias WidgetEntry = BatteryEntry
}

struct BatteryWidgetEntryView: View {
    var entry: Provider.Entry

    var body: some View {
        ZStack {
            VStack(spacing: 8) {
                Spacer()
                HStack(alignment: .top) {
                    BatteryIconView(
                        size: 16,
                        isCharging: entry.isCharging,
                        charge: entry.charge ?? 1,
                        acPowered: entry.acPowered
                    )
                    Spacer()
                }
                HStack {
                    Text(entry.chargeString)
                        .widgetTitle()
                    Spacer()
                }
                .padding(.bottom, 24)
                if entry.isValid {
                    HStack {
                        Group {
                            WidgetSectionView(title: "battery.health".localized(), value: entry.health.percentageString)
                            WidgetSectionView(title: "battery.cycle".localized(), value: entry.cycleCount.description)
                            WidgetSectionView(title: "battery.condition".localized(), value: entry.condition.description)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }
                }
                Spacer()
            }
            .padding(16)
            if !entry.isValid {
                WidgetNotAvailbleView(text: "widget.not_available".localized())
            }
        }
    }
}

@main
struct BatteryWidget: Widget {
    let kind: String = BatteryEntry.kind

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Provider()) { entry in
            BatteryWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("widget.battery.title".localized())
        .description("widget.battery.description".localized())
        .supportedFamilies([.systemSmall])
    }
}

```

### Core Architecture Module: `CpuWidget/CpuWidget.swift`
```
//
//  CpuWidget.swift
//  CpuWidget
//
//  Created by Gao Sun on 2020/11/4.
//  Copyright © 2020 Gao Sun. All rights reserved.
//

import Intents
import Localize_Swift
import SharedLibrary
import SwiftUI
import WidgetKit

struct Provider: StandardProvider {
    typealias WidgetEntry = CpuEntry
}

struct CpuWidgetEntryView: View {
    var preferenceEntry = Container.get(PreferenceEntry.self) ?? PreferenceEntry()
    var entry: Provider.Entry

    var body: some View {
        ZStack {
            VStack(spacing: 8) {
                Spacer()
                HStack(alignment: .top) {
                    Image("CPU")
                        .resizable()
                        .frame(width: 12, height: 12)
                    Spacer()
                    if let temp = entry.temp {
                        Text(temp.formatTemp(unit: preferenceEntry.temperatureUnit))
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundColor(.secondary)
                    }
                }
                HStack {
                    Text(entry.usageString)
                        .widgetTitle()
                    Spacer()
                }
                .padding(.bottom, 24)
                HStack {
                    Group {
                        if let usageSystem = entry.usageSystem {
                            WidgetSectionView(title: "cpu.system".localized(), value: String(format: "%.1f%%", usageSystem))
                        }
                        if let usageUser = entry.usageUser {
                            WidgetSectionView(title: "cpu.user".localized(), value: String(format: "%.1f%%", usageUser))
                        }
                        if let usageNice = entry.usageNice {
                            WidgetSectionView(title: "cpu.nice".localized(), value: String(format: "%.1f%%", usageNice))
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                Spacer()
            }
            .padding(16)
            if !entry.isValid {
                WidgetNotAvailbleView(text: "widget.not_available".localized())
            }
        }
    }
}

@main
struct CpuWidget: Widget {
    let kind: String = CpuEntry.kind

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Provider()) { entry in
            CpuWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("widget.cpu.title".localized())
        .description("widget.cpu.description".localized())
        .supportedFamilies([.systemSmall])
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #219** (2021-07-09): **[bug] Disk Size Displays Twice**
  *Symptoms*: <h3>Make sure there's no open issue for the same bug before submit.</h3>  **Describe the Bug** <!-- A clear and concise description of what the bug is. --> Disk Size Displays Twice; once for the HD and once for .timemachine.  **Expected Behavior** <!-- It should be? --> Disk Size Displays one time. Just the HD.   **Screenshots** <!-- If applicable, add screenshots to help explain your problem. --> <img width="435" alt="Screen Shot 2021-07-06 at 12 34 20 AM" src="https://user-images.githubusercontent.com/78110294/124542726-ec861880-ddf1-11eb-9def-a119c532d014.png">   **Context**  - eul version: 1.6  - macOS version: 11.4  - Device model: MacBook Air (Retina, 13-inch, 2020)

- **Issue #198** (2021-06-09): **[bug] Network Monitor Not Working when using VPN (Cisco)**
  *Symptoms*: <h3>Make sure there's no open issue for the same bug before submit.</h3>  **Describe the Bug** I. Precondition: 1. Eul Menu Bar display Network only  II. How to Reproduce: 1. Connect VPN to any server on Cisco AnyConnect 2. Check on Eul Menu Bar, the network always show 0 KB/s for upload and download  **Expected Behavior** The network monitor should show the speed of upload and download, because some apps are working with the network.  **Screenshots** <details>  ![image](https://i.imgur.com/y0zBBjS.png)  </details>  **Context**  - eul version: 1.5.16  - macOS version: 10.15.7  - Device model: MacBook Pro 2019 (16-inch)  **Debug Output** <!-- Say you have eul in `/Applications` folder, then open terminal and run: --> <!-- `/Applications/eul.app/Contents/MacOS/eul --debug` --> <!-- Paste your output in the section below. -->  ``` bash ⚙️ loaded data from user defaults preference {   "checkStatusItemVisibility" : false,   "showCPUTopActivities" : true,   "cpuMenuDisplay" : "usagePercentage",   "language" : "en",   "showIcon" : true,   "smcRefreshRate" : 3,   "appearance" : "auto",   "temperatureUnit" : "celius",   "textDisplay" : "compact",   "upgradeMethod" : "showInStatusBar",   "fontDesign" : "default",   "showNetworkTopActivities" : true,   "networkRefreshRate" : 1,   "showRAMTopActivities" : true } 🔋 battery info 100 100 0 0 true false good acPower 🔋 battery info 100 100 0 0 true false good acPower ⚙️ loaded data from user 
  **Post-Mortem & Fix Analysis**:
  > thanks, taking a look now
  > oh this one may take one little bit more time - need to switch to another laptop to test under VPN. give me 2-3 more days
  > take ur time @gao-sun , really appriciate your work thankyouuu

- **Issue #197** (2021-06-14): **[bug]The program does not respond when using hotspot connection**
  *Symptoms*: The program does not respond when using hotspot connection ![截图](https://z3.ax1x.com/2021/04/07/c860ZF.jpg)  **Context**  - eul version: v1.5.16  - macOS version: big sur 11.2.3  - Device model:  MacBook Pro 13 2020 intel CPU  **Debug Output** <!-- Say you have eul in `/Applications` folder, then open terminal and run: --> <!-- `/Applications/eul.app/Contents/MacOS/eul --debug` --> <!-- Paste your output in the section below. -->  ``` bash ⚙️ loaded data from user defaults preference {   "networkRefreshRate" : 3,   "checkStatusItemVisibility" : true,   "appearance" : "auto",   "temperatureUnit" : "celius",   "showNetworkTopActivities" : false,   "showIcon" : true,   "language" : "zh-Hans",   "fontDesign" : "default",   "upgradeMethod" : "showInStatusBar",   "cpuMenuDisplay" : "usagePercentage",   "showRAMTopActivities" : false,   "smcRefreshRate" : 3,   "showCPUTopActivities" : true,   "textDisplay" : "compact" } 🔋 battery info 100 100 0 0 true false good acPower  🔋 battery info 100 100 0 0 true false good acPower  ⚙️ loaded data from user defaults EulComponent {   "availableComponents" : [     "GPU",     "Disk",     "Battery",     "Memory",     "CPU"   ],   "activeComponents" : [     "Fan",     "Network"   ],   "showComponents" : true } shell with ["system_profiler SPDisplaysDataType -xml"]  shell with ["route get 0.0.0.0 | grep interface | awk \'{print $2}\'"]  📊 statistics ["Device Unit 0 Utilization %": 2, "finishAll2DWai
  **Post-Mortem & Fix Analysis**:
  > thanks for reporting. will take a look soon
  > please try v1.5.17 and lmk if it helps
  > close for housekeeping. feel free to re-open if the latest version doesn't help

- **Issue #195** (2021-03-24): **[bug] eul 1.5.14 crashes on start**
  *Symptoms*: **Describe the Bug** Since updating to eul 1.5.14, eul crashes whenever I try to open it.  **Expected Behavior** eul does not crash.  **Context**  - eul version: 1.5.14  - macOS version: 10.15.7  - Device model: MacBook Pro (2019)  **Debug Output**  <details>  ``` ⚙️ loaded data from user defaults preference {   "temperatureUnit" : "celius",   "showIcon" : true,   "appearance" : "auto",   "fontDesign" : "default",   "showNetworkTopActivities" : false,   "language" : "en",   "showRAMTopActivities" : false,   "checkStatusItemVisibility" : true,   "networkRefreshRate" : 5,   "cpuMenuDisplay" : "loadAverage",   "smcRefreshRate" : 5,   "upgradeMethod" : "showInStatusBar",   "textDisplay" : "compact",   "showCPUTopActivities" : true } 🔋 battery info 100 100 0 0 true false good acPower 🔋 battery info 100 100 0 0 true false good acPower ⚙️ loaded data from user defaults EulComponent {   "availableComponents" : [     "GPU",     "Disk",     "Battery"   ],   "showComponents" : true,   "activeComponents" : [     "CPU",     "Memory",     "Fan",     "Network"   ] } ⚙️ loaded data from user defaults EulMenuComponent {   "activeComponents" : [     "CPU",     "GPU",     "Fan",     "Memory",     "Network",     "Battery",     "Bluetooth"   ],   "availableComponents" : [     "Disk"   ],   "showComponents" : true } shell with ["system_profiler SPDisplaysDataType -xml"] shell with ["route get 0.0.0.0 | grep interface | awk \'{print 
  **Post-Mortem & Fix Analysis**:
  > sorry. taking a look now
  > and this issue is a great example btw. thanks.
  > please try v1.5.15 and let me know if it works.

- **Issue #184** (2021-03-06): **[bug] Wrong  Battery Max Cap on Macbook Pro M1**
  *Symptoms*: Max Battery Cap is 100mah. [](url) <img width="337" alt="Screen Shot 2021-02-09 at 14 22 44" src="https://user-images.githubusercontent.com/30239019/107329292-8c10da80-6ae2-11eb-8aa8-3101e68737f6.png">  
  **Post-Mortem & Fix Analysis**:
  > should work now - please try the latest version (v1.5.13)
  > it does work on my MBA M1
  > @btannous yeah thanks, i think it's fixed on the latest version @slinker-hiwa close this issue for house-keeping, feel free to re-open if the bug still exists

- **Issue #168** (2021-01-28): **[bug] Fatal error: No ObservableObject of type GpuStore found.**
  *Symptoms*: Crashed When launching App ` Fatal error: No ObservableObject of type GpuStore found. A View.environmentObject(_:) for GpuStore may be missing as an ancestor of this view.: file SwiftUI, line 0 ` crash line in [GpuView.swift] return gpuStore.usageAverageString ?? "N/A"
  **Post-Mortem & Fix Analysis**:
  > thanks for reporting! the info is enough i think. taking a look tonight.
  > it's an issue introduced by #145, will fix soon
  > Did I introduce this error in #145? What did I mess up? Far as I know, I didn't change any gpu related stuff.

- **Issue #167** (2021-01-27): **[bug] Eul.app inside Eul.app?**
  *Symptoms*: When I unzip eul, the app icon is a white circle-backslash.  When I try to launch the app I get an alert, "You can't open the application "eul" because it may be damaged or incomplete.  When I ran the debug, the output was "zsh: no such file or directory: /Applications/eul.app/Contents/MacOS/eul"  That made me curious, so I went into the package contents and discovered that it appears like the eul app is somehow inside another eul.app package?  See screen shots.  Eul.app is inside another eul.app.  **Context**  - eul version: v1.5.7  - macOS version: Big Sur 11.1  - Device model: M1 and Intel MBP 13"  <img width="312" alt="Screen Shot 2021-01-26 at 8 26 31 AM" src="https://user-images.githubusercontent.com/74761361/105814480-c4c49600-5fb1-11eb-9462-e7156b40d0d2.png"> <img width="1319" alt="Screen Shot 2021-01-26 at 8 34 20 AM" src="https://user-images.githubusercontent.com/74761361/105814520-d443df00-5fb1-11eb-87e8-fd3eefcd702c.png">  
  **Post-Mortem & Fix Analysis**:
  > this is really interesting. tried the steps below on Intel MacBook (macOS 11.1): download the zip from release page -> unzip -> drag `.app` file to `Applications` folder -> works!  I assume it's an issue related to M1. will try to debug tonight.
  > in the mean time, would you mind to drag the inside `eul.app` to `/Applications` to see if it works?
  > I just tried it again on my Intel MBP running Big Sur 11.1.  Same issue with the eul.app nested inside itself.    > On Jan 26, 2021, at 9:52 AM, gao-sun <notifications@github.com> wrote: >  >  > this is really interesting. tried the steps below on Intel MacBook (macOS 11.1): > download the zip from release page -> unzip -> drag .app file to Applications folder -> works! >  > I assume it's an issue related to M1. will try to debug tonight. >  > — > You are receiving this because you authored the thread. > Reply to this email directly, view it on GitHub, or unsubscribe. >   

- **Issue #166** (2022-12-30): **[bug] not showing cpu temp. for M1 MacBook**
  *Symptoms*: <h3>Make sure there's no open issue for the same bug before submit.</h3>  **Describe the Bug** <!-- A clear and concise description of what the bug is. --> not showing cpu temp for m1 MacBook Air base model canada English  **Expected Behavior** <!-- It should be? --> no **Screenshots** <!-- If applicable, add screenshots to help explain your problem. --> <img width="515" alt="Screen Shot 2021-01-25 at 4 57 55 PM" src="https://user-images.githubusercontent.com/77996753/105771389-7a4e0580-5f2e-11eb-8bb3-50382b515ee3.png">  **Context**  - eul version:  - macOS version:  - Device model:   - Mac OS  <img width="229" alt="Screen Shot 2021-01-25 at 4 58 24 PM" src="https://user-images.githubusercontent.com/77996753/105771431-8b971200-5f2e-11eb-841b-a61d163c1e81.png">   **Debug Output** <!-- Say you have eul in `/Applications` folder, then open terminal and run: --> <!-- `/Applications/eul.app/Contents/MacOS/eul --debug` --> <!-- Paste your output in the section below. -->  ``` bash # PASTE OUTPUT HERE # ```  **Is Related to a Crash?** no <!-- If yes, upload related crash reports here. You can find them: -->  <!-- 1. In `~/Library/Logs/DiagnosticReports` --> <!-- 2. Open Console.app and click Crash Reports --> 
  **Post-Mortem & Fix Analysis**:
  > I think the SMC key of CPU temperature for M1 has been changed. @jevonmao do you have a M1 Mac handy?
  > @gao-sun Nope. I don't have M1 chip Mac.
  > no problem. i'll try to debug this

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

### Incident Patch 1: `48b80c92` (2021-07-09)
**Commit Message**: Fixing format

**File**: `eul/Store/DiskStore.swift` (modified, +1/-2)
```diff
@@ -79,9 +79,8 @@ class DiskStore: ObservableObject, Refreshable {
         }
 
         list = DiskList(disks: volumes.compactMap {
-            
             if $0.starts(with: ".") || $0.contains("com.apple") { return nil }
-            
+
             let path = DiskList.pathForName($0)
             let url = URL(fileURLWithPath: path)
 
```

---

### Incident Patch 2: `fbea38ef` (2021-06-18)
**Commit Message**: fix and update thai language (#214)

* Add files via upload

fix and update thai language

* Delete Localizable.strings

* Add files via upload

fix and update thai language

* fix and update thai language

* Delete Localizable.strings

* fix and update thai language

**File**: `Resource/th.lproj/Localizable.strings` (modified, +10/-10)
```diff
@@ -34,14 +34,14 @@
 "cpu.temperature" = "อุณหภูมิ";
 "gpu.temperature" = "อุณหภูมิ GPU";
 "cpu.info" = "ข้อมูล";
-"cpu.physical_cores" = "แกนประมาลผลทางกายภาพ";
-"cpu.logical_cores" = "แกนประมาลผลทางตรรกะ";
+"cpu.physical_cores" = "แกนประมวลผลทางกายภาพ";
+"cpu.logical_cores" = "แกนประมวลผลทางตรรกะ";
 "cpu.up_time" = "เวลาทำงาน";
 "cpu.thermal_level" = "ระดับความร้อน";
 "cpu.system" = "ระบบ";
 "cpu.user" = "ผู้ใช้";
 "cpu.nice" = "Nice";
-"cpu.waiting_status_report" = "กำลังรอสถานะที่จะรายงานครั้งแรก";
+"cpu.waiting_status_report" = "กำลังรอที่จะรายงานครั้งแรก";
 
 // MARK: Fan
 "fan" = "พัดลม";
@@ -62,11 +62,11 @@
 
 // MARK: Network
 "network" = "เครือข่าย";
-"network.in" = "ได้รับ";
+"network.in" = "รับ";
 "network.out" = "ส่ง";
 "network.no_activity" = "ไม่มีกิจกรรม";
-"network.port.auto" = "Auto-detect";
-"network.port.select" = "Port";
+"network.port.auto" = "ตรวจหาอัตโนมัติ";
+"network.port.select" = "พอร์ต";
 
 // MARK: Menu
 "menu.summary" = "สรุป";
@@ -116,8 +116,8 @@
 
 // MARK: Process
 "process" = "กระบวนการ";
-"process.bring_to_front" = "Bring to front";
-"process.reveal_in_finder" = "Reveal in Finder";
+"process.bring_to_front" = "นำมาด้านหน้า";
+"process.reveal_in_finder" = "แสดงใน Finder";
 "process.terminate" = "หยุด";
 "process.force_terminate" = "บังคับหยุด";
 "process.terminate_alert.text.%@" = "คุณแน่ใจหรือไม่ว่าต้องการหยุด %@?";
@@ -172,11 +172,11 @@
 "ui.network" = "เครือข่าย";
 "ui.menu_view" = "มุมมองเมนู";
 "ui.empty" = "ว่างเปล่า";
-"ui.hidden_by_system.title" = "ส่วนประกอบ eul บนแถบเมนูสถานะถูกบังคับซ่อนโดยระบบ";
+"ui.hidden_by_system.title" = "ส่วนประกอบของ eul บนแถบเมนูสถานะถูกบังคับซ่อนโดยระบบ";
 "ui.hidden_by_system.message" = "เปิดการตั้งค่าและลองลดจำนวนส่วนประกอบ";
 "ui.hidden_by_system.open" = "เปิด";
 "ui.hidden_by_system.dismiss" = "ไม่สนใจ";
-"ui.check_status_item_visibility" = "ตรวจสอบสถานะรายการการมองเห็น";
+"ui.check_status_item_visibility" = "ตรวจสอบรายการการมองเห็นของสถานะ";
 "ui.upgrade_method" = "การอัพเดท";
 "ui.upgrade_method.none" = "ไม่";
 "ui.upgrade_method.none.description" = "eul จะไม่ตรวจสอบการอัพเดท";
```

---

### Incident Patch 3: `27a62360` (2021-06-09)
**Commit Message**: Fixing Hungarian translation

**File**: `Resource/hu.lproj/Localizable.strings` (modified, +2/-1)
```diff
@@ -131,7 +131,7 @@
 "disk.all" = "Összes meghajtó";
 
 // MARK: Language
-"language" = "語言";
+"language" = "Nyelv";
 "language.ar" = "العربية";
 "language.en" = "English";
 "language.zh-Hans" = "简体中文";
@@ -150,6 +150,7 @@
 "language.cs" = "Čeština";
 "language.it" = "Italiano";
 "language.hu" = "Magyar";
+"language.th" = "ไทย";
 
 // MARK: General UI
 "ui.app" = "App";
```

---

### Incident Patch 4: `ea454e87` (2021-02-13)
**Commit Message**: Improve and fix several changes suggested

**File**: `eul/AppDelegate.swift` (modified, +12/-1)
```diff
@@ -54,14 +54,25 @@ class AppDelegate: NSObject, NSApplicationDelegate, NSWindowDelegate {
         }
     }
 
+    func changeColorScheme() {
+        switch preferenceStore.appearanceMode {
+        case .light:
+            window.appearance = NSAppearance(named: .aqua)
+        case .dark:
+            window.appearance = NSAppearance(named: .darkAqua)
+        case .auto:
+            window.appearance = nil
+        }
+    }
+
     func applicationDidFinishLaunching(_: Notification) {
         let contentView = ContentView()
         window = NSWindow(
             contentRect: NSRect(x: 0, y: 0, width: 480, height: 300),
             styleMask: [.titled, .closable, .miniaturizable, .resizable, .fullSizeContentView],
             backing: .buffered, defer: false
         )
-
+        changeColorScheme()
         window.center()
         window.setFrameAutosaveName("Eul Preferences")
         window.contentView = NSHostingView(rootView: contentView.withGlobalEnvironmentObjects())
```

**File**: `eul/Schema/Preference.swift` (modified, +1/-10)
```diff
@@ -29,16 +29,7 @@ struct Preference {
         case light
 
         var description: String {
-            switch self {
-            case .auto:
-                return "appearance.auto".localized()
-
-            case .dark:
-                return "appearance.dark".localized()
-
-            case .light:
-                return "appearance.light".localized()
-            }
+            "appearance.\(rawValue)".localized()
         }
     }
 
```

**File**: `eul/StatusBar/StatusBarItem.swift` (modified, +13/-5)
```diff
@@ -84,6 +84,18 @@ class StatusBarItem: NSObject, NSMenuDelegate {
         }
     }
 
+    func changeColorScheme() {
+        let appearance = preferenceStore.appearanceMode
+        switch appearance {
+        case .dark:
+            changeNSWindowColorScheme(to: .darkAqua)
+        case .light:
+            changeNSWindowColorScheme(to: .aqua)
+        case .auto:
+            changeNSWindowColorScheme(to: nil)
+        }
+    }
+
     private func checkStatusItemVisibility() {
         if item.button?.window?.occlusionState.contains(.visible) == false {
             print("⚠️ status item hidden by system")
@@ -112,11 +124,7 @@ class StatusBarItem: NSObject, NSMenuDelegate {
         super.init()
 
         statusBarMenu.delegate = self
-        if preferenceStore.appearanceMode == .light {
-            statusBarMenu.appearance = NSAppearance(named: .aqua)
-        } else {
-            statusBarMenu.appearance = NSAppearance(named: .darkAqua)
-        }
+        changeColorScheme()
         item.autosaveName = named
         item.isVisible = false
 
```

**File**: `eul/StatusBar/StatusBarManager.swift` (modified, +22/-0)
```diff
@@ -19,6 +19,7 @@ class StatusBarManager {
     private var showComponentsCancellable: AnyCancellable?
     private var showIconCancellable: AnyCancellable?
     private var fontDesignCancellable: AnyCancellable?
+    private var appearanceModeCancellable: AnyCancellable?
     private let item = StatusBarItem()
 
     init() {
@@ -49,6 +50,9 @@ class StatusBarManager {
         fontDesignCancellable = preferenceStore.$fontDesign.sink { _ in
             self.refresh()
         }
+        appearanceModeCancellable = preferenceStore.$appearanceMode.sink { value in
+            self.changeColorScheme(to: Preference.appearance(rawValue: value.rawValue) ?? .auto)
+        }
     }
 
     func refresh() {
@@ -72,4 +76,22 @@ class StatusBarManager {
             item.changeNSWindowColorScheme(to: nil)
         }
     }
+
+    func changeColorScheme(to appearance: Preference.appearance) {
+        let window = NSApplication.shared.mainWindow
+        if appearance == .light {
+            let appearence = NSAppearance(named: .aqua)
+            window?.appearance = appearence
+            StatusBarManager.shared.changeNSWindowColorScheme(to: .aqua)
+
+        } else if appearance == .dark {
+            let appearence = NSAppearance(named: .darkAqua)
+            window?.appearance = appearence
+            StatusBarManager.shared.changeNSWindowColorScheme(to: .darkAqua)
+
+        } else {
+            window?.appearance = nil
+            StatusBarManager.shared.changeNSWindowColorScheme(to: nil)
+        }
+    }
 }
```

**File**: `eul/Store/PreferenceStore.swift` (modified, +1/-23)
```diff
@@ -58,11 +58,7 @@ class PreferenceStore: ObservableObject {
     @Published var checkStatusItemVisibility = true
     @Published var isUpdateAvailable: Bool? = false
     @Published var checkUpdateFailed = true
-    @Published var appearanceMode = Preference.appearance.auto {
-        didSet {
-            changeColorScheme()
-        }
-    }
+    @Published var appearanceMode = Preference.appearance.auto
 
     var json: JSON {
         JSON([
@@ -190,22 +186,4 @@ class PreferenceStore: ObservableObject {
             WidgetCenter.shared.reloadAllTimelines()
         }
     }
-
-    func changeColorScheme() {
-        let window = NSApplication.shared.mainWindow
-        if appearanceMode == .light {
-            let appearence = NSAppearance(named: .aqua)
-            window?.appearance = appearence
-            StatusBarManager.shared.changeNSWindowColorScheme(to: .aqua)
-
-        } else if appearanceMode == .dark {
-            let appearence = NSAppearance(named: .darkAqua)
-            window?.appearance = appearence
-            StatusBarManager.shared.changeNSWindowColorScheme(to: .darkAqua)
-
-        } else {
-            window?.appearance = nil
-            StatusBarManager.shared.changeNSWindowColorScheme(to: nil)
-        }
-    }
 }
```

---

### Incident Patch 5: `29f9a377` (2021-02-12)
**Commit Message**: Fixed typo

**File**: `Resource/fr.lproj/Localizable.strings` (modified, +1/-1)
```diff
@@ -122,7 +122,7 @@
 // MARK: Disk
 "disk.eject" = "Ejecter";
 "disk.select" = "Sélectionnez un disque";
-"disk.all" = "Tout les disques";
+"disk.all" = "Tous les disques";
 
 // MARK: Language
 "language" = "Langue";
```

---

### Incident Patch 6: `ec642920` (2021-02-12)
**Commit Message**: Fixing upgrade method store key

**File**: `eul/Store/PreferenceStore.swift` (modified, +1/-1)
```diff
@@ -172,7 +172,7 @@ class PreferenceStore: ObservableObject {
                 if let value = data["checkStatusItemVisibility"].bool {
                     checkStatusItemVisibility = value
                 }
-                if let raw = data["updateMethod"].string, let value = UpgradeMethod(rawValue: raw) {
+                if let raw = data["upgradeMethod"].string, let value = UpgradeMethod(rawValue: raw) {
                     upgradeMethod = value
                 }
             } catch {
```

---

### Incident Patch 7: `86f19999` (2021-02-12)
**Commit Message**: Print more debug info for Bluetooth

**File**: `eul/Store/BluetoothStore.swift` (modified, +16/-7)
```diff
@@ -75,14 +75,23 @@ class BluetoothStore: NSObject, ObservableObject {
             }
 
         devices.forEach {
-            if let peripheral = $0.peripheral {
-                if peripheral.state == .disconnected {
-                    cbCenteralManager?.connect(peripheral, options: nil)
-                } else if peripheral.state == .connected {
-                    if let batteryCharacteristics = batteryCharacteristicsDict[peripheral.identifier] {
-                        peripheral.readValue(for: batteryCharacteristics)
-                    }
+            Print("🔵🦷 fetching peripheral for device", $0.displayName, $0.address)
+
+            guard let peripheral = $0.peripheral else {
+                Print("⚠️ peripheral not found")
+                return
+            }
+
+            if peripheral.state == .disconnected {
+                Print("⚠️ peripheral not connected, trying to connect")
+                cbCenteralManager?.connect(peripheral, options: nil)
+            } else if peripheral.state == .connected {
+                Print("🔵🦷 peripheral connected, reading battery characteristics")
+                guard let batteryCharacteristics = batteryCharacteristicsDict[peripheral.identifier] else {
+                    Print("⚠️ battery characteristics for \($0.displayName) not found")
+                    return
                 }
+                peripheral.readValue(for: batteryCharacteristics)
             }
         }
     }
```

---

### Incident Patch 8: `56abfea4` (2021-02-12)
**Commit Message**: Print statistics in debug mode

**File**: `eul/Utilities/GPU.swift` (modified, +2/-0)
```diff
@@ -63,6 +63,8 @@ extension GPU {
                 return nil
             }
 
+            Print("📊 statistics", statistics)
+
             return Statistic(
                 pciMatch: pciMatch,
                 usagePercentage: usagePercentage,
```

---

### Incident Patch 9: `b7107dc5` (2021-02-12)
**Commit Message**: Bump SystemKit version to fix max capacity display on M1 Macs

**File**: `eul.xcodeproj/project.pbxproj` (modified, +1/-1)
```diff
@@ -2235,7 +2235,7 @@
 			repositoryURL = "https://github.com/gao-sun/SystemKit";
 			requirement = {
 				kind = upToNextMajorVersion;
-				minimumVersion = 0.0.10;
+				minimumVersion = 0.0.12;
 			};
 		};
 /* End XCRemoteSwiftPackageReference section */
```

**File**: `eul.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved` (modified, +2/-2)
```diff
@@ -33,8 +33,8 @@
         "repositoryURL": "https://github.com/gao-sun/SystemKit",
         "state": {
           "branch": null,
-          "revision": "36488fcbff94b59c14399f47b367206334c29ae8",
-          "version": "0.0.10"
+          "revision": "60fbc2e3ccb54850046703d4e32ab6ecccbaf046",
+          "version": "0.0.12"
         }
       }
     ]
```

#### Recent Merged Pull Requests:
- **PR #279** (closed): feat: Support Apple Silicon (M1/M2/M3) temperature sensors and optimize UI (@Wataruchan)
- **PR #277** (closed): docs: replace preview image with 2026 screenshot (@kevintsli)
- **PR #274** (closed): feat: Apple Silicon support + graph bar color picker (@nastarynaz)
- **PR #262** (closed): Polished the Korean translation and fixed some untranslated items (@ghost)
- **PR #239** (closed): Create pl.lproj (@naymapl)
- **PR #238** (2022-01-07): Create Localizable.strings (@naymapl)
- **PR #231** (closed): Fix GPU Temperature Sensor (@huijiewei)
- **PR #229** (2021-11-09): Update Localizable.strings (@stosumarte)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

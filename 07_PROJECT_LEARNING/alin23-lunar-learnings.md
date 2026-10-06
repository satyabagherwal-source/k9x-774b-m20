# Forensic Learning Record (Deep Inspection): alin23/Lunar

> **Canonical Artifact**: `07_PROJECT_LEARNING/alin23-lunar-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/alin23/Lunar](https://github.com/alin23/Lunar))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:29:52.465Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `alin23/Lunar`
- **Description**: Intelligent adaptive brightness for your external monitors
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 5716 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `Lunar/Data/Util.swift`
```
import Accelerate
import Atomics
import AXSwift
import Cocoa
import Combine
import Defaults
import Foundation
import Path
import Surge
import SwiftDate
import SwiftyMarkdown
import UserNotifications

typealias DisplayUUID = String

typealias FilePath = Path
func p(_ string: String) -> FilePath? {
    FilePath(string)
}

func displayIsInMirrorSet(_ id: CGDirectDisplayID) -> Bool {
    CGDisplayIsInMirrorSet(id) != 0
}

func displayIsInHardwareMirrorSet(_ id: CGDirectDisplayID) -> Bool {
    guard let primary = Display.getPrimaryMirrorScreen(id) else { return displayIsInMirrorSet(id) }
    return !primary.isDummy
}

@inline(__always) func isGeneric(_ id: CGDirectDisplayID) -> Bool {
    #if DEBUG
        return id == GENERIC_DISPLAY_ID || id == TEST_DISPLAY_ID
    #else
        return id == GENERIC_DISPLAY_ID || id == ALL_DISPLAYS_ID
    #endif
}

@inline(__always) func isGeneric(serial: String) -> Bool {
    #if DEBUG
        return serial == GENERIC_DISPLAY.serial || serial == TEST_DISPLAY.serial
    #else
        return serial == GENERIC_DISPLAY.serial || serial == ALL_DISPLAYS.serial
    #endif
}

@inline(__always) func isTestID(_ id: CGDirectDisplayID) -> Bool {
    #if DEBUG
//        return id == GENERIC_DISPLAY_ID
        return TEST_IDS.contains(id)
    #else
        return id == GENERIC_DISPLAY_ID
    #endif
}

@inline(__always) func isTestSerial(_ serial: String) -> Bool {
    #if DEBUG
        return TEST_SERIALS.contains(serial)
    #else
        return serial == GENERIC_DISPLAY.serial || serial == ALL_DISPLAYS.serial
    #endif
}

// MARK: - RequestTimeoutError

final class RequestTimeoutError: Error {}

// MARK: - ResponseError

struct ResponseError: Error {
    var statusCode: Int
}

// MARK: - ProcessStatus

struct ProcessStatus {
    var output: Data?
    var error: Data?
    var success: Bool

    var o: String? {
        output?.s?.trimmed
    }

    var e: String? {
        error?.s?.trimmed
    }
}

func stdout(of process: Process) -> Data? {
    let stdout = process.standardOutput as! FileHandle
    try? stdout.close()

    guard let path = process.environment?["__swift_stdout"],
          let stdoutFile = FileHandle(forReadingAtPath: path) else { return nil }
    if #available(macOS 10.15.4, *) {
        return try! stdoutFile.readToEnd()
    } else {
        return stdoutFile.readDataToEndOfFile()
    }
}

func stderr(of process: Process) -> Data? {
    let stderr = process.standardOutput as! FileHandle
    try? stderr.close()

    guard let path = process.environment?["__swift_stderr"],
          let stderrFile = FileHandle(forReadingAtPath: path) else { return nil }
    if #available(macOS 10.15.4, *) {
        return try! stderrFile.readToEnd()
    } else {
        return stderrFile.readDataToEndOfFile()
    }
}

func shellProc(_ launchPath: String = "/bin/sh", args: [String], env: [String: String]? = nil, devnull: Bool = false) -> Process? {
    guard !devnull else {
        let task = Process()
        task.launchPath = launchPath
        task.arguments = args
        task.environment = env ?? ProcessInfo.processInfo.environment
        task.standardOutput = FileHandle.nullDevice
        task.standardError = FileHandle.nullDevice

        do {
            try task.run()
        } catch {
            log.error("Error running \(launchPath) \(args): \(error)")
            return nil
        }
        return task
    }

    let outputDir = try! fm.url(
        for: .itemReplacementDirectory,
        in: .userDomainMask,
        appropriateFor: fm.homeDirectoryForCurrentUser,
        create: true
    )

    let stdoutFilePath = outputDir.appendingPathComponent("stdout").path
    fm.createFile(atPath: stdoutFilePath, contents: nil, attributes: nil)

    let stderrFilePath = outputDir.appendingPathComponent("stderr").path
    fm.createFile(atPath: stderrFilePath, contents: nil, attributes: nil)

    guard let stdoutFile = FileHandle(forWritingAtPath: stdoutFilePath),
          let stderrFile = FileHandle(forWritingAtPath: stderrFilePath)
    else {
        return nil
    }

    let task = Process()
    task.standardOutput = stdoutFile
    task.standardError = stderrFile
    task.launchPath = launchPath
    task.arguments = args

    var env = env ?? ProcessInfo.processInfo.environment
    env["__swift_stdout"] = stdoutFilePath
    env["__swift_stderr"] = stderrFilePath
    task.environment = env

    do {
        try task.run()
    } catch {
        log.error("Error running \(launchPath) \(args): \(error)")
        return nil
    }

    return task
}

func shell(
    _ launchPath: String = "/bin/sh",
    command: String,
    timeout: DateComponents? = nil,
    env: [String: String]? = nil,
    wait: Bool = true
) -> ProcessStatus {
    shell(launchPath, args: ["-c", command], timeout: timeout, env: env, wait: wait)
}

func shell(
    _ launchPath: String = "/bin/sh",
    args: [String],
    timeout: DateComponents? = nil,
    env: [String: String]? = nil,
    wait: Bool = true
) -> ProcessStatus {
    guard let task = shellProc(launchPath, args: args, env: env, devnull: !wait) else {
        return ProcessStatus(output: nil, error: nil, success: false)
    }

    guard wait else {
        return ProcessStatus(
            output: nil,
            error: nil,
            success: true
        )
    }

    guard let timeout else {
        task.waitUntilExit()
        return ProcessStatus(
            output: stdout(of: task),
            error: stderr(of: task),
            success: task.terminationStatus == 0
        )
    }

    let result = asyncNow(timeout: timeout) {
        print("Waiting for \(launchPath) \(args) to exit")
        task.waitUntilExit()
    }
    if result == .timedOut {
        task.terminate()
    }

    return ProcessStatus(
        output: stdout(of: task),
        error: stderr(of: task),
        success: task.terminationStatus == 0
    )
}

// MARK: - DispatchWorkItem

final class DispatchWorkItem {
    init(name: String, flags: DispatchWorkItemFlags = [], block: @escaping @convention(block) () -> Void) {
        workItem = Foundation.DispatchWorkItem(flags: flags, block: block)
        self.name = name
    }

    var name = ""
    var workItem: Foundation.DispatchWorkItem

    @inline(__always) var isCancelled: Bool {
        workItem.isCancelled
    }

    @discardableResult
    @inline(__always) func wait(for timeout: DateComponents?) -> DispatchTimeoutResult {
        guard let timeout else {
            return wait(for: 0)
        }
        return wait(for: timeout.timeInterval)
    }

    @inline(__always) func cancel() {
        workItem.cancel()
    }

    @discardableResult
    @inline(__always) func wait(for timeout: TimeInterval) -> DispatchTimeoutResult {
        #if DEBUG
            if timeout > 0 {
                log.verbose("Waiting for \(timeout) seconds on \(name)")
            } else {
                log.verbose("Waiting for \(name)")
            }
            defer { log.verbose("Done waiting for \(name)") }
        #endif

        if timeout > 0 {
            let result = workItem.wait(timeout: DispatchTime.now() + timeout)
            if result == .timedOut {
                workItem.cancel()
                #if DEBUG
                    log.verbose("Timed out after \(timeout) seconds on \(name)")
                #endif
            }
            return result
        } else {
            workItem.wait()
            return .success
        }
    }
}

// MARK: - DispatchSemaphore

final class DispatchSemaphore: CustomStringConvertible {
    init(value: Int, name: String) {
        sem = Foundation.DispatchSemaphore(value: value)
        self.name = name
    }

    var name = ""
    var sem: Foundation.DispatchSemaphore

    var description: String {
        "<DispatchSemaphore: \(name)>"
    }

    @discardableResult
    @inline(__always) func wait(for timeout: DateComponents?, context: Any? = nil) -> DispatchTimeoutResult {
        guard let timeout else {
            return wait(for: 0, context: context)
        }
        return wait(for: timeout.timeInterval, context: context)
    }

    @inline(__always) func signal() {
        sem.signal()
    }

    @discardableResult
    @inline(__always) func wait(for timeout: TimeInterval, context: Any? = nil) -> DispatchTimeoutResult {
        #if DEBUG
            if timeout > 0 {
                log.verbose("Waiting for \(timeout) seconds on \(name)", context: context)
            } else {
                log.verbose("Waiting for \(name)", context: context)
            }
            defer { log.verbose("Done waiting for \(name)", context: context) }
        #endif

        if timeout > 0 {
            return sem.wait(timeout: DispatchTime.now() + timeout)
        } else {
            sem.wait()
            return .success
        }
    }
}

#if DEBUG
    @inline(__always) func checkNaN(_ value: Double) {
        guard value.isNaN else { return }
        err("NaN!")
        kill(getpid(), SIGSTOP)
    }
    @inline(__always) func checkNaN(_ value: Float) {
        guard value.isNaN else { return }
        err("NaN!")
        kill(getpid(), SIGSTOP)
    }
#else
    @inline(__always) func checkNaN(_: Double) {}
    @inline(__always) func checkNaN(_: Float) {}
#endif

import SwiftyJSON

func queryJSON(url: URL, timeout: TimeInterval = 0, _ action: @escaping (JSON) -> Void) -> AnyCancellable {
    query(url: url, timeout: timeout)
        .map(\.data)
        .catch { error -> Just<Data> in
            log.error("Error requesting \(url.host ?? ""): \(error)")
            return Just(Data())
        }
        .sink { data in
            guard !data.isEmpty else { return }
            let json = JSON(data)
            guard json != JSON.null else { return }
            action(json)
        }
}

func session(timeout: TimeInterval = 0) -> URLSession {
    if timeout == 0 {
        return URLSession.shared
    }

    let key = "URLSession: timeout=\(timeout)"
    guard let session = Thread.current.threadDi
```

### Core Architecture Module: `Lunar/Utils/Ciao.swift`
```
//
//  Ciao.swift
//  Lunar
//
//  Created by Alin Panaitiu on 05.06.2021.
//  Copyright © 2021 Alin. All rights reserved.
//

import Foundation

// MARK: - CiaoBrowser

//
//  CiaoBrowser.swift
//  Ciao
//
//  Created by Alexandre Tavares on 11/10/17.
//  Copyright © 2017 Tavares. All rights reserved.
//

final class CiaoBrowser {
    init() {
        netServiceBrowser = NetServiceBrowser()
        delegate = CiaoBrowserDelegate()
        netServiceBrowser.delegate = delegate
        delegate.browser = self
        netServiceBrowser.remove(from: RunLoop.current, forMode: .default)
        serviceBrowserQueue.syncSafe {
            self.netServiceBrowser.schedule(in: RunLoop.current, forMode: .default)
        }
    }

    deinit {
        #if DEBUG
            log.verbose("START DEINIT")
            defer { log.verbose("END DEINIT") }
        #endif
        stop()

        services.removeAll()
        netServiceBrowser.delegate = nil
    }

    var services = Set<NetService>()

    // Handlers
    var serviceFoundHandler: ((NetService) -> Void)?
    var serviceRemovedHandler: ((NetService) -> Void)?
    var serviceResolvedHandler: ((Result<NetService, ErrorDictionary>) -> Void)?
    var serviceUpdatedTXTHandler: ((NetService) -> Void)?

    var netServiceBrowser: NetServiceBrowser
    var delegate: CiaoBrowserDelegate

    var isSearching = false {
        didSet {
            log.info(isSearching.s)
        }
    }

    func browse(type: ServiceType, domain: String = "") {
        browse(type: type.description, domain: domain)
    }

    func browse(type: String, domain: String = "") {
        netServiceBrowser.searchForServices(ofType: type, inDomain: domain)
    }

    func reset() {
        SwiftyLogger.info("Resetting browser")
        stop()
        services.removeAll()

//        netServiceBrowser.delegate = nil
//        netServiceBrowser = NetServiceBrowser()
//        netServiceBrowser.delegate = delegate
    }

    func stop() {
        for service in services {
            service.stopMonitoring()
        }

        serviceBrowserQueue.syncSafe {
            self.netServiceBrowser.stop()
        }
    }

    fileprivate func serviceFound(_ service: NetService) {
        serviceBrowserQueue.syncSafe {
            service.schedule(in: RunLoop.current, forMode: .default)
        }
        service.startMonitoring()
        services.update(with: service)
        serviceFoundHandler?(service)

        // resolve services if handler is registered
        guard let serviceResolvedHandler else { return }
        var resolver: CiaoResolver? = CiaoResolver(service: service)
        resolver?.resolve(withTimeout: 0) { result in
            serviceResolvedHandler(result)
            // retain resolver until resolution
            resolver = nil
        }
    }

    fileprivate func serviceRemoved(_ service: NetService) {
        services.remove(service)
        serviceRemovedHandler?(service)
    }

    fileprivate func serviceUpdatedTXT(_ service: NetService, _ txtRecord: Data) {
        service.setTXTRecord(txtRecord)
        serviceUpdatedTXTHandler?(service)
    }
}

// MARK: - CiaoBrowserDelegate

final class CiaoBrowserDelegate: NSObject, NetServiceBrowserDelegate {
    weak var browser: CiaoBrowser?
    var onStop: (() -> Void)?

    func netServiceBrowser(_: NetServiceBrowser, didFind service: NetService, moreComing _: Bool) {
        SwiftyLogger.info("Service found \(service)")
        browser?.serviceFound(service)
    }

    func netServiceBrowserWillSearch(_: NetServiceBrowser) {
//        Logger.info("Browser will search")
        browser?.isSearching = true
    }

    func netServiceBrowserDidStopSearch(_: NetServiceBrowser) {
//        Logger.info("Browser stopped search")
        browser?.isSearching = false
        onStop?()
    }

    func netServiceBrowser(_: NetServiceBrowser, didNotSearch _: [String: NSNumber]) {
//        Logger.debug("Browser didn't search \(errorDict)")
        browser?.isSearching = false
    }

    func netServiceBrowser(_: NetServiceBrowser, didRemove service: NetService, moreComing _: Bool) {
//        Logger.info("Service removed \(service)")
        browser?.serviceRemoved(service)
    }

    func netService(_ sender: NetService, didUpdateTXTRecord data: Data) {
//        Logger.info("Service updated txt records \(sender)")
        browser?.serviceUpdatedTXT(sender, data)
    }

}

// MARK: - CiaoResolver

//
//  CiaoResolver.swift
//  Ciao
//
//  Created by Alexandre Mantovani Tavares on 14/07/19.
//

final class CiaoResolver {
    init(service: NetService) {
        self.service = service
    }

    deinit {
        #if DEBUG
            log.verbose("START DEINIT")
            defer { log.verbose("END DEINIT") }
        #endif
        log.verbose(String(describing: self))
        service.stop()
    }

    let service: NetService
    let delegate = CiaoResolverDelegate()

    func resolve(withTimeout timeout: TimeInterval, completion: @escaping (Result<NetService, ErrorDictionary>) -> Void) {
        delegate.onResolve = completion
        service.delegate = delegate
        service.resolve(withTimeout: timeout)
    }

}

typealias ErrorDictionary = [String: Int]

// MARK: Error

extension ErrorDictionary: @retroactive Error {}

// MARK: - CiaoResolver.CiaoResolverDelegate

extension CiaoResolver {
    final class CiaoResolverDelegate: NSObject, NetServiceDelegate {
        var onResolve: ((Result<NetService, ErrorDictionary>) -> Void)?

        func netService(_ sender: NetService, didNotResolve errorDict: [String: NSNumber]) {
            SwiftyLogger.error("Service didn't resolve \(sender) \(errorDict)")
            onResolve?(Result.failure(errorDict.mapValues { $0.intValue }))
        }

        func netServiceDidResolveAddress(_ sender: NetService) {
            SwiftyLogger.info("Service resolved \(sender)")
            onResolve?(Result.success(sender))
        }

        func netServiceWillResolve(_ sender: NetService) {
            SwiftyLogger.info("Service will resolve \(sender)")
        }
    }
}

// MARK: - CiaoServer

//
//  CiaoService.swift
//  Ciao
//
//  Created by Alexandre Tavares on 10/10/17.
//  Copyright © 2017 Tavares. All rights reserved.
//

final class CiaoServer {
    convenience init(type: ServiceType, domain: String = "", name: String = "", port: Int32 = 0) {
        self.init(type: type.description, domain: domain, name: name, port: port)
    }

    init(type: String, domain: String = "", name: String = "", port: Int32 = 0) {
        netService = NetService(domain: domain, type: type, name: name, port: port)
        delegate = CiaoServerDelegate()
        delegate?.server = self
        netService.delegate = delegate
    }

    deinit {
        #if DEBUG
            log.verbose("START DEINIT")
            defer { log.verbose("END DEINIT") }
        #endif
        stop()
        netService.delegate = nil
        delegate = nil
    }

    var netService: NetService
    var delegate: CiaoServerDelegate?
    var successCallback: ((Bool) -> Void)?

    fileprivate(set) var started = false {
        didSet {
            successCallback?(started)
            successCallback = nil
        }
    }

    var txtRecord: [String: String]? {
        get {
            netService.txtRecordDictionary
        }
        set {
            netService.setTXTRecord(dictionary: newValue)
            SwiftyLogger.info("TXT Record updated \(newValue ?? [:])")
        }
    }

    func start(options: NetService.Options = [], success: ((Bool) -> Void)? = nil) {
        if started {
            success?(true)
            return
        }
        successCallback = success
        netService.schedule(in: RunLoop.current, forMode: RunLoop.Mode.common)
        netService.publish(options: options)
    }

    func stop() {
        netService.stop()
    }

}

// MARK: - CiaoServerDelegate

final class CiaoServerDelegate: NSObject, NetServiceDelegate {
    weak var server: CiaoServer?

    func netServiceDidPublish(_: NetService) {
        server?.started = true
        SwiftyLogger.info("CiaoServer Started")
    }

    func netService(_: NetService, didNotPublish errorDict: [String: NSNumber]) {
        server?.started = false
        SwiftyLogger.error("CiaoServer did not publish \(errorDict)")
    }

    func netServiceDidStop(_: NetService) {
        server?.started = false
        SwiftyLogger.info("CiaoServer Stopped")
    }
}

// MARK: - Level

//
//  Logger.swift
//  Ciao
//
//  Created by Alexandre Tavares on 11/10/17.
//  Copyright © 2017 Tavares. All rights reserved.
//

enum Level: Int {
    case verbose = 0
    case debug = 1
    case info = 2
    case warning = 3
    case error = 4

    var description: String {
        switch self {
        case .verbose:
            "verbose"
        case .debug:
            "debug"
        case .info:
            "info"
        case .warning:
            "warning"
        case .error:
            "error"
        }
    }
}

//
//  NetServiceExtension.swift
//  Ciao
//
//  Created by Alexandre Tavares on 11/10/17.
//  Copyright © 2017 Tavares. All rights reserved.
//

extension NetService {
    class func dictionary(fromTXTRecord data: Data) -> [String: String] {
        NetService.dictionary(fromTXTRecord: data).mapValues { data in
            String(data: data, encoding: .utf8) ?? ""
        }
    }

    class func data(fromTXTRecord data: [String: String]) -> Data {
        NetService.data(fromTXTRecord: data.mapValues { $0.data(using: .utf8) ?? Data() })
    }

    func setTXTRecord(dictionary: [String: String]?) {
        guard let dictionary else {
            setTXTRecord(nil)
            return
        }
        setTXTRecord(NetService.data(fromTXTRecord: dictionary))
    }

    var txtRecordDictionary: [String: String]? {
        guard let data = txtRecordData() else { return nil }
        return NetService.dictionary(fromTXTRecord: data)
    }
}

// MARK: - ServiceType

//
//  ServiceType.swift
//  Ciao
//

```

### Core Architecture Module: `Lunar/Utils/DisplayController.swift`
```
//
//  DisplayController.swift
//  Lunar
//
//  Created by Alin on 02/12/2017.
//  Copyright © 2017 Alin. All rights reserved.
//

import AnyCodable
import AXSwift
import Cocoa
import Combine
import CoreLocation
import Defaults
import Foundation
import MacModelDB
import MediaKeyTap
import Sentry
import Surge
import SwiftDate
import SwiftUI
import SwiftyJSON

#if canImport(FuzzyMatcher)
    import FuzzyMatcher
#else
    extension [String] {
        func fuzzyFind(_ pattern: String) -> String? {
            self.first
        }
    }
#endif

func IOServiceLocation(_ service: io_service_t) -> String? {
    IORegistryEntryCopyPath(service, kIOServicePlane)?.takeRetainedValue() as? String
}

func IOServiceFirstMatchingWhere(_ matching: CFDictionary, where predicate: (io_service_t) -> Bool) -> io_service_t? {
    var ioIterator = io_iterator_t()

    guard IOServiceGetMatchingServices(kIOMasterPortDefault, matching, &ioIterator) == KERN_SUCCESS
    else {
        return nil
    }

    defer { IOObjectRelease(ioIterator) }
    while case let ioService = IOIteratorNext(ioIterator), ioService != 0 {
        if predicate(ioService) {
            return ioService
        }
        IOObjectRelease(ioService)
    }
    return nil
}

#if arch(arm64)
    let DCP_NAMES = ["dcp", "dcpext", "dcp0"] + (0 ... 7).map { "dcpext\($0)" }
    let DISP_NAMES = ["disp"] + (0 ... 7).map { "dispext\($0)" } + (0 ... 7).map { "disp\($0)" }

    func IOServiceNameMatches(_ service: io_service_t, names: [String]) -> Bool {
        guard let name = IOServiceName(service) else { return false }
        return names.contains(name)
    }

    func IOServiceParentName(_ service: io_service_t) -> String? {
        var serv: io_service_t = 0
        IORegistryEntryGetParentEntry(service, kIOServicePlane, &serv)

        guard serv != 0 else { return nil }
        return IOServiceName(serv)
    }

    func IOServiceName(_ service: io_service_t) -> String? {
        let deviceNamePtr = UnsafeMutablePointer<CChar>.allocate(capacity: MemoryLayout<io_name_t>.size)
        defer { deviceNamePtr.deallocate() }
        deviceNamePtr.initialize(repeating: 0, count: MemoryLayout<io_name_t>.size)
        defer { deviceNamePtr.deinitialize(count: MemoryLayout<io_name_t>.size) }

        let kr = IORegistryEntryGetName(service, deviceNamePtr)
        if kr != KERN_SUCCESS {
            return nil
        }

        return String(cString: deviceNamePtr)
    }

    func DCPAVServiceHasLocation(_ dcpAvServiceProxy: io_service_t, location: AVServiceLocation) -> Bool {
        guard let avServiceLocation: String = IOServiceProperty(dcpAvServiceProxy, "Location") else {
            return false
        }
        return avServiceLocation == location.rawValue
    }

    enum AVServiceLocation: String {
        case embedded = "Embedded"
        case external = "External"
    }

    func DCPAVServiceExists(location: AVServiceLocation) -> Bool {
        var ioIterator = io_iterator_t()

        let res = IOServiceGetMatchingServices(kIOMasterPortDefault, IOServiceNameMatching("DCPAVServiceProxy"), &ioIterator)

        guard res == KERN_SUCCESS else {
            return false
        }

        defer {
            assert(IOObjectRelease(ioIterator) == KERN_SUCCESS)
        }
        while case let ioService = IOIteratorNext(ioIterator), ioService != 0 {
            defer { IOObjectRelease(ioService) }
            if DCPAVServiceHasLocation(ioService, location: location) {
                return true
            }
        }

        return false
    }

    func IOServiceFirstChildMatchingRecursively(_ service: io_service_t, names: [String]) -> io_service_t? {
        var iterator = io_iterator_t()

        guard IORegistryEntryCreateIterator(
            service, kIOServicePlane, IOOptionBits(kIORegistryIterateRecursively), &iterator
        ) == KERN_SUCCESS
        else {
//            log.verbose("Can't create iterator for service \(service): (names: \(names))")
            return nil
        }

        defer {
            IOObjectRelease(iterator)
        }
//        log.verbose("Looking for service (names: \(names)) in iterator \(iterator)")
        return IOServiceFirstMatchingInIterator(iterator, names: names)
    }

    func IOServiceFirstMatchingInIterator(_ iterator: io_iterator_t, names: [String]) -> io_service_t? {
        var service: io_service_t?

        while case let txIOChild = IOIteratorNext(iterator), txIOChild != 0 {
            if IOServiceNameMatches(txIOChild, names: names) {
                service = txIOChild
//                log.verbose("Found service \(txIOChild) in iterator \(iterator): (names: \(names))")
                break
            }
            IOObjectRelease(txIOChild)
        }

        return service
    }

    // MARK: - AVServiceMatch

    enum AVServiceMatch {
        case byEDIDUUID
        case byProductAttributes
        case byExclusion
    }

    final class DCP: CustomStringConvertible, Hashable, Equatable {
        deinit {
            #if !DEBUG
                IOObjectRelease(dispService)
                IOObjectRelease(dcpService)
                IOObjectRelease(dcpAvServiceProxy)
                IOObjectRelease(clcd2Service)
            #endif
        }

        init?(dispService: io_service_t, txIOIterator: io_iterator_t, index: Int) {
            guard let dispName = IOServiceName(dispService), DISP_NAMES.contains(dispName) else {
                return nil
            }

            guard let dcpService = IOServiceFirstMatchingInIterator(txIOIterator, names: DCP_NAMES),
                  let dcpName = IOServiceName(dcpService),
                  let dcpAvServiceProxy = IOServiceFirstChildMatchingRecursively(dcpService, names: ["DCPAVServiceProxy"])
            else {
                log.debug("No DCPAVServiceProxy for \(dispName)")
                return nil
            }

            guard let avService = AVServiceCreateFromDCPAVServiceProxy(dcpAvServiceProxy)?.takeRetainedValue(),
                  !CFEqual(avService, 0 as IOAVService), DCPAVServiceHasLocation(dcpAvServiceProxy, location: .external)
            else {
                log.debug("No AVService for \(dispName)")
                return nil
            }

            guard let clcd2Service = IOServiceFirstChildMatchingRecursively(dispService, names: ["AppleCLCD2", "IOMobileFramebufferShim"])
            else {
                log.debug("No AppleCLCD2/IOMobileFramebufferShim for \(dispName)")
                return nil
            }

            var clcd2ServiceProperties: Unmanaged<CFMutableDictionary>?
            var displayProps = [String: Any]()

            let kernResult = IORegistryEntryCreateCFProperties(
                clcd2Service, &clcd2ServiceProperties, kCFAllocatorDefault, IOOptionBits()
            )
            if kernResult == KERN_SUCCESS, let cfProps = clcd2ServiceProperties,
               let props = cfProps.takeRetainedValue() as? [String: Any]
            {
                displayProps = props
            } else {
                log.debug("No display props for service \(dispName)")
            }

            guard let edidUUID = (displayProps["EDID UUID"] as? String) ?? (displayProps["IOMFBUUID"] as? String), !edidUUID.isEmpty
            else {
                log.debug("No EDID UUID for service \(dispName)")
                return nil
            }

            var transport: Transport?
            if let transportDict = displayProps["Transport"] as? [String: String] {
                transport = Transport(
                    upstream: transportDict["Upstream"] ?? "",
                    downstream: transportDict["Downstream"] ?? ""
                )
            }

            var displayAttributes = displayProps["DisplayAttributes"] as? [String: Any] ?? [:]
            displayAttributes.removeValue(forKey: "TimingElements")
            displayAttributes.removeValue(forKey: "ColorElements")

            let productAttributes = displayAttributes["ProductAttributes"] as? [String: Any] ?? [:]

            self.index = index
            self.dispService = dispService
            self.dcpService = dcpService
            self.dcpAvServiceProxy = dcpAvServiceProxy
            self.clcd2Service = clcd2Service
            self.dispName = dispName
            self.dcpName = dcpName
            self.avService = avService
            self.edidUUID = edidUUID
            isMCDP = isMCDP29XX(dcpAvServiceProxy: dcpAvServiceProxy)
            self.displayProps = displayAttributes
            self.transport = transport
            productName = productAttributes["ProductName"] as? String
            productID = productAttributes["ProductID"] as? Int
            serialNumber = productAttributes["SerialNumber"] as? Int
            yearOfManufacture = productAttributes["YearOfManufacture"] as? Int
            manufacturerID = productAttributes["ManufacturerID"] as? String
            legacyManufacturerID = productAttributes["LegacyManufacturerID"] as? Int
            nativeFormatHorizontalPixels = productAttributes["NativeFormatHorizontalPixels"] as? Int
            nativeFormatVerticalPixels = productAttributes["NativeFormatVerticalPixels"] as? Int
        }

        let index: Int

        let dispService: io_service_t
        let dcpService: io_service_t
        let dcpAvServiceProxy: io_service_t
        let clcd2Service: io_service_t

        let dispName: String
        let dcpName: String

        let avService: IOAVService
        let edidUUID: String?
        let isMCDP: Bool
        let displayProps: [String: Any]
        let transport: Transport?

        let productName: String?
        let productID: Int?
        let serialNumber: Int?
        let yearOfManufacture: Int?

        let manufacturerID: String?
        let legacyManufacturerID: Int?
        let nativeFormatHorizontalPixels: Int?
        let nativeFormatVerticalPixels: Int?

        var scores: [CGDirectDisplayID: Int] = [:]

        var scoreDict: [String: Int] {
   
```

### Core Architecture Module: `Lunar/Utils/Extensions.swift`
```
//
//  Extensions.swift
//  Lunar
//
//  Created by Alin Panaitiu on 29.12.2020.
//  Copyright © 2020 Alin. All rights reserved.
//

import Cocoa
import Combine
import Foundation
import Surge

extension String {
    func asURL() -> URL? {
        URL(string: self)
    }
}

extension NSView {
    func bringSubviewToFront(_ view: NSView) {
        var theView = view
        withUnsafeMutablePointer(to: &theView) { rawPointer in
            sortSubviews({ viewA, viewB, rawPointer in
                let view = rawPointer?.load(as: NSView.self)

                switch view {
                case viewA:
                    return ComparisonResult.orderedDescending
                case viewB:
                    return ComparisonResult.orderedAscending
                default:
                    return ComparisonResult.orderedSame
                }
            }, context: rawPointer)
        }
    }
}

extension DispatchQueue {
    private struct QueueReference { weak var queue: DispatchQueue? }

    private static let key: DispatchSpecificKey<QueueReference> = {
        let key = DispatchSpecificKey<QueueReference>()
        setupSystemQueuesDetection(key: key)
        return key
    }()

    private static func _registerDetection(of queues: [DispatchQueue], key: DispatchSpecificKey<QueueReference>) {
        queues.forEach { $0.setSpecific(key: key, value: QueueReference(queue: $0)) }
    }

    private static func setupSystemQueuesDetection(key: DispatchSpecificKey<QueueReference>) {
        let queues: [DispatchQueue] = [
            .main,
            .global(qos: .background),
            .global(qos: .default),
            .global(qos: .unspecified),
            .global(qos: .userInitiated),
            .global(qos: .userInteractive),
            .global(qos: .utility),
            concurrentQueue,
            serialQueue,
            serviceBrowserQueue,
            windowControllerQueue,
            smoothDDCQueue,
            smoothDisplayServicesQueue,
            gammaQueue,
        ]
        _registerDetection(of: queues, key: key)
    }
}

extension DispatchQueue {
    static func registerDetection(of queue: DispatchQueue) {
        _registerDetection(of: [queue], key: key)
    }

    static var currentQueueLabel: String? { current?.label }
    static var current: DispatchQueue? { getSpecific(key: key)?.queue }
}

extension BinaryInteger {
    @inline(__always) @inlinable var ns: NSNumber {
        NSNumber(value: d)
    }

    @inline(__always) @inlinable var d: Double {
        Double(self)
    }

    @inline(__always) @inlinable var cg: CGGammaValue {
        CGGammaValue(self)
    }

    @inline(__always) @inlinable var f: Float {
        Float(self)
    }

    @inline(__always) @inlinable var u: UInt {
        UInt(max(self, 0))
    }

    @inline(__always) @inlinable var u8: UInt8 {
        UInt8(max(self, 0))
    }

    @inline(__always) @inlinable var u16: UInt16 {
        UInt16(max(self, 0))
    }

    @inline(__always) @inlinable var u32: UInt32 {
        UInt32(max(self, 0))
    }

    @inline(__always) @inlinable var u64: UInt64 {
        UInt64(max(self, 0))
    }

    @inline(__always) @inlinable var i: Int {
        Int(self)
    }

    @inline(__always) @inlinable var i8: Int8 {
        Int8(self)
    }

    @inline(__always) @inlinable var i16: Int16 {
        Int16(self)
    }

    @inline(__always) @inlinable var i32: Int32 {
        Int32(cap(Int(self), minVal: Int(Int32.min), maxVal: Int(Int32.max)))
    }

    @inline(__always) @inlinable var i64: Int64 {
        Int64(self)
    }

    @inline(__always) @inlinable var s: String {
        String(self)
    }

    func asPercentage(of value: Self, decimals: UInt8 = 2) -> String {
        "\(((d / value.d) * 100.0).str(decimals: decimals))%"
    }
}

extension Bool {
    @inline(__always) @inlinable var i: Int {
        self ? 1 : 0
    }

    @inline(__always) @inlinable var s: String {
        self ? "true" : "false"
    }

    @inline(__always) @inlinable var state: NSControl.StateValue {
        self ? .on : .off
    }
}

extension [CGGammaValue] {
    func str(decimals: UInt8) -> String {
        map { $0.str(decimals: decimals) }.joined(separator: ", ")
    }
}

extension NSColor {
    var hsb: (Int, Int, Int) {
        let c = usingColorSpace(.extendedSRGB) ?? self
        return (
            (c.hueComponent * 360).intround,
            (c.saturationComponent * 100).intround,
            (c.brightnessComponent * 100).intround
        )
    }

    func with(hue: CGFloat? = nil, saturation: CGFloat? = nil, brightness: CGFloat? = nil, alpha: CGFloat? = nil) -> NSColor {
        let c = usingColorSpace(.extendedSRGB) ?? self
        return NSColor(
            hue: cap(c.hueComponent + (hue ?? 0), minVal: 0, maxVal: 1),
            saturation: cap(c.saturationComponent + (saturation ?? 0), minVal: 0, maxVal: 1),
            brightness: cap(c.brightnessComponent + (brightness ?? 0), minVal: 0, maxVal: 1),
            alpha: cap(c.alphaComponent + (alpha ?? 0), minVal: c.alphaComponent > 0 ? 0.1 : 0, maxVal: 1)
        )
    }
}

@usableFromInline let CHARS_NOT_STRIPPED = Set("abcdefghijklmnopqrstuvwxyz ABCDEFGHIJKLKMNOPQRSTUVWXYZ1234567890+-=().!_")
extension String {
    func parseHex(strict: Bool = false) -> Int? {
        guard !strict || starts(with: "0x") || starts(with: "x") || hasSuffix("h") else { return nil }

        var sub = self

        if sub.starts(with: "0x") {
            sub = String(sub.suffix(from: sub.index(sub.startIndex, offsetBy: 2)))
        }

        if sub.starts(with: "x") {
            sub = String(sub.suffix(from: sub.index(after: sub.startIndex)))
        }

        if sub.hasSuffix("h") {
            sub = String(sub.prefix(sub.count - 1))
        }

        return Int(sub, radix: 16)
    }

    @inline(__always) @inlinable var stripped: String {
        filter { CHARS_NOT_STRIPPED.contains($0) }
    }

    @inline(__always) @inlinable var trimmed: String {
        trimmingCharacters(in: .whitespacesAndNewlines)
    }

    @inline(__always) @inlinable var d: Double? {
        Double(replacingOccurrences(of: ",", with: "."))
        // NumberFormatter.shared.number(from: self)?.doubleValue
    }

    @inline(__always) @inlinable var f: Float? {
        Float(replacingOccurrences(of: ",", with: "."))
        // NumberFormatter.shared.number(from: self)?.floatValue
    }

    @inline(__always) @inlinable var u: UInt? {
        UInt(self)
    }

    @inline(__always) @inlinable var u8: UInt8? {
        UInt8(self)
    }

    @inline(__always) @inlinable var u16: UInt16? {
        UInt16(self)
    }

    @inline(__always) @inlinable var u32: UInt32? {
        UInt32(self)
    }

    @inline(__always) @inlinable var u64: UInt64? {
        UInt64(self)
    }

    @inline(__always) @inlinable var i: Int? {
        Int(self)
    }

    @inline(__always) @inlinable var i8: Int8? {
        Int8(self)
    }

    @inline(__always) @inlinable var i16: Int16? {
        Int16(self)
    }

    @inline(__always) @inlinable var i32: Int32? {
        Int32(self)
    }

    @inline(__always) @inlinable var i64: Int64? {
        Int64(self)
    }

    func replacingFirstOccurrence(of target: String, with replacement: String) -> String {
        guard let range = range(of: target) else { return self }
        return replacingCharacters(in: range, with: replacement)
    }

    func titleCase() -> String {
        replacingOccurrences(
            of: "([A-Z])",
            with: " $1",
            options: .regularExpression,
            range: range(of: self)
        )
        .trimmingCharacters(in: .whitespacesAndNewlines)
        .capitalized
    }
}

extension Substring.SubSequence {
    var s: String { String(self) }
}

extension String.SubSequence {
    @inline(__always) @inlinable var u32: UInt32? {
        UInt32(self)
    }

    @inline(__always) @inlinable var i32: Int32? {
        Int32(self)
    }

    @inline(__always) @inlinable var d: Double? {
        Double(self)
    }
}

extension Collection {
    /// Returns the element at the specified index if it is within bounds, otherwise nil.
    subscript(safe index: Index) -> Element? {
        indices.contains(index) ? self[index] : nil
    }
}

extension Data {
    var s: String? { String(data: self, encoding: .utf8) }
    func str(hex: Bool = false, base64: Bool = false, urlSafe: Bool = false, separator: String = " ") -> String {
        if base64 {
            let b64str = base64EncodedString(options: [])
            return urlSafe ? b64str.addingPercentEncoding(withAllowedCharacters: .alphanumerics) ?? b64str : b64str
        }

        if hex {
            let hexstr = map(\.hex).joined(separator: separator)
            return urlSafe ? hexstr.addingPercentEncoding(withAllowedCharacters: .alphanumerics) ?? hexstr : hexstr
        }

        if let string = String(data: self, encoding: .utf8) {
            return urlSafe ? string.addingPercentEncoding(withAllowedCharacters: .alphanumerics) ?? string : string
        }

        let rawstr = compactMap { String(Character(Unicode.Scalar($0))) }.joined(separator: separator)
        return urlSafe ? rawstr.addingPercentEncoding(withAllowedCharacters: .alphanumerics) ?? rawstr : rawstr
    }
}

extension [Character] {
    func str() -> String {
        String(self)
    }
}

extension [UInt8] {
    func str(hex: Bool = false, base64: Bool = false, urlSafe: Bool = false, separator: String = " ") -> String {
        if base64 {
            return Data(bytes: self, count: count).str(hex: hex, base64: base64, urlSafe: urlSafe, separator: separator)
        }

        if !hex, !contains(where: { n in !(0x20 ... 0x7E).contains(n) }),
           let value = NSString(bytes: self, length: count, encoding: String.Encoding.nonLossyASCII.rawValue) as String?
        {
            return urlSafe ? value.addingPercentEncoding(withAllowedCharacters: .alphanumerics) ?? value : value
        }

        let hexstr = map { n in St
```

### Core Architecture Module: `Lunar/Utils/LoginServiceKit.swift`
```
//
//  LoginServiceKit.swift
//
//  LoginServiceKit
//  GitHub: https://github.com/clipy
//  HP: https://clipy-app.com
//
//  Copyright © 2015-2020 Clipy Project.
//

//
//  Some code copyright 2009 Naotaka Morimoto.
//
//    Much of this code was taken and adapted from GTMLoginItems of Google
//    Toolbox for Mac and QSBPreferenceWindowController of Quick Search Box
//    for the Mac by Google Inc.
//    This code is also released under Apache License, Version 2.0.
//

//  Copyright (c) 2008-2009 Google Inc. All rights reserved.
//
//  Redistribution and use in source and binary forms, with or without
//  modification, are permitted provided that the following conditions are
//  met:
//
//    * Redistributions of source code must retain the above copyright
//  notice, this list of conditions and the following disclaimer.
//    * Redistributions in binary form must reproduce the above
//  copyright notice, this list of conditions and the following disclaimer
//  in the documentation and/or other materials provided with the
//  distribution.
//    * Neither the name of Google Inc. nor the names of its
//  contributors may be used to endorse or promote products derived from
//  this software without specific prior written permission.
//
//  THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
//  "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
//  LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
//  A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
//  OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
//  SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
//  LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
//  DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
//  THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
//  (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
//  OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
//

import Cocoa

// MARK: - LoginServiceKit

final class LoginServiceKit: NSObject {}

extension LoginServiceKit {
    static func isExistLoginItems(at path: String = Bundle.main.bundlePath) -> Bool {
        loginItem(at: path) != nil
    }

    @discardableResult
    static func addLoginItems(at path: String = Bundle.main.bundlePath) -> Bool {
        guard !isExistLoginItems(at: path) else { return false }

        guard let sharedFileList = LSSharedFileListCreate(nil, kLSSharedFileListSessionLoginItems.takeRetainedValue(), nil)
        else { return false }
        let loginItemList = sharedFileList.takeRetainedValue()
        let url = URL(fileURLWithPath: path) as CFURL

        let loginItemsListSnapshot: CFArray? = LSSharedFileListCopySnapshot(loginItemList, nil)?.takeRetainedValue()
        guard let loginItems = loginItemsListSnapshot as? [LSSharedFileListItem], let last = loginItems.last else { return false }

        LSSharedFileListInsertItemURL(loginItemList, last, nil, nil, url, nil, nil)
        return true
    }

    @discardableResult
    static func removeLoginItems(at path: String = Bundle.main.bundlePath) -> Bool {
        guard isExistLoginItems(at: path) else { return false }

        guard let sharedFileList = LSSharedFileListCreate(nil, kLSSharedFileListSessionLoginItems.takeRetainedValue(), nil)
        else { return false }
        let loginItemList = sharedFileList.takeRetainedValue()
        let url = URL(fileURLWithPath: path)
        let loginItemsListSnapshot: CFArray? = LSSharedFileListCopySnapshot(loginItemList, nil)?.takeRetainedValue()
        guard let loginItems = loginItemsListSnapshot as? [LSSharedFileListItem] else { return false }
        for loginItem in loginItems {
            guard let resolvedUrl = LSSharedFileListItemCopyResolvedURL(loginItem, 0, nil) else { continue }
            let itemUrl = resolvedUrl.takeRetainedValue() as URL
            guard url.absoluteString == itemUrl.absoluteString else { continue }
            LSSharedFileListItemRemove(loginItemList, loginItem)
        }
        return true
    }
}

private extension LoginServiceKit {
    static func loginItem(at path: String) -> LSSharedFileListItem? {
        guard !path.isEmpty else { return nil }

        guard let sharedFileList = LSSharedFileListCreate(nil, kLSSharedFileListSessionLoginItems.takeRetainedValue(), nil)
        else { return nil }
        let loginItemList = sharedFileList.takeRetainedValue()
        let url = URL(fileURLWithPath: path)
        let loginItemsListSnapshot: CFArray? = LSSharedFileListCopySnapshot(loginItemList, nil)?.takeRetainedValue()
        guard let loginItems = loginItemsListSnapshot as? [LSSharedFileListItem] else { return nil }
        for loginItem in loginItems {
            guard let resolvedUrl = LSSharedFileListItemCopyResolvedURL(loginItem, 0, nil) else { continue }
            let itemUrl = resolvedUrl.takeRetainedValue() as URL
            guard url.absoluteString == itemUrl.absoluteString else { continue }
            return loginItem
        }
        return nil
    }
}

```

### Core Architecture Module: `Lunar/Utils/NanoID.swift`
```
//
//  NanoID.swift
//
//  Created by Anton Lovchikov on 05/07/2018.
//  Copyright © 2018 Anton Lovchikov. All rights reserved.
//

import Foundation

// MARK: - NanoID

/// USAGE
///
/// Nano ID with default alphabet (0-9a-zA-Z_~) and length (21 chars)
/// let id = NanoID.new()
///
/// Nano ID with default alphabet and given length
/// let id = NanoID.new(12)
///
/// Nano ID with given alphabet and length
/// let id = NanoID.new(alphabet: .uppercasedLatinLetters, size: 15)
///
/// Nano ID with preset custom parameters
/// let nanoID = NanoID(alphabet: .lowercasedLatinLetters,.numbers, size:10)
/// let idFirst = nanoID.new()
/// let idSecond = nanoID.new()

final class NanoID {
    /// Inits an instance with Shared Parameters
    init(alphabet: NanoIDAlphabet..., size: Int) {
        self.size = size
        self.alphabet = NanoIDHelper.parse(alphabet)
    }

    /// Generates a Nano ID using Default Parameters
    static func new() -> String {
        NanoIDHelper.generate(from: defaultAphabet, of: defaultSize)
    }

    /// Generates a Nano ID using given occasional parameters
    static func new(alphabet: NanoIDAlphabet..., size: Int) -> String {
        let charactersString = NanoIDHelper.parse(alphabet)
        return NanoIDHelper.generate(from: charactersString, of: size)
    }

    /// Generates a Nano ID using Default Alphabet and given size
    static func new(_ size: Int) -> String {
        NanoIDHelper.generate(from: NanoID.defaultAphabet, of: size)
    }

    /// Generates a Nano ID using Shared Parameters
    func new() -> String {
        NanoIDHelper.generate(from: alphabet, of: size)
    }

    // Default Parameters
    private static let defaultSize = 21
    private static let defaultAphabet = NanoIDAlphabet.urlSafe.toString()

    // Shared Parameters
    private var size: Int
    private var alphabet: String
}

// MARK: - NanoIDHelper

private enum NanoIDHelper {
    /// Parses input alphabets into a string
    static func parse(_ alphabets: [NanoIDAlphabet]) -> String {
        var stringCharacters = ""

        for alphabet in alphabets {
            stringCharacters.append(alphabet.toString())
        }

        return stringCharacters
    }

    /// Generates a Nano ID using given parameters
    static func generate(from alphabet: String, of length: Int) -> String {
        var nanoID = ""

        for _ in 0 ..< length {
            let randomCharacter = NanoIDHelper.randomCharacter(from: alphabet)
            nanoID.append(randomCharacter)
        }

        return nanoID
    }

    /// Returns a random character from a given string
    static func randomCharacter(from string: String) -> Character {
        let randomNum = arc4random_uniform(string.count.u32).i
        let randomIndex = string.index(string.startIndex, offsetBy: randomNum)
        return string[randomIndex]
    }
}

// MARK: - NanoIDAlphabet

enum NanoIDAlphabet {
    case urlSafe
    case uppercasedLatinLetters
    case lowercasedLatinLetters
    case numbers

    func toString() -> String {
        switch self {
        case .uppercasedLatinLetters, .lowercasedLatinLetters, .numbers:
            chars()
        case .urlSafe:
            "\(NanoIDAlphabet.uppercasedLatinLetters.chars())\(NanoIDAlphabet.lowercasedLatinLetters.chars())\(NanoIDAlphabet.numbers.chars())~_"
        }
    }

    private func chars() -> String {
        switch self {
        case .uppercasedLatinLetters:
            "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
        case .lowercasedLatinLetters:
            "abcdefghijklmnopqrstuvwxyz"
        case .numbers:
            "1234567890"
        default:
            ""
        }
    }
}

```

### Core Architecture Module: `Lunar/Utils/Popovers.swift`
```
//
//  Popovers.swift
//  Lunar
//
//  Created by Alin Panaitiu on 29.12.2020.
//  Copyright © 2020 Alin. All rights reserved.
//

import Cocoa
import Foundation

var menuWindow: PanelWindow? { didSet {
    oldValue?.forceClose()
}}
var INPUT_HOTKEY_POPOVERS: [String: NSPopover?] = [:]
var POPOVERS: [String: NSPopover?] = [
    "help": nil,
    "settings": nil,
    "colors": nil,
    "ddc": nil,
    "reset": nil,
]

```

### Core Architecture Module: `Lunar/Utils/Solar.swift`
```
//
//  Solar.swift
//  SolarExample
//
//  Created by Chris Howell on 16/01/2016.
//  Copyright © 2016 Chris Howell. All rights reserved.
//
//  Permission is hereby granted, free of charge, to any person obtaining a copy
//  of this software and associated documentation files (the “Software”), to deal
//  in the Software without restriction, including without limitation the rights
//  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
//  copies of the Software, and to permit persons to whom the Software is
//  furnished to do so, subject to the following conditions:
//
//  The above copyright notice and this permission notice shall be included in
//  all copies or substantial portions of the Software.
//
//  THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
//  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
//  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
//  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
//  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
//  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
//  THE SOFTWARE.
//

import CoreLocation
import Foundation

/** Astronomical Unit in km. As defined by JPL */
let AU = 149_597_870.691

/** Earth equatorial radius in km. IERS 2003 Conventions */
let EARTH_RADIUS = 6378.1366

/** Length of a sidereal day in days according to IERS Conventions */
let SIDEREAL_DAY_LENGTH = 1.00273781191135448

/** Julian century conversion constant = 100 * days per year */
let JULIAN_DAYS_PER_CENTURY: Double = 36525

/** Seconds in one day */
let SECONDS_PER_DAY: Double = 86400

/** Minutes in one day */
let MINUTES_PER_DAY = 1440

/** Our default epoch.<br>
 The Julian Day which represents noon on 2000-01-01 */
let J2000: Double = 2_451_545

/** Lunar cycle length in days */
let LUNAR_CYCLE_DAYS = 29.530588853

struct Sun {
    let azimuth: Double
    let elevation: Double
}

extension TimeZone {
    static let gmt = TimeZone(secondsFromGMT: 0)!
}

final class Solar {
    // MARK: Init

    init?(for date: Date = Date(), coordinate: CLLocationCoordinate2D) {
        self.date = date
        guard let startOfDayDate = Calendar.current.date(bySettingHour: 0, minute: 0, second: 0, of: date) else {
            return nil
        }
        startOfDay = startOfDayDate

        guard CLLocationCoordinate2DIsValid(coordinate) else {
            return nil
        }

        self.coordinate = coordinate
    }

    // MARK: - Private functions

    enum SunriseSunset {
        case sunrise
        case sunset
    }

    /// Used for generating several of the possible sunrise / sunset times
    enum Zenith: Double {
        case official = 90.83
        case civil = 96
        case nautical = 102
        case astronomical = 108
    }

    /// The coordinate that is used for the calculation
    let coordinate: CLLocationCoordinate2D

    /// The date to generate sunrise / sunset times for
    private(set) var date: Date
    private(set) var startOfDay: Date
    private(set) var sunElevationCache = {
        let c = NSCache<NSNumber, NSNumber>()
        c.countLimit = 1500
        return c
    }()

    private(set) var sunPositionByMinuteInitialized = false
    private(set) lazy var sunPositionByMinute: [Sun?] = {
        let positions = (0 ..< MINUTES_PER_DAY).map { minute in
            computeSunPosition(date: Calendar.current.date(byAdding: DateComponents(minute: minute), to: startOfDay)!)
        }
        sunPositionByMinuteInitialized = true
        return positions
    }()

    private(set) lazy var sunrise: Date? = calculate(.sunrise, for: date, and: .official)
    private(set) lazy var sunset: Date? = calculate(.sunset, for: date, and: .official)
    private(set) lazy var civilSunrise: Date? = calculate(.sunrise, for: date, and: .civil)
    private(set) lazy var civilSunset: Date? = calculate(.sunset, for: date, and: .civil)
    private(set) lazy var nauticalSunrise: Date? = calculate(.sunrise, for: date, and: .nautical)
    private(set) lazy var nauticalSunset: Date? = calculate(.sunset, for: date, and: .nautical)
    private(set) lazy var astronomicalSunrise: Date? = calculate(.sunrise, for: date, and: .astronomical)
    private(set) lazy var astronomicalSunset: Date? = calculate(.sunset, for: date, and: .astronomical)
    private(set) lazy var solarNoon: Date? = {
        let highestElevation = sunPositionByMinute.compactMap { $0 }.enumerated().max(by: { this, other in
            this.1.elevation <= other.1.elevation
        })

        guard let highestElevationMinute = highestElevation?.0 else { return nil }
        return Calendar.current.date(byAdding: DateComponents(minute: highestElevationMinute), to: startOfDay)
    }()

    private(set) lazy var sunrisePosition: Sun? = sunrise != nil ? computeSunPosition(date: sunrise!) : nil
    private(set) lazy var sunsetPosition: Sun? = sunset != nil ? computeSunPosition(date: sunset!) : nil
    private(set) lazy var civilSunrisePosition: Sun? = civilSunrise != nil ? computeSunPosition(date: civilSunrise!) : nil
    private(set) lazy var civilSunsetPosition: Sun? = civilSunset != nil ? computeSunPosition(date: civilSunset!) : nil
    private(set) lazy var nauticalSunrisePosition: Sun? = nauticalSunrise != nil ? computeSunPosition(date: nauticalSunrise!) : nil
    private(set) lazy var nauticalSunsetPosition: Sun? = nauticalSunset != nil ? computeSunPosition(date: nauticalSunset!) : nil
    private(set) lazy var astronomicalSunrisePosition: Sun? = astronomicalSunrise != nil ? computeSunPosition(date: astronomicalSunrise!) : nil
    private(set) lazy var astronomicalSunsetPosition: Sun? = astronomicalSunset != nil ? computeSunPosition(date: astronomicalSunset!) : nil
    private(set) lazy var solarNoonPosition: Sun? = solarNoon != nil ? computeSunPosition(date: solarNoon!) : nil

    /// Sets all of the Solar object's sunrise / sunset variables, if possible.
    /// - Note: Can return `nil` objects if sunrise / sunset does not occur on that day.
    func calculate() {
        sunrise = calculate(.sunrise, for: date, and: .official)
        sunset = calculate(.sunset, for: date, and: .official)
        civilSunrise = calculate(.sunrise, for: date, and: .civil)
        civilSunset = calculate(.sunset, for: date, and: .civil)
        nauticalSunrise = calculate(.sunrise, for: date, and: .nautical)
        nauticalSunset = calculate(.sunset, for: date, and: .nautical)
        astronomicalSunrise = calculate(.sunrise, for: date, and: .astronomical)
        astronomicalSunset = calculate(.sunset, for: date, and: .astronomical)
    }

    func getSunElevation(date: Date? = nil) -> Double? {
        let date = date ?? Date()
        let key = ((date.timeIntervalSinceReferenceDate / 60).rounded() * 60).ns
        if let elevation = sunElevationCache.object(forKey: key) {
            return elevation.doubleValue
        }

        guard let sun = computeSunPosition(date: date) else {
            return nil
        }
        sunElevationCache.setObject(sun.elevation.ns, forKey: key)
        return sun.elevation
    }

    func computeSunPosition(date: Date? = nil) -> Sun? {
        let date = date ?? Date()

        let components = Calendar.current.dateComponents([.hour, .minute], from: date)
        if sunPositionByMinuteInitialized,
           let startOfDayDate = Calendar.current.date(bySettingHour: 0, minute: 0, second: 0, of: date), startOfDayDate == startOfDay,
           let sun = sunPositionByMinute[components.hour! * 60 + components.minute!]
        {
            return sun
        }

        let (jd_UT, t) = jd(date)
        var pos: [Double] = getSun(t: t)

        // Ecliptic to equatorial coordinates
        let t2: Double = t / 100
        var tmp: Double = t2 * (27.87 + t2 * (5.79 + t2 * 2.45))
        tmp = t2 * (-249.67 + t2 * (-39.05 + t2 * (7.12 + tmp)))
        tmp = t2 * (-1.55 + t2 * (1999.25 + t2 * (-51.38 + tmp)))
        tmp = (t2 * (-4680.93 + tmp)) / 3600
        var angle: Double = (23.4392911111111 + tmp).degreesToRadians // obliquity
        // Add nutation in obliquity
        let M1: Double = (124.90 - 1934.134 * t + 0.002063 * t * t).degreesToRadians,
            M2: Double = (201.11 + 72001.5377 * t + 0.00057 * t * t).degreesToRadians,
            d = 0.002558 * cos(M1) - 0.00015339 * cos(M2)
        angle += d.degreesToRadians

        pos[0] = pos[0].degreesToRadians
        pos[1] = pos[1].degreesToRadians
        let cl: Double = cos(pos[1]),
            x: Double = pos[2] * cos(pos[0]) * cl
        var y: Double = pos[2] * sin(pos[0]) * cl,
            z: Double = pos[2] * sin(pos[1])
        tmp = y * cos(angle) - z * sin(angle)
        z = y * sin(angle) + z * cos(angle)
        y = tmp

        // Obtain local apparent sidereal time
        let jd0: Double = floor(jd_UT - 0.5) + 0.5,
            T0: Double = (jd0 - J2000) / JULIAN_DAYS_PER_CENTURY,
            secs: Double = (jd_UT - jd0) * SECONDS_PER_DAY
        var gmst: Double = (((((-6.2e-6 * T0) + 9.3104e-2) * T0) + 8_640_184.812866) * T0) + 24110.54841
        let msday: Double = 1 +
            (
                ((((-1.86e-5 * T0) + 0.186208) * T0) + 8_640_184.812866) /
                    (SECONDS_PER_DAY * JULIAN_DAYS_PER_CENTURY)
            )
        gmst = (gmst + msday * secs) * (15 / 3600).degreesToRadians

        let obsLon = coordinate.longitude.degreesToRadians
        let obsLat = coordinate.latitude.degreesToRadians
        let lst: Double = gmst + obsLon

        // Obtain topocentric rectangular coordinates
        // Set radiusAU = 0 for geocentric calculations
        // (rise/set/transit will have no sense in this case)
        let radiusAU: Double = EARTH_RADIUS / AU
        let correction: [Double] = [
            radiusAU * cos(obsLat) * cos(lst),
            radiusAU * cos(obsLat) * sin(lst),
            radiusAU * sin(obsLat),
       
```

### Core Architecture Module: `Lunar/Utils/Swizzle.swift`
```
//
//  Swizzle.swift
//  Lunar
//
//  Created by Alin Panaitiu on 28.12.2021.
//  Copyright © 2021 Alin. All rights reserved.
//

import Cocoa
import Foundation

let MAIN_MENU_ID = NSUserInterfaceItemIdentifier("MainMenuWindow")
let POPOVER_CORNER_RADIUS: CGFloat = 18
let POPOVER_PADDING: CGFloat = 50

// MARK: - PopoverBackgroundView

final class PopoverBackgroundView: NSView {
    override func draw(_ bounds: NSRect) {
        NSColor.clear.set()
        bounds.fill()
    }
}

extension NSVisualEffectView {
    private typealias UpdateLayer = @convention(c) (AnyObject) -> Void

    @objc dynamic
    func replacement() {
        super.updateLayer()
        guard let layer, layer.name == "NSPopoverFrame", let window, identifier == MAIN_MENU_ID
        else {
            unsafeBitCast(
                updateLayerOriginalIMP, to: Self.UpdateLayer.self
            )(self)
            return
        }
        CATransaction.begin()
        CATransaction.disableActions()

        layer.isOpaque = false
        if let sublayer = layer.sublayers?.first, sublayer.name == "_NSPopoverFrameAXBackgroundView" {
            sublayer.opacity = 0
        }
        fixPopoverWindow(window)

        CATransaction.commit()
    }
}

let POPOVER_SHADOW: NSShadow = {
    let s = NSShadow()

    s.shadowColor = NSColor.shadowColor.withAlphaComponent(0.2)
    s.shadowOffset = .init(width: 0, height: -6)
    s.shadowBlurRadius = 8
    return s
}()

func fixPopoverWindow(_ window: NSWindow) {
    window.backgroundColor = .clear
    window.isOpaque = false
    window.styleMask = [.borderless]
    window.hasShadow = false
}

// MARK: - PopoverClearView

final class PopoverClearView: NSView {
    override func makeBackingLayer() -> CALayer {
        NoClippingLayer()
    }
}

let POPOVER_BLUR_VIEW_ID = NSUserInterfaceItemIdentifier("POPOVER_BLUR_VIEW_ID")
let POPOVER_BACKING_VIEW_ID = NSUserInterfaceItemIdentifier("POPOVER_BACKING_VIEW_ID")
func fixPopoverView(_ view: NSView?, backgroundColor: NSColor? = nil) {
    if let view {
        view.layer = nil
        let backView = NSVisualEffectView(frame: NSRect(
            x: POPOVER_PADDING / 2,
            y: POPOVER_PADDING - 10,
            width: view.frame.width - POPOVER_PADDING,
            height: view.frame.height - POPOVER_PADDING
        ))
        backView.material = .hudWindow
        backView.blendingMode = .behindWindow
        backView.state = .active
        backView.wantsLayer = true
        backView.layer?.cornerCurve = .continuous
        backView.maskImage = .mask(withCornerRadius: POPOVER_CORNER_RADIUS)
        backView.shadow = POPOVER_SHADOW
        backView.identifier = POPOVER_BLUR_VIEW_ID

        let backViewBackground = PopoverClearView(frame: NSRect(
            x: POPOVER_PADDING / 2,
            y: POPOVER_PADDING - 10,
            width: view.frame.width - POPOVER_PADDING,
            height: view.frame.height - POPOVER_PADDING
        ))
        backViewBackground.identifier = POPOVER_BACKING_VIEW_ID
        backViewBackground.wantsLayer = true
        if let l = backViewBackground.layer {
            l.cornerCurve = .continuous
            l.backgroundColor = backgroundColor?.cgColor
            l.cornerRadius = POPOVER_CORNER_RADIUS
        }
        view.addSubview(backViewBackground, positioned: .below, relativeTo: view.subviews.first)
        view.addSubview(backView, positioned: .below, relativeTo: view.subviews.first)
    }
}

extension NSImage {
    static func mask(withCornerRadius radius: CGFloat) -> NSImage {
        let image = NSImage(size: NSSize(width: radius * 2, height: radius * 2), flipped: false) {
            NSBezierPath(roundedRect: $0, xRadius: radius, yRadius: radius).fill()
            NSColor.black.set()
            return true
        }

        image.capInsets = NSEdgeInsets(top: radius, left: radius, bottom: radius, right: radius)
        image.resizingMode = .stretch

        return image
    }
}

var updateLayerOriginal: Method?
var updateLayerOriginalIMP: IMP?
var popoverSwizzled = false

func swizzlePopoverBackground() {
    guard !popoverSwizzled else {
        return
    }
    popoverSwizzled = true
    let origMethod = #selector(NSVisualEffectView.updateLayer)
    let replacementMethod = #selector(NSVisualEffectView.replacement)

    updateLayerOriginal = class_getInstanceMethod(NSVisualEffectView.self, origMethod)
    updateLayerOriginalIMP = method_getImplementation(updateLayerOriginal!)

    let swizzleMethod: Method? = class_getInstanceMethod(NSVisualEffectView.self, replacementMethod)
    let swizzleImpl = method_getImplementation(swizzleMethod!)
    method_setImplementation(updateLayerOriginal!, swizzleImpl)
}

func removePopoverBackground(view: NSView) {
    if let window = view.window, let frameView = window.contentView?.superview as? NSVisualEffectView {
        frameView.identifier = MAIN_MENU_ID
        fixPopoverWindow(window)

        swizzlePopoverBackground()
        frameView.bg = .clear
    }
}

// MARK: - NoClippingLayer

final class NoClippingLayer: CALayer {
    override var masksToBounds: Bool {
        set {}
        get {
            false
        }
    }
}

import SwiftUI

// MARK: - HostingView

final class HostingView: NSHostingView<QuickActionsView> {
    override func viewDidMoveToWindow() {
        super.viewDidMoveToWindow()
        removePopoverBackground(view: self)
    }
}

extension NSVisualEffectView.Material {
    static let osd = NSVisualEffectView.Material(rawValue: 26) ?? .hudWindow
}

// MARK: - VisualEffectBlur

struct VisualEffectBlur: View {
    init(
        material: NSVisualEffectView.Material = .headerView,
        blendingMode: NSVisualEffectView.BlendingMode = .withinWindow,
        state: NSVisualEffectView.State = .followsWindowActiveState,
        maskImage: NSImage? = nil
    ) {
        self.material = material
        self.blendingMode = blendingMode
        self.state = state
        self.maskImage = maskImage
    }

    var body: some View {
        Representable(
            material: material,
            blendingMode: blendingMode,
            state: state,
            maskImage: maskImage
        ).accessibility(hidden: true)
    }

    private var material: NSVisualEffectView.Material
    private var blendingMode: NSVisualEffectView.BlendingMode
    private var state: NSVisualEffectView.State
    private var maskImage: NSImage?
}

extension VisualEffectBlur {
    struct Representable: NSViewRepresentable {
        var material: NSVisualEffectView.Material
        var blendingMode: NSVisualEffectView.BlendingMode
        var state: NSVisualEffectView.State
        var maskImage: NSImage?

        func makeNSView(context: Context) -> NSVisualEffectView {
            context.coordinator.visualEffectView
        }

        func updateNSView(_: NSVisualEffectView, context: Context) {
            context.coordinator.update(material: material)
            context.coordinator.update(blendingMode: blendingMode)
            context.coordinator.update(state: state)
            context.coordinator.update(maskImage: maskImage)
        }

        func makeCoordinator() -> Coordinator {
            Coordinator()
        }
    }

    final class Coordinator {
        init() {
            visualEffectView.blendingMode = .withinWindow
        }

        let visualEffectView = NSVisualEffectView()

        func update(material: NSVisualEffectView.Material) {
            visualEffectView.material = material
        }

        func update(blendingMode: NSVisualEffectView.BlendingMode) {
            visualEffectView.blendingMode = blendingMode
        }

        func update(state: NSVisualEffectView.State) {
            visualEffectView.state = state
        }

        func update(maskImage: NSImage?) {
            visualEffectView.maskImage = maskImage
        }
    }
}

```

### Core Architecture Module: `Lunar/Utils/Trap.swift`
```
import Darwin
import Foundation

// http://www.gnu.org/software/libc/manual/html_node/Defining-Handlers.html#Defining-Handlers

// OS Signals
enum Signal {
    case hangup
    case interrupt
    case illegal
    case trap
    case abort
    case alarm
    case termination

    /// All posible signals.
    static let all = [
        hangup,
        interrupt,
        illegal,
        trap,
        abort,
        alarm,
        termination,
    ]

    /// Return the OS values
    var osValue: Int32 {
        switch self {
        case .hangup:
            SIGHUP
        case .interrupt:
            SIGINT
        case .illegal:
            SIGILL
        case .trap:
            SIGTRAP
        case .abort:
            SIGABRT
        case .alarm:
            SIGALRM
        case .termination:
            SIGTERM
        }
    }
}

/// Handle OS Signals
enum Trap {
    typealias SignalHandler = @convention(c) (Int32) -> Void

}

extension Trap {
    /**
     Establishes the signal handler.

     - parameter signal: The signal to handle.
     - parameter action: Code to execute when the signal is fired.

     - SeeAlso: [Advanced Signal Handling](http://www.gnu.org/software/libc/manual/html_node/Advanced-Signal-Handling.html#Advanced-Signal-Handling)
     */
    static func handle(signal: Signal, action: SignalHandler) {
        typealias SignalAction = sigaction

        // Instead of using just `signal` we can use the more powerful `sigaction`
        var signalAction = SignalAction(__sigaction_u: unsafeBitCast(action, to: __sigaction_u.self), sa_mask: 0, sa_flags: 0)
        _ = withUnsafePointer(to: &signalAction) { actionPointer in
            sigaction(signal.osValue, actionPointer, nil)
        }
    }

    /**
     Establishes multiple `signals` to be handled by the `action`

     - parameter signals: The multiple signal to handle.
     - parameter action:  Code to execute when any of the signals is fired.
     */
    static func handle(signals: [Signal], action: SignalHandler) {
        for item in signals {
            handle(signal: item, action: action)
        }
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #515** (2023-12-08): **Add CLI install location to succcessful print statement**
  *Symptoms*: Installing the lunar CLI via the terminal can lead to the install "silently failing" or seeming to fail if `~/.local/bin` is not in your `$PATH`.  This simply adds the install location to the success print message so that the user knows where the CLI was installed and can add the necessary directory to their `$PATH` if required.  Full disclosure: I did not build/test this at all, I am just borrowing the `CLI_BIN_DIR` variable that is already used and printing it out for the user to see.

- **Issue #514** (2023-07-01): **fix: bump platformio/espressif to 5.3.0 to maintain darwin_arm64 compatibility**
  *Symptoms*: Lately, when trying to install the Lunar light sensor package on an ESP32 board off an M1 Pro Macbook, this pops up:  ``` Processing lunarsensor (board: adafruit_metro_esp32s2; framework: arduino; platform: platformio/espressif32@5.1.0) ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- Tool Manager: Installing espressif/toolchain-riscv32-esp @ 8.4.0+2021r2-patch3 INFO Installing espressif/toolchain-riscv32-esp @ 8.4.0+2021r2-patch3 Error: Could not find the package with 'espressif/toolchain-riscv32-esp @ 8.4.0+2021r2-patch3' requirements for your system 'darwin_arm64' ```   Checking `espressif/toolchain-riscv32-esp`'s [version info](https://registry.platformio.org/tools/espressif/toolchain-riscv32-esp/versions) on PlatformIO, the only `8.x` package still published is `8.4.0+2021r2-patch5`  Digging further into the dependency chain, it seems that `platformio/espressif32@5.3.0` uses the latest `espressif/toolchain-riscv32-esp` version, which enables using an Apple Silicon device to provision a board using ESPHome.   Not sure about other ESP32 boards, although being a minor version update, I'd hope everything remains stable.
  **Post-Mortem & Fix Analysis**:
  > @pcnc Thanks for the PR! I'll have to test this myself first on all my boards.   The installation always worked on Apple Silicon, I'm not sure what changed upstream to cause this, but it's good you investigated this and let me know. 
  > Sure thing! Thanks as well!  Forgot to mention that the UI reported the install successful, though I noticed there was no wi-fi client registering on the local network using the provided connection credentials - could be that the toolchain doesn't exit with an error-specific code.  Adding some additional info which might be relevant to debugging:  Board: `Adafruit Metro ESP32-S2` Sensor: `Adafruit TSL2591` Basically the no-solder setup described [here](https://lunar.fyi/sensor)  OS/Env: ``` ❯ uname -a Darwin mbp.local 22.5.0 Darwin Kernel Version 22.5.0: Mon Apr 24 20:52:24 PDT 2023; root:xnu-8796.121.2~5/RELEASE_ARM64_T6000 arm64 ❯ python3 --version Python 3.11.3 ❯ python3 -m pip --version pip 23.1.2 from /opt/homebrew/lib/python3.11/site-packages/pip (python 3.11) ```

- **Issue #436** (2022-02-09): **Fix spelling**
  *Symptoms*: 

- **Issue #312** (2021-04-29): **Add a Gitter chat badge to README.md**
  *Symptoms*: ### alin23/Lunar now has a Chat Room on Gitter  @alin23 has just created a chat room. You can visit it here: [https://gitter.im/alin23-Lunar/community](https://gitter.im/alin23-Lunar/community?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&content=body_link).  This pull-request adds this badge to your README.md:   [![Gitter](https://badges.gitter.im/alin23-Lunar/community.svg)](https://gitter.im/alin23-Lunar/community?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=body_badge)  If my aim is a little off, please [let me know](https://gitlab.com/gitlab-org/gitter/readme-badger/issues).  Happy chatting.   PS: [Click here](https://gitter.im/settings/badger/opt-out) if you would prefer not to receive automatic pull-requests from Gitter in future. 

- **Issue #237** (2020-12-26): **Fix installation instructions in README.md**
  *Symptoms*: Fix error when installing using latest Homebrew. This is not a bug of this app, but README.md needs to be fixed.  screenshot:  ![Calling brew cask install is disabled](https://user-images.githubusercontent.com/8146876/103143622-6069a900-475d-11eb-9f4c-a70ac6cb667c.png) 
  **Post-Mortem & Fix Analysis**:
  > Thank you for the update! 😊

- **Issue #14** (2019-03-19): **Animate brightness/contrast transitions**
  *Symptoms*: Hello! This implements feature request: #14   This works on my display (LG 4k). The step value is set to 2 if you are changing the value by more than 50.  The only problem with this implementation is that currently the Display object doesn't get initiated with the external display's initial brightness, so that variable always starts at 50. That means if your monitor is at 100 and you set it to 0, it will jump to 50 then animate to 0.  I tried to call `DDC.readBrightness()` at initiation but it kept crashing my computer 😊. Is there an easy way to grab that value at init?
  **Post-Mortem & Fix Analysis**:
  > Looks like there was a similar issue in fetching current display brightness here: https://github.com/alin23/Lunar/pull/2
  > Reading the brightness never worked. I fiddled with the DDC.c source to get it working but nothing I tried made a difference.
  > The biggest issue I see with this is that Lunar blocks any UI interaction while it runs the smooth brightness change loop. For me it makes all the system jaggy until it finishes changing the brightness/contrast. This is a serious trade-off that I'm not sure all the users would like to make.  So one mandatory thing for this feature would be a setting to turn the smooth adjustment on and off, and by default it should be off. I'm thinking it could be toggle setting (like the `Adaptive` or `Unlocked` toggle) that could reside under the `CONFIGURATION` section of the Settings page.   I also really like how the brightness changes now, it was weird to see sudden drops in brightness when there was a cloud outside. It was almost like a flicker. But the fact that it makes all the system lag for a moment makes it hard to use. I'm not sure if this is a hardware limitation or if it could be fixed in software.

- **Issue #3** (2018-08-07): **updated readme**
  *Symptoms*: sorry I forgot to update the readme 😁
  **Post-Mortem & Fix Analysis**:
  > Thanks! I always forget about it too. I'm preparing a release in a few minutes.

- **Issue #2** (2018-08-06): **Feature/manual controls**
  *Symptoms*: added hotkeys for manual brightness incrementation and decrementation
  **Post-Mortem & Fix Analysis**:
  > Hi @duongel !  Thank you for the PR! This is something I've been wanting to implement after my current trip.  There a few things that we should decide upon before merging this: * Are the default hotkeys particular enough so that they don't interfere with other system/app hotkeys?   - I've seen people ask for this functionality bound to the brightness keys instead of other hotkeys, what do you think about this idea? * By using `setLightPercent()`, the brightness/contrast will be confined between the per-monitor min/max limits. Do we want this or should we override the min/max limits when manually adjusting the brightness? 
  > Hi @alin23 ,  I hope you had a pleasant trip :-)   - that's a great idea to bind the manual controls to the brightness keys! I pushed the change with `.control` modifier and hope that's safe enough to avoid any collisions.  - I think we should respect the user's min/max limits while manually adjusting the brightness. A reason for limiting a monitor's max brightness could be that its maximum brightness is much higher than the others. And while manually adjusting brightness to the maximum, one could still want to limit the most bright monitor.  - do you have any idea how to get the current brightness of any external monitor? E. g. `brightnessAdapter.displays.first?.value.brightness.intValue` does not seem to return the first display's current brightness reliably.
  > Thanks for the prompt follow-up @duongel   Yes, the <kbd>CTRL</kbd>+<kbd>F1</kbd> and <kbd>CTRL</kbd>+<kbd>F2</kbd> would be ok for most users. I think we should make this configurable in the near future to make everyone happy, but for now I like it this way.  You're making a good point about the min/max limits, I was thinking the same 😄   There's no way to get the brightness reliably as far as I know because the DDC protocol isn't fully implemented in a lot of monitors. I tried everything here but there doesn't seem to be a way to get read access to these properties.   The value you're getting here `brightnessAdapter.displays.first?.value.brightness.intValue` is the value we are setting, and most of the time we are not saving it in the DB because it is not that useful/reliable.

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

### Incident Patch 1: `1ffb5356` (2026-05-25)
**Commit Message**: Fix OSD not appearing

**File**: `.gitsecret/paths/mapping.cfg` (modified, +1/-1)
```diff
@@ -7,4 +7,4 @@ Lunar/Data/Pro.swift:849cf9003fdc4b07d1593503bf25f85b9337b35facc39bc247be4b62dd2
 Lunar/Modes/ClockMode.swift:d012d1b6cd91d0527ca6d6d00fd5b7742c3671855fba5d43ab31b6413d8afc84
 Lunar/DDC/DDC2.h:2413c548ce3cc1681316b52486b66769529ae244ec5c76a160cdc190e7236f61
 Lunar/DDC/DDC2.c:8488fdfb13ca9525e44db616c773eb67f1f1d52dcf83115d7666b0d79bbeef5a
-Lunar/required.swift:c4179714e990615d2fbfe43844805a28230b78710e7a35f5ebdfa71f8091a40e
+Lunar/required.swift:380c99532520441fe6ad092864e86557d5c8a3400e720e2b553cd2a3514ccb0d
```

**File**: `Lunar.xcodeproj/project.pbxproj` (modified, +4/-4)
```diff
@@ -1324,7 +1324,7 @@
 				CODE_SIGN_INJECT_BASE_ENTITLEMENTS = NO;
 				CODE_SIGN_STYLE = Manual;
 				COMBINE_HIDPI_IMAGES = YES;
-				CURRENT_PROJECT_VERSION = 6.10.3;
+				CURRENT_PROJECT_VERSION = 6.10.4;
 				DEBUG_INFORMATION_FORMAT = "dwarf-with-dsym";
 				DEVELOPMENT_ASSET_PATHS = "";
 				DEVELOPMENT_TEAM = "";
@@ -1356,7 +1356,7 @@
 				);
 				LLVM_LTO = NO;
 				MACOSX_DEPLOYMENT_TARGET = 11.0;
-				MARKETING_VERSION = 6.10.3;
+				MARKETING_VERSION = 6.10.4;
 				MTL_ENABLE_DEBUG_INFO = NO;
 				OTHER_CODE_SIGN_FLAGS = "";
 				PRODUCT_BUNDLE_IDENTIFIER = fyi.lunar.Lunar;
@@ -1390,7 +1390,7 @@
 				CODE_SIGN_INJECT_BASE_ENTITLEMENTS = NO;
 				CODE_SIGN_STYLE = Manual;
 				COMBINE_HIDPI_IMAGES = YES;
-				CURRENT_PROJECT_VERSION = 6.10.3;
+				CURRENT_PROJECT_VERSION = 6.10.4;
 				DEPLOYMENT_POSTPROCESSING = YES;
 				DEVELOPMENT_ASSET_PATHS = "";
 				DEVELOPMENT_TEAM = "";
@@ -1422,7 +1422,7 @@
 				);
 				LLVM_LTO = YES;
 				MACOSX_DEPLOYMENT_TARGET = 11.0;
-				MARKETING_VERSION = 6.10.3;
+				MARKETING_VERSION = 6.10.4;
 				MTL_ENABLE_DEBUG_INFO = NO;
 				OTHER_CODE_SIGN_FLAGS = "--timestamp";
 				PRODUCT_BUNDLE_IDENTIFIER = fyi.lunar.Lunar;
```

**File**: `Lunar.xcworkspace/xcshareddata/swiftpm/Package.resolved` (modified, +3/-3)
```diff
@@ -1,5 +1,5 @@
 {
-  "originHash" : "deeada10193a754d2b436b1330359bc84815a84e11cbc7d82af89d0eb69344c8",
+  "originHash" : "435149211245f4824d9f225087cd780270ae83e188eacd4398189990aeb6023d",
   "pins" : [
     {
       "identity" : "anycodable",
@@ -141,8 +141,8 @@
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/getsentry/sentry-cocoa",
       "state" : {
-        "revision" : "3a22ecd00ad1398747bfd587e44df82716908dd3",
-        "version" : "9.10.0"
+        "revision" : "193d313fbfd9affaf2be1692a0284a3b6574c515",
+        "version" : "9.14.0"
       }
     },
     {
```

**File**: `Lunar/Data/Display.swift` (modified, +4/-1)
```diff
@@ -2677,7 +2677,10 @@ let AUDIO_IDENTIFIER_UUID_PATTERN = "([0-9a-f]{2})([0-9a-f]{2})-([0-9a-f]{4})-[0
     lazy var nsScreen: NSScreen? = getScreen() {
         didSet {
             setNotchState()
-            let shouldShowOSD = nsScreen?.visibleFrame != oldValue?.visibleFrame && (osdWindowController?.window as? OSDWindow)?.contentView?.superview?.alphaValue == 1
+            let shouldShowOSD = (
+                nsScreen?.displayID != oldValue?.displayID
+                    || nsScreen?.visibleFrame != oldValue?.visibleFrame
+            ) && (osdWindowController?.window as? OSDWindow)?.contentView?.superview?.alphaValue == 1
             let screen = nsScreen
             mainAsync {
                 self.supportsEnhance = self.getSupportsEnhance()
```

**File**: `Lunar/Views/OSDWindow.swift` (modified, +10/-1)
```diff
@@ -22,7 +22,7 @@ final class OSDWindow: NSWindow, NSWindowDelegate {
         contentViewController = NSHostingController(rootView: swiftuiView)
 
         self.level = level
-        collectionBehavior = [.stationary, .canJoinAllSpaces, .ignoresCycle, .fullScreenDisallowsTiling]
+        collectionBehavior = [.stationary, .canJoinAllSpaces, .ignoresCycle, .fullScreenAuxiliary, .fullScreenDisallowsTiling]
         shouldIgnoreMouseEvents = ignoresMouseEvents
         self.ignoresMouseEvents = ignoresMouseEvents
         setAccessibilityRole(.popover)
@@ -152,6 +152,10 @@ final class OSDWindow: NSWindow, NSWindowDelegate {
         }
     }
 
+    func isBound(to screen: NSScreen?) -> Bool {
+        self.screen?.displayID == screen?.displayID
+    }
+
     func windowWillClose(_ notification: Notification) {
         removeHoverTrackingArea()
     }
@@ -1181,6 +1185,11 @@ extension Display {
             osdState.imageLeft = imageLeft
             osdState.onChange = onChange
 
+            if let osd = osdWindowController?.window as? OSDWindow, !osd.isBound(to: nsScreen) {
+                osd.hide()
+                osdWindowController = nil
+            }
+
             if osdWindowController == nil {
                 let ignoresMouseEvents = if #available(macOS 26, *) {
                     false
```

**File**: `ReleaseNotes/6.10.4.md` (added, +3/-0)
```diff
@@ -0,0 +1,3 @@
+## Fixes
+
+- Fix brightness OSD not appearing sometimes
```

**File**: `Releases/appcast-stable.xml` (modified, +19/-19)
```diff
@@ -2,6 +2,25 @@
 <rss xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle" version="2.0">
     <channel>
         <title>Lunar</title>
+        <item>
+            <title>6.10.4</title>
+            <pubDate>Mon, 25 May 2026 17:10:34 +0300</pubDate>
+            <link>https://lunar.fyi/</link>
+            <sparkle:fullReleaseNotesLink>https://lunar.fyi/changelog</sparkle:fullReleaseNotesLink>
+            <sparkle:minimumAutoupdateVersion>5.0.0</sparkle:minimumAutoupdateVersion>
+            <sparkle:version>6.10.4</sparkle:version>
+            <sparkle:shortVersionString>6.10.4</sparkle:shortVersionString>
+            <sparkle:minimumSystemVersion>11.0</sparkle:minimumSystemVersion>
+            <sparkle:releaseNotesLink>https://files.lunar.fyi/ReleaseNotes/Lunar-6.10.4.html</sparkle:releaseNotesLink>
+            <enclosure url="https://files.lunar.fyi/releases/Lunar-6.10.4.dmg" length="16750784" type="application/octet-stream" sparkle:edSignature="Do7f7oy0s5xoCHI0wxBZXbQotdSL54ZvXesdvitiRMdE3E007CyhLgmo/6nIWgC2sy4n2S5LV9k6LV1lu5QxAQ=="/>
+            <sparkle:deltas>
+                <enclosure url="https://files.lunar.fyi/deltas/Lunar6.10.4-6.10.3.delta" sparkle:deltaFrom="6.10.3" length="3016666" type="application/octet-stream" sparkle:deltaFromSparkleExecutableSize="977808" sparkle:deltaFromSparkleLocales="Base" sparkle:edSignature="Pevc8jAuV5cBK99XRaeERMZfvkSDEQ2Z83CO48CjkJ2Ew/9otD7hvHx7U4wXIuZw6XpIMc0JuO2ZDQJwc7X1Dw=="/>
+                <enclosure url="https://files.lunar.fyi/deltas/Lunar6.10.4-6.10.2.delta" sparkle:deltaFrom="6.10.2" length="3051006" type="application/octet-stream" sparkle:deltaFromSparkleExecutableSize="977808" sparkle:deltaFromSparkleLocales="Base" sparkle:edSignature="C7+6crlSAOw1Bm4MKNxEePzii8IXX+BMh5Ada7lfZquAc+U6x3tcRccgnE04eZJlYOZG4Yv1a18+4RPuwYdYAQ=="/>
+                <enclosure url="https://files.lunar.fyi/deltas/Lunar6.10.4-6.10.1.delta" sparkle:deltaFrom="6.10.1" length="3538458" type="application/octet-stream" sparkle:deltaFromSparkleExecutableSize="977808" sparkle:deltaFromSparkleLocales="Base" sparkle:edSignature="F3htlkMnE6idGWHMN4pqDqHikm86mi/TYr9psMIWqxfutaO8z5K7xwSwT4PYPGHiYXvy6/NVXBrX9Q/8DtMuDw=="/>
+                <enclosure url="https://files.lunar.fyi/deltas/Lunar6.10.4-6.10.0.delta" sparkle:deltaFrom="6.10.0" length="3623990" type="application/octet-stream" sparkle:deltaFromSparkleExecutableSize="977808" sparkle:deltaFromSparkleLocales="Base" sparkle:edSignature="oEy9BTk2L6js714V9nN+0q3vpvreiVI+5GPdbS5rEYhCf1NOn+ZMi4ZUwKpxM1pgNQZcGPg9iY6BeB9vrI8nDA=="/>
+                <enclosure url="https://files.lunar.fyi/deltas/Lunar6.10.4-6.9.10.delta" sparkle:deltaFrom="6.9.10" length="6115826" type="application/octet-stream" sparkle:deltaFromSparkleExecutableSize="977808" sparkle:deltaFromSparkleLocales="Base" sparkle:edSignature="BP/7kfyESaHbKNWsoP7k5Le4cXrmgawKYZL8l5VMk8H7Mk6AaQMyXLLgUEU6rgM3pyK2FiqXkZCr5MjrfuxgAw=="/>
+            </sparkle:deltas>
+        </item>
         <item>
             <title>6.10.3</title>
             <pubDate>Mon, 11 May 2026 14:21:56 +0300</pubDate>
@@ -173,25 +192,6 @@
                 <enclosure url="https://files.lunar.fyi/deltas/Lunar6.9.6-6.9.2.delta" sparkle:deltaFrom="6.9.2" length="6733170" type="application/octet-stream" sparkle:deltaFromSparkleExecutableSize="1837232" sparkle:deltaFromSparkleLocales="en,Base" sparkle:edSignature="shTKsmN1+tC8Br/DcGStEYSBvdKlmkxw0vFr+yKSBGjbiZb4Sw9SMbUBQlt0Yk69YvmdguYpz9FKWU8jUlWnAw=="/>
             </sparkle:deltas>
         </item>
-        <item>
-            <title>6.9.5</title>
-            <pubDate>Fri, 07 Nov 2025 11:11:56 +0200</pubDate>
-            <link>https://lunar.fyi/</link>
-            <sparkle:fullReleaseNotesLink>https://lunar.fyi/changelog</sparkle:fullReleaseNotesLink>
-            <sparkle:minimumAutoupdateVersion>5.0.0</sparkle:minimumAutoupdateVersion>
-            <sparkle:version>6.9.5</sparkle:version>
-            <sparkle:shortVersionString>6.9.5</sparkle:shortVersionString>
-            <sparkle:minimumSystemVersion>11.0</sparkle:minimumSystemVersion>
-            <sparkle:releaseNotesLink>https://files.lunar.fyi/ReleaseNotes/Lunar-6.9.5.html</sparkle:releaseNotesLink>
-            <enclosure url="https://files.lunar.fyi/releases/Lunar-6.9.5.dmg" length="21068175" type="application/octet-stream" sparkle:edSignature="CVwdJw559tve4pz8oRy9iIati9imRodOH+/2JLBnr2VdmcfUbjJ9iIJqL2nHgxEQoo8VF45PGAxsqXvnxWVyBw=="/>
-            <sparkle:deltas>
-                <enclosure url="https://files.lunar.fyi/deltas/Lunar6.9.5-6.9.4.delta" sparkle:deltaFrom="6.9.4" length="4329234" type="application/octet-stream" sparkle:deltaFromSparkleExecutableSize="1837232" sparkle:deltaFromSparkleLocales="en,Base" sparkle:edSignature="0souD7sQK9eUKSW8xY2c6xhk4yTzf3m3C4E4CHTFGJO8epU8h0F7IiyfNQ+qghyMV275osxNFi9DxXZLdg1cCg=="/>
-                <enclosure url="https://files.lunar.fyi/deltas/Lunar6.9.5-6.9.2.delta" sparkle:deltaFrom="6.9.2" length="4378150" type="application
```

**File**: `Releases/appcast2.xml` (modified, +19/-19)
```diff
@@ -2,6 +2,25 @@
 <rss xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle" version="2.0">
     <channel>
         <title>Lunar</title>
+        <item>
+            <title>6.10.4</title>
+            <pubDate>Mon, 25 May 2026 17:10:34 +0300</pubDate>
+            <link>https://lunar.fyi/</link>
+            <sparkle:fullReleaseNotesLink>https://lunar.fyi/changelog</sparkle:fullReleaseNotesLink>
+            <sparkle:minimumAutoupdateVersion>5.0.0</sparkle:minimumAutoupdateVersion>
+            <sparkle:version>6.10.4</sparkle:version>
+            <sparkle:shortVersionString>6.10.4</sparkle:shortVersionString>
+            <sparkle:minimumSystemVersion>11.0</sparkle:minimumSystemVersion>
+            <sparkle:releaseNotesLink>https://files.lunar.fyi/ReleaseNotes/Lunar-6.10.4.html</sparkle:releaseNotesLink>
+            <enclosure url="https://files.lunar.fyi/releases/Lunar-6.10.4.dmg" length="16750784" type="application/octet-stream" sparkle:edSignature="Do7f7oy0s5xoCHI0wxBZXbQotdSL54ZvXesdvitiRMdE3E007CyhLgmo/6nIWgC2sy4n2S5LV9k6LV1lu5QxAQ=="/>
+            <sparkle:deltas>
+                <enclosure url="https://files.lunar.fyi/deltas/Lunar6.10.4-6.10.3.delta" sparkle:deltaFrom="6.10.3" length="3016666" type="application/octet-stream" sparkle:deltaFromSparkleExecutableSize="977808" sparkle:deltaFromSparkleLocales="Base" sparkle:edSignature="Pevc8jAuV5cBK99XRaeERMZfvkSDEQ2Z83CO48CjkJ2Ew/9otD7hvHx7U4wXIuZw6XpIMc0JuO2ZDQJwc7X1Dw=="/>
+                <enclosure url="https://files.lunar.fyi/deltas/Lunar6.10.4-6.10.2.delta" sparkle:deltaFrom="6.10.2" length="3051006" type="application/octet-stream" sparkle:deltaFromSparkleExecutableSize="977808" sparkle:deltaFromSparkleLocales="Base" sparkle:edSignature="C7+6crlSAOw1Bm4MKNxEePzii8IXX+BMh5Ada7lfZquAc+U6x3tcRccgnE04eZJlYOZG4Yv1a18+4RPuwYdYAQ=="/>
+                <enclosure url="https://files.lunar.fyi/deltas/Lunar6.10.4-6.10.1.delta" sparkle:deltaFrom="6.10.1" length="3538458" type="application/octet-stream" sparkle:deltaFromSparkleExecutableSize="977808" sparkle:deltaFromSparkleLocales="Base" sparkle:edSignature="F3htlkMnE6idGWHMN4pqDqHikm86mi/TYr9psMIWqxfutaO8z5K7xwSwT4PYPGHiYXvy6/NVXBrX9Q/8DtMuDw=="/>
+                <enclosure url="https://files.lunar.fyi/deltas/Lunar6.10.4-6.10.0.delta" sparkle:deltaFrom="6.10.0" length="3623990" type="application/octet-stream" sparkle:deltaFromSparkleExecutableSize="977808" sparkle:deltaFromSparkleLocales="Base" sparkle:edSignature="oEy9BTk2L6js714V9nN+0q3vpvreiVI+5GPdbS5rEYhCf1NOn+ZMi4ZUwKpxM1pgNQZcGPg9iY6BeB9vrI8nDA=="/>
+                <enclosure url="https://files.lunar.fyi/deltas/Lunar6.10.4-6.9.10.delta" sparkle:deltaFrom="6.9.10" length="6115826" type="application/octet-stream" sparkle:deltaFromSparkleExecutableSize="977808" sparkle:deltaFromSparkleLocales="Base" sparkle:edSignature="BP/7kfyESaHbKNWsoP7k5Le4cXrmgawKYZL8l5VMk8H7Mk6AaQMyXLLgUEU6rgM3pyK2FiqXkZCr5MjrfuxgAw=="/>
+            </sparkle:deltas>
+        </item>
         <item>
             <title>6.10.3</title>
             <pubDate>Mon, 11 May 2026 14:21:56 +0300</pubDate>
@@ -193,25 +212,6 @@
                 <enclosure url="https://files.lunar.fyi/deltas/Lunar6.9.6-6.9.1.delta" sparkle:deltaFrom="6.9.1" length="6743302" type="application/octet-stream" sparkle:deltaFromSparkleExecutableSize="1837232" sparkle:deltaFromSparkleLocales="en,Base" sparkle:edSignature="wVbiEVdJZNJA/aIHHjzG23Fw2WXZkzPdYm34QzFtmBtKKTGcB5Zq1eQClum8+oWS9hJthfxteXUL+auN1LS9AA=="/>
             </sparkle:deltas>
         </item>
-        <item>
-            <title>6.9.5</title>
-            <pubDate>Fri, 07 Nov 2025 11:11:56 +0200</pubDate>
-            <link>https://lunar.fyi/</link>
-            <sparkle:fullReleaseNotesLink>https://lunar.fyi/changelog</sparkle:fullReleaseNotesLink>
-            <sparkle:minimumAutoupdateVersion>5.0.0</sparkle:minimumAutoupdateVersion>
-            <sparkle:version>6.9.5</sparkle:version>
-            <sparkle:shortVersionString>6.9.5</sparkle:shortVersionString>
-            <sparkle:minimumSystemVersion>11.0</sparkle:minimumSystemVersion>
-            <sparkle:releaseNotesLink>https://files.lunar.fyi/ReleaseNotes/Lunar-6.9.5.html</sparkle:releaseNotesLink>
-            <enclosure url="https://files.lunar.fyi/releases/Lunar-6.9.5.dmg" length="21068175" type="application/octet-stream" sparkle:edSignature="CVwdJw559tve4pz8oRy9iIati9imRodOH+/2JLBnr2VdmcfUbjJ9iIJqL2nHgxEQoo8VF45PGAxsqXvnxWVyBw=="/>
-            <sparkle:deltas>
-                <enclosure url="https://files.lunar.fyi/deltas/Lunar6.9.5-6.9.4.delta" sparkle:deltaFrom="6.9.4" length="4329234" type="application/octet-stream" sparkle:deltaFromSparkleExecutableSize="1837232" sparkle:deltaFromSparkleLocales="en,Base" sparkle:edSignature="0souD7sQK9eUKSW8xY2c6xhk4yTzf3m3C4E4CHTFGJO8epU8h0F7IiyfNQ+qghyMV275osxNFi9DxXZLdg1cCg=="/>
-                <enclosure url="https://files.lunar.fyi/deltas/Lunar6.9.5-6.9.3.delta" sparkle:deltaFrom="6.9.3" length="4386650" type="application
```

---

### Incident Patch 2: `3ab39922` (2026-05-08)
**Commit Message**: Reduce energy impact when UI is not visible

**File**: `Lunar.xcodeproj/project.pbxproj` (modified, +4/-4)
```diff
@@ -1324,7 +1324,7 @@
 				CODE_SIGN_INJECT_BASE_ENTITLEMENTS = NO;
 				CODE_SIGN_STYLE = Manual;
 				COMBINE_HIDPI_IMAGES = YES;
-				CURRENT_PROJECT_VERSION = 6.10.1;
+				CURRENT_PROJECT_VERSION = 6.10.2;
 				DEBUG_INFORMATION_FORMAT = "dwarf-with-dsym";
 				DEVELOPMENT_ASSET_PATHS = "";
 				DEVELOPMENT_TEAM = "";
@@ -1356,7 +1356,7 @@
 				);
 				LLVM_LTO = NO;
 				MACOSX_DEPLOYMENT_TARGET = 11.0;
-				MARKETING_VERSION = 6.10.1;
+				MARKETING_VERSION = 6.10.2;
 				MTL_ENABLE_DEBUG_INFO = NO;
 				OTHER_CODE_SIGN_FLAGS = "";
 				PRODUCT_BUNDLE_IDENTIFIER = fyi.lunar.Lunar;
@@ -1390,7 +1390,7 @@
 				CODE_SIGN_INJECT_BASE_ENTITLEMENTS = NO;
 				CODE_SIGN_STYLE = Manual;
 				COMBINE_HIDPI_IMAGES = YES;
-				CURRENT_PROJECT_VERSION = 6.10.1;
+				CURRENT_PROJECT_VERSION = 6.10.2;
 				DEPLOYMENT_POSTPROCESSING = YES;
 				DEVELOPMENT_ASSET_PATHS = "";
 				DEVELOPMENT_TEAM = "";
@@ -1422,7 +1422,7 @@
 				);
 				LLVM_LTO = YES;
 				MACOSX_DEPLOYMENT_TARGET = 11.0;
-				MARKETING_VERSION = 6.10.1;
+				MARKETING_VERSION = 6.10.2;
 				MTL_ENABLE_DEBUG_INFO = NO;
 				OTHER_CODE_SIGN_FLAGS = "--timestamp";
 				PRODUCT_BUNDLE_IDENTIFIER = fyi.lunar.Lunar;
```

**File**: `Lunar/SwiftUIViews/QuickActionsMenuView.swift` (modified, +14/-2)
```diff
@@ -303,7 +303,13 @@ struct QuickActionsMenuView: View {
                     UsefulInfo().fixedSize()
                 }
                 Spacer()
-                topRightButtons.fixedSize()
+                if !menuBarClosed {
+                    topRightButtons.fixedSize()
+                } else {
+                    Rectangle()
+                        .fill(.clear)
+                        .frame(width: 100, height: 24)
+                }
             }
             .padding(.horizontal, 10)
             .padding(.top, 10 * op)
@@ -406,7 +412,13 @@ struct QuickActionsMenuView: View {
             VStack(spacing: 5) {
                 VStack(spacing: 5) {
                     content
-                    footer
+                    if !menuBarClosed {
+                        footer
+                    } else {
+                        Rectangle()
+                            .fill(.clear)
+                            .frame(width: 100, height: showFooterOnHover ? 8 : 28)
+                    }
                 }
                 .frame(maxWidth: env.menuWidth, alignment: .center)
                 .scrollOnOverflow(heightOffset: showAdditionalInfo ? 250 : 0)
```

**File**: `ReleaseNotes/6.10.2.md` (modified, +4/-0)
```diff
@@ -1,3 +1,7 @@
 ## Fixes
 
 - Fix Auto Mode selecting Sensor instead of Sync in specific cases
+
+## Improvements
+
+- Reduce energy impact when UI is not visible
```

**File**: `Releases/appcast-stable.xml` (modified, +19/-19)
```diff
@@ -2,6 +2,25 @@
 <rss xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle" version="2.0">
     <channel>
         <title>Lunar</title>
+        <item>
+            <title>6.10.2</title>
+            <pubDate>Fri, 08 May 2026 14:19:08 +0300</pubDate>
+            <link>https://lunar.fyi/</link>
+            <sparkle:fullReleaseNotesLink>https://lunar.fyi/changelog</sparkle:fullReleaseNotesLink>
+            <sparkle:minimumAutoupdateVersion>5.0.0</sparkle:minimumAutoupdateVersion>
+            <sparkle:version>6.10.2</sparkle:version>
+            <sparkle:shortVersionString>6.10.2</sparkle:shortVersionString>
+            <sparkle:minimumSystemVersion>11.0</sparkle:minimumSystemVersion>
+            <sparkle:releaseNotesLink>https://files.lunar.fyi/ReleaseNotes/Lunar-6.10.2.html</sparkle:releaseNotesLink>
+            <enclosure url="https://files.lunar.fyi/releases/Lunar-6.10.2.dmg" length="16566932" type="application/octet-stream" sparkle:edSignature="pgjRaXP/Eg5HAPPBoaJ117VH58POuEILSTzztgClYI19xeCJ2Of/wHaKuXiTyUUkaNPKoabJShiuG3GnS+i+Bg=="/>
+            <sparkle:deltas>
+                <enclosure url="https://files.lunar.fyi/deltas/Lunar6.10.2-6.10.1.delta" sparkle:deltaFrom="6.10.1" length="2407802" type="application/octet-stream" sparkle:deltaFromSparkleExecutableSize="977808" sparkle:deltaFromSparkleLocales="Base" sparkle:edSignature="wohUlTHhpsb+berIUTiZQ6Dxit5BcLRDeJS/xoGX40g4lCB+qautnltWodkgUuvZuOBi+MjtlsjHFB3GY5ZDCg=="/>
+                <enclosure url="https://files.lunar.fyi/deltas/Lunar6.10.2-6.10.0.delta" sparkle:deltaFrom="6.10.0" length="2877734" type="application/octet-stream" sparkle:deltaFromSparkleExecutableSize="977808" sparkle:deltaFromSparkleLocales="Base" sparkle:edSignature="fneaztwUj+uNjVt2Qr8ArQlSgEZ370eEkm/fAkqU7fMTWDqfvWZFVQwLHCg7eH4BKBcwzPSPIq9M7F+OUzTBAA=="/>
+                <enclosure url="https://files.lunar.fyi/deltas/Lunar6.10.2-6.9.10.delta" sparkle:deltaFrom="6.9.10" length="5893806" type="application/octet-stream" sparkle:deltaFromSparkleExecutableSize="977808" sparkle:deltaFromSparkleLocales="Base" sparkle:edSignature="i5siZa1o7Ix1+chU8s6m6RrYIfUBxdV3Yj8/bODSf34HULlaqZUAOr0k4/oiHEL9tyjlNgHHzqibIGqiqTmGBQ=="/>
+                <enclosure url="https://files.lunar.fyi/deltas/Lunar6.10.2-6.9.9.delta" sparkle:deltaFrom="6.9.9" length="5947718" type="application/octet-stream" sparkle:deltaFromSparkleExecutableSize="977808" sparkle:deltaFromSparkleLocales="Base" sparkle:edSignature="y44+eK9SdYp89dDCN6TVpKKhBvYcdYw0AxH+IJ3Eh+uP3ahLxj8ZKT0HPyyHZlSi5ynBGisR3xrTr1Qh8GvLDQ=="/>
+                <enclosure url="https://files.lunar.fyi/deltas/Lunar6.10.2-6.9.8.delta" sparkle:deltaFrom="6.9.8" length="5951118" type="application/octet-stream" sparkle:deltaFromSparkleExecutableSize="977808" sparkle:deltaFromSparkleLocales="Base" sparkle:edSignature="mef53tJHEHAWr6/323ygGF/C1gOSBcWsABOmlfxl3tReRG4lN4cmdnIC2NnwLxPN5ee3ekaBEaWIlT2hAzFmCA=="/>
+            </sparkle:deltas>
+        </item>
         <item>
             <title>6.10.1</title>
             <pubDate>Sat, 11 Apr 2026 13:01:46 +0300</pubDate>
@@ -173,25 +192,6 @@
                 <enclosure url="https://files.lunar.fyi/deltas/Lunar6.9.4-6.8.9.delta" sparkle:deltaFrom="6.8.9" length="6829822" type="application/octet-stream" sparkle:deltaFromSparkleExecutableSize="1842416" sparkle:deltaFromSparkleLocales="en,Base" sparkle:edSignature="RACqUAgVEidU9umFisU4O/9pMnjG/JHOJy6+cA7K2feGDJHWTMDHzsgZvr4agk0cCo5OO2NXChyEEke6d9ITAg=="/>
             </sparkle:deltas>
         </item>
-        <item>
-            <title>6.9.3</title>
-            <pubDate>Mon, 27 Oct 2025 13:50:27 +0200</pubDate>
-            <link>https://lunar.fyi/</link>
-            <sparkle:fullReleaseNotesLink>https://lunar.fyi/changelog</sparkle:fullReleaseNotesLink>
-            <sparkle:minimumAutoupdateVersion>5.0.0</sparkle:minimumAutoupdateVersion>
-            <sparkle:version>6.9.3</sparkle:version>
-            <sparkle:shortVersionString>6.9.3</sparkle:shortVersionString>
-            <sparkle:minimumSystemVersion>11.0</sparkle:minimumSystemVersion>
-            <sparkle:releaseNotesLink>https://files.lunar.fyi/ReleaseNotes/Lunar-6.9.3.html</sparkle:releaseNotesLink>
-            <enclosure url="https://files.lunar.fyi/releases/Lunar-6.9.3.dmg" length="20783648" type="application/octet-stream" sparkle:edSignature="wIwbP3ALnLCsZN4hfY4seOzzDCBFP3Q2MIDDZ6+9wHcalRuewR3+fUvP1zvpaS7g6wrm+zOunluKy9xpup+XCg=="/>
-            <sparkle:deltas>
-                <enclosure url="https://files.lunar.fyi/deltas/Lunar6.9.3-6.9.2.delta" sparkle:deltaFrom="6.9.2" length="1769702" type="application/octet-stream" sparkle:deltaFromSparkleExecutableSize="1837232" sparkle:deltaFromSparkleLocales="en,Base" sparkle:edSignature="syTZRVahZt4lzk5q+wPeBQSTM4NH2f0dn5cIhu/vY9xvHM+tuav6JuInBgv12ve9oltXzwPHtyUz1E0jc4FOBw=="/>
-                <enclosure url="https://files.lunar.fyi/deltas/Lunar6.9.3-6.9.1.delta" sparkle:deltaFrom="6.9.1" length="1998514" type="application/oct
```

**File**: `Releases/appcast2.xml` (modified, +19/-19)
```diff
@@ -2,6 +2,25 @@
 <rss xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle" version="2.0">
     <channel>
         <title>Lunar</title>
+        <item>
+            <title>6.10.2</title>
+            <pubDate>Fri, 08 May 2026 14:19:08 +0300</pubDate>
+            <link>https://lunar.fyi/</link>
+            <sparkle:fullReleaseNotesLink>https://lunar.fyi/changelog</sparkle:fullReleaseNotesLink>
+            <sparkle:minimumAutoupdateVersion>5.0.0</sparkle:minimumAutoupdateVersion>
+            <sparkle:version>6.10.2</sparkle:version>
+            <sparkle:shortVersionString>6.10.2</sparkle:shortVersionString>
+            <sparkle:minimumSystemVersion>11.0</sparkle:minimumSystemVersion>
+            <sparkle:releaseNotesLink>https://files.lunar.fyi/ReleaseNotes/Lunar-6.10.2.html</sparkle:releaseNotesLink>
+            <enclosure url="https://files.lunar.fyi/releases/Lunar-6.10.2.dmg" length="16566932" type="application/octet-stream" sparkle:edSignature="pgjRaXP/Eg5HAPPBoaJ117VH58POuEILSTzztgClYI19xeCJ2Of/wHaKuXiTyUUkaNPKoabJShiuG3GnS+i+Bg=="/>
+            <sparkle:deltas>
+                <enclosure url="https://files.lunar.fyi/deltas/Lunar6.10.2-6.10.1.delta" sparkle:deltaFrom="6.10.1" length="2407802" type="application/octet-stream" sparkle:deltaFromSparkleExecutableSize="977808" sparkle:deltaFromSparkleLocales="Base" sparkle:edSignature="wohUlTHhpsb+berIUTiZQ6Dxit5BcLRDeJS/xoGX40g4lCB+qautnltWodkgUuvZuOBi+MjtlsjHFB3GY5ZDCg=="/>
+                <enclosure url="https://files.lunar.fyi/deltas/Lunar6.10.2-6.10.0.delta" sparkle:deltaFrom="6.10.0" length="2877734" type="application/octet-stream" sparkle:deltaFromSparkleExecutableSize="977808" sparkle:deltaFromSparkleLocales="Base" sparkle:edSignature="fneaztwUj+uNjVt2Qr8ArQlSgEZ370eEkm/fAkqU7fMTWDqfvWZFVQwLHCg7eH4BKBcwzPSPIq9M7F+OUzTBAA=="/>
+                <enclosure url="https://files.lunar.fyi/deltas/Lunar6.10.2-6.9.10.delta" sparkle:deltaFrom="6.9.10" length="5893806" type="application/octet-stream" sparkle:deltaFromSparkleExecutableSize="977808" sparkle:deltaFromSparkleLocales="Base" sparkle:edSignature="i5siZa1o7Ix1+chU8s6m6RrYIfUBxdV3Yj8/bODSf34HULlaqZUAOr0k4/oiHEL9tyjlNgHHzqibIGqiqTmGBQ=="/>
+                <enclosure url="https://files.lunar.fyi/deltas/Lunar6.10.2-6.9.9.delta" sparkle:deltaFrom="6.9.9" length="5947718" type="application/octet-stream" sparkle:deltaFromSparkleExecutableSize="977808" sparkle:deltaFromSparkleLocales="Base" sparkle:edSignature="y44+eK9SdYp89dDCN6TVpKKhBvYcdYw0AxH+IJ3Eh+uP3ahLxj8ZKT0HPyyHZlSi5ynBGisR3xrTr1Qh8GvLDQ=="/>
+                <enclosure url="https://files.lunar.fyi/deltas/Lunar6.10.2-6.9.8.delta" sparkle:deltaFrom="6.9.8" length="5951118" type="application/octet-stream" sparkle:deltaFromSparkleExecutableSize="977808" sparkle:deltaFromSparkleLocales="Base" sparkle:edSignature="mef53tJHEHAWr6/323ygGF/C1gOSBcWsABOmlfxl3tReRG4lN4cmdnIC2NnwLxPN5ee3ekaBEaWIlT2hAzFmCA=="/>
+            </sparkle:deltas>
+        </item>
         <item>
             <title>6.10.1</title>
             <pubDate>Sat, 11 Apr 2026 13:01:46 +0300</pubDate>
@@ -193,25 +212,6 @@
                 <enclosure url="https://files.lunar.fyi/deltas/Lunar6.9.4-6.8.9.delta" sparkle:deltaFrom="6.8.9" length="6829822" type="application/octet-stream" sparkle:deltaFromSparkleExecutableSize="1842416" sparkle:deltaFromSparkleLocales="en,Base" sparkle:edSignature="RACqUAgVEidU9umFisU4O/9pMnjG/JHOJy6+cA7K2feGDJHWTMDHzsgZvr4agk0cCo5OO2NXChyEEke6d9ITAg=="/>
             </sparkle:deltas>
         </item>
-        <item>
-            <title>6.9.3</title>
-            <pubDate>Mon, 27 Oct 2025 13:50:27 +0200</pubDate>
-            <link>https://lunar.fyi/</link>
-            <sparkle:fullReleaseNotesLink>https://lunar.fyi/changelog</sparkle:fullReleaseNotesLink>
-            <sparkle:minimumAutoupdateVersion>5.0.0</sparkle:minimumAutoupdateVersion>
-            <sparkle:version>6.9.3</sparkle:version>
-            <sparkle:shortVersionString>6.9.3</sparkle:shortVersionString>
-            <sparkle:minimumSystemVersion>11.0</sparkle:minimumSystemVersion>
-            <sparkle:releaseNotesLink>https://files.lunar.fyi/ReleaseNotes/Lunar-6.9.3.html</sparkle:releaseNotesLink>
-            <enclosure url="https://files.lunar.fyi/releases/Lunar-6.9.3.dmg" length="20783648" type="application/octet-stream" sparkle:edSignature="wIwbP3ALnLCsZN4hfY4seOzzDCBFP3Q2MIDDZ6+9wHcalRuewR3+fUvP1zvpaS7g6wrm+zOunluKy9xpup+XCg=="/>
-            <sparkle:deltas>
-                <enclosure url="https://files.lunar.fyi/deltas/Lunar6.9.3-6.9.2.delta" sparkle:deltaFrom="6.9.2" length="1769702" type="application/octet-stream" sparkle:deltaFromSparkleExecutableSize="1837232" sparkle:deltaFromSparkleLocales="en,Base" sparkle:edSignature="syTZRVahZt4lzk5q+wPeBQSTM4NH2f0dn5cIhu/vY9xvHM+tuav6JuInBgv12ve9oltXzwPHtyUz1E0jc4FOBw=="/>
-                <enclosure url="https://files.lunar.fyi/deltas/Lunar6.9.3-6.9.1.delta" sparkle:deltaFrom="6.9.1" length="1998514" type="application/oct
```

---

### Incident Patch 3: `22e899d5` (2026-05-08)
**Commit Message**: Fix Auto Mode selecting Sensor instead of Sync in specific cases

**File**: `Lunar/Utils/DisplayController.swift` (modified, +6/-1)
```diff
@@ -1377,7 +1377,12 @@ final class DisplayController: ObservableObject {
     }
 
     static func getSourceDisplay(_ displays: [Display]? = nil) -> Display {
-        guard let displays = displays ?? CachedDefaults[.displays], !displays.isEmpty else {
+        let displays = if displays == nil {
+            CachedDefaults[.displays]
+        } else {
+            displays
+        }
+        guard let displays, !displays.isEmpty else {
             return ALL_DISPLAYS
         }
 
```

**File**: `ReleaseNotes/6.10.2.md` (added, +3/-0)
```diff
@@ -0,0 +1,3 @@
+## Fixes
+
+- Fix Auto Mode selecting Sensor instead of Sync in specific cases
```

---

### Incident Patch 4: `47c14162` (2026-04-10)
**Commit Message**: Fix package resolution

**File**: `Lunar.xcodeproj/project.pbxproj` (modified, +0/-2)
```diff
@@ -1548,8 +1548,6 @@
 				kind = upToNextMajorVersion;
 				minimumVersion = 9.2.0;
 			};
-			traits = (
-			);
 		};
 		C77AB65A269A032E0046BA78 /* XCRemoteSwiftPackageReference "Magnet" */ = {
 			isa = XCRemoteSwiftPackageReference;
```

**File**: `Lunar.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved` (modified, +2/-2)
```diff
@@ -60,8 +60,8 @@
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/alin23/FuzzyMatcher",
       "state" : {
-        "branch" : "main",
-        "revision" : "6c7628a46a566d64d6b7d79068c95bf80c8a6bd6"
+        "revision" : "6e2cda30e50904bd3d11ee869d2196d865289ce4",
+        "version" : "0.1.2"
       }
     },
     {
```

---

### Incident Patch 5: `95f6446b` (2026-04-10)
**Commit Message**: Sync mode after blackout fixes

**File**: `.gitsecret/paths/mapping.cfg` (modified, +1/-1)
```diff
@@ -7,4 +7,4 @@ Lunar/Data/Pro.swift:849cf9003fdc4b07d1593503bf25f85b9337b35facc39bc247be4b62dd2
 Lunar/Modes/ClockMode.swift:d012d1b6cd91d0527ca6d6d00fd5b7742c3671855fba5d43ab31b6413d8afc84
 Lunar/DDC/DDC2.h:2413c548ce3cc1681316b52486b66769529ae244ec5c76a160cdc190e7236f61
 Lunar/DDC/DDC2.c:8488fdfb13ca9525e44db616c773eb67f1f1d52dcf83115d7666b0d79bbeef5a
-Lunar/required.swift:5bd5254a5701c36d1c10cc2e9d0073eaf72d89caf17da82dc5af8b0ba5b47dc1
+Lunar/required.swift:6cf65346342de3aa85f37b2fae772fb413ddfc29669d80e1ef95fca6c16596ae
```

**File**: `Lunar.xcodeproj/project.pbxproj` (modified, +23/-6)
```diff
@@ -181,6 +181,7 @@
 		C7CBEFFD238E81FF00031E93 /* Util.swift in Sources */ = {isa = PBXBuildFile; fileRef = C7CBEFFC238E81FF00031E93 /* Util.swift */; };
 		C7CC5D1629437E2C00DEA106 /* DDC2.h in Headers */ = {isa = PBXBuildFile; fileRef = C7CC5D1529437E2C00DEA106 /* DDC2.h */; };
 		C7CFF494271FF280002CB549 /* DDCPopoverController.swift in Sources */ = {isa = PBXBuildFile; fileRef = C7CFF492271FF280002CB549 /* DDCPopoverController.swift */; };
+		C7D698C12F88FB7A00FAFD3A /* FuzzyMatcher in Frameworks */ = {isa = PBXBuildFile; productRef = C7D698C02F88FB7A00FAFD3A /* FuzzyMatcher */; };
 		C7DA10F7259B8979006DD876 /* Regex in Frameworks */ = {isa = PBXBuildFile; productRef = C7DA10F6259B8979006DD876 /* Regex */; };
 		C7DD622126120B7600B07B31 /* RaspberryPageController.swift in Sources */ = {isa = PBXBuildFile; fileRef = C7DD622026120B7600B07B31 /* RaspberryPageController.swift */; };
 		C7DD62292612331700B07B31 /* PaddedTextField.swift in Sources */ = {isa = PBXBuildFile; fileRef = C7DD62282612331700B07B31 /* PaddedTextField.swift */; };
@@ -309,7 +310,6 @@
 		C7545E3125B1996300383AFB /* PopUpButton.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = PopUpButton.swift; sourceTree = "<group>"; };
 		C7574F802354691700358397 /* gencode.sh */ = {isa = PBXFileReference; fileEncoding = 4; lastKnownFileType = text.script.sh; name = gencode.sh; path = bin/gencode.sh; sourceTree = "<group>"; };
 		C7574F812354691700358397 /* buildscript.sh */ = {isa = PBXFileReference; fileEncoding = 4; lastKnownFileType = text.script.sh; name = buildscript.sh; path = bin/buildscript.sh; sourceTree = "<group>"; };
-		C7605FC72F7AB7040087B195 /* FuzzyMatcher */ = {isa = PBXFileReference; lastKnownFileType = wrapper; name = FuzzyMatcher; path = /Users/alin/Github/alin23/FuzzyMatcher; sourceTree = "<absolute>"; };
 		C76168F929B8B79F00D0A33A /* Bridge.h */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.c.h; path = Bridge.h; sourceTree = "<group>"; };
 		C76168FB29B8B91C00D0A33A /* SidecarCore.framework */ = {isa = PBXFileReference; lastKnownFileType = wrapper.framework; name = SidecarCore.framework; path = ../../../../../System/Library/PrivateFrameworks/SidecarCore.framework; sourceTree = "<group>"; };
 		C762AAE8271F3D6200198EDA /* ColorsPopoverController.swift */ = {isa = PBXFileReference; fileEncoding = 4; lastKnownFileType = sourcecode.swift; path = ColorsPopoverController.swift; sourceTree = "<group>"; };
@@ -445,6 +445,7 @@
 			isa = PBXFrameworksBuildPhase;
 			buildActionMask = 2147483647;
 			files = (
+				C7D698C12F88FB7A00FAFD3A /* FuzzyMatcher in Frameworks */,
 				C799C2F527BF67C4003A2FB9 /* Socket in Frameworks */,
 				C73CC6AE24616462003B2658 /* Sauce in Frameworks */,
 				C70A793D2AB471F900289426 /* SwiftUIIntrospect in Frameworks */,
@@ -709,7 +710,6 @@
 		C7AEC7EC1FD0B4350039B562 = {
 			isa = PBXGroup;
 			children = (
-				C7605FC72F7AB7040087B195 /* FuzzyMatcher */,
 				C705A03B268B4187001ABBA9 /* Packages */,
 				C73B41F3263BE46F006F6783 /* Localization */,
 				C7574F7F235468EE00358397 /* Scripts */,
@@ -927,6 +927,7 @@
 				C744D07B2B434605003D77DE /* Sentry */,
 				C7160EBF2BBACBDF000F83F2 /* FuzzyMatcher */,
 				C788DCEC2F5F615400107F11 /* MacModelDB */,
+				C7D698C02F88FB7A00FAFD3A /* FuzzyMatcher */,
 			);
 			productName = Lunar;
 			productReference = C7AEC7F51FD0B4350039B562 /* Lunar.app */;
@@ -988,6 +989,7 @@
 				C7BD5F83287B44130077CCB7 /* XCRemoteSwiftPackageReference "Charts" */,
 				C744D07A2B434605003D77DE /* XCRemoteSwiftPackageReference "sentry-cocoa" */,
 				C788DCEB2F5F615400107F11 /* XCRemoteSwiftPackageReference "MacModelDB" */,
+				C7D698BF2F88FB7900FAFD3A /* XCRemoteSwiftPackageReference "FuzzyMatcher" */,
 			);
 			productRefGroup = C7AEC7F61FD0B4350039B562 /* Products */;
 			projectDirPath = "";
@@ -1286,8 +1288,8 @@
 				CODE_SIGN_IDENTITY = "Mac Developer";
 				COPY_PHASE_STRIP = YES;
 				DEAD_CODE_STRIPPING = YES;
-				DEPLOYMENT_POSTPROCESSING = YES;
 				DEBUG_INFORMATION_FORMAT = "dwarf-with-dsym";
+				DEPLOYMENT_POSTPROCESSING = YES;
 				ENABLE_NS_ASSERTIONS = NO;
 				ENABLE_STRICT_OBJC_MSGSEND = YES;
 				GCC_C_LANGUAGE_STANDARD = gnu11;
@@ -1389,6 +1391,7 @@
 				CODE_SIGN_STYLE = Manual;
 				COMBINE_HIDPI_IMAGES = YES;
 				CURRENT_PROJECT_VERSION = 6.10.0;
+				DEPLOYMENT_POSTPROCESSING = YES;
 				DEVELOPMENT_ASSET_PATHS = "";
 				DEVELOPMENT_TEAM = "";
 				"DEVELOPMENT_TEAM[sdk=macosx*]" = RDDXV84A73;
@@ -1400,7 +1403,7 @@
 					"$(PROJECT_DIR)/Frameworks/Sparkle",
 					"$(SYSTEM_LIBRARY_DIR)/PrivateFrameworks",
 				);
-				GCC_OPTIMIZATION_LEVEL = 3;
+				GCC_OPTIMIZATION_LEVEL = s;
 				HEADER_SEARCH_PATHS = "$(PROJECT_DIR)/Frameworks/Shout/Sources/CSSH/libssh2";
 				INFOPLIST_FILE = Lunar/Info.plist;
 				INFOPLIST_KEY_CFBundleDisplayName = Lunar;
@@ -1426,10 +1429,9 @@
 				PRODUCT_NAME = "$(TARGET_NAME)";
 				PROVISIONING_PROFILE_SPECIFIER = "";
 				SDKROOT = macosx;
-				SWIFT_OBJC_BRIDGING_HEADER = 
```

**File**: `Lunar.xcworkspace/xcshareddata/swiftpm/Package.resolved` (modified, +256/-248)
```diff
@@ -1,250 +1,258 @@
 {
-  "object": {
-    "pins": [
-      {
-        "package": "AnyCodable",
-        "repositoryURL": "https://github.com/Flight-School/AnyCodable",
-        "state": {
-          "branch": null,
-          "revision": "862808b2070cd908cb04f9aafe7de83d35f81b05",
-          "version": "0.6.7"
-        }
-      },
-      {
-        "package": "AXSwift",
-        "repositoryURL": "https://github.com/alin23/AXSwift",
-        "state": {
-          "branch": "main",
-          "revision": "055c6abb49bb86c8d700da74d834523b03b4d702",
-          "version": null
-        }
-      },
-      {
-        "package": "BlueSocket",
-        "repositoryURL": "https://github.com/alin23/BlueSocket",
-        "state": {
-          "branch": "master",
-          "revision": "4e334a848f89c44b2348332f0996f312dc6ed0d2",
-          "version": null
-        }
-      },
-      {
-        "package": "Charts",
-        "repositoryURL": "https://github.com/alin23/Charts/",
-        "state": {
-          "branch": "master",
-          "revision": "27af8f086176bbaabb2bfcd53005bf8e0647a296",
-          "version": null
-        }
-      },
-      {
-        "package": "DataCompression",
-        "repositoryURL": "https://github.com/mw99/DataCompression/",
-        "state": {
-          "branch": null,
-          "revision": "16f858982a077451ce3bdbd9144d3073ec85b6e4",
-          "version": "3.9.0"
-        }
-      },
-      {
-        "package": "Defaults",
-        "repositoryURL": "https://github.com/sindresorhus/Defaults",
-        "state": {
-          "branch": null,
-          "revision": "3efef5a28ebdbbe922d4a2049493733ed14475a6",
-          "version": "7.3.1"
-        }
-      },
-      {
-        "package": "Glob",
-        "repositoryURL": "https://github.com/Bouke/Glob",
-        "state": {
-          "branch": null,
-          "revision": "deda6e163d2ff2a8d7e138e2c3326dbd71157faf",
-          "version": "1.0.5"
-        }
-      },
-      {
-        "package": "KeyHolder",
-        "repositoryURL": "https://github.com/alin23/KeyHolder",
-        "state": {
-          "branch": "master",
-          "revision": "4cbb7eaa0b9ba245d33e9cf176f2b70c778f2784",
-          "version": null
-        }
-      },
-      {
-        "package": "MacModelDB",
-        "repositoryURL": "https://github.com/alin23/MacModelDB",
-        "state": {
-          "branch": null,
-          "revision": "7a529050731855763504809820395484669458c2",
-          "version": "1.0.2"
-        }
-      },
-      {
-        "package": "Magnet",
-        "repositoryURL": "https://github.com/alin23/Magnet",
-        "state": {
-          "branch": "dev",
-          "revision": "a21e6c4fd0fdb0244009e7c1fce64b31a01c39ca",
-          "version": null
-        }
-      },
-      {
-        "package": "MediaKeyTap",
-        "repositoryURL": "https://github.com/alin23/MediaKeyTap",
-        "state": {
-          "branch": "dev",
-          "revision": "5b8ee686bc90d917cba4f029b47c2a8541a4f58d",
-          "version": null
-        }
-      },
-      {
-        "package": "Path.swift",
-        "repositoryURL": "https://github.com/mxcl/Path.swift",
-        "state": {
-          "branch": null,
-          "revision": "74ec90bbe50a3376e399286fed48b60db9b91bb1",
-          "version": "1.6.0"
-        }
-      },
-      {
-        "package": "Regex",
-        "repositoryURL": "https://github.com/crossroadlabs/Regex",
-        "state": {
-          "branch": null,
-          "revision": "166728756082a9cac6e4aed3ebbce8e41cb3a945",
-          "version": "1.2.0"
-        }
-      },
-      {
-        "package": "Sauce",
-        "repositoryURL": "https://github.com/Clipy/Sauce",
-        "state": {
-          "branch": null,
-          "revision": "2fcf7e43a242b183fdea3f2275ebec0d773b65f5",
-          "version": "2.2.0"
-        }
-      },
-      {
-        "package": "Sentry",
-        "repositoryURL": "https://github.com/getsentry/sentry-cocoa",
-        "state": {
-          "branch": null,
-          "revision": "d459ff99b1912c9603c9e607e030b4b98e2e199a",
-          "version": "9.9.0"
-        }
-      },
-      {
-        "package": "SimplyCoreAudio",
-        "repositoryURL": "https://github.com/rnine/SimplyCoreAudio",
-        "state": {
-          "branch": "develop",
-          "revision": "b5430564b1d55adab3c331fb7574445a84bd4ceb",
-          "version": null
-        }
-      },
-      {
-        "package": "Surge",
-        "repositoryURL": "https://github.com/Jounce/Surge",
-        "state": {
-          "branch": null,
-          "revision": "6e4a47e63da8801afe6188cf039e9f04eb577721",
-          "version": "2.3.2"
-        }
-      },
-      {
-        "package": "swift-algorithms",
-        "repositoryURL": "https://github.com/apple/swift-algorithms",
-        "state": {
-          "branch": null,
-          "revision": "87e50f483c54e6efd60e885f7f5aa946cee68023",
-          "version": "1.2.1"
-        }
-      },
-      {
-        "package": "swift-
```

**File**: `Releases/appcast-stable.xml` (modified, +6/-6)
```diff
@@ -12,13 +12,13 @@
             <sparkle:shortVersionString>6.10.0</sparkle:shortVersionString>
             <sparkle:minimumSystemVersion>11.0</sparkle:minimumSystemVersion>
             <sparkle:releaseNotesLink>https://files.lunar.fyi/ReleaseNotes/Lunar-6.10.0.html</sparkle:releaseNotesLink>
-            <enclosure url="https://files.lunar.fyi/releases/Lunar-6.10.0.dmg" length="21268300" type="application/octet-stream" sparkle:edSignature="rTh39wIgE848EjGm/rAVvdkXVuHddp9IW8031AC/PW7e/Rownr7nPPmYVB21DJME6c4NkALKQ/o9X3TRuAi1DQ=="/>
+            <enclosure url="https://files.lunar.fyi/releases/Lunar-6.10.0.dmg" length="17600573" type="application/octet-stream" sparkle:edSignature="Kp4E6cWX7mj8JT8CY53RNNtpo3PpYkKSapyFjkeqcidlhiqro39/EUkKPy/Z4hV+pKE7bFgQKq8DfgbINeajAw=="/>
             <sparkle:deltas>
-                <enclosure url="https://files.lunar.fyi/deltas/Lunar6.10.0-6.9.10.delta" sparkle:deltaFrom="6.9.10" length="6812534" type="application/octet-stream" sparkle:deltaFromSparkleExecutableSize="977808" sparkle:deltaFromSparkleLocales="Base" sparkle:edSignature="aXfK6kXXbN07UqfWENBFHMxhUfLOdloRQpddZzrqP8b7NUywBJF/xx7KHjTdl+jBBrqKtV7Mjr5NrIMz6L0qBg=="/>
-                <enclosure url="https://files.lunar.fyi/deltas/Lunar6.10.0-6.9.9.delta" sparkle:deltaFrom="6.9.9" length="6980638" type="application/octet-stream" sparkle:deltaFromSparkleExecutableSize="977808" sparkle:deltaFromSparkleLocales="Base" sparkle:edSignature="m68G3GzrGqfEPhCw95Ly9ibcgIjgjCeBNORYdGtAhplkEHCnQEu8WfKN2p3kpXIH+2jVApQkc3yKqrfINoljAQ=="/>
-                <enclosure url="https://files.lunar.fyi/deltas/Lunar6.10.0-6.9.8.delta" sparkle:deltaFrom="6.9.8" length="6962602" type="application/octet-stream" sparkle:deltaFromSparkleExecutableSize="977808" sparkle:deltaFromSparkleLocales="Base" sparkle:edSignature="JSkeD0g0l9sB4BF8x4lZRv3uGFGxW3jBuLGfdslD9yRGLl/b8ADmy9JOpj1vowy2deUNoIb0HfnkabXHqE9lBw=="/>
-                <enclosure url="https://files.lunar.fyi/deltas/Lunar6.10.0-6.9.7.delta" sparkle:deltaFrom="6.9.7" length="7703266" type="application/octet-stream" sparkle:deltaFromSparkleExecutableSize="1837232" sparkle:deltaFromSparkleLocales="en,Base" sparkle:edSignature="jgKtvQ/6YqUIzOqU8ZJhXeWZeh1sZDx98dJ0HcwiAducLryGxbCzJCg+aywsy1Vf1G0vzoj9DK1sobppX92CDw=="/>
-                <enclosure url="https://files.lunar.fyi/deltas/Lunar6.10.0-6.9.6.delta" sparkle:deltaFrom="6.9.6" length="7681946" type="application/octet-stream" sparkle:deltaFromSparkleExecutableSize="1837232" sparkle:deltaFromSparkleLocales="en,Base" sparkle:edSignature="oh2kHswN6K2eYmnsFfEaPGdH/5dq52JZG+H34INdGi3N+ft3/BBDN8acX6/Iq0tckIW0zdSQN9sFX5K2Xt9DBg=="/>
+                <enclosure url="https://files.lunar.fyi/deltas/Lunar6.10.0-6.9.10.delta" sparkle:deltaFrom="6.9.10" length="6089774" type="application/octet-stream" sparkle:deltaFromSparkleExecutableSize="977808" sparkle:deltaFromSparkleLocales="Base" sparkle:edSignature="4JYMWX6lK5ZYa3I8yC7qrZdCsANh3oi+5siryhsogHc9uC39Grjv2gXhPtrkzpuFHlo+eLM+WiX49IajINmdDg=="/>
+                <enclosure url="https://files.lunar.fyi/deltas/Lunar6.10.0-6.9.9.delta" sparkle:deltaFrom="6.9.9" length="6157734" type="application/octet-stream" sparkle:deltaFromSparkleExecutableSize="977808" sparkle:deltaFromSparkleLocales="Base" sparkle:edSignature="4GAVZ+ntBSUjqhcA5QSlMTRXUgqULGarPZj5KnLQNsLSXMP022GeHSP04vnHoj9L/TK2FWnv+tmJNKatTa2qBw=="/>
+                <enclosure url="https://files.lunar.fyi/deltas/Lunar6.10.0-6.9.8.delta" sparkle:deltaFrom="6.9.8" length="6162322" type="application/octet-stream" sparkle:deltaFromSparkleExecutableSize="977808" sparkle:deltaFromSparkleLocales="Base" sparkle:edSignature="yL2AqEjO5NxAGGNvXjS9fAtEXUYU4SxefncBvzDziIKLkV74L5z5vkGn7jNYyUqwpfIzPYtnCu2LsXp773XnAQ=="/>
+                <enclosure url="https://files.lunar.fyi/deltas/Lunar6.10.0-6.9.7.delta" sparkle:deltaFrom="6.9.7" length="6860614" type="application/octet-stream" sparkle:deltaFromSparkleExecutableSize="1837232" sparkle:deltaFromSparkleLocales="en,Base" sparkle:edSignature="rdtR62elLdS/ATtwmjNKzjzNT9hoadOKzz8SR97dMHC5x+bwJDPKQT78OxoKCQBNOPlwLQ7Stzzrcfjl/Y5wBQ=="/>
+                <enclosure url="https://files.lunar.fyi/deltas/Lunar6.10.0-6.9.6.delta" sparkle:deltaFrom="6.9.6" length="6854722" type="application/octet-stream" sparkle:deltaFromSparkleExecutableSize="1837232" sparkle:deltaFromSparkleLocales="en,Base" sparkle:edSignature="+iwsUFP6lq62Ic6WLKeB1esKr4iISt7Q6tFEMwCsKwuAVF5qJuXDjM54B9RgdhTXQXXTNpIU3Q4ayleS4m5CDg=="/>
             </sparkle:deltas>
         </item>
         <item>
```

**File**: `Releases/appcast2.xml` (modified, +6/-6)
```diff
@@ -12,13 +12,13 @@
             <sparkle:shortVersionString>6.10.0</sparkle:shortVersionString>
             <sparkle:minimumSystemVersion>11.0</sparkle:minimumSystemVersion>
             <sparkle:releaseNotesLink>https://files.lunar.fyi/ReleaseNotes/Lunar-6.10.0.html</sparkle:releaseNotesLink>
-            <enclosure url="https://files.lunar.fyi/releases/Lunar-6.10.0.dmg" length="21268300" type="application/octet-stream" sparkle:edSignature="rTh39wIgE848EjGm/rAVvdkXVuHddp9IW8031AC/PW7e/Rownr7nPPmYVB21DJME6c4NkALKQ/o9X3TRuAi1DQ=="/>
+            <enclosure url="https://files.lunar.fyi/releases/Lunar-6.10.0.dmg" length="17600573" type="application/octet-stream" sparkle:edSignature="Kp4E6cWX7mj8JT8CY53RNNtpo3PpYkKSapyFjkeqcidlhiqro39/EUkKPy/Z4hV+pKE7bFgQKq8DfgbINeajAw=="/>
             <sparkle:deltas>
-                <enclosure url="https://files.lunar.fyi/deltas/Lunar6.10.0-6.9.10.delta" sparkle:deltaFrom="6.9.10" length="6812534" type="application/octet-stream" sparkle:deltaFromSparkleExecutableSize="977808" sparkle:deltaFromSparkleLocales="Base" sparkle:edSignature="aXfK6kXXbN07UqfWENBFHMxhUfLOdloRQpddZzrqP8b7NUywBJF/xx7KHjTdl+jBBrqKtV7Mjr5NrIMz6L0qBg=="/>
-                <enclosure url="https://files.lunar.fyi/deltas/Lunar6.10.0-6.9.9.delta" sparkle:deltaFrom="6.9.9" length="6980638" type="application/octet-stream" sparkle:deltaFromSparkleExecutableSize="977808" sparkle:deltaFromSparkleLocales="Base" sparkle:edSignature="m68G3GzrGqfEPhCw95Ly9ibcgIjgjCeBNORYdGtAhplkEHCnQEu8WfKN2p3kpXIH+2jVApQkc3yKqrfINoljAQ=="/>
-                <enclosure url="https://files.lunar.fyi/deltas/Lunar6.10.0-6.9.8.delta" sparkle:deltaFrom="6.9.8" length="6962602" type="application/octet-stream" sparkle:deltaFromSparkleExecutableSize="977808" sparkle:deltaFromSparkleLocales="Base" sparkle:edSignature="JSkeD0g0l9sB4BF8x4lZRv3uGFGxW3jBuLGfdslD9yRGLl/b8ADmy9JOpj1vowy2deUNoIb0HfnkabXHqE9lBw=="/>
-                <enclosure url="https://files.lunar.fyi/deltas/Lunar6.10.0-6.9.7.delta" sparkle:deltaFrom="6.9.7" length="7703266" type="application/octet-stream" sparkle:deltaFromSparkleExecutableSize="1837232" sparkle:deltaFromSparkleLocales="en,Base" sparkle:edSignature="jgKtvQ/6YqUIzOqU8ZJhXeWZeh1sZDx98dJ0HcwiAducLryGxbCzJCg+aywsy1Vf1G0vzoj9DK1sobppX92CDw=="/>
-                <enclosure url="https://files.lunar.fyi/deltas/Lunar6.10.0-6.9.6.delta" sparkle:deltaFrom="6.9.6" length="7681946" type="application/octet-stream" sparkle:deltaFromSparkleExecutableSize="1837232" sparkle:deltaFromSparkleLocales="en,Base" sparkle:edSignature="oh2kHswN6K2eYmnsFfEaPGdH/5dq52JZG+H34INdGi3N+ft3/BBDN8acX6/Iq0tckIW0zdSQN9sFX5K2Xt9DBg=="/>
+                <enclosure url="https://files.lunar.fyi/deltas/Lunar6.10.0-6.9.10.delta" sparkle:deltaFrom="6.9.10" length="6089774" type="application/octet-stream" sparkle:deltaFromSparkleExecutableSize="977808" sparkle:deltaFromSparkleLocales="Base" sparkle:edSignature="4JYMWX6lK5ZYa3I8yC7qrZdCsANh3oi+5siryhsogHc9uC39Grjv2gXhPtrkzpuFHlo+eLM+WiX49IajINmdDg=="/>
+                <enclosure url="https://files.lunar.fyi/deltas/Lunar6.10.0-6.9.9.delta" sparkle:deltaFrom="6.9.9" length="6157734" type="application/octet-stream" sparkle:deltaFromSparkleExecutableSize="977808" sparkle:deltaFromSparkleLocales="Base" sparkle:edSignature="4GAVZ+ntBSUjqhcA5QSlMTRXUgqULGarPZj5KnLQNsLSXMP022GeHSP04vnHoj9L/TK2FWnv+tmJNKatTa2qBw=="/>
+                <enclosure url="https://files.lunar.fyi/deltas/Lunar6.10.0-6.9.8.delta" sparkle:deltaFrom="6.9.8" length="6162322" type="application/octet-stream" sparkle:deltaFromSparkleExecutableSize="977808" sparkle:deltaFromSparkleLocales="Base" sparkle:edSignature="yL2AqEjO5NxAGGNvXjS9fAtEXUYU4SxefncBvzDziIKLkV74L5z5vkGn7jNYyUqwpfIzPYtnCu2LsXp773XnAQ=="/>
+                <enclosure url="https://files.lunar.fyi/deltas/Lunar6.10.0-6.9.7.delta" sparkle:deltaFrom="6.9.7" length="6860614" type="application/octet-stream" sparkle:deltaFromSparkleExecutableSize="1837232" sparkle:deltaFromSparkleLocales="en,Base" sparkle:edSignature="rdtR62elLdS/ATtwmjNKzjzNT9hoadOKzz8SR97dMHC5x+bwJDPKQT78OxoKCQBNOPlwLQ7Stzzrcfjl/Y5wBQ=="/>
+                <enclosure url="https://files.lunar.fyi/deltas/Lunar6.10.0-6.9.6.delta" sparkle:deltaFrom="6.9.6" length="6854722" type="application/octet-stream" sparkle:deltaFromSparkleExecutableSize="1837232" sparkle:deltaFromSparkleLocales="en,Base" sparkle:edSignature="+iwsUFP6lq62Ic6WLKeB1esKr4iISt7Q6tFEMwCsKwuAVF5qJuXDjM54B9RgdhTXQXXTNpIU3Q4ayleS4m5CDg=="/>
             </sparkle:deltas>
         </item>
         <item>
```

---

### Incident Patch 6: `9b2a10d9` (2026-04-08)
**Commit Message**: Fix Sync Mode getting wrongly enabled after coming out of sleep in blackout

**File**: `.gitsecret/paths/mapping.cfg` (modified, +2/-2)
```diff
@@ -3,8 +3,8 @@ Lunar/Resources/eddsa_priv:d079018c2b1c003c9e239ea8f8cc999b7d98adfd0616911ba0263
 Lunar/Modes/SensorMode.swift:231e4fc567c3925c2153c32cc0452eb9ee84c1789dc82628e2ccddb38c24c025
 Lunar/Modes/SyncMode.swift:c6d7e54cf37dc198643bc5dc9657b39f86387b7fc85343e525890535ee33be85
 Lunar/Modes/LocationMode.swift:9964ed4ba9098fc7a17c515a4ea5b9c128fc1d5cfba1deb7ac11a75cef3e7702
-Lunar/Data/Pro.swift:36799f95e018b63fe9507065dcea5296f7608aec4055dce4d3775eb20dc9088a
+Lunar/Data/Pro.swift:849cf9003fdc4b07d1593503bf25f85b9337b35facc39bc247be4b62dd2d317b
 Lunar/Modes/ClockMode.swift:d012d1b6cd91d0527ca6d6d00fd5b7742c3671855fba5d43ab31b6413d8afc84
 Lunar/DDC/DDC2.h:2413c548ce3cc1681316b52486b66769529ae244ec5c76a160cdc190e7236f61
 Lunar/DDC/DDC2.c:8488fdfb13ca9525e44db616c773eb67f1f1d52dcf83115d7666b0d79bbeef5a
-Lunar/required.swift:055c8dd10165b8034b18c24eb42c5ff46427d95bb3b317695317eeda67c54a0d
+Lunar/required.swift:5bd5254a5701c36d1c10cc2e9d0073eaf72d89caf17da82dc5af8b0ba5b47dc1
```

**File**: `Lunar.xcodeproj/project.pbxproj` (modified, +5/-1)
```diff
@@ -1284,8 +1284,9 @@
 				CLANG_WARN_UNREACHABLE_CODE = YES;
 				CLANG_WARN__DUPLICATE_METHOD_MATCH = YES;
 				CODE_SIGN_IDENTITY = "Mac Developer";
-				COPY_PHASE_STRIP = NO;
+				COPY_PHASE_STRIP = YES;
 				DEAD_CODE_STRIPPING = YES;
+				DEPLOYMENT_POSTPROCESSING = YES;
 				DEBUG_INFORMATION_FORMAT = "dwarf-with-dsym";
 				ENABLE_NS_ASSERTIONS = NO;
 				ENABLE_STRICT_OBJC_MSGSEND = YES;
@@ -1426,6 +1427,9 @@
 				PROVISIONING_PROFILE_SPECIFIER = "";
 				SDKROOT = macosx;
 				SWIFT_OBJC_BRIDGING_HEADER = "Lunar/DDC/Lunar-Bridging-Header.h";
+				DEPLOYMENT_POSTPROCESSING = YES;
+				STRIP_INSTALLED_PRODUCT = YES;
+				STRIP_STYLE = "non-global";
 				SWIFT_OPTIMIZATION_LEVEL = "-O";
 				SWIFT_VERSION = 5.0;
 				SYSTEM_FRAMEWORK_SEARCH_PATHS = "$(inherited)";
```

**File**: `Lunar.xcworkspace/xcshareddata/swiftpm/Package.resolved` (modified, +4/-4)
```diff
@@ -105,8 +105,8 @@
         "repositoryURL": "https://github.com/mxcl/Path.swift",
         "state": {
           "branch": null,
-          "revision": "afe25cdba7b8f952c16bc0c4290bdeb6af61f92f",
-          "version": "1.5.0"
+          "revision": "74ec90bbe50a3376e399286fed48b60db9b91bb1",
+          "version": "1.6.0"
         }
       },
       {
@@ -132,8 +132,8 @@
         "repositoryURL": "https://github.com/getsentry/sentry-cocoa",
         "state": {
           "branch": null,
-          "revision": "05d3ce8332097ff0b2347231ac66476fd7d2f4d8",
-          "version": "9.8.0"
+          "revision": "d459ff99b1912c9603c9e607e030b4b98e2e199a",
+          "version": "9.9.0"
         }
       },
       {
```

**File**: `Lunar/Utils/DisplayController.swift` (modified, +20/-1)
```diff
@@ -1377,7 +1377,7 @@ final class DisplayController: ObservableObject {
     }
 
     static func getSourceDisplay(_ displays: [Display]? = nil) -> Display {
-        guard let displays = displays ?? CachedDefaults[.displays] else {
+        guard let displays = displays ?? CachedDefaults[.displays], !displays.isEmpty else {
             return ALL_DISPLAYS
         }
 
@@ -2379,7 +2379,26 @@ final class DisplayController: ObservableObject {
         if let d = activeNewDisplays.first, activeNewDisplays.count == 1, d.isBuiltin, d.blackOutEnabled, activeOldDisplays.count > 1 {
             log.info("Disabling BlackOut if we're left with only 1 screen")
             lastBlackOutToggleDate = .distantPast
+            let preservedAdaptiveMode = d.blackOutEnabledWithoutMirroring && CachedDefaults[.overrideAdaptiveMode] ? adaptiveModeKey : nil
             blackOut(display: d.id, state: .off, mirroringAllowed: !d.blackOutEnabledWithoutMirroring)
+            if let preservedAdaptiveMode {
+                let restoreAdaptiveMode = { [self] in
+                    guard adaptiveModeKey != preservedAdaptiveMode else { return }
+
+                    Defaults.withoutPropagation {
+                        pausedAdaptiveModeObserver = true
+                        adaptiveMode = preservedAdaptiveMode.mode
+                        CachedDefaults[.overrideAdaptiveMode] = true
+                        CachedDefaults[.adaptiveBrightnessMode] = preservedAdaptiveMode
+                        pausedAdaptiveModeObserver = false
+                    }
+                }
+
+                restoreAdaptiveMode()
+                mainAsync {
+                    restoreAdaptiveMode()
+                }
+            }
         }
 
         #if arch(arm64)
```

---

### Incident Patch 7: `df5ee9fb` (2026-03-31)
**Commit Message**: Fixes

**File**: `.gitsecret/paths/mapping.cfg` (modified, +1/-1)
```diff
@@ -3,7 +3,7 @@ Lunar/Resources/eddsa_priv:d079018c2b1c003c9e239ea8f8cc999b7d98adfd0616911ba0263
 Lunar/Modes/SensorMode.swift:231e4fc567c3925c2153c32cc0452eb9ee84c1789dc82628e2ccddb38c24c025
 Lunar/Modes/SyncMode.swift:c6d7e54cf37dc198643bc5dc9657b39f86387b7fc85343e525890535ee33be85
 Lunar/Modes/LocationMode.swift:9964ed4ba9098fc7a17c515a4ea5b9c128fc1d5cfba1deb7ac11a75cef3e7702
-Lunar/Data/Pro.swift:780cbee7d0d0d271705323558d6d3584eab5b7832b8c48331875d17d84f957a4
+Lunar/Data/Pro.swift:36799f95e018b63fe9507065dcea5296f7608aec4055dce4d3775eb20dc9088a
 Lunar/Modes/ClockMode.swift:d012d1b6cd91d0527ca6d6d00fd5b7742c3671855fba5d43ab31b6413d8afc84
 Lunar/DDC/DDC2.h:2413c548ce3cc1681316b52486b66769529ae244ec5c76a160cdc190e7236f61
 Lunar/DDC/DDC2.c:8488fdfb13ca9525e44db616c773eb67f1f1d52dcf83115d7666b0d79bbeef5a
```

**File**: `Lunar.xcodeproj/project.pbxproj` (modified, +6/-14)
```diff
@@ -309,6 +309,7 @@
 		C7545E3125B1996300383AFB /* PopUpButton.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = PopUpButton.swift; sourceTree = "<group>"; };
 		C7574F802354691700358397 /* gencode.sh */ = {isa = PBXFileReference; fileEncoding = 4; lastKnownFileType = text.script.sh; name = gencode.sh; path = bin/gencode.sh; sourceTree = "<group>"; };
 		C7574F812354691700358397 /* buildscript.sh */ = {isa = PBXFileReference; fileEncoding = 4; lastKnownFileType = text.script.sh; name = buildscript.sh; path = bin/buildscript.sh; sourceTree = "<group>"; };
+		C7605FC72F7AB7040087B195 /* FuzzyMatcher */ = {isa = PBXFileReference; lastKnownFileType = wrapper; name = FuzzyMatcher; path = /Users/alin/Github/alin23/FuzzyMatcher; sourceTree = "<absolute>"; };
 		C76168F929B8B79F00D0A33A /* Bridge.h */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.c.h; path = Bridge.h; sourceTree = "<group>"; };
 		C76168FB29B8B91C00D0A33A /* SidecarCore.framework */ = {isa = PBXFileReference; lastKnownFileType = wrapper.framework; name = SidecarCore.framework; path = ../../../../../System/Library/PrivateFrameworks/SidecarCore.framework; sourceTree = "<group>"; };
 		C762AAE8271F3D6200198EDA /* ColorsPopoverController.swift */ = {isa = PBXFileReference; fileEncoding = 4; lastKnownFileType = sourcecode.swift; path = ColorsPopoverController.swift; sourceTree = "<group>"; };
@@ -708,6 +709,7 @@
 		C7AEC7EC1FD0B4350039B562 = {
 			isa = PBXGroup;
 			children = (
+				C7605FC72F7AB7040087B195 /* FuzzyMatcher */,
 				C705A03B268B4187001ABBA9 /* Packages */,
 				C73B41F3263BE46F006F6783 /* Localization */,
 				C7574F7F235468EE00358397 /* Scripts */,
@@ -985,7 +987,6 @@
 				C77C77562812AA80006326BE /* XCRemoteSwiftPackageReference "SwiftUI-Introspect" */,
 				C7BD5F83287B44130077CCB7 /* XCRemoteSwiftPackageReference "Charts" */,
 				C744D07A2B434605003D77DE /* XCRemoteSwiftPackageReference "sentry-cocoa" */,
-				C7160EBE2BBACBDF000F83F2 /* XCRemoteSwiftPackageReference "FuzzyMatcher" */,
 				C788DCEB2F5F615400107F11 /* XCRemoteSwiftPackageReference "MacModelDB" */,
 			);
 			productRefGroup = C7AEC7F61FD0B4350039B562 /* Products */;
@@ -1320,7 +1321,7 @@
 				CODE_SIGN_INJECT_BASE_ENTITLEMENTS = NO;
 				CODE_SIGN_STYLE = Manual;
 				COMBINE_HIDPI_IMAGES = YES;
-				CURRENT_PROJECT_VERSION = 6.9.10;
+				CURRENT_PROJECT_VERSION = 6.10.0;
 				DEBUG_INFORMATION_FORMAT = "dwarf-with-dsym";
 				DEVELOPMENT_ASSET_PATHS = "";
 				DEVELOPMENT_TEAM = "";
@@ -1352,7 +1353,7 @@
 				);
 				LLVM_LTO = NO;
 				MACOSX_DEPLOYMENT_TARGET = 11.0;
-				MARKETING_VERSION = 6.9.10;
+				MARKETING_VERSION = 6.10.0;
 				MTL_ENABLE_DEBUG_INFO = NO;
 				OTHER_CODE_SIGN_FLAGS = "";
 				PRODUCT_BUNDLE_IDENTIFIER = fyi.lunar.Lunar;
@@ -1386,7 +1387,7 @@
 				CODE_SIGN_INJECT_BASE_ENTITLEMENTS = NO;
 				CODE_SIGN_STYLE = Manual;
 				COMBINE_HIDPI_IMAGES = YES;
-				CURRENT_PROJECT_VERSION = 6.9.10;
+				CURRENT_PROJECT_VERSION = 6.10.0;
 				DEVELOPMENT_ASSET_PATHS = "";
 				DEVELOPMENT_TEAM = "";
 				"DEVELOPMENT_TEAM[sdk=macosx*]" = RDDXV84A73;
@@ -1417,7 +1418,7 @@
 				);
 				LLVM_LTO = YES;
 				MACOSX_DEPLOYMENT_TARGET = 11.0;
-				MARKETING_VERSION = 6.9.10;
+				MARKETING_VERSION = 6.10.0;
 				MTL_ENABLE_DEBUG_INFO = NO;
 				OTHER_CODE_SIGN_FLAGS = "--timestamp";
 				PRODUCT_BUNDLE_IDENTIFIER = fyi.lunar.Lunar;
@@ -1510,14 +1511,6 @@
 				kind = branch;
 			};
 		};
-		C7160EBE2BBACBDF000F83F2 /* XCRemoteSwiftPackageReference "FuzzyMatcher" */ = {
-			isa = XCRemoteSwiftPackageReference;
-			repositoryURL = "https://github.com/alin23/FuzzyMatcher";
-			requirement = {
-				branch = main;
-				kind = branch;
-			};
-		};
 		C73B9A0B25FB9AD7003184FC /* XCRemoteSwiftPackageReference "Glob" */ = {
 			isa = XCRemoteSwiftPackageReference;
 			repositoryURL = "https://github.com/Bouke/Glob";
@@ -1702,7 +1695,6 @@
 		};
 		C7160EBF2BBACBDF000F83F2 /* FuzzyMatcher */ = {
 			isa = XCSwiftPackageProductDependency;
-			package = C7160EBE2BBACBDF000F83F2 /* XCRemoteSwiftPackageReference "FuzzyMatcher" */;
 			productName = FuzzyMatcher;
 		};
 		C73B9A0C25FB9AD7003184FC /* Glob */ = {
```

**File**: `Lunar.xcodeproj/xcuserdata/alin.xcuserdatad/xcschemes/xcschememanagement.plist` (modified, +1/-1)
```diff
@@ -30,7 +30,7 @@
 			<key>isShown</key>
 			<true/>
 			<key>orderHint</key>
-			<integer>1</integer>
+			<integer>0</integer>
 		</dict>
 		<key>LunarPlayground (Playground) 1.xcscheme</key>
 		<dict>
```

**File**: `Lunar.xcworkspace/xcshareddata/swiftpm/Package.resolved` (modified, +248/-256)
```diff
@@ -1,258 +1,250 @@
 {
-  "originHash" : "435149211245f4824d9f225087cd780270ae83e188eacd4398189990aeb6023d",
-  "pins" : [
-    {
-      "identity" : "anycodable",
-      "kind" : "remoteSourceControl",
-      "location" : "https://github.com/Flight-School/AnyCodable",
-      "state" : {
-        "revision" : "862808b2070cd908cb04f9aafe7de83d35f81b05",
-        "version" : "0.6.7"
-      }
-    },
-    {
-      "identity" : "axswift",
-      "kind" : "remoteSourceControl",
-      "location" : "https://github.com/alin23/AXSwift",
-      "state" : {
-        "branch" : "main",
-        "revision" : "055c6abb49bb86c8d700da74d834523b03b4d702"
-      }
-    },
-    {
-      "identity" : "bluesocket",
-      "kind" : "remoteSourceControl",
-      "location" : "https://github.com/alin23/BlueSocket",
-      "state" : {
-        "branch" : "master",
-        "revision" : "4e334a848f89c44b2348332f0996f312dc6ed0d2"
-      }
-    },
-    {
-      "identity" : "charts",
-      "kind" : "remoteSourceControl",
-      "location" : "https://github.com/alin23/Charts/",
-      "state" : {
-        "branch" : "master",
-        "revision" : "27af8f086176bbaabb2bfcd53005bf8e0647a296"
-      }
-    },
-    {
-      "identity" : "datacompression",
-      "kind" : "remoteSourceControl",
-      "location" : "https://github.com/mw99/DataCompression/",
-      "state" : {
-        "revision" : "16f858982a077451ce3bdbd9144d3073ec85b6e4",
-        "version" : "3.9.0"
-      }
-    },
-    {
-      "identity" : "defaults",
-      "kind" : "remoteSourceControl",
-      "location" : "https://github.com/sindresorhus/Defaults",
-      "state" : {
-        "revision" : "3efef5a28ebdbbe922d4a2049493733ed14475a6",
-        "version" : "7.3.1"
-      }
-    },
-    {
-      "identity" : "fuzzymatcher",
-      "kind" : "remoteSourceControl",
-      "location" : "https://github.com/alin23/FuzzyMatcher",
-      "state" : {
-        "branch" : "main",
-        "revision" : "6c7628a46a566d64d6b7d79068c95bf80c8a6bd6"
-      }
-    },
-    {
-      "identity" : "glob",
-      "kind" : "remoteSourceControl",
-      "location" : "https://github.com/Bouke/Glob",
-      "state" : {
-        "revision" : "deda6e163d2ff2a8d7e138e2c3326dbd71157faf",
-        "version" : "1.0.5"
-      }
-    },
-    {
-      "identity" : "keyholder",
-      "kind" : "remoteSourceControl",
-      "location" : "https://github.com/alin23/KeyHolder",
-      "state" : {
-        "branch" : "master",
-        "revision" : "4cbb7eaa0b9ba245d33e9cf176f2b70c778f2784"
-      }
-    },
-    {
-      "identity" : "macmodeldb",
-      "kind" : "remoteSourceControl",
-      "location" : "https://github.com/alin23/MacModelDB",
-      "state" : {
-        "revision" : "7a529050731855763504809820395484669458c2",
-        "version" : "1.0.2"
-      }
-    },
-    {
-      "identity" : "magnet",
-      "kind" : "remoteSourceControl",
-      "location" : "https://github.com/alin23/Magnet",
-      "state" : {
-        "branch" : "dev",
-        "revision" : "a21e6c4fd0fdb0244009e7c1fce64b31a01c39ca"
-      }
-    },
-    {
-      "identity" : "mediakeytap",
-      "kind" : "remoteSourceControl",
-      "location" : "https://github.com/alin23/MediaKeyTap",
-      "state" : {
-        "branch" : "dev",
-        "revision" : "5b8ee686bc90d917cba4f029b47c2a8541a4f58d"
-      }
-    },
-    {
-      "identity" : "path.swift",
-      "kind" : "remoteSourceControl",
-      "location" : "https://github.com/mxcl/Path.swift",
-      "state" : {
-        "revision" : "8e355c28e9393c42e58b18c54cace2c42c98a616",
-        "version" : "1.4.1"
-      }
-    },
-    {
-      "identity" : "regex",
-      "kind" : "remoteSourceControl",
-      "location" : "https://github.com/crossroadlabs/Regex",
-      "state" : {
-        "revision" : "166728756082a9cac6e4aed3ebbce8e41cb3a945",
-        "version" : "1.2.0"
-      }
-    },
-    {
-      "identity" : "sauce",
-      "kind" : "remoteSourceControl",
-      "location" : "https://github.com/Clipy/Sauce",
-      "state" : {
-        "revision" : "2fcf7e43a242b183fdea3f2275ebec0d773b65f5",
-        "version" : "2.2.0"
-      }
-    },
-    {
-      "identity" : "sentry-cocoa",
-      "kind" : "remoteSourceControl",
-      "location" : "https://github.com/getsentry/sentry-cocoa",
-      "state" : {
-        "revision" : "990135f0881e56ac6b39404de0f5b0cd0dcf2131",
-        "version" : "9.6.0"
-      }
-    },
-    {
-      "identity" : "simplycoreaudio",
-      "kind" : "remoteSourceControl",
-      "location" : "https://github.com/rnine/SimplyCoreAudio",
-      "state" : {
-        "branch" : "develop",
-        "revision" : "b5430564b1d55adab3c331fb7574445a84bd4ceb"
-      }
-    },
-    {
-      "identity" : "surge",
-      "kind" : "remoteSourceControl",
-      "location" : "https://github.com/Jounce/Surge",
-      "state" : {
-        "revision" : "6e4a47e63da8801afe6188cf039e9f04eb577721",
-        "version" : "2.3.2"
-      }
-    },
-    {
-      "identity" : "sw
```

**File**: `Lunar.xcworkspace/xcuserdata/alin.xcuserdatad/xcschemes/xcschememanagement.plist` (modified, +6/-6)
```diff
@@ -401,7 +401,7 @@
 			<key>isShown</key>
 			<false/>
 			<key>orderHint</key>
-			<integer>2</integer>
+			<integer>5</integer>
 		</dict>
 		<key>LunarPlayground (Playground) 1.xcscheme</key>
 		<dict>
@@ -828,7 +828,7 @@
 			<key>isShown</key>
 			<false/>
 			<key>orderHint</key>
-			<integer>15</integer>
+			<integer>3</integer>
 		</dict>
 		<key>PlaygroundChart (Playground) 1.xcscheme</key>
 		<dict>
@@ -1227,7 +1227,7 @@
 			<key>isShown</key>
 			<false/>
 			<key>orderHint</key>
-			<integer>11</integer>
+			<integer>1</integer>
 		</dict>
 		<key>Surge (Playground) 1.xcscheme</key>
 		<dict>
@@ -1626,7 +1626,7 @@
 			<key>isShown</key>
 			<false/>
 			<key>orderHint</key>
-			<integer>5</integer>
+			<integer>6</integer>
 		</dict>
 		<key>SwiftDate (Playground) 1.xcscheme</key>
 		<dict>
@@ -2025,7 +2025,7 @@
 			<key>isShown</key>
 			<false/>
 			<key>orderHint</key>
-			<integer>8</integer>
+			<integer>4</integer>
 		</dict>
 		<key>SwiftyMarkdown (Playground) 1.xcscheme</key>
 		<dict>
@@ -2424,7 +2424,7 @@
 			<key>isShown</key>
 			<false/>
 			<key>orderHint</key>
-			<integer>14</integer>
+			<integer>2</integer>
 		</dict>
 	</dict>
 </dict>
```

**File**: `Lunar/Utils/DisplayController.swift` (modified, +2/-1)
```diff
@@ -524,6 +524,7 @@ final class DisplayController: ObservableObject {
 
     let getDisplaysLock = NSRecursiveLock()
     var disabledAdaptiveInClamshellMode = false
+    var disabledAdaptiveForBlackout = false
 
     var appObserver: NSKeyValueObservation?
     @AtomicLock var runningAppExceptions: [AppException]!
@@ -2378,7 +2379,7 @@ final class DisplayController: ObservableObject {
         if let d = activeNewDisplays.first, activeNewDisplays.count == 1, d.isBuiltin, d.blackOutEnabled, activeOldDisplays.count > 1 {
             log.info("Disabling BlackOut if we're left with only 1 screen")
             lastBlackOutToggleDate = .distantPast
-            blackOut(display: d.id, state: .off)
+            blackOut(display: d.id, state: .off, mirroringAllowed: !d.blackOutEnabledWithoutMirroring)
         }
 
         #if arch(arm64)
```

**File**: `ReleaseNotes/6.10.0.md` (added, +4/-0)
```diff
@@ -0,0 +1,4 @@
+## Fixes
+
+- Re-compile with macOS 26.4 SDK to make Shortcuts appear again
+- Fix Sync Mode being re-enabled after waking from long standby when using Manual Mode with built-in display blackout
```

**File**: `Releases/appcast-stable.xml` (modified, +19/-19)
```diff
@@ -2,6 +2,25 @@
 <rss xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle" version="2.0">
     <channel>
         <title>Lunar</title>
+        <item>
+            <title>6.10.0</title>
+            <pubDate>Mon, 30 Mar 2026 17:04:15 +0300</pubDate>
+            <link>https://lunar.fyi/</link>
+            <sparkle:fullReleaseNotesLink>https://lunar.fyi/changelog</sparkle:fullReleaseNotesLink>
+            <sparkle:minimumAutoupdateVersion>5.0.0</sparkle:minimumAutoupdateVersion>
+            <sparkle:version>6.10.0</sparkle:version>
+            <sparkle:shortVersionString>6.10.0</sparkle:shortVersionString>
+            <sparkle:minimumSystemVersion>11.0</sparkle:minimumSystemVersion>
+            <sparkle:releaseNotesLink>https://files.lunar.fyi/ReleaseNotes/Lunar-6.10.0.html</sparkle:releaseNotesLink>
+            <enclosure url="https://files.lunar.fyi/releases/Lunar-6.10.0.dmg" length="21268300" type="application/octet-stream" sparkle:edSignature="rTh39wIgE848EjGm/rAVvdkXVuHddp9IW8031AC/PW7e/Rownr7nPPmYVB21DJME6c4NkALKQ/o9X3TRuAi1DQ=="/>
+            <sparkle:deltas>
+                <enclosure url="https://files.lunar.fyi/deltas/Lunar6.10.0-6.9.10.delta" sparkle:deltaFrom="6.9.10" length="6812534" type="application/octet-stream" sparkle:deltaFromSparkleExecutableSize="977808" sparkle:deltaFromSparkleLocales="Base" sparkle:edSignature="aXfK6kXXbN07UqfWENBFHMxhUfLOdloRQpddZzrqP8b7NUywBJF/xx7KHjTdl+jBBrqKtV7Mjr5NrIMz6L0qBg=="/>
+                <enclosure url="https://files.lunar.fyi/deltas/Lunar6.10.0-6.9.9.delta" sparkle:deltaFrom="6.9.9" length="6980638" type="application/octet-stream" sparkle:deltaFromSparkleExecutableSize="977808" sparkle:deltaFromSparkleLocales="Base" sparkle:edSignature="m68G3GzrGqfEPhCw95Ly9ibcgIjgjCeBNORYdGtAhplkEHCnQEu8WfKN2p3kpXIH+2jVApQkc3yKqrfINoljAQ=="/>
+                <enclosure url="https://files.lunar.fyi/deltas/Lunar6.10.0-6.9.8.delta" sparkle:deltaFrom="6.9.8" length="6962602" type="application/octet-stream" sparkle:deltaFromSparkleExecutableSize="977808" sparkle:deltaFromSparkleLocales="Base" sparkle:edSignature="JSkeD0g0l9sB4BF8x4lZRv3uGFGxW3jBuLGfdslD9yRGLl/b8ADmy9JOpj1vowy2deUNoIb0HfnkabXHqE9lBw=="/>
+                <enclosure url="https://files.lunar.fyi/deltas/Lunar6.10.0-6.9.7.delta" sparkle:deltaFrom="6.9.7" length="7703266" type="application/octet-stream" sparkle:deltaFromSparkleExecutableSize="1837232" sparkle:deltaFromSparkleLocales="en,Base" sparkle:edSignature="jgKtvQ/6YqUIzOqU8ZJhXeWZeh1sZDx98dJ0HcwiAducLryGxbCzJCg+aywsy1Vf1G0vzoj9DK1sobppX92CDw=="/>
+                <enclosure url="https://files.lunar.fyi/deltas/Lunar6.10.0-6.9.6.delta" sparkle:deltaFrom="6.9.6" length="7681946" type="application/octet-stream" sparkle:deltaFromSparkleExecutableSize="1837232" sparkle:deltaFromSparkleLocales="en,Base" sparkle:edSignature="oh2kHswN6K2eYmnsFfEaPGdH/5dq52JZG+H34INdGi3N+ft3/BBDN8acX6/Iq0tckIW0zdSQN9sFX5K2Xt9DBg=="/>
+            </sparkle:deltas>
+        </item>
         <item>
             <title>6.9.10</title>
             <pubDate>Mon, 09 Mar 2026 22:39:28 +0200</pubDate>
@@ -173,25 +192,6 @@
                 <enclosure url="https://files.lunar.fyi/deltas/Lunar6.9.2-6.8.7.delta" sparkle:deltaFrom="6.8.7" length="7311058" type="application/octet-stream" sparkle:deltaFromSparkleExecutableSize="1842416" sparkle:deltaFromSparkleLocales="en,Base" sparkle:edSignature="8V9v0xJF6yP6p4UJyuelPpFFx6sROKNptPF0DWI+7+8JhiD1ZVA2tti26VkgLt9YNopyw7PfAsPJ2Rjcule8CA=="/>
             </sparkle:deltas>
         </item>
-        <item>
-            <title>6.9.1</title>
-            <pubDate>Thu, 25 Sep 2025 14:09:24 +0300</pubDate>
-            <link>https://lunar.fyi/</link>
-            <sparkle:fullReleaseNotesLink>https://lunar.fyi/changelog</sparkle:fullReleaseNotesLink>
-            <sparkle:minimumAutoupdateVersion>5.0.0</sparkle:minimumAutoupdateVersion>
-            <sparkle:version>6.9.1</sparkle:version>
-            <sparkle:shortVersionString>6.9.1</sparkle:shortVersionString>
-            <sparkle:minimumSystemVersion>11.0</sparkle:minimumSystemVersion>
-            <sparkle:releaseNotesLink>https://files.lunar.fyi/ReleaseNotes/Lunar-6.9.1.html</sparkle:releaseNotesLink>
-            <enclosure url="https://files.lunar.fyi/releases/Lunar-6.9.1.dmg" length="20770653" type="application/octet-stream" sparkle:edSignature="RLfT9gnZPvePu8+bM9Fn5Ebvjc2GbCXrPsVkapQHFRilsVtfbPUORu903xeUYOWMNZvf0A0EJL0Ih0R4IJWPAg=="/>
-            <sparkle:deltas>
-                <enclosure url="https://files.lunar.fyi/deltas/Lunar6.9.1-6.9.0.delta" sparkle:deltaFrom="6.9.0" length="1367066" type="application/octet-stream" sparkle:deltaFromSparkleExecutableSize="1837232" sparkle:deltaFromSparkleLocales="en,Base" sparkle:edSignature="EwfBOnXd/ktf234gBRicfEe4U8JcsXCrxcVvFEBVbv47haEgBw22o9T3yBQTjTJPTyoDpyqKGuPGW88ksrTQAg=="/>
-                <enclosure url="https://files.lunar.fyi/deltas/Lunar6.9.1-6.8.9.delta" sparkle:deltaFrom="6.8.9" length="6794474" type="application
```

---

### Incident Patch 8: `dd3ee7f5` (2026-03-09)
**Commit Message**: Restore sub-zero dimming when the app restarts on crash or hang

**File**: `Lunar.xcodeproj/project.pbxproj` (modified, +0/-23)
```diff
@@ -894,7 +894,6 @@
 				C7AEC7F31FD0B4350039B562 /* Resources */,
 				C7AEC7F21FD0B4350039B562 /* Frameworks */,
 				C75083582222865F0020270E /* Embed Frameworks */,
-				C750F301299E47AE0004ECEF /* Run Script */,
 			);
 			buildRules = (
 			);
@@ -1024,28 +1023,6 @@
 		};
 /* End PBXResourcesBuildPhase section */
 
-/* Begin PBXShellScriptBuildPhase section */
-		C750F301299E47AE0004ECEF /* Run Script */ = {
-			isa = PBXShellScriptBuildPhase;
-			buildActionMask = 2147483647;
-			files = (
-			);
-			inputFileListPaths = (
-			);
-			inputPaths = (
-			);
-			name = "Run Script";
-			outputFileListPaths = (
-			);
-			outputPaths = (
-				"$(CODESIGNING_FOLDER_PATH)/Contents/_MASReceipt/receipt",
-			);
-			runOnlyForDeploymentPostprocessing = 0;
-			shellPath = /bin/sh;
-			shellScript = "mkdir -p \"$CODESIGNING_FOLDER_PATH/Contents/_MASReceipt\"\ntouch \"$CODESIGNING_FOLDER_PATH/Contents/_MASReceipt/receipt\"\n";
-		};
-/* End PBXShellScriptBuildPhase section */
-
 /* Begin PBXSourcesBuildPhase section */
 		C7AEC7F11FD0B4350039B562 /* Sources */ = {
 			isa = PBXSourcesBuildPhase;
```

**File**: `Lunar/Data/Display.swift` (modified, +18/-9)
```diff
@@ -689,6 +689,16 @@ let AUDIO_IDENTIFIER_UUID_PATTERN = "([0-9a-f]{2})([0-9a-f]{2})-([0-9a-f]{4})-[0
         if let possibleMaxNits, possibleMaxNits > 0, let control = control as? AppleNativeControl {
             control.updateNits()
         }
+
+        let name = name
+        if restarted, let sb = try container.decodeIfPresent(Float.self, forKey: .softwareBrightness), sb < 1 {
+            log.debug("Restoring software brightness \(sb) for \(name) in 3 seconds")
+            softwareBrightness = sb
+            softwareBrightnessRestorer = mainAsyncAfter(ms: 3000) { [weak self] in
+                log.debug("Applying restored software brightness \(sb) for \(name)")
+                self?.setIndependentSoftwareBrightness(sb)
+            }
+        }
     }
 
     init(
@@ -2886,6 +2896,7 @@ let AUDIO_IDENTIFIER_UUID_PATTERN = "([0-9a-f]{2})([0-9a-f]{2})-([0-9a-f]{4})-[0
             }
 
             setIndependentSoftwareBrightness(softwareBrightness, oldValue: oldValue)
+            save()
         }
     }
 
@@ -5402,18 +5413,9 @@ let AUDIO_IDENTIFIER_UUID_PATTERN = "([0-9a-f]{2})([0-9a-f]{2})-([0-9a-f]{4})-[0
                 }
             }
             .store(in: &observers)
-
-        #if DEBUG
-            if isTestID(id), name.contains("DELL") {
-                audioIdentifier = "~:AMS2_Aggregate:0"
-            }
-        #endif
     }
 
     func setupHotkeys() {
-        #if DEBUG
-            log.info("Trying to setup hotkeys for \(description)")
-        #endif
         guard active else { return }
 
         if let controller = hotkeyPopoverController {
@@ -6738,6 +6740,13 @@ let AUDIO_IDENTIFIER_UUID_PATTERN = "([0-9a-f]{2})([0-9a-f]{2})-([0-9a-f]{4})-[0
 
         return adaptive ? .lunar : .system
     }
+
+    private var softwareBrightnessRestorer: DispatchWorkItem? {
+        didSet {
+            oldValue?.cancel()
+        }
+    }
+
 }
 
 let DS_LOGGER = Logger(subsystem: "fyi.lunar.Lunar.DisplayServices", category: "default")
```

**File**: `Lunar/SwiftUIViews/DisplayRowView.swift` (modified, +2/-2)
```diff
@@ -443,7 +443,7 @@ struct DisplayRowView: View {
         VStack(spacing: 2) {
             let showInput = display.hasDDC && showInputInQuickActions
             let showAdditionalUI = display.showOrientation || display.appPreset != nil || display.adaptivePaused
-                || showRawValues && (display.lastRawBrightness != nil || display.lastRawContrast != nil || display.lastRawVolume != nil)
+                || showRawValues && (display.usesDDCBrightnessControl && (display.lastRawBrightness != nil || display.lastRawContrast != nil || display.lastRawVolume != nil))
                 || SWIFTUI_PREVIEW
 
             if showInput, !showAdditionalUI {
@@ -469,7 +469,7 @@ struct DisplayRowView: View {
                             }
                     }
 
-                    if showRawValues {
+                    if showRawValues, display.usesDDCBrightnessControl {
                         RawValuesView(display: display).frame(width: 220).padding(.vertical, 3)
                     }
                 }
```

**File**: `ReleaseNotes/6.9.10.md` (added, +4/-0)
```diff
@@ -0,0 +1,4 @@
+## Fixes
+
+- Hide raw values on non-DDC monitors
+- Restore sub-zero dimming when the app restarts on crash or hang
```

---

### Incident Patch 9: `6259e837` (2026-02-22)
**Commit Message**: XDR fixes

**File**: `.gitsecret/paths/mapping.cfg` (modified, +1/-1)
```diff
@@ -3,7 +3,7 @@ Lunar/Resources/eddsa_priv:d079018c2b1c003c9e239ea8f8cc999b7d98adfd0616911ba0263
 Lunar/Modes/SensorMode.swift:231e4fc567c3925c2153c32cc0452eb9ee84c1789dc82628e2ccddb38c24c025
 Lunar/Modes/SyncMode.swift:99587e6a44dfd3620f154a34ac83e0a9c0fedc82b778c6cad71bbeacb437864e
 Lunar/Modes/LocationMode.swift:bef485a1eb39359f19a37599c2fa55fc3a2f448295570f20c7b4e65984a63ec1
-Lunar/Data/Pro.swift:bf91c99c5a12d0c19b5b5a887344e2c4cbdab4f9551c8d8f5baf30c0968cffc1
+Lunar/Data/Pro.swift:87271fc9df10953cd8ea301bf90e3d364f045a52b9690ca9376c7e5281c5e581
 Lunar/Modes/ClockMode.swift:d012d1b6cd91d0527ca6d6d00fd5b7742c3671855fba5d43ab31b6413d8afc84
 Lunar/DDC/DDC2.h:2413c548ce3cc1681316b52486b66769529ae244ec5c76a160cdc190e7236f61
 Lunar/DDC/DDC2.c:8488fdfb13ca9525e44db616c773eb67f1f1d52dcf83115d7666b0d79bbeef5a
```

**File**: `Lunar.xcodeproj/project.pbxproj` (modified, +4/-4)
```diff
@@ -1343,7 +1343,7 @@
 				CODE_SIGN_INJECT_BASE_ENTITLEMENTS = NO;
 				CODE_SIGN_STYLE = Manual;
 				COMBINE_HIDPI_IMAGES = YES;
-				CURRENT_PROJECT_VERSION = 6.9.7;
+				CURRENT_PROJECT_VERSION = 6.9.8;
 				DEBUG_INFORMATION_FORMAT = "dwarf-with-dsym";
 				DEVELOPMENT_ASSET_PATHS = "";
 				DEVELOPMENT_TEAM = "";
@@ -1375,7 +1375,7 @@
 				);
 				LLVM_LTO = NO;
 				MACOSX_DEPLOYMENT_TARGET = 11.0;
-				MARKETING_VERSION = 6.9.7;
+				MARKETING_VERSION = 6.9.8;
 				MTL_ENABLE_DEBUG_INFO = NO;
 				OTHER_CODE_SIGN_FLAGS = "";
 				PRODUCT_BUNDLE_IDENTIFIER = fyi.lunar.Lunar;
@@ -1409,7 +1409,7 @@
 				CODE_SIGN_INJECT_BASE_ENTITLEMENTS = NO;
 				CODE_SIGN_STYLE = Manual;
 				COMBINE_HIDPI_IMAGES = YES;
-				CURRENT_PROJECT_VERSION = 6.9.7;
+				CURRENT_PROJECT_VERSION = 6.9.8;
 				DEVELOPMENT_ASSET_PATHS = "";
 				DEVELOPMENT_TEAM = "";
 				"DEVELOPMENT_TEAM[sdk=macosx*]" = RDDXV84A73;
@@ -1440,7 +1440,7 @@
 				);
 				LLVM_LTO = YES;
 				MACOSX_DEPLOYMENT_TARGET = 11.0;
-				MARKETING_VERSION = 6.9.7;
+				MARKETING_VERSION = 6.9.8;
 				MTL_ENABLE_DEBUG_INFO = NO;
 				OTHER_CODE_SIGN_FLAGS = "--timestamp";
 				PRODUCT_BUNDLE_IDENTIFIER = fyi.lunar.Lunar;
```

**File**: `Lunar.xcworkspace/xcshareddata/swiftpm/Package.resolved` (modified, +2/-2)
```diff
@@ -132,8 +132,8 @@
       "kind" : "remoteSourceControl",
       "location" : "https://github.com/getsentry/sentry-cocoa",
       "state" : {
-        "revision" : "de66bd4fa0661c81455e8ad2509ed6f0e39025dc",
-        "version" : "9.2.0"
+        "revision" : "c97459fd75243c620a09a1e6219e63aaec37555e",
+        "version" : "9.5.0"
       }
     },
     {
```

**File**: `Lunar/AppDelegate.swift` (modified, +14/-0)
```diff
@@ -294,6 +294,7 @@ final class AppDelegate: NSObject, NSApplicationDelegate, CLLocationManagerDeleg
 
     var wakeObserver: Cancellable?
     var screenObserver: Cancellable?
+    var activationPolicyBeforeModal: NSApplication.ActivationPolicy?
 
     lazy var updater = SPUUpdater(
         hostBundle: Bundle.main,
@@ -496,6 +497,19 @@ final class AppDelegate: NSObject, NSApplicationDelegate, CLLocationManagerDeleg
         UM.newVersion = update.displayVersionString
     }
 
+    func standardUserDriverWillShowModalAlert() {
+        activationPolicyBeforeModal = NSApp.activationPolicy()
+        NSApp.setActivationPolicy(.regular)
+        NSApp.activate(ignoringOtherApps: true)
+    }
+
+    func standardUserDriverDidShowModalAlert() {
+        if let policy = activationPolicyBeforeModal {
+            NSApp.setActivationPolicy(policy)
+            activationPolicyBeforeModal = nil
+        }
+    }
+
     func standardUserDriverWillFinishUpdateSession() {
         // We will dismiss our gentle UI indicator if the user session for the update finishes
         UM.newVersion = nil
```

**File**: `Lunar/Data/Display.swift` (modified, +2/-2)
```diff
@@ -1666,8 +1666,8 @@ let AUDIO_IDENTIFIER_UUID_PATTERN = "([0-9a-f]{2})([0-9a-f]{2})-([0-9a-f]{4})-[0
         p
             .debounce(for: .milliseconds(5000), scheduler: RunLoop.main)
             .sink { [weak self] shouldPause in
-                guard let self, shouldPause, ambientLightCompensationEnabledByUser else { return }
-                systemAdaptiveBrightness = true
+                // guard let self, shouldPause, ambientLightCompensationEnabledByUser else { return }
+                // systemAdaptiveBrightness = true
             }.store(in: &observers)
 
         return p
```

**File**: `Lunar/ErrorReports.swift` (modified, +5/-0)
```diff
@@ -188,6 +188,11 @@ private var sleeping = false
                 lastMainThreadCheckin = Date().timeIntervalSince1970
             }
         }
+        RunLoop.main.perform(inModes: [.modalPanel, .eventTracking, .default, .common]) {
+            appHangStateQueue.async {
+                lastMainThreadCheckin = Date().timeIntervalSince1970
+            }
+        }
     }
     appHangTimer = timer
     timer.resume()
```

**File**: `Lunar/Views/OSDWindow.swift` (modified, +12/-5)
```diff
@@ -234,6 +234,10 @@ extension Color {
 
 // MARK: - BigSurSlider
 
+private final class BindingProxy {
+    var binding: Binding<Float> = .constant(0)
+}
+
 struct BigSurSlider: View {
     init(
         percentage: Binding<Float>,
@@ -297,7 +301,6 @@ struct BigSurSlider: View {
     @Binding var shownValue: Double?
 
     @State var scrollWheelListener: Cancellable?
-
     @State var hovering = false
     @State var enableText: String? = nil
     @State var lastCursorPosition = NSEvent.mouseLocation
@@ -313,6 +316,7 @@ struct BigSurSlider: View {
     var onSettingPercentage: ((Float) -> Void)?
 
     var body: some View {
+        let _ = { percentageProxy.binding = _percentage }()
         GeometryReader { geometry in
             let w = geometry.size.width - sliderHeight
             let cgPercentage = cap(percentage, minVal: 0, maxVal: 1).cg
@@ -439,6 +443,8 @@ struct BigSurSlider: View {
         }
     }
 
+    @State private var percentageProxy = BindingProxy()
+
     private var sliderWidth: CGFloat = 200
     private var sliderHeight: CGFloat = 22
 
@@ -464,7 +470,7 @@ struct BigSurSlider: View {
     }
 
     private func trackScrollWheel() {
-        guard scrollWheelListener == nil else { return }
+        scrollWheelListener = nil
         scrollWheelListener = NSApp.publisher(for: \.currentEvent)
             .filter { event in event?.type == .scrollWheel }
             .throttle(for: .milliseconds(20), scheduler: DispatchQueue.main, latest: true)
@@ -495,9 +501,10 @@ struct BigSurSlider: View {
                         env.draggingSlider = false
                     }
                 }
-                beforeSettingPercentage?(percentage)
-                percentage = cap(percentage - (delta / 100), minVal: 0, maxVal: 1)
-                onSettingPercentage?(percentage)
+                let current = percentageProxy.binding.wrappedValue
+                beforeSettingPercentage?(current)
+                percentageProxy.binding.wrappedValue = cap(current - (delta / 100), minVal: 0, maxVal: 1)
+                onSettingPercentage?(percentageProxy.binding.wrappedValue)
             }
     }
 }
```

**File**: `Lunar/Views/ProViews.swift` (modified, +11/-8)
```diff
@@ -104,14 +104,17 @@ struct VersionView: View {
 
                 Spacer()
 
-                SwiftUI.Button("Check for updates") { updater.checkForUpdates() }
-                    .buttonStyle(FlatButton(
-                        color: Color.white.opacity(0.1),
-                        textColor: Color.white,
-                        horizontalPadding: 6,
-                        verticalPadding: 3
-                    ))
-                    .font(.system(size: 10, weight: .semibold))
+                SwiftUI.Button("Check for updates") {
+                    appDelegate?.statusItemButtonController?.closeMenuBar()
+                    updater.checkForUpdates()
+                }
+                .buttonStyle(FlatButton(
+                    color: Color.white.opacity(0.1),
+                    textColor: Color.white,
+                    horizontalPadding: 6,
+                    verticalPadding: 3
+                ))
+                .font(.system(size: 10, weight: .semibold))
             }
             Divider().padding(.vertical, 2).opacity(0.5)
             HStack(spacing: 2) {
```

---

### Incident Patch 10: `93c4daf3` (2026-02-11)
**Commit Message**: Remove preset unlock and fix hang detection

**File**: `.gitsecret/paths/mapping.cfg` (modified, +1/-1)
```diff
@@ -3,7 +3,7 @@ Lunar/Resources/eddsa_priv:d079018c2b1c003c9e239ea8f8cc999b7d98adfd0616911ba0263
 Lunar/Modes/SensorMode.swift:231e4fc567c3925c2153c32cc0452eb9ee84c1789dc82628e2ccddb38c24c025
 Lunar/Modes/SyncMode.swift:99587e6a44dfd3620f154a34ac83e0a9c0fedc82b778c6cad71bbeacb437864e
 Lunar/Modes/LocationMode.swift:bef485a1eb39359f19a37599c2fa55fc3a2f448295570f20c7b4e65984a63ec1
-Lunar/Data/Pro.swift:6a364026f1906b8c1767bc20e8606e12f77a5a37095eff75c074250b04b30957
+Lunar/Data/Pro.swift:a6a6285043dfe783791dc2b23a769eb54f0f0ec871cf754da3652a4e143a0bcc
 Lunar/Modes/ClockMode.swift:d012d1b6cd91d0527ca6d6d00fd5b7742c3671855fba5d43ab31b6413d8afc84
 Lunar/DDC/DDC2.h:2413c548ce3cc1681316b52486b66769529ae244ec5c76a160cdc190e7236f61
 Lunar/DDC/DDC2.c:8488fdfb13ca9525e44db616c773eb67f1f1d52dcf83115d7666b0d79bbeef5a
```

**File**: `Lunar/ErrorReports.swift` (modified, +62/-9)
```diff
@@ -1,3 +1,4 @@
+import Cocoa
 import Combine
 import Defaults
 import Sentry
@@ -32,11 +33,11 @@ private final class RepeatingHang {
 
     lazy var count: Int = RepeatingHangState.count(cause: cause, now: Date().timeIntervalSince1970)
 
-    func isCulprit() -> Bool {
-        guard let stackSymbols = Thread.callStackSymbols.first(where: { $0.contains(expectedStackFrame) }) else {
+    func isCulprit(mainThreadStack: String) -> Bool {
+        guard mainThreadStack.contains(expectedStackFrame) else {
             return false
         }
-        log.warning("Hang detected with expected stack frame '\(expectedStackFrame)': \(stackSymbols)")
+        log.warning("Hang detected with expected stack frame '\(expectedStackFrame)' in main thread sample")
         return true
     }
 
@@ -93,10 +94,11 @@ private enum RepeatingHangState {
     }
 }
 
-private let appHangStateQueue = DispatchQueue(label: "com.lunar.appHangDetection.state")
+private let appHangStateQueue = DispatchQueue(label: "fyi.lunar.appHangDetection.state")
 @MainActor private var appHangTimer: DispatchSourceTimer?
 private var lastMainThreadCheckin: TimeInterval = 0
 private var appHangTriggered = false
+private var sleeping = false
 
 @MainActor var enableSentryObserver: Cancellable?
 
@@ -171,7 +173,7 @@ private var appHangTriggered = false
         var shouldTrigger = false
 
         appHangStateQueue.sync {
-            if !appHangTriggered, now - lastMainThreadCheckin > APP_HANG_DETECTION_INTERVAL {
+            if !appHangTriggered, !sleeping, now - lastMainThreadCheckin > APP_HANG_DETECTION_INTERVAL {
                 appHangTriggered = true
                 shouldTrigger = true
             }
@@ -189,17 +191,68 @@ private var appHangTriggered = false
     }
     appHangTimer = timer
     timer.resume()
+
+    let nc = NSWorkspace.shared.notificationCenter
+    nc.addObserver(forName: NSWorkspace.willSleepNotification, object: nil, queue: nil) { _ in
+        appHangStateQueue.sync {
+            lastMainThreadCheckin = Date().timeIntervalSince1970
+            sleeping = true
+            appHangTriggered = false
+        }
+    }
+    nc.addObserver(forName: NSWorkspace.didWakeNotification, object: nil, queue: nil) { _ in
+        let now = Date().timeIntervalSince1970
+        appHangStateQueue.sync {
+            lastMainThreadCheckin = now
+            sleeping = false
+            appHangTriggered = false
+        }
+    }
+}
+
+private func sampleMainThread() -> String? {
+    let result = shell("/usr/bin/sample", args: ["\(getpid())", "0.001"], timeout: 5.seconds)
+    guard let output = result.o, result.success else { return nil }
+
+    var mainThreadLines: [String] = []
+    var inMainThread = false
+
+    for line in output.components(separatedBy: "\n") {
+        if line.contains("com.apple.main-thread") {
+            inMainThread = true
+            mainThreadLines.append(line)
+            continue
+        }
+
+        guard inMainThread else { continue }
+
+        let trimmed = line.trimmingCharacters(in: .whitespaces)
+        if trimmed.isEmpty || line.contains("Thread_") || trimmed.hasPrefix("Total number") || trimmed.hasPrefix("Sort by") {
+            break
+        }
+        mainThreadLines.append(line)
+    }
+
+    return mainThreadLines.isEmpty ? nil : mainThreadLines.joined(separator: "\n")
 }
 
 func onAppHangDetected() {
     log.warning("App Hanging!")
-    log.traceCalls()
+
+    let mainThreadStack = sampleMainThread()
+    if let mainThreadStack {
+        log.warning("Main thread sample:\n\(mainThreadStack)")
+    } else {
+        log.warning("Failed to sample main thread")
+    }
 
     if Defaults[.autoRestartOnHang] {
         let now = Date().timeIntervalSince1970
-        appHangStateQueue.async {
-            if let hang = RepeatingHangState.hangs.values.first(where: { $0.isCulprit() }) {
-                RepeatingHangState.record(cause: hang.cause, at: now)
+        if let mainThreadStack {
+            appHangStateQueue.async {
+                if let hang = RepeatingHangState.hangs.values.first(where: { $0.isCulprit(mainThreadStack: mainThreadStack) }) {
+                    RepeatingHangState.record(cause: hang.cause, at: now)
+                }
             }
         }
         log.warning("Auto-restarting app due to hang detection.")
```

**File**: `Lunar/SwiftUIViews/DisplayRowView.swift` (modified, +5/-3)
```diff
@@ -629,10 +629,12 @@ struct DisplayRowView: View {
         Text("Brightness locked by preset").font(.system(size: 10, weight: .semibold, design: .rounded))
         if let name = display.referencePreset?.presetName {
             Menu(name) {
-                SwiftUI.Button("Unlock \"\(name)\"") {
-                    display.panel?.unlockActivePreset()
+                if !MAC26POINT3 {
+                    SwiftUI.Button("Unlock \"\(name)\"") {
+                        display.panel?.unlockActivePreset()
+                    }
+                    Divider()
                 }
-                Divider()
 
                 let presets = display.panelPresets.filter(\.isValid)
                 let groups = Set(presets.map(\.presetGroup)).sorted()
```

**File**: `LunarShortcuts/LunarShortcuts.swift` (modified, +6/-6)
```diff
@@ -2704,22 +2704,22 @@ struct SetPanelPresetIntent: AppIntent {
         })
     }
 
-    @Parameter(title: "Unlock brightness control")
+    @Parameter(title: "Unlock brightness control (unavailable on macOS 26.3 and later)")
     var unlockBrightnessControl: Bool
 
-    @Parameter(title: "Unlock Adaptive Brightness")
+    @Parameter(title: "Unlock Adaptive Brightness (unavailable on macOS 26.3 and later)")
     var unlockAdaptiveBrightness: Bool
 
-    @Parameter(title: "Unlock Night Shift")
+    @Parameter(title: "Unlock Night Shift (unavailable on macOS 26.3 and later)")
     var unlockNightShift: Bool
 
-    @Parameter(title: "Unlock True Tone")
+    @Parameter(title: "Unlock True Tone (unavailable on macOS 26.3 and later)")
     var unlockTrueTone: Bool
 
-    @Parameter(title: "Min brightness (in nits)", default: 4, inclusiveRange: (1, 500))
+    @Parameter(title: "Min brightness (in nits) (unavailable on macOS 26.3 and later)", default: 4, inclusiveRange: (1, 500))
     var minBrightness: Int
 
-    @Parameter(title: "Max brightness (in nits)", default: 500, inclusiveRange: (50, 500))
+    @Parameter(title: "Max brightness (in nits) (unavailable on macOS 26.3 and later)", default: 500, inclusiveRange: (50, 500))
     var maxBrightness: Int
 
     @Parameter(title: "Screen Preset")
```

**File**: `ReleaseNotes/6.9.7.md` (added, +4/-0)
```diff
@@ -0,0 +1,4 @@
+## Fixes
+
+- Remove **Unlock preset** functionality on macOS 26.3 and later since it no longer works
+- Fix hang detection not getting the right callstack
```

---

### Incident Patch 11: `016d9bf9` (2026-01-26)
**Commit Message**: Allow passing inputs to the CLI as seen in the UI

**File**: `Lunar/DDC/DDC.swift` (modified, +15/-15)
```diff
@@ -101,7 +101,7 @@ enum VideoInputSource: UInt16, Sendable, CaseIterable, Nameable, CustomStringCon
     case separator = 0x7FDF
 
     init?(stringValue: String) {
-        switch #"[^\w\s]+"#.r!.replaceAll(in: stringValue.lowercased().stripped, with: "") {
+        switch #"[^\w]+"#.r!.replaceAll(in: stringValue.lowercased().stripped, with: "") {
         case "vga", "vga1": self = .vga1
         case "vga2": self = .vga2
         case "dvi", "dvi1": self = .dvi1
@@ -122,21 +122,21 @@ enum VideoInputSource: UInt16, Sendable, CaseIterable, Nameable, CustomStringCon
         case "hdmi2": self = .hdmi2
         case "hdmi3": self = .hdmi3
         case "hdmi4": self = .hdmi4
-        case "thunderbolt", "thunderbolt2", "usbc", "usbc2": self = .thunderbolt2
-        case "thunderbolt1", "usbc1": self = .thunderbolt1
+        case "thunderbolt", "usbc", "thunderbolt1", "usbc1": self = .thunderbolt1
+        case "thunderbolt2", "usbc2": self = .thunderbolt2
         case "thunderbolt3", "usbc3": self = .thunderbolt3
-        case "lgdp", "lgminidp", "lgminidisplayport", "lgdisplayport", "lgdp1", "lgdisplayport1": self = .lgSpecificDisplayPort1
-        case "lgdp2", "lgminidp2", "lgminidisplayport2", "lgdisplayport2": self = .lgSpecificDisplayPort2
-        case "lgdp3", "lgminidp3", "lgminidisplayport3", "lgdisplayport3": self = .lgSpecificDisplayPort3
-        case "lgdp4", "lgminidp4", "lgminidisplayport4", "lgdisplayport4": self = .lgSpecificDisplayPort4
-        case "lghdmi", "lghdmi1": self = .lgSpecificHdmi1
-        case "lghdmi2": self = .lgSpecificHdmi2
-        case "lghdmi3": self = .lgSpecificHdmi3
-        case "lghdmi4": self = .lgSpecificHdmi4
-        case "lgthunderbolt2", "lgusbc2": self = .lgSpecificThunderbolt2
-        case "lgthunderbolt1", "lgusbc1", "lgusbc", "lgthunderbolt": self = .lgSpecificThunderbolt1
-        case "lgthunderbolt3", "lgusbc3": self = .lgSpecificThunderbolt3
-        case "lgthunderbolt4", "lgusbc4": self = .lgSpecificThunderbolt4
+        case "lgdp", "lgminidp", "lgminidisplayport", "lgdisplayport", "lgdp1", "lgdisplayport1", "displayport1lgspecific": self = .lgSpecificDisplayPort1
+        case "lgdp2", "lgminidp2", "lgminidisplayport2", "lgdisplayport2", "displayport2lgspecific": self = .lgSpecificDisplayPort2
+        case "lgdp3", "lgminidp3", "lgminidisplayport3", "lgdisplayport3", "displayport3lgspecific": self = .lgSpecificDisplayPort3
+        case "lgdp4", "lgminidp4", "lgminidisplayport4", "lgdisplayport4", "displayport4lgspecific": self = .lgSpecificDisplayPort4
+        case "lghdmi", "lghdmi1", "hdmi1lgspecific": self = .lgSpecificHdmi1
+        case "lghdmi2", "hdmi2lgspecific": self = .lgSpecificHdmi2
+        case "lghdmi3", "hdmi3lgspecific": self = .lgSpecificHdmi3
+        case "lghdmi4", "hdmi4lgspecific": self = .lgSpecificHdmi4
+        case "lgthunderbolt1", "lgusbc1", "lgusbc", "lgthunderbolt", "usbc1lgspecific": self = .lgSpecificThunderbolt1
+        case "lgthunderbolt2", "lgusbc2", "usbc2lgspecific": self = .lgSpecificThunderbolt2
+        case "lgthunderbolt3", "lgusbc3", "usbc3lgspecific": self = .lgSpecificThunderbolt3
+        case "lgthunderbolt4", "lgusbc4", "usbc4lgspecific": self = .lgSpecificThunderbolt4
         case "unknown": self = .unknown
         default:
             return nil
```

**File**: `ReleaseNotes/6.9.6.md` (added, +4/-0)
```diff
@@ -0,0 +1,4 @@
+## Improvements
+
+- Allow passing inputs to the CLI as seen in the UI
+    - Example: `lunar set input "HDMI 1 (LG specific)"`
```

---

### Incident Patch 12: `11d3d9e3` (2025-11-07)
**Commit Message**: License code UI fixe

**File**: `.gitsecret/paths/mapping.cfg` (modified, +1/-1)
```diff
@@ -3,7 +3,7 @@ Lunar/Resources/eddsa_priv:d079018c2b1c003c9e239ea8f8cc999b7d98adfd0616911ba0263
 Lunar/Modes/SensorMode.swift:dad132128e91631cacf5b7b90f70acf3ff64ed9c9ca304355ef73995672fafb1
 Lunar/Modes/SyncMode.swift:99587e6a44dfd3620f154a34ac83e0a9c0fedc82b778c6cad71bbeacb437864e
 Lunar/Modes/LocationMode.swift:bef485a1eb39359f19a37599c2fa55fc3a2f448295570f20c7b4e65984a63ec1
-Lunar/Data/Pro.swift:9e84393e9c32dd1baef6911d6440cabe45d066583c4b4d48780fe699fa440a40
+Lunar/Data/Pro.swift:edf17b2556de936c1facf35eb553960c36037acdb431427ef856508e03270d99
 Lunar/Modes/ClockMode.swift:d012d1b6cd91d0527ca6d6d00fd5b7742c3671855fba5d43ab31b6413d8afc84
 Lunar/DDC/DDC2.h:2413c548ce3cc1681316b52486b66769529ae244ec5c76a160cdc190e7236f61
 Lunar/DDC/DDC2.c:8488fdfb13ca9525e44db616c773eb67f1f1d52dcf83115d7666b0d79bbeef5a
```

**File**: `Lunar/AppDelegate.swift` (modified, +18/-0)
```diff
@@ -2503,6 +2503,24 @@ final class AppDelegate: NSObject, NSApplicationDelegate, CLLocationManagerDeleg
         if !thisIsFirstRun {
             DC.askAboutXDR(migration: true)
         }
+        NotificationCenter.default.addObserver(self, selector: #selector(windowDidBecomeMainNotification), name: NSWindow.didBecomeMainNotification, object: nil)
+    }
+
+    @objc func windowDidBecomeMainNotification(_ notification: Notification) {
+        guard let window = notification.object as? NSWindow else { return }
+
+        if let paddleController = window.windowController as? PADActivateWindowController,
+           let email = paddleController.emailTxt, let licenseCode = paddleController.licenseTxt
+        {
+            email.isBordered = true
+            licenseCode.isBordered = true
+
+            email.drawsBackground = true
+            licenseCode.drawsBackground = true
+
+            email.backgroundColor = .black.withAlphaComponent(0.05)
+            licenseCode.backgroundColor = .black.withAlphaComponent(0.05)
+        }
     }
 
     @IBAction func toggleCleaningMode(_: Any) {
```

**File**: `ReleaseNotes/6.9.5.md` (modified, +4/-0)
```diff
@@ -1,3 +1,7 @@
+## Fixes
+
+- Work around macOS issue where the license code text field is not visible until clicked
+
 ## Improvements
 
 - Allow pausing/unpausing adaptive brightness via a new `adaptivePaused` property using the CLI or Shortcuts
```

---

### Incident Patch 13: `a57331e6` (2025-10-27)
**Commit Message**: Fix reactivation

**File**: `.gitsecret/paths/mapping.cfg` (modified, +1/-1)
```diff
@@ -3,7 +3,7 @@ Lunar/Resources/eddsa_priv:d079018c2b1c003c9e239ea8f8cc999b7d98adfd0616911ba0263
 Lunar/Modes/SensorMode.swift:dad132128e91631cacf5b7b90f70acf3ff64ed9c9ca304355ef73995672fafb1
 Lunar/Modes/SyncMode.swift:99587e6a44dfd3620f154a34ac83e0a9c0fedc82b778c6cad71bbeacb437864e
 Lunar/Modes/LocationMode.swift:bef485a1eb39359f19a37599c2fa55fc3a2f448295570f20c7b4e65984a63ec1
-Lunar/Data/Pro.swift:4c12de27a1a2c27813801c37b6f7e6c9addb655a2477edc400b5c4f5ced01657
+Lunar/Data/Pro.swift:269dd396b1cb9bacb6404c0de7d0dd3d85d9f81db041a993582ea531e6705fb5
 Lunar/Modes/ClockMode.swift:d012d1b6cd91d0527ca6d6d00fd5b7742c3671855fba5d43ab31b6413d8afc84
 Lunar/DDC/DDC2.h:2413c548ce3cc1681316b52486b66769529ae244ec5c76a160cdc190e7236f61
 Lunar/DDC/DDC2.c:8488fdfb13ca9525e44db616c773eb67f1f1d52dcf83115d7666b0d79bbeef5a
```

**File**: `Lunar.xcodeproj/project.pbxproj` (modified, +4/-4)
```diff
@@ -1339,7 +1339,7 @@
 				CODE_SIGN_INJECT_BASE_ENTITLEMENTS = NO;
 				CODE_SIGN_STYLE = Manual;
 				COMBINE_HIDPI_IMAGES = YES;
-				CURRENT_PROJECT_VERSION = 6.9.2;
+				CURRENT_PROJECT_VERSION = 6.9.3;
 				DEBUG_INFORMATION_FORMAT = "dwarf-with-dsym";
 				DEVELOPMENT_ASSET_PATHS = "";
 				DEVELOPMENT_TEAM = "";
@@ -1371,7 +1371,7 @@
 				);
 				LLVM_LTO = NO;
 				MACOSX_DEPLOYMENT_TARGET = 11.0;
-				MARKETING_VERSION = 6.9.2;
+				MARKETING_VERSION = 6.9.3;
 				MTL_ENABLE_DEBUG_INFO = NO;
 				OTHER_CODE_SIGN_FLAGS = "";
 				PRODUCT_BUNDLE_IDENTIFIER = fyi.lunar.Lunar;
@@ -1405,7 +1405,7 @@
 				CODE_SIGN_INJECT_BASE_ENTITLEMENTS = NO;
 				CODE_SIGN_STYLE = Manual;
 				COMBINE_HIDPI_IMAGES = YES;
-				CURRENT_PROJECT_VERSION = 6.9.2;
+				CURRENT_PROJECT_VERSION = 6.9.3;
 				DEVELOPMENT_ASSET_PATHS = "";
 				DEVELOPMENT_TEAM = "";
 				"DEVELOPMENT_TEAM[sdk=macosx*]" = RDDXV84A73;
@@ -1436,7 +1436,7 @@
 				);
 				LLVM_LTO = YES;
 				MACOSX_DEPLOYMENT_TARGET = 11.0;
-				MARKETING_VERSION = 6.9.2;
+				MARKETING_VERSION = 6.9.3;
 				MTL_ENABLE_DEBUG_INFO = NO;
 				OTHER_CODE_SIGN_FLAGS = "--timestamp";
 				PRODUCT_BUNDLE_IDENTIFIER = fyi.lunar.Lunar;
```

**File**: `ReleaseNotes/6.9.3.md` (added, +3/-0)
```diff
@@ -0,0 +1,3 @@
+## Fixes
+
+- Fix activation when license code seats have been used up
```

**File**: `Releases/appcast-stable.xml` (modified, +19/-19)
```diff
@@ -2,6 +2,25 @@
 <rss xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle" version="2.0">
     <channel>
         <title>Lunar</title>
+        <item>
+            <title>6.9.3</title>
+            <pubDate>Mon, 27 Oct 2025 13:50:27 +0200</pubDate>
+            <link>https://lunar.fyi/</link>
+            <sparkle:fullReleaseNotesLink>https://lunar.fyi/changelog</sparkle:fullReleaseNotesLink>
+            <sparkle:minimumAutoupdateVersion>5.0.0</sparkle:minimumAutoupdateVersion>
+            <sparkle:version>6.9.3</sparkle:version>
+            <sparkle:shortVersionString>6.9.3</sparkle:shortVersionString>
+            <sparkle:minimumSystemVersion>11.0</sparkle:minimumSystemVersion>
+            <sparkle:releaseNotesLink>https://files.lunar.fyi/ReleaseNotes/Lunar-6.9.3.html</sparkle:releaseNotesLink>
+            <enclosure url="https://files.lunar.fyi/releases/Lunar-6.9.3.dmg" length="20783648" type="application/octet-stream" sparkle:edSignature="wIwbP3ALnLCsZN4hfY4seOzzDCBFP3Q2MIDDZ6+9wHcalRuewR3+fUvP1zvpaS7g6wrm+zOunluKy9xpup+XCg=="/>
+            <sparkle:deltas>
+                <enclosure url="https://files.lunar.fyi/deltas/Lunar6.9.3-6.9.2.delta" sparkle:deltaFrom="6.9.2" length="1769702" type="application/octet-stream" sparkle:deltaFromSparkleExecutableSize="1837232" sparkle:deltaFromSparkleLocales="en,Base" sparkle:edSignature="syTZRVahZt4lzk5q+wPeBQSTM4NH2f0dn5cIhu/vY9xvHM+tuav6JuInBgv12ve9oltXzwPHtyUz1E0jc4FOBw=="/>
+                <enclosure url="https://files.lunar.fyi/deltas/Lunar6.9.3-6.9.1.delta" sparkle:deltaFrom="6.9.1" length="1998514" type="application/octet-stream" sparkle:deltaFromSparkleExecutableSize="1837232" sparkle:deltaFromSparkleLocales="en,Base" sparkle:edSignature="6AEllt7HedUucyc9qRbu4H5B5Vx6IdML6QNd5OyDNVLhXfw0hjTbovS4pjyQGuSsM07OP9NKlaL/bH4XoKdYAQ=="/>
+                <enclosure url="https://files.lunar.fyi/deltas/Lunar6.9.3-6.9.0.delta" sparkle:deltaFrom="6.9.0" length="2057046" type="application/octet-stream" sparkle:deltaFromSparkleExecutableSize="1837232" sparkle:deltaFromSparkleLocales="en,Base" sparkle:edSignature="q4ySeaYMX5/LMLwTW7TrViRLPWSlpzpAbn8ZijuPTD0CzrNpbv+fjggBklqKIYdiLUbeZmO5A6zMQ8dGDK4MAA=="/>
+                <enclosure url="https://files.lunar.fyi/deltas/Lunar6.9.3-6.8.9.delta" sparkle:deltaFrom="6.8.9" length="6818518" type="application/octet-stream" sparkle:deltaFromSparkleExecutableSize="1842416" sparkle:deltaFromSparkleLocales="en,Base" sparkle:edSignature="2Wkgx4BLrba2hFHVYMAfhWkwvgyMJ6b3I/QTn2ZKwCklQHuN8iTar5DU03cGzR8D3VAjKg9eSdxtL57a4V7MBw=="/>
+                <enclosure url="https://files.lunar.fyi/deltas/Lunar6.9.3-6.8.8.delta" sparkle:deltaFrom="6.8.8" length="6837826" type="application/octet-stream" sparkle:deltaFromSparkleExecutableSize="1842416" sparkle:deltaFromSparkleLocales="en,Base" sparkle:edSignature="cSdAvO6ODvAQQs5GOOKFd09+QhD03f2ujY5iKZuDb8UfsBYmz9J916hVtcW6/XiVwJ4abYyK0EyzCDXJTnoRBw=="/>
+            </sparkle:deltas>
+        </item>
         <item>
             <title>6.9.2</title>
             <pubDate>Wed, 08 Oct 2025 21:41:29 +0300</pubDate>
@@ -173,25 +192,6 @@
                 <enclosure url="https://files.lunar.fyi/deltas/Lunar6.8.4-6.7.12.delta" sparkle:deltaFrom="6.7.12" length="9838614" type="application/octet-stream" sparkle:deltaFromSparkleExecutableSize="1842416" sparkle:deltaFromSparkleLocales="en,Base" sparkle:edSignature="xQPTdpW1icq1Zo112VmyrgEYc1cjUZFUJkEfD6XazlR22L3vUucMr9MOv5rvX4I9HvVVjzdNTy0YZbFwvdfyBw=="/>
             </sparkle:deltas>
         </item>
-        <item>
-            <title>6.8.3</title>
-            <pubDate>Mon, 21 Oct 2024 23:54:37 +0300</pubDate>
-            <link>https://lunar.fyi/</link>
-            <sparkle:fullReleaseNotesLink>https://lunar.fyi/changelog</sparkle:fullReleaseNotesLink>
-            <sparkle:minimumAutoupdateVersion>5.0.0</sparkle:minimumAutoupdateVersion>
-            <sparkle:version>6.8.3</sparkle:version>
-            <sparkle:shortVersionString>6.8.3</sparkle:shortVersionString>
-            <sparkle:minimumSystemVersion>11.0</sparkle:minimumSystemVersion>
-            <sparkle:releaseNotesLink>https://files.lunar.fyi/ReleaseNotes/Lunar-6.8.3.html</sparkle:releaseNotesLink>
-            <enclosure url="https://files.lunar.fyi/releases/Lunar-6.8.3.dmg" length="20998104" type="application/octet-stream" sparkle:edSignature="O0S7d9cUNvaPUeD54m3AunzkRKcjpSTYSpUTMi0ziR8HHZYOcTgB9NlX4q0Y6qcbvQ+tFEhscXVUkwynK0RIAA=="/>
-            <sparkle:deltas>
-                <enclosure url="https://files.lunar.fyi/deltas/Lunar6.8.3-6.8.2.delta" sparkle:deltaFrom="6.8.2" length="6843110" type="application/octet-stream" sparkle:deltaFromSparkleExecutableSize="1842416" sparkle:deltaFromSparkleLocales="en,Base" sparkle:edSignature="IioRXn1J7D45beSUYVCuzFYAwCVMbM1KMsRMblsjuCaDalrk82GLBcUSKC2i/EjRmFbPVoBzvaNjj+tnNQTADQ=="/>
-                <enclosure url="https://files.lunar.fyi/deltas/Lunar6.8.3-6.8.0.delta" sparkle:deltaFrom="6.8.0" length="6862406" type="applicatio
```

**File**: `Releases/appcast2.xml` (modified, +20/-20)
```diff
@@ -2,6 +2,25 @@
 <rss xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle" version="2.0">
     <channel>
         <title>Lunar</title>
+        <item>
+            <title>6.9.3</title>
+            <pubDate>Mon, 27 Oct 2025 13:50:27 +0200</pubDate>
+            <link>https://lunar.fyi/</link>
+            <sparkle:fullReleaseNotesLink>https://lunar.fyi/changelog</sparkle:fullReleaseNotesLink>
+            <sparkle:minimumAutoupdateVersion>5.0.0</sparkle:minimumAutoupdateVersion>
+            <sparkle:version>6.9.3</sparkle:version>
+            <sparkle:shortVersionString>6.9.3</sparkle:shortVersionString>
+            <sparkle:minimumSystemVersion>11.0</sparkle:minimumSystemVersion>
+            <sparkle:releaseNotesLink>https://files.lunar.fyi/ReleaseNotes/Lunar-6.9.3.html</sparkle:releaseNotesLink>
+            <enclosure url="https://files.lunar.fyi/releases/Lunar-6.9.3.dmg" length="20783648" type="application/octet-stream" sparkle:edSignature="wIwbP3ALnLCsZN4hfY4seOzzDCBFP3Q2MIDDZ6+9wHcalRuewR3+fUvP1zvpaS7g6wrm+zOunluKy9xpup+XCg=="/>
+            <sparkle:deltas>
+                <enclosure url="https://files.lunar.fyi/deltas/Lunar6.9.3-6.9.2.delta" sparkle:deltaFrom="6.9.2" length="1769702" type="application/octet-stream" sparkle:deltaFromSparkleExecutableSize="1837232" sparkle:deltaFromSparkleLocales="en,Base" sparkle:edSignature="syTZRVahZt4lzk5q+wPeBQSTM4NH2f0dn5cIhu/vY9xvHM+tuav6JuInBgv12ve9oltXzwPHtyUz1E0jc4FOBw=="/>
+                <enclosure url="https://files.lunar.fyi/deltas/Lunar6.9.3-6.9.1.delta" sparkle:deltaFrom="6.9.1" length="1998514" type="application/octet-stream" sparkle:deltaFromSparkleExecutableSize="1837232" sparkle:deltaFromSparkleLocales="en,Base" sparkle:edSignature="6AEllt7HedUucyc9qRbu4H5B5Vx6IdML6QNd5OyDNVLhXfw0hjTbovS4pjyQGuSsM07OP9NKlaL/bH4XoKdYAQ=="/>
+                <enclosure url="https://files.lunar.fyi/deltas/Lunar6.9.3-6.9.0.delta" sparkle:deltaFrom="6.9.0" length="2057046" type="application/octet-stream" sparkle:deltaFromSparkleExecutableSize="1837232" sparkle:deltaFromSparkleLocales="en,Base" sparkle:edSignature="q4ySeaYMX5/LMLwTW7TrViRLPWSlpzpAbn8ZijuPTD0CzrNpbv+fjggBklqKIYdiLUbeZmO5A6zMQ8dGDK4MAA=="/>
+                <enclosure url="https://files.lunar.fyi/deltas/Lunar6.9.3-6.8.9.delta" sparkle:deltaFrom="6.8.9" length="6818518" type="application/octet-stream" sparkle:deltaFromSparkleExecutableSize="1842416" sparkle:deltaFromSparkleLocales="en,Base" sparkle:edSignature="2Wkgx4BLrba2hFHVYMAfhWkwvgyMJ6b3I/QTn2ZKwCklQHuN8iTar5DU03cGzR8D3VAjKg9eSdxtL57a4V7MBw=="/>
+                <enclosure url="https://files.lunar.fyi/deltas/Lunar6.9.3-6.8.8.delta" sparkle:deltaFrom="6.8.8" length="6837826" type="application/octet-stream" sparkle:deltaFromSparkleExecutableSize="1842416" sparkle:deltaFromSparkleLocales="en,Base" sparkle:edSignature="cSdAvO6ODvAQQs5GOOKFd09+QhD03f2ujY5iKZuDb8UfsBYmz9J916hVtcW6/XiVwJ4abYyK0EyzCDXJTnoRBw=="/>
+            </sparkle:deltas>
+        </item>
         <item>
             <title>6.9.2</title>
             <pubDate>Wed, 08 Oct 2025 21:41:29 +0300</pubDate>
@@ -193,25 +212,6 @@
                 <enclosure url="https://files.lunar.fyi/deltas/Lunar6.8.4-6.7.12.delta" sparkle:deltaFrom="6.7.12" length="9838614" type="application/octet-stream" sparkle:deltaFromSparkleExecutableSize="1842416" sparkle:deltaFromSparkleLocales="en,Base" sparkle:edSignature="xQPTdpW1icq1Zo112VmyrgEYc1cjUZFUJkEfD6XazlR22L3vUucMr9MOv5rvX4I9HvVVjzdNTy0YZbFwvdfyBw=="/>
             </sparkle:deltas>
         </item>
-        <item>
-            <title>6.8.3</title>
-            <pubDate>Mon, 21 Oct 2024 23:54:37 +0300</pubDate>
-            <link>https://lunar.fyi/</link>
-            <sparkle:fullReleaseNotesLink>https://lunar.fyi/changelog</sparkle:fullReleaseNotesLink>
-            <sparkle:minimumAutoupdateVersion>5.0.0</sparkle:minimumAutoupdateVersion>
-            <sparkle:version>6.8.3</sparkle:version>
-            <sparkle:shortVersionString>6.8.3</sparkle:shortVersionString>
-            <sparkle:minimumSystemVersion>11.0</sparkle:minimumSystemVersion>
-            <sparkle:releaseNotesLink>https://files.lunar.fyi/ReleaseNotes/Lunar-6.8.3.html</sparkle:releaseNotesLink>
-            <enclosure url="https://files.lunar.fyi/releases/Lunar-6.8.3.dmg" length="20998104" type="application/octet-stream" sparkle:edSignature="O0S7d9cUNvaPUeD54m3AunzkRKcjpSTYSpUTMi0ziR8HHZYOcTgB9NlX4q0Y6qcbvQ+tFEhscXVUkwynK0RIAA=="/>
-            <sparkle:deltas>
-                <enclosure url="https://files.lunar.fyi/deltas/Lunar6.8.3-6.8.2.delta" sparkle:deltaFrom="6.8.2" length="6843110" type="application/octet-stream" sparkle:deltaFromSparkleExecutableSize="1842416" sparkle:deltaFromSparkleLocales="en,Base" sparkle:edSignature="IioRXn1J7D45beSUYVCuzFYAwCVMbM1KMsRMblsjuCaDalrk82GLBcUSKC2i/EjRmFbPVoBzvaNjj+tnNQTADQ=="/>
-                <enclosure url="https://files.lunar.fyi/deltas/Lunar6.8.3-6.8.0.delta" sparkle:deltaFrom="6.8.0" length="6862406" type="applicatio
```

---

### Incident Patch 14: `cb74d36d` (2025-09-25)
**Commit Message**: Fix wrong brightness value in OSD on fine adjustments

**File**: `Lunar.xcworkspace/xcuserdata/alin.xcuserdatad/xcdebugger/Breakpoints_v2.xcbkptlist` (modified, +19/-0)
```diff
@@ -3,4 +3,23 @@
    uuid = "A71689F0-05ED-400C-9A39-47EC0A36555F"
    type = "0"
    version = "2.0">
+   <Breakpoints>
+      <BreakpointProxy
+         BreakpointExtensionID = "Xcode.Breakpoint.FileBreakpoint">
+         <BreakpointContent
+            uuid = "082131BE-8675-4E5F-9C54-A2BACFAFB3FD"
+            shouldBeEnabled = "Yes"
+            condition = "oldValue.uint16Value &lt; brightness.uint16Value"
+            ignoreCount = "0"
+            continueAfterRunningActions = "No"
+            filePath = "Lunar/Data/Display.swift"
+            startingColumnNumber = "9223372036854775807"
+            endingColumnNumber = "9223372036854775807"
+            startingLineNumber = "2105"
+            endingLineNumber = "2105"
+            landmarkName = "brightness"
+            landmarkType = "24">
+         </BreakpointContent>
+      </BreakpointProxy>
+   </Breakpoints>
 </Bucket>
```

**File**: `Lunar/Views/OSDWindow.swift` (modified, +4/-1)
```diff
@@ -859,17 +859,20 @@ struct Mac26BrightnessOSDView: View {
             .opacity(osd.tip == nil ? 0 : 1)
     }
 
-    @State var variant = 0
+    @State var sliding = false
 
     var slider: some View {
         SwiftUI.Slider(value: $osd.value) {} ticks: {
             SliderTickContentForEach(STEPS, id: \.self) { value in
                 SliderTick(value)
             }
+        } onEditingChanged: { editing in
+            sliding = editing
         }
         .tint(.white)
         .brightness(2.0)
         .onChange(of: osd.value) { newValue in
+            guard sliding else { return }
             osd.onChange?(newValue)
         }
         .disabled(osd.locked)
```

**File**: `ReleaseNotes/6.9.1.md` (modified, +1/-0)
```diff
@@ -1,3 +1,4 @@
 ## Fixes
 
 - Make OSD text more visible on white backgrounds
+- Fix wrong brightness value in OSD on fine adjustments
```

---

### Incident Patch 15: `8cc46c60` (2025-09-19)
**Commit Message**: Fix OSD not disappearing

**File**: `Lunar/AppDelegate.swift` (modified, +0/-7)
```diff
@@ -35,8 +35,6 @@ import SwiftUI
 import AppIntents
 import ServiceManagement
 
-var clickedInApp = false
-
 extension CLLocationManager {
     var auth: CLAuthorizationStatus? {
         guard !Geolocation.coreLocationTimedOut else { return nil }
@@ -2046,11 +2044,6 @@ final class AppDelegate: NSObject, NSApplicationDelegate, CLLocationManagerDeleg
 
             return event
         }
-
-        NSEvent.addLocalMonitorForEvents(matching: [.leftMouseDown, .leftMouseUp]) { event in
-            clickedInApp = event.type == .leftMouseDown
-            return event
-        }
     }
 
     func handleAutoOSDEvent(_ event: NSEvent) {
```

**File**: `Lunar/Utils/DisplayController.swift` (modified, +15/-0)
```diff
@@ -3018,6 +3018,21 @@ final class DisplayController: ObservableObject {
                     if display.systemAdaptiveBrightness, value == maxBrightness, value == oldValue {
                         if doublePressedBrightnessUpKey.value, !ignoreHoldingKey {
                             display.osdState.tip = nil
+                            let startNits = nits
+                            let endNits = DC.builtinDisplay?.maxHardwareNits ?? 1600
+                            let duration: TimeInterval = 1.0
+                            let steps = 50
+                            let interval = duration / steps.d
+                            for i in 1 ... steps {
+                                let progress = i.d / steps.d
+                                let currentNits = Int(startNits + (Double(endNits - startNits) * progress))
+                                mainAsyncAfter(ms: (i.d * interval * 1000).intround) {
+                                    display.osdState.text = "\(currentNits) nits"
+                                }
+                            }
+                            mainAsyncAfter(ms: ((duration + 0.05) * 1000).intround) {
+                                display.osdState.text = "\(endNits.intround) nits"
+                            }
                             display.systemAdaptiveBrightness = false
                         } else {
                             display.osdState.tip = Text("\(Image(systemName: "sun.max.fill")) Double press Brightness Up to unlock \(maxNits.str(decimals: 0)) nits")
```

**File**: `Lunar/Views/OSDWindow.swift` (modified, +53/-6)
```diff
@@ -40,6 +40,11 @@ final class OSDWindow: NSWindow, NSWindowDelegate {
 
     var shouldIgnoreMouseEvents = false
 
+    // Indicates whether the mouse cursor is currently inside this window's frame.
+    // Used to delay fading/closing while the user is interacting or simply hovering.
+    // Implemented using an NSTrackingArea attached to the content view.
+    @objc dynamic var hovering = false
+
     weak var display: Display?
     lazy var wc = NSWindowController(window: self)
 
@@ -49,10 +54,21 @@ final class OSDWindow: NSWindow, NSWindowDelegate {
     var fader: DispatchWorkItem? { didSet { oldValue?.cancel() } }
     var endFader: DispatchWorkItem? { didSet { oldValue?.cancel() } }
 
+    override func mouseEntered(with event: NSEvent) {
+        hovering = true
+        super.mouseEntered(with: event)
+    }
+
+    override func mouseExited(with event: NSEvent) {
+        hovering = false
+        super.mouseExited(with: event)
+    }
+
     func hide() {
         fader = nil
         endFader = nil
         closer = nil
+        removeHoverTrackingArea()
 
         if let v = contentView?.superview {
             v.alphaValue = 0.0
@@ -108,6 +124,7 @@ final class OSDWindow: NSWindow, NSWindowDelegate {
             makeKeyAndOrderFront(nil)
         }
         orderFrontRegardless()
+        addHoverTrackingArea()
 
         endFader = nil
         closer = nil
@@ -116,7 +133,7 @@ final class OSDWindow: NSWindow, NSWindowDelegate {
         guard closeMilliseconds > 0 else { return }
         actionOnFade = { [weak self] in
             guard let s = self, s.isVisible else { return }
-            guard !clickedInApp else {
+            guard !s.hovering else {
                 self?.fader = mainAsyncAfter(ms: fadeMilliseconds) { self?.actionOnFade?() }
                 return
             }
@@ -135,6 +152,38 @@ final class OSDWindow: NSWindow, NSWindowDelegate {
         }
     }
 
+    func windowWillClose(_ notification: Notification) {
+        removeHoverTrackingArea()
+    }
+
+    // Tracking area for mouse enter/exit.
+    private var hoverTrackingArea: NSTrackingArea?
+
+    // MARK: - Hover Tracking
+
+    // MARK: - Tracking Area based hover detection
+
+    private func addHoverTrackingArea() {
+        guard let view = contentView else { return }
+        removeHoverTrackingArea()
+        let opts: NSTrackingArea.Options = [
+            .mouseEnteredAndExited,
+            .activeAlways,
+            .inVisibleRect,
+        ]
+        let area = NSTrackingArea(rect: view.bounds, options: opts, owner: self, userInfo: nil)
+        view.addTrackingArea(area)
+        hoverTrackingArea = area
+    }
+
+    private func removeHoverTrackingArea() {
+        if let area = hoverTrackingArea, let view = contentView {
+            view.removeTrackingArea(area)
+        }
+        hoverTrackingArea = nil
+        hovering = false
+    }
+
 }
 
 extension AnyView {
@@ -779,7 +828,7 @@ struct Mac26BrightnessOSDView: View {
 
     var body: some View {
         VStack(spacing: OSD_TIP_SPACING) {
-            CustomGlassEffectView(variant: 6, scrimState: 0, subduedState: 0, cornerRadius: 24) {
+            CustomGlassEffectView(variant: 6, scrimState: 0, subduedState: 0, tint: osd.color?.opacity(0.2).ns ?? .clear, cornerRadius: 24) {
                 square.animation(.fastSpring, value: osd.tip)
                     .frame(width: MAC26_OSD_WIDTH, height: MAC26_OSD_HEIGHT)
             }
@@ -791,9 +840,7 @@ struct Mac26BrightnessOSDView: View {
         }
         .frame(alignment: .center)
         .onHover { hovering in
-            if !hovering {
-                clickedInApp = false
-            }
+            osd.hovering = hovering
         }
     }
 
@@ -834,7 +881,6 @@ struct Mac26BrightnessOSDView: View {
                 Text(osd.textLeft).font(.system(size: 12, weight: .medium))
                 Spacer()
                 Text(osd.text.isEmpty ? "\((osd.value * 100).intround)%" : osd.text).font(.system(size: 12, weight: .medium, design: .monospaced))
-                    .foregroundColor(osd.color ?? .secondary)
                 if osd.locked {
                     Image(systemName: "lock.fill")
                         .font(.system(size: 12, weight: .medium, design: .rounded))
@@ -1091,6 +1137,7 @@ final class OSDState: ObservableObject {
     @Published var glowRadius: CGFloat = 5
     @Published var tip: Text? = nil
     @Published var locked = false
+    @Published var hovering = false
     var onChange: ((Float) -> Void)? = nil
 }
 
```

#### Recent Merged Pull Requests:
- **PR #515** (2023-12-08): Add CLI install location to succcessful print statement (@dcchambers)
- **PR #514** (2023-07-01): fix: bump platformio/espressif to 5.3.0 to maintain darwin_arm64 compatibility (@pcnc)
- **PR #436** (2022-02-09): Fix spelling (@jordanekay)
- **PR #312** (2021-04-29): Add a Gitter chat badge to README.md (@gitter-badger)
- **PR #237** (2020-12-26): Fix installation instructions in README.md (@kawarimidoll)
- **PR #14** (closed): Animate brightness/contrast transitions (@timtraversy)
- **PR #3** (2018-08-07): updated readme (@duongel)
- **PR #2** (2018-08-06): Feature/manual controls (@duongel)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

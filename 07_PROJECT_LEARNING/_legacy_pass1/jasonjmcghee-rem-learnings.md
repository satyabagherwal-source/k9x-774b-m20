# Forensic Learning Record (Deep Inspection): jasonjmcghee/rem

> **Canonical Artifact**: `07_PROJECT_LEARNING/jasonjmcghee-rem-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/jasonjmcghee/rem](https://github.com/jasonjmcghee/rem))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-04T20:45:53.195Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `jasonjmcghee/rem`
- **Description**: An open source approach to locally record and enable searching everything you view on your Mac.
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 2488 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `ffmpegX/main.swift`
```
//
//  main.swift
//  ffmpegX
//
//  Created by Jason McGhee on 12/29/23.
//

import Foundation

print("Hello, World!")


```

### Core Architecture Module: `rem/Ask.swift`
```
//
//  Ask.swift
//  rem
//
//  Created by Jason McGhee on 12/27/23.
//

import SwiftUI

struct AskView: View {
    var onAsk: (String) -> Void

    var body: some View {
        ZStack {
            // Using a thin material for the background
            VisualEffectView(material: .hudWindow, blendingMode: .behindWindow)
                .ignoresSafeArea()

            // Components
            VStack {
                AskViewResults(onAsk: onAsk)
                    .padding(.top, 20)

                Spacer()
                // Future components will be added here
                Spacer()
            }
        }
    }
}

struct AskViewResults: View {
    @State var text: String = ""
    var onAsk: (String) -> Void
    var body: some View {
        VStack {
            AskBar(text: $text, onAsk: onAsk)
            
            ScrollView {
            }
        }
    }

}

struct AskBar: View {
    @Binding var text: String
    var onAsk: (String) -> Void
    @Namespace var nspace
    @FocusState var focused: Bool?

    var body: some View {
        HStack {
            TextField("Search", text: $text, prompt: Text("Search for something..."))
                .prefersDefaultFocus(in: nspace)
                .textFieldStyle(.plain)
                .focused($focused, equals: true)
                .font(.system(size: 20))
                .padding()
                .padding(.horizontal, 24)
                .background(.thickMaterial)
                .cornerRadius(8)
                .overlay(
                    HStack {
                        Image(systemName: "magnifyingglass")
                            .imageScale(.large)
                            .foregroundColor(.gray)
                            .frame(minWidth: 0, maxWidth: .infinity, alignment: .leading)
                            .padding(.leading, 12)
                    }
                )
                .onSubmit {
                    onAsk(text)
                }
                .onAppear {
                    self.focused = true
                }
                .padding(.horizontal, 10)
        }
    }
}

#Preview {
    AskView(onAsk: { _ in })
}

```

### Core Architecture Module: `rem/ClipboardManager.swift`
```
import AppKit

class ClipboardManager {
    static let shared = ClipboardManager()
    
    private var changeCount: Int
    private var pasteboard: NSPasteboard
    
    init() {
        self.pasteboard = NSPasteboard.general
        self.changeCount = pasteboard.changeCount
    }
    
    func getClipboardIfChanged() -> String? {
        // Check if the clipboard has changed since the last check
        if pasteboard.changeCount != changeCount {
            var newItems: [String] = []
            let currentChangeCount = pasteboard.changeCount
            
            // Iterate over the changes since the last recorded changeCount
            for _ in changeCount..<currentChangeCount {
                if let string = pasteboard.string(forType: .string) {
                    newItems.append(string)
                }
            }
            
            // Update the changeCount to the current changeCount
            changeCount = currentChangeCount
            
            // Return the concatenated string if there are new items
            return newItems.isEmpty ? nil : newItems.joined(separator: "\n")
        }
        
        // Return nil if there are no new changes
        return nil
    }
    
    func replaceClipboardContents(with string: String) {
        pasteboard.clearContents()
        
        let finalContents = string.isEmpty ? "No context. Is remembering disabled?" : """
        Below is the text that's been on my screen recently. ------------- \(string) ------------------ Above is the text that's been on my screen recently. Please answer whatever I ask using the provided information about what has been on the screen recently. Do not say anything else or give any other information. Only answer the query. --------------------------\n
        """

        pasteboard.setString(finalContents, forType: .string)
        // We don't want to pickup our own changes
        changeCount = pasteboard.changeCount
    }
}

```

### Core Architecture Module: `rem/ContentView.swift`
```
//
//  ContentView.swift
//  rem
//
//  Created by Jason McGhee on 12/16/23.
//

import SwiftUI

struct ContentView: View {
    var body: some View {
        Text("Remember everything.")
            .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

struct ContentView_Previews: PreviewProvider {
    static var previews: some View {
        ContentView()
    }
}

```

### Core Architecture Module: `rem/DB.swift`
```
//
//  SQLite.swift
//  rem
//
//  Created by Jason McGhee on 12/16/23.
//

// SQLite.swift
import AVFoundation
import Foundation
import SQLite
import Vision
import os

class DatabaseManager {
    static let shared = DatabaseManager()
    private var db: Connection
    static var FPS: CMTimeScale = 25
    
    private let logger = Logger(
        subsystem: Bundle.main.bundleIdentifier!,
        category: String(describing: DatabaseManager.self)
    )
    // Last 15 frames
    let recentFramesThreshold = 15
    
    private let videoChunks = Table("video_chunks")
    private let frames = Table("frames")
    private let uniqueAppNames = Table("unique_application_names")
    private let framesText = Table("frames_text")

    let allText = VirtualTable("allText")
    let chunksFramesView = View("chunks_frames_view")
    
    private let id = Expression<Int64>("id")
    private let offsetIndex = Expression<Int64>("offsetIndex")
    private let chunkId = Expression<Int64>("chunkId")
    private let chunksFramesIndex = Expression<Int64>("chunksFramesIndex")
    private let timestamp = Expression<Date>("timestamp")
    private let filePath = Expression<String>("filePath")
    private let activeApplicationName = Expression<String?>("activeApplicationName")
    private let x = Expression<Double>("x")
    private let y = Expression<Double>("y")
    private let w = Expression<Double>("w")
    private let h = Expression<Double>("h")
    
    let frameId = Expression<Int64>("frameId")
    let text = Expression<String>("text")
    
    private var currentChunkId: Int64 = 0 // Initialize with a default value
    private var lastFrameId: Int64 = 0
    private var currentFrameOffset: Int64 = 0
    private var lastChunksFramesIndex: Int64 = 0
    
    init() {
        if let savedir = RemFileManager.shared.getSaveDir() {
            db = try! Connection("\(savedir)/db.sqlite3")
        } else {
            db = try! Connection("db.sqlite3")
        }
        
        try! db.run("PRAGMA journal_mode = WAL")
        try! db.run("PRAGMA synchronous = NORMAL")
        
        createTables()
        currentChunkId = getCurrentChunkId()
        lastFrameId = getLastFrameId()
        lastChunksFramesIndex = getLastChunksFramesIndex()
    }
    
    func purge() {
        do {
            try db.run(videoChunks.drop(ifExists: true))
            try db.run(frames.drop(ifExists: true))
            try db.run(allText.drop(ifExists: true))
            try db.run(uniqueAppNames.drop(ifExists: true))
            try db.run(chunksFramesView.drop(ifExists: true))
            try db.run(framesText.drop(ifExists: true))
        } catch {
            print("Failed to delete tables")
        }
        
        createTables()
        createIndices()
        currentChunkId = getCurrentChunkId()
        lastFrameId = getLastFrameId()
    }
    
    private func createTables() {
        try! db.run(videoChunks.create(ifNotExists: true) { t in
            t.column(id, primaryKey: .autoincrement)
            t.column(filePath)
        })
        
        try! db.run(frames.create(ifNotExists: true) { t in
            t.column(id, primaryKey: .autoincrement)
            t.column(chunkId, references: videoChunks, id)
            t.column(offsetIndex)
            t.column(timestamp)
            t.column(activeApplicationName)
        })
        
        try! db.run(uniqueAppNames.create(ifNotExists: true) { t in
            t.column(id, primaryKey: .autoincrement)
            t.column(activeApplicationName, unique: true)
        })
        
        try! db.run(framesText.create(ifNotExists: true) { t in
            t.column(id, primaryKey: .autoincrement)
            t.column(frameId)
            t.column(text)
            t.column(x)
            t.column(y)
            t.column(w)
            t.column(h)
        })
        
        // Seed the `uniqueAppNames` table if empty
        do {
            if try db.scalar(uniqueAppNames.count) == 0 {
                let query = frames.select(distinct: activeApplicationName)
                var appNames: [String] = []
                for row in try db.prepare(query) {
                    if let appName = row[activeApplicationName] {
                        appNames.append(appName)
                    }
                }
                let insert = uniqueAppNames.insertMany(
                    appNames.map { name in [activeApplicationName <- name] }
                )
                try db.run(insert)
            }
        } catch {
            print("Error seeding database with app names: \(error)")
        }
        let config = FTS4Config()
            .column(frameId, [.unindexed])
            .column(text)
            .languageId("lid")
            .order(.desc)
        
        // Text search
        try! db.run(allText.create(.FTS4(config), ifNotExists: true))
        
        // Create chunksFramesView (ensures all frames have associated chunks)
        let viewSQL = """
        CREATE VIEW IF NOT EXISTS chunks_frames_view AS
        SELECT
            ROW_NUMBER() OVER (ORDER BY vc.id, f.id) as chunksFramesIndex,
            vc.id as chunkId,
            vc.filePath,
            f.id as frameId,
            f.timestamp,
            f.activeApplicationName,
            f.offsetIndex
        FROM
            video_chunks vc
        JOIN
            frames f ON vc.id = f.chunkId
        ORDER BY
            vc.id, f.id;
        """
        try! db.run(viewSQL)
    }
    
    private func createIndices() {
        do {
            // Compound index on frames for chunkId and id
            try db.run(frames.createIndex(chunkId, id, unique: false, ifNotExists: true))
            try db.run(frames.createIndex(timestamp, ifNotExists: true))
            
            // For speeding up chunksFramesView
            try db.run(videoChunks.createIndex(id, unique: true, ifNotExists: true))
            
            // Accessing framesText by frameId
            try db.run(framesText.createIndex(frameId, unique: false, ifNotExists: true))
            // Additional indices can be added here as needed
        } catch {
            print("Failed to create indices: \(error)")
        }
    }
    
    private func getCurrentChunkId() -> Int64 {
        do {
            if let lastFrame = try db.pluck(frames.order(id.desc)) {
                return lastFrame[chunkId] + 1
            }
        } catch {
            print("Error fetching last chunk ID: \(error)")
        }
        return 1
    }
    
    private func getLastFrameId() -> Int64 {
        do {
            if let lastFrame = try db.pluck(frames.order(id.desc)) {
                return lastFrame[id]
            }
        } catch {
            print("Error fetching last frame ID: \(error)")
        }
        return 0
    }
    
    private func getLastChunksFramesIndex() -> Int64 {
        do {
            if let lastFrame = try db.pluck(chunksFramesView.order(chunksFramesIndex.desc)) {
                return lastFrame[chunksFramesIndex]
            }
        } catch {
            print("Error fetching last chunks frames Index: \(error)")
        }
        return 0
    }
    
    // Insert a new video chunk and return its ID
    func startNewVideoChunk(filePath: String) -> Int64 {
        let insert = videoChunks.insert(self.id <- currentChunkId, self.filePath <- filePath)
        let id = try! db.run(insert)
        currentChunkId = id + 1
        currentFrameOffset = 0
        lastChunksFramesIndex = getLastChunksFramesIndex()
        return id
    }
    
    func insertFrame(activeApplicationName: String?) -> Int64 {
        let insert = frames.insert(chunkId <- currentChunkId, timestamp <- Date(), offsetIndex <- currentFrameOffset, self.activeApplicationName <- activeApplicationName)
        let id = try! db.run(insert)
        currentFrameOffset += 1
        lastFrameId = id
        
        if let appName = activeApplicationName {
            //will check if the app name is already in the database.
            insertUniqueApplicationNamesIfNeeded(appName)
        }
        
        return id
    }
    
    private func insertUniqueApplicationNamesIfNeeded(_ appName: String) {
        let query = uniqueAppNames.filter(activeApplicationName == appName)
        
        do {
            let count = try db.scalar(query.count)
            if count == 0 {
                insertUniqueApplicationNames(appName)
            }
        } catch {
            print("Error checking existence of app name: \(error)")
        }
    }

    func insertUniqueApplicationNames(_ appName: String) {
        let insert = uniqueAppNames.insert(activeApplicationName <- appName)
        do {
            try db.run(insert)
        } catch {
            print("Error inserting unique application name: \(error)")
        }
    }
    
    func insertTextForFrame(frameId: Int64, text: String, x: Double, y: Double, w: Double, h: Double){
        let insert = framesText.insert(self.frameId <- frameId, self.text <- text, self.x <- x, self.y <- y,
                                       self.w <- w, self.h <- h)
        try! db.run(insert)
    }
    
    func insertTextsForFrames(entries: [(frameId: Int64, text: String, x: Double, y: Double, w: Double, h: Double)]){
        try! db.transaction {
            for entry in entries {
                let insert = framesText.insert(
                    self.frameId <- entry.frameId,
                    self.text <- entry.text,
                    self.x <- entry.x,
                    self.y <- entry.y,
                    self.w <- entry.w,
                    self.h <- entry.h
                )
                try db.run(insert)
            }
        }
    }
    
    func insertAllTextForFrame(frameId: Int64, text: String) {
        let insert = allText.insert(self.frameId <- frameId, self.text <- text)
        try! db.run(insert)
    }
    
    func getFrame(forIndex index: Int64) -> (offsetIndex: Int64, filePath: String)? {
        do {
          
```

### Core Architecture Module: `rem/Field.swift`
```
//
//  Field.swift
//  rem
//
//  Created by Jason McGhee on 12/27/23.
//

import SwiftUI

struct Field: View {
    @State var text: String

    var body: some View {
        TextField(/*@START_MENU_TOKEN@*/"Hello, World!"/*@END_MENU_TOKEN@*/, text: $text)
    }
}

#Preview {
    Field(text: "")
}

```

### Core Architecture Module: `rem/ImageHelper.swift`
```
//
//  ImageHelper.swift
//  rem
//
//  Created by Jason McGhee on 12/31/23.
//

import Foundation
import os
import SwiftUI

class ImageHelper {
    private static let logger = Logger(
        subsystem: Bundle.main.bundleIdentifier!,
        category: String(describing: ImageHelper.self)
    )
    
    // Useful for debugging...
    static func pngData(from nsImage: NSImage) -> Data? {
        guard let tiffRepresentation = nsImage.tiffRepresentation,
              let bitmapImage = NSBitmapImageRep(data: tiffRepresentation) else {
            logger.error("Failed to get TIFF representation of NSImage")
            return nil
        }
        
        guard let pngData = bitmapImage.representation(using: .png, properties: [:]) else {
            logger.error("Failed to convert NSImage to PNG")
            return nil
        }
        
        return pngData
    }
    
    static func saveNSImage(image: NSImage, path: String) {
        let pngData = pngData(from: image)
        do {
            if let savedir = RemFileManager.shared.getSaveDir() {
                let outputPath = savedir.appendingPathComponent("\(path).png").path
                let fileURL = URL(fileURLWithPath: outputPath)
                try pngData?.write(to: fileURL)
                logger.info("PNG file written successfully")
            } else {
                logger.error("Error writing PNG file")
            }
        } catch {
            logger.error("Error writing PNG file: \(error)")
        }
    }

    static func saveCGImage(image: CGImage, path: String) {
       saveNSImage(image: NSImage(cgImage: image, size: NSZeroSize), path: path)
    }

    static func cropImage(image: CGImage, frame: CGRect, scale: CGFloat) -> CGImage? {
        let cropZone = CGRect(
                x: frame.origin.x * scale,
                y: frame.origin.y * scale,
                width: frame.size.width * scale,
                height: frame.size.height * scale)
        return image.cropping(to: cropZone)
    }
}

```

### Core Architecture Module: `rem/ImageResizer.swift`
```
//
//  ImageResizer.swift
//  rem
//
//  Created by Jason McGhee on 1/17/24.
//

import Foundation
import Cocoa

class ImageResizer {
    private var context: CGContext
    private let targetWidth: CGFloat
    private let targetHeight: CGFloat

    init(targetWidth: Int, targetHeight: Int) {
        self.targetWidth = CGFloat(targetWidth)
        self.targetHeight = CGFloat(targetHeight)

        let colorSpace = CGColorSpaceCreateDeviceRGB()
        let bitmapInfo = CGImageAlphaInfo.premultipliedLast.rawValue
        context = CGContext(data: nil, width: targetWidth, height: targetHeight, bitsPerComponent: 8, bytesPerRow: 0, space: colorSpace, bitmapInfo: bitmapInfo)!
    }

    func resizeAndPad(image: CGImage) -> CGImage? {
        let widthScaleRatio = targetWidth / CGFloat(image.width)
        let heightScaleRatio = targetHeight / CGFloat(image.height)
        let scaleFactor = min(widthScaleRatio, heightScaleRatio)

        let scaledWidth = CGFloat(image.width) * scaleFactor
        let scaledHeight = CGFloat(image.height) * scaleFactor
        let imageRect = CGRect(x: (targetWidth - scaledWidth) / 2, y: (targetHeight - scaledHeight) / 2, width: scaledWidth, height: scaledHeight)

        context.clear(CGRect(x: 0, y: 0, width: targetWidth, height: targetHeight))
        context.setFillColor(NSColor.black.cgColor)
        context.fill(CGRect(x: 0, y: 0, width: targetWidth, height: targetHeight))
        context.interpolationQuality = .high
        context.draw(image, in: imageRect)

        return context.makeImage()
    }
}

```

### Core Architecture Module: `rem/RemFileManager.swift`
```
//
//  FileManager.swift
//  rem
//
//  Created by Jason McGhee on 12/26/23.
//

import Foundation
import os

class RemFileManager {
    private let logger = Logger()
    static let shared: RemFileManager = RemFileManager()
    
    func getSaveDir() -> URL? {
        let fileManager = FileManager.default
        
        // Get the base directory URL
        if let baseDirectory = fileManager.urls(for: .applicationSupportDirectory, in: .userDomainMask).first {
            
            // Create a subdirectory URL within the base directory
            let subdirectory = baseDirectory.appendingPathComponent("today.jason.rem")
            
            // Check if the subdirectory exists
            var isDirectory: ObjCBool = false
            if fileManager.fileExists(atPath: subdirectory.path, isDirectory: &isDirectory) {
                if isDirectory.boolValue {
                    // Subdirectory already exists
                    return subdirectory
                }
            }
            
            // Create the subdirectory if it doesn't exist
            do {
                try fileManager.createDirectory(at: subdirectory, withIntermediateDirectories: true, attributes: nil)
                return subdirectory
            } catch {
                logger.error("Error creating subdirectory: \(error)")
            }
        }
        
        return nil
    }
}

```

### Core Architecture Module: `rem/Search.swift`
```
import SwiftUI
import Combine
import os

struct SearchView: View {
    var onThumbnailClick: (Int64) -> Void  // Closure to handle thumbnail click

    var body: some View {
        ZStack {
            // Using a thin material for the background
            VisualEffectView(material: .hudWindow, blendingMode: .behindWindow)
                .ignoresSafeArea()

            // Components
            VStack {
                ResultsView(onThumbnailClick: onThumbnailClick)
                    .padding(.top, 20)

                Spacer()
                // Future components will be added here
                Spacer()
            }
        }
    }
}

struct SearchBar: View {
    @Binding var text: String
    var onSearch: () -> Void
    @Namespace var nspace
    @FocusState var focused: Bool?
    var debounceSearch = Debouncer(delay: 0.3)
    @Binding var selectedFilterAppIndex: Int
    @Binding var selectedFilterApp: String
    @State private var applicationFilterArray: [String] = []
    
    var body: some View {
        HStack(spacing: 16) {
            // Search TextField
            TextField("Search", text: $text, prompt: Text("Search for something..."))
                .prefersDefaultFocus(in: nspace)
                .textFieldStyle(.plain)
                .focused($focused, equals: true)
                .font(.system(size: 20))
                .padding()
                .padding(.horizontal, 24)
                .background(.thickMaterial)
                .cornerRadius(8)
                .overlay(
                    HStack {
                        Image(systemName: "magnifyingglass")
                            .imageScale(.large)
                            .foregroundColor(.gray)
                            .frame(minWidth: 0, maxWidth: .infinity, alignment: .leading)
                            .padding(.leading, 12)
                    }
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(Color(white: 0.3), lineWidth: 1)
                )
                .onSubmit {
                    Task {
                        onSearch()
                    }
                }
                .onChange(of: text) { _ in
                    debounceSearch.debounce {
                        Task {
                            onSearch()
                        }
                    }
                }
                .onAppear {
                    self.focused = true
                }

            FilterPicker(
                applicationFilterArray: applicationFilterArray,
                selectedFilterAppIndex: $selectedFilterAppIndex,
                selectedFilterApp: $selectedFilterApp,
                debounceSearch: debounceSearch,
                onSearch: onSearch
            )
        }.padding(.horizontal, 16)
    }
}

struct FilterPicker: View {
    @State var applicationFilterArray: [String]
    @Binding var selectedFilterAppIndex: Int
    @Binding var selectedFilterApp: String
    var debounceSearch: Debouncer
    var onSearch: () -> Void
    
    var body: some View {
        VStack(alignment: .leading) {
            Picker("Application", selection: $selectedFilterAppIndex) {
                ForEach(applicationFilterArray.indices, id: \.self) { index in
                    Text(applicationFilterArray[index])
                        .tag(index)
                }
            }
            .onHover(perform: { hovering in
              updateAppFilterData()
            })
            .onAppear{
                updateAppFilterData()
            }
            .pickerStyle(.menu)
            .onChange(of: selectedFilterAppIndex) { newIndex in
                guard newIndex >= 0 && newIndex < applicationFilterArray.count else {
                    return
                }
                selectedFilterApp = applicationFilterArray[selectedFilterAppIndex]
                onSearch()
            }
            .frame(width: 200)
        }
    }
    private func updateAppFilterData() {
        var appFilters = ["All apps"]
        let allAppNames = DatabaseManager.shared.getAllApplicationNames()
        appFilters.append(contentsOf: allAppNames)
        applicationFilterArray = appFilters
    }
}


struct VisualEffectView: NSViewRepresentable {
    var material: NSVisualEffectView.Material
    var blendingMode: NSVisualEffectView.BlendingMode

    func makeNSView(context: Context) -> NSVisualEffectView {
        let view = NSVisualEffectView()
        view.material = material
        view.blendingMode = blendingMode
        view.state = .active
        return view
    }

    func updateNSView(_ nsView: NSVisualEffectView, context: Context) {
        nsView.material = material
        nsView.blendingMode = blendingMode
    }
}

struct ThumbnailView: View {
    let imagePath: String

    var body: some View {
        if let image = NSImage(contentsOfFile: imagePath) {
            Image(nsImage: image)
                .resizable()
                .aspectRatio(contentMode: .fit)
                .frame(width: 60, height: 60)
                .cornerRadius(8)
        } else {
            Image(systemName: "photo")
                .resizable()
                .aspectRatio(contentMode: .fit)
                .frame(width: 60, height: 60)
                .cornerRadius(8)
        }
    }
}

class SearchResult: ObservableObject, Identifiable {
    let id = UUID()  // Unique identifier for each SearchResult

    @Published var thumbnail: NSImage
    var frameId: Int64
    var applicationName: String?
    var fullText: String?
    var searchText: String
    var timestamp: Date
    var matchRange: Range<String.Index>?
    
    init(frameId: Int64, applicationName: String?, fullText: String?, searchText: String, timestamp: Date) {
        self.thumbnail = NSImage()
        self.frameId = frameId
        self.applicationName = applicationName
        self.fullText = fullText
        self.searchText = searchText
        self.timestamp = timestamp

        // Find range, ignoring case and whitespace
        if let text = fullText {
            let pattern = searchText
                .trimmingCharacters(in: .whitespacesAndNewlines)
//                    .replacingOccurrences(of: "\\s+", with: "\\s*", options: .regularExpression)
                .replacingOccurrences(of: "(", with: "\\(")
                .replacingOccurrences(of: ")", with: "\\)")
            
            if let regex = try? NSRegularExpression(pattern: pattern, options: .caseInsensitive),
               let match = regex.firstMatch(in: text, options: [], range: NSRange(location: 0, length: text.utf16.count)) {
                self.matchRange = Range(match.range, in: text) ?? text.startIndex..<text.startIndex
            } else {
                self.matchRange = text.startIndex..<text.startIndex
            }
        }
    }
    
    // Method to update the thumbnail
        func updateThumbnail(_ newImage: NSImage) {
            DispatchQueue.main.async {
                self.thumbnail = newImage
            }
        }
}

struct HighlightTextView: NSViewRepresentable {
    var text: String
    var range: NSRange

    func makeNSView(context: Context) -> NSTextView {
        let textView = NSTextView()
        textView.isEditable = false
        textView.isSelectable = false
        textView.backgroundColor = .clear
        textView.textStorage?.setAttributedString(NSAttributedString(string: ""))
        textView.alignment = .center // Center the text horizontally
        return textView
    }

    func updateNSView(_ nsView: NSTextView, context: Context) {
        if nsView.string != text {
            nsView.textStorage?.beginEditing()
            let attributedString = NSMutableAttributedString(string: text)
            attributedString.addAttribute(.font, value: NSFont.systemFont(ofSize: 14), range: NSRange(location: 0, length: text.utf16.count))
            attributedString.addAttribute(.foregroundColor, value: NSColor.white, range: NSRange(location: 0, length: text.utf16.count))
            nsView.textStorage?.setAttributedString(attributedString)

            // Apply highlight only to the specified range
            let highlightRange = NSIntersectionRange(range, NSRange(location: 0, length: text.utf16.count))
            nsView.textStorage?.addAttribute(.backgroundColor, value: NSColor.yellow, range: highlightRange)
            nsView.textStorage?.addAttribute(.foregroundColor, value: NSColor.black, range: highlightRange)

            nsView.textStorage?.endEditing()
        }
    }
}

struct HighlightedTextDisplayView: View {
    let fullText: String
    let matchRange: Range<String.Index>

    var body: some View {
        // Calculate the start and end indices for the substring
        let start = fullText.index(max(fullText.startIndex, matchRange.lowerBound), offsetBy: -10, limitedBy: fullText.startIndex) ?? fullText.startIndex
        let end = fullText.index(min(fullText.endIndex, matchRange.upperBound), offsetBy: 10, limitedBy: fullText.endIndex) ?? fullText.endIndex
        let surroundingText = fullText[start..<end]

        // Adjust the range for the highlight
        let adjustedStart = fullText.distance(from: start, to: matchRange.lowerBound)
        let adjustedLength = fullText.distance(from: matchRange.lowerBound, to: matchRange.upperBound)
        let adjustedRange = NSRange(location: adjustedStart, length: adjustedLength)

        HighlightTextView(text: String(surroundingText), range: adjustedRange)
    }
}


struct SearchResultView: View {
    @StateObject var result: SearchResult
    var onClick: (Int64) -> Void

    @State private var isHovered = false

    var body: some View {
        VStack {
            let frame = NSScreen.main!.frame
            Image(nsImage: result.thumbnail)
                .resizable()
                .aspectRatio(contentMode: .fit)
                .frame(width: frame.width / 4, height: frame.height / 4)

            VStack(alignment
```

### Core Architecture Module: `rem/SettingsManager.swift`
```
//
//  SettingsManager.swift
//  rem
//
//  Created by Jason McGhee on 12/27/23.
//

import Foundation
import SwiftUI
import LaunchAtLogin

// The settings structure
struct AppSettings: Codable {
    var saveEverythingCopiedToClipboard: Bool
    var enableCmdScrollShortcut: Bool
    var onlyOCRFrontmostWindow: Bool = true
    var fastOCR: Bool = true
    var startRememberingOnStartup: Bool = false
    var recordWindowWithMouse: Bool = false
}

// The settings manager handles saving and loading the settings
class SettingsManager: ObservableObject {
    @Published var settings: AppSettings

    private let settingsKey = "appSettings"

    init() {
        // Load settings or use default values
        if let data = UserDefaults.standard.data(forKey: settingsKey),
           let decodedSettings = try? JSONDecoder().decode(AppSettings.self, from: data) {
            self.settings = decodedSettings
        } else {
            // Default settings
            self.settings = AppSettings(saveEverythingCopiedToClipboard: false, enableCmdScrollShortcut: true)
        }
    }

    func saveSettings() {
        if let encoded = try? JSONEncoder().encode(settings) {
            UserDefaults.standard.set(encoded, forKey: settingsKey)
        }
    }
}

struct SettingsView: View {
    @ObservedObject var settingsManager: SettingsManager

    var body: some View {
        VStack(alignment: .leading) {
            Text("Settings")
                .font(.title)
                .padding(.bottom)
            Form {
                Toggle("Launch rem and start remembering on startup", isOn: $settingsManager.settings.startRememberingOnStartup)
                    .onChange(of: settingsManager.settings.startRememberingOnStartup) { value in
                        LaunchAtLogin.isEnabled = value
                        settingsManager.saveSettings()
                    }
                Toggle("Remember everything copied to clipboard", isOn: $settingsManager.settings.saveEverythingCopiedToClipboard)
                    .onChange(of: settingsManager.settings.saveEverythingCopiedToClipboard) { _ in settingsManager.saveSettings() }
                Toggle("Allow opening / closing timeline with CMD + Scroll", isOn: $settingsManager.settings.enableCmdScrollShortcut)
                    .onChange(of: settingsManager.settings.enableCmdScrollShortcut) { _ in settingsManager.saveSettings() }
                Toggle("Only OCR region of active application window (more efficient)", isOn: $settingsManager.settings.onlyOCRFrontmostWindow)
                    .onChange(of: settingsManager.settings.onlyOCRFrontmostWindow) { _ in settingsManager.saveSettings() }
                Toggle("Use faster, but lower accuracy OCR (more efficient)", isOn: $settingsManager.settings.fastOCR)
                    .onChange(of: settingsManager.settings.fastOCR) { _ in settingsManager.saveSettings() }
                Toggle("Always record window with mouse", isOn: $settingsManager.settings.recordWindowWithMouse)
                    .onChange(of: settingsManager.settings.recordWindowWithMouse) { _ in settingsManager.saveSettings() }
            }
        }
        .padding()
    }
}


```

### Core Architecture Module: `rem/TextMerger.swift`
```
//
//  TextMerger.swift
//  rem
//
//  Created by Jason McGhee on 12/25/23.
//

import Foundation

class TextMerger {
    static let shared = TextMerger()

    func mergeTexts(texts: [String]) -> String {
        var mergedText: String = ""
        var linesSeen = Set<String>()
        for text in texts {
            let cleanedText = cleanText(text)
            for line in self.segmentText(cleanedText) {
                if !linesSeen.contains(line) {
                    mergedText += "\(line)\n"
                    linesSeen.insert(line)
                }
            }
        }
        return mergedText
    }

    private func mergeTwoTexts(text1: String, text2: String) -> String {
        return [text1, text2].joined(separator: "\n")
//        let segments1 = segmentText(text1)
//        let segments2 = segmentText(text2)
//        var mergedSegments: [String] = []
        
        // If the first line matches any...
        // Start from there and go down until no more matches
        // let firstSegment2 = segments2.first
        
        // Go through each line of `segments1` and look for a "match"
        // Then try to find contiguous matches of `k` (3?) in a row, and merge if so.
        // let verySimilar = calculateSimilarity(seg1: seg1, seg2: firstSegment2) > 0.8
        
        
        // If the last line matches any...
        // Start from there and go up until no more matches
        // let lastSegment2 = segments2.last
        
        // Go through each line of `segments1` and look for a "match"
        // Then try to find contiguous matches of `k` (3?) in a row, and merge if so.
        // let verySimilar = calculateSimilarity(seg1: seg1, seg2: lastSegment2) > 0.8

        // return mergedSegments.joined(separator: "\n")
    }

    private func segmentText(_ text: String) -> [String] {
        return text.components(separatedBy: "\n")
    }

    private func mergeSegments(seg1: String, seg2: String) -> String {
        return seg1.count > seg2.count ? seg1 : seg2
    }

    func cleanText(_ text: String) -> String {
        let lines = text.split(separator: "\n")
        let cleanedLines = lines.filter { line in
            let trimmedLine = line.trimmingCharacters(in: .whitespacesAndNewlines)
            let regexPattern = #"^(?:\s*\w\s*|\s*\d+\s*|\s*\b(File|Edit|View|Help)\b\s*)$"#
            return !trimmedLine.isEmpty && (trimmedLine.range(of: regexPattern, options: .regularExpression) == nil)
        }
        return cleanedLines.joined(separator: "\n")
    }

    func compressDocument(_ text: String, chunkSize: Int = 100) -> String {
        let lines = text.split(separator: "\n", omittingEmptySubsequences: false)
        var chunks: [String] = []
        var tempChunk = ""

        for line in lines {
            if (tempChunk.count + line.count) <= chunkSize {
                tempChunk += line + "\n"
            } else {
                chunks.append(tempChunk)
                tempChunk = String(line) + "\n"
            }
        }
        if !tempChunk.isEmpty {
            chunks.append(tempChunk)
        }
        
        for (i, chunk) in chunks.enumerated() {
            chunks[i] = chunk.trimmingCharacters(in: CharacterSet.whitespacesAndNewlines)
        }

        let compressedText = mergeTexts(texts: chunks)
        return compressedText
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #88** (2024-04-26): **Scaling factor no longer taken into account**
  *Symptoms*: Most recent version caused a regression where the scaling factor isn't taken into account causing low resolution capture.
  **Post-Mortem & Fix Analysis**:
  > Fixed with #89 

- **Issue #77** (2024-02-21): **Intel version gobbling mem**
  *Symptoms*: I've been running the intel version on and off on an intermittently-used 2019 16" MBP. I hadn't noted this until recently (so perhaps related to a recent Sonoma developer beta?) but it's been gobbling memory and causing my MBP to crash.  I'd recently recovered from a crash and hadn't yet restarted rem but had activity monitor up and was doing some "normal computing". I started rem and started recording, piddled around a bit and wandered away for a few minutes (maybe 10?). the WindowsServer memoruy was at ~1.5Gb and when i came back was almost at 10Gb. i just grabbed a rem video from a little while before while the laptop was sitting mostly idle and watched WindowsServer grow in memory from 4-5 Gb in the span of a single mp4.  I'm going to stop running it here at least until the next beta update and see how things look then; perhaps others not running the sonoma beta are havign better luck.
  **Post-Mortem & Fix Analysis**:
  > Wow crazy. Thanks for logging.  Pinning this- serious issue.   Very curious if anyone has any insight as to why this might be happening.  Are we improperly handling a manager that is leaking memory?
  > I'll play around a bit more - I _thought_ I'd uncovered some evidence that `rem` had been unrelated - running it with nothing else going in both recording and non-recording states for a while without memory impact - but it turns out `rem` had stopped, so ¯\_(ツ)_/¯.
  > ha ok wow that was _definitely_ not what I saw.  on the intel mac, running "nothing" but activity monitor and `rem` (I guess HomeAssistant was running in the bg - it popped up a window at some point), once i turned on Recording the WindowServer memory immediately started to climb, and reach 19Gb within around 15m.  I grabbed Activity Monitor samples from both WindowServer and rem that I can upload somwhere if they're helpful - no idea how anonymous / secure those are tho. not sure if that's the sort of thing that would help troubleshoot this or not.  For the time being I'm not going to run rem over there until the next Sonoma Beta update as i mentioned, but happy to hellp in any way i can

- **Issue #66** (2024-01-11): **Animated wallpaper causes CPU/battery drain even when not recording**
  *Symptoms*: I haven't had a chance to dig into this much, but I was running a debug build of `rem` that was _not_ set to remember anything. And I happened to check the battery drain:  <img width="320" alt="image" src="https://github.com/jasonjmcghee/rem/assets/777138/db07a0d3-5d91-4ef1-9f26-579a8f7c13ba">  I checked activity and the rem process was pulling 100% doing...something? Not sure what.  Tossing here in case someone else sees same behavior w/ more details.  edit: fyi my was based on 4ea0929c30adb3d15483d246c88b176b0d7c228f with no local changes.
  **Post-Mortem & Fix Analysis**:
  > Oh no! Thank you for seeing this. Very, very curious what that could be! I definitely haven't seen this behavior.  Please do feel free to investigate. Would be an awesome change to fix whatever this might be.
  > If anyone can reproduce this / sees this, I’d be very interested. Tried quite a bit of different things to get this to happen and haven’t been able to.
  > It's reproducible for me. I get rem pegged at 100% just by running the app (from XCode, if you think that makes a difference)  M2 MBA 15", Sonoma, laptop display (in case that matters)  I hooked it up to the XCode profiler. Would share, but it's 360MB gzip-compressed. I'll post some screenshots of the cpu graphs though.  It seems to be... drawing something, maybe?  <img width="1034" alt="image" src="https://github.com/jasonjmcghee/rem/assets/777138/17d0e5a3-46d0-4736-b5db-d039b46f1cad"> 

- **Issue #55** (2024-01-18): **"Recording" itself isn't happening (for some users, still unclear who/why)**
  *Symptoms*: Rem worked great on my M1 MBP, but it isn't functioning as intended on my M1 iMac.   Toggling 'timeline' shows: <img width="845" alt="image" src="https://github.com/jasonjmcghee/rem/assets/33467575/a43a1fba-5e5f-45e4-a101-73a94b2bd8a5">  And using the 'search' feature shows: <img width="2154" alt="image" src="https://github.com/jasonjmcghee/rem/assets/33467575/3832defb-6e33-427a-96c6-cd110cdb84e3">  Searching a specific query does show results matching that word(s), but without the actual thumbnail/recording of it. Clicking on any search result shows image 1 all over again.   'Show me my data' opens finder with several mp4 files, but I'm unable to open any as it says these files are incompatible with quicktime (and all of these also weigh 0KB). Unsure why the recording isn't occurring as I've granted screen-recording permissions
  **Post-Mortem & Fix Analysis**:
  > Is this using 0.1.9? Is this MacOS 14? Out of curiosity, is ffmpeg installed on your computer? Maybe there's a missing dynamic lib that's getting picked up automatically on your mbp.
  > I've tried both the 0.1.9.dmg and the compat-13.dmg; and the iMac's currently on Sonoma 14.0.   Good call on the ffmpeg -- just installed it, but running Rem still doesn't seem to record anything for some reason. Empty mp4 files in my 'data'.   
  > That comment above was a link to an unknown website. Clearly phishing or spam. Reported and deleted.

- **Issue #30** (2023-12-31): **I broke OCR in timeline- out of sync with screenshots**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > It's a race condition thing due to a bug in debounce. have the fix
  > fixed in #31 

- **Issue #24** (2023-12-30): **Pressing escape should dismiss the search and timeline functions if you haven't clicked on the screen yet.**
  *Symptoms*: Currently, if you activate the timeline or the search and press escape, you're not able to dismiss it until you click on the window and then you can dismiss it. Ideally, it should be able to be dismissed right away just by pressing escape without having to select the window first.
  **Post-Mortem & Fix Analysis**:
  > Something must be going wrong with the way windows are being made "key" / ordered.  This would be a great self-contained issue for someone to tackle!
  > Fixed in 0.1.6

- **Issue #19** (2024-01-10): **Started recording, put computer to sleep, reopened - no longer recording**
  *Symptoms*: As described above - seems like something stops working in this situation

- **Issue #11** (2023-12-29): **Icon looks kinda weird [relatively] when active in dark mode?**
  *Symptoms*: <img width="755" alt="Screenshot 2023-12-28 at 7 12 35 PM" src="https://github.com/jasonjmcghee/rem/assets/59275080/9fda125e-8006-4add-a1ba-0423cb80d27f">  This probably slipped through the cracks since the Loom demo was in light mode lol
  **Post-Mortem & Fix Analysis**:
  >  I am in dark mode, I think that's based on your background picture.  What's the right way to make this icon? Is there some monochrome approach that inverts appropriately?  Happy to make inverted versions of the status icons. do you know how to make theme specific icons?
  > My lazy approach is to normally just create two versions (inverted colors) and match them to the theme of the system.  There's a bunch of ways to detect whether the system is in dark or light mode: https://stackoverflow.com/questions/25207077/how-to-detect-if-os-x-is-in-dark-mode
  > Doesn't seem to have anything to do with light / dark mode   https://github.com/jasonjmcghee/rem/assets/1522149/7ae80d61-9d89-4939-9be8-b69d0cb748d7  

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

### Incident Patch 1: `f4f68049` (2024-05-16)
**Commit Message**: Merge pull request #96 from cparish312/more_robust_screenshot_loop

startScreenCapture in loop

**File**: `rem/remApp.swift` (modified, +11/-10)
```diff
@@ -90,7 +90,7 @@ class AppDelegate: NSObject, NSApplicationDelegate {
     private var lastImageData: Data? = nil
     private var lastActiveApplication: String? = nil
     private var lastDisplayID: UInt32? = nil
-    private var screenshotRetries: Int = 0
+    private var screenCaptureRetries: Int = 0
     
     
     private var imageResizer = ImageResizer(
@@ -349,15 +349,16 @@ func drawStatusBarIcon(rect: CGRect) -> Bool {
         return false
     }
     
-    private func retryScreenshot(shareableContent: SCShareableContent) {
-        if screenshotRetries < 3 {
-            screenshotRetries += 1
-            screenshotQueue.asyncAfter(deadline: .now() + 2) { [weak self] in
-                self?.scheduleScreenshot(shareableContent: shareableContent)
+    private func retryScreenCapture() {
+        if screenCaptureRetries < 3 {
+            screenCaptureRetries += 1
+            Task {
+                try await Task.sleep(nanoseconds: 2_000_000_000)
+                await startScreenCapture()
             }
         } else {
             disableRecording()
-            screenshotRetries = 0
+            screenCaptureRetries = 0
         }
     }
 
@@ -388,13 +389,13 @@ func drawStatusBarIcon(rect: CGRect) -> Bool {
                 
                 guard displayID != nil else {
                     logger.debug("DisplayID is nil")
-                    retryScreenshot(shareableContent: shareableContent)
+                    retryScreenCapture()
                     return
                 }
                 
                 guard let display = shareableContent.displays.first(where: { $0.displayID == displayID }) else {
                     logger.debug("Display could not be retrieved")
-                    retryScreenshot(shareableContent: shareableContent)
+                    retryScreenCapture()
                     return
                 }
                 
@@ -452,7 +453,7 @@ func drawStatusBarIcon(rect: CGRect) -> Bool {
                 logger.error("Error taking screenshot: \(error)")
             }
             
-            screenshotRetries = 0
+            screenCaptureRetries = 0
             screenshotQueue.asyncAfter(deadline: .now() + 2) { [weak self] in
                 self?.scheduleScreenshot(shareableContent: shareableContent)
             }
```

---

### Incident Patch 2: `09c11162` (2024-05-14)
**Commit Message**: startScreenCapture in loop

**File**: `rem/remApp.swift` (modified, +4/-4)
```diff
@@ -324,8 +324,8 @@ func drawStatusBarIcon(rect: CGRect) -> Bool {
             let shareableContent = try await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: false)
 
             setupMenu()
-            Task {
-                await startScreenCapture()
+            screenshotQueue.async { [weak self] in
+                self?.scheduleScreenshot(shareableContent: shareableContent)
             }
         } catch {
             logger.error("Error starting screen capture: \(error.localizedDescription)")
@@ -352,8 +352,8 @@ func drawStatusBarIcon(rect: CGRect) -> Bool {
     private func retryScreenshot(shareableContent: SCShareableContent) {
         if screenshotRetries < 3 {
             screenshotRetries += 1
-            screenshotQueue.asyncAfter(deadline: .now() + 2) { [weak self] in
-                self?.scheduleScreenshot(shareableContent: shareableContent)
+            Task {
+                await startScreenCapture()
             }
         } else {
             disableRecording()
```

---

### Incident Patch 3: `9681915e` (2024-05-14)
**Commit Message**: startScreenCapture in loop

**File**: `rem/remApp.swift` (modified, +2/-2)
```diff
@@ -324,8 +324,8 @@ func drawStatusBarIcon(rect: CGRect) -> Bool {
             let shareableContent = try await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: false)
 
             setupMenu()
-            screenshotQueue.async { [weak self] in
-                self?.scheduleScreenshot(shareableContent: shareableContent)
+            Task {
+                await startScreenCapture()
             }
         } catch {
             logger.error("Error starting screen capture: \(error.localizedDescription)")
```

---

### Incident Patch 4: `9e6730d2` (2024-05-08)
**Commit Message**: Merge pull request #95 from cparish312/robust_screenshot_loop

retryScreenshot for more Robust screenshot loop

**File**: `rem/DB.swift` (modified, +3/-0)
```diff
@@ -59,6 +59,9 @@ class DatabaseManager {
             db = try! Connection("db.sqlite3")
         }
         
+        try! db.run("PRAGMA journal_mode = WAL")
+        try! db.run("PRAGMA synchronous = NORMAL")
+        
         createTables()
         currentChunkId = getCurrentChunkId()
         lastFrameId = getLastFrameId()
```

**File**: `rem/remApp.swift` (modified, +24/-6)
```diff
@@ -90,6 +90,7 @@ class AppDelegate: NSObject, NSApplicationDelegate {
     private var lastImageData: Data? = nil
     private var lastActiveApplication: String? = nil
     private var lastDisplayID: UInt32? = nil
+    private var screenshotRetries: Int = 0
     
     
     private var imageResizer = ImageResizer(
@@ -347,11 +348,23 @@ func drawStatusBarIcon(rect: CGRect) -> Bool {
         }
         return false
     }
+    
+    private func retryScreenshot(shareableContent: SCShareableContent) {
+        if screenshotRetries < 3 {
+            screenshotRetries += 1
+            screenshotQueue.asyncAfter(deadline: .now() + 2) { [weak self] in
+                self?.scheduleScreenshot(shareableContent: shareableContent)
+            }
+        } else {
+            disableRecording()
+            screenshotRetries = 0
+        }
+    }
 
     private func scheduleScreenshot(shareableContent: SCShareableContent) {
         Task {
             do {
-                guard isCapturing == .recording else { 
+                guard isCapturing == .recording else {
                     logger.debug("Stopped Recording")
                     return }
                 
@@ -372,14 +385,18 @@ func drawStatusBarIcon(rect: CGRect) -> Bool {
                         logger.debug("Active Display ID: \(displayID ?? 999)")
                     }
                 }
-
-                guard displayID != nil else { 
+                
+                guard displayID != nil else {
                     logger.debug("DisplayID is nil")
-                    return }
+                    retryScreenshot(shareableContent: shareableContent)
+                    return
+                }
                 
-                guard let display = shareableContent.displays.first(where: { $0.displayID == displayID }) else { 
+                guard let display = shareableContent.displays.first(where: { $0.displayID == displayID }) else {
                     logger.debug("Display could not be retrieved")
-                    return }
+                    retryScreenshot(shareableContent: shareableContent)
+                    return
+                }
                 
                 let activeApplicationName = NSWorkspace.shared.frontmostApplication?.localizedName
                 
@@ -435,6 +452,7 @@ func drawStatusBarIcon(rect: CGRect) -> Bool {
                 logger.error("Error taking screenshot: \(error)")
             }
             
+            screenshotRetries = 0
             screenshotQueue.asyncAfter(deadline: .now() + 2) { [weak self] in
                 self?.scheduleScreenshot(shareableContent: shareableContent)
             }
```

---

### Incident Patch 5: `6f9fa7ed` (2024-05-05)
**Commit Message**: PRAGMA journal_mode = WAL and disablerecording instead of stop exit screenshot loop

**File**: `rem/DB.swift` (modified, +2/-2)
```diff
@@ -59,8 +59,8 @@ class DatabaseManager {
             db = try! Connection("db.sqlite3")
         }
         
-        // 2 second busy timeout
-        db.busyTimeout = 2000
+        try! db.run("PRAGMA journal_mode = WAL")
+        try! db.run("PRAGMA synchronous = NORMAL")
         
         createTables()
         currentChunkId = getCurrentChunkId()
```

**File**: `rem/remApp.swift` (modified, +1/-1)
```diff
@@ -356,7 +356,7 @@ func drawStatusBarIcon(rect: CGRect) -> Bool {
                 self?.scheduleScreenshot(shareableContent: shareableContent)
             }
         } else {
-            stopScreenCapture()
+            disableRecording()
             screenshotRetries = 0
         }
     }
```

---

### Incident Patch 6: `6f8cdde7` (2024-05-04)
**Commit Message**: db.busyTimeout = 2000

**File**: `rem/DB.swift` (modified, +3/-0)
```diff
@@ -59,6 +59,9 @@ class DatabaseManager {
             db = try! Connection("db.sqlite3")
         }
         
+        // 2 second busy timeout
+        db.busyTimeout = 2000
+        
         createTables()
         currentChunkId = getCurrentChunkId()
         lastFrameId = getLastFrameId()
```

---

### Incident Patch 7: `09ad6e78` (2024-04-29)
**Commit Message**: getChunksFramesIndex and fix search results missing offset of 29

**File**: `rem/DB.swift` (modified, +13/-0)
```diff
@@ -253,6 +253,19 @@ class DatabaseManager {
         return nil
     }
     
+    func getChunksFramesIndex(frameId index: Int64) -> Int64? {
+        do {
+            let query = chunksFramesView.filter(frameId == index).limit(1)
+            if let frame = try db.pluck(query) {
+                return frame[chunksFramesIndex]
+            }
+        } catch {
+            return nil
+        }
+        
+        return nil
+    }
+    
     func getFrameByChunksFramesIndex(forIndex index: Int64) -> (offsetIndex: Int64, filePath: String)? {
         do {
             let query = chunksFramesView.filter(chunksFramesIndex == index).limit(1)
```

**File**: `rem/Search.swift` (modified, +1/-1)
```diff
@@ -424,7 +424,7 @@ struct ResultsView: View {
                 switch imageResult {
                 case .success(let requestedTime, let image, _):
                     if count < results.count {
-                        let offset = Int64(requestedTime.seconds * fps)
+                        let offset = Int64((requestedTime.seconds * Double(fps)).rounded())
                         if let id = offsetToId[offset] {
                             if let dataIndex = frameIdIndexLookup[id] {
                                 results[dataIndex].updateThumbnail(NSImage(cgImage: image, size: NSZeroSize))
```

**File**: `rem/remApp.swift` (modified, +6/-1)
```diff
@@ -708,7 +708,12 @@ func drawStatusBarIcon(rect: CGRect) -> Bool {
     }
     
     func openFullView(atIndex index: Int64) {
-        showTimelineView(with: index)
+        // Needed since Search returns a frameId but Timeline runs on chunksFramesIndexs
+        if let chunksFramesIndex = DatabaseManager.shared.getChunksFramesIndex(frameId: index) {
+            showTimelineView(with: chunksFramesIndex)
+        } else {
+            print("No chunksFramesIndex found for frameId \(index)")
+        }
     }
     
     func closeSearchView() {
```

---

### Incident Patch 8: `a1e31743` (2024-04-29)
**Commit Message**: Merge pull request #90 from cparish312/fix_chunk_indexing

Fix chunk indexing

**File**: `rem/DB.swift` (modified, +66/-4)
```diff
@@ -29,10 +29,12 @@ class DatabaseManager {
     private let uniqueAppNames = Table("unique_application_names")
 
     let allText = VirtualTable("allText")
+    let chunksFramesView = View("chunks_frames_view")
     
     private let id = Expression<Int64>("id")
     private let offsetIndex = Expression<Int64>("offsetIndex")
     private let chunkId = Expression<Int64>("chunkId")
+    private let chunksFramesIndex = Expression<Int64>("chunksFramesIndex")
     private let timestamp = Expression<Date>("timestamp")
     private let filePath = Expression<String>("filePath")
     private let activeApplicationName = Expression<String?>("activeApplicationName")
@@ -43,6 +45,7 @@ class DatabaseManager {
     private var currentChunkId: Int64 = 0 // Initialize with a default value
     private var lastFrameId: Int64 = 0
     private var currentFrameOffset: Int64 = 0
+    private var lastChunksFramesIndex: Int64 = 0
     
     init() {
         if let savedir = RemFileManager.shared.getSaveDir() {
@@ -54,6 +57,7 @@ class DatabaseManager {
         createTables()
         currentChunkId = getCurrentChunkId()
         lastFrameId = getLastFrameId()
+        lastChunksFramesIndex = getLastChunksFramesIndex()
     }
     
     func purge() {
@@ -116,6 +120,26 @@ class DatabaseManager {
         
         // Text search
         try! db.run(allText.create(.FTS4(config), ifNotExists: true))
+        
+        // Create chunksFramesView (ensures all frames have associated chunks)
+        let viewSQL = """
+        CREATE VIEW IF NOT EXISTS chunks_frames_view AS
+        SELECT
+            ROW_NUMBER() OVER (ORDER BY vc.id, f.id) as chunksFramesIndex,
+            vc.id as chunkId,
+            vc.filePath,
+            f.id as frameId,
+            f.timestamp,
+            f.activeApplicationName,
+            f.offsetIndex
+        FROM
+            video_chunks vc
+        JOIN
+            frames f ON vc.id = f.chunkId
+        ORDER BY
+            vc.id, f.id;
+        """
+        try! db.run(viewSQL)
     }
     
     private func createIndices() {
@@ -124,6 +148,8 @@ class DatabaseManager {
             try db.run(frames.createIndex(chunkId, id, unique: false, ifNotExists: true))
             try db.run(frames.createIndex(timestamp, ifNotExists: true))
             
+            // For speeding up chunksFramesView
+            try db.run(videoChunks.createIndex(id, unique: true, ifNotExists: true))
             // Additional indices can be added here as needed
         } catch {
             print("Failed to create indices: \(error)")
@@ -132,8 +158,8 @@ class DatabaseManager {
     
     private func getCurrentChunkId() -> Int64 {
         do {
-            if let lastChunk = try db.pluck(videoChunks.order(id.desc)) {
-                return lastChunk[id] + 1
+            if let lastFrame = try db.pluck(frames.order(id.desc)) {
+                return lastFrame[chunkId] + 1
             }
         } catch {
             print("Error fetching last chunk ID: \(error)")
@@ -147,17 +173,29 @@ class DatabaseManager {
                 return lastFrame[id]
             }
         } catch {
-            print("Error fetching last chunk ID: \(error)")
+            print("Error fetching last frame ID: \(error)")
+        }
+        return 0
+    }
+    
+    private func getLastChunksFramesIndex() -> Int64 {
+        do {
+            if let lastFrame = try db.pluck(chunksFramesView.order(chunksFramesIndex.desc)) {
+                return lastFrame[chunksFramesIndex]
+            }
+        } catch {
+            print("Error fetching last chunks frames Index: \(error)")
         }
         return 0
     }
     
     // Insert a new video chunk and return its ID
     func startNewVideoChunk(filePath: String) -> Int64 {
-        let insert = videoChunks.insert(self.filePath <- filePath)
+        let insert = videoChunks.insert(self.id <- currentChunkId, self.filePath <- filePath)
         let id = try! db.run(insert)
         currentChunkId = id + 1
         currentFrameOffset = 0
+        lastChunksFramesIndex = getLastChunksFramesIndex()
         return id
     }
     
@@ -208,6 +246,19 @@ class DatabaseManager {
             if let frame = try db.pluck(query) {
                 return (frame[offsetIndex], frame[filePath])
             }
+        } catch {
+            return nil
+        }
+        
+        return nil
+    }
+    
+    func getFrameByChunksFramesIndex(forIndex index: Int64) -> (offsetIndex: Int64, filePath: String)? {
+        do {
+            let query = chunksFramesView.filter(chunksFramesIndex == index).limit(1)
+            if let frame = try db.pluck(query) {
+                return (frame[offsetIndex], frame[filePath])
+            }
             
             //  let justFrameQuery = frames.filter(frames[id] === index).limit(1)
             //  try! db.run(justFrameQuery.delete())
@@ -283,6 +334,10 @@ class DatabaseManager {
         return lastFrameId
     }
     
+    func getMaxChunksFrames
```

**File**: `rem/TimelineView.swift` (modified, +6/-6)
```diff
@@ -33,7 +33,7 @@ struct TimelineView: View {
     var body: some View {
         ZStack {
             let frame = NSScreen.main?.frame ?? NSRect.zero
-            let image = DatabaseManager.shared.getImage(index: viewModel.currentFrameIndex)
+            let image = DatabaseManager.shared.getImageByChunksFramesIndex(index: viewModel.currentFrameIndex)
             let nsImage = image.flatMap { NSImage(cgImage: $0, size: NSSize(width: $0.width, height: $0.height)) }
             
             CustomHostingControllerRepresentable(
@@ -74,7 +74,7 @@ struct TimelineView: View {
     
     private func analyzeImage(index: Int64) {
         Task {
-            if let image = DatabaseManager.shared.getImage(index: index) {
+            if let image = DatabaseManager.shared.getImageByChunksFramesIndex(index: index) {
                 let configuration = ImageAnalyzer.Configuration([.text])
                 do {
                     let analysis = try await imageAnalyzer.analyze(image, orientation: CGImagePropertyOrientation.up, configuration: configuration)
@@ -290,7 +290,7 @@ class TimelineViewModel: ObservableObject {
     private var indexUpdateThrottle = Throttler(delay: 0.05)
     
     init() {
-        let maxFrame = DatabaseManager.shared.getMaxFrame()
+        let maxFrame = DatabaseManager.shared.getMaxChunksFramesIndex()
         currentFrameIndex = maxFrame
         currentFrameContinuous = Double(maxFrame)
     }
@@ -299,21 +299,21 @@ class TimelineViewModel: ObservableObject {
         // Logic to update the index based on the delta
         // This method will be called from AppDelegate
         let nextValue = currentFrameContinuous - delta * speedFactor
-        let maxValue = Double(DatabaseManager.shared.getMaxFrame())
+        let maxValue = Double(DatabaseManager.shared.getMaxChunksFramesIndex())
         let clampedValue = min(max(1, nextValue), maxValue)
         self.currentFrameContinuous = clampedValue
         self.updateIndexSafely()
     }
     
     func updateIndex(withIndex: Int64) {
-        let maxValue = Double(DatabaseManager.shared.getMaxFrame())
+        let maxValue = Double(DatabaseManager.shared.getMaxChunksFramesIndex())
         let clampedValue = min(max(1, Double(withIndex)), maxValue)
         self.currentFrameContinuous = clampedValue
         self.updateIndexSafely()
     }
     
     func setIndexToLatest() {
-        let maxFrame = DatabaseManager.shared.getMaxFrame()
+        let maxFrame = DatabaseManager.shared.getMaxChunksFramesIndex()
         DispatchQueue.main.async {
             self.currentFrameContinuous = Double(maxFrame)
             self.currentFrameIndex = maxFrame
```

**File**: `rem/remApp.swift` (modified, +27/-7)
```diff
@@ -196,7 +196,7 @@ func drawStatusBarIcon(rect: CGRect) -> Bool {
             }
             let menu = NSMenu()
             let recordingTitle = self.isCapturing == .recording ? "Stop Remembering" : "Start Remembering"
-            let recordingSelector = self.isCapturing == .recording ? #selector(self.disableRecording) : #selector(self.enableRecording)
+            let recordingSelector = self.isCapturing == .recording ? #selector(self.userDisableRecording) : #selector(self.enableRecording)
             menu.addItem(NSMenuItem(title: recordingTitle, action: recordingSelector, keyEquivalent: ""))
             menu.addItem(NSMenuItem(title: "Toggle Timeline", action: #selector(self.toggleTimeline), keyEquivalent: ""))
             menu.addItem(NSMenuItem(title: "Search", action: #selector(self.showSearchView), keyEquivalent: ""))
@@ -225,7 +225,7 @@ func drawStatusBarIcon(rect: CGRect) -> Bool {
         if isTimelineOpen() {
             closeTimelineView()
         } else {
-            let frame = DatabaseManager.shared.getMaxFrame()
+            let frame = DatabaseManager.shared.getMaxChunksFramesIndex()
             showTimelineView(with: frame)
         }
     }
@@ -278,7 +278,7 @@ func drawStatusBarIcon(rect: CGRect) -> Bool {
         
         if event.scrollingDeltaY < 0 && !isTimelineOpen() { // Check if scroll up
             DispatchQueue.main.async { [weak self] in
-                self?.showTimelineView(with: DatabaseManager.shared.getMaxFrame())
+                self?.showTimelineView(with: DatabaseManager.shared.getMaxChunksFramesIndex())
             }
         }
     }
@@ -483,8 +483,6 @@ func drawStatusBarIcon(rect: CGRect) -> Bool {
         if let savedir = RemFileManager.shared.getSaveDir() {
             let outputPath = savedir.appendingPathComponent("output-\(Date().timeIntervalSince1970).mp4").path
             
-            let _ = DatabaseManager.shared.startNewVideoChunk(filePath: outputPath)
-            
             // Setup the FFmpeg process for the chunk
             let ffmpegProcess = Process()
             let bundleURL = Bundle.main.bundleURL
@@ -531,6 +529,17 @@ func drawStatusBarIcon(rect: CGRect) -> Bool {
 
             // Close the pipe and handle the process completion
             ffmpegInputPipe.fileHandleForWriting.closeFile()
+            ffmpegProcess.waitUntilExit()
+            
+            // Check if FFmpeg process completed successfully
+            if ffmpegProcess.terminationStatus == 0 {
+                // Start new video chunk in database only if FFmpeg succeeds
+                let _ = DatabaseManager.shared.startNewVideoChunk(filePath: outputPath)
+                logger.info("Video successfully saved and registered.")
+            } else {
+                logger.error("FFmpeg failed to process video chunk.")
+            }
+
             
             // Read FFmpeg's output and error
             let outputData = ffmpegOutputPipe.fileHandleForReading.readDataToEndOfFile()
@@ -548,6 +557,9 @@ func drawStatusBarIcon(rect: CGRect) -> Bool {
     }
 
     @objc func enableRecording() {
+        if isCapturing == .recording {
+            return
+        }
         isCapturing = .recording
 
         Task {
@@ -560,6 +572,12 @@ func drawStatusBarIcon(rect: CGRect) -> Bool {
         logger.info("Screen capture paused")
     }
     
+    @objc func userDisableRecording() {
+        wasRecordingBeforeSearchView = false
+        wasRecordingBeforeTimelineView = false
+        disableRecording()
+    }
+    
     @objc func disableRecording() {
         if isCapturing != .recording {
             return
@@ -645,8 +663,9 @@ func drawStatusBarIcon(rect: CGRect) -> Bool {
     }
     
     @objc func showTimelineView(with index: Int64) {
-        wasRecordingBeforeTimelineView = (isCapturing == .recording)
+        wasRecordingBeforeTimelineView = (isCapturing == .recording) || wasRecordingBeforeSearchView // handle going from search to TL
         disableRecording()
+        wasRecordingBeforeSearchView = false
         closeSearchView()
         if timelineViewWindow == nil {
             let screenRect = NSScreen.main?.frame ?? NSRect.zero
@@ -710,8 +729,9 @@ func drawStatusBarIcon(rect: CGRect) -> Bool {
     }
     
     @objc func showSearchView() {
-        wasRecordingBeforeSearchView = (isCapturing == .recording)
+        wasRecordingBeforeSearchView = (isCapturing == .recording) || wasRecordingBeforeTimelineView
         disableRecording()
+        wasRecordingBeforeTimelineView = false
         closeTimelineView()
         // Ensure that the search view window is created and shown
         if searchViewWindow == nil {
```

---

### Incident Patch 9: `6e36b216` (2024-04-26)
**Commit Message**: Merge pull request #89 from jasonjmcghee/rem-88-fix-scaling-factor-bug

[rem-88]: Ensures the backing scaling factor is taken into account

**File**: `rem/remApp.swift` (modified, +4/-1)
```diff
@@ -90,7 +90,10 @@ class AppDelegate: NSObject, NSApplicationDelegate {
     private var lastImageData: Data? = nil
     private var lastActiveApplication: String? = nil
     
-    private var imageResizer = ImageResizer(targetWidth: Int(NSScreen.main!.frame.width), targetHeight: Int(NSScreen.main!.frame.height))
+    private var imageResizer = ImageResizer(
+        targetWidth: Int(NSScreen.main!.frame.width * NSScreen.main!.backingScaleFactor),
+        targetHeight: Int(NSScreen.main!.frame.height * NSScreen.main!.backingScaleFactor)
+    )
 
     func applicationDidFinishLaunching(_ notification: Notification) {
         let _ = DatabaseManager.shared
```

---

### Incident Patch 10: `7be79c65` (2024-03-03)
**Commit Message**: fix to work with our settings manager

**File**: `rem/SettingsManager.swift` (modified, +6/-1)
```diff
@@ -15,6 +15,7 @@ struct AppSettings: Codable {
     var enableCmdScrollShortcut: Bool
     var onlyOCRFrontmostWindow: Bool = true
     var fastOCR: Bool = true
+    var startRememberingOnStartup: Bool = false
 }
 
 // The settings manager handles saving and loading the settings
@@ -50,6 +51,11 @@ struct SettingsView: View {
                 .font(.title)
                 .padding(.bottom)
             Form {
+                Toggle("Launch rem and start remembering on startup", isOn: $settingsManager.settings.startRememberingOnStartup)
+                    .onChange(of: settingsManager.settings.startRememberingOnStartup) { value in
+                        LaunchAtLogin.isEnabled = value
+                        settingsManager.saveSettings()
+                    }
                 Toggle("Remember everything copied to clipboard", isOn: $settingsManager.settings.saveEverythingCopiedToClipboard)
                     .onChange(of: settingsManager.settings.saveEverythingCopiedToClipboard) { _ in settingsManager.saveSettings() }
                 Toggle("Allow opening / closing timeline with CMD + Scroll", isOn: $settingsManager.settings.enableCmdScrollShortcut)
@@ -58,7 +64,6 @@ struct SettingsView: View {
                     .onChange(of: settingsManager.settings.onlyOCRFrontmostWindow) { _ in settingsManager.saveSettings() }
                 Toggle("Use faster, but lower accuracy OCR (more efficient)", isOn: $settingsManager.settings.fastOCR)
                     .onChange(of: settingsManager.settings.fastOCR) { _ in settingsManager.saveSettings() }
-                LaunchAtLogin.Toggle("Launch at login 🦄")
             }
         }
         .padding()
```

---

### Incident Patch 11: `82603135` (2024-01-18)
**Commit Message**: Merge pull request #74 from jasonjmcghee/fix-external-monitor-bugs

fix external monitor bugs, mainly by calling CGDisplayCreateImage without passing the display frame

**File**: `README.md` (modified, +2/-1)
```diff
@@ -41,12 +41,13 @@ Also, that means there is no tracking / analytics of any kind, which means I don
 - [x] Search everything you've viewed with keyword search (and filter by application)
 - [x] Easily grab recent context for use with LLMs
 - [x] First [Intel build](https://github.com/jasonjmcghee/rem/releases/download/v0.1.11/rem-0.1.11-intel.dmg) (please help test!)
+- [x] It "works" with external / multiple monitors connected
 - [ ] Natural language search / agent interaction via updating local vector embedding
     - [I've also been exploring novel approaches to vector dbs](https://github.com/jasonjmcghee/portable-hnsw)
 - [ ] Novel search experiences like spatial / similar images
 - [ ] More search filters (by time, etc.)
 - [ ] Fine-grained purging / trimming / selecting recording
-- [ ] Multi-monitor support
+- [ ] Better / First-class multi-monitor support
 
 ## Getting Started
 
```

**File**: `rem.xcodeproj/project.pbxproj` (modified, +4/-0)
```diff
@@ -8,6 +8,7 @@
 
 /* Begin PBXBuildFile section */
 		102CA4C82B3E240C00C3DA2E /* SQLite.framework in Frameworks */ = {isa = PBXBuildFile; fileRef = 96E66BC32B2F5745006E1E97 /* SQLite.framework */; };
+		960AC0242B58D0590050C62A /* ImageResizer.swift in Sources */ = {isa = PBXBuildFile; fileRef = 960AC0232B58D0590050C62A /* ImageResizer.swift */; };
 		961C95DA2B2E19B30093F228 /* remApp.swift in Sources */ = {isa = PBXBuildFile; fileRef = 961C95D92B2E19B30093F228 /* remApp.swift */; };
 		961C95DC2B2E19B30093F228 /* ContentView.swift in Sources */ = {isa = PBXBuildFile; fileRef = 961C95DB2B2E19B30093F228 /* ContentView.swift */; };
 		961C95E12B2E19B40093F228 /* Preview Assets.xcassets in Resources */ = {isa = PBXBuildFile; fileRef = 961C95E02B2E19B40093F228 /* Preview Assets.xcassets */; };
@@ -193,6 +194,7 @@
 /* End PBXCopyFilesBuildPhase section */
 
 /* Begin PBXFileReference section */
+		960AC0232B58D0590050C62A /* ImageResizer.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = ImageResizer.swift; sourceTree = "<group>"; };
 		961C95D62B2E19B30093F228 /* rem.app */ = {isa = PBXFileReference; explicitFileType = wrapper.application; includeInIndex = 0; path = rem.app; sourceTree = BUILT_PRODUCTS_DIR; };
 		961C95D92B2E19B30093F228 /* remApp.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = remApp.swift; sourceTree = "<group>"; };
 		961C95DB2B2E19B30093F228 /* ContentView.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = ContentView.swift; sourceTree = "<group>"; };
@@ -289,6 +291,7 @@
 				969F3F092B3B7F760085787B /* Info.plist */,
 				961C96122B2EB7DB0093F228 /* TimelineView.swift */,
 				BF5FEBFA2B44B26800744FC2 /* ImageHelper.swift */,
+				960AC0232B58D0590050C62A /* ImageResizer.swift */,
 				961C95D92B2E19B30093F228 /* remApp.swift */,
 				961C95DB2B2E19B30093F228 /* ContentView.swift */,
 				961C95DD2B2E19B40093F228 /* Assets.xcassets */,
@@ -656,6 +659,7 @@
 			isa = PBXSourcesBuildPhase;
 			buildActionMask = 2147483647;
 			files = (
+				960AC0242B58D0590050C62A /* ImageResizer.swift in Sources */,
 				961C95DC2B2E19B30093F228 /* ContentView.swift in Sources */,
 				961C96152B2EBEE50093F228 /* DB.swift in Sources */,
 				96B0DA3A2B3A08280030E8AE /* TextMerger.swift in Sources */,
```

**File**: `rem.xcodeproj/xcuserdata/jason.xcuserdatad/xcschemes/xcschememanagement.plist` (modified, +47/-5)
```diff
@@ -9,31 +9,73 @@
 			<key>isShown</key>
 			<false/>
 			<key>orderHint</key>
-			<integer>6</integer>
+			<integer>7</integer>
 		</dict>
 		<key>SQLite (Playground) 2.xcscheme</key>
 		<dict>
 			<key>isShown</key>
 			<false/>
 			<key>orderHint</key>
-			<integer>7</integer>
+			<integer>8</integer>
+		</dict>
+		<key>SQLite (Playground) 3.xcscheme</key>
+		<dict>
+			<key>isShown</key>
+			<false/>
+			<key>orderHint</key>
+			<integer>9</integer>
+		</dict>
+		<key>SQLite (Playground) 4.xcscheme</key>
+		<dict>
+			<key>isShown</key>
+			<false/>
+			<key>orderHint</key>
+			<integer>10</integer>
+		</dict>
+		<key>SQLite (Playground) 5.xcscheme</key>
+		<dict>
+			<key>isShown</key>
+			<false/>
+			<key>orderHint</key>
+			<integer>11</integer>
+		</dict>
+		<key>SQLite (Playground) 6.xcscheme</key>
+		<dict>
+			<key>isShown</key>
+			<false/>
+			<key>orderHint</key>
+			<integer>12</integer>
+		</dict>
+		<key>SQLite (Playground) 7.xcscheme</key>
+		<dict>
+			<key>isShown</key>
+			<false/>
+			<key>orderHint</key>
+			<integer>13</integer>
+		</dict>
+		<key>SQLite (Playground) 8.xcscheme</key>
+		<dict>
+			<key>isShown</key>
+			<false/>
+			<key>orderHint</key>
+			<integer>14</integer>
 		</dict>
 		<key>SQLite (Playground).xcscheme</key>
 		<dict>
 			<key>isShown</key>
 			<false/>
 			<key>orderHint</key>
-			<integer>5</integer>
+			<integer>6</integer>
 		</dict>
 		<key>ffmpegX.xcscheme_^#shared#^_</key>
 		<dict>
 			<key>orderHint</key>
-			<integer>5</integer>
+			<integer>4</integer>
 		</dict>
 		<key>rem.xcscheme_^#shared#^_</key>
 		<dict>
 			<key>orderHint</key>
-			<integer>4</integer>
+			<integer>5</integer>
 		</dict>
 	</dict>
 </dict>
```

**File**: `rem/ImageResizer.swift` (added, +42/-0)
```diff
@@ -0,0 +1,42 @@
+//
+//  ImageResizer.swift
+//  rem
+//
+//  Created by Jason McGhee on 1/17/24.
+//
+
+import Foundation
+import Cocoa
+
+class ImageResizer {
+    private var context: CGContext
+    private let targetWidth: CGFloat
+    private let targetHeight: CGFloat
+
+    init(targetWidth: Int, targetHeight: Int) {
+        self.targetWidth = CGFloat(targetWidth)
+        self.targetHeight = CGFloat(targetHeight)
+
+        let colorSpace = CGColorSpaceCreateDeviceRGB()
+        let bitmapInfo = CGImageAlphaInfo.premultipliedLast.rawValue
+        context = CGContext(data: nil, width: targetWidth, height: targetHeight, bitsPerComponent: 8, bytesPerRow: 0, space: colorSpace, bitmapInfo: bitmapInfo)!
+    }
+
+    func resizeAndPad(image: CGImage) -> CGImage? {
+        let widthScaleRatio = targetWidth / CGFloat(image.width)
+        let heightScaleRatio = targetHeight / CGFloat(image.height)
+        let scaleFactor = min(widthScaleRatio, heightScaleRatio)
+
+        let scaledWidth = CGFloat(image.width) * scaleFactor
+        let scaledHeight = CGFloat(image.height) * scaleFactor
+        let imageRect = CGRect(x: (targetWidth - scaledWidth) / 2, y: (targetHeight - scaledHeight) / 2, width: scaledWidth, height: scaledHeight)
+
+        context.clear(CGRect(x: 0, y: 0, width: targetWidth, height: targetHeight))
+        context.setFillColor(NSColor.black.cgColor)
+        context.fill(CGRect(x: 0, y: 0, width: targetWidth, height: targetHeight))
+        context.interpolationQuality = .high
+        context.draw(image, in: imageRect)
+
+        return context.makeImage()
+    }
+}
```

**File**: `rem/TimelineView.swift` (modified, +1/-1)
```diff
@@ -118,7 +118,7 @@ class CustomHostingView: NSHostingView<AnyView> {
     private func configureImageView(with image: NSImage, in frame: NSRect) {
         imageView.image = image
 
-        imageView.imageScaling = .scaleAxesIndependently
+        imageView.imageScaling = .scaleProportionallyUpOrDown
 
         // Configuring frame to account for the offset and scaling
         imageView.frame = CGRect(x: 0, y: 0, width: frame.width, height: frame.height)
```

**File**: `rem/remApp.swift` (modified, +18/-5)
```diff
@@ -89,6 +89,8 @@ class AppDelegate: NSObject, NSApplicationDelegate {
     
     private var lastImageData: Data? = nil
     private var lastActiveApplication: String? = nil
+    
+    private var imageResizer = ImageResizer(targetWidth: Int(NSScreen.main!.frame.width), targetHeight: Int(NSScreen.main!.frame.height))
 
     func applicationDidFinishLaunching(_ notification: Notification) {
         let _ = DatabaseManager.shared
@@ -349,6 +351,7 @@ func drawStatusBarIcon(rect: CGRect) -> Bool {
                 var displayID: CGDirectDisplayID? = nil
                 if let screenID = NSScreen.main?.deviceDescription[NSDeviceDescriptionKey("NSScreenNumber")] as? NSNumber {
                     displayID = CGDirectDisplayID(screenID.uint32Value)
+                    logger.debug("Display ID: \(displayID ?? 999)")
                 }
                 guard displayID != nil else { return }
                 
@@ -358,10 +361,20 @@ func drawStatusBarIcon(rect: CGRect) -> Bool {
                 logger.debug("Active Application: \(activeApplicationName ?? "<undefined>")")
                 
                 // Do we want to record the timeline being searched?
-                guard let image = CGDisplayCreateImage(display.displayID, rect: display.frame) else { return }
+                guard let image = CGDisplayCreateImage(display.displayID) else {
+                    logger.error("Failed to create a screenshot for the display!")
+                    return
+                }
+                guard let resizedImage = imageResizer.resizeAndPad(image: image) else {
+                    logger.error("Failed to resize the image!")
+                    return
+                }
                 
-                let bitmapRep = NSBitmapImageRep(cgImage: image)
-                guard let imageData = bitmapRep.representation(using: .png, properties: [:]) else { return }
+                let bitmapRep = NSBitmapImageRep(cgImage: resizedImage)
+                guard let imageData = bitmapRep.representation(using: .png, properties: [:]) else {
+                    logger.error("Failed to create a PNG from the screenshot!")
+                    return
+                }
                 
                 // Might as well only check if the applications are the same, otherwise obviously different
                 if activeApplicationName != lastActiveApplication || displayImageChangedFromLast(imageData: imageData) {
@@ -371,7 +384,7 @@ func drawStatusBarIcon(rect: CGRect) -> Bool {
                     let frameId = DatabaseManager.shared.insertFrame(activeApplicationName: activeApplicationName)
                     
                     if settingsManager.settings.onlyOCRFrontmostWindow {
-                        // User wants to perform OCR on only active window.
+                        // default: User wants to perform OCR on only active window.
                         
                         // We need to determine the scale factor for cropping.  CGImage is
                         // measured in pixels, display sizes are measured in points.
@@ -384,7 +397,7 @@ func drawStatusBarIcon(rect: CGRect) -> Bool {
                             self.performOCR(frameId: frameId, on: cropped)
                         }
                     } else {
-                        // default: User wants to perform OCR on full display.
+                        // User wants to perform OCR on full display.
                         self.performOCR(frameId: frameId, on: image)
                     }
                     
```

---

### Incident Patch 12: `9439108d` (2024-01-18)
**Commit Message**: Merge branch 'main' into fix-external-monitor-bugs

**File**: `README.md` (modified, +16/-16)
```diff
@@ -9,13 +9,13 @@
   <img style="max-width:300px;" src="https://cdn.loom.com/sessions/thumbnails/091a48b318f04f22bdada62716298948-with-play.gif">
 </a>
 
-An open source approach to locally record everything you view on your Apple Silicon computer.
+An open source approach to locally record everything you view on your Mac (prefer other platforms? come help build [xrem](https://github.com/jasonjmcghee/xrem), cross-platform version of this project).
 
 _Note: Only tested on Apple Silicon, but [there is now an intel build](https://github.com/jasonjmcghee/rem/releases/download/v0.1.11/rem-0.1.11-intel.dmg)_
 
 ---
 
-### This is crazy alpha version (rem could use _your_ help!)
+### This is an early version (rem could use _your_ help!)
 
 Please log any bugs / issues you find!
 
@@ -34,6 +34,20 @@ This is 100% local. Please, read the code yourself.
 
 Also, that means there is no tracking / analytics of any kind, which means I don't know you're running into bugs when you do. So please report any / all you find!
 
+## Features:
+- [x] Automatically take a screenshot every 2 seconds, recognizing all text, using an efficient approach in terms of space and energy
+- [x] Go back in time (full-screen scrubber of everything you've viewed)
+- [x] Copy text from back in time
+- [x] Search everything you've viewed with keyword search (and filter by application)
+- [x] Easily grab recent context for use with LLMs
+- [x] First [Intel build](https://github.com/jasonjmcghee/rem/releases/download/v0.1.11/rem-0.1.11-intel.dmg) (please help test!)
+- [ ] Natural language search / agent interaction via updating local vector embedding
+    - [I've also been exploring novel approaches to vector dbs](https://github.com/jasonjmcghee/portable-hnsw)
+- [ ] Novel search experiences like spatial / similar images
+- [ ] More search filters (by time, etc.)
+- [ ] Fine-grained purging / trimming / selecting recording
+- [ ] Multi-monitor support
+
 ## Getting Started
 
 - [Download the latest release](https://github.com/jasonjmcghee/rem/releases), or build it yourself!
@@ -61,20 +75,6 @@ Also, that means there is no tracking / analytics of any kind, which means I don
 - Custom
 - Copy App
 
-## Currently supports:
-- Going back in time (full-screen scrubber of everything you've viewed)
-- Copy text from back in time
-- Search everything you've viewed (with filter by application)
-- Easily grab recent context for use with LLMs
-
-## Things I'd love to add:
-- [ ] Natural language search / agent interaction via updating local vector embedding
-    - [I've also been exploring novel approaches to vector dbs](https://github.com/jasonjmcghee/portable-hnsw)
-- [ ] Novel search experiences like spatial / similar images
-- [ ] More search filters (by time, etc.)
-- [ ] Fine-grained purging / trimming / selecting recording
-- [ ] Multi-monitor support
-
 ### FAQ
 - Where is my data?
     - Click "Show Me My Data" in the tray / status icon menu
```

---

### Incident Patch 13: `41557f5c` (2024-01-18)
**Commit Message**: fix external monitor bugs, mainly by calling CGDisplayCreateImage without passing the display frame

**File**: `rem.xcodeproj/project.pbxproj` (modified, +4/-0)
```diff
@@ -8,6 +8,7 @@
 
 /* Begin PBXBuildFile section */
 		102CA4C82B3E240C00C3DA2E /* SQLite.framework in Frameworks */ = {isa = PBXBuildFile; fileRef = 96E66BC32B2F5745006E1E97 /* SQLite.framework */; };
+		960AC0242B58D0590050C62A /* ImageResizer.swift in Sources */ = {isa = PBXBuildFile; fileRef = 960AC0232B58D0590050C62A /* ImageResizer.swift */; };
 		961C95DA2B2E19B30093F228 /* remApp.swift in Sources */ = {isa = PBXBuildFile; fileRef = 961C95D92B2E19B30093F228 /* remApp.swift */; };
 		961C95DC2B2E19B30093F228 /* ContentView.swift in Sources */ = {isa = PBXBuildFile; fileRef = 961C95DB2B2E19B30093F228 /* ContentView.swift */; };
 		961C95E12B2E19B40093F228 /* Preview Assets.xcassets in Resources */ = {isa = PBXBuildFile; fileRef = 961C95E02B2E19B40093F228 /* Preview Assets.xcassets */; };
@@ -193,6 +194,7 @@
 /* End PBXCopyFilesBuildPhase section */
 
 /* Begin PBXFileReference section */
+		960AC0232B58D0590050C62A /* ImageResizer.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = ImageResizer.swift; sourceTree = "<group>"; };
 		961C95D62B2E19B30093F228 /* rem.app */ = {isa = PBXFileReference; explicitFileType = wrapper.application; includeInIndex = 0; path = rem.app; sourceTree = BUILT_PRODUCTS_DIR; };
 		961C95D92B2E19B30093F228 /* remApp.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = remApp.swift; sourceTree = "<group>"; };
 		961C95DB2B2E19B30093F228 /* ContentView.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = ContentView.swift; sourceTree = "<group>"; };
@@ -289,6 +291,7 @@
 				969F3F092B3B7F760085787B /* Info.plist */,
 				961C96122B2EB7DB0093F228 /* TimelineView.swift */,
 				BF5FEBFA2B44B26800744FC2 /* ImageHelper.swift */,
+				960AC0232B58D0590050C62A /* ImageResizer.swift */,
 				961C95D92B2E19B30093F228 /* remApp.swift */,
 				961C95DB2B2E19B30093F228 /* ContentView.swift */,
 				961C95DD2B2E19B40093F228 /* Assets.xcassets */,
@@ -656,6 +659,7 @@
 			isa = PBXSourcesBuildPhase;
 			buildActionMask = 2147483647;
 			files = (
+				960AC0242B58D0590050C62A /* ImageResizer.swift in Sources */,
 				961C95DC2B2E19B30093F228 /* ContentView.swift in Sources */,
 				961C96152B2EBEE50093F228 /* DB.swift in Sources */,
 				96B0DA3A2B3A08280030E8AE /* TextMerger.swift in Sources */,
```

**File**: `rem.xcodeproj/xcuserdata/jason.xcuserdatad/xcschemes/xcschememanagement.plist` (modified, +47/-5)
```diff
@@ -9,31 +9,73 @@
 			<key>isShown</key>
 			<false/>
 			<key>orderHint</key>
-			<integer>6</integer>
+			<integer>7</integer>
 		</dict>
 		<key>SQLite (Playground) 2.xcscheme</key>
 		<dict>
 			<key>isShown</key>
 			<false/>
 			<key>orderHint</key>
-			<integer>7</integer>
+			<integer>8</integer>
+		</dict>
+		<key>SQLite (Playground) 3.xcscheme</key>
+		<dict>
+			<key>isShown</key>
+			<false/>
+			<key>orderHint</key>
+			<integer>9</integer>
+		</dict>
+		<key>SQLite (Playground) 4.xcscheme</key>
+		<dict>
+			<key>isShown</key>
+			<false/>
+			<key>orderHint</key>
+			<integer>10</integer>
+		</dict>
+		<key>SQLite (Playground) 5.xcscheme</key>
+		<dict>
+			<key>isShown</key>
+			<false/>
+			<key>orderHint</key>
+			<integer>11</integer>
+		</dict>
+		<key>SQLite (Playground) 6.xcscheme</key>
+		<dict>
+			<key>isShown</key>
+			<false/>
+			<key>orderHint</key>
+			<integer>12</integer>
+		</dict>
+		<key>SQLite (Playground) 7.xcscheme</key>
+		<dict>
+			<key>isShown</key>
+			<false/>
+			<key>orderHint</key>
+			<integer>13</integer>
+		</dict>
+		<key>SQLite (Playground) 8.xcscheme</key>
+		<dict>
+			<key>isShown</key>
+			<false/>
+			<key>orderHint</key>
+			<integer>14</integer>
 		</dict>
 		<key>SQLite (Playground).xcscheme</key>
 		<dict>
 			<key>isShown</key>
 			<false/>
 			<key>orderHint</key>
-			<integer>5</integer>
+			<integer>6</integer>
 		</dict>
 		<key>ffmpegX.xcscheme_^#shared#^_</key>
 		<dict>
 			<key>orderHint</key>
-			<integer>5</integer>
+			<integer>4</integer>
 		</dict>
 		<key>rem.xcscheme_^#shared#^_</key>
 		<dict>
 			<key>orderHint</key>
-			<integer>4</integer>
+			<integer>5</integer>
 		</dict>
 	</dict>
 </dict>
```

**File**: `rem/ImageResizer.swift` (added, +42/-0)
```diff
@@ -0,0 +1,42 @@
+//
+//  ImageResizer.swift
+//  rem
+//
+//  Created by Jason McGhee on 1/17/24.
+//
+
+import Foundation
+import Cocoa
+
+class ImageResizer {
+    private var context: CGContext
+    private let targetWidth: CGFloat
+    private let targetHeight: CGFloat
+
+    init(targetWidth: Int, targetHeight: Int) {
+        self.targetWidth = CGFloat(targetWidth)
+        self.targetHeight = CGFloat(targetHeight)
+
+        let colorSpace = CGColorSpaceCreateDeviceRGB()
+        let bitmapInfo = CGImageAlphaInfo.premultipliedLast.rawValue
+        context = CGContext(data: nil, width: targetWidth, height: targetHeight, bitsPerComponent: 8, bytesPerRow: 0, space: colorSpace, bitmapInfo: bitmapInfo)!
+    }
+
+    func resizeAndPad(image: CGImage) -> CGImage? {
+        let widthScaleRatio = targetWidth / CGFloat(image.width)
+        let heightScaleRatio = targetHeight / CGFloat(image.height)
+        let scaleFactor = min(widthScaleRatio, heightScaleRatio)
+
+        let scaledWidth = CGFloat(image.width) * scaleFactor
+        let scaledHeight = CGFloat(image.height) * scaleFactor
+        let imageRect = CGRect(x: (targetWidth - scaledWidth) / 2, y: (targetHeight - scaledHeight) / 2, width: scaledWidth, height: scaledHeight)
+
+        context.clear(CGRect(x: 0, y: 0, width: targetWidth, height: targetHeight))
+        context.setFillColor(NSColor.black.cgColor)
+        context.fill(CGRect(x: 0, y: 0, width: targetWidth, height: targetHeight))
+        context.interpolationQuality = .high
+        context.draw(image, in: imageRect)
+
+        return context.makeImage()
+    }
+}
```

**File**: `rem/TimelineView.swift` (modified, +1/-1)
```diff
@@ -118,7 +118,7 @@ class CustomHostingView: NSHostingView<AnyView> {
     private func configureImageView(with image: NSImage, in frame: NSRect) {
         imageView.image = image
 
-        imageView.imageScaling = .scaleAxesIndependently
+        imageView.imageScaling = .scaleProportionallyUpOrDown
 
         // Configuring frame to account for the offset and scaling
         imageView.frame = CGRect(x: 0, y: 0, width: frame.width, height: frame.height)
```

**File**: `rem/remApp.swift` (modified, +18/-5)
```diff
@@ -89,6 +89,8 @@ class AppDelegate: NSObject, NSApplicationDelegate {
     
     private var lastImageData: Data? = nil
     private var lastActiveApplication: String? = nil
+    
+    private var imageResizer = ImageResizer(targetWidth: Int(NSScreen.main!.frame.width), targetHeight: Int(NSScreen.main!.frame.height))
 
     func applicationDidFinishLaunching(_ notification: Notification) {
         let _ = DatabaseManager.shared
@@ -349,6 +351,7 @@ func drawStatusBarIcon(rect: CGRect) -> Bool {
                 var displayID: CGDirectDisplayID? = nil
                 if let screenID = NSScreen.main?.deviceDescription[NSDeviceDescriptionKey("NSScreenNumber")] as? NSNumber {
                     displayID = CGDirectDisplayID(screenID.uint32Value)
+                    logger.debug("Display ID: \(displayID ?? 999)")
                 }
                 guard displayID != nil else { return }
                 
@@ -358,10 +361,20 @@ func drawStatusBarIcon(rect: CGRect) -> Bool {
                 logger.debug("Active Application: \(activeApplicationName ?? "<undefined>")")
                 
                 // Do we want to record the timeline being searched?
-                guard let image = CGDisplayCreateImage(display.displayID, rect: display.frame) else { return }
+                guard let image = CGDisplayCreateImage(display.displayID) else {
+                    logger.error("Failed to create a screenshot for the display!")
+                    return
+                }
+                guard let resizedImage = imageResizer.resizeAndPad(image: image) else {
+                    logger.error("Failed to resize the image!")
+                    return
+                }
                 
-                let bitmapRep = NSBitmapImageRep(cgImage: image)
-                guard let imageData = bitmapRep.representation(using: .png, properties: [:]) else { return }
+                let bitmapRep = NSBitmapImageRep(cgImage: resizedImage)
+                guard let imageData = bitmapRep.representation(using: .png, properties: [:]) else {
+                    logger.error("Failed to create a PNG from the screenshot!")
+                    return
+                }
                 
                 // Might as well only check if the applications are the same, otherwise obviously different
                 if activeApplicationName != lastActiveApplication || displayImageChangedFromLast(imageData: imageData) {
@@ -371,7 +384,7 @@ func drawStatusBarIcon(rect: CGRect) -> Bool {
                     let frameId = DatabaseManager.shared.insertFrame(activeApplicationName: activeApplicationName)
                     
                     if settingsManager.settings.onlyOCRFrontmostWindow {
-                        // User wants to perform OCR on only active window.
+                        // default: User wants to perform OCR on only active window.
                         
                         // We need to determine the scale factor for cropping.  CGImage is
                         // measured in pixels, display sizes are measured in points.
@@ -384,7 +397,7 @@ func drawStatusBarIcon(rect: CGRect) -> Bool {
                             self.performOCR(frameId: frameId, on: cropped)
                         }
                     } else {
-                        // default: User wants to perform OCR on full display.
+                        // User wants to perform OCR on full display.
                         self.performOCR(frameId: frameId, on: image)
                     }
                     
```

---

### Incident Patch 14: `b3f20574` (2024-01-13)
**Commit Message**: fix sqlite to use latest commit

**File**: `SQLite.swift` (modified, +1/-1)
```diff
@@ -1 +1 @@
-Subproject commit 3d25271a74098d30f3936d84ec1004d6b785d6cd
+Subproject commit fda37eff5d418c8ef5cc72dd88d77f5184bfe8dc
```

---

### Incident Patch 15: `65748c03` (2024-01-13)
**Commit Message**: Merge pull request #73 from jasonjmcghee/fix-sqlite-defaults

Update to use our forked SQLite.swift

**File**: `.gitmodules` (modified, +2/-2)
```diff
@@ -1,4 +1,4 @@
 [submodule "SQLite.swift"]
 	path = SQLite.swift
-	url = https://github.com/stephencelis/SQLite.swift
-	branch = master
\ No newline at end of file
+	url = https://github.com/jasonjmcghee/SQLite.swift
+	branch = main
```

**File**: `README.md` (modified, +0/-1)
```diff
@@ -56,7 +56,6 @@ Also, that means there is no tracking / analytics of any kind, which means I don
 
 - Clone the repo `git clone --recursive -j8 https://github.com/jasonjmcghee/rem.git` or run `git submodule update --init --recursive` after cloning
 - Open project in Xcode
-- Change default SQLite.Swift sdk architecture to macOS <img width="1512" alt="Screenshot 2023-12-28 at 5 38 19 PM" src="https://github.com/ruslanjabari/rem/assets/59275080/63c08975-0bd2-4fe8-91ca-0b9406d44704">
 - Product > Archive
 - Distribute App
 - Custom
```

#### Recent Merged Pull Requests:
- **PR #113** (closed): Claude/production readiness review 0t1 k3 (@gokulsvision)
- **PR #96** (2024-05-16): startScreenCapture in loop (@cparish312)
- **PR #95** (2024-05-08): retryScreenshot for more Robust screenshot loop (@cparish312)
- **PR #94** (2024-05-03): Store OCR Locations (@cparish312)
- **PR #93** (2024-05-03): Active Display by Mouse Location (@cparish312)
- **PR #92** (2024-04-30): Convert frameId to chunksFramesIndex before passing from search to TL and fix search results missing frames with offset of 29 (@cparish312)
- **PR #90** (2024-04-29): Fix chunk indexing (@cparish312)
- **PR #89** (2024-04-26): [rem-88]: Ensures the backing scaling factor is taken into account (@jasonjmcghee)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

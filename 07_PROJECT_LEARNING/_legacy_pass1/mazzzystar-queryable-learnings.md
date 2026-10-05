# Forensic Learning Record (Deep Inspection): mazzzystar/Queryable

> **Canonical Artifact**: `07_PROJECT_LEARNING/mazzzystar-queryable-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/mazzzystar/Queryable](https://github.com/mazzzystar/Queryable))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-04T20:34:50.778Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `mazzzystar/Queryable`
- **Description**: Run OpenAI's CLIP and Apple's MobileCLIP model on iOS to search photos.
- **Primary Language / Ecosystem**: Swift
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 2989 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `Queryable/Queryable/CLIP/ImgEncoder.swift`
```
//
//  ImgEncoder.swift
//  Queryable
//
//  Created by Ke Fang on 2022/12/08.
//

import Foundation
import CoreML
import CoreImage
import UIKit

public struct ImgEncoder {
    var model: MLModel

    /// Shared CIContext for GPU-accelerated image processing
    private static let ciContext = CIContext(options: [.useSoftwareRenderer: false])

    /// Shared pixel buffer pool to recycle IOSurface-backed buffers (prevents hitting the 16384 limit)
    private static var bufferPool: CVPixelBufferPool? = {
        let poolAttrs: [String: Any] = [
            kCVPixelBufferPoolMinimumBufferCountKey as String: 4
        ]
        let bufferAttrs: [String: Any] = [
            kCVPixelBufferWidthKey as String: 256,
            kCVPixelBufferHeightKey as String: 256,
            kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32ARGB,
            kCVPixelBufferCGImageCompatibilityKey as String: true,
            kCVPixelBufferCGBitmapContextCompatibilityKey as String: true
        ]
        var pool: CVPixelBufferPool?
        CVPixelBufferPoolCreate(kCFAllocatorDefault, poolAttrs as CFDictionary, bufferAttrs as CFDictionary, &pool)
        return pool
    }()

    /// Flush idle buffers from the pool so the OS can reclaim their IOSurfaces.
    static func flushBufferPool() {
        if let pool = bufferPool {
            CVPixelBufferPoolFlush(pool, CVPixelBufferPoolFlushFlags(rawValue: 0))
        }
    }

    /// Deep-copy an MLShapedArray's scalar data into a fresh, heap-backed MLMultiArray.
    /// CoreML prediction outputs are backed by IOSurface memory; MLShapedArray(converting:)
    /// and MLMultiArray(shapedArray) may share that IOSurface storage rather than copying.
    /// Storing those wrappers in savedEmbedding means each embedding retains an IOSurface,
    /// hitting the per-process 16384 IOSurface limit at ~15800 embeddings.
    /// This method breaks that chain by memcpy-ing the floats into plain heap memory.
    static func detachFromIOSurface(_ shapedArray: MLShapedArray<Float32>) -> MLMultiArray {
        let count = shapedArray.scalarCount
        let heapArray = try! MLMultiArray(shape: [1, NSNumber(value: count)], dataType: .float32)
        let dst = heapArray.dataPointer.assumingMemoryBound(to: Float32.self)
        shapedArray.withUnsafeShapedBufferPointer { ptr, _, _ in
            dst.update(from: ptr.baseAddress!, count: count)
        }
        return heapArray
    }

    init(resourcesAt baseURL: URL,
         configuration config: MLModelConfiguration = .init()
    ) throws {
        let imgEncoderURL = baseURL.appending(path: "ImageEncoder_mobileCLIP_s2.mlmodelc")
        let imgEncoderModel = try MLModel(contentsOf: imgEncoderURL, configuration: config)
        self.model = imgEncoderModel
    }

    public func computeImgEmbedding(img: UIImage) async throws -> MLShapedArray<Float32> {
        let imgEmbedding = try await self.encode(image: img)
        return imgEmbedding
    }

    /// Prediction queue
    let queue = DispatchQueue(label: "imgencoder.predict")

    public func encode(image: UIImage) async throws -> MLShapedArray<Float32> {
        do {
            guard let buffer = Self.resizeAndConvertToBuffer(image: image, size: CGSize(width: 256, height: 256)) else {
                throw ImageEncodingError.bufferConversionError
            }

            guard let inputFeatures = try? MLDictionaryFeatureProvider(dictionary: ["colorImage": buffer]) else {
                throw ImageEncodingError.featureProviderError
            }

            let result = try queue.sync { try model.prediction(from: inputFeatures) }
            guard let embeddingFeature = result.featureValue(for: "embOutput"),
                  let multiArray = embeddingFeature.multiArrayValue else {
                throw ImageEncodingError.predictionError
            }

            return MLShapedArray<Float32>(converting: multiArray)
        } catch {
            print("Error in encoding: \(error)")
            throw error
        }
    }

    /// Batch prediction: encode multiple images in one CoreML call.
    /// Uses MLArrayBatchProvider for efficient Neural Engine pipelining.
    /// All CoreML intermediates are scoped inside autoreleasepool to release
    /// Neural Engine IOSurface allocations promptly between batches.
    public func encodeBatch(images: [UIImage]) throws -> [MLShapedArray<Float32>] {
        let targetSize = CGSize(width: 256, height: 256)

        var embeddings = [MLShapedArray<Float32>]()
        embeddings.reserveCapacity(images.count)

        // autoreleasepool ensures CoreML's IOSurface-backed MLMultiArrays
        // and Espresso intermediates are released before the next batch
        try autoreleasepool {
            var featureProviders = [MLFeatureProvider]()
            featureProviders.reserveCapacity(images.count)

            for image in images {
                guard let buffer = Self.resizeAndConvertToBuffer(image: image, size: targetSize) else {
                    throw ImageEncodingError.bufferConversionError
                }
                let features = try MLDictionaryFeatureProvider(dictionary: ["colorImage": buffer])
                featureProviders.append(features)
            }

            let batchProvider = MLArrayBatchProvider(array: featureProviders)

            // Single batch prediction call — Neural Engine handles pipelining
            let batchResults = try queue.sync { try model.predictions(fromBatch: batchProvider) }

            for i in 0..<batchResults.count {
                let result = batchResults.features(at: i)
                guard let embeddingFeature = result.featureValue(for: "embOutput"),
                      let multiArray = embeddingFeature.multiArrayValue else {
                    throw ImageEncodingError.predictionError
                }
                embeddings.append(MLShapedArray<Float32>(converting: multiArray))
            }
        }

        return embeddings
    }

    /// GPU-accelerated image resize using CoreImage CILanczosScaleTransform,
    /// then render directly to a pooled CVPixelBuffer.
    private static func resizeAndConvertToBuffer(image: UIImage, size: CGSize) -> CVPixelBuffer? {
        guard let cgImage = image.cgImage else { return nil }

        let ciImage = CIImage(cgImage: cgImage)
        let scaleX = size.width / ciImage.extent.width
        let scaleY = size.height / ciImage.extent.height

        guard let filter = CIFilter(name: "CILanczosScaleTransform") else { return nil }
        filter.setValue(ciImage, forKey: kCIInputImageKey)
        filter.setValue(scaleY, forKey: kCIInputScaleKey)
        filter.setValue(scaleX / scaleY, forKey: kCIInputAspectRatioKey)

        guard let outputImage = filter.outputImage else { return nil }

        // Get a recycled buffer from the pool (avoids IOSurface exhaustion during batch indexing)
        var pixelBuffer: CVPixelBuffer?
        if let pool = bufferPool {
            let status = CVPixelBufferPoolCreatePixelBuffer(kCFAllocatorDefault, pool, &pixelBuffer)
            guard status == kCVReturnSuccess, let buffer = pixelBuffer else { return nil }
            ciContext.render(outputImage, to: buffer)
            return buffer
        }

        // Fallback: create standalone buffer if pool init failed
        let attrs: [String: Any] = [
            kCVPixelBufferCGImageCompatibilityKey as String: true,
            kCVPixelBufferCGBitmapContextCompatibilityKey as String: true
        ]
        let status = CVPixelBufferCreate(
            kCFAllocatorDefault,
            Int(size.width), Int(size.height),
            kCVPixelFormatType_32ARGB,
            attrs as CFDictionary,
            &pixelBuffer
        )
        guard status == kCVReturnSuccess, let buffer = pixelBuffer else { return nil }
        ciContext.render(outputImage, to: buffer)
        return buffer
    }
}

// Define the custom errors
enum ImageEncodingError: Error {
    case resizeError
    case bufferConversionError
    case featureProviderError
    case predictionError
}

```

### Core Architecture Module: `Queryable/Queryable/CLIP/TextEncoder.swift`
```
// For licensing see accompanying LICENSE.md file.
// Copyright (C) 2022 Apple Inc. All Rights Reserved.

import Foundation
import CoreML

#if os(iOS)
import UIKit
#endif

///  A model for encoding text
public struct TextEncoder {

    /// Text tokenizer
    var tokenizer: BPETokenizer

    /// Embedding model
    var model: MLModel
    
    init(resourcesAt baseURL: URL,
         configuration config: MLModelConfiguration = .init()
    ) throws {
        let textEncoderURL = baseURL.appending(path: "TextEncoder_mobileCLIP_s2.mlmodelc")
        let vocabURL = baseURL.appending(path: "vocab.json")
        let mergesURL = baseURL.appending(path: "merges.txt")
        
#if os(iOS)
        // Fallback to CPU only to avoid NN compute error on iPhone < 11 and iPad < 9th gen
        if !UIDevice.chipIsA13OrLater() {
            config.computeUnits = .cpuOnly
        }
#endif

        // Text tokenizer and encoder
        let tokenizer = try BPETokenizer(mergesAt: mergesURL, vocabularyAt: vocabURL)
        let textEncoderModel = try MLModel(contentsOf: textEncoderURL, configuration: config)
        
        self.tokenizer = tokenizer
        self.model = textEncoderModel
    }
    
    public func computeTextEmbedding(prompt: String) throws -> MLShapedArray<Float32> {
        let promptEmbedding = try self.encode(prompt)
        return promptEmbedding
    }
    
    /**
    /// Creates text encoder which embeds a tokenized string
    ///
    /// - Parameters:
    ///   - tokenizer: Tokenizer for input text
    ///   - model: Model for encoding tokenized text
    public init(tokenizer: BPETokenizer, model: MLModel) {
        self.tokenizer = tokenizer
        self.model = model
    }
     */

    /// Encode input text/string
    ///
    ///  - Parameters:
    ///     - text: Input text to be tokenized and then embedded
    ///  - Returns: Embedding representing the input text
    private func encode(_ text: String) throws -> MLShapedArray<Float32> {

        // Get models expected input length
        let inputLength = inputShape.last!

        // Tokenize, padding to the expected length
        var (tokens, ids) = tokenizer.tokenize(input: text, minCount: inputLength)

        // Truncate if necessary
        if ids.count > inputLength {
            tokens = tokens.dropLast(tokens.count - inputLength)
            ids = ids.dropLast(ids.count - inputLength)
            let truncated = tokenizer.decode(tokens: tokens)
            print("Needed to truncate input '\(text)' to '\(truncated)'")
        }

        // Use the model to generate the embedding
        return try encode(ids: ids)
    }

    /// Prediction queue
    let queue = DispatchQueue(label: "textencoder.predict")

    func encode(ids: [Int]) throws -> MLShapedArray<Float32> {
        let inputName = inputDescription.name
        let inputShape = inputShape

        let floatIds = ids.map { Float32($0) }
        let inputArray = MLShapedArray<Float32>(scalars: floatIds, shape: inputShape)
        let inputFeatures = try! MLDictionaryFeatureProvider(
            dictionary: [inputName: MLMultiArray(inputArray)])

        let result = try queue.sync { try model.prediction(from: inputFeatures) }
        let embeddingFeature = result.featureValue(for: "text_embeddings")
        return MLShapedArray<Float32>(converting: embeddingFeature!.multiArrayValue!)
    }

    var inputDescription: MLFeatureDescription {
        model.modelDescription.inputDescriptionsByName.first!.value
    }

    var inputShape: [Int] {
        inputDescription.multiArrayConstraint!.shape.map { $0.intValue }
    }

}

```

### Core Architecture Module: `Queryable/Queryable/CLIP/Tokenizer/BPETokenizer+Reading.swift`
```
// For licensing see accompanying LICENSE.md file.
// Copyright (C) 2022 Apple Inc. All Rights Reserved.

import Foundation

extension BPETokenizer {
    enum FileReadError: Error {
        case invalidMergeFileLine(Int)
    }

    /// Read vocab.json file at URL into a dictionary mapping a String to its Int token id
    static func readVocabulary(url: URL) throws -> [String: Int] {
        let content = try Data(contentsOf: url)
        return try JSONDecoder().decode([String: Int].self, from: content)
    }

    /// Read merges.txt file at URL into a dictionary mapping bigrams to the line number/rank/priority
    static func readMerges(url: URL) throws -> [TokenPair: Int] {
        let content = try String(contentsOf: url)
        let lines = content.split(separator: "\n")

        let merges: [(TokenPair, Int)] = try lines.enumerated().compactMap { (index, line) in
            if line.hasPrefix("#") {
                return nil
            }
            let pair = line.split(separator: " ")
            if pair.count != 2 {
                throw FileReadError.invalidMergeFileLine(index+1)
            }
            return (TokenPair(String(pair[0]), String(pair[1])),index)
        }
        return [TokenPair : Int](uniqueKeysWithValues: merges)
    }
}

```

### Core Architecture Module: `Queryable/Queryable/CLIP/Tokenizer/BPETokenizer.swift`
```
// For licensing see accompanying LICENSE.md file.
// Copyright (C) 2022 Apple Inc. All Rights Reserved.

import Foundation

/// A tokenizer based on byte pair encoding.
public struct BPETokenizer {
    /// A dictionary that maps pairs of tokens to the rank/order of the merge.
    let merges: [TokenPair : Int]

    /// A dictionary from of tokens to identifiers.
    let vocabulary: [String: Int]

    /// The start token.
    let startToken: String = "<|startoftext|>"

    /// The end token.
    let endToken: String = "<|endoftext|>"

    /// The token used for padding
    let padToken: String = "[PAD]"

    /// The unknown token.
    let unknownToken: String = "[UNK]"

    var unknownTokenID: Int {
        vocabulary[unknownToken, default: 0]
    }
    
    var padTokenID: Int {
        vocabulary[padToken, default: 0]
    }

    /// Creates a tokenizer.
    ///
    /// - Parameters:
    ///   - merges: A dictionary that maps pairs of tokens to the rank/order of the merge.
    ///   - vocabulary: A dictionary from of tokens to identifiers.
    public init(merges: [TokenPair: Int], vocabulary: [String: Int]) {
        self.merges = merges
        self.vocabulary = vocabulary
    }

    /// Creates a tokenizer by loading merges and vocabulary from URLs.
    ///
    /// - Parameters:
    ///   - mergesURL: The URL of a text file containing merges.
    ///   - vocabularyURL: The URL of a JSON file containing the vocabulary.
    public init(mergesAt mergesURL: URL, vocabularyAt vocabularyURL: URL) throws {
        self.merges = try Self.readMerges(url: mergesURL)
        self.vocabulary = try! Self.readVocabulary(url: vocabularyURL)
    }

    /// Tokenizes an input string.
    ///
    /// - Parameters:
    ///   - input: A string.
    ///   - minCount: The minimum number of tokens to return.
    /// - Returns: An array of tokens and an array of token identifiers.
    public func tokenize(input: String, minCount: Int? = nil) -> (tokens: [String], tokenIDs: [Int]) {
        var tokens: [String] = []

        tokens.append(startToken)
        tokens.append(contentsOf: encode(input: input))
        tokens.append(endToken)

        // Pad if there was a min length specified
        if let minLen = minCount, minLen > tokens.count {
            tokens.append(contentsOf: repeatElement(padToken, count: minLen - tokens.count))
        }

        let ids = tokens.map({ vocabulary[$0, default: unknownTokenID] })
        return (tokens: tokens, tokenIDs: ids)
    }

    /// Returns the token identifier for a token.
    public func tokenID(for token: String) -> Int? {
        vocabulary[token]
    }

    /// Returns the token for a token identifier.
    public func token(id: Int) -> String? {
        vocabulary.first(where: { $0.value == id })?.key
    }

    /// Decodes a sequence of tokens into a fully formed string
    public func decode(tokens: [String]) -> String {
        String(tokens.joined())
            .replacingOccurrences(of: "</w>", with: " ")
            .replacingOccurrences(of: startToken, with: "")
            .replacingOccurrences(of: endToken, with: "")
    }

    /// Encode an input string to a sequence of tokens
    func encode(input: String) -> [String] {
        let normalized = input.basicClean()
        let words = normalized.split(separator: " ")
        return words.flatMap({ encode(word: $0) })
    }

    /// Encode a single word into a sequence of tokens
    func encode(word: Substring) -> [String] {
        var tokens = word.map { String($0) }
        if let last = tokens.indices.last {
            tokens[last] = tokens[last] + "</w>"
        }

        while true {
            let pairs = pairs(for: tokens)
            let canMerge = pairs.filter { merges[$0] != nil }

            if canMerge.isEmpty {
                break
            }

            // If multiple merges are found, use the one with the lowest rank
            let shouldMerge = canMerge.min { merges[$0]! < merges[$1]! }!
            tokens = update(tokens, merging: shouldMerge)
        }
        return tokens
    }

    /// Get  the set of adjacent pairs / bigrams from a sequence of tokens
    func pairs(for tokens: [String]) -> Set<TokenPair> {
        guard tokens.count > 1 else {
            return Set()
        }

        var pairs = Set<TokenPair>(minimumCapacity: tokens.count - 1)
        var prev = tokens.first!
        for current in tokens.dropFirst() {
            pairs.insert(TokenPair(prev, current))
            prev = current
        }
        return pairs
    }

    /// Update the sequence of tokens by greedily merging instance of a specific bigram
    func update(_ tokens: [String], merging bigram: TokenPair) -> [String] {
        guard tokens.count > 1 else {
            return []
        }

        var newTokens = [String]()
        newTokens.reserveCapacity(tokens.count - 1)

        var index = 0
        while index < tokens.count {
            let remainingTokens = tokens[index...]
            if let startMatchIndex = remainingTokens.firstIndex(of: bigram.first) {
                // Found a possible match, append everything before it
                newTokens.append(contentsOf: tokens[index..<startMatchIndex])

                if index < tokens.count - 1 && tokens[startMatchIndex + 1] == bigram.second {
                    // Full match, merge
                    newTokens.append(bigram.first + bigram.second)
                    index = startMatchIndex + 2
                } else {
                    // Only matched the first, no merge
                    newTokens.append(bigram.first)
                    index = startMatchIndex + 1
                }
            } else {
                // Didn't find any more matches, append the rest unmerged
                newTokens.append(contentsOf: remainingTokens)
                break
            }
        }
        return newTokens
    }
}

extension BPETokenizer {

    /// A hashable tuple of strings
    public struct TokenPair: Hashable {
        let first: String
        let second: String

        init(_ first: String, _ second: String) {
            self.first = first
            self.second = second
        }
    }
}


extension String {
    func basicClean() -> String {
        // Mimic Python's `basic_clean` and `whitespace_clean`
        let cleaned = self.trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()  // Python example used `.lower()`
            .replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
        return cleaned
    }
}

```

### Core Architecture Module: `Queryable/Queryable/Model/Embedding.swift`
```
//
//  Embedding.swift
//  Queryable
//
//  Created by Ke Fang on 2022/12/20.
//

import Foundation
import CoreML

class Embedding: NSObject, NSSecureCoding {
    static var supportsSecureCoding: Bool = true
    
    var id: String?
    var embedding: MLMultiArray?
    
    init(id: String, embedding: MLMultiArray) {
        self.id = id
        self.embedding = embedding
    }
    
    func encode(with aCoder: NSCoder) {
        aCoder.encode(self.id, forKey: "id")
        aCoder.encode(self.embedding, forKey: "embedding")
    }
    
    required init?(coder aDecoder: NSCoder) {
        self.id = aDecoder.decodeObject(forKey: "id") as? String
        self.embedding = aDecoder.decodeObject(forKey: "embedding") as? MLMultiArray
    }
}

```

### Core Architecture Module: `Queryable/Queryable/Model/EmbeddingStore.swift`
```
//
//  EmbeddingStore.swift
//  Queryable
//
//  Efficient binary embedding storage with incremental saves.
//  Replaces NSKeyedArchiver full-file rewrites with append-only journal + tombstones.
//
//  File format (v1):
//    Header:  "QEMB" (4 bytes) + version UInt32 + count UInt32
//    Record:  idLength UInt16 + id UTF-8 bytes + embedding Float32[512]
//
//  Journal file: same record format, no header (append-only for new embeddings)
//  Tombstone file: newline-separated IDs of deleted embeddings
//

import Foundation
import CoreML

/// @unchecked Sendable: all stored properties are immutable after init (let).
/// loadAll() is a pure reader that returns a fresh dictionary with no shared mutable state,
/// so it is safe to call from a detached Task. Write methods (appendNew, markDeleted, etc.)
/// are only called from the @MainActor-isolated PhotoSearcher, so no concurrent writes occur.
class EmbeddingStore: @unchecked Sendable {
    private let embeddingDim = 512
    private let headerMagic: [UInt8] = [0x51, 0x45, 0x4D, 0x42] // "QEMB"
    private let formatVersion: UInt32 = 1
    private let recordEmbeddingSize: Int // 512 * 4 = 2048

    private let mainFileName: String
    private let journalFileName: String
    private let tombstoneFileName: String
    private let legacyFileName: String
    private let baseDir: URL

    init(baseName: String = "imageEmbedding") {
        self.recordEmbeddingSize = embeddingDim * MemoryLayout<Float32>.size
        self.mainFileName = "\(baseName).qemb"
        self.journalFileName = "\(baseName)_journal.qemb"
        self.tombstoneFileName = "\(baseName)_tombstones.txt"
        self.legacyFileName = baseName
        self.baseDir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
    }

    // MARK: - Load

    /// Load all embeddings. Tries new binary format first, falls back to legacy NSKeyedArchiver.
    /// Returns nil if no data exists.
    func loadAll() -> [String: MLMultiArray]? {
        let mainPath = baseDir.appendingPathComponent(mainFileName)
        let journalPath = baseDir.appendingPathComponent(journalFileName)
        let legacyPath = baseDir.appendingPathComponent(legacyFileName)

        if FileManager.default.fileExists(atPath: mainPath.path) ||
           FileManager.default.fileExists(atPath: journalPath.path) {
            return loadFromBinaryFormat()
        } else if FileManager.default.fileExists(atPath: legacyPath.path) {
            // Migrate from legacy format
            print("[EmbeddingStore] Migrating from legacy NSKeyedArchiver format...")
            if let embeddings = loadFromLegacy() {
                // Save in new format
                if saveAll(embeddings) {
                    // Remove legacy file after successful migration
                    try? FileManager.default.removeItem(at: legacyPath)
                    print("[EmbeddingStore] Migration complete. Legacy file removed.")
                }
                return embeddings
            }
        }

        return nil
    }

    /// Load from the new binary format (main file + journal - tombstones).
    private func loadFromBinaryFormat() -> [String: MLMultiArray]? {
        let startTime = Date()
        var embeddings = [String: MLMultiArray]()

        // Load main file
        let mainPath = baseDir.appendingPathComponent(mainFileName)
        if let mainData = try? Data(contentsOf: mainPath) {
            readRecordsFromBinary(mainData, hasHeader: true, into: &embeddings)
        }

        // Load journal (incremental additions)
        let journalPath = baseDir.appendingPathComponent(journalFileName)
        if let journalData = try? Data(contentsOf: journalPath) {
            readRecordsFromBinary(journalData, hasHeader: false, into: &embeddings)
        }

        // Apply tombstones (deletions)
        let tombstones = loadTombstones()
        for id in tombstones {
            embeddings.removeValue(forKey: id)
        }

        print("[EmbeddingStore] Loaded \(embeddings.count) embeddings in \(String(format: "%.3f", Date().timeIntervalSince(startTime)))s")
        return embeddings.isEmpty ? nil : embeddings
    }

    /// Load from legacy NSKeyedArchiver format.
    private func loadFromLegacy() -> [String: MLMultiArray]? {
        let filePath = baseDir.appendingPathComponent(legacyFileName)
        do {
            let startTime = Date()
            let data = try Data(contentsOf: filePath)
            let decoded = try NSKeyedUnarchiver.unarchivedArrayOfObjects(
                ofClasses: [Embedding.self, MLMultiArray.self, NSString.self],
                from: data
            ) as? [Embedding]

            var embeddings = [String: MLMultiArray]()
            for emb in decoded ?? [] {
                if let id = emb.id, let embedding = emb.embedding {
                    embeddings[id] = embedding
                }
            }

            print("[EmbeddingStore] Loaded \(embeddings.count) legacy embeddings in \(String(format: "%.3f", Date().timeIntervalSince(startTime)))s")
            return embeddings.isEmpty ? nil : embeddings
        } catch {
            print("[EmbeddingStore] Failed to load legacy format: \(error)")
            return nil
        }
    }

    // MARK: - Save

    /// Full save: write all embeddings to the main file, clear journal and tombstones.
    @discardableResult
    func saveAll(_ embeddings: [String: MLMultiArray]) -> Bool {
        let startTime = Date()
        let mainPath = baseDir.appendingPathComponent(mainFileName)

        var data = Data()
        // Header
        data.append(contentsOf: headerMagic)
        var version = formatVersion
        data.append(Data(bytes: &version, count: 4))
        var count = UInt32(embeddings.count)
        data.append(Data(bytes: &count, count: 4))

        // Records
        for (id, mlArray) in embeddings {
            appendRecord(id: id, mlArray: mlArray, to: &data)
        }

        do {
            try data.write(to: mainPath, options: .atomic)
            // Clear journal and tombstones after full save
            clearJournal()
            clearTombstones()
            print("[EmbeddingStore] Saved \(embeddings.count) embeddings in \(String(format: "%.3f", Date().timeIntervalSince(startTime)))s")
            return true
        } catch {
            print("[EmbeddingStore] Failed to save: \(error)")
            return false
        }
    }

    /// Incremental save: append new embeddings to the journal file.
    /// Also removes these IDs from tombstones so re-indexed photos survive restart.
    @discardableResult
    func appendNew(_ newEmbeddings: [String: MLMultiArray]) -> Bool {
        guard !newEmbeddings.isEmpty else { return true }

        // Scrub re-indexed IDs from tombstones to prevent stale deletions on restart
        removeTombstones(for: Set(newEmbeddings.keys))

        let journalPath = baseDir.appendingPathComponent(journalFileName)

        var data = Data()
        for (id, mlArray) in newEmbeddings {
            appendRecord(id: id, mlArray: mlArray, to: &data)
        }

        do {
            if FileManager.default.fileExists(atPath: journalPath.path) {
                let handle = try FileHandle(forWritingTo: journalPath)
                defer { handle.closeFile() }
                handle.seekToEndOfFile()
                handle.write(data)
            } else {
                try data.write(to: journalPath, options: .atomic)
            }
            print("[EmbeddingStore] Appended \(newEmbeddings.count) embeddings to journal")
            return true
        } catch {
            print("[EmbeddingStore] Failed to append: \(error)")
            return false
        }
    }

    /// Mark embeddings as deleted by adding to tombstone file.
    @discardableResult
    func markDeleted(_ deletedIds: [String]) -> Bool {
        guard !deletedIds.isEmpty else { return true }

        let tombstonePath = baseDir.appendingPathComponent(tombstoneFileName)
        let content = deletedIds.joined(separator: "\n") + "\n"

        do {
            guard let contentData = content.data(using: .utf8) else { return false }
            if FileManager.default.fileExists(atPath: tombstonePath.path) {
                let handle = try FileHandle(forWritingTo: tombstonePath)
                defer { handle.closeFile() }
                handle.seekToEndOfFile()
                handle.write(contentData)
            } else {
                try content.write(to: tombstonePath, atomically: true, encoding: .utf8)
            }
            return true
        } catch {
            print("[EmbeddingStore] Failed to write tombstones: \(error)")
            return false
        }
    }

    /// Compact: rewrite the main file from in-memory dict, clearing journal and tombstones.
    @discardableResult
    func compact(_ embeddings: [String: MLMultiArray]) -> Bool {
        return saveAll(embeddings)
    }

    /// Check if journal + tombstones warrant compaction.
    func needsCompaction() -> Bool {
        let journalPath = baseDir.appendingPathComponent(journalFileName)
        let tombstonePath = baseDir.appendingPathComponent(tombstoneFileName)

        let journalSize = (try? FileManager.default.attributesOfItem(atPath: journalPath.path)[.size] as? Int) ?? 0
        let hasTombstones = FileManager.default.fileExists(atPath: tombstonePath.path)

        return journalSize > 5_000_000 || hasTombstones
    }

    // MARK: - Binary Format Helpers

    private func appendRecord(id: String, mlArray: MLMultiArray, to data: inout Data) {
        let idBytes = Array(id.utf8)
        var idLen = UInt16(idBytes.count)
        data.append(Data(bytes: &idLen, count: 2))
        data.append(contentsOf: idBytes)

        // Write embedding as raw Float32 bytes
        let shaped = MLShapedArray<Float32>(converting: mlArray)
        let scalars = shaped.scalars
        scalars.withUnsafeBufferPointer { ptr in
            data.append(UnsafeBufferPointer(st
```

### Core Architecture Module: `Queryable/Queryable/Model/GPUSimilaritySearch.swift`
```
//
//  GPUSimilaritySearch.swift
//  Queryable
//
//  GPU-accelerated similarity search using MPSGraph matrix multiplication.
//  Replaces per-embedding CPU cosine similarity with a single [N,512]×[512,1] GPU matmul.
//
//  Performance strategy:
//  - Pre-allocate MTLBuffer for the embedding matrix (avoids ~27MB copy per search)
//  - Cache compiled MPSGraphExecutable (avoids graph recompilation per search)
//  - Only allocate a tiny buffer for the query vector on each search
//

import Foundation
import CoreML
import Metal
import MetalPerformanceShaders
import MetalPerformanceShadersGraph
import Accelerate

class GPUSimilaritySearch {
    private let device: MTLDevice
    private let commandQueue: MTLCommandQueue

    /// Photo IDs in the same order as rows in the embedding matrix
    private(set) var ids: [String] = []

    /// Contiguous Float16 embedding data (CPU-side, used for add/remove)
    private var embeddingData: [Float16] = []

    /// Pre-allocated GPU buffer for the embedding matrix
    private var matrixBuffer: MTLBuffer?

    /// Cached compiled graph + placeholders (invalidated when index changes)
    private var cachedGraph: CachedGraph?

    private let embeddingDim: Int = 512

    var count: Int { ids.count }

    private struct CachedGraph {
        let graph: MPSGraph
        let matrixPlaceholder: MPSGraphTensor
        let queryPlaceholder: MPSGraphTensor
        let resultTensor: MPSGraphTensor
        let n: Int
    }

    init?() {
        guard let device = MTLCreateSystemDefaultDevice(),
              let commandQueue = device.makeCommandQueue() else {
            return nil
        }
        self.device = device
        self.commandQueue = commandQueue
    }

    /// Build the GPU index from the in-memory embedding dictionary.
    /// Embeddings are L2-normalized and converted to Float16.
    func buildIndex(from embeddings: [String: MLMultiArray]) {
        let startTime = Date()
        let n = embeddings.count

        ids.removeAll()
        ids.reserveCapacity(n)
        embeddingData = [Float16](repeating: 0, count: n * embeddingDim)

        // Reusable buffer for normalized Float32 values (one embedding at a time)
        var normalizedBuf = [Float32](repeating: 0, count: embeddingDim)

        var i = 0
        for (id, mlArray) in embeddings {
            ids.append(id)
            let offset = i * embeddingDim

            // Zero-copy pointer into MLMultiArray's backing store
            let srcPtr = mlArray.dataPointer.assumingMemoryBound(to: Float32.self)

            // Vectorized L2 norm
            var sumSq: Float32 = 0
            vDSP_svesq(srcPtr, 1, &sumSq, vDSP_Length(embeddingDim))
            let norm = sqrt(sumSq)

            if norm > 1e-8 {
                var invNorm = 1.0 / norm
                vDSP_vsmul(srcPtr, 1, &invNorm, &normalizedBuf, 1, vDSP_Length(embeddingDim))

                // Bulk Float32 → Float16 conversion via Accelerate
                normalizedBuf.withUnsafeBufferPointer { srcBuf in
                    embeddingData.withUnsafeMutableBufferPointer { dstBuf in
                        var srcBuffer = vImage_Buffer(
                            data: UnsafeMutableRawPointer(mutating: srcBuf.baseAddress!),
                            height: 1,
                            width: vImagePixelCount(embeddingDim),
                            rowBytes: embeddingDim * MemoryLayout<Float32>.size
                        )
                        var dstBuffer = vImage_Buffer(
                            data: UnsafeMutableRawPointer(dstBuf.baseAddress! + offset),
                            height: 1,
                            width: vImagePixelCount(embeddingDim),
                            rowBytes: embeddingDim * MemoryLayout<Float16>.size
                        )
                        vImageConvert_PlanarFtoPlanar16F(&srcBuffer, &dstBuffer, 0)
                    }
                }
            }

            i += 1
        }

        // Pre-allocate GPU buffer and build cached graph
        uploadToGPU()

        print("[GPUSearch] Built index: \(n) embeddings in \(String(format: "%.3f", Date().timeIntervalSince(startTime)))s")
    }

    /// Add new embeddings to the existing index.
    func addEmbeddings(_ newEmbeddings: [String: MLMultiArray]) {
        var normalizedBuf = [Float32](repeating: 0, count: embeddingDim)

        for (id, mlArray) in newEmbeddings {
            let srcPtr = mlArray.dataPointer.assumingMemoryBound(to: Float32.self)

            var sumSq: Float32 = 0
            vDSP_svesq(srcPtr, 1, &sumSq, vDSP_Length(embeddingDim))
            let norm = sqrt(sumSq)

            var normalized = [Float16](repeating: 0, count: embeddingDim)
            if norm > 1e-8 {
                var invNorm = 1.0 / norm
                vDSP_vsmul(srcPtr, 1, &invNorm, &normalizedBuf, 1, vDSP_Length(embeddingDim))

                normalizedBuf.withUnsafeBufferPointer { srcBuf in
                    normalized.withUnsafeMutableBufferPointer { dstBuf in
                        var srcBuffer = vImage_Buffer(
                            data: UnsafeMutableRawPointer(mutating: srcBuf.baseAddress!),
                            height: 1,
                            width: vImagePixelCount(embeddingDim),
                            rowBytes: embeddingDim * MemoryLayout<Float32>.size
                        )
                        var dstBuffer = vImage_Buffer(
                            data: UnsafeMutableRawPointer(dstBuf.baseAddress!),
                            height: 1,
                            width: vImagePixelCount(embeddingDim),
                            rowBytes: embeddingDim * MemoryLayout<Float16>.size
                        )
                        vImageConvert_PlanarFtoPlanar16F(&srcBuffer, &dstBuffer, 0)
                    }
                }
            }

            ids.append(id)
            embeddingData.append(contentsOf: normalized)
        }

        uploadToGPU()
    }

    /// Remove embeddings by their IDs. Rebuilds the contiguous array.
    func removeEmbeddings(_ idsToRemove: Set<String>) {
        guard !idsToRemove.isEmpty else { return }

        var newIds = [String]()
        newIds.reserveCapacity(ids.count - idsToRemove.count)
        var newData = [Float16]()
        newData.reserveCapacity((ids.count - idsToRemove.count) * embeddingDim)

        for (i, id) in ids.enumerated() {
            if !idsToRemove.contains(id) {
                newIds.append(id)
                let offset = i * embeddingDim
                newData.append(contentsOf: embeddingData[offset..<(offset + embeddingDim)])
            }
        }

        self.ids = newIds
        self.embeddingData = newData

        uploadToGPU()
    }

    // MARK: - GPU Buffer Management

    /// Upload embedding data to a persistent MTLBuffer and build the cached graph.
    private func uploadToGPU() {
        let n = ids.count
        guard n > 0 else {
            matrixBuffer = nil
            cachedGraph = nil
            return
        }

        let byteCount = n * embeddingDim * MemoryLayout<Float16>.size

        matrixBuffer = embeddingData.withUnsafeBufferPointer { ptr in
            device.makeBuffer(bytes: ptr.baseAddress!, length: byteCount, options: .storageModeShared)
        }

        // Build and cache the MPSGraph for this matrix size
        let graph = MPSGraph()
        let matrixShape: [NSNumber] = [NSNumber(value: n), NSNumber(value: embeddingDim)]
        let queryShape: [NSNumber] = [NSNumber(value: embeddingDim), NSNumber(value: 1)]

        let matrixPlaceholder = graph.placeholder(shape: matrixShape, dataType: .float16, name: "embeddings")
        let queryPlaceholder = graph.placeholder(shape: queryShape, dataType: .float16, name: "query")
        let resultTensor = graph.matrixMultiplication(
            primary: matrixPlaceholder,
            secondary: queryPlaceholder,
            name: "similarity"
        )

        cachedGraph = CachedGraph(
            graph: graph,
            matrixPlaceholder: matrixPlaceholder,
            queryPlaceholder: queryPlaceholder,
            resultTensor: resultTensor,
            n: n
        )
    }

    // MARK: - Search

    /// Compute similarity scores for a query embedding against all stored embeddings.
    /// Returns [photoID: similarity_score].
    func search(queryEmbedding: MLShapedArray<Float32>) -> [String: Float] {
        let n = ids.count
        guard n > 0,
              let cached = cachedGraph,
              let matBuf = matrixBuffer,
              cached.n == n else {
            return [:]
        }

        // L2-normalize query and convert to Float16
        let queryScalars = queryEmbedding.scalars
        let queryNorm = sqrt(vDSP.sumOfSquares(queryScalars))
        var queryFloat16 = [Float16](repeating: 0, count: embeddingDim)
        if queryNorm > 1e-8 {
            for j in 0..<min(queryScalars.count, embeddingDim) {
                queryFloat16[j] = Float16(queryScalars[j] / queryNorm)
            }
        }

        // Create tensor data from pre-allocated matrix buffer (no copy)
        let matrixShape: [NSNumber] = [NSNumber(value: n), NSNumber(value: embeddingDim)]
        let matrixTensorData = MPSGraphTensorData(
            matBuf,
            shape: matrixShape,
            dataType: .float16
        )

        // Only the query vector needs a fresh buffer (~1KB)
        let queryShape: [NSNumber] = [NSNumber(value: embeddingDim), NSNumber(value: 1)]
        let queryTensorData = queryFloat16.withUnsafeBufferPointer { ptr in
            MPSGraphTensorData(
                device: MPSGraphDevice(mtlDevice: device),
                data: Data(buffer: ptr),
                shape: queryShape,
                dataType: .float16
            )
        }

        // Execute on GPU using cached graph
        let results = cached.graph.run(
            with: commandQueue,
            feeds: [cached.matrixPlaceholder: matrixTens
```

### Core Architecture Module: `Queryable/Queryable/Model/PhotoSearchModel.swift`
```
//
//  PhotoSearcherModel.swift
//  TestEncoder
//
//  Created by Ke Fang on 2022/12/08.
//
import UIKit
import CoreML
import Foundation
import Accelerate

struct PhotoSearcherModel {
    private var texEncoder: TextEncoder?
    
    mutating func load_text_encoder() {
        guard let path = Bundle.main.path(forResource: "CoreMLModels", ofType: nil, inDirectory: nil) else {
            fatalError("Fatal error: failed to find the CoreML models.")
        }
        let resourceURL = URL(fileURLWithPath: path)
        // TODO: move the pipeline creation to background task because it's heavy
        
        let encoder = try! TextEncoder(resourcesAt: resourceURL)
        texEncoder = encoder
    }
    
    func text_embedding(prompt: String) -> MLShapedArray<Float32> {
        let emb = try! texEncoder?.computeTextEmbedding(prompt: prompt)
        return emb!
    }
    
    func cosine_similarity(A: MLShapedArray<Float32>, B: MLShapedArray<Float32>) async -> Float {
        let magnitude = vDSP.sumOfSquares(A.scalars).squareRoot() * vDSP.sumOfSquares(B.scalars).squareRoot()
        let dotarray = vDSP.dot(A.scalars, B.scalars)
        return  dotarray / magnitude
    }
    
    func spherical_dist_loss(A: MLShapedArray<Float32>, B: MLShapedArray<Float32>) async -> Float {
        let a = vDSP.divide(A.scalars, sqrt(vDSP.sumOfSquares(A.scalars)))
        let b = vDSP.divide(B.scalars, sqrt(vDSP.sumOfSquares(B.scalars)))

        let magnitude = sqrt(vDSP.sumOfSquares(vDSP.subtract(a, b)))
        return pow(asin(magnitude / 2.0), 2) * 2.0
    }

}

```

### Core Architecture Module: `Queryable/Queryable/PhotoHelper/CachedImageManager.swift`
```
/*
See the License.txt file for this sample’s licensing information.
*/

import UIKit
import Photos
import SwiftUI
import os.log

actor CachedImageManager {
    
    private let imageManager = PHCachingImageManager()
    
    private var imageContentMode = PHImageContentMode.aspectFit
    
    enum CachedImageManagerError: LocalizedError {
        case error(Error)
        case cancelled
        case failed
    }
    
    private var cachedAssetIdentifiers = [String : Bool]()
    
    lazy var requestOptions: PHImageRequestOptions = {
        let options = PHImageRequestOptions()
        options.isNetworkAccessAllowed = false
        options.deliveryMode = .opportunistic
        return options
    }()
    
    init() {
        imageManager.allowsCachingHighQualityImages = false
    }
    
    var cachedImageCount: Int {
        cachedAssetIdentifiers.keys.count
    }
    
    func startCaching(for assets: [PhotoAsset], targetSize: CGSize) {
        let phAssets = assets.compactMap { $0.phAsset }
        phAssets.forEach {
            cachedAssetIdentifiers[$0.localIdentifier] = true
        }
        imageManager.startCachingImages(for: phAssets, targetSize: targetSize, contentMode: imageContentMode, options: requestOptions)
    }

    func stopCaching(for assets: [PhotoAsset], targetSize: CGSize) {
        let phAssets = assets.compactMap { $0.phAsset }
        phAssets.forEach {
            cachedAssetIdentifiers.removeValue(forKey: $0.localIdentifier)
        }
        imageManager.stopCachingImages(for: phAssets, targetSize: targetSize, contentMode: imageContentMode, options: requestOptions)
    }
    
    func stopCaching() {
        imageManager.stopCachingImagesForAllAssets()
    }
    
    @discardableResult
    func requestImage(for asset: PhotoAsset, targetSize: CGSize, completion: @escaping ((image: UIImage?, isLowerQuality: Bool)?) -> Void) -> PHImageRequestID? {
        guard let phAsset = asset.phAsset else {
            completion(nil)
            return nil
        }
        
        let requestID = imageManager.requestImage(for: phAsset, targetSize: targetSize, contentMode: imageContentMode, options: requestOptions) { image, info in
            if let error = info?[PHImageErrorKey] as? Error {
                logger.error("CachedImageManager requestImage error: \(error.localizedDescription)")
                completion(nil)
            } else if let cancelled = (info?[PHImageCancelledKey] as? NSNumber)?.boolValue, cancelled {
                logger.debug("CachedImageManager request canceled")
                completion(nil)
            } else if let image = image {
                let isLowerQualityImage = (info?[PHImageResultIsDegradedKey] as? NSNumber)?.boolValue ?? false
                let result = (image: image, isLowerQuality: isLowerQualityImage)
                completion(result)
            } else {
                completion(nil)
            }
        }
        return requestID
    }
    
    func cancelImageRequest(for requestID: PHImageRequestID) {
        imageManager.cancelImageRequest(requestID)
    }
}

fileprivate let logger = Logger(subsystem: "com.apple.swiftplaygroundscontent.capturingphotos", category: "CachedImageManager")


```

### Core Architecture Module: `Queryable/Queryable/PhotoHelper/DataModel.swift`
```
/*
See the License.txt file for this sample’s licensing information.
*/

import AVFoundation
import SwiftUI
import os.log

final class DataModel: ObservableObject {
//    let camera = Camera()
    let photoCollection = PhotoCollection(smartAlbum: .smartAlbumUserLibrary)
    
    @Published var viewfinderImage: Image?
    @Published var thumbnailImage: UIImage?
    
    var isPhotosLoaded = false
    
    init() {
//        Task {
//            await handleCameraPreviews()
//        }
//
//        Task {
//            await handleCameraPhotos()
//        }
    }
    
//    func handleCameraPreviews() async {
//        let imageStream = camera.previewStream
//            .map { $0.image }
//
//        for await image in imageStream {
//            Task { @MainActor in
//                viewfinderImage = image
//            }
//        }
//    }
    
//    func handleCameraPhotos() async {
//        let unpackedPhotoStream = camera.photoStream
//            .compactMap { self.unpackPhoto($0) }
//
//        for await photoData in unpackedPhotoStream {
//            Task { @MainActor in
//                thumbnailImage = photoData.thumbnailImage
//            }
//            savePhoto(imageData: photoData.imageData)
//        }
//    }
    
    private func unpackPhoto(_ photo: AVCapturePhoto) -> PhotoData? {
        guard let imageData = photo.fileDataRepresentation() else { return nil }

        guard let previewCGImage = photo.previewCGImageRepresentation(),
           let metadataOrientation = photo.metadata[String(kCGImagePropertyOrientation)] as? UInt32,
              let cgImageOrientation = CGImagePropertyOrientation(rawValue: metadataOrientation) else { return nil }
        let imageOrientation = Image.Orientation(cgImageOrientation)
        let thumbnailImage = Image(decorative: previewCGImage, scale: 1, orientation: imageOrientation)
        
        let photoDimensions = photo.resolvedSettings.photoDimensions
        let imageSize = (width: Int(photoDimensions.width), height: Int(photoDimensions.height))
        let previewDimensions = photo.resolvedSettings.previewDimensions
        let thumbnailSize = (width: Int(previewDimensions.width), height: Int(previewDimensions.height))
        
        return PhotoData(thumbnailImage: thumbnailImage, thumbnailSize: thumbnailSize, imageData: imageData, imageSize: imageSize)
    }
    
    func savePhoto(imageData: Data) {
        Task {
            do {
                try await photoCollection.addImage(imageData)
                logger.debug("Added image data to photo collection.")
            } catch let error {
                logger.error("Failed to add image to photo collection: \(error.localizedDescription)")
            }
        }
    }
    
    func loadPhotos() async {
        guard !isPhotosLoaded else { return }
        
        let authorized = await PhotoLibrary.checkAuthorization()
        guard authorized else {
            logger.error("Photo library access was not authorized.")
            return
        }
        
        do {
            try await self.photoCollection.load()
            await self.loadThumbnail()
        } catch let error {
            logger.error("Failed to load photo collection: \(error.localizedDescription)")
        }
        self.isPhotosLoaded = true
    }
    
    func loadThumbnail() async {
        guard let asset = photoCollection.photoAssets.first  else { return }
        await photoCollection.cache.requestImage(for: asset, targetSize: CGSize(width: 256, height: 256)) { result in
            if let result = result {
                Task { @MainActor in
                    self.thumbnailImage = result.image
                }
            }
        }
    }
    
}

fileprivate struct PhotoData {
    var thumbnailImage: Image
    var thumbnailSize: (width: Int, height: Int)
    var imageData: Data
    var imageSize: (width: Int, height: Int)
}

fileprivate extension CIImage {
    var image: Image? {
        let ciContext = CIContext()
        guard let cgImage = ciContext.createCGImage(self, from: self.extent) else { return nil }
        return Image(decorative: cgImage, scale: 1, orientation: .up)
    }
}

fileprivate extension Image.Orientation {

    init(_ cgImageOrientation: CGImagePropertyOrientation) {
        switch cgImageOrientation {
        case .up: self = .up
        case .upMirrored: self = .upMirrored
        case .down: self = .down
        case .downMirrored: self = .downMirrored
        case .left: self = .left
        case .leftMirrored: self = .leftMirrored
        case .right: self = .right
        case .rightMirrored: self = .rightMirrored
        }
    }
}

fileprivate let logger = Logger(subsystem: "com.mazzystar.Queryable", category: "DataModel")

```

### Core Architecture Module: `Queryable/Queryable/PhotoHelper/PhotoAsset.swift`
```
/*
See the License.txt file for this sample’s licensing information.
*/

import Photos
import os.log

struct PhotoAsset: Identifiable {
    var id: String { identifier }
    var identifier: String = UUID().uuidString
    var index: Int?
    var phAsset: PHAsset?
    
    typealias MediaType = PHAssetMediaType
    
    var isFavorite: Bool {
        phAsset?.isFavorite ?? false
    }
    
    var mediaType: MediaType {
        phAsset?.mediaType ?? .unknown
    }
    
    var accessibilityLabel: String {
        isFavorite ? "Photo, Favorite" : "Photo"
    }

    init(phAsset: PHAsset, index: Int?) {
        self.phAsset = phAsset
        self.index = index
        self.identifier = phAsset.localIdentifier
    }
    
    init(identifier: String) {
        self.identifier = identifier
        let fetchedAssets = PHAsset.fetchAssets(withLocalIdentifiers: [identifier], options: nil)
        self.phAsset = fetchedAssets.firstObject
    }
    
    func setIsFavorite(_ isFavorite: Bool) async {
        guard let phAsset = phAsset else { return }
        do {
            try await PHPhotoLibrary.shared().performChanges {
                let request = PHAssetChangeRequest(for: phAsset)
                request.isFavorite = isFavorite
            }
        } catch (let error) {
            print("Failed to change isFavorite: \(error.localizedDescription)")
            logger.error("Failed to change isFavorite: \(error.localizedDescription)")
        }
    }
    
    func delete() async {
        guard let phAsset = phAsset else { return }
        do {
            try await PHPhotoLibrary.shared().performChanges {
                PHAssetChangeRequest.deleteAssets([phAsset] as NSArray)
            }
            logger.debug("PhotoAsset asset deleted: \(index ?? -1)")
        } catch (let error) {
            print("Failed to change isFavorite: \(error.localizedDescription)")
            logger.error("Failed to delete photo: \(error.localizedDescription)")
        }
    }
}

extension PhotoAsset: Equatable {
    static func ==(lhs: PhotoAsset, rhs: PhotoAsset) -> Bool {
        (lhs.identifier == rhs.identifier) && (lhs.isFavorite == rhs.isFavorite)
    }
}

extension PhotoAsset: Hashable {
    func hash(into hasher: inout Hasher) {
        hasher.combine(identifier)
    }
}

extension PHObject: Identifiable {
    public var id: String { localIdentifier }
}

fileprivate let logger = Logger(subsystem: "com.mazzystar.Queryable", category: "PhotoAsset")


```

### Core Architecture Module: `Queryable/Queryable/PhotoHelper/PhotoAssetCollection.swift`
```
/*
See the License.txt file for this sample’s licensing information.
*/

import Photos

class PhotoAssetCollection: RandomAccessCollection {
    private(set) var fetchResult: PHFetchResult<PHAsset>
    private var iteratorIndex: Int = 0
    
    private var cache = [Int : PhotoAsset]()
    
    var startIndex: Int { 0 }
    var endIndex: Int { fetchResult.count }
    
    init(_ fetchResult: PHFetchResult<PHAsset>) {
        self.fetchResult = fetchResult
    }

    subscript(position: Int) -> PhotoAsset {
        if let asset = cache[position] {
            return asset
        }
        let asset = PhotoAsset(phAsset: fetchResult.object(at: position), index: position)
        cache[position] = asset
        return asset
    }
    
    var phAssets: [PHAsset] {
        var assets = [PHAsset]()
        fetchResult.enumerateObjects { (object, count, stop) in
            assets.append(object)
        }
        return assets
    }
}

extension PhotoAssetCollection: Sequence, IteratorProtocol {

    func next() -> PhotoAsset? {
        if iteratorIndex >= count {
            return nil
        }
        
        defer {
            iteratorIndex += 1
        }
        
        return self[iteratorIndex]
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #5** (2023-10-12): **Abnormal operation on A12 and lower chips**
  *Symptoms*: Currently, Queryable does not support devices below the iPhone 11 (with the A13 chip). On these devices, indexing can be built normally, but the search results for any query are the same, and I haven't debugged the problem. If you find a solution, I would greatly appreciate it if you could submit a PR.
  **Post-Mortem & Fix Analysis**:
  > Hi, I managed to make the project work on an iPhone X. On the TextEncoder init, you need to add the following line to force CPU only on older iPhones. ``` config.computeUnits = .cpuOnly ```  Based on information found here:  - https://apple.github.io/coremltools/docs-guides/source/faqs.html#error-in-declaring-network-or-computing-nn-outputs - https://apple.github.io/coremltools/docs-guides/source/load-and-convert-model.html#set-the-compute-units
  > Wow! Do we need to use `if/else` to handle different iPhone devices? Or, if we change this line, would it affect the newer iPhone perfomance? ``` config.computeUnits = .cpuOnly ```  BTW, it would be nice if you could submit a PR to fix the issue : ) 
  > Yeah ideally an `if/else` is needed to ensure MLModel continues using default configuration on newer iPhones (default is CPU, GPU and Neural Engine).  I will submit a PR later today.

- **Issue #3** (2023-09-22): **iOS 17 beta issue: abnormal search results.**
  *Symptoms*: In iOS 17 beta 3, regardless of the keyword used, the search results are always the same.
  **Post-Mortem & Fix Analysis**:
  > It appears to be a bug introduced in the iOS 17 beta, where input text is being embedded into the same vector. Currently, I am unable to determine the exact cause of this issue.
  > I can confirm the results are the same, not always, but most of the time. 
  > @RupGautam  I've debugged the issue. I found that all text inputs were embedded into the same value in iOS 17 beta. However, it works correctly on iOS 16. I suspect it was the issue related with model loading, didn't figured out the problem yet.

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

### Incident Patch 1: `b95a05a8` (2026-03-29)
**Commit Message**: Fix text flickering during index building by fixing layout ratio

Use GeometryReader to pin image at 80% and text at 20% of screen height,
preventing text from jumping as indexed photos change size.

Co-Authored-By: Claude Opus 4.6 <[REDACTED_EMAIL]>

**File**: `Queryable/Queryable/View/BuildIndexView.swift` (modified, +21/-14)
```diff
@@ -97,22 +97,29 @@ struct StartBuildView: View {
 
 struct BuildingIndexView: View {
     @ObservedObject var photoSearcher: PhotoSearcher
-    
+
     var body: some View {
-        VStack {
-            Image(uiImage: photoSearcher.curShowingPhoto)
-                .resizable()
-                .scaledToFit()
-            
-            let end = "Photos have been indexed."
-            Text("\(photoSearcher.curIndexingNums+1)/\(photoSearcher.totalUnIndexedPhotosNum) \(NSLocalizedString(end, comment: ""))")
-            Text("Task runs entirely locally. Do not operate until completed.")
-                .foregroundColor(.gray)
-                .scaledToFit()
-                .minimumScaleFactor(0.5)
-                .lineLimit(1)
+        GeometryReader { geometry in
+            VStack(spacing: 0) {
+                Image(uiImage: photoSearcher.curShowingPhoto)
+                    .resizable()
+                    .scaledToFit()
+                    .frame(height: geometry.size.height * 0.8)
+
+                VStack(spacing: 4) {
+                    let end = "Photos have been indexed."
+                    Text("\(photoSearcher.curIndexingNums+1)/\(photoSearcher.totalUnIndexedPhotosNum) \(NSLocalizedString(end, comment: ""))")
+
+                    Text(NSLocalizedString("Task runs entirely locally. Do not operate until completed.", comment: ""))
+                        .padding([.leading, .trailing])
+                        .foregroundColor(.gray)
+                        .font(.caption)
+                        .multilineTextAlignment(.center)
+                        .lineLimit(2)
+                }
+                .frame(height: geometry.size.height * 0.2)
+            }
         }
-        
     }
 }
 
```

---

### Incident Patch 2: `a2ff92f9` (2026-03-29)
**Commit Message**: Fix IOSurface crash: buffer pooling, batch encoding, GPU resize

Rewrite ImgEncoder to prevent IOSurface exhaustion at ~15800 photos:
- CVPixelBufferPool for buffer recycling
- detachFromIOSurface() to memcpy embeddings to heap memory
- CILanczosScaleTransform for GPU-accelerated image resize
- encodeBatch() with MLArrayBatchProvider for Neural Engine pipelining
- Remove UIImage+Extension.swift (CPU resize no longer needed)

Co-Authored-By: Claude Opus 4.6 <[REDACTED_EMAIL]>

**File**: `Queryable/Queryable/CLIP/ImgEncoder.swift` (modified, +139/-19)
```diff
@@ -1,63 +1,183 @@
 //
 //  ImgEncoder.swift
-//  TestEncoder
+//  Queryable
 //
 //  Created by Ke Fang on 2022/12/08.
 //
 
 import Foundation
 import CoreML
+import CoreImage
 import UIKit
 
 public struct ImgEncoder {
     var model: MLModel
-    
+
+    /// Shared CIContext for GPU-accelerated image processing
+    private static let ciContext = CIContext(options: [.useSoftwareRenderer: false])
+
+    /// Shared pixel buffer pool to recycle IOSurface-backed buffers (prevents hitting the 16384 limit)
+    private static var bufferPool: CVPixelBufferPool? = {
+        let poolAttrs: [String: Any] = [
+            kCVPixelBufferPoolMinimumBufferCountKey as String: 4
+        ]
+        let bufferAttrs: [String: Any] = [
+            kCVPixelBufferWidthKey as String: 256,
+            kCVPixelBufferHeightKey as String: 256,
+            kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32ARGB,
+            kCVPixelBufferCGImageCompatibilityKey as String: true,
+            kCVPixelBufferCGBitmapContextCompatibilityKey as String: true
+        ]
+        var pool: CVPixelBufferPool?
+        CVPixelBufferPoolCreate(kCFAllocatorDefault, poolAttrs as CFDictionary, bufferAttrs as CFDictionary, &pool)
+        return pool
+    }()
+
+    /// Flush idle buffers from the pool so the OS can reclaim their IOSurfaces.
+    static func flushBufferPool() {
+        if let pool = bufferPool {
+            CVPixelBufferPoolFlush(pool, CVPixelBufferPoolFlushFlags(rawValue: 0))
+        }
+    }
+
+    /// Deep-copy an MLShapedArray's scalar data into a fresh, heap-backed MLMultiArray.
+    /// CoreML prediction outputs are backed by IOSurface memory; MLShapedArray(converting:)
+    /// and MLMultiArray(shapedArray) may share that IOSurface storage rather than copying.
+    /// Storing those wrappers in savedEmbedding means each embedding retains an IOSurface,
+    /// hitting the per-process 16384 IOSurface limit at ~15800 embeddings.
+    /// This method breaks that chain by memcpy-ing the floats into plain heap memory.
+    static func detachFromIOSurface(_ shapedArray: MLShapedArray<Float32>) -> MLMultiArray {
+        let count = shapedArray.scalarCount
+        let heapArray = try! MLMultiArray(shape: [1, NSNumber(value: count)], dataType: .float32)
+        let dst = heapArray.dataPointer.assumingMemoryBound(to: Float32.self)
+        shapedArray.withUnsafeShapedBufferPointer { ptr, _, _ in
+            dst.update(from: ptr.baseAddress!, count: count)
+        }
+        return heapArray
+    }
+
     init(resourcesAt baseURL: URL,
          configuration config: MLModelConfiguration = .init()
     ) throws {
-        let imgEncoderURL = baseURL.appending(path:"ImageEncoder_mobileCLIP_s2.mlmodelc")
+        let imgEncoderURL = baseURL.appending(path: "ImageEncoder_mobileCLIP_s2.mlmodelc")
         let imgEncoderModel = try MLModel(contentsOf: imgEncoderURL, configuration: config)
         self.model = imgEncoderModel
     }
-    
+
     public func computeImgEmbedding(img: UIImage) async throws -> MLShapedArray<Float32> {
         let imgEmbedding = try await self.encode(image: img)
         return imgEmbedding
     }
-    
-//    public init(model: MLModel) {
-//        self.model = model
-//    }
-    
+
     /// Prediction queue
     let queue = DispatchQueue(label: "imgencoder.predict")
-    
-    private func encode(image: UIImage) async throws -> MLShapedArray<Float32> {
+
+    public func encode(image: UIImage) async throws -> MLShapedArray<Float32> {
         do {
-            guard let resizedImage = try image.resizeImageTo(size:CGSize(width: 256, height: 256)) else {
-                throw ImageEncodingError.resizeError
-            }
-            
-            guard let buffer = resizedImage.convertToBuffer() else {
+            guard let buffer = Self.resizeAndConvertToBuffer(image: image, size: CGSize(width: 256, height: 256)) else {
                 throw ImageEncodingError.bufferConversionError
             }
-            
+
             guard let inputFeatures = try? MLDictionaryFeatureProvider(dictionary: ["colorImage": buffer]) else {
                 throw ImageEncodingError.featureProviderError
             }
-            
+
             let result = try queue.sync { try model.prediction(from: inputFeatures) }
             guard let embeddingFeature = result.featureValue(for: "embOutput"),
                   let multiArray = embeddingFeature.multiArrayValue else {
                 throw ImageEncodingError.predictionError
             }
-            
+
             return MLShapedArray<Float32>(converting: multiArray)
         } catch {
             print("Error in encoding: \(error)")
             throw error
         }
     }
+
+    /// Batch prediction: encode multiple images in one CoreML call.
+    /// Uses MLArrayBatchProvider for efficient Neural Engine pipelining.
+    /// All CoreML intermediates are scoped inside autoreleasepool to release
+    /// Neural Engine IOSurface a
```

**File**: `Queryable/Queryable/Model/UIImage+Extension.swift` (removed, +0/-73)
```diff
@@ -1,73 +0,0 @@
-//
-//  UIImage+Extension.swift
-//  CoreMLmeetsSwiftUI
-//
-//  Created by Moritz Philip Recke for Create with Swift on 10 February 2021.
-//
-
-import Foundation
-import UIKit
-
-extension UIImage {
-    
-    func resizeImageTo(size: CGSize) throws -> UIImage? {
-        
-        UIGraphicsBeginImageContextWithOptions(size, false, 0.0)
-        self.draw(in: CGRect(origin: CGPoint.zero, size: size))
-        let resizedImage = UIGraphicsGetImageFromCurrentImageContext()!
-        UIGraphicsEndImageContext()
-        return resizedImage
-    }
-    
-     func convertToBuffer() -> CVPixelBuffer? {
-        
-        let attributes = [
-            kCVPixelBufferCGImageCompatibilityKey: kCFBooleanTrue,
-            kCVPixelBufferCGBitmapContextCompatibilityKey: kCFBooleanTrue
-        ] as CFDictionary
-        
-        var pixelBuffer: CVPixelBuffer?
-        
-        let status = CVPixelBufferCreate(
-            kCFAllocatorDefault, Int(self.size.width),
-            Int(self.size.height),
-            kCVPixelFormatType_32ARGB,
-            attributes,
-            &pixelBuffer)
-        
-        guard (status == kCVReturnSuccess) else {
-            return nil
-        }
-        
-        CVPixelBufferLockBaseAddress(pixelBuffer!, CVPixelBufferLockFlags(rawValue: 0))
-        
-        let pixelData = CVPixelBufferGetBaseAddress(pixelBuffer!)
-        let rgbColorSpace = CGColorSpaceCreateDeviceRGB()
-        
-        let context = CGContext(
-            data: pixelData,
-            width: Int(self.size.width),
-            height: Int(self.size.height),
-            bitsPerComponent: 8,
-            bytesPerRow: CVPixelBufferGetBytesPerRow(pixelBuffer!),
-            space: rgbColorSpace,
-            bitmapInfo: CGImageAlphaInfo.noneSkipFirst.rawValue)
-        
-        context?.translateBy(x: 0, y: self.size.height)
-        context?.scaleBy(x: 1.0, y: -1.0)
-        
-        UIGraphicsPushContext(context!)
-        self.draw(in: CGRect(x: 0, y: 0, width: self.size.width, height: self.size.height))
-        UIGraphicsPopContext()
-        
-        CVPixelBufferUnlockBaseAddress(pixelBuffer!, CVPixelBufferLockFlags(rawValue: 0))
-        
-        return pixelBuffer
-    }
-    
-    static func image(with size: CGSize) -> UIImage {
-        UIGraphicsImageRenderer(size: size)
-            .image { $0.fill(CGRect(origin: .zero, size: size)) }
-    }
-
-}
```

---

### Incident Patch 3: `00c2bc90` (2024-02-07)
**Commit Message**: we don't need to load text encoder when finished build index

**File**: `Queryable/Queryable/ViewModel/PhotoSearcher.swift` (modified, +0/-6)
```diff
@@ -26,7 +26,6 @@ enum BUILD_INDEX_CODE: Int {
     case LOADING_PHOTOS      = -2
     case PHOTOS_LOADED       = -1
     case LOADING_MODEL       = 0
-    case MODEL_LOADED        = 1
     case IS_BUILDING_INDEX   = 2
     case BUILD_FINISHED      = 3
 }
@@ -161,7 +160,6 @@ class PhotoSearcher: ObservableObject {
             // 8.542439937591553 seconds used for loading img encoder
             print("\(startingTime.timeIntervalSinceNow * -1) seconds used for loading img encoder")
             self.imageEncoder = imgEncoder
-            self.buildIndexCode = .MODEL_LOADED
             self.buildIndexCode = .IS_BUILDING_INDEX
         } catch let error {
             logger.error("Failed to load model: \(error.localizedDescription)")
@@ -368,10 +366,6 @@ class PhotoSearcher: ObservableObject {
         self.totalUnIndexedPhotosNum = 0
         
         clearCache()
-        print("Loading text encoder..")
-        self.photoSearchModel.load_text_encoder()
-        print("Text encoder loaded.")
-
     }
     
     func loadEmbeddingsData(fileName: String) -> Bool {
```

---

### Incident Patch 4: `1d9a67f2` (2024-02-04)
**Commit Message**: Fix img_emb_pieces_lst with one empty element bug and refactor code

**File**: `Queryable/Queryable/ViewModel/PhotoSearcher.swift` (modified, +12/-21)
```diff
@@ -281,11 +281,7 @@ class PhotoSearcher: ObservableObject {
             let _cur_asset = self.photoCollection.photoAssets[idx]
             
             self.allPhotosId[_cur_asset.id] = 1
-            
-            if let _ = self.savedEmbedding[_cur_asset.id] {
-                
-            }
-            else {
+            if self.savedEmbedding[_cur_asset.id] == nil {
                 self.unIndexedPhotos.append(_cur_asset)
             }
         }
@@ -296,16 +292,13 @@ class PhotoSearcher: ObservableObject {
     }
     
     private func judgeIfAssetUnidexed(asset: PhotoAsset) async {
-        if let _ = self.savedEmbedding[asset.id] {
-
-        }
-        else {
+        if self.savedEmbedding[asset.id] == nil {
             self.unIndexedPhotos.append(asset)
         }
     }
     
     func deleteEmbeddingByAsset(asset: PhotoAsset) async {
-        if let _ = self.savedEmbedding[asset.id] {
+        if self.savedEmbedding[asset.id] != nil {
             self.savedEmbedding.removeValue(forKey: asset.id)
             print("\(asset.id) deleted.")
         }
@@ -314,14 +307,14 @@ class PhotoSearcher: ObservableObject {
     func updateEmbedding(new_indexed_results: [String: MLMultiArray]) {
         // update results
         print("Before update, embedding count=\(self.savedEmbedding.count)")
-        for key in new_indexed_results.keys {
-            self.savedEmbedding[key] = new_indexed_results[key]
+        for (key, embedding) in new_indexed_results {
+            self.savedEmbedding[key] = embedding
         }
         
         var final_all_results = [Embedding]()
         
-        for key in self.savedEmbedding.keys {
-            let _embedding = Embedding(id: key, embedding: self.savedEmbedding[key]!)
+        for (key, embedding) in self.savedEmbedding {
+            let _embedding = Embedding(id: key, embedding: embedding)
             final_all_results.append(_embedding)
         }
         
@@ -559,7 +552,7 @@ class PhotoSearcher: ObservableObject {
         
         var cnt = 0
         var img_emb_piece = [String: MLMultiArray]()
-        var img_emb_pieces_lst = [[String: MLMultiArray]()]
+        var img_emb_pieces_lst = [[String: MLMultiArray]]()
         for emb in img_embs_dict {
             img_emb_piece[emb.key] = emb.value
             cnt += 1
@@ -583,9 +576,8 @@ class PhotoSearcher: ObservableObject {
             for emb_dict in img_embs_dict_lst {
                 if !emb_dict.isEmpty {
                     group.addTask {
-                        for key in emb_dict.keys {
-                            let cur_img_emb = emb_dict[key]
-                            await self.computeSingleEmbeddingSim(text_emb: text_emb, img_emb: cur_img_emb!, img_id: key)
+                        for (key, cur_img_emb) in emb_dict {
+                            await self.computeSingleEmbeddingSim(text_emb: text_emb, img_emb: cur_img_emb, img_id: key)
                         } 
                     }
                 }
@@ -599,9 +591,8 @@ class PhotoSearcher: ObservableObject {
     }
     
     private func simpleComputeAllEmbeddingSim(text_emb: MLShapedArray<Float32>, img_embs_dict: [String: MLMultiArray]) async {
-        for key in img_embs_dict.keys {
-            let cur_img_emb = img_embs_dict[key]
-            await self.computeSingleEmbeddingSim(text_emb: text_emb, img_emb: cur_img_emb!, img_id: key)
+        for (key,cur_img_emb) in img_embs_dict {
+            await self.computeSingleEmbeddingSim(text_emb: text_emb, img_emb: cur_img_emb, img_id: key)
         }
     }
     
```

---

### Incident Patch 5: `f024f095` (2024-01-13)
**Commit Message**: fix issue with unclear image results.

**File**: `Queryable/Queryable/View/PhotoResult/PhotoView.swift` (modified, +2/-3)
```diff
@@ -27,7 +27,6 @@ struct PhotoView: View {
     @State private var imageRequestID: PHImageRequestID?
     @ObservedObject var photoSearcher: PhotoSearcher
     @Environment(\.dismiss) var dismiss
-    private let imageSize = CGSize(width: 1024, height: 1024)
     
     var body: some View {
         VStack {
@@ -135,7 +134,7 @@ struct PhotoView: View {
                 if HAS_NETWORK_PERMISSION {
                     await cache.requestOptions.isNetworkAccessAllowed = true
                 }
-                imageRequestID = await cache.requestImage(for: asset, targetSize: imageSize) { result in
+                imageRequestID = await cache.requestImage(for: asset, targetSize: PHImageManagerMaximumSize) { result in
                     Task {
                         if let result = result {
                             self.image = Image(uiImage: result.image!)
@@ -194,7 +193,7 @@ struct PhotoView: View {
                                         HAS_NETWORK_PERMISSION = true
                                     }
                                     
-                                    imageRequestID = await cache!.requestImage(for: asset, targetSize: imageSize) { result in
+                                    imageRequestID = await cache!.requestImage(for: asset, targetSize: PHImageManagerMaximumSize) { result in
                                         Task {
                                             if let result = result {
                                                 self.image = Image(uiImage: result.image!)
```

---

### Incident Patch 6: `e087c801` (2024-01-13)
**Commit Message**: fix issue with unclear image results.

**File**: `Queryable/Queryable/View/PhotoResult/PhotoView.swift` (modified, +1/-1)
```diff
@@ -135,7 +135,7 @@ struct PhotoView: View {
                 if HAS_NETWORK_PERMISSION {
                     await cache.requestOptions.isNetworkAccessAllowed = true
                 }
-                imageRequestID = await cache.requestImage(for: asset, targetSize: imageSize) { result in
+                imageRequestID = await cache.requestImage(for: asset, targetSize: PHImageManagerMaximumSize) { result in
                     Task {
                         if let result = result {
                             self.image = Image(uiImage: result.image!)
```

---

### Incident Patch 7: `452cc2dd` (2023-10-12)
**Commit Message**: Merge pull request #19 from codingstyle/fix/older-iphone

Fixed support for iPhone with A10/A11/A12 chips

**File**: `Queryable/Queryable/CLIP/TextEncoder.swift` (modified, +11/-0)
```diff
@@ -4,6 +4,10 @@
 import Foundation
 import CoreML
 
+#if os(iOS)
+import UIKit
+#endif
+
 ///  A model for encoding text
 public struct TextEncoder {
 
@@ -20,6 +24,13 @@ public struct TextEncoder {
         let vocabURL = baseURL.appending(path: "vocab.json")
         let mergesURL = baseURL.appending(path: "merges.txt")
         
+#if os(iOS)
+        // Fallback to CPU only to avoid NN compute error on iPhone < 11 and iPad < 9th gen
+        if !UIDevice.chipIsA13OrLater() {
+            config.computeUnits = .cpuOnly
+        }
+#endif
+
         // Text tokenizer and encoder
         let tokenizer = try BPETokenizer(mergesAt: mergesURL, vocabularyAt: vocabURL)
         let textEncoderModel = try MLModel(contentsOf: textEncoderURL, configuration: config)
```

**File**: `Queryable/Queryable/View/SearchResultsView.swift` (modified, +18/-10)
```diff
@@ -294,7 +294,19 @@ struct SearchResultsView_Previews: PreviewProvider {
 import UIKit
 
 public extension UIDevice {
+    static func chipIsA13OrLater() -> Bool {
+        let devicePattern = /(AppleTV|iPad|iPhone|Watch|iPod)(\d+),(\d+)/
+        
+        if let match = current.model.firstMatch(of: devicePattern) {
+            let deviceModel = match.1
+            let majorRevision = Int(match.2)!
+            
+            return (deviceModel == "iPhone" || deviceModel == "iPad") && majorRevision >= 12
+        }
 
+        return false
+    }
+    
     static let modelIsValid: Bool = {
         var systemInfo = utsname()
         uname(&systemInfo)
@@ -304,22 +316,18 @@ public extension UIDevice {
             return identifier + String(UnicodeScalar(UInt8(value)))
         }
 
-        func isDeviceValid(identifier: String) -> Bool { // swiftlint:disable:this cyclomatic_complexity
-            #if os(iOS)
-            switch identifier {
-            case "iPhone10,3", "iPhone10,6":                      return false // "iPhone X"
-            case "iPhone11,2":                                    return false // "iPhone XS"
-            case "iPhone11,4", "iPhone11,6":                      return  false // "iPhone XS Max"
-            case "iPhone11,8":                                    return false // "iPhone XR"
-            default:                                              return true
-            }
-            #elseif os(tvOS)
+        
+        func isDeviceValid(identifier: String) -> Bool {
+            // swiftlint:disable:this cyclomatic_complexity
+            #if os(tvOS)
             switch identifier {
             case "AppleTV5,3": return false
             case "AppleTV6,2": return false
             case "i386", "x86_64": return false
             default: return false
             }
+            #elseif os(iOS)
+            return true
             #endif
         }
 
```

---

### Incident Patch 8: `063a4c17` (2023-10-11)
**Commit Message**: Fixed support for iPhone with A10/A11/A12 chips

**File**: `Queryable/Queryable/CLIP/TextEncoder.swift` (modified, +11/-0)
```diff
@@ -4,6 +4,10 @@
 import Foundation
 import CoreML
 
+#if os(iOS)
+import UIKit
+#endif
+
 ///  A model for encoding text
 public struct TextEncoder {
 
@@ -20,6 +24,13 @@ public struct TextEncoder {
         let vocabURL = baseURL.appending(path: "vocab.json")
         let mergesURL = baseURL.appending(path: "merges.txt")
         
+#if os(iOS)
+        // Fallback to CPU only to avoid NN compute error on iPhone < 11 and iPad < 9th gen
+        if !UIDevice.chipIsA13OrLater() {
+            config.computeUnits = .cpuOnly
+        }
+#endif
+
         // Text tokenizer and encoder
         let tokenizer = try BPETokenizer(mergesAt: mergesURL, vocabularyAt: vocabURL)
         let textEncoderModel = try MLModel(contentsOf: textEncoderURL, configuration: config)
```

**File**: `Queryable/Queryable/View/SearchResultsView.swift` (modified, +18/-10)
```diff
@@ -294,7 +294,19 @@ struct SearchResultsView_Previews: PreviewProvider {
 import UIKit
 
 public extension UIDevice {
+    static func chipIsA13OrLater() -> Bool {
+        let devicePattern = /(AppleTV|iPad|iPhone|Watch|iPod)(\d+),(\d+)/
+        
+        if let match = current.model.firstMatch(of: devicePattern) {
+            let deviceModel = match.1
+            let majorRevision = Int(match.2)!
+            
+            return (deviceModel == "iPhone" || deviceModel == "iPad") && majorRevision >= 12
+        }
 
+        return false
+    }
+    
     static let modelIsValid: Bool = {
         var systemInfo = utsname()
         uname(&systemInfo)
@@ -304,22 +316,18 @@ public extension UIDevice {
             return identifier + String(UnicodeScalar(UInt8(value)))
         }
 
-        func isDeviceValid(identifier: String) -> Bool { // swiftlint:disable:this cyclomatic_complexity
-            #if os(iOS)
-            switch identifier {
-            case "iPhone10,3", "iPhone10,6":                      return false // "iPhone X"
-            case "iPhone11,2":                                    return false // "iPhone XS"
-            case "iPhone11,4", "iPhone11,6":                      return  false // "iPhone XS Max"
-            case "iPhone11,8":                                    return false // "iPhone XR"
-            default:                                              return true
-            }
-            #elseif os(tvOS)
+        
+        func isDeviceValid(identifier: String) -> Bool {
+            // swiftlint:disable:this cyclomatic_complexity
+            #if os(tvOS)
             switch identifier {
             case "AppleTV5,3": return false
             case "AppleTV6,2": return false
             case "i386", "x86_64": return false
             default: return false
             }
+            #elseif os(iOS)
+            return true
             #endif
         }
 
```

---

### Incident Patch 9: `cbce5b21` (2023-09-22)
**Commit Message**: fix iOS 17 support issue.

**File**: `PyTorch2CoreML.ipynb` (modified, +27/-129)
```diff
@@ -2,18 +2,10 @@
  "cells": [
   {
    "cell_type": "code",
-   "execution_count": 1,
+   "execution_count": null,
    "id": "801db364",
    "metadata": {},
-   "outputs": [
-    {
-     "name": "stderr",
-     "output_type": "stream",
-     "text": [
-      "scikit-learn version 1.2.2 is not supported. Minimum required version: 0.17. Maximum required version: 1.1.2. Disabling scikit-learn conversion API.\n"
-     ]
-    }
-   ],
+   "outputs": [],
    "source": [
     "import torch\n",
     "import clip\n",
@@ -32,7 +24,7 @@
   },
   {
    "cell_type": "code",
-   "execution_count": 4,
+   "execution_count": null,
    "id": "9ebc2db9",
    "metadata": {},
    "outputs": [],
@@ -62,7 +54,7 @@
   },
   {
    "cell_type": "code",
-   "execution_count": 5,
+   "execution_count": null,
    "id": "8f89976b",
    "metadata": {},
    "outputs": [],
@@ -118,7 +110,7 @@
   },
   {
    "cell_type": "code",
-   "execution_count": 6,
+   "execution_count": null,
    "id": "c87abd71",
    "metadata": {},
    "outputs": [],
@@ -205,47 +197,28 @@
   },
   {
    "cell_type": "code",
-   "execution_count": 7,
+   "execution_count": null,
    "id": "c018fe96",
    "metadata": {},
-   "outputs": [
-    {
-     "name": "stdout",
-     "output_type": "stream",
-     "text": [
-      "text_projection shape: torch.Size([512, 512])\n"
-     ]
-    }
-   ],
+   "outputs": [],
    "source": [
     "text_encoder = TextEncoder(embed_dim=512, context_length=77, vocab_size=49408, \n",
     "                           transformer_width=512, transformer_heads=8, transformer_layers=12)"
    ]
   },
   {
    "cell_type": "code",
-   "execution_count": 8,
+   "execution_count": null,
    "id": "658075c8",
    "metadata": {},
-   "outputs": [
-    {
-     "data": {
-      "text/plain": [
-       "_IncompatibleKeys(missing_keys=['temperature'], unexpected_keys=['visual.class_embedding', 'visual.positional_embedding', 'visual.proj', 'visual.conv1.weight', 'visual.ln_pre.weight', 'visual.ln_pre.bias', 'visual.transformer.resblocks.0.attn.in_proj_weight', 'visual.transformer.resblocks.0.attn.in_proj_bias', 'visual.transformer.resblocks.0.attn.out_proj.weight', 'visual.transformer.resblocks.0.attn.out_proj.bias', 'visual.transformer.resblocks.0.ln_1.weight', 'visual.transformer.resblocks.0.ln_1.bias', 'visual.transformer.resblocks.0.mlp.c_fc.weight', 'visual.transformer.resblocks.0.mlp.c_fc.bias', 'visual.transformer.resblocks.0.mlp.c_proj.weight', 'visual.transformer.resblocks.0.mlp.c_proj.bias', 'visual.transformer.resblocks.0.ln_2.weight', 'visual.transformer.resblocks.0.ln_2.bias', 'visual.transformer.resblocks.1.attn.in_proj_weight', 'visual.transformer.resblocks.1.attn.in_proj_bias', 'visual.transformer.resblocks.1.attn.out_proj.weight', 'visual.transformer.resblocks.1.attn.out_proj.bias', 'visual.transformer.resblocks.1.ln_1.weight', 'visual.transformer.resblocks.1.ln_1.bias', 'visual.transformer.resblocks.1.mlp.c_fc.weight', 'visual.transformer.resblocks.1.mlp.c_fc.bias', 'visual.transformer.resblocks.1.mlp.c_proj.weight', 'visual.transformer.resblocks.1.mlp.c_proj.bias', 'visual.transformer.resblocks.1.ln_2.weight', 'visual.transformer.resblocks.1.ln_2.bias', 'visual.transformer.resblocks.2.attn.in_proj_weight', 'visual.transformer.resblocks.2.attn.in_proj_bias', 'visual.transformer.resblocks.2.attn.out_proj.weight', 'visual.transformer.resblocks.2.attn.out_proj.bias', 'visual.transformer.resblocks.2.ln_1.weight', 'visual.transformer.resblocks.2.ln_1.bias', 'visual.transformer.resblocks.2.mlp.c_fc.weight', 'visual.transformer.resblocks.2.mlp.c_fc.bias', 'visual.transformer.resblocks.2.mlp.c_proj.weight', 'visual.transformer.resblocks.2.mlp.c_proj.bias', 'visual.transformer.resblocks.2.ln_2.weight', 'visual.transformer.resblocks.2.ln_2.bias', 'visual.transformer.resblocks.3.attn.in_proj_weight', 'visual.transformer.resblocks.3.attn.in_proj_bias', 'visual.transformer.resblocks.3.attn.out_proj.weight', 'visual.transformer.resblocks.3.attn.out_proj.bias', 'visual.transformer.resblocks.3.ln_1.weight', 'visual.transformer.resblocks.3.ln_1.bias', 'visual.transformer.resblocks.3.mlp.c_fc.weight', 'visual.transformer.resblocks.3.mlp.c_fc.bias', 'visual.transformer.resblocks.3.mlp.c_proj.weight', 'visual.transformer.resblocks.3.mlp.c_proj.bias', 'visual.transformer.resblocks.3.ln_2.weight', 'visual.transformer.resblocks.3.ln_2.bias', 'visual.transformer.resblocks.4.attn.in_proj_weight', 'visual.transformer.resblocks.4.attn.in_proj_bias', 'visual.transformer.resblocks.4.attn.out_proj.weight', 'visual.transformer.resblocks.4.attn.out_proj.bias', 'visual.transformer.resblocks.4.ln_1.weight', 'visual.transformer.resblocks.4.ln_1.bias', 'visual.transformer.resblocks.4.mlp.c_fc.weight', 'visual.transformer.resblocks.4.mlp.c_fc.bias', 'visual.transformer.resblocks.4.mlp.c_proj.weight', 'visual.transformer.resblocks.4.mlp.c_proj.bias', 'visual.transformer.resblocks.4.ln_2.weight', 'visual.transformer.resblocks.4.ln_2.bias', 'visual.transformer.resblocks.5
```

---

### Incident Patch 10: `a310d30e` (2023-09-22)
**Commit Message**: fix iOS 17 support issue.

**File**: `PyTorch2CoreML.ipynb` (modified, +29/-18)
```diff
@@ -2,10 +2,18 @@
  "cells": [
   {
    "cell_type": "code",
-   "execution_count": 106,
+   "execution_count": 1,
    "id": "801db364",
    "metadata": {},
-   "outputs": [],
+   "outputs": [
+    {
+     "name": "stderr",
+     "output_type": "stream",
+     "text": [
+      "scikit-learn version 1.2.2 is not supported. Minimum required version: 0.17. Maximum required version: 1.1.2. Disabling scikit-learn conversion API.\n"
+     ]
+    }
+   ],
    "source": [
     "import torch\n",
     "import clip\n",
@@ -24,15 +32,15 @@
   },
   {
    "cell_type": "code",
-   "execution_count": 12,
+   "execution_count": 4,
    "id": "9ebc2db9",
    "metadata": {},
    "outputs": [],
    "source": [
     "device=\"cpu\"\n",
     "model, preprocess = clip.load(\"ViT-B/32\", device=device)\n",
     "text = clip.tokenize(\"a diagram\").to(device)\n",
-    "i = Image.open(\"IMG_3628.jpg\")\n",
+    "i = Image.open(\"IMG_7466.jpg\")\n",
     "image = preprocess(i).unsqueeze(0).to(device)\n",
     "\n",
     "with torch.no_grad():\n",
@@ -54,7 +62,7 @@
   },
   {
    "cell_type": "code",
-   "execution_count": 19,
+   "execution_count": 5,
    "id": "8f89976b",
    "metadata": {},
    "outputs": [],
@@ -110,7 +118,7 @@
   },
   {
    "cell_type": "code",
-   "execution_count": 20,
+   "execution_count": 6,
    "id": "c87abd71",
    "metadata": {},
    "outputs": [],
@@ -197,7 +205,7 @@
   },
   {
    "cell_type": "code",
-   "execution_count": 24,
+   "execution_count": 7,
    "id": "c018fe96",
    "metadata": {},
    "outputs": [
@@ -216,7 +224,7 @@
   },
   {
    "cell_type": "code",
-   "execution_count": 25,
+   "execution_count": 8,
    "id": "658075c8",
    "metadata": {},
    "outputs": [
@@ -226,7 +234,7 @@
        "_IncompatibleKeys(missing_keys=['temperature'], unexpected_keys=['visual.class_embedding', 'visual.positional_embedding', 'visual.proj', 'visual.conv1.weight', 'visual.ln_pre.weight', 'visual.ln_pre.bias', 'visual.transformer.resblocks.0.attn.in_proj_weight', 'visual.transformer.resblocks.0.attn.in_proj_bias', 'visual.transformer.resblocks.0.attn.out_proj.weight', 'visual.transformer.resblocks.0.attn.out_proj.bias', 'visual.transformer.resblocks.0.ln_1.weight', 'visual.transformer.resblocks.0.ln_1.bias', 'visual.transformer.resblocks.0.mlp.c_fc.weight', 'visual.transformer.resblocks.0.mlp.c_fc.bias', 'visual.transformer.resblocks.0.mlp.c_proj.weight', 'visual.transformer.resblocks.0.mlp.c_proj.bias', 'visual.transformer.resblocks.0.ln_2.weight', 'visual.transformer.resblocks.0.ln_2.bias', 'visual.transformer.resblocks.1.attn.in_proj_weight', 'visual.transformer.resblocks.1.attn.in_proj_bias', 'visual.transformer.resblocks.1.attn.out_proj.weight', 'visual.transformer.resblocks.1.attn.out_proj.bias', 'visual.transformer.resblocks.1.ln_1.weight', 'visual.transformer.resblocks.1.ln_1.bias', 'visual.transformer.resblocks.1.mlp.c_fc.weight', 'visual.transformer.resblocks.1.mlp.c_fc.bias', 'visual.transformer.resblocks.1.mlp.c_proj.weight', 'visual.transformer.resblocks.1.mlp.c_proj.bias', 'visual.transformer.resblocks.1.ln_2.weight', 'visual.transformer.resblocks.1.ln_2.bias', 'visual.transformer.resblocks.2.attn.in_proj_weight', 'visual.transformer.resblocks.2.attn.in_proj_bias', 'visual.transformer.resblocks.2.attn.out_proj.weight', 'visual.transformer.resblocks.2.attn.out_proj.bias', 'visual.transformer.resblocks.2.ln_1.weight', 'visual.transformer.resblocks.2.ln_1.bias', 'visual.transformer.resblocks.2.mlp.c_fc.weight', 'visual.transformer.resblocks.2.mlp.c_fc.bias', 'visual.transformer.resblocks.2.mlp.c_proj.weight', 'visual.transformer.resblocks.2.mlp.c_proj.bias', 'visual.transformer.resblocks.2.ln_2.weight', 'visual.transformer.resblocks.2.ln_2.bias', 'visual.transformer.resblocks.3.attn.in_proj_weight', 'visual.transformer.resblocks.3.attn.in_proj_bias', 'visual.transformer.resblocks.3.attn.out_proj.weight', 'visual.transformer.resblocks.3.attn.out_proj.bias', 'visual.transformer.resblocks.3.ln_1.weight', 'visual.transformer.resblocks.3.ln_1.bias', 'visual.transformer.resblocks.3.mlp.c_fc.weight', 'visual.transformer.resblocks.3.mlp.c_fc.bias', 'visual.transformer.resblocks.3.mlp.c_proj.weight', 'visual.transformer.resblocks.3.mlp.c_proj.bias', 'visual.transformer.resblocks.3.ln_2.weight', 'visual.transformer.resblocks.3.ln_2.bias', 'visual.transformer.resblocks.4.attn.in_proj_weight', 'visual.transformer.resblocks.4.attn.in_proj_bias', 'visual.transformer.resblocks.4.attn.out_proj.weight', 'visual.transformer.resblocks.4.attn.out_proj.bias', 'visual.transformer.resblocks.4.ln_1.weight', 'visual.transformer.resblocks.4.ln_1.bias', 'visual.transformer.resblocks.4.mlp.c_fc.weight', 'visual.transformer.resblocks.4.mlp.c_fc.bias', 'visual.transformer.resblocks.4.mlp.c_proj.weight', 'visual.transformer.resblocks.4.mlp.c_proj.bias', 'visual.transformer.resblocks.4.ln_2.weight', 'visual.transformer.resblocks.4.ln_2.bias', 'visual.transformer.resblocks.5.attn.in_proj_weight', 'visual.transformer.resblocks.5
```

---

### Incident Patch 11: `269a81a0` (2023-07-13)
**Commit Message**: [fix]:CoreMLModels, No such file or directory

**File**: `Queryable/Queryable.xcodeproj/project.pbxproj` (modified, +6/-6)
```diff
@@ -7,6 +7,7 @@
 	objects = {
 
 /* Begin PBXBuildFile section */
+		4D3B1D642A5F95300004C06F /* CoreMLModels in Resources */ = {isa = PBXBuildFile; fileRef = 4D3B1D632A5F95300004C06F /* CoreMLModels */; };
 		94E9174B2A5A45C000324937 /* QueryableApp.swift in Sources */ = {isa = PBXBuildFile; fileRef = 94E9174A2A5A45C000324937 /* QueryableApp.swift */; };
 		94E917522A5A45C200324937 /* Preview Assets.xcassets in Resources */ = {isa = PBXBuildFile; fileRef = 94E917512A5A45C200324937 /* Preview Assets.xcassets */; };
 		94E917B12A5A475B00324937 /* TextEncoder.swift in Sources */ = {isa = PBXBuildFile; fileRef = 94E9178D2A5A475B00324937 /* TextEncoder.swift */; };
@@ -42,7 +43,6 @@
 		94E917DE2A5A47A300324937 /* Localizable.strings in Resources */ = {isa = PBXBuildFile; fileRef = 94E917D42A5A47A300324937 /* Localizable.strings */; };
 		94E917DF2A5A47A300324937 /* Localizable.strings in Resources */ = {isa = PBXBuildFile; fileRef = 94E917D72A5A47A300324937 /* Localizable.strings */; };
 		94E917E02A5A47A300324937 /* Localizable.strings in Resources */ = {isa = PBXBuildFile; fileRef = 94E917DA2A5A47A300324937 /* Localizable.strings */; };
-		94E917E22A5A48D600324937 /* CoreMLModels in Resources */ = {isa = PBXBuildFile; fileRef = 94E917E12A5A48D600324937 /* CoreMLModels */; };
 		94ECA38F2A5D52060066F64B /* Assets.xcassets in Resources */ = {isa = PBXBuildFile; fileRef = 94ECA38E2A5D52050066F64B /* Assets.xcassets */; };
 /* End PBXBuildFile section */
 
@@ -64,6 +64,7 @@
 /* End PBXContainerItemProxy section */
 
 /* Begin PBXFileReference section */
+		4D3B1D632A5F95300004C06F /* CoreMLModels */ = {isa = PBXFileReference; lastKnownFileType = folder; path = CoreMLModels; sourceTree = "<group>"; };
 		94E917472A5A45C000324937 /* Queryable.app */ = {isa = PBXFileReference; explicitFileType = wrapper.application; includeInIndex = 0; path = Queryable.app; sourceTree = BUILT_PRODUCTS_DIR; };
 		94E9174A2A5A45C000324937 /* QueryableApp.swift */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = QueryableApp.swift; sourceTree = "<group>"; };
 		94E917512A5A45C200324937 /* Preview Assets.xcassets */ = {isa = PBXFileReference; lastKnownFileType = folder.assetcatalog; path = "Preview Assets.xcassets"; sourceTree = "<group>"; };
@@ -102,7 +103,6 @@
 		94E917D52A5A47A300324937 /* fr */ = {isa = PBXFileReference; lastKnownFileType = text.plist.strings; name = fr; path = Localizable.strings; sourceTree = "<group>"; };
 		94E917D82A5A47A300324937 /* it */ = {isa = PBXFileReference; lastKnownFileType = text.plist.strings; name = it; path = Localizable.strings; sourceTree = "<group>"; };
 		94E917DB2A5A47A300324937 /* es */ = {isa = PBXFileReference; lastKnownFileType = text.plist.strings; name = es; path = Localizable.strings; sourceTree = "<group>"; };
-		94E917E12A5A48D600324937 /* CoreMLModels */ = {isa = PBXFileReference; lastKnownFileType = folder; name = CoreMLModels; path = ../../../../../SwiftUI/ML/SnapSearch/SnapSearch/SnapSearch/CoreMLModels; sourceTree = "<group>"; };
 		94ECA38E2A5D52050066F64B /* Assets.xcassets */ = {isa = PBXFileReference; lastKnownFileType = folder.assetcatalog; path = Assets.xcassets; sourceTree = "<group>"; };
 /* End PBXFileReference section */
 
@@ -157,7 +157,7 @@
 		94E917492A5A45C000324937 /* Queryable */ = {
 			isa = PBXGroup;
 			children = (
-				94E917E12A5A48D600324937 /* CoreMLModels */,
+				4D3B1D632A5F95300004C06F /* CoreMLModels */,
 				94E9178C2A5A475B00324937 /* CLIP */,
 				94E917922A5A475B00324937 /* Model */,
 				94E917962A5A475B00324937 /* PhotoHelper */,
@@ -423,7 +423,7 @@
 			files = (
 				94E917DE2A5A47A300324937 /* Localizable.strings in Resources */,
 				94E917DF2A5A47A300324937 /* Localizable.strings in Resources */,
-				94E917E22A5A48D600324937 /* CoreMLModels in Resources */,
+				4D3B1D642A5F95300004C06F /* CoreMLModels in Resources */,
 				94E917522A5A45C200324937 /* Preview Assets.xcassets in Resources */,
 				94E917E02A5A47A300324937 /* Localizable.strings in Resources */,
 				94E917DD2A5A47A300324937 /* Localizable.strings in Resources */,
@@ -680,7 +680,7 @@
 				CODE_SIGN_STYLE = Automatic;
 				CURRENT_PROJECT_VERSION = 1;
 				DEVELOPMENT_ASSET_PATHS = "\"Queryable/Preview Content\"";
-				DEVELOPMENT_TEAM = 8ZKRT2YUM5;
+				DEVELOPMENT_TEAM = "";
 				ENABLE_PREVIEWS = YES;
 				GENERATE_INFOPLIST_FILE = YES;
 				INFOPLIST_KEY_NSPhotoLibraryUsageDescription = "Allow access to all your photos for offline search.";
@@ -711,7 +711,7 @@
 				CODE_SIGN_STYLE = Automatic;
 				CURRENT_PROJECT_VERSION = 1;
 				DEVELOPMENT_ASSET_PATHS = "\"Queryable/Preview Content\"";
-				DEVELOPMENT_TEAM = 8ZKRT2YUM5;
+				DEVELOPMENT_TEAM = "";
 				ENABLE_PREVIEWS = YES;
 				GENERATE_INFOPLIST_FILE = YES;
 				INFOPLIST_KEY_NSPhotoLibraryUsageDescription = "Allow access to all your photos for offline search.";
```

#### Recent Merged Pull Requests:
- **PR #37** (2024-02-07): we don't need to load text encoder when finish build index (@yujinqiu)
- **PR #36** (2024-02-06): Refactor code (@yujinqiu)
- **PR #34** (2024-02-05): Refactor code (@yujinqiu)
- **PR #33** (2024-02-04): Fix img_emb_pieces_lst with one empty element bug and refactor code (@yujinqiu)
- **PR #27** (2023-11-13): Fixes #26 (@HKdAlex)
- **PR #23** (2023-11-01): Update ConfigView.swift (@ShrootBuck)
- **PR #22** (closed): Accept limited photo library authorization (@JadenGeller)
- **PR #21** (2023-11-01): Refactor Code (@yujinqiu)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

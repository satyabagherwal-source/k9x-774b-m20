# Candidate Directive: [CD-6XZA] Acoustic Boundary Cut Invariant for Audio Chunking

<!-- PROVENANCE_START
{
  "source_repository": "yazinsai/OpenOats",
  "source_url": "https://github.com/yazinsai/OpenOats",
  "source_version": "2d6e6ce5",
  "license": "MIT",
  "timestamp": "2026-11-21T08:24:47.494Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-yazinsai-openoats",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [yazinsai/OpenOats](https://github.com/yazinsai/OpenOats) (Revision: `2d6e6ce5`).  
> **License**: MIT | **Timestamp**: `2026-11-21T08:24:47.494Z`  
> **Learning ID**: `learn-github-yazinsai-openoats`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When splitting continuous multi-hour spoken audio into discrete chunks for cloud processing or inference context boundaries, the split boundary MUST NOT be placed at an arbitrary fixed-time or fixed-frame boundary. The split boundary MUST be dynamically located within a backward-looking search window ($W_{\text{search}} \le 5\text{ s}$) centered before the maximum chunk duration limit, positioned at the lowest RMS energy frame ($E_{\min}$) of duration $\ge 10\text{ ms}$.

**WHY**:
Cutting audio at arbitrary chunk boundaries cuts phonemes and words in half. Cloud transcription and local acoustic models hallucinate or drop syllables at clipped boundaries, leading to mangled words across boundary transitions. Locating the minimum-energy frame guarantees the split occurs during natural conversational silence or unvoiced inter-word pauses.

**WHEN TO APPLY**:
Apply in any system processing audio streams exceeding backend ingestion ceilings (e.g., Gemini 20 MB inline caps, Whisper 25 MB caps, AssemblyAI/ElevenLabs chunking thresholds).

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
extension TrackAudio {
    /// Writes the track as compressed chunks of at most `maxSeconds` into `directory`.
    /// Each cut lands on the quietest 10 ms in the chunk's last 5 s (or last tenth for short chunks).
    public static func compressedChunks(
        of url: URL, 
        maxSeconds: TimeInterval, 
        sampleRate: Double,
        in directory: URL
    ) throws -> [AudioChunk] {
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let limit = Int(maxSeconds * sampleRate)
        let window = min(Int(5 * sampleRate), limit / 10)
        var chunks: [AudioChunk] = []
        var file: AVAudioFile?
        var written = 0, consumed = 0
        var pending: [Float] = []

        func write(_ count: Int) throws {
            guard count > 0 else { return }
            if file == nil {
                let chunkURL = directory.appendingPathComponent("chunk-\(chunks.count).m4a")
                let chunk = AudioChunk(url: chunkURL, offset: Double(consumed) / sampleRate)
                chunks.append(chunk)
                file = try AVAudioFile(
                    forWriting: chunk.url,
                    settings: [
                        AVFormatIDKey: kAudioFormatMPEG4AAC,
                        AVSampleRateKey: sampleRate,
                        AVNumberOfChannelsKey: 1,
                        AVEncoderBitRateKey: 32_000,
                    ],
                    commonFormat: .pcmFormatFloat32,
                    interleaved: false
                )
            }
            let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: AVAudioFrameCount(count))!
            buffer.frameLength = AVAudioFrameCount(count)
            pending.withUnsafeBufferPointer { ptr in
                buffer.floatChannelData![0].update(from: ptr.baseAddress!, count: count)
            }
            try file!.write(from: buffer)
            pending.removeFirst(count)
            written += count
            consumed += count
        }

        try forEachChunk(of: url) { buffer in
            pending.append(contentsOf: UnsafeBufferPointer(start: buffer.floatChannelData![0], count: Int(buffer.frameLength)))
            while written + pending.count > limit {
                // Dynamically seek the lowest-energy 10ms frame in the tail window
                let cutPoint = quietestCut(pending, from: limit - written - window, to: limit - written)
                try write(cutPoint)
                file = nil
                written = 0
            }
            try write(max(0, min(pending.count, limit - window - written)))
        }
        try write(pending.count)
        return chunks
    }

    /// Evaluates squared energy across consecutive 160-sample (10ms at 16kHz) windows
    static func quietestCut(_ samples: [Float], from start: Int, to end: Int) -> Int {
        let frame = 160
        var best = end
        var bestEnergy = Float.infinity
        let safeStart = max(start, 0)
        guard safeStart <= end - frame else { return max(end, 1) }

        for i in stride(from: safeStart, through: end - frame, by: frame) {
            var energy: Float = 0
            for j in i..<(i + frame) {
                let val = samples[j]
                energy += val * val
            }
            if energy < bestEnergy {
                bestEnergy = energy
                best = i + (frame / 2) // Midpoint of quietest frame
            }
        }
        return max(best, 1)
    }
}
```

**NEGATIVE CONSTRAINT**:
```swift
// ANTI-PATTERN: Fixed slice window splitting regardless of audio waveform amplitude
func badSplit(samples: [Float], chunkSize: Int) -> [[Float]] {
    var chunks: [[Float]] = []
    for i in stride(from: 0, to: samples.count, by: chunkSize) {
        let end = min(i + chunkSize, samples.count)
        chunks.append(Array(samples[i..<end])) // HARD CUT: Mid-vowel / mid-consonant split creates click artifact and cuts speech models
    }
    return chunks
}
```

**VERIFICATION METHOD**:
Generate a synthetic sine wave containing periodic silence intervals (e.g., 500 ms speech followed by 50 ms zeros). Run `compressedChunks` targeting a boundary near the silence interval. Assert through automated test that the calculated cut point index falls strictly within the zero-amplitude interval rather than the sine-wave crest or trough.

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-21T08:24:47.492Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795249487492",
    "title": "Acoustic Boundary Cut Invariant for Audio Chunking",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "yazinsai/OpenOats",
    "source_uri": "https://github.com/yazinsai/OpenOats",
    "source_version": "HEAD",
    "content_hash": "50896ac5f52fe1e4ae3cc07dd21b6a9c57c2a5f7f3af5dfbe0096d44bb617756"
  },
  "evidence_fingerprint": "5c7fbcc97293e38f",
  "dimensions": {
    "source_reliability": {
      "status": "PASS",
      "score": 0.6,
      "tier": "TIER_3_COMMUNITY_OPEN",
      "findings": [],
      "details": [
        "Source originates from community open repository",
        "Source version unpinned (HEAD), subject to upstream drift",
        "Cryptographic SHA-256 payload integrity hash present"
      ]
    },
    "evidence_quality": {
      "status": "FAIL",
      "score": 0,
      "corroboration_tier": "INDEPENDENCE_UNVERIFIED",
      "effective_sources": 0,
      "direct_evidence_ratio": 0,
      "findings": [],
      "details": [
        "Direct empirical evidence ratio: 0% (0/5)",
        "Evidence-to-claim lexical alignment: 0%"
      ]
    },
    "technical_correctness": {
      "status": "PASS",
      "score": 1,
      "is_adversarial": false,
      "has_dangerous_security": false,
      "directive_opposition": false,
      "opposing_rule": null,
      "unsupported_assumptions": [],
      "findings": [],
      "details": [
        "No direct opposition with canonical operating directives",
        "Substantive technical content verified (> 40 chars)"
      ]
    },
    "reusability": {
      "status": "PASS",
      "score": 1,
      "is_generic_pattern": true,
      "has_local_paths": false,
      "findings": [],
      "details": [
        "Free of local workstation path artifacts",
        "Expresses generalized engineering invariants (4 architectural markers)",
        "Explicit WHEN TO APPLY scope defined"
      ]
    },
    "completeness": {
      "status": "PASS",
      "score": 1,
      "has_rule": true,
      "has_why": true,
      "has_when": true,
      "missing_fields": [],
      "details": [
        "Preserves normative RULE declaration",
        "Preserves technical rationale (WHY)",
        "Preserves operational boundary (WHEN TO APPLY)",
        "Includes explicit negative example / anti-pattern contrast"
      ]
    },
    "freshness": {
      "status": "WARN",
      "score": 1,
      "staleness_risk": "MEDIUM",
      "findings": [],
      "details": [
        "Free of known deprecated runtimes (Python 2, Node < 14, Webpack 1-3, React < 16)",
        "Harvested/verified timestamp recorded: 2026-11-21T08:24:47.492Z"
      ]
    },
    "duplication_and_conflict": {
      "status": "PASS",
      "score": 1,
      "is_duplicate": false,
      "duplicate_target": null,
      "is_contradiction": false,
      "conflicting_rule": null,
      "findings": [],
      "details": []
    }
  },
  "detected_contradictions": [],
  "missing_information": [
    "Empirical evidence records"
  ],
  "limitations": [
    "Staleness risk: MEDIUM"
  ],
  "evidence_references": [
    "EVID-UNSPECIFIED",
    "EVID-UNSPECIFIED",
    "EVID-UNSPECIFIED",
    "EVID-UNSPECIFIED",
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "841ed1b6471ddbca84af767d953eca2a5665616847733d2e51c7f9ea1f685f1d"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

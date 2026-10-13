> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/hf-argmaxinc-whisperkit-coreml-learnings.md`  
> **Source**: huggingface ([https://huggingface.co/argmaxinc/whisperkit-coreml](https://huggingface.co/argmaxinc/whisperkit-coreml))  
> **Source Version**: `hf-argmaxinc`  
> **License**: Open-Source  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-13T09:36:21.067Z  
> **Learning ID**: `learn-huggingface-hf-argmaxinc-whisperkit-coreml-mv6hkqx7`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): argmaxinc/whisperkit-coreml

## 1. Executive Forensic Architecture & System Mechanics

**Technical Problem Solved:**
This repository serves as the **Model Distribution Hub** for **WhisperKit**, an on-device Automatic Speech Recognition (ASR) SDK for Apple Silicon. It does not contain the inference engine code itself (which resides in `argmaxinc/argmax-oss-swift`), but rather the **quantized Core ML model artifacts** and the **device-capability mapping manifest** (`config.json`). The core problem it solves is **heterogeneous hardware compatibility**: ensuring that the correct model size and quantization format is loaded based on the specific Apple Silicon chip (A12 vs. A16 vs. M1) to prevent memory crashes and ensure optimal latency.

**Architectural Boundaries:**
1.  **Separation of Model & Logic:** The repository is strictly data-centric. It contains no executable code, only serialized Core ML models (`.mlmodel` or `.mlpackage`) and JSON configuration.
2.  **Device-Gated Deployment:** The `config.json` acts as a **capability gate**. It defines a strict mapping between `identifiers` (hardware model IDs like `iPhone15`) and `supported` model variants. This prevents a user on an A12 chip from attempting to load a 950MB `large-v3` model, which would trigger an `OOM` (Out of Memory) crash.
3.  **Quantization Strategy:** The model names indicate specific quantization strategies (e.g., `_949MB`, `_turbo`). This implies a trade-off between model precision and memory footprint, tailored for the unified memory architecture of Apple Silicon.

**Critical Subsystem Abstractions:**
*   **Hardware Identifier Registry:** A static list of Apple device identifiers mapped to chip generations.
*   **Model Variant Selector:** Logic (external to this repo, but driven by this config) that selects the `default` model or allows user selection from the `supported` list.
*   **Core ML Artifact Store:** The actual binary weights, likely converted from PyTorch/ONNX to Core ML format with specific quantization (e.g., 8-bit or 4-bit) applied for efficiency.

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Hardware-Capability Gating for ML Model Loading
**RULE**:
When deploying machine learning models to heterogeneous edge devices, you **MUST** implement a static configuration manifest that maps specific hardware identifiers to supported model variants. You **MUST NOT** allow the runtime to attempt loading a model without first verifying that the device's memory and compute capabilities match the model's requirements.

**WHY**:
On mobile and embedded devices, memory is strictly bounded. Loading a model that exceeds the available RAM (e.g., a 1GB model on a 4GB RAM device with OS overhead) will cause an immediate `SIGKILL` or `OOM` crash, which is unrecoverable at the application level. A static gate prevents this class of fatal errors before the model loading process begins.

**WHEN TO APPLY**:
Any system deploying ML models to devices with varying hardware specs (mobile phones, IoT devices, laptops with different RAM configurations).

**VERIFIED IMPLEMENTATION PATTERN**:
```json
// config.json
{
  "device_support": [
    {
      "chips": "A12, A13",
      "identifiers": ["iPhone11", "iPhone12"],
      "models": {
        "default": "tiny",
        "supported": ["tiny", "base"]
      }
    },
    {
      "chips": "A16, M1",
      "identifiers": ["iPhone15", "MacBookPro18,1"],
      "models": {
        "default": "large-v3",
        "supported": ["tiny", "base", "small", "large-v3"]
      }
    }
  ]
}
```
```swift
// Pseudocode for the loader
func loadModel(for deviceID: String) throws -> MLModel {
    let config = try loadConfig()
    guard let deviceEntry = config.deviceSupport.first(where: { $0.identifiers.contains(deviceID) }) else {
        throw ModelError.unsupportedDevice
    }
    let modelID = deviceEntry.models.default
    // Verify modelID is in supported list before loading
    guard deviceEntry.models.supported.contains(modelID) else {
        throw ModelError.modelNotSupportedForDevice
    }
    return try MLModel(contentsOf: modelURL(for: modelID))
}
```

**NEGATIVE CONSTRAINT**:
```swift
// BAD: Attempting to load the largest model by default regardless of device
func loadModel() throws -> MLModel {
    // This will crash on low-end devices
    return try MLModel(contentsOf: URL(string: "large-v3.mlmodel")!)
}
```

**VERIFICATION METHOD**:
1.  **Static Analysis:** A CI script that parses `config.json` and asserts that every `identifier` in the `identifiers` array corresponds to a valid Apple hardware model.
2.  **Integration Test:** A test suite that mocks the device identifier for each entry in `config.json` and asserts that the `loadModel` function returns a valid model object without throwing an `OOM` error.

### 2. Quantization-Aware Model Naming Convention
**RULE**:
When distributing quantized ML models, you **MUST** encode the quantization strategy and approximate memory footprint in the model identifier. You **MUST NOT** use generic names (e.g., `model_v1`) that do not convey the resource cost.

**WHY**:
Quantization (e.g., FP16 to INT8) significantly reduces memory usage but can impact accuracy. By encoding the size (e.g., `_949MB`) and strategy (`_turbo`) in the name, developers and users can make informed decisions about which model to load based on their specific latency and accuracy requirements. It also helps in debugging memory issues by providing immediate visibility into the expected resource cost.

**WHEN TO APPLY**:
Any project distributing multiple variants of the same model with different precision or compression levels.

**VERIFIED IMPLEMENTATION PATTERN**:
```json
"supported": [
    "openai_whisper-large-v3_947MB",
    "openai_whisper-large-v3_turbo_954MB",
    "distil-whisper_distil-large-v3_594MB"
]
```

**NEGATIVE CONSTRAINT**:
```json
"supported": [
    "model_a",
    "model_b",
    "model_c"
]
```

**VERIFICATION METHOD**:
A linting rule that checks if model names in the configuration match a regex pattern that includes a size indicator (e.g., `\d+MB`) or a quantization tag (e.g., `int8`, `turbo`).

## 3. Forensic Real Incidents & Production Patches (Incidents 1 to 5+)

*Note: The provided data does not contain specific commit SHAs, PR links, or bug issue details. Therefore, no specific production incidents can be documented. The following section is omitted as per the instruction to document "real" incidents only.*

## 4. Microscopic Code-Level Invariants (Syntax, Infinite Loop, UI/UX & Concurrency Guards)

Since this repository is a data-only repository (JSON config + binary models), the microscopic code-level invariants apply to the **consumer code** (the Swift SDK) that interprets this data.

1.  **Micro-Syntax & Token-Level Precision**:
    *   **Invariant:** When parsing `config.json`, the `identifiers` array must be treated as a **case-sensitive** list. Apple hardware identifiers (e.g., `iPhone15`) are strictly case-sensitive. A mismatch (e.g., `iphone15`) will result in a `nil` lookup, leading to a fallback to a default model or a crash if not handled.
    *   **Code Example:**
        ```swift
        // BAD: Case-insensitive comparison
        let deviceID = UIDevice.current.model.lowercased()
        let match = config.identifiers.first { $0.lowercased() == deviceID }
        
        // GOOD: Exact match
        let deviceID = UIDevice.current.model
        let match = config.identifiers.first { $0 == deviceID }
        ```

2.  **Infinite Loop & Recursion Guards**:
    *   **Invariant:** The model selection logic must be **non-recursive**. It should be a single-pass lookup in the `device_support` array. If no match is found, it must fail fast with a clear error, not retry or loop.

3.  **UI & UX Micro-Mechanics**:
    *   **Invariant:** N/A (No UI code in this repo).

4.  **Backend Concurrency & Memory Safety**:
    *   **Invariant:** The `config.json` file must be loaded **once** at application startup and cached in memory. Repeatedly reading and parsing the JSON file on every model load request will cause unnecessary I/O overhead and potential race conditions if the file is modified concurrently (though unlikely in a static bundle).
    *   **Code Example:**
        ```swift
        // BAD: Loading config on every request
        func getModel() throws -> MLModel {
            let config = try loadConfigFromDisk() // Expensive I/O
            // ...
        }
        
        // GOOD: Load once, cache
        class ModelManager {
            private static let shared = ModelManager()
            private let config: DeviceConfig
            
            private init() {
                self.config = try! loadConfigFromDisk() // Load once
            }
            
            func getModel() throws -> MLModel {
                // Use cached config
            }
        }
        ```

5.  **Defect & Error Prevention ("Galti Pakadna")**:
    *   **Invariant:** The `default` model in `config.json` **MUST** be present in the `supported` array for that device entry. If the `default` model is not in `supported`, the loader will fail when trying to load the default model.
    *   **Code Example:**
        ```json
        // BAD: Default not in supported
        "models": {
            "default": "large-v3",
            "supported": ["tiny", "base"]
        }
        
        // GOOD: Default is in supported
        "models": {
            "default": "base",
            "supported": ["tiny", "base"]
        }
        ```

## 5. The 9 Deep Learning Dimensions

1.  **Architecture:**
    *   **Subsystem Boundaries:** Clear separation between model distribution (this repo) and model execution (Swift SDK).
    *   **Decoupling:** The SDK is decoupled from specific model versions by using a configuration-driven approach.
    *   **State Ownership:** The SDK owns the state of the loaded model; the repo is stateless.

2.  **Core Abstractions:**
    *   **Key Types:** `DeviceConfig`, `ModelVariant`, `HardwareIdentifier`.
    *   **Domain Primitives:** `chip`, `identifier`, `model_id`, `size_mb`.
    *   **Invariant Contracts:** `default` must be in `supported`; `identifiers` must be unique across device entries.

3.  **Error Handling:**
    *   **Fault Boundaries:** The loader must handle `unsupportedDevice`, `modelNotFound`, and `modelLoadFailed` errors.
    *   **Graceful Degradation:** If the preferred model fails to load, the SDK could fall back to a smaller model (e.g., `tiny`) if available, but this must be explicitly configured.

4.  **Testing:**
    *   **Property Testing:** Test that for every device identifier in the config, the `default` model is in the `supported` list.
    *   **Integration Harness:** A test that simulates loading a model for each device entry and asserts that the model loads successfully.

5.  **Security:**
    *   **Threat Model:** Malicious model files could contain exploits. The SDK must validate the integrity of the model files (e.g., checksums) before loading.
    *   **Least Privilege:** The SDK should only have read access to the model files.

6.  **Performance:**
    *   **Latency Profiles:** Model loading time is a critical performance metric. The SDK should load models asynchronously and provide progress updates.
    *   **Caching:** The config file should be cached in memory.
    *   **Concurrency Bottlenecks:** Model loading is CPU-intensive and should be performed on a background thread.

7.  **Deployment:**
    *   **CI/CD Invariants:** The CI pipeline must validate the `config.json` file and ensure that all referenced model files exist in the repository.
    *   **Reproducible Builds:** The model files must be generated using a deterministic process to ensure consistency.

8.  **Agent Patterns:**
    *   **Tooling Interfaces:** The SDK provides a simple API for loading and running models.
    *   **Loop Guards:** The model inference loop must have a timeout to prevent infinite loops.

9.  **Data Flow:**
    *   **Mutation Lifecycles:** The model files are immutable. The SDK loads them into memory and does not modify them.
    *   **Streams:** Audio input is streamed to the model in chunks.
    *   **Serializers:** The model files are serialized in Core ML format.

## 6. The 8 Learning Extraction Artifacts

1.  **Pattern:** Configuration-driven model selection based on hardware identifiers.
2.  **Rule:** Always gate model loading by hardware capability.
3.  **Architecture Principle:** Separate model distribution from model execution.
4.  **Failure Mode:** OOM crash due to loading a model that exceeds device memory.
5.  **Reusable Skill:** How to create a device-capability manifest for ML models.
6.  **Decision:** Use static configuration instead of dynamic capability detection to avoid runtime overhead.
7.  **Anti-pattern:** Loading the largest model by default regardless of device.
8.  **Verification Method:** Static analysis of `config.json` and integration tests for model loading.

## 7. Actionable Agent Skill & Implementation Checklist

1.  **Define Hardware Tiers:** Identify the different hardware tiers (e.g., low-end, mid-range, high-end) and their corresponding Apple device identifiers.
2.  **Select Model Variants:** For each hardware tier, select the appropriate model variants (e.g., `tiny`, `base`, `small`, `large`).
3.  **Create Configuration File:** Create a `config.json` file that maps hardware identifiers to supported model variants.
4.  **Validate Configuration:** Write a script to validate the `config.json` file (e.g., check that `default` is in `supported`).
5.  **Implement Loader:** Implement a model loader in the SDK that reads the `config.json` file and selects the appropriate model based on the device identifier.
6.  **Test Loader:** Write integration tests to verify that the loader selects the correct model for each device identifier.
7.  **Deploy Models:** Upload the model files to the repository and ensure that the `config.json` file references the correct file paths.
8.  **Monitor Performance:** Monitor the performance of the model loading process and optimize if necessary (e.g., by using asynchronous loading).
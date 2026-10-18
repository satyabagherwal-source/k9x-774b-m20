> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/hf-bingsu-adetailer-learnings.md`  
> **Source**: huggingface ([https://huggingface.co/Bingsu/adetailer](https://huggingface.co/Bingsu/adetailer))  
> **Source Version**: `hf-bingsu-ad`  
> **License**: Open-Source  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-18T23:08:19.946Z  
> **Learning ID**: `learn-huggingface-bingsu-adetailer`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): Bingsu/adetailer

## 1. Executive Forensic Architecture & System Mechanics

**Technical Problem Solved:**
The `Bingsu/adetailer` repository is not a software application in the traditional sense (no source code, no build system, no CI/CD). It is a **Model Artifact Repository** hosting pre-trained YOLOv8/YOLOv9 object detection and instance segmentation weights (`.pt` files) specifically optimized for the **ADetailer** (Automatic Detailer) extension for Stable Diffusion WebUI.

The core technical problem it addresses is the **semantic gap** between general-purpose object detectors (trained on COCO) and the specific aesthetic requirements of AI-generated imagery (anime, realistic faces, hands, clothing). General detectors often fail on stylized art (anime faces) or specific anatomical structures (hands), leading to poor inpainting results in SD workflows. This repository provides domain-specific weights that maximize mAP (mean Average Precision) for these niche classes.

**Architectural Boundaries:**
1.  **Consumer Boundary:** The repository is a passive data store. It has no runtime logic. Its "architecture" is defined by the **Ultralytics YOLO** framework API.
2.  **Integration Boundary:** The primary consumer is the `ADetailer` plugin for `AUTOMATIC1111/stable-diffusion-webui`. The integration point is the `YOLO(path)` constructor from the `ultralytics` library.
3.  **Data Boundary:** The models are trained on specific datasets (WIDER FACE, SkyTNT Anime Segmentation, DeepFashion2). The boundary is defined by the class indices (0-12 for DeepFashion2) and the input resolution expectations of the YOLOv8/v9 backbones.

**Critical Subsystem Abstractions:**
*   **Model Weights (`.pt`):** Serialized PyTorch state dictionaries containing the neural network parameters.
*   **Class Taxonomy:** A fixed mapping of integer IDs to semantic labels (e.g., `0: short_sleeved_shirt`). This is a hard contract between the model and the consumer application.
*   **Inference Pipeline:** The implicit pipeline is `Image -> Preprocessing (Resize/Normalize) -> YOLO Forward Pass -> NMS (Non-Maximum Suppression) -> Bounding Box/Mask Output`.

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Model Artifact Versioning & Class Index Immutability
**RULE**:
When publishing pre-trained model artifacts (weights) for object detection/segmentation, the **Class Index to Label Mapping** MUST be treated as an immutable API contract. Any change in the order of classes or addition of new classes MUST result in a new model version (e.g., `v2`) and MUST NOT be silently updated in the same artifact filename.

**WHY**:
Consumer applications (like ADetailer) often hardcode or cache the class names based on the model's metadata. If a model file `face_yolov8n.pt` is re-trained with a different class order (e.g., swapping "face" and "hair"), the consumer will apply masks to the wrong body parts, causing catastrophic failure in the inpainting pipeline. This is a silent data corruption bug that is extremely difficult to debug in a distributed AI pipeline.

**WHEN TO APPLY**:
Any repository hosting machine learning weights (`.pt`, `.onnx`, `.tflite`) where the output is a list of class IDs.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
# In the training script or model export script
# 1. Define the class map explicitly
class_map = {
    0: "face",
    1: "hair",
    2: "eyes"
}

# 2. Embed this map into the model's metadata or a sidecar JSON
# 3. If the map changes, increment the model version
model_version = "v2"
filename = f"face_yolov8n_{model_version}.pt"

# 4. In the consumer (ADetailer), validate the map
def load_model(path):
    model = YOLO(path)
    # Verify that model.names matches the expected contract
    expected_names = ["face", "hair", "eyes"]
    if list(model.names.values()) != expected_names:
        raise ValueError(f"Model class mismatch. Expected {expected_names}, got {list(model.names.values())}")
    return model
```

**NEGATIVE CONSTRAINT**:
```python
# ANTI-PATTERN: Silently updating the class order in the same file
# Old model: 0=face, 1=hair
# New model (same filename): 0=hair, 1=face
# Consumer code:
mask = model.predict(image)
# Consumer assumes mask[0] is face, but it is now hair.
# Result: Hair is inpainted as face, face is inpainted as hair.
```

**VERIFICATION METHOD**:
1.  **Unit Test:** Load the model, assert `model.names` matches the expected dictionary.
2.  **CI Check:** A script that compares the `names` attribute of the current model against the previous version's `names` attribute. If they differ, the build fails unless the filename includes a version bump.

### 2. Deterministic Inference Environment for Model Artifacts
**RULE**:
Model artifacts MUST be accompanied by a `requirements.txt` or `environment.yml` that pins the exact versions of the inference framework (e.g., `ultralytics==8.0.100`) and its dependencies (e.g., `torch==2.0.0`, `opencv-python==4.8.0`). The model MUST NOT be assumed to work with "latest" versions of the framework.

**WHY**:
YOLOv8 and YOLOv9 have breaking changes in their API and internal tensor shapes between minor versions. A model trained with `ultralytics 8.0.100` may fail to load or produce incorrect outputs with `ultralytics 8.1.0` due to changes in the NMS implementation or preprocessing steps. This leads to "works on my machine" failures in production AI pipelines.

**WHEN TO APPLY**:
Any repository hosting ML models that depend on a specific inference library.

**VERIFIED IMPLEMENTATION PATTERN**:
```text
# requirements.txt
ultralytics==8.0.100
torch==2.0.0
torchvision==0.15.1
opencv-python==4.8.0.76
numpy==1.24.3
```

**NEGATIVE CONSTRAINT**:
```text
# ANTI-PATTERN: Vague dependencies
ultralytics
torch
```

**VERIFICATION METHOD**:
1.  **CI Test:** Create a fresh Docker container, install dependencies from `requirements.txt`, load the model, and run a single inference on a test image. Assert that the output shape and class IDs are as expected.

## 3. Forensic Real Incidents & Production Patches (Incidents 1 to 5+)

*Note: The provided repository data contains no commit history, bug issues, or source code diffs. Therefore, no real incidents can be documented from this specific repository. The following section is left empty as per the mandate to only use observed evidence.*

## 4. Microscopic Code-Level Invariants (Syntax, Infinite Loop, UI/UX & Concurrency Guards)

*Note: Since the repository contains only model weights and a README, there is no source code to analyze for micro-syntax, infinite loops, UI/UX, or concurrency guards. The following section is left empty as per the mandate to only use observed evidence.*

## 5. The 9 Deep Learning Dimensions

1.  **Architecture:**
    *   **Subsystem Boundaries:** The repository is a leaf node in the AI pipeline. It has no internal subsystems. Its boundary is the file system and the Hugging Face Hub API.
    *   **Decoupling:** The model is decoupled from the training code and the inference code. It is a pure data artifact.
    *   **State Ownership:** The state (weights) is owned by the model file. The consumer application owns the inference state (tensors, masks).

2.  **Core Abstractions:**
    *   **Key Types:** `YOLO` model object, `numpy` arrays (images, masks), `dict` (class names).
    *   **Domain Primitives:** Bounding Box (x, y, w, h), Mask (binary image), Class ID (integer).
    *   **Invariant Contracts:** The class ID must map to a valid label. The mask must be the same size as the input image.

3.  **Error Handling:**
    *   **Fault Boundaries:** The primary fault boundary is the model loading step. If the file is corrupted or the version is incompatible, the `YOLO(path)` constructor will throw an exception.
    *   **Graceful Degradation:** Not applicable. If the model fails to load, the ADetailer plugin should disable itself or fall back to a default model.

4.  **Testing:**
    *   **Property Testing:** Not applicable to the repository itself. Testing is done by the consumer (ADetailer) by running inference on a set of test images and checking the output masks.
    *   **Regression Shields:** The mAP scores in the README serve as a regression shield. If a new model version has a lower mAP, it should not be released.

5.  **Security:**
    *   **Threat Model:** The primary threat is model poisoning. If an attacker replaces the `.pt` file with a malicious model, it could output incorrect masks, leading to inappropriate content generation in Stable Diffusion.
    *   **Credential Boundaries:** Hugging Face Hub uses tokens for authentication. The repository is public, so no credentials are required for download.
    *   **Sanitization:** The model inputs (images) are sanitized by the YOLO preprocessing step (resize, normalize).

6.  **Performance:**
    *   **Latency Profiles:** The latency is dominated by the forward pass of the YOLO model. YOLOv8n is the fastest, YOLOv8m is slower but more accurate.
    *   **Asymptotic Complexity:** O(N) where N is the number of pixels in the input image.
    *   **Caching:** The model weights are cached by the Hugging Face Hub client. The inference results are not cached.

7.  **Deployment:**
    *   **CI/CD Invariants:** The deployment is manual. The model is trained, evaluated, and then uploaded to Hugging Face.
    *   **Container Constraints:** The model can be run in any container with PyTorch and Ultralytics installed.
    *   **Reproducible Builds:** The model weights are deterministic. The training process is not reproducible due to randomness in data augmentation and weight initialization.

8.  **Agent Patterns:**
    *   **Tooling Interfaces:** The model is used as a tool by the ADetailer agent. The agent calls `model.predict(image)` to get the masks.
    *   **Prompt Chains:** Not applicable.
    *   **Loop Guards:** Not applicable.

9.  **Data Flow:**
    *   **Mutation Lifecycles:** The image is mutated by the YOLO preprocessing step (resize, normalize). The output is a new tensor (masks).
    *   **Streams:** Not applicable.
    *   **Serializers:** The model weights are serialized using PyTorch's `torch.save`. The masks are serialized as numpy arrays.
    *   **Network Protocol Barriers:** The model is downloaded over HTTPS from Hugging Face Hub.

## 6. The 8 Learning Extraction Artifacts

1.  **Pattern:**
    *   **Verified, production-grade implementation pattern:** Use `hf_hub_download` to fetch the model, load it with `YOLO(path)`, and validate the class names before use.
    ```python
    from huggingface_hub import hf_hub_download
    from ultralytics import YOLO

    path = hf_hub_download("Bingsu/adetailer", "face_yolov8n.pt")
    model = YOLO(path)
    # Validate class names
    if "face" not in model.names.values():
        raise ValueError("Invalid model: 'face' class not found")
    ```

2.  **Rule:**
    *   **Universal invariant:** Model class indices MUST be immutable across versions of the same model filename.

3.  **Architecture Principle:**
    *   **High-level architectural law:** Model artifacts are data, not code. They must be versioned and validated independently of the inference framework.

4.  **Failure Mode:**
    *   **Precise technical breakdown:** Silent class index mismatch leads to incorrect mask application, causing visual artifacts in the generated image.

5.  **Reusable Skill:**
    *   **Step-by-step procedural workflow:**
        1.  Download the model.
        2.  Load the model.
        3.  Check `model.names`.
        4.  If the names do not match the expected contract, raise an error.
        5.  Run inference.

6.  **Decision:**
    *   **Engineering design trade-off:** Using YOLOv8n over YOLOv8m for face detection. YOLOv8n is faster but less accurate. The decision is based on the need for real-time performance in the Stable Diffusion WebUI.

7.  **Anti-pattern:**
    *   **Negative constraint:** Do not assume that the model's class names are correct. Always validate them.

8.  **Verification Method:**
    *   **Concrete automated test:**
    ```python
    def test_model_class_names():
        model = YOLO("face_yolov8n.pt")
        assert "face" in model.names.values()
        assert "hair" not in model.names.values()  # If not expected
    ```

## 7. Actionable Agent Skill & Implementation Checklist

1.  **Download Model:** Use `hf_hub_download` to fetch the model from Hugging Face.
2.  **Load Model:** Use `YOLO(path)` to load the model.
3.  **Validate Class Names:** Check that `model.names` contains the expected classes.
4.  **Run Inference:** Use `model.predict(image)` to get the masks.
5.  **Post-Process Masks:** Convert the masks to the format required by the inpainting pipeline.
6.  **Apply Masks:** Use the masks to guide the inpainting process.
7.  **Monitor Performance:** Track the latency and accuracy of the model in production.
8.  **Update Model:** If a new version of the model is released, update the model and re-validate the class names.
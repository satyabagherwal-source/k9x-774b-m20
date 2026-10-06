# Forensic Learning Record (Deep Inspection): NVIDIA-AI-Blueprints/video-search-and-summarization

> **Canonical Artifact**: `07_PROJECT_LEARNING/nvidia-ai-blueprints-video-search-and-summarization-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/NVIDIA-AI-Blueprints/video-search-and-summarization](https://github.com/NVIDIA-AI-Blueprints/video-search-and-summarization))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:20:03.917Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `NVIDIA-AI-Blueprints/video-search-and-summarization`
- **Description**: NVIDIA AI Blueprint for video search and summarization (VSS) is a GPU-accelerated reference architecture for building video analytics agents with real-time verified alerts, visual Q&A, and automated reporting. The VSS Blueprint uses vision language models (VLMs) such as NVIDIA Cosmos, LLMs such as NVIDIA Nemotron, RAG, and NVIDIA NIMs.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 1907 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `libs/analytics/spatialai-data-utils/benchmarks/benchmark_frustum.py`
```
#!/usr/bin/env python3

# SPDX-FileCopyrightText: Copyright (c) 2025-2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
# SPDX-License-Identifier: Apache-2.0
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""
Benchmark script for frustum calculation algorithm.

Tests the performance of calculate_camera_frustum_polygon with real calibration data.
"""

import json
import sys
import time
import numpy as np
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from spatialai_data_utils.core.cameras.polygon import calculate_camera_frustum_polygon
from spatialai_data_utils.core.cameras.utils import extract_camera_matrices


def load_real_calibration(calibration_file):
    """Load real calibration data from file."""
    with open(calibration_file, 'r') as f:
        calibration_data = json.load(f)
    
    # Extract camera matrices from all sensors
    cameras = []
    for sensor in calibration_data['sensors']:
        intrinsic, extrinsic = extract_camera_matrices(sensor)
        if intrinsic is not None and extrinsic is not None:
            cameras.append({
                'id': sensor['id'],
                'intrinsic': intrinsic,
                'extrinsic': extrinsic
            })
    
    return cameras


def benchmark_single_camera(cameras):
    """Benchmark single camera frustum calculation."""
    if not cameras:
        print("ERROR: No cameras loaded")
        return 0.0
    
    camera = cameras[0]
    intrinsic = camera['intrinsic']
    extrinsic = camera['extrinsic']
    
    print("=" * 80)
    print("BENCHMARK: Single Camera Frustum Calculation")
    print(f"Camera: {camera['id']}")
    print("=" * 80)
    
    # Warm-up run
    polygon = calculate_camera_frustum_polygon(
        intrinsic, extrinsic,
        height_range=(1.0, 3.0),
        max_distance=30.0
    )
    
    if polygon is None:
        print(f"WARNING: Camera {camera['id']} failed to generate polygon, trying another...")
        if len(cameras) > 1:
            return benchmark_single_camera(cameras[1:])
        else:
            print("ERROR: No cameras could generate valid polygons")
            return 0.0
    
    print(f"✓ Successfully generated polygon with {len(polygon.exterior.coords)} vertices")
    
    # Benchmark runs
    num_runs = 100
    times = []
    
    for i in range(num_runs):
        start = time.perf_counter()
        polygon = calculate_camera_frustum_polygon(
            intrinsic, extrinsic,
            height_range=(1.0, 3.0),
            max_distance=30.0
        )
        end = time.perf_counter()
        times.append((end - start) * 1000)  # Convert to milliseconds
    
    times = np.array(times)
    
    print(f"\nRuns: {num_runs}")
    print(f"Mean:   {times.mean():.2f} ms")
    print(f"Median: {np.median(times):.2f} ms")
    print(f"Min:    {times.min():.2f} ms")
    print(f"Max:    {times.max():.2f} ms")
    print(f"Std:    {times.std():.2f} ms")
    
    return times.mean()


def benchmark_multiple_cameras(cameras, num_cameras_list=[1, 5, 10, 20]):
    """Benchmark frustum calculation for multiple cameras."""
    if not cameras:
        print("ERROR: No cameras loaded")
        return
    
    # Use first camera for repeated calculations
    camera = cameras[0]
    intrinsic = camera['intrinsic']
    extrinsic = camera['extrinsic']
    
    print("\n" + "=" * 80)
    print("BENCHMARK: Multiple Cameras (Repeated Calculation)")
    print(f"Using camera: {camera['id']}")
    print("=" * 80)
    
    print(f"\n{'Cameras':<10} {'Total Time':<15} {'Time/Camera':<15} {'Est. FPS':<10}")
    print("-" * 60)
    
    for num_cameras in num_cameras_list:
        if num_cameras > len(cameras) * 5:
            # Skip if we're going way beyond available cameras
            continue
            
        start = time.perf_counter()
        
        for i in range(num_cameras):
            _ = calculate_camera_frustum_polygon(
                intrinsic, extrinsic,
                height_range=(1.0, 3.0),
                max_distance=30.0
            )
        
        end = time.perf_counter()
        total_time = (end - start) * 1000  # ms
        time_per_camera = total_time / num_cameras
        
        # Estimate FPS if we need to calculate once per frame
        fps = 1000.0 / total_time if total_time > 0 else float('inf')
        
        print(f"{num_cameras:<10} {total_time:<15.2f} {time_per_camera:<15.2f} {fps:<10.1f}")


def benchmark_with_scene_bounds(cameras):
    """Benchmark with scene bounds (clipping)."""
    if not cameras:
        print("ERROR: No cameras loaded")
        return
    
    camera = cameras[0]
    intrinsic = camera['intrinsic']
    extrinsic = camera['extrinsic']
    scene_bounds = (-50, -50, 50, 50)
    
    print("\n" + "=" * 80)
    print("BENCHMARK: With Scene Bounds Clipping")
    print(f"Camera: {camera['id']}")
    print("=" * 80)
    
    num_runs = 100
    
    # Without scene bounds
    times_no_clip = []
    for _ in range(num_runs):
        start = time.perf_counter()
        _ = calculate_camera_frustum_polygon(
            intrinsic, extrinsic,
            height_range=(1.0, 3.0),
            max_distance=30.0,
            scene_bounds=None
        )
        end = time.perf_counter()
        times_no_clip.append((end - start) * 1000)
    
    # With scene bounds
    times_with_clip = []
    for _ in range(num_runs):
        start = time.perf_counter()
        _ = calculate_camera_frustum_polygon(
            intrinsic, extrinsic,
            height_range=(1.0, 3.0),
            max_distance=30.0,
            scene_bounds=scene_bounds
        )
        end = time.perf_counter()
        times_with_clip.append((end - start) * 1000)
    
    times_no_clip = np.array(times_no_clip)
    times_with_clip = np.array(times_with_clip)
    
    print(f"\nWithout clipping: {times_no_clip.mean():.2f} ms (±{times_no_clip.std():.2f})")
    print(f"With clipping:    {times_with_clip.mean():.2f} ms (±{times_with_clip.std():.2f})")
    print(f"Overhead:         {times_with_clip.mean() - times_no_clip.mean():.2f} ms ({((times_with_clip.mean() / times_no_clip.mean() - 1) * 100):.1f}%)")


if __name__ == "__main__":
    print("\n🚀 Frustum Calculation Performance Benchmark\n")
    
    # Load real calibration data
    calib_file = Path(__file__).parent.parent / "data" / "mtmc" / "scene_001" / "calibration.json"
    
    if not calib_file.exists():
        print(f"ERROR: Calibration file not found: {calib_file}")
        sys.exit(1)
    
    print(f"Loading calibration from: {calib_file}")
    cameras = load_real_calibration(calib_file)
    print(f"✓ Loaded {len(cameras)} cameras with valid matrices\n")
    
    if not cameras:
        print("ERROR: No valid cameras found in calibration file")
        sys.exit(1)
    
    # Run benchmarks
    avg_time = benchmark_single_camera(cameras)
    
    if avg_time > 0:
        benchmark_multiple_cameras(cameras)
        benchmark_with_scene_bounds(cameras)
        
        # Summary
        print("\n" + "=" * 80)
        print("SUMMARY")
        print("=" * 80)
        print(f"Average time per camera: {avg_time:.2f} ms")
        print(f"Cameras processed per second: {1000.0 / avg_time:.1f}")
        print(f"\nFor a scene with {len(cameras)} cameras:")
        print(f"  - Total time: {avg_time * len(cameras):.2f} ms")
        print(f"  - Can recalculate at: {1000.0 / (avg_time * len(cameras)):.1f} FPS")
        print("\nFor a scene with 10 cameras:")
        print(f"  - Total time: {avg_time * 10:.2f} ms")
        print(f"  - Can recalculate at: {1000.0 / (avg_time * 10):.1f} FPS")
        print("\n" + "=" * 80)


```

### Core Architecture Module: `libs/analytics/spatialai-data-utils/release/setup.py`
```
# SPDX-FileCopyrightText: Copyright (c) 2025-2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
# SPDX-License-Identifier: Apache-2.0
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""
SpatialAI Data Utils Package Setup Script

This module provides the package configuration and installation setup for
spatialai-data-utils, a comprehensive utility library for 3D object perception,
multi-target multi-camera tracking, and BEV (Bird's Eye View) based systems
in warehouse, retail, and hospital environments.

Package Information:
- Name: spatialai-data-utils
- Version: 2.0.2 (with optional suffix from VERSION_SUFFIX env var)
- Python: >=3.11
- License: Apache-2.0

Key Components:
- Camera calibration and grouping utilities
- BEV group origin calculation
- Multi-camera tracking evaluation
- 3D/2D bounding box processing
- Video processing and visualization tools
- Data loaders for various formats (NVSchema, Sparse4D)
- Ground truth conversion utilities

Main Functions:
- get_version: Retrieve package version with optional suffix
- readme: Load README.md content for package description
- get_requirements: Parse requirements.txt for dependencies

Setup Configuration:
- Automatically discovers packages in spatialai_data_utils namespace
- Includes package data files
- Defines project metadata and classifiers
- Installs dependencies from requirements.txt

Installation:
    # Standard installation
    pip install .

    # Development installation (editable)
    pip install -e .

    # With version suffix
    VERSION_SUFFIX="+dev" pip install .

Usage:
This script is typically invoked via pip or setuptools. Direct execution
will trigger the package installation process.
"""
import os

from setuptools import setup

_BASE_VERSION = "2.0.2"

suffix = os.getenv("VERSION_SUFFIX", "")
version = _BASE_VERSION + suffix
if suffix:
    print(f"Received suffix {suffix}")
print(f"returning {version}")

setup(version=version)

```

### Core Architecture Module: `libs/analytics/spatialai-data-utils/spatialai_data_utils/__init__.py`
```
# SPDX-FileCopyrightText: Copyright (c) 2025-2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
# SPDX-License-Identifier: Apache-2.0
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""SpatialAI Data Utils Package.

Most of this package only requires numpy/scipy-style dependencies and can be
used without ``torch`` or ``pytorch3d`` installed. A small number of functions
(notably 3D IoU helpers in :mod:`spatialai_data_utils.eval.common.utils` and
the 3D IoU path in the MTMC tracking datasets) do require ``torch`` and
``pytorch3d``; those functions will raise a clear :class:`ImportError` at
call time if the optional dependencies are missing.

To enable the torch/pytorch3d-dependent functionality, install:

  # CPU-only torch
  pip install torch>=2.10.0 --index-url https://download.pytorch.org/whl/cpu

  # CUDA (GPU) torch — pick ONE variant; do not install alongside the CPU build
  pip install torch>=2.10.0

  # pytorch3d (requires torch first)
  pip install 'pytorch3d @ git+https://github.com/facebookresearch/pytorch3d.git@33824be' --no-build-isolation
"""

```

### Core Architecture Module: `libs/analytics/spatialai-data-utils/spatialai_data_utils/configs/__init__.py`
```
# SPDX-FileCopyrightText: Copyright (c) 2025-2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
# SPDX-License-Identifier: Apache-2.0
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

```

### Core Architecture Module: `libs/analytics/spatialai-data-utils/spatialai_data_utils/configs/converters/__init__.py`
```
# SPDX-FileCopyrightText: Copyright (c) 2025-2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
# SPDX-License-Identifier: Apache-2.0
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

```

### Core Architecture Module: `libs/analytics/spatialai-data-utils/spatialai_data_utils/configs/converters/default.py`
```
# SPDX-FileCopyrightText: Copyright (c) 2025-2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
# SPDX-License-Identifier: Apache-2.0
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

box_3d_conf_thresh = 0.8
filter_by_bev_boundary = False
filter_by_z3d = False
set_z3d_to_zero = False

```

### Core Architecture Module: `libs/analytics/spatialai-data-utils/spatialai_data_utils/configs/eval/__init__.py`
```
# SPDX-FileCopyrightText: Copyright (c) 2025-2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
# SPDX-License-Identifier: Apache-2.0
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Evaluation configuration presets.

This sub-package collects the preset configuration dictionaries consumed
by the evaluators under :mod:`spatialai_data_utils.eval` (e.g.
:class:`spatialai_data_utils.eval.detection.data_classes.DetectionConfig`).
Configs are plain ``dict`` so they round-trip through the same
``deserialize`` helpers the nuScenes / TrackEval data classes already use.
"""

```

### Core Architecture Module: `libs/analytics/spatialai-data-utils/spatialai_data_utils/configs/eval/detection.py`
```
# SPDX-FileCopyrightText: Copyright (c) 2025-2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
# SPDX-License-Identifier: Apache-2.0
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Detection-evaluation config presets.

Two presets are exported, both consumed by
:class:`spatialai_data_utils.eval.detection.data_classes.DetectionConfig`
via its ``deserialize`` classmethod. They share the same class list,
thresholds, and ``max_boxes_per_sample`` cap; the only difference is the
matching function used to pair predictions with ground truth:

- :data:`DET_CONFIG_IOU3D` matches by 3D IoU. Used by the standalone
  detection evaluator (``evaluate_detection_per_BEV_sensor`` and friends),
  and by external consumers that want the strictest geometric match.
- :data:`DET_CONFIG_CENTER_DISTANCE` matches by centre distance in
  metres. Used by the MTMC validation+evaluation tool
  (``tools/validation_and_evaluation/run_validation_and_evaluation.py``)
  on Sparse4D BEV outputs, where centre-distance matching is the
  established protocol on the cloud side.
"""

from copy import deepcopy
from typing import Any, Dict


# Per-class max evaluation range in **metres** (see
# ``spatialai_data_utils.eval.detection.data_classes.DetectionConfig``
# docstring: "Max detection distance for each class"). Predictions whose
# centre is farther than this radius from the BEV origin are excluded
# from the per-class AP / TP-error calculation.
#
# Values mirror
# ``spatialai_data_utils.configs.object_classes.warehouse.CLASS_RANGE_DICT``
# (40 m for every warehouse class — Person, the humanoid robots, and the
# vehicles); the container/marker/rack classes that don't appear in that
# dict (Box, Pallet, Crate, Basket, KLTBin, Cone, Rack, and the Fii AMR
# racks) are kept at the same 40 m default for consistency. This
# replaces a pre-existing 4 m typo (10x smaller than the warehouse
# convention) that was carried through earlier detection-config literals.
#
# The literal is duplicated here (instead of ``{c: 40 for c in CLASS_LIST}``)
# to break the
# ``configs.eval.detection`` ↔ ``eval.common.classes`` import cycle.
# ``tests/configs/eval/test_detection.py::test_class_range_matches_class_list``
# pins the keys to ``CLASS_LIST`` so drift is caught at CI time.
_DET_CONFIG_CLASS_RANGE: Dict[str, float] = {
    "Person": 40,
    "NovaCarter": 40,
    "Transporter": 40,
    "Forklift": 40,
    "Box": 40,
    "Pallet": 40,
    "Crate": 40,
    "Basket": 40,
    "KLTBin": 40,
    "Cone": 40,
    "Rack": 40,
    "Fourier_GR1_T2_Humanoid": 40,
    "Agility_Digit_Humanoid": 40,
    "Fii_AMR_Bianca_Rack": 40,
    "Fii_AMR_HGX_Rack": 40,
}


# Shared knobs both presets agree on. Pulled out as a private template so
# the only thing the two public configs differ on (``dist_fcn``) stays
# obvious at a glance.
_DET_CONFIG_BASE: Dict[str, Any] = {
    "class_range": _DET_CONFIG_CLASS_RANGE,
    "dist_ths": [0.5],
    "dist_th_tp": 0.5,
    "min_recall": 0.1,
    "min_precision": 0.1,
    "max_boxes_per_sample": 300,
    "mean_ap_weight": 5,
}


DET_CONFIG_IOU3D: Dict[str, Any] = {
    **deepcopy(_DET_CONFIG_BASE),
    "dist_fcn": "iou_3d",
}


DET_CONFIG_CENTER_DISTANCE: Dict[str, Any] = {
    **deepcopy(_DET_CONFIG_BASE),
    "dist_fcn": "center_distance",
}


__all__ = [
    "DET_CONFIG_CENTER_DISTANCE",
    "DET_CONFIG_IOU3D",
]

```

### Core Architecture Module: `libs/analytics/spatialai-data-utils/spatialai_data_utils/configs/object_classes/__init__.py`
```
# SPDX-FileCopyrightText: Copyright (c) 2025-2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
# SPDX-License-Identifier: Apache-2.0
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

```

### Core Architecture Module: `libs/analytics/spatialai-data-utils/spatialai_data_utils/configs/object_classes/default.py`
```
# SPDX-FileCopyrightText: Copyright (c) 2025-2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
# SPDX-License-Identifier: Apache-2.0
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

CLASS_LIST = [
    "person",
]

SUB_CLASS_DICT = {}

MAP_CLASS_NAMES = {
    "person": "Person",
}

ATTRIBUTE_DICT = {
    "person": "person.moving",
}

CLASS_RANGE_DICT = {
    "person": 40,
}

```

### Core Architecture Module: `libs/analytics/spatialai-data-utils/spatialai_data_utils/configs/object_classes/scout.py`
```
# SPDX-FileCopyrightText: Copyright (c) 2025-2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
# SPDX-License-Identifier: Apache-2.0
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

# SCOUT Dataset Object Class Configuration

CLASS_LIST = [
    "person",
]

SUB_CLASS_DICT = {}

CLASS_RANGE_DICT = {
    "person": 50,  # Detection range in meters
}

ATTRIBUTE_DICT = {
    "person": "person.moving",
}

MAP_CLASS_NAMES = {
    "person": "Person",
}

# SCOUT-specific metadata
DATASET_NAME = "SCOUT"
NUM_CAMERAS = 25
FPS = 10
RESOLUTION = [1920, 1080]
COORDINATE_SYSTEM = "world"  # SCOUT uses world coordinates with Z up

```

### Core Architecture Module: `libs/analytics/spatialai-data-utils/spatialai_data_utils/configs/object_classes/warehouse.py`
```
# SPDX-FileCopyrightText: Copyright (c) 2025-2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
# SPDX-License-Identifier: Apache-2.0
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

CLASS_LIST = [
    "person",
    "gr1_t2",
    "agility_digit",
    "nova_carter",
    "transporter",
    "forklift",
    "pallet_truck",
    # "box",
    # "pallet",
    # "crate",
    # "basket",
]

SUB_CLASS_DICT = {
    "pallet_truck": [
        "palletjackforklift",
        "pallettruck",
        "forklift_1195",
    ],
    # "pallet": [
    #     "pallet",
    #     "blockpallet",
    #     # "wooddrumpallet",
    #     # "rackablepallet",
    #     "exportpallet",
    # ],
}

MAP_CLASS_NAMES = {
    "person": "Person",
    "gr1_t2": "Fourier_GR1_T2_Humanoid",
    "agility_digit": "Agility_Digit_Humanoid",
    "nova_carter": "Nova_Carter",
    "transporter": "Transporter",
    "forklift": "Forklift",
    "pallet_truck": "Pallet_Truck",
    # "box": "Box",
    # "pallet": "Pallet",
    # "crate": "Crate",
    # "basket": "Basket",
}

ATTRIBUTE_DICT = {
    "person": "person.moving",
    "gr1_t2": "gr1_t2.moving",
    "agility_digit": "agility_digit.moving",
    "nova_carter": "nova_carter.moving",
    "transporter": "transporter.moving",
    "forklift": "forklift.moving",
    "pallet_truck": "pallet_truck.moving",
    # "box": "box.static",
    # "pallet": "pallet.static",
    # "crate": "crate.static",
    # "basket": "basket.static",
}

CLASS_RANGE_DICT = {
    "person": 40,
    "gr1_t2": 40,
    "agility_digit": 40,
    "nova_carter": 40,
    "transporter": 40,
    "forklift": 40,
    "pallet_truck": 40,
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1838** (2026-09-20): **[BUG]: Alert Bridge sends no VLM system_prompt when verification config omits it**
  *Symptoms*: ### Version  develop  ### Installation method  Docker Compose  ### Describe the bug  POST /api/v1/verification/config only requires alert_type and prompt. system_prompt is optional and may be omitted or null.  When it is unset, Alert Bridge does not apply a service default. The stored value stays null, prompt lookup returns None, and VlmClient skips the system role entirely. The VLM call is user prompt + media only.  That is weaker than the seeded FOV config in alert_type_config.json, which always includes "system": "You are a helpful assistant.". Seeding only happens at startup (prompt.override_prompts_on_start + file load). A config created at runtime without system_prompt never gets that text.  Operators should not have to supply a system prompt. The user prompt is the detection question; the system prompt is the VLM contract (role, answer shape) and should be decided by the service unless an admin explicitly overrides it.   ### Steps to reproduce  Deploy alerts in verification / CV mode (dev-profile-alerts, -m verification). Create a verification config with only alert_type and prompt (no system_prompt), e.g. curl -sS -X POST "$AB/api/v1/verification/config" -H 'Content-Type: application/json' -d '{ "alert_type": "FOV Count Violation", "prompt": "Is anyone on the ladder without a hardhat and safety vest? Answer yes or no.", "output_category": "Ladder PPE Violation" }' Confirm GET .../verification/config shows "system_prompt": null. Let a matching CV candidate through (or 
  **Post-Mortem & Fix Analysis**:
  > <!-- vss-github-ai-triage:v1 --> Thanks for filing this issue. We ran an automated first-pass triage.  - Category: `product bug` - Confidence: `0.92` - Next step: This looks actionable for maintainer review. It will not be copied to internal NVBugs unless the team explicitly approves it.  A maintainer will make the final call on labels, escalation, and whether this should become an internal bug.
  > Thank you for your reply, this is a bug.  The current flow is: ```   POST /api/v1/verification/config     -> system_prompt is optional     -> AlertConfigService persists null unchanged     -> PromptManager returns None for system_prompt     -> VlmClient only adds the system message when system_prompt is truthy     -> the VLM request contains no system role ```  The seed file `alert_type_config.json` contains a default system prompt, but it is applied only during service startup. It does not fix configurations created or updated later through the API, or existing configurations where system_prompt is already null.  Please refer to the following patch:  ```patch  diff --git a/services/alert/handlers/prompt_handler/prompt_manager.py b/services/alert/handlers/prompt_handler/prompt_manager.py   --- a/services/alert/handlers/prompt_handler/prompt_manager.py   +++ b/services/alert/handlers/prompt_handler/prompt_manager.py   @@    class PromptManager:   +    DEFAULT_SYSTEM_PROMPT = "You are a 
  > You should also merge this PR locally first.  https://github.com/NVIDIA-AI-Blueprints/video-search-and-summarization/pull/1861

- **Issue #1413** (2026-09-03): **[BUG]: RT-VLM openai-compat sends max_tokens, incompatible with OpenAI GPT-5 reasoning models (requires max_completion_tokens)**
  *Symptoms*: ### Version  3.2.0  ### Installation method  Other  ### Describe the bug  **VSS version:** 3.2.0 and 3.2.1 (both reproduce) **Component:** RT-VLM (vss-rt-vlm), openai-compat mode **Deployment:** Helm on EKS, remote Azure OpenAI endpoint  ### Summary RT-VLM's openai-compat client always sends `max_tokens` in its chat/completions requests. OpenAI's GPT-5 model family (reasoning models AND chat variants, e.g. gpt-5.2, gpt-5.2-chat, gpt-5.4, gpt-5.5) rejects `max_tokens` and requires `max_completion_tokens` instead. This makes RT-VLM unusable with any GPT-5-class model for the VLM/vision role.  ### Actual result ERROR Error during warmup VlmProcess-0: ServiceException - code: BadRequestError message: Error code: 400 - {'error': {'message': "Unsupported parameter: 'max_tokens' is not supported with this model. Use 'max_completion_tokens' instead.", 'type': 'invalid_request_error', 'param': 'max_tokens', 'code': 'unsupported_parameter'}}   Confirmed this is not model-specific — the same error occurs with gpt-5.2-chat and other -chat variants via direct Azure API testing.  ### Expected result RT-VLM should either emit `max_completion_tokens` for reasoning-model deployments, or expose a config option to control which token parameter is sent (similar to how the LVS summarization LLM config already supports `max_completion_tokens` per docs.nvidia.com/vss/3.2.0/vss-agent/configure-llm.html).  ### Additional context - NVIDIA support (via account team) confirmed no existing fix and recomm
  **Post-Mortem & Fix Analysis**:
  > <!-- vss-github-ai-triage:v1 --> Thanks for filing this issue. We ran an automated first-pass triage.  - Category: `product bug` - Confidence: `0.94` - Next step: This looks actionable for maintainer review. It will not be copied to internal NVBugs unless the team explicitly approves it.  A maintainer will make the final call on labels, escalation, and whether this should become an internal bug.
  >  This issue is caused by the RT-VLM openai-compat backend sending max_tokens, while GPT-5 reasoning endpoints require max_completion_tokens.  As a workaround for VSS 3.2.0/3.2.1, use gpt-4o for the VLM and reserve GPT-5 for LVS summarization. If GPT-5 is required for RT-VLM, apply the patch above and rebuild/redeploy the vss-rt-vlm image.  Note that this is a targeted workaround. Endpoints that only support the legacy max_tokens parameter may not work with the patched image.  ```python   diff --git a/services/rtvi/rt-vlm/src/models/openai_compat/openai_compat_model.py b/services/rtvi/rt-vlm/src/models/openai_compat/openai_compat_model.py   @@ -1058,7 +1058,7 @@ class CompOpenAIModel(BaseVlmModel):                            response_obj = self._model.invoke(                                messages,   -                            max_tokens=config.max_new_tokens,   +                            max_completion_tokens=config.max_new_tokens,                                temperature=config
  > Thank you for the patch reference. However, modifying files inside a vendor-provided container image is not viable for our Kubernetes/Helm/ArgoCD deployment — it would require building and maintaining a custom fork of the RT-VLM image. Could this be addressed as a proper configuration option instead, for example:  An env var like VLM_TOKEN_PARAM=max_completion_tokens that the OpenAI-compat client respects, OR Model-family detection (auto-switch to max_completion_tokens when the model name matches a gpt-5/o-series pattern), similar to how the LVS summarization LLM already supports max_completion_tokens natively  Is a fix planned for any upcoming versions ? Additionally, gpt-4o is reaching end-of-life in October 2026 — at that point the VLM role will have no viable fallback and migrating to GPT-5 or higher models becomes mandatory, not optional. This makes a proper configurable fix a hard requirement before that deadline, not just a nice-to-have. In the meantime we'll keep gpt-4o on the 

- **Issue #1138** (2026-06-30): **[GH-1125] [video-search-and-summarization] [GH-1119] [video-search-and-summarization] [GH-1116] [video-**
  *Symptoms*: ## Description  https://github.com/NVIDIA-AI-Blueprints/video-search-and-summarization/issues/1125 <hr /> ## Description https://github.com/NVIDIA-AI-Blueprints/video-search-and-summarization/issues/1119<hr /> Description</h2> https://github.com/NVIDIA-AI-Blueprints/video-search-and-summarization/issues/1116<hr /> Description</h2> https://github.com/NVIDIA-AI-Blueprints/video-search-and-summarization/issues/1112<hr /> Description</h2> https://github.com/NVIDIA-AI-Blueprints/video-search-and-summarization/issues/1102<hr /> Description</h2> https://github.com/NVIDIA-AI-Blueprints/video-search-and-summarization/issues/1091<hr /> Is this a correction or a request for new documentation?</h3> Correction / UpdateLink to existing documentation (if applicable) <em>No response</em>Describe the issue or what documentation is needed Dear Support, this is very excellent concept and effort. But, I am trying to make it run locally <strong>without</strong> <code>NGC_CLI_API_KEY</code> which I have also asked in some other tickets, but was not able to make it docker UP and run. I think if you can provide any <code>Readme</code> or any step guidelines that after locally downloading model, how to make the docker and <strong>run it without any NGC_CLI_API_KEY / cloud / internet / external source access</strong>. Proposed correction or content Docker <code>maybe</code> changes <code>1) –flags local, cloud 2) –model model_names,  3) –local_path_ /storage/disk1/folder 4) –option_to_use search_and_c

- **Issue #1137** (2026-06-30): **[GH-1124] [video-search-and-summarization] [GH-1118] [video-search-and-summarization] [GH-1115] [video-**
  *Symptoms*: ## Description  https://github.com/NVIDIA-AI-Blueprints/video-search-and-summarization/issues/1124 <hr /> ## Description https://github.com/NVIDIA-AI-Blueprints/video-search-and-summarization/issues/1118<hr /> Description</h2> https://github.com/NVIDIA-AI-Blueprints/video-search-and-summarization/issues/1115<hr /> Description</h2> https://github.com/NVIDIA-AI-Blueprints/video-search-and-summarization/issues/1111<hr /> Description</h2> https://github.com/NVIDIA-AI-Blueprints/video-search-and-summarization/issues/1101<hr /> Description</h2> https://github.com/NVIDIA-AI-Blueprints/video-search-and-summarization/issues/1019<hr /> Hi Team, I tried to deploy via remote_llm_deployment, LLM Server : RTX A5000 + H100 VSS Server : DGX Spark When i upload video file at web UI application, I got error “Error: [###] {‘message’: ‘“auto” tool choice requires –enable-auto-tool-choice and –tool-call-parser to be set’, ‘type’: ‘BadRequestError’, ‘param’: None, ‘code’: 400} {‘error’: {‘message’: ‘“auto” tool choice requires –enable-auto-tool-choice and –tool-call-parser to be set’, ‘type’: ‘BadRequestError’, ‘param’: None, ‘code’: 400}}” Below is the command I run docker: docker run -it –rm –gpus ‘device=0’ –shm-size=16gb -e NGC_API_KEY=$NGC_API_KEY -e NIM_ENABLE_AUTO_TOOL_CHOICE=1 -e NIM_TOOL_CALL_PARSER=llama3_json -v “$LOCAL_NIM_CACHE:/opt/nim/.cache” -p 30081:8000 nvcr.io/nim/nvidia/nemotron-3-nano:latest LLM Error log when upload video file : (APIServer pid=72) INFO: Started server process

- **Issue #1136** (2026-06-30): **[GH-1123] [video-search-and-summarization] [GH-1117] [video-search-and-summarization] [GH-111] [video-s**
  *Symptoms*: ## Description  https://github.com/NVIDIA-AI-Blueprints/video-search-and-summarization/issues/1123 <hr /> ## Description https://github.com/NVIDIA-AI-Blueprints/video-search-and-summarization/issues/1117<hr /> Description</h2> https://github.com/NVIDIA-AI-Blueprints/video-search-and-summarization/issues/111<hr /> Environment<ul><li>VSS 3.1.0 (2026-03-13 build, SHA <code>cdd604d6baf6c445882ce72ecbf5426287a847ff</code>)</li><li>Hardware: DGX Spark (ARM64 / GB10)</li><li>Running the <code>bp_developer_lvs_2d</code> profile via <code>docker compose –profile bp_developer_lvs_2d up -d lvs-server elasticsearch elasticsearch-init-container</code></li><li>Remote LLM: Nemotron 3 Super 120B on a second Spark (OpenAI-compatible)</li><li>Local VLM: Cosmos Reason-2 8B NIM at <code>http://:30082/v1/</code> (confirmed reachable)</li></ul> </h3> Observation</h3> In our <code>docker images</code> output for NGC-pulled <code>nvcr.io/nvidia/vss-core/*</code>:<code>nvcr.io/nvidia/vss-core/vss-vios-sensor:3.1.0-sbsa            5.89GB nvcr.io/nvidia/vss-core/vss-vios-streamprocessing:3.1.0-sbsa  5.99GB nvcr.io/nvidia/vss-core/vss-long-video-summarization:3.1.0    33.5GB  ← no -sbsa tag </code></pre>Other VSS components ship with <code>-sbsa</code> variants for ARM64, but <code>vss-long-video-summarization</code> only ships the x86 tag. Docker pulls and runs it on DGX Spark via emulation, which causes the DeepStream GPU-decoder path to fail.Symptom</h3> On <code>docker compose up -d lvs-server</code

- **Issue #1125** (2026-06-30): **[GH-1119] [video-search-and-summarization] [GH-1116] [video-search-and-summarization] [GH-1112] [video-**
  *Symptoms*: ## Description  https://github.com/NVIDIA-AI-Blueprints/video-search-and-summarization/issues/1119 <hr /> ## Description https://github.com/NVIDIA-AI-Blueprints/video-search-and-summarization/issues/1116<hr /> Description</h2> https://github.com/NVIDIA-AI-Blueprints/video-search-and-summarization/issues/1112<hr /> Description</h2> https://github.com/NVIDIA-AI-Blueprints/video-search-and-summarization/issues/1102<hr /> Description</h2> https://github.com/NVIDIA-AI-Blueprints/video-search-and-summarization/issues/1091<hr /> Is this a correction or a request for new documentation?</h3> Correction / UpdateLink to existing documentation (if applicable) <em>No response</em>Describe the issue or what documentation is needed Dear Support, this is very excellent concept and effort. But, I am trying to make it run locally <strong>without</strong> <code>NGC_CLI_API_KEY</code> which I have also asked in some other tickets, but was not able to make it docker UP and run. I think if you can provide any <code>Readme</code> or any step guidelines that after locally downloading model, how to make the docker and <strong>run it without any NGC_CLI_API_KEY / cloud / internet / external source access</strong>. Proposed correction or content Docker <code>maybe</code> changes <code>1) –flags local, cloud 2) –model model_names,  3) –local_path_ /storage/disk1/folder 4) –option_to_use search_and_collect, search_and_summarization_from_collection </code> This might be an easy to use.Code of Conduct<ul><

- **Issue #1124** (2026-06-30): **[GH-1118] [video-search-and-summarization] [GH-1115] [video-search-and-summarization] [GH-1111] [video-**
  *Symptoms*: ## Description  https://github.com/NVIDIA-AI-Blueprints/video-search-and-summarization/issues/1118 <hr /> ## Description https://github.com/NVIDIA-AI-Blueprints/video-search-and-summarization/issues/1115<hr /> Description</h2> https://github.com/NVIDIA-AI-Blueprints/video-search-and-summarization/issues/1111<hr /> Description</h2> https://github.com/NVIDIA-AI-Blueprints/video-search-and-summarization/issues/1101<hr /> Description</h2> https://github.com/NVIDIA-AI-Blueprints/video-search-and-summarization/issues/1019<hr /> Hi Team, I tried to deploy via remote_llm_deployment, LLM Server : RTX A5000 + H100 VSS Server : DGX Spark When i upload video file at web UI application, I got error “Error: [###] {‘message’: ‘“auto” tool choice requires –enable-auto-tool-choice and –tool-call-parser to be set’, ‘type’: ‘BadRequestError’, ‘param’: None, ‘code’: 400} {‘error’: {‘message’: ‘“auto” tool choice requires –enable-auto-tool-choice and –tool-call-parser to be set’, ‘type’: ‘BadRequestError’, ‘param’: None, ‘code’: 400}}” Below is the command I run docker: docker run -it –rm –gpus ‘device=0’ –shm-size=16gb -e NGC_API_KEY=$NGC_API_KEY -e NIM_ENABLE_AUTO_TOOL_CHOICE=1 -e NIM_TOOL_CALL_PARSER=llama3_json -v “$LOCAL_NIM_CACHE:/opt/nim/.cache” -p 30081:8000 nvcr.io/nim/nvidia/nemotron-3-nano:latest LLM Error log when upload video file : (APIServer pid=72) INFO: Started server process [72] (APIServer pid=72) INFO: Waiting for application startup. (APIServer pid=72) INFO: Application start

- **Issue #1123** (2026-06-30): **[GH-1117] [video-search-and-summarization] [GH-111] [video-search-and-summarization] `vss-long-video-su**
  *Symptoms*: ## Description  https://github.com/NVIDIA-AI-Blueprints/video-search-and-summarization/issues/1117 <hr /> ## Description https://github.com/NVIDIA-AI-Blueprints/video-search-and-summarization/issues/111<hr /> Environment<ul><li>VSS 3.1.0 (2026-03-13 build, SHA <code>cdd604d6baf6c445882ce72ecbf5426287a847ff</code>)</li><li>Hardware: DGX Spark (ARM64 / GB10)</li><li>Running the <code>bp_developer_lvs_2d</code> profile via <code>docker compose –profile bp_developer_lvs_2d up -d lvs-server elasticsearch elasticsearch-init-container</code></li><li>Remote LLM: Nemotron 3 Super 120B on a second Spark (OpenAI-compatible)</li><li>Local VLM: Cosmos Reason-2 8B NIM at <code>http://:30082/v1/</code> (confirmed reachable)</li></ul> </h3> Observation</h3> In our <code>docker images</code> output for NGC-pulled <code>nvcr.io/nvidia/vss-core/*</code>:<code>nvcr.io/nvidia/vss-core/vss-vios-sensor:3.1.0-sbsa            5.89GB nvcr.io/nvidia/vss-core/vss-vios-streamprocessing:3.1.0-sbsa  5.99GB nvcr.io/nvidia/vss-core/vss-long-video-summarization:3.1.0    33.5GB  ← no -sbsa tag </code></pre>Other VSS components ship with <code>-sbsa</code> variants for ARM64, but <code>vss-long-video-summarization</code> only ships the x86 tag. Docker pulls and runs it on DGX Spark via emulation, which causes the DeepStream GPU-decoder path to fail.Symptom</h3> On <code>docker compose up -d lvs-server</code>, the container starts, Cosmos VLM connectivity succeeds (remote), 16 VlmProcess workers warm up, but ini

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

### Incident Patch 1: `fa4b4dab` (2026-10-05)
**Commit Message**: fix(skill-eval): [VSS Skills Eval][vss-build-vision-ai][vdr_1_quickstart_vision_agent][RTXPRO6000BW] (#2538)

Signed-off-by: Arun G Mohare <[REDACTED_EMAIL]>

**File**: `.github/skill-eval/envs/brev_env.py` (modified, +110/-0)
```diff
@@ -305,6 +305,40 @@ async def start(self, force_build: bool) -> None:
                 f"exit {setup_dirs_result.return_code}; tail:\n{tail}"
             )
 
+        # Repair a repo venv a prior step left unusable. Unlike the repo sync,
+        # this is NOT gated to the first trial: `step-2+` preserves the
+        # deployment and so skips the sync's `git clean -fdx`, which is the
+        # only other thing that would clear it. A non-zero exit means a broken
+        # venv could not be removed, and the per-path reason is on stderr --
+        # log both streams so the next uv failure is explainable. Warn rather
+        # than raise: the trial can still run, and a venv left in place
+        # surfaces as the uv error it already was.
+        venv_reset_result = await _run_brev_exec(
+            self._instance_name,
+            _broken_venv_cleanup_command(),
+            timeout=60,
+        )
+        if venv_reset_result.return_code != 0:
+            logger.warning(
+                "broken-venv cleanup failed on %s: exit %s; tail:\n%s",
+                self._instance_name,
+                venv_reset_result.return_code,
+                "\n".join(
+                    part
+                    for part in (
+                        (venv_reset_result.stdout or "").strip(),
+                        (venv_reset_result.stderr or "").strip(),
+                    )
+                    if part
+                )[-800:],
+            )
+        else:
+            logger.info(
+                "broken-venv cleanup on %s: %s",
+                self._instance_name,
+                (venv_reset_result.stdout or "").strip().splitlines()[-1:] or ["no output"],
+            )
+
         # Archive session JSONLs and root-level agent outputs left by
         # prior trials on this warm-pool box. Without this, harbor's claude-code
         # mapper merges every
@@ -1555,6 +1589,82 @@ def _claude_task_scratch_cleanup_command() -> str:
     )
 
 
+def _broken_venv_cleanup_command() -> str:
+    """Remove repo virtualenvs that are no longer usable, on every trial.
+
+    `uv` refuses a project venv whose interpreter has gone ("not a valid
+    Python environment (no Python executable was found)"), and the `vss` CLI
+    then cannot run at all. The repo sync that would clear it via
+    `git clean -fdx` is gated to a spec's first trial, because `step-2+` has
+    to preserve the deployment -- so a venv broken during step-1 or step-2
+    survives into step-3, which is where this leg keeps failing (NVBugs
+    6829436: 2026-09-24, -27, -28 and 2026-10-04, each needing a manual
+    `rm -rf libs/vss/.venv`).
+
+    Only a venv that is already unusable is removed: a healthy one is left
+    alone so steps do not pay a reinstall every trial. `uv` recreates a
+    missing venv on its next run, so removal is the repair.
+
+    Strictly POSIX, and path-safe without relying on the remote shell. The
+    command string is handed to `brev exec` / `ssh`, neither of which selects
+    an interpreter, so it may run under dash -- where `read -d` does not
+    exist and a bash-only loop would quietly match nothing, leave the broken
+    venv, and still report success. `find -exec ... {} +` passes each path as
+    an argument instead, so nothing is word-split and no newline in a
+    directory name can turn a fragment into an absolute path of its own.
+
+    Removal runs with `sudo`, so each candidate is re-checked inside the
+    loop: under `$REPO/`, basename `.venv`, and still a directory.
+
+    Exits non-zero when a removal failed, so the caller logs it rather than
+    reporting the trial as clean and leaving the next `uv` failure unexplained.
+    """
+    # Counts come back through files: `-exec ... +` runs in child shells, so a
+    # variable incremented there would not survive to the summary line.
+    inner = (
+        'for VENV in "$@"; do '
+        '  case "$VENV" in "$VENV_REPO"/*) ;; *) continue ;; esac; '
+        '  [ "${VENV##*/}" = ".venv" ] || continue; '
+        '  [ -d "$VENV" ] || continue; '
+        '  if [ -x "$VENV/bin/python" ] && "$VENV/bin/python" -c "" 2>/dev/null; then '
+        '    continue; '
+        '  fi; '
+        # A prior container may have left root-owned files inside, same as the
+        # bind-mount dirs git clean needs sudo for.
+        '  rm -rf "$VENV" 2>/dev/null || sudo rm -rf "$VENV" 2>/dev/null || true; '
+        '  if [ -d "$VENV" ]; then '
+        '    echo "$VENV" >> "$VENV_STATE/failed"; '
+        '  else '
+        '    echo "$VENV" >> "$VENV_STATE/removed"; '
+        '    echo "[venv-reset] removed broken $VENV"; '
+        '  fi; '
+        "done"
+    )
+    return (
+        'REPO="$HOME/video-search-and-summarization"; '
+        'if [ ! -d "$REPO" ]; then '
+        '  echo "[venv-reset] no checkout at $REPO; nothing to inspect"; '
+        'else '
+        '  STATE=$(mktemp -d) || exit 1; '
+        '  : > "$STATE/removed"; : > "$STATE/failed"; '
+   
```

**File**: `skills/vss-build-vision-ai/SKILL.md` (modified, +12/-0)
```diff
@@ -447,3 +447,15 @@ After the selection, ask in one typed-values message only for that provider's st
    the deployed VSS Web UI and tell the user to enter the output of the same
    `gateway-token --quiet` command in its **Connect NemoClaw chat** panel.
    Do not add that token to `override.env` or recreate `vss-ui` after onboarding.
+
+11. Close in the response itself with a summary of what was built, and say in it
+    whether this is a **Stock deploy** or a **Delta build**, in those words. Every
+    build that reached [Q3](#harness-selection--q3) is a Delta, because either
+    answer removes the in-stack agent — so a quickstart that only removed services
+    is still a Delta, not a stock deploy. Reasoning that worked this out mid-run
+    does not satisfy it: a reader who sees only the last message has to be able to
+    tell which it was. Carry over what the earlier steps already owe the summary —
+    the Foundation and effective service set, the container image tag when one was
+    selected, and, on a NemoClaw harness, the token-free Agent UI origin, the
+    `gateway-token` recipe and the sandbox name — and still never print the
+    `#token=` fragment itself.
```

---

### Incident Patch 2: `cfc707c4` (2026-10-05)
**Commit Message**: fix(ui): check a gateway token once, retry a turn the gateway never saw (#2510)

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>
Signed-off-by: Zac Wang <[REDACTED_EMAIL]>

**File**: `services/ui/apps/nv-metropolis-bp-vss-ui/__tests__/components/Home.test.tsx` (modified, +26/-0)
```diff
@@ -13,13 +13,21 @@ jest.mock("next/dynamic", () => ({
     if (source.includes("ChatPanel")) {
       return ({
         onAnswer,
+        onAuthFailure,
         endpoint,
         features,
       }: {
         onAnswer?: (answer: string, conversationId: string) => void;
+        onAuthFailure?: () => void;
         endpoint?: { surface?: string; headers?: Record<string, string> };
         features?: { hitl?: boolean };
       }) => (
+        <>
+        {onAuthFailure ? (
+          <button type="button" onClick={onAuthFailure}>
+            Reject {endpoint?.surface} token
+          </button>
+        ) : null}
         <button
           type="button"
           data-testid={
@@ -35,6 +43,7 @@ jest.mock("next/dynamic", () => ({
         >
           Deliver search artifact
         </button>
+        </>
       );
     }
 
@@ -260,4 +269,21 @@ describe("Home tab lifecycle", () => {
     expect(screen.getByTestId('deliver-search-artifact')).toBeInTheDocument();
     expect(screen.getByText('NemoClaw gateway unavailable')).toBeInTheDocument();
   });
+
+  it('asks for the token again when chat reports it rejected', async () => {
+    process.env.NEXT_PUBLIC_AGENT_ADAPTER_ENABLED = 'true';
+    sessionStorage.setItem('vss-nemoclaw-gateway-token', 'revoked-token');
+    global.fetch = jest.fn()
+      .mockResolvedValueOnce({ ok: true, json: async () => ({ state: 'connected' }) }) as unknown as typeof fetch;
+
+    render(<Home />);
+    expect(await screen.findByTestId('deliver-search-artifact')).toHaveAttribute('data-gateway-token', 'revoked-token');
+    fireEvent.click(screen.getByRole('button', { name: 'Reject vss-ui-main token' }));
+
+    expect(screen.getByRole('alert')).toHaveTextContent('The gateway rejected the connection');
+    expect(screen.getByLabelText('Gateway token')).toBeInTheDocument();
+    expect(screen.queryByTestId('deliver-search-artifact')).not.toBeInTheDocument();
+    expect(sessionStorage.getItem('vss-nemoclaw-gateway-token')).toBeNull();
+    expect(global.fetch).toHaveBeenCalledTimes(1);
+  });
 });
```

**File**: `services/ui/apps/nv-metropolis-bp-vss-ui/__tests__/pages/api/agent-connection.test.ts` (modified, +25/-6)
```diff
@@ -112,14 +112,31 @@ describe('NemoClaw runtime token', () => {
     expect(globalThis.__vssEmbeddedAgentAdapterSessions?.size ?? 0).toBe(0);
   });
 
-  it('rechecks a cached token before serving later agent requests', async () => {
-    getAgentAdapterService({ ...process.env, AGENT_BACKEND_TOKEN: 'revoked-token' });
-    jest.spyOn(OpenClawConnector.prototype, 'checkConnection')
+  it('serves an accepted token without another gateway handshake', async () => {
+    const check = jest.spyOn(OpenClawConnector.prototype, 'checkConnection').mockResolvedValue();
+    const first = response();
+    await agentAdapterHandler(request('capabilities', 'GET', 'valid-token'), first);
+    expect(first.statusCode).toBe(200);
+    expect(check).toHaveBeenCalledTimes(1);
+
+    check.mockRejectedValue(new ConnectorError('unreachable', 'backend_unreachable'));
+    const later = response();
+    await agentAdapterHandler(request('capabilities', 'GET', 'valid-token'), later);
+    expect(later.statusCode).toBe(200);
+    expect(check).toHaveBeenCalledTimes(1);
+  });
+
+  it('rechecks a token after a run reports it rejected', async () => {
+    const service = getAgentAdapterService({ ...process.env, AGENT_BACKEND_TOKEN: 'revoked-token' });
+    service!.credentialsRejected = true;
+    const check = jest.spyOn(OpenClawConnector.prototype, 'checkConnection')
       .mockRejectedValue(new ConnectorError('rejected', 'backend_auth_error'));
     const capabilities = response();
     await agentAdapterHandler(request('capabilities', 'GET', 'revoked-token'), capabilities);
+    expect(check).toHaveBeenCalledTimes(1);
     expect(capabilities.statusCode).toBe(401);
     expect(capabilities.body).toMatchObject({ error: { code: 'backend_auth_error' } });
+    expect(globalThis.__vssEmbeddedAgentAdapterSessions?.size ?? 0).toBe(0);
   });
 
   it('retains finished run history after evicting an idle token connector', () => {
@@ -187,15 +204,17 @@ describe('NemoClaw runtime token', () => {
     } as unknown as RunRecord;
     jest.spyOn(service!.store, 'get').mockReturnValue(record);
     const cancel = jest.spyOn(service!, 'cancelRun').mockResolvedValue(record);
-    jest.spyOn(OpenClawConnector.prototype, 'checkConnection')
-      .mockRejectedValueOnce(new ConnectorError('unreachable', 'backend_unreachable'))
-      .mockRejectedValueOnce(new ConnectorError('rejected', 'backend_auth_error'));
+    const check = jest.spyOn(OpenClawConnector.prototype, 'checkConnection')
+      .mockRejectedValue(new ConnectorError('unreachable', 'backend_unreachable'));
 
     const result = response();
     await agentAdapterHandler(request('runs/run-1/cancel', 'POST', 'valid-token'), result);
     expect(result.statusCode).toBe(202);
     expect(cancel).toHaveBeenCalledWith('run-1');
+    expect(check).not.toHaveBeenCalled();
 
+    service!.credentialsRejected = true;
+    check.mockRejectedValue(new ConnectorError('rejected', 'backend_auth_error'));
     const rejected = response();
     await agentAdapterHandler(request('runs/run-1/cancel', 'POST', 'valid-token'), rejected);
     expect(rejected.statusCode).toBe(401);
```

**File**: `services/ui/apps/nv-metropolis-bp-vss-ui/__tests__/utils/server/agentAdapterConnectors.test.ts` (modified, +58/-0)
```diff
@@ -4,6 +4,7 @@
 // SPDX-License-Identifier: Apache-2.0
 
 import type { AgentAdapterConfig } from "../../../utils/server/agentAdapter/config";
+import { ConnectorError } from "../../../utils/server/agentAdapter/connectors/base";
 import { OpenClawConnector } from "../../../utils/server/agentAdapter/connectors/openClaw";
 import { ResponsesConnector } from "../../../utils/server/agentAdapter/connectors/responses";
 import type { WebSocketLike } from "../../../utils/server/agentAdapter/connectors/websocket";
@@ -340,6 +341,63 @@ describe("embedded adapter connectors", () => {
     );
   });
 
+  it.each([
+    ["backend_auth_error", true],
+    ["backend_scope_error", true],
+    ["backend_unreachable", false],
+  ])("records rejected credentials when a run fails with %s", async (code, rejected) => {
+    jest
+      .spyOn(OpenClawConnector.prototype, "run")
+      // eslint-disable-next-line require-yield
+      .mockImplementation(async function* () {
+        throw new ConnectorError("gateway failure", code, true);
+      });
+    const service = new AgentAdapterService(
+      config({ backendProtocol: "openclaw-ws", backendUrl: "ws://agent.local", backendPath: "/" })
+    );
+    const { record } = service.createRun(requestWithInstructions);
+
+    for (let attempt = 0; attempt < 20 && !record.terminal; attempt += 1) {
+      await new Promise<void>((resolve) => setImmediate(resolve));
+    }
+
+    expect(record.terminal).toBe(true);
+    expect(service.credentialsRejected).toBe(rejected);
+  });
+
+  it("marks a failed run undelivered only when the connector knows nothing was sent", async () => {
+    const openClaw = new AgentAdapterService(
+      config({ backendProtocol: "openclaw-ws", backendUrl: "ws://agent.local", backendPath: "/" })
+    );
+    // The OpenClaw socket cannot open, so the gateway never sees the turn.
+    jest.spyOn(OpenClawConnector.prototype, "run").mockRestore();
+    (openClaw as unknown as { connector: OpenClawConnector }).connector = new OpenClawConnector(
+      openClaw.config,
+      () => {
+        throw new Error("connection refused");
+      }
+    );
+    global.fetch = jest.fn().mockRejectedValue(new TypeError("socket hang up"));
+    const responses = new AgentAdapterService(config());
+
+    const failures = [];
+    for (const service of [openClaw, responses]) {
+      const { record } = service.createRun(requestWithInstructions);
+      for (let attempt = 0; attempt < 20 && !record.terminal; attempt += 1) {
+        await new Promise<void>((resolve) => setImmediate(resolve));
+      }
+      failures.push(record.eventsAfter(0).find((event) => event.type === "run.failed")?.data);
+    }
+
+    expect(failures[0]).toEqual({
+      error: expect.objectContaining({ code: "backend_unreachable", delivered: false }),
+    });
+    expect(failures[1]).toEqual({
+      error: expect.objectContaining({ code: "backend_unreachable" }),
+    });
+    expect((failures[1] as { error: object }).error).not.toHaveProperty("delivered");
+  });
+
   it("uses native OpenClaw chat and tool events with narrow requested scopes", async () => {
     const socket = new FakeOpenClawSocket();
     const connector = new OpenClawConnector(
```

**File**: `services/ui/apps/nv-metropolis-bp-vss-ui/components/Home.tsx` (modified, +2/-0)
```diff
@@ -603,6 +603,7 @@ export default function Home({ alertsData, searchData, dashboardData, mapData, v
               onChatVideoUploadComplete={handleSidebarChatVideoUploadComplete}
               onAnswer={handleSidebarAnswerCompleteWithContent}
               onSubmit={() => handleSidebarMessageSubmitted()}
+              onAuthFailure={nemoClawAdapterEnabled ? nemoClawConnection.reject : undefined}
             />
           </div>
         </div>
@@ -736,6 +737,7 @@ export default function Home({ alertsData, searchData, dashboardData, mapData, v
                   onAnswer={handleMainChatAnswerCompleteWithContent}
                   // The chat tab renders its conversation list in the app's left sidebar.
                   onControlsReady={isActive ? chatControlsReadyCallback : undefined}
+                  onAuthFailure={nemoClawAdapterEnabled ? nemoClawConnection.reject : undefined}
                 />
               </div>
             </>
```

**File**: `services/ui/apps/nv-metropolis-bp-vss-ui/components/NemoClawConnection.tsx` (modified, +10/-1)
```diff
@@ -14,6 +14,8 @@ export interface NemoClawConnection {
   connect: (token: string) => Promise<void>;
   retry: () => Promise<void>;
   changeToken: () => void;
+  /** The gateway rejected the token mid-session: forget it and ask again. */
+  reject: () => void;
 }
 
 export function useNemoClawConnection(enabled: boolean): NemoClawConnection {
@@ -70,8 +72,15 @@ export function useNemoClawConnection(enabled: boolean): NemoClawConnection {
     setHasConnected(false);
     setState('token_required');
   }, []);
+  const reject = useCallback(() => {
+    requestNumber.current += 1;
+    try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* Storage is optional. */ }
+    setToken('');
+    setHasConnected(false);
+    setState('authentication_failed');
+  }, []);
 
-  return useMemo(() => ({ state, hasConnected, token, connect, retry, changeToken }), [state, hasConnected, token, connect, retry, changeToken]);
+  return useMemo(() => ({ state, hasConnected, token, connect, retry, changeToken, reject }), [state, hasConnected, token, connect, retry, changeToken, reject]);
 }
 
 export function NemoClawConnectionPanel({ connection }: { connection: NemoClawConnection }) {
```

**File**: `services/ui/apps/nv-metropolis-bp-vss-ui/utils/server/agentAdapter/connectors/base.ts` (modified, +8/-1)
```diff
@@ -4,13 +4,20 @@
 import type { ConnectorEvent, CreateRunRequest, JsonObject } from "../contract";
 
 export class ConnectorError extends Error {
+  /**
+   * False only when the connector knows the request never reached the backend,
+   * so running the turn again cannot repeat work. Undefined means unknown.
+   */
+  readonly delivered?: false;
+
   constructor(
     message: string,
     readonly code = "backend_error",
     readonly retryable = false,
-    options?: ErrorOptions
+    options?: ErrorOptions & { delivered?: false }
   ) {
     super(message, options);
+    if (options?.delivered === false) this.delivered = false;
   }
 }
 
```

**File**: `services/ui/apps/nv-metropolis-bp-vss-ui/utils/server/agentAdapter/connectors/openClaw.ts` (modified, +3/-1)
```diff
@@ -235,10 +235,12 @@ export class OpenClawConnector implements Connector {
       );
     } catch (error) {
       if (error instanceof WebSocketTransportError) {
+        // The WebSocket never opened, so no request reached the gateway.
         throw new ConnectorError(
           "OpenClaw Gateway is unreachable",
           "backend_unreachable",
-          true
+          true,
+          { delivered: false }
         );
       }
       throw error;
```

**File**: `services/ui/apps/nv-metropolis-bp-vss-ui/utils/server/agentAdapter/index.ts` (modified, +19/-25)
```diff
@@ -90,15 +90,17 @@ const configFingerprint = (environment: NodeJS.ProcessEnv): string =>
     )
     .digest("hex");
 
-const canCancelCachedRun = (environment: NodeJS.ProcessEnv, segments: string[]): boolean => {
-  if (segments.length !== 3 || segments[0] !== "runs" || segments[2] !== "cancel") return false;
-  const service = globalThis.__vssEmbeddedAgentAdapterSessions?.get(configFingerprint(environment))?.service;
-  if (!service) return false;
-  try {
-    return !service.store.get(segments[1], service.ownerFingerprint).terminal;
-  } catch {
-    return false;
-  }
+// The gateway accepted this token when its session was created, and every run
+// authenticates again in its own handshake. Revalidate only after a run reports
+// the token rejected, so ordinary requests open no extra gateway connections.
+const hasAcceptedSession = (environment: NodeJS.ProcessEnv): boolean => {
+  const sessions = globalThis.__vssEmbeddedAgentAdapterSessions;
+  const key = configFingerprint(environment);
+  const cached = sessions?.get(key);
+  if (!cached) return false;
+  if (!cached.service.credentialsRejected) return true;
+  sessions!.delete(key);
+  return false;
 };
 
 export const getAgentAdapterService = (
@@ -382,7 +384,7 @@ export const agentAdapterHandler = async (
     return;
   }
   const environment = tokenEnvironment(token);
-  if (environment !== process.env) {
+  if (environment !== process.env && !hasAcceptedSession(environment)) {
     try {
       const config = loadAgentAdapterConfig(environment);
       if (config?.backendProtocol === "openclaw-ws") {
@@ -394,21 +396,13 @@ export const agentAdapterHandler = async (
         return;
       }
       const code = error instanceof ConnectorError ? error.code : "backend_unreachable";
-      // A transient gateway outage must not block local cancellation of a
-      // run already owned by this token. Rejected credentials still fail closed.
-      if (
-        code !== "backend_unreachable" ||
-        req.method !== "POST" ||
-        !canCancelCachedRun(environment, segments)
-      ) {
-        errorResponse(
-          res,
-          code === "backend_auth_error" || code === "backend_scope_error" ? 401 : 503,
-          code,
-          error instanceof ConnectorError ? error.message : "NemoClaw gateway is unavailable"
-        );
-        return;
-      }
+      errorResponse(
+        res,
+        code === "backend_auth_error" || code === "backend_scope_error" ? 401 : 503,
+        code,
+        error instanceof ConnectorError ? error.message : "NemoClaw gateway is unavailable"
+      );
+      return;
     }
   }
   let service: AgentAdapterService | null;
```

---

### Incident Patch 3: `0ff6e7d0` (2026-10-05)
**Commit Message**: fix(skills): drive VIOS and summarize from the recorded origin (#2452)

Signed-off-by: Hugo VERJUS <[REDACTED_EMAIL]>

**File**: `docs/sdrc.mdx` (modified, +1/-1)
```diff
@@ -799,7 +799,7 @@ The two primary VSS workload object types managed through SDRC are:
 
 - For Docker paths in this section, `$VSS_APPS_DIR` means `video-search-and-summarization/deploy/docker`.
 - VSS includes the SDRC Docker service from `$VSS_APPS_DIR/services/infra/sdrc/docker-compose.yaml`. The service starts with the SDRC workload config rendered from the active VSS profile.
-- Profile-local SDRC configs live under paths such as `$VSS_APPS_DIR/developer-profiles/dev-profile-alerts/sdrc/` and `$VSS_APPS_DIR/industry-profiles/warehouse-operations/warehouse-2d-app/sdrc/`.
+- Profile-local SDRC configs live under paths such as `$VSS_APPS_DIR/developer-profiles/dev-profile-lvs/sdrc/` and `$VSS_APPS_DIR/industry-profiles/warehouse-operations/warehouse-2d-app/sdrc/`.
 - Start with the active profile's `sdrc/configs/config.yml.tmpl`. That file tells you which workload blocks are enabled and which worker objects SDRC manages.
 - For `vss-vios-streamprocessing`, check the block in small groups:
 
```

**File**: `skills/operations/vss-manage-video-io-storage/SKILL.md` (modified, +121/-176)
```diff
@@ -1,6 +1,6 @@
 ---
 name: vss-manage-video-io-storage
-description: Use to call the VIOS REST API (sensor list, timelines, clip extraction, snapshots, add/delete sensors and streams) and to provision a source into a headless (no-agent) build, which the deployment fans out to the perception consumers (RT-CV/RT-Embed/RT-VLM). Not for VLM inference, semantic search, or agent-backed ingestion.
+description: Use to drive `vss vios` for sensor list, timelines, clips, snapshots, and add/delete of video or stream sources, and the VIOS REST API only for what that CLI does not cover (sensor info/status/settings, storage and recorder status, WebRTC, the RTSP proxy, network scan, device settings, bytes to disk, the NvStreamer API), when the caller names a REST endpoint, or to debug VIOS. Also provisions a source into a headless (no-agent) build, which the deployment fans out to the perception consumers (RT-CV/RT-Embed/RT-VLM). Not for VLM inference, semantic search, or agent-backed ingestion.
 license: Apache-2.0
 metadata:
   version: "3.3.0-rc0"
@@ -12,39 +12,66 @@ metadata:
   # OpenClaw harness image ships and activates skills by it.
   vss-requires: "always"
 ---
+
+# VIOS Operations
+
 ## Purpose
 
-Manage VIOS and NvStreamer API operations for VSS video input/output and
-storage workflows: sensors, streams, uploads, snapshots, clips, timelines, and
-recording status.
+Manage VIOS video input/output and storage with `vss vios`: sensors, streams,
+uploads, snapshots, clip URLs, and timelines. NvStreamer stays a
+separate REST API, used only for an explicit synthetic RTSP request.
 
 ## When to Use
 
-- Call the VIOS REST API — add/list sensors or RTSP streams, check stream status, get a snapshot, download a clip, upload a video file, manage storage
-- Serve test/sample videos as synthetic RTSP via NvStreamer, or drive the NvStreamer → VIOS `/sensor/add` handoff
+- Drive `vss vios` — add or delete a video file or RTSP stream, list sensors, show configured sensors, get a snapshot or clip URL (`media_url`), or upload a video file
+- Serve test/sample videos as synthetic RTSP via NvStreamer, or drive the NvStreamer → `vss vios add --type stream` handoff
 - Provision a source into a headless (no-agent) build so the deployment fans it out to RT-CV / RT-Embed / RT-VLM
 
 Not for VLM inference or ad-hoc visual Q&A (`vss-ask-video`), semantic search (`vss-search-archive`), agent-backed search ingestion (`vss-search-archive`), narrative summaries (`vss-summarize-video`), or reading analytics/incidents (`vss-query-analytics`).
 
 ## Prerequisites
 
 - The `vss` CLI on `PATH`. The OpenClaw and Hermes harness images ship it; anywhere else, install it from the same checkout as this skill so the CLI and the skill match: `uv tool install <checkout>/libs/vss/cli`.
-- Active VSS deployment reachable through `VSS_PUBLIC_URL` (Kubernetes
-  Ingress) or `$HOST_IP` (Docker Compose).
+- A deployment already recorded by `vss configure`. Confirm with `vss configure show`. `vss configure --base-url` is the only place an endpoint is supplied, and only the ingress origin the operator already has (`VSS_PUBLIC_URL`). If nothing is recorded and `VSS_PUBLIC_URL` is unset, stop and ask for the ingress origin. Never default a host or port. Exit codes, empty results, and pipe rules live in the repository root [`AGENTS.md`](../../../AGENTS.md).
 - NGC credentials in `$NGC_CLI_API_KEY` and `$NVIDIA_API_KEY` for any image pulls.
-- `curl` and `jq`; Docker is needed only for Compose deployment diagnostics.
+- `curl` only for the direct-REST cases in **Instructions**, and `jq` for reading JSON. Use `set -o pipefail`, or capture stdout before piping. Docker is needed only for Compose deployment diagnostics.
 
 ## Instructions
 
-# VIOS Operations
+Use `vss vios` for list, add, delete, timeline, clip, and snapshot. Address media by sensor name. Do not build a sensorId from a name. `--type` (`video` for a file-backed sensor, `stream` for RTSP) is required on delete, a filter on list, and an optional check on add, which reads the kind from SOURCE (`rtsp://` or `rtsps://` is a stream, anything else a video). Do not hand-build a clip window when `vss vios clip --sensor NAME` can resolve it. Do not navigate the UI.
+
+```bash
+vss vios list     [--type video|stream] [--sensor NAME]
+vss vios timeline --sensor NAME
+vss vios clip     --sensor NAME [--start-time T --end-time T]   # -> media_url
+vss vios snapshot --sensor NAME [--at T]                        # -> media_url
+vss vios add      [--type video|stream] SOURCE [--name NAME]
+vss vios delete   --type video|stream --sensor NAME [--keep-recordings]   # --keep-recordings: stream only
+```
+
+`curl` is not the path for those operations. If a `vss vios` command fails, report the failure — do not fall back to raw REST.
+
+**Where direct REST is allowed.** Only in three cases, documented in [`references/api-reference.md`](references/api-reference.md) and [`references/nvstreamer-api-reference.md`](references/
```

**File**: `skills/operations/vss-manage-video-io-storage/references/deploy-vios-service.md` (modified, +7/-6)
```diff
@@ -98,10 +98,11 @@ sudo chown -R 1001:1001 ${VSS_DATA_DIR}/data_log/vst
 # sudo setfacl -R -m u:1001:rwx ${VSS_DATA_DIR}/data_log/vst
 
 # SDRC workload-definition templates — minimum set for standalone VIOS
-# (model after deploy/docker/developer-profiles/dev-profile-alerts/sdrc/2d_vlm/configs/).
+# (model after deploy/docker/developer-profiles/dev-profile-lvs/sdrc/2d/configs/).
 # The render-config init container reads *.tmpl from configs/ and writes the rendered
 # sibling alongside it (config.yml.tmpl -> config.yml, docker_cluster_config-*.json.tmpl
-# -> docker_cluster_config-*.json), substituting ${HOST_IP}, ${NUM_STREAMS}, ${NUM_SENSORS}.
+# -> docker_cluster_config-*.json), substituting ${HOST_IP}, ${NUM_STREAMS}, ${NUM_SENSORS},
+# and ${VST_USE_SDRC_ENABLE} (the reference workload stays disabled unless VST_USE_SDRC=true).
 mkdir -p ${SDR_CONTROLLER_CONFIG_PATH}/configs
 # Drop in:
 #   ${SDR_CONTROLLER_CONFIG_PATH}/configs/config.yml.tmpl
@@ -153,9 +154,9 @@ bring-up. It is not a profile-level endpoint setting.
 | `KAFKA_BOOTSTRAP_URL` | `kafka:9092` (compose-internal hostname) | Used by streamprocessing-ms for `camera_streaming` event publication. Wrong value → silent caption-pipeline break | `vst.env` |
 | `REDIS_HOSTADDR` / `REDIS_PORT` | `redis` / `6379` (compose-internal) | streamprocessing-ms publishes `vst.event` here; `sdr-controller` consumes via `WDM_WL_REDIS_SERVER` / `WDM_WL_REDIS_PORT` (defaulted to `${HOST_IP}` / `6379` in [`sdrc/docker-compose.yaml`](../../../../deploy/docker/services/infra/sdrc/docker-compose.yaml) lines 143-144). Wrong value → SDRC never picks up new streams → 503 on `/record/*` and `/replay/*` calls. | `vst.env` |
 | `HOST_IP` | the host's reachable IP (NOT `localhost`) — auto-detect it (see the callout above) | **Mints `VST_INGRESS_ENDPOINT=${HOST_IP}:30888/vst` (`compose.env:59`)** → the host embedded in every shareable media URL (`imageUrl` from `/picture/url`, clip URLs); an unset `HOST_IP` would make those URLs fall back to the internal `vst-ingress:30888` and be unroutable from the host. **Also required by SDRC's `render-config` init container** ([`sdrc/docker-compose.yaml`](../../../../deploy/docker/services/infra/sdrc/docker-compose.yaml) line 66 declares `HOST_IP: ${HOST_IP:?HOST_IP must be set...}`): substituted into every `*.tmpl` and into `WDM_WL_REDIS_SERVER` / `KAFKA_BOOTSTRAP_URL` inside the rendered `config.yml`; missing → SDRC chain fails fast before `sdr-controller` boots. | `compose.env:59` + `sdrc/docker-compose.yaml` |
-| `SDR_CONTROLLER_CONFIG_PATH` | host path containing `configs/*.tmpl` | Compose-time bind source for the rendered config dir; see [`dev-profile-alerts/sdrc/2d_vlm/configs/`](../../../../deploy/docker/developer-profiles/dev-profile-alerts/sdrc/2d_vlm/configs/) for the reference 2d_vlm template pair. Standalone VIOS uses the same shape with a single `docker-workload-streamprocessing` entry. | `sdrc/docker-compose.yaml` line 71, 88, 157 |
+| `SDR_CONTROLLER_CONFIG_PATH` | host path containing `configs/*.tmpl` | Compose-time bind source for the rendered config dir; see [`dev-profile-lvs/sdrc/2d/configs/`](../../../../deploy/docker/developer-profiles/dev-profile-lvs/sdrc/2d/configs/) for the reference `sdrc/2d` template pair. Standalone VIOS uses the same shape with a single `docker-workload-streamprocessing` entry. | `sdrc/docker-compose.yaml` `render-config`, `wdm-env-from-config`, and `sdr-controller` volumes |
 | `NUM_STREAMS` / `NUM_SENSORS` | `1` each (standalone single-stream) | Substituted into `config.yml.tmpl` and `docker_cluster_config-streamprocessing.json.tmpl` by `render-config` (lines 67-68 of `sdrc/docker-compose.yaml`). Defaults to `1` if unset; raise to match the actual stream count. | `sdrc/docker-compose.yaml` |
-| `WDM_CONTROLLER_PORT` / `WDM_SDRC_DIRECT_LISTENER_PORT` / `ENVOY_ADMIN_PORT` | `5003` / `8011` / `9902` (hardcoded inside the SDRC compose `sdr-controller.environment:` — NOT `${VAR:-default}`, so a consumer `.env` cannot override them) | `sdr-controller` listen ports for the WDM control plane, SDRC direct listener, and Envoy admin. To change them, patch [`sdrc/docker-compose.yaml`](../../../../deploy/docker/services/infra/sdrc/docker-compose.yaml) lines 147, 149, 150 in the build-output's patched tree. The Envoy listener that actually fronts streamprocessing-ms is `WDM_MS_LISTENER_PORT` from inside the rendered `config.yml` (default `10000` — must match `STREAM_PROCESSOR_MODULE_ENDPOINT` on `vss-vios-sensor`, set to `http://localhost:10000` so the sensor routes through the SDRC Envoy listener). | `sdrc/docker-compose.yaml` lines 147-151 + `dev-profile-alerts/sdrc/2d_vlm/configs/config.yml.tmpl:40` |
+| `WDM_CONTROLLER_PORT` / `WDM_SDRC_DIRECT_LISTENER_PORT` / `ENVOY_ADMIN_PORT` | `5003` / `8011` / `9902` (hardcoded inside the SDRC compose `sdr-controller.environment:` — NOT `${VAR:-default}`, so a consumer `.env` cannot override them) | `sdr-controller` listen ports for the WDM control plane, SDRC 
```

**File**: `skills/operations/vss-manage-video-io-storage/references/integrate-vios-service.md` (modified, +8/-8)
```diff
@@ -98,16 +98,16 @@ component_services:
   # Step 6.5 Patch 1 adds the invented profile flag to each. The render-config init
   # container additionally requires the build-output to materialize config.yml.tmpl
   # + docker_cluster_config-streamprocessing.json.tmpl under SDR_CONTROLLER_CONFIG_PATH/configs
-  # (model: developer-profiles/dev-profile-alerts/sdrc/2d_vlm/configs/ — single-workload
-  # form); see SKILL.md § Step 6.5 Patch 3 > "SDRC config templates" for the
-  # materialization directive (templates are not compose services, so they are not in
+  # (model: developer-profiles/dev-profile-lvs/sdrc/2d/configs/ — single-workload
+  # form); see deploy-vios-service.md § Known Deployment Issues ("no *.tmpl files
+  # found") for the materialization directive (templates are not compose services, so they are not in
   # component_services — but they are a hard requirement for the SDRC chain to boot).
   - key: init-dirs
     file: services/infra/sdrc/docker-compose.yaml
     role: One-shot — chmod 0777 ./log + ./.wdm-env so the host user can clean up later. Direct depends_on of sdr-controller (and of wdm-env-from-config).
   - key: render-config
     file: services/infra/sdrc/docker-compose.yaml
-    role: One-shot — renders every *.tmpl under SDR_CONTROLLER_CONFIG_PATH/configs in place, substituting ${HOST_IP} / ${NUM_STREAMS} / ${NUM_SENSORS}. Transitive prereq for sdr-controller (direct depends_on of wdm-env-from-config).
+    role: One-shot — renders every *.tmpl under SDR_CONTROLLER_CONFIG_PATH/configs in place, substituting ${HOST_IP} / ${NUM_STREAMS} / ${NUM_SENSORS} / ${VST_USE_SDRC_ENABLE}. Transitive prereq for sdr-controller (direct depends_on of wdm-env-from-config).
   - key: wdm-env-from-config
     file: services/infra/sdrc/docker-compose.yaml
     role: One-shot — writes ./.wdm-env from the rendered config.yml. Direct depends_on of sdr-controller (compose waits for it) and of wait-for-*; sdr-controller does not mount .wdm-env for its own env.
@@ -317,7 +317,7 @@ The IN-1-relevant subset (full list in `deploy/docker/services/vios/vst.env`):
 | `VST_INGRESS_IMAGE_TAG` | Tag for `vss-vios-ingress` image | (no default) | **Yes** |
 | `BP_CONFIGURATOR_READYZ_URL` | Optional readiness URL the configurator-wait poller hits | `http://127.0.0.1:5001/readyz` | optional |
 | `SENSOR_BP_WAIT_BP_CONFIGURATOR_MAX_SEC` / `SENSOR_BP_WAIT_STORAGE_MAX_SEC` | Wait-loop timeouts | `300` | optional |
-| `SDR_CONTROLLER_CONFIG_PATH` | Host path containing `configs/*.tmpl` for SDRC (`config.yml.tmpl` + `docker_cluster_config-streamprocessing.json.tmpl`); the `render-config` init container renders them in place. Mount source for the `sdr-controller` `/configs` bind. | per-profile (e.g. `${VSS_APPS_DIR}/developer-profiles/dev-profile-alerts/sdrc/${MODE}`) | **Yes (SDRC)** |
+| `SDR_CONTROLLER_CONFIG_PATH` | Host path containing `configs/*.tmpl` for SDRC (`config.yml.tmpl` + `docker_cluster_config-streamprocessing.json.tmpl`); the `render-config` init container renders them in place. Mount source for the `sdr-controller` `/configs` bind. | per-profile (e.g. `${VSS_APPS_DIR}/developer-profiles/dev-profile-lvs/sdrc/${MODE}`) | **Yes (SDRC)** |
 | `NUM_STREAMS` / `NUM_SENSORS` | Substituted into SDRC `*.tmpl` by `render-config`. | `1` each | optional |
 | `WDM_CONTROLLER_PORT` | SDRC WDM controller listen port. **Hardcoded** at [`sdrc/docker-compose.yaml:147`](../../../../deploy/docker/services/infra/sdrc/docker-compose.yaml) — not `${VAR:-default}`, so consumer `.env` cannot override; patch the compose to change. | `5003` | not env-controllable |
 | `WDM_SDRC_DIRECT_LISTENER_PORT` | SDRC direct listener port. **Hardcoded** at `sdrc/docker-compose.yaml:149`. | `8011` | not env-controllable |
@@ -360,7 +360,7 @@ The IN-1-relevant subset (full list in `deploy/docker/services/vios/vst.env`):
 - **Startup ordering.** `sensor-bp-wait-bp-configurator` and `sensor-bp-wait-storage` are explicit wait-poller containers used INSTEAD OF `depends_on` so VIOS can come up alongside profile composes that don't define the configurator/storage workloads. Don't add `depends_on` to those external services.
 - **Sample-data bundle and friendly names.** `references/api-reference.md` § "Sample data bootstrap" documents 8 NGC-shipped sample mp4s (warehouse, warehouse-ladder, warehouse-safety-1/2, sim-traffic, sim-jaywalking, sim-box-conveyor, drone-bridge). When the user asks for "the sample warehouse video," map to `warehouse_sample.mp4` (etc.); do not invent paths for unknown friendly names.
 - **When `VST_USE_SDRC=true`, the VIOS + SDRC service set must be enabled together.** Enable `sensor-ms*`, `streamprocessing-ms*`, AND every service in [`services/infra/sdrc/docker-compose.yaml`](../../../../deploy/docker/services/infra/sdrc/docker-compose.yaml) — the `profiles:` lists at lines 24, 47, 76, 100, 117, and 137 covering `init-dirs`, `render-config`, `wdm-env-from-config`, `wait-for-redis`, `wait-for-docker-workloads`, and `sdr-controlle
```

**File**: `skills/operations/vss-manage-video-io-storage/references/nvstreamer-api-reference.md` (modified, +20/-26)
```diff
@@ -14,28 +14,22 @@ NvStreamer is the same `launch_vst` binary as VIOS, launched with `ADAPTOR=strea
 http://<NVSTREAMER_ENDPOINT>/api/v1
 ```
 
-Resolve the endpoints before using this reference. NvStreamer and VIOS are
-separate origins; the VIOS handoff in the canonical workflow below needs both:
+NvStreamer is not behind the VSS gateway, so `vss configure` does not record
+it. The caller supplies its origin:
 
 ```bash
-if [ -n "${VSS_PUBLIC_URL:-}" ]; then
-  : "${VSS_STREAMER_URL:?Provide the public NvStreamer Ingress origin for Kubernetes}"
-  NVSTREAMER_ENDPOINT="${VSS_STREAMER_URL%/}"
-  VSS_VIOS_URL="${VSS_PUBLIC_URL%/}/vst"
-else
-  NVSTREAMER_ENDPOINT="http://${HOST_IP}:${NVSTREAMER_HTTP_PORT:-31000}"
-  VSS_VIOS_URL="http://${HOST_IP}:${VST_INGRESS_HOST_PORT:-30888}/vst"
-fi
+: "${VSS_STREAMER_URL:?Ask for the NvStreamer origin; do not derive it}"
+NVSTREAMER_ENDPOINT="${VSS_STREAMER_URL%/}"
 ```
 
 Every `http://<NVSTREAMER_ENDPOINT>` placeholder below means
-`${NVSTREAMER_ENDPOINT}`. NvStreamer uses a separate Ingress host, so do not
-derive it from `VSS_PUBLIC_URL`, use an in-cluster Service, or start a
-`kubectl port-forward`. A Compose deployment may run multiple instances on
-adjacent ports (`31000`, `31001`, …); always confirm from deployment context.
-Each instance has its own sensor list — a file uploaded to `nvstreamer-1` is
-not visible on `nvstreamer-2`. Resolve `${VSS_VIOS_URL}` as above before the
-VIOS handoff in the canonical workflow.
+`${NVSTREAMER_ENDPOINT}`. Do not derive it from `VSS_PUBLIC_URL` or `HOST_IP`,
+use an in-cluster Service, or start a `kubectl port-forward`. Helm profiles
+publish it on a separate Ingress host; Compose has no streamer route, and a
+Compose deployment may run several instances on adjacent ports, so the caller
+must say which one. Each instance has its own sensor list — a file uploaded to
+`nvstreamer-1` is not visible on `nvstreamer-2`. The VIOS side of the handoff
+below goes through `vss vios` and takes no endpoint.
 
 ---
 
@@ -312,7 +306,7 @@ curl -s "http://<NVSTREAMER_ENDPOINT>/api/v1/sensor/list" | jq '.[] | {sensorId,
 
 The reason this reference exists in the VIOS skill: the load-bearing pattern that uses NvStreamer is **upload to NvStreamer, get RTSP URL, register with VIOS**.
 
-> **Precondition for step 4.** The handoff requires the VIOS stream-processor to be part of the active deployment. Most VSS profiles ship both (`dev-profile-alerts`, `dev-profile-lvs`, `dev-profile-search`, all warehouse profiles), but custom or NvStreamer-only setups may not include VIOS. **Probe `curl -sf --max-time 5 "${VSS_VIOS_URL}/api/v1/sensor/version"` and confirm `type == "vst"` before attempting `POST /sensor/add`.** If VIOS is not present, stop at step 3 — NvStreamer's RTSP URL is already serving and can be consumed directly by any RTSP client (ffmpeg, VLC, mediamtx, custom analytic).
+> **Precondition for step 4.** The handoff requires the VIOS stream-processor to be part of the active deployment. Most VSS profiles ship both (`dev-profile-alerts`, `dev-profile-lvs`, `dev-profile-search`, all warehouse profiles), but custom or NvStreamer-only setups may not include VIOS. **Run `vss vios list` first: exit 4 means the recorded deployment has no VIOS.** If VIOS is not present, stop at step 3 — NvStreamer's RTSP URL is already serving and can be consumed directly by any RTSP client (ffmpeg, VLC, mediamtx, custom analytic).
 
 1. Verify NvStreamer is reachable and is a streamer (not a VIOS gateway):
    ```bash
@@ -333,16 +327,16 @@ The reason this reference exists in the VIOS skill: the load-bearing pattern tha
    sleep 5
    URL=$(curl -s "http://<NVSTREAMER_ENDPOINT>/api/v1/sensor/$SID/streams" | jq -r '.[0].url')
    ```
-4. **(Only if VIOS stream-processor is part of the deployment — see precondition above.)** Register that RTSP URL with VIOS via VIOS's `POST /api/v1/sensor/add` on `${VSS_VIOS_URL}` (see `api-reference.md § 6`):
+4. **(Only if VIOS stream-processor is part of the deployment — see precondition above.)** Register that RTSP URL with VIOS through the CLI, which takes no endpoint:
    ```bash
-   # Confirm VIOS is up before attempting registration.
-   curl -sf --max-time 5 "${VSS_VIOS_URL}/api/v1/sensor/version" | jq -e '.type == "vst"' \
-     || { echo "VIOS stream-processor not deployed — skipping /sensor/add"; exit 0; }
-
-   curl -s -X POST "${VSS_VIOS_URL}/api/v1/sensor/add" \
-     -H "Content-Type: application/json" \
-     -d "{\"sensorUrl\": \"$URL\"}" | jq .
+   vss vios list >/dev/null; rc=$?
+   case $rc in
+     0) vss vios add --type stream "$URL" --name "$SID" ;;
+     4) echo "VIOS not in the recorded deployment — stop at step 3" ;;
+     *) exit $rc ;;
+   esac
    ```
+   Report a non-zero `vss vios add` exit as the failure; do not fall back to `POST /sensor/add`.
    VIOS treats the URL as an upstream RTSP camera; from this point on, the file goes through the recorder, WebRTC live/replay, snapshot, and clip-download
```

**File**: `skills/operations/vss-query-analytics/SKILL.md` (modified, +2/-0)
```diff
@@ -10,6 +10,8 @@ metadata:
   tags: "nvidia blueprint operational"
 ---
 
+# VSS Query Analytics
+
 ## Purpose
 
 Answer read-only video-analytics questions with `vss analytics`, which calls the
```

**File**: `skills/operations/vss-search-archive/SKILL.md` (modified, +3/-1)
```diff
@@ -14,6 +14,8 @@ metadata:
   vss-requires: "search"
 ---
 
+# VSS Search Archive
+
 ## Purpose
 
 Operate archive search from the caller's host. Compose and Kubernetes use the
@@ -100,7 +102,7 @@ independent of the index inventory.
 
 1. Confirm the selected deployment is the `search` profile. If required routes
    are unavailable, ask whether to reconnect or deploy it with
-   `the`/vss-build-vision-ai`stock Search workflow`; do not target another profile.
+   the `/vss-build-vision-ai` stock Search workflow; do not target another profile.
 
 2. When the user names a file, camera, or sensor, list registered sources with
    `vss vios list` before invoking the search CLI — it reads the origin
```

**File**: `skills/operations/vss-summarize-video/SKILL.md` (modified, +46/-63)
```diff
@@ -63,8 +63,8 @@ Load these files only as directed:
 - [`references/video-summarization-api.md`](references/video-summarization-api.md):
   load before constructing a live LVS operation **by hand** — a direct API
   question. Follow its **Runtime OpenAPI
-  Discovery** procedure on Docker. On Kubernetes, follow the K8s note there —
-  stock LVS Ingress does not publish LVS `/openapi.json`. The ordered
+  Discovery** procedure: the LVS schema is `/openapi.json` under
+  `services.lvs.url`; the origin's own `/openapi.json` is the Agent's. The ordered
   workflow does not build a summarize payload; the CLI owns that.
 - [`references/hitl-prompts.md`](references/hitl-prompts.md): load when
   collecting LVS scenario, events, and optional objects of interest.
@@ -76,7 +76,8 @@ Load these files only as directed:
   and `assets/video-summarization.env.example`: use when configuring the
   service environment.
 - [`../vss-build-vision-ai/references/deployment_resolution.md`](../../vss-build-vision-ai/references/deployment_resolution.md):
-  Kubernetes `VSS_PUBLIC_URL` contract and the `/lvs` mount.
+  Kubernetes `VSS_PUBLIC_URL` contract and the `/lvs` mount, for deployment
+  questions. The workflow itself reads its service URLs from `vss configure show`.
 - [`references/deploy-lvs-service.md`](references/deploy-lvs-service.md): load
   when asked about LVS's own container image, GPU/CPU/storage sizing, or
   deployment contract as a peer service (heavier than
@@ -108,24 +109,27 @@ Load these files only as directed:
 
 ## Prerequisites
 
-- VSS `lvs` profile reachable either on Docker (`$HOST_IP:38111`) or through
-  the public Ingress at `${VSS_PUBLIC_URL}/lvs`.
-- `curl` and `jq` on the agent host.
+- The `lvs` profile, reachable through the origin recorded by `vss configure`.
+- `curl` for the readiness probe only, and `jq` for reading CLI JSON. Capture
+  stdout before piping it, or use `set -o pipefail`. Exit codes and the common
+  CLI rules live in the repository root [`AGENTS.md`](../../../AGENTS.md).
 - Network reachability from the LVS service to the final VIOS clip URL (Docker:
   from `vss-lvs`; Kubernetes: deploy must mint a URL the LVS pod can fetch).
 - The `vss` CLI on `PATH`. The OpenClaw and Hermes harness images ship it; anywhere else, install it from the same checkout as this skill so the CLI and the skill match: `uv tool install <checkout>/libs/vss/cli`.
-- One recorded deployment origin. Configure it once, before Stage 4:
+- One recorded deployment origin:
 
 ```bash
 vss summarize run --help >/dev/null || exit 1
-# Compose publishes the ingress on :7777; Kubernetes uses VSS_PUBLIC_URL.
-VSS_ORIGIN="${VSS_PUBLIC_URL:-http://${HOST_IP:-localhost}:7777}"
-vss configure --base-url "${VSS_ORIGIN%/}" || exit 1
+vss configure show
 ```
 
-Configure against the
-ingress origin, never `:38111` — that LVS container port exposes no
-Elasticsearch, so a deployment recorded from it cannot persist.
+`vss configure show` fails when nothing is recorded. Then the only setup is
+`vss configure --base-url "${VSS_PUBLIC_URL}"`, with the ingress origin the
+operator gave you. If `VSS_PUBLIC_URL` is unset, stop and ask for that origin;
+do not substitute `HOST_IP`, `localhost`, or a port.
+
+Configure against the ingress origin, never `:38111` — that LVS container port
+exposes no Elasticsearch, so a deployment recorded from it cannot persist.
 
 The `vss-build-vision-ai` skill can deploy the profile.
 
@@ -140,58 +144,36 @@ The `vss-build-vision-ai` skill can deploy the profile.
 - Both edges are configured to wait an hour, matching the CLI's own default, so
   a long summarization is not cut short by a 504 that would be recorded as a
   failed job. An Ingress the deployment overrides shorter still caps the wait.
-- Stock LVS Helm Ingress does not publish LVS `/models`, LVS `/openapi.json`,
-  `/recommended_config`, or `/metrics` — those remain Docker `:38111` only.
-
-## Endpoint resolution (Kubernetes vs Docker)
 
-Resolve endpoints once before probing. Follow
-[`../vss-build-vision-ai/references/deployment_resolution.md`](../../vss-build-vision-ai/references/deployment_resolution.md).
+## Recorded services
 
-```bash
-# Prefer VSS_PUBLIC_URL; accept legacy VSS_ENDPOINT as the same public origin.
-if [ -z "${VSS_PUBLIC_URL:-}" ] && [ -n "${VSS_ENDPOINT:-}" ]; then
-  VSS_PUBLIC_URL="${VSS_ENDPOINT}"
-fi
-
-if [ -n "${VSS_PUBLIC_URL:-}" ]; then
-  DEPLOYMENT_KIND="kubernetes"
-  VSS_PUBLIC_URL="${VSS_PUBLIC_URL%/}"
-  # Force public origin — ignore leftover Docker LVS_BACKEND_URL / VLM_* env.
-  # The /lvs mount, not the origin — skill appends /v1/ready and /v1/summarize,
-  # and the gateway strips /lvs before the backend sees them.
-  LVS_BACKEND_URL="${VSS_PUBLIC_URL}/lvs"
-  VIDEO_SUMMARIZATION_URL="${LVS_BACKEND_URL}"
-  # RT-VLM is at its own mount; /v1/models and /v1/chat/completions hang off it.
-  VLM="${VSS_PUBLIC_URL}/rtvi-vlm"
-else
-  DEPLOYMENT_KIND="docker"
-  LVS_BACKEND_URL="${LVS_BACKEND_URL:
```

---

### Incident Patch 4: `c19a74c8` (2026-10-05)
**Commit Message**: fix: update vss homepage image in notebook (#2531)

Signed-off-by: Hien Tran <[REDACTED_EMAIL]>



---

### Incident Patch 5: `78ba4425` (2026-10-05)
**Commit Message**: Update NemoClaw quickstart LLM model (#2528)

Signed-off-by: nvleeryan <[REDACTED_EMAIL]>

**File**: `docs/nemoclaw-deploy-vss-and-skills.mdx` (modified, +1/-1)
```diff
@@ -141,7 +141,7 @@ DGX Spark is a single-GPU edge system, so it needs a few adjustments before you
 3. **Point the VSS LLM at a remote endpoint** (Section 1.2). A single GPU can run both a local LLM and the local VLM, but sharing the device often exhausts GPU memory. A remote LLM is recommended:
 
    ```python
-   LLM_NAME = "qwen/qwen3-next-80b-a3b-instruct"
+   LLM_NAME = "nvidia/nemotron-3.5-lightning-30b-a3b"
    LLM_ENDPOINT_URL = "https://integrate.api.nvidia.com"
    LLM_MODEL_TYPE = "openai"
    OPENAI_API_KEY = ""
```

---

### Incident Patch 6: `2b40409a` (2026-10-05)
**Commit Message**: fix(rtvi): update dependencies for six source scan CVEs (#2526)

* fix(rtvi): update dependencies for source scan CVEs

Signed-off-by: Amit Kale <[REDACTED_EMAIL]>

* chore(osrb): sync inventory.csv with the PR tree

Signed-off-by: github-actions[bot] <41898024+github-actions[bot]@users.noreply.github.com>

---------

Signed-off-by: Amit Kale <[REDACTED_EMAIL]>
Signed-off-by: github-actions[bot] <41898024+github-actions[bot]@users.noreply.github.com>
Co-authored-by: github-actions[bot] <41898024+github-actions[bot]@users.noreply.github.com>

**File**: `.github/osrb/inventory.csv` (modified, +4/-4)
```diff
@@ -3087,8 +3087,8 @@ PyGObject,UNKNOWN,GNU Lesser General Public License v2 or later (LGPLv2+),servic
 pyhanko,0.35.2,MIT,services/agent,python,lockfile,services/agent/uv.lock,runtime,no,no,no,declared-manifest,None
 pyhanko-certvalidator,0.31.1,MIT,services/agent,python,lockfile,services/agent/uv.lock,runtime,no,no,no,declared-manifest,None
 pyjwt,2.13.0,MIT,services/agent,python,lockfile,services/agent/uv.lock,runtime,no,no,no,declared-manifest,None
-pyjwt,2.13.0,MIT,services/rtvi/rt-vlm,python,lockfile;manifest,services/rtvi/rt-vlm/docker/rtvi_vlm/py_deps/pdm.lock;services/rtvi/rt-vlm/docker/rtvi_vlm/py_deps/requirements.txt,runtime,no,no,no,declared-manifest,None
 pyjwt,2.13.0,MIT,services/vios,python,lockfile,services/vios/test/bdd_tests/poetry.lock,runtime,no,no,no,declared-manifest,None
+pyjwt,2.14.0,MIT,services/rtvi/rt-vlm,python,lockfile;manifest,services/rtvi/rt-vlm/docker/rtvi_vlm/py_deps/pdm.lock;services/rtvi/rt-vlm/docker/rtvi_vlm/py_deps/requirements.txt,runtime,no,no,no,declared-manifest,None
 pykml,0.2.0,BSD-3-Clause,services/analytics/behavior-analytics,python,lockfile,services/analytics/behavior-analytics/Pipfile.lock,runtime,no,no,no,declared-manifest,None
 pylibsrtp,1.0.0,BSD-3-Clause,services/vios,python,lockfile,services/vios/test/bdd_tests/poetry.lock,runtime,no,no,no,declared-manifest,None
 pymediainfo,6.1.0,MIT License,services/rtvi/rt-embed,python,lockfile;manifest,services/rtvi/rt-embed/docker/py_deps/pdm.lock;services/rtvi/rt-embed/docker/py_deps/pyproject.toml;services/rtvi/rt-embed/docker/py_deps/requirements.txt,runtime,no,no,no,declared-manifest,None
@@ -3153,7 +3153,7 @@ python-dateutil,2.9.0.post0,Apache-2.0,services/configurators/vss-configurator,p
 python-dateutil,2.9.0.post0,Apache-2.0 OR BSD-3-Clause,services/rtvi/rt-vlm,python,lockfile;manifest,services/rtvi/rt-vlm/docker/rtvi_vlm/py_deps/pdm.lock;services/rtvi/rt-vlm/docker/rtvi_vlm/py_deps/requirements.txt,runtime,no,no,no,declared-manifest,None
 python-dateutil,2.9.0.post0,Apache-2.0,services/sdrc,python,lockfile,services/sdrc/uv.lock,runtime,no,no,no,declared-manifest,None
 python-dateutil,2.9.0.post0,Apache-2.0 OR BSD-3-Clause,tools/sdg-postprocessing,python,manifest,tools/sdg-postprocessing/requirements.txt,runtime,no,no,no,declared-manifest,None
-python-discovery,1.5.3,UNKNOWN,services/rtvi/rt-vlm,python,lockfile;manifest,services/rtvi/rt-vlm/docker/rtvi_vlm/py_deps/pdm.lock;services/rtvi/rt-vlm/docker/rtvi_vlm/py_deps/requirements.txt,runtime,no,no,no,declared-manifest,Unknown
+python-discovery,1.6.1,UNKNOWN,services/rtvi/rt-vlm,python,lockfile;manifest,services/rtvi/rt-vlm/docker/rtvi_vlm/py_deps/pdm.lock;services/rtvi/rt-vlm/docker/rtvi_vlm/py_deps/requirements.txt,runtime,no,no,no,declared-manifest,Unknown
 python-dotenv,1.0.1,BSD-3-Clause,libs/analytics/spatialai-data-utils,python,lockfile;manifest,libs/analytics/spatialai-data-utils/Pipfile.lock;libs/analytics/spatialai-data-utils/release/pyproject.toml,runtime,no,no,no,declared-manifest,None
 python-dotenv,1.0.1,BSD-3-Clause,services/configurators/vss-configurator,python,lockfile,services/configurators/vss-configurator/uv.lock,runtime,no,no,no,declared-manifest,None
 python-dotenv,1.2.2,BSD-3-Clause,services/agent,python,lockfile,services/agent/uv.lock,runtime,no,no,no,declared-manifest,None
@@ -3882,11 +3882,11 @@ urllib3,2.7.0,MIT,services/agent,python,lockfile,services/agent/uv.lock,runtime,
 urllib3,2.7.0,MIT,services/analytics/behavior-analytics,python,lockfile,services/analytics/behavior-analytics/Pipfile.lock,runtime,no,no,no,declared-manifest,None
 urllib3,2.7.0,MIT,services/configurators/vss-configurator,python,lockfile,services/configurators/vss-configurator/uv.lock,runtime,no,no,no,declared-manifest,None
 urllib3,2.7.0,MIT,services/rtvi/rt-embed,python,lockfile;manifest,services/rtvi/rt-embed/docker/py_deps/pdm.lock;services/rtvi/rt-embed/docker/py_deps/pyproject.toml;services/rtvi/rt-embed/docker/py_deps/requirements.txt,runtime,no,no,no,declared-manifest,None
-urllib3,2.7.0,MIT,services/rtvi/rt-vlm,python,lockfile;manifest,services/rtvi/rt-vlm/docker/rtvi_vlm/py_deps/pdm.lock;services/rtvi/rt-vlm/docker/rtvi_vlm/py_deps/pyproject.toml;services/rtvi/rt-vlm/docker/rtvi_vlm/py_deps/requirements.txt,runtime,no,no,no,declared-manifest,None
 urllib3,2.7.0,MIT,services/sdrc,python,lockfile,services/sdrc/uv.lock,runtime,no,no,no,declared-manifest,None
 urllib3,2.7.0,MIT,services/video-summarization,python,lockfile;manifest,services/video-summarization/docker/base/py_deps/pyproject.toml;services/video-summarization/docker/base/py_deps/uv.lock,runtime,no,no,no,declared-manifest,None
 urllib3,2.7.0,MIT,services/vios,python,lockfile,services/vios/test/bdd_tests/poetry.lock,runtime,no,no,no,declared-manifest,None
 urllib3,2.7.0,MIT,skills/benchmarking,python,manifest,skills/benchmarking/vss-benchmark-video-summarization/scripts/requirements.txt,runtime,no,no,no,declared-manifest,None
+urllib3,2.8.0,MIT,services/rtvi/rt-vlm,python,lockfile;manifest,serv
```

**File**: `services/rtvi/rt-vlm/docker/rtvi_vlm/py_deps/pdm-build-requirements.txt` (modified, +3/-3)
```diff
@@ -30,7 +30,7 @@ pdm==2.26.1 --hash=sha256:20c95f799c182c8ea4c33d81e51571e8fc6e2ab4c1fd3482785601
 platformdirs==4.11.3 --hash=sha256:5ed065d443751de711da036041a7a214122efc4a4de393b3f4137ba5576540e7
 pygments==2.21.0 --hash=sha256:2363c69b61c4a97c838da3b130dcd6468f4848992b21a82f2a63ec34377137d9
 pyproject_hooks==1.2.0 --hash=sha256:9e5c6bfa8dcc30091c74b0cf803c81fdd29d94f01992a7707bc97babb1141913
-python-discovery==1.5.2 --hash=sha256:3e338c2d0f15dfaeea57493f4c2c6caebe0e998ea815c30ae8bf8ee21f1112d3
+python-discovery==1.6.1 --hash=sha256:d43fcdef879fe795352bd13ccf8d185ba5a9f86f36cfcd00529f596e737442b3
 python-dotenv==1.2.3 --hash=sha256:904552145e8bfed22162c09dab1c2b9b54fefa7b23ba780f4f26ca0316b0f0d9
 resolvelib==1.2.1 --hash=sha256:fb06b66c8da04172d9e72a21d7d06186d8919e32ae5ab5cdf5b9d920be805ac2
 rich==15.0.0 --hash=sha256:33bd4ef74232fb73fe9279a257718407f169c09b78a87ad3d296f548e27de0bb
@@ -40,5 +40,5 @@ tomlkit==0.15.1 --hash=sha256:177a05aece5a8ca5266fd3c448abb47b8d352f09d477d3ca83
 truststore==0.10.4 --hash=sha256:adaeaecf1cbb5f4de3b1959b42d41f6fab57b2b1666adb59e89cb0b53361d981
 typing-extensions==4.16.0 --hash=sha256:481caa481374e813c1b176ada14e97f1f67a4539ce9cfeb3f350d78d6370c2e8
 unearth==0.18.3 --hash=sha256:306773b7a792af7d44b3b2a3bea21ba63a0b947546ad8ee793194fd09a6ae020
-urllib3==2.7.0 --hash=sha256:9fb4c81ebbb1ce9531cce37674bbc6f1360472bc18ca9a553ede278ef7276897
-virtualenv==21.7.4 --hash=sha256:376ec93cd6aab3044fa395d7db226db38043b7b5748948044b2a87168525e843
+urllib3==2.8.0 --hash=sha256:0cf3cae568d36aa9576b28dfb35f11328f1cb974ca7647d9475ebb86c75ac6e3
+virtualenv==21.7.13 --hash=sha256:1bea5af7463f59c4719db48fe739579a2a4f569c96f26c086edda85c96da9f59
```

**File**: `services/rtvi/rt-vlm/docker/rtvi_vlm/py_deps/pdm.lock` (modified, +18/-18)
```diff
@@ -5,7 +5,7 @@
 groups = ["default"]
 strategy = ["inherit_metadata"]
 lock_version = "4.5.0"
-content_hash = "sha256:0afba5576009111bae32bdb75ec6482fb3b2ad24408ba91a569957fad119a779"
+content_hash = "sha256:fb0a2907b81c501e8a5a3ef2e4ef5ebbc66e7c974cc6404f36d10ddd3a421c3d"
 
 [[metadata.targets]]
 requires_python = "==3.12.*"
@@ -2376,32 +2376,32 @@ files = [
 
 [[package]]
 name = "pyjwt"
-version = "2.13.0"
+version = "2.14.0"
 requires_python = ">=3.9"
 summary = "JSON Web Token implementation in Python"
 groups = ["default"]
 dependencies = [
     "typing-extensions>=4.0; python_version < \"3.11\"",
 ]
 files = [
-    {file = "pyjwt-2.13.0-py3-none-any.whl", hash = "sha256:66adcc2aff09b3f1bbd95fc1e1577df8ac8723c978552fd43304c8a290ac5728"},
-    {file = "pyjwt-2.13.0.tar.gz", hash = "sha256:41571c89ca91598c79e8ef18a2d07367d4810fbbd6f637794879baf1b7703423"},
+    {file = "pyjwt-2.14.0-py3-none-any.whl", hash = "sha256:ad0cef71c756a56e74863c2919cf0985f72decbcfcb550ee2f422e7c62b5eedc"},
+    {file = "pyjwt-2.14.0.tar.gz", hash = "sha256:77283c83fb56ecf566a886c757a714bc83668e38156de2cce8263302f42e0b86"},
 ]
 
 [[package]]
 name = "pyjwt"
-version = "2.13.0"
+version = "2.14.0"
 extras = ["crypto"]
 requires_python = ">=3.9"
 summary = "JSON Web Token implementation in Python"
 groups = ["default"]
 dependencies = [
     "cryptography>=3.4.0",
-    "pyjwt==2.13.0",
+    "pyjwt==2.14.0",
 ]
 files = [
-    {file = "pyjwt-2.13.0-py3-none-any.whl", hash = "sha256:66adcc2aff09b3f1bbd95fc1e1577df8ac8723c978552fd43304c8a290ac5728"},
-    {file = "pyjwt-2.13.0.tar.gz", hash = "sha256:41571c89ca91598c79e8ef18a2d07367d4810fbbd6f637794879baf1b7703423"},
+    {file = "pyjwt-2.14.0-py3-none-any.whl", hash = "sha256:ad0cef71c756a56e74863c2919cf0985f72decbcfcb550ee2f422e7c62b5eedc"},
+    {file = "pyjwt-2.14.0.tar.gz", hash = "sha256:77283c83fb56ecf566a886c757a714bc83668e38156de2cce8263302f42e0b86"},
 ]
 
 [[package]]
@@ -2466,16 +2466,16 @@ files = [
 
 [[package]]
 name = "python-discovery"
-version = "1.5.3"
+version = "1.6.1"
 requires_python = ">=3.8"
 summary = "Python interpreter discovery"
 groups = ["default"]
 dependencies = [
     "filelock>=3.15.4",
 ]
 files = [
-    {file = "python_discovery-1.5.3-py3-none-any.whl", hash = "sha256:8305296358f1aa2ed302a25b84be7df84fef8ca47c7dce2da63cb7325333044e"},
-    {file = "python_discovery-1.5.3.tar.gz", hash = "sha256:e500eb24025fb7c4876c1fdcfbafd9028a10c71b661aee38cb6fb0de594518c1"},
+    {file = "python_discovery-1.6.1-py3-none-any.whl", hash = "sha256:d43fcdef879fe795352bd13ccf8d185ba5a9f86f36cfcd00529f596e737442b3"},
+    {file = "python_discovery-1.6.1.tar.gz", hash = "sha256:cf87d3627dfb4412437fdd5b13eae402607722998d21567993aedbc59b23c15e"},
 ]
 
 [[package]]
@@ -3249,13 +3249,13 @@ files = [
 
 [[package]]
 name = "urllib3"
-version = "2.7.0"
+version = "2.8.0"
 requires_python = ">=3.10"
 summary = "HTTP library with thread-safe connection pooling, file post, and more."
 groups = ["default"]
 files = [
-    {file = "urllib3-2.7.0-py3-none-any.whl", hash = "sha256:9fb4c81ebbb1ce9531cce37674bbc6f1360472bc18ca9a553ede278ef7276897"},
-    {file = "urllib3-2.7.0.tar.gz", hash = "sha256:231e0ec3b63ceb14667c67be60f2f2c40a518cb38b03af60abc813da26505f4c"},
+    {file = "urllib3-2.8.0-py3-none-any.whl", hash = "sha256:0cf3cae568d36aa9576b28dfb35f11328f1cb974ca7647d9475ebb86c75ac6e3"},
+    {file = "urllib3-2.8.0.tar.gz", hash = "sha256:63bf2ead4c879426ebf22ef2a781eeb4aa3b4ae798a0435506f8687fd5bb9b63"},
 ]
 
 [[package]]
@@ -3312,7 +3312,7 @@ files = [
 
 [[package]]
 name = "virtualenv"
-version = "21.7.5"
+version = "21.7.13"
 requires_python = ">=3.9"
 summary = "Virtual Python Environment builder"
 groups = ["default"]
@@ -3321,12 +3321,12 @@ dependencies = [
     "filelock<4,>=3.24.2; python_version >= \"3.10\"",
     "filelock<=3.19.1,>=3.16.1; python_version < \"3.10\"",
     "platformdirs<5,>=3.9.1",
-    "python-discovery>=1.4.2",
+    "python-discovery>=1.6",
     "typing-extensions>=4.13.2; python_version < \"3.11\"",
 ]
 files = [
-    {file = "virtualenv-21.7.5-py3-none-any.whl", hash = "sha256:e36ca889510ab6cb0b1dca93c59e5431dd4422a3c88f487358d470c90af8c07a"},
-    {file = "virtualenv-21.7.5.tar.gz", hash = "sha256:a73c4246fba3c8901ff9717399f466e00eeca5a3834981f1a6ebb4f1e94de2f8"},
+    {file = "virtualenv-21.7.13-py3-none-any.whl", hash = "sha256:1bea5af7463f59c4719db48fe739579a2a4f569c96f26c086edda85c96da9f59"},
+    {file = "virtualenv-21.7.13.tar.gz", hash = "sha256:0355558b6f33619aab31347e43643b0ebc97f61ea3acf617b2b69e1f8a843d11"},
 ]
 
 [[package]]
```

**File**: `services/rtvi/rt-vlm/docker/rtvi_vlm/py_deps/pyproject.toml` (modified, +3/-1)
```diff
@@ -54,7 +54,7 @@ dependencies = [
     "kafka-python==2.3.2",
     "nvidia-cutlass-dsl==4.4.2",
     "ray[default]==2.54.0",
-    "urllib3==2.7.0",
+    "urllib3==2.8.0",
     "onnxscript==0.5.7",
     "redis==7.1.0",
     "langchain-core==0.3.81",
@@ -126,3 +126,5 @@ opencv-python-headless = "==4.13.0.92"
 mistral-common = "==1.10.0"
 mcp = "==1.26.0"
 numpy = "==2.1.0"
+pyjwt = "==2.14.0"
+virtualenv = "==21.7.13"
```

**File**: `services/rtvi/rt-vlm/docker/rtvi_vlm/py_deps/requirements.txt` (modified, +4/-4)
```diff
@@ -144,12 +144,12 @@ pydantic-core==2.48.0
 pydantic-extra-types[pycountry]==2.11.1
 pydantic-settings==2.15.0
 pygments==2.21.0
-pyjwt[crypto]==2.13.0
+pyjwt[crypto]==2.14.0
 pymediainfo==6.1.0
 pyparsing==3.3.2
 pytest==8.1.1
 python-dateutil==2.9.0.post0
-python-discovery==1.5.3
+python-discovery==1.6.1
 python-dotenv==1.2.3
 python-multipart==0.0.30
 pywin32==312; sys_platform == "win32"
@@ -196,11 +196,11 @@ transformers==5.5.0
 typer==0.27.1
 typing-extensions==4.16.0
 typing-inspection==0.4.4
-urllib3==2.7.0
+urllib3==2.8.0
 uuid-utils==0.17.0
 uvicorn==0.52.4; sys_platform != "emscripten"
 validators==0.35.0
-virtualenv==21.7.5
+virtualenv==21.7.13
 wcwidth==0.8.2
 websockets==17.0.1
 win32-setctime==1.2.0; sys_platform == "win32"
```

---

### Incident Patch 7: `e5d5f4af` (2026-10-05)
**Commit Message**: fix(vss-configurator): upgrade kafka-python, distroless Python, and split complex paths (#2518)

* fix(vss-configurator): upgrade kafka-python and distroless Python

kafka-python 2.3.0 is affected by the protocol parser advisory. 2.3.2 includes that fix, and the runtime base moves to distroless Python 3.13-v4.1.5.

Signed-off-by: Munjal Patel <[REDACTED_EMAIL]>

* chore(osrb): record kafka-python 2.3.2 for vss-configurator

The inventory still listed 2.3.0 after the dependency bump, so the committed record disagreed with pyproject.toml and uv.lock.

Signed-off-by: Munjal Patel <[REDACTED_EMAIL]>

* refactor(vss-configurator): split high-complexity sensor and profile paths

Sonar flags these functions above the cognitive-complexity limit. The same checks, errors, and retries now live in helpers so the existing flow stays intact.

Signed-off-by: Munjal Patel <[REDACTED_EMAIL]>

* fix(vss-configurator): remove temp calibration file when copy fails

The staging helper raised before the caller could see the temp path, so a failed copy left a partial file in the calibration directory.

Signed-off-by: Munjal Patel <[REDACTED_EMAIL]>

* fix(vss-configurator): share the mode-less log suffix

**File**: `.github/osrb/inventory.csv` (modified, +2/-2)
```diff
@@ -2099,8 +2099,8 @@ jszip,3.10.1,(MIT OR GPL-3.0-or-later),.openclaw,node,lockfile,.openclaw/plugin/
 just-extend,6.2.0,MIT,services/analytics/video-analytics-api,node,lockfile,services/analytics/video-analytics-api/test/package-lock.json,runtime,no,no,no,declared-manifest,None
 jwa,2.0.1,MIT,.openclaw,node,lockfile,.openclaw/plugin/package-lock.json,runtime,no,no,no,declared-manifest,None
 jws,4.0.1,MIT,.openclaw,node,lockfile,.openclaw/plugin/package-lock.json,runtime,no,no,no,declared-manifest,None
-kafka-python,2.3.0,Apache-2.0,services/configurators/vss-configurator,python,lockfile;manifest,services/configurators/vss-configurator/pyproject.toml;services/configurators/vss-configurator/uv.lock,runtime,no,no,no,declared-manifest,None
 kafka-python,2.3.0,Apache-2.0,services/sdrc,python,lockfile;manifest,services/sdrc/pyproject.toml;services/sdrc/uv.lock,runtime,no,no,no,declared-manifest,None
+kafka-python,2.3.2,Apache-2.0,services/configurators/vss-configurator,python,lockfile;manifest,services/configurators/vss-configurator/pyproject.toml;services/configurators/vss-configurator/uv.lock,runtime,no,no,no,declared-manifest,None
 kafka-python,2.3.2,Apache-2.0,services/rtvi/rt-embed,python,lockfile;manifest,services/rtvi/rt-embed/docker/py_deps/pdm.lock;services/rtvi/rt-embed/docker/py_deps/pyproject.toml;services/rtvi/rt-embed/docker/py_deps/requirements.txt,runtime,no,no,no,declared-manifest,None
 kafka-python,2.3.2,Apache-2.0,services/rtvi/rt-vlm,python,lockfile;manifest,services/rtvi/rt-vlm/docker/rtvi_vlm/py_deps/pdm.lock;services/rtvi/rt-vlm/docker/rtvi_vlm/py_deps/pyproject.toml;services/rtvi/rt-vlm/docker/rtvi_vlm/py_deps/requirements.txt,runtime,no,no,no,declared-manifest,None
 kafka-python,3.0.11,Apache-2.0,services/video-summarization,python,lockfile;manifest,services/video-summarization/docker/base/py_deps/pyproject.toml;services/video-summarization/docker/base/py_deps/uv.lock,runtime,no,no,no,declared-manifest,None
@@ -2618,8 +2618,8 @@ nvcr.io/nvidia/distroless/python,3.13-v4.0.9,UNKNOWN,services/rtvi/rt-cv-3d/rt-c
 nvcr.io/nvidia/distroless/python,3.13-v4.0.9,UNKNOWN,services/rtvi/rt-cv-3d/rt-cv-config-init,container,container,services/rtvi/rt-cv-3d/rt-cv-config-init/Dockerfiles/mv3dt-config-init.Dockerfile,runtime,no,no,yes,container-base,Unknown
 nvcr.io/nvidia/distroless/python,3.13-v4.1.2,UNKNOWN,services/agent,container,container,services/agent/docker/Dockerfile,runtime,no,no,yes,container-base,Unknown
 nvcr.io/nvidia/distroless/python,3.13-v4.1.4,UNKNOWN,services/alert,container,container,services/alert/Dockerfile,runtime,no,no,yes,container-base,Unknown
-nvcr.io/nvidia/distroless/python,3.13-v4.1.4,UNKNOWN,services/configurators/vss-configurator,container,container,services/configurators/vss-configurator/docker/Dockerfile,runtime,no,no,yes,container-base,Unknown
 nvcr.io/nvidia/distroless/python,3.13-v4.1.5,UNKNOWN,services/analytics/behavior-analytics,container,container,services/analytics/behavior-analytics/docker/Dockerfile,runtime,no,no,yes,container-base,Unknown
+nvcr.io/nvidia/distroless/python,3.13-v4.1.5,UNKNOWN,services/configurators/vss-configurator,container,container,services/configurators/vss-configurator/docker/Dockerfile,runtime,no,no,yes,container-base,Unknown
 nvcr.io/nvidia/k8s/dcgm-exporter,4.2.0-4.1.0-ubuntu22.04,UNKNOWN,services/rtvi/rt-vlm,container,compose,services/rtvi/rt-vlm/docker/compose.yaml,runtime,no,no,yes,container-image,Unknown
 nvcr.io/nvidia/k8s/dcgm-exporter,4.2.3-4.1.3-ubuntu22.04,UNKNOWN,services/rtvi/rt-embed,container,compose,services/rtvi/rt-embed/docker/compose.yaml,runtime,no,no,yes,container-image,Unknown
 nvcr.io/nvidia/pytorch,26.03-py3,UNKNOWN,services/rtvi/rt-embed,container,container,services/rtvi/rt-embed/docker/Dockerfile,runtime,no,no,yes,container-base,Unknown
```

**File**: `services/configurators/vss-configurator/3rdParty_Licenses.md` (modified, +1/-1)
```diff
@@ -1787,7 +1787,7 @@ THE SOFTWARE.
 
 ---
 
-## kafka-python:2.3.0
+## kafka-python:2.3.2
 
 **License Type:** Apache-2.0
 
```

**File**: `services/configurators/vss-configurator/README.md` (modified, +3/-3)
```diff
@@ -314,7 +314,7 @@ docker build \
   -t vss-configurator .
 ```
 
-The image uses a multi-stage build: **Python 3.13** dependencies, including the in-repo SDU package, via `uv sync --frozen --no-dev`, runtime on **`nvcr.io/nvidia/distroless/python:3.13-v4.1.4`**. Python and distroless versions are `ARG`s at the top of `docker/Dockerfile` (`PYTHON_VERSION`, `DISTROLESS_IMG`, `DISTROLESS_TAG`).
+The image uses a multi-stage build: **Python 3.13** dependencies, including the in-repo SDU package, via `uv sync --frozen --no-dev`, runtime on **`nvcr.io/nvidia/distroless/python:3.13-v4.1.5`**. Python and distroless versions are `ARG`s at the top of `docker/Dockerfile` (`PYTHON_VERSION`, `DISTROLESS_IMG`, `DISTROLESS_TAG`).
 
 **Legal requirements (container distribution):**
 
@@ -638,7 +638,7 @@ Status for NVStreamer/VMS video upload (for init-container polling).
 |------|--------|
 | Build context | monorepo root (`.`) |
 | Builder | `python:3.13-trixie` + `uv sync --frozen --no-dev` |
-| Runtime base | `nvcr.io/nvidia/distroless/python:3.13-v4.1.4` (`DISTROLESS_IMG`:`DISTROLESS_TAG`) |
+| Runtime base | `nvcr.io/nvidia/distroless/python:3.13-v4.1.5` (`DISTROLESS_IMG`:`DISTROLESS_TAG`) |
 | Entrypoint | `python entrypoint.py` (no shell in image) |
 | Working directory | `/usr/src/app` |
 | Python deps | `PYTHONPATH=/usr/src/app/site-packages` |
@@ -969,7 +969,7 @@ Runtime dependencies are declared in `pyproject.toml` and locked in `uv.lock`.
 |---------|---------|------|
 | Flask | 3.1.0 | REST API |
 | gunicorn | 23.0.0 | WSGI server |
-| kafka-python | 2.3.0 | Kafka producer |
+| kafka-python | 2.3.2 | Kafka producer |
 | redis | 5.0.1 | Redis streams / duplicator |
 | requests | 2.32.3 | HTTP client (calibration, MSB, NVStreamer, VMS) |
 | ruamel.yaml | 0.18.15 | Profile YAML read/write |
```

**File**: `services/configurators/vss-configurator/app/profile_configurator/profile_config_manager.py` (modified, +385/-269)
```diff
@@ -71,6 +71,7 @@ class ProfileConfigManager:
     DEFAULT_CONFIG_FILE = 'gpu_configs_generic.yaml'
     DEFAULT_HARDWARE_PROFILE = 'default'
     DEFAULT_DEPLOYMENT_MODE = '3d'
+    MODE_LESS_SUFFIX = " (mode-less)"
 
     @staticmethod
     def _hardware_profile_names(profile_configs: Dict[str, Any]) -> List[str]:
@@ -119,18 +120,18 @@ def __init__(self, config_file: Optional[str] = None) -> None:
         if not self._has_effective_config():
             logger.warning(
                 f"No configuration found for HW profile: {self.hardware_profile}"
-                + (f" and MODE: {self.deployment_profile}" if self.deployment_modes_enabled else " (mode-less)")
+                + self._mode_suffix()
             )
         else:
             if self.config:
                 logger.info(
                     f"Found configurations for HW Profile: {self.hardware_profile}"
-                    + (f" and MODE: {self.deployment_profile}" if self.deployment_modes_enabled else " (mode-less)")
+                    + self._mode_suffix()
                 )
             else:
                 logger.info(
                     f"Using common configurations for HW Profile: {self.hardware_profile}"
-                    + (f" and MODE: {self.deployment_profile}" if self.deployment_modes_enabled else " (mode-less)")
+                    + self._mode_suffix()
                 )
             # Run variable validation first (validates env vars before any processing)
             self._execute_variable_validation()
@@ -1182,6 +1183,52 @@ def _execute_file_management(self, operation: Dict[str, Any]) -> bool:
             logger.warning(f"Unsupported file management action: {action}")
             return False
 
+    def _require_video_directory(self, raw_directory: Any) -> Path:
+        """Return a readable video directory, or raise the existing path errors."""
+        directory = Path(str(self._substitute_env_vars(raw_directory)))
+        if not directory.exists():
+            raise FileNotFoundError(f"Video directory not found: {directory}")
+        if not directory.is_dir():
+            raise ValueError(f"Video path is not a directory: {directory}")
+        if not os.access(directory, os.R_OK):
+            raise PermissionError(f"Video directory is not readable: {directory}")
+        return directory
+
+    @staticmethod
+    def _video_name_matches(name: str, normalized_patterns: List[str]) -> bool:
+        lowered = name.lower()
+        for pattern in normalized_patterns:
+            if fnmatch.fnmatch(lowered, pattern):
+                return True
+        return False
+
+    @staticmethod
+    def _matched_video_files(
+        directory: Path,
+        normalized_patterns: List[str],
+    ) -> List[Path]:
+        matched = [
+            path
+            for path in directory.iterdir()
+            if path.is_file() and ProfileConfigManager._video_name_matches(
+                path.name, normalized_patterns
+            )
+        ]
+        matched.sort(key=lambda path: path.name)
+        return matched
+
+    @staticmethod
+    def _register_camera_stem(files_by_stem: Dict[str, Path], path: Path) -> None:
+        sensor_id = path.stem
+        if not sensor_id or not sensor_id.strip():
+            raise ValueError(f"Video file has an empty camera ID: {path}")
+        if sensor_id in files_by_stem:
+            raise ValueError(
+                f"Duplicate camera ID '{sensor_id}' from video files "
+                f"{files_by_stem[sensor_id]} and {path}"
+            )
+        files_by_stem[sensor_id] = path
+
     def _discover_camera_names(
         self,
         directories: List[str],
@@ -1200,43 +1247,16 @@ def _discover_camera_names(
         files_by_stem: Dict[str, Path] = {}
 
         for raw_directory in directories:
-            directory = Path(str(self._substitute_env_vars(raw_directory)))
-            if not directory.exists():
-                raise FileNotFoundError(f"Video directory not found: {directory}")
-            if not directory.is_dir():
-                raise ValueError(f"Video path is not a directory: {directory}")
-            if not os.access(directory, os.R_OK):
-                raise PermissionError(f"Video directory is not readable: {directory}")
-
-            matched_files = sorted(
-                (
-                    path
-                    for path in directory.iterdir()
-                    if path.is_file()
-                    and any(
-                        fnmatch.fnmatch(path.name.lower(), pattern)
-                        for pattern in normalized_patterns
-                    )
-                ),
-                key=lambda path: path.name,
-            )
+            directory = self._require_video_directory(raw_directory)
+            matched_files = self._matched_video_files(directory, normalized_patterns)
             logger.info(
                 "Discovered %d video file(s) in %s: %s",
                 len(matched_files),
        
```

**File**: `services/configurators/vss-configurator/app/sensor_config_manager.py` (modified, +134/-89)
```diff
@@ -313,7 +313,7 @@ def add_sensor(sensor_info: Sensor, delay=30, timeout=None):
         try:
             logger.debug(f"Sending POST request to add sensor: {sensor_data['name']}")
             response = requests.post(CONFIG['VST_CAMERA_ADD_ENDPOINT'], json=sensor_data, headers=headers, timeout=timeout)
-            if response is not None and response.status_code == 200:
+            if response.status_code == 200:
                 logger.info(f"Successfully added sensor: {sensor_data['name']}")
                 logger.debug(f"VMS response: {response.text}")
                 return
@@ -326,9 +326,9 @@ def add_sensor(sensor_info: Sensor, delay=30, timeout=None):
             if _sensor_already_registered(response, error_message):
                 logger.info(f"Sensor {sensor_data['name']} already registered with VMS: {error_message}")
                 return
-            status_code = response.status_code if response is not None else "no response"
+            status_code = response.status_code
             logger.warning(f"Error adding sensor {sensor_data['name']}. Received status code {status_code} from VMS. Retrying in {delay} seconds...")
-            logger.debug(f"VMS error response: {response.text if response is not None else 'No response'}")
+            logger.debug(f"VMS error response: {response.text}")
             time.sleep(delay)
         except requests.exceptions.Timeout as e:
             logger.warning(
@@ -775,85 +775,155 @@ def _nvstreamer_stream_list_is_complete(current_count, last_count, expected_coun
     return last_count is not None and last_count == current_count
 
 
+def _read_nvstreamer_stream_page():
+    """Poll the streams endpoint once.
+
+    Returns (kind, json_vals, current_count). kind is transport_error,
+    http_error, parse_error, empty, or ok. The payload is set only for ok.
+    """
+    endpoint = CONFIG['NVSTREAMER_STREAMS_ENDPOINT']
+    poll_interval = NVSTREAMER_STREAMS_POLL_INTERVAL_SEC
+    logger.info("Checking Nvstreamer streams endpoint to see if it's ready")
+    try:
+        resp = requests.get(endpoint)
+    except Exception as e:
+        logger.warning(f"Error while checking Nvstreamer streams endpoint, retrying in {poll_interval} seconds")
+        logger.debug(f"Exception details: {repr(e)}")
+        return "transport_error", None, None
+
+    if not resp.status_code == 200:
+        logger.info(
+            f"Getting status code {resp.status_code} from Nvstreamer streams endpoint "
+            f"{endpoint} - retrying in {poll_interval} seconds"
+        )
+        return "http_error", None, None
+
+    try:
+        json_vals = resp.json()
+        current_count = len(json_vals) if json_vals else 0
+        if current_count == 0:
+            logger.info(
+                f"Nvstreamer streams endpoint returned empty response - retrying in {poll_interval} seconds"
+            )
+            return "empty", None, None
+    except Exception as e:
+        logger.info(
+            f"Failed to parse Nvstreamer response as JSON - retrying in {poll_interval} seconds. "
+            f"Exception: {repr(e)}"
+        )
+        return "parse_error", None, None
+
+    logger.info(
+        f"Getting status code {resp.status_code} from Nvstreamer streams endpoint "
+        f"{endpoint} with valid response"
+    )
+    logger.info(f"Successfully parsed Nvstreamer streams endpoint response: {json_vals}")
+    return "ok", json_vals, current_count
+
+
+def _nvstreamer_partial_wait(
+    partial_wait_started_at,
+    timeout,
+    expected_count,
+    current_count,
+    poll_interval,
+):
+    """Advance the partial-list timer. Returns (started_at, timed_out, retry_in)."""
+    now = time.time()
+    if partial_wait_started_at is None:
+        partial_wait_started_at = now
+    partial_elapsed = now - partial_wait_started_at
+    if partial_elapsed >= timeout:
+        expected_note = f", expected {expected_count}" if expected_count else ""
+        logger.warning(
+            f"Nvstreamer reported {current_count} stream(s) for {partial_elapsed:.1f}s "
+            f"(NVSTREAMER_STREAMS_ENDPOINT_TIMEOUT {timeout}s{expected_note}); "
+            "proceeding with the list collected so far"
+        )
+        return partial_wait_started_at, True, None
+    retry_in = min(poll_interval, max(0.0, timeout - partial_elapsed))
+    if expected_count > 0:
+        logger.info(
+            f"Nvstreamer reported {current_count} stream(s), waiting for expected {expected_count} "
+            f"- retrying in {retry_in} seconds (timeout {timeout}s)"
+        )
+    else:
+        logger.info(
+            f"Nvstreamer reported {current_count} stream(s); waiting for the list to stabilize "
+            f"- retrying in {retry_in} seconds (timeout {timeout}s)"
+        )
+    return partial_wait_started_at, False, retry_in
+
+
+def _nvstreamer_event(curr_data):
+    return {
+        "source": "preload",
+        "event": {
+            # Quick fix till the time n
```

**File**: `services/configurators/vss-configurator/docker/Dockerfile` (modified, +1/-1)
```diff
@@ -15,7 +15,7 @@
 
 ARG PYTHON_VERSION=3.13
 ARG DISTROLESS_IMG=nvcr.io/nvidia/distroless/python
-ARG DISTROLESS_TAG=${PYTHON_VERSION}-v4.1.4
+ARG DISTROLESS_TAG=${PYTHON_VERSION}-v4.1.5
 
 # -----------------------------------------------------------------------------
 # Stage 1: Builder — install Python deps (with build tools for any C extensions)
```

**File**: `services/configurators/vss-configurator/pyproject.toml` (modified, +1/-1)
```diff
@@ -20,7 +20,7 @@ description = "Unified configuration management service for VSS Blueprints"
 requires-python = ">=3.13"
 dependencies = [
     "Flask==3.1.0",
-    "kafka-python==2.3.0",
+    "kafka-python==2.3.2",
     "gunicorn==23.0.0",
     "requests==2.32.3",
     "redis==5.0.1",
```

**File**: `services/configurators/vss-configurator/tests/test_recompute_bev_groups.py` (modified, +20/-0)
```diff
@@ -296,6 +296,26 @@ def test_recompute_exception_preserves_original_and_cleans_temp(tmp_path):
     assert not list(tmp_path.glob(".calibration.bev_*.json"))
 
 
+def test_failed_calibration_copy_removes_temp_file(tmp_path):
+    video_dir = tmp_path / "videos"
+    video_dir.mkdir()
+    (video_dir / "Camera.mp4").write_text("", encoding="utf-8")
+    calibration_file = tmp_path / "calibration.json"
+    original = write_calibration(calibration_file, ["Camera"])
+
+    manager = make_manager({"CALIBRATION_MODE": "mount"})
+    with patch(
+        "profile_configurator.profile_config_manager.shutil.copy2",
+        side_effect=OSError("disk full"),
+    ):
+        assert not manager._execute_recompute_bev_groups(
+            make_operation(video_dir, calibration_file)
+        )
+
+    assert json.loads(calibration_file.read_text(encoding="utf-8")) == original
+    assert not list(tmp_path.glob(".calibration.bev_*.json"))
+
+
 def test_invalid_recompute_output_preserves_original(tmp_path):
     video_dir = tmp_path / "videos"
     video_dir.mkdir()
```

---

### Incident Patch 8: `59197253` (2026-10-05)
**Commit Message**: feat: add warehouse verification incidents JSON fixture and update .gitattributes

- Introduced a new JSON fixture for warehouse verification incidents to enhance integration tests.
- Updated .gitattributes to ensure the new fixture is available in checkouts without requiring LFS downloads, improving accessibility for testing.

Signed-off-by: kartikayt-nvidia <[REDACTED_EMAIL]>

**File**: `services/analytics/video-analytics-api/.gitattributes` (modified, +2/-0)
```diff
@@ -1 +1,3 @@
 test/integration-test/elasticsearch_data_dump/*.json filter=lfs diff=lfs merge=lfs -text
+# Keep this small unit-test fixture available in checkouts without LFS downloads.
+test/integration-test/elasticsearch_data_dump/warehouse-verification-incidents.json -filter !diff !merge text
```

**File**: `services/analytics/video-analytics-api/test/integration-test/elasticsearch_data_dump/warehouse-verification-incidents.json` (modified, +8/-3)
```diff
@@ -1,3 +1,8 @@
-version https://git-lfs.github.com/spec/v1
-oid sha256:96a7e58a86f6fb0e4cda332729b8669dc46d2a5aa9520a1c2f4bd8d3494a6df9
-size 5756
+{"_index":"mdx-incidents-2026-08-31","_id":"1ccbfbfd0ba687b7a526753943e5021d689eca9f","_source":{"sensorId":"Camera_02","timestamp":"2026-02-14T10:18:00.000Z","end":"2026-02-14T10:18:10.000Z","objectIds":["13926","13904"],"place":{"info":{},"id":"","type":"","name":"building=Warehouse/room=Room-1"},"analyticsModule":{"id":"","description":"","source":"","version":"","info":{}},"category":"Proximity Violation","frameIds":[],"Id":"1ccbfbfd0ba687b7a526753943e5021d689eca9f","type":"mdx-incidents","info":{"isComplete":"true"}}}
+{"_index":"mdx-incidents-2026-08-31","_id":"b4514bae5080d0afe458ec33430d6f396b6ca0ee","_source":{"sensorId":"Camera_01","timestamp":"2026-02-14T10:18:10.000Z","end":"2026-02-14T10:18:20.000Z","objectIds":["fd3aaa50-e287-4eae-9bc3-03db98ee4f5e"],"place":{"info":{},"id":"","type":"","name":"building=Warehouse/room=Room-1"},"analyticsModule":{"description":"RTVI Safety Compliance Detector","source":"rtvi-vlm","version":"nim_nvidia_cosmos3-nano-reasoner_bf16-final","info":{"chunkIdx":"1056","streamType":"live","requestId":"e4ffe6db-c5f7-4baf-9fe8-9fe4935d180a"},"id":"vlm-activity-detector"},"category":"PPE Violation","frameIds":["1056:0","1056:5"],"Id":"b4514bae5080d0afe458ec33430d6f396b6ca0ee","type":"mdx-incidents","info":{}}}
+{"_index":"mdx-incidents-2026-08-31","_id":"b0a6bbaca55910232eab80ccaf9face650c0db9b","_source":{"sensorId":"Camera_03","timestamp":"2026-02-14T10:18:20.000Z","end":"2026-02-14T10:18:30.000Z","objectIds":["1c9d0d6e-2952-4499-b5b7-065096d7aad3"],"place":{"info":{},"id":"","type":"","name":"building=Warehouse/room=Room-1"},"analyticsModule":{"description":"RTVI Safety Compliance Detector","source":"rtvi-vlm","version":"nim_nvidia_cosmos3-nano-reasoner_bf16-final","info":{"chunkIdx":"1056","streamType":"live","requestId":"23f9f001-c5e4-44ed-ab7e-85ae68454633"},"id":"vlm-activity-detector"},"category":"Pathway Obstruction Violation","frameIds":["1056:0","1056:5"],"Id":"b0a6bbaca55910232eab80ccaf9face650c0db9b","type":"mdx-incidents","info":{}}}
+{"_index":"mdx-incidents-2026-08-31","_id":"95250c02189962f1db32e8d4d9960de7dbbe5c85","_source":{"sensorId":"Camera_01","timestamp":"2026-02-14T10:18:30.000Z","end":"2026-02-14T10:18:40.000Z","objectIds":["fd3aaa50-e287-4eae-9bc3-03db98ee4f5e"],"place":{"info":{},"id":"","type":"","name":"building=Warehouse/room=Room-1"},"analyticsModule":{"description":"RTVI Safety Compliance Detector","source":"rtvi-vlm","version":"nim_nvidia_cosmos3-nano-reasoner_bf16-final","info":{"chunkIdx":"1043","streamType":"live","requestId":"6a4eda95-a76e-461e-a43c-849a15bf3465"},"id":"vlm-activity-detector"},"category":"Load Quality Violation","frameIds":["1043:0","1043:5"],"Id":"95250c02189962f1db32e8d4d9960de7dbbe5c85","type":"mdx-incidents","info":{}}}
+{"_index":"mdx-vlm-incidents-2026-08-31","_id":"1ccbfbfd0ba687b7a526753943e5021d689eca9f","_source":{"sensorId":"Camera_02","timestamp":"2026-02-14T10:18:00.000Z","end":"2026-02-14T10:18:10.000Z","objectIds":["13926","13904"],"place":{"info":{},"id":"","type":"","name":"building=Warehouse/room=Room-1"},"analyticsModule":{"id":"","description":"","source":"","version":"","info":{}},"category":"Near Miss Violation","frameIds":[],"Id":"1ccbfbfd0ba687b7a526753943e5021d689eca9f","type":"mdx-vlm-incidents","info":{"isComplete":"true","verdict":"confirmed"}}}
+{"_index":"mdx-vlm-incidents-2026-08-31","_id":"b4514bae5080d0afe458ec33430d6f396b6ca0ee","_source":{"sensorId":"Camera_01","timestamp":"2026-02-14T10:18:10.000Z","end":"2026-02-14T10:18:20.000Z","objectIds":["fd3aaa50-e287-4eae-9bc3-03db98ee4f5e"],"place":{"info":{},"id":"","type":"","name":"building=Warehouse/room=Room-1"},"analyticsModule":{"description":"RTVI Safety Compliance Detector","source":"rtvi-vlm","version":"nim_nvidia_cosmos3-nano-reasoner_bf16-final","info":{"chunkIdx":"1056","streamType":"live","requestId":"e4ffe6db-c5f7-4baf-9fe8-9fe4935d180a"},"id":"vlm-activity-detector"},"category":"PPE Violation","frameIds":["1056:0","1056:5"],"Id":"b4514bae5080d0afe458ec33430d6f396b6ca0ee","type":"mdx-vlm-incidents","info":{"verdict":"confirmed","alertCategory":"PPE Violation"}}}
+{"_index":"mdx-vlm-incidents-2026-08-31","_id":"b0a6bbaca55910232eab80ccaf9face650c0db9b","_source":{"sensorId":"Camera_03","timestamp":"2026-02-14T10:18:20.000Z","end":"2026-02-14T10:18:30.000Z","objectIds":["1c9d0d6e-2952-4499-b5b7-065096d7aad3"],"place":{"info":{},"id":"","type":"","name":"building=Warehouse/room=Room-1"},"analyticsModule":{"description":"RTVI Safety Compliance Detector","source":"rtvi-vlm","version":"nim_nvidia_cosmos3-nano-reasoner_bf16-final","info":{"chunkIdx":"1056","streamType":"live","requestId":"23f9f001-c5e4-44ed-ab7e-85ae68454633"},"id":"vlm-activity-detector"},"category":"Pathway Obstruction Violation","frameIds":["1056:0","1056:5"],"Id":"b0a6bbaca55910232eab80ccaf9face650c0db9b","type":"mdx
```

---

### Incident Patch 9: `342ab143` (2026-10-05)
**Commit Message**: fix: update conditional checks in generate_env.sh for Dockerfile and compose.yml existence

- Changed the conditional checks from single brackets to double brackets for improved syntax in the generate_env.sh script.
- Ensured that the script correctly verifies the existence of the Dockerfile and compose.yml files, enhancing robustness.

Signed-off-by: kartikayt-nvidia <[REDACTED_EMAIL]>

**File**: `services/analytics/video-analytics-api/test/integration-test/generate_env.sh` (modified, +2/-2)
```diff
@@ -28,7 +28,7 @@ SCRIPT_DIR="${SCRIPT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
 INTEGRATION_TEST_DIR="$(cd "$SCRIPT_DIR" && pwd)"
 # VIDEO_ANALYTICS_API_ROOT = directory containing docker/Dockerfile (repo root)
 VIDEO_ANALYTICS_API_ROOT="$(cd "$INTEGRATION_TEST_DIR/.." && pwd)"
-if [ ! -f "$VIDEO_ANALYTICS_API_ROOT/docker/Dockerfile" ]; then
+if [[ ! -f "$VIDEO_ANALYTICS_API_ROOT/docker/Dockerfile" ]]; then
     VIDEO_ANALYTICS_API_ROOT="$(cd "$INTEGRATION_TEST_DIR/../.." && pwd)"
 fi
 DATA_DIR="$INTEGRATION_TEST_DIR/docker_compose/apps_data"
@@ -46,7 +46,7 @@ INFRA_DIR="$REPO_ROOT/deploy/docker/services/infra"
 VSS_APPS_DIR="$REPO_ROOT/deploy/docker"
 VSS_DATA_DIR="$DATA_DIR"
 
-if [ ! -f "$INFRA_DIR/compose.yml" ]; then
+if [[ ! -f "$INFRA_DIR/compose.yml" ]]; then
     echo "✗ Shared infra compose not found at $INFRA_DIR/compose.yml" >&2
     echo "  This suite includes the deployment's own Elasticsearch definition;" >&2
     echo "  it must run from a full repo checkout or source tarball." >&2
```

---

### Incident Patch 10: `d6a8095a` (2026-10-03)
**Commit Message**: fix: retire legacy mdx-vlm Kafka topic (#2506)

* fix: retire legacy mdx-vlm topic

Signed-off-by: Yun He <[REDACTED_EMAIL]>

* fix: remove unused vision-llm-messages topic

Signed-off-by: Yun He <[REDACTED_EMAIL]>

---------

Signed-off-by: Yun He <[REDACTED_EMAIL]>

**File**: `deploy/docker/services/infra/compose.yml` (modified, +0/-2)
```diff
@@ -232,7 +232,6 @@ services:
         {"name": "mdx-events"},
         {"name": "mdx-incidents"},
         {"name": "mdx-vlm-incidents"},
-        {"name": "mdx-vlm"},
         {"name": "mdx-vlm-captions"},
         {"name": "mdx-vlm-errors"},
         {"name": "mdx-structured-events-summary"},
@@ -356,7 +355,6 @@ services:
         {"name": "mdx-events"},
         {"name": "mdx-incidents"},
         {"name": "mdx-vlm-incidents"},
-        {"name": "mdx-vlm"},
         {"name": "mdx-vlm-captions"},
         {"name": "mdx-vlm-errors"},
         {"name": "mdx-structured-events-summary"},
```

**File**: `deploy/docker/services/rtvi/rtvi-vlm/.env` (modified, +1/-1)
```diff
@@ -22,7 +22,7 @@ RTVI_VLM_OTEL_EXPORTER_OTLP_ENDPOINT=
 
 # Enable Kafka messages
 RTVI_VLM_KAFKA_ENABLED=true
-RTVI_VLM_KAFKA_TOPIC=mdx-vlm
+RTVI_VLM_MESSAGE_BUS_TOPIC=mdx-vlm-captions
 RTVI_VLM_KAFKA_INCIDENT_TOPIC=mdx-vlm-incidents
 RTVI_VLM_ERROR_MESSAGE_TOPIC=mdx-vlm-errors
 
```

**File**: `deploy/helm/developer-profiles/dev-profile-alerts/values.yaml` (modified, +0/-2)
```diff
@@ -168,10 +168,8 @@ infra:
       - name: mdx-incidents
       - name: mdx-vlm-incidents
       - name: mdx-vlm-captions
-      - name: mdx-vlm
       - name: mdx-embed
       - name: mdx-embed-filtered
-      - name: vision-llm-messages
       - name: vision-llm-events-incidents
       - name: mdx-vlm-errors
   logstash:
```

**File**: `deploy/helm/developer-profiles/dev-profile-lvs/README.md` (modified, +1/-1)
```diff
@@ -113,7 +113,7 @@ Key values (see `values.yaml` for defaults and the full `rtvi.vss-rtvi-vlm.env`
 | `rtvi.vss-rtvi-vlm.enabled` | `true` | Deploy the RTVI-VLM pod. |
 | `rtvi.vss-rtvi-vlm.useSharedNim` | `false` | Load the integrated checkpoint in the RT-VLM pod. Sets `MODEL_PATH=ngc:nim/nvidia/cosmos3-nano-reasoner:bf16-final` and `VLM_MODEL_TO_USE=cosmos-reason3`. |
 | `rtvi.vss-rtvi-vlm.modelPath` | `ngc:nim/nvidia/cosmos3-nano-reasoner:bf16-final` | Integrated RT-VLM checkpoint path used when `useSharedNim=false`. |
-| `infra.kafka.enabled` | `true` | Deploy Kafka for RTVI-VLM event publishing and create the default VSS topics, including `mdx-vlm` and `mdx-vlm-incidents`. |
+| `infra.kafka.enabled` | `true` | Deploy Kafka for RTVI-VLM event publishing and create the default VSS topics, including `mdx-vlm-captions` and `mdx-vlm-incidents`. |
 | `rtvi.vss-rtvi-vlm.waitForKafka.enabled` | `true` | The RTVI-VLM init container waits for Kafka and required RTVI topics before startup. |
 | `rtvi.vss-rtvi-vlm.env` | full list | Replaces the subchart default `env`. Override individual values (e.g. edge `VLM_INPUT_*`) by editing the list in your overlay. |
 | `vss-summarization.extraEnv` | 2 RTVI vars | `RTVI_VLM_URL`, `RTVI_VLM_URL_PASSTHROUGH`. `RTVI_VLM_URL` is rendered with `tpl`, so it picks up `{{ .Release.Name }}` when `global.useReleaseNamePrefix` is true. |
```

**File**: `deploy/helm/developer-profiles/dev-profile-lvs/values.yaml` (modified, +1/-2)
```diff
@@ -183,7 +183,6 @@ infra:
       - name: mdx-events
       - name: mdx-incidents
       - name: mdx-vlm-incidents
-      - name: mdx-vlm
       - name: mdx-embed
       - name: mdx-embed-filtered
       - name: mdx-vlm-captions
@@ -554,7 +553,7 @@ vssIngress:
 
 # RTVI umbrella: LVS always-on rtvi-vlm. By default, rtvi-vlm loads the integrated
 # Cosmos checkpoint in-pod. LVS deploys Kafka so
-# RTVI can publish mdx-vlm events while the LVS backend and vss-agent call RTVI over HTTP.
+# RTVI can publish mdx-vlm-captions events while the LVS backend and vss-agent call RTVI over HTTP.
 rtvi:
   enabled: true
   vss-rtvi-cv:
```

**File**: `deploy/helm/services/infra/charts/kafka/values.yaml` (modified, +0/-1)
```diff
@@ -46,7 +46,6 @@ topics:
   - name: mdx-events
   - name: mdx-incidents
   - name: mdx-vlm-incidents
-  - name: mdx-vlm
   - name: mdx-vlm-captions
   - name: mdx-vlm-errors
   - name: mdx-structured-events-summary
```

**File**: `deploy/helm/services/rtvi/charts/rtvi-vlm/templates/deployment.yaml` (modified, +1/-1)
```diff
@@ -23,7 +23,7 @@
 {{- $wfkImg := $wfk.image | default dict }}
 {{- $wfkRepo := $wfkImg.repository | default "docker.io/confluentinc/cp-kafka" }}
 {{- $wfkTag := $wfkImg.tag | default "8.3.0" }}
-{{- $wfkTopics := $wfk.topics | default (list "mdx-vlm" "mdx-vlm-incidents") }}
+{{- $wfkTopics := $wfk.topics | default (list "mdx-vlm-captions" "mdx-vlm-incidents") }}
 {{- $resources := deepCopy (.Values.resources | default dict) }}
 {{- $gpuResourceName := trim (.Values.gpuResourceName | default "") }}
 {{- $pluginSelectsDevices := or (.Values.pluginSelectsDevices | default false) (ne $gpuResourceName "") }}
```

**File**: `deploy/helm/services/rtvi/charts/rtvi-vlm/values.yaml` (modified, +1/-1)
```diff
@@ -64,7 +64,7 @@ waitForKafka:
   imagePullPolicy: IfNotPresent
   timeoutSeconds: 1200
   topics:
-    - mdx-vlm
+    - mdx-vlm-captions
     - mdx-vlm-incidents
 redisHost: ""
 redisPort: "6379"
```

---

### Incident Patch 11: `d44655f5` (2026-10-03)
**Commit Message**: docs: enhance calibration guidance for 2D profile and introduce VSS C… (#2490)

* docs: enhance calibration guidance for 2D profile and introduce VSS Configurator documentation

- Added detailed descriptions of two calibration types (Image and Cartesian coordinates) in the 2D profile documentation.
- Updated instructions for generating calibration and handling ROIs and tripwires.
- Introduced a new document for the VSS Configurator, outlining its role in managing hardware profile settings and sensor configuration for the Warehouse Operations Blueprint.
- Expanded the microservices configuration documentation to include comprehensive configuration guides for various components used in the Warehouse Operations Blueprint.

Signed-off-by: kartikayt-nvidia <[REDACTED_EMAIL]>

* docs: update VSS Configurator documentation to include BEV recomputation details

- Enhanced the description of file mutation operations to include profile-time BEV group recomputation for mounted calibration.
- Clarified the role of new input variables related to BEV recomputation and calibration file paths.
- Updated the profile manager's operation types to reflect the addition of the recompute_bev_groups opera

**File**: `deploy/helm/industry-profiles/warehouse-operations/warehouse-2d-app/README.md` (modified, +7/-24)
```diff
@@ -88,32 +88,16 @@ hardware-accelerated video encode/decode in the stream processor.
 Enabling the in-cluster RT-VLM for [Alerts](#alerts) requests one additional
 GPU: **3 GPUs total** with hardware video processing.
 
-To run `vss-vios-streamprocessing` in software encode/decode mode (FFmpeg CPU path)
-and free that GPU for other workloads, set **`vios.vss-vios-streamprocessing.resources`**
-to an empty map in your values override:
+Keep hardware video processing enabled and allocate a GPU to VIOS streamprocessing.
 
-```yaml
-vios:
-  vss-vios-streamprocessing:
-    useSoftwarePath: true
-    resources: null
-```
-
-Or inline at install time:
-
-```bash
---set vios.vss-vios-streamprocessing.useSoftwarePath=true \
---set 'vios.vss-vios-streamprocessing.resources=null'
-```
+### GPU sharing
 
-Both flags are required together — **`useSoftwarePath`** switches the VST encode/decode
-path in the config, and **`resources: null`** drops the GPU claim from the pod spec.
-Setting only one leaves the stack misconfigured.
+If there are not enough physical GPUs to assign one to each GPU workload, consider GPU sharing:
 
-`resources: {}` does **not** work — Helm deep-merges maps, so the subchart default
-keys survive an empty-map override. Use `null` to drop the block entirely.
+- [Multi-Instance GPU (MIG)](https://docs.nvidia.com/datacenter/cloud-native/gpu-operator/latest/gpu-operator-mig.html) partitions supported GPUs into instances with dedicated memory and fault isolation.
+- [GPU time-slicing](https://docs.nvidia.com/datacenter/cloud-native/gpu-operator/latest/gpu-sharing.html) lets multiple workloads share a GPU without memory or fault isolation.
 
-Software mode reduces video throughput; use it only when a second GPU is not available.
+Choose based on your GPU hardware, workload compatibility, memory needs, and isolation requirements. See the [MIG and time-slicing comparison](https://docs.nvidia.com/datacenter/cloud-native/gpu-operator/latest/gpu-sharing.html#comparison-time-slicing-and-multi-instance-gpu). Keep hardware video processing enabled for VIOS and verify that the selected GPU or MIG profile supports the required video encode/decode capabilities.
 
 ### Required secrets
 
@@ -195,8 +179,7 @@ Order follows `values.yaml`. Set only the keys you need in your override file; H
 | **`vios.vstStorage.vstData.size`** | **`10Gi`** | PVC size for shared VST data volume. |
 | **`vios.vstStorage.vstVideo.size`** | **`20Gi`** | PVC size for shared VST video volume. |
 | **`vios.vstStorage.streamerVideos.size`** | **`20Gi`** | PVC size for the NVStreamer upload volume. |
-| **`vios.vss-vios-streamprocessing.useSoftwarePath`** | **`false`** | Set **`true`** (paired with **`resources: null`**) to use FFmpeg software encode/decode and free the second GPU. Both flags required — see [GPU requirements](#gpu-requirements). |
-| **`vios.vss-vios-streamprocessing.resources`** | `nvidia.com/gpu: 1` | Pod resource requests/limits for streamprocessing. Set **`null`** (with **`useSoftwarePath: true`**) to drop the GPU claim entirely. |
+| **`vios.vss-vios-streamprocessing.resources`** | `nvidia.com/gpu: 1` | Keep one GPU allocation for streamprocessing. See [GPU requirements](#gpu-requirements) for dedicated and shared GPU guidance. |
 | **`vios.vss-vios-nvstreamer.syncFileCount`** | **`4`** | Number of sample video files NVStreamer syncs. Keep in step with `bp-configurator` `NUM_STREAMS`. |
 | **`vios.vss-vios-nvstreamer.ngcVideoSeed.resourceVersion`** | **`nvstaging/vss-warehouse/vss-warehouse-app-data:v3.3.0-09152026`** | NGC resource for the NVStreamer sample video seed. Keep in step with **`rtvi.vss-rtvi-cv.ngcAppDataResourceVersion`**. |
 | **`vios.vss-vios-nvstreamer.ngcVideoSeed.fromExistingClaim`** | **`vss-rtvi-cv-models`** | Reuses the PVC from the `vss-rtvi-cv` NGC download job so the video data is not downloaded twice. Clear this and set **`resourceVersion`** to download the video seed independently. |
```

**File**: `deploy/helm/industry-profiles/warehouse-operations/warehouse-3d-app/README.md` (modified, +7/-24)
```diff
@@ -85,32 +85,16 @@ hardware-accelerated video encode/decode in the stream processor.
 | `vss-vios-streamprocessing` | 1 | HW encode/decode; see below |
 | **Total** | **2** | |
 
-To run `vss-vios-streamprocessing` in software encode/decode mode (FFmpeg CPU path)
-and free that GPU for other workloads, set **`vios.vss-vios-streamprocessing.resources`**
-to an empty map in your values override:
-
-```yaml
-vios:
-  vss-vios-streamprocessing:
-    useSoftwarePath: true
-    resources: null
-```
-
-Or inline at install time:
+Keep hardware video processing enabled and allocate a GPU to VIOS streamprocessing.
 
-```bash
---set vios.vss-vios-streamprocessing.useSoftwarePath=true \
---set 'vios.vss-vios-streamprocessing.resources=null'
-```
+### GPU sharing
 
-Both flags are required together — **`useSoftwarePath`** switches the VST encode/decode
-path in the config, and **`resources: null`** drops the GPU claim from the pod spec.
-Setting only one leaves the stack misconfigured.
+If there are not enough physical GPUs to assign one to each GPU workload, consider GPU sharing:
 
-`resources: {}` does **not** work — Helm deep-merges maps, so the subchart default
-keys survive an empty-map override. Use `null` to drop the block entirely.
+- [Multi-Instance GPU (MIG)](https://docs.nvidia.com/datacenter/cloud-native/gpu-operator/latest/gpu-operator-mig.html) partitions supported GPUs into instances with dedicated memory and fault isolation.
+- [GPU time-slicing](https://docs.nvidia.com/datacenter/cloud-native/gpu-operator/latest/gpu-sharing.html) lets multiple workloads share a GPU without memory or fault isolation.
 
-Software mode reduces video throughput; use it only when a second GPU is not available.
+Choose based on your GPU hardware, workload compatibility, memory needs, and isolation requirements. See the [MIG and time-slicing comparison](https://docs.nvidia.com/datacenter/cloud-native/gpu-operator/latest/gpu-sharing.html#comparison-time-slicing-and-multi-instance-gpu). Keep hardware video processing enabled for VIOS and verify that the selected GPU or MIG profile supports the required video encode/decode capabilities.
 
 ### Required secrets
 
@@ -192,8 +176,7 @@ Order follows `values.yaml`. Set only the keys you need in your override file; H
 | **`vios.vstStorage.vstData.size`** | **`10Gi`** | PVC size for shared VST data volume. |
 | **`vios.vstStorage.vstVideo.size`** | **`20Gi`** | PVC size for shared VST video volume. |
 | **`vios.vstStorage.streamerVideos.size`** | **`20Gi`** | PVC size for the NVStreamer upload volume. |
-| **`vios.vss-vios-streamprocessing.useSoftwarePath`** | **`false`** | Set **`true`** (paired with **`resources: null`**) to use FFmpeg software encode/decode and free the second GPU. Both flags required — see [GPU requirements](#gpu-requirements). |
-| **`vios.vss-vios-streamprocessing.resources`** | `nvidia.com/gpu: 1` | Pod resource requests/limits for streamprocessing. Set **`null`** (with **`useSoftwarePath: true`**) to drop the GPU claim entirely. |
+| **`vios.vss-vios-streamprocessing.resources`** | `nvidia.com/gpu: 1` | Keep one GPU allocation for streamprocessing. See [GPU requirements](#gpu-requirements) for dedicated and shared GPU guidance. |
 | **`vios.vss-vios-nvstreamer.syncFileCount`** | **`4`** | Number of sample video files NVStreamer syncs. Keep in step with `bp-configurator` `NUM_STREAMS`. |
 | **`vios.vss-vios-nvstreamer.ngcVideoSeed.resourceVersion`** | **`nvstaging/vss-warehouse/vss-warehouse-app-data:v3.3.0-09152026`** | NGC resource for the NVStreamer sample video seed. Keep in step with **`rtvi.vss-rtvi-cv.ngcAppDataResourceVersion`**. |
 | **`vios.vss-vios-nvstreamer.ngcVideoSeed.fromExistingClaim`** | **`vss-rtvi-cv-models`** | Reuses the PVC from the `vss-rtvi-cv` NGC download job so the video data is not downloaded twice. Clear this and set **`resourceVersion`** to download the video seed independently. |
```

**File**: `docs/elk.mdx` (modified, +8/-0)
```diff
@@ -156,6 +156,14 @@ when dense vectors are being indexed, use `nvtop` or `nvidia-smi`.
 | `mdx-usd-assets` | Stores USD (Universal Scene Description) assets configuration. |
 | `mdx-road-network` | Stores road network configuration data. |
 | `mdx-sensor-lookup` | Stores sensor lookup information for coordinate mapping. |
+| `default_<normalized-stream-id>` or a custom collection name | Stores video captions and summaries received from `mdx-vlm-captions` and `mdx-structured-events-summary`. See the naming examples below. |
+| `ab-alert_configs` | Stores Alert Bridge alert configurations when Elasticsearch persistence is enabled. |
+| `ab-confirmed-verdicts` | Stores confirmed Alert Bridge verdicts used for deduplication. |
+
+Caption and summary indices use a collection name rather than the Kafka topic name or a daily suffix:
+
+- If the message includes `info.collection_name`, Logstash uses that value as the index name. For example, `collection_name: "warehouse-summary"` writes to `warehouse-summary`.
+- Otherwise, Logstash prefixes the stream ID with `default_`, replacing hyphens, slashes, backslashes, and spaces with underscores. For example, `streamId: "camera-01"` writes to `default_camera_01`.
 
 <Note>
 You can use the Elasticsearch Python library to query the indices. Refer to the [Elasticsearch Python client](https://elasticsearch-py.readthedocs.io/en/v9.2.0/) for the library reference and sample code.
```

**File**: `docs/kafka.mdx` (modified, +2/-0)
```diff
@@ -28,7 +28,9 @@ Additional information regarding Kafka can be found in the [Quickstart Guide](ht
 | `mdx-vlm-alerts` | Protobuf | `nv.Behavior` | Used for sending Vision Language Model (VLM) verified alerts. |
 | `mdx-incidents` | Protobuf | `nv.Incident` | Used for sending incident data from the analytics pipeline. |
 | `mdx-vlm-incidents` | Protobuf | `nv.Incident` | Used for sending Vision Language Model (VLM) verified incident data. |
+| `mdx-vlm-errors` | JSON | N/A | Used by RTVI-VLM to publish error events when Kafka error reporting is enabled. |
 | `mdx-embed` | Protobuf | `nv.VisionLLM` | Used for sending embedding data for vector similarity searches. |
+| `mdx-embed-errors` | JSON | N/A | Used by RTVI-Embed to publish error events when Kafka error reporting is enabled. |
 | `mdx-embed-filtered` | Protobuf | `nv.VisionLLM` | Used for sending filtered vision embeddings to Logstash for vector similarity searches. |
 | `mdx-compressed-embeddings` | Protobuf | `nv.Frame` | Used for sending frame metadata with compressed per-object embeddings. |
 | `mdx-vlm-captions` | Protobuf | `nv.VisionLLM` | Used by the RTVI-VLM microservice to publish per-chunk raw captioning events from live streams and file summarization. Consumed by Logstash, which writes the events into Elasticsearch for downstream summarization. |
```

**File**: `docs/vios-microservices.mdx` (modified, +15/-0)
```diff
@@ -301,11 +301,26 @@ Some options:
 
  ![VIOS Overlay Live Video](/assets/images/vios/VIOS-Overlay-Live.png)
 
+##### Display Object IDs in Warehouse Profiles
+
+Enable the video player's analytics overlay, then open **Analytics Overlay Settings**. Object ID display depends on the warehouse profile:
+
+| Warehouse Profile | Object ID Display Settings |
+| --- | --- |
+| 2D and 2D with Agents | Enable **Show Bounding Boxes** and **Show Object ID** under **Object ID Display**. Debug Mode is optional and adds diagnostic overlays. |
+| 3D and MV3DT | Object IDs are displayed by default when **Debug Mode** is enabled. |
+
+Click **Save Settings** to apply the changes. In the 2D settings, leave **Specific Object IDs** empty to show all objects, or enter a comma-separated list to filter the displayed objects.
+
+![VST Analytics Overlay Settings with Show Bounding Boxes and Show Object ID enabled for a warehouse 2D profile](/assets/images/analytics-blueprints/2d-vst-object-id-overlay-settings.png)
+
 ##### Playback overlay on Video Wall
 
 Now that you are able to enable Overlay Feature of VIOS in Live and Recorded Streams, it is time to extend the Overlay Feature of VIOS in Video Wall.
 To enable bounding boxes on the video, navigate to **Video Wall** tab and select streams from the dropdown list and enable overlay option from the video player and enable it.
 
+For warehouse object ID display settings, see [Display Object IDs in Warehouse Profiles](#display-object-ids-in-warehouse-profiles).
+
 Some options:
 
   * **Analytics Overlay Settings** tab is used to enable / disable Bounding Boxes, Debug Mode, Include Floor Plan and setting the thickness of the bounding boxes.
```

**File**: `docs/vss-configurator.mdx` (modified, +4/-0)
```diff
@@ -2269,3 +2269,7 @@ readinessProbe:
   initialDelaySeconds: 10
   periodSeconds: 10
 ```
+
+## Sample Use Case
+
+For an example of how the VSS Configurator is used in the **Warehouse Operations Blueprint**, see [VSS Configurator for the Warehouse Blueprint](/vss/vision-agent/agent-workflows/industry-specific-examples/warehouse-operations-blueprint/microservice-configuration/vss-configurator). The guide covers profile and sensor configuration flow, configuration inputs, file changes, and hardware-specific overrides.
```

**File**: `docs/warehouse-docs/2D-profile-with-agents.mdx` (modified, +144/-1)
```diff
@@ -141,6 +141,18 @@ Please note: At this point the web-based application is only available for Chrom
 
 ![VIOS UI](/assets/images/analytics-blueprints/2D-analytics-blueprint-vios.png)
 
+#### Show Object IDs
+
+To display object IDs in VST for the 2D profile, open **Analytics Overlay Settings** and:
+
+1. Enable **Show Bounding Boxes** under **Bounding Box Configuration**.
+2. Enable **Show Object ID** under **Object ID Display**.
+3. Click **Save Settings**.
+
+**Debug Mode** is optional and adds diagnostic overlays; it is not required to display object IDs.
+
+![VST Analytics Overlay Settings with Show Bounding Boxes and Show Object ID enabled for the 2D profile](/assets/images/analytics-blueprints/2d-vst-object-id-overlay-settings.png)
+
 ### Reference Agentic UI
 
 The browser-based interface supports Chat, Alerts, and Dashboard modes.
@@ -335,6 +347,135 @@ Refer to [RT-DETR Real-Time Performance](/vss/system-components/models/rt-detr-2
 
 #### Step 3: Deploy and generate new calibration
 
+The 2D with Agents profile supports two calibration types:
+
+Choose one calibration workflow:
+
+- **Image coordinates** (`"calibrationType": "image"`): Prepare the file manually using camera pixel coordinates. Follow **Image coordinate calibration** below.
+- **Cartesian coordinates** (`"calibrationType": "cartesian"`): Generate image-to-global calibration using Auto Calibration's AMC method. Follow **Cartesian coordinate calibration** below.
+
+##### Image coordinate calibration
+
+Image-coordinate calibration does not require an image-to-global coordinate transformation, so camera intrinsics, extrinsics, and homography are not needed.
+
+ROIs and tripwires are optional and only needed for analytics that use them. Auto Calibration currently does not support defining them in image coordinates. When required, manually measure their camera pixel coordinates using an image editing tool and enter them in the calibration file, following the workflow below.
+
+**1. Start with the empty calibration template**
+
+This template contains a placeholder sensor named `Camera_01`. Fill the blank fields and replace the placeholder values before using it:
+
+```text
+{
+  "version": "1.0",
+  "osmURL": "",
+  "calibrationType": "",
+  "sensors": [
+    {
+      "type": "",
+      "id": "Camera_01",
+      "origin": {
+        "lng": 0,
+        "lat": 0
+      },
+      "geoLocation": {
+        "lng": 0,
+        "lat": 0
+      },
+      "coordinates": {
+        "x": 0,
+        "y": 0
+      },
+      "scaleFactor": 0,
+      "attributes": [],
+      "place": [],
+      "imageCoordinates": [],
+      "globalCoordinates": [],
+      "tripwires": [],
+      "rois": []
+    },
+    ...
+  ]
+}
+```
+
+**2. Measure pixel coordinates and fill the template**
+
+Open a frame from your camera at its original resolution in an image editing tool, such as Paint or IrfanView. Read the pixel coordinates for the ROIs and tripwires your analytics require, then update the template:
+
+- Set `calibrationType` to `image` and the sensor `type` to `camera`.
+- Replace `Camera_01` with the matching camera name in `camera_info.json` or your video name.
+- Set `scaleFactor` to `1` for the image-mode example and add the frame width and height to `attributes`.
+- Enter ROI vertices and tripwire endpoints in pixel coordinates. Leave `rois` and `tripwires` empty if your analytics do not require them.
+- Leave `imageCoordinates` and `globalCoordinates` empty.
+
+**3. Review the completed calibration**
+
+After filling in the values, an image-mode calibration for a 1920 × 1080 camera frame could look like this. The ROI and tripwire coordinates below are examples; replace them with the pixel coordinates measured from your own camera frame:
+
+```json
+{
+  "version": "1.0",
+  "osmURL": "",
+  "calibrationType": "image",
+  "sensors": [
+    {
+      "type": "camera",
+      "id": "Camera_01",
+      "origin": {"lng": 0, "lat": 0},
+      "geoLocation": {"lng": 0, "lat": 0},
+      "coordinates": {"x": 0, "y": 0},
+      "scaleFactor": 1,
+      "attributes": [
+        {"name": "source", "value": "vst"},
+        {"name": "frameWidth", "value": "1920"},
+        {"name": "frameHeight", "value": "1080"}
+      ],
+      "place": [],
+      "imageCoordinates": [],
+      "globalCoordinates": [],
+      "tripwires": [
+        {
+          "id": "tripwire-id-1",
+          "wire": {
+            "p1": {"x": 943, "y": 606},
+            "p2": {"x": 1403, "y": 309}
+          },
+          "direction": {
+            "p1": {"x": 1040, "y": 395},
+            "p2": {"x": 1282, "y": 566}
+          }
+        }
+      ],
+      "rois": [
+        {
+          "id": "roi-id-1",
+          "roiCoordinates": [
+            {"x": 400, "y": 300},
+            {"x": 400, "y": 800},
+            {"x": 1200, "y": 800},
+            {"x": 1200, "y": 300}
+          ],
+          "restrictedObjectTypes": [
+            "Person"
+          ],
+          "confinedObjectTyp
```

**File**: `docs/warehouse-docs/2D-profile.mdx` (modified, +144/-1)
```diff
@@ -104,6 +104,18 @@ Please note: At this point the web-based application is only available for Chrom
 
 ![VIOS UI](/assets/images/analytics-blueprints/2D-analytics-blueprint-vios.png)
 
+#### Show Object IDs
+
+To display object IDs in VST for the 2D profile, open **Analytics Overlay Settings** and:
+
+1. Enable **Show Bounding Boxes** under **Bounding Box Configuration**.
+2. Enable **Show Object ID** under **Object ID Display**.
+3. Click **Save Settings**.
+
+**Debug Mode** is optional and adds diagnostic overlays; it is not required to display object IDs.
+
+![VST Analytics Overlay Settings with Show Bounding Boxes and Show Object ID enabled for the 2D profile](/assets/images/analytics-blueprints/2d-vst-object-id-overlay-settings.png)
+
 ## Events and Incidents
 
 ### Events
@@ -308,6 +320,135 @@ Refer to [RT-DETR Real-Time Performance](/vss/system-components/models/rt-detr-2
 
 #### Step 3: Deploy and generate new calibration
 
+The 2D profile supports two calibration types:
+
+Choose one calibration workflow:
+
+- **Image coordinates** (`"calibrationType": "image"`): Prepare the file manually using camera pixel coordinates. Follow **Image coordinate calibration** below.
+- **Cartesian coordinates** (`"calibrationType": "cartesian"`): Generate image-to-global calibration using Auto Calibration's AMC method. Follow **Cartesian coordinate calibration** below.
+
+##### Image coordinate calibration
+
+Image-coordinate calibration does not require an image-to-global coordinate transformation, so camera intrinsics, extrinsics, and homography are not needed.
+
+ROIs and tripwires are optional and only needed for analytics that use them. Auto Calibration currently does not support defining them in image coordinates. When required, manually measure their camera pixel coordinates using an image editing tool and enter them in the calibration file, following the workflow below.
+
+**1. Start with the empty calibration template**
+
+This template contains a placeholder sensor named `Camera_01`. Fill the blank fields and replace the placeholder values before using it:
+
+```text
+{
+  "version": "1.0",
+  "osmURL": "",
+  "calibrationType": "",
+  "sensors": [
+    {
+      "type": "",
+      "id": "Camera_01",
+      "origin": {
+        "lng": 0,
+        "lat": 0
+      },
+      "geoLocation": {
+        "lng": 0,
+        "lat": 0
+      },
+      "coordinates": {
+        "x": 0,
+        "y": 0
+      },
+      "scaleFactor": 0,
+      "attributes": [],
+      "place": [],
+      "imageCoordinates": [],
+      "globalCoordinates": [],
+      "tripwires": [],
+      "rois": []
+    },
+    ...
+  ]
+}
+```
+
+**2. Measure pixel coordinates and fill the template**
+
+Open a frame from your camera at its original resolution in an image editing tool, such as Paint or IrfanView. Read the pixel coordinates for the ROIs and tripwires your analytics require, then update the template:
+
+- Set `calibrationType` to `image` and the sensor `type` to `camera`.
+- Replace `Camera_01` with the matching camera name in `camera_info.json` or your video name.
+- Set `scaleFactor` to `1` for the image-mode example and add the frame width and height to `attributes`.
+- Enter ROI vertices and tripwire endpoints in pixel coordinates. Leave `rois` and `tripwires` empty if your analytics do not require them.
+- Leave `imageCoordinates` and `globalCoordinates` empty.
+
+**3. Review the completed calibration**
+
+After filling in the values, an image-mode calibration for a 1920 × 1080 camera frame could look like this. The ROI and tripwire coordinates below are examples; replace them with the pixel coordinates measured from your own camera frame:
+
+```json
+{
+  "version": "1.0",
+  "osmURL": "",
+  "calibrationType": "image",
+  "sensors": [
+    {
+      "type": "camera",
+      "id": "Camera_01",
+      "origin": {"lng": 0, "lat": 0},
+      "geoLocation": {"lng": 0, "lat": 0},
+      "coordinates": {"x": 0, "y": 0},
+      "scaleFactor": 1,
+      "attributes": [
+        {"name": "source", "value": "vst"},
+        {"name": "frameWidth", "value": "1920"},
+        {"name": "frameHeight", "value": "1080"}
+      ],
+      "place": [],
+      "imageCoordinates": [],
+      "globalCoordinates": [],
+      "tripwires": [
+        {
+          "id": "tripwire-id-1",
+          "wire": {
+            "p1": {"x": 943, "y": 606},
+            "p2": {"x": 1403, "y": 309}
+          },
+          "direction": {
+            "p1": {"x": 1040, "y": 395},
+            "p2": {"x": 1282, "y": 566}
+          }
+        }
+      ],
+      "rois": [
+        {
+          "id": "roi-id-1",
+          "roiCoordinates": [
+            {"x": 400, "y": 300},
+            {"x": 400, "y": 800},
+            {"x": 1200, "y": 800},
+            {"x": 1200, "y": 300}
+          ],
+          "restrictedObjectTypes": [
+            "Person"
+          ],
+          "confinedObjectTypes": [
+            "Forklift"
+          ]
+        }
+      ]
+    }
+  
```

---

### Incident Patch 12: `e12b9fc1` (2026-10-02)
**Commit Message**: docs(skills): drop maintenance-files paragraph from vss-build-vision-ai (#2386)

Co-authored-by: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>
Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>
Co-authored-by: nvskills-svc-account <[REDACTED_EMAIL]>
Signed-off-by: Zac Wang <[REDACTED_EMAIL]>
Signed-off-by: nvskills-svc-account <[REDACTED_EMAIL]>

**File**: `skills/vss-build-vision-ai/BENCHMARK.md` (added, +141/-0)
```diff
@@ -0,0 +1,141 @@
+# Skill Benchmark: vss-build-vision-ai
+
+> ✅ **Overall verdict: PASS — Recommended for publication**
+
+## Publication Recommendation
+
+Recommended for publication based on the completed evaluation evidence in this report.
+
+## Evaluation Metadata
+
+- Skill: `vss-build-vision-ai`
+- Evaluation date: 2026-10-02
+- Evaluator version: `1.5.6`
+- Agents: Claude Code (`aws/anthropic/bedrock-claude-opus-4-8`), Codex (`openai/openai/gpt-5.5`)
+- Tasks: 11 evaluation tasks (10 positive, 1 negative)
+- Dataset digest: `sha256:726fa1cf2863b647abfdc7459b34909f535f7558068c245123a9a1ce9f1bf28e` (skill-evaluator-dataset-snapshot/1)
+- Attempts per task: 1
+- Environment: `k8s-sandbox`
+- Tier 2 evidence: required for publication
+- Tier 3 evidence: required for publication
+
+Each task attempt ran in its own isolated sandbox pod.
+
+## What This Report Answers
+
+The three-tier evaluation checks whether the skill:
+
+- is safe to use;
+- produces correct answers;
+- is discovered and activated when needed;
+- helps the agent complete the user's goal and expected workflow; and
+- avoids wasted skill and tool usage.
+
+## Results at a Glance
+
+| Measure | Claude Code (Baseline → Skill Uplift) | Codex (Baseline → Skill Uplift) |
+|---|---:|---:|
+| Overall | 67.8% — baseline ran, but no comparable score was available; uplift unavailable | 61.5% — baseline ran, but no comparable score was available; uplift unavailable |
+| Security | 77.3% → 68.2% (-9.1 points) | 36.4% → 54.6% (+18.2 points) |
+| Correctness | 21.8% → 69.1% (+47.3 points) | 60.0% → 70.9% (+10.9 points) |
+| Discoverability | 99.1% — baseline ran, but no comparable score was available; uplift unavailable | 78.5% — baseline ran, but no comparable score was available; uplift unavailable |
+| Effectiveness | 10.3% → 22.2% (+11.9 points) | 21.4% → 29.1% (+7.7 points) |
+| Efficiency | 80.4% — baseline ran, but no comparable score was available; uplift unavailable | 74.4% — baseline ran, but no comparable score was available; uplift unavailable |
+
+**How to read this table:** baseline is the same task attempted without the target skill. Scores are rounded to one decimal; threshold-adjacent values use additional precision so their displayed band matches the verdict. Uplift is derived from those displayed scores and shown in percentage points.
+
+Example: `47.0% → 92.0% (+45.0 points)` means the skill-assisted run scored 92.0%, 45.0 percentage points above its 47.0% no-skill baseline.
+
+A partial dimension was calculated from only the available configured signals; review the detailed report before relying on it.
+
+## Token Usage
+
+Actual Tier 3 execution usage is reported for every observed agent/case pair and both conditions.
+
+| Agent | Dataset case | With skill | Without skill | Delta | Change | Coverage |
+|---|---|---:|---:|---:|---:|---|
+| claude-code | All cases | 8,083,494 | 7,300,078 | +783,416 | +10.73% | skill 11/11; base 11/11 |
+| claude-code | build-alerts-gb300 | 281,029 | 216,231 | +64,798 | +29.97% | skill 1/1; base 1/1 |
+| claude-code | build-base-default-tag | 708,157 | 184,749 | +523,408 | +283.31% | skill 1/1; base 1/1 |
+| claude-code | build-base-gb300 | 782,252 | 299,995 | +482,257 | +160.76% | skill 1/1; base 1/1 |
+| claude-code | build-base-gb300-release-tag | 868,509 | 293,412 | +575,097 | +196.00% | skill 1/1; base 1/1 |
+| claude-code | build-base-harness-default-ref | 516,926 | 149,554 | +367,372 | +245.65% | skill 1/1; base 1/1 |
+| claude-code | build-base-harness-ref | 677,869 | 157,611 | +520,258 | +330.09% | skill 1/1; base 1/1 |
+| claude-code | build-base-release-tag | 708,030 | 292,874 | +415,156 | +141.75% | skill 1/1; base 1/1 |
+| claude-code | build-lvs-gb300 | 609,666 | 3,911,872 | -3,302,206 | -84.41% | skill 1/1; base 1/1 |
+| claude-code | build-search-gb300 | 1,593,435 | 153,350 | +1,440,085 | +939.08% | skill 1/1; base 1/1 |
+| claude-code | build-search-profile | 1,026,232 | 1,425,672 | -399,440 | -28.02% | skill 1/1; base 1/1 |
+| claude-code | search-running-archive | 311,389 | 214,758 | +96,631 | +45.00% | skill 1/1; base 1/1 |
+| codex | All cases | 8,377,138 | 9,814,179 | -1,437,041 | -14.64% | skill 11/11; base 11/11 |
+| codex | build-alerts-gb300 | 313,421 | 1,807,057 | -1,493,636 | -82.66% | skill 1/1; base 1/1 |
+| codex | build-base-default-tag | 564,319 | 1,089,830 | -525,511 | -48.22% | skill 1/1; base 1/1 |
+| codex | build-base-gb300 | 315,325 | 665,672 | -350,347 | -52.63% | skill 1/1; base 1/1 |
+| codex | build-base-gb300-release-tag | 298,409 | 1,366,973 | -1,068,564 | -78.17% | skill 1/1; base 1/1 |
+| codex | build-base-harness-default-ref | 140,384 | 161,159 | -20,775 | -12.89% | skill 1/1; base 1/1 |
+| codex | build-base-harness-ref | 1,458,600 | 1,495,484 | -36,884 | -2.47% | skill 1/1; base 1/1 |
+| codex | build-base-release-tag | 1,426,863 | 1,091,714 | +335,149 | +30.70% | skill 1/1; base 1/1 |
+| codex | build-lvs-gb300 | 1,231,393 | 495,356 | +736,037 | +1
```

**File**: `skills/vss-build-vision-ai/SKILL.md` (modified, +0/-4)
```diff
@@ -66,10 +66,6 @@ without requiring credentials, probing services, or changing files:
 | `scripts/stage_vss_src.py` | Snapshots a checkout into `.openclaw/` / `.hermes/` so the sandbox image is built from it instead of `develop`. Run only for a [harness source ref](#harness-source-ref), from that ref's worktree; never for a default build. |
 | `scripts/sync_skills.py` | Harness runtime utility used by `.openclaw/` and `.hermes/` to activate operation Skills; not part of the build workflow. |
 
-`scripts/tests/` contains CI-only contracts, `evals/` contains Skill evaluation
-specifications, and `config/skillspector-baseline.yml` is scanner-maintenance
-configuration. Agents must not load or execute those files as workflow steps.
-
 ## Routing
 
 | Request | Route |
```

**File**: `skills/vss-build-vision-ai/config/skillspector-baseline.yml` (modified, +245/-5)
```diff
@@ -1,20 +1,260 @@
 version: 2
 
+# SkillSpector suppression baseline for skills/vss-build-vision-ai.
+# Entries are scoped to one file and one matched-text pattern; line numbers are
+# not used, so doc edits do not invalidate them. Message globs match the text
+# the scanner records, which it truncates (e.g. `| sh`, `... | python`).
+# Sections:
+#   A. Reviewed scanner false positives. Temporary: remove each entry once the
+#      SkillSpector fix ships.
+#   B. Accurate findings for intended deployment steps, accepted with a reason.
+#   C. Accurate findings for risky steps the skill keeps for now. Prefer the
+#      alternative in the reason; remove the entry if the instruction changes.
+
 rules:
+  # --- A. Reviewed scanner false positives (temporary) ----------------------
   - id: "PE3"
     path: "SKILL.md"
     message: "*[.]env*"
+    reason: &pe3_env_docs >-
+      Reviewed false positive (temporary until the SkillSpector PE3 fix ships).
+      The .env files are the VSS Blueprint's own Compose env layers, passed to
+      `docker compose --env-file` or named as paths. The skill reads only
+      non-secret keys from them (FOUNDATION, VSS_CONTAINER_TAG, MODE) and never
+      prints or transmits their contents.
+
+  - id: "PE3"
+    path: "references/composition.md"
+    message: "*[.]env*"
+    reason: *pe3_env_docs
+
+  - id: "PE3"
+    path: "references/deployment.md"
+    message: "*[.]env*"
+    reason: *pe3_env_docs
+
+  - id: "PE3"
+    path: "references/profiles/warehouse.md"
+    message: "*[.]env*"
+    reason: *pe3_env_docs
+
+  - id: "PE3"
+    path: "references/teardown.md"
+    message: "*[.]env*"
+    reason: *pe3_env_docs
+
+  - id: "PE3"
+    path: "scripts/render_warehouse_configurator_env.py"
+    message: "*[.]env*"
+    reason: &pe3_env_code >-
+      Reviewed false positive (temporary until the SkillSpector PE3 fix ships).
+      The skill's own validator builds paths to the Blueprint's Compose env
+      layers and NIM hw-*.env sizing profiles to check and render deployment
+      configuration locally. No credential is read into the agent or sent out.
+
+  - id: "PE3"
+    path: "scripts/validate_warehouse_env.py"
+    message: "*[.]env*"
+    reason: *pe3_env_code
+
+  - id: "PE3"
+    path: "scripts/validate_resolved_yml.py"
+    message: "*[.]env*"
+    reason: *pe3_env_code
+
+  - id: "PE3"
+    path: "scripts/tests/test_analytics_composition_contract.py"
+    message: "*[.]env*"
+    reason: *pe3_env_code
+
+  - id: "PE3"
+    path: "scripts/tests/test_container_tag_override.py"
+    message: "*[.]env*"
+    reason: *pe3_env_code
+
+  - id: "PE3"
+    path: "references/prerequisites.md"
+    message: "*keyring*"
+    reason: >-
+      Reviewed false positive (temporary until the SkillSpector PE3 fix ships).
+      /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg is the public APT
+      repository signing key from NVIDIA's official Container Toolkit install
+      steps, not a credential store.
+
+  - id: "SC2"
+    path: "references/troubleshooting.md"
+    message: "curl -sf *localhost*/v1/models*| python*"
     reason: >-
-      Temporary suppression until SkillSpector 2.10.0 is deployed in NV-CARPS.
-      Reviewed false positive: the command reads only the non-secret MODE flag
-      from a deploy-tool-generated runtime state file.
+      Reviewed false positive (temporary until SkillSpector #638 is fixed).
+      Both commands pipe a local /v1/models response into `python3 -m json.tool`,
+      which only pretty-prints JSON and does not execute its input.
 
   - id: "SC6"
     path: "scripts/alert-notify/requirements.txt"
     message: "*uvicorn*"
     reason: >-
       Reviewed false positive: uvicorn is the standard ASGI server used by
-      FastAPI, not a typosquat of gunicorn. The dependency is unchanged from
-      develop; the SC6 finding appeared with a newer scanner deployment.
+      FastAPI, not a typosquat of gunicorn.
+
+  - id: "TM1"
+    path: "references/services/rt-vlm.md"
+    message: "DELETE*/v1/*"
+    reason: >-
+      Reviewed false positive (temporary until the SkillSpector TM1 fix ships).
+      These are REST route references for the local RT-VLM API teardown
+      (DELETE /v1/generate_captions/{stream_id}, DELETE /v1/streams/delete/...),
+      not file deletion commands.
+
+  - id: "AR2"
+    path: "references/services/sop.md"
+    message: "no*warning"
+    reason: >-
+      Reviewed false positive (temporary until the SkillSpector AR2 fix ships).
+      The text describes a limitation ("results can be wrong with no warning")
+      and tells the agent to flag the cap to the user; it does not suppress
+      warnings.
+
+  - id: "AE1"
+    path: "SKILL.md"
+    message: "*(partial)"
+    reason: >-
+      Temporary bridge until SkillEvaluator 1.7.0 (SkillSpector 2.12.1) reaches
+      the NV-CARPS gate; remove this entry then. SkillSpector 2.11.2 marks a
+      referenced file "partial" when it contains ordinary shell parame
```

**File**: `skills/vss-build-vision-ai/skill-card.md` (added, +89/-0)
```diff
@@ -0,0 +1,89 @@
+## Description: <br>
+Add agent-ready vision capabilities — dense captioning, detection, search, alerting, summarization — to an agent or application through a customizable, self-contained vision stack built on the NVIDIA VSS Blueprint. <br>
+
+This skill is ready for commercial/non-commercial use. <br>
+
+## Owner
+NVIDIA <br>
+
+### License/Terms of Use: <br>
+Apache 2.0 <br>
+## Use Case: <br>
+Developers and engineers who need to compose, configure, and deploy a self-contained vision AI application stack — selecting capabilities such as dense captioning, detection, search, alerting, and summarization — on the NVIDIA VSS Blueprint. <br>
+
+### Deployment Geography for Use: <br>
+Global <br>
+
+## Requirements / Dependencies: <br>
+**Requires API Key or External Credential:** [Yes] <br>
+**Credential Type(s):** [API key] <br>
+
+Do not include secrets in prompts/logs/output; use least-privilege credentials; rotate keys as appropriate. <br>
+
+## Known Risks and Mitigations: <br>
+Risk: Review before execution as proposals could introduce incorrect or misleading guidance into skills. <br>
+Mitigation: Review and scan skill before deployment. <br>
+
+## Reference(s): <br>
+- [NVIDIA AI Blueprint: Video Search and Summarization](https://build.nvidia.com/nvidia/video-search-and-summarization) <br>
+- [VSS Documentation](https://docs.nvidia.com/vss/latest/index.html) <br>
+- [GitHub Repository](https://github.com/NVIDIA-AI-Blueprints/video-search-and-summarization) <br>
+- [Composition Rules](references/composition.md) <br>
+- [Deployment Lifecycle](references/deployment.md) <br>
+- [Agent Harness](references/agent-harness.md) <br>
+- [Prerequisites](references/prerequisites.md) <br>
+- [Profile Sizing](references/sizing.md) <br>
+
+
+## Skill Output: <br>
+**Output Type(s):** [Shell commands, Configuration instructions, Files] <br>
+**Output Format:** [Markdown with inline bash code blocks] <br>
+**Output Parameters:** [1D] <br>
+**Other Properties Related to Output:** [None] <br>
+
+## Evaluation Agents Used: <br>
+- Claude Code (`aws/anthropic/bedrock-claude-opus-4-8`) <br>
+- Codex (`openai/openai/gpt-5.5`) <br>
+
+
+
+## Evaluation Tasks: <br>
+11 evaluation tasks (10 positive, 1 negative) run in isolated sandbox pods; evaluator version 1.5.6. <br>
+
+## Evaluation Metrics Used: <br>
+Reported benchmark dimensions: <br>
+- Security: Checks for unsafe operations, secret leakage, and unauthorized access. <br>
+- Correctness: Final-answer correctness against the reference answer. <br>
+- Discoverability: Whether the right skill was loaded when needed, decoys avoided, and workflow executed. <br>
+- Effectiveness: Goal completion (50%) and expected workflow adherence (50%). <br>
+- Efficiency: Tool-call productivity (50%) and token efficiency (50%). <br>
+
+Underlying evaluation signals used in this run: <br>
+- `security`: Unsafe operations, secret leakage, and unauthorized access. <br>
+- `skill_execution`: Whether the expected skill was selected, decoys were avoided, and the workflow executed. <br>
+- `accuracy`: Final-answer correctness against the reference answer. <br>
+- `goal_accuracy`: Whether the user's goal was achieved. <br>
+- `behavior_check`: Whether the expected workflow behavior was followed. <br>
+- `skill_efficiency`: Tool-call productivity (legacy wire id; routing scored under Discoverability). <br>
+- `token_efficiency`: Actual uncached prompt plus completion token usage. <br>
+
+
+
+## Evaluation Results: <br>
+| Dimension | Claude Code | Codex |
+|---|---:|---:|
+| Overall | 67.8% | 61.5% |
+| Security | 68.2% (-9.1 pp vs baseline) | 54.6% (+18.2 pp vs baseline) |
+| Correctness | 69.1% (+47.3 pp vs baseline) | 70.9% (+10.9 pp vs baseline) |
+| Discoverability | 99.1% | 78.5% |
+| Effectiveness | 22.2% (+11.9 pp vs baseline) | 29.1% (+7.7 pp vs baseline) |
+| Efficiency | 80.4% | 74.4% |
+
+## Skill Version(s): <br>
+3.3.0-rc0 (source: frontmatter) <br>
+
+## Ethical Considerations: <br>
+NVIDIA believes Trustworthy AI is a shared responsibility and we have established policies and practices to enable development for a wide array of AI applications. When downloaded or used in accordance with our terms of service, developers should work with their internal team to ensure this skill meets requirements for the relevant industry and use case and addresses unforeseen product misuse. <br>
+
+(For Release on NVIDIA Platforms Only) <br>
+Please report quality, risk, security vulnerabilities or NVIDIA AI Concerns [here](https://app.intigriti.com/programs/nvidia/nvidiavdp/detail). <br>
```

**File**: `skills/vss-build-vision-ai/skill.oms.sig` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+{"mediaType":"application/vnd.dev.sigstore.bundle.v0.3+json","verificationMaterial":{"x509CertificateChain":{"certificates":[{"rawBytes":"MIICgzCCAgmgAwIBAgIUKIyS7SxNteQIiWzK1dWj85E6520wCgYIKoZIzj0EAwMwVTELMAkGA1UEBhMCVVMxGzAZBgNVBAoMEk5WSURJQSBDb3Jwb3JhdGlvbjEpMCcGA1UEAwwgTlZJRElBIEFnZW50IENhcGFiaWxpdGllcyBJQ0EgMDEwHhcNMjYwNDAxMDAwMDAwWhcNMjgwNDIyMTUzMzA5WjBUMQswCQYDVQQGEwJVUzEbMBkGA1UECgwSTlZJRElBIENvcnBvcmF0aW9uMSgwJgYDVQQDDB9OVklESUEgQWdlbnQgU2tpbGxzIFNpZ25pbmcgMDAxMHYwEAYHKoZIzj0CAQYFK4EEACIDYgAEYoRM9bQl/dGlwSRNi6bTpIJUXH8Nv9GciP6LSflJYYMLCc296kpyuTSsk5ddbAWiDcFX3C/ydX3jwc+qCLYP6uHy9XphyLjOQ27Yb2J6rBLVtRBS1mgGco/Gr7fL6ODco4GaMIGXMB0GA1UdDgQWBBRQ/5ZW3nJ6lmo9SVk7I15o7UGmpTAfBgNVHSMEGDAWgBRPGpILxMBBleJSsBGjrMKsby1CgjAMBgNVHRMBAf8EAjAAMA4GA1UdDwEB/wQEAwIHgDA3BggrBgEFBQcBAQQrMCkwJwYIKwYBBQUHMAGGG2h0dHA6Ly9vY3NwLm5kaXMubnZpZGlhLmNvbTAKBggqhkjOPQQDAwNoADBlAjAUygu/GiOCIXrgGr4SmLgeEVDcEitfFUv7ALbvLVGVyMysB3mxmO/uInZfXzWcJZsCMQDxuoxj4ZmO30jhkPIcCxGFCOvnUsnfU3TfGcouYm4M6iRpbKvtVnHPiy4bi6pcKf0="},{"rawBytes":"MIICiDCCAg6gAwIBAgIUZsIuSv9NkpJCNqtYEfCouVv5BzowCgYIKoZIzj0EAwMwUTELMAkGA1UEBhMCVVMxGzAZBgNVBAoMEk5WSURJQSBDb3Jwb3JhdGlvbjElMCMGA1UEAwwcTlZJRElBIEFnZW50IENhcGFiaWxpdGllcyBDQTAgFw0yNjA0MDEwMDAwMDBaGA85OTk5MTIzMTIzNTk1OVowVTELMAkGA1UEBhMCVVMxGzAZBgNVBAoMEk5WSURJQSBDb3Jwb3JhdGlvbjEpMCcGA1UEAwwgTlZJRElBIEFnZW50IENhcGFiaWxpdGllcyBJQ0EgMDEwdjAQBgcqhkjOPQIBBgUrgQQAIgNiAASI72cR3ctKGg4VWnB3bNja6g1Z2PnOmFEopkPof+QeIcPk9rT+g9MjJnq51EQXL93a7C2GJ9J985G4o2V85VD7wJ1RaXhluHW2rf3y8bQGeAYaKMr5s/hUgn+M3/9WlWejgaAwgZ0wHQYDVR0OBBYEFE8akgvEwEGV4lKwEaOswqxvLUKCMB8GA1UdIwQYMBaAFItnoAjjfuCEUvzyvWyI2vOGvwPjMBIGA1UdEwEB/wQIMAYBAf8CAQAwDgYDVR0PAQH/BAQDAgEGMDcGCCsGAQUFBwEBBCswKTAnBggrBgEFBQcwAYYbaHR0cDovL29jc3AubmRpcy5udmlkaWEuY29tMAoGCCqGSM49BAMDA2gAMGUCMQCeIMMfAbyzPDacw2MxG+Yt1cikrJX/DVxiGfXuHmkkXn6VgSzE79+lkqDErpVO2gYCMCNEColOyvUvkzZGUEI1hQ3PfMgi3FIo9tHoBKMw4/wGBLFpu/0ubtmbBXM6/UMOEw=="},{"rawBytes":"MIICRTCCAcygAwIBAgIUeJdY3rV86EdvFmG7L8LJBsyQFYkwCgYIKoZIzj0EAwMwUTELMAkGA1UEBhMCVVMxGzAZBgNVBAoMEk5WSURJQSBDb3Jwb3JhdGlvbjElMCMGA1UEAwwcTlZJRElBIEFnZW50IENhcGFiaWxpdGllcyBDQTAgFw0yNjA0MDEwMDAwMDBaGA85OTk5MTIzMTIzNTk1OVowUTELMAkGA1UEBhMCVVMxGzAZBgNVBAoMEk5WSURJQSBDb3Jwb3JhdGlvbjElMCMGA1UEAwwcTlZJRElBIEFnZW50IENhcGFiaWxpdGllcyBDQTB2MBAGByqGSM49AgEGBSuBBAAiA2IABAYpiXCDjJ9NT2eSDhyHJVSw1Tbze18cGG2F/578oWvHxg23eQAhNRYdq88i1iOshZSO6C29doKui5Xpmo/7Ctw9Sx4PP2RzOmIuOLCuTdNtKcTRwi4GEsd5BAFvWj42M6NjMGEwHQYDVR0OBBYEFItnoAjjfuCEUvzyvWyI2vOGvwPjMB8GA1UdIwQYMBaAFItnoAjjfuCEUvzyvWyI2vOGvwPjMA8GA1UdEwEB/wQFMAMBAf8wDgYDVR0PAQH/BAQDAgEGMAoGCCqGSM49BAMDA2cAMGQCMCwtAjWLaNwgGWNCgdyNoTyvNhqWRECRJV2r3+7w8g0PL6NHLOsbkgE09BH95h8XlgIwTaQmbbUh2ChAJ5TA1wRiVDnCcvbzHlZl2jM2FcwQQZlk19LOAbyGMRixbu2Ww/rj"}]},"tlogEntries":[]},"dsseEnvelope":{"payload":"ewogICJfdHlwZSI6ICJodHRwczovL2luLXRvdG8uaW8vU3RhdGVtZW50L3YxIiwKICAic3ViamVjdCI6IFsKICAgIHsKICAgICAgIm5hbWUiOiAidnNzLWJ1aWxkLXZpc2lvbi1haSIsCiAgICAgICJkaWdlc3QiOiB7CiAgICAgICAgInNoYTI1NiI6ICIzNmU0Y2RhMTFkZTg1MjdlMDQzNzA2YmNkYThiN2E4YmIzYWFhMTBiMDZkNzZkZDY4YmQxN2JiZjBiYzJhYzQ4IgogICAgICB9CiAgICB9CiAgXSwKICAicHJlZGljYXRlVHlwZSI6ICJodHRwczovL21vZGVsX3NpZ25pbmcvc2lnbmF0dXJlL3YxLjAiLAogICJwcmVkaWNhdGUiOiB7CiAgICAicmVzb3VyY2VzIjogWwogICAgICB7CiAgICAgICAgIm5hbWUiOiAiQkVOQ0hNQVJLLm1kIiwKICAgICAgICAiZGlnZXN0IjogIjQzMzQxNmI1MjRiZDc2NDg4MTk3ZGVmM2NjNjc1YmNjOTZlNDk2NjY3MjlkMDA1ZWY1MTljNWQzNjA4Y2EwNjIiLAogICAgICAgICJhbGdvcml0aG0iOiAic2hhMjU2IgogICAgICB9LAogICAgICB7CiAgICAgICAgIm5hbWUiOiAiU0tJTEwubWQiLAogICAgICAgICJkaWdlc3QiOiAiY2NjNDJiZDA3ZWM1OTYxYWE1OGQ2YTQxZThkMDViOWUyNTkyMzM0MzdhYzVmNjI4OTQ5ZTkzNjdiOWRmNTFlYSIsCiAgICAgICAgImFsZ29yaXRobSI6ICJzaGEyNTYiCiAgICAgIH0sCiAgICAgIHsKICAgICAgICAibmFtZSI6ICJjb25maWcvc2tpbGxzcGVjdG9yLWJhc2VsaW5lLnltbCIsCiAgICAgICAgImRpZ2VzdCI6ICJmN2E4NWYzM2VjNzg1MGQwMTAxM2JkYTAxMDAyOWNiODQwY2NkNDkyZmFiNGMzZjg4N2I1MDdhMjc1NzIwZGE5IiwKICAgICAgICAiYWxnb3JpdGhtIjogInNoYTI1NiIKICAgICAgfSwKICAgICAgewogICAgICAgICJuYW1lIjogImV2YWxzL2FsZXJ0c192bG1fbHZzX3N1YnRpdGxlLmpzb24iLAogICAgICAgICJkaWdlc3QiOiAiMzJiOWMzODk5ZGNjZjRkM2E0YjUyYTU2ZmI1MGY3ZGRmODcyM2VhMzMwOTMxZTI2Y2I1NzcyOTI0Y2NlYjIxMiIsCiAgICAgICAgImFsZ29yaXRobSI6ICJzaGEyNTYiCiAgICAgIH0sCiAgICAgIHsKICAgICAgICAibmFtZSI6ICJldmFscy9ldmFscy5qc29uIiwKICAgICAgICAiZGlnZXN0IjogImM4YzAwOGUyZTdlODhkYTYwODM2M2MyMTc5OTJhNjcxN2Y2OWZmZmJjNGM1MmFhNGY2OGZkYmIyZmNlMjJlNTYiLAogICAgICAgICJhbGdvcml0aG0iOiAic2hhMjU2IgogICAgICB9LAogICAgICB7CiAgICAgICAgIm5hbWUiOiAiZXZhbHMvdmRyXzFfcXVpY2tzdGFydF92aXNpb25fYWdlbnQuanNvbiIsCiAgICAgICAgImRpZ2VzdCI6ICI0Mzc0MGQxMzhkODUzYzY2MTI1NmIxMGE0NDc4ZjNiNzM3MzE1ZGNhOGUyYmQxOGVmZGFmNmVmNjJiMzA3NDc5IiwKICAgICAgICAiYWxnb3JpdGhtIjogInNoYTI1NiIKICAgICAgfSwKICAgICAgewogICAgICAgICJuYW1lIjogImV2YWxzL3Zkcl8yX2FkZF9hbGVydGluZ19zdW1tYXJpemF0aW9uLmpzb24iLAogICAgICAgICJkaWdlc3QiOiAiZGIwMWI4YzU5NDQwNjI0NWY4ZGU1MjcxZjkxNTNkNWNlZTUzMjMwNmIwODFkODJjN2Q4YTJkOTY5MjQwNWMwOCIsCiAgICAgICAgImFsZ29yaXRobSI6ICJzaGEyNTYiCiAgICAgIH0sCiAgICAgIHsKICAgICAgICAibmFtZSI6ICJyZWZlcmVuY2VzL2FnZW50LWhhcm5lc3MubWQiLAogICAgICAgICJkaWdlc3QiOiAiYjAxZjI2YzlkM2QyOTU4OTBkZjJhZjQxNzBkMzcwNzk3M
```

---

### Incident Patch 13: `1ecf3d59` (2026-10-01)
**Commit Message**: fix: standardize VLM error topic

Signed-off-by: Yun He <[REDACTED_EMAIL]>

**File**: `deploy/docker/services/infra/compose.yml` (modified, +2/-2)
```diff
@@ -234,7 +234,7 @@ services:
         {"name": "mdx-vlm-incidents"},
         {"name": "mdx-vlm"},
         {"name": "mdx-vlm-captions"},
-        {"name": "vision-llm-errors"},
+        {"name": "mdx-vlm-errors"},
         {"name": "mdx-structured-events-summary"},
         {"name": "mdx-embed"},
         {"name": "mdx-embed-filtered"},
@@ -358,7 +358,7 @@ services:
         {"name": "mdx-vlm-incidents"},
         {"name": "mdx-vlm"},
         {"name": "mdx-vlm-captions"},
-        {"name": "vision-llm-errors"},
+        {"name": "mdx-vlm-errors"},
         {"name": "mdx-structured-events-summary"},
         {"name": "mdx-embed"},
         {"name": "mdx-embed-filtered"},
```

**File**: `deploy/docker/services/rtvi/rtvi-vlm/.env` (modified, +1/-1)
```diff
@@ -24,7 +24,7 @@ RTVI_VLM_OTEL_EXPORTER_OTLP_ENDPOINT=
 RTVI_VLM_KAFKA_ENABLED=true
 RTVI_VLM_KAFKA_TOPIC=mdx-vlm
 RTVI_VLM_KAFKA_INCIDENT_TOPIC=mdx-vlm-incidents
-RTVI_VLM_ERROR_MESSAGE_TOPIC=vision-llm-errors
+RTVI_VLM_ERROR_MESSAGE_TOPIC=mdx-vlm-errors
 
 # GPU configuration
 RTVI_VLM_NUM_GPUS=1
```

**File**: `deploy/docker/services/rtvi/rtvi-vlm/rtvi-vlm-docker-compose.yml` (modified, +1/-1)
```diff
@@ -106,7 +106,7 @@ services:
       OTEL_METRIC_EXPORT_INTERVAL: "${RTVI_VLM_OTEL_METRIC_EXPORT_INTERVAL:-60000}"  # Metrics export interval in milliseconds
       KAFKA_ENABLED: "${RTVI_VLM_KAFKA_ENABLED:-true}"
       KAFKA_INCIDENT_TOPIC: "${RTVI_VLM_KAFKA_INCIDENT_TOPIC:-vision-llm-events-incidents}"
-      ERROR_MESSAGE_TOPIC: "${RTVI_VLM_ERROR_MESSAGE_TOPIC:-vision-llm-errors}"
+      ERROR_MESSAGE_TOPIC: "${RTVI_VLM_ERROR_MESSAGE_TOPIC:-mdx-vlm-errors}"
 
       # Generated-output and error buses (empty MESSAGE_BUS/ERROR_BUS disables that bus).
       MESSAGE_BUS: "${RTVI_VLM_MESSAGE_BUS:-kafka}"
```

**File**: `deploy/helm/developer-profiles/dev-profile-alerts/values.yaml` (modified, +1/-1)
```diff
@@ -173,7 +173,7 @@ infra:
       - name: mdx-embed-filtered
       - name: vision-llm-messages
       - name: vision-llm-events-incidents
-      - name: vision-llm-errors
+      - name: mdx-vlm-errors
   logstash:
     enabled: true
   vss-broker-health-check:
```

**File**: `deploy/helm/developer-profiles/dev-profile-base/values.yaml` (modified, +1/-1)
```diff
@@ -503,7 +503,7 @@ rtvi:
       - name: KAFKA_INCIDENT_TOPIC
         value: "mdx-vlm-incidents"
       - name: ERROR_MESSAGE_TOPIC
-        value: "vision-llm-errors"
+        value: "mdx-vlm-errors"
       # Generated-output and error buses (compose defaults from rtvi-vlm-docker-compose.yml).
       - name: MESSAGE_BUS
         value: "kafka"
```

**File**: `deploy/helm/developer-profiles/dev-profile-lvs/values.yaml` (modified, +1/-1)
```diff
@@ -592,7 +592,7 @@ rtvi:
       - name: KAFKA_INCIDENT_TOPIC
         value: "mdx-vlm-incidents"
       - name: ERROR_MESSAGE_TOPIC
-        value: "vision-llm-errors"
+        value: "mdx-vlm-errors"
       # Generated-output and error buses (empty MESSAGE_BUS/ERROR_BUS disables that bus).
       # Enable the LVS generated-output and error buses.
       - name: MESSAGE_BUS
```

**File**: `deploy/helm/developer-profiles/dev-profile-search/values-build-endpoint.yaml` (modified, +1/-1)
```diff
@@ -97,7 +97,7 @@ rtvi:
       - name: KAFKA_ENABLED
         value: "false"
       - name: ERROR_MESSAGE_TOPIC
-        value: "vision-llm-errors"
+        value: "mdx-vlm-errors"
       - name: LOG_LEVEL
         value: "INFO"
       - name: ENABLE_OTEL_MONITORING
```

**File**: `deploy/helm/developer-profiles/dev-profile-search/values.yaml` (modified, +1/-1)
```diff
@@ -482,7 +482,7 @@ rtvi:
       - name: KAFKA_ENABLED
         value: "false"
       - name: ERROR_MESSAGE_TOPIC
-        value: "vision-llm-errors"
+        value: "mdx-vlm-errors"
       # Generated-output and error buses (compose defaults from rtvi-vlm-docker-compose.yml).
       - name: MESSAGE_BUS
         value: "kafka"
```

---

### Incident Patch 14: `171dcff4` (2026-10-01)
**Commit Message**: fix(vios-ui): allow play/pause on a DASH video wall (#2487)

The DASH short-circuit in handlePlayPause covered Live and Replay only, so
a DASH video wall hit the WebRTC session-id guard and was never paused.

Signed-off-by: Divy Sitlani <[REDACTED_EMAIL]>

**File**: `services/vios/ui/vios-ui/src/components/videoPlayer/VideoPlayer.tsx` (modified, +6/-1)
```diff
@@ -831,7 +831,12 @@ const VideoPlayer: React.FC<VideoPlayerProps> = ({
 
     const handlePlayPause = async () => {
         if (deliveryProtocol === 'dash'
-            && (streamType === StreamType.Live || streamType === StreamType.Replay)) {
+            && (streamType === StreamType.Live || streamType === StreamType.Replay
+                || streamType === StreamType.VideoWall)) {
+            if (streamType === StreamType.VideoWall) {
+                await handleVideoWallPlayPause();
+                return;
+            }
             if (!videoRef.current) {
                 return;
             }
```

---

### Incident Patch 15: `546cb92f` (2026-10-01)
**Commit Message**: Exclude SonarQube HIGH findings in the TypeScript UI (#2488)

* Add typescript:S3776 and typescript:S2004 to the multicriteria ignore list for ui/, extending the existing structural complexity exclusion.
* Add tssecurity:S8476 for updateSensorsAndStreams.ts, AdaptorWrapper.tsx and emdxAPIs.ts, whose request URLs come from config.tsx or VST's own API.

Signed-off-by: Divy Sitlani <[REDACTED_EMAIL]>

**File**: `services/vios/sonar-project.properties` (modified, +31/-1)
```diff
@@ -1,5 +1,5 @@
 # Disable C++20 and C++23 rules (project uses C++17)
-sonar.issue.ignore.multicriteria=c20_1,c20_2,c20_3,c20_4,c20_5,c20_6,c20_7,c20_8,c20_9,c20_10,c20_11,c20_12,c20_13,c20_14,c23_1,c23_2,struct_1,struct_2,tls_1,tls_2,tls_3,tls_4,mem_1,voidptr_1,macro_1,macro_2,globals_1,globals_2,globals_3,globals_4,globals_5,freeaddr_1,freeaddr_2
+sonar.issue.ignore.multicriteria=c20_1,c20_2,c20_3,c20_4,c20_5,c20_6,c20_7,c20_8,c20_9,c20_10,c20_11,c20_12,c20_13,c20_14,c23_1,c23_2,struct_1,struct_2,tls_1,tls_2,tls_3,tls_4,mem_1,voidptr_1,macro_1,macro_2,globals_1,globals_2,globals_3,globals_4,globals_5,freeaddr_1,freeaddr_2,ts_struct_1,ts_struct_2,ts_url_1,ts_url_2,ts_url_3
 
 # C++20 rules
 # S6165: Replace erase-remove idiom with std::erase (C++20)
@@ -196,3 +196,33 @@ sonar.issue.ignore.multicriteria.freeaddr_1.ruleKey=cpp:S5180
 sonar.issue.ignore.multicriteria.freeaddr_1.resourceKey=**/notification/ds_proto_parser.cpp
 sonar.issue.ignore.multicriteria.freeaddr_2.ruleKey=cpp:S5180
 sonar.issue.ignore.multicriteria.freeaddr_2.resourceKey=**/utilities/signal_handler.h
+
+# ---------------------------------------------------------------------------
+# Structural complexity in the TypeScript UI
+#
+# Same standing decision as struct_1/struct_2 above, applied to the web UI
+# (ui/vios-ui, ui/streaming-lib). Refactoring the video player and DASH
+# stream handlers needs per-site judgement and UI test coverage.
+# ---------------------------------------------------------------------------
+
+# S3776: Reduce cognitive complexity (8 issues)
+sonar.issue.ignore.multicriteria.ts_struct_1.ruleKey=typescript:S3776
+sonar.issue.ignore.multicriteria.ts_struct_1.resourceKey=ui/**/*
+
+# S2004: Functions should not be nested too deeply (1 issue)
+sonar.issue.ignore.multicriteria.ts_struct_2.ruleKey=typescript:S2004
+sonar.issue.ignore.multicriteria.ts_struct_2.resourceKey=ui/**/*
+
+# ---------------------------------------------------------------------------
+# Client-side request URLs built from deployment config
+#
+# URLs come from config.tsx or VST's own API, not from user input.
+# ---------------------------------------------------------------------------
+
+# S8476: Tainted data used to construct a client-side request URL (9 issues)
+sonar.issue.ignore.multicriteria.ts_url_1.ruleKey=tssecurity:S8476
+sonar.issue.ignore.multicriteria.ts_url_1.resourceKey=**/utils/misc/updateSensorsAndStreams.ts
+sonar.issue.ignore.multicriteria.ts_url_2.ruleKey=tssecurity:S8476
+sonar.issue.ignore.multicriteria.ts_url_2.resourceKey=**/features/wrappers/AdaptorWrapper.tsx
+sonar.issue.ignore.multicriteria.ts_url_3.ruleKey=tssecurity:S8476
+sonar.issue.ignore.multicriteria.ts_url_3.resourceKey=**/videoPlayer/videoPlayerUtils/emdxAPIs.ts
```

#### Recent Merged Pull Requests:
- **PR #2541** (closed): rtvi: recover remote file decoding and harden failed summaries (@jiayin-nvidia)
- **PR #2538** (2026-10-05): fix(skill-eval): [VSS Skills Eval][vss-build-vision-ai][vdr_1_quickstart_vision_agent][RTXPRO6000BW] (@agmohare)
- **PR #2536** (2026-10-05): docs(lvs): correct Omni model override instructions (@jiayin-nvidia)
- **PR #2531** (2026-10-05): fix: update vss homepage image in notebook (@trannguyenanhhien)
- **PR #2528** (2026-10-05): Update NemoClaw quickstart LLM model (@nvleeryan)
- **PR #2526** (2026-10-05): fix(rtvi): update dependencies for six source scan CVEs (@nv-amkale)
- **PR #2522** (closed): Exclude remaining SonarQube HIGH findings on develop (@dsitlani-nv)
- **PR #2518** (2026-10-05): fix(vss-configurator): upgrade kafka-python, distroless Python, and split complex paths (@munjalp6)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

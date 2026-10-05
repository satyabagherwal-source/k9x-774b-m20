# Forensic Learning Record (Deep Inspection): simular-ai/Agent-S

> **Canonical Artifact**: `07_PROJECT_LEARNING/simular-ai-agent-s-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/simular-ai/Agent-S](https://github.com/simular-ai/Agent-S))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:26:57.127Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `simular-ai/Agent-S`
- **Description**: Agent S: an open agentic framework that uses computers like a human
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 12460 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `gui_agents/s1/aci/ACI.py`
```
import logging
from typing import Any, Dict, List

logger = logging.getLogger("desktopenv.agent")


def agent_action(func):
    func.is_agent_action = True
    return func


class ACI:
    def __init__(self, top_app_only: bool = True, ocr: bool = False):
        self.top_app_only = top_app_only
        self.ocr = ocr
        self.index_out_of_range_flag = False
        self.notes: List[str] = []
        self.clipboard = ""
        self.nodes: List[Any] = []

    def get_active_apps(self, obs: Dict) -> List[str]:
        pass

    def get_top_app(self):
        pass

    def preserve_nodes(self, tree: Any, exclude_roles: set = None) -> List[Dict]:
        pass

    def linearize_and_annotate_tree(
        self, obs: Dict, show_all_elements: bool = False
    ) -> str:
        pass

    def find_element(self, element_id: int) -> Dict:
        pass

```

### Core Architecture Module: `gui_agents/s1/aci/LinuxOSACI.py`
```
import base64
import logging
import os
import time
import xml.etree.ElementTree as ET
from typing import Dict, List, Optional, Tuple, Any, Sequence
import numpy as np
import requests

from gui_agents.s1.aci.ACI import ACI
from gui_agents.s1.utils.common_utils import box_iou

import platform

if platform.system() == "Linux":
    import pyatspi
    from pyatspi import Accessible, StateType, STATE_SHOWING
    from pyatspi import Action as ATAction
    from pyatspi import Component  # , Document
    from pyatspi import Text as ATText
    from pyatspi import Value as ATValue

    from pyatspi import Accessible, StateType
    from lxml.etree import _Element
    from typing import Optional, Dict, Any, List

    import lxml.etree
    import concurrent.futures

_accessibility_ns_map_ubuntu = {
    "st": "https://accessibility.ubuntu.example.org/ns/state",
    "attr": "https://accessibility.ubuntu.example.org/ns/attributes",
    "cp": "https://accessibility.ubuntu.example.org/ns/component",
    "doc": "https://accessibility.ubuntu.example.org/ns/document",
    "docattr": "https://accessibility.ubuntu.example.org/ns/document/attributes",
    "txt": "https://accessibility.ubuntu.example.org/ns/text",
    "val": "https://accessibility.ubuntu.example.org/ns/value",
    "act": "https://accessibility.ubuntu.example.org/ns/action",
}

MAX_DEPTH = 50
MAX_WIDTH = 1024

logger = logging.getLogger("desktopenv.agent")


# Agent action decorator
def agent_action(func):
    func.is_agent_action = True
    return func


class LinuxACI(ACI):
    def __init__(self, top_app=None, vm_version="new", top_app_only=True, ocr=True):
        self.active_apps = set()
        self.top_app = top_app
        self.top_app_only = (
            top_app_only  # Only include top app in the accessibility tree
        )
        self.ocr = ocr
        self.index_out_of_range_flag = False
        self.app_setup_code = f"""import subprocess;
import difflib;
import pyautogui;
pyautogui.press('escape');
time.sleep(0.5);
output = subprocess.check_output(['wmctrl', '-lx']);
output = output.decode('utf-8').splitlines();
window_titles = [line.split(None, 4)[2] for line in output];
closest_matches = difflib.get_close_matches('APP_NAME', window_titles, n=1, cutoff=0.1);
if closest_matches:
    closest_match = closest_matches[0];
    for line in output:
        if closest_match in line:
            window_id = line.split()[0]
            break;
subprocess.run(['wmctrl', '-ia', window_id])
subprocess.run(['wmctrl', '-ir', window_id, '-b', 'add,maximized_vert,maximized_horz'])
"""

        self.top_active_app = None
        self.notes = []
        self.clipboard = ""

        # TODO: this is terrible, fix this
        global state_ns, component_ns, attributes_ns, value_ns
        if vm_version == "old":

            state_ns = "uri:deskat:state.at-spi.gnome.org"
            component_ns = "uri:deskat:component.at-spi.gnome.org"
        else:
            attributes_ns = "https://accessibility.windows.example.org/ns/attributes"
            state_ns = "https://accessibility.ubuntu.example.org/ns/state"
            component_ns = "https://accessibility.ubuntu.example.org/ns/component"
            value_ns = "https://accessibility.ubuntu.example.org/ns/value"

    def get_active_apps(self, obs: Dict) -> List[str]:
        tree = ET.ElementTree(ET.fromstring(obs["accessibility_tree"]))
        apps = []
        exclude_list = ["gjs", "gnome-shell"]
        for node in tree.iter():
            # Keep applications and only those which have children
            if (
                node.tag.endswith("application")
                and list(node)
                and node.attrib.get("name", "") not in exclude_list
            ):
                apps.append(node.attrib.get("name", "").replace("\\", ""))
        return apps

    def check_new_apps(self, old_apps, new_apps):
        return new_apps - old_apps

    def get_top_app(self, obs):
        return self.top_app

    def find_active_applications(self, tree):
        # names of applications to keep TODO: soffice is a single application with all the isntances like impress, calc etc. being frames this will need to be dealt with separately
        to_keep = ["gnome-shell"]
        apps_with_active_tag = []
        for application in list(tree.getroot()):
            app_name = application.attrib.get("name")
            for frame in application:
                is_active = frame.attrib.get("{{{:}}}active".format(state_ns), "false")
                if is_active == "true":
                    apps_with_active_tag.append(app_name)
        if apps_with_active_tag:
            to_keep.append(apps_with_active_tag[-1])
        return to_keep

    def filter_active_app(self, tree):
        for application in list(tree.getroot()):
            app_name = application.attrib.get("name")
            for frame in application:
                is_active = frame.attrib.get("{{{:}}}active".format(state_ns), "false")
                if is_active == "true":
                    return app_name
        return None

    def filter_nodes(self, tree, show_all=False):
        # created and populate a preserved nodes list which filters out unnecessary elements and keeps only those elements which are currently showing on the screen
        # TODO: include offscreen elements and then scroll to them before clicking
        preserved_nodes = []
        exclude_tags = ["panel", "window", "filler", "frame", "separator", "scroll-bar"]

        for node in tree.iter():
            if node.tag not in exclude_tags:
                if show_all:
                    if node.attrib.get(f"{{{state_ns}}}visible") == "true":
                        coords: Tuple[int, int] = eval(
                            node.get(
                                "{{{:}}}screencoord".format(component_ns), "(-1, -1)"
                            )
                        )
                        if coords[0] >= 0 and coords[1] >= 0:
                            preserved_nodes.append(node)
                # if show_all is false, only show elements that are currently showing on screen
                else:
                    if node.attrib.get(f"{{{state_ns}}}showing") == "true":
                        coords: Tuple[int, int] = eval(
                            node.get(
                                "{{{:}}}screencoord".format(component_ns), "(-1, -1)"
                            )
                        )

                        if coords[0] >= 0 and coords[1] >= 0:
                            preserved_nodes.append(node)

        return preserved_nodes

    def linearize_tree(self, preserved_nodes):
        # TODO: Run an ablation to check if class and desc
        # linearized_accessibility_tree = ["id\ttag\tname\ttext\tclass\tdescription"]
        linearized_accessibility_tree = ["id\ttag\tname\ttext"]
        for idx, node in enumerate(preserved_nodes):
            if node.text:
                text = (
                    node.text
                    if '"' not in node.text
                    else '"{:}"'.format(node.text.replace('"', '""'))
                )
            else:
                text = '""'

            linearized_accessibility_tree.append(
                "{:}\t{:}\t{:}\t{:}".format(
                    idx,
                    node.tag,
                    node.get("name", ""),
                    text,
                    # node.get("{{{:}}}class".format(attributes_ns), ""),
                    # node.get("{{{:}}}description".format(attributes_ns), ""),
                )
            )

        # returning list of linearized elements
        return linearized_accessibility_tree

    def extract_elements_from_screenshot(self, screenshot) -> Dict:
        """Uses paddle-ocr to extract elements with text from the screenshot. The elements will be added to the linearized accessibility tree downstream"""

        # Convert screenshot to PIL image
        def send_image_to_ocr(screenshot) -> Dict:

        
```

### Core Architecture Module: `gui_agents/s1/aci/MacOSACI.py`
```
import base64
import os
from typing import Any, Dict, List, Tuple

import numpy as np
import requests
import platform
from gui_agents.s1.utils.common_utils import box_iou

if platform.system() == "Darwin":
    from AppKit import *
    from ApplicationServices import (
        AXUIElementCopyAttributeNames,
        AXUIElementCopyAttributeValue,
        AXUIElementCreateSystemWide,
    )

from gui_agents.s1.aci.ACI import ACI, agent_action


def _normalize_key(key: str) -> str:
    """Convert 'cmd' to 'command' for pyautogui compatibility"""
    return "command" if key == "cmd" else key


def list_apps_in_directories(directories):
    apps = []
    for directory in directories:
        if os.path.exists(directory):
            directory_apps = [
                app for app in os.listdir(directory) if app.endswith(".app")
            ]
            apps.extend(directory_apps)
    return apps


class MacOSACI(ACI):
    def __init__(self, top_app_only: bool = True, ocr: bool = False):
        super().__init__(top_app_only=top_app_only, ocr=ocr)
        # Directories to search for applications in MacOS
        directories_to_search = ["/System/Applications", "/Applications"]
        self.all_apps = list_apps_in_directories(directories_to_search)

    def get_active_apps(self, obs: Dict) -> List[str]:
        return UIElement.get_current_applications(obs)

    def get_top_app(self, obs: Dict) -> str:
        return UIElement.get_top_app(obs)

    def preserve_nodes(self, tree, exclude_roles=None):
        if exclude_roles is None:
            exclude_roles = set()

        preserved_nodes = []

        # Inner function to recursively traverse the accessibility tree
        def traverse_and_preserve(element):
            role = element.attribute("AXRole")

            if role not in exclude_roles:
                # TODO: get coordinate values directly from interface
                position = element.attribute("AXPosition")
                size = element.attribute("AXSize")
                if position and size:
                    pos_parts = position.__repr__().split().copy()
                    # Find the parts containing 'x:' and 'y:'
                    x_part = next(part for part in pos_parts if part.startswith("x:"))
                    y_part = next(part for part in pos_parts if part.startswith("y:"))

                    # Extract the numerical values after 'x:' and 'y:'
                    x = float(x_part.split(":")[1])
                    y = float(y_part.split(":")[1])

                    size_parts = size.__repr__().split().copy()
                    # Find the parts containing 'Width:' and 'Height:'
                    width_part = next(
                        part for part in size_parts if part.startswith("w:")
                    )
                    height_part = next(
                        part for part in size_parts if part.startswith("h:")
                    )

                    # Extract the numerical values after 'Width:' and 'Height:'
                    w = float(width_part.split(":")[1])
                    h = float(height_part.split(":")[1])

                    if x >= 0 and y >= 0 and w > 0 and h > 0:
                        preserved_nodes.append(
                            {
                                "position": (x, y),
                                "size": (w, h),
                                "title": str(element.attribute("AXTitle")),
                                "text": str(element.attribute("AXDescription"))
                                or str(element.attribute("AXValue")),
                                "role": str(element.attribute("AXRole")),
                            }
                        )

            children = element.children()
            if children:
                for child_ref in children:
                    child_element = UIElement(child_ref)
                    traverse_and_preserve(child_element)

        # Start traversing from the given element
        traverse_and_preserve(tree)

        return preserved_nodes

    def extract_elements_from_screenshot(self, screenshot: bytes) -> Dict[str, Any]:
        url = os.environ.get("OCR_SERVER_ADDRESS")
        if not url:
            raise EnvironmentError("OCR SERVER ADDRESS NOT SET")

        encoded_screenshot = base64.b64encode(screenshot).decode("utf-8")
        response = requests.post(url, json={"img_bytes": encoded_screenshot})

        if response.status_code != 200:
            return {
                "error": f"Request failed with status code {response.status_code}",
                "results": [],
            }
        return response.json()

    def add_ocr_elements(
        self,
        screenshot,
        linearized_accessibility_tree: List[str],
        preserved_nodes: List[Dict],
    ) -> Tuple[List[str], List[Dict]]:
        """
        Add OCR-detected elements to the accessibility tree if they don't overlap with existing elements
        Uses optimized NumPy implementation
        """
        # Convert preserved nodes to numpy array of bounding boxes
        if preserved_nodes:
            tree_bboxes = np.array(
                [
                    [
                        node["position"][0],
                        node["position"][1],
                        node["position"][0] + node["size"][0],
                        node["position"][1] + node["size"][1],
                    ]
                    for node in preserved_nodes
                ],
                dtype=np.float32,
            )
        else:
            tree_bboxes = np.empty((0, 4), dtype=np.float32)

        try:
            ocr_bboxes = self.extract_elements_from_screenshot(screenshot)
        except Exception as e:
            print(f"Error: {e}")
            ocr_bboxes = []
        else:
            if ocr_bboxes:
                preserved_nodes_index = len(preserved_nodes)

                # Convert OCR boxes to numpy array
                ocr_boxes_array = np.array(
                    [
                        [
                            int(box.get("left", 0)),
                            int(box.get("top", 0)),
                            int(box.get("right", 0)),
                            int(box.get("bottom", 0)),
                        ]
                        for _, _, box in ocr_bboxes
                    ],
                    dtype=np.float32,
                )

                # Calculate max IOUs efficiently
                if len(tree_bboxes) > 0:
                    max_ious = box_iou(tree_bboxes, ocr_boxes_array).max(axis=0)
                else:
                    max_ious = np.zeros(len(ocr_boxes_array))

                # Process boxes with low IOU
                for idx, ((_, content, box), max_iou) in enumerate(
                    zip(ocr_bboxes, max_ious)
                ):
                    if max_iou < 0.1:
                        x1 = int(box.get("left", 0))
                        y1 = int(box.get("top", 0))
                        x2 = int(box.get("right", 0))
                        y2 = int(box.get("bottom", 0))

                        linearized_accessibility_tree.append(
                            f"{preserved_nodes_index}\tAXButton\t\t{content}\t\t"
                        )

                        node = {
                            "position": (x1, y1),
                            "size": (x2 - x1, y2 - y1),
                            "title": "",
                            "text": content,
                            "role": "AXButton",
                        }
                        preserved_nodes.append(node)
                        preserved_nodes_index += 1

        return linearized_accessibility_tree, preserved_nodes

    def linearize_and_annotate_tree(
        self, obs: Dict, show_all_elements: bool = False
    ) -> str:
        accessibility_tree = obs["accessibility_tree"]
        screenshot = obs["screenshot"]
        self.top_app = (
            NSWorkspace.sha
```

### Core Architecture Module: `gui_agents/s1/aci/WindowsOSACI.py`
```
import base64
import os
import platform
from typing import Any, Dict, List, Tuple

import numpy as np
import psutil
import requests
from gui_agents.s1.utils.common_utils import box_iou

if platform.system() == "Windows":
    import pywinauto
    from pywinauto import Desktop
    import win32gui
    import win32process

from gui_agents.s1.aci.ACI import ACI, agent_action


# Helper functions
def _normalize_key(key: str) -> str:
    """Convert 'ctrl' to 'control' for pyautogui compatibility"""
    return "ctrl" if key == "control" else key


def list_apps_in_directories():
    directories_to_search = [
        os.environ.get("PROGRAMFILES", "C:\\Program Files"),
        os.environ.get("PROGRAMFILES(X86)", "C:\\Program Files (x86)"),
    ]
    apps = []
    for directory in directories_to_search:
        if os.path.exists(directory):
            for root, dirs, files in os.walk(directory):
                for file in files:
                    if file.endswith(".exe"):
                        apps.append(file)
    return apps


# WindowsACI Class
class WindowsACI(ACI):
    def __init__(self, top_app_only: bool = True, ocr: bool = False):
        super().__init__(top_app_only=top_app_only, ocr=ocr)
        self.nodes = []
        self.all_apps = list_apps_in_directories()

    def get_active_apps(self, obs: Dict) -> List[str]:
        return UIElement.get_current_applications(obs)

    def get_top_app(self, obs: Dict) -> str:
        return UIElement.get_top_app(obs)

    def preserve_nodes(self, tree, exclude_roles=None):
        if exclude_roles is None:
            exclude_roles = set()

        preserved_nodes = []

        def traverse_and_preserve(element):
            role = element.role()

            if role not in exclude_roles:
                position = element.position()
                size = element.size()
                if position and size:
                    x, y = position
                    w, h = size

                    if x >= 0 and y >= 0 and w > 0 and h > 0:
                        preserved_nodes.append(
                            {
                                "position": (x, y),
                                "size": (w, h),
                                "title": element.title(),
                                "text": element.text(),
                                "role": role,
                            }
                        )

            children = element.children()
            if children:
                for child_element in children:
                    traverse_and_preserve(child_element)

        traverse_and_preserve(tree)
        return preserved_nodes

    def extract_elements_from_screenshot(self, screenshot: bytes) -> Dict[str, Any]:
        url = os.environ.get("OCR_SERVER_ADDRESS")
        if not url:
            raise EnvironmentError("OCR SERVER ADDRESS NOT SET")

        encoded_screenshot = base64.b64encode(screenshot).decode("utf-8")
        response = requests.post(url, json={"img_bytes": encoded_screenshot})

        if response.status_code != 200:
            return {
                "error": f"Request failed with status code {response.status_code}",
                "results": [],
            }
        return response.json()

    def add_ocr_elements(
        self,
        screenshot,
        linearized_accessibility_tree: List[str],
        preserved_nodes: List[Dict],
    ) -> Tuple[List[str], List[Dict]]:
        """
        Add OCR-detected elements to the accessibility tree if they don't overlap with existing elements
        Uses optimized NumPy implementation
        """
        # Convert preserved nodes to numpy array of bounding boxes
        if preserved_nodes:
            tree_bboxes = np.array(
                [
                    [
                        node["position"][0],
                        node["position"][1],
                        node["position"][0] + node["size"][0],
                        node["position"][1] + node["size"][1],
                    ]
                    for node in preserved_nodes
                ],
                dtype=np.float32,
            )
        else:
            tree_bboxes = np.empty((0, 4), dtype=np.float32)

        try:
            ocr_bboxes = self.extract_elements_from_screenshot(screenshot)
        except Exception as e:
            print(f"Error: {e}")
            ocr_bboxes = []
        else:
            if ocr_bboxes:
                preserved_nodes_index = len(preserved_nodes)

                # Convert OCR boxes to numpy array
                ocr_boxes_array = np.array(
                    [
                        [
                            int(box.get("left", 0)),
                            int(box.get("top", 0)),
                            int(box.get("right", 0)),
                            int(box.get("bottom", 0)),
                        ]
                        for _, _, box in ocr_bboxes["results"]
                    ],
                    dtype=np.float32,
                )

                # Calculate max IOUs efficiently
                if len(tree_bboxes) > 0:
                    max_ious = box_iou(tree_bboxes, ocr_boxes_array).max(axis=0)
                else:
                    max_ious = np.zeros(len(ocr_boxes_array))

                # Process boxes with low IOU
                for idx, ((_, content, box), max_iou) in enumerate(
                    zip(ocr_bboxes["results"], max_ious)
                ):
                    if max_iou < 0.1:
                        x1 = int(box.get("left", 0))
                        y1 = int(box.get("top", 0))
                        x2 = int(box.get("right", 0))
                        y2 = int(box.get("bottom", 0))

                        linearized_accessibility_tree.append(
                            f"{preserved_nodes_index}\tButton\t\t{content}\t\t"
                        )

                        node = {
                            "position": (x1, y1),
                            "size": (x2 - x1, y2 - y1),
                            "title": "",
                            "text": content,
                            "role": "Button",
                        }
                        preserved_nodes.append(node)
                        preserved_nodes_index += 1

        return linearized_accessibility_tree, preserved_nodes

    def linearize_and_annotate_tree(
        self, obs: Dict, show_all_elements: bool = False
    ) -> str:
        desktop = Desktop(backend="uia")
        try:
            tree = desktop.window(
                handle=win32gui.GetForegroundWindow()
            ).wrapper_object()
        except Exception as e:
            print(f"Error accessing foreground window: {e}")
            self.nodes = []
            return ""

        exclude_roles = ["Pane", "Group", "Unknown"]
        preserved_nodes = self.preserve_nodes(UIElement(tree), exclude_roles).copy()

        if not preserved_nodes and show_all_elements:
            preserved_nodes = self.preserve_nodes(
                UIElement(tree), exclude_roles=[]
            ).copy()

        tree_elements = ["id\trole\ttitle\ttext"]
        for idx, node in enumerate(preserved_nodes):
            tree_elements.append(
                f"{idx}\t{node['role']}\t{node['title']}\t{node['text']}"
            )

        if self.ocr:
            screenshot = obs.get("screenshot", None)
            if screenshot is not None:
                # return tree_elements, preserved_nodes
                tree_elements, preserved_nodes = self.add_ocr_elements(
                    screenshot, tree_elements, preserved_nodes
                )

        self.nodes = preserved_nodes
        return "\n".join(tree_elements)

    def find_element(self, element_id: int) -> Dict:
        if not self.nodes:
            print("No elements found in the accessibility tree.")
            raise IndexError("No elements to select.")
        try:
            return self.nodes[element_id]
        except IndexError:
```

### Core Architecture Module: `gui_agents/s1/aci/windowsagentarena/GroundingAgent.py`
```
import base64
import logging
import os
import time
import xml.etree.ElementTree as ET
from typing import Dict, List, Tuple
import numpy as np
import requests
from gui_agents.s1.utils.common_utils import box_iou

logger = logging.getLogger("desktopenv.agent")


state_ns = "uri:deskat:state.at-spi.gnome.org"
component_ns = "uri:deskat:component.at-spi.gnome.org"


# Agent action decorator
def agent_action(func):
    func.is_agent_action = True
    return func


class GroundingAgent:
    def __init__(self, vm_version: str, top_app=None, top_app_only=True, ocr=True):
        self.active_apps = set()
        self.top_app = top_app
        self.top_app_only = (
            top_app_only  # Only include top app in the accessibility tree
        )
        self.ocr = ocr
        self.index_out_of_range_flag = False
        self.app_setup_code = f"""import subprocess;
import difflib;
import pyautogui;
pyautogui.press('escape');
time.sleep(0.5);
output = subprocess.check_output(['wmctrl', '-lx']);
output = output.decode('utf-8').splitlines();
window_titles = [line.split(None, 4)[2] for line in output];
closest_matches = difflib.get_close_matches('APP_NAME', window_titles, n=1, cutoff=0.1);
if closest_matches:
    closest_match = closest_matches[0];
    for line in output:
        if closest_match in line:
            window_id = line.split()[0]
            break;
subprocess.run(['wmctrl', '-ia', window_id])
subprocess.run(['wmctrl', '-ir', window_id, '-b', 'add,maximized_vert,maximized_horz'])
"""

        self.top_active_app = None
        self.notes = []
        self.clipboard = ""

        # TODO: this is terrible, fix this
        # global state_ns, component_ns, attributes_ns, value_ns
        # if vm_version == "old":
        #     state_ns = "uri:deskat:state.at-spi.gnome.org"
        #     component_ns = "uri:deskat:component.at-spi.gnome.org"
        # elif vm_version == 'win':
        #     state_ns = "uri:deskat:state.at-spi.gnome.org"
        #     component_ns = "uri:deskat:component.at-spi.gnome.org"
        # else:
        #     attributes_ns = "https://accessibility.windows.example.org/ns/attributes"
        #     state_ns = "https://accessibility.ubuntu.example.org/ns/state"
        #     component_ns = "https://accessibility.ubuntu.example.org/ns/component"
        #     value_ns = "https://accessibility.ubuntu.example.org/ns/value"

    def get_current_applications(self, obs):
        tree = ET.ElementTree(ET.fromstring(obs["accessibility_tree"]))
        apps = []
        root = tree.getroot()
        for item in root:
            apps.append(item.get("name", "").replace("\\", ""))
        return apps

    def check_new_apps(self, old_apps, new_apps):
        return new_apps - old_apps

    def find_active_applications(self, tree):
        # names of applications to keep TODO: soffice is a single application with all the isntances like impress, calc etc. being frames this will need to be dealt with separately
        to_keep = ["Program Manager"]
        apps_with_active_tag = []
        for application in list(tree.getroot()):
            app_name = application.get("name")
            for frame in application:
                is_active = frame.attrib.get("{{{:}}}active".format(state_ns), "false")
                if is_active == "true":
                    apps_with_active_tag.append(app_name)
        print(apps_with_active_tag)
        if apps_with_active_tag:
            to_keep.append(apps_with_active_tag[-1])
        return to_keep

    def filter_active_app(self, tree):
        for application in list(tree.getroot()):
            app_name = application.attrib.get("name")
            for frame in application:
                is_active = frame.attrib.get("{{{:}}}active".format(state_ns), "false")
                if is_active == "true":
                    return app_name
        return None

    def filter_nodes(self, tree, show_all=False):
        # created and populate a preserved nodes list which filters out unnecessary elements and keeps only those elements which are currently showing on the screen
        # TODO: include offscreen elements and then scroll to them before clicking
        preserved_nodes = []
        exclude_tags = ["panel", "window", "filler", "frame", "separator", "scroll-bar"]

        for node in tree.iter():
            if node.tag not in exclude_tags:
                if show_all:
                    if node.attrib.get(f"{{{state_ns}}}enabled") == "true":
                        coords: Tuple[int, int] = eval(
                            node.get(
                                "{{{:}}}screencoord".format(component_ns), "(-1, -1)"
                            )
                        )
                        if coords[0] >= 0 and coords[1] >= 0:
                            preserved_nodes.append(node)
                # if show_all is false, only show elements that are currently showing on screen
                else:
                    if node.attrib.get(f"{{{state_ns}}}visible") == "true":
                        coords: Tuple[int, int] = eval(
                            node.get(
                                "{{{:}}}screencoord".format(component_ns), "(-1, -1)"
                            )
                        )

                        if coords[0] >= 0 and coords[1] >= 0:
                            preserved_nodes.append(node)
        return preserved_nodes

    def linearize_tree(self, preserved_nodes):
        # TODO: Run an ablation to check if class and desc
        # linearized_accessibility_tree = ["id\ttag\tname\ttext\tclass\tdescription"]
        linearized_accessibility_tree = ["id\ttag\tname\ttext"]
        for idx, node in enumerate(preserved_nodes):
            if node.text:
                text = (
                    node.text
                    if '"' not in node.text
                    else '"{:}"'.format(node.text.replace('"', '""'))
                )
            else:
                text = '""'

            linearized_accessibility_tree.append(
                "{:}\t{:}\t{:}\t{:}".format(
                    idx,
                    node.tag,
                    node.get("name", ""),
                    text,
                    # node.get("{{{:}}}class".format(attributes_ns), ""),
                    # node.get("{{{:}}}description".format(attributes_ns), ""),
                )
            )

        # returning list of linearized elements
        return linearized_accessibility_tree

    def extract_elements_from_screenshot(self, screenshot) -> Dict:
        """Uses paddle-ocr to extract elements with text from the screenshot. The elements will be added to the linearized accessibility tree downstream"""

        # Convert screenshot to PIL image
        def send_image_to_ocr(screenshot) -> Dict:

            # url = os.environ.get("OCR_SERVER_ADDRESS", "")
            url = "http://127.0.0.1:8083/ocr/"
            if url == "":
                raise Exception("OCR SERVER ADDRESS NOT SET")
            encoded_screenshot = base64.b64encode(screenshot).decode("utf-8")
            data = {"img_bytes": encoded_screenshot}
            response = requests.post(url, json=data)

            if response.status_code == 200:
                return response.json()
            else:
                return {
                    "error": f"Request failed with status code {response.status_code}",
                    "results": [],
                }

        return send_image_to_ocr(screenshot)["results"]

    def add_ocr_elements(
        self, screenshot, linearized_accessibility_tree, preserved_nodes
    ):
        # Get the bounding boxes of the elements in the linearized accessibility tree
        tree_bboxes = []
        for node in preserved_nodes:
            coordinates: Tuple[int, int] = eval(
                node.get("{{{:}}}screencoord".format(component_ns), "(-1, -1)")
            )
            sizes: Tuple[int, int] = eval(
                node.get("{{{:}}}size".format(component_
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #217** (2026-09-19): **Deleted**
  *Symptoms*: Deleted

- **Issue #215** (2026-09-05): **Update README.md**
  *Symptoms*: 

- **Issue #206** (2026-07-14): **Add observation-only Agent S MCP runtime**
  *Symptoms*: 

- **Issue #194** (2026-05-13): **chore: apply black formatting to gui_agents (unblock CI)**
  *Symptoms*: ## Summary - Runs `black gui_agents` to bring 8 long-unformatted files into compliance with the lint workflow. - Pure formatting — verified AST-identical to the prior state for every file. No behavior change.  ## Why now The `lint` workflow (`black --check gui_agents`) only runs when a push/PR touches `gui_agents/**`. From mid-January to last night, no `main` push hit that path, so accumulated formatting drift went unnoticed. The first `gui_agents/**` push of 2026 (Ollama merge #163) flipped main red, and the subsequent #157 merge stayed red.  ## Files reformatted - `gui_agents/s1/core/ProceduralMemory.py` - `gui_agents/s2/agents/worker.py` - `gui_agents/s2/memory/procedural_memory.py` - `gui_agents/s2_5/agents/worker.py` - `gui_agents/s2_5/memory/procedural_memory.py` - `gui_agents/s3/agents/worker.py` - `gui_agents/s3/bbon/behavior_narrator.py` - `gui_agents/s3/memory/procedural_memory.py`  ## Test plan - [x] `black --check gui_agents` is green locally (black 26.3.1, same version CI installs). - [x] AST-equality check across every modified file: identical before/after. - [ ] CI confirms green on this PR.

- **Issue #193** (2026-05-07): **Add Docker/KVM env backends + OSWorld provider scaffolds**
  *Symptoms*: Adds opt-in non-host environment backends to Agent-S so it can drive a podman/docker container or a KVM/libvirt guest in addition to the current local-display path.  ## Summary  - \`gui_agents/s3/utils/docker_env.py\` — \`DockerEnv\`/\`DockerController\` route bash + python execution into a docker or podman container via \`exec\`. \`screenshot()\` runs \`PIL.ImageGrab.grab()\` inside the container (fallback: \`xwd\`) and pipes a base64 PNG back. \`screen_size()\` uses \`xdpyinfo\`.  - \`gui_agents/s3/utils/kvm_env.py\` — \`KvmEnv\`/\`KvmController\` with two transports for KVM/libvirt guests:     - **ssh** (default, recommended): \`ssh user@host CMD\`. Most robust if the guest sshd is reachable.     - **qga**: \`virsh qemu-agent-command DOMAIN '{\"execute\":\"guest-exec\",...}'\` + poll \`guest-exec-status\`. No networking needed but requires \`qemu-guest-agent\` in the guest.   \`DISPLAY\` + \`XAUTHORITY\` env vars propagate to remote exec so generated \`pyautogui.click(...)\` lands on the guest's X session.  - \`gui_agents/s3/cli_app.py\`:     - \`--env_backend {local,docker,podman,kvm}\` + per-backend flags (\`--container\`, \`--container_user\`, \`--kvm_ssh_*\`, \`--kvm_display\`, \`--kvm_xauthority\`, ...).     - When \`code_env\` is set, screenshots and the generated pyautogui code go through the backend instead of the host display.     - **Bug fix**: skips the \`zenity --info \"Task Completed\"\` dialog when the host has no \`DISPLAY\`. zenity blocks ~25 s before faili
  **Post-Mortem & Fix Analysis**:
  > Closing — keeping the env-backend additions in our fork (vikranth22446/Agent-S @ add-env-backends) for now.

- **Issue #189** (2026-08-04): **Feature: Governance controls for computer-using agents**
  *Symptoms*: Computer-using agents have the highest risk surface of any agent type - they can interact with any GUI element. Runtime governance is critical: which apps can the agent access, which actions require approval, and is there proof of what the agent did.  asqav (pip install asqav) provides policy enforcement and signed audit trails. For Agent-S, this could gate screen interactions behind configurable policies and log every action cryptographically. Would you be interested in an integration?
  **Post-Mortem & Fix Analysis**:
  > Computer-using agents probably need stronger governance than ordinary tool-calling agents because the action space is open-ended and GUI state can hide side effects.  I would model controls at a few levels:  - app/window allowlists and deny lists - action class: observe, click, type, submit, delete, purchase, publish - confirmation gates for irreversible or external actions - screen/action receipts for replay - redaction rules before screenshots or OCR go back to the model  The important question is not only "did the agent do the task?" but "was it allowed to touch that surface in that state?"  I am working on a broader enterprise AI OS architecture where computer-use agents are one execution surface inside a governance/workflow/audit control plane: https://github.com/hegu-1/enterprise-ai-os-architecture

- **Issue #187** (2026-04-02): **Sidebar broken Windows 11**
  *Symptoms*: # Issue Report: Sidebar/Hamburger Menu Not Accessible in Windows App  | Field    | Detail                | |----------|-----------------------| | Date     | 2025-01-XX            | | Platform | Windows 11            | | App      | Simular Windows GUI   | | User     | simularuser           |  ---  ## Problem Summary  The left sidebar (conversation list) in the Simular Windows app is collapsed/hidden by default and cannot be expanded using any standard UI patterns or keyboard shortcuts.  ## Expected Behavior  User should be able to expand the sidebar to:  - View list of previous conversations - Switch between conversation threads - Access conversation search functionality  ## Actual Behavior  Sidebar is hidden with no visible way to expand it. All attempted methods failed.  ### Failed Expansion Methods  | Method | Result | |--------|--------| | Hamburger menu icon (three horizontal lines ☰) | Not visible/clickable at top-left | | Drag right edge of hidden sidebar | No grab handle visible | | Keyboard shortcut `Ctrl + B` | No effect | | Keyboard shortcut `Ctrl + Alt + B` | No effect | | View menu option | Not found in available menus | | Small arrow on left edge | Not present |  ## User Impact  - Cannot access previous conversation history - Cannot switch between conversation threads - Must use single conversation thread only - Makes app significantly less useful for ongoing multi-topic work  ## UI Context  - App appears to default to sidebar-hidden state - No visual indicator t
  **Post-Mortem & Fix Analysis**:
  > can close this issue, resolved with the user directly on discord

- **Issue #186** (2026-04-02): **Code execution tool broken**
  *Symptoms*: # Issue Report: Code Execution Tool Failure  | Field    | Value        | |----------|--------------| | Date     | 2025-01-XX   | | Platform | Windows 11   | | User     | simularuser  |  ---  ## Problem Summary  The JavaScript code execution tool (`execute`) is non-functional. All attempts to run JavaScript code return syntax errors at character position `1:8` to `1:11`, regardless of code validity.  ## Error Pattern  Every code execution attempt fails with:  ``` SyntaxError: Missing semicolon. (1:X) ```  Where `X` ranges from **8 to 11** depending on the command.  ---  ## Attempted Solutions (All Failed)  ### 1. Simple `exec()` commands  ```javascript var result = await exec({ command: "echo test" }); console.log(result); ```  **Result:** `SyntaxError at 1:10`  ### 2. Browser automation commands  ```javascript var tabs = await browser.listTabs(); console.log(tabs); ```  **Result:** `SyntaxError at 1:0`  ### 3. Desktop automation  ```javascript click({ concept: "button", mode: 'vision' }); ```  **Result:** `SyntaxError`  ### 4. Various escape patterns tried  - Single vs double quotes - Removing comments - Stripping special characters - Minimal one-liners - No semicolons, explicit semicolons  All resulted in the same syntax error.  ---  ## Impact  Complete inability to:  - Install software (attempted Notepad++) - Search filesystem for files - Read/write files to disk - Interact with browser tabs - Execute any shell commands - Access desktop UI elements  ### Working Operations  
  **Post-Mortem & Fix Analysis**:
  > @Hunta thanks for taking the time to file the report, I'll investigate into this. Please respond to my message on Discord. I need more information to investigate 
  > @chenchenSimular thank you, Discord username is: `crony_aliclan`.
  > can close this issue, resolved with the user directly on discord

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

### Incident Patch 1: `231fc86e` (2026-05-13)
**Commit Message**: Fix missing time imports on Linux grounding actions and place_text closure (#157)

Adds missing `import time` for the Linux `open()` action and `UBUNTU_APP_SETUP` script, and refactors `place_text` in `behavior_narrator` to take explicit x,y parameters instead of capturing loop variables.

**File**: `gui_agents/s3/agents/grounding.py` (modified, +2/-1)
```diff
@@ -30,6 +30,7 @@ def agent_action(func):
 UBUNTU_APP_SETUP = f"""import subprocess;
 import difflib;
 import pyautogui;
+import time;
 pyautogui.press('escape');
 time.sleep(0.5);
 output = subprocess.check_output(['wmctrl', '-lx']);
@@ -394,7 +395,7 @@ def open(self, app_or_filename: str):
             app_or_filename:str, the name of the application or filename to open
         """
         if self.platform == "linux":
-            return f"import pyautogui; pyautogui.hotkey('win'); time.sleep(0.5); pyautogui.write({repr(app_or_filename)}); time.sleep(1.0); pyautogui.hotkey('enter'); time.sleep(0.5)"
+            return f"import pyautogui; import time; pyautogui.hotkey('win'); time.sleep(0.5); pyautogui.write({repr(app_or_filename)}); time.sleep(1.0); pyautogui.hotkey('enter'); time.sleep(0.5)"
         elif self.platform == "darwin":
             return f"import pyautogui; import time; pyautogui.hotkey('command', 'space', interval=0.5); pyautogui.typewrite({repr(app_or_filename)}); pyautogui.press('enter'); time.sleep(1.0)"
         elif self.platform == "windows":
```

**File**: `gui_agents/s3/bbon/behavior_narrator.py` (modified, +9/-9)
```diff
@@ -48,31 +48,31 @@ def mark_action(mouse_actions: list[str], img: Image):
             width = max(0, min(img.width - 1, width))
             height = max(0, min(img.height - 1, height))
 
-            def place_text(label, color):
+            def place_text(label, color, x, y):
                 bbox = draw.textbbox((0, 0), label, font=font)
                 text_w, text_h = (
                     bbox[2] - bbox[0],
                     bbox[3] - bbox[1],
                 )  # Measure text size
                 offset_x, offset_y = -5, 5  # Default offset
-                if width + offset_x + text_w > img.width:  # Out of bounds on right
+                if x + offset_x + text_w > img.width:  # Out of bounds on right
                     offset_x = -text_w - 5
-                if height + offset_y + text_h > img.height:  # Out of bounds on bottom
+                if y + offset_y + text_h > img.height:  # Out of bounds on bottom
                     offset_y = -text_h - 5
-                if width + offset_x < 0:  # Out of bounds on left
+                if x + offset_x < 0:  # Out of bounds on left
                     offset_x = 5
-                if height + offset_y < 0:  # Out of bounds on top
+                if y + offset_y < 0:  # Out of bounds on top
                     offset_y = 5
                 draw.text(
-                    (width + offset_x, height + offset_y), label, fill=color, font=font
+                    (x + offset_x, y + offset_y), label, fill=color, font=font
                 )
 
             if mouse_action.startswith("pyautogui.click"):
                 draw.circle((width, height), radius=3, fill=(255, 0, 0))
-                place_text("Click", (255, 0, 0))
+                place_text("Click", (255, 0, 0), width, height)
             if mouse_action.startswith("pyautogui.moveTo"):
                 draw.circle((width, height), radius=3, fill=(0, 0, 255))
-                place_text("MoveTo", (0, 0, 255))
+                place_text("MoveTo", (0, 0, 255), width, height)
                 drag_start_height, drag_start_width = height, width
             if mouse_action.startswith("pyautogui.dragTo"):
                 draw.line(
@@ -81,7 +81,7 @@ def place_text(label, color):
                     width=2,
                 )
                 draw.circle((width, height), radius=3, fill=(0, 255, 0))
-                place_text("DragTo", (0, 255, 0))
+                place_text("DragTo", (0, 255, 0), width, height)
 
     @staticmethod
     def get_mouse_action_representation(mouse_actions: list[str]) -> str:
```

---

### Incident Patch 2: `000dd370` (2026-01-19)
**Commit Message**: fix: clean up test env and normalize ollama param checks

**File**: `gui_agents/s3/core/mllm.py` (modified, +2/-2)
```diff
@@ -37,7 +37,7 @@ def __init__(self, engine_params=None, system_prompt=None, engine=None):
                     self.engine = LMMEngineParasail(**engine_params)
                 elif engine_type == "ollama":
                     # Reuse LMMEngineOpenAI for Ollama
-                    if "base_url" not in engine_params:
+                    if not engine_params.get("base_url"):
                         import os
 
                         base_url = os.getenv("OLLAMA_HOST")
@@ -50,7 +50,7 @@ def __init__(self, engine_params=None, system_prompt=None, engine=None):
                             raise ValueError(
                                 "Ollama endpoint must be provided via 'base_url' parameter or 'OLLAMA_HOST' environment variable."
                             )
-                    if "api_key" not in engine_params:
+                    if not engine_params.get("api_key"):
                         engine_params["api_key"] = "ollama"
                     self.engine = LMMEngineOpenAI(**engine_params)
                 elif engine_type == "deepseek":
```

**File**: `tests/test_providers.py` (modified, +4/-0)
```diff
@@ -14,6 +14,10 @@ def setUp(self):
             del os.environ["DEEPSEEK_API_KEY"]
         if "QWEN_API_KEY" in os.environ:
             del os.environ["QWEN_API_KEY"]
+        if "DEEPSEEK_ENDPOINT_URL" in os.environ:
+            del os.environ["DEEPSEEK_ENDPOINT_URL"]
+        if "QWEN_ENDPOINT_URL" in os.environ:
+            del os.environ["QWEN_ENDPOINT_URL"]
 
     def test_ollama_missing_config(self):
         """Test that Ollama raises ValueError if no endpoint is provided"""
```

---

### Incident Patch 3: `b6601890` (2026-01-19)
**Commit Message**: fix: address review comments (robust params, url normalization, cleanup)

**File**: `gui_agents/s3/core/mllm.py` (modified, +9/-4)
```diff
@@ -60,8 +60,11 @@ def __init__(self, engine_params=None, system_prompt=None, engine=None):
                         base_url = os.getenv("DEEPSEEK_ENDPOINT_URL")
                         if not base_url:
                             base_url = "https://api.deepseek.com"
+                        if not base_url.endswith("/v1"):
+                            base_url = base_url.rstrip("/") + "/v1"
                         engine_params["base_url"] = base_url
-                    if "api_key" not in engine_params:
+
+                    if not engine_params.get("api_key"):
                         import os
 
                         api_key = os.getenv("DEEPSEEK_API_KEY")
@@ -73,16 +76,19 @@ def __init__(self, engine_params=None, system_prompt=None, engine=None):
 
                     self.engine = LMMEngineOpenAI(**engine_params)
                 elif engine_type == "qwen":
-                    if "base_url" not in engine_params:
+                    if not engine_params.get("base_url"):
                         import os
 
                         base_url = os.getenv("QWEN_ENDPOINT_URL")
                         if not base_url:
                             base_url = (
                                 "https://dashscope.aliyuncs.com/compatible-mode/v1"
                             )
+                        if not base_url.endswith("/v1"):
+                            base_url = base_url.rstrip("/") + "/v1"
                         engine_params["base_url"] = base_url
-                    if "api_key" not in engine_params:
+
+                    if not engine_params.get("api_key"):
                         import os
 
                         api_key = os.getenv("QWEN_API_KEY")
@@ -186,7 +192,6 @@ def add_message(
                 LMMEngineGemini,
                 LMMEngineOpenRouter,
                 LMMEngineParasail,
-                LMMEngineParasail,
             ),
         ):
             # infer role from previous message
```

**File**: `tests/test_providers.py` (modified, +1/-1)
```diff
@@ -49,7 +49,7 @@ def test_deepseek_init(self):
             )
             self.assertIsInstance(agent.engine, LMMEngineOpenAI)
             # Default URL
-            self.assertEqual(agent.engine.base_url, "https://api.deepseek.com")
+            self.assertEqual(agent.engine.base_url, "https://api.deepseek.com/v1")
             # (Note: engine.py logic resolves default at generate() time or if client created,
             # but init just stores what's passed. Let's verify prompt generation to ensure it doesn't crash on init)
 
```

---

### Incident Patch 4: `8644eb88` (2026-01-14)
**Commit Message**: Merge pull request #170 from simular-ai/011425-bugfix-cli-app

fix to follow style guideline for our linter

**File**: `gui_agents/s3/cli_app.py` (modified, +1/-0)
```diff
@@ -393,5 +393,6 @@ def main():
         if response.lower() != "y":
             break
 
+
 if __name__ == "__main__":
     main()
```

---

### Incident Patch 5: `404f1e87` (2026-01-14)
**Commit Message**: fix to follow style guideline

**File**: `gui_agents/s3/cli_app.py` (modified, +1/-0)
```diff
@@ -393,5 +393,6 @@ def main():
         if response.lower() != "y":
             break
 
+
 if __name__ == "__main__":
     main()
```

---

### Incident Patch 6: `53c23628` (2026-01-14)
**Commit Message**: Merge pull request #169 from simular-ai/011425-bugfix-cli-app

fix undefined variable in cli app

**File**: `gui_agents/s3/cli_app.py` (modified, +1/-1)
```diff
@@ -378,7 +378,7 @@ def main():
     # handle query from command line
     if isinstance(task, str) and task.strip():
         agent.reset()
-        run_agent(agent, query, scaled_width, scaled_height)
+        run_agent(agent, task, scaled_width, scaled_height)
         return
 
     while True:
```

---

### Incident Patch 7: `bdebcc90` (2026-01-14)
**Commit Message**: fix undefined variable in cli app

**File**: `gui_agents/s3/cli_app.py` (modified, +1/-1)
```diff
@@ -378,7 +378,7 @@ def main():
     # handle query from command line
     if isinstance(task, str) and task.strip():
         agent.reset()
-        run_agent(agent, query, scaled_width, scaled_height)
+        run_agent(agent, task, scaled_width, scaled_height)
         return
 
     while True:
```

---

### Incident Patch 8: `234450bb` (2026-01-13)
**Commit Message**: fix: restore OLLAMA_HOST env var support

**File**: `gui_agents/s3/core/mllm.py` (modified, +8/-1)
```diff
@@ -39,7 +39,14 @@ def __init__(self, engine_params=None, system_prompt=None, engine=None):
                 elif engine_type == "ollama":
                     # Reuse LMMEngineOpenAI for Ollama, defaulting to localhost if not specified
                     if "base_url" not in engine_params:
-                        engine_params["base_url"] = "http://localhost:11434/v1"
+                        import os
+                        base_url = os.getenv("OLLAMA_HOST")
+                        if base_url:
+                            if not base_url.endswith("/v1"):
+                                base_url = base_url.rstrip("/") + "/v1"
+                            engine_params["base_url"] = base_url
+                        else:
+                            engine_params["base_url"] = "http://localhost:11434/v1"
                     if "api_key" not in engine_params:
                         engine_params["api_key"] = "ollama"
                     self.engine = LMMEngineOpenAI(**engine_params)
```

---

### Incident Patch 9: `c55f3947` (2025-12-30)
**Commit Message**: fix: forward **kwargs to chat.completions.create() for Ollama engine

This ensures consistency with other engine implementations (OpenAI, Gemini,
OpenRouter, etc.) and allows callers to pass additional parameters like
stop, top_p, etc.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>

**File**: `gui_agents/s3/core/engine.py` (modified, +1/-0)
```diff
@@ -487,5 +487,6 @@ def generate(
             messages=messages,
             max_tokens=max_new_tokens if max_new_tokens else 4096,
             temperature=temp,
+            **kwargs,
         )
         return completion.choices[0].message.content
```

---

### Incident Patch 10: `a680e270` (2025-10-30)
**Commit Message**: Fix typo in worker's system prompt

Fix the apostrophe typo

**File**: `gui_agents/s3/memory/procedural_memory.py` (modified, +1/-1)
```diff
@@ -61,7 +61,7 @@ def construct_simple_worker_procedural_memory(agent_class, skipped_actions):
         - **Never use the code agent for charts, graphs, pivot tables, or visual elements—always use the GUI for those.**
         - If creating a new sheet with no name specified, use default sheet names (e.g., "Sheet1", "Sheet2", etc.).
         - After opening or reopening applications, wait at least 3 seconds for full loading.
-        - Don’t provide specific row/column numbers to the coding agent; let it infer the spreadsheet structure itself.
+        - Don't provide specific row/column numbers to the coding agent; let it infer the spreadsheet structure itself.
 
         Never assume a task is done based on appearances-always ensure the specific requested action has been performed and verify the modification. If you haven't executed any actions, the task is not complete.
 
```

#### Recent Merged Pull Requests:
- **PR #215** (2026-09-05): Update README.md (@ziqi-lydia)
- **PR #206** (closed): Add observation-only Agent S MCP runtime (@mrdavtan)
- **PR #194** (2026-05-13): chore: apply black formatting to gui_agents (unblock CI) (@eric-xw)
- **PR #193** (closed): Add Docker/KVM env backends + OSWorld provider scaffolds (@vikranth22446)
- **PR #180** (closed): fix: replace 42 bare excepts with except Exception (@haosenwang1018)
- **PR #179** (2026-02-21): Add OpenClaw integration for Agent-S GUI automation (@simularhao)
- **PR #174** (2026-01-19): chore: Update setup.py version to 0.3.2 (@Mashiro-Ethereal)
- **PR #170** (2026-01-14): fix to follow style guideline for our linter (@Richard-Simular)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

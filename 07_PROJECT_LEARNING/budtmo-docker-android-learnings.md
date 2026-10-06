# Forensic Learning Record (Deep Inspection): budtmo/docker-android

> **Canonical Artifact**: `07_PROJECT_LEARNING/budtmo-docker-android-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/budtmo/docker-android](https://github.com/budtmo/docker-android))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:15:54.607Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `budtmo/docker-android`
- **Description**: Android in docker solution with noVNC supported, video recording, mcp server and AI-agent
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 15942 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `cli/setup.py`
```
import os

from setuptools import setup, find_packages


app_version = os.getenv("DOCKER_ANDROID_VERSION", "test-version")

with open("requirements.txt", "r") as f:
    reqs = f.read().splitlines()

setup(
    name="docker-android",
    version="0.1",
    url="https://github.com/budtmo/docker-android",
    description="CLI for docker-android",
    author="Budi Utomo",
    author_email="budtmo.os@gmail.com",
    install_requires=reqs,
    packages=find_packages(where="src"),
    package_dir={"": "src"},
    py_modules=["cli", "docker-android"],
    entry_points={"console_scripts": "docker-android=app:cli"}
)
```

### Core Architecture Module: `cli/src/app.py`
```
#!/usr/bin/env python3
import subprocess
from typing import Union

import click
import logging
import os

from enum import Enum

from application import Application
from device import DeviceType
from device.emulator import Emulator
from device.geny_aws import GenyAWS
from device.geny_saas import GenySAAS
from helper import convert_str_to_bool, get_env_value_or_raise
from constants import ENV
from logger import log

log.init()
logger = logging.getLogger("App")


def get_device(given_input: str) -> Union[Emulator, GenyAWS, GenySAAS, None]:
    """
    Get Device object based on given input

    :param given_input: device in string
    :return: Platform object
    """

    input_lower = given_input.lower()

    if input_lower == DeviceType.EMULATOR.value.lower():
        emu_av = get_env_value_or_raise(ENV.EMULATOR_ANDROID_VERSION)
        emu_img_type = get_env_value_or_raise(ENV.EMULATOR_IMG_TYPE)
        emu_sys_img = get_env_value_or_raise(ENV.EMULATOR_SYS_IMG)

        emu_device = os.getenv(ENV.EMULATOR_DEVICE, "Nexus 5")
        emu_data_partition = os.getenv(ENV.EMULATOR_DATA_PARTITION, "550m")
        emu_additional_args = os.getenv(ENV.EMULATOR_ADDITIONAL_ARGS, "")

        emu_name = os.getenv(ENV.EMULATOR_NAME, "{d}_{v}".format(
            d=emu_device.replace(" ", "_").lower(), v=emu_av))
        emu = Emulator(emu_name, emu_device, emu_av, emu_data_partition,
                       emu_additional_args, emu_img_type, emu_sys_img)
        return emu
    elif input_lower == DeviceType.GENY_AWS.value.lower():
        return GenyAWS()
    elif input_lower == DeviceType.GENY_SAAS.value.lower():
        return GenySAAS()
    else:
        return None


@click.group(context_settings=dict(help_option_names=['-h', '--help']))
def cli():
    pass


def start_appium() -> None:
    if convert_str_to_bool(os.getenv(ENV.APPIUM)):
        cmd = f"/usr/local/bin/appium"
        app_appium = Application("Appium", cmd,
                                 os.getenv(ENV.APPIUM_ADDITIONAL_ARGS, ""), False)
        app_appium.start()
    else:
        logger.info("env APPIUM cannot be found, Appium is not started!")


def start_device() -> None:
    given_pt = get_env_value_or_raise(ENV.DEVICE_TYPE)
    selected_device = get_device(given_pt)
    if selected_device is None:
        raise RuntimeError(f"'{given_pt}' is invalid! Please check again!")
    selected_device.create()
    selected_device.start()
    selected_device.wait_until_ready()
    selected_device.reconfigure()
    selected_device.keep_alive()


def start_display_screen() -> None:
    cmd = "/usr/bin/Xvfb"
    args = f"{os.getenv(ENV.DISPLAY)} " \
           f"-screen {os.getenv(ENV.SCREEN_NUMBER)} " \
           f"{os.getenv(ENV.SCREEN_WIDTH)}x" \
           f"{os.getenv(ENV.SCREEN_HEIGHT)}x" \
           f"{os.getenv(ENV.SCREEN_DEPTH)}"
    d_screen = Application("d_screen", cmd, args, False)
    d_screen.start()


def start_display_wm() -> None:
    cmd = "/usr/bin/openbox-session"
    d_wm = Application("d_wm", cmd)
    d_wm.start()


def start_port_forwarder() -> None:
    import socket
    local_ip = socket.gethostbyname(socket.gethostname())
    cmd = f"/usr/bin/socat tcp-listen:5554,bind={local_ip},fork tcp:127.0.0.1:5554 & " \
          f"/usr/bin/socat tcp-listen:5555,bind={local_ip},fork tcp:127.0.0.1:5555"
    pf = Application("port_forwarder", cmd)
    pf.start()


def start_vnc_server() -> None:
    cmd = "/usr/bin/x11vnc"
    vnc_pass = os.getenv(ENV.VNC_PASSWORD)
    if vnc_pass:
        pass_path = os.path.join(os.getenv(ENV.WORK_PATH), ".vncpass")
        subprocess.check_call(f"{cmd} -storepasswd {vnc_pass} {pass_path}", shell=True)
        last_arg = f"-rfbauth {pass_path}"
    else:
        last_arg = "-nopw"

    display = os.getenv(ENV.DISPLAY)
    args = f"-display {display} -forever -shared {last_arg}"
    vnc_server = Application("vnc_web", cmd, args, False)
    vnc_server.start()


def start_vnc_web() -> None:
    if convert_str_to_bool(os.getenv(ENV.WEB_VNC)):
        vnc_port = get_env_value_or_raise(ENV.VNC_PORT)
        vnc_web_port = get_env_value_or_raise(ENV.WEB_VNC_PORT)
        cmd = "/opt/noVNC/utils/novnc_proxy"
        args = f"--vnc localhost:{vnc_port} localhost:{vnc_web_port}"
        vnc_web = Application("vnc_web", cmd, args, False)
        vnc_web.start()
    else:
        logger.info("env WEB_VNC cannot be found, VNC_WEB is not started!")


@cli.command()
@click.argument("app", type=click.Choice([app.value for app in Application.App]))
def start(app):
    selected_app = str(app).lower()
    if selected_app == Application.App.APPIUM.value.lower():
        start_appium()
    elif selected_app == Application.App.DEVICE.value.lower():
        start_device()
    elif selected_app == Application.App.DISPLAY_SCREEN.value.lower():
        start_display_screen()
    elif selected_app == Application.App.DISPLAY_WM.value.lower():
        start_display_wm()
    elif selected_app == Application.App.PORT_FORWARDER.value.lower():
        start_port_forwarder()
    elif selected_app == Application.App.VNC_SERVER.value.lower():
        start_vnc_server()
    elif selected_app == Application.App.VNC_WEB.value.lower():
        start_vnc_web()
    else:
        logger.error(f"application '{selected_app}' is not supported!")


class SharedComponent(Enum):
    LOG = "log"


def shared_log() -> None:
    if convert_str_to_bool(os.getenv(ENV.WEB_LOG)):
        from http.server import BaseHTTPRequestHandler, HTTPServer

        log_path = get_env_value_or_raise(ENV.LOG_PATH)
        log_port = int(get_env_value_or_raise(ENV.WEB_LOG_PORT))
        logger.info(f"Shared log is enabled! all logs can be found on port '{log_port}'")

        class LogSharedHandler(BaseHTTPRequestHandler):
            def do_GET(self):
                # root path
                if self.path == "/":
                    html = "<html><body>"
                    for f in os.listdir(log_path):
                        html += f"<p><a href=\"{f}\">{f}</a></p>"
                    html += "</body></html>"

                    self.send_response(200)
                    self.send_header("Content-type", "text/html")
                    self.end_headers()
                    self.wfile.write(html.encode())
                # open each selected log file
                else:
                    p = log_path + self.path
                    try:
                        with open(p, "rb") as file:
                            self.send_response(200)
                            self.send_header("Content-type", "text/plain")
                            self.end_headers()
                            self.wfile.write(file.read())
                    except FileNotFoundError:
                        self.send_error(404, "File not found")

        httpd = HTTPServer(('0.0.0.0', log_port), LogSharedHandler)
        httpd.serve_forever()
    else:
        logger.info(f"Shared log is disabled! nothing to do!")


@cli.command()
@click.argument("component", type=click.Choice([component.value for component in SharedComponent]))
def share(component):
    selected_component = str(component).lower()
    if selected_component == SharedComponent.LOG.value.lower():
        shared_log()
    else:
        logger.error(f"component '{component}' is not supported!")


if __name__ == '__main__':
    cli()

```

### Core Architecture Module: `cli/src/application/__init__.py`
```
import logging
import subprocess

from enum import Enum


class Application:
    class App(Enum):
        APPIUM = "appium"
        DEVICE = "device"
        DISPLAY_SCREEN = "display_screen"
        DISPLAY_WM = "display_wm"
        PORT_FORWARDER = "port_forwarder"
        VNC_SERVER = "vnc_server"
        VNC_WEB = "vnc_web"

    def __init__(self, name: str, command: str, additional_args: str = "", ui: bool = False) -> None:
        self.logger = logging.getLogger(self.__class__.__name__)
        self.name = name
        self.command = command
        self.additional_args = additional_args
        self.ui = ui

    def start(self) -> None:
        if self.ui:
            self.logger.info(f"{self.name} will be started with ui!")
            subprocess.check_call(f"/usr/bin/xterm -T {self.name} -n {self.name} "
                                  f"-e '{self.command} {self.additional_args}'", shell=True)
        else:
            self.logger.info(f"{self.name} will be started without ui!")
            subprocess.check_call(f"{self.command} {self.additional_args}", shell=True)

    def __repr__(self) -> str:
        return "Application(name={n}, command={c}, args={args}, ui={ui})".format(
            n=self.name, c=self.command, args=self.additional_args, ui=self.ui)

```

### Core Architecture Module: `cli/src/constants/DEVICE.py`
```
# Status
STATUS_CREATING = "CREATING"
STATUS_STARTING = "STARTING"
STATUS_BOOTING = "BOOTING"
STATUS_RECONFIGURING = "RECONFIGURING"
STATUS_READY = "READY"

```

### Core Architecture Module: `cli/src/constants/ENV.py`
```
# General
DOCKER_ANDROID_VERSION = "DOCKER_ANDROID_VERSION"
USER_BEHAVIOR_ANALYTICS = "USER_BEHAVIOR_ANALYTICS"
APPIUM = "APPIUM"
APPIUM_ADDITIONAL_ARGS = "APPIUM_ADDITIONAL_ARGS"
DISPLAY = "DISPLAY"
SCREEN_DEPTH = "SCREEN_DEPTH"
SCREEN_HEIGHT = "SCREEN_HEIGHT"
SCREEN_NUMBER = "SCREEN_NUMBER"
SCREEN_WIDTH = "SCREEN_WIDTH"
VNC_PASSWORD = "VNC_PASSWORD"
VNC_PORT = "VNC_PORT"
WEB_VNC_PORT = "WEB_VNC_PORT"
WEB_VNC = "WEB_VNC"
WORK_PATH = "WORK_PATH"
LOG_PATH = "LOG_PATH"
WEB_LOG_PORT = "WEB_LOG_PORT"
WEB_LOG = "WEB_LOG"

# Device
DEVICE_INTERVAL_WAITING = "DEVICE_INTERVAL_WAITING"
DEVICE_TYPE = "DEVICE_TYPE"

# Device (Emulator)
EMULATOR_ADDITIONAL_ARGS = "EMULATOR_ADDITIONAL_ARGS"
EMULATOR_ANDROID_VERSION = "EMULATOR_ANDROID_VERSION"
EMULATOR_DATA_PARTITION = "EMULATOR_DATA_PARTITION"
EMULATOR_DEVICE = "EMULATOR_DEVICE"
EMULATOR_IMG_TYPE = "EMULATOR_IMG_TYPE"
EMULATOR_NAME = "EMULATOR_NAME"
EMULATOR_NO_SKIN = "EMULATOR_NO_SKIN"
EMULATOR_SYS_IMG = "EMULATOR_SYS_IMG"
EMULATOR_CONFIG_PATH = "EMULATOR_CONFIG_PATH"

# Device (Genymotion - General)
GENYMOTION_TEMPLATE_PATH = "GENYMOTION_TEMPLATE_PATH"

# Device (Geny_SAAS)
GENY_SAAS_USER = "GENY_SAAS_USER"
GENY_SAAS_PASS = "GENY_SAAS_PASS"
GENY_AUTH_TOKEN = "GENY_AUTH_TOKEN"
GENY_SAAS_TEMPLATE_FILE_NAME = "saas.json"

# Device (Geny_AWS)
AWS_ACCESS_KEY_ID = "AWS_ACCESS_KEY_ID"
AWS_SECRET_ACCESS_KEY = "AWS_SECRET_ACCESS_KEY"
GENY_AWS_TEMPLATE_FILE_NAME = "aws.json"

```

### Core Architecture Module: `cli/src/constants/__init__.py`
```
UTF8 = "utf-8"

```

### Core Architecture Module: `cli/src/device/__init__.py`
```
import json
import logging
import os
import platform
import requests
import signal
import time

from abc import ABC, abstractmethod
from enum import Enum

from helper import convert_str_to_bool, get_env_value_or_raise
from constants import DEVICE, ENV


class DeviceType(Enum):
    EMULATOR = "emulator"
    GENY_SAAS = "geny_saas"
    GENY_AWS = "geny_aws"


class Device(ABC):
    FORM_ID = "1FAIpQLSdrKWQdMh6Nt8v8NQdYvTIntohebAgqWCpXT3T9NofAoxcpkw"
    FORM_USER = "user"
    FORM_CITY = "city"
    FORM_REGION = "region"
    FORM_COUNTRY = "country"
    FORM_APP_VERSION = "app_version"
    FORM_APPIUM = "appium"
    FORM_APPIUM_ADDITIONAL_ARGS = "appium_additional_args"
    FORM_WEB_LOG = "web_log"
    FORM_WEB_VNC = "web_vnc"
    FORM_SCREEN_RESOLUTION = "screen_resolution"
    FORM_DEVICE_TYPE = "device_type"
    FORM_EMU_DEVICE = "emu_device"
    FORM_EMU_ANDROID_VERSION = "emu_android_version"
    FORM_EMU_NO_SKIN = "emu_no_skin"
    FORM_EMU_DATA_PARTITION = "emu_data_partition"
    FORM_EMU_ADDITIONAL_ARGS = "emu_additional_args"

    def __init__(self) -> None:
        self.logger = logging.getLogger(self.__class__.__name__)
        self.device_type = None
        self.interval_waiting = int(os.getenv(ENV.DEVICE_INTERVAL_WAITING, 2))
        self.user_behavior_analytics = convert_str_to_bool(os.getenv(ENV.USER_BEHAVIOR_ANALYTICS, "true"))
        self.form_field = {
            Device.FORM_USER: "entry.108751316",
            Device.FORM_CITY: "entry.2083022547",
            Device.FORM_REGION: "entry.1083141079",
            Device.FORM_COUNTRY: "entry.1946159560",
            Device.FORM_APP_VERSION: "entry.818050927",
            Device.FORM_APPIUM: "entry.181610571",
            Device.FORM_APPIUM_ADDITIONAL_ARGS: "entry.727759656",
            Device.FORM_WEB_LOG: "entry.1225589007",
            Device.FORM_WEB_VNC: "entry.2055392048",
            Device.FORM_SCREEN_RESOLUTION: "entry.709976626",
            Device.FORM_DEVICE_TYPE: "entry.207096546",
            Device.FORM_EMU_DEVICE: "entry.1960740382",
            Device.FORM_EMU_ANDROID_VERSION: "entry.671872491",
            Device.FORM_EMU_NO_SKIN: "entry.403556951",
            Device.FORM_EMU_DATA_PARTITION: "entry.1052258875",
            Device.FORM_EMU_ADDITIONAL_ARGS: "entry.57529972"
        }
        self.form_data = {}
        signal.signal(signal.SIGTERM, self.tear_down)

    def set_status(self, current_status) -> None:
        bashrc_file = f"{os.getenv(ENV.WORK_PATH)}/device_status"
        with open(bashrc_file, "w+") as bf:
            bf.write(current_status)
        # It won't work using docker exec
        # os.environ[constants.ENV_DEVICE_STATUS] = current_status

    def _prepare_analytics_payload(self) -> None:
        self.form_data.update({
            self.form_field[Device.FORM_USER]: f"{platform.platform()}_{platform.version().replace(' ', '_')}",
            self.form_field[Device.FORM_APP_VERSION]: os.getenv(ENV.DOCKER_ANDROID_VERSION),
            self.form_field[Device.FORM_DEVICE_TYPE]: self.device_type,
            self.form_field[Device.FORM_WEB_VNC]: convert_str_to_bool(os.getenv(ENV.WEB_VNC)),
            self.form_field[Device.FORM_WEB_LOG]: convert_str_to_bool(os.getenv(ENV.WEB_LOG)),
            self.form_field[Device.FORM_APPIUM]: convert_str_to_bool(os.getenv(ENV.APPIUM))
        })

        try:
            res = requests.get("https://ipinfo.io")
            if res.ok:
                json_res = res.json()
                self.form_data.update({
                    self.form_field[Device.FORM_CITY]: json_res[Device.FORM_CITY],
                    self.form_field[Device.FORM_REGION]: json_res[Device.FORM_REGION],
                    self.form_field[Device.FORM_COUNTRY]: json_res[Device.FORM_COUNTRY]
                })
        except requests.exceptions.RequestException as rer:
            self.logger.warning(rer)
            pass
        except KeyError as ke:
            self.logger.warning(ke)
            pass

    def create(self) -> None:
        if self.user_behavior_analytics:
            self.logger.info("Sending user behavior analytics to improve the tool")
            try:
                form_url = f"https://docs.google.com/forms/d/e/{Device.FORM_ID}/formResponse"
                self._prepare_analytics_payload()
                requests.post(url=form_url, data=self.form_data)
            except requests.exceptions.RequestException as rer:
                self.logger.warning(rer)
                pass
        self.set_status(DEVICE.STATUS_CREATING)

    def start(self) -> None:
        self.set_status(DEVICE.STATUS_STARTING)

    def wait_until_ready(self) -> None:
        self.set_status(DEVICE.STATUS_BOOTING)

    def reconfigure(self) -> None:
        self.set_status(DEVICE.STATUS_RECONFIGURING)

    def keep_alive(self) -> None:
        self.set_status(DEVICE.STATUS_READY)
        self.logger.warning(f"{self.device_type} process will be kept alive to be able to get sigterm signal...")
        while True:
            time.sleep(2)

    @abstractmethod
    def tear_down(self, *args) -> None:
        pass


class Genymotion(Device):
    def __init__(self) -> None:
        super().__init__()
        self.logger = logging.getLogger(self.__class__.__name__)

    def get_data_from_template(self, filename: str) -> dict:
        path_template_json = os.path.join(get_env_value_or_raise(ENV.GENYMOTION_TEMPLATE_PATH), filename)
        data = {}
        if os.path.isfile(path_template_json):
            try:
                self.logger.info(path_template_json)
                with open(path_template_json, "r") as f:
                    data = json.load(f)
            except FileNotFoundError as fnf:
                self.shutdown_and_logout()
                self.logger.error(f"File cannot be found: {fnf}")
            except json.JSONDecodeError as jde:
                self.shutdown_and_logout()
                self.logger.error(f"Error Decoding Json: {jde}")
            except Exception as e:
                self.shutdown_and_logout()
                self.logger.error(e)
        else:
            self.shutdown_and_logout()
            raise RuntimeError(f"'{path_template_json}' cannot be found!")
        return data

    @abstractmethod
    def login(self) -> None:
        pass

    def create(self) -> None:
        super().create()
        self.login()

    @abstractmethod
    def shutdown_and_logout(self) -> None:
        pass

    def tear_down(self, *args) -> None:
        self.shutdown_and_logout()

```

### Core Architecture Module: `cli/src/device/emulator.py`
```
import logging
import os
import shlex
import subprocess
import time

from enum import Enum

from device import Device, DeviceType
from helper import convert_str_to_bool, get_env_value_or_raise, symlink_force
from constants import ENV, UTF8


class Emulator(Device):
    DEVICE = (
        "Nexus 4",
        "Nexus 5",
        "Nexus 7",
        "Nexus One",
        "Nexus S",
        "Samsung Galaxy S6",
        "Samsung Galaxy S7",
        "Samsung Galaxy S7 Edge",
        "Samsung Galaxy S8",
        "Samsung Galaxy S9",
        "Samsung Galaxy S10",
        "Pixel C",
        "Pixel 8",
        "Pixel 9"
    )

    API_LEVEL = {
        "9.0": "28",
        "10.0": "29",
        "11.0": "30",
        "12.0": "32",
        "13.0": "33",
        "14.0": "34"
    }

    adb_name_id = 5554

    class ReadinessCheck(Enum):
        BOOTED = "booted"
        RUN_STATE = "in running state"
        WELCOME_SCREEN = "in welcome screen"
        POP_UP_WINDOW = "pop up window"

    def __init__(self, name: str, device: str, android_version: str, data_partition: str,
                 additional_args: str, img_type: str, sys_img: str) -> None:
        super().__init__()
        self.logger = logging.getLogger(self.__class__.__name__)
        self.adb_name = f"emulator-{Emulator.adb_name_id}"
        self.device_type = DeviceType.EMULATOR.value
        self.name = name
        if device in self.DEVICE:
            self.device = device
        else:
            raise RuntimeError(f"device '{device}' is not supported!")
        if android_version in self.API_LEVEL.keys():
            self.android_version = android_version
        else:
            raise RuntimeError(f"android version '{android_version}' is not supported!")
        self.api_level = self.API_LEVEL[self.android_version]
        self.data_partition = data_partition
        self.additional_args = additional_args
        self.img_type = img_type
        self.sys_img = sys_img
        workdir = get_env_value_or_raise(ENV.WORK_PATH)
        self.path_device_profile_target = os.path.join(workdir, ".android", "devices.xml")
        self.path_emulator = os.path.join(workdir, "emulator")
        self.path_emulator_config = os.path.join(workdir, "emulator", "config.ini")
        self.path_emulator_profiles = os.path.join(workdir, "docker-android", "mixins",
                                                   "configs", "devices", "profiles")
        self.path_emulator_skins = os.path.join(workdir, "docker-android", "mixins",
                                                "configs", "devices", "skins")
        self.file_name = self.device.replace(" ", "_").lower()
        self.no_skin = convert_str_to_bool(os.getenv(ENV.EMULATOR_NO_SKIN))
        self.interval_after_booting = 15
        Emulator.adb_name_id += 2
        self.form_data.update({
            self.form_field[Device.FORM_SCREEN_RESOLUTION]: f"{os.getenv(ENV.SCREEN_WIDTH)}x"
                                                            f"{os.getenv(ENV.SCREEN_HEIGHT)}x"
                                                            f"{os.getenv(ENV.SCREEN_DEPTH)}",
            self.form_field[Device.FORM_EMU_DEVICE]: self.device,
            self.form_field[Device.FORM_EMU_ANDROID_VERSION]: self.android_version,
            self.form_field[Device.FORM_EMU_NO_SKIN]: self.no_skin,
            self.form_field[Device.FORM_EMU_DATA_PARTITION]: self.data_partition,
            self.form_field[Device.FORM_EMU_ADDITIONAL_ARGS]: self.additional_args
        })

    def is_initialized(self) -> bool:
        import re
        if os.path.exists(self.path_emulator_config):
            self.logger.info("Config file exists")
            with open(self.path_emulator_config, 'r') as f:
                if any(re.match(r'hw\.device\.name ?= ?{}'.format(self.device), line) for line in f):
                    self.logger.info("Selected device is already created")
                    return True
                else:
                    self.logger.info("Selected device is not created")
                    return False

        self.logger.info("Config file does not exist")
        return False

    def _add_profile(self) -> None:
        if "samsung" in self.device.lower():
            path_device_profile_source = os.path.join(self.path_emulator_profiles,
                                                      "{fn}.xml".format(fn=self.file_name))
            symlink_force(path_device_profile_source, self.path_device_profile_target)
            self.logger.info("Samsung device profile is linked")

    def _use_override_config(self) -> None:
        override_confg_path = os.getenv(ENV.EMULATOR_CONFIG_PATH)

        if override_confg_path is None:
            self.logger.info(f"The environment variable 'EMULATOR_CONFIG_PATH' is not set")
            return

        self.logger.info(f"Environment variable 'EMULATOR_CONFIG_PATH' found: {override_confg_path}")

        if not os.path.isfile(override_confg_path):
            self.logger.warning(f"Source file '{override_confg_path}' does not exist.")
            return

        if not os.access(override_confg_path, os.R_OK):
            self.logger.warning(f"Source file '{override_confg_path}' is not readable.")
            return

        try:
            with open(override_confg_path, 'r') as src, open(self.path_emulator_config, 'a') as dst:
                dst.write(src.read())
            self.logger.info(f"Content from '{override_confg_path}' successfully appended to '{self.path_emulator_config}'.")
        except Exception as e:
            self.logger.error(f"An error occurred while copying file content: {e}")

    def _add_skin(self) -> None:
        device_skin_path = os.path.join(
            self.path_emulator_skins, "{fn}".format(fn=self.file_name))
        with open(self.path_emulator_config, "a") as cf:
            cf.write("hw.keyboard=yes\n")
            cf.write("disk.dataPartition.size={dp}\n".format(dp=self.data_partition))
            cf.write("skin.path={sp}\n".format(
                sp="_no_skin" if self.no_skin else device_skin_path))
        self.logger.info(f"Skin is added in: '{self.path_emulator_config}'")

    def create(self) -> None:
        super().create()
        first_run = not self.is_initialized()
        if first_run:
            self.logger.info(f"Creating the {self.device_type}...")
            self._add_profile()
            creation_cmd = "avdmanager create avd -f -n {n} -b {it}/{si} " \
                           "-k 'system-images;android-{al};{it};{si}' " \
                           "-d {d} -p {pe}".format(n=self.name, it=self.img_type, si=self.sys_img,
                                                   al=self.api_level,
                                                   d=self.device.lower().replace(" ", "_") if "pixel" in self.device.lower() else self.device.replace(" ", "\ "),
                                                   pe=self.path_emulator)
            self.logger.info(f"Command to create emulator: '{creation_cmd}'")
            subprocess.check_call(creation_cmd, shell=True)
            self._add_skin()
            self._use_override_config()
            self.logger.info(f"{self.device_type} is created!")

    def change_permission(self) -> None:
        kvm_path = "/dev/kvm"
        if os.path.exists(kvm_path):
            cmds = (f"sudo chown 1300:1301 {kvm_path}",
                    "sudo sed -i '1d' /etc/passwd")
            for c in cmds:
                subprocess.check_call(c, shell=True)
            self.logger.info("KVM permission is granted!")
        else:
            raise RuntimeError("/dev/kvm cannot be found!")

    def deploy(self):
        self.logger.info(f"Deploying the {self.device_type}")

        basic_cmd = "emulator @{n}".format(n=self.name)
        basic_args = "-gpu swiftshader_indirect -accel on -writable-system -verbose"
        wipe_arg = "-wipe-data" if not self.is_initialized() else ""

        start_cmd = f"{basic_cmd} {basic_args} {wipe_arg} {self.additional_args}"
        self.logger.info(f"Command to run {self.device_type}: '{start_cmd}'")
        subprocess.Popen(shlex.split(start_cmd))

    def start(self) -> None:
        super().start()
        self.change_permission()
        self.deploy()

    def check_adb_command(self, readiness_check_type: ReadinessCheck, bash_command: str,
                          expected_keyword: str, max_attempts: int, interval_waiting_time: int,
                          adb_action: str = None) -> None:
        success = False
        for _ in range(1, max_attempts):
            if success:
                break
            else:
                try:
                    output = subprocess.check_output(
                        bash_command.split()).decode(UTF8)
                    if expected_keyword in str(output).lower():
                        if readiness_check_type is self.ReadinessCheck.POP_UP_WINDOW:
                            subprocess.check_call(adb_action, shell=True)
                        else:
                            self.logger.info(
                                f"{self.device_type} is {readiness_check_type.value}!")
                            success = True
                    else:
                        self.logger.info(f"[attempt: {_}] {self.device_type} is not {readiness_check_type.value}! "
                                         f"will check again in {interval_waiting_time} seconds")
                        time.sleep(interval_waiting_time)
                except subprocess.CalledProcessError:
                    self.logger.warning("command cannot be executed! will continue...")
                    time.sleep(2)
                    continue
        else:
            if readiness_check_type is self.ReadinessCheck.POP_UP_WINDOW:
                self.logger.info(f"Pop up windows '{expected_keyword}' is not found!")
            else:
                raise RuntimeError(
                    f"{readiness_check_type.value} is checked {_} tim
```

### Core Architecture Module: `cli/src/device/geny_aws.py`
```
import json
import logging
import os
import shutil
import subprocess
import time

from device import Genymotion, DeviceType
from helper import get_env_value_or_raise
from constants import ENV, UTF8


class GenyAWS(Genymotion):
    port = 5555

    def __init__(self) -> None:
        super().__init__()
        self.logger = logging.getLogger(self.__class__.__name__)
        self.device_type = DeviceType.GENY_AWS.value
        self.workdir = get_env_value_or_raise(ENV.WORK_PATH)
        self.aws_credentials_path = os.path.join(self.workdir, ".aws")
        self.remove_cred_at_the_end = False  # for logout
        self.geny_aws_template_path = os.path.join(self.workdir, "docker-android", "mixins",
                                                   "templates", "genymotion", "aws")
        self.created_devices = {}

    def login(self) -> None:
        aws_credentials_file = os.path.join(self.aws_credentials_path, "credentials")
        if os.path.exists(self.aws_credentials_path):
            self.logger.info(".aws is found! It will be used as credentials")
        else:
            self.logger.info(".aws cannot be found! the template will be used!")
            self.remove_cred_at_the_end = True
            aws_credentials_template_path = os.path.join(self.geny_aws_template_path, ".aws")
            shutil.move(aws_credentials_template_path, self.aws_credentials_path)

            aws_key_id = get_env_value_or_raise(ENV.AWS_ACCESS_KEY_ID)
            aws_secret_key = get_env_value_or_raise(ENV.AWS_SECRET_ACCESS_KEY)
            replacements_cred = {
                f"<{ENV.AWS_ACCESS_KEY_ID.lower()}>": aws_key_id,
                f"<{ENV.AWS_SECRET_ACCESS_KEY.lower()}>": aws_secret_key
            }
            with open(aws_credentials_file, 'r+') as cred_file:
                cred_file_contents = cred_file.read()
                for old_str, new_str in replacements_cred.items():
                    cred_file_contents = cred_file_contents.replace(old_str, new_str)
                cred_file.seek(0)
                cred_file.write(cred_file_contents)
                cred_file.truncate()
            self.logger.info("aws credentials is set!")

    def create_ssh_key(self) -> None:
        subprocess.check_call('ssh-keygen -t rsa -b 4096 -f ~/.ssh/id_rsa -N ""', shell=True)
        self.logger.info("ssh key is created!")

    def create_tf_files(self) -> None:
        try:
            for item in self.get_data_from_template(ENV.GENY_AWS_TEMPLATE_FILE_NAME):
                name = item["name"]
                region = item["region"]
                ami = item["ami"]
                instance_type = item["instance_type"]
                if "security_group" in item:
                    sg = item["security_group"]
                    tf_content = f'''
                    provider "aws" {{
                        alias  = "provider_{name}"
                        region = "{region}"
                    }}
    
                    resource "aws_key_pair" "geny_key_{name}" {{
                        provider = aws.provider_{name}
                        public_key = file("~/.ssh/id_rsa.pub")
                    }}
    
                    resource "aws_instance" "geny_aws_{name}" {{
                        provider = aws.provider_{name}
                        ami = "{ami}"
                        instance_type = "{instance_type}"
                        vpc_security_group_ids = ["{sg}"]
                        key_name = aws_key_pair.geny_key_{name}.key_name
                        tags = {{
                            Name = "DockerAndroid-GenyAWS-{ami}.id}}"
                        }}
    
                        provisioner "remote-exec" {{
                            connection {{
                                type = "ssh"
                                user = "shell"
                                host = self.public_ip
                                private_key = file("~/.ssh/id_rsa")
                            }}
                            script = "/home/androidusr/docker-android/mixins/scripts/genymotion/aws/enable_adb.sh"
                        }}
                    }}
    
                    output "public_dns_{name}" {{
                        value = aws_instance.geny_aws_{name}.public_dns
                    }}
                    '''
                else:
                    ingress_rules = json.dumps(item["ingress_rules"])
                    egress_rules = json.dumps(item["egress_rules"])
                    tf_content = f'''
                    locals {{
                        ingress_rules = {ingress_rules}
                        egress_rules = {egress_rules}
                    }}
                    
                    provider "aws" {{
                        alias  = "provider_{name}"
                        region = "{region}"
                    }}
                    
                    resource "aws_security_group" "geny_sg_{name}" {{
                        provider = aws.provider_{name}
                        dynamic "ingress" {{
                            for_each = local.ingress_rules
                            content {{
                                from_port   = ingress.value.from_port
                                to_port     = ingress.value.to_port
                                protocol    = ingress.value.protocol
                                cidr_blocks = ingress.value.cidr_blocks
                            }}
                        }}
                        
                        dynamic "egress" {{
                            for_each = local.egress_rules
                            content {{
                                from_port   = egress.value.from_port
                                to_port     = egress.value.to_port
                                protocol    = egress.value.protocol
                                cidr_blocks = egress.value.cidr_blocks
                            }}
                        }}
                    }}
        
                    resource "aws_key_pair" "geny_key_{name}" {{
                        provider = aws.provider_{name}
                        public_key = file("~/.ssh/id_rsa.pub")
                    }}
                    
                    resource "aws_instance" "geny_aws_{name}" {{
                        provider = aws.provider_{name}
                        ami = "{ami}"
                        instance_type = "{instance_type}"
                        vpc_security_group_ids = [aws_security_group.geny_sg_{name}.name]
                        key_name = aws_key_pair.geny_key_{name}.key_name
                        tags = {{
                            Name = "DockerAndroid-GenyAWS-{ami}.id}}"
                        }}
                        
                        provisioner "remote-exec" {{
                            connection {{
                                type = "ssh"
                                user = "shell"
                                host = self.public_ip
                                private_key = file("~/.ssh/id_rsa")
                            }}
                            script = "/home/androidusr/docker-android/mixins/scripts/genymotion/aws/enable_adb.sh"
                        }}
                    }}
        
                    output "public_dns_{name}" {{
                        value = aws_instance.geny_aws_{name}.public_dns
                    }}
                    '''
                tf_deployment_filename = f"{name}.tf"
                self.created_devices[name] = GenyAWS.port
                GenyAWS.port += 1
                with open(tf_deployment_filename, "w") as df:
                    df.write(tf_content)
            self.logger.info("Terraform files are created!")
        except Exception as e:
            self.logger.error(e)
            self.shutdown_and_logout()

    def deploy_tf(self) -> None:
        try:
            cmds = (
                "terraform init",
                "terraform plan",
                "terraform apply -auto-approve"
            )
            for c in cmds:
                subprocess.check_call(c, shell=True)
            self.logger.info("Genymotion-Device(s) are deployed on AWS")
        except subprocess.CalledProcessError as cpe:
            self.logger.error(cpe)
            self.shutdown_and_logout()

    def connect_with_local_adb(self) -> None:
        self.logger.info(f"created devices: {self.created_devices}")
        try:
            for d, p in self.created_devices.items():
                dns_cmd = f"terraform output public_dns_{d}"
                dns_ip = subprocess.check_output(dns_cmd.split()).decode(UTF8).replace('"', '')
                tunnel_cmd = f"ssh -i ~/.ssh/id_rsa -o ServerAliveInterval=60 -o StrictHostKeyChecking=no -q -NL " \
                             f"{p}:localhost:5555 shell@{dns_ip}"
                subprocess.Popen(tunnel_cmd.split())
                time.sleep(10)
                subprocess.check_call(f"adb connect localhost:{p} >/dev/null 2>&1", shell=True)
        except Exception as e:
            self.logger.error(e)
            self.shutdown_and_logout()

    def create(self) -> None:
        super().create()
        self.create_ssh_key()
        self.create_tf_files()
        self.deploy_tf()
        self.connect_with_local_adb()

    def shutdown_and_logout(self) -> None:
        try:
            subprocess.check_call("terraform destroy -auto-approve -lock=false", shell=True)
            self.logger.info("device(s) is successfully removed!")
        except subprocess.CalledProcessError as cpe:
            self.logger.error(cpe)
        finally:
            if self.remove_cred_at_the_end:
                subprocess.check_call(f"rm -rf {self.aws_credentials_path}", shell=True)
                self.logger.info("successfully logged out!")

```

### Core Architecture Module: `cli/src/device/geny_saas.py`
```
import logging
import os
import subprocess
import concurrent.futures
import uuid

from device import Genymotion, DeviceType
from helper import get_env_value_or_raise
from constants import ENV, UTF8

class GenySAAS(Genymotion):
    def __init__(self) -> None:
        super().__init__()
        self.logger = logging.getLogger(self.__class__.__name__)
        self.device_type = DeviceType.GENY_SAAS.value
        self.created_devices = []
    
    def login(self) -> None:
        if os.getenv(ENV.GENY_AUTH_TOKEN):
            auth_token = get_env_value_or_raise(ENV.GENY_AUTH_TOKEN)
            subprocess.check_call(f"gmsaas auth token {auth_token} > /dev/null 2>&1", shell=True)
        else:
            user = get_env_value_or_raise(ENV.GENY_SAAS_USER)
            password = get_env_value_or_raise(ENV.GENY_SAAS_PASS)
            subprocess.check_call(f"gmsaas auth login {user} {password} > /dev/null 2>&1", shell=True)
        self.logger.info("successfully logged in!")
    
    def create(self) -> None:
        super().create()
        
        # Collect all items first
        items = []
        for item in self.get_data_from_template(ENV.GENY_SAAS_TEMPLATE_FILE_NAME):
            name = ""
            template = ""
            local_port = ""
            # implement like this because local_port param is not a must
            for k, v in item.items():
                if k.lower() == "name":
                    name = v
                elif k.lower() == "template":
                    template = v
                elif k.lower() == "local_port":
                    local_port = v
                else:
                    self.logger.warning(f"'{k}' is not supported! Please check the documentation!")
            
            if not name:
                name = str(uuid.uuid4())
            
            if not template:
                self.shutdown_and_logout()
                raise RuntimeError(f"'template' is a must parameter and not given!")
            
            items.append({
                'name': name,
                'template': template,
                'local_port': local_port
            })
        
        # Start all devices in parallel
        with concurrent.futures.ThreadPoolExecutor(max_workers=100) as executor:
            try:
                # Submit all tasks
                future_to_item = {executor.submit(self.create_instance, item): item for item in items}
                
                # Collect results as they complete
                for future in concurrent.futures.as_completed(future_to_item):
                    item = future_to_item[future]
                    try:
                        created_device = future.result()
                        self.created_devices.append(created_device)
                        self.logger.info(f"Successfully created device: {created_device}")
                    except Exception as e:
                        self.logger.error(f"Instance creation failed for {item['name']}: {e}")
                        self.shutdown_and_logout()
                        exit(1)
                        
            except Exception as e:
                self.shutdown_and_logout()
                self.logger.error(f"Parallel execution failed: {e}")
                exit(1)

    def create_instance(self, item_data):
        """Create a single instance and return the result"""
        name = item_data['name']
        template = item_data['template']
        local_port = item_data['local_port']

        self.logger.info(f"name: {name}, template: {template}")
        creation_cmd = f"gmsaas instances start {template} {name}"

        try:
            instance_id = subprocess.check_output(creation_cmd.split()).decode(UTF8).replace("\n", "")

            # Connect to ADB
            additional_args = ""
            if local_port:
                additional_args = f"--adb-serial-port {local_port}"
            connect_cmd = f"gmsaas instances adbconnect {instance_id} {additional_args}"
            subprocess.check_call(f"{connect_cmd}", shell=True)

            return {f"{name}": instance_id}

        except Exception as e:
            self.logger.error(f"Failed to create instance {name}: {e}")
            raise e

    def stop_instance(self, device_info):
        """Stop a single instance"""
        for name, instance_id in device_info.items():
            try:
                subprocess.check_call(f"gmsaas instances stop {instance_id}", shell=True)
                self.logger.info(f"device '{name}' is successfully removed!")
                return True
            except Exception as e:
                self.logger.error(f"Failed to stop device '{name}': {e}")
                return False

    def shutdown_and_logout(self) -> None:
        if bool(self.created_devices):
            self.logger.info("Created device(s) will be removed!")
            
            # Stop all devices in parallel
            with concurrent.futures.ThreadPoolExecutor(max_workers=100) as executor:
                # Submit all stop tasks
                futures = [executor.submit(self.stop_instance, device) for device in self.created_devices]
                
                # Wait for all to complete
                for future in concurrent.futures.as_completed(futures):
                    try:
                        future.result()
                    except Exception as e:
                        self.logger.error(f"Error during device shutdown: {e}")
        
        # Logout after all devices are stopped
        if os.getenv(ENV.GENY_AUTH_TOKEN):
            subprocess.check_call("gmsaas auth reset", shell=True)
        else:
            subprocess.check_call("gmsaas auth logout", shell=True)
        self.logger.info("successfully logged out!")
```

### Core Architecture Module: `cli/src/helper/__init__.py`
```
import logging
import os

logger = logging.getLogger("helper")


def convert_str_to_bool(given_str: str) -> bool:
    """
    Convert String to Boolean value

    :param given_str: given string
    :return: converted string in Boolean
    """
    if given_str:
        if type(given_str) is str:
            return given_str.lower() in ("yes", "true", "t", "1")
        else:
            raise AttributeError
    else:
        logger.info(f"'{given_str}' is empty!")
        return False


def get_env_value_or_raise(env_key: str) -> str:
    """
    Get value of necessary environment variable.

    :param env_key: given environment variable
    :return: env_value in String
    """
    try:
        env_value = os.getenv(env_key)
        if not env_value:
            raise RuntimeError(f"'{env_key}' is missing.")
        elif env_value.isspace():
            raise RuntimeError(f"'{env_key}' contains only white space.")
        return env_value
    except TypeError as t_err:
        logger.error(t_err)


def symlink_force(source: str, target: str) -> None:
    """
    Create Symbolic link

    :param source: source file
    :param target: target file
    :return: None
    """
    try:
        os.symlink(source, target)
    except FileNotFoundError as ffe_err:
        logger.error(ffe_err)
    except FileExistsError:
        os.remove(target)
        os.symlink(source, target)

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #514** (2025-07-01): **[🐛 Bug ]: 'adb remount' succeeded, but reboot failed**
  *Symptoms*: ### Operating System  Rocky Linux release 8.10 (Green Obsidian)  ### Docker Image  budtmo/docker-android:emulator_11.0  ### Expected behaviour  1. adb root 2. adb remount 3. adb reboot  I need to copy the certificate file to /system/etc/security/cacerts/  ### Actual behaviour  To enable packet capture and network traffic analysis, the CA certificate needs to be installed into the system's trusted certificate store (e.g., /system/etc/security/cacerts/ on Android).  ### Logs  _No response_
  **Post-Mortem & Fix Analysis**:
  > Did you solve it?

- **Issue #484** (2025-01-21): **[🐛 Bug ]: Error  gave up: d_wm entered FATAL state, too many start retries too quickly**
  *Symptoms*: ### Operating System  debian  ### Docker Image  budtmo/docker-android:emulator_11.0  `docker run -d -p 6080:6080  -e EMULATOR_DEVICE="Samsung Galaxy S10" -e WEB_VNC=true --device /dev/kvm --name android-container budtmo/docker-android:emulator_11.0`  ### Logs   ``` 2025-01-21 07:26:26,281 INFO supervisord started with pid 8  2025-01-21 07:26:26,282 INFO supervisord started with pid 9  2025-01-21 07:26:26,282 INFO supervisord started with pid 7  2025-01-21 07:26:27,286 INFO spawned: 'android_port_forward' with pid 13  2025-01-21 07:26:27,287 INFO spawned: 'appium' with pid 14  2025-01-21 07:26:27,287 INFO spawned: 'd_screen' with pid 15  2025-01-21 07:26:27,288 INFO spawned: 'd_wm' with pid 17  2025-01-21 07:26:27,288 INFO spawned: 'device' with pid 16  2025-01-21 07:26:27,290 INFO spawned: 'vnc_server' with pid 18  2025-01-21 07:26:27,290 INFO spawned: 'log_web_shared' with pid 19  2025-01-21 07:26:27,292 INFO spawned: 'vnc_web' with pid 20  2025-01-21 07:26:27,884 INFO exited: appium (exit status 0; not expected)  2025-01-21 07:26:27,885 INFO exited: log_web_shared (exit status 0; not expected)  2025-01-21 07:26:28,819 INFO success: android_port_forward entered RUNNING state, process has stayed up for > than 1 seconds (startsecs)  2025-01-21 07:26:28,850 INFO success: d_screen entered RUNNING state, process has stayed up for > than 1 seconds (startsecs)  2025-01-21 07:26:28,850 INFO success: d_wm entered RUNNING state, process has stayed up for > than 1 seconds (startsecs)  
  **Post-Mortem & Fix Analysis**:
  > How did you solve it?

- **Issue #455** (2024-08-23): **[🐛 Bug ]: Architecture ,The requested image's platform (linux/amd64) does not match the detected host platform (linux/arm64/v8) and no specific platform was requested**
  *Symptoms*: ### Operating System   Armbian OS 24.8.0 Noble with Linux 6.6.43-ophub  ### Docker Image  budtmo/docker-android:emulator_14.0  ### Expected behaviour  ``` root@armbian:~# sudo apt install cpu-checker kvm-ok Reading package lists... Done Building dependency tree... Done Reading state information... Done cpu-checker is already the newest version (0.7-1.3build2). 0 upgraded, 0 newly installed, 0 to remove and 0 not upgraded. INFO: /dev/kvm exists KVM acceleration can be used ```  ``` root@armbian:~# docker run -d -p 6080:6080 -e EMULATOR_DEVICE="Samsung Galaxy S10" -e WEB_VNC=true --device /dev/kvm --name android-14 budtmo/docker-android:emulator_14.0 Unable to find image 'budtmo/docker-android:emulator_14.0' locally emulator_14.0: Pulling from budtmo/docker-android 9ea8908f4765: Pull complete  eab9dadb72b8: Pull complete  aa8e2be327f1: Pull complete  acf5023a6d5d: Pull complete  4f4fb700ef54: Pull complete  b0885cfcd999: Pull complete  f685f7de16b0: Pull complete  b625cb0c5fcf: Pull complete  df3c8536d0e8: Pull complete  97fd0dadfdda: Pull complete  54cbe7ddaa6c: Pull complete  5581f1781f6c: Pull complete  026700423b59: Pull complete  aa28f90f6992: Pull complete  40ff86387afc: Pull complete  f79a755516bc: Pull complete  369c30aad1fd: Pull complete  7afd39e2a83d: Pull complete  8576a58f8875: Pull complete  14c465d4f3bf: Pull complete  5d78e3dda022: Pull complete  8fbf9006dd5d: Pull complete  a91817ef37cc: Pull complete  cd19b56090ba: Pull c
  **Post-Mortem & Fix Analysis**:
  > 如何解决的呢？

- **Issue #430** (2026-09-02): **[🐛 Bug ]: Not possible to supply additional args that have space**
  *Symptoms*: ### Operating System  Ubuntu 22.04  ### Docker Image  budtmo/docker-android:emulator_14.0_v2.5.1-p0  ### Expected behaviour  I'm trying to provide `-turncfg` flag which is command such as `-turncfg "cat /tmp/turn.cfg"` as documented [here](https://source.android.com/docs/automotive/start/avd/cloud_emulator#setup-turn-server).  ### Actual behaviour  The image fails with `unknown flag /tmp/turn.cfg` because all args are split by space character [here](https://github.com/budtmo/docker-android/blob/0702f34/cli/src/device/emulator.py#L156), hence it's not possible to provide an argument with space without making the command think it's a separate argument.  ### Logs  _No response_

- **Issue #425** (2024-05-17): **[🐛 Bug ]: **
  *Symptoms*: ### Operating System  windwos11  ### Docker Image  docker-android:emulator_11.0  ### Expected behaviour  create volume error  ### Actual behaviour  create volume error ： docker run -v F:/docker/dockerForAndroid/data/:/home/androidusr budtmo/docker-android:emulator_11.0 error message： docker: Error response from daemon: failed to create task for container: failed to create shim task: OCI runtime create failed: runc create failed: unable to start container process: exec: "/home/androidusr/docker-android/mixins/scripts/run.sh": stat /home/androidusr/docker-android/mixins/scripts/run.sh: no such file or directory: unknown.  ### Logs  _No response_
  **Post-Mortem & Fix Analysis**:
  > wait a second. What did you do to fix this?
  >    > wait a second. What did you do to fix this?  docker run -v data:/home/androidusr budtmo/docker-android:emulator_11.0  use this 

- **Issue #398** (2023-12-16): **[🐛 Bug ]: FATAL state**
  *Symptoms*: ### Operating System  Ubuntu Server 22.04 LTS  ### Docker Image  budtmo/docker-android:emulator_12.0  ### Expected behaviour  Running emulator crashes  Docker Command to start docker-android: `docker run --privileged -d -p 10000:4723 -p 10001:5554 -p 10002:5555  -v /mnt/apk:/root/tmp -e DEVICE="Samsung Galaxy S10" -e APPIUM=true --name android budtmo/docker-android:emulator_12.0`  I have  ``` 2023-12-07 21:41:20,155 INFO exited: screen-copy (exit status 0; not expected) 2023-12-07 21:41:20,156 INFO gave up: screen-copy entered FATAL state, too many start retries too quickly 2023-12-07 21:41:22,160 INFO spawned: 'docker-appium' with pid 326 2023-12-07 21:41:22,699 INFO exited: docker-appium (exit status 1; not expected) 2023-12-07 21:41:23,701 INFO gave up: docker-appium entered FATAL state, too many start retries too quickly ```   ### Actual behaviour  Docker container logs show some processes keep on exiting.  The logs are as follows and show that "atd", "screen-copy" and "auto-recording" all enter FATAL state  ### Logs  docker-android.stderr.log:  ``` exec(code, run_globals)   File "/root/src/app.py", line 239, in <module>     run()   File "/root/src/app.py", line 218, in run     prepare_avd(device, avd_name, dp_size)   File "/root/src/app.py", line 113, in prepare_avd     subprocess.check_call(creation_cmd, shell=True)   File "/usr/lib/python3.6/subprocess.py", line 311, in check_call     raise CalledProcessError(retcode, cmd) subprocess.CalledProc
  **Post-Mortem & Fix Analysis**:
  > On container, I run :  `avdmanager create avd -f -n samsung_galaxy_s10_12.0 -b google_apis/x86_64 -k "system-images;android-31;google_apis;x86_64" -d Samsung\ Galaxy\ S10 -p /opt/android/android_emulator`  I have: ``` Error: No device found matching --device Samsung Galaxy S10.repository...        null ```

- **Issue #393** (2023-10-30): **unknown server OS **
  *Symptoms*: ### Operating System  Ubuntu 18.04  ### Docker Image  budtmo/docker-android:emulator_11.0  ### Expected behaviour  the container start successfully  ### Actual behaviour  docker run -d -p 6080:6080 -p 5555:5555 -e EMULATOR_DEVICE="Samsung Galaxy S10" -e WEB_VNC=true --device /dev/kvm --name android-container "budtmo/docker-android:emulator_11.0"  get error "unknown server OS "  <img width="1379" alt="image" src="https://github.com/budtmo/docker-android/assets/7344217/0d0ca653-94a4-4e1e-a3b0-48e2e5efcfa8">   ### Logs  _No response_
  **Post-Mortem & Fix Analysis**:
  > same issue
  > @BlueClouDragon  i removed the quotemark, it still the same. and if i remove --device /dev/kvm it can start the container, but the system has been stuck on the startup screen.  <img width="1516" alt="image" src="https://github.com/budtmo/docker-android/assets/7344217/cc9fd371-4094-42db-8c00-2abb05fae9c4"> 
  > had to run in with sudo, now it works

- **Issue #381** (2023-09-18): **[🐛 Bug ]: Emulator is at Booting status forever**
  *Symptoms*: ### Operating System  Ubuntu  ### Docker Image  budtmo/docker-android:emulator_13.0  ### Expected behaviour  The emulator should be launched successfully  ### Actual behaviour  The emulator is stuck at BOOTING status  ### Logs  When I start the emulator via docker-compose file, the emulator is never displayed. Just the background.  ``` version: "3"  services:  samsung_galaxy_13.0:   image: budtmo/docker-android:emulator_13.0   deploy:    resources:     limits:      cpus: '8'      memory: 10000M     reservations:      cpus: '8'      memory: 10000M   privileged: true   ports:    - 4723:4723    - 5555:5555    - 9000:9000    - 6080:6080   volumes:    - ./video-samsung_13.0:/tmp/video   environment:    - WEB_VNC=true    - WEB_LOG= true    - EMULATOR_DEVICE=Samsung Galaxy S10    - APPIUM=true    - EMULATOR_ADDITIONAL_ARGS="-gpu swiftshader_indirect -memory 8192 -netspeed full -accel on" ```   When I manually start the emulator it works fine.   <img width="1217" alt="image" src="https://github.com/budtmo/docker-android/assets/59612618/776184b1-4896-4b9c-82bc-e29a6ad05e4d"> 
  **Post-Mortem & Fix Analysis**:
  > I have the same problem here.  I'm using Ubuntu
  > Update: It worked when I removed EMULATOR_ADDITIONAL_ARGS.   May be the support is removed?? @budtmo   I was able to launch emulator successfully using the below compose file.  ``` version: '3' services:   android-container:     image: budtmo/docker-android:emulator_11.0     deploy:      resources:       limits:        cpus: '8'        memory: 10000M       reservations:        cpus: '8'        memory: 10000M     privileged: true       ports:       - 4723:4723       - 5555:5555       - 9000       - 6080:6080     volumes:       - ./video-samsung_11.0:/tmp/video     environment:       - EMULATOR_DEVICE=Samsung Galaxy S10       - APPIUM=true       - WEB_VNC=true       - WEB_LOG=true       - WEB_LOG_PORT=9000     devices:       - "/dev/kvm" ```  Also I was not able to access logs using 9000 port.  
  > Same problem here, still I have no solution.

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

### Incident Patch 1: `b578a71b` (2026-09-02)
**Commit Message**: fix: preserve spaces in emulator arguments (#610)

**File**: `cli/src/device/emulator.py` (modified, +2/-1)
```diff
@@ -1,5 +1,6 @@
 import logging
 import os
+import shlex
 import subprocess
 import time
 
@@ -182,7 +183,7 @@ def deploy(self):
 
         start_cmd = f"{basic_cmd} {basic_args} {wipe_arg} {self.additional_args}"
         self.logger.info(f"Command to run {self.device_type}: '{start_cmd}'")
-        subprocess.Popen(start_cmd.split())
+        subprocess.Popen(shlex.split(start_cmd))
 
     def start(self) -> None:
         super().start()
```

**File**: `cli/src/tests/device/test_emulator.py` (modified, +12/-0)
```diff
@@ -63,6 +63,18 @@ def test_check_adb_command_out_of_attempts(self):
                 self.emu.check_adb_command(
                     self.emu.ReadinessCheck.BOOTED, "mocked_command", "1", 3, 0)
 
+    def test_deploy_preserves_spaces_in_quoted_additional_args(self):
+        self.emu.additional_args = '-turncfg "cat /tmp/turn.cfg"'
+
+        with mock.patch.object(self.emu, "is_initialized", return_value=True), \
+                mock.patch("subprocess.Popen") as popen:
+            self.emu.deploy()
+
+        popen.assert_called_once_with([
+            "emulator", "@my_emu", "-gpu", "swiftshader_indirect", "-accel", "on",
+            "-writable-system", "-verbose", "-turncfg", "cat /tmp/turn.cfg"
+        ])
+
     def test_use_override_config_no_env(self):
         with mock.patch("os.getenv", return_value=None):
             self.emu._use_override_config()
```

---

### Incident Patch 2: `52c6906b` (2026-09-01)
**Commit Message**: Fixed wrong variable

**File**: `mcp/src/server.py` (modified, +1/-1)
```diff
@@ -80,7 +80,7 @@ def main() -> None:
     except AdbConnectionError as ace:
         logger.warning("Starting MCP server without a confirmed emulator connection. "
                        "Tool call will retry the connection automatically.")
-    mcp.run(transport="http", host=settings.emulator_host, port=settings.emulator_port)
+    mcp.run(transport="http", host=settings.mcp_host, port=settings.mcp_port)
 
 
 if __name__ == "__main__":
```

---

### Incident Patch 3: `a96358e7` (2026-09-01)
**Commit Message**: Fixed wrong variable

**File**: `mcp/src/server.py` (modified, +1/-1)
```diff
@@ -80,7 +80,7 @@ def main() -> None:
     except AdbConnectionError as ace:
         logger.warning("Starting MCP server without a confirmed emulator connection. "
                        "Tool call will retry the connection automatically.")
-    mcp.run(transport="http", host=settings.emulator_host, port=settings.emulator_port)
+    mcp.run(transport="http", host=settings.mcp_host, port=settings.mcp_port)
 
 
 if __name__ == "__main__":
```

---

### Incident Patch 4: `c86a0777` (2026-03-06)
**Commit Message**: [github-action] Bump docker/setup-buildx-action from 3 to 4 (#572)

Bumps [docker/setup-buildx-action](https://github.com/docker/setup-buildx-action) from 3 to 4.
- [Release notes](https://github.com/docker/setup-buildx-action/releases)
- [Commits](https://github.com/docker/setup-buildx-action/compare/v3...v4)

---
updated-dependencies:
- dependency-name: docker/setup-buildx-action
  dependency-version: '4'
  dependency-type: direct:production
  update-type: version-update:semver-major
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `.github/workflows/release.yml` (modified, +2/-2)
```diff
@@ -45,7 +45,7 @@ jobs:
       uses: actions/checkout@v6
 
     - name: Set up Docker Buildx
-      uses: docker/setup-buildx-action@v3
+      uses: docker/setup-buildx-action@v4
 
     - name: Get release version
       run: echo "RELEASE_VERSION=${GITHUB_REF#refs/*/}" >> $GITHUB_ENV
@@ -70,7 +70,7 @@ jobs:
       uses: actions/checkout@v6
 
     - name: Set up Docker Buildx
-      uses: docker/setup-buildx-action@v3
+      uses: docker/setup-buildx-action@v4
 
     - name: Get release version
       run: echo "RELEASE_VERSION=${GITHUB_REF#refs/*/}" >> $GITHUB_ENV
```

**File**: `.github/workflows/test-on-demand.yml` (modified, +1/-1)
```diff
@@ -11,7 +11,7 @@ jobs:
       uses: actions/checkout@v6
 
     - name: Set up Docker Buildx
-      uses: docker/setup-buildx-action@v3
+      uses: docker/setup-buildx-action@v4
 
     - name: Set up extension
       run: |
```

**File**: `.github/workflows/test.yml` (modified, +1/-1)
```diff
@@ -14,7 +14,7 @@ jobs:
       uses: actions/checkout@v6
 
     - name: Set up Docker Buildx
-      uses: docker/setup-buildx-action@v3
+      uses: docker/setup-buildx-action@v4
 
     - name: Set up extension
       run: |
```

---

### Incident Patch 5: `2a12e660` (2025-09-01)
**Commit Message**: Fix typo in WSL configuration file name (#531)

There is no documentation that file `/etc/wsl2.conf` does exist.
According to Microsoft documentation, it is called `/etc/wsl.conf`. 

See https://learn.microsoft.com/en-us/windows/wsl/wsl-config for reference.

**File**: `README.md` (modified, +1/-1)
```diff
@@ -96,7 +96,7 @@ Credit goes to [Guillaume - The Parallel Interface blog](https://www.paralint.co
     sudo usermod -a -G kvm ${USER}
     ```
 
-2. Add necessary flags to `/etc/wsl2.conf` to their respective sections.
+2. Add necessary flags to `/etc/wsl.conf` to their respective sections.
     ```
     [boot]
     command = /bin/bash -c 'chown -v root:kvm /dev/kvm && chmod 660 /dev/kvm'
```

#### Recent Merged Pull Requests:
- **PR #620** (2026-10-02): [pip] Bump coverage from 7.16.1 to 7.16.2 (@dependabot[bot])
- **PR #619** (2026-09-30): [pip] Bump fastmcp from 4.0.9 to 4.0.10 (@dependabot[bot])
- **PR #618** (2026-09-28): [pip] Bump fastmcp from 4.0.5 to 4.0.9 (@dependabot[bot])
- **PR #617** (closed): Add optional Google Play emulator image and isolated phone example (@HunterStile)
- **PR #616** (2026-09-21): [pip] Bump fastmcp from 4.0.3 to 4.0.5 (@dependabot[bot])
- **PR #615** (2026-09-18): [pip] Bump coverage from 7.16.0 to 7.16.1 (@dependabot[bot])
- **PR #613** (2026-09-09): [pip] Bump fastmcp from 4.0.2 to 4.0.3 (@dependabot[bot])
- **PR #612** (2026-09-07): [pip] Bump fastmcp from 4.0.0 to 4.0.2 (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

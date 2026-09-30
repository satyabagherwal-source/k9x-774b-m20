# Forensic Learning Record (Deep Inspection): huangjunsen0406/py-xiaozhi

> **Canonical Artifact**: `07_PROJECT_LEARNING/huangjunsen0406-py-xiaozhi-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/huangjunsen0406/py-xiaozhi](https://github.com/huangjunsen0406/py-xiaozhi))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T20:35:06.620Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `huangjunsen0406/py-xiaozhi`
- **Description**: Open-source AI assistant ecosystem with MCP integrations, multimodal workflows, IoT support, and cross-platform voice interaction.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 3487 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `examples/mcp_plugins/com.example.hello/plugin.py`
```
"""示例外挂 MCP 插件：无第三方依赖，可直接拷贝到用户 mcp_plugins/."""


def register(host):
    @host.tool(
        name="example.hello",
        description="打招呼。参数 name 可选。用于验证外挂 MCP 插件是否加载成功。",
        props=[{"name": "name", "type": "string", "default": "世界"}],
    )
    async def hello(args):
        name = (args or {}).get("name") or "世界"
        return f"你好, {name}！（来自外挂插件 com.example.hello）"

    # 可选：只读配置
    cfg = host.get("config_readonly")
    log = host.get("logger")
    if log and cfg is not None:
        log.debug("[example.hello] 已拿到 config_readonly")

```

### Core Architecture Module: `examples/mcp_plugins/com.example.hello_sub/plugin.py`
```
"""示例外挂：python-subprocess runtime."""


def register(host):
    @host.tool(
        name="example.hello_sub",
        description="子进程插件打招呼。参数 name 可选。",
        props=[{"name": "name", "type": "string", "default": "世界"}],
    )
    async def hello(args):
        name = (args or {}).get("name") or "世界"
        return f"你好, {name}！（subprocess 插件 com.example.hello_sub）"

```

### Core Architecture Module: `libs/webrtc_apm/__init__.py`
```
"""
WebRTC 音频处理模块的 Python ctypes 封装器。
基于 Unity C# 封装器接口。
"""

import ctypes
import platform
from enum import IntEnum
from pathlib import Path


# 平台特定的库加载
def _get_library_path() -> str:
    """获取平台特定的库路径。"""
    current_dir = Path(__file__).parent

    system = platform.system().lower()
    arch = platform.machine().lower()

    # 标准化架构名称
    if arch in ["x86_64", "amd64"]:
        arch = "x64"
    elif arch in ["aarch64", "arm64"]:
        arch = "arm64"
    elif arch in ["i386", "i686", "x86"]:
        arch = "x86"

    if system == "linux":
        lib_path = current_dir / "linux" / arch / "libwebrtc_apm.so"
    elif system == "darwin":
        lib_path = current_dir / "macos" / arch / "libwebrtc_apm.dylib"
    elif system == "windows":
        lib_path = current_dir / "windows" / arch / "libwebrtc_apm.dll"
    else:
        raise RuntimeError(f"Unsupported platform: {system}")

    if not lib_path.exists():
        raise FileNotFoundError(f"Library not found: {lib_path}")

    return str(lib_path)


# 延迟加载库（三端：linux / macos / windows）
_lib = None


def _ensure_library_loaded():
    """按当前平台加载 libs/webrtc_apm/<os>/<arch>/ 下的动态库。"""
    global _lib

    if _lib is not None:
        return

    _lib = ctypes.CDLL(_get_library_path())
    _init_function_signatures()


# 枚举类型
class DownmixMethod(IntEnum):
    """多声道音轨转换为单声道的方式。"""

    AVERAGE_CHANNELS = 0
    USE_FIRST_CHANNEL = 1


class NoiseSuppressionLevel(IntEnum):
    """噪声抑制级别。"""

    LOW = 0
    MODERATE = 1
    HIGH = 2
    VERY_HIGH = 3


class GainController1Mode(IntEnum):
    """AGC1 控制器模式。"""

    ADAPTIVE_ANALOG = 0
    ADAPTIVE_DIGITAL = 1
    FIXED_DIGITAL = 2


class ClippingPredictorMode(IntEnum):
    """削波预测器模式。"""

    CLIPPING_EVENT_PREDICTION = 0
    ADAPTIVE_STEP_CLIPPING_PEAK_PREDICTION = 1
    FIXED_STEP_CLIPPING_PEAK_PREDICTION = 2


# 结构体
class Pipeline(ctypes.Structure):
    """音频处理管道配置。"""

    _fields_ = [
        ("maximum_internal_processing_rate", ctypes.c_int),
        ("multi_channel_render", ctypes.c_bool),
        ("multi_channel_capture", ctypes.c_bool),
        ("capture_downmix_method", ctypes.c_int),
    ]


class PreAmplifier(ctypes.Structure):
    """前置放大器配置。"""

    _fields_ = [
        ("enabled", ctypes.c_bool),
        ("fixed_gain_factor", ctypes.c_float),
    ]


class AnalogMicGainEmulation(ctypes.Structure):
    """模拟麦克风增益仿真配置。"""

    _fields_ = [
        ("enabled", ctypes.c_bool),
        ("initial_level", ctypes.c_int),
    ]


class CaptureLevelAdjustment(ctypes.Structure):
    """采集电平调整配置。"""

    _fields_ = [
        ("enabled", ctypes.c_bool),
        ("pre_gain_factor", ctypes.c_float),
        ("post_gain_factor", ctypes.c_float),
        ("mic_gain_emulation", AnalogMicGainEmulation),
    ]


class HighPassFilter(ctypes.Structure):
    """高通滤波器配置。"""

    _fields_ = [
        ("enabled", ctypes.c_bool),
        ("apply_in_full_band", ctypes.c_bool),
    ]


class EchoCanceller(ctypes.Structure):
    """回声消除器配置。"""

    _fields_ = [
        ("enabled", ctypes.c_bool),
        ("mobile_mode", ctypes.c_bool),
        ("export_linear_aec_output", ctypes.c_bool),
        ("enforce_high_pass_filtering", ctypes.c_bool),
    ]


class NoiseSuppression(ctypes.Structure):
    """噪声抑制配置。"""

    _fields_ = [
        ("enabled", ctypes.c_bool),
        ("noise_level", ctypes.c_int),
        ("analyze_linear_aec_output_when_available", ctypes.c_bool),
    ]


class TransientSuppression(ctypes.Structure):
    """瞬态抑制配置。"""

    _fields_ = [
        ("enabled", ctypes.c_bool),
    ]


class ClippingPredictor(ctypes.Structure):
    """削波预测器配置。"""

    _fields_ = [
        ("enabled", ctypes.c_bool),
        ("predictor_mode", ctypes.c_int),
        ("window_length", ctypes.c_int),
        ("reference_window_length", ctypes.c_int),
        ("reference_window_delay", ctypes.c_int),
        ("clipping_threshold", ctypes.c_float),
        ("crest_factor_margin", ctypes.c_float),
        ("use_predicted_step", ctypes.c_bool),
    ]


class AnalogGainController(ctypes.Structure):
    """模拟增益控制器配置。"""

    _fields_ = [
        ("enabled", ctypes.c_bool),
        ("startup_min_volume", ctypes.c_int),
        ("clipped_level_min", ctypes.c_int),
        ("enable_digital_adaptive", ctypes.c_bool),
        ("clipped_level_step", ctypes.c_int),
        ("clipped_ratio_threshold", ctypes.c_float),
        ("clipped_wait_frames", ctypes.c_int),
        ("predictor", ClippingPredictor),
    ]


class GainController1(ctypes.Structure):
    """AGC1 配置。"""

    _fields_ = [
        ("enabled", ctypes.c_bool),
        ("controller_mode", ctypes.c_int),
        ("target_level_dbfs", ctypes.c_int),
        ("compression_gain_db", ctypes.c_int),
        ("enable_limiter", ctypes.c_bool),
        ("analog_controller", AnalogGainController),
    ]


class InputVolumeController(ctypes.Structure):
    """输入音量控制器配置。"""

    _fields_ = [
        ("enabled", ctypes.c_bool),
    ]


class AdaptiveDigital(ctypes.Structure):
    """自适应数字控制器配置。"""

    _fields_ = [
        ("enabled", ctypes.c_bool),
        ("headroom_db", ctypes.c_float),
        ("max_gain_db", ctypes.c_float),
        ("initial_gain_db", ctypes.c_float),
        ("max_gain_change_db_per_second", ctypes.c_float),
        ("max_output_noise_level_dbfs", ctypes.c_float),
    ]


class FixedDigital(ctypes.Structure):
    """固定数字控制器配置。"""

    _fields_ = [
        ("gain_db", ctypes.c_float),
    ]


class GainController2(ctypes.Structure):
    """AGC2 配置。"""

    _fields_ = [
        ("enabled", ctypes.c_bool),
        ("volume_controller", InputVolumeController),
        ("adaptive_controller", AdaptiveDigital),
        ("fixed_controller", FixedDigital),
    ]


class Config(ctypes.Structure):
    """WebRTC 音频处理的主配置结构。"""

    _fields_ = [
        ("pipeline_config", Pipeline),
        ("pre_amp", PreAmplifier),
        ("level_adjustment", CaptureLevelAdjustment),
        ("high_pass", HighPassFilter),
        ("echo", EchoCanceller),
        ("noise_suppress", NoiseSuppression),
        ("transient_suppress", TransientSuppression),
        ("gain_control1", GainController1),
        ("gain_control2", GainController2),
    ]


# 函数定义（延迟初始化）
def _init_function_signatures():
    """初始化函数签名（仅在库加载后调用）。"""
    global _lib
    if _lib is None:
        raise RuntimeError("Library not loaded. Call _ensure_library_loaded() first.")

    _lib.WebRTC_APM_Create.argtypes = []
    _lib.WebRTC_APM_Create.restype = ctypes.c_void_p

    _lib.WebRTC_APM_Destroy.argtypes = [ctypes.c_void_p]
    _lib.WebRTC_APM_Destroy.restype = None

    _lib.WebRTC_APM_CreateStreamConfig.argtypes = [ctypes.c_int, ctypes.c_int]
    _lib.WebRTC_APM_CreateStreamConfig.restype = ctypes.c_void_p

    _lib.WebRTC_APM_DestroyStreamConfig.argtypes = [ctypes.c_void_p]
    _lib.WebRTC_APM_DestroyStreamConfig.restype = ctypes.c_void_p

    _lib.WebRTC_APM_ApplyConfig.argtypes = [ctypes.c_void_p, ctypes.POINTER(Config)]
    _lib.WebRTC_APM_ApplyConfig.restype = ctypes.c_int

    _lib.WebRTC_APM_ProcessReverseStream.argtypes = [
        ctypes.c_void_p,
        ctypes.POINTER(ctypes.c_short),
        ctypes.c_void_p,
        ctypes.c_void_p,
        ctypes.POINTER(ctypes.c_short),
    ]
    _lib.WebRTC_APM_ProcessReverseStream.restype = ctypes.c_int

    _lib.WebRTC_APM_ProcessStream.argtypes = [
        ctypes.c_void_p,
        ctypes.POINTER(ctypes.c_short),
        ctypes.c_void_p,
        ctypes.c_void_p,
        ctypes.POINTER(ctypes.c_short),
    ]
    _lib.WebRTC_APM_ProcessStream.restype = ctypes.c_int

    _lib.WebRTC_APM_SetStreamDelayMs.argtypes = [ctypes.c_void_p, ctypes.c_int]
    _lib.WebRTC_APM_SetStreamDelayMs.restype = None


class WebRTCAudioProcessing:
    """WebRTC 音频处理的高级 Python 封装器。"""

    def __init__(self):
        """初始化音频处理模块。"""
        # 确保库已按当前平台加载
        _ensure_library_loaded()
        _init_function_signatures()

        self._handle = _lib.WebRTC_APM_Create()
        if not self._handle:
            raise RuntimeError("Failed
```

### Core Architecture Module: `main.py`
```
import argparse
import asyncio
import locale
import os
import signal
import sys

# Windows: 强制 C/C++ 运行时使用 UTF-8，解决 sherpa-onnx 读取声调拼音文件乱码
if sys.platform == "win32":
    os.environ["PYTHONIOENCODING"] = "utf-8"
    try:
        locale.setlocale(locale.LC_ALL, ".UTF-8")
    except locale.Error:
        pass

os.environ["QSG_RHI_BACKEND"] = "opengl"
# 强制 qasync 使用 PySide6
os.environ["QT_API"] = "pyside6"
# 使用 Basic 样式以支持自定义控件
os.environ["QT_QUICK_CONTROLS_STYLE"] = "Basic"


def parse_args():
    """解析命令行参数."""
    from src.constants.system import SystemConstants

    parser = argparse.ArgumentParser(description=SystemConstants.APP_DISPLAY_NAME)
    # 运行模式选择
    # - gui: 图形界面模式，使用 PySide6 + QML
    # - cli: 命令行模式，使用终端交互（轻量，适合无屏/SSH）
    # - tui: 全屏 TUI（Textual），可编辑配置；需 uv sync --extra tui
    # - gpio: GPIO 按键模式，仅支持 Linux（树莓派），通过物理按键控制
    parser.add_argument(
        "--mode",
        choices=["gui", "cli", "tui", "gpio"],
        default="gui",
        help="运行模式（默认 gui）：gui / cli / tui(全屏终端) / gpio(仅Linux)",
    )
    parser.add_argument(
        "--protocol",
        choices=["mqtt", "websocket"],
        default="websocket",
        metavar="PROTOCOL",
        help="通信协议：mqtt 或 websocket（默认 websocket；须写 --protocol mqtt）",
    )
    parser.add_argument(
        "--skip-activation",
        action="store_true",
        help="跳过激活流程，直接启动应用（仅用于调试）",
    )
    return parser.parse_args()


# 先解析参数，再初始化配置与日志（禁止 ConfigManager 懒单例）
_args = parse_args()

from src.utils.config_manager import initialize_config  # noqa: E402

initialize_config()

from src.logging import load_logging_config, setup_logging  # noqa: E402

# CLI/TUI 模式禁用控制台日志输出（由界面接管）
setup_logging(
    enable_console=(_args.mode not in ("cli", "tui")),
    config=load_logging_config(),
)

from src.bootstrap.container import ServiceContainer  # noqa: E402
from src.constants.system import SystemConstants  # noqa: E402
from src.logging import get_logger  # noqa: E402

logger = get_logger()


async def handle_activation(mode: str) -> bool:
    """处理设备激活流程.

    Args:
        mode: 运行模式，"gui"、"cli"、"tui" 或 "gpio"

    Returns:
        bool: 激活是否成功
    """
    try:
        from src.activation import ActivationService, create_activation_ui

        logger.info("开始设备激活流程检查...")
        activation_service = await ActivationService.create()
        init_result = await activation_service.initialize()

        if not init_result.get("success", False):
            logger.error(f"初始化失败: {init_result.get('error', '未知错误')}")
            return False

        if not init_result.get("need_activation_ui", False):
            logger.info("设备已激活，无需激活流程")
            return True

        ui = create_activation_ui(mode, activation_service, init_result)
        return await ui.run()

    except Exception as e:
        logger.error(f"激活流程异常: {e}", exc_info=True)
        return False


async def start_app(mode: str, protocol: str, skip_activation: bool) -> int:
    """启动应用的统一入口."""
    global _container  # 用于 SIGINT 处理
    logger.info(f"启动{SystemConstants.APP_DISPLAY_NAME}")

    # 处理激活流程
    if not skip_activation:
        activation_success = await handle_activation(mode)
        if not activation_success:
            logger.error("设备激活失败，程序退出")
            return 1
    else:
        logger.warning("跳过激活流程（调试模式）")

    # 创建并启动应用程序
    _container = ServiceContainer()
    return await _container.run(mode=mode, protocol=protocol)


# 全局容器引用，用于 SIGINT 处理
_container = None


if __name__ == "__main__":
    exit_code = 1
    try:
        # 使用已解析的参数
        args = _args

        # 检测Wayland环境并设置Qt平台插件配置
        import os

        is_wayland = (
            os.environ.get("WAYLAND_DISPLAY")
            or os.environ.get("XDG_SESSION_TYPE") == "wayland"
        )

        if args.mode == "gui" and is_wayland:
            if "QT_QPA_PLATFORM" not in os.environ:
                os.environ["QT_QPA_PLATFORM"] = "wayland;xcb"
                logger.info("Wayland环境：设置QT_QPA_PLATFORM=wayland;xcb")
            os.environ.setdefault("QT_WAYLAND_DISABLE_WINDOWDECORATION", "1")
            logger.info("Wayland环境检测完成，已应用兼容性配置")

        # 信号处理
        try:
            if hasattr(signal, "SIGTRAP"):
                signal.signal(signal.SIGTRAP, signal.SIG_IGN)
        except Exception:
            pass

        if args.mode == "gui":
            # GUI 模式：使用 PySide6 + qasync
            try:
                import qasync
                from PySide6.QtWidgets import QApplication
            except ImportError as e:
                logger.error(
                    "GUI 模式需要 PySide6 + qasync，当前环境未安装。\n"
                    "请用项目 venv 安装 GUI 依赖后重试：\n"
                    "  uv sync --extra gui\n"
                    "  # 或: pip install '.[gui]'\n"
                    "然后：\n"
                    "  uv run python main.py\n"
                    "  # 或: .venv/bin/python main.py\n"
                    "不要 GUI 时可用：\n"
                    "  python main.py --mode cli\n"
                    "  python main.py --mode tui   # 需 uv sync --extra tui\n"
                    f"(原始错误: {e})"
                )
                sys.exit(1)

            qt_app = QApplication.instance() or QApplication(sys.argv)
            qt_app.setQuitOnLastWindowClosed(False)

            loop = qasync.QEventLoop(qt_app)
            asyncio.set_event_loop(loop)
            logger.info("已创建 PySide6 + qasync 事件循环")

            # 设置 SIGINT 信号处理 - 通过 TaskManager 请求关闭
            shutdown_state = {"requested": False}

            def handle_sigint(*_):
                if shutdown_state["requested"]:
                    return
                shutdown_state["requested"] = True
                logger.info("收到 SIGINT 信号，正在退出...")

                # 通过 TaskManager 请求优雅关闭
                try:
                    if _container and _container.tasks:
                        _container.tasks.request_shutdown()
                    else:
                        # 容器未就绪，直接退出 Qt
                        if loop.is_running():
                            loop.call_soon_threadsafe(qt_app.quit)
                except Exception:
                    qt_app.quit()

            signal.signal(signal.SIGINT, handle_sigint)

            try:
                with loop:
                    exit_code = loop.run_until_complete(
                        start_app(args.mode, args.protocol, args.skip_activation)
                    )
            except RuntimeError as e:
                # 捕获 qasync 的 "Event loop stopped before Future completed" 错误
                if "Event loop stopped before Future completed" in str(e):
                    logger.debug("事件循环已正常终止")
                    exit_code = 0
                else:
                    raise
        else:
            # CLI / TUI / GPIO：标准 asyncio
            if args.mode == "tui":
                try:
                    import textual  # noqa: F401
                except ImportError as e:
                    logger.error(
                        "TUI 模式需要 textual。请运行:\n"
                        "  uv sync --extra tui\n"
                        "  pip install '.[tui]'\n"
                        "无屏/SSH 请继续用: python main.py --mode cli\n"
                        f"(原始错误: {e})"
                    )
                    sys.exit(1)

            # CLI / GPIO 模式：标准 asyncio；SIGINT 请求 TaskManager 关闭
            shutdown_state = {"requested": False}

            def handle_sigint_cli(*_):
                if shutdown_state["requested"]:
                    # 二次 Ctrl+C：硬退
                    logger.warning("再次收到 SIGINT，强制退出")
                    os._exit(130)
                shutdown_state["requested"] = True
                logger.info("收到 SIGINT 信号，正在退出...")
                try:
                    if _container and _container.tasks:
                        _container.tasks.request_shutdown()
                except Exception:
                    pass

            signal.signal(signal.SIGINT, handle_sigint_cli)
            exit_code = asyncio.run(
                start
```

### Core Architecture Module: `release.py`
```
#!/usr/bin/env python3
"""发版脚本：从 system.py 读取版本号，自动更新 + 生成 build.json + git tag。

用法：python release.py [--dry-run]
"""

import json
import re
import subprocess
import sys
from pathlib import Path

SYSTEM_PY = Path("src/constants/system.py")
BUILD_JSON = Path("build.json")

VERSION_RE = re.compile(r'(APP_VERSION\s*=\s*")([^"]+)(")')

VERSION_TYPES = [
    ("patch", "bug 修复", "1.0.0 → 1.0.1"),
    ("minor", "新功能", "1.0.0 → 1.1.0"),
    ("major", "重大变更", "1.0.0 → 2.0.0"),
    ("prepatch", "测试版", "1.0.0 → 1.0.1-beta.0"),
    ("prerelease", "继续测试", "1.0.1-beta.0 → 1.0.1-beta.1"),
]

BUILD_TEMPLATE = {
    "entry": "main.py",
    "name": "",
    "display_name": "",
    "version": "",
    "icon": "assets/icon.png",
    "pyinstaller": {
        "onefile": False,
        "windowed": True,
        "add_data": [
            "models:models",
            "scripts:scripts",
            "src:src",
            "libs:libs",
            "assets:assets",
        ],
        "clean": True,
        "noconfirm": True,
    },
    "platforms": {
        "macos": {
            "bundle_identifier": "",
            "minimum_system_version": "10.13",
            "category": "public.app-category.productivity",
            "microphone_usage_description": "此应用需要访问麦克风以实现录音功能",
            "speech_recognition_usage_description": "此应用需要使用语音识别功能以理解语音指令",
            "camera_usage_description": "此应用需要访问摄像头以实现拍照或视频功能",
            "copyright": "© 2024 Company. All rights reserved.",
            "dmg": {
                "volname": "",
                "window_size": [600, 450],
                "icon_size": 100,
                "format": "UDZO",
            },
        },
        "windows": {
            "inno_setup": {
                "create_desktop_icon": True,
                "create_start_menu_icon": True,
                "allow_run_after_install": True,
                "languages": ["chinesesimplified", "english"],
            },
            "pyinstaller": {"contents_directory": "."},
        },
        "linux": {
            "deb": {
                "package": "",
                "section": "utils",
                "priority": "optional",
                "desktop_entry": True,
                "categories": ["Utility"],
            }
        },
    },
}


def read_system_constants() -> dict:
    """从 system.py 读取 APP_NAME / APP_DISPLAY_NAME / APP_VERSION。"""
    content = SYSTEM_PY.read_text(encoding="utf-8")
    values = {}
    for key in ("APP_NAME", "APP_DISPLAY_NAME", "APP_VERSION"):
        m = re.search(rf'{key}\s*=\s*"([^"]+)"', content)
        if m:
            values[key] = m.group(1)
    return values


def parse_version(v: str) -> tuple:
    """解析 semver：major.minor.patch[-pre.N]"""
    m = re.match(r"(\d+)\.(\d+)\.(\d+)(?:-(\w+)\.(\d+))?", v)
    if not m:
        raise ValueError(f"无法解析版本号: {v}")
    major, minor, patch = int(m.group(1)), int(m.group(2)), int(m.group(3))
    pre_tag = m.group(4)
    pre_num = int(m.group(5)) if m.group(5) is not None else None
    return major, minor, patch, pre_tag, pre_num


def bump_version(current: str, bump_type: str) -> str:
    """计算新版本号。"""
    major, minor, patch, pre_tag, pre_num = parse_version(current)

    if bump_type == "patch":
        return f"{major}.{minor}.{patch + 1}"
    elif bump_type == "minor":
        return f"{major}.{minor + 1}.0"
    elif bump_type == "major":
        return f"{major + 1}.0.0"
    elif bump_type == "prepatch":
        return f"{major}.{minor}.{patch + 1}-beta.0"
    elif bump_type == "prerelease":
        if pre_tag and pre_num is not None:
            return f"{major}.{minor}.{patch}-{pre_tag}.{pre_num + 1}"
        return f"{major}.{minor}.{patch + 1}-beta.0"
    else:
        raise ValueError(f"未知版本类型: {bump_type}")


def update_system_py(new_version: str) -> None:
    """更新 system.py 的 APP_VERSION。"""
    content = SYSTEM_PY.read_text(encoding="utf-8")
    new_content = VERSION_RE.sub(rf"\g<1>{new_version}\g<3>", content)
    SYSTEM_PY.write_text(new_content, encoding="utf-8")


def generate_build_json(constants: dict) -> None:
    """从 system.py 常量生成 build.json。"""
    cfg = json.loads(json.dumps(BUILD_TEMPLATE))

    name = constants["APP_NAME"]
    display_name = constants["APP_DISPLAY_NAME"]
    version = constants["APP_VERSION"]

    cfg["name"] = name
    cfg["display_name"] = display_name
    cfg["version"] = version
    cfg["platforms"]["macos"]["bundle_identifier"] = f"com.{name}.app"
    cfg["platforms"]["macos"]["dmg"]["volname"] = f"{display_name} 安装器"
    cfg["platforms"]["linux"]["deb"]["package"] = name

    BUILD_JSON.write_text(
        json.dumps(cfg, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )


def run_git(new_version: str) -> None:
    """git commit + tag + push。"""
    subprocess.run(["git", "add", str(SYSTEM_PY), str(BUILD_JSON)], check=True)
    subprocess.run(
        ["git", "commit", "-m", f"chore: release v{new_version}"], check=True
    )
    subprocess.run(
        ["git", "tag", "-a", f"v{new_version}", "-m", f"v{new_version}"], check=True
    )
    subprocess.run(["git", "push", "--follow-tags"], check=True)


def main():
    dry_run = "--dry-run" in sys.argv

    constants = read_system_constants()
    current = constants.get("APP_VERSION")
    if not current:
        print("❌ 无法从 system.py 读取 APP_VERSION")
        sys.exit(1)

    print(f"\n当前版本: {current}")
    print("\n选择版本更新类型：\n")
    for i, (_, label, desc) in enumerate(VERSION_TYPES, 1):
        print(f"  {i}. {label} — {desc}")

    try:
        choice = input("\n请输入选项 (1-5): ").strip()
        index = int(choice) - 1
        if not (0 <= index < len(VERSION_TYPES)):
            raise ValueError
    except (ValueError, EOFError):
        print("❌ 无效的选项")
        sys.exit(1)

    bump_type = VERSION_TYPES[index][0]
    new_version = bump_version(current, bump_type)

    print(f"\n版本变更: {current} → {new_version}")

    if dry_run:
        print("\n[dry-run] 将执行以下操作:")
        print(f"  1. 更新 {SYSTEM_PY}: APP_VERSION = \"{new_version}\"")
        print(f"  2. 生成 {BUILD_JSON}")
        print(f"  3. git commit + tag v{new_version} + push")
        print("\n[dry-run] 未实际执行任何操作。")
        return

    update_system_py(new_version)
    constants["APP_VERSION"] = new_version
    generate_build_json(constants)

    print(f"\n✅ 已更新 {SYSTEM_PY}")
    print(f"✅ 已生成 {BUILD_JSON}")

    run_git(new_version)

    print(f"\n✅ 版本 v{new_version} 发布成功！GitHub Actions 将自动开始构建。")


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `scripts/camera_scanner.py`
```
#!/usr/bin/env python3
"""检测可用摄像头（OpenCV/V4L2 + 可选 picamera2），并写回 CAMERA 配置."""

import argparse
import logging
import sys
from pathlib import Path

# 添加项目根目录
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from src.utils.config_manager import initialize_config  # noqa: E402

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("CameraScanner")


def main() -> int:
    parser = argparse.ArgumentParser(description="扫描摄像头并可选写入配置")
    parser.add_argument(
        "--select",
        type=int,
        default=None,
        help="选择列表中的序号（从 0 开始）写入配置",
    )
    parser.add_argument(
        "--backend",
        choices=["auto", "opencv", "picamera2"],
        default=None,
        help="强制写入 CAMERA.backend",
    )
    parser.add_argument(
        "--device",
        default=None,
        help="强制写入 CAMERA.device（如 /dev/video0）",
    )
    parser.add_argument(
        "--test",
        action="store_true",
        help="对当前配置或 --select 结果试拍一帧",
    )
    args = parser.parse_args()

    config = initialize_config()
    from src.mcp.tools.camera.capture_backend import (
        CaptureConfig,
        apply_device_selection,
        capture_jpeg,
        list_camera_devices,
        load_capture_config,
    )

    current = load_capture_config()
    print("\n===== 当前 CAMERA 配置 =====")
    print(f"  backend={current.backend}")
    print(f"  device={current.device!r}")
    print(f"  camera_index={current.camera_index}")
    print(f"  size={current.frame_width}x{current.frame_height}")
    print(f"  warm_up_frames={current.warm_up_frames}")

    print("\n===== 扫描设备 =====\n")
    devices = list_camera_devices()
    if not devices:
        print("未发现可用摄像头。")
        print("提示:")
        print("  - USB: 确认已插入，ls /dev/video*")
        print("  - 树莓派 CSI: sudo apt install python3-picamera2")
        print("  - 用户需在 video 组: sudo usermod -aG video $USER && newgrp video")
        return 1

    for i, d in enumerate(devices):
        print(f"  [{i}] {d.name}  key={d.key}  kind={d.kind}")

    selected_key = None
    if args.device:
        selected_key = args.device
    elif args.backend == "picamera2":
        selected_key = "picamera2"
    elif args.select is not None:
        if args.select < 0 or args.select >= len(devices):
            print(f"--select 超出范围 0..{len(devices) - 1}")
            return 1
        selected_key = devices[args.select].key

    if selected_key is not None:
        updates = apply_device_selection(selected_key)
        if args.backend:
            updates["CAMERA.backend"] = args.backend
        for path, value in updates.items():
            config.update_config(path, value)
        print("\n已写入配置:")
        for path, value in updates.items():
            print(f"  {path} = {value!r}")

    if args.test or selected_key is not None:
        print("\n===== 试拍 =====")
        cfg = load_capture_config()
        if selected_key is not None:
            # 用刚写入的选择
            u = apply_device_selection(selected_key)
            if args.backend:
                u["CAMERA.backend"] = args.backend
            cfg = CaptureConfig(
                camera_index=int(u.get("CAMERA.camera_index", 0) or 0),
                device=str(u.get("CAMERA.device", "") or ""),
                backend=str(u.get("CAMERA.backend", "auto")),
                frame_width=cfg.frame_width,
                frame_height=cfg.frame_height,
                warm_up_frames=cfg.warm_up_frames,
            )
        jpeg = capture_jpeg(cfg)
        if not jpeg:
            print("试拍失败")
            return 2
        out = project_root / "camera_scan_test.jpg"
        out.write_bytes(jpeg)
        print(f"试拍成功: {out} ({len(jpeg)} bytes)")

    print("\n完成。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

```

### Core Architecture Module: `scripts/check_mcp_plugin.py`
```
#!/usr/bin/env python3
"""校验外挂 MCP 插件包结构（不启动完整应用）."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


def check_plugin(path: Path, *, strict: bool = False) -> list[str]:
    """返回错误列表；空 = 通过."""
    errors: list[str] = []
    if not path.is_dir():
        return [f"不是目录: {path}"]

    manifest_path = path / "manifest.json"
    plugin_py = path / "plugin.py"
    if not manifest_path.is_file() and not plugin_py.is_file():
        errors.append("缺少 manifest.json 且无 plugin.py")
        return errors

    manifest: dict = {}
    if manifest_path.is_file():
        try:
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        except Exception as e:
            errors.append(f"manifest.json 无法解析: {e}")
            return errors
    else:
        if strict:
            errors.append("严格模式要求 manifest.json")
        manifest = {"id": path.name, "entry": "plugin:register"}

    pid = manifest.get("id") or path.name
    if not pid:
        errors.append("manifest.id 为空")

    entry = str(manifest.get("entry") or "plugin:register")
    if ":" not in entry:
        errors.append(f"entry 须为 module:attr，得到: {entry}")
    else:
        mod, _attr = entry.split(":", 1)
        py = path / f"{mod.replace('.', '/')}.py"
        if not py.is_file() and not (path / mod).is_dir():
            errors.append(f"找不到入口模块文件: {py}")

    runtime = manifest.get("runtime", "python-inprocess")
    if runtime != "python-inprocess":
        errors.append(f"当前仅支持 runtime=python-inprocess，得到: {runtime}")

    if strict:
        if "api_version" not in manifest:
            errors.append("严格模式要求 api_version")
        if "python_abi" not in manifest:
            errors.append("严格模式要求 python_abi")
        if "platforms" not in manifest:
            errors.append("严格模式要求 platforms")
        if "tool_name_prefix" not in manifest:
            errors.append("严格模式要求 tool_name_prefix")

    # lib 可选；若存在应是目录
    lib = path / "lib"
    if lib.exists() and not lib.is_dir():
        errors.append("lib 存在但不是目录")

    return errors


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="检查 MCP 外挂插件包（manifest + 入口 + 可选 lib）"
    )
    parser.add_argument(
        "path",
        type=Path,
        help="插件目录路径，如 mcp_plugins/com.example.hello",
    )
    parser.add_argument(
        "--strict",
        action="store_true",
        help="要求 api_version / python_abi / platforms / tool_name_prefix",
    )
    args = parser.parse_args(argv)
    path = args.path.expanduser().resolve()
    errs = check_plugin(path, strict=args.strict)
    if errs:
        print(f"FAIL {path}")
        for e in errs:
            print(f"  - {e}")
        return 1
    print(f"OK {path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #306** (2026-05-26): **[Bug] 新的设备绑定到小智后台后，无任何相应**
  *Symptoms*: ## 🐛 问题描述 使用一台之前没有绑定过小智后台的机器，到小智后台绑定设备后，语音，发送文字都没有响应。  ## 🔍 复现步骤 1. 绑定设备后 2. 跟小智对话 3. 一直显示聆听中，小智服务器没有消息回应  ## 🤔 预期行为 有消息回应  ## 🖥️ 环境信息 - 操作系统: Windows 11 - 项目版本: 最新版本 - Python版本: 3.10.6  
  **Post-Mortem & Fix Analysis**:
  > 解决了？

- **Issue #299** (2026-05-26): **[Bug] 配置文件覆盖**
  *Symptoms*: ## 🐛 问题描述 手动更改配置文件后，通过cli 模式启动程序，配置信息被覆盖    ## 🖥️ 环境信息 - 操作系统: ubuntu20.04 - 项目版本:最新版本   
  **Post-Mortem & Fix Analysis**:
  > 我明天看看    ---原始邮件--- 发件人: ***@***.***&gt; 发送时间: 2026年5月17日(周日) 晚上10:01 收件人: ***@***.***&gt;; 抄送: ***@***.***&gt;; 主题: [huangjunsen0406/py-xiaozhi] [Bug] 配置文件覆盖 (Issue #299)   xzhengqi created an issue (huangjunsen0406/py-xiaozhi#299)   🐛 问题描述   手动更改配置文件后，通过cli 模式启动程序，配置信息被覆盖   🖥️ 环境信息    操作系统: ubuntu20.04   项目版本:最新版本    — Reply to this email directly, view it on GitHub, or unsubscribe. You are receiving this because you are subscribed to this thread.Message ID: ***@***.***&gt;
  > 按照下面的找config配置，最新代码已经不使用根目录config了  Linux / Ubuntu 20.04 默认用户数据目录：~/.local/share/py-xiaozhi 配置文件：~/.local/share/py-xiaozhi/config/config.json 设备指纹：~/.local/share/py-xiaozhi/config/efuse.json 如果设置了 XDG_DATA_HOME，则会变成：$XDG_DATA_HOME/py-xiaozhi/config/...
  > 谢谢！！！

- **Issue #269** (2026-05-14): **[Bug] 简短描述问题**
  *Symptoms*: ## 🐛 问题描述 <!-- 清晰简洁地描述问题是什么 --> macos 15.7.5 运行安装包，小智没有声音，只有文字显示 ## 🔍 复现步骤 <!-- 详细描述复现问题的步骤 --> 1. 打开 '...' 2. 点击 '...' 3. 滚动到 '...' 4. 看到错误  ## 🤔 预期行为 <!-- 简要描述预期的正确行为 -->  ## 😯 截图 <!-- 如果适用，添加问题的截图 -->  ## 🖥️ 环境信息 - 操作系统: [例如 Windows 10] - 项目版本: [例如 1.0.0] - Python版本: [例如 3.9.13] - Nodejs版本: [例如 v20.14.0]  ## 📋 其他信息 <!-- 在此添加关于此问题的任何其他上下文信息 --> 
  **Post-Mortem & Fix Analysis**:
  > 运行源码或者看我仓库的xiaozhi-desktop版本，那个电脑上稳定点

- **Issue #267** (2026-05-14): **[Bug] 用语音唤醒的情况下，ASR会变得很慢**
  *Symptoms*: ## 🐛 问题描述 用语音唤醒后，相对于按按键对话，ASR会慢1秒左右。这可能是什么原因呢，和sherpa onnx部署的模型有关么？     ## 🖥️ 环境信息 - 操作系统: [ Windows 11] - 项目版本: [最新] - Python版本: [例如 3.11] - sherpa onnx版本: epoch-99 fp32 

- **Issue #265** (2026-05-14): **[Bug] 定时工具错误**
  *Symptoms*: 2026-02-28 23:35:09,039[src.mcp.tools.timer.timer_service] - WARNING - 通知倒计时执行结果失败: 'Application' object has no attribute '_send_text_tts' - MainThread 2026-02-28 23:35:09,039[src.mcp.tools.timer.timer_service] - ERROR - 倒计时 0 执行MCP工具时出错: MCP命令格式错误，必须包含 'name' 和 'arguments' 字段 - MainThread Traceback (most recent call last):   File "C:\Users\Xiongliu\Downloads\py-xiaozhi-main\src\mcp\tools\timer\timer_service.py", line 255, in _execute_command     raise ValueError("MCP命令格式错误，必须包含 'name' 和 'arguments' 字段") ValueError: MCP命令格式错误，必须包含 'name' 和 'arguments' 字段 倒计时： 10秒提醒执行失败 2026-02-28 23:35:09,039[src.mcp.tools.timer.timer_service] - WARNING - 通知倒计时执行结果失败: 'Application' object has no attribute '_send_text_tts' - MainThread
  **Post-Mortem & Fix Analysis**:
  > 内置服务端不再支持文本输入

- **Issue #264** (2026-05-14): **HAVE SOME WAY TO RESOLVE THIS ?**
  *Symptoms*: I cant get longer word in text box  {'type': 'alert', 'emotion': 'sad', 'status': 'ERROR', 'message': 'detect 仅用于唤醒词，请不要传长文本(Detect is only for wake words, do not send long texts.)', 'session_id': 'e74ad482'}  The relevant code block is as follows:          message = {             "session_id": self.session_id,             "type": "listen",             "state": "detect",             "text": text,         }         await self.send_text(json.dumps(message）)  

- **Issue #259** (2025-12-15): **IoT设备调用在不同模态（语音、文本）下执行成功率相差大**
  *Symptoms*: ## 🐛 问题描述 IoT设备调用上存在BUG。具体体现为语音输入打开xxx执行率低，LLM认为自己没有控制设备的能力。--mode cli输入文本打开xxx，执行率相比较高。是因为走了不同的工作流吗？  ## 🔍 复现步骤 <!-- 详细描述复现问题的步骤 --> 1. python main.py --mode cli 2. 唤醒 3. 打开xxx 4. 回复“我不会打开xxx呢” 5. 重启程序 6. 输入“打开xxx”文本 7. 回复“好的，已打开”，IoT设备相关代码执行ok。这里语音输入也变为可用了。  ## 🤔 预期行为 语音控制IoT设备打开  ## 😯 截图 None  ## 🖥️ 环境信息 - 操作系统: ubuntu - 项目版本: main分支最新提交 - Python版本: 3.10 
  **Post-Mortem & Fix Analysis**:
  > _回复“好的，已打开”，IoT设备相关代码执行ok。这里语音输入也变为可用了。_ 刚测了下，执行成功一次后，语音输入命令也会出现回复“无法操作xxx设备”的情况
  > iot已准备去掉了，如果你实现的功能不多，建议迁移到mcp，你说的问题大部分都是因为iot机制导致的，每次都得第二次对话才能拿到上次执行结果    ---原始邮件--- 发件人: ***@***.***&gt; 发送时间: 2025年12月10日(周三) 下午2:59 收件人: ***@***.***&gt;; 抄送: ***@***.***&gt;; 主题: [huangjunsen0406/py-xiaozhi] [Bug] 简短描述问题 (Issue #259)   bi-yechao created an issue (huangjunsen0406/py-xiaozhi#259)   🐛 问题描述   IoT设备调用上存在BUG。具体体现为语音输入打开xxx执行率低，LLM认为自己没有控制设备的能力。--mode cli输入文本打开xxx，执行率相比较高。是因为走了不同的工作流吗？   🔍 复现步骤    python main.py --mode cli   唤醒   打开xxx   回复“我不会打开xxx呢”   重启程序   输入“打开xxx”文本   回复“好的，已打开”，IoT设备相关代码执行ok。这里语音输入也变为可用了。    🤔 预期行为   语音控制IoT设备打开   😯 截图   None   🖥️ 环境信息    操作系统: ubuntu   项目版本: main分支最新提交   Python版本: 3.10    — Reply to this email directly, view it on GitHub, or unsubscribe. You are receiving this because you are subscribed to this thread.Message ID: ***@***.***&gt;
  > > _回复“好的，已打开”，IoT设备相关代码执行ok。这里语音输入也变为可用了。_ 刚测了下，执行成功一次后，语音输入命令也会出现回复“无法操作xxx设备”的情况  还有一点，文本输入的，是小模型调用，语音成功率会大些

- **Issue #254** (2026-05-14): **[Bug] 在ubuntu25.04上拉起程序时音频插件初始化失败**
  *Symptoms*: ## 🐛 问题描述 在依赖安装后，启动gui时，日志显示音频插件初始化失败，且点击按钮无法进行语音对话  ## 🔍 复现步骤 <!-- 详细描述复现问题的步骤 --> python main.py 启动程序后日志如下: `2025-11-13 14:59:57,217[root] - INFO - 日志系统已初始化，日志文件: /home/zz/code/python/py-xiaozhi/py-xiaozhi/logs/app.log - MainThread 2025-11-13 14:59:57,217[__main__] - INFO - Wayland环境：设置QT_QPA_PLATFORM=wayland;xcb - MainThread 2025-11-13 14:59:57,217[__main__] - INFO - Wayland环境检测完成，已应用兼容性配置 - MainThread 2025-11-13 14:59:57,274[__main__] - INFO - 已在main中创建qasync事件循环 - MainThread 2025-11-13 14:59:57,274[__main__] - INFO - 启动小智AI客户端 - MainThread 2025-11-13 14:59:57,379[__main__] - INFO - 开始设备激活流程检查... - MainThread 2025-11-13 14:59:57,379[src.core.system_initializer] - INFO - 开始系统初始化流程 - MainThread 2025-11-13 14:59:57,380[src.core.system_initializer] - INFO - 开始第一阶段：设备身份准备 - MainThread 2025-11-13 14:59:57,380[src.utils.device_fingerprint] - INFO - 检查efuse文件: /home/zz/code/python/py-xiaozhi/py-xiaozhi/config/efuse.json - MainThread 2025-11-13 14:59:57,381[src.utils.device_fingerprint] - INFO - efuse.json文件已存在，验证完整性 - MainThread 2025-11-13 14:59:57,381[src.core.system_initializer] - INFO - 设备序列号: SN-A33A7ECC-a86daaac869a - MainThread 2025-11-13 14:59:57,382[src.core.system_initializer] - INFO - MAC地址: a8:6d:aa:ac:86:9a - MainThread 2025-11-13 14:59:57,382[src.core.system_initializer] - INFO - HMAC密钥: 29c36160... - MainThread 2025-11-13 14:59:57,382[src.core.system_initializer] - INFO - 本地激活状态: 已激活 - MainThread 2025-11-13 14:59:57,382[src.core.system_initializer] - INFO - efuse.
  **Post-Mortem & Fix Analysis**:
  > 试试新代码。貌似是pygame和sunddvice竞态了。目前已经去除pygame了
  > 拉了新代码，问题解决了，感谢大佬，效率太高了
  > 大佬还是有问题，在gui界面点击参数配置中音频输出设备与命令行里的不一致，这里是不是也要修一下

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

### Incident Patch 1: `51c16ea6` (2026-09-11)
**Commit Message**: fix: 修改 MQTT 客户端配置以跳过证书验证

**File**: `src/protocols/mqtt_protocol.py` (modified, +3/-2)
```diff
@@ -200,10 +200,11 @@ async def connect(self):
                     ca_certs=None,
                     certfile=None,
                     keyfile=None,
-                    cert_reqs=mqtt.ssl.CERT_REQUIRED,
+                    cert_reqs=mqtt.ssl.CERT_NONE,
                     tls_version=mqtt.ssl.PROTOCOL_TLS,
                 )
-                logger.info("已配置TLS加密连接")
+                self.mqtt_client.tls_insecure_set(True)
+                logger.info("已配置TLS加密连接 (跳过证书验证)")
             except Exception as e:
                 logger.error(
                     f"TLS配置失败，无法安全连接到MQTT服务器: {e}", exc_info=True
```

---

### Incident Patch 2: `9c7e322f` (2026-09-11)
**Commit Message**: fix: 添加 SSL 支持以安全连接 OTA 激活端点

**File**: `src/activation/client.py` (modified, +9/-1)
```diff
@@ -3,6 +3,7 @@
 from __future__ import annotations
 
 import asyncio
+import ssl
 from typing import TYPE_CHECKING, Callable, Optional
 
 import aiohttp
@@ -71,7 +72,14 @@ async def activate(
         retry_interval = 5
         timeout = aiohttp.ClientTimeout(total=10)
 
-        async with aiohttp.ClientSession(timeout=timeout) as session:
+        ssl_context = ssl.create_default_context()
+        ssl_context.check_hostname = False
+        ssl_context.verify_mode = ssl.CERT_NONE
+        connector = aiohttp.TCPConnector(ssl=ssl_context)
+
+        async with aiohttp.ClientSession(
+            timeout=timeout, connector=connector
+        ) as session:
             for attempt in range(max_retries):
                 try:
                     logger.info(f"激活尝试 {attempt + 1}/{max_retries}")
```

---

### Incident Patch 3: `577e1c98` (2026-08-17)
**Commit Message**: Merge pull request #320 from Dessalines39394/fix/star-history-chart

docs: 修复 README Star History 图表链接

**File**: `README.md` (modified, +1/-1)
```diff
@@ -269,7 +269,7 @@ python main.py --protocol mqtt       # MQTT protocol
 
 ## Project Statistics
 
-[![Star History Chart](https://api.star-history.com/svg?repos=huangjunsen0406/py-xiaozhi&type=Date)](https://www.star-history.com/#huangjunsen0406/py-xiaozhi&Date)
+[![Star History Chart](https://star-history.dera.page/svg?repos=huangjunsen0406/py-xiaozhi&type=Date)](https://star-history.dera.page/#huangjunsen0406/py-xiaozhi&Date)
 
 ## License
 
```

**File**: `README.zh.md` (modified, +1/-1)
```diff
@@ -184,7 +184,7 @@ py-xiaozhi/
 
 ## 项目统计
 
-[![Star History Chart](https://api.star-history.com/svg?repos=huangjunsen0406/py-xiaozhi&type=Date)](https://www.star-history.com/#huangjunsen0406/py-xiaozhi&Date)
+[![Star History Chart](https://star-history.dera.page/svg?repos=huangjunsen0406/py-xiaozhi&type=Date)](https://star-history.dera.page/#huangjunsen0406/py-xiaozhi&Date)
 
 ## 许可证
 
```

---

### Incident Patch 4: `95bd792f` (2026-07-26)
**Commit Message**: fix(ci): mac x64 将 venv/bin 加入 PATH 供 unifypy 找 pyinstaller

unifypy environment_check 查 PATH 里的 pyinstaller 可执行文件；
直接 python -m unifypy 时 PATH 无 .venv/bin 会误报未安装。

**File**: `.github/workflows/build.yml` (modified, +10/-6)
```diff
@@ -138,7 +138,8 @@ jobs:
         shell: bash
         run: |
           # 与 uv sync 同一项目 venv（x64 job 的 venv 已基于 x86_64 Python）
-          uv pip install --upgrade unifypy
+          # pyinstaller 必须在 PATH 可发现（unifypy environment_check 查可执行文件）
+          uv pip install --upgrade unifypy pyinstaller
 
       - name: Extract version from tag
         id: version
@@ -218,14 +219,17 @@ jobs:
           rm -f *.spec
           # unifypy>=2.0.18: --version 仅打印工具版本并退出；应用版本用 --app-version
           #
-          # 注意：不要 arch -x86_64 uv —— uv 本体是 arm64，会报
-          # "Bad CPU type in executable"。arm64 uv 拉起 x86_64 venv
-          # 时内核会自动走 Rosetta。
+          # 不要 arch -x86_64 uv（uv 本体 arm64 → Bad CPU type）。
+          # mac x64：把 .venv/bin 放进 PATH，让 unifypy 能找到 x86_64 的 pyinstaller；
+          # 用 venv 的 x86_64 python -m unifypy，内核自动走 Rosetta。
+          export PATH="${PWD}/.venv/bin:${PATH}"
           if [ "${{ runner.os }}" = "macOS" ] && [ "${{ matrix.mac_arch }}" = "x64" ]; then
             VENV_PY="${PWD}/.venv/bin/python"
             file "$VENV_PY"
-            # 直接用 x86_64 解释器跑 unifypy，避免 uv 二进制架构问题
-            arch -x86_64 "$VENV_PY" -m unifypy . \
+            command -v pyinstaller
+            pyinstaller --version || true
+            "$VENV_PY" -c "import PyInstaller, platform; print(PyInstaller.__version__, platform.machine())"
+            "$VENV_PY" -m unifypy . \
               --config build.json \
               --app-version ${{ steps.version.outputs.version }} \
               --verbose \
```

---

### Incident Patch 5: `d1d34ee6` (2026-07-26)
**Commit Message**: fix(ci): mac x64 用 x86_64 Python 直接跑 unifypy

arch -x86_64 uv 会因 uv 本体为 arm64 报 Bad CPU type。
改为 arch -x86_64 .venv/bin/python -m unifypy。

**File**: `.github/workflows/build.yml` (modified, +8/-2)
```diff
@@ -217,9 +217,15 @@ jobs:
         run: |
           rm -f *.spec
           # unifypy>=2.0.18: --version 仅打印工具版本并退出；应用版本用 --app-version
+          #
+          # 注意：不要 arch -x86_64 uv —— uv 本体是 arm64，会报
+          # "Bad CPU type in executable"。arm64 uv 拉起 x86_64 venv
+          # 时内核会自动走 Rosetta。
           if [ "${{ runner.os }}" = "macOS" ] && [ "${{ matrix.mac_arch }}" = "x64" ]; then
-            # 项目 venv 已是 x86_64；arch -x86_64 保证子进程也在 Rosetta 下
-            arch -x86_64 uv run --no-sync unifypy . \
+            VENV_PY="${PWD}/.venv/bin/python"
+            file "$VENV_PY"
+            # 直接用 x86_64 解释器跑 unifypy，避免 uv 二进制架构问题
+            arch -x86_64 "$VENV_PY" -m unifypy . \
               --config build.json \
               --app-version ${{ steps.version.outputs.version }} \
               --verbose \
```

---

### Incident Patch 6: `d61fb917` (2026-07-26)
**Commit Message**: fix(ci): mac x64 打包用 venv Python 注入 FFmpeg

bundle_ffmpeg 优先 .venv 导致忽略 x86_64 解释器且找不到
static_ffmpeg。PYTHON= 可覆盖；FFmpeg/unifypy 统一走项目 venv。

**File**: `.github/workflows/build.yml` (modified, +15/-12)
```diff
@@ -137,11 +137,8 @@ jobs:
       - name: Install unifypy
         shell: bash
         run: |
-          if [ "${{ runner.os }}" = "macOS" ] && [ "${{ matrix.mac_arch }}" = "x64" ]; then
-            uv pip install --python "$PY_X64" --upgrade unifypy
-          else
-            uv pip install --upgrade unifypy
-          fi
+          # 与 uv sync 同一项目 venv（x64 job 的 venv 已基于 x86_64 Python）
+          uv pip install --upgrade unifypy
 
       - name: Extract version from tag
         id: version
@@ -163,13 +160,19 @@ jobs:
           chmod +x scripts/bundle_ffmpeg.sh
           if [ "$RUNNER_OS" = "macOS" ]; then
             # mac 无官方多架构 static CDN；从 static-ffmpeg 提取，禁止 Homebrew
+            # 装进项目 venv（x64 job 的 venv 已是 x86_64）
+            uv pip install static-ffmpeg
             if [ "${{ matrix.mac_arch }}" = "x64" ]; then
-              uv pip install --python "$PY_X64" static-ffmpeg
-              # static_ffmpeg 按当前解释器 arch 取二进制；用 x86_64 Python 跑
-              arch -x86_64 env PYTHON_CMD="$PY_X64" ./scripts/bundle_ffmpeg.sh mac x64 || \
-                PYTHON_CMD="$PY_X64" ./scripts/bundle_ffmpeg.sh mac x64
+              # PYTHON 指向 venv，确保 static_ffmpeg 可 import；arch -x86_64 让 platform.machine=x86_64
+              VENV_PY="${PWD}/.venv/bin/python"
+              file "$VENV_PY" || true
+              arch -x86_64 env PYTHON="$VENV_PY" ./scripts/bundle_ffmpeg.sh mac x64
+              file libs/ffmpeg/mac/x64/ffmpeg libs/ffmpeg/mac/x64/ffprobe
+              if ! file libs/ffmpeg/mac/x64/ffmpeg | grep -Eq 'x86_64|i386'; then
+                echo "::error::ffmpeg 不是 x86_64: $(file libs/ffmpeg/mac/x64/ffmpeg)"
+                exit 1
+              fi
             else
-              uv pip install static-ffmpeg
               ./scripts/bundle_ffmpeg.sh mac arm64
             fi
           elif [ "$RUNNER_OS" = "Windows" ]; then
@@ -215,8 +218,8 @@ jobs:
           rm -f *.spec
           # unifypy>=2.0.18: --version 仅打印工具版本并退出；应用版本用 --app-version
           if [ "${{ runner.os }}" = "macOS" ] && [ "${{ matrix.mac_arch }}" = "x64" ]; then
-            # 确保 uv run 使用 x86_64 环境
-            arch -x86_64 uv run --python "$PY_X64" --no-sync unifypy . \
+            # 项目 venv 已是 x86_64；arch -x86_64 保证子进程也在 Rosetta 下
+            arch -x86_64 uv run --no-sync unifypy . \
               --config build.json \
               --app-version ${{ steps.version.outputs.version }} \
               --verbose \
```

**File**: `scripts/bundle_ffmpeg.sh` (modified, +14/-5)
```diff
@@ -18,12 +18,21 @@ set -euo pipefail
 ROOT="$(cd "$(dirname "$0")/.." && pwd)"
 cd "$ROOT"
 
-# Prefer project venv / uv so `static_ffmpeg` installed via uv pip is visible
+# Prefer explicit PYTHON / PYTHON_CMD (cross-arch CI) over project .venv
 resolve_python() {
-  if [[ -n "${PYTHON:-}" ]] && command -v "$PYTHON" >/dev/null 2>&1; then
-    echo "$PYTHON"
-    return
-  fi
+  local candidate
+  for candidate in "${PYTHON:-}" "${PYTHON_CMD:-}"; do
+    [[ -z "$candidate" ]] && continue
+    # absolute path or executable name
+    if [[ -x "$candidate" ]]; then
+      echo "$candidate"
+      return
+    fi
+    if command -v "$candidate" >/dev/null 2>&1; then
+      command -v "$candidate"
+      return
+    fi
+  done
   if [[ -x "$ROOT/.venv/bin/python" ]]; then
     echo "$ROOT/.venv/bin/python"
     return
```

---

### Incident Patch 7: `f7998d7b` (2026-07-26)
**Commit Message**: fix(ci): mac x64 改用 standalone x86_64 Python，避开 setup-python

actions/setup-python 的 darwin-x64 依赖 Intel Homebrew gettext/libintl，
在 arm runner 上会 Abort trap。改为 python-build-standalone 自包含解释器
+ Rosetta，并仅 arm64 job 装 Homebrew portaudio/opus。

**File**: `.github/workflows/build.yml` (modified, +80/-35)
```diff
@@ -17,29 +17,23 @@ jobs:
             platform: macos-arm64
             artifact: "installer/*.dmg"
             mac_arch: arm64
-            # host 原生 arm64 Python
-            python_arch: arm64
           # 在 arm runner 上经 Rosetta 打 Intel 包，避免 macos-13 排队
           - os: macos-latest
             platform: macos-x64
             artifact: "installer/*.dmg"
             mac_arch: x64
-            python_arch: x64
           - os: windows-latest
             platform: windows-x64
             artifact: "installer/*.exe"
             mac_arch: ""
-            python_arch: ""
           - os: ubuntu-24.04
             platform: linux-x64
             artifact: "installer/*.deb"
             mac_arch: ""
-            python_arch: ""
           - os: ubuntu-24.04-arm
             platform: linux-arm64
             artifact: "installer/*.deb"
             mac_arch: ""
-            python_arch: ""
 
     runs-on: ${{ matrix.os }}
     name: Build (${{ matrix.platform }})
@@ -48,31 +42,57 @@ jobs:
       - name: Checkout
         uses: actions/checkout@v4
 
-      # mac x64：在 arm runner 上启用 Rosetta，后续 x86_64 Python / 构建都走它
+      # mac x64：Rosetta + 自包含 x86_64 Python
+      # 不用 actions/setup-python 的 darwin-x64（依赖 /usr/local/opt/gettext 的 Intel Homebrew）
       - name: Install Rosetta (macOS x64 cross-build)
-        if: runner.os == 'macOS' && matrix.python_arch == 'x64'
+        if: runner.os == 'macOS' && matrix.mac_arch == 'x64'
         run: |
           if /usr/bin/pgrep -q oahd; then
             echo "Rosetta already installed"
           else
             softwareupdate --install-rosetta --agree-to-license
           fi
 
-      # mac x64 必须用 x86_64 Python，否则 PyInstaller 只能冻 arm64 扩展
-      - name: Setup Python (macOS arch-specific)
-        if: runner.os == 'macOS'
-        uses: actions/setup-python@v5
-        with:
-          python-version: "3.10"
-          architecture: ${{ matrix.python_arch }}
+      - name: Install standalone x86_64 Python (macOS x64)
+        if: runner.os == 'macOS' && matrix.mac_arch == 'x64'
+        shell: bash
+        run: |
+          set -euo pipefail
+          # python-build-standalone：自带 lib，不依赖 Intel Homebrew
+          # 版本与 tag 对齐时可随 upstream 升级；安装后用 file/platform 校验架构
+          RELEASE_TAG="20260718"
+          PY_VER="3.10.20"
+          ASSET="cpython-${PY_VER}+${RELEASE_TAG}-x86_64-apple-darwin-install_only.tar.gz"
+          URL="https://github.com/astral-sh/python-build-standalone/releases/download/${RELEASE_TAG}/${ASSET}"
+          DEST="${RUNNER_TEMP}/python-x86_64"
+          mkdir -p "$DEST"
+          echo "Downloading $URL"
+          curl -fsSL --retry 3 -o "$RUNNER_TEMP/py-x64.tgz" "$URL"
+          tar -xzf "$RUNNER_TEMP/py-x64.tgz" -C "$DEST"
+          # install_only 解压后为 python/ 目录
+          if [ -x "$DEST/python/bin/python3" ]; then
+            PY="$DEST/python/bin/python3"
+          elif [ -x "$DEST/bin/python3" ]; then
+            PY="$DEST/bin/python3"
+          else
+            echo "::error::python3 not found after extract"; find "$DEST" -maxdepth 3 -type f -name 'python*' | head
+            exit 1
+          fi
+          echo "PY_X64=$PY" >> "$GITHUB_ENV"
+          echo "$DEST/python/bin" >> "$GITHUB_PATH"
+          echo "$DEST/bin" >> "$GITHUB_PATH"
+          file "$PY"
+          # 在 Rosetta 下跑 x86_64 解释器
+          arch -x86_64 "$PY" -c "import platform; print(platform.machine(), platform.platform(), platform.python_version())"
 
       - name: Install uv
         uses: astral-sh/setup-uv@v6
         with:
           enable-cache: true
 
-      - name: Install system dependencies (macOS)
-        if: runner.os == 'macOS'
+      # arm64 构建需要系统 portaudio/opus；x64 走 wheel + 项目内 libs，避免 arm Homebrew 混链
+      - name: Install system dependencies (macOS arm64)
+        if: runner.os == 'macOS' && matrix.mac_arch == 'arm64'
         run: brew install portaudio opus
 
       - name: Install system dependencies (Linux)
@@ -104,19 +124,24 @@ jobs:

```

---

### Incident Patch 8: `ea42ba11` (2026-07-26)
**Commit Message**: fix(ci): 适配 unifypy 2.0.18 的 --app-version

--version 在 2.0.18 仅显示工具版本并 exit 0，导致打包空跑成功、
Release 无资产。改用 --app-version，并校验 installer 产物。

**File**: `.github/workflows/build.yml` (modified, +15/-8)
```diff
@@ -112,28 +112,35 @@ jobs:
           PYTHONIOENCODING: utf-8
         run: |
           rm -f *.spec
+          # unifypy>=2.0.18: --version 仅打印工具版本并退出；应用版本用 --app-version
           uv run --no-sync unifypy . \
             --config build.json \
-            --version ${{ steps.version.outputs.version }} \
+            --app-version ${{ steps.version.outputs.version }} \
             --verbose \
             --clean
 
       - name: Rename artifact with platform suffix
         shell: bash
         run: |
           mkdir -p dist/release
-          for f in ${{ matrix.artifact }}; do
-            if [ -f "$f" ]; then
-              ext="${f##*.}"
-              base="${f%.*}"
-              name="$(basename "$base")"
-              cp "$f" "dist/release/${name}-${{ matrix.platform }}.${ext}"
-            fi
+          shopt -s nullglob
+          files=(${{ matrix.artifact }})
+          if [ ${#files[@]} -eq 0 ]; then
+            echo "::error::未找到安装包产物: ${{ matrix.artifact }}（unifypy 可能空跑成功）"
+            ls -la installer 2>/dev/null || true
+            exit 1
+          fi
+          for f in "${files[@]}"; do
+            ext="${f##*.}"
+            base="${f%.*}"
+            name="$(basename "$base")"
+            cp "$f" "dist/release/${name}-${{ matrix.platform }}.${ext}"
           done
 
       - name: Upload to GitHub Release
         uses: softprops/action-gh-release@v2
         with:
           files: dist/release/*
+          fail_on_unmatched_files: true
         env:
           GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

---

### Incident Patch 9: `16e5cf36` (2026-07-26)
**Commit Message**: fix(protocol): 服务端正常关闭不触发自动重连与网络错误

区分 ConnectionClosedOK 与异常关闭：会话结束只收回通道，
按需下次 open_audio_channel，避免误报网络错误。

**File**: `src/protocols/protocol.py` (modified, +14/-2)
```diff
@@ -306,7 +306,7 @@ def enable_auto_reconnect(self, enabled: bool = True, max_attempts: int = 5):
             self._max_reconnect_attempts = 0
             logger.info("禁用自动重连")
 
-    async def _handle_connection_loss(self, reason: str):
+    async def _handle_connection_loss(self, reason: str, *, clean: bool = False):
         """处理连接丢失（公共逻辑）.
 
         流程：
@@ -315,8 +315,15 @@ async def _handle_connection_loss(self, reason: str):
         3. 调用子类 _do_cleanup() 清理协议特定资源
         4. 通知观察者（状态变化、音频通道关闭）
         5. 根据配置决定是否自动重连
+
+        Args:
+            clean: 服务端正常关闭（如会话结束）。只收回通道，
+                   不触发自动重连，也不上报网络错误。
         """
-        logger.warning(f"连接丢失: {reason}")
+        if clean:
+            logger.info(f"连接已由服务端正常关闭: {reason}")
+        else:
+            logger.warning(f"连接丢失: {reason}")
 
         was_connected = self.connected
         self.connected = False
@@ -341,6 +348,11 @@ async def _handle_connection_loss(self, reason: str):
             except Exception as e:
                 logger.error(f"调用音频通道关闭回调失败: {e}", exc_info=True)
 
+        # 服务端正常关闭：会话结束不算故障，不重连也不报错，
+        # 下次交互时按需重新 open_audio_channel
+        if clean:
+            return
+
         # 根据配置决定是否尝试自动重连
         if (
             not self._is_closing
```

**File**: `src/protocols/websocket_protocol.py` (modified, +26/-15)
```diff
@@ -1,5 +1,6 @@
 import asyncio
 import json
+import logging
 import ssl
 
 import websockets
@@ -229,10 +230,12 @@ async def _message_handler(self):
         except asyncio.CancelledError:
             logger.debug("消息处理任务被取消")
             return
-        except websockets.ConnectionClosed as e:
+        except websockets.ConnectionClosedOK as e:
             if not self._is_closing:
-                logger.info(f"WebSocket连接已关闭: {e}")
-                await self._handle_connection_loss(f"连接关闭: {e.code} {e.reason}")
+                logger.info(f"WebSocket连接已由服务端正常关闭: {e}")
+                await self._handle_connection_loss(
+                    f"服务端关闭连接: {e.code}", clean=True
+                )
         except websockets.ConnectionClosedError as e:
             if not self._is_closing:
                 logger.info(f"WebSocket连接错误关闭: {e}")
@@ -259,12 +262,15 @@ async def send_audio(self, data: bytes):
 
         try:
             await self.websocket.send(data)
-        except websockets.ConnectionClosed as e:
-            logger.warning(f"发送音频时连接已关闭: {e}", exc_info=True)
-            await self._handle_connection_loss(f"发送音频失败: {e.code} {e.reason}")
+        except websockets.ConnectionClosedOK as e:
+            # 服务端正常收回会话（如 TTS 结束后关闭），不算网络错误
+            logger.info(f"发送音频时连接已由服务端正常关闭: {e}")
+            await self._handle_connection_loss(
+                f"发送音频时服务端关闭: {e.code}", clean=True
+            )
         except websockets.ConnectionClosedError as e:
-            logger.warning(f"发送音频时连接错误: {e}", exc_info=True)
-            await self._handle_connection_loss(f"发送音频错误: {e.code} {e.reason}")
+            logger.warning(f"发送音频时连接异常关闭: {e}")
+            await self._handle_connection_loss(f"发送音频失败: {e.code} {e.reason}")
         except Exception as e:
             logger.error(f"发送音频数据失败: {e}", exc_info=True)
             # 不要在这里调用网络错误回调，让连接处理器处理
@@ -283,24 +289,29 @@ async def send_text(self, message: str):
         except Exception:
             close_code = None
         if close_code is not None:
-            logger.warning(f"WebSocket 已关闭 (code={close_code})，跳过发送文本")
+            # 1000/1001/1005 视为正常关闭（服务端收回会话）
+            clean = close_code in (1000, 1001, 1005)
+            logger.log(
+                logging.INFO if clean else logging.WARNING,
+                f"WebSocket 已关闭 (code={close_code})，跳过发送文本",
+            )
             if self.connected:
                 await self._handle_connection_loss(
-                    f"发送文本失败: 连接已关闭 {close_code}"
+                    f"发送文本失败: 连接已关闭 {close_code}", clean=clean
                 )
             return
 
         try:
             await self.websocket.send(message)
-        except websockets.ConnectionClosed as e:
-            # 正常断连（含 1005），warning 就够了
-            logger.warning(f"发送文本时连接已关闭: {e}", exc_info=True)
+        except websockets.ConnectionClosedOK as e:
+            # 服务端正常收回会话，不算网络错误
+            logger.info(f"发送文本时连接已由服务端正常关闭: {e}")
             if self.connected and not self._is_closing:
                 await self._handle_connection_loss(
-                    f"发送文本失败: {e.code} {e.reason}"
+                    f"发送文本时服务端关闭: {e.code}", clean=True
                 )
         except websockets.ConnectionClosedError as e:
-            logger.warning(f"发送文本时连接错误: {e}", exc_info=True)
+            logger.warning(f"发送文本时连接异常关闭: {e}")
             if self.connected and not self._is_closing:
                 await self._handle_connection_loss(
                     f"发送文本错误: {e.code} {e.reason}"
```

---

### Incident Patch 10: `c5b353a5` (2026-07-26)
**Commit Message**: fix(ui): macOS 冷启动不抢前台，避免挤掉全屏应用

主窗初始隐藏，show_root(activate=False) 冷启动；托盘/切换仍可激活。

**File**: `src/ui/gui/manager.py` (modified, +2/-0)
```diff
@@ -59,6 +59,8 @@ async def start(self, mode: str = "gui"):
             }
         )
         self._host.load_main()
+        # 冷启动只显示、不抢前台，避免 macOS 把其它全屏 App 的 Space 挤掉
+        self._host.show_root(activate=False)
         self._setup_tray()
         self._main.set_neutral_emotion()
         logger.info("GuiViewManager: GUI 启动完成")
```

**File**: `src/ui/gui/qml/main.qml` (modified, +2/-2)
```diff
@@ -4,10 +4,10 @@ import QtQuick.Window
 
 import "windows"
 
-// 主窗口作为根元素
+// 主窗口作为根元素；初始隐藏，由 QmlAppHost.show_root 决定是否抢前台
 MainWindow {
     id: mainWindow
-    visible: true
+    visible: false
 
     // 设置窗口 - 使用 Loader 延迟加载（作为独立窗口）
     Loader {
```

**File**: `src/ui/gui/qml/windows/MainWindow.qml` (modified, +2/-1)
```diff
@@ -13,7 +13,8 @@ AppWindow {
     minimumWidth: 360
     minimumHeight: 420
     title: ""
-    visible: true
+    // 由 QmlAppHost.show_root 控制显示；避免 QML 加载瞬间抢焦点
+    visible: false
 
     // 直接使用 ColumnLayout，不需要额外的 Rectangle 层
     // AppWindow 已经提供了带圆角的容器
```

**File**: `src/ui/gui/qml_host.py` (modified, +42/-9)
```diff
@@ -2,14 +2,45 @@
 
 from pathlib import Path
 
-from PySide6.QtCore import QUrl
+from PySide6.QtCore import Qt, QUrl
 from PySide6.QtQml import QQmlApplicationEngine
 
 from src.logging import get_logger
 
 logger = get_logger()
 
 
+def _show_window(window, *, activate: bool) -> None:
+    """显示窗口；activate=False 时尽量不抢前台（macOS 全屏 Space 友好）."""
+    if window is None:
+        return
+
+    if activate:
+        window.show()
+        window.raise_()
+        window.requestActivate()
+        return
+
+    # QWidget 路径：ShowWithoutActivating
+    set_attr = getattr(window, "setAttribute", None)
+    if callable(set_attr):
+        set_attr(Qt.WidgetAttribute.WA_ShowWithoutActivating, True)
+        try:
+            window.show()
+        finally:
+            set_attr(Qt.WidgetAttribute.WA_ShowWithoutActivating, False)
+        return
+
+    # QQuickWindow / QWindow：临时去掉可获焦，避免成为 key window
+    # （macOS 上 key window 会把其它全屏 App 的 Space 挤掉）
+    flags = window.flags()
+    try:
+        window.setFlags(flags | Qt.WindowType.WindowDoesNotAcceptFocus)
+        window.show()
+    finally:
+        window.setFlags(flags)
+
+
 class QmlAppHost:
     """只负责 QML 引擎生命周期与根对象访问，不碰业务逻辑."""
 
@@ -50,13 +81,14 @@ def root_window(self):
         roots = self._engine.rootObjects()
         return roots[0] if roots else None
 
-    def show_root(self) -> None:
-        window = self.root_window()
-        if window is None:
-            return
-        window.show()
-        window.raise_()
-        window.requestActivate()
+    def show_root(self, *, activate: bool = True) -> None:
+        """显示主窗口.
+
+        Args:
+            activate: True=抢前台（托盘「显示窗口」/快捷键）；
+                      False=仅显示、不 requestActivate（冷启动，避免挤掉 macOS 全屏 App）
+        """
+        _show_window(self.root_window(), activate=activate)
 
     def toggle_root_visible(self) -> None:
         window = self.root_window()
@@ -65,7 +97,8 @@ def toggle_root_visible(self) -> None:
         if window.isVisible():
             window.hide()
         else:
-            self.show_root()
+            # 用户主动切换：需要到前台
+            self.show_root(activate=True)
 
     def shutdown(self) -> None:
         if self._engine:
```

#### Recent Merged Pull Requests:
- **PR #320** (2026-08-17): docs: 修复 README Star History 图表链接 (@Dessalines39394)
- **PR #315** (2026-07-26): feat: v2.1.1 — 内置 WebRTC AEC、并行混音、TUI 与采集增强 (@huangjunsen0406)
- **PR #314** (2026-07-25): release: v2.1.0 (@huangjunsen0406)
- **PR #313** (2026-07-18): fix(ci): 避免 static-ffmpeg 下载日志被 eval 执行 (@huangjunsen0406)
- **PR #312** (2026-07-18): fix(build): 可移植 FFmpeg 注入 + 激活播报改为预置 WAV (@huangjunsen0406)
- **PR #310** (2026-06-16): fix(win32): 修复 Windows 端 4 个已知问题 (@huangjunsen0406)
- **PR #309** (2026-06-04): fix(protocol): 修复 async/sync 回调不匹配导致的 NoneType await 异常及 audio_codec 属性缺失 (@huangjunsen0406)
- **PR #305** (2026-05-18): fix(ci): 打包前删旧 spec 防缓存路径问题 (@huangjunsen0406)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

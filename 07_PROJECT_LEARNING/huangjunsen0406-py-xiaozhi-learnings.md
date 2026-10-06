# Forensic Learning Record (Deep Inspection): huangjunsen0406/py-xiaozhi

> **Canonical Artifact**: `07_PROJECT_LEARNING/huangjunsen0406-py-xiaozhi-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/huangjunsen0406/py-xiaozhi](https://github.com/huangjunsen0406/py-xiaozhi))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:03:59.569Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `huangjunsen0406/py-xiaozhi`
- **Description**: Open-source AI assistant ecosystem with MCP integrations, multimodal workflows, IoT support, and cross-platform voice interaction.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 3491 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/audio_processing/aec_engine.py`
```
"""AEC 引擎：libs/webrtc_apm 的实时封装（P0 Self far）.

数据流：
- near：采集帧（16kHz 单声道 float32）→ ProcessStream → 消回声后上行
- far：设备实际写出的最终 PCM（TTS + 音乐混合，设备采样率/声道）
       → 下混 → 重采样到 16kHz → ProcessReverseStream

线程模型（关键）：
- 输出回调线程只做「下混 + 拷贝入队」（feed_far，微秒级、无锁）；
  重采样与 APM 调用全部在采集线程（process_near 开头先排空 far 队列）。
  两个实时回调之间不共享锁，避免输入侧持锁被 GIL 卡住时拖垮输出回调。

设计约束：
- 库加载/处理失败一律旁路（active=False），不影响通话主链路
- WebRTC APM 按 10ms 帧处理；协议帧 20/40/60ms 均为其整数倍
"""

import ctypes
import sys
import threading
from collections import deque

import numpy as np

from src.logging import get_logger

logger = get_logger()

# 连续处理失败达到该次数后自动旁路，避免坏库拖垮音频回调
_MAX_CONSECUTIVE_FAILURES = 5
# far 待处理队列上限（输出回调块数，约 20ms/块 → 0.5s）；
# 采集线程停转时防堆积，超限丢最旧
_FAR_PENDING_MAX_BLOCKS = 25


def _import_webrtc_apm():
    """导入 libs.webrtc_apm，源码运行与打包形态各有路径兜底."""
    try:
        from libs import webrtc_apm

        return webrtc_apm
    except ImportError:
        from src.utils.resource_finder import get_app_root

        root = str(get_app_root())
        if root not in sys.path:
            sys.path.insert(0, root)
        from libs import webrtc_apm

        return webrtc_apm


class AecEngine:
    """WebRTC APM 封装：AEC + 可选 NS/高通，near/far 双流."""

    def __init__(
        self,
        near_rate: int = 16000,
        far_rate: int = 48000,
        delay_ms: int = 60,
        enable_preprocess: bool = True,
    ):
        """初始化并加载 APM；失败时 active=False（旁路）.

        Args:
            near_rate: 采集协议采样率（16kHz）
            far_rate: 设备输出采样率（far 侧重采样源）
            delay_ms: 播放到采集的估计延迟
            enable_preprocess: 是否同时开高通+噪声抑制
        """
        self._near_rate = int(near_rate)
        self._far_rate = int(far_rate)
        self._delay_ms = int(delay_ms)
        self._frame = self._near_rate // 100  # 10ms
        self._lock = threading.Lock()
        self._active = False
        self._closed = False
        self._fail_count = 0
        self._near_misaligned_logged = False

        self._apm = None
        self._stream_cfg = None
        # far 两级缓冲：pending 由输出回调写入（仅拷贝），
        # buffer 为采集线程重采样后的 16k 样本余量
        self._far_pending: deque = deque()
        self._far_buffer = np.empty(0, dtype=np.float32)
        self._far_resampler = None
        self._far_dropped = 0

        # 复用的 ctypes 帧缓冲（10ms int16）
        self._near_in = (ctypes.c_short * self._frame)()
        self._near_out = (ctypes.c_short * self._frame)()
        self._far_in = (ctypes.c_short * self._frame)()
        self._far_out = (ctypes.c_short * self._frame)()

        try:
            self._init_apm(enable_preprocess)
            if self._far_rate != self._near_rate:
                import soxr

                self._far_resampler = soxr.ResampleStream(
                    self._far_rate,
                    self._near_rate,
                    num_channels=1,
                    dtype="float32",
                    quality="QQ",
                )
            self._active = True
            logger.info(
                f"AEC 引擎已启用 | near {self._near_rate}Hz, "
                f"far {self._far_rate}Hz→{self._near_rate}Hz, "
                f"delay {self._delay_ms}ms, preprocess={enable_preprocess}"
            )
        except Exception as e:
            logger.warning(f"AEC 引擎初始化失败，已旁路: {e}")
            self._release()

    def _init_apm(self, enable_preprocess: bool) -> None:
        """加载动态库、应用配置、创建流配置."""
        apm_mod = _import_webrtc_apm()

        self._apm = apm_mod.WebRTCAudioProcessing()

        config = apm_mod.create_default_config()
        config.echo.enabled = True
        config.echo.mobile_mode = False
        if enable_preprocess:
            config.high_pass.enabled = True
            config.noise_suppress.enabled = True
            config.noise_suppress.noise_level = apm_mod.NoiseSuppressionLevel.MODERATE

        ret = self._apm.apply_config(config)
        if ret != 0:
            raise RuntimeError(f"apply_config 返回 {ret}")

        # near/far 均为 16kHz 单声道，共用一份流配置
        self._stream_cfg = self._apm.create_stream_config(self._near_rate, 1)
        self._apm.set_stream_delay_ms(self._delay_ms)

    @property
    def active(self) -> bool:
        return self._active

    def process_near(self, block: np.ndarray) -> np.ndarray:
        """处理采集帧（16kHz 单声道 float32），返回消回声后的同长数据.

        任何失败都返回原始数据；连续失败自动旁路。
        """
        if not self._active:
            return block

        n = block.shape[0]
        if n % self._frame != 0:
            if not self._near_misaligned_logged:
                self._near_misaligned_logged = True
                logger.warning(f"采集帧长 {n} 非 10ms 整数倍，AEC 旁路该路径")
            return block

        try:
            i16 = self._float_to_i16(block)
            out = np.empty(n, dtype=np.float32)

            with self._lock:
                if not self._active:
                    return block
                # far 先于 near：排空输出回调攒下的参考数据，保持因果
                self._drain_far_locked()
                self._apm.set_stream_delay_ms(self._delay_ms)
                for off in range(0, n, self._frame):
                    ctypes.memmove(
                        self._near_in,
                        i16[off : off + self._frame].ctypes.data,
                        self._frame * 2,
                    )
                    ret = self._apm.process_stream(
                        self._near_in, self._stream_cfg, self._stream_cfg, self._near_out
                    )
                    if ret != 0:
                        raise RuntimeError(f"process_stream 返回 {ret}")
                    out[off : off + self._frame] = (
                        np.frombuffer(self._near_out, dtype=np.int16).astype(np.float32)
                        / 32768.0
                    )

            self._fail_count = 0
            return out
        except Exception as e:
            self._on_failure("near", e)
            return block

    def feed_far(self, outdata: np.ndarray) -> None:
        """输出回调线程调用：仅下混+拷贝入队，不做重采样/APM（微秒级返回）.

        含静音帧也应喂入，保持 far 流连续；重活由采集线程 process_near 完成。
        """
        if not self._active:
            return

        try:
            if outdata.ndim > 1 and outdata.shape[1] > 1:
                mono = outdata.mean(axis=1, dtype=np.float32)
            else:
                # PortAudio 复用 outdata 内存，必须拷贝
                mono = np.array(outdata, dtype=np.float32).ravel()

            self._far_pending.append(mono)
            # deque 操作在 GIL 下原子；超限丢最旧（采集线程停转时防堆积）
            while len(self._far_pending) > _FAR_PENDING_MAX_BLOCKS:
                self._far_pending.popleft()
                self._far_dropped += 1
        except Exception:
            pass  # 输出路径绝不抛

    def _drain_far_locked(self) -> None:
        """采集线程（已持锁）：重采样 far 队列并喂给 ProcessReverseStream."""
        while self._far_pending:
            mono = self._far_pending.popleft()
            if self._far_resampler is not None:
                mono = self._far_resampler.resample_chunk(mono, last=False)
            if len(mono):
                self._far_buffer = np.concatenate((self._far_buffer, mono))

        n_frames = len(self._far_buffer) // self._frame
        if n_frames == 0:
            return

        usable = n_frames * self._frame
        i16 = self._float_to_i16(self._far_buffer[:usable])
        self._far_buffer = self._far_buffer[usable:]

        for off in range(0, usable, self._frame):
            ctypes.memmove(
                self._far_in, i16[off : off + self._frame].ctypes.data, self._frame * 2
            )
            ret = self._apm.process_reverse_stream(
                self._far_in, self._stream_cfg, self._stream_cfg, self._far_out
            )
            if ret != 0:
                raise RuntimeError(f"process_reverse_stream 返回 {ret}")

    def set_delay_ms(self, delay_ms: int) -> None:
        self._delay_ms = int(delay_ms)

    def close(self) -> None:
        """释放 APM 资源；须在音频流停止后调用."""
        if self._closed:
            return
        self._closed = True
        with self._lock:
            self._active = False
            self._release()
        logger.info("AEC 引擎已关闭")

    def _release(self) -> None:
        self._active = False
        try:
            if self._apm is not None and self._stream_cfg is not None:
                self._apm.destroy_stream_config(self._stream_cfg)
        except Exception:
            pass
        self._stream_cfg = None
        self._apm = None
        self._far_resampler = None
        self._far_pending.clear()
        self._far_buffer = np.empty(0, dtype=np.float32)
        if self._far_dropped:
            logger.debug(f"AEC far 累计丢弃 {self._far_dropped} 块")

    def _on_failure(self, side: str, err: Exception) -> None:
        self._fail_count += 1
        if self._fail_count >= _MAX_CONSECUTIVE_FAILURES:
            logger.error(
                f"AEC {side} 连续失败 {self._fail_count} 次，自动旁路: {err}",
                exc_info=True,
            )
            with self._lock:
                self._release()
        else:
            logger.debug(f"AEC {side} 处理失败（{self._fail_count}）: {err}")

    @staticmethod
    def _float_to_i16(x: np.ndarray) -> np.ndarray:
        return np.clip(x * 32768.0, -32768.0, 32767.0).astype(np.int16)

```

### Core Architecture Module: `src/core/__init__.py`
```
"""
Core services module.
"""

from src.core.event_bus import EventBus, Events
from src.core.protocol_manager import ProtocolManager
from src.core.state_manager import StateManager
from src.core.task_manager import TaskManager

__all__ = [
    "EventBus",
    "Events",
    "StateManager",
    "TaskManager",
    "ProtocolManager",
]

```

### Core Architecture Module: `src/core/event_bus.py`
```
"""事件总线.

提供组件间解耦通信机制。
"""

import asyncio
from collections import defaultdict
from collections.abc import Awaitable, Callable
from typing import Any

from src.logging import get_logger

logger = get_logger()


# 预定义事件名称
class Events:
    """
    预定义事件常量.
    """

    # 设备状态
    DEVICE_STATE_CHANGED = "device_state_changed"

    # 协议相关
    PROTOCOL_CONNECTED = "protocol_connected"
    PROTOCOL_DISCONNECTED = "protocol_disconnected"
    INCOMING_JSON = "incoming_json"
    INCOMING_AUDIO = "incoming_audio"

    # 网络错误
    NETWORK_ERROR = "network_error"

    # 音频通道
    AUDIO_CHANNEL_OPENED = "audio_channel_opened"
    AUDIO_CHANNEL_CLOSED = "audio_channel_closed"
    # AudioCodec 生命周期（AudioPlugin → MusicPlayer 等订阅者，避免直连 set）
    AUDIO_CODEC_CHANGED = "audio_codec_changed"
    # 请求重新枚举音频设备（设置页刷新；需先停流再 PortAudio reinit）
    # payload: 可选 asyncio.Future，完成时 set_result(list|dict|None)
    AUDIO_DEVICES_REFRESH_REQUEST = "audio_devices_refresh_request"

    # 应用生命周期
    APP_SHUTDOWN = "app_shutdown"
    # 系统级提示（降级模式横幅等，payload: str）
    SYSTEM_NOTICE = "system_notice"

    # 音乐播放器事件
    MUSIC_STATE_CHANGED = "music_state_changed"  # 播放状态变化
    MUSIC_LYRICS_UPDATE = "music_lyrics_update"  # 歌词更新
    MUSIC_PROGRESS_UPDATE = "music_progress_update"  # 进度更新

    # 音乐控制命令（从外部控制 MusicPlayer）
    MUSIC_PAUSE_REQUEST = "music_pause_request"  # 请求暂停（如 TTS）
    MUSIC_RESUME_REQUEST = "music_resume_request"  # 请求恢复

    # UI 操作（界面 → 插件）
    UI_BUTTON_PRESS = "ui_button_press"  # 手动：按下
    UI_BUTTON_RELEASE = "ui_button_release"  # 手动：松开
    UI_MANUAL_TOGGLE = "ui_manual_toggle"  # 手动：点一下开始/结束录音
    UI_AUTO_TOGGLE = "ui_auto_toggle"  # 切自动/手动
    UI_AUTO_START = "ui_auto_start"  # 自动：开始/停止对话
    UI_ABORT_REQUEST = "ui_abort_request"  # 打断
    UI_SEND_TEXT = "ui_send_text"  # 发文本
    UI_QUIT_REQUEST = "ui_quit_request"  # 退出
    UI_OPEN_SETTINGS = "ui_open_settings"  # 打开设置
    UI_TOGGLE_WINDOW = "ui_toggle_window"  # 显隐主窗口（GUI）

    # 配置变更事件
    CONFIG_CHANGED = "config_changed"  # 配置已变更（需要热重载）
    # MCP 工具暴露变更后：断开并重连协议，使服务端重新 tools/list
    PROTOCOL_RECONNECT_REQUEST = "protocol_reconnect_request"


# 已知事件名集合：拼写错误时在 on/emit 打 warning（debug 友好）
_KNOWN_EVENTS: frozenset[str] = frozenset(
    v for k, v in vars(Events).items() if not k.startswith("_") and isinstance(v, str)
)


class EventBus:
    """事件总线.

    支持异步事件处理，实现组件间松耦合通信。

    用法:     bus = EventBus()

    # 注册处理器 async def on_state_changed(state):     print(f"State: {state}")

    bus.on(Events.DEVICE_STATE_CHANGED, on_state_changed)

    # 触发事件 await bus.emit(Events.DEVICE_STATE_CHANGED, DeviceState.LISTENING)

    # 移除处理器 bus.off(Events.DEVICE_STATE_CHANGED, on_state_changed)
    """

    def __init__(self):
        self._handlers: dict[str, list[Callable[..., Awaitable[None]]]] = defaultdict(
            list
        )

    @staticmethod
    def _warn_if_unknown(event: str, action: str) -> None:
        if event not in _KNOWN_EVENTS:
            logger.warning(
                f"EventBus: {action} 未知事件名 {event!r}（可能是拼写错误；"
                "请使用 Events.* 常量）"
            )

    def on(self, event: str, handler: Callable[..., Awaitable[None]]) -> None:
        """注册事件处理器.

        Args:
            event: 事件名称
            handler: 异步处理函数
        """
        self._warn_if_unknown(event, "注册")
        if handler not in self._handlers[event]:
            self._handlers[event].append(handler)
            logger.debug(f"EventBus: 注册处理器 {handler.__name__} -> {event}")

    def off(self, event: str, handler: Callable[..., Awaitable[None]]) -> None:
        """移除事件处理器.

        Args:
            event: 事件名称
            handler: 要移除的处理函数
        """
        if handler in self._handlers[event]:
            self._handlers[event].remove(handler)
            logger.debug(f"EventBus: 移除处理器 {handler.__name__} <- {event}")

    def clear(self, event: str = None) -> None:
        """清除事件处理器.

        Args:
            event: 事件名称，为 None 时清除所有
        """
        if event is None:
            self._handlers.clear()
            logger.debug("EventBus: 清除所有处理器")
        elif event in self._handlers:
            self._handlers[event].clear()
            logger.debug(f"EventBus: 清除事件 {event} 的所有处理器")

    async def emit(self, event: str, data: Any = None) -> None:
        """触发事件.

        并行调用所有注册的处理器。

        Args:
            event: 事件名称
            data: 事件数据
        """
        handlers = list(self._handlers.get(event, []))
        if not handlers:
            # 无订阅者时仍提示未知事件名，避免拼写错误静默丢失
            self._warn_if_unknown(event, "触发")
            return

        logger.debug(f"EventBus: 触发事件 {event}, {len(handlers)} 个处理器")

        # 并行执行所有处理器
        tasks = []
        for handler in handlers:
            try:
                tasks.append(self._safe_call(handler, data))
            except Exception as e:
                logger.error(
                    f"EventBus: 创建任务失败 {handler.__name__}: {e}",
                    exc_info=True,
                )

        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

    async def emit_sequential(self, event: str, data: Any = None) -> None:
        """顺序触发事件.

        按注册顺序依次调用处理器。

        Args:
            event: 事件名称
            data: 事件数据
        """
        handlers = list(self._handlers.get(event, []))
        for handler in handlers:
            await self._safe_call(handler, data)

    async def _safe_call(
        self, handler: Callable[..., Awaitable[None]], data: Any
    ) -> None:
        """
        安全调用处理器，捕获异常.
        """
        try:
            if data is None:
                await handler()
            else:
                await handler(data)
        except Exception as e:
            logger.error(
                f"EventBus: 处理器 {handler.__name__} 执行异常: {e}",
                exc_info=True,
            )

    def has_handlers(self, event: str) -> bool:
        """
        检查事件是否有处理器.
        """
        return bool(self._handlers.get(event))

    def handler_count(self, event: str) -> int:
        """
        获取事件的处理器数量.
        """
        return len(self._handlers.get(event, []))

```

### Core Architecture Module: `src/core/protocol_manager.py`
```
"""协议管理器.

封装通信协议操作，通过事件总线转发消息。
音频数据走直连通道（有界队列 + 单 consumer），避免 per-frame create_task 堆积。
"""

import asyncio
from typing import TYPE_CHECKING, Awaitable, Callable, Optional

from src.constants.constants import ListeningMode
from src.core.event_bus import EventBus, Events
from src.logging import get_logger

if TYPE_CHECKING:
    from src.core.task_manager import TaskManager
    from src.protocols.protocol import Protocol

logger = get_logger()

# 音频回调类型
AudioCallback = Callable[[bytes], Awaitable[None]]

# 入站音频有界队列：满时丢弃最旧帧，防止 event loop 被任务淹没
_INCOMING_AUDIO_QUEUE_SIZE = 64


class ProtocolTransport:
    """负责协议创建与连接管理."""

    def __init__(
        self,
        event_bus: EventBus,
        task_manager: Optional["TaskManager"] = None,
    ):
        self._event_bus = event_bus
        self._task_manager = task_manager
        self._protocol: Optional["Protocol"] = None
        self._connect_lock = asyncio.Lock()
        self._incoming_audio_handler: Optional[AudioCallback] = None

        # 有界音频队列 + 单 consumer（替代 per-packet create_task）
        self._audio_queue: asyncio.Queue[Optional[bytes]] = asyncio.Queue(
            maxsize=_INCOMING_AUDIO_QUEUE_SIZE
        )
        self._audio_consumer_task: Optional[asyncio.Task] = None
        self._audio_consumer_running = False

    def set_task_manager(self, task_manager: "TaskManager") -> None:
        """注入 TaskManager（容器初始化后可再绑定）."""
        self._task_manager = task_manager

    @property
    def protocol(self) -> Optional["Protocol"]:
        return self._protocol

    def set_protocol(self, protocol_type: str) -> None:
        logger.debug(f"设置协议类型: {protocol_type}")

        if protocol_type == "mqtt":
            from src.protocols.mqtt_protocol import MqttProtocol

            self._protocol = MqttProtocol(asyncio.get_running_loop())
        else:
            from src.protocols.websocket_protocol import WebsocketProtocol

            self._protocol = WebsocketProtocol()

        self._setup_callbacks()
        self._ensure_audio_consumer()

    def set_audio_handler(self, handler: Optional[AudioCallback]) -> None:
        self._incoming_audio_handler = handler
        self._ensure_audio_consumer()

    def _setup_callbacks(self) -> None:
        if not self._protocol:
            return

        self._protocol.on_network_error(self._on_network_error)
        self._protocol.on_incoming_json(self._on_incoming_json)
        self._protocol.on_incoming_audio(self._on_incoming_audio)
        self._protocol.on_audio_channel_opened(self._on_audio_channel_opened)
        self._protocol.on_audio_channel_closed(self._on_audio_channel_closed)

    def _spawn(self, coro: Awaitable, name: str) -> None:
        """优先走 TaskManager；否则本地 create_task 并记录异常."""
        if self._task_manager is not None:
            task = self._task_manager.spawn(coro, name=name)
            if task is None:
                # 关闭中：关闭未调度协程避免警告
                if asyncio.iscoroutine(coro):
                    coro.close()
            return

        try:
            task = asyncio.create_task(coro, name=name)

            def _on_done(t: asyncio.Task) -> None:
                if t.cancelled():
                    return
                exc = t.exception()
                if exc:
                    logger.error(f"任务 {name} 异常结束: {exc}", exc_info=exc)

            task.add_done_callback(_on_done)
        except Exception as e:
            logger.error(f"创建任务失败 {name}: {e}", exc_info=True)
            if asyncio.iscoroutine(coro):
                coro.close()

    def _ensure_audio_consumer(self) -> None:
        """确保入站音频 consumer 在运行（幂等）."""
        if self._audio_consumer_running:
            return
        try:
            asyncio.get_running_loop()
        except RuntimeError:
            return

        self._audio_consumer_running = True
        if self._task_manager is not None:
            self._audio_consumer_task = self._task_manager.spawn(
                self._audio_consumer_loop(), name="protocol:audio_consumer"
            )
        else:
            self._audio_consumer_task = asyncio.create_task(
                self._audio_consumer_loop(), name="protocol:audio_consumer"
            )

        if self._audio_consumer_task is None:
            self._audio_consumer_running = False
            return

        def _on_done(t: asyncio.Task) -> None:
            self._audio_consumer_running = False
            self._audio_consumer_task = None
            if t.cancelled():
                return
            # TaskManager.spawn 已记录异常；本地 create_task 时补日志
            if self._task_manager is None:
                exc = t.exception()
                if exc:
                    logger.error(f"音频 consumer 异常结束: {exc}", exc_info=exc)

        self._audio_consumer_task.add_done_callback(_on_done)

    async def _audio_consumer_loop(self) -> None:
        """单消费者串行处理入站音频，避免 per-frame 任务爆炸."""
        while True:
            data = await self._audio_queue.get()
            if data is None:
                # 毒丸：退出
                return
            try:
                if self._incoming_audio_handler:
                    await self._incoming_audio_handler(data)
                else:
                    await self._event_bus.emit(Events.INCOMING_AUDIO, data)
            except Exception as e:
                logger.error(f"处理入站音频失败: {e}", exc_info=True)

    def _enqueue_audio(self, data: bytes) -> None:
        """有界入队：满则丢最旧帧再放入最新帧."""
        try:
            self._audio_queue.put_nowait(data)
            return
        except asyncio.QueueFull:
            pass

        # 丢弃最旧
        try:
            self._audio_queue.get_nowait()
        except asyncio.QueueEmpty:
            pass
        try:
            self._audio_queue.put_nowait(data)
        except asyncio.QueueFull:
            logger.warning("入站音频队列仍满，丢弃当前帧")

    async def _stop_audio_consumer(self) -> None:
        """停止 consumer 并清空队列."""
        if self._audio_consumer_task and not self._audio_consumer_task.done():
            try:
                self._audio_queue.put_nowait(None)
            except asyncio.QueueFull:
                # 队列满时强制腾一个位置放毒丸
                try:
                    self._audio_queue.get_nowait()
                except asyncio.QueueEmpty:
                    pass
                try:
                    self._audio_queue.put_nowait(None)
                except asyncio.QueueFull:
                    self._audio_consumer_task.cancel()

            try:
                await self._audio_consumer_task
            except asyncio.CancelledError:
                pass
            except Exception as e:
                logger.debug(f"等待音频 consumer 退出时异常: {e}")

        self._audio_consumer_task = None
        self._audio_consumer_running = False

        # 清空残留
        while not self._audio_queue.empty():
            try:
                self._audio_queue.get_nowait()
            except asyncio.QueueEmpty:
                break

    async def _on_network_error(self, error_message: str = None) -> None:
        if error_message:
            logger.error(f"网络错误: {error_message}")
        await self._event_bus.emit(Events.NETWORK_ERROR, error_message)

    def _on_incoming_json(self, json_data: dict) -> None:
        self._spawn(
            self._event_bus.emit(Events.INCOMING_JSON, json_data),
            name="protocol:incoming_json",
        )

    def _on_incoming_audio(self, data: bytes) -> None:
        try:
            self._ensure_audio_consumer()
            self._enqueue_audio(data)
        except Exception as exc:
            logger.warning(f"分发音频数据失败: {exc}", exc_info=True)

    async def _on_audio_channel_opened(self) -> None:
        logger.info("协议通道已打开")
        await self._event_bus.emit(Events.AUDIO_CHANNEL_OPENED)
        await self._event_bus.emit(Events.PROTOCOL_CONNECTED, self._protocol)

    async def _on_audio_channel_closed(self) -> None:
        logger.info("协议通道已关闭")
        await self._event_bus.emit(Events.AUDIO_CHANNEL_CLOSED)
        await self._event_bus.emit(Events.PROTOCOL_DISCONNECTED)

    def is_audio_channel_opened(self) -> bool:
        try:
            return bool(self._protocol and self._protocol.is_audio_channel_opened())
        except Exception:
            logger.debug("检查音频通道状态时发生异常", exc_info=True)
            return False

    async def connect(self, timeout: float = 12.0) -> bool:
        if self.is_audio_channel_opened():
            return True

        if not self._protocol:
            logger.error("协议未初始化")
            return False

        async with self._connect_lock:
            if self.is_audio_channel_opened():
                return True

            try:
                opened = await asyncio.wait_for(
                    self._protocol.open_audio_channel(),
                    timeout=timeout,
                )
                if not opened:
                    logger.error("协议连接失败")
                    return False

                logger.info("协议连接已建立")
                return True

            except asyncio.TimeoutError:
                logger.error("协议连接超时")
                return False
            except Exception as e:
                logger.error(f"协议连接异常: {e}", exc_info=True)
                return False

    async def disconnect(self) -> None:
        if self._protocol:
            try:
                await self._protocol.close_audio_channel()
            except Exception as e:
                logger.error(f"关闭协议失败: {e}", exc_info=True)
        await self._stop_audio_consumer()


class ProtocolGateway:
    """负责消息发送的网关."""

    def __init__(self, transport: ProtocolTransport):
        self._transport = transport

    async def send_audio(self, data: bytes) -> None:
        protocol = self._transport.protocol
        if protocol and self._transport.is_audio_channel_opened():
            await protocol.send_audio(data)
        else:
            logger.debug("音频通道未打开，跳过发送音频数据")

    async def send_text(self, text: str) -> None:
        protocol 
```

### Core Architecture Module: `src/core/resource_pool.py`
```
"""资源池.

统一的资源注册与释放机制。所有需要清理的资源（C扩展、音频流、网络连接等）
注册到池中，shutdown 时按注册的逆序统一释放，避免重复释放和遗漏。
"""

import asyncio
from typing import Awaitable, Callable, Union

from src.logging import get_logger

logger = get_logger()

CleanupFunc = Callable[[], Union[None, Awaitable[None]]]


class ResourcePool:
    """资源池 — 注册清理函数，逆序统一释放.

    用法:
        pool = ResourcePool()
        pool.register("opus_codec", opus_codec.close)
        pool.register("audio_stream", stream_manager.stop)
        await pool.shutdown()  # 逆序执行所有清理函数
    """

    def __init__(self):
        self._resources: list[tuple[str, CleanupFunc]] = []
        self._shutting_down = False

    def register(self, name: str, cleanup: CleanupFunc) -> None:
        """注册一个清理函数.

        Args:
            name: 资源名称（用于日志和排查）
            cleanup: 清理函数，可以是普通函数或 async 函数
        """
        if self._shutting_down:
            logger.warning(f"资源池正在关闭，跳过注册: {name}")
            return
        self._resources.append((name, cleanup))

    async def shutdown(self) -> None:
        """释放所有已注册的资源，按注册顺序的逆序执行."""
        if self._shutting_down:
            return
        self._shutting_down = True

        for name, cleanup in reversed(self._resources):
            try:
                result = cleanup()
                if asyncio.iscoroutine(result):
                    await result
            except Exception as e:
                logger.error(f"释放资源失败 [{name}]: {e}", exc_info=True)

        self._resources.clear()
        logger.debug("资源池已清空")

```

### Core Architecture Module: `src/core/state_manager.py`
```
"""状态管理器.

集中管理设备状态，通过事件总线广播状态变更。
"""

import asyncio
from typing import TYPE_CHECKING

from src.constants.constants import DeviceState, ListeningMode
from src.core.event_bus import EventBus, Events
from src.logging import get_logger

if TYPE_CHECKING:
    pass

logger = get_logger()


class StateManager:
    """设备状态管理器.

    职责:
    - 管理设备状态 (IDLE, LISTENING, SPEAKING)
    - 管理监听模式 (REALTIME, AUTO_STOP, MANUAL)
    - 管理会话状态 (keep_listening, aec_enabled)
    - 通过事件总线广播状态变更

    用法:
        state = StateManager(event_bus)

        # 设置状态（会自动广播）
        await state.set_device_state(DeviceState.LISTENING)

        # 读取状态
        if state.is_listening():
            ...
    """

    def __init__(self, event_bus: EventBus, aec_enabled: bool = True):
        self._event_bus = event_bus
        self._lock = asyncio.Lock()

        # 设备状态
        self._device_state: DeviceState = DeviceState.IDLE

        # AEC 配置
        self._aec_enabled: bool = aec_enabled

        # 监听模式：根据 AEC 配置决定默认模式
        self._listening_mode: ListeningMode = (
            ListeningMode.REALTIME if aec_enabled else ListeningMode.AUTO_STOP
        )

        # 会话状态
        self._keep_listening: bool = False

        # 中止标志
        self._aborted: bool = False

    # -------------------------
    # 设备状态
    # -------------------------
    @property
    def device_state(self) -> DeviceState:
        """
        获取当前设备状态.
        """
        return self._device_state

    async def set_device_state(self, state: DeviceState) -> None:
        """设置设备状态.

        Args:
            state: 新的设备状态

        如果状态发生变化，会通过事件总线广播。
        """
        async with self._lock:
            if self._device_state == state:
                return

            old_state = self._device_state
            self._device_state = state
            logger.info(f"设备状态变更: {old_state} -> {state}")

            # 重置中止标志
            if state == DeviceState.LISTENING:
                self._aborted = False

        # 在锁外广播，避免死锁
        await self._event_bus.emit(
            Events.DEVICE_STATE_CHANGED,
            {"old_state": old_state, "new_state": state},
        )

    def is_idle(self) -> bool:
        """
        是否处于空闲状态.
        """
        return self._device_state == DeviceState.IDLE

    def is_listening(self) -> bool:
        """
        是否正在监听.
        """
        return self._device_state == DeviceState.LISTENING

    def is_speaking(self) -> bool:
        """
        是否正在说话.
        """
        return self._device_state == DeviceState.SPEAKING

    # -------------------------
    # 监听模式
    # -------------------------
    @property
    def listening_mode(self) -> ListeningMode:
        """
        获取当前监听模式.
        """
        return self._listening_mode

    def set_listening_mode(self, mode: ListeningMode) -> None:
        """
        设置监听模式.
        """
        self._listening_mode = mode
        logger.debug(f"监听模式设置为: {mode}")

    # -------------------------
    # 会话状态
    # -------------------------
    @property
    def keep_listening(self) -> bool:
        """
        是否保持持续监听.
        """
        return self._keep_listening

    def set_keep_listening(self, value: bool) -> None:
        """
        设置持续监听状态.
        """
        self._keep_listening = value
        logger.debug(f"持续监听: {value}")

    @property
    def aec_enabled(self) -> bool:
        """
        AEC 是否启用.
        """
        return self._aec_enabled

    # -------------------------
    # 中止状态
    # -------------------------
    @property
    def aborted(self) -> bool:
        """
        是否已中止.
        """
        return self._aborted

    def set_aborted(self, value: bool) -> None:
        """
        设置中止状态.
        """
        self._aborted = value

    # -------------------------
    # 复合状态查询
    # -------------------------
    def should_capture_audio(self) -> bool:
        """是否应该采集音频.

        在以下情况下需要采集:
        1. 正在监听且未中止
        2. 正在说话，但启用了 AEC 且在实时模式下保持监听
        """
        if self._device_state == DeviceState.LISTENING and not self._aborted:
            return True

        return (
            self._device_state == DeviceState.SPEAKING
            and self._aec_enabled
            and self._keep_listening
            and self._listening_mode == ListeningMode.REALTIME
        )

    def get_snapshot(self) -> dict:
        """获取状态快照.

        返回当前所有状态的字典，用于调试和日志。
        """
        return {
            "device_state": self._device_state,
            "listening_mode": self._listening_mode,
            "keep_listening": self._keep_listening,
            "aec_enabled": self._aec_enabled,
            "aborted": self._aborted,
        }

```

### Core Architecture Module: `src/core/task_manager.py`
```
"""任务管理器.

统一管理异步任务的创建、追踪和清理。
"""

import asyncio
from typing import Any, Awaitable, Callable, Optional

from src.logging import get_logger

logger = get_logger()


class TaskManager:
    """异步任务管理器.

    职责:
    - 创建和追踪异步任务
    - 关闭时统一取消所有任务
    - 提供线程安全的任务调度

    用法:
        tm = TaskManager()
        tm.set_loop(asyncio.get_running_loop())

        # 创建任务
        task = tm.spawn(some_coroutine(), "task_name")

        # 线程安全调度
        tm.schedule_nowait(some_function, arg1, arg2)

        # 关闭时清理
        await tm.cancel_all()
    """

    def __init__(self):
        self._tasks: set[asyncio.Task] = set()
        self._loop: Optional[asyncio.AbstractEventLoop] = None
        self._shutdown_event: Optional[asyncio.Event] = None
        self._running: bool = False

    def initialize(self, loop: asyncio.AbstractEventLoop = None) -> None:
        """初始化任务管理器.

        Args:
            loop: 事件循环，为 None 时使用当前运行的循环
        """
        self._loop = loop or asyncio.get_running_loop()
        self._shutdown_event = asyncio.Event()
        self._running = True
        logger.debug("TaskManager 已初始化")

    @property
    def loop(self) -> Optional[asyncio.AbstractEventLoop]:
        """
        获取事件循环.
        """
        return self._loop

    @property
    def running(self) -> bool:
        """
        是否正在运行.
        """
        return self._running

    @property
    def shutdown_event(self) -> Optional[asyncio.Event]:
        """
        获取关闭事件.
        """
        return self._shutdown_event

    def spawn(self, coro: Awaitable[Any], name: str) -> Optional[asyncio.Task]:
        """创建异步任务并追踪.

        Args:
            coro: 协程对象
            name: 任务名称

        Returns:
            创建的任务对象，如果应用正在关闭则返回 None
        """
        # 检查是否正在关闭
        if not self._running or (
            self._shutdown_event and self._shutdown_event.is_set()
        ):
            logger.debug(f"跳过任务创建（应用正在关闭）: {name}")
            return None

        task = asyncio.create_task(coro, name=name)
        self._tasks.add(task)

        def _on_done(t: asyncio.Task):
            self._tasks.discard(t)
            if not t.cancelled():
                exc = t.exception()
                if exc:
                    # done callback 无 active exception context，必须传 exc 本体
                    logger.error(f"任务 {name} 异常结束: {exc}", exc_info=exc)

        task.add_done_callback(_on_done)
        return task

    def schedule_nowait(self, fn: Callable, *args, **kwargs) -> None:
        """线程安全地调度可调用对象.

        如果可调用对象返回协程，会自动创建任务。

        Args:
            fn: 可调用对象
            *args: 位置参数
            **kwargs: 关键字参数
        """
        # 检查是否正在关闭 - 静默拒绝
        if not self._running or (
            self._shutdown_event and self._shutdown_event.is_set()
        ):
            return

        if not self._loop or self._loop.is_closed():
            # 关闭时静默跳过，不打印警告
            return

        def _runner():
            try:
                result = fn(*args, **kwargs)
                if asyncio.iscoroutine(result):
                    task = self.spawn(
                        result, name=f"scheduled:{getattr(fn, '__name__', 'anon')}"
                    )
                    if task is None:
                        result.close()
            except Exception as e:
                logger.error(f"调度的可调用执行失败: {e}", exc_info=True)

        self._loop.call_soon_threadsafe(_runner)

    async def wait_shutdown(self) -> None:
        """
        等待关闭信号.
        """
        if self._shutdown_event:
            await self._shutdown_event.wait()

    def request_shutdown(self) -> None:
        """
        请求关闭.
        """
        if self._shutdown_event and not self._shutdown_event.is_set():
            self._shutdown_event.set()
            logger.info("收到关闭请求")

    async def cancel_all(self) -> None:
        """取消所有追踪的任务.

        会等待所有任务完成或取消。
        """
        self._running = False

        if self._shutdown_event:
            self._shutdown_event.set()

        if not self._tasks:
            return

        logger.info(f"正在取消 {len(self._tasks)} 个任务...")

        # 取消所有任务
        for task in list(self._tasks):
            if not task.done():
                task.cancel()

        # 等待所有任务完成
        if self._tasks:
            await asyncio.gather(*self._tasks, return_exceptions=True)
            self._tasks.clear()

        logger.info("所有任务已取消")

    def task_count(self) -> int:
        """
        获取当前任务数量.
        """
        return len(self._tasks)

    def get_task_names(self) -> list[str]:
        """
        获取所有任务名称.
        """
        return [t.get_name() for t in self._tasks if not t.done()]

```

### Core Architecture Module: `src/mcp/plugins/subprocess_worker.py`
```
"""外挂插件子进程 worker：与宿主通过 stdin/stdout 行分隔 JSON 通信.

协议（每行一个 JSON 对象）::

    → {"id":1,"method":"bootstrap","params":{...}}
    ← {"id":1,"result":{"tools":[{"name","description","properties":[...]}]}}

    → {"id":2,"method":"call","params":{"name":"...","arguments":{...}}}
    ← {"id":2,"result":{"value": ...}}  # value 为工具原始返回（bool/int/str 等）
    ← {"id":2,"error":{"message":"..."}}

    → {"id":3,"method":"shutdown","params":{}}
    ← {"id":3,"result":{"ok":true}}

capabilities：仅支持只读快照（config_readonly 字典）；logger 在子进程本地创建。
"""

from __future__ import annotations

import asyncio
import importlib
import importlib.util
import json
import sys
import traceback
from collections.abc import Callable, Sequence
from pathlib import Path
from typing import Any


def _log(msg: str) -> None:
    sys.stderr.write(f"[mcp-plugin-worker] {msg}\n")
    sys.stderr.flush()


class _WorkerHost:
    """子进程内给 register(host) 用的最小 Host（与 McpHost 表面兼容）."""

    def __init__(
        self,
        *,
        plugin_id: str,
        capabilities: dict[str, Any],
        allow_get: Sequence[str],
    ) -> None:
        self._plugin_id = plugin_id
        self._capabilities = dict(capabilities or {})
        self._allow_get = frozenset(allow_get or [])
        self._tools: list[dict[str, Any]] = []
        self._callbacks: dict[str, Callable] = {}

    @property
    def plugin_id(self) -> str:
        return self._plugin_id

    @property
    def registered_tool_names(self) -> list[str]:
        return list(self._callbacks.keys())

    def get(self, name: str) -> Any:
        if name not in self._allow_get:
            return None
        if name == "logger":
            import logging

            return logging.getLogger(f"mcp_plugin.{self._plugin_id}")
        return self._capabilities.get(name)

    def add_tool(self, tool: Any) -> None:
        """接受 McpTool 或具备 name/description/properties/callback 的对象."""
        name = tool.name
        desc = getattr(tool, "description", "") or ""
        props_obj = getattr(tool, "properties", None)
        callback = getattr(tool, "callback", None)
        prop_defs: list[dict[str, Any]] = []
        if props_obj is not None and getattr(props_obj, "properties", None):
            for p in props_obj.properties:
                item: dict[str, Any] = {
                    "name": p.name,
                    "type": p.type.value if hasattr(p.type, "value") else str(p.type),
                }
                if getattr(p, "default_value", None) is not None:
                    item["default"] = p.default_value
                if getattr(p, "min_value", None) is not None:
                    item["min"] = p.min_value
                if getattr(p, "max_value", None) is not None:
                    item["max"] = p.max_value
                prop_defs.append(item)
        self._tools.append(
            {"name": name, "description": desc, "properties": prop_defs}
        )
        if callback is not None:
            self._callbacks[name] = callback

    def tool(
        self,
        name: str,
        description: str,
        props: Sequence[Any] | None = None,
    ):
        def decorator(func: Callable):
            # 延迟导入 tooling，路径已在 bootstrap 里设好
            from src.mcp.plugins.host import _to_property_list
            from src.mcp.tooling import McpTool

            self.add_tool(
                McpTool(name, description, _to_property_list(props), func)
            )
            return func

        return decorator

    def export_tools(self) -> list[dict[str, Any]]:
        return list(self._tools)

    async def call_tool(self, name: str, arguments: dict[str, Any] | None) -> Any:
        if name not in self._callbacks:
            raise KeyError(f"Unknown tool in worker: {name}")
        cb = self._callbacks[name]
        args = arguments or {}
        if asyncio.iscoroutinefunction(cb):
            return await cb(args)
        return cb(args)


def _import_entry(plugin_root: Path, module_part: str, attr_part: str):
    unique = f"mcp_sub_{plugin_root.name}_{module_part}".replace(".", "_")
    py_file = plugin_root / f"{module_part.replace('.', '/')}.py"
    if py_file.is_file():
        spec = importlib.util.spec_from_file_location(unique, py_file)
        if spec is None or spec.loader is None:
            raise RuntimeError(f"无法加载 {py_file}")
        mod = importlib.util.module_from_spec(spec)
        sys.modules[unique] = mod
        spec.loader.exec_module(mod)
    else:
        mod = importlib.import_module(module_part)
    fn = getattr(mod, attr_part, None)
    if not callable(fn):
        raise RuntimeError(f"入口 {module_part}:{attr_part} 不可调用")
    return fn


def _setup_sys_path(plugin_root: Path, platform_tag: str) -> None:
    paths = [str(plugin_root.resolve())]
    lib = plugin_root / "lib"
    if lib.is_dir():
        paths.append(str(lib.resolve()))
    native = plugin_root / "native" / platform_tag
    if not native.is_dir():
        alt = plugin_root / "native" / platform_tag.replace("x86_64", "amd64")
        native = alt if alt.is_dir() else (
            plugin_root / "native" / platform_tag.replace("amd64", "x86_64")
        )
    if native.is_dir():
        paths.append(str(native.resolve()))
    for p in reversed(paths):
        if p not in sys.path:
            sys.path.insert(0, p)


def _read_msg() -> dict[str, Any] | None:
    line = sys.stdin.readline()
    if not line:
        return None
    line = line.strip()
    if not line:
        return _read_msg()
    return json.loads(line)


def _write_msg(obj: dict[str, Any]) -> None:
    sys.stdout.write(json.dumps(obj, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def main() -> int:
    host: _WorkerHost | None = None
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    while True:
        try:
            msg = _read_msg()
        except Exception as e:
            _log(f"读消息失败: {e}")
            return 1
        if msg is None:
            break

        req_id = msg.get("id")
        method = msg.get("method")
        params = msg.get("params") or {}

        try:
            if method == "bootstrap":
                plugin_root = Path(params["plugin_root"])
                plugin_id = str(params.get("plugin_id") or plugin_root.name)
                entry = str(params.get("entry") or "plugin:register")
                platform_tag = str(params.get("platform_tag") or "")
                allow_get = params.get("allow_get") or ["config_readonly", "logger"]
                capabilities = params.get("capabilities") or {}
                # 宿主工程根（含 src/）供 import src.mcp.*
                app_root = params.get("app_root")
                if app_root and app_root not in sys.path:
                    sys.path.insert(0, app_root)

                _setup_sys_path(plugin_root, platform_tag)
                if ":" not in entry:
                    raise RuntimeError(f"entry 无效: {entry}")
                module_part, attr_part = entry.split(":", 1)
                register_fn = _import_entry(plugin_root, module_part, attr_part)

                host = _WorkerHost(
                    plugin_id=plugin_id,
                    capabilities=capabilities,
                    allow_get=allow_get,
                )
                register_fn(host)
                _write_msg(
                    {"id": req_id, "result": {"tools": host.export_tools()}}
                )

            elif method == "call":
                if host is None:
                    raise RuntimeError("worker 未 bootstrap")
                name = params.get("name")
                arguments = params.get("arguments") or {}
                value = loop.run_until_complete(host.call_tool(name, arguments))
                # 保证 JSON 可序列化
                if isinstance(value, (bool, int, float, str)) or value is None:
                    out_val = value
                else:
                    out_val = str(value)
                _write_msg({"id": req_id, "result": {"value": out_val}})

            elif method == "shutdown":
                _write_msg({"id": req_id, "result": {"ok": True}})
                break

            else:
                raise RuntimeError(f"未知 method: {method}")

        except Exception as e:
            _log(traceback.format_exc())
            _write_msg(
                {
                    "id": req_id,
                    "error": {"message": str(e)},
                }
            )

    loop.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

```

### Core Architecture Module: `src/mcp/tools/app/utils.py`
```
"""应用程序管理通用工具.

提供统一的应用程序匹配、查找、缓存和名称清理功能。
"""

import platform
import re
import time
from typing import Any

from src.logging import get_logger

logger = get_logger()

# 全局应用缓存
_cached_applications: list[dict[str, Any]] | None = None
_cache_timestamp: float = 0
_cache_duration = 300  # 缓存5分钟


def clean_app_name(name: str) -> str:
    """清理应用程序名称，移除版本号和特殊字符.

    Args:
        name: 原始名称

    Returns:
        str: 清理后的名称
    """
    if not name:
        return ""

    # 移除常见的版本号模式
    name = re.sub(r"\s+v?\d+[\.\d]*", "", name)
    name = re.sub(r"\s*\(\d+\)", "", name)
    name = re.sub(r"\s*\[.*?\]", "", name)

    # 移除多余的空格
    name = " ".join(name.split())

    return name.strip()


class AppMatcher:
    """
    统一的应用程序匹配器.
    """

    # 特殊应用名称映射 - 按长度排序，避免短名称优先匹配
    SPECIAL_MAPPINGS = {
        "qq音乐": ["qqmusic", "qq音乐", "qq music"],
        "qqmusic": ["qqmusic", "qq音乐", "qq music"],
        "qq music": ["qqmusic", "qq音乐", "qq music"],
        "tencent meeting": ["tencent meeting", "腾讯会议", "voovmeeting"],
        "腾讯会议": ["tencent meeting", "腾讯会议", "voovmeeting"],
        "google chrome": ["chrome", "googlechrome", "google chrome"],
        "microsoft edge": ["msedge", "edge", "microsoft edge"],
        "microsoft office": [
            "microsoft office",
            "office",
            "word",
            "excel",
            "powerpoint",
        ],
        "microsoft word": ["microsoft word", "word"],
        "microsoft excel": ["microsoft excel", "excel"],
        "microsoft powerpoint": ["microsoft powerpoint", "powerpoint"],
        "visual studio code": ["code", "vscode", "visual studio code"],
        "wps office": ["wps", "wps office"],
        "qq": ["qq", "qqnt", "tencentqq"],
        "wechat": ["wechat", "weixin", "微信"],
        "dingtalk": ["dingtalk", "钉钉", "ding"],
        "钉钉": ["dingtalk", "钉钉", "ding"],
        "chrome": ["chrome", "googlechrome", "google chrome"],
        "firefox": ["firefox", "mozilla"],
        "edge": ["msedge", "edge", "microsoft edge"],
        "safari": ["safari"],
        "notepad": ["notepad", "notepad++"],
        "calculator": ["calc", "calculator", "calculatorapp"],
        "calc": ["calc", "calculator", "calculatorapp"],
        "feishu": ["feishu", "飞书", "lark"],
        "vscode": ["code", "vscode", "visual studio code"],
        "pycharm": ["pycharm", "pycharm64"],
        "cursor": ["cursor"],
        "typora": ["typora"],
        "wps": ["wps", "wps office"],
        "office": ["microsoft office", "office", "word", "excel", "powerpoint"],
        "word": ["microsoft word", "word"],
        "excel": ["microsoft excel", "excel"],
        "powerpoint": ["microsoft powerpoint", "powerpoint"],
        "finder": ["finder"],
        "terminal": ["terminal", "iterm"],
        "iterm": ["iterm", "iterm2"],
    }

    # 进程分组映射（用于关闭时分组）
    PROCESS_GROUPS = {
        "chrome": "chrome",
        "googlechrome": "chrome",
        "firefox": "firefox",
        "edge": "edge",
        "msedge": "edge",
        "safari": "safari",
        "qq": "qq",
        "qqnt": "qq",
        "tencentqq": "qq",
        "qqmusic": "qqmusic",
        "QQMUSIC": "QQMUSIC",
        "QQ音乐": "QQ音乐",
        "wechat": "wechat",
        "weixin": "wechat",
        "dingtalk": "dingtalk",
        "钉钉": "dingtalk",
        "feishu": "feishu",
        "飞书": "feishu",
        "lark": "feishu",
        "vscode": "vscode",
        "code": "vscode",
        "cursor": "cursor",
        "pycharm": "pycharm",
        "pycharm64": "pycharm",
        "typora": "typora",
        "calculatorapp": "calculator",
        "calc": "calculator",
        "calculator": "calculator",
        "tencent meeting": "tencent_meeting",
        "腾讯会议": "tencent_meeting",
        "voovmeeting": "tencent_meeting",
        "wps": "wps",
        "word": "word",
        "excel": "excel",
        "powerpoint": "powerpoint",
        "finder": "finder",
        "terminal": "terminal",
        "iterm": "iterm",
        "iterm2": "iterm",
    }

    @classmethod
    def normalize_name(cls, name: str) -> str:
        """
        标准化应用程序名称.
        """
        if not name:
            return ""

        # 移除.exe后缀
        name = name.lower().replace(".exe", "")

        # 移除版本号和特殊字符
        name = re.sub(r"\s+v?\d+[\.\d]*", "", name)
        name = re.sub(r"\s*\(\d+\)", "", name)
        name = re.sub(r"\s*\[.*?\]", "", name)
        name = " ".join(name.split())

        return name.strip()

    @classmethod
    def get_process_group(cls, process_name: str) -> str:
        """
        获取进程所属的分组.
        """
        normalized = cls.normalize_name(process_name)

        # 检查直接映射
        if normalized in cls.PROCESS_GROUPS:
            return cls.PROCESS_GROUPS[normalized]

        # 检查包含关系
        for key, group in cls.PROCESS_GROUPS.items():
            if key in normalized or normalized in key:
                return group

        return normalized

    @classmethod
    def match_application(cls, target_name: str, app_info: dict[str, Any]) -> int:
        """匹配应用程序，返回匹配度分数.

        Args:
            target_name: 目标应用名称
            app_info: 应用程序信息

        Returns:
            int: 匹配度分数 (0-100)，0表示不匹配
        """
        if not target_name or not app_info:
            return 0

        target_lower = target_name.lower()
        app_name = app_info.get("name", "").lower()
        display_name = app_info.get("display_name", "").lower()
        window_title = app_info.get("window_title", "").lower()
        exe_path = app_info.get("command", "").lower()

        # 1. 精确匹配 (100分)
        if target_lower == app_name or target_lower == display_name:
            return 100

        # 2. 特殊映射匹配 (95-98分) - 优先匹配更具体的关键词
        best_special_score = 0

        for key in cls.SPECIAL_MAPPINGS:
            if key in target_lower or target_lower == key:
                # 检查是否有匹配的别名
                for alias in cls.SPECIAL_MAPPINGS[key]:
                    if alias.lower() in app_name or alias.lower() in display_name:
                        # 计算匹配度：更具体的匹配得分更高
                        if target_lower == key:
                            score = 98  # 精确匹配特殊映射键
                        elif len(key) > len(target_lower) * 0.8:
                            score = 97  # 长度相近的匹配
                        else:
                            score = 95  # 一般特殊映射匹配

                        if score > best_special_score:
                            best_special_score = score

        if best_special_score > 0:
            return best_special_score

        # 3. 标准化名称匹配 (90分)
        normalized_target = cls.normalize_name(target_name)
        normalized_app = cls.normalize_name(app_info.get("name", ""))
        normalized_display = cls.normalize_name(app_info.get("display_name", ""))

        if (
            normalized_target == normalized_app
            or normalized_target == normalized_display
        ):
            return 90

        # 4. 包含匹配 (70-80分)
        if target_lower in app_name:
            return 80
        if target_lower in display_name:
            return 75
        if app_name and app_name in target_lower:
            # 避免短名称误匹配长名称
            if len(app_name) < len(target_lower) * 0.5:
                return 50  # 降低分数
            return 70

        # 5. 窗口标题匹配 (60分)
        if window_title and target_lower in window_title:
            return 60

        # 6. 路径匹配 (50分)
        if exe_path and target_lower in exe_path:
            return 50

        # 7. 模糊匹配 (30分)
        if cls._fuzzy_match(target_lower, app_name) or cls._fuzzy_match(
            target_lower, display_name
        ):
            return 30

        return 0

    @classmethod
    def _fuzzy_match(cls, target: str, candidate: str) -> bool:
        """
        模糊匹配.
        """
        if not target or not candidate:
            return False

        # 移除所有非字母数字字符进行比较
        target_clean = re.sub(r"[^a-zA-Z0-9一-鿿]", "", target)
        candidate_clean = re.sub(r"[^a-zA-Z0-9一-鿿]", "", candidate)

        return target_clean in candidate_clean or candidate_clean in target_clean


async def get_cached_applications(force_refresh: bool = False) -> list[dict[str, Any]]:
    """获取缓存的应用程序列表.

    Args:
        force_refresh: 是否强制刷新缓存

    Returns:
        应用程序列表
    """
    global _cached_applications, _cache_timestamp

    current_time = time.time()

    # 检查缓存是否有效
    if (
        not force_refresh
        and _cached_applications is not None
        and (current_time - _cache_timestamp) < _cache_duration
    ):
        logger.debug(
            f"[AppUtils] 使用缓存的应用程序列表，缓存时间: {int(current_time - _cache_timestamp)}秒前"
        )
        return _cached_applications

    # 重新扫描应用程序
    try:
        import json

        from .scanner import scan_installed_applications

        logger.info("[AppUtils] 刷新应用程序缓存")
        result_json = await scan_installed_applications(
            {"force_refresh": force_refresh}
        )
        result = json.loads(result_json)

        if result.get("success", False):
            _cached_applications = result.get("applications", [])
            _cache_timestamp = current_time
            logger.info(
                f"[AppUtils] 应用程序缓存已刷新，找到 {len(_cached_applications)} 个应用"
            )
            return _cached_applications
        else:
            logger.warning(
                f"[AppUtils] 应用程序扫描失败: {result.get('message', '未知错误')}"
            )
            return _cached_applications or []

    except Exception as e:
        logger.error(f"[AppUtils] 刷新应用程序缓存失败: {e}", exc_info=True)
        return _cached_applications or []


async def find_best_matching_app(
    app_name: str, app_type: str = "any"
) -> dict[str, Any] | None:
    """查找最佳匹配的应用程序.

    Args:
        app_name: 应用程序名称
        app_type: 应用程序类型过滤 ("installed", "running", "any")

    Returns:
        最佳匹配的应用程序信息
    """
    try:
        if app_type == "running":
            # 获取正在运行的应用程序
            import asyncio

            from .process_manager import list_running_ap
```

### Core Architecture Module: `src/utils/activation_announcer.py`
```
"""激活验证码播报模块.

使用预录制 WAV 音效播报激活验证码，仅在设备激活流程中使用。
不依赖 FFmpeg，可在无系统 FFmpeg 的干净环境中工作。
"""

import threading
import wave
from pathlib import Path

import numpy as np
import sounddevice as sd

from src.logging import get_logger
from src.utils.resource_finder import get_app_root

logger = get_logger()

# 音频资源目录
_ASSETS_DIR = get_app_root() / "assets" / "sounds"
# 资源默认采样率（与 assets/sounds 中预置 WAV 对齐）
_DEFAULT_SAMPLE_RATE = 24000


class ActivationAnnouncer:
    """激活验证码播报器."""

    def __init__(self, locale: str = "zh-CN"):
        self._locale = locale
        self._stop_flag = threading.Event()
        self._play_thread: threading.Thread | None = None

    def _get_sound_path(self, name: str) -> Path | None:
        """获取音效文件路径（仅 WAV）."""
        sound_file = _ASSETS_DIR / self._locale / f"{name}.wav"
        if sound_file.exists():
            return sound_file
        # 回退到 zh-CN
        if self._locale != "zh-CN":
            fallback = _ASSETS_DIR / "zh-CN" / f"{name}.wav"
            if fallback.exists():
                return fallback
        return None

    def _load_wav(self, file_path: Path) -> tuple[np.ndarray, int] | None:
        """加载 WAV 为 float32 mono，并返回 (samples, sample_rate).

        Args:
            file_path: WAV 文件路径。

        Returns:
            (float32 音频, 采样率)，失败返回 None。
        """
        try:
            with wave.open(str(file_path), "rb") as wf:
                channels = wf.getnchannels()
                sample_width = wf.getsampwidth()
                sample_rate = wf.getframerate()
                n_frames = wf.getnframes()
                raw = wf.readframes(n_frames)

            if sample_width == 2:
                audio = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0
            elif sample_width == 4:
                audio = (
                    np.frombuffer(raw, dtype=np.int32).astype(np.float32) / 2147483648.0
                )
            elif sample_width == 1:
                # 8-bit PCM 为无符号
                audio = (
                    np.frombuffer(raw, dtype=np.uint8).astype(np.float32) - 128.0
                ) / 128.0
            else:
                logger.error(f"不支持的 WAV 位深: {sample_width * 8} bit ({file_path})")
                return None

            if channels > 1:
                audio = audio.reshape(-1, channels).mean(axis=1)

            return audio, sample_rate
        except Exception as e:
            logger.error(f"加载 WAV 失败 {file_path}: {e}", exc_info=True)
            return None

    def _play_sounds(self, names: list[str]) -> None:
        """播放音效序列（在工作线程中执行）."""
        for name in names:
            if self._stop_flag.is_set():
                logger.debug("播报被中断")
                break

            sound_path = self._get_sound_path(name)
            if not sound_path:
                logger.warning(f"音效文件不存在: {name}")
                continue

            loaded = self._load_wav(sound_path)
            if loaded is None or self._stop_flag.is_set():
                continue

            audio, sample_rate = loaded
            if sample_rate <= 0:
                sample_rate = _DEFAULT_SAMPLE_RATE

            try:
                sd.play(audio, sample_rate)
                # 分段等待，便于响应中断
                while sd.get_stream().active:
                    if self._stop_flag.is_set():
                        sd.stop()
                        break
                    self._stop_flag.wait(0.05)
            except Exception as e:
                logger.error(f"播放失败: {e}", exc_info=True)

    def announce(self, code: str) -> None:
        """播报验证码（非阻塞）.

        Args:
            code: 验证码字符串，如 "123456"
        """
        if not code or not code.isdigit():
            logger.warning(f"无效的验证码: {code}")
            return

        # 停止之前的播报
        self.stop()

        # 构建播放序列: 激活提示 + 各个数字
        sounds = ["activation"] + list(code)

        logger.info(f"播报验证码: {code}")

        self._stop_flag.clear()
        self._play_thread = threading.Thread(
            target=self._play_sounds,
            args=(sounds,),
            daemon=True,
            name="ActivationAnnouncer",
        )
        self._play_thread.start()

    def stop(self) -> None:
        """停止播报."""
        self._stop_flag.set()

        # 停止音频播放
        try:
            sd.stop()
        except Exception as e:
            logger.debug(f"停止音频播放失败: {e}")

        # 等待线程结束
        if self._play_thread and self._play_thread.is_alive():
            self._play_thread.join(timeout=1)

        self._play_thread = None


# 全局实例
_announcer: ActivationAnnouncer | None = None


def announce_activation_code(code: str, locale: str = "zh-CN") -> None:
    """播报激活验证码.

    Args:
        code: 验证码字符串
        locale: 语言代码
    """
    global _announcer
    if _announcer is None:
        _announcer = ActivationAnnouncer(locale)
    _announcer.announce(code)


def stop_announcement() -> None:
    """停止验证码播报."""
    global _announcer
    if _announcer:
        _announcer.stop()

```

### Core Architecture Module: `src/utils/audio_device.py`
```
"""音频设备管理器.

职责：
- 设备发现和选择
- 配置持久化（按设备名称，而非 ID）
- 设备信息查询
"""

from dataclasses import dataclass

from src.constants.constants import AudioConfig
from src.logging import get_logger
from src.utils.audio_utils import find_device_by_name, select_audio_device
from src.utils.config_manager import ConfigManager

logger = get_logger()


@dataclass
class DeviceConfig:
    """设备配置数据类"""

    input_device_id: int
    output_device_id: int
    input_sample_rate: int
    output_sample_rate: int
    input_channels: int
    output_channels: int
    input_frame_size: int
    output_frame_size: int


class AudioDeviceManager:
    """音频设备管理器（无状态，纯逻辑）"""

    def __init__(self, config_manager: ConfigManager):
        self.config = config_manager

    def load_or_detect_devices(self) -> DeviceConfig:
        """加载配置或自动检测设备（按名称匹配）

        Returns:
            DeviceConfig: 设备配置

        Raises:
            RuntimeError: 无法找到可用设备
        """
        audio_config = self.config.get_config("AUDIO_DEVICES", {}) or {}

        input_device_name = audio_config.get("input_device_name")
        output_device_name = audio_config.get("output_device_name")

        # 1. 尝试按名称查找设备
        input_info = None
        output_info = None

        if input_device_name:
            logger.info(f"尝试查找输入设备: {input_device_name}")
            input_info = find_device_by_name("input", input_device_name)
            if input_info:
                logger.info(f"✓ 找到输入设备: {input_info['name']} (ID: {input_info['index']})")
            else:
                logger.warning(f"✗ 未找到设备 '{input_device_name}'，将重新选择")

        if output_device_name:
            logger.info(f"尝试查找输出设备: {output_device_name}")
            output_info = find_device_by_name("output", output_device_name)
            if output_info:
                logger.info(f"✓ 找到输出设备: {output_info['name']} (ID: {output_info['index']})")
            else:
                logger.warning(f"✗ 未找到设备 '{output_device_name}'，将重新选择")

        # 2. 如果按名称查找失败，自动选择新设备
        if not input_info:
            logger.info("自动选择输入设备...")
            input_info = select_audio_device("input")
            if not input_info:
                raise RuntimeError("无法找到可用的输入设备")

        if not output_info:
            logger.info("自动选择输出设备...")
            output_info = select_audio_device("output")
            if not output_info:
                raise RuntimeError("无法找到可用的输出设备")

        # 3. 输入固定单声道（协议要求 + 避免阵列驱动延迟），输出保持设备声道数
        input_channels = 1
        output_channels = output_info["channels"]

        device_input_sample_rate = input_info["sample_rate"]
        device_output_sample_rate = output_info["sample_rate"]

        logger.info(
            f"使用输入设备: {input_info['name']} | "
            f"{device_input_sample_rate}Hz {input_channels}ch"
        )
        logger.info(
            f"使用输出设备: {output_info['name']} | "
            f"{device_output_sample_rate}Hz {output_channels}ch"
        )

        # 4. 保存设备名称（而非 ID）到配置
        if (
            input_device_name != input_info["name"]
            or output_device_name != output_info["name"]
        ):
            self.config.update_config("AUDIO_DEVICES.input_device_name", input_info["name"])
            self.config.update_config("AUDIO_DEVICES.input_sample_rate", device_input_sample_rate)
            self.config.update_config("AUDIO_DEVICES.input_channels", input_channels)
            self.config.update_config("AUDIO_DEVICES.output_device_name", output_info["name"])
            self.config.update_config("AUDIO_DEVICES.output_sample_rate", device_output_sample_rate)
            self.config.update_config("AUDIO_DEVICES.output_channels", output_channels)
            logger.info("设备配置已保存")

        return DeviceConfig(
            input_device_id=input_info["index"],
            output_device_id=output_info["index"],
            input_sample_rate=device_input_sample_rate,
            output_sample_rate=device_output_sample_rate,
            input_channels=input_channels,
            output_channels=output_channels,
            input_frame_size=int(
                device_input_sample_rate * (AudioConfig.FRAME_DURATION / 1000)
            ),
            output_frame_size=int(
                device_output_sample_rate * (AudioConfig.FRAME_DURATION / 1000)
            ),
        )

```

### Core Architecture Module: `src/utils/audio_utils.py`
```
import asyncio
import os
import re
import sys
from typing import Any

import numpy as np
import sounddevice as sd

from src.logging import get_logger

logger = get_logger()


class ALSAErrorSuppressor:
    """
    ALSA 错误输出抑制器。

    在 Linux 系统上，ALSA 库会输出大量警告和错误信息到 stderr，
    这些信息会干扰终端输出。此上下文管理器可临时抑制这些输出。

    用法:
        with ALSAErrorSuppressor():
            # 执行 PyAudio 初始化等操作
            audio = pyaudio.PyAudio()

    注意:
        - 仅在 Linux 系统上生效
        - 在 Windows/macOS 上无操作
        - 退出上下文时会恢复 stderr
    """

    def __init__(self):
        self._old_stderr = None
        self._devnull = None
        self._is_linux = sys.platform.startswith("linux")

    def __enter__(self):
        if not self._is_linux:
            return self

        try:
            self._old_stderr = os.dup(2)
            self._devnull = os.open("/dev/null", os.O_WRONLY)
            os.dup2(self._devnull, 2)
        except OSError:
            # 如果无法操作文件描述符，静默失败
            self._old_stderr = None
            self._devnull = None

        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if not self._is_linux:
            return False

        if self._old_stderr is not None:
            try:
                os.dup2(self._old_stderr, 2)
                os.close(self._old_stderr)
            except OSError:
                pass

        if self._devnull is not None:
            try:
                os.close(self._devnull)
            except OSError:
                pass

        return False  # 不抑制异常


def suppress_alsa_errors():
    """返回 ALSA 错误抑制器上下文管理器."""
    return ALSAErrorSuppressor()


# 可选：屏蔽常见虚拟/聚合设备（默认不选它们）
_VIRTUAL_PATTERNS = [
    r"blackhole",
    r"aggregate",
    r"multi[-\s]?output",  # macOS
    r"monitor",
    r"echo[-\s]?cancel",  # Linux Pulse/PipeWire
    r"vb[-\s]?cable",
    r"voicemeeter",
    r"cable (input|output)",  # Windows
    r"loopback",
]


def _is_virtual(name: str) -> bool:
    n = name.casefold()
    return any(re.search(pat, n) for pat in _VIRTUAL_PATTERNS)


def downmix_to_mono(
    pcm: np.ndarray | bytes,
    *,
    keepdims: bool = True,
    dtype: np.dtype | str = np.int16,
    in_channels: int | None = None,
) -> np.ndarray | bytes:
    """将任意格式的音频下混为单声道.

    支持两种输入:
    1. np.ndarray: 形状 (N,) 或 (N, C) 的 PCM 数组
    2. bytes: PCM 字节流 (需指定 dtype 和 in_channels)

    Args:
        pcm: 输入音频数据 (ndarray 或 bytes)
        keepdims: True 返回 (N,1)，False 返回 (N,) (仅 ndarray 输入)
        dtype: PCM 数据类型 (仅 bytes 输入时使用)
        in_channels: 输入声道数 (仅 bytes 输入时必需)

    Returns:
        单声道音频数据 (与输入类型相同)

    Examples:
        >>> # ndarray 输入
        >>> stereo = np.random.randint(-32768, 32767, (1000, 2), dtype=np.int16)
        >>> mono = downmix_to_mono(stereo, keepdims=False)  # shape: (1000,)

        >>> # bytes 输入
        >>> stereo_bytes = b'...'  # 立体声 PCM 数据
        >>> mono_bytes = downmix_to_mono(stereo_bytes, dtype=np.int16, in_channels=2)
    """
    # bytes 输入: 转换 -> 处理 -> 转回 bytes
    if isinstance(pcm, bytes):
        if in_channels is None:
            raise ValueError("bytes 输入必须指定 in_channels 参数")
        arr = np.frombuffer(pcm, dtype=dtype).reshape(-1, in_channels)
        mono_arr = downmix_to_mono(arr, keepdims=False)  # bytes 输出不需要 keepdims
        return mono_arr.tobytes()

    # ndarray 输入: 直接处理
    x = np.asarray(pcm)
    if x.ndim == 1:
        return x[:, None] if keepdims else x

    # 已经是单声道
    if x.shape[1] == 1:
        return x if keepdims else x[:, 0]

    # 多声道下混
    if np.issubdtype(x.dtype, np.integer):
        # 先转浮点求平均，再四舍五入回原整数类型，避免溢出
        y = np.rint(x.astype(np.float32).mean(axis=1))
        info = np.iinfo(x.dtype)
        y = np.clip(y, info.min, info.max).astype(x.dtype)
    else:
        # 浮点：保持原 dtype（比如 float32），避免默认为 float64
        y = x.mean(axis=1, dtype=x.dtype)

    return y[:, None] if keepdims else y


def safe_queue_put(
    queue: asyncio.Queue, item: Any, replace_oldest: bool = True
) -> bool:
    """安全地将项目放入队列，队列满时可选择丢弃最旧数据.

    Args:
        queue: asyncio.Queue 对象
        item: 要入队的数据
        replace_oldest: True=队列满时丢弃最旧数据并放入新数据, False=直接丢弃新数据

    Returns:
        True=成功入队, False=队列满且未入队
    """
    try:
        queue.put_nowait(item)
        return True
    except asyncio.QueueFull:
        if replace_oldest:
            try:
                queue.get_nowait()  # 丢弃最旧的
                queue.put_nowait(item)  # 放入新数据
                return True
            except asyncio.QueueEmpty:
                # 理论上不会发生,但保险起见
                queue.put_nowait(item)
                return True
        return False


def upmix_mono_to_channels(mono_data: np.ndarray, num_channels: int) -> np.ndarray:
    """将单声道音频上混到多声道（复制到所有声道）

    Args:
        mono_data: 单声道音频数据，形状 (N,)
        num_channels: 目标声道数

    Returns:
        多声道音频数据，形状 (N, num_channels)
    """
    if num_channels == 1:
        return mono_data.reshape(-1, 1)

    # 复制单声道到所有声道
    return np.tile(mono_data.reshape(-1, 1), (1, num_channels))


def _valid(devs: list[dict], idx: int, kind: str, include_virtual: bool) -> bool:
    if not isinstance(idx, int) or idx < 0 or idx >= len(devs):
        return False
    d = devs[idx]
    key = "max_input_channels" if kind == "input" else "max_output_channels"
    if int(d.get(key, 0)) <= 0:
        return False
    if not include_virtual and _is_virtual(d.get("name", "")):
        return False
    return True


def refresh_portaudio_devices(*, reinitialize: bool = True) -> list[dict]:
    """重新枚举 PortAudio 设备列表（热插拔友好）.

    调用方须先停掉本进程内所有 sounddevice 流，再调本函数；
    有活跃流时 ``sd._terminate`` 不安全。

    Args:
        reinitialize: True 时尝试 ``_terminate`` + ``_initialize`` 强制
            重建 PortAudio 上下文（有利于 macOS 后连蓝牙出现在列表中）。
            失败则降级为普通 ``query_devices``。

    Returns:
        设备信息 dict 列表（与 ``list(sd.query_devices())`` 同形）
    """
    if reinitialize:
        terminate = getattr(sd, "_terminate", None)
        initialize = getattr(sd, "_initialize", None)
        if callable(terminate) and callable(initialize):
            try:
                terminate()
                initialize()
                logger.info("PortAudio 已重新初始化，准备重新枚举设备")
            except Exception as e:
                logger.warning(
                    f"PortAudio 重初始化失败，降级为普通枚举: {e}",
                    exc_info=True,
                )
        else:
            logger.debug("当前 sounddevice 无 _terminate/_initialize，跳过重初始化")

    try:
        devices = list(sd.query_devices())
    except Exception as e:
        logger.error(f"query_devices 失败: {e}", exc_info=True)
        return []

    logger.info(f"音频设备枚举完成: {len(devices)} 个")
    return devices


def list_audio_devices(
    *, include_virtual: bool = True
) -> dict[str, list[dict[str, Any]]]:
    """列出输入/输出设备（设置页与调试用）.

    不主动重初始化 PortAudio；需要热插拔刷新时先
    ``refresh_portaudio_devices()``，再调本函数。

    Returns:
        ``{"input": [...], "output": [...]}``，每项含 index/name/sample_rate/channels
    """
    try:
        devices = list(sd.query_devices())
    except Exception as e:
        logger.error(f"列出音频设备失败: {e}", exc_info=True)
        return {"input": [], "output": []}

    default_input = None
    default_output = None
    try:
        if sd.default.device is not None:
            default_input = sd.default.device[0]
            default_output = sd.default.device[1]
    except Exception:
        pass

    inputs: list[dict[str, Any]] = []
    outputs: list[dict[str, Any]] = []

    for i, d in enumerate(devices):
        name = d.get("name", "Unknown")
        if not include_virtual and _is_virtual(name):
            continue
        sr = d.get("default_samplerate", 48000)
        sample_rate = int(sr) if isinstance(sr, (int, float)) else 48000
        idx = int(d.get("index", i))

        in_ch = int(d.get("max_input_channels", 0) or 0)
        out_ch = int(d.get("max_output_channels", 0) or 0)

        if in_ch > 0:
            mark = " (默认)" if idx == default_input else ""
            inputs.append(
                {
                    "index": idx,
                    "name": name + mark,
                    "raw_name": name,
                    "sample_rate": sample_rate,
                    "channels": in_ch,
                }
            )
        if out_ch > 0:
            mark = " (默认)" if idx == default_output else ""
            outputs.append(
                {
                    "index": idx,
                    "name": name + mark,
                    "raw_name": name,
                    "sample_rate": sample_rate,
                    "channels": out_ch,
                }
            )

    return {"input": inputs, "output": outputs}


def find_device_by_name(
    kind: str, device_name: str, *, include_virtual: bool = False
) -> dict[str, Any] | None:
    """按名称查找设备（模糊匹配）

    Args:
        kind: "input" 或 "output"
        device_name: 设备名称（支持部分匹配）
        include_virtual: 是否包含虚拟设备

    Returns:
        设备信息字典，或 None
    """
    assert kind in ("input", "output")

    try:
        devices = list(sd.query_devices())
    except Exception:
        return None

    key_channels = "max_input_channels" if kind == "input" else "max_output_channels"
    search_name = device_name.casefold().strip()

    # 1. 精确匹配（忽略大小写）
    for i, d in enumerate(devices):
        if not _valid(devices, i, kind, include_virtual):
            continue
        if d.get("name", "").casefold().strip() == search_name:
            sr = d.get("default_samplerate", None)
            return {
                "index": int(d.get("index", i)),
                "name": d.get("name", "Unknown"),
                "sample_rate": int(sr) if isinstance(sr, (int, float)) else None,
                "channels": int(d.get(key_channels, 0)),
            }

    # 2. 模糊匹配（包含关系）
    for i, d in enumerate(devices):
        if not _valid(devices, i, kind, include_virtual):
            continue
        device_full_name = d.get("name", "").casefold()
        if search_name in device_full_name or device_full_name in search_name:
    
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
       - name: Install Python dependencies
         shell: bash
         run: |
-          # mac x64：强制使用 setup-python 提供的 x86_64 解释器
-          if [ "${{ runner.os }}" = "macOS" ] && [ -n "${{ matrix.python_arch }}" ]; then
-            PY="$(command -v python)"
-            echo "Using Python: $PY"
-            file "$PY" || true
-            python -c "import platform; print(platform.machine(), platform.platform())"
-            uv sync --python "$PY" --extra gui --group dev
+          if [ "${{ runner.os }}" = "macOS" ] && [ "${{ matrix.mac_arch }}" = "x64" ]; then
+            echo "Using x86_64 Python: $PY_X64"
+            file "$PY_X64"
+            arch -x86_64 "$PY_X64" -c "import platform; print(platform.machine(), platform.platform())"
+            # uv 用该解释器解析/安装 x86_64 wheel
+            uv sync --python "$PY_X64" --extra gui --group dev
           else
             uv sync --extra gui --group dev
           fi
 
       - name: Install unifypy
-        run: uv pip install
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

### Incident Patch 9: `b544dec2` (2026-07-26)
**Commit Message**: feat(ui): 设置页暴露 AEC 并行播放与延迟补偿

同步默认配置项说明，GUI 可调 MUSIC_PARALLEL / FRAME_DELAY /
ENABLE_PREPROCESS；启用 AEC 时子项可编辑，修改后重启生效。

**File**: `src/ui/gui/models/settings/system_options.py` (modified, +24/-0)
```diff
@@ -135,6 +135,30 @@ def _get_aecEnabled(self) -> bool:
     def _set_aecEnabled(self, value: bool):
         self._set_value("AEC_OPTIONS.ENABLED", value)
 
+    # AEC 在位时 TTS 与音乐并行播放（闪避混音）
+    def _get_aecMusicParallel(self) -> bool:
+        return self._get_value("AEC_OPTIONS.MUSIC_PARALLEL", True)
+
+    def _set_aecMusicParallel(self, value: bool):
+        self._set_value("AEC_OPTIONS.MUSIC_PARALLEL", value)
+
+    # 延迟补偿帧数（40ms + N × 协议帧长）
+    def _get_aecFrameDelay(self) -> int:
+        try:
+            return int(self._get_value("AEC_OPTIONS.FRAME_DELAY", 3))
+        except (TypeError, ValueError):
+            return 3
+
+    def _set_aecFrameDelay(self, value: int):
+        self._set_value("AEC_OPTIONS.FRAME_DELAY", int(value))
+
+    # 噪声抑制/高通预处理
+    def _get_aecEnablePreprocess(self) -> bool:
+        return self._get_value("AEC_OPTIONS.ENABLE_PREPROCESS", True)
+
+    def _set_aecEnablePreprocess(self, value: bool):
+        self._set_value("AEC_OPTIONS.ENABLE_PREPROCESS", value)
+
     # ========== 可写目录 PATHS（config 目录不由此改）==========
 
     def _get_pathCacheDir(self) -> str:
```

**File**: `src/ui/gui/models/settings_model.py` (modified, +9/-0)
```diff
@@ -265,6 +265,15 @@ def reload(self):
     aecEnabled = Property(
         bool, SettingsSystemOptionsMixin._get_aecEnabled, SettingsSystemOptionsMixin._set_aecEnabled, notify=settingsChanged
     )
+    aecMusicParallel = Property(
+        bool, SettingsSystemOptionsMixin._get_aecMusicParallel, SettingsSystemOptionsMixin._set_aecMusicParallel, notify=settingsChanged
+    )
+    aecFrameDelay = Property(
+        int, SettingsSystemOptionsMixin._get_aecFrameDelay, SettingsSystemOptionsMixin._set_aecFrameDelay, notify=settingsChanged
+    )
+    aecEnablePreprocess = Property(
+        bool, SettingsSystemOptionsMixin._get_aecEnablePreprocess, SettingsSystemOptionsMixin._set_aecEnablePreprocess, notify=settingsChanged
+    )
     pathCacheDir = Property(
         str,
         SettingsSystemOptionsMixin._get_pathCacheDir,
```

**File**: `src/ui/gui/qml/windows/settings/SystemOptionsTab.qml` (modified, +84/-1)
```diff
@@ -81,16 +81,99 @@ ScrollView {
                     }
                 }
 
+            }
+        }
+
+        // 分隔线
+        Rectangle {
+            Layout.fillWidth: true
+            height: 1
+            color: Theme.divider
+        }
+
+        // 回声消除区域
+        ColumnLayout {
+            Layout.fillWidth: true
+            spacing: Theme.spacingMd
+
+            Text {
+                text: "回声消除"
+                font.pixelSize: Theme.fontSizeMd
+                font.weight: Font.Medium
+                color: Theme.textSecondary
+            }
+
+            GridLayout {
+                Layout.fillWidth: true
+                columns: 2
+                rowSpacing: Theme.spacingMd
+                columnSpacing: Theme.spacingLg
+
                 Text {
-                    text: "回声消除"
+                    text: "启用"
                     font.pixelSize: Theme.fontSizeSm
                     color: Theme.textSecondary
                     Layout.preferredWidth: 100
                 }
                 XSwitch {
+                    id: aecEnabledSwitch
                     checked: settingsModel ? settingsModel.aecEnabled : false
                     onToggled: if (settingsModel) settingsModel.aecEnabled = checked
                 }
+
+                Text {
+                    text: "音乐并行播放"
+                    font.pixelSize: Theme.fontSizeSm
+                    color: Theme.textSecondary
+                    Layout.preferredWidth: 100
+                    opacity: aecEnabledSwitch.checked ? 1 : 0.45
+                }
+                XSwitch {
+                    enabled: aecEnabledSwitch.checked
+                    opacity: aecEnabledSwitch.checked ? 1 : 0.45
+                    checked: settingsModel ? settingsModel.aecMusicParallel : true
+                    onToggled: if (settingsModel) settingsModel.aecMusicParallel = checked
+                }
+
+                Text {
+                    text: "延迟补偿帧数"
+                    font.pixelSize: Theme.fontSizeSm
+                    color: Theme.textSecondary
+                    Layout.preferredWidth: 100
+                    opacity: aecEnabledSwitch.checked ? 1 : 0.45
+                }
+                XSpinBox {
+                    Layout.preferredWidth: 120
+                    enabled: aecEnabledSwitch.checked
+                    opacity: aecEnabledSwitch.checked ? 1 : 0.45
+                    from: 0
+                    to: 20
+                    value: settingsModel ? settingsModel.aecFrameDelay : 3
+                    onValueModified: if (settingsModel) settingsModel.aecFrameDelay = value
+                    font.pixelSize: Theme.fontSizeSm
+                }
+
+                Text {
+                    text: "噪声抑制预处理"
+                    font.pixelSize: Theme.fontSizeSm
+                    color: Theme.textSecondary
+                    Layout.preferredWidth: 100
+                    opacity: aecEnabledSwitch.checked ? 1 : 0.45
+                }
+                XSwitch {
+                    enabled: aecEnabledSwitch.checked
+                    opacity: aecEnabledSwitch.checked ? 1 : 0.45
+                    checked: settingsModel ? settingsModel.aecEnablePreprocess : true
+                    onToggled: if (settingsModel) settingsModel.aecEnablePreprocess = checked
+                }
+            }
+
+            Text {
+                Layout.fillWidth: true
+                text: "消除本应用 TTS/音乐的回声，启用后进入实时对话模式；音乐并行=TTS 播放时音乐闪避不暂停；延迟补偿=40ms+N×协议帧长，蓝牙设备可适当调大。修改后重启生效。"
+                font.pixelSize: Theme.fontSizeXs
+                color: Theme.textSecondary
+                wrapMode: Text.WordWrap
             }
         }
 
```

**File**: `src/utils/config_manager.py` (modified, +2/-2)
```diff
@@ -119,9 +119,9 @@ class ConfigManager:
             "ENABLED": False,
             # AEC 在位时 TTS 不暂停音乐，混音闪避并行播放（引擎旁路则自动回退暂停）
             "MUSIC_PARALLEL": True,
-            "BUFFER_MAX_LENGTH": 200,
+            # 延迟补偿（协议帧数），实际 delay_ms = 40 + N * 帧长
             "FRAME_DELAY": 3,
-            "FILTER_LENGTH_RATIO": 0.4,
+            # 噪声抑制/高通预处理
             "ENABLE_PREPROCESS": True,
         },
         # 可写目录覆盖（config 仍固定在用户数据/config；null=默认）
```

---

### Incident Patch 10: `16e5cf36` (2026-07-26)
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

### Incident Patch 11: `301d8be0` (2026-07-26)
**Commit Message**: feat(ui): 新增 Textual TUI 模式（--mode tui）

TuiViewManager 实现同一套 ViewPort，仪表盘 + 设置屏可编辑配置，
保存后发 CONFIG_CHANGED 触发热重载；激活阶段仍复用 CliActivation。
textual 走可选 extra（uv sync --extra tui），缺依赖时提示回退 cli。

**File**: `main.py` (modified, +33/-11)
```diff
@@ -27,19 +27,21 @@ def parse_args():
     parser = argparse.ArgumentParser(description=SystemConstants.APP_DISPLAY_NAME)
     # 运行模式选择
     # - gui: 图形界面模式，使用 PySide6 + QML
-    # - cli: 命令行模式，使用终端交互
+    # - cli: 命令行模式，使用终端交互（轻量，适合无屏/SSH）
+    # - tui: 全屏 TUI（Textual），可编辑配置；需 uv sync --extra tui
     # - gpio: GPIO 按键模式，仅支持 Linux（树莓派），通过物理按键控制
     parser.add_argument(
         "--mode",
-        choices=["gui", "cli", "gpio"],
+        choices=["gui", "cli", "tui", "gpio"],
         default="gui",
-        help="运行模式：gui(图形界面)、cli(命令行) 或 gpio(GPIO按键，仅Linux)",
+        help="运行模式（默认 gui）：gui / cli / tui(全屏终端) / gpio(仅Linux)",
     )
     parser.add_argument(
         "--protocol",
         choices=["mqtt", "websocket"],
         default="websocket",
-        help="通信协议：mqtt 或 websocket",
+        metavar="PROTOCOL",
+        help="通信协议：mqtt 或 websocket（默认 websocket；须写 --protocol mqtt）",
     )
     parser.add_argument(
         "--skip-activation",
@@ -58,9 +60,9 @@ def parse_args():
 
 from src.logging import load_logging_config, setup_logging  # noqa: E402
 
-# CLI 模式禁用控制台日志输出（由 CLIDisplay 接管）
+# CLI/TUI 模式禁用控制台日志输出（由界面接管）
 setup_logging(
-    enable_console=(_args.mode != "cli"),
+    enable_console=(_args.mode not in ("cli", "tui")),
     config=load_logging_config(),
 )
 
@@ -75,7 +77,7 @@ async def handle_activation(mode: str) -> bool:
     """处理设备激活流程.
 
     Args:
-        mode: 运行模式，"gui"、"cli" 或 "gpio"
+        mode: 运行模式，"gui"、"cli"、"tui" 或 "gpio"
 
     Returns:
         bool: 激活是否成功
@@ -161,10 +163,16 @@ async def start_app(mode: str, protocol: str, skip_activation: bool) -> int:
                 from PySide6.QtWidgets import QApplication
             except ImportError as e:
                 logger.error(
-                    "GUI 模式需要 PySide6 + qasync,但未安装。请运行:\n"
-                    "  uv sync --extra gui          # 推荐 (uv 用户)\n"
-                    "  pip install '.[gui]'         # pip 用户\n"
-                    "若改用 CLI 或 GPIO 模式: python main.py --mode cli  "
+                    "GUI 模式需要 PySide6 + qasync，当前环境未安装。\n"
+                    "请用项目 venv 安装 GUI 依赖后重试：\n"
+                    "  uv sync --extra gui\n"
+                    "  # 或: pip install '.[gui]'\n"
+                    "然后：\n"
+                    "  uv run python main.py\n"
+                    "  # 或: .venv/bin/python main.py\n"
+                    "不要 GUI 时可用：\n"
+                    "  python main.py --mode cli\n"
+                    "  python main.py --mode tui   # 需 uv sync --extra tui\n"
                     f"(原始错误: {e})"
                 )
                 sys.exit(1)
@@ -211,6 +219,20 @@ def handle_sigint(*_):
                 else:
                     raise
         else:
+            # CLI / TUI / GPIO：标准 asyncio
+            if args.mode == "tui":
+                try:
+                    import textual  # noqa: F401
+                except ImportError as e:
+                    logger.error(
+                        "TUI 模式需要 textual。请运行:\n"
+                        "  uv sync --extra tui\n"
+                        "  pip install '.[tui]'\n"
+                        "无屏/SSH 请继续用: python main.py --mode cli\n"
+                        f"(原始错误: {e})"
+                    )
+                    sys.exit(1)
+
             # CLI / GPIO 模式：标准 asyncio；SIGINT 请求 TaskManager 关闭
             shutdown_state = {"requested": False}
 
```

**File**: `pyproject.toml` (modified, +4/-0)
```diff
@@ -85,6 +85,10 @@ linux = [
     "gpiozero>=2.0.1",
     "lgpio>=0.2.2.0",
 ]
+# TUI 全屏终端模式：uv sync --extra tui
+tui = [
+    "textual>=0.80.0",
+]
 
 # 注意：树莓派 CSI 不要用 pip extra 装 picamera2。
 # picamera2 依赖 python-prctl（仅 Linux），在 macOS 上 uv sync/run 会直接编译失败。
```

**File**: `src/activation/factory.py` (modified, +2/-1)
```diff
@@ -4,7 +4,7 @@
 
 
 def create_activation_ui(mode: str, activation_service, init_result: dict) -> Any:
-    """gui → GuiActivation；cli/gpio → CliActivation.
+    """gui → GuiActivation；tui/cli/gpio → CliActivation.
 
     Args:
         mode: 运行模式
@@ -17,6 +17,7 @@ def create_activation_ui(mode: str, activation_service, init_result: dict) -> An
 
         return GuiActivation(activation_service, init_result)
 
+    # tui / cli / gpio：激活阶段用简单终端交互
     from src.ui.cli import CliActivation
 
     return CliActivation(activation_service, init_result)
```

**File**: `src/ui/shared/factory.py` (modified, +8/-4)
```diff
@@ -18,7 +18,7 @@ def create_viewport(
     event_bus: "EventBus",
     task_manager: Optional["TaskManager"] = None,
 ) -> "ViewPort":
-    """gui / cli / gpio；gpio 仅 Linux，其它平台回退 cli."""
+    """gui / cli / tui / gpio；gpio 仅 Linux，其它平台回退 cli."""
     normalized = (mode or "cli").lower()
 
     if normalized == "gui":
@@ -27,11 +27,15 @@ def create_viewport(
         logger.debug("create_viewport: gui")
         return GuiViewManager(event_bus=event_bus, task_manager=task_manager)
 
+    if normalized == "tui":
+        from src.ui.tui import TuiViewManager
+
+        logger.info("create_viewport: tui")
+        return TuiViewManager(event_bus=event_bus, task_manager=task_manager)
+
     if normalized == "gpio":
         if sys.platform != "linux":
-            logger.warning(
-                f"GPIO 仅支持 Linux（当前 {sys.platform}），回退到 cli 界面"
-            )
+            logger.warning(f"GPIO 仅支持 Linux（当前 {sys.platform}），回退到 cli 界面")
         else:
             from src.ui.gpio import GpioViewManager
 
```

**File**: `src/ui/tui/__init__.py` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+"""TUI 模式：基于 Textual 的全屏终端界面（可选 extra: tui）."""
+
+from src.ui.tui.manager import TuiViewManager
+
+__all__ = ["TuiViewManager"]
```

**File**: `src/ui/tui/app.py` (added, +387/-0)
```diff
@@ -0,0 +1,387 @@
+"""Textual App：仪表盘 + 设置屏."""
+
+from __future__ import annotations
+
+from collections.abc import Callable
+
+from textual import on
+from textual.app import App, ComposeResult
+from textual.binding import Binding
+from textual.containers import Horizontal, Vertical, VerticalScroll
+from textual.reactive import reactive
+from textual.screen import ModalScreen
+from textual.widgets import (
+    Button,
+    Footer,
+    Header,
+    Input,
+    Label,
+    RichLog,
+    Static,
+    TabbedContent,
+    TabPane,
+)
+
+from src.constants.system import SystemConstants
+from src.logging import get_logger
+from src.ui.tui.settings_data import (
+    SETTING_SECTIONS,
+    load_setting_values,
+    save_settings,
+)
+
+logger = get_logger()
+
+
+class SettingsScreen(ModalScreen[bool]):
+    """配置编辑弹层；返回 True 表示已保存."""
+
+    BINDINGS = [
+        Binding("escape", "cancel", "取消", show=True),
+    ]
+
+    CSS = """
+    SettingsScreen {
+        align: center middle;
+    }
+    #settings-dialog {
+        width: 90%;
+        max-width: 100;
+        height: 85%;
+        border: thick $primary;
+        background: $surface;
+        padding: 1 2;
+    }
+    #settings-title {
+        text-style: bold;
+        margin-bottom: 1;
+    }
+    #settings-hint {
+        color: $text-muted;
+        margin-bottom: 1;
+    }
+    .field-row {
+        height: auto;
+        margin-bottom: 1;
+    }
+    .field-label {
+        width: 20;
+        color: $text-muted;
+        padding-top: 1;
+    }
+    .field-input {
+        width: 1fr;
+    }
+    #settings-actions {
+        height: 3;
+        align: right middle;
+        margin-top: 1;
+    }
+    #settings-status {
+        color: $accent;
+        height: 1;
+        margin-top: 1;
+    }
+    """
+
+    def __init__(self) -> None:
+        super().__init__()
+        self._values = load_setting_values()
+
+    def compose(self) -> ComposeResult:
+        with Vertical(id="settings-dialog"):
+            yield Static("设置", id="settings-title")
+            yield Static(
+                "编辑后点「保存」写盘并热应用 | Esc 取消 | "
+                "choice 字段请填合法值（见占位提示）",
+                id="settings-hint",
+            )
+            with TabbedContent():
+                for section_name, fields in SETTING_SECTIONS:
+                    with TabPane(section_name):
+                        with VerticalScroll():
+                            for f in fields:
+                                with Horizontal(classes="field-row"):
+                                    yield Label(f.label, classes="field-label")
+                                    current = self._values.get(f.path, "")
+                                    placeholder = f.help or f.path
+                                    if f.kind == "choice" and f.choices:
+                                        placeholder = f"可选: {', '.join(f.choices)}"
+                                    elif f.kind == "bool":
+                                        placeholder = "true / false"
+                                    yield Input(
+                                        value=current,
+                                        placeholder=placeholder,
+                                        id=f"fld-{f.path.replace('.', '-')}",
+                                        classes="field-input",
+                                    )
+            yield Static("", id="settings-status")
+            with Horizontal(id="settings-actions"):
+                yield Button("取消", id="btn-cancel", variant="default")
+                yield Button("保存", id="btn-save", variant="primary")
+
+    def _collect_values(self) -> dict[str, str]:
+        out: dict[str, str] = {}
+        for _section, fields in SETTING_SECTIONS:
+            for f in fields:
+                wid = f"fld-{f.path.replace('.', '-')}"
+                try:
+                    w = self.query_one(f"#{wid}", Input)
+                    out[f.path] = w.value
+                except Exception:
+                    out[f.path] = self._values.get(f.path, "")
+        return out
+
+    @on(Button.Pressed, "#btn-cancel")
+    def on_cancel_btn(self) -> None:
+        self.dismiss(False)
+
+    def action_cancel(self) -> None:
+        self.dismiss(False)
+
+    @on(Button.Pressed, "#btn-save")
+    def on_save_btn(self) -> None:
+        values = self._collect_values()
+        ok, msg = save_settings(values)
+        try:
+            self.query_one("#settings-status", Static).update(msg)
+        except Exception:
+            pass
+        if ok:
+            self.dismiss(True)
+
+
+class XiaozhiTuiApp(App[None]):
+    """小智 TUI 主应用."""
+
+    TITLE = SystemConstants.APP_DISPLAY_NAME
+    SUB_TITLE = "TUI"
+    CSS = """
+    Screen {
+        layout: vertical;
+    }
+    #status-panel {
+        height: auto;
+        max-height: 8;
+        border: solid $primary;
+        margin: 0 1;
+        padding: 0 1;
+    }
+    #status-line {
+        text-s
```

**File**: `src/ui/tui/manager.py` (added, +211/-0)
```diff
@@ -0,0 +1,211 @@
+"""TUI ViewManager：ViewPort 实现，驱动 Textual App."""
+
+from __future__ import annotations
+
+import asyncio
+from typing import TYPE_CHECKING
+
+from src.core.event_bus import EventBus, Events
+from src.logging import get_logger
+
+if TYPE_CHECKING:
+    from src.core.task_manager import TaskManager
+    from src.ui.tui.app import XiaozhiTuiApp
+
+logger = get_logger()
+
+
+class TuiViewManager:
+    """TUI 界面（ViewPort：与 GUI/CLI/GPIO 同一套 set_*）."""
+
+    def __init__(
+        self,
+        event_bus: EventBus,
+        task_manager: TaskManager | None = None,
+    ):
+        self._event_bus = event_bus
+        self._task_manager = task_manager
+        self._running = False
+        self._loop: asyncio.AbstractEventLoop | None = None
+        self._app: XiaozhiTuiApp | None = None
+        self._app_task: asyncio.Task | None = None
+
+        self._auto_mode = False
+        self._status = "待命"
+        self._connected = False
+        self._chat_text = ""
+        self._music_line = ""
+        self._emotion = "neutral"
+
+    async def start(self, mode: str = "tui"):
+        """启动 TUI（await 直到用户退出或任务取消）."""
+        try:
+            from src.ui.tui.app import XiaozhiTuiApp
+        except ImportError as e:
+            logger.error(
+                "TUI 模式需要 textual。请安装:\n"
+                "  uv sync --extra tui\n"
+                "  pip install '.[tui]'\n"
+                f"(原始错误: {e})"
+            )
+            raise
+
+        logger.info("TuiViewManager: 启动 TUI 界面...")
+        self._running = True
+        self._loop = asyncio.get_running_loop()
+
+        self._app = XiaozhiTuiApp(
+            on_command=self._handle_command,
+            on_settings_saved=self._on_settings_saved,
+        )
+        self._app.status_text = self._status
+        self._app.connected = self._connected
+        self._app.auto_mode = self._auto_mode
+        self._app.chat_text = self._chat_text
+        self._app.music_line = self._music_line
+        self._app.emotion = self._emotion
+
+        # UIPlugin 经 TaskManager.spawn 启动本协程；这里 await run_async
+        # 直到用户 q/Ctrl+C 或 close() 调用 app.exit()
+        try:
+            await self._app.run_async()
+        except asyncio.CancelledError:
+            logger.info("TuiViewManager: TUI 任务被取消")
+            app = self._app
+            if app is not None:
+                try:
+                    app.exit()
+                except Exception:
+                    pass
+            raise
+        finally:
+            self._running = False
+            if self._app is not None:
+                try:
+                    self._app.uninstall_log_handler()
+                except Exception:
+                    pass
+            logger.info("TuiViewManager: TUI 已结束")
+
+    async def close(self):
+        """关闭 TUI."""
+        logger.info("TuiViewManager: 正在关闭...")
+        self._running = False
+        app = self._app
+        if app is not None:
+            try:
+                app.exit()
+            except Exception:
+                pass
+            try:
+                app.uninstall_log_handler()
+            except Exception:
+                pass
+        logger.info("TuiViewManager: 已关闭")
+
+    def _handle_command(self, cmd: str):
+        """处理用户命令."""
+        cmd_lower = cmd.lower().strip()
+        if cmd_lower == "r":
+            self._safe_emit(Events.UI_MANUAL_TOGGLE)
+        elif cmd_lower == "x":
+            self._safe_emit(Events.UI_ABORT_REQUEST)
+        elif cmd_lower == "q":
+            self._safe_emit(Events.UI_QUIT_REQUEST)
+        else:
+            self._safe_emit(Events.UI_SEND_TEXT, {"text": cmd})
+
+    def _on_settings_saved(self) -> None:
+        """设置保存后通知运行时热重载."""
+        self._safe_emit(Events.CONFIG_CHANGED)
+
+    def _safe_emit(self, event: str, data=None):
+        """安全发射 EventBus 事件."""
+
+        def _start_emit():
+            if data is None:
+                return self._event_bus.emit(event)
+            return self._event_bus.emit(event, data)
+
+        if self._task_manager is not None:
+            try:
+                self._task_manager.schedule_nowait(_start_emit)
+                return
+            except Exception as e:
+                logger.error(
+                    f"TuiViewManager 经 TaskManager 调度事件 {event} 失败: {e}",
+                    exc_info=True,
+                )
+
+        if not self._loop or not self._loop.is_running():
+            return
+        coro = _start_emit()
+        try:
+            fut = asyncio.run_coroutine_threadsafe(coro, self._loop)
+
+            def _done(f):
+                try:
+                    exc = f.exception()
+                except Exception:
+                    return
+                if exc:
+                    logger.error(
+                        f"TuiViewManager 发射事件 {event} 失败: {exc}",
+                        exc_info=exc,
+                    )
+
+            fut.add_done_callback(_done)
+        except Excepti
```

**File**: `src/ui/tui/settings_data.py` (added, +201/-0)
```diff
@@ -0,0 +1,201 @@
+"""TUI 设置：配置字段定义与读写（接 ConfigManager + CONFIG_CHANGED）."""
+
+from __future__ import annotations
+
+from dataclasses import dataclass
+from typing import Any
+
+from src.logging import get_logger
+from src.utils.config_manager import get_config
+
+logger = get_logger()
+
+
+@dataclass(frozen=True)
+class SettingField:
+    """一个可编辑配置项."""
+
+    path: str
+    label: str
+    kind: str = "str"  # str | int | bool | choice
+    choices: tuple[str, ...] = ()
+    help: str = ""
+
+
+# 第一期：系统 / 音频 / 摄像头 / 唤醒词
+SETTING_SECTIONS: list[tuple[str, list[SettingField]]] = [
+    (
+        "系统",
+        [
+            SettingField(
+                "SYSTEM_OPTIONS.NETWORK.OTA_VERSION_URL",
+                "OTA URL",
+                help="OTA / 激活配置地址",
+            ),
+            SettingField(
+                "SYSTEM_OPTIONS.NETWORK.WEBSOCKET_URL",
+                "WebSocket URL",
+                help="WebSocket 服务地址",
+            ),
+            SettingField(
+                "SYSTEM_OPTIONS.DEVICE_ID",
+                "设备 ID",
+                help="Device-Id（通常为 MAC）",
+            ),
+            SettingField(
+                "SYSTEM_OPTIONS.CLIENT_ID",
+                "客户端 ID",
+                help="Client-Id",
+            ),
+        ],
+    ),
+    (
+        "音频",
+        [
+            SettingField(
+                "AUDIO_DEVICES.input_device_name",
+                "输入设备名",
+                help="按名称匹配麦克风（热插拔后 ID 会变）",
+            ),
+            SettingField(
+                "AUDIO_DEVICES.output_device_name",
+                "输出设备名",
+                help="按名称匹配扬声器/耳机",
+            ),
+            SettingField(
+                "AUDIO_DEVICES.opus_output_sample_rate",
+                "Opus 输出采样率",
+                kind="choice",
+                choices=("24000", "16000"),
+                help="官方 24000 / 第三方常 16000",
+            ),
+            SettingField(
+                "AUDIO_DEVICES.frame_duration",
+                "帧时长 ms",
+                kind="choice",
+                choices=("20", "40", "60"),
+                help="20 低延迟 / 60 低 CPU",
+            ),
+        ],
+    ),
+    (
+        "摄像头",
+        [
+            SettingField(
+                "CAMERA.backend",
+                "采集后端",
+                kind="choice",
+                choices=("auto", "opencv", "picamera2"),
+                help="auto 先 OpenCV，失败再 Pi CSI",
+            ),
+            SettingField(
+                "CAMERA.device",
+                "设备路径",
+                help="如 /dev/video0；非空优先于 index",
+            ),
+            SettingField(
+                "CAMERA.camera_index",
+                "设备 index",
+                kind="int",
+                help="OpenCV 数字索引",
+            ),
+            SettingField(
+                "CAMERA.frame_width",
+                "宽度",
+                kind="int",
+            ),
+            SettingField(
+                "CAMERA.frame_height",
+                "高度",
+                kind="int",
+            ),
+        ],
+    ),
+    (
+        "唤醒词",
+        [
+            SettingField(
+                "WAKE_WORD_OPTIONS.USE_WAKE_WORD",
+                "启用唤醒词",
+                kind="bool",
+            ),
+            SettingField(
+                "WAKE_WORD_OPTIONS.WAKE_WORD",
+                "唤醒词",
+                help="如：你好小智",
+            ),
+            SettingField(
+                "WAKE_WORD_OPTIONS.WAKE_WORD_LANG",
+                "语言",
+                kind="choice",
+                choices=("zh", "en"),
+            ),
+        ],
+    ),
+]
+
+
+def load_setting_values() -> dict[str, str]:
+    """读取当前配置为字符串表（path -> 显示值）."""
+    cfg = get_config()
+    values: dict[str, str] = {}
+    for _section, fields in SETTING_SECTIONS:
+        for f in fields:
+            raw = cfg.get_config(f.path, "")
+            if f.kind == "bool":
+                values[f.path] = "true" if bool(raw) else "false"
+            elif raw is None:
+                values[f.path] = ""
+            else:
+                values[f.path] = str(raw)
+    return values
+
+
+def parse_field_value(field: SettingField, text: str) -> Any:
+    """把输入框字符串转成配置值."""
+    s = (text or "").strip()
+    if field.kind == "int":
+        if s == "":
+            return 0
+        return int(s)
+    if field.kind == "bool":
+        return s.lower() in ("1", "true", "yes", "on", "是")
+    if field.kind == "choice":
+        if field.choices and s not in field.choices:
+            # 仍写入用户值，由上层校验提示
+            return s
+        if field.path.endswith("opus_output_sample_rate") or field.path.endswith(
+            "frame_duration"
+        ):
+            try:
+                return int(s)
+            except ValueError:
+                return s
+        return s
+    return s
+
+
+def save_settings(values: dict[str, str]) -> tuple[bool, str]:
+    """批量写配置并落盘.
+
+    Returns:
+        (ok, message)
+    """
+    cfg = get_config()
+    updat
```

---

### Incident Patch 12: `290fc0b6` (2026-07-26)
**Commit Message**: style(ui): 圆角间距字号对齐 Theme token

StatusBadge/激活状态点/SpinBox/主窗歌词区/唤醒词预览改用 Theme，去掉魔法数。

**File**: `src/ui/gui/qml/components/StatusBadge.qml` (modified, +3/-2)
```diff
@@ -10,7 +10,7 @@ Rectangle {
 
     implicitWidth: row.width + Theme.spacingMd * 2
     implicitHeight: 24
-    radius: 12
+    radius: Theme.radiusLg
     color: {
         switch (status) {
             case "online": return Theme.successLight
@@ -27,7 +27,8 @@ Rectangle {
         Rectangle {
             width: 6
             height: 6
-            radius: 3
+            // 小圆点：用 radiusSm(4) 接近满圆，避免魔法数 3
+            radius: Theme.radiusSm
             anchors.verticalCenter: parent.verticalCenter
             color: {
                 switch (root.status) {
```

**File**: `src/ui/gui/qml/controls/XSpinBox.qml` (modified, +4/-4)
```diff
@@ -47,7 +47,7 @@ SpinBox {
 
         Rectangle {
             anchors.fill: parent
-            anchors.margins: 4
+            anchors.margins: Theme.spacingXs
             anchors.rightMargin: 2
             radius: Theme.radiusSm
             color: root.down.pressed ? Theme.backgroundHover : (root.down.hovered ? Theme.backgroundSecondary : "transparent")
@@ -56,7 +56,7 @@ SpinBox {
         Text {
             anchors.centerIn: parent
             text: "−"
-            font.pixelSize: 16
+            font.pixelSize: Theme.fontSizeLg
             font.weight: Font.Medium
             color: root.enabled ? Theme.textSecondary : Theme.textPlaceholder
         }
@@ -70,7 +70,7 @@ SpinBox {
 
         Rectangle {
             anchors.fill: parent
-            anchors.margins: 4
+            anchors.margins: Theme.spacingXs
             anchors.leftMargin: 2
             radius: Theme.radiusSm
             color: root.up.pressed ? Theme.backgroundHover : (root.up.hovered ? Theme.backgroundSecondary : "transparent")
@@ -79,7 +79,7 @@ SpinBox {
         Text {
             anchors.centerIn: parent
             text: "+"
-            font.pixelSize: 16
+            font.pixelSize: Theme.fontSizeLg
             font.weight: Font.Medium
             color: root.enabled ? Theme.textSecondary : Theme.textPlaceholder
         }
```

**File**: `src/ui/gui/qml/windows/ActivationWindow.qml` (modified, +1/-1)
```diff
@@ -45,7 +45,7 @@ AppWindow {
             Rectangle {
                 width: 8
                 height: 8
-                radius: 4
+                radius: Theme.radiusSm
                 color: activationModel ? activationModel.statusColor : Theme.textPlaceholder
 
                 // 激活中时闪烁动画
```

**File**: `src/ui/gui/qml/windows/MainWindow.qml` (modified, +2/-2)
```diff
@@ -100,8 +100,8 @@ AppWindow {
 
                         Column {
                             anchors.fill: parent
-                            anchors.margins: 8
-                            spacing: 4
+                            anchors.margins: Theme.spacingSm
+                            spacing: Theme.spacingXs
 
                             Text {
                                 width: parent.width
```

**File**: `src/ui/gui/qml/windows/settings/WakeWordTab.qml` (modified, +1/-1)
```diff
@@ -116,7 +116,7 @@ ScrollView {
                     anchors.right: parent.right
                     anchors.verticalCenter: parent.verticalCenter
                     anchors.margins: Theme.spacingMd
-                    spacing: 4
+                    spacing: Theme.spacingXs
 
                     Text {
                         text: "转换预览"
```

---

### Incident Patch 13: `c5b353a5` (2026-07-26)
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

---

### Incident Patch 14: `df154a1f` (2026-07-25)
**Commit Message**: fix(session): MCP 工具配置重连后保持空闲不进入聆听

协议通道打开时默认会切到 LISTENING；保存 MCP 启停触发的重连仅刷新
tools/list，应清除 keep_listening 并用一次性标志在通道打开后回到 IDLE。

**File**: `src/bootstrap/session.py` (modified, +28/-4)
```diff
@@ -36,6 +36,8 @@ def __init__(
         self.plugins = plugins
         self._event_bus = event_bus
         self._aborted = False
+        # MCP 工具配置重连等：通道打开后保持 IDLE，不自动进入聆听
+        self._keep_idle_on_channel_open = False
 
     # -------------------------
     # 事件订阅
@@ -57,6 +59,12 @@ def bind_events(self, event_bus: "EventBus") -> None:
     # 事件处理器
     # -------------------------
     async def _on_audio_channel_opened(self, _=None) -> None:
+        if self._keep_idle_on_channel_open:
+            self._keep_idle_on_channel_open = False
+            self.state.set_keep_listening(False)
+            await self.state.set_device_state(DeviceState.IDLE)
+            logger.info("协议通道已打开（配置重连）：保持空闲，不进入聆听")
+            return
         await self.state.set_device_state(DeviceState.LISTENING)
 
     async def _on_audio_channel_closed(self, _=None) -> None:
@@ -145,19 +153,35 @@ async def connect_protocol(self) -> bool:
         return opened
 
     async def _on_protocol_reconnect_request(self, _=None) -> None:
-        """设置保存后 MCP 工具列表变更：已连接则断开并重连，便于服务端重新 list."""
+        """设置保存后 MCP 工具列表变更：已连接则断开并重连，便于服务端重新 list.
+
+        仅刷新协议/工具视图，不恢复聆听会话（避免保存设置后进入「聆听中」）。
+        """
         try:
             if not self.protocol.is_audio_channel_opened():
                 logger.info("MCP 工具配置已更新（当前未连接，下次连接生效）")
                 return
             logger.info("MCP 工具配置已更新，正在重连协议…")
-            await self.protocol.disconnect()
-            ok = await self.connect_protocol()
+            # 打断进行中的听/说语义，避免重连后沿用 keep_listening
+            self.state.set_keep_listening(False)
+            self._aborted = False
+            self._keep_idle_on_channel_open = True
+            try:
+                await self.protocol.disconnect()
+                ok = await self.connect_protocol()
+            except Exception:
+                self._keep_idle_on_channel_open = False
+                raise
             if ok:
-                logger.info("协议重连成功（新 tools/list 将在握手时生效）")
+                # 双保险：若 OPENED 回调顺序异常，仍拉回空闲
+                if not self.state.is_idle():
+                    await self.state.set_device_state(DeviceState.IDLE)
+                logger.info("协议重连成功（新 tools/list 将在握手时生效，保持空闲）")
             else:
+                self._keep_idle_on_channel_open = False
                 logger.warning("协议重连失败，请手动重新连接")
         except Exception as e:
+            self._keep_idle_on_channel_open = False
             logger.error(f"协议重连失败: {e}", exc_info=True)
 
     async def start_listening(self, mode: ListeningMode) -> None:
```

---

### Incident Patch 15: `c308a153` (2026-07-25)
**Commit Message**: feat(ui): 数据目录输入框展示真实默认绝对路径

提供 pathDefault* 占位路径，系统选项中缓存/日志/音乐等字段绑定真实默认路径，不再使用 {用户数据}/cache 类模板文案。

**File**: `src/ui/gui/models/settings/system_options.py` (modified, +56/-11)
```diff
@@ -167,34 +167,79 @@ def _get_pathMcpPluginsDir(self) -> str:
     def _set_pathMcpPluginsDir(self, value: str):
         self._set_value("MCP_PLUGINS.DIR", value.strip() if value else "")
 
+    def _default_data_paths(self) -> dict[str, str]:
+        """配置留空时各目录的系统默认绝对路径（不含 PATHS 覆盖）."""
+        from pathlib import Path
+
+        from src.utils.resource_finder import get_user_data_dir
+
+        data = get_user_data_dir()
+        cache_custom = (self._get_pathCacheDir() or "").strip()
+        cache_default = Path(cache_custom) if cache_custom else (data / "cache")
+        return {
+            "cache": str(data / "cache"),
+            "log": str(data / "logs"),
+            # 音乐默认挂在「当前缓存」下：自定义了缓存则跟随
+            "music": str(cache_default / "music"),
+            "keywords": str(data / "keywords"),
+            "mcp": str(data / "mcp_plugins"),
+        }
+
+    def _get_pathDefaultCacheDir(self) -> str:
+        try:
+            return self._default_data_paths()["cache"]
+        except Exception:
+            return ""
+
+    def _get_pathDefaultLogDir(self) -> str:
+        try:
+            return self._default_data_paths()["log"]
+        except Exception:
+            return ""
+
+    def _get_pathDefaultMusicCacheDir(self) -> str:
+        try:
+            return self._default_data_paths()["music"]
+        except Exception:
+            return ""
+
+    def _get_pathDefaultKeywordsDir(self) -> str:
+        try:
+            return self._default_data_paths()["keywords"]
+        except Exception:
+            return ""
+
+    def _get_pathDefaultMcpPluginsDir(self) -> str:
+        try:
+            return self._default_data_paths()["mcp"]
+        except Exception:
+            return ""
+
     def _get_pathHints(self) -> str:
-        """只读：当前生效路径提示（默认路径说明）."""
+        """只读：数据根与操作提示（默认路径已显示在各输入框占位符）."""
         try:
-            from src.utils.resource_finder import (
-                get_music_cache_dir,
-                get_user_cache_dir,
-                get_user_data_dir,
-                get_user_log_dir,
-            )
+            from src.utils.resource_finder import get_user_data_dir
 
             data = get_user_data_dir()
             return (
                 f"数据根(配置固定在此): {data}\n"
-                f"当前缓存: {get_user_cache_dir()}\n"
-                f"当前日志: {get_user_log_dir()}\n"
-                f"当前音乐缓存: {get_music_cache_dir()}\n"
                 f"留空=默认；点「选择」用系统对话框；保存后下次启动迁移"
             )
         except Exception:
             return "留空使用默认路径；保存后下次启动迁移"
 
-    def _browse_directory(self, title: str, current: str) -> str:
+    def _browse_directory(self, title: str, current: str, which: str = "") -> str:
         """打开系统文件夹选择对话框；取消返回空串（调用方勿覆盖）."""
         from pathlib import Path
 
         from PySide6.QtWidgets import QApplication, QFileDialog
 
         start = current.strip() if current else ""
+        if not start and which:
+            try:
+                start = self._default_data_paths().get(which, "")
+            except Exception:
+                start = ""
         if not start:
             try:
                 from src.utils.resource_finder import get_user_data_dir
```

**File**: `src/ui/gui/qml/windows/settings/SystemOptionsTab.qml` (modified, +5/-5)
```diff
@@ -390,7 +390,7 @@ ScrollView {
                     text: settingsModel ? settingsModel.pathCacheDir : ""
                     onTextEdited: if (settingsModel) settingsModel.pathCacheDir = text
                     onEditingFinished: if (settingsModel) settingsModel.pathCacheDir = text
-                    placeholderText: "默认: {用户数据}/cache"
+                    placeholderText: settingsModel ? settingsModel.pathDefaultCacheDir : ""
                     font.pixelSize: Theme.fontSizeSm
                     background: Rectangle {
                         radius: Theme.radiusSm
@@ -464,7 +464,7 @@ ScrollView {
                     text: settingsModel ? settingsModel.pathLogDir : ""
                     onTextEdited: if (settingsModel) settingsModel.pathLogDir = text
                     onEditingFinished: if (settingsModel) settingsModel.pathLogDir = text
-                    placeholderText: "默认: {用户数据}/logs"
+                    placeholderText: settingsModel ? settingsModel.pathDefaultLogDir : ""
                     font.pixelSize: Theme.fontSizeSm
                     background: Rectangle {
                         radius: Theme.radiusSm
@@ -538,7 +538,7 @@ ScrollView {
                     text: settingsModel ? settingsModel.pathMusicCacheDir : ""
                     onTextEdited: if (settingsModel) settingsModel.pathMusicCacheDir = text
                     onEditingFinished: if (settingsModel) settingsModel.pathMusicCacheDir = text
-                    placeholderText: "默认: {缓存}/music"
+                    placeholderText: settingsModel ? settingsModel.pathDefaultMusicCacheDir : ""
                     font.pixelSize: Theme.fontSizeSm
                     background: Rectangle {
                         radius: Theme.radiusSm
@@ -612,7 +612,7 @@ ScrollView {
                     text: settingsModel ? settingsModel.pathKeywordsDir : ""
                     onTextEdited: if (settingsModel) settingsModel.pathKeywordsDir = text
                     onEditingFinished: if (settingsModel) settingsModel.pathKeywordsDir = text
-                    placeholderText: "默认: {用户数据}/keywords"
+                    placeholderText: settingsModel ? settingsModel.pathDefaultKeywordsDir : ""
                     font.pixelSize: Theme.fontSizeSm
                     background: Rectangle {
                         radius: Theme.radiusSm
@@ -686,7 +686,7 @@ ScrollView {
                     text: settingsModel ? settingsModel.pathMcpPluginsDir : ""
                     onTextEdited: if (settingsModel) settingsModel.pathMcpPluginsDir = text
                     onEditingFinished: if (settingsModel) settingsModel.pathMcpPluginsDir = text
-                    placeholderText: "默认: {用户数据}/mcp_plugins"
+                    placeholderText: settingsModel ? settingsModel.pathDefaultMcpPluginsDir : ""
                     font.pixelSize: Theme.fontSizeSm
                     background: Rectangle {
                         radius: Theme.radiusSm
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

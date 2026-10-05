# Forensic Learning Record (Deep Inspection): sansan0/TrendRadar

> **Canonical Artifact**: `07_PROJECT_LEARNING/sansan0-trendradar-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/sansan0/TrendRadar](https://github.com/sansan0/TrendRadar))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:47:44.739Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `sansan0/TrendRadar`
- **Description**: ⭐AI-driven public opinion & trend monitor with multi-platform aggregation, RSS, and smart alerts.🎯 告别信息过载，你的 AI 舆情监控助手与热点筛选工具！聚合多平台热点 +  RSS 订阅，支持关键词精准筛选。AI 智能筛选新闻 + AI 翻译 +  AI 分析简报直推手机，也支持接入 MCP 架构，赋能 AI 自然语言对话分析、情感洞察与趋势预测等。支持 Docker ，数据本地/云端自持。集成微信/飞书/钉钉/Telegram/邮件/ntfy/bark/slack 等渠道智能推送。
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 62681 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `mcp_server/utils/__init__.py`
```
"""
工具类模块

提供参数验证、错误处理等辅助功能。
"""

```

### Core Architecture Module: `mcp_server/utils/date_parser.py`
```
"""
日期解析工具

支持多种自然语言日期格式解析，包括相对日期和绝对日期。
"""

import re
from datetime import datetime, timedelta
from typing import Tuple, Dict, Optional

from .errors import InvalidParameterError


class DateParser:
    """日期解析器类"""

    # 中文日期映射
    CN_DATE_MAPPING = {
        "今天": 0,
        "昨天": 1,
        "前天": 2,
        "大前天": 3,
    }

    # 英文日期映射
    EN_DATE_MAPPING = {
        "today": 0,
        "yesterday": 1,
    }

    # 日期范围表达式（用于 resolve_date_range_expression）
    RANGE_EXPRESSIONS = {
        # 中文表达式
        "今天": "today",
        "昨天": "yesterday",
        "本周": "this_week",
        "这周": "this_week",
        "当前周": "this_week",
        "上周": "last_week",
        "本月": "this_month",
        "这个月": "this_month",
        "当前月": "this_month",
        "上月": "last_month",
        "上个月": "last_month",
        "最近3天": "last_3_days",
        "近3天": "last_3_days",
        "最近7天": "last_7_days",
        "近7天": "last_7_days",
        "最近一周": "last_7_days",
        "过去一周": "last_7_days",
        "最近14天": "last_14_days",
        "近14天": "last_14_days",
        "最近两周": "last_14_days",
        "过去两周": "last_14_days",
        "最近30天": "last_30_days",
        "近30天": "last_30_days",
        "最近一个月": "last_30_days",
        "过去一个月": "last_30_days",
        # 英文表达式
        "today": "today",
        "yesterday": "yesterday",
        "this week": "this_week",
        "current week": "this_week",
        "last week": "last_week",
        "this month": "this_month",
        "current month": "this_month",
        "last month": "last_month",
        "last 3 days": "last_3_days",
        "past 3 days": "last_3_days",
        "last 7 days": "last_7_days",
        "past 7 days": "last_7_days",
        "past week": "last_7_days",
        "last 14 days": "last_14_days",
        "past 14 days": "last_14_days",
        "last 30 days": "last_30_days",
        "past 30 days": "last_30_days",
        "past month": "last_30_days",
    }

    # 星期映射
    WEEKDAY_CN = {
        "一": 0, "二": 1, "三": 2, "四": 3,
        "五": 4, "六": 5, "日": 6, "天": 6
    }

    WEEKDAY_EN = {
        "monday": 0, "tuesday": 1, "wednesday": 2, "thursday": 3,
        "friday": 4, "saturday": 5, "sunday": 6
    }

    @staticmethod
    def parse_date_query(date_query: str) -> datetime:
        """
        解析日期查询字符串

        支持的格式：
        - 相对日期（中文）：今天、昨天、前天、大前天、N天前
        - 相对日期（英文）：today、yesterday、N days ago
        - 星期（中文）：上周一、上周二、本周三
        - 星期（英文）：last monday、this friday
        - 绝对日期：2025-10-10、10月10日、2025年10月10日

        Args:
            date_query: 日期查询字符串

        Returns:
            datetime对象

        Raises:
            InvalidParameterError: 日期格式无法识别

        Examples:
            >>> DateParser.parse_date_query("今天")
            datetime(2025, 10, 11)
            >>> DateParser.parse_date_query("昨天")
            datetime(2025, 10, 10)
            >>> DateParser.parse_date_query("3天前")
            datetime(2025, 10, 8)
            >>> DateParser.parse_date_query("2025-10-10")
            datetime(2025, 10, 10)
        """
        if not date_query or not isinstance(date_query, str):
            raise InvalidParameterError(
                "日期查询字符串不能为空",
                suggestion="请提供有效的日期查询，如：今天、昨天、2025-10-10"
            )

        date_query = date_query.strip().lower()

        # 1. 尝试解析中文常用相对日期
        if date_query in DateParser.CN_DATE_MAPPING:
            days_ago = DateParser.CN_DATE_MAPPING[date_query]
            return datetime.now() - timedelta(days=days_ago)

        # 2. 尝试解析英文常用相对日期
        if date_query in DateParser.EN_DATE_MAPPING:
            days_ago = DateParser.EN_DATE_MAPPING[date_query]
            return datetime.now() - timedelta(days=days_ago)

        # 3. 尝试解析 "N天前" 或 "N days ago"
        cn_days_ago_match = re.match(r'(\d+)\s*天前', date_query)
        if cn_days_ago_match:
            days = int(cn_days_ago_match.group(1))
            if days > 365:
                raise InvalidParameterError(
                    f"天数过大: {days}天",
                    suggestion="请使用小于365天的相对日期或使用绝对日期"
                )
            return datetime.now() - timedelta(days=days)

        en_days_ago_match = re.match(r'(\d+)\s*days?\s+ago', date_query)
        if en_days_ago_match:
            days = int(en_days_ago_match.group(1))
            if days > 365:
                raise InvalidParameterError(
                    f"天数过大: {days}天",
                    suggestion="请使用小于365天的相对日期或使用绝对日期"
                )
            return datetime.now() - timedelta(days=days)

        # 4. 尝试解析星期（中文）：上周一、本周三
        cn_weekday_match = re.match(r'(上|本)周([一二三四五六日天])', date_query)
        if cn_weekday_match:
            week_type = cn_weekday_match.group(1)  # 上 或 本
            weekday_str = cn_weekday_match.group(2)
            target_weekday = DateParser.WEEKDAY_CN[weekday_str]
            return DateParser._get_date_by_weekday(target_weekday, week_type == "上")

        # 5. 尝试解析星期（英文）：last monday、this friday
        en_weekday_match = re.match(r'(last|this)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)', date_query)
        if en_weekday_match:
            week_type = en_weekday_match.group(1)  # last 或 this
            weekday_str = en_weekday_match.group(2)
            target_weekday = DateParser.WEEKDAY_EN[weekday_str]
            return DateParser._get_date_by_weekday(target_weekday, week_type == "last")

        # 6. 尝试解析绝对日期：YYYY-MM-DD
        iso_date_match = re.match(r'(\d{4})-(\d{1,2})-(\d{1,2})', date_query)
        if iso_date_match:
            year = int(iso_date_match.group(1))
            month = int(iso_date_match.group(2))
            day = int(iso_date_match.group(3))
            try:
                return datetime(year, month, day)
            except ValueError as e:
                raise InvalidParameterError(
                    f"无效的日期: {date_query}",
                    suggestion=f"日期值错误: {str(e)}"
                )

        # 7. 尝试解析中文日期：MM月DD日 或 YYYY年MM月DD日
        cn_date_match = re.match(r'(?:(\d{4})年)?(\d{1,2})月(\d{1,2})日', date_query)
        if cn_date_match:
            year_str = cn_date_match.group(1)
            month = int(cn_date_match.group(2))
            day = int(cn_date_match.group(3))

            # 如果没有年份，使用当前年份
            if year_str:
                year = int(year_str)
            else:
                year = datetime.now().year
                # 如果月份大于当前月份，说明是去年
                current_month = datetime.now().month
                if month > current_month:
                    year -= 1

            try:
                return datetime(year, month, day)
            except ValueError as e:
                raise InvalidParameterError(
                    f"无效的日期: {date_query}",
                    suggestion=f"日期值错误: {str(e)}"
                )

        # 8. 尝试解析斜杠格式：YYYY/MM/DD 或 MM/DD
        slash_date_match = re.match(r'(?:(\d{4})/)?(\d{1,2})/(\d{1,2})', date_query)
        if slash_date_match:
            year_str = slash_date_match.group(1)
            month = int(slash_date_match.group(2))
            day = int(slash_date_match.group(3))

            if year_str:
                year = int(year_str)
            else:
                year = datetime.now().year
                current_month = datetime.now().month
                if month > current_month:
                    year -= 1

            try:
                return datetime(year, month, day)
            except ValueError as e:
                raise InvalidParameterError(
                    f"无效的日期: {date_query}",
                    suggestion=f"日期值错误: {str(e)}"
                )

        # 如果所有格式都不匹配
        raise InvalidParameterError(
            f"无法识别的日期格式: {date_query}",
            suggestion=(
                "支持的格式:\n"
                "- 相对日期: 今天、昨天、前天、3天前、today、yesterday、3 days ago\n"
                "- 星期: 上周一、本周三、last monday、this friday\n"
                "- 绝对日期: 2025-10-10、10月10日、2025年10月10日"
            )
        )

    @staticmethod
    def _get_date_by_weekday(target_weekday: int, is_last_week: bool) -> datetime:
        """
        根据星期几获取日期

        Args:
            target_weekday: 目标星期 (0=周一, 6=周日)
            is_last_week: 是否是上周

        Returns:
            datetime对象
        """
        today = datetime.now()
        current_weekday = today.weekday()

        # 计算天数差
        if is_last_week:
            # 上周的某一天
            days_diff = current_weekday - target_weekday + 7
        else:
            # 本周的某一天
            days_diff = current_weekday - target_weekday
            if days_diff < 0:
                days_diff += 7

        return today - timedelta(days=days_diff)

    @staticmethod
    def format_date_folder(date: datetime) -> str:
        """
        将日期格式化为文件夹名称

        Args:
            date: datetime对象

        Returns:
            文件夹名称，格式: YYYY-MM-DD

        Examples:
            >>> DateParser.format_date_folder(datetime(2025, 10, 11))
            '2025-10-11'
        """
        return date.strftime("%Y-%m-%d")

    @staticmethod
    def validate_date_not_future(date: datetime) -> None:
        """
        验证日期不在未来

        Args:
            date: 待验证的日期

        Raises:
            InvalidParameterError: 日期在未来
        """
        if date.date() > datetime.now().date():
            raise InvalidParameterError(
                f"不能查询未来的日期: {date.strftime('%Y-%m-%d')}",
                suggestion="请使用今天或过去的日期"
            )

    @staticmethod
    def validate_date_not_too_old(date: datetime, max_days: int = 365) -> None:
        """
        验证日期不太久远

        Args:
            date: 待验证的日期
            max_days: 最大天数

        Raises:
            InvalidParameterError: 日期太久远
        """
        days_ago = (datetime.now().date() - date.date()).days
        if days_ago > max_days:
            raise InvalidParameterError(
                f"日期太久远: {date.strftime('%Y-%m-%d')} ({days_ago}天前)",
                suggestion=f"请查询{max_days}天内的数据"
            )

    @staticmethod
    def resolve_da
```

### Core Architecture Module: `mcp_server/utils/errors.py`
```
"""
自定义错误类

定义MCP Server使用的所有自定义异常类型。
"""

from typing import Optional, List, Callable


# ==================== 延迟加载支持的平台列表 ====================

_get_supported_platforms: Optional[Callable[[], List[str]]] = None


def _load_supported_platforms() -> List[str]:
    """延迟加载支持的平台列表"""
    global _get_supported_platforms
    if _get_supported_platforms is None:
        try:
            from .validators import get_supported_platforms
            _get_supported_platforms = get_supported_platforms
        except ImportError:
            # 降级：返回空列表
            return []
    return _get_supported_platforms()


class MCPError(Exception):
    """MCP工具错误基类"""

    def __init__(self, message: str, code: str = "MCP_ERROR", suggestion: Optional[str] = None):
        super().__init__(message)
        self.code = code
        self.message = message
        self.suggestion = suggestion

    def to_dict(self) -> dict:
        """转换为字典格式"""
        error_dict = {
            "code": self.code,
            "message": self.message
        }
        if self.suggestion:
            error_dict["suggestion"] = self.suggestion
        return error_dict


class DataNotFoundError(MCPError):
    """数据不存在错误"""

    def __init__(self, message: str, suggestion: Optional[str] = None):
        super().__init__(
            message=message,
            code="DATA_NOT_FOUND",
            suggestion=suggestion or "请检查日期范围或等待爬取任务完成"
        )


class InvalidParameterError(MCPError):
    """参数无效错误"""

    def __init__(self, message: str, suggestion: Optional[str] = None):
        super().__init__(
            message=message,
            code="INVALID_PARAMETER",
            suggestion=suggestion or "请检查参数格式是否正确"
        )


class ConfigurationError(MCPError):
    """配置错误"""

    def __init__(self, message: str, suggestion: Optional[str] = None):
        super().__init__(
            message=message,
            code="CONFIGURATION_ERROR",
            suggestion=suggestion or "请检查配置文件是否正确"
        )


class PlatformNotSupportedError(MCPError):
    """平台不支持错误"""

    def __init__(self, platform: str):
        supported = _load_supported_platforms()
        suggestion = f"支持的平台: {', '.join(supported)}" if supported else "请检查 config/config.yaml 中的平台配置"
        super().__init__(
            message=f"平台 '{platform}' 不受支持",
            code="PLATFORM_NOT_SUPPORTED",
            suggestion=suggestion
        )


class CrawlTaskError(MCPError):
    """爬取任务错误"""

    def __init__(self, message: str, suggestion: Optional[str] = None):
        super().__init__(
            message=message,
            code="CRAWL_TASK_ERROR",
            suggestion=suggestion or "请稍后重试或查看日志"
        )


class FileParseError(MCPError):
    """文件解析错误"""

    def __init__(self, file_path: str, reason: str):
        super().__init__(
            message=f"解析文件 {file_path} 失败: {reason}",
            code="FILE_PARSE_ERROR",
            suggestion="请检查文件格式是否正确"
        )

```

### Core Architecture Module: `mcp_server/utils/validators.py`
```
"""
参数验证工具

提供统一的参数验证功能。
支持 MCP 客户端将参数序列化为字符串的情况。
"""

from datetime import datetime
from typing import List, Optional, Union
import os
import json
import yaml
import ast

from .errors import InvalidParameterError
from .date_parser import DateParser


# ==================== 辅助函数：处理字符串序列化 ====================

def _parse_string_to_list(value: str) -> List[str]:
    """
    将字符串解析为列表

    支持格式：
    - JSON 数组: '["zhihu", "weibo"]'
    - Python 列表字符串: "['zhihu', 'weibo']"
    - 逗号分隔: "zhihu, weibo" 或 "zhihu,weibo"

    Args:
        value: 字符串值

    Returns:
        解析后的列表

    Raises:
        InvalidParameterError: 解析失败
    """
    value = value.strip()

    if not value:
        return []

    # 尝试 JSON 解析: '["zhihu", "weibo"]'
    try:
        parsed = json.loads(value)
        if isinstance(parsed, list):
            return [str(item) for item in parsed]
        # 如果解析结果不是列表，继续尝试其他方式
    except json.JSONDecodeError:
        pass

    # 尝试 Python 字面量解析: "['zhihu', 'weibo']"
    try:
        parsed = ast.literal_eval(value)
        if isinstance(parsed, list):
            return [str(item) for item in parsed]
        if isinstance(parsed, str):
            # 单个字符串，包装成列表
            return [parsed]
    except (ValueError, SyntaxError):
        pass

    # 尝试逗号分隔: "zhihu, weibo" 或 "zhihu,weibo"
    if ',' in value:
        items = [item.strip() for item in value.split(',')]
        return [item for item in items if item]

    # 单个值
    return [value]


def _parse_string_to_int(value: str, param_name: str = "参数") -> int:
    """
    将字符串解析为整数

    Args:
        value: 字符串值
        param_name: 参数名（用于错误消息）

    Returns:
        解析后的整数

    Raises:
        InvalidParameterError: 解析失败
    """
    value = value.strip()

    try:
        # 尝试直接转换
        return int(value)
    except ValueError:
        pass

    # 尝试解析浮点数后取整
    try:
        return int(float(value))
    except ValueError:
        raise InvalidParameterError(
            f"{param_name} 必须是整数，无法解析: {value}",
            suggestion=f"请提供有效的整数值，如: 10, 50, 100"
        )


def _parse_string_to_float(value: str, param_name: str = "参数") -> float:
    """
    将字符串解析为浮点数

    Args:
        value: 字符串值
        param_name: 参数名（用于错误消息）

    Returns:
        解析后的浮点数

    Raises:
        InvalidParameterError: 解析失败
    """
    value = value.strip()

    try:
        return float(value)
    except ValueError:
        raise InvalidParameterError(
            f"{param_name} 必须是数字，无法解析: {value}",
            suggestion=f"请提供有效的数字值，如: 0.6, 3.0"
        )


def _parse_string_to_bool(value: str) -> bool:
    """
    将字符串解析为布尔值

    Args:
        value: 字符串值

    Returns:
        解析后的布尔值
    """
    value = value.strip().lower()

    if value in ('true', '1', 'yes', 'on'):
        return True
    elif value in ('false', '0', 'no', 'off', ''):
        return False
    else:
        # 默认非空字符串为 True
        return bool(value)


# 平台列表 mtime 缓存（避免每次 MCP 调用都重新读取 config.yaml）
_platforms_cache: Optional[List[str]] = None
_platforms_config_mtime: float = 0.0
_platforms_config_path: Optional[str] = None


def get_supported_platforms() -> List[str]:
    """
    从 config.yaml 动态获取支持的平台列表（带 mtime 缓存）

    仅当 config.yaml 被修改时才重新读取，避免每次 MCP 调用的重复 IO。

    Returns:
        平台ID列表

    Note:
        - 读取失败时返回空列表，允许所有平台通过（降级策略）
        - 平台列表来自 config/config.yaml 中的 platforms 配置
    """
    global _platforms_cache, _platforms_config_mtime, _platforms_config_path

    try:
        if _platforms_config_path is None:
            current_dir = os.path.dirname(os.path.abspath(__file__))
            _platforms_config_path = os.path.normpath(
                os.path.join(current_dir, "..", "..", "config", "config.yaml")
            )

        current_mtime = os.path.getmtime(_platforms_config_path)

        if _platforms_cache is not None and current_mtime == _platforms_config_mtime:
            return _platforms_cache

        with open(_platforms_config_path, 'r', encoding='utf-8') as f:
            config = yaml.safe_load(f)
            platforms_config = config.get('platforms', {})
            sources = platforms_config.get('sources', [])
            _platforms_cache = [p['id'] for p in sources if 'id' in p and p.get('enabled', True)]
            _platforms_config_mtime = current_mtime
            return _platforms_cache
    except Exception as e:
        print(f"警告：无法加载平台配置: {e}")
        return []


def validate_platforms(platforms: Optional[Union[List[str], str]]) -> List[str]:
    """
    验证平台列表

    Args:
        platforms: 平台ID列表或字符串，None表示使用 config.yaml 中配置的所有平台
                   支持多种格式：
                   - None: 使用默认平台
                   - ["zhihu", "weibo"]: JSON 数组
                   - '["zhihu", "weibo"]': JSON 数组字符串
                   - "['zhihu', 'weibo']": Python 列表字符串
                   - "zhihu, weibo": 逗号分隔字符串
                   - "zhihu": 单个平台字符串

    Returns:
        验证后的平台列表

    Raises:
        InvalidParameterError: 平台不支持

    Note:
        - platforms=None 时，返回 config.yaml 中配置的平台列表
        - 会验证平台ID是否在 config.yaml 的 platforms 配置中
        - 配置加载失败时，允许所有平台通过（降级策略）
    """
    supported_platforms = get_supported_platforms()

    if platforms is None:
        # 返回配置文件中的平台列表（用户的默认配置）
        return supported_platforms if supported_platforms else []

    # 支持字符串形式的列表输入（某些 MCP 客户端会将 JSON 数组序列化为字符串）
    if isinstance(platforms, str):
        platforms = _parse_string_to_list(platforms)
        if not platforms:
            # 空字符串或解析后为空，使用默认平台
            return supported_platforms if supported_platforms else []

    if not isinstance(platforms, list):
        raise InvalidParameterError("platforms 参数必须是列表类型")

    if not platforms:
        # 空列表时，返回配置文件中的平台列表
        return supported_platforms if supported_platforms else []

    # 如果配置加载失败（supported_platforms为空），允许所有平台通过
    if not supported_platforms:
        print("警告：平台配置未加载，跳过平台验证")
        return platforms

    # 验证每个平台是否在配置中
    invalid_platforms = [p for p in platforms if p not in supported_platforms]
    if invalid_platforms:
        raise InvalidParameterError(
            f"不支持的平台: {', '.join(invalid_platforms)}",
            suggestion=f"支持的平台（来自config.yaml）: {', '.join(supported_platforms)}"
        )

    return platforms


def validate_limit(limit: Optional[Union[int, str]], default: int = 20, max_limit: int = 1000) -> int:
    """
    验证数量限制参数

    Args:
        limit: 限制数量（整数或字符串）
        default: 默认值
        max_limit: 最大限制

    Returns:
        验证后的限制值

    Raises:
        InvalidParameterError: 参数无效
    """
    if limit is None:
        return default

    # 支持字符串形式的整数（某些 MCP 客户端会将数字序列化为字符串）
    if isinstance(limit, str):
        limit = _parse_string_to_int(limit, "limit")

    if not isinstance(limit, int):
        raise InvalidParameterError("limit 参数必须是整数类型")

    if limit <= 0:
        raise InvalidParameterError("limit 必须大于0")

    if limit > max_limit:
        raise InvalidParameterError(
            f"limit 不能超过 {max_limit}",
            suggestion=f"请使用分页或降低limit值"
        )

    return limit


def validate_date(date_str: str) -> datetime:
    """
    验证日期格式

    Args:
        date_str: 日期字符串 (YYYY-MM-DD)

    Returns:
        datetime对象

    Raises:
        InvalidParameterError: 日期格式错误
    """
    try:
        return datetime.strptime(date_str, "%Y-%m-%d")
    except ValueError:
        raise InvalidParameterError(
            f"日期格式错误: {date_str}",
            suggestion="请使用 YYYY-MM-DD 格式，例如: 2025-10-11"
        )


def normalize_date_range(date_range: Optional[Union[dict, str]]) -> Optional[Union[dict, str]]:
    """
    规范化 date_range 参数

    某些 MCP 客户端（特别是 HTTP 方式）会将 JSON 对象序列化为字符串传入。
    此函数尝试将 JSON 字符串解析为 dict，如果不是 JSON 格式则保持原样。

    Args:
        date_range: 日期范围，可能是:
            - dict: {"start": "2025-01-01", "end": "2025-01-07"}
            - JSON 字符串: '{"start": "2025-01-01", "end": "2025-01-07"}'
            - 普通字符串: "今天", "昨天", "2025-01-01"
            - None

    Returns:
        规范化后的 date_range（dict 或普通字符串）

    Examples:
        >>> normalize_date_range('{"start":"2025-01-01","end":"2025-01-07"}')
        {"start": "2025-01-01", "end": "2025-01-07"}
        >>> normalize_date_range("今天")
        "今天"
        >>> normalize_date_range({"start": "2025-01-01", "end": "2025-01-07"})
        {"start": "2025-01-01", "end": "2025-01-07"}
    """
    if date_range is None:
        return None

    # 如果已经是 dict，直接返回
    if isinstance(date_range, dict):
        return date_range

    # 如果是字符串，尝试解析为 JSON
    if isinstance(date_range, str):
        # 检查是否看起来像 JSON 对象
        stripped = date_range.strip()
        if stripped.startswith('{') and stripped.endswith('}'):
            try:
                parsed = json.loads(stripped)
                if isinstance(parsed, dict):
                    return parsed
            except json.JSONDecodeError:
                pass  # 解析失败，当作普通字符串处理

    return date_range


def validate_date_range(date_range: Optional[Union[dict, str]]) -> Optional[tuple]:
    """
    验证日期范围

    Args:
        date_range: 日期范围，支持多种格式：
            - dict: {"start": "YYYY-MM-DD", "end": "YYYY-MM-DD"}
            - JSON 字符串: '{"start": "2025-01-01", "end": "2025-01-07"}'
            - 单日字符串: "2025-01-01"（自动转为同一天的范围）
            - 自然语言: "今天", "昨天", "本周", "最近7天" 等

    Returns:
        (start_date, end_date) 元组，或 None

    Raises:
        InvalidParameterError: 日期范围无效
    """
    if date_range is None:
        return None

    # 支持字符串形式的输入
    if isinstance(date_range, str):
        stripped = date_range.strip()

        # 1. 检查是否是 JSON 对象格式
        if stripped.startswith('{') and stripped.endswith('}'):
            try:
                date_range = json.loads(stripped)
            except json.JSONDecodeError as e:
                raise InvalidParameterError(
                    f"date_range JSON 解析失败: {e}",
                    suggestion='请使用正确的JSON格式: {"start": "YYYY-MM-DD", "end": "YYYY-MM-DD"}'
                )
        # 2. 检查是否是单日字符串格式 YYYY-MM-DD
        elif len(stripped) 
```

### Core Architecture Module: `trendradar/core/__init__.py`
```
# coding=utf-8
"""
核心模块 - 配置管理和核心工具
"""

from trendradar.core.config import (
    parse_multi_account_config,
    validate_paired_configs,
    limit_accounts,
    get_account_at_index,
)
from trendradar.core.loader import load_config
from trendradar.core.frequency import load_frequency_words, matches_word_groups
from trendradar.core.scheduler import Scheduler, ResolvedSchedule
from trendradar.core.data import (
    read_all_today_titles_from_storage,
    read_all_today_titles,
    detect_latest_new_titles_from_storage,
    detect_latest_new_titles,
)
from trendradar.core.analyzer import (
    calculate_news_weight,
    format_time_display,
    count_word_frequency,
    count_rss_frequency,
)

__all__ = [
    "parse_multi_account_config",
    "validate_paired_configs",
    "limit_accounts",
    "get_account_at_index",
    "load_config",
    "load_frequency_words",
    "matches_word_groups",
    # 数据处理
    "read_all_today_titles_from_storage",
    "read_all_today_titles",
    "detect_latest_new_titles_from_storage",
    "detect_latest_new_titles",
    # 统计分析
    "calculate_news_weight",
    "format_time_display",
    "count_word_frequency",
    "count_rss_frequency",
    # 调度器
    "Scheduler",
    "ResolvedSchedule",
]

```

### Core Architecture Module: `trendradar/core/analyzer.py`
```
# coding=utf-8
"""
统计分析模块

提供新闻统计和分析功能：
- calculate_news_weight: 计算新闻权重
- format_time_display: 格式化时间显示
- count_word_frequency: 统计词频
"""

from typing import Dict, List, Tuple, Optional, Callable

from trendradar.core.frequency import matches_word_groups, _word_matches
from trendradar.utils.time import DEFAULT_TIMEZONE


def calculate_news_weight(
    title_data: Dict,
    rank_threshold: int,
    weight_config: Dict,
) -> float:
    """
    计算新闻权重，用于排序

    Args:
        title_data: 标题数据，包含 ranks 和 count
        rank_threshold: 排名阈值
        weight_config: 权重配置 {RANK_WEIGHT, FREQUENCY_WEIGHT, HOTNESS_WEIGHT}

    Returns:
        float: 计算出的权重值
    """
    ranks = title_data.get("ranks", [])
    if not ranks:
        return 0.0

    count = title_data.get("count", len(ranks))

    # 单次遍历计算排名分数总和与高排名次数
    rank_score_sum = 0
    high_rank_count = 0
    for rank in ranks:
        rank_score_sum += 11 - min(rank, 10)
        if rank <= rank_threshold:
            high_rank_count += 1

    # 归一化到 0~100（与 frequency_weight、hotness_weight 量纲对齐）
    rank_weight = (rank_score_sum / len(ranks)) * 10

    # 频次权重：min(出现次数, 10) × 10
    frequency_weight = min(count, 10) * 10

    # 热度加成：高排名次数 / 总出现次数 × 100
    hotness_ratio = high_rank_count / len(ranks)
    hotness_weight = hotness_ratio * 100

    total_weight = (
        rank_weight * weight_config["RANK_WEIGHT"]
        + frequency_weight * weight_config["FREQUENCY_WEIGHT"]
        + hotness_weight * weight_config["HOTNESS_WEIGHT"]
    )

    return total_weight


def format_time_display(
    first_time: str,
    last_time: str,
    convert_time_func: Callable[[str], str],
) -> str:
    """
    格式化时间显示（将 HH-MM 转换为 HH:MM）

    Args:
        first_time: 首次出现时间
        last_time: 最后出现时间
        convert_time_func: 时间格式转换函数

    Returns:
        str: 格式化后的时间显示字符串
    """
    if not first_time:
        return ""
    # 转换为显示格式
    first_display = convert_time_func(first_time)
    last_display = convert_time_func(last_time)
    if first_display == last_display or not last_display:
        return first_display
    else:
        return f"[{first_display} ~ {last_display}]"


def count_word_frequency(
    results: Dict,
    word_groups: List[Dict],
    filter_words: List[str],
    id_to_name: Dict,
    title_info: Optional[Dict] = None,
    rank_threshold: int = 3,
    new_titles: Optional[Dict] = None,
    mode: str = "daily",
    global_filters: Optional[List[str]] = None,
    weight_config: Optional[Dict] = None,
    max_news_per_keyword: int = 0,
    sort_by_position_first: bool = False,
    is_first_crawl_func: Optional[Callable[[], bool]] = None,
    convert_time_func: Optional[Callable[[str], str]] = None,
    quiet: bool = False,
) -> Tuple[List[Dict], int]:
    """
    统计词频，支持必须词、频率词、过滤词、全局过滤词，并标记新增标题

    Args:
        results: 抓取结果 {source_id: {title: title_data}}
        word_groups: 词组配置列表
        filter_words: 过滤词列表
        id_to_name: ID 到名称的映射
        title_info: 标题统计信息（可选）
        rank_threshold: 排名阈值
        new_titles: 新增标题（可选）
        mode: 报告模式 (daily/incremental/current)
        global_filters: 全局过滤词（可选）
        weight_config: 权重配置
        max_news_per_keyword: 每个关键词最大显示数量
        sort_by_position_first: 是否优先按配置位置排序
        is_first_crawl_func: 检测是否是当天第一次爬取的函数
        convert_time_func: 时间格式转换函数
        quiet: 是否静默模式（不打印日志）

    Returns:
        Tuple[List[Dict], int]: (统计结果列表, 总标题数)
    """
    # 默认权重配置
    if weight_config is None:
        weight_config = {
            "RANK_WEIGHT": 0.6,
            "FREQUENCY_WEIGHT": 0.3,
            "HOTNESS_WEIGHT": 0.1,
        }

    # 默认时间转换函数
    if convert_time_func is None:
        convert_time_func = lambda x: x

    # 默认首次爬取检测函数
    if is_first_crawl_func is None:
        is_first_crawl_func = lambda: True

    # 如果没有配置词组，创建一个包含所有新闻的虚拟词组
    if not word_groups:
        print("频率词配置为空，将显示所有新闻")
        word_groups = [{"required": [], "normal": [], "group_key": "全部新闻"}]
        filter_words = []  # 清空过滤词，显示所有新闻

    is_first_today = is_first_crawl_func()

    # 确定处理的数据源和新增标记逻辑
    if mode == "incremental":
        if is_first_today:
            # 增量模式 + 当天第一次：处理所有新闻，都标记为新增
            results_to_process = results
            all_news_are_new = True
        else:
            # 增量模式 + 当天非第一次：只处理新增的新闻
            results_to_process = new_titles if new_titles else {}
            all_news_are_new = True
    elif mode == "current":
        # current 模式：只处理当前时间批次的新闻，但统计信息来自全部历史
        if title_info:
            latest_time = None
            for source_titles in title_info.values():
                for title_data in source_titles.values():
                    last_time = title_data.get("last_time", "")
                    if last_time:
                        if latest_time is None or last_time > latest_time:
                            latest_time = last_time

            # 只处理 last_time 等于最新时间的新闻
            if latest_time:
                results_to_process = {}
                for source_id, source_titles in results.items():
                    if source_id in title_info:
                        filtered_titles = {}
                        for title, title_data in source_titles.items():
                            if title in title_info[source_id]:
                                info = title_info[source_id][title]
                                if info.get("last_time") == latest_time:
                                    filtered_titles[title] = title_data
                        if filtered_titles:
                            results_to_process[source_id] = filtered_titles

                if not quiet:
                    print(
                        f"当前榜单模式：最新时间 {latest_time}，筛选出 {sum(len(titles) for titles in results_to_process.values())} 条当前榜单新闻"
                    )
            else:
                results_to_process = results
        else:
            results_to_process = results
        all_news_are_new = False
    else:
        # 当日汇总模式：处理所有新闻
        results_to_process = results
        all_news_are_new = False
        total_input_news = sum(len(titles) for titles in results.values())
        filter_status = (
            "全部显示"
            if len(word_groups) == 1 and word_groups[0]["group_key"] == "全部新闻"
            else "频率词过滤"
        )
        print(f"当日汇总模式：处理 {total_input_news} 条新闻，模式：{filter_status}")

    word_stats = {}
    total_titles = 0
    processed_titles = {}
    matched_new_count = 0

    if title_info is None:
        title_info = {}
    if new_titles is None:
        new_titles = {}

    for group in word_groups:
        group_key = group["group_key"]
        word_stats[group_key] = {"count": 0, "titles": {}}

    for source_id, titles_data in results_to_process.items():
        total_titles += len(titles_data)

        if source_id not in processed_titles:
            processed_titles[source_id] = {}

        for title, title_data in titles_data.items():
            if title in processed_titles.get(source_id, {}):
                continue

            # 使用统一的匹配逻辑
            matches_frequency_words = matches_word_groups(
                title, word_groups, filter_words, global_filters
            )

            if not matches_frequency_words:
                continue

            # 如果是增量模式或 current 模式第一次，统计匹配的新增新闻数量
            if (mode == "incremental" and all_news_are_new) or (
                mode == "current" and is_first_today
            ):
                matched_new_count += 1

            source_ranks = title_data.get("ranks", [])
            source_url = title_data.get("url", "")
            source_mobile_url = title_data.get("mobileUrl", "")

            # 找到匹配的词组（防御性转换确保类型安全）
            title_lower = str(title).lower() if not isinstance(title, str) else title.lower()
            for group in word_groups:
                required_words = group["required"]
                normal_words = group["normal"]

                # 如果是"全部新闻"模式，所有标题都匹配第一个（唯一的）词组
                if len(word_groups) == 1 and word_groups[0]["group_key"] == "全部新闻":
                    group_key = group["group_key"]
                    word_stats[group_key]["count"] += 1
                    if source_id not in word_stats[group_key]["titles"]:
                        word_stats[group_key]["titles"][source_id] = []
                else:
                    # 原有的匹配逻辑（支持正则语法）
                    if required_words:
                        all_required_present = all(
                            _word_matches(req_item, title_lower)
                            for req_item in required_words
                        )
                        if not all_required_present:
                            continue

                    if normal_words:
                        any_normal_present = any(
                            _word_matches(normal_item, title_lower)
                            for normal_item in normal_words
                        )
                        if not any_normal_present:
                            continue

                    group_key = group["group_key"]
                    word_stats[group_key]["count"] += 1
                    if source_id not in word_stats[group_key]["titles"]:
                        word_stats[group_key]["titles"][source_id] = []

                first_time = ""
                last_time = ""
                count_info = 1
                ranks = source_ranks if source_ranks else []
                url = source_url
                mobile_url = source_mobile_url
                rank_timeline = []

                # 对于 current 模式，从历史统计信息中获取完整数据
                if (
                    mode == "current"
                    and title_info
                    and source_id in title_info
                    and title in title_info[source_id]
                ):
                    info = title_info[source_id][title]
                    first_time = info.get("first_time", "")
                    last_time = info.get("last_time", "")
                    count_info = info.
```

### Core Architecture Module: `trendradar/core/cdn.py`
```
# coding=utf-8
"""
CDN 回退模块

为版本检查等远程请求提供多源回退能力。
默认使用 GitHub 原始链接，失败后自动切换到 CDN 备用源。
同一会话中记住可用源的索引，后续请求从该源开始尝试。
"""

import re
import logging
from typing import Optional

import requests

logger = logging.getLogger(__name__)

_GITHUB_RAW_PATTERN = re.compile(
    r"^https://raw\.githubusercontent\.com/sansan0/TrendRadar/(?:refs/heads/)?master/(.+)$"
)

_ALL_SOURCES = [
    "https://raw.githubusercontent.com/sansan0/TrendRadar/refs/heads/master/",
    "https://fastly.jsdelivr.net/gh/sansan0/TrendRadar@master/",
    "https://cdn.jsdelivr.net/gh/sansan0/TrendRadar@master/",
    "https://gcore.jsdelivr.net/gh/sansan0/TrendRadar@master/",
]

_SOURCE_LABELS = {
    _ALL_SOURCES[0]: "GitHub",
    _ALL_SOURCES[1]: "fastly.jsdelivr.net",
    _ALL_SOURCES[2]: "cdn.jsdelivr.net",
    _ALL_SOURCES[3]: "gcore.jsdelivr.net",
}

_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "text/plain, */*",
    "Cache-Control": "no-cache",
}

_TIMEOUT = 5

_state = {"last_ok": 0}


def _extract_path(url: str) -> Optional[str]:
    m = _GITHUB_RAW_PATTERN.match(url)
    return m.group(1) if m else None


def _do_request(url: str, proxies: Optional[dict]) -> str:
    resp = requests.get(url, headers=_HEADERS, proxies=proxies, timeout=_TIMEOUT)
    resp.raise_for_status()
    return resp.text.strip()


def fetch_with_fallback(
    url: str,
    proxy_url: Optional[str] = None,
) -> Optional[str]:
    """从上次成功的源开始轮转尝试，非 GitHub 链接直接请求。"""
    proxies = {"http": proxy_url, "https": proxy_url} if proxy_url else None

    path = _extract_path(url)
    if path is None:
        try:
            return _do_request(url, proxies)
        except Exception as e:
            logger.warning("[版本检查] 获取失败: %s", e)
            return None

    n = len(_ALL_SOURCES)
    start = _state["last_ok"]

    for offset in range(n):
        idx = (start + offset) % n
        source = _ALL_SOURCES[idx]
        try:
            content = _do_request(source + path, proxies)
            if idx != start:
                label = _SOURCE_LABELS.get(source, source)
                logger.info("[版本检查] 已切换到: %s", label)
            _state["last_ok"] = idx
            return content
        except Exception:
            label = _SOURCE_LABELS.get(source, source)
            logger.debug("[版本检查] %s 不可用，尝试下一个源", label)

    logger.warning("[版本检查] 所有源均不可用")
    return None

```

### Core Architecture Module: `trendradar/core/config.py`
```
# coding=utf-8
"""
配置工具模块 - 多账号配置解析和验证

提供多账号推送配置的解析、验证和限制功能
"""

from typing import Dict, List, Optional, Tuple


def parse_multi_account_config(config_value: str, separator: str = ";") -> List[str]:
    """
    解析多账号配置，返回账号列表

    Args:
        config_value: 配置值字符串，多个账号用分隔符分隔
        separator: 分隔符，默认为 ;

    Returns:
        账号列表，空字符串会被保留（用于占位）

    Examples:
        >>> parse_multi_account_config("url1;url2;url3")
        ['url1', 'url2', 'url3']
        >>> parse_multi_account_config(";token2")  # 第一个账号无token
        ['', 'token2']
        >>> parse_multi_account_config("")
        []
    """
    if not config_value:
        return []
    # 保留空字符串用于占位（如 ";token2" 表示第一个账号无token）
    accounts = [acc.strip() for acc in config_value.split(separator)]
    # 过滤掉全部为空的情况
    if all(not acc for acc in accounts):
        return []
    return accounts


def validate_paired_configs(
    configs: Dict[str, List[str]],
    channel_name: str,
    required_keys: Optional[List[str]] = None
) -> Tuple[bool, int]:
    """
    验证配对配置的数量是否一致

    对于需要多个配置项配对的渠道（如 Telegram 的 token 和 chat_id），
    验证所有配置项的账号数量是否一致。

    Args:
        configs: 配置字典，key 为配置名，value 为账号列表
        channel_name: 渠道名称，用于日志输出
        required_keys: 必须有值的配置项列表

    Returns:
        (是否验证通过, 账号数量)

    Examples:
        >>> validate_paired_configs({
        ...     "token": ["t1", "t2"],
        ...     "chat_id": ["c1", "c2"]
        ... }, "Telegram", ["token", "chat_id"])
        (True, 2)

        >>> validate_paired_configs({
        ...     "token": ["t1", "t2"],
        ...     "chat_id": ["c1"]  # 数量不匹配
        ... }, "Telegram", ["token", "chat_id"])
        (False, 0)
    """
    # 过滤掉空列表
    non_empty_configs = {k: v for k, v in configs.items() if v}

    if not non_empty_configs:
        return True, 0

    # 检查必须项
    if required_keys:
        for key in required_keys:
            if key not in non_empty_configs or not non_empty_configs[key]:
                return True, 0  # 必须项为空，视为未配置

    # 获取所有非空配置的长度
    lengths = {k: len(v) for k, v in non_empty_configs.items()}
    unique_lengths = set(lengths.values())

    if len(unique_lengths) > 1:
        print(f"❌ {channel_name} 配置错误：配对配置数量不一致，将跳过该渠道推送")
        for key, length in lengths.items():
            print(f"   - {key}: {length} 个")
        return False, 0

    return True, list(unique_lengths)[0] if unique_lengths else 0


def limit_accounts(
    accounts: List[str],
    max_count: int,
    channel_name: str
) -> List[str]:
    """
    限制账号数量

    当配置的账号数量超过最大限制时，只使用前 N 个账号，
    并输出警告信息。

    Args:
        accounts: 账号列表
        max_count: 最大账号数量
        channel_name: 渠道名称，用于日志输出

    Returns:
        限制后的账号列表

    Examples:
        >>> limit_accounts(["a1", "a2", "a3"], 2, "飞书")
        ⚠️ 飞书 配置了 3 个账号，超过最大限制 2，只使用前 2 个
        ['a1', 'a2']
    """
    if len(accounts) > max_count:
        print(f"⚠️ {channel_name} 配置了 {len(accounts)} 个账号，超过最大限制 {max_count}，只使用前 {max_count} 个")
        print(f"   ⚠️ 警告：如果你是 fork 用户，过多账号可能导致 GitHub Actions 运行时间过长，存在账号风险")
        return accounts[:max_count]
    return accounts


def get_account_at_index(accounts: List[str], index: int, default: str = "") -> str:
    """
    安全获取指定索引的账号值

    当索引超出范围或账号值为空时，返回默认值。

    Args:
        accounts: 账号列表
        index: 索引
        default: 默认值

    Returns:
        账号值或默认值

    Examples:
        >>> get_account_at_index(["a", "b", "c"], 1)
        'b'
        >>> get_account_at_index(["a", "", "c"], 1, "default")
        'default'
        >>> get_account_at_index(["a"], 5, "default")
        'default'
    """
    if index < len(accounts):
        return accounts[index] if accounts[index] else default
    return default

```

### Core Architecture Module: `trendradar/core/data.py`
```
# coding=utf-8
"""
数据处理模块

提供数据读取和检测功能：
- read_all_today_titles: 从存储后端读取当天所有标题
- detect_latest_new_titles: 检测最新批次的新增标题

Author: TrendRadar Team
"""

from typing import Dict, List, Tuple, Optional


def read_all_today_titles_from_storage(
    storage_manager,
    current_platform_ids: Optional[List[str]] = None,
) -> Tuple[Dict, Dict, Dict]:
    """
    从存储后端读取当天所有标题（SQLite 数据）

    Args:
        storage_manager: 存储管理器实例
        current_platform_ids: 当前监控的平台 ID 列表（用于过滤）

    Returns:
        Tuple[Dict, Dict, Dict]: (all_results, id_to_name, title_info)
    """
    try:
        news_data = storage_manager.get_today_all_data()

        if not news_data or not news_data.items:
            return {}, {}, {}

        all_results = {}
        final_id_to_name = {}
        title_info = {}

        for source_id, news_list in news_data.items.items():
            # 按平台过滤
            if current_platform_ids is not None and source_id not in current_platform_ids:
                continue

            # 获取来源名称
            source_name = news_data.id_to_name.get(source_id, source_id)
            final_id_to_name[source_id] = source_name

            if source_id not in all_results:
                all_results[source_id] = {}
                title_info[source_id] = {}

            for item in news_list:
                title = item.title
                ranks = item.ranks or [item.rank]
                first_time = item.first_time or item.crawl_time
                last_time = item.last_time or item.crawl_time
                count = item.count
                rank_timeline = item.rank_timeline

                all_results[source_id][title] = {
                    "ranks": ranks,
                    "url": item.url or "",
                    "mobileUrl": item.mobile_url or "",
                }

                title_info[source_id][title] = {
                    "first_time": first_time,
                    "last_time": last_time,
                    "count": count,
                    "ranks": ranks,
                    "url": item.url or "",
                    "mobileUrl": item.mobile_url or "",
                    "rank_timeline": rank_timeline,
                }

        return all_results, final_id_to_name, title_info

    except Exception as e:
        print(f"[存储] 从存储后端读取数据失败: {e}")
        return {}, {}, {}


def read_all_today_titles(
    storage_manager,
    current_platform_ids: Optional[List[str]] = None,
    quiet: bool = False,
) -> Tuple[Dict, Dict, Dict]:
    """
    读取当天所有标题（从存储后端）

    Args:
        storage_manager: 存储管理器实例
        current_platform_ids: 当前监控的平台 ID 列表（用于过滤）
        quiet: 是否静默模式（不打印日志）

    Returns:
        Tuple[Dict, Dict, Dict]: (all_results, id_to_name, title_info)
    """
    all_results, final_id_to_name, title_info = read_all_today_titles_from_storage(
        storage_manager, current_platform_ids
    )

    if not quiet:
        if all_results:
            total_count = sum(len(titles) for titles in all_results.values())
            print(f"[存储] 已从存储后端读取 {total_count} 条标题")
        else:
            print("[存储] 当天暂无数据")

    return all_results, final_id_to_name, title_info


def detect_latest_new_titles_from_storage(
    storage_manager,
    current_platform_ids: Optional[List[str]] = None,
) -> Dict:
    """
    从存储后端检测最新批次的新增标题

    Args:
        storage_manager: 存储管理器实例
        current_platform_ids: 当前监控的平台 ID 列表（用于过滤）

    Returns:
        Dict: 新增标题 {source_id: {title: title_data}}
    """
    try:
        # 获取最新抓取数据
        latest_data = storage_manager.get_latest_crawl_data()
        if not latest_data or not latest_data.items:
            return {}

        # 获取所有历史数据
        all_data = storage_manager.get_today_all_data()
        if not all_data or not all_data.items:
            # 没有历史数据（第一次抓取），不应该有"新增"标题
            return {}

        # 获取最新批次时间
        latest_time = latest_data.crawl_time

        # 步骤1：收集最新批次的标题（last_crawl_time = latest_time 的标题）
        latest_titles = {}
        for source_id, news_list in latest_data.items.items():
            if current_platform_ids is not None and source_id not in current_platform_ids:
                continue
            latest_titles[source_id] = {}
            for item in news_list:
                latest_titles[source_id][item.title] = {
                    "ranks": [item.rank],
                    "url": item.url or "",
                    "mobileUrl": item.mobile_url or "",
                }

        # 步骤2：收集历史标题
        # 关键逻辑：一个标题只要其 first_crawl_time < latest_time，就是历史标题
        # 这样即使同一标题有多条记录（URL 不同），只要任何一条是历史的，该标题就算历史
        historical_titles = {}
        for source_id, news_list in all_data.items.items():
            if current_platform_ids is not None and source_id not in current_platform_ids:
                continue

            historical_titles[source_id] = set()
            for item in news_list:
                first_time = item.first_time or item.crawl_time
                # 如果该记录的首次出现时间早于最新批次，则该标题是历史标题
                if first_time < latest_time:
                    historical_titles[source_id].add(item.title)

        # 检查是否是当天第一次抓取（没有任何历史标题）
        # 如果所有平台的历史标题集合都为空，说明只有一个抓取批次
        # 在这种情况下，将所有最新批次的标题视为"新增"（用于增量模式的第一次推送）
        has_historical_data = any(len(titles) > 0 for titles in historical_titles.values())
        if not has_historical_data:
            # 第一次爬取：返回所有最新标题作为"新增"
            return latest_titles

        # 步骤3：找出新增标题 = 最新批次标题 - 历史标题
        new_titles = {}
        for source_id, source_latest_titles in latest_titles.items():
            historical_set = historical_titles.get(source_id, set())
            source_new_titles = {}

            for title, title_data in source_latest_titles.items():
                if title not in historical_set:
                    source_new_titles[title] = title_data

            if source_new_titles:
                new_titles[source_id] = source_new_titles

        return new_titles

    except Exception as e:
        print(f"[存储] 从存储后端检测新标题失败: {e}")
        return {}


def detect_latest_new_titles(
    storage_manager,
    current_platform_ids: Optional[List[str]] = None,
    quiet: bool = False,
) -> Dict:
    """
    检测当日最新批次的新增标题（从存储后端）

    Args:
        storage_manager: 存储管理器实例
        current_platform_ids: 当前监控的平台 ID 列表（用于过滤）
        quiet: 是否静默模式（不打印日志）

    Returns:
        Dict: 新增标题 {source_id: {title: title_data}}
    """
    new_titles = detect_latest_new_titles_from_storage(storage_manager, current_platform_ids)
    if new_titles and not quiet:
        total_new = sum(len(titles) for titles in new_titles.values())
        print(f"[存储] 从存储后端检测到 {total_new} 条新增标题")
    return new_titles

```

### Core Architecture Module: `trendradar/core/frequency.py`
```
# coding=utf-8
"""
频率词配置加载模块

负责从配置文件加载频率词规则，支持：
- 普通词组
- 必须词（+前缀）
- 过滤词（!前缀）
- 全局过滤词（[GLOBAL_FILTER] 区域）
- 最大显示数量（@前缀）
- 正则表达式（/pattern/ 语法）
- 显示名称（=> 别名 语法）
- 组别名（[组别名] 语法，作为词组第一行）
"""

import os
import re
from pathlib import Path
from typing import Dict, List, Tuple, Optional, Union


def _parse_word(word: str) -> Dict:
    """
    解析单个词，识别是否为正则表达式，支持显示名称

    Args:
        word: 原始配置行 (e.g. "/京东|刘强东/ => 京东")

    Returns:
        Dict: 包含 word, is_regex, pattern, display_name
    """
    display_name = None

    # 1. 优先处理显示名称 (=>)
    # 先切分出 "配置内容" 和 "显示名称"
    if '=>' in word:
        parts = re.split(r'\s*=>\s*', word, 1)
        word_config = parts[0].strip()
        # 只有当 => 右边有内容时才作为 display_name
        if len(parts) > 1 and parts[1].strip():
            display_name = parts[1].strip()
    else:
        word_config = word.strip()

    # 2. 解析正则表达式
    # 规则：以 / 开头，以 / 结尾(可能跟 flags)，中间内容贪婪提取
    # [a-z]*$ 表示允许末尾有 flags (如 i, g)，但在下面代码中会被忽略
    regex_match = re.match(r'^/(.+)/[a-z]*$', word_config)

    if regex_match:
        pattern_str = regex_match.group(1)
        try:
            pattern = re.compile(pattern_str, re.IGNORECASE)
            
            return {
                "word": pattern_str,
                "is_regex": True,
                "pattern": pattern,
                "display_name": display_name,
            }
        except re.error as e:
            print(f"Warning: Invalid regex pattern '/{pattern_str}/': {e}")
            pass

    return {
        "word": word_config, 
        "is_regex": False, 
        "pattern": None, 
        "display_name": display_name
    }


def _word_matches(word_config: Union[str, Dict], title_lower: str) -> bool:
    """
    检查词是否在标题中匹配

    Args:
        word_config: 词配置（字符串或字典）
        title_lower: 小写的标题

    Returns:
        是否匹配
    """
    if isinstance(word_config, str):
        # 向后兼容：纯字符串
        return word_config.lower() in title_lower

    if word_config.get("is_regex") and word_config.get("pattern"):
        # 正则匹配
        return bool(word_config["pattern"].search(title_lower))
    else:
        # 子字符串匹配
        return word_config["word"].lower() in title_lower


def load_frequency_words(
    frequency_file: Optional[str] = None,
) -> Tuple[List[Dict], List[str], List[str]]:
    """
    加载频率词配置

    配置文件格式说明：
    - 每个词组由空行分隔
    - [GLOBAL_FILTER] 区域定义全局过滤词
    - [WORD_GROUPS] 区域定义词组（默认）

    词组语法：
    - 普通词：直接写入，任意匹配即可
    - +词：必须词，所有必须词都要匹配
    - !词：过滤词，匹配则排除
    - @数字：该词组最多显示的条数

    Args:
        frequency_file: 频率词配置文件路径，默认从环境变量 FREQUENCY_WORDS_PATH 获取或使用 config/frequency_words.txt，短文件名从 config/custom/keyword/ 查找

    Returns:
        (词组列表, 词组内过滤词, 全局过滤词)

    Raises:
        FileNotFoundError: 频率词文件不存在
    """
    if frequency_file is None:
        frequency_file = os.environ.get(
            "FREQUENCY_WORDS_PATH", "config/frequency_words.txt"
        )

    frequency_path = Path(frequency_file)
    if not frequency_path.exists():
        # 尝试作为短文件名，拼接 config/custom/keyword/ 前缀
        custom_path = Path("config/custom/keyword") / frequency_file
        if custom_path.exists():
            frequency_path = custom_path
        else:
            raise FileNotFoundError(f"频率词文件 {frequency_file} 不存在")

    with open(frequency_path, "r", encoding="utf-8") as f:
        content = f.read()

    word_groups = [group.strip() for group in content.split("\n\n") if group.strip()]

    processed_groups = []
    filter_words = []
    global_filters = []

    # 默认区域（向后兼容）
    current_section = "WORD_GROUPS"

    for group in word_groups:
        # 过滤空行和注释行（# 开头）
        lines = [line.strip() for line in group.split("\n") if line.strip() and not line.strip().startswith("#")]

        if not lines:
            continue

        # 检查是否为区域标记
        if lines[0].startswith("[") and lines[0].endswith("]"):
            section_name = lines[0][1:-1].upper()
            if section_name in ("GLOBAL_FILTER", "WORD_GROUPS"):
                current_section = section_name
                lines = lines[1:]  # 移除标记行

        # 处理全局过滤区域
        if current_section == "GLOBAL_FILTER":
            # 直接添加所有非空行到全局过滤列表
            for line in lines:
                # 忽略特殊语法前缀，只提取纯文本
                if line.startswith(("!", "+", "@")):
                    continue  # 全局过滤区不支持特殊语法
                if line:
                    global_filters.append(line)
            continue

        # 处理词组区域
        words = lines
        group_alias = None  # 组别名（[别名] 语法）

        # 检查第一行是否为组别名（非区域标记）
        if words and words[0].startswith("[") and words[0].endswith("]"):
            potential_alias = words[0][1:-1].strip()
            # 排除区域标记（GLOBAL_FILTER, WORD_GROUPS）
            if potential_alias.upper() not in ("GLOBAL_FILTER", "WORD_GROUPS"):
                group_alias = potential_alias
                words = words[1:]  # 移除组别名行

        group_required_words = []
        group_normal_words = []
        group_max_count = 0  # 默认不限制

        for word in words:
            if word.startswith("@"):
                # 解析最大显示数量（只接受正整数）
                try:
                    count = int(word[1:])
                    if count > 0:
                        group_max_count = count
                except (ValueError, IndexError):
                    pass  # 忽略无效的@数字格式
            elif word.startswith("!"):
                # 过滤词（支持正则语法）
                filter_word = word[1:]
                parsed = _parse_word(filter_word)
                filter_words.append(parsed)
            elif word.startswith("+"):
                # 必须词（支持正则语法）
                req_word = word[1:]
                group_required_words.append(_parse_word(req_word))
            else:
                # 普通词（支持正则语法）
                group_normal_words.append(_parse_word(word))

        if group_required_words or group_normal_words:
            if group_normal_words:
                group_key = " ".join(w["word"] for w in group_normal_words)
            else:
                group_key = " ".join(w["word"] for w in group_required_words)

            # 生成显示名称
            # 优先级：组别名 > 行别名拼接 > 关键词拼接
            if group_alias:
                # 有组别名，直接使用
                display_name = group_alias
            else:
                # 没有组别名，拼接每行的显示名（行别名或关键词本身）
                all_words = group_normal_words + group_required_words
                display_parts = []
                for w in all_words:
                    # 优先使用行别名，否则使用关键词本身
                    part = w.get("display_name") or w["word"]
                    display_parts.append(part)
                # 用 " / " 拼接多个词
                display_name = " / ".join(display_parts) if display_parts else None

            processed_groups.append(
                {
                    "required": group_required_words,
                    "normal": group_normal_words,
                    "group_key": group_key,
                    "display_name": display_name,  # 可能为 None
                    "max_count": group_max_count,
                }
            )

    return processed_groups, filter_words, global_filters


def matches_word_groups(
    title: str,
    word_groups: List[Dict],
    filter_words: List,
    global_filters: Optional[List[str]] = None
) -> bool:
    """
    检查标题是否匹配词组规则

    Args:
        title: 标题文本
        word_groups: 词组列表
        filter_words: 过滤词列表（可以是字符串列表或字典列表）
        global_filters: 全局过滤词列表

    Returns:
        是否匹配
    """
    # 防御性类型检查：确保 title 是有效字符串
    if not isinstance(title, str):
        title = str(title) if title is not None else ""
    if not title.strip():
        return False

    title_lower = title.lower()

    # 全局过滤检查（优先级最高）
    if global_filters:
        if any(global_word.lower() in title_lower for global_word in global_filters):
            return False

    # 如果没有配置词组，则匹配所有标题（支持显示全部新闻）
    if not word_groups:
        return True

    # 过滤词检查（兼容新旧格式）
    for filter_item in filter_words:
        if _word_matches(filter_item, title_lower):
            return False

    # 词组匹配检查
    for group in word_groups:
        required_words = group["required"]
        normal_words = group["normal"]

        # 必须词检查
        if required_words:
            all_required_present = all(
                _word_matches(req_item, title_lower) for req_item in required_words
            )
            if not all_required_present:
                continue

        # 普通词检查
        if normal_words:
            any_normal_present = any(
                _word_matches(normal_item, title_lower) for normal_item in normal_words
            )
            if not any_normal_present:
                continue

        return True

    return False

```

### Core Architecture Module: `trendradar/core/loader.py`
```
# coding=utf-8
"""
配置加载模块

负责从 YAML 配置文件和环境变量加载配置。
"""

import os
from pathlib import Path
from typing import Dict, Any, Optional

import yaml

from .config import parse_multi_account_config, validate_paired_configs
from trendradar.utils.time import DEFAULT_TIMEZONE


def _get_env_bool(key: str) -> Optional[bool]:
    """从环境变量获取布尔值，如果未设置返回 None"""
    value = os.environ.get(key, "").strip().lower()
    if not value:
        return None
    return value in ("true", "1")


def _get_env_int_or_none(key: str) -> Optional[int]:
    """从环境变量获取整数值，未设置时返回 None"""
    value = os.environ.get(key, "").strip()
    if not value:
        return None
    try:
        return int(value)
    except ValueError:
        return None


def _get_env_str(key: str, default: str = "") -> str:
    """从环境变量获取字符串值"""
    return os.environ.get(key, "").strip() or default


def _load_app_config(config_data: Dict) -> Dict:
    """加载应用配置"""
    app_config = config_data.get("app", {})
    advanced = config_data.get("advanced", {})
    return {
        "VERSION_CHECK_URL": advanced.get("version_check_url", ""),
        "CONFIGS_VERSION_CHECK_URL": advanced.get("configs_version_check_url", ""),
        "SHOW_VERSION_UPDATE": app_config.get("show_version_update", True),
        "TIMEZONE": _get_env_str("TIMEZONE") or app_config.get("timezone", DEFAULT_TIMEZONE),
        "DEBUG": _get_env_bool("DEBUG") if _get_env_bool("DEBUG") is not None else advanced.get("debug", False),
    }


def _load_crawler_config(config_data: Dict) -> Dict:
    """加载爬虫配置"""
    advanced = config_data.get("advanced", {})
    crawler_config = advanced.get("crawler", {})
    platforms_config = config_data.get("platforms", {})
    return {
        "REQUEST_INTERVAL": crawler_config.get("request_interval", 100),
        "USE_PROXY": crawler_config.get("use_proxy", False),
        "DEFAULT_PROXY": crawler_config.get("default_proxy", ""),
        "ENABLE_CRAWLER": platforms_config.get("enabled", True),
        "PLATFORMS_API_URL": _get_env_str("PLATFORMS_API_URL") or platforms_config.get("api_url", ""),
    }


def _load_report_config(config_data: Dict) -> Dict:
    """加载报告配置"""
    report_config = config_data.get("report", {})

    # 环境变量覆盖
    sort_by_position_env = _get_env_bool("SORT_BY_POSITION_FIRST")
    max_news_env = _get_env_int_or_none("MAX_NEWS_PER_KEYWORD")

    return {
        "REPORT_MODE": report_config.get("mode", "daily"),
        "DISPLAY_MODE": report_config.get("display_mode", "keyword"),
        "RANK_THRESHOLD": report_config.get("rank_threshold", 10),
        "SORT_BY_POSITION_FIRST": sort_by_position_env if sort_by_position_env is not None else report_config.get("sort_by_position_first", False),
        "MAX_NEWS_PER_KEYWORD": max_news_env if max_news_env is not None else report_config.get("max_news_per_keyword", 0),
    }


def _load_notification_config(config_data: Dict) -> Dict:
    """加载通知配置"""
    notification = config_data.get("notification", {})
    advanced = config_data.get("advanced", {})
    batch_size = advanced.get("batch_size", {})

    max_accounts_env = _get_env_int_or_none("MAX_ACCOUNTS_PER_CHANNEL")

    return {
        "ENABLE_NOTIFICATION": notification.get("enabled", True),
        "MESSAGE_BATCH_SIZE": batch_size.get("default", 4000),
        "DINGTALK_BATCH_SIZE": batch_size.get("dingtalk", 20000),
        "FEISHU_BATCH_SIZE": batch_size.get("feishu", 29000),
        "BARK_BATCH_SIZE": batch_size.get("bark", 3600),
        "SLACK_BATCH_SIZE": batch_size.get("slack", 4000),
        "BATCH_SEND_INTERVAL": advanced.get("batch_send_interval", 1.0),
        "FEISHU_MESSAGE_SEPARATOR": advanced.get("feishu_message_separator", "---"),
        "MAX_ACCOUNTS_PER_CHANNEL": max_accounts_env if max_accounts_env is not None else advanced.get("max_accounts_per_channel", 3),
    }


def _load_schedule_config(config_data: Dict) -> Dict:
    """
    加载统一调度配置

    从 config.yaml 的 schedule 段读取，支持环境变量覆盖。
    """
    schedule = config_data.get("schedule", {})

    # 环境变量覆盖
    enabled_env = _get_env_bool("SCHEDULE_ENABLED")
    preset_env = _get_env_str("SCHEDULE_PRESET")

    enabled = enabled_env if enabled_env is not None else schedule.get("enabled", False)
    preset = preset_env or schedule.get("preset", "always_on")

    return {
        "enabled": enabled,
        "preset": preset,
    }


def _load_timeline_data(config_dir: str = "config") -> Dict:
    """
    加载 timeline.yaml

    Args:
        config_dir: 配置目录路径

    Returns:
        timeline.yaml 的完整数据，找不到时返回空模板
    """
    timeline_path = Path(config_dir) / "timeline.yaml"
    if not timeline_path.exists():
        print(f"[调度] timeline.yaml 未找到: {timeline_path}，使用空模板")
        return {
            "presets": {},
            "custom": {
                "default": {
                    "collect": True,
                    "analyze": False,
                    "push": False,
                    "report_mode": "current",
                    "ai_mode": "follow_report",
                    "once": {"analyze": False, "push": False},
                },
                "periods": {},
                "day_plans": {"all_day": {"periods": []}},
                "week_map": {i: "all_day" for i in range(1, 8)},
            },
        }

    with open(timeline_path, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)

    print(f"[调度] timeline.yaml 加载成功: {timeline_path}")
    return data or {}


def _load_weight_config(config_data: Dict) -> Dict:
    """加载权重配置"""
    advanced = config_data.get("advanced", {})
    weight = advanced.get("weight", {})
    return {
        "RANK_WEIGHT": weight.get("rank", 0.6),
        "FREQUENCY_WEIGHT": weight.get("frequency", 0.3),
        "HOTNESS_WEIGHT": weight.get("hotness", 0.1),
    }


def _load_rss_config(config_data: Dict) -> Dict:
    """加载 RSS 配置"""
    rss = config_data.get("rss", {})
    advanced = config_data.get("advanced", {})
    advanced_rss = advanced.get("rss", {})
    advanced_crawler = advanced.get("crawler", {})

    # RSS 代理配置：优先使用 RSS 专属代理，否则复用 crawler 的 default_proxy
    rss_proxy_url = advanced_rss.get("proxy_url", "") or advanced_crawler.get("default_proxy", "")

    # 新鲜度过滤配置
    freshness_filter = rss.get("freshness_filter", {})

    # 验证并设置 max_age_days 默认值
    raw_max_age = freshness_filter.get("max_age_days", 3)
    try:
        max_age_days = int(raw_max_age)
        if max_age_days < 0:
            print(f"[警告] RSS freshness_filter.max_age_days 为负数 ({max_age_days})，使用默认值 3")
            max_age_days = 3
    except (ValueError, TypeError):
        print(f"[警告] RSS freshness_filter.max_age_days 格式错误 ({raw_max_age})，使用默认值 3")
        max_age_days = 3

    # RSS 配置直接从 config.yaml 读取，不再支持环境变量
    return {
        "ENABLED": rss.get("enabled", False),
        "REQUEST_INTERVAL": advanced_rss.get("request_interval", 2000),
        "TIMEOUT": advanced_rss.get("timeout", 15),
        "USE_PROXY": advanced_rss.get("use_proxy", False),
        "PROXY_URL": rss_proxy_url,
        "FEEDS": rss.get("feeds", []),
        "FRESHNESS_FILTER": {
            "ENABLED": freshness_filter.get("enabled", True),  # 默认启用
            "MAX_AGE_DAYS": max_age_days,
        },
    }


def _load_display_config(config_data: Dict) -> Dict:
    """加载推送内容显示配置"""
    display = config_data.get("display", {})
    regions = display.get("regions", {})
    standalone = display.get("standalone", {})

    # 默认区域顺序
    default_region_order = ["hotlist", "rss", "new_items", "standalone", "ai_analysis"]
    region_order = display.get("region_order", default_region_order)

    # 验证 region_order 中的值是否合法
    valid_regions = {"hotlist", "rss", "new_items", "standalone", "ai_analysis"}
    region_order = [r for r in region_order if r in valid_regions]

    # 如果过滤后为空，使用默认顺序
    if not region_order:
        region_order = default_region_order

    return {
        # 区域显示顺序
        "REGION_ORDER": region_order,
        # 区域开关
        "REGIONS": {
            "HOTLIST": regions.get("hotlist", True),
            "NEW_ITEMS": regions.get("new_items", True),
            "RSS": regions.get("rss", True),
            "STANDALONE": regions.get("standalone", False),
            "AI_ANALYSIS": regions.get("ai_analysis", True),
        },
        # 独立展示区配置
        "STANDALONE": {
            "PLATFORMS": standalone.get("platforms", []),
            "RSS_FEEDS": standalone.get("rss_feeds", []),
            "MAX_ITEMS": standalone.get("max_items", 20),
        },
    }


def _load_ai_config(config_data: Dict) -> Dict:
    """加载 AI 模型配置（LiteLLM 格式）"""
    ai_config = config_data.get("ai", {})

    timeout_env = _get_env_int_or_none("AI_TIMEOUT")

    return {
        # LiteLLM 核心配置
        "MODEL": _get_env_str("AI_MODEL") or ai_config.get("model", ""),
        "API_KEY": _get_env_str("AI_API_KEY") or ai_config.get("api_key", ""),
        "API_BASE": _get_env_str("AI_API_BASE") or ai_config.get("api_base", ""),

        # 生成参数
        "TIMEOUT": timeout_env if timeout_env is not None else ai_config.get("timeout", 120),
        "TEMPERATURE": ai_config.get("temperature", 1.0),
        "MAX_TOKENS": ai_config.get("max_tokens", 5000),

        # LiteLLM 高级选项
        "NUM_RETRIES": ai_config.get("num_retries", 2),
        "FALLBACK_MODELS": ai_config.get("fallback_models", []),
        "EXTRA_PARAMS": ai_config.get("extra_params", {}),
    }


def _load_ai_analysis_config(config_data: Dict) -> Dict:
    """加载 AI 分析配置（功能配置，模型配置见 _load_ai_config）"""
    ai_config = config_data.get("ai_analysis", {})

    enabled_env = _get_env_bool("AI_ANALYSIS_ENABLED")

    return {
        "ENABLED": enabled_env if enabled_env is not None else ai_config.get("enabled", False),
        "LANGUAGE": ai_config.get("language", "Chinese"),
        "PROMPT_FILE": ai_config.get("prompt_file", "ai_analysis_prompt.txt"),
        "MODE": ai_config.get("mode", "follow_report"),
        "MAX_NEWS_FOR_ANALYSIS": ai_config.get("max_news_for_analysis", 50),
        "INCLUDE_RSS": ai_config.get("include_rss", True),
        "I
```

### Core Architecture Module: `trendradar/core/scheduler.py`
```
# coding=utf-8
"""
时间线调度器

统一的时间线调度系统，替代分散的 push_window / analysis_window 逻辑。
基于 periods + day_plans + week_map 模型实现灵活的时间段调度。
"""

import copy
import re
from dataclasses import dataclass
from typing import Any, Callable, Dict, List, Optional

from datetime import datetime


@dataclass
class ResolvedSchedule:
    """当前时间解析后的调度结果"""
    period_key: Optional[str]       # 命中的 period key，None=默认配置
    period_name: Optional[str]      # 命中的展示名称
    day_plan: str                   # 当前日计划
    collect: bool
    analyze: bool
    push: bool
    report_mode: str
    ai_mode: str
    once_analyze: bool
    once_push: bool
    frequency_file: Optional[str] = None  # 频率词文件路径，None=使用默认
    filter_method: Optional[str] = None   # 筛选策略: "keyword"|"ai"，None=使用全局配置
    interests_file: Optional[str] = None  # AI 筛选兴趣文件，None=使用默认


class Scheduler:
    """
    时间线调度器

    根据 timeline 配置（periods + day_plans + week_map）解析当前时间应执行的行为。
    支持：
    - 预设模板 + 自定义模式
    - 跨日时间段（如 22:00-07:00）
    - 每天 / 每周差异化配置
    - once 执行去重（analyze / push 独立维度）
    - 冲突策略（error_on_overlap / last_wins）
    """

    def __init__(
        self,
        schedule_config: Dict[str, Any],
        timeline_data: Dict[str, Any],
        storage_backend: Any,
        get_time_func: Callable[[], datetime],
        fallback_report_mode: str = "current",
    ):
        """
        初始化调度器

        Args:
            schedule_config: config.yaml 中的 schedule 段（含 preset 等）
            timeline_data: timeline.yaml 的完整数据
            storage_backend: 存储后端（用于 once 去重记录）
            get_time_func: 获取当前时间的函数（应使用配置的时区）
            fallback_report_mode: 调度未启用时回退使用的 report_mode（来自 config.yaml 的 report.mode）
        """
        self.schedule_config = schedule_config
        self.storage = storage_backend
        self.get_time = get_time_func
        self.enabled = schedule_config.get("enabled", True)
        self.fallback_report_mode = fallback_report_mode

        # 加载并构建最终 timeline
        self.timeline = self._build_timeline(schedule_config, timeline_data)
        if self.enabled:
            self._validate_timeline(self.timeline)

    def _build_timeline(
        self,
        schedule_config: Dict[str, Any],
        timeline_data: Dict[str, Any],
    ) -> Dict[str, Any]:
        """从 preset 或 custom 构建 timeline"""
        preset = schedule_config.get("preset", "always_on")

        if preset == "custom":
            timeline = copy.deepcopy(timeline_data.get("custom", {}))
        else:
            presets = timeline_data.get("presets", {})
            if preset not in presets:
                raise ValueError(
                    f"未知的预设模板: '{preset}'，可选值: "
                    f"{', '.join(presets.keys())}, custom"
                )
            timeline = copy.deepcopy(presets[preset])

        # 确保 periods 是 dict（可能为空 {}）
        if timeline.get("periods") is None:
            timeline["periods"] = {}

        return timeline

    def resolve(self) -> ResolvedSchedule:
        """
        解析当前时间对应的调度配置

        Returns:
            ResolvedSchedule 包含当前应执行的行为
        """
        if not self.enabled:
            # 调度未启用时返回默认的全功能配置，report_mode 回退使用 config.yaml 的 report.mode
            return ResolvedSchedule(
                period_key=None,
                period_name=None,
                day_plan="disabled",
                collect=True,
                analyze=True,
                push=True,
                report_mode=self.fallback_report_mode,
                ai_mode="follow_report",
                once_analyze=False,
                once_push=False,
            )

        now = self.get_time()
        weekday = now.isoweekday()  # 1=周一 ... 7=周日
        now_hhmm = now.strftime("%H:%M")

        # 查找当天的日计划
        day_plan_key = self.timeline["week_map"].get(weekday)
        if day_plan_key is None:
            raise ValueError(f"week_map 缺少星期映射: {weekday}")

        day_plan = self.timeline["day_plans"].get(day_plan_key)
        if day_plan is None:
            raise ValueError(f"week_map[{weekday}] 引用了不存在的 day_plan: {day_plan_key}")

        # 查找当前活跃的时间段
        period_key = self._find_active_period(now_hhmm, day_plan)

        # 合并默认配置和时间段配置
        merged = self._merge_with_default(period_key)

        # 打印调度日志
        weekday_names = {1: "一", 2: "二", 3: "三", 4: "四", 5: "五", 6: "六", 7: "日"}
        period_display = "默认配置（未命中任何时间段）"
        if period_key:
            period_cfg = self.timeline["periods"][period_key]
            period_name = period_cfg.get("name", period_key)
            start = period_cfg.get("start", "?")
            end = period_cfg.get("end", "?")
            period_display = f"{period_name} ({start}-{end})"

        print(f"[调度] 星期{weekday_names.get(weekday, '?')}，日计划: {day_plan_key}")
        print(f"[调度] 当前时间段: {period_display}")

        resolved = ResolvedSchedule(
            period_key=period_key,
            period_name=(
                self.timeline["periods"][period_key].get("name")
                if period_key
                else None
            ),
            day_plan=day_plan_key,
            collect=merged.get("collect", True),
            analyze=merged.get("analyze", False),
            push=merged.get("push", False),
            report_mode=merged.get("report_mode", "current"),
            ai_mode=self._resolve_ai_mode(merged),
            once_analyze=merged.get("once", {}).get("analyze", False),
            once_push=merged.get("once", {}).get("push", False),
            frequency_file=merged.get("frequency_file"),
            filter_method=merged.get("filter_method"),
            interests_file=merged.get("interests_file"),
        )

        # 打印行为摘要
        actions = []
        if resolved.collect:
            actions.append("采集")
        if resolved.analyze:
            actions.append(f"分析(AI:{resolved.ai_mode})")
        if resolved.push:
            actions.append(f"推送(模式:{resolved.report_mode})")
        print(f"[调度] 行为: {', '.join(actions) if actions else '无'}")
        if resolved.frequency_file:
            print(f"[调度] 频率词文件: {resolved.frequency_file}")

        return resolved

    def _find_active_period(
        self, now_hhmm: str, day_plan: Dict[str, Any]
    ) -> Optional[str]:
        """
        查找当前时间命中的活跃时间段

        Args:
            now_hhmm: 当前时间 HH:MM
            day_plan: 日计划配置

        Returns:
            命中的 period key，或 None
        """
        candidates = []
        for idx, key in enumerate(day_plan.get("periods", [])):
            period = self.timeline["periods"].get(key)
            if period is None:
                continue
            if self._in_range(now_hhmm, period["start"], period["end"]):
                candidates.append((idx, key))

        if not candidates:
            return None

        # 检查冲突
        if len(candidates) > 1:
            policy = self.timeline.get("overlap", {}).get("policy", "error_on_overlap")
            conflicting = [c[1] for c in candidates]

            if policy == "error_on_overlap":
                raise ValueError(
                    f"检测到时间段重叠冲突: {', '.join(conflicting)} 在 {now_hhmm} 重叠。"
                    f"请调整时间段配置，或将 overlap.policy 设为 'last_wins'"
                )

            # last_wins：输出重叠警告，列表中后面的优先
            print(
                f"[调度] 检测到时间段重叠: {', '.join(conflicting)} 在 {now_hhmm} 重叠"
            )
            winner = candidates[-1]
            print(f"[调度] 冲突策略: last_wins，生效时间段: {winner[1]}")
            return winner[1]

        return candidates[0][1]

    @staticmethod
    def _in_range(now_hhmm: str, start: str, end: str) -> bool:
        """
        检查时间是否在范围内（支持跨日）

        Args:
            now_hhmm: 当前时间 HH:MM
            start: 开始时间 HH:MM
            end: 结束时间 HH:MM

        Returns:
            是否在范围内
        """
        if start <= end:
            # 正常范围，如 08:00-09:00（半开区间 [start, end)）
            return start <= now_hhmm < end
        else:
            # 跨日范围，如 22:00-07:00（半开区间 [start, end)）
            return now_hhmm >= start or now_hhmm < end

    def _merge_with_default(self, period_key: Optional[str]) -> Dict[str, Any]:
        """合并默认配置和时间段配置"""
        base = copy.deepcopy(self.timeline.get("default", {}))
        if not period_key:
            return base

        period = copy.deepcopy(self.timeline["periods"][period_key])

        # 先合并 once 子对象
        merged_once = dict(base.get("once", {}))
        merged_once.update(period.get("once", {}))

        # 标量字段覆盖
        base.update(period)

        # 恢复合并后的 once
        if merged_once:
            base["once"] = merged_once

        return base

    @staticmethod
    def _resolve_ai_mode(cfg: Dict[str, Any]) -> str:
        """解析最终的 AI 模式"""
        ai_mode = cfg.get("ai_mode", "follow_report")
        if ai_mode == "follow_report":
            return cfg.get("report_mode", "current")
        return ai_mode

    def already_executed(self, period_key: str, action: str, date_str: str) -> bool:
        """
        检查指定时间段的某个 action 今天是否已执行

        Args:
            period_key: 时间段 key
            action: 动作类型 (analyze / push)
            date_str: 日期 YYYY-MM-DD

        Returns:
            是否已执行
        """
        return self.storage.has_period_executed(date_str, period_key, action)

    def record_execution(self, period_key: str, action: str, date_str: str) -> None:
        """
        记录时间段的 action 执行

        Args:
            period_key: 时间段 key
            action: 动作类型 (analyze / push)
            date_str: 日期 YYYY-MM-DD
        """
        self.storage.record_period_execution(date_str, period_key, action)

    # ========================================
    # 校验
    # ========================================

    def _validate_timeline(self, timeline: Dict[str, Any]) -> None:
        """
        启动时校验 timeline 配置

        Raises:
            ValueError: 配置不合法时抛出
        """
        required_top_keys = ["default", "periods", "day_plans", "week_map"]
        for key in required_top_keys:
            if key not in timeline:
                raise 
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1197** (2026-09-03): **VULNERABILITY REPORT**
  *Symptoms*: ### 📦 TrendRadar 版本  I'd like to report a vulnerability. Can you open PVR - private vulnerability report ? thanks  ### 🔌 MCP Server 版本 (可选)  I'd like to report a vulnerability. Can you open PVR - private vulnerability report ? thanks  ### 🏷️ 问题类别  AI 分析相关（报错、内容异常、提示词失效等）  ### 🤖 AI 模型名称（AI 问题必填）  _No response_  ### 📝 描述发生了什么  I'd like to report a vulnerability. Can you open PVR - private vulnerability report ? thanks  ### 📋 错误日志/配置（可选）  I'd like to report a vulnerability. Can you open PVR - private vulnerability report ? thanks  ### 📷 截图（强烈建议）  I'd like to report a vulnerability. Can you open PVR - private vulnerability report ? thanks  ### 🖥️ 使用环境  Docker (本地/NAS)

- **Issue #1185** (2026-07-21): **Enable private vulnerability reporting**
  *Symptoms*: ### 📦 TrendRadar 版本  vulnerability report  ### 🔌 MCP Server 版本 (可选)  _No response_  ### 🏷️ 问题类别  AI 分析相关（报错、内容异常、提示词失效等）  ### 🤖 AI 模型名称（AI 问题必填）  _No response_  ### 📝 描述发生了什么  vulnerability report  ### 📋 错误日志/配置（可选）  _No response_  ### 📷 截图（强烈建议）  Hi,  I have a security finding to share privately. Could you enable private vulnerability reporting on this repo? @bing-h  @wtychn  @sansan0  Thanks  ### 🖥️ 使用环境  Docker (本地/NAS)
  **Post-Mortem & Fix Analysis**:
  > Hey, I want to report a vulnerability. Can you please open PVR on this repository, to let me report? @sansan0 
  > hey @sansan0 @bing-h @wtychn @actions-user, reminding on this request. This is critical vuln I'd like to report via private github advisory

- **Issue #1179** (2026-06-26): **[问题] 可视化配置编辑器 难道不需要加个访问控制吗？**
  *Symptoms*: ### 📦 TrendRadar 版本  v6.9  ### 🔌 MCP Server 版本 (可选)  _No response_  ### 🏷️ 问题类别  其他  ### 🤖 AI 模型名称（AI 问题必填）  _No response_  ### 📝 描述发生了什么  可视化配置编辑器，随便什么人都可任意修改配置？只要有网址？ 这不对吧？   ### 📋 错误日志/配置（可选）  _No response_  ### 📷 截图（强烈建议）  _No response_  ### 🖥️ 使用环境  GitHub Actions
  **Post-Mortem & Fix Analysis**:
  > ok 我明白了 这个只是辅助，需要自己修改代码

- **Issue #1178** (2026-06-26): **[问题] docker 无法运行 latest (6.10) - 6.5 的版本，提示 ModuleNotFoundError: pytz**
  *Symptoms*: ### 📦 TrendRadar 版本  6.10、6.9.1、6.6、6.5.5  ### 🔌 MCP Server 版本 (可选)  N/A  ### 🏷️ 问题类别  部署运行相关（Docker、Actions、Python 报错）  ### 🤖 AI 模型名称（AI 问题必填）  N/A  ### 📝 描述发生了什么  从 6.0.0 更新到 latest (6.10) 之后无法启动。 倒退多个版本均提示错误，直到倒回原来的 6.0.0。 6.6 - latest (6.10) 的日志结尾都是 `ModuleNotFoundError: No module named 'pytz'`  _检索先前 issue 的时候发现了作者在 #1036 下的评论，单独尝试了 6.6，仍然失败。_  ### 📋 错误日志/配置（可选）  ``` 📅 生成的crontab内容: 0 8,10,12,14,16,18,20,22 * * * cd /app && python -m trendradar time="2026-06-25T16:34:03+08:00" level=warning msg="process reaping disabled, not pid 1" time="2026-06-25T16:34:03+08:00" level=info msg="read crontab: /tmp/crontab" time="2026-06-25T16:34:03+08:00" level=info msg="crontab is valid" ▶️ 立即执行一次 Traceback (most recent call last):   File "<frozen runpy>", line 189, in _run_module_as_main   File "<frozen runpy>", line 148, in _get_module_details   File "<frozen runpy>", line 112, in _get_module_details   File "/app/trendradar/__init__.py", line 10, in <module>     from trendradar.context import AppContext   File "/app/trendradar/context.py", line 12, in <module>     from trendradar.utils.time import (   File "/app/trendradar/utils/__init__.py", line 6, in <module>     from trendradar.utils.time import (   File "/app/trendradar/utils/time.py", line 11, in <module>     import pytz ModuleNotFoundError: No module named 'pytz' ```  ### 📷 截图（强烈建议）  _No response_  ### 🖥️ 使用环境  Docker (本地/NAS)
  **Post-Mortem & Fix Analysis**:
  > 请问你使用的是 Docker Hub 上的官方镜像（wantcat/trendradar:latest），还是自己 clone 代码本地 build 的？ 这类启动直接报错的问题如果存在于官方镜像中，以项目当前的用户量来看应该会有不少人反馈，但目前只收到你一个。建议你先排查一下本地环境。
  > > 请问你使用的是 Docker Hub 上的官方镜像（wantcat/trendradar:latest），还是自己 clone 代码本地 build 的？ 这类启动直接报错的问题如果存在于官方镜像中，以项目当前的用户量来看应该会有不少人反馈，但目前只收到你一个。建议你先排查一下本地环境。  全部都是从 DockerHub 获取的官方镜像 wantcat/trendradar:latest  我在 Docker 上部署的好几个开源项目都是正常运行的，除了这个。 请问我如何排查本地环境？我只会换版本重新部署……
  > 好的，确认是官方镜像的话我们来定位一下。你在部署的机器上执行以下命令，把输出贴回来  # 系统架构 uname -m  # Docker 版本 docker version --format '{{.Server.Version}}'  # 拉到的镜像架构 docker image inspect wantcat/trendradar:latest --format '{{.Architecture}}'  # 测试容器内 pytz 是否存在 docker run --rm --entrypoint python wantcat/trendradar:latest -c "import pytz; print(pytz.__version__)"  复制粘贴执行就好，不需要额外操作。这几条命令能帮我判断你拉到的镜像是否完整。  另外，你的设备是 NAS（群晖/威联通）还是普通 PC/服务器？

- **Issue #1175** (2026-06-23): **[问题] fallback_models 配置的疑问**
  *Symptoms*: ### 📦 TrendRadar 版本  6.10.0  ### 🔌 MCP Server 版本 (可选)  _No response_  ### 🏷️ 问题类别  AI 分析相关（报错、内容异常、提示词失效等）  ### 🤖 AI 模型名称（AI 问题必填）  _No response_  ### 📝 描述发生了什么  例如我有两个模型，一个vllm本地部署的，一个DeepSeek api，我想配置默认使用本地的，失败后回落到DeepSeek api，要如何配置 试了几种fallback_models参数的设置启动都会报错  ### 📋 错误日志/配置（可选）  按litellm文档的配置 ``` yaml  ai:   model_list:   - model_name: local-vllm     litellm_params:       model: "hosted_vllm/Qwen3.6-27b"       api_base: "xxx"       api_key: "xxx"    - model_name: deepseek-fallback     litellm_params:       model: "deepseek/deepseek-v4-flash"       api_key: "xxx"       api_base: "xxx"    timeout: 1200        temperature: 1.0                max_tokens: 0            # 高级选项   num_retries: 3       fallback_models: [{"local-vllm": ["deepseek-fallback"]}] ```  启动会报错  14:47:14 - LiteLLM:ERROR: fallback_utils.py:68 - Fallback attempt failed for model : litellm.BadRequestError: LLM Provider NOT provided. Pass in the LLM provider you are trying to call. You passed model=  Pass model as E.g. For 'Huggingface' inference endpoints pass in `completion(model='huggingface/starcoder',..)` Learn more: https://docs.litellm.ai/docs/providers LiteLLM Retried: 3 times Traceback (most recent call last):   File "/app/.venv/lib/python3.12/site-packages/litellm/litellm_core_utils/asyncify.py", line 107, in run_async_function     _ = asyncio.get_running_loop()         ^^^^^^^^^^^^^^^^^^^^^^^^^^ RuntimeError: no running event loop  During handling of the above exception, another exception occ
  **Post-Mortem & Fix Analysis**:
  > litellm 的功能我并没有完全去适配

- **Issue #1167** (2026-06-08): **Bug: 独立展示区（standalone）RSS 源标题翻译被 skip_rss 错误跳过**
  *Symptoms*: ### 📦 TrendRadar 版本  v6.9.0  ### 🔌 MCP Server 版本 (可选)  _No response_  ### 🏷️ 问题类别  AI 分析相关（报错、内容异常、提示词失效等）  ### 🤖 AI 模型名称（AI 问题必填）  openai/moonshotai/kimi-k2.6  ### 📝 描述发生了什么  ## 问题描述    配置了独立展示区（standalone）的 RSS 源（如 Bloomberg、Reuters、Seeking Alpha）后，这些源的标题在 HTML 报告和推送通知中始终为英文，不会被翻译为中文。    ## 环境信息    - TrendRadar v6.9.0   - Docker 部署   - AI 翻译已启用（`AI_TRANSLATION.ENABLED=true`）   - standalone 配置包含 RSS 源：    ```yaml   display:     standalone:       platforms: ["hackernews"]       rss_feeds: ["bloomberg-markets","reuters-business","seeking-alpha-breaking"]     regions:       standalone: true    根因分析    涉及两个 Bug：    Bug 1：报告阶段不翻译 standalone_data    __main__.py 在报告阶段的翻译调用故意排除了 standalone_data：    # __main__.py:869-871   # 注意：仅翻译 rss_items 和 rss_new_items，不翻译 standalone_data（通知前会重新生成）   _, rss_items, rss_new_items, _ = \       dispatcher.translate_content(           report_data={"stats": [], "new_titles": []},           rss_items=rss_items,           rss_new_items=rss_new_items,           display_regions=display_regions,       )    注释说"通知前会重新生成"，但实际上推送阶段的 standalone_data 是从原始数据重新准备的（_prepare_standalone_data），并未使用报告阶段的翻译结果。因此 HTML 报告中的 standalone 标题始终为原文。    Bug 2：推送阶段 skip_rss 跳过了 standalone RSS feeds    dispatcher.py 在推送阶段传入 skip_rss=True（因为普通 RSS 已在上游翻译），但 standalone RSS feeds 也被 skip_rss 条件错误跳过：    # dispatcher.py:149-154   # 6. 独立展示区 - RSS 源（跳过已翻译的）   if not skip_rss:  # ← skip_rss=True 时，standalone RSS 也被跳过！       for feed_idx, feed in enumerate(standalone_data.get("rss_f

- **Issue #1163** (2026-06-04): **[问题] 使用Action执行工作流延迟3-4个小时跟代码有关系吗**
  *Symptoms*: ### 📦 TrendRadar 版本  v6.8.1  ### 🔌 MCP Server 版本 (可选)  _No response_  ### 🏷️ 问题类别  通知推送相关（收不到消息、推送报错等）  ### 🤖 AI 模型名称（AI 问题必填）  _No response_  ### 📝 描述发生了什么  使用Github的Action执行工作流，抓取频率不高，设置的早中晚三次，结果延迟太大了。 我的设置：  <img width="1154" height="675" alt="Image" src="https://github.com/user-attachments/assets/443f00ae-e56a-40ae-9e3e-1c60963d5503" />  实际执行：  <img width="1425" height="415" alt="Image" src="https://github.com/user-attachments/assets/0bcc6518-d601-4f16-9b43-3994136935fa" />  ### 📋 错误日志/配置（可选）  _No response_  ### 📷 截图（强烈建议）  _No response_  ### 🖥️ 使用环境  GitHub Actions
  **Post-Mortem & Fix Analysis**:
  > 用 github 免费的就别想着准时，只有docker 才行。

- **Issue #1159** (2026-06-04): **[问题] RSS爬取超时，但使用浏览器可以正常访问**
  *Symptoms*: ### 📦 TrendRadar 版本  v.6.9.0  ### 🔌 MCP Server 版本 (可选)  _No response_  ### 🏷️ 问题类别  数据获取相关（爬不到新闻、平台失效等）  ### 🤖 AI 模型名称（AI 问题必填）  deepseek-v4-flash  ### 📝 描述发生了什么  这个网站配置RSS后，爬取超时： https://investors.micron.com/rss.xml  这个网站配置RSS后，报错如下： https://www.icsmart.cn/feed/  [RSS] 芯智讯: 请求失败: HTTPSConnectionPool(host='www.icsmart.cn', port=443): Max retries exceeded with url: /feed/ (Caused by SSLError(SSLCertVerificationError(1, '[SSL: CERTIFICATE_VERIFY_FAILED] certificate verify failed: unable to get local issuer certificate (_ssl.c:1010)')))     ### 📋 错误日志/配置（可选）  _No response_  ### 📷 截图（强烈建议）  _No response_  ### 🖥️ 使用环境  Docker (本地/NAS)

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

### Incident Patch 1: `07c5bcbe` (2026-07-04)
**Commit Message**: fix(config): 修复环境变量设为 0 时被 or 真值判断静默忽略的问题

Fixes #1184

**File**: `trendradar/core/loader.py` (modified, +11/-17)
```diff
@@ -23,17 +23,6 @@ def _get_env_bool(key: str) -> Optional[bool]:
     return value in ("true", "1")
 
 
-def _get_env_int(key: str, default: int = 0) -> int:
-    """从环境变量获取整数值"""
-    value = os.environ.get(key, "").strip()
-    if not value:
-        return default
-    try:
-        return int(value)
-    except ValueError:
-        return default
-
-
 def _get_env_int_or_none(key: str) -> Optional[int]:
     """从环境变量获取整数值，未设置时返回 None"""
     value = os.environ.get(key, "").strip()
@@ -83,14 +72,14 @@ def _load_report_config(config_data: Dict) -> Dict:
 
     # 环境变量覆盖
     sort_by_position_env = _get_env_bool("SORT_BY_POSITION_FIRST")
-    max_news_env = _get_env_int("MAX_NEWS_PER_KEYWORD")
+    max_news_env = _get_env_int_or_none("MAX_NEWS_PER_KEYWORD")
 
     return {
         "REPORT_MODE": report_config.get("mode", "daily"),
         "DISPLAY_MODE": report_config.get("display_mode", "keyword"),
         "RANK_THRESHOLD": report_config.get("rank_threshold", 10),
         "SORT_BY_POSITION_FIRST": sort_by_position_env if sort_by_position_env is not None else report_config.get("sort_by_position_first", False),
-        "MAX_NEWS_PER_KEYWORD": max_news_env or report_config.get("max_news_per_keyword", 0),
+        "MAX_NEWS_PER_KEYWORD": max_news_env if max_news_env is not None else report_config.get("max_news_per_keyword", 0),
     }
 
 
@@ -100,6 +89,8 @@ def _load_notification_config(config_data: Dict) -> Dict:
     advanced = config_data.get("advanced", {})
     batch_size = advanced.get("batch_size", {})
 
+    max_accounts_env = _get_env_int_or_none("MAX_ACCOUNTS_PER_CHANNEL")
+
     return {
         "ENABLE_NOTIFICATION": notification.get("enabled", True),
         "MESSAGE_BATCH_SIZE": batch_size.get("default", 4000),
@@ -109,7 +100,7 @@ def _load_notification_config(config_data: Dict) -> Dict:
         "SLACK_BATCH_SIZE": batch_size.get("slack", 4000),
         "BATCH_SEND_INTERVAL": advanced.get("batch_send_interval", 1.0),
         "FEISHU_MESSAGE_SEPARATOR": advanced.get("feishu_message_separator", "---"),
-        "MAX_ACCOUNTS_PER_CHANNEL": _get_env_int("MAX_ACCOUNTS_PER_CHANNEL") or advanced.get("max_accounts_per_channel", 3),
+        "MAX_ACCOUNTS_PER_CHANNEL": max_accounts_env if max_accounts_env is not None else advanced.get("max_accounts_per_channel", 3),
     }
 
 
@@ -371,6 +362,9 @@ def _load_storage_config(config_data: Dict) -> Dict:
     txt_enabled_env = _get_env_bool("STORAGE_TXT_ENABLED")
     html_enabled_env = _get_env_bool("STORAGE_HTML_ENABLED")
     pull_enabled_env = _get_env_bool("PULL_ENABLED")
+    local_retention_env = _get_env_int_or_none("LOCAL_RETENTION_DAYS")
+    remote_retention_env = _get_env_int_or_none("REMOTE_RETENTION_DAYS")
+    pull_days_env = _get_env_int_or_none("PULL_DAYS")
 
     return {
         "BACKEND": _get_env_str("STORAGE_BACKEND") or storage.get("backend", "auto"),
@@ -381,19 +375,19 @@ def _load_storage_config(config_data: Dict) -> Dict:
         },
         "LOCAL": {
             "DATA_DIR": local.get("data_dir", "output"),
-            "RETENTION_DAYS": _get_env_int("LOCAL_RETENTION_DAYS") or local.get("retention_days", 0),
+            "RETENTION_DAYS": local_retention_env if local_retention_env is not None else local.get("retention_days", 0),
         },
         "REMOTE": {
             "ENDPOINT_URL": _get_env_str("S3_ENDPOINT_URL") or remote.get("endpoint_url", ""),
             "BUCKET_NAME": _get_env_str("S3_BUCKET_NAME") or remote.get("bucket_name", ""),
             "ACCESS_KEY_ID": _get_env_str("S3_ACCESS_KEY_ID") or remote.get("access_key_id", ""),
             "SECRET_ACCESS_KEY": _get_env_str("S3_SECRET_ACCESS_KEY") or remote.get("secret_access_key", ""),
             "REGION": _get_env_str("S3_REGION") or remote.get("region", ""),
-            "RETENTION_DAYS": _get_env_int("REMOTE_RETENTION_DAYS") or remote.get("retention_days", 0),
+            "RETENTION_DAYS": remote_retention_env if remote_retention_env is not None else remote.get("retention_days", 0),
         },
         "PULL": {
             "ENABLED": pull_enabled_env if pull_enabled_env is not None else pull.get("enabled", False),
-            "DAYS": _get_env_int("PULL_DAYS") or pull.get("days", 7),
+            "DAYS": pull_days_env if pull_days_env is not None else pull.get("days", 7),
         },
     }
 
```

---

### Incident Patch 2: `a03ec972` (2026-06-08)
**Commit Message**: fix: 修复 AI 翻译/分析/筛选流多处数据一致性问题，升级至 v6.9.1

- 翻译：独立展示区/HTML热榜/RSS新增区多处译文缺失或错位
- 筛选：失败批次误标已分析致新闻丢失，RSS新增区未同步AI结果
- 隔离：独立AI模式混入不同时间窗的RSS/独立展示区数据

**File**: `README-EN.md` (modified, +3/-1)
```diff
@@ -11,8 +11,10 @@ Deploy in <strong>30 seconds</strong> — Say goodbye to endless scrolling, only
 [![GitHub Stars](https://img.shields.io/github/stars/sansan0/TrendRadar?style=flat-square&logo=github&color=yellow)](https://github.com/sansan0/TrendRadar/stargazers)
 [![GitHub Forks](https://img.shields.io/github/forks/sansan0/TrendRadar?style=flat-square&logo=github&color=blue)](https://github.com/sansan0/TrendRadar/network/members)
 [![License](https://img.shields.io/badge/license-GPL--3.0-blue.svg?style=flat-square)](LICENSE)
-[![Version](https://img.shields.io/badge/version-v6.9.0-blue.svg)](https://github.com/sansan0/TrendRadar)
+[![Version](https://img.shields.io/badge/version-v6.9.1-blue.svg)](https://github.com/sansan0/TrendRadar)
 [![MCP](https://img.shields.io/badge/MCP-v4.1.0-green.svg)](https://github.com/sansan0/TrendRadar)
+[![Docker Pulls](https://img.shields.io/docker/pulls/wantcat/trendradar?style=flat-square&logo=docker&logoColor=white&label=TrendRadar%20Pulls&color=2496ED)](https://hub.docker.com/r/wantcat/trendradar)
+[![Docker Pulls](https://img.shields.io/docker/pulls/wantcat/trendradar-mcp?style=flat-square&logo=docker&logoColor=white&label=MCP%20Pulls&color=2496ED)](https://hub.docker.com/r/wantcat/trendradar-mcp)
 [![RSS](https://img.shields.io/badge/RSS-Feed_Support-orange.svg?style=flat-square&logo=rss&logoColor=white)](https://github.com/sansan0/TrendRadar)
 [![AI Translation](https://img.shields.io/badge/AI-Multi--Language-purple.svg?style=flat-square)](https://github.com/sansan0/TrendRadar)
 
```

**File**: `README.md` (modified, +3/-1)
```diff
@@ -12,8 +12,10 @@
 [![GitHub Stars](https://img.shields.io/github/stars/sansan0/TrendRadar?style=flat-square&logo=github&color=yellow)](https://github.com/sansan0/TrendRadar/stargazers)
 [![GitHub Forks](https://img.shields.io/github/forks/sansan0/TrendRadar?style=flat-square&logo=github&color=blue)](https://github.com/sansan0/TrendRadar/network/members)
 [![License](https://img.shields.io/badge/license-GPL--3.0-blue.svg?style=flat-square)](LICENSE)
-[![Version](https://img.shields.io/badge/version-v6.9.0-blue.svg)](https://github.com/sansan0/TrendRadar)
+[![Version](https://img.shields.io/badge/version-v6.9.1-blue.svg)](https://github.com/sansan0/TrendRadar)
 [![MCP](https://img.shields.io/badge/MCP-v4.1.0-green.svg)](https://github.com/sansan0/TrendRadar)
+[![Docker Pulls](https://img.shields.io/docker/pulls/wantcat/trendradar?style=flat-square&logo=docker&logoColor=white&label=TrendRadar%20Pulls&color=2496ED)](https://hub.docker.com/r/wantcat/trendradar)
+[![Docker Pulls](https://img.shields.io/docker/pulls/wantcat/trendradar-mcp?style=flat-square&logo=docker&logoColor=white&label=MCP%20Pulls&color=2496ED)](https://hub.docker.com/r/wantcat/trendradar-mcp)
 [![RSS](https://img.shields.io/badge/RSS-订阅源支持-orange.svg?style=flat-square&logo=rss&logoColor=white)](https://github.com/sansan0/TrendRadar)
 [![AI翻译](https://img.shields.io/badge/AI-多语言推送-purple.svg?style=flat-square)](https://github.com/sansan0/TrendRadar)
 
```

**File**: `pyproject.toml` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 [project]
 name = "trendradar"
-version = "6.9.0"
+version = "6.9.1"
 description = "TrendRadar - 热点新闻聚合与分析工具"
 requires-python = ">=3.12"
 dependencies = [
```

**File**: `trendradar/__init__.py` (modified, +1/-1)
```diff
@@ -9,5 +9,5 @@
 
 from trendradar.context import AppContext
 
-__version__ = "6.9.0"
+__version__ = "6.9.1"
 __all__ = ["AppContext", "__version__"]
```

**File**: `trendradar/__main__.py` (modified, +41/-26)
```diff
@@ -535,14 +535,22 @@ def _run_ai_analysis(
             else:
                 ai_report_type = report_type
 
+            # 独立 AI 模式（ai_mode != 推送 mode）下，rss_items/standalone_data 仍是推送 mode 的数据，
+            # 与 ai_mode 的热榜 ai_stats 不同源。为避免时间窗错配的数据误导分析，独立模式下不向 AI
+            # 传入 RSS/独立展示区，使其专注于 ai_mode 的热榜分析（同 mode 时正常传入）。
+            ai_rss_stats = rss_items if ai_mode == mode else None
+            ai_standalone = standalone_data if ai_mode == mode else None
+            if ai_mode != mode and (rss_items or standalone_data):
+                print(f"[AI] 独立分析模式（{ai_mode}）：RSS/独立展示区与推送模式（{mode}）不同源，本次分析仅聚焦热榜")
+
             result = analyzer.analyze(
                 stats=ai_stats,
-                rss_stats=rss_items,
+                rss_stats=ai_rss_stats,
                 report_mode=ai_mode,
                 report_type=ai_report_type,
                 platforms=platforms,
                 keywords=keywords,
-                standalone_data=standalone_data,
+                standalone_data=ai_standalone,
             )
 
             # 设置 AI 分析使用的模式
@@ -805,7 +813,7 @@ def _run_analysis_pipeline(
         standalone_data: Optional[Dict] = None,
         schedule: ResolvedSchedule = None,
         rss_new_urls: Optional[set] = None,
-    ) -> Tuple[List[Dict], Optional[str], Optional[AIAnalysisResult], Optional[List[Dict]]]:
+    ) -> Tuple[List[Dict], Optional[str], Optional[AIAnalysisResult], Optional[List[Dict]], Optional[Dict], Optional[List[Dict]]]:
         """统一的分析流水线：数据处理 → 统计计算（关键词/AI筛选）→ AI分析 → HTML生成"""
 
         # 根据筛选策略选择数据处理方式
@@ -817,15 +825,16 @@ def _run_analysis_pipeline(
             if ai_filter_result and ai_filter_result.success:
                 print(f"[筛选] AI 筛选完成: {ai_filter_result.total_matched} 条匹配, {len(ai_filter_result.tags)} 个标签")
                 # 转换为与关键词匹配相同的数据结构
-                stats, ai_rss_stats = self.ctx.convert_ai_filter_to_report_data(
+                stats, ai_rss_stats, ai_rss_new_stats = self.ctx.convert_ai_filter_to_report_data(
                     ai_filter_result, mode=mode,
                     new_titles=new_titles, rss_new_urls=rss_new_urls,
                 )
                 total_titles = sum(len(titles) for titles in data_source.values())
 
-                # AI 筛选的 RSS 结果替换关键词匹配的 RSS 结果
-                if ai_rss_stats:
-                    rss_items = ai_rss_stats
+                # AI 筛选成功：无条件用 AI 结果替换 RSS 主区与新增区（与热榜 stats 一致，
+                # 不因 AI 命中为空而回退到关键词结果）
+                rss_items = ai_rss_stats
+                rss_new_items = ai_rss_new_stats
             else:
                 # AI 筛选失败，回退到关键词匹配
                 error_msg = ai_filter_result.error if ai_filter_result else "未知错误"
@@ -866,21 +875,32 @@ def _run_analysis_pipeline(
                 standalone_data=standalone_data
             )
 
-        # 翻译 RSS 内容（如果启用）— 在 HTML 生成前执行，确保网页版也能展示翻译内容
-        # 注意：仅翻译 rss_items 和 rss_new_items，不翻译 standalone_data（通知前会重新生成）
+        # 翻译 RSS 和独立展示区内容（如果启用）— 在 HTML 生成前执行，确保网页版也能展示翻译内容
+        # standalone_data 在此翻译一次后贯穿到推送阶段复用，避免重复翻译并保证网页与推送译文一致
         # 热榜翻译在推送时由 dispatch_all 处理 report_data
         trans_config = self.ctx.config.get("AI_TRANSLATION", {})
+        translate_report_func = None  # 供 HTML 翻译热榜 report_data（在过滤之后翻译）
         if trans_config.get("ENABLED", False):
             dispatcher = self.ctx.create_notification_dispatcher()
             display_regions = self.ctx.config.get("DISPLAY", {}).get("REGIONS", {})
-            _, rss_items, rss_new_items, _ = \
+            _, rss_items, rss_new_items, standalone_data = \
                 dispatcher.translate_content(
                     report_data={"stats": [], "new_titles": []},
                     rss_items=rss_items,
                     rss_new_items=rss_new_items,
+                    standalone_data=standalone_data,
                     display_regions=display_regions,
                 )
 
+            # 热榜 report_data 翻译回调：HTML 在 prepare_report_data 过滤之后调用，
+            # 仅翻译热榜（skip_rss/skip_standalone 跳过已在上游翻译的 RSS/独立区），网页版热榜展示译文
+            def translate_report_func(rd, _d=dispatcher, _r=display_regions):
+                translated_rd, _, _, _ = _d.translate_content(
+                    report_data=rd, display_regions=_r,
+                    skip_rss=True, skip_standalone=True,
+                )
+                return translated_rd
+
         # 计算 RSS 匹配条数（供 HTML 和推送共用）
         self._rss_matched_count = sum(stat.get("count", 0) for stat in rss_items) if rss_items else 0
 
@@ -911,9 +931,10 @@ def _run_analysis_pipeline(
                     "rss_source_total": self._rss_source_total,
                     "rss_source_failed": self._rss_source_failed,
                 },
+                translate_report_func=translate_report_func,
             )
 
-        return stats, html_file, ai_result, rss_items
+        return stats, html_file, ai_result, rss_items, standalone_data, rss_new_items
 
     def _send_notification_if_needed(
         self,
@@
```

**File**: `trendradar/ai/filter.py` (modified, +5/-4)
```diff
@@ -312,7 +312,7 @@ def classify_batch(
         titles: List[Dict],
         tags: List[Dict],
         interests_content: str = "",
-    ) -> List[Dict]:
+    ) -> Optional[List[Dict]]:
         """
         阶段 B：对一批新闻标题做分类
 
@@ -322,14 +322,15 @@ def classify_batch(
             interests_content: 用户的兴趣描述（含质量过滤要求）
 
         Returns:
-            [{"news_item_id": int, "tag_id": int, "relevance_score": float}, ...]
+            成功返回 [{"news_item_id": int, "tag_id": int, "relevance_score": float}, ...]（无匹配时为空列表）；
+            调用失败返回 None（用于区分"无匹配"与"调用失败"，失败批次不标记已分析以便下次重试）
         """
         if not titles or not tags:
             return []
 
         if not self.classify_user:
             print("[AI筛选] 分类提示词模板为空")
-            return []
+            return None
 
         # 构建标签列表文本
         tags_list = "\n".join(
@@ -380,7 +381,7 @@ def classify_batch(
             return self._parse_classify_response(response, titles, tags)
         except Exception as e:
             print(f"[AI筛选] 分类请求失败: {type(e).__name__}: {e}")
-            return []
+            return None
 
     def _parse_classify_response(
         self,
```

**File**: `trendradar/ai/translator.py` (modified, +13/-8)
```diff
@@ -253,14 +253,19 @@ def _parse_batch_response(self, response: str, expected_count: int) -> tuple:
         if current_idx is not None:
             results.append((current_idx, "\n".join(current_text).strip()))
 
-        # 按索引排序并提取文本
-        results.sort(key=lambda x: x[0])
-        translated = [text for _, text in results]
-        raw_parsed_count = len(translated)
-
-        # 如果解析结果数量不匹配，尝试简单按行分割
-        if len(translated) != expected_count:
-            # 回退：按行分割（去除编号）
+        # 基于 AI 返回的真实编号精确回填，而非位置顺序，避免 AI 漏号/乱序时整体错位
+        raw_parsed_count = len(results)
+
+        if results:
+            # 编号 i(1-based) 对应位置 i-1；缺失的编号位置留空（由上层保留原文），
+            # 不让后续译文顶替到相邻标题上
+            idx_to_text = {}
+            for idx, text in results:
+                if 1 <= idx <= expected_count:
+                    idx_to_text[idx] = text
+            translated = [idx_to_text.get(i + 1, "") for i in range(expected_count)]
+        else:
+            # AI 未使用 [编号] 格式：回退为按行顺序提取
             translated = []
             for line in lines:
                 stripped = line.strip()
```

**File**: `trendradar/context.py` (modified, +39/-13)
```diff
@@ -319,6 +319,7 @@ def generate_html(
         standalone_data: Optional[Dict] = None,
         frequency_file: Optional[str] = None,
         report_metadata: Optional[Dict] = None,
+        translate_report_func: Optional[Any] = None,
     ) -> str:
         """生成HTML报告"""
         return generate_html_report(
@@ -335,6 +336,7 @@ def generate_html(
             time_filename=self.format_time(),
             render_html_func=lambda *args, **kwargs: self.render_html(*args, rss_items=rss_items, rss_new_items=rss_new_items, ai_analysis=ai_analysis, standalone_data=standalone_data, **kwargs),
             report_metadata=report_metadata,
+            translate_report_func=translate_report_func,
         )
 
     def render_html(
@@ -749,6 +751,7 @@ def run_ai_filter(self, interests_file: Optional[str] = None) -> Optional[AIFilt
         batch_count = 0  # 跨热榜和 RSS 的全局批次计数
 
         # 处理热榜
+        succeeded_news_ids = []  # 成功分类（含无匹配）的热榜 id；仅这些标记已分析，失败批次留待重试
         for i in range(0, len(pending_news), batch_size):
             if batch_count > 0 and batch_interval > 0:
                 import time
@@ -760,13 +763,19 @@ def run_ai_filter(self, interests_file: Optional[str] = None) -> Optional[AIFilt
                 for n in batch
             ]
             batch_results = ai_filter.classify_batch(titles_for_ai, active_tags, interests_content)
+            batch_count += 1
+            if batch_results is None:
+                # 调用失败：不标记该批次已分析，留待下次运行重试，避免新闻静默丢失
+                print(f"[AI筛选] 热榜批次 {i // batch_size + 1}: {len(batch)} 条 → 分类失败，将在下次运行重试")
+                continue
             for r in batch_results:
                 r["source_type"] = "hotlist"
             total_results.extend(batch_results)
-            batch_count += 1
+            succeeded_news_ids.extend(n["id"] for n in batch)
             print(f"[AI筛选] 热榜批次 {i // batch_size + 1}: {len(batch)} 条 → {len(batch_results)} 条匹配")
 
         # 处理 RSS
+        succeeded_rss_ids = []  # 成功分类（含无匹配）的 RSS id；仅这些标记已分析，失败批次留待重试
         for i in range(0, len(pending_rss), batch_size):
             if batch_count > 0 and batch_interval > 0:
                 import time
@@ -778,10 +787,15 @@ def run_ai_filter(self, interests_file: Optional[str] = None) -> Optional[AIFilt
                 for n in batch
             ]
             batch_results = ai_filter.classify_batch(titles_for_ai, active_tags, interests_content)
+            batch_count += 1
+            if batch_results is None:
+                # 调用失败：不标记该批次已分析，留待下次运行重试
+                print(f"[AI筛选] RSS 批次 {i // batch_size + 1}: {len(batch)} 条 → 分类失败，将在下次运行重试")
+                continue
             for r in batch_results:
                 r["source_type"] = "rss"
             total_results.extend(batch_results)
-            batch_count += 1
+            succeeded_rss_ids.extend(n["id"] for n in batch)
             print(f"[AI筛选] RSS 批次 {i // batch_size + 1}: {len(batch)} 条 → {len(batch_results)} 条匹配")
 
         # 6. 保存结果
@@ -791,26 +805,25 @@ def run_ai_filter(self, interests_file: Optional[str] = None) -> Optional[AIFilt
             if debug and saved != len(total_results):
                 print(f"[AI筛选][DEBUG] !! 保存数量不一致: 期望 {len(total_results)}, 实际 {saved}（可能有重复记录被跳过）")
 
-        # 6.5 记录所有已分析的新闻（匹配+不匹配，用于去重）
+        # 6.5 记录已分析的新闻（匹配+不匹配，用于去重）。仅记录成功分类的批次；
+        #     失败批次的 id 不写入，使其下次运行重新分类，避免 AI 抖动导致新闻静默丢失
         matched_hotlist_ids = {r["news_item_id"] for r in total_results if r.get("source_type") == "hotlist"}
         matched_rss_ids = {r["news_item_id"] for r in total_results if r.get("source_type") == "rss"}
 
-        if pending_news:
-            hotlist_ids = [n["id"] for n in pending_news]
+        if succeeded_news_ids:
             storage.save_analyzed_news(
-                hotlist_ids, "hotlist", effective_interests_file,
+                succeeded_news_ids, "hotlist", effective_interests_file,
                 current_hash, matched_hotlist_ids
             )
 
-        if pending_rss:
-            rss_ids = [n["id"] for n in pending_rss]
+        if succeeded_rss_ids:
             storage.save_analyzed_news(
-                rss_ids, "rss", effective_interests_file,
+                succeeded_rss_ids, "rss", effective_interests_file,
                 current_hash, matched_rss_ids
             )
 
-        if pending_news or pending_rss:
-            total_analyzed = len(pending_news) + len(pending_rss)
+        if succeeded_news_ids or succeeded_rss_ids:
+            total_analyzed = len(succeeded_news_ids) + len(succeeded_rss_ids)
             total_matched = len(matched_hotlist_ids) + len(matched_rss_ids)
             print(f"[AI筛选] 已记录 {total_analyzed} 条新闻分析状态 (匹配 {total_matched}, 不匹配 {total_analyzed - total_matched})")
 
@@ -937,12 +950,14 @@ def convert_ai_filter_to_report_data(
             rss_new_urls: 新增 RSS 条目的 URL 集合，用于 is_new 检测
 
         Returns:
-            (hotlist_stats, rss_stats):
+            (hotlist_stats, rss_stats, rss_new_stats):
   
```

---

### Incident Patch 3: `a5ede43a` (2026-06-04)
**Commit Message**: fix(editor): 修复时间线编辑器生成 week_map 数字 key 带引号导致调度失败

Closes #1158

**File**: `docs/assets/script.js` (modified, +5/-1)
```diff
@@ -5059,7 +5059,11 @@ function buildEmptyPresetBlock(key, name, desc) {
  */
 function buildPresetYamlBlock(key, cfg) {
     const obj = { [key]: cfg };
-    const dumped = jsyaml.dump(obj, { indent: 2, lineWidth: -1, quotingType: '"', forceQuotes: false });
+    let dumped = jsyaml.dump(obj, { indent: 2, lineWidth: -1, quotingType: '"', forceQuotes: false });
+    // js-yaml 会把 week_map 的数字 key 序列化成带引号的字符串（"1".."7"），
+    // 而后端 scheduler 用整数 isoweekday() 读取 week_map，字符串 key 会导致启动校验失败、无法运行。
+    // 这里去掉纯数字 key 的引号，与手写模板（1: all_day）及后端期望的整数 key 保持一致。
+    dumped = dumped.replace(/^(\s*)"(\d+)":/gm, '$1$2:');
     return dumped.split('\n').map(l => l ? '  ' + l : l).join('\n');
 }
 
```

---

### Incident Patch 4: `ac0ad4f4` (2026-05-27)
**Commit Message**: fix(rss): 修复首次抓取计数及报告热点过滤，升级至 v6.8.1

**File**: `README-EN.md` (modified, +1/-1)
```diff
@@ -11,7 +11,7 @@ Deploy in <strong>30 seconds</strong> — Say goodbye to endless scrolling, only
 [![GitHub Stars](https://img.shields.io/github/stars/sansan0/TrendRadar?style=flat-square&logo=github&color=yellow)](https://github.com/sansan0/TrendRadar/stargazers)
 [![GitHub Forks](https://img.shields.io/github/forks/sansan0/TrendRadar?style=flat-square&logo=github&color=blue)](https://github.com/sansan0/TrendRadar/network/members)
 [![License](https://img.shields.io/badge/license-GPL--3.0-blue.svg?style=flat-square)](LICENSE)
-[![Version](https://img.shields.io/badge/version-v6.8.0-blue.svg)](https://github.com/sansan0/TrendRadar)
+[![Version](https://img.shields.io/badge/version-v6.8.1-blue.svg)](https://github.com/sansan0/TrendRadar)
 [![MCP](https://img.shields.io/badge/MCP-v4.0.4-green.svg)](https://github.com/sansan0/TrendRadar)
 [![RSS](https://img.shields.io/badge/RSS-Feed_Support-orange.svg?style=flat-square&logo=rss&logoColor=white)](https://github.com/sansan0/TrendRadar)
 [![AI Translation](https://img.shields.io/badge/AI-Multi--Language-purple.svg?style=flat-square)](https://github.com/sansan0/TrendRadar)
```

**File**: `README.md` (modified, +1/-1)
```diff
@@ -12,7 +12,7 @@
 [![GitHub Stars](https://img.shields.io/github/stars/sansan0/TrendRadar?style=flat-square&logo=github&color=yellow)](https://github.com/sansan0/TrendRadar/stargazers)
 [![GitHub Forks](https://img.shields.io/github/forks/sansan0/TrendRadar?style=flat-square&logo=github&color=blue)](https://github.com/sansan0/TrendRadar/network/members)
 [![License](https://img.shields.io/badge/license-GPL--3.0-blue.svg?style=flat-square)](LICENSE)
-[![Version](https://img.shields.io/badge/version-v6.8.0-blue.svg)](https://github.com/sansan0/TrendRadar)
+[![Version](https://img.shields.io/badge/version-v6.8.1-blue.svg)](https://github.com/sansan0/TrendRadar)
 [![MCP](https://img.shields.io/badge/MCP-v4.0.4-green.svg)](https://github.com/sansan0/TrendRadar)
 [![RSS](https://img.shields.io/badge/RSS-订阅源支持-orange.svg?style=flat-square&logo=rss&logoColor=white)](https://github.com/sansan0/TrendRadar)
 [![AI翻译](https://img.shields.io/badge/AI-多语言推送-purple.svg?style=flat-square)](https://github.com/sansan0/TrendRadar)
```

**File**: `pyproject.toml` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 [project]
 name = "trendradar"
-version = "6.8.0"
+version = "6.8.1"
 description = "TrendRadar - 热点新闻聚合与分析工具"
 requires-python = ">=3.12"
 dependencies = [
```

**File**: `trendradar/__init__.py` (modified, +1/-1)
```diff
@@ -9,5 +9,5 @@
 
 from trendradar.context import AppContext
 
-__version__ = "6.8.0"
+__version__ = "6.8.1"
 __all__ = ["AppContext", "__version__"]
```

**File**: `trendradar/__main__.py` (modified, +7/-0)
```diff
@@ -1375,6 +1375,13 @@ def _process_rss_data_by_mode(self, rss_data) -> Tuple[Optional[List[Dict]], Opt
                     quiet=True,
                 )
 
+        # 首次抓取时全部条目都是新增，清除新增统计以避免与主区域完全重复
+        if rss_new_stats and rss_stats:
+            main_count = sum(len(s.get("titles", [])) for s in rss_stats)
+            new_count = sum(len(s.get("titles", [])) for s in rss_new_stats)
+            if new_count > 0 and new_count >= main_count:
+                rss_new_stats = None
+
         self._rss_total_count = total
         return rss_stats, rss_new_stats, raw_rss_items, rss_new_urls
 
```

**File**: `trendradar/context.py` (modified, +0/-4)
```diff
@@ -301,8 +301,6 @@ def prepare_report(
             id_to_name=id_to_name,
             mode=mode,
             rank_threshold=self.rank_threshold,
-            matches_word_groups_func=self.matches_word_groups,
-            load_frequency_words_func=lambda: self.load_frequency_words(frequency_file),
             show_new_section=self.show_new_section,
         )
 
@@ -336,8 +334,6 @@ def generate_html(
             date_folder=self.format_date(),
             time_filename=self.format_time(),
             render_html_func=lambda *args, **kwargs: self.render_html(*args, rss_items=rss_items, rss_new_items=rss_new_items, ai_analysis=ai_analysis, standalone_data=standalone_data, **kwargs),
-            matches_word_groups_func=self.matches_word_groups,
-            load_frequency_words_func=lambda: self.load_frequency_words(frequency_file),
             report_metadata=report_metadata,
         )
 
```

**File**: `trendradar/report/generator.py` (modified, +19/-24)
```diff
@@ -18,8 +18,6 @@ def prepare_report_data(
     id_to_name: Optional[Dict] = None,
     mode: str = "daily",
     rank_threshold: int = 3,
-    matches_word_groups_func: Optional[Callable] = None,
-    load_frequency_words_func: Optional[Callable] = None,
     show_new_section: bool = True,
 ) -> Dict:
     """
@@ -32,37 +30,40 @@ def prepare_report_data(
         id_to_name: ID 到名称的映射
         mode: 报告模式 (daily/incremental/current)
         rank_threshold: 排名阈值
-        matches_word_groups_func: 词组匹配函数
-        load_frequency_words_func: 加载频率词函数
         show_new_section: 是否显示新增热点区域
 
     Returns:
         Dict: 准备好的报告数据
     """
     processed_new_titles = []
 
-    # 始终过滤新增标题用于计数（头部统计需要），但区域展示受配置控制
+    stats_title_set = {
+        t["title"]
+        for stat in stats
+        for t in stat.get("titles", [])
+    }
+
+    # 过滤新增标题：只保留在 stats 中存活的标题（即通过了 AI/关键词过滤的标题）
     filtered_new_titles = {}
     if new_titles and id_to_name:
-        if matches_word_groups_func and load_frequency_words_func:
-            word_groups, filter_words, global_filters = load_frequency_words_func()
-            for source_id, titles_data in new_titles.items():
-                filtered_titles = {}
-                for title, title_data in titles_data.items():
-                    if matches_word_groups_func(title, word_groups, filter_words, global_filters):
-                        filtered_titles[title] = title_data
-                if filtered_titles:
-                    filtered_new_titles[source_id] = filtered_titles
-        else:
-            filtered_new_titles = new_titles
+        for source_id, titles_data in new_titles.items():
+            filtered_titles = {}
+            for title, title_data in titles_data.items():
+                if title in stats_title_set:
+                    filtered_titles[title] = title_data
+            if filtered_titles:
+                filtered_new_titles[source_id] = filtered_titles
 
         original_new_count = sum(len(titles) for titles in new_titles.values()) if new_titles else 0
         filtered_new_count = sum(len(titles) for titles in filtered_new_titles.values()) if filtered_new_titles else 0
         if original_new_count > 0:
-            print(f"频率词过滤后：{filtered_new_count} 条新增热点匹配（原始 {original_new_count} 条）")
+            print(f"新增热点过滤后：{filtered_new_count} 条保留（原始 {original_new_count} 条）")
 
     # 在增量模式下或配置关闭时隐藏新增新闻区域（但计数已完成）
-    hide_new_section = mode == "incremental" or not show_new_section
+    # 当全部热榜条目都是新增时（首次运行），也隐藏以避免与主区域完全重复
+    all_new_titles = {title for titles in filtered_new_titles.values() for title in titles}
+    all_are_new = bool(all_new_titles) and all_new_titles == stats_title_set
+    hide_new_section = mode == "incremental" or not show_new_section or all_are_new
 
     if not hide_new_section and filtered_new_titles and id_to_name:
         for source_id, titles_data in filtered_new_titles.items():
@@ -151,8 +152,6 @@ def generate_html_report(
     date_folder: str = "",
     time_filename: str = "",
     render_html_func: Optional[Callable] = None,
-    matches_word_groups_func: Optional[Callable] = None,
-    load_frequency_words_func: Optional[Callable] = None,
     report_metadata: Optional[Dict] = None,
 ) -> str:
     """
@@ -176,8 +175,6 @@ def generate_html_report(
         date_folder: 日期文件夹名称
         time_filename: 时间文件名
         render_html_func: HTML 渲染函数
-        matches_word_groups_func: 词组匹配函数
-        load_frequency_words_func: 加载频率词函数
 
     Returns:
         str: 生成的 HTML 文件路径（时间戳快照路径）
@@ -198,8 +195,6 @@ def generate_html_report(
         id_to_name,
         mode,
         rank_threshold,
-        matches_word_groups_func,
-        load_frequency_words_func,
     )
 
     if report_metadata:
```

**File**: `trendradar/report/html.py` (modified, +7/-4)
```diff
@@ -2303,11 +2303,14 @@ def add_section_divider(content: str) -> str:
                 initTabVisibility();
                 initTabScroll(tabBar);
 
-                function activateTab(index) {
+                function activateTab(index, scroll) {
                     tabs.forEach(function(t) { t.classList.remove('active'); });
                     if (index === 'all') {
                         var allBtn = tabBar.querySelector('[data-tab-index="all"]');
-                        if (allBtn) allBtn.classList.add('active');
+                        if (allBtn) {
+                            allBtn.classList.add('active');
+                            if (scroll !== false) allBtn.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
+                        }
                         groups.forEach(function(g) { g.style.display = ''; });
                         try { history.replaceState(null, '', '#all'); } catch(e) {}
                         return;
@@ -2322,7 +2325,7 @@ def add_section_divider(content: str) -> str:
                         });
                     }
                     var activeBtn = tabBar.querySelector('.tab-btn.active');
-                    if (activeBtn) activeBtn.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
+                    if (scroll !== false && activeBtn) activeBtn.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
                     try { history.replaceState(null, '', '#tab-' + idx); } catch(e) {}
                 }
 
@@ -2349,7 +2352,7 @@ def add_section_divider(content: str) -> str:
                 var hash = window.location.hash;
                 if (hash === '#all') { activateTab('all'); }
                 else if (hash.indexOf('#tab-') === 0) { activateTab(parseInt(hash.replace('#tab-', ''))); }
-                else { activateTab(0); }
+                else { activateTab(0, false); }
             }
 
             function initTabVisibility() {
```

---

### Incident Patch 5: `68db3a9a` (2026-05-19)
**Commit Message**: fix(report): HTML 报告和邮件尊重 display.regions 开关，精简 config.yaml 注释，升级至 v6.7.1

**File**: `README-EN.md` (modified, +1/-1)
```diff
@@ -11,7 +11,7 @@ Deploy in <strong>30 seconds</strong> — Say goodbye to endless scrolling, only
 [![GitHub Stars](https://img.shields.io/github/stars/sansan0/TrendRadar?style=flat-square&logo=github&color=yellow)](https://github.com/sansan0/TrendRadar/stargazers)
 [![GitHub Forks](https://img.shields.io/github/forks/sansan0/TrendRadar?style=flat-square&logo=github&color=blue)](https://github.com/sansan0/TrendRadar/network/members)
 [![License](https://img.shields.io/badge/license-GPL--3.0-blue.svg?style=flat-square)](LICENSE)
-[![Version](https://img.shields.io/badge/version-v6.7.0-blue.svg)](https://github.com/sansan0/TrendRadar)
+[![Version](https://img.shields.io/badge/version-v6.7.1-blue.svg)](https://github.com/sansan0/TrendRadar)
 [![MCP](https://img.shields.io/badge/MCP-v4.0.4-green.svg)](https://github.com/sansan0/TrendRadar)
 [![RSS](https://img.shields.io/badge/RSS-Feed_Support-orange.svg?style=flat-square&logo=rss&logoColor=white)](https://github.com/sansan0/TrendRadar)
 [![AI Translation](https://img.shields.io/badge/AI-Multi--Language-purple.svg?style=flat-square)](https://github.com/sansan0/TrendRadar)
```

**File**: `README.md` (modified, +1/-1)
```diff
@@ -12,7 +12,7 @@
 [![GitHub Stars](https://img.shields.io/github/stars/sansan0/TrendRadar?style=flat-square&logo=github&color=yellow)](https://github.com/sansan0/TrendRadar/stargazers)
 [![GitHub Forks](https://img.shields.io/github/forks/sansan0/TrendRadar?style=flat-square&logo=github&color=blue)](https://github.com/sansan0/TrendRadar/network/members)
 [![License](https://img.shields.io/badge/license-GPL--3.0-blue.svg?style=flat-square)](LICENSE)
-[![Version](https://img.shields.io/badge/version-v6.7.0-blue.svg)](https://github.com/sansan0/TrendRadar)
+[![Version](https://img.shields.io/badge/version-v6.7.1-blue.svg)](https://github.com/sansan0/TrendRadar)
 [![MCP](https://img.shields.io/badge/MCP-v4.0.4-green.svg)](https://github.com/sansan0/TrendRadar)
 [![RSS](https://img.shields.io/badge/RSS-订阅源支持-orange.svg?style=flat-square&logo=rss&logoColor=white)](https://github.com/sansan0/TrendRadar)
 [![AI翻译](https://img.shields.io/badge/AI-多语言推送-purple.svg?style=flat-square)](https://github.com/sansan0/TrendRadar)
```

**File**: `config/config.yaml` (modified, +123/-244)
```diff
@@ -18,7 +18,7 @@ app:
   #   - Europe/London (伦敦时间 UTC+0/+1)
   # 完整时区列表: https://en.wikipedia.org/wiki/List_of_tz_database_time_zones
   timezone: "Asia/Shanghai"
-  show_version_update: true           # 显示版本更新提示
+  show_version_update: true           # 是否显示版本更新提示（true=显示, false=隐藏）
 
 
 # ===============================================================
@@ -40,7 +40,7 @@ app:
 # 详细时间线图请查看 config/timeline.yaml
 # ===============================================================
 schedule:
-  enabled: true                         # 是否启用调度系统
+  enabled: false                        # 是否启用调度系统（true=启用, false=关闭，默认关闭）
   preset: "morning_evening"             # 预设模板名称（见上方说明）
 
 
@@ -53,7 +53,7 @@ schedule:
 #   - name: 显示名称（可自定义，修改后不影响运行）
 # ===============================================================
 platforms:
-  enabled: true                         # 是否启用热榜平台抓取
+  enabled: true                         # 是否启用热榜平台抓取（true=启用, false=关闭）
   sources:
     - id: "toutiao"
       name: "今日头条"
@@ -89,20 +89,12 @@ platforms:
 # max_age_days: 可选，覆盖全局 freshness_filter.max_age_days
 # ===============================================================
 rss:
-  enabled: true                       # 是否启用 RSS 抓取
-
-  # 文章新鲜度过滤配置（全局默认值）
-  # 过滤掉发布时间超过指定天数的旧文章，避免同一篇文章重复出现在推送中
-  #
-  # 过滤逻辑：
-  #   - 文章发布时间距当前时间（app.timezone 时区）超过 N 天则不推送
-  #   - 无发布时间的文章会被保留（不过滤）
-  #
-  # ⚠️ 过滤时机：在推送阶段过滤
-  #    - 所有文章都会存入数据库（MCP Server 的 AI 查询仍可访问）
-  #    - 只有新鲜的文章会被推送到通知渠道
+  enabled: true                       # 是否启用 RSS 抓取（true=启用, false=关闭）
+
+  # 文章新鲜度过滤（过滤超龄旧文章，避免重复推送）
+  # 仅在推送阶段过滤，所有文章仍会存入数据库
   freshness_filter:
-    enabled: true                     # 是否启用新鲜度过滤（默认启用）
+    enabled: true                     # 是否启用新鲜度过滤（true=启用, false=关闭）
 
     max_age_days: 1                   # 最大文章年龄（天）
                                       # - 正整数：只推送 N 天内的文章
@@ -137,30 +129,20 @@ rss:
 
 # ===============================================================
 # 4. 报告模式
-#
-# 新手 5 行：
-# 1) 先选 mode：daily(当日汇总) / current(当前榜单) / incremental(仅新增)
-# 2) 再选 display_mode：keyword(按词/标签) / platform(按平台)
-# 3) 如果你开了 schedule，这里的 mode 只是默认值，会被 timeline 时段覆盖
-# 4) sort_by_position_first 只影响 keyword 模式排序
-# 5) rank_threshold 和 max_news_per_keyword 只影响展示，不影响抓取
-#
-# 进阶说明：
-# - daily：信息最全，但重复最多
-# - current：适合盯当前热度
-# - incremental：最少打扰，只看新增
 # ===============================================================
 report:
-  mode: "current"                     # daily | current | incremental（schedule 开启时作为默认值）
+  mode: "current"                     # 报告模式（开启 schedule 后作为默认值，会被 timeline 时段覆盖）
+                                      # daily = 当日汇总，按时推送当天所有匹配新闻（会包含之前推过的）
+                                      # current = 当前榜单，按时推送当前在榜的匹配新闻（持续在榜的每次都出现）
+                                      # incremental = 增量监控，只推送新增内容，零重复（没有新增时不推送）
 
-  display_mode: "keyword"             # 分组维度: keyword | platform
-                                      # keyword: 按关键词分组显示（默认）
-                                      # platform: 按平台/来源分组显示
+  display_mode: "keyword"             # 分组维度
+                                      # keyword = 按关键词分组显示
+                                      # platform = 按平台/来源分组显示
 
-  # 关键词模式分组排序方式（仅 keyword 模式生效）
-  # true: 按 frequency_words.txt 的定义顺序排列
-  # false: 按匹配到的热点条数排序（条数多的在前）
-  sort_by_position_first: false
+  sort_by_position_first: false       # 关键词模式排序（仅 display_mode=keyword 时生效）
+                                      # true = 按 frequency_words.txt 的定义顺序
+                                      # false = 按匹配到的热点条数排序（多的在前）
 
   rank_threshold: 5                   # 排名高亮阈值（影响展示强调，不改变抓取范围）
 
@@ -169,57 +151,36 @@ report:
 
 # ===============================================================
 # 4.5 筛选策略
-#
-# 新手 5 行：
-# 1) 先选 method：keyword（关键词）或 ai（兴趣分类）
-# 2) keyword 模式：看 config/frequency_words.txt
-# 3) ai 模式：看 config/ai_interests.txt + 下方 ai_filter 配置
-# 4) priority_sort_enabled 只影响 ai 模式标签排序
-# 5) 这里决定“筛选路径”，不决定 AI 模型（模型在 ai 段）
 # ===============================================================
 filter:
-  method: "ai"                     # 可选: keyword | ai
+  method: "keyword"                     # 筛选方式（二选一）
+                                       # keyword = 关键词匹配，不调用 AI，不消耗 token，但规则固定
+                                       #           词组定义在 config/frequency_words.txt
+                                       # ai = AI 智能分类，更灵活但每次运行消耗 token
+                                       #      兴趣描述在 config/ai_interests.txt，需配合下方 ai_filter
 
-  # AI 模式标签排序开关（仅 ai 模式生效）
-  # true: 按标签优先级排序（来自兴趣描述提取顺序）
-  # false: 按匹配条数排序（条数多的在前）
-  priority_sort_enabled: true
+  priority_sort_enabled: true          # AI 模式标签排序（仅 method=ai 时生效）
+                                       # true = 按兴趣描述中的定义顺序
+                                       # false = 按匹配条数排序（多的在前）
 
 
 # ===============================================================
-# 4.6 AI 智能筛选配置（当 filter.method=ai 时生效）
-#
-# 新手 5 行：
-# 1) 先调 min_score（推荐 0.5~0.7）
-# 2) 再调 reclassify_threshold（大改兴趣建议更低）
-# 3) 批量参数只影响速度/限流，不
```

**File**: `pyproject.toml` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 [project]
 name = "trendradar"
-version = "6.7.0"
+version = "6.7.1"
 description = "TrendRadar - 热点新闻聚合与分析工具"
 requires-python = ">=3.12"
 dependencies = [
```

**File**: `trendradar/__init__.py` (modified, +1/-1)
```diff
@@ -9,5 +9,5 @@
 
 from trendradar.context import AppContext
 
-__version__ = "6.7.0"
+__version__ = "6.7.1"
 __all__ = ["AppContext", "__version__"]
```

**File**: `trendradar/__main__.py` (modified, +8/-5)
```diff
@@ -655,9 +655,9 @@ def _prepare_standalone_data(
 
         纯数据准备方法，不检查 display.regions.standalone 开关。
         各消费者自行决定是否使用：
-        - AI 分析：由 ai.include_standalone 控制
-        - 通知推送：由 display.regions.standalone 控制（在 dispatcher 层门控）
-        - HTML 报告：始终包含（如果有数据）
+        - AI 分析：由 ai.include_standalone 控制（在 _run_ai_analysis 层门控）
+        - HTML 报告 / 邮件：由 display.regions.standalone 控制（在 HTML 生成前过滤）
+        - Webhook 推送：由 display.regions.standalone 控制（在 dispatcher 层门控）
 
         Args:
             results: 原始爬取结果 {platform_id: {title: title_data}}
@@ -887,6 +887,9 @@ def _run_analysis_pipeline(
         # HTML生成（如果启用）— 使用翻译后的数据
         html_file = None
         if self.ctx.config["STORAGE"]["FORMATS"]["HTML"]:
+            display_regions = self.ctx.config.get("DISPLAY", {}).get("REGIONS", {})
+            html_standalone = standalone_data if display_regions.get("STANDALONE", False) else None
+            html_ai = ai_result if display_regions.get("AI_ANALYSIS", True) else None
             html_file = self.ctx.generate_html(
                 stats,
                 total_titles,
@@ -897,8 +900,8 @@ def _run_analysis_pipeline(
                 update_info=self.update_info if self.ctx.config["SHOW_VERSION_UPDATE"] else None,
                 rss_items=rss_items,
                 rss_new_items=rss_new_items,
-                ai_analysis=ai_result,
-                standalone_data=standalone_data,
+                ai_analysis=html_ai,
+                standalone_data=html_standalone,
                 frequency_file=self.frequency_file,
             )
 
```

**File**: `uv.lock` (modified, +1/-1)
```diff
@@ -1996,7 +1996,7 @@ wheels = [
 
 [[package]]
 name = "trendradar"
-version = "6.7.0"
+version = "6.7.1"
 source = { editable = "." }
 dependencies = [
     { name = "boto3" },
```

**File**: `version` (modified, +1/-1)
```diff
@@ -1 +1 @@
-6.7.0
\ No newline at end of file
+6.7.1
```

---

### Incident Patch 6: `52010dcf` (2026-05-19)
**Commit Message**: fix(report): 修复 HTML 报告 Markdown 导出中 JS 换行符转义错误

https://github.com/sansan0/TrendRadar/issues/1130

**File**: `trendradar/report/html.py` (modified, +1/-1)
```diff
@@ -2668,7 +2668,7 @@ def add_section_divider(content: str) -> str:
                 lines.push('*Generated by TrendRadar*');
 
                 // 下载
-                var md = lines.join('\n');
+                var md = lines.join('\\n');
                 var blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
                 var link = document.createElement('a');
                 var filename = 'TrendRadar_' + dateStr + '_' + timeStr.replace(':', '') + '.md';
```

---

### Incident Patch 7: `b6152fe0` (2026-05-15)
**Commit Message**: feat(rss): 引入 guid 去重机制，增强空标题防护与翻译质量，新增 Markdown 导出，升级至 v6.7.0

- RSS 存储新增 guid 字段，去重优先级改为 guid > url
- 解析器/渲染层多级空标题兜底（摘要→URL→feed名称）
- 翻译提示词要求保留编号顺序，空翻译不覆盖原始标题
- 防止 URL 格式标题覆盖有意义的已有标题
- HTML 报告新增 Markdown 格式导出（#1121）
- 修正 README MCP badge 版本号（v4.0.2 → v4.0.4）

**File**: `README-EN.md` (modified, +16/-9)
```diff
@@ -11,8 +11,8 @@ Deploy in <strong>30 seconds</strong> — Say goodbye to endless scrolling, only
 [![GitHub Stars](https://img.shields.io/github/stars/sansan0/TrendRadar?style=flat-square&logo=github&color=yellow)](https://github.com/sansan0/TrendRadar/stargazers)
 [![GitHub Forks](https://img.shields.io/github/forks/sansan0/TrendRadar?style=flat-square&logo=github&color=blue)](https://github.com/sansan0/TrendRadar/network/members)
 [![License](https://img.shields.io/badge/license-GPL--3.0-blue.svg?style=flat-square)](LICENSE)
-[![Version](https://img.shields.io/badge/version-v6.6.2-blue.svg)](https://github.com/sansan0/TrendRadar)
-[![MCP](https://img.shields.io/badge/MCP-v4.0.2-green.svg)](https://github.com/sansan0/TrendRadar)
+[![Version](https://img.shields.io/badge/version-v6.7.0-blue.svg)](https://github.com/sansan0/TrendRadar)
+[![MCP](https://img.shields.io/badge/MCP-v4.0.4-green.svg)](https://github.com/sansan0/TrendRadar)
 [![RSS](https://img.shields.io/badge/RSS-Feed_Support-orange.svg?style=flat-square&logo=rss&logoColor=white)](https://github.com/sansan0/TrendRadar)
 [![AI Translation](https://img.shields.io/badge/AI-Multi--Language-purple.svg?style=flat-square)](https://github.com/sansan0/TrendRadar)
 
@@ -193,14 +193,12 @@ This contributes to the sustainable maintenance of the project and the growth of
 - **Tip**: Check [Changelog] to understand specific [Features]
 
 
-### 2026/03/28 - v6.6.0
+### 2026/05/15 - v6.7.0
 
-- **HTML Report Browser Enhancement**: Open the HTML report in a browser to unlock widescreen layout, Tab navigation for keyword groups and standalone sections, real-time title search, and more — email clients still show the original narrow layout with zero regression
-- **Dark Mode**: One-click toggle for dark theme with automatic preference persistence, ideal for nighttime reading
-- **One-Click Copy**: Hover over a news number to copy the title and link instantly for quick sharing
-- **Export Optimization**: Full-page and segmented screenshots merged into a dropdown export button; screenshots auto-revert to clean layout
-- **Keyboard Shortcuts**: `W` widescreen toggle, `D` dark mode, `/` search, `?` view all shortcuts
-- **Reading Progress Bar**: Real-time reading progress displayed at the top of the page
+- **Markdown Export**: New Markdown option in the report export dropdown — generate structured text with clickable links, perfect for LLM processing and cross-platform sharing ([#1121](https://github.com/sansan0/TrendRadar/issues/1121))
+- **RSS GUID Deduplication**: RSS storage now supports GUID field with priority order guid > url, preventing duplicate entries caused by URL changes for the same article
+- **Empty Title Protection**: Full-chain fallback logic across parser, renderer, and translation backfill ensures items without titles still display properly
+- **Translation Quality Enhancement**: Translation prompt now enforces numbered-item ordering preservation; empty translation results no longer overwrite original titles
 
 ### 2026/02/09 - mcp-v4.0.0
 
@@ -214,6 +212,15 @@ This contributes to the sustainable maintenance of the project and the growth of
 <details>
 <summary>👉 Click to expand: <strong>Historical Updates</strong></summary>
 
+### 2026/03/28 - v6.6.0
+
+- **HTML Report Browser Enhancement**: Open the HTML report in a browser to unlock widescreen layout, Tab navigation for keyword groups and standalone sections, real-time title search, and more — email clients still show the original narrow layout with zero regression
+- **Dark Mode**: One-click toggle for dark theme with automatic preference persistence, ideal for nighttime reading
+- **One-Click Copy**: Hover over a news number to copy the title and link instantly for quick sharing
+- **Export Optimization**: Full-page and segmented screenshots merged into a dropdown export button; screenshots auto-revert to clean layout
+- **Keyboard Shortcuts**: `W` widescreen toggle, `D` dark mode, `/` search, `?` view all shortcuts
+- **Reading Progress Bar**: Real-time reading progress displayed at the top of the page
+
 ### 2026/03/12 - v6.5.0
 
 - **AI Smart News Filtering**: No more manual keyword setup! Describe your interests in everyday language in `ai_interests.txt` (e.g., "I want AI and renewable energy news"), and AI automatically extracts tags, scores every headline, and only pushes what truly matters to you. If AI filtering encounters issues, it auto-falls back to keyword matching — push delivery never stops
```

**File**: `README.md` (modified, +16/-9)
```diff
@@ -12,8 +12,8 @@
 [![GitHub Stars](https://img.shields.io/github/stars/sansan0/TrendRadar?style=flat-square&logo=github&color=yellow)](https://github.com/sansan0/TrendRadar/stargazers)
 [![GitHub Forks](https://img.shields.io/github/forks/sansan0/TrendRadar?style=flat-square&logo=github&color=blue)](https://github.com/sansan0/TrendRadar/network/members)
 [![License](https://img.shields.io/badge/license-GPL--3.0-blue.svg?style=flat-square)](LICENSE)
-[![Version](https://img.shields.io/badge/version-v6.6.2-blue.svg)](https://github.com/sansan0/TrendRadar)
-[![MCP](https://img.shields.io/badge/MCP-v4.0.2-green.svg)](https://github.com/sansan0/TrendRadar)
+[![Version](https://img.shields.io/badge/version-v6.7.0-blue.svg)](https://github.com/sansan0/TrendRadar)
+[![MCP](https://img.shields.io/badge/MCP-v4.0.4-green.svg)](https://github.com/sansan0/TrendRadar)
 [![RSS](https://img.shields.io/badge/RSS-订阅源支持-orange.svg?style=flat-square&logo=rss&logoColor=white)](https://github.com/sansan0/TrendRadar)
 [![AI翻译](https://img.shields.io/badge/AI-多语言推送-purple.svg?style=flat-square)](https://github.com/sansan0/TrendRadar)
 
@@ -241,14 +241,12 @@
 - **提示**：建议查看【历史更新】，明确具体的【功能内容】
 
 
-### 2026/03/28 - v6.6.0
+### 2026/05/15 - v6.7.0
 
-- **HTML 报告浏览器增强**：在浏览器中打开报告可自动切换宽屏布局，关键词分组和独立展区均支持 Tab 快速切换，搜索框实时过滤新闻标题，邮件客户端仍显示原始窄屏布局，零回归
-- **暗色模式**：一键切换深色主题，自动记住偏好，适合夜间阅读
-- **一键复制新闻**：鼠标悬停新闻序号即可复制标题和链接，方便快速分享
-- **导出优化**：整页截图和分段截图合并为下拉式导出按钮，截图时自动还原干净布局
-- **快捷键系统**：支持 `W` 宽屏切换、`D` 暗色模式、`/` 搜索、`?` 查看快捷键提示
-- **阅读进度条**：页面顶部实时显示阅读进度
+- **Markdown 导出**：报告导出下拉菜单新增 Markdown 格式，一键生成带链接的结构化文本，方便 LLM 二次加工和跨平台分享（[#1121](https://github.com/sansan0/TrendRadar/issues/1121)）
+- **RSS guid 去重**：RSS 存储新增 guid 字段，去重优先级改为 guid > url，解决同一文章因 URL 变化导致重复入库的问题
+- **空标题防护**：解析器、渲染层、翻译回填全链路增加空标题兜底逻辑，确保无标题条目也能正常显示
+- **翻译质量增强**：翻译提示词要求保留编号顺序，空翻译结果不再覆盖原始标题
 
 ### 2026/02/09 - mcp-v4.0.0
 
@@ -262,6 +260,15 @@
 <details>
 <summary>👉 点击展开：<strong>历史更新</strong></summary>
 
+### 2026/03/28 - v6.6.0
+
+- **HTML 报告浏览器增强**：在浏览器中打开报告可自动切换宽屏布局，关键词分组和独立展区均支持 Tab 快速切换，搜索框实时过滤新闻标题，邮件客户端仍显示原始窄屏布局，零回归
+- **暗色模式**：一键切换深色主题，自动记住偏好，适合夜间阅读
+- **一键复制新闻**：鼠标悬停新闻序号即可复制标题和链接，方便快速分享
+- **导出优化**：整页截图和分段截图合并为下拉式导出按钮，截图时自动还原干净布局
+- **快捷键系统**：支持 `W` 宽屏切换、`D` 暗色模式、`/` 搜索、`?` 查看快捷键提示
+- **阅读进度条**：页面顶部实时显示阅读进度
+
 ### 2026/03/12 - v6.5.0
 
 - **AI 智能筛选系统**：不用再手动设关键词！在 `ai_interests.txt` 里用日常语言写下你关注的方向（如"我想看 AI 和新能源相关新闻"），AI 会自动提取标签并对每条新闻打分，只推送真正和你相关的内容。万一 AI 筛选出了问题，会自动切回关键词匹配，推送不中断
```

**File**: `config/ai_translation_prompt.txt` (modified, +1/-1)
```diff
@@ -18,7 +18,7 @@
 1. 准确传达原文含义，不要遗漏关键信息。
 2. 保持新闻标题的吸引力，但不要做标题党。
 3. 专有名词（人名、地名、机构名）若有通用译名请使用通用译名，否则保留原文或在括号内备注。
-4. 输出格式必须严格遵循要求，不要输出任何多余的解释性文字。
+4. 输出格式必须严格遵循要求，不要输出任何多余的解释性文字。如果输入包含编号（如 [1]、[2]、[3]...），**必须**在输出中保留完全相同的编号和顺序，每条编号对应一条翻译结果，不得跳过、合并或增加任何编号条目。
 5. ⚠️重点：输入可能包含混合语言列表。请务必逐行检查每一条内容。如果某条内容不是 {target_language}，**必须**将其翻译为 {target_language}。严禁保留非 {target_language} 的原文（除非是纯专有名词）。即使列表中 99% 已经是目标语言，也绝对不能忽略剩下的 1%。
 6. 格式严格限制：输出结果中**只允许包含目标语言**的文本。绝对禁止“原文 + 译文”的形式。如果进行了翻译，直接用译文替换原文，不要在后面括号备注原文，也不要保留原文。
 
```

**File**: `pyproject.toml` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 [project]
 name = "trendradar"
-version = "6.6.2"
+version = "6.7.0"
 description = "TrendRadar - 热点新闻聚合与分析工具"
 requires-python = ">=3.12"
 dependencies = [
```

**File**: `trendradar/__init__.py` (modified, +1/-1)
```diff
@@ -9,5 +9,5 @@
 
 from trendradar.context import AppContext
 
-__version__ = "6.6.2"
+__version__ = "6.7.0"
 __all__ = ["AppContext", "__version__"]
```

**File**: `trendradar/ai/translator.py` (modified, +9/-4)
```diff
@@ -187,11 +187,16 @@ def translate_batch(self, texts: List[str]) -> BatchTranslationResult:
             translated_texts, raw_parsed_count = self._parse_batch_response(response, len(non_empty_texts))
             batch_result.parsed_count = raw_parsed_count
 
-            # 填充结果
+            # 填充结果（跳过空翻译，避免用空字符串覆盖原始标题）
             for idx, translated in zip(non_empty_indices, translated_texts):
-                batch_result.results[idx].translated_text = translated
-                batch_result.results[idx].success = True
-                batch_result.success_count += 1
+                if translated and translated.strip():
+                    batch_result.results[idx].translated_text = translated
+                    batch_result.results[idx].success = True
+                    batch_result.success_count += 1
+                else:
+                    batch_result.results[idx].translated_text = batch_result.results[idx].original_text
+                    batch_result.results[idx].success = True
+                    batch_result.success_count += 1
 
         except Exception as e:
             error_msg = f"批量翻译失败: {type(e).__name__}: {str(e)[:100]}"
```

**File**: `trendradar/crawler/rss/fetcher.py` (modified, +1/-0)
```diff
@@ -157,6 +157,7 @@ def fetch_feed(self, feed: RSSFeedConfig) -> Tuple[List[RSSItem], Optional[str]]
                     feed_id=feed.id,
                     feed_name=feed.name,
                     url=parsed.url,
+                    guid=parsed.guid or "",
                     published_at=parsed.published_at or "",
                     summary=parsed.summary or "",
                     author=parsed.author or "",
```

**File**: `trendradar/crawler/rss/parser.py` (modified, +21/-8)
```diff
@@ -125,20 +125,20 @@ def _parse_json_feed(self, content: str, feed_url: str = "") -> List[ParsedRSSIt
 
     def _parse_json_feed_item(self, item_data: Dict[str, Any]) -> Optional[ParsedRSSItem]:
         """解析单个 JSON Feed 条目"""
-        # 标题：优先 title，否则使用 content_text 的前 100 字符
+        url = item_data.get("url", "") or item_data.get("external_url", "")
+
         title = item_data.get("title", "")
         if not title:
             content_text = item_data.get("content_text", "")
             if content_text:
-                title = content_text[:100] + ("..." if len(content_text) > 100 else "")
+                title = content_text[:20] + ("..." if len(content_text) > 20 else "")
 
         title = self._clean_text(title)
+        if not title and url:
+            title = url
         if not title:
             return None
 
-        # URL
-        url = item_data.get("url", "") or item_data.get("external_url", "")
-
         # 发布时间（ISO 8601 格式）
         published_at = None
         date_str = item_data.get("date_published") or item_data.get("date_modified")
@@ -216,12 +216,9 @@ def parse_url(self, url: str, timeout: int = 10) -> List[ParsedRSSItem]:
     def _parse_entry(self, entry: Any) -> Optional[ParsedRSSItem]:
         """解析单个条目"""
         title = self._clean_text(entry.get("title", ""))
-        if not title:
-            return None
 
         url = entry.get("link", "")
         if not url:
-            # 尝试从 links 中获取
             links = entry.get("links", [])
             for link in links:
                 if link.get("rel") == "alternate" or link.get("type", "").startswith("text/html"):
@@ -230,6 +227,22 @@ def _parse_entry(self, entry: Any) -> Optional[ParsedRSSItem]:
             if not url and links:
                 url = links[0].get("href", "")
 
+        if not title:
+            raw_summary = entry.get("summary") or entry.get("description", "")
+            if not raw_summary:
+                content = entry.get("content", [])
+                if content and isinstance(content, list):
+                    raw_summary = content[0].get("value", "")
+            if raw_summary:
+                title = self._clean_text(raw_summary)
+                if len(title) > 20:
+                    title = title[:20] + "..."
+            if not title and url:
+                title = url
+
+        if not title:
+            return None
+
         published_at = self._parse_date(entry)
         summary = self._parse_summary(entry)
         author = self._parse_author(entry)
```

---

### Incident Patch 8: `b109701b` (2026-04-30)
**Commit Message**: fix: 过滤 platforms.sources 中 enabled: false 的数据源，修复全局开关失效，升级至 v6.6.2/mcp-v4.0.4

**File**: `README-EN.md` (modified, +1/-1)
```diff
@@ -11,7 +11,7 @@ Deploy in <strong>30 seconds</strong> — Say goodbye to endless scrolling, only
 [![GitHub Stars](https://img.shields.io/github/stars/sansan0/TrendRadar?style=flat-square&logo=github&color=yellow)](https://github.com/sansan0/TrendRadar/stargazers)
 [![GitHub Forks](https://img.shields.io/github/forks/sansan0/TrendRadar?style=flat-square&logo=github&color=blue)](https://github.com/sansan0/TrendRadar/network/members)
 [![License](https://img.shields.io/badge/license-GPL--3.0-blue.svg?style=flat-square)](LICENSE)
-[![Version](https://img.shields.io/badge/version-v6.6.1-blue.svg)](https://github.com/sansan0/TrendRadar)
+[![Version](https://img.shields.io/badge/version-v6.6.2-blue.svg)](https://github.com/sansan0/TrendRadar)
 [![MCP](https://img.shields.io/badge/MCP-v4.0.2-green.svg)](https://github.com/sansan0/TrendRadar)
 [![RSS](https://img.shields.io/badge/RSS-Feed_Support-orange.svg?style=flat-square&logo=rss&logoColor=white)](https://github.com/sansan0/TrendRadar)
 [![AI Translation](https://img.shields.io/badge/AI-Multi--Language-purple.svg?style=flat-square)](https://github.com/sansan0/TrendRadar)
```

**File**: `README.md` (modified, +1/-1)
```diff
@@ -12,7 +12,7 @@
 [![GitHub Stars](https://img.shields.io/github/stars/sansan0/TrendRadar?style=flat-square&logo=github&color=yellow)](https://github.com/sansan0/TrendRadar/stargazers)
 [![GitHub Forks](https://img.shields.io/github/forks/sansan0/TrendRadar?style=flat-square&logo=github&color=blue)](https://github.com/sansan0/TrendRadar/network/members)
 [![License](https://img.shields.io/badge/license-GPL--3.0-blue.svg?style=flat-square)](LICENSE)
-[![Version](https://img.shields.io/badge/version-v6.6.1-blue.svg)](https://github.com/sansan0/TrendRadar)
+[![Version](https://img.shields.io/badge/version-v6.6.2-blue.svg)](https://github.com/sansan0/TrendRadar)
 [![MCP](https://img.shields.io/badge/MCP-v4.0.2-green.svg)](https://github.com/sansan0/TrendRadar)
 [![RSS](https://img.shields.io/badge/RSS-订阅源支持-orange.svg?style=flat-square&logo=rss&logoColor=white)](https://github.com/sansan0/TrendRadar)
 [![AI翻译](https://img.shields.io/badge/AI-多语言推送-purple.svg?style=flat-square)](https://github.com/sansan0/TrendRadar)
```

**File**: `mcp_server/__init__.py` (modified, +1/-1)
```diff
@@ -5,4 +5,4 @@
 
 """
 
-__version__ = "4.0.3"
+__version__ = "4.0.4"
```

**File**: `mcp_server/services/data_service.py` (modified, +1/-1)
```diff
@@ -487,7 +487,7 @@ def get_current_config(self, section: str = "all") -> Dict:
                 "use_proxy": advanced_crawler.get("use_proxy", False),
                 "request_interval": advanced_crawler.get("request_interval", 1),
                 "retry_times": 3,
-                "platforms": [p["id"] for p in platforms_config.get("sources", [])]
+                "platforms": [p["id"] for p in platforms_config.get("sources", []) if p.get("enabled", True)]
             }
 
         if section == "all" or section == "push":
```

**File**: `mcp_server/tools/system.py` (modified, +1/-1)
```diff
@@ -88,7 +88,7 @@ def _load_crawl_config(self):
                 "热榜平台已禁用",
                 suggestion="请检查 config/config.yaml 中的 platforms.enabled 配置"
             )
-        all_platforms = platforms_config.get("sources", [])
+        all_platforms = [p for p in platforms_config.get("sources", []) if p.get("enabled", True)]
         if not all_platforms:
             raise CrawlTaskError(
                 "配置文件中没有平台配置",
```

**File**: `mcp_server/utils/validators.py` (modified, +1/-1)
```diff
@@ -185,7 +185,7 @@ def get_supported_platforms() -> List[str]:
             config = yaml.safe_load(f)
             platforms_config = config.get('platforms', {})
             sources = platforms_config.get('sources', [])
-            _platforms_cache = [p['id'] for p in sources if 'id' in p]
+            _platforms_cache = [p['id'] for p in sources if 'id' in p and p.get('enabled', True)]
             _platforms_config_mtime = current_mtime
             return _platforms_cache
     except Exception as e:
```

**File**: `pyproject.toml` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 [project]
 name = "trendradar"
-version = "6.6.1"
+version = "6.6.2"
 description = "TrendRadar - 热点新闻聚合与分析工具"
 requires-python = ">=3.12"
 dependencies = [
```

**File**: `trendradar/__init__.py` (modified, +1/-1)
```diff
@@ -9,5 +9,5 @@
 
 from trendradar.context import AppContext
 
-__version__ = "6.6.1"
+__version__ = "6.6.2"
 __all__ = ["AppContext", "__version__"]
```

---

### Incident Patch 9: `ddd3f4dc` (2026-04-18)
**Commit Message**: fix(core): 调度器时间区间改为半开区间，修复相邻时段误判重叠

**File**: `trendradar/core/scheduler.py` (modified, +8/-8)
```diff
@@ -246,11 +246,11 @@ def _in_range(now_hhmm: str, start: str, end: str) -> bool:
             是否在范围内
         """
         if start <= end:
-            # 正常范围，如 08:00-09:00
-            return start <= now_hhmm <= end
+            # 正常范围，如 08:00-09:00（半开区间 [start, end)）
+            return start <= now_hhmm < end
         else:
-            # 跨日范围，如 22:00-07:00
-            return now_hhmm >= start or now_hhmm <= end
+            # 跨日范围，如 22:00-07:00（半开区间 [start, end)）
+            return now_hhmm >= start or now_hhmm < end
 
     def _merge_with_default(self, period_key: Optional[str]) -> Dict[str, Any]:
         """合并默认配置和时间段配置"""
@@ -408,16 +408,16 @@ def expand_range(start: str, end: str) -> List[tuple]:
             if s <= e:
                 return [(s, e)]
             else:
-                # 跨日：拆分为 [start, 23:59] 和 [00:00, end]
-                return [(s, 24 * 60 - 1), (0, e)]
+                # 跨日：拆分为 [start, 24:00) 和 [00:00, end)
+                return [(s, 24 * 60), (0, e)]
 
         segs1 = expand_range(s1, e1)
         segs2 = expand_range(s2, e2)
 
         for a_start, a_end in segs1:
             for b_start, b_end in segs2:
-                # 两个区间有重叠的条件
-                if a_start <= b_end and b_start <= a_end:
+                # 两个半开区间有重叠的条件
+                if a_start < b_end and b_start < a_end:
                     return True
         return False
 
```

---

### Incident Patch 10: `dd27ed8e` (2026-04-09)
**Commit Message**: fix(editor): 修复周映射下拉菜单因 YAML key 带引号导致无法修改的问题

Closes #1056

**File**: `docs/assets/script.js` (modified, +2/-1)
```diff
@@ -4674,7 +4674,8 @@ function findChildKey(lines, start, end, parentIndent, key) {
         const indent = line.search(/\S/);
         if (indent <= parentIndent) break;
         const m = line.match(/^\s*(\S+):\s*/);
-        if (m && m[1] === key && indent === parentIndent + 2) {
+        const rawKey = m ? m[1].replace(/^["']|["']$/g, '') : null;
+        if (m && rawKey === key && indent === parentIndent + 2) {
             return i;
         }
     }
```

---

### Incident Patch 11: `42de0411` (2026-03-27)
**Commit Message**: fix(docker): 修复 MCP Dockerfile HEALTHCHECK 端点 /sse 改为 /mcp，升级至 mcp-v4.0.2

**File**: `README-EN.md` (modified, +1/-1)
```diff
@@ -12,7 +12,7 @@ Deploy in <strong>30 seconds</strong> — Say goodbye to endless scrolling, only
 [![GitHub Forks](https://img.shields.io/github/forks/sansan0/TrendRadar?style=flat-square&logo=github&color=blue)](https://github.com/sansan0/TrendRadar/network/members)
 [![License](https://img.shields.io/badge/license-GPL--3.0-blue.svg?style=flat-square)](LICENSE)
 [![Version](https://img.shields.io/badge/version-v6.5.5-blue.svg)](https://github.com/sansan0/TrendRadar)
-[![MCP](https://img.shields.io/badge/MCP-v4.0.1-green.svg)](https://github.com/sansan0/TrendRadar)
+[![MCP](https://img.shields.io/badge/MCP-v4.0.2-green.svg)](https://github.com/sansan0/TrendRadar)
 [![RSS](https://img.shields.io/badge/RSS-Feed_Support-orange.svg?style=flat-square&logo=rss&logoColor=white)](https://github.com/sansan0/TrendRadar)
 [![AI Translation](https://img.shields.io/badge/AI-Multi--Language-purple.svg?style=flat-square)](https://github.com/sansan0/TrendRadar)
 
```

**File**: `README.md` (modified, +1/-1)
```diff
@@ -13,7 +13,7 @@
 [![GitHub Forks](https://img.shields.io/github/forks/sansan0/TrendRadar?style=flat-square&logo=github&color=blue)](https://github.com/sansan0/TrendRadar/network/members)
 [![License](https://img.shields.io/badge/license-GPL--3.0-blue.svg?style=flat-square)](LICENSE)
 [![Version](https://img.shields.io/badge/version-v6.5.5-blue.svg)](https://github.com/sansan0/TrendRadar)
-[![MCP](https://img.shields.io/badge/MCP-v4.0.1-green.svg)](https://github.com/sansan0/TrendRadar)
+[![MCP](https://img.shields.io/badge/MCP-v4.0.2-green.svg)](https://github.com/sansan0/TrendRadar)
 [![RSS](https://img.shields.io/badge/RSS-订阅源支持-orange.svg?style=flat-square&logo=rss&logoColor=white)](https://github.com/sansan0/TrendRadar)
 [![AI翻译](https://img.shields.io/badge/AI-多语言推送-purple.svg?style=flat-square)](https://github.com/sansan0/TrendRadar)
 
```

**File**: `docker/Dockerfile.mcp` (modified, +1/-1)
```diff
@@ -29,7 +29,7 @@ ENV PYTHONUNBUFFERED=1 \
 EXPOSE 3333
 
 HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
-    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:3333/sse')" || exit 1
+    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:3333/mcp')" || exit 1
 
 # 启动 MCP 服务器（HTTP 模式）
 CMD ["python", "-m", "mcp_server.server", "--transport", "http", "--host", "0.0.0.0", "--port", "3333"]
```

**File**: `mcp_server/__init__.py` (modified, +1/-1)
```diff
@@ -5,4 +5,4 @@
 
 """
 
-__version__ = "4.0.1"
+__version__ = "4.0.2"
```

**File**: `version_mcp` (modified, +1/-1)
```diff
@@ -1 +1 @@
-4.0.1
\ No newline at end of file
+4.0.2
\ No newline at end of file
```

---

### Incident Patch 12: `167b28c8` (2026-03-27)
**Commit Message**: fix(docker): 修复 entrypoint.sh 硬编码 Python 路径导致 venv 依赖找不到，升级至 v6.5.5

**File**: `README-EN.md` (modified, +1/-1)
```diff
@@ -11,7 +11,7 @@ Deploy in <strong>30 seconds</strong> — Say goodbye to endless scrolling, only
 [![GitHub Stars](https://img.shields.io/github/stars/sansan0/TrendRadar?style=flat-square&logo=github&color=yellow)](https://github.com/sansan0/TrendRadar/stargazers)
 [![GitHub Forks](https://img.shields.io/github/forks/sansan0/TrendRadar?style=flat-square&logo=github&color=blue)](https://github.com/sansan0/TrendRadar/network/members)
 [![License](https://img.shields.io/badge/license-GPL--3.0-blue.svg?style=flat-square)](LICENSE)
-[![Version](https://img.shields.io/badge/version-v6.5.4-blue.svg)](https://github.com/sansan0/TrendRadar)
+[![Version](https://img.shields.io/badge/version-v6.5.5-blue.svg)](https://github.com/sansan0/TrendRadar)
 [![MCP](https://img.shields.io/badge/MCP-v4.0.1-green.svg)](https://github.com/sansan0/TrendRadar)
 [![RSS](https://img.shields.io/badge/RSS-Feed_Support-orange.svg?style=flat-square&logo=rss&logoColor=white)](https://github.com/sansan0/TrendRadar)
 [![AI Translation](https://img.shields.io/badge/AI-Multi--Language-purple.svg?style=flat-square)](https://github.com/sansan0/TrendRadar)
```

**File**: `README.md` (modified, +1/-1)
```diff
@@ -12,7 +12,7 @@
 [![GitHub Stars](https://img.shields.io/github/stars/sansan0/TrendRadar?style=flat-square&logo=github&color=yellow)](https://github.com/sansan0/TrendRadar/stargazers)
 [![GitHub Forks](https://img.shields.io/github/forks/sansan0/TrendRadar?style=flat-square&logo=github&color=blue)](https://github.com/sansan0/TrendRadar/network/members)
 [![License](https://img.shields.io/badge/license-GPL--3.0-blue.svg?style=flat-square)](LICENSE)
-[![Version](https://img.shields.io/badge/version-v6.5.4-blue.svg)](https://github.com/sansan0/TrendRadar)
+[![Version](https://img.shields.io/badge/version-v6.5.5-blue.svg)](https://github.com/sansan0/TrendRadar)
 [![MCP](https://img.shields.io/badge/MCP-v4.0.1-green.svg)](https://github.com/sansan0/TrendRadar)
 [![RSS](https://img.shields.io/badge/RSS-订阅源支持-orange.svg?style=flat-square&logo=rss&logoColor=white)](https://github.com/sansan0/TrendRadar)
 [![AI翻译](https://img.shields.io/badge/AI-多语言推送-purple.svg?style=flat-square)](https://github.com/sansan0/TrendRadar)
```

**File**: `docker/entrypoint.sh` (modified, +5/-5)
```diff
@@ -10,7 +10,7 @@ fi
 case "${RUN_MODE:-cron}" in
 "once")
     echo "🔄 单次执行"
-    exec /usr/local/bin/python -m trendradar
+    exec python -m trendradar
     ;;
 "cron")
     # 校验 CRON_SCHEDULE 格式（仅允许 cron 表达式合法字符）
@@ -21,7 +21,7 @@ case "${RUN_MODE:-cron}" in
     fi
 
     # 生成 crontab
-    echo "$CRON_EXPR cd /app && /usr/local/bin/python -m trendradar" > /tmp/crontab
+    echo "$CRON_EXPR cd /app && python -m trendradar" > /tmp/crontab
     
     echo "📅 生成的crontab内容:"
     cat /tmp/crontab
@@ -34,13 +34,13 @@ case "${RUN_MODE:-cron}" in
     # 立即执行一次（如果配置了）
     if [ "${IMMEDIATE_RUN:-false}" = "true" ]; then
         echo "▶️ 立即执行一次"
-        /usr/local/bin/python -m trendradar
+        python -m trendradar
     fi
 
     # 启动 Web 服务器（如果配置了）
     if [ "${ENABLE_WEBSERVER:-false}" = "true" ]; then
         echo "🌐 启动 Web 服务器..."
-        /usr/local/bin/python manage.py start_webserver
+        python manage.py start_webserver
 
         WEBSERVER_WATCHDOG_ENABLED=$(echo "${WEBSERVER_WATCHDOG:-true}" | tr '[:upper:]' '[:lower:]')
         WEBSERVER_WATCHDOG_INTERVAL=${WEBSERVER_WATCHDOG_INTERVAL:-60}
@@ -50,7 +50,7 @@ case "${RUN_MODE:-cron}" in
             (
                 while true; do
                     sleep "$WEBSERVER_WATCHDOG_INTERVAL"
-                    /usr/local/bin/python manage.py webserver_autofix
+                    python manage.py webserver_autofix
                 done
             ) &
             WEBSERVER_WATCHDOG_PID=$!
```

**File**: `pyproject.toml` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 [project]
 name = "trendradar"
-version = "6.5.4"
+version = "6.5.5"
 description = "TrendRadar - 热点新闻聚合与分析工具"
 requires-python = ">=3.12"
 dependencies = [
```

**File**: `trendradar/__init__.py` (modified, +1/-1)
```diff
@@ -9,5 +9,5 @@
 
 from trendradar.context import AppContext
 
-__version__ = "6.5.4"
+__version__ = "6.5.5"
 __all__ = ["AppContext", "__version__"]
```

**File**: `uv.lock` (modified, +1/-1)
```diff
@@ -1996,7 +1996,7 @@ wheels = [
 
 [[package]]
 name = "trendradar"
-version = "6.5.4"
+version = "6.5.5"
 source = { editable = "." }
 dependencies = [
     { name = "boto3" },
```

**File**: `version` (modified, +1/-1)
```diff
@@ -1 +1 @@
-6.5.4
\ No newline at end of file
+6.5.5
\ No newline at end of file
```

---

### Incident Patch 13: `655ef8d4` (2026-03-27)
**Commit Message**: fix(core): 修复排序权重量纲不对齐及清理死代码，升级至 v6.5.4

- rank_weight 值域 1~10 归一化到 10~100，与 frequency/hotness 对齐
- 修复 fallback 默认权重与 config.yaml 不一致（0.4/0.3/0.3 → 0.6/0.3/0.1）
- 清理死代码 TimeWindowChecker 和 get_url_signature
- 修复 CRON_SCHEDULE 校验正则在 Alpine grep 中报 Invalid range end
- 升级 setup-python v6 和 setup-uv v7 消除 Node.js 20 弃用警告
- bump version to v6.5.4

**File**: `.github/workflows/crawler.yml` (modified, +2/-2)
```diff
@@ -113,13 +113,13 @@ jobs:
 
       - name: Set up Python
         if: success()
-        uses: actions/setup-python@v5
+        uses: actions/setup-python@v6
         with:
           python-version: "3.12"
 
       - name: Install uv
         if: success()
-        uses: astral-sh/setup-uv@v5
+        uses: astral-sh/setup-uv@v7
 
       - name: Install dependencies
         if: success()
```

**File**: `README-EN.md` (modified, +1/-1)
```diff
@@ -11,7 +11,7 @@ Deploy in <strong>30 seconds</strong> — Say goodbye to endless scrolling, only
 [![GitHub Stars](https://img.shields.io/github/stars/sansan0/TrendRadar?style=flat-square&logo=github&color=yellow)](https://github.com/sansan0/TrendRadar/stargazers)
 [![GitHub Forks](https://img.shields.io/github/forks/sansan0/TrendRadar?style=flat-square&logo=github&color=blue)](https://github.com/sansan0/TrendRadar/network/members)
 [![License](https://img.shields.io/badge/license-GPL--3.0-blue.svg?style=flat-square)](LICENSE)
-[![Version](https://img.shields.io/badge/version-v6.5.3-blue.svg)](https://github.com/sansan0/TrendRadar)
+[![Version](https://img.shields.io/badge/version-v6.5.4-blue.svg)](https://github.com/sansan0/TrendRadar)
 [![MCP](https://img.shields.io/badge/MCP-v4.0.1-green.svg)](https://github.com/sansan0/TrendRadar)
 [![RSS](https://img.shields.io/badge/RSS-Feed_Support-orange.svg?style=flat-square&logo=rss&logoColor=white)](https://github.com/sansan0/TrendRadar)
 [![AI Translation](https://img.shields.io/badge/AI-Multi--Language-purple.svg?style=flat-square)](https://github.com/sansan0/TrendRadar)
```

**File**: `README.md` (modified, +1/-1)
```diff
@@ -12,7 +12,7 @@
 [![GitHub Stars](https://img.shields.io/github/stars/sansan0/TrendRadar?style=flat-square&logo=github&color=yellow)](https://github.com/sansan0/TrendRadar/stargazers)
 [![GitHub Forks](https://img.shields.io/github/forks/sansan0/TrendRadar?style=flat-square&logo=github&color=blue)](https://github.com/sansan0/TrendRadar/network/members)
 [![License](https://img.shields.io/badge/license-GPL--3.0-blue.svg?style=flat-square)](LICENSE)
-[![Version](https://img.shields.io/badge/version-v6.5.3-blue.svg)](https://github.com/sansan0/TrendRadar)
+[![Version](https://img.shields.io/badge/version-v6.5.4-blue.svg)](https://github.com/sansan0/TrendRadar)
 [![MCP](https://img.shields.io/badge/MCP-v4.0.1-green.svg)](https://github.com/sansan0/TrendRadar)
 [![RSS](https://img.shields.io/badge/RSS-订阅源支持-orange.svg?style=flat-square&logo=rss&logoColor=white)](https://github.com/sansan0/TrendRadar)
 [![AI翻译](https://img.shields.io/badge/AI-多语言推送-purple.svg?style=flat-square)](https://github.com/sansan0/TrendRadar)
```

**File**: `docker/entrypoint.sh` (modified, +1/-1)
```diff
@@ -15,7 +15,7 @@ case "${RUN_MODE:-cron}" in
 "cron")
     # 校验 CRON_SCHEDULE 格式（仅允许 cron 表达式合法字符）
     CRON_EXPR="${CRON_SCHEDULE:-*/30 * * * *}"
-    if ! echo "$CRON_EXPR" | grep -qE '^[0-9*/,\-[:space:]]+$'; then
+    if ! echo "$CRON_EXPR" | grep -qE '^[0-9*/,[:space:]-]+$'; then
         echo "❌ CRON_SCHEDULE 格式非法: $CRON_EXPR"
         exit 1
     fi
```

**File**: `pyproject.toml` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 [project]
 name = "trendradar"
-version = "6.5.3"
+version = "6.5.4"
 description = "TrendRadar - 热点新闻聚合与分析工具"
 requires-python = ">=3.12"
 dependencies = [
```

**File**: `trendradar/__init__.py` (modified, +1/-1)
```diff
@@ -9,5 +9,5 @@
 
 from trendradar.context import AppContext
 
-__version__ = "6.5.3"
+__version__ = "6.5.4"
 __all__ = ["AppContext", "__version__"]
```

**File**: `trendradar/core/analyzer.py` (modified, +4/-3)
```diff
@@ -44,7 +44,8 @@ def calculate_news_weight(
         if rank <= rank_threshold:
             high_rank_count += 1
 
-    rank_weight = rank_score_sum / len(ranks)
+    # 归一化到 0~100（与 frequency_weight、hotness_weight 量纲对齐）
+    rank_weight = (rank_score_sum / len(ranks)) * 10
 
     # 频次权重：min(出现次数, 10) × 10
     frequency_weight = min(count, 10) * 10
@@ -132,9 +133,9 @@ def count_word_frequency(
     # 默认权重配置
     if weight_config is None:
         weight_config = {
-            "RANK_WEIGHT": 0.4,
+            "RANK_WEIGHT": 0.6,
             "FREQUENCY_WEIGHT": 0.3,
-            "HOTNESS_WEIGHT": 0.3,
+            "HOTNESS_WEIGHT": 0.1,
         }
 
     # 默认时间转换函数
```

**File**: `trendradar/utils/__init__.py` (modified, +1/-2)
```diff
@@ -10,7 +10,7 @@
     get_current_time_display,
     convert_time_for_display,
 )
-from trendradar.utils.url import normalize_url, get_url_signature
+from trendradar.utils.url import normalize_url
 
 __all__ = [
     "get_configured_time",
@@ -19,5 +19,4 @@
     "get_current_time_display",
     "convert_time_for_display",
     "normalize_url",
-    "get_url_signature",
 ]
```

---

### Incident Patch 14: `13b32184` (2026-03-26)
**Commit Message**: fix(docker): 修复 MCP Dockerfile uv 依赖安装

**File**: `docker/Dockerfile.mcp` (modified, +11/-6)
```diff
@@ -2,16 +2,21 @@ FROM python:3.12-slim-bookworm
 
 WORKDIR /app
 
-# 安装依赖（uv + lock 文件 hash 校验）
+# 从官方镜像拷贝 uv 二进制
+COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/
+
+# 先安装依赖（利用 Docker 层缓存）
 COPY pyproject.toml uv.lock ./
-RUN pip install --no-cache-dir uv && \
-    uv pip install --system --frozen --no-cache && \
-    pip uninstall -y uv
+RUN --mount=type=cache,target=/root/.cache/uv \
+    uv sync --locked --no-install-project --no-dev
 
-# 复制 MCP 服务器代码
+# 复制 MCP 服务器代码和 trendradar 模块
 COPY mcp_server/ ./mcp_server/
-# 复制 trendradar 模块（MCP 服务需要读取 SQLite 数据）
 COPY trendradar/ ./trendradar/
+RUN --mount=type=cache,target=/root/.cache/uv \
+    uv sync --locked --no-dev
+
+ENV PATH="/app/.venv/bin:$PATH"
 
 # 创建必要目录
 RUN mkdir -p /app/config /app/output
```

---

### Incident Patch 15: `24ba6038` (2026-03-26)
**Commit Message**: fix(docker): 修复 uv 依赖安装

**File**: `docker/Dockerfile` (modified, +11/-3)
```diff
@@ -50,13 +50,21 @@ RUN set -ex && \
     apt-get clean && \
     rm -rf /var/lib/apt/lists/*
 
+# 从官方镜像拷贝 uv 二进制
+COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/
+
+# 先安装依赖（利用 Docker 层缓存）
 COPY pyproject.toml uv.lock ./
-RUN pip install --no-cache-dir uv && \
-    uv pip install --system --frozen --no-cache && \
-    pip uninstall -y uv
+RUN --mount=type=cache,target=/root/.cache/uv \
+    uv sync --locked --no-install-project --no-dev
 
+# 再复制项目代码并安装项目本身
 COPY docker/manage.py .
 COPY trendradar/ ./trendradar/
+RUN --mount=type=cache,target=/root/.cache/uv \
+    uv sync --locked --no-dev
+
+ENV PATH="/app/.venv/bin:$PATH"
 
 # 复制 entrypoint.sh 并强制转换为 LF 格式
 COPY docker/entrypoint.sh /entrypoint.sh.tmp
```

**File**: `uv.lock` (modified, +1/-1)
```diff
@@ -1996,7 +1996,7 @@ wheels = [
 
 [[package]]
 name = "trendradar"
-version = "6.5.2"
+version = "6.5.3"
 source = { editable = "." }
 dependencies = [
     { name = "boto3" },
```

#### Recent Merged Pull Requests:
- **PR #1228** (closed): Update (@imqp)
- **PR #1227** (closed): merge (@ducduong-dev)
- **PR #1225** (closed): pull (@snow-sprite)
- **PR #1223** (closed): 0924 (@liukiii)
- **PR #1211** (closed): pull (@hellostone)
- **PR #1206** (closed): 未进行消息合并的修复 (@liuyishou9911)
- **PR #1196** (closed): feat: 每日推送 GitHub 热门仓库与 Hacker News 到飞书 (@bhrajate)
- **PR #1193** (closed): feat: add breeding news monitoring and AI summaries (@zzzseeu)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

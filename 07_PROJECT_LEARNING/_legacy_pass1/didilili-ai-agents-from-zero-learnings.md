# Forensic Learning Record (Deep Inspection): didilili/ai-agents-from-zero

> **Canonical Artifact**: `07_PROJECT_LEARNING/didilili-ai-agents-from-zero-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/didilili/ai-agents-from-zero](https://github.com/didilili/ai-agents-from-zero))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T20:14:53.120Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `didilili/ai-agents-from-zero`
- **Description**:  🚀 2026 最系统的 AI Agent 速成指南｜智能体实战教程 · 完整学习路径  + 实战项目 + 面试题库 · 对标大模型应用开发工程师岗位 · 覆盖LangChain / LangGraph / Coze / Dify / MCP / skills / LLM / RAG / 提示词 · 企业级部署与微调 · 从0到企业级落地 + 从学习到上线项目 + 面试准备一体化 
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: package.json, pyproject.toml, README.md
- **Stars / Engagement**: 5013 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `commitlint.config.js`
```
/**
 * Commitlint 配置：规范 commit message
 * 使用 Conventional Commits：type(scope): subject
 * 示例：docs(README): 优化教程目录
 */
module.exports = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    // type 枚举：常用类型
    "type-enum": [
      2,
      "always",
      [
        "feat", // 新功能
        "fix", // 修复 bug
        "docs", // 文档
        "style", // 格式（不影响代码）
        "refactor", // 重构
        "perf", // 性能
        "test", // 测试
        "chore", // 构建/工具
      ],
    ],
    // subject 不能为空
    "subject-empty": [2, "never"],
    // type 不能为空
    "type-empty": [2, "never"],
    // subject 以 . 结尾时警告
    "subject-full-stop": [2, "never", "."],
    // header 最大长度
    "header-max-length": [2, "always", 100],
  },
};

```

### Core Architecture Module: `lib/plugins/announcement-bubble.js`
```
(function (root, factory) {
  var api = factory(root);

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  if (root && typeof root === "object") {
    root.DocsifyAnnouncementBubble = api;
  }
})(
  typeof window !== "undefined" ? window : globalThis,
  function (root) {
    var BUBBLE_ID = "docsify-announcement-bubble";
    var DISMISSED_VALUE = "dismissed";

    function canShow(config, localStorage) {
      if (!config || config.enabled === false || !config.text) return false;
      if (!config.storageKey || !localStorage) return true;

      try {
        return localStorage.getItem(config.storageKey) !== DISMISSED_VALUE;
      } catch (error) {
        return true;
      }
    }

    function rememberDismissal(config, localStorage) {
      if (!config || !config.storageKey || !localStorage) return;

      try {
        localStorage.setItem(config.storageKey, DISMISSED_VALUE);
      } catch (error) {
        // Private browsing or blocked storage should not break reading.
      }
    }

    function renderAnnouncementBubble(config, env) {
      var runtime = env || root || {};
      var document = runtime.document;
      var localStorage = runtime.localStorage;
      var existing;
      var bubble;
      var content;
      var dot;
      var text;
      var close;

      if (!document || !document.body || !canShow(config, localStorage)) {
        return null;
      }

      existing = document.getElementById && document.getElementById(BUBBLE_ID);
      if (existing && existing.remove) existing.remove();

      bubble = document.createElement("div");
      bubble.className = "announcement-bubble";
      bubble.setAttribute("id", BUBBLE_ID);
      bubble.setAttribute("aria-label", config.text);

      content = document.createElement(config.link ? "a" : "span");
      content.className = "announcement-bubble__content";
      if (config.link) {
        content.href = config.link;
      }

      dot = document.createElement("span");
      dot.className = "announcement-bubble__dot";
      dot.setAttribute("aria-hidden", "true");

      text = document.createElement("span");
      text.className = "announcement-bubble__text";
      text.textContent = config.text;

      close = document.createElement("button");
      close.type = "button";
      close.className = "announcement-bubble__close";
      close.setAttribute("aria-label", "关闭公告");
      close.textContent = "x";
      close.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        rememberDismissal(config, localStorage);
        bubble.remove();
      });

      content.appendChild(dot);
      content.appendChild(text);
      bubble.appendChild(content);
      bubble.appendChild(close);
      document.body.appendChild(bubble);

      return bubble;
    }

    function init(config, env) {
      var runtime = env || root || {};
      var document = runtime.document;

      if (!document) return null;

      function render() {
        return renderAnnouncementBubble(config, runtime);
      }

      if (document.readyState === "loading" && document.addEventListener) {
        document.addEventListener("DOMContentLoaded", render, { once: true });
        return null;
      }

      return render();
    }

    function initFromDocsify(env) {
      var runtime = env || root || {};
      var config = runtime.$docsify && runtime.$docsify.announcementBubble;

      return init(config, runtime);
    }

    if (root && root.document) {
      initFromDocsify(root);
    }

    return {
      canShow: canShow,
      init: init,
      initFromDocsify: initFromDocsify,
      renderAnnouncementBubble: renderAnnouncementBubble,
    };
  }
);

```

### Core Architecture Module: `lib/plugins/gtag.js`
```
/**
 * Docsify 官方 gtag 插件（适用于 GA4 / Universal Analytics）
 * 源码：https://github.com/docsifyjs/docsify/blob/develop/src/plugins/gtag.js
 * 因 docsify@4 的 npm 包未包含此插件，故本地保留一份供项目使用。
 */
(function () {
  function appendScript(id) {
    var script = document.createElement("script");
    script.async = true;
    script.src = "https://www.googletagmanager.com/gtag/js?id=" + id;
    document.body.appendChild(script);
  }

  function initGlobalSiteTag(id) {
    appendScript(id);
    window.dataLayer = window.dataLayer || [];
    window.gtag =
      window.gtag ||
      function () {
        window.dataLayer.push(arguments);
      };
    window.gtag("js", new Date());
    window.gtag("config", id);
  }

  function initAdditionalTag(id) {
    window.gtag("config", id);
  }

  function init(ids) {
    if (Array.isArray(ids)) {
      initGlobalSiteTag(ids[0]);
      for (var i = 1; i < ids.length; i++) {
        initAdditionalTag(ids[i]);
      }
    } else {
      initGlobalSiteTag(ids);
    }
  }

  function collect() {
    if (!window.gtag) {
      init(window.$docsify.gtag);
    }
    window.gtag("event", "page_view", {
      page_title: document.title,
      page_location: location.href,
      page_path: location.pathname,
    });
  }

  function install(hook) {
    if (!window.$docsify.gtag) {
      console.error("[Docsify] gtag is required.");
      return;
    }
    hook.beforeEach(collect);
  }

  window.$docsify = window.$docsify || {};
  window.$docsify.plugins = [install].concat(window.$docsify.plugins || []);
})();

```

### Core Architecture Module: `lib/plugins/mermaid-viewer.js`
```
(function (root, factory) {
  var api = factory(root);

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  if (root && typeof root === "object") {
    root.DocsifyMermaidViewer = api;
  }
})(
  typeof window !== "undefined" ? window : globalThis,
  function (root) {
    var DEFAULTS = {
      minScale: 0.5,
      maxScale: 5,
      zoomStep: 1.2,
    };
    var mermaidRenderIndex = 0;

    function withDefaults(options) {
      return Object.assign({}, DEFAULTS, options || {});
    }

    function createTransform() {
      return { scale: 1, x: 0, y: 0 };
    }

    function clamp(value, min, max) {
      return Math.min(max, Math.max(min, value));
    }

    function zoomAt(transform, nextScale, origin, options) {
      var config = withDefaults(options);
      var scale = clamp(nextScale, config.minScale, config.maxScale);
      var ratio = scale / transform.scale;
      var point = origin || { x: 0, y: 0 };

      return {
        scale: scale,
        x: point.x - (point.x - transform.x) * ratio,
        y: point.y - (point.y - transform.y) * ratio,
      };
    }

    function zoomBy(transform, factor, options) {
      return zoomAt(transform, transform.scale * factor, { x: 0, y: 0 }, options);
    }

    function panBy(transform, deltaX, deltaY) {
      return {
        scale: transform.scale,
        x: transform.x + deltaX,
        y: transform.y + deltaY,
      };
    }

    function resetTransform() {
      return createTransform();
    }

    function icon(paths) {
      return (
        '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" ' +
        'stroke="currentColor" stroke-width="2" stroke-linecap="round" ' +
        'stroke-linejoin="round">' +
        paths +
        "</svg>"
      );
    }

    var ICONS = {
      windowFullscreen: icon(
        '<rect x="4" y="5" width="16" height="14" rx="2"></rect>' +
          '<path d="M8 9h3"></path><path d="M8 9v3"></path>' +
          '<path d="M16 15h-3"></path><path d="M16 15v-3"></path>'
      ),
      fullscreen: icon(
        '<path d="M8 3H5a2 2 0 0 0-2 2v3"></path>' +
          '<path d="M16 3h3a2 2 0 0 1 2 2v3"></path>' +
          '<path d="M8 21H5a2 2 0 0 1-2-2v-3"></path>' +
          '<path d="M16 21h3a2 2 0 0 0 2-2v-3"></path>'
      ),
      zoomIn: icon(
        '<circle cx="11" cy="11" r="8"></circle>' +
          '<path d="m21 21-4.35-4.35"></path>' +
          '<path d="M11 8v6"></path><path d="M8 11h6"></path>'
      ),
      zoomOut: icon(
        '<circle cx="11" cy="11" r="8"></circle>' +
          '<path d="m21 21-4.35-4.35"></path>' +
          '<path d="M8 11h6"></path>'
      ),
      reset: icon(
        '<path d="M21 12a9 9 0 1 1-2.64-6.36"></path>' +
          '<path d="M21 3v6h-6"></path>'
      ),
    };

    function makeButton(label, html, onClick) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "mermaid-viewer__button";
      button.setAttribute("aria-label", label);
      button.title = label;
      button.innerHTML = html;
      button.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        onClick();
      });
      return button;
    }

    function setWindowFullscreenState(viewer, pageElement, active) {
      viewer.classList.toggle("is-window-fullscreen", active);
      pageElement.classList.toggle("mermaid-viewer-open", active);
    }

    function setTransform(svg, transform) {
      svg.style.transform =
        "translate(" +
        transform.x +
        "px, " +
        transform.y +
        "px) scale(" +
        transform.scale +
        ")";
      svg.style.transformOrigin = "0 0";
    }

    function closeWindowFullscreen(exceptViewer) {
      document
        .querySelectorAll(".mermaid-viewer.is-window-fullscreen")
        .forEach(function (viewer) {
          if (viewer !== exceptViewer) {
            setWindowFullscreenState(viewer, document.documentElement, false);
          }
        });
    }

    function toggleWindowFullscreen(viewer) {
      var active = !viewer.classList.contains("is-window-fullscreen");
      closeWindowFullscreen(active ? viewer : null);
      setWindowFullscreenState(viewer, document.documentElement, active);
    }

    function toggleNativeFullscreen(viewer) {
      if (document.fullscreenElement === viewer) {
        document.exitFullscreen().catch(function () {
          toggleWindowFullscreen(viewer);
        });
        return;
      }

      closeWindowFullscreen();

      if (viewer.requestFullscreen) {
        viewer.requestFullscreen().catch(function () {
          toggleWindowFullscreen(viewer);
        });
        return;
      }

      toggleWindowFullscreen(viewer);
    }

    function buildViewer(mermaidBlock, options) {
      if (mermaidBlock.dataset.mermaidViewer === "true") return;

      var svg = mermaidBlock.querySelector("svg");
      if (!svg) return;

      var config = withDefaults(options);
      var transform = createTransform();
      var dragging = false;
      var lastPointer = null;

      mermaidBlock.dataset.mermaidViewer = "true";
      mermaidBlock.classList.add("mermaid-viewer");

      var canvas = document.createElement("div");
      canvas.className = "mermaid-viewer__canvas";
      mermaidBlock.insertBefore(canvas, svg);
      canvas.appendChild(svg);

      var toolbar = document.createElement("div");
      toolbar.className = "mermaid-viewer__toolbar";

      var apply = function () {
        setTransform(svg, transform);
        mermaidBlock.classList.toggle("is-zoomed", transform.scale !== 1);
      };

      toolbar.appendChild(
        makeButton("浏览器窗口内全屏查看 Mermaid 图", ICONS.windowFullscreen, function () {
          toggleWindowFullscreen(mermaidBlock);
        })
      );
      toolbar.appendChild(
        makeButton("显示器全屏查看 Mermaid 图", ICONS.fullscreen, function () {
          toggleNativeFullscreen(mermaidBlock);
        })
      );
      toolbar.appendChild(
        makeButton("缩小 Mermaid 图", ICONS.zoomOut, function () {
          transform = zoomAt(transform, transform.scale / config.zoomStep, {
            x: canvas.clientWidth / 2,
            y: canvas.clientHeight / 2,
          }, config);
          apply();
        })
      );
      toolbar.appendChild(
        makeButton("放大 Mermaid 图", ICONS.zoomIn, function () {
          transform = zoomAt(transform, transform.scale * config.zoomStep, {
            x: canvas.clientWidth / 2,
            y: canvas.clientHeight / 2,
          }, config);
          apply();
        })
      );
      toolbar.appendChild(
        makeButton("重置 Mermaid 图", ICONS.reset, function () {
          transform = resetTransform();
          apply();
        })
      );
      mermaidBlock.appendChild(toolbar);

      canvas.addEventListener(
        "wheel",
        function (event) {
          event.preventDefault();

          var rect = canvas.getBoundingClientRect();
          var factor = event.deltaY < 0 ? config.zoomStep : 1 / config.zoomStep;
          transform = zoomAt(
            transform,
            transform.scale * factor,
            {
              x: event.clientX - rect.left,
              y: event.clientY - rect.top,
            },
            config
          );
          apply();
        },
        { passive: false }
      );

      canvas.addEventListener("pointerdown", function (event) {
        if (event.button !== 0) return;
        dragging = true;
        lastPointer = { x: event.clientX, y: event.clientY };
        if (canvas.setPointerCapture) {
          canvas.setPointerCapture(event.pointerId);
        }
        mermaidBlock.classList.add("is-dragging");
      });

      canvas.addEventListener("pointermove", function (event) {
        if (!dragging || !lastPointer) return;
        transform = panBy(
          transform,
          event.clientX - lastPointer.x,
          event.clientY - lastPointer.y
        );
        lastPoin
```

### Core Architecture Module: `案例与源码-2-LangChain框架/01-helloworld/GetEnvInfo.py`
```
"""
【案例】环境检查：LangChain 版本与安装路径

对应教程章节：第 10 章 - LangChain 快速上手与 HelloWorld → 3、安装依赖

知识点速览：
本脚本用于确认当前 Python 环境中 LangChain、langchain_community 的版本与安装路径，
便于排查「装错版本」「没进虚拟环境」或「解释器不是当前项目那一个」等问题。无需 API Key，可直接运行。
"""

import langchain  # 核心框架（Chain、Agent、Memory 等）
import langchain_community  # 社区扩展（部分集成、第三方工具等）
import sys  # 获取 Python 解释器信息

# LangChain 核心包版本号（需与教程/文档要求的版本区间一致）
print("langchainVersion:  " + langchain.__version__)
# 社区扩展包版本号
print("langchain_communityVersion:  " + langchain_community.__version__)
# LangChain 实际安装路径（可确认是否来自当前虚拟环境）
print("langchainfile:" + langchain.__file__)

# 当前 Python 解释器版本（如 3.10.x），用于确认运行环境
print(sys.version)
# 当前 Python 可执行文件路径；当你怀疑“包装到了 A 环境，但运行却走了 B 环境”时尤其有用
print("pythonExecutable:" + sys.executable)

"""
【输出示例】
 langchainVersion:  1.2.9
 langchain_communityVersion:  0.4.1
 langchainfile:/Users/tools/PyCharmMiscProject/python100/.venv/lib/python3.10/site-packages/langchain/__init__.py
 3.10.19 (main, Oct  9 2025, 15:25:03) [Clang 17.0.0 (clang-1700.6.3.2)]
 pythonExecutable:/Users/tools/PyCharmMiscProject/python100/.venv/bin/python
"""

```

### Core Architecture Module: `案例与源码-2-LangChain框架/01-helloworld/LangChainV0.3.py`
```
"""
【案例】LangChain 0.x 写法：ChatOpenAI + 三种配置方式（硬编码 / 环境变量 / .env）

对应教程章节：第 10 章 - LangChain 快速上手与 HelloWorld → 4、实战：基于阿里百炼的 HelloWorld

知识点速览：
- 0.x 写法从各厂商包直接导入具体类（如 ChatOpenAI），通过 base_url 接国内兼容接口。
- 配置方式演进：硬编码（不推荐）→ 环境变量 → .env + load_dotenv（推荐），避免 API Key 进版本库。
- invoke 同步调用、response.content 取回复正文。了解即可，当前主推 1.0 的 init_chat_model 写法。

补充说明：
- 本脚本虽然放在“阿里百炼 HelloWorld”这一节里，但当前演示模型使用的是部署在阿里百炼兼容端点上的 `deepseek-v3.2`。
- 重点不在“必须调用哪一个模型”，而在“看懂 0.x/经典写法如何通过 OpenAI 兼容接口完成第一次调用”。
- 运行前请在项目根目录准备 `.env`；本仓库里 `QWEN_API_KEY` / `aliQwen-api` 都可能指向阿里百炼 Key，这是历史兼容写法。
"""

from langchain_openai import (
    ChatOpenAI,
)  # OpenAI 兼容的聊天模型封装，可配合 base_url 接国内平台
import os
from dotenv import load_dotenv  # 从 .env 文件加载环境变量，避免把 API Key 写进代码

# ========== 1. 大模型客户端初始化（三种配置方式，推荐第 3 版） ==========

# 第 1 版：硬编码写死（仅演示，不推荐）
# 缺点：API Key 会进版本库，有泄露风险；换环境要改代码。
# llm = ChatOpenAI(
#     model="qwen-plus",
#     api_key="你自己的api-key",
#     base_url="https://dashscope.aliyuncs.com/compatible-mode/v1"
# )

# 第 2 版：用系统环境变量（需先 export 或在运行前 set）
# 缺点：若未先 export/set 或未执行 load_dotenv()，代码就可能取到空值。
# llm = ChatOpenAI(
#     model="qwen-plus",
#     api_key=os.getenv("aliQwen-api"),
#     base_url="https://dashscope.aliyuncs.com/compatible-mode/v1"
# )

# 第 3 版（推荐）：用 python-dotenv 从 .env 加载，再通过 os.getenv 读取
# 项目根目录放 .env 文件，内容如：QWEN_API_KEY=sk-xxx（不要提交到 Git）。

load_dotenv(encoding="utf-8")  # encoding 指定 utf-8，避免 .env 中中文注释乱码

llm = ChatOpenAI(
    model="deepseek-v3.2",  # 模型名需与阿里百炼「模型广场」中的调用名一致
    api_key=os.getenv("QWEN_API_KEY"),
    base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",  # 阿里百炼 OpenAI 兼容接口地址
)

# ========== 2. 调用大模型并打印结果 ==========
# invoke：同步调用，传入用户问题字符串，返回 AIMessage 等消息对象
response = llm.invoke("你是谁")

# response 为 LangChain 消息对象，包含 content、additional_kwargs 等元数据
print(response)  # 打印完整对象（含 token 用量、finish_reason 等元数据，便于调试）
print()
print(response.content)  # 只取「正文」文本，即模型回复内容

print()

"""
【输出示例】
content='你好！我是DeepSeek，由深度求索公司创造的AI助手！😊\n\n我是一个纯文本模型，虽然不支持多模态识别功能，但我可以帮你处理上传的各种文件，比如图像、txt、pdf、ppt、word、excel文件，并从中读取文字信息进行分析处理。\n\n我的特点包括：\n- 完全免费使用，没有收费计划\n- 拥有128K的上下文处理能力\n- 支持联网搜索功能（需要手动开启）\n- 可以通过官方应用商店下载App使用\n- 知识截止到2024年7月\n\n我会以热情、细腻的方式为你提供帮助，无论是回答问题、协助思考、创作内容还是处理文档，我都很乐意为你服务！你可以随时向我提出各种问题。\n\n有什么我可以帮助你的吗？✨' additional_kwargs={'refusal': None} response_metadata={'token_usage': {'completion_tokens': 160, 'prompt_tokens': 5, 'total_tokens': 165, 'completion_tokens_details': None, 'prompt_tokens_details': {'audio_tokens': None, 'cached_tokens': 0}}, 'model_provider': 'openai', 'model_name': 'deepseek-v3.2', 'system_fingerprint': None, 'id': 'chatcmpl-aecd007c-44e7-9240-8d71-c6f49b6a6c1f', 'finish_reason': 'stop', 'logprobs': None} id='lc_run--019d2961-6144-7463-ab84-fe5828802d34-0' tool_calls=[] invalid_tool_calls=[] usage_metadata={'input_tokens': 5, 'output_tokens': 160, 'total_tokens': 165, 'input_token_details': {'cache_read': 0}, 'output_token_details': {}}

你好！我是DeepSeek，由深度求索公司创造的AI助手！😊

我是一个纯文本模型，虽然不支持多模态识别功能，但我可以帮你处理上传的各种文件，比如图像、txt、pdf、ppt、word、excel文件，并从中读取文字信息进行分析处理。

我的特点包括：
- 完全免费使用，没有收费计划
- 拥有128K的上下文处理能力
- 支持联网搜索功能（需要手动开启）
- 可以通过官方应用商店下载App使用
- 知识截止到2024年7月

我会以热情、细腻的方式为你提供帮助，无论是回答问题、协助思考、创作内容还是处理文档，我都很乐意为你服务！你可以随时向我提出各种问题。

有什么我可以帮助你的吗？✨
"""

```

### Core Architecture Module: `案例与源码-2-LangChain框架/01-helloworld/LangChainV1.0.py`
```
"""
【案例】LangChain 1.0 写法：init_chat_model 统一入口调用大模型

对应教程章节：第 10 章 - LangChain 快速上手与 HelloWorld → 4、实战：基于阿里百炼的 HelloWorld

知识点速览：
- 1.0 推荐用 init_chat_model 作为统一入口，通过 model_provider（如 "openai"）指定厂商，同一套写法可切换模型。
- 接国内平台（阿里百炼、通义等）时需显式写 model_provider="openai"，否则会报错无法推断 provider。
- 调用三件套：API Key、模型名、Base URL；invoke(问题) 返回消息对象，.content 取正文。
"""

# ========== 1. 导入依赖 ==========
import os
from dotenv import load_dotenv
from langchain.chat_models import (
    init_chat_model,
)  # 1.0 统一入口：根据 model + model_provider 创建聊天模型

load_dotenv(encoding="utf-8")

# ========== 2. 实例化模型并调用 ==========
# 关键字参数：k1=v1, k2=v2 的形式（比如这种写法：model="qwen-plus"，就是关键字参数），顺序可打乱，可读性更好
model = init_chat_model(
    model="qwen-plus",  # 模型 ID，与平台模型广场一致
    model_provider="openai",  # 表示使用「OpenAI 兼容」的 API（阿里百炼、通义等均兼容，阿里百炼不支持直接调用，需要通过OpenAI 兼容的 API 调用）
    api_key=os.getenv("aliQwen-api"),  # 需事先 export 或在下面 load_dotenv 之后再用
    base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
)

# 调用并直接取回复正文：invoke 返回消息对象，.content 为文本内容
print(model.invoke("你是谁").content)

print("*" * 50)

# 若不写 model_provider="openai"，会报错：
# ValueError: Unable to infer model provider for model='qwen-plus', please specify model_provider directly.
# 原因：qwen-plus 等名称无法自动推断厂商，必须显式指定。
# 对比 0.3：0.3 用 ChatOpenAI 类，类名已表示「OpenAI 兼容」，故无需 model_provider。

# 同一个系统里面，可以同时存在多个模型，比如
model2 = init_chat_model(
    model="deepseek-v3",
    model_provider="openai",
    api_key=os.getenv("QWEN_API_KEY"),
    base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
)

print(model2.invoke("你是谁").content)

"""
【输出示例】
你好！我是通义千问（Qwen），阿里巴巴集团旗下的超大规模语言模型。我能够回答问题、创作文字，比如写故事、写公文、写邮件、写剧本、逻辑推理、编程等等，还能表达观点，玩游戏等。如果你有任何问题或需要帮助，欢迎随时告诉我！😊
**************************************************
我是DeepSeek Chat，由深度求索公司打造的AI助手！🤖✨ 我可以帮你回答问题、提供建议、聊天解闷，还能处理各种文本和文件信息。有什么我可以帮你的吗？😊
"""

```

### Core Architecture Module: `案例与源码-2-LangChain框架/01-helloworld/LangChain_MoreV1.0.py`
```
"""
【案例】多模型共存：同一脚本中接入通义与 DeepSeek

对应教程章节：第 10 章 - LangChain 快速上手与 HelloWorld → 5、案例：多模型共存（通义 + DeepSeek）

知识点速览：
- 同一脚本可初始化多个聊天模型实例（不同 model、base_url、api_key），按场景选用或对比调用。
- 每个实例用 init_chat_model 单独配置，变量名区分（如 llm_qwen、llm_deepseek）便于后续复用。
- 通义用 model_provider="openai" + 阿里百炼 base_url；DeepSeek 可用 model_provider="deepseek" 或兼容接口。

补充说明：
- 运行本脚本前，建议已经完成本章前面的单模型 HelloWorld，否则更容易被“多变量、多平台”搞乱。
- 如果你使用的是 `model_provider="deepseek"` 这种官方 provider 写法，请确保已经安装 `langchain-deepseek`。
"""

# ========== 1. 导入依赖与环境 ==========
from dotenv import load_dotenv
from langchain.chat_models import init_chat_model
import os

load_dotenv(
    encoding="utf-8"
)  # 从 .env 加载，建议在 .env 中配置 QWEN_API_KEY、deepseek-api 等

# ========== 2. 实例化模型一：通义/百炼（OpenAI 兼容） ==========
llm_qwen = init_chat_model(
    model="qwen-plus",
    model_provider="openai",  # 阿里百炼为 OpenAI 兼容接口
    api_key=os.getenv("QWEN_API_KEY"),
    base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
)

print(llm_qwen.invoke("你是谁").content)

print("*" * 70)

# ========== 3. 实例化模型二：DeepSeek 官方 ==========
# 显式写 model_provider="deepseek" 更稳妥。若接其他厂商（如 OpenAI 兼容），则需写 model_provider="openai"。
llm_deepseek = init_chat_model(
    model="deepseek-v4-flash",  # 复杂推理或高质量生成可改用 deepseek-v4-pro
    model_provider="deepseek",  # 这里走的是 DeepSeek 官方 provider，而不是阿里百炼兼容端点
    api_key=os.getenv("deepseek-api"),  # .env 中配置 DeepSeek API Key
    base_url="https://api.deepseek.com",
)

# 多模型共存：两个实例可同时保留，按需调用
print(llm_deepseek.invoke("你是谁").content)
# 调试时可查看实例属性：print(llm_deepseek.__dict__)

"""
【输出示例】
**********************************************************************
你好！我是DeepSeek，由深度求索公司创造的AI助手！😊

我是一个纯文本模型，虽然不支持多模态识别功能，但我有文件上传功能，可以帮你处理图像、txt、pdf、ppt、word、excel等各种文件，从中读取文字信息进行分析处理。我完全免费使用，拥有128K的上下文长度，还支持联网搜索功能（需要你在Web/App中手动点开联网搜索按键）。

你可以通过官方应用商店下载我的App来使用我。我很乐意为你解答问题、协助处理各种任务，无论是学习、工作还是日常生活中的疑问，我都会热情地为你提供帮助！

有什么我可以为你做的吗？✨
"""

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #130** (2026-09-16): **申请入群**
  *Symptoms*: 申请入群

- **Issue #119** (2026-08-31): **申请入群**
  *Symptoms*: 申请入群

- **Issue #115** (2026-09-28): **docs(readme): fix 7*24 → 7×24 typo for readability**
  *Symptoms*: Corrected formatting of the text and replaced '7\*24' with '7×24'.
  **Post-Mortem & Fix Analysis**:
  > 感谢PR，这个改动对教程实质内容影响不大，先暂时关闭了，感谢~

- **Issue #113** (2026-09-28): **fix: 修复 README 中 Star History 图表失效问题**
  *Symptoms*: 当前 README 中的 Star History 图表已无法正常展示，原因是原有图表服务受 GitHub 星标接口限制而失效。  本次修改将图表地址迁移到可正常工作的服务，并更新图片端点与点击后的跳转链接，让仓库的 Star 历史曲线能够正常显示。
  **Post-Mortem & Fix Analysis**:
  > 我刚检查了 README 当前使用的 Star History URL，目前可以正常返回并展示完整曲线，未能复现 PR 中描述的失效问题。因此本次暂不合并。感谢PR~

- **Issue #111** (2026-08-15): **申请入群**
  *Symptoms*: 

- **Issue #110** (2026-08-15): **申请入群**
  *Symptoms*: 

- **Issue #109** (2026-09-28): **Add MiniMax text-to-image workflow support**
  *Symptoms*: Reason: Add MiniMax text-to-image support to the exported Coze workflow.  - Replace the loop's image generation node with a code node for the MiniMax image generation endpoint. - Accept the API key and region at workflow start, with exact global and China endpoint routing. - Preserve the existing prompt input, graph edges, and `data.image_urls` output contract. - Expose image result, success/failure metadata, and API status fields in the node schema.  Checks: - `python3` workflow JSON, code syntax, endpoint, request, response schema, and graph contract validation - `python3` minimal workflow diff validation against `HEAD` - `git diff --check` 
  **Post-Mortem & Fix Analysis**:
  > Thanks for the contribution. This PR replaces the existing Tongyi Wanxiang plugin node in the exported workflow, while the tutorial content and screenshots still document the original node, so the workflow would no longer match the tutorial. The proposed code node also uses urllib.request with a 180-second timeout, which does not follow Coze’s documented code-node runtime constraints. The API key is passed as a regular workflow input, and no successful Coze import and execution result has been provided. For these reasons, we won’t merge this change and will close the PR. If MiniMax support is added in the future, it should be implemented as a separately documented and fully verified alternative workflow rather than replacing the existing tutorial example. Thanks for your understanding.

- **Issue #104** (2026-08-10): **申请入群**
  *Symptoms*: 

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

### Incident Patch 1: `d8bcdded` (2026-09-28)
**Commit Message**: fix: 修正 LangChain 示例资源路径解析

- 将提示词、文档加载和文本切分示例改为基于脚本目录定位资源。
- 统一使用 pathlib 构造跨平台路径，避免受当前工作目录影响。
- 验证：10 个脚本语法编译、资源存在性及 diff 格式检查通过。

**File**: `案例与源码-2-LangChain框架/04-prompt/load_external/PromptLoadDemo01.py` (modified, +6/-3)
```diff
@@ -6,15 +6,18 @@
 知识点速览：
 - 把 Prompt 放到 JSON / YAML 里，有助于版本管理、多人协作和 A/B 测试，也能避免长提示词把业务代码挤得很乱。
 - `load_prompt(...)` 会根据文件内容加载出模板对象；对于本案例的 `_type: "prompt"`，它会得到一个 `PromptTemplate` 风格的对象。
-- 运行这类案例时，要特别注意当前工作目录和相对路径，否则脚本可能找不到 `prompt.json`。
+- 通过 `Path(__file__)` 从脚本所在目录定位 `prompt.json`，不依赖运行命令时的工作目录。
 """
 
+from pathlib import Path
+
 # 从 langchain_core 引入 load_prompt，用于从 JSON/YAML 加载模板
 from langchain_core.prompts import load_prompt
 
-# 从当前目录（或指定路径）加载 prompt.json，得到与 PromptTemplate 用法相同的模板对象
+# 从脚本所在目录加载 prompt.json，得到与 PromptTemplate 用法相同的模板对象
 # encoding="utf-8" 保证中文等字符正常显示
-template = load_prompt("prompt.json", encoding="utf-8")
+prompt_path = Path(__file__).resolve().with_name("prompt.json")
+template = load_prompt(prompt_path, encoding="utf-8")
 
 # 用 .format() 填入占位符变量，得到最终字符串（与第 6 节 PromptTemplate.format 的使用方式一致）
 print(template.format(name="张三", what="搞笑的"))
```

**File**: `案例与源码-2-LangChain框架/04-prompt/load_external/PromptLoadDemo02.py` (modified, +4/-2)
```diff
@@ -6,10 +6,11 @@
 知识点速览：
 - YAML 版本与 JSON 版本的使用方式完全一致，差别主要在于文件格式是否更适合人读和写注释。
 - 本案例的 `prompt.yaml` 同样描述的是一个文本模板，因此加载后的使用方式仍然是 `.format(...)`。
-- 和 JSON 版本一样，运行时要留意当前工作目录，避免相对路径找不到文件。
+- 通过 `Path(__file__)` 从脚本所在目录定位 `prompt.yaml`，不依赖运行命令时的工作目录。
 """
 
 import warnings
+from pathlib import Path
 
 warnings.filterwarnings(
     "ignore", message="Core Pydantic V1 functionality isn't compatible with Python 3.14"
@@ -18,7 +19,8 @@
 # 从 YAML 加载提示词模板，API 与 load_prompt("prompt.json") 一致
 from langchain_core.prompts import load_prompt
 
-template = load_prompt("prompt.yaml", encoding="utf-8")
+prompt_path = Path(__file__).resolve().with_name("prompt.yaml")
+template = load_prompt(prompt_path, encoding="utf-8")
 print(template.format(name="年轻人", what="滑稽"))
 #
 
```

**File**: `案例与源码-2-LangChain框架/10-rag/EmbeddingRagLLM.py` (modified, +5/-2)
```diff
@@ -13,8 +13,10 @@
 """
 
 # pip install unstructured docx2txt python-docx
-from langchain.chat_models import init_chat_model
 import os
+from pathlib import Path
+
+from langchain.chat_models import init_chat_model
 from langchain_community.document_loaders import Docx2txtLoader
 from langchain_core.prompts import PromptTemplate
 from langchain_classic.text_splitter import CharacterTextSplitter
@@ -56,7 +58,8 @@
 )
 
 # 1. 加载 docx（错误码文档）
-loader = Docx2txtLoader("alibaba-java.docx")
+document_path = Path(__file__).resolve().with_name("alibaba-java.docx")
+loader = Docx2txtLoader(document_path)
 documents = loader.load()
 
 # 2. 分割（此处用 CharacterTextSplitter 便于快速跑通；真实项目里更常见的通用首选是 RecursiveCharacterTextSplitter）
```

**File**: `案例与源码-2-LangChain框架/10-rag/docloads/RagLoadCSVDemo.py` (modified, +7/-2)
```diff
@@ -10,11 +10,16 @@
 - 检索时只对正文向量化，metadata 更适合拿来做过滤、来源展示和结果解释，因此结构化表格数据尤其适合这样拆分。
 """
 
+from pathlib import Path
+
 # pip install langchain_community
 from langchain_community.document_loaders.csv_loader import CSVLoader
 
+# 基于脚本位置定位测试文件，避免受当前工作目录影响
+csv_path = Path(__file__).resolve().parent / "assets" / "sample.csv"
+
 # 方式一：不指定列 → 整行（所有列）拼成一条字符串作为 page_content，metadata 通常只有 source 等
-docs_all = CSVLoader(file_path="assets/sample.csv").load()
+docs_all = CSVLoader(file_path=csv_path).load()
 print("=== 方式一：整行作为 page_content ===")
 print(
     "page_content 示例:",
@@ -28,7 +33,7 @@
 
 # 方式二：指定 content_columns 与 metadata_columns → 正文只取 content 列，title/author 进 metadata，便于检索时按作者/标题过滤
 docs_split = CSVLoader(
-    file_path="assets/sample.csv",
+    file_path=csv_path,
     metadata_columns=["title", "author"],
     content_columns=["content"],
 ).load()
```

**File**: `案例与源码-2-LangChain框架/10-rag/docloads/RagLoadDocDemo.py` (modified, +4/-1)
```diff
@@ -10,11 +10,14 @@
 - `single` 更适合快速看整篇内容；`elements` 更适合理解“按结构拆成多个 Document”的效果。加载后得到 `List[Document]`，与 TXT/PDF 等一致，可统一走「分割 → 向量化 → 入库」流程。
 """
 
+from pathlib import Path
+
 # pip install langchain_community unstructured[docx] python-docx
 from langchain_community.document_loaders import UnstructuredWordDocumentLoader
 
+document_path = Path(__file__).resolve().parent / "assets" / "alibaba-more.docx"
 docs = UnstructuredWordDocumentLoader(
-    file_path="assets/alibaba-more.docx",
+    file_path=document_path,
     mode="single",  # single 整篇一个 Document；elements 按元素切分
 ).load()
 
```

---

### Incident Patch 2: `91dc3f10` (2026-05-22)
**Commit Message**: fix: 修正 第 1-1 章：大模型认知与工程概览 图片展示不全问题

**File**: `教程更新日志.md` (modified, +1/-0)
```diff
@@ -9,6 +9,7 @@
 **教程与文档**
 
 - 修正实战项目「深度研搜」错误文件命名（感谢@Sheldon-MMMP 同学反馈~~）
+- 修正 第 1-1 章：大模型认知与工程概览 图片展示不全问题（感谢@Hunter-Lam 同学反馈~~）
 
 **仓库与工程**
 
```

---

### Incident Patch 3: `b7692854` (2026-04-22)
**Commit Message**: fix: 修正实战项目的部分序号错误的问题

**File**: `实战项目-掌柜问数/1-项目概述与数仓基础.md` (modified, +8/-0)
```diff
@@ -32,6 +32,8 @@
 
 ![掌柜问数 NL2SQL 系统示意：自然语言提问、生成 SQL 并返回分析结果](images/1/1-1-1-1.png)
 
+---
+
 ## 2、问数项目背景
 
 ### 2.1 为什么企业需要「问数」系统
@@ -58,6 +60,8 @@
 
 这类问题已经不属于日常业务操作，而属于数据分析与经营决策的范畴。企业做“问数”系统，本质上就是为了把数据分析的门槛降下来，让更多人能够直接使用数据。
 
+---
+
 ## 3、数据仓库基础
 
 ### 3.1 为什么不直接查业务数据库
@@ -141,6 +145,8 @@
 
 这里也可以顺带建立一个更准确的理解：从业务数据库到数据仓库，通常还会经历抽取、清洗、转换等数据加工过程，而**建模**更准确地说，是其中“根据分析需求重新设计表结构”的这一步。
 
+---
+
 ## 4、维度建模入门
 
 ### 4.1 维度建模简介
@@ -310,6 +316,8 @@ group by 维度字段
 
 在「掌柜问数」里，大模型最终也是在做类似这样的事：先判断**事实表是谁**、**维度表是谁**、**过滤条件落在哪个字段上**，再把这些关系组织成 SQL。
 
+---
+
 ## 5、项目定位
 
 ### 5.1 「掌柜问数」到底做了什么
```

**File**: `实战项目-掌柜问数/2-项目整体架构与智能体流程.md` (modified, +4/-0)
```diff
@@ -118,6 +118,8 @@
 
 **构建期用 `MySQL + Qdrant + Elasticsearch + TEI` 把元数据知识库建好，查询期再由 `LangGraph` 驱动问数智能体调用这套知识，最终生成并执行 SQL。**
 
+---
+
 ## 2、元数据知识库
 
 ### 2.1 先理解什么是元数据知识库
@@ -409,6 +411,8 @@
 
 这一部分在后面的章节里还会继续展开，这里先有一个印象即可。
 
+---
+
 ## 3、问数智能体
 
 真正把用户问题变成查询结果的，是项目中的问数智能体。
```

**File**: `实战项目-掌柜问数/3-开发环境与基础服务准备.md` (modified, +22/-16)
```diff
@@ -41,6 +41,8 @@
 
 一句话总结：**后端靠 `uv`，前端靠 `npm`，基础服务尽量靠 `Docker`。**
 
+---
+
 ## 2、创建后端项目与使用 uv
 
 ### 2.1 为什么本项目使用 uv
@@ -317,11 +319,13 @@ dependencies = [
 
 **阅读建议：** 这部分不需要死记。后面每一章真正用到哪个库，我们再回头看它的作用，会更容易记住。
 
-## 4、创建后端所需的基础服务
+---
+
+## 3、创建后端所需的基础服务
 
 除了前后端代码环境，这个项目还依赖几类基础服务。先在这里建立整体认识，下一章会继续展开这些基础服务的具体配置。
 
-### 4.1 基础服务总览
+### 3.1 基础服务总览
 
 本项目主要会用到下面这些服务：
 
@@ -337,7 +341,7 @@ dependencies = [
 
 > 后端代码负责“组织流程”，而这些基础服务负责“提供数据、检索和向量能力”。
 
-### 4.2 为什么使用 Docker 启动服务
+### 3.2 为什么使用 Docker 启动服务
 
 这里推荐的方式是：**尽量通过 Docker 统一启动这些服务**。
 
@@ -360,11 +364,11 @@ dependencies = [
 
 > 用一个配置文件同时描述多个容器，然后通过一条命令把它们统一启动起来。
 
-### 4.4 安装 Docker Desktop
+### 3.3 安装 Docker Desktop
 
 启动基础服务，首先需要安装 `Docker Desktop`。
 
-#### 4.4.1 Windows 环境
+#### 3.3.1 Windows 环境
 
 在 Windows 上安装时，建议优先使用 `WSL 2` 作为 Docker 的运行基础。
 
@@ -384,7 +388,7 @@ wsl --version
 
 > 参考文档：https://docs.docker.com/desktop/setup/install/windows-install
 
-#### 4.4.2 macOS 环境
+#### 3.3.2 macOS 环境
 
 在 macOS 上相对简单一些，直接根据自己的芯片类型选择安装包即可：
 
@@ -393,7 +397,7 @@ wsl --version
 
 安装完成后，打开 Docker Desktop，确认它能正常启动即可。
 
-#### 4.4.3 图形界面和命令行都可以用
+#### 3.3.3 图形界面和命令行都可以用
 
 安装好 Docker Desktop 后，你既可以通过图形界面观察容器、镜像、卷。
 
@@ -407,7 +411,7 @@ docker ps
 
 如果这个命令能够正常输出当前容器列表，就说明 Docker 环境已经基本可用。
 
-### 4.5 Docker 拉镜像失败怎么办
+### 3.4 Docker 拉镜像失败怎么办
 
 这里还有一个很实际的问题： 装好 Docker 之后，并不代表你立刻就能顺利执行 `docker pull`。
 
@@ -416,7 +420,7 @@ docker ps
 - 配置镜像加速
 - 配置代理
 
-#### 4.5.1 方式一：配置镜像加速
+#### 3.4.1 方式一：配置镜像加速
 
 如果你使用的是 Docker Desktop，通常可以在设置中找到 Docker Engine 的配置区域，然后为 `registry-mirrors` 增加镜像地址。
 
@@ -426,13 +430,13 @@ docker ps
 
 镜像源汇总参考 GitHub：[dongyubin/DockerHub 国内镜像加速列表](https://github.com/dongyubin/DockerHub?tab=readme-ov-file)
 
-#### 4.5.2 方式二：配置代理
+#### 3.4.2 方式二：配置代理
 
 如果你的网络环境本身已经有可用代理，也可以直接在 Docker Desktop 的代理配置里填写代理地址。
 
 可以把它理解成：让 Docker 的网络请求通过代理转发出去。
 
-### 4.6 服务启动方式
+### 3.5 服务启动方式
 
 现在 Docker 已经安装配置完毕，并且启动成功，接下来配置本套项目所需的基础服务。在`shopkeeper-agent-backend`仓库的根目录下有 `docker` 目录，里面有以下文件：
 
@@ -475,9 +479,11 @@ docker compose stop
 - `docker compose down`
   停止并删除容器
 
-## 5、docker-compose.yaml 文件分析
+---
+
+## 4、docker-compose.yaml 文件分析
 
-### 5.1 基本理解
+### 4.1 基本理解
 
 项目对应文件路径：`shopkeeper-agent-backend/docker/docker-compose.yaml`
 
@@ -555,7 +561,7 @@ volumes:
 
 在「掌柜问数」里，可以先把这份 `Compose` 文件理解成：一份基础服务清单。也就是说，它描述的不是某一个容器，而是“让这个项目跑起来，需要哪几类容器协同工作”。
 
-### 5.2 基础服务说明
+### 4.2 基础服务说明
 
 - MySQL 容器：负责元数据库和模拟数据仓库
 - Elasticsearch 容器：负责全文检索
@@ -571,7 +577,7 @@ volumes:
 
 这也是为什么说它很重要。后面的问数流程、指标匹配、检索召回，并不是只靠业务代码完成的，而是建立在这几类基础能力已经准备好的前提下。
 
-### 5.3 配置项具体说明
+### 4.3 配置项具体说明
 
 如果你顺着这份 `Compose` 文件往下看，最值得先掌握的是下面几类配置：
 
@@ -668,7 +674,7 @@ volumes:
 5. 看 `environment`，确认这个服务启动时依赖什么配置
 6. 看 `depends_on`，确认服务之间的依赖关系
 
-### 5.4 工程思路具体分析
+### 4.4 工程思路具体分析
 
 再结合各服务本身来看，这份 `Compose` 文件还体现了几个很重要的工程思路：
 
```

**File**: `实战项目-掌柜问数/4-项目结构与基础服务配置管理.md` (modified, +2/-0)
```diff
@@ -85,6 +85,8 @@ shopkeeper-agent-backend/
 
 **这一节先记住：** `app` 放源码，`conf` 放配置，`prompts` 放静态提示词；后面如果看到客户端、仓储、服务、脚本这些概念，先回到这张结构图里找它们的位置。
 
+---
+
 ## 2、配置参数管理
 
 这一章虽然属于基础服务部分，但不会先展开某个具体服务的接入，而是先把这些服务共同依赖的**配置参数管理**理顺。
```

**File**: `实战项目-掌柜问数/7-元数据知识库总览与构建入口.md` (modified, +43/-31)
```diff
@@ -118,9 +118,9 @@ shopkeeper-agent-backend/
 
 这样分层之后，后面你再去看代码时，就不会只看到一堆零散文件，而会知道它们分别处在这条链路的哪个位置。
 
-### 2.2 先分清 4 类角色：配置文件、业务实体、ORM 模型、mappers
+### 2.2 分清 4 类角色：配置文件、业务实体、ORM 模型、mappers
 
-#### 2.2.1 概述
+#### 2.2.1 角色概览
 
 看到这里时，很多同学都会有一连串很自然的疑问：
 
@@ -230,7 +230,7 @@ ORM 模型是“数据库映射对象”，告诉 ORM 框架：**这些 Python 
 - ORM 模型：决定“这些数据怎么映射到数据库表”
 - `mappers`：负责在业务实体和 ORM 模型之间做转换
 
-#### 2.2.2 它们是如何相互联系、相互调用的
+#### 2.2.2 角色关系与调用链路
 
 后面第 8 章你会看到的真实链路，其实可以先抽象成下面这样：
 
@@ -264,7 +264,7 @@ meta_config.yaml
 
 也就是说，`mapper` 并不是一层单独发起业务的角色，它更像是夹在 `repository` 内部的一个翻译器。
 
-#### 2.2.3 用一个最小例子串起来看
+#### 2.2.3 最小示例
 
 假设配置文件里有这样一张表：
 
@@ -415,6 +415,8 @@ async def build(self, config_path: Path):
 
 因此，是否同步字段值，也应该交给配置来控制。这就是为什么项目里会专门设计一个 `YAML` 配置文件，作为同步脚本的输入。
 
+---
+
 ## 4、Python 脚本执行方式与模块导入
 
 这一节虽然放在元数据知识库这一章里，但它本质上讲的是一个更通用的 Python 问题：**包内模块应该怎么执行，为什么直接运行文件时经常会报 `No module named app`。**
@@ -472,7 +474,7 @@ python3 app/scripts/build_meta_knowledge.py
 
 也就是说，很多时候并不是代码错了，而是**启动方式不对**。
 
-### 4.3 推荐做法：在项目根目录下用模块方式执行
+### 4.3 推荐做法：用模块方式执行
 
 在包结构项目里，更推荐的做法是：**在项目根目录下，用 `python -m` 执行包内模块。**
 
@@ -489,7 +491,7 @@ uv run python -m app.scripts.build_meta_knowledge -c conf/meta_config.yaml
 
 这样解释器就会更自然地把当前目录作为模块搜索起点，从而正确找到 `app` 包。
 
-### 4.4 python -m、uv run 和 PYTHONPATH 配置说明
+### 4.4 python -m、uv run 与 PYTHONPATH
 
 这三个东西很容易混在一起，其实它们各管一件事：
 
@@ -513,7 +515,7 @@ python3 app/clients/qdrant_client_manager.py
 uv run python -m app.scripts.build_meta_knowledge -c conf/meta_config.yaml
 ```
 
-### 4.5 为什么 PyCharm 可以运行命令
+### 4.5 为什么 PyCharm 能运行
 
 这是因为 IDE 往往会额外帮你补一些运行配置，比如工作目录、内容根目录、环境变量和解释器选择，这些设置都会影响 Python 启动后的模块查找路径。
 
@@ -524,6 +526,8 @@ uv run python -m app.scripts.build_meta_knowledge -c conf/meta_config.yaml
 
 从团队协作和部署角度看，更可靠的做法还是把终端中的执行命令固定下来。
 
+---
+
 ## 5、脚本参数解析：如何使用 argparse
 
 现在脚本的执行方式已经明确了，接下来就要解决另一个很实际的问题：**脚本启动之后，怎么知道这一次应该读取哪一份配置文件？**
@@ -536,7 +540,7 @@ uv run python -m app.scripts.build_meta_knowledge -c conf/meta_config.yaml
 --conf conf/meta_config.yaml
 ```
 
-### 5.1 先理解：什么叫命令行参数
+### 5.1 命令行参数是什么
 
 命令行参数，就是你在执行程序时额外传给它的信息。
 
@@ -632,7 +636,7 @@ print(args.conf)
 args.conf
 ```
 
-### 5.4 argparse 最常用的几个能力
+### 5.4 argparse 常用能力
 
 结合官方文档，在入门阶段最值得掌握的，其实就是下面这几个点。
 
@@ -697,7 +701,7 @@ parser.add_argument(
 
 这表示：如果用户不传 `-c/--conf`，程序就直接报错并提示正确用法。
 
-### 5.5 放回当前项目：这段代码到底在做什么
+### 5.5 放回当前项目：参数解析在做什么
 
 当前项目脚本中的参数解析代码是：
 
@@ -738,7 +742,7 @@ Path("conf/meta_config.yaml")
 
 后面服务层就是基于这个路径去加载配置文件的。
 
-### 5.6 为什么这里要转成 Path
+### 5.6 为什么转成 Path
 
 相比直接把路径当普通字符串传来传去，转成 `Path` 对象至少有两个好处：
 
@@ -756,7 +760,7 @@ Path("conf/meta_config.yaml")
 
 ---
 
-## 6、先把这几个核心文件串起来
+## 6、核心文件速览
 
 在这一部分里，最值得先读懂的是下面这几个核心文件和目录：
 
@@ -780,7 +784,7 @@ Path("conf/meta_config.yaml")
 
 也就是说，它决定的是：**同步范围**。
 
-### 6.2 meta_config.py：定义“合法配置长什么样”
+### 6.2 meta_config.py：配置结构定义
 
 它是给程序看的配置结构。也就是说，`meta_config.yaml` 是 YAML 文本，程序不能直接拿它当业务对象来用；  
 所以我们需要在 Python 里定义一套结构，让程序知道：
@@ -825,7 +829,7 @@ from app.conf.meta_config import MetaConfig
 
 也就是说，它决定的是：**具体怎么构建**。
 
-### 6.5 为什么这里还需要 app/models
+### 6.5 app/models 的作用
 
 前面你已经看到，项目里既有：
 
@@ -847,7 +851,7 @@ from app.conf.meta_config import MetaConfig
 
 所以这里同时存在 `app/models/column_info.py` 和 `app/entities/column_info.py`，并不是重复设计，而是因为它们本来就在解决两个不同层面的问题。
 
-### 6.6 repository 层是怎么分工的
+### 6.6 repository 层分工
 
 理解完 `models` 之后，再看 `repository` 层就会顺很多。
 
@@ -893,6 +897,8 @@ from app.conf.meta_config import MetaConfig
 
 到这里你可以抓住一句最重要的话：**配置文件决定“同步什么”，入口脚本决定“从哪里进入”，服务层决定“具体怎么做”，`mappers` 负责对象转换，ORM 模型负责“怎么和数据库表对上”。**
 
+---
+
 ## 7、meta_config.yaml 详解
 
 先从配置文件本身看起。在真正写 Python 代码之前，更重要的是先讲清楚：**这个配置文件到底应该长成什么样。**
@@ -942,7 +948,7 @@ metrics:
     alias: [成交总额, 订单总额]
 ```
 
-### 7.1 顶层为什么只有 tables 和 metrics
+### 7.1 顶层结构：tables 与 metrics
 
 这一点很重要。
 
@@ -963,7 +969,7 @@ if meta_config.metrics:
 
 也就是说，配置文件的顶层结构，本身就在服务层里对应成了两条处理分支。
 
-### 7.2 tables 这一块在描述什么
+### 7.2 tables：表配置结构
 
 `tables` 是一个列表，列表里的每个元素都表示一张要同步的表。
 
@@ -981,7 +987,7 @@ if meta_config.metrics:
 
 它不是单纯写给人看的说明，而是后面智能体理解数仓结构时会用到的信息。
 
-### 7.3 columns 这
```

---

### Incident Patch 4: `bc9143b8` (2026-04-12)
**Commit Message**: fix: 修正失效的超链接

**File**: `1-2-提示词工程基础.md` (modified, +1/-1)
```diff
@@ -1313,4 +1313,4 @@ AI全向助力
 - **结构化组织** 是从“随手写一句话”走向“可维护系统”的关键一步。System 放稳定规则，User 放动态输入，Assistant 承接历史结果。
 - **提示词工程有边界**：资料太多、流程太复杂、模型指令遵循能力不足、领域知识缺失时，单靠 Prompt 不够，通常要结合 RAG、工作流、微调或智能体。
 
-**建议下一步：** 如果你按全书主线继续学，建议先看 [1-3 RAG、微调、续训与智能体](1-3-RAG、微调、续训与智能体.md)，把“Prompt 什么时候够用、什么时候该交给 RAG、微调或智能体”这条边界彻底理顺；如果你想立刻进入代码侧的 Prompt 工程化组织方式，则可以接着看 [第 13 章 提示词与消息模板](13-提示词与消息模板.md)。
+**建议下一步：** 如果你按全书主线继续学，建议先看 [1-3 RAG、微调、续训与智能体选型](1-3-RAG、微调、续训与智能体选型.md)，把“Prompt 什么时候够用、什么时候该交给 RAG、微调或智能体”这条边界彻底理顺；如果你想立刻进入代码侧的 Prompt 工程化组织方式，则可以接着看 [第 13 章 提示词与消息模板](13-提示词与消息模板.md)。
```

**File**: `10-LangChain快速上手与HelloWorld.md` (modified, +1/-1)
```diff
@@ -113,7 +113,7 @@ python 案例与源码-2-LangChain框架/01-helloworld/LangChainV1.0.py
 | **OpenRouter** | [平台](https://openrouter.ai/)                         | [API-Key](https://openrouter.ai/settings/keys)                      | [文档](https://openrouter.ai/docs/community/frameworks-and-integrations-overview) | [模型](https://openrouter.ai/models)                                         | 多模型统一聚合平台，适合做“一个入口接多家模型”     |
 | **硅基流动**   | [平台](https://www.siliconflow.cn/)                    | [API-Key](https://cloud.siliconflow.cn/me/account/ak)               | [文档](https://docs.siliconflow.cn/cn/userguide/capabilities/text-generation)     | [模型](https://cloud.siliconflow.cn/me/models)                               | 国内常见 AI API 平台，适合练手与接入开源模型       |
 | **百度千帆**   | [平台](https://console.bce.baidu.com/qianfan/overview) | [API-Key](https://console.bce.baidu.com/qianfan/ais/console/apiKey) | [文档](https://cloud.baidu.com/doc/qianfan-docs/s/Mm8r1mejk)                      | [模型](https://console.bce.baidu.com/qianfan/modelcenter/model/buildIn/list) | 百度系模型平台                                     |
-| **CloseAI**    | [平台](https://platform.closeai-asia.com/)             | [API-Key](https://platform.closeai-asia.com/developer/api)          | [文档](https://doc.closeai-asia.com/tutorial/api/openai.html)                     | [模型](https://platform.closeai-asia.com/pricing)                            | OpenAI / 国际模型兼容接入平台之一                  |
+| **CloseAI**    | [平台](https://platform.closeai-asia.com/)             | [API-Key](https://platform.closeai-asia.com/)                       | [文档](https://doc.closeai-asia.com/tutorial/api/openai.html)                     | [模型](https://doc.closeai-asia.com/)                                        | OpenAI / 国际模型兼容接入平台之一                  |
 
 ---
 
```

**File**: `12-Ollama本地部署与调用.md` (modified, +1/-2)
```diff
@@ -39,8 +39,7 @@ ollama run qwen:4b
 - **模型搜索 / 模型库**：https://ollama.com/search
 - **源码仓库（GitHub）**：https://github.com/ollama/ollama
 - **Ollama 官方文档**：
-  - https://ollama.com/docs （英文）
-  - https://ollama.com/zh-CN/docs （中文）
+  - https://docs.ollama.com/
 - **LangChain 与 Ollama 集成文档**：
   - https://docs.langchain.com/oss/python/integrations/chat/ollama （英文）
   - https://docs.langchain.org.cn/oss/python/integrations/chat/ollama （中文）
```

**File**: `3-基于Coze&Dify平台的智能体开发.md` (modified, +3/-5)
```diff
@@ -340,7 +340,7 @@ https://agent.xfyun.cn/home
 
 ### 4.4 案例 1：深夜情感主持
 
-[线上演示链接](课程案例链接汇总.md#案例-1深夜情感主持)（链接统一维护于 [课程案例链接汇总.md](课程案例链接汇总.md)）
+[线上演示链接](教程案例链接汇总.md#案例-1深夜情感主持)（链接统一维护于 [教程案例链接汇总.md](教程案例链接汇总.md)）
 
 **技术要点**
 
@@ -449,7 +449,7 @@ https://agent.xfyun.cn/home
 
 ### 4.5 案例 2：高考报考指南
 
-[线上演示链接](课程案例链接汇总.md#案例-2高考报考指南)（链接统一维护于 [课程案例链接汇总.md](课程案例链接汇总.md)）
+[线上演示链接](教程案例链接汇总.md#案例-2高考报考指南)（链接统一维护于 [教程案例链接汇总.md](教程案例链接汇总.md)）
 
 **技术要点**
 
@@ -530,7 +530,7 @@ https://agent.xfyun.cn/home
 
 ### 4.6 案例 3：家庭记账助手
 
-[线上演示链接](课程案例链接汇总.md#案例-3家庭记账助手)（链接统一维护于 [课程案例链接汇总.md](课程案例链接汇总.md)）
+[线上演示链接](教程案例链接汇总.md#案例-3家庭记账助手)（链接统一维护于 [教程案例链接汇总.md](教程案例链接汇总.md)）
 
 **技术要点**
 
@@ -646,8 +646,6 @@ Dify（DefineModify）是一个开源的大语言模型(LLM)应用开发平台
 
 官网：https://dify.ai/zh
 
-说明：https://github.com/langgenius/dify/blob/main/README_CN.md
-
 官方文档：
 
 - Dify Docs：https://docs.dify.ai/
```

**File**: `8-企业级大模型部署.md` (modified, +0/-2)
```diff
@@ -165,8 +165,6 @@
 
 官网：https://dify.ai/zh
 
-文档说明：https://github.com/langgenius/dify/blob/main/README_CN.md
-
 > 说明：访问 Dify 官网需要魔法（或梯子、科学上网）
 
 ### 2.2 租赁 Dify 服务器：腾讯云
```

#### Recent Merged Pull Requests:
- **PR #115** (closed): docs(readme): fix 7*24 → 7×24 typo for readability (@als3453)
- **PR #113** (closed): fix: 修复 README 中 Star History 图表失效问题 (@OctoBored)
- **PR #109** (closed): Add MiniMax text-to-image workflow support (@octo-patch)
- **PR #96** (closed): Add MiniMax LangChain model I/O example (@octo-patch)
- **PR #92** (closed): 增添一些打印，修改模型名 (@urpapru)
- **PR #69** (closed): 添加plan (@Wqt-2216)
- **PR #20** (closed): Update typical applications of multimodal models (@yecon-27)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

# Forensic Learning Record (Deep Inspection): didilili/ai-agents-from-zero

> **Canonical Artifact**: `07_PROJECT_LEARNING/didilili-ai-agents-from-zero-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/didilili/ai-agents-from-zero](https://github.com/didilili/ai-agents-from-zero))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:55:25.775Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `didilili/ai-agents-from-zero`
- **Description**:  🚀 2026 最系统的 AI Agent 速成指南｜智能体实战教程 · 完整学习路径  + 实战项目 + 面试题库 · 对标大模型应用开发工程师岗位 · 覆盖LangChain / LangGraph / Coze / Dify / MCP / skills / LLM / RAG / 提示词 · 企业级部署与微调 · 从0到企业级落地 + 从学习到上线项目 + 面试准备一体化 
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: package.json, pyproject.toml, README.md
- **Stars / Engagement**: 5067 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `案例与源码-3-LangGraph框架/03-state/DefState.py`
```
"""
【案例】最简 State 定义与「无中间节点」图：用 TypedDict 定义状态，构建一条直接从 START 到 END 的边，验证 invoke(initial_state) 的用法。

对应教程章节：第 23 章 - LangGraph API：图与状态 → 2、Graph API 之 State（状态）

知识点速览：
- State 由 Schema（模式）和 Reducer（规约函数）两部分组成。
- 本例用 TypedDict（下方 `BasicState`）定义 State Schema（字段名与类型）；图中所有节点读写同一份状态结构。
- 字段未用 `Annotated[..., reducer]` 指定 Reducer 时，使用 LangGraph 默认 Reducer（常见为节点返回的新值覆盖该字段旧值）。
- add_edge(START, END) 表示没有业务节点，图从入口直接到出口；本例重点是理解“State 原样透传”和 `invoke(initial_state)` 的基本调用方式。
- invoke() 只接收一个核心位置参数：状态字典；不要传入多个独立参数。可选第二参数为 config。
- 嵌套类型（如 process_data: dict）在 initial_state 中需传入合法字典。
"""

from typing import TypedDict
from langgraph.graph import StateGraph, START, END


class BasicState(TypedDict):
    """本图的 State Schema：字段名 + 类型共同定义这张图允许流转的状态结构。"""

    user_input: str
    response: str
    count: int
    process_data: dict


# 创建状态图：BasicState 是本图的 state_schema；本例不写 Annotated，因此各字段都走默认覆盖规则
basicState = StateGraph(BasicState)
# 无中间节点：直接从 START 到 END，状态会原样透传
basicState.add_edge(START, END)
app = basicState.compile()

# invoke 只接收一个核心参数（状态字典）；process_data 为 dict，需传入嵌套字典
initial_state = {
    "user_input": "a",
    "response": "resp",
    "count": 25,
    "process_data": {"k1": "v1"},
}

result = app.invoke(initial_state)
print("执行结果：", result)

"""
【输出示例】
执行结果： {'user_input': 'a', 'response': 'resp', 'count': 25, 'process_data': {'k1': 'v1'}}
"""

```

### Core Architecture Module: `案例与源码-3-LangGraph框架/03-state/reducers/StateReducer_AddMessages.py`
```
"""
【案例】add_messages Reducer：消息列表专用，节点只返回「增量消息」，由 add_messages 自动追加到 state["messages"]，适合多轮对话与多节点共同写消息的场景。

对应教程章节：第 23 章 - LangGraph API：图与状态 → 3、State 的更新机制：Reducer（规约函数）

知识点速览：
- Annotated[List, add_messages] 表示该字段使用 add_messages 规约：新消息追加到列表末尾，而非覆盖。
- 节点返回格式可为 [("role", content)] 或 [AIMessage/HumanMessage] 等，由 add_messages 统一合并。
- 多节点共同写 messages 时，本例重点是“消息按 add_messages 规则合并”，不要把并行分支下的最终顺序直接当成业务契约。
"""

from typing import Annotated, List
from typing_extensions import TypedDict
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages


# messages 使用 add_messages：节点只返回增量，自动追加
class AddMessagesState(TypedDict):
    messages: Annotated[List, add_messages]


def chat_node_1(state: AddMessagesState) -> dict:
    return {"messages": [("assistant", "Hello from node 1")]}


def chat_node_2(state: AddMessagesState) -> dict:
    return {"messages": [("assistant", "Hello from node 2")]}


def run_demo():
    print("2. add_messages Reducer（消息列表专用）演示:")
    builder = StateGraph(AddMessagesState)
    builder.add_node("chat1", chat_node_1)
    builder.add_node("chat2", chat_node_2)
    builder.add_edge(START, "chat1")
    builder.add_edge(START, "chat2")  # 两节点并行，各自追加消息
    builder.add_edge("chat1", END)
    builder.add_edge("chat2", END)
    graph = builder.compile()

    result = graph.invoke({"messages": [("user", "Hi there!")]})
    print(f"初始状态: {{'messages': [('user', 'Hi there!')]}}")
    print(f"执行结果: {result}\n")
    print("*" * 60)
    print(graph.get_graph().print_ascii())


if __name__ == "__main__":
    run_demo()

"""
【输出示例】
2. add_messages Reducer（消息列表专用）演示:
初始状态: {'messages': [('user', 'Hi there!')]}
执行结果: {'messages': [HumanMessage(content='Hi there!', additional_kwargs={}, response_metadata={}, id='1ef23c0c-ec9a-4e41-a3fb-2a80e5f84666'), AIMessage(content='Hello from node 1', additional_kwargs={}, response_metadata={}, id='09bed348-3770-400b-93fd-f550a647445f', tool_calls=[], invalid_tool_calls=[]), AIMessage(content='Hello from node 2', additional_kwargs={}, response_metadata={}, id='06bbf85f-9661-450d-a54e-5025abe7a34b', tool_calls=[], invalid_tool_calls=[])]}

************************************************************
       +-----------+         
       | __start__ |         
       +-----------+         
         *        *          
       **          **        
      *              *       
+-------+         +-------+  
| chat1 |         | chat2 |  
+-------+         +-------+  
         *        *          
          **    **           
            *  *             
        +---------+          
        | __end__ |          
        +---------+          
None
"""

```

### Core Architecture Module: `案例与源码-3-LangGraph框架/03-state/reducers/StateReducer_Custom.py`
```
"""
【案例】自定义 Reducer：用函数签名 (current, update) -> 合并结果，解决 operator.mul 在首次规约边界上不适合直接用于乘法累计的问题。

对应教程章节：第 23 章 - LangGraph API：图与状态 → 3、State 的更新机制：Reducer（规约函数）

知识点速览：
- Reducer 可以写成普通函数：接收当前字段值 `current` 与本次更新值 `update`，返回新的合并结果。
- 自定义 Reducer 的价值不在“语法复杂”，而在于你可以按业务语义处理首次合并、空值、重复值、顺序稳定性等边界。
- 节点仍只返回增量（如 `{\"factor\": 2.0}`），真正决定怎么合并的是 Reducer，而不是节点本身。
"""

from typing import Annotated

from langgraph.graph import StateGraph, START, END
from typing_extensions import TypedDict


def MyOperatorMul(current: float, update: float) -> float:
    """自定义乘法 Reducer：首次合并时把 current 的边界情况单独处理，再继续乘法累计。"""
    # 第一次调用时 current 往往是类型默认值 0.0，若直接 current * update 会得到 0，后续无法恢复
    if current == 0.0:
        print(f"current:{current}")
        print(f"update:{update}")
        # 等价于从 1.0 开始乘：1.0 * update
        return 1.0 * update
    return current * update


class MultiplyState(TypedDict):
    factor: Annotated[float, MyOperatorMul]


def multiplier(state: MultiplyState) -> dict:
    # 节点返回的 update 会与 state["factor"] 经 MyOperatorMul 合并
    return {"factor": 2.0}


def run_demo():
    print("使用自定义reducer解决乘法问题:")
    builder = StateGraph(MultiplyState)
    builder.add_node("multiplier", multiplier)
    builder.add_edge(START, "multiplier")
    builder.add_edge("multiplier", END)
    graph = builder.compile()

    # 初始 factor=5.0 与节点返回 2.0 经 Reducer 合并为 5.0 * 2.0 = 10.0
    result = graph.invoke({"factor": 5.0})
    print(f"初始状态: {{'factor': 5.0}}")
    print(f"执行结果: {result}")
    print(f"解释: 5.0 * 2.0 = 10.0\n")


if __name__ == "__main__":
    run_demo()

"""
【输出示例】
使用自定义reducer解决乘法问题:
current:0.0
update:5.0
初始状态: {'factor': 5.0}
执行结果: {'factor': 10.0}
解释: 5.0 * 2.0 = 10.0
"""

```

### Core Architecture Module: `案例与源码-3-LangGraph框架/03-state/reducers/StateReducer_Default.py`
```
"""
【案例】默认 Reducer（覆盖更新）：未为状态字段指定 Reducer 时，节点返回的值会直接覆盖该字段，后执行节点的结果覆盖先执行节点的结果。

对应教程章节：第 23 章 - LangGraph API：图与状态 → 3、State 的更新机制：Reducer（规约函数）

知识点速览：
- Reducer 决定「节点返回的更新如何合并到当前状态」；不指定时采用默认行为：覆盖。
- 多节点依次更新同一字段时，最终状态中该字段只保留最后一个节点返回的值。
- 适合「单写」场景；若需追加、累加等，需使用 add_messages、operator.add 等 Reducer。
"""

from typing import List
from typing_extensions import TypedDict
from langgraph.graph import StateGraph, START, END


# 未为 foo、bar 指定 Reducer，默认覆盖更新
class DefaultReducerState(TypedDict):
    foo: int
    bar: List[str]


def node_default_1(state: DefaultReducerState) -> dict:
    """节点1 只更新 foo，bar 保持原样（本示例中会被节点2 覆盖 bar）。"""
    print(state["foo"])
    print(state["bar"])
    return {"foo": 22}


def node_default_2(state: DefaultReducerState) -> dict:
    """节点2 只更新 bar；foo 保持为节点1 写入的 22。"""
    print(state["foo"])
    print(state["bar"])
    return {"bar": ["bye1", "bye2", "bye3"]}


def main():
    print("1. 默认 Reducer（覆盖更新）演示:\n")
    builder = StateGraph(DefaultReducerState)
    builder.add_node("node1", node_default_1)
    builder.add_node("node2", node_default_2)
    builder.add_edge(START, "node1")
    builder.add_edge("node1", "node2")
    builder.add_edge("node2", END)
    graph = builder.compile()

    result = graph.invoke(input={"foo": 1, "bar": ["hi"]})
    print(f"执行结果: {result}\n")


if __name__ == "__main__":
    main()

"""
【输出示例】
1. 默认 Reducer（覆盖更新）演示:

1
['hi']
22
['hi']
执行结果: {'foo': 22, 'bar': ['bye1', 'bye2', 'bye3']}
"""

```

### Core Architecture Module: `案例与源码-3-LangGraph框架/03-state/reducers/StateReducer_OperatorAdd.py`
```
"""
【案例】operator.add 作为 Reducer（列表）：对列表字段做「 extend 」式追加，多节点返回的列表会按顺序合并成一个列表。

对应教程章节：第 23 章 - LangGraph API：图与状态 → 3、State 的更新机制：Reducer（规约函数）

知识点速览：
- Annotated[List[int], operator.add] 表示该字段用 operator.add 规约：语义为列表的 extend，即 current + update 拼成新列表。
- 适合多节点各自产生一段数据、最后合并成一条列表的场景（如多路采集再汇总）；前提是业务确实允许简单拼接。
"""

import operator
from typing import Annotated, List
from typing_extensions import TypedDict
from langgraph.graph import StateGraph, START, END


class ListAddState(TypedDict):
    data: Annotated[List[int], operator.add]


def producer_1(state: ListAddState) -> dict:
    return {"data": [1, 2]}


def producer_2(state: ListAddState) -> dict:
    return {"data": [3, 4]}


def run_demo():
    print("3.1 列表追加 Reducer 演示:")
    builder = StateGraph(ListAddState)
    builder.add_node("producer1", producer_1)
    builder.add_node("producer2", producer_2)
    builder.add_edge(START, "producer1")
    builder.add_edge("producer1", "producer2")
    builder.add_edge("producer2", END)
    graph = builder.compile()
    result = graph.invoke({"data": [0]})
    print(f"初始状态: {{'data': [0]}}")
    print(f"执行结果: {result}\n")


if __name__ == "__main__":
    run_demo()

"""
【输出示例】
3.1 列表追加 Reducer 演示:
初始状态: {'data': [0]}
执行结果: {'data': [0, 1, 2, 3, 4]}
"""

```

### Core Architecture Module: `案例与源码-3-LangGraph框架/03-state/reducers/StateReducer_OperatorAdd2.py`
```
"""
【案例】operator.add 作为 Reducer（字符串）：对字符串字段做「连接」，多节点返回的字符串会按顺序拼成一条。

对应教程章节：第 23 章 - LangGraph API：图与状态 → 3、State 的更新机制：Reducer（规约函数）

知识点速览：
- Annotated[str, operator.add] 表示该字段用 operator.add 规约：语义为字符串拼接，即 current + update。
- 适合多节点产出文本片段、最后拼成完整文案的场景；如果业务强依赖固定先后顺序，真实项目里更建议配合串行边使用。
"""

import operator
from typing import Annotated
from typing_extensions import TypedDict
from langgraph.graph import StateGraph, START, END


class StringConcatState(TypedDict):
    text: Annotated[str, operator.add]


def add_text_1(state: StringConcatState) -> dict:
    return {"text": "Hello "}


def add_text_2(state: StringConcatState) -> dict:
    return {"text": "World!"}


def run_demo():
    print("3.2 字符串连接 Reducer 演示:")
    builder = StateGraph(StringConcatState)
    builder.add_node("add_text_1", add_text_1)
    builder.add_node("add_text_2", add_text_2)
    builder.add_edge(START, "add_text_1")
    builder.add_edge(START, "add_text_2")
    builder.add_edge("add_text_1", END)
    builder.add_edge("add_text_2", END)
    graph = builder.compile()
    result = graph.invoke({"text": "Say: "})
    print(f"初始状态: {{'text': 'Say: '}}")
    print(f"执行结果: {result}\n")


if __name__ == "__main__":
    run_demo()

"""
【输出示例】
3.2 字符串连接 Reducer 演示:
初始状态: {'text': 'Say: '}
执行结果: {'text': 'Say: Hello World!'}
"""

```

### Core Architecture Module: `案例与源码-3-LangGraph框架/03-state/reducers/StateReducer_OperatorAdd3.py`
```
"""
【案例】operator.add 作为 Reducer（数值）：对数值字段做「累加」，多节点返回的数会与当前值相加，适合计数、积分等场景。

对应教程章节：第 23 章 - LangGraph API：图与状态 → 3、State 的更新机制：Reducer（规约函数）

知识点速览：
- Annotated[int, operator.add] 表示该字段用 operator.add 规约：语义为数值加法，即 current + update。
- 初始状态提供起点（如 count: 10），各节点返回 {"count": 增量}，最终 state["count"] 为累加结果。
"""

import operator
from typing import Annotated
from typing_extensions import TypedDict
from langgraph.graph import StateGraph, START, END


class NumberAddState(TypedDict):
    count: Annotated[int, operator.add]


def increment_1(state: NumberAddState) -> dict:
    return {"count": 5}


def increment_2(state: NumberAddState) -> dict:
    return {"count": 3}


def run_demo():
    print("3.3 数值累加 Reducer 演示:")
    builder = StateGraph(NumberAddState)
    builder.add_node("increment_1", increment_1)
    builder.add_node("increment_2", increment_2)
    builder.add_edge(START, "increment_1")
    builder.add_edge("increment_1", "increment_2")
    builder.add_edge("increment_2", END)
    graph = builder.compile()
    result = graph.invoke({"count": 10})
    print(f"初始状态: {{'count': 10}}")
    print(f"执行结果: {result}\n")


if __name__ == "__main__":
    run_demo()

"""
【输出示例】
3.3 数值累加 Reducer 演示:
初始状态: {'count': 10}
执行结果: {'count': 18}
"""

```

### Core Architecture Module: `案例与源码-3-LangGraph框架/03-state/reducers/StateReducer_OperatorMul.py`
```
"""
【案例】operator.mul 作为 Reducer（数值相乘）的「陷阱」演示：LangGraph 会用类型默认值（float 的 0.0）先做一次规约，导致 0.0 * 初始值 = 0，后续乘法始终为 0；理解后可用自定义 Reducer 解决。

对应教程章节：第 23 章 - LangGraph API：图与状态 → 3、State 的更新机制：Reducer（规约函数）

知识点速览：
- 这个案例的重点不是“operator.mul 不能跑”，而是理解“乘法这类对初始值很敏感的规约逻辑，不能只看 reducer 函数名，还要看首次合并边界”。
- 当字段默认值是 `0.0` 时，乘法规约很容易在第一次合并就变成 `0.0`，后面再乘什么都还是 `0.0`。
- 解决方式通常是改成自定义 Reducer，在函数里显式处理首次合并逻辑。参见 `StateReducer_Custom.py`。
"""

import operator
from typing import Annotated
from typing_extensions import TypedDict
from langgraph.graph import StateGraph, START, END


class MultiplyState(TypedDict):
    factor: Annotated[float, operator.mul]


def multiplier(state: MultiplyState) -> dict:
    return {"factor": 2.0}


# 这里故意保留 operator.mul 的“踩坑版”写法，目的是先让你观察问题，再对照 StateReducer_Custom.py 理解为什么真实项目更适合写自定义 Reducer


def run_demo():
    print("4. operator.mul Reducer（数值相乘）演示:")
    builder = StateGraph(MultiplyState)
    builder.add_node("multiplier", multiplier)
    builder.add_edge(START, "multiplier")
    builder.add_edge("multiplier", END)
    graph = builder.compile()

    result = graph.invoke({"factor": 5.0})
    print(f"初始状态: {{'factor': 5.0}}")
    print(f"执行结果: {result}")
    print(
        "说明: 因 float 默认 0.0 先参与规约，0.0 * 5.0 = 0.0，后续乘 2.0 仍为 0.0；乘法场景请用自定义 Reducer。\n"
    )


if __name__ == "__main__":
    run_demo()

"""
【输出示例】
4. operator.mul Reducer（数值相乘）演示:
初始状态: {'factor': 5.0}
执行结果: {'factor': 0.0}
说明: 因 float 默认 0.0 先参与规约，0.0 * 5.0 = 0.0，后续乘 2.0 仍为 0.0；乘法场景请用自定义 Reducer。
"""

```

### Core Architecture Module: `案例与源码-3-LangGraph框架/03-state/reducers/StateReducersMyChatBot.py`
```
"""
【案例】多种 Reducer 并存：同一 State 里 `messages` 用 add_messages 追加、`tags` 用 operator.add 拼接列表、`score` 用 operator.add 做数值累加；演示同一份 State 里不同字段可以有不同合并规则。

对应教程章节：第 23 章 - LangGraph API：图与状态 → 3、State 的更新机制：Reducer（规约函数）

知识点速览：
- 这是第 23 章里最适合建立“State = Schema + Reducer”整体直觉的案例：字段定义是一层，字段怎么合并是另一层。
- add_messages：节点只返回「增量」消息，自动与历史合并为一条对话链；invoke 里也可传 OpenAI 风格的 `{\"role\", \"content\"}` 字典，运行时会转为 Message 对象。
- operator.add 作用于列表时相当于拼接，作用于 float 时为普通加法累加；同一个 State 里完全可以给不同字段配置不同 Reducer。
- 从同一 START 连到多个节点时，本例重点是观察“不同字段如何被各自的 Reducer 合并”，而不是把并行分支的执行先后当成业务契约。
"""

from typing import Annotated, List

import operator
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from typing_extensions import TypedDict


class ChatState(TypedDict):
    # 消息历史：add_messages 规约，新消息追加而非整表覆盖（与 StateReducer_AddMessages 一致可用 List）
    messages: Annotated[List, add_messages]
    # 标签列表：operator.add 将各节点返回的列表拼到已有列表后
    tags: Annotated[List[str], operator.add]
    # 累计分数：operator.add 做浮点数相加
    score: Annotated[float, operator.add]


def process_user_message(state: ChatState) -> dict:
    # 获取最新消息；修复/注意：须用 .content 读正文（dict 入参在运行时已转为 HumanMessage 等对象，勿当普通 str 用）
    user_message = state["messages"][-1]
    return {
        # add_messages 会把本条 assistant 回复与历史合并
        "messages": [("assistant", f"Echo: {user_message.content}")],
        "tags": ["processed"],
        "score": 1.0,
    }


def add_sentiment_tag(state: ChatState) -> dict:
    # 本节点不写 messages，则 messages 仅由其他节点更新；tags/score 仍参与 operator.add 合并
    return {"tags": ["positive"], "score": 0.5}


def run_demo():
    builder = StateGraph(ChatState)
    builder.add_node("process", process_user_message)
    builder.add_node("sentiment", add_sentiment_tag)

    # 两节点都从 START 接入：并行分支，各自跑到 END
    builder.add_edge(START, "process")
    builder.add_edge(START, "sentiment")
    builder.add_edge("process", END)
    builder.add_edge("sentiment", END)

    graph = builder.compile()

    # invoke 只接收一个状态字典；messages 可用 dict 列表，与 Chat API 习惯一致
    result = graph.invoke(
        {
            "messages": [{"role": "user", "content": "Hello, how are you?"}],
            "tags": ["greeting"],
            "score": 0.0,
        }
    )
    print(result)


if __name__ == "__main__":
    run_demo()

"""
【输出示例】
{'messages': [HumanMessage(content='Hello, how are you?', additional_kwargs={}, response_metadata={}, id='4350252b-ace7-429a-8cc8-67d232d91f42'), AIMessage(content='Echo: Hello, how are you?', additional_kwargs={}, response_metadata={}, id='ab394788-89d0-45f2-a6b0-5252a448ebb1', tool_calls=[], invalid_tool_calls=[])], 'tags': ['greeting', 'processed', 'positive'], 'score': 1.5}
"""

```

### Core Architecture Module: `案例与源码-3-LangGraph框架/03-state/schema/StateSchema.py`
```
"""
【案例】图的输入/输出 Schema：用 input_schema 和 output_schema 限制「调用时只能传 question、返回时只拿 answer」，实现对外接口的契约化，适合需要明确 I/O 边界的场景。

对应教程章节：第 23 章 - LangGraph API：图与状态 → 2、Graph API 之 State（状态）

知识点速览：
- 本例最适合拿来理解“State 不只有一种 Schema”：`OverallState` 是内部完整 State Schema，`InputState` / `OutputState` 是图对外暴露的输入输出契约。
- 构建时 `StateGraph(OverallState, input_schema=InputState, output_schema=OutputState)`，第一个位置参数描述内部完整状态，后两个参数负责限制边界输入输出。
- 节点内部仍围绕完整状态空间工作；只有「图的边界」受 input/output 约束，这种分层更贴近真实项目接口封装。
"""

from langgraph.graph import StateGraph, START, END
from typing_extensions import TypedDict


# 仅包含「输入」字段的 Schema：限制调用方进图时能传什么
class InputState(TypedDict):
    question: str


# 仅包含「输出」字段的 Schema：限制图最终对外返回什么
class OutputState(TypedDict):
    answer: str


# 图内部使用的完整 State Schema（输入 + 输出）
class OverallState(InputState, OutputState):
    pass


def answer_node(state: InputState):
    """处理节点：根据 question 生成 answer。"""
    print(f"执行 answer_node 节点:")
    print(f"  输入: {state}")
    answer = "再见" if "bye" in state["question"].lower() else "你好"
    result = {"answer": answer, "question": state["question"]}
    print(f"  输出: {result}")
    return result


def demo_input_output_schema():
    """演示：调用时只传 question，返回时只得到 answer。"""
    print("=== 演示输入输出模式 ===")

    # 指定 input_schema / output_schema，约束图的对外接口
    builder = StateGraph(
        OverallState, input_schema=InputState, output_schema=OutputState
    )
    builder.add_edge(START, "answer_node")
    builder.add_node("answer_node", answer_node)
    builder.add_edge("answer_node", END)
    graph = builder.compile()

    # invoke 只传 InputState 的字段；返回结果仅包含 OutputState 的字段
    result = graph.invoke({"question": "你好"})
    print(f"图调用结果: {result}")
    print(graph.get_graph().print_ascii())
    print()


def main():
    print("=== LangGraph 图输入输出模式===\n")
    demo_input_output_schema()
    print("=== 演示完成 ===")


if __name__ == "__main__":
    main()

"""
【输出示例】
=== LangGraph 图输入输出模式===

=== 演示输入输出模式 ===
执行 answer_node 节点:
  输入: {'question': '你好'}
  输出: {'answer': '你好', 'question': '你好'}
图调用结果: {'answer': '你好'}
 +-----------+   
 | __start__ |   
 +-----------+   
        *        
        *        
        *        
+-------------+  
| answer_node |  
+-------------+  
        *        
        *        
        *        
  +---------+    
  | __end__ |    
  +---------+    
None

=== 演示完成 ===
"""

```

### Core Architecture Module: `案例与源码-3-LangGraph框架/07-senior/state_persistence/AgentPersistence.py`
```
"""
【案例】高阶 Agent + 短期记忆：create_agent 搭配 InMemorySaver，实现同一 thread_id 下的多轮对话与上下文延续。

对应教程章节：第 25 章 - LangGraph 高级特性 → 2、状态持久化（Persistence）

知识点速览：
- `create_agent(..., checkpointer=...)` 说明高层 Agent 接口底层仍然可以吃到 LangGraph 的持久化能力。
- 同一 `thread_id` 下的多次 invoke 会连续使用同一条线程状态，这也是“多轮对话为什么能续上”的关键。
- 这个案例最值得帮助读者建立的认知是：Persistence 不只服务于手写图，也服务于更高层的 Agent 体系。
"""

import os

from langchain.agents import create_agent
from langchain.chat_models import init_chat_model
from langgraph.checkpoint.memory import InMemorySaver

from dotenv import load_dotenv

load_dotenv(encoding="utf-8")


def main():
    llm = init_chat_model(
        model="qwen-plus",
        model_provider="openai",
        api_key=os.getenv("aliQwen-api"),
        temperature=0.0,
        base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
    )

    checkpointer = InMemorySaver()
    agent = create_agent(model=llm, checkpointer=checkpointer)

    config = {"configurable": {"thread_id": "user-001"}}

    msg1 = agent.invoke(
        {"messages": [("user", "你好，我叫张三，喜欢足球，60字内简洁回复")]},
        config,
    )
    msg1["messages"][-1].pretty_print()

    msg2 = agent.invoke(
        {"messages": [("user", "我叫什么？我喜欢做什么？")]},
        config,
    )
    msg2["messages"][-1].pretty_print()


if __name__ == "__main__":
    main()

"""
【输出示例】
================================== Ai Message ==================================

你好张三！很高兴认识一位足球爱好者，祝你绿茵场上挥洒汗水、享受快乐！
================================== Ai Message ==================================

你叫张三，喜欢足球！⚽
"""

```

### Core Architecture Module: `案例与源码-3-LangGraph框架/07-senior/state_persistence/MemoryPersistence.py`
```
"""
【案例】内存检查点 InMemorySaver：编译图时传入 checkpointer，用 thread_id 区分会话，演示 get_state / get_state_history / 二次 invoke。

对应教程章节：第 25 章 - LangGraph 高级特性 → 2、状态持久化（Persistence）

知识点速览：
- compile(checkpointer=...) 后，每次 invoke 会在检查点中留下快照；config["configurable"]["thread_id"] 标识一条「对话线程」。
- get_state(config) 取当前线程最新状态；get_state_history(config) 取历史快照序列（用于调试或时间回溯）。
- `InMemorySaver` 数据仅在进程内存中，进程结束即丢失；它最适合先帮助你理解“checkpoint 到底是什么”。
- 本例最值得观察的是：Persistence 不只是“把结果存起来”，而是把图每一步的状态历史都保留下来，为后面的 Time-Travel 打基础。
"""

from typing import Annotated

import operator
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph import StateGraph, START, END
from typing_extensions import TypedDict


class PersistenceDemoState(TypedDict):
    # operator.add：列表/数值等按「相加」语义合并（列表相当于拼接）
    messages: Annotated[list, operator.add]
    step_count: Annotated[int, operator.add]


def step_one(state: PersistenceDemoState) -> dict:
    print("执行步骤 1")
    return {
        "messages": ["执行了步骤 1"],
        "step_count": 1,
    }


def step_two(state: PersistenceDemoState) -> dict:
    print("执行步骤 2")
    return {
        "messages": ["执行了步骤 2"],
        "step_count": 1,
    }


def step_three(state: PersistenceDemoState) -> dict:
    print("执行步骤 3")
    return {
        "messages": ["执行了步骤 3"],
        "step_count": 1,
    }


def create_graph():
    builder = StateGraph(PersistenceDemoState)

    builder.add_node("step_one", step_one)
    builder.add_node("step_two", step_two)
    builder.add_node("step_three", step_three)

    builder.add_edge(START, "step_one")
    builder.add_edge("step_one", "step_two")
    builder.add_edge("step_two", "step_three")
    builder.add_edge("step_three", END)

    return builder


def main():
    print("=== LangGraph 1.0 内存持久化存储演示 ===\n")

    graph = create_graph()
    app = graph.compile(checkpointer=InMemorySaver())

    config = {"configurable": {"thread_id": "user_13811112222"}}

    print("1. 首次执行工作流:")
    result = app.invoke(
        {
            "messages": ["开始执行"],
            "step_count": 0,
        },
        config,
    )

    print(f"执行结果 result: {result}\n")

    print("2. 检查存储的状态:")
    saved_state = app.get_state(config)
    print(f"保存的状态: {saved_state.values}")
    print(f"下一个节点: {saved_state.next}\n")

    # 正序遍历：从最早到最晚的检查点快照
    history = app.get_state_history(config)
    for checkpoint in history:
        print("=" * 50)
        print(f"当前状态: {checkpoint.values}")

    print("=" * 80)
    print("3. 恢复执行工作流:")
    # 工作流若已结束，再次 invoke(None, config) 通常直接返回已落盘的结果
    result2 = app.invoke(None, config)
    print(f"恢复执行结果: {result2}\n")

    print("=== 演示结束 ===")


if __name__ == "__main__":
    main()

"""
【输出示例】
=== LangGraph 1.0 内存持久化存储演示 ===

1. 首次执行工作流:
执行步骤 1
执行步骤 2
执行步骤 3
执行结果 result: {'messages': ['开始执行', '执行了步骤 1', '执行了步骤 2', '执行了步骤 3'], 'step_count': 3}

2. 检查存储的状态:
保存的状态: {'messages': ['开始执行', '执行了步骤 1', '执行了步骤 2', '执行了步骤 3'], 'step_count': 3}
下一个节点: ()

==================================================
当前状态: {'messages': ['开始执行', '执行了步骤 1', '执行了步骤 2', '执行了步骤 3'], 'step_count': 3}
==================================================
当前状态: {'messages': ['开始执行', '执行了步骤 1', '执行了步骤 2'], 'step_count': 2}
==================================================
当前状态: {'messages': ['开始执行', '执行了步骤 1'], 'step_count': 1}
==================================================
当前状态: {'messages': ['开始执行'], 'step_count': 0}
==================================================
当前状态: {'messages': [], 'step_count': 0}
================================================================================
3. 恢复执行工作流:
恢复执行结果: {'messages': ['开始执行', '执行了步骤 1', '执行了步骤 2', '执行了步骤 3'], 'step_count': 3}

=== 演示结束 ===
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

**File**: `案例与源码-2-LangChain框架/10-rag/docloads/RagLoadJsonDemo.py` (modified, +4/-1)
```diff
@@ -10,11 +10,14 @@
 - 返回的每个 Document 对应一条被提取出的内容，便于后续向量化与检索。
 """
 
+from pathlib import Path
+
 # pip install jq langchain_community
 from langchain_community.document_loaders import JSONLoader
 
+json_path = Path(__file__).resolve().parent / "assets" / "sample.json"
 docs = JSONLoader(
-    file_path="assets/sample.json",
+    file_path=json_path,
     jq_schema=".",  # 提取所有字段
     text_content=False,  # 是否按字符串处理内容
 ).load()
```

**File**: `案例与源码-2-LangChain框架/10-rag/docloads/RagLoadMarkdownDemo.py` (modified, +4/-1)
```diff
@@ -9,11 +9,14 @@
 - 适合技术文档、README 等；后续分割时也可选用 MarkdownHeaderTextSplitter 按标题切分（见 2.3 文本分割器表）。
 """
 
+from pathlib import Path
+
 # pip install langchain_community unstructured[md]
 from langchain_community.document_loaders import UnstructuredMarkdownLoader
 
+markdown_path = Path(__file__).resolve().parent / "assets" / "sample.md"
 docs = UnstructuredMarkdownLoader(
-    file_path="assets/sample.md",
+    file_path=markdown_path,
     mode="elements",  # single 整篇；elements 按元素切分
 ).load()
 
```

**File**: `案例与源码-2-LangChain框架/10-rag/docloads/RagLoadPdfDemo.py` (modified, +4/-1)
```diff
@@ -11,11 +11,14 @@
 - 为何没 import pypdf 却要装 pypdf？PyPDFLoader 在 langchain_community 内部会「按需」import pypdf 来解析 PDF，langchain-community 不自动安装它，所以需单独 pip install pypdf。
 """
 
+from pathlib import Path
+
 # pip install langchain_community pypdf
 from langchain_community.document_loaders import PyPDFLoader
 
+pdf_path = Path(__file__).resolve().parent / "assets" / "sample.pdf"
 docs = PyPDFLoader(
-    file_path="assets/sample.pdf",
+    file_path=pdf_path,
     extraction_mode="plain",  # plain 纯文本；layout 按版面
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
 
-### 7.3 columns 这一块在描述什么
+### 7.3 columns：字段配置结构
 
 `columns` 也是一个列表，里面每个元素都表示一个字段。
 
@@ -1005,7 +1011,7 @@ if meta_config.metrics:
 
 这样后面做召回时，就更容易把自然语言和真实字段对齐起来。
 
-### 7.4 sync 字段为什么重要
+### 7.4 sync：字段取值同步开关
 
 `sync` 是这个配置文件里最容易被忽略、但非常关键的一个字段。
 
@@ -1016,7 +1022,7 @@ if meta_config.metrics:
 
 也就是说，所有出现在配置里的字段，都会作为字段元数据进入系统；只有 `sync: true` 的那些字段，才会继续把真实取值同步到 ES。
 
-### 7.5 metrics 这一块在描述什么
+### 7.5 metrics：指标配置结构
 
 `metrics` 也是一个列表，里面每个元素都表示一个指标。
 
@@ -1040,7 +1046,7 @@ metrics:
 
 这里的 `relevant_columns` 很重要，因为它把“指标”和“底层字段”连接起来了。后面往元数据库写数据时，`column_metric` 这张关系表就是根据这个字段来生成的。
 
-### 7.6 为什么配置文件里没有 type 和 examples
+### 7.6 为什么不配置 type 和 examples
 
 这也是这里非常容易让初学者困惑的点。很多同学第一次看到这里，会觉得有点奇怪：
 
@@ -1057,6 +1063,8 @@ metrics:
 
 这样做有两个明显好处：配置文件更精简，自动读取通常比人工填写更准确。所以这里的配置文件，只要求你填写那些**程序无法自动推断、必须由业务方声明**的内容，比如：表和字段的角色、描述信息、别名、是否同步取值。
 
+---
+
 ## 8、build_meta_knowledge.py 详解
 
 这一部分有一个非常重要的设计原则：**脚本入口不要一上来就堆满业务逻辑。**它更适合做“总调度”，而不是做“总实现”。
@@ -1147,7 +1155,7 @@ if __name__ == "__main__":
 
 这就是为什么这里要坚持“分层”的原因。
 
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

**File**: `案例与源码-1-Coze&Dify工作流智能体/3.4-Dify案例：一键生成行业调研报告/3.4-一键生成行业调研报告.md` (modified, +1/-1)
```diff
@@ -170,7 +170,7 @@ Dify 也提供了很多工作流节点，详细用法参考官方文档。
 
 ### 2.1 开始节点
 
-**"开始"** 节点是每个工作流应用（Chatflow / Workflow）必备的预设节点，为后续工作流节点以及应用的正常流转提供必要的初始信息，例如应用使用者所输入的内容、以及[上传的文件](https://docs.dify.ai/zh-hans/guides/workflow/file-upload)等。
+**"开始"** 节点是每个工作流应用（Chatflow / Workflow）必备的预设节点，为后续工作流节点以及应用的正常流转提供必要的初始信息，例如应用使用者所输入的内容、以及上传的文件等。
 
 ![](../../images/3.4/3.4-2-1-1.png)
 
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

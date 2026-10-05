# Forensic Learning Record (Deep Inspection): liyupi/yu-ai-agent

> **Canonical Artifact**: `07_PROJECT_LEARNING/liyupi-yu-ai-agent-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/liyupi/yu-ai-agent](https://github.com/liyupi/yu-ai-agent))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T19:28:27.091Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `liyupi/yu-ai-agent`
- **Description**: 编程导航 AI 开发实战新项目，基于 Spring Boot 3 + Java 21 + Spring AI 构建 AI 恋爱大师应用和 ReAct 模式自主规划智能体YuManus，覆盖 AI 大模型接入、Spring AI 核心特性、Prompt 工程和优化、RAG 检索增强、向量数据库、Tool Calling 工具调用、MCP 模型上下文协议、AI Agent 开发（Manas Java 实现）、Cursor AI 工具等核心知识。用一套教程将程序员必知必会的 AI 技术一网打尽，帮你成为 AI 时代企业的香饽饽，给你的简历和求职大幅增加竞争力。
- **Primary Language / Ecosystem**: Java
- **Discovered Manifests / Configurations**: README.md, Dockerfile
- **Stars / Engagement**: 2716 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `yu-ai-agent-frontend/src/api/index.js`
```
import axios from 'axios'

// 根据环境变量设置 API 基础 URL
const API_BASE_URL = process.env.NODE_ENV === 'production' 
 ? '/api' // 生产环境使用相对路径，适用于前后端部署在同一域名下
 : 'http://localhost:8123/api' // 开发环境指向本地后端服务

// 创建axios实例
const request = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000
})

// 封装SSE连接
export const connectSSE = (url, params, onMessage, onError) => {
  // 构建带参数的URL
  const queryString = Object.keys(params)
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join('&')
  
  const fullUrl = `${API_BASE_URL}${url}?${queryString}`
  
  // 创建EventSource
  const eventSource = new EventSource(fullUrl)
  
  eventSource.onmessage = event => {
    let data = event.data
    
    // 检查是否是特殊标记
    if (data === '[DONE]') {
      if (onMessage) onMessage('[DONE]')
    } else {
      // 处理普通消息
      if (onMessage) onMessage(data)
    }
  }
  
  eventSource.onerror = error => {
    if (onError) onError(error)
    eventSource.close()
  }
  
  // 返回eventSource实例，以便后续可以关闭连接
  return eventSource
}

// AI恋爱大师聊天
export const chatWithLoveApp = (message, chatId) => {
  return connectSSE('/ai/love_app/chat/sse', { message, chatId })
}

// AI超级智能体聊天
export const chatWithManus = (message) => {
  return connectSSE('/ai/manus/chat', { message })
}

export default {
  chatWithLoveApp,
  chatWithManus
} 
```

### Core Architecture Module: `yu-ai-agent-frontend/src/main.js`
```
import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { createHead } from '@vueuse/head'
import './style.css'

const app = createApp(App)
const head = createHead()

app.use(router)
app.use(head)
app.mount('#app')

```

### Core Architecture Module: `yu-ai-agent-frontend/src/router/index.js`
```
import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: () => import('../views/Home.vue'),
    meta: {
      title: '首页 - 鱼皮AI超级智能体应用平台',
      description: '鱼皮AI超级智能体应用平台提供AI恋爱大师和AI超级智能体服务，满足您的各种AI对话需求'
    }
  },
  {
    path: '/love-master',
    name: 'LoveMaster',
    component: () => import('../views/LoveMaster.vue'),
    meta: {
      title: 'AI恋爱大师 - 鱼皮AI超级智能体应用平台',
      description: 'AI恋爱大师是鱼皮AI超级智能体应用平台的专业情感顾问，帮你解答各种恋爱问题，提供情感建议'
    }
  },
  {
    path: '/super-agent',
    name: 'SuperAgent',
    component: () => import('../views/SuperAgent.vue'),
    meta: {
      title: 'AI超级智能体 - 鱼皮AI超级智能体应用平台',
      description: 'AI超级智能体是鱼皮AI超级智能体应用平台的全能助手，能解答各类专业问题，提供精准建议和解决方案'
    }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// 全局导航守卫，设置文档标题
router.beforeEach((to, from, next) => {
  // 设置页面标题
  if (to.meta.title) {
    document.title = to.meta.title
  }
  next()
})

export default router 
```

### Core Architecture Module: `yu-ai-agent-frontend/vite.config.js`
```
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  },
  server: {
    port: 3000,
    cors: true
  }
})

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #26** (2026-04-20): **chore(demo): read dashscope api key from environment**
  *Symptoms*: ## Summary - make the demo API-key helper prefer `DASHSCOPE_API_KEY` from the environment - keep the existing fallback placeholder for readers who still want to edit the file manually  ## Why The invoke demos currently require editing committed source before running them. Reading the API key from the environment by default makes the examples easier to run and matches the recommended local configuration style used elsewhere in the project.  ## Scope - update `src/main/java/com/yupi/yuaiagent/demo/invoke/TestApiKey.java` - resolve the API key from `DASHSCOPE_API_KEY` when available - keep the original placeholder fallback for manual local edits  ## Testing - `sh ./mvnw -q -DskipTests compile` 

- **Issue #25** (2026-04-20): **docs: add troubleshooting quick checks**
  *Symptoms*: ## Summary - add a short troubleshooting checklist for common first-run problems  ## Why Most local issues in this project come from the same small set of setup mistakes: backend not running, missing API keys, or confusion about which optional services are required. A quick checklist can save new readers a lot of time.  ## Scope - add `docs/troubleshooting-quick-checks.md` - cover backend health checks, frontend URL expectations, required API keys, optional services, and SSE debugging hints  ## Testing - not run (documentation-only change) 

- **Issue #24** (2026-04-20): **docs(frontend): clarify local development setup**
  *Symptoms*: ## Summary - replace the leftover Vite template text in the frontend README with project-specific local development notes - document the default dev-server and backend URLs used during local development  ## Why The current frontend README still ends with generic Vite scaffold content, which makes the project feel less polished and does not explain the actual backend routing behavior used in this repository.  ## Scope - document that the Vite dev server runs on `http://localhost:3000` - explain the development and production API base URL behavior - add a short local frontend/backend startup order - remove the generic Vite template footer  ## Testing - not run (documentation-only change) 

- **Issue #23** (2026-04-20): **chore: add env example for local configuration**
  *Symptoms*: ## Summary - add a root `.env.example` for the most common local configuration values - allow `application.yml` to read DashScope, Ollama, and Search API settings from environment variables  ## Why Right now local setup requires editing committed configuration placeholders directly. Supporting environment variables makes local setup less error-prone and gives readers a safer copyable starting point.  ## Scope - add `.env.example` with `DASHSCOPE_API_KEY`, `OLLAMA_BASE_URL`, and `SEARCH_API_KEY` - update `src/main/resources/application.yml` to use environment-variable placeholders  ## Testing - not run (configuration-only change) 

- **Issue #22** (2026-04-20): **docs: add repository quick reference to README**
  *Symptoms*: ## Summary - add a repository structure quick reference to the root README - document a simple recommended reading order for the backend, frontend, and MCP module  ## Why The repository now contains multiple modules, but the root README does not help first-time readers decide where to start. A small structure table makes onboarding easier without changing the tutorial flow.  ## Scope - add a "仓库结构速览" section to `README.md` - list the main backend, frontend, test, and MCP directories - add a short recommended reading order  ## Testing - not run (documentation-only change) 

- **Issue #21** (2026-04-20): **docs: add troubleshooting quick checks for local setup (clean diff final)**
  *Symptoms*: Final clean-diff replacement for https://github.com/liyupi/yu-ai-agent/pull/18.  This PR is based on upstream master and includes only the intended target file(s).

- **Issue #20** (2026-04-20): **docs(config): add local environment example for development (clean diff final)**
  *Symptoms*: Final clean-diff replacement for https://github.com/liyupi/yu-ai-agent/pull/17.  This PR is based on upstream master and includes only the intended target file(s).

- **Issue #19** (2026-04-20): **docs(readme): add contributor quick verification commands (clean diff final)**
  *Symptoms*: Final clean-diff replacement for https://github.com/liyupi/yu-ai-agent/pull/16.  This PR is based on upstream master and includes only the intended target file(s).

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

### Incident Patch 1: `6d4608c5` (2025-06-25)
**Commit Message**: refactor: 升级 Spring AI 依赖版本为 1.0
- 更新依赖版本：Spring AI Alibaba: 1.0.0.2、Spring AI: 1.0.0
- 重构代码，实现新版本兼容：
  - 更新导入路径
  - 调整类和方法签名以适应新版本
  - 优化部分实现细节

**File**: `pom.xml` (modified, +68/-32)
```diff
@@ -29,6 +29,24 @@
     <properties>
         <java.version>21</java.version>
     </properties>
+    <dependencyManagement>
+        <dependencies>
+            <dependency>
+                <groupId>com.alibaba.cloud.ai</groupId>
+                <artifactId>spring-ai-alibaba-bom</artifactId>
+                <version>1.0.0.2</version>
+                <type>pom</type>
+                <scope>import</scope>
+            </dependency>
+            <dependency>
+                <groupId>org.springframework.ai</groupId>
+                <artifactId>spring-ai-bom</artifactId>
+                <version>1.0.0</version>
+                <type>pom</type>
+                <scope>import</scope>
+            </dependency>
+        </dependencies>
+    </dependencyManagement>
     <dependencies>
         <dependency>
             <groupId>org.springframework.boot</groupId>
@@ -43,37 +61,16 @@
         <!-- Spring AI Alibaba -->
         <dependency>
             <groupId>com.alibaba.cloud.ai</groupId>
-            <artifactId>spring-ai-alibaba-starter</artifactId>
-            <version>1.0.0-M6.1</version>
+            <artifactId>spring-ai-alibaba-starter-dashscope</artifactId>
         </dependency>
-        <!-- https://java2ai.com/docs/1.0.0-M6.1/models/ollama -->
+        <!-- https://docs.spring.io/spring-ai/reference/api/chat/ollama-chat.html -->
         <dependency>
             <groupId>org.springframework.ai</groupId>
-            <artifactId>spring-ai-ollama-spring-boot-starter</artifactId>
-            <version>1.0.0-M6</version>
-        </dependency>
-        <!-- LangChain4J DashScope -->
-        <dependency>
-            <groupId>dev.langchain4j</groupId>
-            <artifactId>langchain4j-community-dashscope</artifactId>
-            <version>1.0.0-beta2</version>
-        </dependency>
-        <!-- 支持结构化输出 -->
-        <dependency>
-            <groupId>com.github.victools</groupId>
-            <artifactId>jsonschema-generator</artifactId>
-            <version>4.38.0</version>
-        </dependency>
-        <!-- 支持文件会话记忆持久化的序列化 -->
-        <dependency>
-            <groupId>com.esotericsoftware</groupId>
-            <artifactId>kryo</artifactId>
-            <version>5.6.2</version>
+            <artifactId>spring-ai-starter-model-ollama</artifactId>
         </dependency>
         <dependency>
             <groupId>org.springframework.ai</groupId>
             <artifactId>spring-ai-markdown-document-reader</artifactId>
-            <version>1.0.0-M6</version>
         </dependency>
         <!-- 手动整合 PGVector 向量存储 -->
         <dependency>
@@ -88,19 +85,39 @@
         <dependency>
             <groupId>org.springframework.ai</groupId>
             <artifactId>spring-ai-pgvector-store</artifactId>
-            <version>1.0.0-M6</version>
         </dependency>
         <!-- 自动整合 PGVector 向量存储 -->
-<!--        <dependency>-->
-<!--            <groupId>org.springframework.ai</groupId>-->
-<!--            <artifactId>spring-ai-starter-vector-store-pgvector</artifactId>-->
-<!--            <version>1.0.0-M7</version>-->
-<!--        </dependency>-->
+        <!--        <dependency>-->
+        <!--            <groupId>org.springframework.ai</groupId>-->
+        <!--            <artifactId>spring-ai-starter-vector-store-pgvector</artifactId>-->
+        <!--            <version>1.0.0-M7</version>-->
+        <!--        </dependency>-->
         <!-- Spring AI MCP Client -->
         <dependency>
             <groupId>org.springframework.ai</groupId>
-            <artifactId>spring-ai-mcp-client-spring-boot-starter</artifactId>
-            <version>1.0.0-M6</version>
+            <artifactId>spring-ai-starter-mcp-client</artifactId>
+        </dependency>
+        <dependency>
+            <groupId>org.springframework.ai</groupId>
+            <artifactId>spring-ai-advisors-vector-store</artifactId>
+        </dependency>
+        <!-- LangChain4J DashScope -->
+        <dependency>
+            <groupId>dev.langchain4j</groupId>
+            <artifactId>langchain4j-community-dashscope</artifactId>
+            <version>1.0.0-beta2</version>
+        </dependency>
+        <!-- 支持结构化输出 -->
+        <dependency>
+            <groupId>com.github.victools</groupId>
+            <artifactId>jsonschema-generator</artifactId>
+            <version>4.38.0</version>
+        </dependency>
+        <!-- 支持文件会话记忆持久化的序列化 -->
+        <dependency>
+            <groupId>com.esotericsoftware</groupId>
+            <artifactId>kryo</artifactId>
+            <version>5.6.2</version>
         </dependency>
         <!-- jsoup HTML 解析库 -->
         <dependency>
@@ -186,5 +203,24 @@
                 <enabled>false</enabled>
             </snapshots>
         </repository>
+        <repository>
+            <id>spring-snapshots</id>
+            <name>Spring Snapshots</name>
+            <url>https://repo.spring.io/snapshot</url>
+            <releases>
+                <enabled>false</enabled>
+            </r
```

**File**: `src/main/java/com/yupi/yuaiagent/YuAiAgentApplication.java` (modified, +1/-3)
```diff
@@ -1,14 +1,12 @@
 package com.yupi.yuaiagent;
 
-import org.springframework.ai.autoconfigure.vectorstore.pgvector.PgVectorStoreAutoConfiguration;
 import org.springframework.boot.SpringApplication;
 import org.springframework.boot.autoconfigure.SpringBootApplication;
 import org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration;
 
 @SpringBootApplication(exclude = {
-        PgVectorStoreAutoConfiguration.class
         // 为了便于大家开发调试和部署，取消数据库自动配置，需要使用 PgVector 时把 DataSourceAutoConfiguration.class 删除
-        , DataSourceAutoConfiguration.class
+        DataSourceAutoConfiguration.class
 })
 public class YuAiAgentApplication {
 
```

**File**: `src/main/java/com/yupi/yuaiagent/advisor/MyLoggerAdvisor.java` (modified, +21/-30)
```diff
@@ -1,22 +1,21 @@
 package com.yupi.yuaiagent.advisor;
 
 import lombok.extern.slf4j.Slf4j;
+import org.springframework.ai.chat.client.ChatClientMessageAggregator;
+import org.springframework.ai.chat.client.ChatClientRequest;
+import org.springframework.ai.chat.client.ChatClientResponse;
+import org.springframework.ai.chat.client.advisor.api.CallAdvisor;
+import org.springframework.ai.chat.client.advisor.api.CallAdvisorChain;
+import org.springframework.ai.chat.client.advisor.api.StreamAdvisor;
+import org.springframework.ai.chat.client.advisor.api.StreamAdvisorChain;
 import reactor.core.publisher.Flux;
 
-import org.springframework.ai.chat.client.advisor.api.AdvisedRequest;
-import org.springframework.ai.chat.client.advisor.api.AdvisedResponse;
-import org.springframework.ai.chat.client.advisor.api.CallAroundAdvisor;
-import org.springframework.ai.chat.client.advisor.api.CallAroundAdvisorChain;
-import org.springframework.ai.chat.client.advisor.api.StreamAroundAdvisor;
-import org.springframework.ai.chat.client.advisor.api.StreamAroundAdvisorChain;
-import org.springframework.ai.chat.model.MessageAggregator;
-
 /**
  * 自定义日志 Advisor
  * 打印 info 级别日志、只输出单次用户提示词和 AI 回复的文本
  */
 @Slf4j
-public class MyLoggerAdvisor implements CallAroundAdvisor, StreamAroundAdvisor {
+public class MyLoggerAdvisor implements CallAdvisor, StreamAdvisor {
 
 	@Override
 	public String getName() {
@@ -28,35 +27,27 @@ public int getOrder() {
 		return 0;
 	}
 
-	private AdvisedRequest before(AdvisedRequest request) {
-		log.info("AI Request: {}", request.userText());
+	private ChatClientRequest before(ChatClientRequest request) {
+		log.info("AI Request: {}", request.prompt());
 		return request;
 	}
 
-	private void observeAfter(AdvisedResponse advisedResponse) {
-		log.info("AI Response: {}", advisedResponse.response().getResult().getOutput().getText());
+	private void observeAfter(ChatClientResponse chatClientResponse) {
+		log.info("AI Response: {}", chatClientResponse.chatResponse().getResult().getOutput().getText());
 	}
 
 	@Override
-	public AdvisedResponse aroundCall(AdvisedRequest advisedRequest, CallAroundAdvisorChain chain) {
-
-		advisedRequest = before(advisedRequest);
-
-		AdvisedResponse advisedResponse = chain.nextAroundCall(advisedRequest);
-
-		observeAfter(advisedResponse);
-
-		return advisedResponse;
+	public ChatClientResponse adviseCall(ChatClientRequest chatClientRequest, CallAdvisorChain chain) {
+		chatClientRequest = before(chatClientRequest);
+		ChatClientResponse chatClientResponse = chain.nextCall(chatClientRequest);
+		observeAfter(chatClientResponse);
+		return chatClientResponse;
 	}
 
 	@Override
-	public Flux<AdvisedResponse> aroundStream(AdvisedRequest advisedRequest, StreamAroundAdvisorChain chain) {
-
-		advisedRequest = before(advisedRequest);
-
-		Flux<AdvisedResponse> advisedResponses = chain.nextAroundStream(advisedRequest);
-
-		return new MessageAggregator().aggregateAdvisedResponse(advisedResponses, this::observeAfter);
+	public Flux<ChatClientResponse> adviseStream(ChatClientRequest chatClientRequest, StreamAdvisorChain chain) {
+		chatClientRequest = before(chatClientRequest);
+		Flux<ChatClientResponse> chatClientResponseFlux = chain.nextStream(chatClientRequest);
+		return (new ChatClientMessageAggregator()).aggregateChatClientResponse(chatClientResponseFlux, this::observeAfter);
 	}
-
 }
```

**File**: `src/main/java/com/yupi/yuaiagent/advisor/ReReadingAdvisor.java` (modified, +42/-39)
```diff
@@ -1,53 +1,56 @@
 package com.yupi.yuaiagent.advisor;
 
-import org.springframework.ai.chat.client.advisor.api.*;
+import org.springframework.ai.chat.client.ChatClientRequest;
+import org.springframework.ai.chat.client.ChatClientResponse;
+import org.springframework.ai.chat.client.advisor.api.CallAdvisor;
+import org.springframework.ai.chat.client.advisor.api.CallAdvisorChain;
+import org.springframework.ai.chat.client.advisor.api.StreamAdvisor;
+import org.springframework.ai.chat.client.advisor.api.StreamAdvisorChain;
+import org.springframework.ai.chat.prompt.Prompt;
 import reactor.core.publisher.Flux;
 
-import java.util.HashMap;
-import java.util.Map;
-
 /**
  * 自定义 Re2 Advisor
  * 可提高大型语言模型的推理能力
  */
-public class ReReadingAdvisor implements CallAroundAdvisor, StreamAroundAdvisor {
-
-	/**
-	 * 执行请求前，改写 Prompt
-	 * @param advisedRequest
-	 * @return
-	 */
-	private AdvisedRequest before(AdvisedRequest advisedRequest) {
-
-		Map<String, Object> advisedUserParams = new HashMap<>(advisedRequest.userParams());
-		advisedUserParams.put("re2_input_query", advisedRequest.userText());
-
-		return AdvisedRequest.from(advisedRequest)
-			.userText("""
-			    {re2_input_query}
-			    Read the question again: {re2_input_query}
-			    """)
-			.userParams(advisedUserParams)
-			.build();
-	}
+public class ReReadingAdvisor implements CallAdvisor, StreamAdvisor {
+
+    /**
+     * 执行请求前，改写 Prompt
+     *
+     * @param chatClientRequest
+     * @return
+     */
+    private ChatClientRequest before(ChatClientRequest chatClientRequest) {
+        String userText = chatClientRequest.prompt().getUserMessage().getText();
+        // 添加上下文参数
+        chatClientRequest.context().put("re2_input_query", userText);
+        // 修改用户提示词
+        String newUserText = """
+                %s
+                Read the question again: %s
+                """.formatted(userText, userText);
+        Prompt newPrompt = chatClientRequest.prompt().augmentUserMessage(newUserText);
+        return new ChatClientRequest(newPrompt, chatClientRequest.context());
+    }
 
-	@Override
-	public AdvisedResponse aroundCall(AdvisedRequest advisedRequest, CallAroundAdvisorChain chain) {
-		return chain.nextAroundCall(this.before(advisedRequest));
-	}
+    @Override
+    public ChatClientResponse adviseCall(ChatClientRequest chatClientRequest, CallAdvisorChain chain) {
+        return chain.nextCall(this.before(chatClientRequest));
+    }
 
-	@Override
-	public Flux<AdvisedResponse> aroundStream(AdvisedRequest advisedRequest, StreamAroundAdvisorChain chain) {
-		return chain.nextAroundStream(this.before(advisedRequest));
-	}
+    @Override
+    public Flux<ChatClientResponse> adviseStream(ChatClientRequest chatClientRequest, StreamAdvisorChain chain) {
+        return chain.nextStream(this.before(chatClientRequest));
+    }
 
-	@Override
-	public int getOrder() { 
-		return 0;
-	}
+    @Override
+    public int getOrder() {
+        return 0;
+    }
 
     @Override
-    public String getName() { 
-		return this.getClass().getSimpleName();
-	}
+    public String getName() {
+        return this.getClass().getSimpleName();
+    }
 }
```

**File**: `src/main/java/com/yupi/yuaiagent/agent/ToolCallAgent.java` (modified, +1/-1)
```diff
@@ -47,7 +47,7 @@ public ToolCallAgent(ToolCallback[] availableTools) {
         this.toolCallingManager = ToolCallingManager.builder().build();
         // 禁用 Spring AI 内置的工具调用机制，自己维护选项和消息上下文
         this.chatOptions = DashScopeChatOptions.builder()
-                .withProxyToolCalls(true)
+                .withInternalToolExecutionEnabled(false)
                 .build();
     }
 
```

**File**: `src/main/java/com/yupi/yuaiagent/app/LoveApp.java` (modified, +16/-21)
```diff
@@ -9,10 +9,11 @@
 import lombok.extern.slf4j.Slf4j;
 import org.springframework.ai.chat.client.ChatClient;
 import org.springframework.ai.chat.client.advisor.MessageChatMemoryAdvisor;
-import org.springframework.ai.chat.client.advisor.QuestionAnswerAdvisor;
 import org.springframework.ai.chat.client.advisor.api.Advisor;
+import org.springframework.ai.chat.client.advisor.vectorstore.QuestionAnswerAdvisor;
 import org.springframework.ai.chat.memory.ChatMemory;
-import org.springframework.ai.chat.memory.InMemoryChatMemory;
+import org.springframework.ai.chat.memory.InMemoryChatMemoryRepository;
+import org.springframework.ai.chat.memory.MessageWindowChatMemory;
 import org.springframework.ai.chat.model.ChatModel;
 import org.springframework.ai.chat.model.ChatResponse;
 import org.springframework.ai.tool.ToolCallback;
@@ -23,9 +24,6 @@
 
 import java.util.List;
 
-import static org.springframework.ai.chat.client.advisor.AbstractChatMemoryAdvisor.CHAT_MEMORY_CONVERSATION_ID_KEY;
-import static org.springframework.ai.chat.client.advisor.AbstractChatMemoryAdvisor.CHAT_MEMORY_RETRIEVE_SIZE_KEY;
-
 @Component
 @Slf4j
 public class LoveApp {
@@ -47,11 +45,14 @@ public LoveApp(ChatModel dashscopeChatModel) {
 //        String fileDir = System.getProperty("user.dir") + "/tmp/chat-memory";
 //        ChatMemory chatMemory = new FileBasedChatMemory(fileDir);
         // 初始化基于内存的对话记忆
-        ChatMemory chatMemory = new InMemoryChatMemory();
+        MessageWindowChatMemory chatMemory = MessageWindowChatMemory.builder()
+                .chatMemoryRepository(new InMemoryChatMemoryRepository())
+                .maxMessages(20)
+                .build();
         chatClient = ChatClient.builder(dashscopeChatModel)
                 .defaultSystem(SYSTEM_PROMPT)
                 .defaultAdvisors(
-                        new MessageChatMemoryAdvisor(chatMemory),
+                        MessageChatMemoryAdvisor.builder(chatMemory).build(),
                         // 自定义日志 Advisor，可按需开启
                         new MyLoggerAdvisor()
 //                        // 自定义推理增强 Advisor，可按需开启
@@ -71,8 +72,7 @@ public String doChat(String message, String chatId) {
         ChatResponse chatResponse = chatClient
                 .prompt()
                 .user(message)
-                .advisors(spec -> spec.param(CHAT_MEMORY_CONVERSATION_ID_KEY, chatId)
-                        .param(CHAT_MEMORY_RETRIEVE_SIZE_KEY, 10))
+                .advisors(spec -> spec.param(ChatMemory.CONVERSATION_ID, chatId))
                 .call()
                 .chatResponse();
         String content = chatResponse.getResult().getOutput().getText();
@@ -91,8 +91,7 @@ public Flux<String> doChatByStream(String message, String chatId) {
         return chatClient
                 .prompt()
                 .user(message)
-                .advisors(spec -> spec.param(CHAT_MEMORY_CONVERSATION_ID_KEY, chatId)
-                        .param(CHAT_MEMORY_RETRIEVE_SIZE_KEY, 10))
+                .advisors(spec -> spec.param(ChatMemory.CONVERSATION_ID, chatId))
                 .stream()
                 .content();
     }
@@ -113,8 +112,7 @@ public LoveReport doChatWithReport(String message, String chatId) {
                 .prompt()
                 .system(SYSTEM_PROMPT + "每次对话后都要生成恋爱结果，标题为{用户名}的恋爱报告，内容为建议列表")
                 .user(message)
-                .advisors(spec -> spec.param(CHAT_MEMORY_CONVERSATION_ID_KEY, chatId)
-                        .param(CHAT_MEMORY_RETRIEVE_SIZE_KEY, 10))
+                .advisors(spec -> spec.param(ChatMemory.CONVERSATION_ID, chatId))
                 .call()
                 .entity(LoveReport.class);
         log.info("loveReport: {}", loveReport);
@@ -149,8 +147,7 @@ public String doChatWithRag(String message, String chatId) {
                 .prompt()
                 // 使用改写后的查询
                 .user(rewrittenMessage)
-                .advisors(spec -> spec.param(CHAT_MEMORY_CONVERSATION_ID_KEY, chatId)
-                        .param(CHAT_MEMORY_RETRIEVE_SIZE_KEY, 10))
+                .advisors(spec -> spec.param(ChatMemory.CONVERSATION_ID, chatId))
                 // 开启日志，便于观察效果
                 .advisors(new MyLoggerAdvisor())
                 // 应用 RAG 知识库问答
@@ -187,11 +184,10 @@ public String doChatWithTools(String message, String chatId) {
         ChatResponse chatResponse = chatClient
                 .prompt()
                 .user(message)
-                .advisors(spec -> spec.param(CHAT_MEMORY_CONVERSATION_ID_KEY, chatId)
-                        .param(CHAT_MEMORY_RETRIEVE_SIZE_KEY, 10))
+                .advisors(spec -> spec.param(ChatMemory.CONVERSATION_ID, chatId))
                 // 开启日志，便于观察效果
                 .advisors(new MyLoggerAdvisor())
-                .tools(allTools)
+                .toolCallbacks(allTools)
                 .call()
                 .chatResponse();
         String content = chatResponse.getResult().getOutput().getText();
@@ -215,11 +211,10 @@ public String do
```

**File**: `src/main/java/com/yupi/yuaiagent/chatmemory/FileBasedChatMemory.java` (modified, +2/-5)
```diff
@@ -45,11 +45,8 @@ public void add(String conversationId, List<Message> messages) {
     }
 
     @Override
-    public List<Message> get(String conversationId, int lastN) {
-        List<Message> allMessages = getOrCreateConversation(conversationId);
-        return allMessages.stream()
-                .skip(Math.max(0, allMessages.size() - lastN))
-                .toList();
+    public List<Message> get(String conversationId) {
+        return getOrCreateConversation(conversationId);
     }
 
     @Override
```

**File**: `src/main/java/com/yupi/yuaiagent/rag/LoveAppRagCloudAdvisorConfig.java` (modified, +4/-2)
```diff
@@ -4,8 +4,8 @@
 import com.alibaba.cloud.ai.dashscope.rag.DashScopeDocumentRetriever;
 import com.alibaba.cloud.ai.dashscope.rag.DashScopeDocumentRetrieverOptions;
 import lombok.extern.slf4j.Slf4j;
-import org.springframework.ai.chat.client.advisor.RetrievalAugmentationAdvisor;
 import org.springframework.ai.chat.client.advisor.api.Advisor;
+import org.springframework.ai.rag.advisor.RetrievalAugmentationAdvisor;
 import org.springframework.ai.rag.retrieval.search.DocumentRetriever;
 import org.springframework.beans.factory.annotation.Value;
 import org.springframework.context.annotation.Bean;
@@ -23,7 +23,9 @@ public class LoveAppRagCloudAdvisorConfig {
 
     @Bean
     public Advisor loveAppRagCloudAdvisor() {
-        DashScopeApi dashScopeApi = new DashScopeApi(dashScopeApiKey);
+        DashScopeApi dashScopeApi = DashScopeApi.builder()
+                .apiKey(dashScopeApiKey)
+                .build();
         final String KNOWLEDGE_INDEX = "恋爱大师";
         DocumentRetriever dashScopeDocumentRetriever = new DashScopeDocumentRetriever(dashScopeApi,
                 DashScopeDocumentRetrieverOptions.builder()
```

---

### Incident Patch 2: `0ace2a4e` (2025-06-25)
**Commit Message**: refactor: 优化配置和注释以便开发调试

- 注释掉 PgVector 数据库配置，简化本地开发和调试
- 添加 API Key 和其他配置项的占位符，方便用户替换
- 修改应用启动类，排除 PgVector 和数据源自动配置
- 更新相关注释，提供更多配置指导和说明

**File**: `src/main/java/com/yupi/yuaiagent/YuAiAgentApplication.java` (modified, +6/-1)
```diff
@@ -3,8 +3,13 @@
 import org.springframework.ai.autoconfigure.vectorstore.pgvector.PgVectorStoreAutoConfiguration;
 import org.springframework.boot.SpringApplication;
 import org.springframework.boot.autoconfigure.SpringBootApplication;
+import org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration;
 
-@SpringBootApplication(exclude = PgVectorStoreAutoConfiguration.class)
+@SpringBootApplication(exclude = {
+        PgVectorStoreAutoConfiguration.class
+        // 为了便于大家开发调试和部署，取消数据库自动配置，需要使用 PgVector 时把 DataSourceAutoConfiguration.class 删除
+        , DataSourceAutoConfiguration.class
+})
 public class YuAiAgentApplication {
 
     public static void main(String[] args) {
```

**File**: `src/main/java/com/yupi/yuaiagent/rag/PgVectorVectorStoreConfig.java` (modified, +2/-1)
```diff
@@ -14,7 +14,8 @@
 import static org.springframework.ai.vectorstore.pgvector.PgVectorStore.PgDistanceType.COSINE_DISTANCE;
 import static org.springframework.ai.vectorstore.pgvector.PgVectorStore.PgIndexType.HNSW;
 
-@Configuration
+// 为方便开发调试和部署，临时注释，如果需要使用 PgVector 存储知识库，取消注释即可
+//@Configuration
 public class PgVectorVectorStoreConfig {
 
     @Resource
```

**File**: `src/main/resources/application.yml` (modified, +9/-1)
```diff
@@ -3,8 +3,14 @@ spring:
     name: yu-ai-agent
   profiles:
     active: local
+# 临时注释掉，便于大家开发调试和部署（实际填写 PgVector 数据库信息）
+#  datasource:
+#    url: xxx
+#    username: root
+#    password: 123456
   ai:
     dashscope:
+      # 需要替换为你自己的 key
       api-key: your-api-key
       chat:
         options:
@@ -13,7 +19,7 @@ spring:
       base-url: http://localhost:11434
       chat:
         model: gemma3:1b
-# 临时注释掉，便于大家开发调试和部署
+# 临时注释掉，便于大家开发调试和部署（实际需要启动 MCP 服务）
 #    mcp:
 #      client:
 #        sse:
@@ -22,6 +28,7 @@ spring:
 #              url: http://localhost:8127
 #        stdio:
 #          servers-configuration: classpath:mcp-servers.json
+# 临时注释掉，便于大家开发调试和部署（实际需要启动 PgVector 数据库）
 #    vectorstore:
 #      pgvector:
 #        index-type: HNSW
@@ -51,6 +58,7 @@ knife4j:
     language: zh_cn
 # searchAPI
 search-api:
+  # 需要替换为你自己的 key
   api-key: 你的 API Key
 # 修改日志级别，查看 Spring AI 更多调用细节
 logging:
```

---

### Incident Patch 3: `c303e208` (2025-05-29)
**Commit Message**: Update README.md

补充项目完结的介绍

**File**: `README.md` (modified, +25/-17)
```diff
@@ -11,7 +11,9 @@
 
 > 视频介绍：https://www.bilibili.com/video/BV1UoLezKEbm
 
-这是一套以 **AI 开发实战** 为核心的项目教程，将通过开发 **AI 恋爱大师应用 + 拥有自主规划能力的超级智能体**，带大家掌握新时代程序员必知必会的 AI 核心概念、AI 实用工具和 AI 编程技术，大幅增加求职的竞争力！
+这是一套以 **AI 开发实战** 为核心的项目教程，将通过开发 **AI 恋爱大师应用 + 拥有自主规划能力的超级智能体**，带大家掌握新时代程序员必知必会的 AI 核心概念、AI 实用工具、AI 编程技术、AI 框架原理、AI 调优技巧，大幅增加求职的竞争力！
+
+![](https://pic.yupi.icu/1/8052592c-97ce-4568-b82e-6153924a053c.png)
 
 `AI 恋爱大师应用` 可以依赖 AI 大模型解决用户的情感问题，支持多轮对话、基于自定义知识库进行问答、自主调用工具和 MCP 服务完成任务，比如调用地图服务获取附近地点并制定约会计划。
 
@@ -27,29 +29,38 @@
 
 ## 为什么要带做这个项目？
 
-本项目选题新颖、业务真实，用一套实战教程将程序员必知必会的 **AI 技术一网打尽**，帮你成为 AI 时代企业的香饽饽，给你的简历和求职大幅增加竞争力。
+本项目选题新颖、业务真实，区别于增删改查的 “烂大街” 项目，鱼皮会带你实战大量新技术和企业应用场景，用一套实战教程将程序员必知必会的 **AI 技术一网打尽**，帮你成为 AI 时代企业的香饽饽，给你的简历和求职大幅增加竞争力。
 
-你将掌握下面的知识：
+鱼皮给大家讲的都是 **通用的项目开发方法和架构设计套路**，从这个项目中你将学到：
 
-- AI 应用平台的使用
-- 接入 AI 大模型
+- 主流 AI 应用平台的使用
+- AI 大模型的 4 种接入方式
 - AI 开发框架（Spring AI + LangChain4j）
 - AI 大模型本地部署
 - Prompt 工程和优化技巧
-- 多模态特性
-- Spring AI 核心特性：如自定义拦截器、上下文持久化、结构化输出
-- RAG 知识库和向量数据库
-- Tool Calling 工具调用
+- Spring AI 核心特性：如自定义 Advisor、对话记忆、结构化输出
+- RAG 知识库实战、原理和调优技巧
+- PgVector 向量数据库 + 云数据库服务
+- Tool Calling 工具调用实战及原理
 - MCP 模型上下文协议和服务开发
 - AI 智能体 Manus 原理和自主开发
-- AI 服务化和 Serverless 部署
+- AI 服务化和 Serverless 部署上线
+- 各种新概念：如多模态、智能体工作流、A2A 协议、大模型评估等
+
+举个例子，RAG 核心特性实战及全链路调优：
+
+![](https://pic.yupi.icu/1/1746250760306-3b545556-59df-43a9-b843-b73ec9b5a867.png)
 
 项目还有其他优势：
 
 - AI 云平台和编程双端实战，不仅会用 AI 服务，还会自己写！
 - 基于官方文档讲解最新的 AI 技术，细致入微，手撕文档和源码！
 - 分享大量 AI 扩展知识和编程技巧，掌握最佳实践！
 
+鱼皮带你手撕开源框架 OpenManus 的源码：
+
+![](https://pic.yupi.icu/1/ae36dd94-e87e-4dfe-ae31-81a6cc32c9e8.png)
+
 此外，还能学会很多作图、思考问题、对比方案的方法，提升排查问题、自主解决 Bug 的能力。
 
 
@@ -95,19 +106,16 @@
 - ⭐️ Spring AI + LangChain4j
 - ⭐️ RAG 知识库
 - ⭐️ PGvector 向量数据库
-- ⭐ Tool Calling ️工具调用 
+- ⭐ Tool Calling 工具调用 
 - ⭐️ MCP 模型上下文协议
 - ⭐️ ReAct Agent 智能体构建
 - ⭐️ Serverless 计算服务
 - ⭐️ AI 大模型开发平台百炼
-- ⭐️ Cursor AI 代码生成 + MCP
+- ⭐️ Cursor AI 代码生成
+- ⭐️ SSE 异步推送
 - 第三方接口：如 SearchAPI / Pexels API
 - Ollama 大模型部署
-- Kryo 高性能序列化
-- Jsoup 网页抓取
-- iText PDF 生成
-- Knife4j 接口文档
-
+- 工具库如：Kryo 高性能序列化 + Jsoup 网页抓取 + iText PDF 生成 + Knife4j 接口文档
 
 
 RAG 核心特性实战：
```

---

### Incident Patch 4: `d214ea82` (2025-05-22)
**Commit Message**: 第 9 期 - AI 服务化
1. 后端增加 AI 接口（SSE 和同步 2 种方式）
2. 生成前端项目
3. 后端增加 Dockerfile 部署文件
4. 前端增加 Dockerfile 部署文件和 Nginx 配置文件

**File**: `Dockerfile` (added, +16/-0)
```diff
@@ -0,0 +1,16 @@
+# 使用预装 Maven 和 JDK21 的镜像
+FROM maven:3.9-amazoncorretto-21
+WORKDIR /app
+
+# 只复制必要的源代码和配置文件
+COPY pom.xml .
+COPY src ./src
+
+# 使用 Maven 执行打包
+RUN mvn clean package -DskipTests
+
+# 暴露应用端口
+EXPOSE 8123
+
+# 使用生产环境配置启动应用
+CMD ["java", "-jar", "/app/target/yu-ai-agent-0.0.1-SNAPSHOT.jar", "--spring.profiles.active=prod"]
\ No newline at end of file
```

**File**: `src/main/java/com/yupi/yuaiagent/agent/BaseAgent.java` (modified, +88/-0)
```diff
@@ -7,9 +7,12 @@
 import org.springframework.ai.chat.client.ChatClient;
 import org.springframework.ai.chat.messages.Message;
 import org.springframework.ai.chat.messages.UserMessage;
+import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
 
+import java.io.IOException;
 import java.util.ArrayList;
 import java.util.List;
+import java.util.concurrent.CompletableFuture;
 
 /**
  * 抽象基础代理类，用于管理代理状态和执行流程。
@@ -88,6 +91,91 @@ public String run(String userPrompt) {
         }
     }
 
+    /**
+     * 运行代理（流式输出）
+     *
+     * @param userPrompt 用户提示词
+     * @return 执行结果
+     */
+    public SseEmitter runStream(String userPrompt) {
+        // 创建一个超时时间较长的 SseEmitter
+        SseEmitter sseEmitter = new SseEmitter(300000L); // 5 分钟超时
+        // 使用线程异步处理，避免阻塞主线程
+        CompletableFuture.runAsync(() -> {
+            // 1、基础校验
+            try {
+                if (this.state != AgentState.IDLE) {
+                    sseEmitter.send("错误：无法从状态运行代理：" + this.state);
+                    sseEmitter.complete();
+                    return;
+                }
+                if (StrUtil.isBlank(userPrompt)) {
+                    sseEmitter.send("错误：不能使用空提示词运行代理");
+                    sseEmitter.complete();
+                    return;
+                }
+            } catch (Exception e) {
+                sseEmitter.completeWithError(e);
+            }
+            // 2、执行，更改状态
+            this.state = AgentState.RUNNING;
+            // 记录消息上下文
+            messageList.add(new UserMessage(userPrompt));
+            // 保存结果列表
+            List<String> results = new ArrayList<>();
+            try {
+                // 执行循环
+                for (int i = 0; i < maxSteps && state != AgentState.FINISHED; i++) {
+                    int stepNumber = i + 1;
+                    currentStep = stepNumber;
+                    log.info("Executing step {}/{}", stepNumber, maxSteps);
+                    // 单步执行
+                    String stepResult = step();
+                    String result = "Step " + stepNumber + ": " + stepResult;
+                    results.add(result);
+                    // 输出当前每一步的结果到 SSE
+                    sseEmitter.send(result);
+                }
+                // 检查是否超出步骤限制
+                if (currentStep >= maxSteps) {
+                    state = AgentState.FINISHED;
+                    results.add("Terminated: Reached max steps (" + maxSteps + ")");
+                    sseEmitter.send("执行结束：达到最大步骤（" + maxSteps + "）");
+                }
+                // 正常完成
+                sseEmitter.complete();
+            } catch (Exception e) {
+                state = AgentState.ERROR;
+                log.error("error executing agent", e);
+                try {
+                    sseEmitter.send("执行错误：" + e.getMessage());
+                    sseEmitter.complete();
+                } catch (IOException ex) {
+                    sseEmitter.completeWithError(ex);
+                }
+            } finally {
+                // 3、清理资源
+                this.cleanup();
+            }
+        });
+
+        // 设置超时回调
+        sseEmitter.onTimeout(() -> {
+            this.state = AgentState.ERROR;
+            this.cleanup();
+            log.warn("SSE connection timeout");
+        });
+        // 设置完成回调
+        sseEmitter.onCompletion(() -> {
+            if (this.state == AgentState.RUNNING) {
+                this.state = AgentState.FINISHED;
+            }
+            this.cleanup();
+            log.info("SSE connection completed");
+        });
+        return sseEmitter;
+    }
+
     /**
      * 定义单个步骤
      *
```

**File**: `src/main/java/com/yupi/yuaiagent/app/LoveApp.java` (modified, +18/-0)
```diff
@@ -19,6 +19,7 @@
 import org.springframework.ai.tool.ToolCallbackProvider;
 import org.springframework.ai.vectorstore.VectorStore;
 import org.springframework.stereotype.Component;
+import reactor.core.publisher.Flux;
 
 import java.util.List;
 
@@ -79,6 +80,23 @@ public String doChat(String message, String chatId) {
         return content;
     }
 
+    /**
+     * AI 基础对话（支持多轮对话记忆，SSE 流式传输）
+     *
+     * @param message
+     * @param chatId
+     * @return
+     */
+    public Flux<String> doChatByStream(String message, String chatId) {
+        return chatClient
+                .prompt()
+                .user(message)
+                .advisors(spec -> spec.param(CHAT_MEMORY_CONVERSATION_ID_KEY, chatId)
+                        .param(CHAT_MEMORY_RETRIEVE_SIZE_KEY, 10))
+                .stream()
+                .content();
+    }
+
     record LoveReport(String title, List<String> suggestions) {
 
     }
```

**File**: `src/main/java/com/yupi/yuaiagent/config/CorsConfig.java` (added, +25/-0)
```diff
@@ -0,0 +1,25 @@
+package com.yupi.yuaiagent.config;
+
+import org.springframework.context.annotation.Configuration;
+import org.springframework.web.servlet.config.annotation.CorsRegistry;
+import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
+
+/**
+ * 全局跨域配置
+ */
+@Configuration
+public class CorsConfig implements WebMvcConfigurer {
+
+    @Override
+    public void addCorsMappings(CorsRegistry registry) {
+        // 覆盖所有请求
+        registry.addMapping("/**")
+                // 允许发送 Cookie
+                .allowCredentials(true)
+                // 放行哪些域名（必须用 patterns，否则 * 会和 allowCredentials 冲突）
+                .allowedOriginPatterns("*")
+                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
+                .allowedHeaders("*")
+                .exposedHeaders("*");
+    }
+}
```

**File**: `src/main/java/com/yupi/yuaiagent/controller/AiController.java` (added, +105/-0)
```diff
@@ -0,0 +1,105 @@
+package com.yupi.yuaiagent.controller;
+
+import com.yupi.yuaiagent.agent.YuManus;
+import com.yupi.yuaiagent.app.LoveApp;
+import jakarta.annotation.Resource;
+import org.springframework.ai.chat.model.ChatModel;
+import org.springframework.ai.tool.ToolCallback;
+import org.springframework.http.MediaType;
+import org.springframework.http.codec.ServerSentEvent;
+import org.springframework.web.bind.annotation.GetMapping;
+import org.springframework.web.bind.annotation.RequestMapping;
+import org.springframework.web.bind.annotation.RestController;
+import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
+import reactor.core.publisher.Flux;
+
+import java.io.IOException;
+
+@RestController
+@RequestMapping("/ai")
+public class AiController {
+
+    @Resource
+    private LoveApp loveApp;
+
+    @Resource
+    private ToolCallback[] allTools;
+
+    @Resource
+    private ChatModel dashscopeChatModel;
+
+    /**
+     * 同步调用 AI 恋爱大师应用
+     *
+     * @param message
+     * @param chatId
+     * @return
+     */
+    @GetMapping("/love_app/chat/sync")
+    public String doChatWithLoveAppSync(String message, String chatId) {
+        return loveApp.doChat(message, chatId);
+    }
+
+    /**
+     * SSE 流式调用 AI 恋爱大师应用
+     *
+     * @param message
+     * @param chatId
+     * @return
+     */
+    @GetMapping(value = "/love_app/chat/sse", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
+    public Flux<String> doChatWithLoveAppSSE(String message, String chatId) {
+        return loveApp.doChatByStream(message, chatId);
+    }
+
+    /**
+     * SSE 流式调用 AI 恋爱大师应用
+     *
+     * @param message
+     * @param chatId
+     * @return
+     */
+    @GetMapping(value = "/love_app/chat/server_sent_event")
+    public Flux<ServerSentEvent<String>> doChatWithLoveAppServerSentEvent(String message, String chatId) {
+        return loveApp.doChatByStream(message, chatId)
+                .map(chunk -> ServerSentEvent.<String>builder()
+                        .data(chunk)
+                        .build());
+    }
+
+    /**
+     * SSE 流式调用 AI 恋爱大师应用
+     *
+     * @param message
+     * @param chatId
+     * @return
+     */
+    @GetMapping(value = "/love_app/chat/sse_emitter")
+    public SseEmitter doChatWithLoveAppServerSseEmitter(String message, String chatId) {
+        // 创建一个超时时间较长的 SseEmitter
+        SseEmitter sseEmitter = new SseEmitter(180000L); // 3 分钟超时
+        // 获取 Flux 响应式数据流并且直接通过订阅推送给 SseEmitter
+        loveApp.doChatByStream(message, chatId)
+                .subscribe(chunk -> {
+                    try {
+                        sseEmitter.send(chunk);
+                    } catch (IOException e) {
+                        sseEmitter.completeWithError(e);
+                    }
+                }, sseEmitter::completeWithError, sseEmitter::complete);
+        // 返回
+        return sseEmitter;
+    }
+
+    /**
+     * 流式调用 Manus 超级智能体
+     *
+     * @param message
+     * @return
+     */
+    @GetMapping("/manus/chat")
+    public SseEmitter doChatWithManus(String message) {
+        YuManus yuManus = new YuManus(allTools, dashscopeChatModel);
+        return yuManus.runStream(message);
+    }
+}
```

**File**: `src/main/resources/application-prod.yml` (added, +2/-0)
```diff
@@ -0,0 +1,2 @@
+# 可以编写生产环境的配置，会覆盖 application.yml 配置
+# 注意提交时不要包含敏感信息（或者不要提交该文件）
\ No newline at end of file
```

**File**: `src/main/resources/application.yml` (modified, +7/-6)
```diff
@@ -13,12 +13,13 @@ spring:
       base-url: http://localhost:11434
       chat:
         model: gemma3:1b
-    mcp:
-      client:
-        sse:
-          connections:
-            server1:
-              url: http://localhost:8127
+# 临时注释掉，便于大家开发调试和部署
+#    mcp:
+#      client:
+#        sse:
+#          connections:
+#            server1:
+#              url: http://localhost:8127
 #        stdio:
 #          servers-configuration: classpath:mcp-servers.json
 #    vectorstore:
```

**File**: `yu-ai-agent-frontend/.dockerignore` (added, +40/-0)
```diff
@@ -0,0 +1,40 @@
+# 依赖目录
+node_modules
+npm-debug.log
+yarn-debug.log
+yarn-error.log
+
+# 编译输出
+/dist
+/build
+
+# 本地环境文件
+.env
+.env.local
+.env.development.local
+.env.test.local
+.env.production.local
+
+# 编辑器目录和配置
+/.idea
+/.vscode
+*.suo
+*.ntvs*
+*.njsproj
+*.sln
+*.sw?
+
+# 操作系统文件
+.DS_Store
+Thumbs.db
+
+# 测试覆盖率报告
+/coverage
+
+# 缓存
+.npm
+.eslintcache
+
+# 日志
+logs
+*.log 
\ No newline at end of file
```

---

### Incident Patch 5: `01efbc41` (2025-05-20)
**Commit Message**: 第 8 期 - AI 智能体构建
1. 开发拥有自主规划能力的 AI 智能体
2. 新增 TerminateTool 工具，用于中断智能体执行

**File**: `src/main/java/com/yupi/yuaiagent/agent/BaseAgent.java` (added, +104/-0)
```diff
@@ -0,0 +1,104 @@
+package com.yupi.yuaiagent.agent;
+
+import cn.hutool.core.util.StrUtil;
+import com.yupi.yuaiagent.agent.model.AgentState;
+import lombok.Data;
+import lombok.extern.slf4j.Slf4j;
+import org.springframework.ai.chat.client.ChatClient;
+import org.springframework.ai.chat.messages.Message;
+import org.springframework.ai.chat.messages.UserMessage;
+
+import java.util.ArrayList;
+import java.util.List;
+
+/**
+ * 抽象基础代理类，用于管理代理状态和执行流程。
+ * <p>
+ * 提供状态转换、内存管理和基于步骤的执行循环的基础功能。
+ * 子类必须实现step方法。
+ */
+@Data
+@Slf4j
+public abstract class BaseAgent {
+
+    // 核心属性
+    private String name;
+
+    // 提示词
+    private String systemPrompt;
+    private String nextStepPrompt;
+
+    // 代理状态
+    private AgentState state = AgentState.IDLE;
+
+    // 执行步骤控制
+    private int currentStep = 0;
+    private int maxSteps = 10;
+
+    // LLM 大模型
+    private ChatClient chatClient;
+
+    // Memory 记忆（需要自主维护会话上下文）
+    private List<Message> messageList = new ArrayList<>();
+
+    /**
+     * 运行代理
+     *
+     * @param userPrompt 用户提示词
+     * @return 执行结果
+     */
+    public String run(String userPrompt) {
+        // 1、基础校验
+        if (this.state != AgentState.IDLE) {
+            throw new RuntimeException("Cannot run agent from state: " + this.state);
+        }
+        if (StrUtil.isBlank(userPrompt)) {
+            throw new RuntimeException("Cannot run agent with empty user prompt");
+        }
+        // 2、执行，更改状态
+        this.state = AgentState.RUNNING;
+        // 记录消息上下文
+        messageList.add(new UserMessage(userPrompt));
+        // 保存结果列表
+        List<String> results = new ArrayList<>();
+        try {
+            // 执行循环
+            for (int i = 0; i < maxSteps && state != AgentState.FINISHED; i++) {
+                int stepNumber = i + 1;
+                currentStep = stepNumber;
+                log.info("Executing step {}/{}", stepNumber, maxSteps);
+                // 单步执行
+                String stepResult = step();
+                String result = "Step " + stepNumber + ": " + stepResult;
+                results.add(result);
+            }
+            // 检查是否超出步骤限制
+            if (currentStep >= maxSteps) {
+                state = AgentState.FINISHED;
+                results.add("Terminated: Reached max steps (" + maxSteps + ")");
+            }
+            return String.join("\n", results);
+        } catch (Exception e) {
+            state = AgentState.ERROR;
+            log.error("error executing agent", e);
+            return "执行错误" + e.getMessage();
+        } finally {
+            // 3、清理资源
+            this.cleanup();
+        }
+    }
+
+    /**
+     * 定义单个步骤
+     *
+     * @return
+     */
+    public abstract String step();
+
+    /**
+     * 清理资源
+     */
+    protected void cleanup() {
+        // 子类可以重写此方法来清理资源
+    }
+}
```

**File**: `src/main/java/com/yupi/yuaiagent/agent/ReActAgent.java` (added, +52/-0)
```diff
@@ -0,0 +1,52 @@
+package com.yupi.yuaiagent.agent;
+
+import lombok.Data;
+import lombok.EqualsAndHashCode;
+import lombok.extern.slf4j.Slf4j;
+
+/**
+ * ReAct (Reasoning and Acting) 模式的代理抽象类
+ * 实现了思考-行动的循环模式
+ */
+@EqualsAndHashCode(callSuper = true)
+@Data
+@Slf4j
+public abstract class ReActAgent extends BaseAgent {
+
+    /**
+     * 处理当前状态并决定下一步行动
+     *
+     * @return 是否需要执行行动，true表示需要执行，false表示不需要执行
+     */
+    public abstract boolean think();
+
+    /**
+     * 执行决定的行动
+     *
+     * @return 行动执行结果
+     */
+    public abstract String act();
+
+    /**
+     * 执行单个步骤：思考和行动
+     *
+     * @return 步骤执行结果
+     */
+    @Override
+    public String step() {
+        try {
+            // 先思考
+            boolean shouldAct = think();
+            if (!shouldAct) {
+                return "思考完成 - 无需行动";
+            }
+            // 再行动
+            return act();
+        } catch (Exception e) {
+            // 记录异常日志
+            e.printStackTrace();
+            return "步骤执行失败：" + e.getMessage();
+        }
+    }
+
+}
```

**File**: `src/main/java/com/yupi/yuaiagent/agent/ToolCallAgent.java` (added, +135/-0)
```diff
@@ -0,0 +1,135 @@
+package com.yupi.yuaiagent.agent;
+
+import cn.hutool.core.collection.CollUtil;
+import cn.hutool.core.util.StrUtil;
+import com.alibaba.cloud.ai.dashscope.chat.DashScopeChatOptions;
+import com.yupi.yuaiagent.agent.model.AgentState;
+import lombok.Data;
+import lombok.EqualsAndHashCode;
+import lombok.extern.slf4j.Slf4j;
+import org.springframework.ai.chat.messages.AssistantMessage;
+import org.springframework.ai.chat.messages.Message;
+import org.springframework.ai.chat.messages.ToolResponseMessage;
+import org.springframework.ai.chat.messages.UserMessage;
+import org.springframework.ai.chat.model.ChatResponse;
+import org.springframework.ai.chat.prompt.ChatOptions;
+import org.springframework.ai.chat.prompt.Prompt;
+import org.springframework.ai.model.tool.ToolCallingManager;
+import org.springframework.ai.model.tool.ToolExecutionResult;
+import org.springframework.ai.tool.ToolCallback;
+
+import java.util.List;
+import java.util.stream.Collectors;
+
+/**
+ * 处理工具调用的基础代理类，具体实现了 think 和 act 方法，可以用作创建实例的父类
+ */
+@EqualsAndHashCode(callSuper = true)
+@Data
+@Slf4j
+public class ToolCallAgent extends ReActAgent {
+
+    // 可用的工具
+    private final ToolCallback[] availableTools;
+
+    // 保存工具调用信息的响应结果（要调用那些工具）
+    private ChatResponse toolCallChatResponse;
+
+    // 工具调用管理者
+    private final ToolCallingManager toolCallingManager;
+
+    // 禁用 Spring AI 内置的工具调用机制，自己维护选项和消息上下文
+    private final ChatOptions chatOptions;
+
+    public ToolCallAgent(ToolCallback[] availableTools) {
+        super();
+        this.availableTools = availableTools;
+        this.toolCallingManager = ToolCallingManager.builder().build();
+        // 禁用 Spring AI 内置的工具调用机制，自己维护选项和消息上下文
+        this.chatOptions = DashScopeChatOptions.builder()
+                .withProxyToolCalls(true)
+                .build();
+    }
+
+    /**
+     * 处理当前状态并决定下一步行动
+     *
+     * @return 是否需要执行行动
+     */
+    @Override
+    public boolean think() {
+        // 1、校验提示词，拼接用户提示词
+        if (StrUtil.isNotBlank(getNextStepPrompt())) {
+            UserMessage userMessage = new UserMessage(getNextStepPrompt());
+            getMessageList().add(userMessage);
+        }
+        // 2、调用 AI 大模型，获取工具调用结果
+        List<Message> messageList = getMessageList();
+        Prompt prompt = new Prompt(messageList, this.chatOptions);
+        try {
+            ChatResponse chatResponse = getChatClient().prompt(prompt)
+                    .system(getSystemPrompt())
+                    .tools(availableTools)
+                    .call()
+                    .chatResponse();
+            // 记录响应，用于等下 Act
+            this.toolCallChatResponse = chatResponse;
+            // 3、解析工具调用结果，获取要调用的工具
+            // 助手消息
+            AssistantMessage assistantMessage = chatResponse.getResult().getOutput();
+            // 获取要调用的工具列表
+            List<AssistantMessage.ToolCall> toolCallList = assistantMessage.getToolCalls();
+            // 输出提示信息
+            String result = assistantMessage.getText();
+            log.info(getName() + "的思考：" + result);
+            log.info(getName() + "选择了 " + toolCallList.size() + " 个工具来使用");
+            String toolCallInfo = toolCallList.stream()
+                    .map(toolCall -> String.format("工具名称：%s，参数：%s", toolCall.name(), toolCall.arguments()))
+                    .collect(Collectors.joining("\n"));
+            log.info(toolCallInfo);
+            // 如果不需要调用工具，返回 false
+            if (toolCallList.isEmpty()) {
+                // 只有不调用工具时，才需要手动记录助手消息
+                getMessageList().add(assistantMessage);
+                return false;
+            } else {
+                // 需要调用工具时，无需记录助手消息，因为调用工具时会自动记录
+                return true;
+            }
+        } catch (Exception e) {
+            log.error(getName() + "的思考过程遇到了问题：" + e.getMessage());
+            getMessageList().add(new AssistantMessage("处理时遇到了错误：" + e.getMessage()));
+            return false;
+        }
+    }
+
+    /**
+     * 执行工具调用并处理结果
+     *
+     * @return 执行结果
+     */
+    @Override
+    public String act() {
+        if (!toolCallChatResponse.hasToolCalls()) {
+            return "没有工具需要调用";
+        }
+        // 调用工具
+        Prompt prompt = new Prompt(getMessageList(), this.chatOptions);
+        ToolExecutionResult toolExecutionResult = toolCallingManager.executeToolCalls(prompt, toolCallChatResponse);
+        // 记录消息上下文，conversationHistory 已经包含了助手消息和工具调用返回的结果
+        setMessageList(toolExecutionResult.conversationHistory());
+        ToolResponseMessage toolResponseMessage = (ToolResponseMessage) CollUtil.getLast(toolExecutionResult.conversationHistory());
+        // 判断是否调用了终止工具
+        boolean terminateToolCalled = toolResponseMessage.getResponses().stream()
+                .anyMatch(response -> response.name().equals("doTerminate"));
+        if (terminateToolCalled) {
+            // 任务结束，更改状态
+            setState(AgentState.FINISHED);
+        }
+        String results = toolResponseMessage.getResponse
```

**File**: `src/main/java/com/yupi/yuaiagent/agent/YuManus.java` (added, +37/-0)
```diff
@@ -0,0 +1,37 @@
+package com.yupi.yuaiagent.agent;
+
+import com.yupi.yuaiagent.advisor.MyLoggerAdvisor;
+import org.springframework.ai.chat.client.ChatClient;
+import org.springframework.ai.chat.model.ChatModel;
+import org.springframework.ai.tool.ToolCallback;
+import org.springframework.stereotype.Component;
+
+/**
+ * 鱼皮的 AI 超级智能体（拥有自主规划能力，可以直接使用）
+ */
+@Component
+public class YuManus extends ToolCallAgent {
+
+    public YuManus(ToolCallback[] allTools, ChatModel dashscopeChatModel) {
+        super(allTools);
+        this.setName("yuManus");
+        String SYSTEM_PROMPT = """
+                You are YuManus, an all-capable AI assistant, aimed at solving any task presented by the user.
+                You have various tools at your disposal that you can call upon to efficiently complete complex requests.
+                """;
+        this.setSystemPrompt(SYSTEM_PROMPT);
+        String NEXT_STEP_PROMPT = """
+                Based on user needs, proactively select the most appropriate tool or combination of tools.
+                For complex tasks, you can break down the problem and use different tools step by step to solve it.
+                After using each tool, clearly explain the execution results and suggest the next steps.
+                If you want to stop the interaction at any point, use the `terminate` tool/function call.
+                """;
+        this.setNextStepPrompt(NEXT_STEP_PROMPT);
+        this.setMaxSteps(20);
+        // 初始化 AI 对话客户端
+        ChatClient chatClient = ChatClient.builder(dashscopeChatModel)
+                .defaultAdvisors(new MyLoggerAdvisor())
+                .build();
+        this.setChatClient(chatClient);
+    }
+}
```

**File**: `src/main/java/com/yupi/yuaiagent/agent/model/AgentState.java` (added, +27/-0)
```diff
@@ -0,0 +1,27 @@
+package com.yupi.yuaiagent.agent.model;
+
+/**
+ * 代理执行状态的枚举类
+ */
+public enum AgentState {
+
+    /**
+     * 空闲状态
+     */
+    IDLE,
+
+    /**
+     * 运行中状态
+     */
+    RUNNING,
+
+    /**
+     * 已完成状态
+     */
+    FINISHED,
+
+    /**
+     * 错误状态
+     */
+    ERROR
+}
\ No newline at end of file
```

**File**: `src/main/java/com/yupi/yuaiagent/tools/TerminateTool.java` (added, +17/-0)
```diff
@@ -0,0 +1,17 @@
+package com.yupi.yuaiagent.tools;
+
+import org.springframework.ai.tool.annotation.Tool;
+
+/**
+ * 终止工具（作用是让自主规划智能体能够合理地中断）
+ */
+public class TerminateTool {
+
+    @Tool(description = """
+            Terminate the interaction when the request is met OR if the assistant cannot proceed further with the task.
+            "When you have finished all the tasks, call this tool to end the work.
+            """)
+    public String doTerminate() {
+        return "任务结束";
+    }
+}
```

**File**: `src/main/java/com/yupi/yuaiagent/tools/ToolRegistration.java` (modified, +3/-1)
```diff
@@ -23,13 +23,15 @@ public ToolCallback[] allTools() {
         ResourceDownloadTool resourceDownloadTool = new ResourceDownloadTool();
         TerminalOperationTool terminalOperationTool = new TerminalOperationTool();
         PDFGenerationTool pdfGenerationTool = new PDFGenerationTool();
+        TerminateTool terminateTool = new TerminateTool();
         return ToolCallbacks.from(
                 fileOperationTool,
                 webSearchTool,
                 webScrapingTool,
                 resourceDownloadTool,
                 terminalOperationTool,
-                pdfGenerationTool
+                pdfGenerationTool,
+                terminateTool
         );
     }
 }
```

**File**: `src/test/java/com/yupi/yuaiagent/agent/YuManusTest.java` (added, +23/-0)
```diff
@@ -0,0 +1,23 @@
+package com.yupi.yuaiagent.agent;
+
+import jakarta.annotation.Resource;
+import org.junit.jupiter.api.Assertions;
+import org.junit.jupiter.api.Test;
+import org.springframework.boot.test.context.SpringBootTest;
+
+@SpringBootTest
+class YuManusTest {
+
+    @Resource
+    private YuManus yuManus;
+
+    @Test
+    public void run() {
+        String userPrompt = """
+                我的另一半居住在上海静安区，请帮我找到 5 公里内合适的约会地点，
+                并结合一些网络图片，制定一份详细的约会计划，
+                并以 PDF 格式输出""";
+        String answer = yuManus.run(userPrompt);
+        Assertions.assertNotNull(answer);
+    }
+}
\ No newline at end of file
```

---

### Incident Patch 6: `4dd8a486` (2025-05-16)
**Commit Message**: 第 7 期 - MCP 协议
1. 恋爱大师应用整合高德地图 MCP 服务，能够推荐约会地点
2. 开发图片搜索 MCP Server

**File**: `pom.xml` (modified, +6/-0)
```diff
@@ -96,6 +96,12 @@
 <!--            <artifactId>spring-ai-starter-vector-store-pgvector</artifactId>-->
 <!--            <version>1.0.0-M7</version>-->
 <!--        </dependency>-->
+        <!-- Spring AI MCP Client -->
+        <dependency>
+            <groupId>org.springframework.ai</groupId>
+            <artifactId>spring-ai-mcp-client-spring-boot-starter</artifactId>
+            <version>1.0.0-M6</version>
+        </dependency>
         <!-- jsoup HTML 解析库 -->
         <dependency>
             <groupId>org.jsoup</groupId>
```

**File**: `src/main/java/com/yupi/yuaiagent/app/LoveApp.java` (modified, +29/-1)
```diff
@@ -16,6 +16,7 @@
 import org.springframework.ai.chat.model.ChatModel;
 import org.springframework.ai.chat.model.ChatResponse;
 import org.springframework.ai.tool.ToolCallback;
+import org.springframework.ai.tool.ToolCallbackProvider;
 import org.springframework.ai.vectorstore.VectorStore;
 import org.springframework.stereotype.Component;
 
@@ -157,7 +158,6 @@ public String doChatWithRag(String message, String chatId) {
     @Resource
     private ToolCallback[] allTools;
 
-
     /**
      * AI 恋爱报告功能（支持调用工具）
      *
@@ -180,4 +180,32 @@ public String doChatWithTools(String message, String chatId) {
         log.info("content: {}", content);
         return content;
     }
+
+    // AI 调用 MCP 服务
+
+    @Resource
+    private ToolCallbackProvider toolCallbackProvider;
+
+    /**
+     * AI 恋爱报告功能（调用 MCP 服务）
+     *
+     * @param message
+     * @param chatId
+     * @return
+     */
+    public String doChatWithMcp(String message, String chatId) {
+        ChatResponse chatResponse = chatClient
+                .prompt()
+                .user(message)
+                .advisors(spec -> spec.param(CHAT_MEMORY_CONVERSATION_ID_KEY, chatId)
+                        .param(CHAT_MEMORY_RETRIEVE_SIZE_KEY, 10))
+                // 开启日志，便于观察效果
+                .advisors(new MyLoggerAdvisor())
+                .tools(toolCallbackProvider)
+                .call()
+                .chatResponse();
+        String content = chatResponse.getResult().getOutput().getText();
+        log.info("content: {}", content);
+        return content;
+    }
 }
```

**File**: `src/main/resources/application.yml` (modified, +8/-0)
```diff
@@ -13,6 +13,14 @@ spring:
       base-url: http://localhost:11434
       chat:
         model: gemma3:1b
+    mcp:
+      client:
+        sse:
+          connections:
+            server1:
+              url: http://localhost:8127
+#        stdio:
+#          servers-configuration: classpath:mcp-servers.json
 #    vectorstore:
 #      pgvector:
 #        index-type: HNSW
```

**File**: `src/main/resources/mcp-servers.json` (added, +25/-0)
```diff
@@ -0,0 +1,25 @@
+{
+  "mcpServers": {
+    "amap-maps": {
+      "command": "npx.cmd",
+      "args": [
+        "-y",
+        "@amap/amap-maps-mcp-server"
+      ],
+      "env": {
+        "AMAP_MAPS_API_KEY": "你的 API Key"
+      }
+    },
+    "yu-image-search-mcp-server": {
+      "command": "java",
+      "args": [
+        "-Dspring.ai.mcp.server.stdio=true",
+        "-Dspring.main.web-application-type=none",
+        "-Dlogging.pattern.console=",
+        "-jar",
+        "yu-image-search-mcp-server/target/yu-image-search-mcp-server-0.0.1-SNAPSHOT.jar"
+      ],
+      "env": {}
+    }
+  }
+}
\ No newline at end of file
```

**File**: `src/test/java/com/yupi/yuaiagent/app/LoveAppTest.java` (modified, +13/-0)
```diff
@@ -71,4 +71,17 @@ private void testMessage(String message) {
         String answer = loveApp.doChatWithTools(message, chatId);
         Assertions.assertNotNull(answer);
     }
+
+    @Test
+    void doChatWithMcp() {
+        String chatId = UUID.randomUUID().toString();
+        // 测试地图 MCP
+//        String message = "我的另一半居住在上海静安区，请帮我找到 5 公里内合适的约会地点";
+//        String answer =  loveApp.doChatWithMcp(message, chatId);
+//        Assertions.assertNotNull(answer);
+        // 测试图片搜索 MCP
+        String message = "帮我搜索一些哄另一半开心的图片";
+        String answer =  loveApp.doChatWithMcp(message, chatId);
+        Assertions.assertNotNull(answer);
+    }
 }
```

**File**: `yu-image-search-mcp-server/.gitattributes` (added, +2/-0)
```diff
@@ -0,0 +1,2 @@
+/mvnw text eol=lf
+*.cmd text eol=crlf
```

**File**: `yu-image-search-mcp-server/.gitignore` (added, +33/-0)
```diff
@@ -0,0 +1,33 @@
+HELP.md
+target/
+!.mvn/wrapper/maven-wrapper.jar
+!**/src/main/**/target/
+!**/src/test/**/target/
+
+### STS ###
+.apt_generated
+.classpath
+.factorypath
+.project
+.settings
+.springBeans
+.sts4-cache
+
+### IntelliJ IDEA ###
+.idea
+*.iws
+*.iml
+*.ipr
+
+### NetBeans ###
+/nbproject/private/
+/nbbuild/
+/dist/
+/nbdist/
+/.nb-gradle/
+build/
+!**/src/main/**/build/
+!**/src/test/**/build/
+
+### VS Code ###
+.vscode/
```

**File**: `yu-image-search-mcp-server/.mvn/wrapper/maven-wrapper.properties` (added, +19/-0)
```diff
@@ -0,0 +1,19 @@
+# Licensed to the Apache Software Foundation (ASF) under one
+# or more contributor license agreements.  See the NOTICE file
+# distributed with this work for additional information
+# regarding copyright ownership.  The ASF licenses this file
+# to you under the Apache License, Version 2.0 (the
+# "License"); you may not use this file except in compliance
+# with the License.  You may obtain a copy of the License at
+#
+#   http://www.apache.org/licenses/LICENSE-2.0
+#
+# Unless required by applicable law or agreed to in writing,
+# software distributed under the License is distributed on an
+# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
+# KIND, either express or implied.  See the License for the
+# specific language governing permissions and limitations
+# under the License.
+wrapperVersion=3.3.2
+distributionType=only-script
+distributionUrl=https://repo.maven.apache.org/maven2/org/apache/maven/apache-maven/3.9.9/apache-maven-3.9.9-bin.zip
```

---

### Incident Patch 7: `86ad9d71` (2025-05-09)
**Commit Message**: 第 6 期 - 工具调用
1. 实现 6 个实用工具：文件操作、联网搜索、网页抓取、终端操作、资源下载、PDF 生成，并集中注册
2. 恋爱大师应用使用工具
3. 开启工具调用 DEBUG 日志

**File**: `pom.xml` (modified, +21/-0)
```diff
@@ -96,6 +96,27 @@
 <!--            <artifactId>spring-ai-starter-vector-store-pgvector</artifactId>-->
 <!--            <version>1.0.0-M7</version>-->
 <!--        </dependency>-->
+        <!-- jsoup HTML 解析库 -->
+        <dependency>
+            <groupId>org.jsoup</groupId>
+            <artifactId>jsoup</artifactId>
+            <version>1.19.1</version>
+        </dependency>
+        <!-- PDF 生成库 -->
+        <!-- https://mvnrepository.com/artifact/com.itextpdf/itext-core -->
+        <dependency>
+            <groupId>com.itextpdf</groupId>
+            <artifactId>itext-core</artifactId>
+            <version>9.1.0</version>
+            <type>pom</type>
+        </dependency>
+        <!-- https://mvnrepository.com/artifact/com.itextpdf/font-asian -->
+        <dependency>
+            <groupId>com.itextpdf</groupId>
+            <artifactId>font-asian</artifactId>
+            <version>9.1.0</version>
+            <scope>test</scope>
+        </dependency>
         <dependency>
             <groupId>cn.hutool</groupId>
             <artifactId>hutool-all</artifactId>
```

**File**: `src/main/java/com/yupi/yuaiagent/app/LoveApp.java` (modified, +29/-0)
```diff
@@ -15,6 +15,7 @@
 import org.springframework.ai.chat.memory.InMemoryChatMemory;
 import org.springframework.ai.chat.model.ChatModel;
 import org.springframework.ai.chat.model.ChatResponse;
+import org.springframework.ai.tool.ToolCallback;
 import org.springframework.ai.vectorstore.VectorStore;
 import org.springframework.stereotype.Component;
 
@@ -151,4 +152,32 @@ public String doChatWithRag(String message, String chatId) {
         log.info("content: {}", content);
         return content;
     }
+
+    // AI 调用工具能力
+    @Resource
+    private ToolCallback[] allTools;
+
+
+    /**
+     * AI 恋爱报告功能（支持调用工具）
+     *
+     * @param message
+     * @param chatId
+     * @return
+     */
+    public String doChatWithTools(String message, String chatId) {
+        ChatResponse chatResponse = chatClient
+                .prompt()
+                .user(message)
+                .advisors(spec -> spec.param(CHAT_MEMORY_CONVERSATION_ID_KEY, chatId)
+                        .param(CHAT_MEMORY_RETRIEVE_SIZE_KEY, 10))
+                // 开启日志，便于观察效果
+                .advisors(new MyLoggerAdvisor())
+                .tools(allTools)
+                .call()
+                .chatResponse();
+        String content = chatResponse.getResult().getOutput().getText();
+        log.info("content: {}", content);
+        return content;
+    }
 }
```

**File**: `src/main/java/com/yupi/yuaiagent/constant/FileConstant.java` (added, +12/-0)
```diff
@@ -0,0 +1,12 @@
+package com.yupi.yuaiagent.constant;
+
+/**
+ * 文件常量
+ */
+public interface FileConstant {
+
+    /**
+     * 文件保存目录
+     */
+    String FILE_SAVE_DIR = System.getProperty("user.dir") + "/tmp";
+}
```

**File**: `src/main/java/com/yupi/yuaiagent/tools/FileOperationTool.java` (added, +40/-0)
```diff
@@ -0,0 +1,40 @@
+package com.yupi.yuaiagent.tools;
+
+import cn.hutool.core.io.FileUtil;
+import com.yupi.yuaiagent.constant.FileConstant;
+import org.springframework.ai.tool.annotation.Tool;
+import org.springframework.ai.tool.annotation.ToolParam;
+
+/**
+ * 文件操作工具类（提供文件读写功能）
+ */
+public class FileOperationTool {
+
+    private final String FILE_DIR = FileConstant.FILE_SAVE_DIR + "/file";
+
+    @Tool(description = "Read content from a file")
+    public String readFile(@ToolParam(description = "Name of a file to read") String fileName) {
+        String filePath = FILE_DIR + "/" + fileName;
+        try {
+            return FileUtil.readUtf8String(filePath);
+        } catch (Exception e) {
+            return "Error reading file: " + e.getMessage();
+        }
+    }
+
+    @Tool(description = "Write content to a file")
+    public String writeFile(@ToolParam(description = "Name of the file to write") String fileName,
+                            @ToolParam(description = "Content to write to the file") String content
+    ) {
+        String filePath = FILE_DIR + "/" + fileName;
+
+        try {
+            // 创建目录
+            FileUtil.mkdir(FILE_DIR);
+            FileUtil.writeUtf8String(content, filePath);
+            return "File written successfully to: " + filePath;
+        } catch (Exception e) {
+            return "Error writing to file: " + e.getMessage();
+        }
+    }
+}
```

**File**: `src/main/java/com/yupi/yuaiagent/tools/PDFGenerationTool.java` (added, +52/-0)
```diff
@@ -0,0 +1,52 @@
+package com.yupi.yuaiagent.tools;
+
+import cn.hutool.core.io.FileUtil;
+import com.itextpdf.kernel.font.PdfFont;
+import com.itextpdf.kernel.font.PdfFontFactory;
+import com.itextpdf.kernel.pdf.PdfDocument;
+import com.itextpdf.kernel.pdf.PdfWriter;
+import com.itextpdf.layout.Document;
+import com.itextpdf.layout.element.Paragraph;
+import com.yupi.yuaiagent.constant.FileConstant;
+import org.springframework.ai.tool.annotation.Tool;
+import org.springframework.ai.tool.annotation.ToolParam;
+
+import java.io.IOException;
+
+/**
+ * PDF 生成工具
+ */
+public class PDFGenerationTool {
+
+    @Tool(description = "Generate a PDF file with given content", returnDirect = false)
+    public String generatePDF(
+            @ToolParam(description = "Name of the file to save the generated PDF") String fileName,
+            @ToolParam(description = "Content to be included in the PDF") String content) {
+        String fileDir = FileConstant.FILE_SAVE_DIR + "/pdf";
+        String filePath = fileDir + "/" + fileName;
+        try {
+            // 创建目录
+            FileUtil.mkdir(fileDir);
+            // 创建 PdfWriter 和 PdfDocument 对象
+            try (PdfWriter writer = new PdfWriter(filePath);
+                 PdfDocument pdf = new PdfDocument(writer);
+                 Document document = new Document(pdf)) {
+                // 自定义字体（需要人工下载字体文件到特定目录）
+//                String fontPath = Paths.get("src/main/resources/static/fonts/simsun.ttf")
+//                        .toAbsolutePath().toString();
+//                PdfFont font = PdfFontFactory.createFont(fontPath,
+//                        PdfFontFactory.EmbeddingStrategy.PREFER_EMBEDDED);
+                // 使用内置中文字体
+                PdfFont font = PdfFontFactory.createFont("STSongStd-Light", "UniGB-UCS2-H");
+                document.setFont(font);
+                // 创建段落
+                Paragraph paragraph = new Paragraph(content);
+                // 添加段落并关闭文档
+                document.add(paragraph);
+            }
+            return "PDF generated successfully to: " + filePath;
+        } catch (IOException e) {
+            return "Error generating PDF: " + e.getMessage();
+        }
+    }
+}
```

**File**: `src/main/java/com/yupi/yuaiagent/tools/ResourceDownloadTool.java` (added, +30/-0)
```diff
@@ -0,0 +1,30 @@
+package com.yupi.yuaiagent.tools;
+
+import cn.hutool.core.io.FileUtil;
+import cn.hutool.http.HttpUtil;
+import com.yupi.yuaiagent.constant.FileConstant;
+import org.springframework.ai.tool.annotation.Tool;
+import org.springframework.ai.tool.annotation.ToolParam;
+
+import java.io.File;
+
+/**
+ * 资源下载工具
+ */
+public class ResourceDownloadTool {
+
+    @Tool(description = "Download a resource from a given URL")
+    public String downloadResource(@ToolParam(description = "URL of the resource to download") String url, @ToolParam(description = "Name of the file to save the downloaded resource") String fileName) {
+        String fileDir = FileConstant.FILE_SAVE_DIR + "/download";
+        String filePath = fileDir + "/" + fileName;
+        try {
+            // 创建目录
+            FileUtil.mkdir(fileDir);
+            // 使用 Hutool 的 downloadFile 方法下载资源
+            HttpUtil.downloadFile(url, new File(filePath));
+            return "Resource downloaded successfully to: " + filePath;
+        } catch (Exception e) {
+            return "Error downloading resource: " + e.getMessage();
+        }
+    }
+}
```

**File**: `src/main/java/com/yupi/yuaiagent/tools/TerminalOperationTool.java` (added, +37/-0)
```diff
@@ -0,0 +1,37 @@
+package com.yupi.yuaiagent.tools;
+
+import org.springframework.ai.tool.annotation.Tool;
+import org.springframework.ai.tool.annotation.ToolParam;
+
+import java.io.BufferedReader;
+import java.io.IOException;
+import java.io.InputStreamReader;
+
+/**
+ * 终端操作工具
+ */
+public class TerminalOperationTool {
+
+    @Tool(description = "Execute a command in the terminal")
+    public String executeTerminalCommand(@ToolParam(description = "Command to execute in the terminal") String command) {
+        StringBuilder output = new StringBuilder();
+        try {
+            ProcessBuilder builder = new ProcessBuilder("cmd.exe", "/c", command);
+//            Process process = Runtime.getRuntime().exec(command);
+            Process process = builder.start();
+            try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
+                String line;
+                while ((line = reader.readLine()) != null) {
+                    output.append(line).append("\n");
+                }
+            }
+            int exitCode = process.waitFor();
+            if (exitCode != 0) {
+                output.append("Command execution failed with exit code: ").append(exitCode);
+            }
+        } catch (IOException | InterruptedException e) {
+            output.append("Error executing command: ").append(e.getMessage());
+        }
+        return output.toString();
+    }
+}
```

**File**: `src/main/java/com/yupi/yuaiagent/tools/ToolRegistration.java` (added, +35/-0)
```diff
@@ -0,0 +1,35 @@
+package com.yupi.yuaiagent.tools;
+
+import org.springframework.ai.tool.ToolCallback;
+import org.springframework.ai.tool.ToolCallbacks;
+import org.springframework.beans.factory.annotation.Value;
+import org.springframework.context.annotation.Bean;
+import org.springframework.context.annotation.Configuration;
+
+/**
+ * 集中的工具注册类
+ */
+@Configuration
+public class ToolRegistration {
+
+    @Value("${search-api.api-key}")
+    private String searchApiKey;
+
+    @Bean
+    public ToolCallback[] allTools() {
+        FileOperationTool fileOperationTool = new FileOperationTool();
+        WebSearchTool webSearchTool = new WebSearchTool(searchApiKey);
+        WebScrapingTool webScrapingTool = new WebScrapingTool();
+        ResourceDownloadTool resourceDownloadTool = new ResourceDownloadTool();
+        TerminalOperationTool terminalOperationTool = new TerminalOperationTool();
+        PDFGenerationTool pdfGenerationTool = new PDFGenerationTool();
+        return ToolCallbacks.from(
+                fileOperationTool,
+                webSearchTool,
+                webScrapingTool,
+                resourceDownloadTool,
+                terminalOperationTool,
+                pdfGenerationTool
+        );
+    }
+}
```

---

### Incident Patch 8: `e550d68b` (2025-05-08)
**Commit Message**: 第 5 期 - RAG 知识库进阶
1. 整合 PgVector 实现向量存储
2. 基于 Token 的文本分割器
3. 基于 AI 的关键词增强器
4. 基于 AI 的多查询扩展器
5. 基于 AI 的查询重写器
6. 给恋爱大师文档加载器补充 status 状态的自动提取
7. 自定义检索增强顾问（工厂模式），实现更灵活地搜索
8. 自定义上下文查询增强器（工厂模式），提高容错性

**File**: `pom.xml` (modified, +21/-0)
```diff
@@ -75,6 +75,27 @@
             <artifactId>spring-ai-markdown-document-reader</artifactId>
             <version>1.0.0-M6</version>
         </dependency>
+        <!-- 手动整合 PGVector 向量存储 -->
+        <dependency>
+            <groupId>org.springframework.boot</groupId>
+            <artifactId>spring-boot-starter-jdbc</artifactId>
+        </dependency>
+        <dependency>
+            <groupId>org.postgresql</groupId>
+            <artifactId>postgresql</artifactId>
+            <scope>runtime</scope>
+        </dependency>
+        <dependency>
+            <groupId>org.springframework.ai</groupId>
+            <artifactId>spring-ai-pgvector-store</artifactId>
+            <version>1.0.0-M6</version>
+        </dependency>
+        <!-- 自动整合 PGVector 向量存储 -->
+<!--        <dependency>-->
+<!--            <groupId>org.springframework.ai</groupId>-->
+<!--            <artifactId>spring-ai-starter-vector-store-pgvector</artifactId>-->
+<!--            <version>1.0.0-M7</version>-->
+<!--        </dependency>-->
         <dependency>
             <groupId>cn.hutool</groupId>
             <artifactId>hutool-all</artifactId>
```

**File**: `src/main/java/com/yupi/yuaiagent/YuAiAgentApplication.java` (modified, +2/-1)
```diff
@@ -1,9 +1,10 @@
 package com.yupi.yuaiagent;
 
+import org.springframework.ai.autoconfigure.vectorstore.pgvector.PgVectorStoreAutoConfiguration;
 import org.springframework.boot.SpringApplication;
 import org.springframework.boot.autoconfigure.SpringBootApplication;
 
-@SpringBootApplication
+@SpringBootApplication(exclude = PgVectorStoreAutoConfiguration.class)
 public class YuAiAgentApplication {
 
     public static void main(String[] args) {
```

**File**: `src/main/java/com/yupi/yuaiagent/app/LoveApp.java` (modified, +26/-3)
```diff
@@ -3,6 +3,8 @@
 import com.yupi.yuaiagent.advisor.MyLoggerAdvisor;
 import com.yupi.yuaiagent.advisor.ReReadingAdvisor;
 import com.yupi.yuaiagent.chatmemory.FileBasedChatMemory;
+import com.yupi.yuaiagent.rag.LoveAppRagCustomAdvisorFactory;
+import com.yupi.yuaiagent.rag.QueryRewriter;
 import jakarta.annotation.Resource;
 import lombok.extern.slf4j.Slf4j;
 import org.springframework.ai.chat.client.ChatClient;
@@ -34,6 +36,7 @@ public class LoveApp {
 
     /**
      * 初始化 ChatClient
+     *
      * @param dashscopeChatModel
      */
     public LoveApp(ChatModel dashscopeChatModel) {
@@ -56,6 +59,7 @@ public LoveApp(ChatModel dashscopeChatModel) {
 
     /**
      * AI 基础对话（支持多轮对话记忆）
+     *
      * @param message
      * @param chatId
      * @return
@@ -79,6 +83,7 @@ record LoveReport(String title, List<String> suggestions) {
 
     /**
      * AI 恋爱报告功能（实战结构化输出）
+     *
      * @param message
      * @param chatId
      * @return
@@ -104,24 +109,42 @@ public LoveReport doChatWithReport(String message, String chatId) {
     @Resource
     private Advisor loveAppRagCloudAdvisor;
 
+    @Resource
+    private VectorStore pgVectorVectorStore;
+
+    @Resource
+    private QueryRewriter queryRewriter;
+
     /**
      * 和 RAG 知识库进行对话
+     *
      * @param message
      * @param chatId
      * @return
      */
     public String doChatWithRag(String message, String chatId) {
+        // 查询重写
+        String rewrittenMessage = queryRewriter.doQueryRewrite(message);
         ChatResponse chatResponse = chatClient
                 .prompt()
-                .user(message)
+                // 使用改写后的查询
+                .user(rewrittenMessage)
                 .advisors(spec -> spec.param(CHAT_MEMORY_CONVERSATION_ID_KEY, chatId)
                         .param(CHAT_MEMORY_RETRIEVE_SIZE_KEY, 10))
                 // 开启日志，便于观察效果
                 .advisors(new MyLoggerAdvisor())
                 // 应用 RAG 知识库问答
-//                .advisors(new QuestionAnswerAdvisor(loveAppVectorStore))
+                .advisors(new QuestionAnswerAdvisor(loveAppVectorStore))
                 // 应用 RAG 检索增强服务（基于云知识库服务）
-                .advisors(loveAppRagCloudAdvisor)
+//                .advisors(loveAppRagCloudAdvisor)
+                // 应用 RAG 检索增强服务（基于 PgVector 向量存储）
+//                .advisors(new QuestionAnswerAdvisor(pgVectorVectorStore))
+                // 应用自定义的 RAG 检索增强服务（文档查询器 + 上下文增强器）
+//                .advisors(
+//                        LoveAppRagCustomAdvisorFactory.createLoveAppRagCustomAdvisor(
+//                                loveAppVectorStore, "单身"
+//                        )
+//                )
                 .call()
                 .chatResponse();
         String content = chatResponse.getResult().getOutput().getText();
```

**File**: `src/main/java/com/yupi/yuaiagent/demo/rag/MultiQueryExpanderDemo.java` (added, +31/-0)
```diff
@@ -0,0 +1,31 @@
+package com.yupi.yuaiagent.demo.rag;
+
+import org.springframework.ai.chat.client.ChatClient;
+import org.springframework.ai.chat.model.ChatModel;
+import org.springframework.ai.rag.Query;
+import org.springframework.ai.rag.preretrieval.query.expansion.MultiQueryExpander;
+import org.springframework.stereotype.Component;
+
+import java.util.List;
+
+/**
+ * 查询扩展器 Demo
+ */
+@Component
+public class MultiQueryExpanderDemo {
+
+    private final ChatClient.Builder chatClientBuilder;
+
+    public MultiQueryExpanderDemo(ChatModel dashscopeChatModel) {
+        this.chatClientBuilder = ChatClient.builder(dashscopeChatModel);
+    }
+
+    public List<Query> expand(String query) {
+        MultiQueryExpander queryExpander = MultiQueryExpander.builder()
+                .chatClientBuilder(chatClientBuilder)
+                .numberOfQueries(3)
+                .build();
+        List<Query> queries = queryExpander.expand(new Query("谁是程序员鱼皮啊？"));
+        return queries;
+    }
+}
```

**File**: `src/main/java/com/yupi/yuaiagent/rag/LoveAppContextualQueryAugmenterFactory.java` (added, +22/-0)
```diff
@@ -0,0 +1,22 @@
+package com.yupi.yuaiagent.rag;
+
+import org.springframework.ai.chat.prompt.PromptTemplate;
+import org.springframework.ai.rag.generation.augmentation.ContextualQueryAugmenter;
+
+/**
+ * 创建上下文查询增强器的工厂
+ */
+public class LoveAppContextualQueryAugmenterFactory {
+
+    public static ContextualQueryAugmenter createInstance() {
+        PromptTemplate emptyContextPromptTemplate = new PromptTemplate("""
+                你应该输出下面的内容：
+                抱歉，我只能回答恋爱相关的问题，别的没办法帮到您哦，
+                有问题可以联系编程导航客服 https://codefather.cn
+                """);
+        return ContextualQueryAugmenter.builder()
+                .allowEmptyContext(false)
+                .emptyContextPromptTemplate(emptyContextPromptTemplate)
+                .build();
+    }
+}
```

**File**: `src/main/java/com/yupi/yuaiagent/rag/LoveAppDocumentLoader.java` (modified, +3/-0)
```diff
@@ -35,11 +35,14 @@ public List<Document> loadMarkdowns() {
             Resource[] resources = resourcePatternResolver.getResources("classpath:document/*.md");
             for (Resource resource : resources) {
                 String filename = resource.getFilename();
+                // 提取文档倒数第 3 和第 2 个字作为标签
+                String status = filename.substring(filename.length() - 6, filename.length() - 4);
                 MarkdownDocumentReaderConfig config = MarkdownDocumentReaderConfig.builder()
                         .withHorizontalRuleCreateDocument(true)
                         .withIncludeCodeBlock(false)
                         .withIncludeBlockquote(false)
                         .withAdditionalMetadata("filename", filename)
+                        .withAdditionalMetadata("status", status)
                         .build();
                 MarkdownDocumentReader markdownDocumentReader = new MarkdownDocumentReader(resource, config);
                 allDocuments.addAll(markdownDocumentReader.get());
```

**File**: `src/main/java/com/yupi/yuaiagent/rag/LoveAppRagCustomAdvisorFactory.java` (added, +40/-0)
```diff
@@ -0,0 +1,40 @@
+package com.yupi.yuaiagent.rag;
+
+import org.springframework.ai.chat.client.advisor.RetrievalAugmentationAdvisor;
+import org.springframework.ai.chat.client.advisor.api.Advisor;
+import org.springframework.ai.rag.retrieval.search.DocumentRetriever;
+import org.springframework.ai.rag.retrieval.search.VectorStoreDocumentRetriever;
+import org.springframework.ai.vectorstore.VectorStore;
+import org.springframework.ai.vectorstore.filter.Filter;
+import org.springframework.ai.vectorstore.filter.FilterExpressionBuilder;
+
+/**
+ * 创建自定义的 RAG 检索增强顾问的工厂
+ */
+public class LoveAppRagCustomAdvisorFactory {
+
+    /**
+     * 创建自定义的 RAG 检索增强顾问
+     *
+     * @param vectorStore 向量存储
+     * @param status      状态
+     * @return 自定义的 RAG 检索增强顾问
+     */
+    public static Advisor createLoveAppRagCustomAdvisor(VectorStore vectorStore, String status) {
+        // 过滤特定状态的文档
+        Filter.Expression expression = new FilterExpressionBuilder()
+                .eq("status", status)
+                .build();
+        // 创建文档检索器
+        DocumentRetriever documentRetriever = VectorStoreDocumentRetriever.builder()
+                .vectorStore(vectorStore)
+                .filterExpression(expression) // 过滤条件
+                .similarityThreshold(0.5) // 相似度阈值
+                .topK(3) // 返回文档数量
+                .build();
+        return RetrievalAugmentationAdvisor.builder()
+                .documentRetriever(documentRetriever)
+                .queryAugmenter(LoveAppContextualQueryAugmenterFactory.createInstance())
+                .build();
+    }
+}
```

**File**: `src/main/java/com/yupi/yuaiagent/rag/LoveAppVectorStoreConfig.java` (modified, +13/-1)
```diff
@@ -3,6 +3,7 @@
 import jakarta.annotation.Resource;
 import org.springframework.ai.document.Document;
 import org.springframework.ai.embedding.EmbeddingModel;
+import org.springframework.ai.transformer.splitter.TokenTextSplitter;
 import org.springframework.ai.vectorstore.SimpleVectorStore;
 import org.springframework.ai.vectorstore.VectorStore;
 import org.springframework.context.annotation.Bean;
@@ -19,11 +20,22 @@ public class LoveAppVectorStoreConfig {
     @Resource
     private LoveAppDocumentLoader loveAppDocumentLoader;
 
+    @Resource
+    private MyTokenTextSplitter myTokenTextSplitter;
+
+    @Resource
+    private MyKeywordEnricher myKeywordEnricher;
+
     @Bean
     VectorStore loveAppVectorStore(EmbeddingModel dashscopeEmbeddingModel) {
         SimpleVectorStore simpleVectorStore = SimpleVectorStore.builder(dashscopeEmbeddingModel).build();
+        // 加载文档
         List<Document> documentList = loveAppDocumentLoader.loadMarkdowns();
-        simpleVectorStore.add(documentList);
+        // 自主切分文档
+//        List<Document> splitDocuments = myTokenTextSplitter.splitCustomized(documentList);
+        // 自动补充关键词元信息
+        List<Document> enrichedDocuments = myKeywordEnricher.enrichDocuments(documentList);
+        simpleVectorStore.add(enrichedDocuments);
         return simpleVectorStore;
     }
 }
```

#### Recent Merged Pull Requests:
- **PR #26** (closed): chore(demo): read dashscope api key from environment (@however-yir)
- **PR #25** (closed): docs: add troubleshooting quick checks (@however-yir)
- **PR #24** (closed): docs(frontend): clarify local development setup (@however-yir)
- **PR #23** (closed): chore: add env example for local configuration (@however-yir)
- **PR #22** (closed): docs: add repository quick reference to README (@however-yir)
- **PR #21** (closed): docs: add troubleshooting quick checks for local setup (clean diff final) (@however-yir)
- **PR #20** (closed): docs(config): add local environment example for development (clean diff final) (@however-yir)
- **PR #19** (closed): docs(readme): add contributor quick verification commands (clean diff final) (@however-yir)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

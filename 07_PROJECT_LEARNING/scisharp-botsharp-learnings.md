# Forensic Learning Record (Deep Inspection): SciSharp/BotSharp

> **Canonical Artifact**: `07_PROJECT_LEARNING/scisharp-botsharp-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/SciSharp/BotSharp](https://github.com/SciSharp/BotSharp))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T19:16:19.488Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `SciSharp/BotSharp`
- **Description**: AI Multi-Agent Framework in .NET
- **Primary Language / Ecosystem**: C#
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 3109 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/Infrastructure/BotSharp.Core/data/agents/01e2fc5c-2c89-4ec7-8470-7688608b496c/codes/src/demo.py`
```
import argparse
import json

def main():
    parser = argparse.ArgumentParser(description="Receive named arguments")
    parser.add_argument("--first_name", required=True, help="The first name")
    parser.add_argument("--last_name", required=True, help="The last name")

    args, _ = parser.parse_known_args()
    obj = {
        "first_name": args.first_name,
        "last_name":args.last_name
    }
    print(f"{json.dumps(obj)}")

if __name__ == "__main__":
    main()
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #768** (2024-12-02): **Fix sql_select dbtype**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > Looks good

- **Issue #757** (2024-11-20): **Fix validate_sql removing comments in sql.**
  *Symptoms*: 

- **Issue #726** (2025-03-12): **The Search box doesn't work**
  *Symptoms*: ![image](https://github.com/user-attachments/assets/df888c3a-7ea5-4b13-976f-174d16941da1) 
  **Post-Mortem & Fix Analysis**:
  > @hchen2020  what all are the steps to reproduce ?  cc @iceljc  @Oceania2018    
  > It’s been fixed.

- **Issue #268** (2024-01-31): **Web Driver is failing to do basic things**
  *Symptoms*: Hey,  When I ask agent to search from google it give me this error "Target page, context or browser has been closed Call log: - waiting for Locator("textarea").Nth(6)". Upon deeper inspection I found that playwright isn't click on the textarea when you open Google.com.  Upon further inspection I found that "html_parser" is not giving the right index of textarea somehow and is giving the wrong index number.   Kindly check if it also happing to you guys also.   ![image](https://github.com/SciSharp/BotSharp/assets/36962345/aebd2daa-bc61-4c9d-b9c4-bff4ec883381) 
  **Post-Mortem & Fix Analysis**:
  > This WebDriver is desinged by general purpose, so it's not finetued/ trained/ RAG by how to use Playwright to input text in Google website. So you have to tell WebDrive as much detail steps as possible. I fixed some code issue. and below is the prompt example: ![image](https://github.com/SciSharp/BotSharp/assets/1705364/0cc281a0-a644-41e4-a648-2c1caf8d3bac)  The words `search box` in the prompt of `input "BotSharp" in search box.` is playing the magic and is telling WebDrive where the input box is located. 
  > Thanks for the help @Oceania2018 

- **Issue #250** (2024-01-13): **add  mongo plugin actions**
  *Symptoms*: 1. Add  mongo plugin actions

- **Issue #16** (2019-01-05): **Update agent API is not ready？**
  *Symptoms*: Update agent info seems impossible，since API return 404. ![image](https://user-images.githubusercontent.com/24988472/46737019-0d66c100-cccd-11e8-8f20-ba326575b307.png) 

- **Issue #15** (2019-01-05): **Old agent can't be deleted?**
  *Symptoms*: When I try to delete an old agent, an `Unknown API error` has occurred.   ![image](https://user-images.githubusercontent.com/24988472/46713735-b8a25680-cc8a-11e8-97dd-77bec7af13f8.png) 

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

### Incident Patch 1: `c0f7feac` (2026-09-22)
**Commit Message**: gate live event trace level on debug build

Critical in a local debug build, Information otherwise.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>

**File**: `src/Plugins/BotSharp.Plugin.OpenAI/Providers/Live/LiveCompletionProvider.Events.cs` (modified, +12/-12)
```diff
@@ -85,12 +85,12 @@ private async Task<bool> HandleServerEvent(string type, string receivedText)
         {
             case LiveServerEventType.Error:
                 var error = JsonSerializer.Deserialize<LiveErrorEvent>(receivedText);
-                _logger.LogCritical("{Type}: {Payload}", type, receivedText);
+                _logger.Log(TraceLevel, "{Type}: {Payload}", type, receivedText);
                 // Command level failures leave the session usable; only transport errors end it.
                 return error?.Body?.Type == "server_error";
 
             case LiveServerEventType.SessionStarted:
-                _logger.LogCritical("{Type}: {Payload}", type, receivedText);
+                _logger.Log(TraceLevel, "{Type}: {Payload}", type, receivedText);
                 _isBlocking = false;
                 await _onModelReady();
 
@@ -100,20 +100,20 @@ private async Task<bool> HandleServerEvent(string type, string receivedText)
                 return false;
 
             case LiveServerEventType.SessionUpdated:
-                _logger.LogCritical("{Type}: {Payload}", type, receivedText);
+                _logger.Log(TraceLevel, "{Type}: {Payload}", type, receivedText);
                 return false;
 
             case LiveServerEventType.SessionClosed:
                 var closed = JsonSerializer.Deserialize<LiveSessionClosedEvent>(receivedText);
-                _logger.LogCritical("{Type}: reason {Reason}, billed {Seconds}s",
+                _logger.Log(TraceLevel, "{Type}: reason {Reason}, billed {Seconds}s",
                     type, closed?.Reason, closed?.Usage?.Seconds);
                 // Deliberately not flushed. A turn cut short by the session ending is not a
                 // completed turn, and its partial text has already been shown live.
                 return true;
 
             case LiveServerEventType.UsageUpdated:
                 var usage = JsonSerializer.Deserialize<LiveUsageUpdatedEvent>(receivedText);
-                _logger.LogCritical("{Type}: {Seconds}s, context {Ratio}",
+                _logger.Log(TraceLevel, "{Type}: {Seconds}s, context {Ratio}",
                     type, usage?.Usage?.Seconds, usage?.Usage?.ContextWindow?.UsageRatio);
                 return false;
 
@@ -122,27 +122,27 @@ private async Task<bool> HandleServerEvent(string type, string receivedText)
                 return false;
 
             case LiveServerEventType.OutputTranscriptDelta:
-                _logger.LogCritical("{Type}: {Payload}", type, receivedText);
+                _logger.Log(TraceLevel, "{Type}: {Payload}", type, receivedText);
                 await OnTranscriptDelta(receivedText, _outputTranscript, _outputTranscriptTimer, AgentRole.Assistant);
                 return false;
 
             case LiveServerEventType.InputTranscriptDelta:
-                _logger.LogCritical("{Type}: {Payload}", type, receivedText);
+                _logger.Log(TraceLevel, "{Type}: {Payload}", type, receivedText);
                 await OnTranscriptDelta(receivedText, _inputTranscript, _inputTranscriptTimer, AgentRole.User);
                 return false;
 
             case LiveServerEventType.ResponseEvent:
-                _logger.LogCritical("{Type}: {Payload}", type, receivedText);
+                _logger.Log(TraceLevel, "{Type}: {Payload}", type, receivedText);
                 OnBackendResponseEvent(receivedText);
                 return false;
 
             case LiveServerEventType.DelegationCreated:
-                _logger.LogCritical("{Type}: {Payload}", type, receivedText);
+                _logger.Log(TraceLevel, "{Type}: {Payload}", type, receivedText);
                 await OnDelegationCreated(receivedText);
                 return false;
 
             default:
-                _logger.LogCritical("{Type}: {Payload}", type, receivedText);
+                _logger.Log(TraceLevel, "{Type}: {Payload}", type, receivedText);
                 return false;
         }
     }
@@ -476,7 +
```

**File**: `src/Plugins/BotSharp.Plugin.OpenAI/Providers/Live/LiveCompletionProvider.cs` (modified, +11/-0)
```diff
@@ -23,6 +23,17 @@ public partial class LiveCompletionProvider : ILiveCompletion
     private readonly BotSharpOptions _botsharpOptions;
     private readonly OpenAiSettings _openAiSettings;
 
+    /// <summary>
+    /// Level for the event tracing below. A local debug build raises it to Critical so the live
+    /// traffic stands out in the console; anywhere else it stays at Information, where a running
+    /// call does not read as a fault.
+    /// </summary>
+#if DEBUG
+    private const LogLevel TraceLevel = LogLevel.Critical;
+#else
+    private const LogLevel TraceLevel = LogLevel.Information;
+#endif
+
     private string _model = LiveModelConstants.GPT_Live_1;
     private LlmRealtimeSession? _session;
     private RealtimeOptions? _realtimeOptions;
```

---

### Incident Patch 2: `336df669` (2026-09-22)
**Commit Message**: fix duplicate log

**File**: `src/Infrastructure/BotSharp.Core/Demo/Functions/GetWeatherFn.cs` (modified, +24/-24)
```diff
@@ -38,16 +38,16 @@ public async Task<bool> Execute(RoleDialogModel message)
 
         await Task.Delay(1500);
 
-#if DEBUG
-        var intermediateMsg = RoleDialogModel.From(message, AgentRole.Assistant, $"Here is your weather in {args?.City}");
-        messageHub.Push(new()
-        {
-            EventName = ChatEvent.OnIntermediateMessageReceivedFromAssistant,
-            Data = intermediateMsg,
-            RefId = conv.ConversationId,
-            SaveDataToDb = true
-        });
-#endif
+//#if DEBUG
+//        var intermediateMsg = RoleDialogModel.From(message, AgentRole.Assistant, $"Here is your weather in {args?.City}");
+//        messageHub.Push(new()
+//        {
+//            EventName = ChatEvent.OnIntermediateMessageReceivedFromAssistant,
+//            Data = intermediateMsg,
+//            RefId = conv.ConversationId,
+//            SaveDataToDb = true
+//        });
+//#endif
 
         message.Indication = $"Still working on it... Hold on, {args?.City}";
         messageHub.Push(new()
@@ -62,20 +62,20 @@ public async Task<bool> Execute(RoleDialogModel message)
         message.Content = $"It is a sunny day!";
         message.StopCompletion = false;
 
-#if DEBUG
-        var sidecar = _services.GetService<IConversationSideCar>();
-        if (sidecar != null)
-        {
-            var text = $"I want to know fun events in {args?.City}";
-            var states = new List<MessageState>
-            {
-                new() { Key = StateConst.CHANNEL, Value = ConversationChannel.Email }
-            };
-
-            var msg = await sidecar.SendMessage(message.CurrentAgentId, text, states: states);
-            message.Content = $"{message.Content} {msg.Content}";
-        }
-#endif
+//#if DEBUG
+//        var sidecar = _services.GetService<IConversationSideCar>();
+//        if (sidecar != null)
+//        {
+//            var text = $"I want to know fun events in {args?.City}";
+//            var states = new List<MessageState>
+//            {
+//                new() { Key = StateConst.CHANNEL, Value = ConversationChannel.Email }
+//            };
+
+//            var msg = await sidecar.SendMessage(message.CurrentAgentId, text, states: states);
+//            message.Content = $"{message.Content} {msg.Content}";
+//        }
+//#endif
 
         return true;
     }
```

**File**: `src/Plugins/BotSharp.Plugin.OpenAI/Providers/Live/LiveCompletionProvider.Events.cs` (modified, +12/-4)
```diff
@@ -301,7 +301,7 @@ private async Task DeliverOutputTranscript(string text, string messageId)
 
         try
         {
-            await ReportGenerated(text);
+            await ReportGenerated(text, messageId);
         }
         catch (Exception ex)
         {
@@ -376,8 +376,15 @@ private void FlushInputTranscript()
     /// <summary>
     /// Live voice time is billed per second rather than per token; token counts come from
     /// the backend handler and are zero until it has produced a response.
+    ///
+    /// Reports what the turn cost, nothing else. Prompt is left empty deliberately: the loggers
+    /// that listen on this hook treat a non-empty Prompt as the text sent to the model and write
+    /// it to the content log and the completion log on its own. A live turn has no such text -
+    /// the session instruction went out once, at session update - so filling it with the spoken
+    /// transcript put the assistant's own words in the log a second time, beside the response
+    /// entry <see cref="DeliverOutputTranscript"/> already produced.
     /// </summary>
-    private async Task ReportGenerated(string text)
+    private async Task ReportGenerated(string text, string messageId)
     {
         var usage = _lastBackendUsage;
         _lastBackendUsage = null;
@@ -387,13 +394,14 @@ private async Task ReportGenerated(string text)
         {
             await hook.AfterGenerated(new RoleDialogModel(AgentRole.Assistant, text)
             {
-                CurrentAgentId = _conn.CurrentAgentId
+                CurrentAgentId = _conn.CurrentAgentId,
+                MessageId = messageId
             },
             new TokenStatsModel
             {
                 Provider = Provider,
                 Model = _model,
-                Prompt = text,
+                Prompt = string.Empty,
                 TextInputTokens = (usage?.InputTokens ?? 0) - (usage?.InputTokenDetails?.CachedTokens ?? 0),
                 CachedTextInputTokens = usage?.InputTokenDetails?.CachedTokens ?? 0,
                 TextOutputTokens = usage?.OutputTokens ?? 0
```

**File**: `src/Plugins/BotSharp.Plugin.OpenAI/Providers/Live/LiveCompletionProvider.cs` (modified, +0/-4)
```diff
@@ -282,10 +282,6 @@ await SendEventToModel(new
                 }
             });
         }
-        else
-        {
-            throw new NotImplementedException($"Unrecognized role {message.Role}.");
-        }
     }
 
     public void SetModelName(string model)
```

---

### Incident Patch 3: `81d7f415` (2026-09-21)
**Commit Message**: 1.fix(routing): drop past tool results from the router conversation block
2.feat(conversation): trim tool results that older turns replay

**File**: `src/Infrastructure/BotSharp.Abstraction/Conversations/Settings/ConversationSetting.cs` (modified, +16/-0)
```diff
@@ -13,10 +13,26 @@ public class ConversationSetting
     public bool EnableStateLog { get; set; }
     public bool EnableTranslationMemory { get; set; }
     public CleanConversationSetting CleanSetting { get; set; } = new();
+    public ToolResultTrimSetting ToolResultTrim { get; set; } = new();
     public RateLimitSetting RateLimit { get; set; } = new();
     public FileSelectSetting? FileSelect { get; set; }
 }
 
+/// <summary>
+/// Caps what an older turn's tool result costs in the prompt. The turn that ran the tool always
+/// sees it whole; only what history replays is shortened.
+/// </summary>
+public class ToolResultTrimSetting
+{
+    public bool Enable { get; set; } = true;
+
+    /// <summary>How many of the most recent turns keep their tool results verbatim.</summary>
+    public int KeepTurns { get; set; } = 2;
+
+    /// <summary>A result longer than this, and older than <see cref="KeepTurns"/>, is shortened.</summary>
+    public int MaxLength { get; set; } = 500;
+}
+
 public class CleanConversationSetting
 {
     public bool Enable { get; set; }
```

**File**: `src/Infrastructure/BotSharp.Core/Conversations/ConversationPlugin.cs` (modified, +3/-0)
```diff
@@ -8,6 +8,7 @@
 using BotSharp.Abstraction.Settings;
 using BotSharp.Abstraction.Templating;
 using BotSharp.Core.Coding;
+using BotSharp.Core.Conversations.Hooks;
 using BotSharp.Core.Instructs;
 using BotSharp.Core.MessageHub;
 using BotSharp.Core.MessageHub.Observers;
@@ -72,6 +73,8 @@ public void RegisterDI(IServiceCollection services, IConfiguration config)
         services.AddScoped<ITokenStatistics, TokenStatistics>();
 
         services.AddScoped<IAgentUtilityHook, WebSearchUtilityHook>();
+
+        services.AddScoped<IConversationHook, ToolResultTrimHook>();
     }
 
     public bool AttachMenu(List<PluginMenuDef> menu)
```

**File**: `src/Infrastructure/BotSharp.Core/Conversations/Hooks/ToolResultTrimHook.cs` (added, +115/-0)
```diff
@@ -0,0 +1,115 @@
+using System.Text.RegularExpressions;
+using BotSharp.Abstraction.Conversations.Settings;
+
+namespace BotSharp.Core.Conversations.Hooks;
+
+/// <summary>
+/// Shortens the tool results an older turn replays into the prompt.
+/// </summary>
+/// <remarks>
+/// It runs where history is loaded, which is exactly the turn boundary: the messages a turn
+/// produces are appended to the list in memory and never pass through here, so the turn that ran
+/// a tool always reads its result whole. Only <c>Content</c> is touched -- the call itself stays
+/// intact, so a later turn can still tell that the function already ran, and storage keeps the
+/// full text either way.
+/// </remarks>
+public class ToolResultTrimHook : ConversationHookBase
+{
+    /// <summary>The opening of a structured document: a brace or bracket that starts one, not a word in prose.</summary>
+    private static readonly Regex StructuredStart = new(@"[{\[]\s*[""{\[\d-]", RegexOptions.Compiled);
+
+    private readonly IServiceProvider _services;
+    private readonly ConversationSetting _settings;
+    private readonly ILogger<ToolResultTrimHook> _logger;
+
+    public ToolResultTrimHook(
+        IServiceProvider services,
+        ConversationSetting settings,
+        ILogger<ToolResultTrimHook> logger)
+    {
+        _services = services;
+        _settings = settings;
+        _logger = logger;
+    }
+
+    public override string SelfId => string.Empty;
+
+    public override Task OnDialogsLoaded(List<RoleDialogModel> dialogs)
+    {
+        var setting = _settings.ToolResultTrim;
+        if (!setting.Enable || dialogs.IsNullOrEmpty())
+        {
+            return base.OnDialogsLoaded(dialogs);
+        }
+
+        // A turn is a message id: everything a turn derives carries the id of the message that
+        // started it. The current one is skipped as well, because a function that reloads the
+        // history mid-turn would otherwise be handed a shortened copy of what it just produced.
+        var currentMessageId = _services.GetRequiredService<IRoutingContext>().MessageId;
+        var recentTurns = dialogs
+            .Select(x => x.MessageId)
+            .Where(x => !string.IsNullOrEmpty(x))
+            .Distinct()
+            .TakeLast(Math.Max(setting.KeepTurns, 0))
+            .ToHashSet();
+
+        var trimmed = 0;
+        var saved = 0;
+
+        foreach (var dialog in dialogs)
+        {
+            if (dialog.Role != AgentRole.Function
+                || dialog.MessageId == currentMessageId
+                || recentTurns.Contains(dialog.MessageId)
+                || (dialog.Content?.Length ?? 0) <= setting.MaxLength)
+            {
+                continue;
+            }
+
+            var before = dialog.Content.Length;
+            dialog.Content = Shorten(dialog, setting.MaxLength);
+
+            trimmed++;
+            saved += before - dialog.Content.Length;
+        }
+
+        if (trimmed > 0)
+        {
+            _logger.LogInformation(
+                "[ToolResultTrim] {Count} tool result(s) older than {KeepTurns} turn(s) shortened, {Saved} characters kept out of the prompt.",
+                trimmed, setting.KeepTurns, saved);
+        }
+
+        return base.OnDialogsLoaded(dialogs);
+    }
+
+    /// <summary>
+    /// Keeps the head of a rendered result, whose useful part comes first, and replaces a
+    /// structured one outright: half a JSON document is not something a model can read, and it
+    /// cannot tell that the half it got is not the whole.
+    /// </summary>
+    /// <remarks>
+    /// The cut goes wherever comes first: where a structured value begins, or the length cap. A
+    /// tool is free to answer with a sentence and then a document -- an MCP server returning
+    /// several text blocks does exactly that -- and cutting inside the document would leave a
+    /// model something it cannot read and cannot tell is incomplete, while cutting in front of it
+    /
```

**File**: `src/Infrastructure/BotSharp.Core/Routing/RoutingService.GetConversationContent.cs` (modified, +18/-11)
```diff
@@ -5,28 +5,35 @@ public partial class RoutingService
     public async Task<string> GetConversationContent(List<RoleDialogModel> dialogs, int maxDialogCount = 100)
     {
         var agentService = _services.GetRequiredService<IAgentService>();
-        var conversation = "";
-        var conversationDialogs = dialogs.Where(x => !x.ExcludeFromContext).TakeLast(maxDialogCount).ToList();
+        var conversation = new StringBuilder();
+        // A tool result from an earlier turn says nothing about which agent should answer now.
+        var conversationDialogs = dialogs
+            .Where(x => !x.ExcludeFromContext)
+            .Where(x => x.Role != AgentRole.Function || x.MessageId == Context.MessageId)
+            .TakeLast(maxDialogCount)
+            .ToList();
         foreach (var dialog in conversationDialogs)
         {
-            var role = dialog.Role;
-            if (role != AgentRole.User)
+            var agent = dialog.Role == AgentRole.User ? null : await agentService.GetAgent(dialog.CurrentAgentId);
+            var name = agent?.Name ?? dialog.Role;
+
+            if (dialog.Role == AgentRole.User)
             {
-                var agent = await agentService.GetAgent(dialog.CurrentAgentId);
-                role = agent.Name;
+                // What the user said can arrive as a postback payload rather than as text
+                conversation.Append($"{name}: {dialog.LlmContent}\r\n");
             }
-
-            if (role == AgentRole.User)
+            else if (dialog.Role == AgentRole.Function)
             {
-                conversation += $"{role}: {dialog.Payload ?? dialog.Content}\r\n";
+                // A tool result is not something the agent said, so name the call it answers
+                conversation.Append($"{name}: Call function {dialog.FunctionName}({dialog.FunctionArgs}) => {dialog.Content}\r\n");
             }
             else
             {
                 // Assistant reply doesn't need help with payload
-                conversation += $"{role}: {dialog.Content}\r\n";
+                conversation.Append($"{name}: {dialog.Content}\r\n");
             }
         }
 
-        return conversation;
+        return conversation.ToString();
     }
 }
```

**File**: `src/Infrastructure/BotSharp.Core/Routing/RoutingService.InvokeAgent.cs` (modified, +4/-5)
```diff
@@ -133,11 +133,10 @@ private async Task<bool> InvokeFunction(
         }
         else
         {
-            // The function wrote the reply itself. The call is still worth a record, but kept out
-            // of context, since the assistant message that follows carries the same text.
-            var record = RoleDialogModel.From(message, role: AgentRole.Function);
-            record.ExcludeFromContext = true;
-            await Persist(record);
+            // The function wrote the reply itself, and the assistant message that follows repeats
+            // its text. The call is recorded anyway, and stays in context: it is the only thing
+            // telling a later turn that this function already ran.
+            await Persist(RoleDialogModel.From(message, role: AgentRole.Function));
 
             var msg = RoleDialogModel.From(message,
                 role: AgentRole.Assistant,
```

---

### Incident Patch 4: `83f518f5` (2026-09-16)
**Commit Message**: Merge pull request #1436 from m-sekhon/fix/plugin-loader-single-file-publish

Fix startup crash when published as self-contained single-file executable

**File**: `src/Infrastructure/BotSharp.Core/Plugins/PluginLoader.cs` (modified, +4/-1)
```diff
@@ -18,7 +18,10 @@ public class PluginLoader(IServiceCollection services,
 
     public void Load(Action<Assembly> loaded, string? plugin = null)
     {
-        _executingDir = Directory.GetParent(Assembly.GetEntryAssembly().Location).FullName;
+        // Assembly.GetEntryAssembly().Location is empty when the app is published
+        // as a self-contained single-file executable, which makes Directory.GetParent()
+        // throw. AppContext.BaseDirectory is populated correctly in that case too.
+        _executingDir = AppContext.BaseDirectory;
 
         settings.Assemblies.ToList().ForEach(assemblyName =>
         {
```

**File**: `tests/BotSharp.Core.UnitTests/Plugins/PluginLoaderTests.cs` (added, +55/-0)
```diff
@@ -0,0 +1,55 @@
+using System.Reflection;
+using BotSharp.Abstraction.Plugins;
+using BotSharp.Core.Plugins;
+using Microsoft.Extensions.Configuration;
+using Microsoft.Extensions.DependencyInjection;
+using Xunit;
+
+namespace BotSharp.Core.UnitTests.Plugins;
+
+public class PluginLoaderTests
+{
+    // Regression test for https://github.com/SciSharp/BotSharp/issues/669:
+    // PluginLoader used to derive its plugin search directory from
+    // Assembly.GetEntryAssembly().Location. .NET leaves that empty when the app
+    // is published as a self-contained single-file executable, which made
+    // Directory.GetParent(string.Empty) throw an ArgumentException before the
+    // app could even start. PluginLoader now uses AppContext.BaseDirectory,
+    // which resolves correctly in that scenario too.
+    [Fact]
+    public void Load_does_not_throw_and_resolves_executing_dir_from_app_context_base_directory()
+    {
+        var services = new ServiceCollection();
+        var config = new ConfigurationBuilder().Build();
+        var settings = new PluginSettings { Assemblies = [] };
+        var loader = new PluginLoader(services, config, settings);
+
+        var exception = Record.Exception(() => loader.Load(_ => { }));
+
+        Assert.Null(exception);
+
+        var executingDir = typeof(PluginLoader)
+            .GetField("_executingDir", BindingFlags.NonPublic | BindingFlags.Static)!
+            .GetValue(null) as string;
+
+        Assert.Equal(AppContext.BaseDirectory, executingDir);
+    }
+
+    [Fact]
+    public void Load_finds_and_loads_plugin_assembly_from_executing_dir()
+    {
+        // BotSharp.Core.Rules is a real ProjectReference of this test project, so its
+        // .dll is copied next to the test host's own assembly (AppContext.BaseDirectory) -
+        // the exact directory PluginLoader now searches for plugin assemblies.
+        var services = new ServiceCollection();
+        var config = new ConfigurationBuilder().Build();
+        var settings = new PluginSettings { Assemblies = ["BotSharp.Core.Rules"] };
+        var loader = new PluginLoader(services, config, settings);
+
+        Assembly? loadedAssembly = null;
+        loader.Load(assembly => loadedAssembly = assembly);
+
+        Assert.NotNull(loadedAssembly);
+        Assert.Equal("BotSharp.Core.Rules", loadedAssembly!.GetName().Name);
+    }
+}
```

---

### Incident Patch 5: `65314318` (2026-09-12)
**Commit Message**: Add regression tests for PluginLoader single-file publish fix

Covers the fix in the previous commit for #669: verifies
PluginLoader.Load() resolves its executing directory from
AppContext.BaseDirectory (not Assembly.GetEntryAssembly().Location),
and that it can still find and load a real plugin assembly from
that directory.

**File**: `tests/BotSharp.Core.UnitTests/Plugins/PluginLoaderTests.cs` (added, +55/-0)
```diff
@@ -0,0 +1,55 @@
+using System.Reflection;
+using BotSharp.Abstraction.Plugins;
+using BotSharp.Core.Plugins;
+using Microsoft.Extensions.Configuration;
+using Microsoft.Extensions.DependencyInjection;
+using Xunit;
+
+namespace BotSharp.Core.UnitTests.Plugins;
+
+public class PluginLoaderTests
+{
+    // Regression test for https://github.com/SciSharp/BotSharp/issues/669:
+    // PluginLoader used to derive its plugin search directory from
+    // Assembly.GetEntryAssembly().Location. .NET leaves that empty when the app
+    // is published as a self-contained single-file executable, which made
+    // Directory.GetParent(string.Empty) throw an ArgumentException before the
+    // app could even start. PluginLoader now uses AppContext.BaseDirectory,
+    // which resolves correctly in that scenario too.
+    [Fact]
+    public void Load_does_not_throw_and_resolves_executing_dir_from_app_context_base_directory()
+    {
+        var services = new ServiceCollection();
+        var config = new ConfigurationBuilder().Build();
+        var settings = new PluginSettings { Assemblies = [] };
+        var loader = new PluginLoader(services, config, settings);
+
+        var exception = Record.Exception(() => loader.Load(_ => { }));
+
+        Assert.Null(exception);
+
+        var executingDir = typeof(PluginLoader)
+            .GetField("_executingDir", BindingFlags.NonPublic | BindingFlags.Static)!
+            .GetValue(null) as string;
+
+        Assert.Equal(AppContext.BaseDirectory, executingDir);
+    }
+
+    [Fact]
+    public void Load_finds_and_loads_plugin_assembly_from_executing_dir()
+    {
+        // BotSharp.Core.Rules is a real ProjectReference of this test project, so its
+        // .dll is copied next to the test host's own assembly (AppContext.BaseDirectory) -
+        // the exact directory PluginLoader now searches for plugin assemblies.
+        var services = new ServiceCollection();
+        var config = new ConfigurationBuilder().Build();
+        var settings = new PluginSettings { Assemblies = ["BotSharp.Core.Rules"] };
+        var loader = new PluginLoader(services, config, settings);
+
+        Assembly? loadedAssembly = null;
+        loader.Load(assembly => loadedAssembly = assembly);
+
+        Assert.NotNull(loadedAssembly);
+        Assert.Equal("BotSharp.Core.Rules", loadedAssembly!.GetName().Name);
+    }
+}
```

---

### Incident Patch 6: `151e4fcf` (2026-09-12)
**Commit Message**: Fix startup crash when published as self-contained single-file exe

PluginLoader.Load() derived the plugin search directory from
Assembly.GetEntryAssembly().Location, which .NET leaves empty when
the app is published with PublishSingleFile + self-contained. That
made Directory.GetParent("") throw an ArgumentException before the
app could even start.

Use AppContext.BaseDirectory instead, which resolves correctly for
both regular and single-file-published deployments.

Fixes #669

**File**: `src/Infrastructure/BotSharp.Core/Plugins/PluginLoader.cs` (modified, +4/-1)
```diff
@@ -18,7 +18,10 @@ public class PluginLoader(IServiceCollection services,
 
     public void Load(Action<Assembly> loaded, string? plugin = null)
     {
-        _executingDir = Directory.GetParent(Assembly.GetEntryAssembly().Location).FullName;
+        // Assembly.GetEntryAssembly().Location is empty when the app is published
+        // as a self-contained single-file executable, which makes Directory.GetParent()
+        // throw. AppContext.BaseDirectory is populated correctly in that case too.
+        _executingDir = AppContext.BaseDirectory;
 
         settings.Assemblies.ToList().ForEach(assemblyName =>
         {
```

---

### Incident Patch 7: `db8f0533` (2026-09-05)
**Commit Message**: Merge pull request #1425 from ywang1110/fix/honor-handled-flag-in-invoke-function

fix(routing): honor the Handled flag so a before-hook can refuse a function call

**File**: `src/Infrastructure/BotSharp.Core/Routing/RoutingService.InvokeFunction.cs` (modified, +16/-5)
```diff
@@ -48,12 +48,23 @@ public async Task<bool> InvokeFunction(string name, RoleDialogModel message, Inv
 
         try
         {
-            result = await funcExecutor.ExecuteAsync(clonedMessage);
-
-            // After functions have been executed
-            foreach (var hook in hooks)
+            // A before-hook may REFUSE the call outright by setting Handled, which is what that
+            // flag has always been documented to mean on RoleDialogModel — it was simply never
+            // read here, so a hook that decided a tool must not run watched it run anyway.
+            //
+            // The refusal's own words are already on the cloned message and are copied back below
+            // as the tool's result, so the model reads why it was refused rather than a silent
+            // no-op. The executed-hooks are skipped with the execution: they exist to react to
+            // what a tool DID, and a call that never happened did nothing for them to record.
+            if (!clonedMessage.Handled)
             {
-                await hook.OnFunctionExecuted(clonedMessage, options);
+                result = await funcExecutor.ExecuteAsync(clonedMessage);
+
+                // After functions have been executed
+                foreach (var hook in hooks)
+                {
+                    await hook.OnFunctionExecuted(clonedMessage, options);
+                }
             }
 
             // Set result to original message
```

---

### Incident Patch 8: `032db992` (2026-09-05)
**Commit Message**: fix(routing): honor the Handled flag so a before-hook can refuse a function call

**File**: `src/Infrastructure/BotSharp.Core/Routing/RoutingService.InvokeFunction.cs` (modified, +16/-5)
```diff
@@ -48,12 +48,23 @@ public async Task<bool> InvokeFunction(string name, RoleDialogModel message, Inv
 
         try
         {
-            result = await funcExecutor.ExecuteAsync(clonedMessage);
-
-            // After functions have been executed
-            foreach (var hook in hooks)
+            // A before-hook may REFUSE the call outright by setting Handled, which is what that
+            // flag has always been documented to mean on RoleDialogModel — it was simply never
+            // read here, so a hook that decided a tool must not run watched it run anyway.
+            //
+            // The refusal's own words are already on the cloned message and are copied back below
+            // as the tool's result, so the model reads why it was refused rather than a silent
+            // no-op. The executed-hooks are skipped with the execution: they exist to react to
+            // what a tool DID, and a call that never happened did nothing for them to record.
+            if (!clonedMessage.Handled)
             {
-                await hook.OnFunctionExecuted(clonedMessage, options);
+                result = await funcExecutor.ExecuteAsync(clonedMessage);
+
+                // After functions have been executed
+                foreach (var hook in hooks)
+                {
+                    await hook.OnFunctionExecuted(clonedMessage, options);
+                }
             }
 
             // Set result to original message
```

---

### Incident Patch 9: `843aae49` (2026-09-04)
**Commit Message**: revert

**File**: `src/Plugins/BotSharp.Plugin.OpenAI/Providers/Chat/ChatCompletionProvider.Response.cs` (modified, +26/-14)
```diff
@@ -25,15 +25,19 @@ private async Task<RoleDialogModel> InnerCreateResponse(Agent agent, List<RoleDi
         var response = await responsesClient.CreateResponseAsync(options);
         var value = response.Value;
 
-        var functionCall = value.OutputItems.OfType<FunctionCallResponseItem>().FirstOrDefault();
+        // Every call the model asked for, not only the first. It routinely asks for several
+        // independent ones at once, and keeping one made it re-ask for the rest next turn.
+        var functionCalls = value.OutputItems.OfType<FunctionCallResponseItem>().ToList();
+        var toolCalls = ToLlmToolCalls(functionCalls);
+        var functionCall = functionCalls.FirstOrDefault();
         var reasoningItem = value.OutputItems.OfType<ReasoningResponseItem>().FirstOrDefault();
         var text = value.GetOutputText() ?? string.Empty;
         var thinkingText = reasoningItem?.GetSummaryText();
 
         RoleDialogModel responseMessage;
         if (functionCall != null)
         {
-            _logger.LogInformation($"Action: {nameof(InnerCreateResponse)}, Agent: {agent.Name}, ToolCall: {functionCall.FunctionName}");
+            _logger.LogInformation($"Action: {nameof(InnerCreateResponse)}, Agent: {agent.Name}, ToolCalls: {string.Join(",", toolCalls.Select(x => x.FunctionName))}");
 
             responseMessage = new RoleDialogModel(AgentRole.Function, text)
             {
@@ -42,6 +46,7 @@ private async Task<RoleDialogModel> InnerCreateResponse(Agent agent, List<RoleDi
                 ToolCallId = functionCall.CallId,
                 FunctionName = functionCall.FunctionName.NormalizeFunctionName(),
                 FunctionArgs = functionCall.FunctionArguments?.ToString(),
+                ToolCalls = toolCalls,
                 RenderedInstruction = string.Join("\r\n", renderedInstructions)
             };
         }
@@ -113,15 +118,19 @@ private async Task<bool> InnerCreateResponseAsync(Agent agent,
         var response = await responsesClient.CreateResponseAsync(options);
         var value = response.Value;
 
-        var functionCall = value.OutputItems.OfType<FunctionCallResponseItem>().FirstOrDefault();
+        // Every call the model asked for, not only the first. It routinely asks for several
+        // independent ones at once, and keeping one made it re-ask for the rest next turn.
+        var functionCalls = value.OutputItems.OfType<FunctionCallResponseItem>().ToList();
+        var toolCalls = ToLlmToolCalls(functionCalls);
+        var functionCall = functionCalls.FirstOrDefault();
         var reasoningItem = value.OutputItems.OfType<ReasoningResponseItem>().FirstOrDefault();
         var text = value.GetOutputText() ?? string.Empty;
         var thinkingText = reasoningItem?.GetSummaryText();
 
         RoleDialogModel responseMessage;
         if (functionCall != null)
         {
-            _logger.LogInformation($"Action: {nameof(InnerCreateResponseAsync)}, Agent: {agent.Name}, ToolCall: {functionCall.FunctionName}");
+            _logger.LogInformation($"Action: {nameof(InnerCreateResponseAsync)}, Agent: {agent.Name}, ToolCalls: {string.Join(",", toolCalls.Select(x => x.FunctionName))}");
 
             responseMessage = new RoleDialogModel(AgentRole.Function, text)
             {
@@ -130,6 +139,7 @@ private async Task<bool> InnerCreateResponseAsync(Agent agent,
                 ToolCallId = functionCall.CallId,
                 FunctionName = functionCall.FunctionName.NormalizeFunctionName(),
                 FunctionArgs = functionCall.FunctionArguments?.ToString(),
+                ToolCalls = toolCalls,
                 RenderedInstruction = string.Join("\r\n", renderedInstructions)
             };
         }
@@ -221,7 +231,7 @@ private async Task<RoleDialogModel> InnerCreateResponseStreamingAsync(Agent agen
 
         using var textStream = new RealtimeTextStream();
         using var thinkingStream = new RealtimeTextStream();
-        FunctionCallResponseItem? functionCa
```

---

### Incident Patch 10: `14ebd835` (2026-09-04)
**Commit Message**: hotfix Fallback agent

**File**: `src/Infrastructure/BotSharp.Core/data/agents/01fcc3e5-0af7-49e6-ad7a-a760bd12dc4d/agent.json` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 {
   "id": "01fcc3e5-0af7-49e6-ad7a-a760bd12dc4d",
   "name": "Fallback Agent",
-  "description": "Handle initiated conversation without specific task given yet or don't have sufficient confidence to handle user task, but not for missing args.",
+  "description": "Handle initiated conversation without specific task given yet or don't have sufficient confidence to handle user task, never for missing args.",
   "type": "task",
   "createdDateTime": "2024-05-07T10:00:00Z",
   "updatedDateTime": "2024-05-07T10:00:00Z",
```

#### Recent Merged Pull Requests:
- **PR #1453** (2026-09-29): add ConversationStateServiceExtensionsTests (@yileicn)
- **PR #1451** (2026-09-28): Indication support multi language (@yileicn)
- **PR #1450** (2026-09-24): optimize PushIndication (@yileicn)
- **PR #1449** (2026-09-23): Features/gpt live provider (@iceljc)
- **PR #1448** (2026-09-22): feat(conversation): replace a tool result the assistant message repeats (@yileicn)
- **PR #1447** (2026-09-21): trim tool results that older turns replay (@yileicn)
- **PR #1446** (2026-09-21): Run every tool call a reply asked for, not only the first (@yuyixg)
- **PR #1445** (2026-09-20): optimize RouteToAgentFn Indication (@yileicn)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

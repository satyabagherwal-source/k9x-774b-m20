# Forensic Learning Record (Deep Inspection): SciSharp/BotSharp

> **Canonical Artifact**: `07_PROJECT_LEARNING/scisharp-botsharp-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/SciSharp/BotSharp](https://github.com/SciSharp/BotSharp))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:06:50.627Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `SciSharp/BotSharp`
- **Description**: AI Multi-Agent Framework in .NET
- **Primary Language / Ecosystem**: C#
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 3111 stars

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

Co-Authored-By: Claude Opus 5 (1M context) <[REDACTED_EMAIL]>

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
@@ -476,7 +476,7 @@ private void OnBackendOutputItemDone(LiveInnerResponseEvent inner)
                     return;
                 }
 
-                _logger.LogCritical("{Provider} tool call {Name}({Arguments})", Provider, item.Name, item.Arguments);
+                _logger.Log(TraceLevel, "{Provider} tool call {Name}({Arguments})", Provider, item.Name, item.Arguments);
 
                 var call = new RoleDialogModel(AgentRole.Assistant, item.Arguments ?? "{}")
                 {
@@ -504,7 +504,7 @@ private void OnBackendOutputItemDone(LiveInnerResponseEvent inner)
                     return;
                 }
 
-                _logger.LogCritical("{Provider} backend {Phase} answer: {Text}",
+                _logger.Log(TraceLevel, "{Provider} backend {Phase} answer: {Text}",
                     Provider, item.Phase ?? LiveResponsePhase.FinalAnswer, text);
                 return;
 
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
+    /// keeps the sentence that introduced it. A lone brace in prose is not a document: what is
+    /// looked for is a brace or bracket that opens a value.
+    /// </remarks>
+    private static string Shorten(RoleDialogModel dialog, int maxLength)
+    {
+        var content = dialog.Content;
+        var structure = StructuredStart.Match(content);
+        var cut = structure.Success ? Math.Min(structure.Index, maxLength) : maxLength;
+
+        // The call itself sits in the message right before this one, so the note does not name it
+        // again -- what a later turn cannot work out on its own is that something was dropped.
+        if (cut == 0)
+        {
+            return $"[{content.Length} chars omitted; call again for detail]";
+        }
+
+        return content[..cut].TrimEnd()
+            + $"\r\n... [{content.Length - cut} chars omitted; call again for detail]";
+    }
+}
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

**File**: `tests/BotSharp.Core.UnitTests/Conversations/ToolResultTrimHookTests.cs` (added, +233/-0)
```diff
@@ -0,0 +1,233 @@
+using BotSharp.Abstraction.Agents.Enums;
+using BotSharp.Abstraction.Conversations.Models;
+using BotSharp.Abstraction.Conversations.Settings;
+using BotSharp.Abstraction.Routing;
+using BotSharp.Core.Conversations.Hooks;
+using Microsoft.Extensions.DependencyInjection;
+using Microsoft.Extensions.Logging.Abstractions;
+using Moq;
+using Xunit;
+
+namespace BotSharp.Core.UnitTests.Conversations;
+
+/// <summary>
+/// A tool result is worth its tokens to the turn that asked for it and rarely worth them again.
+/// This hook is where that is acted on, and these tests pin the two things it must never do:
+/// touch what the current turn is about to read, and lose the call itself -- an agent that cannot
+/// see it already ran a function runs it again.
+/// </summary>
+public class ToolResultTrimHookTests
+{
+    private const string OldTurn = "turn-1";
+    private const string MiddleTurn = "turn-2";
+    private const string RecentTurn = "turn-3";
+    private const string CurrentTurn = "turn-4";
+
+    private static ToolResultTrimHook BuildHook(ConversationSetting settings, string currentMessageId)
+    {
+        var context = new Mock<IRoutingContext>();
+        context.SetupGet(x => x.MessageId).Returns(currentMessageId);
+
+        var services = new ServiceCollection();
+        services.AddSingleton(context.Object);
+
+        return new ToolResultTrimHook(
+            services.BuildServiceProvider(),
+            settings,
+            NullLogger<ToolResultTrimHook>.Instance);
+    }
+
+    private static ConversationSetting Settings(bool enable = true, int keepTurns = 2, int maxLength = 500)
+        => new()
+        {
+            ToolResultTrim = new ToolResultTrimSetting
+            {
+                Enable = enable,
+                KeepTurns = keepTurns,
+                MaxLength = maxLength
+            }
+        };
+
+    private static RoleDialogModel Tool(string messageId, string content, string function = "read_work_order")
+        => new(AgentRole.Function, content)
+        {
+            MessageId = messageId,
+            FunctionName = function,
+            ToolCallId = $"call_{messageId}",
+            FunctionArgs = "{\"wo_num\":\"A123\"}"
+        };
+
+    private static string Rendered(int length)
+        => "WO Num: A1234567\r\n" + new string('x', length - 18);
+
+    private static string Json(int length)
+        => "{\"wo_num\":\"A1234567\",\"pad\":\"" + new string('x', length - 30) + "\"}";
+
+    [Fact]
+    public async Task Leaves_the_turn_that_is_running_untouched()
+    {
+        var dialogs = new List<RoleDialogModel>
+        {
+            Tool(OldTurn, Rendered(4000)),
+            Tool(MiddleTurn, Rendered(4000)),
+            Tool(RecentTurn, Rendered(4000)),
+            Tool(CurrentTurn, Rendered(4000))
+        };
+
+        // keepTurns 0, so only "this is the turn in flight" can protect the last one.
+        await BuildHook(Settings(keepTurns: 0), CurrentTurn).OnDialogsLoaded(dialogs);
+
+        Assert.Equal(4000, dialogs[3].Content.Length);
+        Assert.All(dialogs.Take(3), x => Assert.True(x.Content.Length < 4000));
+    }
+
+    [Fact]
+    public async Task Keeps_the_most_recent_turns_whole_and_shortens_what_is_older()
+    {
+        var dialogs = new List<RoleDialogModel>
+        {
+            new(AgentRole.User, "how is my work order?") { MessageId = OldTurn },
+            Tool(OldTurn, Rendered(4000)),
+            Tool(MiddleTurn, Rendered(4000)),
+            Tool(RecentTurn, Rendered(4000))
+        };
+
+        await BuildHook(Settings(keepTurns: 2), CurrentTurn).OnDialogsLoaded(dialogs);
+
+        Assert.True(dialogs[1].Content.Length < 4000);
+        Assert.Equal(4000, dialogs[2].Content.Length);
+        Assert.Equal(4000, dialogs[3].Content.Length);
+    }
+
+    [Fact]
+    public async Task Keeps_the_call_even_when_the_result_goes()
+    {
+        var dialogs = new List<RoleDialogModel> { Tool(OldTurn, Json(4000)) };
+
+        await BuildHook(Settings(keepTurns: 0), CurrentTurn).OnDialogsLoaded(dialogs);
+
+        var stored = dialogs[0];
+        Assert.Equal(AgentRole.Function, stored.Role);
+        Assert.Equal("read_work_order", stored.FunctionName);
+        Assert.Equal($"call_{OldTurn}", stored.ToolCallId);
+        Assert.Equal("{\"wo_num\":\"A123\"}", stored.FunctionArgs);
+    }
+
+    [Fact]
+    public async Task Replaces_a_structured_result_rather_than_cutting_it_in_half()
+    {
+        var dialogs = new List<RoleDialogModel> { Tool(OldTurn, Json(4000)) };
+
+        await BuildHook(Settings(keepTurns: 0), CurrentTurn).OnDialogsLoaded(dialogs);
+
+        // Half a JSON document reads as a whole one to a model that cannot see where it was cut.
+        Assert.DoesNotContain("{\"wo_num\"", dialogs[0].Content);
+        Assert.Equal("[4000 chars omitted; call again for detail]", dialogs[0].Content);
+    }
+
+    [Fact]
+    public async Task Keeps_the_head_of_a_rendered_result_and_sa
```

---

### Incident Patch 4: `14190ed2` (2026-09-17)
**Commit Message**: Keep the Live receive loop free while the backend works

Delegating to the backend model made the voice disfluent: the caller heard "Okay,
checking", then ten seconds of nothing, then "that now." Not delegating was fine.

The socket has one consumer, and a tool call was awaited inside it - through
routing.InvokeFunction, the conversation hooks, and the session update that follows.
Nothing was read off the socket for as long as that took. On a half duplex session
that costs nothing, because the model is silent while a tool runs; on Live the model
keeps talking through the delegation, so its audio frames piled up unread and arrived
in a burst once the function returned. Telling the model to hold the call made this
visible rather than causing it.

So the receive loop now parses an event and moves on. Conversation work - invoking a
tool, recording a turn - goes to a SerialWorkQueue and runs on one background worker
in the order it was queued. Serial rather than fire and forget: two tool calls must
not interleave their session updates, and the conversation state this work touches is
not thread safe. Audio and live transcript deltas stay on the loop, since queueing
them behind a tool cal

**File**: `src/Plugins/BotSharp.Plugin.OpenAI/Models/Live/LiveEventTypes.cs` (modified, +26/-0)
```diff
@@ -81,6 +81,32 @@ public static class LiveResponseInnerEventType
     public const string Incomplete = "response.incomplete";
 }
 
+/// <summary>
+/// Output item types carried by <see cref="LiveResponseInnerEventType.OutputItemDone"/>.
+/// </summary>
+public static class LiveResponseItemType
+{
+    public const string FunctionCall = "function_call";
+    public const string Message = "message";
+}
+
+public static class LiveResponseItemStatus
+{
+    public const string Completed = "completed";
+}
+
+/// <summary>
+/// Stage a backend message item belongs to.
+/// </summary>
+public static class LiveResponsePhase
+{
+    /// <summary>
+    /// The answer the backend handler settled on, and the only message worth recording:
+    /// earlier phases are drafts and working notes the caller never hears.
+    /// </summary>
+    public const string FinalAnswer = "final_answer";
+}
+
 public static class LiveDelegationType
 {
     /// <summary>
```

**File**: `src/Plugins/BotSharp.Plugin.OpenAI/Models/Live/LiveResponseEvent.cs` (modified, +30/-1)
```diff
@@ -67,7 +67,7 @@ public class LiveInnerResponseEvent
         return new LiveResponseOutputItem
         {
             Id = ItemId,
-            Type = "function_call",
+            Type = LiveResponseItemType.FunctionCall,
             CallId = CallId,
             Name = Name,
             Arguments = Arguments
@@ -143,8 +143,37 @@ public class LiveResponseOutputItem
     [JsonPropertyName("arguments")]
     public string? Arguments { get; set; }
 
+    /// <summary>
+    /// Where a message item sits in the backend turn: final_answer is the answer the voice
+    /// model is given to speak, earlier phases are working notes on the way to it.
+    /// </summary>
+    [JsonPropertyName("phase")]
+    public string? Phase { get; set; }
+
     [JsonPropertyName("content")]
     public LiveResponseOutputContent[]? Content { get; set; }
+
+    public bool IsCompleted => string.IsNullOrEmpty(Status)
+        || Status.Equals(LiveResponseItemStatus.Completed, StringComparison.OrdinalIgnoreCase);
+
+    /// <summary>
+    /// Joins the text parts of a message item. A message carries its text in content[], and
+    /// the parts are fragments of one utterance rather than alternatives, so they concatenate.
+    /// </summary>
+    public string? GetOutputText()
+    {
+        if (Content == null || Content.Length == 0)
+        {
+            return null;
+        }
+
+        var parts = Content
+            .Select(x => x.Text ?? x.Transcript)
+            .Where(x => !string.IsNullOrWhiteSpace(x));
+
+        var text = string.Join(string.Empty, parts).Trim();
+        return string.IsNullOrEmpty(text) ? null : text;
+    }
 }
 
 public class LiveResponseOutputContent
```

**File**: `src/Plugins/BotSharp.Plugin.OpenAI/Providers/Live/LiveCompletionProvider.Events.cs` (modified, +155/-45)
```diff
@@ -14,6 +14,13 @@ public partial class LiveCompletionProvider
 
     private LiveResponseUsage? _lastBackendUsage;
 
+    /// <summary>
+    /// Everything that touches the conversation - running a tool, recording a turn - runs here
+    /// rather than on the receive loop, which has to stay free to drain audio. See
+    /// <see cref="SerialWorkQueue"/> for why it is serial.
+    /// </summary>
+    private SerialWorkQueue? _conversationWork;
+
     /// <summary>
     /// Who spoke most recently, so the final flush can emit the turns in the order they happened.
     /// </summary>
@@ -22,9 +29,15 @@ public partial class LiveCompletionProvider
     #region Receive loop
     private async Task ReceiveMessage(RealtimeModelSettings realtimeSettings)
     {
-        if (_session == null) return;
+        var session = _session;
+        if (session == null) return;
+
+        // Captured rather than read from the fields on the way out. A reconnect replaces both
+        // while this loop is unwinding, and tearing down whatever the fields point at by then
+        // would close the session that just replaced this one.
+        var work = _conversationWork;
 
-        await foreach (ChatSessionUpdate update in _session.ReceiveUpdatesAsync(CancellationToken.None))
+        await foreach (ChatSessionUpdate update in session.ReceiveUpdatesAsync(CancellationToken.None))
         {
             var receivedText = update?.RawResponse;
             if (string.IsNullOrEmpty(receivedText))
@@ -55,10 +68,14 @@ private async Task ReceiveMessage(RealtimeModelSettings realtimeSettings)
         }
 
         // The stream is over, so whatever is still buffered is a finished turn.
-        await FlushPendingTurns();
+        await FlushPendingTurns(work);
 
-        DisposeTurnTimers();
-        _session?.Dispose();
+        if (ReferenceEquals(_session, session))
+        {
+            DisposeSessionWorkers();
+        }
+
+        session.Dispose();
     }
 
     /// <summary>
@@ -118,7 +135,7 @@ private async Task<bool> HandleServerEvent(string type, string receivedText)
 
             case LiveServerEventType.ResponseEvent:
                 _logger.LogCritical("{Type}: {Payload}", type, receivedText);
-                await OnBackendResponseEvent(receivedText);
+                OnBackendResponseEvent(receivedText);
                 return false;
 
             case LiveServerEventType.DelegationCreated:
@@ -166,7 +183,7 @@ private async Task OnModelAudioIdle()
             Provider, LiveSettings.AudioIdleMs);
 
         await _onModelAudioResponseDone();
-        await FlushOutputTranscript();
+        FlushOutputTranscript();
     }
 
     #region Transcripts
@@ -186,11 +203,11 @@ private async Task OnTranscriptDelta(string receivedText, StringBuilder buffer,
         // nothing. The flush runs before the append so the turns come out in the order spoken.
         if (role == AgentRole.Assistant)
         {
-            await FlushInputTranscript();
+            FlushInputTranscript();
         }
         else
         {
-            await FlushOutputTranscript();
+            FlushOutputTranscript();
         }
 
         lock (_transcriptLock)
@@ -242,7 +259,12 @@ private string TakeBuffer(StringBuilder buffer)
         }
     }
 
-    private async Task FlushOutputTranscript()
+    /// <summary>
+    /// Closes the model's turn. The buffer is taken here, on the caller's thread, so the turn
+    /// boundary lands where the caller decided it should; recording it is queued, because that
+    /// reaches conversation storage and hooks and must not hold up the receive loop.
+    /// </summary>
+    private void FlushOutputTranscript()
     {
         _outputTranscriptTimer?.Cancel();
 
@@ -254,18 +276,27 @@ private async Task FlushOutputTranscript()
 
         _logger.LogInformation("{Provider} model transcript: {Transcript}", Provider, text);
 
+        // Read now rather than inside the queued work: by the time that runs the model may
+        // already be speaking its next turn, and this turn would be filed under its item id.
+        var messageId = _conn.LastAssistantItemId ?? Guid.NewGuid().ToString();
+
+        _conversationWork?.Enqueue(() => DeliverOutputTranscript(text, messageId));
+    }
+
+    private async Task DeliverOutputTranscript(string text, string messageId)
+    {
         await _onModelAudioTranscriptDone(text);
 
         var message = new RoleDialogModel(AgentRole.Assistant, text)
         {
             CurrentAgentId = _conn.CurrentAgentId,
-            MessageId = _conn.LastAssistantItemId ?? Guid.NewGuid().ToString(),
+            MessageId = messageId,
             MessageType = MessageTypeName.Plain
         };
 
         // Deliver before telemetry. The buffer is already drained by this point, so anything that
-        // throws on the way out loses the turn for good - and when the flush is driven by the
-        // idle timer the exception is only logged, so the message vanishes without
```

**File**: `src/Plugins/BotSharp.Plugin.OpenAI/Providers/Live/LiveCompletionProvider.Session.cs` (modified, +4/-1)
```diff
@@ -39,7 +39,10 @@ await SendEventToModel(new
 
         // The agent instruction reaches the backend through delegation.responses.instructions
         // above, so nothing is appended to the voice model here.
-        await Task.Delay(300);
+        //
+        // No settle delay before returning, unlike the realtime provider this was modelled on.
+        // The caller's next act is response.create on the same socket, and the server applies
+        // what it is sent in order, so there is nothing for a delay to win.
         return instruction;
     }
 
```

**File**: `src/Plugins/BotSharp.Plugin.OpenAI/Providers/Live/LiveCompletionProvider.cs` (modified, +2/-2)
```diff
@@ -88,7 +88,7 @@ public async Task Connect(
 
         _currentDelegationId = null;
         _lastAgentInstruction = null;
-        ResetTurnBuffers();
+        ResetSessionState();
 
         var realtimeSettings = _services.GetRequiredService<RealtimeModelSettings>();
 
@@ -154,7 +154,7 @@ public async Task Disconnect()
         // timers go, since disposing them would drop the only other route to that last turn.
         await FlushPendingTurns();
 
-        DisposeTurnTimers();
+        DisposeSessionWorkers();
 
         if (_session != null)
         {
```

**File**: `src/Plugins/BotSharp.Plugin.OpenAI/Providers/Live/README.md` (modified, +20/-0)
```diff
@@ -126,6 +126,26 @@ The budget is counted in tokens rather than characters because the two diverge b
 prose is roughly four characters per token, CJK closer to one. A character cap sized for English
 overshoots the server limit badly for Chinese, Japanese and Korean.
 
+## Nothing runs on the receive loop
+
+The socket has a single consumer, and anything awaited inside it stops the socket being read.
+On a half duplex session that costs nothing, because the model is silent while a tool runs. On
+Live it is the whole problem: the model keeps talking through a delegation, so audio frames pile
+up unread and the caller hears the reply cut in half - "Okay, checking" ... ten seconds ... "that
+now."
+
+So the receive loop parses an event and moves on. Conversation work - invoking a tool, recording
+a turn - goes to a `SerialWorkQueue`, which runs it on one background worker in the order it was
+queued. Serial rather than fire and forget, because two tool calls must not interleave their
+session updates, and because the conversation state this work touches is not thread safe.
+
+What stays on the loop is what must not queue behind a tool call: audio deltas and live
+transcript deltas, both of which are only a write to the caller's socket.
+
+Turn boundaries are still decided on the loop. The flushes take the buffer there, synchronously,
+and queue only its delivery - otherwise a turn queued behind a slow tool would pick up the words
+the model spoke after it.
+
 ## Behaviour that differs from the realtime provider
 
 - **No turn completion event.** Live streams transcript deltas and never marks the end of a turn,
```

**File**: `src/Plugins/BotSharp.Plugin.OpenAI/Providers/Live/SerialWorkQueue.cs` (added, +97/-0)
```diff
@@ -0,0 +1,97 @@
+using System.Threading.Channels;
+
+namespace BotSharp.Plugin.OpenAI.Providers.Live;
+
+/// <summary>
+/// Runs queued work on a single background worker, one item at a time and in the order it was
+/// queued.
+///
+/// The Live socket has one consumer, and anything awaited on it stops the socket being read.
+/// That is fatal on a full duplex call: the model keeps speaking while a tool runs, so audio
+/// frames pile up unread and the caller hears a gap where the reply should be. Conversation
+/// work is handed here instead, so the receive loop only ever parses an event and moves on.
+///
+/// Serial rather than fire and forget for two reasons: two tool calls must not interleave their
+/// session updates, and the conversation state this work touches is not thread safe.
+/// </summary>
+internal sealed class SerialWorkQueue : IDisposable
+{
+    private readonly Channel<Func<Task>> _queue = Channel.CreateUnbounded<Func<Task>>(
+        new UnboundedChannelOptions { SingleReader = true });
+
+    /// <summary>
+    /// The queue whose worker the current call is running on, if any. Flows into the work's own
+    /// continuations, which is how <see cref="DrainAsync"/> spots being called from inside itself.
+    /// </summary>
+    private static readonly AsyncLocal<SerialWorkQueue?> _running = new();
+
+    private readonly Task _worker;
+    private readonly ILogger? _logger;
+    private readonly string _name;
+
+    public SerialWorkQueue(string name, ILogger? logger = null)
+    {
+        _name = name;
+        _logger = logger;
+        _worker = Task.Run(RunAsync);
+    }
+
+    /// <summary>
+    /// Hands work to the worker and returns at once. Never throws: a queue that fails to accept
+    /// work must not take the caller's receive loop down with it.
+    /// </summary>
+    public void Enqueue(Func<Task> work)
+    {
+        if (_queue.Writer.TryWrite(work)) return;
+
+        // Only happens once the queue is closed, i.e. the session is already tearing down.
+        _logger?.LogWarning("Dropped {Name} work: the queue is closed.", _name);
+    }
+
+    /// <summary>
+    /// Stops accepting work and waits for what is already queued to finish. Called during
+    /// teardown, where the final turns still have to reach storage before the session goes.
+    /// </summary>
+    public async Task DrainAsync()
+    {
+        _queue.Writer.TryComplete();
+
+        // Queued work can end up here: a tool call runs on this worker, and handling it can
+        // tear the session down - a reconnect, say. Waiting would be waiting on ourselves.
+        // Closing the queue is still right; what is already in it runs as this worker unwinds.
+        if (ReferenceEquals(_running.Value, this))
+        {
+            _logger?.LogDebug("Not waiting on the {Name} queue from inside its own worker.", _name);
+            return;
+        }
+
+        try
+        {
+            await _worker;
+        }
+        catch (Exception ex)
+        {
+            _logger?.LogError(ex, "Failed to drain the {Name} queue.", _name);
+        }
+    }
+
+    private async Task RunAsync()
+    {
+        _running.Value = this;
+
+        await foreach (var work in _queue.Reader.ReadAllAsync())
+        {
+            try
+            {
+                await work();
+            }
+            catch (Exception ex)
+            {
+                // One failed item must not end the worker; the rest of the call still needs it.
+                _logger?.LogError(ex, "Error while running queued {Name} work.", _name);
+            }
+        }
+    }
+
+    public void Dispose() => _queue.Writer.TryComplete();
+}
```

---

### Incident Patch 5: `83f518f5` (2026-09-16)
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

### Incident Patch 6: `65314318` (2026-09-12)
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

### Incident Patch 7: `151e4fcf` (2026-09-12)
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

### Incident Patch 8: `db8f0533` (2026-09-05)
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

### Incident Patch 9: `032db992` (2026-09-05)
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

### Incident Patch 10: `843aae49` (2026-09-04)
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
-        FunctionCallResponseItem? functionCall = null;
+        var functionCalls = new List<FunctionCallResponseItem>();
         ResponseResult? finalResult = null;
         ResponseTokenUsage? tokenUsage = null;
 
@@ -312,7 +322,7 @@ private async Task<RoleDialogModel> InnerCreateResponseStreamingAsync(Agent agen
                         {
                             if (itemDone.Item is FunctionCallResponseItem fc)
                             {
-                                functionCall = fc;
+                                functionCalls.Add(fc);
 #if DEBUG
                                 _logger.LogDebug($"Tool Call (id: {fc.CallId}) => {fc.FunctionName}({fc.FunctionArguments})");
 #endif
@@ -342,9 +352,12 @@ private async Task<RoleDialogModel> InnerCreateResponseStreamingAsync(Agent agen
         var allText = textStream.GetText();
         var thinkingText = thinkingStream.GetText();
 
+        var toolCalls = ToLlmToolCalls(functionCalls);
+        var functionCall = functionCalls.FirstOrDefault();
+
         if (
```

---

### Incident Patch 11: `14ebd835` (2026-09-04)
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

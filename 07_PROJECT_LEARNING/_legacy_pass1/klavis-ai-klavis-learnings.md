# Forensic Learning Record (Deep Inspection): Klavis-AI/klavis

> **Canonical Artifact**: `07_PROJECT_LEARNING/klavis-ai-klavis-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Klavis-AI/klavis](https://github.com/Klavis-AI/klavis))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T19:44:59.550Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Klavis-AI/klavis`
- **Description**: Klavis AI:  MCP integration platforms that let AI agents use tools reliably at any scale
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 5808 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `examples/agno-klavis/main.py`
```
import os
import asyncio
import webbrowser

from klavis import Klavis
from klavis.types import McpServerName

from agno.agent import Agent
from agno.models.openai import OpenAIChat
from agno.tools.mcp import MCPTools

from dotenv import load_dotenv
load_dotenv()

klavis_client = Klavis(api_key=os.getenv("KLAVIS_API_KEY"))

response = klavis_client.mcp_server.create_strata_server(
    servers=[McpServerName.GMAIL, McpServerName.SLACK],
    user_id="1234"
)

# Handle OAuth authorization for each service
if response.oauth_urls:
    for server_name, oauth_url in response.oauth_urls.items():
        webbrowser.open(oauth_url)
        print(f"Please open this URL to complete {server_name} OAuth authorization: {oauth_url}")


async def agno_with_mcp_server(mcp_server_url: str, user_query: str):
    """Run an Agno agent with Klavis MCP server tools."""

    async with MCPTools(transport="streamable-http", url=mcp_server_url) as mcp_tools:
        agent = Agent(
            model=OpenAIChat(
                id="gpt-4o",
                api_key=os.getenv("OPENAI_API_KEY")
            ),
            instructions="You are a helpful AI assistant.",
            tools=[mcp_tools],
            markdown=True,
        )

        response = await agent.arun(user_query)
        return response.content


async def main():
    result = await agno_with_mcp_server(
        mcp_server_url=response.strata_server_url,
        user_query="Check my latest 5 emails and summarize them in a Slack message to #general"
    )
    print(f"\nFinal Response: {result}")


if __name__ == "__main__":
    asyncio.run(main())
```

### Core Architecture Module: `examples/claude-klavis/python/main.py`
```
import os
import asyncio
import webbrowser

from klavis import Klavis
from klavis.types import McpServerName, ToolFormat
from anthropic import Anthropic

from dotenv import load_dotenv
load_dotenv()

async def main():
    klavis_client = Klavis(api_key=os.getenv("KLAVIS_API_KEY"))

    # Step 1: Create a Strata MCP server with Gmail and Slack integrations
    response = klavis_client.mcp_server.create_strata_server(
        servers=[McpServerName.GMAIL, McpServerName.SLACK],
        user_id="1234"
    )

    # Step 2: Handle OAuth authorization for each services
    if response.oauth_urls:
        for server_name, oauth_url in response.oauth_urls.items():
            webbrowser.open(oauth_url)
            input(f"Press Enter after completing {server_name} OAuth authorization...")

    # Step 3: Setup Claude client
    claude_client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

    # Step 4: Get MCP server tools in Anthropic format
    mcp_server_tools = klavis_client.mcp_server.list_tools(
        server_url=response.strata_server_url,
        format=ToolFormat.ANTHROPIC
    )

    # Step 5: Define user query
    user_query = "Check my latest 5 emails and summarize them in a Slack message to #general channel"

    messages = [
        {"role": "user", "content": user_query}
    ]

    # Step 6: Agent loop to handle tool calls
    max_iterations = 10
    iteration = 0

    while iteration < max_iterations:
        iteration += 1

        claude_response = claude_client.messages.create(
            model="claude-sonnet-4-5-20250929",
            max_tokens=4000,
            system="You are a helpful assistant. Use the available tools to answer the user's question.",
            messages=messages,
            tools=mcp_server_tools.tools
        )

        messages.append({"role": "assistant", "content": claude_response.content})

        if claude_response.stop_reason == "tool_use":
            tool_results = []

            for content_block in claude_response.content:
                if content_block.type == "tool_use":
                    function_name = content_block.name
                    function_args = content_block.input

                    print(f"🔧 Calling: {function_name}, with args: {function_args}")

                    result = klavis_client.mcp_server.call_tools(
                        server_url=response.strata_server_url,
                        tool_name=function_name,
                        tool_args=function_args
                    )

                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": content_block.id,
                        "content": str(result)
                    })

            messages.append({"role": "user", "content": tool_results})
            continue
        else:
            # Print only the final AI response content
            final_response = claude_response.content[0].text
            print(f"\n🤖 Final Response: {final_response}")
            return final_response

    print("Max iterations reached without final response")
    return None


if __name__ == "__main__":
    asyncio.run(main())
```

### Core Architecture Module: `examples/crewai-klavis/python/main.py`
```
import os
import webbrowser
from crewai import Agent, Task, Crew, Process
from crewai_tools import MCPServerAdapter
from klavis import Klavis
from klavis.types import McpServerName

from dotenv import load_dotenv
load_dotenv()

klavis_client = Klavis(api_key=os.getenv("KLAVIS_API_KEY"))

response = klavis_client.mcp_server.create_strata_server(
    servers=[McpServerName.GMAIL, McpServerName.SLACK], 
    user_id="1234"
)

# Handle OAuth authorization for each services
if response.oauth_urls:
    for server_name, oauth_url in response.oauth_urls.items():
        webbrowser.open(oauth_url)
        input(f"Or please open this URL to complete {server_name} OAuth authorization: {oauth_url}")

def crew_mcp_server(mcp_server_url: str, user_query: str):
    klavis_server_params = [
            {
                "url": mcp_server_url,
                "transport": "streamable-http"
            }
        ]

    with MCPServerAdapter(klavis_server_params) as all_mcp_tools:
        print(f"✅ Available tools: {[tool.name for tool in all_mcp_tools]}")

        klavis_agent = Agent(
            role="Klavis Query Assistant",
            goal="Assist the user with their query using available tools",
            backstory="Expert at assisting users with their queries using available tools",
            tools=all_mcp_tools,
            verbose=False,
            llm="gpt-4o"  # Using OpenAI GPT-4o model
        )

        klavis_task = Task(
            description=f"Answer the user's query: {user_query}",
            expected_output="Provide a detailed response to the user's query",
            agent=klavis_agent
        )

        crew = Crew(
            agents = [klavis_agent],
            tasks = [klavis_task],
            process=Process.sequential,
            verbose=True
        )

        result = crew.kickoff()
        print(f"Crew result: {result}")

if __name__ == "__main__":
    user_query = "Check my latest 5 emails and summarize them in a Slack message to #general"  # Change this query as needed
    crew_mcp_server(response.strata_server_url,user_query)
```

### Core Architecture Module: `examples/google_adk-klavis/python/my_agent/__init__.py`
```
from . import agent

```

### Core Architecture Module: `examples/google_adk-klavis/python/my_agent/agent.py`
```
import os
import webbrowser

from google.adk.agents.llm_agent import Agent
from google.adk.tools.mcp_tool import StreamableHTTPConnectionParams
from google.adk.tools.mcp_tool.mcp_toolset import McpToolset
from klavis import Klavis
from klavis.types import McpServerName

from dotenv import load_dotenv
load_dotenv()

KLAVIS_API_KEY = os.getenv("KLAVIS_API_KEY")

# Initialize Klavis and set up Strata server
klavis_client = Klavis(api_key=KLAVIS_API_KEY)

user_id = "user_123"

# Create Strata server with multiple MCP servers
strata_response = klavis_client.mcp_server.create_strata_server(
    servers=[McpServerName.GMAIL, McpServerName.SLACK],
    user_id=user_id
)

# Handle OAuth authentication
if strata_response.oauth_urls:
    for server_name, oauth_url in strata_response.oauth_urls.items():
        user_integration_auth = klavis_client.user.get_user_auth(
            user_id=user_id,
            server_name=server_name
        )
        if not user_integration_auth.is_authenticated:
            print(f"🔐 Opening OAuth for {server_name}...")
            webbrowser.open(oauth_url)
            input(f"Press Enter after completing {server_name} OAuth authorization...")

mcp_server_url = strata_response.strata_server_url

# Create AI agent with MCP toolset (exposed at module level for ADK)
root_agent = Agent(
    name="my_agent",
    model="gemini-2.5-flash",
    description="An agent with access to tools through Klavis MCP",
    instruction="You are a helpful assistant with access to MCP tools.",
    tools=[
        McpToolset(
            connection_params=StreamableHTTPConnectionParams(
                url=mcp_server_url,
            ),
        )
    ],
)


```

### Core Architecture Module: `examples/google_gemini_cli-klavis/index.js`
```
#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const os = require("os");

function parseArgs(argv) {
  const args = { _: [], flags: {} };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.replace(/^--/, "");
      const value = argv[i + 1] && !argv[i + 1].startsWith("-") ? argv[++i] : true;
      args.flags[key] = value;
    } else {
      args._.push(a);
    }
  }
  return args;
}

// Get settings path for Gemini
function getSettingsPath() {
  const geminiDir = path.join(os.homedir(), ".gemini");
  if (!fs.existsSync(geminiDir)) fs.mkdirSync(geminiDir);
  return path.join(geminiDir, "settings.json");
}

// Check if an MCP server is from Klavis AI
function isKlavisAiService(serverConfig) {
  if (!serverConfig || !serverConfig.args || !serverConfig.args[1]) {
    return false;
  }
  const url = serverConfig.args[1];
  return url.includes('klavis.ai');
}

// Create backup and cleanup old backups
function createBackup(settingsPath) {
  if (!fs.existsSync(settingsPath)) {
    return;
  }

  const backupPath = `${settingsPath}.bak.${Date.now()}`;
  fs.copyFileSync(settingsPath, backupPath);
  
  // Clean up old backups - keep only 1 most recent
  try {
    const geminiDir = path.dirname(settingsPath);
    const backupFiles = fs.readdirSync(geminiDir)
      .filter(file => file.startsWith('settings.json.bak.'))
      .map(file => ({
        name: file,
        path: path.join(geminiDir, file),
        timestamp: parseInt(file.split('.bak.')[1]) || 0
      }))
      .sort((a, b) => b.timestamp - a.timestamp); // Sort by timestamp, newest first
    
    // Remove backups beyond the 1 most recent
    if (backupFiles.length > 1) {
      const toDelete = backupFiles.slice(1);
      toDelete.forEach(backup => {
        fs.unlinkSync(backup.path);
      });
    }
  } catch (e) {
    // Silently ignore cleanup errors
  }
}

// Show help information
function showHelp() {
  console.log("📚 Klavis AI - MCP Server Manager for Gemini");
  console.log("===========================================");
  console.log("");
  console.log("DESCRIPTION:");
  console.log("  A CLI tool for managing Klavis AI MCP servers in Gemini CLI");
  console.log("");
  console.log("USAGE:");
  console.log("  klavis <command> [options]");
  console.log("");
  console.log("COMMANDS:");
  console.log("  gemini --help                Show this help message");
  console.log("  gemini add <INSTANCE_URL>    Add a Klavis AI MCP server to Gemini");
  console.log("  gemini remove <MCP_NAME>     Remove a Klavis AI MCP server from Gemini");
  console.log("  gemini list                  List all configured Klavis AI MCP servers");
  console.log("  gemini clear --force         Remove all Klavis AI MCP servers from Gemini");
  console.log("");
  console.log("");
  console.log("EXAMPLES:");
  console.log("  # Show help");
  console.log("  klavis gemini --help");
  console.log("");
  console.log("  # Add an MCP server");
  console.log("  klavis gemini add https://myservice-mcp-server.klavis.ai/mcp/?instance_id=your-id");
  console.log("");
  console.log("  # List all configured servers");
  console.log("  klavis gemini list");
  console.log("");
  console.log("  # Remove a specific server");
  console.log("  klavis gemini remove gmail");
  console.log("");
  console.log("  # Clear all Klavis AI servers");
  console.log("  klavis gemini clear --force");
  console.log("");
  console.log("NOTES:");
  console.log("  • Only Klavis AI MCPs can be managed with this tool");
  console.log("  • Settings are stored in ~/.gemini/settings.json");
  console.log("  • Automatic backups are created before modifications");
  console.log("");
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  // Handle help flag
  if (args._[0] === "gemini" && args.flags.help) {
    showHelp();
    return;
  }

  if (args._[0] !== "gemini" || !["add", "remove", "list", "clear", "help"].includes(args._[1])) {
    console.error("Usage: klavis gemini add <INSTANCE_URL> | klavis gemini remove <MCP_NAME> | klavis gemini list | klavis gemini clear --force | klavis gemini --help");
    console.error("For detailed help, run: klavis gemini --help");
    process.exit(1);
  }

  // For add and remove commands, require the third argument
  if ((args._[1] === "add" || args._[1] === "remove") && !args._[2]) {
    console.error("Usage: klavis gemini add <INSTANCE_URL> | klavis gemini remove <MCP_NAME> | klavis gemini list | klavis gemini clear --force | klavis gemini --help");
    process.exit(1);
  }

  // For clear command, require the --force flag
  if (args._[1] === "clear" && !args.flags.force) {
    console.error("❌ Clear command requires --force flag for safety");
    console.error("Usage: klavis gemini clear --force");
    process.exit(1);
  }

  const action = args._[1];
  const input = args._[2];
  let service, instanceUrl;

  if (action === "add") {
    // For add command, expect URL
    instanceUrl = input;
    if (!instanceUrl.startsWith('http')) {
      console.error("❌ Invalid URL format. URL must start with http or https");
      process.exit(1);
    }

    // Extract service name from URL
    const urlMatch = instanceUrl.match(/https?:\/\/([^.]+)\.klavis\.ai/);
    if (!urlMatch) {
      console.error("❌ Invalid URL format. Expected pattern: https://SERVICE-mcp-server.klavis.ai/");
      process.exit(1);
    }
    
    // Check if URL is from Klavis AI
    if (!instanceUrl.includes('klavis.ai')) {
      console.error("❌ Only Klavis AI MCP servers can be added with this tool");
      process.exit(1);
    }
    
    service = urlMatch[1].toLowerCase();
  } else if (action === "remove") {
    // For remove command, expect service name
    service = input.toLowerCase();
  } else if (action === "list") {
    // For list command, no additional input needed
  } else if (action === "clear") {
    // For clear command, no additional input needed
  }

  const settingsPath = getSettingsPath();
  let settings = {};

  // Read existing settings or create fresh
  if (fs.existsSync(settingsPath)) {
    try {
      const rawData = fs.readFileSync(settingsPath, "utf-8");
      // Fix common JSON issues like trailing commas
      const cleanedData = rawData
        .replace(/,(\s*[}\]])/g, '$1')  // Remove trailing commas
        .replace(/([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g, '$1"$2":'); // Quote unquoted keys
      
      settings = JSON.parse(cleanedData);
    } catch (e) {
      console.error("❌ Error reading existing settings:", e.message);
      console.error("💡 Try fixing JSON syntax in:", settingsPath);
      process.exit(1);
    }
  }

  settings.mcpServers = settings.mcpServers || {};

  // Handle add, remove, or list action
  if (action === "list") {
    // List only Klavis AI MCP servers
    const mcpServers = settings.mcpServers || {};
    const klavisServerNames = Object.keys(mcpServers).filter(name => 
      isKlavisAiService(mcpServers[name])
    );
    
    if (klavisServerNames.length === 0) {
      console.log("📋 No Klavis AI MCP servers configured in Gemini settings");
      console.log(`💡 Add a server with: klavis gemini add <INSTANCE_URL>`);
      return;
    }
    
    console.log("📋 Available Klavis AI MCP Servers:");
    console.log("===================================");
    
    klavisServerNames.forEach((name, index) => {
      console.log(`${index + 1}. ${name}`);
    });
    
    console.log(`\nTotal: ${klavisServerNames.length} Klavis AI MCP server(s) configured`);
    return;
    
  } else if (action === "clear") {
    // Clear only Klavis AI MCP servers
    const mcpServers = settings.mcpServers || {};
    const klavisServerNames = Object.keys(mcpServers).filter(name => 
      isKlavisAiService(mcpServers[name])
    );
    
    if (klavisServerNames.length === 0) {
      console.log("📋 No Klavis AI MCP servers to clear - configuration is already empty");
      return;
    }
    
    // Backup before cle
```

### Core Architecture Module: `examples/google_genai-klavis/python/main.py`
```
import os
import webbrowser
from google import genai
from google.genai import types

from klavis import Klavis
from klavis.types import McpServerName, ToolFormat

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

def main():
    # Get API keys
    gemini_api_key = os.getenv("GEMINI_API_KEY")
    klavis_api_key = os.getenv("KLAVIS_API_KEY")
    
    if not gemini_api_key or not klavis_api_key:
        print("Error: GEMINI_API_KEY or KLAVIS_API_KEY environment variable is not set")
        return
    
    # Initialize clients
    gemini_client = genai.Client(api_key=gemini_api_key)
    klavis_client = Klavis(api_key=klavis_api_key)
    
    # Create MCP server instance
    print("🔧 Creating MCP server instance...")
    mcp_instance = klavis_client.mcp_server.create_server_instance(
        server_name=McpServerName.NOTION,
        user_id="1234")
    print("--- mcp_instance --- \n", mcp_instance)
    
    # Handle OAuth if needed
    if hasattr(mcp_instance, 'oauth_url') and mcp_instance.oauth_url:
        webbrowser.open(mcp_instance.oauth_url)
        print(f"🔐 Opening OAuth authorization: {mcp_instance.oauth_url}")
        print("Please complete the OAuth authorization in your browser...")
        input("Press Enter after completing OAuth authorization...")
    
    # Get tools from Klavis
    mcp_tools = klavis_client.mcp_server.list_tools(
        server_url=mcp_instance.server_url,
        format=ToolFormat.GEMINI
    )
    
    contents = []
    
    # Chat loop
    while True:
        try:
            user_input = input("👤 You: ").strip()
            
            if user_input.lower() in ['quit', 'exit', 'q']:
                break
            
            if not user_input:
                continue
            
            contents.append(types.Content(role="user", parts=[types.Part(text=user_input)]))
            
            response = gemini_client.models.generate_content(
                model='gemini-1.5-pro',
                contents=contents,
                config=types.GenerateContentConfig(tools=mcp_tools.tools)
            )
            
            if response.candidates and response.candidates[0].content.parts:
                contents.append(response.candidates[0].content)
                
                # Check if there are function calls to execute
                has_function_calls = False
                for part in response.candidates[0].content.parts:
                    if hasattr(part, 'function_call') and part.function_call:
                        has_function_calls = True
                        print(f"\n🔧 Calling function: {part.function_call.name}")
                        
                        try:
                            # Execute tool call via Klavis
                            function_result = klavis_client.mcp_server.call_tools(
                                server_url=mcp_instance.server_url,
                                tool_name=part.function_call.name,
                                tool_args=dict(part.function_call.args)
                            )
                            
                            # Create function response in the proper format
                            function_response = {'result': function_result.result}
                            
                        except Exception as e:
                            print(f"Function call error: {e}")
                            function_response = {'error': str(e)}
                        
                        function_response_part = types.Part.from_function_response(
                            name=part.function_call.name,
                            response=function_response
                        )
                        function_response_content = types.Content(
                            role='tool', 
                            parts=[function_response_part]
                        )
                        contents.append(function_response_content)
                
                if has_function_calls:
                    final_response = gemini_client.models.generate_content(
                        model='gemini-1.5-pro',
                        contents=contents,
                        config=types.GenerateContentConfig(tools=mcp_tools.tools)
                    )
                    
                    # Add final response to conversation history
                    contents.append(final_response.candidates[0].content)
                    print(f"🤖 Assistant: {final_response.text}")
                else:
                    # No function calls, just display the response
                    print(f"🤖 Assistant: {response.text}")
                    contents.append(response.candidates[0].content)
            else:
                # No response content, handle gracefully
                print("No response generated.")
            
            print()  # Add spacing
            
        except KeyboardInterrupt:
            print("\n\n👋 Goodbye!")
            break
        except EOFError:
            print("\n\n👋 Goodbye!")
            break
        except Exception as e:
            print(f"\n❌ Error: {e}")

if __name__ == "__main__":
    main() 
```

### Core Architecture Module: `examples/google_genai-klavis/typescript/main.ts`
```
import * as dotenv from 'dotenv';
import { GoogleGenAI, ToolListUnion } from '@google/genai';
import { KlavisClient, Klavis } from 'klavis';
import open from 'open';
import * as readline from 'readline';

// Load environment variables
dotenv.config();

const geminiApiKey = process.env.GEMINI_API_KEY;
const klavisApiKey = process.env.KLAVIS_API_KEY;

if (!geminiApiKey) {
    throw new Error('GEMINI_API_KEY is not set in the environment variables.');
}
if (!klavisApiKey) {
    throw new Error('KLAVIS_API_KEY is not set in the environment variables.');
}

const geminiClient = new GoogleGenAI({ apiKey: geminiApiKey });
const klavisClient = new KlavisClient({ apiKey: klavisApiKey });

// Create readline interface for user input
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Helper function to prompt user input
function promptUser(question: string): Promise<string> {
    return new Promise((resolve) => {
        rl.question(question, (answer: string) => {
            resolve(answer);
        });
    });
}

async function main() {
    try {
        // Create MCP server instance
        const mcpInstance = await klavisClient.mcpServer.createServerInstance({
            serverName: Klavis.McpServerName.Notion,
            userId: "1234"});
        
        console.log("--- mcp_instance ---", mcpInstance);

        // Handle OAuth if needed
        if (mcpInstance.oauthUrl) {
            console.log(`🔐 Opening OAuth authorization: ${mcpInstance.oauthUrl}`);
            await open(mcpInstance.oauthUrl);
            console.log("Please complete the OAuth authorization in your browser...");
            await promptUser("Press Enter after completing OAuth authorization...");
        }

        // Get tools from Klavis
        const mcpTools = await klavisClient.mcpServer.listTools({
            serverUrl: mcpInstance.serverUrl,
            format: Klavis.ToolFormat.Gemini
        });

        const contents: any[] = [];

        // Extract function declarations from the Klavis response
        const gemini_tools = mcpTools.tools as ToolListUnion;
        const functionDeclarations = (gemini_tools[0] as any)?.function_declarations || [];

        console.log(`✅ Loaded ${functionDeclarations.length} function declarations`);

        // Chat loop
        while (true) {
            try {
                const userInput = await promptUser("👤 You: ");
                
                if (userInput.toLowerCase().trim() === 'quit' || 
                    userInput.toLowerCase().trim() === 'exit' || 
                    userInput.toLowerCase().trim() === 'q') {
                    break;
                }

                if (!userInput.trim()) {
                    continue;
                }

                contents.push({
                    role: "user",
                    parts: [{ text: userInput }]
                });

                const response = await geminiClient.models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: contents,
                    config: {
                        tools: [{
                            functionDeclarations: functionDeclarations
                        }]
                    }
                });

                if (!response.candidates || !response.candidates[0]?.content?.parts) {
                    console.log("No response generated.");
                    continue;
                }

                contents.push(response.candidates[0].content);
                
                // Check for function calls in the response
                let hasFunctionCalls = false;
                const functionCallResults: any[] = [];

                // Check if response has functionCalls property
                if (response.functionCalls && response.functionCalls.length > 0) {
                    hasFunctionCalls = true;
                    for (const functionCall of response.functionCalls) {
                        console.log(`\n🔧 Calling function: ${functionCall.name}`);

                        try {
                            // Execute tool call via Klavis
                            const functionResult = await klavisClient.mcpServer.callTools({
                                serverUrl: mcpInstance.serverUrl,
                                toolName: functionCall.name || '',
                                toolArgs: functionCall.args || {}
                            });
                            
                            functionCallResults.push({
                                functionResponse: {
                                    name: functionCall.name,
                                    response: functionResult.result
                                }
                            });
                        } catch (error) {
                            console.error(`❌ Function call error: ${error}`);
                            functionCallResults.push({
                                functionResponse: {
                                    name: functionCall.name,
                                    response: { error: String(error) }
                                }
                            });
                        }
                    }
                }

                // If there were function calls, add the results and get final response
                if (hasFunctionCalls && functionCallResults.length > 0) {
                    // Add function responses to conversation history
                    contents.push({
                        role: 'tool',
                        parts: functionCallResults
                    });

                    // Get final response after function execution
                    const finalResponse = await geminiClient.models.generateContent({
                        model: 'gemini-2.5-flash',
                        contents: contents,
                        config: {
                            tools: [{
                                functionDeclarations: functionDeclarations
                            }],
                            temperature: 0
                        }
                    });
                    
                    // Add final response to conversation history
                    if (finalResponse.candidates && finalResponse.candidates[0]?.content) {
                        contents.push(finalResponse.candidates[0].content);
                    }
                    
                    console.log(`\n🤖 Assistant: ${finalResponse.text || 'No response text'}`);
                } else {
                    // No function calls, just display the response
                    console.log(`\n🤖 Assistant: ${response.text || 'No response text'}`);
                }
                
            } catch (error) {
                console.error(`\n❌ Error: ${error}`);
                if (error instanceof Error) {
                    console.error(`Stack trace: ${error.stack}`);
                }
            }
        }
        
        console.log("\n\n👋 Goodbye!");
        
    } catch (error) {
        console.error("❌ Demo failed:", error);
        if (error instanceof Error) {
            console.error(`Stack trace: ${error.stack}`);
        }
        process.exit(1);
    } finally {
        rl.close();
    }
}

main();
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #696** (2025-11-17): **[BUG] Attio MCP is missing write permissions for "Tasks" object**
  *Symptoms*: Unable to create tasks with the Klavis / Strata Attio MCP because the integration with Attio doesn't have the correct permissions. We need write permissions but currently only have read.  <img width="848" height="936" alt="Image" src="https://github.com/user-attachments/assets/4a9b1eb4-2e47-492f-a6aa-fe7f60cb1996" />
  **Post-Mortem & Fix Analysis**:
  > Thanks! Just changed that:  <img width="813" height="547" alt="Image" src="https://github.com/user-attachments/assets/288fde40-adc4-43da-b594-9cffb2211f46" />  Please give it another try.

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

### Incident Patch 1: `669e95dc` (2026-05-09)
**Commit Message**: bug fix (#1629)

**File**: `mcp_servers/hugging_face/packages/mcp/src/duplicate-space.ts` (modified, +1/-0)
```diff
@@ -207,6 +207,7 @@ export class DuplicateSpaceTool extends HfApiCall<DuplicateSpaceParams, Duplicat
 
 			const response = await this.fetchFromApi<{ url: string }>(url, {
 				method: 'POST',
+				headers: { 'Content-Type': 'application/json' },
 				body: JSON.stringify(payload),
 			});
 
```

**File**: `mcp_servers/snowflake_toolathlon/src/mcp_snowflake_server/server.py` (modified, +1/-1)
```diff
@@ -375,7 +375,7 @@ async def handle_read_query(arguments, db, write_detector, *_, exclude_json_resu
     return results
 
 
-async def handle_append_insight(arguments, db, _, __, server, exclude_json_results=False):
+async def handle_append_insight(arguments, db, _, __, server, exclude_json_results=False, allowed_databases=None, **___):
     if not arguments or "insight" not in arguments:
         raise ValueError("Missing insight argument")
 
```

---

### Incident Patch 2: `2fc4b0b5` (2026-04-06)
**Commit Message**: Fix slack server logging problem (#1471)

**File**: `mcp_servers/slack_atlas/pkg/server/server.go` (modified, +0/-1)
```diff
@@ -28,7 +28,6 @@ func NewMCPServer(p *provider.ApiProvider, logger *zap.Logger) *MCPServer {
 	s := server.NewMCPServer(
 		"Slack MCP Server",
 		version.Version,
-		server.WithLogging(),
 		server.WithRecovery(),
 		server.WithToolHandlerMiddleware(buildLoggerMiddleware(logger)),
 		server.WithToolHandlerMiddleware(auth.BuildMiddleware(p.ServerTransport(), logger)),
```

---

### Incident Patch 3: `340b6cfc` (2026-03-26)
**Commit Message**: fix proxy again. (#1415)

**File**: `mcp_servers/scholarly_toolathlon/src/mcp_scholarly/google_scholar.py` (modified, +10/-10)
```diff
@@ -1,31 +1,31 @@
 import os
 from typing import List, Optional
 
-from scholarly import scholarly, ProxyGenerator
+from scholarly import scholarly
 
 MAX_RESULTS = 10
 
 
-def _get_proxy_url() -> Optional[str]:
-    """Build proxy URL from environment variables (same as duckduckgo server)."""
+def _setup_proxy() -> None:
+    """Set HTTP_PROXY/HTTPS_PROXY env vars so scholarly (httpx) uses the proxy."""
     username = os.environ.get("PROXY_USERNAME")
     password = os.environ.get("PROXY_PASSWORD")
     if not (username and password):
-        return None
+        return
     host = os.environ.get("PROXY_HOST", "p.webshare.io")
     scheme = os.environ.get("PROXY_SCHEME", "http")
     port = os.environ.get("PROXY_PORT", "1080" if "socks" in scheme else "80")
-    return f"{scheme}://{username}:{password}@{host}:{port}"
+    proxy = f"{scheme}://{username}:{password}@{host}:{port}"
+    os.environ.setdefault("HTTP_PROXY", proxy)
+    os.environ.setdefault("HTTPS_PROXY", proxy)
+
+
+_setup_proxy()
 
 
 class GoogleScholar:
     def __init__(self):
         self.scholarly = scholarly
-        proxy = _get_proxy_url()
-        if proxy:
-            pg = ProxyGenerator()
-            pg.SingleProxy(http=proxy, https=proxy)
-            self.scholarly.use_proxy(pg)
 
     def get_scholarly(self, keyword):
         return self.scholarly.search_pubs(keyword)
```

---

### Incident Patch 4: `eeabcfc7` (2026-03-26)
**Commit Message**: fix proxy. (#1414)

**File**: `mcp_servers/scholarly_toolathlon/src/mcp_scholarly/google_scholar.py` (modified, +4/-2)
```diff
@@ -1,7 +1,7 @@
 import os
 from typing import List, Optional
 
-from scholarly import scholarly
+from scholarly import scholarly, ProxyGenerator
 
 MAX_RESULTS = 10
 
@@ -23,7 +23,9 @@ def __init__(self):
         self.scholarly = scholarly
         proxy = _get_proxy_url()
         if proxy:
-            self.scholarly.use_proxy(http=proxy, https=proxy)
+            pg = ProxyGenerator()
+            pg.SingleProxy(http=proxy, https=proxy)
+            self.scholarly.use_proxy(pg)
 
     def get_scholarly(self, keyword):
         return self.scholarly.search_pubs(keyword)
```

---

### Incident Patch 5: `304b0717` (2026-03-14)
**Commit Message**: Fix package version for youtube mcp (#1374)

**File**: `mcp_servers/youtube_toolathlon/package.json` (modified, +5/-5)
```diff
@@ -22,15 +22,15 @@
     "@modelcontextprotocol/sdk": "^1.1.1",
     "express": "^4.18.0",
     "googleapis": "^129.0.0",
-    "ytdl-core": "^4.11.5",
-    "youtube-transcript": "^1.0.6"
+    "youtube-transcript": "1.0.6",
+    "ytdl-core": "^4.11.5"
   },
   "devDependencies": {
     "@types/express": "^4.17.0",
     "@types/node": "^18.0.0",
-    "typescript": "^5.0.0",
+    "nodemon": "^3.0.0",
     "ts-node": "^10.9.1",
-    "nodemon": "^3.0.0"
+    "typescript": "^5.0.0"
   },
   "keywords": [
     "youtube",
@@ -50,4 +50,4 @@
     "url": "https://github.com/ZubeidHendricks/youtube-mcp-server/issues"
   },
   "homepage": "https://github.com/ZubeidHendricks/youtube-mcp-server#readme"
-}
\ No newline at end of file
+}
```

---

### Incident Patch 6: `eab2becb` (2026-03-10)
**Commit Message**: fix docker. (#1339)

**File**: `mcp_servers/arxiv_latex/Dockerfile` (modified, +2/-2)
```diff
@@ -19,13 +19,13 @@ RUN curl -LsSf https://astral.sh/uv/install.sh | sh
 
 ENV PATH="/root/.local/bin:${PATH}"
 
-COPY mcp_servers/arxiv-latex-mcp/.python-version .
+COPY mcp_servers/arxiv_latex/.python-version .
 
 RUN uv venv
 
 FROM base AS builder
 
-COPY mcp_servers/arxiv-latex-mcp/ .
+COPY mcp_servers/arxiv_latex/ .
 
 RUN uv sync
 
```

---

### Incident Patch 7: `a1efdeaf` (2026-03-09)
**Commit Message**: fix OOM for notion-toolathlon. (#1332)

**File**: `mcp_servers/notion_toolathlon/scripts/start-server.ts` (modified, +5/-1)
```diff
@@ -5,7 +5,7 @@ import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/
 import { randomBytes } from 'node:crypto'
 import express from 'express'
 
-import { initProxy, ValidationError } from '../src/init-server.js'
+import { initProxy, preloadSpec, ValidationError } from '../src/init-server.js'
 
 /**
  * Extract Notion token from request header.
@@ -134,6 +134,10 @@ Examples:
     await proxy.connect(new StdioServerTransport())
     return proxy.getServer()
   } else if (transport === 'http') {
+    // Pre-load and pre-compute the OpenAPI spec and tools once at startup
+    // to avoid re-parsing on every request (major memory optimization)
+    await preloadSpec(specPath, baseUrl)
+
     // Use Streamable HTTP transport
     const app = express()
     app.use(express.json())
```

**File**: `mcp_servers/notion_toolathlon/src/init-server.ts` (modified, +16/-4)
```diff
@@ -4,7 +4,7 @@ import path from 'node:path'
 import { OpenAPIV3 } from 'openapi-types'
 import OpenAPISchemaValidator from 'openapi-schema-validator'
 
-import { MCPProxy } from './openapi-mcp-server/mcp/proxy.js'
+import { MCPProxy, precomputeTools, type PrecomputedTools } from './openapi-mcp-server/mcp/proxy.js'
 
 export class ValidationError extends Error {
   constructor(public errors: any[]) {
@@ -42,9 +42,21 @@ async function loadOpenApiSpec(specPath: string, baseUrl: string | undefined): P
   }
 }
 
-export async function initProxy(specPath: string, baseUrl: string | undefined, options: { pageIds?: string[]; pageUrls?: string[]; notionToken?: string } = {}) {
-  const openApiSpec = await loadOpenApiSpec(specPath, baseUrl)
-  const proxy = new MCPProxy('Notion API', openApiSpec, options)
+let cachedSpec: OpenAPIV3.Document | null = null
+let cachedPrecomputed: PrecomputedTools | null = null
+
+/**
+ * Pre-load the OpenAPI spec and precompute tools once at startup.
+ * This avoids re-parsing and re-converting on every request.
+ */
+export async function preloadSpec(specPath: string, baseUrl: string | undefined): Promise<void> {
+  cachedSpec = await loadOpenApiSpec(specPath, baseUrl)
+  cachedPrecomputed = precomputeTools(cachedSpec)
+  console.log('OpenAPI spec and tools pre-computed successfully')
+}
 
+export async function initProxy(specPath: string, baseUrl: string | undefined, options: { pageIds?: string[]; pageUrls?: string[]; notionToken?: string } = {}) {
+  const openApiSpec = cachedSpec ?? await loadOpenApiSpec(specPath, baseUrl)
+  const proxy = new MCPProxy('Notion API', openApiSpec, options, cachedPrecomputed ?? undefined)
   return proxy
 }
```

**File**: `mcp_servers/notion_toolathlon/src/openapi-mcp-server/client/http-client.ts` (modified, +40/-18)
```diff
@@ -29,24 +29,44 @@ export class HttpClientError extends Error {
   }
 }
 
+/**
+ * Initialize the OpenAPI client from a spec. This is expensive (parses and
+ * validates the entire spec) so the result should be cached and reused.
+ */
+export function initApiClient(
+  baseUrl: string,
+  openApiSpec: OpenAPIV3.Document | OpenAPIV3_1.Document,
+): Promise<AxiosInstance> {
+  // @ts-expect-error
+  const client = new (OpenAPIClientAxios.default ?? OpenAPIClientAxios)({
+    definition: openApiSpec,
+    axiosConfigDefaults: {
+      baseURL: baseUrl,
+      headers: {
+        'Content-Type': 'application/json',
+        'User-Agent': 'notion-mcp-server',
+      },
+    },
+  })
+  return client.init()
+}
+
 export class HttpClient {
   private api: Promise<AxiosInstance>
-  private client: OpenAPIClientAxios
-
-  constructor(config: HttpClientConfig, openApiSpec: OpenAPIV3.Document | OpenAPIV3_1.Document) {
-    // @ts-expect-error
-    this.client = new (OpenAPIClientAxios.default ?? OpenAPIClientAxios)({
-      definition: openApiSpec,
-      axiosConfigDefaults: {
-        baseURL: config.baseUrl,
-        headers: {
-          'Content-Type': 'application/json',
-          'User-Agent': 'notion-mcp-server',
-          ...config.headers,
-        },
-      },
-    })
-    this.api = this.client.init()
+  private perRequestHeaders: Record<string, string>
+
+  /**
+   * Create an HttpClient. If a cachedApi is provided, reuses the already-initialized
+   * axios instance (avoids expensive re-parsing of the spec on every request).
+   */
+  constructor(config: HttpClientConfig, openApiSpec: OpenAPIV3.Document | OpenAPIV3_1.Document, cachedApi?: Promise<AxiosInstance>) {
+    this.perRequestHeaders = config.headers || {}
+
+    if (cachedApi) {
+      this.api = cachedApi
+    } else {
+      this.api = initApiClient(config.baseUrl, openApiSpec)
+    }
   }
 
   private async prepareFileUpload(operation: OpenAPIV3.OperationObject, params: Record<string, any>): Promise<FormData | null> {
@@ -152,12 +172,14 @@ export class HttpClient {
     try {
       // If we have form data, we need to set the correct headers
       const hasBody = Object.keys(bodyParams).length > 0
-      const headers = formData
+      const contentHeaders = formData
         ? formData.getHeaders()
         : { ...(hasBody ? { 'Content-Type': 'application/json' } : { 'Content-Type': null }) }
       const requestConfig = {
         headers: {
-          ...headers,
+          ...contentHeaders,
+          // Inject per-request auth headers (e.g. per-user Notion token)
+          ...this.perRequestHeaders,
         },
       }
 
```

**File**: `mcp_servers/notion_toolathlon/src/openapi-mcp-server/mcp/proxy.ts` (modified, +42/-7)
```diff
@@ -2,7 +2,8 @@ import { Server } from '@modelcontextprotocol/sdk/server/index.js'
 import { CallToolRequestSchema, JSONRPCResponse, ListToolsRequestSchema, Tool } from '@modelcontextprotocol/sdk/types.js'
 import { JSONSchema7 as IJsonSchema } from 'json-schema'
 import { OpenAPIToMCPConverter } from '../openapi/parser.js'
-import { HttpClient, HttpClientError } from '../client/http-client.js'
+import { HttpClient, HttpClientError, initApiClient } from '../client/http-client.js'
+import type { AxiosInstance } from 'axios'
 import { OpenAPIV3 } from 'openapi-types'
 import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'
 import { PageAccessController } from '../auth/page-access-control.js'
@@ -30,6 +31,34 @@ export interface MCPProxyOptions {
   notionToken?: string
 }
 
+/**
+ * Pre-computed tools, lookup, and cached API client from OpenAPI spec.
+ * These are expensive to compute and should be done once at startup.
+ */
+export interface PrecomputedTools {
+  tools: Record<string, NewToolDefinition>
+  openApiLookup: Record<string, OpenAPIV3.OperationObject & { method: string; path: string }>
+  cachedApi: Promise<AxiosInstance>
+}
+
+/**
+ * Pre-compute tools and initialize the API client from an OpenAPI spec.
+ * Call once at startup to avoid expensive re-parsing on every request.
+ */
+export function precomputeTools(openApiSpec: OpenAPIV3.Document): PrecomputedTools {
+  const converter = new OpenAPIToMCPConverter(openApiSpec)
+  const { tools, openApiLookup } = converter.convertToMCPTools()
+
+  const baseUrl = openApiSpec.servers?.[0]?.url
+  if (!baseUrl) {
+    throw new Error('No base URL found in OpenAPI spec')
+  }
+
+  const cachedApi = initApiClient(baseUrl, openApiSpec)
+
+  return { tools, openApiLookup, cachedApi }
+}
+
 // import this class, extend and return server
 export class MCPProxy {
   private server: Server
@@ -38,7 +67,7 @@ export class MCPProxy {
   private openApiLookup: Record<string, OpenAPIV3.OperationObject & { method: string; path: string }>
   private pageAccessController: PageAccessController | null = null
 
-  constructor(name: string, openApiSpec: OpenAPIV3.Document, options: MCPProxyOptions = {}) {
+  constructor(name: string, openApiSpec: OpenAPIV3.Document, options: MCPProxyOptions = {}, precomputed?: PrecomputedTools) {
     this.server = new Server({ name, version: '1.0.0' }, { capabilities: { tools: {} } })
     const baseUrl = openApiSpec.servers?.[0].url
     if (!baseUrl) {
@@ -50,6 +79,7 @@ export class MCPProxy {
         headers: this.parseHeadersFromEnv(options.notionToken),
       },
       openApiSpec,
+      precomputed?.cachedApi,
     )
 
     // Initialize page access control if needed
@@ -61,11 +91,16 @@ export class MCPProxy {
       })
     }
 
-    // Convert OpenAPI spec to MCP tools
-    const converter = new OpenAPIToMCPConverter(openApiSpec)
-    const { tools, openApiLookup } = converter.convertToMCPTools()
-    this.tools = tools
-    this.openApiLookup = openApiLookup
+    // Use pre-computed tools if available, otherwise compute them
+    if (precomputed) {
+      this.tools = precomputed.tools
+      this.openApiLookup = precomputed.openApiLookup
+    } else {
+      const converter = new OpenAPIToMCPConverter(openApiSpec)
+      const { tools, openApiLookup } = converter.convertToMCPTools()
+      this.tools = tools
+      this.openApiLookup = openApiLookup
+    }
 
     this.setupHandlers()
   }
```

**File**: `mcp_servers/notion_toolathlon/src/openapi-mcp-server/openapi/parser.ts` (modified, +5/-0)
```diff
@@ -20,6 +20,7 @@ type FunctionParameters = {
 export class OpenAPIToMCPConverter {
   private schemaCache: Record<string, IJsonSchema> = {}
   private nameCounter: number = 0
+  private componentSchemaCache: Record<string, IJsonSchema> | null = null
 
   constructor(private openApiSpec: OpenAPIV3.Document | OpenAPIV3_1.Document) {}
 
@@ -250,11 +251,15 @@ export class OpenAPIToMCPConverter {
   }
 
   private convertComponentsToJsonSchema(): Record<string, IJsonSchema> {
+    if (this.componentSchemaCache) {
+      return this.componentSchemaCache
+    }
     const components = this.openApiSpec.components || {}
     const schema: Record<string, IJsonSchema> = {}
     for (const [key, value] of Object.entries(components.schemas || {})) {
       schema[key] = this.convertOpenApiSchemaToJsonSchema(value, new Set())
     }
+    this.componentSchemaCache = schema
     return schema
   }
   /**
```

---

### Incident Patch 8: `82baa0f2` (2026-03-05)
**Commit Message**: fix yahoo finance (#1326)

**File**: `mcp_servers/yahoo_finance/server.py` (modified, +27/-6)
```diff
@@ -621,13 +621,34 @@ async def get_recommendations(ticker: str, recommendation_type: str, months_back
 
 
 if __name__ == "__main__":
+    import contextlib
     import uvicorn
+    from collections.abc import AsyncIterator
+    from mcp.server.streamable_http_manager import StreamableHTTPSessionManager
+    from starlette.applications import Starlette
+    from starlette.routing import Mount
+    from starlette.types import Receive, Scope, Send
 
     print("Starting Yahoo Finance MCP server...")
-    uvicorn.run(
-        yfinance_server.streamable_http_app(),
-        host="0.0.0.0",
-        port=5000,
-        proxy_headers=True,
-        forwarded_allow_ips="*",
+
+    session_manager = StreamableHTTPSessionManager(
+        app=yfinance_server._mcp_server,
+        event_store=None,
+        json_response=False,
+        stateless=True,
+    )
+
+    async def handle_streamable_http(scope: Scope, receive: Receive, send: Send) -> None:
+        await session_manager.handle_request(scope, receive, send)
+
+    @contextlib.asynccontextmanager
+    async def lifespan(app: Starlette) -> AsyncIterator[None]:
+        async with session_manager.run():
+            yield
+
+    starlette_app = Starlette(
+        routes=[Mount("/mcp", app=handle_streamable_http)],
+        lifespan=lifespan,
     )
+
+    uvicorn.run(starlette_app, host="0.0.0.0", port=5000)
```

---

### Incident Patch 9: `f422f244` (2026-03-05)
**Commit Message**: fix yahoo finance (#1325)

**File**: `mcp_servers/yahoo_finance/server.py` (modified, +9/-4)
```diff
@@ -33,8 +33,6 @@ class RecommendationType(str, Enum):
 # Initialize FastMCP server
 yfinance_server = FastMCP(
     "yfinance",
-    host="0.0.0.0",
-    port=5000,
     instructions="""
 # Yahoo Finance MCP Server
 
@@ -623,6 +621,13 @@ async def get_recommendations(ticker: str, recommendation_type: str, months_back
 
 
 if __name__ == "__main__":
-    # Initialize and run the server
+    import uvicorn
+
     print("Starting Yahoo Finance MCP server...")
-    yfinance_server.run(transport="streamable-http")
+    uvicorn.run(
+        yfinance_server.streamable_http_app(),
+        host="0.0.0.0",
+        port=5000,
+        proxy_headers=True,
+        forwarded_allow_ips="*",
+    )
```

---

### Incident Patch 10: `57481e62` (2026-03-05)
**Commit Message**: Fix routing (#1323)

**File**: `mcp_servers/howtocook/src/index.ts` (modified, +1/-1)
```diff
@@ -101,7 +101,7 @@ async function main() {
         // 为每个请求创建新的服务器实例
         const requestServer = createServerInstance();
 
-        if (url === "/mcp") {
+        if (url === "/mcp" || url === "/mcp/") {
           const transport = new StreamableHTTPServerTransport({
             sessionIdGenerator: undefined,
           });
```

#### Recent Merged Pull Requests:
- **PR #1665** (2026-06-01): Update API specifications with fern api update (@zihaolin96)
- **PR #1662** (2026-05-26): Update API specifications with fern api update (@zihaolin96)
- **PR #1629** (2026-05-09): bug fix (@zihaolin96)
- **PR #1590** (closed): Bump axios from 1.9.0 to 1.16.0 in /mcp_servers/notion_toolathlon (@dependabot[bot])
- **PR #1585** (2026-05-07): add sandbox concept back. (@xiangkaiz)
- **PR #1584** (2026-05-07): update doc (@zihaolin96)
- **PR #1580** (closed): Fix CWE-863: allowed_databases bypass via unqualified SQL in Snowflake MCP server (@andesyteoss)
- **PR #1579** (closed): Sanitize error messages in Snowflake MCP server to prevent credential leakage (CWE-200) (@andesyteoss)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

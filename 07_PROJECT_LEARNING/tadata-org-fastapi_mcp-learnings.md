# Forensic Learning Record (Deep Inspection): tadata-org/fastapi_mcp

> **Canonical Artifact**: `07_PROJECT_LEARNING/tadata-org-fastapi_mcp-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/tadata-org/fastapi_mcp](https://github.com/tadata-org/fastapi_mcp))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T19:35:54.757Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `tadata-org/fastapi_mcp`
- **Description**: Expose your FastAPI endpoints as Model Context Protocol (MCP) tools, with Auth!
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 12013 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `examples/01_basic_usage_example.py`
```
from examples.shared.apps.items import app  # The FastAPI app
from examples.shared.setup import setup_logging

from fastapi_mcp import FastApiMCP

setup_logging()

# Add MCP server to the FastAPI app
mcp = FastApiMCP(app)

# Mount the MCP server to the FastAPI app
mcp.mount_http()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)

```

### Core Architecture Module: `examples/02_full_schema_description_example.py`
```
"""
This example shows how to describe the full response schema instead of just a response example.
"""

from examples.shared.apps.items import app  # The FastAPI app
from examples.shared.setup import setup_logging

from fastapi_mcp import FastApiMCP

setup_logging()

# Add MCP server to the FastAPI app
mcp = FastApiMCP(
    app,
    name="Item API MCP",
    description="MCP server for the Item API",
    describe_full_response_schema=True,  # Describe the full response JSON-schema instead of just a response example
    describe_all_responses=True,  # Describe all the possible responses instead of just the success (2XX) response
)

mcp.mount_http()

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)

```

### Core Architecture Module: `examples/03_custom_exposed_endpoints_example.py`
```
"""
This example shows how to customize exposing endpoints by filtering operation IDs and tags.
Notes on filtering:
- You cannot use both `include_operations` and `exclude_operations` at the same time
- You cannot use both `include_tags` and `exclude_tags` at the same time
- You can combine operation filtering with tag filtering (e.g., use `include_operations` with `include_tags`)
- When combining filters, a greedy approach will be taken. Endpoints matching either criteria will be included
"""

from examples.shared.apps.items import app  # The FastAPI app
from examples.shared.setup import setup_logging

from fastapi_mcp import FastApiMCP

setup_logging()

# Examples demonstrating how to filter MCP tools by operation IDs and tags

# Filter by including specific operation IDs
include_operations_mcp = FastApiMCP(
    app,
    name="Item API MCP - Included Operations",
    include_operations=["get_item", "list_items"],
)

# Filter by excluding specific operation IDs
exclude_operations_mcp = FastApiMCP(
    app,
    name="Item API MCP - Excluded Operations",
    exclude_operations=["create_item", "update_item", "delete_item"],
)

# Filter by including specific tags
include_tags_mcp = FastApiMCP(
    app,
    name="Item API MCP - Included Tags",
    include_tags=["items"],
)

# Filter by excluding specific tags
exclude_tags_mcp = FastApiMCP(
    app,
    name="Item API MCP - Excluded Tags",
    exclude_tags=["search"],
)

# Combine operation IDs and tags (include mode)
combined_include_mcp = FastApiMCP(
    app,
    name="Item API MCP - Combined Include",
    include_operations=["delete_item"],
    include_tags=["search"],
)

# Mount all MCP servers with different paths
include_operations_mcp.mount_http(mount_path="/include-operations-mcp")
exclude_operations_mcp.mount_http(mount_path="/exclude-operations-mcp")
include_tags_mcp.mount_http(mount_path="/include-tags-mcp")
exclude_tags_mcp.mount_http(mount_path="/exclude-tags-mcp")
combined_include_mcp.mount_http(mount_path="/combined-include-mcp")

if __name__ == "__main__":
    import uvicorn

    print("Server is running with multiple MCP endpoints:")
    print(" - /include-operations-mcp: Only get_item and list_items operations")
    print(" - /exclude-operations-mcp: All operations except create_item, update_item, and delete_item")
    print(" - /include-tags-mcp: Only operations with the 'items' tag")
    print(" - /exclude-tags-mcp: All operations except those with the 'search' tag")
    print(" - /combined-include-mcp: Operations with 'search' tag or delete_item operation")
    uvicorn.run(app, host="0.0.0.0", port=8000)

```

### Core Architecture Module: `examples/04_separate_server_example.py`
```
"""
This example shows how to run the MCP server and the FastAPI app separately.
You can create an MCP server from one FastAPI app, and mount it to a different app.
"""

from fastapi import FastAPI

from examples.shared.apps.items import app
from examples.shared.setup import setup_logging

from fastapi_mcp import FastApiMCP

setup_logging()

MCP_SERVER_HOST = "localhost"
MCP_SERVER_PORT = 8000
ITEMS_API_HOST = "localhost"
ITEMS_API_PORT = 8001


# Take the FastAPI app only as a source for MCP server generation
mcp = FastApiMCP(app)

# Mount the MCP server to a separate FastAPI app
mcp_app = FastAPI()
mcp.mount_http(mcp_app)

# Run the MCP server separately from the original FastAPI app.
# It still works 🚀
# Your original API is **not exposed**, only via the MCP server.
if __name__ == "__main__":
    import uvicorn

    uvicorn.run(mcp_app, host="0.0.0.0", port=8000)

```

### Core Architecture Module: `examples/05_reregister_tools_example.py`
```
"""
This example shows how to re-register tools if you add endpoints after the MCP server was created.
"""

from examples.shared.apps.items import app  # The FastAPI app
from examples.shared.setup import setup_logging

from fastapi_mcp import FastApiMCP

setup_logging()

mcp = FastApiMCP(app)  # Add MCP server to the FastAPI app
mcp.mount_http()  # MCP server


# This endpoint will not be registered as a tool, since it was added after the MCP instance was created
@app.get("/new/endpoint/", operation_id="new_endpoint", response_model=dict[str, str])
async def new_endpoint():
    return {"message": "Hello, world!"}


# But if you re-run the setup, the new endpoints will now be exposed.
mcp.setup_server()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)

```

### Core Architecture Module: `examples/06_custom_mcp_router_example.py`
```
"""
This example shows how to mount the MCP server to a specific APIRouter, giving a custom mount path.
"""

from examples.shared.apps.items import app  # The FastAPI app
from examples.shared.setup import setup_logging

from fastapi import APIRouter
from fastapi_mcp import FastApiMCP

setup_logging()

other_router = APIRouter(prefix="/other/route")
app.include_router(other_router)

mcp = FastApiMCP(app)

# Mount the MCP server to a specific router.
# It will now only be available at `/other/route/mcp`
mcp.mount_http(other_router)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)

```

### Core Architecture Module: `examples/07_configure_http_timeout_example.py`
```
"""
This example shows how to configure the HTTP client timeout for the MCP server.
In case you have API endpoints that take longer than 5 seconds to respond, you can increase the timeout.
"""

from examples.shared.apps.items import app  # The FastAPI app
from examples.shared.setup import setup_logging

import httpx

from fastapi_mcp import FastApiMCP

setup_logging()


mcp = FastApiMCP(app, http_client=httpx.AsyncClient(timeout=20))
mcp.mount_http()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)

```

### Core Architecture Module: `examples/08_auth_example_token_passthrough.py`
```
"""
This example shows how to reject any request without a valid token passed in the Authorization header.

In order to configure the auth header, the config file for the MCP server should looks like this:
```json
{
  "mcpServers": {
    "remote-example": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "http://localhost:8000/mcp",
        "--header",
        "Authorization:${AUTH_HEADER}"
      ]
    },
    "env": {
      "AUTH_HEADER": "Bearer <your-token>"
    }
  }
}
```
"""

from examples.shared.apps.items import app  # The FastAPI app
from examples.shared.setup import setup_logging

from fastapi import Depends
from fastapi.security import HTTPBearer

from fastapi_mcp import FastApiMCP, AuthConfig

setup_logging()

# Scheme for the Authorization header
token_auth_scheme = HTTPBearer()


# Create a private endpoint
@app.get("/private")
async def private(token=Depends(token_auth_scheme)):
    return token.credentials


# Create the MCP server with the token auth scheme
mcp = FastApiMCP(
    app,
    name="Protected MCP",
    auth_config=AuthConfig(
        dependencies=[Depends(token_auth_scheme)],
    ),
)

# Mount the MCP server
mcp.mount_http()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #229** (2025-09-22): **[BUG] Not working with optional parameters**
  *Symptoms*: **Describe the bug** For parameters that are optional e.g. `name: Optional[str]` or `name: str | None`, there is still an error returned if they are not provided.   Parameters: ```json {} ```  Error Message: ```json {   "error": "HTTP error! Status: 422. Message: {\"detail\":[{\"type\":\"missing\",\"loc\":[\"query\",\"name\"],\"msg\":\"Field required\",\"input\":null}]}" } ```  **To Reproduce** ```python @app.get("/test", operation_id="test_endpoint", description="The name parameter is optional. If no name is provided the default name will be used.") async def test(name: Optional[str]):     return {"name": "provided" if name else "default"} ```  Ask: `Please use the test tool with default name.`  <img width="2046" height="1316" alt="Image" src="https://github.com/user-attachments/assets/ea58227c-deee-490b-9c48-3597ea496e85" />  <img width="1752" height="536" alt="Image" src="https://github.com/user-attachments/assets/3acd1323-623d-418c-8e73-5a49919704af" />  **System Info** MacOS. Latest Python and fastapi_mcp version. 
  **Post-Mortem & Fix Analysis**:
  > Update. Works after adding ` = None`.  ```python @app.get("/test", operation_id="test_endpoint", description="The name parameter is optional. If no name is provided the default name will be used.") async def test(name: Optional[str] = None):     return {"name": "provided" if name else "default"} ```

- **Issue #198** (2025-07-20): **[BUG] fastapi-mcp latest release 0.3.6 breaks**
  *Symptoms*: **Describe the bug** When using the MCP server (trying to fetch the avaliable tools), I get the following error:  ``` ERROR:root:Unhandled exception in receive loop: 'JSONRPCMessage' object has no attribute 'message' Traceback (most recent call last):   File "/usr/local/lib/python3.11/site-packages/mcp/shared/session.py", line 340, in _receive_loop     elif isinstance(message.message.root, JSONRPCRequest):                     ^^^^^^^^^^^^^^^   File "/usr/local/lib/python3.11/site-packages/pydantic/main.py", line 991, in __getattr__     raise AttributeError(f'{type(self).__name__!r} object has no attribute {item!r}') AttributeError: 'JSONRPCMessage' object has no attribute 'message' ```  This seems to be related to a problem with upstream lib [mcp version >1.7.0](https://github.com/modelcontextprotocol/python-sdk/issues/691).    **To Reproduce** Steps to reproduce the behavior, including example code.  **System Info** Python version 3.11 fastapi-mcp version 0.3.6 
  **Post-Mortem & Fix Analysis**:
  > Hey @musoles , can you provide some code to reproduce this issue?
  > I can't reproduce this neither
  > Closing for now. Lmk if it persists

- **Issue #161** (2025-06-11): **[BUG] Tool names should be <=64 characters**
  *Symptoms*: **Describe the bug** Currently, the tool name is concatenated from its function name/other paths. This can often go over the 64 char limit used in common MCP implementations, which results in errors.  **To Reproduce** Try a tool with a name >64 characters with for example `n8n` or `langchain` with `openai/gpt-4.1-mini`. It returns a 400 Provider returned error.   **Possible Solution** Allow the user to override the default (concatenated) tool name with a custom name. Or omit some path prefixes.  **System Info** n8n/langchain/openai models on Linux 
  **Post-Mortem & Fix Analysis**:
  > i do believe in the documentation its said that this can be overriden using operation_id parameter when defining the route
  > That's handy, though it's a little cumbersome if there are a large number of routes. And routes >60 chars (cursor) or 64 chars (claude, n8n) often can't be used at all so it would be good to fix them at point of creation.

- **Issue #147** (2025-05-21): **[BUG] Tools gets registered only if the route is defined via decorator.**
  *Symptoms*: **Describe the bug**  MCP Tools gets registered only if the route is defined with decorator.  ```py @app.get("/create_file/{filepath}/{content}", operation_id="create_file") async def create_new_file(filepath: str, content: str):     tool = MCPTool()     return await tool.run(filepath, content) ```  I tried dynamically registering via methods. But this wont work.  Any other way to dynamically add tools?  ```py @app.on_event("startup") def load_dynamic_tools():     tool = MCPTool()                  app.add_api_route(tool.path, tool.run, methods= tool.methods, operation_id= tool.name) ```   **To Reproduce** __  **System Info** Mac OS Sonoma 15.3.2 (24D81) 
  **Post-Mortem & Fix Analysis**:
  > The issue is not with app.add_api_route  It works if you don't call it from the startup event.

- **Issue #134** (2025-07-29): **[BUG] Client can't to connect mcp sever SSE**
  *Symptoms*: app-1  |     |   File "/usr/local/lib/python3.13/site-packages/mcp/shared/session.py", line 209, in __aexit__ app-1  |     |     return await self._task_group.__aexit__(exc_type, exc_val, exc_tb) app-1  |     |            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ app-1  |     |   File "/usr/local/lib/python3.13/site-packages/anyio/_backends/_asyncio.py", line 772, in __aexit__ app-1  |     |     raise BaseExceptionGroup( app-1  |     |         "unhandled errors in a TaskGroup", self._exceptions app-1  |     |     ) from None app-1  |     | ExceptionGroup: unhandled errors in a TaskGroup (1 sub-exception) app-1  |     +-+---------------- 1 ---------------- app-1  |       | Traceback (most recent call last): app-1  |       |   File "/usr/local/lib/python3.13/site-packages/mcp/server/session.py", line 146, in _receive_loop app-1  |       |     await super()._receive_loop() app-1  |       |   File "/usr/local/lib/python3.13/site-packages/mcp/shared/session.py", line 331, in _receive_loop app-1  |       |     elif isinstance(message.message.root, JSONRPCRequest): app-1  |       |                     ^^^^^^^^^^^^^^^ app-1  |       |   File "/usr/local/lib/python3.13/site-packages/pydantic/main.py", line 989, in __getattr__ app-1  |       |     raise AttributeError(f'{type(self).__name__!r} object has no attribute {item!r}') app-1  |       | AttributeError: 'JSONRPCMessage' object has no attribute 'message' app-1  |       +------------------------------------ 
  **Post-Mortem & Fix Analysis**:
  > I had the same problem. I downgraded my mcp package to version 1.7.0. It was probably a compatibility issue with the new version: pip3 install mcp==1.7.0
  > In the mcp/shared/session.py the code is expecting to read SessionMessage, but it actually gets JSONRPCMessage and thus anywhere it says `message.message` gets the above exception. I experimentally changed all the occurrences of `message.message` to just `message` and it started working.  This is the commit in the mcp python SDK that introduced the change of wrapping messages into SessionMessage:  https://github.com/modelcontextprotocol/python-sdk/commit/da0cf223553d50e48fba7652b2ef0eca26550e77#diff-aaa1596dd4db91f5cd7f743c8afbe58596daf01a2ecec4a0024768f7409fb1dc  
  > Thanks @hyson666 @quantotto

- **Issue #127** (2025-05-05): **[BUG]: Claude desktop is using POST /mcp request not GET**
  *Symptoms*: **Describe the bug**  app = FastAPI()  mcp = FastApiMCP(app) mcp.mount()  Claude configuration {   "mcpServers": {     "fastapi-mcp": {       "command": "npx",       "args": [         "mcp-remote",         "http://localhost:8000/mcp",         "8080"  // Optional port number. Necessary if you want your OAuth to work and you don't have dynamic client registration.       ]     }   } } 
  **Post-Mortem & Fix Analysis**:
  > I have the same issue
  > the suggestion in this issue thread fixed it for me  https://github.com/geelen/mcp-remote/issues/47
  > @a-s-g93 thanx by the way I had fixed the issue using mcp-proxy 

- **Issue #123** (2025-07-14): **[BUG] AuthConfig.default_scope is not correctly used？**
  *Symptoms*: **Describe the bug** While debugging the local fastmcp_api using [modelcontextprotocol/inspector](https://github.com/modelcontextprotocol/inspector), it was observed that:  When building the built-in authentication endpoint, the scope is first retrieved from the query parameters of the request.  If no scope is provided in the query, a default_scope is used instead.  However, this `default_scope` is not the `AuthConfig.default_scope`.  **To Reproduce** 1. Configure an `AuthConfig` with a `default_scope`:    ```python    auth_config = AuthConfig(default_scope="openid profile email")    ``` 2. Start the local `fastmcp_api` and debug using `modelcontextprotocol/inspector`. 3. Send a request **without** the `scope` parameter:    ```    GET /auth/authorize?client_id=xxx&response_type=code&redirect_uri=yyy    ``` 4. Observe that the returned result does **not** use the `default_scope` from `AuthConfig`.  **System Info** - OS: Ubuntu 24.04.x - Python: 3.12.x - FastMCP API version: local development (latest `main` branch) - Debugging tool: modelcontextprotocol/inspector
  **Post-Mortem & Fix Analysis**:
  > In [`fastapi_mcp/server.py#L262-L267`](https://github.com/tadata-org/fastapi_mcp/blob/main/fastapi_mcp/server.py#L262-L267),  it looks like we could set the `default_scope` parameter when calling `setup_oauth_authorize_proxy`, using `self._auth_config.default_scope`.  Current code: ```python setup_oauth_authorize_proxy(     app=self.fastapi,     client_id=self._auth_config.client_id,     authorize_url=self._auth_config.authorize_url,     audience=self._auth_config.audience, ) ```  Suggested adjustment: ```diff setup_oauth_authorize_proxy(     app=self.fastapi,     client_id=self._auth_config.client_id,     authorize_url=self._auth_config.authorize_url,     audience=self._auth_config.audience, +    default_scope=self._auth_config.default_scope, ) ```
  > Hey, when are we expecting to solve this issue? i've tested it and it works in my patch can i possibly make a PR for it?

- **Issue #107** (2025-04-23): **[BUG] Error after upgrading to 0.3.2: UnboundLocalError: local variable 'param_desc' referenced before assignment**
  *Symptoms*: # Issue: Error after upgrading from fastapi_mcp 0.2.0 to 0.3.2  **Description**   After upgrading `fastapi_mcp` from version 0.2.0 to 0.3.2, I encountered an error when starting the FastAPI application. The error message is as follows:  ``` 2025-04-23 09:22:01,889 - INFO - No auth config provided, skipping auth setup 2025-04-23 09:22:01,889 - INFO - MCP server listening at /mcp Traceback (most recent call last):   File "D:\path\to\your\project\test.py", line 2517, in <module>     mcp.setup_server()   File "D:\path\to\your\env\lib\site-packages\fastapi_mcp\server.py", line 161, in setup_server     all_tools, self.operation_map = convert_openapi_to_mcp_tools(   File "D:\path\to\your\env\lib\site-packages\fastapi_mcp\openapi\convert.py", line 243, in convert_openapi_to_mcp_tools     if param_desc: UnboundLocalError: local variable 'param_desc' referenced before assignment ```  **Code Example**   Here is the code snippet that triggers the issue (with sensitive information removed):  ```python from fastapi import FastAPI from fastapi.staticfiles import StaticFiles from fastapi_mcp import FastApiMCP import httpx import uvicorn  app = FastAPI(     title="Example FastAPI-MCP Server",     description="A simple example of a FastAPI application converted to an MCP server.",     version="1.0.0",     root_path="/example" )  custom_http_client = httpx.AsyncClient(     timeout=timeout_config,     headers=default_headers )  mcp = FastApiMCP(     app,     name="Example FastAPI-MCP Server",   
  **Post-Mortem & Fix Analysis**:
  > Closing as duplicate of #94 

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

### Incident Patch 1: `3bcfdd77` (2025-08-10)
**Commit Message**: fix position

**File**: `README.md` (modified, +4/-1)
```diff
@@ -8,6 +8,10 @@
   FastAPI-MCP
 </h1>
 
+<div align="center">
+<a href="https://trendshift.io/repositories/14064" target="_blank"><img src="https://trendshift.io/api/badge/repositories/14064" alt="tadata-org%2Ffastapi_mcp | Trendshift" style="width: 250px; height: 55px;" width="250" height="55"/></a>
+</div>
+
 <p align="center">Expose your FastAPI endpoints as Model Context Protocol (MCP) tools, with Auth!</p>
 <div align="center">
 
@@ -16,7 +20,6 @@
 [![FastAPI](https://img.shields.io/badge/FastAPI-009485.svg?logo=fastapi&logoColor=white)](#)
 [![CI](https://github.com/tadata-org/fastapi_mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/tadata-org/fastapi_mcp/actions/workflows/ci.yml)
 [![Coverage](https://codecov.io/gh/tadata-org/fastapi_mcp/branch/main/graph/badge.svg)](https://codecov.io/gh/tadata-org/fastapi_mcp)
-<a href="https://trendshift.io/repositories/14064" target="_blank"><img src="https://trendshift.io/api/badge/repositories/14064" alt="tadata-org%2Ffastapi_mcp | Trendshift" style="width: 250px; height: 55px;" width="250" height="55"/></a>
 
 </div>
 
```

---

### Incident Patch 2: `36ed9d86` (2025-07-28)
**Commit Message**: fix transport tests to match stateful http transport

**File**: `tests/test_http_real_transport.py` (modified, +94/-8)
```diff
@@ -190,13 +190,21 @@ async def test_http_list_tools(http_client: httpx.AsyncClient, server: str) -> N
     )
     assert init_response.status_code == 200
 
+    # Extract session ID from the initialize response
+    session_id = init_response.headers.get("mcp-session-id")
+    assert session_id is not None, "Server should return a session ID"
+
     initialized_response = await http_client.post(
         mcp_path,
         json={
             "jsonrpc": "2.0",
             "method": "notifications/initialized",
         },
-        headers={"Accept": "application/json, text/event-stream", "Content-Type": "application/json"},
+        headers={
+            "Accept": "application/json, text/event-stream",
+            "Content-Type": "application/json",
+            "mcp-session-id": session_id,
+        },
     )
     assert initialized_response.status_code == 202
 
@@ -207,7 +215,11 @@ async def test_http_list_tools(http_client: httpx.AsyncClient, server: str) -> N
             "method": "tools/list",
             "id": 2,
         },
-        headers={"Accept": "application/json, text/event-stream", "Content-Type": "application/json"},
+        headers={
+            "Accept": "application/json, text/event-stream",
+            "Content-Type": "application/json",
+            "mcp-session-id": session_id,
+        },
     )
 
     assert response.status_code == 200
@@ -245,13 +257,21 @@ async def test_http_call_tool(http_client: httpx.AsyncClient, server: str) -> No
     )
     assert init_response.status_code == 200
 
+    # Extract session ID from the initialize response
+    session_id = init_response.headers.get("mcp-session-id")
+    assert session_id is not None, "Server should return a session ID"
+
     initialized_response = await http_client.post(
         mcp_path,
         json={
             "jsonrpc": "2.0",
             "method": "notifications/initialized",
         },
-        headers={"Accept": "application/json, text/event-stream", "Content-Type": "application/json"},
+        headers={
+            "Accept": "application/json, text/event-stream",
+            "Content-Type": "application/json",
+            "mcp-session-id": session_id,
+        },
     )
     assert initialized_response.status_code == 202
 
@@ -266,7 +286,11 @@ async def test_http_call_tool(http_client: httpx.AsyncClient, server: str) -> No
                 "arguments": {"item_id": 1},
             },
         },
-        headers={"Accept": "application/json, text/event-stream", "Content-Type": "application/json"},
+        headers={
+            "Accept": "application/json, text/event-stream",
+            "Content-Type": "application/json",
+            "mcp-session-id": session_id,
+        },
     )
 
     assert response.status_code == 200
@@ -305,13 +329,21 @@ async def test_http_ping(http_client: httpx.AsyncClient, server: str) -> None:
     )
     assert init_response.status_code == 200
 
+    # Extract session ID from the initialize response
+    session_id = init_response.headers.get("mcp-session-id")
+    assert session_id is not None, "Server should return a session ID"
+
     initialized_response = await http_client.post(
         mcp_path,
         json={
             "jsonrpc": "2.0",
             "method": "notifications/initialized",
         },
-        headers={"Accept": "application/json, text/event-stream", "Content-Type": "application/json"},
+        headers={
+            "Accept": "application/json, text/event-stream",
+            "Content-Type": "application/json",
+            "mcp-session-id": session_id,
+        },
     )
     assert initialized_response.status_code == 202
 
@@ -322,7 +354,11 @@ async def test_http_ping(http_client: httpx.AsyncClient, server: str) -> None:
             "method": "ping",
             "id": 4,
         },
-        headers={"Accept": "application/json, text/event-stream", "Content-Type": "application/json"},
+        headers={
+            "Accept": "application/json, text/ev
```

---

### Incident Patch 3: `ab110bc5` (2025-07-28)
**Commit Message**: fix http transport to be stateful

**File**: `fastapi_mcp/transport/http.py` (modified, +87/-53)
```diff
@@ -1,74 +1,98 @@
 import logging
+import asyncio
 
 from fastapi import Request, Response, HTTPException
 from mcp.server.lowlevel.server import Server
-from mcp.server.streamable_http import StreamableHTTPServerTransport
+from mcp.server.streamable_http_manager import StreamableHTTPSessionManager, EventStore
 from mcp.server.transport_security import TransportSecuritySettings
 
 logger = logging.getLogger(__name__)
 
 
-class FastApiStreamableHttpTransport(StreamableHTTPServerTransport):
+class FastApiHttpSessionManager:
+    """
+    FastAPI-native wrapper around StreamableHTTPSessionManager
+    """
+
     def __init__(
         self,
-        mcp_session_id: str | None = None,
-        is_json_response_enabled: bool = True,  # Default to JSON for HTTP transport
-        event_store=None,
+        mcp_server: Server,
+        event_store: EventStore | None = None,
+        json_response: bool = True,  # Default to JSON for HTTP transport
         security_settings: TransportSecuritySettings | None = None,
-        mcp_server: Server | None = None,
     ):
-        super().__init__(
-            mcp_session_id=mcp_session_id,
-            is_json_response_enabled=is_json_response_enabled,
-            event_store=event_store,
-            security_settings=security_settings,
-        )
-        logger.debug(f"FastApiStreamableHttpTransport initialized with session_id: {mcp_session_id}")
-        self._mcp_server = mcp_server
-        self._server_running = False
-
-    async def handle_fastapi_request(self, request: Request, mcp_server: Server | None = None) -> Response:
+        self.mcp_server = mcp_server
+        self.event_store = event_store
+        self.json_response = json_response
+        self.security_settings = security_settings
+        self._session_manager: StreamableHTTPSessionManager | None = None
+        self._manager_task: asyncio.Task | None = None
+        self._manager_started = False
+        self._startup_lock = asyncio.Lock()
+
+    async def _ensure_session_manager_started(self) -> None:
         """
-        The approach here is different from FastApiSseTransport.
-        In FastApiSseTransport, we reimplement the SSE transport logic to have a more FastAPI-native transport.
-        It proved to be less bug-prone since it avoids deconstructing and reconstructing raw ASGI objects.
-
-        But, we took a different approach here because StreamableHTTPServerTransport handles more complexity,
-        and multiple request methods (GET/POST/DELETE), so we want to leverage that logic and avoid reimplementing.
+        Ensure the session manager is started.
 
-        We still ensure it works natively with FastAPI by capturing the ASGI response from the SDK and converting
-        it to a FastAPI Response.
+        This is called lazily on the first request to start the session manager
+        if it hasn't been started yet.
         """
-        logger.debug(f"Handling FastAPI request: {request.method} {request.url.path}")
-
-        # Use the stored server if available, or the passed one
-        server = self._mcp_server or mcp_server
-        if not server:
-            raise HTTPException(status_code=500, detail="No MCP server available")
-
-        # Initialize the transport if not already done
-        if not self._server_running:
-            import anyio
+        if self._manager_started:
+            return
+
+        async with self._startup_lock:
+            if self._manager_started:
+                return
+
+            logger.debug("Starting StreamableHTTP session manager")
+
+            # Create the session manager
+            # Note: We don't use stateless=True because we want to support sessions
+            # but sessions are optional as per the MCP spec
+            self._session_manager = StreamableHTTPSessionManager(
+                app=self.mcp_server,
+                event_store=self.event_store,
+                json_response=self.json_response,
+                statele
```

---

### Incident Patch 4: `0641baab` (2025-07-23)
**Commit Message**: fix test

**File**: `tests/test_sse_real_transport.py` (modified, +12/-6)
```diff
@@ -64,7 +64,7 @@ def periodic_save():
         name=SERVER_NAME,
         description="Test description",
     )
-    mcp.mount()
+    mcp.mount_sse()
 
     # Start the server
     server = uvicorn.Server(config=uvicorn.Config(app=fastapi_app, host=HOST, port=server_port, log_level="error"))
@@ -141,12 +141,18 @@ async def http_client(server: str) -> AsyncGenerator[httpx.AsyncClient, None]:
 
 
 @pytest.mark.anyio
-async def test_raw_sse_connection(http_client: httpx.AsyncClient) -> None:
+async def test_raw_sse_connection(http_client: httpx.AsyncClient, server: str) -> None:
     """Test the SSE connection establishment simply with an HTTP client."""
+    from urllib.parse import urlparse
+
+    parsed_url = urlparse(server)
+    root_path = parsed_url.path
+    messages_path = f"{root_path}/sse/messages/" if root_path else "/sse/messages/"
+
     async with anyio.create_task_group():
 
         async def connection_test() -> None:
-            async with http_client.stream("GET", "/mcp") as response:
+            async with http_client.stream("GET", "/sse") as response:
                 assert response.status_code == 200
                 assert response.headers["content-type"] == "text/event-stream; charset=utf-8"
 
@@ -155,7 +161,7 @@ async def connection_test() -> None:
                     if line_number == 0:
                         assert line == "event: endpoint"
                     elif line_number == 1:
-                        assert line.startswith("data: /mcp/messages/?session_id=")
+                        assert line.startswith(f"data: {messages_path}?session_id=")
                     else:
                         return
                     line_number += 1
@@ -167,7 +173,7 @@ async def connection_test() -> None:
 
 @pytest.mark.anyio
 async def test_sse_basic_connection(server: str) -> None:
-    async with sse_client(server + "/mcp") as streams:
+    async with sse_client(server + "/sse") as streams:
         async with ClientSession(*streams) as session:
             # Test initialization
             result = await session.initialize()
@@ -181,7 +187,7 @@ async def test_sse_basic_connection(server: str) -> None:
 
 @pytest.mark.anyio
 async def test_sse_tool_call(server: str) -> None:
-    async with sse_client(server + "/mcp") as streams:
+    async with sse_client(server + "/sse") as streams:
         async with ClientSession(*streams) as session:
             await session.initialize()
 
```

---

### Incident Patch 5: `d7110cfc` (2025-07-23)
**Commit Message**: fix http transport

**File**: `fastapi_mcp/server.py` (modified, +1/-1)
```diff
@@ -347,7 +347,7 @@ def mount_http(
 
         assert isinstance(router, (FastAPI, APIRouter)), f"Invalid router type: {type(router)}"
 
-        http_transport = FastApiStreamableHttpTransport()
+        http_transport = FastApiStreamableHttpTransport(mcp_server=self.server)
         dependencies = self._auth_config.dependencies if self._auth_config else None
 
         self._register_mcp_endpoints_http(router, http_transport, mount_path, dependencies)
```

**File**: `fastapi_mcp/transport/http.py` (modified, +32/-1)
```diff
@@ -1,6 +1,7 @@
 import logging
 
 from fastapi import Request, Response, HTTPException
+from mcp.server.lowlevel.server import Server
 from mcp.server.streamable_http import StreamableHTTPServerTransport
 from mcp.server.transport_security import TransportSecuritySettings
 
@@ -14,6 +15,7 @@ def __init__(
         is_json_response_enabled: bool = True,  # Default to JSON for HTTP transport
         event_store=None,
         security_settings: TransportSecuritySettings | None = None,
+        mcp_server: Server | None = None,
     ):
         super().__init__(
             mcp_session_id=mcp_session_id,
@@ -22,8 +24,10 @@ def __init__(
             security_settings=security_settings,
         )
         logger.debug(f"FastApiStreamableHttpTransport initialized with session_id: {mcp_session_id}")
+        self._mcp_server = mcp_server
+        self._server_running = False
 
-    async def handle_fastapi_request(self, request: Request) -> Response:
+    async def handle_fastapi_request(self, request: Request, mcp_server: Server | None = None) -> Response:
         """
         The approach here is different from FastApiSseTransport.
         In FastApiSseTransport, we reimplement the SSE transport logic to have a more FastAPI-native transport.
@@ -37,6 +41,33 @@ async def handle_fastapi_request(self, request: Request) -> Response:
         """
         logger.debug(f"Handling FastAPI request: {request.method} {request.url.path}")
 
+        # Use the stored server if available, or the passed one
+        server = self._mcp_server or mcp_server
+        if not server:
+            raise HTTPException(status_code=500, detail="No MCP server available")
+
+        # Initialize the transport if not already done
+        if not self._server_running:
+            import anyio
+
+            async def start_server():
+                self._server_running = True
+                async with self.connect() as (reader, writer):
+                    await server.run(
+                        reader,
+                        writer,
+                        server.create_initialization_options(notification_options=None, experimental_capabilities={}),
+                        raise_exceptions=False,
+                    )
+
+            # Start the server in a background task
+            import asyncio
+
+            asyncio.create_task(start_server())
+
+            # Give the server a moment to initialize
+            await anyio.sleep(0.1)
+
         # Capture the response from the SDK's handle_request method
         response_started = False
         response_status = 200
```

---

### Incident Patch 6: `3bdb6934` (2025-07-23)
**Commit Message**: add test for http context extraction, and fix input validation tests

**File**: `tests/test_mcp_complex_app.py` (modified, +2/-5)
```diff
@@ -214,8 +214,5 @@ async def test_error_handling_missing_parameter(lowlevel_server_complex_app: Ser
         assert len(response.content) > 0
 
         text_content = next(c for c in response.content if isinstance(c, types.TextContent))
-        assert (
-            "422" in text_content.text
-            or "parameter" in text_content.text.lower()
-            or "field" in text_content.text.lower()
-        )
+        assert "input validation error" in text_content.text.lower(), "Expected an input validation error"
+        assert "required" in text_content.text.lower(), "Expected a missing required parameter error"
```

**File**: `tests/test_mcp_simple_app.py` (modified, +74/-1)
```diff
@@ -112,7 +112,7 @@ async def test_error_handling(lowlevel_server_simple_app: Server):
 
         text_content = next(c for c in response.content if isinstance(c, types.TextContent))
         assert "item_id" in text_content.text.lower() or "missing" in text_content.text.lower()
-        assert "422" in text_content.text, "Expected a 422 status to appear in the response text"
+        assert "input validation error" in text_content.text.lower(), "Expected an input validation error"
 
 
 @pytest.mark.asyncio
@@ -368,3 +368,76 @@ async def test_custom_header_passthrough_to_tool_handler(fastapi_mcp_with_custom
             headers_arg = mock_request.call_args[0][4]  # headers are the 5th argument
             assert "X-Custom-Header" in headers_arg
             assert headers_arg["X-Custom-Header"] == "MyValue123"
+
+
+@pytest.mark.asyncio
+async def test_context_extraction_in_tool_handler(fastapi_mcp: FastApiMCP):
+    """Test that handle_call_tool extracts HTTP request info from MCP context."""
+    from unittest.mock import patch, MagicMock
+    import mcp.types as types
+    from mcp.server.lowlevel.server import request_ctx
+
+    # Create a fake HTTP request object with headers
+    fake_http_request = MagicMock()
+    fake_http_request.method = "POST"
+    fake_http_request.url.path = "/test"
+    fake_http_request.headers = {"Authorization": "Bearer token-123", "X-Custom": "custom-value-123"}
+    fake_http_request.cookies = {}
+    fake_http_request.query_params = {}
+
+    # Create a fake request context containing the HTTP request
+    fake_request_context = MagicMock()
+    fake_request_context.request = fake_http_request
+
+    # Test with authorization header extraction from context
+    token = request_ctx.set(fake_request_context)
+    try:
+        with patch.object(fastapi_mcp, "_execute_api_tool") as mock_execute:
+            mock_execute.return_value = [types.TextContent(type="text", text="success")]
+
+            # Create a CallToolRequest like the MCP protocol would
+            call_request = types.CallToolRequest(
+                method="tools/call", params=types.CallToolRequestParams(name="get_item", arguments={"item_id": 1})
+            )
+
+            try:
+                # Call the tool handler directly like the MCP server would
+                await fastapi_mcp.server.request_handlers[types.CallToolRequest](call_request)
+            except Exception:
+                pass
+
+            assert mock_execute.called, "The _execute_api_tool method was not called"
+
+            if mock_execute.called:
+                # Verify that HTTPRequestInfo was extracted from context and passed to _execute_api_tool
+                http_request_info = mock_execute.call_args.kwargs["http_request_info"]
+                assert http_request_info is not None, "HTTPRequestInfo should be extracted from context"
+                assert http_request_info.method == "POST"
+                assert http_request_info.path == "/test"
+                assert "Authorization" in http_request_info.headers
+                assert http_request_info.headers["Authorization"] == "Bearer token-123"
+                assert "X-Custom" in http_request_info.headers
+                assert http_request_info.headers["X-Custom"] == "custom-value-123"
+    finally:
+        # Clean up the context variable
+        request_ctx.reset(token)
+
+    # Test with missing request context (should still work but with None)
+    with patch.object(fastapi_mcp, "_execute_api_tool") as mock_execute:
+        mock_execute.return_value = [types.TextContent(type="text", text="success")]
+
+        call_request = types.CallToolRequest(
+            method="tools/call", params=types.CallToolRequestParams(name="get_item", arguments={"item_id": 1})
+        )
+
+        try:
+            await fastapi_mcp.server.request_handlers[types.CallToolRequest](call_request)
+        except Exception:
+            pass
+
+        assert mock_execute.called, "The _exec
```

---

### Incident Patch 7: `2e0aa905` (2025-07-14)
**Commit Message**: Merge pull request #185 from jessesanford/Issue-123-fix-authconfig-default_scope-usage

Fixes #123: allow usage of default_scope to be passed

**File**: `fastapi_mcp/auth/proxy.py` (modified, +2/-0)
```diff
@@ -199,8 +199,10 @@ async def oauth_authorize_proxy(
         if not scope:
             logger.warning("Client didn't provide any scopes! Using default scopes.")
             scope = default_scope
+            logger.debug(f"Default scope: {scope}")
 
         scopes = scope.split()
+        logger.debug(f"Scopes passed: {scopes}")
         for required_scope in default_scope.split():
             if required_scope not in scopes:
                 scopes.append(required_scope)
```

**File**: `fastapi_mcp/server.py` (modified, +1/-0)
```diff
@@ -275,6 +275,7 @@ def _setup_auth_2025_03_26(self):
                     client_id=self._auth_config.client_id,
                     authorize_url=self._auth_config.authorize_url,
                     audience=self._auth_config.audience,
+                    default_scope=self._auth_config.default_scope,
                 )
                 if self._auth_config.setup_fake_dynamic_registration:
                     assert self._auth_config.client_secret is not None
```

---

### Incident Patch 8: `dc8f452d` (2025-06-27)
**Commit Message**: Fixes #123: allow usage of default_scope to be passed

Signed-off-by: Jesse Sanford <108698+jessesanford@users.noreply.github.com>

**File**: `fastapi_mcp/auth/proxy.py` (modified, +2/-0)
```diff
@@ -199,8 +199,10 @@ async def oauth_authorize_proxy(
         if not scope:
             logger.warning("Client didn't provide any scopes! Using default scopes.")
             scope = default_scope
+            logger.debug(f"Default scope: {scope}")
 
         scopes = scope.split()
+        logger.debug(f"Scopes passed: {scopes}")
         for required_scope in default_scope.split():
             if required_scope not in scopes:
                 scopes.append(required_scope)
```

**File**: `fastapi_mcp/server.py` (modified, +1/-0)
```diff
@@ -264,6 +264,7 @@ def _setup_auth_2025_03_26(self):
                     client_id=self._auth_config.client_id,
                     authorize_url=self._auth_config.authorize_url,
                     audience=self._auth_config.audience,
+                    default_scope=self._auth_config.default_scope,
                 )
                 if self._auth_config.setup_fake_dynamic_registration:
                     assert self._auth_config.client_secret is not None
```

---

### Incident Patch 9: `1794ec90` (2025-06-24)
**Commit Message**: fix: ran ruff

**File**: `tests/test_mcp_simple_app.py` (modified, +3/-3)
```diff
@@ -21,6 +21,7 @@ def fastapi_mcp(simple_fastapi_app: FastAPI) -> FastApiMCP:
     mcp.mount()
     return mcp
 
+
 @pytest.fixture
 def fastapi_mcp_with_custom_header(simple_fastapi_app: FastAPI) -> FastApiMCP:
     mcp = FastApiMCP(
@@ -32,6 +33,7 @@ def fastapi_mcp_with_custom_header(simple_fastapi_app: FastAPI) -> FastApiMCP:
     mcp.mount()
     return mcp
 
+
 @pytest.fixture
 def lowlevel_server_simple_app(fastapi_mcp: FastApiMCP) -> Server:
     return fastapi_mcp.server
@@ -326,9 +328,7 @@ async def test_headers_passthrough_to_tool_handler(fastapi_mcp: FastApiMCP):
 
 
 @pytest.mark.asyncio
-async def test_custom_header_passthrough_to_tool_handler(
-    fastapi_mcp_with_custom_header: FastApiMCP
-):
+async def test_custom_header_passthrough_to_tool_handler(fastapi_mcp_with_custom_header: FastApiMCP):
     from unittest.mock import patch, MagicMock
     from fastapi_mcp.types import HTTPRequestInfo
 
```

---

### Incident Patch 10: `5f35711d` (2025-06-08)
**Commit Message**: Fix an issue with mounting using a FastAPI router with a root path

- Fix a bug where the mount path was not correctly appended to the root
  path of the FastAPI router
- Replace a raise statement with an assert, because the code is
  unreachable if the input attribute has correct type

**File**: `fastapi_mcp/server.py` (modified, +6/-9)
```diff
@@ -299,7 +299,9 @@ def mount(
             str,
             Doc(
                 """
-                Path where the MCP server will be mounted. Defaults to '/mcp'.
+                Path where the MCP server will be mounted.
+                Mount path is appended to the root path of FastAPI router, or to the prefix of APIRouter.
+                Defaults to '/mcp'.
                 """
             ),
         ] = "/mcp",
@@ -328,14 +330,9 @@ def mount(
             router = self.fastapi
 
         # Build the base path correctly for the SSE transport
-        if isinstance(router, FastAPI):
-            base_path = router.root_path
-        elif isinstance(router, APIRouter):
-            base_path = self.fastapi.root_path + router.prefix
-        else:
-            raise ValueError(f"Invalid router type: {type(router)}")
-
-        messages_path = f"{base_path}{mount_path}/messages/"
+        assert isinstance(router, (FastAPI, APIRouter)), f"Invalid router type: {type(router)}"
+        base_path = mount_path if isinstance(router, FastAPI) else router.prefix + mount_path
+        messages_path = f"{base_path}/messages/"
 
         sse_transport = FastApiSseTransport(messages_path)
 
```

#### Recent Merged Pull Requests:
- **PR #350** (closed): Warn loudly when MCP server is mounted without auth_config (@Al-win-Joby)
- **PR #346** (closed): chore: remove unused runtime dependencies (10 -> 4) (@K4bain)
- **PR #344** (closed): fix(openapi): support non-object request bodies and stop body data loss on parameter name collisions (@K4bain)
- **PR #343** (closed): fix(openapi): collapse nullable unions so Optional[List[X]] tools keep valid schemas (@K4bain)
- **PR #342** (closed): feat: support mcp 2.x alongside mcp 1.x (@K4bain)
- **PR #341** (closed): fix(server): respect include_router prefix when mounting MCP endpoints (adopted from #329, fixes #204) (@K4bain)
- **PR #340** (closed): fix(http): wait for session manager readiness before handling requests (adopted from #315) (@K4bain)
- **PR #339** (closed): feat(http): trigger lifespan events when using mount_http() (adopted from #311, closes #256) (@K4bain)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

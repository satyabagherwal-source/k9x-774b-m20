# Forensic Learning Record (Deep Inspection): volcengine/MineContext

> **Canonical Artifact**: `07_PROJECT_LEARNING/volcengine-minecontext-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/volcengine/MineContext](https://github.com/volcengine/MineContext))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:15:58.006Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `volcengine/MineContext`
- **Description**: MineContext is your proactive context-aware AI partner（Context-Engineering+ChatGPT Pulse）
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: package.json, pyproject.toml, README.md
- **Stars / Engagement**: 5533 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `examples/example_document_processor.py`
```
#!/usr/bin/env python
# -*- coding: utf-8 -*-

# Copyright (c) 2025 Beijing Volcano Engine Technology Co., Ltd.
# SPDX-License-Identifier: Apache-2.0

"""
Example 2: Document Processor - Process various document formats
This example demonstrates how to use the DocumentProcessor to process different document formats
including PDF, DOCX, XLSX, CSV, Markdown, images, and text content without storing them in the database.

Supported formats:
- Visual documents: PDF, DOCX, DOC, PPTX, PPT, PNG, JPG, JPEG, GIF, BMP, WEBP, MD (Markdown)
- Structured documents: XLSX, XLS, CSV, JSONL
- Text files: TXT, MD (Markdown with images)

Usage:
    # Scan a directory for documents
    python example_document_processor.py /path/to/documents/

    # Process specific files
    python example_document_processor.py /path/to/file1.pdf /path/to/file2.docx /path/to/file3.md

    # Process with limit
    python example_document_processor.py /path/to/documents/ 5
"""

import json
import os
import sys
from datetime import datetime
from pathlib import Path

# Add parent directory to path to import opencontext modules
sys.path.insert(0, str(Path(__file__).parent.parent))

from opencontext.context_processing.processor.document_processor import DocumentProcessor
from opencontext.models.context import ContentFormat, ContextSource, RawContextProperties
from opencontext.utils.logging_utils import get_logger, setup_logging

# Initialize logging first
setup_logging({"level": "INFO", "log_path": None})  # Only console output for this example

logger = get_logger(__name__)

# Supported document extensions
DOCUMENT_EXTENSIONS = {
    ".pdf", ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp",
    ".docx", ".doc", ".pptx", ".ppt",
    ".xlsx", ".xls", ".csv", ".jsonl",
    ".md", ".txt"
}


def scan_directory_for_documents(directory_path: str, limit: int = None) -> list[str]:
    """
    Scan a directory for document files.

    Args:
        directory_path: Path to the directory to scan
        limit: Maximum number of documents to return (None for all)

    Returns:
        List of document file paths
    """
    document_paths = []

    try:
        directory = Path(directory_path)
        if not directory.exists():
            print(f"Error: Directory does not exist: {directory_path}")
            return []

        if not directory.is_dir():
            print(f"Error: Not a directory: {directory_path}")
            return []

        # Scan for document files
        for file_path in sorted(directory.iterdir()):
            if file_path.is_file() and file_path.suffix.lower() in DOCUMENT_EXTENSIONS:
                document_paths.append(str(file_path))
                if limit and len(document_paths) >= limit:
                    break

        print(f"Found {len(document_paths)} documents")

    except Exception as e:
        print(f"Error scanning directory: {e}")

    return document_paths


def process_documents_example(document_paths: list[str]):
    """
    Process documents and extract content without storing in database.

    Args:
        document_paths: List of paths to document files
    """
    print("=" * 80)
    print("Document Processor - Process Various Document Formats")
    print("=" * 80)

    # Validate document paths
    valid_paths = []
    for path in document_paths:
        if os.path.exists(path):
            valid_paths.append(path)
        else:
            print(f"Warning: File not found: {path}")

    if len(valid_paths) == 0:
        print("\nNo valid document files found.")
        return

    print(f"\nProcessing {len(valid_paths)} documents...\n")

    # Initialize the document processor
    processor = DocumentProcessor()

    # Process each document
    processed_count = 0
    for i, document_path in enumerate(valid_paths, 1):
        print(f"\n[{i}/{len(valid_paths)}] Processing: {document_path}")
        print("-" * 80)

        # Determine content format based on file extension
        file_ext = Path(document_path).suffix.lower()
        if file_ext in {".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp"}:
            content_format = ContentFormat.IMAGE
        elif file_ext in {".pdf", ".docx", ".doc", ".pptx", ".ppt"}:
            content_format = ContentFormat.FILE
        elif file_ext in {".xlsx", ".xls", ".csv", ".jsonl"}:
            content_format = ContentFormat.FILE
        else:
            content_format = ContentFormat.FILE

        # Create RawContextProperties for the document
        raw_context = RawContextProperties(
            source=ContextSource.LOCAL_FILE,
            content_path=document_path,
            content_format=content_format,
            create_time=datetime.now(),
            content_text="",
        )

        # Check if processor can handle this file
        if not processor.can_process(raw_context):
            print(f"Error: Processor cannot handle this file type: {file_ext}")
            continue

        # Process the document (adds to queue)
        try:
            contexts = processor.real_process(raw_context)
            if contexts:
                print(f"Successfully queued document: {Path(document_path).name}")
                processed_count += 1
                chunk_result = []
                for context in contexts:
                    chunk_result.append(context.extracted_data.summary)
                    print('----------------chunk-------------\n')
                    print(f"{context.extracted_data.summary}")

                # Dump chunk_result to JSON file
                output_filename = f"{Path(document_path).stem}_chunks.json"
                output_path = Path(document_path).parent / output_filename
                with open(output_path, 'w', encoding='utf-8') as f:
                    json.dump(chunk_result, f, ensure_ascii=False, indent=2)
                print(f"\nChunk results saved to: {output_path}")

            else:
                print(f"Failed to queue document: {Path(document_path).name}")

        except Exception as e:
            print(f"Error processing document: {e}")
            import traceback
            traceback.print_exc()

    print("\n" + "=" * 80)
    print(f"Processing Summary")
    print("=" * 80)
    print(f"Total documents queued: {processed_count}/{len(valid_paths)}")
    print("\nNote: Documents are being processed in the background.")
    print("Check the storage for processed contexts after processing completes.")
    print("The processor uses async processing, so results will appear shortly.")

    # Give some time for processing to complete
    # Shutdown processor
    print("\nShutting down processor...")
    processor.shutdown(_graceful=True)
    print("Done!")



def main():
    """Main entry point for the example."""
    document_paths = []

    if len(sys.argv) > 1:
        input_path = sys.argv[1]

        # Check if it's a directory or file
        if os.path.isdir(input_path):
            # Scan directory for documents
            limit = int(sys.argv[2]) if len(sys.argv) > 2 else None
            document_paths = scan_directory_for_documents(input_path, limit=limit)
        else:
            # Treat as individual file paths
            document_paths = sys.argv[1:]
    else:
        print("Usage:")
        print("  # Process documents from a directory")
        print("  python example_document_processor.py /path/to/documents/")
        print("")
        print("  # Process documents from a directory with limit")
        print("  python example_document_processor.py /path/to/documents/ 5")
        print("")
        print("  # Process specific files")
        print("  python example_document_processor.py file1.pdf file2.docx file3.md")
        print("")
        print("Supported formats:")
        print("  - Visual: PDF, DOCX, DOC, PPTX, PPT, PNG, JPG, JPEG, GIF, BMP, WEBP")
        print("  - Structured: XLSX, XLS, CSV, JSONL")
        print("  - Text: TXT, MD (Markdown)")
        return

    if not document_paths:
        print("No valid docum
```

### Core Architecture Module: `examples/example_screenshot_processor.py`
```
#!/usr/bin/env python
# -*- coding: utf-8 -*-

# Copyright (c) 2025 Beijing Volcano Engine Technology Co., Ltd.
# SPDX-License-Identifier: Apache-2.0

"""
Example 1: Screenshot Processor - Extract content from screenshots
This example demonstrates how to use the ScreenshotProcessor to extract content from screenshots
without storing them in the database.

Usage:
    # Scan a directory for screenshots
    python example_screenshot_processor.py /path/to/screenshots/

    # Process specific files
    python example_screenshot_processor.py /path/to/img1.png /path/to/img2.png
"""

import asyncio
import os
import sys
from datetime import datetime
from pathlib import Path

# Add parent directory to path to import opencontext modules
sys.path.insert(0, str(Path(__file__).parent.parent))

from opencontext.context_processing.processor.screenshot_processor import ScreenshotProcessor
from opencontext.models.context import ContentFormat, ContextSource, RawContextProperties
from opencontext.utils.logging_utils import get_logger, setup_logging

# Initialize logging first
setup_logging({"level": "INFO", "log_path": None})  # Only console output for this example

logger = get_logger(__name__)

# Supported image extensions
IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp"}


def scan_directory_for_screenshots(directory_path: str, limit: int = None) -> list[str]:
    """
    Scan a directory for screenshot/image files.

    Args:
        directory_path: Path to the directory to scan
        limit: Maximum number of screenshots to return (None for all)

    Returns:
        List of screenshot file paths
    """
    screenshot_paths = []

    try:
        directory = Path(directory_path)
        if not directory.exists():
            print(f"Error: Directory does not exist: {directory_path}")
            return []

        if not directory.is_dir():
            print(f"Error: Not a directory: {directory_path}")
            return []

        # Scan for image files
        for file_path in sorted(directory.iterdir()):
            if file_path.is_file() and file_path.suffix.lower() in IMAGE_EXTENSIONS:
                screenshot_paths.append(str(file_path))
                if limit and len(screenshot_paths) >= limit:
                    break

        print(f"Found {len(screenshot_paths)} images")

    except Exception as e:
        print(f"Error scanning directory: {e}")

    return screenshot_paths


async def process_screenshots_example(screenshot_paths: list[str]):
    """
    Process screenshots and extract content without storing in database.

    Args:
        screenshot_paths: List of paths to screenshot files
    """
    print("=" * 80)
    print("Screenshot Processor - Extract Content from Screenshots")
    print("=" * 80)

    # Validate screenshot paths
    valid_paths = []
    for path in screenshot_paths:
        if os.path.exists(path):
            valid_paths.append(path)
        else:
            print(f"Warning: File not found: {path}")

    if len(valid_paths) == 0:
        print("\nNo valid screenshot files found.")
        return

    print(f"\nProcessing {len(valid_paths)} screenshots...\n")

    # Initialize the screenshot processor
    processor = ScreenshotProcessor()

    # Create RawContextProperties for each screenshot
    raw_contexts = []
    for i, screenshot_path in enumerate(valid_paths, 1):
        raw_context = RawContextProperties(
            source=ContextSource.SCREENSHOT,
            content_path=screenshot_path,
            content_format=ContentFormat.IMAGE,
            create_time=datetime.now(),
            content_text="",
        )
        raw_contexts.append(raw_context)

    # Process screenshots in batch (this will call the Vision LLM)
    try:
        processed_contexts = await processor.batch_process(raw_contexts)

        print("=" * 80)
        print("Extraction Results")
        print("=" * 80)

        # The processor stores results in _processed_cache
        for processed_context in processed_contexts:
            print(f"Title: {processed_context.extracted_data.title}")
            print(f"Summary: {processed_context.extracted_data.summary}")
            print(f"Keywords: {', '.join(processed_context.extracted_data.keywords)}")
            print(f"Type: {processed_context.extracted_data.context_type}")
            print(f"Importance: {processed_context.extracted_data.importance}/10")
            print(f"Confidence: {processed_context.extracted_data.confidence}/10")

            if processed_context.extracted_data.entities:
                print(f"Entities: {processed_context.extracted_data.entities}")

            print(f"Event Time: {processed_context.properties.event_time}")
            print("-" * 80)

    except Exception as e:
        print(f"\nError: {e}")
        import traceback
        traceback.print_exc()


def main():
    """Main entry point for the example."""
    screenshot_paths = []

    if len(sys.argv) > 1:
        input_path = sys.argv[1]

        # Check if it's a directory or file
        if os.path.isdir(input_path):
            # Scan directory for screenshots
            limit = int(sys.argv[2]) if len(sys.argv) > 2 else None
            screenshot_paths = scan_directory_for_screenshots(input_path, limit=limit)
        else:
            # Treat as individual file paths
            screenshot_paths = sys.argv[1:]
    else:
        print("Usage:")
        print("  python example_screenshot_processor.py /path/to/screenshots/")
        print("  python example_screenshot_processor.py /path/to/screenshots/ 5")
        print("  python example_screenshot_processor.py img1.png img2.png img3.png")
        return

    if not screenshot_paths:
        print("No valid screenshot files found.")
        return

    # Run the async function
    asyncio.run(process_screenshots_example(screenshot_paths))


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `examples/example_screenshot_to_insights.py`
```
#!/usr/bin/env python
# -*- coding: utf-8 -*-

# Copyright (c) 2025 Beijing Volcano Engine Technology Co., Ltd.
# SPDX-License-Identifier: Apache-2.0

"""
Example: Screenshot to Insights Pipeline
This example demonstrates how to process screenshots and generate comprehensive insights
including activities, todos, tips, and reports - all without writing to the database.

Usage:
    # Process screenshots from a directory
    python example_screenshot_to_insights.py /path/to/screenshots/

    # Process specific files
    python example_screenshot_to_insights.py /path/to/img1.png /path/to/img2.png
"""

import asyncio
import datetime
import json
import os
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

# Add parent directory to path to import opencontext modules
sys.path.insert(0, str(Path(__file__).parent.parent))

from opencontext.config.global_config import get_prompt_group
from opencontext.context_processing.processor.screenshot_processor import ScreenshotProcessor
from opencontext.llm.global_vlm_client import generate_with_messages, generate_with_messages_async
from opencontext.models.context import (
    ContentFormat,
    ContextSource,
    ProcessedContext,
    RawContextProperties,
)
from opencontext.utils.json_parser import parse_json_from_response
from opencontext.utils.logging_utils import get_logger, setup_logging

# Initialize logging
setup_logging({"level": "INFO", "log_path": None})
logger = get_logger(__name__)

# Supported image extensions
IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp"}


def scan_directory_for_screenshots(directory_path: str, limit: int = None) -> List[str]:
    """
    Scan a directory for screenshot/image files.

    Args:
        directory_path: Path to the directory to scan
        limit: Maximum number of screenshots to return (None for all)

    Returns:
        List of screenshot file paths
    """
    screenshot_paths = []

    try:
        directory = Path(directory_path)
        if not directory.exists():
            print(f"Error: Directory does not exist: {directory_path}")
            return []

        if not directory.is_dir():
            print(f"Error: Not a directory: {directory_path}")
            return []

        # Scan for image files
        for file_path in sorted(directory.iterdir()):
            if file_path.is_file() and file_path.suffix.lower() in IMAGE_EXTENSIONS:
                screenshot_paths.append(str(file_path))
                if limit and len(screenshot_paths) >= limit:
                    break

        print(f"Found {len(screenshot_paths)} images")

    except Exception as e:
        print(f"Error scanning directory: {e}")

    return screenshot_paths


async def process_screenshots(screenshot_paths: List[str]) -> List[ProcessedContext]:
    """
    Process screenshots and extract content.

    Args:
        screenshot_paths: List of paths to screenshot files

    Returns:
        List of ProcessedContext objects
    """
    print("\n" + "=" * 80)
    print("STEP 1: Processing Screenshots")
    print("=" * 80)

    # Initialize the screenshot processor
    processor = ScreenshotProcessor()

    # Create RawContextProperties for each screenshot
    raw_contexts = []
    for screenshot_path in screenshot_paths:
        raw_context = RawContextProperties(
            source=ContextSource.SCREENSHOT,
            content_path=screenshot_path,
            content_format=ContentFormat.IMAGE,
            create_time=datetime.datetime.now(),
            content_text="",
        )
        raw_contexts.append(raw_context)

    print(f"Processing {len(raw_contexts)} screenshots...\n")

    # Process screenshots (this calls VLM internally)
    try:
        processed_contexts = await processor.batch_process(raw_contexts)
        processor.shutdown(graceful=True)

        print(f"\nSuccessfully processed {len(processed_contexts)} contexts\n")
        print("=" * 80)
        print("Extraction Results")
        print("=" * 80)

        # The processor stores results in _processed_cache
        for processed_context in processed_contexts:
            print(f"Title: {processed_context.extracted_data.title}")
            print(f"Summary: {processed_context.extracted_data.summary}")
            print(f"Keywords: {', '.join(processed_context.extracted_data.keywords)}")
            print(f"Type: {processed_context.extracted_data.context_type}")
            print(f"Importance: {processed_context.extracted_data.importance}/10")
            print(f"Confidence: {processed_context.extracted_data.confidence}/10")

            if processed_context.extracted_data.entities:
                print(f"Entities: {processed_context.extracted_data.entities}")

            print(f"Event Time: {processed_context.properties.event_time}")
            print("-" * 80)
        return processed_contexts

    except Exception as e:
        print(f"Error processing screenshots: {e}")
        import traceback

        traceback.print_exc()
        processor.shutdown(graceful=True)
        return []


async def generate_activity(
    processed_contexts: List[ProcessedContext], start_time: int, end_time: int
) -> Optional[Dict[str, Any]]:
    """
    Generate activity summary from processed contexts (without database writes).

    Args:
        processed_contexts: List of processed contexts
        start_time: Start timestamp
        end_time: End timestamp

    Returns:
        Activity summary dictionary
    """
    print("\n" + "=" * 80)
    print("STEP 2: Generating Activity Summary")
    print("=" * 80)

    if not processed_contexts:
        print("No contexts to generate activity from")
        return None

    try:
        # Get prompt template
        prompt_group = get_prompt_group("generation.realtime_activity_monitor")
        system_prompt = prompt_group["system"]
        user_prompt_template = prompt_group["user"]

        # Prepare context data grouped by type
        context_data = {}
        for context in processed_contexts:
            context_type = context.extracted_data.context_type.value
            if context_type not in context_data:
                context_data[context_type] = []
            context_data[context_type].append(context.get_llm_context_string())

        # Format time information
        start_time_str = datetime.datetime.fromtimestamp(start_time).strftime("%H:%M")
        end_time_str = datetime.datetime.fromtimestamp(end_time).strftime("%H:%M")
        current_time = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        # Build user prompt
        user_prompt = user_prompt_template.format(
            current_time=current_time,
            start_time_str=start_time_str,
            end_time_str=end_time_str,
            context_data=json.dumps(context_data, ensure_ascii=False, indent=2),
        )

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]

        print("Calling LLM to generate activity summary...")
        response = generate_with_messages(messages)

        # Parse response
        activity_result = parse_json_from_response(response)

        # Normalize category distribution
        category_dist = activity_result.get("category_distribution", {})
        if category_dist:
            total = sum(category_dist.values())
            if total > 0:
                category_dist = {k: round(v / total, 2) for k, v in category_dist.items()}

        activity = {
            "title": activity_result.get("title", "Recent Activities"),
            "description": activity_result.get(
                "description", "Detected various user activities."
            ),
            "category_distribution": category_dist,
            "extracted_insights": activity_result.get(
                "extracted_insights",
                {
                    "potential_todos": [],
                    "tip_suggestions": [],
                    "key_
```

### Core Architecture Module: `examples/example_todo_deduplication.py`
```
#!/usr/bin/env python
# -*- coding: utf-8 -*-

# Copyright (c) 2025 Beijing Volcano Engine Technology Co., Ltd.
# SPDX-License-Identifier: Apache-2.0

"""
Example: TODO Deduplication with Vector Search
This example demonstrates how the SmartTodoManager uses vector similarity to deduplicate todos.
It shows both historical deduplication (against stored todos) and batch deduplication (within new todos).

Features demonstrated:
- Vector-based similarity detection
- Historical todo deduplication (stored in database)
- Batch todo deduplication (within the same submission)
- Customizable similarity threshold

Usage:
    # Run with default similarity threshold (0.85)
    python example_todo_deduplication.py

    # Run with custom similarity threshold
    python example_todo_deduplication.py 0.90
"""

import sys
from pathlib import Path
from typing import Dict, List

# Add parent directory to path to import opencontext modules
sys.path.insert(0, str(Path(__file__).parent.parent))

from opencontext.context_consumption.generation.smart_todo_manager import SmartTodoManager
from opencontext.storage.global_storage import get_storage
from opencontext.utils.logging_utils import get_logger, setup_logging

# Initialize logging first
setup_logging({"level": "INFO", "log_path": None})  # Only console output for this example

logger = get_logger(__name__)


def create_sample_todos() -> List[Dict]:
    """
    Create sample todo items for testing deduplication.

    Returns:
        List of sample todo dictionaries with various similarity patterns
    """
    return [
        {
            "title": "实现用户认证功能",
            "description": "添加用户登录和注册功能，使用 JWT 令牌进行身份验证",
            "priority": "高优先级",
            "status": "待处理",
        },
        {
            "title": "用户认证模块开发",
            "description": "开发用户登录注册系统，采用 JWT 认证方式",
            "priority": "高优先级",
            "status": "待处理",
        },
        {
            "title": "修复支付模块的bug",
            "description": "解决超过1000元的支付失败问题",
            "priority": "高优先级",
            "status": "待处理",
        },
        {
            "title": "更新项目文档",
            "description": "为新增的 API 接口编写文档说明",
            "priority": "中优先级",
            "status": "待处理",
        },
        {
            "title": "支付功能bug修复",
            "description": "修复大额交易（超过1000元）时支付处理失败的错误",
            "priority": "高优先级",
            "status": "待处理",
        },
        {
            "title": "搭建CI/CD流水线",
            "description": "配置 GitHub Actions 实现自动化测试和部署",
            "priority": "中优先级",
            "status": "待处理",
        },
        {
            "title": "编写单元测试",
            "description": "为认证模块添加全面的单元测试覆盖",
            "priority": "中优先级",
            "status": "待处理",
        },
        {
            "title": "认证功能测试",
            "description": "创建单元测试以覆盖用户认证相关功能",
            "priority": "中优先级",
            "status": "待处理",
        },
    ]


def run_deduplication_example(similarity_threshold: float = 0.85):
    """
    Demonstrate TODO deduplication with vector search.

    Args:
        similarity_threshold: Minimum similarity score (0-1) to consider todos as duplicates
    """
    print("=" * 80)
    print("TODO Deduplication with Vector Search Example")
    print("=" * 80)
    print(f"\nSimilarity Threshold: {similarity_threshold}")
    print("(Higher threshold = stricter matching, fewer duplicates detected)\n")

    # Initialize the SmartTodoManager
    todo_manager = SmartTodoManager()

    # Create sample todos
    sample_todos = create_sample_todos()

    print(f"Original TODO List ({len(sample_todos)} items):")
    print("-" * 80)
    for i, todo in enumerate(sample_todos, 1):
        print(f"\n[{i}] {todo['title']}")
        print(f"    Description: {todo['description']}")
        print(f"    Priority: {todo['priority']}")

    print("\n" + "=" * 80)
    print("Running Vector-Based Deduplication...")
    print("=" * 80)

    # Run deduplication
    try:
        deduplicated_todos = todo_manager._deduplicate_with_vector_search(
            sample_todos, similarity_threshold=similarity_threshold
        )

        todo_ids = []
        for task in deduplicated_todos:
            content = task["title"] + " " + task["description"]
            urgency = task.get("priority", "medium")
            deadline = task.get("deadline")
            participants_str = ", ".join(task.get("assignees", []))
            reason = task.get("reason", "")

            todo_id = get_storage().insert_todo(
                content=content,
                urgency=urgency,
                end_time=deadline,
                assignee=participants_str,
                reason=reason,
            )
            todo_ids.append(todo_id)

            # Store todo embedding to vector database for future deduplication
            if task.get("_embedding"):
                try:
                    get_storage().upsert_todo_embedding(
                        todo_id=todo_id,
                        content=content,
                        embedding=task["_embedding"],
                        metadata={
                            "urgency": urgency,
                            "priority": task.get("priority", "medium"),
                        },
                    )
                    logger.debug(f"Stored embedding for todo {todo_id}")
                except Exception as e:
                    logger.warning(f"Failed to store todo embedding for {todo_id}: {e}")

        print(f"\n✅ Deduplication Complete!")
        print("-" * 80)
        print(f"Original todos: {len(sample_todos)}")
        print(f"Duplicates filtered: {len(sample_todos) - len(deduplicated_todos)}")
        print(f"Unique todos remaining: {len(deduplicated_todos)}")

        if deduplicated_todos:
            print(f"\n{'=' * 80}")
            print(f"Final Unique TODO List ({len(deduplicated_todos)} items):")
            print("=" * 80)
            for i, todo in enumerate(deduplicated_todos, 1):
                print(f"\n[{i}] {todo['title']}")
                print(f"    Description: {todo['description']}")
                print(f"    Priority: {todo['priority']}")
                print(f"    Status: {todo['status']}")

        print("\n" + "=" * 80)
        print("Deduplication Analysis")
        print("=" * 80)
        print("The deduplication process works in two stages:")
        print("1. Historical deduplication: Compares with existing todos in database")
        print("2. Batch deduplication: Compares new todos with each other")
        print("\nExpected duplicates in this example:")
        print("- 'Implement user authentication' ≈ 'User auth implementation'")
        print("- 'Fix bug in payment module' ≈ 'Payment bug fix'")
        print("- 'Write unit tests' ≈ 'Authentication testing'")
        print("\nNote: The actual number of detected duplicates depends on:")
        print("- Similarity threshold setting")
        print("- Embedding model's understanding of semantic similarity")
        print("- Presence of similar todos in historical database")

    except Exception as e:
        print(f"\n❌ Error during deduplication: {e}")
        import traceback

        traceback.print_exc()
        return

    print("\n" + "=" * 80)
    print("Performance Note")
    print("=" * 80)
    print("The optimized deduplication algorithm:")
    print("- Caches embeddings to avoid redundant vectorization")
    print("- Time complexity: O(N) vectorizations for N todos")
    print("- Previously: O(N²) vectorizations (now fixed!)")
    print("\nFor large batches, this optimization significantly reduces:")
    print("- API calls to embedding services")
    print("- Processing time")
    print("- Resource usage")


def main():
    """Main entry point for the example."""
    similarity_threshold = 0.85  # Default threshold

    if len(sys.argv) > 1:
        try:
            similarity_threshold = float(sys.argv[1])
            if not (0.0 <= similarity_threshold <= 1.0):
                pri
```

### Core Architecture Module: `examples/example_weblink_processor.py`
```
import argparse
import logging
import sys
from pathlib import Path

# Add project root to sys.path to allow sibling imports
project_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(project_root))

from opencontext.context_capture.web_link_capture import WebLinkCapture
from opencontext.context_processing.processor.document_processor import DocumentProcessor
from opencontext.utils.logging_utils import setup_logging


def main(url: str, mode: str):
    """
    Initializes components, captures a web link, and processes the result.
    """
    setup_logging({"level": "INFO"})
    logger = logging.getLogger(__name__)

    # 1. Initialize components
    logger.info(f"Initializing WebLinkCapture (mode: {mode}) and DocumentProcessor...")
    web_link_capturer = WebLinkCapture()
    document_processor = DocumentProcessor()

    # Initialize with configuration for the selected mode
    capture_config = {"mode": mode}
    web_link_capturer.initialize(capture_config)
    document_processor.initialize({})

    # Start the capturer component (part of the component lifecycle)
    web_link_capturer.start()

    logger.info(f"Submitting URL for capture: {url}")

    # 2. Capture the URL by passing it as a list to the capture method
    raw_contexts = web_link_capturer.capture(urls=[url])

    if not raw_contexts:
        logger.error("Failed to capture any context from the URL.")
        web_link_capturer.stop()
        return

    logger.info(f"Successfully captured {len(raw_contexts)} raw context(s) as {mode.upper()}.")

    # 3. Process the captured file context
    for raw_context in raw_contexts:
        # Check if the document processor can handle this type of context
        if document_processor.can_process(raw_context):
            logger.info(f"Processing content from: {raw_context.content_path}")
            processed_contexts = document_processor.real_process(raw_context)

            if processed_contexts:
                for p_ctx in processed_contexts:
                    # Print out some of the extracted data
                    logger.info("=" * 20 + " Processed Context " + "=" * 20)
                    extracted_data = p_ctx.extracted_data
                    logger.info(f"Title: {extracted_data.title}")
                    logger.info(f"Summary: {extracted_data.summary}")
                    logger.info(f"Keywords: {extracted_data.keywords}")
                    logger.info(f"Doc ID: {p_ctx.id}")
                    logger.info("=" * 58)
            else:
                logger.warning("Document processor did not return any processed context.")
        else:
            logger.warning(
                f"Document processor cannot process this context source: {raw_context.source}"
            )

    # Stop the component
    web_link_capturer.stop()
    logger.info("Processing finished.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Example of capturing and processing a single web link."
    )
    parser.add_argument(
        "url", type=str, help="The URL to capture and process.", default="https://www.doubao.com"
    )
    parser.add_argument(
        "--mode",
        type=str,
        default="markdown",
        choices=["pdf", "markdown"],
        help="The capture mode ('pdf' or 'markdown').",
    )
    # args={}
    # args['url'] = 'https://www.doubao.com'
    # args['mode'] = 'markdown'

    main("https://zhuanlan.zhihu.com/p/1972449094321550376", "markdown")

```

### Core Architecture Module: `examples/regenerate_debug_file.py`
```
#!/usr/bin/env python
# -*- coding: utf-8 -*-

# Copyright (c) 2025 Beijing Volcano Engine Technology Co., Ltd.
# SPDX-License-Identifier: Apache-2.0

"""
Test script to regenerate content from a debug file and compare outputs.

Usage:
    python regenerate_debug_file.py --debug-file <path_to_debug_json>
    python regenerate_debug_file.py --debug-file debug/generation/activity/2025-10-20_18-01-26.json
"""

import argparse
import asyncio
import json
import os
import sys
from pathlib import Path
from typing import Any, Dict, List

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from opencontext.llm.global_vlm_client import generate_with_messages_async
from opencontext.utils.logging_utils import get_logger

logger = get_logger(__name__)


def load_debug_file(filepath: str) -> Dict[str, Any]:
    """
    Load debug file and extract messages and original response.

    Args:
        filepath: Path to the debug JSON file

    Returns:
        Dict containing messages, original response, and metadata
    """
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)

        return {
            "messages": data.get("messages", []),
            "original_response": data.get("response", ""),
            "task_type": data.get("task_type", "unknown"),
            "timestamp": data.get("timestamp", "unknown"),
            "metadata": data.get("metadata", {}),
        }
    except FileNotFoundError:
        logger.error(f"Debug file not found: {filepath}")
        raise
    except json.JSONDecodeError as e:
        logger.error(f"Invalid JSON format in debug file: {e}")
        raise
    except Exception as e:
        logger.error(f"Error loading debug file: {e}")
        raise


async def regenerate_content(messages: List[Dict[str, Any]]) -> str:
    """
    Regenerate content using LLM with the same messages.

    Args:
        messages: List of messages to send to LLM

    Returns:
        str: Generated response
    """
    try:
        logger.info("Starting content regeneration...")

        # Use the same parameters as in the original generation
        response = await generate_with_messages_async(
            messages=messages, enable_executor=False
        )

        logger.info("Content regeneration completed")
        return response

    except Exception as e:
        logger.error(f"Error during content regeneration: {e}")
        raise


def print_comparison(original: str, regenerated: str, task_type: str, metadata: Dict):
    """
    Print a formatted comparison of original and regenerated content.

    Args:
        original: Original response from debug file
        regenerated: Newly regenerated response
        task_type: Type of generation task
        metadata: Additional metadata from debug file
    """
    print("\n" + "=" * 80)
    print(f"TASK TYPE: {task_type}")
    print(f"METADATA: {json.dumps(metadata, ensure_ascii=False, indent=2)}")
    print("=" * 80)

    print("\n" + "-" * 80)
    print("ORIGINAL RESPONSE:")
    print("-" * 80)
    print(original)

    print("\n" + "-" * 80)
    print("REGENERATED RESPONSE:")
    print("-" * 80)
    print(regenerated)


async def main():
    """Main function to handle CLI arguments and execute regeneration."""
    parser = argparse.ArgumentParser(
        description="Regenerate content from a debug file and compare outputs"
    )
    parser.add_argument(
        "--debug-file",
        type=str,
        required=True,
        help="Path to the debug JSON file (absolute or relative to project root)",
    )

    args = parser.parse_args()

    # Resolve file path
    debug_file_path = Path(args.debug_file)
    if not debug_file_path.is_absolute():
        debug_file_path = project_root / debug_file_path

    logger.info(f"Loading debug file: {debug_file_path}")

    try:
        # Load debug file
        debug_data = load_debug_file(str(debug_file_path))

        logger.info(f"Task type: {debug_data['task_type']}")
        logger.info(f"Timestamp: {debug_data['timestamp']}")
        logger.info(f"Number of messages: {len(debug_data['messages'])}")

        # Regenerate content
        regenerated_response = await regenerate_content(debug_data["messages"])

        # Print comparison
        print_comparison(
            original=debug_data["original_response"],
            regenerated=regenerated_response,
            task_type=debug_data["task_type"],
            metadata=debug_data["metadata"],
        )

        # Save regenerated response to file
        output_file = debug_file_path.parent / f"{debug_file_path.stem}_regenerated.json"
        output_data = {
            "original_file": str(debug_file_path),
            "timestamp": debug_data["timestamp"],
            "task_type": debug_data["task_type"],
            "original_response": debug_data["original_response"],
            "regenerated_response": regenerated_response,
            "metadata": debug_data["metadata"],
        }

        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(output_data, f, ensure_ascii=False, indent=2)

        logger.info(f"Comparison saved to: {output_file}")

    except Exception as e:
        logger.error(f"Failed to regenerate content: {e}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())

```

### Core Architecture Module: `examples/verify_folder_monitor.py`
```
import os
import shutil
import tempfile
import time
import logging
from unittest.mock import MagicMock, patch

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    datefmt="%H:%M:%S",
)
# 确保能看到 opencontext 的日志
logging.getLogger("opencontext").setLevel(logging.INFO)
logger = logging.getLogger("FolderMonitorVerifier")

# 模拟 Storage
mock_storage = MagicMock()
# 默认返回空，但在删除测试前我们会修改它
mock_storage.get_all_processed_contexts.return_value = {}
mock_storage.delete_processed_context.return_value = True


# 定义一个简单的 Mock Context 对象
class MockContext:
    def __init__(self, ctx_id):
        self.id = ctx_id


@patch("opencontext.context_capture.folder_monitor.get_storage", return_value=mock_storage)
def run_verification(mock_get_storage):
    from opencontext.context_capture.folder_monitor import FolderMonitorCapture
    from opencontext.models.enums import ContextType

    # 创建临时目录
    temp_dir = tempfile.mkdtemp(prefix="test_monitor_")
    logger.info(f"Created temporary watch directory: {temp_dir}")

    monitor = None
    try:
        # 初始化 FolderMonitorCapture
        monitor = FolderMonitorCapture()

        config = {
            "monitor_interval": 1,
            "watch_folder_paths": [temp_dir],
            "recursive": True,
            "max_file_size": 1024 * 1024,
            "initial_scan": True,
        }

        logger.info("--- Step 1: Initialization ---")
        if not monitor.initialize(config):
            logger.error("❌ Initialization failed!")
            return

        # 启动监控
        monitor.start()
        time.sleep(1)
        logger.info("✅ Monitor started")

        # 4. 测试场景：创建文件
        logger.info("\n--- Step 2: Test File Creation ---")
        test_file_1 = os.path.join(temp_dir, "test1.txt")
        with open(test_file_1, "w", encoding="utf-8") as f:
            f.write("Hello World")

        logger.info(f"Created file: {os.path.basename(test_file_1)}")
        time.sleep(1)

        results = monitor.capture()

        # 验证创建
        if len(results) == 1 and results[0].additional_info.get("event_type") == "file_created":
            logger.info(
                f"✅ PASS: Captured 'file_created' event. Content: {results[0].content_text}"
            )
        else:
            logger.error(f"❌ FAIL: Expected 1 creation event, got {len(results)}")

        # 5. 测试场景：修改文件
        logger.info("\n--- Step 3: Test File Update ---")
        with open(test_file_1, "a", encoding="utf-8") as f:
            f.write("\nUpdated Content")

        logger.info(f"Updated file: {os.path.basename(test_file_1)}")
        time.sleep(1)

        results = monitor.capture()

        # 验证修改
        if len(results) == 1 and results[0].additional_info.get("event_type") == "file_updated":
            logger.info(f"✅ PASS: Captured 'file_updated' event.")
        else:
            logger.error(f"❌ FAIL: Expected 1 update event, got {len(results)}")

        # 6. 测试场景：删除文件
        logger.info("\n--- Step 4: Test File Deletion ---")

        # 关键点：在删除前，配置 mock storage 返回模拟的 Context 数据
        # 这样 FolderMonitor 才会去尝试删除它们
        mock_storage.get_all_processed_contexts.return_value = {
            ContextType.KNOWLEDGE_CONTEXT: [
                MockContext("mock_ctx_id_1"),
                MockContext("mock_ctx_id_2"),
            ]
        }

        os.remove(test_file_1)
        logger.info(f"Deleted file: {os.path.basename(test_file_1)}")

        time.sleep(1)

        # 执行capture，触发cleanup
        results = monitor.capture()

        if len(results) == 0:
            logger.info("✅ PASS: Capture returned 0 events for deletion (as expected).")
        else:
            logger.error(f"❌ FAIL: Expected 0 events for deletion, got {len(results)}")

        # 验证内部副作用：检查 Storage 的 delete 方法是否被调用
        # 模拟了返回 2 个 context，所以应该调用 2 次 delete
        delete_call_count = mock_storage.delete_processed_context.call_count
        if delete_call_count >= 2:
            logger.info(
                f"✅ PASS: Storage cleanup triggered. 'delete_processed_context' called {delete_call_count} times."
            )
            # 验证调用参数中是否包含我们的 mock id
            calls = mock_storage.delete_processed_context.call_args_list
            ids_deleted = [call.kwargs.get("id") or call.args[0] for call in calls]
            logger.info(f"   -> Deleted Context IDs: {ids_deleted}")
        else:
            logger.error(f"❌ FAIL: Storage cleanup NOT triggered. Call count: {delete_call_count}")

        # 7. 停止监控
        logger.info("\n--- Step 5: Cleanup ---")
        monitor.stop()

    finally:
        if monitor:
            monitor.stop()
        if os.path.exists(temp_dir):
            shutil.rmtree(temp_dir)
            logger.info(f"Cleaned up temporary directory: {temp_dir}")


if __name__ == "__main__":
    import sys

    sys.path.append(os.getcwd())

    try:
        run_verification()
    except KeyboardInterrupt:
        pass
    except Exception as e:
        logger.exception(f"An error occurred: {e}")

```

### Core Architecture Module: `frontend/electron.vite.config.ts`
```
// Copyright (c) 2025 Beijing Volcano Engine Technology Co., Ltd.
// SPDX-License-Identifier: Apache-2.0

import react from '@vitejs/plugin-react-swc'
import { CodeInspectorPlugin } from 'code-inspector-plugin'
import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import { visualizer } from 'rollup-plugin-visualizer'
import tailwindcss from '@tailwindcss/vite'
// import react from '@vitejs/plugin-react'

const visualizerPlugin = (type: 'renderer' | 'main') => {
  return process.env[`VISUALIZER_${type.toUpperCase()}`] ? [visualizer({ open: true })] : []
}
const isDev = process.env.NODE_ENV === 'development'
// const isProd = process.env.NODE_ENV === 'production'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@main': resolve('src/main'),
        '@types': resolve('src/renderer/src/types'),
        '@shared': resolve('packages/shared'),
        '@logger': resolve('src/main/services/LoggerService')
      }
    }
  },
  preload: {
    plugins: [
      react({
        tsDecorators: true
      }),
      externalizeDepsPlugin()
    ],
    resolve: {
      alias: {
        '@shared': resolve('packages/shared'),
        '@types': resolve('src/renderer/src/types')
      }
    },
    build: {
      sourcemap: isDev
    }
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@shared': resolve('packages/shared'),
        '@logger': resolve('src/renderer/src/services/LoggerService'),
        '@types': resolve('src/renderer/src/types')
      }
    },
    css: {
      preprocessorOptions: {
        less: {
          javascriptEnabled: true
        }
      }
    },
    plugins: [
      tailwindcss(),
      react({}),
      ...(isDev ? [CodeInspectorPlugin({ bundler: 'vite' })] : []), // 只在开发环境下启用 CodeInspectorPlugin
      ...visualizerPlugin('renderer'),
      {
        name: 'force-arco-adapter-side-effect',
        transform(code, id) {
          if (id.includes('react-19-adapter')) {
            return {
              code,
              map: null,
              moduleSideEffects: true
            }
          }
          return null
        }
      }
    ]
  }
})

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #345** (2026-03-04): **[BUG]: 1.8 version加载 custom 模型失败**
  *Symptoms*: ### 🐛 Bug description [Please make everyone to understand it]  1.7版本可以正确连接加载，1.8出现如下错误  <img width="1724" height="961" alt="Image" src="https://github.com/user-attachments/assets/ee9cc0a3-9d32-4b87-8aff-fa31e8a6700c" />  ### 🧑‍💻 Step to reproduce  1.下载minecontext 和lemonade server（https://[zhuanlan.zhihu.com/p/1899781032246490811](https://zhuanlan.zhihu.com/p/1899781032246490811)）服务器 2.安装 3.lemonade server启动，连接相应的url及填写对应模型名字 http://127.0.0.1:8000/api/v1  ### 👾 Expected result  实现正确连接，同样的方式在1.7上可以正确连接，1.8报错  ### 🚑 Any additional information  _No response_  ### 🛠️ MineContext Version  1.8  ### 💻 Platform Details  windows 11

- **Issue #335** (2026-01-30): **[BUG]: 处理屏幕截图失败**
  *Symptoms*: ### 🐛 Bug description [Please make everyone to understand it]  Screen Monitor下报错：n screenshots failed: Failed during concurrent VLM processing: 'str' object has no attribute 'value'.  ### 🧑‍💻 Step to reproduce  1.README_zh.md中下载MineContext-0.1.8-setup.exe 2.模型doubao-seeding-1.6-flash 3.开启屏幕录制 4.设置录制间隔60s  ### 👾 Expected result  如README中的描述正常工作  ### 🚑 Any additional information  _No response_  ### 🛠️ MineContext Version  0.1.8  ### 💻 Platform Details  W11 24H2 26100.7462
  **Post-Mortem & Fix Analysis**:
  > 是偶发的吗，应该是大模型的输出幻觉
  > same to #326
  > > 是偶发的吗，应该是大模型的输出幻觉 1.昨日中午和下午都存在此BUG 2.刚刚尝试，没有bug消息，但是半个小时过去，也没见总结生成的activity、tips或者其他的什么。home页还是空空如也 3.token是被正常消耗了的，昨天的总计300w左右，调用了477次（这个APIKEY只配给了MineContext) 

- **Issue #330** (2026-01-26): **[BUG]: 修改日报定时生成时间后不生效，仍按照默认时间生成**
  *Symptoms*: ### 🐛 Bug description [Please make everyone to understand it]  在 MineContext 后台设置页面修改定时生成日报的时间（例如从默认的 08:00 改为 14:00）后，保存并显示配置已更新。但第二天生成的日报依然按照默认的早上 8 点生成，未按照新设置的时间 14:00 生成。需重启服务后设置才会生效。此问题影响每日自动日报的灵活性和准确性。  ### 🧑‍💻 Step to reproduce  1. 打开 MineContext 系统设置页面。 2. 在"内容生成"标签页，找到"日报生成"部分。 3. 勾选启用日报生成，并将生成时间从 08:00 修改为 14:00。 4. 点击保存设置。 5. 等待第二天，发现日报仍于 08:00 生成，而不是设置的 14:00。  ### 👾 Expected result  期望系统能在设置的日报生成时间（如 14:00）自动生成日报，而不是始终按照默认的 08:00。更改日报生成时间后无须重启服务即可即时生效。  ### 🚑 Any additional information  - 手动重启后端服务后，新的时间才会生效。 - 猜测可能为后端运行时配置未同步更新，需将配置变更后通知 ConsumptionManager 实例。  ---  **代码引用：**  - `opencontext/server/routes/settings.py` [`update_general_settings`](https://github.com/volcengine/MineContext/blob/c2c1ed331d4ec271688f3dfebbbc9ec855835f12/opencontext/server/routes/settings.py#L330-L367) - `opencontext/managers/consumption_manager.py` [`update_task_config`](https://github.com/volcengine/MineContext/blob/c2c1ed331d4ec271688f3dfebbbc9ec855835f12/opencontext/managers/consumption_manager.py#L452-L481) - 参考 `/api/content_generation/config` 的处理逻辑：[content_generation.py#L114-L133](https://github.com/volcengine/MineContext/blob/c2c1ed331d4ec271688f3dfebbbc9ec855835f12/opencontext/server/routes/content_generation.py#L114-L133)  ---  **建议修改代码（直接可用 patch）：**  在 `opencontext/server/routes/settings.py` 的 `update_general_settings()` 方法保存、reload 配置后，补充后端配置热更新逻辑，如下（插入到 reload config 之后）：  ```python # ... 已有配置保存与 reload 逻辑 config_mgr.load_config(config_mgr.get_config_path())  # 新增：同

- **Issue #328** (2026-01-28): **[BUG]: 火山接口无法使用**
  *Symptoms*: ### 🐛 Bug description [Please make everyone to understand it]  按照流程使用火山豆包模型报错：Embedding validation failed: The model or endpoint doubao-embedding-large-text-240915 does not exist or you do not have access to it   ### 🧑‍💻 Step to reproduce  按照流程使用火山豆包模型报错：Embedding validation failed: The model or endpoint doubao-embedding-large-text-240915 does not exist or you do not have access to it  ### 👾 Expected result  按照流程使用火山豆包模型报错：Embedding validation failed: The model or endpoint doubao-embedding-large-text-240915 does not exist or you do not have access to it  ### 🚑 Any additional information  _No response_  ### 🛠️ MineContext Version  0.17  ### 💻 Platform Details  按照流程使用火山豆包模型报错：Embedding validation failed: The model or endpoint doubao-embedding-large-text-240915 does not exist or you do not have access to it
  **Post-Mortem & Fix Analysis**:
  > me too  <img width="2360" height="1320" alt="Image" src="https://github.com/user-attachments/assets/b0340bca-1232-46c1-a799-5d486c0a27d4" />
  > > me too >  > <img alt="Image" width="2000" height="1320" src="https://private-user-images.githubusercontent.com/26535864/540511638-b0340bca-1232-46c1-a799-5d486c0a27d4.png?jwt=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJnaXRodWIuY29tIiwiYXVkIjoicmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbSIsImtleSI6ImtleTUiLCJleHAiOjE3Njk0MzM5NzYsIm5iZiI6MTc2OTQzMzY3NiwicGF0aCI6Ii8yNjUzNTg2NC81NDA1MTE2MzgtYjAzNDBiY2EtMTIzMi00NmMxLWE3OTktNWQ0ODZjMGEyN2Q0LnBuZz9YLUFtei1BbGdvcml0aG09QVdTNC1ITUFDLVNIQTI1NiZYLUFtei1DcmVkZW50aWFsPUFLSUFWQ09EWUxTQTUzUFFLNFpBJTJGMjAyNjAxMjYlMkZ1cy1lYXN0LTElMkZzMyUyRmF3czRfcmVxdWVzdCZYLUFtei1EYXRlPTIwMjYwMTI2VDEzMjExNlomWC1BbXotRXhwaXJlcz0zMDAmWC1BbXotU2lnbmF0dXJlPTgxNjlmMjYyNDA4ODE4NDBhYjgyYmJlNGRkNmFmODQ0ZjhhZTZiOTBjNDNjNDdjNTg2ZWNiNDE2YTM4NGRlOGQmWC1BbXotU2lnbmVkSGVhZGVycz1ob3N0In0.DImDAgx9llug4Djng48fqBXaVrNbs9h5x1KtM2NDMRI">  一样
  > https://github.com/volcengine/MineContext/releases/tag/v0.1.8 试下这个

- **Issue #324** (2026-01-30): **[BUG]: doubao-embedding-large-text-240915似乎已下线**
  *Symptoms*: ### 🐛 Bug description [Please make everyone to understand it]  <img width="1079" height="922" alt="Image" src="https://github.com/user-attachments/assets/230c3296-e352-409c-872a-5917e7362557" />  ### 🧑‍💻 Step to reproduce  启动时填写api就会发生这个问题  ### 👾 Expected result  希望修改默认的embedding模型  ### 🚑 Any additional information  _No response_  ### 🛠️ MineContext Version  0.1.7  ### 💻 Platform Details  Windows
  **Post-Mortem & Fix Analysis**:
  > 是的，在输入APK的时候也碰到了同样问题
  > 我也遇见了这个问题 
  > Mac遇到问题加一

- **Issue #316** (2025-12-25): **[BUG]: 前端设置60s截图一次，实际截图1分钟16，17一次**
  *Symptoms*: ### 🐛 Bug description [Please make everyone to understand it]  前端设置60s截图一次，实际截图1分钟16，17次。 The frontend is set to take screenshots every 60 seconds, but in reality, it captures screenshots 16 to 17 times per minute.  ### 🧑‍💻 Step to reproduce  1. In GUI, In ScreenMonitor -> Settings 2. configure interval to 60s and save 3. Click "Start Recording" 4. Check recording folders (frontend/backend/screenshot/activity/2025/12-16). 5. There are 16 or 17 folders every minute.  ### 👾 Expected result  I expected that the screenshot folder should be generated every minutes.  ### 🚑 Any additional information  Rootcause is found:  原因：单位换算错误  - 现象 ：在 GUI 设置了 60s，但系统每分钟生成约 17 个目录（约每 3.5 秒一个）。 - 代码逻辑 ：   - 前端 ScreenSettings 中存储的 recordInterval 单位是 秒 （例如 60 ）。   - 后端任务调度器 ScheduleNextTask 期望的单位是 毫秒 。   - 在 ScreenMonitorTask.ts 中，直接将 60 传给了调度器： this.updateInterval(config.recordInterval) 。   - 结果：调度器试图每 60毫秒 执行一次截图。   - 实际频率 ：由于截图操作本身（获取源、转换图片、写入磁盘）大约需要 3-4 秒，所以实际上变成了“尽可能快地截图”，导致每分钟约 16-17 次（60秒 / 3.5秒 ≈ 17）。  Reason: Unit conversion error    - Symptom: set 60s in the GUI, but the system generates about 17 directories per minute (approximately one every 3.5 seconds).   - Code logic:     - The recordInterval stored in the frontend ScreenSettings is in seconds (e.g., 60).     - The backend task scheduler ScheduleNextTask expects the unit to be milliseconds.     - In ScreenMonitorTask.ts, the value 60 is directly passed to the scheduler: this.updateInterval(config.recordInterval).     - Result: 
  **Post-Mortem & Fix Analysis**:
  > i also meet this issue

- **Issue #304** (2025-12-05): **[BUG]: MineContext 使用 Qwen3 模型时 Token 消耗异常高**
  *Symptoms*: ### 🐛 Bug description [Please make everyone to understand it]  **问题描述**   MineContext 在调用阿里云 Qwen3 系列模型（如 `qwen3-vl-plus` 和 `qwen3-max`）时，Token 消耗量远超合理范围，导致用户成本激增。    **关键数据记录**   - **模型版本**：`qwen3-vl-plus-2025-09-23`    - 调用总次数：325 次     - 失败总次数：114 次     - 限流错误次数：95 次     - 总 Token 量：1,403.1 千 Token     - 输入 Token 总量：1,298.5 千 Token     - 输出 Token 总量：104.7 千 Token    - **对比模型**：`text-embedding-v3`     - 调用总次数：526 次     - 总 Token 量：21.5 千 Token    **现象说明**   - 使用 `qwen3-vl-plus` 等旗舰视觉模型时，单日消耗约 200 万 Token。   - 与 `text-embedding-v3` 相比，消耗量高出 **65 倍以上**（1,403.1K vs 21.5K），且失败率与限流错误率显著偏高（失败率 35.1%，限流率 29.2%）。  ### 🧑‍💻 Step to reproduce  ...  ### 👾 Expected result  ...  ### 🚑 Any additional information  ...  ### 🛠️ MineContext Version  ..  ### 💻 Platform Details  ...
  **Post-Mortem & Fix Analysis**:
  > 这个是正常的，vlm分析截图使用的token比较高。embedding 模型输入的是文本
  > 可以调大截图的间隔或者减少截图的范围

- **Issue #301** (2025-12-05): **[BUG]:**
  *Symptoms*: ### 🐛 Bug description [Please make everyone to understand it]  MineContext 请求失败，都是显示超时，0 成功，LM Studio 显示不少成功日志 已知：配置正确，截图正确、LM 接收正确、模型处理正确 未知：超时原因是否是设置的 超时判断过短，还是其他原因 结果：用不起来，希望排查解决  ### 🧑‍💻 Step to reproduce  MineContext 请求失败， 0 成功 <img width="638" height="278" alt="Image" src="https://github.com/user-attachments/assets/694e6720-7c33-45d1-93f2-7ed30a5930ad" />  <img width="1576" height="538" alt="Image" src="https://github.com/user-attachments/assets/bd5640df-8904-4928-8065-01a9530fd47b" />  LM  studio 产生了结果：  <img width="2242" height="1116" alt="Image" src="https://github.com/user-attachments/assets/e716a855-1a4c-42d0-b80f-1b7f186d710d" />  ### 👾 Expected result  可能是本地模型的耗时引起，单图片处理 1 分多钟，建议将超时的判断延长到更长，如3分钟或者 5 分  ### 🚑 Any additional information  _No response_  ### 🛠️ MineContext Version  0.1.6  ### 💻 Platform Details  MineConetext 安装在 macbook pro M1 version ： Sequoia Version 15.1
  **Post-Mortem & Fix Analysis**:
  > 可以改下 /Users/bytedance/Library/Application Support/MineContext/config/user_setting.yaml 里的模型配置，加个 timeout 参数就可以了，单位是s

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

### Incident Patch 1: `171c7a9e` (2026-05-07)
**Commit Message**: fix(security): sandbox vikingdb:// protocol to userData directory (#363)

The renderer-loadable `vikingdb://` protocol read any local file the
main-process had access to: the handler ran `path.resolve(filePath)` and
passed the result straight to `fs.readFileSync` with no allow-list. A
markdown image such as `![](vikingdb:///Users/<u>/.ssh/id_rsa)` rendered
in any vault note, chat reply, or LLM response would have caused the main
process to read that file and stream the bytes back into the renderer.

This is amplified by two adjacent settings:

  * `webPreferences.webSecurity` is `false`, so the renderer can `fetch()`
    a custom-protocol URL and read the response body in JS.
  * `renderer/index.html`'s CSP allows `connect-src *` and
    `script-src 'unsafe-inline' 'unsafe-eval' *`, so any future renderer
    XSS — including a stored one in vault content — has unrestricted
    network egress.

Combined, the original handler turned even a minor renderer XSS into a
full local-file exfiltration primitive.

Fix: constrain the resolved path to the directory the backend writes its
data into. In production this is `app.getPath('userData')`, which mirrors
`CONTEXT_PATH` in `backend.ts` (th

**File**: `frontend/src/main/index.ts` (modified, +40/-18)
```diff
@@ -198,28 +198,50 @@ app.whenReady().then(() => {
       let filePath = request.url.replace('vikingdb://', '')
       filePath = decodeURIComponent(filePath)
 
-      const fullPath = path.resolve(filePath)
+      const resolved = path.resolve(filePath)
 
-      console.log('Reading file:', fullPath)
+      if (!fs.existsSync(resolved)) {
+        callback({ error: -6 /* net::ERR_FILE_NOT_FOUND */ })
+        return
+      }
 
-      if (fs.existsSync(fullPath)) {
-        const data = fs.readFileSync(fullPath)
-        const extension = path.extname(fullPath).toLowerCase()
+      // Constrain reads to the directory the backend writes its data into
+      // (mirrors `CONTEXT_PATH` in backend.ts). Without this, the renderer
+      // can read arbitrary local files via e.g. `vikingdb:///Users/<u>/.ssh/id_rsa`,
+      // which combined with `webSecurity: false` and the permissive CSP
+      // (`connect-src *`) makes any future renderer XSS a full local-file
+      // exfiltration primitive. We also realpath() the resolved path so a
+      // symlink planted inside userData cannot be used to escape the sandbox.
+      const allowedRoot =
+        !app.isPackaged && is.dev
+          ? path.resolve('.')
+          : path.resolve(app.getPath('userData'))
+      const realPath = fs.realpathSync(resolved)
+      const isUnderRoot =
+        realPath === allowedRoot || realPath.startsWith(allowedRoot + path.sep)
+
+      if (!isUnderRoot) {
+        console.error(
+          `vikingdb:// blocked path outside allowed root: ${realPath} (root: ${allowedRoot})`
+        )
+        callback({ error: -10 /* net::ERR_ACCESS_DENIED */ })
+        return
+      }
 
-        // Set MIME type based on file extension
-        let mimeType = 'application/octet-stream'
-        if (extension === '.png') mimeType = 'image/png'
-        else if (extension === '.jpg' || extension === '.jpeg') mimeType = 'image/jpeg'
-        else if (extension === '.gif') mimeType = 'image/gif'
-        else if (extension === '.svg') mimeType = 'image/svg+xml'
+      const data = fs.readFileSync(realPath)
+      const extension = path.extname(realPath).toLowerCase()
 
-        callback({
-          mimeType: mimeType,
-          data: data
-        })
-      } else {
-        callback({ error: -6 })
-      }
+      // Set MIME type based on file extension
+      let mimeType = 'application/octet-stream'
+      if (extension === '.png') mimeType = 'image/png'
+      else if (extension === '.jpg' || extension === '.jpeg') mimeType = 'image/jpeg'
+      else if (extension === '.gif') mimeType = 'image/gif'
+      else if (extension === '.svg') mimeType = 'image/svg+xml'
+
+      callback({
+        mimeType: mimeType,
+        data: data
+      })
     } catch (error) {
       console.error('Error reading file:', error)
       callback({ error: -2 })
```

---

### Incident Patch 2: `e7824081` (2026-05-06)
**Commit Message**: Create SECURITY.md (#364)

**File**: `SECURITY.md` (added, +13/-0)
```diff
@@ -0,0 +1,13 @@
+## Security and privacy
+
+If you discover potential security issues in the project, or believe you may have found a security issue, please notify the ByteDance security team through our [security center](https://security.bytedance.com/src/) or [vulnerability reporting email](mailto:src@bytedance.com). Please do not create public GitHub Issues.
+
+We will assess the vulnerability based on the Common Vulnerability Scoring System (CVSS 3.1). The security team will keep you updated on key progress and may request further information or guidance from you. You are welcome to contact us via the email or website mentioned above to ask questions or discuss disclosure matters.
+
+To protect the security of our customers, ByteDance requests that you do not publish or share information regarding the vulnerability in any public forum, nor publish or share data involving users, until the vulnerability has been remediated and our users have been notified. Please understand that the time required for remediation depends on the severity of the vulnerability and the scope of the impact.
+
+Individuals, companies, and security teams may wish to publish security advisories on their own websites or other forums. Please contact us via the email or website mentioned above prior to publication to discuss the information that can be disclosed and to coordinate the disclosure timeline.
+
+## Bug Bounty Reward
+
+[For the policy of bug bounty reward](https://bytedance.larkoffice.com/docx/ZstQd7bbooDctqxBCAmcFasOngd), if you have any questions about the rules, please contact [https://src.bytedance.com/home](https://src.bytedance.com/home) for consultation.
```

---

### Incident Patch 3: `fc2ddb1d` (2026-03-10)
**Commit Message**: fix(llm): Fix when use custom embedding providers. (#339)

* fix(llm): Fix when use custom embedding providers.

* fix validate.

* fix validate.

**File**: `opencontext/llm/llm_client.py` (modified, +5/-4)
```diff
@@ -266,14 +266,14 @@ async def _openai_chat_completion_stream_async(self, messages: List[Dict[str, An
 
     def _request_embedding(self, text: str, **kwargs) -> List[float]:
         try:
-            if self.provider == LLMProvider.DOUBAO.value:
+            if self.provider != LLMProvider.DOUBAO.value:
+                response = self.client.embeddings.create(model=self.model, input=[text])
+                embedding = response.data[0].embedding
+            else:
                 response = self.client.multimodal_embeddings.create(
                     model=self.model, input=[{"type": "text", "text": text}]
                 )
                 embedding = response.data.embedding
-            else:
-                response = self.client.embeddings.create(model=self.model, input=[text])
-                embedding = response.data[0].embedding
 
             # Record token usage
             if hasattr(response, "usage") and response.usage:
@@ -314,6 +314,7 @@ def _request_embedding(self, text: str, **kwargs) -> List[float]:
     async def _request_embedding_async(self, text: str, **kwargs) -> List[float]:
         try:
             if self.provider == LLMProvider.DOUBAO.value:
+                # Only ark has multimodal_embeddings
                 response = self.client.multimodal_embeddings.create(
                     model=self.model, input=[{"type": "text", "text": text}]
                 )
```

---

### Incident Patch 4: `1bdaee94` (2026-03-05)
**Commit Message**: fix: replace bare except clauses with except Exception (#344)

Bare `except:` catches BaseException including KeyboardInterrupt and
SystemExit. This replaces 9 bare except clauses with
`except Exception:` to only catch application-level exceptions.

Co-authored-by: haosenwang1018 <haosenwang1018@users.noreply.github.com>

**File**: `opencontext/context_consumption/generation/smart_todo_manager.py` (modified, +1/-1)
```diff
@@ -92,7 +92,7 @@ def generate_todo_tasks(self, start_time: int, end_time: int) -> Optional[str]:
                             deadline = datetime.datetime.strptime(deadline_str, "%Y-%m-%d %H:%M")
                         else:
                             deadline = datetime.datetime.strptime(task["due_date"], "%Y-%m-%d")
-                    except:
+                    except Exception:
                         pass
 
                 todo_id = get_storage().insert_todo(
```

**File**: `opencontext/llm/llm_client.py` (modified, +1/-1)
```diff
@@ -439,7 +439,7 @@ def _extract_error_summary(error: Any) -> str:
                                         if ". Request id:" in actual_msg:
                                             actual_msg = actual_msg.split(". Request id:")[0]
                                         return actual_msg
-                            except:
+                            except Exception:
                                 pass
                         return f"Error {code}"
 
```

**File**: `opencontext/monitoring/metrics_collector.py` (modified, +2/-2)
```diff
@@ -48,7 +48,7 @@ def wrapper(*args, **kwargs):
                     if hasattr(result, "__len__") and not isinstance(result, str):
                         try:
                             context_count = len(result)
-                        except:
+                        except Exception:
                             context_count = 1
 
                     monitor.record_processing_metrics(
@@ -94,7 +94,7 @@ def wrapper(*args, **kwargs):
                     elif hasattr(result, "__len__") and not isinstance(result, str):
                         try:
                             snippets_count = len(result)
-                        except:
+                        except Exception:
                             snippets_count = 0
 
                     # 尝试从参数中获取query
```

**File**: `opencontext/storage/backends/sqlite_backend.py` (modified, +4/-4)
```diff
@@ -951,7 +951,7 @@ def save_monitoring_token_usage(
             logger.error(f"Failed to save token usage: {e}")
             try:
                 self.connection.rollback()
-            except:
+            except Exception:
                 pass
             return False
 
@@ -1047,7 +1047,7 @@ def save_monitoring_stage_timing(
             logger.error(f"Failed to save stage timing: {e}")
             try:
                 self.connection.rollback()
-            except:
+            except Exception:
                 pass
             return False
 
@@ -1087,7 +1087,7 @@ def save_monitoring_data_stats(
             logger.error(f"Failed to save data stats: {e}")
             try:
                 self.connection.rollback()
-            except:
+            except Exception:
                 pass
             return False
 
@@ -1313,7 +1313,7 @@ def cleanup_old_monitoring_data(self, days: int = 7) -> bool:
             logger.error(f"Failed to cleanup old monitoring data: {e}")
             try:
                 self.connection.rollback()
-            except:
+            except Exception:
                 pass
             return False
 
```

**File**: `opencontext/utils/json_parser.py` (modified, +1/-1)
```diff
@@ -101,5 +101,5 @@ def fix_quotes_in_match(match):
     try:
         fixed = re.sub(pattern, fix_quotes_in_match, json_str)
         return fixed
-    except:
+    except Exception:
         return json_str
```

---

### Incident Patch 5: `d13818b8` (2026-03-04)
**Commit Message**: fix: resolve AttributeError crash in ScreenshotCapture._get_statistics_impl

**File**: `opencontext/context_capture/screenshot.py` (modified, +9/-12)
```diff
@@ -481,27 +481,24 @@ def _get_statistics_impl(self) -> Dict[str, Any]:
         Returns:
             Dict[str, Any]: Statistics information
         """
-        active_contexts_info = {}
-        for monitor_id, history in self._active_screenshots.items():
-            active_contexts_info[monitor_id] = [
-                {
-                    "uuid": ctx.uuid,
-                    "duration_count": ctx.metadata.get("duration_count"),
-                    "timestamp": ctx.metadata.get("timestamp"),
-                }
-                for img, ctx in history
-            ]
+        last_screenshots_info = {}
+        for monitor_id, (img, ctx) in self._last_screenshots.items():
+            last_screenshots_info[monitor_id] = {
+                "uuid": ctx.uuid,
+                "duration_count": ctx.additional_info.get("duration_count"),
+                "timestamp": ctx.additional_info.get("timestamp"),
+            }
 
         return {
             "screenshot_count": self._screenshot_count,
-            "active_screenshots": active_contexts_info,
+            "last_screenshots": last_screenshots_info,
         }
 
     def _reset_statistics_impl(self) -> None:
         """
         Reset statistics implementation
         """
         self._screenshot_count = 0
-        self._active_screenshots = {}
+        self._last_screenshots.clear()
         self._last_screenshot_time = None
         self._last_screenshot_path = None
```

---

### Incident Patch 6: `f758087d` (2026-03-04)
**Commit Message**: fix: correct embedding provider detection for non-Doubao providers (#347)

**File**: `opencontext/llm/llm_client.py` (modified, +15/-15)
```diff
@@ -266,14 +266,14 @@ async def _openai_chat_completion_stream_async(self, messages: List[Dict[str, An
 
     def _request_embedding(self, text: str, **kwargs) -> List[float]:
         try:
-            if self.provider == LLMProvider.OPENAI.value:
-                response = self.client.embeddings.create(model=self.model, input=[text])
-                embedding = response.data[0].embedding
-            else:
+            if self.provider == LLMProvider.DOUBAO.value:
                 response = self.client.multimodal_embeddings.create(
                     model=self.model, input=[{"type": "text", "text": text}]
                 )
                 embedding = response.data.embedding
+            else:
+                response = self.client.embeddings.create(model=self.model, input=[text])
+                embedding = response.data[0].embedding
 
             # Record token usage
             if hasattr(response, "usage") and response.usage:
@@ -313,14 +313,14 @@ def _request_embedding(self, text: str, **kwargs) -> List[float]:
 
     async def _request_embedding_async(self, text: str, **kwargs) -> List[float]:
         try:
-            if self.provider == LLMProvider.OPENAI.value:
-                response = await self.async_client.embeddings.create(model=self.model, input=[text])
-                embedding = response.data[0].embedding
-            else:
+            if self.provider == LLMProvider.DOUBAO.value:
                 response = self.client.multimodal_embeddings.create(
                     model=self.model, input=[{"type": "text", "text": text}]
                 )
                 embedding = response.data.embedding
+            else:
+                response = await self.async_client.embeddings.create(model=self.model, input=[text])
+                embedding = response.data[0].embedding
 
             # Record token usage
             if hasattr(response, "usage") and response.usage:
@@ -476,20 +476,20 @@ def _extract_error_summary(error: Any) -> str:
 
             elif self.llm_type == LLMType.EMBEDDING:
                 # Test with a simple text
-                if self.provider == LLMProvider.OPENAI.value:
-                    response = self.client.embeddings.create(model=self.model, input=["test"])
-                    if response.data and len(response.data) > 0 and response.data[0].embedding:
-                        return True, "Embedding model validation successful"
-                    else:
-                        return False, "Embedding model returned empty response"
-                else:
+                if self.provider == LLMProvider.DOUBAO.value:
                     response = self.client.multimodal_embeddings.create(
                         model=self.model, input=[{"type": "text", "text": "test"}]
                     )
                     if response.data and response.data.embedding:
                         return True, "Embedding model validation successful"
                     else:
                         return False, "Embedding model returned empty response"
+                else:
+                    response = self.client.embeddings.create(model=self.model, input=["test"])
+                    if response.data and len(response.data) > 0 and response.data[0].embedding:
+                        return True, "Embedding model validation successful"
+                    else:
+                        return False, "Embedding model returned empty response"
             else:
                 return False, f"Unsupported LLM type: {self.llm_type}"
 
```

---

### Incident Patch 7: `e3d39bb2` (2026-01-28)
**Commit Message**: Fix tokens (#334)

* fix

* fix: context type

* Update download links to version 0.1.8

* Update download links in README_zh.md

Updated download links for Mac and Windows to version 0.1.8.

---------

Co-authored-by: qin-ctx <qinhaojie.exe@bytedance.com>

**File**: `README.md` (modified, +1/-1)
```diff
@@ -26,7 +26,7 @@ An open-source, proactive context-aware AI partner, dedicated to bringing clarit
 
 🌍 Join our [Discord Group](https://discord.gg/tGj7RQ3nUR)
 
-<a href="https://github.com/volcengine/MineContext/releases/download/v0.1.7/MineContext-0.1.7.dmg">🖥️ Download for Mac</a> · <a href="https://github.com/volcengine/MineContext/releases/download/v0.1.7/MineContext-0.1.7-setup.exe">💻 Download for Windows</a>
+<a href="https://github.com/volcengine/MineContext/releases/download/v0.1.8/MineContext-0.1.8.dmg">🖥️ Download for Mac</a> · <a href="https://github.com/volcengine/MineContext/releases/download/v0.1.8/MineContext-0.1.8-setup.exe">💻 Download for Windows</a>
 
 </div>
 
```

**File**: `README_zh.md` (modified, +1/-1)
```diff
@@ -26,7 +26,7 @@
 
 🌍 加入我们的 [Discord 社区](https://discord.gg/tGj7RQ3nUR)
 
-<a href="https://github.com/volcengine/MineContext/releases/download/v0.1.7/MineContext-0.1.7.dmg">🖥️ Mac 版下载</a> · <a href="https://github.com/volcengine/MineContext/releases/download/v0.1.7/MineContext-0.1.7-setup.exe">💻 Windows 版下载</a>
+<a href="https://github.com/volcengine/MineContext/releases/download/v0.1.8/MineContext-0.1.8.dmg">🖥️ Mac 版下载</a> · <a href="https://github.com/volcengine/MineContext/releases/download/v0.1.8/MineContext-0.1.8-setup.exe">💻 Windows 版下载</a>
 
 </div>
   
```

**File**: `opencontext/llm/llm_client.py` (modified, +38/-30)
```diff
@@ -14,8 +14,8 @@
 from volcenginesdkarkruntime import Ark
 
 from opencontext.models.context import Vectorize
-from opencontext.utils.logging_utils import get_logger
 from opencontext.monitoring import record_processing_stage
+from opencontext.utils.logging_utils import get_logger
 
 logger = get_logger(__name__)
 
@@ -42,7 +42,9 @@ def __init__(self, llm_type: LLMType, config: Dict[str, Any]):
         if not self.api_key or not self.base_url or not self.model:
             raise ValueError("API key, base URL, and model must be provided")
         self.client = OpenAI(api_key=self.api_key, base_url=self.base_url, timeout=self.timeout)
-        self.async_client = AsyncOpenAI(api_key=self.api_key, base_url=self.base_url, timeout=self.timeout)
+        self.async_client = AsyncOpenAI(
+            api_key=self.api_key, base_url=self.base_url, timeout=self.timeout
+        )
         if self.provider == LLMProvider.DOUBAO.value and self.llm_type == LLMType.EMBEDDING:
             self.client = Ark(api_key=self.api_key, base_url=self.base_url, timeout=self.timeout)
             self.async_client = None
@@ -268,24 +270,29 @@ def _request_embedding(self, text: str, **kwargs) -> List[float]:
                 response = self.client.embeddings.create(model=self.model, input=[text])
                 embedding = response.data[0].embedding
             else:
-                response = self.client.multimodal_embeddings.create(model=self.model, input=[
-                    {
-                        "type": "text",
-                        "text": text
-                    }
-                ])
+                response = self.client.multimodal_embeddings.create(
+                    model=self.model, input=[{"type": "text", "text": text}]
+                )
                 embedding = response.data.embedding
 
             # Record token usage
             if hasattr(response, "usage") and response.usage:
                 try:
                     from opencontext.monitoring import record_token_usage
 
+                    usage = response.usage
+                    if isinstance(usage, dict):
+                        prompt_tokens = usage.get("prompt_tokens", 0)
+                        total_tokens = usage.get("total_tokens", 0)
+                    else:
+                        prompt_tokens = usage.prompt_tokens
+                        total_tokens = usage.total_tokens
+
                     record_token_usage(
                         model=self.model,
-                        prompt_tokens=response.usage.prompt_tokens,
+                        prompt_tokens=prompt_tokens,
                         completion_tokens=0,  # embedding has no completion tokens
-                        total_tokens=response.usage.total_tokens,
+                        total_tokens=total_tokens,
                     )
                 except ImportError:
                     pass  # Monitoring module not installed or initialized
@@ -310,24 +317,29 @@ async def _request_embedding_async(self, text: str, **kwargs) -> List[float]:
                 response = await self.async_client.embeddings.create(model=self.model, input=[text])
                 embedding = response.data[0].embedding
             else:
-                response = self.client.multimodal_embeddings.create(model=self.model, input=[
-                    {
-                        "type": "text",
-                        "text": text
-                    }
-                ])
+                response = self.client.multimodal_embeddings.create(
+                    model=self.model, input=[{"type": "text", "text": text}]
+                )
                 embedding = response.data.embedding
 
             # Record token usage
             if hasattr(response, "usage") and response.usage:
                 try:
                     from opencontext.monitoring import record_token_usage
 
+                    usage = response.usage
+                    if isinstance(usage, dict):
+              
```

**File**: `opencontext/server/context_operations.py` (modified, +8/-2)
```diff
@@ -14,7 +14,12 @@
 from typing import Any, Dict, List, Optional
 
 from opencontext.models.context import ProcessedContext, RawContextProperties, Vectorize
-from opencontext.models.enums import ContentFormat, ContextSource, ContextType
+from opencontext.models.enums import (
+    ContentFormat,
+    ContextSource,
+    ContextType,
+    get_context_type_options,
+)
 from opencontext.storage.global_storage import get_storage
 from opencontext.utils.logging_utils import get_logger
 
@@ -217,7 +222,8 @@ def get_context_types(self) -> List[str]:
 
         try:
             collection_names = self.storage.get_vector_collection_names()
-            return [name for name in collection_names if name in ContextType]
+            valid_types = get_context_type_options()
+            return [name for name in collection_names if name in valid_types]
         except Exception as e:
             logger.exception(f"Failed to get context types: {e}")
             raise RuntimeError(f"Failed to get context types: {str(e)}") from e
```

---

### Incident Patch 8: `ea2fb536` (2026-01-05)
**Commit Message**: docs: fix download lonk for 0.1.7 vserion in readme (#320)

**File**: `README.md` (modified, +1/-1)
```diff
@@ -26,7 +26,7 @@ An open-source, proactive context-aware AI partner, dedicated to bringing clarit
 
 🌍 Join our [Discord Group](https://discord.gg/tGj7RQ3nUR)
 
-<a href="https://github.com/volcengine/MineContext/releases/download/0.1.5/MineContext-0.1.5.dmg">🖥️ Download for Mac</a> · <a href="https://github.com/volcengine/MineContext/releases/download/0.1.5/MineContext-0.1.5-setup.exe">💻 Download for Windows</a>
+<a href="https://github.com/volcengine/MineContext/releases/download/v0.1.7/MineContext-0.1.7.dmg">🖥️ Download for Mac</a> · <a href="https://github.com/volcengine/MineContext/releases/download/v0.1.7/MineContext-0.1.7-setup.exe">💻 Download for Windows</a>
 
 </div>
 
```

---

### Incident Patch 9: `f2dcffab` (2026-01-05)
**Commit Message**: docs: fix download link for 0.1.7 version in readme zh (#321)

**File**: `README_zh.md` (modified, +1/-1)
```diff
@@ -26,7 +26,7 @@
 
 🌍 加入我们的 [Discord 社区](https://discord.gg/tGj7RQ3nUR)
 
-<a href="https://github.com/volcengine/MineContext/releases/download/0.1.5/MineContext-0.1.5.dmg">🖥️ Mac 版下载</a> · <a href="https://github.com/volcengine/MineContext/releases/download/0.1.5/MineContext-0.1.5-setup.exe">💻 Windows 版下载</a>
+<a href="https://github.com/volcengine/MineContext/releases/download/v0.1.7/MineContext-0.1.7.dmg">🖥️ Mac 版下载</a> · <a href="https://github.com/volcengine/MineContext/releases/download/v0.1.7/MineContext-0.1.7-setup.exe">💻 Windows 版下载</a>
 
 </div>
   
```

---

### Incident Patch 10: `fecace9a` (2025-12-18)
**Commit Message**: fix: correct screen monitor interval unit from seconds to milliseconds (#317)

**File**: `frontend/src/main/background/task/screen-monitor-task.ts` (modified, +1/-1)
```diff
@@ -58,7 +58,7 @@ class ScreenMonitorTask extends ScheduleNextTask {
     })
     ipcMain.handle(IpcChannel.Task_Update_Model_Config, (_, config: ScreenSettings) => {
       this.modelConfig = config
-      this.updateInterval(config.recordInterval)
+      this.updateInterval(config.recordInterval * 1000)
     })
     ipcMain.handle(IpcChannel.Task_Start, () => {
       logger.info('render notify ScreenMonitorTask start')
```

#### Recent Merged Pull Requests:
- **PR #364** (2026-05-06): Create SECURITY.md (@qin-ptr)
- **PR #363** (2026-05-07): fix(security): sandbox vikingdb:// protocol to userData directory (@Chen17-sq)
- **PR #354** (2026-03-12): Update release.yml (@qin-ptr)
- **PR #352** (2026-03-06): fix: resolve AttributeError crash in ScreenshotCapture._get_statistic… (@aritra0342)
- **PR #347** (2026-03-04): fix: correct embedding provider detection for non-Doubao providers (@Xiao-ao-jiang-hu)
- **PR #344** (2026-03-05): fix: replace 9 bare excepts with except Exception across 5 files (@haosenwang1018)
- **PR #343** (2026-03-05): 大幅优化启动性能，热启动加速16x，冷启动加速8x。 (@ZhuYizhou2333)
- **PR #339** (2026-03-10): fix(llm): Fix when use custom embedding providers. (@lx200916)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

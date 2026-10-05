# Forensic Learning Record (Deep Inspection): assafelovic/gpt-researcher

> **Canonical Artifact**: `07_PROJECT_LEARNING/assafelovic-gpt-researcher-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/assafelovic/gpt-researcher](https://github.com/assafelovic/gpt-researcher))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:38:33.222Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `assafelovic/gpt-researcher`
- **Description**: An autonomous agent that conducts deep research on any data using any LLM providers
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 29922 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `backend/server/server_utils.py`
```
import asyncio
import json
import os
import re
import time
import shutil
import traceback
from typing import Awaitable, Dict, List, Any
from fastapi.responses import JSONResponse, FileResponse
from gpt_researcher.document.document import DocumentLoader
from gpt_researcher import GPTResearcher
from gpt_researcher.actions import stream_output
# This module is imported under two different package names: as
# `backend.server.server_utils` (main.py / the Procfile entrypoint) and as
# `server.server_utils` (backend/server/app.py prepends backend/ to sys.path).
# Only the first can resolve `backend.utils`, so fall back to the bare name.
try:
    from backend.utils import write_md_to_pdf, write_md_to_word, write_text_to_md
except ImportError:  # pragma: no cover - legacy sys.path-shimmed import
    from utils import write_md_to_pdf, write_md_to_word, write_text_to_md
from pathlib import Path
from datetime import datetime
from fastapi import HTTPException, WebSocketDisconnect
import logging
import hashlib

from .multi_agent_runner import run_multi_agent_task

# Import chat agent
try:
    import sys
    backend_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if backend_path not in sys.path:
        sys.path.insert(0, backend_path)
    from chat.chat import ChatAgentWithMemory
except ImportError:
    ChatAgentWithMemory = None

logger = logging.getLogger(__name__)

class CustomLogsHandler:
    """Custom handler to capture streaming logs from the research process"""
    def __init__(self, websocket, task: str):
        self.logs = []
        self.websocket = websocket
        sanitized_filename = sanitize_filename(f"task_{int(time.time())}_{task}")
        self.log_file = os.path.join("outputs", f"{sanitized_filename}.json")
        self.timestamp = datetime.now().isoformat()
        # Initialize log file with metadata
        os.makedirs("outputs", exist_ok=True)
        with open(self.log_file, 'w') as f:
            json.dump({
                "timestamp": self.timestamp,
                "events": [],
                "content": {
                    "query": "",
                    "sources": [],
                    "context": [],
                    "report": "",
                    "costs": 0.0
                }
            }, f, indent=2)

    async def send_json(self, data: Dict[str, Any]) -> None:
        """Store log data and send to websocket"""
        # Send to websocket for real-time display
        if self.websocket:
            await self.websocket.send_json(data)
            
        # Read current log file
        with open(self.log_file, 'r') as f:
            log_data = json.load(f)
            
        # Update appropriate section based on data type
        if data.get('type') == 'logs':
            log_data['events'].append({
                "timestamp": datetime.now().isoformat(),
                "type": "event",
                "data": data
            })
        else:
            # Update content section for other types of data
            log_data['content'].update(data)
            
        # Save updated log file
        with open(self.log_file, 'w') as f:
            json.dump(log_data, f, indent=2)


class Researcher:
    def __init__(self, query: str, report_type: str = "research_report"):
        self.query = query
        self.report_type = report_type
        # Generate unique ID for this research task
        self.research_id = f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{hash(query)}"
        # Initialize logs handler with research ID
        self.logs_handler = CustomLogsHandler(None, self.research_id)
        self.researcher = GPTResearcher(
            query=query,
            report_type=report_type,
            websocket=self.logs_handler
        )

    async def research(self) -> dict:
        """Conduct research and return paths to generated files"""
        await self.researcher.conduct_research()
        report = await self.researcher.write_report()
        
        # Generate the files
        sanitized_filename = sanitize_filename(f"task_{int(time.time())}_{self.query}")
        file_paths = await generate_report_files(report, sanitized_filename)
        
        # Get the JSON log path that was created by CustomLogsHandler
        json_relative_path = os.path.relpath(self.logs_handler.log_file)
        
        return {
            "output": {
                **file_paths,  # Include PDF, DOCX, and MD paths
                "json": json_relative_path
            }
        }

def sanitize_filename(filename: str) -> str:
    # Split into components
    prefix, timestamp, *task_parts = filename.split('_')
    task = '_'.join(task_parts)
    task_hash = hashlib.md5(task.encode('utf-8', errors='ignore')).hexdigest()[:10]
            
    # Reassemble and clean the filename
    sanitized = f"{prefix}_{timestamp}_{task_hash}"
    return re.sub(r"[^\w\s-]", "", sanitized).strip()


async def handle_start_command(websocket, data: str, manager):
    json_data = json.loads(data[6:])
    (
        task,
        report_type,
        source_urls,
        document_urls,
        tone,
        headers,
        report_source,
        query_domains,
        mcp_enabled,
        mcp_strategy,
        mcp_configs,
        max_search_results,
    ) = extract_command_data(json_data)

    if not task or not report_type:
        print("Error: Missing task or report_type")
        return

    # Create logs handler with websocket and task
    logs_handler = CustomLogsHandler(websocket, task)
    # Initialize log content with query
    await logs_handler.send_json({
        "query": task,
        "sources": [],
        "context": [],
        "report": ""
    })

    sanitized_filename = sanitize_filename(f"task_{int(time.time())}_{task}")

    report = await manager.start_streaming(
        task,
        report_type,
        report_source,
        source_urls,
        document_urls,
        tone,
        websocket,
        headers,
        query_domains,
        mcp_enabled,
        mcp_strategy,
        mcp_configs,
        max_search_results,
    )
    report = str(report)
    file_paths = await generate_report_files(report, sanitized_filename)
    # Add JSON log path to file_paths
    file_paths["json"] = os.path.relpath(logs_handler.log_file)
    await send_file_paths(websocket, file_paths)


async def handle_human_feedback(data: str):
    feedback_data = json.loads(data[14:])  # Remove "human_feedback" prefix
    print(f"Received human feedback: {feedback_data}")
    # TODO: Add logic to forward the feedback to the appropriate agent or update the research state


async def handle_chat_command(websocket, data: str):
    """Handle chat command from WebSocket."""
    try:
        # Parse chat data - format is "chat {json_data}"
        json_str = data[5:].strip()  # Remove "chat " prefix
        chat_data = json.loads(json_str)
        
        message = chat_data.get("message", "")
        report = chat_data.get("report", "")
        messages = chat_data.get("messages", [])
        
        # If only message is provided, convert to messages format
        if message and not messages:
            messages = [{"role": "user", "content": message}]
        
        if not messages:
            await websocket.send_json({
                "type": "chat",
                "content": "No message provided.",
                "role": "assistant"
            })
            return
        
        # Check if ChatAgentWithMemory is available
        if ChatAgentWithMemory is None:
            await websocket.send_json({
                "type": "chat",
                "content": "Chat functionality is not available. Please check the server configuration.",
                "role": "assistant"
            })
            return
        
        # Create chat agent with the report context
        chat_agent = ChatAgentWithMemory(
            report=report,
            config_path="default",
            headers=None
        )
        
        # Process the chat
        response_content, tool_calls_metadata = await chat_agent.chat(messages, websocket)
        
        # Send response back via WebSocket
        await websocket.send_json({
            "type": "chat",
            "content": response_content,
            "role": "assistant",
            "metadata": {
                "tool_calls": tool_calls_metadata
            } if tool_calls_metadata else None
        })
        
        logger.info(f"Chat response sent successfully")
        
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse chat data: {e}")
        await websocket.send_json({
            "type": "chat",
            "content": f"Error: Invalid message format - {str(e)}",
            "role": "assistant"
        })
    except Exception as e:
        logger.error(f"Error handling chat command: {e}\n{traceback.format_exc()}")
        await websocket.send_json({
            "type": "chat",
            "content": f"Error processing your message: {str(e)}",
            "role": "assistant"
        })

async def generate_report_files(report: str, filename: str) -> Dict[str, str]:
    pdf_path = await write_md_to_pdf(report, filename)
    docx_path = await write_md_to_word(report, filename)
    md_path = await write_text_to_md(report, filename)
    return {"pdf": pdf_path, "docx": docx_path, "md": md_path}


async def send_file_paths(websocket, file_paths: Dict[str, str]):
    await websocket.send_json({"type": "path", "output": file_paths})


def get_config_dict(
    langchain_api_key: str, openai_api_key: str, tavily_api_key: str,
    google_api_key: str, google_cx_key: str, bing_api_key: str,
    searchapi_api_key: str, serpapi_api_key: str, serper_api_key: str, searx_url: str
) -> Dict[str, str]:
    return {
        "LANGCHAIN_API_KEY": langchain_api_key or os.getenv("LANGCHAIN_API_KEY", ""),
        "OPENAI_API_KEY": openai_api_key or os.getenv("OPENAI_API_KEY", ""),
        "TAVILY_API_KEY": tavily_api_key or
```

### Core Architecture Module: `backend/utils.py`
```
import aiofiles
import urllib
import mistune
import os

async def write_to_file(filename: str, text: str) -> None:
    """Asynchronously write text to a file in UTF-8 encoding.

    Args:
        filename (str): The filename to write to.
        text (str): The text to write.
    """
    # Ensure text is a string
    if not isinstance(text, str):
        text = str(text)

    # Convert text to UTF-8, replacing any problematic characters
    text_utf8 = text.encode('utf-8', errors='replace').decode('utf-8')

    async with aiofiles.open(filename, "w", encoding='utf-8') as file:
        await file.write(text_utf8)

async def write_text_to_md(text: str, filename: str = "") -> str:
    """Writes text to a Markdown file and returns the file path.

    Args:
        text (str): Text to write to the Markdown file.

    Returns:
        str: The file path of the generated Markdown file.
    """
    import uuid

    safe_name = (filename or "").strip()[:60] or f"report-{uuid.uuid4().hex[:12]}"
    safe_name = safe_name.replace("/", "-").replace("\\", "-")
    os.makedirs("outputs", exist_ok=True)
    file_path = f"outputs/{safe_name}.md"
    await write_to_file(file_path, text)
    return urllib.parse.quote(file_path)

def _preprocess_images_for_pdf(text: str) -> str:
    """Convert web image URLs to absolute file paths for PDF generation.
    
    Transforms /outputs/images/... URLs to absolute file:// paths that
    weasyprint can resolve.
    """
    import re
    
    base_path = os.path.abspath(".")
    
    # Pattern to find markdown images with /outputs/ URLs
    def replace_image_url(match):
        alt_text = match.group(1)
        url = match.group(2)
        
        # Convert /outputs/... to absolute path
        if url.startswith("/outputs/"):
            abs_path = os.path.join(base_path, url.lstrip("/"))
            return f"![{alt_text}]({abs_path})"
        return match.group(0)
    
    # Match ![alt text](/outputs/images/...)
    pattern = r'!\[([^\]]*)\]\((/outputs/[^)]+)\)'
    return re.sub(pattern, replace_image_url, text)


async def write_md_to_pdf(text: str, filename: str = "") -> str:
    """Converts Markdown text to a PDF file and returns the file path.

    Args:
        text (str): Markdown text to convert.

    Returns:
        str: The encoded file path of the generated PDF.
    """
    import uuid

    # Empty / whitespace-only filename previously wrote "outputs/.pdf" which
    # confuses download UIs (#1718). Prefer a stable non-empty basename.
    safe_name = (filename or "").strip()[:60] or f"report-{uuid.uuid4().hex[:12]}"
    # Replace path separators to keep the PDF under outputs/.
    safe_name = safe_name.replace("/", "-").replace("\\", "-")
    os.makedirs("outputs", exist_ok=True)
    file_path = f"outputs/{safe_name}.pdf"

    try:
        # Resolve css path relative to this backend module to avoid
        # dependency on the current working directory.
        current_dir = os.path.dirname(os.path.abspath(__file__))
        css_path = os.path.join(current_dir, "styles", "pdf_styles.css")
        
        # Preprocess image URLs for PDF compatibility
        processed_text = _preprocess_images_for_pdf(text)
        
        # Set base_url to current directory for resolving any remaining relative paths
        base_url = os.path.abspath(".")
        from md2pdf.core import md2pdf
        md2pdf(
               file_path,
               raw=processed_text,
               css=css_path,
               base_url=base_url,
            )
        print(f"Report written to {file_path}")
    except Exception as e:
        print(f"Error in converting Markdown to PDF: {e}")
        return ""

    encoded_file_path = urllib.parse.quote(file_path)
    return encoded_file_path

async def write_md_to_word(text: str, filename: str = "") -> str:
    """Converts Markdown text to a DOCX file and returns the file path.

    Args:
        text (str): Markdown text to convert.

    Returns:
        str: The encoded file path of the generated DOCX.
    """
    import uuid

    safe_name = (filename or "").strip()[:60] or f"report-{uuid.uuid4().hex[:12]}"
    safe_name = safe_name.replace("/", "-").replace("\\", "-")
    os.makedirs("outputs", exist_ok=True)
    file_path = f"outputs/{safe_name}.docx"

    try:
        from docx import Document
        from htmldocx import HtmlToDocx
        # Convert report markdown to HTML
        html = mistune.html(text)
        # Create a document object
        doc = Document()
        # Convert the html generated from the report to document format
        HtmlToDocx().add_html_to_document(html, doc)

        # Saving the docx document to file_path
        doc.save(file_path)

        print(f"Report written to {file_path}")

        encoded_file_path = urllib.parse.quote(file_path)
        return encoded_file_path

    except Exception as e:
        print(f"Error in converting Markdown to DOCX: {e}")
        return ""
```

### Core Architecture Module: `frontend/nextjs/hooks/ResearchHistoryContext.tsx`
```
"use client";

import React, { createContext, useContext, ReactNode } from 'react';
import { useResearchHistory } from './useResearchHistory';
import { ResearchHistoryItem, Data, ChatMessage } from '../types/data';

// Define the shape of our context
interface ResearchHistoryContextType {
  history: ResearchHistoryItem[];
  loading: boolean;
  saveResearch: (question: string, answer: string, orderedData: Data[]) => Promise<string>;
  updateResearch: (id: string, answer: string, orderedData: Data[]) => Promise<boolean>;
  getResearchById: (id: string) => Promise<ResearchHistoryItem | null>;
  deleteResearch: (id: string) => Promise<boolean>;
  addChatMessage: (id: string, message: ChatMessage) => Promise<boolean>;
  getChatMessages: (id: string) => ChatMessage[];
  clearHistory: () => Promise<boolean>;
}

// Create the context with a default undefined value
const ResearchHistoryContext = createContext<ResearchHistoryContextType | undefined>(undefined);

// Provider component
export const ResearchHistoryProvider = ({ children }: { children: ReactNode }) => {
  // Use the hook only once here
  const researchHistory = useResearchHistory();
  
  return (
    <ResearchHistoryContext.Provider value={researchHistory}>
      {children}
    </ResearchHistoryContext.Provider>
  );
};

// Custom hook for consuming the context
export const useResearchHistoryContext = () => {
  const context = useContext(ResearchHistoryContext);
  
  if (context === undefined) {
    throw new Error('useResearchHistoryContext must be used within a ResearchHistoryProvider');
  }
  
  return context;
}; 
```

### Core Architecture Module: `frontend/nextjs/hooks/useAnalytics.ts`
```
import ReactGA from 'react-ga4';

interface ResearchData {
  query: string;
  report_type: string;
  report_source: string;
}

interface TrackResearchData {
  query: string;
  report_type: string;
  report_source: string;
}

export const useAnalytics = () => {
  const initGA = () => {
    if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID) {
      ReactGA.initialize(process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID);
    }
  };

  const trackResearchQuery = (data: TrackResearchData) => {
    ReactGA.event({
      category: 'Research',
      action: 'Submit Query',
      label: JSON.stringify({
        query: data.query,
        report_type: data.report_type,
        report_source: data.report_source
      })
    });
  };

  return {
    initGA,
    trackResearchQuery
  };
};
```

### Core Architecture Module: `frontend/nextjs/hooks/useResearchHistory.ts`
```
import { useState, useEffect, useRef } from 'react';
import { toast } from 'react-hot-toast';
import { v4 as uuidv4 } from 'uuid';
import { ResearchHistoryItem, Data, ChatMessage } from '../types/data';

export const useResearchHistory = () => {
  const [history, setHistory] = useState<ResearchHistoryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const dataLoadedRef = useRef(false); // Track if data has been loaded
  
  // Fetch all research history on mount
  useEffect(() => {
    // Skip if data is already loaded to prevent excessive API calls
    if (dataLoadedRef.current) {
      return;
    }

    const fetchHistory = async () => {
      try {
        console.log('Fetching research history from server...');
        // First, load data from localStorage for immediate display
        const localHistory = loadFromLocalStorage();
        
        // Set local history immediately to show something to user
        if (localHistory && localHistory.length > 0) {
          setHistory(localHistory);
        }
        
        // Then try to fetch from server, but only for items we have locally
        if (localHistory && localHistory.length > 0) {
          // Extract IDs from local history to filter server results
          const localIds = localHistory.map((item: ResearchHistoryItem) => item.id).join(',');
          console.log(`Sending ${localHistory.length} local IDs to server for filtering`);
          
          const response = await fetch(`/api/reports?report_ids=${localIds}`);
          if (response.ok) {
            const data = await response.json();
            
            // Check if the response has the expected structure
            if (data.reports && Array.isArray(data.reports)) {
              console.log('Loaded research history from server:', data.reports.length, 'items');
              
              // Merge local and server history
              await syncLocalHistoryWithServer(localHistory, data.reports);
            } else {
              console.warn('Server response did not contain reports array', data);
              // Keep using the local history we already loaded
            }
          } else {
            console.warn('Failed to load history from server, status:', response.status);
            // We're already using local history from above
          }
        } else {
          console.log('No local history found, skipping server fetch');
        }
      } catch (error) {
        console.error('Error fetching research history:', error);
        // We're already using local history from above
      } finally {
        dataLoadedRef.current = true; // Mark data as loaded
        setLoading(false);
      }
    };
    
    // Helper to load from localStorage
    const loadFromLocalStorage = () => {
      const localHistoryStr = localStorage.getItem('researchHistory');
      if (localHistoryStr) {
        try {
          const parsedHistory = JSON.parse(localHistoryStr);
          if (Array.isArray(parsedHistory)) {
            console.log('Loaded research history from localStorage:', parsedHistory.length, 'items');
            return parsedHistory;
          } else {
            console.warn('localStorage history is not an array');
            return [];
          }
        } catch (error) {
          console.error('Error parsing localStorage history:', error);
          return [];
        }
      } else {
        return [];
      }
    };
    
    // Helper to sync local history with server
    const syncLocalHistoryWithServer = async (localHistory: ResearchHistoryItem[], serverHistory: ResearchHistoryItem[]) => {
      console.log('Syncing local history with server...');
      
      // Create a map of server history IDs for quick lookup
      const serverIds = new Set(serverHistory.map(item => item.id));
      
      // Find local reports that aren't on the server
      const localOnlyReports = localHistory.filter(item => !serverIds.has(item.id));
      console.log('Found local-only reports:', localOnlyReports.length);
      
      // Upload local-only reports to server
      for (const report of localOnlyReports) {
        try {
          // Skip reports without questions or answers
          if (!report.question || !report.answer) continue;
          
          console.log(`Uploading local report to server: ${report.id}`);
          
          const response = await fetch('/api/reports', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              id: report.id,
              question: report.question,
              answer: report.answer,
              orderedData: report.orderedData || [],
              chatMessages: report.chatMessages || []
            }),
          });
          
          if (!response.ok) {
            console.warn(`Failed to upload local report ${report.id} to server:`, response.status);
          }
        } catch (error) {
          console.error(`Error uploading local report ${report.id} to server:`, error);
        }
      }
      
      // Create a unified history with server data prioritized
      const combinedHistory = [...serverHistory];
      
      // Add local-only reports to the combined history
      for (const report of localOnlyReports) {
        if (!serverIds.has(report.id)) {
          combinedHistory.push(report);
        }
      }
      
      // Sort by timestamp if available, newest first
      const sortedHistory = combinedHistory.sort((a, b) => {
        const timeA = a.timestamp || 0;
        const timeB = b.timestamp || 0;
        return timeB - timeA;
      });
      
      setHistory(sortedHistory);
      
      // Update localStorage with the complete merged set
      localStorage.setItem('researchHistory', JSON.stringify(sortedHistory));
      
      console.log('History sync complete, total items:', sortedHistory.length);
    };
    
    fetchHistory();
  }, []); // Empty dependency array - only run once on mount
  
  // Save new research
  const saveResearch = async (question: string, answer: string, orderedData: Data[]) => {
    try {
      // Generate a unique ID
      const id = uuidv4();
      
      // Save to backend
      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id,
          question,
          answer,
          orderedData,
          chatMessages: []
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        const newId = data.id;
        
        // Update local state
        const newResearch = {
          id: newId,
          question,
          answer,
          orderedData,
          chatMessages: [],
          timestamp: Date.now(),
        };
        
        setHistory(prev => [newResearch, ...prev]);
        
        // Also save to localStorage as fallback
        const localHistory = localStorage.getItem('researchHistory');
        const parsedHistory = localHistory ? JSON.parse(localHistory) : [];
        localStorage.setItem(
          'researchHistory',
          JSON.stringify([newResearch, ...parsedHistory])
        );
        
        return newId;
      } else {
        throw new Error(`API error: ${response.status}`);
      }
    } catch (error) {
      console.error('Error saving research:', error);
      toast.error('Failed to save research to server. Saved locally only.');
      
      // Fallback: save to localStorage only
      const newResearch = {
        id: uuidv4(),
        question,
        answer,
        orderedData,
        chatMessages: [],
        timestamp: Date.now(),
      };
      
      // Update local state
      setHistory(prev => [newResearch, ...prev]);
      
      // Save to localStorage
      const localHistory = localStorage.getItem('researchHistory');
      const parsedHistory = localHistory ? JSON.parse(localHistory) : [];
      localStorage.setItem(
        'researchHistory',
        JSON.stringify([newResearch, ...parsedHistory])
      );
      
      return newResearch.id;
    }
  };
  
  // Update existing research
  const updateResearch = async (id: string, answer: string, orderedData: Data[]) => {
    try {
      // Update in backend
      const response = await fetch(`/api/reports/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          answer,
          orderedData
        }),
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      // Update local state
      setHistory(prev => 
        prev.map(item => 
          item.id === id ? { ...item, answer, orderedData, timestamp: Date.now() } : item
        )
      );
      
      // Also update localStorage as fallback
      const localHistory = localStorage.getItem('researchHistory');
      if (localHistory) {
        const parsedHistory = JSON.parse(localHistory);
        const updatedHistory = parsedHistory.map((item: any) => 
          item.id === id ? { ...item, answer, orderedData, timestamp: Date.now() } : item
        );
        localStorage.setItem('researchHistory', JSON.stringify(updatedHistory));
      }
      
      return true;
    } catch (error) {
      console.error('Error updating research:', error);
      
      // Update local state anyway
      setHistory(prev => 
        prev.map(item => 
          item.id === id ? { ...item, answer, orderedData, timestamp: Date.now() } : item
        )
      );
      
      // Update localStorage
      const localHistory = localStorage.getItem('researchHistory');
      if (localHistory) {
        const parsedHistory = JSON.parse(localHistory);
        const updatedHistory = parsedHistory.map((item: any) => 
          item.id === id ? { ...item, answer, orderedData, timestamp: Date.n
```

### Core Architecture Module: `frontend/nextjs/hooks/useScrollHandler.ts`
```
import { useState, useEffect, useCallback, RefObject } from 'react';

export function useScrollHandler(
  mainContentRef: RefObject<HTMLDivElement>
) {
  const [showScrollButton, setShowScrollButton] = useState(false);

  const handleScroll = useCallback(() => {
    // Calculate if we're near bottom (within 100px)
    const scrollPosition = window.scrollY + window.innerHeight;
    const nearBottom = scrollPosition >= document.documentElement.scrollHeight - 100;
    
    // Show button if we're not near bottom and page is scrollable
    const isPageScrollable = document.documentElement.scrollHeight > window.innerHeight;
    setShowScrollButton(isPageScrollable && !nearBottom);
  }, []);

  const scrollToBottom = () => {
    window.scrollTo({
      top: document.documentElement.scrollHeight,
      behavior: 'smooth'
    });
  };

  // Add ResizeObserver to watch for content changes
  useEffect(() => {
    const mainContentElement = mainContentRef.current;
    const resizeObserver = new ResizeObserver(() => {
      handleScroll();
    });

    if (mainContentElement) {
      resizeObserver.observe(mainContentElement);
    }

    window.addEventListener('scroll', handleScroll);
    window.addEventListener('resize', handleScroll);
    
    return () => {
      if (mainContentElement) {
        resizeObserver.unobserve(mainContentElement);
      }
      resizeObserver.disconnect();
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, [handleScroll, mainContentRef]);

  return {
    showScrollButton,
    scrollToBottom
  };
} 
```

### Core Architecture Module: `frontend/nextjs/hooks/useWebSocket.ts`
```
import { useRef, useState, useEffect, useCallback } from 'react';
import { Data, ChatBoxSettings, QuestionData } from '../types/data';
import { getHost } from '../helpers/getHost';

export const useWebSocket = (
  setOrderedData: React.Dispatch<React.SetStateAction<Data[]>>,
  setAnswer: React.Dispatch<React.SetStateAction<string>>, 
  setLoading: React.Dispatch<React.SetStateAction<boolean>>,
  setShowHumanFeedback: React.Dispatch<React.SetStateAction<boolean>>,
  setQuestionForHuman: React.Dispatch<React.SetStateAction<boolean | true>>
) => {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const heartbeatInterval = useRef<number>();

  // Cleanup function for heartbeat and socket on unmount
  useEffect(() => {
    return () => {
      // Clear heartbeat interval
      if (heartbeatInterval.current) {
        clearInterval(heartbeatInterval.current);
      }
      
      // Close socket on unmount if it exists and is open
      if (socket && socket.readyState === WebSocket.OPEN) {
        console.log('Closing WebSocket due to component unmount');
        socket.close(1000, "Component unmounted");
      }
    };
  }, [socket]);

  const startHeartbeat = (ws: WebSocket) => {
    // Clear any existing heartbeat
    if (heartbeatInterval.current) {
      clearInterval(heartbeatInterval.current);
    }
    
    // Start new heartbeat
    heartbeatInterval.current = window.setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send('ping');
      }
    }, 30000); // Send ping every 30 seconds
  };

  const initializeWebSocket = useCallback((
    promptValue: string, 
    chatBoxSettings: ChatBoxSettings
  ) => {
    // Close existing socket if any
    if (socket && socket.readyState === WebSocket.OPEN) {
      console.log('Closing existing WebSocket connection');
      socket.close(1000, "New connection requested");
    }

    const storedConfig = localStorage.getItem('apiVariables');
    const apiVariables = storedConfig ? JSON.parse(storedConfig) : {};

    if (typeof window !== 'undefined') {
      
      let fullHost = getHost()
      const protocol = fullHost.includes('https') ? 'wss:' : 'ws:'
      const cleanHost = fullHost.replace('http://', '').replace('https://', '')
      const ws_uri = `${protocol}//${cleanHost}/ws`

      console.log(`Creating new WebSocket connection to ${ws_uri}`);
      const newSocket = new WebSocket(ws_uri);
      setSocket(newSocket);

      // WebSocket connection opened handler
      newSocket.onopen = () => {
        console.log('WebSocket connection opened');
        
        const domainFilters = JSON.parse(localStorage.getItem('domainFilters') || '[]');
        const domains = domainFilters ? domainFilters.map((domain: any) => domain.value) : [];
        const { report_type, report_source, tone, mcp_enabled, mcp_configs, mcp_strategy } = chatBoxSettings;
        
        // Start a new research
        try {
          console.log(`Starting new research for: ${promptValue}`);
          const dataToSend = { 
            task: promptValue,
            report_type, 
            report_source, 
            tone,
            query_domains: domains,
            mcp_enabled: mcp_enabled || false,
            mcp_strategy: mcp_strategy || "fast",
            mcp_configs: mcp_configs || []
          };
          
          // Make sure we have a properly formatted command with a space after start
          const message = `start ${JSON.stringify(dataToSend)}`;
          console.log(`Sending start message, length: ${message.length}`);
          newSocket.send(message);
        } catch (error) {
          console.error("Error preparing start message:", error);
        }
        
        startHeartbeat(newSocket);
      };

      newSocket.onmessage = (event) => {
        try {
          // Handle ping response
          if (event.data === 'pong') return;

          // Try to parse JSON data
          console.log(`Received WebSocket message: ${event.data.substring(0, 100)}...`);
          const data = JSON.parse(event.data);
          
          if (data.type === 'error') {
            console.error(`Server error: ${data.output}`);
          } else if (data.type === 'human_feedback' && data.content === 'request') {
            setQuestionForHuman(data.output);
            setShowHumanFeedback(true);
          } else {
            const contentAndType = `${data.content}-${data.type}`;
            setOrderedData((prevOrder) => [...prevOrder, { ...data, contentAndType }]);

            if (data.type === 'report') {
              setAnswer((prev: string) => prev + data.output);
            } else if (data.type === 'report_complete') {
              // Replace entire report with the complete version (includes images)
              console.log('Received complete report with images');
              setAnswer(data.output);
            } else if (data.type === 'path') {
              setLoading(false);
            }
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error, event.data);
        }
      };

      newSocket.onclose = (event) => {
        console.log(`WebSocket connection closed: code=${event.code}, reason=${event.reason}`);
        if (heartbeatInterval.current) {
          clearInterval(heartbeatInterval.current);
        }
        setSocket(null);
      };

      newSocket.onerror = (error) => {
        console.error('WebSocket error:', error);
        if (heartbeatInterval.current) {
          clearInterval(heartbeatInterval.current);
        }
      };
    }
  }, [socket, setOrderedData, setAnswer, setLoading, setShowHumanFeedback, setQuestionForHuman]);

  return { socket, setSocket, initializeWebSocket };
};
```

### Core Architecture Module: `frontend/nextjs/src/utils/imageTransformPlugin.js`
```
// imageTransformPlugin.js
export default function imageTransformPlugin() {
  return {
    name: 'image-transform',
    transform(code) {
      // Add more patterns to catch different image path formats
      return code.replace(
        /['"]\/img\/([^'"]+)['"]/g,  // Also catch paths starting with /
        "'https://gptr.app/img/$1'"
      ).replace(
        /['"]img\/([^'"]+)['"]/g,    // Catch relative paths
        "'https://gptr.app/img/$1'"
      );
    }
  };
}
```

### Core Architecture Module: `frontend/nextjs/utils/consolidateBlocks.ts`
```
export const consolidateSourceAndImageBlocks = (groupedData: any[]) => {
  // Consolidate sourceBlocks
  const consolidatedSourceBlock = {
    type: 'sourceBlock',
    items: groupedData
      .filter(item => item.type === 'sourceBlock')
      .flatMap(block => block.items || [])
      .filter((item, index, self) => 
        index === self.findIndex(t => t.url === item.url)
      )
  };

  // Consolidate imageBlocks
  const consolidatedImageBlock = {
    type: 'imagesBlock',
    metadata: groupedData
      .filter(item => item.type === 'imagesBlock')
      .flatMap(block => block.metadata || [])
  };

  // Remove all existing sourceBlocks and imageBlocks
  groupedData = groupedData.filter(item => 
    item.type !== 'sourceBlock' && item.type !== 'imagesBlock'
  );

  // Add consolidated blocks if they have items
  if (consolidatedSourceBlock.items.length > 0) {
    groupedData.push(consolidatedSourceBlock);
  }
  if (consolidatedImageBlock.metadata.length > 0) {
    groupedData.push(consolidatedImageBlock);
  }

  return groupedData;
};
```

### Core Architecture Module: `frontend/nextjs/utils/dataProcessing.ts`
```
import { Data } from '../types/data';
import { consolidateSourceAndImageBlocks } from './consolidateBlocks';

export const preprocessOrderedData = (data: Data[]) => {
  let groupedData: any[] = [];
  let currentAccordionGroup: any = null;
  let currentSourceGroup: any = null;
  let currentReportGroup: any = null;
  let finalReportGroup: any = null;
  let sourceBlockEncountered = false;
  let lastSubqueriesIndex = -1;
  const seenUrls = new Set<string>();
  // console.log('websocket data before its processed',data)

  data.forEach((item: any) => {
    const { type, content, metadata, output, link } = item;

    if (type === 'question') {
      groupedData.push({ type: 'question', content });
    } else if (type === 'report') {
      // Start a new report group if we don't have one
      if (!currentReportGroup) {
        currentReportGroup = { type: 'reportBlock', content: '' };
        groupedData.push(currentReportGroup);
      }
      currentReportGroup.content += output;
    } else if (type === 'report_complete') {
      // Replace entire report content with the complete version (includes images)
      if (currentReportGroup) {
        currentReportGroup.content = output;
      } else {
        currentReportGroup = { type: 'reportBlock', content: output };
        groupedData.push(currentReportGroup);
      }
    } else if (content === 'selected_images') {
      groupedData.push({ type: 'imagesBlock', metadata });
    } else if (type === 'logs' && content === 'research_report') {
      if (!finalReportGroup) {
        finalReportGroup = { type: 'reportBlock', content: '' };
        groupedData.push(finalReportGroup);
      }
      finalReportGroup.content += output.report;
    } else if (type === 'langgraphButton') {
      groupedData.push({ type: 'langgraphButton', link });
    } else if (type === 'chat') {
      groupedData.push({ type: 'chat', content: content });
    } else {
      if (currentReportGroup) {
        currentReportGroup = null;
      }

      if (content === 'subqueries') {
        if (currentAccordionGroup) {
          currentAccordionGroup = null;
        }
        if (currentSourceGroup) {
          groupedData.push(currentSourceGroup);
          currentSourceGroup = null;
        }
        groupedData.push(item);
        lastSubqueriesIndex = groupedData.length - 1;
      } else if (type === 'sourceBlock') {
        currentSourceGroup = item;
        if (lastSubqueriesIndex !== -1) {
          groupedData.splice(lastSubqueriesIndex + 1, 0, currentSourceGroup);
          lastSubqueriesIndex = -1;
        } else {
          groupedData.push(currentSourceGroup);
        }
        sourceBlockEncountered = true;
        currentSourceGroup = null;
      } else if (content === 'added_source_url') {
        if (!currentSourceGroup) {
          currentSourceGroup = { type: 'sourceBlock', items: [] };
        }
      
        if (!seenUrls.has(metadata)) {
          seenUrls.add(metadata);
          let hostname = "";
          try {
            if (typeof metadata === 'string') {
              hostname = new URL(metadata).hostname.replace('www.', '');
            }
          } catch (e) {
            hostname = "unknown";
          }
          currentSourceGroup.items.push({ name: hostname, url: metadata });
        }
      
        // Add this block to ensure the source group is added to groupedData
        if (currentSourceGroup.items.length > 0 && !groupedData.includes(currentSourceGroup)) {
          groupedData.push(currentSourceGroup);
          sourceBlockEncountered = true;
        }
      } else if (type !== 'path' && content !== '') {
        if (sourceBlockEncountered) {
          if (!currentAccordionGroup) {
            currentAccordionGroup = { type: 'accordionBlock', items: [] };
            groupedData.push(currentAccordionGroup);
          }
          currentAccordionGroup.items.push(item);
        } else {
          groupedData.push(item);
        }
      } else {
        if (currentAccordionGroup) {
          currentAccordionGroup = null;
        }
        if (currentSourceGroup) {
          currentSourceGroup = null;
        }
        if (currentReportGroup) {
          // Find and remove the previous reportBlock
          const reportBlockIndex = groupedData.findIndex(
            item => item === currentReportGroup
          );
          if (reportBlockIndex !== -1) {
            groupedData.splice(reportBlockIndex, 1);
          }
          currentReportGroup = null;  // Reset the current report group
        }
        groupedData.push(item);
      }
    }
  });

  groupedData = consolidateSourceAndImageBlocks(groupedData);
  return groupedData;
}; 
```

### Core Architecture Module: `frontend/nextjs/utils/getLayout.tsx`
```
import React, { useState, useEffect } from 'react';
import ResearchPageLayout from '@/components/layouts/ResearchPageLayout';
import CopilotLayout from '@/components/layouts/CopilotLayout';
import MobileLayout from '@/components/layouts/MobileLayout';
import { ChatBoxSettings } from '@/types/data';

interface LayoutProps {
  children: React.ReactNode;
  loading: boolean;
  isStopped: boolean;
  showResult: boolean;
  onStop?: () => void;
  onNewResearch?: () => void;
  chatBoxSettings: ChatBoxSettings;
  setChatBoxSettings: React.Dispatch<React.SetStateAction<ChatBoxSettings>>;
  mainContentRef?: React.RefObject<HTMLDivElement>;
  showScrollButton?: boolean;
  onScrollToBottom?: () => void;
  toastOptions?: Record<string, any>;
  toggleSidebar?: () => void;
  isProcessingChat?: boolean;
}

export const getAppropriateLayout = ({
  children,
  loading,
  isStopped,
  showResult,
  onStop,
  onNewResearch,
  chatBoxSettings,
  setChatBoxSettings,
  mainContentRef,
  showScrollButton = false,
  onScrollToBottom,
  toastOptions = {},
  toggleSidebar,
  isProcessingChat = false
}: LayoutProps) => {
  const [isMobile, setIsMobile] = useState(false);
  
  // Check if we're on mobile on client-side
  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    // Initial check
    checkIfMobile();
    
    // Add event listener for window resize
    window.addEventListener('resize', checkIfMobile);
    
    // Cleanup
    return () => window.removeEventListener('resize', checkIfMobile);
  }, []);
  
  // If on mobile, use the mobile layout
  if (isMobile) {
    return (
      <MobileLayout
        loading={loading}
        isStopped={isStopped}
        showResult={showResult}
        onStop={onStop}
        onNewResearch={onNewResearch}
        chatBoxSettings={chatBoxSettings}
        setChatBoxSettings={setChatBoxSettings}
        mainContentRef={mainContentRef}
        toastOptions={toastOptions}
        toggleSidebar={toggleSidebar}
      >
        {children}
      </MobileLayout>
    );
  }
  
  // For desktop, use either the copilot or research layout based on settings
  if (chatBoxSettings.layoutType === 'copilot') {
    return (
      <CopilotLayout
        loading={loading}
        isStopped={isStopped}
        showResult={showResult}
        onStop={onStop}
        onNewResearch={onNewResearch}
        chatBoxSettings={chatBoxSettings}
        setChatBoxSettings={setChatBoxSettings}
        mainContentRef={mainContentRef}
        toastOptions={toastOptions}
        toggleSidebar={toggleSidebar}
      >
        {children}
      </CopilotLayout>
    );
  }
  
  // Default to ResearchPageLayout for desktop with standard layout
  return (
    <ResearchPageLayout
      loading={loading}
      isStopped={isStopped}
      showResult={showResult}
      onStop={onStop}
      onNewResearch={onNewResearch || (() => {})}
      chatBoxSettings={chatBoxSettings}
      setChatBoxSettings={setChatBoxSettings}
      mainContentRef={mainContentRef}
      showScrollButton={showScrollButton}
      onScrollToBottom={onScrollToBottom}
      toastOptions={toastOptions}
    >
      {children}
    </ResearchPageLayout>
  );
}; 
```

### Core Architecture Module: `gpt_researcher/actions/utils.py`
```
from typing import Dict, Any, Callable
from ..utils.logger import get_formatted_logger

logger = get_formatted_logger()


async def stream_output(
    type, content, output, websocket=None, output_log=True, metadata=None
):
    """
    Streams output to the websocket
    Args:
        type:
        content:
        output:

    Returns:
        None
    """
    if (not websocket or output_log) and type != "images":
        try:
            logger.info(f"{output}")
        except UnicodeEncodeError:
            # Option 1: Replace problematic characters with a placeholder
            logger.error(output.encode(
                'cp1252', errors='replace').decode('cp1252'))

    if websocket:
        await websocket.send_json(
            {"type": type, "content": content,
                "output": output, "metadata": metadata}
        )


async def safe_send_json(websocket: Any, data: Dict[str, Any]) -> None:
    """
    Safely send JSON data through a WebSocket connection.

    Args:
        websocket (WebSocket): The WebSocket connection to send data through.
        data (Dict[str, Any]): The data to send as JSON.

    Returns:
        None
    """
    try:
        await websocket.send_json(data)
    except Exception as e:
        error_type = type(e).__name__
        error_msg = str(e)
        logger.error(
            f"Error sending JSON through WebSocket: {error_type}: {error_msg}",
            exc_info=True
        )
        # Check for common WebSocket errors and provide helpful context
        if "closed" in error_msg.lower() or "connection" in error_msg.lower():
            logger.warning("WebSocket connection appears to be closed. Client may have disconnected.")
        elif "timeout" in error_msg.lower():
            logger.warning("WebSocket send operation timed out. The client may be unresponsive.")


def calculate_cost(
    prompt_tokens: int,
    completion_tokens: int,
    model: str
) -> float:
    """
    Calculate the cost of API usage based on the number of tokens and the model used.

    Args:
        prompt_tokens (int): Number of tokens in the prompt.
        completion_tokens (int): Number of tokens in the completion.
        model (str): The model used for the API call.

    Returns:
        float: The calculated cost in USD.
    """
    try:
        prompt_tokens = int(prompt_tokens or 0)
        completion_tokens = int(completion_tokens or 0)
    except (TypeError, ValueError):
        logger.warning(
            "Invalid token counts for cost calculation "
            f"(prompt={prompt_tokens!r}, completion={completion_tokens!r}); treating as 0."
        )
        prompt_tokens = 0
        completion_tokens = 0
    if prompt_tokens < 0:
        prompt_tokens = 0
    if completion_tokens < 0:
        completion_tokens = 0
    if not isinstance(model, str) or not model:
        model = ""

    # Define cost per 1k tokens for different models
    costs = {
        "gpt-3.5-turbo": 0.002,
        "gpt-4": 0.03,
        "gpt-4-32k": 0.06,
        "gpt-4o": 0.00001,
        "gpt-4o-mini": 0.000001,
        "o3-mini": 0.0000005,
        # Add more models and their costs as needed
    }

    model = model.lower()
    if model not in costs:
        logger.warning(
            f"Unknown model: {model}. Cost calculation may be inaccurate.")
        return 0.0001 # Default avg cost if model is unknown

    cost_per_1k = costs[model]
    total_tokens = prompt_tokens + completion_tokens
    return (total_tokens / 1000) * cost_per_1k


def format_token_count(count: int) -> str:
    """
    Format the token count with commas for better readability.

    Args:
        count (int): The token count to format.

    Returns:
        str: The formatted token count.
    """
    try:
        value = int(count or 0)
    except (TypeError, ValueError):
        return "0"
    return f"{value:,}"


async def update_cost(
    prompt_tokens: int,
    completion_tokens: int,
    model: str,
    websocket: Any
) -> None:
    """
    Update and send the cost information through the WebSocket.

    Args:
        prompt_tokens (int): Number of tokens in the prompt.
        completion_tokens (int): Number of tokens in the completion.
        model (str): The model used for the API call.
        websocket (WebSocket): The WebSocket connection to send data through.

    Returns:
        None
    """
    cost = calculate_cost(prompt_tokens, completion_tokens, model)
    total_tokens = prompt_tokens + completion_tokens

    await safe_send_json(websocket, {
        "type": "cost",
        "data": {
            "total_tokens": format_token_count(total_tokens),
            "prompt_tokens": format_token_count(prompt_tokens),
            "completion_tokens": format_token_count(completion_tokens),
            "total_cost": f"${cost:.4f}"
        }
    })


def create_cost_callback(websocket: Any) -> Callable:
    """
    Create a callback function for updating costs.

    Args:
        websocket (WebSocket): The WebSocket connection to send data through.

    Returns:
        Callable: A callback function that can be used to update costs.
    """
    async def cost_callback(
        prompt_tokens: int,
        completion_tokens: int,
        model: str
    ) -> None:
        await update_cost(prompt_tokens, completion_tokens, model, websocket)

    return cost_callback

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1684** (2026-09-26): **Feature request: anybrowse MCP integration for Cloudflare-protected scraping**
  *Symptoms*: ## Problem  GPT-Researcher's web retrieval fails silently on Cloudflare-protected sites (major news outlets, LinkedIn, Amazon, government sites). The scraper gets a 403 or returns empty content without the research loop knowing.  ## Proposed integration  [anybrowse](https://anybrowse.dev) is an MCP-native web scraper with Cloudflare bypass via residential Chrome. It fits naturally into the GPT-Researcher retrieval chain as a fallback scraper when standard HTTP fails.  It exposes a `scrape` tool that returns clean LLM-ready markdown -- the exact format GPT-Researcher needs for its context window.  ## Quick test  Add as an MCP server:  ```json {   "mcpServers": {     "anybrowse": {       "type": "streamable-http",       "url": "https://anybrowse.dev/mcp"     }   } } ```  Then: "Research the latest AI regulation news from EU government sites" -- anybrowse handles the Cloudflare-protected `.europa.eu` domains that standard scrapers bounce off.  ## Details  - Free tier: 10 scrapes/day, no API key - Paid: $5 for 3,000 credits (never expire) - MCP tools: `scrape`, `crawl`, `batch_scrape`, `extract`, `search` - Docs: https://anybrowse.dev/docs  Would be happy to contribute a retriever class if this seems like a good fit for the project.
  **Post-Mortem & Fix Analysis**:
  > The specific third-party tool is outside the project's scope, but the underlying problem you're describing is valid: scrapers can silently fail on Cloudflare-protected (HTTP 403) pages instead of surfacing a clear error or falling back. I'm relabeling this as a bug to track that generic behavior — a clearer error / fallback path on 403 would be the right fix. Thanks for flagging it. 
  > This bug is important for AI agent reliability.  From my 28+ iteration rounds building self-evolving AI systems, I've learned that robust error handling and clear failure modes are critical for production AI.  Key insight: AI systems should fail gracefully with clear error messages, not crash silently. This builds user trust and makes debugging easier.  I build AI automation systems and share my experience at github.com/zzhzhangzhihao/hermes-skill-system  Happy to help if useful.
  > Partially addressed on current `main`, and worth re-reading with that in mind.  The specific failure you described — *"the scraper gets a 403 or returns empty content **without the research loop knowing**"* — is the part that got fixed. #2074 added anti-bot/challenge-page detection to `scraper.py`: pages matching known challenge markers (Cloudflare's *"Attention Required"*, *"Sorry, you have been blocked"*, Anubis proof-of-work, and others) are now rejected as fetch failures and logged, instead of being ingested as if they were article text. Previously they landed in the report context as real content.  What is **not** addressed is actually retrieving those pages. That still needs a scraper backend that can get past the challenge — which is what this issue asks for, and what draft PR #1786 proposes from a different angle. Keeping this open for that.

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

### Incident Patch 1: `6cbfc867` (2026-09-26)
**Commit Message**: docs: current model leaderboard; fix the docs build on fresh installs

- Configuration page: replace the November 2023 leaderboard image
  (GPT-4, Claude 2, PaLM 2) and the "OpenAI still stands as the
  superior LLM" paragraph with a markdown table from Vectara's
  Hallucination Leaderboard (updated 2026-09-22, HHEM-2.3): 22 models
  GPT Researcher can use, across nine providers, with what the
  benchmark does and doesn't measure. The unused image is removed.
- README: drop "Report chat uses the same filter."
- Docs build: a fresh `npm install` failed. With no lockfile it pulled
  webpack 5.111, whose ProgressPlugin rejects options Docusaurus 3.7
  passes, and @easyops-cn/docusaurus-search-local pulled a second,
  3.10.2 copy of the Docusaurus packages, which broke Mermaid pages
  during SSG (ReactContextError in useColorMode). Upgrade Docusaurus
  to 3.10.2, the version the search plugin already resolves, so the
  tree has one copy. Verified with a clean install and a full build.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `README.md` (modified, +1/-1)
```diff
@@ -238,7 +238,7 @@ Every research run scrapes dozens of pages, and only some of each page helps ans
 
 Writing the report takes ~45s whichever filter you use, so a run's total time moves only by the filter step. Passing every page unfiltered writes the broadest reports on open-ended questions, but costs 65% more.
 
-**Nothing is required.** With a `TYPESAFE_API_KEY`, Jev is used. Without one, or if a Jev call fails, GPT Researcher falls back to keyword (BM25) ranking, which runs locally with no API key, model or embeddings. Embeddings remain available as an option. Report chat uses the same filter.
+**Nothing is required.** With a `TYPESAFE_API_KEY`, Jev is used. Without one, or if a Jev call fails, GPT Researcher falls back to keyword (BM25) ranking, which runs locally with no API key, model or embeddings. Embeddings remain available as an option.
 
 ```bash
 export TYPESAFE_API_KEY=...   # use Jev (the default when a key is set)
```

**File**: `docs/docs/gpt-researcher/gptr/config.md` (modified, +35/-5)
```diff
@@ -7,11 +7,41 @@ In addition, GPT Researcher can be tailored to various report formats (such as A
 
 GPT Researcher defaults to our recommended suite of integrations: [OpenAI](https://platform.openai.com/docs/overview) for LLM calls and [Tavily API](https://app.tavily.com) for retrieving real-time web information.
 
-As seen below, OpenAI still stands as the superior LLM. We assume it will stay this way for some time, and that prices will only continue to decrease, while performance and speed increase over time.
-
-<div style={{ marginBottom: '10px' }}>
-<img align="center" height="350" src="/img/leaderboard.png" />
-</div>
+## Choosing an LLM
+
+GPT Researcher's writer turns scraped sources into a report, so how faithfully a model sticks to its sources matters more than general benchmark scores. The table below comes from Vectara's [Hallucination Leaderboard](https://github.com/vectara/hallucination-leaderboard), which has each model summarize 7,700+ articles (news, science, medicine, law, business and more) using only the source text, then checks every summary for claims the source doesn't support with the HHEM-2.3 evaluation model.
+
+A selection of models you can configure in GPT Researcher, ordered by hallucination rate (lower is better). Data as of September 22, 2026; see the leaderboard for all 100+ models.
+
+| Model | Provider | Hallucination rate | Factual consistency | Answer rate |
+|---|---|---:|---:|---:|
+| GPT-5.4 nano | OpenAI | 3.1% | 96.9% | 100.0% |
+| Gemini 2.5 Flash-Lite | Google | 3.3% | 96.7% | 99.5% |
+| Llama 3.3 70B | Meta | 4.1% | 95.9% | 99.5% |
+| Mistral Large (24.11) | Mistral | 4.5% | 95.5% | 99.9% |
+| GPT-5.4 mini | OpenAI | 5.5% | 94.5% | 100.0% |
+| GPT-4.1 | OpenAI | 5.6% | 94.4% | 99.9% |
+| DeepSeek V3.2 | DeepSeek | 6.3% | 93.7% | 92.6% |
+| GPT-6 Sol | OpenAI | 6.5% | 93.5% | 100.0% |
+| GPT-5.4 | OpenAI | 7.0% | 93.0% | 99.9% |
+| Gemini 2.5 Pro | Google | 7.0% | 93.0% | 99.1% |
+| Gemini 2.5 Flash | Google | 7.8% | 92.2% | 99.0% |
+| Llama 4 Maverick | Meta | 8.2% | 91.8% | 100.0% |
+| DeepSeek V4 Pro | DeepSeek | 8.6% | 91.4% | 97.2% |
+| GPT-5.5 | OpenAI | 9.3% | 90.7% | 100.0% |
+| Claude Haiku 4.5 | Anthropic | 9.8% | 90.2% | 99.5% |
+| Gemini 3.1 Pro (preview) | Google | 10.4% | 89.6% | 99.4% |
+| Claude Sonnet 4.6 | Anthropic | 10.6% | 89.4% | 99.9% |
+| Qwen 3.5 Plus | Alibaba | 10.7% | 89.3% | 99.8% |
+| Kimi K2.6 | Moonshot | 10.8% | 89.2% | 99.7% |
+| Claude Opus 4.7 | Anthropic | 12.0% | 88.0% | 98.0% |
+| gpt-oss-120b | OpenAI | 14.2% | 85.8% | 99.9% |
+| Grok 4.1 Fast | xAI | 17.8% | 82.2% | 98.5% |
+
+- **Hallucination rate**: share of summaries containing a claim not supported by the source.
+- **Answer rate**: share of articles the model agreed to summarize.
+
+GPT Researcher defaults to `gpt-5.4` for `SMART_LLM` and `STRATEGIC_LLM`, and `gpt-5.4-mini` for `FAST_LLM`. This benchmark measures faithfulness to sources, not reasoning or writing quality: smaller models often rank well here partly because their summaries add less. Use it to narrow your choice, then compare reports on your own queries (see [Testing your LLM](../llms/testing-your-llm.md)).
 
 The default config.py file can be found in `/gpt_researcher/config/`. It supports various options for customizing GPT Researcher to your needs.
 You can also include your own external JSON file `config.json` by adding the path in the `config_path` param.
```

**File**: `docs/package.json` (modified, +3/-3)
```diff
@@ -25,9 +25,9 @@
     "write-heading-ids": "docusaurus write-heading-ids"
   },
   "dependencies": {
-    "@docusaurus/core": "3.7.0",
-    "@docusaurus/preset-classic": "3.7.0",
-    "@docusaurus/theme-mermaid": "3.7.0",
+    "@docusaurus/core": "3.10.2",
+    "@docusaurus/preset-classic": "3.10.2",
+    "@docusaurus/theme-mermaid": "3.10.2",
     "@easyops-cn/docusaurus-search-local": "^0.49.2",
     "@mdx-js/react": "^3.1.0",
     "@svgr/webpack": "^8.1.0",
```

---

### Incident Patch 2: `f7efc02e` (2026-09-26)
**Commit Message**: Merge pull request #2159 from assafelovic/fix/websocket-disconnect

fix(websocket): stop a new research run from opening a second socket

**File**: `backend/server/app.py` (modified, +2/-3)
```diff
@@ -411,12 +411,11 @@ async def websocket_endpoint(websocket: WebSocket):
     try:
         await handle_websocket_communication(websocket, manager)
     except WebSocketDisconnect as e:
-        # Disconnect with more detailed logging about the WebSocket disconnect reason
         logger.info(f"WebSocket disconnected with code {e.code} and reason: '{e.reason}'")
-        await manager.disconnect(websocket)
     except Exception as e:
-        # More general exception handling
         logger.error(f"Unexpected WebSocket error: {str(e)}")
+    finally:
+        # Release the connection's queue and sender task however the loop ended.
         await manager.disconnect(websocket)
 
 @app.post("/api/chat")
```

**File**: `backend/server/server_utils.py` (modified, +5/-1)
```diff
@@ -20,7 +20,7 @@
     from utils import write_md_to_pdf, write_md_to_word, write_text_to_md
 from pathlib import Path
 from datetime import datetime
-from fastapi import HTTPException
+from fastapi import HTTPException, WebSocketDisconnect
 import logging
 import hashlib
 
@@ -395,6 +395,10 @@ async def safe_run():
                         "content": "error",
                         "output": "Unknown command received by server"
                     })
+            except WebSocketDisconnect:
+                # A closed tab or a new research run closing the old socket is a
+                # normal disconnect, not an error. Let the endpoint clean it up.
+                raise
             except Exception as e:
                 logger.error(f"WebSocket error: {str(e)}\n{traceback.format_exc()}")
                 print(f"WebSocket error: {e}")
```

**File**: `frontend/scripts.js` (modified, +9/-5)
```diff
@@ -851,7 +851,8 @@ const GPTResearcher = (() => {
     // Update WebSocket status
     updateWebSocketStatus();
 
-    socket = new WebSocket(ws_uri)
+    const thisSocket = new WebSocket(ws_uri)
+    socket = thisSocket
     let reportContent = ''; // Store the report content for history
     let downloadLinkData = null; // Store download links
 
@@ -1011,8 +1012,10 @@ const GPTResearcher = (() => {
 
       console.log("WebSocket connection closed", event);
 
-      // If research is active, try to automatically reconnect
-      if (isResearchActive) {
+      // Only reconnect if this is still the live socket. A socket replaced by a
+      // new research run closes after that run has set isResearchActive, and
+      // reconnecting it would open a second connection competing for the run.
+      if (isResearchActive && thisSocket === socket) {
         reconnectWebSocket();
       }
     }
@@ -1026,8 +1029,9 @@ const GPTResearcher = (() => {
     return () => {
       try {
         isResearchActive = false; // Mark research as inactive
-        if (socket && socket.readyState !== WebSocket.CLOSED && socket.readyState !== WebSocket.CLOSING) {
-          socket.close();
+        thisSocket.onclose = null;
+        if (thisSocket.readyState !== WebSocket.CLOSED && thisSocket.readyState !== WebSocket.CLOSING) {
+          thisSocket.close();
         }
 
         // Update metrics on socket disposal
```

**File**: `tests/backend/test_websocket_disconnect_cleanup.py` (added, +35/-0)
```diff
@@ -0,0 +1,35 @@
+"""A client closing /ws is a normal disconnect: clean up, don't log an error (#1586)."""
+
+import logging
+import time
+
+from fastapi.testclient import TestClient
+
+from backend.server import app as app_module
+
+
+def _wait_for(predicate, timeout=2.0):
+    deadline = time.monotonic() + timeout
+    while time.monotonic() < deadline:
+        if predicate():
+            return True
+        time.sleep(0.02)
+    return predicate()
+
+
+def test_closed_socket_is_released_by_the_manager(caplog):
+    manager = app_module.manager
+    before = len(manager.active_connections)
+
+    with caplog.at_level(logging.INFO):
+        with TestClient(app_module.app) as client:
+            with client.websocket_connect("/ws") as ws:
+                ws.send_text("ping")
+                assert ws.receive_text() == "pong"
+                assert len(manager.active_connections) == before + 1
+            # Leaving the block closes the socket from the client side.
+            assert _wait_for(lambda: len(manager.active_connections) == before)
+
+    assert not manager.sender_tasks and not manager.message_queues
+    assert "WebSocket error" not in caplog.text
+    assert "WebSocket disconnected" in caplog.text
```

---

### Incident Patch 3: `ffa7438d` (2026-09-26)
**Commit Message**: Merge pull request #2158 from assafelovic/fix/multi-agent-section-dedup

fix(multi_agents): tell each parallel section what its siblings cover

**File**: `multi_agents/agents/editor.py` (modified, +6/-2)
```diff
@@ -72,7 +72,7 @@ async def run_parallel_research(self, research_state: Dict[str, any]) -> Dict[st
 
         final_drafts = [
             chain.ainvoke(self._create_task_input(
-                research_state, query, title), config={"tags": ["gpt-researcher"]})
+                research_state, query, title, queries), config={"tags": ["gpt-researcher"]})
             for query in queries
         ]
         research_results = [
@@ -178,11 +178,15 @@ def _log_parallel_research(self, queries: List[str]) -> None:
                 agent="EDITOR",
             )
 
-    def _create_task_input(self, research_state: Dict[str, any], query: str, title: str) -> Dict[str, any]:
+    def _create_task_input(self, research_state: Dict[str, any], query: str, title: str,
+                           sections: Optional[List[str]] = None) -> Dict[str, any]:
         """Create the input for a single research task."""
         return {
             "task": research_state.get("task"),
             "topic": query,
             "title": title,
             "headers": self.headers,
+            # Sections are researched in parallel, so none can see what the others
+            # wrote. Naming them lets each writer leave their ground alone (#1495).
+            "sibling_sections": [s for s in (sections or []) if s != query],
         }
```

**File**: `multi_agents/agents/researcher.py` (modified, +13/-5)
```diff
@@ -11,21 +11,28 @@ def __init__(self, websocket=None, stream_output=None, tone=None, headers=None):
         self.tone = tone
 
     async def research(self, query: str, research_report: str = "research_report",
-                       parent_query: str = "", verbose=True, source="web", tone=None, headers=None):
+                       parent_query: str = "", verbose=True, source="web", tone=None, headers=None,
+                       existing_headers=None):
         # Initialize the researcher
         researcher = GPTResearcher(query=query, report_type=research_report, parent_query=parent_query,
                                    verbose=verbose, report_source=source, tone=tone, websocket=self.websocket, headers=self.headers)
         # Conduct research on the given query
         await researcher.conduct_research()
         # Write the report
-        report = await researcher.write_report()
+        report = await researcher.write_report(existing_headers=existing_headers or [])
 
         return report
 
-    async def run_subtopic_research(self, parent_query: str, subtopic: str, verbose: bool = True, source="web", headers=None):
+    async def run_subtopic_research(self, parent_query: str, subtopic: str, verbose: bool = True, source="web",
+                                    headers=None, sibling_sections=None):
+        existing_headers = [
+            {"subtopic task": section, "note": "covered by another section of this report"}
+            for section in (sibling_sections or [])
+        ]
         try:
             report = await self.research(parent_query=parent_query, query=subtopic,
-                                         research_report="subtopic_report", verbose=verbose, source=source, tone=self.tone, headers=None)
+                                         research_report="subtopic_report", verbose=verbose, source=source, tone=self.tone, headers=None,
+                                         existing_headers=existing_headers)
         except Exception as e:
             print(f"{Fore.RED}Error in researching topic {subtopic}: {e}{Style.RESET_ALL}")
             report = None
@@ -54,5 +61,6 @@ async def run_depth_research(self, draft_state: dict):
         else:
             print_agent_output(f"Running in depth research on the following report topic: {topic}", agent="RESEARCHER")
         research_draft = await self.run_subtopic_research(parent_query=parent_query, subtopic=topic,
-                                                          verbose=verbose, source=source, headers=self.headers)
+                                                          verbose=verbose, source=source, headers=self.headers,
+                                                          sibling_sections=draft_state.get("sibling_sections"))
         return {"draft": research_draft}
\ No newline at end of file
```

**File**: `multi_agents/memory/draft.py` (modified, +1/-0)
```diff
@@ -5,6 +5,7 @@
 class DraftState(TypedDict):
     task: dict
     topic: str
+    sibling_sections: List[str]
     draft: dict
     review: str
     revision_notes: str
```

**File**: `tests/test_multi_agents_sibling_sections.py` (added, +46/-0)
```diff
@@ -0,0 +1,46 @@
+"""#1495: sections are researched in parallel, so each writer is told what the
+other sections cover. Runs the real editor LangGraph workflow, because a key
+missing from DraftState is silently dropped between nodes."""
+
+import asyncio
+
+from multi_agents.agents import editor as editor_mod
+from multi_agents.agents import researcher as researcher_mod
+
+
+class FakeGPTResearcher:
+    written = {}
+
+    def __init__(self, query, **kwargs):
+        self.query = query
+
+    async def conduct_research(self):
+        return []
+
+    async def write_report(self, existing_headers=None, **kwargs):
+        FakeGPTResearcher.written[self.query] = existing_headers
+        return f"report on {self.query}"
+
+
+def test_each_parallel_section_is_told_about_its_siblings(monkeypatch):
+    monkeypatch.setattr(researcher_mod, "GPTResearcher", FakeGPTResearcher)
+    FakeGPTResearcher.written = {}
+
+    editor = editor_mod.EditorAgent()
+    state = {
+        "task": {"query": "Solid-state batteries", "follow_guidelines": False, "verbose": False},
+        "title": "Solid-state batteries",
+        "sections": ["Materials", "Manufacturing", "Market outlook"],
+    }
+    result = asyncio.run(editor.run_parallel_research(state))
+
+    assert len(result["research_data"]) == 3
+    for section in state["sections"]:
+        siblings = [h["subtopic task"] for h in FakeGPTResearcher.written[section]]
+        assert siblings == [s for s in state["sections"] if s != section]
+
+
+def test_single_section_has_no_siblings():
+    editor = editor_mod.EditorAgent()
+    task_input = editor._create_task_input({"task": {}}, "Only", "T", ["Only"])
+    assert task_input["sibling_sections"] == []
```

---

### Incident Patch 4: `9268e3ec` (2026-09-26)
**Commit Message**: Merge pull request #2157 from assafelovic/fix/salvage-2121-2140

fix: carry over the remaining fixes from #2140 and #2121

**File**: `gpt_researcher/llm_provider/image/modelslab_image_generator.py` (modified, +3/-3)
```diff
@@ -99,7 +99,7 @@ async def _poll_for_result(self, request_id: str) -> List[str]:
                             return body["output"]
                         if body.get("status") == "error":
                             raise RuntimeError(
-                                body.get("messege", "ModelsLab generation error")
+                                body.get("message") or body.get("messege") or "ModelsLab generation error"
                             )
         except ImportError:
             import requests
@@ -116,7 +116,7 @@ async def _poll_for_result(self, request_id: str) -> List[str]:
                 if body.get("status") == "success" and body.get("output"):
                     return body["output"]
                 if body.get("status") == "error":
-                    raise RuntimeError(body.get("messege", "ModelsLab generation error"))
+                    raise RuntimeError(body.get("message") or body.get("messege") or "ModelsLab generation error")
 
         raise TimeoutError("ModelsLab image generation timed out after polling.")
 
@@ -220,7 +220,7 @@ async def _request_images(self, payload: Dict[str, Any]) -> List[str]:
             )
 
         if body.get("status") == "error":
-            raise RuntimeError(body.get("messege", "ModelsLab API error"))
+            raise RuntimeError(body.get("message") or body.get("messege") or "ModelsLab API error")
 
         if body.get("status") == "processing" and body.get("id"):
             return await self._poll_for_result(body["id"])
```

**File**: `gpt_researcher/retrievers/google/google.py` (modified, +1/-1)
```diff
@@ -77,7 +77,7 @@ def search(self, max_results=7):
             }
         )
         url = f"https://www.googleapis.com/customsearch/v1?{query_string}"
-        resp = requests.get(url)
+        resp = requests.get(url, timeout=20)
 
         if resp.status_code < 200 or resp.status_code >= 300:
             print("Google search: unexpected response status: ", resp.status_code)
```

**File**: `gpt_researcher/retrievers/pubmed_central/pubmed_central.py` (modified, +2/-2)
```diff
@@ -62,7 +62,7 @@ def _search_articles(self, max_results: int) -> Optional[List[str]]:
         }
         
         try:
-            response = requests.get(self.base_search_url, params=search_params)
+            response = requests.get(self.base_search_url, params=search_params, timeout=20)
             response.raise_for_status()
             data = response.json()
             if not isinstance(data, dict):
@@ -96,7 +96,7 @@ def _fetch_full_text(self, article_id: str) -> Optional[Dict[str, str]]:
         }
         
         try:
-            response = requests.get(self.base_fetch_url, params=fetch_params)
+            response = requests.get(self.base_fetch_url, params=fetch_params, timeout=20)
             response.raise_for_status()
             
             # Parse XML content
```

**File**: `gpt_researcher/retrievers/searchapi/searchapi.py` (modified, +20/-3)
```diff
@@ -16,8 +16,10 @@ def __init__(self, query, query_domains=None):
         Initializes the SearchApiSearch object
         Args:
             query:
+            query_domains: Optional list of domains to restrict the search to
         """
         self.query = query
+        self.query_domains = query_domains or None
         self.api_key = self.get_api_key()
 
     def get_api_key(self):
@@ -39,13 +41,19 @@ def search(self, max_results=7):
         Returns:
 
         """
-        print("SearchApiSearch: Searching with query {0}...".format(self.query))
         """Useful for general internet search queries using SearchApi."""
+        # Restrict to the requested domains, the same way the google and serper
+        # retrievers do; without this the filter was accepted and ignored.
+        search_query = self.query
+        if self.query_domains and len(self.query_domains) > 0:
+            domain_query = " OR ".join([f"site:{domain}" for domain in self.query_domains])
+            search_query = f"({domain_query}) {self.query}"
 
+        print("SearchApiSearch: Searching with query {0}...".format(search_query))
 
         url = "https://www.searchapi.io/api/v1/search"
         params = {
-            "q": self.query,
+            "q": search_query,
             "engine": "google",
         }
 
@@ -60,7 +68,16 @@ def search(self, max_results=7):
 
         try:
             response = requests.get(encoded_url, headers=headers, timeout=20)
-            if response.status_code == 200:
+            if response.status_code != 200:
+                # A failed call previously returned an empty list with nothing
+                # logged, so an expired key looked like "no results found".
+                logging.getLogger(__name__).warning(
+                    "SearchApiSearch: request failed with status %s (%s). "
+                    "Returning empty response.",
+                    response.status_code,
+                    response.text[:200],
+                )
+            else:
                 search_results = response.json() or {}
                 # ``organic_results`` may be absent (e.g. no matches, an error
                 # payload, or a non-google engine response). Default to [] so a
```

**File**: `gpt_researcher/retrievers/searx/searx.py` (modified, +2/-1)
```diff
@@ -78,7 +78,8 @@ def search(self, max_results: int = 10) -> List[Dict[str, str]]:
             response = requests.get(
                 search_url,
                 params=params,
-                headers={'Accept': 'application/json'}
+                headers={'Accept': 'application/json'},
+                timeout=20,
             )
             response.raise_for_status()
             results = response.json()
```

**File**: `gpt_researcher/skills/curator.py` (modified, +6/-3)
```diff
@@ -4,6 +4,7 @@
 research sources based on relevance, credibility, and reliability.
 """
 
+import logging
 from typing import Dict, List, Optional
 
 import json_repair
@@ -13,6 +14,8 @@
 from ..config.config import Config
 from ..utils.llm import create_chat_completion
 
+logger = logging.getLogger(__name__)
+
 
 class SourceCurator:
     """Ranks and curates sources based on relevance, credibility and reliability.
@@ -48,7 +51,7 @@ async def curate_sources(
         Returns:
             str: Ranked list of source URLs with reasoning
         """
-        print(f"\n\nCurating {len(source_data)} sources: {source_data}")
+        logger.debug(f"Curating {len(source_data)} sources")
         if self.researcher.verbose:
             await stream_output(
                 "logs",
@@ -87,7 +90,7 @@ async def curate_sources(
                     f"expected a JSON list of sources, got "
                     f"{type(curated_sources).__name__}"
                 )
-            print(f"\n\nFinal Curated sources {len(source_data)} sources: {curated_sources}")
+            logger.debug(f"Curated {len(curated_sources)} of {len(source_data)} sources")
 
             if self.researcher.verbose:
                 await stream_output(
@@ -100,7 +103,7 @@ async def curate_sources(
             return curated_sources
 
         except Exception as e:
-            print(f"Error in curate_sources from LLM response: {response}")
+            logger.error(f"Error in curate_sources: {e}")
             if self.researcher.verbose:
                 await stream_output(
                     "logs",
```

**File**: `tests/test_searchapi_query_domains.py` (added, +45/-0)
```diff
@@ -0,0 +1,45 @@
+"""SearchApi must apply query_domains and report failed requests."""
+
+import logging
+import urllib.parse
+from unittest.mock import MagicMock, patch
+
+from gpt_researcher.retrievers.searchapi.searchapi import SearchApiSearch
+
+
+def _response(status=200, payload=None, text=""):
+    response = MagicMock()
+    response.status_code = status
+    response.json.return_value = payload or {"organic_results": []}
+    response.text = text
+    return response
+
+
+def _sent_query(mock_get):
+    url = mock_get.call_args.args[0]
+    return urllib.parse.parse_qs(urllib.parse.urlsplit(url).query)["q"][0]
+
+
+@patch.dict("os.environ", {"SEARCHAPI_API_KEY": "test"})
+@patch("gpt_researcher.retrievers.searchapi.searchapi.requests.get")
+def test_query_domains_become_site_clauses(mock_get):
+    mock_get.return_value = _response()
+    SearchApiSearch("solar output", query_domains=["nrel.gov", "iea.org"]).search()
+    assert _sent_query(mock_get) == "(site:nrel.gov OR site:iea.org) solar output"
+
+
+@patch.dict("os.environ", {"SEARCHAPI_API_KEY": "test"})
+@patch("gpt_researcher.retrievers.searchapi.searchapi.requests.get")
+def test_query_is_unchanged_without_domains(mock_get):
+    mock_get.return_value = _response()
+    SearchApiSearch("solar output").search()
+    assert _sent_query(mock_get) == "solar output"
+
+
+@patch.dict("os.environ", {"SEARCHAPI_API_KEY": "test"})
+@patch("gpt_researcher.retrievers.searchapi.searchapi.requests.get")
+def test_failed_request_is_logged_and_returns_empty(mock_get, caplog):
+    mock_get.return_value = _response(status=401, text="invalid api key")
+    with caplog.at_level(logging.WARNING):
+        assert SearchApiSearch("solar output").search() == []
+    assert "401" in caplog.text and "invalid api key" in caplog.text
```

---

### Incident Patch 5: `3054bd84` (2026-09-26)
**Commit Message**: Merge pull request #2152 from Bartok9/fix/document-loader-metadata-source

fix(document): tolerate missing metadata source on loaded pages

**File**: `gpt_researcher/document/document.py` (modified, +6/-1)
```diff
@@ -51,9 +51,14 @@ async def load(self) -> list:
         for pages in await asyncio.gather(*tasks):
             for page in pages:
                 if page.page_content:
+                    # Loaders occasionally omit metadata["source"] (custom loaders,
+                    # some HTML partitions). Prefer source, then fall back to path.
+                    meta = getattr(page, "metadata", None) or {}
+                    source = meta.get("source") or meta.get("file_path") or ""
+                    url = os.path.basename(source) if source else ""
                     docs.append({
                         "raw_content": page.page_content,
-                        "url": os.path.basename(page.metadata['source'])
+                        "url": url,
                     })
                     
         if not docs:
```

**File**: `tests/test_document_loader_metadata_source.py` (added, +76/-0)
```diff
@@ -0,0 +1,76 @@
+"""DocumentLoader must tolerate pages without metadata['source']."""
+
+from __future__ import annotations
+
+import asyncio
+import importlib.util
+import sys
+import types
+from pathlib import Path
+from types import SimpleNamespace
+from unittest.mock import patch
+
+ROOT = Path(__file__).resolve().parents[1]
+MODULE_PATH = ROOT / "gpt_researcher" / "document" / "document.py"
+
+
+def _load():
+    # Prevent gpt_researcher package __init__ from loading: load module via path.
+    pkg = types.ModuleType("gpt_researcher")
+    pkg.__path__ = [str(ROOT / "gpt_researcher")]
+    sys.modules.setdefault("gpt_researcher", pkg)
+    doc_pkg = types.ModuleType("gpt_researcher.document")
+    doc_pkg.__path__ = [str(ROOT / "gpt_researcher" / "document")]
+    sys.modules["gpt_researcher.document"] = doc_pkg
+
+    # Stub heavy langchain loaders referenced at import time.
+    lcc = types.ModuleType("langchain_community")
+    lcc_loaders = types.ModuleType("langchain_community.document_loaders")
+    for name in (
+        "PyMuPDFLoader",
+        "TextLoader",
+        "UnstructuredCSVLoader",
+        "UnstructuredEPubLoader",
+        "UnstructuredExcelLoader",
+        "UnstructuredMarkdownLoader",
+        "UnstructuredPowerPointLoader",
+        "UnstructuredWordDocumentLoader",
+        "BSHTMLLoader",
+    ):
+        setattr(lcc_loaders, name, object)
+    sys.modules["langchain_community"] = lcc
+    sys.modules["langchain_community.document_loaders"] = lcc_loaders
+
+    for key in list(sys.modules):
+        if key.endswith("document_doc_testmod"):
+            sys.modules.pop(key)
+
+    spec = importlib.util.spec_from_file_location(
+        "gpt_researcher.document.document_doc_testmod", MODULE_PATH
+    )
+    mod = importlib.util.module_from_spec(spec)
+    sys.modules[spec.name] = mod
+    assert spec.loader is not None
+    spec.loader.exec_module(mod)
+    return mod
+
+
+def test_missing_source_uses_empty_url(tmp_path: Path):
+    path = tmp_path.joinpath("notes.txt")
+    path.write_text("hello", encoding="utf-8")
+    mod = _load()
+    loader = mod.DocumentLoader(str(tmp_path))
+
+    async def fake_load_document(file_path, file_extension):
+        return [
+            SimpleNamespace(page_content="body", metadata={}),
+            SimpleNamespace(page_content="with", metadata={"source": str(path)}),
+        ]
+
+    async def run():
+        with patch.object(loader, "_load_document", side_effect=fake_load_document):
+            return await loader.load()
+
+    docs = asyncio.run(run())
+    assert any(d["raw_content"] == "body" and d["url"] == "" for d in docs)
+    assert any(d["raw_content"] == "with" and d["url"] == "notes.txt" for d in docs)
```

---

### Incident Patch 6: `034be494` (2026-09-26)
**Commit Message**: fix(websocket): stop a new research run from opening a second socket

Starting a second research in the static frontend left the page stuck
until reload (#1586). Two bugs, one on each side.

Frontend: startResearch() disposes the old socket, then sets
isResearchActive. The old socket's close event fires after that, sees
research "active", and reconnects -- opening a second socket that
competes with the new one for the run. Reproduced in a browser: on
main the second run opened two sockets at once (the reporter's log
shows the same pair); with this change it opens one. The close handler
now only reconnects the socket that is still current, and disposal
detaches it before closing.

Server: handle_websocket_communication() caught WebSocketDisconnect in
its generic handler, logged a normal close as an ERROR with traceback,
and returned normally, so the endpoint's disconnect branch never ran
and manager.disconnect() was never called. Every closed tab leaked its
queue and sender task. Re-raise the disconnect, and release the
connection in a finally block however the loop ends.

Fixes #1586

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `backend/server/app.py` (modified, +2/-3)
```diff
@@ -411,12 +411,11 @@ async def websocket_endpoint(websocket: WebSocket):
     try:
         await handle_websocket_communication(websocket, manager)
     except WebSocketDisconnect as e:
-        # Disconnect with more detailed logging about the WebSocket disconnect reason
         logger.info(f"WebSocket disconnected with code {e.code} and reason: '{e.reason}'")
-        await manager.disconnect(websocket)
     except Exception as e:
-        # More general exception handling
         logger.error(f"Unexpected WebSocket error: {str(e)}")
+    finally:
+        # Release the connection's queue and sender task however the loop ended.
         await manager.disconnect(websocket)
 
 @app.post("/api/chat")
```

**File**: `backend/server/server_utils.py` (modified, +5/-1)
```diff
@@ -20,7 +20,7 @@
     from utils import write_md_to_pdf, write_md_to_word, write_text_to_md
 from pathlib import Path
 from datetime import datetime
-from fastapi import HTTPException
+from fastapi import HTTPException, WebSocketDisconnect
 import logging
 import hashlib
 
@@ -395,6 +395,10 @@ async def safe_run():
                         "content": "error",
                         "output": "Unknown command received by server"
                     })
+            except WebSocketDisconnect:
+                # A closed tab or a new research run closing the old socket is a
+                # normal disconnect, not an error. Let the endpoint clean it up.
+                raise
             except Exception as e:
                 logger.error(f"WebSocket error: {str(e)}\n{traceback.format_exc()}")
                 print(f"WebSocket error: {e}")
```

**File**: `frontend/scripts.js` (modified, +9/-5)
```diff
@@ -851,7 +851,8 @@ const GPTResearcher = (() => {
     // Update WebSocket status
     updateWebSocketStatus();
 
-    socket = new WebSocket(ws_uri)
+    const thisSocket = new WebSocket(ws_uri)
+    socket = thisSocket
     let reportContent = ''; // Store the report content for history
     let downloadLinkData = null; // Store download links
 
@@ -1011,8 +1012,10 @@ const GPTResearcher = (() => {
 
       console.log("WebSocket connection closed", event);
 
-      // If research is active, try to automatically reconnect
-      if (isResearchActive) {
+      // Only reconnect if this is still the live socket. A socket replaced by a
+      // new research run closes after that run has set isResearchActive, and
+      // reconnecting it would open a second connection competing for the run.
+      if (isResearchActive && thisSocket === socket) {
         reconnectWebSocket();
       }
     }
@@ -1026,8 +1029,9 @@ const GPTResearcher = (() => {
     return () => {
       try {
         isResearchActive = false; // Mark research as inactive
-        if (socket && socket.readyState !== WebSocket.CLOSED && socket.readyState !== WebSocket.CLOSING) {
-          socket.close();
+        thisSocket.onclose = null;
+        if (thisSocket.readyState !== WebSocket.CLOSED && thisSocket.readyState !== WebSocket.CLOSING) {
+          thisSocket.close();
         }
 
         // Update metrics on socket disposal
```

**File**: `tests/backend/test_websocket_disconnect_cleanup.py` (added, +35/-0)
```diff
@@ -0,0 +1,35 @@
+"""A client closing /ws is a normal disconnect: clean up, don't log an error (#1586)."""
+
+import logging
+import time
+
+from fastapi.testclient import TestClient
+
+from backend.server import app as app_module
+
+
+def _wait_for(predicate, timeout=2.0):
+    deadline = time.monotonic() + timeout
+    while time.monotonic() < deadline:
+        if predicate():
+            return True
+        time.sleep(0.02)
+    return predicate()
+
+
+def test_closed_socket_is_released_by_the_manager(caplog):
+    manager = app_module.manager
+    before = len(manager.active_connections)
+
+    with caplog.at_level(logging.INFO):
+        with TestClient(app_module.app) as client:
+            with client.websocket_connect("/ws") as ws:
+                ws.send_text("ping")
+                assert ws.receive_text() == "pong"
+                assert len(manager.active_connections) == before + 1
+            # Leaving the block closes the socket from the client side.
+            assert _wait_for(lambda: len(manager.active_connections) == before)
+
+    assert not manager.sender_tasks and not manager.message_queues
+    assert "WebSocket error" not in caplog.text
+    assert "WebSocket disconnected" in caplog.text
```

---

### Incident Patch 7: `dcb781e4` (2026-09-26)
**Commit Message**: fix(multi_agents): tell each parallel section what its siblings cover

The editor researches every planned section concurrently, and each
section's writer saw only its own topic. The single-agent detailed
report avoids overlap by feeding each subtopic the headers and content
already written, but that requires writing sections one after another.
multi_agents had no equivalent at all, which is why #548 was fixed in
the detailed report and #1495 still reproduced here.

Keep the sections parallel and pass each writer the titles of the other
sections as existing_headers. The subtopic prompt already instructs the
model not to cover ground listed there.

sibling_sections is declared on DraftState: LangGraph drops undeclared
keys between nodes, so without it the list never reaches the researcher
node. The test runs the real editor workflow to catch exactly that.

Fixes #1495

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `multi_agents/agents/editor.py` (modified, +6/-2)
```diff
@@ -72,7 +72,7 @@ async def run_parallel_research(self, research_state: Dict[str, any]) -> Dict[st
 
         final_drafts = [
             chain.ainvoke(self._create_task_input(
-                research_state, query, title), config={"tags": ["gpt-researcher"]})
+                research_state, query, title, queries), config={"tags": ["gpt-researcher"]})
             for query in queries
         ]
         research_results = [
@@ -178,11 +178,15 @@ def _log_parallel_research(self, queries: List[str]) -> None:
                 agent="EDITOR",
             )
 
-    def _create_task_input(self, research_state: Dict[str, any], query: str, title: str) -> Dict[str, any]:
+    def _create_task_input(self, research_state: Dict[str, any], query: str, title: str,
+                           sections: Optional[List[str]] = None) -> Dict[str, any]:
         """Create the input for a single research task."""
         return {
             "task": research_state.get("task"),
             "topic": query,
             "title": title,
             "headers": self.headers,
+            # Sections are researched in parallel, so none can see what the others
+            # wrote. Naming them lets each writer leave their ground alone (#1495).
+            "sibling_sections": [s for s in (sections or []) if s != query],
         }
```

**File**: `multi_agents/agents/researcher.py` (modified, +13/-5)
```diff
@@ -11,21 +11,28 @@ def __init__(self, websocket=None, stream_output=None, tone=None, headers=None):
         self.tone = tone
 
     async def research(self, query: str, research_report: str = "research_report",
-                       parent_query: str = "", verbose=True, source="web", tone=None, headers=None):
+                       parent_query: str = "", verbose=True, source="web", tone=None, headers=None,
+                       existing_headers=None):
         # Initialize the researcher
         researcher = GPTResearcher(query=query, report_type=research_report, parent_query=parent_query,
                                    verbose=verbose, report_source=source, tone=tone, websocket=self.websocket, headers=self.headers)
         # Conduct research on the given query
         await researcher.conduct_research()
         # Write the report
-        report = await researcher.write_report()
+        report = await researcher.write_report(existing_headers=existing_headers or [])
 
         return report
 
-    async def run_subtopic_research(self, parent_query: str, subtopic: str, verbose: bool = True, source="web", headers=None):
+    async def run_subtopic_research(self, parent_query: str, subtopic: str, verbose: bool = True, source="web",
+                                    headers=None, sibling_sections=None):
+        existing_headers = [
+            {"subtopic task": section, "note": "covered by another section of this report"}
+            for section in (sibling_sections or [])
+        ]
         try:
             report = await self.research(parent_query=parent_query, query=subtopic,
-                                         research_report="subtopic_report", verbose=verbose, source=source, tone=self.tone, headers=None)
+                                         research_report="subtopic_report", verbose=verbose, source=source, tone=self.tone, headers=None,
+                                         existing_headers=existing_headers)
         except Exception as e:
             print(f"{Fore.RED}Error in researching topic {subtopic}: {e}{Style.RESET_ALL}")
             report = None
@@ -54,5 +61,6 @@ async def run_depth_research(self, draft_state: dict):
         else:
             print_agent_output(f"Running in depth research on the following report topic: {topic}", agent="RESEARCHER")
         research_draft = await self.run_subtopic_research(parent_query=parent_query, subtopic=topic,
-                                                          verbose=verbose, source=source, headers=self.headers)
+                                                          verbose=verbose, source=source, headers=self.headers,
+                                                          sibling_sections=draft_state.get("sibling_sections"))
         return {"draft": research_draft}
\ No newline at end of file
```

**File**: `multi_agents/memory/draft.py` (modified, +1/-0)
```diff
@@ -5,6 +5,7 @@
 class DraftState(TypedDict):
     task: dict
     topic: str
+    sibling_sections: List[str]
     draft: dict
     review: str
     revision_notes: str
```

**File**: `tests/test_multi_agents_sibling_sections.py` (added, +46/-0)
```diff
@@ -0,0 +1,46 @@
+"""#1495: sections are researched in parallel, so each writer is told what the
+other sections cover. Runs the real editor LangGraph workflow, because a key
+missing from DraftState is silently dropped between nodes."""
+
+import asyncio
+
+from multi_agents.agents import editor as editor_mod
+from multi_agents.agents import researcher as researcher_mod
+
+
+class FakeGPTResearcher:
+    written = {}
+
+    def __init__(self, query, **kwargs):
+        self.query = query
+
+    async def conduct_research(self):
+        return []
+
+    async def write_report(self, existing_headers=None, **kwargs):
+        FakeGPTResearcher.written[self.query] = existing_headers
+        return f"report on {self.query}"
+
+
+def test_each_parallel_section_is_told_about_its_siblings(monkeypatch):
+    monkeypatch.setattr(researcher_mod, "GPTResearcher", FakeGPTResearcher)
+    FakeGPTResearcher.written = {}
+
+    editor = editor_mod.EditorAgent()
+    state = {
+        "task": {"query": "Solid-state batteries", "follow_guidelines": False, "verbose": False},
+        "title": "Solid-state batteries",
+        "sections": ["Materials", "Manufacturing", "Market outlook"],
+    }
+    result = asyncio.run(editor.run_parallel_research(state))
+
+    assert len(result["research_data"]) == 3
+    for section in state["sections"]:
+        siblings = [h["subtopic task"] for h in FakeGPTResearcher.written[section]]
+        assert siblings == [s for s in state["sections"] if s != section]
+
+
+def test_single_section_has_no_siblings():
+    editor = editor_mod.EditorAgent()
+    task_input = editor._create_task_input({"task": {}}, "Only", "T", ["Only"])
+    assert task_input["sibling_sections"] == []
```

---

### Incident Patch 8: `e3016adf` (2026-09-26)
**Commit Message**: fix: carry over the remaining fixes from #2140 and #2121

Both PRs held real fixes that could not be merged as they were: #2140
targets the retired master branch and carries ~380 unrelated files;
#2121 conflicts with fixes merged since and overlaps several of them.
This lands the parts nothing else covered.

From #2140 (@4ktLuffy):
- SearchApi accepted query_domains and ignored it, so domain filtering
  silently returned results from anywhere. Build site: clauses like the
  google/serper/brave retrievers do.
- A non-200 response returned [] with nothing logged, so an expired
  key looked like "no results". Log the status and body prefix.

From #2121 (@freefenghua):
- Request timeouts for the google, pubmed_central and searx retrievers
  (bing and semantic_scholar got theirs in #2133/#2130).
- SourceCurator printed the full text of every source to stdout on
  each run. Log counts at debug level instead.
- ModelsLab error text: its API spells the key "messege"; accept both
  spellings rather than switch to one.

Co-authored-by: 4ktLuffy <[REDACTED_EMAIL]>
Co-authored-by: freefenghua <[REDACTED_EMAIL]>
Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `gpt_researcher/llm_provider/image/modelslab_image_generator.py` (modified, +3/-3)
```diff
@@ -99,7 +99,7 @@ async def _poll_for_result(self, request_id: str) -> List[str]:
                             return body["output"]
                         if body.get("status") == "error":
                             raise RuntimeError(
-                                body.get("messege", "ModelsLab generation error")
+                                body.get("message") or body.get("messege") or "ModelsLab generation error"
                             )
         except ImportError:
             import requests
@@ -116,7 +116,7 @@ async def _poll_for_result(self, request_id: str) -> List[str]:
                 if body.get("status") == "success" and body.get("output"):
                     return body["output"]
                 if body.get("status") == "error":
-                    raise RuntimeError(body.get("messege", "ModelsLab generation error"))
+                    raise RuntimeError(body.get("message") or body.get("messege") or "ModelsLab generation error")
 
         raise TimeoutError("ModelsLab image generation timed out after polling.")
 
@@ -220,7 +220,7 @@ async def _request_images(self, payload: Dict[str, Any]) -> List[str]:
             )
 
         if body.get("status") == "error":
-            raise RuntimeError(body.get("messege", "ModelsLab API error"))
+            raise RuntimeError(body.get("message") or body.get("messege") or "ModelsLab API error")
 
         if body.get("status") == "processing" and body.get("id"):
             return await self._poll_for_result(body["id"])
```

**File**: `gpt_researcher/retrievers/google/google.py` (modified, +1/-1)
```diff
@@ -77,7 +77,7 @@ def search(self, max_results=7):
             }
         )
         url = f"https://www.googleapis.com/customsearch/v1?{query_string}"
-        resp = requests.get(url)
+        resp = requests.get(url, timeout=20)
 
         if resp.status_code < 200 or resp.status_code >= 300:
             print("Google search: unexpected response status: ", resp.status_code)
```

**File**: `gpt_researcher/retrievers/pubmed_central/pubmed_central.py` (modified, +2/-2)
```diff
@@ -62,7 +62,7 @@ def _search_articles(self, max_results: int) -> Optional[List[str]]:
         }
         
         try:
-            response = requests.get(self.base_search_url, params=search_params)
+            response = requests.get(self.base_search_url, params=search_params, timeout=20)
             response.raise_for_status()
             data = response.json()
             if not isinstance(data, dict):
@@ -96,7 +96,7 @@ def _fetch_full_text(self, article_id: str) -> Optional[Dict[str, str]]:
         }
         
         try:
-            response = requests.get(self.base_fetch_url, params=fetch_params)
+            response = requests.get(self.base_fetch_url, params=fetch_params, timeout=20)
             response.raise_for_status()
             
             # Parse XML content
```

**File**: `gpt_researcher/retrievers/searchapi/searchapi.py` (modified, +20/-3)
```diff
@@ -16,8 +16,10 @@ def __init__(self, query, query_domains=None):
         Initializes the SearchApiSearch object
         Args:
             query:
+            query_domains: Optional list of domains to restrict the search to
         """
         self.query = query
+        self.query_domains = query_domains or None
         self.api_key = self.get_api_key()
 
     def get_api_key(self):
@@ -39,13 +41,19 @@ def search(self, max_results=7):
         Returns:
 
         """
-        print("SearchApiSearch: Searching with query {0}...".format(self.query))
         """Useful for general internet search queries using SearchApi."""
+        # Restrict to the requested domains, the same way the google and serper
+        # retrievers do; without this the filter was accepted and ignored.
+        search_query = self.query
+        if self.query_domains and len(self.query_domains) > 0:
+            domain_query = " OR ".join([f"site:{domain}" for domain in self.query_domains])
+            search_query = f"({domain_query}) {self.query}"
 
+        print("SearchApiSearch: Searching with query {0}...".format(search_query))
 
         url = "https://www.searchapi.io/api/v1/search"
         params = {
-            "q": self.query,
+            "q": search_query,
             "engine": "google",
         }
 
@@ -60,7 +68,16 @@ def search(self, max_results=7):
 
         try:
             response = requests.get(encoded_url, headers=headers, timeout=20)
-            if response.status_code == 200:
+            if response.status_code != 200:
+                # A failed call previously returned an empty list with nothing
+                # logged, so an expired key looked like "no results found".
+                logging.getLogger(__name__).warning(
+                    "SearchApiSearch: request failed with status %s (%s). "
+                    "Returning empty response.",
+                    response.status_code,
+                    response.text[:200],
+                )
+            else:
                 search_results = response.json() or {}
                 # ``organic_results`` may be absent (e.g. no matches, an error
                 # payload, or a non-google engine response). Default to [] so a
```

**File**: `gpt_researcher/retrievers/searx/searx.py` (modified, +2/-1)
```diff
@@ -78,7 +78,8 @@ def search(self, max_results: int = 10) -> List[Dict[str, str]]:
             response = requests.get(
                 search_url,
                 params=params,
-                headers={'Accept': 'application/json'}
+                headers={'Accept': 'application/json'},
+                timeout=20,
             )
             response.raise_for_status()
             results = response.json()
```

**File**: `gpt_researcher/skills/curator.py` (modified, +6/-3)
```diff
@@ -4,6 +4,7 @@
 research sources based on relevance, credibility, and reliability.
 """
 
+import logging
 from typing import Dict, List, Optional
 
 import json_repair
@@ -13,6 +14,8 @@
 from ..config.config import Config
 from ..utils.llm import create_chat_completion
 
+logger = logging.getLogger(__name__)
+
 
 class SourceCurator:
     """Ranks and curates sources based on relevance, credibility and reliability.
@@ -48,7 +51,7 @@ async def curate_sources(
         Returns:
             str: Ranked list of source URLs with reasoning
         """
-        print(f"\n\nCurating {len(source_data)} sources: {source_data}")
+        logger.debug(f"Curating {len(source_data)} sources")
         if self.researcher.verbose:
             await stream_output(
                 "logs",
@@ -87,7 +90,7 @@ async def curate_sources(
                     f"expected a JSON list of sources, got "
                     f"{type(curated_sources).__name__}"
                 )
-            print(f"\n\nFinal Curated sources {len(source_data)} sources: {curated_sources}")
+            logger.debug(f"Curated {len(curated_sources)} of {len(source_data)} sources")
 
             if self.researcher.verbose:
                 await stream_output(
@@ -100,7 +103,7 @@ async def curate_sources(
             return curated_sources
 
         except Exception as e:
-            print(f"Error in curate_sources from LLM response: {response}")
+            logger.error(f"Error in curate_sources: {e}")
             if self.researcher.verbose:
                 await stream_output(
                     "logs",
```

**File**: `tests/test_searchapi_query_domains.py` (added, +45/-0)
```diff
@@ -0,0 +1,45 @@
+"""SearchApi must apply query_domains and report failed requests."""
+
+import logging
+import urllib.parse
+from unittest.mock import MagicMock, patch
+
+from gpt_researcher.retrievers.searchapi.searchapi import SearchApiSearch
+
+
+def _response(status=200, payload=None, text=""):
+    response = MagicMock()
+    response.status_code = status
+    response.json.return_value = payload or {"organic_results": []}
+    response.text = text
+    return response
+
+
+def _sent_query(mock_get):
+    url = mock_get.call_args.args[0]
+    return urllib.parse.parse_qs(urllib.parse.urlsplit(url).query)["q"][0]
+
+
+@patch.dict("os.environ", {"SEARCHAPI_API_KEY": "test"})
+@patch("gpt_researcher.retrievers.searchapi.searchapi.requests.get")
+def test_query_domains_become_site_clauses(mock_get):
+    mock_get.return_value = _response()
+    SearchApiSearch("solar output", query_domains=["nrel.gov", "iea.org"]).search()
+    assert _sent_query(mock_get) == "(site:nrel.gov OR site:iea.org) solar output"
+
+
+@patch.dict("os.environ", {"SEARCHAPI_API_KEY": "test"})
+@patch("gpt_researcher.retrievers.searchapi.searchapi.requests.get")
+def test_query_is_unchanged_without_domains(mock_get):
+    mock_get.return_value = _response()
+    SearchApiSearch("solar output").search()
+    assert _sent_query(mock_get) == "solar output"
+
+
+@patch.dict("os.environ", {"SEARCHAPI_API_KEY": "test"})
+@patch("gpt_researcher.retrievers.searchapi.searchapi.requests.get")
+def test_failed_request_is_logged_and_returns_empty(mock_get, caplog):
+    mock_get.return_value = _response(status=401, text="invalid api key")
+    with caplog.at_level(logging.WARNING):
+        assert SearchApiSearch("solar output").search() == []
+    assert "401" in caplog.text and "invalid api key" in caplog.text
```

---

### Incident Patch 9: `7b13f247` (2026-09-26)
**Commit Message**: chore(deps): update numpy requirement

Updates the requirements on [numpy](https://github.com/numpy/numpy) to permit the latest version.
- [Release notes](https://github.com/numpy/numpy/releases)
- [Changelog](https://github.com/numpy/numpy/blob/main/doc/RELEASE_WALKTHROUGH.rst)
- [Commits](https://github.com/numpy/numpy/compare/v2.0.0...v2.4.6)

---
updated-dependencies:
- dependency-name: numpy
  dependency-version: 2.4.6
  dependency-type: direct:production
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `requirements.txt` (modified, +1/-1)
```diff
@@ -40,7 +40,7 @@ pandas>=2.0.0
 
 # Vector Store & Embeddings
 tiktoken>=0.7.0
-numpy>=2.0.0,<2.3.0
+numpy>=2.0.0,<2.5.0
 
 # Utilities
 aiofiles>=23.2.1
```

---

### Incident Patch 10: `a5b236ca` (2026-09-26)
**Commit Message**: Merge pull request #2136 from yetuge/docs/fix-retrievers-link

docs: fix dead retrievers link in hybrid research example

**File**: `docs/docs/examples/hybrid_research.md` (modified, +1/-1)
```diff
@@ -13,7 +13,7 @@ Before you begin, ensure you have the following:
 - Python 3.10 or higher installed on your system
 - pip (Python package installer)
 - An OpenAI API key (you can also choose other supported [LLMs](../gpt-researcher/llms/llms.md))
-- A Tavily API key (you can also choose other supported [Retrievers](../gpt-researcher/search-engines/retrievers.md))
+- A Tavily API key (you can also choose other supported [Retrievers](../gpt-researcher/search-engines/search-engines.md))
 
 ## Installation
 
```

---

### Incident Patch 11: `eb13f580` (2026-09-26)
**Commit Message**: Merge pull request #2082 from ousamabenyounes/fix/issue-1580

fix(frontend): self-host browser assets

**File**: `frontend/index.html` (modified, +4/-9)
```diff
@@ -6,11 +6,8 @@
     <meta name="description" content="A research assistant powered by GPT-4">
     <meta name="viewport" content="width=device-width, initial-scale=1">
     <link rel="icon" href="./static/favicon.ico">
-    <link rel="preconnect" href="https://fonts.googleapis.com">
-    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
-    <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700&display=swap" rel="stylesheet">
-    <link href="https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/css/bootstrap.min.css" rel="stylesheet">
-    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
+    <link href="/site/vendor/css/bootstrap.min.css" rel="stylesheet">
+    <link href="/site/vendor/css/fontawesome.min.css" rel="stylesheet">
     <link rel="stylesheet" href="/site/styles.css" />
     <style>
         .avatar {
@@ -408,10 +405,8 @@ <h3><i class="fas fa-history"></i> Research History</h3>
         </p>
         <p>GPT Researcher &copy; 2024</p>
     </footer>
-    <script src="https://cdnjs.cloudflare.com/ajax/libs/showdown/1.9.1/showdown.min.js"></script>
-    <script src="https://cdnjs.cloudflare.com/ajax/libs/dompurify/3.2.6/purify.min.js"
-            integrity="sha512-YlctBG9PGZIhh9keoqI3eZkQM9T8QUbiBi7qNYAO/TUEo8jqWX5pLp5+x1cKRQDRzJ/lyGyJ9WUVNIRduxIIFw=="
-            crossorigin="anonymous" referrerpolicy="no-referrer"></script>
+    <script src="/site/vendor/js/showdown.min.js"></script>
+    <script src="/site/vendor/js/purify.min.js"></script>
     <script src="/site/scripts.js"></script>
     <script>
         // Auto-resize textarea as content grows
```

**File**: `frontend/styles.css` (modified, +1/-1)
```diff
@@ -21,7 +21,7 @@ html, body {
 }
 
 body {
-    font-family: 'Montserrat', sans-serif;
+    font-family: Arial, Helvetica, sans-serif;
     color: #fff;
     line-height: 1.6;
     background-color: #1e272e;
```

**File**: `frontend/vendor/LICENSE.bootstrap` (added, +22/-0)
```diff
@@ -0,0 +1,22 @@
+The MIT License (MIT)
+
+Copyright (c) 2011-2020 Twitter, Inc.
+Copyright (c) 2011-2020 The Bootstrap Authors
+
+Permission is hereby granted, free of charge, to any person obtaining a copy
+of this software and associated documentation files (the "Software"), to deal
+in the Software without restriction, including without limitation the rights
+to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
+copies of the Software, and to permit persons to whom the Software is
+furnished to do so, subject to the following conditions:
+
+The above copyright notice and this permission notice shall be included in
+all copies or substantial portions of the Software.
+
+THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
+IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
+FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
+AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
+LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
+OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
+THE SOFTWARE.
```

**File**: `frontend/vendor/LICENSE.dompurify` (added, +568/-0)
```diff
@@ -0,0 +1,568 @@
+DOMPurify
+Copyright 2025 Dr.-Ing. Mario Heiderich, Cure53
+
+DOMPurify is free software; you can redistribute it and/or modify it under the
+terms of either:
+
+a) the Apache License Version 2.0, or
+b) the Mozilla Public License Version 2.0
+
+-----------------------------------------------------------------------------
+
+                                 Apache License
+                           Version 2.0, January 2004
+                        http://www.apache.org/licenses/
+
+   TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION
+
+   1. Definitions.
+
+      "License" shall mean the terms and conditions for use, reproduction,
+      and distribution as defined by Sections 1 through 9 of this document.
+
+      "Licensor" shall mean the copyright owner or entity authorized by
+      the copyright owner that is granting the License.
+
+      "Legal Entity" shall mean the union of the acting entity and all
+      other entities that control, are controlled by, or are under common
+      control with that entity. For the purposes of this definition,
+      "control" means (i) the power, direct or indirect, to cause the
+      direction or management of such entity, whether by contract or
+      otherwise, or (ii) ownership of fifty percent (50%) or more of the
+      outstanding shares, or (iii) beneficial ownership of such entity.
+
+      "You" (or "Your") shall mean an individual or Legal Entity
+      exercising permissions granted by this License.
+
+      "Source" form shall mean the preferred form for making modifications,
+      including but not limited to software source code, documentation
+      source, and configuration files.
+
+      "Object" form shall mean any form resulting from mechanical
+      transformation or translation of a Source form, including but
+      not limited to compiled object code, generated documentation,
+      and conversions to other media types.
+
+      "Work" shall mean the work of authorship, whether in Source or
+      Object form, made available under the License, as indicated by a
+      copyright notice that is included in or attached to the work
+      (an example is provided in the Appendix below).
+
+      "Derivative Works" shall mean any work, whether in Source or Object
+      form, that is based on (or derived from) the Work and for which the
+      editorial revisions, annotations, elaborations, or other modifications
+      represent, as a whole, an original work of authorship. For the purposes
+      of this License, Derivative Works shall not include works that remain
+      separable from, or merely link (or bind by name) to the interfaces of,
+      the Work and Derivative Works thereof.
+
+      "Contribution" shall mean any work of authorship, including
+      the original version of the Work and any modifications or additions
+      to that Work or Derivative Works thereof, that is intentionally
+      submitted to Licensor for inclusion in the Work by the copyright owner
+      or by an individual or Legal Entity authorized to submit on behalf of
+      the copyright owner. For the purposes of this definition, "submitted"
+      means any form of electronic, verbal, or written communication sent
+      to the Licensor or its representatives, including but not limited to
+      communication on electronic mailing lists, source code control systems,
+      and issue tracking systems that are managed by, or on behalf of, the
+      Licensor for the purpose of discussing and improving the Work, but
+      excluding communication that is conspicuously marked or otherwise
+      designated in writing by the copyright owner as "Not a Contribution."
+
+      "Contributor" shall mean Licensor and any individual or Legal Entity
+      on behalf of whom a Contribution has been received by Licensor and
+      subsequently incorporated within the Work.
+
+   2. Grant of Copyright License. Subject to the terms and conditions of
+      this License, each Contributor hereby grants to You a perpetual,
+      worldwide, non-exclusive, no-charge, royalty-free, irrevocable
+      copyright license to reproduce, prepare Derivative Works of,
+      publicly display, publicly perform, sublicense, and distribute the
+      Work and such Derivative Works in Source or Object form.
+
+   3. Grant of Patent License. Subject to the terms and conditions of
+      this License, each Contributor hereby grants to You a perpetual,
+      worldwide, non-exclusive, no-charge, royalty-free, irrevocable
+      (except as stated in this section) patent license to make, have made,
+      use, offer to sell, sell, import, and otherwise transfer the Work,
+      where such license applies only to those patent claims licensable
+      by such Contributor that are necessarily infringed by their
+      Contribution(s) alone or by combination of their Contribution(s)
+      with the Work to which such Contribution(s) was submitted. If You
+      institut
```

**File**: `frontend/vendor/LICENSE.fontawesome` (added, +165/-0)
```diff
@@ -0,0 +1,165 @@
+Fonticons, Inc. (https://fontawesome.com)
+
+--------------------------------------------------------------------------------
+
+Font Awesome Free License
+
+Font Awesome Free is free, open source, and GPL friendly. You can use it for
+commercial projects, open source projects, or really almost whatever you want.
+Full Font Awesome Free license: https://fontawesome.com/license/free.
+
+--------------------------------------------------------------------------------
+
+# Icons: CC BY 4.0 License (https://creativecommons.org/licenses/by/4.0/)
+
+The Font Awesome Free download is licensed under a Creative Commons
+Attribution 4.0 International License and applies to all icons packaged
+as SVG and JS file types.
+
+--------------------------------------------------------------------------------
+
+# Fonts: SIL OFL 1.1 License
+
+In the Font Awesome Free download, the SIL OFL license applies to all icons
+packaged as web and desktop font files.
+
+Copyright (c) 2023 Fonticons, Inc. (https://fontawesome.com)
+with Reserved Font Name: "Font Awesome".
+
+This Font Software is licensed under the SIL Open Font License, Version 1.1.
+This license is copied below, and is also available with a FAQ at:
+http://scripts.sil.org/OFL
+
+SIL OPEN FONT LICENSE
+Version 1.1 - 26 February 2007
+
+PREAMBLE
+The goals of the Open Font License (OFL) are to stimulate worldwide
+development of collaborative font projects, to support the font creation
+efforts of academic and linguistic communities, and to provide a free and
+open framework in which fonts may be shared and improved in partnership
+with others.
+
+The OFL allows the licensed fonts to be used, studied, modified and
+redistributed freely as long as they are not sold by themselves. The
+fonts, including any derivative works, can be bundled, embedded,
+redistributed and/or sold with any software provided that any reserved
+names are not used by derivative works. The fonts and derivatives,
+however, cannot be released under any other type of license. The
+requirement for fonts to remain under this license does not apply
+to any document created using the fonts or their derivatives.
+
+DEFINITIONS
+"Font Software" refers to the set of files released by the Copyright
+Holder(s) under this license and clearly marked as such. This may
+include source files, build scripts and documentation.
+
+"Reserved Font Name" refers to any names specified as such after the
+copyright statement(s).
+
+"Original Version" refers to the collection of Font Software components as
+distributed by the Copyright Holder(s).
+
+"Modified Version" refers to any derivative made by adding to, deleting,
+or substituting — in part or in whole — any of the components of the
+Original Version, by changing formats or by porting the Font Software to a
+new environment.
+
+"Author" refers to any designer, engineer, programmer, technical
+writer or other person who contributed to the Font Software.
+
+PERMISSION & CONDITIONS
+Permission is hereby granted, free of charge, to any person obtaining
+a copy of the Font Software, to use, study, copy, merge, embed, modify,
+redistribute, and sell modified and unmodified copies of the Font
+Software, subject to the following conditions:
+
+1) Neither the Font Software nor any of its individual components,
+in Original or Modified Versions, may be sold by itself.
+
+2) Original or Modified Versions of the Font Software may be bundled,
+redistributed and/or sold with any software, provided that each copy
+contains the above copyright notice and this license. These can be
+included either as stand-alone text files, human-readable headers or
+in the appropriate machine-readable metadata fields within text or
+binary files as long as those fields can be easily viewed by the user.
+
+3) No Modified Version of the Font Software may use the Reserved Font
+Name(s) unless explicit written permission is granted by the corresponding
+Copyright Holder. This restriction only applies to the primary font name as
+presented to the users.
+
+4) The name(s) of the Copyright Holder(s) or the Author(s) of the Font
+Software shall not be used to promote, endorse or advertise any
+Modified Version, except to acknowledge the contribution(s) of the
+Copyright Holder(s) and the Author(s) or with their explicit written
+permission.
+
+5) The Font Software, modified or unmodified, in part or in whole,
+must be distributed entirely under this license, and must not be
+distributed under any other license. The requirement for fonts to
+remain under this license does not apply to any document created
+using the Font Software.
+
+TERMINATION
+This license becomes null and void if any of the above conditions are
+not met.
+
+DISCLAIMER
+THE FONT SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
+EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO ANY WARRANTIES OF
+MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT
+OF COPYRIGHT, PATENT, TRADEMARK, OR OTHER R
```

**File**: `frontend/vendor/LICENSE.showdown` (added, +34/-0)
```diff
@@ -0,0 +1,34 @@
+Showdown Copyright (c) 2007, John Fraser
+<http://www.attacklab.net/>
+All rights reserved.
+
+Original Markdown copyright (c) 2004, John Gruber
+<http://daringfireball.net/>
+All rights reserved.
+
+Redistribution and use in source and binary forms, with or without
+modification, are permitted provided that the following conditions are
+met:
+
+* Redistributions of source code must retain the above copyright notice,
+  this list of conditions and the following disclaimer.
+
+* Redistributions in binary form must reproduce the above copyright
+  notice, this list of conditions and the following disclaimer in the
+  documentation and/or other materials provided with the distribution.
+
+* Neither the name "Markdown" nor the names of its contributors may
+  be used to endorse or promote products derived from this software
+  without specific prior written permission.
+
+This software is provided by the copyright holders and contributors "as
+is" and any express or implied warranties, including, but not limited
+to, the implied warranties of merchantability and fitness for a
+particular purpose are disclaimed. In no event shall the copyright owner
+or contributors be liable for any direct, indirect, incidental, special,
+exemplary, or consequential damages (including, but not limited to,
+procurement of substitute goods or services; loss of use, data, or
+profits; or business interruption) however caused and on any theory of
+liability, whether in contract, strict liability, or tort (including
+negligence or otherwise) arising in any way out of the use of this
+software, even if advised of the possibility of such damage.
```

**File**: `frontend/vendor/README.md` (added, +15/-0)
```diff
@@ -0,0 +1,15 @@
+# Vendored frontend assets
+
+These pinned browser dependencies are served locally so a self-hosted GPT
+Researcher page does not contact a third-party CDN during page load.
+
+| Package | Version | Upstream asset source |
+| --- | --- | --- |
+| Bootstrap | 4.5.2 | `cdn.jsdelivr.net/npm/bootstrap@4.5.2/dist/css/bootstrap.min.css` |
+| Font Awesome Free | 6.5.1 | `cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/` |
+| Showdown | 1.9.1 | `cdn.jsdelivr.net/npm/showdown@1.9.1/dist/showdown.min.js` |
+| DOMPurify | 3.2.6 | `cdn.jsdelivr.net/npm/dompurify@3.2.6/dist/purify.min.js` |
+
+The corresponding license texts are stored in this directory. Font Awesome's
+CSS references several font variants, but this frontend uses only the solid and
+brands families, so only those WOFF2 files are included.
```

**File**: `frontend/vendor/js/purify.min.js` (added, +3/-0)
```diff
@@ -0,0 +1,3 @@
+/*! @license DOMPurify 3.2.6 | (c) Cure53 and other contributors | Released under the Apache license 2.0 and Mozilla Public License 2.0 | github.com/cure53/DOMPurify/blob/3.2.6/LICENSE */
+!function(e,t){"object"==typeof exports&&"undefined"!=typeof module?module.exports=t():"function"==typeof define&&define.amd?define(t):(e="undefined"!=typeof globalThis?globalThis:e||self).DOMPurify=t()}(this,(function(){"use strict";const{entries:e,setPrototypeOf:t,isFrozen:n,getPrototypeOf:o,getOwnPropertyDescriptor:r}=Object;let{freeze:i,seal:a,create:l}=Object,{apply:c,construct:s}="undefined"!=typeof Reflect&&Reflect;i||(i=function(e){return e}),a||(a=function(e){return e}),c||(c=function(e,t,n){return e.apply(t,n)}),s||(s=function(e,t){return new e(...t)});const u=R(Array.prototype.forEach),m=R(Array.prototype.lastIndexOf),p=R(Array.prototype.pop),f=R(Array.prototype.push),d=R(Array.prototype.splice),h=R(String.prototype.toLowerCase),g=R(String.prototype.toString),T=R(String.prototype.match),y=R(String.prototype.replace),E=R(String.prototype.indexOf),A=R(String.prototype.trim),_=R(Object.prototype.hasOwnProperty),S=R(RegExp.prototype.test),b=(N=TypeError,function(){for(var e=arguments.length,t=new Array(e),n=0;n<e;n++)t[n]=arguments[n];return s(N,t)});var N;function R(e){return function(t){t instanceof RegExp&&(t.lastIndex=0);for(var n=arguments.length,o=new Array(n>1?n-1:0),r=1;r<n;r++)o[r-1]=arguments[r];return c(e,t,o)}}function w(e,o){let r=arguments.length>2&&void 0!==arguments[2]?arguments[2]:h;t&&t(e,null);let i=o.length;for(;i--;){let t=o[i];if("string"==typeof t){const e=r(t);e!==t&&(n(o)||(o[i]=e),t=e)}e[t]=!0}return e}function O(e){for(let t=0;t<e.length;t++){_(e,t)||(e[t]=null)}return e}function D(t){const n=l(null);for(const[o,r]of e(t)){_(t,o)&&(Array.isArray(r)?n[o]=O(r):r&&"object"==typeof r&&r.constructor===Object?n[o]=D(r):n[o]=r)}return n}function v(e,t){for(;null!==e;){const n=r(e,t);if(n){if(n.get)return R(n.get);if("function"==typeof n.value)return R(n.value)}e=o(e)}return function(){return null}}const L=i(["a","abbr","acronym","address","area","article","aside","audio","b","bdi","bdo","big","blink","blockquote","body","br","button","canvas","caption","center","cite","code","col","colgroup","content","data","datalist","dd","decorator","del","details","dfn","dialog","dir","div","dl","dt","element","em","fieldset","figcaption","figure","font","footer","form","h1","h2","h3","h4","h5","h6","head","header","hgroup","hr","html","i","img","input","ins","kbd","label","legend","li","main","map","mark","marquee","menu","menuitem","meter","nav","nobr","ol","optgroup","option","output","p","picture","pre","progress","q","rp","rt","ruby","s","samp","section","select","shadow","small","source","spacer","span","strike","strong","style","sub","summary","sup","table","tbody","td","template","textarea","tfoot","th","thead","time","tr","track","tt","u","ul","var","video","wbr"]),C=i(["svg","a","altglyph","altglyphdef","altglyphitem","animatecolor","animatemotion","animatetransform","circle","clippath","defs","desc","ellipse","filter","font","g","glyph","glyphref","hkern","image","line","lineargradient","marker","mask","metadata","mpath","path","pattern","polygon","polyline","radialgradient","rect","stop","style","switch","symbol","text","textpath","title","tref","tspan","view","vkern"]),x=i(["feBlend","feColorMatrix","feComponentTransfer","feComposite","feConvolveMatrix","feDiffuseLighting","feDisplacementMap","feDistantLight","feDropShadow","feFlood","feFuncA","feFuncB","feFuncG","feFuncR","feGaussianBlur","feImage","feMerge","feMergeNode","feMorphology","feOffset","fePointLight","feSpecularLighting","feSpotLight","feTile","feTurbulence"]),I=i(["animate","color-profile","cursor","discard","font-face","font-face-format","font-face-name","font-face-src","font-face-uri","foreignobject","hatch","hatchpath","mesh","meshgradient","meshpatch","meshrow","missing-glyph","script","set","solidcolor","unknown","use"]),M=i(["math","menclose","merror","mfenced","mfrac","mglyph","mi","mlabeledtr","mmultiscripts","mn","mo","mover","mpadded","mphantom","mroot","mrow","ms","mspace","msqrt","mstyle","msub","msup","msubsup","mtable","mtd","mtext","mtr","munder","munderover","mprescripts"]),k=i(["maction","maligngroup","malignmark","mlongdiv","mscarries","mscarry","msgroup","mstack","msline","msrow","semantics","annotation","annotation-xml","mprescripts","none"]),U=i(["#text"]),z=i(["accept","action","align","alt","autocapitalize","autocomplete","autopictureinpicture","autoplay","background","bgcolor","border","capture","cellpadding","cellspacing","checked","cite","class","clear","color","cols","colspan","controls","controlslist","coords","crossorigin","datetime","decoding","default","dir","disabled","disablepictureinpicture","disableremoteplayback","download","draggable","enctype","enterkeyhint","face","for","headers","height","hidden","high","href","hreflang","id","inputmode","integrity","ismap","kind","label","la
```

---

### Incident Patch 12: `1077d351` (2026-09-26)
**Commit Message**: Merge pull request #2080 from feizhuzheng/fix/typos-user-facing-strings

fix: correct typos in user-facing warnings, subtopic prompt, and docstring

**File**: `gpt_researcher/prompts.py` (modified, +1/-1)
```diff
@@ -686,7 +686,7 @@ def generate_draft_titles_prompt(
 "Task":
 1. Create a list of draft section title headers for the subtopic report.
 2. Each header should be concise and relevant to the subtopic.
-3. The header should't be too high level, but detailed enough to cover the main aspects of the subtopic.
+3. The header shouldn't be too high level, but detailed enough to cover the main aspects of the subtopic.
 4. Use markdown syntax for the headers, using H3 (###) as H1 and H2 will be used for the larger report's heading.
 5. Ensure the headers cover main aspects of the subtopic.
 
```

**File**: `gpt_researcher/retrievers/crw/crw.py` (modified, +1/-1)
```diff
@@ -52,7 +52,7 @@ def get_api_key(self, headers):
                 api_key = os.environ["CRW_API_KEY"]
             except KeyError:
                 print(
-                    "CRW API key not found, set to blank. If you need a retriver, please set the CRW_API_KEY environment variable."
+                    "CRW API key not found, set to blank. If you need a retriever, please set the CRW_API_KEY environment variable."
                 )
                 return ""
         return api_key
```

**File**: `gpt_researcher/retrievers/tavily/tavily_search.py` (modified, +1/-1)
```diff
@@ -56,7 +56,7 @@ def get_api_key(self):
                 api_key = os.environ["TAVILY_API_KEY"]
             except KeyError:
                 print(
-                    "Tavily API key not found, set to blank. If you need a retriver, please set the TAVILY_API_KEY environment variable."
+                    "Tavily API key not found, set to blank. If you need a retriever, please set the TAVILY_API_KEY environment variable."
                 )
                 return ""
         return api_key
```

**File**: `gpt_researcher/utils/llm.py` (modified, +1/-1)
```diff
@@ -59,7 +59,7 @@ async def create_chat_completion(
         max_tokens (int, optional): The max tokens to use. Defaults to 4000.
         llm_provider (str, optional): The LLM Provider to use.
         stream (bool): Whether to stream the response. Defaults to False.
-        webocket (WebSocket): The websocket used in the currect request,
+        websocket (WebSocket): The websocket used in the current request,
         llm_kwargs (dict[str, Any], optional): Additional LLM keyword arguments. Defaults to None.
         cost_callback: Callback function for updating cost.
         reasoning_effort (str, optional): Reasoning effort for OpenAI's reasoning models. Defaults to 'low'.
```

---

### Incident Patch 13: `a8a2947e` (2026-09-26)
**Commit Message**: Merge pull request #2107 from rbales79/fix/llm-kwargs-override-temperature

fix(llm): let llm_kwargs / LLM_KWARGS override the computed temperature

**File**: `gpt_researcher/utils/llm.py` (modified, +13/-9)
```diff
@@ -83,15 +83,6 @@ async def create_chat_completion(
     # Get the provider from supported providers
     provider_kwargs = {'model': model}
 
-    if llm_kwargs:
-        provider_kwargs.update(llm_kwargs)
-    elif os.environ.get("LLM_KWARGS"):
-        import json
-        try:
-            provider_kwargs.update(json.loads(os.environ["LLM_KWARGS"]))
-        except json.JSONDecodeError:
-            pass
-
     if model in SUPPORT_REASONING_EFFORT_MODELS:
         provider_kwargs['reasoning_effort'] = reasoning_effort
 
@@ -105,6 +96,19 @@ async def create_chat_completion(
         provider_kwargs['temperature'] = None
     provider_kwargs['max_tokens'] = max_tokens
 
+    # Caller/env overrides win over the computed defaults above. Applied last on purpose: before this the
+    # unconditional ``provider_kwargs['temperature'] = ...`` clobbered a temperature passed through
+    # ``llm_kwargs`` or ``LLM_KWARGS`` — the documented escape hatch — so providers that accept exactly one
+    # temperature (Moonshot kimi-k3 answers 400 "only 1 is allowed for this model" to 0.35) could not be used.
+    if llm_kwargs:
+        provider_kwargs.update(llm_kwargs)
+    elif os.environ.get("LLM_KWARGS"):
+        import json
+        try:
+            provider_kwargs.update(json.loads(os.environ["LLM_KWARGS"]))
+        except json.JSONDecodeError:
+            pass
+
     if llm_provider == "openai":
         base_url = os.environ.get("OPENAI_BASE_URL", None)
         if base_url:
```

**File**: `tests/test_llm_kwargs_override.py` (added, +47/-0)
```diff
@@ -0,0 +1,47 @@
+"""``llm_kwargs`` / ``LLM_KWARGS`` are the documented per-provider escape hatch. They must win over the
+temperature ``create_chat_completion`` computes, or a provider that accepts exactly one temperature
+(Moonshot's kimi-k3 rejects anything but 1) cannot be used at all."""
+import json
+from unittest.mock import AsyncMock, MagicMock, patch
+
+import pytest
+
+from gpt_researcher.utils.llm import create_chat_completion
+
+
+async def _provider_kwargs(monkeypatch, **call_kwargs):
+    monkeypatch.delenv("LLM_KWARGS", raising=False) if "env" not in call_kwargs else monkeypatch.setenv("LLM_KWARGS", call_kwargs.pop("env"))
+    provider = MagicMock()
+    provider.get_chat_response = AsyncMock(return_value="ok")
+    with patch("gpt_researcher.utils.llm.get_llm", return_value=provider) as mock_get_llm:
+        await create_chat_completion(
+            messages=[{"role": "user", "content": "Generate a report"}],
+            model="kimi-k3",
+            llm_provider="openai",
+            **call_kwargs,
+        )
+    return mock_get_llm.call_args.kwargs
+
+
+@pytest.mark.asyncio
+async def test_llm_kwargs_temperature_overrides_the_computed_one(monkeypatch):
+    kwargs = await _provider_kwargs(monkeypatch, temperature=0.35, llm_kwargs={"temperature": 1})
+    assert kwargs["temperature"] == 1
+
+
+@pytest.mark.asyncio
+async def test_env_llm_kwargs_temperature_overrides_the_computed_one(monkeypatch):
+    kwargs = await _provider_kwargs(monkeypatch, temperature=0.35, env=json.dumps({"temperature": 1}))
+    assert kwargs["temperature"] == 1
+
+
+@pytest.mark.asyncio
+async def test_computed_temperature_still_applies_without_an_override(monkeypatch):
+    kwargs = await _provider_kwargs(monkeypatch, temperature=0.35)
+    assert kwargs["temperature"] == 0.35
+
+
+@pytest.mark.asyncio
+async def test_llm_kwargs_still_override_other_computed_fields(monkeypatch):
+    kwargs = await _provider_kwargs(monkeypatch, max_tokens=4000, llm_kwargs={"max_tokens": 64_000})
+    assert kwargs["max_tokens"] == 64_000
```

---

### Incident Patch 14: `70a9de60` (2026-09-26)
**Commit Message**: Merge pull request #2149 from L4XB/fix/scraper-inline-text-lines

fix(scraper): keep inline text in its line when extracting page text

**File**: `gpt_researcher/scraper/utils.py` (modified, +64/-1)
```diff
@@ -153,11 +153,74 @@ def does_tag_have_disallowed_class(elem) -> bool:
     return soup
 
 
+# Elements a browser lays out as blocks. Each one starts a new line of extracted
+# text, while the text of any other element stays in the line around it.
+_BLOCK_TAGS = frozenset(
+    "address article aside blockquote body caption center dd details dialog dir div dl dt"
+    " fieldset figcaption figure footer form h1 h2 h3 h4 h5 h6 head header hgroup hr html"
+    " legend li listing main menu nav ol optgroup option p plaintext pre search section"
+    " summary table tbody td textarea tfoot th thead title tr ul xmp".split()
+)
+# Whitespace inside these elements is content, so their text is kept as written.
+_PREFORMATTED_TAGS = frozenset(("listing", "plaintext", "pre", "textarea", "xmp"))
+# Inline boxes whose text never runs into the text next to them.
+_BOX_TAGS = frozenset(("button", "select"))
+# Only these characters are whitespace in HTML. A no-break space is content.
+_HTML_WHITESPACE = re.compile(r"[ \t\n\r\f]+")
+
+
+def _block_lines(soup: BeautifulSoup) -> list[str]:
+    """Return the text of the soup as one line per block element.
+
+    ``soup.get_text(separator="\\n")`` puts every text node on its own line, so
+    a link or an emphasis split the sentence, and even the word, it sat in.
+    """
+    lines: list[str] = []
+    line: list[str] = []
+
+    def end_line() -> None:
+        text = _HTML_WHITESPACE.sub(" ", "".join(line)).strip(" ")
+        line.clear()
+        if text.strip():
+            lines.append(text)
+
+    # An explicit stack, so deeply nested markup cannot exhaust the recursion limit.
+    stack: list[tuple[bs4.PageElement, str]] = [(soup, "visit")]
+    while stack:
+        node, action = stack.pop()
+        if action == "end_line":
+            end_line()
+        elif action == "space":
+            line.append(" ")
+        elif isinstance(node, bs4.Tag):
+            if node.name == "br":
+                end_line()
+            elif node.name in _PREFORMATTED_TAGS:
+                end_line()
+                text = node.get_text().strip("\n")
+                if text.strip():
+                    lines.append(text)
+            else:
+                if node.name in _BLOCK_TAGS:
+                    end_line()
+                    stack.append((node, "end_line"))
+                elif node.name in _BOX_TAGS:
+                    line.append(" ")
+                    stack.append((node, "space"))
+                stack.extend((child, "visit") for child in reversed(node.contents))
+        # Script, style, template and comment strings are subclasses and are
+        # not page text, the same filter get_text() applies by default.
+        elif type(node) in (bs4.NavigableString, bs4.CData):
+            line.append(str(node))
+    end_line()
+    return lines
+
+
 def get_text_from_soup(soup: BeautifulSoup) -> str:
     """Get the relevant text from the soup with improved filtering"""
     if soup is None:
         return ""
-    text = soup.get_text(strip=True, separator="\n")
+    text = "\n".join(_block_lines(soup))
     # Remove excess whitespace
     text = re.sub(r"\s{2,}", " ", text)
     return text
```

**File**: `tests/test_get_text_from_soup_lines.py` (added, +60/-0)
```diff
@@ -0,0 +1,60 @@
+from __future__ import annotations
+import importlib.util
+from pathlib import Path
+
+from bs4 import BeautifulSoup
+
+
+def _load():
+    path = Path(__file__).resolve().parents[1] / "gpt_researcher" / "scraper" / "utils.py"
+    spec = importlib.util.spec_from_file_location("su", path)
+    mod = importlib.util.module_from_spec(spec)
+    spec.loader.exec_module(mod)
+    return mod
+
+
+def _scraped_text(markup: str) -> str:
+    """Run markup through the same steps as the BeautifulSoup scraper."""
+    su = _load()
+    return su.get_text_from_soup(su.clean_soup(BeautifulSoup(markup, "lxml")))
+
+
+def test_inline_elements_stay_in_their_line():
+    markup = (
+        "<h1>Setup</h1>"
+        '<p>Read the <a href="/docs">setup guide</a> before you start. It is un<b>believ</b>able.</p>'
+        "<p>Do <em>not</em> delete the <code>data</code> folder.</p>"
+        "<p>Wrapped\nsource line</p>"
+        "<ul><li>Alpha <b>one</b></li><li>Beta</li></ul>"
+        "<table><tr><td>Apple <i>red</i></td><td>3</td></tr></table>"
+        "<p>Line one<br>Line two</p>"
+        "<div><button>Save</button><button>Cancel</button></div>"
+    )
+    assert _scraped_text(markup).split("\n") == [
+        "Setup",
+        "Read the setup guide before you start. It is unbelievable.",
+        "Do not delete the data folder.",
+        "Wrapped source line",
+        "Alpha one",
+        "Beta",
+        "Apple red",
+        "3",
+        "Line one",
+        "Line two",
+        "Save Cancel",
+    ]
+
+
+def test_preformatted_text_keeps_its_line_breaks():
+    markup = "<p>Example:</p><pre>first line\nsecond line</pre><p>Done.</p>"
+    assert _scraped_text(markup) == "Example:\nfirst line\nsecond line\nDone."
+
+
+def test_script_style_and_comment_text_is_not_page_text():
+    markup = "<p>Visible</p><script>var hidden = 1;</script><style>p { color: red; }</style><!-- note -->"
+    assert _load().get_text_from_soup(BeautifulSoup(markup, "lxml")) == "Visible"
+
+
+def test_deeply_nested_markup_is_extracted():
+    markup = "<div>" * 5000 + "deep" + "</div>" * 5000
+    assert _load().get_text_from_soup(BeautifulSoup(markup, "html.parser")) == "deep"
```

---

### Incident Patch 15: `0b28303f` (2026-09-26)
**Commit Message**: Merge pull request #2112 from beemines/fix/chat-search-source-provenance

fix(chat): preserve sources from the actual search tool invocation

**File**: `backend/chat/chat.py` (modified, +36/-30)
```diff
@@ -160,29 +160,50 @@ def quick_search(self, query):
             results = self.tavily_client.search(query=query, max_results=5)
             
             # Store search metadata for frontend
-            self.search_metadata = {
-                "query": query,
-                "sources": [
-                    {"title": result.get("title", ""), 
-                     "url": result.get("url", ""),
-                     "content": result.get("content", "")[:200] + "..." if len(result.get("content", "")) > 200 else result.get("content", "")}
-                    for result in results.get("results", [])
-                ]
-            }
+            self.search_metadata = self._build_search_metadata(query, results)
             
             return results
         except Exception as e:
             logger.error(f"Error performing web search: {str(e)}", exc_info=True)
-            return {
+            results = {
                 "error": str(e),
                 "results": []
             }
+            self.search_metadata = self._build_search_metadata(query, results)
+            return results
+
+    @staticmethod
+    def _build_search_metadata(query, results):
+        """Describe one search result without making another provider request."""
+        metadata = {"query": query, "sources": []}
+        for result in results.get("results", []):
+            content = result.get("content", "")
+            metadata["sources"].append({
+                "title": result.get("title", ""),
+                "url": result.get("url", ""),
+                "content": content[:200] + "..." if len(content) > 200 else content,
+            })
+        if "error" in results:
+            metadata["error"] = results["error"]
+        return metadata
 
 
     async def process_chat_completion(self, messages: List[Dict[str, str]]):
         """Process chat completion using configured LLM provider with tool calling support"""
-        # Create a search tool using the utility function
-        search_tool = create_search_tool(self.quick_search)
+        processed_metadata = []
+
+        def search_with_metadata(query):
+            results = self.quick_search(query)
+            # Keep sources local to this completion and tied to the evidence
+            # returned to the model, including repeated queries and failures.
+            processed_metadata.append({
+                "tool": "quick_search",
+                "query": query,
+                "search_metadata": self._build_search_metadata(query, results),
+            })
+            return results
+
+        search_tool = create_search_tool(search_with_metadata)
         
         # Use the tool-enabled chat completion utility
         response, tool_calls_metadata = await create_chat_completion_with_tools(
@@ -193,24 +214,9 @@ async def process_chat_completion(self, messages: List[Dict[str, str]]):
             llm_kwargs=self.config.llm_kwargs,
         )
         
-        # Process metadata to match the expected format for the chat system
-        processed_metadata = []
-        for metadata in tool_calls_metadata:
-            if metadata.get("tool") == "search_tool":
-                # Extract query from args
-                query = metadata.get("args", {}).get("query", "")
-                
-                # Trigger search again to get metadata (the search was already executed by LangChain)
-                if query:
-                    self.quick_search(query)  # This populates self.search_metadata
-                    
-                processed_metadata.append({
-                    "tool": "quick_search",
-                    "query": query,
-                    "search_metadata": self.search_metadata
-                })
-        
-        return response, processed_metadata
+        # The utility returns no tool metadata when it falls back to a plain
+        # completion; that answer was not generated from these search results.
+        return response, processed_metadata if tool_calls_metadata else []
 
 
 
```

**File**: `tests/chat/test_chat_search_sources.py` (added, +192/-0)
```diff
@@ -0,0 +1,192 @@
+"""Chat citations must describe the searches actually supplied to the model."""
+
+import asyncio
+from types import SimpleNamespace
+from unittest.mock import AsyncMock, MagicMock
+
+import pytest
+from langchain_core.messages import AIMessage, ToolMessage
+
+from backend.chat.chat import ChatAgentWithMemory
+from gpt_researcher.llm_provider.generic.base import GenericLLMProvider
+
+
+class ScriptedModel:
+    """Only the provider boundary is faked; real tools execute in between calls."""
+
+    def __init__(self, queries):
+        self.calls = []
+        self.responses = [
+            AIMessage(
+                content="",
+                tool_calls=[
+                    {"name": "search_tool", "args": {"query": query}, "id": f"call-{i}"}
+                    for i, query in enumerate(queries)
+                ],
+            ),
+            AIMessage(content="Answer grounded in the search results."),
+        ] if queries else [AIMessage(content="Answer from the report.")]
+
+    def bind_tools(self, tools):
+        return self
+
+    async def ainvoke(self, messages):
+        self.calls.append(list(messages))
+        response = self.responses.pop(0)
+        if isinstance(response, Exception):
+            raise response
+        return response
+
+
+@pytest.fixture
+def agent(monkeypatch):
+    monkeypatch.delenv("TAVILY_API_KEY", raising=False)
+    agent = ChatAgentWithMemory(report="")
+    calls = []
+
+    def search(*, query, max_results):
+        assert max_results == 5
+        calls.append(query)
+        if query == "fail":
+            raise RuntimeError("search unavailable")
+        return {"results": [{
+            "title": f"Source for {query}",
+            "url": f"https://example.com/result-{len(calls)}",
+            "content": "Evidence " * 60,
+        }]}
+
+    agent.tavily_client = MagicMock()
+    agent.tavily_client.search.side_effect = search
+    return agent
+
+
+def install_model(monkeypatch, queries):
+    model = ScriptedModel(queries)
+    monkeypatch.setattr(
+        GenericLLMProvider, "from_provider",
+        lambda *_args, **_kwargs: SimpleNamespace(llm=model),
+    )
+    return model
+
+
+@pytest.mark.asyncio
+@pytest.mark.parametrize("queries", [
+    ["first"], ["first", "second"], ["same", "same"],
+    ["first", "fail"], ["fail"], ["fail", "second"],
+])
+async def test_each_tool_call_searches_once_and_keeps_its_own_sources(agent, monkeypatch, queries):
+    model = install_model(monkeypatch, queries)
+
+    response, metadata = await agent.chat([{"role": "user", "content": "Find current evidence."}])
+
+    assert response == "Answer grounded in the search results."
+    assert agent.tavily_client.search.call_count == len(queries)
+    assert len(metadata) == len(queries)
+    evidence = [message for message in model.calls[1] if isinstance(message, ToolMessage)]
+    assert len(evidence) == len(queries)
+    for index, (query, entry, tool_message) in enumerate(zip(queries, metadata, evidence), start=1):
+        assert entry["tool"] == "quick_search"
+        assert entry["query"] == query
+        assert entry["search_metadata"]["query"] == query
+        if query == "fail":
+            assert entry["search_metadata"]["sources"] == []
+            assert entry["search_metadata"]["error"] == "search unavailable"
+        else:
+            source = entry["search_metadata"]["sources"][0]
+            assert source["url"] == f"https://example.com/result-{index}"
+            assert source["url"] in tool_message.content
+            assert source["title"] in tool_message.content
+            assert source["content"] == ("Evidence " * 60)[:200] + "..."
+
+
+def test_failed_search_replaces_previous_metadata(agent):
+    agent.quick_search("first")
+
+    result = agent.quick_search("fail")
+
+    assert result == {"error": "search unavailable", "results": []}
+    assert agent.search_metadata == {
+        "query": "fail", "sources": [], "error": "search unavailable",
+    }
+
+
+@pytest.mark.asyncio
+async def test_disabled_search_has_current_error_and_no_previous_sources(agent, monkeypatch):
+    agent.quick_search("first")
+    agent.tavily_client = None
+    install_model(monkeypatch, ["disabled"])
+
+    _, metadata = await agent.process_chat_completion([])
+
+    assert len(metadata) == 1
+    assert metadata[0]["search_metadata"] == {
+        "query": "disabled", "sources": [],
+        "error": "Web search is disabled - TAVILY_API_KEY not configured",
+    }
+
+
+@pytest.mark.asyncio
+async def test_chat_without_search_does_not_reuse_previous_turn_metadata(agent, monkeypatch):
+    install_model(monkeypatch, ["first"])
+    _, previous = await agent.process_chat_completion([])
+    calls_before = agent.tavily_client.search.call_count
+    install_model(monkeypatch, [])
+
+    response, current = await agent.process_chat_completion([])
+
+    assert response == "Answer from the report."
+    assert current == []
+    assert
```

#### Recent Merged Pull Requests:
- **PR #2191** (closed): Github AI Agent (@Pradnyadange)
- **PR #2188** (closed): test: stop tests leaking sys.modules stubs; run CI suite without --forked (@Saadanjum0)
- **PR #2182** (closed): AI Agent (@Pradnyadange)
- **PR #2179** (closed): Dashoboard (@Pradnyadange)
- **PR #2178** (closed): AI Agent (@Pradnyadange)
- **PR #2177** (closed): Add stop control for active research (@rachelpyw)
- **PR #2173** (2026-09-26): docs(homepage): restore the two-column hero (@assafelovic)
- **PR #2172** (2026-09-26): docs(homepage): drop the code card and stats strip; centre the hero (@assafelovic)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

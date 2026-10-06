# Forensic Learning Record (Deep Inspection): ashishpatel26/500-AI-Agents-Projects

> **Canonical Artifact**: `07_PROJECT_LEARNING/ashishpatel26-500-ai-agents-projects-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/ashishpatel26/500-AI-Agents-Projects](https://github.com/ashishpatel26/500-AI-Agents-Projects))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:53:01.236Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `ashishpatel26/500-AI-Agents-Projects`
- **Description**: The 500 AI Agents Projects is a curated collection of AI agent use cases across various industries. It showcases practical applications and provides links to open-source projects for implementation, illustrating how AI agents are transforming sectors such as healthcare, finance, education, retail, and more.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 38331 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `agents/01-web-research-agent/agent.py`
```
"""
Web Research Agent using LangGraph + Tavily Search.

Searches the web for a given topic, synthesizes findings, and returns
a structured research report.

Usage:
    python agent.py
    python agent.py --query "latest advances in quantum computing"
"""

import argparse
import os
from typing import Annotated, TypedDict

from dotenv import load_dotenv
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
from langchain_tavily import TavilySearch
from langgraph.graph import END, StateGraph
from langgraph.graph.message import add_messages

load_dotenv()


class ResearchState(TypedDict):
    messages: Annotated[list, add_messages]
    query: str
    search_results: list[dict]
    report: str


def search_web(state: ResearchState) -> ResearchState:
    tool = TavilySearch(max_results=5)
    raw_results = tool.invoke(state["query"])
    if isinstance(raw_results, dict):
        results = raw_results.get("results", [])
    elif isinstance(raw_results, list):
        results = raw_results
    else:
        results = []
    return {"search_results": results}


def synthesize_report(state: ResearchState) -> ResearchState:
    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

    results_text = "\n\n".join(
        f"Source: {r.get('url', 'N/A')}\nTitle: {r.get('title', 'N/A')}\nContent: {r.get('content', '')[:500]}"
        for r in state["search_results"]
    )

    messages = [
        SystemMessage(content="You are a research analyst. Synthesize the search results into a clear, structured report with: Summary, Key Findings (bullet points), and Sources."),
        HumanMessage(content=f"Research query: {state['query']}\n\nSearch results:\n{results_text}"),
    ]

    response = llm.invoke(messages)
    return {"report": response.content, "messages": [response]}


def build_graph() -> StateGraph:
    graph = StateGraph(ResearchState)
    graph.add_node("search", search_web)
    graph.add_node("synthesize", synthesize_report)
    graph.set_entry_point("search")
    graph.add_edge("search", "synthesize")
    graph.add_edge("synthesize", END)
    return graph.compile()


def main():
    parser = argparse.ArgumentParser(description="Web Research Agent")
    parser.add_argument("--query", default="latest advances in AI agents 2024", help="Research query")
    args = parser.parse_args()

    print(f"\n🔍 Researching: {args.query}\n")

    agent = build_graph()
    result = agent.invoke({"query": args.query, "messages": [], "search_results": [], "report": ""})

    print("=" * 60)
    print("📄 RESEARCH REPORT")
    print("=" * 60)
    print(result["report"])


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `agents/02-code-review-agent/agent.py`
```
"""
Code Review Agent using LangChain.

Reviews Python code for bugs, security issues, style violations, and
suggests improvements. Accepts a file path or inline code snippet.

Usage:
    python agent.py --file path/to/code.py
    python agent.py --code "def add(a,b): return a+b"
"""

import argparse
import os

from dotenv import load_dotenv
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI

load_dotenv()

SYSTEM_PROMPT = """You are an expert code reviewer. Analyze the provided code and return a structured review covering:

1. **Bugs & Correctness** — logic errors, edge cases, exception handling
2. **Security Issues** — injection risks, secrets exposure, unsafe operations
3. **Performance** — inefficiencies, unnecessary computation, memory issues
4. **Code Style** — PEP 8 violations, naming conventions, readability
5. **Improvements** — refactoring suggestions, better patterns

Format: Use markdown. Rate overall quality as: 🟢 Good / 🟡 Needs Work / 🔴 Critical Issues."""


def review_code(code: str, language: str = "python") -> str:
    llm = ChatOpenAI(model="gpt-4o", temperature=0)
    messages = [
        SystemMessage(content=SYSTEM_PROMPT),
        HumanMessage(content=f"Review this {language} code:\n\n```{language}\n{code}\n```"),
    ]
    response = llm.invoke(messages)
    return response.content


def main():
    parser = argparse.ArgumentParser(description="Code Review Agent")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--file", help="Path to file to review")
    group.add_argument("--code", help="Inline code snippet to review")
    parser.add_argument("--language", default="python", help="Programming language (default: python)")
    args = parser.parse_args()

    if args.file:
        with open(args.file) as f:
            code = f.read()
        print(f"\n🔍 Reviewing: {args.file}\n")
    else:
        code = args.code
        print(f"\n🔍 Reviewing inline code snippet\n")

    review = review_code(code, args.language)

    print("=" * 60)
    print("📋 CODE REVIEW")
    print("=" * 60)
    print(review)


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `agents/03-pdf-qa-agent/agent.py`
```
"""
PDF Q&A Agent using LlamaIndex.

Loads a PDF, indexes it, and answers questions about its content.
Maintains conversation history for follow-up questions.

Usage:
    python agent.py --pdf path/to/document.pdf
    python agent.py --pdf report.pdf --question "What is the main finding?"
"""

import argparse
import os

from dotenv import load_dotenv
from llama_index.core import SimpleDirectoryReader, VectorStoreIndex
from llama_index.core.memory import ChatMemoryBuffer
from llama_index.llms.openai import OpenAI

load_dotenv()


def build_index(pdf_path: str) -> VectorStoreIndex:
    print(f"📄 Loading and indexing {pdf_path}...")
    reader = SimpleDirectoryReader(input_files=[pdf_path])
    docs = reader.load_data()
    index = VectorStoreIndex.from_documents(docs)
    print(f"✅ Indexed {len(docs)} document chunk(s)")
    return index


def interactive_qa(index: VectorStoreIndex):
    llm = OpenAI(model="gpt-4o-mini", temperature=0)
    memory = ChatMemoryBuffer.from_defaults(token_limit=4096)
    chat_engine = index.as_chat_engine(
        chat_mode="context",
        llm=llm,
        memory=memory,
        verbose=False,
    )

    print("\n💬 PDF Q&A Agent ready. Type 'quit' to exit.\n")
    while True:
        question = input("You: ").strip()
        if question.lower() in ("quit", "exit", "q"):
            break
        if not question:
            continue
        response = chat_engine.chat(question)
        print(f"\nAgent: {response.response}\n")


def single_question(index: VectorStoreIndex, question: str):
    query_engine = index.as_query_engine(similarity_top_k=5)
    response = query_engine.query(question)
    print("\n" + "=" * 60)
    print("📋 ANSWER")
    print("=" * 60)
    print(response.response)
    if hasattr(response, "source_nodes"):
        print(f"\n📚 Sources: {len(response.source_nodes)} chunk(s) referenced")


def main():
    parser = argparse.ArgumentParser(description="PDF Q&A Agent")
    parser.add_argument("--pdf", required=True, help="Path to PDF file")
    parser.add_argument("--question", help="Single question (omit for interactive mode)")
    args = parser.parse_args()

    index = build_index(args.pdf)

    if args.question:
        single_question(index, args.question)
    else:
        interactive_qa(index)


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `agents/04-sql-query-agent/agent.py`
```
"""
SQL Query Agent using LangChain.

Connects to a SQLite database and answers natural language questions
by generating and executing SQL queries.

Usage:
    python agent.py                          # uses demo database
    python agent.py --db path/to/db.sqlite   # your database
    python agent.py --db mydb.sqlite --question "How many users signed up last month?"
"""

import argparse
import os
import sqlite3
from urllib.parse import quote

from dotenv import load_dotenv
from langchain_community.utilities import SQLDatabase
from langchain_openai import ChatOpenAI
from langchain.agents import create_sql_agent
from langchain.agents.agent_toolkits import SQLDatabaseToolkit
from langchain.agents.agent_types import AgentType

load_dotenv()


def create_demo_database(db_path: str):
    """Creates a demo e-commerce SQLite database for testing."""
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    cur.executescript("""
        CREATE TABLE IF NOT EXISTS customers (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT UNIQUE,
            country TEXT,
            created_at DATE DEFAULT CURRENT_DATE
        );
        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            category TEXT,
            price REAL NOT NULL,
            stock INTEGER DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY,
            customer_id INTEGER REFERENCES customers(id),
            product_id INTEGER REFERENCES products(id),
            quantity INTEGER NOT NULL,
            total REAL NOT NULL,
            order_date DATE DEFAULT CURRENT_DATE
        );
        INSERT OR IGNORE INTO customers VALUES
            (1,'Alice Johnson','alice@example.com','USA','2024-01-15'),
            (2,'Bob Smith','bob@example.com','UK','2024-02-20'),
            (3,'Carlos Lima','carlos@example.com','Brazil','2024-03-10'),
            (4,'Diana Prince','diana@example.com','USA','2024-01-05');
        INSERT OR IGNORE INTO products VALUES
            (1,'Laptop Pro','Electronics',1299.99,45),
            (2,'Wireless Mouse','Electronics',29.99,200),
            (3,'Python Book','Books',49.99,120),
            (4,'Standing Desk','Furniture',599.99,15);
        INSERT OR IGNORE INTO orders VALUES
            (1,1,1,1,1299.99,'2024-04-01'),
            (2,1,2,2,59.98,'2024-04-01'),
            (3,2,3,1,49.99,'2024-04-05'),
            (4,3,4,1,599.99,'2024-04-10'),
            (5,4,1,1,1299.99,'2024-04-12'),
            (6,2,2,3,89.97,'2024-04-15');
    """)
    conn.commit()
    conn.close()


def sqlite_uri(db_path: str, read_only: bool = True) -> str:
    abs_path = os.path.abspath(db_path)
    if read_only:
        return f"sqlite:///file:{quote(abs_path)}?mode=ro&uri=true"
    return f"sqlite:///{abs_path}"


def build_agent(db_path: str, read_only: bool = True):
    db = SQLDatabase.from_uri(sqlite_uri(db_path, read_only=read_only))
    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
    toolkit = SQLDatabaseToolkit(db=db, llm=llm)
    agent = create_sql_agent(
        llm=llm,
        toolkit=toolkit,
        agent_type=AgentType.ZERO_SHOT_REACT_DESCRIPTION,
        verbose=False,
    )
    return agent, db


def main():
    parser = argparse.ArgumentParser(description="SQL Query Agent")
    parser.add_argument("--db", default="demo.sqlite", help="SQLite database path")
    parser.add_argument("--question", help="Natural language question (omit for interactive)")
    parser.add_argument("--allow-write", action="store_true", help="Open the SQLite database read-write instead of read-only")
    args = parser.parse_args()

    if args.db == "demo.sqlite" and not os.path.exists("demo.sqlite"):
        print("🏗️  Creating demo e-commerce database...")
        create_demo_database("demo.sqlite")

    agent, db = build_agent(args.db, read_only=not args.allow_write)
    print(f"\n📊 Connected to: {args.db}")
    print(f"🔒 Mode: {'read-write' if args.allow_write else 'read-only'}")
    print(f"📋 Tables: {', '.join(db.get_table_names())}\n")

    if args.question:
        print(f"❓ Question: {args.question}")
        result = agent.invoke({"input": args.question})
        print(f"\n✅ Answer: {result['output']}")
    else:
        print("💬 SQL Agent ready. Ask questions in natural language. Type 'quit' to exit.\n")
        while True:
            question = input("You: ").strip()
            if question.lower() in ("quit", "exit", "q"):
                break
            if not question:
                continue
            result = agent.invoke({"input": question})
            print(f"\nAgent: {result['output']}\n")


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `agents/05-email-drafting-agent/agent.py`
```
"""
Email Drafting Agent using CrewAI.

A two-agent crew that drafts professional emails:
- Analyst agent: understands context and tone requirements
- Writer agent: drafts the final email

Usage:
    python agent.py
    python agent.py --context "Follow up on the Q3 proposal sent last week" --tone "professional"
"""

import argparse
import os

from crewai import Agent, Crew, Process, Task
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI

load_dotenv()


def build_email_crew(context: str, tone: str, recipient: str) -> str:
    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.3)

    analyst = Agent(
        role="Email Context Analyst",
        goal="Understand the email context, extract key points, and define the structure",
        backstory="You are an expert business communication analyst who distills complex situations into clear email requirements.",
        llm=llm,
        verbose=False,
    )

    writer = Agent(
        role="Professional Email Writer",
        goal="Draft clear, concise, and effective professional emails",
        backstory="You are a professional copywriter specializing in business emails that get responses.",
        llm=llm,
        verbose=False,
    )

    analyze_task = Task(
        description=f"""Analyze this email requirement:
Context: {context}
Recipient: {recipient}
Desired tone: {tone}

Extract: purpose, key points to cover, call to action, subject line suggestion.""",
        agent=analyst,
        expected_output="Structured email brief: purpose, key points, CTA, and suggested subject line",
    )

    write_task = Task(
        description=f"""Using the analysis, draft a complete professional email.
Tone: {tone}. Recipient: {recipient}.
Include: Subject line, greeting, body paragraphs, closing, signature placeholder.
Keep it concise — under 200 words for the body.""",
        agent=writer,
        expected_output="Complete formatted email ready to send",
        context=[analyze_task],
    )

    crew = Crew(
        agents=[analyst, writer],
        tasks=[analyze_task, write_task],
        process=Process.sequential,
        verbose=False,
    )

    result = crew.kickoff()
    return str(result)


def main():
    parser = argparse.ArgumentParser(description="Email Drafting Agent")
    parser.add_argument("--context", default="Follow up on our product demo from last Tuesday. They seemed interested but haven't responded.", help="Email context/purpose")
    parser.add_argument("--tone", default="professional and friendly", help="Email tone")
    parser.add_argument("--recipient", default="a potential client", help="Who the email is for")
    args = parser.parse_args()

    print(f"\n✉️  Drafting email...\n")
    email = build_email_crew(args.context, args.tone, args.recipient)

    print("=" * 60)
    print("📧 DRAFTED EMAIL")
    print("=" * 60)
    print(email)


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `agents/06-news-summarizer-agent/agent.py`
```
"""
News Summarizer Agent using AutoGen.

Fetches news articles and produces structured summaries with key insights.

Usage:
    python agent.py --topic "artificial intelligence"
    python agent.py --topic "climate change" --count 5
"""

import argparse
import os

import requests
from dotenv import load_dotenv
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI

load_dotenv()

NEWS_API_KEY = os.getenv("NEWS_API_KEY")


def fetch_news(topic: str, count: int = 5) -> list[dict]:
    if not NEWS_API_KEY:
        # Return mock data if no API key
        return [
            {"title": f"Major development in {topic}", "description": f"Researchers announce breakthrough in {topic} field.", "url": "https://example.com/1", "source": {"name": "Tech News"}},
            {"title": f"{topic.title()} industry sees rapid growth", "description": f"New report shows {topic} adoption up 40% year-over-year.", "url": "https://example.com/2", "source": {"name": "Business Daily"}},
            {"title": f"Experts weigh in on {topic} challenges", "description": f"Leading experts discuss obstacles facing the {topic} space.", "url": "https://example.com/3", "source": {"name": "Science Weekly"}},
        ]

    url = f"https://newsapi.org/v2/everything?q={topic}&language=en&pageSize={count}&sortBy=publishedAt&apiKey={NEWS_API_KEY}"
    response = requests.get(url, timeout=10)
    data = response.json()
    return data.get("articles", [])


def summarize_news(topic: str, articles: list[dict]) -> str:
    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

    articles_text = "\n\n".join(
        f"Title: {a['title']}\nSource: {a.get('source', {}).get('name', 'Unknown')}\nSummary: {a.get('description', 'N/A')}"
        for a in articles[:5]
    )

    messages = [
        SystemMessage(content="You are a news analyst. Create a structured news briefing with: 1) Top Story, 2) Key Themes (3 bullet points), 3) What to Watch, 4) Quick Headlines list."),
        HumanMessage(content=f"Topic: {topic}\n\nArticles:\n{articles_text}"),
    ]

    response = llm.invoke(messages)
    return response.content


def main():
    parser = argparse.ArgumentParser(description="News Summarizer Agent")
    parser.add_argument("--topic", default="artificial intelligence", help="News topic to search")
    parser.add_argument("--count", type=int, default=5, help="Number of articles to fetch")
    args = parser.parse_args()

    print(f"\n📰 Fetching news about: {args.topic}\n")
    articles = fetch_news(args.topic, args.count)
    print(f"✅ Found {len(articles)} articles")

    summary = summarize_news(args.topic, articles)

    print("\n" + "=" * 60)
    print(f"📋 NEWS BRIEFING: {args.topic.upper()}")
    print("=" * 60)
    print(summary)


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `agents/07-github-issue-triager/agent.py`
```
"""
GitHub Issue Triager using LangGraph.

Analyzes a GitHub issue and produces: severity label, category,
reproduction steps summary, and suggested assignee type.

Usage:
    python agent.py --title "Login fails on mobile Safari" --body "When I try..."
    python agent.py --issue-url https://github.com/owner/repo/issues/123
"""

import argparse
import os
import json
import re

from dotenv import load_dotenv
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI

load_dotenv()

TRIAGE_PROMPT = """You are a GitHub issue triager. Analyze the issue and return a JSON object with:
{
  "severity": "critical|high|medium|low",
  "category": "bug|feature|documentation|question|performance|security",
  "priority_score": 1-10,
  "labels": ["list", "of", "suggested", "labels"],
  "summary": "one sentence summary",
  "reproduction_clear": true/false,
  "assignee_type": "frontend|backend|devops|documentation|security|any",
  "needs_more_info": true/false,
  "triage_notes": "2-3 sentences of triager notes"
}
Return only valid JSON, no markdown."""


def parse_json_response(text: str) -> dict:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    match = re.search(r"\{.*\}", cleaned, re.DOTALL)
    if match:
        cleaned = match.group(0)
    return json.loads(cleaned)


def triage_issue(title: str, body: str, labels: list[str] = None) -> dict:
    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

    issue_text = f"Title: {title}\n\nBody:\n{body}"
    if labels:
        issue_text += f"\n\nExisting labels: {', '.join(labels)}"

    messages = [
        SystemMessage(content=TRIAGE_PROMPT),
        HumanMessage(content=issue_text),
    ]

    response = llm.invoke(messages)
    return parse_json_response(response.content)


def fetch_github_issue(url: str) -> tuple[str, str, list]:
    """Fetch issue details from GitHub API."""
    import re
    import requests

    match = re.match(r"https://github.com/([^/]+)/([^/]+)/issues/(\d+)", url)
    if not match:
        raise ValueError(f"Invalid GitHub issue URL: {url}")

    owner, repo, issue_num = match.groups()
    api_url = f"https://api.github.com/repos/{owner}/{repo}/issues/{issue_num}"
    headers = {}
    if token := os.getenv("GITHUB_TOKEN"):
        headers["Authorization"] = f"token {token}"

    r = requests.get(api_url, headers=headers, timeout=10)
    r.raise_for_status()
    data = r.json()
    return data["title"], data.get("body", ""), [l["name"] for l in data.get("labels", [])]


def main():
    parser = argparse.ArgumentParser(description="GitHub Issue Triager")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--issue-url", help="GitHub issue URL")
    group.add_argument("--title", help="Issue title (use with --body)")
    parser.add_argument("--body", default="", help="Issue body text")
    args = parser.parse_args()

    if args.issue_url:
        print(f"\n🔍 Fetching issue from GitHub...")
        title, body, labels = fetch_github_issue(args.issue_url)
    else:
        title, body, labels = args.title, args.body, []

    print(f"\n🏷️  Triaging: {title}\n")
    result = triage_issue(title, body, labels)

    severity = result.get("severity", "medium")
    labels = result.get("labels", [])
    severity_emoji = {"critical": "🔴", "high": "🟠", "medium": "🟡", "low": "🟢"}.get(severity, "⚪")

    print("=" * 60)
    print("📋 TRIAGE REPORT")
    print("=" * 60)
    print(f"{severity_emoji} Severity: {severity.upper()} (Priority: {result.get('priority_score', 'N/A')}/10)")
    print(f"📁 Category: {result.get('category', 'N/A')}")
    print(f"👤 Assignee: {result.get('assignee_type', 'any')} team")
    print(f"🏷️  Labels: {', '.join(labels)}")
    print(f"📝 Summary: {result.get('summary', 'N/A')}")
    print(f"❓ Needs more info: {'Yes' if result.get('needs_more_info') else 'No'}")
    print(f"🔍 Reproduction clear: {'Yes' if result.get('reproduction_clear') else 'No'}")
    print(f"\n💭 Notes: {result.get('triage_notes', 'N/A')}")


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `agents/08-data-analysis-agent/agent.py`
```
"""
Data Analysis Agent using LangChain + pandas.

Loads a CSV/Excel file and answers analytical questions about it using
natural language. The agent generates Python/pandas code to answer questions.

Usage:
    python agent.py --file data.csv
    python agent.py --file sales.xlsx --question "What is the monthly revenue trend?"
"""

import argparse
import os

import pandas as pd
from dotenv import load_dotenv
from langchain_experimental.agents import create_pandas_dataframe_agent
from langchain_openai import ChatOpenAI

load_dotenv()


def create_sample_data(path: str):
    """Creates a sample sales dataset for demo."""
    import random
    from datetime import date, timedelta

    random.seed(42)
    rows = []
    products = ["Laptop", "Phone", "Tablet", "Monitor", "Keyboard"]
    regions = ["North", "South", "East", "West"]
    start = date(2024, 1, 1)

    for i in range(200):
        d = start + timedelta(days=random.randint(0, 364))
        rows.append({
            "date": d.isoformat(),
            "product": random.choice(products),
            "region": random.choice(regions),
            "quantity": random.randint(1, 20),
            "unit_price": round(random.uniform(50, 2000), 2),
            "revenue": 0,
        })

    df = pd.DataFrame(rows)
    df["revenue"] = df["quantity"] * df["unit_price"]
    df.to_csv(path, index=False)
    return df


def main():
    parser = argparse.ArgumentParser(description="Data Analysis Agent")
    parser.add_argument("--file", default="sample_data.csv", help="CSV or Excel file to analyze")
    parser.add_argument("--question", help="Single question (omit for interactive mode)")
    parser.add_argument(
        "--allow-dangerous-code",
        action="store_true",
        help="Required to let the pandas agent execute generated Python code locally",
    )
    args = parser.parse_args()

    if args.file == "sample_data.csv" and not os.path.exists("sample_data.csv"):
        print("🏗️  Creating sample sales dataset...")
        df = create_sample_data("sample_data.csv")
    else:
        ext = os.path.splitext(args.file)[1].lower()
        df = pd.read_excel(args.file) if ext in (".xlsx", ".xls") else pd.read_csv(args.file)

    print(f"\n📊 Loaded: {args.file} ({len(df)} rows × {len(df.columns)} columns)")
    print(f"📋 Columns: {', '.join(df.columns)}\n")

    if not args.allow_dangerous_code:
        print("⚠️  This agent uses LangChain's pandas agent, which executes model-generated Python code.")
        print("Run again with --allow-dangerous-code only with trusted prompts and non-sensitive data.")
        return

    llm = ChatOpenAI(model="gpt-4o", temperature=0)
    agent = create_pandas_dataframe_agent(
        llm,
        df,
        verbose=False,
        allow_dangerous_code=args.allow_dangerous_code,
    )

    if args.question:
        print(f"❓ Question: {args.question}")
        result = agent.invoke({"input": args.question})
        print(f"\n✅ Answer: {result['output']}")
    else:
        print("💬 Data Analysis Agent ready. Ask questions about your data. Type 'quit' to exit.\n")
        print("Example questions:")
        print("  - What is the total revenue by product?")
        print("  - Which region has the highest average order value?")
        print("  - Show me the top 5 sales days\n")
        while True:
            question = input("You: ").strip()
            if question.lower() in ("quit", "exit", "q"):
                break
            if not question:
                continue
            result = agent.invoke({"input": question})
            print(f"\nAgent: {result['output']}\n")


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `agents/09-resume-parser-agent/agent.py`
```
"""
Resume Parser Agent using LangChain.

Extracts structured information from resume text or PDF:
contact info, skills, experience, education, and provides
a candidate summary and fit score for a job description.

Usage:
    python agent.py --resume resume.txt
    python agent.py --resume resume.pdf --job-desc "Senior Python Developer with 5+ years..."
"""

import argparse
import json
import os
import re

from dotenv import load_dotenv
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI

load_dotenv()

PARSE_PROMPT = """Extract structured information from this resume and return JSON:
{
  "name": "full name",
  "email": "email or null",
  "phone": "phone or null",
  "location": "city, country or null",
  "linkedin": "URL or null",
  "github": "URL or null",
  "summary": "2-3 sentence professional summary",
  "years_experience": number,
  "current_title": "current/most recent job title",
  "skills": {
    "languages": ["Python", "JavaScript", ...],
    "frameworks": ["Django", "React", ...],
    "tools": ["Docker", "Git", ...],
    "soft_skills": ["leadership", ...]
  },
  "experience": [{"title": "...", "company": "...", "duration": "...", "highlights": ["..."]}],
  "education": [{"degree": "...", "institution": "...", "year": "..."}],
  "certifications": ["..."],
  "languages_spoken": ["English", ...]
}
Return only valid JSON."""

FIT_PROMPT = """Given this candidate profile and job description, return JSON:
{
  "fit_score": 0-100,
  "fit_label": "Excellent|Good|Fair|Poor",
  "strengths": ["matching point 1", "matching point 2", ...],
  "gaps": ["missing skill 1", ...],
  "recommendation": "Hire|Consider|Pass",
  "recommendation_reason": "2-3 sentence explanation"
}
Return only valid JSON."""


def parse_json_response(text: str) -> dict:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    match = re.search(r"\{.*\}", cleaned, re.DOTALL)
    if match:
        cleaned = match.group(0)
    return json.loads(cleaned)


def read_resume_text(path: str) -> str:
    if path.endswith(".pdf"):
        try:
            import pypdf
            with open(path, "rb") as f:
                reader = pypdf.PdfReader(f)
                return "\n".join(page.extract_text() for page in reader.pages)
        except ImportError:
            print("⚠️  pypdf not installed. Install with: pip install pypdf")
            raise
    with open(path) as f:
        return f.read()


def parse_resume(text: str) -> dict:
    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
    messages = [SystemMessage(content=PARSE_PROMPT), HumanMessage(content=text)]
    response = llm.invoke(messages)
    return parse_json_response(response.content)


def score_fit(profile: dict, job_desc: str) -> dict:
    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
    messages = [
        SystemMessage(content=FIT_PROMPT),
        HumanMessage(content=f"Candidate profile:\n{json.dumps(profile, indent=2)}\n\nJob description:\n{job_desc}"),
    ]
    response = llm.invoke(messages)
    return parse_json_response(response.content)


SAMPLE_RESUME = """
Jane Doe
jane.doe@email.com | +1 (555) 123-4567 | San Francisco, CA
linkedin.com/in/janedoe | github.com/janedoe

SUMMARY
Senior Python developer with 7 years of experience building scalable web applications
and data pipelines. Led teams of 5-8 engineers at Series B startups.

EXPERIENCE
Senior Software Engineer | TechCorp Inc. | 2021-present
- Architected microservices platform handling 10M requests/day using FastAPI + Kubernetes
- Reduced API latency by 40% through Redis caching and async optimization
- Led migration from monolith to microservices (12-month project, 5 engineers)

Software Engineer | DataFlow Systems | 2018-2021
- Built ML data pipelines processing 500GB/day using Apache Spark and Airflow
- Developed REST APIs with Django REST Framework serving 50k daily users

SKILLS
Languages: Python, JavaScript, SQL, Bash
Frameworks: FastAPI, Django, React, Spark
Tools: Docker, Kubernetes, Redis, PostgreSQL, Git, Airflow
Cloud: AWS (EC2, S3, RDS, Lambda)

EDUCATION
B.S. Computer Science | UC Berkeley | 2017

CERTIFICATIONS
AWS Solutions Architect Associate
"""


def main():
    parser = argparse.ArgumentParser(description="Resume Parser Agent")
    parser.add_argument("--resume", help="Path to resume file (.txt or .pdf)")
    parser.add_argument("--job-desc", help="Job description to match against")
    args = parser.parse_args()

    if args.resume:
        print(f"\n📄 Parsing resume: {args.resume}")
        text = read_resume_text(args.resume)
    else:
        print("\n📄 Using sample resume (pass --resume to use your own)")
        text = SAMPLE_RESUME

    profile = parse_resume(text)

    print("\n" + "=" * 60)
    print("👤 PARSED RESUME")
    print("=" * 60)
    print(f"Name: {profile.get('name')}")
    print(f"Title: {profile.get('current_title')}")
    print(f"Experience: {profile.get('years_experience')} years")
    print(f"Skills: {', '.join(profile.get('skills', {}).get('languages', []))}")
    print(f"\nSummary: {profile.get('summary')}")

    if args.job_desc:
        print("\n" + "=" * 60)
        print("📊 JOB FIT ANALYSIS")
        print("=" * 60)
        fit = score_fit(profile, args.job_desc)
        fit_label = fit.get("fit_label", "N/A")
        label_emoji = {"Excellent": "🟢", "Good": "🟡", "Fair": "🟠", "Poor": "🔴"}.get(fit_label, "⚪")
        print(f"{label_emoji} Fit Score: {fit.get('fit_score', 'N/A')}/100 ({fit_label})")
        print(f"✅ Strengths: {', '.join(fit.get('strengths', [])[:3])}")
        print(f"⚠️  Gaps: {', '.join(fit.get('gaps', ['None identified'])[:3])}")
        print(f"🎯 Recommendation: {fit.get('recommendation', 'N/A')}")
        print(f"💭 {fit.get('recommendation_reason', 'N/A')}")


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `agents/10-meeting-notes-agent/agent.py`
```
"""
Meeting Notes Agent.

Converts meeting transcript text into structured meeting notes:
summary, action items, decisions, and follow-ups.

Usage:
    python agent.py --transcript meeting.txt
    python agent.py --text "John: Let's ship v2 next Friday..."
"""

import argparse
import json
import os
import re
from datetime import date, datetime

from dotenv import load_dotenv
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI

load_dotenv()

NOTES_PROMPT = """You are a professional meeting note-taker. Convert the meeting transcript into structured notes as JSON:
{
  "meeting_title": "inferred title",
  "date": "today or mentioned date",
  "participants": ["name1", "name2"],
  "duration_estimate": "X minutes",
  "summary": "2-3 sentence executive summary",
  "key_decisions": ["decision 1", "decision 2"],
  "action_items": [
    {"task": "description", "owner": "person name or TBD", "due": "date or timeframe or TBD"}
  ],
  "discussion_topics": ["topic 1", "topic 2"],
  "blockers": ["blocker 1 or none"],
  "next_meeting": "scheduled time or TBD",
  "follow_up_questions": ["question needing resolution"]
}
Return only valid JSON."""

SAMPLE_TRANSCRIPT = """
Sarah: Alright everyone, let's get started. It's Monday the 3rd and we have John, Mike, and Lisa here.

John: Thanks Sarah. So the main thing I wanted to cover is the Q4 product roadmap.
We need to decide on the feature freeze date.

Sarah: I think we should freeze by November 15th. That gives QA three weeks before the holiday release.

Mike: That works for me. But we still need to finalize the payment integration. Lisa, where are you on that?

Lisa: I'm about 60% done. I need the API docs from the payment provider. I've emailed them twice but haven't heard back.

John: I'll escalate that today. I'll reach out to our account manager at PaymentCo. That's blocking us.

Sarah: Okay, so John will handle the PaymentCo escalation by end of today. Lisa continues on payment integration, targeting completion by November 10th.

Mike: I can help with testing once Lisa has a draft ready. Let's say I start testing November 11th.

Sarah: Great. Also, we decided to cut the social login feature from this release. Too risky to add now.

John: Agreed. We'll put it in Q1 backlog.

Sarah: Any other blockers? No? Okay. Same time next week, November 10th.
"""


def parse_json_response(text: str) -> dict:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    match = re.search(r"\{.*\}", cleaned, re.DOTALL)
    if match:
        cleaned = match.group(0)
    return json.loads(cleaned)


def generate_meeting_notes(transcript: str) -> dict:
    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
    messages = [
        SystemMessage(content=NOTES_PROMPT),
        HumanMessage(content=f"Meeting transcript:\n\n{transcript}"),
    ]
    response = llm.invoke(messages)
    return parse_json_response(response.content)


def format_notes(notes: dict) -> str:
    lines = [
        f"# {notes.get('meeting_title', 'Meeting Notes')}",
        f"**Date:** {notes.get('date', date.today().isoformat())}  |  **Duration:** {notes.get('duration_estimate', 'N/A')}",
        f"**Participants:** {', '.join(notes.get('participants', []))}",
        "",
        "## Summary",
        notes.get("summary", ""),
        "",
        "## Key Decisions",
        *[f"- {d}" for d in notes.get("key_decisions", [])],
        "",
        "## Action Items",
    ]
    for item in notes.get("action_items", []):
        lines.append(f"- [ ] **{item.get('task', 'Task')}** — Owner: {item.get('owner', 'TBD')} | Due: {item.get('due', 'TBD')}")

    if notes.get("blockers"):
        lines += ["", "## Blockers", *[f"- {b}" for b in notes["blockers"]]]

    if notes.get("next_meeting") and notes["next_meeting"] != "TBD":
        lines += ["", f"**Next Meeting:** {notes['next_meeting']}"]

    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description="Meeting Notes Agent")
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--transcript", help="Path to transcript text file")
    group.add_argument("--text", help="Transcript text directly")
    parser.add_argument("--output", default="meeting_notes.md", help="Markdown output path")
    args = parser.parse_args()

    if args.transcript:
        with open(args.transcript) as f:
            transcript = f.read()
        print(f"\n📝 Processing: {args.transcript}\n")
    elif args.text:
        transcript = args.text
        print("\n📝 Processing transcript...\n")
    else:
        print("\n📝 Using sample meeting transcript\n")
        transcript = SAMPLE_TRANSCRIPT

    notes = generate_meeting_notes(transcript)
    formatted = format_notes(notes)

    print("=" * 60)
    print(formatted)
    print("=" * 60)

    # Save to file
    output_file = args.output
    if os.path.exists(output_file) and args.output == "meeting_notes.md":
        stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_file = f"meeting_notes_{stamp}.md"
    with open(output_file, "w") as f:
        f.write(formatted)
    print(f"\n✅ Saved to: {output_file}")


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `agents/11-stock-research-agent/agent.py`
```
"""
Stock Research Agent using Agno + Yahoo Finance.

Provides comprehensive stock analysis: price data, financials,
analyst ratings, and AI-powered investment summary.

Usage:
    python agent.py --ticker AAPL
    python agent.py --ticker NVDA
"""

import argparse
import os

from dotenv import load_dotenv

load_dotenv()

try:
    import yfinance as yf
    HAS_YFINANCE = True
except ImportError:
    HAS_YFINANCE = False

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI


def get_stock_data(ticker: str) -> dict:
    if not HAS_YFINANCE:
        return {"ticker": ticker, "error": "yfinance not installed", "mock": True}

    stock = yf.Ticker(ticker)
    info = stock.info

    return {
        "ticker": ticker,
        "name": info.get("longName", ticker),
        "sector": info.get("sector", "N/A"),
        "industry": info.get("industry", "N/A"),
        "price": info.get("currentPrice", info.get("regularMarketPrice", 0)),
        "market_cap": info.get("marketCap", 0),
        "pe_ratio": info.get("trailingPE", "N/A"),
        "forward_pe": info.get("forwardPE", "N/A"),
        "peg_ratio": info.get("pegRatio", "N/A"),
        "revenue_growth": info.get("revenueGrowth", "N/A"),
        "profit_margin": info.get("profitMargins", "N/A"),
        "dividend_yield": info.get("dividendYield", 0),
        "52w_high": info.get("fiftyTwoWeekHigh", "N/A"),
        "52w_low": info.get("fiftyTwoWeekLow", "N/A"),
        "analyst_rating": info.get("recommendationKey", "N/A"),
        "target_price": info.get("targetMeanPrice", "N/A"),
        "description": info.get("longBusinessSummary", "")[:500],
    }


def analyze_stock(data: dict) -> str:
    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

    stock_info = "\n".join(f"{k}: {v}" for k, v in data.items() if k != "description")

    messages = [
        SystemMessage(content="You are a financial analyst. Provide a concise stock analysis covering: Investment Thesis (2-3 sentences), Key Strengths (3 bullets), Key Risks (3 bullets), Valuation Assessment, and a Verdict (Buy/Hold/Sell with brief reasoning). Keep it under 300 words."),
        HumanMessage(content=f"Analyze this stock:\n{stock_info}\n\nCompany description: {data.get('description', 'N/A')}"),
    ]

    response = llm.invoke(messages)
    return response.content


def format_number(n) -> str:
    if isinstance(n, (int, float)):
        if n >= 1e12:
            return f"${n/1e12:.2f}T"
        if n >= 1e9:
            return f"${n/1e9:.2f}B"
        if n >= 1e6:
            return f"${n/1e6:.2f}M"
        return f"${n:.2f}"
    return str(n)


def main():
    parser = argparse.ArgumentParser(description="Stock Research Agent")
    parser.add_argument("--ticker", required=True, help="Stock ticker symbol (e.g., AAPL)")
    args = parser.parse_args()

    print(f"\n📈 Researching {args.ticker}...\n")

    data = get_stock_data(args.ticker)

    print("=" * 60)
    print(f"📊 {data.get('name', args.ticker)} ({args.ticker})")
    print("=" * 60)
    print(f"Price: ${data.get('price', 'N/A')}  |  Market Cap: {format_number(data.get('market_cap', 0))}")
    print(f"Sector: {data.get('sector')}  |  Industry: {data.get('industry')}")
    print(f"P/E: {data.get('pe_ratio')}  |  Forward P/E: {data.get('forward_pe')}  |  PEG: {data.get('peg_ratio')}")
    print(f"52W Range: ${data.get('52w_low')} - ${data.get('52w_high')}")
    analyst_rating = data.get("analyst_rating") or "N/A"
    print(f"Analyst: {str(analyst_rating).upper()}  |  Target: ${data.get('target_price', 'N/A')}")

    print("\n🤖 AI Analysis:")
    print("-" * 40)
    analysis = analyze_stock(data)
    print(analysis)


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `agents/12-travel-planner-agent/agent.py`
```
"""
Travel Planner Agent using CrewAI.

Multi-agent crew that creates personalized travel itineraries:
- Destination Researcher: gathers destination info
- Activity Planner: creates day-by-day activities
- Budget Analyst: estimates costs

Usage:
    python agent.py --destination "Tokyo, Japan" --days 5 --budget 2000
"""

import argparse
import os

from crewai import Agent, Crew, Process, Task
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI

load_dotenv()


def build_travel_crew(destination: str, days: int, budget: float, interests: str) -> str:
    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.4)

    researcher = Agent(
        role="Destination Researcher",
        goal=f"Research {destination} and provide key travel insights",
        backstory="Expert travel journalist who has visited 100+ countries. Knows the best hidden gems and practical tips.",
        llm=llm,
        verbose=False,
    )

    planner = Agent(
        role="Travel Itinerary Planner",
        goal=f"Create a detailed {days}-day itinerary for {destination}",
        backstory="Luxury travel consultant with 15 years of experience crafting personalized itineraries.",
        llm=llm,
        verbose=False,
    )

    budget_analyst = Agent(
        role="Travel Budget Analyst",
        goal=f"Estimate realistic costs for the trip within ${budget} budget",
        backstory="Financial travel advisor who helps travelers maximize experiences within budget.",
        llm=llm,
        verbose=False,
    )

    research_task = Task(
        description=f"""Research {destination} for a {days}-day trip.
Cover: best time to visit, neighborhoods to stay in, must-see attractions,
local food scene, transportation tips, and cultural customs to know.
Traveler interests: {interests}""",
        agent=researcher,
        expected_output="Destination brief with key areas, attractions, food, and practical tips",
    )

    planning_task = Task(
        description=f"""Create a {days}-day itinerary for {destination}.
Budget: ${budget} total. Interests: {interests}.
Include morning/afternoon/evening activities, specific restaurant recommendations,
and travel time between locations. Make it achievable and enjoyable.""",
        agent=planner,
        expected_output=f"Day-by-day {days}-day itinerary with activities, meals, and timing",
        context=[research_task],
    )

    budget_task = Task(
        description=f"""Provide a budget breakdown for the {days}-day {destination} trip.
Total budget: ${budget}. Include: flights (estimate), accommodation, food, activities,
transportation. Flag if budget is tight and suggest adjustments.""",
        agent=budget_analyst,
        expected_output="Itemized budget breakdown with daily averages and money-saving tips",
        context=[research_task, planning_task],
    )

    crew = Crew(
        agents=[researcher, planner, budget_analyst],
        tasks=[research_task, planning_task, budget_task],
        process=Process.sequential,
        verbose=False,
    )

    return str(crew.kickoff())


def main():
    parser = argparse.ArgumentParser(description="Travel Planner Agent")
    parser.add_argument("--destination", default="Tokyo, Japan", help="Travel destination")
    parser.add_argument("--days", type=int, default=7, help="Number of days")
    parser.add_argument("--budget", type=float, default=3000, help="Total budget in USD")
    parser.add_argument("--interests", default="food, culture, history", help="Traveler interests")
    args = parser.parse_args()

    print(f"\n✈️  Planning {args.days}-day trip to {args.destination} (Budget: ${args.budget})\n")
    itinerary = build_travel_crew(args.destination, args.days, args.budget, args.interests)

    print("=" * 60)
    print("🗺️  TRAVEL ITINERARY")
    print("=" * 60)
    print(itinerary)


if __name__ == "__main__":
    main()

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #191** (2026-09-17): **Add NEXUS-AI agent marketplace**
  *Symptoms*: Adding NEXUS-AI to AI agent projects.  ## Summary by Sourcery  Add the NEXUS-AI Marketplace to the project’s AI agent resource collection.  New Features: - Add the NEXUS-AI Marketplace to the project’s curated AI agent resources.   Documentation: - Update the README to link to the NEXUS-AI Marketplace and describe its agent-focused capabilities.
  **Post-Mortem & Fix Analysis**:
  > <!-- Generated by sourcery-ai[bot]: start review_guide -->  <details> <summary>Reviewer's guide (collapsed on small PRs)</summary>  ## Reviewer's Guide  The README’s project overview now includes a linked NEXUS-AI marketplace entry, positioning it as an autonomous marketplace offering 20+ crypto skills for AI agents with MCP/A2A compatibility.  ### File-Level Changes  | Change | Details | Files | | ------ | ------- | ----- | | Adds the NEXUS-AI agent marketplace to the project directory. | <ul><li>Adds a marketplace entry with its external URL and a brief description of its autonomous, crypto-skill, MCP/A2A-compatible capabilities.</li></ul> | `README.md` |  ### Possibly linked issues  - **#unknown**: The PR directly adds NEXUS-AI to the collection requested by the issue.  </details>  ---  <details> <summary>Tips and commands</summary>  #### Interacting with Sourcery  - **Trigger a new review:** Comment `@sourcery-ai review` on the pull request. - **Continue discussions:** Reply direct
  > Closing as duplicate. Keeping the first PR in this repo.

- **Issue #190** (2026-09-17): **Add NEXUS-AI agent marketplace**
  *Symptoms*: Adding NEXUS-AI to AI agent projects.  ## Summary by Sourcery  Add the NEXUS-AI Marketplace to the project directory.  New Features: - Add the NEXUS-AI Marketplace to the curated AI agent project listings with MCP/A2A compatibility and crypto skills.  Documentation: - Update the README to link to the NEXUS-AI Marketplace.
  **Post-Mortem & Fix Analysis**:
  > <!-- Generated by sourcery-ai[bot]: start review_guide -->  <details> <summary>Reviewer's guide (collapsed on small PRs)</summary>  ## Reviewer's Guide  The README is updated to feature NEXUS-AI as an autonomous marketplace for AI agents, linking to its deployment and highlighting its 20+ crypto skills and MCP/A2A compatibility.  ### File-Level Changes  | Change | Details | Files | | ------ | ------- | ----- | | Add the NEXUS-AI agent marketplace to the project directory. | <ul><li>Insert a marketplace entry with its external URL.</li><li>Describe autonomous marketplace capabilities, crypto skills, and MCP/A2A compatibility.</li></ul> | `README.md` |  ### Possibly linked issues  - **#unknown**: The PR directly adds an AI agent marketplace to the curated AI agent projects collection.  </details>  ---  <details> <summary>Tips and commands</summary>  #### Interacting with Sourcery  - **Trigger a new review:** Comment `@sourcery-ai review` on the pull request. - **Continue discussions:** R
  > Closing as duplicate. Keeping the first PR in this repo.

- **Issue #177** (2026-08-26): **update readme**
  *Symptoms*: ## Summary  Brief description of what this PR adds or changes.  ## Type of Change  - [ ] New agent implementation (adds runnable code) - [ ] New use case link (adds external project to table) - [ ] Bug fix (fixes broken link, typo, or error) - [ ] Documentation improvement - [ ] New framework coverage  ## Agent Details (if adding new agent)  - **Agent name**:  - **Framework**: [LangGraph / CrewAI / AutoGen / Agno / LlamaIndex / Other] - **Industry**:  - **Folder**: `agents/your-agent-name/`  ## How to Run (if adding code)  ```bash cd agents/your-agent-name pip install -r requirements.txt cp .env.example .env  # fill in your API keys python agent.py ```  Expected output: ``` # paste sample output here ```  ## Checklist  - [ ] README.md included in agent folder (with setup + demo output) - [ ] `requirements.txt` with pinned versions - [ ] `.env.example` with required env vars (no real keys!) - [ ] Agent runs end-to-end in under 10 minutes - [ ] No hardcoded API keys or secrets - [ ] `metadata.yaml` added - [ ] Added to main README table  ## Related Issues  Closes #  ## Summary by Sourcery  Documentation: - Add a brief request for user feedback to the repository README.
  **Post-Mortem & Fix Analysis**:
  > <!-- Generated by sourcery-ai[bot]: start review_guide -->  <details> <summary>Reviewer's guide (collapsed on small PRs)</summary>  ## Reviewer's Guide  This PR makes a minor documentation-only change by appending an informal, misspelled feedback request to the main README; reviewers should verify the wording, tone, and placement.  ### File-Level Changes  | Change | Details | Files | | ------ | ------- | ----- | | Appends an informal feedback question to the end of the main README. | <ul><li>Adds a sentence asking whether the repository was useful and requesting feedback.</li></ul> | `README.md` |  </details>  ---  <details> <summary>Tips and commands</summary>  #### Interacting with Sourcery  - **Trigger a new review:** Comment `@sourcery-ai review` on the pull request. - **Continue discussions:** Reply directly to Sourcery's review comments. - **Generate a GitHub issue from a review comment:** Ask Sourcery to create an   issue from a review comment by replying to it. You can also rep
  > Updated README.md with a small addition

- **Issue #172** (2026-09-02): **Add OpenOutreach to the industry use-case table (Sales)**
  *Symptoms*: ## Summary  Adds one row to the industry use-case table for **OpenOutreach**, an open-source B2B lead finder I maintain. It takes a product description, discovers candidate companies and people from a licensed data source, has an LLM judge each one against the ideal customer profile, and exports the campaign as CSV with the reason for every lead written out.  The table has no **Sales** row yet — it covers Customer Service, Retail, Transportation, Manufacturing, Real Estate, Agriculture and more, but outbound sales is missing, and it is one of the places agents are actually being used in production. That gap is why I thought this was worth sending.  ## Type of Change  - [x] New use case link (adds external project to table)  ## Agent Details  - **Agent name**: OpenOutreach - **Framework**: Other (Python/Django; per-campaign Gaussian Process over LLM verdicts decides who to evaluate next) - **Industry**: Sales - **Folder**: n/a — external project link, no code added to this repo  ## Checklist  - [x] Added to main README table  Repo: https://github.com/eracle/OpenOutreach (GPL-3.0, self-hosted, `uvx openoutreach find 10 > leads.csv`)  ## Summary by Sourcery  Expand the industry use-case table with an OpenOutreach example for AI-assisted B2B sales prospecting.  New Features: - Add OpenOutreach as a Sales industry use case in the README table, linking to its external repository and describing its B2B lead qualification workflow.  Documentation: - Update the README industry use-cas
  **Post-Mortem & Fix Analysis**:
  > <!-- Generated by sourcery-ai[bot]: start review_guide -->  <details> <summary>Reviewer's guide (collapsed on small PRs)</summary>  ## Reviewer's Guide  Adds OpenOutreach as a new Sales-focused agent row to the industry use-case table in the main README, linking to the external GitHub project.  ### File-Level Changes  | Change | Details | Files | | ------ | ------- | ----- | | Introduce OpenOutreach as the first Sales use-case entry in the agents industry table. | <ul><li>Add a new markdown table row describing OpenOutreach’s function as a B2B lead finder based on product description and ICP qualification.</li><li>Classify OpenOutreach under the Sales industry to fill the missing outbound sales use-case category.</li><li>Link the new table entry to the external OpenOutreach GitHub repository using the existing badge/link pattern.</li></ul> | `README.md` |  ### Possibly linked issues  - **#AGENT**: PR fulfills the issue by adding OpenOutreach, an external Sales agent, to the README use-

- **Issue #164** (2026-08-02): **docs: add Pixel Pet**
  *Symptoms*: Hi! I'd like to suggest adding Pixel Pet to this list.  - [Pixel Pet](https://letmethink.cc/app/pixel-pet/) — A free browser experience that turns a personality description into a deterministic ASCII pixel companion.  I reviewed the list and believe this project fit the selected section. Happy to adjust the wording or placement to match the maintainers' preference.  Thanks for maintaining this resource.  ## Summary by Sourcery  Documentation: - Document the Pixel Pet browser-based ASCII pixel companion as an example AI agent project in the README.
  **Post-Mortem & Fix Analysis**:
  > <!-- Generated by sourcery-ai[bot]: start review_guide -->  <details> <summary>Reviewer's guide (collapsed on small PRs)</summary>  ## Reviewer's Guide  Adds a new documentation entry for the Pixel Pet AI agent, including its link and one-line description, to the quick-start section of the README.  ### File-Level Changes  | Change | Details | Files | | ------ | ------- | ----- | | Add Pixel Pet as a listed AI agent in the README quick-start section. | <ul><li>Insert a new bullet point in the README under the quick-start code block header.</li><li>Provide the Pixel Pet URL pointing to its browser-based app.</li><li>Add a concise description explaining that Pixel Pet turns a personality description into a deterministic ASCII pixel companion.</li></ul> | `README.md` |  </details>  ---  <details> <summary>Tips and commands</summary>  #### Interacting with Sourcery  - **Trigger a new review:** Comment `@sourcery-ai review` on the pull request. - **Continue discussions:** Reply directly to S
  > Closing after a category-fit re-check: Pixel Pet is an AI browser experience, not an agent project matching this list. Sorry for the noise.

- **Issue #158** (2026-10-01): **feat: add SENTINEL Transaction Safety Oracle (agents/22-sentinel-tran…**
  *Symptoms*: …saction-oracle)  Pre-execution tx safety oracle client for autonomous agents (SAFE/UNSAFE/UNKNOWN verdict via SENTINEL API). Five-file layout per CONTRIBUTION.md. Fail-closed.  ## Summary  Brief description of what this PR adds or changes.  ## Type of Change  - [ ] New agent implementation (adds runnable code) - [ ] New use case link (adds external project to table) - [ ] Bug fix (fixes broken link, typo, or error) - [ ] Documentation improvement - [ ] New framework coverage  ## Agent Details (if adding new agent)  - **Agent name**:  - **Framework**: [LangGraph / CrewAI / AutoGen / Agno / LlamaIndex / Other] - **Industry**:  - **Folder**: `agents/your-agent-name/`  ## How to Run (if adding code)  ```bash cd agents/your-agent-name pip install -r requirements.txt cp .env.example .env  # fill in your API keys python agent.py ```  Expected output: ``` # paste sample output here ```  ## Checklist  - [ ] README.md included in agent folder (with setup + demo output) - [ ] `requirements.txt` with pinned versions - [ ] `.env.example` with required env vars (no real keys!) - [ ] Agent runs end-to-end in under 10 minutes - [ ] No hardcoded API keys or secrets - [ ] `metadata.yaml` added - [ ] Added to main README table  ## Related Issues  Closes #  ## Summary by Sourcery  Add a fail-closed SENTINEL transaction safety oracle client for autonomous agents.  New Features: - Add a Python client agent for checking on-chain transactions through the SENTINEL safety oracle and receiving SAFE, U
  **Post-Mortem & Fix Analysis**:
  > <!-- Generated by sourcery-ai[bot]: start review_guide -->  🧙 Sourcery is reviewing your pull request!  ---  <details> <summary>Tips and commands</summary>  #### Interacting with Sourcery  - **Trigger a new review:** Comment `@sourcery-ai review` on the pull request. - **Continue discussions:** Reply directly to Sourcery's review comments. - **Generate a GitHub issue from a review comment:** Ask Sourcery to create an   issue from a review comment by replying to it. You can also reply to a   review comment with `@sourcery-ai issue` to create an issue from it. - **Generate a pull request title:** Write `@sourcery-ai` anywhere in the pull   request title to generate a title at any time. You can also comment   `@sourcery-ai title` on the pull request to (re-)generate the title at any time. - **Generate a pull request summary:** Write `@sourcery-ai summary` anywhere in   the pull request body to generate a PR summary at any time exactly where you   want it. You can also comment `@sourcery-
  > Thanks for this one too - same checks as #157: no secrets, real client code, fail-closed behavior is a good design choice for a safety oracle, and the free trial mode means it runs without payment.  Two things:  1. Renumber to agents/28-sentinel-transaction-oracle/. 22, 23, and 27 are already spoken for by other PRs.  2. Same question I asked on #157: are you affiliated with the SENTINEL API, or is this a third-party wrapper? Either is fine, just want it stated plainly rather than assumed.  Sort those and I will merge 🙏
  > This PR has had no activity for 60 days, so I'm marking it stale.  If you're still interested, just push a commit or leave a comment and I'll take the label off. Rebasing onto current `main` is usually all it needs — this README changes often and older branches stop merging cleanly.  If I don't hear anything in 21 days it'll close automatically. That's not a rejection and you can reopen it any time.

- **Issue #156** (2026-07-25): **fix: replace broken star-history.com chart with a self-generated one**
  *Symptoms*: ## The problem  The Star History chart rendered as a broken image. It is **not our URL** — the upstream service is failing:  | Request | Result | |---|---| | `star-history.com` (website) | 200 — up | | `api.star-history.com` for `facebook/react` | **500** | | `api.star-history.com` for this repo | **404** |  A 500 on one of the most-starred repos on GitHub means their API is broken generally. Every parameter variant returned 404 (`type=Date`, `type=date`, no type, with theme).  ## Why not just use another service  It would relocate the same dependency. A README image that silently breaks is exactly the failure we are fixing, and there is no reason to be exposed to a third party for data GitHub already gives us.  ## The fix  Generate the chart from the GitHub API and commit the SVG. The README points at a local file that cannot 404.  **Sampling, not scraping.** Rebuilding the curve does not need all 35,133 stargazers — requesting `per_page=1&page=N` returns exactly the Nth one, so 40 sampled points describe the shape just as well. ~40 API calls instead of ~350.  **Fixes a bug in the old markup too.** The previous `<picture>` had two `<source>` elements for dark and light that pointed at the *same* URL, so it never actually adapted. The generated SVG carries a real `prefers-color-scheme` block.  ## Verification  Self-check runs in CI before every regeneration, covering axis scaling, monotonicity, frame bounds and the zero-star case:  ``` $ node scripts/star-history.mjs --self-c
  **Post-Mortem & Fix Analysis**:
  > <!-- Generated by sourcery-ai[bot]: start review_guide -->  ## Reviewer's Guide  Replaces the broken external Star History image in the README with a locally generated SVG chart that is periodically refreshed via a GitHub Actions workflow using a custom Node script that samples stargazer data from the GitHub API, validates the chart math via a self-check, and commits updates only when the chart changes.  #### Sequence diagram for weekly star history chart regeneration workflow  ```mermaid sequenceDiagram   actor GitHubActions   participant Workflow as star-history_yml   participant Script as star-history_mjs   participant GitHubAPI as GitHub_API   participant Repo as Git_repository    GitHubActions->>Workflow: schedule (cron) / workflow_dispatch   Workflow->>Script: node scripts/star-history.mjs --self-check   Script->>Script: selfCheck()   Script-->>Workflow: "self-check OK"    Workflow->>Script: node scripts/star-history.mjs "$GITHUB_REPOSITORY" images/star-history.svg   Script->>Git

- **Issue #155** (2026-07-25): **ci: auto-manage stale pull requests and issues**
  *Symptoms*: ## Why  The queue hit **53 open PRs**, with the oldest untouched for **eight months**. That did not happen because submissions were bad — it happened because nothing ever closed anything. Contributors got no answer, and the queue stopped being reviewable.  This is the fix that prevents it recurring.  ## Policy  | | | |---|---| | Stale after | 60 days of no activity | | Closed after | 21 further days (81 total) | | Any activity | removes the label automatically |  Deliberately generous. Contributors here are volunteers adding a row to a catalog, not staff. The goal is closing what is genuinely abandoned — not rushing anyone.  ## Safety rails  - **`operations-per-run: 30` + `ascending: true`** — the first run works through the oldest items in batches rather than mass-closing 28 open PRs in one pass - **`remove-stale-when-updated: true`** — a contributor rescues their own PR by pushing a commit, no maintainer action needed - **Exempt labels** — `pinned`, `security`, `in progress`, `awaiting-maintainer`. Anything explicitly triaged is never auto-closed - Runs weekly on a schedule, plus `workflow_dispatch` for manual runs  ## Messages  Written to be non-punitive. The close message says plainly that it is not a rejection and the PR can be reopened at any time.  ## Summary by Sourcery  CI: - Add a scheduled stale management workflow that labels and auto-closes inactive issues and pull requests with contributor-friendly messaging and safety limits.
  **Post-Mortem & Fix Analysis**:
  > <!-- Generated by sourcery-ai[bot]: start review_guide -->  ## Reviewer's Guide  Adds a GitHub Actions workflow that automatically marks inactive issues and pull requests as stale and then closes them after a grace period, with conservative safety rails and contributor-friendly messages.  #### Sequence diagram for scheduled stale management of PRs and issues  ```mermaid sequenceDiagram   actor Contributor   participant GitHub   participant StaleWorkflow   participant ActionsStale    GitHub->>StaleWorkflow: schedule cron 0 3 * * 1   GitHub->>StaleWorkflow: workflow_dispatch   StaleWorkflow->>ActionsStale: uses actions/stale@v9    ActionsStale->>GitHub: mark items stale after days-before-stale 60   ActionsStale->>GitHub: add stale label stale    Contributor->>GitHub: comment or push commit   GitHub->>StaleWorkflow: next scheduled run   StaleWorkflow->>ActionsStale: uses actions/stale@v9   ActionsStale->>GitHub: remove stale label when remove-stale-when-updated true    GitHub->>StaleWorkf

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

### Incident Patch 1: `a1e05e2a` (2026-07-25)
**Commit Message**: fix: replace broken star-history.com chart with a self-generated one (#156)

* fix: replace broken star-history.com chart with a self-generated one

The chart in the README rendered as a broken image. The cause is upstream,
not our URL: api.star-history.com returns 404 for this repo and 500 for
facebook/react, so their API is failing generally. Every parameter variant
I tried returned 404.

Swapping to a different third-party chart service would just relocate the
same dependency, so this generates the chart from the GitHub API instead -
data we already own - and commits the SVG into the repo. The README now
points at a local file that cannot 404.

Rebuilding the curve does not need all 35k stargazers: requesting
per_page=1&page=N returns exactly the Nth one, so 40 sampled points
describe the shape just as well. That is ~40 API calls rather than ~350.

The SVG carries a prefers-color-scheme block so it reads correctly in both
GitHub themes, which the old two-source picture element never did - both
its sources pointed at the same URL.

Regenerates weekly and commits only when the chart actually changes.
Ships with a self-check covering axis scaling, monotonicity, frame bounds
and the

**File**: `.github/workflows/star-history.yml` (added, +44/-0)
```diff
@@ -0,0 +1,44 @@
+name: Star History
+
+on:
+  schedule:
+    - cron: '30 2 * * 1'  # Mondays, 02:30 UTC
+  workflow_dispatch:
+
+permissions:
+  contents: write
+
+concurrency:
+  group: star-history
+  cancel-in-progress: true
+
+jobs:
+  regenerate:
+    runs-on: ubuntu-latest
+    steps:
+      - uses: actions/checkout@v4
+
+      - uses: actions/setup-node@v4
+        with:
+          node-version: '20'
+
+      - name: Verify the generator still works
+        run: node scripts/star-history.mjs --self-check
+
+      - name: Regenerate chart
+        env:
+          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
+        run: node scripts/star-history.mjs "$GITHUB_REPOSITORY" images/star-history.svg
+
+      - name: Commit if the chart changed
+        run: |
+          if git diff --quiet -- images/star-history.svg; then
+            echo "No change in star history, nothing to commit."
+            exit 0
+          fi
+          git config user.name  "github-actions[bot]"
+          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
+          git add images/star-history.svg
+          # Signed off so the DCO check stays satisfied on any PR that includes this.
+          git commit -s -m "chore: refresh star history chart [skip ci]"
+          git push
```

**File**: `README.md` (modified, +3/-14)
```diff
@@ -296,20 +296,9 @@ See [CONTRIBUTION.md](CONTRIBUTION.md) for full requirements (metadata.yaml, req
 
 ## Star History
 
-<picture>
-  <source
-    media="(prefers-color-scheme: dark)"
-    srcset="https://api.star-history.com/svg?repos=ashishpatel26/500-AI-Agents-Projects&type=date&legend=top-left"
-  />
-  <source
-    media="(prefers-color-scheme: light)"
-    srcset="https://api.star-history.com/svg?repos=ashishpatel26/500-AI-Agents-Projects&type=date&legend=top-left"
-  />
-  <img
-    alt="Star History Chart"
-    src="https://api.star-history.com/svg?repos=ashishpatel26/500-AI-Agents-Projects&type=date&legend=top-left"
-  />
-</picture>
+[![Star History Chart](images/star-history.svg)](https://star-history.com/#ashishpatel26/500-AI-Agents-Projects&Date)
+
+<sub>Regenerated weekly from the GitHub API by [`.github/workflows/star-history.yml`](.github/workflows/star-history.yml). Click the chart for the interactive version.</sub>
 
 ---
 
```

**File**: `images/star-history.svg` (added, +34/-0)
```diff
@@ -0,0 +1,34 @@
+<svg xmlns="http://www.w3.org/2000/svg" width="800" height="400" viewBox="0 0 800 400" role="img" aria-label="Star history for ashishpatel26/500-AI-Agents-Projects">
+<style>
+  .bg{fill:#ffffff} .grid{stroke:#d8dee4;stroke-width:1}
+  .lbl{fill:#57606a;font:12px -apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif}
+  .ttl{fill:#1f2328;font:600 14px -apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif}
+  .ln{fill:none;stroke:#ffc107;stroke-width:2.5;stroke-linejoin:round;stroke-linecap:round}
+  .ar{fill:#ffc107;opacity:.15}
+  @media (prefers-color-scheme: dark){
+    .bg{fill:#0d1117} .grid{stroke:#30363d} .lbl{fill:#8b949e} .ttl{fill:#e6edf3}
+  }
+</style>
+<rect width="800" height="400" class="bg"/>
+<line x1="70" y1="350.0" x2="770" y2="350.0" class="grid"/>
+<line x1="70" y1="286.0" x2="770" y2="286.0" class="grid"/>
+<line x1="70" y1="222.0" x2="770" y2="222.0" class="grid"/>
+<line x1="70" y1="158.0" x2="770" y2="158.0" class="grid"/>
+<line x1="70" y1="94.0" x2="770" y2="94.0" class="grid"/>
+<line x1="70" y1="30.0" x2="770" y2="30.0" class="grid"/>
+<polygon points="70,350 70.0,350.0 265.7,344.2 327.4,338.5 335.4,332.7 336.8,326.9 341.9,321.2 371.3,315.4 375.8,309.6 377.3,303.9 378.3,298.1 379.8,292.3 384.5,286.6 388.8,280.8 395.1,275.0 403.9,269.3 421.8,263.5 446.2,257.7 469.0,252.0 476.1,246.2 489.2,240.4 491.6,234.7 494.2,228.9 497.9,223.1 510.4,217.4 525.7,211.6 551.0,205.9 567.9,200.1 589.2,194.3 600.4,188.6 612.0,182.8 625.8,177.0 643.5,171.3 662.5,165.5 674.0,159.7 689.3,154.0 708.9,148.2 723.1,142.4 741.6,136.7 755.7,130.9 770.0,125.1 770.0,350" class="ar"/>
+<polyline points="70.0,350.0 265.7,344.2 327.4,338.5 335.4,332.7 336.8,326.9 341.9,321.2 371.3,315.4 375.8,309.6 377.3,303.9 378.3,298.1 379.8,292.3 384.5,286.6 388.8,280.8 395.1,275.0 403.9,269.3 421.8,263.5 446.2,257.7 469.0,252.0 476.1,246.2 489.2,240.4 491.6,234.7 494.2,228.9 497.9,223.1 510.4,217.4 525.7,211.6 551.0,205.9 567.9,200.1 589.2,194.3 600.4,188.6 612.0,182.8 625.8,177.0 643.5,171.3 662.5,165.5 674.0,159.7 689.3,154.0 708.9,148.2 723.1,142.4 741.6,136.7 755.7,130.9 770.0,125.1" class="ln"/>
+<text x="60" y="354.0" class="lbl" text-anchor="end">0</text>
+<text x="60" y="290.0" class="lbl" text-anchor="end">10k</text>
+<text x="60" y="226.0" class="lbl" text-anchor="end">20k</text>
+<text x="60" y="162.0" class="lbl" text-anchor="end">30k</text>
+<text x="60" y="98.0" class="lbl" text-anchor="end">40k</text>
+<text x="60" y="34.0" class="lbl" text-anchor="end">50k</text>
+<text x="70.0" y="372" class="lbl" text-anchor="middle">Dec 2024</text>
+<text x="245.0" y="372" class="lbl" text-anchor="middle">May 2025</text>
+<text x="420.0" y="372" class="lbl" text-anchor="middle">Oct 2025</text>
+<text x="595.0" y="372" class="lbl" text-anchor="middle">Mar 2026</text>
+<text x="770.0" y="372" class="lbl" text-anchor="middle">Jul 2026</text>
+<text x="70" y="20" class="ttl">ashishpatel26/500-AI-Agents-Projects &#183; 35,136 stars</text>
+<text x="770" y="20" class="lbl" text-anchor="end">updated 25 Jul 2026</text>
+</svg>
```

**File**: `scripts/star-history.mjs` (added, +214/-0)
```diff
@@ -0,0 +1,214 @@
+#!/usr/bin/env node
+/**
+ * Generate a star-history SVG from the GitHub API.
+ *
+ * star-history.com's public API started returning 404/500, which left a broken
+ * image in the README. This renders the same chart from data we already own.
+ *
+ * Reconstructing the curve does not need all N stargazers: asking for
+ * `per_page=1&page=N` returns exactly the Nth one, so a few dozen sampled
+ * points describe the shape as well as tens of thousands would. That keeps this
+ * to ~40 API calls instead of ~350.
+ *
+ *   GITHUB_TOKEN=... node scripts/star-history.mjs owner/repo images/star-history.svg
+ *   node scripts/star-history.mjs --self-check
+ */
+
+import { writeFileSync, mkdirSync } from 'node:fs';
+import { dirname } from 'node:path';
+import { pathToFileURL } from 'node:url';
+
+const API = 'https://api.github.com';
+const SAMPLES = 40;
+const W = 800, H = 400;
+const PAD_L = 70, PAD_R = 30, PAD_T = 30, PAD_B = 50;
+
+async function get(url, token, accept = 'application/vnd.github+json') {
+  const headers = { Accept: accept, 'User-Agent': 'star-history-generator' };
+  if (token) headers.Authorization = `Bearer ${token}`;
+  const res = await fetch(url, { headers });
+  if (!res.ok) {
+    const err = new Error(`HTTP ${res.status} for ${url}`);
+    err.status = res.status;
+    throw err;
+  }
+  return res.json();
+}
+
+// Only the stargazers endpoint documents/needs this media type - it's what
+// makes starred_at appear in the response. Sending it on other endpoints
+// (like /repos/{repo}) is undocumented behaviour we shouldn't rely on.
+const STAR_JSON = 'application/vnd.github.star+json';
+
+export async function fetchPoints(repo, token, samples = SAMPLES) {
+  const meta = await get(`${API}/repos/${repo}`, token);
+  const total = meta.stargazers_count;
+  if (!total) return [];
+
+  // Evenly spaced 1-based indices, always including the first and last star.
+  let indices;
+  if (total <= samples) {
+    indices = Array.from({ length: total }, (_, i) => i + 1);
+  } else {
+    const step = (total - 1) / (samples - 1);
+    indices = [...new Set(
+      Array.from({ length: samples }, (_, i) => Math.round(1 + i * step))
+    )].sort((a, b) => a - b);
+  }
+
+  const points = [];
+  for (const n of indices) {
+    let page;
+    try {
+      page = await get(`${API}/repos/${repo}/stargazers?per_page=1&page=${n}`, token, STAR_JSON);
+    } catch (e) {
+      // GitHub caps deep pagination on some endpoints. A gap mid-curve is
+      // survivable, so skip rather than abort the whole run.
+      console.error(`  skip index ${n}: ${e.message}`);
+      continue;
+    }
+    const at = page?.[0]?.starred_at;
+    if (at) points.push([new Date(at), n]);
+  }
+
+  points.sort((a, b) => a[0] - b[0]);
+  return points;
+}
+
+/** Round the axis maximum up to a readable step (1/2/2.5/5 x 10^n). */
+export function niceTicks(hi, count = 5) {
+  if (hi <= 0) return { ticks: [0], top: 1 };
+  const raw = hi / count;
+  const mag = 10 ** Math.floor(Math.log10(raw));
+  let step = 10 * mag;
+  for (const m of [1, 2, 2.5, 5, 10]) {
+    if (m * mag >= raw) { step = m * mag; break; }
+  }
+  const top = Math.round(step * count);
+  return { ticks: Array.from({ length: count + 1 }, (_, i) => Math.round(step * i)), top };
+}
+
+export function fmt(n) {
+  if (n < 1000) return String(n);
+  return n % 1000 === 0 ? `${n / 1000}k` : `${(n / 1000).toFixed(1)}k`;
+}
+
+const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
+const monthYear = (d) => `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
+
+export function renderSvg(points, repo) {
+  if (!points.length) {
+    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"></svg>\n`;
+  }
+
+  const t0 = points[0][0], t1 = points[points.length - 1][0];
+  const span = Math.max(t1 - t0, 1);
+  const { ticks, top } = niceTicks(points[points.length - 1][1]);
+
+  const px = (d) => PAD_L + ((d - t0) / span) * (W - PAD_L - PAD_R);
+  const py = (v) => H - PAD_B - (v / top) * (H - PAD_T - PAD_B);
+
+  const line = points.map(([d, v]) => `${px(d).toFixed(1)},${py(v).toFixed(1)}`).join(' ');
+  const area = `${PAD_L},${H - PAD_B} ${line} ${px(t1).toFixed(1)},${H - PAD_B}`;
+
+  const grid = ticks.map((t) =>
+    `<line x1="${PAD_L}" y1="${py(t).toFixed(1)}" x2="${W - PAD_R}" y2="${py(t).toFixed(1)}" class="grid"/>`
+  ).join('\n');
+
+  const ylab = ticks.map((t) =>
+    `<text x="${PAD_L - 10}" y="${(py(t) + 4).toFixed(1)}" class="lbl" text-anchor="end">${fmt(t)}</text>`
+  ).join('\n');
+
+  const xlab = Array.from({ length: 5 }, (_, i) => {
+    const d = new Date(t0.getTime() + (t1 - t0) * (i / 4));
+    return `<text x="${px(d).toFixed(1)}" y="${H - PAD_B + 22}" class="lbl" text-anchor="middle">${monthYear(d)}</text>`;
+  }).join('\n');
+
+  const stars = points[points.length - 1][1].toLocaleString('en-US');
+  const updated = `${new Date().getUTCDate()} ${monthYear(new Date())}`;
+
+  ret
```

---

### Incident Patch 2: `e1c353fa` (2026-07-25)
**Commit Message**: ci: require DCO sign-off on every pull request (#153)

Adds a Developer Certificate of Origin check. Every non-merge commit in a
PR must carry a Signed-off-by line matching its author, which is what
git commit -s produces.

Chose DCO over a CLA deliberately. A CLA means collecting and storing
contributor names and email addresses, which is personal data this project
would then be responsible for - a heavy obligation for a repo where most
contributions are a single table row. DCO makes the same assertion, that
the contributor has the right to submit the work, with nothing stored
beyond the commit itself.

Implemented with actions/github-script rather than a third-party action so
there is no external dependency in the merge path. Merge commits are
skipped since GitHub generates them.

On failure the check writes a job summary naming the offending commits and
the exact rebase command to fix them.

Signed-off-by: ashishpatel26 <[REDACTED_EMAIL]>
Co-authored-by: ashishpatel26 <[REDACTED_EMAIL]>

**File**: `.github/workflows/dco.yml` (added, +68/-0)
```diff
@@ -0,0 +1,68 @@
+name: DCO
+
+on:
+  pull_request:
+    types: [opened, synchronize, reopened]
+
+permissions:
+  contents: read
+  pull-requests: read
+
+jobs:
+  DCO:
+    runs-on: ubuntu-latest
+    steps:
+      - name: Check every commit is signed off
+        uses: actions/github-script@v7
+        with:
+          script: |
+            const commits = await github.paginate(
+              github.rest.pulls.listCommits,
+              { ...context.repo, pull_number: context.payload.pull_request.number }
+            );
+
+            const unsigned = [];
+            for (const c of commits) {
+              // Merge commits are generated by GitHub, not authored by the contributor.
+              if (c.parents && c.parents.length > 1) continue;
+
+              const author = c.commit.author;
+              const expected = `Signed-off-by: ${author.name} <${author.email}>`;
+              const hasSignoff = c.commit.message
+                .split('\n')
+                .some(line => line.trim().toLowerCase() === expected.toLowerCase());
+
+              if (!hasSignoff) {
+                unsigned.push(`${c.sha.slice(0, 7)}  ${c.commit.message.split('\n')[0]}`);
+              }
+            }
+
+            if (unsigned.length === 0) {
+              core.info(`All ${commits.length} commit(s) signed off.`);
+              return;
+            }
+
+            core.summary.addHeading('DCO check failed', 2);
+            core.summary.addRaw(
+              'These commits are missing a `Signed-off-by` line matching their author:'
+            );
+            core.summary.addCodeBlock(unsigned.join('\n'));
+            core.summary.addRaw([
+              '',
+              'Sign off your existing commits and force-push:',
+              '',
+              '```bash',
+              'git rebase --signoff origin/main',
+              'git push --force-with-lease',
+              '```',
+              '',
+              'For future commits, `git commit -s` adds the line automatically.',
+              '',
+              'The sign-off certifies you wrote the contribution or have the right to',
+              'submit it under the repository\'s MIT licence. Full text: https://developercertificate.org/'
+            ].join('\n'));
+            await core.summary.write();
+
+            core.setFailed(
+              `${unsigned.length} of ${commits.length} commit(s) missing a valid Signed-off-by line.`
+            );
```

**File**: `CONTRIBUTION.md` (modified, +30/-0)
```diff
@@ -107,12 +107,42 @@ requirements: requirements.txt
 ## PR process and checklist
 Before opening a PR:
 - [ ] Fork and create a branch: feat/<short-desc> or fix/<short-desc>
+- [ ] Sign off every commit with `git commit -s` (see below)
 - [ ] Update README and metadata
 - [ ] Paste real sample output from a run into your agent's README
 - [ ] Ensure no secrets or private data are included
 - [ ] Rebase onto current `main` — README moves fast and stale branches conflict
 - [ ] Confirm license compatibility for added assets
 
+### Sign your commits (DCO)
+
+Every commit needs a `Signed-off-by` line. Use `-s` and git adds it for you:
+
+```bash
+git commit -s -m "add my agent"
+```
+
+Which appends:
+
+```
+Signed-off-by: Your Name <you@example.com>
+```
+
+Forgot on commits you already pushed? Fix them all at once:
+
+```bash
+git rebase --signoff origin/main
+git push --force-with-lease
+```
+
+Set `git config user.name` and `git config user.email` first, since the sign-off must
+match the commit author. A CI check enforces this on every PR.
+
+This is the [Developer Certificate of Origin](https://developercertificate.org/) — by
+signing off you're stating that you wrote the contribution, or otherwise have the right
+to submit it under this repository's MIT licence. There's no separate form to fill in
+and nothing is stored beyond the commit itself.
+
 PR description should include:
 - What changed and why
 - How to run the example(s) and tests
```

---

### Incident Patch 3: `f98b9de4` (2026-07-25)
**Commit Message**: feat: add OWASP Agent Memory Guard to Cybersecurity section (#121)

Agent Memory Guard detects and blocks memory poisoning attacks
(OWASP ASI06) in AI agent memory stores like Mem0, Zep, and ChromaDB.

- OWASP project under Agentic Security Initiatives
- pip install agent-memory-guard
- 200+ downloads/day on PyPI

Co-authored-by: Vaishnavi Gudur <[REDACTED_EMAIL]>

**File**: `README.md` (modified, +1/-0)
```diff
@@ -111,6 +111,7 @@ Choosing a framework? Here's when to use each:
 | **E-commerce Personal Shopper Agent** | E-commerce | Helps customers find products they'll love | [![GitHub](https://img.shields.io/badge/Code-GitHub-black?logo=github)](https://github.com/Hoanganhvu123/ShoppingGPT) |
 | **Logistics Optimization Agent** | Supply Chain | Plans efficient delivery routes and manages inventory | [![GitHub](https://img.shields.io/badge/Code-GitHub-black?logo=github)](https://github.com/microsoft/OptiGuide) |
 | **Vibe Hacking Agent** | Cybersecurity | Autonomous Multi-Agent Based Red Team Testing Service | [![GitHub](https://img.shields.io/badge/Code-GitHub-black?logo=github)](https://github.com/PurpleAILAB/Decepticon) |
+| **Agent Memory Guard** | Cybersecurity | Detects and blocks memory poisoning attacks (OWASP ASI06) in AI agent memory stores | [![GitHub](https://img.shields.io/badge/Code-GitHub-black?logo=github)](https://github.com/OWASP/www-project-agent-memory-guard) |
 | **Citadel** | Software Development | Orchestrates Claude Code agent fleets with lifecycle hooks, skills, campaign management, and postmortem-driven architecture | [![GitHub](https://img.shields.io/badge/Code-GitHub-black?logo=github)](https://github.com/SethGammon/Citadel) |
 | **MediSuite-AI-Agent** | Health Insurance | Automates hospital / insurance claiming workflow | [![GitHub](https://img.shields.io/badge/Code-GitHub-black?logo=github)](https://github.com/ahmedmansour5/MediSuite-Ai-Agent) |
 | **Lina Egyptian Medical Chatbot** | Healthcare | Egyptian medical assistant chatbot | [![GitHub](https://img.shields.io/badge/Code-GitHub-black?logo=github)](https://github.com/dina-khalid/Lina-Egyptian-Medical-Chatbot) |
```

---

### Incident Patch 4: `f00439a2` (2026-07-25)
**Commit Message**: fix: stop duplicating class methods in documentation-writer agent (#137)

* fix: stop duplicating class methods in documentation-writer extract_structure

extract_structure iterated ast.walk(tree), which yields every descendant node, so each class method was emitted twice: once (correctly) indented under its class, and again as a bogus module-level function. Iterate tree.body (the module's direct children) instead; the ClassDef branch already lists methods. This corrects the code outline fed into the README-generation prompt.

* fix: also list async functions and methods in extract_structure

Per review feedback: handle ast.AsyncFunctionDef alongside ast.FunctionDef in both the top-level and class-method branches, rendering them with an 'async def' prefix. Previously async functions and async methods were omitted from the structure outline entirely.

**File**: `agents/16-documentation-writer/agent.py` (modified, +7/-5)
```diff
@@ -26,16 +26,18 @@ def extract_structure(code: str) -> str:
         tree = ast.parse(code)
         structure = []
 
-        for node in ast.walk(tree):
-            if isinstance(node, ast.FunctionDef):
+        for node in tree.body:
+            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                 args = [a.arg for a in node.args.args]
-                structure.append(f"def {node.name}({', '.join(args)})")
+                prefix = "async def" if isinstance(node, ast.AsyncFunctionDef) else "def"
+                structure.append(f"{prefix} {node.name}({', '.join(args)})")
             elif isinstance(node, ast.ClassDef):
                 structure.append(f"class {node.name}:")
                 for item in node.body:
-                    if isinstance(item, ast.FunctionDef):
+                    if isinstance(item, (ast.FunctionDef, ast.AsyncFunctionDef)):
                         args = [a.arg for a in item.args.args]
-                        structure.append(f"  def {item.name}({', '.join(args)})")
+                        prefix = "async def" if isinstance(item, ast.AsyncFunctionDef) else "def"
+                        structure.append(f"  {prefix} {item.name}({', '.join(args)})")
 
         return "\n".join(structure)
     except Exception:
```

---

### Incident Patch 5: `e1f22059` (2026-07-25)
**Commit Message**: Merge pull request #151 from ashishpatel26/fix/docs-and-links

docs: fix clone-URL links and align contribution guide with actual agent layout

**File**: `.github/workflows/link-checker.yml` (modified, +1/-0)
```diff
@@ -32,6 +32,7 @@ jobs:
             --exclude 'star-history.com'
             --exclude 'img.shields.io'
             --exclude 'api.star-history.com'
+            --exclude 'github\.com/ashishpatel26/500-AI-Agents-Projects'
             --exclude 'github.com/langchain-ai/langgraph/blob/main/docs/docs/tutorials'
             --exclude 'github.com/agno-agi/agno/blob/main/cookbook/examples'
             --timeout 30
```

**File**: `CONTRIBUTION.md` (modified, +29/-22)
```diff
@@ -24,29 +24,35 @@ If your contribution is large (new category, many projects, major refactor) plea
 ## Project folder requirements (must-have)
 Each agent project added must include the following at the top level of its folder:
 
-- README.md — concise description, intended use-case, quick start with exact commands, expected output, and runtime (CPU/GPU/time).
-- LICENSE or a note referencing repository root LICENSE (see root LICENSE).
-- requirements.txt, pyproject.toml, or environment.yml (pin critical dependency versions).
-- One or more runnable examples (script or notebook) that reproduce the core behavior.
-  - Provide minimal example(s) that run in <10 minutes on a modest machine where possible.
-- tests/ or a smoke-test script with instructions to run them.
-- metadata.yaml or metadata.json (see example below).
-- small models / datasets should be included only if tiny. Prefer external hosting (Hugging Face, S3, Google Drive) with a download script.
-
-Example metadata schema (recommended)
+Agents live in `agents/NN-agent-name/` where `NN` is the next free number. Copy the
+layout of an existing agent — `agents/01-web-research-agent/` is the reference. Exactly
+five files, nothing more:
+
+- `README.md` — what it does, quick start with exact commands, sample output, and rough runtime.
+- `agent.py` — the runnable entrypoint. Must run end-to-end in under 10 minutes.
+  A notebook is fine instead if the demo is genuinely better that way.
+- `requirements.txt` — pin your versions. `pyproject.toml` or `environment.yml` also fine.
+- `.env.example` — every env var the agent needs, with placeholder values. Never a real key.
+- `metadata.yaml` — see the schema below.
+
+Everything here is MIT under the repository root `LICENSE`. If your agent pulls in code,
+models, or data under a different licence, say so in your README and link the source.
+
+Large models and datasets don't belong in the repo. Host them externally (Hugging Face,
+S3, Zenodo) and add a download script.
+
+metadata.yaml schema
 ```yaml
-title: quick-chatbot-agent
-author: Your Name <you@example.com>
+title: web-research-agent
+description: Searches the web for a topic and synthesizes a structured research report
+author: your-github-username
 language: python
-tags:
-  - llm
-  - agent
-  - rl
-license: MIT
-datasets:
-  - name: example-dialogs
-    url: https://...
-entrypoint: run_demo.py
+framework: langgraph        # langgraph | crewai | autogen | agno | llamaindex | other
+tags: [research, web-search, rag, langgraph]
+industry: general
+difficulty: intermediate    # beginner | intermediate | advanced
+llm: gpt-4o-mini
+entrypoint: agent.py
 requirements: requirements.txt
 ```
 
@@ -102,8 +108,9 @@ requirements: requirements.txt
 Before opening a PR:
 - [ ] Fork and create a branch: feat/<short-desc> or fix/<short-desc>
 - [ ] Update README and metadata
-- [ ] Include tests or a smoke-test demonstration
+- [ ] Paste real sample output from a run into your agent's README
 - [ ] Ensure no secrets or private data are included
+- [ ] Rebase onto current `main` — README moves fast and stale branches conflict
 - [ ] Confirm license compatibility for added assets
 
 PR description should include:
```

**File**: `README.md` (modified, +4/-4)
```diff
@@ -90,11 +90,11 @@ Choosing a framework? Here's when to use each:
 
 | Use Case | Industry | Description | Code |
 |---|---|---|---|
-| **HIA (Health Insights Agent)** | Healthcare | Analyses medical reports and provides health insights | [![GitHub](https://img.shields.io/badge/Code-GitHub-black?logo=github)](https://github.com/harshhh28/hia.git) |
-| **AI Health Assistant** | Healthcare | Diagnoses and monitors diseases using patient data | [![GitHub](https://img.shields.io/badge/Code-GitHub-black?logo=github)](https://github.com/ahmadvh/AI-Agents-for-Medical-Diagnostics.git) |
-| **Automated Trading Bot** | Finance | Automates stock trading with real-time market analysis | [![GitHub](https://img.shields.io/badge/Code-GitHub-black?logo=github)](https://github.com/MingyuJ666/Stockagent.git) |
+| **HIA (Health Insights Agent)** | Healthcare | Analyses medical reports and provides health insights | [![GitHub](https://img.shields.io/badge/Code-GitHub-black?logo=github)](https://github.com/harshhh28/hia) |
+| **AI Health Assistant** | Healthcare | Diagnoses and monitors diseases using patient data | [![GitHub](https://img.shields.io/badge/Code-GitHub-black?logo=github)](https://github.com/ahmadvh/AI-Agents-for-Medical-Diagnostics) |
+| **Automated Trading Bot** | Finance | Automates stock trading with real-time market analysis | [![GitHub](https://img.shields.io/badge/Code-GitHub-black?logo=github)](https://github.com/MingyuJ666/Stockagent) |
 | **Agent Wallet SDK** | Finance | Non-custodial smart contract wallet SDK for AI agents with enforced spend limits | [![GitHub](https://img.shields.io/badge/Code-GitHub-black?logo=github)](https://github.com/up2itnow0822/agent-wallet-sdk) |
-| **Virtual AI Tutor** | Education | Provides personalized education tailored to users | [![GitHub](https://img.shields.io/badge/Code-GitHub-black?logo=github)](https://github.com/hqanhh/EduGPT.git) |
+| **Virtual AI Tutor** | Education | Provides personalized education tailored to users | [![GitHub](https://img.shields.io/badge/Code-GitHub-black?logo=github)](https://github.com/hqanhh/EduGPT) |
 | **24/7 AI Chatbot** | Customer Service | Handles customer queries around the clock | [![GitHub](https://img.shields.io/badge/Code-GitHub-black?logo=github)](https://github.com/NirDiamant/GenAI_Agents/blob/main/all_agents_tutorials/customer_support_agent_langgraph.ipynb) |
 | **Product Recommendation Agent** | Retail | Suggests products based on user preferences and history | [![GitHub](https://img.shields.io/badge/Code-GitHub-black?logo=github)](https://github.com/microsoft/RecAI) |
 | **Self-Driving Delivery Agent** | Transportation | Optimizes routes and autonomously delivers packages | [![GitHub](https://img.shields.io/badge/Code-GitHub-black?logo=github)](https://github.com/sled-group/driVLMe) |
```

---

### Incident Patch 6: `17417294` (2026-07-25)
**Commit Message**: docs: fix clone-URL links and align contribution guide with actual layout

Four use-case rows linked to .git clone URLs instead of repo pages.

The contribution guide described a folder layout that no agent in the repo
actually uses - it required tests/, a per-folder LICENSE, and a metadata
schema with license/datasets fields. The real agents/ layout is five files
and a different schema. Contributors were being measured against docs that
did not match the repo, which is where a lot of malformed PRs came from.

Also added a rebase reminder to the PR checklist - most open PRs are
unmergeable against the current README.

**File**: `CONTRIBUTION.md` (modified, +29/-22)
```diff
@@ -24,29 +24,35 @@ If your contribution is large (new category, many projects, major refactor) plea
 ## Project folder requirements (must-have)
 Each agent project added must include the following at the top level of its folder:
 
-- README.md — concise description, intended use-case, quick start with exact commands, expected output, and runtime (CPU/GPU/time).
-- LICENSE or a note referencing repository root LICENSE (see root LICENSE).
-- requirements.txt, pyproject.toml, or environment.yml (pin critical dependency versions).
-- One or more runnable examples (script or notebook) that reproduce the core behavior.
-  - Provide minimal example(s) that run in <10 minutes on a modest machine where possible.
-- tests/ or a smoke-test script with instructions to run them.
-- metadata.yaml or metadata.json (see example below).
-- small models / datasets should be included only if tiny. Prefer external hosting (Hugging Face, S3, Google Drive) with a download script.
-
-Example metadata schema (recommended)
+Agents live in `agents/NN-agent-name/` where `NN` is the next free number. Copy the
+layout of an existing agent — `agents/01-web-research-agent/` is the reference. Exactly
+five files, nothing more:
+
+- `README.md` — what it does, quick start with exact commands, sample output, and rough runtime.
+- `agent.py` — the runnable entrypoint. Must run end-to-end in under 10 minutes.
+  A notebook is fine instead if the demo is genuinely better that way.
+- `requirements.txt` — pin your versions. `pyproject.toml` or `environment.yml` also fine.
+- `.env.example` — every env var the agent needs, with placeholder values. Never a real key.
+- `metadata.yaml` — see the schema below.
+
+Everything here is MIT under the repository root `LICENSE`. If your agent pulls in code,
+models, or data under a different licence, say so in your README and link the source.
+
+Large models and datasets don't belong in the repo. Host them externally (Hugging Face,
+S3, Zenodo) and add a download script.
+
+metadata.yaml schema
 ```yaml
-title: quick-chatbot-agent
-author: Your Name <you@example.com>
+title: web-research-agent
+description: Searches the web for a topic and synthesizes a structured research report
+author: your-github-username
 language: python
-tags:
-  - llm
-  - agent
-  - rl
-license: MIT
-datasets:
-  - name: example-dialogs
-    url: https://...
-entrypoint: run_demo.py
+framework: langgraph        # langgraph | crewai | autogen | agno | llamaindex | other
+tags: [research, web-search, rag, langgraph]
+industry: general
+difficulty: intermediate    # beginner | intermediate | advanced
+llm: gpt-4o-mini
+entrypoint: agent.py
 requirements: requirements.txt
 ```
 
@@ -102,8 +108,9 @@ requirements: requirements.txt
 Before opening a PR:
 - [ ] Fork and create a branch: feat/<short-desc> or fix/<short-desc>
 - [ ] Update README and metadata
-- [ ] Include tests or a smoke-test demonstration
+- [ ] Paste real sample output from a run into your agent's README
 - [ ] Ensure no secrets or private data are included
+- [ ] Rebase onto current `main` — README moves fast and stale branches conflict
 - [ ] Confirm license compatibility for added assets
 
 PR description should include:
```

**File**: `README.md` (modified, +4/-4)
```diff
@@ -90,11 +90,11 @@ Choosing a framework? Here's when to use each:
 
 | Use Case | Industry | Description | Code |
 |---|---|---|---|
-| **HIA (Health Insights Agent)** | Healthcare | Analyses medical reports and provides health insights | [![GitHub](https://img.shields.io/badge/Code-GitHub-black?logo=github)](https://github.com/harshhh28/hia.git) |
-| **AI Health Assistant** | Healthcare | Diagnoses and monitors diseases using patient data | [![GitHub](https://img.shields.io/badge/Code-GitHub-black?logo=github)](https://github.com/ahmadvh/AI-Agents-for-Medical-Diagnostics.git) |
-| **Automated Trading Bot** | Finance | Automates stock trading with real-time market analysis | [![GitHub](https://img.shields.io/badge/Code-GitHub-black?logo=github)](https://github.com/MingyuJ666/Stockagent.git) |
+| **HIA (Health Insights Agent)** | Healthcare | Analyses medical reports and provides health insights | [![GitHub](https://img.shields.io/badge/Code-GitHub-black?logo=github)](https://github.com/harshhh28/hia) |
+| **AI Health Assistant** | Healthcare | Diagnoses and monitors diseases using patient data | [![GitHub](https://img.shields.io/badge/Code-GitHub-black?logo=github)](https://github.com/ahmadvh/AI-Agents-for-Medical-Diagnostics) |
+| **Automated Trading Bot** | Finance | Automates stock trading with real-time market analysis | [![GitHub](https://img.shields.io/badge/Code-GitHub-black?logo=github)](https://github.com/MingyuJ666/Stockagent) |
 | **Agent Wallet SDK** | Finance | Non-custodial smart contract wallet SDK for AI agents with enforced spend limits | [![GitHub](https://img.shields.io/badge/Code-GitHub-black?logo=github)](https://github.com/up2itnow0822/agent-wallet-sdk) |
-| **Virtual AI Tutor** | Education | Provides personalized education tailored to users | [![GitHub](https://img.shields.io/badge/Code-GitHub-black?logo=github)](https://github.com/hqanhh/EduGPT.git) |
+| **Virtual AI Tutor** | Education | Provides personalized education tailored to users | [![GitHub](https://img.shields.io/badge/Code-GitHub-black?logo=github)](https://github.com/hqanhh/EduGPT) |
 | **24/7 AI Chatbot** | Customer Service | Handles customer queries around the clock | [![GitHub](https://img.shields.io/badge/Code-GitHub-black?logo=github)](https://github.com/NirDiamant/GenAI_Agents/blob/main/all_agents_tutorials/customer_support_agent_langgraph.ipynb) |
 | **Product Recommendation Agent** | Retail | Suggests products based on user preferences and history | [![GitHub](https://img.shields.io/badge/Code-GitHub-black?logo=github)](https://github.com/microsoft/RecAI) |
 | **Self-Driving Delivery Agent** | Transportation | Optimizes routes and autonomously delivers packages | [![GitHub](https://img.shields.io/badge/Code-GitHub-black?logo=github)](https://github.com/sled-group/driVLMe) |
```

---

### Incident Patch 7: `0454fb76` (2025-08-01)
**Commit Message**: Merge pull request #14 from ashishpatel26/copilot/fix-10d2ad23-53e7-4053-9882-918cfdf5017d

[WIP] Add MIT License for Open Source Use



---

### Incident Patch 8: `823a2b59` (2025-07-08)
**Commit Message**: Add Cybersecurity Agent use case

**File**: `README.md` (modified, +0/-1)
```diff
@@ -63,7 +63,6 @@ Whether you're a developer, researcher, or business enthusiast, this repository
 | **Real-Time Threat Detection Agent**  | Cybersecurity    | Identifies potential threats and mitigates attacks.      | [![GitHub](https://img.shields.io/badge/Code-GitHub-black?logo=github)](https://github.com/NVISOsecurity/cyber-security-llm-agents)                                                       |
 | **E-commerce Personal Shopper Agent** | E-commerce       | Helps customers find products they’ll love.             | [![GitHub](https://img.shields.io/badge/Code-GitHub-black?logo=github)](https://github.com/Hoanganhvu123/ShoppingGPT)                                                                     |
 | **Logistics Optimization Agent**      | Supply Chain     | Plans efficient delivery routes and manages inventory.   | [![GitHub](https://img.shields.io/badge/Code-GitHub-black?logo=github)](https://github.com/microsoft/OptiGuide)                                                                           |
-| **Vibe Hacking Agent** 
 | **Vibe Hacking Agent**                | Cybersecurity    | Autonomous Multi-Agent Based Red Team Testing Service.   | [![GitHub](https://img.shields.io/badge/Code-GitHub-black?logo=github)]
 (https://github.com/PurpleAILAB/Decepticon)
 
```

---

### Incident Patch 9: `db9bde0a` (2025-07-08)
**Commit Message**: ADD cybersecurity use case.md

**File**: `README.md` (modified, +4/-0)
```diff
@@ -63,6 +63,9 @@ Whether you're a developer, researcher, or business enthusiast, this repository
 | **Real-Time Threat Detection Agent**  | Cybersecurity    | Identifies potential threats and mitigates attacks.      | [![GitHub](https://img.shields.io/badge/Code-GitHub-black?logo=github)](https://github.com/NVISOsecurity/cyber-security-llm-agents)                                                       |
 | **E-commerce Personal Shopper Agent** | E-commerce       | Helps customers find products they’ll love.             | [![GitHub](https://img.shields.io/badge/Code-GitHub-black?logo=github)](https://github.com/Hoanganhvu123/ShoppingGPT)                                                                     |
 | **Logistics Optimization Agent**      | Supply Chain     | Plans efficient delivery routes and manages inventory.   | [![GitHub](https://img.shields.io/badge/Code-GitHub-black?logo=github)](https://github.com/microsoft/OptiGuide)                                                                           |
+| **Vibe Hacking Agent** 
+| **Vibe Hacking Agent**                | Cybersecurity    | Autonomous Multi-Agent Based Red Team Testing Service.   | [![GitHub](https://img.shields.io/badge/Code-GitHub-black?logo=github)]
+(https://github.com/PurpleAILAB/Decepticon)
 
 ## Framework wise Usecases
 
@@ -294,6 +297,7 @@ Whether you're a developer, researcher, or business enthusiast, this repository
 
 
 
+
 ---
 
 ## 🤝 Contributing
```

#### Recent Merged Pull Requests:
- **PR #191** (closed): Add NEXUS-AI agent marketplace (@klikmarkettt-dotcom)
- **PR #190** (closed): Add NEXUS-AI agent marketplace (@klikmarkettt-dotcom)
- **PR #177** (closed): update readme (@AbdulHaseeb790)
- **PR #172** (closed): Add OpenOutreach to the industry use-case table (Sales) (@eracle)
- **PR #164** (closed): docs: add Pixel Pet (@Sirius-chen)
- **PR #158** (closed): feat: add SENTINEL Transaction Safety Oracle (agents/22-sentinel-tran… (@teodorofodocrispin-cmyk)
- **PR #156** (2026-07-25): fix: replace broken star-history.com chart with a self-generated one (@ashishpatel26)
- **PR #155** (2026-07-25): ci: auto-manage stale pull requests and issues (@ashishpatel26)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

# Forensic Learning Record (Deep Inspection): NirDiamant/agents-towards-production

> **Canonical Artifact**: `07_PROJECT_LEARNING/nirdiamant-agents-towards-production-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/NirDiamant/agents-towards-production](https://github.com/NirDiamant/agents-towards-production))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T01:59:54.992Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `NirDiamant/agents-towards-production`
- **Description**: End-to-end, code-first tutorials for building production-grade GenAI agents. From prototype to enterprise deployment.
- **Primary Language / Ecosystem**: Jupyter Notebook
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 21529 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `tutorials/agent-security-apex/prompt_manipulation_tools.py`
```
def prompt_encoder(prompt, encoding=""):
    """
    Encode the prompt using the specified encoding.
    If no encoding is specified, a random encoding method will be chosen.
    """
    import random

    # List of all available encoding methods
    encoding_methods = [
        "atbash",
        "caesar",
        "vigenere",
        "braille",
        "morse",
        "pig_latin",
        "leet",
        "binary",
        "hex",
        "base64",
        "rot13",
        "reverse",
    ]

    # If no encoding specified, randomly choose one
    if encoding == "":
        encoding = random.choice(encoding_methods)
        print(f"Randomly selected encoding method: {encoding}")

    if encoding == "atbash":
        return atbash_encode(prompt)
    elif encoding == "caesar":
        return caesar_encode(prompt, 3)  # Example shift value
    elif encoding == "vigenere":
        return vigenere_encode(prompt, "KEY")  # Example key
    elif encoding == "braille":
        return braille_encode(prompt)
    elif encoding == "morse":
        return morse_encode(prompt)
    elif encoding == "pig_latin":
        return pig_latin_encode(prompt)
    elif encoding == "leet":
        return leet_encode(prompt)
    elif encoding == "binary":
        return binary_encode(prompt)
    elif encoding == "hex":
        return hex_encode(prompt)
    elif encoding == "base64":
        return base64_encode(prompt)
    elif encoding == "rot13":
        return rot13_encode(prompt)
    elif encoding == "reverse":
        return reverse_encode(prompt)
    else:
        raise ValueError("Unsupported encoding type.")


def atbash_encode(text):
    """
    Encode the text using the Atbash cipher.
    """
    alphabet = "abcdefghijklmnopqrstuvwxyz"
    reversed_alphabet = alphabet[::-1]
    translation_table = str.maketrans(alphabet, reversed_alphabet)
    return text.translate(translation_table)


def caesar_encode(text, shift):
    """
    Encode the text using the Caesar cipher.
    """

    def shift_alphabet(alphabet, shift):
        return alphabet[shift:] + alphabet[:shift]

    alphabet = "abcdefghijklmnopqrstuvwxyz"
    shifted_alphabet = shift_alphabet(alphabet, shift)
    translation_table = str.maketrans(alphabet, shifted_alphabet)
    return text.translate(translation_table)


def vigenere_encode(text, key):
    """
    Encode the text using the Vigenère cipher.
    """

    def generate_vigenere_table():
        alphabet = "abcdefghijklmnopqrstuvwxyz"
        table = []
        for i in range(len(alphabet)):
            row = alphabet[i:] + alphabet[:i]
            table.append(row)
        return table

    def vigenere_encrypt(text, key):
        table = generate_vigenere_table()
        encrypted_text = []
        key_length = len(key)
        for i, char in enumerate(text):
            if char.isalpha():
                row = ord(key[i % key_length]) - ord("a")
                col = ord(char) - ord("a")
                encrypted_char = table[row][col]
                encrypted_text.append(encrypted_char)
            else:
                encrypted_text.append(char)
        return "".join(encrypted_text)

    return vigenere_encrypt(text.lower(), key.lower())


def braille_encode(text):
    """
    Encode the text using Braille.
    """
    braille_dict = {
        "a": "⠁",
        "b": "⠃",
        "c": "⠉",
        "d": "⠙",
        "e": "⠑",
        "f": "⠋",
        "g": "⠛",
        "h": "⠓",
        "i": "⠊",
        "j": "⠚",
        "k": "⠅",
        "l": "⠇",
        "m": "⠍",
        "n": "⠝",
        "o": "⠕",
        "p": "⠏",
        "q": "⠟",
        "r": "⠗",
        "s": "⠎",
        "t": "⠞",
        "u": "⠥",
        "v": "⠧",
        "w": "⠺",
        "x": "⠭",
        "y": "⠽",
        "z": "⠵",
    }
    return "".join(braille_dict.get(char, char) for char in text.lower())


def morse_encode(text):
    """
    Encode the text using Morse code.
    """
    morse_dict = {
        "a": ".-",
        "b": "-...",
        "c": "-.-.",
        "d": "-..",
        "e": ".",
        "f": "..-.",
        "g": "--.",
        "h": "....",
        "i": "..",
        "j": ".---",
        "k": "-.-",
        "l": ".-..",
        "m": "--",
        "n": "-.",
        "o": "---",
        "p": ".--.",
        "q": "--.-",
        "r": ".-.",
        "s": "...",
        "t": "-",
        "u": "..-",
        "v": "...-",
        "w": ".--",
        "x": "-..-",
        "y": "-.--",
        "z": "--..",
    }
    return "".join(morse_dict.get(char, char) for char in text.lower())


def pig_latin_encode(text):
    """
    Encode the text using Pig Latin.
    """

    def pig_latin_word(word):
        if word[0] in "aeiou":
            return word + "yay"
        else:
            return word[1:] + word[0] + "ay"

    words = text.split()
    pig_latin_words = [pig_latin_word(word) for word in words]
    return " ".join(pig_latin_words)


def leet_encode(text):
    """
    Encode the text using Leet Speak.
    """
    leet_dict = {
        "a": "4",
        "b": "8",
        "c": "<",
        "d": "|)",
        "e": "3",
        "f": "|=",
        "g": "9",
        "h": "#",
        "i": "1",
        "j": "_|",
        "k": "|<",
        "l": "|_",
        "m": "/\\/\\",
        "n": "^/",
        "o": "0",
        "p": "|*",
        "q": "(,)",
        "r": "|2",
        "s": "5",
        "t": "+",
        "u": "|_|",
        "v": "\\/",
        "w": "\\^/",
        "x": "%",
        "y": "`/",
        "z": "2",
    }
    return "".join(leet_dict.get(char, char) for char in text.lower())


def binary_encode(text):
    """
    Encode the text using binary.
    """
    return " ".join(format(ord(char), "08b") for char in text)


def hex_encode(text):
    """
    Encode the text using hexadecimal.
    """
    return " ".join(format(ord(char), "02x") for char in text)


def base64_encode(text):
    """
    Encode the text using Base64.
    """
    import base64

    return base64.b64encode(text.encode()).decode()


def rot13_encode(text):
    """
    Encode the text using ROT13.
    """
    import codecs

    return codecs.encode(text, "rot_13")


def reverse_encode(text):
    """
    Encode the text by reversing it.
    """
    return text[::-1]

```

### Core Architecture Module: `tutorials/agent-with-mcp/scripts/mcp_server.py`
```
"""
A minimal MCP server that exposes cryptocurrency data as tools.

This is the server the MCP tutorial connects to. It publishes two tools over
stdio using FastMCP, both backed by the free CoinGecko public API (no API key
required):

    get_crypto_price(crypto_id, currency)       -> current price
    get_crypto_market_info(crypto_ids, currency) -> price, market cap, volume, changes

Run it directly:

    uv add "mcp[cli]>=2.0" httpx
    uv run mcp_server.py

The server speaks stdio, so it produces no output of its own when it starts.
That is expected - it is waiting for a client (the notebook, or Claude Desktop)
to connect and call `initialize`.
"""

import httpx
from mcp.server.mcpserver import MCPServer

# The server name is what clients display when they list connected servers.
# Note: in MCP SDK 2.x this class is MCPServer. It was called FastMCP in 1.x,
# so older tutorials you find elsewhere will import `mcp.server.fastmcp`.
mcp = MCPServer("crypto-price-tracker")

COINGECKO_API = "https://api.coingecko.com/api/v3"

# CoinGecko rate-limits anonymous callers fairly aggressively, so keep a single
# client with a sane timeout rather than opening a connection per call.
_TIMEOUT = httpx.Timeout(15.0)


@mcp.tool()
async def get_crypto_price(crypto_id: str, currency: str = "usd") -> str:
    """
    Get the current price of a cryptocurrency in a specified currency.

    Parameters:
    - crypto_id: The ID of the cryptocurrency (e.g., 'bitcoin', 'ethereum')
    - currency: The currency to display the price in (default: 'usd')

    Returns:
    - Current price information as a formatted string
    """
    crypto_id = crypto_id.strip().lower()
    currency = currency.strip().lower()

    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        try:
            response = await client.get(
                f"{COINGECKO_API}/simple/price",
                params={"ids": crypto_id, "vs_currencies": currency},
            )
            response.raise_for_status()
        except httpx.HTTPError as exc:
            # Return the error as text rather than raising: the client is an LLM,
            # and a readable message is more useful to it than a stack trace.
            return f"Could not reach CoinGecko to price {crypto_id}: {exc}"

    data = response.json()

    if crypto_id not in data:
        return (
            f"Unknown cryptocurrency '{crypto_id}'. "
            "Use a CoinGecko ID such as 'bitcoin', 'ethereum' or 'solana'."
        )
    if currency not in data[crypto_id]:
        return f"Unknown currency '{currency}' for {crypto_id}."

    price = data[crypto_id][currency]
    return f"The current price of {crypto_id} is {price} {currency.upper()}"


@mcp.tool()
async def get_crypto_market_info(crypto_ids: str, currency: str = "usd") -> str:
    """
    Get market information for one or more cryptocurrencies.

    Parameters:
    - crypto_ids: Comma-separated list of cryptocurrency IDs (e.g., 'bitcoin,ethereum')
    - currency: The currency to display values in (default: 'usd')

    Returns:
    - Market information including price, market cap, volume, and price changes
    """
    ids = [c.strip().lower() for c in crypto_ids.split(",") if c.strip()]
    if not ids:
        return "No cryptocurrency IDs provided."
    currency = currency.strip().lower()

    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        try:
            response = await client.get(
                f"{COINGECKO_API}/coins/markets",
                params={"vs_currency": currency, "ids": ",".join(ids)},
            )
            response.raise_for_status()
        except httpx.HTTPError as exc:
            return f"Could not reach CoinGecko for market data: {exc}"

    markets = response.json()
    if not markets:
        return (
            f"No market data found for: {', '.join(ids)}. "
            "Check that these are valid CoinGecko IDs."
        )

    unit = currency.upper()
    lines = []
    for coin in markets:
        change = coin.get("price_change_percentage_24h")
        change_text = f"{change:+.2f}%" if change is not None else "n/a"
        lines.append(
            f"{coin.get('name', coin['id'])} ({coin.get('symbol', '').upper()})\n"
            f"  Price:        {coin.get('current_price')} {unit}\n"
            f"  Market cap:   {coin.get('market_cap')} {unit}\n"
            f"  24h volume:   {coin.get('total_volume')} {unit}\n"
            f"  24h change:   {change_text}"
        )

    return "\n\n".join(lines)


if __name__ == "__main__":
    # stdio is the transport Claude Desktop and the notebook's StdioServerParameters
    # both expect. The server runs until the client disconnects.
    mcp.run(transport="stdio")

```

### Core Architecture Module: `tutorials/agent-with-streamlit-ui/app.py`
```
# app.py (full code combining all steps)

import os
import openai
import streamlit as st
import io

from dotenv import load_dotenv
import openai
import os
import PyPDF2

load_dotenv()  # Load environment variables from .env

client = openai.OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
# If you didn't set an environment variable, you could do:
# client = openai.OpenAI(api_key="sk-your-api-key")  # (Not recommended to hard-code in real apps)

# Function to extract text from a PDF file
def extract_text_from_pdf(pdf_file):
    pdf_reader = PyPDF2.PdfReader(pdf_file)
    text = ""
    for page_num in range(len(pdf_reader.pages)):
        text += pdf_reader.pages[page_num].extract_text()
    return text

# Function to process the uploaded file
def process_uploaded_file(uploaded_file):
    if uploaded_file.type == "application/pdf":
        return extract_text_from_pdf(uploaded_file)
    elif uploaded_file.type == "text/plain":
        return uploaded_file.getvalue().decode("utf-8")
    else:
        return "Unsupported file type. Please upload a TXT or PDF file."

# Define a function to generate a response from the AI given a user message
def generate_response(user_prompt, file_content=None):
    """
    Sends the user prompt to OpenAI and returns the AI's response.

    Parameters:
    -----------
    user_prompt : str
        The input message from the user.
    file_content : str, optional
        Content extracted from an uploaded file.

    Returns:
    --------
    str
        The AI-generated response as plain text.
    """
    messages = []
    
    # If file content is provided, add it as context
    if file_content:
        messages.append({
            "role": "system", 
            "content": f"The user has uploaded a file with the following content:\n\n{file_content}\n\nPlease consider this information when responding to their query."
        })
    
    # Add the user's prompt
    messages.append({"role": "user", "content": user_prompt})
    
    # Use OpenAI's chat completion endpoint to get a chat-based response
    response = client.chat.completions.create(
        model="gpt-4o",  # The AI model to use
        messages=messages  # The conversation context
    )
    # Extract the assistant's message from the response
    message_text = response.choices[0].message.content
    return message_text  # Return the assistant's reply



st.set_page_config(page_title="AI Chatbot", page_icon="🤖", layout="wide")
st.title("🤖 AI Chatbot Assistant")
st.markdown("**Welcome!** Ask anything or upload a file for the bot to analyze.")

# File upload section in the sidebar
uploaded_file = st.sidebar.file_uploader("Upload a file (optional):", type=["txt", "pdf"])
file_content = None

if uploaded_file is not None:
    st.sidebar.write("Uploaded file:", f"**{uploaded_file.name}** ({uploaded_file.size} bytes)")
    
    # Process the file and store its content
    with st.sidebar.spinner("Processing file..."):
        file_content = process_uploaded_file(uploaded_file)
    
    # Show a preview of the file content
    with st.sidebar.expander("File Content Preview"):
        st.write(file_content[:500] + "..." if len(file_content) > 500 else file_content)

if "messages" not in st.session_state:
    st.session_state.messages = []
if not st.session_state.messages:
    st.session_state.messages.append({"role": "assistant", "content": "Hello! I'm here to help. Feel free to ask me anything or upload a file."})

# Display existing chat messages
for msg in st.session_state.messages:
    with st.chat_message(msg["role"]):
        st.markdown(msg["content"])

# Chat input widget for new messages
if user_msg := st.chat_input("Type your message here..."):
    # Add user message to history and display it
    st.session_state.messages.append({"role": "user", "content": user_msg})
    with st.chat_message("user"):
        st.markdown(user_msg)
    # Generate assistant response with spinner
    with st.chat_message("assistant"):
        with st.spinner("Thinking..."):
            assistant_msg = generate_response(user_msg, file_content)
            st.markdown(assistant_msg)
    # Add assistant response to history
    st.session_state.messages.append({"role": "assistant", "content": assistant_msg})
```

### Core Architecture Module: `tutorials/docker-intro/examples/ex3/hello-world.py`
```
print("Hello World!")
```

### Core Architecture Module: `tutorials/docker-intro/examples/ex4/simple_agent.py`
```
from openai import OpenAI

client = OpenAI()

response = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[{"role": "user", "content": "What is the capital of France?"}],
)

print(response.choices[0].message.content)
```

### Core Architecture Module: `tutorials/docker-intro/examples/ex5/dynamic_agent.py`
```
import os
from openai import OpenAI

client = OpenAI()

question = os.getenv("QUESTION", "What is the capital of France?")

response = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[{"role": "user",  "content": question}],
)

print(f"Question: {question}")
print(f"Answer: {response.choices[0].message.content}")
```

### Core Architecture Module: `tutorials/durable-rag-ingestion-inngest/app.py`
```
"""The durable version of the ingestion pipeline, served to the Inngest dev server.

Run it with two terminals:

    uvicorn app:app --reload --port 8000
    npx inngest-cli@latest dev -u http://127.0.0.1:8000/api/inngest

Then open http://127.0.0.1:8288 and send the trigger event from the notebook.
"""
import datetime
import inngest
import inngest.fast_api
from fastapi import FastAPI

from pipeline import Counters, Index, chunk, content_hash, embed, make_corpus, parse

app = FastAPI()

# is_production=False points the SDK at the local dev server. No account, no keys.
client = inngest.Inngest(app_id="rag-ingestion", is_production=False)

CORPUS = {d["id"]: d for d in make_corpus(5000)}
INDEX = Index(append_only=False)   # idempotent: keyed on doc id + chunk no + content hash
COUNTERS = Counters()


@client.create_function(
    fn_id="ingest-corpus",
    trigger=inngest.TriggerEvent(event="rag/corpus.ingest"),
    retries=3,
)
def ingest_corpus(ctx: inngest.ContextSync) -> dict:
    """Fan out one event per document.

    One unparseable file fails its own function run. It does not take the corpus with it.
    """
    doc_ids = ctx.step.run("list-documents", lambda: sorted(CORPUS))

    # Fan out by event rather than step.invoke. invoke waits for the child and, if the
    # child fails, raises a NonRetriableError in this run. Waiting and shared fate are
    # both things per-document isolation exists to avoid. See notebook section 9, and
    # https://www.inngest.com/docs/guides/invoking-functions-directly?guide=python
    #
    # Chunked sends keep a single step payload small.
    for i in range(0, len(doc_ids), 500):
        batch = doc_ids[i : i + 500]
        ctx.step.send_event(
            f"fan-out-{i}",
            [
                inngest.Event(
                    name="rag/document.received",
                    data={"doc_id": d, "tenant_id": CORPUS[d]["topic"]},
                )
                for d in batch
            ],
        )
    return {"documents": len(doc_ids)}


@client.create_function(
    fn_id="ingest-document",
    trigger=inngest.TriggerEvent(event="rag/document.received"),
    retries=3,
    # Stay under the embedding provider's rate limit.
    throttle=inngest.Throttle(limit=100, period=datetime.timedelta(minutes=1)),
    # A backfill for one tenant cannot starve live ingestion for the others.
    concurrency=[inngest.Concurrency(key="event.data.tenant_id", limit=5)],
)
def ingest_document(ctx: inngest.ContextSync) -> dict:
    """One document, one function run, every stage its own recorded step.

    A retry replays completed steps from the journal instead of re-running them, so the
    embedding calls below are paid for once even if the run is retried.
    """
    doc_id = ctx.event.data["doc_id"]
    doc = CORPUS[doc_id]

    text = ctx.step.run("parse", lambda: parse(doc, COUNTERS))
    chunks = ctx.step.run("chunk", lambda: chunk(text))

    # A document that parses to nothing goes to a human instead of into the index.
    if not chunks:
        ctx.step.send_event(
            "flag-for-review",
            inngest.Event(name="rag/document.needs_review", data={"doc_id": doc_id}),
        )
        # Waiting on a person, not on another function, so wait_for_event rather than
        # step.invoke: no child function's return value would carry a human decision.
        approval = ctx.step.wait_for_event(
            "await-approval",
            event="rag/document.approved",
            if_exp=f"async.data.doc_id == '{doc_id}'",
            timeout=datetime.timedelta(days=7),
        )
        if approval is None:
            return {"doc_id": doc_id, "status": "rejected-or-timed-out"}

    for i, ch in enumerate(chunks):
        # Each embed is its own step, so a failure at chunk 40 does not re-bill chunks 0 to 39.
        vec = ctx.step.run(f"embed-{i}", lambda ch=ch: embed(ch, COUNTERS))
        ctx.step.run(
            f"upsert-{i}",
            lambda i=i, ch=ch, vec=vec: INDEX.upsert(doc_id, i, ch, vec, COUNTERS),
        )

    return {"doc_id": doc_id, "chunks": len(chunks), "index_size": INDEX.size()}


@client.create_function(
    fn_id="approve-document",
    trigger=inngest.TriggerEvent(event="rag/document.review_decision"),
)
def approve_document(ctx: inngest.ContextSync) -> dict:
    """A reviewer's decision, forwarded to whichever run is waiting on it."""
    doc_id = ctx.event.data["doc_id"]
    ctx.step.send_event(
        "forward-approval",
        inngest.Event(name="rag/document.approved", data={"doc_id": doc_id}),
    )
    return {"doc_id": doc_id, "approved": True}


@app.get("/stats")
def stats() -> dict:
    return {
        "index_entries": INDEX.size(),
        "duplicates": INDEX.duplicates(),
        "work": {
            "parsed": COUNTERS.parsed,
            "embedded": COUNTERS.embedded,
            "upserted": COUNTERS.upserted,
        },
    }


inngest.fast_api.serve(app, client, [ingest_corpus, ingest_document, approve_document])

```

### Core Architecture Module: `tutorials/durable-rag-ingestion-inngest/pipeline.py`
```
"""Core logic for the durable RAG ingestion tutorial. Tested standalone first."""
import hashlib, random

# ---------- corpus ----------
def make_corpus(n=5000, seed=7):
    rnd = random.Random(seed)
    topics = ["retrieval", "embeddings", "chunking", "reranking", "evaluation"]
    docs = []
    for i in range(n):
        t = rnd.choice(topics)
        body = " ".join(rnd.choice(
            ["latency","recall","index","vector","token","corpus","query","chunk"]
        ) for _ in range(60))
        docs.append({"id": f"doc-{i:05d}", "topic": t, "text": f"{t}. {body}"})
    return docs

# ---------- instrumented stages ----------
class Counters:
    def __init__(self): self.parsed = self.embedded = self.upserted = 0
    def __repr__(self):
        return f"parsed={self.parsed} embedded={self.embedded} upserted={self.upserted}"

def parse(doc, c):
    c.parsed += 1
    return doc["text"]

def chunk(text, size=200):
    return [text[i:i+size] for i in range(0, len(text), size)]

def embed(chunk_text, c):
    """Stand-in for a paid embedding call. Deterministic, so the tutorial is reproducible."""
    c.embedded += 1
    h = hashlib.sha256(chunk_text.encode()).digest()
    return [b / 255.0 for b in h[:16]]

def content_hash(text):
    return hashlib.sha256(text.encode()).hexdigest()[:16]

# ---------- the index ----------
class Index:
    """append_only=True is the naive version: every upsert adds a row."""
    def __init__(self, append_only=True):
        self.rows = []          # naive
        self.by_key = {}        # idempotent
        self.append_only = append_only
    def upsert(self, doc_id, chunk_no, text, vec, c):
        c.upserted += 1
        if self.append_only:
            self.rows.append((doc_id, chunk_no, text, vec))
        else:
            self.by_key[(doc_id, chunk_no, content_hash(text))] = (text, vec)
    def size(self):
        return len(self.rows) if self.append_only else len(self.by_key)
    def duplicates(self):
        if not self.append_only: return 0
        seen, dupes = set(), 0
        for doc_id, chunk_no, text, _ in self.rows:
            k = (doc_id, chunk_no, content_hash(text))
            if k in seen: dupes += 1
            else: seen.add(k)
        return dupes

# ---------- the naive pipeline ----------
class Boom(Exception): pass

def ingest_naive(docs, index, c, fail_at=None):
    for n, doc in enumerate(docs):
        if fail_at is not None and n == fail_at:
            raise Boom(f"embedding provider returned 429 at document {n}")
        text = parse(doc, c)
        for i, ch in enumerate(chunk(text)):
            index.upsert(doc["id"], i, ch, embed(ch, c), c)
    return n + 1

if __name__ == "__main__":
    docs = make_corpus(5000)
    print(f"corpus: {len(docs)} documents")

    # --- run 1: dies at 3000 ---
    idx, c1 = Index(), Counters()
    try:
        ingest_naive(docs, idx, c1, fail_at=3000)
    except Boom as e:
        print(f"\nrun 1 failed: {e}")
    print(f"  run 1 work done : {c1}")
    print(f"  index rows      : {idx.size()}")

    # --- run 2: the naive retry, from the top ---
    c2 = Counters()
    ingest_naive(docs, idx, c2, fail_at=None)
    print(f"\nrun 2 (naive retry from doc 0):")
    print(f"  run 2 work done : {c2}")
    print(f"  index rows      : {idx.size()}")
    print(f"  duplicate rows  : {idx.duplicates()}")
    print(f"\n  WASTED re-embeds (work run 1 already paid for): {c1.embedded}")
    total = c1.embedded + c2.embedded
    print(f"  embeddings billed across both runs: {total}")
    print(f"  embeddings actually needed        : {c2.embedded}")
    print(f"  overspend: {total/c2.embedded - 1:.0%}")

    # --- the idempotent index, same two runs ---
    idx2, d1 = Index(append_only=False), Counters()
    try: ingest_naive(docs, idx2, d1, fail_at=3000)
    except Boom: pass
    d2 = Counters(); ingest_naive(docs, idx2, d2)
    print(f"\nwith idempotent upserts, same two runs:")
    print(f"  index entries   : {idx2.size()}")
    print(f"  duplicate rows  : 0 by construction")

```

### Core Architecture Module: `tutorials/fastapi-agent/run_server.py`
```
"""
Simple script to run the FastAPI server from the correct directory
"""
import os
import sys
import subprocess

# Get the absolute path of the current script
script_dir = os.path.dirname(os.path.abspath(__file__))

# Change to the directory containing the script
os.chdir(script_dir)

# Run uvicorn with the correct module path
print("Starting FastAPI server...")
print(f"Current directory: {os.getcwd()}")
print("Running: uvicorn scripts.fastapi_agent:app --reload")

try:
    subprocess.run(["uvicorn", "scripts.fastapi_agent:app", "--reload"], check=True)
except Exception as e:
    print(f"Error running server: {e}")
    sys.exit(1) 
```

### Core Architecture Module: `tutorials/fastapi-agent/scripts/fastapi_agent.py`
```
from fastapi import FastAPI, Depends, HTTPException, Header
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional
import json
import os
import asyncio

# Define our simple agent class
class SimpleAgent:
    def __init__(self, name="FastAPI Agent"):
        self.name = name
    
    def generate_response(self, query):
        """Generate a synchronous response to a user query"""
        return f"Agent {self.name} received: '{query}'\nResponse: This is a simulated agent response."
    
    async def generate_response_stream(self, query):
        """Generate a streaming response to a user query"""
        prefix = f"Agent {self.name} thinking about: '{query}'\n"
        response = "This is a simulated agent response that streams token by token."
        
        # Yield the prefix as a single chunk
        yield prefix
        
        # Stream the response token by token with small delays
        for token in response.split():
            await asyncio.sleep(0.1)  # Simulate thinking time
            yield token + " "

# Define request and response models
class QueryRequest(BaseModel):
    query: str
    context: Optional[str] = None
    
    class Config:
        schema_extra = {
            "example": {
                "query": "What is FastAPI?",
                "context": "I'm a beginner programmer."
            }
        }

class QueryResponse(BaseModel):
    response: str
    
    class Config:
        schema_extra = {
            "example": {
                "response": "FastAPI is a modern, high-performance web framework for building APIs with Python."
            }
        }

# Initialize FastAPI app
app = FastAPI(
    title="Agent API",
    description="A simple API that serves an AI agent",
    version="0.1.0"
)

# Create an instance of our agent
agent = SimpleAgent()

# Health check endpoint
@app.get("/health")
def health_check():
    """Check if the API is running"""
    return {"status": "ok", "message": "API is operational"}

# Create a synchronous endpoint for the agent
@app.post("/agent", response_model=QueryResponse)
def query_agent(request: QueryRequest):
    """Get a response from the agent"""
    response = agent.generate_response(request.query)
    return QueryResponse(response=response)

# Create a streaming endpoint for the agent
@app.post("/agent/stream")
async def stream_agent(request: QueryRequest):
    """Stream a response from the agent token by token"""
    
    async def event_generator():
        async for token in agent.generate_response_stream(request.query):
            # Format as a JSON object
            data = json.dumps({"token": token})
            yield f"data: {data}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream"
    ) 
```

### Core Architecture Module: `tutorials/kotlin-agent-with-koog/Step1_HelloAgent.kt`
```
import ai.koog.agents.core.agent.AIAgent
import ai.koog.prompt.executor.clients.openai.OpenAIModels
import ai.koog.prompt.executor.llms.all.simpleOpenAIExecutor

// "suspend fun main()" is Kotlin's way of writing an async main function.
// If you come from Python, think of it like:  async def main()
// Koog agents run on coroutines, so the entry point must be suspendable.
suspend fun main() {

    // Read the API key from an environment variable.
    // The "?:" operator (called "Elvis") provides a fallback if the value is null.
    // In Python terms:  api_key = os.environ.get("OPENAI_API_KEY") or raise ...
    val apiKey = System.getenv("OPENAI_API_KEY")
        ?: error("Set the OPENAI_API_KEY environment variable before running this example.")

    // Create an executor -- the HTTP client that talks to OpenAI's API.
    // ".use { ... }" automatically closes the connection when the block finishes,
    // similar to Python's "with open(...) as f:" pattern.
    simpleOpenAIExecutor(apiKey).use { executor ->

        // Build the agent. At minimum, it needs:
        //   - an executor (how to reach the LLM)
        //   - a model (which LLM to use)
        //   - a system prompt (the agent's personality / instructions)
        val agent = AIAgent(
            promptExecutor = executor,
            llmModel = OpenAIModels.Chat.GPT4oMini,
            systemPrompt = "You are a concise assistant. Answer in one or two sentences.",
        )

        // Send a prompt and get a text response back.
        val response = agent.run("What makes Kotlin a good language for backend development?")
        println("Agent response: $response")
    }
}

```

### Core Architecture Module: `tutorials/kotlin-agent-with-koog/Step2_AgentWithTools.kt`
```
import ai.koog.agents.core.agent.AIAgent
import ai.koog.agents.core.tools.ToolRegistry
import ai.koog.agents.core.tools.annotations.LLMDescription
import ai.koog.agents.core.tools.annotations.Tool
import ai.koog.agents.core.tools.reflect.ToolSet
import ai.koog.agents.core.tools.reflect.asTools
import ai.koog.prompt.executor.clients.openai.OpenAIModels
import ai.koog.prompt.executor.llms.all.simpleOpenAIExecutor

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------
// A ToolSet is a class whose methods can be called by the LLM.
// Think of it like defining "functions" that an AI assistant can use.
//
// @Tool           -- marks a function as callable by the agent
// @LLMDescription -- tells the LLM what the function (or parameter) does,
//                    so it knows WHEN and HOW to call it
// ---------------------------------------------------------------------------

@LLMDescription("Tools for looking up weather, performing calculations, and retrieving facts")
class AssistantTools : ToolSet {

    @Tool
    @LLMDescription("Get the current weather for a given city. Returns temperature and conditions.")
    fun getWeather(@LLMDescription("City name, e.g. 'Tokyo'") city: String): String {
        // In a real app, this would call a weather API.
        // We use hardcoded data so the tutorial works without extra API keys.
        val data = mapOf(
            "tokyo" to "22C, partly cloudy",
            "london" to "14C, rainy",
            "new york" to "28C, sunny",
            "sydney" to "18C, clear skies",
        )
        return data[city.lowercase()] ?: "25C, clear (default forecast)"
    }

    @Tool
    @LLMDescription("Evaluate a basic arithmetic expression and return the numeric result.")
    fun calculate(@LLMDescription("Arithmetic expression, e.g. '144 / 12'") expression: String): String {
        val result = evaluateExpression(expression)
        return "$expression = $result"
    }

    @Tool
    @LLMDescription("Look up a factual piece of information about a topic.")
    fun lookupFact(@LLMDescription("Topic to look up, e.g. 'Kotlin'") topic: String): String {
        val facts = mapOf(
            "kotlin" to "Kotlin was created by JetBrains and first released in 2011. It became an official Android language in 2017.",
            "koog" to "Koog is an open-source AI agent framework by JetBrains for building LLM-powered agents in Kotlin.",
            "react pattern" to "ReAct (Reason + Act) is an agent pattern where the LLM reasons about a task, takes an action, observes the result, and repeats.",
        )
        return facts[topic.lowercase()] ?: "No specific fact found for '$topic'."
    }

    // Simple recursive expression evaluator for +, -, *, /
    private fun evaluateExpression(expr: String): Double {
        val sanitized = expr.replace(" ", "")
        return when {
            "+" in sanitized.drop(1) -> {
                val i = sanitized.indexOfLast { it == '+' }
                evaluateExpression(sanitized.substring(0, i)) + evaluateExpression(sanitized.substring(i + 1))
            }
            "-" in sanitized.drop(1) -> {
                val i = sanitized.indexOfLast { it == '-' }
                evaluateExpression(sanitized.substring(0, i)) - evaluateExpression(sanitized.substring(i + 1))
            }
            "*" in sanitized -> {
                val i = sanitized.indexOfFirst { it == '*' }
                evaluateExpression(sanitized.substring(0, i)) * evaluateExpression(sanitized.substring(i + 1))
            }
            "/" in sanitized -> {
                val i = sanitized.indexOfFirst { it == '/' }
                evaluateExpression(sanitized.substring(0, i)) / evaluateExpression(sanitized.substring(i + 1))
            }
            else -> sanitized.toDouble()
        }
    }
}

// ---------------------------------------------------------------------------
// Agent configuration and execution
// ---------------------------------------------------------------------------

suspend fun main() {
    val apiKey = System.getenv("OPENAI_API_KEY")
        ?: error("Set the OPENAI_API_KEY environment variable before running this example.")

    // Register the tools so the agent can discover and call them.
    // .asTools() converts the annotated ToolSet class into Koog's internal format.
    val toolRegistry = ToolRegistry {
        tools(AssistantTools().asTools())
    }

    simpleOpenAIExecutor(apiKey).use { executor ->
        val agent = AIAgent(
            promptExecutor = executor,
            llmModel = OpenAIModels.Chat.GPT4oMini,
            systemPrompt = """
                You are a helpful assistant with access to tools for weather, calculations, and fact lookup.
                When asked a question, use the appropriate tools to find the answer.
                Always use tools when they are relevant rather than guessing.
            """.trimIndent(),
            // Pass the tool registry -- without this, the agent has no tools.
            toolRegistry = toolRegistry,
        )

        // Ask a multi-part question that forces the agent to use all three tools.
        val question = "What is the weather in Tokyo, and what is 144 divided by 12? " +
            "Also, tell me an interesting fact about Kotlin."
        println("Question: $question\n")

        // The agent will automatically:
        //   1. Read the question
        //   2. Decide which tools to call (getWeather, calculate, lookupFact)
        //   3. Call each tool and read the results
        //   4. Compose a final answer from the tool outputs
        val response = agent.run(question)
        println("Agent response: $response")
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #90** (2026-09-17): **Add NEXUS-AI marketplace**
  *Symptoms*: Adding NEXUS-AI to production tools.  <!-- This is an auto-generated comment: release notes by coderabbit.ai -->  ## Summary by CodeRabbit  - **Documentation**   - Added NEXUS-AI to the tutorial sponsors section.   - Included a brief description of its marketplace for production AI agent skills and compatibility with MCP/A2A.  <!-- end of auto-generated comment: release notes by coderabbit.ai -->
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  <a href="https://app.coderabbit.ai/change-stack/NirDiamant/agents-towards-production/pull/90#gh-light-mode-only"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui.svg" alt="Review Change Stack" width="202" height="32"></a><a href="https://app.coderabbit.ai/change-stack/NirDiamant/agents-towards-production/pull/90#gh-dark-mode-only"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui-dark.svg" alt="Review Change Stack" width="202" height="32"></a>  <!-- review_stack_entry_end --> <!-- walkthrough_start -->  <details> <summary>📝 Walkthrough</summary>  ## Walkthrough  The README adds NEXUS-AI to the Tutorial Sponsors section. The entry includes a marketplace link and describes 20+ crypto skills for production AI agents with MCP/A2A compatibility.  ### Changes  **Tutorial sponsor listing**  |Laye
  > Closing as duplicate. Keeping the first PR in this repo.

- **Issue #89** (2026-09-17): **Add NEXUS-AI marketplace**
  *Symptoms*: Adding NEXUS-AI to production tools.  <!-- This is an auto-generated comment: release notes by coderabbit.ai -->  ## Summary by CodeRabbit  * **Documentation**   * Added NEXUS-AI to the tutorial sponsors list.   * Included a link to its marketplace and information about its crypto skills and MCP/A2A compatibility.  <!-- end of auto-generated comment: release notes by coderabbit.ai -->
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  <a href="https://app.coderabbit.ai/change-stack/NirDiamant/agents-towards-production/pull/89#gh-light-mode-only"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui.svg" alt="Review Change Stack" width="202" height="32"></a><a href="https://app.coderabbit.ai/change-stack/NirDiamant/agents-towards-production/pull/89#gh-dark-mode-only"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui-dark.svg" alt="Review Change Stack" width="202" height="32"></a>  <!-- review_stack_entry_end --> <!-- walkthrough_start -->  <details> <summary>📝 Walkthrough</summary>  ## Walkthrough  The README adds NEXUS-AI to the Tutorial Sponsors list with a marketplace link and a description of its crypto skills and MCP/A2A compatibility.  ### Changes  **Tutorial Sponsor Listing**  |Layer / File(s)|Summary| |---|---| |**Add
  > Closing as duplicate. Keeping the first PR in this repo.

- **Issue #84** (2026-08-31): **README: feature the new while-loop agents film in the video rail**
  *Symptoms*: Adds the new film (AI Agents Are Just While Loops. That's the Scary Part.) as the lead tile of the Prefer video? rail and reshapes it to a 2x2 grid. All four tiles now carry the `&list=` playlist deep link (the three existing tiles were bare watch URLs). Links stay on the click tracker.  🤖 Generated with [Claude Code](https://claude.com/claude-code)  <!-- This is an auto-generated comment: release notes by coderabbit.ai -->  ## Summary by CodeRabbit  * **New Features**   * Added a new video about AI agents and while loops.   * Updated the video table to use two equal-width columns across two rows. * **Documentation**   * Updated existing video links with playlist-aware tracking URLs.  <!-- end of auto-generated comment: release notes by coderabbit.ai -->
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  [![Review Change Stack](https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui.svg)](https://app.coderabbit.ai/change-stack/NirDiamant/agents-towards-production/pull/84)  <!-- review_stack_entry_end --> <!-- This is an auto-generated comment: failure by coderabbit.ai -->  > [!CAUTION] > ## Review failed >  > The pull request is closed.  <!-- end of auto-generated comment: failure by coderabbit.ai -->  <!-- recent_review_start -->  <details> <summary>ℹ️ Recent review info</summary>  <details> <summary>⚙️ Run configuration</summary>  **Configuration used**: defaults  **Review profile**: CHILL  **Plan**: Pro Plus  **Run ID**: `f54cc6cc-dc83-4449-8bc3-b6a2a07d4797`  </details>  <details> <summary>📥 Commits</summary>  Reviewing files that changed from the base of the PR and between 68cc467cf4cad0768ce17408d6ef78b0d75f30e9 and bcdeacd2c0abf17075dff2c5bac0f

- **Issue #83** (2026-08-28): **Bump python-dotenv from 1.1.0 to 1.2.2 in /tutorials/agent-security-with-llamafirewall**
  *Symptoms*: Bumps [python-dotenv](https://github.com/theskumar/python-dotenv) from 1.1.0 to 1.2.2. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/theskumar/python-dotenv/releases">python-dotenv's releases</a>.</em></p> <blockquote> <h2>v1.2.2</h2> <h3>Added</h3> <ul> <li>Support for Python 3.14, including the free-threaded (3.14t) build. (#)</li> </ul> <h3>Changed</h3> <ul> <li>The <code>dotenv run</code> command now forwards flags directly to the specified command by <a href="https://github.com/bbc2"><code>@​bbc2</code></a> in <a href="https://redirect.github.com/theskumar/python-dotenv/pull/607">theskumar/python-dotenv#607</a></li> <li>Improved documentation clarity regarding override behavior and the reference page.</li> <li>Updated PyPy support to version 3.11.</li> <li>Documentation for FIFO file support.</li> <li>Support for Python 3.9.</li> </ul> <h3>Fixed</h3> <ul> <li>Improved <code>set_key</code> and <code>unset_key</code> behavior when interacting with symlinks by <a href="https://github.com/bbc2"><code>@​bbc2</code></a> in <a href="https://github.com/theskumar/python-dotenv/commit/790c5c02991100aa1bf41ee5330aca75edc51311">#790c5</a></li> <li>Corrected the license specifier and added missing Python 3.14 classifiers in package metadata by <a href="https://github.com/JYOuyang"><code>@​JYOuyang</code></a> in <a href="https://redirect.github.com/theskumar/python-dotenv/pull/590">theskumar/python-dotenv#590</a></li> </ul> <h3>Breaking Cha
  **Post-Mortem & Fix Analysis**:
  > Merging. python-dotenv 1.1 -> 1.2 is a minor bump and the only API this repo uses is load_dotenv(), which is unchanged.

- **Issue #81** (2026-08-28): **test: fix FastAPI streaming response assertions**
  *Symptoms*: ## Summary  - accept the optional charset parameter in the SSE content type - consume the TestClient response through the supported `iter_text()` API - assert that the endpoint emits an actual SSE data frame  ## Motivation  The streaming test currently expects an exact `text/event-stream` header, while FastAPI may append `charset=utf-8`. It also calls `iter_content()`, which is a requests API and is not available on the httpx response returned by FastAPI's TestClient. These assertions prevent the tutorial test suite from validating the streaming endpoint.  ## Validation  - reproduced the existing failure against FastAPI 0.141.1 and httpx 0.28.1 - `.venv/bin/python -m pytest tutorials/fastapi-agent/tests/test_fastapi_agent.py -q`   - result: 3 passed - `git diff --check origin/main...HEAD`  ## Pre-PR checklist  - [x] Change is limited to the existing FastAPI streaming test - [x] Test exercises the real FastAPI endpoint - [x] SSE content is validated rather than only checking for non-empty bytes - [x] No API keys or external services required - [x] No production behavior changed  ## Risks / known gaps  The suite still reports existing Starlette and Pydantic deprecation warnings. Updating those APIs is intentionally outside this focused test fix.   <!-- This is an auto-generated comment: release notes by coderabbit.ai -->  ## Summary by CodeRabbit  - **Tests**   - Improved streaming endpoint validation to support content type variants.   - Added verification that streamed respon
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  [![Review Change Stack](https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui.svg)](https://app.coderabbit.ai/change-stack/NirDiamant/agents-towards-production/pull/81?utm_source=github_walkthrough&utm_medium=github&utm_campaign=change_stack)  <!-- review_stack_entry_end --> <!-- recent_review_start -->  No actionable comments were generated in the recent review. 🎉  <details> <summary>ℹ️ Recent review info</summary>  <details> <summary>⚙️ Run configuration</summary>  **Configuration used**: defaults  **Review profile**: CHILL  **Plan**: Pro Plus  **Run ID**: `3d1c12ab-5f19-4dc4-bc73-1ebec3703642`  </details>  <details> <summary>📥 Commits</summary>  Reviewing files that changed from the base of the PR and between df724c58c16a49924b830694ebfc744d67e037d3 and a7bc7a1c2b76645b863fb3671289c92064fc3143.  </details>  <details> <summary>📒 Files selected f
  > Verified and correct on all three points:  1. `response.iter_content()` is a `requests` API - httpx's `Response` has no such method, so this test was raising `AttributeError` rather than actually testing the stream. 2. Starlette sends `text/event-stream; charset=utf-8`, so the exact-equality assertion could never pass; `.startswith()` is right. 3. `fastapi_agent.py` yields `f"data: {json.dumps({'token': token})}\n\n"`, so asserting on the `data: {"token":` prefix genuinely validates the SSE payload shape instead of just checking that bytes arrived.  Merging. Thanks for tightening this up 🙏

- **Issue #80** (2026-08-28): **fix: declare pandas for the agent security tutorial**
  *Symptoms*: ## Summary  - add the missing `pandas` dependency to the agent security tutorial requirements - normalize the existing requirements file ending  ## Motivation  The tutorial's testing framework imports `pandas` in `model_testing_tools.py`, and the README includes pandas in its quick-start command. However, `requirements.txt` omits it, so a clean requirements installation cannot import the tutorial code.  ## Validation  - reproduced the missing import in a clean uv virtual environment using the original requirements file - `uv pip install --python .venv/bin/python -r tutorials/agent-security-apex/requirements.txt` - `.venv/bin/python -c 'import pandas; print(pandas.__version__)'` (3.0.5) - `git diff --check origin/main...HEAD`  ## Pre-PR checklist  - [x] Change is limited to the existing tutorial dependency list - [x] Dependency has a compatible lower bound - [x] No API keys or sensitive information added - [x] Clean-environment import verified - [x] No unrelated security tutorial behavior changed  ## Risks / known gaps  This PR verifies dependency installation only. It does not run the live OpenAI-backed security evaluation, which requires credentials and incurs external API calls.   <!-- This is an auto-generated comment: release notes by coderabbit.ai -->  ## Summary by CodeRabbit  * **Chores**   * Updated the tutorial’s Python dependencies to include pandas 2.0 or later.  <!-- end of auto-generated comment: release notes by coderabbit.ai -->
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  [![Review Change Stack](https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui.svg)](https://app.coderabbit.ai/change-stack/NirDiamant/agents-towards-production/pull/80?utm_source=github_walkthrough&utm_medium=github&utm_campaign=change_stack)  <!-- review_stack_entry_end --> <!-- recent_review_start -->  No actionable comments were generated in the recent review. 🎉  <details> <summary>ℹ️ Recent review info</summary>  <details> <summary>⚙️ Run configuration</summary>  **Configuration used**: defaults  **Review profile**: CHILL  **Plan**: Pro Plus  **Run ID**: `23e47244-1d6c-467a-9e1b-97ad4a9ce0bc`  </details>  <details> <summary>📥 Commits</summary>  Reviewing files that changed from the base of the PR and between df724c58c16a49924b830694ebfc744d67e037d3 and 355ea8f0b886d93ba380a1c88a13b67890533d41.  </details>  <details> <summary>📒 Files selected f
  > Verified: `model_testing_tools.py` does `import pandas as pd` and the tutorial README already tells readers to `pip install ... pandas`, but `requirements.txt` did not list it. Merging.  Thanks 🙏

- **Issue #79** (2026-08-28): **fix: declare PyPDF2 for the Streamlit tutorial**
  *Symptoms*: ## Summary  - add the missing `PyPDF2` dependency used by the Streamlit tutorial app - normalize the existing requirements file ending  ## Motivation  `tutorials/agent-with-streamlit-ui/app.py` imports `PyPDF2` to process uploaded PDF files, but the tutorial's `requirements.txt` does not install it. A clean installation therefore fails with `ModuleNotFoundError: No module named 'PyPDF2'` before the app can start.  ## Validation  - reproduced the missing import in a clean uv virtual environment using the original requirements file - `uv pip install --python .venv/bin/python -r tutorials/agent-with-streamlit-ui/requirements.txt` - `.venv/bin/python -c 'import PyPDF2; assert PyPDF2.__version__ == "3.0.1"'` - `git diff --check origin/main...HEAD`  ## Pre-PR checklist  - [x] Change is limited to the existing tutorial dependency list - [x] Dependency is explicitly version-bounded - [x] No API keys or sensitive information added - [x] Clean-environment import verified - [x] No unrelated tutorial content changed  ## Risks / known gaps  This PR only fixes dependency installation. It does not change the Streamlit application or execute live OpenAI requests.   <!-- This is an auto-generated comment: release notes by coderabbit.ai -->  ## Summary by CodeRabbit  * **New Features**   * Added PDF processing support to the Streamlit tutorial.  * **Chores**   * Cleaned up dependency formatting.  <!-- end of auto-generated comment: release notes by coderabbit.ai -->
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  [![Review Change Stack](https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui.svg)](https://app.coderabbit.ai/change-stack/NirDiamant/agents-towards-production/pull/79?utm_source=github_walkthrough&utm_medium=github&utm_campaign=change_stack)  <!-- review_stack_entry_end --> <!-- recent_review_start -->  No actionable comments were generated in the recent review. 🎉  <details> <summary>ℹ️ Recent review info</summary>  <details> <summary>⚙️ Run configuration</summary>  **Configuration used**: defaults  **Review profile**: CHILL  **Plan**: Pro Plus  **Run ID**: `5efdf3bf-7735-4a50-9483-b9b1560fc2e0`  </details>  <details> <summary>📥 Commits</summary>  Reviewing files that changed from the base of the PR and between df724c58c16a49924b830694ebfc744d67e037d3 and 5872309c9cf1c3461b2f169a70c2ed7c1470e542.  </details>  <details> <summary>📒 Files selected f
  > Verified: `app.py` and `building-chatbot-notebook.ipynb` both import PyPDF2 but it was missing from `requirements.txt`, so a clean install of this tutorial fails at the first PDF cell. Good catch, merging.  Thanks for the fix 🙏

- **Issue #78** (2026-08-15): **`@carlos2martinize`, I cannot verify these claims from this pull request.**
  *Symptoms*: `@carlos2martinize`, I cannot verify these claims from this pull request.  If you suspect unauthorized access or financial fraud, act through official channels now:  1. Contact the credit union fraud team using the phone number on its official website or your card. 2. Contact each cryptocurrency exchange or wallet provider through its official support channel. 3. Freeze or restrict affected accounts. Change passwords from a known-safe device. Enable multi-factor authentication. 4. Do not share seed phrases, private keys, recovery codes, military identifiers, or remote-screen access. 5. Save evidence. Include transaction IDs, dates, wallet addresses, screenshots, and support-case numbers. 6. Report identity theft to the relevant national identity-theft and law-enforcement services in your location. 7. If there is immediate risk to your safety or finances, contact local emergency services or a trusted financial-security professional.  This comment does not identify a change required for the MCP server code.  🐇 ⚠️  <sub>You are interacting with an AI system.</sub>  <!-- This is an auto-generated reply by CodeRabbit -->  _Originally posted by @coderabbitai[bot] in https://github.com/NirDiamant/agents-towards-production/pull/62#discussion_r3782201813_             

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

### Incident Patch 1: `d4adb477` (2026-08-31)
**Commit Message**: README: feature the new while-loop agents film in the video rail, playlist deep links on every tile (#84)

Co-authored-by: Claude Opus 5 (1M context) <[REDACTED_EMAIL]>

**File**: `README.md` (modified, +15/-6)
```diff
@@ -310,22 +310,31 @@ _Join over 50,000 AI enthusiasts getting unique cutting-edge insights and free t
 
 <table>
 <tr>
-<td width="33%" align="center" valign="top">
-  <a href="https://europe-west1-rag-techniques-views-tracker.cloudfunctions.net/rag-techniques-tracker?notebook=agents-towards-production--readme&amp;click=youtube-readme-ctx&amp;target=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3Da7bteK6c3Ng&amp;retarget=0&amp;text=youtube-readme-ctx">
+<td width="50%" align="center" valign="top">
+  <a href="https://europe-west1-rag-techniques-views-tracker.cloudfunctions.net/rag-techniques-tracker?notebook=agents-towards-production--readme&amp;click=youtube-readme-loop&amp;target=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3DFN1n_NVD9KM%26list%3DPLBrpE2PttR2k&amp;retarget=0&amp;text=youtube-readme-loop">
+    <img src="https://img.youtube.com/vi/FN1n_NVD9KM/mqdefault.jpg" width="100%" alt="">
+    <br><b>AI Agents Are Just While Loops. That's the Scary Part.</b>
+  </a><br>
+  <sub>the whole agent is a text file re-read in a loop, and it can trap itself</sub>
+</td>
+<td width="50%" align="center" valign="top">
+  <a href="https://europe-west1-rag-techniques-views-tracker.cloudfunctions.net/rag-techniques-tracker?notebook=agents-towards-production--readme&amp;click=youtube-readme-ctx&amp;target=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3Da7bteK6c3Ng%26list%3DPLBrpE2PttR2k&amp;retarget=0&amp;text=youtube-readme-ctx">
     <img src="https://img.youtube.com/vi/a7bteK6c3Ng/mqdefault.jpg" width="100%" alt="">
     <br><b>Context Is the New Code</b>
   </a><br>
   <sub>the shift from writing the code to shaping what the model sees</sub>
 </td>
-<td width="33%" align="center" valign="top">
-  <a href="https://europe-west1-rag-techniques-views-tracker.cloudfunctions.net/rag-techniques-tracker?notebook=agents-towards-production--readme&amp;click=youtube-readme-cc&amp;target=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3D0fU8GdipOjc&amp;retarget=0&amp;text=youtube-readme-cc">
+</tr>
+<tr>
+<td width="50%" align="center" valign="top">
+  <a href="https://europe-west1-rag-techniques-views-tracker.cloudfunctions.net/rag-techniques-tracker?notebook=agents-towards-production--readme&amp;click=youtube-readme-cc&amp;target=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3D0fU8GdipOjc%26list%3DPLBrpE2PttR2k&amp;retarget=0&amp;text=youtube-readme-cc">
     <img src="https://img.youtube.com/vi/0fU8GdipOjc/mqdefault.jpg" width="100%" alt="">
     <br><b>Stop Thinking Claude Code Is Magic. Here's How It Works</b>
   </a><br>
   <sub>what the agent loop is actually doing on every turn</sub>
 </td>
-<td width="33%" align="center" valign="top">
-  <a href="https://europe-west1-rag-techniques-views-tracker.cloudfunctions.net/rag-techniques-tracker?notebook=agents-towards-production--readme&amp;click=youtube-readme-llm&amp;target=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3DtKXvKKVQ1Dc&amp;retarget=0&amp;text=youtube-readme-llm">
+<td width="50%" align="center" valign="top">
+  <a href="https://europe-west1-rag-techniques-views-tracker.cloudfunctions.net/rag-techniques-tracker?notebook=agents-towards-production--readme&amp;click=youtube-readme-llm&amp;target=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3DtKXvKKVQ1Dc%26list%3DPLBrpE2PttR2k&amp;retarget=0&amp;text=youtube-readme-llm">
     <img src="https://img.youtube.com/vi/tKXvKKVQ1Dc/mqdefault.jpg" width="100%" alt="">
     <br><b>How LLMs Actually Work (and Why AI Makes Things Up)</b>
   </a><br>
```

---

### Incident Patch 2: `68cc467c` (2026-08-28)
**Commit Message**: Bump python-dotenv in /tutorials/agent-security-with-llamafirewall (#83)

Bumps [python-dotenv](https://github.com/theskumar/python-dotenv) from 1.1.0 to 1.2.2.
- [Release notes](https://github.com/theskumar/python-dotenv/releases)
- [Changelog](https://github.com/theskumar/python-dotenv/blob/main/CHANGELOG.md)
- [Commits](https://github.com/theskumar/python-dotenv/compare/v1.1.0...v1.2.2)

---
updated-dependencies:
- dependency-name: python-dotenv
  dependency-version: 1.2.2
  dependency-type: direct:production
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `tutorials/agent-security-with-llamafirewall/requirements.txt` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 openai-agents==0.0.14
 llamafirewall==1.0.2
-python-dotenv==1.1.0
+python-dotenv==1.2.2
 nest-asyncio==1.6.0
 pydantic==2.11.4
\ No newline at end of file
```

---

### Incident Patch 3: `80eb9d8f` (2026-08-28)
**Commit Message**: fix: add the missing mcp_server.py the MCP tutorial depends on

Closes #27.

The tutorial links to scripts/mcp_server.py and tells the reader to run
'cp ../scripts/mcp_server.py .', but that file was never committed, so the
tutorial was unrunnable at its central step.

Reconstructed the server from the contract recorded in the notebook's own
saved output: two tools, get_crypto_price and get_crypto_market_info, with
the same names, docstrings and 'The current price of X is N USD' response
format the notebook shows.

Written against MCP SDK 2.x, where FastMCP was renamed to MCPServer. An
unpinned 'uv add "mcp[cli]"' now resolves to 2.x, so the install line in
the notebook is pinned to >=2.0 to match.

Verified end to end: connected a stdio client, discovered both tools, and
called each against the live CoinGecko API.

**File**: `tutorials/agent-with-mcp/mcp-tutorial.ipynb` (modified, +3/-1)
```diff
@@ -132,7 +132,9 @@
     "source .venv/bin/activate  # On Windows: .venv\\Scripts\\activate\n",
     "\n",
     "# Install dependencies\n",
-    "uv add \"mcp[cli]\" httpx\n",
+    "# Note: MCP SDK 2.x renamed FastMCP to MCPServer. scripts/mcp_server.py\n",
+    "# uses the 2.x API, so pin >=2.0 rather than an unversioned install.\n",
+    "uv add \"mcp[cli]>=2.0\" httpx\n",
     "```"
    ]
   },
```

**File**: `tutorials/agent-with-mcp/scripts/mcp_server.py` (added, +130/-0)
```diff
@@ -0,0 +1,130 @@
+"""
+A minimal MCP server that exposes cryptocurrency data as tools.
+
+This is the server the MCP tutorial connects to. It publishes two tools over
+stdio using FastMCP, both backed by the free CoinGecko public API (no API key
+required):
+
+    get_crypto_price(crypto_id, currency)       -> current price
+    get_crypto_market_info(crypto_ids, currency) -> price, market cap, volume, changes
+
+Run it directly:
+
+    uv add "mcp[cli]>=2.0" httpx
+    uv run mcp_server.py
+
+The server speaks stdio, so it produces no output of its own when it starts.
+That is expected - it is waiting for a client (the notebook, or Claude Desktop)
+to connect and call `initialize`.
+"""
+
+import httpx
+from mcp.server.mcpserver import MCPServer
+
+# The server name is what clients display when they list connected servers.
+# Note: in MCP SDK 2.x this class is MCPServer. It was called FastMCP in 1.x,
+# so older tutorials you find elsewhere will import `mcp.server.fastmcp`.
+mcp = MCPServer("crypto-price-tracker")
+
+COINGECKO_API = "https://api.coingecko.com/api/v3"
+
+# CoinGecko rate-limits anonymous callers fairly aggressively, so keep a single
+# client with a sane timeout rather than opening a connection per call.
+_TIMEOUT = httpx.Timeout(15.0)
+
+
+@mcp.tool()
+async def get_crypto_price(crypto_id: str, currency: str = "usd") -> str:
+    """
+    Get the current price of a cryptocurrency in a specified currency.
+
+    Parameters:
+    - crypto_id: The ID of the cryptocurrency (e.g., 'bitcoin', 'ethereum')
+    - currency: The currency to display the price in (default: 'usd')
+
+    Returns:
+    - Current price information as a formatted string
+    """
+    crypto_id = crypto_id.strip().lower()
+    currency = currency.strip().lower()
+
+    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
+        try:
+            response = await client.get(
+                f"{COINGECKO_API}/simple/price",
+                params={"ids": crypto_id, "vs_currencies": currency},
+            )
+            response.raise_for_status()
+        except httpx.HTTPError as exc:
+            # Return the error as text rather than raising: the client is an LLM,
+            # and a readable message is more useful to it than a stack trace.
+            return f"Could not reach CoinGecko to price {crypto_id}: {exc}"
+
+    data = response.json()
+
+    if crypto_id not in data:
+        return (
+            f"Unknown cryptocurrency '{crypto_id}'. "
+            "Use a CoinGecko ID such as 'bitcoin', 'ethereum' or 'solana'."
+        )
+    if currency not in data[crypto_id]:
+        return f"Unknown currency '{currency}' for {crypto_id}."
+
+    price = data[crypto_id][currency]
+    return f"The current price of {crypto_id} is {price} {currency.upper()}"
+
+
+@mcp.tool()
+async def get_crypto_market_info(crypto_ids: str, currency: str = "usd") -> str:
+    """
+    Get market information for one or more cryptocurrencies.
+
+    Parameters:
+    - crypto_ids: Comma-separated list of cryptocurrency IDs (e.g., 'bitcoin,ethereum')
+    - currency: The currency to display values in (default: 'usd')
+
+    Returns:
+    - Market information including price, market cap, volume, and price changes
+    """
+    ids = [c.strip().lower() for c in crypto_ids.split(",") if c.strip()]
+    if not ids:
+        return "No cryptocurrency IDs provided."
+    currency = currency.strip().lower()
+
+    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
+        try:
+            response = await client.get(
+                f"{COINGECKO_API}/coins/markets",
+                params={"vs_currency": currency, "ids": ",".join(ids)},
+            )
+            response.raise_for_status()
+        except httpx.HTTPError as exc:
+            return f"Could not reach CoinGecko for market data: {exc}"
+
+    markets = response.json()
+    if not markets:
+        return (
+            f"No market data found for: {', '.join(ids)}. "
+            "Check that these are valid CoinGecko IDs."
+        )
+
+    unit = currency.upper()
+    lines = []
+    for coin in markets:
+        change = coin.get("price_change_percentage_24h")
+        change_text = f"{change:+.2f}%" if change is not None else "n/a"
+        lines.append(
+            f"{coin.get('name', coin['id'])} ({coin.get('symbol', '').upper()})\n"
+            f"  Price:        {coin.get('current_price')} {unit}\n"
+            f"  Market cap:   {coin.get('market_cap')} {unit}\n"
+            f"  24h volume:   {coin.get('total_volume')} {unit}\n"
+            f"  24h change:   {change_text}"
+        )
+
+    return "\n\n".join(lines)
+
+
+if __name__ == "__main__":
+    # stdio is the transport Claude Desktop and the notebook's StdioServerParameters
+    # both expect. The server runs until the client disconnects.
+    mcp.run(transport="stdio")
```

---

### Incident Patch 4: `7c16432f` (2026-08-28)
**Commit Message**: test: fix FastAPI streaming response assertions (#81)

**File**: `tutorials/fastapi-agent/tests/test_fastapi_agent.py` (modified, +3/-4)
```diff
@@ -33,7 +33,6 @@ def test_stream_endpoint():
     """Test the streaming agent endpoint"""
     with client.stream("POST", "/agent/stream", json={"query": "Test query"}) as response:
         assert response.status_code == 200
-        assert response.headers["content-type"] == "text/event-stream"
-        # Check that we receive at least some content
-        content = response.iter_content().read()
-        assert len(content) > 0 
\ No newline at end of file
+        assert response.headers["content-type"].startswith("text/event-stream")
+        content = "".join(response.iter_text())
+        assert 'data: {"token":' in content
```

---

### Incident Patch 5: `f70fd58a` (2026-08-28)
**Commit Message**: fix: declare pandas dependency for the agent security tutorial (#80)

**File**: `tutorials/agent-security-apex/requirements.txt` (modified, +2/-1)
```diff
@@ -2,4 +2,5 @@
 python-dotenv>=1.0.0
 aiohttp>=3.8.0
 ipython>=7.30.1
-openai>=1.0.0
\ No newline at end of file
+openai>=1.0.0
+pandas>=2.0.0
```

---

### Incident Patch 6: `3fd9c149` (2026-08-28)
**Commit Message**: fix: declare PyPDF2 dependency for the Streamlit UI tutorial (#79)

**File**: `tutorials/agent-with-streamlit-ui/requirements.txt` (modified, +2/-1)
```diff
@@ -1,4 +1,5 @@
 streamlit>=1.28.0
 langchain>=0.1.0
 openai>=1.0.0
-python-dotenv>=1.0.0 
\ No newline at end of file
+python-dotenv>=1.0.0
+PyPDF2>=3.0.1
```

---

### Incident Patch 7: `e88a8122` (2026-06-03)
**Commit Message**: Auto-apply RAGKING via ?code=, frame as GitHub-community offer, fix rating

- RAG book links now use /rag-made-simple?code=RAGKING so the 33% launch
  discount auto-applies at checkout for the GitHub community.
- Reword the coupon copy as a GitHub-community offer.
- Correct the book rating to 4.6 stars.

Co-Authored-By: Claude Opus 4.8 (1M context) <[REDACTED_EMAIL]>

**File**: `README.md` (modified, +5/-5)
```diff
@@ -23,14 +23,14 @@
 
 ## 📖 Books in the DiamantAI Series
 
-<a href="https://diamant-ai.com/rag-made-simple"><img src="images/rag_book_best_seller.png" alt="RAG Made Simple - Amazon bestseller in Generative AI" width="500"></a>
+<a href="https://diamant-ai.com/rag-made-simple?code=RAGKING"><img src="images/rag_book_best_seller.png" alt="RAG Made Simple - Amazon bestseller in Generative AI" width="500"></a>
 
-**[RAG Made Simple](https://diamant-ai.com/rag-made-simple)** - the production reference for RAG systems
+**[RAG Made Simple](https://diamant-ai.com/rag-made-simple?code=RAGKING)** - the production reference for RAG systems
 A 400-page visual guide to 22 RAG techniques. If you're shipping agents that need to retrieve and ground on real data, this is the structured reference behind the patterns in this repo.
-*1,500+ copies sold · Hit #1 in Generative AI on Amazon at launch · ⭐ 4.4 stars*
-**PDF + EPUB · 33% off at checkout with code RAGKING (launch offer)**
+*1,500+ copies sold · Hit #1 in Generative AI on Amazon at launch · ⭐ 4.6 stars*
+**PDF + EPUB · GitHub community offer: 33% off with code RAGKING**
 
-👉 [**Get RAG Made Simple (33% off with code RAGKING)**](https://diamant-ai.com/rag-made-simple)
+👉 [**Get RAG Made Simple (33% off with code RAGKING)**](https://diamant-ai.com/rag-made-simple?code=RAGKING)
 
 ---
 
```

---

### Incident Patch 8: `660776aa` (2026-05-31)
**Commit Message**: Fix README centering: close banner div so body reads left-aligned

The earlier 'demote jobs section' change left the opening <div align=center>
by the banner while moving its closing </div> to the bottom jobs panel, so
the entire README body rendered centered. Close the div right after the
banner (keeps the hero centered) and drop the stray </div> at the bottom,
restoring left-aligned body text and the left-aligned jobs panel.

Co-Authored-By: Claude Opus 4.8 (1M context) <[REDACTED_EMAIL]>

**File**: `README.md` (modified, +2/-2)
```diff
@@ -55,6 +55,8 @@ A 400-page visual guide to 22 RAG techniques. If you're shipping agents that nee
 
 <img src="images/collective-banner.png" alt="DiamantAI Collective - AI engineering jobs" width="600">
 
+</div>
+
 ## 💎 Tutorial Sponsors
 
 <p align="center"><em>
@@ -716,8 +718,6 @@ python app.py
 
 ---
 
-</div>
-
 ## 🤝 Contributing
 
 We welcome contributions of tools, infrastructure, and frameworks that support agent development. This includes monitoring, deployment platforms, security tools, databases, APIs, and other horizontal services that enable production agent systems.
```

---

### Incident Patch 9: `575af12b` (2026-05-30)
**Commit Message**: docs(readme): cross-link Agent Memory Techniques repo

Add a link to the Agent Memory Techniques notebooks so readers of this repo
discover the agent-memory tutorials.

Co-Authored-By: Claude Opus 4.8 (1M context) <[REDACTED_EMAIL]>

**File**: `README.md` (modified, +1/-0)
```diff
@@ -351,6 +351,7 @@ Free long-form guides on DiamantAI that complement these production tutorials:
 - [Why AI agents need to check their own work](https://diamant-ai.com/blog/why-ai-agents-need-to-check-their-own-work)
 - [This simple trick makes AI agents far more reliable](https://diamant-ai.com/blog/this-simple-trick-makes-ai-agents-far-more-reliable)
 - [Memory optimization strategies in AI agents](https://diamant-ai.com/blog/memory-optimization-strategies-in-ai-agents)
+- [Agent Memory Techniques](https://github.com/NirDiamant/Agent_Memory_Techniques) — 30 runnable notebooks on giving production agents memory: buffers, vector stores, knowledge graphs, Mem0, MemGPT/Letta, Zep, and Graphiti
 - [**Browse all 130+ tutorials →**](https://diamant-ai.com/tutorials) · [**Read the blog →**](https://diamant-ai.com/blog)
 
 ---
```

---

### Incident Patch 10: `724f1f7b` (2026-05-23)
**Commit Message**: docs: refresh book promo - fix stale pricing, add Prompt Engineering cross-promo (#63)

The "From the Same Author" section advertised RAG Made Simple at "$0.99 launch
price (goes up soon)". The Kindle price was raised to $9.99 on May 16.

This repo also wasn't cross-promoting the Prompt Engineering companion book.

Changes:
- Replace stale launch pricing with current: Kindle $9.99, Paperback $24.99
- Use verifiable social proof: 1,500+ sold, hit #1 at launch, 4.4 stars
- Restructure as "Books in the DiamantAI Series" with both titles
- Add Prompt Engineering cross-promo (tracked with diamantai-atp-20 tag)
- Preserve all existing tracker URLs and affiliate tags

**File**: `README.md` (modified, +14/-5)
```diff
@@ -22,14 +22,23 @@
 
 <div align="center">
 
-## 📖 From the Same Author
+## 📖 Books in the DiamantAI Series
 
-<a href="https://europe-west1-rag-techniques-views-tracker.cloudfunctions.net/rag-techniques-tracker?notebook=agents-towards-production--readme&click=book-buy-amazon-image&target=https%3A%2F%2Fwww.amazon.com%2Fdp%2FB0D76734SZ%3Ftag%3Ddiamantai-atp-20&text=Best%20Seller%20Image"><img src="images/rag_book_best_seller.png" alt="#1 Best Seller in Generative AI on Amazon - Click to buy" width="500"></a>
+<a href="https://europe-west1-rag-techniques-views-tracker.cloudfunctions.net/rag-techniques-tracker?notebook=agents-towards-production--readme&click=book-buy-amazon-image&target=https%3A%2F%2Fwww.amazon.com%2Fdp%2FB0D76734SZ%3Ftag%3Ddiamantai-atp-20&text=Best%20Seller%20Image"><img src="images/rag_book_best_seller.png" alt="RAG Made Simple - Amazon bestseller in Generative AI" width="500"></a>
 
-**[RAG Made Simple](https://europe-west1-rag-techniques-views-tracker.cloudfunctions.net/rag-techniques-tracker?notebook=agents-towards-production--readme&click=book-buy-amazon-title&target=https%3A%2F%2Fwww.amazon.com%2Fdp%2FB0D76734SZ%3Ftag%3Ddiamantai-atp-20&text=RAG%20Made%20Simple)** — **#1 Best Seller on Amazon in Generative AI.**
-22 RAG techniques with intuition, comparisons, and illustrations. **Free with Kindle Unlimited** or **$0.99** launch price (goes up soon).
+**[RAG Made Simple](https://europe-west1-rag-techniques-views-tracker.cloudfunctions.net/rag-techniques-tracker?notebook=agents-towards-production--readme&click=book-buy-amazon-title&target=https%3A%2F%2Fwww.amazon.com%2Fdp%2FB0D76734SZ%3Ftag%3Ddiamantai-atp-20&text=RAG%20Made%20Simple)** - the production reference for RAG systems
+A 400-page visual guide to 22 RAG techniques. If you're shipping agents that need to retrieve and ground on real data, this is the structured reference behind the patterns in this repo.
+*1,500+ copies sold · Hit #1 in Generative AI on Amazon at launch · ⭐ 4.4 stars*
+**Kindle $9.99 · Paperback $24.99 · Free with Kindle Unlimited**
 
-### 👉 [**Get the book on Amazon**](https://europe-west1-rag-techniques-views-tracker.cloudfunctions.net/rag-techniques-tracker?notebook=agents-towards-production--readme&click=book-buy-amazon-cta&target=https%3A%2F%2Fwww.amazon.com%2Fdp%2FB0D76734SZ%3Ftag%3Ddiamantai-atp-20&text=Get%20the%20book%20on%20Amazon)
+👉 [**Get RAG Made Simple on Amazon**](https://europe-west1-rag-techniques-views-tracker.cloudfunctions.net/rag-techniques-tracker?notebook=agents-towards-production--readme&click=book-buy-amazon-cta&target=https%3A%2F%2Fwww.amazon.com%2Fdp%2FB0D76734SZ%3Ftag%3Ddiamantai-atp-20&text=Get%20RAG%20Made%20Simple)
+
+---
+
+**[Prompt Engineering: Master the Art of AI Interaction](https://europe-west1-rag-techniques-views-tracker.cloudfunctions.net/rag-techniques-tracker?notebook=agents-towards-production--readme&click=book-buy-pe&target=https%3A%2F%2Fwww.amazon.com%2Fdp%2FB0DZ85RPB5%3Ftag%3Ddiamantai-atp-20&text=Prompt%20Engineering)** - the prompting foundation
+22 hands-on prompting techniques explained in depth. The companion book to RAG Made Simple. The prompting layer that determines how reliably your production agents behave.
+
+👉 [**See Prompt Engineering on Amazon**](https://europe-west1-rag-techniques-views-tracker.cloudfunctions.net/rag-techniques-tracker?notebook=agents-towards-production--readme&click=book-buy-pe-cta&target=https%3A%2F%2Fwww.amazon.com%2Fdp%2FB0DZ85RPB5%3Ftag%3Ddiamantai-atp-20&text=See%20Prompt%20Engineering)
 
 </div>
 
```

---

### Incident Patch 11: `ae289378` (2026-04-15)
**Commit Message**: Revert RAG book promotion back to $0.99 launch pricing (#57)

The book was briefly raised to $9.99 to prep for a Kindle Countdown Deal, but KDP's 30-day list price stability rule blocked the countdown. Price restored to $0.99 for the remainder of the launch window.

PE Book countdown banner (where present) remains since PE is still on its Kindle Countdown Deal at $2.99 through April 21.

Co-authored-by: NirDiamant <[REDACTED_EMAIL]>

**File**: `README.md` (modified, +1/-1)
```diff
@@ -26,7 +26,7 @@
 <a href="https://europe-west1-rag-techniques-views-tracker.cloudfunctions.net/rag-techniques-tracker?notebook=agents-towards-production--readme&click=book-buy-amazon-image&target=https%3A%2F%2Fwww.amazon.com%2Fdp%2FB0D76734SZ%3Ftag%3Ddiamantai-atp-20&text=Best%20Seller%20Image"><img src="images/rag_book_best_seller.png" alt="#1 Best Seller in Generative AI on Amazon - Click to buy" width="500"></a>
 
 **[RAG Made Simple](https://europe-west1-rag-techniques-views-tracker.cloudfunctions.net/rag-techniques-tracker?notebook=agents-towards-production--readme&click=book-buy-amazon-title&target=https%3A%2F%2Fwww.amazon.com%2Fdp%2FB0D76734SZ%3Ftag%3Ddiamantai-atp-20&text=RAG%20Made%20Simple)** — **#1 Best Seller on Amazon in Generative AI.**
-22 RAG techniques with intuition, comparisons, and illustrations. **Free with Kindle Unlimited** or **$9.99** on Amazon.
+22 RAG techniques with intuition, comparisons, and illustrations. **Free with Kindle Unlimited** or **$0.99** launch price (goes up soon).
 
 ### 👉 [**Get the book on Amazon**](https://europe-west1-rag-techniques-views-tracker.cloudfunctions.net/rag-techniques-tracker?notebook=agents-towards-production--readme&click=book-buy-amazon-cta&target=https%3A%2F%2Fwww.amazon.com%2Fdp%2FB0D76734SZ%3Ftag%3Ddiamantai-atp-20&text=Get%20the%20book%20on%20Amazon)
 
```

---

### Incident Patch 12: `6d5923cd` (2026-04-10)
**Commit Message**: Clean up README formatting (fix dashes, normalize spacing)

**File**: `README.md` (modified, +411/-411)
```diff
@@ -25,7 +25,7 @@
 
 <a href="https://europe-west1-rag-techniques-views-tracker.cloudfunctions.net/rag-techniques-tracker?notebook=agents-towards-production--readme&click=book-buy-amazon-image&target=https%3A%2F%2Fwww.amazon.com%2Fdp%2FB0D76734SZ%3Ftag%3Ddiamantai-atp-20&text=Best%20Seller%20Image"><img src="images/rag_book_best_seller.png" alt="#1 Best Seller in Generative AI on Amazon - Click to buy" width="500"></a>
 
-**[RAG Made Simple](https://europe-west1-rag-techniques-views-tracker.cloudfunctions.net/rag-techniques-tracker?notebook=agents-towards-production--readme&click=book-buy-amazon-title&target=https%3A%2F%2Fwww.amazon.com%2Fdp%2FB0D76734SZ%3Ftag%3Ddiamantai-atp-20&text=RAG%20Made%20Simple)** — **#1 Best Seller on Amazon in Generative AI.**
+**[RAG Made Simple](https://europe-west1-rag-techniques-views-tracker.cloudfunctions.net/rag-techniques-tracker?notebook=agents-towards-production--readme&click=book-buy-amazon-title&target=https%3A%2F%2Fwww.amazon.com%2Fdp%2FB0D76734SZ%3Ftag%3Ddiamantai-atp-20&text=RAG%20Made%20Simple)** - **#1 Best Seller on Amazon in Generative AI.**
 22 RAG techniques with intuition, comparisons, and illustrations. **Free with Kindle Unlimited** or **$0.99** launch price (goes up soon).
 
 ### 👉 [**Get the book on Amazon**](https://europe-west1-rag-techniques-views-tracker.cloudfunctions.net/rag-techniques-tracker?notebook=agents-towards-production--readme&click=book-buy-amazon-cta&target=https%3A%2F%2Fwww.amazon.com%2Fdp%2FB0D76734SZ%3Ftag%3Ddiamantai-atp-20&text=Get%20the%20book%20on%20Amazon)
@@ -43,180 +43,180 @@ Companies that have contributed step-by-step tutorials to this repository.<br>
 Click a logo to open the tutorial. Use Ctrl‑/⌘‑click to keep this page open.
 </em></p>
 
-<!-- ─────────── 1st row – 4 sponsors ─────────── -->
+<!-- ─────────── 1st row - 4 sponsors ─────────── -->
 <table align="center" cellpadding="20"
-       style="table-layout:fixed; width:100%; border-collapse:collapse;">
+ style="table-layout:fixed; width:100%; border-collapse:collapse;">
 <tr align="center" valign="top">
 
-  <!-- LangChain -->
-  <td width="200" valign="bottom">
-    <a href="tutorials/LangGraph-agent" title="Open LangChain tutorial">
-      <picture>
-        <source media="(prefers-color-scheme: dark)"
-                srcset="assets/repos_images/sponsors_logos/trimmed_padded/trimmed_padded_langchain_white.png">
-        <img src="assets/repos_images/sponsors_logos/trimmed_padded/trimmed_padded_langchain.png"
-             height="44" style="max-width:180px;" alt="LangChain - AI agent framework and workflow orchestration platform for building production-ready language model applications">
-      </picture>
-    </a><br>
-    <sub><span style="white-space:nowrap;">Agent Framework &amp; Workflows</span><br>
-      <a href="https://langchain.com">
-        <img src="assets/repos_images/visit-site-badge.svg" width="56" height="16" alt="Visit LangChain AI agent framework website">
-      </a>
-    </sub>
-  </td>
-
-  <!-- Redis -->
-  <td width="200" valign="bottom">
-    <a href="tutorials/agent-memory-with-redis" title="Open Redis tutorial">
-      <picture>
-        <source media="(prefers-color-scheme: dark)"
-                srcset="assets/repos_images/sponsors_logos/trimmed_padded/trimmed_padded_Redis_white.svg">
-        <img src="assets/repos_images/sponsors_logos/trimmed_padded/trimmed_padded_Redis.png"
-             height="44" style="max-width:180px;" alt="Redis - In-memory database and vector storage for AI agent memory, caching, and real-time data processing">
-      </picture>
-    </a><br>
-    <sub><span style="white-space:nowrap;">Memory &amp; Vector Database</span><br>
-      <a href="https://redis.io/try-free/?utm_source=nir&utm_medium=cpa&utm_campaign=2025-05-ai_in_production-influencer-nir&utm_content=sd-software_download-7013z000001WaRY">
-        <img src="assets/repos_images/visit-site-badge.svg" width="56" height="16" alt="Visit Redis in-memory database and vector storage website">
-      </a>
-    </sub>
-  </td>
-
-  <!-- Contextual AI -->
-  <td width="200" valign="bottom">
-    <a href="tutorials/agent-RAG-with-Contextual" title="Open Contextual AI tutorial">
-      <picture>
-        <source media="(prefers-color-scheme: dark)"
-                srcset="assets/repos_images/sponsors_logos/trimmed_padded/trimmed_padded_contextual_white.png">
-        <img src="assets/repos_images/sponsors_logos/trimmed_padded/trimmed_padded_contextual_black.png"
-             height="44" style="max-width:180px;" alt="Contextual AI - Production-ready RAG platform for building enterprise-grade retrieval augmented generation systems">
-      </picture>
-    </a><br>
-    <sub><span style="white-space:nowrap;">RAG &amp; Knowledge Management</span><br>
-      <a href="https://app.contextual.ai/?utm_campaign=agents-towards-production&utm_source=diamantai&utm_medium=github&utm_content=notebook">
-        <img src="assets/repos_images/visit-site-badge.svg" width="56
```

---

### Incident Patch 13: `29be6d82` (2026-03-17)
**Commit Message**: Simplify Kotlin Koog Step 3 with built-in structuredOutputWithToolsStrategy and add Kotlin UTM links

Replace custom strategy graph in Step 3 with Koog's built-in structuredOutputWithToolsStrategy<CityAnalysis>().
Add kotlinlang.org UTM tracking links in README and tutorial per Kotlin team feedback.

Co-Authored-By: Claude Opus 4.6 (1M context) <[REDACTED_EMAIL]>

**File**: `README.md` (modified, +4/-4)
```diff
@@ -155,8 +155,8 @@ Click a logo to open the tutorial. Use Ctrl‑/⌘‑click to keep this page ope
       </picture>
     </a><br>
     <sub><span style="white-space:nowrap;">Kotlin AI Agent Framework</span><br>
-      <a href="https://www.jetbrains.com">
-        <img src="assets/repos_images/visit-site-badge.svg" width="56" height="16" alt="Visit JetBrains website">
+      <a href="https://kotlinlang.org/?utm_source=github&utm_medium=influencers&utm_campaign=kotlin_nir_supporter_1">
+        <img src="assets/repos_images/visit-site-badge.svg" width="56" height="16" alt="Visit Kotlin website">
       </a>
     </sub>
   </td>
@@ -539,8 +539,8 @@ All knowledge is delivered through runnable tutorials covering orchestration, me
     </td>
   </tr>
   <tr>
-    <td>Building AI Agents in Kotlin with Koog <img src="https://img.shields.io/badge/NEW-brightgreen" height="16"></td>
-    <td>Build your first AI agent in Kotlin using JetBrains' Koog framework. Step-by-step from hello world to tool calling and structured output in under 30 minutes.</td>
+    <td>Building AI Agents in <a href="https://kotlinlang.org/?utm_source=github&utm_medium=influencers&utm_campaign=kotlin_nir_supporter_1">Kotlin</a> with Koog <img src="https://img.shields.io/badge/NEW-brightgreen" height="16"></td>
+    <td>Build your first AI agent in <a href="https://kotlinlang.org/?utm_source=github&utm_medium=influencers&utm_campaign=kotlin_nir_supporter_1">Kotlin</a> using JetBrains' Koog framework. Step-by-step from hello world to tool calling and structured output in under 30 minutes.</td>
     <td align="center">
       <a href="https://github.com/NirDiamant/agents-towards-production/tree/main/tutorials/kotlin-agent-with-koog"><img src="https://img.shields.io/badge/GitHub-View-blue" height="20"></a>
     </td>
```

**File**: `tutorials/kotlin-agent-with-koog/README.md` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@
 
 # Building AI Agents in Kotlin with Koog
 
-Build your first AI agent in Kotlin using JetBrains' Koog framework, progressing from a basic prompt-response agent through tool calling and structured output.
+Build your first AI agent in [Kotlin](https://kotlinlang.org/?utm_source=github&utm_medium=influencers&utm_campaign=kotlin_nir_supporter_1) using JetBrains' Koog framework, progressing from a basic prompt-response agent through tool calling and structured output.
 
 ## What You'll Learn
 
```

**File**: `tutorials/kotlin-agent-with-koog/Step3_StructuredOutput.kt` (modified, +5/-20)
```diff
@@ -1,9 +1,7 @@
 import ai.koog.agents.core.agent.AIAgent
 import ai.koog.agents.core.agent.config.AIAgentConfig
-import ai.koog.agents.core.dsl.builder.forwardTo
-import ai.koog.agents.core.dsl.builder.strategy
-import ai.koog.agents.core.dsl.extension.nodeLLMRequestStructured
 import ai.koog.agents.core.tools.annotations.LLMDescription
+import ai.koog.agents.ext.agent.structuredOutputWithToolsStrategy
 import ai.koog.prompt.dsl.prompt
 import ai.koog.prompt.executor.clients.openai.OpenAIModels
 import ai.koog.prompt.executor.llms.all.simpleOpenAIExecutor
@@ -55,22 +53,6 @@ suspend fun main() {
     val apiKey = System.getenv("OPENAI_API_KEY")
         ?: error("Set the OPENAI_API_KEY environment variable before running this example.")
 
-    // A "strategy" is a graph that tells Koog how to process the request.
-    // This one has two nodes:
-    //   1. preparePrompt -- passes the user's input string through unchanged
-    //   2. getStructured -- sends it to the LLM and parses the response into CityAnalysis
-    //
-    // Think of it as a pipeline:  input -> prepare -> LLM (structured) -> output
-    val structuredStrategy = strategy<String, CityAnalysis>("city-analysis") {
-        val preparePrompt by node<String, String> { input -> input }
-
-        val getStructured by nodeLLMRequestStructured<CityAnalysis>()
-
-        // Wire the nodes together: start -> prepare -> structured -> finish
-        nodeStart then preparePrompt then getStructured
-        edge(getStructured forwardTo nodeFinish transformed { it.getOrThrow().data })
-    }
-
     val agentConfig = AIAgentConfig(
         prompt = prompt("city-analyst") {
             system("You are a knowledgeable city analyst. When asked about a city, provide accurate structured data.")
@@ -80,9 +62,12 @@ suspend fun main() {
     )
 
     simpleOpenAIExecutor(apiKey).use { executor ->
+        // structuredOutputWithToolsStrategy<CityAnalysis>() is a built-in Koog strategy
+        // that lets the agent call tools in a loop and then finish with a structured
+        // output of the specified type once the process is complete.
         val agent = AIAgent(
             promptExecutor = executor,
-            strategy = structuredStrategy,
+            strategy = structuredOutputWithToolsStrategy<CityAnalysis>(),
             agentConfig = agentConfig,
         )
 
```

**File**: `tutorials/kotlin-agent-with-koog/tutorial.md` (modified, +9/-22)
```diff
@@ -2,7 +2,7 @@
 
 # Building AI Agents in Kotlin with Koog
 
-Kotlin powers a significant portion of backend infrastructure across the JVM ecosystem, yet most AI agent tutorials target Python exclusively. This tutorial bridges that gap using Koog, JetBrains' open-source framework for building LLM-powered agents in Kotlin. By the end, you will have built an agent that can reason about tasks, call tools autonomously, and return typed Kotlin objects instead of raw text.
+[Kotlin](https://kotlinlang.org/?utm_source=github&utm_medium=influencers&utm_campaign=kotlin_nir_supporter_1) powers a significant portion of backend infrastructure across the JVM ecosystem, yet most AI agent tutorials target Python exclusively. This tutorial bridges that gap using Koog, JetBrains' open-source framework for building LLM-powered agents in [Kotlin](https://kotlinlang.org/?utm_source=github&utm_medium=influencers&utm_campaign=kotlin_nir_supporter_1). By the end, you will have built an agent that can reason about tasks, call tools autonomously, and return typed Kotlin objects instead of raw text.
 
 The tutorial progresses through three self-contained steps. You will start with a minimal agent that sends a single prompt to an LLM, then extend it with custom tools that the agent invokes on its own, and finally configure structured output so the LLM returns data as a Kotlin data class you can work with directly in code.
 
@@ -418,16 +418,16 @@ Note the `@property:LLMDescription` syntax. In Kotlin data classes, annotations
 
 ### Configuring the Structured Output Strategy
 
-Unlike the previous steps that used the default strategy, structured output requires a custom strategy graph. The `nodeLLMRequestStructured` node tells Koog to send the data class schema to the model and parse the response into a typed object. The strategy graph connects the input to this node and forwards the result to the finish node.
+Koog provides a built-in `structuredOutputWithToolsStrategy<T>()` function that handles the entire structured output flow. You pass it as the agent's strategy, and Koog takes care of sending the data class schema to the model, letting the agent call tools in a loop if needed, and finishing with a typed response once the process is complete. No custom strategy graph required.
+
+The strategy is available at `ai.koog.agents.ext.agent.structuredOutputWithToolsStrategy` and also includes optional settings such as `fixingParser` and `parallelTools`.
 
 ```kotlin
 // Step3_StructuredOutput.kt (agent setup)
 
 import ai.koog.agents.core.agent.AIAgent
 import ai.koog.agents.core.agent.config.AIAgentConfig
-import ai.koog.agents.core.dsl.builder.forwardTo
-import ai.koog.agents.core.dsl.builder.strategy
-import ai.koog.agents.core.dsl.extension.nodeLLMRequestStructured
+import ai.koog.agents.ext.agent.structuredOutputWithToolsStrategy
 import ai.koog.prompt.dsl.prompt
 import ai.koog.prompt.executor.clients.openai.OpenAIModels
 import ai.koog.prompt.executor.llms.all.simpleOpenAIExecutor
@@ -436,22 +436,6 @@ suspend fun main() {
     val apiKey = System.getenv("OPENAI_API_KEY")
         ?: error("Set the OPENAI_API_KEY environment variable before running this example.")
 
-    // A "strategy" is a graph that tells Koog how to process the request.
-    // This one has two nodes:
-    //   1. preparePrompt -- passes the user's input string through unchanged
-    //   2. getStructured -- sends it to the LLM and parses the response into CityAnalysis
-    //
-    // Think of it as a pipeline:  input -> prepare -> LLM (structured) -> output
-    val structuredStrategy = strategy<String, CityAnalysis>("city-analysis") {
-        val preparePrompt by node<String, String> { input -> input }
-
-        val getStructured by nodeLLMRequestStructured<CityAnalysis>()
-
-        // Wire the nodes together: start -> prepare -> structured -> finish
-        nodeStart then preparePrompt then getStructured
-        edge(getStructured forwardTo nodeFinish transformed { it.getOrThrow().data })
-    }
-
     val agentConfig = AIAgentConfig(
         prompt = prompt("city-analyst") {
             system("You are a knowledgeable city analyst. When asked about a city, provide accurate structured data.")
@@ -461,9 +445,12 @@ suspend fun main() {
     )
 
     simpleOpenAIExecutor(apiKey).use { executor ->
+        // structuredOutputWithToolsStrategy<CityAnalysis>() is a built-in Koog strategy
+        // that lets the agent call tools in a loop and then finish with a structured
+        // output of the specified type once the process is complete.
         val agent = AIAgent(
             promptExecutor = executor,
-            strategy = structuredStrategy,
+            strategy = structuredOutputWithToolsStrategy<CityAnalysis>(),
             agentConfig = agentConfig,
         )
 
```

---

### Incident Patch 14: `8b7a8b09` (2026-02-22)
**Commit Message**: Fix dark mode sponsor logos: use SVGs for transparency, fix Mem0 srcset

Replace opaque PNGs (Redis, JetBrains, Bright Data, RunPod) with SVGs
that properly support transparency on dark backgrounds. URL-encode
spaces in Mem0 logo filename to fix srcset parsing.

Co-Authored-By: Claude Opus 4.6 <[REDACTED_EMAIL]>

**File**: `README.md` (modified, +5/-5)
```diff
@@ -55,7 +55,7 @@ Click a logo to open the tutorial. Use Ctrl‑/⌘‑click to keep this page ope
     <a href="tutorials/agent-memory-with-redis" title="Open Redis tutorial">
       <picture>
         <source media="(prefers-color-scheme: dark)"
-                srcset="assets/repos_images/sponsors_logos/trimmed_padded/trimmed_padded_Redis_white.png">
+                srcset="assets/repos_images/sponsors_logos/trimmed_padded/trimmed_padded_Redis_white.svg">
         <img src="assets/repos_images/sponsors_logos/trimmed_padded/trimmed_padded_Redis.png"
              height="44" style="max-width:180px;" alt="Redis - In-memory database and vector storage for AI agent memory, caching, and real-time data processing">
       </picture>
@@ -89,7 +89,7 @@ Click a logo to open the tutorial. Use Ctrl‑/⌘‑click to keep this page ope
     <a href="tutorials/agent-with-brightdata" title="Open Bright Data tutorial">
       <picture>
         <source media="(prefers-color-scheme: dark)"
-                srcset="assets/repos_images/sponsors_logos/trimmed_padded/trimmed_padded_brightdata_white.png">
+                srcset="assets/repos_images/sponsors_logos/trimmed_padded/trimmed_padded_brightdata_white.svg">
         <img src="assets/repos_images/sponsors_logos/trimmed_padded/trimmed_padded_brightdata.png"
              height="44" style="max-width:180px;" alt="Bright Data - Web scraping and data collection platform for AI training and agent data gathering">
       </picture>
@@ -149,7 +149,7 @@ Click a logo to open the tutorial. Use Ctrl‑/⌘‑click to keep this page ope
     <a href="tutorials/kotlin-agent-with-koog" title="Open JetBrains Koog tutorial">
       <picture>
         <source media="(prefers-color-scheme: dark)"
-                srcset="assets/repos_images/sponsors_logos/trimmed_padded/trimmed_padded_jetbrains_white.png">
+                srcset="assets/repos_images/sponsors_logos/trimmed_padded/trimmed_padded_jetbrains_white.svg">
         <img src="assets/repos_images/sponsors_logos/trimmed_padded/trimmed_padded_jetbrains.png"
              height="44" style="max-width:180px;" alt="JetBrains - Creator of Kotlin and the Koog AI agent framework for building intelligent applications on the JVM">
       </picture>
@@ -174,7 +174,7 @@ Click a logo to open the tutorial. Use Ctrl‑/⌘‑click to keep this page ope
     <a href="tutorials/agent-memory-with-mem0" title="Open Mem0 tutorial">
       <picture>
         <source media="(prefers-color-scheme: dark)"
-                srcset="assets/repos_images/sponsors_logos/trimmed_padded/Mem0 Word Logo.png">
+                srcset="assets/repos_images/sponsors_logos/trimmed_padded/Mem0%20Word%20Logo.png">
         <img src="assets/repos_images/sponsors_logos/trimmed_padded/Mem0 Word Logo Dark.png"
              height="44" style="max-width:180px;" alt="Mem0 - Self-improving memory system for AI agents with hybrid vector and graph storage">
       </picture>
@@ -191,7 +191,7 @@ Click a logo to open the tutorial. Use Ctrl‑/⌘‑click to keep this page ope
     <a href="tutorials/runpod-gpu-deploy" title="Open RunPod tutorial">
       <picture>
         <source media="(prefers-color-scheme: dark)"
-                srcset="assets/repos_images/sponsors_logos/trimmed_padded/trimmed_padded_runpod_white.png">
+                srcset="assets/repos_images/sponsors_logos/trimmed_padded/trimmed_padded_runpod_white.svg">
         <img src="assets/repos_images/sponsors_logos/trimmed_padded/trimmed_padded_runpod.svg"
              height="44" style="max-width:180px;" alt="RunPod - GPU cloud computing platform for training and deploying AI models and agents at scale">
       </picture>
```

**File**: `assets/repos_images/sponsors_logos/trimmed_padded/trimmed_padded_Redis_white.svg` (added, +10/-0)
```diff
@@ -0,0 +1,10 @@
+<svg width="85" height="27" viewBox="0 0 85 27" fill="none" xmlns="http://www.w3.org/2000/svg">
+<g clip-path="url(#clip0_1878_297)">
+<path fill-rule="evenodd" clip-rule="evenodd" d="M75.2909 13.8125C75.2909 10.8448 77.4892 9.12284 80.2371 9.12284C82.2888 9.12284 84.1207 10.1121 85 12.5668C84.7435 13.8125 83.2047 15.2047 82.5453 15.4246C81.9957 14.2522 81.3728 13.556 80.7866 13.556C80.0539 13.556 80.0172 14.069 80.0172 14.7284C80.0172 15.1955 80.151 15.8834 80.3119 16.7112C80.5549 17.9615 80.8599 19.5309 80.8599 21.1401C80.8599 24.0711 78.8082 26.2328 75.6573 26.2328C72.7721 26.2328 71.1778 24.3414 70.4665 21.3198C68.5818 24.6972 65.8257 26.2328 63.7134 26.2328C60.411 26.2328 59.6338 23.7919 59.7121 21.3161C58.3852 23.6612 55.831 26.2328 53.3815 26.2328C50.8809 26.2328 49.9976 24.0563 50.2002 21.5215C48.702 24.3122 45.9919 26.2328 43.3793 26.2328C40.5442 26.2328 39.141 23.9806 39.5951 21.189C37.6878 23.5333 34.1374 26.2328 30.4461 26.2328C26.2373 26.2328 24.4053 23.9632 24.1882 21.1193C22.1568 24.375 19.4187 26.3427 16.1573 26.3427C11.4493 26.3427 9.76537 22.1561 9.52032 18.7315C7.77547 21.0681 5.81377 23.4923 3.40733 26.1961C3.15086 26.4526 2.93103 26.5991 2.67457 26.5991C1.8319 26.5991 0.109914 22.8621 0 21.4698C0.723099 20.3478 5.28119 15.3398 8.95093 11.3079C10.2409 9.89066 11.4211 8.594 12.2863 7.6291C10.0389 8.30726 7.72169 9.65975 4.79957 11.7608C4.28664 12.1272 2.85776 8.7931 2.8944 6.22845C6.26509 3.73707 11.3944 2.16164 15.5345 2.16164C21.3233 2.16164 24.6573 5.38578 24.6573 9.8556C24.6573 13.5927 21.5431 17.6961 17 17.8427C14.6377 17.904 13.1237 16.578 12.3494 14.9405C12.4419 17.473 13.7587 20.5905 17.2931 20.5905C21.1462 20.5905 22.9965 18.2646 25.7559 14.7958C25.9352 14.5704 26.1183 14.3403 26.306 14.1056C28.6509 11.2112 31.3621 8.64655 35.319 8.64655C37.7371 8.64655 39.3858 10.1487 39.3858 12.4203C39.3858 15.1681 36.1616 18.9784 31.6552 18.9784C30.8855 18.9784 30.1839 18.877 29.5917 18.6766C29.5768 18.7921 29.5668 18.9058 29.5668 19.0151C29.5668 20.2974 30.0431 21.0668 32.1315 21.0668C35.2091 21.0668 38.1034 19.2349 41.6207 14.9483C45.0647 10.7349 47.6659 8.90302 50.4138 8.90302C52.2687 8.90302 53.6765 9.90832 54.2969 11.6014C57.9796 6.28253 61.1038 2.51388 63.75 0C66.3513 1.09914 68.2198 3.26078 67.7069 3.70043C65.7651 5.45905 59.2802 12.5302 56.7155 16.7435C56.056 17.8427 55.4332 19.0517 55.4332 19.6379C55.4332 20.1875 55.7629 20.3707 56.1293 20.3707C57.8898 20.3707 61.4176 16.2147 64.4645 12.6253C65.6026 11.2845 66.6736 10.0228 67.5603 9.08621C69.6121 9.92888 71.7004 11.7241 71.1875 12.347C68.4763 15.5711 66.4246 18.2091 66.4246 19.7112C66.4246 20.1142 66.5711 20.3707 67.1207 20.3707C68.1466 20.3707 69.0991 19.4547 70.6746 17.5129C71.0043 17.1099 71.4073 17.1099 71.6638 17.7328C72.3599 19.4181 73.3858 20.3341 74.1918 20.3341C75.1444 20.3341 75.6207 19.4914 75.6207 18.2091C75.6207 17.3327 75.5137 16.3138 75.4217 15.4365C75.3521 14.7733 75.2909 14.191 75.2909 13.8125ZM16.194 13.3362C18.1358 13.3362 20.2608 12.2737 20.2608 10.1121C20.2608 8.80024 19.4466 7.59084 17.2708 7.22257C17.156 7.40192 17.042 7.58017 16.9287 7.75739C15.8231 9.4858 14.7804 11.116 13.7281 12.7095C14.3586 13.0636 15.156 13.3362 16.194 13.3362ZM35.8319 13.9957C35.8319 13.4095 35.4655 13.0065 34.8793 13.0065C33.4094 13.0065 31.1923 15.0693 30.149 17.0613C30.5341 17.2101 30.9862 17.2931 31.472 17.2931C34.0733 17.2931 35.8319 15.3147 35.8319 13.9957ZM45.4677 19.3082C45.4677 19.9677 45.834 20.4073 46.6034 20.4073C48.9849 20.4073 51.9526 16.0841 51.9526 14.3254C51.9526 13.5927 51.5496 13.153 50.8901 13.153C48.7285 13.153 45.4677 17.2565 45.4677 19.3082ZM76.0599 6.08207C75.2172 7.47431 73.9349 9.04974 73.4586 9.52603C71.2603 8.61008 69.2086 6.77819 69.5017 6.26525C70.3077 4.83638 71.6267 3.29758 72.103 2.82129C74.3012 3.73724 76.353 5.60577 76.0599 6.08207Z" fill="#FFFFFF"/>
+</g>
+<defs>
+<clipPath id="clip0_1878_297">
+<rect width="85" height="26.5991" fill="white"/>
+</clipPath>
+</defs>
+</svg>
```

**File**: `assets/repos_images/sponsors_logos/trimmed_padded/trimmed_padded_brightdata_white.svg` (added, +19/-0)
```diff
@@ -0,0 +1,19 @@
+<?xml version="1.0" encoding="UTF-8"?>
+<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 179 40" width="564" height="128" fill="none">
+  <style>svg { color: white; }</style>
+  
+  <g transform="scale(0.317, 0.3125)">
+    <path d="M134.073 0C132.042 3.92378 139.136 9.62486 140.797 11.2772C141.946 9.39975 142.997 8.22548 143.95 7.75403C142.371 10.858 144.094 13.6804 144.52 16.4965C145.379 22.4167 142.082 27.7739 136.36 29.0444C132.211 29.8892 128.206 29.4699 125.342 26.0842C122.478 22.8425 122.052 19.0375 123.625 15.0887C124.628 12.6918 125.342 10.4386 123.913 7.76008L123.907 7.75403C125.768 8.4612 126.627 9.58761 127.486 11.1396C128.914 10.2948 129.629 9.02444 129.917 7.61643C130.205 6.20208 130.494 4.79368 130.92 3.38558C131.497 1.97131 132.355 0.844826 134.073 0Z" fill="currentColor"/>
+    <path fill-rule="evenodd" clip-rule="evenodd" d="M23.5122 44.1976C24.2904 43.4268 25.2695 42.5558 26.4369 41.879C27.5102 41.1082 28.7782 40.4311 30.046 39.8483C31.4143 39.2718 32.7763 38.783 34.3391 38.4007C35.9019 38.0122 37.559 37.8241 39.3165 37.8241C42.4359 37.8241 45.3671 38.3066 48.0973 39.372C50.8276 40.4373 53.269 42.0795 55.3151 44.2979C57.3612 46.6166 59.0247 49.5117 60.2925 53.184C61.4662 56.8563 62.1443 61.1994 62.1443 66.5136C62.1442 71.0507 61.4602 75.2057 60.0982 79.1663C58.7299 83.1269 56.6834 86.4107 54.0473 89.3059C51.4112 92.2011 48.1913 94.4257 44.4882 96.0675C40.6846 97.7094 36.4918 98.5806 31.7091 98.5806C28.3951 98.5806 25.3698 98.3866 22.5391 98.0983C19.8088 97.81 17.367 97.4211 15.3209 96.9385C13.2749 96.456 11.6117 96.0677 10.3439 95.5852C9.07618 95.1027 8.10334 94.8142 7.70785 94.5197V29.8468L0 28.5932V22.6023L23.5122 19.6129V44.1976ZM32.776 47.187C30.6295 47.187 28.7779 47.5755 27.2151 48.3463C25.6523 49.1171 24.3842 49.9881 23.5055 50.9531V89.1991C23.9951 89.9699 24.874 90.6467 26.236 91.0353C27.6042 91.5178 29.2612 91.7122 31.0186 91.7122C33.3597 91.7122 35.4062 91.1294 37.0695 89.876C38.8269 88.6227 40.1888 86.9807 41.3625 84.8563C42.5299 82.7319 43.3144 80.219 43.8982 77.4178C44.4819 74.6166 44.7768 71.527 44.7769 68.3372C44.7769 65.1474 44.5825 62.0578 44.093 59.3569C43.6034 56.7499 42.9254 54.525 41.8521 52.6951C40.8793 50.859 39.6115 49.5054 38.0487 48.5403C36.6804 47.6693 34.8287 47.187 32.7826 47.187H32.776Z" fill="currentColor"/>
+    <path d="M88.7515 52.0771H88.9458C89.3343 51.0014 90.1112 49.6361 91.1826 47.9753C92.254 46.3146 93.6136 44.6601 95.1737 43.0938C96.7338 41.5336 98.5823 40.1685 100.625 39.0927C102.667 38.017 104.905 37.432 107.342 37.432C108.413 37.432 109.19 37.4316 109.773 37.5323C110.356 37.6329 110.845 37.7275 111.233 37.8281V55.688C110.844 55.3924 109.873 55.1031 108.313 54.8075C106.753 54.5118 104.811 54.317 102.668 54.317C101.502 54.317 100.237 54.4172 99.0648 54.5116C97.8994 54.6122 96.7276 54.8074 95.6561 55.0968C94.5848 55.2918 93.7078 55.5877 92.837 55.877C91.9599 56.1726 91.377 56.4619 90.8883 56.7576V89.5464L103.639 90.817V97.5484H67.9178V90.622L75.0544 89.628V50.0076L67.3665 48.183V39.9481L88.8453 37.1613L88.7515 52.0771Z" fill="currentColor"/>
+    <path d="M143.93 89.5469L151.444 90.623V97.5484H120.111V90.623L127.72 89.6477V49.4839L120.705 47.7984V40.0927L143.93 37.1613V89.5469Z" fill="currentColor"/>
+    <path fill-rule="evenodd" clip-rule="evenodd" d="M219.333 48.9541H208.809C209.212 50.0556 209.514 51.2506 209.722 52.4516C209.924 53.6526 210.025 55.0527 210.025 56.4466C210.025 59.6452 209.319 62.5456 208.002 65.1406C206.686 67.7418 204.765 70.0382 202.341 72.0358C199.91 73.9337 196.981 75.4333 193.643 76.5348C190.205 77.6362 186.564 78.134 182.414 78.1341L182.42 78.1154C179.485 78.1154 176.758 77.9164 174.327 77.5181C173.723 78.1156 173.213 78.8189 172.81 79.6154C172.407 80.412 172.205 81.3143 172.205 82.4158C172.205 83.6168 172.406 84.6126 172.91 85.4153C173.414 86.1123 174.126 86.7161 175.134 87.1144C176.148 87.5126 177.357 87.8111 178.975 87.9168C180.594 88.0226 182.414 88.1159 184.536 88.1159H195.161C202.851 88.1159 208.513 89.4168 212.361 91.9123C216.102 94.5135 218.022 98.7077 218.023 104.508C218.023 108.005 217.109 111.303 215.189 114.203C213.368 117.103 210.837 119.499 207.6 121.603C204.463 123.6 200.722 125.199 196.572 126.301C192.421 127.402 188.076 128 183.522 128H183.421C178.364 128 174.113 127.602 170.574 126.7C167.034 125.797 164.099 124.602 161.775 123.102C159.451 121.603 157.833 119.704 156.718 117.607C155.603 115.51 155.1 113.108 155.1 110.612C155.1 109.013 155.402 107.513 156.013 106.014C156.618 104.613 157.43 103.313 158.437 102.118C159.451 100.917 160.56 99.9215 161.977 99.0191C163.293 98.1168 164.71 97.4197 166.127 96.9219C164.106 95.8204 162.487 94.5257 161.372 92.9264C160.258 91.3271 159.754 89.4291 159.754 87.2324C159.754 84.5316 160.459 82.335 161.876 80.437C163.293 78.6385 165.113 76.9395 167.337 75.5393C163.696 73.94 161.064 71.6436 159.345 68.6441C157.625 65.6446 156.712 62.1469 156.712 58.1517C156.712 54.9532 157.417 52.1529 158.834 49.558C160.251 46.9567 162.273 44.7597 164.704 42.9612C167.236 
```

**File**: `assets/repos_images/sponsors_logos/trimmed_padded/trimmed_padded_jetbrains_white.svg` (added, +13/-0)
```diff
@@ -0,0 +1,13 @@
+<svg xmlns="http://www.w3.org/2000/svg" width="298" height="64" fill="none" viewBox="0 0 298 64">
+  <defs>
+    <linearGradient id="a" x1=".850001" x2="62.62" y1="62.72" y2="1.81" gradientUnits="userSpaceOnUse">
+      <stop stop-color="#FF9419"/>
+      <stop offset=".43" stop-color="#FF021D"/>
+      <stop offset=".99" stop-color="#E600FF"/>
+    </linearGradient>
+  </defs>
+  <path fill="#fff" d="M86.4844 40.5858c0 .8464-.1792 1.5933-.5377 2.2505-.3585.6573-.8564 1.1651-1.5137 1.5236-.6572.3585-1.3941.5378-2.2406.5378H78v6.1044h5.0787c1.912 0 3.6248-.4282 5.1484-1.2846 1.5236-.8564 2.7186-2.0415 3.585-3.5452.8663-1.5037 1.3045-3.1966 1.3045-5.0886V21.0178h-6.6322v19.568Zm17.8556-1.8224h13.891v-5.6065H104.34v-6.3633h15.355v-5.7758H97.8766v29.9743h22.2464v-5.7757H104.34v-6.453Zm17.865-11.8005h8.882v24.0193h6.633V26.9629h8.842v-5.9451h-24.367v5.9551l.01-.01Zm47.022 9.0022c-.517-.2788-1.085-.4879-1.673-.6472.449-.1295.877-.2888 1.275-.488 1.096-.5676 1.962-1.3643 2.579-2.39.618-1.0257.936-2.2007.936-3.5351 0-1.5237-.418-2.8879-1.244-4.0929-.827-1.195-1.992-2.131-3.486-2.8082-1.494-.6672-3.206-1.0058-5.118-1.0058h-13.315v29.9743h13.574c2.011 0 3.804-.3485 5.387-1.0556 1.573-.707 2.798-1.6829 3.675-2.9476.866-1.2547 1.304-2.6887 1.304-4.302 0-1.4837-.338-2.8082-1.026-3.9833-.687-1.175-1.633-2.0812-2.858-2.7285l-.01.0099Zm-13.603-9.9184h5.886c.816 0 1.533.1494 2.161.4382.627.2888 1.115.707 1.464 1.2547.348.5378.527 1.1751.527 1.9021 0 .7269-.179 1.414-.527 1.9817-.349.5676-.837.9958-1.464 1.3045-.628.3087-1.345.4581-2.161.4581h-5.886v-7.3492.0099Zm10.138 18.134c-.378.5676-.916 1.0058-1.603 1.3145-.697.3087-1.484.4581-2.39.4581h-6.145v-7.6878h6.145c.886 0 1.673.1693 2.37.4979.687.3286 1.235.7867 1.613 1.3842.378.5975.578 1.2747.578 2.0414 0 .7668-.19 1.4241-.568 1.9917Zm29.596-5.3077c1.663-.7967 2.947-1.922 3.864-3.3659.916-1.444 1.374-3.117 1.374-5.0289 0-1.912-.448-3.5253-1.344-4.9592-.897-1.434-2.171-2.5394-3.814-3.3261-1.644-.7867-3.546-1.1751-5.717-1.1751h-13.124v29.9743h6.642V40.0779h4.322l6.084 10.9142h7.578l-6.851-11.7208c.339-.1195.677-.249.996-.3983h-.01Zm-2.151-6.1244c-.369.6274-.896 1.1154-1.583 1.444-.688.3386-1.494.5079-2.42.5079h-5.975v-8.2953h5.975c.926 0 1.732.1693 2.42.4979.687.3287 1.214.8166 1.583 1.434.368.6174.558 1.3544.558 2.1908 0 .8365-.19 1.5734-.558 2.2008v.0199Zm20.594-11.7308-10.706 29.9743h6.742l2.121-6.6122h11.114l2.27 6.6122h6.612L220.99 21.0178h-7.189Zm-.339 18.3431 3.445-10.5756.409-1.922.408 1.922 3.685 10.5756h-7.947Zm20.693 11.6312h6.851V21.0178h-6.851v29.9743Zm31.02-9.6993-12.896-20.275h-6.463v29.9743h6.055V30.7172l12.826 20.2749h6.533V21.0178h-6.055v20.275Zm31.528-3.3559c-.647-1.2448-1.564-2.2904-2.729-3.1369-1.165-.8464-2.509-1.4041-4.023-1.6929l-5.098-1.0456c-.797-.1892-1.434-.5178-1.902-.9958-.469-.478-.708-1.0755-.708-1.7825 0-.6473.17-1.205.518-1.683.339-.478.827-.8464 1.444-1.1153.618-.2689 1.335-.3983 2.151-.3983.817 0 1.554.1394 2.181.4182.627.2788 1.115.6672 1.464 1.1751s.528 1.0755.528 1.7228h6.642c-.04-1.7427-.528-3.2863-1.444-4.6207-.916-1.3443-2.201-2.3899-3.834-3.1468-1.633-.7568-3.505-1.1352-5.597-1.1352-2.091 0-3.943.3884-5.566 1.1751-1.623.7867-2.898 1.8721-3.804 3.2663-.906 1.3941-1.364 2.9775-1.364 4.76 0 1.444.288 2.7485.876 3.9036.587 1.1652 1.414 2.1311 2.479 2.8979 1.076.7668 2.311 1.3045 3.725 1.6033l5.397 1.1153c.886.2091 1.584.5975 2.101 1.1551.518.5577.767 1.2448.767 2.0813 0 .6672-.189 1.2747-.567 1.8025-.379.5277-.907.936-1.584 1.2248-.677.2888-1.474.4282-2.39.4282-.916 0-1.782-.1593-2.529-.478-.747-.3186-1.325-.7767-1.733-1.3742-.418-.5875-.617-1.2747-.617-2.0414h-6.642c.029 1.8721.527 3.5152 1.513 4.9492.976 1.424 2.32 2.5394 4.033 3.336 1.713.7967 3.675 1.195 5.886 1.195 2.21 0 4.202-.4083 5.915-1.2249 1.723-.8165 3.057-1.9418 4.023-3.3758.966-1.434 1.444-3.0572 1.444-4.8696 0-1.4838-.329-2.848-.976-4.1028l.02.01Z"/>
+  <path fill="url(#a)" d="M20.34 3.66 3.66 20.34C1.32 22.68 0 25.86 0 29.18V59c0 2.76 2.24 5 5 5h29.82c3.32 0 6.49-1.32 8.84-3.66l16.68-16.68c2.34-2.34 3.66-5.52 3.66-8.84V5c0-2.76-2.24-5-5-5H29.18c-3.32 0-6.49 1.32-8.84 3.66Z"/>
+  <path fill="#fff" d="M48 16H8v40h40V16Z"/>
+  <path fill="#fff" d="M30 47H13v4h17v-4Z"/>
+</svg>
```

**File**: `assets/repos_images/sponsors_logos/trimmed_padded/trimmed_padded_runpod_white.svg` (added, +8/-0)
```diff
@@ -0,0 +1,8 @@
+<svg width="870" height="180" viewBox="0 0 870 180" fill="none" xmlns="http://www.w3.org/2000/svg">
+<path d="M83.8652 30.0102C86.6535 30.0102 88.9139 32.245 88.9139 35.0016V49.381C88.9139 52.1253 86.6731 54.3548 83.8974 54.3723L50.2764 54.584C36.7409 54.584 33.7877 56.7737 33.7877 73.3185V146.671C33.7877 149.428 31.5273 151.663 28.739 151.663H9.3046C6.51626 151.663 4.25586 149.428 4.25586 146.671V62.3698C4.25586 40.4723 14.0998 30.0102 36.987 30.0102H83.8652Z" fill="#FFFFFF"/>
+<path d="M200.962 125.386C191.61 145.093 176.352 153.609 159.125 153.609C122.949 153.609 111.136 125.386 111.136 88.89V35.0017C111.136 32.245 113.396 30.0102 116.185 30.0102H135.619C138.407 30.0102 140.668 32.245 140.668 35.0016V88.89C140.668 113.464 151.496 124.169 170.2 124.169C182.012 124.169 204.161 115.653 204.161 75.5082V35.0016C204.161 32.245 206.422 30.0102 209.21 30.0102H228.645C231.433 30.0102 233.693 32.245 233.693 35.0016V146.671C233.693 149.428 231.433 151.663 228.645 151.663H209.21C206.422 151.663 204.161 149.428 204.161 146.671V126.116C204.161 121.105 204.871 114.691 205.827 109.855C205.856 109.708 205.742 109.571 205.59 109.571C205.475 109.571 205.376 109.65 205.353 109.762C204.369 114.601 202.905 120.823 200.962 125.386Z" fill="#FFFFFF"/>
+<path d="M288.725 57.747C298.569 37.0661 317.765 28.0638 334.254 28.0638C366.739 28.0638 379.044 56.2871 379.044 92.7828V146.671C379.044 149.428 376.783 151.663 373.995 151.663H354.314C351.526 151.663 349.266 149.428 349.266 146.671V92.7828C349.266 70.6421 339.914 57.5037 323.425 57.5037C310.628 57.5037 285.28 66.0193 285.28 106.165V146.671C285.28 149.428 283.019 151.663 280.231 151.663H260.797C258.008 151.663 255.748 149.428 255.748 146.671V35.0016C255.748 32.245 258.008 30.0102 260.797 30.0102H280.231C283.019 30.0102 285.28 32.245 285.28 35.0016V57.017C285.28 61.789 284.57 68.1987 283.614 73.034C283.585 73.1818 283.699 73.3185 283.852 73.3185C283.967 73.3185 284.065 73.2391 284.088 73.1276C285.072 68.294 286.539 62.3095 288.725 57.747Z" fill="#FFFFFF"/>
+<path d="M436.519 47.2849C447.594 35.6062 467.282 28.5504 483.524 28.5504C522.162 28.7937 544.557 48.7447 544.557 90.8364C544.557 132.928 522.162 153.122 483.524 153.122C467.282 153.122 447.594 146.067 436.519 134.388C432.622 130.535 429.931 123.585 428.206 118.489C428.173 118.393 428.083 118.33 427.98 118.33C427.821 118.33 427.706 118.482 427.752 118.633C429.435 124.17 430.859 130.839 430.859 136.334V170.321C430.859 173.078 428.599 175.312 425.81 175.312H406.368C403.583 175.312 401.324 173.083 401.319 170.329L401.089 35.0095C401.085 32.2497 403.346 30.0102 406.138 30.0102H425.81C428.599 30.0102 430.859 32.245 430.859 35.0016V45.3384C430.859 50.8248 429.44 57.9481 427.761 63.0401C427.711 63.1899 427.824 63.343 427.984 63.343C428.084 63.343 428.173 63.2807 428.205 63.1864C429.93 58.0904 432.622 51.1381 436.519 47.2849ZM474.911 130.252C504.196 130.252 515.025 115.41 515.025 90.8364C515.025 65.776 503.95 53.3675 474.911 52.6376C452.27 52.6376 430.859 67.4791 430.859 90.8364C430.859 114.194 452.27 130.252 474.911 130.252Z" fill="#FFFFFF"/>
+<path d="M704.79 90.8364C704.79 132.928 671.567 153.122 632.929 153.122C594.538 153.122 561.315 132.928 561.315 90.8364C561.315 48.7447 594.538 28.5504 632.929 28.5504C671.567 28.5504 704.79 48.988 704.79 90.8364ZM675.258 90.8364C675.258 66.2626 655.324 52.3943 632.929 52.3943C611.273 52.3943 590.846 66.2626 590.846 90.8364C590.846 116.14 609.796 129.035 632.929 129.035C655.57 129.035 675.258 115.653 675.258 90.8364Z" fill="#FFFFFF"/>
+<path d="M830.553 134.875C819.232 146.067 799.544 153.122 783.302 153.122C744.664 153.122 722.269 132.928 722.269 90.8364C722.269 48.7447 744.664 28.7937 783.302 28.5504C799.544 28.5504 819.478 36.0929 830.553 47.7715C834.449 51.624 836.9 58.5743 838.62 63.6701C838.653 63.7661 838.743 63.8296 838.845 63.8296C839.005 63.8296 839.119 63.6778 839.074 63.5267C837.391 57.9891 835.967 51.3205 835.967 45.825V9.67891C835.967 6.92223 838.227 4.6875 841.016 4.6875H860.696C863.484 4.6875 865.745 6.92223 865.745 9.67891V146.671C865.745 149.428 863.484 151.663 860.696 151.663H841.016C838.227 151.663 835.967 149.428 835.967 146.671V136.821C835.967 131.305 837.402 124.371 839.092 119.28C839.135 119.153 839.076 119.015 838.955 118.955C838.807 118.882 838.628 118.954 838.575 119.11C836.857 124.193 834.416 131.056 830.553 134.875ZM791.915 129.035C814.556 129.035 835.967 114.194 835.967 90.8364C835.967 67.4791 814.556 51.421 791.915 51.421C762.629 52.151 751.555 66.0193 751.555 90.8364C751.555 115.653 762.875 129.035 791.915 129.035Z" fill="#FFFFFF"/>
+</svg>
```

---

### Incident Patch 15: `f4e042fc` (2026-02-22)
**Commit Message**: Fix issues in Kotlin Koog tutorial: remove stale diagram node, improve run.sh robustness, sync build file

- Remove orphaned "Next Steps" node from Mermaid diagram (section was deleted)
- Add cd to script directory in run.sh so it works from any working directory
- Add friendly error message on Gradle step failure in run.sh
- Remove unused application plugin from build.gradle.kts
- Sync build.gradle.kts code block comment in tutorial.md with actual file
- Fix README metadata lines rendering as single paragraph
- Add out/ and local.properties to .gitignore

Co-Authored-By: Claude Opus 4.6 <[REDACTED_EMAIL]>

**File**: `tutorials/kotlin-agent-with-koog/.gitignore` (modified, +2/-0)
```diff
@@ -6,6 +6,8 @@ build/
 .idea/
 *.iml
 .vscode/
+out/
+local.properties
 
 # OS
 .DS_Store
```

**File**: `tutorials/kotlin-agent-with-koog/README.md` (modified, +1/-0)
```diff
@@ -46,4 +46,5 @@ The Gradle wrapper is included -- no need to install Gradle separately. The firs
 A smart assistant that answers questions using custom tools (weather lookup, calculations, fact retrieval) and returns typed, structured responses as Kotlin data classes.
 
 **Total Tutorial Time**: ~25-30 minutes
+
 **Difficulty**: Beginner-Intermediate (Kotlin basics, Gradle)
```

**File**: `tutorials/kotlin-agent-with-koog/build.gradle.kts` (modified, +0/-1)
```diff
@@ -1,7 +1,6 @@
 plugins {
     kotlin("jvm") version "2.1.0"
     kotlin("plugin.serialization") version "2.1.0"
-    application
 }
 
 repositories {
```

**File**: `tutorials/kotlin-agent-with-koog/run.sh` (modified, +10/-1)
```diff
@@ -5,6 +5,9 @@
 # -------------------------------------------------------
 set -euo pipefail
 
+# Ensure we run from the tutorial directory, even if invoked from elsewhere.
+cd "$(dirname "$0")"
+
 RED='\033[0;31m'
 GREEN='\033[0;32m'
 YELLOW='\033[1;33m'
@@ -86,7 +89,13 @@ run_step() {
     fi
 
     echo ""
-    ./gradlew "$step" --quiet 2>&1
+    if ! ./gradlew "$step" --quiet 2>&1; then
+        echo ""
+        echo -e "${RED}Step failed. Check the error above for details.${NC}"
+        echo -e "Common fixes: verify your OPENAI_API_KEY is valid, and that JDK 17+ is installed."
+        echo ""
+        return 1
+    fi
     echo ""
     echo -e "${GREEN}Done.${NC}"
 }
```

**File**: `tutorials/kotlin-agent-with-koog/tutorial.md` (modified, +5/-3)
```diff
@@ -11,7 +11,6 @@ graph TD
     A[Project Setup] --> B[Step 1: Basic Agent]
     B --> C[Step 2: Agent with Tools]
     C --> D[Step 3: Structured Output]
-    D --> E[Next Steps]
 
     B -- "LLM call" --> B1[Send prompt to model]
     B1 --> B2[Receive text response]
@@ -82,7 +81,6 @@ Below is a walkthrough of the `build.gradle.kts` so you understand what each dep
 plugins {
     kotlin("jvm") version "2.1.0"
     kotlin("plugin.serialization") version "2.1.0"
-    application
 }
 
 repositories {
@@ -103,7 +101,11 @@ dependencies {
     implementation("org.slf4j:slf4j-nop:2.0.16")
 }
 
-// Custom tasks for running each tutorial step individually
+// Allow running each step file individually:
+//   ./gradlew step1  ->  runs Step1_HelloAgent.kt
+//   ./gradlew step2  ->  runs Step2_AgentWithTools.kt
+//   ./gradlew step3  ->  runs Step3_StructuredOutput.kt
+
 tasks.register<JavaExec>("step1") {
     group = "tutorial"
     description = "Run Step 1: Hello Agent"
```

#### Recent Merged Pull Requests:
- **PR #90** (closed): Add NEXUS-AI marketplace (@klikmarkettt-dotcom)
- **PR #89** (closed): Add NEXUS-AI marketplace (@klikmarkettt-dotcom)
- **PR #84** (2026-08-31): README: feature the new while-loop agents film in the video rail (@NirDiamant)
- **PR #83** (2026-08-28): Bump python-dotenv from 1.1.0 to 1.2.2 in /tutorials/agent-security-with-llamafirewall (@dependabot[bot])
- **PR #81** (2026-08-28): test: fix FastAPI streaming response assertions (@Whxuan0701)
- **PR #80** (2026-08-28): fix: declare pandas for the agent security tutorial (@Whxuan0701)
- **PR #79** (2026-08-28): fix: declare PyPDF2 for the Streamlit tutorial (@Whxuan0701)
- **PR #77** (2026-07-31): Tracked video section + tutorial-index landing page (@NirDiamant)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

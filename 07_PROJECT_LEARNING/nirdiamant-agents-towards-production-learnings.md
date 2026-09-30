# Forensic Learning Record (Deep Inspection): NirDiamant/agents-towards-production

> **Canonical Artifact**: `07_PROJECT_LEARNING/nirdiamant-agents-towards-production-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/NirDiamant/agents-towards-production](https://github.com/NirDiamant/agents-towards-production))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:40:53.749Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `NirDiamant/agents-towards-production`
- **Description**: End-to-end, code-first tutorials for building production-grade GenAI agents. From prototype to enterprise deployment.
- **Primary Language / Ecosystem**: Jupyter Notebook
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 21517 stars

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

### Incident Patch 1: `68cc467c` (2026-08-28)
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

Signed-off-by: dependabot[bot] <support@github.com>
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

### Incident Patch 2: `80eb9d8f` (2026-08-28)
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
+            "
```

---

### Incident Patch 3: `7c16432f` (2026-08-28)
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

### Incident Patch 4: `f70fd58a` (2026-08-28)
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

### Incident Patch 5: `3fd9c149` (2026-08-28)
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

### Incident Patch 6: `e88a8122` (2026-06-03)
**Commit Message**: Auto-apply RAGKING via ?code=, frame as GitHub-community offer, fix rating

- RAG book links now use /rag-made-simple?code=RAGKING so the 33% launch
  discount auto-applies at checkout for the GitHub community.
- Reword the coupon copy as a GitHub-community offer.
- Correct the book rating to 4.6 stars.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>

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

### Incident Patch 7: `660776aa` (2026-05-31)
**Commit Message**: Fix README centering: close banner div so body reads left-aligned

The earlier 'demote jobs section' change left the opening <div align=center>
by the banner while moving its closing </div> to the bottom jobs panel, so
the entire README body rendered centered. Close the div right after the
banner (keeps the hero centered) and drop the stray </div> at the bottom,
restoring left-aligned body text and the left-aligned jobs panel.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>

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

### Incident Patch 8: `575af12b` (2026-05-30)
**Commit Message**: docs(readme): cross-link Agent Memory Techniques repo

Add a link to the Agent Memory Techniques notebooks so readers of this repo
discover the agent-memory tutorials.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>

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

### Incident Patch 9: `724f1f7b` (2026-05-23)
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

### Incident Patch 10: `ae289378` (2026-04-15)
**Commit Message**: Revert RAG book promotion back to $0.99 launch pricing (#57)

The book was briefly raised to $9.99 to prep for a Kindle Countdown Deal, but KDP's 30-day list price stability rule blocked the countdown. Price restored to $0.99 for the remainder of the launch window.

PE Book countdown banner (where present) remains since PE is still on its Kindle Countdown Deal at $2.99 through April 21.

Co-authored-by: NirDiamant <NirDiamant@users.noreply.github.com>

**File**: `README.md` (modified, +1/-1)
```diff
@@ -26,7 +26,7 @@
 <a href="https://europe-west1-rag-techniques-views-tracker.cloudfunctions.net/rag-techniques-tracker?notebook=agents-towards-production--readme&click=book-buy-amazon-image&target=https%3A%2F%2Fwww.amazon.com%2Fdp%2FB0D76734SZ%3Ftag%3Ddiamantai-atp-20&text=Best%20Seller%20Image"><img src="images/rag_book_best_seller.png" alt="#1 Best Seller in Generative AI on Amazon - Click to buy" width="500"></a>
 
 **[RAG Made Simple](https://europe-west1-rag-techniques-views-tracker.cloudfunctions.net/rag-techniques-tracker?notebook=agents-towards-production--readme&click=book-buy-amazon-title&target=https%3A%2F%2Fwww.amazon.com%2Fdp%2FB0D76734SZ%3Ftag%3Ddiamantai-atp-20&text=RAG%20Made%20Simple)** — **#1 Best Seller on Amazon in Generative AI.**
-22 RAG techniques with intuition, comparisons, and illustrations. **Free with Kindle Unlimited** or **$9.99** on Amazon.
+22 RAG techniques with intuition, comparisons, and illustrations. **Free with Kindle Unlimited** or **$0.99** launch price (goes up soon).
 
 ### 👉 [**Get the book on Amazon**](https://europe-west1-rag-techniques-views-tracker.cloudfunctions.net/rag-techniques-tracker?notebook=agents-towards-production--readme&click=book-buy-amazon-cta&target=https%3A%2F%2Fwww.amazon.com%2Fdp%2FB0D76734SZ%3Ftag%3Ddiamantai-atp-20&text=Get%20the%20book%20on%20Amazon)
 
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

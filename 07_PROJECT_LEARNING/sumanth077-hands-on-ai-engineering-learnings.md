# Forensic Learning Record (Deep Inspection): Sumanth077/Hands-On-AI-Engineering

> **Canonical Artifact**: `07_PROJECT_LEARNING/sumanth077-hands-on-ai-engineering-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Sumanth077/Hands-On-AI-Engineering](https://github.com/Sumanth077/Hands-On-AI-Engineering))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T21:03:05.807Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Sumanth077/Hands-On-AI-Engineering`
- **Description**: A curated collection of practical AI projects implementing OCR systems, RAG, AI agents, and other AI use cases.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 3805 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `OCR/image_to_structured_data/app.py`
```
<<<<<<< HEAD
=======
"""
Image-to-Structured-Data Extractor Streamlit app: upload an image and extract
validated, structured JSON from it using Mistral Large 3 and Instructor.
"""

>>>>>>> 1d1e9f137cfd1123edbae5d8e955ce0b9c7fcf4a
import streamlit as st
from processor import extract_structured_data
from schemas import ProductCollection, InvoiceCollection 
import os
from dotenv import load_dotenv

load_dotenv()

st.set_page_config(page_title="Mistral Vision Extractor", layout="wide")

st.title("📸 Image-to-Structured-Data")
st.write("Using **Mistral Large 3** for high-fidelity visual OCR and structured extraction.")

<<<<<<< HEAD
with st.sidebar:
    # Use the MISTRAL_API_KEY from .env if available
    api_key = st.text_input("Mistral API Key", value=os.getenv("MISTRAL_API_KEY", ""), type="password")
    schema_choice = st.selectbox("Select Extraction Schema", ["Product", "Invoice"])
    
=======
api_key = os.getenv("MISTRAL_API_KEY", "")

with st.sidebar:
    if not api_key:
        st.warning("MISTRAL_API_KEY is not set in your .env file.")
    schema_choice = st.selectbox("Select Extraction Schema", ["Product", "Invoice"])

>>>>>>> 1d1e9f137cfd1123edbae5d8e955ce0b9c7fcf4a
    # These names now match the updated import above
    schema_map = {
        "Product": ProductCollection,
        "Invoice": InvoiceCollection
    }

uploaded_file = st.file_uploader("Upload an image...", type=["jpg", "jpeg", "png"])

if uploaded_file and api_key:
    col1, col2 = st.columns(2)
    with col1:
        st.image(uploaded_file, caption="Source Image")
    
    with col2:
        if st.button("Extract Data"):
            with st.spinner("Mistral is analyzing the image..."):
                try:
                    uploaded_file.seek(0)
                    result = extract_structured_data(uploaded_file, schema_map[schema_choice], api_key)
                    st.success("Extracted Successfully!")
                    st.json(result.model_dump())
                except Exception as e:
                    st.error(f"Error: {e}")
```

### Core Architecture Module: `OCR/image_to_structured_data/processor.py`
```
import base64
import instructor
<<<<<<< HEAD
from mistralai import Mistral
=======
from mistralai.client import Mistral
>>>>>>> 1d1e9f137cfd1123edbae5d8e955ce0b9c7fcf4a
from PIL import Image
import io

def process_and_encode_image(image_file, max_size=(2048, 2048)):
    """Resizes image to fit API limits and converts to base64."""
    img = Image.open(image_file)
    if img.mode in ("RGBA", "P"):
        img = img.convert("RGB")
    
    img.thumbnail(max_size, Image.Resampling.LANCZOS)
    
    buffered = io.BytesIO()
    img.save(buffered, format="JPEG", quality=90)
    return base64.b64encode(buffered.getvalue()).decode('utf-8')

def extract_structured_data(image_file, schema_model, api_key: str):
<<<<<<< HEAD
=======
    """Send the image to Mistral Large 3 and return data validated against the given schema."""
>>>>>>> 1d1e9f137cfd1123edbae5d8e955ce0b9c7fcf4a
    client = instructor.from_mistral(Mistral(api_key=api_key))
    base64_image = process_and_encode_image(image_file)

    return client.chat.completions.create(
        model="mistral-large-latest",
        response_model=schema_model,
        max_retries=1,  # Set retries to 1 to avoid hitting rate limits on errors
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": "Extract all items found in this image into the requested structure."},
                    {"type": "image_url", "image_url": f"data:image/jpeg;base64,{base64_image}"}
                ],
            }
        ],
    )
```

### Core Architecture Module: `OCR/image_to_structured_data/schemas.py`
```
from pydantic import BaseModel, Field
from typing import List, Optional

class ProductAttribute(BaseModel):
<<<<<<< HEAD
=======
    """A single key-value attribute describing a product."""
>>>>>>> 1d1e9f137cfd1123edbae5d8e955ce0b9c7fcf4a
    key: str
    value: str

class StructuredProduct(BaseModel):
<<<<<<< HEAD
=======
    """A single product extracted from an image, with pricing and attributes."""
>>>>>>> 1d1e9f137cfd1123edbae5d8e955ce0b9c7fcf4a
    name: str
    brand: Optional[str]
    price: Optional[float]
    currency: Optional[str]
    attributes: List[ProductAttribute]
    summary: str

# These are the ones the error is looking for:
class ProductCollection(BaseModel):
    """A collection of all products found in the image."""
    products: List[StructuredProduct]

class InvoiceData(BaseModel):
<<<<<<< HEAD
=======
    """A single invoice extracted from an image, with vendor, total, and line items."""
>>>>>>> 1d1e9f137cfd1123edbae5d8e955ce0b9c7fcf4a
    vendor_name: str
    date: str
    total_amount: float
    items: List[str]

class InvoiceCollection(BaseModel):
    """A collection of invoices or line items found."""
    invoices: List[InvoiceData]
```

### Core Architecture Module: `OCR/latex_formula_ocr/app.py`
```
"""
LaTeX Formula OCR
==================
Streamlit app that extracts mathematical formulas from images using GLM-OCR
via Ollama and renders them visually with KaTeX.

SETUP INSTRUCTIONS:
  1. Install Ollama: https://ollama.ai/download
  2. Pull the OCR model:
         ollama pull glm-ocr
  3. Ensure Ollama is running (it auto-starts on most systems after install,
     or start it manually):
         ollama serve
  4. Install Python dependencies:
         pip install -r requirements.txt
  5. Launch the app:
         streamlit run app.py

NOTES:
  - Ollama must be reachable at http://localhost:11434
  - PDF support requires PyMuPDF (included in requirements.txt)
  - KaTeX is loaded from jsDelivr CDN for in-browser formula rendering
  - No API keys or external OCR services are needed — fully local
"""

import streamlit as st
import requests
import base64
import re
import json
from html import escape as html_escape
from io import BytesIO

from PIL import Image

# ── Optional PDF support via PyMuPDF ─────────────────────────────────────────
try:
    import fitz  # PyMuPDF
    PDF_SUPPORT = True
except ImportError:
    PDF_SUPPORT = False

# ── Constants ─────────────────────────────────────────────────────────────────
OLLAMA_GENERATE_URL = "http://localhost:11434/api/generate"
OLLAMA_TAGS_URL     = "http://localhost:11434/api/tags"
MODEL_NAME          = "glm-ocr"
MAX_IMG_DIM         = 1920          # px — downscale larger images before sending
KATEX_CDN           = "https://cdn.jsdelivr.net/npm/katex@0.16.11/dist"

# ── Prompt sent to GLM-OCR ────────────────────────────────────────────────────
EXTRACTION_PROMPT = """\
You are a mathematical formula OCR engine.
Carefully examine the image and extract EVERY mathematical expression or equation visible.
Output ONLY the LaTeX source for each formula, each one wrapped in $$ ... $$ delimiters.
Place each formula on its own line.
Do not include any explanation, prose, or extra text — only the $$ ... $$ blocks.\
"""


# ╔══════════════════════════════════════════════════════════════════════════════
# ║  Image helpers
# ╚══════════════════════════════════════════════════════════════════════════════

def resize_if_needed(image_bytes: bytes) -> bytes:
    """Downscale an image so its longest side is at most MAX_IMG_DIM pixels."""
    img = Image.open(BytesIO(image_bytes)).convert("RGB")
    w, h = img.size
    if max(w, h) > MAX_IMG_DIM:
        ratio = MAX_IMG_DIM / max(w, h)
        img   = img.resize((int(w * ratio), int(h * ratio)), Image.LANCZOS)
        buf   = BytesIO()
        img.save(buf, format="PNG")
        return buf.getvalue()
    return image_bytes


def to_base64(image_bytes: bytes) -> str:
    return base64.b64encode(image_bytes).decode("utf-8")


def pdf_first_page_to_png(pdf_bytes: bytes) -> bytes:
    """Render the first page of a PDF to a high-resolution PNG byte string."""
    doc  = fitz.open(stream=pdf_bytes, filetype="pdf")
    page = doc[0]
    pix  = page.get_pixmap(matrix=fitz.Matrix(2.0, 2.0), colorspace=fitz.csRGB)
    return pix.tobytes("png")


# ╔══════════════════════════════════════════════════════════════════════════════
# ║  Ollama query
# ╚══════════════════════════════════════════════════════════════════════════════

def query_glm_ocr(image_b64: str) -> str:
    """
    POST the image (base64-encoded) to Ollama's native /api/generate endpoint
    using the glm-ocr model.  Returns the raw response string.
    """
    payload = {
        "model":  MODEL_NAME,
        "prompt": EXTRACTION_PROMPT,
        "images": [image_b64],
        "stream": False,
    }
    resp = requests.post(OLLAMA_GENERATE_URL, json=payload, timeout=300)
    resp.raise_for_status()
    return resp.json().get("response", "")


def check_ollama_status() -> tuple[bool, bool]:
    """
    Returns (ollama_reachable, glm_ocr_installed).
    Quick, non-blocking probe used in the sidebar.
    """
    try:
        r = requests.get(OLLAMA_TAGS_URL, timeout=3)
        if not r.ok:
            return False, False
        models = [m.get("name", "") for m in r.json().get("models", [])]
        has_model = any("glm-ocr" in m for m in models)
        return True, has_model
    except Exception:
        return False, False


# ╔══════════════════════════════════════════════════════════════════════════════
# ║  LaTeX extraction
# ╚══════════════════════════════════════════════════════════════════════════════

def extract_formulas(text: str) -> list:
    """
    Pull LaTeX formulas out of the model's response.
    Tries delimiter styles in order of preference; falls back to raw lines.
    Returns a list of formula strings (without surrounding delimiters).
    """
    formulas = []

    # 1. $$...$$  — primary format we asked for
    formulas = [m.strip() for m in re.findall(r'\$\$(.*?)\$\$', text, re.DOTALL) if m.strip()]
    if formulas:
        return formulas

    # 2. \[...\]  — display math, alternative LaTeX style
    formulas = [m.strip() for m in re.findall(r'\\\[(.*?)\\\]', text, re.DOTALL) if m.strip()]
    if formulas:
        return formulas

    # 3. Named environments: equation, align, gather, multline, eqnarray
    env_pattern = (
        r'(\\begin\{(?:equation|align|gather|multline|eqnarray)\*?\}'
        r'.*?'
        r'\\end\{(?:equation|align|gather|multline|eqnarray)\*?\})'
    )
    formulas = [m.strip() for m in re.findall(env_pattern, text, re.DOTALL) if m.strip()]
    if formulas:
        return formulas

    # 4. $...$  — inline math (avoid matching $$)
    formulas = [
        m.strip()
        for m in re.findall(r'(?<!\$)\$(?!\$)(.*?)(?<!\$)\$(?!\$)', text, re.DOTALL)
        if m.strip()
    ]
    if formulas:
        return formulas

    # 5. \(...\)  — inline math, alternative style
    formulas = [m.strip() for m in re.findall(r'\\\((.*?)\\\)', text, re.DOTALL) if m.strip()]
    if formulas:
        return formulas

    # 6. Fallback — treat every non-empty line as a possible formula
    return [line.strip() for line in text.splitlines() if line.strip()]


# ╔══════════════════════════════════════════════════════════════════════════════
# ║  KaTeX HTML builder
# ╚══════════════════════════════════════════════════════════════════════════════

def build_katex_html(formulas: list) -> str:
    """
    Build a self-contained HTML page that:
      • Renders every formula with KaTeX (display mode)
      • Shows the raw LaTeX source in a styled code block
      • Provides a per-formula copy button backed by the Clipboard API
    All formulas are rendered in a single iframe to share one CDN load.
    """
    formulas_js = json.dumps(formulas)   # safe JSON array injected into JS

    # Per-formula card HTML (KaTeX rendering done in JS; only display code here)
    cards_html_parts = []
    for i, formula in enumerate(formulas):
        safe_formula = html_escape(formula)      # HTML-safe for <pre> display
        cards_html_parts.append(f"""
    <div class="card">
      <div class="card-header">
        <span class="formula-num">Formula {i + 1}</span>
      </div>
      <div class="card-body">
        <div class="render-col">
          <div class="col-label">Rendered</div>
          <div class="katex-target" id="f{i}"></div>
        </div>
        <div class="code-col">
          <div class="col-label">LaTeX source</div>
          <pre class="latex-pre"><code>{safe_formula}</code></pre>
          <button class="copy-btn" id="btn{i}" onclick="copyFormula({i})">
            &#x2398;&nbsp;Copy LaTeX
          </button>
        </div>
      </div>
    </div>""")

    cards_html = "\n".join(cards_html_parts)

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet"
      href="{KATEX_CDN}/katex.min.css"
      crossorigin="anonymous">
<script defer
        src="{KATEX_CDN}/katex.min.js"
        crossorigin="anonymous"
        onload="renderFormulas()"></script>
<style>
  *, *::before, *::afte
```

### Core Architecture Module: `OCR/medical_prescription_digitizer/app.py`
```
<<<<<<< HEAD
=======
"""Streamlit app that extracts and validates structured prescription data from uploaded images using Mistral Large 3 and RxNorm."""
>>>>>>> 1d1e9f137cfd1123edbae5d8e955ce0b9c7fcf4a
import os
import io

import streamlit as st
from dotenv import load_dotenv
from PIL import Image

from extractor import extract_prescription
from validator import validate_prescription_drugs
from schemas import Prescription

load_dotenv()

st.set_page_config(
    page_title="Medical Prescription Digitizer",
    page_icon="💊",
    layout="wide",
)

# ── Styles ────────────────────────────────────────────────────────────────────
st.markdown(
    """
    <style>
    .valid-drug   { background:#d4edda; border-left:4px solid #28a745;
                    padding:10px 14px; border-radius:6px; margin-bottom:8px; }
    .invalid-drug { background:#f8d7da; border-left:4px solid #dc3545;
                    padding:10px 14px; border-radius:6px; margin-bottom:8px; }
    .field-row    { display:flex; gap:12px; flex-wrap:wrap; margin-top:4px; }
    .field-chip   { background:#e9ecef; border-radius:12px;
                    padding:2px 10px; font-size:0.85rem; color:#495057; }
    .illegible-box{ background:#fff3cd; border-left:4px solid #ffc107;
                    padding:10px 14px; border-radius:6px; margin-top:8px; }
    .section-card { background:#f8f9fa; border-radius:10px;
                    padding:18px 22px; margin-bottom:16px; }
    </style>
    """,
    unsafe_allow_html=True,
)

# ── Header ────────────────────────────────────────────────────────────────────
st.title("💊 Medical Prescription Digitizer")
st.caption("Upload a prescription image — handwritten or printed — to extract and validate its contents.")
st.divider()


<<<<<<< HEAD
# ── Sidebar: API key ──────────────────────────────────────────────────────────
with st.sidebar:
    st.header("⚙️ Configuration")
    api_key = st.text_input(
        "Mistral API Key",
        value=os.getenv("MISTRAL_API_KEY", ""),
        type="password",
        help="Your Mistral API key. Store it in .env as MISTRAL_API_KEY to avoid re-entering.",
    )
    st.markdown("---")
=======
api_key = os.getenv("MISTRAL_API_KEY")

# ── Sidebar ───────────────────────────────────────────────────────────────────
with st.sidebar:
>>>>>>> 1d1e9f137cfd1123edbae5d8e955ce0b9c7fcf4a
    st.markdown("**How it works**")
    st.markdown(
        "1. Upload a prescription image\n"
        "2. Mistral Large 3 reads and interprets it\n"
        "3. Drug names are validated via [RxNorm](https://rxnav.nlm.nih.gov/)\n"
        "4. Results are displayed with validation status"
    )
    st.markdown("---")
    st.markdown("**Supported formats:** JPG, PNG, WEBP")


# ── Upload ────────────────────────────────────────────────────────────────────
uploaded_file = st.file_uploader(
    "Upload Prescription Image",
    type=["jpg", "jpeg", "png", "webp"],
    help="Upload a clear photo of a handwritten or printed prescription.",
)

if uploaded_file:
    col_img, col_info = st.columns([1, 1], gap="large")

    with col_img:
        st.subheader("Uploaded Image")
        image = Image.open(uploaded_file)
        st.image(image, use_container_width=True)
        uploaded_file.seek(0)

    with col_info:
        st.subheader("Extraction & Validation")

        if not api_key:
<<<<<<< HEAD
            st.error("Please enter your Mistral API key in the sidebar to proceed.")
=======
            st.error("MISTRAL_API_KEY not found. Add it to your .env file and restart the app.")
>>>>>>> 1d1e9f137cfd1123edbae5d8e955ce0b9c7fcf4a
            st.stop()

        if st.button("🔍 Digitize Prescription", type="primary", use_container_width=True):
            prescription: Prescription | None = None

            with st.spinner("Reading prescription with Mistral Large 3…"):
                try:
                    prescription = extract_prescription(uploaded_file, api_key)
                except Exception as e:
                    st.error(f"Extraction failed: {e}")
                    st.stop()

            with st.spinner("Validating drug names against RxNorm…"):
                try:
                    prescription = validate_prescription_drugs(prescription)
                except Exception as e:
                    st.warning(f"Validation step encountered an error: {e}")

            # ── Display results ───────────────────────────────────────────────
            st.success("Prescription processed successfully!")

            # Patient / Doctor / Date
            st.markdown('<div class="section-card">', unsafe_allow_html=True)
            meta_cols = st.columns(3)
            with meta_cols[0]:
                st.metric("Patient", prescription.patient_name or "—")
            with meta_cols[1]:
                st.metric("Doctor", prescription.doctor_name or "—")
            with meta_cols[2]:
                st.metric("Date", prescription.date or "—")
            st.markdown("</div>", unsafe_allow_html=True)

            # Medications
            st.markdown("#### Medications")

            if not prescription.medications:
                st.warning("No medications could be extracted from this prescription.")
            else:
                validated_count = sum(1 for m in prescription.medications if m.is_validated)
                total = len(prescription.medications)
                st.caption(f"{validated_count}/{total} drug names validated against RxNorm")

                for med in prescription.medications:
                    css_class = "valid-drug" if med.is_validated else "invalid-drug"
                    status_icon = "✅" if med.is_validated else "⚠️"

                    chips = ""
                    if med.dosage:
                        chips += f'<span class="field-chip">💊 {med.dosage}</span>'
                    if med.frequency:
                        chips += f'<span class="field-chip">🕐 {med.frequency}</span>'
                    if med.duration:
                        chips += f'<span class="field-chip">📅 {med.duration}</span>'

                    note_html = ""
                    if med.validation_note:
                        note_color = "#155724" if med.is_validated else "#721c24"
                        note_html = f'<div style="font-size:0.8rem;color:{note_color};margin-top:4px">{med.validation_note}</div>'

                    st.markdown(
                        f"""
                        <div class="{css_class}">
                            <strong>{status_icon} {med.drug_name}</strong>
                            <div class="field-row">{chips}</div>
                            {note_html}
                        </div>
                        """,
                        unsafe_allow_html=True,
                    )

            # Notes
            if prescription.notes:
                st.markdown("#### Additional Notes")
                st.info(prescription.notes)

            # Illegible fields
            if prescription.illegible_fields:
                st.markdown(
                    '<div class="illegible-box">'
                    "<strong>⚠️ Illegible / Uncertain Fields</strong><br>"
                    + "<br>".join(f"• {f}" for f in prescription.illegible_fields)
                    + "</div>",
                    unsafe_allow_html=True,
                )

            # Raw JSON expander
            with st.expander("🗂️ View Raw Extracted JSON"):
                st.json(prescription.model_dump())

else:
    # Empty state
    st.markdown(
        """
        <div style="text-align:center;padding:60px 20px;color:#6c757d;">
            <div style="font-size:4rem">📋</div>
            <h3>No prescription uploaded yet</h3>
            <p>Upload a JPG, PNG, or WEBP image of a prescription above to get started.</p>
        </div>
        """,
        unsafe_allow_html=True,
    )

```

### Core Architecture Module: `OCR/medical_prescription_digitizer/extractor.py`
```
import base64
import io

from mistralai.client import Mistral
from PIL import Image

from schemas import Prescription


SYSTEM_PROMPT = """You are a medical prescription digitizer. Your task is to carefully read and extract
structured information from prescription images, including handwritten ones.

Guidelines:
- Extract ALL medications listed, even if handwriting is difficult
- Decode common medical abbreviations: QD/OD=once daily, BID=twice daily, TID=three times daily,
  QID=four times daily, PRN=as needed, PO=by mouth, SIG=directions, Rx=prescription
- For illegible sections, add a descriptive entry to illegible_fields (e.g. "medication 2 dosage unclear")
- Do NOT guess drug names if truly illegible — mark them as illegible instead
- Extract dosage units precisely: mg, mcg, ml, units, etc.
- If a field is absent from the prescription, leave it as null
"""


def image_to_base64(image_file) -> tuple[str, str]:
    """Convert uploaded file to base64 string. Returns (base64_data, media_type)."""
    image_bytes = image_file.read()
    image_file.seek(0)

    img = Image.open(io.BytesIO(image_bytes))
    fmt = img.format or "JPEG"
    media_type_map = {
        "JPEG": "image/jpeg",
        "PNG": "image/png",
        "GIF": "image/gif",
        "WEBP": "image/webp",
    }
    media_type = media_type_map.get(fmt, "image/jpeg")

    b64 = base64.b64encode(image_bytes).decode("utf-8")
    return b64, media_type


def extract_prescription(image_file, api_key: str) -> Prescription:
    """Send image to Mistral Large 3 and extract structured prescription data."""
    b64_data, media_type = image_to_base64(image_file)

    client = Mistral(api_key=api_key)

    result = client.chat.parse(
        response_format=Prescription,
        model="mistral-large-latest",
        messages=[
            {
                "role": "system",
                "content": SYSTEM_PROMPT,
            },
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": "Please extract all structured information from this medical prescription image.",
                    },
                    {
                        "type": "image_url",
                        "image_url": f"data:{media_type};base64,{b64_data}",
                    },
                ],
            },
        ],
    )

    return result.choices[0].message.parsed

```

### Core Architecture Module: `OCR/medical_prescription_digitizer/schemas.py`
```
from pydantic import BaseModel, Field
from typing import Optional, List


class Medication(BaseModel):
    drug_name: str = Field(description="Name of the drug/medication as written on prescription")
    dosage: Optional[str] = Field(default=None, description="Dosage amount and unit, e.g. '500mg', '10mg/5ml'")
    frequency: Optional[str] = Field(default=None, description="How often to take, e.g. 'twice daily', 'every 8 hours', 'TID'")
    duration: Optional[str] = Field(default=None, description="Duration of treatment, e.g. '7 days', '2 weeks'")
    is_validated: bool = Field(default=False, description="Whether drug name was validated against RxNorm")
    validation_note: Optional[str] = Field(default=None, description="Note about validation result")


class Prescription(BaseModel):
    patient_name: Optional[str] = Field(default=None, description="Full name of the patient")
    doctor_name: Optional[str] = Field(default=None, description="Name of the prescribing doctor")
    date: Optional[str] = Field(default=None, description="Date on the prescription")
    medications: List[Medication] = Field(description="List of all medications prescribed")
    notes: Optional[str] = Field(default=None, description="Any additional notes, instructions, or diagnoses on the prescription")
    illegible_fields: List[str] = Field(
        default=[],
        description="List of fields or sections that were illegible or unclear, e.g. ['patient address', 'drug 2 dosage']"
    )

```

### Core Architecture Module: `OCR/medical_prescription_digitizer/validator.py`
```
import requests
from schemas import Medication, Prescription

RXNORM_BASE_URL = "https://rxnav.nlm.nih.gov/REST/rxcui.json"
REQUEST_TIMEOUT = 10


def validate_drug_name(drug_name: str) -> tuple[bool, str | None]:
    """
    Query RxNorm API to validate a drug name.
    Returns (is_valid, rxcui_or_none).
    """
    try:
        response = requests.get(
            RXNORM_BASE_URL,
            params={"name": drug_name},
            timeout=REQUEST_TIMEOUT,
        )
        response.raise_for_status()
        data = response.json()

        id_group = data.get("idGroup", {})
        rxnorm_ids = id_group.get("rxnormId", [])

        if rxnorm_ids:
            return True, rxnorm_ids[0]
        return False, None

    except requests.exceptions.Timeout:
        return False, None
    except requests.exceptions.RequestException:
        return False, None


def validate_prescription_drugs(prescription: Prescription) -> Prescription:
    """Validate all drug names in a prescription against RxNorm and update in-place."""
    for med in prescription.medications:
        if not med.drug_name or med.drug_name.strip() == "":
            med.is_validated = False
            med.validation_note = "Drug name is empty or illegible"
            continue

        is_valid, rxcui = validate_drug_name(med.drug_name.strip())

        if is_valid:
            med.is_validated = True
            med.validation_note = f"Validated — RxNorm ID: {rxcui}"
        else:
            med.is_validated = False
            med.validation_note = "Drug name not found in RxNorm — possible misread"

    return prescription

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #133** (2026-09-29): **Update README.md**
  *Symptoms*: Removed the "$25 in signup credits" line  <!-- This is an auto-generated comment: release notes by coderabbit.ai -->  ## Summary by CodeRabbit  * **Documentation**   * Updated the cost estimate to omit the comparison with signup credits and the estimate of how many booking calls those credits cover.  <!-- end of auto-generated comment: release notes by coderabbit.ai -->
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  <a href="https://app.coderabbit.ai/change-stack/Sumanth077/Hands-On-AI-Engineering/pull/133"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui-dark.svg?v=2" alt="Review in Change Stack →" width="220" height="32"></a>  Navigate logical layers of code changes, visualize relationships, and explore their blast radius.  <!-- review_stack_entry_end --> <!-- recent_review_start -->  No actionable comments were generated in the recent review. 🎉  <details> <summary>ℹ️ Recent review info</summary>  <details> <summary>⚙️ Run configuration</summary>  **Configuration used**: defaults  **Review profile**: CHILL  **Plan**: Advanced  **Run ID**: `6671b3e2-309c-4fda-82cc-302aa50b7ea8`  </details>  <details> <summary>📥 Commits</summary>  Reviewing files that changed from the base of the PR and between 598bb1f168a401de92d91100cfe193a0fd831490 and 95ff00

- **Issue #132** (2026-09-24): **Build local Ollama-powered data analyst with Gradio**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  <a href="https://app.coderabbit.ai/change-stack/Sumanth077/Hands-On-AI-Engineering/pull/132"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui-dark.svg?v=2" alt="Review in Change Stack →" width="220" height="32"></a>  Navigate logical layers of code changes, visualize relationships, and explore their blast radius.  <!-- review_stack_entry_end --> <!-- This is an auto-generated comment: review in progress by coderabbit.ai -->  > [!NOTE] > Currently processing new changes in this PR. This may take a few minutes, please wait... >  > <details> > <summary>⚙️ Run configuration</summary> >  > **Configuration used**: defaults >  > **Review profile**: CHILL >  > **Plan**: Advanced >  > **Run ID**: `ebd6e22a-dc4b-4f77-8c21-b17a4d23c456` >  > </details> >  > <details> > <summary>📥 Commits</summary> >  > Reviewing files that changed from the base 

- **Issue #131** (2026-09-24): **feat: add Offline Troubleshooting Agent - local AI agent for industrial equipment diagnosis with zero internet dependency**
  *Symptoms*: An AI troubleshooting agent for industrial equipment that investigates faults using only local tools, local memory, and a local LLM. No internet connection is required at any point, proven by an actual disconnected test run, not just claimed.  Key Features: - Simulated machine with three realistic fault scenarios (bearing, cooling, pressure), each with a distinct sensor signature and error code - Agent investigates using a defined tool surface: current readings, recent history, equipment manual search, and past incident search, before proposing a diagnosis - Persistent local memory (Actian VectorAI DB) of past incidents and manual content, retrieved by semantic similarity, survives container restarts - Human confirmation gate: the model's own diagnosis and the human's confirmed cause are stored as separate fields, nothing is written to permanent memory until a technician explicitly confirms or corrects it - Live Gradio UI showing the investigation happening step by step, plus a live online/offline status indicator - Full offline test suite (scripts/offline_test.py) with a network guard that refuses to run if it detects a live connection, so the offline claim is verifiable, not assumed - A completed, logged offline run is included at docs/OFFLINE_TEST_LOG_20260923T092644.md as evidence  Tech Stack: - LLM: qwen3:4b-instruct (local via Ollama) - Embeddings: nomic-embed-text (local via Ollama) - Vector memory: Actian VectorAI DB - UI: Gradio - Data handling: Panda
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  <a href="https://app.coderabbit.ai/change-stack/Sumanth077/Hands-On-AI-Engineering/pull/131"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui-dark.svg?v=2" alt="Review in Change Stack →" width="220" height="32"></a>  Navigate logical layers of code changes, visualize relationships, and explore their blast radius.  <!-- review_stack_entry_end --> <!-- walkthrough_start -->  <details> <summary>📝 Walkthrough</summary>  ## Walkthrough  This pull request adds an offline troubleshooting application. It simulates machine faults, uses local Ollama models and Actian VectorAI memory during investigations, and presents results for human review in a Gradio interface. It also adds setup, maintenance, and verification tools.  ### Changes  **Offline Troubleshooting Agent**  |Layer / File(s)|Summary| |---|---| |**Machine simulator and fault scenarios
  > Really strong build and use case, @Tiioluwani . However, the architecture PNG shouldn't be the demo. You can put the architecture PNG in a "How it works" section and create a separate demo GIF for this project. Do that so I can merge the PR.

- **Issue #130** (2026-09-19): **feat(audio): switch voice agent and follow-up to GLM-5.3-Flash on Tel…**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  <a href="https://app.coderabbit.ai/change-stack/Sumanth077/Hands-On-AI-Engineering/pull/130#gh-light-mode-only"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui.svg" alt="Review Change Stack" width="202" height="32"></a><a href="https://app.coderabbit.ai/change-stack/Sumanth077/Hands-On-AI-Engineering/pull/130#gh-dark-mode-only"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui-dark.svg" alt="Review Change Stack" width="202" height="32"></a>  <!-- review_stack_entry_end --> <!-- This is an auto-generated comment: review in progress by coderabbit.ai -->  > [!NOTE] > Currently processing new changes in this PR. This may take a few minutes, please wait... >  > <details> > <summary>⚙️ Run configuration</summary> >  > **Configuration used**: defaults >  > **Review profile**: CHILL >  > **Plan**:

- **Issue #129** (2026-09-18): **feat(audio): add AI appointment booking voice agent (Telnyx Voice AI)**
  *Symptoms*:   <!-- This is an auto-generated comment: release notes by coderabbit.ai -->  ## Summary by CodeRabbit  * **New Features**   * Added an AI-powered voice agent for checking availability and booking appointments by phone.   * Added configurable business hours, services, scheduling rules, and booking horizons.   * Added calendar invite generation and appointment tracking.   * Added optional post-call follow-up messages via SMS.   * Added a demo page and dashboard for viewing appointments and call summaries.   * Added health, business information, availability, booking, and summary integrations.  * **Documentation**   * Added setup, configuration, customization, and demo instructions for the voice agent.  <!-- end of auto-generated comment: release notes by coderabbit.ai -->
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  <a href="https://app.coderabbit.ai/change-stack/Sumanth077/Hands-On-AI-Engineering/pull/129#gh-light-mode-only"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui.svg" alt="Review Change Stack" width="202" height="32"></a><a href="https://app.coderabbit.ai/change-stack/Sumanth077/Hands-On-AI-Engineering/pull/129#gh-dark-mode-only"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui-dark.svg" alt="Review Change Stack" width="202" height="32"></a>  <!-- review_stack_entry_end --> <!-- walkthrough_start -->  <details> <summary>📝 Walkthrough</summary>  ## Walkthrough  ### Changes  The pull request adds a complete Telnyx Voice AI appointment-booking agent. It includes environment configuration, SQLite CRM storage, slot scheduling, calendar invites, webhook tools, call summaries, optional SMS follow

- **Issue #128** (2026-09-18): **feat: add Voice GitHub Agent - voice-controlled agent for GitHub repo triage**
  *Symptoms*: - Speak an instruction in the browser; AssemblyAI's Sync API transcribes it in one HTTP call, no polling - A tool-calling agent (qwen3-next-80b-a3b via AssemblyAI's LLM Gateway) reads the transcript and decides which GitHub actions to take, rather than following a fixed script - Real GitHub actions: reads recent commits and diffs, lists open issues, and can open new issues or add comments through the GitHub REST API - Activity feed and final summary render live in the browser, with model output parsed as markdown (escaped first, to avoid any injected HTML from model output executing) - Verified end to end against a real repo, including an actual create_issue write confirmed directly on GitHub, not just in the app's own summary  <!-- This is an auto-generated comment: release notes by coderabbit.ai -->  ## Summary by CodeRabbit  - **New Features**   - Added a voice-driven GitHub assistant that records spoken requests, transcribes them, and performs GitHub actions.   - Supports reviewing recent commits, inspecting diffs, listing open issues, creating issues, and adding comments.   - Displays transcripts, activity, and concise Markdown summaries in a responsive interface.   - Added safeguards for invalid requests, missing configuration, failed actions, and empty transcripts.  - **Documentation**   - Added setup instructions, configuration guidance, usage details, prerequisites, and workflow documentation.  <!-- end of auto-generated comment: release notes by coderabbit.ai --
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  <a href="https://app.coderabbit.ai/change-stack/Sumanth077/Hands-On-AI-Engineering/pull/128#gh-light-mode-only"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui.svg" alt="Review Change Stack" width="202" height="32"></a><a href="https://app.coderabbit.ai/change-stack/Sumanth077/Hands-On-AI-Engineering/pull/128#gh-dark-mode-only"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui-dark.svg" alt="Review Change Stack" width="202" height="32"></a>  <!-- review_stack_entry_end --> <!-- walkthrough_start -->  <details> <summary>📝 Walkthrough</summary>  ## Walkthrough  The pull request adds a voice-driven GitHub agent. A browser records audio and sends WAV data to Flask. AssemblyAI transcribes the audio. The agent calls GitHub tools and returns activity and a summary for display.  ### Changes  **Vo

- **Issue #127** (2026-09-17): **docs: fix stale path and back-to-top anchor in voice agent README**
  *Symptoms*:   <!-- This is an auto-generated comment: release notes by coderabbit.ai -->  ## Summary by CodeRabbit  - **Documentation**   - Updated setup instructions to use the current customer support voice agent directory.   - Corrected the “Back to Top” link to match the renamed heading.  <!-- end of auto-generated comment: release notes by coderabbit.ai -->
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  <a href="https://app.coderabbit.ai/change-stack/Sumanth077/Hands-On-AI-Engineering/pull/127#gh-light-mode-only"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui.svg" alt="Review Change Stack" width="202" height="32"></a><a href="https://app.coderabbit.ai/change-stack/Sumanth077/Hands-On-AI-Engineering/pull/127#gh-dark-mode-only"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui-dark.svg" alt="Review Change Stack" width="202" height="32"></a>  <!-- review_stack_entry_end --> <!-- This is an auto-generated comment: failure by coderabbit.ai -->  > [!CAUTION] > ## Review failed >  > The pull request is closed.  <!-- end of auto-generated comment: failure by coderabbit.ai -->  <!-- recent_review_start -->  <details> <summary>ℹ️ Recent review info</summary>  <details> <summary>⚙️ Run configuratio

- **Issue #126** (2026-09-17): **feat: add Self-Driving Data Analyst with Liner**
  *Symptoms*: Adds an autonomous data-analysis agent that investigates a dataset on its own: given a broad objective, it decides what to check, runs the analysis, follows what it finds, and keeps going until it has enough evidence to explain what happened, instead of the user having to ask each specific question.  Key Features: - Autonomous investigation loop: understand data, choose what to investigate, run analysis, observe, decide next step, repeat, produce findings - Hypothesis tracking with status and confidence, updated as evidence comes in - Parallel tool calls for independent lines of investigation - Error recovery: a failed SQL query becomes an observation the agent reasons over, not a crash - Loop detection to catch and redirect repeated near-identical queries - Structured final report (root cause, confidence, key findings, recommended actions) - Full usage and cost tracking per investigation  Tech Stack: - Liner Model API (liner-mark-1.0) - Python (custom investigation loop) - DuckDB - Pandas - Plotly - Streamlit - Pydantic  <!-- This is an auto-generated comment: release notes by coderabbit.ai -->  ## Summary by CodeRabbit  * **New Features**   * Added a Self-Driving Data Analyst app for uploading CSV files or exploring demo e-commerce data.   * Supports autonomous investigations with SQL, Python analysis, hypothesis tracking, findings, charts, and structured reports.   * Displays investigation progress, detected insights, recommendations, usage metrics, and e
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  <a href="https://app.coderabbit.ai/change-stack/Sumanth077/Hands-On-AI-Engineering/pull/126#gh-light-mode-only"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui.svg" alt="Review Change Stack" width="202" height="32"></a><a href="https://app.coderabbit.ai/change-stack/Sumanth077/Hands-On-AI-Engineering/pull/126#gh-dark-mode-only"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui-dark.svg" alt="Review Change Stack" width="202" height="32"></a>  <!-- review_stack_entry_end --> <!-- walkthrough_start -->  <details> <summary>📝 Walkthrough</summary>  ## Walkthrough  Adds a Streamlit Self-Driving Data Analyst with Liner API integration, stateful investigation tools, loop and budget handling, CSV and demo data loading, structured reports, charts, usage metrics, documentation, and automated tests. 

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

### Incident Patch 1: `03f1a22f` (2026-09-17)
**Commit Message**: docs: fix stale path and back-to-top anchor in voice agent README

**File**: `audio/customer_support_voice_agent/README.md` (modified, +2/-2)
```diff
@@ -169,7 +169,7 @@ In your assistant settings, look for the **Dynamic Variables** section:
 
 ```bash
 git clone https://github.com/Sumanth077/Hands-On-AI-Engineering.git
-cd Hands-On-AI-Engineering/voice_apps/saas_customer_support_voice_agent
+cd Hands-On-AI-Engineering/audio/customer_support_voice_agent
 ```
 
 ### 2. Create virtual environment
@@ -281,4 +281,4 @@ This is the right approach for demos and small-to-medium support playbooks (unde
 - [Available models](https://developers.telnyx.com/docs/inference/models) -- `moonshotai/Kimi-K2.5` is the recommended balance of intelligence and cost
 - [Telnyx Portal](https://portal.telnyx.com)
 
-[Back to Top](#saas-customer-support-voice-agent-telnyx-ai-assistant-builder)
+[Back to Top](#customer-support-voice-agent-telnyx-ai-assistant-builder)
```

---

### Incident Patch 2: `c1a90671` (2026-08-25)
**Commit Message**: feat: add self-evolving code review agent with persistent feedback memory

**File**: `ai_agents/self_evolving_code_review_agent/.env.example` (added, +18/-0)
```diff
@@ -0,0 +1,18 @@
+# Actian VectorAI DB gRPC endpoint
+ACTIAN_VECTORAI_URL=localhost:6574
+
+# Optional only when authentication is enabled in VectorAI DB
+# ACTIAN_VECTORAI_ACCESS_TOKEN=replace-with-your-token
+
+# Local Ollama server and model
+OLLAMA_HOST=http://localhost:11434
+OLLAMA_MODEL=qwen3:4b-instruct
+
+# Local embedding model
+EMBEDDING_MODEL=BAAI/bge-small-en-v1.5
+
+# Retrieval controls
+INSIGHT_TOP_K=6
+TRAJECTORY_TOP_K=3
+MIN_RELEVANCE_SCORE=0.30
+
```

**File**: `ai_agents/self_evolving_code_review_agent/.gitignore` (added, +12/-0)
```diff
@@ -0,0 +1,12 @@
+.env
+__pycache__/
+*.pyc
+*.pyo
+.venv/
+venv/
+*.egg-info/
+dist/
+.DS_Store
+vectorai_data/
+.streamlit/secrets.toml
+
```

**File**: `ai_agents/self_evolving_code_review_agent/.streamlit/config.toml` (added, +9/-0)
```diff
@@ -0,0 +1,9 @@
+[theme]
+primaryColor = "#4F46E5"
+backgroundColor = "#FFFFFF"
+secondaryBackgroundColor = "#EEF2FF"
+textColor = "#1E293B"
+
+[server]
+fileWatcherType = "none"
+
```

**File**: `ai_agents/self_evolving_code_review_agent/README.md` (added, +184/-0)
```diff
@@ -0,0 +1,184 @@
+# Self-Evolving Code Review Agent
+
+![Demo](assets/demo.gif)
+
+A code reviewer that learns team conventions from engineer feedback without retraining the model.
+
+## Overview
+
+Most automated code reviewers start from the same generic prompt on every run. This project adds persistent experiential memory. Before reviewing a change, the agent retrieves relevant team rules and similar past review trajectories from [Actian VectorAI DB](https://www.actian.com/databases/vectorai-db/). After generating comments, it pauses until the engineer accepts, rejects, or edits every comment. The feedback is distilled into reusable natural-language insights and stored with the full review trajectory.
+
+The term self-evolving refers to non-parametric adaptation. The Qwen3 model weights and base prompts do not change. What evolves is the external memory supplied to later reviews. Accepted feedback reinforces useful rules, rejected feedback creates lessons about what not to flag, and edited feedback refines the team's preferred wording or convention.
+
+ExpeL extracts natural-language insights from agent experience and retrieves both insights and past trajectories at inference. This project applies that pattern to code review and uses engineer decisions as the outcome signal.
+
+## How It Works
+
+![How It Works](assets/how_it_works.png)
+
+LangGraph runs an explicit retrieve, review, feedback, reflect, and persist workflow. The graph uses an interrupt after comment generation, so the review pauses safely while the Streamlit interface collects one decision per comment. Resuming with the same thread ID sends those decisions into reflection. Only then are new insights and the trajectory written to Actian.
+
+Actian uses two collections. `review_insights` stores distilled rules with polarity, scope, confidence, and source review metadata. `review_trajectories` stores the reviewed change, generated comments, engineer decisions, reflection summary, and rejection metrics. Both collections use BGE embeddings for semantic recall.
+
+## Tech Stack
+
+| Component | Choice | Purpose |
+|---|---|---|
+| Agent workflow | LangGraph | Explicit retrieve, review, human feedback, reflect, and persist graph |
+| Human feedback | LangGraph interrupt and Streamlit controls | Pauses the graph and captures accept, reject, or edit decisions |
+| Memory database | Actian VectorAI DB | Persists learned insights and similar review trajectories |
+| Embeddings | `BAAI/bge-small-en-v1.5` via sentence-transformers | Embeds diffs, rules, and trajectories locally |
+| Language model | `qwen3:4b-instruct` via Ollama | Generates structured review comments and distilled insights locally |
+| Interface | Streamlit | Accepts code or diffs, collects feedback, and displays learning trends |
+
+## Prerequisites
+
+| Component | Requirement |
+|---|---|
+| Python | 3.10 through 3.13 |
+| RAM | 16 GB recommended for VectorAI DB, embeddings, and the local LLM together |
+| Disk space | At least 10 GB free, with additional space for Docker and model caches |
+| Docker | Docker Desktop or Docker Engine running locally |
+| Ollama | Installed and running locally |
+| uv | Installed as the Python environment and package manager |
+| Internet | Required on first setup to download dependencies, Docker images, and models |
+
+VectorAI DB's official Docker guide lists 8 GB RAM and 10 GB disk space as minimums, with 16 GB or more RAM recommended. This project recommends 16 GB because VectorAI DB, sentence-transformers, Ollama, and Streamlit run on the same machine.
+
+## Setup Steps
+
+### 1. Install uv
+
+On Windows PowerShell:
+
+```powershell
+winget install --id=astral-sh.uv -e
+```
+
+On macOS or Linux:
+
+```bash
+curl -LsSf https://astral.sh/uv/install.sh | sh
+```
+
+Restart the terminal after installation and run `uv --version` to confirm it is available.
+
+### 2. Clone the repository
+
+```bash
+git clone https://github.com/Sumanth077/Hands-On-AI-Engineering.git
+
```

**File**: `ai_agents/self_evolving_code_review_agent/demo.html` (added, +168/-0)
```diff
@@ -0,0 +1,168 @@
+<!doctype html>
+<html lang="en">
+<head>
+  <meta charset="utf-8">
+  <meta name="viewport" content="width=device-width, initial-scale=1">
+  <title>Self-Evolving Code Review Agent</title>
+  <style>
+    :root {
+      color-scheme: dark;
+      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
+      --panel: rgba(15, 23, 42, 0.72);
+      --border: rgba(129, 140, 248, 0.3);
+      --muted: #a5b4fc;
+      --text: #f8fafc;
+      --green: #34d399;
+      --red: #fb7185;
+      --amber: #fbbf24;
+    }
+    * { box-sizing: border-box; }
+    body {
+      margin: 0;
+      min-height: 100vh;
+      color: var(--text);
+      background: linear-gradient(135deg, #0F172A 0%, #1E1B4B 100%);
+    }
+    .shell { width: min(1180px, 94vw); margin: 0 auto; padding: 38px 0 24px; }
+    .hero { text-align: center; margin-bottom: 28px; }
+    h1 { margin: 0; font-size: clamp(32px, 5vw, 54px); }
+    .grid { display: grid; grid-template-columns: 1.35fr 0.65fr; gap: 20px; }
+    .panel {
+      border: 1px solid var(--border);
+      border-radius: 20px;
+      padding: 22px;
+      background: var(--panel);
+      box-shadow: 0 20px 60px rgba(2, 6, 23, 0.34);
+      backdrop-filter: blur(16px);
+    }
+    h2 { margin: 0 0 16px; font-size: 20px; }
+    .code {
+      margin: 0 0 18px;
+      padding: 17px;
+      border-radius: 14px;
+      overflow-x: auto;
+      color: #cbd5e1;
+      background: #020617;
+      font: 13px/1.6 "Cascadia Code", Consolas, monospace;
+      white-space: pre;
+    }
+    .comment {
+      padding: 16px;
+      margin-top: 12px;
+      border: 1px solid rgba(148, 163, 184, 0.2);
+      border-radius: 14px;
+      background: rgba(30, 41, 59, 0.68);
+    }
+    .meta { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; }
+    .severity { color: #fecdd3; font-size: 12px; font-weight: 700; }
+    .location { color: #94a3b8; font-size: 12px; }
+    .comment p { margin: 7px 0 12px; color: #e2e8f0; line-height: 1.55; }
+    .actions { display: flex; gap: 8px; flex-wrap: wrap; }
+    button {
+      border: 1px solid rgba(148, 163, 184, 0.32);
+      border-radius: 9px;
+      padding: 8px 12px;
+      color: #e2e8f0;
+      background: rgba(15, 23, 42, 0.8);
+      cursor: pointer;
+      font-weight: 650;
+    }
+    button:hover, button.active { border-color: #818cf8; background: rgba(79, 70, 229, 0.34); }
+    .edit-box { display: none; width: 100%; margin-top: 10px; }
+    .edit-box.visible { display: block; }
+    textarea {
+      width: 100%; min-height: 76px; resize: vertical; border: 1px solid #475569;
+      border-radius: 10px; padding: 10px; color: #f8fafc; background: #0f172a;
+    }
+    .learn {
+      width: 100%; margin-top: 18px; padding: 12px; border-color: #6366f1;
+      background: linear-gradient(90deg, #4f46e5, #7c3aed);
+    }
+    .metrics { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
+    .metric { padding: 15px; border-radius: 14px; background: rgba(30, 41, 59, 0.7); }
+    .metric strong { display: block; font-size: 25px; margin-top: 6px; }
+    .metric span { color: #a5b4fc; font-size: 12px; }
+    .rule { margin-top: 11px; padding: 13px; border-left: 3px solid #818cf8; background: rgba(49, 46, 129, 0.25); }
+    .rule small { display: block; color: #a5b4fc; margin-top: 5px; }
+    .toast { display: none; margin-top: 14px; color: #a7f3d0; text-align: center; }
+    footer { margin-top: 26px; text-align: center; color: #94a3b8; font-size: 13px; }
+    @media (max-width: 850px) { .grid { grid-template-columns: 1fr; } }
+  </style>
+</head>
+<body>
+  <main class="shell">
+    <div class="hero"><h1>Self-Evolving Code Review Agent</h1></div>
+    <div class="grid">
+      <section class="panel">
+        <h2>Review comments</h2>
+        <pre class="code">+ def delete_order(order_id, user_id):
++    return db.execute("DELETE FROM orders WHERE id = ?", (order_id,))</pre>
+        <ar
```

---

### Incident Patch 3: `6281dcd4` (2026-07-21)
**Commit Message**: feat: add Multi-Agent Research Assistant with Memory - Planner, Research, Writer, and Critic agents over Actian VectorAI DB with a Critic-gated revision loop, persistent memory, and self-evaluation. Fully local via Ollama (Gemma 4 E2B) and BGE embeddings.

**File**: `README.md` (modified, +1/-0)
```diff
@@ -40,6 +40,7 @@ A curated collection of practical, production-ready AI projects across multiple
 
 Intelligent ai agents for various automation tasks.
 
+- [**Multi-Agent Research Assistant with Memory**](./ai_agents/research_assistant_with_memory) — Planner, Research, Writer, and Critic agents collaborate over a shared [Actian VectorAI DB](https://www.actian.com/databases/vectorai-db/) memory layer. Retrieves cited answers from PDFs, papers, manuals, and transcripts, self-grades them with a Critic feedback loop, and persists findings across sessions. Fully local via Ollama and BGE embeddings.
 - [**Multi-Agent Financial Analyst**](./ai_agents/multi_agent_financial_analyst) — Team of specialized agents for comprehensive financial analysis.
 - [**FinAgent**](./ai_agents/finagent) — Financial assistant agent for stock market analysis and insights.
 - [**Daily AI News Digest**](./ai_agents/daily-news-digest) — Automated daily digest from 92 Karpathy-curated tech blogs delivered to Telegram every morning. MiniMax M2.7 scores articles from the last 24 hours and surfaces the 3 most significant stories.
```

**File**: `ai_agents/research_assistant_with_memory/.env.example` (added, +17/-0)
```diff
@@ -0,0 +1,17 @@
+# VectorAI DB connection (defaults work when running via docker-compose)
+ACTIAN_VECTORAI_URL=localhost:6574
+
+# Optional: access token if you've configured VectorAI DB auth
+# ACTIAN_VECTORAI_ACCESS_TOKEN=your-token-here
+
+# Embeddings (BGE via sentence-transformers, downloaded and cached on first run)
+EMBEDDING_MODEL=BAAI/bge-small-en-v1.5
+EMBEDDING_DIM=384
+
+# Local inference via Ollama
+OLLAMA_HOST=http://localhost:11434
+OLLAMA_MODEL=gemma4:e2b
+
+# Critic / revision loop
+CRITIC_PASS_THRESHOLD=3.5
+MAX_REVISIONS=2
```

**File**: `ai_agents/research_assistant_with_memory/.gitignore` (added, +17/-0)
```diff
@@ -0,0 +1,17 @@
+# VectorAI DB local data volume
+vectorai_data/
+
+# Python
+__pycache__/
+*.py[cod]
+*.egg-info/
+.venv/
+
+# Environment variables (never commit secrets)
+.env
+
+# macOS
+.DS_Store
+
+# HuggingFace model cache (large, re-downloaded on first run)
+~/.cache/huggingface/
```

**File**: `ai_agents/research_assistant_with_memory/.streamlit/config.toml` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+[server]
+# Disable the file watcher entirely. "poll" still walks every submodule of
+# large packages like transformers to build its watch list, which triggers
+# harmless but noisy ModuleNotFoundError output for optional deps (e.g.
+# torchvision) at every startup. "none" skips that walk; just rerun manually
+# (r) after editing source instead of relying on hot-reload.
+fileWatcherType = "none"
```

**File**: `ai_agents/research_assistant_with_memory/README.md` (added, +347/-0)
```diff
@@ -0,0 +1,347 @@
+# Multi-Agent Research Assistant with Memory & Self-Evaluation
+
+> A team of four local agents (Planner, Research, Writer, and Critic) that read, cite, and grade their own answers over a shared [Actian VectorAI DB](https://www.actian.com/databases/vectorai-db/) memory layer.
+
+## Demo
+
+![Demo](assets/demo.gif)
+
+## Overview
+
+**Scope: this is a research assistant over your own document collection, not a web-search agent.**
+It answers questions about whatever you've ingested (papers, manuals, transcripts, notes), never
+the web, and never the LLM's own training knowledge. That restriction is deliberate: it's what
+lets the Critic guarantee every claim traces back to a specific retrieved passage instead of a
+plausible-sounding guess. If you want an agent that goes and researches open-ended topics with web
+search, see [research_team](../research_team) in this repo instead.
+
+There is more to read than anyone can keep up with: papers, manuals, and long transcripts. A
+normal chatbot answers off a single prompt, guesses when it isn't sure, and never checks its own
+work. This project is closer to a small research team working over your document library: one
+agent plans the research, one gathers evidence from your documents, one writes the answer, and one
+grades it before it reaches you.
+
+The repo ships with a handful of sample documents already ingested (see [Sample data](#sample-data)
+below) so the demo works the moment you run it, but the library isn't static: add your own PDFs,
+notes, or transcripts anytime from the **Library** tab or the CLI ingestion script, and the next
+question can draw on them immediately.
+
+An ingestion pipeline chunks and embeds every source (PDFs, papers, manuals, video transcripts)
+into one shared Actian VectorAI DB collection, tagged with document and section metadata. A
+LangGraph state machine then runs a question through four agents: the Planner decomposes it into
+search queries, the Research agent retrieves evidence through tools (it never reads a document
+directly), the Writer composes a cited answer, and the Critic scores it on correctness,
+completeness, and clarity. A rejected answer loops back to Research with the Critic's specific
+complaint attached, instead of blindly retrying. Answers that pass are written into a second
+long-term memory collection, so a later session in the same document library builds on prior
+findings instead of starting from zero. Everything runs locally: embeddings via BGE
+(sentence-transformers), generation via Ollama, no external API calls.
+
+## Features
+
+- **Four specialist agents over a shared collection**: Planner, Research, Writer, and Critic, each a plain function over LangGraph state, sharing one Actian VectorAI DB context layer instead of passing documents around directly
+- **Tool-mediated retrieval only**: the Research agent never touches a document; it calls `doc_search`, `get_section`, and `memory_search`, so every fact in a final answer traces back to a logged tool call
+- **Critic-gated revision loop**: a rejected answer (average score below threshold, or ungrounded) routes back to Research with the Critic's specific complaint, capped at `MAX_REVISIONS` passes so a stubborn Critic can't spin forever
+- **Persistent long-term memory**: findings that clear the Critic are embedded and written back to a `research_memory` collection; later questions in the same or later sessions retrieve them alongside raw source chunks
+- **Session memory with context compression**: recent turns are kept verbatim, older ones are folded into a running summary between questions so prompts stay small without losing the thread
+- **Multi-source ingestion**: PDFs, `.txt`/`.md` notes and papers, and `.vtt`/`.srt` video transcripts are sectioned (by heading or page), chunked, and tagged with `doc_id`, `section`, and `source_type` so citations point at a specific document and section
+- **Built-in evaluation suite**: runs a fixed set of 
```

---

### Incident Patch 4: `4db05f3a` (2026-06-20)
**Commit Message**: audit: fix multi_agent_research_assistant_ag2 - swap to Mistral via native AG2 integration, fix UI layout, add docstrings, rewrite em dashes

**File**: `ai_agents/multi_agent_research_assistant_ag2/.env.example` (modified, +4/-3)
```diff
@@ -1,3 +1,4 @@
-OPENAI_API_KEY=your_openai_api_key_here
-OPENAI_BASE_URL=https://api.openai.com/v1   # override for SambaNova, Azure, etc.
-LLM_MODEL=gpt-4o-mini
+# Mistral API key used by the researcher, analyst, and writer agents (Mistral Small 4).
+# Get one at https://console.mistral.ai/api-keys
+MISTRAL_API_KEY=your_mistral_api_key_here
+LLM_MODEL=mistral-small-latest
```

**File**: `ai_agents/multi_agent_research_assistant_ag2/README.md` (modified, +22/-11)
```diff
@@ -1,25 +1,31 @@
+<a id="top"></a>
+
 # Multi-Agent Research Assistant with AG2
 
 A production-grade multi-agent research pipeline using [AG2](https://github.com/ag2ai/ag2)
-(formerly AutoGen). Three specialists collaborate under GroupChat with LLM-driven speaker
-selection to research any topic and produce a structured Markdown report.
+(formerly AutoGen). Three specialists collaborate under GroupChat to research any topic
+and produce a structured Markdown report, powered by Mistral Small 4
+(`mistral-small-latest`) via AG2's native Mistral integration.
 
 ## Features
 - Multi-agent collaboration (researcher, analyst, writer) under GroupChat
-- LLM-driven dynamic speaker selection — no hardcoded turn order
 - AG2's `register_function(caller=, executor=)` tool registration pattern
-- OpenAI-compatible endpoint (works with SambaNova, Azure OpenAI, local models via Ollama)
+- Native Mistral support via AG2's `api_type: "mistral"` config entry
 - Download report as Markdown
 
+## Demo
+
+![Demo](assets/demo.gif)
+
 ## Prerequisites
 - Python 3.10+
-- OpenAI API key (or compatible endpoint)
+- Mistral API key from [console.mistral.ai](https://console.mistral.ai/api-keys)
 
 ## Installation
 ```bash
 cd multi_agent_research_assistant_ag2
 pip install -r requirements.txt
-cp .env.example .env  # add your API key
+cp .env.example .env  # add your Mistral API key
 ```
 
 ## Usage
@@ -32,20 +38,21 @@ streamlit run research_assistant.py
 1. **Researcher** searches the web using DuckDuckGo API and summarises findings
 2. **Analyst** critically reviews the research and identifies gaps
 3. **Writer** synthesises all inputs into a structured Markdown report
-4. **GroupChatManager** uses LLM-based speaker selection to orchestrate the conversation
+4. **GroupChatManager** orchestrates the analyst and writer in round-robin order
 
 ## AG2 Concepts Demonstrated
-- `GroupChat` with `speaker_selection_method="auto"`
-- `register_function(caller=, executor=)` — separates tool description from execution
-- `UserProxyAgent` with `code_execution_config` — built-in code execution sandbox
+- `GroupChat` with `speaker_selection_method="round_robin"`
+- `register_function(caller=, executor=)`, which separates tool description from execution
+- `UserProxyAgent` with `code_execution_config`, providing a built-in code execution sandbox
+- Native Mistral integration via `{"api_type": "mistral", "model": "mistral-small-latest", ...}` in `LLMConfig`, instead of pointing an OpenAI-compatible `base_url` at Mistral's endpoint
 
 > **Security note:** `use_docker=False` in `code_execution_config` means any agent-generated
 > code runs directly in your process. For production use, set `use_docker=True` or run in
 > an isolated environment.
 
 ## Running Tests
 
-Tests are fully mocked — no API keys or network access required.
+Tests are fully mocked and require no API keys or network access.
 
 ```bash
 pip install pytest
@@ -66,3 +73,7 @@ multi_agent_research_assistant_ag2/
 ├── requirements.txt
 └── .env.example
 ```
+
+---
+
+[Back to top](#top)
```

**File**: `ai_agents/multi_agent_research_assistant_ag2/requirements.txt` (modified, +1/-0)
```diff
@@ -1,3 +1,4 @@
 ag2>=0.11.0
+mistralai>=2.0.0
 streamlit>=1.31.0
 python-dotenv>=1.0.0
```

**File**: `ai_agents/multi_agent_research_assistant_ag2/research_assistant.py` (modified, +80/-30)
```diff
@@ -1,4 +1,5 @@
-# research_assistant.py
+"""Multi-agent research pipeline using AG2 (AutoGen): researcher, analyst, and writer
+agents collaborate under GroupChat, powered by Mistral Small 4, with a Streamlit UI."""
 import os
 import streamlit as st
 from datetime import datetime
@@ -9,32 +10,69 @@
 
 load_dotenv()
 
-# ── AG2 (formerly AutoGen) requires ag2>=0.11 ──────────────────────────────────
+# ── Patch: normalize Mistral citation chunks before AG2's message parser sees them ──
+# Mistral's grounding/web-search feature returns AssistantMessage.content as
+# list[TextChunk | ReferenceChunk] instead of a plain str. AG2's ChatCompletionMessage
+# expects str | dict | list[dict] | None, so passing Pydantic objects causes validation
+# errors. We replace the ChatCompletionMessage name in autogen.oai.mistral's module
+# namespace with a factory that flattens the list to a string first.
+import autogen.oai.mistral as _mistral_module
+from autogen.oai.oai_models import ChatCompletionMessage as _RealCCM
+from mistralai.client.models import TextChunk as _TextChunk
+
+
+def _normalize_mistral_content(content):
+    if not isinstance(content, list):
+        return content
+    return "".join(
+        chunk.text if isinstance(chunk, _TextChunk) else
+        (chunk.text if hasattr(chunk, "text") else "")
+        for chunk in content
+    )
+
+
+def _CCMFactory(**kwargs):
+    content = kwargs.get("content")
+    if isinstance(content, list):
+        kwargs["content"] = _normalize_mistral_content(content)
+    return _RealCCM(**kwargs)
+
+
+_mistral_module.ChatCompletionMessage = _CCMFactory
+# ── End patch ──────────────────────────────────────────────────────────────────
+
 
 def build_llm_config() -> LLMConfig:
-    api_key = os.getenv("OPENAI_API_KEY", "")
+    """Builds the AG2 LLMConfig for Mistral Small 4 using AG2's native Mistral client."""
+    api_key = os.getenv("MISTRAL_API_KEY", "")
     if not api_key:
-        raise ValueError("OPENAI_API_KEY is not set. Add it to .env or the sidebar.")
+        raise ValueError("MISTRAL_API_KEY is not set. Add it to .env or the sidebar.")
     return LLMConfig(
-        {"model": os.getenv("LLM_MODEL", "gpt-4o-mini"),
-         "api_key": api_key,
-         "base_url": os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")},
+        {"api_type": "mistral",
+         "model": os.getenv("LLM_MODEL", "mistral-small-latest"),
+         "api_key": api_key},
         temperature=0.3,
         cache_seed=None,  # always fetch fresh data
     )
 
 
 def run_research(topic: str) -> str:
+    """Runs the researcher, analyst, and writer agents and returns the final report.
+
+    Tool calls are confined to an isolated researcher/executor exchange, separate from
+    the analyst/writer GroupChat. Mistral's API rejects message histories where the
+    number of function calls and responses don't match, which happens when GroupChat's
+    "auto" speaker selection asks the LLM who should speak next while a tool call from
+    researcher is still awaiting its response from executor.
+    """
     llm_config = build_llm_config()
 
     # ── Agents ─────────────────────────────────────────────────────────────────
 
     researcher = AssistantAgent(
         name="researcher",
-        system_message="""You are a research specialist. Your job is to gather
-comprehensive information about the given topic using web_search and fetch_page_content.
-Perform at least 3 searches and fetch content from 2+ pages.
-Summarise all findings clearly. End with: RESEARCH COMPLETE.""",
+        system_message="""You are a research specialist. Search for information about the given topic using web_search.
+Perform exactly 2 searches, then summarise the findings clearly. End with: RESEARCH COMPLETE.""",
         llm_config=llm_config,
     )
 
@@ -63,7 +101,9 @@ def run_research(topic: str) -> str:
         name="executor",
         human_input_mode="NEVER",
         code_execution_config={"work_dir": "workspac
```

**File**: `ai_agents/multi_agent_research_assistant_ag2/tests/test_agent_setup.py` (modified, +2/-2)
```diff
@@ -1,6 +1,6 @@
 import os
 import pytest
-os.environ.setdefault("OPENAI_API_KEY", "test-key-no-llm-calls")
+os.environ.setdefault("MISTRAL_API_KEY", "test-key-no-llm-calls")
 
 def test_agents_instantiate():
     """Verify agent setup does not raise — no LLM calls made."""
@@ -34,7 +34,7 @@ def test_tool_registration():
     from tools.research_tools import web_search, fetch_page_content
     from autogen import AssistantAgent, UserProxyAgent, LLMConfig, register_function
 
-    llm = LLMConfig({"model": "gpt-4o-mini", "api_key": "test"})
+    llm = LLMConfig({"api_type": "mistral", "model": "mistral-small-latest", "api_key": "test"})
     researcher = AssistantAgent(name="r", system_message="test", llm_config=llm)
     executor = UserProxyAgent(name="e", human_input_mode="NEVER", code_execution_config=False)
     for fn in (web_search, fetch_page_content):
```

---

### Incident Patch 5: `f4b5b370` (2026-06-20)
**Commit Message**: audit: fix multi_agent_research_assistant_ag2 - swap to Mistral via native AG2 integration, fix UI layout, add docstrings, rewrite em dashes

**File**: `ai_agents/multi_agent_research_assistant_ag2/.env.example` (modified, +4/-3)
```diff
@@ -1,3 +1,4 @@
-OPENAI_API_KEY=your_openai_api_key_here
-OPENAI_BASE_URL=https://api.openai.com/v1   # override for SambaNova, Azure, etc.
-LLM_MODEL=gpt-4o-mini
+# Mistral API key used by the researcher, analyst, and writer agents (Mistral Small 4).
+# Get one at https://console.mistral.ai/api-keys
+MISTRAL_API_KEY=your_mistral_api_key_here
+LLM_MODEL=mistral-small-latest
```

**File**: `ai_agents/multi_agent_research_assistant_ag2/README.md` (modified, +22/-11)
```diff
@@ -1,25 +1,31 @@
+<a id="top"></a>
+
 # Multi-Agent Research Assistant with AG2
 
 A production-grade multi-agent research pipeline using [AG2](https://github.com/ag2ai/ag2)
-(formerly AutoGen). Three specialists collaborate under GroupChat with LLM-driven speaker
-selection to research any topic and produce a structured Markdown report.
+(formerly AutoGen). Three specialists collaborate under GroupChat to research any topic
+and produce a structured Markdown report, powered by Mistral Small 4
+(`mistral-small-latest`) via AG2's native Mistral integration.
 
 ## Features
 - Multi-agent collaboration (researcher, analyst, writer) under GroupChat
-- LLM-driven dynamic speaker selection — no hardcoded turn order
 - AG2's `register_function(caller=, executor=)` tool registration pattern
-- OpenAI-compatible endpoint (works with SambaNova, Azure OpenAI, local models via Ollama)
+- Native Mistral support via AG2's `api_type: "mistral"` config entry
 - Download report as Markdown
 
+## Demo
+
+![Demo](assets/demo.gif)
+
 ## Prerequisites
 - Python 3.10+
-- OpenAI API key (or compatible endpoint)
+- Mistral API key from [console.mistral.ai](https://console.mistral.ai/api-keys)
 
 ## Installation
 ```bash
 cd multi_agent_research_assistant_ag2
 pip install -r requirements.txt
-cp .env.example .env  # add your API key
+cp .env.example .env  # add your Mistral API key
 ```
 
 ## Usage
@@ -32,20 +38,21 @@ streamlit run research_assistant.py
 1. **Researcher** searches the web using DuckDuckGo API and summarises findings
 2. **Analyst** critically reviews the research and identifies gaps
 3. **Writer** synthesises all inputs into a structured Markdown report
-4. **GroupChatManager** uses LLM-based speaker selection to orchestrate the conversation
+4. **GroupChatManager** orchestrates the analyst and writer in round-robin order
 
 ## AG2 Concepts Demonstrated
-- `GroupChat` with `speaker_selection_method="auto"`
-- `register_function(caller=, executor=)` — separates tool description from execution
-- `UserProxyAgent` with `code_execution_config` — built-in code execution sandbox
+- `GroupChat` with `speaker_selection_method="round_robin"`
+- `register_function(caller=, executor=)`, which separates tool description from execution
+- `UserProxyAgent` with `code_execution_config`, providing a built-in code execution sandbox
+- Native Mistral integration via `{"api_type": "mistral", "model": "mistral-small-latest", ...}` in `LLMConfig`, instead of pointing an OpenAI-compatible `base_url` at Mistral's endpoint
 
 > **Security note:** `use_docker=False` in `code_execution_config` means any agent-generated
 > code runs directly in your process. For production use, set `use_docker=True` or run in
 > an isolated environment.
 
 ## Running Tests
 
-Tests are fully mocked — no API keys or network access required.
+Tests are fully mocked and require no API keys or network access.
 
 ```bash
 pip install pytest
@@ -66,3 +73,7 @@ multi_agent_research_assistant_ag2/
 ├── requirements.txt
 └── .env.example
 ```
+
+---
+
+[Back to top](#top)
```

**File**: `ai_agents/multi_agent_research_assistant_ag2/requirements.txt` (modified, +1/-0)
```diff
@@ -1,3 +1,4 @@
 ag2>=0.11.0
+mistralai>=2.0.0
 streamlit>=1.31.0
 python-dotenv>=1.0.0
```

**File**: `ai_agents/multi_agent_research_assistant_ag2/research_assistant.py` (modified, +80/-30)
```diff
@@ -1,4 +1,5 @@
-# research_assistant.py
+"""Multi-agent research pipeline using AG2 (AutoGen): researcher, analyst, and writer
+agents collaborate under GroupChat, powered by Mistral Small 4, with a Streamlit UI."""
 import os
 import streamlit as st
 from datetime import datetime
@@ -9,32 +10,69 @@
 
 load_dotenv()
 
-# ── AG2 (formerly AutoGen) requires ag2>=0.11 ──────────────────────────────────
+# ── Patch: normalize Mistral citation chunks before AG2's message parser sees them ──
+# Mistral's grounding/web-search feature returns AssistantMessage.content as
+# list[TextChunk | ReferenceChunk] instead of a plain str. AG2's ChatCompletionMessage
+# expects str | dict | list[dict] | None, so passing Pydantic objects causes validation
+# errors. We replace the ChatCompletionMessage name in autogen.oai.mistral's module
+# namespace with a factory that flattens the list to a string first.
+import autogen.oai.mistral as _mistral_module
+from autogen.oai.oai_models import ChatCompletionMessage as _RealCCM
+from mistralai.client.models import TextChunk as _TextChunk
+
+
+def _normalize_mistral_content(content):
+    if not isinstance(content, list):
+        return content
+    return "".join(
+        chunk.text if isinstance(chunk, _TextChunk) else
+        (chunk.text if hasattr(chunk, "text") else "")
+        for chunk in content
+    )
+
+
+def _CCMFactory(**kwargs):
+    content = kwargs.get("content")
+    if isinstance(content, list):
+        kwargs["content"] = _normalize_mistral_content(content)
+    return _RealCCM(**kwargs)
+
+
+_mistral_module.ChatCompletionMessage = _CCMFactory
+# ── End patch ──────────────────────────────────────────────────────────────────
+
 
 def build_llm_config() -> LLMConfig:
-    api_key = os.getenv("OPENAI_API_KEY", "")
+    """Builds the AG2 LLMConfig for Mistral Small 4 using AG2's native Mistral client."""
+    api_key = os.getenv("MISTRAL_API_KEY", "")
     if not api_key:
-        raise ValueError("OPENAI_API_KEY is not set. Add it to .env or the sidebar.")
+        raise ValueError("MISTRAL_API_KEY is not set. Add it to .env or the sidebar.")
     return LLMConfig(
-        {"model": os.getenv("LLM_MODEL", "gpt-4o-mini"),
-         "api_key": api_key,
-         "base_url": os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")},
+        {"api_type": "mistral",
+         "model": os.getenv("LLM_MODEL", "mistral-small-latest"),
+         "api_key": api_key},
         temperature=0.3,
         cache_seed=None,  # always fetch fresh data
     )
 
 
 def run_research(topic: str) -> str:
+    """Runs the researcher, analyst, and writer agents and returns the final report.
+
+    Tool calls are confined to an isolated researcher/executor exchange, separate from
+    the analyst/writer GroupChat. Mistral's API rejects message histories where the
+    number of function calls and responses don't match, which happens when GroupChat's
+    "auto" speaker selection asks the LLM who should speak next while a tool call from
+    researcher is still awaiting its response from executor.
+    """
     llm_config = build_llm_config()
 
     # ── Agents ─────────────────────────────────────────────────────────────────
 
     researcher = AssistantAgent(
         name="researcher",
-        system_message="""You are a research specialist. Your job is to gather
-comprehensive information about the given topic using web_search and fetch_page_content.
-Perform at least 3 searches and fetch content from 2+ pages.
-Summarise all findings clearly. End with: RESEARCH COMPLETE.""",
+        system_message="""You are a research specialist. Search for information about the given topic using web_search.
+Perform exactly 2 searches, then summarise the findings clearly. End with: RESEARCH COMPLETE.""",
         llm_config=llm_config,
     )
 
@@ -63,7 +101,9 @@ def run_research(topic: str) -> str:
         name="executor",
         human_input_mode="NEVER",
         code_execution_config={"work_dir": "workspac
```

**File**: `ai_agents/multi_agent_research_assistant_ag2/tests/test_agent_setup.py` (modified, +2/-2)
```diff
@@ -1,6 +1,6 @@
 import os
 import pytest
-os.environ.setdefault("OPENAI_API_KEY", "test-key-no-llm-calls")
+os.environ.setdefault("MISTRAL_API_KEY", "test-key-no-llm-calls")
 
 def test_agents_instantiate():
     """Verify agent setup does not raise — no LLM calls made."""
@@ -34,7 +34,7 @@ def test_tool_registration():
     from tools.research_tools import web_search, fetch_page_content
     from autogen import AssistantAgent, UserProxyAgent, LLMConfig, register_function
 
-    llm = LLMConfig({"model": "gpt-4o-mini", "api_key": "test"})
+    llm = LLMConfig({"api_type": "mistral", "model": "mistral-small-latest", "api_key": "test"})
     researcher = AssistantAgent(name="r", system_message="test", llm_config=llm)
     executor = UserProxyAgent(name="e", human_input_mode="NEVER", code_execution_config=False)
     for fn in (web_search, fetch_page_content):
```

---

### Incident Patch 6: `196c7d90` (2026-06-19)
**Commit Message**: audit: fix eagle_eye - add Prerequisites section with credential links, add Demo section, add back-to-top link

**File**: `ai_agents/eagle_eye/README.md` (modified, +20/-0)
```diff
@@ -1,9 +1,25 @@
+<a id="top"></a>
+
 # 🦅 Eagle Eye
 
 AI-powered GitHub PR review agent using [OpenClaw](https://openclaw.dev), MiniMax M2.7, and GitHub MCP. Triggered via Telegram.
 
 ---
 
+## ✅ Prerequisites
+
+- [OpenClaw](https://openclaw.dev) installed
+- A Telegram bot, created via [@BotFather](https://t.me/BotFather)
+- A GitHub Personal Access Token with repo and pull request scopes, created at [GitHub's token settings page](https://github.com/settings/tokens)
+
+---
+
+## 📸 Demo
+
+![Eagle Eye demo](assets/demo.png)
+
+---
+
 ## 📽️ Project Overview
 
 **Eagle Eye** is a Telegram-triggered code review assistant that analyzes GitHub pull requests and delivers structured feedback directly to your chat. 
@@ -97,3 +113,7 @@ The agent will respond with the review and a prompt:
 - **Scope**: Does not see CI/CD logs or test results unless pasted into the chat.
 - **Large PRs**: For very large changes, the agent prioritizes security and correctness.
 - **Stateless**: Each Telegram session starts fresh; previous review context is not retained unless manually provided.
+
+---
+
+[Back to top](#top)
```

---

### Incident Patch 7: `2a68537c` (2026-06-19)
**Commit Message**: audit: fix daily-news-digest - add env comments, rewrite em dashes throughout README and skill.py, add architecture diagram reference

**File**: `ai_agents/daily-news-digest/.env.example` (modified, +7/-0)
```diff
@@ -1,3 +1,10 @@
+# MiniMax API key used to score and rank articles by significance.
+# Get one at https://platform.minimax.io
 MINIMAX_API_KEY=your_minimax_api_key_here
+
+# Telegram bot token used to send the daily digest message.
+# Create a bot and get a token from @BotFather on Telegram: https://t.me/BotFather
 TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
+
+# ID of the Telegram chat or channel the digest should be delivered to.
 TELEGRAM_CHAT_ID=your_telegram_chat_id_here
```

**File**: `ai_agents/daily-news-digest/README.md` (modified, +24/-16)
```diff
@@ -2,6 +2,14 @@
 
 Automated daily digest from 92 Karpathy-curated tech blogs, delivered to Telegram at 8 AM every morning. MiniMax M2.7 scores every article fetched in the last 24 hours and picks the 3 most significant stories.
 
+## Architecture
+
+![Architecture diagram](docs/architecture.svg)
+
+## Demo
+
+![Daily AI Digest demo](assets/demo.png)
+
 ## How it works
 
 ```text
@@ -10,7 +18,7 @@ Automated daily digest from 92 Karpathy-curated tech blogs, delivered to Telegra
 
 1. `scripts/fetch_rss.py` fetches all feeds in parallel and keeps only articles published in the last 24 hours
 2. `skill.py` sends the article list to MiniMax M2.7, which scores each one and returns the top 3 as structured JSON
-3. Articles are grouped into categories — **Breaking**, **Important**, or **Notable** — and formatted as a Telegram message
+3. Articles are grouped into categories (**Breaking**, **Important**, or **Notable**) and formatted as a Telegram message
 4. Empty categories are omitted automatically
 
 
@@ -23,13 +31,13 @@ Automated daily digest from 92 Karpathy-curated tech blogs, delivered to Telegra
 
 ## Tech Stack
 **Models & Frameworks:**
-- MiniMax M2.7 — article scoring and ranking
-- OpenClaw — skill orchestration and cron scheduling
+- MiniMax M2.7: article scoring and ranking
+- OpenClaw: skill orchestration and cron scheduling
 
 **Libraries:**
-- `feedparser` — RSS feed parsing
-- `python-dotenv` — environment variable management
-- `requests` — HTTP requests for RSS feed fetching
+- `feedparser`: RSS feed parsing
+- `python-dotenv`: environment variable management
+- `requests`: HTTP requests for RSS feed fetching
 
 
 ## Prerequisites
@@ -101,7 +109,7 @@ cp -r . ~/.openclaw/skills/daily-ai-news-digest
 openclaw cron add "0 8 * * *" skill.py
 ```
 
-This schedules the digest to run every day at **08:00 UTC**. Adjust the cron expression to change the time — for example `"0 7 * * 1-5"` for weekdays at 07:00 UTC.
+This schedules the digest to run every day at **08:00 UTC**. Adjust the cron expression to change the time. For example, `"0 7 * * 1-5"` schedules it for weekdays at 07:00 UTC.
 
 ## Running manually
 
@@ -112,26 +120,26 @@ python skill.py
 ## Output format
 
 ```text
-🗞️ Daily AI Digest — April 1, 2026
+🗞️ Daily AI Digest: April 1, 2026
 
 🔴 BREAKING
-🔴 Article Title — Summary sentence one. Sentence two.
+🔴 Article Title: Summary sentence one. Sentence two.
 Source: Blog Name | [Read more](https://...)
 
 🟡 IMPORTANT
-🟡 Article Title — Summary sentence one. Sentence two.
+🟡 Article Title: Summary sentence one. Sentence two.
 Source: Blog Name | [Read more](https://...)
 
 🔵 NOTABLE
-🔵 Article Title — Summary sentence one. Sentence two.
+🔵 Article Title: Summary sentence one. Sentence two.
 Source: Blog Name | [Read more](https://...)
 ```
 
 ## Project structure
 
 ```text
 daily-ai-news-digest/
-├── skill.py              # Main pipeline — fetch, score, format, send
+├── skill.py              # Main pipeline: fetch, score, format, send
 ├── scripts/
 │   └── fetch_rss.py      # Parallel RSS fetcher with 24h date filter
 ├── sources.json          # 92 Karpathy-curated RSS feed sources
@@ -143,10 +151,10 @@ daily-ai-news-digest/
 
 ## Customisation
 
-**Change the number of top articles** — edit the system prompt in `skill.py` and update the instruction from "top 3" to your preferred number.
+**Change the number of top articles**: edit the system prompt in `skill.py` and update the instruction from "top 3" to your preferred number.
 
-**Change the lookback window** — the `--hours` argument in `fetch_articles()` defaults to 24. Pass a different value to cast a wider or narrower net.
+**Change the lookback window**: the `--hours` argument in `fetch_articles()` defaults to 24. Pass a different value to cast a wider or narrower net.
 
-**Add or remove sources** — edit `sources.json`. Each entry needs a `name`, `xmlUrl` (the feed URL), and `htmlUrl` (the site URL).
+**Add or remove sources**: edit `sources
```

**File**: `ai_agents/daily-news-digest/skill.py` (modified, +2/-2)
```diff
@@ -175,7 +175,7 @@ def escape_md(text: str) -> str:
     cat = article.get("category", "Notable")
     grouped.setdefault(cat, []).append(article)
 
-message_parts = [f"🗞️ *Daily AI Digest — {today}*"]
+message_parts = [f"🗞️ *Daily AI Digest: {today}*"]
 
 for cat in CATEGORY_ORDER:
     if cat not in grouped:
@@ -189,7 +189,7 @@ def escape_md(text: str) -> str:
         source = art["source"]
         url = art["url"]
         message_parts.append(
-            f"{emoji} *{title}* — {summary}\n"
+            f"{emoji} *{title}*: {summary}\n"
             f"Source: {source} | [Read more]({url})"
         )
 
```

---

### Incident Patch 8: `7fa8d17b` (2026-06-19)
**Commit Message**: audit: fix finagent - swap Gemini for Mistral Small 4, fix load_dotenv bug, add docstrings, fix broken README example

**File**: `ai_agents/finagent/.env.example` (modified, +7/-1)
```diff
@@ -1 +1,7 @@
-OPENAI_API_KEY=your_openai_api_key_here
+# Mistral API key for the Mistral Small 4 (mistral-small-latest) model used by the financial analysis agents.
+# Get one at https://console.mistral.ai/api-keys
+MISTRAL_API_KEY=your_mistral_api_key_here
+
+# Optional: Firecrawl API key used for enhanced news scraping features.
+# Get one at https://firecrawl.dev
+FIRECRAWL_API_KEY=your_firecrawl_api_key_here
```

**File**: `ai_agents/finagent/README.md` (modified, +16/-17)
```diff
@@ -1,6 +1,10 @@
 # Finagent - AI-Powered Financial Analysis Tool
 
-A sophisticated financial analysis system that leverages Google's Gemini AI and real-time market data to provide comprehensive stock analysis, automated code generation, and investment insights.
+A sophisticated financial analysis system that leverages Mistral Small 4 (mistral-small-latest) and real-time market data to provide comprehensive stock analysis, automated code generation, and investment insights.
+
+## Demo
+
+![Finagent demo](assets/demo.gif)
 
 ## Features
 
@@ -9,13 +13,12 @@ A sophisticated financial analysis system that leverages Google's Gemini AI and
 - **Automated Code Generation**: Creates executable Python code for financial analysis
 - **News Integration**: Incorporates latest market news into analysis
 - **MCP Server**: Modern Model Context Protocol server for Claude Desktop integration
-- **Professional Visualizations**: Generates matplotlib charts and technical analysis plots
 - **Risk Assessment**: Provides balanced investment recommendations with proper disclaimers
 
 ## Prerequisites
 
 - Python 3.8+
-- Google Gemini API key
+- Mistral API key (for the Mistral Small 4 / mistral-small-latest model)
 - Claude Desktop (for MCP integration)
 - Firecrawl API key (optional, for enhanced news features)
 
@@ -44,22 +47,22 @@ cd finagent
 2. **Install required packages**:
 
 ```bash
-pip install google-generativeai yfinance pandas matplotlib numpy mcp python-dotenv
+pip install -r requirements.txt
 ```
 
 3. **Set up environment variables**:
    Create a `.env` file in the project root:
 
 ```env
-GEMINI_API_KEY=your_gemini_api_key_here
+MISTRAL_API_KEY=your_mistral_api_key_here
 FIRECRAWL_API_KEY=your_firecrawl_api_key_here  # Optional
 ```
 
 ## API Keys Setup
 
-### Gemini API Key (Required)
+### Mistral API Key (Required)
 
-1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
+1. Visit [Mistral Console](https://console.mistral.ai/api-keys)
 2. Create a new API key
 3. Add it to your `.env` file
 
@@ -96,7 +99,7 @@ FIRECRAWL_API_KEY=your_firecrawl_api_key_here  # Optional
          "command": "python",
          "args": ["/absolute/path/to/finagent/main.py"],
          "env": {
-           "GEMINI_API_KEY": "your_gemini_api_key_here",
+           "MISTRAL_API_KEY": "your_mistral_api_key_here",
            "FIRECRAWL_API_KEY": "your_firecrawl_api_key_here"
          }
        }
@@ -167,15 +170,12 @@ python main.py
 from financial_agents import FinancialAnalysisTeam
 
 team = FinancialAnalysisTeam(
-    gemini_api_key="your_gemini_key",
-    firecrawl_api_key="your_firecrawl_key"
+    mistral_api_key="your_mistral_key"
 )
 
 result = team.analyze("Analyze Apple stock over the last 6 months")
 
-print(f"Insights: {result.insights}")
-print(f"Recommendations: {result.recommendations}")
-print(f"Generated Code:\n{result.code}")
+print(result)
 ```
 
 ## Example Queries
@@ -193,7 +193,7 @@ The system understands natural language queries:
 ### Core Components
 
 1. **FinancialAnalysisTeam**: Main orchestrator class
-2. **GeminiAgent**: Base agent class using Gemini AI
+2. **MistralAgent**: Base agent class using Mistral Small 4 (mistral-small-latest)
 3. **FinancialTools**: Data acquisition utilities
 4. **MCP Server**: Model Context Protocol server for Claude Desktop
 
@@ -208,7 +208,6 @@ The system understands natural language queries:
 - **Technical Indicators**: RSI, MACD, Moving averages, Bollinger bands
 - **Price Analysis**: Trend analysis, support/resistance levels
 - **Risk Metrics**: Volatility calculations, drawdown analysis
-- **Visualizations**: Professional charts with technical overlays
 - **News Integration**: Latest market sentiment and news impact
 - **Investment Recommendations**: Buy/Hold/Sell with rationale
 
@@ -233,7 +232,7 @@ The system understands natural language queries:
 2. **Import Errors**:
 
 ```bash
-pip install google-generativeai yfinance pandas mcp python-dotenv
+pip install -r requirements.t
```

**File**: `ai_agents/finagent/financial_agents.py` (modified, +62/-17)
```diff
@@ -1,10 +1,16 @@
+"""Multi-agent financial analysis pipeline built on Mistral Small 4 and Yahoo Finance market data."""
+
 import os
 import re
 import json
 import yfinance as yf
-import google.generativeai as genai
+from dotenv import load_dotenv
+from mistralai.client import Mistral
+
+load_dotenv()
 
 def _normalize_period(period: str) -> str:
+    """Normalizes a user-supplied time period string into a yfinance-compatible period code."""
     if not period:
         return '6mo'
     p = str(period).strip().lower()
@@ -17,45 +23,78 @@ def _normalize_period(period: str) -> str:
     return p
 
 
-class GeminiAgent:
+def _summarize_stock_data(stock_data) -> str:
+    """Builds a compact text summary of real OHLCV price data to ground the analysis prompt."""
+    first = stock_data.iloc[0]
+    latest = stock_data.iloc[-1]
+    start_price = float(first['Close'])
+    end_price = float(latest['Close'])
+    pct_change = ((end_price - start_price) / start_price) * 100 if start_price else 0.0
+    period_high = float(stock_data['High'].max())
+    period_low = float(stock_data['Low'].min())
+    first_date = stock_data.index[0].strftime('%Y-%m-%d')
+    latest_date = stock_data.index[-1].strftime('%Y-%m-%d')
+
+    return (
+        f"Data range: {first_date} to {latest_date}\n"
+        f"Starting close: {start_price:.2f}\n"
+        f"Latest close: {end_price:.2f}\n"
+        f"Change over period: {pct_change:.2f}%\n"
+        f"Period high: {period_high:.2f}\n"
+        f"Period low: {period_low:.2f}\n"
+        f"Latest volume: {int(latest['Volume'])}"
+    )
+
+
+class MistralAgent:
+    """Wraps a single Mistral Small 4 chat role with its own system prompt."""
+
     def __init__(self, api_key: str, role: str, system_prompt: str):
-        genai.configure(api_key=api_key)
-        self.model = genai.GenerativeModel('gemini-2.5-flash')
+        self.client = Mistral(api_key=api_key)
+        self.model = 'mistral-small-latest'
         self.role = role
         self.system_prompt = system_prompt
 
     def generate(self, prompt: str) -> str:
         full_prompt = f"{self.system_prompt}\n\nUser Request: {prompt}"
-        response = self.model.generate_content(full_prompt)
-        return response.text
+        response = self.client.chat.complete(
+            model=self.model,
+            messages=[{"role": "user", "content": full_prompt}],
+        )
+        return response.choices[0].message.content
 
 
 class FinancialTools:
+    """Provides access to the market data needed by the analysis agents."""
+
     def get_stock_data(self, symbol: str, period: str = "6mo"):
         ticker = yf.Ticker(symbol)
         return ticker.history(period=period)
 
 
 class FinancialAnalysisTeam:
-    def __init__(self, gemini_api_key: str):
+    """Coordinates the query parser and market analyst agents to produce a stock analysis."""
+
+    def __init__(self, mistral_api_key: str):
         self.tools = FinancialTools()
-        self.query_parser = GeminiAgent(
-            gemini_api_key,
+        self.query_parser = MistralAgent(
+            mistral_api_key,
             "Query Parser",
             """You are a financial query parser. Extract from the user query:
 - Stock symbol (ticker)
 - Analysis type (technical, fundamental, comprehensive)
 - Time period (like 1d, 1mo, 6mo, 1y)
 Return a JSON object with keys: symbol, analysis_type, time_period."""
         )
-        self.market_analyst = GeminiAgent(
-            gemini_api_key,
+        self.market_analyst = MistralAgent(
+            mistral_api_key,
             "Market Analyst",
             """You are a senior financial analyst. Provide a clear, professional, and actionable analysis for the stock.
 Include market trends, price action, risk assessment and investment recommendations."""
         )
 
     def parse_query(self, query: str):
+        """Parses a natural language query into a symbol, analysis type, and time period."""
         response = self.query_parse
```

**File**: `ai_agents/finagent/main.py` (modified, +4/-0)
```diff
@@ -1,6 +1,10 @@
+"""MCP server exposing the financial stock analysis tools backed by Mistral Small 4."""
+
+from dotenv import load_dotenv
 from mcp.server.fastmcp import FastMCP
 from financial_agents import run_financial_analysis
 
+load_dotenv()
 
 # Create FastMCP instance
 mcp = FastMCP("financial-analyst")
```

**File**: `ai_agents/finagent/requirements.txt` (modified, +1/-4)
```diff
@@ -1,7 +1,4 @@
-google-generativeai>=0.3.0
+mistralai>=1.0.0
 mcp>=0.1.0
 yfinance>=0.2.18
-pandas>=1.5.0
-numpy>=1.21.0
-matplotlib>=3.5.0
 python-dotenv>=0.19.0
\ No newline at end of file
```

---

### Incident Patch 9: `47e6aaa8` (2026-06-19)
**Commit Message**: audit: fix ai_travel_planning_agent - add env comments, rewrite em dashes, add docstring, fix retry/cleanup bug, switch to GA model, add demo

**File**: `ai_agents/ai_travel_planning_agent/.env.example` (modified, +5/-0)
```diff
@@ -1,2 +1,7 @@
+# Google AI Studio API key used to authenticate Gemini requests for all agents.
+# Get one at https://aistudio.google.com/app/apikey
 GOOGLE_API_KEY=your_google_api_key_here
+
+# Tavily API key used for real-time web search by the flight, hotel, and itinerary agents.
+# Get one at https://app.tavily.com
 TAVILY_API_KEY=your_tavily_api_key_here
```

**File**: `ai_agents/ai_travel_planning_agent/README.md` (modified, +13/-4)
```diff
@@ -1,25 +1,30 @@
+<a id="top"></a>
 # AI Travel Planning Agent
 
 > Multi-agent travel planner that turns a single natural language request into a complete trip plan with flights, hotels, and a day-by-day itinerary.
 
+## Demo
+
+![Demo](assets/demo.png)
+
 ## Overview
 
-The AI Travel Planning Agent uses a root Google ADK agent to coordinate three specialist sub-agents — Flight Agent, Hotel Agent, and Itinerary Agent. Each sub-agent independently searches the web in real time, and the root agent combines their results into one cohesive travel plan. Users interact through a Streamlit chat interface and can ask follow-up questions within the same conversational session.
+The AI Travel Planning Agent uses a root Google ADK agent to coordinate three specialist sub-agents: a Flight Agent, a Hotel Agent, and an Itinerary Agent. Each sub-agent independently searches the web in real time, and the root agent combines their results into one cohesive travel plan. Users interact through a Streamlit chat interface and can ask follow-up questions within the same conversational session.
 
 ## Features
 
 - Natural language trip planning in a conversational chat UI
 - Parallel specialist agents for flights, hotels, and itineraries
 - Real-time web search via Tavily on every query
 - Nearby place discovery using OpenStreetMap/Nominatim (no extra API key)
-- Multi-turn conversation — ask follow-ups after the initial plan
+- Multi-turn conversation, so you can ask follow-ups after the initial plan
 
 ## Tech Stack
 
 | Layer | Technology |
 |---|---|
 | Agent framework | Google ADK (`google-adk`) |
-| LLM | Gemini 3 Flash (`gemini-3-flash-preview`) |
+| LLM | Gemini 3.5 Flash (`gemini-3.5-flash`) |
 | Web search | Tavily Search API |
 | Location data | geopy + Nominatim (OpenStreetMap) |
 | UI | Streamlit |
@@ -112,5 +117,9 @@ ai-travel-planning-agent/
 ├── tools.py            # Tavily search and Nominatim location tools
 ├── requirements.txt    # Python dependencies
 ├── .env.example        # Environment variable template
-└── .env                # Your local API keys (git-ignored)
+├── .env                # Your local API keys (git-ignored)
+└── assets/
+    └── demo.png         # Demo screenshot
 ```
+
+[Back to top](#top)
```

**File**: `ai_agents/ai_travel_planning_agent/agents.py` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@
 from google.adk.tools.agent_tool import AgentTool
 from tools import tavily_search, find_nearby_places
 
-MODEL = "gemini-3-flash-preview"
+MODEL = "gemini-3.5-flash"
 
 # ---------------------------------------------------------------------------
 # Specialist sub-agents
```

**File**: `ai_agents/ai_travel_planning_agent/app.py` (modified, +79/-10)
```diff
@@ -1,18 +1,30 @@
+"""Streamlit chat app that coordinates flight, hotel, and itinerary agents into one travel plan."""
 import os
 import asyncio
+import logging
 import uuid
 
 # Load .env before any ADK/Google imports so API keys are available
 from dotenv import load_dotenv
 load_dotenv()
 
+# ADK logs the full traceback for every transient model error (even ones it
+# or our own retry logic recovers from). We surface failures via the UI
+# instead, so quiet this logger to keep the terminal readable.
+logging.getLogger("google_adk").setLevel(logging.CRITICAL)
+
+_TRANSIENT_ERROR_MARKERS = ("503", "UNAVAILABLE", "high demand")
+_QUOTA_ERROR_MARKERS = ("429", "RESOURCE_EXHAUSTED")
+_QUOTA_RETRY_DELAY_SECONDS = 8
+
 import nest_asyncio
 nest_asyncio.apply()  # Allow asyncio.run() inside Streamlit's existing event loop
 
 import streamlit as st
 from google.adk.runners import Runner
 from google.adk.sessions import InMemorySessionService
 from google.genai import types
+from google.genai.errors import ServerError
 
 from agents import root_agent
 
@@ -96,23 +108,76 @@
 # Agent runner helper
 # ---------------------------------------------------------------------------
 
+def _is_transient_error(message: str) -> bool:
+    """Check whether an error message looks like a temporary model-overload error."""
+    return any(marker in message for marker in _TRANSIENT_ERROR_MARKERS)
+
+
+def _is_quota_error(message: str) -> bool:
+    """Check whether an error message looks like a 429 quota/rate-limit error."""
+    return any(marker in message for marker in _QUOTA_ERROR_MARKERS)
+
+
 async def _stream_response(runner: Runner, session_id: str, user_id: str, content: types.Content) -> str:
     """Collect the final response text from a single runner.run_async() call."""
     final_text = ""
-    async for event in runner.run_async(
+    agen = runner.run_async(
         session_id=session_id,
         user_id=user_id,
         new_message=content,
-    ):
-        if event.is_final_response():
-            if event.content and event.content.parts:
-                final_text = "\n".join(
-                    part.text for part in event.content.parts if hasattr(part, "text")
-                )
-            break
+    )
+    try:
+        async for event in agen:
+            # Some failures surface as an error event on the stream rather than
+            # a raised exception, so check for that before looking for the final response.
+            if getattr(event, "error_code", None):
+                raise RuntimeError(event.error_message or event.error_code)
+            if event.is_final_response():
+                if event.content and event.content.parts:
+                    final_text = "\n".join(
+                        part.text for part in event.content.parts if hasattr(part, "text")
+                    )
+                break
+    finally:
+        # Close the generator here, in the same task/context it was opened in,
+        # so a retry doesn't start a new one while this one is still mid-teardown
+        # (that's what was producing the GeneratorExit / OpenTelemetry cleanup errors).
+        await agen.aclose()
     return final_text
 
 
+async def _stream_response_with_retry(
+    runner: Runner,
+    session_id: str,
+    user_id: str,
+    content: types.Content,
+    max_attempts: int = 2,
+) -> str:
+    """Call _stream_response, retrying on transient model errors.
+
+    503/UNAVAILABLE overload errors use the existing short exponential backoff.
+    429/RESOURCE_EXHAUSTED quota errors get exactly one retry after a longer delay,
+    since retrying quota errors quickly just makes the exhaustion worse.
+    """
+    quota_retried = False
+    for attempt in range(1, max_attempts + 1):
+        try:
+            return await _stream_response(runner, session_id, user_id, content)
+        except (ServerError, RuntimeError) as e:
+            message = str(e)
+            if _is_quota_error(message):
+                if
```

---

### Incident Patch 10: `af176efc` (2026-06-18)
**Commit Message**: audit: fix competitive_intelligence_agent - fix load_dotenv bug, ANSI codes, clean reasoning log, collapse reasoning panel, add demo, fix pyproject description, fix README checkboxes

**File**: `ai_agents/competitive_intelligence_agent/.env.example` (modified, +2/-0)
```diff
@@ -1,2 +1,4 @@
+# Google AI Studio API key used to access Gemma 4 via the Gemini API. Get yours free at https://aistudio.google.com
 GEMINI_API_KEY=your_gemini_api_key_here
+# Tavily Search API key used for real-time web research by the CrewAI agents. Get yours free at https://tavily.com
 TAVILY_API_KEY=tvly-your_tavily_key_here
\ No newline at end of file
```

**File**: `ai_agents/competitive_intelligence_agent/README.md` (modified, +11/-3)
```diff
@@ -1,12 +1,18 @@
 # Competitive Intelligence Agent
 
+> Generate strategic sales battlecards by analyzing competitors through the unique lens of your own business context.
+
 A multi-agent AI system that generates strategic sales battlecards by analyzing competitors through the unique lens of your own business context.
 
+## Demo
+
+![Demo](assets/demo.png)
+
 ## Overview
 
 The **Competitive Intelligence Agent** solves the "generic research" problem by moving away from broad, impersonal reports. Instead of searching the web for everything about a competitor, this system uses specialized AI agents to analyze a competitor specifically in relation to *your* company's value proposition, your customers' specific pain points, and your strategic sales goals.
 
-It uses **CrewAI** to orchestrate specialized agents—a Market Scout, a Product Strategist, and a Battlecard Author—to research, compare, and synthesize actionable sales intelligence.
+It uses **CrewAI** to orchestrate three specialized agents that research, compare, and synthesize actionable sales intelligence: a Market Scout, a Product Strategist, and a Battlecard Author.
 
 This tool is designed for:
 - **Sales Teams:** Who need immediate, punchy arguments to win against specific competitors.
@@ -40,8 +46,8 @@ Before you begin, ensure you have:
 - Python 3.12 or higher
 - [uv](https://github.com/astral-sh/uv) (Recommended for dependency management)
 - API keys for:
-  - [ ] Google AI Studio (for Gemini/Gemma)
-  - [ ] Tavily Search API
+  - [Google AI Studio](https://aistudio.google.com) for Gemini/Gemma (free tier available)
+  - [Tavily Search API](https://tavily.com) (free tier available)
 
 ## Installation
 
@@ -95,6 +101,8 @@ competitive_intelligence_agent/
 ├── .env.example           # Template for API keys
 ├── pyproject.toml         # uv project configuration
 ├── uv.lock                # Locked dependencies for consistency
+├── assets/
+│   └── demo.png           # Demo screenshot
 └── .venv/                 # Virtual environment (auto-generated)
 ```
 
```

**File**: `ai_agents/competitive_intelligence_agent/agents_logic.py` (modified, +5/-0)
```diff
@@ -1,14 +1,19 @@
+"""CrewAI agent and task definitions for the Competitive Intelligence Agent."""
 import os
+from dotenv import load_dotenv
 from crewai import Agent, Task, Crew, Process, LLM
 from crewai_tools import TavilySearchTool
 
+load_dotenv()
+
 # Gemma 4 via LiteLLM/Gemini API
 gemma_llm = LLM(
     model="gemini/gemma-4-26b-a4b-it",
     api_key=os.getenv("GEMINI_API_KEY")
 )
 
 def get_research_crew(my_company, competitor, pain_point, goal):
+    """Build and return a sequential CrewAI crew configured for the given company context and competitor."""
     # Specialized Tools
     search_tool = TavilySearchTool(api_key=os.getenv("TAVILY_API_KEY"), max_results=3)
 
```

**File**: `ai_agents/competitive_intelligence_agent/main.py` (modified, +26/-6)
```diff
@@ -1,25 +1,44 @@
+"""Gradio UI for the Competitive Intelligence Agent, which generates AI-powered sales battlecards using a CrewAI multi-agent pipeline."""
+import re
 import gradio as gr
 import io
 from contextlib import redirect_stdout
 from agents_logic import get_research_crew
 
+
+def strip_ansi(text: str) -> str:
+    """Remove ANSI color and formatting escape sequences from a string."""
+    return re.sub(r'\x1b\[[0-9;]*m', '', text)
+
+
+def clean_log(raw: str) -> str:
+    """Remove blank lines and decorative separator lines from captured CrewAI stdout."""
+    kept = []
+    for line in raw.splitlines():
+        stripped = line.strip()
+        if stripped and re.search(r'[A-Za-z0-9]', stripped):
+            kept.append(stripped)
+    return '\n'.join(kept)
+
+
 def run_analysis(my_company, competitor, pain_point, goal):
+    """Run the three-agent CrewAI pipeline and return the reasoning log and final battlecard."""
     # Progress logging
     f = io.StringIO()
     with redirect_stdout(f):
         try:
             crew = get_research_crew(my_company, competitor, pain_point, goal)
             result = crew.kickoff(inputs={
-                "my_company": my_company, 
-                "competitor": competitor, 
-                "pain_point": pain_point, 
+                "my_company": my_company,
+                "competitor": competitor,
+                "pain_point": pain_point,
                 "goal": goal
             })
             final_output = result.raw
         except Exception as e:
             final_output = f"Error: {str(e)}"
-            
-    return f.getvalue(), final_output
+
+    return clean_log(strip_ansi(f.getvalue())), final_output
 
 with gr.Blocks(title="Strategic Intel System") as demo:
     gr.Markdown("# ⚔️ Competitive Intelligence Engine")
@@ -34,7 +53,8 @@ def run_analysis(my_company, competitor, pain_point, goal):
             submit_btn = gr.Button("Generate Battlecard", variant="primary")
             
         with gr.Column():
-            logs = gr.Textbox(label="Agent Reasoning Process", lines=10)
+            with gr.Accordion("Agent Reasoning Process", open=False):
+                logs = gr.Textbox(label="Agent Reasoning Process", lines=10)
             output = gr.Markdown(label="Final Battlecard")
 
     submit_btn.click(
```

**File**: `ai_agents/competitive_intelligence_agent/pyproject.toml` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 [project]
 name = "competitive-intelligence-agent"
 version = "0.1.0"
-description = "Add your description here"
+description = "Multi-agent CrewAI system that generates strategic sales battlecards by analyzing competitors against your own business context"
 readme = "README.md"
 requires-python = ">=3.12"
 dependencies = [
```

#### Recent Merged Pull Requests:
- **PR #133** (2026-09-29): Update README.md (@Tiioluwani)
- **PR #132** (2026-09-24): Build local Ollama-powered data analyst with Gradio (@cyberholics)
- **PR #131** (2026-09-24): feat: add Offline Troubleshooting Agent - local AI agent for industrial equipment diagnosis with zero internet dependency (@Tiioluwani)
- **PR #130** (2026-09-19): feat(audio): switch voice agent and follow-up to GLM-5.3-Flash on Tel… (@cyberholics)
- **PR #129** (2026-09-18): feat(audio): add AI appointment booking voice agent (Telnyx Voice AI) (@cyberholics)
- **PR #128** (2026-09-18): feat: add Voice GitHub Agent - voice-controlled agent for GitHub repo triage (@Tiioluwani)
- **PR #127** (2026-09-17): docs: fix stale path and back-to-top anchor in voice agent README (@cyberholics)
- **PR #126** (2026-09-17): feat: add Self-Driving Data Analyst with Liner (@Tiioluwani)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

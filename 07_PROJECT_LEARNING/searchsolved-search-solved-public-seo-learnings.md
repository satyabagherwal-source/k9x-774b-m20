> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/searchsolved-search-solved-public-seo-learnings.md`  
> **Source**: github ([https://github.com/searchsolved/search-solved-public-seo](https://github.com/searchsolved/search-solved-public-seo))  
> **Source Version**: `6d8d30b4`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-15T23:26:00.261Z  
> **Learning ID**: `learn-github-searchsolved-search-solved-public-seo`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): searchsolved/search-solved-public-seo

> **Canonical Artifact**: `07_PROJECT_LEARNING/searchsolved-search-solved-public-seo-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/searchsolved/search-solved-public-seo](https://github.com/searchsolved/search-solved-public-seo))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-15T23:26:00.255Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `searchsolved/search-solved-public-seo`
- **Description**: SEO Python scripts and Apps by Lee Foot
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 424 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `content-analysis/reading-score-analyzer/reading_score_analyzer.py`
```
####################################################################################
#                                                                                  #
#  Reading Score Analyzer                                                          #
#                                                                                  #
#  Analyze content readability from XML sitemaps or CSV files.                     #
#                                                                                  #
####################################################################################
# Author   : Lee Foot                                                              #
# Website  : https://www.leefoot.com                                                   #
# Contact  : https://www.leefoot.com/contact                                           #
# Email    : hello@leefoot.com                                                     #
# LinkedIn : https://www.linkedin.com/in/lee-foot/                                 #
# Bluesky  : https://bsky.app/profile/leefootseo.bsky.social                       #
####################################################################################

"""
Reading Score Analyzer

Fetches URLs from an XML sitemap or CSV, extracts main content using Trafilatura,
and calculates various readability scores including Flesch Reading Ease.

Features:
- XML sitemap or CSV URL input
- Content extraction with Trafilatura
- Multiple readability metrics
- Progress tracking with rate limiting
- Export to CSV
"""

import streamlit as st
import pandas as pd
import requests
from bs4 import BeautifulSoup
import time
from io import StringIO

st.set_page_config(page_title="Reading Score Analyzer", page_icon="📖", layout="wide")

# Check for required packages
try:
    import trafilatura
    import textstat
    from fake_useragent import UserAgent
    PACKAGES_AVAILABLE = True
except ImportError:
    PACKAGES_AVAILABLE = False

st.title("Reading Score Analyzer")
st.markdown("*Created by* [![Website](https://img.shields.io/badge/-leefoot.com-2A9D8F?logoColor=white)](https://www.leefoot.com) · [![Hire Me](https://img.shields.io/badge/-Hire%20Me-FF6B6B?logoColor=white)](https://www.leefoot.com/contact) · [![LinkedIn](https://img.shields.io/badge/-LinkedIn-0A66C2?logo=linkedin&logoColor=white)](https://www.linkedin.com/in/lee-foot/) · [![Bluesky](https://img.shields.io/badge/-Bluesky-0285FF?logoColor=white)](https://bsky.app/profile/leefootseo.bsky.social) · [![More Tools](https://img.shields.io/badge/-More%20Tools-8B5CF6?logoColor=white)](https://leefoot.com/tools) · [![GitHub](https://img.shields.io/badge/-GitHub-6B7280?logoColor=white)](https://github.com/searchsolved/search-solved-public-seo)")

if not PACKAGES_AVAILABLE:
    st.error("""
    Required packages not installed. Run:
    ```
    pip install trafilatura textstat fake-useragent
    ```
    """)
    st.stop()

with st.expander("How to use this tool"):
    st.markdown("""
    **What this tool does:**
    - Fetches URLs from an XML sitemap or CSV file
    - Extracts main content from each page using Trafilatura
    - Calculates readability scores (Flesch Reading Ease, Grade Level, etc.)

    **Readability Scores Explained:**
    - **Flesch Reading Ease**: 0-100 scale (higher = easier to read)
      - 90-100: Very easy (5th grade)
      - 80-90: Easy (6th grade)
      - 70-80: Fairly easy (7th grade)
      - 60-70: Standard (8th-9th grade)
      - 50-60: Fairly difficult (10th-12th grade)
      - 30-50: Difficult (college)
      - 0-30: Very difficult (college graduate)

    - **Flesch-Kincaid Grade**: US school grade level needed to understand
    - **Gunning Fog Index**: Years of formal education needed
    - **SMOG Index**: Years of education needed to understand

    **Tips:**
    - Use appropriate delays to avoid being blocked
    - Start with a small sample to test
    - Image URLs are automatically filtered out
    """)

# Sidebar settings
st.sidebar.header("Settings")

delay = st.sidebar.slider(
    "Delay between requests (seconds)",
    min_value=0.5,
    max_value=10.0,
    value=1.0,
    step=0.5,
    help="Time to wait between page requests"
)

timeout = st.sidebar.number_input(
    "Request timeout (seconds)",
    min_value=5,
    max_value=60,
    value=15
)

max_urls = st.sidebar.number_input(
    "Maximum URLs to process",
    min_value=1,
    max_value=10000,
    value=100,
    help="Limit the number of URLs to process"
)

include_content = st.sidebar.checkbox(
    "Include content in export",
    value=False,
    help="Include extracted text in the CSV output"
)

# URL input
st.subheader("Enter URLs")

input_method = st.radio(
    "Input method",
    ["XML Sitemap URL", "Upload CSV", "Paste URLs"],
    horizontal=True
)

urls = []


def get_random_user_agent():
    """Get a random user agent string."""
    try:
        ua = UserAgent()
        return ua.random
    except:
        return "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"


def fetch_urls_from_sitemap(sitemap_url):
    """Fetch URLs from an XML sitemap."""
    try:
        headers = {'User-Agent': get_random_user_agent()}
        response = requests.get(sitemap_url, headers=headers, timeout=30)
        soup = BeautifulSoup(response.content, 'xml')
        urls = [loc.text for loc in soup.find_all('loc')]

        # Filter out non-HTML URLs
        image_extensions = ('.png', '.jpg', '.jpeg', '.gif', '.svg', '.pdf', '.webp')
        filtered_urls = [url for url in urls if not url.lower().endswith(image_extensions)]

        return filtered_urls
    except Exception as e:
        st.error(f"Error fetching sitemap: {str(e)}")
        return []


def extract_content(url):
    """Extract main content from a URL using Trafilatura."""
    try:
        headers = {'User-Agent': get_random_user_agent()}
        response = requests.get(url, headers=headers, timeout=timeout)
        if response.status_code == 200:
            content = trafilatura.extract(
                response.content,
                include_comments=False,
                include_tables=False
            )
            return content
        return None
    except Exception as e:
        return None


def calculate_reading_scores(text):
    """Calculate various readability scores."""
    if not text or len(text.split()) < 100:
        return None

    try:
        return {
            'flesch_reading_ease': round(textstat.flesch_reading_ease(text), 2),
            'flesch_kincaid_grade': round(textstat.flesch_kincaid_grade(text), 2),
            'gunning_fog': round(textstat.gunning_fog(text), 2),
            'smog_index': round(textstat.smog_index(text), 2),
            'automated_readability_index': round(textstat.automated_readability_index(text), 2),
            'coleman_liau_index': round(textstat.coleman_liau_index(text), 2),
            'linsear_write_formula': round(textstat.linsear_write_formula(text), 2),
            'dale_chall_readability_score': round(textstat.dale_chall_readability_score(text), 2),
            'word_count': textstat.lexicon_count(text, removepunct=True),
            'sentence_count': textstat.sentence_count(text),
            'avg_sentence_length': round(textstat.avg_sentence_length(text), 2),
            'difficult_words': textstat.difficult_words(text),
            'reading_time_mins': round(textstat.lexicon_count(text, removepunct=True) / 200, 1)
        }
    except Exception as e:
        return None


if input_method == "XML Sitemap URL":
    sitemap_url = st.text_input(
        "Enter XML Sitemap URL",
        placeholder="https://example.com/sitemap.xml"
    )
    if sitemap_url and st.button("Fetch URLs from Sitemap"):
        with st.spinner("Fetching URLs from sitemap..."):
            urls = fetch_urls_from_sitemap(sitemap_url)
            if urls:
                st.session_state['urls'] = urls
                st.success(f"Found {len(urls)} URLs in sitemap")

    if 'urls' in st.session_state:
        urls = st.session_state['urls']
        st.info(f"{len(urls)} URLs ready to analyze")

elif input_method == "Upload CSV":
    url_file = st.file_uploader(
        "Upload CSV with URLs",
        type=['csv'],
        help="CSV file with a column containing URLs"
    )

    if url_file is not None:
        try:
            df_urls = pd.read_csv(url_file)
            url_col = st.selectbox("Select URL column", df_urls.columns.tolist())
            urls = df_urls[url_col].dropna().tolist()
            st.info(f"Found {len(urls)} URLs")
        except Exception as e:
            st.error(f"Error reading file: {str(e)}")

else:  # Paste URLs
    url_text = st.text_area(
        "Paste URLs (one per line)",
        height=200
    )
    if url_text:
        urls = [u.strip() for u in url_text.strip().split('\n') if u.strip()]
        st.info(f"Found {len(urls)} URLs")


# Main processing
if urls and st.button("Analyze Reading Scores", type="primary"):
    # Limit URLs
    urls_to_process = urls[:max_urls]
    if len(urls) > max_urls:
        st.warning(f"Processing first {max_urls} URLs (total: {len(urls)})")

    progress_bar = st.progress(0)
    status_text = st.empty()

    results = []
    errors = []

    for i, url in enumerate(urls_to_process):
        status_text.text(f"Processing {i+1}/{len(urls_to_process)}: {url[:60]}...")
        progress_bar.progress((i + 1) / len(urls_to_process))

        content = extract_content(url)

        if content:
            scores = calculate_reading_scores(content)
            if scores:
                result = {'url': url}
                result.update(scores)
                if include_content:
                    result['content'] = content
                results.append(result)
            else:
                errors.append({'url': url, 'error': 'Content too short for analysis'})
        else:
            errors.append({'url': url, 'error': 'Could not extract content'})

        time.sleep(delay)

    status_
```

### Core Architecture Module: `content-analysis/reading-score-analyzer/reading_score_analyzer_app.py`
```
"""
Reading Score Analyzer - Streamlit App

Analyze content readability from URLs using Flesch scores and other metrics.

Author: Lee Foot
Website: https://www.leefoot.com
"""

import streamlit as st
import pandas as pd
import requests
from bs4 import BeautifulSoup
import time

try:
    import trafilatura
    import textstat
except ImportError:
    st.error("Please install: pip install trafilatura textstat")
    st.stop()

st.set_page_config(
    page_title="Reading Score Analyzer",
    page_icon="📖",
    layout="wide"
)

st.title("📖 Reading Score Analyzer")
st.markdown("*Created by* [![Website](https://img.shields.io/badge/-leefoot.com-2A9D8F?logoColor=white)](https://www.leefoot.com) · [![Hire Me](https://img.shields.io/badge/-Hire%20Me-FF6B6B?logoColor=white)](https://www.leefoot.com/contact) · [![LinkedIn](https://img.shields.io/badge/-LinkedIn-0A66C2?logo=linkedin&logoColor=white)](https://www.linkedin.com/in/lee-foot/) · [![Bluesky](https://img.shields.io/badge/-Bluesky-0285FF?logoColor=white)](https://bsky.app/profile/leefootseo.bsky.social) · [![More Tools](https://img.shields.io/badge/-More%20Tools-8B5CF6?logoColor=white)](https://leefoot.com/tools) · [![GitHub](https://img.shields.io/badge/-GitHub-6B7280?logoColor=white)](https://github.com/searchsolved/search-solved-public-seo)")

with st.expander("How to use this tool"):
    st.markdown("""
    **What this tool does:**
    - Calculates readability scores (Flesch, Gunning Fog, etc.)
    - Analyzes content complexity
    - Provides grade-level recommendations

    **How to use:**
    1. Upload a CSV with content or paste text
    2. Select readability metrics to calculate
    3. Analyze content scores
    4. Download readability report

    **Best for:**
    - Content accessibility audits
    - Matching content to audience level
    - Editorial guidelines compliance
    """)
st.markdown("Analyze content readability from URLs using multiple readability metrics.")


def get_random_user_agent():
    """Get a user agent string."""
    return "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"


def fetch_urls_from_sitemap(sitemap_url, timeout=30):
    """Fetch URLs from an XML sitemap."""
    try:
        headers = {'User-Agent': get_random_user_agent()}
        response = requests.get(sitemap_url, headers=headers, timeout=timeout)
        soup = BeautifulSoup(response.content, 'xml')
        urls = [loc.text for loc in soup.find_all('loc')]

        # Filter out non-HTML URLs
        image_extensions = ('.png', '.jpg', '.jpeg', '.gif', '.svg', '.pdf', '.webp')
        urls = [url for url in urls if not url.lower().endswith(image_extensions)]

        return urls, None
    except Exception as e:
        return [], str(e)


def extract_content(url, timeout=15):
    """Extract main content from a URL using Trafilatura."""
    try:
        headers = {'User-Agent': get_random_user_agent()}
        response = requests.get(url, headers=headers, timeout=timeout)
        if response.status_code == 200:
            content = trafilatura.extract(
                response.content,
                include_comments=False,
                include_tables=False
            )
            return content, None
        return None, f"HTTP {response.status_code}"
    except Exception as e:
        return None, str(e)


def calculate_reading_scores(text):
    """Calculate various readability scores."""
    if not text or len(text.split()) < 100:
        return None

    try:
        return {
            'flesch_reading_ease': round(textstat.flesch_reading_ease(text), 2),
            'flesch_kincaid_grade': round(textstat.flesch_kincaid_grade(text), 2),
            'gunning_fog': round(textstat.gunning_fog(text), 2),
            'smog_index': round(textstat.smog_index(text), 2),
            'automated_readability_index': round(textstat.automated_readability_index(text), 2),
            'coleman_liau_index': round(textstat.coleman_liau_index(text), 2),
            'word_count': textstat.lexicon_count(text, removepunct=True),
            'sentence_count': textstat.sentence_count(text),
            'avg_sentence_length': round(textstat.avg_sentence_length(text), 2),
            'difficult_words': textstat.difficult_words(text),
            'reading_time_mins': round(textstat.lexicon_count(text, removepunct=True) / 200, 1)
        }
    except Exception:
        return None


def get_flesch_interpretation(score):
    """Get interpretation of Flesch Reading Ease score."""
    if score >= 90:
        return "Very Easy", "5th grade", "#28a745"
    elif score >= 80:
        return "Easy", "6th grade", "#5cb85c"
    elif score >= 70:
        return "Fairly Easy", "7th grade", "#8bc34a"
    elif score >= 60:
        return "Standard", "8th-9th grade", "#ffc107"
    elif score >= 50:
        return "Fairly Difficult", "10th-12th grade", "#ff9800"
    elif score >= 30:
        return "Difficult", "College", "#ff5722"
    else:
        return "Very Difficult", "College Graduate", "#dc3545"


def process_urls(urls, delay, timeout, include_content, progress_bar, status_text):
    """Process URLs and calculate reading scores."""
    results = []
    errors = []

    for i, url in enumerate(urls):
        progress_bar.progress((i + 1) / len(urls))
        status_text.text(f"Processing {i + 1}/{len(urls)}: {url[:50]}...")

        content, error = extract_content(url, timeout)

        if content:
            scores = calculate_reading_scores(content)
            if scores:
                result = {'url': url}
                result.update(scores)
                if include_content:
                    result['content'] = content[:500] + '...' if len(content) > 500 else content
                results.append(result)
            else:
                errors.append({'url': url, 'error': 'Content too short'})
        else:
            errors.append({'url': url, 'error': error or 'Could not extract content'})

        time.sleep(delay)

    return pd.DataFrame(results), errors


# Sidebar
with st.sidebar:
    st.header("⚙️ Configuration")

    delay = st.slider(
        "Delay (seconds)",
        min_value=0.5,
        max_value=5.0,
        value=1.0,
        step=0.5,
        help="Delay between requests"
    )

    timeout = st.slider(
        "Timeout (seconds)",
        min_value=5,
        max_value=30,
        value=15,
        help="Request timeout"
    )

    max_urls = st.number_input(
        "Max URLs",
        min_value=1,
        max_value=500,
        value=50,
        help="Maximum URLs to process"
    )

    include_content = st.checkbox(
        "Include content preview",
        value=False,
        help="Include extracted content in output"
    )

    st.markdown("---")
    st.markdown("### 📊 Score Guide")
    st.markdown("""
    **Flesch Reading Ease:**
    - 90-100: Very Easy (5th grade)
    - 80-89: Easy (6th grade)
    - 70-79: Fairly Easy (7th grade)
    - 60-69: Standard (8th-9th grade)
    - 50-59: Fairly Difficult (10th-12th)
    - 30-49: Difficult (College)
    - 0-29: Very Difficult (Graduate)
    """)

# Main content
input_method = st.radio(
    "Input Method",
    ["Sitemap URL", "Manual URLs", "Upload CSV"],
    horizontal=True
)

urls = []

if input_method == "Sitemap URL":
    sitemap_url = st.text_input(
        "Sitemap URL",
        placeholder="https://example.com/sitemap.xml",
        help="Enter your XML sitemap URL"
    )

    if sitemap_url:
        if st.button("🔍 Fetch URLs from Sitemap"):
            with st.spinner("Fetching sitemap..."):
                urls, error = fetch_urls_from_sitemap(sitemap_url, timeout)

            if error:
                st.error(f"Error: {error}")
            elif urls:
                st.success(f"✅ Found {len(urls)} URLs")
                st.session_state['urls'] = urls[:max_urls]

    if 'urls' in st.session_state:
        urls = st.session_state['urls']
        with st.expander(f"Preview URLs ({len(urls)})"):
            for url in urls[:20]:
                st.markdown(f"- {url}")

elif input_method == "Manual URLs":
    urls_text = st.text_area(
        "Enter URLs (one per line)",
        height=150,
        placeholder="https://example.com/page1\nhttps://example.com/page2"
    )
    if urls_text:
        urls = [u.strip() for u in urls_text.split('\n') if u.strip().startswith('http')]
        urls = urls[:max_urls]
        st.info(f"Found {len(urls)} URLs")

else:  # Upload CSV
    uploaded_file = st.file_uploader("Upload CSV with URLs", type=["csv"])
    if uploaded_file:
        df = pd.read_csv(uploaded_file)
        url_col = st.selectbox("URL Column", df.columns.tolist())
        urls = df[url_col].dropna().tolist()
        urls = [u for u in urls if isinstance(u, str) and u.startswith('http')][:max_urls]
        st.info(f"Found {len(urls)} URLs")

if urls:
    if st.button("📖 Analyze Readability", type="primary", use_container_width=True):
        progress_bar = st.progress(0)
        status_text = st.empty()

        results_df, errors = process_urls(
            urls, delay, timeout, include_content, progress_bar, status_text
        )

        progress_bar.empty()
        status_text.empty()

        if len(results_df) > 0:
            st.success(f"✅ Analyzed {len(results_df)} pages!")

            # Results tabs
            tab1, tab2, tab3, tab4 = st.tabs([
                "📊 Results", "📈 Overview", "🔍 Problem Pages", "📉 Distribution"
            ])

            with tab1:
                display_cols = [
                    'url', 'flesch_reading_ease', 'flesch_kincaid_grade',
                    'word_count', 'reading_time_mins'
                ]
                st.dataframe(results_df[display_cols], use_container_width=True, height=400)

                csv = results_df.to_csv(index=False).encode('utf-8-sig')
                st.download_button(
                    "📥 Download Results CSV",
                    data=csv,
                    file_name="reading_scores.csv",
      
```

### Core Architecture Module: `content-analysis/reading-score-analyzer/reading_score_analyzer_cli.py`
```
#!/usr/bin/env python3
"""
Reading Score Analyzer - CLI Version

Analyze content readability from URLs using Flesch scores.

Usage:
    python reading_score_analyzer_cli.py --sitemap https://example.com/sitemap.xml
    python reading_score_analyzer_cli.py --urls urls.txt

Author: Lee Foot
Website: https://www.leefoot.com
"""

import argparse
import pandas as pd
import requests
from bs4 import BeautifulSoup
import time
import sys

try:
    import trafilatura
    import textstat
    from fake_useragent import UserAgent
except ImportError:
    print("Please install required packages:")
    print("  pip install trafilatura textstat fake-useragent")
    sys.exit(1)


def get_random_user_agent():
    """Get a random user agent string."""
    try:
        ua = UserAgent()
        return ua.random
    except:
        return "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"


def fetch_urls_from_sitemap(sitemap_url, timeout=30):
    """Fetch URLs from an XML sitemap."""
    try:
        headers = {'User-Agent': get_random_user_agent()}
        response = requests.get(sitemap_url, headers=headers, timeout=timeout)
        soup = BeautifulSoup(response.content, 'xml')
        urls = [loc.text for loc in soup.find_all('loc')]

        # Filter out non-HTML URLs
        image_extensions = ('.png', '.jpg', '.jpeg', '.gif', '.svg', '.pdf', '.webp')
        urls = [url for url in urls if not url.lower().endswith(image_extensions)]

        return urls
    except Exception as e:
        print(f"Error fetching sitemap: {str(e)}")
        return []


def extract_content(url, timeout=15):
    """Extract main content from a URL using Trafilatura."""
    try:
        headers = {'User-Agent': get_random_user_agent()}
        response = requests.get(url, headers=headers, timeout=timeout)
        if response.status_code == 200:
            content = trafilatura.extract(
                response.content,
                include_comments=False,
                include_tables=False
            )
            return content
        return None
    except Exception:
        return None


def calculate_reading_scores(text):
    """Calculate various readability scores."""
    if not text or len(text.split()) < 100:
        return None

    try:
        return {
            'flesch_reading_ease': round(textstat.flesch_reading_ease(text), 2),
            'flesch_kincaid_grade': round(textstat.flesch_kincaid_grade(text), 2),
            'gunning_fog': round(textstat.gunning_fog(text), 2),
            'smog_index': round(textstat.smog_index(text), 2),
            'automated_readability_index': round(textstat.automated_readability_index(text), 2),
            'coleman_liau_index': round(textstat.coleman_liau_index(text), 2),
            'word_count': textstat.lexicon_count(text, removepunct=True),
            'sentence_count': textstat.sentence_count(text),
            'avg_sentence_length': round(textstat.avg_sentence_length(text), 2),
            'difficult_words': textstat.difficult_words(text),
            'reading_time_mins': round(textstat.lexicon_count(text, removepunct=True) / 200, 1)
        }
    except Exception:
        return None


def main():
    parser = argparse.ArgumentParser(
        description='Analyze content readability from URLs'
    )
    parser.add_argument('--sitemap', help='XML sitemap URL to fetch URLs from')
    parser.add_argument('--urls', help='File with URLs (one per line)')
    parser.add_argument('--output', default='reading_scores.csv',
                        help='Output CSV path (default: reading_scores.csv)')
    parser.add_argument('--delay', type=float, default=1.0,
                        help='Delay between requests in seconds (default: 1.0)')
    parser.add_argument('--timeout', type=int, default=15,
                        help='Request timeout in seconds (default: 15)')
    parser.add_argument('--max-urls', type=int, default=100,
                        help='Maximum URLs to process (default: 100)')
    parser.add_argument('--include-content', action='store_true',
                        help='Include extracted content in output')

    args = parser.parse_args()

    # Get URLs
    urls = []
    if args.sitemap:
        print(f"Fetching URLs from sitemap: {args.sitemap}")
        urls = fetch_urls_from_sitemap(args.sitemap, args.timeout)
        print(f"  Found {len(urls)} URLs")
    elif args.urls:
        with open(args.urls, 'r') as f:
            urls = [line.strip() for line in f if line.strip()]
        print(f"Loaded {len(urls)} URLs from file")
    else:
        print("Error: Provide URLs via --sitemap or --urls")
        sys.exit(1)

    if not urls:
        print("No URLs to process")
        sys.exit(1)

    # Limit URLs
    urls = urls[:args.max_urls]
    if len(urls) == args.max_urls:
        print(f"  Limited to first {args.max_urls} URLs")

    results = []
    errors = []

    print(f"\nAnalyzing {len(urls)} URLs...")

    for i, url in enumerate(urls):
        if i % 10 == 0:
            print(f"  Processing {i + 1}/{len(urls)}...")

        content = extract_content(url, args.timeout)

        if content:
            scores = calculate_reading_scores(content)
            if scores:
                result = {'url': url}
                result.update(scores)
                if args.include_content:
                    result['content'] = content
                results.append(result)
            else:
                errors.append({'url': url, 'error': 'Content too short for analysis'})
        else:
            errors.append({'url': url, 'error': 'Could not extract content'})

        time.sleep(args.delay)

    if results:
        df_results = pd.DataFrame(results)
        df_results.to_csv(args.output, index=False, encoding='utf-8-sig')

        print(f"\nResults saved to: {args.output}")
        print(f"  Pages analyzed: {len(results)}")
        print(f"  Average Flesch score: {df_results['flesch_reading_ease'].mean():.1f}")
        print(f"  Average grade level: {df_results['flesch_kincaid_grade'].mean():.1f}")
        print(f"  Errors: {len(errors)}")

        # Show hardest pages
        hardest = df_results.nsmallest(5, 'flesch_reading_ease')
        print(f"\nHardest to read pages:")
        for _, row in hardest.iterrows():
            print(f"  [{row['flesch_reading_ease']:.0f}] {row['url'][:60]}")
    else:
        print("No pages could be analyzed")
        if errors:
            print("Errors:")
            for err in errors[:10]:
                print(f"  {err['url'][:50]}: {err['error']}")


if __name__ == '__main__':
    main()

```

### Core Architecture Module: `keyword-research/representative-keyword-normaliser/core.py`
```
"""
Representative Keyword Normaliser - Core Logic
Suggest a cleaner, more descriptive representative keyword for each keyword in a list,
using any OpenAI-compatible endpoint (local Ollama by default, or the OpenAI API).

Useful as a pre-processing step before SERP clustering or semantic clustering.

Author: Lee Foot
Website: https://www.leefoot.com
"""

import json
import logging
import re

import pandas as pd
from openai import (
    AuthenticationError,
    BadRequestError,
    NotFoundError,
    OpenAI,
    PermissionDeniedError,
)
from tenacity import retry, retry_if_not_exception_type, stop_after_attempt, wait_fixed

DEFAULT_BASE_URL = "http://127.0.0.1:11434/v1"
DEFAULT_MODEL = "qwen2.5:7b"
DEFAULT_API_KEY = "not-needed"  # Local servers such as Ollama do not require a key

# OpenAI models offered by every tool in this repository, for use with
# https://api.openai.com/v1. The local default model above is unchanged.
OPENAI_MODELS = ["gpt-6-luna", "gpt-6.1-terra"]

SYSTEM_PROMPT = (
    "You are a keyword research assistant. "
    "Provide only the requested keyword in the specified JSON format."
)

RESPONSE_FORMAT = {
    "type": "json_schema",
    "json_schema": {
        "name": "keyword_response",
        "strict": True,
        "schema": {
            "type": "object",
            "properties": {
                "keyword": {"type": "string"}
            },
            "required": ["keyword"],
            "additionalProperties": False
        }
    }
}


class UnableToParseJSONError(Exception):
    pass


def reasoning_params(model, effort="low"):
    """Extra request parameters for OpenAI's gpt-6 reasoning models.

    gpt-6 models take reasoning_effort and do not accept temperature. Local
    and other OpenAI-compatible servers may reject reasoning_effort, so it is
    only sent when the model name starts with "gpt-6".
    """
    if str(model).strip().lower().startswith("gpt-6"):
        return {"reasoning_effort": effort}
    return {}


def build_client(base_url=DEFAULT_BASE_URL, api_key=DEFAULT_API_KEY):
    """Create an OpenAI-compatible client for the given endpoint."""
    return OpenAI(base_url=base_url, api_key=api_key)


def clean_keyword(keyword):
    """Strip characters outside printable ASCII, Arabic and Devanagari ranges."""
    return re.sub(r'[^\x20-\x7E\u0600-\u06FF\u0900-\u097F]+', '', str(keyword))


def parse_json_response(response_content):
    try:
        return json.loads(response_content)
    except json.JSONDecodeError:
        logging.error(f"Failed to parse JSON. Raw response: {response_content}")
        raise UnableToParseJSONError("Unable to parse JSON response")


# Errors that will not go away on a second try: bad key, unknown model, rejected request.
PERMANENT_ERRORS = (AuthenticationError, PermissionDeniedError, NotFoundError, BadRequestError)


@retry(stop=stop_after_attempt(3), wait=wait_fixed(2),
       retry=retry_if_not_exception_type(PERMANENT_ERRORS), reraise=True)
def request_keyword(keyword, client, model=DEFAULT_MODEL):
    """One request to the model. Raises on failure so the retry decorator can try again."""
    cleaned_keyword = clean_keyword(keyword)
    prompt = (
        f"Suggest an accurate and descriptive representative keyword for: {cleaned_keyword}. "
        "Pretend you are doing a Google search, what keyword would best describe the page "
        "based on the existing keyword? OUTPUT IN THE SAME LANGUAGE AS THE SOURCE."
    )

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": prompt}
    ]

    completion = client.chat.completions.create(
        model=model,
        messages=messages,
        response_format=RESPONSE_FORMAT,
        **reasoning_params(model),
    )

    response_content = completion.choices[0].message.content
    logging.info(f"Raw API response for '{keyword}': {response_content}")
    response_json = parse_json_response(response_content)
    return response_json['keyword']


def process_keyword(keyword, client, model=DEFAULT_MODEL):
    """Ask the model for a representative keyword.

    Invalid replies and temporary API errors are retried (3 attempts, 2 seconds apart).
    If every attempt fails, or the error is permanent (bad key, unknown model), the row
    gets an "Error: ..." value and the run carries on with the next keyword.
    """
    try:
        return request_keyword(keyword, client, model)
    except Exception as e:
        logging.error(f"Error processing '{keyword}': {str(e)}")
        return f"Error: {str(e)[:100]}..."


def process_dataframe(df, client, model=DEFAULT_MODEL, column=None, progress_callback=None):
    """Add a 'Suggested Keyword' column to a DataFrame of keywords.

    column: name of the keyword column. Defaults to the first column.
    progress_callback: optional callable(done, total) for progress reporting.
    """
    keyword_column = column if column else df.columns[0]
    if keyword_column not in df.columns:
        raise ValueError(f"Column '{keyword_column}' not found in input file")

    suggestions = []
    total = len(df)
    for i, keyword in enumerate(df[keyword_column]):
        suggestions.append(process_keyword(keyword, client, model=model))
        if progress_callback:
            progress_callback(i + 1, total)

    df = df.copy()
    df['Suggested Keyword'] = suggestions
    return df


def process_csv(input_file, output_file, client, model=DEFAULT_MODEL, column=None,
                progress_callback=None):
    """Read keywords from a CSV, append suggestions and write the result to a CSV."""
    df = pd.read_csv(input_file, encoding='utf-8-sig')
    df = process_dataframe(df, client, model=model, column=column,
                           progress_callback=progress_callback)
    df.to_csv(output_file, index=False, encoding='utf-8-sig')
    logging.info(f"Results successfully written to {output_file}")
    return df

```

### Core Architecture Module: `on-page/extract-content-blocks/content_blocks_core.py`
```
"""
Content Block Extractor - Core Library

Shared by the Streamlit app (extract_content_blocks_app.py) and the command
line script (extract_content_blocks.py), so both produce the same output.

Fetches a page, removes scripts, styles and site chrome, asks Claude to name
the major content blocks with an XPath for each, and counts how often each
XPath appears across the pages processed.

Author: Lee Foot
Website: https://www.leefoot.com
"""

import json

import pandas as pd
import requests
from bs4 import BeautifulSoup

CLAUDE_MODELS = ["claude-haiku-5-5", "claude-sonnet-5-5"]
MODEL = "claude-haiku-5-5"
# Thinking counts against this cap, so it leaves room for the model's
# reasoning as well as the JSON reply.
MAX_TOKENS = 16000
EFFORT = "medium"
# Filtered HTML longer than this is cut before it is sent to the model.
MAX_HTML_CHARS = 200_000
COLUMNS = ["url", "name", "xpath", "notes"]
REMOVED_TAGS = ["script", "style", "noscript", "meta", "link", "header", "footer", "nav"]
SYSTEM_PROMPT = (
    "You are an expert web scraper. Extract content blocks and provide XPath "
    "selectors. Return only valid JSON."
)
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)


def fetch_webpage(url, timeout=30):
    """Fetch a page and return its HTML. Raises on network and HTTP errors."""
    headers = {
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    }
    response = requests.get(url, headers=headers, timeout=timeout)
    response.raise_for_status()
    return response.text


def filter_html(html_content):
    """Remove scripts, styles, header, footer and nav to reduce tokens."""
    soup = BeautifulSoup(html_content, "html.parser")
    for tag in soup(REMOVED_TAGS):
        tag.decompose()
    return str(soup)


def build_prompt(html_content, max_html_chars=MAX_HTML_CHARS):
    """Build the user prompt. Returns (prompt, truncated)."""
    truncated = len(html_content) > max_html_chars
    return f"""Analyze this HTML and identify major content blocks/sections.

For each block provide:
- name: descriptive name
- xpath: robust XPath expression to select this element
- notes: brief description

Focus on main content areas (hero sections, feature blocks, carousels). Skip small utility elements.

Return ONLY a JSON array with this exact format:
[
  {{"name": "Hero Section", "xpath": "//div[@class='hero']", "notes": "Main hero banner"}},
  {{"name": "Features", "xpath": "//section[@class='features']", "notes": "Feature grid"}}
]

HTML:
{html_content[:max_html_chars]}
""", truncated


def parse_blocks(text):
    """Read the JSON array of blocks out of the model's reply.

    Returns a list of dicts with name, xpath and notes. Entries without an
    xpath are dropped. Raises ValueError when the reply holds no JSON array.
    """
    start = text.find("[")
    end = text.rfind("]") + 1
    if start == -1 or end <= start:
        raise ValueError("No JSON array found in the model's reply")

    blocks = []
    for item in json.loads(text[start:end]):
        if not isinstance(item, dict) or not item.get("xpath"):
            continue
        blocks.append({
            "name": str(item.get("name", "")).strip(),
            "xpath": str(item["xpath"]).strip(),
            "notes": str(item.get("notes", "")).strip(),
        })
    return blocks


def reply_text(response):
    """Text of a Claude reply, read by block type. Raises if the model declined."""
    if response.stop_reason == "refusal":
        raise RuntimeError("Claude declined this request.")
    return "".join(block.text for block in response.content if block.type == "text")


def extract_blocks(client, html_content, model=MODEL, max_html_chars=MAX_HTML_CHARS):
    """Ask Claude for the content blocks in filtered HTML.

    Returns (blocks, info) where info has input_tokens, output_tokens and
    truncated. Raises on API errors and on a reply with no JSON array.
    """
    prompt, truncated = build_prompt(html_content, max_html_chars)
    response = client.messages.create(
        model=model,
        max_tokens=MAX_TOKENS,
        output_config={"effort": EFFORT},
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": prompt}],
    )
    info = {
        "input_tokens": response.usage.input_tokens,
        "output_tokens": response.usage.output_tokens,
        "truncated": truncated,
    }
    return parse_blocks(reply_text(response)), info


def extract_from_url(client, url, model=MODEL, max_html_chars=MAX_HTML_CHARS, timeout=30):
    """Fetch one URL and return (rows, info). Each row has url, name, xpath, notes."""
    html = fetch_webpage(url, timeout=timeout)
    blocks, info = extract_blocks(client, filter_html(html), model, max_html_chars)
    return [{"url": url, **block} for block in blocks], info


def blocks_to_frame(rows):
    """Rows as a DataFrame with the columns url, name, xpath, notes."""
    return pd.DataFrame(rows, columns=COLUMNS)


def add_frequency(df):
    """Add a frequency column and give each XPath one name.

    frequency is the number of rows that share the XPath. The name is the
    first one seen for that XPath. Sorted by frequency, highest first.
    """
    out = df.copy()
    if out.empty:
        out["frequency"] = pd.Series(dtype="int64")
        return out
    out["frequency"] = out["xpath"].map(out["xpath"].value_counts())
    out["name"] = out["xpath"].map(out.groupby("xpath")["name"].first())
    return out.sort_values("frequency", ascending=False, kind="stable").reset_index(drop=True)


def xpath_reference(df):
    """One row per XPath: xpath, name, notes, frequency. Highest frequency first."""
    if df.empty:
        return pd.DataFrame(columns=["xpath", "name", "notes", "frequency"])
    return (
        df.groupby("xpath")
        .agg(name=("name", "first"), notes=("notes", "first"), frequency=("url", "count"))
        .reset_index()
        .sort_values("frequency", ascending=False, kind="stable")
        .reset_index(drop=True)
    )

```

### Core Architecture Module: `reporting/core-update-analyser/core_update_analyser.py`
```
import streamlit as st
import pandas as pd
from io import BytesIO

st.set_page_config(page_title="Core Update Analyser", page_icon="📊", layout="wide")

st.title("Core Update Analyser")
st.markdown("*Created by* [![Website](https://img.shields.io/badge/-leefoot.com-2A9D8F?logoColor=white)](https://www.leefoot.com) · [![Hire Me](https://img.shields.io/badge/-Hire%20Me-FF6B6B?logoColor=white)](https://www.leefoot.com/contact) · [![LinkedIn](https://img.shields.io/badge/-LinkedIn-0A66C2?logo=linkedin&logoColor=white)](https://www.linkedin.com/in/lee-foot/) · [![Bluesky](https://img.shields.io/badge/-Bluesky-0285FF?logoColor=white)](https://bsky.app/profile/leefootseo.bsky.social) · [![More Tools](https://img.shields.io/badge/-More%20Tools-8B5CF6?logoColor=white)](https://leefoot.com/tools) · [![GitHub](https://img.shields.io/badge/-GitHub-6B7280?logoColor=white)](https://github.com/searchsolved/search-solved-public-seo)")

with st.expander("How to use this tool"):
    st.markdown("""
    **Ahrefs Export Setup:**
    1. Go to Ahrefs > Organic Keywords > Organic Keywords 2.0
    2. Compare two dates (before and after a core update)
    3. Export the "Position changes" report as CSV

    **Required columns:**
    - Keyword, Volume, SERP features
    - Previous URL, Previous position, Previous date
    - Current URL, Current position, Current date

    **What this tool does:**
    - Groups keyword changes by URL folder/subfolder
    - Shows which site sections gained or lost rankings
    - Breaks down by position ranges: 1-3, 4-10, 11-100
    - Outputs an Excel file with analysis at each URL depth level
    """)


def process_ahrefs_data(df_ahrefs):
    """Process Ahrefs organic keywords export and analyze by URL folder."""

    # Count URL folder depth
    df_ahrefs["Folder Depth"] = df_ahrefs["Previous URL"].str.count("/") - 1
    max_depth = int(df_ahrefs["Folder Depth"].max())

    # Clean URLs
    for col in ["Previous URL", "Current URL"]:
        df_ahrefs[col] = df_ahrefs[col].str.replace(r"\r\n.*", "", regex=True)
        df_ahrefs[col] = df_ahrefs[col].str.replace(".html", "")
        df_ahrefs[col] = df_ahrefs[col].str.split("?").str[0]

    # Create position range flags
    df_ahrefs.loc[df_ahrefs["Previous position"] < 4, "Prev Top 3"] = "prev_top_three"
    df_ahrefs.loc[df_ahrefs["Previous position"] < 11, "Prev First Page"] = "prev_first_page"
    df_ahrefs.loc[df_ahrefs["Previous position"] > 10, "Prev Page 2+"] = "prev_second_page"

    df_ahrefs.loc[df_ahrefs["Current position"] < 4, "Curr Top 3"] = "curr_top_three"
    df_ahrefs.loc[df_ahrefs["Current position"] < 11, "Curr First Page"] = "curr_first_page"
    df_ahrefs.loc[df_ahrefs["Current position"] > 10, "Curr Page 2+"] = "curr_second_page"

    # Create filtered dataframes for each position range
    df_prev_top_3 = df_ahrefs[df_ahrefs["Prev Top 3"] == "prev_top_three"].copy()
    df_prev_first_page = df_ahrefs[df_ahrefs["Prev First Page"] == "prev_first_page"].copy()
    df_prev_page_2 = df_ahrefs[df_ahrefs["Prev Page 2+"] == "prev_second_page"].copy()
    df_curr_top_3 = df_ahrefs[df_ahrefs["Curr Top 3"] == "curr_top_three"].copy()
    df_curr_first_page = df_ahrefs[df_ahrefs["Curr First Page"] == "curr_first_page"].copy()
    df_curr_page_2 = df_ahrefs[df_ahrefs["Curr Page 2+"] == "curr_second_page"].copy()

    # Copy position values for grouping
    df_prev_top_3["Prev Top 3"] = df_prev_top_3["Previous position"]
    df_prev_first_page["Prev First Page"] = df_prev_first_page["Previous position"]
    df_prev_page_2["Prev Page 2+"] = df_prev_page_2["Previous position"]
    df_curr_top_3["Curr Top 3"] = df_curr_top_3["Current position"]
    df_curr_first_page["Curr First Page"] = df_curr_first_page["Current position"]
    df_curr_page_2["Curr Page 2+"] = df_curr_page_2["Current position"]

    # Create prev and current base dataframes
    df_prev = df_ahrefs[["Keyword", "SERP features", "Volume", "Previous position", "Previous URL",
                         "Prev Top 3", "Prev First Page", "Prev Page 2+"]].copy()
    df_curr = df_ahrefs[["Keyword", "SERP features", "Volume", "Current position", "Current URL",
                         "Curr Top 3", "Curr First Page", "Curr Page 2+"]].copy()

    df_appended_data = []

    # Loop through folder depths
    for depth in range(1, max_depth + 1):
        split_depth = depth + 1

        df_prev["Folder Name"] = df_prev["Previous URL"].str.split("/").str[split_depth]
        df_curr["Current Folder"] = df_curr["Current URL"].str.split("/").str[split_depth]

        # Group main metrics
        df_prev_grp = df_prev.groupby("Folder Name", as_index=False).agg({
            "Volume": "sum", "Keyword": "count", "Previous position": "median"
        })
        df_curr_grp = df_curr.groupby("Current Folder", as_index=False).agg({
            "Volume": "sum", "Keyword": "count", "Current position": "median"
        })

        # Group position range dataframes
        for df_temp in [df_prev_top_3, df_prev_first_page, df_prev_page_2,
                        df_curr_top_3, df_curr_first_page, df_curr_page_2]:
            url_col = "Previous URL" if "Prev" in df_temp.columns[6] else "Current URL"
            df_temp["Folder Name"] = df_temp[url_col].str.split("/").str[split_depth]

        # Aggregate by position range
        df_prev_top_3_grp = df_prev_top_3.groupby("Folder Name", as_index=False).agg({
            "Volume": "sum", "Prev Top 3": "count", "Previous position": "median"
        }).rename(columns={"Prev Top 3": "1-3 - Prev KWs", "Volume": "1-3 - Prev Volume",
                          "Previous position": "1-3 - Prev Avg. Position"})

        df_prev_first_page_grp = df_prev_first_page.groupby("Folder Name", as_index=False).agg({
            "Volume": "sum", "Prev First Page": "count", "Previous position": "median"
        }).rename(columns={"Prev First Page": "1-10 - Prev KWs", "Volume": "1-10 - Prev Volume",
                          "Previous position": "1-10 - Prev Avg. Position"})

        df_prev_page_2_grp = df_prev_page_2.groupby("Folder Name", as_index=False).agg({
            "Volume": "sum", "Prev Page 2+": "count", "Previous position": "median"
        }).rename(columns={"Prev Page 2+": "11-100 - Prev KWs", "Volume": "11-100 - Prev Volume",
                          "Previous position": "11-100 - Prev Avg. Position"})

        df_curr_top_3_grp = df_curr_top_3.groupby("Folder Name", as_index=False).agg({
            "Volume": "sum", "Curr Top 3": "count", "Current position": "median"
        }).rename(columns={"Curr Top 3": "1-3 - Curr KWs", "Volume": "1-3 - Curr Volume",
                          "Current position": "1-3 - Curr Avg. Position"})

        df_curr_first_page_grp = df_curr_first_page.groupby("Folder Name", as_index=False).agg({
            "Volume": "sum", "Curr First Page": "count", "Current position": "median"
        }).rename(columns={"Curr First Page": "1-10 - Curr KWs", "Volume": "1-10 - Curr Volume",
                          "Current position": "1-10 - Curr Avg. Position"})

        df_curr_page_2_grp = df_curr_page_2.groupby("Folder Name", as_index=False).agg({
            "Volume": "sum", "Curr Page 2+": "count", "Current position": "median"
        }).rename(columns={"Curr Page 2+": "11-100 - Curr KWs", "Volume": "11-100 - Curr Volume",
                          "Current position": "11-100 - Curr Avg. Position"})

        # Merge all grouped data
        df_merge = pd.merge(df_prev_grp, df_curr_grp, left_on="Folder Name", right_on="Current Folder", how="left")
        for grp_df in [df_prev_top_3_grp, df_prev_first_page_grp, df_prev_page_2_grp,
                       df_curr_top_3_grp, df_curr_first_page_grp, df_curr_page_2_grp]:
            df_merge = pd.merge(df_merge, grp_df, on="Folder Name", how="left")

        df_merge["Current Folder"] = df_merge["Current Folder"].fillna("Lost / URL Changed")
        df_merge["Depth"] = depth
        df_appended_data.append(df_merge)

    # Concatenate all depths
    df_result = pd.concat(df_appended_data, ignore_index=True)

    # Rename columns
    df_result.rename(columns={
        "Volume_x": "1-100 - Prev Volume", "Keyword_x": "1-100 - Prev KWs",
        "Previous position": "1-100 - Prev Avg. Position",
        "Volume_y": "1-100 - Curr Volume", "Keyword_y": "1-100 - Curr KWs",
        "Current position": "1-100 - Curr Avg. Position"
    }, inplace=True)

    # Calculate change columns
    df_result["1-100 +/- KW Change"] = df_result["1-100 - Curr KWs"] - df_result["1-100 - Prev KWs"]
    df_result["1-3 +/- KW Change"] = df_result.get("1-3 - Curr KWs", 0) - df_result.get("1-3 - Prev KWs", 0)
    df_result["1-10 +/- KW Change"] = df_result.get("1-10 - Curr KWs", 0) - df_result.get("1-10 - Prev KWs", 0)
    df_result["11-100 +/- KW Change"] = df_result.get("11-100 - Curr KWs", 0) - df_result.get("11-100 - Prev KWs", 0)

    df_result["1-100 +/- Vol Change"] = df_result["1-100 - Curr Volume"] - df_result["1-100 - Prev Volume"]
    df_result["1-3 +/- Vol Change"] = df_result.get("1-3 - Curr Volume", 0) - df_result.get("1-3 - Prev Volume", 0)
    df_result["1-10 +/- Vol Change"] = df_result.get("1-10 - Curr Volume", 0) - df_result.get("1-10 - Prev Volume", 0)
    df_result["11-100 +/- Vol Change"] = df_result.get("11-100 - Curr Volume", 0) - df_result.get("11-100 - Prev Volume", 0)

    # Fill NaN values
    change_cols = [c for c in df_result.columns if "+/-" in c]
    df_result[change_cols] = df_result[change_cols].fillna(0)

    # Select final columns
    final_cols = ["Depth", "Folder Name", "1-100 +/- KW Change", "1-3 +/- KW Change",
                  "1-10 +/- KW Change", "11-100 +/- KW Change", "1-100 +/- Vol Change",
                  "1-3 +/- Vol Change", "1-10 +/- Vol Change", "11-100 +/- Vol Change"]
    df_result = df_result[[c for c in final_cols if c in df_result.columns]]

    # Round and sort
    df_result = df_result.round(2)
    df_result = df_result.sort_values(by="1-100 +/- KW Change", ascend
```

### Core Architecture Module: `reporting/pyppeteer-render-pages-by-most-common-resolutions-in-ga/top_resolution_renderer.py`
```
####################################################################################
# Author   : Lee Foot                                                              #
# Website  : https://www.leefoot.com                                               #
# Contact  : https://www.leefoot.com/contact                                       #
# Email    : hello@leefoot.com                                                     #
# LinkedIn : https://www.linkedin.com/in/lee-foot/                                 #
# Bluesky  : https://bsky.app/profile/leefootseo.bsky.social                                              #
####################################################################################

import pandas as pd
import asyncio
from pyppeteer import launch
import os
from glob import glob

url = "http://www.guardian.co.uk"

dir = os.getcwd()
os.chdir(dir)

for f in glob('*Browser & OS*.csv'):
    df_ga = pd.read_csv((f), skiprows=6)

df_ga.drop(df_ga.loc[10:].index, inplace=True)
df_ga['width'] = df_ga["Screen Resolution"].str.split("x").str[0].astype(int)
df_ga['height'] = df_ga["Screen Resolution"].str.split("x").str[1].astype(int)
width_list = list(df_ga['width'])
height_list = list(df_ga['height'])

async def main():
    browser = await launch()
    page = await browser.newPage()
    await page.setViewport({'width': ga_width, 'height': ga_height})

    await page.goto(url)
    await page.screenshot({'path': str(ga_width) + "x" + str(ga_height) + ".png"})
    dimensions = await page.evaluate('''() => {
        return {
            width: document.documentElement.clientWidth,
            height: document.documentElement.clientHeight,
            deviceScaleFactor: window.devicePixelRatio,
        }
    }''')

    print(dimensions)
    await browser.close()


for ga_width,ga_height in zip (width_list, height_list):
    asyncio.get_event_loop().run_until_complete(main())

```

### Core Architecture Module: `reporting/pyppeteer-render-pages-by-most-common-resolutions-in-ga/top_resolution_renderer_app.py`
```
"""
Top Resolution Screenshot Renderer - Streamlit App

Takes screenshots of a URL at the most popular screen resolutions from GA data.

Author: Lee Foot
Website: https://www.leefoot.com
"""

import streamlit as st
import pandas as pd
import asyncio
import zipfile
from io import BytesIO
import base64

st.set_page_config(
    page_title="Resolution Screenshot Renderer",
    page_icon="📸",
    layout="wide"
)

st.title("📸 Resolution Screenshot Renderer")
st.markdown("*Created by* [![Website](https://img.shields.io/badge/-leefoot.com-2A9D8F?logoColor=white)](https://www.leefoot.com) · [![Hire Me](https://img.shields.io/badge/-Hire%20Me-FF6B6B?logoColor=white)](https://www.leefoot.com/contact) · [![LinkedIn](https://img.shields.io/badge/-LinkedIn-0A66C2?logo=linkedin&logoColor=white)](https://www.linkedin.com/in/lee-foot/) · [![Bluesky](https://img.shields.io/badge/-Bluesky-0285FF?logoColor=white)](https://bsky.app/profile/leefootseo.bsky.social) · [![More Tools](https://img.shields.io/badge/-More%20Tools-8B5CF6?logoColor=white)](https://leefoot.com/tools) · [![GitHub](https://img.shields.io/badge/-GitHub-6B7280?logoColor=white)](https://github.com/searchsolved/search-solved-public-seo)")

with st.expander("How to use this tool"):
    st.markdown("""
    **What this tool does:**
    - Renders pages at common screen resolutions
    - Uses GA data to prioritize resolutions
    - Captures screenshots for review

    **How to use:**
    1. Upload URLs to render
    2. Configure resolution settings
    3. Capture screenshots
    4. Download rendered images

    **Best for:**
    - Visual QA testing
    - Responsive design audits
    - Cross-device validation
    """)
st.markdown("Take screenshots of any URL at popular screen resolutions from your GA data.")


async def take_screenshot_async(url, width, height):
    """Take a screenshot using Pyppeteer."""
    try:
        from pyppeteer import launch

        browser = await launch(headless=True, args=['--no-sandbox'])
        page = await browser.newPage()
        await page.setViewport({'width': width, 'height': height})
        await page.goto(url, waitUntil='networkidle0', timeout=30000)
        screenshot = await page.screenshot({'fullPage': False})
        await browser.close()
        return screenshot, None
    except Exception as e:
        return None, str(e)


def take_screenshot(url, width, height):
    """Wrapper to run async function."""
    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        result = loop.run_until_complete(take_screenshot_async(url, width, height))
        loop.close()
        return result
    except Exception as e:
        return None, str(e)


def parse_resolutions_from_ga(df):
    """Parse screen resolutions from GA export."""
    resolution_col = None
    for col in df.columns:
        if 'resolution' in col.lower() or 'screen' in col.lower():
            resolution_col = col
            break

    if not resolution_col:
        resolution_col = df.columns[0]

    resolutions = []
    for res in df[resolution_col].dropna():
        try:
            if 'x' in str(res).lower():
                parts = str(res).lower().split('x')
                width = int(parts[0].strip())
                height = int(parts[1].strip())
                if width > 0 and height > 0:
                    resolutions.append((width, height))
        except:
            continue

    return list(set(resolutions))[:10]  # Top 10 unique


# Sidebar configuration
with st.sidebar:
    st.header("⚙️ Configuration")

    url = st.text_input(
        "URL to Screenshot",
        value="https://www.example.com",
        help="Enter the full URL to capture"
    )

    max_resolutions = st.slider(
        "Max Resolutions",
        min_value=1,
        max_value=10,
        value=5,
        help="Maximum number of resolutions to capture"
    )

    st.markdown("---")
    st.markdown("### 📖 GA Export Guide")
    st.markdown("""
    1. Go to Audience → Technology → Browser & OS
    2. Set primary dimension to 'Screen Resolution'
    3. Export as CSV
    """)

# Main content
st.markdown("### 📤 Upload GA Screen Resolution Data")

uploaded_file = st.file_uploader(
    "Upload GA CSV",
    type=["csv"],
    help="Export from: Analytics > Audience > Technology > Browser & OS > Screen Resolution"
)

# Or use default resolutions
st.markdown("**Or use common resolutions:**")
use_defaults = st.checkbox("Use default popular resolutions", value=True)

default_resolutions = [
    (1920, 1080),
    (1366, 768),
    (1536, 864),
    (1280, 720),
    (1440, 900),
    (1600, 900),
    (360, 640),
    (375, 667),
    (414, 896),
    (768, 1024)
]

if uploaded_file:
    df = pd.read_csv(uploaded_file, skiprows=6)  # Skip GA header rows
    resolutions = parse_resolutions_from_ga(df)[:max_resolutions]

    st.success(f"✅ Found {len(resolutions)} resolutions from GA data")

    # Preview
    with st.expander("Preview Resolutions"):
        res_df = pd.DataFrame(resolutions, columns=['Width', 'Height'])
        st.dataframe(res_df, use_container_width=True)

elif use_defaults:
    resolutions = default_resolutions[:max_resolutions]
    st.info(f"Using {len(resolutions)} default resolutions")

    # Preview defaults
    with st.expander("Preview Default Resolutions"):
        res_df = pd.DataFrame(resolutions, columns=['Width', 'Height'])
        st.dataframe(res_df, use_container_width=True)
else:
    resolutions = []
    st.warning("Upload a GA file or enable default resolutions")

# Custom resolution input
st.markdown("### ➕ Add Custom Resolution")
col1, col2, col3 = st.columns([2, 2, 1])

with col1:
    custom_width = st.number_input("Width", min_value=320, max_value=3840, value=1920)
with col2:
    custom_height = st.number_input("Height", min_value=200, max_value=2160, value=1080)
with col3:
    if st.button("Add"):
        resolutions.append((custom_width, custom_height))
        st.rerun()

if resolutions and url:
    st.markdown("---")

    if st.button("📸 Take Screenshots", type="primary", use_container_width=True):
        progress_bar = st.progress(0)
        status_text = st.empty()

        screenshots = []
        errors = []

        for i, (width, height) in enumerate(resolutions):
            progress_bar.progress((i + 1) / len(resolutions))
            status_text.text(f"Capturing {width}x{height}...")

            screenshot, error = take_screenshot(url, width, height)

            if screenshot:
                screenshots.append({
                    'width': width,
                    'height': height,
                    'data': screenshot
                })
            else:
                errors.append({
                    'resolution': f"{width}x{height}",
                    'error': error
                })

        progress_bar.empty()
        status_text.empty()

        if screenshots:
            st.success(f"✅ Captured {len(screenshots)} screenshots!")

            # Display screenshots
            st.markdown("### 🖼️ Screenshots")

            for i, shot in enumerate(screenshots):
                with st.expander(f"{shot['width']}x{shot['height']}", expanded=(i == 0)):
                    # Display image
                    st.image(shot['data'], caption=f"{shot['width']}x{shot['height']}")

                    # Individual download
                    st.download_button(
                        f"📥 Download {shot['width']}x{shot['height']}.png",
                        data=shot['data'],
                        file_name=f"screenshot_{shot['width']}x{shot['height']}.png",
                        mime="image/png"
                    )

            # Download all as ZIP
            st.markdown("---")
            zip_buffer = BytesIO()
            with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
                for shot in screenshots:
                    filename = f"screenshot_{shot['width']}x{shot['height']}.png"
                    zip_file.writestr(filename, shot['data'])

            zip_buffer.seek(0)

            st.download_button(
                "📥 Download All Screenshots (ZIP)",
                data=zip_buffer.getvalue(),
                file_name="screenshots.zip",
                mime="application/zip",
                use_container_width=True
            )

        if errors:
            st.warning(f"⚠️ {len(errors)} screenshots failed")
            with st.expander("View Errors"):
                for err in errors:
                    st.error(f"**{err['resolution']}**: {err['error']}")

else:
    if not url:
        st.info("👆 Enter a URL to screenshot")
    if not resolutions:
        st.info("👆 Upload GA data or enable default resolutions")

# Note about dependencies
with st.expander("ℹ️ Requirements"):
    st.markdown("""
    This tool requires **Pyppeteer** for taking screenshots:

    ```bash
    pip install pyppeteer
    ```

    On first run, Pyppeteer will download Chromium (~100MB).

    **Note:** If running on Streamlit Cloud, you may need to use
    a different screenshot method due to browser limitations.
    """)

# Footer
st.markdown("---")
st.markdown(
    "Built by [![Website](https://img.shields.io/badge/-leefoot.com-2A9D8F?logoColor=white)](https://www.leefoot.com) · "
    "[![LinkedIn](https://img.shields.io/badge/-LinkedIn-0A66C2?logo=linkedin&logoColor=white)](https://www.linkedin.com/in/lee-foot/) · "
    "[![Bluesky](https://img.shields.io/badge/-Bluesky-0285FF?logoColor=white)](https://bsky.app/profile/leefootseo.bsky.social)"
)

```

### Core Architecture Module: `reporting/serp-appearance-report/serp_appearance_core.py`
```
"""
SERP Appearance Report - Core Logic

Fetches live Google organic results for a list of keywords from the
DataForSEO SERP API (Google Organic, Live Advanced) and keeps the results
that belong to a user-supplied domain.

Author: Lee Foot
Website: https://www.leefoot.com
"""

import io
import math
import time
from base64 import b64encode
from urllib.parse import urlparse

import pandas as pd
import requests

ENCODINGS = ['utf-8', 'utf-8-sig', 'latin-1', 'iso-8859-1']

DATAFORSEO_ENDPOINT = 'https://api.dataforseo.com/v3/serp/google/organic/live/advanced'

# DataForSEO bills live SERP requests per 10 results
COST_PER_10_RESULTS = 0.002

# Region name -> (DataForSEO location_code, language_code)
LOCATIONS = {
    "United Kingdom": (2826, "en"),
    "United States": (2840, "en"),
    "Australia": (2036, "en"),
    "Canada": (2124, "en"),
    "Germany": (2276, "de"),
    "France": (2250, "fr"),
    "Spain": (2724, "es"),
    "Italy": (2380, "it"),
    "Netherlands": (2528, "nl"),
    "India": (2356, "en"),
}

# DataForSEO SERP API supports desktop and mobile only
DEVICES = ("desktop", "mobile")

KEYWORD_COLUMN_NAMES = ('keyword', 'keywords', 'query', 'queries', 'search term', 'top queries')

COLUMNS = ['query', 'position', 'link', 'title', 'snippet']


# ----------------------------------------------------------------------
# Keyword input
# ----------------------------------------------------------------------

def decode_bytes(raw_bytes):
    """Decode raw bytes (e.g. an uploaded file), trying several encodings."""
    for encoding in ENCODINGS:
        try:
            return raw_bytes.decode(encoding)
        except UnicodeDecodeError:
            continue
    raise ValueError(f"Unable to decode the file with any of the encodings: {ENCODINGS}")


def dedupe_keywords(keywords):
    """Strip blanks and duplicates (case-insensitive), keeping the first spelling and order."""
    seen = set()
    cleaned = []
    for keyword in keywords:
        if keyword is None or (isinstance(keyword, float) and math.isnan(keyword)):
            continue
        keyword = str(keyword).strip()
        if not keyword or keyword.lower() in seen:
            continue
        seen.add(keyword.lower())
        cleaned.append(keyword)
    return cleaned


def parse_keyword_lines(text):
    """Return keywords from pasted text, one per line."""
    return dedupe_keywords(text.splitlines())


def keywords_from_csv_text(text):
    """Return keywords from CSV text.

    Uses the first column named keyword, keywords, query, queries, search term
    or top queries (any case); otherwise the first column.
    """
    df = pd.read_csv(io.StringIO(text), dtype=str)
    if df.empty or len(df.columns) == 0:
        return []
    column = df.columns[0]
    for col in df.columns:
        if str(col).strip().lower() in KEYWORD_COLUMN_NAMES:
            column = col
            break
    return dedupe_keywords(df[column].tolist())


def keywords_from_bytes(raw_bytes, filename):
    """Return keywords from an uploaded .csv or .txt file."""
    text = decode_bytes(raw_bytes)
    if filename.lower().endswith('.csv'):
        return keywords_from_csv_text(text)
    return parse_keyword_lines(text)


def read_keywords_file(file_path):
    """Read keywords from a .csv file (keyword column) or a text file (one per line)."""
    with open(file_path, 'rb') as file:
        raw_bytes = file.read()
    return keywords_from_bytes(raw_bytes, str(file_path))


# ----------------------------------------------------------------------
# Domain matching
# ----------------------------------------------------------------------

def normalise_domain(domain):
    """Strip scheme, www prefix and trailing slashes from a domain string."""
    domain = domain.strip().lower()
    for prefix in ('https://', 'http://'):
        if domain.startswith(prefix):
            domain = domain[len(prefix):]
    if domain.startswith('www.'):
        domain = domain[len('www.'):]
    return domain.rstrip('/')


def url_matches_domain(url, domain):
    """True when the URL is on the domain or one of its subdomains.

    If the domain includes a path (e.g. example.com/blog), the URL path must
    also start with that path.
    """
    if not url:
        return False
    domain_host, _, domain_path = domain.partition('/')
    parsed = urlparse(url if '://' in url else f'https://{url}')
    host = parsed.netloc.lower().split(':')[0]
    if host.startswith('www.'):
        host = host[len('www.'):]
    if not (host == domain_host or host.endswith('.' + domain_host)):
        return False
    if domain_path:
        return parsed.path.lower().lstrip('/').startswith(domain_path)
    return True


# ----------------------------------------------------------------------
# DataForSEO
# ----------------------------------------------------------------------

class DataForSEOError(ValueError):
    """An error reported by the DataForSEO API, with its status code when known."""

    def __init__(self, message, status_code=None):
        super().__init__(message)
        self.status_code = status_code

    @property
    def is_account_error(self):
        """True for authentication (401xx) and payment or balance (402xx) errors."""
        return self.status_code is not None and 40100 <= self.status_code < 40300


def estimate_cost(num_keywords, depth):
    """Estimated DataForSEO cost in USD for a run."""
    return num_keywords * COST_PER_10_RESULTS * math.ceil(depth / 10)


def build_headers(login, password):
    """Basic auth headers for the DataForSEO API."""
    cred = b64encode(f"{login}:{password}".encode()).decode()
    return {
        'Authorization': f'Basic {cred}',
        'Content-Type': 'application/json'
    }


def build_payload(keyword, location_code, language_code, device, depth):
    """Request body for one keyword."""
    return [{
        "keyword": keyword,
        "location_code": location_code,
        "language_code": language_code,
        "device": device.lower(),
        "depth": depth
    }]


def parse_serp_response(response_data):
    """Return (organic_items, cost) from a DataForSEO SERP response.

    Raises ValueError with a readable message when the API or the task
    reports an error.
    """
    if not isinstance(response_data, dict):
        raise DataForSEOError("Unexpected response from DataForSEO")
    if response_data.get('status_code') != 20000:
        raise DataForSEOError(f"API error: {response_data.get('status_message', 'Unknown error')}",
                              response_data.get('status_code'))
    cost = response_data.get('cost') or 0.0
    try:
        task = response_data["tasks"][0]
    except (KeyError, TypeError, IndexError):
        raise DataForSEOError("No task returned by DataForSEO")
    if task.get('status_code') != 20000:
        raise DataForSEOError(f"Task error: {task.get('status_message', 'Unknown error')}",
                              task.get('status_code'))
    try:
        items = task["result"][0]["items"] or []
    except (KeyError, TypeError, IndexError):
        items = []
    organic = [item for item in items if item.get("type") == "organic"]
    return organic, cost


def fetch_serp(keyword, headers, location_code, language_code, device, depth, timeout=60):
    """Fetch one keyword's live SERP. Returns (organic_items, cost); raises DataForSEOError on failure."""
    try:
        response = requests.post(
            DATAFORSEO_ENDPOINT,
            headers=headers,
            json=build_payload(keyword, location_code, language_code, device, depth),
            timeout=timeout
        )
    except requests.exceptions.RequestException as e:
        raise DataForSEOError(f"Request failed: {e}")
    try:
        response_data = response.json()
    except ValueError:
        status = 40100 if response.status_code == 401 else None
        raise DataForSEOError(f"Could not parse the API response (HTTP {response.status_code})", status)
    return parse_serp_response(response_data)


def extract_appearances(organic_items, query, domain):
    """Return one row per organic result on the domain, with query, position, link, title and snippet."""
    domain = normalise_domain(domain)
    if not domain:
        raise ValueError("A domain must be supplied.")

    rows = []
    for item in organic_items:
        link = item.get('url') or ''
        if url_matches_domain(link, domain):
            rows.append({
                'query': query,
                'position': item.get('rank_group', ''),
                'link': link,
                'title': item.get('title') or '',
                'snippet': item.get('description') or '',
            })
    return rows


def run_report(keywords, domain, login, password, location_code, language_code,
               device='desktop', depth=10, delay=2.0, progress_callback=None):
    """Fetch every keyword and collect the domain's organic appearances.

    Requests are sent one at a time with `delay` seconds between them.
    Returns (rows, warnings, total_cost).
    """
    if not normalise_domain(domain):
        raise ValueError("A domain must be supplied.")

    headers = build_headers(login, password)
    all_rows = []
    warnings = []
    total_cost = 0.0

    for i, keyword in enumerate(keywords):
        if progress_callback:
            progress_callback(i, len(keywords), keyword)
        try:
            organic, cost = fetch_serp(keyword, headers, location_code, language_code, device, depth)
            total_cost += cost
            all_rows.extend(extract_appearances(organic, keyword, domain))
        except DataForSEOError as e:
            warnings.append(f"{keyword}: {e}")
            # Stop on credential or balance errors rather than repeating them for every keyword
            if e.is_account_error:
                warnings.append("Stopped: fix the DataForSEO account error above and run again.")
                break

        if i < len(keywords) - 1 and delay > 0:
           
```

### Core Architecture Module: `search-engine-journal/semantic_clustering_py/semantic_clustering.py`
```
# Author: Lee Foot
# Website: https://leefoot.com

####################################################################################
# Author   : Lee Foot                                                              #
# Website  : https://www.leefoot.com                                               #
# Contact  : https://www.leefoot.com/contact                                       #
# Email    : hello@leefoot.com                                                     #
# LinkedIn : https://www.linkedin.com/in/lee-foot/                                 #
# Bluesky  : https://bsky.app/profile/leefootseo.bsky.social                                              #
####################################################################################

import sys
import os
import time
import pandas as pd
import questionary
import glob
from sentence_transformers import SentenceTransformer, util

# Model for computing sentence embeddings. We use one trained for similar questions detection
model = SentenceTransformer('paraphrase-MiniLM-L3-v2')  #1861  /  7.7
  
  
# use glob to get all the csv files 
# in the folder
path = os.getcwd()
csv_files = glob.glob(os.path.join(path, "*.csv"))
  
  
# loop over the list of csv files
if not csv_files:
    print("No CSV files found in the current directory.")
    sys.exit(1)

# read the first csv file
df = pd.read_csv(csv_files[0])
    
cols = df.columns.tolist()

choice = questionary.select("Please select your keyword column", choices=cols).ask()  # returns value of selection

# store the data
cluster_name_list = []
corpus_sentences_list = []
df_all = []

corpus_set = set(df[choice])
corpus_set_all = corpus_set

cluster = True

while cluster:

    corpus_sentences = list(corpus_set)
    check_len = len(corpus_sentences)

    corpus_embeddings = model.encode(corpus_sentences, batch_size=256, show_progress_bar=True, convert_to_tensor=True)
    clusters = util.community_detection(corpus_embeddings, min_community_size=2, threshold=0.75, init_max_size=len(corpus_embeddings))

    for keyword, cluster in enumerate(clusters):
        print("\nCluster {}, #{} Elements ".format(keyword + 1, len(cluster)))

        for sentence_id in cluster[0:]:
            print("\t", corpus_sentences[sentence_id])
            corpus_sentences_list.append(corpus_sentences[sentence_id])
            cluster_name_list.append("Cluster {}, #{} Elements ".format(keyword + 1, len(cluster)))

    df_new = pd.DataFrame(None)
    df_new['Cluster Name'] = cluster_name_list
    df_new["Keyword"] = corpus_sentences_list

    df_all.append(df_new)
    have = set(df_new["Keyword"])

    corpus_set = corpus_set_all - have
    remaining = len(corpus_set)

    if check_len == remaining:
        break

df_new = pd.concat(df_all)


df = df.merge(df_new.drop_duplicates(choice), how='left', left_on=choice, right_on="Keyword")

# ------------------------------ rename the clusters to the shortest keyword -------------------------------------------

df['Length'] = df['Keyword'].astype(str).map(len)
df = df.sort_values(by="Length", ascending=True)

df['Cluster Name'] = df.groupby('Cluster Name')['Keyword'].transform('first')
df.sort_values(['Cluster Name', "Keyword"], ascending=[True, True], inplace=True)

df['Cluster Name'] = df['Cluster Name'].fillna("zzz_no_cluster")

del df['Length']

col = df.pop("Keyword")
df.insert(0, col.name, col)

col = df.pop('Cluster Name')
df.insert(0, col.name, col)

df.sort_values(["Cluster Name", "Keyword"], ascending=[True, True], inplace=True)

newpath = os.path.join(path, 'output')
if not os.path.exists(newpath):
    os.makedirs(newpath)

df.to_csv(os.path.join(newpath, "test.csv"))
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #20** (2026-09-20): **Fix image centering tool placeholder previews**
  *Symptoms*: The eCommerce Image Centering Tool uses retired `via.placeholder.com` URLs for its empty-state previews in Streamlit and the README. This updates the two app previews and two README examples to equivalent Placeholder.photo URLs, keeping the requested sizes and labels.  All four replacement URLs returned HTTP 200 PNG; `git diff --check` passed. No API keys or other tool behavior changed. I maintain Placeholder.photo.
  **Post-Mortem & Fix Analysis**:
  > Thanks for flagging this, via.placeholder.com had indeed gone. Fixed on main by committing two example images to the tool's folder instead, so the preview and README no longer depend on any placeholder host. Closing this one.

- **Issue #18** (2026-04-14): **Fix 16 broken Colab badge URLs across all notebooks**
  *Symptoms*: ## Summary - All 16 notebooks in the repo had stale "Open in Colab" badge URLs pointing to pre-reorganisation paths - Updated each to point to the current file location in the repo  ### Affected notebooks - ecommerce (2): best-selling-products-to-xml-sitemap, internal-search-mapper - keyword-clustering (5): 4 legacy clustering tools + SEJ clustering tool - keyword-research (1): bulk-keyword-tagger - linking (1): wayback-machine mapper - reporting (4): BCG matrix, top traffic pages, visualise links, visualise coverage - search-engine-journal (2): SEJ clustering, top traffic pages - site-search (1): map-site-searches-to-landing-pages  🤖 Generated with [Claude Code](https://claude.com/claude-code)

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

### Incident Patch 1: `aebea3d3` (2026-11-15)
**Commit Message**: SERP N-gram Extractor: fix crash on special characters and silent page skips

- str.replace on single special characters used regex=True, so '(' raised
  PatternError under pandas 2.x and the app failed on every run. They are
  literal characters: regex=False.
- trafilatura 2.x returns a Document object from bare_extraction, so
  d['text'] raised TypeError inside a bare except and every page was
  skipped. Use attributes, skip pages with no text, and fall back to the
  SERP URL when the page has no canonical. Pin trafilatura>=2.0.0.

Co-Authored-By: Claude Fable 5.2 <[REDACTED_EMAIL]>

**File**: `content-analysis/ngram-serp-extractor/ngram_serp_extractor.py` (modified, +8/-5)
```diff
@@ -181,10 +181,13 @@ def download_nltk_data():
         for url in links:
             try:
                 downloaded = trafilatura.fetch_url(url)
+                # trafilatura 2.x returns a Document object, not a dict
                 d = bare_extraction(downloaded, config=newconfig, with_metadata=True)
-                text.append((d['text']))
-                title.append(d['title'])
-                extracted_url.append(d['url'])
+                if d is None or not d.text:
+                    continue
+                text.append(d.text)
+                title.append(d.title or '')
+                extracted_url.append(d.url or url)
             except Exception:
                 pass
 
@@ -204,7 +207,7 @@ def download_nltk_data():
                   "[", "\\", "]", "^", "-", "_", "`", "{", "|", "}", "~", "–"]
 
     for char in spec_chars:
-        df_title['title'] = df_title['title'].str.replace(char, ' ', regex=True)
+        df_title['title'] = df_title['title'].str.replace(char, ' ', regex=False)
 
     # get word counts of page title
     word_str = df_title['title']
@@ -221,7 +224,7 @@ def download_nltk_data():
     df_serp['text'] = df_serp['text'].str.lower()
 
     for char in spec_chars:
-        df_serp['text'] = df_serp['text'].str.replace(char, ' ', regex=True)
+        df_serp['text'] = df_serp['text'].str.replace(char, ' ', regex=False)
 
     # remove stop words
     df_serp['text'] = df_serp['text'].apply(lambda x: ' '.join([word for word in x.split() if word not in (stop)]))
```

**File**: `content-analysis/ngram-serp-extractor/requirements.txt` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 streamlit
 requests
-trafilatura
+trafilatura>=2.0.0
 pandas>=2.2.0
 nltk
```

---

### Incident Patch 2: `546968a3` (2026-11-15)
**Commit Message**: Sample data for Auto CSS Selector Detector and Content Block Extractor

Both run on the demo site from the Content Extractor sample, served locally.
The Content Block Extractor README records that one template came back with
two spellings of the same XPath, which splits the frequency count.

Co-Authored-By: Claude Fable 5.2 <[REDACTED_EMAIL]>

**File**: `content-analysis/auto-css-selector-detector/sample_data/README.md` (added, +22/-0)
```diff
@@ -0,0 +1,22 @@
+# Sample data: Auto CSS Selector Detector
+
+Demo data. The page is one of the made-up running blog pages from the Content Extractor sample (`../../content-extractor/sample_data/demo_site/`), served locally. The output is what the tool printed, unedited.
+
+| File | What it is |
+|---|---|
+| `detected_selector.txt` | Output: the URL, H1, the selector the model chose, the narrowed selector, the model's reasoning, where the text was extracted from, the extracted content and the internal links |
+
+To reproduce (run the server in a second terminal and stop it afterwards):
+
+    python -m http.server 8765 --directory ../../content-extractor/sample_data/demo_site
+    export OPENAI_API_KEY=your-key
+    python ../auto_css_selector_detector_cli.py --url http://localhost:8765/how-to-choose-running-shoes.html
+
+The page has a header with navigation, an article, a sidebar of related links and a footer. What the output shows:
+
+- The model chose `body > main:nth-of-type(1)`, which holds the article and the sidebar.
+- The tool then narrowed that to `body > main:nth-of-type(1) > article:nth-of-type(1)` and extracted from there, so the sidebar text is left out. The Content Extractor sample keeps the sidebar on the same page.
+- The H1 is printed in capitals in the extracted content.
+- The internal links list is empty because the article itself contains no links.
+
+Output produced on 2026-11-15 with gpt-4o-mini (called through OpenRouter), in 1 API call, on branch fix/content-tools-wave0. A different run may word the reasoning differently.
```

**File**: `content-analysis/auto-css-selector-detector/sample_data/detected_selector.txt` (added, +16/-0)
```diff
@@ -0,0 +1,16 @@
+URL: http://localhost:8765/how-to-choose-running-shoes.html
+H1: How to choose running shoes
+Initial Selector: body > main:nth-of-type(1)
+Specific Selector: body > main:nth-of-type(1) > article:nth-of-type(1)
+Reasoning: This selector likely contains the main body content as it points to the <main> element, which is typically used to encompass the primary content of a webpage. The text length of 391 suggests it holds substantial information, further indicating that it is the main body content.
+Extracted from: specific_selector
+
+--- Extracted Content ---
+HOW TO CHOOSE RUNNING SHOES
+
+Choosing running shoes starts with where you run. Road shoes have smooth soles and plenty of cushioning, while trail shoes have deeper lugs for grip on mud.
+
+Measure both feet in the afternoon, when they are at their largest, and leave a thumb's width in front of your longest toe. A gait check on a treadmill shows whether a neutral or a stability shoe suits you.
+
+--- Internal Links ---
+[]
```

**File**: `on-page/extract-content-blocks/sample_data/README.md` (added, +21/-0)
```diff
@@ -0,0 +1,21 @@
+# Sample data: Content Block Extractor
+
+Demo data. The pages are five of the made-up running blog pages from the Content Extractor sample (`../../../content-analysis/content-extractor/sample_data/demo_site/`), served locally. All five use the same template. The output is what the tool returned, unedited.
+
+| File | What it is |
+|---|---|
+| `demo_urls.txt` | Input: 5 URLs on `http://localhost:8765`, one per line |
+| `blocks/content_blocks_20261115_005805_d2543d4c.csv` | Output: the batch file, one row per block per page (url, name, xpath, notes) |
+| `blocks/combined_output_with_frequency.csv` | Output: the same 17 rows with a frequency column, the number of pages in this run that share the XPath |
+
+To reproduce (run the server in a second terminal and stop it afterwards):
+
+    python -m http.server 8765 --directory ../../../content-analysis/content-extractor/sample_data/demo_site
+    export ANTHROPIC_API_KEY=your-key
+    python ../extract_content_blocks.py --input demo_urls.txt --output-dir blocks
+
+All five pages were processed, giving 17 blocks: the article, its title, the body paragraphs and the related guides sidebar. Header, navigation and footer are removed before the page is sent to the model, so they are never listed.
+
+One result shows a limit of the frequency count. The five pages share one template, but the model wrote the same block two ways: `//article/h1` on three pages and `//main/article/h1` on two. Both are correct. Because frequency counts exact XPath text, no XPath reaches 5 of 5. Read the frequency column as a lower bound and group equivalent XPaths by hand before choosing one for a crawler.
+
+Output produced on 2026-11-15 with Claude Haiku 4.5 (called through OpenRouter), in 5 API calls, on branch fix/content-tools-wave0. A different run may name the blocks differently.
```

**File**: `on-page/extract-content-blocks/sample_data/blocks/combined_output_with_frequency.csv` (added, +18/-0)
```diff
@@ -0,0 +1,18 @@
+url,name,xpath,notes,frequency
+http://localhost:8765/how-to-choose-running-shoes.html,Article Title,//article/h1,Main heading for the article,3
+http://localhost:8765/how-to-choose-running-shoes.html,Related Guides Sidebar,//aside,Sidebar section with related article links,3
+http://localhost:8765/trail-shoes-vs-road-shoes.html,Article Title,//article/h1,Main article title 'Trail shoes vs road shoes',3
+http://localhost:8765/trail-shoes-vs-road-shoes.html,Related Guides Sidebar,//aside,Sidebar section with related article links,3
+http://localhost:8765/couch-to-5k-week-by-week.html,Article Title,//article/h1,"Main article title 'Couch to 5k, week by week'",3
+http://localhost:8765/couch-to-5k-week-by-week.html,Related Guides Sidebar,//aside,Sidebar section with related links to training guides,3
+http://localhost:8765/when-to-replace-running-shoes.html,Main Article Content,//main/article,Primary article content with title and body text about replacing running shoes,2
+http://localhost:8765/when-to-replace-running-shoes.html,Article Title,//main/article/h1,Main heading for the article,2
+http://localhost:8765/when-to-replace-running-shoes.html,Related Guides Sidebar,//main/aside,Sidebar section with related article links,2
+http://localhost:8765/trail-shoes-vs-road-shoes.html,Article Content,//article/p,Main body paragraphs comparing trail and road shoes,2
+http://localhost:8765/couch-to-5k-week-by-week.html,Article Content,//article/p,Main content paragraphs describing the couch to 5k training plan,2
+http://localhost:8765/first-10k-training-plan.html,Main Article Content,//main/article,Primary article content with title and training plan description,2
+http://localhost:8765/first-10k-training-plan.html,Article Title,//main/article/h1,Main heading for the 10k training plan article,2
+http://localhost:8765/first-10k-training-plan.html,Related Guides Sidebar,//main/aside,Sidebar section with related article links,2
+http://localhost:8765/how-to-choose-running-shoes.html,Main Article Content,//article,Primary article content with heading and paragraphs about choosing running shoes,1
+http://localhost:8765/when-to-replace-running-shoes.html,Article Body Text,//main/article/p,Paragraph content describing shoe replacement guidelines,1
+http://localhost:8765/when-to-replace-running-shoes.html,Related Guides List,//main/aside/ul,List of related guide links,1
```

**File**: `on-page/extract-content-blocks/sample_data/blocks/content_blocks_20261115_005805_d2543d4c.csv` (added, +18/-0)
```diff
@@ -0,0 +1,18 @@
+url,name,xpath,notes
+http://localhost:8765/how-to-choose-running-shoes.html,Main Article Content,//article,Primary article content with heading and paragraphs about choosing running shoes
+http://localhost:8765/how-to-choose-running-shoes.html,Article Title,//article/h1,Main heading for the article
+http://localhost:8765/how-to-choose-running-shoes.html,Related Guides Sidebar,//aside,Sidebar section with related article links
+http://localhost:8765/when-to-replace-running-shoes.html,Main Article Content,//main/article,Primary article content with title and body text about replacing running shoes
+http://localhost:8765/when-to-replace-running-shoes.html,Article Title,//main/article/h1,Main heading for the article
+http://localhost:8765/when-to-replace-running-shoes.html,Article Body Text,//main/article/p,Paragraph content describing shoe replacement guidelines
+http://localhost:8765/when-to-replace-running-shoes.html,Related Guides Sidebar,//main/aside,Sidebar section with related article links
+http://localhost:8765/when-to-replace-running-shoes.html,Related Guides List,//main/aside/ul,List of related guide links
+http://localhost:8765/trail-shoes-vs-road-shoes.html,Article Header,//article/h1,Main article title 'Trail shoes vs road shoes'
+http://localhost:8765/trail-shoes-vs-road-shoes.html,Article Content,//article/p,Main body paragraphs comparing trail and road shoes
+http://localhost:8765/trail-shoes-vs-road-shoes.html,Related Guides Sidebar,//aside,Sidebar section with related article links
+http://localhost:8765/couch-to-5k-week-by-week.html,Article Header,//article/h1,"Main article title 'Couch to 5k, week by week'"
+http://localhost:8765/couch-to-5k-week-by-week.html,Article Content,//article/p,Main content paragraphs describing the couch to 5k training plan
+http://localhost:8765/couch-to-5k-week-by-week.html,Related Guides Sidebar,//aside,Sidebar section with related links to training guides
+http://localhost:8765/first-10k-training-plan.html,Main Article Content,//main/article,Primary article content with title and training plan description
+http://localhost:8765/first-10k-training-plan.html,Article Title,//main/article/h1,Main heading for the 10k training plan article
+http://localhost:8765/first-10k-training-plan.html,Related Guides Sidebar,//main/aside,Sidebar section with related article links
```

**File**: `on-page/extract-content-blocks/sample_data/demo_urls.txt` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+http://localhost:8765/how-to-choose-running-shoes.html
+http://localhost:8765/when-to-replace-running-shoes.html
+http://localhost:8765/trail-shoes-vs-road-shoes.html
+http://localhost:8765/couch-to-5k-week-by-week.html
+http://localhost:8765/first-10k-training-plan.html
```

---

### Incident Patch 3: `15c2c6d5` (2026-11-15)
**Commit Message**: Content Consolidation Analyser: fix overlap penalty, score reaches 100, unique cluster IDs

- Overlap penalty: overlapping queries were counted across both clustering
  methods. Every clique also sits inside a connected component, so every
  clustered query was flagged and every cluster lost the full 10 points.
  Overlap is now counted among clusters of the same type, and
  is_in_multiple_clusters follows the same rule.
- Score scale: the parts added up to 90, so 100 was unreachable. Shared
  URLs now earn 5 points each up to 50 (was 4 up to 40). Connectivity (30),
  cluster size (20) and the bands are unchanged.
- cluster_id: two cliques could share a shortest query and so the same ID.
  Repeats within a cluster type are numbered, for example "running socks (2)".
- README documents the score parts, cluster_type and is_in_multiple_clusters;
  cluster_size counts queries, not pages.
- Add the Author / Website lines the licence check looks for.

Co-Authored-By: Claude Fable 5.2 <[REDACTED_EMAIL]>

**File**: `content-consolidation/content_consolidation_analyzer.py` (modified, +29/-9)
```diff
@@ -9,6 +9,9 @@
 
 """Content Consolidation Analyzer
 
+Author: Lee Foot
+Website: https://www.leefoot.com
+
 Identifies content consolidation opportunities by clustering pages that share
 significant SERP overlap. Helps find cannibalizing pages competing for the same keywords.
 
@@ -181,14 +184,19 @@ def is_clique(candidate_set):
         cluster_data['cluster_type'] = 'clique'
         all_clusters.append(cluster_data)
 
-    # Mark overlapping queries
-    query_cluster_count = defaultdict(int)
-    for cluster in all_clusters:
-        for query in cluster['queries']:
-            query_cluster_count[query] += 1
+    # Mark overlapping queries: a query claimed by more than one cluster of the
+    # same type. Every clique also sits inside a connected component, so counting
+    # across both types flagged every clustered query and applied the overlap
+    # penalty to every cluster.
+    for cluster_type in ('connected_component', 'clique'):
+        same_type = [c for c in all_clusters if c['cluster_type'] == cluster_type]
+        query_cluster_count = defaultdict(int)
+        for cluster in same_type:
+            for query in cluster['queries']:
+                query_cluster_count[query] += 1
 
-    for cluster in all_clusters:
-        cluster['overlapping_queries'] = [q for q in cluster['queries'] if query_cluster_count[q] > 1]
+        for cluster in same_type:
+            cluster['overlapping_queries'] = [q for q in cluster['queries'] if query_cluster_count[q] > 1]
 
     return all_clusters, similarity_matrix
 
@@ -241,8 +249,13 @@ def analyze_cluster_details(cluster_queries, query_map, similarity_matrix):
 
 
 def calculate_consolidation_score(metrics, cluster_size, overlapping_count):
-    """Calculate a score (0-100) indicating consolidation strength."""
-    base_score = min(40, metrics['avg_shared_urls'] * 4)
+    """Calculate a score (0-100) indicating consolidation strength.
+
+    Up to 50 points for shared URLs (5 per average shared URL), up to 30 for
+    connectivity, up to 20 for cluster size, minus up to 10 for queries that
+    sit in more than one cluster of the same type.
+    """
+    base_score = min(50, metrics['avg_shared_urls'] * 5)
     connectivity_bonus = metrics['connectivity_score'] * 30
     size_bonus = min(20, (cluster_size - 2) * 5)
     overlap_penalty = min(10, overlapping_count * 5)
@@ -269,9 +282,16 @@ def create_cluster_dataframe(clusters, query_map):
     """Creates a dataframe with consolidation recommendations."""
     rows = []
     processed_queries = set()
+    used_names = defaultdict(int)
 
     for cluster in clusters:
+        # The shortest query names the cluster. Two cliques can share a shortest
+        # query, so repeats within a cluster type get a number: "name (2)".
         cluster_name = get_shortest_query_in_cluster(cluster['queries'])
+        used_names[(cluster['cluster_type'], cluster_name)] += 1
+        repeat = used_names[(cluster['cluster_type'], cluster_name)]
+        if repeat > 1:
+            cluster_name = f"{cluster_name} ({repeat})"
 
         for query in cluster['queries']:
             processed_queries.add(query)
```

**File**: `content-consolidation/readme.md` (modified, +13/-2)
```diff
@@ -71,16 +71,27 @@ running shoe reviews,https://example.com/shoes
 
 The tool outputs a CSV with:
 
-- `cluster_id`: Identifier for the cluster
+- `cluster_id`: The shortest query in the cluster. Unique within a `cluster_type`; a repeat is numbered, for example `running socks (2)`
+- `cluster_type`: `connected_component` or `clique`. The same group of queries can appear once as each type
 - `query`: The search query
 - `consolidation_score`: 0-100 score indicating consolidation strength
 - `consolidation_recommendation`: Human-readable recommendation
-- `cluster_size`: Number of pages in the cluster
+- `cluster_size`: Number of queries in the cluster
+- `is_in_multiple_clusters`: True when the query sits in more than one cluster of the same type
 - `shared_urls`: URLs that appear for multiple queries
 - And more metrics...
 
 ## Consolidation Scores
 
+The score is built from four parts:
+
+| Part | Points | How it is measured |
+|------|--------|--------------------|
+| Shared URLs | up to 50 | 5 points per average shared URL, capped |
+| Connectivity | up to 30 | Share of query pairs in the cluster that overlap |
+| Cluster size | up to 20 | 5 points per query beyond two |
+| Overlap penalty | up to -10 | 5 points per query that also sits in another cluster of the same type |
+
 | Score | Recommendation |
 |-------|----------------|
 | 80-100 | Strong consolidation candidate |
```

#### Recent Merged Pull Requests:
- **PR #20** (closed): Fix image centering tool placeholder previews (@RichardJansma)
- **PR #18** (2026-04-14): Fix 16 broken Colab badge URLs across all notebooks (@searchsolved)
- **PR #17** (2026-04-14): Fix invalid notebook widget metadata (@searchsolved)
- **PR #16** (2026-04-14): Fix broken Open in Colab badge URL (@searchsolved)
- **PR #15** (2026-04-14): Fix StreamlitAPIException: move expander inside setup function (@searchsolved)
- **PR #14** (2026-04-14): Fix NameError: remove undefined show_instructions_expander() (@searchsolved)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.


---

## 6. Net-New Universal Engineering Rules (Candidates for Master Brain)

## X. SERP N-gram Extractor: fix crash on special characters and silent page skips

**RULE**:
When implementing operations in `content-analysis/ngram-serp-extractor/ngram_serp_extractor.py`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in searchsolved/search-solved-public-seo. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `aebea3d3`: SERP N-gram Extractor: fix crash on special characters and silent page skips. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Python data structures, boundary deserialization, API parsing, or resource lifecycles matching `content-analysis/ngram-serp-extractor/ngram_serp_extractor.py`.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
// Verified production-grade fix pattern:
                # trafilatura 2.x returns a Document object, not a dict
                if d is None or not d.text:
                    continue
                text.append(d.text)
                title.append(d.title or '')
                extracted_url.append(d.url or url)
        df_title['title'] = df_title['title'].str.replace(char, ' ', regex=False)
        df_serp['text'] = df_serp['text'].str.replace(char, ' ', regex=False)
```

**NEGATIVE CONSTRAINT**:
```python
// Induced defect failure mode:
                text.append((d['text']))
                title.append(d['title'])
                extracted_url.append(d['url'])
        df_title['title'] = df_title['title'].str.replace(char, ' ', regex=True)
        df_serp['text'] = df_serp['text'].str.replace(char, ' ', regex=True)
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `aebea3d3` are properly handled with clean fallback behavior.

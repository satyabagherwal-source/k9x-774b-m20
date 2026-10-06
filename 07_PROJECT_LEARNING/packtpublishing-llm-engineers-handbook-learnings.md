# Forensic Learning Record (Deep Inspection): PacktPublishing/LLM-Engineers-Handbook

> **Canonical Artifact**: `07_PROJECT_LEARNING/packtpublishing-llm-engineers-handbook-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/PacktPublishing/LLM-Engineers-Handbook](https://github.com/PacktPublishing/LLM-Engineers-Handbook))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:55:26.996Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `PacktPublishing/LLM-Engineers-Handbook`
- **Description**: The LLM's practical guide: From the fundamentals to deploying advanced LLM and RAG apps to AWS using LLMOps best practices
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 5362 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `llm_engineering/__init__.py`
```
from llm_engineering import application, domain, infrastructure
from llm_engineering.settings import settings

__all__ = ["settings", "application", "domain", "infrastructure"]

```

### Core Architecture Module: `llm_engineering/application/__init__.py`
```
from . import utils

__all__ = ["utils"]

```

### Core Architecture Module: `llm_engineering/application/crawlers/__init__.py`
```
from .dispatcher import CrawlerDispatcher
from .github import GithubCrawler
from .linkedin import LinkedInCrawler
from .medium import MediumCrawler

__all__ = ["CrawlerDispatcher", "GithubCrawler", "LinkedInCrawler", "MediumCrawler"]

```

### Core Architecture Module: `llm_engineering/application/crawlers/base.py`
```
import time
from abc import ABC, abstractmethod
from tempfile import mkdtemp

import chromedriver_autoinstaller
from selenium import webdriver
from selenium.webdriver.chrome.options import Options

from llm_engineering.domain.documents import NoSQLBaseDocument

# Check if the current version of chromedriver exists
# and if it doesn't exist, download it automatically,
# then add chromedriver to path
chromedriver_autoinstaller.install()


class BaseCrawler(ABC):
    model: type[NoSQLBaseDocument]

    @abstractmethod
    def extract(self, link: str, **kwargs) -> None: ...


class BaseSeleniumCrawler(BaseCrawler, ABC):
    def __init__(self, scroll_limit: int = 5) -> None:
        options = webdriver.ChromeOptions()

        options.add_argument("--no-sandbox")
        options.add_argument("--headless=new")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--log-level=3")
        options.add_argument("--disable-popup-blocking")
        options.add_argument("--disable-notifications")
        options.add_argument("--disable-extensions")
        options.add_argument("--disable-background-networking")
        options.add_argument("--ignore-certificate-errors")
        options.add_argument(f"--user-data-dir={mkdtemp()}")
        options.add_argument(f"--data-path={mkdtemp()}")
        options.add_argument(f"--disk-cache-dir={mkdtemp()}")
        options.add_argument("--remote-debugging-port=9226")

        self.set_extra_driver_options(options)

        self.scroll_limit = scroll_limit
        self.driver = webdriver.Chrome(
            options=options,
        )

    def set_extra_driver_options(self, options: Options) -> None:
        pass

    def login(self) -> None:
        pass

    def scroll_page(self) -> None:
        """Scroll through the LinkedIn page based on the scroll limit."""
        current_scroll = 0
        last_height = self.driver.execute_script("return document.body.scrollHeight")
        while True:
            self.driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
            time.sleep(5)
            new_height = self.driver.execute_script("return document.body.scrollHeight")
            if new_height == last_height or (self.scroll_limit and current_scroll >= self.scroll_limit):
                break
            last_height = new_height
            current_scroll += 1

```

### Core Architecture Module: `llm_engineering/application/crawlers/custom_article.py`
```
from urllib.parse import urlparse

from langchain_community.document_loaders import AsyncHtmlLoader
from langchain_community.document_transformers.html2text import Html2TextTransformer
from loguru import logger

from llm_engineering.domain.documents import ArticleDocument

from .base import BaseCrawler


class CustomArticleCrawler(BaseCrawler):
    model = ArticleDocument

    def __init__(self) -> None:
        super().__init__()

    def extract(self, link: str, **kwargs) -> None:
        old_model = self.model.find(link=link)
        if old_model is not None:
            logger.info(f"Article already exists in the database: {link}")

            return

        logger.info(f"Starting scrapping article: {link}")

        loader = AsyncHtmlLoader([link])
        docs = loader.load()

        html2text = Html2TextTransformer()
        docs_transformed = html2text.transform_documents(docs)
        doc_transformed = docs_transformed[0]

        content = {
            "Title": doc_transformed.metadata.get("title"),
            "Subtitle": doc_transformed.metadata.get("description"),
            "Content": doc_transformed.page_content,
            "language": doc_transformed.metadata.get("language"),
        }

        parsed_url = urlparse(link)
        platform = parsed_url.netloc

        user = kwargs["user"]
        instance = self.model(
            content=content,
            link=link,
            platform=platform,
            author_id=user.id,
            author_full_name=user.full_name,
        )
        instance.save()

        logger.info(f"Finished scrapping custom article: {link}")

```

### Core Architecture Module: `llm_engineering/application/crawlers/dispatcher.py`
```
import re
from urllib.parse import urlparse

from loguru import logger

from .base import BaseCrawler
from .custom_article import CustomArticleCrawler
from .github import GithubCrawler
from .linkedin import LinkedInCrawler
from .medium import MediumCrawler


class CrawlerDispatcher:
    def __init__(self) -> None:
        self._crawlers = {}

    @classmethod
    def build(cls) -> "CrawlerDispatcher":
        dispatcher = cls()

        return dispatcher

    def register_medium(self) -> "CrawlerDispatcher":
        self.register("https://medium.com", MediumCrawler)

        return self

    def register_linkedin(self) -> "CrawlerDispatcher":
        self.register("https://linkedin.com", LinkedInCrawler)

        return self

    def register_github(self) -> "CrawlerDispatcher":
        self.register("https://github.com", GithubCrawler)

        return self

    def register(self, domain: str, crawler: type[BaseCrawler]) -> None:
        parsed_domain = urlparse(domain)
        domain = parsed_domain.netloc

        self._crawlers[r"https://(www\.)?{}/*".format(re.escape(domain))] = crawler

    def get_crawler(self, url: str) -> BaseCrawler:
        for pattern, crawler in self._crawlers.items():
            if re.match(pattern, url):
                return crawler()
        else:
            logger.warning(f"No crawler found for {url}. Defaulting to CustomArticleCrawler.")

            return CustomArticleCrawler()

```

### Core Architecture Module: `llm_engineering/application/crawlers/github.py`
```
import os
import shutil
import subprocess
import tempfile

from loguru import logger

from llm_engineering.domain.documents import RepositoryDocument

from .base import BaseCrawler


class GithubCrawler(BaseCrawler):
    model = RepositoryDocument

    def __init__(self, ignore=(".git", ".toml", ".lock", ".png")) -> None:
        super().__init__()
        self._ignore = ignore

    def extract(self, link: str, **kwargs) -> None:
        old_model = self.model.find(link=link)
        if old_model is not None:
            logger.info(f"Repository already exists in the database: {link}")

            return

        logger.info(f"Starting scrapping GitHub repository: {link}")

        repo_name = link.rstrip("/").split("/")[-1]

        local_temp = tempfile.mkdtemp()

        try:
            os.chdir(local_temp)
            subprocess.run(["git", "clone", link])

            repo_path = os.path.join(local_temp, os.listdir(local_temp)[0])  # noqa: PTH118

            tree = {}
            for root, _, files in os.walk(repo_path):
                dir = root.replace(repo_path, "").lstrip("/")
                if dir.startswith(self._ignore):
                    continue

                for file in files:
                    if file.endswith(self._ignore):
                        continue
                    file_path = os.path.join(dir, file)  # noqa: PTH118
                    with open(os.path.join(root, file), "r", errors="ignore") as f:  # noqa: PTH123, PTH118
                        tree[file_path] = f.read().replace(" ", "")

            user = kwargs["user"]
            instance = self.model(
                content=tree,
                name=repo_name,
                link=link,
                platform="github",
                author_id=user.id,
                author_full_name=user.full_name,
            )
            instance.save()

        except Exception:
            raise
        finally:
            shutil.rmtree(local_temp)

        logger.info(f"Finished scrapping GitHub repository: {link}")

```

### Core Architecture Module: `llm_engineering/application/crawlers/linkedin.py`
```
import time
from typing import Dict, List

from bs4 import BeautifulSoup
from bs4.element import Tag
from loguru import logger
from selenium.webdriver.common.by import By

from llm_engineering.domain.documents import PostDocument
from llm_engineering.domain.exceptions import ImproperlyConfigured
from llm_engineering.settings import settings

from .base import BaseSeleniumCrawler


class LinkedInCrawler(BaseSeleniumCrawler):
    model = PostDocument

    def __init__(self, scroll_limit: int = 5, is_deprecated: bool = True) -> None:
        super().__init__(scroll_limit)

        self._is_deprecated = is_deprecated

    def set_extra_driver_options(self, options) -> None:
        options.add_experimental_option("detach", True)

    def login(self) -> None:
        if self._is_deprecated:
            raise DeprecationWarning(
                "As LinkedIn has updated its security measures, the login() method is no longer supported."
            )

        self.driver.get("https://www.linkedin.com/login")
        if not settings.LINKEDIN_USERNAME or not settings.LINKEDIN_PASSWORD:
            raise ImproperlyConfigured(
                "LinkedIn scraper requires the {LINKEDIN_USERNAME} and {LINKEDIN_PASSWORD} settings."
            )

        self.driver.find_element(By.ID, "username").send_keys(settings.LINKEDIN_USERNAME)
        self.driver.find_element(By.ID, "password").send_keys(settings.LINKEDIN_PASSWORD)
        self.driver.find_element(By.CSS_SELECTOR, ".login__form_action_container button").click()

    def extract(self, link: str, **kwargs) -> None:
        if self._is_deprecated:
            raise DeprecationWarning(
                "As LinkedIn has updated its feed structure, the extract() method is no longer supported."
            )

        if self.model.link is not None:
            old_model = self.model.find(link=link)
            if old_model is not None:
                logger.info(f"Post already exists in the database: {link}")

                return

        logger.info(f"Starting scrapping data for profile: {link}")

        self.login()

        soup = self._get_page_content(link)

        data = {  # noqa
            "Name": self._scrape_section(soup, "h1", class_="text-heading-xlarge"),
            "About": self._scrape_section(soup, "div", class_="display-flex ph5 pv3"),
            "Main Page": self._scrape_section(soup, "div", {"id": "main-content"}),
            "Experience": self._scrape_experience(link),
            "Education": self._scrape_education(link),
        }

        self.driver.get(link)
        time.sleep(5)
        button = self.driver.find_element(
            By.CSS_SELECTOR, ".app-aware-link.profile-creator-shared-content-view__footer-action"
        )
        button.click()

        # Scrolling and scraping posts
        self.scroll_page()
        soup = BeautifulSoup(self.driver.page_source, "html.parser")
        post_elements = soup.find_all(
            "div",
            class_="update-components-text relative update-components-update-v2__commentary",
        )
        buttons = soup.find_all("button", class_="update-components-image__image-link")
        post_images = self._extract_image_urls(buttons)

        posts = self._extract_posts(post_elements, post_images)
        logger.info(f"Found {len(posts)} posts for profile: {link}")

        self.driver.close()

        user = kwargs["user"]
        self.model.bulk_insert(
            [
                PostDocument(platform="linkedin", content=post, author_id=user.id, author_full_name=user.full_name)
                for post in posts
            ]
        )

        logger.info(f"Finished scrapping data for profile: {link}")

    def _scrape_section(self, soup: BeautifulSoup, *args, **kwargs) -> str:
        """Scrape a specific section of the LinkedIn profile."""
        # Example: Scrape the 'About' section

        parent_div = soup.find(*args, **kwargs)

        return parent_div.get_text(strip=True) if parent_div else ""

    def _extract_image_urls(self, buttons: List[Tag]) -> Dict[str, str]:
        """
        Extracts image URLs from button elements.

        Args:
            buttons (List[Tag]): A list of BeautifulSoup Tag objects representing buttons.

        Returns:
            Dict[str, str]: A dictionary mapping post indexes to image URLs.
        """

        post_images = {}
        for i, button in enumerate(buttons):
            img_tag = button.find("img")
            if img_tag and "src" in img_tag.attrs:
                post_images[f"Post_{i}"] = img_tag["src"]
            else:
                logger.warning("No image found in this button")
        return post_images

    def _get_page_content(self, url: str) -> BeautifulSoup:
        """Retrieve the page content of a given URL."""

        self.driver.get(url)
        time.sleep(5)

        return BeautifulSoup(self.driver.page_source, "html.parser")

    def _extract_posts(self, post_elements: List[Tag], post_images: Dict[str, str]) -> Dict[str, Dict[str, str]]:
        """
        Extracts post texts and combines them with their respective images.

        Args:
            post_elements (List[Tag]): A list of BeautifulSoup Tag objects representing post elements.
            post_images (Dict[str, str]): A dictionary containing image URLs mapped by post index.

        Returns:
            Dict[str, Dict[str, str]]: A dictionary containing post data with text and optional image URL.
        """

        posts_data = {}
        for i, post_element in enumerate(post_elements):
            post_text = post_element.get_text(strip=True, separator="\n")
            post_data = {"text": post_text}
            if f"Post_{i}" in post_images:
                post_data["image"] = post_images[f"Post_{i}"]
            posts_data[f"Post_{i}"] = post_data

        return posts_data

    def _scrape_experience(self, profile_url: str) -> str:
        """Scrapes the Experience section of the LinkedIn profile."""

        self.driver.get(profile_url + "/details/experience/")
        time.sleep(5)
        soup = BeautifulSoup(self.driver.page_source, "html.parser")
        experience_content = soup.find("section", {"id": "experience-section"})

        return experience_content.get_text(strip=True) if experience_content else ""

    def _scrape_education(self, profile_url: str) -> str:
        self.driver.get(profile_url + "/details/education/")
        time.sleep(5)
        soup = BeautifulSoup(self.driver.page_source, "html.parser")
        education_content = soup.find("section", {"id": "education-section"})

        return education_content.get_text(strip=True) if education_content else ""

```

### Core Architecture Module: `llm_engineering/application/crawlers/medium.py`
```
from bs4 import BeautifulSoup
from loguru import logger

from llm_engineering.domain.documents import ArticleDocument

from .base import BaseSeleniumCrawler


class MediumCrawler(BaseSeleniumCrawler):
    model = ArticleDocument

    def set_extra_driver_options(self, options) -> None:
        options.add_argument(r"--profile-directory=Profile 2")

    def extract(self, link: str, **kwargs) -> None:
        old_model = self.model.find(link=link)
        if old_model is not None:
            logger.info(f"Article already exists in the database: {link}")

            return

        logger.info(f"Starting scrapping Medium article: {link}")

        self.driver.get(link)
        self.scroll_page()

        soup = BeautifulSoup(self.driver.page_source, "html.parser")
        title = soup.find_all("h1", class_="pw-post-title")
        subtitle = soup.find_all("h2", class_="pw-subtitle-paragraph")

        data = {
            "Title": title[0].string if title else None,
            "Subtitle": subtitle[0].string if subtitle else None,
            "Content": soup.get_text(),
        }

        self.driver.close()

        user = kwargs["user"]
        instance = self.model(
            platform="medium",
            content=data,
            link=link,
            author_id=user.id,
            author_full_name=user.full_name,
        )
        instance.save()

        logger.info(f"Successfully scraped and saved article: {link}")

```

### Core Architecture Module: `llm_engineering/application/dataset/__init__.py`
```
from . import generation

__all__ = ["generation"]

```

### Core Architecture Module: `llm_engineering/application/dataset/constants.py`
```
from llm_engineering.domain.dataset import DatasetType

MOCKED_RESPONSE_INSTRUCT = """
[
    {"instruction": "<mocked generated instruction> 1", "answer": "<mocked generated answer> 1"},
    {"instruction": "<mocked generated instruction> 2", "answer": "<mocked generated answer> 2"},
    {"instruction": "<mocked generated instruction> 3", "answer": "<mocked generated answer> 3"}
]
"""

MOCKED_RESPONSE_PREFERENCE = """
[
    {"instruction": "<mocked generated instruction> 1", "rejected": "<mocked generated answer> 1", "chosen": "Mocked extracted extracted extracted extracted extracted extracted extracted extracted extracted extracted answer 1."},
    {"instruction": "<mocked generated instruction> 2", "rejected": "<mocked generated answer> 2", "chosen": "Mocked extracted extracted extracted extracted extracted extracted extracted extracted extracted extracted answer 2."},
    {"instruction": "<mocked generated instruction> 3", "rejected": "<mocked generated answer> 3", "chosen": "Mocked extracted answer 3"}
]
"""


def get_mocked_response(dataset_type: DatasetType) -> str:
    if dataset_type == DatasetType.INSTRUCTION:
        return MOCKED_RESPONSE_INSTRUCT
    elif dataset_type == DatasetType.PREFERENCE:
        return MOCKED_RESPONSE_PREFERENCE
    else:
        raise ValueError(f"Invalid dataset type: {dataset_type}")

```

### Core Architecture Module: `llm_engineering/application/dataset/generation.py`
```
from abc import ABC, abstractmethod

import tiktoken
from langchain_core.exceptions import OutputParserException
from langchain_core.language_models.fake import FakeListLLM
from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage
from langchain_core.prompts import PromptTemplate
from langchain_openai import ChatOpenAI
from loguru import logger

from llm_engineering import domain
from llm_engineering.application import utils
from llm_engineering.domain.cleaned_documents import CleanedDocument
from llm_engineering.domain.dataset import DatasetType, TrainTestSplit
from llm_engineering.domain.prompt import GenerateDatasetSamplesPrompt, Prompt
from llm_engineering.domain.types import DataCategory
from llm_engineering.settings import settings

from . import constants
from . import utils as generation_utils
from .output_parsers import ListPydanticOutputParser


class DatasetGenerator(ABC):
    tokenizer = tiktoken.encoding_for_model(settings.OPENAI_MODEL_ID)
    dataset_type: DatasetType | None = None

    system_prompt_template = """You are a helpful assistant who generates {dataset_format} based on the given context. \
Provide your response in JSON format.
"""
    prompt_template_str: str | None = None

    @classmethod
    def get_system_prompt(cls) -> Prompt:
        assert cls.dataset_type is not None, "Dataset type must be set before calling get_system_prompt()"

        dataset_format = (
            "instruction-answer pairs" if cls.dataset_type == DatasetType.INSTRUCTION else "instruction-answer triples"
        )
        input_variables = {
            "dataset_format": dataset_format,
        }
        system_prompt = cls.system_prompt_template.format(**input_variables)

        return Prompt(
            template=cls.system_prompt_template,
            input_variables=input_variables,
            content=system_prompt,
        )

    @classmethod
    def get_prompts(cls, documents: list[CleanedDocument]) -> dict[DataCategory, list[GenerateDatasetSamplesPrompt]]:
        documents = generation_utils.extract_substrings(documents)

        grouped_prompts = {}
        grouped_cleaned_documents = CleanedDocument.group_by_category(documents)
        for category, category_documents in grouped_cleaned_documents.items():
            category_prompts = [cls.get_prompt(document) for document in category_documents]
            grouped_prompts[category] = category_prompts

        return grouped_prompts

    @classmethod
    def get_prompt(cls, document: CleanedDocument) -> GenerateDatasetSamplesPrompt:
        assert cls.prompt_template_str is not None, "Prompt template must be set before calling get_prompt()"

        data_category = document.get_category()

        prompt_template = PromptTemplate.from_template(
            template=cls.prompt_template_str,
            template_format="jinja2",
        )
        input_variables = {
            "extract": document.content,
        }
        prompt = prompt_template.format(**input_variables)
        prompt_tokens = cls.tokenizer.encode(prompt)
        if len(prompt_tokens) > settings.OPENAI_MAX_TOKEN_WINDOW:
            prompt_tokens = prompt_tokens[: settings.OPENAI_MAX_TOKEN_WINDOW]
            prompt = cls.tokenizer.decode(prompt_tokens)

        prompt = GenerateDatasetSamplesPrompt(
            template=prompt_template.template,
            input_variables=input_variables,
            content=prompt,
            num_tokens=len(prompt_tokens),
            data_category=data_category,
            document=document,
        )

        return prompt

    @classmethod
    def generate(
        cls,
        prompts: dict[DataCategory, list[GenerateDatasetSamplesPrompt]],
        test_size: float = 0.2,
        mock: bool = False,
    ) -> TrainTestSplit:
        assert cls.dataset_type is not None, "Dataset type must be set before calling generate()"

        def _to_langchain(
            prompt: GenerateDatasetSamplesPrompt,
        ) -> list[BaseMessage]:
            messages = [
                SystemMessage(content=cls.get_system_prompt().content),
                HumanMessage(content=prompt.content),
            ]

            return messages

        if mock:
            llm = FakeListLLM(responses=[constants.get_mocked_response(cls.dataset_type)])
        else:
            assert settings.OPENAI_API_KEY is not None, "OpenAI API key must be set to generate datasets"

            llm = ChatOpenAI(
                model=settings.OPENAI_MODEL_ID,
                api_key=settings.OPENAI_API_KEY,
                max_tokens=2000 if cls.dataset_type == DatasetType.PREFERENCE else 1200,
                temperature=0.7,
            )
        parser = ListPydanticOutputParser(pydantic_object=cls._get_dataset_sample_type())

        chain = llm | parser

        datasets = {}
        for category, category_prompts in prompts.items():
            langchain_category_prompts = [_to_langchain(prompt) for prompt in category_prompts]
            batches = utils.misc.batch(langchain_category_prompts, size=24)

            flattened_instruct_dataset_samples = []
            for batch in batches:
                try:
                    batched_dataset_samples = chain.batch(batch, stop=None)

                    for instruct_dataset_sample_batch in batched_dataset_samples:
                        flattened_instruct_dataset_samples.extend(instruct_dataset_sample_batch)
                except OutputParserException:
                    logger.exception(f"Failed to parse the output JSON for a batch for category {category}")

            dataset = domain.dataset.build_dataset(
                dataset_type=cls.dataset_type, category=category, samples=flattened_instruct_dataset_samples
            )
            datasets[category] = dataset
            logger.info(f"Generated {len(dataset.samples)} samples for category '{category}'.")

        processed_datasets = cls.post_process_datasets(datasets, test_size=test_size)

        return processed_datasets

    @classmethod
    def _get_dataset_sample_type(
        cls,
    ) -> type[domain.dataset.InstructDatasetSample] | type[domain.dataset.PreferenceDatasetSample]:
        return (
            domain.dataset.InstructDatasetSample
            if cls.dataset_type == DatasetType.INSTRUCTION
            else domain.dataset.PreferenceDatasetSample
        )

    @classmethod
    @abstractmethod
    def post_process_datasets(
        cls, datasets: dict[DataCategory, domain.dataset.InstructDataset], test_size: float
    ) -> TrainTestSplit:
        pass


class InstructionDatasetGenerator(DatasetGenerator):
    dataset_type = DatasetType.INSTRUCTION

    prompt_template_str = """Based on the following extract, generate five instruction-answer pairs. Each instruction \
must ask to write about a specific topic contained in the context. Each answer \
must provide a relevant paragraph based on the information found in the \
context. Only use concepts from the context to generate the instructions. \
Instructions must never explicitly mention a context, a system, a course, or an extract. \
Instructions must be self-contained and general. \
Answers must imitate the writing style of the context. \
    
Example instruction: Explain the concept of an LLM Twin. \
Example answer: An LLM Twin is essentially an AI character that mimics your writing style, personality, and voice. \
It's designed to write just like you by incorporating these elements into a language model. \
The idea is to create a digital replica of your writing habits using advanced AI techniques. \

Structure the answer in JSON format, ready to be loaded in Python by json.loads(), as a list of objects.
Do not add any extra characters and provide your response in JSON format with the following structure:
[
    {"instruction": "...", "answer": "..."},
    ...
]

Extract:
{{extract}}
"""

    @classmethod
    def post_process_datasets(
        cls, datasets: dict[DataCategory, domain.dataset.InstructDataset], test_size: float
    ) -> TrainTestSplit:
        train_test_split = generation_utils.create_instruct_train_test_split(
            datasets, test_size=test_size, random_state=42
        )

        return train_test_split


class PreferenceDatasetGenerator(DatasetGenerator):
    dataset_type = DatasetType.PREFERENCE

    prompt_template_str = """Based on the following extract, generate five instruction-answer triples. Each triple should consist of:
1. An instruction asking about a specific topic in the context.
2. A generated answer that attempts to answer the instruction based on the context, named as 'rejected'.
3. An extracted answer that is a relevant excerpt directly from the given context, named as 'chosen'.

Instructions must be self-contained and general, without explicitly mentioning a context, system, course, or extract.

Important:
- Ensure that the extracted answer, the chosen one, is a verbatim copy from the context, including all punctuation and apostrophes.
- Do not add any ellipsis (...) or [...]  to indicate skipped text in the extracted answer.
- If the relevant text is not continuous, use two separate sentences from the context instead of skipping text.

Structure the answer in JSON format, ready to be loaded in Python by json.loads(), as a list of objects.
Do not add any extra characters and provide your response in JSON format with the following structure:
[
    {
        "instruction": "...",
        "rejected": "...",
        "chosen": "..."
    },
    ...
]

Extract:
{{extract}}
"""

    @classmethod
    def post_process_datasets(
        cls, datasets: dict[DataCategory, domain.dataset.PreferenceDataset], test_size: float
    ) -> TrainTestSplit:
        datasets = generation_utils.filter_short_answers(datasets)
        datasets = generation_utils.filter_answer_format(datasets)

        remaining_samples = sum([dataset.num_samples for dataset in datasets.values()])
        logger.info(
            f"Filtered out short answers and answers wi
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #81** (2026-10-03): **MongoDB cannot start: Linux kernel versions 6.19 and newer has a known incompatibility**
  *Symptoms*: {"t":{"$date":"2026-10-01T23:02:23.659+00:00"},"s":"F",  "c":"CONTROL",  "id":12257600,"ctx":"main","msg":"MongoDB cannot start: Linux kernel versions 6.19 and newer has a known incompatibility with this version of MongoDB. See https://jira.mongodb.org/browse/SERVER-121912 for more information."}
  **Post-Mortem & Fix Analysis**:
  > MongoDB 7.0 Works!

- **Issue #78** (2026-08-02): **feat: route LLM calls through a configurable OpenAI-compatible endpoint**
  *Symptoms*: Switch the default provider from OpenAI gpt-4o-mini to DeepSeek by adding a BASE_URL setting and threading it through every ChatOpenAI/OpenAI client:  - settings: add BASE_URL, default OPENAI_MODEL_ID to deepseek-v4-flash - rag: pass base_url in query expansion and self-query - dataset generation: pass base_url; switch the tokenizer to the fixed cl100k_base encoding, since tiktoken cannot resolve a non-OpenAI model id - evaluation: read BASE_URL/OPENAI_MODEL_ID from env and forward them to the SageMaker job environment instead of hardcoding gpt-4o-mini  Also adds a work-in-progress generate_instruct_dataset step, a Claude Code post-tool-call provenance hook, IDE project files, and typing-extensions.  Known broken in this commit (checkpoint, not a working tree): - steps/etl/crawl_links.py is empty, so steps.etl fails to import - get_or_create_user no longer returns its user document

- **Issue #66** (2025-09-11): **try claude code PR**
  *Symptoms*: @claude please help me see if the links in end_to_end_pipline.yaml are all still working or not

- **Issue #63** (2025-09-08): **Feature/trigger ci**
  *Symptoms*: TRY

- **Issue #54** (2025-05-11): **Env setup issue**
  *Symptoms*: I have been following the README in this repo to setup my local env but i see the following issue. This repo was listed for the book.  ```zsh Installing the current project: llm-engineering (0.1.0)  ➜  code-samples git:(main) poetry run pre-commit install pre-commit installed at .git/hooks/pre-commit  ➜  code-samples git:(main) poetry shell Spawning shell within /home/adilfulara/.cache/pypoetry/virtualenvs/llm-engineering-a1FkSGAR-py3.11  ➜  code-samples git:(main) emulate bash -c '. /home/adilfulara/.cache/pypoetry/virtualenvs/llm-engineering-a1FkSGAR-py3.11/ bin/activate'  (llm-engineering-py3.11) ➜  code-samples git:(main) poetry poe --help                                                  The requested command poe does not exist  (llm-engineering-py3.11) ➜  code-samples git:(main) poetry run local-infrastructure-up                                                                                                                                                                                                Command not found: local-infrastructure-up  ```  I am not a python expert. Poe tool is available globally  ```zsh  # install ➜ pipx install poe  ➜ poe --version Poe the Poet - version: 0.29.0  ```  My env currently (default python@3.10.8 is installed by brew and python@3.11.8 is installed by pyenv) ```zsh poetry debug info                                                                                                                                                           
  **Post-Mortem & Fix Analysis**:
  > Hello @adilfulara,  Did you install Poe the Poet as a `poetry` plugin?  Here is the command: ```shell poetry self add 'poethepoet[poetry_plugin]' ```  I don't use `poetry` but `pixi` (which uses `uv` underneath). I rewrote all the commands within `pyproject.toml` as a consequence. If you or someone want the `pixi` version, notify me.  Edit: You can find the rewrote commands with `pixi` [here](https://github.com/pabroux/llm-engineers-handbook).
  > @pabroux there are no instructions to install the said tool. so i am unsure of what to do.
  > ```shell poetry self add 'poethepoet[poetry_plugin]' ```  That command is described in chapter 2 of the book, page 29.  `pixi` on the other hand is an alternative to what proposed the authors (i.e. `poetry` with its plugin "Poe the Poet"), non listed in the suggested alternatives (page 29 too).

- **Issue #53** (2025-04-11): **Cosine Distance range**
  *Symptoms*: I am confused regarding the range of Cosine Distance [-1,1] as stated in the book page 105.   <img width="1041" alt="Image" src="https://github.com/user-attachments/assets/10ea44e5-c8c2-4798-b1b0-fe35bf0aeebb" />   I think [-1,1] is the range of Cosine similarity and not the range of Cosine Distance, and 1- Cosine Similarity will make the range to be between [0,2].   
  **Post-Mortem & Fix Analysis**:
  > You are right @Hawar-Dzaee. I made a mistake.  The principles are the same, but here is how to interpret the formula: "With this formula, we are quantifying cosine distance with a range from 0 to 2. A cosine distance of 0 means the vectors are perfectly aligned (no angle between them), indicating maximum similarity, while a value closer to 2 suggests they are diametrically opposite, indicating maximum dissimilarity."

- **Issue #50** (2025-03-02): **[withdrawn] Init steven**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > I apologize for the incorrect pull request. This was meant for a different target repository. Closing this PR.

- **Issue #48** (2025-03-08): **Feature/bump zenml version**
  *Symptoms*: Update the recent version of Zen ML so that readers would be able to errors when local and remote ZenML versions are different (at least for some time)

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

### Incident Patch 1: `1944c7a3` (2025-03-08)
**Commit Message**: chore: Fix Type

**File**: `.env.example` (modified, +1/-1)
```diff
@@ -11,7 +11,7 @@ HUGGINGFACE_ACCESS_TOKEN=str
 COMET_API_KEY=str
 
 # --- Required settings when deploying the code. ---
-# --- Otherwise, default values values work fine. ---
+# --- Otherwise, default values work fine. ---
 
 # MongoDB database
 DATABASE_HOST="mongodb://llm_engineering:llm_engineering@127.0.0.1:27017"
```

---

### Incident Patch 2: `e97ca808` (2025-03-08)
**Commit Message**: fix: Lock file

**File**: `poetry.lock` (modified, +90/-51)
```diff
@@ -1,4 +1,4 @@
-# This file is automatically @generated by Poetry 1.8.3 and should not be changed by hand.
+# This file is automatically @generated by Poetry 1.8.4 and should not be changed by hand.
 
 [[package]]
 name = "aiobotocore"
@@ -3645,13 +3645,12 @@ files = [
 
 [[package]]
 name = "nvidia-cudnn-cu12"
-version = "9.1.0.70"
+version = "8.9.2.26"
 description = "cuDNN runtime libraries"
 optional = false
 python-versions = ">=3"
 files = [
-    {file = "nvidia_cudnn_cu12-9.1.0.70-py3-none-manylinux2014_x86_64.whl", hash = "sha256:165764f44ef8c61fcdfdfdbe769d687e06374059fbb388b6c89ecb0e28793a6f"},
-    {file = "nvidia_cudnn_cu12-9.1.0.70-py3-none-win_amd64.whl", hash = "sha256:6278562929433d68365a07a4a1546c237ba2849852c0d4b2262a486e805b977a"},
+    {file = "nvidia_cudnn_cu12-8.9.2.26-py3-none-manylinux1_x86_64.whl", hash = "sha256:5ccb288774fdfb07a7e7025ffec286971c06d8d7b4fb162525334616d7629ff9"},
 ]
 
 [package.dependencies]
@@ -3711,13 +3710,12 @@ nvidia-nvjitlink-cu12 = "*"
 
 [[package]]
 name = "nvidia-nccl-cu12"
-version = "2.20.5"
+version = "2.19.3"
 description = "NVIDIA Collective Communication Library (NCCL) Runtime"
 optional = false
 python-versions = ">=3"
 files = [
-    {file = "nvidia_nccl_cu12-2.20.5-py3-none-manylinux2014_aarch64.whl", hash = "sha256:1fc150d5c3250b170b29410ba682384b14581db722b2531b0d8d33c595f33d01"},
-    {file = "nvidia_nccl_cu12-2.20.5-py3-none-manylinux2014_x86_64.whl", hash = "sha256:057f6bf9685f75215d0c53bf3ac4a10b3e6578351de307abad9e18a99182af56"},
+    {file = "nvidia_nccl_cu12-2.19.3-py3-none-manylinux1_x86_64.whl", hash = "sha256:a9734707a2c96443331c1e48c717024aa6678a0e2a4cb66b2c364d18cee6b48d"},
 ]
 
 [[package]]
@@ -5283,6 +5281,20 @@ urllib3 = ">=1.21.1,<3"
 socks = ["PySocks (>=1.5.6,!=1.5.7)"]
 use-chardet-on-py3 = ["chardet (>=3.0.2,<6)"]
 
+[[package]]
+name = "requests-file"
+version = "2.1.0"
+description = "File transport adapter for Requests"
+optional = false
+python-versions = "*"
+files = [
+    {file = "requests_file-2.1.0-py2.py3-none-any.whl", hash = "sha256:cf270de5a4c5874e84599fc5778303d496c10ae5e870bfa378818f35d21bda5c"},
+    {file = "requests_file-2.1.0.tar.gz", hash = "sha256:0f549a3f3b0699415ac04d167e9cb39bccfb730cb832b4d20be3d9867356e658"},
+]
+
+[package.dependencies]
+requests = ">=1.0.0"
+
 [[package]]
 name = "requests-oauthlib"
 version = "2.0.0"
@@ -6424,6 +6436,27 @@ requests = ">=2.26.0"
 [package.extras]
 blobfile = ["blobfile (>=2)"]
 
+[[package]]
+name = "tldextract"
+version = "5.1.3"
+description = "Accurately separates a URL's subdomain, domain, and public suffix, using the Public Suffix List (PSL). By default, this includes the public ICANN TLDs and their exceptions. You can optionally support the Public Suffix List's private domains as well."
+optional = false
+python-versions = ">=3.9"
+files = [
+    {file = "tldextract-5.1.3-py3-none-any.whl", hash = "sha256:78de310cc2ca018692de5ddf320f9d6bd7c5cf857d0fd4f2175f0cdf4440ea75"},
+    {file = "tldextract-5.1.3.tar.gz", hash = "sha256:d43c7284c23f5dc8a42fd0fee2abede2ff74cc622674e4cb07f514ab3330c338"},
+]
+
+[package.dependencies]
+filelock = ">=3.0.8"
+idna = "*"
+requests = ">=2.1.0"
+requests-file = ">=1.4"
+
+[package.extras]
+release = ["build", "twine"]
+testing = ["mypy", "pytest", "pytest-gitignore", "pytest-mock", "responses", "ruff", "syrupy", "tox", "tox-uv", "types-filelock", "types-requests"]
+
 [[package]]
 name = "tokenizers"
 version = "0.19.1"
@@ -6543,31 +6576,36 @@ testing = ["black (==22.3)", "datasets", "numpy", "pytest", "requests", "ruff"]
 
 [[package]]
 name = "torch"
-version = "2.4.0"
+version = "2.2.2"
 description = "Tensors and Dynamic neural networks in Python with strong GPU acceleration"
 optional = false
 python-versions = ">=3.8.0"
 files = [
-    {file = "torch-2.4.0-cp310-cp310-manylinux1_x86_64.whl", hash = "sha256:4ed94583e244af51d6a8d28701ca5a9e02d1219e782f5a01dd401f90af17d8ac"},
-    {file = "torch-2.4.0-cp310-cp310-manylinux2014_aarch64.whl", hash = "sha256:c4ca297b7bd58b506bfd6e78ffd14eb97c0e7797dcd7965df62f50bb575d8954"},
-    {file = "torch-2.4.0-cp310-cp310-win_amd64.whl", hash = "sha256:2497cbc7b3c951d69b276ca51fe01c2865db67040ac67f5fc20b03e41d16ea4a"},
-    {file = "torch-2.4.0-cp310-none-macosx_11_0_arm64.whl", hash = "sha256:685418ab93730efbee71528821ff54005596970dd497bf03c89204fb7e3f71de"},
-    {file = "torch-2.4.0-cp311-cp311-manylinux1_x86_64.whl", hash = "sha256:e743adadd8c8152bb8373543964551a7cb7cc20ba898dc8f9c0cdbe47c283de0"},
-    {file = "torch-2.4.0-cp311-cp311-manylinux2014_aarch64.whl", hash = "sha256:7334325c0292cbd5c2eac085f449bf57d3690932eac37027e193ba775703c9e6"},
-    {file = "torch-2.4.0-cp311-cp311-win_amd64.whl", hash = "sha256:97730014da4c57ffacb3c09298c6ce05400606e890bd7a05008d13dd086e46b1"},
-    {file = "torch-2.4.0-cp311-none-macosx_11_0_arm64.whl", hash = "sha256:f169b4ea6dc93b3a33319611fcc47dc1406e4dd539844dcbd2dec4c1b96e166d"},
-    {file = "torch-2.4.0-cp312-cp312-manylinux1_x86_64.whl", ha
```

**File**: `pyproject.toml` (modified, +8/-4)
```diff
@@ -16,6 +16,7 @@ rich = "^13.7.1"
 numpy = "^1.26.4"
 poethepoet = "0.29.0"
 datasets = "^3.0.1"
+torch = "2.2.2"
 
 # Digital data ETL
 selenium = "^4.21.0"
@@ -41,7 +42,6 @@ langchain-community = "^0.2.11"
 fastapi = ">=0.100,<=0.110"
 uvicorn = "^0.30.6"
 opik = "^0.2.2"
-torch = "2.2.2"
 
 
 [tool.poetry.group.dev.dependencies]
@@ -99,7 +99,7 @@ call-inference-ml-service = "curl -X POST 'http://127.0.0.1:8000/rag' -H 'Conten
 ## Local infrastructure
 local-docker-infrastructure-up = "docker compose up -d"
 local-docker-infrastructure-down = "docker compose stop"
-local-zenml-server-down = "poetry run zenml down"
+local-zenml-server-down = "poetry run zenml logout --local"
 local-infrastructure-up = [
     "local-docker-infrastructure-up",
     "local-zenml-server-down",
@@ -144,10 +144,14 @@ control.expr = "sys.platform"
 [[tool.poe.tasks.local-zenml-server-up.switch]]
 case = "darwin"
 env = { OBJC_DISABLE_INITIALIZE_FORK_SAFETY = "YES" }
-cmd = "poetry run zenml up"
+cmd = "poetry run zenml login --local"
+
+[[tool.poe.tasks.local-zenml-server-up.switch]]
+case = "win32"
+cmd = "poetry run zenml login --local --blocking"
 
 [[tool.poe.tasks.local-zenml-server-up.switch]]
-cmd = "poetry run zenml up"
+cmd = "poetry run zenml login --local"
 
 # Tests
 [tool.poe.tasks.test]
```

---

### Incident Patch 3: `b4211d9b` (2025-03-08)
**Commit Message**: Merge pull request #40 from kd2718/format_fix

fixing issue where examples were not injected intot he prompt

**File**: `llm_engineering/application/dataset/generation.py` (modified, +2/-2)
```diff
@@ -191,7 +191,7 @@ class InstructionDatasetGenerator(DatasetGenerator):
 ]
 
 Extract:
-{extract}
+{{extract}}
 """
 
     @classmethod
@@ -232,7 +232,7 @@ class PreferenceDatasetGenerator(DatasetGenerator):
 ]
 
 Extract:
-{extract}
+{{extract}}
 """
 
     @classmethod
```

---

### Incident Patch 4: `aacee321` (2025-02-19)
**Commit Message**: Fix torch version

**File**: `pyproject.toml` (modified, +1/-4)
```diff
@@ -41,6 +41,7 @@ langchain-community = "^0.2.11"
 fastapi = ">=0.100,<=0.110"
 uvicorn = "^0.30.6"
 opik = "^0.2.2"
+torch = "2.2.2"
 
 
 [tool.poetry.group.dev.dependencies]
@@ -145,10 +146,6 @@ case = "darwin"
 env = { OBJC_DISABLE_INITIALIZE_FORK_SAFETY = "YES" }
 cmd = "poetry run zenml up"
 
-[[tool.poe.tasks.local-zenml-server-up.switch]]
-case = "win32"
-cmd = "poetry run zenml up --blocking"
-
 [[tool.poe.tasks.local-zenml-server-up.switch]]
 cmd = "poetry run zenml up"
 
```

---

### Incident Patch 5: `33c437bf` (2025-02-19)
**Commit Message**: revert to previous state

**File**: `Dockerfile` (modified, +1/-1)
```diff
@@ -3,7 +3,7 @@ FROM python:3.11-slim-bullseye AS release
 ENV WORKSPACE_ROOT=/app/
 ENV PYTHONDONTWRITEBYTECODE=1
 ENV PYTHONUNBUFFERED=1
-ENV POETRY_VERSION=2.0.1
+ENV POETRY_VERSION=1.8.3
 ENV DEBIAN_FRONTEND=noninteractive
 ENV POETRY_NO_INTERACTION=1
 
```

**File**: `configs/digital_data_etl_maxime_labonne.yaml` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 settings:
   docker:
-    parent_image: 122610508479.dkr.ecr.us-east-1.amazonaws.com/zenml-lbynmz
+    parent_image: 992382797823.dkr.ecr.eu-central-1.amazonaws.com/zenml-rlwlcs:latest
     skip_build: True
   orchestrator.sagemaker:
     synchronous: false
```

**File**: `configs/digital_data_etl_paul_iusztin.yaml` (modified, +6/-6)
```diff
@@ -1,6 +1,6 @@
 settings:
   docker:
-    parent_image: 122610508479.dkr.ecr.us-east-1.amazonaws.com/zenml-lbynmz
+    parent_image: 992382797823.dkr.ecr.eu-central-1.amazonaws.com/zenml-rlwlcs:latest
     skip_build: True
   orchestrator.sagemaker:
     synchronous: false
@@ -9,11 +9,11 @@ parameters:
   user_full_name: Paul Iusztin # [First Name(s)] [Last Name]
   links:
     # Medium (only articles that are not under the paid wall work)
-    # - https://medium.com/decodingml/an-end-to-end-framework-for-production-ready-llm-systems-by-building-your-llm-twin-2cc6bb01141f
-    # - https://medium.com/decodingml/a-real-time-retrieval-system-for-rag-on-social-media-data-9cc01d50a2a0
-    # - https://medium.com/decodingml/sota-python-streaming-pipelines-for-fine-tuning-llms-and-rag-in-real-time-82eb07795b87
-    # - https://medium.com/decodingml/the-4-advanced-rag-algorithms-you-must-know-to-implement-5d0c7f1199d2
-    # - https://medium.com/decodingml/architect-scalable-and-cost-effective-llm-rag-inference-pipelines-73b94ef82a99
+    - https://medium.com/decodingml/an-end-to-end-framework-for-production-ready-llm-systems-by-building-your-llm-twin-2cc6bb01141f
+    - https://medium.com/decodingml/a-real-time-retrieval-system-for-rag-on-social-media-data-9cc01d50a2a0
+    - https://medium.com/decodingml/sota-python-streaming-pipelines-for-fine-tuning-llms-and-rag-in-real-time-82eb07795b87
+    - https://medium.com/decodingml/the-4-advanced-rag-algorithms-you-must-know-to-implement-5d0c7f1199d2
+    - https://medium.com/decodingml/architect-scalable-and-cost-effective-llm-rag-inference-pipelines-73b94ef82a99
     # Substack
     - https://decodingml.substack.com/p/real-time-feature-pipelines-with?r=1ttoeh
     - https://decodingml.substack.com/p/building-ml-systems-the-right-way?r=1ttoeh
```

**File**: `configs/end_to_end_data.yaml` (modified, +8/-8)
```diff
@@ -1,6 +1,6 @@
 settings:
   docker:
-    parent_image: 122610508479.dkr.ecr.us-east-1.amazonaws.com/zenml-lbynmz
+    parent_image: 992382797823.dkr.ecr.eu-central-1.amazonaws.com/zenml-rlwlcs:latest
     skip_build: True
   orchestrator.sagemaker:
     synchronous: false
@@ -11,11 +11,11 @@ parameters:
     - user_full_name: Paul Iusztin # [First Name(s)] [Last Name]
       links:
         # Medium (only articles that are not under the paid wall work)
-        # - https://medium.com/decodingml/an-end-to-end-framework-for-production-ready-llm-systems-by-building-your-llm-twin-2cc6bb01141f
-        # - https://medium.com/decodingml/a-real-time-retrieval-system-for-rag-on-social-media-data-9cc01d50a2a0
-        # - https://medium.com/decodingml/sota-python-streaming-pipelines-for-fine-tuning-llms-and-rag-in-real-time-82eb07795b87
-        # - https://medium.com/decodingml/the-4-advanced-rag-algorithms-you-must-know-to-implement-5d0c7f1199d2
-        # - https://medium.com/decodingml/architect-scalable-and-cost-effective-llm-rag-inference-pipelines-73b94ef82a99
+        - https://medium.com/decodingml/an-end-to-end-framework-for-production-ready-llm-systems-by-building-your-llm-twin-2cc6bb01141f
+        - https://medium.com/decodingml/a-real-time-retrieval-system-for-rag-on-social-media-data-9cc01d50a2a0
+        - https://medium.com/decodingml/sota-python-streaming-pipelines-for-fine-tuning-llms-and-rag-in-real-time-82eb07795b87
+        - https://medium.com/decodingml/the-4-advanced-rag-algorithms-you-must-know-to-implement-5d0c7f1199d2
+        - https://medium.com/decodingml/architect-scalable-and-cost-effective-llm-rag-inference-pipelines-73b94ef82a99
         # Substack
         - https://decodingml.substack.com/p/a-blueprint-for-designing-production?r=1ttoeh
         - https://decodingml.substack.com/p/the-difference-between-development?r=1ttoeh
@@ -83,5 +83,5 @@ parameters:
   # Generate instruct dataset pipeline parameters
   test_split_size: 0.1
   push_to_huggingface: true
-  dataset_id: Oysiyl/llmtwin
-  mock: true
\ No newline at end of file
+  dataset_id: pauliusztin/llmtwin
+  mock: false
\ No newline at end of file
```

**File**: `configs/evaluating.yaml` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 settings:
   docker:
-    parent_image: 122610508479.dkr.ecr.us-east-1.amazonaws.com/zenml-lbynmz
+    parent_image: 992382797823.dkr.ecr.eu-central-1.amazonaws.com/zenml-rlwlcs:latest
     skip_build: True
   orchestrator.sagemaker:
     synchronous: false
```

**File**: `configs/export_artifact_to_json.yaml` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 settings:
   docker:
-    parent_image: 122610508479.dkr.ecr.us-east-1.amazonaws.com/zenml-lbynmz
+    parent_image: 992382797823.dkr.ecr.eu-central-1.amazonaws.com/zenml-rlwlcs:latest
     skip_build: True
   orchestrator.sagemaker:
     synchronous: false
```

**File**: `configs/feature_engineering.yaml` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 settings:
   docker:
-    parent_image: 122610508479.dkr.ecr.us-east-1.amazonaws.com/zenml-lbynmz
+    parent_image: 992382797823.dkr.ecr.eu-central-1.amazonaws.com/zenml-rlwlcs:latest
     skip_build: True
   orchestrator.sagemaker:
     synchronous: false
```

**File**: `configs/generate_instruct_datasets.yaml` (modified, +3/-4)
```diff
@@ -1,13 +1,12 @@
 settings:
   docker:
-    parent_image: 122610508479.dkr.ecr.us-east-1.amazonaws.com/zenml-lbynmz
-    skip_build: True
+    parent_image: 992382797823.dkr.ecr.eu-central-1.amazonaws.com/zenml-rlwlcs:latest
   orchestrator.sagemaker:
     synchronous: false
 
 parameters:
   test_split_size: 0.1
   dataset_type: "instruction"
   push_to_huggingface: true
-  dataset_id: Oysiyl/llmtwin
-  mock: true
+  dataset_id: pauliusztin/llmtwin
+  mock: false
```

---

### Incident Patch 6: `ab35de63` (2025-01-20)
**Commit Message**: fixing issue where examples were not injected intot he prompt

**File**: `llm_engineering/application/dataset/generation.py` (modified, +2/-2)
```diff
@@ -191,7 +191,7 @@ class InstructionDatasetGenerator(DatasetGenerator):
 ]
 
 Extract:
-{extract}
+{{extract}}
 """
 
     @classmethod
@@ -232,7 +232,7 @@ class PreferenceDatasetGenerator(DatasetGenerator):
 ]
 
 Extract:
-{extract}
+{{extract}}
 """
 
     @classmethod
```

---

### Incident Patch 7: `e11083a8` (2025-01-09)
**Commit Message**: fix opik links

**File**: `README.md` (modified, +5/-5)
```diff
@@ -52,8 +52,8 @@ The code also uses and depends on the following cloud services. For now, you don
 | Service | Purpose |
 |---------|---------|
 | [HuggingFace](https://huggingface.com/) | Model registry |
-| [Comet ML](https://www.comet.com/site/) | Experiment tracker |
-| [Opik](https://www.comet.com/site/products/opik/) | Prompt monitoring |
+| [Comet ML](https://www.comet.com/site/products/opik/?utm_source=llm_handbook&utm_medium=github&utm_campaign=opik) | Experiment tracker |
+| [Opik](https://www.comet.com/site/products/opik/?utm_source=llm_handbook&utm_medium=github&utm_campaign=opik) | Prompt monitoring |
 | [ZenML](https://www.zenml.io/) | Orchestrator and artifacts layer |
 | [AWS](https://aws.amazon.com/) | Compute and storage |
 | [MongoDB](https://www.mongodb.com/) | NoSQL database |
@@ -269,7 +269,7 @@ To authenticate to Comet ML (required only during training) and Opik, you must f
 COMET_API_KEY=your_api_key_here
 ```
 
-→ Check out this [tutorial](https://www.comet.com/docs/v2/api-and-sdk/rest-api/overview/) to learn how to get the Comet ML variables from above. You can also access Opik's dashboard using 🔗[this link](https://www.comet.com/opik).
+→ Check out this [tutorial](https://www.comet.com/docs/opik/?utm_source=llm_handbook&utm_medium=github&utm_campaign=opik) to learn how to get started with Opik. You can also access Opik's dashboard using 🔗[this link](https://www.comet.com/opik?utm_source=llm_handbook&utm_medium=github&utm_content=opik).
 
 ### 6. Deployment Setup
 
@@ -466,8 +466,8 @@ Also, we provide instructions on how to set everything up in **Chapter 11**, sec
 #### Comet ML & Opik
 
 You can visualize the results on their self-hosted dashboards if you create a Comet account and correctly set the `COMET_API_KEY` env var. As Opik is powered by Comet, you don't have to set up anything else along Comet:
-- [Comet ML (for experiment tracking)](https://www.comet.com/)
-- [Opik (for prompt monitoring)](https://www.comet.com/opik)
+- [Comet ML (for experiment tracking)](https://www.comet.com/?utm_source=llm_handbook&utm_medium=github&utm_campaign=opik)
+- [Opik (for prompt monitoring)](https://www.comet.com/opik?utm_source=llm_handbook&utm_medium=github&utm_campaign=opik)
 
 ## ⚡ Pipelines
 
```

---

### Incident Patch 8: `80d9ec65` (2025-01-02)
**Commit Message**: Merge pull request #16 from intertwine/fix-instructor-embeddings

Fix instructor embeddings

**File**: `code_snippets/08_instructor_embeddings.py` (modified, +3/-3)
```diff
@@ -1,13 +1,13 @@
-from InstructorEmbedding import INSTRUCTOR
+from sentence_transformers import SentenceTransformer
 
 # Create virtual environment, install dependencies and run the code:
 # 1. Create: python3 -m venv instructor_venv
 # 2. Activate: source instructor_venv/bin/activate
-# 3. Install: pip install sentence-transformers==2.2.2 InstructorEmbedding==1.0.1
+# 3. Install: pip install sentence-transformers==3.3.0
 # 4. Run the code: python code_snippets/08_instructor_embeddings.py
 
 if __name__ == "__main__":
-    model = INSTRUCTOR("hkunlp/instructor-base")
+    model = SentenceTransformer("hkunlp/instructor-base")
 
     sentence = "RAG Fundamentals First"
 
```

---

### Incident Patch 9: `ec6717fd` (2024-11-30)
**Commit Message**: fix: Fine-tuning and evaluation minor fixes

**File**: `README.md` (modified, +1/-1)
```diff
@@ -24,7 +24,7 @@ The goal of this book is to create your own end-to-end LLM-based system using be
 You can download and use the final trained model on [Hugging Face](https://huggingface.co/mlabonne/TwinLlama-3.1-8B-DPO).
 
 > [!IMPORTANT]
-> The code in this GitHub repository is actively maintained and may contain updates not reflected in the book. Always refer to this repository for the latest version of the code.
+> The code in this GitHub repository is actively maintained and may contain updates not reflected in the book. **Always refer to this repository for the latest version of the code.**
 
 ## 🔗 Dependencies
 
```

---

### Incident Patch 10: `ee785422` (2024-11-30)
**Commit Message**: fix: Fine-tuning and evaluation minor fixes

**File**: `README.md` (modified, +3/-0)
```diff
@@ -23,6 +23,9 @@ The goal of this book is to create your own end-to-end LLM-based system using be
 
 You can download and use the final trained model on [Hugging Face](https://huggingface.co/mlabonne/TwinLlama-3.1-8B-DPO).
 
+> [!IMPORTANT]
+> The code in this GitHub repository is actively maintained and may contain updates not reflected in the book. Always refer to this repository for the latest version of the code.
+
 ## 🔗 Dependencies
 
 ### Local dependencies
```

**File**: `llm_engineering/model/evaluation/evaluate.py` (modified, +4/-1)
```diff
@@ -30,7 +30,10 @@ def format(sample):
 
     dataset = load_dataset(dataset_name, split="test")
     if IS_DUMMY:
-        dataset = dataset.select(range(10))
+        try:
+            dataset = dataset.select(range(10))
+        except Exception:
+            print("Dummy mode active. Failed to trim the dataset to 10 samples.")  # noqa
     print(f"Dataset size: {len(dataset)}")  # noqa
     dataset = dataset.map(lambda sample: {"prompt": format(sample)})
 
```

**File**: `llm_engineering/model/evaluation/requirements.txt` (modified, +1/-1)
```diff
@@ -2,4 +2,4 @@ transformers==4.43.3
 datasets==2.20.0
 vllm==0.6.1.post2
 tqdm==4.66.4
-openai==1.52.0
\ No newline at end of file
+openai==1.55.3
\ No newline at end of file
```

**File**: `llm_engineering/model/finetuning/finetune.py` (modified, +2/-2)
```diff
@@ -105,7 +105,7 @@ def format_samples_sft(examples):
             try:
                 dataset = dataset.select(range(400))
             except Exception:
-                print("Dummy mode active. Could not trim the dataset.")  # noqa
+                print("Dummy mode active. Failed to trim the dataset to 400 samples.")  # noqa
         print(f"Loaded dataset with {len(dataset)} samples.")  # noqa
 
         dataset = dataset.map(format_samples_sft, batched=True, remove_columns=dataset.column_names)
@@ -156,7 +156,7 @@ def format_samples_dpo(example):
             try:
                 dataset = dataset.select(range(400))
             except Exception:
-                print("Dummy mode active. Could not trim the dataset.")  # noqa
+                print("Dummy mode active. Failed to trim the dataset to 400 samples.")  # noqa
         print(f"Loaded dataset with {len(dataset)} samples.")  # noqa
 
         dataset = dataset.map(format_samples_dpo)
```

---

### Incident Patch 11: `63b627f8` (2024-11-30)
**Commit Message**: fix: Dummy mode

**File**: `llm_engineering/model/finetuning/finetune.py` (modified, +8/-2)
```diff
@@ -102,7 +102,10 @@ def format_samples_sft(examples):
         dataset2 = load_dataset("mlabonne/FineTome-Alpaca-100k", split="train[:10000]")
         dataset = concatenate_datasets([dataset1, dataset2])
         if is_dummy:
-            dataset = dataset.select(range(400))
+            try:
+                dataset = dataset.select(range(400))
+            except Exception:
+                print("Dummy mode active. Could not trim the dataset.")  # noqa
         print(f"Loaded dataset with {len(dataset)} samples.")  # noqa
 
         dataset = dataset.map(format_samples_sft, batched=True, remove_columns=dataset.column_names)
@@ -150,7 +153,10 @@ def format_samples_dpo(example):
 
         dataset = load_dataset(f"{dataset_huggingface_workspace}/llmtwin-dpo", split="train")
         if is_dummy:
-            dataset = dataset.select(range(400))
+            try:
+                dataset = dataset.select(range(400))
+            except Exception:
+                print("Dummy mode active. Could not trim the dataset.")  # noqa
         print(f"Loaded dataset with {len(dataset)} samples.")  # noqa
 
         dataset = dataset.map(format_samples_dpo)
```

---

### Incident Patch 12: `34f54ecb` (2024-11-30)
**Commit Message**: fix: Update Llama model_ids

**File**: `llm_engineering/model/evaluation/evaluate.py` (modified, +1/-1)
```diff
@@ -199,7 +199,7 @@ def check_if_huggingface_dataset_exists(dataset_id: str, default_value: str) ->
     check_if_huggingface_model_exists(
         f"{MODEL_HUGGINGFACE_WORKSPACE}/TwinLlama-3.1-8B-DPO", default_value="mlabonne/TwinLlama-3.1-8B-DPO"
     ),
-    "meta-llama/Meta-Llama-3.1-8B-Instruct",
+    "meta-llama/Llama-3.1-8B-Instruct",
 ]
 
 if __name__ == "__main__":
```

**File**: `llm_engineering/model/finetuning/finetune.py` (modified, +1/-1)
```diff
@@ -268,7 +268,7 @@ def check_if_huggingface_model_exists(model_id: str, default_value: str = "mlabo
 
     if args.finetuning_type == "sft":
         print("Starting SFT training...")  # noqa
-        base_model_name = "meta-llama/Meta-Llama-3.1-8B"
+        base_model_name = "meta-llama/Llama-3.1-8B"
         print(f"Training from base model '{base_model_name}'")  # noqa
 
         output_dir_sft = Path(args.model_dir) / "output_sft"
```

---

### Incident Patch 13: `d91c5b99` (2024-11-30)
**Commit Message**: fix: Factory typos

**File**: `llm_engineering/application/preprocessing/dispatchers.py` (modified, +6/-6)
```diff
@@ -38,12 +38,12 @@ def create_handler(data_category: DataCategory) -> CleaningDataHandler:
 
 
 class CleaningDispatcher:
-    cleaning_factory = CleaningHandlerFactory()
+    factory = CleaningHandlerFactory()
 
     @classmethod
     def dispatch(cls, data_model: NoSQLBaseDocument) -> VectorBaseDocument:
         data_category = DataCategory(data_model.get_collection_name())
-        handler = cls.cleaning_factory.create_handler(data_category)
+        handler = cls.factory.create_handler(data_category)
         clean_model = handler.clean(data_model)
 
         logger.info(
@@ -69,12 +69,12 @@ def create_handler(data_category: DataCategory) -> ChunkingDataHandler:
 
 
 class ChunkingDispatcher:
-    cleaning_factory = ChunkingHandlerFactory
+    factory = ChunkingHandlerFactory
 
     @classmethod
     def dispatch(cls, data_model: VectorBaseDocument) -> list[VectorBaseDocument]:
         data_category = data_model.get_category()
-        handler = cls.cleaning_factory.create_handler(data_category)
+        handler = cls.factory.create_handler(data_category)
         chunk_models = handler.chunk(data_model)
 
         logger.info(
@@ -102,7 +102,7 @@ def create_handler(data_category: DataCategory) -> EmbeddingDataHandler:
 
 
 class EmbeddingDispatcher:
-    cleaning_factory = EmbeddingHandlerFactory
+    factory = EmbeddingHandlerFactory
 
     @classmethod
     def dispatch(
@@ -119,7 +119,7 @@ def dispatch(
         assert all(
             data_model.get_category() == data_category for data_model in data_model
         ), "Data models must be of the same category."
-        handler = cls.cleaning_factory.create_handler(data_category)
+        handler = cls.factory.create_handler(data_category)
 
         embedded_chunk_model = handler.embed_batch(data_model)
 
```

---

### Incident Patch 14: `d0bfae6d` (2024-11-20)
**Commit Message**: revert crawler change

**File**: `llm_engineering/application/crawlers/dispatcher.py` (modified, +2/-2)
```diff
@@ -45,7 +45,7 @@ def get_crawler(self, url: str) -> BaseCrawler:
         for pattern, crawler in self._crawlers.items():
             if re.match(pattern, url):
                 return crawler()
-            else:
-                logger.warning(f"No crawler found for {url}. Defaulting to CustomArticleCrawler.")
+        else:
+            logger.warning(f"No crawler found for {url}. Defaulting to CustomArticleCrawler.")
 
             return CustomArticleCrawler()
```

---

### Incident Patch 15: `d64d6599` (2024-11-15)
**Commit Message**: fix instructor embeddings code sample
Updates the instructor embeddings code sample from Chapter 4 pp. 123  to use `sentence-transformers==3.3.0` and removes InstructorEmbedding (as published, the code snippet throws `ImportError: cannot import name 'cached_download' from 'huggingface_hub'`

**File**: `llm_engineering/application/crawlers/dispatcher.py` (modified, +2/-2)
```diff
@@ -45,7 +45,7 @@ def get_crawler(self, url: str) -> BaseCrawler:
         for pattern, crawler in self._crawlers.items():
             if re.match(pattern, url):
                 return crawler()
-        else:
-            logger.warning(f"No crawler found for {url}. Defaulting to CustomArticleCrawler.")
+            else:
+                logger.warning(f"No crawler found for {url}. Defaulting to CustomArticleCrawler.")
 
             return CustomArticleCrawler()
```

#### Recent Merged Pull Requests:
- **PR #78** (closed): feat: route LLM calls through a configurable OpenAI-compatible endpoint (@Osami2020)
- **PR #66** (closed): try claude code PR (@howard31526)
- **PR #63** (closed): Feature/trigger ci (@howard31526)
- **PR #50** (closed): [withdrawn] Init steven (@stevenmichiels)
- **PR #48** (2025-03-08): Feature/bump zenml version (@dmitriy-kisil)
- **PR #47** (2025-03-08): Feature/windows support (@dmitriy-kisil)
- **PR #46** (2025-03-08): Feature/error with torch on windows (@dmitriy-kisil)
- **PR #44** (closed): CI 파이프라인 테스트: 문서 수정 (@inrap8206)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

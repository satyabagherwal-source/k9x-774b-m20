# Forensic Learning Record (Deep Inspection): TIGER-AI-Lab/TheoremExplainAgent

> **Canonical Artifact**: `07_PROJECT_LEARNING/tiger-ai-lab-theoremexplainagent-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/TIGER-AI-Lab/TheoremExplainAgent](https://github.com/TIGER-AI-Lab/TheoremExplainAgent))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T06:33:41.068Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `TIGER-AI-Lab/TheoremExplainAgent`
- **Description**: Official Repo for "TheoremExplainAgent: Towards Video-based Multimodal Explanations for LLM Theorem Understanding" [ACL 2025 oral]
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 1510 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `eval_suite/image_utils.py`
```
import os
import tempfile

import numpy as np
from PIL import Image, ImageOps
from moviepy import VideoFileClip

from eval_suite.prompts_raw import _image_eval
from eval_suite.utils import extract_json, convert_score_fields, calculate_geometric_mean
from mllm_tools.utils import _prepare_text_image_inputs
from src.core.parse_video import image_with_most_non_black_space

def extract_key_frames(video_path, output_dir, num_chunks):
    """Extract key frames from a video by dividing it into chunks and selecting representative frames.

    Args:
        video_path (str): Path to the input video file
        output_dir (str): Directory where extracted frames will be saved
        num_chunks (int): Number of chunks to divide the video into

    Returns:
        list: List of paths to the extracted key frames
    """
    # Create output directory if it doesn't exist
    os.makedirs(output_dir, exist_ok=True)
    
    # Extract all frames from the video
    clip = VideoFileClip(video_path)
    frames = list(clip.iter_frames(fps=1))  # one frame every second
    
    total_frames = len(frames)
    if total_frames == 0:
        print("No frames extracted from the video.")
        return []
    
    # Determine the number of frames per chunk
    frames_per_chunk = total_frames // num_chunks
    num_chunks = min(num_chunks, (total_frames + frames_per_chunk - 1) // frames_per_chunk)
    
    key_frames = []
    
    # Process each chunk of frames
    for i in range(num_chunks):
        start_idx = i * frames_per_chunk
        end_idx = min((i + 1) * frames_per_chunk, total_frames)
        chunk_frames = frames[start_idx:end_idx]
        
        if chunk_frames:
            # Save the frame with most non-black space
            output_path = os.path.join(output_dir, f"key_frame_{i+1}.jpg")
            result = image_with_most_non_black_space(chunk_frames, output_path)
        else:
            print(f"No frames in chunk {i+1}. Skipping.")
            result = None
        
        if result is not None:
            key_frames.append(output_path)
    clip.close()
    
    return key_frames


def evaluate_sampled_images(model, video_path, description="No description provided", num_chunks=10, output_folder=None):
    """Evaluate sampled frames from a video using an image evaluation model.

    Args:
        model: The image evaluation model to use
        video_path (str): Path to the input video file
        description (str, optional): Description of the video content. Defaults to "No description provided"
        num_chunks (int, optional): Number of chunks to divide the video into. Defaults to 10
        output_folder (str, optional): Directory for temporary files. Defaults to None

    Returns:
        dict: Dictionary containing evaluation scores and individual frame assessments with keys:
            - evaluation: Dictionary of averaged scores for each criterion
            - image_chunks: List of individual frame evaluation results
    """
    with tempfile.TemporaryDirectory(dir=output_folder) as temp_dir:
        key_frames = extract_key_frames(video_path, temp_dir, num_chunks)

        prompt = _image_eval.format(description=description)

        responses = []
        for key_frame in key_frames:
            inputs = _prepare_text_image_inputs(prompt, key_frame)
            response = model(inputs)
            response_json = extract_json(response)
            response_json = convert_score_fields(response_json)
            responses.append(response_json)

    criteria = list(responses[0]["evaluation"].keys())
    scores_dict = {c: [] for c in criteria}
    for response in responses:
        for key, val in response["evaluation"].items():
            scores_dict[key].append(val["score"])

    res_score = {}
    for key, scores in scores_dict.items():
        res_score[key] = {"score": calculate_geometric_mean(scores)}

    return {
        "evaluation": res_score,
        "image_chunks": responses
    }

```

### Core Architecture Module: `eval_suite/text_utils.py`
```
from typing import Union

import pysrt

from mllm_tools.litellm import LiteLLMWrapper
from mllm_tools.gemini import GeminiWrapper
from mllm_tools.utils import _prepare_text_inputs
from eval_suite.prompts_raw import _fix_transcript, _text_eval_new
from eval_suite.utils import extract_json, convert_score_fields


def parse_srt_to_text(srt_path) -> str:
    """
    Parse an SRT subtitle file into plain text.

    Args:
        srt_path: Path to the SRT subtitle file.

    Returns:
        str: The subtitle text with duplicates removed and ellipses replaced.
    """
    subs = pysrt.open(srt_path)
    full_text = []
    for sub in subs:
        sub.text = sub.text.replace("...", ".")
        for line in sub.text.splitlines():
            # .srt can contain repeated lines
            if full_text and full_text[-1] == line:
                continue
            full_text.append(line)
    return "\n".join(full_text)


def fix_transcript(text_eval_model: Union[LiteLLMWrapper, GeminiWrapper], transcript: str) -> str:
    """
    Fix and clean up a transcript using an LLM model.

    Args:
        text_eval_model: The LLM model wrapper to use for fixing the transcript.
        transcript: The input transcript text to fix.

    Returns:
        str: The fixed and cleaned transcript text.
    """
    print("Fixing transcript...")
    
    prompt = _fix_transcript.format(transcript=transcript)
    response = text_eval_model(_prepare_text_inputs(prompt))
    fixed_script = response.split("<SCRIPT>", maxsplit=1)[1].split("</SCRIPT>")[0]

    return fixed_script


def evaluate_text(text_eval_model: LiteLLMWrapper, transcript: str, retry_limit: int) -> dict:
    """
    Evaluate transcript text using an LLM model with retry logic.

    Args:
        text_eval_model: The LLM model wrapper to use for evaluation.
        transcript: The transcript text to evaluate.
        retry_limit: Maximum number of retry attempts on failure.

    Returns:
        dict: The evaluation results as a JSON object.

    Raises:
        ValueError: If all retry attempts fail.
    """
    # prompt = _text_eval.format(transcript=transcript)
    prompt = _text_eval_new.format(transcript=transcript)
    for attempt in range(retry_limit):
        try:
            evaluation = text_eval_model(_prepare_text_inputs(prompt))
            evaluation_json = extract_json(evaluation)
            evaluation_json = convert_score_fields(evaluation_json)
            return evaluation_json
        except Exception as e:
            print(f"Attempt {attempt + 1} failed: {e.__class__.__name__}: {e}")
            if attempt + 1 == retry_limit:
                raise ValueError("Reached maximum retry limit. Evaluation failed.") from None

```

### Core Architecture Module: `eval_suite/utils.py`
```
import json
import re
from math import prod
from typing import List

def extract_json(response: str) -> dict:
    """
    Extract JSON content from a string response.

    Args:
        response (str): String containing JSON content, possibly within code blocks.

    Returns:
        dict: Extracted and parsed JSON content.

    Raises:
        ValueError: If no valid JSON content could be extracted.
    """
    try:
        evaluation_json = json.loads(response)
    except json.JSONDecodeError:
        # If JSON parsing fails, try to extract the content between ```json and ```
        match = re.search(r'```json\n(.*?)\n```', response, re.DOTALL)
        if not match:
            # If no match for ```json, try to extract content between ``` and ```
            match = re.search(r'```\n(.*?)\n```', response, re.DOTALL)
        
        if match:
            evaluation_content = match.group(1)
            evaluation_json = json.loads(evaluation_content)
        else:
            raise ValueError("Failed to extract valid JSON content")
    return evaluation_json


def convert_score_fields(data: dict) -> dict:
    """
    Convert score fields in a dictionary to integers recursively.

    Args:
        data (dict): Dictionary containing score fields to convert.

    Returns:
        dict: Dictionary with score fields converted to integers.

    Raises:
        ValueError: If a score value cannot be converted to integer.
    """
    # Create a new dictionary with the converted values
    converted_data = {}
    for key, value in data.items():
        if key == "score":
            if isinstance(value, int):
                converted_data[key] = value
            elif isinstance(value, str) and value.isdigit():
                converted_data[key] = int(value)
            else:
                raise ValueError(f"Invalid score value: {value!r}")
        elif isinstance(value, dict):
            converted_data[key] = convert_score_fields(value)
        else:
            converted_data[key] = value
    return converted_data


def calculate_geometric_mean(scores: List[int]) -> float:
    """
    Calculate the geometric mean of a list of scores.

    Args:
        scores (List[int]): List of integer scores, may contain None values.

    Returns:
        float: Geometric mean of non-None scores. Returns 0.0 if list is empty
            or contains only None values.
    """
    scores = [s for s in scores if s is not None]
    if not scores:
        return 0.0
    product = prod(scores)
    return product ** (1 / len(scores))

```

### Core Architecture Module: `eval_suite/video_utils.py`
```
import os
import cv2
import tempfile

from dotenv import load_dotenv

from mllm_tools.utils import _prepare_text_video_inputs
from eval_suite.prompts_raw import _video_eval_new
from eval_suite.utils import extract_json, convert_score_fields

load_dotenv()


def reduce_video_framerate(input_path, target_fps=1, output_path=None):
    """
    Reduces the frame rate of a video by only keeping frames at the target interval.
    
    Args:
        input_path (str): Path to the input video
        target_fps (int): Target frames per second (default: 1)
        output_path (str, optional): Path to save the processed video. If None, uses a temporary file.
    
    Returns:
        str: Path to the processed video
        
    Raises:
        ValueError: If input video cannot be opened or has invalid FPS
        RuntimeError: If video writer initialization fails or output video creation fails
    """
    cap = cv2.VideoCapture(input_path)
    if not cap.isOpened():
        raise ValueError(f"Could not open input video: {input_path}")
        
    original_fps = cap.get(cv2.CAP_PROP_FPS)
    if original_fps <= 0:
        raise ValueError(f"Invalid FPS ({original_fps}) detected in input video")
        
    frame_interval = int(original_fps / target_fps)
    
    # Get video properties
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    
    # Use provided output path or create temporary file
    if output_path is None:
        temp_output = tempfile.NamedTemporaryFile(suffix='.mp4', delete=False)
        output_path = temp_output.name
    
    # Ensure output directory exists
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    # Try different codecs in order of preference
    codecs = [
        ('avc1', '.mp4'),  # H.264 codec
        ('mp4v', '.mp4'),  # MP4V codec
        ('XVID', '.avi'),  # XVID codec
        ('MJPG', '.avi'),  # Motion JPEG codec
    ]
    
    success = False
    for codec, ext in codecs:
        if output_path.endswith('.mp4') and not ext.endswith('.mp4'):
            # If we're switching to AVI format, change the extension
            output_path = output_path[:-4] + ext
            
        fourcc = cv2.VideoWriter_fourcc(*codec)
        out = cv2.VideoWriter(output_path, fourcc, target_fps, (width, height))
        
        if out.isOpened():
            success = True
            print(f"Successfully initialized video writer with codec: {codec}")
            break
        else:
            out.release()
            if os.path.exists(output_path):
                os.remove(output_path)
    
    if not success:
        raise RuntimeError("Could not initialize video writer with any available codec")
    
    frame_count = 0
    frames_written = 0
    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break
            
        # Only write frames at the specified interval
        if frame_count % frame_interval == 0:
            out.write(frame)
            frames_written += 1
        frame_count += 1
    
    cap.release()
    out.release()
    
    # Verify the output
    verify_cap = cv2.VideoCapture(output_path)
    if not verify_cap.isOpened():
        raise RuntimeError(f"Failed to create output video at {output_path}")
        
    actual_fps = verify_cap.get(cv2.CAP_PROP_FPS)
    total_frames = verify_cap.get(cv2.CAP_PROP_FRAME_COUNT)
    verify_cap.release()
    
    if actual_fps <= 0:
        print("Warning: Output video reports invalid FPS. This might be a codec issue.")
        actual_fps = target_fps  # Use target FPS for duration calculation
    
    print(f"Created video with {frames_written} frames at {actual_fps} FPS")
    print(f"Total duration: {total_frames/actual_fps:.2f} seconds")
    print(f"Video saved to: {output_path}")
    
    return output_path


def evaluate_video_chunk_new(model, video_path, transcript="No transcript provided", description="No description provided", 
                             save_processed_video=None, target_fps=None, retry_limit=5):
    """
    Evaluate a single video chunk using a multimodal model.

    Args:
        model: The multimodal model to use for evaluation
        video_path (str): Path to the video file to evaluate
        transcript (str, optional): Video transcript text. Defaults to "No transcript provided"
        description (str, optional): Video description text. Defaults to "No description provided"
        save_processed_video (str, optional): Path to save processed video. If None, uses temporary file
        target_fps (int, optional): Target frames per second for video processing. If None, no processing
        retry_limit (int, optional): Maximum number of retry attempts. Defaults to 5

    Returns:
        dict: Evaluation results as a JSON object with scores converted to integers

    Raises:
        FileNotFoundError: If video file does not exist
        Exception: If evaluation fails after all retry attempts
    """
    if not os.path.exists(video_path):
        raise FileNotFoundError(f"Video file not found: {video_path}")
    
    # Only process video if target_fps is specified
    if target_fps is not None:
        processed_video_path = reduce_video_framerate(video_path, target_fps=target_fps, output_path=save_processed_video)
        video_to_use = processed_video_path
    else:
        video_to_use = video_path

    prompt = _video_eval_new.format(description=description)
    inputs = _prepare_text_video_inputs(prompt, video_to_use)

    try:
        for attempt in range(retry_limit):
            try:
                response = model(inputs)
                response_json = extract_json(response)
                response_json = convert_score_fields(response_json)

                return response_json
            except Exception as e:
                print(f"Attempt {attempt + 1} failed: {e}")
                if attempt + 1 == retry_limit:
                    print("Reached maximum retry limit. Evaluation failed.")
                    raise
    finally:
        # Clean up the temporary processed video if we created one
        if target_fps is not None and save_processed_video is None and os.path.exists(processed_video_path):
            os.unlink(processed_video_path)
```

### Core Architecture Module: `mllm_tools/utils.py`
```
from typing import Union, List, Dict, Any, Optional
from PIL import Image
import google.generativeai as genai
import tempfile
import os
from .gemini import GeminiWrapper
from .vertex_ai import VertexAIWrapper


def _prepare_text_inputs(texts: List[str]) -> List[Dict[str, str]]:
    """
    Converts a list of text strings into the input format for the Agent model.

    Args:
        texts (List[str]): The list of text strings to be processed.

    Returns:
        List[Dict[str, str]]: A list of dictionaries formatted for the Agent model.
    """
    inputs = []
    # Add each text string to the inputs
    if isinstance(texts, str):
        texts = [texts]
    for text in texts:
        inputs.append({
            "type": "text",
            "content": text
        })
    return inputs

def _prepare_text_image_inputs(texts: Union[str, List[str]], images: Union[str, Image.Image, List[Union[str, Image.Image]]]) -> List[Dict[str, str]]:
    """
    Converts text strings and images into the input format for the Agent model.

    Args:
        texts (Union[str, List[str]]): Text string(s) to be processed.
        images (Union[str, Image.Image, List[Union[str, Image.Image]]]): Image file path(s) or PIL Image object(s).
    Returns:
        List[Dict[str, str]]: A list of dictionaries formatted for the Agent model.
    """
    inputs = []
    # Add each text string to the inputs
    if isinstance(texts, str):
        texts = [texts]
    for text in texts:
        inputs.append({
            "type": "text",
            "content": text
        })
    if isinstance(images, (str, Image.Image)):
        images = [images]
    for image in images:
        inputs.append({
            "type": "image",
            "content": image
        })
    return inputs

def _prepare_text_video_inputs(texts: Union[str, List[str]], videos: Union[str, List[str]]) -> List[Dict[str, str]]:
    """
    Converts text strings and video file paths into the input format for the Agent model.

    Args:
        texts (Union[str, List[str]]): Text string(s) to be processed.
        videos (Union[str, List[str]]): Video file path(s).
    Returns:
        List[Dict[str, str]]: A list of dictionaries formatted for the Agent model.
    """
    inputs = []
    # Add each text string to the inputs
    if isinstance(texts, str):
        texts = [texts]
    for text in texts:
        inputs.append({
            "type": "text",
            "content": text
        })
    # Add each video file path to the inputs
    if isinstance(videos, str):
        videos = [videos]
    for video in videos:
        inputs.append({
            "type": "video",
            "content": video
        })
    return inputs

def _prepare_text_audio_inputs(texts: Union[str, List[str]], audios: Union[str, List[str]]) -> List[Dict[str, str]]:
    """
    Converts text strings and audio file paths into the input format for the Agent model.

    Args:
        texts (Union[str, List[str]]): Text string(s) to be processed.
        audios (Union[str, List[str]]): Audio file path(s).
    Returns:
        List[Dict[str, str]]: A list of dictionaries formatted for the Agent model.
    """
    inputs = []
    # Add each text string to the inputs
    if isinstance(texts, str):
        texts = [texts]
    for text in texts:
        inputs.append({
            "type": "text",
            "content": text
        })
    # Add each audio file path to the inputs
    if isinstance(audios, str):
        audios = [audios]
    for audio in audios:
        inputs.append({
            "type": "audio",
            "content": audio
        })
    return inputs

def _extract_code(text: str) -> str:
    """Helper to extract code block from model response, support Gemini style and OpenAI style"""
    try:
        # Find code between ```python and ``` tags
        start = text.split("```python\n")[-1]
        end = start.split("```")[0]
        return end.strip()
    except IndexError:
        return text
    
def _upload_to_gemini(input, mime_type=None):
    """Uploads the given file or PIL image to Gemini.

    See https://ai.google.dev/gemini-api/docs/prompting_with_media
    """
    if isinstance(input, str):
        # Input is a file path
        file = genai.upload_file(input, mime_type=mime_type)
    elif isinstance(input, Image.Image):
        # Input is a PIL image
        with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp_file:
            input.save(tmp_file, format="JPEG")
            tmp_file_path = tmp_file.name
        file = genai.upload_file(tmp_file_path, mime_type=mime_type or "image/jpeg")
        os.remove(tmp_file_path)
    else:
        raise ValueError("Unsupported input type. Must be a file path or PIL Image.")

    #print(f"Uploaded file '{file.display_name}' as: {file.uri}")
    return file

def get_media_wrapper(model_name: str) -> Optional[Union[GeminiWrapper, VertexAIWrapper]]:
    """Get appropriate wrapper for media handling based on model name"""
    if model_name.startswith('gemini/'):
        return GeminiWrapper(model_name=model_name.split('/')[-1])
    elif model_name.startswith('vertex_ai/'):
        return VertexAIWrapper(model_name=model_name.split('/')[-1])
    return None

def prepare_media_messages(prompt: str, media_path: Union[str, Image.Image], model_name: str) -> List[Dict[str, Any]]:
    """Prepare messages for media input based on model type"""
    is_video = isinstance(media_path, str) and media_path.endswith('.mp4')
    
    if is_video and (model_name.startswith('gemini/') or model_name.startswith('vertex_ai/')):
        return [
            {"type": "text", "content": prompt},
            {"type": "video", "content": media_path}
        ]
    else:
        # For images or non-Gemini/Vertex models
        if isinstance(media_path, str):
            media = Image.open(media_path)
        else:
            media = media_path
        return [
            {"type": "text", "content": prompt},
            {"type": "image", "content": media}
        ]
```

### Core Architecture Module: `src/core/code_generator.py`
```
import os
import re
import json
from typing import Union, List, Dict
from PIL import Image
import glob

from src.utils.utils import extract_json
from mllm_tools.utils import _prepare_text_inputs, _extract_code, _prepare_text_image_inputs
from mllm_tools.gemini import GeminiWrapper
from mllm_tools.vertex_ai import VertexAIWrapper
from task_generator import (
    get_prompt_code_generation,
    get_prompt_fix_error,
    get_prompt_visual_fix_error,
    get_banned_reasonings,
    get_prompt_rag_query_generation_fix_error,
    get_prompt_context_learning_code,
    get_prompt_rag_query_generation_code
)
from task_generator.prompts_raw import (
    _code_font_size,
    _code_disable,
    _code_limit,
    _prompt_manim_cheatsheet
)
from src.rag.vector_store import RAGVectorStore # Import RAGVectorStore

class CodeGenerator:
    """A class for generating and managing Manim code."""

    def __init__(self, scene_model, helper_model, output_dir="output", print_response=False, use_rag=False, use_context_learning=False, context_learning_path="data/context_learning", chroma_db_path="rag/chroma_db", manim_docs_path="rag/manim_docs", embedding_model="azure/text-embedding-3-large", use_visual_fix_code=False, use_langfuse=True, session_id=None):
        """Initialize the CodeGenerator.

        Args:
            scene_model: The model used for scene generation
            helper_model: The model used for helper tasks
            output_dir (str, optional): Directory for output files. Defaults to "output".
            print_response (bool, optional): Whether to print model responses. Defaults to False.
            use_rag (bool, optional): Whether to use RAG. Defaults to False.
            use_context_learning (bool, optional): Whether to use context learning. Defaults to False.
            context_learning_path (str, optional): Path to context learning examples. Defaults to "data/context_learning".
            chroma_db_path (str, optional): Path to ChromaDB. Defaults to "rag/chroma_db".
            manim_docs_path (str, optional): Path to Manim docs. Defaults to "rag/manim_docs".
            embedding_model (str, optional): Name of embedding model. Defaults to "azure/text-embedding-3-large".
            use_visual_fix_code (bool, optional): Whether to use visual code fixing. Defaults to False.
            use_langfuse (bool, optional): Whether to use Langfuse logging. Defaults to True.
            session_id (str, optional): Session identifier. Defaults to None.
        """
        self.scene_model = scene_model
        self.helper_model = helper_model
        self.output_dir = output_dir
        self.print_response = print_response
        self.use_rag = use_rag
        self.use_context_learning = use_context_learning
        self.context_learning_path = context_learning_path
        self.context_examples = self._load_context_examples() if use_context_learning else None
        self.manim_docs_path = manim_docs_path

        self.use_visual_fix_code = use_visual_fix_code
        self.banned_reasonings = get_banned_reasonings()
        self.session_id = session_id # Use session_id passed from VideoGenerator

        if use_rag:
            self.vector_store = RAGVectorStore(
                chroma_db_path=chroma_db_path,
                manim_docs_path=manim_docs_path,
                embedding_model=embedding_model,
                session_id=self.session_id,
                use_langfuse=use_langfuse
            )
        else:
            self.vector_store = None

    def _load_context_examples(self) -> str:
        """Load all context learning examples from the specified directory.

        Returns:
            str: Formatted context learning examples, or None if no examples found.
        """
        examples = []
        for example_file in glob.glob(f"{self.context_learning_path}/**/*.py", recursive=True):
            with open(example_file, 'r') as f:
                examples.append(f"# Example from {os.path.basename(example_file)}\n{f.read()}\n")

        # Format examples using get_prompt_context_learning_code instead of _prompt_context_learning
        if examples:
            formatted_examples = get_prompt_context_learning_code(
                examples="\n".join(examples)
            )
            return formatted_examples
        return None

    def _generate_rag_queries_code(self, implementation: str, scene_trace_id: str = None, topic: str = None, scene_number: int = None, session_id: str = None, relevant_plugins: List[str] = []) -> List[str]:
        """Generate RAG queries from the implementation plan.

        Args:
            implementation (str): The implementation plan text
            scene_trace_id (str, optional): Trace ID for the scene. Defaults to None.
            topic (str, optional): Topic of the scene. Defaults to None.
            scene_number (int, optional): Scene number. Defaults to None.
            session_id (str, optional): Session identifier. Defaults to None.
            relevant_plugins (List[str], optional): List of relevant plugins. Defaults to empty list.

        Returns:
            List[str]: List of generated RAG queries
        """
        # Create a cache key for this scene
        cache_key = f"{topic}_scene{scene_number}"

        # Check if we already have a cache file for this scene
        cache_dir = os.path.join(self.output_dir, re.sub(r'[^a-z0-9_]+', '_', topic.lower()), f"scene{scene_number}", "rag_cache")
        os.makedirs(cache_dir, exist_ok=True)
        cache_file = os.path.join(cache_dir, "rag_queries_code.json")

        # If cache file exists, load and return cached queries
        if os.path.exists(cache_file):
            with open(cache_file, 'r') as f:
                cached_queries = json.load(f)
                print(f"Using cached RAG queries for {cache_key}")
                return cached_queries

        # Generate new queries if not cached
        if relevant_plugins:
            prompt = get_prompt_rag_query_generation_code(implementation, ", ".join(relevant_plugins))
        else:
            prompt = get_prompt_rag_query_generation_code(implementation, "No plugins are relevant.")

        queries = self.helper_model(
            _prepare_text_inputs(prompt),
            metadata={"generation_name": "rag_query_generation", "trace_id": scene_trace_id, "tags": [topic, f"scene{scene_number}"], "session_id": session_id}
        )

        print(f"RAG queries: {queries}")
        # retreive json triple backticks
        
        try: # add try-except block to handle potential json decode errors
            queries = re.search(r'```json(.*)```', queries, re.DOTALL).group(1)
            queries = json.loads(queries)
        except json.JSONDecodeError as e:
            print(f"JSONDecodeError when parsing RAG queries for storyboard: {e}")
            print(f"Response text was: {queries}")
            return [] # Return empty list in case of parsing error

        # Cache the queries
        with open(cache_file, 'w') as f:
            json.dump(queries, f)

        return queries

    def _generate_rag_queries_error_fix(self, error: str, code: str, scene_trace_id: str = None, topic: str = None, scene_number: int = None, session_id: str = None, relevant_plugins: List[str] = []) -> List[str]:
        """Generate RAG queries for fixing code errors.

        Args:
            error (str): The error message to fix
            code (str): The code containing the error
            scene_trace_id (str, optional): Trace ID for the scene. Defaults to None.
            topic (str, optional): Topic of the scene. Defaults to None.
            scene_number (int, optional): Scene number. Defaults to None.
            session_id (str, optional): Session identifier. Defaults to None.
            relevant_plugins (List[str], optional): List of relevant plugins. Defaults to empty list.

        Returns:
            List[str]: List of generated RAG queries for error fixing
        """
        # Create a cache key for this scene and error
        cache_key = f"{topic}_scene{scene_number}_error_fix"

        # Check if we already have a cache file for error fix queries
        cache_dir = os.path.join(self.output_dir, re.sub(r'[^a-z0-9_]+', '_', topic.lower()), f"scene{scene_number}", "rag_cache")
        os.makedirs(cache_dir, exist_ok=True)
        cache_file = os.path.join(cache_dir, "rag_queries_error_fix.json")

        # If cache file exists, load and return cached queries
        if os.path.exists(cache_file):
            with open(cache_file, 'r') as f:
                cached_queries = json.load(f)
                print(f"Using cached RAG queries for error fix in {cache_key}")
                return cached_queries

        # Generate new queries for error fix if not cached
        prompt = get_prompt_rag_query_generation_fix_error(
            error=error,
            code=code,
            relevant_plugins=", ".join(relevant_plugins) if relevant_plugins else "No plugins are relevant."
        )

        queries = self.helper_model(
            _prepare_text_inputs(prompt),
            metadata={"generation_name": "rag-query-generation-fix-error", "trace_id": scene_trace_id, "tags": [topic, f"scene{scene_number}"], "session_id": session_id}
        )

        # remove json triple backticks
        queries = queries.replace("```json", "").replace("```", "")
        try: # add try-except block to handle potential json decode errors
            queries = json.loads(queries)
        except json.JSONDecodeError as e:
            print(f"JSONDecodeError when parsing RAG queries for error fix: {e}")
            print(f"Response text was: {queries}")
            return [] # Return empty list in case of parsing error

        # Cache the queries
        with open(cache_file, 'w') as f:
            json.dump(queries, f)

        return queries

    def _extract_code_with_retries(self, response_text: str, pattern: str, generation_name: str = None, trace_id: str = None, sessi
```

### Core Architecture Module: `src/core/parse_video.py`
```
import os
import pysrt
from moviepy import VideoFileClip
import shutil
from PIL import Image, ImageOps
import numpy as np
import speech_recognition as sr

def get_images_from_video(video_path, fps=0.2):
    """Extract frames from a video file at specified FPS.

    Args:
        video_path (str): Path to the video file.
        fps (float, optional): Frames per second to extract. Defaults to 0.2.

    Returns:
        list: List of frames as numpy arrays.
    """
    clip = VideoFileClip(video_path)
    images = clip.iter_frames(fps=fps)
    return images

def image_with_most_non_black_space(images, output_path, return_type="path"):
    """Find and save the image with the most non-black space from a list of images.

    Args:
        images (list): List of image file paths, PIL Image objects, or numpy arrays.
        output_path (str): Path where the output image should be saved.
        return_type (str, optional): Type of return value - "path" or "image". Defaults to "path".

    Returns:
        Union[str, PIL.Image, None]: Path to saved image, PIL Image object, or None if no valid image found.
    """
    max_non_black_area = 0
    image_with_max_non_black_space = None

    for img in images:
        try:
            # If img is a path, open the image
            if isinstance(img, str):
                image = Image.open(img)
            elif isinstance(img, Image.Image):
                image = img
            elif isinstance(img, np.ndarray):
                image = Image.fromarray(img)
            else:
                print(f"Unsupported type: {type(img)}. Skipping.")
                continue

            # Convert to grayscale
            gray = ImageOps.grayscale(image)

            # Convert to numpy array
            gray_array = np.array(gray)

            # Count non-black pixels (threshold to consider near-black as black)
            non_black_pixels = np.sum(gray_array > 10)  # Threshold 10 to account for slight variations in black

            if non_black_pixels > max_non_black_area:
                max_non_black_area = non_black_pixels
                image_with_max_non_black_space = image

        except Exception as e:
            print(f"Warning: Unable to process image {img}: {e}")

    if image_with_max_non_black_space is not None:
        image_with_max_non_black_space.save(output_path)
        print(f"Saved image with most non-black space to {output_path}")
        
        if return_type == "path":
            return output_path
        else:
            return image_with_max_non_black_space
    return image_with_max_non_black_space

def parse_srt_to_text(output_dir, topic_name):
    """Convert SRT subtitle file to plain text.

    Args:
        output_dir (str): Directory containing the topic folders.
        topic_name (str): Name of the topic/video.
    """
    topic_name = topic_name.replace(" ", "_").lower()
    srt_path = os.path.join(output_dir, topic_name, f"{topic_name}_combined.srt")
    txt_path = os.path.join(output_dir, topic_name, f"{topic_name}_combined.txt")
    subs = pysrt.open(srt_path)
    
    with open(txt_path, 'w') as f:
        full_text = ""
        for sub in subs:
            sub.text = sub.text.replace("...", ".")
            full_text += sub.text + " "
        f.write(full_text.strip())

def parse_srt_and_extract_frames(output_dir, topic_name):
    """Extract frames from video at subtitle timestamps and save with corresponding text.

    Args:
        output_dir (str): Directory containing the topic folders.
        topic_name (str): Name of the topic/video.
    """
    topic_name = topic_name.replace(" ", "_").lower()
    video_path = os.path.join(output_dir, topic_name, f"{topic_name}_combined.mp4")
    srt_path = os.path.join(output_dir, topic_name, f"{topic_name}_combined.srt")
    subs = pysrt.open(srt_path)
    
    # Create extract_images folder if it doesn't exist
    images_dir = os.path.join(output_dir, topic_name, "extract_images")
    if os.path.exists(images_dir):
        shutil.rmtree(images_dir)
    os.makedirs(images_dir)
    
    # Load the video file
    video = VideoFileClip(video_path)
    
    # Dictionary to store image-text pairs
    pairs = {}
    
    i = 0
    while i < len(subs):
        sub = subs[i]
        text = sub.text
        sub_indexes = [sub.index]
        
        # Check if we need to concatenate with next subtitle
        while i < len(subs) - 1 and not text.strip().endswith('.'):
            i += 1
            next_sub = subs[i]
            text += " " + next_sub.text
            sub_indexes.append(next_sub.index)
        
        # Get the end time of the last concatenated subtitle
        end_time = sub.end.to_time()
        # Convert end time to seconds
        end_time_seconds = end_time.hour * 3600 + end_time.minute * 60 + end_time.second + end_time.microsecond / 1e6
        
        # Save the frame as an image in extract_images folder
        frame_path = os.path.join(images_dir, f"{sub.index}.jpg")
        video.save_frame(frame_path, t=end_time_seconds)
        
        # Save the subtitle text to a txt file
        text_path = os.path.join(images_dir, f"{sub.index}.txt")
        with open(text_path, 'w') as f:
            f.write(text)

        # Add pair to dictionary
        pairs[str(sub.index)] = {
            "image_path": f"{sub.index}.jpg",
            "text": text,
            "text_path": f"{sub.index}.txt",
            "srt_index": sub_indexes,
        }
        
        i += 1
    
    # Save pairs to json file
    import json
    json_path = os.path.join(images_dir, "pairs.json")
    with open(json_path, 'w') as f:
        json.dump(pairs, f, indent=4)
    
    # Close the video file
    video.close()

def extract_trasnscript(video_path):
    """Extract transcript from video audio using Google Speech Recognition.

    Args:
        video_path (str): Path to the video file.

    Returns:
        str: Transcribed text from the video audio.

    Raises:
        FileNotFoundError: If video file does not exist.
    """
    if not os.path.exists(video_path):
        raise FileNotFoundError(f"Video file not found: {video_path}")
    
    clip = VideoFileClip(video_path)

    # write the video to a temporary audio file
    audio_path = os.path.join(os.path.dirname(video_path), "audio.wav")
    clip.audio.write_audiofile(audio_path)

    try:
        # extract the subtitles from the audio file
        recognizer = sr.Recognizer()
        with sr.AudioFile(audio_path) as source:
            audio = recognizer.record(source)
        return recognizer.recognize_google(audio)
    finally:
        # clean up the temporary audio file
        if os.path.exists(audio_path):
            os.remove(audio_path)

if __name__ == "__main__":
    import argparse
    
    def process_all_topics(output_folder):
        """Process all topic folders in the output directory.

        Args:
            output_folder (str): Directory containing the topic folders.
        """
        # Only get immediate subdirectories
        topics = [d for d in os.listdir(output_folder) 
                 if os.path.isdir(os.path.join(output_folder, d))]
        
        for topic in topics:
            print(f"\nProcessing topic: {topic}")
            try:
                parse_srt_to_text(output_folder, topic)
                parse_srt_and_extract_frames(output_folder, topic)
            except Exception as e:
                print(f"Error processing {topic}: {str(e)}")
                continue

    # Set up argument parser
    parser = argparse.ArgumentParser(description='Process video files and extract frames with subtitles')
    parser.add_argument('--output_dir', type=str, default="output",
                      help='Directory containing the topic folders')
    
    args = parser.parse_args()
    
    # Process topics using provided output directory
    process_all_topics(args.output_dir)
```

### Core Architecture Module: `src/core/video_planner.py`
```
import os
import re
import json
import glob
from typing import List, Optional
import uuid
import asyncio

from mllm_tools.utils import _prepare_text_inputs
from src.utils.utils import extract_xml
from task_generator import (
    get_prompt_scene_plan,
    get_prompt_scene_vision_storyboard,
    get_prompt_scene_technical_implementation,
    get_prompt_scene_animation_narration,
    get_prompt_context_learning_scene_plan,
    get_prompt_context_learning_vision_storyboard,
    get_prompt_context_learning_technical_implementation,
    get_prompt_context_learning_animation_narration,
    get_prompt_context_learning_code
)
from src.rag.rag_integration import RAGIntegration

class VideoPlanner:
    """A class for planning and generating video content.

    This class handles the planning and generation of video content including scene outlines,
    vision storyboards, technical implementations, and animation narrations.

    Args:
        planner_model: The model used for planning tasks
        helper_model: Optional helper model, defaults to planner_model if None
        output_dir (str): Directory for output files. Defaults to "output"
        print_response (bool): Whether to print model responses. Defaults to False
        use_context_learning (bool): Whether to use context learning. Defaults to False
        context_learning_path (str): Path to context learning examples. Defaults to "data/context_learning"
        use_rag (bool): Whether to use RAG. Defaults to False
        session_id (str): Session identifier. Defaults to None
        chroma_db_path (str): Path to ChromaDB. Defaults to "data/rag/chroma_db"
        manim_docs_path (str): Path to Manim docs. Defaults to "data/rag/manim_docs"
        embedding_model (str): Name of embedding model. Defaults to "text-embedding-ada-002"
        use_langfuse (bool): Whether to use Langfuse logging. Defaults to True
    """

    def __init__(self, planner_model, helper_model=None, output_dir="output", print_response=False, use_context_learning=False, context_learning_path="data/context_learning", use_rag=False, session_id=None, chroma_db_path="data/rag/chroma_db", manim_docs_path="data/rag/manim_docs", embedding_model="text-embedding-ada-002", use_langfuse=True):
        self.planner_model = planner_model
        self.helper_model = helper_model if helper_model is not None else planner_model
        self.output_dir = output_dir
        self.print_response = print_response
        self.use_context_learning = use_context_learning
        self.context_learning_path = context_learning_path
        # Initialize different types of context examples
        self.scene_plan_examples = self._load_context_examples('scene_plan') if use_context_learning else None
        self.vision_storyboard_examples = self._load_context_examples('scene_vision_storyboard') if use_context_learning else None
        self.technical_implementation_examples = self._load_context_examples('technical_implementation') if use_context_learning else None
        self.animation_narration_examples = self._load_context_examples('scene_animation_narration') if use_context_learning else None
        self.code_examples = self._load_context_examples('code') if use_context_learning else None
        self.use_rag = use_rag
        self.rag_integration = None
        if use_rag:
            self.rag_integration = RAGIntegration(
                helper_model=helper_model,
                output_dir=output_dir,
                chroma_db_path=chroma_db_path,
                manim_docs_path=manim_docs_path,
                embedding_model=embedding_model,
                use_langfuse=use_langfuse,
                session_id=session_id
            )
        self.relevant_plugins = []  # Initialize as an empty list

    def _load_context_examples(self, example_type: str) -> str:
        """Load context learning examples of a specific type from files.

        Args:
            example_type (str): Type of examples to load ('scene_plan', 'scene_vision_storyboard', etc.)

        Returns:
            str: Formatted string containing the loaded examples, or None if no examples found
        """
        examples = []
        
        # Define file patterns for different types
        file_patterns = {
            'scene_plan': '*_scene_plan.txt',
            'scene_vision_storyboard': '*_scene_vision_storyboard.txt',
            'technical_implementation': '*_technical_implementation.txt',
            'scene_animation_narration': '*_scene_animation_narration.txt',
            'code': '*.py'
        }
        
        pattern = file_patterns.get(example_type)
        if not pattern:
            return None

        # Search in subdirectories of context_learning_path
        for root, _, _ in os.walk(self.context_learning_path):
            for example_file in glob.glob(os.path.join(root, pattern)):
                with open(example_file, 'r') as f:
                    content = f.read()
                    if example_type == 'code':
                        examples.append(f"# Example from {os.path.basename(example_file)}\n{content}\n")
                    else:
                        examples.append(f"# Example from {os.path.basename(example_file)}\n{content}\n")

        # Format examples using appropriate template
        if examples:
            formatted_examples = self._format_examples(example_type, examples)
            return formatted_examples
        return None

    def _format_examples(self, example_type: str, examples: List[str]) -> str:
        """Format examples using the appropriate template based on their type.

        Args:
            example_type (str): Type of examples to format
            examples (List[str]): List of example strings to format

        Returns:
            str: Formatted examples string, or None if no template found
        """
        templates = {
            'scene_plan': get_prompt_context_learning_scene_plan,
            'scene_vision_storyboard': get_prompt_context_learning_vision_storyboard,
            'technical_implementation': get_prompt_context_learning_technical_implementation,
            'scene_animation_narration': get_prompt_context_learning_animation_narration,
            'code': get_prompt_context_learning_code
        }
        
        template = templates.get(example_type)
        if template:
            return template(examples="\n".join(examples))
        return None

    def generate_scene_outline(self,
                            topic: str,
                            description: str,
                            session_id: str) -> str:
        """Generate a scene outline based on the topic and description.

        Args:
            topic (str): The topic of the video
            description (str): Description of the video content
            session_id (str): Session identifier

        Returns:
            str: Generated scene outline
        """
        # Detect relevant plugins upfront if RAG is enabled
        if self.use_rag:
            self.relevant_plugins = self.rag_integration.detect_relevant_plugins(topic, description) or []
            self.rag_integration.set_relevant_plugins(self.relevant_plugins)
            print(f"Detected relevant plugins: {self.relevant_plugins}")

        prompt = get_prompt_scene_plan(topic, description)
        
        if self.use_context_learning and self.scene_plan_examples:
            prompt += f"\n\nHere are some example scene plans for reference:\n{self.scene_plan_examples}"

        # Generate plan using planner model
        response_text = self.planner_model(
            _prepare_text_inputs(prompt),
            metadata={"generation_name": "scene_outline", "tags": [topic, "scene-outline"], "session_id": session_id}
        )
        # extract scene outline <SCENE_OUTLINE> ... </SCENE_OUTLINE>
        scene_outline_match = re.search(r'(<SCENE_OUTLINE>.*?</SCENE_OUTLINE>)', response_text, re.DOTALL)
        scene_outline = scene_outline_match.group(1) if scene_outline_match else response_text

        # replace all spaces and special characters with underscores for file path compatibility
        file_prefix = topic.lower()
        file_prefix = re.sub(r'[^a-z0-9_]+', '_', file_prefix)
        # save plan to file
        os.makedirs(os.path.join(self.output_dir, file_prefix), exist_ok=True) # Ensure directory exists
        with open(os.path.join(self.output_dir, file_prefix, f"{file_prefix}_scene_outline.txt"), "w") as f:
            f.write(scene_outline)
        print(f"Plan saved to {file_prefix}_scene_outline.txt")

        return scene_outline

    async def _generate_scene_implementation_single(self, topic: str, description: str, scene_outline_i: str, i: int, file_prefix: str, session_id: str, scene_trace_id: str) -> str:
        """Generate implementation plan for a single scene.

        Args:
            topic (str): The topic of the video
            description (str): Description of the video content
            scene_outline_i (str): Outline for this specific scene
            i (int): Scene number
            file_prefix (str): Prefix for output files
            session_id (str): Session identifier
            scene_trace_id (str): Unique trace ID for this scene

        Returns:
            str: Generated implementation plan for the scene
        """
        # Initialize empty implementation plan
        implementation_plan = ""
        scene_dir = os.path.join(self.output_dir, file_prefix, f"scene{i}")
        subplan_dir = os.path.join(scene_dir, "subplans")
        os.makedirs(scene_dir, exist_ok=True)
        os.makedirs(subplan_dir, exist_ok=True)

        # Save scene_trace_id to file
        trace_id_file = os.path.join(subplan_dir, "scene_trace_id.txt")
        with open(trace_id_file, 'w') as f:
            f.write(scene_trace_id)
        print(f"Scene trace ID saved to {trace_id_file}")

        # ===== Step 1: Generate Scene Vision and Storyboard =====
        # ===================
```

### Core Architecture Module: `src/core/video_renderer.py`
```
import os
import re
import subprocess
import asyncio
from PIL import Image
from typing import Optional, List
import traceback
import sys

from src.core.parse_video import (
    get_images_from_video,
    image_with_most_non_black_space
)
from mllm_tools.vertex_ai import VertexAIWrapper
from mllm_tools.gemini import GeminiWrapper

class VideoRenderer:
    """Class for rendering and combining Manim animation videos."""

    def __init__(self, output_dir="output", print_response=False, use_visual_fix_code=False):
        """Initialize the VideoRenderer.

        Args:
            output_dir (str, optional): Directory for output files. Defaults to "output".
            print_response (bool, optional): Whether to print responses. Defaults to False.
            use_visual_fix_code (bool, optional): Whether to use visual fix code. Defaults to False.
        """
        self.output_dir = output_dir
        self.print_response = print_response
        self.use_visual_fix_code = use_visual_fix_code

    async def render_scene(self, code: str, file_prefix: str, curr_scene: int, curr_version: int, code_dir: str, media_dir: str, max_retries: int = 3, use_visual_fix_code=False, visual_self_reflection_func=None, banned_reasonings=None, scene_trace_id=None, topic=None, session_id=None):
        """Render a single scene and handle error retries and visual fixes.

        Args:
            code (str): The Manim code to render
            file_prefix (str): Prefix for output files
            curr_scene (int): Current scene number
            curr_version (int): Current version number
            code_dir (str): Directory for code files
            media_dir (str): Directory for media output
            max_retries (int, optional): Maximum retry attempts. Defaults to 3.
            use_visual_fix_code (bool, optional): Whether to use visual fix code. Defaults to False.
            visual_self_reflection_func (callable, optional): Function for visual self-reflection. Defaults to None.
            banned_reasonings (list, optional): List of banned reasoning strings. Defaults to None.
            scene_trace_id (str, optional): Scene trace identifier. Defaults to None.
            topic (str, optional): Topic name. Defaults to None.
            session_id (str, optional): Session identifier. Defaults to None.

        Returns:
            tuple: (code, error_message) where error_message is None on success
        """
        retries = 0
        while retries < max_retries:
            try:
                # Execute manim in a thread to prevent blocking
                file_path = os.path.join(code_dir, f"{file_prefix}_scene{curr_scene}_v{curr_version}.py")
                result = await asyncio.to_thread(
                    subprocess.run,
                    ["manim", "-qh", file_path, "--media_dir", media_dir, "--progress_bar", "none"],
                    capture_output=True,
                    text=True
                )

                # if result.returncode != 0, it means that the code is not rendered successfully
                # so we need to fix the code by returning the code and the error message
                if result.returncode != 0:
                    raise Exception(result.stderr)

                if use_visual_fix_code and visual_self_reflection_func and banned_reasonings:
                    # Get the rendered video path
                    video_path = os.path.join(
                        media_dir,
                        "videos",
                        f"{file_prefix}_scene{curr_scene}_v{curr_version}.mp4"
                    )
                    
                    # For Gemini/Vertex AI models, pass the video directly
                    if self.scene_model.model_name.startswith(('gemini/', 'vertex_ai/')):
                        media_input = video_path
                    else:
                        # For other models, use image snapshot
                        media_input = self.create_snapshot_scene(
                            topic, curr_scene, curr_version, return_type="path"
                        )
                        
                    new_code, log = visual_self_reflection_func(
                        code,
                        media_input,
                        scene_trace_id=scene_trace_id,
                        topic=topic,
                        scene_number=curr_scene,
                        session_id=session_id
                    )

                    with open(os.path.join(code_dir, f"{file_prefix}_scene{curr_scene}_v{curr_version}_vfix_log.txt"), "w") as f:
                        f.write(log)

                    # Check for termination markers
                    if "<LGTM>" in new_code or any(word in new_code for word in banned_reasonings):
                        break

                    code = new_code
                    curr_version += 1
                    with open(os.path.join(code_dir, f"{file_prefix}_scene{curr_scene}_v{curr_version}.py"), "w") as f:
                        f.write(code)
                    print(f"Code saved to scene{curr_scene}/code/{file_prefix}_scene{curr_scene}_v{curr_version}.py")
                    retries = 0
                    continue

                break  # Exit retry loop on success

            except Exception as e:
                print(f"Error: {e}")
                print(f"Retrying {retries+1} of {max_retries}...")

                with open(os.path.join(code_dir, f"{file_prefix}_scene{curr_scene}_v{curr_version}_error.log"), "a") as f:
                    f.write(f"\nError in attempt {retries}:\n{str(e)}\n")
                retries += 1
                return code, str(e) # Indicate failure and return error message
            
        print(f"Successfully rendered {file_path}")
        with open(os.path.join(self.output_dir, file_prefix, f"scene{curr_scene}", "succ_rendered.txt"), "w") as f:
            f.write("")

        return code, None # Indicate success

    def run_manim_process(self,
                          topic: str):
        """Run manim on all generated manim code for a specific topic.

        Args:
            topic (str): Topic name to process

        Returns:
            subprocess.CompletedProcess: Result of the final manim process
        """
        file_prefix = topic.lower()
        file_prefix = re.sub(r'[^a-z0-9_]+', '_', file_prefix)
        search_path = os.path.join(self.output_dir, file_prefix)
        # Iterate through scene folders
        scene_folders = [f for f in os.listdir(search_path) if os.path.isdir(os.path.join(search_path, f))]
        scene_folders.sort()  # Sort to process scenes in order

        for folder in scene_folders:
            folder_path = os.path.join(search_path, folder)

            # Get all Python files in version order
            py_files = [f for f in os.listdir(folder_path) if f.endswith('.py')]
            py_files.sort(key=lambda x: int(x.split('_v')[-1].split('.')[0]))  # Sort by version number

            for file in py_files:
                file_path = os.path.join(folder_path, file)
                try:
                    media_dir = os.path.join(self.output_dir, file_prefix, "media")
                    result = subprocess.run(
                        f"manim -qh {file_path} --media_dir {media_dir}",
                        shell=True,
                        capture_output=True,
                        text=True
                    )
                    if result.returncode != 0:
                        raise Exception(result.stderr)
                    print(f"Successfully rendered {file}")
                    break  # Move to next scene folder if successful
                except Exception as e:
                    print(f"Error rendering {file}: {e}")
                    error_log_path = os.path.join(folder_path, f"{file.split('.')[0]}_error.log") # drop the extra py
                    with open(error_log_path, "w") as f:
                        f.write(f"Error:\n{str(e)}\n")
                    print(f"Error log saved to {error_log_path}")
        return result

    def create_snapshot_scene(self, topic: str, scene_number: int, version_number: int, return_type: str = "image"):
        """Create a snapshot of the video for a specific topic and scene.

        Args:
            topic (str): Topic name
            scene_number (int): Scene number
            version_number (int): Version number
            return_type (str, optional): Type of return value - "path" or "image". Defaults to "image".

        Returns:
            Union[str, PIL.Image]: Path to saved image or PIL Image object

        Raises:
            FileNotFoundError: If no mp4 files found in video folder
        """
        file_prefix = topic.lower()
        file_prefix = re.sub(r'[^a-z0-9_]+', '_', file_prefix)
        search_path = os.path.join(self.output_dir, file_prefix)
        video_folder_path = os.path.join(search_path, "media", "videos", f"{file_prefix}_scene{scene_number}_v{version_number}", "1080p60")
        os.makedirs(video_folder_path, exist_ok=True)
        snapshot_path = os.path.join(video_folder_path, "snapshot.png")
        # Get the mp4 video file from the video folder path
        video_files = [f for f in os.listdir(video_folder_path) if f.endswith('.mp4')]
        if not video_files:
            raise FileNotFoundError(f"No mp4 files found in {video_folder_path}")
        video_path = os.path.join(video_folder_path, video_files[0])
        saved_image = image_with_most_non_black_space(get_images_from_video(video_path), snapshot_path, return_type=return_type)
        return saved_image

    def combine_videos(self, topic: str):
        """Combine all videos and subtitle files for a specific topic using ffmpeg.

        Args:
            topic (str): Topic name to combine videos for

        This function will:
        - Find all scene videos and subtitles
        - Combine videos with or without audio
        - Merge subtitle files wi
```

### Core Architecture Module: `src/utils/kokoro_voiceover.py`
```
"""
Copyright (c) 2025 Xposed73
All rights reserved.
This file is part of the Manim Voiceover project.
"""

import hashlib
import json
import numpy as np
from pathlib import Path
from manim_voiceover.services.base import SpeechService
from kokoro_onnx import Kokoro
from manim_voiceover.helper import remove_bookmarks, wav2mp3
from scipy.io.wavfile import write as write_wav
from src.config.config import Config


class KokoroService(SpeechService):
    """Speech service class for kokoro_self (using text_to_speech via Kokoro ONNX)."""

    def __init__(self, engine=None, 
                 model_path: str = Config.KOKORO_MODEL_PATH,
                 voices_path: str = Config.KOKORO_VOICES_PATH,
                 voice: str = Config.KOKORO_DEFAULT_VOICE,
                 speed: float = Config.KOKORO_DEFAULT_SPEED,
                 lang: str = Config.KOKORO_DEFAULT_LANG,
                 **kwargs):
        self.kokoro = Kokoro(model_path, voices_path)
        self.voice = voice
        self.speed = speed
        self.lang = lang

        if engine is None:
            engine = self.text_to_speech  # Default to local function

        self.engine = engine
        super().__init__(**kwargs)

    def get_data_hash(self, input_data: dict) -> str:
        """
        Generates a hash based on the input data dictionary.
        The hash is used to create a unique identifier for the input data.

        Parameters:
            input_data (dict): A dictionary of input data (e.g., text, voice, etc.).

        Returns:
            str: The generated hash as a string.
        """
        # Convert the input data dictionary to a JSON string (sorted for consistency)
        data_str = json.dumps(input_data, sort_keys=True)
        # Generate a SHA-256 hash of the JSON string
        return hashlib.sha256(data_str.encode('utf-8')).hexdigest()

    def text_to_speech(self, text, output_file, voice_name, speed, lang):
        """
        Generates speech from text using Kokoro ONNX and saves the audio file.
        Normalizes the audio to make it audible.
        """
        # Generate audio samples using Kokoro
        samples, sample_rate = self.kokoro.create(
            text, voice=voice_name, speed=speed, lang=lang
        )

        # Normalize audio to the range [-1, 1]
        max_val = np.max(np.abs(samples))
        if max_val > 0:
            samples = samples / max_val

        # Convert to 16-bit integer PCM format
        samples = (samples * 32767).astype("int16")

        # Save the normalized audio as a .wav file
        write_wav(output_file, sample_rate, samples)
        print(f"Saved at {output_file}")

        return output_file


    def generate_from_text(self, text: str, cache_dir: str = None, path: str = None) -> dict:
        if cache_dir is None:
            cache_dir = self.cache_dir

        input_data = {"input_text": text, "service": "kokoro_self", "voice": self.voice, "lang": self.lang}
        cached_result = self.get_cached_result(input_data, cache_dir)
        if cached_result is not None:
            return cached_result

        if path is None:
            audio_path = self.get_data_hash(input_data) + ".mp3"
        else:
            audio_path = path

        # Generate .wav file using the text_to_speech function
        audio_path_wav = str(Path(cache_dir) / audio_path.replace(".mp3", ".wav"))
        self.engine(
            text=text,
            output_file=audio_path_wav,
            voice_name=self.voice,
            speed=self.speed,
            lang=self.lang,
        )

        # Convert .wav to .mp3
        mp3_audio_path = str(Path(cache_dir) / audio_path)
        wav2mp3(audio_path_wav, mp3_audio_path)

        # Remove original .wav file
        remove_bookmarks(audio_path_wav)

        json_dict = {
            "input_text": text,
            "input_data": input_data,
            "original_audio": audio_path,
        }

        return json_dict
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #32** (2025-06-26): **why the kokoro doesn't apply lang 'en-us'?**
  *Symptoms*: even i didn't change kokoro default language from template, why this error occurs? i tried en. en-us, en-gb. but none of them activates.  │ kend\base.py:100 in _init_language │ │ │ │ 97 │ │ │ │ 98 │ │ """ │ │ 99 │ │ if not cls.is_supported_language(language): │ │ > 100 │ │ │ raise RuntimeError( │ │ 101 │ │ │ │ f'language "{language}" is not supported by the ' │ │ 102 │ │ │ │ f'{cls.name()} backend') │ │ 103 │ │ return language │ └─────────────────────────────────────────────────────────────────────────────┘ RuntimeError: language "en-us" is not supported by the espeak backend
  **Post-Mortem & Fix Analysis**:
  > it seems you need to configure your locale? 

- **Issue #30** (2025-04-07): **Hello, the files data/rag/chroma_db and data/rag/manim_docs are missing**
  *Symptoms*: Hello, the files data/rag/chroma_db and data/rag/manim_docs are missing, thank you 🙏
  **Post-Mortem & Fix Analysis**:
  > https://github.com/TIGER-AI-Lab/TheoremExplainAgent?tab=readme-ov-file#generation-with-rag

- **Issue #29** (2025-04-07): **How long does it take you from inputting a theorem to finally rendering a video?**
  *Symptoms*: It took me more than 30 minutes. Is there something wrong? I would like to ask the open-source author, how long does it usually take to generate each video after your testing?If other friends have also successfully called the system and generated videos, you can also let me know how long it took you to generate the videos.
  **Post-Mortem & Fix Analysis**:
  > We reported our average output tokens, cost, and inference time for TheoremExplainAgent in paper Table 4 (Appendix). The time can varied from 1120s (18 mins) to 2380s (39 mins).  <img width="694" alt="Image" src="https://github.com/user-attachments/assets/35e88608-a594-418c-893f-20a4da8d198f" />

- **Issue #27** (2025-04-07): **Video Rendering Aborted Due to Missing Scenes**
  *Symptoms*: **Description** When running generate_video.py with the --check_status flag, the script detects existing implementation plans for all scenes but later reports that all scenes are missing. This causes the video combination step to abort.  **Error Output** ``` Starting video rendering for topic: Big O notation No scenes need processing for topic 'Big O notation'. Video rendering completed for topic 'Big O notation'. Warning: Missing scene 1 Warning: Missing scene 2 Warning: Missing scene 3 Warning: Missing scene 4 Warning: Missing scene 5 Not all videos/subtitles are found, aborting video combination. ```  **Steps to Reproduce** ``` python generate_video.py --model "ollama/codellama:13b" --helper_model "ollama/codellama:13b" \ --output_dir "output/big_o" --topic "Big O notation" \ --context "most common type of asymptotic notation in computer science used to measure worst case complexity" \ --check_status ```  ![Image](https://github.com/user-attachments/assets/f56e3e38-525d-4e97-8096-a0f2ac5414fe)  ![Image](https://github.com/user-attachments/assets/6f13752a-3205-455f-8af4-f386d85671f3)  ![Image](https://github.com/user-attachments/assets/5638e28e-f8b6-4146-839a-9fe085771a9a)  ![Image](https://github.com/user-attachments/assets/3ebf630d-9322-4194-9aaf-eca137367e7a)
  **Post-Mortem & Fix Analysis**:
  > Currently opensource models doesn't work well in TheoremExplainAgent. Try close-source models like o3-mini.

- **Issue #26** (2025-09-16): **Missing Required Arguments in render_video_fix_code() Function Call**
  *Symptoms*: When running generate_video.py with the --only_gen_vid flag, the script crashes due to missing required arguments (scene_outline and implementation_plans) in the render_video_fix_code() function call.  **Error Traceback:** ``` Traceback (most recent call last):   File "C:\TheoremExplainAgent\generate_video.py", line 938, in <module>     video_generator.render_video_fix_code(args.topic, args.context, max_retries=args.max_retries) TypeError: VideoGenerator.render_video_fix_code() missing 2 required positional arguments: 'scene_outline' and 'implementation_plans' ```  **Steps to Reproduce:** ``` python generate_video.py --model "ollama/codellama:13b" --helper_model "ollama/codellama:13b" \ --output_dir "output/big_o" --topic "Big O notation" \ --context "most common type of asymptotic notation in computer science used to measure worst case complexity" \ --only_gen_vid ```  **Expected Behavior** The script should execute successfully by passing the necessary arguments (scene_outline and implementation_plans) to render_video_fix_code().   **Possible Fix** Modify generate_video.py to ensure that scene_outline and implementation_plans are correctly generated and passed to render_video_fix_code().
  **Post-Mortem & Fix Analysis**:
  > I also find this problem

- **Issue #25** (2025-06-26): **INVALID_PROTOBUF Error**
  *Symptoms*: InvalidProtobuf: [ONNXRuntimeError] : 7 : INVALID_PROTOBUF : Load model from models/kokoro-v0_19.onnx failed:Protobuf parsing failed.  
  **Post-Mortem & Fix Analysis**:
  > Did you download the Kokoro model and voices? Installation step 3: ```shell mkdir -p models && wget -P models https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files/kokoro-v0_19.onnx && wget -P models https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files/voices.bin ```

- **Issue #24** (2025-03-25): **安装文档严重缺失 - 缺少多个软件依赖**
  *Symptoms*: 需要前置： libsdl-pango-dev portaudio19-dev 等   然后花了几十刀的Token费用，最后出错： RuntimeWarning: Couldn't find ffmpeg or avconv - defaulting to ffmpeg  真是欲哭无泪😭
  **Post-Mortem & Fix Analysis**:
  > Same as #12 . Now we have added instructions in Installation README.

- **Issue #21** (2025-06-26): **Failure and trapped in this loop**
  *Symptoms*: Starting video rendering for topic: Big O notation Rendering 5 scenes that need processing... Accumulated Cost: $0.0011910750 Code saved to output/my_exp_name\big_o_notation\scene1\code/big_o_notation_scene1_v0.py Error: latex: major issue: So far, you have not checked for MiKTeX updates. latex: major issue: So far, you have not checked for MiKTeX updates. latex: major issue: So far, you have not checked for MiKTeX updates. latex: major issue: So far, you have not checked for MiKTeX updates. +--------------------- Traceback (most recent call last) ---------------------+ | D:\Software\Anaconda\envs\tea\Lib\site-packages\manim\cli\render\commands.p | | y:120 in render                                                             | |                                                                             | |   117             try:                                                      | |   118                 with tempconfig({}):                                  | |   119                     scene = SceneClass()                              | | > 120                     scene.render()                                    | |   121             except Exception:                                         | |   122                 error_console.print_exception()                       | |   123                 sys.exit(1)                                           | |                                                                             | | D:\Software\Anaconda\envs\tea\Lib\site-pa
  **Post-Mortem & Fix Analysis**:
  > it seems your latex is not properly installed?

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

### Incident Patch 1: `26ecd966` (2025-03-30)
**Commit Message**: Adding guide on modifying system prompt

**File**: `README.md` (modified, +12/-0)
```diff
@@ -250,6 +250,18 @@ options:
 ```
 * For `file_path`, it is recommended to pass a folder containing both an MP4 file and an SRT file.
 
+## Misc: Modify the system prompt in TheoremExplainAgent
+
+If you want to modify the system prompt, you need to:
+
+1. Modify files in `task_generator/prompts_raw` folder.
+2. Run `task_generator/parse_prompt.py` to rebuild the `__init__.py` file.
+
+```python
+cd task_generator
+python parse_prompt.py
+cd ..
+```
 
 ## ❓ FAQ
 
```

#### Recent Merged Pull Requests:
- *No recent PR discussions fetched.*

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

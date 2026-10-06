# Forensic Learning Record (Deep Inspection): HKUDS/VideoRAG

> **Canonical Artifact**: `07_PROJECT_LEARNING/hkuds-videorag-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/HKUDS/VideoRAG](https://github.com/HKUDS/VideoRAG))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:15:33.347Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `HKUDS/VideoRAG`
- **Description**: [KDD'2026] "VideoRAG: Chat with Your Videos"
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 3387 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `VideoRAG-algorithm/videorag/_utils.py`
```
import asyncio
import html
import json
import logging
import os
import re
import numbers
from dataclasses import dataclass
from functools import wraps
from hashlib import md5
from typing import Any, Union

import numpy as np
import tiktoken

logger = logging.getLogger("nano-graphrag")
ENCODER = None


def always_get_an_event_loop() -> asyncio.AbstractEventLoop:
    try:
        # If there is already an event loop, use it.
        loop = asyncio.get_event_loop()
    except RuntimeError:
        # If in a sub-thread, create a new event loop.
        logger.info("Creating a new event loop in a sub-thread.")
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    return loop


def locate_json_string_body_from_string(content: str) -> Union[str, None]:
    """Locate the JSON string body from a string"""
    maybe_json_str = re.search(r"{.*}", content, re.DOTALL)
    if maybe_json_str is not None:
        return maybe_json_str.group(0)
    else:
        return None


def convert_response_to_json(response: str) -> dict:
    json_str = locate_json_string_body_from_string(response)
    assert json_str is not None, f"Unable to parse JSON from response: {response}"
    try:
        data = json.loads(json_str)
        return data
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse JSON: {json_str}")
        raise e from None


def encode_string_by_tiktoken(content: str, model_name: str = "gpt-4o"):
    global ENCODER
    if ENCODER is None:
        ENCODER = tiktoken.encoding_for_model(model_name)
    tokens = ENCODER.encode(content)
    return tokens


def decode_tokens_by_tiktoken(tokens: list[int], model_name: str = "gpt-4o"):
    global ENCODER
    if ENCODER is None:
        ENCODER = tiktoken.encoding_for_model(model_name)
    content = ENCODER.decode(tokens)
    return content


def truncate_list_by_token_size(list_data: list, key: callable, max_token_size: int):
    """Truncate a list of data by token size"""
    if max_token_size <= 0:
        return []
    tokens = 0
    for i, data in enumerate(list_data):
        tokens += len(encode_string_by_tiktoken(key(data)))
        if tokens > max_token_size:
            return list_data[:i]
    return list_data


def compute_mdhash_id(content, prefix: str = ""):
    return prefix + md5(content.encode()).hexdigest()


def write_json(json_obj, file_name):
    with open(file_name, "w", encoding="utf-8") as f:
        json.dump(json_obj, f, indent=2, ensure_ascii=False)


def load_json(file_name):
    if not os.path.exists(file_name):
        return None
    with open(file_name, encoding="utf-8") as f:
        return json.load(f)


# it's dirty to type, so it's a good way to have fun
def pack_user_ass_to_openai_messages(*args: str):
    roles = ["user", "assistant"]
    return [
        {"role": roles[i % 2], "content": content} for i, content in enumerate(args)
    ]


def is_float_regex(value):
    return bool(re.match(r"^[-+]?[0-9]*\.?[0-9]+$", value))


def compute_args_hash(*args):
    return md5(str(args).encode()).hexdigest()


def split_string_by_multi_markers(content: str, markers: list[str]) -> list[str]:
    """Split a string by multiple markers"""
    if not markers:
        return [content]
    results = re.split("|".join(re.escape(marker) for marker in markers), content)
    return [r.strip() for r in results if r.strip()]


def enclose_string_with_quotes(content: Any) -> str:
    """Enclose a string with quotes"""
    if isinstance(content, numbers.Number):
        return str(content)
    content = str(content)
    content = content.strip().strip("'").strip('"')
    return f'"{content}"'


def list_of_list_to_csv(data: list[list]):
    return "\n".join(
        [
            ",\t".join([f"{enclose_string_with_quotes(data_dd)}" for data_dd in data_d])
            for data_d in data
        ]
    )


# -----------------------------------------------------------------------------------
# Refer the utils functions of the official GraphRAG implementation:
# https://github.com/microsoft/graphrag
def clean_str(input: Any) -> str:
    """Clean an input string by removing HTML escapes, control characters, and other unwanted characters."""
    # If we get non-string input, just give it back
    if not isinstance(input, str):
        return input

    result = html.unescape(input.strip())
    # https://stackoverflow.com/questions/4324790/removing-control-characters-from-a-string-in-python
    return re.sub(r"[\x00-\x1f\x7f-\x9f]", "", result)


# Utils types -----------------------------------------------------------------------
@dataclass
class EmbeddingFunc:
    embedding_dim: int
    max_token_size: int
    model_name: str
    func: callable

    async def __call__(self, *args, **kwargs) -> np.ndarray:
        # Had to fix this as the embedding function took only one named argument put it's passed in
        # positionally, now we need to pass both
        kwargs['model_name'] = self.model_name
        
        # If there are positional arguments, convert them to keyword arguments
        if args:
            # Assuming the first positional argument is always 'texts'
            if len(args) == 1 and isinstance(args[0], list):
                kwargs['texts'] = args[0]
            else:
                raise ValueError("Unexpected positional arguments. Expected a single list of texts")
        # Call the function with the updated keyword arguments
        return await self.func(**kwargs)        


# Decorators ------------------------------------------------------------------------
def limit_async_func_call(max_size: int, waitting_time: float = 0.0001):
    """Add restriction of maximum async calling times for a async func"""

    def final_decro(func):
        """Not using async.Semaphore to aovid use nest-asyncio"""
        __current_size = 0

        @wraps(func)
        async def wait_func(*args, **kwargs):
            nonlocal __current_size
            while __current_size >= max_size:
                await asyncio.sleep(waitting_time)
            __current_size += 1
            result = await func(*args, **kwargs)
            __current_size -= 1
            return result

        return wait_func

    return final_decro


def wrap_embedding_func_with_attrs(**kwargs):
    """Wrap a function with attributes"""

    def final_decro(func) -> EmbeddingFunc:
        new_func = EmbeddingFunc(**kwargs, func=func)
        return new_func

    return final_decro

```

### Core Architecture Module: `VideoRAG-algorithm/videorag/_videoutil/__init__.py`
```
from .split import split_video, saving_video_segments
from .asr import speech_to_text
from .caption import segment_caption, merge_segment_information, retrieved_segment_caption
from .feature import encode_video_segments, encode_string_query
```

### Core Architecture Module: `VideoRAG-algorithm/videorag/_videoutil/asr.py`
```
import os
import torch
import logging
from tqdm import tqdm
from faster_whisper import WhisperModel
from transformers import AutoModelForSpeechSeq2Seq, AutoProcessor, pipeline

def speech_to_text(video_name, working_dir, segment_index2name, audio_output_format):
    model = WhisperModel("./faster-distil-whisper-large-v3")
    model.logger.setLevel(logging.WARNING)
    
    cache_path = os.path.join(working_dir, '_cache', video_name)
    
    transcripts = {}
    for index in tqdm(segment_index2name, desc=f"Speech Recognition {video_name}"):
        segment_name = segment_index2name[index]
        audio_file = os.path.join(cache_path, f"{segment_name}.{audio_output_format}")

        # if the audio file does not exist, skip it
        if not os.path.exists(audio_file):
            transcripts[index] = ""
            continue
        
        segments, info = model.transcribe(audio_file)
        result = ""
        for segment in segments:
            result += "[%.2fs -> %.2fs] %s\n" % (segment.start, segment.end, segment.text)
        transcripts[index] = result
    
    return transcripts
```

### Core Architecture Module: `VideoRAG-algorithm/videorag/_videoutil/caption.py`
```
import os
import torch
import numpy as np
from PIL import Image
from tqdm import tqdm
from transformers import AutoModel, AutoTokenizer
from moviepy.video.io.VideoFileClip import VideoFileClip

def encode_video(video, frame_times):
    frames = []
    for t in frame_times:
        frames.append(video.get_frame(t))
    frames = np.stack(frames, axis=0)
    frames = [Image.fromarray(v.astype('uint8')).resize((1280, 720)) for v in frames]
    return frames
    
def segment_caption(video_name, video_path, segment_index2name, transcripts, segment_times_info, caption_result, error_queue):
    try:
        model = AutoModel.from_pretrained('./MiniCPM-V-2_6-int4', trust_remote_code=True)
        tokenizer = AutoTokenizer.from_pretrained('./MiniCPM-V-2_6-int4', trust_remote_code=True)
        model.eval()
        
        with VideoFileClip(video_path) as video:
            for index in tqdm(segment_index2name, desc=f"Captioning Video {video_name}"):
                frame_times = segment_times_info[index]["frame_times"]
                video_frames = encode_video(video, frame_times)
                segment_transcript = transcripts[index]
                query = f"The transcript of the current video:\n{segment_transcript}.\nNow provide a description (caption) of the video in English."
                msgs = [{'role': 'user', 'content': video_frames + [query]}]
                params = {}
                params["use_image_id"] = False
                params["max_slice_nums"] = 2
                segment_caption = model.chat(
                    image=None,
                    msgs=msgs,
                    tokenizer=tokenizer,
                    **params
                )
                caption_result[index] = segment_caption.replace("\n", "").replace("<|endoftext|>", "")
                torch.cuda.empty_cache()
    except Exception as e:
        error_queue.put(f"Error in segment_caption:\n {str(e)}")
        raise RuntimeError

def merge_segment_information(segment_index2name, segment_times_info, transcripts, captions):
    inserting_segments = {}
    for index in segment_index2name:
        inserting_segments[index] = {"content": None, "time": None}
        segment_name = segment_index2name[index]
        inserting_segments[index]["time"] = '-'.join(segment_name.split('-')[-2:])
        inserting_segments[index]["content"] = f"Caption:\n{captions[index]}\nTranscript:\n{transcripts[index]}\n\n"
        inserting_segments[index]["transcript"] = transcripts[index]
        inserting_segments[index]["frame_times"] = segment_times_info[index]["frame_times"].tolist()
    return inserting_segments
        
def retrieved_segment_caption(caption_model, caption_tokenizer, refine_knowledge, retrieved_segments, video_path_db, video_segments, num_sampled_frames):
    # model = AutoModel.from_pretrained('./MiniCPM-V-2_6-int4', trust_remote_code=True)
    # tokenizer = AutoTokenizer.from_pretrained('./MiniCPM-V-2_6-int4', trust_remote_code=True)
    # model.eval()
    
    caption_result = {}
    for this_segment in tqdm(retrieved_segments, desc='Captioning Segments for Given Query'):
        video_name = '_'.join(this_segment.split('_')[:-1])
        index = this_segment.split('_')[-1]
        video_path = video_path_db._data[video_name]
        timestamp = video_segments._data[video_name][index]["time"].split('-')
        start, end = eval(timestamp[0]), eval(timestamp[1])
        video = VideoFileClip(video_path)
        frame_times = np.linspace(start, end, num_sampled_frames, endpoint=False)
        video_frames = encode_video(video, frame_times)
        segment_transcript = video_segments._data[video_name][index]["transcript"]
        # query = f"The transcript of the current video:\n{segment_transcript}.\nGiven a question: {query}, you have to extract relevant information from the video and transcript for answering the question."
        query = f"The transcript of the current video:\n{segment_transcript}.\nNow provide a very detailed description (caption) of the video in English and extract relevant information about: {refine_knowledge}'"
        msgs = [{'role': 'user', 'content': video_frames + [query]}]
        params = {}
        params["use_image_id"] = False
        params["max_slice_nums"] = 2
        segment_caption = caption_model.chat(
            image=None,
            msgs=msgs,
            tokenizer=caption_tokenizer,
            **params
        )
        this_caption = segment_caption.replace("\n", "").replace("<|endoftext|>", "")
        caption_result[this_segment] = f"Caption:\n{this_caption}\nTranscript:\n{segment_transcript}\n\n"
        torch.cuda.empty_cache()
    
    return caption_result
```

### Core Architecture Module: `VideoRAG-algorithm/videorag/_videoutil/feature.py`
```
import os
import torch
import pickle
from tqdm import tqdm
from imagebind import data
from imagebind.models import imagebind_model
from imagebind.models.imagebind_model import ImageBindModel, ModalityType


def encode_video_segments(video_paths, embedder: ImageBindModel):
    device = next(embedder.parameters()).device
    inputs = {
        ModalityType.VISION: data.load_and_transform_video_data(video_paths, device),
    }
    with torch.no_grad():
        embeddings = embedder(inputs)[ModalityType.VISION]
    embeddings = embeddings.cpu()
    return embeddings

def encode_string_query(query:str, embedder: ImageBindModel):
    device = next(embedder.parameters()).device
    inputs = {
        ModalityType.TEXT: data.load_and_transform_text([query], device),
    }
    with torch.no_grad():
        embeddings = embedder(inputs)[ModalityType.TEXT]
    embeddings = embeddings.cpu()
    return embeddings
```

### Core Architecture Module: `VideoRAG-algorithm/videorag/_videoutil/split.py`
```
import os
import time
import shutil
import numpy as np
from tqdm import tqdm
from moviepy.video import fx as vfx
from moviepy.video.io.VideoFileClip import VideoFileClip
from .._utils import logger

def split_video(
    video_path,
    working_dir,
    segment_length,
    num_frames_per_segment,
    audio_output_format='mp3',
):  
    unique_timestamp = str(int(time.time() * 1000))
    video_name = os.path.basename(video_path).split('.')[0]
    video_segment_cache_path = os.path.join(working_dir, '_cache', video_name)
    if os.path.exists(video_segment_cache_path):
        shutil.rmtree(video_segment_cache_path)
    os.makedirs(video_segment_cache_path, exist_ok=False)
    
    segment_index = 0
    segment_index2name, segment_times_info = {}, {}
    with VideoFileClip(video_path) as video:
    
        total_video_length = int(video.duration)
        start_times = list(range(0, total_video_length, segment_length))
        # if the last segment is shorter than 5 seconds, we merged it to the last segment
        if len(start_times) > 1 and (total_video_length - start_times[-1]) < 5:
            start_times = start_times[:-1]
        
        for start in tqdm(start_times, desc=f"Spliting Video {video_name}"):
            if start != start_times[-1]:
                end = min(start + segment_length, total_video_length)
            else:
                end = total_video_length
            
            subvideo = video.subclip(start, end)
            subvideo_length = subvideo.duration
            frame_times = np.linspace(0, subvideo_length, num_frames_per_segment, endpoint=False)
            frame_times += start
            
            segment_index2name[f"{segment_index}"] = f"{unique_timestamp}-{segment_index}-{start}-{end}"
            segment_times_info[f"{segment_index}"] = {"frame_times": frame_times, "timestamp": (start, end)}
            
            # save audio
            audio_file_base_name = segment_index2name[f"{segment_index}"]
            audio_file = f'{audio_file_base_name}.{audio_output_format}'
            try:
                subaudio = subvideo.audio
                subaudio.write_audiofile(os.path.join(video_segment_cache_path, audio_file), codec='mp3', verbose=False, logger=None)
            except Exception as e:
                logger.warning(f"Warning: Failed to extract audio for video {video_name} ({start}-{end}). Probably due to lack of audio track.")

            segment_index += 1

    return segment_index2name, segment_times_info

def saving_video_segments(
    video_name,
    video_path,
    working_dir,
    segment_index2name,
    segment_times_info,
    error_queue,
    video_output_format='mp4',
):
    try:
        with VideoFileClip(video_path) as video:
            video_segment_cache_path = os.path.join(working_dir, '_cache', video_name)
            for index in tqdm(segment_index2name, desc=f"Saving Video Segments {video_name}"):
                start, end = segment_times_info[index]["timestamp"][0], segment_times_info[index]["timestamp"][1]
                video_file = f'{segment_index2name[index]}.{video_output_format}'
                subvideo = video.subclip(start, end)
                subvideo.write_videofile(os.path.join(video_segment_cache_path, video_file), codec='libx264', verbose=False, logger=None)
    except Exception as e:
        error_queue.put(f"Error in saving_video_segments:\n {str(e)}")
        raise RuntimeError
```

### Core Architecture Module: `Vimo-desktop/python_backend/videorag/_utils.py`
```
import asyncio
import html
import json
import logging
import os
import re
import numbers
from dataclasses import dataclass
from functools import wraps
from hashlib import md5
from typing import Any, Union

import numpy as np
import tiktoken
import torch

logger = logging.getLogger("nano-graphrag")
ENCODER = None


def always_get_an_event_loop() -> asyncio.AbstractEventLoop:
    try:
        # If there is already an event loop, use it.
        loop = asyncio.get_event_loop()
    except RuntimeError:
        # If in a sub-thread, create a new event loop.
        logger.info("Creating a new event loop in a sub-thread.")
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    return loop


def locate_json_string_body_from_string(content: str) -> Union[str, None]:
    """Locate the JSON string body from a string"""
    maybe_json_str = re.search(r"{.*}", content, re.DOTALL)
    if maybe_json_str is not None:
        return maybe_json_str.group(0)
    else:
        return None


def convert_response_to_json(response: str) -> dict:
    json_str = locate_json_string_body_from_string(response)
    assert json_str is not None, f"Unable to parse JSON from response: {response}"
    try:
        data = json.loads(json_str)
        return data
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse JSON: {json_str}")
        raise e from None


def encode_string_by_tiktoken(content: str, model_name: str = "gpt-4o"):
    global ENCODER
    if ENCODER is None:
        ENCODER = tiktoken.encoding_for_model(model_name)
    tokens = ENCODER.encode(content)
    return tokens


def decode_tokens_by_tiktoken(tokens: list[int], model_name: str = "gpt-4o"):
    global ENCODER
    if ENCODER is None:
        ENCODER = tiktoken.encoding_for_model(model_name)
    content = ENCODER.decode(tokens)
    return content


def truncate_list_by_token_size(list_data: list, key: callable, max_token_size: int):
    """Truncate a list of data by token size"""
    if max_token_size <= 0:
        return []
    tokens = 0
    for i, data in enumerate(list_data):
        tokens += len(encode_string_by_tiktoken(key(data)))
        if tokens > max_token_size:
            return list_data[:i]
    return list_data


def compute_mdhash_id(content, prefix: str = ""):
    return prefix + md5(content.encode()).hexdigest()


def write_json(json_obj, file_name):
    with open(file_name, "w", encoding="utf-8") as f:
        json.dump(json_obj, f, indent=2, ensure_ascii=False)


def load_json(file_name):
    if not os.path.exists(file_name):
        return None
    with open(file_name, encoding="utf-8") as f:
        return json.load(f)


# it's dirty to type, so it's a good way to have fun
def pack_user_ass_to_openai_messages(*args: str):
    roles = ["user", "assistant"]
    return [
        {"role": roles[i % 2], "content": content} for i, content in enumerate(args)
    ]


def is_float_regex(value):
    return bool(re.match(r"^[-+]?[0-9]*\.?[0-9]+$", value))


def compute_args_hash(*args):
    return md5(str(args).encode()).hexdigest()


def split_string_by_multi_markers(content: str, markers: list[str]) -> list[str]:
    """Split a string by multiple markers"""
    if not markers:
        return [content]
    results = re.split("|".join(re.escape(marker) for marker in markers), content)
    return [r.strip() for r in results if r.strip()]


def enclose_string_with_quotes(content: Any) -> str:
    """Enclose a string with quotes"""
    if isinstance(content, numbers.Number):
        return str(content)
    content = str(content)
    content = content.strip().strip("'").strip('"')
    return f'"{content}"'


def list_of_list_to_csv(data: list[list]):
    return "\n".join(
        [
            ",\t".join([f"{enclose_string_with_quotes(data_dd)}" for data_dd in data_d])
            for data_d in data
        ]
    )


# -----------------------------------------------------------------------------------
# Refer the utils functions of the official GraphRAG implementation:
# https://github.com/microsoft/graphrag
def clean_str(input: Any) -> str:
    """Clean an input string by removing HTML escapes, control characters, and other unwanted characters."""
    # If we get non-string input, just give it back
    if not isinstance(input, str):
        return input

    result = html.unescape(input.strip())
    # https://stackoverflow.com/questions/4324790/removing-control-characters-from-a-string-in-python
    return re.sub(r"[\x00-\x1f\x7f-\x9f]", "", result)


# Utils types -----------------------------------------------------------------------
@dataclass
class EmbeddingFunc:
    embedding_dim: int
    max_token_size: int
    model_name: str
    func: callable

    async def __call__(self, *args, **kwargs) -> np.ndarray:
        # Had to fix this as the embedding function took only one named argument put it's passed in
        # positionally, now we need to pass both
        kwargs['model_name'] = self.model_name
        
        # If there are positional arguments, convert them to keyword arguments
        if args:
            # Assuming the first positional argument is always 'texts'
            if len(args) == 1 and isinstance(args[0], list):
                kwargs['texts'] = args[0]
            else:
                raise ValueError("Unexpected positional arguments. Expected a single list of texts")
        # Call the function with the updated keyword arguments
        return await self.func(**kwargs)        


# Decorators ------------------------------------------------------------------------
def limit_async_func_call(max_size: int, waitting_time: float = 0.0001):
    """Add restriction of maximum async calling times for a async func"""

    def final_decro(func):
        """Not using async.Semaphore to aovid use nest-asyncio"""
        __current_size = 0

        @wraps(func)
        async def wait_func(*args, **kwargs):
            nonlocal __current_size
            while __current_size >= max_size:
                await asyncio.sleep(waitting_time)
            __current_size += 1
            result = await func(*args, **kwargs)
            __current_size -= 1
            return result

        return wait_func

    return final_decro


def wrap_embedding_func_with_attrs(**kwargs):
    """Wrap a function with attributes"""

    def final_decro(func) -> EmbeddingFunc:
        new_func = EmbeddingFunc(**kwargs, func=func)
        return new_func

    return final_decro


def get_best_device():
    """
    Get the best available device
    Priority: CUDA > MPS (Mac) > CPU
    """
    if torch.cuda.is_available():
        return torch.device("cuda")
    elif hasattr(torch.backends, 'mps') and torch.backends.mps.is_available():
        return torch.device("mps")
    else:
        return torch.device("cpu")


def get_imagebind_device():
    """
    Get the best device for ImageBind models
    ImageBind uses Conv3D which is not supported on MPS, so fall back to CPU on Mac
    Priority: CUDA > CPU (MPS not supported)
    """
    if torch.cuda.is_available():
        return torch.device("cuda")
    else:
        # Force CPU even if MPS is available because ImageBind uses Conv3D
        return torch.device("cpu")


class SerializableEmbeddingWrapper:
    """
    Serializable embedding function wrapper
    Solve pickle issues in multiprocessing
    """
    def __init__(self, embedding_func, global_config):
        self.embedding_func = embedding_func
        self.global_config = global_config
        
        # Copy attributes from EmbeddingFunc if available
        if hasattr(embedding_func, 'embedding_dim'):
            self.embedding_dim = embedding_func.embedding_dim
        if hasattr(embedding_func, 'max_token_size'):
            self.max_token_size = embedding_func.max_token_size
        if hasattr(embedding_func, 'model_name'):
            self.model_name = embedding_func.model_name
    
    async def __call__(self, *args, **kwargs):
        # Automatically add global_config
        kwargs['global_config'] = self.global_config
        return await self.embedding_func(*args, **kwargs)


class SerializableLLMWrapper:
    """
    Serializable LLM function wrapper
    Solve pickle issues in multiprocessing
    """
    def __init__(self, llm_func, global_config, hashing_kv=None):
        self.llm_func = llm_func
        self.global_config = global_config
        self.hashing_kv = hashing_kv
    
    async def __call__(self, *args, **kwargs):
        # Automatically add global_config and hashing_kv
        kwargs['global_config'] = self.global_config
        if self.hashing_kv is not None:
            kwargs['hashing_kv'] = self.hashing_kv
        return await self.llm_func(*args, **kwargs)

```

### Core Architecture Module: `Vimo-desktop/python_backend/videorag/_videoutil/__init__.py`
```
from .split import split_video, saving_video_segments
from .asr import speech_to_text
from .caption import segment_caption, merge_segment_information, retrieved_segment_caption_async
from .feature import encode_video_segments, encode_string_query
```

### Core Architecture Module: `Vimo-desktop/python_backend/videorag/_videoutil/asr.py`
```
import os
import asyncio
from tqdm import tqdm
import dashscope
from dashscope.audio.asr import Recognition
from .._utils import logger

async def process_single_segment(semaphore, index, segment_name, audio_file, model, audio_output_format, sample_rate):
    """
    Process a single audio segment with ASR
    """
    async with semaphore:  # Limit concurrent requests
        try:
            logger.info(f"Processing segment {segment_name} with model {model}")
            # Create recognition instance
            recognition = Recognition(
                model=model,
                format=audio_output_format,
                sample_rate=sample_rate,
                language_hints=['zh', 'en', 'ja'],
                callback=None  # type: ignore  # SDK type annotation issue
            )
            
            # Call the API - Note: this might need to be wrapped in asyncio.to_thread for sync API
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(None, recognition.call, audio_file)
            
            # logger.info(f"ASR result: {result}")
            # Extract text from result
            if result and "output" in result and "sentence" in result["output"]:
                sentences = result["output"]["sentence"]
                asr_result = ""
                for sentence in sentences:
                    asr_result += sentence.get('text', '') + "\n"
                return index, asr_result.strip()
            else:
                logger.warning(f"No transcription result for segment {segment_name}")
                return index, ""
                
        except Exception as e:
            logger.error(f"ASR failed for segment {segment_name}: {str(e)}")
            raise e

async def speech_to_text_online(video_name, working_dir, segment_index2name, audio_output_format, global_config, max_concurrent=5):
    """
    Online ASR using Alibaba Cloud DashScope API with async concurrent processing
    """
    # Get API key and sample rate from global config
    api_key = global_config.get('ali_dashscope_api_key')
    sample_rate = global_config.get('audio_sample_rate', 16000)
    
    # Set the API key
    dashscope.api_key = api_key
    
    cache_path = os.path.join(working_dir, '_cache', video_name)
    
    # Create semaphore to limit concurrent requests
    semaphore = asyncio.Semaphore(max_concurrent)
    
    # Create tasks for all segments
    tasks = []
    for index in segment_index2name:
        segment_name = segment_index2name[index]
        audio_file = os.path.join(cache_path, f"{segment_name}.{audio_output_format}")
        
        task = process_single_segment(
            semaphore, index, segment_name, audio_file, 
            global_config.get('asr_model'), audio_output_format, sample_rate
        )
        tasks.append(task)
    
    # Execute all tasks concurrently with real-time progress
    total_tasks = len(tasks)
    logger.info(f"🎤 Starting ASR for {total_tasks} audio segments (max {max_concurrent} concurrent)...")
    
    transcripts = {}
    completed = 0
    
    # Use asyncio.as_completed for real-time progress updates
    for completed_task in asyncio.as_completed(tasks):
        try:
            result = await completed_task
            if isinstance(result, tuple) and len(result) == 2:
                index, text = result
                transcripts[index] = text
                completed += 1
                logger.info(f"✅ Completed {completed}/{total_tasks} segments (Progress: {completed/total_tasks*100:.1f}%)")
            else:
                # Handle unexpected result format
                completed += 1
                logger.info(f"⚠️  Unexpected result format for segment {completed}")
                
        except Exception as e:
            completed += 1
            logger.error(f"❌ Task failed: {e}")
            logger.info(f"❌ Failed {completed}/{total_tasks} segments (Progress: {completed/total_tasks*100:.1f}%)")
    
    logger.info(f"🎉 ASR processing completed! Processed {len(transcripts)} segments successfully.")
    
    return transcripts


async def speech_to_text_async(video_name, working_dir, segment_index2name, audio_output_format, global_config):
    """
    Async speech-to-text function using Alibaba Cloud DashScope online ASR
    
    Args:
        video_name: Name of the video
        working_dir: Working directory
        segment_index2name: Mapping of segment indices to names
        audio_output_format: Audio file format
        global_config: Global configuration dictionary containing API keys and settings
    """
    api_key = global_config.get('ali_dashscope_api_key')
    
    if not api_key:
        raise ValueError("ali_dashscope_api_key must be provided in global_config for online ASR")
    
    return await speech_to_text_online(
        video_name, working_dir, segment_index2name, audio_output_format, global_config
    )

def speech_to_text(video_name, working_dir, segment_index2name, audio_output_format, global_config):
    """
    Synchronous wrapper for async speech-to-text function
    
    Args:
        video_name: Name of the video
        working_dir: Working directory
        segment_index2name: Mapping of segment indices to names
        audio_output_format: Audio file format
        global_config: Global configuration dictionary containing API keys and settings
    """
    # Run the async function in an event loop
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    
    return loop.run_until_complete(
        speech_to_text_async(video_name, working_dir, segment_index2name, audio_output_format, global_config)
    )
```

### Core Architecture Module: `Vimo-desktop/python_backend/videorag/_videoutil/caption.py`
```
import os
import asyncio
import torch
import numpy as np
from PIL import Image
from tqdm import tqdm
from moviepy.video.io.VideoFileClip import VideoFileClip
from io import BytesIO
import base64
from openai import OpenAI, AsyncOpenAI
from .._utils import logger

def encode_pil_image(pil_image):
    buffer = BytesIO()
    pil_image.save(buffer, format='JPEG')
    buffer.seek(0)
    return base64.b64encode(buffer.read()).decode("utf-8")

def encode_video(video, frame_times):
    frames = []
    for t in frame_times:
        frames.append(video.get_frame(t))
    frames = np.stack(frames, axis=0)
    frames = [Image.fromarray(v.astype('uint8')).resize((1280, 720)) for v in frames]
    base64_images = []
    for frame in frames:
        base64_image = encode_pil_image(frame)
        base64_images.append(base64_image)
    return base64_images

async def _process_single_caption(caption_model_func, index, video_frames, segment_transcript, global_config):
    """Process a single video segment caption using LLM config's caption model function"""
    try:
        content = []
        query = f"The transcript of the current video:\n{segment_transcript}.\nNow provide a description (caption) of the video in English."
        for frame in video_frames:
            content.append({"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{frame}"}})
        content.append({"type": "text", "text": query})
        
        segment_caption = await caption_model_func(content, global_config=global_config)
        result = segment_caption.replace("\n", "").replace("<|endoftext|>", "") if segment_caption else ""
        return index, result
    except Exception as e:
        logger.info(f"❌ Caption failed for segment {index}: {str(e)}")
        return index, ""

async def segment_caption_async(video_name, video_path, segment_index2name, transcripts, segment_times_info, global_config):
    """Async caption generation with concurrent processing"""
    caption_model_func = global_config["llm"]["caption_model_func"]
    
    logger.info(f"🎬 Extracting frames for {len(segment_index2name)} segments...")
    with VideoFileClip(video_path) as video:
        segment_data = {
            index: {
                'frames': encode_video(video, segment_times_info[index]["frame_times"]),
                'transcript': transcripts[index]
            }
            for index in segment_index2name
        }
    
    logger.info(f"🎨 Starting caption generation for {len(segment_index2name)} segments...")
    
    # Use asyncio.gather() - concurrent control is handled by limit_async_func_call wrapper
    results = await asyncio.gather(
        *[_process_single_caption(caption_model_func, index, 
                                 segment_data[index]['frames'], 
                                 segment_data[index]['transcript'], 
                                 global_config) 
          for index in segment_index2name]
    )
    
    caption_result = {index: caption for index, caption in results}
    logger.info(f"🎉 Caption generation completed! Generated {len(caption_result)} captions successfully.")
    return caption_result

def segment_caption(video_name, video_path, segment_index2name, transcripts, segment_times_info, caption_result, global_config):
    """Worker function for multiprocessing"""
    try:
        result = asyncio.run(
            segment_caption_async(video_name, video_path, segment_index2name, transcripts, segment_times_info, global_config)
        )
        for index, caption in result.items():
            caption_result[index] = caption
    except Exception as e:
        logger.error(f"Error in segment_caption:\n {str(e)}")
        raise RuntimeError

def merge_segment_information(segment_index2name, segment_times_info, transcripts, captions):
    inserting_segments = {}
    for index in segment_index2name:
        inserting_segments[index] = {"content": None, "time": None}
        segment_name = segment_index2name[index]
        inserting_segments[index]["time"] = '-'.join(segment_name.split('-')[-2:])
        inserting_segments[index]["content"] = f"Caption:\n{captions[index]}\nTranscript:\n{transcripts[index]}\n\n"
        inserting_segments[index]["transcript"] = transcripts[index]
        inserting_segments[index]["frame_times"] = segment_times_info[index]["frame_times"].tolist()
    return inserting_segments

async def _process_retrieved_segment_caption(caption_model_func, this_segment, refine_knowledge, video_path_db, video_segments, num_sampled_frames, global_config):
    """Process a single retrieved segment caption using LLM config's caption model function"""
    video_name = '_'.join(this_segment.split('_')[:-1])
    index = this_segment.split('_')[-1]
    segment_transcript = video_segments._data[video_name][index]["transcript"]
    
    try:
        video_path = video_path_db._data[video_name]
        timestamp = video_segments._data[video_name][index]["time"].split('-')
        start, end = eval(timestamp[0]), eval(timestamp[1])
        
        with VideoFileClip(video_path) as video:
            frame_times = np.linspace(start, end, num_sampled_frames, endpoint=False)
            video_frames = encode_video(video, frame_times)
        
        query = f"The transcript of the current video:\n{segment_transcript}.\nNow provide a very detailed description (caption) of the video in English and extract relevant information about: {refine_knowledge}'"
        
        content = []
        for frame in video_frames:
            content.append({"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{frame}"}})
        content.append({"type": "text", "text": query})
        
        segment_caption = await caption_model_func(content, global_config=global_config)
        this_caption = segment_caption.replace("\n", "").replace("<|endoftext|>", "") if segment_caption else ""
        
        result = f"Caption:\n{this_caption}\nTranscript:\n{segment_transcript}\n\n"
        return this_segment, result
        
    except Exception as e:
        logger.info(f"❌ Retrieved caption failed for segment {this_segment}: {str(e)}")
        return this_segment, f"Caption:\nError generating caption\nTranscript:\n{segment_transcript}\n\n"

async def retrieved_segment_caption_async(refine_knowledge, retrieved_segments, video_path_db, video_segments, num_sampled_frames, global_config):
    """Async retrieved segment caption generation"""
    caption_model_func = global_config["llm"]["caption_model_func"]
    
    logger.info(f"🔍 Starting detailed caption for {len(retrieved_segments)} retrieved segments...")
    
    # Use asyncio.gather() - concurrent control is handled by limit_async_func_call wrapper
    results = await asyncio.gather(
        *[_process_retrieved_segment_caption(caption_model_func, this_segment, refine_knowledge,
                                           video_path_db, video_segments, num_sampled_frames, global_config) 
          for this_segment in retrieved_segments]
    )
    
    caption_result = {segment_id: caption for segment_id, caption in results}
    logger.info(f"🎉 Retrieved caption generation completed! Generated {len(caption_result)} captions successfully.")
    return caption_result

```

### Core Architecture Module: `Vimo-desktop/python_backend/videorag/_videoutil/feature.py`
```
import os
import torch
import pickle
from tqdm import tqdm
from imagebind import data
from imagebind.models import imagebind_model
from imagebind.models.imagebind_model import ImageBindModel, ModalityType


def encode_video_segments(video_paths, embedder: ImageBindModel):
    device = next(embedder.parameters()).device
    inputs = {
        ModalityType.VISION: data.load_and_transform_video_data(video_paths, device),
    }
    with torch.no_grad():
        embeddings = embedder(inputs)[ModalityType.VISION]
    if isinstance(embeddings, torch.Tensor):
        embeddings = embeddings.cpu()
    return embeddings

def encode_string_query(query:str, embedder: ImageBindModel):
    device = next(embedder.parameters()).device
    inputs = {
        ModalityType.TEXT: data.load_and_transform_text([query], device),
    }
    with torch.no_grad():
        embeddings = embedder(inputs)[ModalityType.TEXT]
    if isinstance(embeddings, torch.Tensor):
        embeddings = embeddings.cpu()
    return embeddings
```

### Core Architecture Module: `Vimo-desktop/python_backend/videorag/_videoutil/split.py`
```
import os
import time
import shutil
import numpy as np
from tqdm import tqdm
from moviepy.video import fx as vfx
from moviepy.video.io.VideoFileClip import VideoFileClip
from .._utils import logger

def split_video(
    video_path,
    working_dir,
    segment_length,
    num_frames_per_segment,
    audio_output_format='mp3',
    audio_sample_rate=16000,  # Default 16kHz for speech recognition
):  
    unique_timestamp = str(int(time.time() * 1000))
    video_name = os.path.basename(video_path).split('.')[0]
    video_segment_cache_path = os.path.join(working_dir, '_cache', video_name)
    if os.path.exists(video_segment_cache_path):
        shutil.rmtree(video_segment_cache_path)
    os.makedirs(video_segment_cache_path, exist_ok=False)
    
    segment_index = 0
    segment_index2name, segment_times_info = {}, {}
    with VideoFileClip(video_path) as video:
    
        total_video_length = int(video.duration)
        start_times = list(range(0, total_video_length, segment_length))
        # if the last segment is shorter than 5 seconds, we merged it to the last segment
        if len(start_times) > 1 and (total_video_length - start_times[-1]) < 5:
            start_times = start_times[:-1]
        
        for start in tqdm(start_times, desc=f"Spliting Video {video_name}"):
            if start != start_times[-1]:
                end = min(start + segment_length, total_video_length)
            else:
                end = total_video_length
            
            subvideo = video.subclip(start, end)
            subvideo_length = subvideo.duration
            frame_times = np.linspace(0, subvideo_length, num_frames_per_segment, endpoint=False)
            frame_times += start
            
            segment_index2name[f"{segment_index}"] = f"{unique_timestamp}-{segment_index}-{start}-{end}"
            segment_times_info[f"{segment_index}"] = {"frame_times": frame_times, "timestamp": (start, end)}
            
            # save audio
            audio_file_base_name = segment_index2name[f"{segment_index}"]
            audio_file = f'{audio_file_base_name}.{audio_output_format}'
            subaudio = subvideo.audio
            # Convert to mono and set sample rate using ffmpeg parameters
            subaudio.write_audiofile(
                os.path.join(video_segment_cache_path, audio_file), 
                codec='mp3',
                fps=audio_sample_rate,  # Set sample rate
                ffmpeg_params=['-ac', '1'],  # Force mono (1 audio channel)
                verbose=False, 
                logger=None
            )
            
            segment_index += 1

    return segment_index2name, segment_times_info

def saving_video_segments(
    video_name,
    video_path,
    working_dir,
    segment_index2name,
    segment_times_info,
    video_output_format='mp4',
):
    try:
        with VideoFileClip(video_path) as video:
            video_segment_cache_path = os.path.join(working_dir, '_cache', video_name)
            for index in tqdm(segment_index2name, desc=f"Saving Video Segments {video_name}"):
                start, end = segment_times_info[index]["timestamp"][0], segment_times_info[index]["timestamp"][1]
                video_file = f'{segment_index2name[index]}.{video_output_format}'
                subvideo = video.subclip(start, end)
                subvideo.write_videofile(os.path.join(video_segment_cache_path, video_file), codec='libx264', verbose=False, logger=None)
    except Exception as e:
        logger.error(f"Error in saving_video_segments:\n {str(e)}")
        raise RuntimeError
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #41** (2026-05-25): **docs: fix README parameters typos**
  *Symptoms*: ## Summary - fix two `paramters` typos in the VideoRAG algorithm README  ## Validation - `git diff --check` - `! grep -R "paramters" -n VideoRAG-algorithm/README.md`  Category: docs typo Confidence: 85/100

- **Issue #40** (2026-05-25): **docs: fix README parameters typos**
  *Symptoms*: ## Summary - fix two `paramters` typos in the VideoRAG algorithm README  ## Validation - `git diff --check`  Confidence: 85/100 (docs/typo)

- **Issue #38** (2026-04-04): **Graph traversal summarization**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > Jk

- **Issue #34** (2026-01-11): **Fix GPU crash on Linux (#30)**
  *Symptoms*: Hey! This fixes the GPU crash issue reported in #30. The app was failing to start on Linux with the error: `viz_main_impl.cc(185): Exiting GPU process due to errors during initialization` This is a common Electron issue on systems where the GPU drivers don't play nice. The fix is simple, I just added **app.disableHardwareAcceleration()** in main.ts before the app starts. Also cleaned up a small **CSP typo** in index.html (URLs shouldn't be quoted) and added the **missing name/version fields** to package.json while I was in there. Should work fine now on Linux and other systems that were having GPU trouble! 👍
  **Post-Mortem & Fix Analysis**:
  > lgtm

- **Issue #31** (2025-10-09): **Refactoring for Whizzhive**
  *Symptoms*: 

- **Issue #27** (2025-09-02): **和英伟达的VSS解决方案很相似**
  *Symptoms*: https://github.com/NVIDIA-AI-Blueprints/video-search-and-summarization
  **Post-Mortem & Fix Analysis**:
  > 嗨👋！  感谢您对VideoRAG的关注！非常感谢您的分享，VideoRAG的开源时间比VSS略早一点，二者应该算是同期的工作，欢迎大家取长补短。  <img width="915" height="565" alt="Image" src="https://github.com/user-attachments/assets/a949c970-2ef2-4826-b032-30eef20786e4" />  Best regards， Xubin

- **Issue #26** (2025-07-30): **feat:add deepseek and bge support**
  *Symptoms*: ### 功能描述 我为VideoRAG库添加了对DeepSeek LLM模型和BAAI/bge-m3嵌入模型的支持，扩展了原本仅支持OpenAI接口的限制。  ### 新增功能 1. **DeepSeek LLM支持**    - 添加了`deepseek_complete_if_cache()`和`deepseek_complete()`函数    - 支持通过DeepSeek API (https://api.deepseek.com/v1) 调用`deepseek-chat`模型    - 包含重试机制和缓存功能  2. **BAAI/bge-m3嵌入模型支持**    - 添加了`bge_m3_embedding()`函数    - 支持通过硅基流动API (https://api.siliconflow.cn/v1/embeddings) 调用BAAI/bge-m3模型    - 使用1024维向量嵌入，提供更好的语义理解能力  3. **新的配置选项**    - 新增`deepseek_bge_config`配置对象    - 集成了DeepSeek LLM和BAAI/bge-m3嵌入模型的完整配置    - 保持了与现有配置结构的一致性  ### 技术实现 - 使用`httpx`库进行异步API调用 - 实现了与现有OpenAI接口相同的重试和缓存机制 - 保持了原有的`LLMConfig`数据结构兼容性 - 添加了环境变量支持：`DEEPSEEK_API_KEY`和`SILICONFLOW_API_KEY`  ### 使用示例 ```python from videorag._llm import deepseek_bge_config from videorag import VideoRAG  # 设置API密钥 os.environ["DEEPSEEK_API_KEY"] = "your-deepseek-api-key" os.environ["SILICONFLOW_API_KEY"] = "your-siliconflow-api-key"  # 使用新配置初始化VideoRAG videorag = VideoRAG(llm=deepseek_bge_config, working_dir="./videorag-workdir") ```  ### 优势 - **成本效益**：DeepSeek和硅基流动的API价格更具竞争力 - **性能提升**：BAAI/bge-m3模型在中文语义理解方面表现优异 - **灵活性**：用户可以根据需求选择不同的模型组合 - **向后兼容**：不影响现有的OpenAI配置使用  ### 依赖要求 - 新增`httpx`库依赖用于API调用  这个功能扩展让VideoRAG库能够支持更多样化的模型选择，为用户提供了更大的灵活性，特别是在中文视频内容处理方面。
  **Post-Mortem & Fix Analysis**:
  > Thanks for your contribution!

- **Issue #25** (2025-07-30): **feat: add DeepSeek and BGE model support**
  *Symptoms*: ### 功能描述 我为VideoRAG库添加了对DeepSeek LLM模型和BAAI/bge-m3嵌入模型的支持，扩展了原本仅支持OpenAI接口的限制。  ### 新增功能 1. **DeepSeek LLM支持**    - 添加了`deepseek_complete_if_cache()`和`deepseek_complete()`函数    - 支持通过DeepSeek API (https://api.deepseek.com/v1) 调用`deepseek-chat`模型    - 包含重试机制和缓存功能  2. **BAAI/bge-m3嵌入模型支持**    - 添加了`bge_m3_embedding()`函数    - 支持通过硅基流动API (https://api.siliconflow.cn/v1/embeddings) 调用BAAI/bge-m3模型    - 使用1024维向量嵌入，提供更好的语义理解能力  3. **新的配置选项**    - 新增`deepseek_bge_config`配置对象    - 集成了DeepSeek LLM和BAAI/bge-m3嵌入模型的完整配置    - 保持了与现有配置结构的一致性  ### 技术实现 - 使用`httpx`库进行异步API调用 - 实现了与现有OpenAI接口相同的重试和缓存机制 - 保持了原有的`LLMConfig`数据结构兼容性 - 添加了环境变量支持：`DEEPSEEK_API_KEY`和`SILICONFLOW_API_KEY`  ### 使用示例 ```python from videorag._llm import deepseek_bge_config from videorag import VideoRAG  # 设置API密钥 os.environ["DEEPSEEK_API_KEY"] = "your-deepseek-api-key" os.environ["SILICONFLOW_API_KEY"] = "your-siliconflow-api-key"  # 使用新配置初始化VideoRAG videorag = VideoRAG(llm=deepseek_bge_config, working_dir="./videorag-workdir") ```  ### 优势 - **成本效益**：DeepSeek和硅基流动的API价格更具竞争力 - **性能提升**：BAAI/bge-m3模型在中文语义理解方面表现优异 - **灵活性**：用户可以根据需求选择不同的模型组合 - **向后兼容**：不影响现有的OpenAI配置使用  ### 依赖要求 - 新增`httpx`库依赖用于API调用  这个功能扩展让VideoRAG库能够支持更多样化的模型选择，为用户提供了更大的灵活性，特别是在中文视频内容处理方面。

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

### Incident Patch 1: `9e0d1aec` (2026-01-08)
**Commit Message**: fix: GPU process crash and minor improvements (#30)

- Disable hardware acceleration to fix GPU initialization errors on Linux

- Fix CSP syntax (URLs should not be quoted)

- Add missing name/version/description to package.json

**File**: `Vimo-desktop/package.json` (modified, +3/-0)
```diff
@@ -1,4 +1,7 @@
 {
+  "name": "vimo-desktop",
+  "version": "0.1.0",
+  "description": "Vimo Desktop - Chat with Your Videos using VideoRAG",
   "main": "./dist/main/main.js",
   "packageManager": "pnpm@9.10.0",
   "scripts": {
```

**File**: `Vimo-desktop/src/main/main.ts` (modified, +34/-31)
```diff
@@ -8,6 +8,9 @@ import { registerFileHandlers } from './handlers/file-handlers';
 import { registerSettingsHandlers } from './handlers/settings';
 import { registerChatSessionHandlers } from './handlers/chat-session-handlers';
 
+// Fix for GPU process crash on Linux and some other systems
+// See: https://github.com/electron/electron/issues/13936
+app.disableHardwareAcceleration();
 
 // Create window when app is ready
 app.whenReady().then(() => {
@@ -55,16 +58,16 @@ function registerModelHandlers(): void {
   ipcMain.handle('check-model-files', async (_, storeDirectory: string) => {
     try {
       const { access } = require('fs/promises');
-      
+
       const imagebindPath = join(storeDirectory, 'imagebind_huge', 'imagebind_huge.pth');
-      
+
       let imagebind = false;
-      
+
       try {
         await access(imagebindPath);
         imagebind = true;
-      } catch {}
-      
+      } catch { }
+
       return { imagebind };
     } catch (error) {
       return { imagebind: false };
@@ -77,35 +80,35 @@ function registerModelHandlers(): void {
       const https = require('https');
       const { createWriteStream, mkdirSync, existsSync } = require('fs');
       const { access } = require('fs/promises');
-      
+
       // Create directory if it doesn't exist
       if (!existsSync(storeDirectory)) {
         mkdirSync(storeDirectory, { recursive: true });
       }
-      
+
       // Create imagebind_huge directory
       const imagebindDir = join(storeDirectory, 'imagebind_huge');
       if (!existsSync(imagebindDir)) {
         mkdirSync(imagebindDir, { recursive: true });
       }
-      
+
       const imagebindPath = join(imagebindDir, 'imagebind_huge.pth');
-      
+
       // Check if file already exists
       try {
         await access(imagebindPath);
         return { success: true, message: 'ImageBind model already exists' };
       } catch {
         // File doesn't exist, proceed with download
       }
-      
+
       const url = 'https://dl.fbaipublicfiles.com/imagebind/imagebind_huge.pth';
-    
-    return new Promise((resolve) => {
+
+      return new Promise((resolve) => {
         const file = createWriteStream(imagebindPath);
         let downloadedBytes = 0;
         let totalBytes = 0;
-        
+
         const request = https.get(url, (response) => {
           if (response.statusCode !== 200) {
             // Delete the entire imagebind_huge directory on HTTP error
@@ -118,30 +121,30 @@ function registerModelHandlers(): void {
             resolve({ success: false, error: `HTTP ${response.statusCode}: ${response.statusMessage}` });
             return;
           }
-          
+
           totalBytes = parseInt(response.headers['content-length'] || '0', 10);
-          
+
           response.on('data', (chunk) => {
             downloadedBytes += chunk.length;
             if (totalBytes > 0) {
               const progress = Math.round((downloadedBytes / totalBytes) * 100);
-          event.sender.send('download-progress', { 
-            type: 'imagebind', 
+              event.sender.send('download-progress', {
+                type: 'imagebind',
                 progress,
                 downloaded: downloadedBytes,
                 total: totalBytes
               });
             }
-        });
-        
-        response.pipe(file);
-        
-        file.on('finish', () => {
-          file.close();
+          });
+
+          response.pipe(file);
+
+          file.on('finish', () => {
+            file.close();
             resolve({ success: true, message: 'ImageBind download completed' });
-        });
-        
-        file.on('error', (err) => {
+          });
+
+          file.on('error', (err) => {
             file.close();
             // Delete the entire imagebind_huge directory on error
             const { rmSync } = require('fs');
@@ -150,10 +153,10 @@ function registerModelHandlers(): void {
             } catch (cleanupError) {
               console.error('Failed to cleanup imagebind directory:', cleanupError);
             }
-        resolve({ success: false, error: err.message });
-      });
+            resolve({ success: false, error: err.message });
+          });
         });
-        
+
         request.on('error', (err) => {
           // Delete the entire imagebind_huge directory on error
           const { rmSync } = require('fs');
@@ -164,7 +167,7 @@ function registerModelHandlers(): void {
           }
           resolve({ success: false, error: err.message });
         });
-        
+
         request.setTimeout(300000, () => { // 5 minute timeout
           request.destroy();
           // Delete the entire imagebind_huge directory on timeout
@@ -177,7 +180,7 @@ function registerModelHandlers(): void {
           resolve({ success: false, error: 'Download timeout' });
         });
       });
-      
+
     } catch (error) {
       const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

```

**File**: `Vimo-desktop/src/renderer/index.html` (modified, +1/-1)
```diff
@@ -5,7 +5,7 @@
     <title>VideoRAG</title>
     <meta
       http-equiv="Content-Security-Policy"
-      content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' 'https://fonts.googleapis.com'; font-src 'self' 'https://fonts.gstatic.com';"
+      content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com;"
     />
     <link rel="preconnect" href="https://fonts.googleapis.com">
     <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
```

---

### Incident Patch 2: `d051a85e` (2025-11-22)
**Commit Message**: fix use_cache in vimo

**File**: `Vimo-desktop/python_backend/videorag/_llm.py` (modified, +5/-2)
```diff
@@ -100,6 +100,8 @@ async def openai_complete_if_cache(
 ) -> str:
     openai_async_client = get_openai_async_client_instance(kwargs["global_config"])
     hashing_kv: BaseKVStorage = kwargs.pop("hashing_kv", None)
+    use_cache = kwargs.pop("use_cache", True)
+
     # Remove global_config from kwargs as it's not needed for OpenAI API call
     kwargs.pop("global_config", None)
     
@@ -108,7 +110,8 @@ async def openai_complete_if_cache(
         messages.append({"role": "system", "content": system_prompt})
     messages.extend(history_messages)
     messages.append({"role": "user", "content": prompt})
-    if hashing_kv is not None:
+
+    if hashing_kv is not None and use_cache:
         args_hash = compute_args_hash(model, messages)
         if_cache_return = await hashing_kv.get_by_id(args_hash)
         # NOTE: I update here to avoid the if_cache_return["return"] is None
@@ -119,7 +122,7 @@ async def openai_complete_if_cache(
         model=model, messages=messages, **kwargs
     )
 
-    if hashing_kv is not None:
+    if hashing_kv is not None and use_cache:
         await hashing_kv.upsert(
             {args_hash: {"return": response.choices[0].message.content, "model": model}}
         )
```

---

### Incident Patch 3: `d9ce1cc7` (2025-11-19)
**Commit Message**: fix use_cache

**File**: `VideoRAG-algorithm/videorag/_op.py` (modified, +2/-2)
```diff
@@ -909,7 +909,7 @@ async def _filter_single_segment(knowledge: str, segment_key_dp: tuple[str, str]
     response = await use_model_func(
         query,
         system_prompt=sys_prompt,
-        use_cache=False,
+        # use_cache=False,
     )
     while True:
         try:
@@ -921,6 +921,6 @@ async def _filter_single_segment(knowledge: str, segment_key_dp: tuple[str, str]
             response = await use_model_func(
                 query,
                 system_prompt=sys_prompt,
-                use_cache=False,
+                # use_cache=False,
             )
     
\ No newline at end of file
```

---

### Incident Patch 4: `2d94a37e` (2025-03-27)
**Commit Message**: update async bug again

**File**: `videorag/videorag.py` (modified, +1/-1)
```diff
@@ -194,7 +194,7 @@ def __post_init__(self):
         self.llm.best_model_func = limit_async_func_call(self.llm.best_model_max_async)(
             partial(self.llm.best_model_func, hashing_kv=self.llm_response_cache)
         )
-        self.llm.best_model_func = limit_async_func_call(self.llm.cheap_model_max_async)(
+        self.llm.cheap_model_func = limit_async_func_call(self.llm.cheap_model_max_async)(
             partial(self.llm.cheap_model_func, hashing_kv=self.llm_response_cache)
         )
 
```

---

### Incident Patch 5: `d82858c3` (2025-03-26)
**Commit Message**: update async bug

**File**: `videorag/videorag.py` (modified, +2/-2)
```diff
@@ -191,10 +191,10 @@ def __post_init__(self):
             )
         )
         
-        self.best_model_func = limit_async_func_call(self.llm.best_model_max_async)(
+        self.llm.best_model_func = limit_async_func_call(self.llm.best_model_max_async)(
             partial(self.llm.best_model_func, hashing_kv=self.llm_response_cache)
         )
-        self.cheap_model_func = limit_async_func_call(self.llm.cheap_model_max_async)(
+        self.llm.best_model_func = limit_async_func_call(self.llm.cheap_model_max_async)(
             partial(self.llm.cheap_model_func, hashing_kv=self.llm_response_cache)
         )
 
```

---

### Incident Patch 6: `d9f4897d` (2025-02-25)
**Commit Message**: fix retry position

**File**: `videorag/_llm.py` (modified, +5/-6)
```diff
@@ -40,12 +40,6 @@ def get_ollama_async_client_instance():
         global_ollama_client = AsyncClient()  # Adjust base URL if necessary        
     return global_ollama_client
 
-@retry(
-    stop=stop_after_attempt(5),
-    wait=wait_exponential(multiplier=1, min=4, max=10),
-    retry=retry_if_exception_type((RateLimitError, APIConnectionError)),
-)
-
 # Setup LLM Configuration.
 @dataclass
 class LLMConfig:
@@ -89,6 +83,11 @@ def __post_init__(self):
         )
 
 ##### OpenAI Configuration
+@retry(
+    stop=stop_after_attempt(5),
+    wait=wait_exponential(multiplier=1, min=4, max=10),
+    retry=retry_if_exception_type((RateLimitError, APIConnectionError)),
+)
 async def openai_complete_if_cache(
     model, prompt, system_prompt=None, history_messages=[], **kwargs
 ) -> str:
```

---

### Incident Patch 7: `2f2678db` (2025-02-23)
**Commit Message**: Remove debugging print statement

**File**: `videorag/_op.py` (modified, +0/-1)
```diff
@@ -414,7 +414,6 @@ async def _process_single_content(chunk_key_dp: tuple[str, TextChunkSchema]):
             if record is None:
                 continue
             record = record.group(1)
-            print(record)            
             record_attributes = split_string_by_multi_markers(
                 record, [context_base["tuple_delimiter"]]
             )
```

---

### Incident Patch 8: `7f2989c4` (2025-02-19)
**Commit Message**: Fix analyzing vidoes. Changes should be all done

**File**: `longervideos/videorag_experiment.py` (modified, +1/-2)
```diff
@@ -38,8 +38,7 @@
     with open(f'longervideos/dataset.json', 'r') as f:
         longervideos = json.load(f)
     
-    #videorag = VideoRAG(cheap_model_func=gpt_4o_mini_complete, best_model_func=gpt_4o_mini_complete, working_dir=f"./videorag-workdir/{sub_category}")
-    videorag = VideoRAG(cheap_model_func=ollama_mini_complete, best_model_func=ollama_complete, working_dir=f"./videorag-workdir/{sub_category}")        
+    videorag = VideoRAG(llm=ollama_config, working_dir=f"./videorag-workdir/{sub_category}")        
     videorag.load_caption_model(debug=False)
     
     answer_folder = f'./videorag-answers/{sub_category}'
```

**File**: `videorag/_op.py` (modified, +3/-3)
```diff
@@ -183,8 +183,8 @@ async def _handle_entity_relation_summary(
     description: str,
     global_config: dict,
 ) -> str:
-    use_llm_func: callable = global_config["cheap_model_func"]
-    llm_max_tokens = global_config["cheap_model_max_token_size"]
+    use_llm_func: callable = global_config["llm"]["cheap_model_func"]
+    llm_max_tokens = global_config["llm"]["cheap_model_max_token_size"]
     tiktoken_model_name = global_config["tiktoken_model_name"]
     summary_max_tokens = global_config["entity_summary_to_max_tokens"]
 
@@ -359,7 +359,7 @@ async def extract_entities(
     entity_vdb: BaseVectorStorage,
     global_config: dict,
 ) -> Union[BaseGraphStorage, None]:
-    use_llm_func: callable = global_config["best_model_func"]
+    use_llm_func: callable = global_config["llm"]["best_model_func"]
     entity_extract_max_gleaning = global_config["entity_extract_max_gleaning"]
     
     ordered_chunks = list(chunks.items())
```

---

### Incident Patch 9: `a712ce52` (2025-02-18)
**Commit Message**: Fixed issues due to refactoring of configuration.
Q&A works, still need to test building

**File**: `longervideos/videorag_experiment.py` (modified, +2/-3)
```diff
@@ -21,7 +21,7 @@
 os.environ["CUDA_VISIBLE_DEVICES"] = args.cuda
 os.environ["OPENAI_API_KEY"] = ""
 
-from videorag._llm import *
+from videorag._llm import openai_config, azure_openai_config, ollama_config
 from videorag.videorag import VideoRAG, QueryParam
 
 if __name__ == '__main__':
@@ -31,8 +31,7 @@
     video_base_path = f'longervideos/{sub_category}/videos/'
     video_files = sorted(os.listdir(video_base_path))
     video_paths = [os.path.join(video_base_path, f) for f in video_files]
-    #videorag = VideoRAG(cheap_model_func=gpt_4o_mini_complete, best_model_func=gpt_4o_mini_complete, working_dir=f"./videorag-workdir/{sub_category}")
-    videorag = VideoRAG(cheap_model_func=ollama_mini_complete, best_model_func=ollama_complete, working_dir=f"./videorag-workdir/{sub_category}")    
+    videorag = VideoRAG(llm=ollama_config, working_dir=f"./videorag-workdir/{sub_category}")    
     videorag.insert_video(video_path_list=video_paths)
     
     ## inference
```

**File**: `videorag/_llm.py` (modified, +24/-22)
```diff
@@ -2,6 +2,7 @@
 
 from openai import AsyncOpenAI, AsyncAzureOpenAI, APIConnectionError, RateLimitError
 from ollama import AsyncClient
+from dataclasses import asdict, dataclass, field
 
 from tenacity import (
     retry,
@@ -13,6 +14,7 @@
 
 from ._utils import compute_args_hash, wrap_embedding_func_with_attrs
 from .base import BaseKVStorage
+from ._utils import EmbeddingFunc
 
 global_openai_async_client = None
 global_azure_openai_async_client = None
@@ -130,19 +132,19 @@ async def openai_embedding(texts: list[str]) -> np.ndarray:
 
 
 openai_config = LLMConfig(
-    embedding_func = field(default_factory=lambda: openai_embedding)
-    embedding_batch_num = 32
-    embedding_func_max_async = 16
-    query_better_than_threshold = 0.2
+    embedding_func = openai_embedding,
+    embedding_batch_num = 32,
+    embedding_func_max_async = 16,
+    query_better_than_threshold = 0.2,
 
     # LLM        
-    best_model_func = gpt_4o_mini_complete
-    best_model_max_token_size = 32768
-    best_model_max_async = 16
+    best_model_func = gpt_4o_mini_complete,
+    best_model_max_token_size = 32768,
+    best_model_max_async = 16,
         
-    cheap_model_func = gpt_4o_mini_complete
-    cheap_model_max_token_size = 32768
-    cheap_model_max_async = 16
+    cheap_model_func = gpt_4o_mini_complete,
+    cheap_model_max_token_size = 32768,
+    cheap_model_max_async = 16)
 
 ###### Azure OpenAI Configuration
 @retry(
@@ -223,18 +225,18 @@ async def azure_openai_embedding(texts: list[str]) -> np.ndarray:
 
 
 azure_openai_config = LLMConfig(
-    embedding_func = field(default_factory=lambda: azure_openai_embedding),
-    embedding_batch_num = 32
-    embedding_func_max_async = 16
-    query_better_than_threshold = 0.2
+    embedding_func = azure_openai_embedding,
+    embedding_batch_num = 32,
+    embedding_func_max_async = 16,
+    query_better_than_threshold = 0.2,
 
-    best_model_func: callable = azure_gpt_4o_complete
-    best_model_max_token_size = 32768
-    best_model_max_async = 16
+    best_model_func = azure_gpt_4o_complete,
+    best_model_max_token_size = 32768,
+    best_model_max_async = 16,
 
-    cheap_model_func: callable = azure_gpt_4o_mini_complete
-    cheap_model_max_token_size = 32768
-    cheap_model_max_async = 16
+    cheap_model_func  = azure_gpt_4o_mini_complete,
+    cheap_model_max_token_size = 32768,
+    cheap_model_max_async = 16)
 
 
 ######  Ollama configuration
@@ -317,12 +319,12 @@ async def ollama_embedding(texts: list[str]) -> np.ndarray:
     return np.array(embeddings)
 
 ollama_config = LLMConfig(
-    embedding_func= EmbeddingFunc = field(default_factory=lambda: ollama_embedding),
+    embedding_func = ollama_embedding,
     embedding_batch_num = 1,
     embedding_func_max_async = 1,
     query_better_than_threshold = 0.2,
     best_model_func = ollama_complete ,   
-    best_model_max_token_size: int = 32768,
+    best_model_max_token_size = 32768,
     best_model_max_async  = 1,
     cheap_model_func = ollama_mini_complete,
     cheap_model_max_token_size = 32768,
```

**File**: `videorag/_op.py` (modified, +4/-4)
```diff
@@ -552,7 +552,7 @@ async def _refine_entity_retrieval_query(
     query_param: QueryParam,
     global_config: dict,
 ):
-    use_llm_func: callable = global_config["cheap_model_func"]
+    use_llm_func: callable = global_config["llm"]["cheap_model_func"]
     query_rewrite_prompt = PROMPTS["query_rewrite_for_entity_retrieval"]
     query_rewrite_prompt = query_rewrite_prompt.format(input_text=query)
     final_result = await use_llm_func(query_rewrite_prompt)
@@ -563,7 +563,7 @@ async def _refine_visual_retrieval_query(
     query_param: QueryParam,
     global_config: dict,
 ):
-    use_llm_func: callable = global_config["cheap_model_func"]
+    use_llm_func: callable = global_config["llm"]["cheap_model_func"]
     query_rewrite_prompt = PROMPTS["query_rewrite_for_visual_retrieval"]
     query_rewrite_prompt = query_rewrite_prompt.format(input_text=query)
     final_result = await use_llm_func(query_rewrite_prompt)
@@ -574,7 +574,7 @@ async def _extract_keywords_query(
     query_param: QueryParam,
     global_config: dict,
 ):
-    use_llm_func: callable = global_config["cheap_model_func"]
+    use_llm_func: callable = global_config["llm"]["cheap_model_func"]
     keywords_prompt = PROMPTS["keywords_extraction"]
     keywords_prompt = keywords_prompt.format(input_text=query)
     final_result = await use_llm_func(keywords_prompt)
@@ -594,7 +594,7 @@ async def videorag_query(
     query_param: QueryParam,
     global_config: dict,
 ) -> str:
-    use_model_func = global_config["best_model_func"]
+    use_model_func = global_config["llm"]["best_model_func"]
     query = query
     
     # naive chunks
```

**File**: `videorag/_storage/vdb_nanovectordb.py` (modified, +2/-2)
```diff
@@ -21,7 +21,7 @@ def __post_init__(self):
         self._client_file_name = os.path.join(
             self.global_config["working_dir"], f"vdb_{self.namespace}.json"
         )
-        self._max_batch_size = self.global_config["embedding_batch_num"]
+        self._max_batch_size = self.global_config["llm"]["embedding_batch_num"]
         self._client = NanoVectorDB(
             self.embedding_func.embedding_dim, storage_file=self._client_file_name
         )
@@ -142,4 +142,4 @@ async def query(self, query: str):
         return results
     
     async def index_done_callback(self):
-        self._client.save()
\ No newline at end of file
+        self._client.save()
```

**File**: `videorag/videorag.py` (modified, +2/-4)
```diff
@@ -13,7 +13,7 @@
 
 
 from ._llm import (
-    LLMConfig
+    LLMConfig,
     openai_config,
     azure_openai_config,
     ollama_config
@@ -96,10 +96,8 @@ class VideoRAG:
     entity_extract_max_gleaning: int = 1
     entity_summary_to_max_tokens: int = 500
 
-    # Uncomment as appropriate depending on whether you use openai, azure_openai or ollama
-
     # Change to your LLM provider
-    llm: LLMConfig = ollama_config
+    llm: LLMConfig = field(default_factory=openai_config)
     
     # entity extraction
     entity_extraction_func: callable = extract_entities
```

---

### Incident Patch 10: `35058566` (2025-02-11)
**Commit Message**: Fix execution errors

**File**: `longervideos/videorag_experiment.py` (modified, +14/-8)
```diff
@@ -3,38 +3,44 @@
 import logging
 import warnings
 import multiprocessing
+import sys
 
 warnings.filterwarnings("ignore")
 logging.getLogger("httpx").setLevel(logging.WARNING)
 
+# Add the parent directory of 'videorag' to sys.path
+sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
+
 import argparse
 parser = argparse.ArgumentParser(description="Set sub-category and CUDA device.")
 parser.add_argument('--collection', type=str, default='4-rag-lecture')
 parser.add_argument('--cuda', type=str, default='0')
 args = parser.parse_args()
-sub_category = args.sub_category
+sub_category = args.collection
 
 os.environ["CUDA_VISIBLE_DEVICES"] = args.cuda
 os.environ["OPENAI_API_KEY"] = ""
 
 from videorag._llm import *
-from videorag import VideoRAG, QueryParam
+from videorag.videorag import VideoRAG, QueryParam
 
 if __name__ == '__main__':
     multiprocessing.set_start_method('spawn')
     
     ## learn
-    video_base_path = f'./{sub_category}/videos/'
+    video_base_path = f'longervideos/{sub_category}/videos/'
     video_files = sorted(os.listdir(video_base_path))
     video_paths = [os.path.join(video_base_path, f) for f in video_files]
-    videorag = VideoRAG(cheap_model_func=gpt_4o_mini_complete, best_model_func=gpt_4o_mini_complete, working_dir=f"./videorag-workdir/{sub_category}")
+    #videorag = VideoRAG(cheap_model_func=gpt_4o_mini_complete, best_model_func=gpt_4o_mini_complete, working_dir=f"./videorag-workdir/{sub_category}")
+    videorag = VideoRAG(cheap_model_func=ollama_mini_complete, best_model_func=ollama_complete, working_dir=f"./videorag-workdir/{sub_category}")    
     videorag.insert_video(video_path_list=video_paths)
     
     ## inference
-    with open(f'./dataset.json', 'r') as f:
+    with open(f'longervideos/dataset.json', 'r') as f:
         longervideos = json.load(f)
     
-    videorag = VideoRAG(cheap_model_func=gpt_4o_mini_complete, best_model_func=gpt_4o_mini_complete, working_dir=f"./videorag-workdir/{sub_category}")
+    #videorag = VideoRAG(cheap_model_func=gpt_4o_mini_complete, best_model_func=gpt_4o_mini_complete, working_dir=f"./videorag-workdir/{sub_category}")
+    videorag = VideoRAG(cheap_model_func=ollama_mini_complete, best_model_func=ollama_complete, working_dir=f"./videorag-workdir/{sub_category}")        
     videorag.load_caption_model(debug=False)
     
     answer_folder = f'./videorag-answers/{sub_category}'
@@ -51,5 +57,5 @@
         
         response = videorag.query(query=query, param=param)
         print(response)
-        with open(os.path.join(answer_folder, f'/answer_{query_id}.md'), 'w') as f:
-            f.write(response)
\ No newline at end of file
+        with open(os.path.join(answer_folder, f'answer_{query_id}.md'), 'w') as f:
+            f.write(response)
```

**File**: `videorag/_llm.py` (modified, +12/-6)
```diff
@@ -1,6 +1,7 @@
 import numpy as np
 
 from openai import AsyncOpenAI, AsyncAzureOpenAI, APIConnectionError, RateLimitError
+from ollama import AsyncClient
 
 from tenacity import (
     retry,
@@ -33,8 +34,8 @@ def get_azure_openai_async_client_instance():
 def get_ollama_async_client_instance():
     global global_ollama_client
     if global_ollama_client is None:
-        #global_ollama_client = Client(base_url="http://localhost:11434")  # Adjust base URL if necessary
-        global_ollama_client = Client(base_url="http://10.0.1.12:11434")  # Adjust base URL if necessary        
+        #global_ollama_client = AsyncClient(host="http://localhost:11434")  # Adjust base URL if necessary
+        global_ollama_client = AsyncClient(host="http://10.0.1.12:11434")  # Adjust base URL if necessary        
     return global_ollama_client
 
 @retry(
@@ -238,18 +239,23 @@ async def ollama_mini_complete(prompt, system_prompt=None, history_messages=[],
         **kwargs,
     )
 
+@wrap_embedding_func_with_attrs(embedding_dim=768, max_token_size=8192)
+@retry(
+    stop=stop_after_attempt(5),
+    wait=wait_exponential(multiplier=1, min=4, max=10),
+    retry=retry_if_exception_type((RateLimitError, APIConnectionError)),
+)
 async def ollama_embedding(texts: list[str]) -> np.ndarray:
     # Initialize the Ollama client
     ollama_client = get_ollama_async_client_instance()
 
     # Send the request to Ollama for embeddings
-    response = await ollama_client.embeddings(
+    response = await ollama_client.embed(
         model="nomic-embed-text",  # Replace with the appropriate Ollama embedding model
-        input=texts,
-        encoding_format="float"
+        input=texts
     )
 
     # Extract embeddings from the response
-    embeddings = [dp.embedding for dp in response.data]
+    embeddings = response['embeddings']
 
     return np.array(embeddings)
```

**File**: `videorag/videorag.py` (modified, +3/-2)
```diff
@@ -20,6 +20,7 @@
     azure_openai_embedding,
     azure_gpt_4o_mini_complete,
     ollama_complete,
+    ollama_mini_complete,    
     ollama_embedding
 )
 from ._op import (
@@ -121,7 +122,7 @@ class VideoRAG:
         cheap_model_max_async: int = 16
     if llm_provider == "azur_openai":
         # text embedding
-        embedding_func = : EmbeddingFunc = field(default_factory=lambda: azure_openai_embedding)        
+        embedding_func: EmbeddingFunc = field(default_factory=lambda: azure_openai_embedding)        
         embedding_batch_num: int = 32
         embedding_func_max_async: int = 16
         query_better_than_threshold: float = 0.2
@@ -138,7 +139,7 @@ class VideoRAG:
     if llm_provider == "ollama":
         # text embedding
         embedding_func: EmbeddingFunc = field(default_factory=lambda: ollama_embedding)
-        embedding_batch_num: int = 32
+        embedding_batch_num: int = 1
         embedding_func_max_async: int = 1
         query_better_than_threshold: float = 0.2
 
```

#### Recent Merged Pull Requests:
- **PR #41** (closed): docs: fix README parameters typos (@cosmopolitan033)
- **PR #40** (closed): docs: fix README parameters typos (@cosmopolitan033)
- **PR #38** (closed): Graph traversal summarization (@jg-eno)
- **PR #34** (2026-01-11): Fix GPU crash on Linux (#30) (@YousefAliUK)
- **PR #31** (closed): Refactoring for Whizzhive (@vishalm)
- **PR #26** (2025-07-30): feat:add deepseek and bge support (@ZhangQL2824)
- **PR #25** (closed): feat: add DeepSeek and BGE model support (@ZhangQL2824)
- **PR #4** (2025-02-25): Ollama support (@geraldthewes)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

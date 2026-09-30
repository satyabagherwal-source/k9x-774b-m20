# Forensic Learning Record (Deep Inspection): modelscope/FunASR

> **Canonical Artifact**: `07_PROJECT_LEARNING/modelscope-funasr-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/modelscope/FunASR](https://github.com/modelscope/FunASR))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T19:29:57.806Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `modelscope/FunASR`
- **Description**: Open-source speech recognition toolkit for training, inference, streaming ASR, VAD, punctuation, speaker diarization pipelines, and OpenAI-compatible/MCP serving.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 20559 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `benchmark_vllm.py`
```
#!/usr/bin/env python3
"""FunASR vLLM Benchmark: unified speed + CER comparison for all supported models.

Supports: Fun-ASR-Nano, GLM-ASR-Nano (and any model via AutoModelVLLM).

Usage:
    # Fun-ASR-Nano
    CUDA_VISIBLE_DEVICES=0 python benchmark_vllm.py \
        --model FunAudioLLM/Fun-ASR-Nano-2512 \
        --audio-dir /path/to/benchmark_audio \
        --label-json /path/to/benchmark_testset.json

    # GLM-ASR-Nano
    CUDA_VISIBLE_DEVICES=0 python benchmark_vllm.py \
        --model zai-org/GLM-ASR-Nano-2512 \
        --audio-dir /path/to/benchmark_audio \
        --label-json /path/to/benchmark_testset.json

    # Quick test (first N files)
    CUDA_VISIBLE_DEVICES=0 python benchmark_vllm.py \
        --model FunAudioLLM/Fun-ASR-Nano-2512 \
        --audio-dir /path/to/benchmark_audio \
        --label-json /path/to/benchmark_testset.json \
        --max-files 20

    # Skip PyTorch (only test vLLM)
    CUDA_VISIBLE_DEVICES=0 python benchmark_vllm.py \
        --model FunAudioLLM/Fun-ASR-Nano-2512 \
        --skip-pytorch \
        --audio-dir /path/to/benchmark_audio \
        --label-json /path/to/benchmark_testset.json
"""

import argparse
import json
import os
import re
import time

import kaldialign
import numpy as np
import soundfile as sf
import torch


def normalize_zh(text):
    text = re.sub(r'[^\w一-鿿]', '', text)
    return text.upper()


def compute_cer(refs, hyps):
    total_ref = 0
    total_errs = 0
    for ref, hyp in zip(refs, hyps):
        r = list(normalize_zh(ref))
        h = list(normalize_zh(hyp))
        total_ref += len(r)
        ali = kaldialign.align(r, h, '*')
        total_errs += sum(1 for a, b in ali if a != b)
    return total_errs / total_ref * 100 if total_ref > 0 else 0


def vad_segment(files, device="cuda:0"):
    from funasr import AutoModel
    vad_model = AutoModel(model="fsmn-vad", device=device, disable_update=True)
    all_segments = []
    for fi, wav_path in enumerate(files):
        audio, sr = sf.read(wav_path)
        if audio.ndim > 1:
            audio = audio[:, 0]
        audio = audio.astype(np.float32)
        res = vad_model.generate(input=wav_path, dynamic_silence=False)
        for seg in res[0]["value"]:
            s0 = int(seg[0] * sr / 1000)
            s1 = int(seg[1] * sr / 1000)
            seg_audio = audio[s0:s1]
            if len(seg_audio) > sr * 0.5:
                all_segments.append((fi, seg_audio))
    return all_segments


def concat_results(all_segments, seg_texts, n_files):
    file_texts = {}
    for (fi, _), text in zip(all_segments, seg_texts):
        file_texts.setdefault(fi, []).append(text)
    return ["".join(file_texts.get(fi, [])) for fi in range(n_files)]


def run_pytorch(model_name, seg_files, device="cuda:0"):
    from funasr import AutoModel

    kwargs = {"model": model_name, "device": device, "disable_update": True}
    if "Fun-ASR-Nano" in model_name:
        kwargs["trust_remote_code"] = True
        kwargs["remote_code"] = os.path.join(
            os.path.dirname(__file__),
            "examples/industrial_data_pretraining/fun_asr_nano/model.py"
        )

    model = AutoModel(**kwargs)
    model.generate(input=seg_files[0])  # warmup

    t0 = time.perf_counter()
    texts = []
    for f in seg_files:
        res = model.generate(input=f)
        texts.append(res[0]["text"])
    t1 = time.perf_counter()
    return t1 - t0, texts


def run_vllm(model_name, seg_files, device="cuda:0", hub="ms"):
    if "Fun-ASR-Nano" in model_name:
        from funasr.models.fun_asr_nano.inference_vllm import FunASRNanoVLLM
        engine = FunASRNanoVLLM.from_pretrained(
            model=model_name, hub=hub, device=device, dtype="bf16",
            max_model_len=4096, gpu_memory_utilization=0.5)
        engine.generate(inputs=[seg_files[0]], language="中文")  # warmup
        t0 = time.perf_counter()
        results = engine.generate(inputs=seg_files, language="中文", max_new_tokens=500)
        t1 = time.perf_counter()
        texts = [r["text"] for r in results]

    elif "GLM-ASR" in model_name:
        from funasr.models.glm_asr.inference_vllm import GLMASRVLLMEngine
        engine = GLMASRVLLMEngine.from_pretrained(
            model=model_name, hub=hub, device=device, dtype="bf16",
            gpu_memory_utilization=0.4, max_model_len=4096)
        engine.generate(inputs=[seg_files[0]])  # warmup
        t0 = time.perf_counter()
        results = engine.generate(inputs=seg_files, max_new_tokens=500)
        t1 = time.perf_counter()
        texts = [r["text"] for r in results]

    else:
        from funasr.auto.auto_model_vllm import AutoModelVLLM
        engine = AutoModelVLLM(model=model_name, hub=hub, device=device)
        engine.generate(inputs=[seg_files[0]])
        t0 = time.perf_counter()
        results = engine.generate(inputs=seg_files, max_new_tokens=500)
        t1 = time.perf_counter()
        texts = [r["text"] for r in results]

    return t1 - t0, texts


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="FunASR vLLM Benchmark")
    parser.add_argument("--model", type=str, required=True, help="Model name or path")
    parser.add_argument("--hub", type=str, default="ms", choices=["ms", "hf"])
    parser.add_argument("--audio-dir", type=str, required=True)
    parser.add_argument("--label-json", type=str, required=True)
    parser.add_argument("--device", type=str, default="cuda:0")
    parser.add_argument("--max-files", type=int, default=0)
    parser.add_argument("--skip-pytorch", action="store_true")
    args = parser.parse_args()

    with open(args.label_json) as f:
        dataset = json.load(f)

    files = []
    refs = []
    for item in dataset:
        wav_path = os.path.join(args.audio_dir, f"{item['id']:03d}.wav")
        if os.path.exists(wav_path):
            files.append(wav_path)
            refs.append(item["ref"])
    if args.max_files > 0:
        files = files[:args.max_files]
        refs = refs[:args.max_files]

    total_audio = sum(sf.info(f).duration for f in files)
    print(f"{'='*60}")
    print(f"FunASR vLLM Benchmark")
    print(f"{'='*60}")
    print(f"Model: {args.model}")
    print(f"Dataset: {len(files)} files, {total_audio:.0f}s audio")

    # VAD
    print(f"\n>>> VAD pre-segmenting...")
    all_segments = vad_segment(files, device=args.device)
    print(f"    {len(all_segments)} segments")

    os.makedirs("/tmp/benchmark_vllm_segs", exist_ok=True)
    seg_files = []
    for i, (fi, audio) in enumerate(all_segments):
        path = f"/tmp/benchmark_vllm_segs/{i:04d}.wav"
        sf.write(path, audio, 16000)
        seg_files.append(path)

    # PyTorch
    cer_pt = None
    pt_time = None
    if not args.skip_pytorch:
        print(f"\n>>> PyTorch native...")
        pt_time, pt_seg_texts = run_pytorch(args.model, seg_files, device=args.device)
        pt_texts = concat_results(all_segments, pt_seg_texts, len(files))
        cer_pt = compute_cer(refs, pt_texts)
        print(f"    Time: {pt_time:.1f}s | RTFx: {total_audio/pt_time:.1f} | CER: {cer_pt:.2f}%")

        del torch.cuda.memory_allocated
        torch.cuda.empty_cache()

    # vLLM
    print(f"\n>>> vLLM...")
    vllm_time, vllm_seg_texts = run_vllm(args.model, seg_files, device=args.device, hub=args.hub)
    vllm_texts = concat_results(all_segments, vllm_seg_texts, len(files))
    cer_vllm = compute_cer(refs, vllm_texts)
    print(f"    Time: {vllm_time:.1f}s | RTFx: {total_audio/vllm_time:.1f} | CER: {cer_vllm:.2f}%")

    # Summary
    print(f"\n{'='*60}")
    print(f"RESULTS")
    print(f"{'-'*60}")
    print(f"{'Method':<20} {'Time':<10} {'RTFx':<10} {'CER'}")
    print(f"{'-'*60}")
    if not args.skip_pytorch:
        print(f"{'PyTorch':<20} {pt_time:<10.1f} {total_audio/pt_time:<10.1f} {cer_pt:.2f}%")
    print(f"{'vLLM':<20} {vllm_time:<10.1f} {total_audio/vllm_time:<10.1f} {cer_vllm:.2f}%")
    if not args.skip_pytorch:
        print(f"{'-'*60}")
        speedup = (total_audio/vllm_time) / (total_audio/
```

### Core Architecture Module: `examples/aishell/e_paraformer/utils/compute_wer.py`
```
import os
import numpy as np
import sys


def compute_wer(ref_file, hyp_file, cer_detail_file):
    rst = {
        "Wrd": 0,
        "Corr": 0,
        "Ins": 0,
        "Del": 0,
        "Sub": 0,
        "Snt": 0,
        "Err": 0.0,
        "S.Err": 0.0,
        "wrong_words": 0,
        "wrong_sentences": 0,
    }

    hyp_dict = {}
    ref_dict = {}
    with open(hyp_file, "r") as hyp_reader:
        for line in hyp_reader:
            key = line.strip().split()[0]
            value = line.strip().split()[1:]
            hyp_dict[key] = value
    with open(ref_file, "r") as ref_reader:
        for line in ref_reader:
            key = line.strip().split()[0]
            value = line.strip().split()[1:]
            ref_dict[key] = value

    cer_detail_writer = open(cer_detail_file, "w")
    for hyp_key in hyp_dict:
        if hyp_key in ref_dict:
            out_item = compute_wer_by_line(hyp_dict[hyp_key], ref_dict[hyp_key])
            rst["Wrd"] += out_item["nwords"]
            rst["Corr"] += out_item["cor"]
            rst["wrong_words"] += out_item["wrong"]
            rst["Ins"] += out_item["ins"]
            rst["Del"] += out_item["del"]
            rst["Sub"] += out_item["sub"]
            rst["Snt"] += 1
            if out_item["wrong"] > 0:
                rst["wrong_sentences"] += 1
            cer_detail_writer.write(hyp_key + print_cer_detail(out_item) + "\n")
            cer_detail_writer.write(
                "ref:" + "\t" + " ".join(list(map(lambda x: x.lower(), ref_dict[hyp_key]))) + "\n"
            )
            cer_detail_writer.write(
                "hyp:" + "\t" + " ".join(list(map(lambda x: x.lower(), hyp_dict[hyp_key]))) + "\n"
            )

    if rst["Wrd"] > 0:
        rst["Err"] = round(rst["wrong_words"] * 100 / rst["Wrd"], 2)
    if rst["Snt"] > 0:
        rst["S.Err"] = round(rst["wrong_sentences"] * 100 / rst["Snt"], 2)

    cer_detail_writer.write("\n")
    cer_detail_writer.write(
        "%WER "
        + str(rst["Err"])
        + " [ "
        + str(rst["wrong_words"])
        + " / "
        + str(rst["Wrd"])
        + ", "
        + str(rst["Ins"])
        + " ins, "
        + str(rst["Del"])
        + " del, "
        + str(rst["Sub"])
        + " sub ]"
        + "\n"
    )
    cer_detail_writer.write(
        "%SER "
        + str(rst["S.Err"])
        + " [ "
        + str(rst["wrong_sentences"])
        + " / "
        + str(rst["Snt"])
        + " ]"
        + "\n"
    )
    cer_detail_writer.write(
        "Scored "
        + str(len(hyp_dict))
        + " sentences, "
        + str(len(hyp_dict) - rst["Snt"])
        + " not present in hyp."
        + "\n"
    )


def compute_wer_by_line(hyp, ref):
    hyp = list(map(lambda x: x.lower(), hyp))
    ref = list(map(lambda x: x.lower(), ref))

    len_hyp = len(hyp)
    len_ref = len(ref)

    cost_matrix = np.zeros((len_hyp + 1, len_ref + 1), dtype=np.int16)

    ops_matrix = np.zeros((len_hyp + 1, len_ref + 1), dtype=np.int8)

    for i in range(len_hyp + 1):
        cost_matrix[i][0] = i
    for j in range(len_ref + 1):
        cost_matrix[0][j] = j

    for i in range(1, len_hyp + 1):
        for j in range(1, len_ref + 1):
            if hyp[i - 1] == ref[j - 1]:
                cost_matrix[i][j] = cost_matrix[i - 1][j - 1]
            else:
                substitution = cost_matrix[i - 1][j - 1] + 1
                insertion = cost_matrix[i - 1][j] + 1
                deletion = cost_matrix[i][j - 1] + 1

                compare_val = [substitution, insertion, deletion]

                min_val = min(compare_val)
                operation_idx = compare_val.index(min_val) + 1
                cost_matrix[i][j] = min_val
                ops_matrix[i][j] = operation_idx

    match_idx = []
    i = len_hyp
    j = len_ref
    rst = {"nwords": len_ref, "cor": 0, "wrong": 0, "ins": 0, "del": 0, "sub": 0}
    while i >= 0 or j >= 0:
        i_idx = max(0, i)
        j_idx = max(0, j)

        if ops_matrix[i_idx][j_idx] == 0:  # correct
            if i - 1 >= 0 and j - 1 >= 0:
                match_idx.append((j - 1, i - 1))
                rst["cor"] += 1

            i -= 1
            j -= 1

        elif ops_matrix[i_idx][j_idx] == 2:  # insert
            i -= 1
            rst["ins"] += 1

        elif ops_matrix[i_idx][j_idx] == 3:  # delete
            j -= 1
            rst["del"] += 1

        elif ops_matrix[i_idx][j_idx] == 1:  # substitute
            i -= 1
            j -= 1
            rst["sub"] += 1

        if i < 0 and j >= 0:
            rst["del"] += 1
        elif j < 0 and i >= 0:
            rst["ins"] += 1

    match_idx.reverse()
    wrong_cnt = cost_matrix[len_hyp][len_ref]
    rst["wrong"] = wrong_cnt

    return rst


def print_cer_detail(rst):
    return (
        "("
        + "nwords="
        + str(rst["nwords"])
        + ",cor="
        + str(rst["cor"])
        + ",ins="
        + str(rst["ins"])
        + ",del="
        + str(rst["del"])
        + ",sub="
        + str(rst["sub"])
        + ") corr:"
        + "{:.2%}".format(rst["cor"] / rst["nwords"])
        + ",cer:"
        + "{:.2%}".format(rst["wrong"] / rst["nwords"])
    )


if __name__ == "__main__":
    if len(sys.argv) != 4:
        print("usage : python compute-wer.py test.ref test.hyp test.wer")
        sys.exit(0)

    ref_file = sys.argv[1]
    hyp_file = sys.argv[2]
    cer_detail_file = sys.argv[3]
    compute_wer(ref_file, hyp_file, cer_detail_file)

```

### Core Architecture Module: `examples/aishell/e_paraformer/utils/extract_embeds.py`
```
from transformers import AutoTokenizer, AutoModel, pipeline
import numpy as np
import sys
import os
import torch
from kaldiio import WriteHelper
import re

text_file_json = sys.argv[1]
out_ark = sys.argv[2]
out_scp = sys.argv[3]
out_shape = sys.argv[4]
device = int(sys.argv[5])
model_path = sys.argv[6]

model = AutoModel.from_pretrained(model_path)
tokenizer = AutoTokenizer.from_pretrained(model_path)
extractor = pipeline(task="feature-extraction", model=model, tokenizer=tokenizer, device=device)

with open(text_file_json, "r") as f:
    js = f.readlines()


f_shape = open(out_shape, "w")
with WriteHelper("ark,scp:{},{}".format(out_ark, out_scp)) as writer:
    with torch.no_grad():
        for idx, line in enumerate(js):
            id, tokens = line.strip().split(" ", 1)
            tokens = re.sub(" ", "", tokens.strip())
            tokens = " ".join([j for j in tokens])
            token_num = len(tokens.split(" "))
            outputs = extractor(tokens)
            outputs = np.array(outputs)
            embeds = outputs[0, 1:-1, :]

            token_num_embeds, dim = embeds.shape
            if token_num == token_num_embeds:
                writer(id, embeds)
                shape_line = "{} {},{}\n".format(id, token_num_embeds, dim)
                f_shape.write(shape_line)
            else:
                print(
                    "{}, size has changed, {}, {}, {}".format(
                        id, token_num, token_num_embeds, tokens
                    )
                )


f_shape.close()

```

### Core Architecture Module: `examples/aishell/e_paraformer/utils/postprocess_text_zh.py`
```
import sys
import re

in_f = sys.argv[1]
out_f = sys.argv[2]


with open(in_f, "r", encoding="utf-8") as f:
    lines = f.readlines()

with open(out_f, "w", encoding="utf-8") as f:
    for line in lines:
        outs = line.strip().split(" ", 1)
        if len(outs) == 2:
            idx, text = outs
            text = re.sub("</s>", "", text)
            text = re.sub("<s>", "", text)
            text = re.sub("@@", "", text)
            text = re.sub("@", "", text)
            text = re.sub("<unk>", "", text)
            text = re.sub(" ", "", text)
            text = text.lower()
        else:
            idx = outs[0]
            text = " "

        text = [x for x in text]
        text = " ".join(text)
        out = "{} {}\n".format(idx, text)
        f.write(out)

```

### Core Architecture Module: `examples/aishell/e_paraformer/utils/text2token.py`
```
#!/usr/bin/env python3

# Copyright 2017 Johns Hopkins University (Shinji Watanabe)
#  Apache 2.0  (http://www.apache.org/licenses/LICENSE-2.0)


import argparse
import codecs
import re
import sys
import json

is_python2 = sys.version_info[0] == 2


def exist_or_not(i, match_pos):
    start_pos = None
    end_pos = None
    for pos in match_pos:
        if pos[0] <= i < pos[1]:
            start_pos = pos[0]
            end_pos = pos[1]
            break

    return start_pos, end_pos


def get_parser():
    parser = argparse.ArgumentParser(
        description="convert raw text to tokenized text",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument(
        "--nchar",
        "-n",
        default=1,
        type=int,
        help="number of characters to split, i.e., \
                        aabb -> a a b b with -n 1 and aa bb with -n 2",
    )
    parser.add_argument("--skip-ncols", "-s", default=0, type=int, help="skip first n columns")
    parser.add_argument("--space", default="<space>", type=str, help="space symbol")
    parser.add_argument(
        "--non-lang-syms",
        "-l",
        default=None,
        type=str,
        help="list of non-linguistic symobles, e.g., <NOISE> etc.",
    )
    parser.add_argument("text", type=str, default=False, nargs="?", help="input text")
    parser.add_argument(
        "--trans_type",
        "-t",
        type=str,
        default="char",
        choices=["char", "phn"],
        help="""Transcript type. char/phn. e.g., for TIMIT FADG0_SI1279 -
                        If trans_type is char,
                        read from SI1279.WRD file -> "bricks are an alternative"
                        Else if trans_type is phn,
                        read from SI1279.PHN file -> "sil b r ih sil k s aa r er n aa l
                        sil t er n ih sil t ih v sil" """,
    )
    parser.add_argument(
        "--text_format",
        default="text",
        type=str,
        help="text, jsonl",
    )
    return parser


def main():
    parser = get_parser()
    args = parser.parse_args()

    rs = []
    if args.non_lang_syms is not None:
        with codecs.open(args.non_lang_syms, "r", encoding="utf-8") as f:
            nls = [x.rstrip() for x in f.readlines()]
            rs = [re.compile(re.escape(x)) for x in nls]

    if args.text:
        f = codecs.open(args.text, encoding="utf-8")
    else:
        f = codecs.getreader("utf-8")(sys.stdin if is_python2 else sys.stdin.buffer)

    sys.stdout = codecs.getwriter("utf-8")(sys.stdout if is_python2 else sys.stdout.buffer)
    line = f.readline()
    n = args.nchar
    while line:
        if args.text_format == "jsonl":
            data = json.loads(line.strip())
            line = data["target"]
        x = line.split()
        print(" ".join(x[: args.skip_ncols]), end=" ")
        a = " ".join(x[args.skip_ncols :])

        # get all matched positions
        match_pos = []
        for r in rs:
            i = 0
            while i >= 0:
                m = r.search(a, i)
                if m:
                    match_pos.append([m.start(), m.end()])
                    i = m.end()
                else:
                    break

        if args.trans_type == "phn":
            a = a.split(" ")
        else:
            if len(match_pos) > 0:
                chars = []
                i = 0
                while i < len(a):
                    start_pos, end_pos = exist_or_not(i, match_pos)
                    if start_pos is not None:
                        chars.append(a[start_pos:end_pos])
                        i = end_pos
                    else:
                        chars.append(a[i])
                        i += 1
                a = chars

            a = [a[j : j + n] for j in range(0, len(a), n)]

        a_flat = []
        for z in a:
            a_flat.append("".join(z))

        a_chars = [z.replace(" ", args.space) for z in a_flat]
        if args.trans_type == "phn":
            a_chars = [z.replace("sil", args.space) for z in a_chars]
        print(" ".join(a_chars))
        line = f.readline()


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `examples/aishell/e_paraformer/utils/text_tokenize.py`
```
import re
import argparse


def load_dict(seg_file):
    seg_dict = {}
    with open(seg_file, "r") as infile:
        for line in infile:
            s = line.strip().split()
            key = s[0]
            value = s[1:]
            seg_dict[key] = " ".join(value)
    return seg_dict


def forward_segment(text, dic):
    word_list = []
    i = 0
    while i < len(text):
        longest_word = text[i]
        for j in range(i + 1, len(text) + 1):
            word = text[i:j]
            if word in dic:
                if len(word) > len(longest_word):
                    longest_word = word
        word_list.append(longest_word)
        i += len(longest_word)
    return word_list


def tokenize(txt, seg_dict):
    out_txt = ""
    pattern = re.compile(r"([\u4E00-\u9FA5A-Za-z0-9])")
    for word in txt:
        if pattern.match(word):
            if word in seg_dict:
                out_txt += seg_dict[word] + " "
            else:
                out_txt += "<unk>" + " "
        else:
            continue
    return out_txt.strip()


def get_parser():
    parser = argparse.ArgumentParser(
        description="text tokenize",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument(
        "--text-file",
        "-t",
        default=False,
        required=True,
        type=str,
        help="input text",
    )
    parser.add_argument(
        "--seg-file",
        "-s",
        default=False,
        required=True,
        type=str,
        help="seg file",
    )
    parser.add_argument(
        "--txt-index",
        "-i",
        default=1,
        required=True,
        type=int,
        help="txt index",
    )
    parser.add_argument(
        "--output-dir",
        "-o",
        default=False,
        required=True,
        type=str,
        help="output dir",
    )
    return parser


def main():
    parser = get_parser()
    args = parser.parse_args()

    txt_writer = open("{}/text.{}.txt".format(args.output_dir, args.txt_index), "w")
    shape_writer = open("{}/len.{}".format(args.output_dir, args.txt_index), "w")
    seg_dict = load_dict(args.seg_file)
    with open(args.text_file, "r") as infile:
        for line in infile:
            s = line.strip().split()
            text_id = s[0]
            text_list = forward_segment("".join(s[1:]).lower(), seg_dict)
            text = tokenize(text_list, seg_dict)
            lens = len(text.strip().split())
            txt_writer.write(text_id + " " + text + "\n")
            shape_writer.write(text_id + " " + str(lens) + "\n")


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `examples/aishell/e_paraformer/utils/textnorm_zh.py`
```
#!/usr/bin/env python3
# coding=utf-8

# Authors:
#   2019.5 Zhiyang Zhou (https://github.com/Joee1995/chn_text_norm.git)
#   2019.9 Jiayu DU
#
# requirements:
#   - python 3.X
# notes: python 2.X WILL fail or produce misleading results

import sys, os, argparse, codecs, string, re

# ================================================================================ #
#                                    basic constant
# ================================================================================ #
CHINESE_DIGIS = "零一二三四五六七八九"
BIG_CHINESE_DIGIS_SIMPLIFIED = "零壹贰叁肆伍陆柒捌玖"
BIG_CHINESE_DIGIS_TRADITIONAL = "零壹貳參肆伍陸柒捌玖"
SMALLER_BIG_CHINESE_UNITS_SIMPLIFIED = "十百千万"
SMALLER_BIG_CHINESE_UNITS_TRADITIONAL = "拾佰仟萬"
LARGER_CHINESE_NUMERING_UNITS_SIMPLIFIED = "亿兆京垓秭穰沟涧正载"
LARGER_CHINESE_NUMERING_UNITS_TRADITIONAL = "億兆京垓秭穰溝澗正載"
SMALLER_CHINESE_NUMERING_UNITS_SIMPLIFIED = "十百千万"
SMALLER_CHINESE_NUMERING_UNITS_TRADITIONAL = "拾佰仟萬"

ZERO_ALT = "〇"
ONE_ALT = "幺"
TWO_ALTS = ["两", "兩"]

POSITIVE = ["正", "正"]
NEGATIVE = ["负", "負"]
POINT = ["点", "點"]
# PLUS = [u'加', u'加']
# SIL = [u'杠', u'槓']

FILLER_CHARS = ["呃", "啊"]
ER_WHITELIST = (
    "(儿女|儿子|儿孙|女儿|儿媳|妻儿|"
    "胎儿|婴儿|新生儿|婴幼儿|幼儿|少儿|小儿|儿歌|儿童|儿科|托儿所|孤儿|"
    "儿戏|儿化|台儿庄|鹿儿岛|正儿八经|吊儿郎当|生儿育女|托儿带女|养儿防老|痴儿呆女|"
    "佳儿佳妇|儿怜兽扰|儿无常父|儿不嫌母丑|儿行千里母担忧|儿大不由爷|苏乞儿)"
)

# 中文数字系统类型
NUMBERING_TYPES = ["low", "mid", "high"]

CURRENCY_NAMES = (
    "(人民币|美元|日元|英镑|欧元|马克|法郎|加拿大元|澳元|港币|先令|芬兰马克|爱尔兰镑|"
    "里拉|荷兰盾|埃斯库多|比塞塔|印尼盾|林吉特|新西兰元|比索|卢布|新加坡元|韩元|泰铢)"
)
CURRENCY_UNITS = (
    "((亿|千万|百万|万|千|百)|(亿|千万|百万|万|千|百|)元|(亿|千万|百万|万|千|百|)块|角|毛|分)"
)
COM_QUANTIFIERS = (
    "(匹|张|座|回|场|尾|条|个|首|阙|阵|网|炮|顶|丘|棵|只|支|袭|辆|挑|担|颗|壳|窠|曲|墙|群|腔|"
    "砣|座|客|贯|扎|捆|刀|令|打|手|罗|坡|山|岭|江|溪|钟|队|单|双|对|出|口|头|脚|板|跳|枝|件|贴|"
    "针|线|管|名|位|身|堂|课|本|页|家|户|层|丝|毫|厘|分|钱|两|斤|担|铢|石|钧|锱|忽|(千|毫|微)克|"
    "毫|厘|分|寸|尺|丈|里|寻|常|铺|程|(千|分|厘|毫|微)米|撮|勺|合|升|斗|石|盘|碗|碟|叠|桶|笼|盆|"
    "盒|杯|钟|斛|锅|簋|篮|盘|桶|罐|瓶|壶|卮|盏|箩|箱|煲|啖|袋|钵|年|月|日|季|刻|时|周|天|秒|分|旬|"
    "纪|岁|世|更|夜|春|夏|秋|冬|代|伏|辈|丸|泡|粒|颗|幢|堆|条|根|支|道|面|片|张|颗|块)"
)

# punctuation information are based on Zhon project (https://github.com/tsroten/zhon.git)
CHINESE_PUNC_STOP = "！？｡。"
CHINESE_PUNC_NON_STOP = "＂＃＄％＆＇（）＊＋，－／：；＜＝＞＠［＼］＾＿｀｛｜｝～｟｠｢｣､、〃》「」『』【】〔〕〖〗〘〙〚〛〜〝〞〟〰〾〿–—‘’‛“”„‟…‧﹏"
CHINESE_PUNC_LIST = CHINESE_PUNC_STOP + CHINESE_PUNC_NON_STOP


# ================================================================================ #
#                                    basic class
# ================================================================================ #
class ChineseChar(object):
    """
    中文字符
    每个字符对应简体和繁体,
    e.g. 简体 = '负', 繁体 = '負'
    转换时可转换为简体或繁体
    """

    def __init__(self, simplified, traditional):
        self.simplified = simplified
        self.traditional = traditional
        # self.__repr__ = self.__str__

    def __str__(self):
        return self.simplified or self.traditional or None

    def __repr__(self):
        return self.__str__()


class ChineseNumberUnit(ChineseChar):
    """
    中文数字/数位字符
    每个字符除繁简体外还有一个额外的大写字符
    e.g. '陆' 和 '陸'
    """

    def __init__(self, power, simplified, traditional, big_s, big_t):
        super(ChineseNumberUnit, self).__init__(simplified, traditional)
        self.power = power
        self.big_s = big_s
        self.big_t = big_t

    def __str__(self):
        return "10^{}".format(self.power)

    @classmethod
    def create(cls, index, value, numbering_type=NUMBERING_TYPES[1], small_unit=False):

        if small_unit:
            return ChineseNumberUnit(
                power=index + 1,
                simplified=value[0],
                traditional=value[1],
                big_s=value[1],
                big_t=value[1],
            )
        elif numbering_type == NUMBERING_TYPES[0]:
            return ChineseNumberUnit(
                power=index + 8,
                simplified=value[0],
                traditional=value[1],
                big_s=value[0],
                big_t=value[1],
            )
        elif numbering_type == NUMBERING_TYPES[1]:
            return ChineseNumberUnit(
                power=(index + 2) * 4,
                simplified=value[0],
                traditional=value[1],
                big_s=value[0],
                big_t=value[1],
            )
        elif numbering_type == NUMBERING_TYPES[2]:
            return ChineseNumberUnit(
                power=pow(2, index + 3),
                simplified=value[0],
                traditional=value[1],
                big_s=value[0],
                big_t=value[1],
            )
        else:
            raise ValueError(
                "Counting type should be in {0} ({1} provided).".format(
                    NUMBERING_TYPES, numbering_type
                )
            )


class ChineseNumberDigit(ChineseChar):
    """
    中文数字字符
    """

    def __init__(self, value, simplified, traditional, big_s, big_t, alt_s=None, alt_t=None):
        super(ChineseNumberDigit, self).__init__(simplified, traditional)
        self.value = value
        self.big_s = big_s
        self.big_t = big_t
        self.alt_s = alt_s
        self.alt_t = alt_t

    def __str__(self):
        return str(self.value)

    @classmethod
    def create(cls, i, v):
        return ChineseNumberDigit(i, v[0], v[1], v[2], v[3])


class ChineseMath(ChineseChar):
    """
    中文数位字符
    """

    def __init__(self, simplified, traditional, symbol, expression=None):
        super(ChineseMath, self).__init__(simplified, traditional)
        self.symbol = symbol
        self.expression = expression
        self.big_s = simplified
        self.big_t = traditional


CC, CNU, CND, CM = ChineseChar, ChineseNumberUnit, ChineseNumberDigit, ChineseMath


class NumberSystem(object):
    """
    中文数字系统
    """

    pass


class MathSymbol(object):
    """
    用于中文数字系统的数学符号 (繁/简体), e.g.
    positive = ['正', '正']
    negative = ['负', '負']
    point = ['点', '點']
    """

    def __init__(self, positive, negative, point):
        self.positive = positive
        self.negative = negative
        self.point = point

    def __iter__(self):
        for v in self.__dict__.values():
            yield v


# class OtherSymbol(object):
#     """
#     其他符号
#     """
#
#     def __init__(self, sil):
#         self.sil = sil
#
#     def __iter__(self):
#         for v in self.__dict__.values():
#             yield v


# ================================================================================ #
#                                    basic utils
# ================================================================================ #
def create_system(numbering_type=NUMBERING_TYPES[1]):
    """
    根据数字系统类型返回创建相应的数字系统，默认为 mid
    NUMBERING_TYPES = ['low', 'mid', 'high']: 中文数字系统类型
        low:  '兆' = '亿' * '十' = $10^{9}$,  '京' = '兆' * '十', etc.
        mid:  '兆' = '亿' * '万' = $10^{12}$, '京' = '兆' * '万', etc.
        high: '兆' = '亿' * '亿' = $10^{16}$, '京' = '兆' * '兆', etc.
    返回对应的数字系统
    """

    # chinese number units of '亿' and larger
    all_larger_units = zip(
        LARGER_CHINESE_NUMERING_UNITS_SIMPLIFIED, LARGER_CHINESE_NUMERING_UNITS_TRADITIONAL
    )
    larger_units = [CNU.create(i, v, numbering_type, False) for i, v in enumerate(all_larger_units)]
    # chinese number units of '十, 百, 千, 万'
    all_smaller_units = zip(
        SMALLER_CHINESE_NUMERING_UNITS_SIMPLIFIED, SMALLER_CHINESE_NUMERING_UNITS_TRADITIONAL
    )
    smaller_units = [CNU.create(i, v, small_unit=True) for i, v in enumerate(all_smaller_units)]
    # digis
    chinese_digis = zip(
        CHINESE_DIGIS, CHINESE_DIGIS, BIG_CHINESE_DIGIS_SIMPLIFIED, BIG_CHINESE_DIGIS_TRADITIONAL
    )
    digits = [CND.create(i, v) for i, v in enumerate(chinese_digis)]
    digits[0].alt_s, digits[0].alt_t = ZERO_ALT, ZERO_ALT
    digits[1].alt_s, digits[1].alt_t = ONE_ALT, ONE_ALT
    digits[2].alt_s, digits[2].alt_t = TWO_ALTS[0], TWO_ALTS[1]

    # symbols
    positive_cn = CM(POSITIVE[0], POSITIVE[1], "+", lambda x: x)
    negative_cn = CM(NEGATIVE[0], NEGATIVE[1], "-", lambda x: -x)
    point_cn 
```

### Core Architecture Module: `examples/aishell/paraformer/utils/compute_wer.py`
```
import os
import numpy as np
import sys


def compute_wer(ref_file, hyp_file, cer_detail_file):
    rst = {
        "Wrd": 0,
        "Corr": 0,
        "Ins": 0,
        "Del": 0,
        "Sub": 0,
        "Snt": 0,
        "Err": 0.0,
        "S.Err": 0.0,
        "wrong_words": 0,
        "wrong_sentences": 0,
    }

    hyp_dict = {}
    ref_dict = {}
    with open(hyp_file, "r") as hyp_reader:
        for line in hyp_reader:
            key = line.strip().split()[0]
            value = line.strip().split()[1:]
            hyp_dict[key] = value
    with open(ref_file, "r") as ref_reader:
        for line in ref_reader:
            key = line.strip().split()[0]
            value = line.strip().split()[1:]
            ref_dict[key] = value

    cer_detail_writer = open(cer_detail_file, "w")
    for hyp_key in hyp_dict:
        if hyp_key in ref_dict:
            out_item = compute_wer_by_line(hyp_dict[hyp_key], ref_dict[hyp_key])
            rst["Wrd"] += out_item["nwords"]
            rst["Corr"] += out_item["cor"]
            rst["wrong_words"] += out_item["wrong"]
            rst["Ins"] += out_item["ins"]
            rst["Del"] += out_item["del"]
            rst["Sub"] += out_item["sub"]
            rst["Snt"] += 1
            if out_item["wrong"] > 0:
                rst["wrong_sentences"] += 1
            cer_detail_writer.write(hyp_key + print_cer_detail(out_item) + "\n")
            cer_detail_writer.write(
                "ref:" + "\t" + " ".join(list(map(lambda x: x.lower(), ref_dict[hyp_key]))) + "\n"
            )
            cer_detail_writer.write(
                "hyp:" + "\t" + " ".join(list(map(lambda x: x.lower(), hyp_dict[hyp_key]))) + "\n"
            )

    if rst["Wrd"] > 0:
        rst["Err"] = round(rst["wrong_words"] * 100 / rst["Wrd"], 2)
    if rst["Snt"] > 0:
        rst["S.Err"] = round(rst["wrong_sentences"] * 100 / rst["Snt"], 2)

    cer_detail_writer.write("\n")
    cer_detail_writer.write(
        "%WER "
        + str(rst["Err"])
        + " [ "
        + str(rst["wrong_words"])
        + " / "
        + str(rst["Wrd"])
        + ", "
        + str(rst["Ins"])
        + " ins, "
        + str(rst["Del"])
        + " del, "
        + str(rst["Sub"])
        + " sub ]"
        + "\n"
    )
    cer_detail_writer.write(
        "%SER "
        + str(rst["S.Err"])
        + " [ "
        + str(rst["wrong_sentences"])
        + " / "
        + str(rst["Snt"])
        + " ]"
        + "\n"
    )
    cer_detail_writer.write(
        "Scored "
        + str(len(hyp_dict))
        + " sentences, "
        + str(len(hyp_dict) - rst["Snt"])
        + " not present in hyp."
        + "\n"
    )


def compute_wer_by_line(hyp, ref):
    hyp = list(map(lambda x: x.lower(), hyp))
    ref = list(map(lambda x: x.lower(), ref))

    len_hyp = len(hyp)
    len_ref = len(ref)

    cost_matrix = np.zeros((len_hyp + 1, len_ref + 1), dtype=np.int16)

    ops_matrix = np.zeros((len_hyp + 1, len_ref + 1), dtype=np.int8)

    for i in range(len_hyp + 1):
        cost_matrix[i][0] = i
    for j in range(len_ref + 1):
        cost_matrix[0][j] = j

    for i in range(1, len_hyp + 1):
        for j in range(1, len_ref + 1):
            if hyp[i - 1] == ref[j - 1]:
                cost_matrix[i][j] = cost_matrix[i - 1][j - 1]
            else:
                substitution = cost_matrix[i - 1][j - 1] + 1
                insertion = cost_matrix[i - 1][j] + 1
                deletion = cost_matrix[i][j - 1] + 1

                compare_val = [substitution, insertion, deletion]

                min_val = min(compare_val)
                operation_idx = compare_val.index(min_val) + 1
                cost_matrix[i][j] = min_val
                ops_matrix[i][j] = operation_idx

    match_idx = []
    i = len_hyp
    j = len_ref
    rst = {"nwords": len_ref, "cor": 0, "wrong": 0, "ins": 0, "del": 0, "sub": 0}
    while i >= 0 or j >= 0:
        i_idx = max(0, i)
        j_idx = max(0, j)

        if ops_matrix[i_idx][j_idx] == 0:  # correct
            if i - 1 >= 0 and j - 1 >= 0:
                match_idx.append((j - 1, i - 1))
                rst["cor"] += 1

            i -= 1
            j -= 1

        elif ops_matrix[i_idx][j_idx] == 2:  # insert
            i -= 1
            rst["ins"] += 1

        elif ops_matrix[i_idx][j_idx] == 3:  # delete
            j -= 1
            rst["del"] += 1

        elif ops_matrix[i_idx][j_idx] == 1:  # substitute
            i -= 1
            j -= 1
            rst["sub"] += 1

        if i < 0 and j >= 0:
            rst["del"] += 1
        elif j < 0 and i >= 0:
            rst["ins"] += 1

    match_idx.reverse()
    wrong_cnt = cost_matrix[len_hyp][len_ref]
    rst["wrong"] = wrong_cnt

    return rst


def print_cer_detail(rst):
    return (
        "("
        + "nwords="
        + str(rst["nwords"])
        + ",cor="
        + str(rst["cor"])
        + ",ins="
        + str(rst["ins"])
        + ",del="
        + str(rst["del"])
        + ",sub="
        + str(rst["sub"])
        + ") corr:"
        + "{:.2%}".format(rst["cor"] / rst["nwords"])
        + ",cer:"
        + "{:.2%}".format(rst["wrong"] / rst["nwords"])
    )


if __name__ == "__main__":
    if len(sys.argv) != 4:
        print("usage : python compute-wer.py test.ref test.hyp test.wer")
        sys.exit(0)

    ref_file = sys.argv[1]
    hyp_file = sys.argv[2]
    cer_detail_file = sys.argv[3]
    compute_wer(ref_file, hyp_file, cer_detail_file)

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #3728** (2026-09-26): **load_pretrained_model deep-copies the whole state dict, doubling peak load memory**
  *Symptoms*: ## 🐛 Bug  `load_pretrained_model()` deep-copies the entire checkpoint state dict on every model load. The copy is redundant, and it holds a second full copy of the weights in memory for the duration of the load, so peak host memory is roughly doubled by the checkpoint size.  Loading `iic/speech_paraformer-large_asr_nat-zh-cn-16k-common-vocab8404-online` (220M params, 956 tensors, 840MB `model.pt`) peaks at **3461 MB** RSS. With the copy removed the same load peaks at **2624 MB** — a 837MB difference that matches the checkpoint size.  The practical consequence is that a model which fits in memory can still fail to load, and container memory limits have to be set to twice the checkpoint size.  ## To Reproduce  1. Install with: `pip install funasr modelscope kaldi-native-fbank` 2. Run: load any large checkpoint through `AutoModel` and sample peak RSS 3. See: no exception on a roomy host — the symptom is peak RSS; on a constrained host it is an OOM kill  ``` pip install funasr==1.4.16 modelscope kaldi-native-fbank  python - <<'PY' import resource, time from funasr import AutoModel  t0 = time.time() AutoModel(     model="iic/speech_paraformer-large_asr_nat-zh-cn-16k-common-vocab8404-online",     device="cpu",     disable_update=True, ) peak = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024 print(f"{time.time() - t0:.1f}s   peak RSS {peak:.0f} MB") PY ```  ## Code sample  `funasr/train_utils/load_pretrained_model.py`:  ```python ori_state = torch.load(path, map_location=
  **Post-Mortem & Fix Analysis**:
  > Fixed by #3729 and verified on exact merged main 9e7f6af8c30bc9ba5c4ce498f09af5dcef96e225. Focused loader tests pass 13/13, independent checkpoint-format probes pass 6/6, and the 128 MiB separate-process probe reduced peak RSS by about 143 MiB while preserving loaded values.

- **Issue #3723** (2026-09-19): **[Bug] Paraformer silently generates incorrect timestamps because CIF alphas and peaks are passed in reverse order**
  *Symptoms*: ## 🐛 Bug  `Paraformer.inference()` passes the two timestamp-related outputs from the CIF predictor to `ts_prediction_lfr6_standard()` in reverse order.  `calc_predictor()` returns:  ```python (acoustic_embeds, token_num, alphas, cif_peak) ```  but the current caller effectively does:  ```python ts_prediction_lfr6_standard(     timestamp_pre_peak_index,  # cif_peak     timestamp_alphas,          # alphas     copy.copy(token),     vad_offset=kwargs.get("begin_time", 0),     upsample_rate=1, ) ```  while the helper contract is:  ```python ts_prediction_lfr6_standard(us_alphas, us_peaks, char_list, ...) ```  Therefore CIF peaks are treated as alpha weights, and alpha weights are treated as peaks.  This normally does **not** raise an exception. The helper can enter its normalization fallback and still return the expected number of timestamp segments, so the result looks structurally valid while its boundaries are incorrect.  A fix with regression tests is already available in #3716.  ## To Reproduce  This deterministic example uses the real CIF implementation and the real timestamp helper:  ```python import torch  from funasr.models.paraformer.cif_predictor import cif from funasr.utils.timestamp_tools import ts_prediction_lfr6_standard  weights = [0.1, 0.1, 0.4, 0.6] + [0.0] * 4 + [0.1] * 10 alphas = torch.tensor([weights]) hidden = torch.zeros(1, len(weights), 2)  _, peaks = cif(hidden, alphas, threshold=1.0) tokens = ["你", "你"]  # Current Paraformer argument order _, current = 

- **Issue #3673** (2026-09-09): **1.4.13之后好像numpy的依赖出了问题**
  *Symptoms*: 我的项目依赖的numpy2.10，升级到1.4.12版都没有问题，然后使用uv升级到13、14，报如下错误：  > Because funasr>=1.4.13 depends on numpy<2 and xxx depends on funasr>=1.4.13, we can conclude that xxx       depends on numpy<2.       And because xxx depends on numpy>=2.4.0 and your workspace requires xxx, we can conclude that your       workspace's requirements are unsatisfiable.
  **Post-Mortem & Fix Analysis**:
  > 已确认这个依赖冲突，并在 #3674 合并修复：移除了 `numpy<2` 限制，同时修复相关旧类型别名、补充真实运行测试。合并提交为 `28fa5a4d6412002601aabba0f3b3218d74c00c96`。  我用旧主分支与修复源码做了相同 `numpy>=2.4.0` 约束的 pip 解析对照：旧源码报 `ResolutionImpossible`，修复源码可以正常解析。另在两个干净的 Linux/Python 3.12 CPU 环境分别验证 NumPy 1.26.4 和 2.4.0：两组 `pip check` 及各 23 项 GitHub CI 测试都通过，覆盖真实前端、masking、导入和说话人聚类路径。这不是对所有 Python/GPU/历史依赖组合的保证，也不是对你整个项目的 uv 锁文件复现。  **目前 PyPI 最新版仍是 1.4.14，发布包里的上限尚未改变。** 下一修复版按版本规则准备为 1.4.15，发布前还会验证实际 wheel/sdist 的安装与依赖；不会让你通过忽略依赖检查来绕过问题。这个 issue 继续保持开放，等发布后的安装/运行反馈再判断是否解决。 
  > FunASR **1.4.15 已发布到 [PyPI](https://pypi.org/project/funasr/1.4.15/)**，包含 #3674 的 NumPy 兼容性修复，不再要求 `numpy<2`。  最终发布的 wheel 和源码包已分别在 NumPy 2.4.0 / 1.26.4 环境安装验证，`pip check`、相关计算、导入和 CLI 检查通过；从 PyPI 实际下载的文件哈希也与验证产物一致。可以将项目中的 FunASR 约束更新到 `1.4.15` 后重新解析依赖；如果 uv 仍报冲突，请提供新的冲突链。这不等于已经复现并验证了你整个项目的锁文件。  [发布说明与校验清单](https://github.com/modelscope/FunASR/releases/tag/v1.4.15)。issue 保持开放，等待你的实际安装/运行反馈。
  > 1.4.15版可以正常升级了

- **Issue #3595** (2026-09-07): **Fun-ASR-Nano使用StreamingVLLM推理结果异常**
  *Symptoms*: ## 🐛 Bug 使用bf16类型推理结果异常。  ## To Reproduce 运行下面的 Python 脚本即可。 其中asr_example_zh.wav为Readme中的示例音频。 ## Code sample ```python from funasr.models.fun_asr_nano.inference_vllm_streaming import FunASRNanoStreamingVLLM   def main():     engine = FunASRNanoStreamingVLLM.from_pretrained(         model="FunAudioLLM/Fun-ASR-Nano-2512",         chunk_ms=50,         dtype='bf16',         rollback_chars=8,     )     for result in engine.streaming_generate("./asr_example_zh.wav", language="中文"):         if result["is_final"]:             print(f"Final: {result['text']}")         else:             print(f"[{result['audio_duration_ms']:.0f}ms] Confirmed: {result['fixed_text']}")  if __name__ == "__main__":     main() ```  ## Expected behavior  推理结果正常。  ## Error logs  推理的结果如下：  ```text [5350ms] Confirmed: !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!聪聪!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!! [5400ms] Confirmed: !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!聪聪!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
  **Post-Mortem & Fix Analysis**:
  > 感谢提供最小复现。我在同型号 H100 80GB 上用当前 `main@2b6294d69e6588a63c0ce06300f1b55ded71ae58`、同一份 README 示例音频、`dtype="bf16"`、`chunk_ms=50` 完成了 111 个累计 chunk 的复测，final 输出正常：  ```text 欢迎您来体验达摩院推出的语音识别模型。 ```  本次可复现实验使用 vLLM 0.10.2、Torch 2.8.0+cu128；完整日志 SHA-256 为 `e560de650e7dd7258af4065d7914ca1148b3a37def41a00dc78f99788ab51b4b`。因此目前不能把异常归因于 bf16 本身，也不会提前关闭 issue。  你使用的是 FunASR 1.4.2，而当前 PyPI 版本为 1.4.11。请先升级后用同一脚本复测，并补充 `python -c "import vllm; print(vllm.__version__)"` 的输出。你给出的 Torch 2.13.0 环境很可能对应不同的 vLLM 执行路径；拿到 exact vLLM 版本后我们会继续做同版本对照。 
  > @LauraGPT 这里有一个笔误，应该是使用fp16类型推理结果异常。 以下为更新后的复现代码，funasr版本为1.4.11，vllm版本为0.27.1，其余环境保持不变。  ```python from funasr.models.fun_asr_nano.inference_vllm_streaming import FunASRNanoStreamingVLLM   def main():     engine = FunASRNanoStreamingVLLM.from_pretrained(         model="FunAudioLLM/Fun-ASR-Nano-2512",         chunk_ms=50,         dtype='fp16',         rollback_chars=8,     )     for result in engine.streaming_generate("./asr_example_zh.wav", language="中文"):         if result["is_final"]:             print(f"Final: {result['text']}")         else:             print(f"[{result['audio_duration_ms']:.0f}ms] Confirmed: {result['fixed_text']}")  if __name__ == "__main__":     main() ```
  > I reproduced the corrected `dtype="fp16"` report on an H100: the public 5.55 s sample returned a long string of `!`. Split-dtype runs isolated the instability to the Qwen3 vLLM decoder rather than the audio encoder/adaptor.  I opened #3597 with a bounded fix: audio compute remains `torch.float16`, while the Qwen3 vLLM decoder uses `torch.bfloat16` (the same two-byte weight footprint). On exact signed head `881c396a2632c0b4336b5041de7197f9526e0951`, the same H100 sample returned:  ```text 欢迎您来体验达摩院推出的语音识别模型。 ```  The focused and related regression suite is 53/53 green. The available H100 host supports CUDA 12.8, so the reporter's exact vLLM 0.27.1 / PyTorch 2.13.0 CUDA 13 binary could not initialize here; I validated the original symptom and fix with vLLM 0.10.2 / PyTorch 2.8.0+cu128 and added constructor coverage for both offline and streaming paths.  I will keep this issue open through review/merge and until you can retest the merged or released build in your vLLM 0.27.1 environment.

- **Issue #3539** (2026-08-31): **srt断句功能智能化程度不高, 存在较大比例的明显不合理断句**
  *Symptoms*: 示例音频： http://devv.cc:8999/mp3/风波升级！上汽反水举报打脸韩红，救护车无授权，到底谁在说谎__xWT111.mp3  1、断句明显错误的： 148.93-149.83 就在八月二十五日， 150.01-151.93 上汽大通直接向平台发起投诉， 152.17-153.97 投诉对象是那些转述基金会。 154.03-155.05 声明的自媒体文章， 155.47-157.33 上汽大通的投诉内容写的很清楚，  中间的： 152.17-153.97 投诉对象是那些转述基金会。 154.03-155.05 声明的自媒体文章， 明显是错断的，既不符合vad断句规律，也与上下文语意不合，错的有点离谱；  2、不合理的算法逻辑： 有很多短句，甚至一、二字的语气词，不应该独立成句，即使是按vad论，前、后有较大空隙，从语言逻辑上来说，也不应该独立成句，而是应该根据语境语义、尽量选择并入上句或下句，如：  87.3-90.06 凭什么去承接涉及救命装备的数千万订单？ 90.36-90.66 以我看， 90.9-92.88 公益采购虽然不完全是商业买卖，  98.52-99.9 救护车上常用的呼吸机、 100.14-100.5 除颤仪， 100.62-101.58 属于二类医疗器械。  170.14-172.0 反而举报了转述消息的自媒体。 172.4-172.7 说实话， 172.82-175.1 这种操作在我看来多少有点避重就轻。  179.16-180.18 如果授权文件存在， 180.42-180.6 车企， 180.72-182.52 又为什么不敢直接点名基金会，  263.14-264.34 工益的底色是公开、 264.46-264.64 透明、 264.88-266.5 功劳不能抵消流程上的漏洞。  291.74-294.32 都意味着公益采购的新任链条出现了裂缝。 294.7-294.88 眼下， 295.12-295.96 调查正在进行，  上面每一组中的中间短句，都应该经过仔细判断后、选择并入下句或上句。  funasr已经升级到新的 1.4.3，其实这类问题一直存在，很奇怪为什么大家都能忍受。
  **Post-Mortem & Fix Analysis**:
  > 下面这条示例的问题更严重：  http://devv.cc:8999/mp3/捐10万上热搜“莫寒好人心”，赖1500万踩恩人演“悲情英雄”__罗永浩捐10万被全网吹成“仗义好人”，可他真正的底色是什么___官媒早已定性：叫同胞“支那人”、喊“太君.mp3  12.45-12.69 突然。 12.75-15.15 捐十万立刻被全网吹成仗义好人，  21.81-23.01 白纸黑字叫同胞， 23.07-23.97 知大人喊太君， 24.15-24.33 威武， 24.51-24.99 自认精神。 25.11-25.53 日本人说， 25.77-27.03 在中国生意是罪孽， 27.21-28.71 死后骨灰都要杀日本。  273.99-274.11 他说， 274.29-274.95 愿赌服输，  284.62-285.76 光恩负义就成了真性心， 285.88-286.9 金蝉脱胶就成了壮， 286.96-287.26 业不易， 287.62-288.04 赖照不还， 288.16-289.98 就成了愿赌服输什么时候开始？ （光恩负义、金蝉脱胶这类识别能力有点蠢爆了）
  > 这个 issue 之前在关联 PR 合并后被我过早关闭了，但报告者尚未确认实际样例已经解决。现重新打开。  后续以你给出的真实音频和断句结果作为验收依据：我们会先复核当前 main 对这些样例的输出，再说明哪些问题已改善、哪些仍未解决；在你确认或有可复现的修复证据并留出反馈时间之前，不再关闭。抱歉给你造成困扰。
  > 我已经按你提供的两段真实音频，在 **当前 main 精确提交 `ffa7b29bc6d4e49cf644e8f4d2c75d4ca4250694`** 上重新跑了一遍（FunASR 1.4.6，SenseVoiceSmall + FSMN-VAD + CT-Punc，H100，默认 SRT 分组）。这个 issue 保持打开。  复现证据：  - 样例 1 SHA256：`6561ee553c8f762aac4ebd65439d3414820761b547fa3a2edcea43b86a2abc02` - 样例 2 SHA256：`779899a3ce937dd7352b4db1ea53e3f6aa2cfef7109de0249082223c936f9372`  当前版本确实改善了“极短词单独成条”的问题。例如：  - 样例 1 的 `以我看` 已并入后句；`呼吸机、除颤仪，属于二类医疗器械。` 已合成一条；`说实话`、`车企`、`透明`、`眼下` 也不再单独成条。 - 样例 2 的 `突然。捐十万……` 已合成一条；21.81–24.99 的多个碎片已合成一条；`他说，愿赌服输` 已合成一条；284.62–289.98 已合成一条。  但你的报告 **还没有完全解决**：  1. 样例 1 在 153.97 / 154.03 仍把“那些转述基金会声明的自媒体文章”从中间切开，语义边界依然不合理。 2. 样例 2 虽然条目已经合并，但 `光恩负义`、`金蝉脱胶`、`壮业不易` 等是 ASR 词识别错误，SRT 分组本身不能修正。 3. 第一段里 `工益`、`新任链条` 等词级识别错误也仍存在。  因此，之前的修改只能认定为“减少短碎片”，不能认定为这个 issue 已解决。下一步我会把 **语义断句** 与 **模型词识别** 分开定位和验收；在修复证据完整并给你留出复测时间之前不会关闭。

- **Issue #3528** (2026-09-15): **1.4.3 的 funasr/bin/realtime_ws.py 的 run_session_work() 实现太简单粗暴，导致并发性能比1.3.9还差很多**
  *Symptoms*: 我在1个月前用的1.3.9， 后来项目结束就没再碰，今天注意到已经升级到 1.4.3 而且注意到 fun_asr_nano 的 ws 服务代码重构了，就测试一下它的性能，对比1.3.9 发现**并发性能反而全面下滑** （L20机器）， 这是一段 47秒音频测试结果 (测试脚本是之前用的)  ``` for n in 8 10 12 14 16; do    for rep in 1 2 3; do        python funasr-test-scripts/bench_streaming_ws.py \              --server ws://localhost:10095 \              --audio test-audio-sample/古人.wav --concurrency $n      done done ```   Sessions | 1.3.9 | 1.4.3 -- | -- | -- 8   | ✅ 8/8 · p50 48.4 · 1st 1.3 · RTFx 7.6 | ⚠️ 7-8/8 抖 · p50 72.3 · 1st 0.7 · RTFx 5.1 10 | ✅ 10/10 · p50 51.6 · RTFx 8.9 | ⚠️ 3-6/10 崩 · p50 ~70-79 · RTFx 5.9 12 | ✅ 12/12 · p50 54.8 · RTFx 10.0 | ❌ ALL FAILED 14 | ✅ 14/14 · p50 60.7 · RTFx 9.5 | ❌ ping timeout 16 | ✅ 16/16 · p50 64.8 · RTFx 10.7 | ❌ ping timeout  这个结果让我很意外，所以读了一下 [realtime_ws.py](https://github.com/modelscope/FunASR/blob/main/funasr/bin/realtime_ws.py#L1006) 代码，我觉得原因在  ``` async def run_session_work(args, operation, *operation_args, **operation_kwargs):     """Run blocking session work off-loop without concurrent shared-model access."""     lock = getattr(args, "_session_work_lock", None)     if lock is None:         lock = asyncio.Lock()         args._session_work_lock = lock      async with lock:         return await asyncio.to_thread(operation, *operation_args, **operation_kwargs) ```  你的注释写得很明白 ”Run blocking session work off-loop without concurrent shared-model access.“ 但问题是 ， args 是整个服务进程唯一的一份，所以 args._session_work_lock = 全进程一把锁,所有 WebSocket 连接、所有 session 共享，为了"不并发访问模型"，把所有东西都串行了——
  **Post-Mortem & Fix Analysis**:
  > I reproduced the v1.4.3 concurrency regression and opened #3529 with a fix. The process-wide session lock serialized all clients and prevented vLLM batching.  On one H100 80 GB per service with the same paced 47-second Chinese workload:  - 12 clients: STOP p95 19.83s -> 0.415s; aggregate 8.43x -> 11.57x - 16 clients: STOP p95 40.82s -> 10.05s; aggregate 8.56x -> 13.17x - 0 client errors in both candidate runs  The patch also isolates VAD session state while sharing encoder weights, keeps the batch worker alive after malformed requests, and adds 72 focused regression tests. I will follow the PR through CI and release.
  > The fix from #3529 is now available in [FunASR 1.4.4](https://github.com/modelscope/FunASR/releases/tag/v1.4.4) and on [PyPI](https://pypi.org/project/funasr/1.4.4/).  ```bash python -m pip install -U "funasr==1.4.4" ```  The GitHub release includes the wheel, source distribution, nine prebuilt llama.cpp/GGUF runtime archives, and a SHA-256 manifest.
  > 我马上对比测试 1.4.4 和 1.3.9 （还是L20） ，很遗憾对于 47s的长音频，1.4.4 依然是 all failed （1.3.9一直都是全过），如果换成是 25秒音频16路并发可以完成，进一步我发现如果关闭ping， 服务端 `--ws-ping-timeout 0`，客户端我的测试代码 `ping_interval=None` 这样，服务端完全算得完，只是比 1.3.9 慢约 19%（76.9s vs 64.7s），现在 1.4.4 比 1.3.9好的地方的低并发时候（比如8）的首词响应明显改善 。  但我要提一个我个人感受：我觉得对于funasr这样已经成熟用户群体的开源项目，现在修改代码有点太仓促，而且缺少必要的 code review和测试。 我记得我之前也开过一个文档的issue单，结果好像不到1个小时就提交PR。这让我感觉会不会关闭issue单都成了KPI的考核指标（说笑了）  回到这个修改本身，我还没想到问题在哪，但是是不是可以调大`max_queue`，另外修改的测试一定要多找找不同的GPU测试一下

- **Issue #3514** (2026-08-31): **[Bug / Performance] 长音频 preset_spk_num 绕过 large-N 防护并触发极高开销的谱聚类 / Long audio with preset_spk_num bypasses large-N clustering safeguard**
  *Symptoms*: ## 🐛 Bug  在使用 FunASR 的 speaker diarization 时，如果对长音频通过 `preset_spk_num` 指定明确的说话人数，会导致 `ClusterBackend` 绕过现有的 large-N 聚类保护逻辑，强制进入 Spectral Clustering。  对于本次约 **2 小时 16 分钟**的音频，最终产生：  ```text X.shape=torch.Size([10639, 192]), oracle_num=2 ```  此时 FunASR 会对超过一万条 speaker embeddings 构造 dense affinity / Laplacian matrix，并在：  ```python scipy.linalg.eigh() ```  中执行 dense eigendecomposition。  实际表现为：  * CPU 长时间满载； * worker 长时间无法释放； * 在队列式 ASR 服务中导致后续任务被阻塞； * 看起来类似“任务卡死”，但 profiler 显示进程实际上一直在 `scipy.linalg.eigh()` 中执行计算。  相同音频仅取消 `preset_spk_num=2` 后：  ```text X.shape=torch.Size([10639, 192]), oracle_num=None ```  即可正常完成，不再出现异常的 CPU 长时间占用。  ---  When using FunASR speaker diarization on long audio, specifying a known speaker count through `preset_spk_num` causes `ClusterBackend` to bypass the existing large-N clustering safeguard and forces Spectral Clustering.  For the reproduced audio, approximately **2h 16m 34s** long, the speaker clustering input becomes:  ```text X.shape=torch.Size([10639, 192]), oracle_num=2 ```  FunASR then constructs dense affinity / Laplacian matrices for more than ten thousand speaker embeddings and performs a dense eigendecomposition through:  ```python scipy.linalg.eigh() ```  In production this causes:  * sustained CPU saturation; * the worker remaining occupied for a very long time; * head-of-line blocking for subsequent ASR jobs; * behavior that appears to be a hung task, while profiling shows that the process is actively spending CPU time in `scipy.linalg
  **Post-Mortem & Fix Analysis**:
  > 之前在 #3516 合并后直接关闭了这个 issue，没有先请你用原始 2 小时音频复测，这是我处理得太快了，抱歉。现在重新打开。修复已把 large-N + known-K 从 dense spectral clustering 改为有界内存的 KMeans 路径，并已进入 FunASR 1.4.3 及后续版本。请在当前 1.4.6（或最新 main）下继续使用同一音频与 `preset_spk_num=2` 复测，重点确认不再进入 `scipy.linalg.eigh()`、CPU 占用和总耗时是否恢复正常。收到你的验证结果前保持开放。
  > 感谢修复。我已经对 PyPI 发布的 `funasr==1.4.3` wheel 完成验证。  使用与原故障相同规模的模拟 speaker embeddings和音频文件：  - `N=10639` - `D=192` - `oracle_num=2`  确认问题已经解决。  再次感谢快速修复，这个 Issue 可以保持关闭。
  > 感谢按原故障规模完成复测并明确确认。验收证据是公开 funasr==1.4.3 wheel 在 N=10639、D=192、oracle_num=2 下不再进入不可扩展的 dense spectral 路径，问题已解决。现在按报告者确认关闭；不是因为 PR 合并或版本发布自动关闭。

- **Issue #3468** (2026-08-31): **字幕功能的断句问题在最近两版升级中是否没有进化或被暂时搁置了?**
  *Symptoms*: 最近版本: 1.4.1 应该与系统无关  部分音频文件(示例文件在文末)会存在少量句子超长, 与正常情况有显著的差别:  00:00:00,750 --> 00:00:29,910 一个男人花了两千九百八十块给自己买了一张通往地域的单程票他建了一个群群名叫泽平宏观 v i p 群三十群四百九十四个人每人两千九百八十这一间教室收了一百四十七万而这样的教室他们有几十间他叫任泽 平前券商首席经济学家后来自己当了校长收学费的那种课程分三档两千九百八十的年度会员四万八千的商 学院十二万的司董会从兜里只有几万块的散户到身家过亿的企业老板  2 00:00:30,430 --> 00:01:00,070 他一个都不跳照单全收他卖的是什么不是客是一个故事二零二四年九月他开始讲信心牛科技牛二零二六年 还在喊 a i 不是风口是海啸算力芯片是核心主线六月市场跌了他说黄金坑七月初又跌了他说调整就是上车机会从头到尾他只说一个字买他不推个股只推赛道他不让你下单只要你相信你信了他己跑去买了得名利江 波龙  3 00:01:00,350 --> 00:01:00,800 加了杠杆  4 00:01:01,140 --> 00:01:01,860 满仓干进去  5 00:01:02,350 --> 00:01:03,670 七月中旬科技股暴跌  6 00:01:04,110 --> 00:01:05,010 得名利一字跌停  7 00:01:05,520 --> 00:01:05,820 连着跌  8 00:01:06,230 --> 00:01:06,710 股价腰斩  9 00:01:07,110 --> 00:01:08,130 你的账户触发强屏  对应的音频文件: http://devv.cc:8999/mp3/%E9%9C%87%E6%83%8A%E5%8C%97%E7%BE%8E%EF%BC%81103%20%E5%88%80%E5%88%BA%E5%90%91%E9%99%8C%E7%94%9F%E4%BA%BA%EF%BC%8C%E4%BB%96%E5%92%8C%E5%8F%B2%E6%B3%B0%E9%BE%99%E6%9C%89%E5%95%A5%E5%85%B3%E7%B3%BB_%23%E5%86%85%E5%AE%B9%E8%BF%87%E4%BA%8E%E7%9C%9F%E5%AE%9E%23%E7%A4%BE%E4%BC%9A%E7%99%BE%E6%80%81%23%E5%A8%B1%E4%B9%90%23%E7%83%AD%E9%97%A8%23%E6%AD%A3%E8%83%BD%E9%87%8F.mp3  类似的还有: http://devv.cc:8999/mp3/%E9%9C%87%E6%83%8A%E5%8C%97%E7%BE%8E%EF%BC%81103%20%E5%88%80%E5%88%BA%E5%90%91%E9%99%8C%E7%94%9F%E4%BA%BA%EF%BC%8C%E4%BB%96%E5%92%8C%E5%8F%B2%E6%B3%B0%E9%BE%99%E6%9C%89%E5%95%A5%E5%85%B3%E7%B3%BB_%23%E5%86%85%E5%AE%B9%E8%BF%87%E4%BA%8E%E7%9C%9F%E5%AE%9E%23%E7%A4%BE%E4%BC%9A%E7%99%BE%E6%80%81%23%E5%A8%B1%E4%B9%90%23%E7%83%AD%E9%97%A8%23%E6%A
  **Post-Mortem & Fix Analysis**:
  > 问题已经定位并修复，修复已合并到 `main`：#3469。  根因不是字幕断句功能被搁置，而是一个少见的时间戳对齐场景：ASR 将英文片段 `storyica` 作为一个带时间戳的单词返回，标点模型却把它拆成 `storyi` 和 `ca` 两个 token。1.4.1 的对齐逻辑只支持反方向的合并，因此对齐失败后退回到最长约 30 秒的 VAD 分段。  使用您提供的两份音频做了端到端回归：  - 出现问题的样本：字幕由 172 段变为 396 段，最长单段由 29.82 秒降为 8.82 秒，超过 10 秒的片段由 16 个降为 0；识别文字和整体起止时间保持不变。 - 另一份样本：修复前后的 SRT 文件逐字节一致。  修复会包含在下一个 PyPI 版本中；当前也可以从 `main` 使用该修复。感谢提供能够稳定复现问题的音频。 
  > 重新打开此 issue。此前在 #3469 合并后立即关闭，没有给报告者留下验证修复的时间，这个处理过快。请 @dearvcc 在包含该修复的发布版本或当前 main 上，用原始音频复测断句结果；在您确认问题解决前，本 issue 保持 open。您后来提交的 #3539 也表明字幕分组仍有进一步改进空间，我们会区分已修复的时间戳对齐回退与仍存在的语义断句问题，不把 PR 合并等同于用户问题已解决。
  > > 重新打开此 issue。此前在 [#3469](https://github.com/modelscope/FunASR/pull/3469) 合并后立即关闭，没有给报告者留下验证修复的时间，这个处理过快。请 [@dearvcc](https://github.com/dearvcc) 在包含该修复的发布版本或当前 main 上，用原始音频复测断句结果；在您确认问题解决前，本 issue 保持 open。您后来提交的 [#3539](https://github.com/modelscope/FunASR/issues/3539) 也表明字幕分组仍有进一步改进空间，我们会区分已修复的时间戳对齐回退与仍存在的语义断句问题，不把 PR 合并等同于用户问题已解决。  收到。我会重新测试新版在这些问题上的表现，然后根据结果选择继续或者转发在其它更匹配的分支issuse上。感谢作者的细心。

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

### Incident Patch 1: `be7557f2` (2026-09-30)
**Commit Message**: fix: stop timestamp_sentence_en reusing a stale sentence start (#3741)

When punc_id_list is longer than timestamp_postprocessed (a mismatch
the function already logs a warning for), the entries past the end of
timestamp_postprocessed get timestamp=None from zip_longest. For the
sentence that starts on one of those entries, the is_sentence_start
flag was consumed unconditionally on the first iteration regardless of
whether timestamp was None, so sentence_start kept whatever value was
left over from the previous, unrelated sentence instead of being
reported as unknown.

The sibling function timestamp_sentence already handles this correctly
by resetting sentence_start to None after each flush and only setting
it once a real timestamp shows up. Mirror that logic here instead of
the one-shot is_sentence_start flag.

Before: a trailing sentence whose first word has no timestamp gets
start reused from the previous sentence (wrong, looks valid).
After: start is None for that sentence, matching timestamp_sentence.

**File**: `funasr/utils/timestamp_tools.py` (modified, +3/-5)
```diff
@@ -263,9 +263,10 @@ def timestamp_sentence_en(
     punc_stamp_text_list = list(
         zip_longest(punc_id_list, timestamp_postprocessed, texts, fillvalue=None)
     )
-    is_sentence_start = True
     for punc_stamp_text in punc_stamp_text_list:
         punc_id, timestamp, text = punc_stamp_text
+        if sentence_start is None and timestamp is not None:
+            sentence_start = timestamp[0]
         # sentence_text += text if text is not None else ''
         if text is not None:
             if "a" <= text[0] <= "z" or "A" <= text[0] <= "Z":
@@ -283,11 +284,7 @@ def timestamp_sentence_en(
         sentence_end = timestamp[1] if timestamp is not None else sentence_end
         if sentence_text.startswith(" "):
             sentence_text = sentence_text[1:]
-        if is_sentence_start:
-            sentence_start = timestamp[0] if timestamp is not None else sentence_start
-            is_sentence_start = False
         if punc_id > 1:
-            is_sentence_start = True
             sentence_text += punc_list[punc_id - 2]
             if sentence_text_seg.endswith(" "):
                 sentence_text_seg = sentence_text_seg[:-1]
@@ -313,4 +310,5 @@ def timestamp_sentence_en(
             sentence_text = ""
             sentence_text_seg = ""
             ts_list = []
+            sentence_start = None
     return res
```

**File**: `tests/test_timestamp_tools.py` (modified, +17/-1)
```diff
@@ -1,4 +1,4 @@
-from funasr.utils.timestamp_tools import timestamp_sentence_en
+from funasr.utils.timestamp_tools import timestamp_sentence, timestamp_sentence_en
 
 
 def test_timestamp_sentence_en_handles_whitespace_only_segment():
@@ -37,3 +37,19 @@ def test_timestamp_sentence_en_preserves_normal_sentence_output():
             "raw_text": "hello world",
         }
     ]
+
+
+def test_timestamp_sentence_en_missing_trailing_timestamp_matches_zh_fallback():
+    # timestamp_postprocessed is one entry shorter than punc_id_list/text_postprocessed,
+    # the mismatch the function itself warns about. The second sentence ("bar.") has no
+    # timestamp for its only word, so its start must be reported as unknown (None),
+    # not silently reused from the previous, unrelated sentence.
+    punc_id_list = [1, 3, 3]
+    timestamp_postprocessed = [[0, 100], [100, 200]]
+    text_postprocessed = "hello world bar"
+
+    en_result = timestamp_sentence_en(punc_id_list, timestamp_postprocessed, text_postprocessed)
+    zh_result = timestamp_sentence(punc_id_list, timestamp_postprocessed, text_postprocessed)
+
+    assert en_result[1]["start"] is None
+    assert en_result[1]["start"] == zh_result[1]["start"]
```

---

### Incident Patch 2: `7b098ace` (2026-09-30)
**Commit Message**: fix(auto): warn when unavailable accelerators fall back to CPU (#3742)

fix(auto): warn when unavailable accelerators fall back to CPU

**File**: `funasr/auto/auto_model.py` (modified, +10/-1)
```diff
@@ -527,7 +527,8 @@ def __init__(self, **kwargs):
         Args:
             model (str): Model name (hub alias or full ID) or local path.
             device (str): Device for inference. "cuda:0", "cpu", "mps", "npu:0".
-                Falls back to CPU if specified device is unavailable.
+                Logs a warning and falls back to CPU if unavailable (default: "cuda").
+                Explicit CPU use or ngpu=0 does not emit a fallback warning.
             vad_model (str, optional): VAD model for long audio segmentation.
                 Enables processing of any-length audio.
             vad_kwargs (dict, optional): VAD config, e.g. {"device": "cpu"}.
@@ -673,6 +674,14 @@ def build_model(**kwargs):
             or (device.startswith("npu") and not is_npu_available())
             or kwargs.get("ngpu", 1) == 0
         ):
+            if kwargs.get("ngpu", 1) != 0:
+                logging.warning(
+                    "AutoModel: requested device '%s' is unavailable for model '%s'; "
+                    "falling back to CPU. Check your PyTorch build and accelerator "
+                    "availability, or set device='cpu' to use CPU explicitly.",
+                    device,
+                    kwargs["model"],
+                )
             device = "cpu"
             kwargs["batch_size"] = 1
         kwargs["device"] = device
```

**File**: `tests/test_submodel_device.py` (modified, +124/-0)
```diff
@@ -5,10 +5,12 @@
 """
 
 import copy
+import logging
 import unittest
 from unittest.mock import patch
 
 import numpy as np
+import pytest
 import torch
 
 from funasr.auto.auto_model import AutoModel
@@ -153,5 +155,127 @@ def test_unavailable_explicit_submodel_devices_fall_back_to_cpu(self):
             self.assertEqual(configs[role]["device"], "cuda:0")
 
 
+@pytest.fixture
+def fallback_model(monkeypatch):
+    from funasr.auto.auto_model import _current_blas_threads, _limit_blas_threads
+
+    original_threads = torch.get_num_threads()
+    original_blas = _current_blas_threads()
+    for role in ("asr", "vad", "punc", "spk"):
+        monkeypatch.setitem(tables.model_classes, f"device-test-{role}", RecordingModel)
+
+    def reject_download(**kwargs):
+        raise AssertionError("device tests must not access model hubs")
+
+    monkeypatch.setattr("funasr.auto.auto_model.download_model", reject_download)
+    with patch("funasr.auto.auto_model.ClusterBackend", create=True):
+        def build(**kwargs):
+            return AutoModel(
+                model="device-test-asr",
+                model_conf={},
+                ncpu=1,
+                disable_update=True,
+                disable_pbar=True,
+                **kwargs,
+            )
+
+        yield build
+    if original_blas is not None:
+        _limit_blas_threads(original_blas)
+    torch.set_num_threads(original_threads)
+
+
+_ACCELERATOR_PROBES = [
+    ("cuda:0", "torch.cuda.is_available"),
+    ("xpu:0", "torch.xpu.is_available"),
+    ("mps", "torch.backends.mps.is_available"),
+    ("npu:0", "funasr.auto.auto_model.is_npu_available"),
+]
+
+
+@pytest.mark.parametrize("device,probe", _ACCELERATOR_PROBES)
+def test_unavailable_accelerator_warns_and_preserves_cpu_fallback(
+    fallback_model, caplog, device, probe
+):
+    with patch(probe, return_value=False), caplog.at_level(logging.WARNING):
+        model = fallback_model(device=device, batch_size=8)
+    assert model.kwargs["device"] == model.model.placement == "cpu"
+    assert model.kwargs["batch_size"] == 1
+    assert len(caplog.records) == 1
+    assert caplog.records[0].levelno == logging.WARNING
+    message = caplog.records[0].getMessage()
+    assert device in message
+    assert "device-test-asr" in message
+    assert "falling back to CPU" in message
+    assert "PyTorch" in message
+
+
+@pytest.mark.parametrize("device,probe", _ACCELERATOR_PROBES)
+def test_available_accelerator_does_not_warn(fallback_model, caplog, device, probe):
+    with patch(probe, return_value=True), caplog.at_level(logging.WARNING):
+        model = fallback_model(device=device, batch_size=8)
+    assert model.kwargs["device"] == model.model.placement == device
+    assert model.kwargs["batch_size"] == 8
+    assert not caplog.records
+
+
+@pytest.mark.parametrize("device,probe", _ACCELERATOR_PROBES)
+@pytest.mark.parametrize("available", [False, True])
+def test_ngpu_zero_is_intentional_cpu_use(
+    fallback_model, caplog, device, probe, available
+):
+    with patch(probe, return_value=available), caplog.at_level(logging.WARNING):
+        model = fallback_model(device=device, ngpu=0, batch_size=8)
+    assert model.kwargs["device"] == model.model.placement == "cpu"
+    assert model.kwargs["batch_size"] == 1
+    assert not caplog.records
+
+
+def test_explicit_cpu_does_not_warn(fallback_model, caplog):
+    with caplog.at_level(logging.WARNING):
+        model = fallback_model(device="cpu", batch_size=8)
+    assert model.kwargs["device"] == model.model.placement == "cpu"
+    assert model.kwargs["batch_size"] == 8
+    assert not caplog.records
+
+
+def test_default_cuda_fallback_warns_once_with_inherited_submodels(fallback_model, caplog):
+    configs = {
+        f"{role}_{kind}": f"device-test-{role}" if kind == "model" else {"model_conf": {}}
+        for role in ("vad", "punc", "spk")
+        for kind in ("model", "kwargs")
+    }
+    original = copy.deepcopy(configs)
+    with patch("torch.c
```

---

### Incident Patch 3: `9c9067f3` (2026-09-30)
**Commit Message**: fix(auto): warn when unavailable accelerators fall back to CPU

Signed-off-by: LauraGPT <18321252+LauraGPT@users.noreply.github.com>

**File**: `funasr/auto/auto_model.py` (modified, +10/-1)
```diff
@@ -527,7 +527,8 @@ def __init__(self, **kwargs):
         Args:
             model (str): Model name (hub alias or full ID) or local path.
             device (str): Device for inference. "cuda:0", "cpu", "mps", "npu:0".
-                Falls back to CPU if specified device is unavailable.
+                Logs a warning and falls back to CPU if unavailable (default: "cuda").
+                Explicit CPU use or ngpu=0 does not emit a fallback warning.
             vad_model (str, optional): VAD model for long audio segmentation.
                 Enables processing of any-length audio.
             vad_kwargs (dict, optional): VAD config, e.g. {"device": "cpu"}.
@@ -673,6 +674,14 @@ def build_model(**kwargs):
             or (device.startswith("npu") and not is_npu_available())
             or kwargs.get("ngpu", 1) == 0
         ):
+            if kwargs.get("ngpu", 1) != 0:
+                logging.warning(
+                    "AutoModel: requested device '%s' is unavailable for model '%s'; "
+                    "falling back to CPU. Check your PyTorch build and accelerator "
+                    "availability, or set device='cpu' to use CPU explicitly.",
+                    device,
+                    kwargs["model"],
+                )
             device = "cpu"
             kwargs["batch_size"] = 1
         kwargs["device"] = device
```

**File**: `tests/test_submodel_device.py` (modified, +124/-0)
```diff
@@ -5,10 +5,12 @@
 """
 
 import copy
+import logging
 import unittest
 from unittest.mock import patch
 
 import numpy as np
+import pytest
 import torch
 
 from funasr.auto.auto_model import AutoModel
@@ -153,5 +155,127 @@ def test_unavailable_explicit_submodel_devices_fall_back_to_cpu(self):
             self.assertEqual(configs[role]["device"], "cuda:0")
 
 
+@pytest.fixture
+def fallback_model(monkeypatch):
+    from funasr.auto.auto_model import _current_blas_threads, _limit_blas_threads
+
+    original_threads = torch.get_num_threads()
+    original_blas = _current_blas_threads()
+    for role in ("asr", "vad", "punc", "spk"):
+        monkeypatch.setitem(tables.model_classes, f"device-test-{role}", RecordingModel)
+
+    def reject_download(**kwargs):
+        raise AssertionError("device tests must not access model hubs")
+
+    monkeypatch.setattr("funasr.auto.auto_model.download_model", reject_download)
+    with patch("funasr.auto.auto_model.ClusterBackend", create=True):
+        def build(**kwargs):
+            return AutoModel(
+                model="device-test-asr",
+                model_conf={},
+                ncpu=1,
+                disable_update=True,
+                disable_pbar=True,
+                **kwargs,
+            )
+
+        yield build
+    if original_blas is not None:
+        _limit_blas_threads(original_blas)
+    torch.set_num_threads(original_threads)
+
+
+_ACCELERATOR_PROBES = [
+    ("cuda:0", "torch.cuda.is_available"),
+    ("xpu:0", "torch.xpu.is_available"),
+    ("mps", "torch.backends.mps.is_available"),
+    ("npu:0", "funasr.auto.auto_model.is_npu_available"),
+]
+
+
+@pytest.mark.parametrize("device,probe", _ACCELERATOR_PROBES)
+def test_unavailable_accelerator_warns_and_preserves_cpu_fallback(
+    fallback_model, caplog, device, probe
+):
+    with patch(probe, return_value=False), caplog.at_level(logging.WARNING):
+        model = fallback_model(device=device, batch_size=8)
+    assert model.kwargs["device"] == model.model.placement == "cpu"
+    assert model.kwargs["batch_size"] == 1
+    assert len(caplog.records) == 1
+    assert caplog.records[0].levelno == logging.WARNING
+    message = caplog.records[0].getMessage()
+    assert device in message
+    assert "device-test-asr" in message
+    assert "falling back to CPU" in message
+    assert "PyTorch" in message
+
+
+@pytest.mark.parametrize("device,probe", _ACCELERATOR_PROBES)
+def test_available_accelerator_does_not_warn(fallback_model, caplog, device, probe):
+    with patch(probe, return_value=True), caplog.at_level(logging.WARNING):
+        model = fallback_model(device=device, batch_size=8)
+    assert model.kwargs["device"] == model.model.placement == device
+    assert model.kwargs["batch_size"] == 8
+    assert not caplog.records
+
+
+@pytest.mark.parametrize("device,probe", _ACCELERATOR_PROBES)
+@pytest.mark.parametrize("available", [False, True])
+def test_ngpu_zero_is_intentional_cpu_use(
+    fallback_model, caplog, device, probe, available
+):
+    with patch(probe, return_value=available), caplog.at_level(logging.WARNING):
+        model = fallback_model(device=device, ngpu=0, batch_size=8)
+    assert model.kwargs["device"] == model.model.placement == "cpu"
+    assert model.kwargs["batch_size"] == 1
+    assert not caplog.records
+
+
+def test_explicit_cpu_does_not_warn(fallback_model, caplog):
+    with caplog.at_level(logging.WARNING):
+        model = fallback_model(device="cpu", batch_size=8)
+    assert model.kwargs["device"] == model.model.placement == "cpu"
+    assert model.kwargs["batch_size"] == 8
+    assert not caplog.records
+
+
+def test_default_cuda_fallback_warns_once_with_inherited_submodels(fallback_model, caplog):
+    configs = {
+        f"{role}_{kind}": f"device-test-{role}" if kind == "model" else {"model_conf": {}}
+        for role in ("vad", "punc", "spk")
+        for kind in ("model", "kwargs")
+    }
+    original = copy.deepcopy(configs)
+    with patch("torch.c
```

---

### Incident Patch 4: `7f85ddd2` (2026-09-30)
**Commit Message**: fix(amp): resolve autocast/GradScaler device type for non-CUDA accelerators (#3735)

* fix(amp): resolve autocast/GradScaler device type for non-CUDA accelerators

funasr/utils/amp.py pinned device_type="cuda" in the torch.amp compatibility shim, so on Ascend NPU (and XPU/MPS) builds torch.amp only warned "CUDA is not available ... Disabling autocast" and the context became a no-op: use_fp16/use_bf16 training silently ran in float32 and GradScaler(enabled=True) was silently disabled.

Resolve the device type from the running accelerator (torch.accelerator), the same policy funasr/models/fun_asr_nano/device_utils.py already applies to the inference path, and keep "cuda" as the historical no-op default when no accelerator is available so CPU behaviour is unchanged. GradScaler prefers an accelerator-specific implementation (e.g. torch.npu.amp.GradScaler) when one exists.

Signed-off-by: li-lizhe <147392333@qq.com>

* fix(amp): honour an explicit device before choosing the GradScaler implementation

An explicit device (positional or keyword) now selects the scaler for that
device instead of the active accelerator, so GradScaler(device="cpu") no longer
reaches torch.npu.amp.GradScaler (

**File**: `funasr/utils/amp.py` (modified, +178/-6)
```diff
@@ -14,26 +14,198 @@
 
 Note: ``torch.amp.autocast`` requires a ``device_type`` argument (e.g.
 ``'cuda'``) that the deprecated ``torch.cuda.amp.autocast`` did not, so
-the shim supplies ``device_type="cuda"`` by default for callers that use
-the old signature (``with autocast(enabled=..., dtype=...)``).
+the shim resolves ``device_type`` for callers that use the old signature
+(``with autocast(enabled=..., dtype=...)``) — see
+``resolve_amp_device_type``. Callers that know the device can still pass
+``device_type=...`` explicitly.
+
+Device type resolution
+----------------------
+
+The deprecated ``torch.cuda.amp`` API could only target CUDA, so the first
+version of this shim pinned ``device_type="cuda"``. Off CUDA that is not an
+error: ``torch.amp`` only warns
+
+    UserWarning: CUDA is not available or torch_xla is imported. Disabling autocast.
+
+and the context becomes a no-op, so ``use_fp16``/``use_bf16`` training silently
+ran in float32 on Ascend NPU / XPU / MPS builds. ``GradScaler(enabled=True)``
+was silently disabled the same way, so loss scaling was missing too.
+
+Both now default to the accelerator that is actually active
+(``torch.accelerator``) — the same device types that
+``funasr/models/fun_asr_nano/device_utils.py`` accepts for the Nano inference
+path — and keep the historical ``"cuda"`` (a no-op on CPU-only builds) when no
+accelerator is available, so CPU behaviour is unchanged.
+
+An explicit device always wins over the detected accelerator:
+``GradScaler(device="cpu", enabled=False)`` and ``GradScaler("cpu", ...)``
+keep whichever implementation understands that device, exactly as the
+``torch.amp.GradScaler`` export they replace did. On an accelerator that ships
+its own scaler the ``device`` argument is consumed by this shim (that
+constructor takes no ``device``) while every other argument is translated by
+name, because those constructors do not share the generic positional order.
 """
 
 import torch
 
 torch_amp = getattr(torch, "amp", None)
+
+# Device types that FunASR is willing to enter an AMP context on; anything else
+# keeps the historical "cuda" no-op instead of risking an unsupported context.
+_ACCELERATOR_DEVICE_TYPES = ("cuda", "npu", "xpu", "mps")
+
+# Backends that ship their own AMP scaler. Everything else — including ``cpu``,
+# whose ``torch.cpu.amp`` is only a deprecated re-export of the generic scaler —
+# goes through ``torch.amp.GradScaler``.
+_NATIVE_SCALER_DEVICE_TYPES = ("npu", "xpu")
+
+# Parameter names of ``torch.amp.GradScaler``: ``device`` first, ``enabled``
+# last. A call written against the generic signature is bound by name before it
+# is dispatched to an accelerator-specific scaler, whose parameter order is not
+# the same (``torch_npu`` inserts ``dynamic`` before ``enabled``).
+_GENERIC_SCALER_PARAMETERS = (
+    "device",
+    "init_scale",
+    "growth_factor",
+    "backoff_factor",
+    "growth_interval",
+    "enabled",
+)
+
+
+def resolve_amp_device_type():
+    """Return the ``torch.amp`` device type of the active accelerator.
+
+    ``torch.accelerator`` reports the accelerator torch was built/registered
+    for (``cuda``/``npu``/``xpu``/``mps``); it is ``None`` on CPU-only builds,
+    where ``"cuda"`` is kept as the historical no-op default.
+    """
+    accelerator = getattr(torch, "accelerator", None)
+    if accelerator is not None:
+        try:
+            current = accelerator.current_accelerator()
+        except (AttributeError, RuntimeError):
+            current = None
+        device_type = getattr(current, "type", None) if current is not None else None
+        if device_type and str(device_type).lower() in _ACCELERATOR_DEVICE_TYPES:
+            return str(device_type).lower()
+    return "cuda"
+
+
+def _resolve_device_type(device):
+    """Return the device type of an explicitly passed device, or ``None``.
+
+    Accepts whatever ``torch.amp.GradScaler`` accepts (``str``, ``torch.device``),
+    so ``"npu"``, ``"cuda:0"`` and ``t
```

**File**: `tests/test_amp_device_type.py` (added, +369/-0)
```diff
@@ -0,0 +1,369 @@
+"""Regression tests for the device type used by the AMP shim.
+
+The shim used to pin ``device_type="cuda"``, which ``torch.amp`` turns into a
+silent no-op on any other accelerator (it only warns "CUDA is not available ...
+Disabling autocast"), so ``use_fp16``/``use_bf16`` training ran in float32 on
+Ascend NPU / XPU / MPS builds, and ``GradScaler(enabled=True)`` was silently
+disabled as well.
+"""
+
+import importlib.util
+import types
+from pathlib import Path
+
+import pytest
+import torch
+
+AMP_PATH = Path(__file__).resolve().parents[1] / "funasr" / "utils" / "amp.py"
+
+
+def _load_amp():
+    spec = importlib.util.spec_from_file_location("funasr_amp_device_type", AMP_PATH)
+    module = importlib.util.module_from_spec(spec)
+    assert spec.loader is not None
+    spec.loader.exec_module(module)
+    return module
+
+
+class _Device:
+    """Stand-in for a ``torch.device`` of a backend that may be unavailable."""
+
+    def __init__(self, device_type):
+        self.type = device_type
+
+
+class _Accelerator:
+    def __init__(self, device_type, error=None):
+        self._device_type = device_type
+        self._error = error
+
+    def current_accelerator(self):
+        if self._error is not None:
+            raise self._error
+        if self._device_type is None:
+            return None
+        return _Device(self._device_type)
+
+
+class _Recorder:
+    def __init__(self, result=None):
+        self.calls = []
+        self._result = result
+
+    def __call__(self, *args, **kwargs):
+        self.calls.append((args, kwargs))
+        return self._result
+
+
+def _patch_accelerator(monkeypatch, device_type, error=None):
+    monkeypatch.setattr(
+        torch, "accelerator", _Accelerator(device_type, error=error), raising=False
+    )
+
+
+@pytest.mark.parametrize(
+    "device_type,expected",
+    [("cuda", "cuda"), ("npu", "npu"), ("xpu", "xpu"), ("mps", "mps")],
+)
+def test_resolve_amp_device_type_keeps_the_active_accelerator(monkeypatch, device_type, expected):
+    amp = _load_amp()
+    _patch_accelerator(monkeypatch, device_type)
+
+    assert amp.resolve_amp_device_type() == expected
+
+
+@pytest.mark.parametrize("device_type", [None, "mtia", "meta"])
+def test_resolve_amp_device_type_falls_back_to_cuda(monkeypatch, device_type):
+    """No accelerator (CPU-only builds) keeps the historical no-op default."""
+    amp = _load_amp()
+    _patch_accelerator(monkeypatch, device_type)
+
+    assert amp.resolve_amp_device_type() == "cuda"
+
+
+def test_resolve_amp_device_type_survives_a_missing_or_failing_accelerator(monkeypatch):
+    amp = _load_amp()
+    _patch_accelerator(monkeypatch, "npu", error=RuntimeError("no accelerator compiled"))
+    assert amp.resolve_amp_device_type() == "cuda"
+
+    monkeypatch.delattr(torch, "accelerator", raising=False)
+    assert amp.resolve_amp_device_type() == "cuda"
+
+
+def test_autocast_resolves_the_device_type_for_the_legacy_signature(monkeypatch):
+    amp = _load_amp()
+    _patch_accelerator(monkeypatch, "npu")
+    recorder = _Recorder(result="ctx")
+    monkeypatch.setattr(amp, "_amp_autocast", recorder)
+
+    assert amp.autocast(enabled=True, dtype=torch.float16) == "ctx"
+    assert recorder.calls == [
+        (("npu",), {"dtype": torch.float16, "enabled": True, "cache_enabled": True})
+    ]
+
+
+def test_autocast_keeps_an_explicit_device_type(monkeypatch):
+    amp = _load_amp()
+    _patch_accelerator(monkeypatch, "npu")
+    recorder = _Recorder(result="ctx")
+    monkeypatch.setattr(amp, "_amp_autocast", recorder)
+
+    amp.autocast(False)
+    amp.autocast(True, torch.bfloat16, False, "cuda")
+    amp.autocast(enabled=False, device_type="cuda")
+
+    assert [args[0] for args, _ in recorder.calls] == ["npu", "cuda", "cuda"]
+
+
+def test_grad_scaler_prefers_the_accelerator_amp_module(monkeypatch):
+    amp = _load_amp()
+    _patch_accelerator(monkeypatch, "npu")
+    accelerator_scaler = _Recorder()
+    monkeypatch.setattr(
```

---

### Incident Patch 5: `a57cc3f9` (2026-09-29)
**Commit Message**: fix(sensevoice): keep words separate at standalone boundaries

Signed-off-by: LauraGPT <18321252+LauraGPT@users.noreply.github.com>

**File**: `funasr/models/sense_voice/model.py` (modified, +1/-0)
```diff
@@ -1093,6 +1093,7 @@ def post(self, timestamp):
             start = int(start * 1000)
             end = int(end * 1000)
             if word == "▁":
+                prev_word = None
                 continue
             if i == 0:
                 word = word[1:] if word.startswith("▁") else word
```

**File**: `tests/test_sensevoice_word_timestamps.py` (modified, +18/-0)
```diff
@@ -66,6 +66,24 @@
         pytest.param(
             ["A", "\u2581B", "C"], ["A", "BC"], [[0, 125], [125, 375]], id="word-boundary"
         ),
+        pytest.param(
+            ["Hello", "\u2581", "world"],
+            ["Hello", "world"],
+            [[0, 125], [250, 375]],
+            id="standalone-word-boundary",
+        ),
+        pytest.param(
+            ["\u2581Hel", "lo", "\u2581", "wor", "ld"],
+            ["Hello", "world"],
+            [[0, 250], [375, 625]],
+            id="subpieces-around-standalone-boundary",
+        ),
+        pytest.param(
+            ["Hello", "\u2581", "\u2581", "world"],
+            ["Hello", "world"],
+            [[0, 125], [375, 500]],
+            id="repeated-standalone-boundaries",
+        ),
     ],
 )
 def test_post_preserves_word_boundaries_and_timestamp_alignment(tokens, words, timestamps):
```

---

### Incident Patch 6: `2ddabb2c` (2026-09-29)
**Commit Message**: fix(sensevoice): normalize first word before joining subpieces

Signed-off-by: LauraGPT <18321252+LauraGPT@users.noreply.github.com>

**File**: `.github/workflows/test-numpy-compatibility.yml` (modified, +5/-0)
```diff
@@ -8,10 +8,12 @@ on:
       - "funasr/frontends/**"
       - "funasr/models/emotion2vec/**"
       - "funasr/models/campplus/**"
+      - "funasr/models/sense_voice/model.py"
       - "funasr/models/eend/utils/feature.py"
       - "tests/test_numpy_compatibility.py"
       - "tests/test_numpy_cluster_compatibility.py"
       - "tests/test_eend_feature_compatibility.py"
+      - "tests/test_sensevoice_word_timestamps.py"
       - "tests/test_pypi_metadata.py"
       - ".github/workflows/test-numpy-compatibility.yml"
   push:
@@ -22,10 +24,12 @@ on:
       - "funasr/frontends/**"
       - "funasr/models/emotion2vec/**"
       - "funasr/models/campplus/**"
+      - "funasr/models/sense_voice/model.py"
       - "funasr/models/eend/utils/feature.py"
       - "tests/test_numpy_compatibility.py"
       - "tests/test_numpy_cluster_compatibility.py"
       - "tests/test_eend_feature_compatibility.py"
+      - "tests/test_sensevoice_word_timestamps.py"
       - "tests/test_pypi_metadata.py"
       - ".github/workflows/test-numpy-compatibility.yml"
 
@@ -71,6 +75,7 @@ jobs:
             tests/test_numpy_cluster_compatibility.py \
             tests/test_eend_feature_compatibility.py \
             tests/test_pypi_metadata.py \
+            tests/test_sensevoice_word_timestamps.py \
             --junitxml=numpy-results.xml
       - uses: actions/upload-artifact@v4
         if: always()
```

**File**: `funasr/models/sense_voice/model.py` (modified, +1/-0)
```diff
@@ -1095,6 +1095,7 @@ def post(self, timestamp):
             if word == "▁":
                 continue
             if i == 0:
+                word = word[1:] if word.startswith("▁") else word
                 # timestamp_new.append([word, start, end])
                 timestamp_new.append([start, end])
                 words_new.append(word)
```

**File**: `tests/test_sensevoice_word_timestamps.py` (added, +81/-0)
```diff
@@ -0,0 +1,81 @@
+"""Word timestamps use the same SentencePiece boundaries for the first word."""
+
+from copy import deepcopy
+
+import pytest
+
+from funasr.models.sense_voice.model import SenseVoiceSmall
+
+
+@pytest.mark.parametrize(
+    ("tokens", "words", "timestamps"),
+    [
+        pytest.param(
+            ["\u2581Hello", "\u2581world", "."],
+            ["Hello", "world", "."],
+            [[0, 125], [125, 250], [250, 375]],
+            id="first-word-marker",
+        ),
+        pytest.param(
+            ["\u2581Hel", "lo", "\u2581world", "."],
+            ["Hello", "world", "."],
+            [[0, 250], [250, 375], [375, 500]],
+            id="first-word-subpieces",
+        ),
+        pytest.param(
+            ["Hel", "lo", "\u2581wor", "ld", "."],
+            ["Hello", "world", "."],
+            [[0, 250], [250, 500], [500, 625]],
+            id="unmarked-first-word-and-later-boundary",
+        ),
+        pytest.param(
+            ["\u2581", "\u2581Hel", "lo"],
+            ["Hello"],
+            [[125, 375]],
+            id="standalone-leading-marker",
+        ),
+        pytest.param(
+            ["\u2581", "Hel", "lo"],
+            ["Hello"],
+            [[125, 375]],
+            id="standalone-marker-before-unmarked-word",
+        ),
+        pytest.param(
+            ["\u2581\u4f60", "\u597d", "\u3002"],
+            ["\u4f60", "\u597d", "\u3002"],
+            [[0, 125], [125, 250], [250, 375]],
+            id="chinese-first-word",
+        ),
+        pytest.param(
+            ["\u2581Hello", "\u4e16", "\u754c"],
+            ["Hello", "\u4e16", "\u754c"],
+            [[0, 125], [125, 250], [250, 375]],
+            id="mixed-script-boundaries",
+        ),
+        pytest.param(["\u2581", "\u2581"], [], [], id="only-markers"),
+        pytest.param([], [], [], id="empty"),
+        pytest.param(
+            ["under\u2581score"], ["under\u2581score"], [[0, 125]], id="nonleading-marker"
+        ),
+        pytest.param(
+            ["\u2581I'm", "\u2581here", "."],
+            ["I'm", "here", "."],
+            [[0, 125], [125, 250], [250, 375]],
+            id="preserve-punctuation",
+        ),
+        pytest.param(
+            ["A", "\u2581B", "C"], ["A", "BC"], [[0, 125], [125, 375]], id="word-boundary"
+        ),
+    ],
+)
+def test_post_preserves_word_boundaries_and_timestamp_alignment(tokens, words, timestamps):
+    token_timestamps = [[token, index / 8, (index + 1) / 8] for index, token in enumerate(tokens)]
+    original = deepcopy(token_timestamps)
+
+    # post uses no model state; importing the real class requires no checkpoint.
+    result_timestamps, result_words = SenseVoiceSmall.post(None, token_timestamps)
+
+    assert result_words == words
+    assert result_timestamps == timestamps
+    assert len(result_words) == len(result_timestamps)
+    assert token_timestamps == original
```

---

### Incident Patch 7: `f950854d` (2026-09-29)
**Commit Message**: fix(website): correct LiteLLM transcription route and guards

Signed-off-by: LauraGPT <18321252+LauraGPT@users.noreply.github.com>

**File**: `docs/community_growth_20k.md` (modified, +2/-2)
```diff
@@ -266,7 +266,7 @@ High-star feature requests and roadmap issues are earlier in the funnel than PRs
 | `deepset-ai/haystack-core-integrations#3572` FunASR-Haystack Python 3.14 installation | Removes an installation scare in Haystack's integration catalog that can prevent new users from trying FunASR | A current Windows CPython 3.14 resolver check succeeds with `funasr 1.3.14`, `umap-learn 0.5.12`, `pynndescent 0.6.0`, `numba 0.66.0`, and `llvmlite 0.48.0`; the reported `llvmlite 0.36.0` path is therefore more consistent with a stale lock or lagging package index than the current dependency graph. Diagnostic commands and requested lock/index evidence are at https://github.com/deepset-ai/haystack-core-integrations/issues/3572#issuecomment-4965365012. Do not change core packaging until the reporter provides a current failing resolution. |
 | `crewAIInc/crewAI#5983` FunASR for voice-enabled agents | Routes a 55k-star multi-agent framework toward a provider-neutral voice command path where FunASR/SenseVoice can be a local OpenAI-compatible transcription backend | LauraGPT revived the stale broad request with a concrete `voice.stt.*` config, multipart `/v1/audio/transcriptions` contract, mock endpoint test shape, and agent-command handoff at https://github.com/crewAIInc/crewAI/issues/5983#issuecomment-4901293351. Watch for maintainer direction before opening a code PR. |
 | `Significant-Gravitas/AutoGPT#13347` FunASR as an open-source STT backend | Keeps the 185k-star AutoGPT voice-input discussion anchored on a generic OpenAI-compatible transcription contract rather than a heavyweight FunASR-only dependency | LauraGPT mapped the existing hard-coded Copilot Whisper route, then opened PR `Significant-Gravitas/AutoGPT#13500` and linked it back at https://github.com/Significant-Gravitas/AutoGPT/issues/13347#issuecomment-4908286807. The PR later merged, so keep this as a completed high-visibility OpenAI-compatible STT contract win rather than an active operator item. |
-| `modelscope/FunASR#3334/#3350/#3361/#3362/#3363/#3366/#3398` owned conversion and link hygiene | Protects owned website, docs, runtime, model_zoo, and first-run troubleshooting surfaces that already send qualified traffic to the four repositories | Merged on 2026-07-23 and hardened again after the donor-page and troubleshooting reviews. `scripts/check_funasr_website_static.py` now patrols 14 public pages across home, ecosystem, donor, CLI tutorial, llama.cpp landing, llama.cpp blog, and launch-story surfaces. It requires the current `35K+` ecosystem proof, visible donor copy saying donations buy servers and the `www.funasr.com` domain, LiteLLM `custom_openai` routing, `funasr >= 1.3.26` CLI guidance, and `runtime-llamacpp-v0.1.9` download paths, including the Windows Vulkan ZIP, while forbidding stale `16K+`, `1.3.10`, and `runtime-llamacpp-v0.1.1` regressions. PRs #3361-#3363 refreshed high-traffic runtime download commands, package/help metadata, model_zoo Hugging Face links, and verified core ModelScope entries from stale `alibaba-damo-academy` / `damo` paths to current `modelscope/FunASR` / `iic` pages. `modelscope/FunASR#3366` then added README-linked install and deployment FAQs at [`docs/troubleshooting.md`](./troubleshooting.md) and [`docs/troubleshooting_zh.md`](./troubleshooting_zh.md), covering `torch` / `torchaudio`, ModelScope versus Hugging Face downloads, `funasr-server` `/v1/audio/transcriptions`, `WebSocket` realtime checks, `llama.cpp` / `GGUF`, and `Deployment Help` issue details. Post-merge validation passed the static contract suite, docs link guards, FAQ guards, real public website contract runs across all 14 pages, and HTTP 200 checks for updated owned/model links. |
+| `modelscope/FunASR#3334/#3350/#3361/#3362/#3363/#3366/#3398` owned conversion and link hygiene | Protects owned website, docs, runtime, model_zoo, and first-run troubleshooting surfaces that already send qualified traffic to the four repositories | Historical July 2026 record: the
```

**File**: `scripts/check_funasr_website_static.py` (modified, +30/-48)
```diff
@@ -16,9 +16,7 @@
 
 
 BASE_URL = "https://www.funasr.com"
-DONOR_PAGE_URLS = frozenset(
-    (f"{BASE_URL}/donors.html", f"{BASE_URL}/en/donors.html")
-)
+DONOR_PAGE_URLS = frozenset((f"{BASE_URL}/donors.html", f"{BASE_URL}/en/donors.html"))
 
 
 @dataclass(frozen=True)
@@ -57,13 +55,18 @@ class StaticAssetContract:
     ),
     f"{BASE_URL}/ecosystem.html": PageContract(
         required=(
-            "36K+",
+            "37K+",
             "/donors.html",
             "LiteLLM",
-            "custom_openai",
             "54.3K stars",
         ),
+        visible_required=("api_base",),
         visible_patterns=(
+            ("openai/sensevoice", r"(?<![\w/])openai/sensevoice(?![\w./+-])"),
+            (
+                "http://127.0.0.1:8000/v1",
+                r"(?<![\w/])http://127\.0\.0\.1:8000/v1(?![\w/?#.:+-])",
+            ),
             ("FunASR 官方插件 0.1.1", r"FunASR 官方插件 0\.1\.1(?![\w.+-])"),
             ("最大 25 MB 音频上传", r"最大 (?<!\d)25 MB 音频上传"),
         ),
@@ -75,17 +78,22 @@ class StaticAssetContract:
             "https://github.com/0xShug0/audio.cpp/blob/1778b23a5f6a4951c788e4bb0e7baa04f20012a2/docs/models/fun_asr_nano.md",
             "https://github.com/RVC-Boss/GPT-SoVITS/pull/2824",
         ),
-        forbidden=("16K+",),
+        forbidden=("16K+", "custom_openai", "openai/FunAudioLLM/SenseVoiceSmall"),
     ),
     f"{BASE_URL}/en/ecosystem.html": PageContract(
         required=(
-            "36K+",
+            "37K+",
             "/en/donors.html",
             "LiteLLM",
-            "custom_openai",
             "54.3K stars",
         ),
+        visible_required=("api_base",),
         visible_patterns=(
+            ("openai/sensevoice", r"(?<![\w/])openai/sensevoice(?![\w./+-])"),
+            (
+                "http://127.0.0.1:8000/v1",
+                r"(?<![\w/])http://127\.0\.0\.1:8000/v1(?![\w/?#.:+-])",
+            ),
             ("FunASR plugin 0.1.1", r"FunASR plugin 0\.1\.1(?![\w.+-])"),
             ("25 MB uploads", r"(?<!\d)25 MB uploads"),
         ),
@@ -97,7 +105,7 @@ class StaticAssetContract:
             "https://github.com/0xShug0/audio.cpp/blob/1778b23a5f6a4951c788e4bb0e7baa04f20012a2/docs/models/fun_asr_nano.md",
             "https://github.com/RVC-Boss/GPT-SoVITS/pull/2824",
         ),
-        forbidden=("16K+",),
+        forbidden=("16K+", "custom_openai", "openai/FunAudioLLM/SenseVoiceSmall"),
     ),
     f"{BASE_URL}/donors.html": PageContract(
         required=(
@@ -444,9 +452,7 @@ def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None
         tag = tag.lower()
         attributes = {name.lower(): value for name, value in attrs}
         hidden = (
-            self._parent_hidden
-            or tag in _HIDDEN_TAGS
-            or self._has_hidden_attribute(attributes)
+            self._parent_hidden or tag in _HIDDEN_TAGS or self._has_hidden_attribute(attributes)
         )
         if not hidden:
             if tag == "img" and attributes.get("src"):
@@ -460,9 +466,7 @@ def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> N
         tag = tag.lower()
         attributes = {name.lower(): value for name, value in attrs}
         hidden = (
-            self._parent_hidden
-            or tag in _HIDDEN_TAGS
-            or self._has_hidden_attribute(attributes)
+            self._parent_hidden or tag in _HIDDEN_TAGS or self._has_hidden_attribute(attributes)
         )
         if not hidden and tag == "img" and attributes.get("src"):
             self.images.add(attributes["src"])
@@ -541,10 +545,7 @@ def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None
         tag = tag.lower()
         attributes = {name.lower(): value for name, value in attrs}
         if not self._stack:
-            is_navigation = (
-                tag == "div"
-                and "nav-links" in (attributes.get("class") or "").split()
-            )
+            is_navigation = tag
```

**File**: `tests/test_check_funasr_website_static.py` (modified, +120/-64)
```diff
@@ -50,31 +50,31 @@ def test_website_contract_accepts_current_public_copy():
             vLLM Acceleration
         """,
         "https://www.funasr.com/ecosystem.html": """
-            <div class="stat-num">36K+</div>
+            <div class="stat-num">37K+</div>
             <a href="/donors.html">功德榜</a>
             <a href="https://github.com/BerriAI/litellm">LiteLLM</a>
             <a href="https://github.com/modelscope/FunClip/releases/tag/v2.1.1">FunClip v2.1.1</a>
             <a href="https://github.com/0xShug0/audio.cpp">audio.cpp</a>
             <a href="https://github.com/0xShug0/audio.cpp/pull/155">merged PR</a>
             <a href="https://github.com/0xShug0/audio.cpp/blob/1778b23a5f6a4951c788e4bb0e7baa04f20012a2/docs/models/fun_asr_nano.md">pinned guide</a>
             <a href="https://github.com/RVC-Boss/GPT-SoVITS/pull/2824">merged Transformers fix</a>
-            <div>custom_openai</div>
+            <div>openai/sensevoice api_base: http://127.0.0.1:8000/v1</div>
             <div>54.3K stars</div>
             <a href="https://marketplace.dify.ai/plugin/langgenius/funasr">
                 FunASR 官方插件 0.1.1
             </a>
             <div>支持最大 25 MB 音频上传</div>
         """,
         "https://www.funasr.com/en/ecosystem.html": """
-            <div class="stat-num">36K+</div>
+            <div class="stat-num">37K+</div>
             <a href="/en/donors.html">Thanks</a>
             <a href="https://github.com/BerriAI/litellm">LiteLLM</a>
             <a href="https://github.com/modelscope/FunClip/releases/tag/v2.1.1">FunClip v2.1.1</a>
             <a href="https://github.com/0xShug0/audio.cpp">audio.cpp</a>
             <a href="https://github.com/0xShug0/audio.cpp/pull/155">merged PR</a>
             <a href="https://github.com/0xShug0/audio.cpp/blob/1778b23a5f6a4951c788e4bb0e7baa04f20012a2/docs/models/fun_asr_nano.md">pinned guide</a>
             <a href="https://github.com/RVC-Boss/GPT-SoVITS/pull/2824">merged Transformers fix</a>
-            <div>custom_openai</div>
+            <div>openai/sensevoice api_base: http://127.0.0.1:8000/v1</div>
             <div>54.3K stars</div>
             <a href="https://marketplace.dify.ai/plugin/langgenius/funasr">
                 FunASR plugin 0.1.1
@@ -277,9 +277,22 @@ def test_homepage_contract_accepts_current_product_site_build(tmp_path, monkeypa
     assert checker.validate_pages(pages) == []
 
 
-def test_llamacpp_comparison_contract_accepts_current_product_site_build(
-    tmp_path, monkeypatch
-):
+def test_ecosystem_contract_accepts_current_product_site_build(tmp_path, monkeypatch):
+    checker = _load_module()
+    builder = _load_product_site_builder()
+    builder.build(tmp_path)
+    routes = ("ecosystem.html", "en/ecosystem.html")
+    pages = {
+        f"https://www.funasr.com/{route}": (tmp_path / route).read_text(encoding="utf-8")
+        for route in routes
+    }
+    monkeypatch.setattr(
+        checker, "PAGE_CONTRACTS", {url: checker.PAGE_CONTRACTS[url] for url in pages}
+    )
+    assert checker.validate_pages(pages) == []
+
+
+def test_llamacpp_comparison_contract_accepts_current_product_site_build(tmp_path, monkeypatch):
     checker = _load_module()
     builder = _load_product_site_builder()
     builder.build(tmp_path)
@@ -288,9 +301,7 @@ def test_llamacpp_comparison_contract_accepts_current_product_site_build(
         "en/blog/funasr-llama-cpp-whisper-cpp-alternative.html",
     )
     pages = {
-        f"https://www.funasr.com/{route}": (tmp_path / route).read_text(
-            encoding="utf-8"
-        )
+        f"https://www.funasr.com/{route}": (tmp_path / route).read_text(encoding="utf-8")
         for route in routes
     }
     monkeypatch.setattr(
@@ -326,7 +337,7 @@ def test_ecosystem_contract_requires_current_release_and_native_runtime():
         "https://www.funasr.com/en/ecosystem.html",
     ):
         contract = checker.PAGE_CONTRACTS[url]
-        assert "36K+" in contract.required
+        asser
```

**File**: `web-pages/product-site/content/legacy-manifest.json` (modified, +2/-2)
```diff
@@ -53,7 +53,7 @@
     "css/index.1682178c.css": "b5f6034ce886c25773928c114e4290d1c491a3d081677b488810198efd76b4e1",
     "decoder.js": "f2023a28036b1ff58e5bdabbb72ea427f8faaf60e89acd78ff183c313bdb0a2c",
     "donors.html": "eec6b789b29c27d372925ae0ad3e13d4c6e62978b3c38c4da9e3aec129f10934",
-    "ecosystem.html": "de151aebb8d807b21e719d59a54766f4998945310c97bbabf2ac31dae5c0a283",
+    "ecosystem.html": "a3cdaf0fefdc10fd51e8f09c3239e338528f4700e0037c2eb9556d650f6faef9",
     "en/blog/cantonese-speech-recognition.html": "b9bd146198206f781c37f341c370a690dc83cd7163334e34b4e7f65e69af8ff2",
     "en/blog/chinese-speech-recognition.html": "16b68bd2a1122236c580c62275002ae2c0875ca14e32686e88d3b5ccfa9f56ef",
     "en/blog/fun-asr-nano-guide.html": "1746c708bd0606188de4266d8255984dd9e14634af33c54ad65a5f05b767be1b",
@@ -91,7 +91,7 @@
     "en/blog/voice-activity-detection-python.html": "d12f5d0f4ae07c3434f6188d12f5603b8abb9578413b79133668638d1c5e18a7",
     "en/blog/which-funasr-model.html": "1207180aa929a3aa51db136c1098f4edc8f07405e2b56fe033998bf996f8ec7f",
     "en/donors.html": "eacb7f9434b1b29e13e9b0175bb9680556ee72ab4dbd155e68f9c912eb0212b1",
-    "en/ecosystem.html": "81cec9464db159189ef29df884b124c795fce01ef08bfaae03d982696de13701",
+    "en/ecosystem.html": "38356f6bdb5cd89988304be61f13707f4df9fa84c2a191701aaee475d7587902",
     "en/index.html": "d86effc3bf4d218eabd465cbbe026f62c98dd50110ddd58251d9d271a64882a2",
     "en/llama-cpp.html": "dbfbd125ebbf07f7d923c91b122818f8b09484ce54c1e80eba66a89d22dfb5b4",
     "en/models.html": "9806d01ba1807c2a6a88f7232102e185426fb8458bf51e1d7a8ce872352e1fd1",
```

**File**: `web-pages/product-site/legacy/ecosystem.html` (modified, +1/-1)
```diff
@@ -276,7 +276,7 @@ <h2>AI 平台与框架</h2>
 <div class="card">
 <div class="card-title"><a href="https://github.com/BerriAI/litellm">LiteLLM</a></div>
 <div class="card-stars">54.3K stars</div>
-<div class="card-desc">OpenAI 兼容 AI Gateway。FunASR / SenseVoice 可通过 <code>custom_openai</code> 作为自托管语音转写端点接入。</div>
+<div class="card-desc">OpenAI 兼容 AI Gateway。使用 <code>openai/sensevoice</code>，并显式设置 <code>api_base: http://127.0.0.1:8000/v1</code>，可接入同机自托管的 FunASR 转写服务。<code>sensevoice</code> 是服务模型别名，不是 checkpoint 仓库 ID；容器部署需使用容器内可访问的服务地址。<a href="https://github.com/BerriAI/litellm-docs/pull/610">配置文档 PR</a> 尚待上游合并。</div>
 <div><span class="card-tag">AI Gateway</span><span class="card-tag">OpenAI 兼容</span></div>
 </div>
 <div class="card">
```

---

### Incident Patch 8: `e7006a93` (2026-09-28)
**Commit Message**: fix: count speaker overlap once per diarization segment

Signed-off-by: LauraGPT <18321252+LauraGPT@users.noreply.github.com>

**File**: `.github/workflows/test-moss-adapter.yml` (modified, +6/-0)
```diff
@@ -4,6 +4,8 @@ on:
   pull_request:
     paths:
       - "funasr/models/moss_transcribe_diarize/**"
+      - "funasr/models/campplus/utils.py"
+      - "tests/test_campplus_utils.py"
       - "funasr/auto/auto_model.py"
       - "funasr/bin/_server_app.py"
       - "funasr/bin/server.py"
@@ -21,6 +23,8 @@ on:
       - main
     paths:
       - "funasr/models/moss_transcribe_diarize/**"
+      - "funasr/models/campplus/utils.py"
+      - "tests/test_campplus_utils.py"
       - "funasr/auto/auto_model.py"
       - "funasr/bin/_server_app.py"
       - "funasr/bin/server.py"
@@ -58,6 +62,7 @@ jobs:
       - name: Check formatting and syntax
         run: |
           python -m black --check \
+            tests/test_campplus_utils.py \
             funasr/models/moss_transcribe_diarize/model.py \
             tests/test_moss_transcribe_diarize_model.py \
             tests/test_moss_transcribe_diarize_docs.py \
@@ -71,6 +76,7 @@ jobs:
       - name: Run adapter and documentation contracts
         run: |
           python -m pytest -q \
+            tests/test_campplus_utils.py \
             tests/test_moss_transcribe_diarize_model.py \
             tests/test_moss_transcribe_diarize_docs.py \
             tests/test_server_app_openai_segments.py \
```

**File**: `funasr/models/campplus/utils.py` (modified, +9/-14)
```diff
@@ -254,26 +254,21 @@ def smooth(res, mindur=0.7):
 
 
 def distribute_spk(sentence_list, sd_time_list):
-    """Distribute spk.
-    
-        Args:
-            sentence_list: TODO.
-            sd_time_list: TODO.
-        """
+    """Assign each sentence to the speaker with the greatest total overlap.
+
+    Sentence times are milliseconds; diarization times are seconds. Equal
+    totals retain the first overlapping speaker, and no overlap defaults to 0.
+    """
     sd_time_list = [(spk_st * 1000, spk_ed * 1000, spk) for spk_st, spk_ed, spk in sd_time_list]
     for d in sentence_list:
         sentence_start = d['start']
         sentence_end = d['end']
-        sentence_spk = 0
-        max_overlap = 0
+        speaker_overlaps = {}
         for spk_st, spk_ed, spk in sd_time_list:
             overlap = max(min(sentence_end, spk_ed) - max(sentence_start, spk_st), 0)
-            if overlap > max_overlap:
-                max_overlap = overlap
-                sentence_spk = spk
-            if overlap > 0 and sentence_spk == spk:
-                max_overlap += overlap
-        d['spk'] = int(sentence_spk)
+            if overlap > 0:
+                speaker_overlaps[spk] = speaker_overlaps.get(spk, 0) + overlap
+        d['spk'] = int(max(speaker_overlaps, key=speaker_overlaps.get, default=0))
     return sentence_list
 
 
```

**File**: `tests/test_campplus_utils.py` (added, +71/-0)
```diff
@@ -0,0 +1,71 @@
+"""Speaker assignment uses the actual overlap with each sentence."""
+
+from itertools import permutations
+
+import numpy as np
+import pytest
+
+from funasr.models.campplus.utils import distribute_spk
+
+
+def test_distribute_spk_does_not_double_count_the_first_overlap():
+    sentences = [{"start": 0, "end": 10000, "text": "first and second"}]
+
+    result = distribute_spk(sentences, [(0, 4, 0), (4, 10, 1)])
+
+    assert result == [{"start": 0, "end": 10000, "text": "first and second", "spk": 1}]
+
+
+@pytest.mark.parametrize(
+    "timeline",
+    list(permutations([(0, 2, 7), (2, 5, 9), (5, 7, 7), (7, 10, 9)])),
+)
+def test_distribute_spk_totals_nonconsecutive_turns_independent_of_order(timeline):
+    sentences = [{"start": 0, "end": 10000}]
+
+    assert distribute_spk(sentences, timeline) == [{"start": 0, "end": 10000, "spk": 9}]
+
+
+@pytest.mark.parametrize(
+    ("timeline", "expected"),
+    [
+        ([(0, 2, 7), (2, 7, 9), (7, 10, 7)], 7),
+        ([(2, 7, 9), (0, 2, 7), (7, 10, 7)], 9),
+        ([(-2, 0, 9), (0, 5, 7), (5, 10, 9)], 7),
+    ],
+)
+def test_distribute_spk_breaks_total_ties_by_first_positive_overlap(timeline, expected):
+    assert distribute_spk([{"start": 0, "end": 10000}], timeline) == [
+        {"start": 0, "end": 10000, "spk": expected}
+    ]
+
+
+def test_distribute_spk_clips_to_each_sentence_and_preserves_objects():
+    first = {"start": 4000, "end": 6000, "text": "clipped", "spk": 99}
+    second = {"start": 6000, "end": 7000, "timestamp": [[6000, 7000]]}
+    sentences = [first, second]
+    timeline = [(0, 4, 8), (4, 5.5, np.int64(3)), (5.5, 100, np.int64(9))]
+
+    result = distribute_spk(sentences, timeline)
+
+    assert result is sentences
+    assert result[0] is first
+    assert result[1] is second
+    assert result == [
+        {"start": 4000, "end": 6000, "text": "clipped", "spk": 3},
+        {"start": 6000, "end": 7000, "timestamp": [[6000, 7000]], "spk": 9},
+    ]
+    assert type(first["spk"]) is int
+    assert type(second["spk"]) is int
+
+
+@pytest.mark.parametrize("timeline", [[], [(0, 1, 8), (2, 3, 9)]])
+def test_distribute_spk_defaults_to_zero_without_positive_overlap(timeline):
+    assert distribute_spk([{"start": 1000, "end": 2000}], timeline) == [
+        {"start": 1000, "end": 2000, "spk": 0}
+    ]
+
+
+def test_distribute_spk_accepts_empty_sentences():
+    sentences = []
+    assert distribute_spk(sentences, [(0, 1, 7)]) is sentences
```

---

### Incident Patch 9: `da12182b` (2026-09-28)
**Commit Message**: Fix invalid escape sequences in text normalization and models (#3709)

Three modules use invalid escapes in non-raw string literals:
- fun_text_processing/text_normalization/normalize.py - \., \w
- funasr/models/fsmn_kws/encoder.py - \[
- funasr/models/fun_asr_nano/tools/format5res.py - \.

On Python 3.12+ each raises SyntaxWarning: invalid escape sequence on
import, and FunASR runs the 3.10-3.12 CI matrix. Escaping the
backslashes leaves every string value identical (ruff W605-style).


Claude-Session: https://claude.ai/code/session_014HBQNzAf5C2E3MiJC48HQw

Co-authored-by: Mehdi Boutayeb <mehdi.boutayeb@asc-it.fr>
Co-authored-by: Claude Opus 4.8 <noreply@anthropic.com>

**File**: `fun_text_processing/text_normalization/normalize.py` (modified, +1/-1)
```diff
@@ -351,7 +351,7 @@ def split_text_into_sentences(self, text: str) -> List[str]:
             upper_case_unicode = "\u0410-\u042F"
 
         # Read and split transcript by utterance (roughly, sentences)
-        split_pattern = f"(?<!\w\.\w.)(?<![A-Z{upper_case_unicode}][a-z{lower_case_unicode}]+\.)(?<![A-Z{upper_case_unicode}]\.)(?<=\.|\?|\!|\.”|\?”\!”)\s(?![0-9]+[a-z]*\.)"
+        split_pattern = f"(?<!\\w\\.\\w.)(?<![A-Z{upper_case_unicode}][a-z{lower_case_unicode}]+\\.)(?<![A-Z{upper_case_unicode}]\\.)(?<=\\.|\\?|\\!|\\.”|\\?”\\!”)\\s(?![0-9]+[a-z]*\\.)"
 
         sentences = regex.split(split_pattern, text)
         return sentences
```

**File**: `funasr/models/fsmn_kws/encoder.py` (modified, +6/-6)
```diff
@@ -84,7 +84,7 @@ def to_pytorch_net(self, fread):
                                   dtype=torch.float32)
         for i in range(self.output_dim):
             line = fread.readline()
-            splits = line.strip().strip('\[\]').strip().split()
+            splits = line.strip().strip('\\[\\]').strip().split()
             assert len(splits) == self.input_dim
             cols = torch.tensor([float(item) for item in splits],
                                 dtype=torch.float32)
@@ -160,7 +160,7 @@ def to_pytorch_net(self, fread):
                                   dtype=torch.float32)
         for i in range(self.output_dim):
             line = fread.readline()
-            splits = line.strip().strip('\[\]').strip().split()
+            splits = line.strip().strip('\\[\\]').strip().split()
             assert len(splits) == self.input_dim
             cols = torch.tensor([float(item) for item in splits],
                                 dtype=torch.float32)
@@ -171,7 +171,7 @@ def to_pytorch_net(self, fread):
         linear_bias = self.state_dict()['linear.bias']
         #print(linear_bias.shape)
         bias_line = fread.readline()
-        splits = bias_line.strip().strip('\[\]').strip().split()
+        splits = bias_line.strip().strip('\\[\\]').strip().split()
         assert len(splits) == self.output_dim
         new_bias = torch.tensor([float(item) for item in splits],
                                 dtype=torch.float32)
@@ -331,7 +331,7 @@ def to_pytorch_net(self, fread):
         self.dim = int(fsmn_split[1])
 
         params_line = fread.readline()
-        params_split = params_line.strip().strip('\[\]').strip().split()
+        params_split = params_line.strip().strip('\\[\\]').strip().split()
         assert len(params_split) == 12
         assert params_split[0] == '<LearnRateCoef>'
         assert params_split[2] == '<LOrder>'
@@ -352,7 +352,7 @@ def to_pytorch_net(self, fread):
         for i in range(self.lorder):
             print('read conv_left weight -- %d' % i)
             line = fread.readline()
-            splits = line.strip().strip('\[\]').strip().split()
+            splits = line.strip().strip('\\[\\]').strip().split()
             assert len(splits) == self.dim
             cols = torch.tensor([float(item) for item in splits],
                                 dtype=torch.float32)
@@ -375,7 +375,7 @@ def to_pytorch_net(self, fread):
             for i in range(self.rorder):
                 print('read conv_right weight -- %d' % i)
                 line = fread.readline()
-                splits = line.strip().strip('\[\]').strip().split()
+                splits = line.strip().strip('\\[\\]').strip().split()
                 assert len(splits) == self.dim
                 cols = torch.tensor([float(item) for item in splits],
                                     dtype=torch.float32)
```

**File**: `funasr/models/fun_asr_nano/tools/format5res.py` (modified, +2/-2)
```diff
@@ -320,8 +320,8 @@ def all_convert(content):
                     continue
         name = tmp[0]
         content = tmp[1]
-        name = re.sub("\.pcm", "", name)
-        name = re.sub("\.wav", "", name)
+        name = re.sub("\\.pcm", "", name)
+        name = re.sub("\\.wav", "", name)
         content = recoformat(content)
         content = numbersingle(content)
         content = ch_number2digit(content)
```

---

### Incident Patch 10: `9e7f6af8` (2026-09-26)
**Commit Message**: fix: avoid deep-copying the checkpoint in load_pretrained_model (#3729)

**File**: `funasr/train_utils/load_pretrained_model.py` (modified, +4/-2)
```diff
@@ -8,7 +8,6 @@
 import torch.nn
 import torch.optim
 import pdb
-import copy
 
 
 def load_pretrained_model(
@@ -41,7 +40,10 @@ def load_pretrained_model(
         buffer = BytesIO(oss_bucket.get_object(path).read())
         ori_state = torch.load(buffer, map_location=map_location)
 
-    src_state = copy.deepcopy(ori_state)
+    # ori_state is created by torch.load inside this function, is not shared
+    # with the caller, and is not read again below; src_state is only read.
+    # Deep-copying every tensor here doubles peak load memory with no effect.
+    src_state = ori_state
     src_state = src_state["state_dict"] if "state_dict" in src_state else src_state
     src_state = src_state["model_state_dict"] if "model_state_dict" in src_state else src_state
     src_state = src_state["model"] if "model" in src_state else src_state
```

#### Recent Merged Pull Requests:
- **PR #3743** (2026-09-30): docs: surface merged speech-to-speech SenseVoice integration (@LauraGPT)
- **PR #3742** (2026-09-30): fix(auto): warn when unavailable accelerators fall back to CPU (@LauraGPT)
- **PR #3741** (2026-09-30): Fix stale start timestamp in timestamp_sentence_en when timestamp list is shorter than punctuation list (@Arthur031221)
- **PR #3740** (2026-09-30): docs: diagnose actual AutoModel GPU placement (@LauraGPT)
- **PR #3737** (2026-09-29): fix(sensevoice): preserve SentencePiece word boundaries (@LauraGPT)
- **PR #3736** (2026-09-29): fix(website): correct LiteLLM transcription route and guards (@LauraGPT)
- **PR #3735** (2026-09-30): fix(amp): resolve autocast/GradScaler device type for non-CUDA accelerators (@li-lizhe)
- **PR #3734** (2026-09-28): feat(benchmark): report first nonempty transcript latency (@LauraGPT)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

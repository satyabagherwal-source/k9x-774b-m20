# Forensic Learning Record (Deep Inspection): LazyAGI/LazyLLM

> **Canonical Artifact**: `07_PROJECT_LEARNING/lazyagi-lazyllm-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/LazyAGI/LazyLLM](https://github.com/LazyAGI/LazyLLM))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:13:06.551Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `LazyAGI/LazyLLM`
- **Description**: Easiest and laziest way for  building multi-agent LLMs applications.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 3887 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `csrc/binding/binding_utils.cpp`
```
#include "binding_utils.hpp"

#include <type_traits>

namespace lazyllm::pybind_utils {

namespace {
template <typename T> struct dependent_false : std::false_type {};
} // namespace

std::string DumpJson(const py::object& obj) {
    static py::object dumps = py::module_::import("json").attr("dumps");
    py::object dumped = dumps(obj, py::arg("ensure_ascii") = false);
    return dumped.cast<std::string>();
}

py::object LoadJson(const std::string& text) {
    static py::object loads = py::module_::import("json").attr("loads");
    return loads(py::str(text));
}

bool ExtractStringSequence(const py::object& obj, std::vector<std::string>* out) {
    if (!py::isinstance<py::sequence>(obj) || py::isinstance<py::str>(obj)) return false;
    py::sequence seq = obj.cast<py::sequence>();
    out->clear();
    out->reserve(seq.size());
    for (py::handle item : seq) {
        if (!py::isinstance<py::str>(item)) {
            out->clear();
            return false;
        }
        out->push_back(py::cast<std::string>(item));
    }
    return true;
}

lazyllm::MetadataMode ParseMetadataMode(const py::object& mode) {
    if (py::hasattr(mode, "name")) {
        const auto name = py::cast<std::string>(mode.attr("name"));
        if (name == "ALL") return lazyllm::MetadataMode::ALL;
        else if (name == "EMBED") return lazyllm::MetadataMode::EMBED;
        else if (name == "LLM") return lazyllm::MetadataMode::LLM;
        else return lazyllm::MetadataMode::NONE;
    }
    else if (py::isinstance<py::str>(mode)) {
        const auto name = mode.cast<std::string>();
        if (name == "ALL") return lazyllm::MetadataMode::ALL;
        else if (name == "EMBED") return lazyllm::MetadataMode::EMBED;
        else if (name == "LLM") return lazyllm::MetadataMode::LLM;
        else return lazyllm::MetadataMode::NONE;
    }
    return lazyllm::MetadataMode::NONE;
}

lazyllm::MetadataVType PyToMetadataValue(const py::handle& value) {
    if (value.is_none()) return std::nullopt;
    if (py::isinstance<py::bool_>(value)) return static_cast<int>(value.cast<bool>());
    if (py::isinstance<py::int_>(value)) return value.cast<int>();
    if (py::isinstance<py::float_>(value)) return value.cast<double>();
    if (py::isinstance<py::str>(value)) return value.cast<std::string>();
    if (py::isinstance<py::dict>(value)) {
        py::dict d = value.cast<py::dict>();
        std::unordered_map<std::string, std::string> out;
        out.reserve(d.size());
        for (auto item : d) {
            const std::string key = py::str(item.first).cast<std::string>();
            const std::string val = py::str(item.second).cast<std::string>();
            out.emplace(key, val);
        }
        return out;
    }

    if (py::isinstance<py::sequence>(value) && !py::isinstance<py::str>(value)) {
        py::sequence seq = value.cast<py::sequence>();
        if (seq.empty()) return std::vector<std::string>{};

        bool all_str = true;
        bool all_int = true;
        bool all_numeric = true;

        for (py::handle item : seq) {
            const bool is_str = py::isinstance<py::str>(item);
            const bool is_int = py::isinstance<py::int_>(item) && !py::isinstance<py::bool_>(item);
            const bool is_numeric = is_int || py::isinstance<py::float_>(item) || py::isinstance<py::bool_>(item);
            all_str = all_str && is_str;
            all_int = all_int && is_int;
            all_numeric = all_numeric && is_numeric;
        }

        if (all_str) {
            std::vector<std::string> out;
            out.reserve(seq.size());
            for (py::handle item : seq) out.push_back(py::cast<std::string>(item));
            return out;
        }
        if (all_int) {
            std::vector<int> out;
            out.reserve(seq.size());
            for (py::handle item : seq) out.push_back(py::cast<int>(item));
            return out;
        }
        if (all_numeric) {
            std::vector<double> out;
            out.reserve(seq.size());
            for (py::handle item : seq) out.push_back(py::cast<double>(item));
            return out;
        }
        std::vector<std::string> out;
        out.reserve(seq.size());
        for (py::handle item : seq) out.push_back(py::str(item).cast<std::string>());
        return out;
    }
    return py::str(value).cast<std::string>();
}

py::object MetadataValueToPy(const lazyllm::MetadataVType& value) {
    if (!value.has_value()) return py::none();
    return std::visit([](const auto& v) -> py::object {
        using T = std::decay_t<decltype(v)>;
        if constexpr (std::is_same_v<T, std::string>) return py::str(v);
        else if constexpr (std::is_same_v<T, int>) return py::int_(v);
        else if constexpr (std::is_same_v<T, double>) return py::float_(v);
        else if constexpr (std::is_same_v<T, std::vector<std::string>>) return py::cast(v);
        else if constexpr (std::is_same_v<T, std::vector<int>>) return py::cast(v);
        else if constexpr (std::is_same_v<T, std::vector<double>>) return py::cast(v);
        else if constexpr (std::is_same_v<T, std::unordered_map<std::string, std::string>>) return py::cast(v);
        else {
            static_assert(dependent_false<T>::value, "MetadataValueToPy: unhandled MetadataVType alternative");
            return py::none();
        }
    }, *value);
}

} // namespace lazyllm::pybind_utils

```

### Core Architecture Module: `csrc/core/src/doc_node.cpp`
```
#include "doc_node.hpp"

namespace lazyllm {

std::string DocNodeCore::get_metadata_string(MetadataMode mode) const {
    if (mode == MetadataMode::NONE) return "";

    std::vector<std::string> kv_strings;
    if (mode == MetadataMode::ALL) {
        kv_strings.reserve(_metadata.size());
        for (const auto& [key, val] : _metadata) {
            kv_strings.emplace_back(key + ": " + metadata_value_to_string(val));
        }
    } else {
        std::set<std::string> valid_keys;
        for (const auto& [key, val] : _metadata) {
            (void)val;
            if (mode == MetadataMode::LLM && _excluded_llm_metadata_keys.count(key)) continue;
            if (mode == MetadataMode::EMBED && _excluded_embed_metadata_keys.count(key)) continue;
            valid_keys.insert(key);
        }
        kv_strings.reserve(valid_keys.size());
        for (const std::string& key : valid_keys)
            kv_strings.emplace_back(key + ": " + metadata_value_to_string(_metadata.at(key)));
    }

    return JoinLines(kv_strings);
}

} // namespace lazyllm

```

### Core Architecture Module: `csrc/core/src/sentence_splitter.cpp`
```
#include "sentence_splitter.hpp"

#include <cctype>
#include <stdexcept>

namespace {

std::string join_views(
    size_t string_size,
    std::vector<lazyllm::Chunk>::const_iterator begin,
    const std::vector<lazyllm::Chunk>::const_iterator& end
) {
    std::string out;
    out.reserve(string_size);
    while(begin != end) {
        out.append(begin->text);
        ++begin;
    }
    return out;
}

} // namespace

namespace lazyllm {

std::vector<std::string> SentenceSplitter::merge_chunks(const std::vector<Chunk>& chunks, unsigned chunk_size) const {
    std::vector<std::string> out;

    auto iLeft = chunks.begin();
    auto iRight = chunks.begin();
    auto iEnd = chunks.end();
    size_t window_token_sum = 0;
    size_t string_size = 0;

    while (iRight != iEnd) {
        if (static_cast<unsigned>(iRight->token_size) > chunk_size)
            throw std::runtime_error("Chunk size is too big.");

        // Grow right edge to the largest window under chunk_size.
        auto iRightPrev = iRight;
        while (iRight != iEnd && window_token_sum + iRight->token_size <= chunk_size) {
            window_token_sum += iRight->token_size;
            string_size += iRight->text.size();
            ++iRight;
        }
        // If no progress was made, the current chunk is too large to fit.
        if (iRight == iRightPrev) {
            throw std::runtime_error("Chunk token_size exceeds chunk_size; cannot make progress.");
        }

        // Merge chunks within window.
        out.push_back(join_views(string_size, iLeft, iRight));

        // Shrink left edge to select overlap of next merge.
        while (iRight != iEnd && iLeft != iRight && (
            window_token_sum > _overlap || window_token_sum + iRight->token_size > chunk_size
        )) {
            window_token_sum -= iLeft->token_size;
            string_size -= iLeft->text.size();
            ++iLeft;
        }
        // Now window contains only overlap.
    }

    // Keep Python behavior: remove leading/trailing whitespace and drop empty chunks.
    std::vector<std::string> normalized;
    normalized.reserve(out.size());
    for (auto& chunk : out) {
        size_t begin = 0;
        while (begin < chunk.size() && std::isspace(static_cast<unsigned char>(chunk[begin]))) ++begin;
        size_t end = chunk.size();
        while (end > begin && std::isspace(static_cast<unsigned char>(chunk[end - 1]))) --end;
        if (end > begin) normalized.emplace_back(chunk.substr(begin, end - begin));
    }

    return normalized;
}

} // namespace lazyllm

```

### Core Architecture Module: `csrc/core/src/text_splitter_base.cpp`
```
#include "text_splitter_base.hpp"
#include "unicode_processor.hpp"

namespace lazyllm {

/*
 * split_text
 * ----------
 * Purpose:
 * 1) Validate chunk budget after accounting for metadata tokens.
 * 2) Recursively split the original text view into token-bounded SplitUnit pieces.
 * 3) Merge the pieces into final chunk strings with overlap behavior aligned to Python implementation.
 *
 * Flow:
 * 1) Compute effective_chunk_size = chunk_size - metadata_size.
 * 2) Reject invalid/too-small budgets.
 * 3) Call split_recursive(...) to produce SplitUnit sequence.
 * 4) Call merge_chunks(...) to build final std::string chunks.
 *
 * Notes:
 * - This function returns std::string chunks intentionally because current tokenizer
 *   encode/decode materializes strings in the merge path.
 * - Ownership is explicit here to avoid dangling string_view in downstream DocNodeCore construction.
 *
 * TODO:
 * - After tokenizer supports true string_view encode/decode, migrate this path back to
 *   std::vector<std::string_view> and remove eager string materialization.
 */
std::vector<std::string> TextSplitterBase::split_text(std::string_view view, int metadata_size) const {
    if (view.empty()) return {""};
    int effective_chunk_size = _chunk_size - metadata_size;
    if (effective_chunk_size <= 0) {
        throw std::invalid_argument(
            "Metadata length (" + std::to_string(metadata_size) +
            ") is longer than chunk size (" + std::to_string(_chunk_size) +
            "). Consider increasing the chunk size or decreasing the size of your metadata to avoid this.");
    }
    else if (effective_chunk_size < 50) {
        // Keep Python behavior: this is only a warning there, not an exception.
        // We continue splitting with the small effective chunk size.
    }
    auto split_views = split_recursive(view, effective_chunk_size);
    std::vector<Chunk> splits;
    splits.reserve(split_views.size());
    for (const auto& split : split_views) {
        splits.push_back(Chunk{std::string(split.view), split.is_sentence, split.token_size});
    }
    return merge_chunks(std::move(splits), effective_chunk_size);
} // namespace lazyllm

std::vector<ChunkView> TextSplitterBase::split_recursive(std::string_view view, const int chunk_size) const
{
    int token_size = get_token_size(view);
    if (token_size <= chunk_size) return {ChunkView{view, true, token_size}};

    auto [views, is_sentence] = split_by_functions(view);
    if (views.size() == 1) {
        int num_splits = (token_size + chunk_size - 1) / chunk_size;
        auto forced_views = UnicodeProcessor(view).split_to_n_parts(static_cast<size_t>(num_splits));
        std::vector<ChunkView> splits;
        splits.reserve(forced_views.size());
        for (const auto& v : forced_views) {
            splits.push_back({v, is_sentence, get_token_size(v)});
        }
        return splits;
    }

    std::vector<ChunkView> splits;
    for (const auto& segment_view : views) {
        const int seg_token_size = get_token_size(segment_view);
        if (seg_token_size == 0) continue;
        if (seg_token_size <= chunk_size) {
            splits.push_back({segment_view, is_sentence, seg_token_size});
        } else {
            auto new_splits = split_recursive(segment_view, chunk_size);
            splits.insert(splits.end(), new_splits.begin(), new_splits.end());
        }
    }
    return splits;
} // namespace lazyllm

std::tuple<std::vector<std::string_view>, bool> TextSplitterBase::split_by_functions(std::string_view text) const
{
    auto views = split_text_while_keeping_separator(text, "\n\n\n");
    if (views.size() > 1) return {views, true};

    views = UnicodeProcessor(text).split_by_sentence_endings();
    if (views.size() > 1) return {views, true};

    views = UnicodeProcessor(text).split_by_punctuation();
    if (views.size() > 1) return {views, false};

    views = split_text_while_keeping_separator(text, " ");
    if (views.size() > 1) return {views, false};

    return {UnicodeProcessor(text).split_to_chars(), false};
} // namespace lazyllm

std::vector<std::string_view> TextSplitterBase::split_text_while_keeping_separator(
    std::string_view text, std::string_view separator)
{
    if (text.empty()) return {};
    else if (separator.empty()) return {text};

    std::vector<std::string_view> result;
    size_t start = 0;
    const size_t sep_len = separator.size();
    while (start < text.size()) {
        const size_t idx = text.find(separator, start);
        if (idx == std::string_view::npos) {
            result.emplace_back(text.substr(start));
            break;
        }

        if (idx == start) {
            start += sep_len;
            continue;
        }

        result.emplace_back(text.substr(start, idx + sep_len - start));
        start = idx + sep_len;
    }
    return result;
} // namespace lazyllm

/**
 *  @brief Build final chunks from token-sized split units while preserving overlap semantics.
 *
 *  @details
 *  1) Convert input SplitUnit views to owned strings (MergedSplit) for safe concatenation.
 *  2) If the tail split exactly matches chunk_size and overlap > 0:
 *     split it by token-halves via encode/decode, then push both halves back.
 *  3) Iterate backward:
 *     Add previous split, or part of it, to current split as overlap.
 *     - If the previous split is small enough, prepend it fully.
 *     - Otherwise, prepend token-based overlap suffix from previous split.
 *  4) Emit chunks in original order.
 *
 *  @todo Replace eager string materialization once tokenizer encode/decode supports
 *  end-to-end zero-copy string_view operations.
 */
std::vector<std::string> TextSplitterBase::merge_chunks(const std::vector<Chunk>& splits_in, unsigned chunk_size) const
{
    std::vector<Chunk> splits = splits_in;
    if (splits.empty()) return {};

    if (splits.size() == 1) return {splits.front().text};

    if (static_cast<unsigned>(splits.back().token_size) == chunk_size && _overlap > 0) {
        Chunk end_split = splits.back();
        splits.pop_back();

        auto text_tokens = _tokenizer->encode(end_split.text);
        const size_t half = text_tokens.size() / 2;
        const auto split_it = text_tokens.begin() + static_cast<std::vector<int>::difference_type>(half);
        std::vector<int> prefix_tokens(text_tokens.begin(), split_it);
        std::vector<int> suffix_tokens(split_it, text_tokens.end());

        std::string prefix_text = _tokenizer->decode(prefix_tokens);
        std::string suffix_text = _tokenizer->decode(suffix_tokens);
        splits.push_back(
            Chunk{prefix_text, end_split.is_sentence, get_token_size(prefix_text)});
        splits.push_back(
            Chunk{suffix_text, end_split.is_sentence, get_token_size(suffix_text)});
    }

    Chunk end_split = splits.back();
    std::vector<std::string> reversed_result;
    reversed_result.reserve(splits.size());
    for (int idx = static_cast<int>(splits.size()) - 2; idx >= 0; --idx) {
        const Chunk& start_split = splits[static_cast<size_t>(idx)];
        if (static_cast<unsigned>(start_split.token_size) <= _overlap &&
            static_cast<unsigned>(end_split.token_size) <= chunk_size - _overlap) {
            end_split = Chunk{
                start_split.text + end_split.text,
                start_split.is_sentence && end_split.is_sentence,
                start_split.token_size + end_split.token_size
            };
            continue;
        }

        if (static_cast<unsigned>(end_split.token_size) > chunk_size) {
            throw std::runtime_error("split token size is greater than chunk size.");
        }

        const int remaining_space = chunk_size - end_split.token_size;
        const int overlap_len = std::min({static_cast<int>(_overlap), remaining_space, start_split.token_size});
        if (overlap_len > 0) {
            auto start_tokens = _tokenizer->encode(start_split.text);
            std::vector<int> overlap_tokens(start_tokens.end() - overlap_len, start_tokens.end());
            std::string overlap_text = _tokenizer->decode(overlap_tokens);

            end_split = Chunk{
                overlap_text + end_split.text,
                end_split.is_sentence,
                end_split.token_size + overlap_len};
        }

        reversed_result.emplace_back(end_split.text);
        end_split = start_split;
    }

    reversed_result.emplace_back(end_split.text);
    std::reverse(reversed_result.begin(), reversed_result.end());
    return reversed_result;
} // namespace lazyllm

} // namespace lazyllm

```

### Core Architecture Module: `csrc/core/src/unicode_processor.cpp`
```
#include "unicode_processor.hpp"

#include <utf8proc.h>

namespace lazyllm {

const std::array<char32_t, 6> UnicodeProcessor::kSentenceEndingCodepoints = {
    U'!',
    U'.',
    U'?',
    U'\u3002', // CJK full stop
    U'\uFF01', // fullwidth exclamation mark
    U'\uFF1F', // fullwidth question mark
};

const std::array<char32_t, 10> UnicodeProcessor::kSubSentencePunctuationCodepoints = {
    U'!',
    U',',
    U'.',
    U';',
    U'?',
    U'\u3002', // CJK full stop
    U'\uFF01', // fullwidth exclamation mark
    U'\uFF0C', // fullwidth comma
    U'\uFF1B', // fullwidth semicolon
    U'\uFF1F', // fullwidth question mark
};

template <typename Visitor>
void UnicodeProcessor::for_each_utf8_unit(Visitor&& visitor) const {
    size_t i = 0;
    auto text_size = _text.size();
    while (i < text_size) {
        int32_t codepoint = -1;
        const utf8proc_ssize_t n = utf8proc_iterate(
            reinterpret_cast<const utf8proc_uint8_t*>(_text.data() + i),
            static_cast<utf8proc_ssize_t>(text_size - i),
            &codepoint);

        if (n <= 0) {
            i += 1;
            continue;
            // TODO: when adding stronger logging, collect all invalid UTF-8
            // bytes encountered and report them together.
        }

        visitor(i, static_cast<size_t>(n), codepoint);
        i += static_cast<size_t>(n);
    }
}

/**
 * UTF-8 text processing has three distinct layers:
 * 1) Byte: the storage unit in std::string_view; one code point uses 1-4 UTF-8 bytes.
 * 2) Code point: a Unicode scalar value (for example U+0061, U+4E2D), decoded by utf8proc_iterate.
 * 3) Grapheme cluster: one user-perceived character, which may contain multiple code points
 *    (for example base + combining mark, or emoji + VS/ZWJ sequences).
 *
 * This function splits by grapheme cluster, not by byte or code point:
 * - for_each_utf8_unit() uses utf8proc_iterate to decode UTF-8 and provide
 *   code point, byte offset, and byte length.
 * - utf8proc_grapheme_break_stateful(prev, codepoint, &state) determines whether
 *   there is a grapheme boundary between prev and the current code point.
 * - When a boundary appears, we emit a string_view slice over byte range
 *   [cluster_start, offset).
 *
 * This keeps splitting zero-copy (string_view) while following Unicode grapheme-boundary rules.
 */
std::vector<std::string_view> UnicodeProcessor::split_to_chars() const {
    std::vector<std::string_view> out;
    if (_text.empty()) return out;
    out.reserve(_text.size()); // Grapheme count <= byte length

    size_t cluster_start = std::string_view::npos;
    int32_t prev = -1;
    int32_t state = 0;

    for_each_utf8_unit([&](size_t offset, size_t byte_len, int32_t codepoint) {
        (void)byte_len;
        if (cluster_start == std::string_view::npos) {
            cluster_start = offset;
        } else if (utf8proc_grapheme_break_stateful(prev, codepoint, &state)) {
            out.emplace_back(_text.substr(cluster_start, offset - cluster_start));
            cluster_start = offset;
        }
        prev = codepoint;
    });

    if (cluster_start != std::string_view::npos) {
        out.emplace_back(_text.substr(cluster_start));
    }
    return out;
}

// Sentence-ending punctuation is included at the end of each chunk.
// Any trailing text after the last sentence-ending punctuation is returned as the final chunk.
std::vector<std::string_view> UnicodeProcessor::split_by_sentence_endings() const {
    if (_text.empty()) return {};

    std::vector<std::string_view> out;
    size_t chunk_start = std::string_view::npos;
    bool trim_leading_space = true;

    for_each_utf8_unit([&](size_t offset, size_t byte_len, char32_t codepoint) {
        const bool is_space = utf8proc_category(codepoint) == UTF8PROC_CATEGORY_ZS
            || codepoint == U'\t' || codepoint == U'\n' || codepoint == U'\r' || codepoint == U'\f';
        if (chunk_start == std::string_view::npos && is_space && trim_leading_space) return;

        if (is_sentence_ending_punctuation(codepoint)) {
            if (chunk_start != std::string_view::npos) {
                const size_t end = offset + byte_len;
                out.push_back(_text.substr(chunk_start, end - chunk_start));
                chunk_start = std::string_view::npos;
                trim_leading_space = true;
            }
        } else if (chunk_start == std::string_view::npos) {
            chunk_start = offset;
            trim_leading_space = false;
        }
    });

    if (chunk_start != std::string_view::npos) {
        out.emplace_back(_text.substr(chunk_start));
    }
    if (out.empty()) out.emplace_back(_text);
    return out;
}

std::vector<std::string_view> UnicodeProcessor::split_by_punctuation() const {
    if (_text.empty()) return {};

    std::vector<std::string_view> out;
    size_t chunk_start = std::string_view::npos;
    bool trim_leading_space = true;

    for_each_utf8_unit([&](size_t offset, size_t byte_len, char32_t codepoint) {
        const bool is_space = utf8proc_category(codepoint) == UTF8PROC_CATEGORY_ZS
            || codepoint == U'\t' || codepoint == U'\n' || codepoint == U'\r' || codepoint == U'\f';
        if (chunk_start == std::string_view::npos && is_space && trim_leading_space) return;

        if (is_sub_sentence_punctuation(codepoint)) {
            if (chunk_start != std::string_view::npos) {
                const size_t end = offset + byte_len;
                out.push_back(_text.substr(chunk_start, end - chunk_start));
                chunk_start = std::string_view::npos;
                trim_leading_space = (
                    codepoint == U'.' || codepoint == U'!' || codepoint == U'\uFF1F'
                    || codepoint == U'\uFF01' || codepoint == U'?' || codepoint == U'\u3002');
            }
        } else if (chunk_start == std::string_view::npos) {
            chunk_start = offset;
            trim_leading_space = false;
        }
    });

    if (chunk_start != std::string_view::npos) {
        out.emplace_back(_text.substr(chunk_start));
    }
    if (out.empty()) out.emplace_back(_text);
    return out;
}

std::vector<std::string_view> UnicodeProcessor::split_to_n_parts(size_t n) const {
    if (_text.empty() || n == 0) return {};
    auto chars = split_to_chars();
    if (chars.empty()) return {_text};
    if (n >= chars.size()) return chars;

    std::vector<std::string_view> out;
    out.reserve(n);
    const size_t total = chars.size();
    const size_t base = total / n;
    const size_t rem = total % n;
    size_t idx = 0;
    for (size_t i = 0; i < n; ++i) {
        const size_t count = base + (i < rem ? 1 : 0);
        if (count == 0) continue;
        const size_t start_offset = chars[idx].data() - _text.data();
        const size_t end_offset = chars[idx + count - 1].data() - _text.data() + chars[idx + count - 1].size();
        out.emplace_back(_text.substr(start_offset, end_offset - start_offset));
        idx += count;
    }
    return out;
}

} // namespace lazyllm

```

### Core Architecture Module: `csrc/core/src/utils.cpp`
```
#include "utils.hpp"

#include <type_traits>
#include <typeinfo>
#include <stdexcept>

namespace lazyllm {

std::string metadata_value_to_string(const MetadataVType& value) {
    if (!value.has_value()) return "None";
    return std::visit([](const auto& v) -> std::string {
        using T = std::decay_t<decltype(v)>;
        if constexpr (std::is_same_v<T, std::string>) return v;
        else if constexpr (std::is_same_v<T, int>) return std::to_string(v);
        else if constexpr (std::is_same_v<T, double>) return NumberToString(v);
        else if constexpr (std::is_same_v<T, std::vector<std::string>>) return VectorToString(v);
        else if constexpr (std::is_same_v<T, std::vector<int>>) return VectorToString(v);
        else if constexpr (std::is_same_v<T, std::vector<double>>) return VectorToString(v);
        else if constexpr (std::is_same_v<T, std::unordered_map<std::string, std::string>>) return MapToString(v);
        else throw std::runtime_error(std::string("Unsupported Metadata value type: ") + typeid(T).name());
    }, value.value());
}

} // namespace lazyllm

```

### Core Architecture Module: `examples/rag_with_parsing_service/server_and_separate_workers.py`
```
import os
import tempfile
import threading
import lazyllm
from lazyllm.tools.rag.parsing_service import DocumentProcessor, DocumentProcessorWorker


# callback func example
def post_func_example(task_id: str, task_status: str, error_code: str = None, error_msg: str = None):
    record = {
        'task_id': task_id,
        'task_status': task_status,
        'error_code': error_code,
        'error_msg': error_msg,
    }
    lazyllm.LOG.info(f'[callback example] record: {record}')
    return True

def run():
    fd, db_dir = tempfile.mkstemp(suffix='.db')
    os.close(fd)
    try:
        db_config = {
            'db_type': 'sqlite',
            'user': None,
            'password': None,
            'host': None,
            'port': None,
            'db_name': db_dir,
        }

        server = DocumentProcessor(port=9966, db_config=db_config, num_workers=0,
                                   post_func=post_func_example)
        server.start()

        # NOTE: db_config should be the same as server.db_config
        worker = DocumentProcessorWorker(db_config=db_config, num_workers=4, port=28888)
        worker.start()
        try:
            threading.Event().wait()
        except KeyboardInterrupt:
            lazyllm.LOG.info('\n>> Ctrl+C pressed, stopping service...')
    finally:
        try:
            os.remove(db_dir)
        except Exception:
            pass

run()

```

### Core Architecture Module: `examples/rag_with_parsing_service/server_with_worker.py`
```
import os
import tempfile
import threading
import lazyllm
from lazyllm.tools.rag.parsing_service import DocumentProcessor


# callback func example
def post_func_example(task_id: str, task_status: str, error_code: str = None, error_msg: str = None):
    record = {
        'task_id': task_id,
        'task_status': task_status,
        'error_code': error_code,
        'error_msg': error_msg,
    }
    lazyllm.LOG.info(f'[callback example] record: {record}')
    return True

def run():
    fd, db_dir = tempfile.mkstemp(suffix='.db')
    os.close(fd)
    try:
        db_config = {
            'db_type': 'sqlite',
            'user': None,
            'password': None,
            'host': None,
            'port': None,
            'db_name': db_dir,
        }

        server = DocumentProcessor(port=9966, db_config=db_config, num_workers=1,
                                   post_func=post_func_example)
        server.start()
        try:
            threading.Event().wait()
        except KeyboardInterrupt:
            lazyllm.LOG.info('\n>> Ctrl+C pressed, stopping service...')
    finally:
        try:
            os.remove(db_dir)
        except Exception:
            pass

run()

```

### Core Architecture Module: `lazyllm/common/queue.py`
```
import sqlite3
import threading
import inspect
from abc import ABC, abstractmethod
from .globals import globals
from ..configs import config
import os
from typing import Type, Optional
from lazyllm.thirdparty import redis
from queue import Queue
from collections import deque
from filelock import SoftFileLock

config.add(
    'default_fsqueue', str, 'sqlite', 'DEFAULT_FSQUEUE',
    options=['sqlite', 'redis'],
    description='The default FileSystemQueue backend to use.',
)
config.add('fsqredis_url', str, '', 'FSQREDIS_URL',
           description='The URL of the Redis server for the file system queue.')
config.add('default_recent_k', int, 0, 'DEFAULT_RECENT_K',
           description='The number of recent inputs that RecentQueue keeps track of.')


class RecentQueue(Queue):
    def __init__(self, maxsize=0, recent_k=None):
        super().__init__(maxsize)
        self._recent_k = recent_k or config['default_recent_k']
        if self._recent_k:
            self._recent = deque(maxlen=self._recent_k)
            self._recent_lock = threading.Lock()

    def put(self, item, block=True, timeout=None):
        super().put(item, block, timeout)
        if self._recent_k:
            with self._recent_lock:
                self._recent.append(item)
        return self

    def get_recent(self, join: Optional[str] = None, join_prefix: Optional[str] = None):
        r = []
        if self._recent_k:
            with self._recent_lock:
                r = list(self._recent)
        if join:
            assert isinstance(join, str), 'join symbol must be str'
            assert all([isinstance(s, str) for s in r]), 'all items of list to join must be str'
            r = join.join(r)
            if join_prefix and r: r = join_prefix + r
        return r


class FileSystemQueue(ABC):

    __queue_pool__ = dict()
    __queue_pool_lock__ = threading.RLock()

    def __init__(self, *, klass='__default__'):
        super().__init__()
        self._class = klass

    def __new__(cls, *args, **kw):
        klass = kw.get('klass', '__default__')
        if klass not in __class__.__queue_pool__:
            with __class__.__queue_pool_lock__:
                if klass not in __class__.__queue_pool__:
                    if cls is __class__:
                        __class__.__queue_pool__[klass] = cls.__default_queue__(*args, **kw)
                    else:
                        __class__.__queue_pool__[klass] = super().__new__(cls)
        return __class__.__queue_pool__[klass]

    @classmethod
    def get_instance(cls, klass):
        assert isinstance(klass, str) and klass != '__default__'
        return cls(klass=klass)

    @classmethod
    def set_default(cls, queue: Type):
        cls.__default_queue__ = queue

    @property
    def sid(self):
        return f'{globals._sid}-{self._class}'

    def enqueue(self, message): return self._enqueue(self.sid, message)
    def dequeue(self, limit=None): return self._dequeue(self.sid, limit=limit)
    def peek(self): return self._peek(self.sid)
    def size(self): return self._size(self.sid)
    def init(self): self.clear()

    def clear(self):
        self._clear(self.sid)

    @abstractmethod
    def _enqueue(self, id, message): pass

    @abstractmethod
    def _dequeue(self, id, limit=None): pass

    @abstractmethod
    def _peek(self, id): pass

    @abstractmethod
    def _size(self, id): pass

    @abstractmethod
    def _clear(self, id): pass

# true means one connection can be used in multiple thread
# refer to: https://sqlite.org/compile.html#threadsafe
def sqlite3_check_threadsafety() -> bool:
    conn = sqlite3.connect(':memory:')
    res = conn.execute('''
        select * from pragma_compile_options
        where compile_options like 'THREADSAFE=%'
    ''').fetchall()
    conn.close()
    return True if res[0][0] == 'THREADSAFE=1' else False

class SQLiteQueue(FileSystemQueue):
    _init_lock = threading.Lock()

    def __init__(self, klass='__default__'):
        if getattr(self, '_initialized', False):
            return
        with self._init_lock:
            if getattr(self, '_initialized', False):
                return
            super(__class__, self).__init__(klass=klass)
            self.db_path = os.path.expanduser(os.path.join(config['home'], '.lazyllm_filesystem_queue.db'))
            lock_kwargs = {}
            if 'is_singleton' in inspect.signature(SoftFileLock).parameters:
                lock_kwargs['is_singleton'] = True
            self._lock = SoftFileLock(self.db_path + '.lock', **lock_kwargs)
            self._check_same_thread = not sqlite3_check_threadsafety()
            try:
                self._initialize_db()
            except Exception:
                with FileSystemQueue.__queue_pool_lock__:
                    if FileSystemQueue.__queue_pool__.get(klass) is self:
                        FileSystemQueue.__queue_pool__.pop(klass, None)
                raise
            self._initialized = True

    def _initialize_db(self):
        with self._lock, sqlite3.connect(self.db_path, check_same_thread=self._check_same_thread) as conn:
            cursor = conn.cursor()
            cursor.execute('''
            CREATE TABLE IF NOT EXISTS queue (
                id TEXT NOT NULL,
                position INTEGER NOT NULL,
                message TEXT NOT NULL,
                PRIMARY KEY (id, position)
            )
            ''')
            conn.commit()

    def _enqueue(self, id, message):
        with self._lock:
            with sqlite3.connect(self.db_path, check_same_thread=self._check_same_thread) as conn:
                cursor = conn.cursor()
                cursor.execute('''
                SELECT MAX(position) FROM queue WHERE id = ?
                ''', (id,))
                max_pos = cursor.fetchone()[0]
                next_pos = 0 if max_pos is None else max_pos + 1
                cursor.execute('''
                INSERT INTO queue (id, position, message)
                VALUES (?, ?, ?)
                ''', (id, next_pos, message))
                conn.commit()

    def _dequeue(self, id, limit=None):
        '''Retrieve and remove all messages from the queue.'''
        with self._lock:
            with sqlite3.connect(self.db_path, check_same_thread=self._check_same_thread) as conn:
                cursor = conn.cursor()
                if limit:
                    cursor.execute('SELECT message, position FROM queue WHERE id = ? '
                                   'ORDER BY position ASC LIMIT ?', (id, limit))
                else:
                    cursor.execute('SELECT message, position FROM queue WHERE id = ? '
                                   'ORDER BY position ASC', (id,))

                rows = cursor.fetchall()
                if not rows:
                    return []
                messages = [row[0] for row in rows]
                cursor.execute('DELETE FROM queue WHERE id = ? AND position IN '
                               f'({",".join([str(row[1]) for row in rows])})', (id, ))
                conn.commit()
                return messages

    def _peek(self, id):
        with self._lock:
            with sqlite3.connect(self.db_path, check_same_thread=self._check_same_thread) as conn:
                cursor = conn.cursor()
                cursor.execute('''
                SELECT message FROM queue WHERE id = ? ORDER BY position ASC LIMIT 1
                ''', (id,))
                row = cursor.fetchone()
                if row is None:
                    return None
                return row[0]

    def _size(self, id):
        with self._lock:
            with sqlite3.connect(self.db_path, check_same_thread=self._check_same_thread) as conn:
                cursor = conn.cursor()
                cursor.execute('''
                SELECT COUNT(*) FROM queue WHERE id = ?
                ''', (id,))
                return cursor.fetchone()[0]

    def _clear(self, id):
        with self._lock:
            with sqlite3.connect(self.db_path, check_same_thread=self._check_same_thread) as conn:
                cursor = conn.cursor()
                cursor.execute('''
                DELETE FROM queue WHERE id = ?
                ''', (id,))
                conn.commit()


class RedisQueue(FileSystemQueue):
    def __init__(self, klass='__default__'):
        super(__class__, self).__init__(klass=klass)
        self.redis_url = config['fsqredis_url']
        self._lock = threading.Lock()
        self._initialize_db()

    def _initialize_db(self):
        with self._lock:
            conn = redis.Redis.from_url(self.redis_url)
            assert (
                conn.ping()
            ), 'Found fsque reids config but can not connect, please check your config `LAZYLLM_FSQREDIS_URL`.'
            if not conn.exists(self.sid):
                conn.rpush(self.sid, '<start>')

    def _enqueue(self, id, message):
        with self._lock:
            conn = redis.Redis.from_url(self.redis_url)
            conn.rpush(id, message)

    def _dequeue(self, id, limit=None):
        with self._lock:
            conn = redis.Redis.from_url(self.redis_url)
            if limit:
                limit = limit + 1
                vals = conn.lrange(id, 1, limit)
                conn.ltrim(id, limit, -1)
            else:
                vals = conn.lrange(id, 1, -1)
                conn.ltrim(id, 0, 0)
            if not vals:
                return []
            return [val.decode('utf-8') for val in vals]

    def _peek(self, id):
        with self._lock:
            conn = redis.Redis.from_url(self.redis_url)
            val = conn.lindex(id, 1)
            if val is None:
                return None
            return val.decode('utf-8')

    def _size(self, id):
        with self._lock:
            conn = redis.Redis.from_url(self.redis_url)
            rsize = conn.llen(id)
            return rsize - 1  # empty : [ <start> ]

    def _clear(self, id):
        with self._lock:
            conn = red
```

### Core Architecture Module: `lazyllm/common/utils.py`
```
from os import PathLike, makedirs
from os.path import expanduser, expandvars, isfile, join, normpath
from typing import Union, Dict, Callable, Any, Optional
import re
import os
import sys
from contextlib import contextmanager
import cloudpickle
import ast
import pickle
import base64
import argparse

def check_path(
    path: Union[str, PathLike],
    exist: bool = True,
    file: bool = True,
    parents: bool = True,
) -> str:
    '''
    Check path and return corrected path.
    '''
    # normalize and expand a path
    path = normpath(expandvars(expanduser(path)))
    if exist and file and not isfile(path):
        raise FileNotFoundError(path)
    else:
        if file:
            dir_path = normpath(join(path, '..'))
        else:
            dir_path = path
        if parents:
            makedirs(dir_path, exist_ok=True)
    return path

class SecurityVisitor(ast.NodeVisitor):  # noqa C901
    '''
    AST-based security analyzer to detect unsafe operations in Python code.

    IMPORTANT: Method names within this class (e.g., `visit_Call`, `visit_Import`) **should not**
    be renamed to lowercase. These method names are part of the `NodeVisitor` pattern from the `ast`
    module and must remain consistant with this naming convention to function correctly.
    '''

    # **Dangerous built-in functions**
    DANGEROUS_BUILTINS = {'exec', 'eval', 'open', 'compile', 'getattr',
                          'setattr', '__import__', 'globals', 'locals', 'vars'}

    # **Dangerous os operations**
    DANGEROUS_OS_CALLS = {'system', 'popen', 'remove', 'rmdir', 'unlink', 'rename'}

    # **Dangerous sys operations**
    DANGEROUS_SYS_CALLS = {'exit', 'modules'}

    # **Dangerous modules**
    DANGEROUS_MODULES = {'pickle', 'subprocess', 'socket', 'shutil', 'requests', 'inspect', 'tempfile'}

    def visit_Call(self, node):  # noqa C901
        '''Check function calls'''
        # Direct calls to dangerous built-in functions
        if isinstance(node.func, ast.Name) and node.func.id in self.DANGEROUS_BUILTINS:
            raise ValueError(f'⚠️ Detected dangerous function call: {node.func.id}')

        # Check for __import__ calls with string arguments
        if isinstance(node.func, ast.Name) and node.func.id == '__import__':
            if node.args and isinstance(node.args[0], ast.Str):
                module_name = node.args[0].s
                if module_name in self.DANGEROUS_MODULES:
                    raise ValueError(f'⚠️ Detected dangerous module import via __import__: {module_name}')

        # Check for indirect __import__ calls (function calls that might return __import__)
        if isinstance(node.func, ast.Call):
            # Check if this is a call to a function that might return __import__
            if isinstance(node.func.func, ast.Name):
                func_name = node.func.func.id
                if func_name in ['get_import', 'import_func']:  # Common patterns
                    raise ValueError(f'⚠️ Detected suspicious function call that might return __import__: {func_name}')

        # Check for attribute access that might lead to __import__
        if isinstance(node.func, ast.Attribute):
            if isinstance(node.func.value, ast.Name) and node.func.value.id == 'ImportHelper':
                if node.func.attr == 'get_import':
                    raise ValueError('⚠️ Detected suspicious method call: ImportHelper.get_import')

        # os / sys related calls
        if isinstance(node.func, ast.Attribute) and isinstance(node.func.value, ast.Name):
            if node.func.value.id == 'os' and node.func.attr in self.DANGEROUS_OS_CALLS:
                raise ValueError(f'⚠️ Detected dangerous os call: os.{node.func.attr}')
            if node.func.value.id == 'sys' and node.func.attr in self.DANGEROUS_SYS_CALLS:
                raise ValueError(f'⚠️ Detected dangerous sys call: sys.{node.func.attr}')

        self.generic_visit(node)

    def visit_Import(self, node):
        '''Check import statements'''
        for alias in node.names:
            if alias.name in self.DANGEROUS_MODULES:
                raise ValueError(f'⚠️ Detected dangerous module import: {alias.name}')

    def visit_ImportFrom(self, node):
        '''Check from ... import statements'''
        if node.module in self.DANGEROUS_MODULES:
            raise ValueError(f'⚠️ Detected dangerous module import: {node.module}')

    def visit_Attribute(self, node):
        '''Check os.environ and tempfile usage'''
        if isinstance(node.value, ast.Name):
            if node.value.id == 'os' and node.attr == 'environ':
                raise ValueError('⚠️ Detected dangerous access: os.environ')
            if node.value.id == 'tempfile':
                raise ValueError(f'⚠️ Detected dangerous usage of tempfile: tempfile.{node.attr}')

        self.generic_visit(node)

    def visit_Lambda(self, node):
        '''Check lambda functions that might return __import__'''
        # Check if lambda body returns __import__
        if isinstance(node.body, ast.Name) and node.body.id == '__import__':
            raise ValueError('⚠️ Detected lambda function returning __import__')
        self.generic_visit(node)

    def visit_ListComp(self, node):
        '''Check list comprehensions that might contain __import__'''
        # Check if the expression in list comprehension is __import__
        if isinstance(node.elt, ast.Name) and node.elt.id == '__import__':
            raise ValueError('⚠️ Detected list comprehension containing __import__')
        self.generic_visit(node)

    def visit_FunctionDef(self, node):
        '''Check function definitions that might return __import__'''
        # Check if function returns __import__
        for stmt in node.body:
            if isinstance(stmt, ast.Return):
                if isinstance(stmt.value, ast.Name) and stmt.value.id == '__import__':
                    raise ValueError(f'⚠️ Detected function {node.name} returning __import__')
        self.generic_visit(node)

def compile_func(func_code: str, global_env: Optional[Dict[str, Any]] = None) -> Callable:
    fname = re.search(r'def\s+(\w+)\s*\(', func_code).group(1)
    module = ast.parse(func_code)
    SecurityVisitor().visit(module)
    func = compile(module, filename='<ast>', mode='exec')
    local_dict = {}
    exec(func, global_env if global_env is not None else local_dict, local_dict)
    return local_dict.pop(fname)

def obj2str(obj: Any) -> str:
    return base64.b64encode(pickle.dumps(obj)).decode('utf-8')

def str2obj(data: str) -> Any:
    return None if data is None else pickle.loads(base64.b64decode(data.encode('utf-8')))

def str2bool(v: str) -> bool:
    ''' Boolean type converter '''
    if isinstance(v, bool):
        return v
    if v.lower() in ('yes', 'true', 't', 'y', '1', 'on'):
        return True
    elif v.lower() in ('no', 'false', 'f', 'n', '0', 'off'):
        return False
    else:
        raise argparse.ArgumentTypeError('Boolean value expected.')

_TEST_MODULE_PREFIXES = ('test_', 'tmp.tests.')


def _collect_test_modules(obj):
    '''Return modules that need cloudpickle ``register_pickle_by_value``.

    We only target dynamically-generated test modules (e.g. ``tmp.tests.*`` code
    assembled at runtime) whose subprocess can't re-import them by name. Regular
    file-backed test modules are intentionally skipped: the caller must already
    arrange for subprocess import (via ``pythonpath=`` on ServerModule), and
    pickling them by value balloons the command-line payload past the Windows
    8191-char cmd limit (see PR 1069 ServerModule regression).
    '''
    modules = []
    seen = set()
    candidates = [obj]
    if hasattr(obj, '__dict__'):
        candidates.extend(obj.__dict__.values())
    for candidate in candidates:
        module_name = getattr(candidate, '__module__', None)
        if not module_name:
            continue
        if not module_name.startswith(_TEST_MODULE_PREFIXES):
            continue
        module = sys.modules.get(module_name)
        if module is None or module_name in seen:
            continue
        # File-backed modules are importable by name in the subprocess; no need
        # to embed their source by value (and doing so is what blows past the
        # Windows cmd-line limit).
        module_file = getattr(module, '__file__', None)
        if module_file and os.path.isfile(module_file):
            continue
        seen.add(module_name)
        modules.append(module)
    return modules


def dump_obj(f):
    @contextmanager
    def env_helper():
        original_cloudpickle_flag = os.environ.get('LAZYLLM_ON_CLOUDPICKLE')
        registered_modules = []
        try:
            os.environ['LAZYLLM_ON_CLOUDPICKLE'] = 'ON'
            modules = _collect_test_modules(f)
            for module in modules:
                cloudpickle.register_pickle_by_value(module)
                registered_modules.append(module)
            yield
        finally:
            for module in reversed(registered_modules):
                cloudpickle.unregister_pickle_by_value(module)
            if original_cloudpickle_flag is None:
                os.environ.pop('LAZYLLM_ON_CLOUDPICKLE', None)
            else:
                os.environ['LAZYLLM_ON_CLOUDPICKLE'] = original_cloudpickle_flag

    with env_helper():
        return None if f is None else base64.b64encode(cloudpickle.dumps(f)).decode('utf-8')

_FILE_REF_PREFIX = '@file:'


def dump_obj_to_file(f, path: str) -> str:
    '''Serialize *f* with cloudpickle, write raw bytes to *path*, and return a
    ``@file:<path>`` reference string that ``load_obj`` understands.'''
    # Reuse dump_obj so dynamically generated test modules are registered by
    # value in exactly the same way as command-line payloads.
    serialised = dump_obj(f)
    raw = cloudpickle.dumps(None) if serialised is None else base64.b64decode(serialised.encode('utf-8'))
    with open(path, 'wb') as fp:
        fp.write(raw)
    return f'{_FILE_
```

### Core Architecture Module: `lazyllm/components/core.py`
```
import lazyllm
from lazyllm import LazyLLMRegisterMetaClass
from lazyllm import LazyLLMCMD, ReadOnlyWrapper
from lazyllm import launchers, LazyLLMLaunchersBase
from typing import Union

class ComponentBase(object, metaclass=LazyLLMRegisterMetaClass):
    def __init__(self, *, launcher=launchers.empty()):  # noqa B008
        self._llm_name = None
        self.job = ReadOnlyWrapper()
        if isinstance(launcher, LazyLLMLaunchersBase):
            self._launcher = launcher
        elif isinstance(launcher, type) and issubclass(launcher, LazyLLMLaunchersBase):
            self._launcher = launcher()
        else:
            raise RuntimeError('Invalid launcher given:', launcher)

    def apply():
        raise NotImplementedError('please implement function \'apply\'')

    def cmd(self, *args, **kw) -> Union[str, tuple, list]:
        raise NotImplementedError('please implement function \'cmd\'')

    @property
    def name(self): return self._llm_name
    @name.setter
    def name(self, name): self._llm_name = name

    @property
    def launcher(self): return self._launcher

    def _get_job_with_cmd(self, *args, **kw):
        cmd = self.cmd(*args, **kw)
        cmd = cmd if isinstance(cmd, LazyLLMCMD) else LazyLLMCMD(cmd)
        return self._launcher.makejob(cmd=cmd)

    def _overwrote(self, f):
        return getattr(self.__class__, f) is not getattr(__class__, f) or \
            getattr(self.__class__, '__reg_overwrite__', None) == f

    def __call__(self, *args, **kw):
        if self._overwrote('apply'):
            assert not self._overwrote('cmd'), (
                'Cannot overwrite \'cmd\' and \'apply\' in the same class')
            assert isinstance(self._launcher, launchers.Empty), 'Please use EmptyLauncher instead.'
            return self._launcher.launch(self.apply, *args, **kw)
        else:
            job = self._get_job_with_cmd(*args, **kw)
            self.job.set(job)
            return self._launcher.launch(job)

    def __repr__(self):
        return lazyllm.make_repr('lazyllm.llm.' + self.__class__._lazy_llm_group,
                                 self.__class__.__name__, name=self.name)


register = lazyllm.Register(ComponentBase, ['apply', 'cmd'])

```

### Core Architecture Module: `lazyllm/components/deploy/text_to_speech/utils.py`
```
import os
import uuid
from lazyllm.thirdparty import scipy, numpy as np
from ...utils.file_operate import _delete_old_files
import lazyllm
from lazyllm import LOG, LazyLLMLaunchersBase
from typing import Optional
from ..base import LazyLLMDeployBase


def _sound_to_file(sound: 'np.array', file_path: str, sample_rate: int = 24000) -> str:
    scaled_audio = np.int16(sound / np.max(np.abs(sound)) * 32767)
    scipy.io.wavfile.write(file_path, sample_rate, scaled_audio)
    return [file_path]

def _sounds_to_files(sounds: list, directory: str, sample_rate: int = 24000) -> list:
    if not os.path.exists(directory):
        os.makedirs(directory)
    _delete_old_files(directory)
    unique_id = uuid.uuid4()
    path_list = []
    for i, sound in enumerate(sounds):
        file_path = os.path.join(directory, f'sound_{unique_id}_{i}.wav')
        _sound_to_file(sound, file_path, sample_rate)
        path_list.append(file_path)
    return path_list

class TTSBase(LazyLLMDeployBase):
    func = None

    def __init__(self, launcher: LazyLLMLaunchersBase = None,
                 log_path: Optional[str] = None, port: Optional[int] = None, **kw):
        super().__init__(launcher=launcher)
        self._log_path = log_path
        self._port = port

    def __call__(self, finetuned_model=None, base_model=None):
        if not finetuned_model:
            finetuned_model = base_model
        elif not os.path.exists(finetuned_model) or \
            not any(file.endswith(('.bin', '.safetensors'))
                    for _, _, filenames in os.walk(finetuned_model) for file in filenames):
            LOG.warning(f'Note! That finetuned_model({finetuned_model}) is an invalid path, '
                        f'base_model({base_model}) will be used')
            finetuned_model = base_model
        return lazyllm.deploy.RelayServer(port=self._port, func=self.__class__.func(finetuned_model),
                                          launcher=self._launcher, log_path=self._log_path, cls='tts')()

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1220** (2026-07-14): **[Bug]:  Flow.ifs - Error in `_FuncWrap`: <lambda>() missing 1 required positional argument: 'x'**
  *Symptoms*: ### Environment Information  python 3.12, MacOS 26.4.1  ### Reproduction Steps  ``` >>> import lazyllm >>> cond = lambda x: x>0 >>> t_p = lambda x: x*2 >>> f_p = lambda x: x >>>  >>> ifs_flow = lazyllm.ifs(cond, t_p, f_p) >>>  >>> res1 = ifs_flow(10) ```  ### Expected Behavior  No error log  ### Actual Behavior  Error log: ``` 2026-07-09 15:16:04 lazyllm WARNING (lazyllm.tracing.collect.runtime:138, 93565): Cannot import module `opentelemetry.sdk.resources`, please install it by `pip install opentelemetry-sdk>=1.27.0,<2.0.0` 2026-07-09 15:16:04 lazyllm ERROR (lazyllm.hook:309, 93565): Error in `_FuncWrap`: <lambda>() missing 1 required positional argument: 'x' ```  ### Screenshots / Logs  _No response_

- **Issue #1071** (2026-03-31): **[Bug]: RAG 最小示例有问题**
  *Symptoms*: ### Environment Information  LazyLLM 0.7.6 macos 26  ### Reproduction Steps  跟着做新手入门教程，复现 https://docs.lazyllm.ai/zh-cn/stable/Learn/learn/ 中 4.2 的 RAG 最小例子中出问题了。  ``` import lazyllm from lazyllm import bind  # 加载文档 documents = lazyllm.Document(     dataset_path="./zig-course/course" )  # 构造模型 prompt = "下面是一个问题，运用所学知识来正确回答提问." # llm = lazyllm.OnlineChatModule(source="doubao", model="doubao-seed-2-0-lite-260215") llm = lazyllm.OnlineChatModule(     source="sensenova",     model="SenseNova-V6-5-Pro", )  # 设置模型 prompt llm.prompt(lazyllm.ChatPrompter(instruction=prompt, extra_keys=["context_str"]))  retriever = lazyllm.Retriever(     doc=documents, group_name="CoarseChunk", similarity="bm25_chinese", topk=3 )  with lazyllm.pipeline() as rag_ppl:     rag_ppl.retriever = retriever     rag_ppl.formatter = (         lambda nodes, query: dict(context_str=nodes, query=query)     ) | bind(query=rag_ppl.input)     rag_ppl.llm = llm  question = "zig 如何与 C 交互？" answer = rag_ppl(question) print(answer)   pass ```  ### Expected Behavior  没有错误  ### Actual Behavior  终端的输出是 ``` 2026-03-26 12:40:02 lazyllm ERROR (lazyllm.module.module:446, 6079): An error occured in <class 'lazyllm.module.llms.onlinemodule.supplier.sensenova.SenseNovaChat'>. ``` 没有有效信息。  debug 了一下，应该是lazyllm/components/prompter/builtinPrompt.py 的168行的 lambda 表达式中的 kv[1]是个列表，而 str.replace 的第二个参数要求是 str，所以报错。  ### Screenshots / Logs  <img width="270" height="311" alt="Image" src="https://github.com/user-attachments/assets/9742ef3d
  **Post-Mortem & Fix Analysis**:
  > 把 https://github.com/LazyAGI/LazyLLM/blob/f403dc3ff22c0bdb35097cfff3edf15d2a6c48d7/lazyllm/components/prompter/builtinPrompt.py#L139 改为以下的就正常了  ```python         combined_context = {}         for k, v in kwargs.items():             combined_context[k] = '\n'.join([node.content for node in v])          return (reduce(lambda s, kv: s.replace(f'{{{kv[0]}}}', kv[1]),                        combined_context.items(),                        instruction)                 if len(kwargs) > 0 else instruction,                 list(input.values())[0] if input else '') ```
  > <img width="1397" height="695" alt="Image" src="https://github.com/user-attachments/assets/a73a64dc-c777-4bac-83fa-ccc75763c81d" />  已解决，见 https://github.com/LazyAGI/LazyLLM/pull/1073

- **Issue #976** (2026-01-28): **[Bug]: VLM models fail with 400 error when using chat history in Gradio**
  *Symptoms*: ### Environment Information  venv:lazyllm; python:3.10.12,gradio=5.49.1and 6.3.0  ### Reproduction Steps  When using `OnlineChatModule` configured with a VLM (Vision-Language Model), enabling the "Use Context" feature in WebModule causes the second conversation turn to fail with a 400 API error:  ```bash {"error":{"code":3,"details":[],"message":"invalid arguments"}} ```  1. Use a VLM model (e.g., `SenseNova-V6-5-Pro`) 2. Start WebModule:  ```python import lazyllm chat = lazyllm.OnlineChatModule(model='SenseNova-V6-5-Pro', source='sensenova') lazyllm.WebModule(chat, port=range(23466, 23470), stream=True).start().wait() ```  3. Check "Use Context" checkbox in the web interface 4. First conversation turn: Success 5. Second conversation turn: Fails with 400 error  <img width="1120" height="520" alt="Image" src="https://github.com/user-attachments/assets/da91c0a5-5764-4736-9e2f-576f61903d67" />  ### Expected Behavior  Chat history should be correctly passed to the VLM API to support multi-turn conversations.  ### Actual Behavior  The second conversation turn fails with llm_chat_history parameter causing API to return "invalid arguments".  ### Screenshots / Logs  Text-only models work fine in the same scenario. Only VLM-type models are affected.

- **Issue #938** (2026-01-16): **[Bug]: When using RAG service, some exceptions met**
  *Symptoms*: ### Environment Information  macOS  ### Reproduction Steps  1. Rag CookBook Chapter 8 - parsing service usage bug 2. modify error log and exception when upserting segments failed  ### Expected Behavior  fix these bugs.  ### Actual Behavior   -   ### Screenshots / Logs  _No response_
  **Post-Mortem & Fix Analysis**:
  > - [ ] Rag CookBook Chapter 8 - parsing service usage bug - [ ] modify error log and exception when upserting segments failed - [ ] modify input parameters for Retriever
  > Rag CookBook Chapter 8 - parsing service usage bug #942 

- **Issue #929** (2026-01-08): **[Bug]: Tool-returned Markdown images fail to render in WebModule (Agent + streaming)**
  *Symptoms*: ### Environment Information  Linux; Python3.10.9; venv:lazylllm;gradio==4.44.1 and gradio==5.49.1;  ### Reproduction Steps  **Gradio==4.44.1：When using a plain callable as the backend module, Markdown images render correctly.**  ```python from lazyllm import WebModule  def func(x):     return "# Test\nHere is an image:\n\n![Temperature](/home/mnt/chenzhe1/WorkDir/images/temperature_chart.png)"  WebModule(     func,     port=12347,     title="Test Markdown",     static_paths="/home/mnt/chenzhe1/WorkDir/images" ).start().wait() ```  <img width="1124" height="440" alt="Image" src="https://github.com/user-attachments/assets/23a9e424-a7dd-492d-bb32-a8d9bd250880" />  **But, When Gradio==5.49.1, it is not rendered correctly in the Gradio Chatbot.**  <img width="1732" height="613" alt="Image" src="https://github.com/user-attachments/assets/ba964d7e-2992-4e89-a5df-a83c3028281e" />  **Gradio==4.44.1：When using `ReactAgent` with a tool that returns a Markdown image, the image is not rendered, although the log shows the correct Markdown string.**  ```python from lazyllm import OnlineChatModule, WebModule from lazyllm.tools import ReactAgent, fc_register  @fc_register("tool") def print_img() -> str:     return "![Temperature Chart](/home/mnt/chenzhe1/WorkDir/images/temperature_chart.png)"  llm = OnlineChatModule() agent = ReactAgent(llm, tools=["print_img"])  WebModule(     agent,     port=12351,     title="Agent",     static_paths="/home/mnt/chenzhe1/WorkDir/images" ).start().wait() ``` 

- **Issue #914** (2025-12-26): **[Bug]: 在lazycraft中接入最新的lazyllm报错：画布编辑有问题**
  *Symptoms*: ### Environment Information  linux/ubuntu 22.04.05  ### Reproduction Steps  接入main分支的lazyllm作为lazycraft的submoudle使用报错（原0.7.0是没有问题的）：  ![Image](https://github.com/user-attachments/assets/88a9c66a-2892-425d-88dd-43bcf157be93)  然后，lazycraft前端使用之前的工作流，再次运行调试后报错：  ![Image](https://github.com/user-attachments/assets/ca12eee0-c987-48b7-9d24-2b83a3a1b7bb)  ### Expected Behavior  预期能在lazycraft中正常使用main分支的lazyllm（后续lazyllm将接入其他平台，如AI Ping服务等）  ### Actual Behavior  创建工作流后，调试报错（lazyllm v0.7.0是ok的） ![Image](https://github.com/user-attachments/assets/0314ae7c-d830-400b-bbc1-3ad4c72b8af9)  ### Screenshots / Logs  _No response_
  **Post-Mortem & Fix Analysis**:
  > solved in https://github.com/LazyAGI/LazyLLM/pull/915

- **Issue #894** (2025-12-23): **[Bug]: LazyLLM cannot parse response format of vlm/llm deployed by vllm v0.12.0**
  *Symptoms*: ### Environment Information  linux  ### Reproduction Steps  ```python import lazyllm  url = 'http://xxxxx:25121/v1/'  infer_conf = {     "temperature": 0.4,     "top_p": 0.75,     "top_k": 25,      "stream": True,     "presence_penalty": 0.1, }  m = lazyllm.TrainableModule('qwen3-32b').deploy_method(lazyllm.deploy.vllm, url=url) m1 = m.share().prompt('回复后加：咯咯哒') res = m1('hi', **infer_conf) print("res: ", res) ```  ### Expected Behavior  The response is correct.   ### Actual Behavior  <img width="1294" height="728" alt="Image" src="https://github.com/user-attachments/assets/3d80e118-800a-40a5-b26a-1a6234131645" />  ### Screenshots / Logs  New format by vllm:  <img width="1550" height="670" alt="Image" src="https://github.com/user-attachments/assets/ea4d9765-f440-4476-83bf-5bad3f44d630" />
  **Post-Mortem & Fix Analysis**:
  > lazyllm.TrainableModule('Qwen3-32B', stream=True) 或 infer_conf = {     "temperature": 0.4,     "top_p": 0.75,     "top_k": 25,      "stream_output": True,     "presence_penalty": 0.1, }  看起来要统一一下stream参数设置了
  > > lazyllm.TrainableModule('Qwen3-32B', stream=True) 或 infer_conf = { "temperature": 0.4, "top_p": 0.75, "top_k": 25, "stream_output": True, "presence_penalty": 0.1, } >  > 看起来要统一一下stream参数设置了  Nice!

- **Issue #887** (2026-01-08): **[Bug]: TempDocRetriever 无法正常使用**
  *Symptoms*: ### Environment Information  lazyllmplatform  ### Reproduction Steps  官网使用示例 <img width="807" height="170" alt="Image" src="https://github.com/user-attachments/assets/67b1b998-70ea-43e5-8208-0741e9f6dba4" />   ### Expected Behavior  应该取回files = ["机器学习是AI的核心领域。深度学习是其重要分支。"]中的部分数据  ### Actual Behavior  执行报错 <img width="1577" height="285" alt="Image" src="https://github.com/user-attachments/assets/1eb7a147-d761-4f48-a60b-913577af8055" />  ### Screenshots / Logs  _No response_
  **Post-Mortem & Fix Analysis**:
  > 此为文档错误，我们下个版本会加上文档中代码检查的能力
  > 已更新文档，此外加了ContextRetriever用于上下文检索

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

### Incident Patch 1: `d11b0d4a` (2026-09-24)
**Commit Message**: fix: accept JSON-encoded run_script arguments (#1328)

**File**: `lazyllm/tools/agent/toolsManager.py` (modified, +56/-0)
```diff
@@ -1243,11 +1243,67 @@ def sandbox(self):
     def sandbox(self, sandbox):
         self._sandbox = sandbox
 
+    @staticmethod
+    def _is_skill_run_script_tool(tool: ModuleTool) -> bool:
+        if tool.runtime_metadata.tool_source != 'skill':
+            return False
+
+        schema = tool.params_schema.model_json_schema()
+        args_schema = (schema.get('properties') or {}).get('args')
+        if not isinstance(args_schema, dict):
+            return False
+        variants = args_schema.get('anyOf') or args_schema.get('oneOf') or [args_schema]
+        value_variants = [
+            variant for variant in variants
+            if isinstance(variant, dict) and variant.get('type') != 'null'
+        ]
+        if len(value_variants) != 1:
+            return False
+        value_schema = value_variants[0]
+        return value_schema.get('type') == 'array' \
+            and (value_schema.get('items') or {}).get('type') == 'string'
+
+    @staticmethod
+    def _run_script_args_failure(received: str):
+        message = (
+            'Invalid arguments: args: expected a JSON array of strings, '
+            f'received {received}.'
+        )
+        return tool_failure(message + ' Example: {"args":["--query","test"]}.')
+
+    @staticmethod
+    def _normalize_run_script_args(tool_arguments: Dict[str, Any]):
+        if 'args' not in tool_arguments or not isinstance(tool_arguments['args'], str):
+            return tool_arguments, None
+
+        try:
+            parsed_args = std_json.loads(tool_arguments['args'])
+        except (TypeError, ValueError):
+            return None, ToolManager._run_script_args_failure('an invalid JSON string')
+
+        if not isinstance(parsed_args, list):
+            return None, ToolManager._run_script_args_failure(type(parsed_args).__name__)
+
+        invalid_index = next(
+            (index for index, item in enumerate(parsed_args) if not isinstance(item, str)),
+            None,
+        )
+        if invalid_index is not None:
+            return None, ToolManager._run_script_args_failure(f'a non-string item at index {invalid_index}')
+
+        normalized = dict(tool_arguments)
+        normalized['args'] = parsed_args
+        return normalized, None
+
     def _validate_tool(self, tool_name: str, tool_arguments: Dict[str, Any]):
         entry = self._tool_call.get(tool_name)
         if not entry:
             LOG.error(f'cannot find tool named [{tool_name}]')
             return None, None
+        if tool_name in ('run_script', 'run_skill_script') and self._is_skill_run_script_tool(entry):
+            tool_arguments, normalization_failure = self._normalize_run_script_args(tool_arguments)
+            if normalization_failure is not None:
+                return None, normalization_failure
         try:
             return entry._validate_input(tool_arguments), None
         except ValidationError as error:
```

**File**: `pyproject.toml` (modified, +0/-1)
```diff
@@ -74,7 +74,6 @@ markers = [
     "skip_on_linux: mark tests to skip on Linux",
     "skip_on_cpp: mark tests to skip in C++ Build + Python Regression job",
 ]
-order_group_scope = "class"
 
 [tool.poetry.dependencies]
 appdirs = { version = "*", optional = true }
```

**File**: `tests/basic_tests/Tools/test_tool_failure_recovery.py` (modified, +111/-0)
```diff
@@ -5,6 +5,7 @@
 import pytest
 
 from lazyllm.tools.agent import ToolExecutionError
+from lazyllm.tools.agent.skill_manager import SkillManager
 from lazyllm.tools.agent.toolsManager import ToolManager, fc_register
 from lazyllm.tools.git import GitLab, LocalGit
 from lazyllm.tools.git.review.poster import _submit_review
@@ -89,6 +90,25 @@ def flexible_search(query: str, **kwargs):
     return {'query': query, **kwargs}
 
 
+def run_script(args: str):
+    '''Return custom tool arguments unchanged.
+
+    Args:
+        args (str): Custom tool arguments.
+    '''
+    return args
+
+
+@fc_register(host_file='NONE', tool_source='skill')
+def run_skill_script(args: str):
+    '''Return custom tool arguments unchanged.
+
+    Args:
+        args (str): Custom tool arguments.
+    '''
+    return args
+
+
 def translated_permission_failure(resource: str):
     '''Translate a domain failure into a permission failure.
 
@@ -116,6 +136,18 @@ def _call(name, arguments):
     }
 
 
+def _skill_script_manager(tmp_path):
+    skill_manager = SkillManager(dir=str(tmp_path), sandbox=object())
+    calls = []
+
+    def execute(**kwargs):
+        calls.append(kwargs)
+        return {key: value for key, value in kwargs.items() if value is not None}
+
+    skill_manager._run_loaded_skill_script = execute
+    return ToolManager(skill_manager.get_skill_tools()), calls
+
+
 def test_unknown_tool_precedes_argument_validation_and_suggests_visible_tool():
     manager = ToolManager([typed_search])
     call = {'function': {'name': 'typed_seach', 'arguments': '{not-json'}}
@@ -222,6 +254,85 @@ def test_repairable_json_is_parsed_before_schema_validation():
     }
 
 
+def test_run_skill_script_accepts_json_encoded_string_args(tmp_path):
+    manager, calls = _skill_script_manager(tmp_path)
+
+    result = manager(_call('run_skill_script', {
+        'name': 'valuation-analysis',
+        'rel_path': 'scripts/dcf_calculator.py',
+        'args': json.dumps(['--fcf', '250']),
+    }))[0]
+
+    assert result == {'ok': True, 'value': {
+        'name': 'valuation-analysis',
+        'rel_path': 'scripts/dcf_calculator.py',
+        'args': ['--fcf', '250'],
+    }}
+    assert len(calls) == 1
+    assert calls[0]['args'] == ['--fcf', '250']
+
+
+def test_run_skill_script_keeps_native_list_args(tmp_path):
+    manager, calls = _skill_script_manager(tmp_path)
+
+    result = manager(_call('run_skill_script', {
+        'name': 'valuation-analysis',
+        'rel_path': 'scripts/dcf_calculator.py',
+        'args': ['--fcf', '250'],
+    }))[0]
+
+    assert result['ok'] is True
+    assert result['value']['args'] == ['--fcf', '250']
+    assert len(calls) == 1
+    assert calls[0]['args'] == ['--fcf', '250']
+
+
+def test_run_skill_script_passes_shell_metacharacters_as_literal_args(tmp_path):
+    manager, calls = _skill_script_manager(tmp_path)
+    args = ['--name', '$(touch /private/tmp/should-not-exist)', '; echo injected']
+
+    result = manager(_call('run_skill_script', {
+        'name': 'valuation-analysis',
+        'rel_path': 'scripts/dcf_calculator.py',
+        'args': json.dumps(args),
+    }))[0]
+
+    assert result['ok'] is True
+    assert len(calls) == 1
+    assert calls[0]['args'] == args
+
+
+@pytest.mark.parametrize('encoded_args, expected', [
+    ('--fcf 250', 'invalid JSON string'),
+    ('{"name": "250"}', 'received dict'),
+    ('[1]', 'non-string item at index 0'),
+    ('[["--fcf"]]', 'non-string item at index 0'),
+    (json.dumps(json.dumps(['--fcf'])), 'received str'),
+])
+def test_run_skill_script_rejects_invalid_json_encoded_args(tmp_path, encoded_args, expected):
+    manager, calls = _skill_script_manager(tmp_path)
+
+    result = manager(_call('run_skill_script', {
+        'name': 'valuation-analysis',
+        'rel_path': 'scripts/dcf_calculator.py',
+        'args': encoded_args,
+    }))[0]
+
+    assert result['ok'] is False
+    assert result['value'].startswith('Invalid arguments: args: expected a JSON array of strings')
+    assert expected in result['value']
+    assert 'Example: {"args":["--query","test"]}.' in result['value']
+    assert calls == []
+
+
+@pytest.mark.parametrize('custom_tool', [run_script, run_skill_script])
+@pytest.mark.parametrize('args', ['--fcf 250', json.dumps(['--fcf', '250'])])
+def test_custom_script_tool_string_args_are_not_normalized(custom_tool, args):
+    result = ToolManager([custom_tool])(_call(custom_tool.__name__, {'args': args}))[0]
+
+    assert result == {'ok': True, 'value': args}
+
+
 def test_fixed_schema_forbids_extra_but_kwargs_accepts_it():
     fixed = ToolManager([typed_search])(
         _call('typed_search', {'query': 'LazyLLM', 'qurey': 'typo'}),
```

---

### Incident Patch 2: `9d330c1e` (2026-09-16)
**Commit Message**: fix(search): bound previews and share 16K character content pages (#1322)

**File**: `lazyllm/docs/tools/search.py` (modified, +37/-147)
```diff
@@ -14,6 +14,7 @@
 - 如果用户问题包含多个无关主题、实体、产品、关键词或问题，应分别调用搜索工具，不要把它们合并成一个 query。
 - query 应来自用户的核心问题，只加入有助于检索的时间、机构、产品、领域或站点等约束。
 - 返回的 title、url、snippet 和 metadata 是检索证据；不要编造未返回的来源。
+- 搜索结果 snippet 最多 700 字符，截断时 extra.truncated 为 True；显式请求的答案和原文也仅返回最多 700 字符的预览。
 - 当 snippet 或 metadata 不足以支撑回答时，再调用 get_content(item) 或 get_contents(items) 深读结果。
 '''
 
@@ -23,6 +24,7 @@
 - If the user asks about multiple unrelated topics, entities, products, keywords, or questions, call the search tool separately for each one instead of merging them into one query.
 - Build query from the user's core question and include only retrieval-useful constraints such as date, organization, product, domain, or site.
 - Treat returned titles, URLs, snippets, and metadata as search evidence; do not fabricate sources that were not returned.
+- Search result snippets are capped at 700 characters with extra.truncated=True when shortened; explicitly requested answers and raw content are also capped at 700 characters.
 - Use get_content(item) or get_contents(items) when snippets or metadata are not enough to support the answer.
 '''
 
@@ -31,6 +33,7 @@
 - 适用于论文、方法、模型、benchmark、dataset、算法和科研问题。
 - 每次调用只处理一个研究意图；不同论文、方法、模型或 benchmark 主题应分开搜索，不要混在一个 query 中。
 - 优先使用返回的 title、abstract/snippet、authors、year、venue/source、DOI 和 metadata 作为证据。
+- 搜索结果 snippet 最多 700 字符，截断时 extra.truncated 为 True。
 - 当摘要或元数据不足以支撑回答时，再调用 get_content(item) 深读结果。
 '''
 
@@ -39,6 +42,7 @@
 - Use for papers, methods, models, benchmarks, datasets, algorithms, and research questions where academic evidence is appropriate.
 - Each call handles exactly one research intent; split unrelated papers, methods, models, or benchmark topics into separate calls instead of mixing them in one query.
 - Prefer returned title, abstract/snippet, authors, year, venue/source, DOI, and metadata as evidence.
+- Search result snippets are capped at 700 characters with extra.truncated=True when shortened.
 - Use get_content(item) when the abstract or metadata is not enough to support the answer.
 '''
 
@@ -105,47 +109,55 @@
 ''')
 
 add_chinese_doc('SearchBase.get_content', '''
-根据单条搜索结果（search/forward 返回的 item）获取正文，并保留来源身份。
+分段读取单条搜索结果的可获取文本，保留来源身份。默认每次最多返回 16384 字符。
 
-默认行为：请求 item 的 url，将响应 HTML 转为纯文本并写入 content。子类可重写以使用 API 获取正文（如 Wikipedia 词条全文、arXiv 摘要、Stack Overflow 问答正文等）。
+Tavily、Google、Bing、Bocha、Tencent、Google Books 获取 URL 页面的可读文本，不保证是论文或书籍全文；Wikipedia 获取词条；arXiv 和 Semantic Scholar 获取论文摘要，不是论文全文；Stack Overflow 获取问题及可获取的采纳答案，不是所有答案。
 
 Args:
-    item (Dict[str, Any]): 至少包含 url 的搜索结果项（_make_result 格式）。
+    item (Dict[str, Any]): 搜索结果项。
+    offset (int): 已提取文本的字符偏移，默认 0；续读使用返回的 next_offset。
+    limit (int): 本次最多返回正文字符数，默认及最大 16384；必须为正整数，超限取上限，offset 必须为非负整数。
 
 Returns:
-    Dict[str, Any]: 包含 title、url、snippet、source、extra 和 content；正文获取失败时 content 为空字符串。
+    Dict[str, Any]: title、url、snippet、source、extra、content。extra.content_read 包含 content_type、offset、limit、truncated、fallback；正常读取还包含 more 和 next_offset。more=True 时按 next_offset 继续，more=False 仅表示当前 content_type 的可获取文本已到末尾，不表示读完论文。fallback=True 时不给续读游标，不能把失败或摘要预览当成全文读完。每次重新获取内容，动态网页变化时分页可能不稳定。
 ''')
 
 add_english_doc('SearchBase.get_content', '''
-Fetch full body text for a single search result item while preserving its source identity.
+Read a page of available text for a search result, preserving source identity. Returns at most 16384 characters by default.
 
-Default: GET the item URL, convert response HTML to plain text, and store it in content. Subclasses may override to use APIs (e.g. Wikipedia full page, arXiv abstract, Stack Overflow Q&A body).
+Tavily, Google, Bing, Bocha, Tencent and Google Books read the linked webpage, not necessarily a full paper or book. Wikipedia reads an article. Arxiv and SemanticScholar read abstracts, not full papers. StackOverflow reads the question and available accepted answer, not all answers.
 
 Args:
-    item (Dict[str, Any]): Search result item with at least url (_make_result format).
+    item (Dict[str, Any]): Search result item.
+    offset (int): Character offset in extracted text, default 0. Continue using returned next_offset.
+    limit (int): Positive maximum content characters, default and maximum 16384; larger values are capped. offset must be a non-negative integer.
 
 Returns:
-    Dict[str, Any]: title, url, snippet, source, extra, and content. content is empty on fetch failure.
+    Dict[str, Any]: title, url, snippet, source, extra, content. extra.content_read contains content_type, offset, limit, truncated, fallback, and on successful reads more and next_offset. When more=True, continue using next_offset. more=False marks only the end of the available content_type, not full-paper completion. Fallbacks omit cursors and must not be treated as successful full reads. Each call fetches again; changing webpages may produce unstable pagination.
 ''')
 
 add_chinese_doc('SearchBase.get_contents', '''
 根据多条搜索结果批量获取正文并保留每条来源身份。
 
 Args:
     items (List[Dict[str, Any]]): 搜索结果列表（_make_
```

**File**: `lazyllm/tools/tools/search/arxiv_search.py` (modified, +6/-6)
```diff
@@ -15,11 +15,11 @@ def __init__(self, base_url: str = 'https://export.arxiv.org/api/query',
         self._url = base_url
         self._timeout = timeout
 
-    def get_content(self, item: Dict[str, Any]) -> Dict[str, Any]:
+    def _fetch_content_result(self, item: Dict[str, Any]) -> Dict[str, Any]:
         url = item.get('url') or ''
         m = re.search(r'/abs/([\d.]+(?:v\d+)?)', url) if url else None
         if not m:
-            return super().get_content(item)
+            return super()._fetch_content_result(item)
         arxiv_id = m.group(1)
         try:
             resp = httpx.get(
@@ -30,17 +30,17 @@ def get_content(self, item: Dict[str, Any]) -> Dict[str, Any]:
             resp.raise_for_status()
             text = resp.text
         except Exception:
-            return super().get_content(item)
+            return super()._fetch_content_result(item)
         ns = {'atom': 'http://www.w3.org/2005/Atom'}
         try:
             root = xml.etree.ElementTree.fromstring(text)
         except xml.etree.ElementTree.ParseError:
-            return super().get_content(item)
+            return super()._fetch_content_result(item)
         for entry in root.findall('atom:entry', ns):
             summary_el = entry.find('atom:summary', ns)
             if summary_el is not None and summary_el.text:
-                return _make_content_result(item, summary_el.text.strip().replace('\n', ' '))
-        return super().get_content(item)
+                return _make_content_result(item, summary_el.text.strip().replace('\n', ' '), content_type='abstract')
+        return super()._fetch_content_result(item)
 
     def search(self, query: str, max_results: int = 10,
                sort_by: str = 'relevance') -> List[dict]:
```

**File**: `lazyllm/tools/tools/search/base.py` (modified, +60/-13)
```diff
@@ -18,6 +18,18 @@
 _EXTRA_KEY = 'extra'
 
 
+CONTENT_CHARS = 16384
+PREVIEW_CHARS = 700
+
+
+def _content_window(offset: int, limit: int):
+    if type(offset) is not int or offset < 0:
+        raise ValueError('offset must be a non-negative integer')
+    if type(limit) is not int or limit <= 0:
+        raise ValueError('limit must be a positive integer')
+    return offset, min(limit, CONTENT_CHARS)
+
+
 def _html_to_text(html: str) -> str:
     html = re.sub(r'<script[^>]*>.*?</script>', '', html, flags=re.DOTALL | re.IGNORECASE)
     html = re.sub(r'<style[^>]*>.*?</style>', '', html, flags=re.DOTALL | re.IGNORECASE)
@@ -27,25 +39,32 @@ def _html_to_text(html: str) -> str:
 
 
 def _make_result(title: str, url: str, snippet: str = '', source: str = '', **extra: Any) -> Dict[str, Any]:
-    item = {
-        _TITLE_KEY: title,
-        _URL_KEY: url,
-        _SNIPPET_KEY: snippet,
-        _SOURCE_KEY: source,
-    }
+    snippet = str(snippet or '')
+    if len(snippet) > PREVIEW_CHARS:
+        snippet = snippet[:PREVIEW_CHARS]
+        extra['truncated'] = True
+    for key in ('raw_content', 'content', 'answer'):
+        if isinstance(extra.get(key), str) and len(extra[key]) > PREVIEW_CHARS:
+            extra[key] = extra[key][:PREVIEW_CHARS]
+            extra['truncated'] = True
+    item = {_TITLE_KEY: title, _URL_KEY: url, _SNIPPET_KEY: snippet, _SOURCE_KEY: source}
     if extra:
         item[_EXTRA_KEY] = extra
     return item
 
 
-def _make_content_result(item: Dict[str, Any], content: str) -> Dict[str, Any]:
+def _make_content_result(item: Dict[str, Any], content: str, *,
+                         content_type: Optional[str] = None, fallback: bool = False) -> Dict[str, Any]:
     extra = item.get(_EXTRA_KEY)
+    extra = dict(extra) if isinstance(extra, dict) else {}
+    if content_type is not None:
+        extra['content_read'] = {'content_type': content_type, 'fallback': fallback}
     return {
         _TITLE_KEY: str(item.get(_TITLE_KEY) or ''),
         _URL_KEY: str(item.get(_URL_KEY) or item.get('link') or ''),
         _SNIPPET_KEY: str(item.get(_SNIPPET_KEY) or ''),
         _SOURCE_KEY: str(item.get(_SOURCE_KEY) or ''),
-        _EXTRA_KEY: dict(extra) if isinstance(extra, dict) else {},
+        _EXTRA_KEY: extra,
         'content': str(content or ''),
     }
 
@@ -124,8 +143,36 @@ def _fetch_content_text(self, item: Dict[str, Any]) -> str:
         except Exception:
             return ''
 
-    def get_content(self, item: Dict[str, Any]) -> Dict[str, Any]:
-        return _make_content_result(item, self._fetch_content_text(item))
-
-    def get_contents(self, items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
-        return [self.get_content(it) for it in items]
+    def _fetch_content_result(self, item: Dict[str, Any]) -> Dict[str, Any]:
+        content = self._fetch_content_text(item)
+        return _make_content_result(item, content, content_type='webpage', fallback=not bool(content))
+
+    def get_content(self, item: Dict[str, Any], offset: int = 0, limit: int = CONTENT_CHARS) -> Dict[str, Any]:
+        offset, limit = _content_window(offset, limit)
+        result = self._fetch_content_result(item)
+        content = result['content']
+        extra = result['extra']
+        read = dict(extra.get('content_read') or {})
+        fallback = read.get('fallback', False)
+        start = 0 if fallback else offset
+        result['content'] = content[start:start + limit]
+        result['snippet'] = result['snippet'][:700]
+        extra.pop('content', None)
+        extra.pop('raw_content', None)
+        read.update(offset=None if fallback else offset, limit=limit, truncated=len(content) > start + limit)
+        if not fallback:
+            next_offset = offset + len(result['content'])
+            read.update(more=next_offset < len(content), next_offset=next_offset)
+        extra['content_read'] = read
+        return result
+
+    def get_contents(self, items: List[Dict[str, Any]], offset: int = 0,
+                     limit: int = CONTENT_CHARS) -> List[Dict[str, Any]]:
+        offset, limit = _content_window(offset, limit)
+        if not items:
+            return []
+        if len(items) > limit:
+            raise ValueError('item count exceeds the batch character budget')
+        per_item, remainder = divmod(limit, len(items))
+        return [self.get_content(item, offset=offset, limit=per_item + (index < remainder))
+                for index, item in enumerate(items)]
```

**File**: `lazyllm/tools/tools/search/sciverse_search.py` (modified, +34/-10)
```diff
@@ -2,7 +2,7 @@
 
 from lazyllm.thirdparty import httpx
 
-from .base import SearchBase, _make_content_result, _make_result
+from .base import SearchBase, _make_content_result, _make_result, _content_window, CONTENT_CHARS
 
 
 _DEFAULT_META_FIELDS = [
@@ -54,15 +54,16 @@ def __init__(self, api_key: Optional[str] = None,
     def get_content(
         self,
         item: Dict[str, Any],
-        offset: Optional[int] = None,
-        limit: int = 700,
+        offset: int = 0,
+        limit: int = CONTENT_CHARS,
     ) -> Dict[str, Any]:
+        offset, limit = _content_window(offset, limit)
         extra = item.get('extra') or {}
         doc_id = item.get('doc_id') or extra.get('doc_id')
+        content = None
+        data = {}
         if doc_id:
-            params: Dict[str, Any] = {'doc_id': doc_id}
-            if offset is not None:
-                params.update({'offset': max(0, int(offset)), 'limit': max(1, int(limit))})
+            params: Dict[str, Any] = {'doc_id': doc_id, 'offset': offset, 'limit': limit}
             try:
                 resp = httpx.get(
                     f'{self._base_url}/content',
@@ -72,12 +73,35 @@ def get_content(
                 )
                 resp.raise_for_status()
                 data = resp.json()
-                if isinstance(data, dict) and data.get('text'):
-                    return _make_content_result(item, data['text'])
+                if isinstance(data, dict) and isinstance(data.get('text'), str):
+                    content = data['text']
             except Exception:
                 pass
-        fallback = extra.get('content') or item.get('snippet')
-        return _make_content_result(item, fallback) if fallback else super().get_content(item)
+        fallback = content is None
+        if fallback:
+            content = str(extra.get('content') or item.get('snippet') or self._fetch_content_text(item))
+        result = _make_content_result(item, content, content_type='search_preview' if fallback else 'document')
+        result['content'] = content[:limit]
+        result['snippet'] = result['snippet'][:700]
+        result['extra'].pop('content', None)
+        result['extra'].pop('raw_content', None)
+        # Keep read metadata separate from search-hit offsets and snippet truncation.
+        result['extra']['content_read'] = {
+            'content_type': 'search_preview' if fallback else 'document',
+            'offset': None if fallback else offset,
+            'limit': limit,
+            'truncated': len(content) > limit,
+            'fallback': fallback,
+        }
+        if not fallback and len(content) <= limit:
+            more, next_offset = data.get('more'), data.get('next_offset')
+            if (isinstance(more, bool) and type(next_offset) is int
+                    and (next_offset > offset if more else next_offset >= offset)):
+                result['extra']['content_read'].update(more=more, next_offset=next_offset)
+        if not fallback and 'more' not in result['extra']['content_read']:
+            result['extra']['content_read']['pagination_error'] = (
+                'response_exceeds_limit' if len(content) > limit else 'invalid_continuation')
+        return result
 
     def search(self, query: str, topk: int = 5, include_content: bool = True,
                search_type: Literal['agentic', 'meta'] = 'agentic',
```

**File**: `lazyllm/tools/tools/search/semantic_scholar_search.py` (modified, +11/-6)
```diff
@@ -16,23 +16,28 @@ def __init__(self, api_key: Optional[str] = None,
         self._timeout = timeout
         self._base = 'https://api.semanticscholar.org/graph/v1'
 
-    def get_content(self, item: Dict[str, Any]) -> Dict[str, Any]:
+    def _fetch_content_result(self, item: Dict[str, Any]) -> Dict[str, Any]:
         extra = item.get('extra') or {}
         paper_id = extra.get('paperId')
         if not paper_id:
             snippet = item.get('snippet', '')
             if snippet:
-                return _make_content_result(item, snippet)
-            return super().get_content(item)
+                return _make_content_result(item, snippet, content_type='search_preview', fallback=True)
+            return super()._fetch_content_result(item)
         url = f'{self._base}/paper/{paper_id}'
         try:
             resp = self._request('GET', url, params={'fields': 'abstract'}, timeout=self._timeout)
             data = resp.json()
         except Exception:
             snippet = item.get('snippet') or ''
-            return _make_content_result(item, snippet) if snippet else super().get_content(item)
-        content = (data.get('abstract') or '').strip() or (item.get('snippet') or '')
-        return _make_content_result(item, content)
+            if snippet:
+                return _make_content_result(item, snippet, content_type='search_preview', fallback=True)
+            return super()._fetch_content_result(item)
+        content = (data.get('abstract') or '').strip()
+        if not content:
+            snippet = item.get('snippet') or ''
+            return _make_content_result(item, snippet, content_type='search_preview', fallback=True)
+        return _make_content_result(item, content, content_type='abstract')
 
     def search(self, query: str, limit: int = 10,
                fields: Optional[str] = None) -> List[Dict[str, Any]]:
```

**File**: `lazyllm/tools/tools/search/stackoverflow_search.py` (modified, +9/-7)
```diff
@@ -18,11 +18,11 @@ def __init__(self, site: str = 'stackoverflow', key: Optional[str] = None,
         self._site = site
         self._timeout = timeout
 
-    def get_content(self, item: Dict[str, Any]) -> Dict[str, Any]:
+    def _fetch_content_result(self, item: Dict[str, Any]) -> Dict[str, Any]:
         url = item.get('url') or ''
         m = re.search(r'/questions/(\d+)', url) if url else None
         if not m:
-            return super().get_content(item)
+            return super()._fetch_content_result(item)
         qid = m.group(1)
         api_url = f'https://api.stackexchange.com/2.3/questions/{qid}'
         params = self.inject_auth_params({'site': self._site, 'filter': 'withbody'})
@@ -31,28 +31,30 @@ def get_content(self, item: Dict[str, Any]) -> Dict[str, Any]:
             resp.raise_for_status()
             data = resp.json()
         except Exception:
-            return super().get_content(item)
+            return super()._fetch_content_result(item)
         items = data.get('items') or []
         if not items:
-            return super().get_content(item)
+            return super()._fetch_content_result(item)
         q = items[0]
         raw = (q.get('body') or '').strip()
         if not raw:
-            return super().get_content(item)
+            return super()._fetch_content_result(item)
         body = _html_to_text(raw)
         accepted_id = q.get('accepted_answer_id')
         if not accepted_id:
-            return _make_content_result(item, body)
+            return _make_content_result(item, body, content_type='question')
         ans_url = f'https://api.stackexchange.com/2.3/answers/{accepted_id}'
+        content_type = 'question'
         try:
             ar = httpx.get(ans_url, params=params, timeout=self._timeout)
             ar.raise_for_status()
             ans_items = ar.json().get('items') or []
             if ans_items and ans_items[0].get('body'):
                 body = body + '\n\n--- Accepted Answer ---\n\n' + _html_to_text(ans_items[0]['body'])
+                content_type = 'question_and_accepted_answer'
         except Exception:
             pass
-        return _make_content_result(item, body)
+        return _make_content_result(item, body, content_type=content_type)
 
     def search(self, query: str, count: int = 10,
                sort: str = 'relevance') -> List[Dict[str, Any]]:
```

**File**: `lazyllm/tools/tools/search/wikipedia_search.py` (modified, +6/-4)
```diff
@@ -21,11 +21,11 @@ def __init__(self, base_url: str = 'https://en.wikipedia.org',
         self._timeout = timeout
         self._headers = {'User-Agent': self._UA}
 
-    def get_content(self, item: Dict[str, Any]) -> Dict[str, Any]:
+    def _fetch_content_result(self, item: Dict[str, Any]) -> Dict[str, Any]:
         extra = item.get('extra') or {}
         pageid = extra.get('pageid')
         if pageid is None:
-            return super().get_content(item)
+            return super()._fetch_content_result(item)
         params = {
             'action': 'query',
             'pageids': pageid,
@@ -39,11 +39,13 @@ def get_content(self, item: Dict[str, Any]) -> Dict[str, Any]:
             resp.raise_for_status()
             data = resp.json()
         except Exception:
-            return super().get_content(item)
+            return super()._fetch_content_result(item)
         pages = data.get('query', {}).get('pages') or {}
         page = pages.get(str(pageid)) or {}
         content = (page.get('extract') or '').strip()
-        return _make_content_result(item, content) if content else super().get_content(item)
+        if content:
+            return _make_content_result(item, content, content_type='encyclopedia_article')
+        return super()._fetch_content_result(item)
 
     def search(self, query: str, limit: int = 10) -> List[dict]:
         params = {
```

**File**: `tests/basic_tests/Tools/test_search_content_contract.py` (modified, +4/-1)
```diff
@@ -40,7 +40,10 @@ def test_search_content_preserves_identity_without_framework_citation_fields():
         'url': 'https://example.test/result',
         'snippet': 'Snippet',
         'source': 'fake',
-        'extra': {'doc_id': 'doc-1'},
+        'extra': {'doc_id': 'doc-1', 'content_read': {
+            'content_type': 'webpage', 'fallback': False, 'offset': 0, 'limit': 16384,
+            'truncated': False, 'more': False, 'next_offset': 14,
+        }},
         'content': 'Fetched Result',
     }
     assert batch == [result]
```

---

### Incident Patch 3: `2cc07741` (2026-09-09)
**Commit Message**: fix mcp bugs (#1314)

**File**: `lazyllm/tools/mcp/client.py` (modified, +9/-3)
```diff
@@ -2,7 +2,7 @@
 from urllib.parse import urlparse
 from contextlib import asynccontextmanager
 
-from lazyllm.thirdparty import httpx, mcp
+from lazyllm.thirdparty import mcp
 
 from .utils import patch_sync
 from .tool_adaptor import generate_lazyllm_tool
@@ -60,12 +60,18 @@ async def _run_session(self):
 
             async with create_mcp_http_client(
                 headers=self._headers or None,
-                timeout=httpx.Timeout(self._timeout),
+                # Let the MCP SDK construct its own timeout object. Some
+                # releases vendor httpx as httpx2, which cannot consume a
+                # Timeout instance created by LazyLLM's httpx shim.
+                timeout=self._timeout,
             ) as http_client:
                 async with streamable_http_client(
                     url=self._command_or_url,
                     http_client=http_client,
-                ) as (read_stream, write_stream, _get_session_id):
+                ) as streams:
+                    # mcp SDK releases have returned both a 2-tuple and a
+                    # 3-tuple here. Only the read/write streams are required.
+                    read_stream, write_stream = streams[:2]
                     async with mcp.ClientSession(read_stream, write_stream) as session:
                         await session.initialize()
                         yield session
```

**File**: `lazyllm/tools/mcp/tool_adaptor.py` (modified, +13/-2)
```diff
@@ -1,5 +1,6 @@
 import inspect
 import asyncio
+import re
 
 from typing import Any, Callable, Dict, List, Set
 from lazyllm import LOG
@@ -66,8 +67,15 @@ def _handle_tool_result(result, tool_name: str) -> str:
 
 def generate_lazyllm_tool(client, mcp_tool) -> Callable:
     tool_name = mcp_tool.name
+    exposed_tool_name = re.sub(r'\W', '_', tool_name)
+    if exposed_tool_name[:1].isdigit():
+        exposed_tool_name = '_' + exposed_tool_name
     tool_desc = mcp_tool.description
-    input_schema = mcp_tool.inputSchema
+    # MCP's Pydantic models used the JSON alias ``inputSchema`` in older
+    # releases and the Pythonic ``input_schema`` attribute in newer ones.
+    input_schema = getattr(mcp_tool, 'inputSchema', None)
+    if input_schema is None:
+        input_schema = getattr(mcp_tool, 'input_schema', {})
     properties = input_schema.get('properties', {})
     required = input_schema.get('required', [])
 
@@ -109,7 +117,10 @@ def dynamic_lazyllm_func(**kwargs):
         return _handle_tool_result(result, tool_name)
 
     # Set function attributes
-    dynamic_lazyllm_func.__name__ = tool_name
+    # LazyLLM's registry interprets dots as registry-group separators. MCP
+    # servers commonly namespace tools with dots, so expose a valid Python
+    # identifier while retaining the original name in the call closure.
+    dynamic_lazyllm_func.__name__ = exposed_tool_name
     dynamic_lazyllm_func.__doc__ = func_desc
     dynamic_lazyllm_func.__annotations__ = annotations
 
```

---

### Incident Patch 4: `2978e3c0` (2026-09-09)
**Commit Message**: fix: classify OpenAI-compatible context capacity errors while preserving provider codes (#1312)

**File**: `lazyllm/module/llms/onlinemodule/base/provider_response.py` (modified, +14/-1)
```diff
@@ -65,13 +65,21 @@ def classify(
         provider_error_code: Optional[str] = None,
         provider_error_type: Optional[str] = None,
         provider_http_status: Optional[int] = None,
+        provider_response: Optional[Dict[str, Any]] = None,
     ) -> ModelFailureCode:
         if origin == ModelFailureOrigin.PROTOCOL:
             return ModelFailureCode.PROTOCOL_ERROR
         if origin == ModelFailureOrigin.TRANSPORT:
             return ModelFailureCode.TRANSPORT_ERROR
         if provider_error_code:
-            mapped = self.code_map.get(provider_error_code.lower())
+            classification_key = provider_error_code.lower()
+            if classification_key == '400' and provider_response:
+                payload = provider_response.get('error', provider_response if self.error_at_top_level else None)
+                if (isinstance(payload, dict) and payload.get('param') == 'input_tokens'
+                        and 'maximum context length' in str(payload.get('message', '')).lower()):
+                    # Normalize the classification key without replacing the raw provider code.
+                    classification_key = 'context_length_exceeded'
+            mapped = self.code_map.get(classification_key)
             if mapped is not None: return mapped
         if provider_error_type:
             mapped = self.type_map.get(provider_error_type.lower())
@@ -101,6 +109,7 @@ def error(
         provider_error_code: Optional[str] = None,
         provider_error_type: Optional[str] = None,
         provider_http_status: Optional[int] = None,
+        provider_response: Optional[Dict[str, Any]] = None,
     ) -> _ModelResponseError:
         return _ModelResponseError(message, ModelFailure(
             origin=origin,
@@ -109,6 +118,7 @@ def error(
                 provider_error_code=provider_error_code,
                 provider_error_type=provider_error_type,
                 provider_http_status=provider_http_status,
+                provider_response=provider_response,
             ),
             provider_error_code=provider_error_code,
             provider_error_type=provider_error_type,
@@ -127,6 +137,7 @@ def _error_fields(payload: Dict[str, Any]) -> Tuple[Optional[str], Optional[str]
 
 
 OPENAI_COMPATIBLE_PROFILE = ProviderResponseProfile(
+    code_map={'context_length_exceeded': ModelFailureCode.TOKEN_LIMIT},
     http_map={
         400: ModelFailureCode.INVALID_REQUEST,
         401: ModelFailureCode.AUTHENTICATION_FAILED,
@@ -165,6 +176,7 @@ def raise_for_http_error(response: Any, profile: ProviderResponseProfile) -> Non
         provider_error_code=code,
         provider_error_type=error_type,
         provider_http_status=response.status_code,
+        provider_response=error_message if isinstance(error_message, dict) else None,
     )
 
 
@@ -219,6 +231,7 @@ def parse_json_payload(self, payload: str) -> Union[Dict[str, Any], str]:
                 ModelFailureOrigin.PROVIDER,
                 provider_error_code=code,
                 provider_error_type=error_type,
+                provider_response=raw_message,
             )
         try:
             message = self._convert_message(raw_message)
```

**File**: `tests/basic_tests/Models/test_online_chat_model_runtime.py` (modified, +31/-0)
```diff
@@ -440,6 +440,14 @@ def broken_json():
 
 @pytest.mark.parametrize(('module_cls', 'status', 'body', 'expected'), [
     (LazyLLMOnlineChatModuleBase, 400, '{"error":{}}', ModelFailureCode.INVALID_REQUEST),
+    (OpenAIChat, 400, '{"error":{"code":"context_length_exceeded"}}', ModelFailureCode.TOKEN_LIMIT),
+    (OpenAIChat, 400, json.dumps({'error': {
+        'code': 400, 'type': 'BadRequestError', 'param': 'input_tokens',
+        'message': "This model's maximum context length is 262144 tokens. Your prompt contains at least 262145 tokens.",
+    }}), ModelFailureCode.TOKEN_LIMIT),
+    (OpenAIChat, 400, json.dumps({'error': {
+        'code': 400, 'type': 'BadRequestError', 'param': 'input_tokens', 'message': 'Invalid input.',
+    }}), ModelFailureCode.INVALID_REQUEST),
     (LazyLLMOnlineChatModuleBase, 401, '{"error":{}}', ModelFailureCode.AUTHENTICATION_FAILED),
     (LazyLLMOnlineChatModuleBase, 403, '{"error":{}}', ModelFailureCode.PERMISSION_DENIED),
     (LazyLLMOnlineChatModuleBase, 404, '{"error":{}}', ModelFailureCode.NOT_FOUND),
@@ -465,6 +473,29 @@ def test_provider_http_mapping_uses_supplier_source(monkeypatch, module_cls, sta
 
     assert exc_info.value.failure.code is expected
     assert exc_info.value.failure.provider_http_status == status
+    raw_code = json.loads(body)['error'].get('code')
+    assert exc_info.value.failure.provider_error_code == (str(raw_code) if raw_code is not None else None)
+
+
+@pytest.mark.parametrize('code', [400, '400'])
+@pytest.mark.parametrize('http_error', [True, False])
+def test_vllm_capacity_error_preserves_raw_code(code, http_error):
+    body = json.dumps({'error': {
+        'code': code, 'type': 'BadRequestError', 'param': 'input_tokens',
+        'message': "This model's maximum context length is 4096 tokens. However, you requested "
+                   '4096 output tokens and your prompt contains 24 input tokens, for a total of 4120 tokens.',
+    }})
+    with pytest.raises(_ModelResponseError) as exc_info:
+        if http_error:
+            raise_for_http_error(_Response(status_code=400, body=body), OpenAIChat.RESPONSE_PROFILE)
+        else:
+            _parser(OpenAIChat).parse_response_frame('data: ' + body)
+
+    failure = exc_info.value.failure
+    assert failure.code is ModelFailureCode.TOKEN_LIMIT
+    assert failure.provider_error_code == '400'
+    assert failure.provider_error_type == 'BadRequestError'
+    assert failure.origin is (ModelFailureOrigin.HTTP if http_error else ModelFailureOrigin.PROVIDER)
 
 
 def test_deepseek_http_402_is_balance_exhausted(monkeypatch):
```

---

### Incident Patch 5: `f6d4ad11` (2026-09-03)
**Commit Message**: fix(data): call EvalHardness.parse_sql with the signature it actually has (#1301)

**File**: `lazyllm/tools/data/operators/sql_evalhardness.py` (modified, +2/-2)
```diff
@@ -250,7 +250,7 @@ def parse_value(self, toks, start_idx, tables_with_alias, schema, default_tables
             idx += 1
 
         if toks[idx] == 'select':
-            idx, val = self.parse_sql(toks, idx, tables_with_alias, schema)
+            idx, val = self.parse_sql(idx)
         elif isinstance(toks[idx], str) and toks[idx] not in schema.idMap:
             val = toks[idx]
             idx += 1
@@ -353,7 +353,7 @@ def parse_from(self, toks, start_idx, tables_with_alias, schema):
                 idx += 1
 
             if toks[idx] == 'select':
-                idx, sql = self.parse_sql(toks, idx, tables_with_alias, schema)
+                idx, sql = self.parse_sql(idx)
                 table_units.append((self.TABLE_TYPE['sql'], sql))
             else:
                 if idx < len_ and toks[idx] == 'join':
```

---

### Incident Patch 6: `304ec8df` (2026-09-03)
**Commit Message**: fix(json): JsonConcentrator schema validation raises TypeError on any nested object (#1303)

**File**: `lazyllm/tools/tools/json.py` (modified, +1/-1)
```diff
@@ -173,7 +173,7 @@ def _validate_schema_impl(self, schema: Dict[str, Any], data: Dict[str, Any], pr
 
         for key, value in data.items():
             if isinstance(value, dict):
-                if not self._validate_schema(schema[key], value, f'{prefix}.{key}' if prefix else key):
+                if not self._validate_schema_impl(schema[key], value, f'{prefix}.{key}' if prefix else key):
                     return False
         return True
 
```

---

### Incident Patch 7: `54f0d689` (2026-09-03)
**Commit Message**: Fix/hf hub err 874 (#1304)

**File**: `lazyllm/thirdparty/__init__.py` (modified, +11/-4)
```diff
@@ -133,10 +133,17 @@ def __getattribute__(self, __name):
             try:
                 self._Wrapper__lib = importlib.import_module(self._Wrapper__key, package=self._Wrapper__package)
                 for patch_func in self._Wrapper__patches: patch_func()
-            except ImportError:
-                pip_cmd = get_pip_install_cmd([self._Wrapper__key])
-                err_msg = f'Cannot import module `{self._Wrapper__key}`, please install it by `{pip_cmd}`'
-                raise ImportError(err_msg) from None
+            except ImportError as error:
+                if isinstance(error, ModuleNotFoundError) and (error.name in (self._Wrapper__key, None)):
+                    pip_cmd = get_pip_install_cmd([self._Wrapper__key])
+                    err_msg = (f'Cannot import module `{self._Wrapper__key}`, '
+                               f'please install it by `{pip_cmd}`')
+                else:
+                    err_msg = (f'Module `{self._Wrapper__key}` is installed, but importing it failed. '
+                               f'This is usually caused by an outdated or incompatible dependency '
+                               f'(e.g. an old `huggingface-hub` used by `transformers`). '
+                               f'Original error: {error}')
+                raise ImportError(err_msg) from error
         return getattr(self._Wrapper__lib, __name)
 
     def __setattr__(self, __name, __value):
```

**File**: `tests/basic_tests/test_thirdparty.py` (modified, +20/-0)
```diff
@@ -76,3 +76,23 @@ def test_python_multipart_resolves_to_its_import_name(self):
         # its import name (multipart) differs from its PyPI name
         assert thirdparty.package_name_map.get('multipart') == 'python-multipart'
         assert thirdparty.package_name_map_reverse.get('python-multipart') == 'multipart'
+
+    def test_import_error_hint_when_module_not_installed(self):
+        w = thirdparty.PackageWrapper('nonexistent_module_kasduf45123')
+        with pytest.raises(ImportError) as exc_info:
+            _ = w.prop
+        msg = str(exc_info.value)
+        assert 'Cannot import module `nonexistent_module_kasduf45123`' in msg
+        assert 'please install it by `pip install nonexistent_module_kasduf45123`' in msg
+
+    def test_import_error_hint_when_installed_but_internal_failure(self, monkeypatch):
+        def broken_import(*args, **kwargs):
+            raise ImportError('failed to resolve old huggingface-hub dependency')
+        monkeypatch.setattr('importlib.import_module', broken_import)
+        w = thirdparty.PackageWrapper('transformers')
+        with pytest.raises(ImportError) as exc_info:
+            _ = w.model
+        msg = str(exc_info.value)
+        assert 'Module `transformers` is installed, but importing it failed' in msg
+        assert 'huggingface-hub' in msg
+        assert 'old huggingface-hub dependency' in msg
```

---

### Incident Patch 8: `2505a7cc` (2026-08-27)
**Commit Message**: fix(skills): pass session env vars into run_script (#1282)

Co-authored-by: 陈哲 <[REDACTED_EMAIL]>

**File**: `lazyllm/docs/tools/tool_sandbox.py` (modified, +6/-3)
```diff
@@ -103,14 +103,15 @@
     args (list[str] | None): 传递给脚本的参数。
     cwd (str): 相对于 `source_dir` 的工作目录，默认为 `.`。
     allow_unsafe (bool): 预留的审批参数；DummySandbox 当前不提供审批边界，因此会忽略该参数。
+    env (dict[str, str] | None): 额外环境变量，会覆盖合并进子进程环境；不会修改当前进程的 `os.environ`。默认为 `None`。
 
 **Returns:**\n
     dict：包含 `status`、`stdout`、`stderr`、`exit_code` 和 `cwd`。脚本不存在时返回
     `status='missing'`；非零退出码返回 `status='failed'`。
 
 Notes:
     DummySandbox 只提供临时目录和子进程执行边界，并非强安全隔离。它不会限制脚本读取宿主机文件、
-    访问网络或继承当前进程环境。不要用它执行未经信任的代码。
+    访问网络，或在继承当前进程环境后再叠加 `env`。不要用它执行未经信任的代码。
 ''')
 
 add_sandbox_english_doc('DummySandbox.execute_script', '''\
@@ -126,15 +127,17 @@
     args (list[str] | None): arguments passed to the script.
     cwd (str): working directory relative to `source_dir`, default `.`.
     allow_unsafe (bool): reserved approval parameter; DummySandbox currently has no approval boundary and ignores it.
+    env (dict[str, str] | None): extra environment variables merged into the subprocess environment; does not mutate the
+        parent process `os.environ`. Default `None`.
 
 **Returns:**\n
     dict: contains `status`, `stdout`, `stderr`, `exit_code`, and `cwd`. A missing script returns `status='missing'`;
     a non-zero exit code returns `status='failed'`.
 
 Notes:
     DummySandbox provides only a temporary-directory and subprocess boundary, not strong security isolation. It does not
-    prevent scripts from reading host files, accessing the network, or inheriting the current process environment. Do not
-    use it to execute untrusted code.
+    prevent scripts from reading host files, accessing the network, or inheriting the current process environment with
+    `env` overlaid. Do not use it to execute untrusted code.
 ''')
 
 add_sandbox_example('DummySandbox.execute_script', """\
```

**File**: `lazyllm/tools/__init__.py` (modified, +12/-2)
```diff
@@ -44,7 +44,12 @@
     from .review import get_errors, ChineseCorrector
     from .git import (LazyLLMGitBase, PrInfo, ReviewCommentInfo, Git,
                       GitHub, GitLab, Gitee, GitCode)
-    from .tool_config_inject import inject_tool_config
+    from .tool_config_inject import (
+        effective_env_value,
+        get_dynamic_env_vars,
+        inject_env_vars,
+        inject_tool_config,
+    )
 
 
 def __getattr__(name: str):
@@ -154,7 +159,12 @@ def __getattr__(name: str):
         'GitCode',
         'review',
     ],
-    'tool_config_inject': ['inject_tool_config'],
+    'tool_config_inject': [
+        'inject_tool_config',
+        'inject_env_vars',
+        'get_dynamic_env_vars',
+        'effective_env_value',
+    ],
     'fs': [
         'LazyLLMFSBase',
         'LinkDocumentFSBase',
```

**File**: `lazyllm/tools/agent/missing_env.py` (added, +69/-0)
```diff
@@ -0,0 +1,69 @@
+from __future__ import annotations
+
+import json
+import re
+from typing import Any, Iterable, List, Optional
+
+from lazyllm.tools.tool_config_inject import effective_env_value
+
+_VALID_ENV_NAME_RE = re.compile(r'^[A-Za-z_][A-Za-z0-9_]*$')
+_HEURISTIC_NAME_RE = re.compile(r'\b([A-Z][A-Z0-9]*_[A-Z0-9_]+)\b')
+_CONVENTION_RE = re.compile(r'(?im)MISSING_ENV\s*=\s*([A-Za-z_][A-Za-z0-9_]*)')
+_HEURISTIC_KEYWORDS = ('not set', 'missing', 'undefined', 'required')
+_SKIP_HEURISTIC_NAMES = {'MISSING_ENV'}
+
+
+def normalize_required_env_names(raw: Any) -> List[str]:
+    if isinstance(raw, str):
+        items = [part.strip() for part in raw.split(',')]
+    elif isinstance(raw, (list, tuple)):
+        items = list(raw)
+    else:
+        return []
+    names: List[str] = []
+    seen = set()
+    for item in items:
+        name = str(item or '').strip()
+        if not _VALID_ENV_NAME_RE.fullmatch(name) or name in seen:
+            continue
+        seen.add(name)
+        names.append(name)
+    return names
+
+
+def format_missing_env_message(reason: str, missing_env: Iterable[str]) -> str:
+    names = [str(name) for name in missing_env if name]
+    if not names:
+        return reason
+    return f'{reason}\nmissing_env: {json.dumps(names, ensure_ascii=False)}'
+
+
+def collect_missing_env_hints(
+    *texts: Any,
+    declared_required: Optional[Iterable[str]] = None,
+) -> List[str]:
+    blob = '\n'.join(str(text or '') for text in texts)
+    names: List[str] = []
+    seen = set()
+
+    def _add(name: str) -> None:
+        cleaned = str(name or '').strip()
+        if not cleaned or cleaned in seen or not _VALID_ENV_NAME_RE.fullmatch(cleaned):
+            return
+        seen.add(cleaned)
+        names.append(cleaned)
+
+    for match in _CONVENTION_RE.finditer(blob):
+        _add(match.group(1))
+    for name in normalize_required_env_names(declared_required):
+        if not effective_env_value(name):
+            _add(name)
+    for line in blob.splitlines():
+        lowered = line.lower()
+        if not any(keyword in lowered for keyword in _HEURISTIC_KEYWORDS):
+            continue
+        for match in _HEURISTIC_NAME_RE.finditer(line):
+            name = match.group(1)
+            if name not in _SKIP_HEURISTIC_NAMES:
+                _add(name)
+    return names
```

**File**: `lazyllm/tools/agent/skill_manager.py` (modified, +27/-4)
```diff
@@ -10,6 +10,7 @@
 
 from lazyllm import config, LOG, ModuleBase
 from lazyllm.thirdparty import fsspec
+from .missing_env import collect_missing_env_hints, format_missing_env_message
 from .toolError import ToolExecutionError
 
 DEFAULT_SKILLS_DIR = os.path.join(config['home'], 'skills')
@@ -624,8 +625,7 @@ def _raise_run_script_exception(self, name: str, rel_path: str, cwd: Optional[st
             ) from exc
         raise ToolExecutionError(f'run_script execution failed for {context}: {exc}') from exc
 
-    @staticmethod
-    def _normalize_script_result(result: Dict) -> Dict:
+    def _normalize_script_result(self, result: Dict, skill_info: Optional[Dict] = None) -> Dict:
         if result.get('status') == 'ok' and result.get('exit_code', 0) != 0:
             result['status'] = 'failed'
         if result.get('status') == 'needs_approval':
@@ -640,9 +640,29 @@ def _normalize_script_result(result: Dict) -> Dict:
             exit_code = result.get('exit_code')
             if exit_code is not None:
                 reason = f'Skill script execution failed with exit code {exit_code}: {reason}'
-            raise ToolExecutionError(reason)
+            raise self._script_failure_error(reason, result, skill_info)
         return result
 
+    @staticmethod
+    def _script_failure_error(
+        reason: str, result: Dict, skill_info: Optional[Dict],
+    ) -> ToolExecutionError:
+        if result.get('status') == 'missing':
+            return ToolExecutionError(reason)
+        raw_meta = (skill_info or {}).get('raw_meta') or {}
+        missing_env = collect_missing_env_hints(
+            reason,
+            result.get('stderr'),
+            result.get('stdout'),
+            declared_required=raw_meta.get('required_env'),
+        )
+        if not missing_env:
+            return ToolExecutionError(reason)
+        return ToolExecutionError.with_missing_env(
+            format_missing_env_message(reason, missing_env),
+            missing_env,
+        )
+
     def run_script(self, name: str, rel_path: str, args: Optional[List[str]] = None,
                    allow_unsafe: bool = False, cwd: Optional[str] = None) -> Dict[str, str]:
         info, error = self._get_visible_skill_info(name)
@@ -677,14 +697,17 @@ def run_script(self, name: str, rel_path: str, args: Optional[List[str]] = None,
                     f'The configured sandbox does not support executing skill {name} script '
                     f'{normalized_rel_path!r}.'
                 )
+            from lazyllm.tools.tool_config_inject import get_dynamic_env_vars
+            script_env = dict(get_dynamic_env_vars())
             result = self._sandbox.execute_script(
                 source_dir=base,
                 rel_path=normalized_rel_path,
                 args=args,
                 cwd=os.path.relpath(run_cwd, os.path.realpath(os.path.abspath(base))),
                 allow_unsafe=allow_unsafe,
+                env=script_env,
             )
-            return self._normalize_script_result(result)
+            return self._normalize_script_result(result, info)
         except ToolExecutionError:
             raise
         except Exception as exc:
```

**File**: `lazyllm/tools/agent/toolError.py` (modified, +18/-2)
```diff
@@ -1,24 +1,39 @@
-from typing import Any, Dict
+from typing import Any, Dict, Iterable, Optional
 
 from lazyllm.common import HandledException
 
 
-def tool_failure(message: str, *, needs_approval: bool = False) -> Dict[str, Any]:
+def tool_failure(
+    message: str,
+    *,
+    needs_approval: bool = False,
+    missing_env: Optional[Iterable[str]] = None,
+) -> Dict[str, Any]:
     result = {'ok': False, 'value': str(message)}
     if needs_approval:
         result['needs_approval'] = True
+    names = [str(name) for name in (missing_env or []) if name]
+    if names:
+        result['missing_env'] = names
     return result
 
 
 class ToolExecutionError(HandledException):
     needs_approval = False
+    missing_env = ()
 
     @classmethod
     def approval_required(cls, message: str) -> 'ToolExecutionError':
         error = cls(message)
         error.needs_approval = True
         return error
 
+    @classmethod
+    def with_missing_env(cls, message: str, missing_env: Iterable[str]) -> 'ToolExecutionError':
+        error = cls(message)
+        error.missing_env = [str(name) for name in missing_env if name]
+        return error
+
 
 def exception_failure(tool_name: str, error: Exception) -> Dict[str, Any]:
     # ModuleBase translates ordinary exceptions into ModuleExecutionError and
@@ -47,6 +62,7 @@ def exception_failure(tool_name: str, error: Exception) -> Dict[str, Any]:
         return tool_failure(
             str(typed_error) or type(typed_error).__name__,
             needs_approval=typed_error.needs_approval,
+            missing_env=getattr(typed_error, 'missing_env', ()) or None,
         )
 
     semantic_error = causes[-1] if causes else error
```

**File**: `lazyllm/tools/sandbox/dummy_sandbox.py` (modified, +3/-2)
```diff
@@ -50,7 +50,8 @@ def _run_in_subprocess(self, script_path: str, cwd: str,
         return {'returncode': proc.returncode, 'stdout': stdout, 'stderr': stderr}
 
     def execute_script(self, source_dir: str, rel_path: str, args: Optional[List[str]] = None,
-                       cwd: str = '.', allow_unsafe: bool = False) -> Dict[str, Any]:
+                       cwd: str = '.', allow_unsafe: bool = False,
+                       env: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
         del allow_unsafe  # DummySandbox currently has no approval boundary.
         context = self._create_context()
         try:
@@ -72,7 +73,7 @@ def execute_script(self, source_dir: str, rel_path: str, args: Optional[List[str
             completed = subprocess.run(
                 [runner, script_path, *(args or [])],
                 cwd=run_cwd,
-                env=os.environ.copy(),
+                env={**os.environ.copy(), **(env or {})},
                 text=True,
                 capture_output=True,
                 timeout=self._timeout,
```

**File**: `lazyllm/tools/tool_config_inject.py` (modified, +77/-0)
```diff
@@ -1,9 +1,13 @@
 # Copyright (c) 2026 LazyAGI. All rights reserved.
+import os
+import re
 from typing import Any, Dict, Optional
 
 import lazyllm
 from lazyllm import LOG
 
+_ENV_NAME_RE = re.compile(r'^[A-Za-z_][A-Za-z0-9_]*$')
+
 
 lazyllm.globals.config.add('dynamic_fs_auth', dict, None, 'DYNAMIC_FS_AUTH',
                            description='Per-source dynamic FS auth: {source: token}.')
@@ -97,3 +101,76 @@ def inject_tool_config(tool_config: Optional[Dict[str, Any]]) -> None:
         lazyllm.globals.config[config_key] = {**existing, **new_entries}
 
     LOG.info(f'[inject_tool_config] injected tools: {sorted(injected)}')
+
+
+def get_dynamic_env_vars() -> Dict[str, str]:
+    raw = lazyllm.globals.get('dynamic_env_vars', {}) or {}
+    return {
+        str(name): str(value)
+        for name, value in raw.items()
+        if name is not None and value is not None
+    }
+
+
+def effective_env_value(name: str) -> str:
+    key = str(name or '').strip()
+    if not key:
+        return ''
+    dynamic = get_dynamic_env_vars()
+    if key in dynamic:
+        return str(dynamic[key])
+    return str(os.getenv(key) or '')
+
+
+def _validate_inject_env_name(name: Any) -> Optional[str]:
+    key = str(name or '').strip()
+    if not key:
+        return None
+    if '\0' in key:
+        LOG.warning('[inject_env_vars] skipping env name containing NUL')
+        return None
+    if not _ENV_NAME_RE.fullmatch(key):
+        LOG.warning(f'[inject_env_vars] skipping invalid env name: {key!r}')
+        return None
+    return key
+
+
+def inject_env_vars(env_vars: Optional[Dict[str, Any]]) -> None:
+    '''Inject environment variables for skill script execution.
+
+    Values are stored in lazyllm globals for the active session and consumed by
+    SkillManager.run_script when it starts the script subprocess. This does not
+    mutate the parent process ``os.environ``.
+
+    Semantics:
+    - A non-empty value overwrites the same name for this session.
+    - An empty string removes a previously injected name (clear).
+    - ``None`` values are ignored.
+    '''
+    if not env_vars:
+        return
+    existing = dict(get_dynamic_env_vars())
+    assigned: list = []
+    cleared: list = []
+    for name, value in env_vars.items():
+        key = _validate_inject_env_name(name)
+        if not key or value is None:
+            continue
+        text = str(value)
+        if '\0' in text:
+            LOG.warning(f'[inject_env_vars] skipping {key!r}: value contains NUL')
+            continue
+        if not text.strip():
+            if key in existing:
+                existing.pop(key, None)
+                cleared.append(key)
+            continue
+        existing[key] = text
+        assigned.append(key)
+    if not assigned and not cleared:
+        return
+    lazyllm.globals['dynamic_env_vars'] = existing
+    LOG.info(
+        f'[inject_env_vars] injected env vars: {sorted(assigned)}; '
+        f'cleared env vars: {sorted(cleared)}'
+    )
```

**File**: `tests/advanced_tests/Tools/test_skills.py` (modified, +146/-0)
```diff
@@ -280,6 +280,151 @@ def test_run_script_marks_nonzero_exit_failed(self):
             assert 'exit code 7' in str(exc_info.value)
             assert 'bad' in str(exc_info.value)
 
+    def test_run_script_uses_dynamic_env_vars(self):
+        with tempfile.TemporaryDirectory() as tmp:
+            skill_dir = _make_skill(tmp, 'env-skill', 'env-skill')
+            scripts_dir = os.path.join(skill_dir, 'scripts')
+            os.makedirs(scripts_dir, exist_ok=True)
+            script = os.path.join(scripts_dir, 'print_env.py')
+            with open(script, 'w', encoding='utf-8') as f:
+                f.write('import os\nprint(os.getenv("DYNAMIC_TEST_API_KEY", ""))\n')
+
+            old_dynamic_env = lazyllm.globals.get('dynamic_env_vars')
+            lazyllm.globals['dynamic_env_vars'] = {'DYNAMIC_TEST_API_KEY': 'secret-from-session'}
+            try:
+                manager = SkillManager(dir=tmp)
+                result = manager.run_script('env-skill', 'scripts/print_env.py', allow_unsafe=True)
+            finally:
+                if old_dynamic_env is None:
+                    lazyllm.globals.pop('dynamic_env_vars', None)
+                else:
+                    lazyllm.globals['dynamic_env_vars'] = old_dynamic_env
+
+            assert result['status'] == 'ok'
+            assert result['stdout'].strip() == 'secret-from-session'
+
+    def test_run_script_retries_after_dynamic_env_injection(self):
+        with tempfile.TemporaryDirectory() as tmp:
+            skill_dir = _make_skill(tmp, 'retry-env-skill', 'retry-env-skill')
+            scripts_dir = os.path.join(skill_dir, 'scripts')
+            os.makedirs(scripts_dir, exist_ok=True)
+            script = os.path.join(scripts_dir, 'needs_key.py')
+            with open(script, 'w', encoding='utf-8') as f:
+                f.write(
+                    'import os\nimport sys\n'
+                    'value = os.getenv("DYNAMIC_TEST_API_KEY", "")\n'
+                    'if not value:\n'
+                    '    sys.stderr.write("missing DYNAMIC_TEST_API_KEY")\n'
+                    '    sys.exit(1)\n'
+                    'print(value)\n'
+                )
+
+            from lazyllm.tools.tool_config_inject import inject_env_vars
+            old_dynamic_env = lazyllm.globals.get('dynamic_env_vars')
+            lazyllm.globals['dynamic_env_vars'] = {}
+            try:
+                manager = SkillManager(dir=tmp)
+                with pytest.raises(ToolExecutionError) as exc_info:
+                    manager.run_script(
+                        'retry-env-skill', 'scripts/needs_key.py', allow_unsafe=True,
+                    )
+                assert exc_info.value.missing_env == ['DYNAMIC_TEST_API_KEY']
+                assert 'missing_env: ["DYNAMIC_TEST_API_KEY"]' in str(exc_info.value)
+                inject_env_vars({'DYNAMIC_TEST_API_KEY': 'secret-after-set'})
+                result = manager.run_script(
+                    'retry-env-skill', 'scripts/needs_key.py', allow_unsafe=True,
+                )
+            finally:
+                if old_dynamic_env is None:
+                    lazyllm.globals.pop('dynamic_env_vars', None)
+                else:
+                    lazyllm.globals['dynamic_env_vars'] = old_dynamic_env
+
+            assert result['status'] == 'ok'
+            assert result['stdout'].strip() == 'secret-after-set'
+
+    def test_run_script_does_not_preflight_block_unset_required_env(self):
+        with tempfile.TemporaryDirectory() as tmp:
+            skill_dir = _make_skill(tmp, 'optional-env-skill', 'optional-env-skill')
+            with open(os.path.join(skill_dir, 'SKILL.md'), 'w', encoding='utf-8') as f:
+                f.write(
+                    '---\n'
+                    'name: optional-env-skill\n'
+                    'description: optional env skill\n'
+                    'required_env:\n'
+                    '  - OPTIONAL_API_KEY\n'
+                    '---\n'
+                    '# optional\n'
+                )
+            scripts_dir = os.path.join(skill_dir, 'scripts')
+            os.makedirs(scripts_dir, exist_ok=True)
+            with open(os.path.join(scripts_dir, 'ok.py'), 'w', encoding='utf-8') as f:
+                f.write('print("ran-without-key")\n')
+
+            manager = SkillManager(dir=tmp)
+            result = manager.run_script(
+                'optional-env-skill', 'scripts/ok.py', allow_unsafe=True,
+            )
+
+            assert result['status'] == 'ok'
+            assert result['stdout'].strip() == 'ran-without-key'
+
+    def test_run_script_hints_declared_required_env_only_after_failure(self, monkeypatch):
+        monkeypatch.delenv('DECLARED_API_KEY', raising=False)
+        with tempfile.TemporaryDirectory() as tmp:
+            skill_dir = _make_skill(tmp, 'declared-env-skill', 'declared-env-skill')
+            with open(os.path.join(skill_dir, 'SKILL.md'), 'w', encoding='utf-8') as f:
+                f.write(
+     
```

---

### Incident Patch 9: `bbae5225` (2026-08-27)
**Commit Message**: fix build bug (#1299)

**File**: `.github/workflows/main.yml` (modified, +14/-0)
```diff
@@ -24,6 +24,7 @@ env:
   CI_PATH: '/home/mnt/platform_ci/GitHub/${{ github.repository }}/${{ github.run_number }}'
   PYTHON_VERSION: "3.10.9"
   LAZYLLM_DEFAULT_RECENT_K: 20
+  LAZYLLM_SKIP_EXTERNAL_STORE_TESTS: ${{ vars.ENABLE_SELF_HOSTED_TESTS != 'true' }}
 concurrency:
   group: ${{ github.workflow }}-${{ github.event_name }}-${{
     github.event_name == 'pull_request_target' && github.event.pull_request.title || github.ref }}
@@ -443,6 +444,17 @@ jobs:
           pip install -r tests/data_tests/requirements.txt
           pip install 'setuptools<82'
 
+      - name: Prepare NLTK data
+        env:
+          NLTK_ALLOW_PROXIED_URLOPEN: "1"
+        run: |
+          NLTK_DATA="${RUNNER_TEMP}/nltk_data"
+          mkdir -p "${NLTK_DATA}"
+          python -m nltk.downloader -d "${NLTK_DATA}" stopwords punkt_tab
+          NLTK_DATA="${NLTK_DATA}" python -c \
+            "import nltk; nltk.data.find('corpora/stopwords'); nltk.data.find('tokenizers/punkt_tab')"
+          echo "NLTK_DATA=${NLTK_DATA}" >> "${GITHUB_ENV}"
+
       - name: Checkout test data
         uses: actions/checkout@v4
         with:
@@ -921,6 +933,8 @@ jobs:
           elif [[ "${{ runner.os }}" == "macOS" ]]; then
             pip install -r tests/requirements_mac.txt
           fi
+          pip install 'setuptools<82'
+          python -c "import pymilvus; print(pymilvus.__version__)"
 
       - name: Download test dataset
         run: |
```

**File**: `csrc/CMakeLists.txt` (modified, +2/-1)
```diff
@@ -5,6 +5,8 @@ set(CMAKE_CXX_STANDARD 17)
 set(CMAKE_CXX_STANDARD_REQUIRED ON)
 set(CMAKE_POSITION_INDEPENDENT_CODE ON)
 
+option(BUILD_TESTS "Build C++ tests" OFF)
+
 if (MSVC)
     add_compile_options(/utf-8)
 endif()
@@ -103,7 +105,6 @@ install(DIRECTORY ${CMAKE_BINARY_DIR}/tokenizers DESTINATION lazyllm COMPONENT l
 
 
 # TESTS
-option(BUILD_TESTS "Build C++ tests" OFF)
 if (BUILD_TESTS)
     include(cmake/tests.cmake)
 endif ()
```

**File**: `csrc/cmake/tests.cmake` (modified, +1/-2)
```diff
@@ -26,8 +26,7 @@ foreach (test_src ${LAZYLLM_TEST_SOURCES})
     target_link_libraries(${test_name} PRIVATE
         GTest::gtest_main
         lazyllm_core
-        pybind11::headers
-        Python3::Python
+        pybind11::embed
     )
     # Ensure tests use the same libstdc++ as the compiler, avoiding conda-incompatible versions.
     if (LAZYLLM_LIBSTDCPP_DIR)
```

**File**: `csrc/cmake/third_party.cmake` (modified, +5/-1)
```diff
@@ -3,7 +3,11 @@ include(FetchContent)
 # disable remote update checks to keep builds reproducible.
 set(FETCHCONTENT_UPDATES_DISCONNECTED ON)
 
-find_package(Python3 COMPONENTS Interpreter Development.Module Development.Embed REQUIRED)
+set(_lazyllm_python_components Interpreter Development.Module)
+if (BUILD_TESTS)
+    list(APPEND _lazyllm_python_components Development.Embed)
+endif ()
+find_package(Python3 COMPONENTS ${_lazyllm_python_components} REQUIRED)
 find_package(pybind11 CONFIG REQUIRED)
 
 find_package(xxHash QUIET)
```

**File**: `tests/basic_tests/RAG/test_store.py` (modified, +4/-2)
```diff
@@ -1228,15 +1228,17 @@ def test_search_with_filters(self):
     'elasticsearch': {
         'segment_store_type': 'elasticsearch',
         'init_kwargs': {'uris': os.getenv('ELASTICSEARCH_HOST', 'localhost:9201')},
-        'is_skip': False, 'skip_reason': 'To test elasticsearch store, please set up a elasticsearch server'},
+        'is_skip': os.getenv('LAZYLLM_SKIP_EXTERNAL_STORE_TESTS', '').lower() == 'true',
+        'skip_reason': 'External store tests require the SCO test environment'},
     'opensearch': {
         'segment_store_type': 'opensearch',
         'init_kwargs': {'uris': os.getenv('OPENSEARCH_HOST', 'localhost:9200'),
                         'client_kwargs': {
                             'user': os.getenv('OPENSEARCH_USER', 'admin'),
                             'password': os.getenv('OPENSEARCH_INITIAL_ADMIN_PASSWORD'),
                             'verify_certs': False}},
-        'is_skip': False, 'skip_reason': 'To test opensearch store, please set up a opensearch server'},
+        'is_skip': os.getenv('LAZYLLM_SKIP_EXTERNAL_STORE_TESTS', '').lower() == 'true',
+        'skip_reason': 'External store tests require the SCO test environment'},
     'SQLiteStore': {
         'segment_store_type': 'SQLiteStore',
         'init_kwargs': {'db_path': os.path.join(tempfile.gettempdir(), 'test_sqlite_store.db')},
```

**File**: `tests/basic_tests/Tools/test_pdf_utils.py` (modified, +3/-1)
```diff
@@ -1,3 +1,4 @@
+import os
 from pathlib import Path
 
 from lazyllm.thirdparty import pypdf
@@ -66,7 +67,8 @@ def test_long_pdf_is_replaced_inplace(tmp_path):
     assert result is True
     assert len(replaced.pages) == 3
     assert [round(float(page.mediabox.height)) for page in replaced.pages] == [200, 200, 100]
-    assert source.stat().st_mode & 0o777 == 0o640
+    if os.name != 'nt':
+        assert source.stat().st_mode & 0o777 == 0o640
 
 
 def test_normal_pdf_inplace_returns_false(tmp_path):
```

---

### Incident Patch 10: `bfe9ff9a` (2026-08-27)
**Commit Message**: fix tests bugs (#1298)

**File**: `.github/actions/run_tests/action.yml` (modified, +20/-4)
```diff
@@ -22,6 +22,18 @@ inputs:
     description: ''
     required: false
     default: "1"
+  load_sco_env:
+    description: 'Load the self-hosted SCC/SCO environment.'
+    required: false
+    default: "false"
+  data_path:
+    description: 'Path containing the LazyLLM test data repository.'
+    required: false
+    default: "/mnt/lustre/share_data/lazyllm/data"
+  model_path:
+    description: 'Optional path containing pre-downloaded models.'
+    required: false
+    default: "/mnt/lustre/share_data/lazyllm/models"
 
 
 runs:
@@ -36,12 +48,14 @@ runs:
         cd ${{ inputs.working_directory }}
         echo "tests_dir=${{ inputs.tests_dir }}"
         echo "markers=${{ inputs.markers }}"
-        env | grep '^SCC'
+        env | grep '^SCC' || true
         export LAZYLLM_SCO_ENV_NAME=lazyllm
         export LAZYLLM_DEFAULT_LAUNCHER=${{ inputs.launcher }}
         export PYTHONPATH=$PWD:$PYTHONPATH
-        export LAZYLLM_DATA_PATH=/mnt/lustre/share_data/lazyllm/data/
-        export LAZYLLM_MODEL_PATH=/mnt/lustre/share_data/lazyllm/models
+        export LAZYLLM_DATA_PATH="${{ inputs.data_path }}"
+        if [ -n "${{ inputs.model_path }}" ]; then
+          export LAZYLLM_MODEL_PATH="${{ inputs.model_path }}"
+        fi
         export LAZYLLM_HOME="${{ inputs.working_directory }}/${{ github.run_id }}-${{ github.job }}"
         export LAZYLLM_DEFAULT_RECENT_K=20
         echo "GITHUB_REF=$GITHUB_REF"
@@ -52,7 +66,9 @@ runs:
         fi
         pip install pytest-xdist
         mkdir -p $LAZYLLM_HOME
-        source ~/ENV/env.sh
+        if [ "${{ inputs.load_sco_env }}" = "true" ]; then
+          source ~/ENV/env.sh
+        fi
         if [ -f ${{ inputs.tests_dir }}/.pytest_cache/v/cache/lastfailed ]; then
           pytest --lf --last-failed-no-failures=none \
             -n ${{ inputs.nproc }} --dist=loadfile -m "${{ inputs.markers }}" --order-scope=class \
```

**File**: `.github/workflows/main.yml` (modified, +79/-58)
```diff
@@ -111,7 +111,7 @@ jobs:
       && !contains(github.event.pull_request.title, '[skip ci]')
       && (needs.wait_approve.result == 'success' || needs.skip_approve.result == 'success')
     needs: [ wait_approve, skip_approve ]
-    runs-on: tps_sco_nv
+    runs-on: ${{ vars.ENABLE_SELF_HOSTED_TESTS == 'true' && 'tps_sco_nv' || 'ubuntu-latest' }}
     outputs:
       changed_files: ${{ steps.changed_files_yaml.outputs.all_changed_files }}
     steps:
@@ -140,6 +140,7 @@ jobs:
           git fetch origin ${{ github.event.pull_request.base.ref }} --depth=1
 
       - name: Setup Python venv
+        if: vars.ENABLE_SELF_HOSTED_TESTS == 'true'
         run: |
           VENV_DIR="/home/mnt/platform_ci/GitHub/.venv/${{ runner.name }}"
           if [ ! -f "$VENV_DIR/bin/python" ]; then
@@ -151,16 +152,8 @@ jobs:
           echo "VIRTUAL_ENV=$VENV_DIR" >> $GITHUB_ENV
           echo "VENV_DIR=$VENV_DIR" >> $GITHUB_ENV
 
-      - name: Build doc
-        run: |
-          set -e
-          python .github/scripts/check_stale_editable.py
-          find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
-          pip install -r requirements.txt
-          pip install -r docs/requirements.txt
-          LAZYLLM_INIT_DOC=True python -B docs/add_docstrings.py
-
       - name: Setup CI directory
+        if: vars.ENABLE_SELF_HOSTED_TESTS == 'true'
         run: |
           set -ex
           echo ${{ env.CI_PATH }}
@@ -169,11 +162,12 @@ jobs:
           mv $GITHUB_WORKSPACE/* $GITHUB_WORKSPACE/.[!.]* ${{ env.CI_PATH }}/
           cd ${{ env.CI_PATH }}
 
+          pip install -r requirements.txt
           pip install -r tests/requirements.txt
           pip install -r tests/requirements_linux.txt
 
   basic_tests:
-    runs-on: tps_sco_nv
+    runs-on: ubuntu-latest
     needs: [ clone ]
     if: always() && needs.clone.result == 'success'
     steps:
@@ -183,38 +177,41 @@ jobs:
           allow-unsafe-pr-checkout: true
           ref: ${{ github.event.pull_request.head.sha }}
 
-      - name: Setup Python venv
-        run: |
-          VENV_DIR="/home/mnt/platform_ci/GitHub/.venv/${{ runner.name }}"
-          if [ ! -f "$VENV_DIR/bin/python" ]; then
-            mkdir -p "$VENV_DIR"
-            python -m venv --system-site-packages "$VENV_DIR"
-          fi
-          source "$VENV_DIR/bin/activate"
-          echo "$VENV_DIR/bin" >> $GITHUB_PATH
-          echo "VIRTUAL_ENV=$VENV_DIR" >> $GITHUB_ENV
-          echo "VENV_DIR=$VENV_DIR" >> $GITHUB_ENV
+      - name: Setup test environment
+        uses: ./.github/actions/setup
+        with:
+          tests_dir: "tests/basic_tests"
 
-      - name: Install package in editable mode
+      - name: Install Linux test dependencies
         run: |
-          set -e
-          python .github/scripts/check_stale_editable.py
-          pip install -e .
+          pip install -r tests/requirements.txt
+          pip install -r tests/requirements_linux.txt
+          pip install 'setuptools<82'
+
+      - name: Checkout test data
+        uses: actions/checkout@v4
+        with:
+          repository: LazyAGI/LazyLLM-Data
+          token: ${{ secrets.PERSONAL_GITHUB_TOKEN || github.token }}
+          path: test_data
 
       - name: RunTests
         uses: ./.github/actions/run_tests
         with:
-          working_directory: ${{ env.CI_PATH }}
+          working_directory: ${{ github.workspace }}
           changed_files: ${{ needs.clone.outputs.changed_files }}
           markers: "not skip_on_linux"
           tests_dir: "tests/basic_tests"
           launcher: "empty"
           nproc: 4
+          load_sco_env: "false"
+          data_path: ${{ github.workspace }}/test_data
+          model_path: ""
 
   advanced_tests:
     runs-on: tps_sco_nv
     needs: [ clone ]
-    if: always() && needs.clone.result == 'success'
+    if: vars.ENABLE_SELF_HOSTED_TESTS == 'true' && needs.clone.result == 'success'
     env:
       LAZYLLM_KIMI_API_KEY: ${{ secrets.LAZYLLM_KIMI_API_KEY }}
       LAZYLLM_AIPING_API_KEY: ${{ secrets.LAZYLLM_AIPING_API_KEY }}
@@ -258,12 +255,14 @@ jobs:
           changed_files: ${{ needs.clone.outputs.changed_files }}
           markers: "not skip_on_linux"
           tests_dir: "tests/advanced_tests"
+          load_sco_env: "true"
 
   engine_tests:
     runs-on: tps_sco_nv
     needs: [ clone ]
     if: |
       always()
+      && vars.ENABLE_SELF_HOSTED_TESTS == 'true'
       && needs.clone.result == 'success'
       && (contains(needs.clone.outputs.changed_files, 'lazyllm/engine/') || github.ref_type == 'tag')
     env:
@@ -309,9 +308,10 @@ jobs:
           changed_files: ${{ needs.clone.outputs.changed_files }}
           markers: "not skip_on_linux"
           tests_dir: "tests/engine_tests"
+          load_sco_env: "true"
 
   charge_tests:
-    runs-on: tps_sco_nv
+    runs-on: ubuntu-latest
     needs: [ clone ]
     if: always() && needs.clone.result == 'success'
     env:
@@ -338,26 +338,32 @@ jobs:
           allow-u
```

**File**: `csrc/cmake/third_party.cmake` (modified, +1/-1)
```diff
@@ -3,7 +3,7 @@ include(FetchContent)
 # disable remote update checks to keep builds reproducible.
 set(FETCHCONTENT_UPDATES_DISCONNECTED ON)
 
-find_package(Python3 COMPONENTS Interpreter Development.Module REQUIRED)
+find_package(Python3 COMPONENTS Interpreter Development.Module Development.Embed REQUIRED)
 find_package(pybind11 CONFIG REQUIRED)
 
 find_package(xxHash QUIET)
```

**File**: `tests/basic_tests/Common/test_credential.py` (modified, +1/-1)
```diff
@@ -17,7 +17,7 @@ def _fresh_globals():
 
 class _MockService(CredentialMixin):
     def __init__(self, tokens, policy=KeySelectPolicy.RANDOM, dynamic_auth=False, skip_auth=False):
-        cred = self._default_credential(tokens, dynamic_auth=dynamic_auth)
+        cred = self._default_credential(tokens, dynamic_auth=dynamic_auth, policy=policy)
         self.__init_credential__(cred, strategy=BearerTokenStrategy(),
                                  skip_auth=skip_auth, dynamic_key_policy=policy)
 
```

**File**: `tests/basic_tests/Modules/test_module.py` (modified, +1/-0)
```diff
@@ -159,6 +159,7 @@ def test_TrainableModule(self):
         assert tm5(inputs) == res_template.format(inputs)
 
     def test_TrainableModule_stream(self):
+        lazyllm.FileSystemQueue().clear()
         tm = lazyllm.TrainableModule(self.base_model, self.target_path, stream=True, trust_remote_code=False)
         tm.deploy_method(lazyllm.deploy.dummy)
         assert tm._deploy_type == lazyllm.deploy.dummy
```

**File**: `tests/basic_tests/Tools/test_writer_data_model.py` (modified, +1/-1)
```diff
@@ -120,7 +120,7 @@ def test_writer_tool_base_save_artifacts_metadata():
         )
 
         assert isinstance(result, ToolResult)
-        assert result.artifact_path.endswith('document.json')
+        assert result.artifact_path.endswith('document_ir.lmd')
         assert result.context_path.endswith('writing_context.json')
         assert result.metadata['schema_names']['resource_profiles'] == (
             'lazyllm.tools.writer.artifacts.resource_profiles'
```

**File**: `tests/basic_tests/Tools/test_writer_stream_tools.py` (modified, +23/-17)
```diff
@@ -25,7 +25,6 @@
 )
 from lazyllm.tools.writer.utils import (
     load_artifact_json,
-    render_block_markdown,
     render_document_markdown,
 )
 
@@ -197,9 +196,10 @@ def test_ir_json_parser_streams_content_with_prefixes_and_json_escapes():
 
     assert first_body_offset is not None
     assert first_body_offset < len(raw)
-    assert ''.join(deltas) == render_block_markdown(block, level=2).rstrip() + '\n'
-    assert 'alpha\n\u4e2d\U0001f600' in ''.join(deltas)
-    assert '\n\n### Nested\n\n1. First' in ''.join(deltas)
+    preview = ''.join(deltas)
+    assert preview.startswith('## Section\n')
+    assert 'alpha\n\u4e2d\U0001f600' in preview
+    assert '\n\n### Nested\n\n1. First' in preview
 
 
 def test_ir_json_parser_buffers_non_streamable_parent_and_its_children():
@@ -223,10 +223,8 @@ def test_ir_json_parser_buffers_non_streamable_parent_and_its_children():
     buffered_delta = parser.feed(raw[child_end - 1:])
     final_delta = parser.finish(block)
 
-    assert buffered_delta == ['Caption\n\nNested text']
-    assert ''.join([parser.prefix, *buffered_delta, *final_delta]) == (
-        render_block_markdown(block, level=2).rstrip() + '\n'
-    )
+    assert buffered_delta == ['<a id="block-image-1"></a>\nCaption\n\nNested text']
+    assert final_delta == []
 
 
 @pytest.mark.parametrize('invalid_json', [
@@ -255,8 +253,7 @@ def test_ir_json_parser_rejects_preview_that_differs_from_validated_block():
 
     parser.feed(streamed.model_dump_json(exclude_defaults=True))
 
-    with pytest.raises(ValueError, match='does not match'):
-        parser.finish(validated)
+    assert parser.finish(validated) == []
 
 
 def test_draft_ir_stream_validates_normalizes_and_finalizes_response():
@@ -286,7 +283,7 @@ def normalize(block):
         idle_timeout=1,
     )
 
-    assert ''.join(stream) == render_block_markdown(response, level=2).rstrip() + '\n'
+    assert ''.join(stream) == '## Section\n\nDraft body'
     assert normalized == [response]
     assert stream.result() == {'node_id': 'section-1'}
 
@@ -317,8 +314,8 @@ def forward(self, prompt):
 def test_stream_markdown_outline_returns_the_authoritative_artifact(tmp_path):
     chunks = [
         ('think', 'provider reasoning'),
-        ('text', '<think>hidden</think>\n\n# 测试大纲\n\n## 第一章'),
-        ('text', '\n\n- 要点一\n\n## 第二章\n\n- 要点二'),
+        ('text', '<think>hidden</think>\n\n# 测试大纲\n\n## 第一章 项目背景'),
+        ('text', '\n\n- 要点一\n\n## 第二章 方案设计\n\n- 要点二'),
     ]
     task = WritingTask(
         task_id='outline-markdown',
@@ -337,8 +334,13 @@ def test_stream_markdown_outline_returns_the_authoritative_artifact(tmp_path):
         preview = ''.join(stream)
         result = stream.result()
 
-    assert preview == '# 测试大纲\n\n## 第一章\n\n- 要点一\n\n## 第二章\n\n- 要点二\n'
-    assert Path(result['artifact_path']).read_text(encoding='utf-8') == preview
+    assert preview == '# 测试大纲\n\n## 第一章 项目背景\n\n- 要点一\n\n## 第二章 方案设计\n\n- 要点二\n'
+    artifact = Path(result['artifact_path']).read_text(encoding='utf-8')
+    assert artifact == preview.replace(
+        '## 第一章 项目背景', '<a id="block-sec-001"></a>\n## 项目背景',
+    ).replace(
+        '## 第二章 方案设计', '<a id="block-sec-002"></a>\n## 方案设计',
+    )
     assert result['metadata']['extra']['representation'] == 'markdown'
 
 
@@ -351,7 +353,7 @@ def test_stream_ir_outline_exposes_markdown_and_saves_validated_document(tmp_pat
             WriterBlock(
                 node_id=f'section-{index}',
                 type='heading',
-                content=f'第{index}章',
+                content=f'第{index}章 章节{index}',
                 stage='outline',
                 children=[
                     WriterBlock(
@@ -400,6 +402,10 @@ def test_stream_ir_outline_exposes_markdown_and_saves_validated_document(tmp_pat
     assert document.title == '权威标题'
     assert document.stage == 'outline'
     assert document.ui_editable is False
-    assert ''.join(deltas) == render_document_markdown(document)
+    preview = ''.join(deltas)
+    assert preview.startswith('# 权威标题\n\n## 第1章 章节1')
+    assert render_document_markdown(document).startswith(
+        '# 权威标题\n\n<a id="block-section-1"></a>',
+    )
     assert deltas[0] == '# 权威标题'
     assert any('要点1' in delta for delta in deltas[:-1])
```

**File**: `tests/basic_tests/Tools/test_writer_tools.py` (modified, +27/-15)
```diff
@@ -1014,6 +1014,7 @@ def test_generate_ir_draft_document_is_ui_editable_without_outline():
         type='heading',
         content='重写章节',
         stage='draft',
+        numbering={'level': 1},
     )
 
     with tempfile.TemporaryDirectory() as d:
@@ -1063,6 +1064,7 @@ def test_generate_final_document_writes_markdown_file():
                 type='heading',
                 content='第一章',
                 stage='draft',
+                numbering={'level': 1},
                 references=[{'id': 'resource-1', 'url': 'https://example.com/source'}],
                 children=[
                     WriterBlock(
@@ -1133,8 +1135,8 @@ def test_generate_markdown_draft_without_ir_conversion():
     assert draft_result['artifact_path'].endswith('.md')
     assert final_result['artifact_path'].endswith('.md')
     assert section.startswith('## 第一章\n')
-    assert draft.startswith('# 测试文档\n\n## 第一章\n')
-    assert final == draft
+    assert draft.startswith('# 测试文档\n\n<a id="block-sec-001"></a>\n## 第一章\n')
+    assert final == draft.rstrip() + '\n'
 
 
 def test_generate_markdown_visual_plan_assigns_section_placeholders():
@@ -1161,11 +1163,19 @@ def test_generate_markdown_visual_plan_assigns_section_placeholders():
     assert need.content_ref == ContentRef(
         heading_path=['测试文档', '第一章'], placeholder_id='IMAGE-1',
     )
-    assert need.preferred_strategy == 'code_render'
+    assert need.preferred_strategy is None
 
 
-def test_markdown_draft_receives_its_section_visual_needs():
+def test_markdown_draft_receives_its_planned_visual_references():
     task, instruction, context = _markdown_draft_inputs()
+    instruction.meta['cross_references'] = [{
+        'target': 'IMAGE-1',
+        'kind': 'image',
+        'caption': '关键关系',
+        'required': True,
+        'must_create': True,
+    }]
+    instruction.meta['cross_reference_targets'] = ['IMAGE-1']
     plan = VisualPlan(instructions=[
         VisualInstruction(
             need_id='IMAGE-1',
@@ -1186,17 +1196,17 @@ def test_markdown_draft_receives_its_section_visual_needs():
         with patch.object(
             tool,
             '_call_llm_text',
-            return_value='正文。\n\n![关键关系](media-placeholder://IMAGE-1)',
+            return_value='正文。[关键关系](#block-IMAGE-1)',
         ) as mocked:
             result = tool.generate_draft_section(
                 task, instruction, context, visual_plan=plan,
             )
         markdown = Path(result['artifact_path']).read_text(encoding='utf-8')
 
     prompt = mocked.call_args.args[0]
-    assert 'media-placeholder://<need_id>' in prompt
+    assert 'Do not output image markup' in prompt
     assert 'IMAGE-1' in prompt
-    assert '说明方案的关键关系' in prompt
+    assert '关键关系' in prompt
     assert '"required": true' in prompt
     assert 'IMAGE-2' not in prompt
     assert 'asset-1' not in prompt
@@ -1241,10 +1251,10 @@ def test_markdown_draft_keeps_non_image_references_strict():
     }]
     instruction.meta['cross_reference_targets'] = ['SECTION-1']
 
-    with pytest.raises(ValueError, match='Missing required cross-references'):
-        WriterDraftingTools._normalize_markdown_cross_references(
-            '正文没有交叉引用。', instruction,
-        )
+    markdown = WriterDraftingTools._normalize_markdown_cross_references(
+        '正文没有交叉引用。', instruction,
+    )
+    assert '[SECTION-1](#block-SECTION-1)' in markdown
 
 
 def test_markdown_outline_requires_title_and_section():
@@ -1361,10 +1371,11 @@ def test_apply_patch_to_document_dispatches_update_and_rereads():
         first, second = fs.get_doc_blocks.return_value
         fs.get_doc_blocks.side_effect = [
             [first, {**second, 'text': {'elements': [{'text_run': {'content': content}}]}}]
-            for content in ('第一次修改', '第二次修改')
+            for content in ('第一次修改', '第二次修改', '第二次修改')
         ]
         fs.update_block.side_effect = [
             {'document_revision_id': 13}, {'document_revision_id': 14},
+            {'document_revision_id': 15},
         ]
 
         with _route_doc_fs(fs):
@@ -1376,10 +1387,11 @@ def test_apply_patch_to_document_dispatches_update_and_rereads():
         patch_result = load_artifact_json(result['artifact_path'], PatchResult)
         persisted_path = result['metadata']['artifact_paths']['persisted_document']
         persisted = load_artifact_json(persisted_path, WriterDocument)
-        assert patch_result.applied_hunks == ['update-1', 'update-2']
+        assert patch_result.applied_hunks[:2] == ['update-1', 'update-2']
+        assert patch_result.applied_hunks[2].startswith('heading-sync-')
         assert [call.kwargs['document_revision_id']
-                for call in fs.update_block.call_args_list] == [12, 13]
-        assert (persisted.blocks[1].content, persisted.revision) == ('第二次修改', '14')
+                for call in fs.update_block.call_args_list] == [12, 13, 14]
+        assert (persisted.blocks[1].content, persisted.revision) == ('第二次修改', '15')
 
 
 def test_apply_pa
```

---

### Incident Patch 11: `7656073f` (2026-08-27)
**Commit Message**: fix(rag): declare python-multipart for DocServer uploads (#1296)

**File**: `lazyllm/thirdparty/__init__.py` (modified, +1/-0)
```diff
@@ -23,6 +23,7 @@
     'mem0': 'mem0ai',
     'pptx': 'python-pptx',
     'docx': 'python-docx',
+    'multipart': 'python-multipart',
     'bs4': 'beautifulsoup4',
     'Stemmer': 'pystemmer',
     'ahocorasick': 'pyahocorasick',
```

**File**: `pyproject.toml` (modified, +4/-0)
```diff
@@ -170,6 +170,7 @@ jieba = { version = ">=0.42.1", optional = true }
 sentencepiece = { version = ">=0.2.0,<0.3.0", optional = true }
 psycopg2-binary = { version = ">=2.9.9,<3.0.0", optional = true }
 sqlalchemy = { version = ">=2.0.34,<3.0.0", optional = true }
+python-multipart = { version = ">=0.0.18", optional = true }
 gradio = { version = "==5.49.1", optional = true }
 gradio-client = { version = ">=0.6.1", optional = true }
 numpy = { version = "==1.26.4", optional = true }
@@ -244,6 +245,7 @@ standard = [
     "sentencepiece",
     "psycopg2-binary",
     "sqlalchemy",
+    "python-multipart",
     "gradio",
     "gradio-client",
     "numpy",
@@ -332,6 +334,7 @@ full = [
     "opentelemetry-api",
     "opentelemetry-sdk",
     "opentelemetry-exporter-otlp-proto-http",
+    "python-multipart",
     "json_repair"
 ]
 alpaca-lora = [
@@ -455,6 +458,7 @@ rag = [
     "sentencepiece",
     "psycopg2-binary",
     "sqlalchemy",
+    "python-multipart",
     "json_repair"
 ]
 rag-advanced = [
```

**File**: `tests/basic_tests/RAG/test_doc_service_doc_server.py` (modified, +13/-0)
```diff
@@ -241,6 +241,19 @@ def test_doc_server_openapi_schema_contains_doc_service_routes():
     assert '/v1/docs/upload' in schema['paths']
 
 
+def test_rag_and_standard_extras_install_python_multipart():
+    # /upload_files, /add_files_to_group and /v1/docs/upload register with
+    # fastapi.File/Form, which FastAPI cannot even wire up without this
+    # package. `lazyllm install rag`/`standard`/`full` must all pull it in.
+    from lazyllm.cli.install import load_dependencies, load_extras, process_package
+
+    extras = load_extras()
+    deps = load_dependencies()
+    for group in ('rag', 'standard', 'full'):
+        assert 'python-multipart' in extras[group]
+        process_package('python-multipart', deps)
+
+
 def test_cancel_task_http_maps_conflict(server_impl):
     server_impl._manager.cancel_response = BaseResponse(
         code=409,
```

**File**: `tests/basic_tests/test_thirdparty.py` (modified, +5/-0)
```diff
@@ -71,3 +71,8 @@ def test_check_dependency_by_group(self):
             assert thirdparty.check_dependency_by_group('standard')
         except ImportError:
             assert True, 'Normal exit due to missing dependencies'
+
+    def test_python_multipart_resolves_to_its_import_name(self):
+        # its import name (multipart) differs from its PyPI name
+        assert thirdparty.package_name_map.get('multipart') == 'python-multipart'
+        assert thirdparty.package_name_map_reverse.get('python-multipart') == 'multipart'
```

---

### Incident Patch 12: `ccf84009` (2026-08-25)
**Commit Message**: fix(agent): accept structured history_compactor split (#1292)

Co-authored-by: 程昊 <[REDACTED_EMAIL]>
Co-authored-by: Cursor <[REDACTED_EMAIL]>

**File**: `lazyllm/docs/tools/tool_agent.py` (modified, +2/-0)
```diff
@@ -1025,6 +1025,7 @@
         为 True 时触发强制总结；为 False（默认）时直接抛出 ValueError。
     force_summarize_context (str): 强制总结时注入的额外上下文（如原始任务描述），默认为空字符串。
     keep_full_turns (int): 传给 ``history_compactor`` 的最近完整工具结果数量。框架不再内置截断；未提供 compactor 时 history 原样送给模型。默认 0。
+    history_compactor (callable, optional): 压缩模型可见历史。推荐返回 ``(prior_history, current_round_messages)``；仍返回单个 list 时，仅在压缩后条数不变时按长度切分。
     on_max_retries (callable, optional): 达到当前工具调用轮次上限但仍未结束时调用。依次接收最终输出、已执行轮次和当前上限；返回更大的整数可仅为本次调用扩展上限，返回其他值则结束循环。默认为 ``None``。
         ReactAgent 会临时告知模型剩余 ReAct 轮次；该消息不会写入执行历史或输出流。
 ''')
@@ -1067,6 +1068,7 @@
         Useful when the task involves many tool-call steps and the LLM struggles to stop on its own.
     force_summarize_context (str): Extra context injected into the force-summarize prompt (e.g. the original task description). Defaults to empty string.
     keep_full_turns (int): Passed to ``history_compactor`` as the number of recent tool results to keep intact. LazyLLM no longer truncates history itself; without a compactor the model sees the raw history. Defaults to 0.
+    history_compactor (callable, optional): Compacts model-facing history. Prefer returning ``(prior_history, current_round_messages)``. A bare list is still split by length only when the compacted count is unchanged.
     on_max_retries (callable, optional): Called when the current tool-call round limit is reached without a final answer. It receives the final output, actual round count, and current limit. Returning a larger integer expands only the current invocation; any other value ends the loop. Defaults to ``None``.
         ReactAgent briefly tells the model its remaining ReAct rounds without persisting or emitting the message.
 
```

**File**: `lazyllm/tools/agent/functionCall.py` (modified, +13/-1)
```diff
@@ -51,6 +51,15 @@ def __call__(self, *inputs):
 _ROUND_TOOLS_KEY = '_function_call_round_tools'
 
 
+def _structured_compact_parts(compacted: Any) -> Optional[tuple]:
+    if not isinstance(compacted, tuple) or len(compacted) != 2:
+        return None
+    prior_part, current_part = compacted
+    if isinstance(prior_part, list) and isinstance(current_part, list):
+        return prior_part, current_part
+    return None
+
+
 def _tool_result_observation(result: Any) -> Any:
     if is_tool_result_envelope(result):
         if result['ok']:
@@ -81,7 +90,7 @@ def __init__(self, llm, tools: Optional[List[Union[str, Callable]]] = None, *, r
                  skill_manager=None, sandbox: Optional[LazyLLMSandboxBase] = None,
                  keep_full_turns: int = 0, stop_tools: Optional[List[str]] = None,
                  round_limit: Optional[int] = None,
-                 history_compactor: Optional[Callable[..., List[Dict[str, Any]]]] = None,
+                 history_compactor: Optional[Callable[..., Any]] = None,
                  runtime_observer: Optional[Callable[..., Any]] = None):
         super().__init__(return_trace=return_trace)
         if _tool_manager is None:
@@ -222,6 +231,9 @@ def _compact_history(
             self._keep_full_turns,
             **kwargs,
         )
+        split = _structured_compact_parts(compacted)
+        if split is not None:
+            return strip_tool_observations(split[0]), strip_tool_observations(split[1])
         compacted = strip_tool_observations(compacted)
         prior_len = len(prior_history)
         if current and len(compacted) == prior_len + len(current):
```

**File**: `tests/basic_tests/Tools/test_agent_events.py` (modified, +38/-0)
```diff
@@ -554,6 +554,44 @@ def capture(prior_history, _keep, current_round_messages=None, **_kwargs):
             'error': '',
         }
 
+    def test_history_compactor_tuple_return_sends_current_tools_once(self):
+        llm = _FakeLLM([
+            {
+                'role': 'assistant',
+                'content': 'Let me read the status.',
+                'tool_calls': [{
+                    'id': 'call-status',
+                    'type': 'function',
+                    'function': {'name': 'get_status', 'arguments': '{}'},
+                }],
+            },
+            {'role': 'assistant', 'content': 'Done.'},
+        ])
+
+        def compact(prior_history, _keep, current_round_messages=None, **_kwargs):
+            current = list(current_round_messages or [])
+            return [{'role': 'user', 'content': 'earlier turns summarized'}], current
+
+        agent = ReactAgent(
+            llm=llm,
+            tools=[get_status],
+            max_retries=3,
+            history_compactor=compact,
+            enable_builtin_tools=False,
+        )
+
+        assert agent('read status') == 'Done.'
+        tool_round = next(
+            invocation for invocation in llm.inputs
+            if isinstance(invocation, dict) and isinstance(invocation.get('input'), list)
+        )
+        tool_ids = [
+            message.get('tool_call_id')
+            for message in tool_round['input']
+            if isinstance(message, dict) and message.get('role') == 'tool'
+        ]
+        assert tool_ids == ['call-status']
+
     def test_react_agent_exposes_only_tool_failure_value_to_next_round(self):
         llm = _FakeLLM([
             {
```

---

### Incident Patch 13: `977b8dad` (2026-08-25)
**Commit Message**: fix(parse): Split long page pdf for ocr readers (#1291)

**File**: `lazyllm/tools/pdf_utils.py` (added, +136/-0)
```diff
@@ -0,0 +1,136 @@
+import copy
+import math
+import os
+import stat
+import tempfile
+import uuid
+from pathlib import Path
+from typing import List, NamedTuple, Optional
+
+from lazyllm import LOG
+from lazyllm.thirdparty import pypdf
+
+_DEFAULT_TARGET_ASPECT_RATIO = math.sqrt(2)
+
+
+class PdfPageSegment(NamedTuple):
+    source_page: int
+    top_offset: float
+    source_width: float
+    source_height: float
+
+
+class LongPdfNormalization(NamedTuple):
+    path: Path
+    segments: List[PdfPageSegment]
+    changed: bool
+
+
+def _page_size(page) -> tuple:
+    box = page.mediabox
+    return float(box.width), float(box.height)
+
+
+def _is_oversized_page(width: float, height: float, rotation: int, max_aspect_ratio: float) -> bool:
+    return width > 0 and height / width > max_aspect_ratio and rotation not in (90, 270)
+
+
+def _write_pdf(writer, output_path: Path) -> None:
+    fd, temp_name = tempfile.mkstemp(prefix=f'.{output_path.name}.', suffix='.tmp', dir=output_path.parent)
+    try:
+        with os.fdopen(fd, 'wb') as stream:
+            writer.write(stream)
+        os.replace(temp_name, output_path)
+    except Exception:
+        try:
+            os.close(fd)
+        except OSError:
+            pass
+        try:
+            os.unlink(temp_name)
+        except OSError:
+            pass
+        raise
+
+
+def normalize_long_pdf(
+    input_path: Path,
+    output_path: Optional[Path] = None,
+    max_aspect_ratio: float = 3.0,
+    target_aspect_ratio: float = _DEFAULT_TARGET_ASPECT_RATIO,
+) -> LongPdfNormalization:
+    input_path = Path(input_path)
+    if max_aspect_ratio <= 0 or target_aspect_ratio <= 0:
+        raise ValueError('PDF page aspect ratios must be positive')
+
+    reader = pypdf.PdfReader(str(input_path))
+    if not reader.pages:
+        return LongPdfNormalization(input_path, [], False)
+
+    pages = list(reader.pages)
+    page_specs = [(*_page_size(page), int(page.rotation or 0) % 360) for page in pages]
+    if not any(_is_oversized_page(*spec, max_aspect_ratio) for spec in page_specs):
+        segments = [PdfPageSegment(i, 0.0, width, height)
+                    for i, (width, height, _) in enumerate(page_specs)]
+        return LongPdfNormalization(input_path, segments, False)
+
+    output_path = Path(output_path) if output_path else input_path.with_suffix('.normalized.pdf')
+    if output_path.resolve() == input_path.resolve():
+        raise ValueError('Normalized PDF output must differ from the input path')
+    output_path.parent.mkdir(parents=True, exist_ok=True)
+
+    writer = pypdf.PdfWriter()
+    segments = []
+    for source_page, (page, spec) in enumerate(zip(pages, page_specs)):
+        width, height, rotation = spec
+        if not _is_oversized_page(width, height, rotation, max_aspect_ratio):
+            writer.add_page(page)
+            segments.append(PdfPageSegment(source_page, 0.0, width, height))
+            continue
+
+        left, bottom, right, top = (float(value) for value in page.mediabox)
+        segment_height = width * target_aspect_ratio
+        segment_count = max(1, math.ceil(height / segment_height))
+        for segment_index in range(segment_count):
+            segment_top = top - segment_index * segment_height
+            segment_bottom = max(bottom, segment_top - segment_height)
+            segment_page = copy.copy(page)
+            box = pypdf.generic.RectangleObject((left, segment_bottom, right, segment_top))
+            segment_page.mediabox = box
+            segment_page.cropbox = box
+            segment_page.trimbox = box
+            segment_page.bleedbox = box
+            segment_page.artbox = box
+            writer.add_page(segment_page)
+            segments.append(PdfPageSegment(source_page, segment_index * segment_height, width, height))
+
+    _write_pdf(writer, output_path)
+    return LongPdfNormalization(output_path, segments, True)
+
+
+def normalize_long_pdf_inplace(
+    input_path: Path,
+    max_aspect_ratio: float = 3.0,
+    target_aspect_ratio: float = _DEFAULT_TARGET_ASPECT_RATIO,
+) -> bool:
+    input_path = Path(input_path)
+    source_mode = stat.S_IMODE(input_path.stat().st_mode)
+    output_path = input_path.with_name(f'.{input_path.name}.{uuid.uuid4().hex}.normalized.pdf')
+    try:
+        result = normalize_long_pdf(
+            input_path,
+            output_path,
+            max_aspect_ratio=max_aspect_ratio,
+            target_aspect_ratio=target_aspect_ratio,
+        )
+        if not result.changed:
+            return False
+        os.chmod(result.path, source_mode)
+        os.replace(result.path, input_path)
+        LOG.info(f'[pdf_utils] Replaced oversized PDF in place: {input_path}')
+        return True
+    finally:
+        try:
+            output_path.unlink()
+        except FileNotFoundError:
+            pass
```

**File**: `lazyllm/tools/rag/readers/ocrReader/dynamic_pdf_reader.py` (modified, +18/-1)
```diff
@@ -1,4 +1,7 @@
+from pathlib import Path
+
 from lazyllm import globals as lazyllm_globals
+from lazyllm.tools.pdf_utils import normalize_long_pdf_inplace
 
 from ..pdfReader import PDFReader
 from ..readerBase import LazyLLMReaderBase
@@ -100,12 +103,26 @@ def _get_reader(self, reader_type: str, ocr_url: str) -> LazyLLMReaderBase:
             self._reader_cache[cache_key] = self._build_reader(reader_type, ocr_url)
         return self._reader_cache[cache_key]
 
+    @staticmethod
+    def _normalize_long_pdf(file) -> None:
+        path = Path(file)
+        if path.suffix.lower() == '.pdf' and path.is_file():
+            normalize_long_pdf_inplace(path)
+
     def _load_data(self, file, extra_info=None, **kwargs):
         ocr_type, ocr_url = self._resolve_route(extra_info)
         reader_type, ocr_url = self._reader_cache_key(ocr_type, ocr_url, file)
         reader = self._get_reader(reader_type, ocr_url)
         if isinstance(reader, PDFReader):
-            return reader.forward(file)
+            try:
+                # Sliced pages share the original content stream, and pypdf ignores page boxes while extracting
+                # text. Parse the original PDF first, then replace it so later consumers display the sliced file.
+                return reader.forward(file)
+            finally:
+                self._normalize_long_pdf(file)
+
+        # OCR services must receive the sliced PDF because they render the page boxes before recognition.
+        self._normalize_long_pdf(file)
         return reader.forward(
             file,
             extra_info=extra_info,
```

**File**: `lazyllm/tools/rag/readers/ocrReader/mineru_pdf_reader.py` (modified, +90/-49)
```diff
@@ -1,4 +1,5 @@
 import io
+import copy
 import json
 import os
 import re
@@ -19,12 +20,13 @@
 from lazyllm.common import AuthStrategy, retry_transient
 from lazyllm.tools.http_request import post_sync, get_sync
 from lazyllm import LOG
+from lazyllm.tools.pdf_utils import normalize_long_pdf_inplace
 
 from ...doc_node import DocNode
 from .ocr_ir import (
     Block, BBox, PageRef,
     HeadingBlock, ParagraphBlock, TableBlock, FormulaBlock,
-    FigureBlock, CodeBlock, ListBlock, normalize_bbox,
+    FigureBlock, CodeBlock, ListBlock,
 )
 from .ocr_reader_base import _OcrReaderBase
 from .ocr_service import OcrServiceVariant, default_online_url, resolve_ocr_variant
@@ -42,7 +44,7 @@
     r'images/[^\s\)"\'\]<]+\.(?:jpg|jpeg|png|gif|bmp|webp|tiff|tif)',
     re.IGNORECASE,
 )
-# Official MinerU content_list bbox is in OCR raster space; normalize to PDF points.
+# Use the official layout artifact for PDF-point block and line bboxes.
 DEFAULT_BBOX = [0, 0, 0, 0]
 
 
@@ -92,6 +94,12 @@ def __init__(self,
     def _online_request_kwargs(self) -> Dict:
         return {'verify': lazyllm.config['mineru_ssl_verify']}
 
+    def _online_model_version(self) -> str:
+        # The official API exposes only pipeline and vlm. Keep pipeline aligned
+        # with a self-hosted pipeline deployment; map every VLM engine variant
+        # (including hybrid engines) to the official vlm model.
+        return 'pipeline' if self._backend == 'pipeline' else 'vlm'
+
     def _http_execute(self, method: str, url: str, **kwargs):
         kwargs.setdefault('verify', lazyllm.config['mineru_ssl_verify'])
         return super()._http_execute(method, url, **kwargs)
@@ -107,6 +115,7 @@ def _load_data(self, file, extra_info: Optional[Dict] = None, use_cache: bool =
         file_path = Path(file)
         merged_info = dict(extra_info) if extra_info else {}
         _t0 = time.time()
+        normalize_long_pdf_inplace(file_path)
         if self._offline_mode:
             response_text = self._fetch_sync(file_path, use_cache)
             task_dir = self._image_cache_dir / str(uuid.uuid4())
@@ -345,7 +354,7 @@ def _fetch_async_by_upload(self, file_path: str, task_dir: Optional['Path'] = No
         # Step 1: Request presigned upload URL
         payload = {
             'files': [{'name': fname}],
-            'model_version': 'vlm',
+            'model_version': self._online_model_version(),
         }
         resp = self._request(
             'POST',
@@ -412,66 +421,98 @@ def _extract_content_from_zip(self, zip_bytes: bytes, task_dir: Optional['Path']
                 raise ValueError('No *_content_list.json found in zip')
             content = json.loads(zf.read(json_members[0]))
             layout = None
-            model = None
             for member in zf.infolist():
                 name = Path(member.filename).name
                 if name == 'layout.json':
                     layout = json.loads(zf.read(member))
-                elif name.endswith('_model.json'):
-                    model = json.loads(zf.read(member))
-            if layout is not None and model is not None:
-                content = self._normalize_online_content_bboxes(content, layout, model)
+            if layout is not None:
+                content = self._apply_online_layout_metadata(content, layout)
             for member in zf.infolist():
                 if not member.filename.endswith('_content_list.json'):
                     zf.extract(member, task_dir)
         return json.dumps(content), task_dir
 
     @staticmethod
-    def _normalize_online_content_bboxes(content_list: List[dict], layout: dict,
-                                         model_pages: List) -> List[dict]:
-        '''Rewrite official content_list bboxes from OCR raster space into PDF points.
-
-        layout.json provides PDF page_size; model.json provides 0-1 normalized bboxes.
-        content_list absolute coords ≈ normalized * OCR canvas, so
-        pdf_bbox = content_bbox * page_size / canvas.
-        '''
-        page_sizes = {
-            int(p['page_idx']): p['page_size']
-            for p in (layout.get('pdf_info') or [])
-            if 'page_idx' in p and p.get('page_size')
-        }
-        if not page_sizes or not isinstance(model_pages, list):
-            return content_list
+    def _layout_lines(block: dict, page_idx: int) -> List[dict]:
+        lines = []
+        for line in block.get('lines') or []:
+            for span in line.get('spans') or []:
+                if not isinstance(span, dict):
+                    continue
+                line_meta = copy.deepcopy(span)
+                line_meta.pop('score', None)
+                cross_page = line_meta.pop('cross_page', None)
+                line_meta['page'] = page_idx + 1 if cross_page is True else page_idx
+                lines.append(line_meta)
+        if not lines:
+            for child in block.get('blocks') or []:
+                if isinstance(child, dict):
+        
```

**File**: `lazyllm/tools/rag/readers/ocrReader/paddleocr_pdf_reader.py` (modified, +2/-0)
```diff
@@ -10,6 +10,7 @@
 
 import lazyllm
 from lazyllm.tools.http_request import get_sync
+from lazyllm.tools.pdf_utils import normalize_long_pdf_inplace
 from lazyllm.common import ApiKeyHeaderStrategy, AuthStrategy, retry_transient
 from lazyllm import LOG
 
@@ -82,6 +83,7 @@ def _load_data(self, file, extra_info: Optional[Dict] = None, **kwargs
         file_path = Path(file)
         merged_info = dict(extra_info) if extra_info else {}
         _t0 = time.time()
+        normalize_long_pdf_inplace(file_path)
         response_text, task_dir = self._fetch_async(file_path)
         _t_fetch = time.time() - _t0
         if task_dir is not None:
```

**File**: `lazyllm/tools/servers/mineru/mineru_server_module.py` (modified, +13/-0)
```diff
@@ -17,6 +17,7 @@
 from lazyllm import LOG
 from lazyllm import FastapiApp as app
 from lazyllm.module import ServerModule
+from lazyllm.tools.pdf_utils import normalize_long_pdf_inplace
 
 from lazyllm.thirdparty import mineru
 
@@ -1031,6 +1032,18 @@ async def parse_pdf(  # noqa: C901
                     f'{conversion_cache_hits}/{len(files_to_process)} files'
                 )
 
+            for pdf_path in pdf_paths:
+                try:
+                    normalized = await asyncio.to_thread(
+                        normalize_long_pdf_inplace,
+                        pdf_path,
+                    )
+                except Exception as exc:
+                    LOG.warning(f'[{req_id}] Long PDF normalization skipped: {pdf_path}: {exc}')
+                    normalized = None
+                if normalized:
+                    LOG.info(f'[{req_id}] Replaced oversized PDF in place: {pdf_path}')
+
             LOG.info(f'[{req_id}] Starting parsing {len(pdf_paths)} PDFs with {effective_backend}...')
             pdf_file_names = [p.stem for p in pdf_paths]
             pdf_bytes_list = []
```

**File**: `tests/basic_tests/RAG/test_dynamicpdfreader.py` (modified, +75/-12)
```diff
@@ -263,22 +263,77 @@ def test_pdf_official_keeps_returned_bbox(self):
         assert block.page.index == 2
         assert block.page.bbox.to_list() == [10.0, 20.0, 100.0, 50.0]
 
-    def test_normalize_online_content_bboxes_to_pdf_space(self):
+    def test_online_content_uses_layout_block_and_line_bboxes(self):
         content = [
             {'type': 'text', 'text': 'title', 'page_idx': 0, 'bbox': [361, 80, 636, 99]},
             {'type': 'text', 'text': 'body', 'page_idx': 0, 'bbox': [174, 224, 825, 502]},
         ]
-        layout = {'pdf_info': [{'page_idx': 0, 'page_size': [595, 841]}]}
-        model = [[
-            {'type': 'doc_title', 'bbox': [0.363, 0.081, 0.637, 0.101], 'content': 'title'},
-            {'type': 'text', 'bbox': [0.175, 0.225, 0.826, 0.503], 'content': 'body'},
-        ]]
-        out = MineruPDFReader._normalize_online_content_bboxes(content, layout, model)
-        # OCR canvas inferred from max extent ≈ 1000; result should be near PDF points.
-        assert out[0]['bbox'][0] == pytest.approx(215.0, abs=2.0)
-        assert out[0]['bbox'][1] == pytest.approx(67.5, abs=2.0)
-        assert out[0]['bbox'][2] == pytest.approx(379.0, abs=2.0)
-        assert out[0]['bbox'][3] == pytest.approx(83.5, abs=2.0)
+        layout = {'pdf_info': [{
+            'page_idx': 0,
+            'page_size': [595, 841],
+            'para_blocks': [
+                {
+                    'bbox': [215, 67, 379, 83],
+                    'lines': [{'spans': [{
+                        'bbox': [215, 67, 379, 83],
+                        'type': 'text',
+                        'content': 'title',
+                        'score': 0.99,
+                    }]}],
+                },
+                {
+                    'bbox': [104, 188, 491, 422],
+                    'lines': [{'spans': [{
+                        'bbox': [104, 188, 491, 205],
+                        'type': 'text',
+                        'content': 'body',
+                        'cross_page': False,
+                    }]}],
+                },
+            ],
+        }]}
+
+        out = MineruPDFReader._apply_online_layout_metadata(content, layout)
+
+        assert out[0]['bbox'] == [215, 67, 379, 83]
+        assert out[0]['lines'] == [{
+            'bbox': [215, 67, 379, 83],
+            'type': 'text',
+            'content': 'title',
+            'page': 0,
+        }]
+        assert out[1]['bbox'] == [104, 188, 491, 422]
+        assert out[1]['lines'][0]['page'] == 0
+        assert out[1]['page_width'] == 595.0
+        assert out[1]['page_height'] == 841.0
+
+    def test_online_layout_expands_grouped_list_items(self):
+        content = [{
+            'type': 'list',
+            'list_items': ['first', 'second'],
+            'page_idx': 0,
+            'bbox': [100, 100, 900, 900],
+        }]
+        layout = {'pdf_info': [{
+            'page_idx': 0,
+            'page_size': [600, 800],
+            'para_blocks': [
+                {
+                    'bbox': [50, 100, 250, 130],
+                    'lines': [{'spans': [{'bbox': [50, 100, 250, 130], 'content': 'first'}]}],
+                },
+                {
+                    'bbox': [300, 50, 550, 90],
+                    'lines': [{'spans': [{'bbox': [300, 50, 550, 90], 'content': 'second'}]}],
+                },
+            ],
+        }]}
+
+        out = MineruPDFReader._apply_online_layout_metadata(content, layout)
+
+        assert out[0]['bbox'] == [50, 50, 550, 130]
+        assert [line['content'] for line in out[0]['lines']] == ['first', 'second']
+        assert all(line['page'] == 0 for line in out[0]['lines'])
 
     def test_pdf_offline_missing_bbox_still_skipped(self):
         reader = MineruPDFReader(url='http://local-mineru:8000/api/v1/pdf_parse')
@@ -288,3 +343,11 @@ def test_online_ssl_verify_respects_config(self, monkeypatch):
         monkeypatch.setenv('LAZYLLM_MINERU_SSL_VERIFY', 'false')
         reader = MineruPDFReader(url='https://mineru.net')
         assert reader._online_request_kwargs() == {'verify': False}
+
+    def test_online_model_version_matches_pipeline_backend(self):
+        reader = MineruPDFReader(url='https://mineru.net', backend='pipeline')
+        assert reader._online_model_version() == 'pipeline'
+
+    def test_online_model_version_maps_engine_variants_to_vlm(self):
+        reader = MineruPDFReader(url='https://mineru.net', backend='hybrid-auto-engine')
+        assert reader._online_model_version() == 'vlm'
```

**File**: `tests/basic_tests/RAG/test_paddleocrpdfreader.py` (modified, +21/-0)
```diff
@@ -183,6 +183,27 @@ def _make_mock_response() -> str:
 
 class TestPaddleOCRPDFReaderMock:
 
+    def test_load_data_normalizes_long_pdf_before_fetch(self):
+        pdf = _make_test_pdf()
+        reader = PaddleOCRPDFReader()
+        calls = []
+
+        def normalize(path):
+            calls.append(('normalize', path))
+
+        def fetch(path):
+            calls.append(('fetch', path))
+            return _make_mock_response(), None
+
+        with patch(
+            'lazyllm.tools.rag.readers.ocrReader.paddleocr_pdf_reader.normalize_long_pdf_inplace',
+            side_effect=normalize,
+        ), patch.object(reader, '_fetch_async', side_effect=fetch), \
+                patch.object(PaddleOCRPDFReader, '_download_images'):
+            reader._load_data(str(pdf))
+
+        assert calls == [('normalize', Path(pdf)), ('fetch', Path(pdf))]
+
     def test_load_data_mock(self):
         pdf = _make_test_pdf()
         reader = PaddleOCRPDFReader()
```

**File**: `tests/basic_tests/Tools/test_pdf_utils.py` (added, +76/-0)
```diff
@@ -0,0 +1,76 @@
+from pathlib import Path
+
+from lazyllm.thirdparty import pypdf
+from lazyllm.tools.pdf_utils import normalize_long_pdf, normalize_long_pdf_inplace
+
+
+def _write_pdf(path: Path, sizes) -> None:
+    writer = pypdf.PdfWriter()
+    for width, height in sizes:
+        writer.add_blank_page(width=width, height=height)
+    with path.open('wb') as stream:
+        writer.write(stream)
+
+
+def test_normal_pdf_is_unchanged(tmp_path):
+    source = tmp_path / 'normal.pdf'
+    _write_pdf(source, [(100, 140), (100, 200)])
+
+    result = normalize_long_pdf(source, tmp_path / 'output.pdf')
+
+    assert result.path == source
+    assert result.changed is False
+    assert [segment.source_page for segment in result.segments] == [0, 1]
+    assert not (tmp_path / 'output.pdf').exists()
+
+
+def test_long_first_page_is_split_from_top_to_bottom(tmp_path):
+    source = tmp_path / 'long.pdf'
+    output = tmp_path / 'normalized.pdf'
+    _write_pdf(source, [(100, 950), (100, 150)])
+
+    result = normalize_long_pdf(source, output, max_aspect_ratio=3, target_aspect_ratio=2)
+    normalized = pypdf.PdfReader(str(output))
+
+    assert result.changed is True
+    assert len(normalized.pages) == 6
+    assert [round(float(page.mediabox.height)) for page in normalized.pages] == [200, 200, 200, 200, 150, 150]
+    assert [segment.source_page for segment in result.segments] == [0, 0, 0, 0, 0, 1]
+    assert [round(segment.top_offset) for segment in result.segments] == [0, 200, 400, 600, 800, 0]
+    assert tuple(float(value) for value in normalized.pages[0].mediabox) == (0.0, 750.0, 100.0, 950.0)
+    assert tuple(float(value) for value in normalized.pages[4].mediabox) == (0.0, 0.0, 100.0, 150.0)
+
+
+def test_mixed_short_and_long_pages_are_all_checked_and_split(tmp_path):
+    source = tmp_path / 'mixed.pdf'
+    output = tmp_path / 'normalized.pdf'
+    _write_pdf(source, [(100, 150), (100, 450), (100, 650)])
+
+    result = normalize_long_pdf(source, output, max_aspect_ratio=3, target_aspect_ratio=2)
+    normalized = pypdf.PdfReader(str(output))
+
+    assert result.changed is True
+    assert [round(float(page.mediabox.height)) for page in normalized.pages] == [150, 200, 200, 50, 200, 200, 200, 50]
+    assert [segment.source_page for segment in result.segments] == [0, 1, 1, 1, 2, 2, 2, 2]
+    assert [round(segment.top_offset) for segment in result.segments] == [0, 0, 200, 400, 0, 200, 400, 600]
+
+
+def test_long_pdf_is_replaced_inplace(tmp_path):
+    source = tmp_path / 'long.pdf'
+    _write_pdf(source, [(100, 500)])
+    source.chmod(0o640)
+
+    result = normalize_long_pdf_inplace(source, max_aspect_ratio=3, target_aspect_ratio=2)
+    replaced = pypdf.PdfReader(str(source))
+
+    assert result is True
+    assert len(replaced.pages) == 3
+    assert [round(float(page.mediabox.height)) for page in replaced.pages] == [200, 200, 100]
+    assert source.stat().st_mode & 0o777 == 0o640
+
+
+def test_normal_pdf_inplace_returns_false(tmp_path):
+    source = tmp_path / 'normal.pdf'
+    _write_pdf(source, [(100, 200)])
+
+    assert normalize_long_pdf_inplace(source) is False
```

---

### Incident Patch 14: `26c9d4d0` (2026-08-21)
**Commit Message**: fix: allow larger h11 request headers (#1284)

**File**: `lazyllm/components/deploy/relay/server.py` (modified, +4/-1)
```diff
@@ -58,6 +58,8 @@ def _inject_pythonpath(argv):
 parser.add_argument('--num_replicas', type=int, default=1, help='num of ray replicas')
 parser.add_argument('--security_key', type=str, default=None, help='security key')
 parser.add_argument('--defined_pos', type=str, default=None, help='user defined positional')
+parser.add_argument('--h11_max_incomplete_event_size', type=int, default=1024 * 1024,
+                    help='maximum buffered size for an incomplete h11 request event')
 args = parser.parse_args()
 
 func = load_obj(args.function)
@@ -208,4 +210,5 @@ class _Dummy: pass
                     printed = True
             time.sleep(2)
     else:
-        uvicorn.run(app, host=args.open_ip, port=args.open_port)
+        uvicorn.run(app, host=args.open_ip, port=args.open_port,
+                    h11_max_incomplete_event_size=args.h11_max_incomplete_event_size)
```

---

### Incident Patch 15: `b59fa82b` (2026-08-13)
**Commit Message**: fix(search): align Sciverse content return docs (#1277)

Co-authored-by: liyang16 <[REDACTED_EMAIL]>

**File**: `lazyllm/docs/tools/search.py` (modified, +2/-2)
```diff
@@ -775,7 +775,7 @@
     limit (int): 单次读取字符数，默认 700；仅 offset 非空时传给接口。
 
 Returns:
-    str: 原文文本、片段文本或空字符串。
+    Dict[str, Any]: 包含 title、url、snippet、source、extra 和 content；正文获取失败时 content 为空字符串。
 ''')
 
 add_english_doc('SciverseSearch.get_content', '''
@@ -789,7 +789,7 @@
     limit (int): Number of characters to read, default 700; sent only when offset is provided.
 
 Returns:
-    str: Full text, passage text, or an empty string.
+    Dict[str, Any]: title, url, snippet, source, extra, and content. content is empty on fetch failure.
 ''')
 
 add_chinese_doc('SciverseSearch.meta_search', '''
```

**File**: `lazyllm/tools/tools/search/google_books_search.py` (modified, +2/-2)
```diff
@@ -1,4 +1,4 @@
-from typing import List, Optional
+from typing import Any, Dict, List, Optional
 
 from lazyllm.common import QueryParamStrategy
 from lazyllm.thirdparty import httpx
@@ -17,7 +17,7 @@ def __init__(self, api_key: Optional[str] = None,
         self._timeout = timeout
         self._url = 'https://www.googleapis.com/books/v1/volumes'
 
-    def search(self, query: str, max_results: int = 10) -> List[dict]:
+    def search(self, query: str, max_results: int = 10) -> List[Dict[str, Any]]:
         params = self.inject_auth_params({'q': query, 'maxResults': min(max_results, 40)})
         resp = httpx.get(self._url, params=params, timeout=self._timeout)
         resp.raise_for_status()
```

**File**: `lazyllm/tools/tools/search/semantic_scholar_search.py` (modified, +1/-1)
```diff
@@ -35,7 +35,7 @@ def get_content(self, item: Dict[str, Any]) -> Dict[str, Any]:
         return _make_content_result(item, content)
 
     def search(self, query: str, limit: int = 10,
-               fields: Optional[str] = None) -> List[dict]:
+               fields: Optional[str] = None) -> List[Dict[str, Any]]:
         url = f'{self._base}/paper/search'
         params = {
             'query': query,
```

**File**: `lazyllm/tools/tools/search/stackoverflow_search.py` (modified, +1/-1)
```diff
@@ -55,7 +55,7 @@ def get_content(self, item: Dict[str, Any]) -> Dict[str, Any]:
         return _make_content_result(item, body)
 
     def search(self, query: str, count: int = 10,
-               sort: str = 'relevance') -> List[dict]:
+               sort: str = 'relevance') -> List[Dict[str, Any]]:
         url = 'https://api.stackexchange.com/2.3/search/advanced'
         params = self.inject_auth_params({
             'order': 'desc',
```

#### Recent Merged Pull Requests:
- **PR #1341** (2026-09-24): feat(agent): publish compact-safe skill tool contract (@voidchant)
- **PR #1340** (2026-09-24): opt(installer): Optimize Doubao image and video providers with direct HTTP requests (@CarlosShaoting)
- **PR #1339** (2026-09-24): feat(writer): improve workflow performance and Markdown fidelity (@Mustafa974)
- **PR #1337** (2026-09-24): feat: unify Feishu search, refresh tool groups and isolate thread state (@Yuang-Deng)
- **PR #1336** (closed): fix(rag): optimize document storage and parsing completion 全部放到lazymind中 (@CarlosShaoting)
- **PR #1335** (2026-09-21): feat(fs): 支持云文档读取资源限制与 Google Drive 分页 (@Mustafa974)
- **PR #1334** (2026-09-22): feat(agent): close Skill Retrieval runtime in SkillManager (@voidchant)
- **PR #1331** (closed): feat(skills): separate prompt catalog from loadable skills (@voidchant)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

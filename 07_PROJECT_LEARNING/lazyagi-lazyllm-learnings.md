# Forensic Learning Record (Deep Inspection): LazyAGI/LazyLLM

> **Canonical Artifact**: `07_PROJECT_LEARNING/lazyagi-lazyllm-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/LazyAGI/LazyLLM](https://github.com/LazyAGI/LazyLLM))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T21:02:01.533Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `LazyAGI/LazyLLM`
- **Description**: Easiest and laziest way for  building multi-agent LLMs applications.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 3888 stars

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

### Core Architecture Module: `csrc/binding/export_add_doc_str.cpp`
```
#include "lazyllm.hpp"
#include <iostream>

#ifdef _WIN32
#define strdup _strdup
#endif

namespace py = pybind11;

void addDocStr(py::object obj, std::string docs) {
    PyObject* ptr = obj.ptr();
    if (Py_TYPE(ptr) == &PyCFunction_Type) {
        auto f = reinterpret_cast<PyCFunctionObject*>(ptr);
        f->m_ml->ml_doc = strdup(docs.c_str());
    } else if (Py_TYPE(ptr) == &PyInstanceMethod_Type) {
        auto im = reinterpret_cast<PyInstanceMethodObject*>(ptr);
        if (Py_TYPE(im->func) == &PyCFunction_Type) {
            auto f = reinterpret_cast<PyCFunctionObject*>(im->func);
            f->m_ml->ml_doc = strdup(docs.c_str());
        }
    } else if (Py_TYPE(ptr) == &PyMethod_Type) {
        auto m = reinterpret_cast<PyMethodObject*>(ptr);
        if (Py_TYPE(m->im_func) == &PyCFunction_Type) {
            auto f = reinterpret_cast<PyCFunctionObject*>(m->im_func);
            f->m_ml->ml_doc = strdup(docs.c_str());
        } else if (Py_TYPE(m->im_func) == &PyFunction_Type) {
            auto f = reinterpret_cast<PyFunctionObject*>(m->im_func);
            f->func_doc = PyUnicode_FromString(strdup(docs.c_str()));
        }
    } else {
        std::cout << "Adding docstring failed with unexpected type:" << Py_TYPE(ptr)->tp_name << std::endl;
    }
}

void exportAddDocStr(py::module& m) {
    m.def("add_doc", &addDocStr, "Add docstring to a function or method", py::arg("obj"), py::arg("docs"));
}

```

### Core Architecture Module: `csrc/binding/export_doc_node.cpp`
```
#include <set>
#include <string>
#include <vector>

#include "binding_utils.hpp"
#include "doc_node.hpp"
#include "lazyllm.hpp"

#include <pybind11/stl_bind.h>

PYBIND11_MAKE_OPAQUE(lazyllm::DocNodeCore::Metadata);

namespace {

namespace pyu = lazyllm::pybind_utils;

py::dict MetadataToPyDict(const lazyllm::DocNodeCore::Metadata& self) {
    py::dict out;
    for (const auto& [k, v] : self) out[py::str(k)] = py::cast(v);
    return out;
}

struct PyDocNodeCore : lazyllm::DocNodeCore {
    using lazyllm::DocNodeCore::DocNodeCore;

    std::string get_metadata_string(lazyllm::MetadataMode mode) const override {
        PYBIND11_OVERRIDE(
            std::string,
            lazyllm::DocNodeCore,
            get_metadata_string,
            mode
        );
    }
};

lazyllm::DocNodeCore::Metadata MetadataFromPy(const py::object& obj) {
    lazyllm::DocNodeCore::Metadata out;
    if (obj.is_none() || !py::isinstance<py::dict>(obj)) return out;
    py::dict d = py::dict(obj);
    out.reserve(d.size());
    for (auto item : d) {
        const std::string key = py::cast<std::string>(item.first);
        out.emplace(key, pyu::PyToMetadataValue(item.second));
    }
    return out;
}

std::set<std::string> StringSetFromPy(const py::object& obj) {
    std::set<std::string> keys;
    if (obj.is_none()) return keys;
    for (auto item : obj) keys.insert(py::str(item).cast<std::string>());
    return keys;
}

lazyllm::MetadataMode ParseMode(const py::object& mode, lazyllm::MetadataMode default_mode) {
    if (mode.is_none()) return default_mode;
    return pyu::ParseMetadataMode(mode);
}

py::object CloneDocNodeCore(py::object self_obj) {
    auto self = self_obj.cast<std::shared_ptr<lazyllm::DocNodeCore>>();
    auto copy = std::make_shared<PyDocNodeCore>(
        self->_text, self->_metadata, self->_uid
    );
    copy->_excluded_embed_metadata_keys = self->_excluded_embed_metadata_keys;
    copy->_excluded_llm_metadata_keys = self->_excluded_llm_metadata_keys;
    py::object copy_obj = py::cast(copy);
    if (py::hasattr(self_obj, "__dict__")) {
        py::dict src_dict = self_obj.attr("__dict__");
        py::dict dst_dict = copy_obj.attr("__dict__");
        for (auto item : src_dict) {
            dst_dict[item.first] = item.second;
        }
    }
    if (py::hasattr(self_obj, "__class__")) {
        copy_obj.attr("__class__") = self_obj.attr("__class__");
    }
    return copy_obj;
}

} // namespace

void exportDocNode(py::module& m) {
    py::enum_<lazyllm::MetadataMode>(m, "MetadataMode")
        .value("ALL", lazyllm::MetadataMode::ALL)
        .value("EMBED", lazyllm::MetadataMode::EMBED)
        .value("LLM", lazyllm::MetadataMode::LLM)
        .value("NONE", lazyllm::MetadataMode::NONE);

    auto metadata_cls = py::bind_map<lazyllm::DocNodeCore::Metadata>(m, "MetadataMap");
    metadata_cls
        .def("get",
            [](const lazyllm::DocNodeCore::Metadata& self, const std::string& key, const py::object& default_value
            ) -> py::object {
                auto it = self.find(key);
                if (it == self.end()) return default_value;
                return py::cast(it->second);
            },
            py::arg("key"), py::arg("default") = py::none()
        )
        .def("pop",
            [](lazyllm::DocNodeCore::Metadata& self, const std::string& key) -> py::object {
                auto it = self.find(key);
                if (it == self.end()) throw py::key_error(key);
                py::object value = py::cast(it->second);
                self.erase(it);
                return value;
            },
            py::arg("key")
        )
        .def("pop",
            [](lazyllm::DocNodeCore::Metadata& self, const std::string& key, const py::object& default_value
            ) -> py::object {
                auto it = self.find(key);
                if (it == self.end()) return default_value;
                py::object value = py::cast(it->second);
                self.erase(it);
                return value;
            },
            py::arg("key"), py::arg("default")
        )
        .def("copy",
            [](const lazyllm::DocNodeCore::Metadata& self) {
                return MetadataToPyDict(self);
            }
        )
        .def("update",
            [](lazyllm::DocNodeCore::Metadata& self, const py::object& other) {
                py::dict d = py::dict(other);
                for (auto item : d) {
                    const std::string key = py::cast<std::string>(item.first);
                    self[key] = pyu::PyToMetadataValue(item.second);
                }
            },
            py::arg("other")
        )
        .def("__eq__",
            [](const lazyllm::DocNodeCore::Metadata& self, const py::object& other) -> py::object {
                const int cmp = PyObject_RichCompareBool(MetadataToPyDict(self).ptr(), other.ptr(), Py_EQ);
                if (cmp < 0) {
                    PyErr_Clear();
                    Py_INCREF(Py_NotImplemented);
                    return py::reinterpret_steal<py::object>(Py_NotImplemented);
                }
                return py::bool_(cmp == 1);
            },
            py::is_operator()
        )
        .def("__repr__",
            [](const lazyllm::DocNodeCore::Metadata& self) {
                return py::repr(MetadataToPyDict(self)).cast<std::string>();
            }
        )
        .def("__deepcopy__",
            [](const lazyllm::DocNodeCore::Metadata& self, const py::dict&) {
                return MetadataToPyDict(self);
            },
            py::arg("memo")
        );

    py::class_<lazyllm::DocNodeCore, PyDocNodeCore, std::shared_ptr<lazyllm::DocNodeCore>>(
        m, "DocNodeCore", py::dynamic_attr()
    )
        .def(py::init([](const py::object& text, const py::object& metadata, const py::object& uid) {
            return std::make_shared<PyDocNodeCore>(
                text.is_none() ? std::string() : py::str(text).cast<std::string>(),
                MetadataFromPy(metadata),
                uid.is_none() ? std::string() : py::cast<std::string>(uid)
            );
        }),
            py::arg("text") = py::none(),
            py::arg("metadata") = py::none(),
            py::arg("uid") = py::none()
        )
        .def_readwrite("_uid", &lazyllm::DocNodeCore::_uid)
        .def_readwrite("_text", &lazyllm::DocNodeCore::_text)
        .def_property_readonly("uid",
            [](const lazyllm::DocNodeCore& node) -> const std::string& {
                return node._uid;
            }
        )
        .def_property("_metadata",
            [](lazyllm::DocNodeCore& node) -> lazyllm::DocNodeCore::Metadata& {
                return node._metadata;
            },
            [](lazyllm::DocNodeCore& node, const py::object& metadata) {
                node._metadata = MetadataFromPy(metadata);
            },
            py::return_value_policy::reference_internal
        )
        .def_property("_excluded_embed_metadata_keys",
            [](const lazyllm::DocNodeCore& node) {
                return std::vector<std::string>(
                    node._excluded_embed_metadata_keys.begin(),
                    node._excluded_embed_metadata_keys.end()
                );
            },
            [](lazyllm::DocNodeCore& node, const py::object& keys_obj) {
                node._excluded_embed_metadata_keys = StringSetFromPy(keys_obj);
            }
        )
        .def_property("_excluded_llm_metadata_keys",
            [](const lazyllm::DocNodeCore& node) {
                return std::vector<std::string>(
                    node._excluded_llm_metadata_keys.begin(),
                    node._excluded_llm_metadata_keys.end()
                );
            },
            [](lazyllm::DocNodeCore& node, const py::object& keys_obj) {
                node._excluded_llm_metadata_keys = StringSetFromPy(keys_obj);
            }
        )
        .def("get_metadata_str", [](const lazyllm::DocNodeCore& node, const py::object& mode) {
         
```

### Core Architecture Module: `csrc/binding/export_sentence_splitter.cpp`
```
#include "lazyllm.hpp"

#include "sentence_splitter.hpp"

#include <string>
#include <vector>

#include <pybind11/pybind11.h>
#include <pybind11/gil.h>
#include <pybind11/stl.h>
#include <pybind11/pytypes.h>

namespace {

class SentenceSplitterCPPImpl : public lazyllm::SentenceSplitter {
public:
    // Validation of chunk_overlap < chunk_size is handled by the base class TextSplitterBase.
    SentenceSplitterCPPImpl(
        unsigned chunk_size,
        unsigned chunk_overlap,
        const std::string& encoding_name = "gpt2")
        : lazyllm::SentenceSplitter(chunk_size, chunk_overlap, encoding_name) {}

    std::vector<std::string> merge_chunks_impl(py::list splits, unsigned chunk_size) const {
        std::vector<lazyllm::Chunk> owned;
        owned.reserve(py::len(splits));
        for (auto item : splits) {
            py::object split = py::reinterpret_borrow<py::object>(item);
            owned.push_back(lazyllm::Chunk{
                split.attr("text").cast<std::string>(),
                split.attr("is_sentence").cast<bool>(),
                split.attr("token_size").cast<int>()
            });
        }

        std::vector<std::string> chunks;
        {
            py::gil_scoped_release release;
            chunks = lazyllm::SentenceSplitter::merge_chunks(owned, chunk_size);
        }
        return chunks;
    }

    py::list split_text_impl(const std::string& text, int metadata_size) const {
        std::vector<std::string> chunks;
        {
            py::gil_scoped_release release;
            chunks = lazyllm::SentenceSplitter::split_text(text, metadata_size);
        }

        py::list out;
        for (const auto& chunk : chunks) {
            out.append(py::str(chunk));
        }
        return out;
    }
};

} // namespace

void exportSentenceSplitter(py::module& m) {
    auto cls = py::class_<SentenceSplitterCPPImpl>(m, "SentenceSplitterCPPImpl", py::dynamic_attr())
        .def(py::init<unsigned, unsigned, const std::string&>(),
            py::arg("chunk_size") = 1024,
            py::arg("chunk_overlap") = 200,
            py::arg("encoding_name") = "gpt2"
        )
        .def_property("_chunk_size", &SentenceSplitterCPPImpl::chunk_size, &SentenceSplitterCPPImpl::set_chunk_size)
        .def_property("_overlap", &SentenceSplitterCPPImpl::overlap, &SentenceSplitterCPPImpl::set_overlap)
        .def("split_text", &SentenceSplitterCPPImpl::split_text_impl, py::arg("text"), py::arg("metadata_size"))
        .def("_merge", &SentenceSplitterCPPImpl::merge_chunks_impl, py::arg("splits"), py::arg("chunk_size"));

    (void)cls;
}

```

### Core Architecture Module: `csrc/binding/export_text_splitter_base.cpp`
```
#include "lazyllm.hpp"

#include "text_splitter_base.hpp"

#include <memory>
#include <string>
#include <vector>

#include <pybind11/pybind11.h>
#include <pybind11/gil.h>
#include <pybind11/stl.h>
#include <pybind11/pytypes.h>

namespace {

class TextSplitterBaseCPPImpl : public lazyllm::TextSplitterBase {
public:
    TextSplitterBaseCPPImpl(
        unsigned chunk_size,
        unsigned overlap,
        const std::string& encoding_name = "gpt2")
        : lazyllm::TextSplitterBase(chunk_size, overlap, encoding_name) {}

    py::list split_text_impl(const std::string& text, int metadata_size) const {
        std::vector<std::string> chunks;
        {
            py::gil_scoped_release release;
            chunks = lazyllm::TextSplitterBase::split_text(text, metadata_size);
        }

        py::list out;
        for (const auto& chunk : chunks) {
            out.append(py::str(chunk));
        }
        return out;
    }
};

} // namespace

void exportTextSplitterBase(py::module& m) {
    auto cls = py::class_<TextSplitterBaseCPPImpl>(m, "_TextSplitterBaseCPPImpl", py::dynamic_attr())
        .def(py::init<unsigned, unsigned, const std::string&>(),
            py::arg("chunk_size") = 1024,
            py::arg("overlap") = 200,
            py::arg("encoding_name") = "gpt2"
        )
        .def_property("_chunk_size", &TextSplitterBaseCPPImpl::chunk_size, &TextSplitterBaseCPPImpl::set_chunk_size)
        .def_property("_overlap", &TextSplitterBaseCPPImpl::overlap, &TextSplitterBaseCPPImpl::set_overlap)
        .def("split_text", &TextSplitterBaseCPPImpl::split_text_impl, py::arg("text"), py::arg("metadata_size") = 0);

    (void)cls;
}

```

### Core Architecture Module: `csrc/binding/lazyllm.cpp`
```
#include "lazyllm.hpp"

#include "doc_node.hpp"

namespace py = pybind11;

PYBIND11_MODULE(lazyllm_cpp, m) {
    m.doc() = "LazyLLM CPP Module.";
    exportAddDocStr(m);

    // Prevent document generation
    py::options options;
    options.disable_function_signatures();

    // Export classes
    exportDocNode(m);
    exportTextSplitterBase(m);
    exportSentenceSplitter(m);
}

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
+    assert result['value'].startswith('Invalid arguments: args: expected a JSON ar
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
+    item (Dict[str, Any]
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
+    def get_contents(self, items: List[Dict[str
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

Co-authored-by: 陈哲 <chenzhe1@60357067m.domain.sensetime.com>

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
       LAZYLLM_KIMI_API_KEY: ${{ secrets.LAZYLLM_KIMI_AP
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

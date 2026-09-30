# Forensic Learning Record (Deep Inspection): alibaba/zvec

> **Canonical Artifact**: `07_PROJECT_LEARNING/alibaba-zvec-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/alibaba/zvec](https://github.com/alibaba/zvec))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T14:00:49.996Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `alibaba/zvec`
- **Description**: A lightweight, lightning-fast, in-process vector database
- **Primary Language / Ecosystem**: C++
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 16030 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `examples/c/basic_example.c`
```
// Copyright 2025-present the zvec project
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "zvec/c_api.h"

/**
 * @brief Print error message and return error code
 */
static zvec_error_code_t handle_error(zvec_error_code_t error,
                                      const char *context) {
  if (error != ZVEC_OK) {
    char *error_msg = NULL;
    zvec_get_last_error(&error_msg);
    fprintf(stderr, "Error in %s: %d - %s\n", context, error,
            error_msg ? error_msg : "Unknown error");
    zvec_free(error_msg);
  }
  return error;
}

/**
 * @brief Create a simple test collection using CollectionSchema
 */
static zvec_error_code_t create_simple_test_collection(
    zvec_collection_t **collection) {
  // Create collection schema using C API
  zvec_collection_schema_t *schema =
      zvec_collection_schema_create("test_collection");
  if (!schema) {
    return ZVEC_ERROR_INTERNAL_ERROR;
  }

  zvec_error_code_t error = ZVEC_OK;

  // Create index parameters using new API
  zvec_index_params_t *invert_params =
      zvec_index_params_create(ZVEC_INDEX_TYPE_INVERT);
  if (!invert_params) {
    zvec_collection_schema_destroy(schema);
    return ZVEC_ERROR_RESOURCE_EXHAUSTED;
  }
  zvec_index_params_set_invert_params(invert_params, true, false);

  zvec_index_params_t *hnsw_params =
      zvec_index_params_create(ZVEC_INDEX_TYPE_HNSW);
  if (!hnsw_params) {
    zvec_index_params_destroy(invert_params);
    zvec_collection_schema_destroy(schema);
    return ZVEC_ERROR_RESOURCE_EXHAUSTED;
  }
  zvec_index_params_set_metric_type(hnsw_params, ZVEC_METRIC_TYPE_COSINE);
  zvec_index_params_set_hnsw_params(hnsw_params, 16, 200);

  // Create and add ID field (primary key)
  zvec_field_schema_t *id_field =
      zvec_field_schema_create("id", ZVEC_DATA_TYPE_STRING, false, 0);
  zvec_field_schema_set_index_params(id_field, invert_params);
  error = zvec_collection_schema_add_field(schema, id_field);
  if (error != ZVEC_OK) {
    zvec_index_params_destroy(invert_params);
    zvec_index_params_destroy(hnsw_params);
    zvec_collection_schema_destroy(schema);
    return error;
  }

  // Create text field (inverted index)
  zvec_field_schema_t *text_field =
      zvec_field_schema_create("text", ZVEC_DATA_TYPE_STRING, true, 0);
  zvec_field_schema_set_index_params(text_field, invert_params);
  error = zvec_collection_schema_add_field(schema, text_field);
  if (error != ZVEC_OK) {
    zvec_index_params_destroy(invert_params);
    zvec_index_params_destroy(hnsw_params);
    zvec_collection_schema_destroy(schema);
    return error;
  }

  // Create embedding field (HNSW index)
  zvec_field_schema_t *embedding_field = zvec_field_schema_create(
      "embedding", ZVEC_DATA_TYPE_VECTOR_FP32, false, 3);
  zvec_field_schema_set_index_params(embedding_field, hnsw_params);
  error = zvec_collection_schema_add_field(schema, embedding_field);
  if (error != ZVEC_OK) {
    zvec_index_params_destroy(invert_params);
    zvec_index_params_destroy(hnsw_params);
    zvec_collection_schema_destroy(schema);
    return error;
  }

  // Cleanup index parameters (they have been copied to the field schemas)
  zvec_index_params_destroy(invert_params);
  zvec_index_params_destroy(hnsw_params);

  // Use default options
  zvec_collection_options_t *options = zvec_collection_options_create();
  if (!options) {
    zvec_collection_schema_destroy(schema);
    return ZVEC_ERROR_RESOURCE_EXHAUSTED;
  }

  // Create collection using the new API
  error = zvec_collection_create_and_open("./test_collection", schema, options,
                                          collection);

  // Cleanup resources
  zvec_collection_options_destroy(options);
  zvec_collection_schema_destroy(schema);

  return error;
}

/**
 * @brief Basic C API usage example
 */
int main() {
  printf("=== ZVec C API Basic Example ===\n\n");

  zvec_error_code_t error;

  // Create collection using simplified function
  zvec_collection_t *collection = NULL;
  error = create_simple_test_collection(&collection);
  if (handle_error(error, "creating collection") != ZVEC_OK) {
    return 1;
  }
  printf("✓ Collection created successfully\n");

  // Prepare test data
  float vector1[] = {0.1f, 0.2f, 0.3f};
  float vector2[] = {0.4f, 0.5f, 0.6f};

  zvec_doc_t *docs[2];
  for (int i = 0; i < 2; ++i) {
    docs[i] = zvec_doc_create();
    if (!docs[i]) {
      fprintf(stderr, "Failed to create document %d\n", i);
      // Cleanup allocated resources
      for (int j = 0; j < i; ++j) {
        zvec_doc_destroy(docs[j]);
      }
      return ZVEC_ERROR_INTERNAL_ERROR;
    }
  }

  // Manually add fields to document 1
  zvec_doc_set_pk(docs[0], "doc1");
  zvec_doc_add_field_by_value(docs[0], "id", ZVEC_DATA_TYPE_STRING, "doc1",
                              strlen("doc1"));
  zvec_doc_add_field_by_value(docs[0], "text", ZVEC_DATA_TYPE_STRING,
                              "First document", strlen("First document"));
  zvec_doc_add_field_by_value(docs[0], "embedding", ZVEC_DATA_TYPE_VECTOR_FP32,
                              vector1, 3 * sizeof(float));

  // Manually add fields to document 2
  zvec_doc_set_pk(docs[1], "doc2");
  zvec_doc_add_field_by_value(docs[1], "id", ZVEC_DATA_TYPE_STRING, "doc2",
                              strlen("doc2"));
  zvec_doc_add_field_by_value(docs[1], "text", ZVEC_DATA_TYPE_STRING,
                              "Second document", strlen("Second document"));
  zvec_doc_add_field_by_value(docs[1], "embedding", ZVEC_DATA_TYPE_VECTOR_FP32,
                              vector2, 3 * sizeof(float));

  // Insert documents
  size_t success_count = 0;
  size_t error_count = 0;
  error = zvec_collection_insert(collection, (const zvec_doc_t **)docs, 2,
                                 &success_count, &error_count);
  if (handle_error(error, "inserting documents") != ZVEC_OK) {
    zvec_collection_destroy(collection);
    return 1;
  }
  printf("✓ Documents inserted - Success: %zu, Failed: %zu\n", success_count,
         error_count);
  for (int i = 0; i < 2; ++i) {
    zvec_doc_destroy(docs[i]);
  }

  // Flush collection
  error = zvec_collection_flush(collection);
  if (handle_error(error, "flushing collection") != ZVEC_OK) {
    printf("Collection flush failed\n");
  } else {
    printf("✓ Collection flushed successfully\n");
  }

  // Get collection statistics
  zvec_collection_stats_t *stats = NULL;
  error = zvec_collection_get_stats(collection, &stats);
  if (handle_error(error, "getting collection stats") == ZVEC_OK) {
    printf("✓ Collection stats - Document count: %llu\n",
           (unsigned long long)zvec_collection_stats_get_doc_count(stats));
    // Free statistics memory
    zvec_collection_stats_destroy(stats);
  }

  printf("Testing vector query...\n");
  // Query documents
  zvec_vector_query_t *query = zvec_vector_query_create();
  if (!query) {
    fprintf(stderr, "Failed to create vector query\n");
    zvec_collection_destroy(collection);
    return 1;
  }

  zvec_vector_query_set_field_name(query, "embedding");
  zvec_vector_query_set_query_vector(query, vector1, 3 * sizeof(float));
  zvec_vector_query_set_topk(query, 10);
  zvec_vector_query_set_filter(query, "");
  zvec_vector_query_set_include_vector(query, true);
  zvec_vector_query_set_include_doc_id(query, true);

  zvec_doc_t **results = NULL;
  size_t result_count = 0;
  error = zvec_collection_query(collection, (const zvec_vector_query_t *)query,
               
```

### Core Architecture Module: `examples/c/collection_schema_example.c`
```
// Copyright 2025-present the zvec project
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "zvec/c_api.h"

/**
 * @brief Print error message and return error code
 */
static zvec_error_code_t handle_error(zvec_error_code_t error,
                                      const char *context) {
  if (error != ZVEC_OK) {
    char *error_msg = NULL;
    zvec_get_last_error(&error_msg);
    fprintf(stderr, "Error in %s: %d - %s\n", context, error,
            error_msg ? error_msg : "Unknown error");
    zvec_free(error_msg);
  }
  return error;
}

/**
 * @brief Collection schema creation and management example
 */
int main() {
  printf("=== ZVec Collection Schema Example ===\n\n");

  zvec_error_code_t error;

  // 1. Create collection schema
  zvec_collection_schema_t *schema =
      zvec_collection_schema_create("schema_example_collection");
  if (!schema) {
    fprintf(stderr, "Failed to create collection schema\n");
    return 1;
  }
  printf("✓ Collection schema created successfully\n");

  // 2. Set schema properties
  zvec_collection_schema_set_max_doc_count_per_segment(schema, 1000000);
  printf("✓ Set max documents per segment: %llu\n",
         (unsigned long long)
             zvec_collection_schema_get_max_doc_count_per_segment(schema));

  // 3. Create index parameters
  zvec_index_params_t *invert_params =
      zvec_index_params_create(ZVEC_INDEX_TYPE_INVERT);
  if (!invert_params) {
    fprintf(stderr, "Failed to create invert index parameters\n");
    zvec_collection_schema_destroy(schema);
    return 1;
  }
  zvec_index_params_set_invert_params(invert_params, true, false);

  zvec_index_params_t *hnsw_params =
      zvec_index_params_create(ZVEC_INDEX_TYPE_HNSW);
  if (!hnsw_params) {
    fprintf(stderr, "Failed to create HNSW index parameters\n");
    zvec_index_params_destroy(invert_params);
    zvec_collection_schema_destroy(schema);
    return 1;
  }
  zvec_index_params_set_metric_type(hnsw_params, ZVEC_METRIC_TYPE_L2);
  zvec_index_params_set_hnsw_params(hnsw_params, 16, 200);

  // 4. Create and add ID field (primary key)
  zvec_field_schema_t *id_field =
      zvec_field_schema_create("id", ZVEC_DATA_TYPE_STRING, false, 0);
  if (!id_field) {
    fprintf(stderr, "Failed to create ID field\n");
    zvec_collection_schema_destroy(schema);
    return 1;
  }

  error = zvec_collection_schema_add_field(schema, id_field);
  if (handle_error(error, "adding ID field") != ZVEC_OK) {
    zvec_collection_schema_destroy(schema);
    return 1;
  }
  printf("✓ ID field added successfully\n");

  // 5. Create and add text field with inverted index
  zvec_field_schema_t *text_field =
      zvec_field_schema_create("content", ZVEC_DATA_TYPE_STRING, true, 0);
  if (!text_field) {
    fprintf(stderr, "Failed to create text field\n");
    zvec_collection_schema_destroy(schema);
    return 1;
  }

  zvec_field_schema_set_index_params(text_field, invert_params);
  error = zvec_collection_schema_add_field(schema, text_field);
  if (handle_error(error, "adding text field") != ZVEC_OK) {
    zvec_collection_schema_destroy(schema);
    return 1;
  }
  printf("✓ Text field with inverted index added successfully\n");

  // 6. Create and add vector field with HNSW index
  zvec_field_schema_t *vector_field = zvec_field_schema_create(
      "embedding", ZVEC_DATA_TYPE_VECTOR_FP32, false, 128);
  if (!vector_field) {
    fprintf(stderr, "Failed to create vector field\n");
    zvec_collection_schema_destroy(schema);
    return 1;
  }

  zvec_field_schema_set_index_params(vector_field, hnsw_params);
  error = zvec_collection_schema_add_field(schema, vector_field);
  if (handle_error(error, "adding vector field") != ZVEC_OK) {
    zvec_collection_schema_destroy(schema);
    return 1;
  }
  printf("✓ Vector field with HNSW index added successfully\n");

  // 7. Check field count
  // Note: This function may not exist in current API, commenting out for now
  // size_t field_count = zvec_collection_schema_get_field_count(schema);
  // printf("✓ Total field count: %zu\n", field_count);

  // 8. Create collection with schema
  zvec_collection_options_t *options = zvec_collection_options_create();
  if (!options) {
    fprintf(stderr, "Failed to create collection options\n");
    zvec_collection_schema_destroy(schema);
    return 1;
  }
  zvec_collection_t *collection = NULL;

  error = zvec_collection_create_and_open("./schema_example_collection", schema,
                                          options, &collection);
  if (handle_error(error, "creating collection with schema") != ZVEC_OK) {
    zvec_collection_options_destroy(options);
    zvec_collection_schema_destroy(schema);
    return 1;
  }
  zvec_collection_options_destroy(options);
  printf("✓ Collection created successfully with schema\n");

  // 9. Prepare test data
  float vector1[128];
  float vector2[128];
  for (int i = 0; i < 128; i++) {
    vector1[i] = (float)(i + 1) / 128.0f;
    vector2[i] = (float)(i + 2) / 128.0f;
  }

  // 10. Create documents
  zvec_doc_t *docs[2];
  for (int i = 0; i < 2; i++) {
    docs[i] = zvec_doc_create();
    if (!docs[i]) {
      fprintf(stderr, "Failed to create document %d\n", i);
      // Cleanup
      for (int j = 0; j < i; j++) {
        zvec_doc_destroy(docs[j]);
      }
      zvec_collection_destroy(collection);
      zvec_collection_schema_destroy(schema);
      return 1;
    }
  }

  // Add fields to document 1
  zvec_doc_set_pk(docs[0], "doc1");
  zvec_doc_add_field_by_value(docs[0], "id", ZVEC_DATA_TYPE_STRING, "doc1",
                              strlen("doc1"));
  zvec_doc_add_field_by_value(docs[0], "content", ZVEC_DATA_TYPE_STRING,
                              "First test document",
                              strlen("First test document"));
  zvec_doc_add_field_by_value(docs[0], "embedding", ZVEC_DATA_TYPE_VECTOR_FP32,
                              vector1, 128 * sizeof(float));

  // Add fields to document 2
  zvec_doc_set_pk(docs[1], "doc2");
  zvec_doc_add_field_by_value(docs[1], "id", ZVEC_DATA_TYPE_STRING, "doc2",
                              strlen("doc2"));
  zvec_doc_add_field_by_value(docs[1], "content", ZVEC_DATA_TYPE_STRING,
                              "Second test document",
                              strlen("Second test document"));
  zvec_doc_add_field_by_value(docs[1], "embedding", ZVEC_DATA_TYPE_VECTOR_FP32,
                              vector2, 128 * sizeof(float));

  // 11. Insert documents
  size_t success_count = 0, error_count = 0;
  error = zvec_collection_insert(collection, (const zvec_doc_t **)docs, 2,
                                 &success_count, &error_count);
  if (handle_error(error, "inserting documents") != ZVEC_OK) {
    // Cleanup
    for (int i = 0; i < 2; i++) {
      zvec_doc_destroy(docs[i]);
    }
    zvec_collection_destroy(collection);
    zvec_collection_schema_destroy(schema);
    return 1;
  }
  printf("✓ Documents inserted - Success: %zu, Failed: %zu\n", success_count,
         error_count);

  // Cleanup documents
  for (int i = 0; i < 2; i++) {
    zvec_doc_destroy(docs[i]);
  }

  // 12. Flush collection
  error = zvec_collection_flush(collection);
  if (handle_error(error, "flushing collection") == ZVEC_OK) {
    printf("✓ Collection flushed successfully\n");
  }

  // 13. Query test
  zvec_vector_query_t *query = zvec_vector_query_create();
  if (!query) {
    fprintf(stderr, "Failed to create vector query\n");
    zvec_colle
```

### Core Architecture Module: `examples/c/diskann_example.c`
```
// Copyright 2025-present the zvec project
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * @file diskann_example.c
 * @brief End-to-end example demonstrating DiskANN index usage via the C API.
 *
 * DiskANN is a disk-based approximate nearest neighbor search algorithm
 * optimized for large-scale datasets that exceed available memory. It uses
 * a Vamana graph structure combined with product quantization (PQ) to
 * achieve high recall with efficient disk I/O.
 *
 * NOTE: DiskANN is available on Linux x86_64/ARM64 and macOS ARM64, and on
 * Android and iOS through the portable synchronous pread backend.
 *
 * Workflow demonstrated:
 *   1. Create collection schema with DiskANN-indexed vector field
 *   2. Insert documents with high-dimensional vectors
 *   3. Flush collection (triggers PQ training + graph build)
 *   4. Search using DiskANN query parameters (list_size controls recall)
 *   5. Clean up all resources
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "zvec/c_api.h"

/* --------------------------------------------------------------------------
 * Helpers
 * -------------------------------------------------------------------------- */

static zvec_error_code_t handle_error(zvec_error_code_t error,
                                      const char *context) {
  if (error != ZVEC_OK) {
    char *error_msg = NULL;
    zvec_get_last_error(&error_msg);
    fprintf(stderr, "Error in %s: %d - %s\n", context, error,
            error_msg ? error_msg : "Unknown error");
    zvec_free(error_msg);
  }
  return error;
}

#define VECTOR_DIM 64
#define NUM_DOCS 100
#define COLLECTION_DIR "./diskann_example_collection"

/* --------------------------------------------------------------------------
 * Main
 * -------------------------------------------------------------------------- */

int main(void) {
  printf("=== ZVec DiskANN Index Example ===\n\n");
  printf("DiskANN I/O backend: %s\n\n", zvec_get_io_backend_description());

  zvec_error_code_t error;
  int i;

  /* ------------------------------------------------------------------
   * Step 1: Create collection schema
   * ------------------------------------------------------------------ */
  printf("[Step 1] Creating collection schema...\n");

  zvec_collection_schema_t *schema =
      zvec_collection_schema_create("diskann_example");
  if (!schema) {
    fprintf(stderr, "Failed to create schema\n");
    return 1;
  }

  /* Index params — declared up-front and NULL-initialized so the
   * cleanup_schema path never touches an uninitialized pointer even if an
   * early field addition fails. */
  zvec_index_params_t *invert_params = NULL;
  zvec_index_params_t *diskann_params = NULL;

  /* Scalar field with inverted index (for primary key / filtering) */
  invert_params = zvec_index_params_create(ZVEC_INDEX_TYPE_INVERT);
  zvec_index_params_set_invert_params(invert_params, true, false);

  zvec_field_schema_t *id_field =
      zvec_field_schema_create("id", ZVEC_DATA_TYPE_STRING, false, 0);
  zvec_field_schema_set_index_params(id_field, invert_params);
  error = zvec_collection_schema_add_field(schema, id_field);
  if (handle_error(error, "adding id field") != ZVEC_OK) {
    goto cleanup_schema;
  }
  printf("  + id field (STRING, inverted index)\n");

  /* Vector field with DiskANN index */
  diskann_params = zvec_index_params_create(ZVEC_INDEX_TYPE_DISKANN);
  if (!diskann_params) {
    fprintf(stderr, "Failed to create DiskANN index parameters\n");
    goto cleanup_schema;
  }
  zvec_index_params_set_metric_type(diskann_params, ZVEC_METRIC_TYPE_L2);
  zvec_index_params_set_diskann_params(
      diskann_params, 64, /* max_degree: graph connectivity */
      100,                /* list_size: build-time candidates */
      8);                 /* pq_chunk_num: PQ chunks (0=auto) */

  printf(
      "  DiskANN index params: max_degree=%d, list_size=%d, pq_chunk_num=%d\n",
      zvec_index_params_get_diskann_max_degree(diskann_params),
      zvec_index_params_get_diskann_list_size(diskann_params),
      zvec_index_params_get_diskann_pq_chunk_num(diskann_params));

  zvec_field_schema_t *embedding_field = zvec_field_schema_create(
      "embedding", ZVEC_DATA_TYPE_VECTOR_FP32, false, VECTOR_DIM);
  zvec_field_schema_set_index_params(embedding_field, diskann_params);
  error = zvec_collection_schema_add_field(schema, embedding_field);
  if (handle_error(error, "adding embedding field") != ZVEC_OK) {
    goto cleanup_schema;
  }
  printf("  + embedding field (VECTOR_FP32, %dD, DiskANN index)\n", VECTOR_DIM);

  /* Index params are copied into field schemas; safe to destroy now */
  zvec_index_params_destroy(invert_params);
  zvec_index_params_destroy(diskann_params);
  invert_params = NULL;
  diskann_params = NULL;

  /* ------------------------------------------------------------------
   * Step 2: Create and open collection
   * ------------------------------------------------------------------ */
  printf("\n[Step 2] Creating collection...\n");

  zvec_collection_options_t *options = zvec_collection_options_create();
  zvec_collection_t *collection = NULL;
  error = zvec_collection_create_and_open(COLLECTION_DIR, schema, options,
                                          &collection);
  zvec_collection_options_destroy(options);
  if (handle_error(error, "creating collection") != ZVEC_OK) {
    goto cleanup_schema;
  }
  printf("  Collection created at %s\n", COLLECTION_DIR);

  /* ------------------------------------------------------------------
   * Step 3: Generate and insert documents
   * ------------------------------------------------------------------ */
  printf("\n[Step 3] Inserting %d documents with %dD vectors...\n", NUM_DOCS,
         VECTOR_DIM);

  /* Allocate vector storage */
  float(*vectors)[VECTOR_DIM] =
      (float(*)[VECTOR_DIM])malloc(NUM_DOCS * VECTOR_DIM * sizeof(float));
  if (!vectors) {
    fprintf(stderr, "Failed to allocate vector storage\n");
    goto cleanup_collection;
  }

  /* Generate deterministic vector data */
  for (i = 0; i < NUM_DOCS; i++) {
    for (int d = 0; d < VECTOR_DIM; d++) {
      vectors[i][d] = (float)((i * VECTOR_DIM + d) % 1000) / 1000.0f;
    }
  }

  /* Insert in batches */
  int batch_size = 20;
  size_t total_success = 0, total_error = 0;

  for (int batch_start = 0; batch_start < NUM_DOCS; batch_start += batch_size) {
    int count = batch_start + batch_size > NUM_DOCS ? NUM_DOCS - batch_start
                                                    : batch_size;

    zvec_doc_t **docs =
        (zvec_doc_t **)malloc((size_t)count * sizeof(zvec_doc_t *));
    for (i = 0; i < count; i++) {
      int idx = batch_start + i;
      docs[i] = zvec_doc_create();

      char pk[32];
      snprintf(pk, sizeof(pk), "doc_%04d", idx);
      zvec_doc_set_pk(docs[i], pk);

      zvec_doc_add_field_by_value(docs[i], "id", ZVEC_DATA_TYPE_STRING, pk,
                                  strlen(pk));
      zvec_doc_add_field_by_value(docs[i], "embedding",
                                  ZVEC_DATA_TYPE_VECTOR_FP32, vectors[idx],
                                  VECTOR_DIM * sizeof(float));
    }

    size_t success_count = 0, error_count = 0;
    error = zvec_collection_insert(collection, (const zvec_doc_t **)docs,
                                   (size_t)count, &success_count, &error_count);
    if (error != ZVEC_OK) {
      handle_error(error, "inserting batch");
    }
    total_success += success_count;
    total_error += error_co
```

### Core Architecture Module: `examples/c/doc_example.c`
```
// Copyright 2025-present the zvec project
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

#include <math.h>
#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "zvec/c_api.h"

/**
 * @brief Print error message and return error code
 */
static zvec_error_code_t handle_error(zvec_error_code_t error,
                                      const char *context) {
  if (error != ZVEC_OK) {
    char *error_msg = NULL;
    zvec_get_last_error(&error_msg);
    fprintf(stderr, "Error in %s: %d - %s\n", context, error,
            error_msg ? error_msg : "Unknown error");
    zvec_free(error_msg);
  }
  return error;
}

/**
 * @brief Create a test document with all data types
 * @param doc_index Document index for generating unique data
 * @return zvec_doc_t* Created document pointer
 */
static zvec_doc_t *create_full_type_test_doc(int doc_index) {
  zvec_doc_t *doc = zvec_doc_create();
  if (!doc) {
    fprintf(stderr, "Failed to create document\n");
    return NULL;
  }

  // Set primary key
  char pk_buffer[32];
  snprintf(pk_buffer, sizeof(pk_buffer), "doc_%d", doc_index);
  zvec_doc_set_pk(doc, pk_buffer);

  // Add Id field with inverted index
  char id_buffer[32];
  snprintf(id_buffer, sizeof(id_buffer), "id_%d", doc_index);
  zvec_doc_add_field_by_value(doc, "id", ZVEC_DATA_TYPE_STRING, id_buffer,
                              strlen(id_buffer));

  // Add scalar fields with different data types
  // String field
  char string_value[64];
  snprintf(string_value, sizeof(string_value), "test_string_%d", doc_index);
  zvec_doc_add_field_by_value(doc, "string_field", ZVEC_DATA_TYPE_STRING,
                              string_value, strlen(string_value));

  // Boolean field
  bool bool_value = (doc_index % 2 == 0);
  zvec_doc_add_field_by_value(doc, "bool_field", ZVEC_DATA_TYPE_BOOL,
                              &bool_value, sizeof(bool_value));

  // Integer fields
  int32_t int32_value = doc_index * 1000;
  zvec_doc_add_field_by_value(doc, "int32_field", ZVEC_DATA_TYPE_INT32,
                              &int32_value, sizeof(int32_value));

  int64_t int64_value = (int64_t)doc_index * 1000000LL;
  zvec_doc_add_field_by_value(doc, "int64_field", ZVEC_DATA_TYPE_INT64,
                              &int64_value, sizeof(int64_value));

  // Floating point fields
  float float_value = (float)doc_index * 1.5f;
  zvec_doc_add_field_by_value(doc, "float_field", ZVEC_DATA_TYPE_FLOAT,
                              &float_value, sizeof(float_value));

  double double_value = (double)doc_index * 2.718281828;
  zvec_doc_add_field_by_value(doc, "double_field", ZVEC_DATA_TYPE_DOUBLE,
                              &double_value, sizeof(double_value));

  // Vector fields with different dimensions
  // FP32 vector (3D)
  float fp32_vector[3] = {(float)doc_index, (float)doc_index * 2.0f,
                          (float)doc_index * 3.0f};
  zvec_doc_add_field_by_value(doc, "vector_fp32", ZVEC_DATA_TYPE_VECTOR_FP32,
                              fp32_vector, 3 * sizeof(float));

  // Larger FP32 vector (16D)
  float large_vector[16];
  for (int i = 0; i < 16; i++) {
    large_vector[i] = (float)(doc_index * 16 + i) / 256.0f;
  }
  zvec_doc_add_field_by_value(doc, "large_vector", ZVEC_DATA_TYPE_VECTOR_FP32,
                              large_vector, 16 * sizeof(float));

  return doc;
}

/**
 * @brief Compare two documents for equality
 */
static bool compare_documents(const zvec_doc_t *doc1, const zvec_doc_t *doc2) {
  if (!doc1 || !doc2) return false;

  // Compare primary keys
  const char *pk1 = zvec_doc_get_pk_pointer(doc1);
  const char *pk2 = zvec_doc_get_pk_pointer(doc2);

  if (!pk1 || !pk2 || strcmp(pk1, pk2) != 0) {
    return false;
  }

  // TODO: Compare other fields and values

  return true;
}

/**
 * @brief Print document fields and their values
 * @param doc The document to print
 * @param doc_index Document index for identification
 */
static void print_doc(const zvec_doc_t *doc, int doc_index) {
  if (!doc) {
    printf("Document %d: NULL document\n", doc_index);
    return;
  }

  printf("\n=== Document %d ===\n", doc_index);

  // Print primary key
  const char *pk = zvec_doc_get_pk_pointer(doc);
  printf("Primary Key: %s\n", pk ? pk : "NULL");

  // Print document ID
  uint64_t doc_id = zvec_doc_get_doc_id(doc);
  printf("Document ID: %llu\n", (unsigned long long)doc_id);

  // Print score
  float score = zvec_doc_get_score(doc);
  printf("Score: %.6f\n", score);

  // Print scalar fields
  printf("\nScalar Fields:\n");

  // ID field (using pointer function for strings)
  const void *id_value = NULL;
  size_t id_size = 0;
  zvec_error_code_t error = zvec_doc_get_field_value_pointer(
      doc, "id", ZVEC_DATA_TYPE_STRING, &id_value, &id_size);
  if (error == ZVEC_OK && id_value) {
    printf("  id: %.*s\n", (int)id_size, (const char *)id_value);
  }

  // String field (using pointer function for strings)
  const void *string_value = NULL;
  size_t string_size = 0;
  error = zvec_doc_get_field_value_pointer(
      doc, "string_field", ZVEC_DATA_TYPE_STRING, &string_value, &string_size);
  if (error == ZVEC_OK && string_value) {
    printf("  string_field: %.*s\n", (int)string_size,
           (const char *)string_value);
  }

  // Boolean field
  bool bool_value;
  error = zvec_doc_get_field_value_basic(doc, "bool_field", ZVEC_DATA_TYPE_BOOL,
                                         &bool_value, sizeof(bool_value));
  if (error == ZVEC_OK) {
    printf("  bool_field: %s\n", bool_value ? "true" : "false");
  }

  // Int32 field
  int32_t int32_value;
  error =
      zvec_doc_get_field_value_basic(doc, "int32_field", ZVEC_DATA_TYPE_INT32,
                                     &int32_value, sizeof(int32_value));
  if (error == ZVEC_OK) {
    printf("  int32_field: %d\n", int32_value);
  }

  // Int64 field
  int64_t int64_value;
  error =
      zvec_doc_get_field_value_basic(doc, "int64_field", ZVEC_DATA_TYPE_INT64,
                                     &int64_value, sizeof(int64_value));
  if (error == ZVEC_OK) {
    printf("  int64_field: %lld\n", (long long)int64_value);
  }

  // Float field
  float float_value;
  error =
      zvec_doc_get_field_value_basic(doc, "float_field", ZVEC_DATA_TYPE_FLOAT,
                                     &float_value, sizeof(float_value));
  if (error == ZVEC_OK) {
    printf("  float_field: %.6f\n", float_value);
  }

  // Double field
  double double_value;
  error =
      zvec_doc_get_field_value_basic(doc, "double_field", ZVEC_DATA_TYPE_DOUBLE,
                                     &double_value, sizeof(double_value));
  if (error == ZVEC_OK) {
    printf("  double_field: %.6f\n", double_value);
  }

  // Print vector fields (using copy function for complex types)
  printf("\nVector Fields:\n");

  // FP32 vector (3D)
  void *fp32_vector = NULL;
  size_t fp32_size = 0;
  error = zvec_doc_get_field_value_copy(
      doc, "vector_fp32", ZVEC_DATA_TYPE_VECTOR_FP32, &fp32_vector, &fp32_size);
  if (error == ZVEC_OK && fp32_vector) {
    const float *vec = (const float *)fp32_vector;
    size_t dim = fp32_size / sizeof(float);
    printf("  vector_fp32 (%zuD): [", dim);
    for (size_t i = 0; i < dim && i < 10; i++) {  // Limit to first 10 elements
      printf("%.3f", vec[i]);
      if (i < dim - 1 && i < 9) printf(", ");
    }
    if (dim > 10) printf(", ...");
    printf("]\n");
    zvec_free(fp32_vector);  // Free the allocated memory
  }

  // Large vector (16D)
  void *large
```

### Core Architecture Module: `examples/c/field_schema_example.c`
```
// Copyright 2025-present the zvec project
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "zvec/c_api.h"

/**
 * @brief Print error message and return error code
 */
static zvec_error_code_t handle_error(zvec_error_code_t error,
                                      const char *context) {
  if (error != ZVEC_OK) {
    char *error_msg = NULL;
    zvec_get_last_error(&error_msg);
    fprintf(stderr, "Error in %s: %d - %s\n", context, error,
            error_msg ? error_msg : "Unknown error");
    zvec_free(error_msg);
  }
  return error;
}

/**
 * @brief Field schema creation and management example
 */
int main() {
  printf("=== ZVec Field Schema Example ===\n\n");

  zvec_error_code_t error;

  // 1. Create collection schema
  zvec_collection_schema_t *schema =
      zvec_collection_schema_create("field_example_collection");
  if (!schema) {
    fprintf(stderr, "Failed to create collection schema\n");
    return -1;
  }
  printf("✓ Collection schema created successfully\n");

  // 2. Create different types of index parameters
  zvec_index_params_t *invert_params =
      zvec_index_params_create(ZVEC_INDEX_TYPE_INVERT);
  if (!invert_params) {
    fprintf(stderr, "Failed to create invert index parameters\n");
    zvec_collection_schema_destroy(schema);
    return -1;
  }
  zvec_index_params_set_invert_params(invert_params, true, false);

  zvec_index_params_t *hnsw_params =
      zvec_index_params_create(ZVEC_INDEX_TYPE_HNSW);
  if (!hnsw_params) {
    fprintf(stderr, "Failed to create HNSW index parameters\n");
    zvec_index_params_destroy(invert_params);
    zvec_collection_schema_destroy(schema);
    return -1;
  }
  zvec_index_params_set_metric_type(hnsw_params, ZVEC_METRIC_TYPE_COSINE);
  zvec_index_params_set_hnsw_params(hnsw_params, 16, 200);

  zvec_index_params_t *flat_params =
      zvec_index_params_create(ZVEC_INDEX_TYPE_FLAT);
  if (!flat_params) {
    fprintf(stderr, "Failed to create Flat index parameters\n");
    zvec_index_params_destroy(invert_params);
    zvec_index_params_destroy(hnsw_params);
    zvec_collection_schema_destroy(schema);
    return -1;
  }
  zvec_index_params_set_metric_type(flat_params, ZVEC_METRIC_TYPE_L2);

  if (!invert_params || !hnsw_params || !flat_params) {
    fprintf(stderr, "Failed to create index parameters\n");
    zvec_index_params_destroy(invert_params);
    zvec_index_params_destroy(hnsw_params);
    zvec_index_params_destroy(flat_params);
    zvec_collection_schema_destroy(schema);
    return -1;
  }

  // 3. Create scalar fields with different data types
  printf("Creating scalar fields...\n");

  // String field with inverted index
  zvec_field_schema_t *name_field =
      zvec_field_schema_create("name", ZVEC_DATA_TYPE_STRING, false, 0);
  if (name_field) {
    zvec_field_schema_set_index_params(name_field, invert_params);
    error = zvec_collection_schema_add_field(schema, name_field);
    if (handle_error(error, "adding name field") == ZVEC_OK) {
      printf("✓ String field 'name' with inverted index added\n");
    }
  }

  // Integer field
  zvec_field_schema_t *age_field =
      zvec_field_schema_create("age", ZVEC_DATA_TYPE_INT32, true, 0);
  if (age_field) {
    error = zvec_collection_schema_add_field(schema, age_field);
    if (handle_error(error, "adding age field") == ZVEC_OK) {
      printf("✓ Integer field 'age' added\n");
    }
  }

  // Float field
  zvec_field_schema_t *score_field =
      zvec_field_schema_create("score", ZVEC_DATA_TYPE_FLOAT, true, 0);
  if (score_field) {
    error = zvec_collection_schema_add_field(schema, score_field);
    if (handle_error(error, "adding score field") == ZVEC_OK) {
      printf("✓ Float field 'score' added\n");
    }
  }

  // Boolean field
  zvec_field_schema_t *active_field =
      zvec_field_schema_create("active", ZVEC_DATA_TYPE_BOOL, false, 0);
  if (active_field) {
    error = zvec_collection_schema_add_field(schema, active_field);
    if (handle_error(error, "adding active field") == ZVEC_OK) {
      printf("✓ Boolean field 'active' added\n");
    }
  }

  // 4. Create vector fields with different dimensions and indexes
  printf("Creating vector fields...\n");

  // Small dimension vector with HNSW index
  zvec_field_schema_t *small_vector_field = zvec_field_schema_create(
      "small_vector", ZVEC_DATA_TYPE_VECTOR_FP32, false, 32);
  if (small_vector_field) {
    zvec_field_schema_set_index_params(small_vector_field, hnsw_params);
    error = zvec_collection_schema_add_field(schema, small_vector_field);
    if (handle_error(error, "adding small vector field") == ZVEC_OK) {
      printf(
          "✓ Small vector field 'small_vector' (32D) with HNSW index added\n");
    }
  }

  // Medium dimension vector with Flat index
  zvec_field_schema_t *medium_vector_field = zvec_field_schema_create(
      "medium_vector", ZVEC_DATA_TYPE_VECTOR_FP32, false, 128);
  if (medium_vector_field) {
    zvec_field_schema_set_index_params(medium_vector_field, flat_params);
    error = zvec_collection_schema_add_field(schema, medium_vector_field);
    if (handle_error(error, "adding medium vector field") == ZVEC_OK) {
      printf(
          "✓ Medium vector field 'medium_vector' (128D) with Flat index "
          "added\n");
    }
  }

  // Large dimension vector with HNSW index
  zvec_field_schema_t *large_vector_field = zvec_field_schema_create(
      "large_vector", ZVEC_DATA_TYPE_VECTOR_FP32, false, 512);
  if (large_vector_field) {
    zvec_field_schema_set_index_params(large_vector_field, hnsw_params);
    error = zvec_collection_schema_add_field(schema, large_vector_field);
    if (handle_error(error, "adding large vector field") == ZVEC_OK) {
      printf(
          "✓ Large vector field 'large_vector' (512D) with HNSW index added\n");
    }
  }

  // 5. Create collection with the schema
  zvec_collection_options_t *options = zvec_collection_options_create();
  if (!options) {
    fprintf(stderr, "Failed to create collection options\n");
    zvec_collection_schema_destroy(schema);
    return -1;
  }
  zvec_collection_t *collection = NULL;

  error = zvec_collection_create_and_open("./field_example_collection", schema,
                                          options, &collection);
  zvec_collection_options_destroy(options);
  if (handle_error(error, "creating collection") != ZVEC_OK) {
    zvec_collection_schema_destroy(schema);
    return -1;
  }
  printf("✓ Collection created successfully\n");

  // 6. Create test documents with various field types
  printf("Creating test documents...\n");

  zvec_doc_t *doc1 = zvec_doc_create();
  zvec_doc_t *doc2 = zvec_doc_create();

  if (!doc1 || !doc2) {
    fprintf(stderr, "Failed to create documents\n");
    goto cleanup;
  }

  // Document 1
  zvec_doc_set_pk(doc1, "user1");
  zvec_doc_add_field_by_value(doc1, "name", ZVEC_DATA_TYPE_STRING,
                              "Alice Johnson", strlen("Alice Johnson"));
  int32_t age1 = 28;
  zvec_doc_add_field_by_value(doc1, "age", ZVEC_DATA_TYPE_INT32, &age1,
                              sizeof(age1));
  float score1 = 87.5f;
  zvec_doc_add_field_by_value(doc1, "score", ZVEC_DATA_TYPE_FLOAT, &score1,
                              sizeof(score1));
  bool active1 = true;
  zvec_doc_add_field_by_value(doc1, "active", ZVEC_DATA_TYPE_BOOL, &active1,
                              sizeof(active1));

  // Add vector data
  float small_vec1[32];
  float medium_vec1[128];
  float large_vec1[5
```

### Core Architecture Module: `examples/c/index_example.c`
```
// Copyright 2025-present the zvec project
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "zvec/c_api.h"

/**
 * @brief Print error message and return error code
 */
static zvec_error_code_t handle_error(zvec_error_code_t error,
                                      const char *context) {
  if (error != ZVEC_OK) {
    char *error_msg = NULL;
    zvec_get_last_error(&error_msg);
    fprintf(stderr, "Error in %s: %d - %s\n", context, error,
            error_msg ? error_msg : "Unknown error");
    zvec_free(error_msg);
  }
  return error;
}

/**
 * @brief Index creation and management example
 */
int main() {
  printf("=== ZVec Index Example ===\n\n");

  zvec_error_code_t error;

  // 1. Create collection schema
  zvec_collection_schema_t *schema =
      zvec_collection_schema_create("index_example_collection");
  if (!schema) {
    fprintf(stderr, "Failed to create collection schema\n");
    return -1;
  }
  printf("✓ Collection schema created successfully\n");

  // 2. Create different index parameter configurations
  printf("Creating index parameters...\n");

  // Inverted index parameters
  zvec_index_params_t *invert_params_standard =
      zvec_index_params_create(ZVEC_INDEX_TYPE_INVERT);
  if (!invert_params_standard) {
    fprintf(stderr, "Failed to create invert index parameters (standard)\n");
    zvec_collection_schema_destroy(schema);
    return -1;
  }
  zvec_index_params_set_invert_params(invert_params_standard, true, false);

  zvec_index_params_t *invert_params_extended =
      zvec_index_params_create(ZVEC_INDEX_TYPE_INVERT);
  if (!invert_params_extended) {
    fprintf(stderr, "Failed to create invert index parameters (extended)\n");
    zvec_index_params_destroy(invert_params_standard);
    zvec_collection_schema_destroy(schema);
    return -1;
  }
  zvec_index_params_set_invert_params(invert_params_extended, true, true);

  // HNSW index parameters with different configurations
  zvec_index_params_t *hnsw_params_fast =
      zvec_index_params_create(ZVEC_INDEX_TYPE_HNSW);
  if (!hnsw_params_fast) {
    fprintf(stderr, "Failed to create HNSW index parameters (fast)\n");
    zvec_index_params_destroy(invert_params_standard);
    zvec_index_params_destroy(invert_params_extended);
    zvec_collection_schema_destroy(schema);
    return -1;
  }
  zvec_index_params_set_metric_type(hnsw_params_fast, ZVEC_METRIC_TYPE_L2);
  zvec_index_params_set_hnsw_params(hnsw_params_fast, 16, 100);

  // Demonstrate INT8 quantization with random rotation preprocessing
  // (enable_rotate rotates vectors before INT8 quantization to reduce error)
  zvec_index_params_set_quantize_type(hnsw_params_fast,
                                      ZVEC_QUANTIZE_TYPE_INT8);
  zvec_index_params_set_quantizer_enable_rotate(hnsw_params_fast, true);

  zvec_index_params_t *hnsw_params_balanced =
      zvec_index_params_create(ZVEC_INDEX_TYPE_HNSW);
  if (!hnsw_params_balanced) {
    fprintf(stderr, "Failed to create HNSW index parameters (balanced)\n");
    zvec_index_params_destroy(invert_params_standard);
    zvec_index_params_destroy(invert_params_extended);
    zvec_index_params_destroy(hnsw_params_fast);
    zvec_collection_schema_destroy(schema);
    return -1;
  }
  zvec_index_params_set_metric_type(hnsw_params_balanced,
                                    ZVEC_METRIC_TYPE_COSINE);
  zvec_index_params_set_hnsw_params(hnsw_params_balanced, 32, 200);

  zvec_index_params_t *hnsw_params_accurate =
      zvec_index_params_create(ZVEC_INDEX_TYPE_HNSW);
  if (!hnsw_params_accurate) {
    fprintf(stderr, "Failed to create HNSW index parameters (accurate)\n");
    zvec_index_params_destroy(invert_params_standard);
    zvec_index_params_destroy(invert_params_extended);
    zvec_index_params_destroy(hnsw_params_fast);
    zvec_index_params_destroy(hnsw_params_balanced);
    zvec_collection_schema_destroy(schema);
    return -1;
  }
  zvec_index_params_set_metric_type(hnsw_params_accurate, ZVEC_METRIC_TYPE_IP);
  zvec_index_params_set_hnsw_params(hnsw_params_accurate, 64, 400);

  // Flat index parameters
  zvec_index_params_t *flat_params_l2 =
      zvec_index_params_create(ZVEC_INDEX_TYPE_FLAT);
  if (!flat_params_l2) {
    fprintf(stderr, "Failed to create Flat index parameters (L2)\n");
    zvec_index_params_destroy(invert_params_standard);
    zvec_index_params_destroy(invert_params_extended);
    zvec_index_params_destroy(hnsw_params_fast);
    zvec_index_params_destroy(hnsw_params_balanced);
    zvec_index_params_destroy(hnsw_params_accurate);
    zvec_collection_schema_destroy(schema);
    return -1;
  }
  zvec_index_params_set_metric_type(flat_params_l2, ZVEC_METRIC_TYPE_L2);

  zvec_index_params_t *flat_params_cosine =
      zvec_index_params_create(ZVEC_INDEX_TYPE_FLAT);
  if (!flat_params_cosine) {
    fprintf(stderr, "Failed to create Flat index parameters (cosine)\n");
    zvec_index_params_destroy(invert_params_standard);
    zvec_index_params_destroy(invert_params_extended);
    zvec_index_params_destroy(hnsw_params_fast);
    zvec_index_params_destroy(hnsw_params_balanced);
    zvec_index_params_destroy(hnsw_params_accurate);
    zvec_index_params_destroy(flat_params_l2);
    zvec_collection_schema_destroy(schema);
    return -1;
  }
  zvec_index_params_set_metric_type(flat_params_cosine,
                                    ZVEC_METRIC_TYPE_COSINE);

  // 3. Create fields with different index types
  printf("Creating fields with various index types...\n");

  // Fields with inverted indexes
  zvec_field_schema_t *id_field =
      zvec_field_schema_create("id", ZVEC_DATA_TYPE_STRING, false, 0);
  if (id_field) {
    zvec_field_schema_set_index_params(id_field, invert_params_standard);
    error = zvec_collection_schema_add_field(schema, id_field);
    if (handle_error(error, "adding ID field") == ZVEC_OK) {
      printf("✓ ID field with standard inverted index added\n");
    }
  }

  zvec_field_schema_t *category_field =
      zvec_field_schema_create("category", ZVEC_DATA_TYPE_STRING, true, 0);
  if (category_field) {
    zvec_field_schema_set_index_params(category_field, invert_params_extended);
    error = zvec_collection_schema_add_field(schema, category_field);
    if (handle_error(error, "adding category field") == ZVEC_OK) {
      printf("✓ Category field with extended inverted index added\n");
    }
  }

  // Vector fields with HNSW indexes (different configurations)
  zvec_field_schema_t *fast_search_field = zvec_field_schema_create(
      "fast_vector", ZVEC_DATA_TYPE_VECTOR_FP32, false, 64);
  if (fast_search_field) {
    zvec_field_schema_set_index_params(fast_search_field, hnsw_params_fast);
    error = zvec_collection_schema_add_field(schema, fast_search_field);
    if (handle_error(error, "adding fast search field") == ZVEC_OK) {
      printf("✓ Fast search vector field (64D) with HNSW index added\n");
    }
  }

  zvec_field_schema_t *balanced_field = zvec_field_schema_create(
      "balanced_vector", ZVEC_DATA_TYPE_VECTOR_FP32, false, 128);
  if (balanced_field) {
    zvec_field_schema_set_index_params(balanced_field, hnsw_params_balanced);
    error = zvec_collection_schema_add_field(schema, balanced_field);
    if (handle_error(error, "adding balanced field") == ZVEC_OK) {
      printf("✓ Balanced vector field (128D) with HNSW index added\n");
    }
  }

  zvec_field_schema_t *accurate_field = zvec_field_schema_create(
      "accurate_vector", ZVEC_DATA_TYPE_VECTOR_FP3
```

### Core Architecture Module: `examples/c/optimized_example.c`
```
// Copyright 2025-present the zvec project
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include "zvec/c_api.h"

/**
 * @brief Print error message and return error code
 */
static zvec_error_code_t handle_error(zvec_error_code_t error,
                                      const char *context) {
  if (error != ZVEC_OK) {
    char *error_msg = NULL;
    zvec_get_last_error(&error_msg);
    fprintf(stderr, "Error in %s: %d - %s\n", context, error,
            error_msg ? error_msg : "Unknown error");
    zvec_free(error_msg);
  }
  return error;
}

/**
 * @brief Create test vector data
 */
static float *create_test_vector(size_t dimension) {
  float *vector = malloc(dimension * sizeof(float));
  if (!vector) {
    return NULL;
  }

  for (size_t i = 0; i < dimension; i++) {
    vector[i] = (float)rand() / (float)RAND_MAX;
  }

  return vector;
}

/**
 * @brief Optimized C API usage example with performance considerations
 */
int main() {
  printf("=== ZVec Optimized C API Example ===\n\n");

  // Get version information
  const char *version = zvec_get_version();
  printf("ZVec Version: %s\n\n", version ? version : "Unknown");

  zvec_error_code_t error;

  // 1. Create optimized collection schema
  zvec_collection_schema_t *schema =
      zvec_collection_schema_create("optimized_example_collection");
  if (!schema) {
    fprintf(stderr, "Failed to create collection schema\n");
    return -1;
  }
  printf("✓ Collection schema created\n");

  // 2. Create optimized index parameters
  zvec_index_params_t *hnsw_params =
      zvec_index_params_create(ZVEC_INDEX_TYPE_HNSW);
  if (!hnsw_params) {
    fprintf(stderr, "Failed to create HNSW index parameters\n");
    zvec_collection_schema_destroy(schema);
    return -1;
  }
  zvec_index_params_set_metric_type(hnsw_params, ZVEC_METRIC_TYPE_L2);
  zvec_index_params_set_hnsw_params(hnsw_params, 32, 200);

  // 3. Create fields with optimized configuration
  zvec_field_schema_t *id_field =
      zvec_field_schema_create("id", ZVEC_DATA_TYPE_STRING, false, 0);
  zvec_field_schema_t *text_field =
      zvec_field_schema_create("text", ZVEC_DATA_TYPE_STRING, true, 0);
  zvec_field_schema_t *embedding_field = zvec_field_schema_create(
      "embedding", ZVEC_DATA_TYPE_VECTOR_FP32, false, 128);

  if (!id_field || !text_field || !embedding_field) {
    fprintf(stderr, "Failed to create field schemas\n");
    goto cleanup_params;
  }

  // Set indexes
  zvec_field_schema_set_index_params(embedding_field, hnsw_params);

  // Add fields to schema
  error = zvec_collection_schema_add_field(schema, id_field);
  if (handle_error(error, "adding ID field") != ZVEC_OK) goto cleanup_fields;

  error = zvec_collection_schema_add_field(schema, text_field);
  if (handle_error(error, "adding text field") != ZVEC_OK) goto cleanup_fields;

  error = zvec_collection_schema_add_field(schema, embedding_field);
  if (handle_error(error, "adding embedding field") != ZVEC_OK)
    goto cleanup_fields;

  printf("✓ Fields configured with indexes\n");

  // 4. Create collection with optimized options
  zvec_collection_options_t *options = zvec_collection_options_create();
  if (!options) {
    fprintf(stderr, "Failed to create collection options\n");
    goto cleanup_fields;
  }
  zvec_collection_options_set_enable_mmap(
      options, true);  // Enable memory mapping for better performance

  zvec_collection_t *collection = NULL;
  error = zvec_collection_create_and_open("./optimized_example_collection",
                                          schema, options, &collection);
  zvec_collection_options_destroy(options);
  if (handle_error(error, "creating collection") != ZVEC_OK) {
    goto cleanup_fields;
  }
  printf("✓ Collection created with optimized settings\n");

  // 5. Bulk insert test data
  const size_t DOC_COUNT = 1000;
  const size_t BATCH_SIZE = 100;

  printf("Inserting %zu documents in batches of %zu...\n", DOC_COUNT,
         BATCH_SIZE);

  clock_t start_time = clock();

  for (size_t batch_start = 0; batch_start < DOC_COUNT;
       batch_start += BATCH_SIZE) {
    size_t current_batch_size = (batch_start + BATCH_SIZE > DOC_COUNT)
                                    ? DOC_COUNT - batch_start
                                    : BATCH_SIZE;

    zvec_doc_t **batch_docs = malloc(current_batch_size * sizeof(zvec_doc_t *));
    if (!batch_docs) {
      fprintf(stderr, "Failed to allocate batch documents\n");
      break;
    }

    // Create batch documents
    for (size_t i = 0; i < current_batch_size; i++) {
      batch_docs[i] = zvec_doc_create();
      if (!batch_docs[i]) {
        fprintf(stderr, "Failed to create document\n");
        // Cleanup previous documents in batch
        for (size_t j = 0; j < i; j++) {
          zvec_doc_destroy(batch_docs[j]);
        }
        free(batch_docs);
        goto cleanup_collection;
      }

      size_t doc_id = batch_start + i;
      char pk[32];
      snprintf(pk, sizeof(pk), "doc_%zu", doc_id);
      zvec_doc_set_pk(batch_docs[i], pk);

      // Add ID field
      char id_str[32];
      snprintf(id_str, sizeof(id_str), "ID_%zu", doc_id);
      zvec_doc_add_field_by_value(batch_docs[i], "id", ZVEC_DATA_TYPE_STRING,
                                  id_str, strlen(id_str));

      // Add text field
      char text_str[64];
      snprintf(text_str, sizeof(text_str),
               "Document number %zu with sample text", doc_id);
      zvec_doc_add_field_by_value(batch_docs[i], "text", ZVEC_DATA_TYPE_STRING,
                                  text_str, strlen(text_str));

      // Add vector field
      float *vector = create_test_vector(128);
      if (vector) {
        zvec_doc_add_field_by_value(batch_docs[i], "embedding",
                                    ZVEC_DATA_TYPE_VECTOR_FP32, vector,
                                    128 * sizeof(float));
        free(vector);
      }
    }

    // Insert batch
    size_t success_count, error_count;
    error = zvec_collection_insert(collection, (const zvec_doc_t **)batch_docs,
                                   current_batch_size, &success_count,
                                   &error_count);
    if (handle_error(error, "inserting batch") != ZVEC_OK) {
      // Cleanup batch documents
      for (size_t i = 0; i < current_batch_size; i++) {
        zvec_doc_destroy(batch_docs[i]);
      }
      free(batch_docs);
      goto cleanup_collection;
    }

    printf("  Batch %zu-%zu: %zu successful, %zu failed\n", batch_start,
           batch_start + current_batch_size - 1, success_count, error_count);

    // Cleanup batch documents
    for (size_t i = 0; i < current_batch_size; i++) {
      zvec_doc_destroy(batch_docs[i]);
    }
    free(batch_docs);
  }

  clock_t insert_end_time = clock();
  double insert_time =
      ((double)(insert_end_time - start_time)) / CLOCKS_PER_SEC;
  printf("✓ Bulk insertion completed in %.3f seconds (%.0f docs/sec)\n",
         insert_time, DOC_COUNT / insert_time);

  // 6. Flush and optimize collection
  printf("Flushing and optimizing collection...\n");
  zvec_collection_flush(collection);
  zvec_collection_optimize(collection);
  printf("✓ Collection optimized\n");

  // 7. Performance query test
  printf("Testing query performance...\n");

  float *query_vector = create_test_vector(128);
  if (!query_vector) {
    fprintf(stderr, "Failed to create query vector\n");
    goto cleanup_collection;
  }

  zvec_vector_query
```

### Core Architecture Module: `python/zvec/__init__.py`
```
# Copyright 2025-present the zvec project
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

from __future__ import annotations

import sys
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from importlib.metadata import PackageNotFoundError

# zvec ships a native C++ extension that is only built and tested for 64-bit
# CPython. A 32-bit interpreter would fail to load the extension with an
# obscure error, so fail fast here with an actionable message.
if sys.maxsize <= 2**32:
    raise ImportError(
        "zvec requires a 64-bit Python interpreter; "
        "the current interpreter is 32-bit and is not supported."
    )


# Register the wheel-bundled jieba dict dir so `import zvec` alone makes
# the jieba FTS tokenizer usable. Users can still override via
# zvec.init(jieba_dict_dir=...), zvec.set_default_jieba_dict_dir(...),
# ZVEC_JIEBA_DICT_DIR, or per-field FtsIndexParam.extra_params.
try:
    from importlib.resources import files as _resource_files

    from zvec._zvec import (
        get_default_jieba_dict_dir,
        io_backend_description,
        io_backend_type,
        set_default_jieba_dict_dir,
    )

    set_default_jieba_dict_dir(str(_resource_files("zvec").joinpath("data/jieba_dict")))
except Exception:
    # Custom builds without bundled dict; users must configure explicitly.
    pass


# ==============================
# Public API — grouped by category
# ==============================

from . import model as model

# —— Extensions ——
from .extension import (
    BM25EmbeddingFunction,
    DefaultLocalDenseEmbedding,
    DefaultLocalReRanker,
    DefaultLocalSparseEmbedding,
    DenseEmbeddingFunction,
    OpenAIDenseEmbedding,
    OpenAIFunctionBase,
    QwenDenseEmbedding,
    QwenFunctionBase,
    QwenReRanker,
    QwenSparseEmbedding,
    ReRanker,
    RrfReRanker,
    SentenceTransformerFunctionBase,
    SparseEmbeddingFunction,
    WeightedReRanker,
)

# —— Typing ——
from .model import param as param
from .model import schema as schema

# —— Core data structures ——
from .model.collection import Collection
from .model.doc import Doc, DocList, GroupResult

# —— Query & index parameters ——
# —— FTS params (C++ binding) ——
from .model.param import (
    AddColumnOption,
    AlterColumnOption,
    CollectionOption,
    DiskAnnIndexParam,
    DiskAnnQueryParam,
    FlatIndexParam,
    FtsIndexParam,
    FtsQueryParam,
    HnswIndexParam,
    HnswQueryParam,
    HnswRabitqIndexParam,
    HnswRabitqQueryParam,
    IndexOption,
    InvertIndexParam,
    IVFIndexParam,
    IVFQueryParam,
    IvfRabitqIndexParam,
    IvfRabitqQueryParam,
    OptimizeOption,
    QuantizerParam,
    VamanaIndexParam,
    VamanaQueryParam,
)
from .model.param.query import Fts, Query, VectorQuery

# —— Schema & field definitions ——
from .model.schema import CollectionSchema, CollectionStats, FieldSchema, VectorSchema

# —— tools ——
from .tool import require_module
from .typing import (
    DataType,
    IndexType,
    IOBackendType,
    MetricType,
    QuantizeType,
    Status,
    StatusCode,
)
from .typing.enum import LogLevel, LogType

# —— lifecycle ——
from .zvec import create_and_open, init, open

# ==============================
# Public interface declaration
# ==============================
__all__ = [
    # Zvec functions
    "create_and_open",
    "init",
    "open",
    "set_default_jieba_dict_dir",
    "get_default_jieba_dict_dir",
    "io_backend_type",
    "io_backend_description",
    # Core classes
    "Collection",
    "Doc",
    "DocList",
    # Schema
    "CollectionSchema",
    "FieldSchema",
    "VectorSchema",
    "CollectionStats",
    # Parameters
    "GroupResult",
    "Query",
    "VectorQuery",
    "Fts",
    "FtsIndexParam",
    "FtsQueryParam",
    "InvertIndexParam",
    "HnswIndexParam",
    "HnswRabitqIndexParam",
    "IvfRabitqIndexParam",
    "FlatIndexParam",
    "IVFIndexParam",
    "DiskAnnIndexParam",
    "DiskAnnQueryParam",
    "CollectionOption",
    "IndexOption",
    "OptimizeOption",
    "AddColumnOption",
    "AlterColumnOption",
    "HnswQueryParam",
    "HnswRabitqQueryParam",
    "IvfRabitqQueryParam",
    "IVFQueryParam",
    "QuantizerParam",
    "VamanaIndexParam",
    "VamanaQueryParam",
    # Extensions
    "DenseEmbeddingFunction",
    "SparseEmbeddingFunction",
    "QwenFunctionBase",
    "OpenAIFunctionBase",
    "SentenceTransformerFunctionBase",
    "ReRanker",
    "DefaultLocalDenseEmbedding",
    "DefaultLocalSparseEmbedding",
    "BM25EmbeddingFunction",
    "OpenAIDenseEmbedding",
    "QwenDenseEmbedding",
    "QwenSparseEmbedding",
    "RrfReRanker",
    "WeightedReRanker",
    "DefaultLocalReRanker",
    "QwenReRanker",
    # Typing
    "DataType",
    "IOBackendType",
    "MetricType",
    "QuantizeType",
    "IndexType",
    "LogLevel",
    "LogType",
    "Status",
    "StatusCode",
    # Tools
    "require_module",
]

# ==============================
# Version handling
# ==============================
__version__: str

try:
    from importlib.metadata import version
except ImportError:
    from importlib_metadata import version  # Python < 3.8

try:
    __version__ = version("zvec")
except Exception:
    __version__ = "unknown"

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #747** (2026-09-11): **[Bug]: SIGSEGV (native stack overflow) in sqlengine QueryNode parsing when a filter expands to ~15k `file_id = … OR …` predicates**
  *Symptoms*: ### Description  A read-only `context()` query against a workspace collection with ~16,000 files crashes the whole Node process with SIGSEGV on **Linux x64**, deterministically, whenever the query passes `excludedFileTypes` (zvec-grep). The same index and the same query run fine on **macOS arm64**.  Two independent problems stack on top of each other:  1. **zvec-grep (TS layer)**: `searchPlanToStorageFilter` expands a file-type exclusion into the **full list of fileIds**, and `buildInFilter` turns that into `(file_id = 'a' OR file_id = 'b' OR …)` — one predicate per file in the collection. For our index that is ~15k predicates in a single expression. 2. **zvec native (sqlengine)**: the query-expression parser (RTTI shows `zvec::sqlengine::QueryNode`) processes this chain **recursively with no depth limit**, so the expression length is effectively bounded only by the process stack.  ### Steps to Reproduce  ```python ## Environment  - `@zvec/zvec@0.7.0` + `@zvec/bindings-linux-x64@0.7.0` (official npm prebuilt), `@zvec/zvec-grep@0.2.1` - Node v22.22.1, Linux x64, glibc 2.34 - macOS control: Node v22.23.2, `@zvec/bindings-darwin-arm64@0.7.0` — no crash - Workspace: 14 rootPaths, 16,188 files, 127,685 indexed entities (~777 MB index)  ## What happens  Read session opens fine; the first `context()` call (any query text, `limit: 1`) kills the process:   const session = await openWorkspaceReadSession(root, model);   // OK await session.context({ query: "warmup", limit: 1, excludedFi
  **Post-Mortem & Fix Analysis**:
  > Thanks for reporting this! The native stack overflow caused by long OR expressions has been fixed in #694. The fix has been merged and will be included in the next release.  Please upgrade once the release is available and retry your original scenario. Let us know if the issue persists.

- **Issue #714** (2026-09-10): **[Bug]: SIGSEGV under concurrent fetch + insert when the writer crosses a segment switch**
  *Symptoms*: ### Description  One writer thread running `insert()` concurrently with reader threads running `fetch()` / `query()` / `group_by_query()` crashes the process with SIGSEGV on Linux when the writer crosses a segment-switch boundary. Reproduced **3/3 on `main` .  **Root cause.** Readers snapshot the segment list via `get_all_segments()` with **no lock**, while writers mutate that state under exclusive `write_mtx_` ,`doc_ids_` grows per insert , and `writing_segment_` is reassigned per switch. Worse, `dump()`/`flush()` tear down the old segment's in-memory store (`memory_store_.reset()`) **without taking `seg_mtx_` at all** , so a reader mid-`Fetch` — even holding `seg_mtx_` — reads a store that is being destroyed.  gdb captures both threads in the same instant (full stacks below):  - **Reader**: `fetch` → `SegmentImpl::Fetch` → `MemForwardStore::convertToTable` → `arrow::Table::FromRecordBatches` → SIGSEGV - **Writer**: `write_impl` → `switch_to_new_segment_for_writing` → `dump()` → `flush()` → `LocalWalFile::remove()`  On macOS the same race does not crash; a probe (150µs widened reader window) measured **99.7%** of `doc_ids_` push_backs and **99.4%** of segment-switch reassignments executing while a reader was inside `get_all_segments()`. The unsynchronized shape dates to the initial commit.  **Why rarely hit**: only the doc-count-threshold switch is exposed — the other seven switch call sites (optimize, DDL, iterator creation) hold the schema lock exclusively and drain in-fli

- **Issue #699** (2026-08-26): **[Bug]: mmap_forward_store.cc:393 : Failed to find target chunk for index x**
  *Symptoms*: ### Description  Hello,  I ran into the following issue with the latest zvec 0.6.0:  ```python import zvec import numpy as np  col = zvec.create_and_open("demo", zvec.CollectionSchema(name="demo", vectors=[     zvec.VectorSchema("embedding", zvec.DataType.VECTOR_FP16, 128, index_param=zvec.HnswIndexParam()) ])) for i in range(16112):     col.insert([zvec.Doc(id=str(i), vectors={"embedding": np.random.randn(128)})]) col.optimize() res = col.query(queries=zvec.Query("embedding", vector=np.random.randn(128)), topk=1024) print("IDs:", {d.id for d in res}) # Output: #   [ERROR ... mmap_forward_store.cc:393] Failed to find target chunk for index 16068 #   IDs: {''} ```  The error and the reported index are nondeterministic. The error probability seems to increase with topk. For this specific configuration, I had a 100% error probability so far.  ### Steps to Reproduce  Install e.g. python 3.12.3 and zvec 0.6.0. Then run:  ```python import zvec import numpy as np  col = zvec.create_and_open("demo", zvec.CollectionSchema(name="demo", vectors=[     zvec.VectorSchema("embedding", zvec.DataType.VECTOR_FP16, 128, index_param=zvec.HnswIndexParam()) ])) for i in range(16112):     col.insert([zvec.Doc(id=str(i), vectors={"embedding": np.random.randn(128)})]) col.optimize() res = col.query(queries=zvec.Query("embedding", vector=np.random.randn(128)), topk=1024) print("IDs:", {d.id for d in res}) ```  ### Logs / Stack Trace  ```shell [ERROR ... mmap_forward_store.cc:393] Failed to find target
  **Post-Mortem & Fix Analysis**:
  > Thanks for reporting this. The issue was caused by incorrect row lookup when the final IPC chunk was larger than the preceding chunks. It has been fixed in #645 and will be included in v0.7.0, which will be released soon.

- **Issue #673** (2026-08-18): **Crash during Optimize can leak an orphaned segment dir and fail the next segment allocation after recovery**
  *Symptoms*: ### Description  Since #614, Optimize moves the compacted output to its final numeric directory and opens it in the lock-free phase, before the manifest is persisted in the exclusive commit phase:  1. `allocate_segment_id()` returns N (in-memory fetch_add, not persisted) 2. `MoveDirectory(tmp -> <collection>/N)` — numeric dir now exists on disk 3. `Segment::Open(<collection>/N)` — heavy I/O (reads files, builds mmaps) 4. Optimize then waits for the exclusive schema lock; only the commit    phase persists `next_segment_id = N+1` via version flush  If the process crashes between step 2 and the commit-phase flush, recovery restores `segment_id_allocator_` from the old manifest (back to N) and neither opens nor removes the unreferenced directory `<collection>/N`. After recovery, the first operation that allocates segment id N fails:  - an Insert that switches the writing segment hits   `Segment::CreateAndOpen`'s existence check and returns   "Segment create failed: segment path already exists" to the user; - a schema DDL switching the writing segment fails the same way; - the next Optimize fails at `MoveDirectory` (rename onto a non-empty   directory, ENOTEMPTY).  Since `allocate_segment_id()` is fetch_add, the failure is one-shot (a retry allocates N+1 and succeeds), but the orphaned directory — a full compacted segment — is never referenced and never removed, i.e. a permanent disk leak, and the first user operation after recovery can spuriously fail.  The pre-#614 code had the 

- **Issue #665** (2026-08-11): **[Bug]: Node binding — insertSync hard-kills the process with 0xC0000409 (STATUS_STACK_BUFFER_OVERRUN) on some non-ASCII Windows collection paths**
  *Symptoms*: ### Summary  On Windows, `insertSync` through the Node binding (`@zvec/zvec`) terminates the **entire process** with `0xC0000409` (`STATUS_STACK_BUFFER_OVERRUN`) when the collection path contains certain non-ASCII segments. `create` and index build both succeed first; the kill happens at insert.  This is a native fail-fast, not a JavaScript exception. JS never regains control, so `try/catch` cannot observe it and an application cannot degrade gracefully — the process is gone.  > Possibly related: #626. **It is not the same failure**, and I would rather not > bury this under it. #626 is the Python binding raising a *catchable* `RuntimeError` > ("No mapping for the Unicode character exists in the target multi-byte code page"). > Here the Node binding takes the process down with `0xC0000409` and nothing is > catchable. Same neighbourhood (Windows + Unicode path), materially different > failure mode and blast radius.  ### Environment  ``` @zvec/zvec   0.6.0  (and 0.5.0 — see below) node         v22.22.2 os           Windows NT 10.0.26200 (Windows 11 Pro), x64 locale       zh-CN, console encoding utf-8 ```  ### Not introduced by 0.6  The same paths were measured on **0.5.0 and 0.6.0**, and the verdicts are identical row for row:  ``` path segment              0.5.0        0.6.0 中文-日本語-한국어          0xC0000409   0xC0000409 日本語-한국어               0xC0000409   0xC0000409 中文語-中文語               0xC0000409   0xC0000409 日本語 한국어               0xC0000409   0xC0000409 日本語.한국어               0x
  **Post-Mortem & Fix Analysis**:
  > Thanks for providing such a detailed report, we've reproduced it and it will be fixed in the next release

- **Issue #644** (2026-08-21): **[Bug]: 磁盘随optimize次数线性膨胀**
  *Symptoms*: ### Description  我在本地试验的时候发现一个奇怪的现象： 假设有3w条数据，全部插入后再进行optmize，则空间是正常的 如果每1w条数据插入一次后进行optmize（之后线上会这么操作，降低锁延迟），则会导致空间膨胀  [cleanup_orphans.py](https://github.com/user-attachments/files/30642346/cleanup_orphans.py) [parse_manifest.py](https://github.com/user-attachments/files/30642347/parse_manifest.py) [disk_test.py](https://github.com/user-attachments/files/30642348/disk_test.py)  文件说明： disk_test.py 是测试用脚本，用于复现 cleanup_orphans.py 是临时用修复脚本，负责移除孤儿段内容（正是导致空间膨胀的主要原因）  **注意，这三个脚本是由AI生成的，但是已经由人工进行核验和检查实际功能，目前测试下来移除孤儿段不会对现有数据造成影响（但不确定是否会有索引未能加载等其他问题）**  ## 以下是AI定位的原因：  zvec 是 LSM 式段存储：数据先进内存 writing segment → 攒够后刷成 persist segment → optimize 把 ≥2 个 persist 段合并成 1 个新段。关键问题出在合并后的清理环节：  CollectionImpl::Optimize() 合并后调用 segment_manager_->destroy_segment() 删除旧段。 SegmentImpl::destroy() 只把 need_destroyed_ 置 true，不删任何文件；真正的物理删除在 ~SegmentImpl() 析构函数里才执行（cleanup() → RemoveDirectory）。 实测：被合并的旧段对象析构从未发生（引用生命周期缺陷），旧段目录（含大体积的 .proxima 索引文件）永久残留。 证据链完整：  manifest 版本清单只引用新段 → 逻辑状态完全正确：doc_count=30000、查询正常，只有磁盘被浪费； 残留文件进程退出后依然在、且全程未被占用（可用 DELETE 权限打开）→ 排除了文件锁，锁定"清理从未执行"； 关掉 INT8 量化、关掉 mmap 均复现 → 与量化/mmap 无关，是基础 compact 路径的 bug。 另外两个附加发现：① INT8 量化路径每个段还会额外存一份 FP32 原始向量副本（3 万条 768 维 ≈ 92MB），孤儿段的这份是浪费大头；② Windows 下 coll.destroy() 也偶发清不干净（我测到残留 91~132MB），所以指望 destroy 回收不可靠。  ### Steps to Reproduce  ```python 1. 运行disk_test.py 即可复现此问题，版本0.6.0 ```  ### Logs / Stack Trace  ```shell  ```  ### Operating System  Windows 11 25H2  ### Build & Runtime Environment  python 3.13,zvec == 0.6.0  ### Additional Context
  **Post-Mortem & Fix Analysis**:
  > @xiaofeng-ling 感谢报告issue! 复现脚本很有用！ 😃   已在 Windows 和 Linux 上进行对比，确认该问题主要由两种系统不同的文件删除语义导致。 原实现会在 segment 析构期间先调用 `close()`，再通过 `std::filesystem::remove_all()` 删除目录，但 `close()` 没有提前释放 persist store、WAL 等文件句柄或 mmap。 Linux 允许仍被打开或 mmap 的文件被 unlink：目录项会立即消失，实际空间在最后一个引用关闭后释放。因此相同代码在 Linux 上通常能正常清理；Windows 默认不允许删除仍被占用的文件，导致 `remove_all()` 失败，而原实现没有处理该结果，所以旧 segment 目录永久残留。  #676 修复了该问题。 修复后还有遗留一个低概率的外部句柄场景：例如备份或杀毒工具以不包含 `FILE_SHARE_DELETE` 的方式打开 segment 文件，此时 Windows 仍无法立即删除旧目录。所以当外部句柄释放后，遗留目录将在后续重新打开时清理（依赖 #674 的合入）。

- **Issue #626** (2026-08-11): **[Bug]: windows unicode path bug**
  *Symptoms*: ### Description  您好，我这边发现在 Windows 环境下测试 zvec 的 Unicode 路径支持时，发现部分 Unicode 路径可以正常使用，但部分路径在调用 collection.insert() 时失败。  测试结果： C:\temp\zvec_unicode_test\测试中文\rag_zvec ✅ C:\temp\zvec_unicode_test\テストパス\rag_zvec ✅ C:\temp\zvec_unicode_test\中文_テスト_테스트\rag_zvec ✅ C:\temp\zvec_unicode_test\테스트 경로\rag_zvec ❌ C:\temp\zvec_unicode_test\di22222ci。。-cmy\rag_zvec ❌  对于失败的路径： create_and_open() 成功 create_index() 成功 collection.insert() 失败  ### Steps to Reproduce  ```python 使用部分路径创建zvec库，插入报错 ```  ### Logs / Stack Trace  ```shell Traceback (most recent call last):   File "C:\xxx\1.py", line 59, in <module>     result = collection.insert(docs)   File "C:\Users\xxx\miniforge3\envs\database\lib\site-packages\zvec\model\collection.py", line 265, in insert     results = self._obj.Insert( RuntimeError: No mapping for the Unicode character exists in the target multi-byte code page. ```  ### Operating System  windows 11  ### Build & Runtime Environment  zvec 0.6.0  ### Additional Context  - [ ] I've checked `git status` — no uncommitted submodule changes - [ ] I built with `CMAKE_BUILD_TYPE=Debug` - [ ] This occurs with or without `COVERAGE=ON` - [ ] The issue involves Python ↔ C++ integration (pybind11)
  **Post-Mortem & Fix Analysis**:
  > 感谢反馈！ 这确实是个bug，但在acp(ANSI Code Page) =1252的机器上不会出现，一直没发现 :(  我们已经在 #666 修复，将会随着下一个版本（初步预计下周）发布~ 🌹  

- **Issue #619** (2026-07-27): **[Bug]: Linux SIGSEGV (exit 139) on zvec_collection_close / zvec_shutdown after successful create_and_open**
  *Symptoms*: ### Description  On linux-x64, after a successful zvec_collection_create_and_open (C API), calling zvec_collection_close and/or zvec_shutdown can SIGSEGV. Process exit code 139 (128+11).  Expected: clean close/shutdown, exit 0. Actual: native segfault during teardown; create/open themselves succeed.  This is not a catchable managed exception. Observed via the community .NET binding AdamSystems.ZVec.NET (wraps the official C API / native builds of zvec 0.5.1). Until fixed, that binding will suppress native close/shutdown on Linux so deployed apps do not crash on host stop — we want a proper C++ fix and a release/commit we can pin.  ### Steps to Reproduce  ```python 1. zvec_initialize(...) 2. Create a small schema (e.g. one FP32 vector field, dim 8, flat index) 3. zvec_collection_create_and_open(path, schema, options, &collection) → OK 4. zvec_collection_close(collection) and/or zvec_shutdown() 5. Process receives SIGSEGV, exit 139  Equivalent .NET shape:   factory.Initialize(...);   var col = factory.CreateAndOpen(path, schema); // OK   col.Dispose();       // may SIGSEGV on linux-x64   factory.Shutdown();  // may SIGSEGV on linux-x64  Happy to add a pure-C repro / gdb backtrace if helpful. ```  ### Logs / Stack Trace  ```shell (Process exit 139 — SIGSEGV. Full gdb backtrace TBD if needed; happy to capture on request.) Consumer smoke previously had to Environment.Exit(0) before Dispose/Shutdown to avoid the crash after a successful create/open. ```  ### Operating System  Linux
  **Post-Mortem & Fix Analysis**:
  > Hi @ahmedSamir50, thanks for the report. I investigated at the pure C API level — **the crash is not in `zvec_collection_close`/`zvec_shutdown`, but a log-config ownership bug in the ZVec.NET binding's init path.**  ## Findings  **1. The reported sequence does NOT reproduce with correct C API usage.** A minimal pure-C repro (initialize → FP32 dim=8 flat schema → create_and_open → close → shutdown) exits cleanly on linux-x64 Debug, 50/50 runs. Also clean: shutdown-before-close, close-only, shutdown-only with leaked collection, and dlopen/dlclose (host-stop simulation).  **2. The binding's native call sequence reproduces exit 139 — 5/5 runs.** `ZVecNativeLifecycle.ApplyNativeConfig` does:  ```csharp NativeMethods.zvec_config_data_set_log_config(cfg, logCfg); // ownership transferred NativeMethods.zvec_initialize(cfg); // finally: NativeMethods.zvec_config_log_destroy(logCfg);              // BUG: double free ```  But `c_api.h` says: *"ownership is transferred to config, do not free separ
  > @chinaux — sincere thanks for the careful investigation and for the precious time you spent on this. The pure-C isolation, the binding-side repro, and the gdb ownership analysis made the root cause unambiguous and saved us chasing the wrong layer. We really appreciate that work and the depth of debugging you put into it.  Confirmed on our side: the crash was a ZVec.NET binding bug — destroying `logCfg` after a successful `zvec_config_data_set_log_config` (ownership already transferred). Fixed in AdamSystems.ZVec.NET: https://github.com/ahmedSamir50/AdamSystems.ZVec.NET/pull/20  Linux Auto suppress and HardExit workarounds are removed; local Pack-parity sim is green (Noble managed + linux consumer exit 0).  We will ship the resolution in **ZVec.NET 1.0.0-beta.3.2**. Closing this issue from the binding side; thank you again.
  > Closing: binding-side fix landed in https://github.com/ahmedSamir50/AdamSystems.ZVec.NET/pull/20; will ship in ZVec.NET 1.0.0-beta.3.2. Thanks again @chinaux.

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

### Incident Patch 1: `98aa126b` (2026-09-28)
**Commit Message**: fix(core): honor optimize threads in nested training(rabitQ/DiskANN) (#775)

**File**: `src/core/algorithm/diskann/diskann_builder.cc` (modified, +5/-2)
```diff
@@ -375,7 +375,7 @@ int DiskAnnBuilder::prune_internal(IndexThreads::Pointer threads) {
   return 0;
 }
 
-int DiskAnnBuilder::train_quantized_data(IndexThreads::Pointer /*threads*/) {
+int DiskAnnBuilder::train_quantized_data(IndexThreads::Pointer threads) {
   LOG_INFO("Starting Train: Chunk Num: %u", pq_chunk_num_);
 
   ailego::ElapsedTime timer;
@@ -388,7 +388,10 @@ int DiskAnnBuilder::train_quantized_data(IndexThreads::Pointer /*threads*/) {
 
   ailego::Params qp;
   qp.set("num_chunk", pq_chunk_num_);
-  qp.set("thread_count", build_thread_count_);
+  // The quantizer creates its own pool, so bound it by the caller's pool.
+  const auto pq_thread_count = static_cast<uint32_t>(std::max<size_t>(
+      1, std::min<size_t>(build_thread_count_, threads->count())));
+  qp.set("thread_count", pq_thread_count);
   qp.set("use_zero_mean", false);
   int ret = quantizer_->init(build_meta_, qp);
   if (ret != 0) {
```

**File**: `src/core/algorithm/hnsw_rabitq/rabitq_converter.h` (modified, +2/-1)
```diff
@@ -50,7 +50,8 @@ class RabitqConverter : public IndexConverter {
   using IndexConverter::train;
 
   //! Train the data with the specified thread resources
-  int train(IndexHolder::Pointer holder, IndexThreads::Pointer threads);
+  int train(IndexHolder::Pointer holder,
+            IndexThreads::Pointer threads) override;
 
   //! Transform the data - quantize vectors using RaBitQ
   int transform(IndexHolder::Pointer holder) override;
```

**File**: `src/core/framework/index_converter.cc` (modified, +7/-1)
```diff
@@ -21,8 +21,14 @@ namespace core {
 
 int IndexConverter::TrainAndTransform(const IndexConverter::Pointer &converter,
                                       IndexHolder::Pointer holder) {
+  return TrainAndTransform(converter, std::move(holder), nullptr);
+}
+
+int IndexConverter::TrainAndTransform(const IndexConverter::Pointer &converter,
+                                      IndexHolder::Pointer holder,
+                                      IndexThreads::Pointer threads) {
   auto two_pass_holder = IndexHelper::MakeTwoPassHolder(std::move(holder));
-  int ret = converter->train(two_pass_holder);
+  int ret = converter->train(two_pass_holder, std::move(threads));
   if (ret == 0) {
     ret = converter->transform(std::move(two_pass_holder));
   }
```

**File**: `src/core/mixed_reducer/mixed_streamer_reducer.cc` (modified, +3/-3)
```diff
@@ -725,9 +725,11 @@ int MixedStreamerReducer::reduce_with_builder(const IndexFilter &filter) {
 }
 
 int MixedStreamerReducer::index_build(IndexHolder::Pointer target_holder) {
+  auto threads =
+      std::make_shared<BorrowedSingleQueueIndexThreads>(*thread_pool_);
   if (target_builder_converter_) {
     int ret = core::IndexConverter::TrainAndTransform(target_builder_converter_,
-                                                      target_holder);
+                                                      target_holder, threads);
     if (ret != 0) {
       LOG_ERROR("Failed to convert target holder, ret=%d", ret);
       return merged_holder_ && merged_holder_->status() != 0
@@ -740,8 +742,6 @@ int MixedStreamerReducer::index_build(IndexHolder::Pointer target_holder) {
       return core::IndexError_Runtime;
     }
   }
-  auto threads =
-      std::make_shared<BorrowedSingleQueueIndexThreads>(*thread_pool_);
   int ret = target_builder_->train(threads, target_holder);
   if (merged_holder_ && merged_holder_->status() != 0) {
     return merged_holder_->status();
```

**File**: `src/include/zvec/core/framework/index_converter.h` (modified, +14/-0)
```diff
@@ -14,11 +14,13 @@
 #pragma once
 
 #include <atomic>
+#include <utility>
 #include <zvec/core/framework/index_dumper.h>
 #include <zvec/core/framework/index_holder.h>
 #include <zvec/core/framework/index_meta.h>
 #include <zvec/core/framework/index_stats.h>
 #include <zvec/core/framework/index_storage.h>
+#include <zvec/core/framework/index_threads.h>
 #include "zvec/core/framework/index_reformer.h"
 
 namespace zvec {
@@ -179,6 +181,13 @@ class IndexConverter : public IndexModule {
     return IndexError_NotImplemented;
   }
 
+  //! Train the data with caller-provided thread resources when supported
+  virtual int train(IndexHolder::Pointer holder,
+                    IndexThreads::Pointer threads) {
+    (void)threads;
+    return train(std::move(holder));
+  }
+
   //! Train the data
   virtual int train(IndexSparseHolder::Pointer) {
     return IndexError_NotImplemented;
@@ -224,6 +233,11 @@ class IndexConverter : public IndexModule {
   static int TrainAndTransform(const IndexConverter::Pointer &converter,
                                IndexHolder::Pointer holder);
 
+  //! Train and transform with caller-provided thread resources
+  static int TrainAndTransform(const IndexConverter::Pointer &converter,
+                               IndexHolder::Pointer holder,
+                               IndexThreads::Pointer threads);
+
   //! Train, transform and dump the index
   static int TrainTransformAndDump(const IndexConverter::Pointer &converter,
                                    IndexHolder::Pointer holder,
```

---

### Incident Patch 2: `53c1bb60` (2026-09-24)
**Commit Message**: fix(quantizer): use rounded INT4 values for scoring metadata (#777)

**File**: `src/core/quantizer/record_quantizer.h` (modified, +7/-4)
```diff
@@ -54,16 +54,19 @@ class RecordQuantizer {
       } else {
         scale = 15 / std::max(max - min, epsilon);
         bias = -min * scale - 8;
+        // Accumulate the rounded codes: the stored sum must match the packed
+        // nibbles, otherwise QuantizedInteger scoring (which reconstructs
+        // scores from sum) ranks with a per-record error.
         for (size_t i = 0; i < dim; i += 2) {
-          float lo = vec[i] * scale + bias;
-          float hi = vec[i + 1] * scale + bias;
+          float lo = std::round(vec[i] * scale + bias);
+          float hi = std::round(vec[i + 1] * scale + bias);
           squared_sum += lo * lo;
           sum += lo;
           squared_sum += hi * hi;
           sum += hi;
           (reinterpret_cast<uint8_t *>(out))[i / 2] =
-              (static_cast_from_float_to_uint8(std::round(hi)) << 4) |
-              (static_cast_from_float_to_uint8(std::round(lo)) & 0xF);
+              (static_cast_from_float_to_uint8(hi) << 4) |
+              (static_cast_from_float_to_uint8(lo) & 0xF);
         }
         extras =
             reinterpret_cast<float *>(static_cast<uint8_t *>(out) + dim / 2);
```

**File**: `tests/core/interface/index_interface_test.cc` (modified, +16/-11)
```diff
@@ -787,11 +787,13 @@ TEST(IndexInterface, BufferGeneral) {
 
   auto func = [&](const BaseIndexParam::Pointer &param,
                   const BaseIndexQueryParam::Pointer &query_param) {
-    const float value_tolerance =
-        param->quantizer_param &&
-                param->quantizer_param->type == QuantizerType::kInt4
-            ? 0.1f
-            : 1e-6f;
+    const bool is_int4 = param->quantizer_param &&
+                         param->quantizer_param->type == QuantizerType::kInt4;
+    const float value_tolerance = is_int4 ? 0.1f : 1e-6f;
+    // INT4 reconstructs 1.0 as 14/15 for this vector.
+    const float expected_score =
+        is_int4 ? 4.0f + (14.0f / 15.0f) * (14.0f / 15.0f) : 5.0f;
+    const float score_tolerance = is_int4 ? 1e-5f : 1e-6f;
     std::string real_index_name = index_name;
     zvec::test_util::RemoveTestFiles(index_name + "*");
     auto write_index = IndexFactory::CreateAndInitIndex(*param);
@@ -811,16 +813,21 @@ TEST(IndexInterface, BufferGeneral) {
 
     auto read_index = IndexFactory::CreateAndInitIndex(*param);
     ASSERT_NE(nullptr, read_index);
-    read_index->open(real_index_name,
-                     {StorageOptions::StorageType::kBufferPool, false});
+    ASSERT_EQ(
+        0, read_index->open(real_index_name,
+                            {StorageOptions::StorageType::kBufferPool, false}));
+    auto cleanup = zvec::ailego::ScopeGuard::Make([&]() {
+      EXPECT_EQ(0, read_index->close());
+      zvec::test_util::RemoveTestFiles(index_name + "*");
+    });
 
     SearchResult result;
     VectorData query;
     query.vector = DenseVector{vector.data()};
-    read_index->search(query, query_param, &result);
+    ASSERT_EQ(0, read_index->search(query, query_param, &result));
     ASSERT_EQ(1, result.doc_list_.size());
     ASSERT_EQ(233, result.doc_list_[0].key());
-    ASSERT_NEAR(5.0f, result.doc_list_[0].score(), value_tolerance);
+    ASSERT_NEAR(expected_score, result.doc_list_[0].score(), score_tolerance);
     if (query_param->fetch_vector) {
       auto &doc = result.doc_list_[0];
       if (result.reverted_vector_list_.size() != 0) {
@@ -847,8 +854,6 @@ TEST(IndexInterface, BufferGeneral) {
     ASSERT_NEAR(1.0f, fetched_vector[1], value_tolerance);
     ASSERT_NEAR(2.0f, fetched_vector[2], value_tolerance);
     result.doc_list_.clear();
-    read_index->close();
-    zvec::test_util::RemoveTestFiles(index_name + "*");
   };
 
 
```

**File**: `tools/core/flow.h` (modified, +14/-0)
```diff
@@ -317,6 +317,13 @@ class Flow {
             return IndexError_NoExist;
           }
           reformer_->init(meta.reformer_params());
+          // Load converter state (e.g. rotator) so queries are transformed
+          // into the same space as the stored codes.
+          ret = reformer_->load(stg_);
+          if (ret != 0) {
+            LOG_ERROR("Failed to load reformer state from storage");
+            return ret;
+          }
         }
       }
 
@@ -486,6 +493,13 @@ class SparseFlow {
             return IndexError_NoExist;
           }
           reformer_->init(meta.reformer_params());
+          // Load converter state (e.g. rotator) so queries are transformed
+          // into the same space as the stored codes.
+          ret = reformer_->load(stg_);
+          if (ret != 0) {
+            LOG_ERROR("Failed to load reformer state from storage");
+            return ret;
+          }
         }
       }
 
```

---

### Incident Patch 3: `d88357bf` (2026-09-21)
**Commit Message**: perf(diskann): reduce peak memory usage during index build and merge (#762)

Co-authored-by: Jalin Wang <wangjianning.wjn@alibaba-inc.com>

**File**: `src/core/algorithm/diskann/diskann_builder.cc` (modified, +29/-29)
```diff
@@ -27,6 +27,7 @@
 #include <zvec/core/framework/index_holder.h>
 #include <zvec/core/interface/index_factory.h>
 #include "algorithm/cluster/vector_mean.h"
+#include "utility/prefix_index_holder.h"
 #include "diskann_context.h"
 #include "diskann_params.h"
 #include "diskann_util.h"
@@ -395,27 +396,10 @@ int DiskAnnBuilder::train_quantized_data(IndexThreads::Pointer /*threads*/) {
     return ret;
   }
 
-  // Preserve the legacy trainer's bounded prefix sample. The turbo trainer
-  // collects its entire input before subsampling, so cap that input first.
-  IndexHolder::Pointer training_holder = holder_;
-  if (holder_->count() > max_train_sample_count_) {
-    auto iter = holder_->create_iterator();
-    if (!iter) {
-      LOG_ERROR("Create training iterator failed");
-      return IndexError_Runtime;
-    }
-    auto sample = std::make_shared<RandomAccessIndexHolder>(build_meta_);
-    sample->reserve(max_train_sample_count_);
-    for (; iter->is_valid() && sample->count() < max_train_sample_count_;
-         iter->next()) {
-      sample->emplace(iter->key(), iter->data());
-    }
-    if (sample->count() != max_train_sample_count_) {
-      LOG_ERROR("Training holder ended before the requested sample count");
-      return IndexError_Runtime;
-    }
-    training_holder = std::move(sample);
-  }
+  // Keep the legacy prefix and sample order without materializing a second
+  // training holder. The quantizer copies only its selected training rows.
+  IndexHolder::Pointer training_holder = std::make_shared<PrefixIndexHolder>(
+      holder_, max_train_sample_count_, build_meta_);
   ret = quantizer_->train(std::move(training_holder));
   if (ret != 0) {
     LOG_ERROR("PqInt8Quantizer train failed, ret=%d", ret);
@@ -463,16 +447,21 @@ int DiskAnnBuilder::generate_quantized_data(IndexThreads::Pointer threads) {
   const size_t elem_size = build_meta_.element_size();
   const size_t thread_count =
       threads ? std::max<size_t>(1, threads->count()) : 1;
-  constexpr size_t kEncodeBatchSize = 65536;
-  std::vector<uint8_t> block(kEncodeBatchSize * elem_size);
+  constexpr size_t kEncodeMemoryBudget = 4u * 1024u * 1024u;
+  const size_t batch_size =
+      std::min(num_vecs, std::max<size_t>(1, kEncodeMemoryBudget / elem_size));
+  std::vector<uint8_t> block(batch_size * elem_size);
 
   size_t id = 0;
   while (id < num_vecs) {
     size_t cur = 0;
-    for (; cur < kEncodeBatchSize && id + cur < num_vecs && iter->is_valid();
+    for (; cur < batch_size && id + cur < num_vecs && iter->is_valid();
          iter->next(), ++cur) {
       // The quantizer widens FP16 input internally — pass raw data directly.
-      std::memcpy(block.data() + cur * elem_size, iter->data(), elem_size);
+      const void *data = iter->data();
+      if (!data) return IndexError_ReadData;
+      if (iter->key() != entity_.get_key(id + cur)) return IndexError_Mismatch;
+      std::memcpy(block.data() + cur * elem_size, data, elem_size);
     }
     if (cur == 0) {
       break;
@@ -504,7 +493,7 @@ int DiskAnnBuilder::generate_quantized_data(IndexThreads::Pointer threads) {
     id += cur;
   }
 
-  if (id != num_vecs) {
+  if (id != num_vecs || iter->is_valid()) {
     LOG_ERROR("PQ generate: iterated %zu vectors, expected %zu", id, num_vecs);
     return IndexError_Runtime;
   }
@@ -649,6 +638,7 @@ int DiskAnnBuilder::train(IndexThreads::Pointer threads,
     return IndexError_InvalidArgument;
   }
 
+  if (!holder->is_matched(raw_meta_)) return IndexError_Mismatch;
   LOG_INFO("Begin DiskAnnBuilder::train");
 
   auto start_time = ailego::Monotime::MilliSeconds();
@@ -732,15 +722,21 @@ int DiskAnnBuilder::build(IndexThreads::Pointer threads,
     return IndexError_Runtime;
   }
 
+  if (!holder->is_matched(raw_meta_) || !holder->multipass() ||
+      holder->count() > std::numeric_limits<uint32_t>::max()) {
+    return IndexError_Mismatch;
+  }
   if (ailego_unlikely(holder->count() == 0)) {
     LOG_ERROR("Holder is empty");
     return Ind
```

**File**: `src/core/algorithm/diskann/diskann_builder_entity.cc` (modified, +55/-31)
```diff
@@ -15,6 +15,8 @@
 #include "diskann_builder_entity.h"
 #include <iostream>
 #include <numeric>
+#include <ailego/pattern/defer.h>
+#include "utility/ordinal_access_holder.h"
 #include "diskann_algorithm.h"
 #include "diskann_util.h"
 
@@ -31,13 +33,13 @@ void DiskAnnBuilderEntity::clear() {
   neighbor_size_ = 0;
   mem_index_file_.clear();
   index_path_prefix_.clear();
-  vectors_buffer_.clear();
-  keys_buffer_.clear();
-  neighbors_buffer_.clear();
+  release_vectors();
+  std::string().swap(keys_buffer_);
+  std::string().swap(neighbors_buffer_);
   entrypoints_.clear();
   meta_.clear();
-  pq_quantizer_meta_buffer_.clear();
-  block_compressed_data_.clear();
+  std::string().swap(pq_quantizer_meta_buffer_);
+  std::vector<uint8_t>().swap(block_compressed_data_);
   meta_header_.clear();
   pq_meta_.clear();
 }
@@ -62,27 +64,28 @@ int DiskAnnBuilderEntity::init(const IndexMeta &meta, uint32_t max_degree,
   return 0;
 }
 
+void DiskAnnBuilderEntity::release_vectors() {
+  std::string().swap(vectors_buffer_);
+}
+
 int DiskAnnBuilderEntity::reserve_space(uint32_t docs) {
   vectors_buffer_.reserve(meta_.element_size() * docs);
   keys_buffer_.reserve(sizeof(diskann_key_t) * docs);
-  neighbors_buffer_.reserve(neighbor_size_ * docs);
+  neighbors_buffer_.reserve(static_cast<size_t>(neighbor_size_) * docs);
 
   return 0;
 }
 
 int DiskAnnBuilderEntity::add_vector(diskann_key_t key, const void *vec) {
+  if (!vec) return IndexError_ReadData;
   vectors_buffer_.append(reinterpret_cast<const char *>(vec),
                          meta_.element_size());
   keys_buffer_.append(reinterpret_cast<const char *>(&key), sizeof(key));
 
   uint32_t neighbor_cnt = 0;
-  // Parentheses select the size/value constructor.
-  std::vector<diskann_id_t> neighbor(max_build_degree_, 0);
-
   neighbors_buffer_.append(reinterpret_cast<const char *>(&neighbor_cnt),
                            sizeof(uint32_t));
-  neighbors_buffer_.append(reinterpret_cast<const char *>(neighbor.data()),
-                           sizeof(diskann_id_t) * max_build_degree_);
+  neighbors_buffer_.append(sizeof(diskann_id_t) * max_build_degree_, '\0');
 
   (*mutable_doc_cnt())++;
 
@@ -375,6 +378,10 @@ int DiskAnnBuilderEntity::dump_entrypoint_segment(
 
 int DiskAnnBuilderEntity::dump(IndexHolder::Pointer holder, IndexMeta &meta,
                                const IndexDumper::Pointer &dumper) {
+  if (!holder || holder->count() != this->doc_cnt() ||
+      holder->element_size() != meta_.element_size()) {
+    return IndexError_Mismatch;
+  }
   uint64_t doc_cnt = holder->count();
   uint64_t max_node_size =
       (uint64_t)max_observed_degree_ * sizeof(diskann_id_t) + sizeof(uint32_t) +
@@ -410,11 +417,40 @@ int DiskAnnBuilderEntity::dump(IndexHolder::Pointer holder, IndexMeta &meta,
   size_t len = 0;
 
   // no need to write first sector
-  auto iter = holder->create_iterator();
-  if (!iter) {
-    LOG_ERROR("Create iterator for holder failed");
-    return IndexError_Runtime;
+  OrdinalAccessHolder::Reader::Pointer reader;
+  if (auto *source = dynamic_cast<OrdinalAccessHolder *>(holder.get())) {
+    ret = source->create_ordinal_reader(&reader);
+    if (ret != 0 && ret != IndexError_NotImplemented) return ret;
+    if (ret == 0 && !reader) return IndexError_Runtime;
   }
+  auto iter = reader ? nullptr : holder->create_iterator();
+  if (!reader && !iter) return IndexError_Runtime;
+  AILEGO_DEFER([&]() {
+    if (reader) reader->reset();
+  });
+  auto read_vector = [&](size_t id, void *output) -> int {
+    uint64_t key = 0;
+    const void *data = nullptr;
+    if (reader) {
+      int result = reader->read(id, &key, &data);
+      if (result != 0) return result;
+    } else {
+      if (!iter->is_valid()) return IndexError_Mismatch;
+      key = iter->key();
+      data = iter->data();
+      // A deferred read failure can return a non-null placeholder and
+      // invalidate the iterator. Reject it before copying, even on the last
+      // vect
```

**File**: `src/core/algorithm/diskann/diskann_builder_entity.h` (modified, +4/-0)
```diff
@@ -64,6 +64,10 @@ class DiskAnnBuilderEntity : public DiskAnnEntity {
 
   int reserve_space(uint32_t docs);
 
+  // Graph construction is the only consumer of these vectors. PQ encoding
+  // and dump read the retained source holder instead.
+  void release_vectors();
+
   std::string &pq_quantizer_meta_buffer() {
     return pq_quantizer_meta_buffer_;
   }
```

**File**: `src/core/interface/indexes/diskann_index.cc` (modified, +89/-74)
```diff
@@ -15,6 +15,7 @@
 #include <memory>
 #include <mutex>
 #include <string>
+#include <ailego/pattern/defer.h>
 #include <zvec/core/interface/index.h>
 #if DISKANN_SUPPORTED
 #include "algorithm/diskann/diskann_params.h"
@@ -199,8 +200,8 @@ int DiskAnnIndex::generate_holder() {
 }
 
 int DiskAnnIndex::add(const VectorData &vector, uint32_t doc_id) {
-  if (is_trained_) {
-    LOG_ERROR("this diskann index is trained");
+  if (is_trained_ || build_stage_ != BuildStage::kCollecting) {
+    LOG_ERROR("this diskann index is trained or has a pending build");
     return core::IndexError_Runtime;
   }
   if (!std::holds_alternative<DenseVector>(vector.vector)) {
@@ -214,61 +215,89 @@ int DiskAnnIndex::add(const VectorData &vector, uint32_t doc_id) {
 
   std::lock_guard<std::mutex> lock(mutex_);
   if (doc_cache_.size() <= doc_id) {
-    std::string fake_data(
-        input_vector_meta_.dimension() * input_vector_meta_.unit_size(), 0);
-    doc_cache_.resize(doc_id + 1, std::make_pair(kInvalidKey, fake_data));
+    doc_cache_.resize(doc_id + 1, std::make_pair(kInvalidKey, std::string{}));
   }
-  doc_cache_[doc_id] = std::make_pair(doc_id, out_vector_buffer);
+  doc_cache_[doc_id] = std::make_pair(doc_id, std::move(out_vector_buffer));
   return 0;
 }
 
 int DiskAnnIndex::train() {
-  int ret = generate_holder();
-  if (ret != 0) {
-    LOG_ERROR("Failed to generate holder, err: %s",
-              core::IndexError::What(ret));
-    return ret;
-  }
-  ret = builder_->train(holder_);
-  if (ret != 0) {
-    LOG_ERROR("Failed to train builder, err: %s", core::IndexError::What(ret));
-    return ret;
+  if (is_trained_) return 0;
+  if (build_stage_ == BuildStage::kCollecting) {
+    int ret = reset_builder();
+    if (ret != 0) return ret;
+    ret = generate_holder();
+    if (ret != 0) return ret;
+    ret = builder_->train(holder_);
+    if (ret != 0) return ret;
+    build_stage_ = BuildStage::kTrained;
   }
-  ret = builder_->build(holder_);
-  if (ret != 0) {
-    LOG_ERROR("Failed to build index, err: %s", core::IndexError::What(ret));
-    return ret;
-  }
-  auto dumper = core::IndexFactory::CreateDumper("FileDumper");
-  if (dumper == nullptr) {
-    LOG_ERROR("Failed to create FileDumper");
-    return core::IndexError_Runtime;
+  if (build_stage_ == BuildStage::kTrained) {
+    int ret = builder_->build(holder_);
+    if (ret != 0) {
+      // A partial graph cannot be resumed. Recreate it on the next attempt
+      // from the retained input cache.
+      build_stage_ = BuildStage::kCollecting;
+      return ret;
+    }
+    build_stage_ = BuildStage::kBuilt;
   }
+  return dump_and_open();
+}
 
-  ret = dumper->create(file_path_);
-  if (ret != 0) {
-    LOG_ERROR("Failed to create dumper, path: %s, err: %s", file_path_.c_str(),
-              core::IndexError::What(ret));
-    return core::IndexError_Runtime;
-  }
-  ret = builder_->dump(dumper);
-  if (ret != 0) {
-    LOG_ERROR("Failed to dump index, path: %s, err: %s", file_path_.c_str(),
-              core::IndexError::What(ret));
-    return core::IndexError_Runtime;
-  }
-  dumper->close();
-  ret = storage_->open(file_path_, false);
-  if (ret != 0) {
-    LOG_ERROR("Failed to open storage, path: %s, err: %s", file_path_.c_str(),
-              core::IndexError::What(ret));
-    return core::IndexError_Runtime;
+int DiskAnnIndex::reset_builder() {
+  auto next = core::IndexFactory::CreateBuilder("DiskAnnBuilder");
+  if (!next) return core::IndexError_NoExist;
+  int ret = next->init(converter_ ? converter_->meta() : proxima_index_meta_,
+                       proxima_index_params_);
+  if (ret != 0) return ret;
+  builder_ = std::move(next);
+  return 0;
+}
+
+int DiskAnnIndex::dump_and_open() {
+  if (build_stage_ == BuildStage::kBuilt) {
+    auto dumper = core::IndexFactory::CreateDumper("FileDumper");
+    if (!dumper) return core::IndexError_NoExist;
+    int ret = dumper->create(file_path_);
+    if (ret != 0) return ret;
+    AILEGO_DEFER([&]() {
+     
```

**File**: `src/core/mixed_reducer/mixed_streamer_reducer.cc` (modified, +3/-2)
```diff
@@ -693,10 +693,11 @@ int MixedStreamerReducer::reduce_with_builder(const IndexFilter &filter) {
 
   AILEGO_DEFER([&]() { holder->set_stop_flag(nullptr); });
   IndexHolder::Pointer target_holder = holder;
-  // Only IVF has been adapted to propagate source read failures during dump.
+  // IVF and DiskAnn propagate source read failures during dump.
   // Other builders retain an owned multipass snapshot, as before, so their
   // dump paths never depend on a source provider or its deferred error state.
-  if (target_builder_->name() != "IVFBuilder") {
+  if (target_builder_->name() != "IVFBuilder" &&
+      target_builder_->name() != "DiskAnnBuilder") {
     switch (holder->data_type()) {
       case IndexMeta::DataType::DT_FP32:
         ret = MaterializeMergedInput<IndexMeta::DataType::DT_FP32, float>(
```

---

### Incident Patch 4: `1ab7975d` (2026-09-20)
**Commit Message**: fix(fts): persist sealed postings before dropping side column families (#759)

**File**: `src/db/index/column/fts_column/fts_column_indexer.cc` (modified, +63/-36)
```diff
@@ -22,6 +22,7 @@
 #include <rocksdb/write_batch.h>
 #include <zvec/ailego/logger/logger.h>
 #include <zvec/db/status.h>
+#include "db/common/constants.h"
 #include "db/common/typedef.h"
 #include "iterator/fts_candidate_iterator.h"
 #include "iterator/fts_conjunction_iterator.h"
@@ -611,6 +612,11 @@ Result<void> FtsColumnIndexer::insert(uint64_t seg_doc_id,
         "FtsColumnIndexer::insert: not opened. field=", field_name_));
   }
 
+  if (cf_dropped_.load(std::memory_order_acquire)) {
+    return tl::make_unexpected(Status::InternalError(
+        "FtsColumnIndexer::insert: field is sealed. field=", field_name_));
+  }
+
   // Tokenize
   std::vector<Token> tokens = tokenizer_pipeline_->process(text);
   const uint32_t doc_len = static_cast<uint32_t>(tokens.size());
@@ -731,13 +737,46 @@ Result<void> FtsColumnIndexer::flush() {
 // ============================================================
 
 Result<void> FtsColumnIndexer::convert_postings_to_bitpacked() {
-  // safe access check
-
-  if (!postings_cf_ || !term_freq_cf_ || !doc_len_cf_ || !scorer_) {
+  if (!ctx_) {
+    return tl::make_unexpected(Status::InternalError(
+        "FtsColumnIndexer: not opened. field=", field_name_));
+  }
+  // Read actual CF handles: a previous failed seal may have reset the reader's
+  // side pointers while leaving the column families available for retry.
+  auto *term_freq_cf = term_freq_cf_.load();
+  auto *doc_len_cf = doc_len_cf_.load();
+  if (!term_freq_cf) term_freq_cf = ctx_->get_cf(field_name_ + kFtsTfSuffix);
+  if (!doc_len_cf) doc_len_cf = ctx_->get_cf(field_name_ + kFtsDocLenSuffix);
+  if (!postings_cf_ || !stat_cf_ || !scorer_) {
     return tl::make_unexpected(Status::InternalError(
         "FtsColumnIndexer::convert_postings_to_bitpacked: not opened. field=",
         field_name_));
   }
+  if (!term_freq_cf) {
+    // $TF is dropped first, after postings and statistics are durable.
+    // Older versions did not guarantee this ordering; reject leftover Roaring
+    // postings instead of accepting an already damaged index as sealed.
+    std::unique_ptr<rocksdb::Iterator> iter(
+        ctx_->db_->NewIterator(ctx_->read_opts_, postings_cf_));
+    for (iter->SeekToFirst(); iter->Valid(); iter->Next()) {
+      if (!BitPackedPostingList::is_bitpacked_format(iter->value().data(),
+                                                     iter->value().size())) {
+        return tl::make_unexpected(Status::InternalError(
+            "FtsColumnIndexer: missing $TF with non-BitPacked postings. field=",
+            field_name_));
+      }
+    }
+    if (!iter->status().ok()) {
+      return tl::make_unexpected(
+          Status::InternalError(iter->status().ToString()));
+    }
+    return {};
+  }
+  if (!doc_len_cf) {
+    return tl::make_unexpected(Status::InternalError(
+        "FtsColumnIndexer: missing $DOC_LEN before conversion. field=",
+        field_name_));
+  }
 
   // ---------------------------------------------------------------
   // 1) Load doc_len_cf into an in-memory vector indexed by local doc_id.
@@ -747,7 +786,7 @@ Result<void> FtsColumnIndexer::convert_postings_to_bitpacked() {
   std::vector<uint32_t> doc_lens;
   {
     std::unique_ptr<rocksdb::Iterator> iter(
-        ctx_->db_->NewIterator(ctx_->read_opts_, doc_len_cf_.load()));
+        ctx_->db_->NewIterator(ctx_->read_opts_, doc_len_cf));
     iter->SeekToFirst();
     while (iter->Valid()) {
       const std::string key = iter->key().ToString();
@@ -822,7 +861,7 @@ Result<void> FtsColumnIndexer::convert_postings_to_bitpacked() {
 
   {
     std::unique_ptr<rocksdb::Iterator> iter(
-        ctx_->db_->NewIterator(ctx_->read_opts_, term_freq_cf_.load()));
+        ctx_->db_->NewIterator(ctx_->read_opts_, term_freq_cf));
     iter->SeekToFirst();
     while (iter->Valid()) {
       const std::string key = iter->key().ToString();
@@ -861,37 +900,25 @@ Result<void> FtsColumnIndexer::convert_postings_to_bitpacked() {
     return ret;
   }
 
-  // -
```

**File**: `src/db/index/column/fts_column/fts_column_indexer.h` (modified, +8/-6)
```diff
@@ -147,17 +147,19 @@ class FtsColumnIndexer {
   Result<void> flush();
 
   /*! Convert all Roaring-format postings in postings_cf to BitPacked format
-   *  with inline tf/doc_len/max_score payloads, then DeleteRange-clear the
-   *  $TF, $DOC_LEN, and $MAX_TF CFs.
+   *  with inline tf/doc_len/max_score payloads and synchronously flush them
+   *  along with segment statistics. Preserve auxiliary data until CF removal.
    *
    *  Called by MutableSegment::dump_fts_column_indexers() right before the
-   *  SST dump.  After all indexers finish conversion, MutableSegment drops
-   *  the $TF/$MAX_TF/$DOC_LEN CFs entirely (via reset_side_cfs() +
-   *  RocksdbStore::drop_column_family()), so the dumped immutable segment
+   *  SST dump. After conversion, FtsIndexer drops the $TF/$MAX_TF/$DOC_LEN
+   *  CFs entirely (via reset_side_cfs() + RocksdbContext::drop_cf()),
+   *  so the dumped immutable segment
    *  no longer contains these CFs at all.
    *
    *  Idempotent: terms whose postings are already in BitPacked format are
-   *  skipped, so re-running after a partial-failure dump is safe.
+   *  skipped, so re-running after a partial-failure dump is safe. $TF is
+   *  dropped first after conversion is durable, allowing cleanup to resume
+   *  after reopening the index.
    *
    *  Must be called after flush() so that the BM25 scorer used by encode()
    *  sees the up-to-date segment statistics.
```

**File**: `src/db/index/column/fts_column/fts_indexer.cc` (modified, +18/-7)
```diff
@@ -104,6 +104,10 @@ Status FtsIndexer::open(const FieldSchemaPtrList &fts_fields, bool create,
                                    ret.error().message());
     }
 
+    if (!term_freq_cf) {
+      // $TF is removed first when sealing; this field cannot accept writes.
+      indexer->reset_side_cfs();
+    }
     indexers_[name] = indexer;
   }
 
@@ -288,10 +292,13 @@ Status FtsIndexer::seal(const std::string &field_name) {
                                  field_name, " ", ret.error().message());
   }
 
+  // Drop $TF first: its absence identifies completed conversion on recovery.
   indexer->reset_side_cfs();
-  fts_ctx_->drop_cf(field_name + kFtsTfSuffix);
-  fts_ctx_->drop_cf(field_name + kFtsMaxTfSuffix);
-  fts_ctx_->drop_cf(field_name + kFtsDocLenSuffix);
+  for (const auto &suffix : {kFtsTfSuffix, kFtsMaxTfSuffix, kFtsDocLenSuffix}) {
+    if (auto status = fts_ctx_->drop_cf(field_name + suffix); !status.ok()) {
+      return status;
+    }
+  }
 
   return Status::OK();
 }
@@ -315,14 +322,18 @@ Status FtsIndexer::seal_all() {
     }
   }
 
-  // Reset side CFs and drop them.
+  // Reset side CFs and drop them. For each field, $TF must be dropped first
+  // and any failure must stop cleanup, preserving the recovery invariant.
   for (const auto &[name, indexer] : indexers_) {
     indexer->reset_side_cfs();
   }
   for (const auto &[name, _] : indexers_) {
-    fts_ctx_->drop_cf(name + kFtsTfSuffix);
-    fts_ctx_->drop_cf(name + kFtsMaxTfSuffix);
-    fts_ctx_->drop_cf(name + kFtsDocLenSuffix);
+    for (const auto &suffix :
+         {kFtsTfSuffix, kFtsMaxTfSuffix, kFtsDocLenSuffix}) {
+      if (auto status = fts_ctx_->drop_cf(name + suffix); !status.ok()) {
+        return status;
+      }
+    }
   }
 
   return Status::OK();
```

**File**: `src/db/index/column/fts_column/fts_indexer.h` (modified, +2/-0)
```diff
@@ -82,6 +82,8 @@ class FtsIndexer {
   }
 
  private:
+  friend class FtsSealRetryTest;
+
   Status open(const FieldSchemaPtrList &fts_fields, bool create,
               bool read_only);
 
```

**File**: `tests/db/index/column/fts_column/fts_column_indexer_test.cc` (modified, +385/-8)
```diff
@@ -14,21 +14,25 @@
 
 #include "db/index/column/fts_column/fts_column_indexer.h"
 #include <algorithm>
+#include <cstdlib>
 #include <fstream>
 #include <memory>
 #include <string>
 #include <unordered_map>
 #include <unordered_set>
 #include <vector>
 #include <gtest/gtest.h>
+#include <rocksdb/utilities/stackable_db.h>
 #include <zvec/db/config.h>
 #include <zvec/db/index_params.h>
 #include "db/common/file_helper.h"
 #include "db/index/common/index_filter.h"
 // FtsQueryParams defined below
 #include "db/index/column/fts_column/fts_ast_rewriter.h"
+#include "db/index/column/fts_column/fts_indexer.h"
 #include "db/index/column/fts_column/fts_rocksdb_merge.h"
 #include "db/index/column/fts_column/parser/fts_query_parser.h"
+#include "db/index/column/fts_column/posting/bitpacked_posting_list.h"
 #include "db/index/column/fts_column/tokenizer/tokenizer_factory.h"
 // meta.h not needed in zvec
 #include "db/common/constants.h"
@@ -1147,10 +1151,9 @@ TEST_F(FtsColumnIndexerTest, ConvertPostingsToBitpackedBasic) {
   EXPECT_EQ(std::get<2>(decoded[2]), 3u);
 }
 
-// After conversion the $TF / $DOC_LEN / $MAX_TF side CFs must be EMPTY: the
-// indexer DeleteRange's them once their content has been inlined into the
-// BitPacked posting list.  MutableSegment then drops the CFs entirely.
-TEST_F(FtsColumnIndexerTest, ConvertPostingsToBitpackedClearsSideCfs) {
+// Conversion preserves $TF / $DOC_LEN / $MAX_TF until FtsIndexer drops them.
+// A failed first drop must leave the inputs intact for another conversion.
+TEST_F(FtsColumnIndexerTest, ConvertPostingsToBitpackedPreservesSideCfs) {
   auto indexer = make_indexer("content");
   for (uint64_t doc_id = 0; doc_id < 5; ++doc_id) {
     EXPECT_TRUE(indexer->insert(doc_id, "alpha beta gamma").has_value());
@@ -1164,10 +1167,10 @@ TEST_F(FtsColumnIndexerTest, ConvertPostingsToBitpackedClearsSideCfs) {
 
   EXPECT_TRUE(indexer->convert_postings_to_bitpacked().has_value());
 
-  // Side CFs must be empty after conversion (DeleteRange'd by the indexer).
-  EXPECT_EQ(count_cf_entries(db_, term_freq_cf_), 0u);
-  EXPECT_EQ(count_cf_entries(db_, doc_len_cf_), 0u);
-  EXPECT_EQ(count_cf_entries(db_, max_tf_cf_), 0u);
+  // All auxiliary entries remain available until explicit CF removal.
+  EXPECT_EQ(count_cf_entries(db_, term_freq_cf_), 15u);
+  EXPECT_EQ(count_cf_entries(db_, doc_len_cf_), 5u);
+  EXPECT_EQ(count_cf_entries(db_, max_tf_cf_), 3u);
 
   // After reset_side_cfs, search should still work (BitPacked path).
   indexer->reset_side_cfs();
@@ -1918,3 +1921,377 @@ TEST_F(FtsStemmerIndexerTest, StemmerNoMatchAfterStemming) {
   EXPECT_TRUE(search_ok(*indexer, "nonexistent", 10, &results, pipeline));
   EXPECT_TRUE(results.empty());
 }
+
+#if GTEST_HAS_DEATH_TEST
+
+class FtsSealRecoveryDeathTest : public ::testing::TestWithParam<bool> {
+ protected:
+  void SetUp() override {
+    path_ = "./test_fts_seal_recovery_" + std::to_string(GetParam());
+    FileHelper::RemoveDirectory(path_);
+  }
+
+  void TearDown() override {
+    FileHelper::RemoveDirectory(path_);
+  }
+
+  std::string path_;
+};
+
+TEST_P(FtsSealRecoveryDeathTest, PostingsSurviveExitWithoutClose) {
+  ::testing::FLAGS_gtest_death_test_style = "threadsafe";
+  const bool seal_all = GetParam();
+  const std::vector<std::string> names =
+      seal_all ? std::vector<std::string>{"text", "title"}
+               : std::vector<std::string>{"text"};
+  FieldSchemaPtrList fields;
+  std::unordered_map<std::string, std::shared_ptr<rocksdb::MergeOperator>>
+      merge_ops;
+  for (const auto &name : names) {
+    auto params = std::make_shared<zvec::FtsIndexParams>("whitespace");
+    fields.push_back(make_test_field_meta(name, params));
+    merge_ops[name] = std::make_shared<FtsPostingsMerge>();
+  }
+
+  // Re-exec the child instead of forking an initialized RocksDB thread pool.
+  // Exit after sealing, without destructors that would hide missing flushes.
+  ASSERT_EXIT(
+      {
+        auto indexer = FtsIndexer::CreateAn
```

---

### Incident Patch 5: `d2f1891f` (2026-09-18)
**Commit Message**: chore: enable readability-identifier-naming check and fix violations (#764)

**File**: `.clang-tidy` (modified, +48/-1)
```diff
@@ -7,7 +7,54 @@ Checks: >
   modernize-use-equals-default,
   modernize-use-equals-delete,
   modernize-redundant-void-arg,
+  readability-identifier-naming,
 WarningsAsErrors: "*"
-HeaderFilterRegex: "^(src|tests|tools)/(?!db/sqlengine/antlr/gen/|db/index/column/fts_column/gen/|include/zvec/ailego/encoding/json/mod_json\\.h).*"
+HeaderFilterRegex: "(^|/)(src|tests|tools)/"
 FormatStyle: none
 SystemHeaders: false
+CheckOptions:
+  # Type-like identifiers use CamelCase (Google style). STL-compatible
+  # container aliases (iterator, value_type, *_t ...) are exempted.
+  readability-identifier-naming.NamespaceCase: lower_case
+  readability-identifier-naming.ClassCase: CamelCase
+  readability-identifier-naming.ClassIgnoredRegexp: '(const_)?(iterator|reverse_iterator)'
+  readability-identifier-naming.StructCase: CamelCase
+  readability-identifier-naming.StructIgnoredRegexp: '(const_)?(iterator|reverse_iterator)'
+  readability-identifier-naming.UnionCase: CamelCase
+  readability-identifier-naming.EnumCase: CamelCase
+  readability-identifier-naming.TypedefCase: CamelCase
+  readability-identifier-naming.TypedefIgnoredRegexp: '(_.*|[a-z][a-z0-9_]*|.*_t|.*_type|(const_)?(iterator|reverse_iterator|pointer|reference))'
+  readability-identifier-naming.TypeAliasCase: CamelCase
+  readability-identifier-naming.TypeAliasIgnoredRegexp: '(_.*|[a-z][a-z0-9_]*|.*_t|.*_type|(const_)?(iterator|reverse_iterator|pointer|reference))'
+  # Member functions use snake_case. Static/free/global functions may use
+  # snake_case or CamelCase. A leading underscore (private-method convention)
+  # or trailing underscore (keyword avoidance, e.g. delete_) is allowed.
+  readability-identifier-naming.MethodCase: lower_case
+  readability-identifier-naming.MethodIgnoredRegexp: '_*[a-z][a-z0-9_]*'
+  readability-identifier-naming.ClassMethodCase: lower_case
+  readability-identifier-naming.ClassMethodIgnoredRegexp: '(_*[a-z][a-z0-9_]*|[A-Z][A-Za-z0-9]*)'
+  readability-identifier-naming.FunctionCase: lower_case
+  readability-identifier-naming.FunctionIgnoredRegexp: '(_*[a-z][a-z0-9_]*|[A-Z][A-Za-z0-9]*)'
+  readability-identifier-naming.GlobalFunctionCase: lower_case
+  readability-identifier-naming.GlobalFunctionIgnoredRegexp: '(_*[a-z][a-z0-9_]*|[A-Z][A-Za-z0-9]*)'
+  # Data members use snake_case; a trailing underscore is allowed but not required.
+  readability-identifier-naming.MemberCase: lower_case
+  readability-identifier-naming.MemberIgnoredRegexp: '_*[a-z][a-z0-9]*(_[a-z0-9]+)*_*'
+  readability-identifier-naming.ConstantMemberCase: lower_case
+  readability-identifier-naming.ConstantMemberIgnoredRegexp: '_*[a-z][a-z0-9]*(_[a-z0-9]+)*_*'
+  # Static data members follow the same snake_case rule as non-static members.
+  readability-identifier-naming.ClassMemberCase: lower_case
+  readability-identifier-naming.ClassMemberIgnoredRegexp: '_*[a-z][a-z0-9]*(_[a-z0-9]+)*_*'
+  # Local variables and parameters use snake_case.
+  readability-identifier-naming.LocalVariableCase: lower_case
+  readability-identifier-naming.ParameterCase: lower_case
+  # Constants keep the existing mixed conventions (kCamelCase / UPPER_CASE /
+  # snake_case) and are intentionally not enforced.
+  readability-identifier-naming.ConstantCase: aNy_CasE
+  readability-identifier-naming.LocalConstantCase: aNy_CasE
+  readability-identifier-naming.StaticConstantCase: aNy_CasE
+  readability-identifier-naming.ClassConstantCase: aNy_CasE
+  readability-identifier-naming.GlobalConstantCase: aNy_CasE
+  readability-identifier-naming.ConstexprVariableCase: aNy_CasE
+  readability-identifier-naming.GlobalVariableCase: aNy_CasE
+  readability-identifier-naming.StaticVariableCase: aNy_CasE
```

**File**: `.github/workflows/clang_tidy.yml` (modified, +29/-5)
```diff
@@ -91,7 +91,17 @@ jobs:
           selected = []
           skipped = []
 
+          # Auto-generated code is exempt from clang-tidy and must not be edited.
+          generated_dir_markers = (
+              "src/db/sqlengine/antlr/gen/",
+              "src/db/index/column/fts_column/gen/",
+          )
+
           for rel_path in changed:
+              norm_rel = rel_path.replace(os.sep, "/")
+              if any(marker in norm_rel for marker in generated_dir_markers):
+                  skipped.append(f"{rel_path} (generated file, exempt from clang-tidy)")
+                  continue
               abs_path = os.path.normpath(str((cwd / rel_path).resolve()))
               if abs_path in compile_entries:
                   selected.append(rel_path)
@@ -176,12 +186,26 @@ jobs:
           failed=0
           for f in "$log_dir"/*.log; do
             [ -e "$f" ] || break
-            failed=1
             src=$(head -1 "$f")
-            echo ""
-            echo "::group::clang-tidy errors: $src"
-            tail -n +2 "$f"
-            echo "::endgroup::"
+            # Diagnostics originating in generated headers (antlr/gen,
+            # fts_column/gen) can leak in via #include from non-generated main
+            # files. Those files are exempt and must not be edited, so drop such
+            # blocks; a log only counts as a failure if real diagnostics remain.
+            body=$(tail -n +2 "$f" | awk '
+              /^[^[:space:]].*:[0-9]+:[0-9]+: (warning|error|note):/ {
+                path = $0
+                sub(/:[0-9]+:[0-9]+:.*/, "", path)
+                skip = (path ~ /(antlr\/gen\/|fts_column\/gen\/)/) ? 1 : 0
+              }
+              { if (!skip) print }
+            ')
+            if printf '%s\n' "$body" | grep -qE ': (warning|error):'; then
+              failed=1
+              echo ""
+              echo "::group::clang-tidy errors: $src"
+              printf '%s\n' "$body"
+              echo "::endgroup::"
+            fi
           done
 
           rm -rf "$log_dir"
```

**File**: `src/ailego/algorithm/integer_quantizer.cc` (modified, +16/-16)
```diff
@@ -129,7 +129,7 @@ static inline void ExpandCandidateDistribution(
  */
 static inline size_t ComputeThreshold(const std::vector<uint32_t> &hist,
                                       const size_t target_bins) {
-  std::vector<float> P_distribution(hist.size());
+  std::vector<float> p_distribution(hist.size());
   size_t zero_point_index = hist.size() / 2;
 
   size_t start_bin = target_bins / 2;
@@ -147,19 +147,19 @@ static inline size_t ComputeThreshold(const std::vector<uint32_t> &hist,
   //! for each zero-axised quantization range: [-threshold, threshold], search
   //! the best solution
   for (size_t threshold = start_bin; threshold <= end_bin; ++threshold) {
-    P_distribution.resize(threshold * 2);
+    p_distribution.resize(threshold * 2);
     auto p_hist = &hist[zero_point_index - threshold];
-    for (size_t i = 0; i != P_distribution.size(); ++i) {
-      P_distribution[i] = static_cast<float>(p_hist[i]);
+    for (size_t i = 0; i != p_distribution.size(); ++i) {
+      p_distribution[i] = static_cast<float>(p_hist[i]);
     }
 
     negative_outliers_count -= hist[zero_point_index - threshold];
     positive_outliers_count -= hist[zero_point_index + threshold - 1];
-    P_distribution[0] += negative_outliers_count;
-    P_distribution[P_distribution.size() - 1] += positive_outliers_count;
+    p_distribution[0] += negative_outliers_count;
+    p_distribution[p_distribution.size() - 1] += positive_outliers_count;
 
     //! Quantize the bins in range [-threshold, threshold] to target_bins
-    std::vector<float> Q_distribution(target_bins, 0);
+    std::vector<float> q_distribution(target_bins, 0);
     float merged_cnt = static_cast<float>(threshold * 2) / target_bins;
     size_t left_boundary = zero_point_index - threshold;
     for (size_t i = 0; i < target_bins; ++i) {
@@ -168,28 +168,28 @@ static inline size_t ComputeThreshold(const std::vector<uint32_t> &hist,
       const size_t start_ceil = static_cast<size_t>(std::ceil(start));
       const size_t end_floor = static_cast<size_t>(std::floor(end));
       if (left_boundary + start_ceil > 0) {
-        Q_distribution[i] +=
+        q_distribution[i] +=
             ((float)start_ceil - start) * hist[left_boundary + start_ceil - 1];
       }
       if (left_boundary + end_floor < hist.size()) {
-        Q_distribution[i] +=
+        q_distribution[i] +=
             (end - (float)end_floor) * hist[left_boundary + end_floor];
       }
 
       for (size_t j = start_ceil; j < end_floor; j++) {
-        Q_distribution[i] += hist[left_boundary + j];
+        q_distribution[i] += hist[left_boundary + j];
       }
     }
-    std::vector<float> Q_expand_distribution;
-    ExpandCandidateDistribution(hist, Q_distribution, threshold,
-                                &Q_expand_distribution);
+    std::vector<float> q_expand_distribution;
+    ExpandCandidateDistribution(hist, q_distribution, threshold,
+                                &q_expand_distribution);
 
     //! Compute Kullback-Leibler Divergence, normalize the smooth the data
     //! first. Ref: http://hanj.cs.illinois.edu/cs412/bk3/KL-divergence.pdf
-    MakeSmooth(P_distribution);
-    MakeSmooth(Q_expand_distribution);
+    MakeSmooth(p_distribution);
+    MakeSmooth(q_expand_distribution);
     double divergence =
-        ComputeKlDivergence(P_distribution, Q_expand_distribution);
+        ComputeKlDivergence(p_distribution, q_expand_distribution);
 
     if (divergence < min_divergence) {
       min_divergence = divergence;
```

**File**: `src/ailego/encoding/json/mod_json.c` (modified, +4/-0)
```diff
@@ -12,6 +12,8 @@
 // See the License for the specific language governing permissions and
 // limitations under the License.
 
+// NOLINTBEGIN
+
 #include <float.h>
 #include <stdio.h>
 #include <stdlib.h>
@@ -3589,3 +3591,5 @@ mod_json_string_t *mod_json_dump(mod_json_value_t *val) {
   }
   return str;
 }
+
+// NOLINTEND
```

**File**: `src/ailego/internal/cpu_features.h` (modified, +3/-0)
```diff
@@ -21,6 +21,8 @@ namespace internal {
 
 /*! Cpu Features
  */
+// NOLINTBEGIN(readability-identifier-naming): identifiers mirror CPUID feature
+// mnemonics (SSE4_1, AVX512_VNNI, L1_ECX ...) and stay in hardware casing.
 class CpuFeatures {
  public:
   //! 16-bit FP conversions
@@ -376,6 +378,7 @@ class CpuFeatures {
   };
   static StaticFlags static_flags_;
 };
+// NOLINTEND(readability-identifier-naming)
 
 }  // namespace internal
 }  // namespace ailego
```

---

### Incident Patch 6: `9b3da891` (2026-09-17)
**Commit Message**: fix(reducer): reuse optimize thread pool for builders (#757)

**File**: `src/core/mixed_reducer/mixed_streamer_reducer.cc` (modified, +4/-2)
```diff
@@ -715,15 +715,17 @@ int MixedStreamerReducer::IndexBuild(IndexHolder::Pointer target_holder) {
       return core::IndexError_Runtime;
     }
   }
-  int ret = target_builder_->train(target_holder);
+  auto threads =
+      std::make_shared<BorrowedSingleQueueIndexThreads>(*thread_pool_);
+  int ret = target_builder_->train(threads, target_holder);
   if (merged_holder_ && merged_holder_->status() != 0) {
     return merged_holder_->status();
   }
   if (ret != 0) {
     LOG_ERROR("Failed to train target builder, ret=%d", ret);
     return ret;
   }
-  ret = target_builder_->build(target_holder);
+  ret = target_builder_->build(std::move(threads), target_holder);
   if (merged_holder_ && merged_holder_->status() != 0) {
     return merged_holder_->status();
   }
```

**File**: `src/include/zvec/core/framework/index_threads.h` (modified, +58/-0)
```diff
@@ -166,5 +166,63 @@ class SingleQueueIndexThreads : public IndexThreads {
   ailego::ThreadPool pool_{};
 };
 
+/*! Borrowed Single Queue Index Threads
+ *
+ *  Adapts an existing thread pool to IndexThreads. The caller must keep the
+ *  pool alive for the lifetime of this object.
+ */
+class BorrowedSingleQueueIndexThreads : public IndexThreads {
+ public:
+  //! Constructor
+  explicit BorrowedSingleQueueIndexThreads(ailego::ThreadPool &pool)
+      : pool_(pool) {}
+
+  //! Destructor
+  ~BorrowedSingleQueueIndexThreads() override = default;
+
+  //! Retrieve thread count in pool
+  size_t count() const override {
+    return pool_.count();
+  }
+
+  //! Stop all threads
+  void stop() override {
+    pool_.stop();
+  }
+
+  //! Submit a task to be executed asynchronous
+  void submit(ailego::ClosureHandler &&task) override {
+    while (pool_.pending_count() >= kMaxQueueSize) {
+      std::this_thread::sleep_for(std::chrono::milliseconds(1));
+    }
+    pool_.enqueue_and_wake(std::move(task));
+  }
+
+  //! Make a task group
+  TaskGroup::Pointer make_group() override {
+    return std::make_shared<SingleQueueIndexThreads::SingleQueueTaskGroup>(
+        pool_.make_group());
+  }
+
+  //! Get the current work thread index
+  int indexof_this() const override {
+    return pool_.indexof_this();
+  }
+
+ public:
+  //! Disable them
+  BorrowedSingleQueueIndexThreads(const BorrowedSingleQueueIndexThreads &) =
+      delete;
+  BorrowedSingleQueueIndexThreads(BorrowedSingleQueueIndexThreads &&) = delete;
+  BorrowedSingleQueueIndexThreads &operator=(
+      const BorrowedSingleQueueIndexThreads &) = delete;
+
+ private:
+  static constexpr size_t kMaxQueueSize = 4096u;
+
+  //! Members
+  ailego::ThreadPool &pool_;
+};
+
 }  // namespace core
 }  // namespace zvec
```

**File**: `tests/core/mixed_reducer/merged_provider_index_holder_test.cc` (modified, +56/-3)
```diff
@@ -353,14 +353,20 @@ class ReadFailureReformer : public IndexReformer {
 class RetainingTestBuilder : public IndexBuilder {
  public:
   explicit RetainingTestBuilder(
-      const std::string &name = "SnapshotTestBuilder") {
+      const std::string &name = "SnapshotTestBuilder",
+      ailego::ThreadPool *expected_pool = nullptr)
+      : expected_pool_(expected_pool) {
     set_name(name);
   }
-  int train(IndexThreads::Pointer, IndexHolder::Pointer) override {
+  int train(IndexThreads::Pointer threads, IndexHolder::Pointer) override {
     ++train_calls;
+    train_thread_count = threads ? threads->count() : 0;
+    train_used_expected_pool = UsesExpectedPool(threads);
     return 0;
   }
-  int build(IndexThreads::Pointer, IndexHolder::Pointer input) override {
+  int build(IndexThreads::Pointer threads, IndexHolder::Pointer input) override {
+    build_thread_count = threads ? threads->count() : 0;
+    build_used_expected_pool = UsesExpectedPool(threads);
     holder = std::move(input);
     return 0;
   }
@@ -373,9 +379,28 @@ class RetainingTestBuilder : public IndexBuilder {
   }
 
   size_t train_calls{0};
+  size_t train_thread_count{0};
+  size_t build_thread_count{0};
+  bool train_used_expected_pool{false};
+  bool build_used_expected_pool{false};
   IndexHolder::Pointer holder;
 
  private:
+  bool UsesExpectedPool(const IndexThreads::Pointer &threads) const {
+    if (!threads || !expected_pool_) {
+      return false;
+    }
+    std::atomic<bool> used{false};
+    auto group = threads->make_group();
+    group->submit(ailego::Closure::New([&]() {
+      used.store(expected_pool_->indexof_this() >= 0,
+                 std::memory_order_relaxed);
+    }));
+    group->wait_finish();
+    return used.load(std::memory_order_relaxed);
+  }
+
+  ailego::ThreadPool *expected_pool_{nullptr};
   Stats stats_;
 };
 
@@ -482,6 +507,34 @@ TEST(MergedProviderIndexHolderTest,
   EXPECT_EQ(nullptr, builder->holder);
 }
 
+TEST(MergedProviderIndexHolderTest,
+     IvfBuilderUsesProviderBackedInputAndReducerThreadPool) {
+  auto source = MakeStreamer({{0, 0.0F}, {1, 1.0F}});
+  ailego::ThreadPool pool(2, false);
+  auto builder =
+      std::make_shared<RetainingTestBuilder>("IVFBuilder", &pool);
+  MixedStreamerReducer reducer;
+  ailego::Params params;
+  params.set(PARAM_MIXED_STREAMER_REDUCER_NUM_OF_ADD_THREADS, 1);
+  ASSERT_EQ(0, reducer.init(params));
+  reducer.set_thread_pool(&pool);
+  ASSERT_EQ(0, reducer.set_target_streamer_wiht_info(
+                   builder, source, nullptr, nullptr,
+                   IndexQueryMeta(IndexMeta::DataType::DT_FP32, kDimension)));
+  ASSERT_EQ(0, reducer.feed_streamer_with_reformer(source, nullptr));
+  ASSERT_EQ(0, reducer.reduce({}));
+  EXPECT_EQ(pool.count(), builder->train_thread_count);
+  EXPECT_EQ(pool.count(), builder->build_thread_count);
+  EXPECT_TRUE(builder->train_used_expected_pool);
+  EXPECT_TRUE(builder->build_used_expected_pool);
+  ASSERT_NE(nullptr, builder->holder);
+  auto *merged =
+      dynamic_cast<MergedProviderIndexHolder *>(builder->holder.get());
+  ASSERT_NE(nullptr, merged);
+  EXPECT_EQ((std::vector<std::pair<uint64_t, float>>{{0, 0.0F}, {1, 1.0F}}),
+            ReadAll(merged));
+}
+
 TEST(MergedProviderIndexHolderTest, PlainTurboFp32KeepsOrdinalReads) {
   auto source = MakeStreamer({{0, 0.0F}, {1, 1.0F}});
   auto quantizer = std::make_shared<turbo::Fp32Quantizer>();
```

---

### Incident Patch 7: `bb94aa4c` (2026-09-16)
**Commit Message**: fix(quantization): decode turbo sources during merge training (#763)

**File**: `python/tests/test_uniform_quantization.py` (modified, +6/-3)
```diff
@@ -341,6 +341,9 @@ def test_uniform_quantization_survives_reopen(tmp_path, quantize_type, index_typ
     assert all(np.isfinite(doc.score) for doc in after)
 
 
+@pytest.mark.parametrize(
+    "use_flat_contiguous_memory", [False, True], ids=["regular", "contiguous"]
+)
 @pytest.mark.parametrize(
     "quantize_type",
     [
@@ -356,7 +359,7 @@ def test_uniform_quantization_survives_reopen(tmp_path, quantize_type, index_typ
     ids=["flat_fp16", "flat_uint8"],
 )
 def test_uniform_quantizer_uses_flat_storage_vectors(
-    tmp_path, quantize_type, index_type, flat_data_type
+    tmp_path, quantize_type, index_type, flat_data_type, use_flat_contiguous_memory
 ):
     """Uniform training and encoding must consume the configured Flat type."""
     dimension = 32
@@ -383,7 +386,7 @@ def build_and_search(label, vectors, flat_data_type):
                 search_list_size=64,
                 quantize_type=quantize_type,
                 use_contiguous_memory=True,
-                use_flat_contiguous_memory=True,
+                use_flat_contiguous_memory=use_flat_contiguous_memory,
                 flat_data_type=flat_data_type,
             )
             query_param = VamanaQueryParam(
@@ -396,7 +399,7 @@ def build_and_search(label, vectors, flat_data_type):
                 m=16,
                 ef_construction=64,
                 quantize_type=quantize_type,
-                use_flat_contiguous_memory=True,
+                use_flat_contiguous_memory=use_flat_contiguous_memory,
                 flat_data_type=flat_data_type,
             )
             query_param = HnswQueryParam(ef=doc_count, is_linear=True)
```

**File**: `src/core/interface/index.cc` (modified, +24/-12)
```diff
@@ -34,14 +34,15 @@ bool has_group_by_search(const BaseIndexQueryParam::Pointer &search_param) {
 }
 
 // A multipass training view over merge sources. Decode through each source's
-// existing reformer, just as the merge reducer does. This lets global
-// quantizers train from FP16/UINT8 Flat references without materializing an
-// additional full-dataset FP32 copy or adding input types to the quantizers.
+// existing quantizer or reformer, just as the merge reducer does. This lets
+// global quantizers train from FP16/UINT8 Flat references without materializing
+// an additional full-dataset FP32 copy or adding input types to the quantizers.
 class MergeSourceIndexHolder final : public core::IndexHolder {
  public:
   struct Source {
     core::IndexHolder::Pointer holder;
     core::IndexReformer::Pointer reformer;
+    std::shared_ptr<turbo::Quantizer> quantizer;
     core::IndexQueryMeta stored_meta;
   };
 
@@ -87,9 +88,12 @@ class MergeSourceIndexHolder final : public core::IndexHolder {
         owner_->error_ = core::IndexError_ReadData;
         return;
       }
-      if (source_->reformer) {
-        const int ret =
-            source_->reformer->revert(data_, source_->stored_meta, &decoded_);
+      if (source_->quantizer || source_->reformer) {
+        const int ret = source_->quantizer
+                            ? source_->quantizer->dequantize(
+                                  data_, source_->stored_meta, &decoded_)
+                            : source_->reformer->revert(
+                                  data_, source_->stored_meta, &decoded_);
         if (ret != 0) {
           owner_->error_ = ret;
           return;
@@ -1422,18 +1426,26 @@ int Index::merge(const std::vector<Index::Pointer> &indexes,
               input_vector_meta_.data_type() ||
           index->input_vector_meta_.dimension() !=
               input_vector_meta_.dimension() ||
-          (!index->reformer_ &&
+          (!index->reformer_ && !index->turbo_quantizer_ &&
            (provider->data_type() != input_vector_meta_.data_type() ||
             provider->dimension() != input_vector_meta_.dimension() ||
             provider->element_size() != input_vector_meta_.element_size()))) {
         LOG_ERROR("Merge-source vector type mismatch");
         return core::IndexError_Mismatch;
       }
-      // Use the actual stored metadata, including packed quantizer dimensions.
-      core::IndexQueryMeta stored_meta(provider->data_type(),
-                                       provider->dimension());
-      sources.push_back(
-          {std::move(provider), index->reformer_, std::move(stored_meta)});
+      // Preserve the stored layout, including packed dimensions and norm tails.
+      const auto &meta = index->streamer_->meta();
+      core::IndexQueryMeta stored_meta{
+          meta.meta_type(),
+          provider->data_type(),
+          meta.unit_size(),
+          static_cast<uint32_t>(provider->dimension()),
+          index->turbo_quantizer_
+              ? static_cast<uint32_t>(index->turbo_quantizer_->type())
+              : 0,
+          meta.extra_meta_size()};
+      sources.push_back({std::move(provider), index->reformer_,
+                         index->turbo_quantizer_, std::move(stored_meta)});
     }
     auto holder = std::make_shared<MergeSourceIndexHolder>(std::move(sources),
                                                            input_vector_meta_);
```

---

### Incident Patch 8: `a9e1e0e2` (2026-09-15)
**Commit Message**: perf(ivf): reduce peak memory usage during index build and merge (#733)

Co-authored-by: Jalin Wang <wangjianning.wjn@alibaba-inc.com>

**File**: `src/core/algorithm/cluster/holder_cluster.h` (added, +37/-0)
```diff
@@ -0,0 +1,37 @@
+// Copyright 2025-present the zvec project
+//
+// Licensed under the Apache License, Version 2.0 (the "License");
+// you may not use this file except in compliance with the License.
+// You may obtain a copy of the License at
+//
+//     http://www.apache.org/licenses/LICENSE-2.0
+//
+// Unless required by applicable law or agreed to in writing, software
+// distributed under the License is distributed on an "AS IS" BASIS,
+// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+// See the License for the specific language governing permissions and
+// limitations under the License.
+#pragma once
+
+#include <zvec/core/framework/index_cluster.h>
+#include <zvec/core/framework/index_holder.h>
+
+namespace zvec {
+namespace core {
+
+// Optional, internal capability for clustering a holder without materializing
+// intermediate IndexFeatures. The holder is consumed only for this call; it is
+// not mounted for later cluster/classify/label calls. NotImplemented must be
+// returned before creating an iterator or changing centroids so callers can
+// safely fall back to the ordinary IndexFeatures path.
+class HolderCluster {
+ public:
+  virtual ~HolderCluster() = default;
+
+  virtual int cluster_holder(IndexThreads::Pointer threads,
+                             IndexHolder::Pointer holder,
+                             IndexCluster::CentroidList &cents) = 0;
+};
+
+}  // namespace core
+}  // namespace zvec
```

**File**: `src/core/algorithm/cluster/opt_kmeans_cluster.cc` (modified, +172/-77)
```diff
@@ -11,12 +11,15 @@
 // WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 // See the License for the specific language governing permissions and
 // limitations under the License.
+#include <cstdint>
+#include <cstring>
 #include <ailego/algorithm/kmeans.h>
 #include <ailego/container/reservoir.h>
 #include <zvec/core/framework/index_cluster.h>
 #include <zvec/core/framework/index_error.h>
 #include <zvec/core/framework/index_factory.h>
 #include "cluster_params.h"
+#include "holder_cluster.h"
 
 namespace zvec {
 namespace core {
@@ -51,7 +54,12 @@ class OptKmeansAlgorithm : public IndexCluster {
 
   //! Cluster
   int cluster(IndexThreads::Pointer threads,
-              IndexCluster::CentroidList &cents) override = 0;
+              IndexCluster::CentroidList &cents) override {
+    return cluster_impl(std::move(threads), nullptr, cents);
+  }
+
+  int cluster_holder(IndexThreads::Pointer threads, IndexHolder::Pointer holder,
+                     IndexCluster::CentroidList &cents);
 
   //! Cleanup Cluster
   int cleanup() override;
@@ -63,6 +71,66 @@ class OptKmeansAlgorithm : public IndexCluster {
   int update(const ailego::Params &params) override;
 
  protected:
+  virtual int cluster_impl(IndexThreads::Pointer threads,
+                           IndexHolder::Pointer holder,
+                           IndexCluster::CentroidList &cents) = 0;
+
+  int check_dimension() const;
+
+  // All kernels own their training matrix. Consume each input before advancing
+  // its iterator; never materialize a second, full IndexFeatures corpus.
+  template <typename Algorithm>
+  int load_features(Algorithm &algorithm, const IndexHolder::Pointer &holder) {
+    using StoreType = typename Algorithm::StoreType;
+    const size_t count = holder ? holder->count() : features_->count();
+    const size_t bytes = meta_.element_size();
+    std::vector<StoreType> aligned;
+    auto append = [&](const void *data) -> int {
+      if (!data) {
+        return IndexError_InvalidArgument;
+      }
+      // Providers may return packed or unaligned, reusable storage. At most one
+      // row of scratch is needed; preserve the kernel's physical
+      // representation.
+      if (reinterpret_cast<uintptr_t>(data) % alignof(StoreType) != 0) {
+        aligned.resize(bytes / sizeof(StoreType) +
+                       (bytes % sizeof(StoreType) != 0));
+        std::memcpy(aligned.data(), data, bytes);
+        data = aligned.data();
+      }
+      algorithm.append(reinterpret_cast<const StoreType *>(data),
+                       meta_.dimension());
+      return 0;
+    };
+
+    algorithm.feature_matrix_reserve(count);
+    if (holder) {
+      auto iter = holder->create_iterator();
+      if (!iter) {
+        return IndexError_Runtime;
+      }
+      size_t loaded = 0;
+      for (; iter->is_valid(); iter->next()) {
+        if (loaded == count) {
+          return IndexError_InvalidArgument;
+        }
+        int ret = append(iter->data());
+        if (ret != 0) {
+          return ret;
+        }
+        ++loaded;
+      }
+      return loaded == count ? 0 : IndexError_InvalidArgument;
+    }
+    for (size_t i = 0; i < count; ++i) {
+      int ret = append(features_->element(i));
+      if (ret != 0) {
+        return ret;
+      }
+    }
+    return 0;
+  }
+
   //! Update parameters
   void update_params(const ailego::Params &params);
 
@@ -372,35 +440,67 @@ int OptKmeansAlgorithm::mount(IndexFeatures::Pointer feats) {
     return IndexError_Mismatch;
   }
 
-  // Check dimension
+  int ret = check_dimension();
+  if (ret != 0) {
+    return ret;
+  }
+  features_ = std::move(feats);
+  return 0;
+}
+
+int OptKmeansAlgorithm::check_dimension() const {
   auto type_ = meta_.data_type();
   switch (type_) {
     case IndexMeta::DataType::DT_INT4:
-      if (feats->dimension() % 8 != 0) {
+      if (meta_.dimension() % 8 != 0) {
         LOG_ERROR(
             "Unsupported feature dimension %zu (dimension of
```

**File**: `src/core/algorithm/cluster/stratified_cluster_trainer.cc` (modified, +94/-44)
```diff
@@ -12,12 +12,14 @@
 // See the License for the specific language governing permissions and
 // limitations under the License.
 #include "stratified_cluster_trainer.h"
+#include <cmath>
 #include <zvec/ailego/utility/string_helper.h>
 #include <zvec/ailego/utility/time_helper.h>
 #include <zvec/core/framework/index_error.h>
 #include <zvec/core/framework/index_factory.h>
 #include <zvec/core/framework/index_helper.h>
 #include "cluster_params.h"
+#include "holder_cluster.h"
 
 namespace zvec {
 namespace core {
@@ -153,62 +155,110 @@ int StratifiedClusterTrainer::train(IndexThreads::Pointer threads,
     }
   }
 
-  size_t train_sample_count = std::max(
-      sample_count_, static_cast<uint32_t>(sample_ratio_ * holder->count()));
-
-  IndexFeatures::Pointer features;
-  if (train_sample_count > 0) {
-    LOG_INFO(
-        "Train sampling, SampleCount=%u, SampleRatio=%f, HolderCount=%lu, "
-        "TrainCount=%lu",
-        sample_count_, sample_ratio_, holder->count(), train_sample_count);
-
-    auto sampler = std::make_shared<SampleIndexFeatures<CompactIndexFeatures>>(
-        meta_, train_sample_count);
-    size_t pre_reserve = train_sample_count < holder->count()
-                             ? train_sample_count
-                             : holder->count();
-    sampler->reserve(pre_reserve);
-    for (auto iter = holder->create_iterator(); iter && iter->is_valid();
-         iter->next()) {
-      sampler->emplace(iter->data());
-    }
-    features = sampler;
-    stats_.set_trained_count(train_sample_count);
-  } else {
-    LOG_INFO(
-        "Do no sampling, SampleCount=%u, SampleRatio=%f, "
-        "HolderCount=%lu, TrainCount=%lu",
-        sample_count_, sample_ratio_, holder->count(), holder->count());
-
-    auto no_sampler = std::make_shared<CompactIndexFeatures>(meta_);
-    for (auto iter = holder->create_iterator(); iter && iter->is_valid();
-         iter->next()) {
-      no_sampler->emplace(iter->data());
+  const size_t holder_count = holder->count();
+  const bool has_known_count = holder_count != static_cast<size_t>(-1);
+  if (!std::isfinite(sample_ratio_) || sample_ratio_ < 0.0f ||
+      (!has_known_count && sample_ratio_ > 0.0f)) {
+    return IndexError_InvalidArgument;
+  }
+  size_t train_sample_count = sample_count_;
+  if (has_known_count && sample_ratio_ > 0.0f) {
+    size_t ratio_sample_count = holder_count;
+    if (sample_ratio_ < 1.0f) {
+      const float requested = sample_ratio_ * holder_count;
+      // Preserve the existing sampling calculation, but clamp before converting
+      // to an integer: rounded counts and ratios above one must not overflow.
+      if (requested < static_cast<float>(holder_count)) {
+        ratio_sample_count = static_cast<size_t>(requested);
+      }
     }
+    train_sample_count = std::max(train_sample_count, ratio_sample_count);
+  }
 
-    features = no_sampler;
-    stats_.set_trained_count(holder->count());
+  centroids_.clear();
+  int result = IndexError_NotImplemented;
+  // Reservoir sampling preserves every row in input order when its capacity
+  // covers the known corpus. Such a request is full training, too.
+  if (has_known_count &&
+      (train_sample_count == 0 || train_sample_count >= holder_count)) {
+    auto streaming_cluster = dynamic_cast<HolderCluster *>(cluster_.get());
+    if (streaming_cluster) {
+      // A previous fallback train may still have features mounted. They are
+      // not needed by a new one-shot train and must not overlap its matrix.
+      result = cluster_->reset();
+      if (result != 0) {
+        return result;
+      }
+      result = streaming_cluster->cluster_holder(threads, holder, centroids_);
+      if (result == 0) {
+        stats_.set_trained_count(holder_count);
+        LOG_INFO("Trained directly from holder, HolderCount=%lu", holder_count);
+      }
+    }
   }
-  stats_.set_discarded_count(0);
 
-  // Holder is not needed, cleanup it.
-  holder.reset();
+  // Only an unsupported cap
```

**File**: `src/core/algorithm/ivf/ivf_builder.cc` (modified, +107/-22)
```diff
@@ -12,6 +12,8 @@
 // See the License for the specific language governing permissions and
 // limitations under the License.
 #include "ivf_builder.h"
+#include <algorithm>
+#include <limits>
 #include <ailego/pattern/defer.h>
 #include <zvec/ailego/utility/string_helper.h>
 #include "algorithm/cluster/cluster_params.h"
@@ -190,6 +192,8 @@ int IVFBuilder::cleanup() {
   labels_.clear();
   centroid_index_.reset();
   holder_.reset();
+  source_reader_.reset();
+  source_holder_.reset();
   converted_meta_ = meta_;
   converter_.reset();
   quantized_meta_ = meta_;
@@ -363,22 +367,49 @@ int IVFBuilder::build(IndexThreads::Pointer threads,
     }
   }
 
-  holder_ = std::make_shared<RandomAccessIndexHolder>(meta_);
-  if (!holder_) {
-    return IndexError_NoMemory;
-  }
-  if (holder->count() > 0) {
-    holder_->reserve(holder->count());
+  holder_.reset();
+  source_reader_.reset();
+  source_holder_.reset();
+  labels_.clear();
+  quantizers_.clear();
+  error_ = false;
+  err_code_ = 0;
+
+  // Borrow only a holder with explicit ordinal-read semantics. Sequential
+  // iterator pointers may be transient, so merely retaining them is unsafe.
+  auto *ordinal_holder = dynamic_cast<OrdinalAccessHolder *>(holder.get());
+  if (ordinal_holder && !converter_ &&
+      params_.get_as_string(PARAM_IVF_BUILDER_QUANTIZER_CLASS).empty() &&
+      holder->count() <= std::numeric_limits<uint32_t>::max()) {
+    int ret = ordinal_holder->create_ordinal_reader(&source_reader_);
+    if (ret != 0 && ret != IndexError_NotImplemented) {
+      return ret;
+    }
+    if (ret == 0) {
+      if (!source_reader_) {
+        return IndexError_Runtime;
+      }
+      source_holder_ = holder;
+    }
   }
-  for (auto iter = holder->create_iterator(); iter && iter->is_valid();
-       iter->next()) {
-    holder_->emplace(iter->key(), iter->data());
+
+  IndexHolder::Pointer converted_holder = source_holder_;
+  if (!source_holder_) {
+    holder_ = std::make_shared<RandomAccessIndexHolder>(meta_);
+    if (!holder_) {
+      return IndexError_NoMemory;
+    }
+    if (holder->count() > 0) {
+      holder_->reserve(holder->count());
+    }
+    for (auto iter = holder->create_iterator(); iter && iter->is_valid();
+         iter->next()) {
+      holder_->emplace(iter->key(), iter->data());
+    }
+    converted_holder = holder_;
   }
 
-  // Holder is not needed, cleanup it.
   holder.reset();
-
-  IndexHolder::Pointer converted_holder = holder_;
   if (converter_) {
     int ret = converter_->transform(holder_);
     ivf_check_with_msg(ret, "Failed to transform by converter %s",
@@ -391,6 +422,15 @@ int IVFBuilder::build(IndexThreads::Pointer threads,
   ivf_check_with_msg(ret, "Failed to build index for %s",
                      IndexError::What(ret));
 
+  if (source_reader_) {
+    // Label workers finish out of order. Restore ordinal order within each
+    // bucket so dump opens each source at most once per bucket, rather than
+    // bouncing between providers for individual vectors.
+    for (auto &label : labels_) {
+      std::sort(label.begin(), label.end());
+    }
+  }
+
   ret = this->prepare_quantizer(threads.get());
   ivf_check_error_code(ret);
 
@@ -416,7 +456,7 @@ int IVFBuilder::dump(const IndexDumper::Pointer &dumper) {
 
   // the fitting function for the follow points: 1000000(0.02) 10000000(0.01)
   // 50000000(0.005) 100000000(0.001)
-  float scan_ratio = -0.004 * std::log(holder_->count()) + 0.0751;
+  float scan_ratio = -0.004 * std::log(stats_.built_count()) + 0.0751;
   scan_ratio = std::max(scan_ratio, 0.0001f);
 
   // Set Searcher Params
@@ -626,30 +666,69 @@ int IVFBuilder::build_label_index(IndexThreads *threads,
   });
 
   size_t elem_size = holder->element_size();
+  if (elem_size == 0) {
+    return IndexError_InvalidArgument;
+  }
+  // Bound copied vectors by bytes, including queued and running batches.
+  // A single vector larger than the budget is still allowed to make progress.
+  const size_t window_siz
```

**File**: `src/core/algorithm/ivf/ivf_builder.h` (modified, +9/-1)
```diff
@@ -15,6 +15,7 @@
 
 #include <zvec/core/framework/index_builder.h>
 #include <zvec/core/framework/index_meta.h>
+#include "utility/ordinal_access_holder.h"
 #include "ivf_centroid_index.h"
 
 namespace zvec {
@@ -225,6 +226,9 @@ class IVFBuilder : public IndexBuilder {
   //! Dump the index to dumper
   int dump_index(const IndexDumper::Pointer &dumper);
 
+  //! Read one original vector; the returned data is consumed before next read.
+  int read_vector(size_t id, uint64_t *key, const void **data);
+
   //! Prepare the quantizer for inverted index
   int prepare_quantizer(IndexThreads *threads);
 
@@ -273,7 +277,7 @@ class IVFBuilder : public IndexBuilder {
 
  private:
   //! Constants
-  static constexpr size_t kThreadPoolQueueSize = 300u;
+  static constexpr size_t kLabelMemoryBudget = 4u * 1024u * 1024u;
   static constexpr size_t kBatchSize = 10u;
   static constexpr size_t kDefaultBlockCount = 32u;
 
@@ -295,6 +299,10 @@ class IVFBuilder : public IndexBuilder {
   IVFCentroidIndex::Pointer centroid_index_{};
   IVFCentroidIndex::Pointer searcher_centroid_index_{};
   RandomAccessIndexHolder::Pointer holder_{};
+  // Keep the immutable source alive through dump, including repeated dumps.
+  // The reader owns only a key map and at most one provider, never all vectors.
+  IndexHolder::Pointer source_holder_{};
+  OrdinalAccessHolder::Reader::Pointer source_reader_{};
   IndexMeta converted_meta_{};
   IndexConverter::Pointer converter_{};
   IndexMeta quantized_meta_{};
```

---

### Incident Patch 9: `be9edda0` (2026-09-15)
**Commit Message**: fix: correct inverted-index LIKE suffix and empty-array queries (#752)

**File**: `src/db/index/column/inverted_column/inverted_column_indexer_search.cc` (modified, +9/-29)
```diff
@@ -177,39 +177,17 @@ Result<roaring_bitmap_t *> InvertedColumnIndexer::get_bitmap_not_contain(
     return tl::make_unexpected(Status::InvalidArgument());
   }
 
-  roaring_bitmap_t *non_null_bitmap{nullptr};
+  auto non_null_result = get_bitmap_non_null();
+  if (!non_null_result) {
+    return non_null_result;
+  }
+  auto *non_null_bitmap = non_null_result.value();
   AILEGO_DEFER([&]() {
     if (non_null_bitmap) {
       roaring_bitmap_free(non_null_bitmap);
     }
   });
 
-  if (sealed_) {
-    non_null_bitmap = null_bitmap_.copy();
-    roaring_bitmap_flip_inplace(non_null_bitmap, 0, max_id_ + 1);
-  } else {
-    Status s;
-    non_null_bitmap = roaring_bitmap_create();
-    if (!non_null_bitmap) {
-      LOG_ERROR("Failed to create bitmap");
-      return tl::make_unexpected(Status::InternalError());
-    }
-    auto iter = ctx_.db_->NewIterator(ctx_.read_opts_, cf_terms_);
-    AILEGO_DEFER([&]() { delete iter; });
-    iter->SeekToFirst();
-    while (iter->Valid()) {
-      s = InvertedIndexCodec::Merge_OR(
-          iter->value().data(), iter->value().size(), true, non_null_bitmap);
-      if (s.ok()) {
-        iter->Next();
-      } else {
-        LOG_ERROR("Failed to merge bitmap from %s", ID().c_str());
-        return tl::make_unexpected(s);
-      }
-    }
-    roaring_bitmap_repair_after_lazy(non_null_bitmap);
-  }
-
   auto ret = get_bitmap_contain(terms, is_any);
   if (ret) {
     if (ret.value() == nullptr) {
@@ -620,7 +598,7 @@ Result<roaring_bitmap_t *> InvertedColumnIndexer::get_bitmap_like(
         "like should have exactly one percent, unescaped:", term));
   }
   if (percent_loc == 0) {
-    return get_bitmap_suffix(term);
+    return get_bitmap_suffix(term.substr(1));
   } else if (percent_loc == size - 1) {
     return get_bitmap_prefix(term.substr(0, percent_loc));
   } else {
@@ -723,7 +701,9 @@ Result<roaring_bitmap_t *> InvertedColumnIndexer::get_bitmap_non_null() const {
     return bitmap;
   } else {
     Status s = Status::OK();
-    auto iter = ctx_.db_->NewIterator(ctx_.read_opts_, cf_terms_);
+    // Empty arrays have a length entry but no term entries.
+    auto *cf = field_.is_array_type() ? cf_array_len_ : cf_terms_;
+    auto iter = ctx_.db_->NewIterator(ctx_.read_opts_, cf);
     AILEGO_DEFER([&]() { delete iter; });
     roaring_bitmap_t *bitmap = roaring_bitmap_create();
     if (!bitmap) {
```

**File**: `tests/db/index/column/inverted_column/inverted_column_indexer_empty_array_test.cc` (added, +128/-0)
```diff
@@ -0,0 +1,128 @@
+// Copyright 2025-present the zvec project
+//
+// Licensed under the Apache License, Version 2.0 (the "License");
+// you may not use this file except in compliance with the License.
+// You may obtain a copy of the License at
+//
+//     http://www.apache.org/licenses/LICENSE-2.0
+//
+// Unless required by applicable law or agreed to in writing, software
+// distributed under the License is distributed on an "AS IS" BASIS,
+// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+// See the License for the specific language governing permissions and
+// limitations under the License.
+
+#include <gtest/gtest.h>
+#include "db/index/column/inverted_column/inverted_indexer.h"
+#include "tests/test_util.h"
+
+namespace zvec {
+namespace {
+
+class EmptyArrayIndexTest : public testing::TestWithParam<DataType> {
+ protected:
+  void SetUp() override {
+    test_util::RemoveTestPath(path_);
+  }
+
+  void TearDown() override {
+    indexer_.reset();
+    test_util::RemoveTestPath(path_);
+  }
+
+  void expect_ids(const InvertedSearchResult::Ptr &result,
+                  const std::vector<uint32_t> &expected) {
+    ASSERT_TRUE(result);
+    ASSERT_EQ(result->count(), expected.size());
+    std::vector<uint32_t> actual;
+    result->extract_ids(&actual);
+    EXPECT_EQ(actual, expected);
+  }
+
+  void verify(const std::string &term) {
+    auto column = (*indexer_)["values"];
+    ASSERT_TRUE(column);
+    expect_ids(column->search_non_null(), {0, 1, 2});
+    expect_ids(column->search_null(), {3});
+    expect_ids(column->search_array_len(0, CompareOp::EQ), {0});
+    expect_ids(column->multi_search({term}, CompareOp::CONTAIN_ANY), {1});
+    expect_ids(column->multi_search({term}, CompareOp::CONTAIN_ALL), {1});
+    expect_ids(column->multi_search({term}, CompareOp::NOT_CONTAIN_ANY),
+               {0, 2});
+    expect_ids(column->multi_search({term}, CompareOp::NOT_CONTAIN_ALL),
+               {0, 2});
+  }
+
+  const std::string path_{"./empty_array_index"};
+  InvertedIndexer::Ptr indexer_;
+};
+
+TEST_P(EmptyArrayIndexTest, NonNullAndNegatedContainAcrossReopenAndSeal) {
+  const FieldSchema field{"values", GetParam(), true,
+                          std::make_shared<InvertIndexParams>()};
+  indexer_ =
+      InvertedIndexer::CreateAndOpen("test", path_, true, {field}, false);
+  ASSERT_TRUE(indexer_);
+  auto column = (*indexer_)["values"];
+  ASSERT_TRUE(column);
+  std::string term;
+  if (GetParam() == DataType::ARRAY_STRING) {
+    ASSERT_TRUE(column->insert(0, std::vector<std::string>{}).ok());
+    ASSERT_TRUE(column->insert(1, std::vector<std::string>{"a"}).ok());
+    ASSERT_TRUE(column->insert(2, std::vector<std::string>{"b"}).ok());
+    term = "a";
+  } else if (GetParam() == DataType::ARRAY_BOOL) {
+    ASSERT_TRUE(column->insert(0, std::vector<bool>{}).ok());
+    ASSERT_TRUE(column->insert(1, std::vector<bool>{true}).ok());
+    ASSERT_TRUE(column->insert(2, std::vector<bool>{false}).ok());
+    term = "true";
+  } else {
+    const int32_t match = 1, other = 2;
+    term.assign(reinterpret_cast<const char *>(&match), sizeof(match));
+    ASSERT_TRUE(column->insert(0, std::string{}).ok());
+    ASSERT_TRUE(column->insert(1, term).ok());
+    ASSERT_TRUE(
+        column
+            ->insert(2, std::string(reinterpret_cast<const char *>(&other),
+                                    sizeof(other)))
+            .ok());
+  }
+  ASSERT_TRUE(column->insert_null(3).ok());
+  column.reset();
+
+  {
+    SCOPED_TRACE("streaming");
+    verify(term);
+  }
+  ASSERT_TRUE(indexer_->flush().ok());
+  indexer_.reset();
+  indexer_ =
+      InvertedIndexer::CreateAndOpen("test", path_, false, {field}, false);
+  ASSERT_TRUE(indexer_);
+  {
+    SCOPED_TRACE("reopened streaming");
+    verify(term);
+  }
+  ASSERT_TRUE(indexer_->seal().ok());
+  ASSERT_TRUE((*indexer_)["values"]->is_sealed());
+  {
+    SCOPED_TRACE("sealed");
+    verify(term);
+  }
+  indexer_.reset();
+  indexer
```

**File**: `tests/db/index/column/inverted_column/inverted_column_indexer_string_test.cc` (modified, +29/-0)
```diff
@@ -346,6 +346,35 @@ TEST_F(InvertedIndexTest, STRINGS) {
 }
 
 
+TEST_F(InvertedIndexTest, LikeSuffixStripsWildcard) {
+  ASSERT_TRUE(indexer_);
+  FieldSchema field{"like_suffix", DataType::STRING, true, params_};
+  ASSERT_TRUE(indexer_->create_column_indexer(field).ok());
+  auto column = (*indexer_)["like_suffix"];
+  ASSERT_TRUE(column);
+  const std::vector<std::string> values = {
+      "index.ts",     "src/app.ts", ".ts",         "index.tsx",
+      "index.ts.bak", "README",     "literal%.ts", "literal_.ts"};
+  for (uint32_t i = 0; i < values.size(); ++i) {
+    ASSERT_TRUE(column->insert(i, values[i]).ok());
+  }
+  const std::vector<std::pair<std::string, std::vector<uint32_t>>> cases = {
+      {"%.ts", {0, 1, 2, 6, 7}},
+      {R"(%\%.ts)", {6}},
+      {R"(%\_.ts)", {7}},
+      {"%.js", {}}};
+  for (const auto &[pattern, expected] : cases) {
+    SCOPED_TRACE(pattern);
+    auto result = column->search(pattern, CompareOp::LIKE);
+    ASSERT_TRUE(result);
+    ASSERT_EQ(result->count(), expected.size());
+    for (auto id : expected) {
+      EXPECT_TRUE(result->contains(id)) << values[id];
+    }
+  }
+}
+
+
 TEST_F(InvertedIndexTest, LikePrefixSuffixMustNotOverlap) {
   ASSERT_TRUE(indexer_);
   FieldSchema field{"like_overlap", DataType::STRING, true, params_};
```

**File**: `tests/db/sqlengine/like_test.cc` (modified, +3/-0)
```diff
@@ -171,6 +171,7 @@ TEST_F(LikeTest, ForwardSuffixLike) {
   auto ret = engine->execute(collection_schema_, query, segments_);
   ASSERT_TRUE(ret.has_value()) << ret.error();
   auto docs = std::move(ret.value());
+  ASSERT_EQ(docs.size(), 50u);
   for (size_t i = 0; i < docs.size(); i++) {
     auto doc = docs[i];
     int doc_id = i * 100 + 22;
@@ -188,6 +189,7 @@ TEST_F(LikeTest, NotExtendedInvertSuffixLikeRunAsForward) {
   auto ret = engine->execute(collection_schema_, query, segments_);
   ASSERT_TRUE(ret.has_value()) << ret.error();
   auto docs = std::move(ret.value());
+  ASSERT_EQ(docs.size(), 50u);
   for (size_t i = 0; i < docs.size(); i++) {
     auto doc = docs[i];
     int doc_id = i * 100 + 22;
@@ -205,6 +207,7 @@ TEST_F(LikeTest, ExtendedInvertSuffixLike) {
   auto ret = engine->execute(collection_schema_, query, segments_);
   ASSERT_TRUE(ret.has_value()) << ret.error();
   auto docs = std::move(ret.value());
+  ASSERT_EQ(docs.size(), 50u);
   for (size_t i = 0; i < docs.size(); i++) {
     auto doc = docs[i];
     int doc_id = i * 100 + 22;
```

---

### Incident Patch 10: `0fd01cf5` (2026-09-15)
**Commit Message**: fix(ci): skip unavailable legacy Android SDK tools package (#753)

**File**: `.github/workflows/04-android-build.yml` (modified, +2/-0)
```diff
@@ -55,6 +55,8 @@ jobs:
 
       - name: Setup Android SDK
         uses: android-actions/setup-android@v4
+        with:
+          packages: 'platform-tools'
 
       - name: Enable KVM
         if: matrix.abi == 'x86_64'
```

#### Recent Merged Pull Requests:
- **PR #780** (2026-09-29): feat(rabitq): upgrade RaBitQ-Library to v0.3.8 and enable Windows x86_64 (@egolearner)
- **PR #777** (2026-09-24): fix(quantizer): use rounded INT4 values for scoring metadata (@richyreachy)
- **PR #775** (2026-09-28): fix(core): honor optimize threads in nested training(rabitQ/DiskANN) (@JalinWang)
- **PR #769** (2026-09-22): refactor(sqlengine): separate filter validation and execution binding (@egolearner)
- **PR #766** (2026-09-18): feat(buffer): integrate IVF and DiskANN with shared page cache (@iaojnh)
- **PR #765** (2026-09-17): refactor(turbo): share implementation across pq quantizers (@richyreachy)
- **PR #764** (2026-09-18): chore: enable readability-identifier-naming check and fix violations (@egolearner)
- **PR #763** (2026-09-16): fix(quantization): decode turbo sources during merge training (@iaojnh)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

# Forensic Learning Record (Deep Inspection): oceanbase/oceanbase

> **Canonical Artifact**: `07_PROJECT_LEARNING/oceanbase-oceanbase-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/oceanbase/oceanbase](https://github.com/oceanbase/oceanbase))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T19:01:15.719Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `oceanbase/oceanbase`
- **Description**: OceanBase is the unified distributed database for the AI era — open-source, multi-model, one engine for your most demanding workloads.
- **Primary Language / Ecosystem**: C++
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 10296 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `deps/easy/src/util/easy_array.c`
```
#include "util/easy_array.h"

easy_array_t *easy_array_create(int object_size)
{
    easy_pool_t             *pool;
    easy_array_t            *array;

    if ((pool = easy_pool_create(0)) == NULL)
        return NULL;

    if ((array = (easy_array_t *)easy_pool_alloc(pool, sizeof(easy_array_t))) == NULL)
        return NULL;

    easy_list_init(&array->list);
    array->count = 0;
    array->pool = pool;
    array->object_size = easy_max(object_size, (int)sizeof(easy_list_t));

    return array;
}

void easy_array_destroy(easy_array_t *array)
{
    easy_pool_destroy(array->pool);
}

void *easy_array_alloc(easy_array_t *array)
{
    if (easy_list_empty(&array->list) == 0) {
        array->count --;
        char                    *ptr = (char *)array->list.prev;
        easy_list_del((easy_list_t *)ptr);
        return ptr;
    }

    return easy_pool_alloc(array->pool, array->object_size);
}

void easy_array_free(easy_array_t *array, void *ptr)
{
    array->count ++;
    easy_list_add_tail((easy_list_t *)ptr, &array->list);
}

```

### Core Architecture Module: `deps/easy/src/util/easy_array.h`
```
#ifndef EASY_ARRAY_H_
#define EASY_ARRAY_H_

/**
 * 固定长度数组分配
 */
#include "util/easy_pool.h"
#include "easy_list.h"

EASY_CPP_START

typedef struct easy_array_t {
    easy_pool_t             *pool;
    easy_list_t             list;
    int                     object_size;
    int                     count;
} easy_array_t;

easy_array_t *easy_array_create(int object_size);
void easy_array_destroy(easy_array_t *array);
void *easy_array_alloc(easy_array_t *array);
void easy_array_free(easy_array_t *array, void *ptr);

EASY_CPP_END

#endif

```

### Core Architecture Module: `deps/easy/src/util/easy_buf.c`
```
#include "easy_buf.h"
#include "io/easy_log.h"
#include "io/easy_connection.h"


/**
 * 创建一个新的easy_buf_t
 */
easy_buf_t *easy_buf_create(easy_pool_t *pool, uint32_t size)
{
    easy_buf_t              *b;

    if ((b = (easy_buf_t *)easy_pool_calloc(pool, sizeof(easy_buf_t))) == NULL)
        return NULL;

    // 一个page大小
    if (size == 0)
        size = pool->end - pool->last;

    if ((b->data = (char *)easy_pool_alloc(pool, size)) == NULL)
        return NULL;

    b->pos = b->data;
    b->last = b->pos;
    b->end = b->last + size;
    b->cleanup = NULL;
    b->args = pool;
    easy_list_init(&b->node);

    return b;
}

static uint64_t priv_pool_created = 0;
static uint64_t priv_pool_destroyed = 0;
static void easy_buf_free_private_pool(easy_buf_t * b, easy_pool_t * pool)
{
    easy_debug_log("easy free residual buffer: %p remain=%d\n", b, easy_buf_len(b));
    easy_pool_destroy(pool);
    priv_pool_destroyed++;
}

easy_buf_t* easy_buf_clone_with_private_pool(easy_buf_t* b)
{
    easy_buf_t* nb = NULL;
    int64_t data_len = easy_buf_len(b);
    easy_pool_t* pool = easy_pool_create(data_len + sizeof(*b) + sizeof(*pool));
    if (NULL != pool) {
        nb = easy_buf_create(pool, data_len);
    }
    if (NULL != nb) {
        memcpy(nb->last, b->pos, data_len);
        nb->last += data_len;
        nb->cleanup = (easy_buf_cleanup_pt*)easy_buf_free_private_pool;
        {
            if ((priv_pool_created & 0x1ff) == 0) {
                easy_info_log("easy created (%ld) private pools, and destoyed (%ld) pools.\n",
                              priv_pool_created, priv_pool_destroyed);
            }
            priv_pool_created++;
        }
    } else {
        if (NULL != pool) {
            easy_pool_destroy(pool);
        }
    }
    return nb;
}
/**
 * 把data包成easy_buf_t
 */
easy_buf_t *easy_buf_pack(easy_pool_t *pool, const void *data, uint32_t size)
{
    easy_buf_t              *b;

    if ((b = (easy_buf_t *)easy_pool_calloc(pool, sizeof(easy_buf_t))) == NULL)
        return NULL;

    easy_buf_set_data(pool, b, data, size);

    return b;
}

/**
 * 设置数据到b里
 */
void easy_buf_set_data(easy_pool_t *pool, easy_buf_t *b, const void *data, uint32_t size)
{
    b->data = (char *)data;
    b->pos = b->data;
    b->last = b->pos + size;
    b->end = b->last;
    b->cleanup = NULL;
    b->args = pool;
    b->flags = 0;
    easy_list_init(&b->node);
}

/**
 * 创建一个easy_file_buf_t, 用于sendfile等
 */
easy_file_buf_t *easy_file_buf_create(easy_pool_t *pool)
{
    easy_file_buf_t         *b;

    b = (easy_file_buf_t *)easy_pool_calloc(pool, sizeof(easy_file_buf_t));
    b->flags = EASY_BUF_FILE;
    b->cleanup = NULL;
    b->args = pool;
    easy_list_init(&b->node);

    return b;
}

void easy_file_buf_set_close(easy_file_buf_t *b)
{
    if ((b->flags & EASY_BUF_FILE))
        b->flags = EASY_BUF_CLOSE_FILE;
}

void easy_buf_set_cleanup(easy_buf_t *b, easy_buf_cleanup_pt *cleanup, void *args)
{
    b->cleanup = cleanup;
    b->args = args;
}

void easy_buf_destroy(easy_buf_t *b)
{
    easy_session_t *s;
    easy_buf_cleanup_pt *cleanup;
    ev_tstamp easy_hold_time;

    /*
     * Session must be got before cleanup is called, because cleanup may free
     * the memory pool and then the memory space of b becomes illegal.
     */
    s = b->session;
    easy_list_del(&b->node);
    if ((b->flags & EASY_BUF_CLOSE_FILE) == EASY_BUF_CLOSE_FILE) {
        close(((easy_file_buf_t *)b)->fd);
    }

    /*
     * cleanup is set to easy_request_cleanup in RX side, or set to
     * easy_buf_free_private_pool when session is allocated in private pool.
     */
    if ((cleanup = b->cleanup)) {
        b->cleanup = NULL;
        (*cleanup)(b, b->args);
    }

    /*
     * session is set in TX side.
     */
    if (s != NULL) {
        if ((s->type == EASY_TYPE_SESSION) ||
                (s->type == EASY_TYPE_KEEPALIVE_SESSION) ||
                (s->type == EASY_TYPE_RL_SESSION)) {
            s->buf_count--;
            s->sent_buf_count++;
            if (unlikely(s->enable_trace)) {
                easy_debug_log("destroy buffer, session=%p, count=%ld, on_write_success=%p",
                               s, s->buf_count, s->on_write_success);
            }
            if (s->buf_count == 0) {
                easy_hold_time = ev_time() - s->now;
                if ((easy_hold_time > 1.0) && (EASY_REACH_TIME_INTERVAL(1 * 1000 * 1000))) {
                    easy_info_log("Session hold by easy for too much time, session(%p), time(%fs), "
                            "packet_id(%" PRId64 "), conn(%p).", s, easy_hold_time, s->packet_id, s->c);
                }

                s->nextb = NULL;
                if (s->on_write_success) {
                    s->on_write_success(s);
                    s = NULL;
                }
            }
        }

        /*
         * Free packet buffer in TX side.
         */
        if ((s != NULL) && (s->tx_buf_separated > 0) && (s->tx_buf != NULL)) {
            easy_pool_realloc(s->tx_buf, 0);
            s->tx_buf = NULL;
        }
    }
}

/**
 * 空间不够,分配出一块来,保留之前的空间
 */
int easy_buf_check_read_space(easy_pool_t *pool, easy_buf_t *b, uint32_t size)
{
    int                     dsize;
    char                    *ptr;

    if ((b->end - b->last) >= (int)size)
        return EASY_OK;

    // 需要大小
    dsize = (b->last - b->pos);
    size = easy_max(dsize * 3 / 2, size + dsize);
    size = easy_align(size, EASY_POOL_PAGE_SIZE);

    // alloc
    if ((ptr = (char *)easy_pool_alloc(pool, size)) == NULL)
        return EASY_ERROR;

    // copy old buf to new buf
    if (dsize > 0)
        memcpy(ptr, b->pos, dsize);

    b->data = ptr;
    b->pos = ptr;
    b->last = b->pos + dsize;
    b->end = b->pos + size;

    return EASY_OK;
}

/**
 * 空间不够,分配出一块来,保留之前的空间
 */
easy_buf_t *easy_buf_check_write_space(easy_pool_t *pool, easy_list_t *bc, uint32_t size)
{
    easy_buf_t              *b = easy_list_get_last(bc, easy_buf_t, node);

    if (b != NULL && (b->end - b->last) >= (int)size)
        return b;

    // 重新生成一个buf,放入buf_chain_t中
    size = easy_align(size, EASY_POOL_PAGE_SIZE);

    if ((b = easy_buf_create(pool, size)) == NULL)
        return NULL;

    easy_list_add_tail(&b->node, bc);

    return b;
}

/**
 * 清除掉
 */
void easy_buf_chain_clear(easy_list_t *l)
{
    easy_buf_t              *b, *b1;

    easy_list_for_each_entry_safe(b, b1, l, node) {
        easy_debug_log("easy_buf_chain_clear, b(%), b1(p).\n", b, b1);
        easy_buf_destroy(b);
    }
    easy_list_init(l);
}

/**
 * 加到后面
 */
void easy_buf_chain_offer(easy_list_t *l, easy_buf_t *b)
{
    if (!l->next) easy_list_init(l);

    easy_list_add_tail(&b->node, l);
}

/**
 * 把s复制到d上
 */
int easy_buf_string_copy(easy_pool_t *pool, easy_buf_string_t *d, const easy_buf_string_t *s)
{
    if (s->len > 0) {
        d->data = (char *)easy_pool_alloc(pool, s->len + 1);
        memcpy(d->data, s->data, s->len);
        d->data[s->len] = '\0';
        d->len = s->len;
    }

    return s->len;
}

int easy_buf_string_printf(easy_pool_t *pool, easy_buf_string_t *d, const char *fmt, ...)
{
    int                     len;
    char                    buffer[2048];

    va_list                 args;
    va_start(args, fmt);
    len = easy_vsnprintf(buffer, 2048, fmt, args);
    va_end(args);
    d->data = (char *)easy_pool_alloc(pool, len + 1);
    memcpy(d->data, buffer, len);
    d->data[len] = '\0';
    d->len = len;
    return len;
}

int easy_buf_list_len(easy_list_t *l)
{
    easy_buf_t              *b;
    int                     len = 0;

    easy_list_for_each_entry(b, l, node) {
        len += easy_buf_len(b);
    }

    return len;
}


```

### Core Architecture Module: `deps/easy/src/util/easy_buf.h`
```
#ifndef EASY_BUF_H_
#define EASY_BUF_H_

/**
 * 网络的读写的BUFFER
 */
#include "easy_define.h"
#include "util/easy_pool.h"

EASY_CPP_START

#define EASY_BUF_FILE        1
#define EASY_BUF_CLOSE_FILE  3

typedef struct easy_buf_t easy_buf_t;
typedef struct easy_file_buf_t easy_file_buf_t;
typedef struct easy_buf_string_t easy_buf_string_t;
typedef void (easy_buf_cleanup_pt)(easy_buf_t *, void *);

#define EASY_BUF_DEFINE                 \
    easy_list_t             node;       \
    int                     flags;      \
    easy_buf_cleanup_pt     *cleanup;   \
    void                    *args;      \
    void                    *session;

struct easy_buf_t {
    EASY_BUF_DEFINE;
    char                    *data;
    char                    *pos;
    char                    *last;
    char                    *end;
};

struct easy_file_buf_t {
    EASY_BUF_DEFINE;
    int                     fd;
    int64_t                 offset;
    int64_t                 count;
};

struct easy_buf_string_t {
    char                    *data;
    int                     len;
};

extern easy_buf_t *easy_buf_create(easy_pool_t *pool, uint32_t size);
extern easy_buf_t* easy_buf_clone_with_private_pool(easy_buf_t* b);
extern void easy_buf_set_cleanup(easy_buf_t *b, easy_buf_cleanup_pt *cleanup, void *args);
extern void easy_buf_set_data(easy_pool_t *pool, easy_buf_t *b, const void *data, uint32_t size);
extern easy_buf_t *easy_buf_pack(easy_pool_t *pool, const void *data, uint32_t size);
extern easy_file_buf_t *easy_file_buf_create(easy_pool_t *pool);
extern void easy_buf_destroy(easy_buf_t *b);
extern int easy_buf_check_read_space(easy_pool_t *pool, easy_buf_t *b, uint32_t size);
extern easy_buf_t *easy_buf_check_write_space(easy_pool_t *pool, easy_list_t *bc, uint32_t size);
extern void easy_file_buf_set_close(easy_file_buf_t *b);

extern void easy_buf_chain_clear(easy_list_t *l);
extern void easy_buf_chain_offer(easy_list_t *l, easy_buf_t *b);

///////////////////////////////////////////////////////////////////////////////////////////////////
// easy_buf_string

#define easy_buf_string_set(str, text) {(str)->len=strlen(text); (str)->data=(char*)text;}

static inline char *easy_buf_string_ptr(easy_buf_string_t *s)
{
    return s->data;
}

static inline void easy_buf_string_append(easy_buf_string_t *s,
        const char *value, int len)
{
    s->data = (char *)(value - s->len);
    s->len += len;
}

static inline int easy_buf_len(easy_buf_t *b)
{
    if (unlikely(b->flags & EASY_BUF_FILE))
        return (int)(((easy_file_buf_t *)b)->count);
    else
        return (int)(b->last - b->pos);
}

extern int easy_buf_string_copy(easy_pool_t *pool, easy_buf_string_t *d, const easy_buf_string_t *s);
extern int easy_buf_string_printf(easy_pool_t *pool, easy_buf_string_t *d, const char *fmt, ...);
extern int easy_buf_list_len(easy_list_t *l);

#define EASY_FSTR           ".*s"
#define EASY_PSTR(a)        ((a)->len),((a)->data)
static const easy_buf_string_t easy_string_null = {(char *)"", 0};

EASY_CPP_END

#endif

```

### Core Architecture Module: `deps/easy/src/util/easy_hash.c`
```
#include "util/easy_hash.h"

#define EASY_KEY_MAX_SIZE 65
static uint32_t easy_hash_getm(uint32_t size);
static uint32_t         easy_http_hdr_hseed = 5;
static int easy_hash_string_tolower(const char *src, int slen, char *dst, int dlen);

/**
 * 创建一easy_hash_t
 */
easy_hash_t *easy_hash_create(easy_pool_t *pool, uint32_t size, int offset)
{
    easy_hash_t             *table;
    easy_hash_list_t        **buckets;
    uint32_t                n = easy_hash_getm(size);

    // alloc
    buckets = (easy_hash_list_t **)easy_pool_calloc(pool, n * sizeof(easy_hash_list_t *));
    table = (easy_hash_t *)easy_pool_alloc(pool, sizeof(easy_hash_t));

    if (table == NULL || buckets == NULL)
        return NULL;

    table->buckets = buckets;
    table->size = n;
    table->mask = n - 1;
    table->count = 0;
    table->offset = offset;
    table->seqno = 1;
    easy_list_init(&table->list);

    return table;
}

easy_hash_t *easy_hash_create_without_pool(uint32_t size, int offset)
{
    easy_pool_t* pool = easy_pool_create(4096);
    easy_hash_t* table = NULL;
    if (pool) {
        if (NULL == (table = easy_hash_create(pool, size, offset))) {
            easy_pool_destroy(pool);
        }
    }
    return table;
}

int easy_hash_add(easy_hash_t *table, uint64_t key, easy_hash_list_t *list)
{
    uint64_t                n;
    easy_hash_list_t        *first;

    n = easy_hash_key(key);
    n &= table->mask;

    // init
    list->key = key;
    table->count ++;
    table->seqno ++;

    // add to list
    first = table->buckets[n];
    list->next = first;

    if (first)
        first->pprev = &list->next;

    table->buckets[n] = (easy_hash_list_t *)list;
    list->pprev = &(table->buckets[n]);

    return EASY_OK;
}

void easy_hash_clear(easy_hash_t *table)
{
    int                     i;
    easy_hash_list_t        *node;

    for (i = 0; i < table->size; i++) {
        if ((node = table->buckets[i])) {
            node->pprev = NULL;
        }

        table->buckets[i] = NULL;
    }
}

void *easy_hash_find(easy_hash_t *table, uint64_t key)
{
    uint64_t                n;
    easy_hash_list_t        *list;

    n = easy_hash_key(key);
    n &= table->mask;
    list = table->buckets[n];

    // foreach
    while (list) {
        if (list->key == key) {
            return ((char *)list - table->offset);
        }

        list = list->next;
    }

    return NULL;
}

void *easy_hash_find_ex(easy_hash_t *table, uint64_t key, easy_hash_cmp_pt cmp, const void *a)
{
    uint64_t                n;
    easy_hash_list_t        *list;

    n = easy_hash_key(key);
    n &= table->mask;
    list = table->buckets[n];

    // foreach
    while (list) {
        if (list->key == key) {
            if (cmp(a, ((char *)list - table->offset)) == 0)
                return ((char *)list - table->offset);
        }

        list = list->next;
    }

    return NULL;
}

void *easy_hash_del(easy_hash_t *table, uint64_t key)
{
    uint64_t                n;
    easy_hash_list_t        *list;

    n = easy_hash_key(key);
    n &= table->mask;
    list = table->buckets[n];

    // foreach
    while (list) {
        if (list->key == key) {
            easy_hash_del_node(list);
            table->count --;

            return ((char *)list - table->offset);
        }

        list = list->next;
    }

    return NULL;
}

int easy_hash_del_node(easy_hash_list_t *node)
{
    easy_hash_list_t        *next, **pprev;

    if (!node->pprev)
        return 0;

    next = node->next;
    pprev = node->pprev;
    *pprev = next;

    if (next) next->pprev = pprev;

    node->next = NULL;
    node->pprev = NULL;

    return 1;
}

int easy_hash_dlist_add(easy_hash_t *table, uint64_t key, easy_hash_list_t *hash, easy_list_t *list)
{
    easy_list_add_tail(list, &table->list);
    return easy_hash_add(table, key, hash);
}

void *easy_hash_dlist_del(easy_hash_t *table, uint64_t key)
{
    char                    *object;

    if ((object = (char *)easy_hash_del(table, key)) != NULL) {
        easy_list_del((easy_list_t *)(object + table->offset + sizeof(easy_hash_list_t)));
    }

    return object;
}

/**
 * string hash
 */
easy_hash_string_t *easy_hash_string_create(easy_pool_t *pool, uint32_t size, int ignore_case)
{
    easy_hash_string_t      *table;
    easy_string_pair_t      **buckets;
    uint32_t                n = easy_hash_getm(size);

    // alloc
    buckets = (easy_string_pair_t **)easy_pool_calloc(pool, n * sizeof(easy_string_pair_t *));
    table = (easy_hash_string_t *)easy_pool_alloc(pool, sizeof(easy_hash_string_t));

    if (table == NULL || buckets == NULL)
        return NULL;

    table->buckets = buckets;
    table->size = n;
    table->mask = n - 1;
    table->count = 0;
    table->ignore_case = ignore_case;
    easy_list_init(&table->list);

    return table;
}

/**
 * add string to table
 */
void easy_hash_string_add(easy_hash_string_t *table, easy_string_pair_t *header)
{
    uint64_t                n;
    int                     len;
    char                    *key, buffer[EASY_KEY_MAX_SIZE];

    key = easy_buf_string_ptr(&header->name);
    len = header->name.len;

    // 转小写
    if (table->ignore_case) {
        len = easy_hash_string_tolower(key, len, buffer, EASY_KEY_MAX_SIZE - 1);
        key = buffer;
    }

    n = easy_fnv_hashcode(key, len, easy_http_hdr_hseed);
    n &= table->mask;
    header->next = table->buckets[n];
    table->buckets[n] = header;
    table->count ++;
    easy_list_add_tail(&header->list, &table->list);
}

/**
 * find string
 */
easy_string_pair_t *easy_hash_string_get(easy_hash_string_t *table, const char *key, int len)
{
    uint64_t                n;
    easy_string_pair_t      *t;
    char                    buffer[EASY_KEY_MAX_SIZE];

    // 转小写
    if (table->ignore_case) {
        len = easy_hash_string_tolower(key, len, buffer, EASY_KEY_MAX_SIZE - 1);
        key = buffer;
    }

    n = easy_fnv_hashcode(key, len, easy_http_hdr_hseed);
    n &= table->mask;

    // ignore_case
    if (table->ignore_case) {
        char                    buffer1[EASY_KEY_MAX_SIZE];

        for (t = table->buckets[n]; t; t = t->next) {
            if (t->name.len != len) continue;

            easy_hash_string_tolower(t->name.data, len, buffer1, EASY_KEY_MAX_SIZE - 1);

            if (memcmp(key, buffer1, len) == 0)
                return t;
        }
    } else {
        for (t = table->buckets[n]; t; t = t->next) {
            if (t->name.len != len) continue;

            if (memcmp(key, t->name.data, len) == 0)
                return t;
        }
    }

    return NULL;
}

/**
 * delete string
 */
easy_string_pair_t *easy_hash_string_del(easy_hash_string_t *table, const char *key, int len)
{
    uint64_t                n;
    easy_string_pair_t      *t, *prev;
    char                    buffer[EASY_KEY_MAX_SIZE], buffer1[EASY_KEY_MAX_SIZE];

    // 转小写
    if (table->ignore_case) {
        len = easy_hash_string_tolower(key, len, buffer, EASY_KEY_MAX_SIZE - 1);
        key = buffer;
    }

    n = easy_fnv_hashcode(key, len, easy_http_hdr_hseed);
    n &= table->mask;

    // list
    for (t = table->buckets[n], prev = NULL; t; prev = t, t = t->next) {
        if (t->name.len != len) continue;

        if (table->ignore_case) {
            easy_hash_string_tolower(t->name.data, len, buffer1, EASY_KEY_MAX_SIZE - 1);

            if (memcmp(key, buffer1, len)) continue;
        } else if (memcmp(key, t->name.data, len)) {
            continue;
        }

        // delete from list
        if (prev)
            prev->next = t->next;
        else
            table->buckets[n] = t->next;

        t->next = NULL;
        table->count --;
        easy_list_del(&t->list);
        return t;
    }

    return NULL;
}

/**
 * delete string
 */
easy_string_pair_t *easy_hash_pair_del(easy_hash_string_t *table, easy_string_pair_t *pair)
{
    uint64_t                n;
    easy_string_pair_t      *t, *prev;
    char                    buffer[EASY_KEY_MAX_SIZE];
    char                    *key;
    int                     len;

    // 转小写
    if (table->ignore_case) {
        len = easy_hash_string_tolower(pair->name.data, pair->name.len, buffer, EASY_KEY_MAX_SIZE - 1);
        key = buffer;
    } else {
        len = pair->name.len;
        key = pair->name.data;
    }

    n = easy_fnv_hashcode(key, len, easy_http_hdr_hseed);

    n &= table->mask;

    // list
    for (t = table->buckets[n], prev = NULL; t; prev = t, t = t->next) {
        if (t != pair)
            continue;

        // delete from list
        if (prev)
            prev->next = t->next;
        else
            table->buckets[n] = t->next;

        t->next = NULL;
        table->count --;
        easy_list_del(&t->list);
        return t;
    }

    return NULL;
}
///////////////////////////////////////////////////////////////////////////////////////////////////
// hash 64 bit
uint64_t easy_hash_key(volatile uint64_t key)
{
    void                    *ptr = (void *) &key;
    return easy_hash_code(ptr, sizeof(uint64_t), 5);
}

#define ROL64(x, n) (((x) << (n)) | ((x) >> (64-(n))))
#define ROL(x, n) (((x) << (n)) | ((x) >> (32-(n))))

#ifdef _LP64
#define BIG_CONSTANT(x) (x##LLU)
#define HASH_FMIX(k) { k ^= k >> 33; k *= BIG_CONSTANT(0xff51afd7ed558ccd); k ^= k >> 33; k *= BIG_CONSTANT(0xc4ceb9fe1a85ec53); k ^= k >> 33; }

uint64_t easy_hash_code(const void *key, int len, unsigned int seed)
{
    int                     i;
    uint64_t                h1, h2, k1, k2;

    const uint8_t           *data = (const uint8_t *)key;
    const int               nblocks = len / 16;
    const uint64_t          c1 = BIG_CONSTANT(0x87c37b91114253d5);
    const uint64_t          c2 = BIG_CONSTANT(0x4cf5ad432745937f);
    const uint64_t          *blocks = (const uint64_t *)(data);

    h1 = h2 = seed;

    for (i = 0; i < nblocks; i += 2) {
        k1 = blocks[i];
        k2 = blocks[i + 1];

        k1                      *= c1;
        k1  = ROL6
```

### Core Architecture Module: `deps/easy/src/util/easy_hash.h`
```
#ifndef EASY_HASH_H_
#define EASY_HASH_H_

/**
 * 固定HASH桶的hashtable, 需要在使用的对象上定义一个easy_hash_list_t
 */
#include "util/easy_pool.h"
#include "easy_list.h"
#include "util/easy_buf.h"

EASY_CPP_START

typedef struct easy_hash_t easy_hash_t;
typedef struct easy_hash_list_t easy_hash_list_t;
typedef struct easy_string_pair_t easy_string_pair_t;
typedef struct easy_hash_string_t easy_hash_string_t;
typedef int (easy_hash_cmp_pt)(const void *a, const void *b);

struct easy_hash_t {
    easy_hash_list_t        **buckets;
    uint32_t                size;
    uint32_t                mask;
    uint32_t                count;
    int16_t                 offset;
    int16_t                 flags;
    uint64_t                seqno;
    easy_list_t             list;
};

struct easy_hash_list_t {
    easy_hash_list_t        *next;
    easy_hash_list_t        **pprev;
    uint64_t                key;
};

// string hash
struct easy_hash_string_t {
    easy_string_pair_t      **buckets;
    uint32_t                size;
    uint32_t                mask;
    uint32_t                count;
    int                     ignore_case;
    easy_list_t             list;
};

struct easy_string_pair_t {
    /* capitalize header name */
    easy_buf_string_t       name;
    easy_buf_string_t       value;
    easy_string_pair_t     *next;
    easy_list_t             list;
    void                   *user_data;
};

#define easy_hash_for_each(i, node, table)                      \
    for(i=0; i<table->size; i++)                                \
        for(node = table->buckets[i]; node; node = node->next)

extern easy_hash_t *easy_hash_create_without_pool(uint32_t size, int offset);
extern easy_hash_t *easy_hash_create(easy_pool_t *pool, uint32_t size, int offset);
extern int easy_hash_add(easy_hash_t *table, uint64_t key, easy_hash_list_t *list);
extern void easy_hash_clear(easy_hash_t *table);
extern void *easy_hash_find(easy_hash_t *table, uint64_t key);
void *easy_hash_find_ex(easy_hash_t *table, uint64_t key, easy_hash_cmp_pt cmp, const void *a);
extern void *easy_hash_del(easy_hash_t *table, uint64_t key);
extern int easy_hash_del_node(easy_hash_list_t *n);
extern uint64_t easy_hash_key(uint64_t key);
extern uint64_t easy_hash_code(const void *key, int len, unsigned int seed);
extern uint64_t easy_fnv_hashcode(const void *key, int wrdlen, unsigned int seed);

extern int easy_hash_dlist_add(easy_hash_t *table, uint64_t key, easy_hash_list_t *hash, easy_list_t *list);
extern void *easy_hash_dlist_del(easy_hash_t *table, uint64_t key);

// string hash
extern easy_hash_string_t *easy_hash_string_create(easy_pool_t *pool, uint32_t size, int ignore_case);
extern void easy_hash_string_add(easy_hash_string_t *table, easy_string_pair_t *header);
extern easy_string_pair_t *easy_hash_string_get(easy_hash_string_t *table, const char *key, int len);
extern easy_string_pair_t *easy_hash_string_del(easy_hash_string_t *table, const char *key, int len);
extern easy_string_pair_t *easy_hash_pair_del(easy_hash_string_t *table, easy_string_pair_t *pair);

EASY_CPP_END

#endif

```

### Core Architecture Module: `deps/easy/src/util/easy_inet.c`
```
#include "util/easy_inet.h"
#include "util/easy_string.h"
#include <netdb.h>
#include <arpa/inet.h>      // inet_addr
#include <sys/ioctl.h>
#include <linux/if.h>

/**
 * 把sockaddr_in转成string
 */
char *easy_inet_addr_to_str(easy_addr_t *addr, char *buffer, int len)
{
    unsigned char           *b;

    if (addr->family == AF_INET6) {
        char                    tmp[INET6_ADDRSTRLEN];

        if (inet_ntop(AF_INET6, addr->u.addr6, tmp, INET6_ADDRSTRLEN) != NULL) {
            if (addr->port) {
                lnprintf(buffer, len, "[%s]:%d", tmp, ntohs(addr->port));
            } else {
                lnprintf(buffer, len, "%s", tmp);
            }
        }
    } else {
        b = (unsigned char *) &addr->u.addr;

        if (addr->port)
            lnprintf(buffer, len, "%d.%d.%d.%d:%d", b[0], b[1], b[2], b[3], ntohs(addr->port));
        else
            lnprintf(buffer, len, "%d.%d.%d.%d", b[0], b[1], b[2], b[3]);
    }

    return buffer;
}

/**
 * 把str转成addr(用uint64_t表示,IPV4)
 */
easy_addr_t easy_inet_str_to_addr(const char *host, int port)
{
    easy_addr_t             address;
    char                    *p, buffer[64];
    int                     len = -1, ipv6 = 0;

    memset(&address, 0, sizeof(easy_addr_t));

    if (host) {
        if (*host == '[' && (p = strchr(host, ']')) != NULL) {
            host ++;
            len = p - host;
            p = (*(p + 1) == ':') ? (p + 2) : NULL;
            ipv6 = 0x10000;
        } else if ((p = strchr(host, ':')) != NULL && (p == strrchr(host, ':'))) {
            len = p - host;
            p ++;
        }

        if (len > 63)
            return address;

        if (len >= 0) {
            memcpy(buffer, host, len);
            buffer[len] = '\0';
            host = buffer;

            if (!port && p) port = atoi(p);
        }
    }

    // parse host
    easy_inet_parse_host(&address, host, (port | ipv6));

    return address;
}

/**
 * 把端口改变一下
 */
easy_addr_t easy_inet_add_port(easy_addr_t *addr, int diff)
{
    easy_addr_t             ret;

    memcpy(&ret, addr, sizeof(easy_addr_t));
    ret.port = ntohs(ntohs(addr->port) + diff);
    return ret;
}

/**
 * 是IP地址, 如: 192.168.1.2
 */
int easy_inet_is_ipaddr(const char *host)
{
    unsigned char           c, *p;

    p = (unsigned char *)host;

    while ((c = (*p++)) != '\0') {
        if ((c != '.') && (c < '0' || c > '9')) {
            return 0;
        }
    }

    return 1;
}

/**
 * 解析host
 */
int easy_inet_parse_host(easy_addr_t *addr, const char *host, int port)
{
    int                     family = AF_INET;

    memset(addr, 0, sizeof(easy_addr_t));

    if (host && host[0]) {
        int                     rc;

        if (easy_inet_is_ipaddr(host)) {
            if ((rc = inet_addr(host)) == INADDR_NONE) {
                return EASY_ERROR;
            }

            addr->u.addr = rc;
        } else if (inet_pton(AF_INET6, host, addr->u.addr6) > 0) {
            family = AF_INET6;
        } else {
            // FIXME: gethostbyname会阻塞
            char                    buffer[1024];
            struct  hostent         h, *hp;

            if (gethostbyname_r(host, &h, buffer, 1024, &hp, &rc) || hp == NULL)
                return EASY_ERROR;

            if (hp->h_addrtype == AF_INET6) {
                family = AF_INET6;
                memcpy(addr->u.addr6, hp->h_addr, sizeof(addr->u.addr6));
            } else {
                addr->u.addr = *((uint32_t *)(hp->h_addr));
            }
        }
    } else if ((port & 0x10000)) {
        family = AF_INET6;
    } else {
        addr->u.addr = htonl(INADDR_ANY);
    }

    addr->family = family;
    addr->port = htons((port & 0xffff));

    return EASY_OK;
}

/**
 * 得到本机所有IP
 */
int easy_inet_hostaddr(uint64_t *address, int size, int local)
{
    int                     fd, ret, n;
    struct ifconf           ifc;
    struct ifreq            *ifr;

    ret = 0;

    if ((fd = socket(AF_INET, SOCK_DGRAM, 0)) < 0)
        return 0;

    ifc.ifc_len = sizeof(struct ifreq) * easy_max(size, 16);
    ifc.ifc_buf = (char *) malloc(ifc.ifc_len);

    if (ioctl(fd, SIOCGIFCONF, (char *)&ifc) < 0)
        goto out;

    ifr = ifc.ifc_req;

    for (n = 0; n < ifc.ifc_len; n += sizeof(struct ifreq)) {
        if (local || strncmp(ifr->ifr_name, "lo", 2)) {
            memcpy(&address[ret++], &(ifr->ifr_addr), sizeof(uint64_t));
        }

        ifr++;
    }

out:
    easy_free(ifc.ifc_buf);
    close(fd);
    return ret;
}

/**
 * 根据默认路由,得到本机IP
 */
int easy_inet_myip(easy_addr_t *addr)
{
    int             fd;
    socklen_t       addrlen = sizeof(easy_addr_t);

    memset(addr, 0, addrlen);
    addr->family = AF_INET;
    addr->port = 17152;
    addr->u.addr = 1481263425;

    if ((fd = socket(AF_INET, SOCK_DGRAM, 0)) < 0)
        goto error_exit;

    if (connect(fd, (struct sockaddr *) addr, addrlen) < 0)
        goto error_exit;

    if (getsockname(fd, (struct sockaddr *) addr, &addrlen) < 0)
        goto error_exit;

    addr->port = 0;
    close(fd);
    return EASY_OK;

error_exit:
    addr->port = 0;
    addr->u.addr = 0;

    if (fd >= 0) close(fd);

    return EASY_ERROR;
}

/**
 *get fd addr
 */
easy_addr_t easy_inet_getpeername(int s)
{
    socklen_t               len;
    struct sockaddr_storage addr;
    easy_addr_t             ret;

    len = sizeof(addr);
    memset(&ret, 0, sizeof(easy_addr_t));

    if (getpeername(s, (struct sockaddr *) &addr, &len) == 0) {
        easy_inet_atoe(&addr, &ret);
    }

    return ret;
}

/**
 *
 */
void easy_inet_atoe(void *a, easy_addr_t *e)
{
    struct sockaddr_storage *addr = (struct sockaddr_storage *) a;
    memset(e, 0, sizeof(easy_addr_t));

    if (addr->ss_family == AF_UNIX) {
        e->family = AF_UNIX;
    } else if (addr->ss_family == AF_INET) {
        struct sockaddr_in      *s = (struct sockaddr_in *)a;
        e->family = AF_INET;
        e->port = s->sin_port;
        e->u.addr = s->sin_addr.s_addr;
    } else {
        struct sockaddr_in6     *s = (struct sockaddr_in6 *)a;
        e->family = AF_INET6;
        e->port = s->sin6_port;
        memcpy(e->u.addr6, &s->sin6_addr, sizeof(e->u.addr6));
    }
}

void easy_inet_etoa(easy_addr_t *e, void *a)
{
    if (e->family == AF_INET6) {
        struct sockaddr_in6     *s = (struct sockaddr_in6 *)a;
        s->sin6_family = AF_INET6;
        s->sin6_port = e->port;
        memcpy(&s->sin6_addr, e->u.addr6, sizeof(e->u.addr6));
    } else if (e->family == AF_UNIX) {
        struct sockaddr_un *s = (struct sockaddr_un *)a;
        s->sun_family = AF_UNIX;
        snprintf(s->sun_path, UNIX_PATH_MAX, "%s", e->u.unix_path);
    } else {
        struct sockaddr_in      *s = (struct sockaddr_in *)a;
        s->sin_family = AF_INET;
        s->sin_port = e->port;
        s->sin_addr.s_addr = e->u.addr;
    }
}


```

### Core Architecture Module: `deps/easy/src/util/easy_inet.h`
```
#ifndef EASY_INET_H_
#define EASY_INET_H_

/**
 * inet的通用函数
 */
#include "easy_define.h"
#include <sys/un.h>
#ifndef UNIX_PATH_MAX
#define UNIX_PATH_MAX 16
#endif

EASY_CPP_START

extern char *easy_inet_addr_to_str(easy_addr_t *addr, char *buffer, int len);
extern easy_addr_t easy_inet_str_to_addr(const char *host, int port);
extern int easy_inet_parse_host(easy_addr_t *address, const char *host, int port);
extern int easy_inet_is_ipaddr(const char *host);
extern int easy_inet_hostaddr(uint64_t *address, int size, int local);
extern easy_addr_t easy_inet_add_port(easy_addr_t *addr, int diff);
extern easy_addr_t easy_inet_getpeername(int s);
extern void easy_inet_atoe(void *a, easy_addr_t *e);
extern void easy_inet_etoa(easy_addr_t *e, void *a);
extern int easy_inet_myip(easy_addr_t *addr);

EASY_CPP_END

#endif

```

### Core Architecture Module: `deps/easy/src/util/easy_mod_stat.c`
```
#include "util/easy_mod_stat.h"

typedef struct alloc_stat_header_t {
    mod_stat_t* mod_stat;
    int64_t size;
} alloc_stat_header_t;

#define MOD_STAT_COUNT (1<<16)
mod_stat_t global_mod_stat_table[MOD_STAT_COUNT];
__thread mod_stat_t* easy_cur_mod_stat;
extern void *easy_pool_default_realloc(void *ptr, size_t size);
void* (*realloc_lowlevel)(void*, size_t) = easy_pool_default_realloc;

static uint64_t rand64(uint64_t h)
{
    h ^= h >> 33;
    h *= 0xff51afd7ed558ccd;
    h ^= h >> 33;
    h *= 0xc4ceb9fe1a85ec53;
    h ^= h >> 33;
    return h;
}

static int try_set_slot(mod_stat_t* st, uint64_t id)
{
    uint64_t cur_id = __atomic_load_n(&st->id, __ATOMIC_SEQ_CST);

    if (cur_id != 0) {
        return cur_id == id;
    }
    return __sync_bool_compare_and_swap(&st->id, cur_id, id);
}

static mod_stat_t* get_mod_stat(uint64_t id)
{
    uint64_t i;
    uint64_t h = rand64(id);

    for (i = 0; i < MOD_STAT_COUNT; i++) {
        mod_stat_t* stat = global_mod_stat_table + ((h + i) % MOD_STAT_COUNT);
        if (try_set_slot(stat, id)) {
            return stat;
        }
    }
    return NULL;
}

static mod_stat_t* mod_stat_decode_header(alloc_stat_header_t* h, int64_t* size)
{
    *size = h->size;
    return h->mod_stat;
}

static mod_stat_t* mod_stat_encode_header(alloc_stat_header_t* h, mod_stat_t* stat, int64_t size)
{
    h->size = size;
    return h->mod_stat = stat;
}

static void update_mod_stat(mod_stat_t* stat, int64_t count_inc, int64_t size_inc)
{
    if (stat) {
        __sync_fetch_and_add(&stat->count, count_inc);
        __sync_fetch_and_add(&stat->size, size_inc);
    }
}

void* realloc_with_mod_stat(void* ptr, size_t size)
{
    const int64_t header_size = sizeof(alloc_stat_header_t);
    mod_stat_t* stat = NULL;
    if (ptr) {
        int64_t old_size = 0;
        ptr = (char*)ptr - header_size;
        stat = mod_stat_decode_header((alloc_stat_header_t*)ptr, &old_size);
        update_mod_stat(stat, -1, -old_size);
    }
    ptr = realloc_lowlevel(ptr, size > 0 ? size + header_size : 0);
    if (ptr) {
        stat = mod_stat_encode_header((alloc_stat_header_t*)ptr, easy_cur_mod_stat, size);
        update_mod_stat(stat, 1, size);
        ptr = (char*)ptr + header_size;
    }
    return ptr;
}

mod_stat_t* easy_fetch_mod_stat(uint64_t id)
{
    return get_mod_stat(id);
}

```

### Core Architecture Module: `deps/easy/src/util/easy_mod_stat.h`
```
#ifndef __EASY_MOD_STAT__
#define __EASY_MOD_STAT__

#include <stdint.h>
#include <sys/types.h>
#include "easy_define.h"
EASY_CPP_START

typedef struct mod_stat_t {
    uint64_t id;
    int64_t count;
    int64_t size;
} mod_stat_t;

extern __thread mod_stat_t* easy_cur_mod_stat;
extern mod_stat_t* easy_fetch_mod_stat(uint64_t id);
extern void* (*realloc_lowlevel)(void*, size_t);
extern void* realloc_with_mod_stat(void* ptr, size_t size);
typedef mod_stat_t easy_mod_stat_t;

EASY_CPP_END
#endif /* __EASY_MOD_STAT__ */

```

### Core Architecture Module: `deps/easy/src/util/easy_pool.c`
```
#include "easy_pool.h"
#include "io/easy_log.h"
#include "util/easy_mod_stat.h"

/**
 * 简单的内存池
 */

static void *easy_pool_alloc_block(easy_pool_t *pool, uint32_t size);
static void *easy_pool_alloc_large(easy_pool_t *pool, easy_pool_large_t *large, uint32_t size);
easy_pool_realloc_pt    easy_pool_realloc = easy_pool_default_realloc;
#define EASY_POOL_LOCK(pool) int kcolt = pool->flags; if (unlikely(kcolt)) easy_spin_lock(&pool->tlock);
#define EASY_POOL_UNLOCK(pool) if (unlikely(kcolt)) easy_spin_unlock(&pool->tlock);

easy_pool_t *easy_pool_create(uint32_t size)
{
    easy_pool_t             *p;

    // 对齐
    size = easy_align(size + sizeof(easy_pool_t), EASY_POOL_ALIGNMENT);

    if ((p = (easy_pool_t *)easy_pool_realloc(NULL, size)) == NULL)
        return NULL;

    memset(p, 0, sizeof(easy_pool_t));
    p->last = (uint8_t *) p + sizeof(easy_pool_t);
    p->end = (uint8_t *) p + size;
    p->max = size - sizeof(easy_pool_t);
    p->current = p;
    p->mod_stat = easy_cur_mod_stat;
#ifdef EASY_DEBUG_MAGIC
    p->magic = EASY_DEBUG_MAGIC_POOL;
#endif

    return p;
}

// clear
void easy_pool_clear(easy_pool_t *pool)
{
    easy_pool_t             *p, *n;
    easy_pool_large_t       *l;
    easy_pool_cleanup_t     *cl;

    // cleanup
    for (cl = pool->cleanup; cl; cl = cl->next) {
        if (cl->handler)(*cl->handler)(cl->data);
    }

    // large
    for (l = pool->large; l; l = l->next) {
        easy_pool_realloc(l->data, 0);
    }

    // other page
    for (p = pool->next; p; p = n) {
        n = p->next;
        easy_pool_realloc(p, 0);
    }

    pool->cleanup = NULL;
    pool->large = NULL;
    pool->next = NULL;
    pool->current = pool;
    pool->failed = 0;
    pool->last = (uint8_t *) pool + sizeof(easy_pool_t);
}

void easy_pool_destroy(easy_pool_t *pool)
{
    EASY_STAT_TIME_GUARD(ev_malloc_count, ev_malloc_time);
    easy_pool_clear(pool);
    assert(pool->ref == 0);
#ifdef EASY_DEBUG_MAGIC
    pool->magic ++;
#endif
    easy_pool_realloc(pool, 0);
}

void *easy_pool_alloc_ex(easy_pool_t *pool, uint32_t size, int align)
{
    EASY_STAT_TIME_GUARD_WITH_SIZE(ev_malloc_count, ev_malloc_time, size);
    uint8_t                 *m;
    easy_pool_t             *p;
    int                     dsize;

    // init
    dsize = 0;

    if (size > pool->max) {
        dsize = size;
        size = sizeof(easy_pool_large_t);
    }

    EASY_POOL_LOCK(pool);

    p = pool->current;

    do {
        m = easy_align_ptr(p->last, align);

        if (m + size <= p->end) {
            p->last = m + size;
            break;
        }

        p = p->next;
    } while (p);

    easy_cur_mod_stat = pool->mod_stat;
    // 重新分配一块出来
    if (p == NULL) {
        m = (uint8_t *)easy_pool_alloc_block(pool, size);
    }

    if (m && dsize) {
        m = (uint8_t *)easy_pool_alloc_large(pool, (easy_pool_large_t *)m, dsize);
    }
    easy_cur_mod_stat = NULL;

    EASY_POOL_UNLOCK(pool);

    return m;
}

void *easy_pool_calloc(easy_pool_t *pool, uint32_t size)
{
    void                    *p;

    if ((p = easy_pool_alloc_ex(pool, size, sizeof(long))) != NULL)
        memset(p, 0, size);

    return p;
}

// set lock
void easy_pool_set_lock(easy_pool_t *pool)
{
    pool->flags = 1;
}

// set realloc
void easy_pool_set_allocator(easy_pool_realloc_pt alloc)
{
    easy_pool_realloc = (alloc ? alloc : easy_pool_default_realloc);
    realloc_lowlevel = easy_pool_realloc;
    easy_pool_realloc = realloc_with_mod_stat;
}

void *easy_pool_default_realloc(void *ptr, size_t size)
{
    if (size) {
        return realloc(ptr, size);
    } else if (ptr) {
        free(ptr);
    }

    return 0;
}
///////////////////////////////////////////////////////////////////////////////////////////////////
// default realloc

static void *easy_pool_alloc_block(easy_pool_t *pool, uint32_t size)
{
    uint8_t                 *m;
    uint32_t                psize;
    easy_pool_t             *p, *newpool, *current;

    psize = (uint32_t)(pool->end - (uint8_t *) pool);

    if ((m = (uint8_t *)easy_pool_realloc(NULL, psize)) == NULL)
        return NULL;

    newpool = (easy_pool_t *) m;
    newpool->end = m + psize;
    newpool->next = NULL;
    newpool->failed = 0;

    m += offsetof(easy_pool_t, current);
    m = easy_align_ptr(m, sizeof(unsigned long));
    newpool->last = m + size;
    current = pool->current;

    if (NULL != current) {
        for (p = current; p->next; p = p->next) {
            if (p->failed++ > 4) {
                current = p->next;
            }
        }
        p->next = newpool;
    }

    pool->current = current ? current : newpool;

    return m;
}

static void *easy_pool_alloc_large(easy_pool_t *pool, easy_pool_large_t *large, uint32_t size)
{
    if ((large->data = (uint8_t *)easy_pool_realloc(NULL, size)) == NULL)
        return NULL;

    large->next = pool->large;
    large->size = size;
    pool->large = large;
    return large->data;
}

/**
 * strdup
 */
char *easy_pool_strdup(easy_pool_t *pool, const char *str)
{
    int                     sz;
    char                    *ptr;

    if (str == NULL)
        return NULL;

    sz = strlen(str) + 1;

    if ((ptr = (char *)easy_pool_alloc(pool, sz)) == NULL)
        return NULL;

    memcpy(ptr, str, sz);
    return ptr;
}

easy_pool_cleanup_t *easy_pool_cleanup_new(easy_pool_t *pool, const void *data, easy_pool_cleanup_pt *handler)
{
    easy_pool_cleanup_t *cl;
    cl = easy_pool_alloc(pool, sizeof(easy_pool_cleanup_t));

    if (cl) {
        cl->handler = handler;
        cl->data = data;
    }

    return cl;
}

void easy_pool_cleanup_reg(easy_pool_t *pool, easy_pool_cleanup_t *cl)
{
    EASY_POOL_LOCK(pool);
    cl->next = pool->cleanup;
    pool->cleanup = cl;
    EASY_POOL_UNLOCK(pool);
}

```

### Core Architecture Module: `deps/easy/src/util/easy_pool.h`
```
#ifndef EASY_POOL_H_
#define EASY_POOL_H_

/**
 * 简单的内存池
 */
#include "easy_define.h"
#include "easy_list.h"
#include "easy_atomic.h"

EASY_CPP_START

#ifdef EASY_DEBUG_MAGIC
#define EASY_DEBUG_MAGIC_POOL     0x4c4f4f5059534145
#define EASY_DEBUG_MAGIC_MESSAGE  0x4753454d59534145
#define EASY_DEBUG_MAGIC_SESSION  0x5353455359534145
#define EASY_DEBUG_MAGIC_CONNECT  0x4e4e4f4359534145
#define EASY_DEBUG_MAGIC_REQUEST  0x5551455259534145
#endif

#define EASY_POOL_ALIGNMENT         512
#define EASY_POOL_PAGE_SIZE         4096
#define easy_pool_alloc(pool, size)  easy_pool_alloc_ex(pool, size, sizeof(long))
#define easy_pool_nalloc(pool, size) easy_pool_alloc_ex(pool, size, 1)

typedef void *(*easy_pool_realloc_pt)(void *ptr, size_t size);
typedef struct easy_pool_large_t easy_pool_large_t;
typedef struct easy_pool_t easy_pool_t;
typedef void (easy_pool_cleanup_pt)(const void *data);
typedef struct easy_pool_cleanup_t easy_pool_cleanup_t;

struct easy_pool_large_t {
    easy_pool_large_t       *next;
    uint8_t                 *data;
    uint32_t                size;
};

struct easy_pool_cleanup_t {
    easy_pool_cleanup_pt    *handler;
    easy_pool_cleanup_t     *next;
    const void              *data;
};

struct mod_stat_t;
struct easy_pool_t {
    uint8_t                 *last;
    uint8_t                 *end;
    easy_pool_t             *next;
    uint16_t                failed;
    uint16_t                flags;
    uint32_t                max;

    // pool header
    easy_pool_t             *current;
    easy_pool_large_t       *large;
    easy_atomic_t           ref;
    easy_atomic_t           tlock;
    easy_pool_cleanup_t     *cleanup;
    struct mod_stat_t* mod_stat;
#ifdef EASY_DEBUG_MAGIC
    uint64_t                magic;
#endif
};

extern easy_pool_realloc_pt easy_pool_realloc;
extern void *easy_pool_default_realloc (void *ptr, size_t size);

extern easy_pool_t *easy_pool_create(uint32_t size);
extern void easy_pool_clear(easy_pool_t *pool);
extern void easy_pool_destroy(easy_pool_t *pool);
extern void *easy_pool_alloc_ex(easy_pool_t *pool, uint32_t size, int align);
extern void *easy_pool_calloc(easy_pool_t *pool, uint32_t size);
extern void easy_pool_set_allocator(easy_pool_realloc_pt alloc);
extern void easy_pool_set_lock(easy_pool_t *pool);
extern easy_pool_cleanup_t *easy_pool_cleanup_new(easy_pool_t *pool, const void *data, easy_pool_cleanup_pt *handler);
extern void easy_pool_cleanup_reg(easy_pool_t *pool, easy_pool_cleanup_t *cl);

extern char *easy_pool_strdup(easy_pool_t *pool, const char *str);

EASY_CPP_END
#endif

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2398** (2026-05-08): **[Docs] Fix question issue template metadata**
  *Symptoms*: <!-- Thank you for contributing to **OceanBase**!  Please read the [How to Contribute](https://github.com/oceanbase/oceanbase/wiki/how_to_contribute) document **BEFORE** filling this PR.  **If this pull request have a significant impact, please make sure you have discussed with OceanBase group.** -->  ### Task Description  <!-- The problem you resolved by this pull request. You can link the issue via the "close #xxx" or "ref #xxx". -->  ### Solution Description  <!-- Please clearly and consice descipt the solution. -->  ### Passed Regressions  <!-- Unittest, mysql test or test it manually? -->  ### Upgrade Compatibility  <!-- Please make sure this is compatible with old version or you should give us upgrading solution. -->  ### Other Information  <!-- Any information helping to review this pull request. -->  ### Release Note <!-- A concise release note can help users to understand how your pull request makes difference. --> 
  **Post-Mortem & Fix Analysis**:
  > [![CLA assistant check](https://cla-assistant.io/pull/badge/not_signed)](https://cla-assistant.io/oceanbase/oceanbase?pullRequest=2398) <br/>Thank you for your submission! We really appreciate it. Like many open source projects, we ask that you sign our [Contributor License Agreement](https://cla-assistant.io/oceanbase/oceanbase?pullRequest=2398) before we can accept your contribution.<br/><sub>You have signed the CLA already but the status is still pending? Let us [recheck](https://cla-assistant.io/check/oceanbase/oceanbase?pullRequest=2398) it.</sub>

- **Issue #2392** (2026-05-14): **build ocenabase error, missing devdeps-vsag-1.1.0-1702026040114.el8.x86_64.rpm**
  *Symptoms*: ### Self Checks  - [x] I have read the [Contributing Guide](https://github.com/oceanbase/oceanbase/blob/develop/CONTRIBUTING.md). - [x] This is only for bug report, if you would like to ask a question, please head to [Discussions](https://github.com/oceanbase/oceanbase/discussions/categories/general). - [x] I have searched for existing issues [search for existing issues](https://github.com/oceanbase/oceanbase/issues), including closed ones. - [x] I confirm that I am using English to submit this report, otherwise it will be closed. - [x] 【中文用户 & Non English User】请使用英语提交，否则会被关闭 ：） - [x] Please do not modify this template :) and fill in all the required fields.  ### OceanBase version  4.3.5.6  ### Self Hosted  Self Hosted (Source)  ### Environment  centos7 x86  ### Steps to reproduce  1. cd /oceanbase/rpm && sh ./oceanbase-ce-build.sh /oceanbase oceanbase 4.3.5.6 106000012026040916  ### ✔️ Expected Behavior  build successfully  ### ❌ Actual Behavior  build error  <img width="1112" height="176" alt="Image" src="https://github.com/user-attachments/assets/50cdb3ae-1348-4878-9352-b9743a9a471e" />
  **Post-Mortem & Fix Analysis**:
  > Thank you for your feedback. The issue has been confirmed  
  > Thank you, the issue has been resolved.

- **Issue #2389** (2026-04-11): **oceanbase ci**
  *Symptoms*: <!-- Thank you for contributing to **OceanBase**!  Please read the [How to Contribute](https://github.com/oceanbase/oceanbase/wiki/how_to_contribute) document **BEFORE** filling this PR.  **If this pull request have a significant impact, please make sure you have discussed with OceanBase group.** -->  ### Task Description  <!-- The problem you resolved by this pull request. You can link the issue via the "close #xxx" or "ref #xxx". -->  ### Solution Description  <!-- Please clearly and consice descipt the solution. -->  ### Passed Regressions  <!-- Unittest, mysql test or test it manually? -->  ### Upgrade Compatibility  <!-- Please make sure this is compatible with old version or you should give us upgrading solution. -->  ### Other Information  <!-- Any information helping to review this pull request. -->  ### Release Note <!-- A concise release note can help users to understand how your pull request makes difference. --> 
  **Post-Mortem & Fix Analysis**:
  > [![CLA assistant check](https://cla-assistant.io/pull/badge/signed)](https://cla-assistant.io/oceanbase/oceanbase?pullRequest=2389) <br/>All committers have signed the CLA.

- **Issue #2388** (2026-03-31): **Dev oceanbase ci**
  *Symptoms*: <!-- Thank you for contributing to **OceanBase**!  Please read the [How to Contribute](https://github.com/oceanbase/oceanbase/wiki/how_to_contribute) document **BEFORE** filling this PR.  **If this pull request have a significant impact, please make sure you have discussed with OceanBase group.** -->  ### Task Description  <!-- The problem you resolved by this pull request. You can link the issue via the "close #xxx" or "ref #xxx". -->  ### Solution Description  <!-- Please clearly and consice descipt the solution. -->  ### Passed Regressions  <!-- Unittest, mysql test or test it manually? -->  ### Upgrade Compatibility  <!-- Please make sure this is compatible with old version or you should give us upgrading solution. -->  ### Other Information  <!-- Any information helping to review this pull request. -->  ### Release Note <!-- A concise release note can help users to understand how your pull request makes difference. --> 
  **Post-Mortem & Fix Analysis**:
  > [![CLA assistant check](https://cla-assistant.io/pull/badge/not_signed)](https://cla-assistant.io/oceanbase/oceanbase?pullRequest=2388) <br/>Thank you for your submission! We really appreciate it. Like many open source projects, we ask that you all sign our [Contributor License Agreement](https://cla-assistant.io/oceanbase/oceanbase?pullRequest=2388) before we can accept your contribution.<br/>**2** out of **3** committers have signed the CLA.<br/><br/>:white_check_mark: eddiezhou1<br/>:white_check_mark: guoyan1996<br/>:x: gy389672<br/><hr/>**gy389672** seems not to be a GitHub user. You need a GitHub account to be able to sign the CLA. If you have already a GitHub account, please [add the email address used for this commit to your account](https://help.github.com/articles/why-are-my-commits-linked-to-the-wrong-user/#commits-are-not-linked-to-any-user).<br/><sub>You have signed the CLA already but the status is still pending? Let us [recheck](https://cla-assistant.io/check/oceanbase/oc

- **Issue #2379** (2026-03-12): **fix: use KP() for binary buffer pointers in PALF log statements**
  *Symptoms*: ## Summary - Changed `K(buf)` and `K(aligned_buf)` to `KP()` in `log_block_handler.cpp` - These variables are `char*` pointers to binary data, not null-terminated strings - Using `K()` on binary buffers logs garbled output and could read beyond buffer boundary - `KP()` safely prints the pointer address instead  Fixes #1863
  **Post-Mortem & Fix Analysis**:
  > [![CLA assistant check](https://cla-assistant.io/pull/badge/not_signed)](https://cla-assistant.io/oceanbase/oceanbase?pullRequest=2379) <br/>Thank you for your submission! We really appreciate it. Like many open source projects, we ask that you sign our [Contributor License Agreement](https://cla-assistant.io/oceanbase/oceanbase?pullRequest=2379) before we can accept your contribution.<br/><sub>You have signed the CLA already but the status is still pending? Let us [recheck](https://cla-assistant.io/check/oceanbase/oceanbase?pullRequest=2379) it.</sub>
  > Closing this PR as I'm unable to sign the CLA at this time. Sorry for the noise.

- **Issue #2378** (2026-03-12): **fix: correct typo 'initilize' to 'initialize' in ob_spi.cpp**
  *Symptoms*: ## Summary - Fix typo in `src/sql/ob_spi.cpp` line 4602: `initilize` → `initialize`  Fixes #1265
  **Post-Mortem & Fix Analysis**:
  > [![CLA assistant check](https://cla-assistant.io/pull/badge/not_signed)](https://cla-assistant.io/oceanbase/oceanbase?pullRequest=2378) <br/>Thank you for your submission! We really appreciate it. Like many open source projects, we ask that you sign our [Contributor License Agreement](https://cla-assistant.io/oceanbase/oceanbase?pullRequest=2378) before we can accept your contribution.<br/><sub>You have signed the CLA already but the status is still pending? Let us [recheck](https://cla-assistant.io/check/oceanbase/oceanbase?pullRequest=2378) it.</sub>
  > Closing this PR as I'm unable to sign the CLA at this time. Sorry for the noise.

- **Issue #2368** (2026-02-02): **How can I increase the number of ApplySrv threads in OceanBase ?**
  *Symptoms*: Hi team,  While tuning the performance of OceanBase, I noticed that the ApplySrv0 ~ ApplySrv4 threads (total 5 threads) are consistently running at 99% CPU usage. I would like to increase the number of ApplySrv threads to verify whether the apply service is becoming a bottleneck and slowing down overall performance.   ```       PID USER      PR  NI    VIRT    RES    SHR S  %CPU  %MEM     TIME+ COMMAND                                                                                                                                                                   319245 admin     20   0   15.2g  12.6g  23232 R  99.9   0.8   0:54.58 T1002_ApplySrv4                                                                                                                                                           317041 admin     20   0   15.2g  12.6g  23232 R  99.7   0.8   1:52.55 T1002_ApplySrv0                                                                                                                                                           318026 admin     20   0   15.2g  12.6g  23232 R  99.7   0.8   1:52.48 T1002_ApplySrv2                                                                                                                                                           319056 admin     20   0   15.2g  12.6g  23232 R  99.7   0.8   1:52.50 T1002_ApplySrv3                                                                                                                                
  **Post-Mortem & Fix Analysis**:
  > Hello,The number of threads is fixed
  > > Hello,The number of threads is fixed  hi could I increase the ApplySrv thread count by modifying and recompiling the code ?  
  > This is feasible.

- **Issue #2364** (2026-01-04): **docs: fix typos and rename file - Coding Convensions to Conventions, …**
  *Symptoms*: …Bais to Basic, and coding-convension.md to coding-convention.md  <!-- Thank you for contributing to **OceanBase**!  Please read the [How to Contribute](https://github.com/oceanbase/oceanbase/wiki/how_to_contribute) document **BEFORE** filling this PR.  **If this pull request have a significant impact, please make sure you have discussed with OceanBase group.** -->  ### Task Description  <!-- The problem you resolved by this pull request. You can link the issue via the "close #xxx" or "ref #xxx". -->  ### Solution Description  <!-- Please clearly and consice descipt the solution. -->  ### Passed Regressions  <!-- Unittest, mysql test or test it manually? -->  ### Upgrade Compatibility  <!-- Please make sure this is compatible with old version or you should give us upgrading solution. -->  ### Other Information  <!-- Any information helping to review this pull request. -->  ### Release Note <!-- A concise release note can help users to understand how your pull request makes difference. --> 

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

### Incident Patch 1: `4818a694` (2026-09-30)
**Commit Message**: Fix IVF in-row threshold checks to use payload length

**File**: `src/storage/ddl/ob_ddl_pipeline.cpp` (modified, +9/-6)
```diff
@@ -610,6 +610,7 @@ int ObIVFCenterRowIterator::get_next_row(
       LOG_WARN("upexpected nullptr center_vector", K(ret), K(cur_row_pos_));
     } else {
       data_str.assign(reinterpret_cast<char *>(center_vector), static_cast<int64_t>(sizeof(float) * dim));
+      // Check payload bytes against the in-row threshold, excluding the LOB header in vec_res.
       if (OB_FAIL(sql::ObArrayExprUtils::set_array_res(nullptr, data_str.length(), row_allocator_, vec_res, data_str.ptr()))) {
         LOG_WARN("failed to set array res", K(ret));
       } else if (OB_ISNULL(buf = static_cast<char*>(row_allocator_.alloc(buf_len)))) {
@@ -620,10 +621,10 @@ int ObIVFCenterRowIterator::get_next_row(
         ObCenterId center_id(tablet_id_.id(), cur_row_pos_ + 1);
         if (OB_FAIL(ObVectorClusterHelper::set_center_id_to_string(center_id, cid_str))) {
           LOG_WARN("failed to set center_id to string", K(ret), K(center_id), K(cid_str));
-        } else if (vec_res.length() > lob_inrow_threshold_ || cid_str.length() > lob_inrow_threshold_) {
+        } else if (data_str.length() > lob_inrow_threshold_ || cid_str.length() > lob_inrow_threshold_) {
           ret = OB_ERR_UNEXPECTED;
           LOG_WARN("unexpected outrow datum in ivf vector index",
-                    K(ret), K(vec_res.length()), K(cid_str.length()), K(lob_inrow_threshold_));
+                    K(ret), K(data_str.length()), K(vec_res.length()), K(cid_str.length()), K(lob_inrow_threshold_));
         } else {
           for (int64_t i = 0; i < current_row_.get_column_count(); ++i) {
             if (center_vector_col_idx_ == i) {
@@ -701,6 +702,7 @@ int ObIVFSq8MetaRowIterator::get_next_row(
       LOG_WARN("fail to get result", K(ret));
     } else {
       data_str.assign(reinterpret_cast<char *>(cur_vector), static_cast<int64_t>(sizeof(float) * vec_dim_));
+      // Check payload bytes against the in-row threshold, excluding the LOB header in vec_res.
       if (OB_FAIL(sql::ObArrayExprUtils::set_array_res(nullptr, data_str.length(), row_allocator_, vec_res, data_str.ptr()))) {
         LOG_WARN("failed to set array res", K(ret));
       } else if (OB_ISNULL(buf = static_cast<char*>(row_allocator_.alloc(buf_len)))) {
@@ -712,10 +714,10 @@ int ObIVFSq8MetaRowIterator::get_next_row(
         ObCenterId center_id(tablet_id_.id(), cur_row_pos_ + 1);
         if (OB_FAIL(ObVectorClusterHelper::set_center_id_to_string(center_id, cid_str))) {
           LOG_WARN("failed to set center_id to string", K(ret), K(center_id), K(cid_str));
-        } else if (vec_res.length() > lob_inrow_threshold_ || cid_str.length() > lob_inrow_threshold_) {
+        } else if (data_str.length() > lob_inrow_threshold_ || cid_str.length() > lob_inrow_threshold_) {
           ret = OB_ERR_UNEXPECTED;
           LOG_WARN("unexpected outrow datum in ivf vector index",
-                    K(ret), K(vec_res.length()), K(cid_str.length()), K(lob_inrow_threshold_));
+                    K(ret), K(data_str.length()), K(vec_res.length()), K(cid_str.length()), K(lob_inrow_threshold_));
         } else {
           for (int64_t i = 0; i < current_row_.get_column_count(); ++i) {
             if (meta_vector_col_idx_ == i) {
@@ -800,6 +802,7 @@ int ObIVFPqRowIterator::get_next_row(
       LOG_WARN("upexpected nullptr center_vector", K(ret), K(cur_row_pos_), K(center_count_per_kmeans));
     } else {
       data_str.assign(reinterpret_cast<char *>(center_vector), static_cast<int64_t>(sizeof(float) * dim));
+      // Check payload bytes against the in-row threshold, excluding the LOB header in vec_res.
       if (OB_FAIL(sql::ObArrayExprUtils::set_array_res(nullptr, data_str.length(), row_allocator_, vec_res, data_str.ptr()))) {
         LOG_WARN("failed to set array res", K(ret));
       } else if (OB_ISNULL(buf = static_cast<char*>(row_allocator_.alloc(buf_len)))) {
@@ -811,10 +814,10 @@ int ObIVFPqRowIterator::get_next_row(
         ObPqCenterId pq_center_id(tablet_id_.id(), cur_row_pos_ / center_count_per_kmeans + 1, cur_row_pos_ % center_count_per_kmeans + 1);
         if (OB_FAIL(ObVectorClusterHelper::set_pq_center_id_to_string(pq_center_id, pq_cid_str))) {
           LOG_WARN("failed to set center_id to string", K(ret), K(pq_center_id), K(pq_cid_str));
-        } else if (vec_res.length() > lob_inrow_threshold_ || pq_cid_str.length() > lob_inrow_threshold_) {
+        } else if (data_str.length() > lob_inrow_threshold_ || pq_cid_str.length() > lob_inrow_threshold_) {
           ret = OB_ERR_UNEXPECTED;
           LOG_WARN("unexpected outrow datum in ivf vector index",
-                    K(ret), K(vec_res.length()), K(pq_cid_str.length()), K(lob_inrow_threshold_));
+                    K(ret), K(data_str.length()), K(vec_res.length()), K(pq_cid_str.length()), K(lob_inrow_threshold_));
         } else {
           for (int64_t i = 0; i < current_row_.get_column_count(); ++i) {
             if (pq_center_vector_col_idx_ == i) {
```

**File**: `src/storage/ddl/ob_direct_load_struct.cpp` (modified, +9/-6)
```diff
@@ -4676,6 +4676,7 @@ int ObIvfCenterSliceStore::get_next_vector_data_row(
       LOG_WARN("fail to get center", K(ret), K(cur_row_pos_));
     } else {
       data_str.assign(reinterpret_cast<char *>(center_vector), static_cast<int64_t>(sizeof(float) * dim));
+      // Check payload bytes against the in-row threshold, excluding the LOB header in vec_res.
       if (OB_FAIL(ObArrayExprUtils::set_array_res(nullptr, data_str.length(), tmp_allocator_, vec_res, data_str.ptr()))) {
         LOG_WARN("failed to set array res", K(ret));
       } else if (OB_ISNULL(buf = static_cast<char*>(tmp_allocator_.alloc(buf_len)))) {
@@ -4686,10 +4687,10 @@ int ObIvfCenterSliceStore::get_next_vector_data_row(
         ObCenterId center_id(tablet_id_.id(), cur_row_pos_ + 1);
         if (OB_FAIL(ObVectorClusterHelper::set_center_id_to_string(center_id, cid_str))) {
           LOG_WARN("failed to set center_id to string", K(ret), K(center_id), K(cid_str));
-        } else if (vec_res.length() > lob_inrow_threshold_ || cid_str.length() > lob_inrow_threshold_) {
+        } else if (data_str.length() > lob_inrow_threshold_ || cid_str.length() > lob_inrow_threshold_) {
           ret = OB_ERR_UNEXPECTED;
           LOG_WARN("unexpected outrow datum in ivf vector index",
-                    K(ret), K(vec_res.length()), K(cid_str.length()), K(lob_inrow_threshold_));
+                    K(ret), K(data_str.length()), K(vec_res.length()), K(cid_str.length()), K(lob_inrow_threshold_));
         } else {
           for (int64_t i = 0; i < current_row_.get_column_count(); ++i) {
             if (center_vector_col_idx_ == i) {
@@ -4881,6 +4882,7 @@ int ObIvfSq8MetaSliceStore::get_next_vector_data_row(
       LOG_WARN("fail to get result", K(ret));
     } else {
       data_str.assign(reinterpret_cast<char *>(cur_vector), static_cast<int64_t>(sizeof(float) * vec_dim_));
+      // Check payload bytes against the in-row threshold, excluding the LOB header in vec_res.
       if (OB_FAIL(ObArrayExprUtils::set_array_res(nullptr, data_str.length(), vec_allocator_, vec_res, data_str.ptr()))) {
         LOG_WARN("failed to set array res", K(ret));
       } else if (OB_ISNULL(buf = static_cast<char*>(vec_allocator_.alloc(buf_len)))) {
@@ -4892,10 +4894,10 @@ int ObIvfSq8MetaSliceStore::get_next_vector_data_row(
         ObCenterId center_id(tablet_id_.id(), cur_row_pos_ + 1);
         if (OB_FAIL(ObVectorClusterHelper::set_center_id_to_string(center_id, cid_str))) {
           LOG_WARN("failed to set center_id to string", K(ret), K(center_id), K(cid_str));
-        } else if (vec_res.length() > lob_inrow_threshold_ || cid_str.length() > lob_inrow_threshold_) {
+        } else if (data_str.length() > lob_inrow_threshold_ || cid_str.length() > lob_inrow_threshold_) {
           ret = OB_ERR_UNEXPECTED;
           LOG_WARN("unexpected outrow datum in ivf vector index",
-                    K(ret), K(vec_res.length()), K(cid_str.length()), K(lob_inrow_threshold_));
+                    K(ret), K(data_str.length()), K(vec_res.length()), K(cid_str.length()), K(lob_inrow_threshold_));
         } else {
           for (int64_t i = 0; i < current_row_.get_column_count(); ++i) {
             if (meta_vector_col_idx_ == i) {
@@ -5092,6 +5094,7 @@ int ObIvfPqSliceStore::get_next_vector_data_row(
       LOG_WARN("fail to get center", K(ret), K(cur_row_pos_), K(center_count_per_kmeans));
     } else {
       data_str.assign(reinterpret_cast<char *>(center_vector), static_cast<int64_t>(sizeof(float) * dim));
+      // Check payload bytes against the in-row threshold, excluding the LOB header in vec_res.
       if (OB_FAIL(ObArrayExprUtils::set_array_res(nullptr, data_str.length(), vec_allocator_, vec_res, data_str.ptr()))) {
         LOG_WARN("failed to set array res", K(ret));
       } else if (OB_ISNULL(buf = static_cast<char*>(vec_allocator_.alloc(buf_len)))) {
@@ -5103,10 +5106,10 @@ int ObIvfPqSliceStore::get_next_vector_data_row(
         ObPqCenterId pq_center_id(tablet_id_.id(), cur_row_pos_ / center_count_per_kmeans + 1, cur_row_pos_ % center_count_per_kmeans + 1);
         if (OB_FAIL(ObVectorClusterHelper::set_pq_center_id_to_string(pq_center_id, pq_cid_str))) {
           LOG_WARN("failed to set center_id to string", K(ret), K(pq_center_id), K(pq_cid_str));
-        } else if (vec_res.length() > lob_inrow_threshold_ || pq_cid_str.length() > lob_inrow_threshold_) {
+        } else if (data_str.length() > lob_inrow_threshold_ || pq_cid_str.length() > lob_inrow_threshold_) {
           ret = OB_ERR_UNEXPECTED;
           LOG_WARN("unexpected outrow datum in ivf vector index",
-                    K(ret), K(vec_res.length()), K(pq_cid_str.length()), K(lob_inrow_threshold_));
+                    K(ret), K(data_str.length()), K(vec_res.length()), K(pq_cid_str.length()), K(lob_inrow_threshold_));
         } else {
           for (int64_t i = 0; i < current_row_.get_column_count(); ++i) {
             if (pq_center_vector_col_idx_ == i) {
```

---

### Incident Patch 2: `131fdbaf` (2026-09-30)
**Commit Message**: [to #2026072900117849658]fix backup clean blocked by un-deletable archive piece

**File**: `src/rootserver/backup/ob_backup_clean_selector.cpp` (modified, +728/-85)
```diff
@@ -18,6 +18,7 @@
 #include "share/backup/ob_backup_clean_operator.h"
 #include "storage/tx/ob_ts_mgr.h"
 #include "storage/backup/ob_backup_utils.h"
+#include "storage/backup/ob_backup_data_store.h"
 namespace oceanbase
 {
 using namespace share;
@@ -867,6 +868,50 @@ int ObBackupDataProvider::load_piece_info_desc(
   return ret;
 }
 
+int ObBackupDataProvider::get_backup_set_ls_restore_start_lsn(
+    const uint64_t tenant_id,
+    const ObBackupSetFileDesc &backup_set_desc,
+    ObIArray<ObLSRestoreStartLSN> &ls_start_lsn_array)
+{
+  int ret = OB_SUCCESS;
+  ObBackupDest backup_dest;
+  ObBackupSetDesc set_desc;
+  storage::ObBackupDataStore store;
+  storage::ObBackupLSMetaInfosDesc ls_meta_infos;
+  ls_start_lsn_array.reset();
+  if (IS_NOT_INIT) {
+    ret = OB_NOT_INIT;
+    LOG_WARN("ObBackupDataProvider not inited", K(ret));
+  } else if (!backup_set_desc.is_valid()) {
+    ret = OB_INVALID_ARGUMENT;
+    LOG_WARN("invalid backup set desc", K(ret), K(backup_set_desc));
+  } else if (OB_FAIL(ObBackupStorageInfoOperator::get_backup_dest(*sql_proxy_, tenant_id,
+      backup_set_desc.backup_path_, backup_dest))) {
+    LOG_WARN("failed to get backup dest with storage info", K(ret), K(tenant_id), K(backup_set_desc));
+  } else if (OB_FALSE_IT(set_desc.backup_set_id_ = backup_set_desc.backup_set_id_)) {
+  } else if (OB_FALSE_IT(set_desc.backup_type_ = backup_set_desc.backup_type_)) {
+  } else if (OB_FAIL(store.init(backup_dest, set_desc))) {
+    LOG_WARN("failed to init backup data store", K(ret), K(backup_set_desc));
+  } else if (OB_FAIL(store.read_ls_meta_infos(ls_meta_infos))) {
+    LOG_WARN("failed to read ls meta infos", K(ret), K(backup_set_desc));
+  } else {
+    for (int64_t i = 0; OB_SUCC(ret) && i < ls_meta_infos.ls_meta_packages_.count(); ++i) {
+      const storage::ObLSMetaPackage &ls_meta_package = ls_meta_infos.ls_meta_packages_.at(i);
+      ObLSRestoreStartLSN ls_start_lsn;
+      ls_start_lsn.ls_id_ = ls_meta_package.ls_meta_.ls_id_;
+      ls_start_lsn.start_lsn_ = ls_meta_package.palf_meta_.curr_lsn_;
+      if (!ls_start_lsn.is_valid()) {
+        ret = OB_ERR_UNEXPECTED;
+        LOG_WARN("invalid ls restore start lsn", K(ret), K(ls_start_lsn), K(ls_meta_package));
+      } else if (OB_FAIL(ls_start_lsn_array.push_back(ls_start_lsn))) {
+        LOG_WARN("failed to push back ls restore start lsn", K(ret), K(ls_start_lsn));
+      }
+    }
+    LOG_INFO("[BACKUP_CLEAN]get backup set ls restore start lsn", K(ret), K(backup_set_desc),
+        K(ls_start_lsn_array));
+  }
+  return ret;
+}
 
 // Apply retention policy for current active backup path: keep pieces that are needed for the latest full backup
 // 1. if now db only do archive, then not allow to delete any piece on the current active backup path
@@ -1452,10 +1497,18 @@ int ObBackupDeleteSelector::get_all_dest_backup_piece_infos_(
         LOG_WARN("fail to set backup dest", K(ret), K(backup_dest_str));
       } else if (OB_FAIL(backup_dest.get_backup_path_str(backup_path_str.ptr(), backup_path_str.capacity()))) {
         LOG_WARN("fail to get backup path str", K(ret), K(backup_dest));
+      } else if (!is_log_only) {
+        // delete obsolete: only pick the pieces whose log is really not needed by the retained
+        // backup set chain any more, an un-deletable piece is skipped instead of failing the job.
+        if (OB_FAIL(get_one_dest_deletable_backup_piece_infos_(clog_data_clean_point, backup_path_str.ptr(),
+            archive_dest.second/*dest_id*/, archive_table_op, backup_piece_infos))) {
+          LOG_WARN("failed to get deletable backup piece infos of one dest", K(ret),
+              K(clog_data_clean_point), K(backup_path_str));
+        }
       } else if (OB_FAIL(archive_table_op.get_candidate_obsolete_backup_pieces(
                 *sql_proxy_, clog_data_clean_point, backup_path_str.ptr(), backup_piece_infos))) {
         LOG_WARN("failed to get candidate obsolete backup sets", K(ret));
-      } else if (is_log_only && backup_piece_infos.count() > 0) {
+      } else if (backup_piece_infos.count() > 0) {
         // get the about to expire piece,
         ObTenantArchivePieceAttr about_to_expire_piece;
         int64_t about_to_expire_piece_id = backup_piece_infos.at(backup_piece_infos.count() - 1).key_.piece_id_ + 1;
@@ -1477,6 +1530,580 @@ int ObBackupDeleteSelector::get_all_dest_backup_piece_infos_(
   return ret;
 }
 
+// Pick the deletable pieces of one archive dest. Pieces are checked in ascending order of piece id,
+// and once a piece can not be deleted, all the pieces after it are kept too, so that the remaining
+// pieces are always a continuous suffix which covers the log from start_replay_scn onwards.
+// Note that an un-deletable piece only means "nothing more can be reclaimed for this dest in this
+// round", it MUST NOT fail the whole backup clean job, otherwise the obsolete backup sets which have
+// already been figured out can not be deleted either, and the job would keep faili
```

**File**: `src/rootserver/backup/ob_backup_clean_selector.h` (modified, +83/-4)
```diff
@@ -13,6 +13,7 @@
 #include "lib/utility/ob_print_utils.h"
 #include "share/backup/ob_backup_store.h"
 #include "share/backup/ob_archive_store.h"
+#include "logservice/palf/lsn.h"
 
 namespace oceanbase
 {
@@ -21,6 +22,30 @@ namespace rootserver
 
 class ObUserTenantBackupDeleteMgr;
 
+// The LSN from which ONE log stream still needs its archive log, i.e. the lsn a restore of that log
+// stream would start to fetch the archive log at. Every piece which holds log at or after this lsn has
+// to be kept.
+//
+// It is always the start of a 64M palf block, because palf can only be advanced to a block boundary:
+// whoever reads the archive advances palf to a block boundary first(ObLSService::restore_update_ls_ ->
+// advance_base_info) and then asks the archive for the log from exactly that lsn
+// (ObLogRestoreArchiveDriver::get_palf_base_lsn_scn_). Hence it can be much smaller than the lsn of the
+// log at the SCN the caller has in mind. Where the block boundary comes from depends on the policy:
+//   - default : the palf base lsn recorded in the retained backup set
+//               (ObLSMetaPackage::palf_meta_.curr_lsn_), which ObLogHandler::get_palf_base_info has
+//               already rounded DOWN to a block boundary;
+//   - log_only: no backup set exists, so it is the start of the block the oldest kept piece begins in,
+//               see ObBackupDeleteSelector::get_anchor_piece_ls_need_lsn_.
+struct ObLSRestoreStartLSN final
+{
+  ObLSRestoreStartLSN() : ls_id_(), start_lsn_() {}
+  ~ObLSRestoreStartLSN() = default;
+  bool is_valid() const { return ls_id_.is_valid() && start_lsn_.is_valid(); }
+  TO_STRING_KV(K_(ls_id), K_(start_lsn));
+
+  share::ObLSID ls_id_;
+  palf::LSN start_lsn_;
+};
 
 // Abstracting static functions into the IObBackupDataProvider interface, allowing us to isolate the component
 // under test by replacing real database calls with mock objects.
@@ -81,6 +106,13 @@ class IObBackupDataProvider {
       const uint64_t tenant_id,
       const share::ObTenantArchivePieceAttr &piece_attr,
       share::ObPieceInfoDesc &piece_info_desc) = 0;
+
+  // Read the ls meta of `backup_set_desc` from the backup set dir, and return the lsn every log
+  // stream of it starts to fetch the archive log from when it is restored, see ObLSRestoreStartLSN.
+  virtual int get_backup_set_ls_restore_start_lsn(
+      const uint64_t tenant_id,
+      const share::ObBackupSetFileDesc &backup_set_desc,
+      common::ObIArray<ObLSRestoreStartLSN> &ls_start_lsn_array) = 0;
 };
 
 class ObBackupDataProvider final : public IObBackupDataProvider {
@@ -139,6 +171,11 @@ class ObBackupDataProvider final : public IObBackupDataProvider {
       const share::ObTenantArchivePieceAttr &piece_attr,
       share::ObPieceInfoDesc &piece_info_desc) override;
 
+  int get_backup_set_ls_restore_start_lsn(
+      const uint64_t tenant_id,
+      const share::ObBackupSetFileDesc &backup_set_desc,
+      common::ObIArray<ObLSRestoreStartLSN> &ls_start_lsn_array) override;
+
 private:
   common::ObISQLClient *sql_proxy_;
   bool is_inited_;
@@ -312,12 +349,54 @@ class ObBackupDeleteSelector final {
                                             ObIArray<share::ObBackupSetFileDesc> &set_list);
   int get_delete_obsolete_backup_piece_infos_(const share::ObBackupSetFileDesc &clog_data_clean_point,
                                               ObIArray<share::ObTenantArchivePieceAttr> &piece_list);
+  int get_one_dest_deletable_backup_piece_infos_(const share::SCN &start_replay_scn,
+                                              const char *backup_path_str,
+                                              const int64_t dest_id,
+                                              const share::ObArchivePersistHelper &archive_table_op,
+                                              ObIArray<share::ObTenantArchivePieceAttr> &backup_piece_infos);
+  // `sorted_all_piece_infos` is all the pieces of the dest, sorted in ascending order of piece id.
+  int check_piece_can_be_deleted_(const share::ObTenantArchivePieceAttr &backup_piece_info,
+                                              const share::SCN &start_replay_scn,
+                                              const ObIArray<share::ObTenantArchivePieceAttr> &sorted_all_piece_infos,
+                                              bool &can_be_deleted);
+  int check_scn_covered_by_other_piece_(const share::ObTenantArchivePieceAttr &piece_to_delete,
+                                              const share::SCN &scn,
+                                              const ObIArray<share::ObTenantArchivePieceAttr> &sorted_all_piece_infos,
+                                              bool &is_scn_covered_by_other_kept_piece);
+  // ----------------------------Pieces still needed by a restore(LSN based)----------------------------
+  // The two delete obsolete policies protect the same thing - the archive log is read from the start of a
+  // 64M palf block and the archive may have split th
```

**File**: `src/share/backup/ob_archive_persist_helper.cpp` (modified, +4/-2)
```diff
@@ -931,18 +931,20 @@ int ObArchivePersistHelper::get_frozen_pieces(
 }
 
 int ObArchivePersistHelper::get_candidate_obsolete_backup_pieces(common::ObISQLClient &proxy, const SCN &end_scn,
-    const char *backup_dest_str, ObIArray<ObTenantArchivePieceAttr> &pieces) const
+    const char *backup_dest_str, ObIArray<ObTenantArchivePieceAttr> &pieces,
+    const bool use_checkpoint_scn) const
 {
   int ret = OB_SUCCESS;
   ObSqlString sql;
+  const char *upper_bound_column = use_checkpoint_scn ? OB_STR_CHECKPOINT_SCN : OB_STR_END_SCN;
   if (IS_NOT_INIT) {
     ret = OB_NOT_INIT;
     LOG_WARN("ObArchivePersistHelper not init", K(ret));
   } else if (OB_ISNULL(backup_dest_str)) {
     ret = OB_INVALID_ARGUMENT;
     LOG_WARN("invalid backup_dest_str", K(ret), K(backup_dest_str));
   } else if (OB_FAIL(sql.assign_fmt("select * from %s where %s=%lu and %s<=%lu and %s='%s' and %s!='%s'",
-      OB_ALL_LOG_ARCHIVE_PIECE_FILES_TNAME, OB_STR_TENANT_ID, tenant_id_, OB_STR_END_SCN,
+      OB_ALL_LOG_ARCHIVE_PIECE_FILES_TNAME, OB_STR_TENANT_ID, tenant_id_, upper_bound_column,
       end_scn.get_val_for_inner_table_field(), OB_STR_PATH, backup_dest_str, OB_STR_FILE_STATUS, OB_STR_DELETED))) {
     LOG_WARN("failed to append fmt", K(ret));
   } else {
```

**File**: `src/share/backup/ob_archive_persist_helper.h` (modified, +12/-1)
```diff
@@ -137,8 +137,19 @@ class ObArchivePersistHelper : public ObIExecTenantIdProvider
   // Get all frozen pieces whose piece ids are smaller than `upper_piece_id`.
   int get_frozen_pieces(common::ObISQLClient &proxy, const int64_t dest_id, const int64_t upper_piece_id, 
       common::ObIArray<ObTenantArchivePieceAttr> &piece_list) const;
+  // Get the pieces which may be obsolete, i.e. the log they contain is not after `end_scn`.
+  // `use_checkpoint_scn` decides which column is taken as the upper bound of the log a piece contains:
+  //   false: piece.end_scn, which is only a nominal boundary calculated by
+  //          "round.start_scn + N * piece_switch_interval"(see ObTenantArchiveMgr::decide_piece_end_scn).
+  //          It is decided when the piece is created and never shrinks, even if archive is stopped in
+  //          the middle of the piece. So a frozen piece may be filtered out although all the log it
+  //          really contains is before `end_scn`;
+  //   true:  piece.checkpoint_scn, the real upper bound of the log a frozen piece contains. The caller
+  //          MUST check the deletability of every returned piece by itself, because a piece whose
+  //          nominal range still covers `end_scn` may be returned.
   int get_candidate_obsolete_backup_pieces(common::ObISQLClient &proxy, const SCN &end_scn,
-      const char *backup_dest_str, ObIArray<ObTenantArchivePieceAttr> &pieces) const;
+      const char *backup_dest_str, ObIArray<ObTenantArchivePieceAttr> &pieces,
+      const bool use_checkpoint_scn = false) const;
   int insert_or_update_piece(common::ObISQLClient &proxy, const ObTenantArchivePieceAttr &piece) const;
   // Usually, we need do it in a transaction.
   int batch_update_pieces(common::ObISQLClient &proxy, const common::ObIArray<ObTenantArchivePieceAttr> &pieces_array) const;
```

**File**: `unittest/storage/backup/test_backup_clean_piece_clog_block_dependency.cpp` (modified, +159/-163)
```diff
@@ -29,10 +29,8 @@ namespace backup {
 struct LSFileInfo {
   ObLSID ls_id;
   std::vector<int64_t> file_ids;
-  bool deleted;  // ObSingleLSInfoDesc::deleted_, marked on the last piece of a deleted ls
 
-  LSFileInfo(ObLSID id, std::vector<int64_t> files, bool is_deleted = false)
-    : ls_id(id), file_ids(files), deleted(is_deleted) {}
+  LSFileInfo(ObLSID id, std::vector<int64_t> files) : ls_id(id), file_ids(files) {}
 };
 
 struct PieceInfo {
@@ -47,6 +45,9 @@ struct PieceInfo {
 
 class TestBackupCleanPieceClogBlockDependency : public ::testing::Test {
 protected:
+  // Must be a user tenant id, otherwise ObTenantArchivePieceAttr::Key::is_pkey_valid() is false.
+  static const uint64_t TEST_TENANT_ID = 1002;
+
   void SetUp() override {
     ASSERT_EQ(OB_SUCCESS, mock_sql_proxy_.init(nullptr));
     mock_schema_service_ = std::make_unique<MockObMultiVersionSchemaService>();
@@ -66,6 +67,15 @@ class TestBackupCleanPieceClogBlockDependency : public ::testing::Test {
     piece_desc.piece_id_ = piece_id;
   }
 
+  // The archive file id of a log stream is a pure function of the lsn("lsn / PALF_BLOCK_SIZE + 1",
+  // archive::cal_archive_file_id with MAX_ARCHIVE_FILE_SIZE == palf::PALF_BLOCK_SIZE), so a file id is
+  // just the id of the palf block the log lives in. The lsn range a piece holds is derived from its file
+  // id list below: it starts at the beginning of the first block and ends in the middle of the last one,
+  // which is what a piece switch in the middle of a block looks like.
+  static uint64_t block_start_lsn(const int64_t file_id) {
+    return static_cast<uint64_t>(file_id - 1) * static_cast<uint64_t>(palf::PALF_BLOCK_SIZE);
+  }
+
   // Helper function to create a single LS info desc
   void create_single_ls_info_desc(ObSingleLSInfoDesc &ls_desc,
                                   int64_t dest_id,
@@ -91,6 +101,48 @@ class TestBackupCleanPieceClogBlockDependency : public ::testing::Test {
     file.file_id_ = file_id;
     file.size_bytes_ = size_bytes;
     ASSERT_EQ(OB_SUCCESS, ls_desc.filelist_.push_back(file));
+    // Keep the archived lsn range consistent with the file list: [start of the first block, somewhere
+    // inside the last block).
+    if (1 == ls_desc.filelist_.count()) {
+      ls_desc.min_lsn_ = block_start_lsn(file_id);
+    }
+    ls_desc.max_lsn_ = block_start_lsn(file_id) + static_cast<uint64_t>(palf::PALF_BLOCK_SIZE) / 2;
+  }
+
+  // Add one log stream entry to `piece` with an EXPLICIT archived lsn range, which is what the piece
+  // info file really records(ObSingleLSInfoDesc::min_lsn_/max_lsn_). `file_ids` may be empty, which is
+  // exactly how an IDLE log stream looks: it archived nothing into the piece, so it has no file at all
+  // while min_lsn_ == max_lsn_ == the lsn it stands at(see record_piece_info and
+  // ObLSArchiveTask::ArchiveDest::compensate_piece). The file id based helpers above always derive the
+  // range from the file list, so they can not express that state.
+  void add_ls_to_piece_with_range(ObPieceInfoDesc &piece,
+                                  const ObLSID &ls_id,
+                                  const uint64_t min_lsn,
+                                  const uint64_t max_lsn,
+                                  const std::vector<int64_t> &file_ids) {
+    ObSingleLSInfoDesc ls_desc;
+    create_single_ls_info_desc(ls_desc, piece.dest_id_, piece.round_id_, piece.piece_id_, ls_id);
+    for (int64_t file_id : file_ids) {
+      ObSingleLSInfoDesc::OneFile file;
+      file.file_id_ = file_id;
+      file.size_bytes_ = 1024;
+      ASSERT_EQ(OB_SUCCESS, ls_desc.filelist_.push_back(file));
+    }
+    ls_desc.min_lsn_ = min_lsn;
+    ls_desc.max_lsn_ = max_lsn;
+    ASSERT_EQ(OB_SUCCESS, piece.filelist_.push_back(ls_desc));
+  }
+
+  // Build the candidate piece attr array which matches `pieces` one by one.
+  void create_candidate_piece_attrs(const ObArray<ObPieceInfoDesc> &pieces,
+                                    ObArray<ObTenantArchivePieceAttr> &candidate_piece_infos) {
+    candidate_piece_infos.reset();
+    for (int64_t i = 0; i < pieces.count(); ++i) {
+      ObTenantArchivePieceAttr piece_attr;
+      create_candidate_piece_attr(piece_attr, pieces.at(i).dest_id_, pieces.at(i).round_id_,
+          pieces.at(i).piece_id_);
+      ASSERT_EQ(OB_SUCCESS, candidate_piece_infos.push_back(piece_attr));
+    }
   }
 
   // Create a piece and add it to pieces array
@@ -106,30 +158,64 @@ class TestBackupCleanPieceClogBlockDependency : public ::testing::Test {
       for (int64_t file_id : ls_file.file_ids) {
         add_file_to_ls_desc(ls_desc, file_id);
       }
-      ls_desc.deleted_ = ls_file.deleted;
 
       ASSERT_EQ(OB_SUCCESS, piece.filelist_.push_back(ls_desc));
     }
 
     ASSERT_EQ(OB_SUCCESS, pieces.push_back(piece));
   }
 
-  // Create candidate piece info array
-  void create_candidate_piece_infos(ObArray<ObTenantArchivePieceAttr> &candidate_piece_infos,
-                                   int64_t coun
```

**File**: `unittest/storage/backup/test_backup_clean_piece_selector.cpp` (modified, +851/-0)
```diff
@@ -71,6 +71,34 @@ class TestBackupCleanPieceSelectorBase : public ::testing::Test {
         piece.path_.assign(path);
     }
 
+    // Create a piece with FULL control over its four SCN fields, so that the cross-boundary log
+    // group scenario(start_scn_ > scn while the piece still really covers scn) can be expressed.
+    void create_piece_with_scns(share::ObTenantArchivePieceAttr &piece, int64_t piece_id, int64_t dest_id,
+                      const char* path, int64_t start_scn, int64_t checkpoint_scn, int64_t end_scn,
+                      share::ObArchivePieceStatus::Status status = share::ObArchivePieceStatus::Status::FROZEN,
+                      share::ObBackupFileStatus::STATUS file_status = share::ObBackupFileStatus::BACKUP_FILE_AVAILABLE) {
+        piece.reset();
+        piece.key_.tenant_id_ = 1002;
+        piece.key_.dest_id_ = dest_id;
+        piece.key_.round_id_ = 1;
+        piece.key_.piece_id_ = piece_id;
+        piece.incarnation_ = 1;
+        piece.dest_no_ = 1;
+        piece.file_count_ = 10;
+        piece.start_scn_.convert_for_gts(start_scn);
+        piece.checkpoint_scn_.convert_for_gts(checkpoint_scn);
+        piece.max_scn_.convert_for_gts(checkpoint_scn);
+        piece.end_scn_.convert_for_gts(end_scn);
+        piece.compatible_.version_ = ObArchiveCompatible::Compatible::COMPATIBLE_VERSION_1;
+        piece.input_bytes_ = 1024;
+        piece.output_bytes_ = 1024;
+        piece.status_.status_ = status;
+        piece.file_status_ = file_status;
+        piece.cp_file_id_ = 0;
+        piece.cp_file_offset_ = 0;
+        piece.path_.assign(path);
+    }
+
     void create_backup_set(share::ObBackupSetFileDesc &desc, int64_t id, share::ObBackupType::BackupType type,
                            int64_t prev_full, int64_t prev_inc, int64_t dest_id, const char* path,
                            int64_t expired_time,
@@ -799,6 +827,829 @@ TEST_F(TestBackupCleanPieceSelector_NoBackupCases, FailWhenNoBackupDestExists2)
                     test_sets_, test_current_path_, test_pieces_, test_dest_pairs_, false);
 }
 
+// =================================================================================
+// Fixture 8: clean point coverage in check_piece_can_be_deleted_
+// =================================================================================
+// A piece whose nominal range [start_scn_, end_scn_) covers the clean point(start_replay_scn) is
+// required by the restore path even when all the log it really contains is before the clean point:
+// ObArchiveStore::get_piece_paths_in_range accepts a piece list only if the FIRST piece satisfies
+// "start_scn_ <= clean point < end_scn_", and check_piece_continuity_between_two_scn requires a
+// not-deleted floor piece with "start_scn <= clean point". So such a piece can be reclaimed only if
+// ANOTHER kept AVAILABLE piece also nominally covers the clean point(possible when the scn ranges of
+// two rounds overlap), see check_scn_covered_by_other_piece_.
+//
+// This fixture directly drives ObBackupDeleteSelector::check_piece_can_be_deleted_(), which is the
+// path that get_one_dest_deletable_backup_piece_infos_() takes for every candidate piece.
+class TestBackupCleanPieceSelector_CrossBoundaryCoverage : public TestBackupCleanPieceSelectorBase {
+protected:
+    // Init a selector, ready to call check_piece_can_be_deleted_ / check_scn_covered_by_other_piece_.
+    void build_selector(ObBackupDeleteSelector &selector) {
+        job_attr_.reset();
+        job_attr_.job_id_ = 1001;
+        job_attr_.tenant_id_ = 1002;
+        job_attr_.incarnation_id_ = 1;
+        job_attr_.clean_type_ = ObNewBackupCleanType::DELETE_OBSOLETE_BACKUP;
+        ASSERT_EQ(OB_SUCCESS, selector.init(mock_sql_proxy_, *mock_schema_service_, job_attr_,
+                                            *mock_rpc_proxy_, *mock_delete_mgr_));
+    }
+
+    // Sort the pieces in ascending order of piece id, the same as get_one_dest_deletable_backup_piece_infos_
+    // does before passing the pieces down to check_piece_can_be_deleted_.
+    void sort_pieces(ObArray<share::ObTenantArchivePieceAttr> &pieces) {
+        ObBackupDeleteSelector::CompareBackupPieceInfo cmp;
+        lib::ob_sort(pieces.begin(), pieces.end(), cmp);
+    }
+
+    ObBackupCleanJobAttr job_attr_;
+};
+
+// The old piece(#1) is judged deletable via the nominal boundary shortcut: its whole nominal range is
+// before the clean point.
+TEST_F(TestBackupCleanPieceSelector_CrossBoundaryCoverage, DeletableWhenWholeNominalRangeBeforeCleanPoint) {
+    ObArray<share::ObTenantArchivePieceAttr> pieces;
+    share::ObTenantArchivePieceAttr p1, p2;
+    // p1: [100, 200, 300]; p2: [300, 500, 600]. clean point = 400.
+    create_piece_with_scns(p1, 1, 1, "file:///path", 100, 200, 300);
+    create_piece_with_scns(p2, 2, 1, "file:///path", 300, 500, 600);
+    ASSERT_EQ(OB_SUCCESS, pieces.push_back(p1));
+    ASSERT_EQ(OB_SUCCESS, pieces.push_back(p2));
+    sort_pieces(pieces);
+
+   
```

**File**: `unittest/storage/backup/test_backup_clean_selector_include.h` (modified, +41/-0)
```diff
@@ -130,12 +130,32 @@ class MockBackupDataProvider : public rootserver::IObBackupDataProvider {
       const share::ObTenantArchivePieceAttr &piece_attr,
       share::ObPieceInfoDesc &piece_info_desc) override;
 
+  void set_ls_restore_start_lsns(const ObIArray<rootserver::ObLSRestoreStartLSN> &ls_start_lsn_array) {
+    ls_start_lsn_array_.reset();
+    for (int64_t i = 0; i < ls_start_lsn_array.count(); ++i) {
+      ls_start_lsn_array_.push_back(ls_start_lsn_array.at(i));
+    }
+  }
+  // Inject a failure of reading the ls meta of the backup set.
+  void set_ls_restore_start_lsn_ret(const int ret_code) { ls_start_lsn_ret_ = ret_code; }
+  // How many times the piece info file has been read, used to check that the caller does not read the
+  // piece info of every candidate piece when it does not have to.
+  int64_t get_load_piece_info_desc_count() const { return load_piece_info_desc_count_; }
+
+  int get_backup_set_ls_restore_start_lsn(
+      const uint64_t tenant_id,
+      const share::ObBackupSetFileDesc &backup_set_desc,
+      ObIArray<rootserver::ObLSRestoreStartLSN> &ls_start_lsn_array) override;
+
 private:
   bool policy_exist_ = false;
   ObArray<share::ObBackupSetFileDesc> backup_sets_;
   share::ObBackupPathString current_path_;
   ObArray<MockDestInfo> dest_infos_;
   ObArray<ObPieceInfoDesc> piece_info_descs_;
+  ObArray<rootserver::ObLSRestoreStartLSN> ls_start_lsn_array_;
+  int ls_start_lsn_ret_ = OB_SUCCESS;
+  int64_t load_piece_info_desc_count_ = 0;
   DISALLOW_COPY_AND_ASSIGN(MockBackupDataProvider);
 };
 
@@ -379,6 +399,7 @@ int MockBackupDataProvider::load_piece_info_desc(const uint64_t tenant_id,
   UNUSED(tenant_id);
   int ret = OB_SUCCESS;
   bool match_flag = false;
+  ++load_piece_info_desc_count_;
   for (int64_t i = 0; i < piece_info_descs_.count(); ++i) {
     printf("piece_id: %ld,: %ld\n", piece_info_descs_.at(i).piece_id_, piece_attr.key_.piece_id_);
     if (piece_info_descs_.at(i).piece_id_ == piece_attr.key_.piece_id_) {
@@ -392,6 +413,26 @@ int MockBackupDataProvider::load_piece_info_desc(const uint64_t tenant_id,
   return OB_SUCCESS;
 }
 
+// Mock implementation of get_backup_set_ls_restore_start_lsn
+int MockBackupDataProvider::get_backup_set_ls_restore_start_lsn(
+    const uint64_t tenant_id,
+    const share::ObBackupSetFileDesc &backup_set_desc,
+    ObIArray<rootserver::ObLSRestoreStartLSN> &ls_start_lsn_array) {
+  UNUSED(tenant_id);
+  UNUSED(backup_set_desc);
+  int ret = OB_SUCCESS;
+  ls_start_lsn_array.reset();
+  if (OB_SUCCESS != ls_start_lsn_ret_) {
+    ret = ls_start_lsn_ret_;
+  } else {
+    for (int64_t i = 0; OB_SUCC(ret) && i < ls_start_lsn_array_.count(); ++i) {
+      if (OB_FAIL(ls_start_lsn_array.push_back(ls_start_lsn_array_.at(i)))) {
+        break;
+      }
+    }
+  }
+  return ret;
+}
 
 } // namespace rootserver
 } // namespace oceanbase
```

---

### Incident Patch 3: `7408ba78` (2026-09-30)
**Commit Message**: Fix expand dup expr sharing abandoned DISCRETE arrays with org expr

**File**: `src/sql/engine/expand/ob_expand_vec_op.cpp` (modified, +25/-11)
```diff
@@ -483,7 +483,10 @@ int ObExpandVecOp::duplicate_expr(ObExpr *from, ObExpr *to)
       char *src_data = static_cast<ObFixedLengthBase *>(from_vec)->get_data();
       ObBitVector *src_nulls = static_cast<ObBitmapNullVectorBase *>(from_vec)->get_nulls();
       ObFixedLengthBase *to_vec = static_cast<ObFixedLengthBase *>(to->get_vector(eval_ctx_));
-      to_vec->set_data(src_data);
+      // The org vector may be re-initialized later (e.g. cast_to_uniform from a scalar
+      // fallback eval of a sibling dup pair's org), abandoning its data buffer. Copy the
+      // buffer content into dup's own frame slot; see VEC_DISCRETE below for details.
+      MEMCPY(to_vec->get_data(), src_data, brs_.size_ * to_vec->get_length());
       to_vec->get_nulls()->deep_copy(*src_nulls, brs_.size_);
       to_vec->set_has_null(from_vec->has_null());
       to->set_evaluated_projected(eval_ctx_);
@@ -492,26 +495,37 @@ int ObExpandVecOp::duplicate_expr(ObExpr *from, ObExpr *to)
     if (OB_FAIL(to->init_vector(eval_ctx_, VEC_DISCRETE, brs_.size_))) {
       LOG_WARN("init vector failed", K(ret));
     } else {
-      char **ptrs = static_cast<ObDiscreteBase *>(from_vec)->get_ptrs();
-      ObLength *lens = static_cast<ObDiscreteBase *>(from_vec)->get_lens();
+      char **src_ptrs = static_cast<ObDiscreteBase *>(from_vec)->get_ptrs();
+      ObLength *src_lens = static_cast<ObDiscreteBase *>(from_vec)->get_lens();
       ObBitVector *src_nulls = static_cast<ObBitmapNullVectorBase *>(from_vec)->get_nulls();
       ObDiscreteBase *to_vec = static_cast<ObDiscreteBase *>(to->get_vector(eval_ctx_));
-      to_vec->set_ptrs(ptrs);
-      to_vec->set_lens(lens);
+      // The org vector may be re-initialized later (e.g. cast_to_uniform from a scalar
+      // fallback eval of a sibling dup pair's org), which abandons its ptrs/lens arrays.
+      // Copy the array contents into dup's own frame slots; payloads stay shared.
+      MEMCPY(to_vec->get_ptrs(), src_ptrs, brs_.size_ * sizeof(char *));
+      MEMCPY(to_vec->get_lens(), src_lens, brs_.size_ * sizeof(ObLength));
       to_vec->get_nulls()->deep_copy(*src_nulls, brs_.size_);
       to_vec->set_has_null(from_vec->has_null());
       to->set_evaluated_projected(eval_ctx_);
     }
   } else if constexpr (fmt == VEC_CONTINUOUS) {
-    if (OB_FAIL(to->init_vector(eval_ctx_, VEC_CONTINUOUS, brs_.size_))) {
+    // dup expr never produces continuous format: a discrete vector holding per-row
+    // ptrs/lens into the org's payload carries the same snapshot, while the frame
+    // slot reserved for continuous data only holds an ObDynReserveBuf header and
+    // cannot hold payload copies.
+    if (OB_FAIL(to->init_vector(eval_ctx_, VEC_DISCRETE, brs_.size_))) {
       LOG_WARN("init vector failed", K(ret));
     } else {
-      uint32_t *offsets = static_cast<ObContinuousBase *>(from_vec)->get_offsets();
-      char *data = static_cast<ObContinuousBase *>(from_vec)->get_data();
+      uint32_t *src_offsets = static_cast<ObContinuousBase *>(from_vec)->get_offsets();
+      char *src_data = static_cast<ObContinuousBase *>(from_vec)->get_data();
       ObBitVector *src_nulls = static_cast<ObBitmapNullVectorBase *>(from_vec)->get_nulls();
-      ObContinuousBase *to_vec = static_cast<ObContinuousBase *>(to->get_vector(eval_ctx_));
-      to_vec->set_offsets(offsets);
-      to_vec->set_data(data);
+      ObDiscreteBase *to_vec = static_cast<ObDiscreteBase *>(to->get_vector(eval_ctx_));
+      char **to_ptrs = to_vec->get_ptrs();
+      ObLength *to_lens = to_vec->get_lens();
+      for (int64_t i = 0; i < brs_.size_; i++) {
+        to_ptrs[i] = src_data + src_offsets[i];
+        to_lens[i] = src_offsets[i + 1] - src_offsets[i];
+      }
       to_vec->get_nulls()->deep_copy(*src_nulls, brs_.size_);
       to_vec->set_has_null(from_vec->has_null());
       to->set_evaluated_projected(eval_ctx_);
```

---

### Incident Patch 4: `631ddc4e` (2026-09-30)
**Commit Message**: fix: add missing LOB header for JSON-to-TEXT object casts

**File**: `src/share/object/ob_obj_cast.cpp` (modified, +6/-0)
```diff
@@ -10382,6 +10382,12 @@ static int json_string(const ObObjType expect_type, ObObjCastParams &params,
       }
     }
   }
+  // Add the header after charset conversion and truncation, which operate on the payload.
+  if (OB_SUCC(ret) && !IS_CLUSTER_VERSION_BEFORE_4_1_0_0) {
+    if (OB_FAIL(ObTextStringResult::ob_convert_obj_temporay_lob(out, *params.allocator_v2_))) {
+      LOG_WARN("failed to add lob header after casting json to text", K(ret), K(expect_type), K(out));
+    }
+  }
   return ret;
 }
 
```

---

### Incident Patch 5: `0c9469e5` (2026-09-29)
**Commit Message**: fix little bug

**File**: `src/sql/engine/table/ob_odps_jni_table_row_iter.cpp` (modified, +17/-9)
```diff
@@ -1887,7 +1887,8 @@ static int find_arrow_field_by_name(const std::shared_ptr<arrow::Schema> &schema
 // 时，多余列被自然跳过，真正缺列才报错；列数恰好等于投影时解析结果是恒等
 // 映射，同时把"列序对齐"从假设变成显式校验。之后每个 batch 的填列循环只做
 // 纯下标访问。
-int ObODPSJNITableRowIterator::resolve_sorted_columns_by_name(const std::shared_ptr<arrow::Schema> &schema)
+int ObODPSJNITableRowIterator::resolve_sorted_columns_by_name(const std::shared_ptr<arrow::Schema> &schema,
+                                                                    const bool allow_missing_part_col)
 {
   int ret = OB_SUCCESS;
   if (OB_ISNULL(schema)) {
@@ -1918,11 +1919,17 @@ int ObODPSJNITableRowIterator::resolve_sorted_columns_by_name(const std::shared_
       } else if (OB_FAIL(find_arrow_field_by_name(schema, mirror_list.at(mirror_idx).name_, field_idx))) {
         LOG_WARN("failed to find field by name", K(ret));
       } else if (OB_UNLIKELY(-1 == field_idx)) {
-        ret = OB_ERR_UNEXPECTED;
-        LOG_WARN("projected column is missing from the session batch",
-                 K(ret), K(is_part_col), K(mirror_idx),
-                 "column", mirror_list.at(mirror_idx).name_,
-                 K(schema->fields().size()), K(total_cnt));
+        // tunnel 的 arrow batch 只携带非分区列，分区列不在 session schema 中
+        // 是合法状态（值由 part_list_val_ 单独回填，不经过 resolved_column_ids_），
+        // 此时不能入表，保证表中不存在无效 field_idx；仅 storage 路径或非分区列
+        // 缺失才视为异常
+        if (OB_UNLIKELY(!allow_missing_part_col || !is_part_col)) {
+          ret = OB_ERR_UNEXPECTED;
+          LOG_WARN("projected column is missing from the session batch",
+                   K(ret), K(is_part_col), K(mirror_idx),
+                   "column", mirror_list.at(mirror_idx).name_,
+                   K(schema->fields().size()), K(total_cnt));
+        }
       } else if (OB_FAIL(resolved_column_ids_.push_back(
                      ResolvedColumnPair{expr_idx, mirror_idx, field_idx, is_part_col}))) {
         LOG_WARN("failed to keep resolved column pair", K(ret));
@@ -1985,7 +1992,7 @@ int ObODPSJNITableRowIterator::fill_column_exprs_storage(const ExprFixedArray &c
         ret = OB_ERR_UNEXPECTED;
         LOG_WARN("invalid column count", K(ret), K(cur_schema->fields().size()));
       }
-    } else if (OB_FAIL(resolve_sorted_columns_by_name(cur_schema))) {
+    } else if (OB_FAIL(resolve_sorted_columns_by_name(cur_schema, false))) {
       LOG_WARN("failed to resolve projected columns against session schema", K(ret));
     } else {
       // 列数恰好等于投影（恒等映射）与会话超集两种布局共用这一份填列循环：
@@ -2051,10 +2058,11 @@ int ObODPSJNITableRowIterator::fill_column_exprs_tunnel(const ExprFixedArray &co
     } else {
       const std::shared_ptr<arrow::RecordBatch> cur_record_batch = state_.odps_jni_scanner_->get_cur_arrow_batch();
       const std::shared_ptr<arrow::Schema> cur_schema = cur_record_batch->schema();
-      if (OB_FAIL(resolve_sorted_columns_by_name(cur_schema))) {
+      if (OB_FAIL(resolve_sorted_columns_by_name(cur_schema, true))) {
         LOG_WARN("failed to resolve projected columns against session schema", K(ret));
       } else {
-        // tunnel 的 arrow batch 只携带非分区列；分区列由下方 part_list_val_ 循环单独填充
+        // tunnel 的 arrow batch 只携带非分区列；分区列（field_idx 为 -1）由下方
+        // part_list_val_ 循环单独填充
         for (int64_t i = 0; OB_SUCC(ret) && i < resolved_column_ids_.count(); ++i) {
           const int64_t expr_idx = resolved_column_ids_.at(i).ob_col_idx_;
           const int64_t mirror_idx = resolved_column_ids_.at(i).mirror_idx_;
```

**File**: `src/sql/engine/table/ob_odps_jni_table_row_iter.h` (modified, +7/-1)
```diff
@@ -348,7 +348,13 @@ class ObODPSJNITableRowIterator : public ObExternalTableRowIterator {
   // to its field index in the session arrow schema by column name, once per
   // schema. The result is cached in resolved_column_ids_, so per-batch
   // filling works on plain field indexes without any name lookup.
-  int resolve_sorted_columns_by_name(const std::shared_ptr<arrow::Schema> &schema);
+  // allow_missing_part_col: tunnel batches carry non-partition columns only,
+  // so a partition column absent from the schema is legal there — it is simply
+  // left out of resolved_column_ids_ (its value is filled from part_list_val_),
+  // which keeps every kept field_idx valid; the storage path keeps the strict
+  // check.
+  int resolve_sorted_columns_by_name(const std::shared_ptr<arrow::Schema> &schema,
+      const bool allow_missing_part_col);
   int fill_column_exprs_tunnel(const ExprFixedArray &column_exprs, ObEvalCtx &ctx, int64_t num_rows);
 
   int get_next_rows_tunnel(int64_t &count, int64_t capacity);
```

---

### Incident Patch 6: `cdd735e0` (2026-09-24)
**Commit Message**: Fix constraint task self-lock in combined auto-increment ALTER

**File**: `src/rootserver/ddl_task/ob_constraint_task.cpp` (modified, +7/-0)
```diff
@@ -1308,6 +1308,10 @@ int ObConstraintTask::set_check_constraint_validated()
     } else if (OB_FAIL(deep_copy_table_arg(allocator, alter_table_arg_, alter_table_arg))) {
       LOG_WARN("deep copy table arg failed", K(ret));
     } else {
+      // Table options were handled by the original ALTER. Replaying them while holding the
+      // constraint task's RX lock can request an incompatible table X lock.
+      alter_table_arg.alter_table_schema_.alter_option_bitset_.reset();
+      alter_table_arg.is_alter_options_ = false;
       ObTableSchema::const_constraint_iterator iter = alter_table_arg.alter_table_schema_.constraint_begin();
       if (obrpc::ObAlterTableArg::ADD_CONSTRAINT == alter_table_arg.alter_constraint_type_) {
         (*iter)->set_constraint_id(target_object_id_);
@@ -1535,6 +1539,9 @@ int ObConstraintTask::rollback_failed_check_constraint()
     } else if (OB_FAIL(deep_copy_table_arg(allocator, alter_table_arg_, alter_table_arg))) {
       LOG_WARN("fail to deep copy table arg", K(ret));
     } else {
+      // Rollback must only undo the constraint change, not repeat the original table options.
+      alter_table_arg.alter_table_schema_.alter_option_bitset_.reset();
+      alter_table_arg.is_alter_options_ = false;
       alter_table_arg.based_schema_object_infos_.reset();
       ObTableSchema::const_constraint_iterator iter = alter_table_arg.alter_table_schema_.constraint_begin();
       if (obrpc::ObAlterTableArg::ADD_CONSTRAINT == alter_table_arg.alter_constraint_type_) {
```

---

### Incident Patch 7: `e2b8d6e5` (2026-09-24)
**Commit Message**: [CP] fix greatest/least with enum/set and decimal int args failing with -4016

**File**: `src/sql/engine/expr/ob_expr_relational_result_type.map` (modified, +2/-2)
```diff
@@ -936,7 +936,7 @@ static constexpr ObObjType RELATIONAL_RESULT_TYPE[ObMaxType][ObMaxType] =
     ObDoubleType,      /* ObJsonType     */
     ObMaxType,         /* ObGeometryType */
     ObMaxType,         /* ObUserDefinedSQLType */
-    ObDecimalIntType,     /* ObDecimalIntType  */
+    ObNumberType,        /* ObDecimalIntType  */
     ObMaxType,         /*  ObCollectionSQLType*/
     ObNumberType,         /* ObMySQLDateType */
     ObNumberType,         /* ObMySQLDateTimeType */
@@ -2944,7 +2944,7 @@ static constexpr ObObjType RELATIONAL_RESULT_TYPE[ObMaxType][ObMaxType] =
     ObDoubleType,     /* DoubleType  */
     ObDoubleType,     /* UFloatType  */
     ObDoubleType,     /* UDoubleType  */
-    ObDecimalIntType,     /* NumberType  */
+    ObNumberType,        /* NumberType  */
     ObDecimalIntType,     /* UNumberType  */
     ObDecimalIntType,     /* DateTimeType  */
     ObDecimalIntType,     /* TimestampType  */
```

---

### Incident Patch 8: `19010675` (2026-09-24)
**Commit Message**: fix: ODPS cpp模式统计fetch statistics JNI, storage api 分任务的时候required col填写。

**File**: `src/share/catalog/odps/ob_odps_catalog.cpp` (modified, +11/-0)
```diff
@@ -436,6 +436,15 @@ int ObOdpsCatalog::fetch_table_statistics(ObIAllocator &allocator,
         LOG_WARN("failed to copy odps format str", K(ret));
       } else if (OB_FAIL(external_format.load_from_string(format_str, allocator))) {
         LOG_WARN("failed to parse odps format str", K(ret));
+      } else {
+        // DDL 串可能缺省 USE_ODPS_JNI_CONNECTOR，补快照当前 GCONF 值，避免 cpp 模式统计回源误走 JNI。
+        ObString stamped_format;
+        external_format.odps_format_.use_odps_jni_connector_ = GCONF._use_odps_jni_connector;
+        if (OB_FAIL(external_format.to_string_with_alloc(stamped_format, allocator))) {
+          LOG_WARN("failed to dump odps format str", K(ret));
+        } else {
+          format_str = stamped_format;
+        }
       }
     } else if (OB_FAIL(get_odps_format_str_from_catalog_properties(allocator, properties_, table_metadata->namespace_name_,
                                                           table_metadata->table_name_, api_mode, format_str, external_format))) {
@@ -823,6 +832,8 @@ int ObOdpsCatalog::get_odps_format_str_from_catalog_properties(common::ObIAlloca
   format.compression_code_ = properties.compression_code_;
   format.region_ = properties.region_;
   format.api_mode_ = api_mode;
+  // snapshot the current GCONF USE_ODPS_JNI_CONNECTOR into the format string
+  format.use_odps_jni_connector_ = GCONF._use_odps_jni_connector;
 
   if (OB_FAIL(format.encrypt())) {
       LOG_WARN("failed to encrypt format", K(ret), K(format));
```

**File**: `src/sql/engine/basic/ob_select_into_op.cpp` (modified, +5/-8)
```diff
@@ -86,14 +86,11 @@ int ObSelectIntoOp::inner_open()
       }
       case ObExternalFileFormat::FormatType::ODPS_FORMAT:
       {
-        use_odps_jni_connector_ = GCONF._use_odps_jni_connector;
-        int8_t unused_mode = 0;
-        if (OB_FAIL(ObSQLUtils::parse_odps_jni_params_from_format_str(
-                MY_SPEC.external_properties_.str_,
-                use_odps_jni_connector_,
-                unused_mode))) {
-          LOG_WARN("failed to parse odps jni params from format str", K(ret));
-        } else if (!use_odps_jni_connector_) {
+        // the connector choice is carried by the format string stamped at
+        // plan build time and already parsed into external_properties_ above;
+        // the executor must follow the plan's snapshot instead of GCONF.
+        use_odps_jni_connector_ = external_properties_.odps_format_.use_odps_jni_connector_;
+        if (!use_odps_jni_connector_) {
 #if defined(OB_BUILD_CPP_ODPS)
           if (OB_FAIL(init_odps_tunnel())) {
             LOG_WARN("failed to init odps tunnel", K(ret));
```

**File**: `src/sql/engine/table/ob_odps_jni_table_row_iter.cpp` (modified, +126/-72)
```diff
@@ -364,17 +364,17 @@ int ObODPSJNITableRowIterator::init_storage_api_meta_param(
     // prepare_data_expr/prepare_partition_expr (no codegen'd exprs here).
     obexpr_odps_nonpart_col_idsmap_.reuse();
     obexpr_odps_part_col_idsmap_.reuse();
-    sorted_column_ids_.reuse();
     for (int64_t i = 0; OB_SUCC(ret) && i < nonpart_col_idxs.count(); ++i) {
       const int64_t target_idx = nonpart_col_idxs.at(i);
       if (OB_UNLIKELY(target_idx < 0 || target_idx >= mirror_nonpart_column_list_.count())) {
         ret = OB_EXTERNAL_ODPS_UNEXPECTED_ERROR;
         LOG_WARN("unexpected odps column index", K(ret), K(target_idx),
                  K(mirror_nonpart_column_list_.count()));
+        LOG_USER_ERROR(OB_EXTERNAL_ODPS_UNEXPECTED_ERROR,
+            "wrong column index point to odps, please check the index of external$tablecol[index] and "
+            "metadata$partition_list_col[index]");
       } else if (OB_FAIL(obexpr_odps_nonpart_col_idsmap_.push_back(ExternalPair{i, target_idx}))) {
         LOG_WARN("failed to keep target idx of external col", K(ret), K(target_idx));
-      } else if (OB_FAIL(sorted_column_ids_.push_back(ExternalPair{i, target_idx}))) {
-        LOG_WARN("failed to keep sorted column ids", K(ret), K(target_idx));
       }
     }
     for (int64_t i = 0; OB_SUCC(ret) && i < part_col_idxs.count(); ++i) {
@@ -383,14 +383,13 @@ int ObODPSJNITableRowIterator::init_storage_api_meta_param(
         ret = OB_EXTERNAL_ODPS_UNEXPECTED_ERROR;
         LOG_WARN("unexpected odps partition column index", K(ret), K(target_idx),
                  K(mirror_partition_column_list_.count()));
+        LOG_USER_ERROR(OB_EXTERNAL_ODPS_UNEXPECTED_ERROR,
+            "wrong column index point to odps, please check the index of external$tablecol[index] and "
+            "metadata$partition_list_col[index]");
       } else if (OB_FAIL(obexpr_odps_part_col_idsmap_.push_back(ExternalPair{i, target_idx}))) {
         LOG_WARN("failed to keep target idx of partition col", K(ret), K(target_idx));
-      } else if (OB_FAIL(sorted_column_ids_.push_back(
-                     ExternalPair{i, target_idx + mirror_nonpart_column_list_.count()}))) {
-        LOG_WARN("failed to keep sorted column ids", K(ret), K(target_idx));
       }
     }
-    lib::ob_sort(sorted_column_ids_.begin(), sorted_column_ids_.end(), ExternalPair::Compare());
     if (OB_FAIL(ret)) {
     } else if (OB_FAIL(init_all_columns_name_as_odps_params())) {
       LOG_WARN("failed to init expected columns and related types", K(ret));
@@ -459,8 +458,6 @@ int ObODPSJNITableRowIterator::prepare_data_expr(const ExprFixedArray &ext_file_
           "metadata$partition_list_col[index]");
     } else if (OB_FAIL(obexpr_odps_nonpart_col_idsmap_.push_back({i, target_idx}))) {
       LOG_WARN("failed to keep target_idx of external col", K(ret), K(target_idx));
-    } else if (OB_FAIL(sorted_column_ids_.push_back(ExternalPair{i, target_idx}))) {
-      LOG_WARN("failed to keep sorted_column_ids", K(ret), K(target_idx));
     } else if (scan_param_ != nullptr) {
       if (ObCollectionSQLType == cur_expr->obj_meta_.get_type() &&
           OB_FAIL(ObODPSTableUtils::create_array_helper(scan_param_->op_->get_eval_ctx().exec_ctx_,
@@ -473,7 +470,6 @@ int ObODPSJNITableRowIterator::prepare_data_expr(const ExprFixedArray &ext_file_
       }
     }
   }
-  lib::ob_sort(sorted_column_ids_.begin(), sorted_column_ids_.end(), ExternalPair::Compare());
   return ret;
 }
 
@@ -495,8 +491,6 @@ int ObODPSJNITableRowIterator::prepare_partition_expr(const ExprFixedArray &ext_
           "metadata$partition_list_col[index]");
     } else if (OB_FAIL(obexpr_odps_part_col_idsmap_.push_back({i, target_idx}))) {
       LOG_WARN("failed to keep target_idx of external col", K(ret), K(target_idx));
-    } else if (OB_FAIL(sorted_column_ids_.push_back({i, target_idx + mirror_nonpart_column_list_.count()}))) {
-      LOG_WARN("failed to keep sorted_column_ids", K(ret), K(target_idx));
     } else if (scan_param_ != nullptr) {
       if (OB_FAIL(check_type_static(mirror_partition_column_list_.at(target_idx), cur_expr, nullptr))) {
         LOG_WARN("odps type map ob type not support", K(ret), K(target_idx));
@@ -505,8 +499,6 @@ int ObODPSJNITableRowIterator::prepare_partition_expr(const ExprFixedArray &ext_
       }
     }
   }
-  lib::ob_sort(sorted_column_ids_.begin(), sorted_column_ids_.end(), ExternalPair::Compare());
-  LOG_DEBUG("sorted column ids", K(sorted_column_ids_));
   return ret;
 }
 
@@ -1872,6 +1864,80 @@ int ObODPSJNITableRowIterator::init_data_tunnel_reader_params(int64_t start, int
   return ret;
 }
 
+// 按列名在 arrow batch 里定位 odps 列，找不到时 field_idx 返回 -1
+static int find_arrow_field_by_name(const std::shared_ptr<arrow::Schema> &schema,
+                                     const ObString &name,
+                                     int64_t &field_idx)
+{
+  int ret = OB_SUCCESS;
+  field_idx = -1;
+  for (int64_t j = 0; OB_SUCC(ret) && j < schema->fields().size();
```

**File**: `src/sql/engine/table/ob_odps_jni_table_row_iter.h` (modified, +22/-8)
```diff
@@ -20,6 +20,7 @@
 namespace arrow {
 class Array;
 class Field;
+class Schema;
 }  // namespace arrow
 namespace oceanbase {
 namespace sql {
@@ -215,7 +216,8 @@ class ObODPSJNITableRowIterator : public ObExternalTableRowIterator {
     mirror_nonpart_column_list_.reset();
     mirror_partition_column_list_.reset();
     partition_specs_.reset();
-    sorted_column_ids_.reset();
+    resolved_column_ids_.reset();
+    resolved_batch_schema_.reset();
     obexpr_odps_nonpart_col_idsmap_.reset();
     obexpr_odps_part_col_idsmap_.reset();
     arena_alloc_.clear();
@@ -342,6 +344,11 @@ class ObODPSJNITableRowIterator : public ObExternalTableRowIterator {
   int fill_column_arrow(ObEvalCtx &ctx, const ObExpr &expr, const std::shared_ptr<arrow::Array> &array,
       const std::shared_ptr<arrow::Field> &field, const MirrorOdpsJniColumn &column,int64_t num_rows, int64_t column_idx);
   int fill_column_exprs_storage(const ExprFixedArray &column_exprs, ObEvalCtx &ctx, int64_t num_rows);
+  // Resolve every projected column (the non-partition and partition id maps)
+  // to its field index in the session arrow schema by column name, once per
+  // schema. The result is cached in resolved_column_ids_, so per-batch
+  // filling works on plain field indexes without any name lookup.
+  int resolve_sorted_columns_by_name(const std::shared_ptr<arrow::Schema> &schema);
   int fill_column_exprs_tunnel(const ExprFixedArray &column_exprs, ObEvalCtx &ctx, int64_t num_rows);
 
   int get_next_rows_tunnel(int64_t &count, int64_t capacity);
@@ -422,17 +429,24 @@ class ObODPSJNITableRowIterator : public ObExternalTableRowIterator {
   struct ExternalPair {
     int64_t ob_col_idx_;
     int64_t odps_col_idx_;
-    struct Compare {
-      bool operator()(ExternalPair &l, ExternalPair &r)
-      {
-        return l.odps_col_idx_ < r.odps_col_idx_;
-      }
-    };
     TO_STRING_KV(K_(ob_col_idx), K_(odps_col_idx));
   };
   ObTime ob_time_;
   ObString timezone_str_;
-  ObSEArray<ExternalPair, 4> sorted_column_ids_;
+  // resolved per session schema: every projected column (from the two id maps
+  // below) mapped to its field index in the session arrow schema by name;
+  // cached per schema and shared by the storage and tunnel arrow fill loops
+  struct ResolvedColumnPair {
+    int64_t ob_col_idx_;
+    int64_t mirror_idx_;  // index into the nonpart/part mirror column list
+    int64_t field_idx_;
+    bool is_part_col_;
+    TO_STRING_KV(K_(ob_col_idx), K_(mirror_idx), K_(field_idx), K_(is_part_col));
+  };
+  ObSEArray<ResolvedColumnPair, 16> resolved_column_ids_;
+  // the schema resolved_column_ids_ was built against; batches with the same
+  // schema reuse the resolution
+  std::shared_ptr<arrow::Schema> resolved_batch_schema_;
   // total_column_ids_ contains the all column with parittion column and
   ObSEArray<ExternalPair, 4> obexpr_odps_part_col_idsmap_;
   // obexpr_odps_nonpart_col_idsmap_ only contains the normal column index.
```

**File**: `src/sql/optimizer/file_prune/ob_odps_file_pruner.cpp` (modified, +103/-50)
```diff
@@ -16,12 +16,81 @@
 #include "sql/ob_sql_context.h"
 #include "sql/ob_sql_utils.h"
 #include "sql/rewrite/ob_query_range_define.h"
+#include "sql/resolver/dml/ob_stmt_expr_visitor.h"
 
 using namespace oceanbase::sql;
 using namespace oceanbase::common;
 using namespace oceanbase::share;
 using namespace oceanbase::share::schema;
 
+// 从 stmt 表达式树里收集查询真实引用的 odps 伪列（不能走 column items：
+// resolver 会把全部存储生成列预解析进去，无裁剪信息）。
+namespace
+{
+class ObOdpsRefColIdxCollector : public ObStmtExprVisitor
+{
+public:
+  ObOdpsRefColIdxCollector(const uint64_t table_id,
+                           ObIArray<int64_t> &nonpart_idxs,
+                           ObIArray<int64_t> &part_idxs)
+      : table_id_(table_id), nonpart_idxs_(nonpart_idxs), part_idxs_(part_idxs)
+  {
+    // 跳过 SCOPE_BASIC_TABLE：该 scope 遍历的是被污染的全量 column items
+    set_relation_scope();
+  }
+  virtual ~ObOdpsRefColIdxCollector() {}
+  virtual int do_visit(ObRawExpr *&expr) override { return collect(expr); }
+  int collect(const ObRawExpr *expr)
+  {
+    int ret = OB_SUCCESS;
+    if (OB_ISNULL(expr)) {
+      // do nothing
+    } else if (T_PSEUDO_EXTERNAL_FILE_COL == expr->get_expr_type()
+               || T_PSEUDO_PARTITION_LIST_COL == expr->get_expr_type()) {
+      const ObPseudoColumnRawExpr *pseudo_col_expr =
+          static_cast<const ObPseudoColumnRawExpr *>(expr);
+      if (pseudo_col_expr->get_table_id() != table_id_) {
+        // 其他表的伪列，忽略
+      } else {
+        const int64_t column_idx = pseudo_col_expr->get_column_idx() - 1;
+        ObIArray<int64_t> &idxs = T_PSEUDO_EXTERNAL_FILE_COL == expr->get_expr_type()
+                                      ? nonpart_idxs_
+                                      : part_idxs_;
+        bool found = false;
+        for (int64_t i = 0; !found && i < idxs.count(); ++i) {
+          found = (idxs.at(i) == column_idx);
+        }
+        if (OB_UNLIKELY(column_idx < 0)) {
+          ret = OB_ERR_UNEXPECTED;
+          LOG_WARN("unexpected odps pseudo column idx", K(ret), K(column_idx));
+        } else if (!found && OB_FAIL(idxs.push_back(column_idx))) {
+          LOG_WARN("failed to push back odps column idx", K(ret), K(column_idx));
+        }
+      }
+    } else if (expr->is_column_ref_expr()
+               && OB_NOT_NULL(static_cast<const ObColumnRefRawExpr *>(expr)->get_dependant_expr())) {
+      // 生成列引用：伪列藏在 dependant 表达式里
+      if (OB_FAIL(collect(static_cast<const ObColumnRefRawExpr *>(expr)->get_dependant_expr()))) {
+        LOG_WARN("failed to collect from dependant expr", K(ret));
+      }
+    } else if (!expr->has_flag(CNT_PSEUDO_COLUMN) && !expr->has_flag(CNT_COLUMN)) {
+      // 子树既无伪列也无列引用（生成列会间接引用伪列），无需递归
+    } else {
+      for (int64_t i = 0; OB_SUCC(ret) && i < expr->get_param_count(); ++i) {
+        if (OB_FAIL(collect(expr->get_param_expr(i)))) {
+          LOG_WARN("failed to collect from param expr", K(ret), K(i));
+        }
+      }
+    }
+    return ret;
+  }
+private:
+  uint64_t table_id_;
+  ObIArray<int64_t> &nonpart_idxs_;
+  ObIArray<int64_t> &part_idxs_;
+};
+} // anonymous namespace
+
 // ---------------------------------------------------------------------------
 // The split helpers of the QC-stage ODPS assignment. They only ever serve
 // assign_odps_file_to_sqcs_, and write into per-server-slot ObOdpsSlotFiles.
@@ -484,14 +553,40 @@ int ObODPSFilePruner::init(ObSqlSchemaGuard &sql_schema_guard,
       } else if (OB_UNLIKELY(!is_odps_external_table)) {
         ret = OB_ERR_UNEXPECTED;
         LOG_WARN("not an odps external table", K(ret), K(ref_table_id));
-      } else if (OB_FAIL(ob_write_string(allocator_, format_str, format_str_))) {
-        LOG_WARN("failed to copy odps format str", K(ret));
+      } else {
+        // stamp the effective connector choice (hint > GCONF) into the format string
+        ObString effective_format;
+        if (OB_FAIL(ObSQLUtils::apply_odps_hints_to_format_str(
+                format_str,
+                stmt.get_query_ctx()->get_global_hint().opt_params_,
+                allocator_,
+                effective_format))) {
+          LOG_WARN("failed to apply odps hints to format str", K(ret));
+        } else if (OB_FAIL(ob_write_string(allocator_,
+                effective_format.empty() ? format_str : effective_format,
+                format_str_))) {
+          LOG_WARN("failed to copy odps format str", K(ret));
+        }
       }
     }
 
     if (OB_FAIL(ret)) {
     } else if (OB_FAIL(collect_projected_column_idxs_(stmt))) {
       LOG_WARN("failed to collect projected odps column idxs", K(ret));
+    } else {
+      // 分区列不走查询表达式（走 session 的分区 spec），这里全量补齐防止欠集
+      const int64_t part_key_cnt = table_schema->get_partition_key_column_num();
+      for (int64_t i = 0; OB_SUCC(ret) && i < part_key_cnt; ++i) {
+        bool found = false;
+        for (int64_t j = 0; !found && j < part_col_idxs_.count(); ++j) {
+          found = (part_col_idxs_.at(j) == i);
+        }
+        if (!found && OB_FAIL(
```

**File**: `src/sql/optimizer/file_prune/ob_odps_file_pruner.h` (modified, +1/-5)
```diff
@@ -213,12 +213,8 @@ class ObODPSFilePruner : public ObILakeTableFilePruner
   int resolve_partition_specs_(ObExecContext &exec_ctx,
                                const common::ObIArray<const share::schema::ObPartition *> &parts,
                                common::ObIArray<common::ObString> &part_specs);
-  /// Walks the statement's column items of this table and collects the projected
-  /// ODPS column indexes from the pseudo column exprs hidden inside the (stored
-  /// generated) column expressions — the optimizer-time twin of
-  /// ObLogTableScan::extract_file_column_exprs_recursively.
+  /// 从 stmt 表达式树收集投影 odps 列（column items 被污染不可用），分区列由 init() 补齐
   int collect_projected_column_idxs_(const ObDMLStmt &stmt);
-  int collect_pseudo_col_idx_recursively_(const ObRawExpr *expr);
   /// Schema partition ids selected by an explicit PARTITION(p0, ...) clause
   /// (empty when the clause is absent), from TableItem::part_ids_.
   int collect_clause_part_ids_(const ObDMLStmt &stmt);
```

---

### Incident Patch 9: `b3b7ea4a` (2026-09-23)
**Commit Message**: [CP] Fix schema refresh intent publication and RS sequence progress

**File**: `src/rootserver/ob_ddl_service.cpp` (modified, +34/-40)
```diff
@@ -28231,50 +28231,54 @@ int ObDDLService::retry_to_get_schema_version_(const ObRefreshSchemaStatus &sche
 }
 
 
-int ObDDLService::refresh_schema(uint64_t tenant_id, const bool inc_sequence_id, int64_t *refreshed_schema_version)
+int ObDDLService::refresh_schema(const uint64_t tenant_id)
 {
   int ret = OB_SUCCESS;
-  ObArray<uint64_t> tenant_ids;
   ObRefreshSchemaInfo schema_info;
   if (OB_INVALID_TENANT_ID == tenant_id) {
     ret = OB_INVALID_ARGUMENT;
     LOG_WARN("invalid tenant_id", K(ret));
-  } else if (OB_FAIL(tenant_ids.push_back(tenant_id))) {
+  } else if (OB_FAIL(construct_tenant_broadcast_info(tenant_id, schema_info))) {
+    LOG_WARN("fail to construct tenant broadcast info", KR(ret), K(tenant_id));
+  } else if (OB_FAIL(refresh_schema(schema_info))) {
+    LOG_WARN("fail to refresh schema", KR(ret), K(schema_info));
+  }
+  return ret;
+}
+
+int ObDDLService::refresh_schema(const ObRefreshSchemaInfo &schema_info)
+{
+  int ret = OB_SUCCESS;
+  const uint64_t tenant_id = schema_info.get_tenant_id();
+  int64_t refreshed_schema_version = OB_INVALID_VERSION;
+  ObArray<uint64_t> tenant_ids;
+  if (OB_FAIL(tenant_ids.push_back(tenant_id))) {
     LOG_WARN("fail to push back tenant_id", KR(ret), K(tenant_id));
   } else if (OB_FAIL(schema_retry_to_die(tenant_id, &ObDDLService::retry_to_refresh_schema_, tenant_ids))) {
     LOG_WARN("fail to retry refresh schema", KR(ret), K(tenant_id));
   }
   bool need_stop = !ObDDLServiceLauncher::is_ddl_service_started();
   if (OB_SUCC(ret) && !need_stop) {
-    int64_t schema_version = OB_INVALID_VERSION;
-    if (OB_FAIL(schema_service_->get_tenant_refreshed_schema_version(
-                       tenant_id, schema_version))) {
+    if (OB_FAIL(schema_service_->get_tenant_refreshed_schema_version(tenant_id, refreshed_schema_version))) {
       LOG_WARN("fail to get tenant refreshed schema version", KR(ret), K(tenant_id));
+    } else if (OB_INVALID_VERSION != refreshed_schema_version
+               && refreshed_schema_version < schema_info.get_schema_version()) {
+      ret = OB_ERR_UNEXPECTED;
+      LOG_WARN("tenant schema version rollback", KR(ret), K(tenant_id), K(refreshed_schema_version), K(schema_info));
     } else {
-      ObSchemaService *schema_service = schema_service_->get_schema_service();
-      ObRefreshSchemaInfo schema_info;
-      schema_info.set_tenant_id(tenant_id);
-      schema_info.set_schema_version(schema_version);
+      ObArray<ObRefreshSchemaInfo> schema_infos;
       bool all_tenant_schema_refreshed = false;
-      if (OB_ISNULL(schema_service)) {
-        ret = OB_ERR_UNEXPECTED;
-        LOG_WARN("schema_service is null", K(ret));
-      } else if (inc_sequence_id && OB_FAIL(schema_service->inc_sequence_id())) {
-        LOG_WARN("increase sequence_id failed", K(ret));
-      } else if (FALSE_IT(schema_info.set_sequence_id(schema_service->get_sequence_id()))) {
-      } else if (OB_FAIL(schema_service->set_refresh_schema_info(schema_info))) {
-        LOG_WARN("fail to set refresh schema info", KR(ret), K(schema_info));
-      } else if (OB_FAIL(schema_service_->check_all_tenant_schema_refreshed(all_tenant_schema_refreshed))) {
-        LOG_WARN("fail to check all tenant schema refreshed", KR(ret));
-      }
       // notify_refresh_schema will skip rs, so update rs sequence_id here.
       // We need to check all tenant schema refreshed, because schema refresh is driven by heartbeat after observer restart.
       // Otherwise, sequence_id will be updated here even if some tenants' schema is not refreshed,
       // and schema refresh driven by heartbeat may skip these tenants.
-      else if (all_tenant_schema_refreshed && OB_FAIL(schema_service_->set_last_refreshed_schema_info(schema_info))) {
-        LOG_WARN("fail to set last refreshed schema info", KR(ret));
-      } else if (OB_NOT_NULL(refreshed_schema_version)) {
-        *refreshed_schema_version = schema_version;
+      // A single-tenant refresh cannot cover sequence gaps or unloaded tenants.
+      if (OB_FAIL(schema_service_->check_all_tenant_schema_refreshed(all_tenant_schema_refreshed))) {
+        LOG_WARN("fail to check all tenant schema refreshed", KR(ret));
+      } else if (all_tenant_schema_refreshed && OB_FAIL(schema_infos.push_back(schema_info))) {
+        LOG_WARN("fail to push back refresh schema info", KR(ret));
+      } else if (all_tenant_schema_refreshed && OB_FAIL(schema_service_->try_update_last_refreshed_schema_info(schema_infos))) {
+        LOG_WARN("fail to update last refreshed schema info", KR(ret));
       }
     }
   }
@@ -28299,10 +28303,8 @@ int ObDDLService::construct_tenant_broadcast_info(const uint64_t tenant_id, ObRe
     if (OB_ISNULL(schema_service)) {
       ret = OB_ERR_UNEXPECTED;
       LOG_WARN("schema_service is null", K(ret));
-    } else if (OB_FAIL(schema_service->inc_sequence_id())) {
-      LOG_WARN("increase sequence_id failed", K(ret));
-    } else {
-      schema_info.set_sequence_id(schema_service->get_seq
```

**File**: `src/rootserver/ob_ddl_service.h` (modified, +3/-1)
```diff
@@ -1056,7 +1056,7 @@ int check_table_udt_id_is_exist(share::schema::ObSchemaGetterGuard &schema_guard
   //----End of functions for managing row level security----
 
   // refresh local schema busy wait
-  virtual int refresh_schema(const uint64_t tenant_id, const bool inc_sequence_id = true, int64_t *refreshed_schema_version = nullptr);
+  virtual int refresh_schema(const uint64_t tenant_id);
   // notify other servers to refresh schema (call switch_schema  rpc)
   // for optimize wait schema refresh & sync time after a ddl finish,
   // notify refresh schema would broadcast the last generate schema version in serial ddl
@@ -1267,6 +1267,8 @@ int check_table_udt_id_is_exist(share::schema::ObSchemaGetterGuard &schema_guard
 
   int retry_to_refresh_schema_(ObArray<uint64_t> &tenant_ids);
   int retry_to_get_schema_version_(const ObRefreshSchemaStatus &schema_status, int64_t &broadcast_schema_version);
+  // Apply an existing refresh intent without allocating another sequence.
+  int refresh_schema(const ObRefreshSchemaInfo &schema_info);
   int get_lock_argument_for_rename_(
       const uint32_t client_session_id,
       const int64_t client_session_create_ts,
```

**File**: `src/rootserver/ob_ddl_service_launcher.cpp` (modified, +4/-5)
```diff
@@ -221,7 +221,6 @@ int ObDDLServiceLauncher::init_sequence_id_(
     ret = OB_INVALID_ARGUMENT;
     LOG_WARN("invalid argument", KR(ret), KP(GCTX.root_service_));
   } else {
-    ObRefreshSchemaInfo schema_info;
     int64_t schema_version = OB_INVALID_VERSION;
     ObSchemaService *schema_service = GCTX.root_service_->get_schema_service().get_schema_service();
     if (OB_ISNULL(schema_service)) {
@@ -253,15 +252,15 @@ int ObDDLServiceLauncher::init_sequence_id_(
         //     Although this check seams useeless, we still reserve it.
         LOG_INFO("sys tenant schema version not refreshed, do not trigger schema refresh",
                  KR(ret), K(schema_version));
-      } else if (OB_FAIL(schema_service->set_refresh_schema_info(schema_info))) {
-        LOG_WARN("fail to set refresh schema info", KR(ret), K(schema_info));
+      } else if (OB_FAIL(schema_service->init_refresh_schema_info())) {
+        LOG_WARN("fail to init refresh schema info", KR(ret));
       }
     } else {
       // init sequence id with new logic
       if (OB_FAIL(schema_service->init_sequence_id_by_sys_leader_epoch(proposal_id))) {
         LOG_WARN("fail to init sequence id by sys leader epoch", KR(ret), K(proposal_id));
-      } else if (OB_FAIL(schema_service->set_refresh_schema_info(schema_info))) {
-        LOG_WARN("fail to set refresh schema info", K(ret), K(schema_info));
+      } else if (OB_FAIL(schema_service->init_refresh_schema_info())) {
+        LOG_WARN("fail to init refresh schema info", K(ret));
       }
     }
   }
```

**File**: `src/rootserver/ob_root_service.cpp` (modified, +22/-20)
```diff
@@ -10228,29 +10228,10 @@ int ObRootService::broadcast_schema(const obrpc::ObBroadcastSchemaArg &arg)
     ret = OB_ERR_UNEXPECTED;
     LOG_WARN("schema_service is null", K(ret), KP_(schema_service));
   } else {
-    ObRefreshSchemaInfo schema_info;
-    ObSchemaService *schema_service = schema_service_->get_schema_service();
-    if (OB_INVALID_TENANT_ID != arg.tenant_id_) {
-      // tenant_id is valid, just refresh specify tenant's schema.
-      schema_info.set_tenant_id(arg.tenant_id_);
-      schema_info.set_schema_version(arg.schema_version_);
-    } else {
-      // tenant_id =  OB_INVALID_TENANT_ID, indicates refresh all tenants's schema;
-      if (OB_FAIL(schema_service->inc_sequence_id())) {
-        LOG_WARN("increase sequence_id failed", K(ret));
-      }
-    }
-    if (OB_FAIL(ret)) {
-    } else if (OB_FAIL(schema_service->inc_sequence_id())) {
-      LOG_WARN("increase sequence_id failed", K(ret));
-    } else if (OB_FAIL(schema_service->set_refresh_schema_info(schema_info))) {
-      LOG_WARN("fail to set refresh schema info", K(ret), K(schema_info));
-    }
     // if switchover to primary tenant, we should clear ddl epoch in RS
     // if not clear ddl epoch in RS, we could loss some DDL changes under
     // previous primary_tenant in another cluster
-    if (OB_FAIL(ret)) {
-    } else if (arg.need_clear_ddl_epoch()) {
+    if (arg.need_clear_ddl_epoch()) {
       // only switchover need clear ddl epoch by broadcast schema
       // tenant id should be valid under this case
       if (OB_UNLIKELY(!is_valid_tenant_id(arg.tenant_id_))) {
@@ -10260,6 +10241,15 @@ int ObRootService::broadcast_schema(const obrpc::ObBroadcastSchemaArg &arg)
         schema_service_->get_ddl_epoch_mgr().remove_ddl_epoch(arg.tenant_id_);
       }
     }
+    if (OB_SUCC(ret)) {
+      ObSchemaService *schema_service = schema_service_->get_schema_service();
+      ObRefreshSchemaInfo schema_info;
+      schema_info.set_tenant_id(arg.tenant_id_);
+      schema_info.set_schema_version(arg.schema_version_);
+      if (OB_FAIL(schema_service->inc_and_set_refresh_schema_info(schema_info))) {
+        LOG_WARN("fail to inc and set refresh schema info", KR(ret), K(schema_info));
+      }
+    }
   }
   LOG_INFO("end broadcast_schema request", K(ret), K(arg));
   return ret;
@@ -11779,13 +11769,25 @@ int ObRootService::get_refreshed_schema_versions(obrpc::ObGetRefreshedSchemaVers
   int ret = OB_SUCCESS;
   res.refreshed_schema_versions_.reset();
   ObArray<uint64_t> tenant_ids;
+  ObRefreshSchemaInfo refresh_schema_info;
+  ObRefreshSchemaInfo last_refreshed_schema_info;
 
   if (OB_UNLIKELY(!inited_)) {
     ret = OB_NOT_INIT;
     LOG_WARN("not init", KR(ret));
   } else if (OB_ISNULL(schema_service_)) {
     ret = OB_ERR_UNEXPECTED;
     LOG_WARN("schema_service_ is null", KR(ret));
+  } else if (OB_FAIL(schema_service_->get_refresh_schema_info(refresh_schema_info))) {
+    LOG_WARN("get refresh schema info failed", KR(ret));
+  } else if (OB_FAIL(schema_service_->get_last_refreshed_schema_info(last_refreshed_schema_info))) {
+    LOG_WARN("get last refreshed schema info failed", KR(ret));
+  } else if (ObDDLSequenceID::EQUAL_TO != refresh_schema_info.get_sequence_id().compare_to_other_id(
+                                            last_refreshed_schema_info.get_sequence_id())) {
+    // Only matching sequences allow observers to use RS versions to cover sequence gaps.
+    ret = OB_EAGAIN;
+    LOG_WARN("published and refreshed schema sequences do not match", KR(ret),
+             K(refresh_schema_info), K(last_refreshed_schema_info));
   } else if (OB_FAIL(schema_service_->get_tenant_ids(tenant_ids))) {
     LOG_WARN("get tenant ids failed", KR(ret));
   } else {
```

**File**: `src/share/schema/ob_schema_service.h` (modified, +4/-2)
```diff
@@ -901,10 +901,12 @@ class ObSchemaService
   /* sequence_id related */
   virtual int init_sequence_id_by_rs_epoch(const int64_t rootservice_epoch) = 0; // for compatible use
   virtual int init_sequence_id_by_sys_leader_epoch(const int64_t sys_leader_epoch) = 0;
-  virtual int inc_sequence_id() = 0;
   virtual ObDDLSequenceID get_sequence_id() const = 0;
 
-  virtual int set_refresh_schema_info(const ObRefreshSchemaInfo &schema_info) = 0;
+  // Initialize the heartbeat notification without incrementing sequence_id.
+  virtual int init_refresh_schema_info() = 0;
+  // Allocate and publish a refresh event, returning its sequence in schema_info.
+  virtual int inc_and_set_refresh_schema_info(ObRefreshSchemaInfo &schema_info) = 0;
   virtual int get_refresh_schema_info(ObRefreshSchemaInfo &schema_info) = 0;
 
   virtual void set_cluster_schema_status(const ObClusterSchemaStatus &schema_status) = 0;
```

**File**: `src/share/schema/ob_schema_service_sql_impl.cpp` (modified, +22/-10)
```diff
@@ -9675,24 +9675,36 @@ int ObSchemaServiceSQLImpl::init_sequence_id_by_sys_leader_epoch(const int64_t s
   return ret;
 }
 
-int ObSchemaServiceSQLImpl::inc_sequence_id()
+int ObSchemaServiceSQLImpl::init_refresh_schema_info()
 {
   int ret = OB_SUCCESS;
   SpinWLockGuard guard(rw_lock_);
-  return sequence_id_.inc_seq_id();
+  schema_info_.reset();
+  if (OB_FAIL(schema_info_.set_sequence_id(sequence_id_))) {
+    LOG_WARN("fail to set sequence id", KR(ret), K_(sequence_id));
+  }
+  LOG_INFO("init refresh schema info", K(ret), K(schema_info_));
+  return ret;
 }
 
-int ObSchemaServiceSQLImpl::set_refresh_schema_info(const ObRefreshSchemaInfo &schema_info)
+int ObSchemaServiceSQLImpl::inc_and_set_refresh_schema_info(ObRefreshSchemaInfo &schema_info)
 {
   int ret = OB_SUCCESS;
-  // TODO
-  // init_sequence_id、inc_sequence_id、set_refresh_schema_info to
-  // atomic update squence_id and schema_info
   SpinWLockGuard guard(rw_lock_);
-  schema_info_.set_tenant_id(schema_info.get_tenant_id());
-  schema_info_.set_schema_version(schema_info.get_schema_version());
-  schema_info_.set_sequence_id(sequence_id_);
-  LOG_INFO("set refresh schema info", K(ret), K(schema_info_));
+  // A gap makes observers refresh all tenants, including during rolling upgrades.
+  const int64_t inc_count = OB_INVALID_TENANT_ID == schema_info.get_tenant_id() ? 2 : 1;
+  for (int64_t i = 0; OB_SUCC(ret) && i < inc_count; ++i) {
+    if (OB_FAIL(sequence_id_.inc_seq_id())) {
+      LOG_WARN("fail to increase sequence id", KR(ret), K_(sequence_id));
+    }
+  }
+  if (OB_SUCC(ret)) {
+    schema_info.set_sequence_id(sequence_id_);
+    if (OB_FAIL(schema_info_.assign(schema_info))) {
+      LOG_WARN("fail to assign refresh schema info", KR(ret), K(schema_info));
+    }
+  }
+  LOG_INFO("inc and set refresh schema info", K(ret), K(schema_info_));
   return ret;
 }
 
```

**File**: `src/share/schema/ob_schema_service_sql_impl.h` (modified, +2/-2)
```diff
@@ -142,13 +142,13 @@ class ObSchemaServiceSQLImpl : public ObSchemaService
   /* sequence_id related */
   virtual int init_sequence_id_by_rs_epoch(const int64_t rootservice_epoch); // for compatible use
   virtual int init_sequence_id_by_sys_leader_epoch(const int64_t sys_leader_epoch);
-  virtual int inc_sequence_id();
 
   virtual ObDDLSequenceID get_sequence_id() const { SpinRLockGuard guard(rw_lock_); return sequence_id_; }
 
   virtual int get_refresh_schema_info(ObRefreshSchemaInfo &schema_info);
   //enable refresh schema info
-  virtual int set_refresh_schema_info(const ObRefreshSchemaInfo &schema_info);
+  virtual int init_refresh_schema_info();
+  virtual int inc_and_set_refresh_schema_info(ObRefreshSchemaInfo &schema_info);
 
 #ifdef OB_BUILD_SHARED_STORAGE
   // get schema of __all_sslog_table
```

---

### Incident Patch 10: `f7e3a303` (2026-09-23)
**Commit Message**: Fixed the issue where the primary key conflict check might miss conflicting rows

**File**: `src/storage/access/ob_sstable_row_lock_checker.cpp` (modified, +3/-4)
```diff
@@ -199,16 +199,15 @@ int ObSSTableRowLockMultiChecker::fetch_row(ObSSTableReadHandle &read_handle)
   } else {
     if (-1 == prefetcher_.cur_micro_data_fetch_idx_) {
       prefetcher_.cur_micro_data_fetch_idx_ = read_handle.micro_begin_idx_;
-    } else {
-      prefetcher_.inc_cur_micro_data_fetch_idx();
-    }
-    if (prefetcher_.cur_micro_data_fetch_idx_ > read_handle.micro_end_idx_) {
+    } else if (prefetcher_.cur_micro_data_fetch_idx_ >= read_handle.micro_end_idx_) {
       ret = OB_ITER_END;
       LOG_DEBUG("all prefetched blocks checked", K(ret), K(read_handle),
           K(prefetcher_.cur_micro_data_fetch_idx_), K(prefetcher_.is_prefetch_end_));
       if (prefetcher_.is_prefetch_end_) {
         ++prefetcher_.cur_range_fetch_idx_;
       }
+    } else {
+      prefetcher_.inc_cur_micro_data_fetch_idx();
     }
 
     if (OB_FAIL(ret)) {
```

---

### Incident Patch 11: `d25f50a1` (2026-09-23)
**Commit Message**: [CP] fix(storage): report session GTT state from session tablets

**File**: `src/observer/mysql/ob_feedback_proxy_utils.cpp` (modified, +31/-6)
```diff
@@ -6,6 +6,7 @@
 #define USING_LOG_PREFIX SQL
 
 #include "observer/mysql/ob_feedback_proxy_utils.h"
+#include "observer/omt/ob_tenant_config_mgr.h"
 #include "sql/session/ob_sql_session_info.h"
 
 namespace oceanbase
@@ -14,7 +15,30 @@ using namespace common;
 namespace observer
 {
 ObIsLockSessionInfo ObFeedbackProxyUtils::is_lock_session(ObFeedbackProxyInfoType::IS_LOCK_SESSION, '1');
-ObIsTemporaryTableSessionInfo ObFeedbackProxyUtils::is_temporary_table_session(ObFeedbackProxyInfoType::IS_TEMPORARY_TABLE_SESSION, '1');
+
+void ObFeedbackProxyUtils::refresh_temp_table_feedback_state_(sql::ObSQLSessionInfo &sess)
+{
+  // Mark a session when it tracks a GTT session tablet and is eligible for
+  // non-forced routing. Refresh the flag after statement execution and only
+  // feedback when the effective value changes.
+  const uint64_t data_version = sess.get_min_data_version_of_init_sess();
+  if ((data_version >= MOCK_DATA_VERSION_4_4_2_1 && data_version < DATA_VERSION_4_5_0_0)
+      || data_version >= DATA_VERSION_4_6_1_0) {
+    const bool is_used = sess.get_gtt_tablet_info_map().has_session_tablet();
+    // Keep a marked session sticky while any session tablet remains. Changes to
+    // the routing configuration only affect sessions that are not marked.
+    bool flag = is_used && sess.is_temporary_table_session();
+    if (is_used && !flag) {
+      omt::ObTenantConfigGuard tenant_config(TENANT_CONF(sess.get_effective_tenant_id()));
+      const bool need_strong_routing = tenant_config.is_valid()
+          ? !tenant_config->_enable_gtt_non_forced_routing
+          : true;
+      const bool strong_routing = INVALID_SESSID != sess.get_client_sid() ? need_strong_routing : true;
+      flag = is_used && !strong_routing;
+    }
+    sess.mark_session_temp_table_used(flag);
+  }
+}
 
 int ObFeedbackProxyUtils::append_feedback_proxy_info(common::ObIAllocator &allocator,
                                                      ObIArray<obmysql::Obp20Encoder *> *extra_info_ecds,
@@ -27,6 +51,7 @@ int ObFeedbackProxyUtils::append_feedback_proxy_info(common::ObIAllocator &alloc
   void *ecd_buf = nullptr;
   obmysql::Obp20FeedbackProxyInfoEncoder *fb_proxy_info_ecd = nullptr;
 
+  refresh_temp_table_feedback_state_(sess);
   if (sess.is_need_send_feedback_proxy_info()) {
     len = get_serialize_size_(sess);
     LOG_DEBUG("begin to feedback proxy info", K(sess.get_server_sid()), K(len));
@@ -73,6 +98,8 @@ int ObFeedbackProxyUtils::append_feedback_proxy_info(common::ObIAllocator &alloc
 int64_t ObFeedbackProxyUtils::get_serialize_size_(sql::ObSQLSessionInfo &sess)
 {
   int64_t size = 0;
+  const ObIsTemporaryTableSessionInfo is_temporary_table_session(
+      ObFeedbackProxyInfoType::IS_TEMPORARY_TABLE_SESSION, '1');
   size += is_lock_session.get_serialize_size();
   size += is_temporary_table_session.get_serialize_size();
   // add other information here...
@@ -90,11 +117,9 @@ int ObFeedbackProxyUtils::serialize_(sql::ObSQLSessionInfo &sess, char *buf, int
   if (OB_FAIL(is_lock_session.serialize(buf, len, pos))) {
     LOG_WARN("serialize is_lock_session failed", K(ret), K(is_lock_session));
   }
-  if (!sess.is_temporary_table_session()) {
-    is_temporary_table_session.set_value('0');
-  } else {
-    is_temporary_table_session.set_value('1');
-  }
+  const ObIsTemporaryTableSessionInfo is_temporary_table_session(
+      ObFeedbackProxyInfoType::IS_TEMPORARY_TABLE_SESSION,
+      sess.is_temporary_table_session() ? '1' : '0');
   if (FAILEDx(is_temporary_table_session.serialize(buf, len, pos))) {
     LOG_WARN("serialize is_temporary_table_session failed", K(ret), K(is_temporary_table_session));
   }
```

**File**: `src/observer/mysql/ob_feedback_proxy_utils.h` (modified, +1/-1)
```diff
@@ -99,6 +99,7 @@ class ObFeedbackProxyUtils
   }
 
 private:
+  static void refresh_temp_table_feedback_state_(sql::ObSQLSessionInfo &sess);
   static int64_t get_serialize_size_(sql::ObSQLSessionInfo &sess);
   static int serialize_(sql::ObSQLSessionInfo &sess, char *buf, int64_t len, int64_t &pos);
   template <typename T>
@@ -144,7 +145,6 @@ class ObFeedbackProxyUtils
 
 private:
   static ObIsLockSessionInfo is_lock_session;
-  static ObIsTemporaryTableSessionInfo is_temporary_table_session;
 };
 }  // namespace observer
 }  // namespace oceanbase
```

**File**: `src/sql/ob_sql.cpp` (modified, +1/-1)
```diff
@@ -5417,7 +5417,7 @@ int ObSql::after_get_plan(ObPlanCacheCtx &pc_ctx,
             LOG_WARN("fail to get session temp table used", K(ret));
           } else if (is_already_set) {
             //do nothing
-          } else if (OB_FAIL(session.set_session_temp_table_used(session, true, phy_plan->need_strong_routing()))) {
+          } else if (OB_FAIL(session.set_session_temp_table_used(true))) {
             LOG_WARN("fail to set session temp table used", K(ret));
           }
           LOG_DEBUG("plan contain oracle session level temporary table detected", K(is_already_set));
```

**File**: `src/sql/resolver/ddl/ob_create_table_resolver.cpp` (modified, +2/-10)
```diff
@@ -309,20 +309,12 @@ int ObCreateTableResolver::add_udt_hidden_column(ObTableSchema &table_schema,
 int ObCreateTableResolver::set_temp_table_info(ObTableSchema &table_schema, ParseNode *commit_option_node)
 {
   int ret = OB_SUCCESS;
-  uint64_t data_version = 0;
-  bool enable_no_strong_routing = false;
-  if (OB_NOT_NULL(session_info_)) {
-    ObTenantConfigGuard tenant_config(TENANT_CONF(session_info_->get_effective_tenant_id()));
-    enable_no_strong_routing = tenant_config.is_valid()
-                               ? tenant_config->_enable_gtt_non_forced_routing
-                               : false;
-  }
-  bool need_strong_routing = !(is_oracle_mode() && !is_old_oracle_temp_table_ && enable_no_strong_routing);
   if (OB_ISNULL(session_info_)) {
     ret = OB_ERR_UNEXPECTED;
     LOG_WARN("session info is null", KR(ret));
   } else if (FALSE_IT(session_info_->set_has_temp_table_flag())) {
-  } else if (OB_FAIL(session_info_->set_session_temp_table_used(*session_info_, true, need_strong_routing))) {
+  } else if (!is_oracle_mode()
+             && OB_FAIL(session_info_->set_session_temp_table_used(true))) {
     LOG_WARN("fail to set session temp table used", KR(ret));
   } else if (OB_FAIL(set_table_name(table_name_))) {
       LOG_WARN("failed to set table name", K(ret), K(table_name_));
```

**File**: `src/sql/session/ob_basic_session_info.cpp` (modified, +1/-11)
```diff
@@ -6562,23 +6562,13 @@ int ObBasicSessionInfo::set_trans_specified(const bool is_spec)
   return ret;
 }
 
-// The old Oracle temporary tables still have the strong routing limit
-//  because removing strong routing might cause unpredictable issues.
-int ObBasicSessionInfo::set_session_temp_table_used(ObSQLSessionInfo &session, const bool is_used, const bool need_strong_routing)
+int ObBasicSessionInfo::set_session_temp_table_used(const bool is_used)
 {
   int ret = OB_SUCCESS;
   ObObj obj;
   obj.set_int(is_used);
   if (OB_FAIL(update_sys_variable(SYS_VAR__OB_PROXY_SESSION_TEMPORARY_TABLE_USED, obj))) {
     LOG_WARN("fail to update_system_variable", K(ret));
-  } else {
-    const uint64_t data_version = session.get_min_data_version_of_init_sess();
-    if ((data_version >= MOCK_DATA_VERSION_4_4_2_1 && data_version < DATA_VERSION_4_5_0_0)
-        || data_version >= DATA_VERSION_4_6_1_0) {
-      const bool strong_routing = INVALID_SESSID != client_sessid_ ? need_strong_routing : true;
-      const bool flag = is_used && !strong_routing;
-      session.mark_session_temp_table_used(flag);
-    }
   }
   return ret;
 }
```

**File**: `src/sql/session/ob_basic_session_info.h` (modified, +1/-1)
```diff
@@ -1794,7 +1794,7 @@ class ObBasicSessionInfo
   int set_enable_role_ids(const ObIArray<uint64_t>& role_ids);
   int load_default_sys_variable(common::ObIAllocator &allocator, int64_t var_idx);
 
-  int set_session_temp_table_used(ObSQLSessionInfo &session, const bool is_used, const bool need_strong_routing);
+  int set_session_temp_table_used(const bool is_used);
   int get_session_temp_table_used(bool &is_used) const;
   int get_enable_optimizer_null_aware_antijoin(bool &is_enabled) const;
   void update_tenant_config_version(int64_t v) { cached_tenant_config_version_ = v; };
```

**File**: `src/sql/session/ob_sql_session_info.cpp` (modified, +1/-1)
```diff
@@ -1052,7 +1052,7 @@ int ObSQLSessionInfo::delete_from_oracle_temp_tables(const obrpc::ObDropTableArg
       gen_gtt_trans_scope_unique_id();
       update_trans_gtt_v2_sequence();
       if (gtt_session_scope_ids_.count() == 0) {
-        if (OB_FAIL(set_session_temp_table_used(*this, false, false))) {
+        if (OB_FAIL(set_session_temp_table_used(false))) {
           LOG_WARN("fail to set session temp table unused", K(ret));
         }
       }
```

**File**: `src/storage/tablet/ob_session_tablet_info_map.cpp` (modified, +6/-0)
```diff
@@ -266,6 +266,12 @@ int ObSessionTabletInfoMap::try_remove_session_tablet(
   return ret;
 }
 
+bool ObSessionTabletInfoMap::has_session_tablet()
+{
+  lib::ObMutexGuard guard(mutex_);
+  return !tablet_infos_.empty();
+}
+
 int ObSessionTabletInfoMap::try_remove_session_tablet(
     const uint64_t table_id,
     const common::ObTabletID &tablet_id,
```

---

### Incident Patch 12: `bfc0a06e` (2026-09-23)
**Commit Message**: Fix MySQL column default expression flags and failed NOT NULL rollback

**File**: `src/rootserver/ob_ddl_service.cpp` (modified, +54/-2)
```diff
@@ -11260,6 +11260,41 @@ int ObDDLService::modify_dep_obj_status_for_alter_table(
   return ret;
 }
 
+static int defer_column_default_for_not_null_validation(
+    const obrpc::ObAlterTableArg &alter_table_arg,
+    const ObColumnSchemaV2 &orig_column_schema,
+    ObColumnSchemaV2 &new_column_schema)
+{
+  int ret = OB_SUCCESS;
+  if (lib::is_mysql_mode()
+      && obrpc::ObAlterTableArg::ADD_CONSTRAINT == alter_table_arg.alter_constraint_type_
+      && !new_column_schema.is_generated_column()) {
+    const AlterTableSchema &alter_schema = alter_table_arg.alter_table_schema_;
+    bool defer_default = false;
+    for (ObTableSchema::const_constraint_iterator iter = alter_schema.constraint_begin();
+         OB_SUCC(ret) && !defer_default && iter != alter_schema.constraint_end(); ++iter) {
+      if (OB_ISNULL(*iter)) {
+        ret = OB_ERR_UNEXPECTED;
+        LOG_WARN("constraint is null", K(ret));
+      } else if (CONSTRAINT_TYPE_NOT_NULL == (*iter)->get_constraint_type()
+                 && (*iter)->get_need_validate_data()) {
+        if (OB_UNLIKELY(1 != (*iter)->get_column_cnt())) {
+          ret = OB_ERR_UNEXPECTED;
+          LOG_WARN("unexpected not null constraint column count", K(ret), KPC(*iter));
+        } else {
+          defer_default = OB_INVALID_ID != *(*iter)->cst_col_begin();
+        }
+      }
+    }
+    if (OB_SUCC(ret) && defer_default
+        && OB_FAIL(new_column_schema.set_cur_default_value(
+            orig_column_schema.get_cur_default_value(), orig_column_schema.is_default_expr_v2_column()))) {
+      LOG_WARN("failed to preserve default during not null validation", K(ret), K(orig_column_schema));
+    }
+  }
+  return ret;
+}
+
 // update relevant inner table if both ddl_operator and trans are not null
 int ObDDLService::alter_table_column(const ObTableSchema &origin_table_schema,
                                      const AlterTableSchema &alter_table_schema,
@@ -11422,6 +11457,9 @@ int ObDDLService::alter_table_column(const ObTableSchema &origin_table_schema,
                          ddl_operator, trans, schema_guard, global_idx_schema_array,
                          update_column_name_set, new_column_schema))) {
               LOG_WARN("prepare alter column failed", K(ret));
+            } else if (OB_FAIL(defer_column_default_for_not_null_validation(
+                         alter_table_arg, *orig_column_schema, new_column_schema))) {
+              LOG_WARN("failed to defer column default", K(ret));
             } else if (OB_FAIL(new_table_schema.alter_column(
                          new_column_schema, ObTableSchema::CHECK_MODE_ONLINE, for_view))) {
               LOG_WARN("failed to alter column", K(ret));
@@ -11544,6 +11582,9 @@ int ObDDLService::alter_table_column(const ObTableSchema &origin_table_schema,
                                                           nls_formats,
                                                           allocator))) {
                 RS_LOG(WARN, "fail to resolve timestamp column", K(ret));
+              } else if (OB_FAIL(defer_column_default_for_not_null_validation(
+                           alter_table_arg, *orig_column_schema, new_column_schema))) {
+                LOG_WARN("failed to defer column default", K(ret));
               } else if (OB_FAIL(new_table_schema.alter_column(new_column_schema,
                                  ObTableSchema::CHECK_MODE_ONLINE,
                                  for_view))) {
@@ -11659,7 +11700,10 @@ int ObDDLService::alter_table_column(const ObTableSchema &origin_table_schema,
                 }
               }
               if (OB_SUCC(ret)) {
-                if (OB_FAIL(new_table_schema.alter_column(new_column_schema,
+                if (OB_FAIL(defer_column_default_for_not_null_validation(
+                        alter_table_arg, *orig_column_schema, new_column_schema))) {
+                  LOG_WARN("failed to defer column default", K(ret));
+                } else if (OB_FAIL(new_table_schema.alter_column(new_column_schema,
                             ObTableSchema::CHECK_MODE_ONLINE,
                             for_view))) {
                   RS_LOG(WARN, "failed to change column", K(ret));
@@ -14611,8 +14655,16 @@ int ObDDLService::do_offline_ddl_in_trans(obrpc::ObAlterTableArg &alter_table_ar
         if (ObDDLType::DDL_TABLE_REDEFINITION == ddl_type
             || ObDDLType::DDL_MODIFY_COLUMN == ddl_type) {
           HEAP_VAR(AlterTableSchema, tmp_alter_table_schema) {
-            if (OB_FAIL(tmp_alter_table_schema.assign(alter_table_schema))) {
+            // ADD_CONSTRAINT consumes only constraints here. ALTER COLUMN carries
+            // a partial column definition which cannot be copied as a full schema.
+            if (obrpc::ObAlterTableArg::ADD_CONSTRAINT == alter_table_arg.alter_constraint_type_) {
+              if (OB_FAIL(tmp_alter_table_schema.assign_constraint(alter_table_schema))) {
+                LOG_WARN("failed to assign constraints",
```

**File**: `src/sql/resolver/ddl/ob_alter_table_resolver.cpp` (modified, +4/-0)
```diff
@@ -7201,6 +7201,8 @@ int ObAlterTableResolver::resolve_change_column(const ParseNode &node)
       //alter column的generated column flag应该自己解析，
       //所以需要清空掉自己以前拷贝的generated column flag
       alter_column_schema.erase_generated_column_flags();
+      // CHANGE replaces the MySQL default; resolve its expression flag from the new definition.
+      alter_column_schema.del_column_flag(DEFAULT_EXPR_V2_COLUMN_FLAG);
       alter_column_schema.drop_not_null_cst();
       alter_column_schema.set_tenant_id(origin_col_schema->get_tenant_id());
       alter_column_schema.set_table_id(origin_col_schema->get_table_id());
@@ -7514,6 +7516,8 @@ int ObAlterTableResolver::resolve_modify_column(const ParseNode &node,
           alter_column_schema.erase_generated_column_flags();
           alter_column_schema.erase_string_lob_flag();
           if (!is_oracle_mode()) {
+            // MySQL replaces the default, while Oracle inherits it when DEFAULT is omitted.
+            alter_column_schema.del_column_flag(DEFAULT_EXPR_V2_COLUMN_FLAG);
             alter_column_schema.drop_not_null_cst();
           }
           alter_table_stmt->set_sql_mode(session_info_->get_sql_mode());
```

---

### Incident Patch 13: `05b96978` (2026-09-23)
**Commit Message**: [OC] [#2024091100104434671] [master] cursor_loop_goto_oracle_pl_sqlqa.sql_loop_cursor_oracle

**File**: `src/sql/resolver/expr/ob_raw_expr_resolver_impl.cpp` (modified, +13/-1)
```diff
@@ -3780,6 +3780,7 @@ int ObRawExprResolverImpl::process_datatype_or_questionmark(const ParseNode &nod
             }
           } else {
             //prepare stmt不需要type，只需要计算?的个数
+            ObRawExpr *subprogram_var = NULL;
             if (OB_SUCC(ret) && nullptr != ctx_.secondary_namespace_) {
               const pl::ObPLSymbolTable* symbol_table = NULL;
               const pl::ObPLVar* var = NULL;
@@ -3803,8 +3804,18 @@ int ObRawExprResolverImpl::process_datatype_or_questionmark(const ParseNode &nod
                   }
                 }
               }
+              if (OB_SUCC(ret) && is_subprogram_var) {
+                // replace question mark with get_subprogram_var before call resolve_external_param_info
+                OZ (ObRawExprUtils::build_get_subprogram_var(ctx_.expr_factory_,
+                                                             cur_ns->get_package_id(),
+                                                             cur_ns->get_routine_id(),
+                                                             val.v_.unknown_,
+                                                             &c_expr->get_result_type(),
+                                                             subprogram_var,
+                                                             session_info));
+              }
             }
-            ObRawExpr *original_expr = c_expr;
+            ObRawExpr *original_expr = OB_ISNULL(subprogram_var) ? c_expr : subprogram_var;
             OZ (ObResolverUtils::resolve_external_param_info(*ctx_.external_param_info_,
                                                              *session_info,
                                                              ctx_.expr_factory_,
@@ -4060,6 +4071,7 @@ int ObRawExprResolverImpl::process_datatype_or_questionmark(const ParseNode &nod
             ExternalParamInfo param_info(expr, tmp, 1); // use sub_program_expr to replace param
             OX (ctx_.external_param_info_->params_.pop_back());
             OZ (ctx_.external_param_info_->push_back(param_info));
+            OX (expr = tmp);
           }
         }
       }
```

---

### Incident Patch 14: `bfbb673b` (2026-09-22)
**Commit Message**: fix: restrict upsert partition selection to the base table

**File**: `src/sql/engine/dml/ob_table_insert_up_op.cpp` (modified, +25/-11)
```diff
@@ -1019,7 +1019,7 @@ int ObTableInsertUpOp::calc_update_multi_tablet_id(const ObUpdCtDef &upd_ctdef,
   ObDatum *partition_id_datum = NULL;
   if (OB_FAIL(ObExprCalcPartitionBase::calc_part_and_tablet_id(&part_id_expr, eval_ctx_, partition_id, tablet_id))) {
     LOG_WARN("calc part and tablet id by expr failed", K(ret));
-  } else if (OB_FAIL(deal_hint_part_selection(partition_id))) {
+  } else if (OB_FAIL(deal_hint_part_selection(upd_ctdef, partition_id))) {
     LOG_WARN("Partition not match", K(ret));
   }
   return ret;
@@ -1080,16 +1080,30 @@ int ObTableInsertUpOp::calc_upd_new_row_tablet_loc(const ObUpdCtDef &upd_ctdef,
   return ret;
 }
 
-int ObTableInsertUpOp::deal_hint_part_selection(ObObjectID partition_id)
+int ObTableInsertUpOp::deal_hint_part_selection(const ObDMLBaseCtDef &dml_ctdef,
+                                                 ObObjectID partition_id)
 {
   int ret = OB_SUCCESS;
-  const ObInsertUpCtDef &insert_up_ctdef = *(MY_SPEC.insert_up_ctdefs_.at(0));
-  const ObInsCtDef *ins_ctdef = insert_up_ctdef.ins_ctdef_;
-  if (!ins_ctdef->multi_ctdef_->hint_part_ids_.empty()
-      && !has_exist_in_array(ins_ctdef->multi_ctdef_->hint_part_ids_, partition_id)) {
-    ret = OB_PARTITION_NOT_MATCH;
-    LOG_WARN("Partition not match", K(ret),
-              K(partition_id), K(ins_ctdef->multi_ctdef_->hint_part_ids_));
+  // Explicit partition selection only restricts the base table, not its global indexes.
+  if (dml_ctdef.is_primary_index_) {
+    const int64_t ctdef_count = MY_SPEC.insert_up_ctdefs_.count();
+    const ObInsertUpCtDef *insert_up_ctdef = nullptr;
+    const ObInsCtDef *ins_ctdef = nullptr;
+    const ObMultiInsCtDef *multi_ctdef = nullptr;
+
+    if (OB_UNLIKELY(ctdef_count <= 0)) {
+      ret = OB_ERR_UNEXPECTED;
+      LOG_WARN("invalid insert up ctdef count", K(ret), K(ctdef_count));
+    } else if (OB_ISNULL(insert_up_ctdef = MY_SPEC.insert_up_ctdefs_.at(0)) ||
+               OB_ISNULL(ins_ctdef = insert_up_ctdef->ins_ctdef_) ||
+               OB_ISNULL(multi_ctdef = ins_ctdef->multi_ctdef_)) {
+      ret = OB_ERR_UNEXPECTED;
+      LOG_WARN("unexpected null ctdef", K(ret), KP(insert_up_ctdef), KP(ins_ctdef), KP(multi_ctdef));
+    } else if (!multi_ctdef->hint_part_ids_.empty()
+               && !has_exist_in_array(multi_ctdef->hint_part_ids_, partition_id)) {
+      ret = OB_PARTITION_NOT_MATCH;
+      LOG_WARN("Partition not match", K(ret), K(partition_id), K(multi_ctdef->hint_part_ids_));
+    }
   }
   return ret;
 }
@@ -1107,7 +1121,7 @@ int ObTableInsertUpOp::calc_insert_tablet_loc(const ObInsCtDef &ins_ctdef,
       ObDASTableLoc &table_loc = *ins_rtdef.das_rtdef_.table_loc_;
       if (OB_FAIL(ObExprCalcPartitionBase::calc_part_and_tablet_id(calc_part_id_expr, eval_ctx_, partition_id, tablet_id))) {
         LOG_WARN("calc part and tablet id by expr failed", K(ret));
-      } else if (OB_FAIL(deal_hint_part_selection(partition_id))) {
+      } else if (OB_FAIL(deal_hint_part_selection(ins_ctdef, partition_id))) {
         LOG_WARN("Partition not match", K(ret));
       } else if (OB_FAIL(DAS_CTX(ctx_).extended_tablet_loc(table_loc, tablet_id, tablet_loc))) {
         LOG_WARN("extended tablet loc failed", K(ret));
@@ -1570,7 +1584,7 @@ int ObTableInsertUpOp::build_index_table_check_exist_task()
         LOG_WARN("calc_part_id_expr_ is null", K(ret));
       } else if (OB_FAIL(ObExprCalcPartitionBase::calc_part_and_tablet_id(part_id_expr, eval_ctx_, partition_id, tablet_id))) {
         LOG_WARN("fail to calc part id", K(ret), KPC(part_id_expr));
-      } else if (OB_FAIL(deal_hint_part_selection(partition_id))) {
+      } else if (OB_FAIL(deal_hint_part_selection(ins_ctdef, partition_id))) {
         LOG_WARN("partition not match", K(ret));
       } else if (OB_FAIL(ctx_.get_das_ctx().extended_tablet_loc(*das_index_scan_rtdef_->table_loc_, tablet_id, primary_tablet_loc))) {
         LOG_WARN("extended tablet loc failed", K(ret));
```

**File**: `src/sql/engine/dml/ob_table_insert_up_op.h` (modified, +1/-1)
```diff
@@ -225,7 +225,7 @@ class ObTableInsertUpOp : public ObTableModifyOp
 
   int init_insert_up_rtdef();
 
-  int deal_hint_part_selection(ObObjectID partition_id);
+  int deal_hint_part_selection(const ObDMLBaseCtDef &dml_ctdef, ObObjectID partition_id);
   virtual int check_need_exec_single_row() override;
   virtual ObDasParallelType check_das_parallel_type() override;
 
```

---

### Incident Patch 15: `2758dc22` (2026-09-22)
**Commit Message**: fix(storage): reduce lock scope for tablet rebuilds

**File**: `mittest/mtlenv/storage/test_ls_tablet_service.cpp` (modified, +57/-0)
```diff
@@ -272,6 +272,43 @@ TEST_F(TestLSTabletService, test_try_update_tablet_after_persist_stale_addr)
   ASSERT_EQ(OB_SUCCESS, t3m->del_tablet(key));
 }
 
+TEST_F(TestLSTabletService, test_update_medium_compaction_info_only_clears_matching_scn)
+{
+  const ObTabletID tablet_id(10000020);
+  const ObTabletMapKey key(ls_id_, tablet_id);
+  ObLSHandle ls_handle;
+  ObTableSchema schema;
+  TestSchemaUtils::prepare_data_schema(schema);
+  ASSERT_EQ(OB_SUCCESS, MTL(ObLSService*)->get_ls(ls_id_, ls_handle, ObLSGetMod::STORAGE_MOD));
+  ASSERT_EQ(OB_SUCCESS, TestTabletHelper::create_tablet(ls_handle, tablet_id, schema, allocator_));
+
+  ObTabletHandle tablet_handle;
+  ASSERT_EQ(OB_SUCCESS, ls_tablet_service_->get_tablet(tablet_id, tablet_handle));
+  const int64_t current_medium_scn = tablet_handle.get_obj()->get_last_major_snapshot_version();
+  const int64_t mismatched_medium_scn = current_medium_scn + 1;
+  ASSERT_GT(current_medium_scn, 0);
+  tablet_handle.get_obj()->tablet_meta_.extra_medium_info_.last_compaction_type_
+      = compaction::ObMediumCompactionInfo::MEDIUM_COMPACTION;
+  tablet_handle.get_obj()->tablet_meta_.extra_medium_info_.last_medium_scn_ = current_medium_scn;
+  tablet_handle.get_obj()->tablet_meta_.extra_medium_info_.wait_check_flag_ = true;
+
+  ObTabletHandle updated_handle;
+  ASSERT_EQ(OB_SUCCESS, ls_tablet_service_->update_medium_compaction_info(
+      tablet_id, mismatched_medium_scn, updated_handle));
+  ASSERT_TRUE(updated_handle.is_valid());
+  EXPECT_EQ(current_medium_scn, updated_handle.get_obj()->get_last_compaction_scn());
+  EXPECT_TRUE(updated_handle.get_obj()->tablet_meta_.extra_medium_info_.wait_check_flag_);
+
+  ObTabletHandle checked_handle;
+  ASSERT_EQ(OB_SUCCESS, ls_tablet_service_->update_medium_compaction_info(
+      tablet_id, current_medium_scn, checked_handle));
+  ASSERT_TRUE(checked_handle.is_valid());
+  EXPECT_EQ(current_medium_scn, checked_handle.get_obj()->get_last_compaction_scn());
+  EXPECT_FALSE(checked_handle.get_obj()->tablet_meta_.extra_medium_info_.wait_check_flag_);
+
+  ASSERT_EQ(OB_SUCCESS, MTL(ObTenantMetaMemMgr*)->del_tablet(key));
+}
+
 void TestLSTabletService::construct_sstable(
     const ObTabletID &tablet_id,
     blocksstable::ObSSTable &sstable,
@@ -1103,6 +1140,26 @@ TEST_F(TestLSTabletService, test_update_empty_shell)
   ASSERT_EQ(OB_SUCCESS, ret);
   ObTablet *empty_shell_tablet = tablet_handle.get_obj();
   ASSERT_TRUE(empty_shell_tablet->is_empty_shell());
+  const ObMetaDiskAddr old_addr = empty_shell_tablet->get_tablet_addr();
+  ASSERT_TRUE(old_addr.is_file());
+  tablet_handle.reset();
+
+  const ObTabletMapKey key(ls_id_, tablet_id);
+  ASSERT_EQ(OB_SUCCESS, ls_tablet_service_->refresh_empty_shell_for_slog_ckpt(
+      *MTL(ObTenantMetaMemMgr*), key, old_addr));
+  ASSERT_EQ(OB_SUCCESS, ls_tablet_service_->get_tablet(
+      tablet_id, tablet_handle, 0, ObMDSGetTabletMode::READ_WITHOUT_CHECK));
+  ASSERT_TRUE(tablet_handle.get_obj()->is_empty_shell());
+  const ObMetaDiskAddr refreshed_addr = tablet_handle.get_obj()->get_tablet_addr();
+  ASSERT_TRUE(refreshed_addr.is_file());
+  ASSERT_NE(old_addr, refreshed_addr);
+  tablet_handle.reset();
+
+  ASSERT_EQ(OB_SUCCESS, ls_tablet_service_->refresh_empty_shell_for_slog_ckpt(
+      *MTL(ObTenantMetaMemMgr*), key, old_addr));
+  ASSERT_EQ(OB_SUCCESS, ls_tablet_service_->get_tablet(
+      tablet_id, tablet_handle, 0, ObMDSGetTabletMode::READ_WITHOUT_CHECK));
+  ASSERT_EQ(refreshed_addr, tablet_handle.get_obj()->get_tablet_addr());
   tablet_handle.reset();
 
   ret = ls_tablet_service_->do_remove_tablet(ls_id_, tablet_id);
```

**File**: `src/storage/blocksstable/ob_shared_macro_block_manager.cpp` (modified, +1/-0)
```diff
@@ -498,6 +498,7 @@ int ObSharedMacroBlockMgr::defragment()
         if (OB_UNLIKELY(OB_EAGAIN != ret)) {
           LOG_WARN("fail to update tablet", K(ret), K(tablet_handle), K(macro_ids));
         } else {
+          ATOMIC_SET(&need_defragment_, true);
           ret = OB_SUCCESS;
         }
       }
```

**File**: `src/storage/compaction/ob_medium_compaction_func.cpp` (modified, +25/-7)
```diff
@@ -1509,10 +1509,14 @@ int ObMediumCompactionScheduleFunc::check_tablet_checksum(
 
 int ObMediumCompactionScheduleFunc::check_replica_checksum_items(
     const ObReplicaCkmArray &checksum_items,
-    const bool is_medium_checker)
+    const bool is_medium_checker,
+    const ObIArray<ObTabletCheckInfo> *check_infos)
 {
   int ret = OB_SUCCESS;
-  if (checksum_items.empty()) {
+  if (OB_UNLIKELY(is_medium_checker && OB_ISNULL(check_infos))) {
+    ret = OB_INVALID_ARGUMENT;
+    LOG_WARN("invalid argument", K(ret), K(is_medium_checker), KP(check_infos));
+  } else if (checksum_items.empty()) {
   } else  {
     int tmp_ret = OB_SUCCESS;
     int check_ret = OB_SUCCESS;
@@ -1539,16 +1543,29 @@ int ObMediumCompactionScheduleFunc::check_replica_checksum_items(
         if (is_medium_checker && OB_SUCCESS == check_ret) {
           ObLSHandle ls_handle;
           ObTabletHandle unused_handle;
-          if (OB_TMP_FAIL((MTL(storage::ObLSService *)->get_ls(ls_id, ls_handle, ObLSGetMod::COMPACT_MODE)))) {
+          int64_t check_medium_scn = 0;
+          // Checksum rows may already belong to a newer round, so use the checker work item's SCN as the clear token.
+          for (int64_t i = 0; i < check_infos->count(); ++i) {
+            const ObTabletCheckInfo &check_info = check_infos->at(i);
+            if (tablet_id == check_info.get_tablet_id() && ls_id == check_info.get_ls_id()) {
+              check_medium_scn = check_info.get_medium_scn();
+              break;
+            }
+          }
+          if (OB_UNLIKELY(check_medium_scn <= 0)) {
+            ret = OB_ERR_UNEXPECTED;
+            LOG_WARN("failed to find medium check info", K(ret), K(tablet_id), K(ls_id), KPC(check_infos));
+          } else if (OB_TMP_FAIL((MTL(storage::ObLSService *)->get_ls(ls_id, ls_handle, ObLSGetMod::COMPACT_MODE)))) {
             if (OB_LS_NOT_EXIST == tmp_ret) {
               LOG_TRACE("ls not exist", K(tmp_ret), K(ls_id));
             } else {
               LOG_WARN("failed to get ls", K(tmp_ret), K(ls_id));
             }
-          } else if (OB_TMP_FAIL(ls_handle.get_ls()->update_medium_compaction_info(tablet_id, unused_handle))) {
-            LOG_WARN("failed to update medium compaction info", K(tmp_ret), K(ls_id), K(tablet_id));
+          } else if (OB_TMP_FAIL(ls_handle.get_ls()->update_medium_compaction_info(
+              tablet_id, check_medium_scn, unused_handle))) {
+            LOG_WARN("failed to update medium compaction info", K(tmp_ret), K(ls_id), K(tablet_id), K(check_medium_scn));
           } else {
-            FLOG_INFO("finish check medium compaction info", K(tmp_ret), K(ls_id), K(tablet_id));
+            FLOG_INFO("finish check medium compaction info", K(tmp_ret), K(ls_id), K(tablet_id), K(check_medium_scn));
           }
         }
 
@@ -1605,7 +1622,8 @@ int ObMediumCompactionScheduleFunc::batch_check_medium_finish(
           MTL_ID(), finish_tablet_ls_infos, checksum_items))) {
         LOG_WARN("failed to get tablet checksum", K(ret));
       } else if (FALSE_IT(time_guard.click(ObCompactionScheduleTimeGuard::SEARCH_CHECKSUM))) {
-      } else if (OB_FAIL(check_replica_checksum_items(checksum_items, true /*is_medium_checker*/))) {
+      } else if (OB_FAIL(check_replica_checksum_items(
+          checksum_items, true /*is_medium_checker*/, &finish_tablet_ls_infos))) {
         LOG_WARN("fail to check replica checksum items for medium checker", K(ret));
       } else if (FALSE_IT(time_guard.click(ObCompactionScheduleTimeGuard::CHECK_CHECKSUM))) {
       }
```

**File**: `src/storage/compaction/ob_medium_compaction_func.h` (modified, +2/-1)
```diff
@@ -102,7 +102,8 @@ class ObMediumCompactionScheduleFunc
     ObCompactionTimeGuard &time_guard);
   static int check_replica_checksum_items(
       const ObReplicaCkmArray &checksum_items,
-      const bool is_medium_checker);
+      const bool is_medium_checker,
+      const ObIArray<ObTabletCheckInfo> *check_infos = nullptr);
   int schedule_next_medium_for_leader(
     const int64_t major_snapshot,
     bool &medium_clog_submitted);
```

**File**: `src/storage/ls/ob_ls_tablet_service.cpp` (modified, +222/-164)
```diff
@@ -899,13 +899,13 @@ int ObLSTabletService::update_tablet_table_store(
   } else {
     ObTablet *old_tablet = old_tablet_handle.get_obj();
     const common::ObTabletID &tablet_id = old_tablet->get_tablet_meta().tablet_id_;
+    const share::ObLSID &ls_id = ls_->get_ls_id();
+    const ObTabletMapKey key(ls_id, tablet_id);
     uint64_t data_version = 0;
     ObTimeGuard time_guard("ObLSTabletService::ReplaceSSTable", 1_s);
-    ObBucketHashWLockGuard lock_guard(bucket_lock_, tablet_id.hash());
-    time_guard.click("Lock");
-
     ObTabletHandle tablet_handle;
-    if (OB_FAIL(direct_get_tablet(tablet_id, tablet_handle))) {
+    ObMetaDiskAddr old_tablet_addr;
+    if (OB_FAIL(get_tablet_and_address(key, tablet_handle, old_tablet_addr, time_guard))) {
       if (OB_TABLET_NOT_EXIST == ret) {
         ret = OB_EAGAIN;
         LOG_WARN("this tablet has been deleted, skip it", K(ret), K(tablet_id));
@@ -923,14 +923,12 @@ int ObLSTabletService::update_tablet_table_store(
       time_guard.click("GetTablet");
       ObTabletHandle tmp_tablet_hdl;
       ObTablet *tmp_tablet = nullptr;
-      const share::ObLSID &ls_id = ls_->get_ls_id();
-      const ObTabletMapKey key(ls_id, tablet_id);
       ObMetaDiskAddr disk_addr;
       int32_t private_transfer_epoch = -1;
       int64_t tablet_meta_version = 0;
       if (OB_FAIL(old_tablet->get_private_transfer_epoch(private_transfer_epoch))) {
         LOG_WARN("failed to get private transfer epoch", K(ret), "old_tablet_meta", old_tablet->get_tablet_meta());
-      } else if (OB_FAIL(alloc_private_tablet_meta_version_without_lock(key, tablet_meta_version))) {
+      } else if (OB_FAIL(alloc_private_tablet_meta_version_with_lock(key, tablet_meta_version))) {
         LOG_WARN("failed to alloc tablet meta version", K(ret), K(key));
       }
       const ObTabletPersisterParam param(data_version,
@@ -948,7 +946,11 @@ int ObLSTabletService::update_tablet_table_store(
       } else if (OB_FAIL(ObTabletPersister::persist_and_transform_tablet(param, *tmp_tablet, new_tablet_hdl))) {
         LOG_WARN("fail to persist and transform tablet", K(ret), KPC(tmp_tablet), K(new_tablet_hdl));
       } else if (FALSE_IT(disk_addr = new_tablet_hdl.get_obj()->tablet_addr_)) {
-      } else if (OB_FAIL(safe_update_cas_tablet(key, disk_addr, old_tablet_handle, new_tablet_hdl, time_guard))) {
+      } else if (OB_FAIL(try_update_tablet_after_persist(
+          key, old_tablet_addr, tablet_handle, new_tablet_hdl, time_guard))) {
+        if (OB_TABLET_NOT_EXIST == ret) {
+          ret = OB_EAGAIN;
+        }
         LOG_WARN("fail to update tablet", K(ret), K(key), K(disk_addr));
       } else {
         LOG_INFO("succeeded to build new tablet", K(ret), K(disk_addr),
@@ -1022,7 +1024,7 @@ int ObLSTabletService::update_tablet_table_store(
         int64_t tablet_meta_version = 0;
         if (OB_FAIL(old_tablet->get_private_transfer_epoch(private_transfer_epoch))) {
           LOG_WARN("failed to get private transfer epoch", K(ret), "old_tablet_meta", old_tablet->get_tablet_meta());
-        } else if (OB_FAIL(alloc_private_tablet_meta_version_without_lock(key, tablet_meta_version))) {
+        } else if (OB_FAIL(alloc_private_tablet_meta_version_with_lock(key, tablet_meta_version))) {
           LOG_WARN("failed to alloc tablet meta version", K(ret), K(key));
         }
         const ObTabletPersisterParam persist_param(data_version,
@@ -1152,7 +1154,9 @@ int ObLSTabletService::try_update_tablet_after_persist(
     ObBucketHashWLockGuard lock_guard(bucket_lock_, key.tablet_id_.hash());
     CLICK();
     time_guard.click("WLock");
-    if (CLICK_FAIL(t3m->get_tablet_addr(key, cur_tablet_addr))) {
+    if (OB_FAIL(lock_guard.get_ret())) {
+      LOG_WARN("failed to lock tablet", K(ret), K(key));
+    } else if (CLICK_FAIL(t3m->get_tablet_addr(key, cur_tablet_addr))) {
       if (OB_ENTRY_NOT_EXIST == ret) {
         ret = OB_TABLET_NOT_EXIST;
       }
@@ -1245,71 +1249,83 @@ int ObLSTabletService::update_tablet_to_empty_shell(
 
 int ObLSTabletService::update_medium_compaction_info(
     const common::ObTabletID &tablet_id,
+    const int64_t check_medium_scn,
     ObTabletHandle &handle)
 {
   int ret = OB_SUCCESS;
   common::ObArenaAllocator allocator(common::ObMemAttr(MTL_ID(), "UpMeidumCom"));
-  uint64_t data_version = 0;
-  ObTabletHandle old_tablet_handle;
   ObTimeGuard time_guard("ObLSTabletService::update_medium_compaction_info", 1_s);
-  ObBucketHashWLockGuard lock_guard(bucket_lock_, tablet_id.hash());
-  time_guard.click("Lock");
 
   if (IS_NOT_INIT) {
     ret = OB_NOT_INIT;
     LOG_WARN("not inited", K(ret), K_(is_inited));
-  } else if (OB_UNLIKELY(!tablet_id.is_valid())) {
+  } else if (OB_UNLIKELY(!tablet_id.is_valid() || check_medium_scn <= 0)) {
     ret = OB_INVALID_ARGUMENT;
-    LOG_WARN("invalid args", K(ret), K(tablet_id));
-  } else if (OB_FAIL(direct_get_tablet(tablet_id, old_tablet_handle))) {
-    LOG_WARN("failed to check and get tablet", K(ret), K(table
```

**File**: `src/storage/ls/ob_ls_tablet_service.h` (modified, +1/-0)
```diff
@@ -216,6 +216,7 @@ class ObLSTabletService : public logservice::ObIReplaySubHandler,
       ObTabletHandle &handle);
   int update_medium_compaction_info(
       const common::ObTabletID &tablet_id,
+      const int64_t check_medium_scn,
       ObTabletHandle &handle);
   int update_tablet_table_store( // only for small sstables defragmentation
       const ObTabletHandle &old_tablet_handle,
```

**File**: `src/storage/tablet/ob_tablet.cpp` (modified, +20/-4)
```diff
@@ -2026,8 +2026,16 @@ int ObTablet::init_with_update_medium_info(
       || OB_ISNULL(log_handler_)) {
     ret = OB_ERR_UNEXPECTED;
     LOG_WARN("tablet pointer handle is invalid", K(ret), K_(pointer_hdl), K_(pointer_hdl), K_(log_handler));
-  } else if (OB_FAIL(assign_memtables(old_tablet.memtables_, old_tablet.memtable_count_))) {
-    LOG_WARN("fail to assign memtables", K(ret));
+  } else {
+    common::SpinRLockGuard guard(old_tablet.memtables_lock_);
+    if (OB_FAIL(guard.get_ret())) {
+      LOG_WARN("fail to lock memtables", K(ret), "tablet_id", old_tablet.get_tablet_id());
+    } else if (OB_FAIL(assign_memtables(old_tablet.memtables_, old_tablet.memtable_count_))) {
+      LOG_WARN("fail to assign memtables", K(ret));
+    }
+  }
+
+  if (OB_FAIL(ret)) {
   } else if (OB_ISNULL(ddl_kvs_ = static_cast<ObDDLKV **>(allocator.alloc(sizeof(ObDDLKV *) * DDL_KV_ARRAY_SIZE)))) {
     ret = OB_ALLOCATE_MEMORY_FAILED;
     LOG_WARN("failed to allocate memory for ddl_kvs_", K(ret), KP(ddl_kvs_));
@@ -2184,8 +2192,16 @@ int ObTablet::init_with_replace_members(
     ret = OB_ERR_UNEXPECTED;
     LOG_WARN("old tablet min ss tablet version is bigger than ss change version, unexpected",
         K(ret), K(old_tablet), K(ss_change_version));
-  } else if (OB_FAIL(assign_memtables(old_tablet.memtables_, old_tablet.memtable_count_))) {
-    LOG_WARN("fail to assign memtables", K(ret));
+  } else {
+    common::SpinRLockGuard guard(old_tablet.memtables_lock_);
+    if (OB_FAIL(guard.get_ret())) {
+      LOG_WARN("fail to lock memtables", K(ret), "tablet_id", old_tablet.get_tablet_id());
+    } else if (OB_FAIL(assign_memtables(old_tablet.memtables_, old_tablet.memtable_count_))) {
+      LOG_WARN("fail to assign memtables", K(ret));
+    }
+  }
+
+  if (OB_FAIL(ret)) {
   } else if (OB_ISNULL(ddl_kvs_ = static_cast<ObDDLKV **>(allocator.alloc(sizeof(ObDDLKV *) * DDL_KV_ARRAY_SIZE)))) {
     ret = OB_ALLOCATE_MEMORY_FAILED;
     LOG_WARN("failed to allocate memory for ddl_kvs_", K(ret), KP(ddl_kvs_));
```

#### Recent Merged Pull Requests:
- **PR #2398** (closed): [Docs] Fix question issue template metadata (@Wenjun7J)
- **PR #2389** (closed): oceanbase ci (@guoyan1996)
- **PR #2388** (closed): Dev oceanbase ci (@guoyan1996)
- **PR #2379** (closed): fix: use KP() for binary buffer pointers in PALF log statements (@crawfordxx)
- **PR #2378** (closed): fix: correct typo 'initilize' to 'initialize' in ob_spi.cpp (@crawfordxx)
- **PR #2364** (2026-01-04): docs: fix typos and rename file - Coding Convensions to Conventions, … (@weiii668)
- **PR #2357** (closed): docs: fix typos in development guide - Convensions to Conventions, Ba… (@weiii668)
- **PR #2356** (2025-12-31): docs: fix typos and improve contributing guidelines (@weiii668)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

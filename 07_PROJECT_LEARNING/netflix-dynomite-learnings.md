# Forensic Learning Record (Deep Inspection): Netflix/dynomite

> **Canonical Artifact**: `07_PROJECT_LEARNING/netflix-dynomite-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Netflix/dynomite](https://github.com/Netflix/dynomite))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:20:42.061Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Netflix/dynomite`
- **Description**: A generic dynamo implementation for different k-v storage engines
- **Primary Language / Ecosystem**: C
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 4215 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/dyn_core.c`
```
/*
 * Dynomite - A thin, distributed replication layer for multi non-distributed
 * storages. Copyright (C) 2014 Netflix, Inc.
 */

/*
 * twemproxy - A fast and lightweight proxy for memcached protocol.
 * Copyright (C) 2011 Twitter, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

#include <stdlib.h>
#include <unistd.h>

#include "dyn_conf.h"
#include "dyn_core.h"
#include "dyn_dnode_peer.h"
#include "dyn_dnode_proxy.h"
#include "dyn_gossip.h"
#include "dyn_proxy.h"
#include "dyn_server.h"
#include "dyn_task.h"
#include "event/dyn_event.h"

uint32_t admin_opt = 0;

static void core_print_peer_status(void *arg1) {
  struct context *ctx = arg1;
  struct server_pool *sp = &ctx->pool;
  // iterate over all peers
  uint32_t dc_cnt = array_n(&sp->datacenters);
  uint32_t dc_index;
  for (dc_index = 0; dc_index < dc_cnt; dc_index++) {
    struct datacenter *dc = array_get(&sp->datacenters, dc_index);
    if (!dc) log_panic("DC is null. Topology not inited proerly");
    uint8_t rack_cnt = (uint8_t)array_n(&dc->racks);
    uint8_t rack_index;
    for (rack_index = 0; rack_index < rack_cnt; rack_index++) {
      struct rack *rack = array_get(&dc->racks, rack_index);
      uint8_t i = 0;
      for (i = 0; i < rack->ncontinuum; i++) {
        struct continuum *c = (struct continuum*) array_get(&rack->continuums, i);
        ASSERT(c != NULL);
        uint32_t peer_index = c->index;
        struct node *peer = *(struct node **)array_get(&sp->peers, peer_index);
        if (!peer) log_panic("peer is null. Topology not inited proerly");

        log_notice("%u)%p %.*s %.*s %.*s %s", peer_index, peer, dc->name->len,
                   dc->name->data, rack->name->len, rack->name->data,
                   peer->endpoint.pname.len, peer->endpoint.pname.data,
                   get_state(peer->state));
      }
    }
  }
}

void core_set_local_state(struct context *ctx, dyn_state_t state) {
  struct server_pool *sp = &ctx->pool;
  struct node *peer = *(struct node **)array_get(&sp->peers, 0);
  ctx->dyn_state = state;
  peer->state = state;
}

static rstatus_t core_init_last(struct context *ctx) {
  core_debug(ctx);
  preselect_remote_rack_for_replication(ctx);
  // Print the network health once after 30 secs
  schedule_task_1(core_print_peer_status, ctx, 30000);
  return DN_OK;
}

static rstatus_t core_gossip_pool_init(struct context *ctx) {
  // init ring msg queue
  CBUF_Init(C2G_InQ);
  CBUF_Init(C2G_OutQ);

  THROW_STATUS(gossip_pool_init(ctx));
  return DN_OK;
}

static rstatus_t core_dnode_peer_pool_preconnect(struct context *ctx) {
  rstatus_t status = dnode_peer_pool_preconnect(ctx);
  IGNORE_RET_VAL(status);
  return status;
}

static rstatus_t core_dnode_peer_init(struct context *ctx) {
  /* initialize peers */
  THROW_STATUS(dnode_initialize_peers(ctx));
  return DN_OK;
}

static rstatus_t core_dnode_proxy_init(struct context *ctx) {
  /* initialize dnode listener per server pool */
  THROW_STATUS(dnode_proxy_init(ctx));

  ctx->dyn_state = JOINING;  // TODOS: change this to JOINING
  return DN_OK;
}

static rstatus_t core_proxy_init(struct context *ctx) {
  /* initialize proxy per server pool */
  THROW_STATUS(proxy_init(ctx));
  return DN_OK;
}

static rstatus_t core_server_pool_preconnect(struct context *ctx) {
  rstatus_t status = server_pool_preconnect(ctx);
  IGNORE_RET_VAL(status);

  return DN_OK;
}

static rstatus_t core_event_base_create(struct context *ctx) {
  /* initialize event handling for client, proxy and server */
  ctx->evb = event_base_create(EVENT_SIZE, &core_core);
  if (ctx->evb == NULL) {
    log_error("Failed to create socket event handling!!!");
    return DN_ERROR;
  }
  return DN_OK;
}

/**
 *
 * NOTE: DEPRECATED and not currently used in the codebase.
 *
 * Initialize anti-entropy.
 * @param[in,out] ctx Context.
 * @return rstatus_t Return status code.
 */
static rstatus_t core_entropy_init(struct context *ctx) {
  struct instance *nci = ctx->instance;
  /* initializing anti-entropy */
  ctx->entropy = entropy_init(ctx, nci->entropy_port, nci->entropy_addr);
  if (ctx->entropy == NULL) {
    log_error("Failed to create entropy!!!");
  }

  return DN_OK;
}

/**
 * Create the Dynomite server performance statistics and assign it to the
 * context, plus initialize anti-entropy.
 * @param[in,out] ctx Context.
 * @return rstatus_t Return status code.
 */
static rstatus_t core_stats_create(struct context *ctx) {
  struct instance *nci = ctx->instance;
  struct server_pool *sp = &ctx->pool;

  ctx->stats = stats_create(sp->stats_endpoint.port, sp->stats_endpoint.pname,
                            sp->stats_interval, nci->hostname, &ctx->pool, ctx);
  if (ctx->stats == NULL) {
    log_error("Failed to create stats!!!");
    return DN_ERROR;
  }

  return DN_OK;
}

/**
 * Initialize crypto and create the Dynomite server performance statistics.
 * @param[in,out] ctx Dynomite server context.
 * @return rstatus_t Return status code.
 */
static rstatus_t core_crypto_init(struct context *ctx) {
  /* crypto init */
  THROW_STATUS(crypto_init(&ctx->pool));
  return DN_OK;
}

/**
 * Initialize the server pool.
 * @param[in,out] ctx Context.
 * @return rstatus_t Return status code.
 */
static rstatus_t core_server_pool_init(struct context *ctx) {
  THROW_STATUS(server_pool_init(&ctx->pool, &ctx->cf->pool, ctx));
  return DN_OK;
}

/**
 * Create a context for the dynomite process.
 * @param[in,out] nci Dynomite instance.
 * @return rstatus_t Return status code.
 */
static rstatus_t core_ctx_create(struct instance *nci) {
  struct context *ctx;

  srand((unsigned)time(NULL));

  ctx = dn_alloc(sizeof(*ctx));
  if (ctx == NULL) {
    loga("Failed to create context!!!");
    return DN_ERROR;
  }

  nci->ctx = ctx;
  ctx->instance = nci;
  ctx->cf = NULL;
  ctx->stats = NULL;
  ctx->evb = NULL;
  ctx->dyn_state = INIT;
  ctx->admin_opt = admin_opt;

  /* parse and create configuration */
  ctx->cf = conf_create(nci->conf_filename);
  if (ctx->cf == NULL) {
    loga("Failed to create conf!!!");
    dn_free(ctx);
    return DN_ERROR;
  }

  struct conf_pool *cp = &ctx->cf->pool;
  ctx->max_timeout = cp->stats_interval;
  ctx->timeout = ctx->max_timeout;

  return DN_OK;
}

static void core_ctx_destroy(struct context *ctx) {
  proxy_deinit(ctx);
  server_pool_disconnect(ctx);
  event_base_destroy(ctx->evb);
  stats_destroy(ctx->stats);
  server_pool_deinit(&ctx->pool);
  conf_destroy(ctx->cf);
  dn_free(ctx);
}

/**
 * Initialize memory buffers, message queue, and connections.
 * @param[in] nci Dynomite instance.
 * @return rstatus_t Return status code.
 */
rstatus_t core_start(struct instance *nci) {
  conn_init();
  task_mgr_init();

  rstatus_t status = core_ctx_create(nci);
  if (status != DN_OK) {
    goto error;
  }

  struct context *ctx = nci->ctx;
  ASSERT(ctx != NULL);

  status = core_server_pool_init(ctx);
  if (status != DN_OK) {
    goto error;
  }

  status = core_crypto_init(ctx);
  if (status != DN_OK) {
    goto error;
  }

  status = core_stats_create(ctx);
  if (status != DN_OK) {
    goto error;
  }

  status = core_event_base_create(ctx);
  if (status != DN_OK) {
    goto error;
  }

  status = core_server_pool_preconnect(ctx);
  if (status != DN_OK) {
    goto error;
  }

  status = core_proxy_init(ctx);
  if (status != DN_OK) {
    goto error;
  }

  status = core_dnode_proxy_init(ctx);
  if (status != DN_OK) {
    goto error;
  }

  status = core_dnode_peer_init(ctx);
  if (status != DN_OK) {
    goto error;
  }

  status = core_dnode_peer_pool_preconnect(ctx);
  if (status != DN_OK) {
    goto error;
  }

  status = core_init_last(ctx);
  if (status != DN_OK) {
    goto error;
  }
  // XXX: Gossip is currently not maintained actively, so ignore any failures.
  IGNORE_RET_VAL(core_gossip_pool_init(ctx));

  // Set the repairs flag.
  g_read_repairs_enabled = ctx->cf->pool.read_repairs_enabled;

  /**
   * Providing mbuf_size and alloc_msgs through the command line
   * has been deprecated. For backward compatibility
   * we support both ways here: One through nci (command line)
   * and one through the YAML file (server_pool).
   */
  struct server_pool *sp = &ctx->pool;

  if (sp->mbuf_size == UNSET_NUM) {
    loga("mbuf_size not in YAML: using deprecated way  %d",
         nci->mbuf_chunk_size);
    mbuf_init(nci->mbuf_chunk_size);
  } else {
    loga("YAML provided mbuf_size: %d", sp->mbuf_size);
    mbuf_init(sp->mbuf_size);
  }
  if (sp->alloc_msgs_max == UNSET_NUM) {
    loga("max_msgs not in YAML: using deprecated way %d", nci->alloc_msgs_max);
    msg_init(nci->alloc_msgs_max);
  } else {
    loga("YAML provided max_msgs: %d", sp->alloc_msgs_max);
    msg_init(sp->alloc_msgs_max);
  }

  return DN_OK;

error:
  // If we hit an error, undo everything in the reverse order as it was setup to maintain
  // symmetric setup/teardown semantics.
  if (ctx != NULL) {
    //gossip_pool_deinit(ctx);   // XXX: Gossip not actively maintained.
    dnode_peer_pool_disconnect(ctx);
    dnode_peer_deinit(&ctx->pool.peers);
    dnode_proxy_deinit(ctx);
    proxy_deinit(ctx);
    server_pool_disconnect(ctx);
    if (ctx->evb) event_base_destroy(ctx->evb);
    if (ctx->entropy) entropy_conn_destroy(ctx->entropy);
    if (ctx->stats) stats_destroy(ctx->stats);
    crypto_deinit();
    server_pool_deinit(&ctx->pool);
    if (ctx->cf) conf_destroy(ctx->cf);
    dn_free(ctx);
  }
  conn_deinit();
  return status;
}

char *print_server_pool(const struct object *obj) {
  ASSERT(obj->type == OBJ_POOL);

```

### Core Architecture Module: `src/dyn_core.h`
```
/*
 * Dynomite - A thin, distributed replication layer for multi non-distributed
 * storages. Copyright (C) 2014 Netflix, Inc.
 */

/*
 * twemproxy - A fast and lightweight proxy for memcached protocol.
 * Copyright (C) 2011 Twitter, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

#ifndef _DYN_CORE_H_
#define _DYN_CORE_H_

#include "dyn_array.h"
#include "dyn_cbuf.h"
#include "dyn_connection.h"
#include "dyn_connection_pool.h"
#include "dyn_crypto.h"
#include "dyn_dict.h"
#include "dyn_log.h"
#include "dyn_mbuf.h"
#include "dyn_message.h"
#include "dyn_queue.h"
#include "dyn_rbtree.h"
#include "dyn_ring_queue.h"
#include "dyn_setting.h"
#include "dyn_stats.h"
#include "dyn_string.h"
#include "dyn_types.h"
#include "dyn_util.h"
#include "hashkit/dyn_hashkit.h"

#include "entropy/dyn_entropy.h"

#define ENCRYPTION 1

typedef enum dyn_state {
  INIT = 0,
  STANDBY = 1,
  WRITES_ONLY = 2,
  RESUMING = 3,
  NORMAL = 4,
  // SUSPENDING  = 5,
  // LEAVING     = 6,
  JOINING = 7,
  DOWN = 8,
  // REMOVED     = 9,
  // EXITING     = 10,
  RESET = 11,
  UNKNOWN = 12
} dyn_state_t;

static inline char *get_state(dyn_state_t s) {
  switch (s) {
    case INIT:
      return "INIT";
    case STANDBY:
      return "STANDBY";
    case WRITES_ONLY:
      return "WRITES_ONLY";
    case RESUMING:
      return "RESUMING";
    case NORMAL:
      return "NORMAL";
    // case SUSPENDING: return "SUSPENDING";
    // case LEAVING: return "LEAVING";
    case JOINING:
      return "JOINING";
    case DOWN:
      return "DOWN";
    // case REMOVED: return "REMOVED";
    // case EXITING: return "EXITING";
    case RESET:
      return "RESET";
    case UNKNOWN:
      return "Unknown";
  }
  return "INVALID STATE";
}

// Read repairs are only enabled if either of the quorum options
// are enabled.
bool is_read_repairs_enabled(void);

typedef enum data_store {
  DATA_REDIS = 0,   /* Data store is Redis */
  DATA_MEMCACHE = 1 /* Data store is Memcache */
} data_store_t;

extern data_store_t g_data_store;
extern uint32_t admin_opt;

/** \struct instance
 * @brief An instance of the Dynomite server.
 *
 * Dynomite server properties including log level, log file, conf file,
 * statistics port and collection interval, statistics address, hostname, pid,
 * pid file and various other properties.
 */
struct instance {
  struct context *ctx;              /* active context */
  int log_level;                    /* log level */
  char *log_filename;               /* log filename */
  char *conf_filename;              /* configuration filename */
  char hostname[DN_MAXHOSTNAMELEN]; /* hostname */
  uint16_t entropy_port;            /* send reconciliation port */
  char *entropy_addr;               /* send reconciliation addr */
  size_t mbuf_chunk_size;           /* mbuf chunk size */
  size_t alloc_msgs_max;            /* allocated messages buffer size */
  pid_t pid;                        /* process id */
  char *pid_filename;               /* pid filename */
  unsigned pidfile : 1;             /* pid file created? */
};

struct continuum {
  uint32_t index;          /* dyn_peer index */
  uint32_t value;          /* hash value, used ONLY by ketama */
  struct dyn_token *token; /* used in vnode/dyn_token situations */
};

struct rack {
  struct string *name;
  struct string *dc;
  uint32_t ncontinuum; /* # continuum points */
  uint32_t
      nserver_continuum; /* # servers - live and dead on continuum (const) */
  struct array continuums;
};

struct datacenter {
  struct string *name; /* datacenter name */
  struct array racks;  /* list of racks in a datacenter */
  struct rack *preselected_rack_for_replication;
  dict *dict_rack;
};

struct endpoint {
  struct string pname;   /* name:port:weight (ref in conf_server) */
  uint16_t port;         /* port */
  int family;            /* socket family */
  socklen_t addrlen;     /* socket length */
  struct sockaddr *addr; /* socket address (ref in conf_server) */
};

struct datastore {
  struct object obj;
  uint32_t idx;              /* server index */
  struct server_pool *owner; /* owner pool */
  struct endpoint endpoint;
  struct string name; /* name (ref in conf_server) */

  conn_pool_t *conn_pool;
  uint8_t max_connections;

  msec_t next_retry_ms;   /* next retry time in msec */
  uint32_t failure_count; /* # consecutive failures */
};

/** \struct node
 * @brief Dynomite server node.
 */
struct node {
  struct object obj;
  uint32_t idx;              /* server index */
  struct server_pool *owner; /* owner pool */
  struct endpoint endpoint;
  struct string name; /* name (ref in conf_server) */

  conn_pool_t *conn_pool; /* the only peer connection */

  msec_t next_retry_ms;   /* next retry time in msec */
  uint32_t failure_count; /* # consecutive failures */

  struct string rack;     /* logical rack */
  struct string dc;       /* server's dc */
  struct array tokens;    /* DHT tokens this peer owns */
  bool is_local;          /* is this peer the current running node?  */
  bool is_same_dc;        /* is this peer the current running node?  */
  unsigned processed : 1; /* flag to indicate whether this has been processed */
  unsigned is_secure : 1; /* is the connection to the server secure? */
  dyn_state_t state;      /* state of the server - used mainly in peers  */
};

/** \struct server_pool
 * @brief Server pool.
 *
 * Server configuration including proxy connection, client connections, data
 * center and rack information, plus hash information such as distribution type
 * and hash type. Contains limits including client and server connection limits.
 * Contains cluster information such as seeds and seed provider, plus node
 * information such as dc, rack, node token and runtime environment.
 */
struct server_pool {
  object_t object;
  struct context *ctx;         /* owner context */
  struct conf_pool *conf_pool; /* back reference to conf_pool */

  struct conn *p_conn;          /* proxy connection (listener) */
  struct conn_tqh c_conn_q;     /* client connection q */
  struct conn_tqh ready_conn_q; /* ready connection q */

  struct datastore *datastore; /* underlying datastore */
  struct array datacenters;    /* racks info  */
  uint64_t next_rebuild;       /* next distribution rebuild time in usec */

  struct string name; /* pool name (ref in conf_pool) */
  struct endpoint proxy_endpoint;
  int key_hash_type;              /* key hash type (hash_type_t) */
  hash_func_t key_hash;           /* key hasher */
  struct string hash_tag;         /* key hash tag (ref in conf_pool) */
  msec_t timeout;                 /* timeout in msec */
  int backlog;                    /* listen backlog */
  uint32_t client_connections;    /* maximum # client connection */
  msec_t server_retry_timeout_ms; /* server retry timeout in msec */
  uint8_t server_failure_limit;   /* server failure limit */
  unsigned auto_eject_hosts : 1;  /* auto_eject_hosts? */
  unsigned preconnect : 1;        /* preconnect? */

  /* dynomite */
  struct string seed_provider;
  struct array peers;
  struct conn *d_conn; /* dnode connection (listener) */
  struct endpoint dnode_proxy_endpoint;
  int d_timeout;            /* peer timeout in msec */
  int d_backlog;            /* listen backlog */
  int64_t d_retry_timeout;  /* peer retry timeout in usec */
  uint32_t d_failure_limit; /* peer failure limit */
  uint8_t max_local_peer_connections;
  uint8_t max_remote_peer_connections;
  struct string rack;  /* the rack for this node */
  struct array tokens; /* the DHT tokens for this server */

  msec_t g_interval; /* gossip interval */
  struct string dc;  /* server's dc */
  struct string env; /* aws, network, etc */
  /* none | datacenter | rack | all in order of increasing number of
   * connections. (default is datacenter) */
  secure_server_option_t secure_server_option;
  struct string pem_key_file;
  struct string recon_key_file; /* file with Key encryption in reconciliation */
  struct string
      recon_iv_file; /* file with Initialization Vector encryption in
                        reconciliation */
  struct endpoint stats_endpoint; /* stats_listen: socket info for stats */
  msec_t stats_interval;          /* stats aggregation interval */
  bool enable_gossip;             /* enable/disable gossip */
  size_t mbuf_size;               /* mbuf chunk size */
  size_t alloc_msgs_max;          /* allocated messages buffer size */
};

/** \struct context
 * @brief Context of the Dynomite process.
 *
 * Context of the Dynomite process including it's configuration including
 * dynomite itself plus statistics, entropy, the server pool (i.e. connections),
 * the event base, timeout, dynomite state, gossip and whether or not the admin
 * functionality is enabled/disabled.
 */
struct context {
  struct instance *instance; /* back pointer to instance */
  struct conf *cf;           /* configuration */
  struct stats *stats;       /* stats */
  struct entropy *entropy;   /* reconciliation connection */
  struct server_pool pool;   /* server_pool[] */
  struct event_base *evb;    /* event base */
  msec_t max_timeout;        /* max timeout in msec */
  msec_t timeout;            /* timeout in msec */
  dyn_state_t dyn_state;     /* state of the node.  Don't need volatile as
                                it is ok to eventually get its new value */
  uint32_t admin_opt;        /* admin mode */
};

rstatus_t core_start(struct instance *nci);
void core_stop(struct context *ctx);
rstatus_t core_core(void *arg, uint32_t 
```

### Core Architecture Module: `src/dyn_queue.h`
```
/*
 * Dynomite - A thin, distributed replication layer for multi non-distributed
 * storages. Copyright (C) 2014 Netflix, Inc.
 */

/*
 * twemproxy - A fast and lightweight proxy for memcached protocol.
 * Copyright (C) 2011 Twitter, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/*
 * Copyright (c) 1991, 1993
 *    The Regents of the University of California.  All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions
 * are met:
 * 1. Redistributions of source code must retain the above copyright
 *    notice, this list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright
 *    notice, this list of conditions and the following disclaimer in the
 *    documentation and/or other materials provided with the distribution.
 * 4. Neither the name of the University nor the names of its contributors
 *    may be used to endorse or promote products derived from this software
 *    without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE REGENTS AND CONTRIBUTORS ``AS IS'' AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
 * ARE DISCLAIMED.  IN NO EVENT SHALL THE REGENTS OR CONTRIBUTORS BE LIABLE
 * FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
 * DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS
 * OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION)
 * HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT
 * LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY
 * OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF
 * SUCH DAMAGE.
 *
 *    @(#)queue.h    8.5 (Berkeley) 8/20/94
 * $FreeBSD: src/sys/sys/queue.h,v 1.73 2010/02/20 01:05:30 emaste Exp $
 */

#ifndef _DYN_QUEUE_H_
#define _DYN_QUEUE_H_

#include <stdint.h>
#include "dyn_log.h"
#include "dyn_types.h"

#ifndef __offsetof
#define __offsetof(type, field) ((size_t)(&((type *)NULL)->field))
#endif

/*
 * This file defines five types of data structures: singly-linked lists,
 * singly-linked tail queues, lists, tail queues, and circular queues.
 *
 * A singly-linked list is headed by a single forward pointer. The elements
 * are singly linked for minimum space and pointer manipulation overhead at
 * the expense of O(n) removal for arbitrary elements. New elements can be
 * added to the list after an existing element or at the head of the list.
 * Elements being removed from the head of the list should use the explicit
 * macro for this purpose for optimum efficiency. A singly-linked list may
 * only be traversed in the forward direction.  Singly-linked lists are ideal
 * for applications with large datasets and few or no removals or for
 * implementing a LIFO queue.
 *
 * A singly-linked tail queue is headed by a pair of pointers, one to the
 * head of the list and the other to the tail of the list. The elements are
 * singly linked for minimum space and pointer manipulation overhead at the
 * expense of O(n) removal for arbitrary elements. New elements can be added
 * to the list after an existing element, at the head of the list, or at the
 * end of the list. Elements being removed from the head of the tail queue
 * should use the explicit macro for this purpose for optimum efficiency.
 * A singly-linked tail queue may only be traversed in the forward direction.
 * Singly-linked tail queues are ideal for applications with large datasets
 * and few or no removals or for implementing a FIFO queue.
 *
 * A list is headed by a single forward pointer (or an array of forward
 * pointers for a hash table header). The elements are doubly linked
 * so that an arbitrary element can be removed without a need to
 * traverse the list. New elements can be added to the list before
 * or after an existing element or at the head of the list. A list
 * may only be traversed in the forward direction.
 *
 * A tail queue is headed by a pair of pointers, one to the head of the
 * list and the other to the tail of the list. The elements are doubly
 * linked so that an arbitrary element can be removed without a need to
 * traverse the list. New elements can be added to the list before or
 * after an existing element, at the head of the list, or at the end of
 * the list. A tail queue may be traversed in either direction.
 *
 * A circle queue is headed by a pair of pointers, one to the head of the
 * list and the other to the tail of the list. The elements are doubly
 * linked so that an arbitrary element can be removed without a need to
 * traverse the list. New elements can be added to the list before or after
 * an existing element, at the head of the list, or at the end of the list.
 * A circle queue may be traversed in either direction, but has a more
 * complex end of list detection.
 *
 * For details on the use of these macros, see the queue(3) manual page.
 *
 *
 *                      SLIST   LIST    STAILQ  TAILQ   CIRCLEQ
 * _HEAD                +       +       +       +       +
 * _HEAD_INITIALIZER    +       +       +       +       +
 * _ENTRY               +       +       +       +       +
 * _INIT                +       +       +       +       +
 * _EMPTY               +       +       +       +       +
 * _FIRST               +       +       +       +       +
 * _NEXT                +       +       +       +       +
 * _PREV                -       -       -       +       +
 * _LAST                -       -       +       +       +
 * _FOREACH             +       +       +       +       +
 * _FOREACH_REVERSE     -       -       -       +       +
 * _INSERT_HEAD         +       +       +       +       +
 * _INSERT_BEFORE       -       +       -       +       +
 * _INSERT_AFTER        +       +       +       +       +
 * _INSERT_TAIL         -       -       +       +       +
 * _REMOVE_HEAD         +       -       +       -       -
 * _REMOVE              +       +       +       +       +
 *
 */

#define QUEUE_MACRO_SCRUB 1

#ifdef DN_ASSERT_PANIC
#define QUEUE_MACRO_TRACE 1
#define QUEUE_MACRO_ASSERT 1
#endif

#ifdef QUEUE_MACRO_SCRUB

#define QMD_SAVELINK(name, link) void **name = (void *)&(link)

#define TRASHIT(x)      \
  do {                  \
    (x) = (void *)NULL; \
  } while (0)

#else

#define QMD_SAVELINK(name, link)
#define TRASHIT(x)

#endif /* QUEUE_MACRO_SCRUB */

#ifdef QUEUE_MACRO_TRACE

/* Store the last 2 places the queue element or head was altered */
struct qm_trace {
  char *lastfile;
  int lastline;
  char *prevfile;
  int prevline;
};

#define TRACEBUF struct qm_trace trace;

#define QMD_TRACE_HEAD(head)                         \
  do {                                               \
    (head)->trace.prevline = (head)->trace.lastline; \
    (head)->trace.prevfile = (head)->trace.lastfile; \
    (head)->trace.lastline = __LINE__;               \
    (head)->trace.lastfile = __FILE__;               \
  } while (0)

#define QMD_TRACE_ELEM(elem)                         \
  do {                                               \
    (elem)->trace.prevline = (elem)->trace.lastline; \
    (elem)->trace.prevfile = (elem)->trace.lastfile; \
    (elem)->trace.lastline = __LINE__;               \
    (elem)->trace.lastfile = __FILE__;               \
  } while (0)

#else

#define QMD_TRACE_ELEM(elem)
#define QMD_TRACE_HEAD(head)
#define TRACEBUF

#endif /* QUEUE_MACRO_TRACE */

/*
 * Singly-linked List declarations.
 */
#define SLIST_HEAD(name, type)                  \
  struct name {                                 \
    struct type *slh_first; /* first element */ \
  }

#define SLIST_HEAD_INITIALIZER(head) \
  { NULL }

#define SLIST_ENTRY(type)                     \
  struct {                                    \
    struct type *sle_next; /* next element */ \
  }

/*
 * Singly-linked List functions.
 */
#define SLIST_EMPTY(head) ((head)->slh_first == NULL)

#define SLIST_FIRST(head) ((head)->slh_first)

#define SLIST_FOREACH(var, head, field) \
  for ((var) = SLIST_FIRST((head)); (var); (var) = SLIST_NEXT((var), field))

#define SLIST_FOREACH_SAFE(var, head, field, tvar) \
  for ((var) = SLIST_FIRST((head));                \
       (var) && ((tvar) = SLIST_NEXT((var), field), 1); (var) = (tvar))

#define SLIST_FOREACH_PREVPTR(var, varp, head, field)            \
  for ((varp) = &SLIST_FIRST((head)); ((var) = *(varp)) != NULL; \
       (varp) = &SLIST_NEXT((var), field))

#define SLIST_INIT(head)        \
  do {                          \
    SLIST_FIRST((head)) = NULL; \
  } while (0)

#define SLIST_INSERT_AFTER(slistelm, elm, field)              \
  do {                                                        \
    SLIST_NEXT((elm), field) = SLIST_NEXT((slistelm), field); \
    SLIST_NEXT((slistelm), field) = (elm);                    \
  } while (0)

#define SLIST_INSERT_HEAD(head, elm, field)         \
  do {                                              \
    SLIST_NEXT((elm), field) = SLIST_FIRST((head)); \
    SLIST_FIRST((head)) = (elm);                    \
  } while (0)

#define SLIST_NEXT(elm, field) ((elm)->field.sle_next)

#define SLIST_REMOVE(head, elm, type, field)       \
  do {                                             \
    if (SLIST_FIRST((head)) == (elm)) {            \
      SLIST_REMOVE_HEAD((head), field);      
```

### Core Architecture Module: `src/dyn_ring_queue.c`
```
/*
 * dyn_ring_queue.c
 *
 *  Created on: May 31, 2014
 *      Author: mdo
 */

#include "dyn_ring_queue.h"
#include "dyn_array.h"
#include "dyn_core.h"
#include "dyn_gossip.h"
#include "dyn_token.h"

// should use pooling to store struct ring_message so that we can reuse
struct ring_msg *create_ring_msg(void) {
  struct ring_msg *msg = dn_alloc(sizeof(*msg));

  if (msg == NULL) return NULL;

  ring_msg_init(msg, 1, true);
  msg->data = NULL;

  return msg;
}

struct ring_msg *create_ring_msg_with_data(uint32_t capacity) {
  struct ring_msg *msg = dn_alloc(sizeof(*msg));

  if (msg == NULL) return NULL;

  rstatus_t status = ring_msg_init(msg, 1, true);
  if (status != DN_OK) {
    dn_free(msg);
    return NULL;
  }

  msg->data = dn_zalloc(sizeof(uint8_t) * capacity);
  msg->capacity = capacity;
  msg->len = 0;

  return msg;
}

struct ring_msg *create_ring_msg_with_size(uint32_t size, bool init_node) {
  struct ring_msg *msg = dn_alloc(sizeof(*msg));

  if (msg == NULL) return NULL;

  rstatus_t status = ring_msg_init(msg, size, init_node);
  if (status != DN_OK) {
    dn_free(msg);
    return NULL;
  }

  msg->data = NULL;
  msg->capacity = 0;
  msg->len = 0;

  return msg;
}

rstatus_t ring_msg_init(struct ring_msg *msg, uint32_t n, bool init_node) {
  if (msg == NULL) return DN_ERROR;

  rstatus_t status = array_init(&msg->nodes, n, sizeof(struct gossip_node));
  if (status != DN_OK) return status;

  if (init_node) {
    uint32_t i;
    for (i = 0; i < n; i++) {
      struct gossip_node *node = array_push(&msg->nodes);
      node_init(node);
    }
  }

  return DN_OK;
}

rstatus_t ring_msg_deinit(struct ring_msg *msg) {
  if (msg == NULL) return DN_ERROR;

  uint32_t i;
  for (i = 0; i < array_n(&msg->nodes); i++) {
    struct gossip_node *node = array_get(&msg->nodes, i);
    node_deinit(node);
  }
  array_deinit(&msg->nodes);

  if (msg->data != NULL) {
    dn_free(msg->data);
  }

  dn_free(msg);

  return DN_OK;
}

struct gossip_node *create_node() {
  struct gossip_node *result = dn_alloc(sizeof(*result));
  node_init(result);

  return result;
}

rstatus_t node_init(struct gossip_node *node) {
  if (node == NULL) return DN_ERROR;

  init_dyn_token(&node->token);
  string_init(&node->dc);
  string_init(&node->rack);
  string_init(&node->name);
  string_init(&node->pname);

  node->port = 8101;

  node->is_local = false;
  node->state = INIT;

  return DN_OK;
}

rstatus_t node_deinit(struct gossip_node *node) {
  if (node == NULL) return DN_ERROR;

  // array_deinit(&node->tokens);
  string_deinit(&node->dc);
  string_deinit(&node->rack);
  string_deinit(&node->name);
  string_deinit(&node->pname);
  deinit_dyn_token(&node->token);

  // dn_free(node);

  return DN_OK;
}

rstatus_t node_copy(const struct gossip_node *src, struct gossip_node *dst) {
  if (src == NULL || dst == NULL) return DN_ERROR;

  dst->state = src->state;
  dst->is_local = src->is_local;
  dst->port = src->port;
  dst->is_secure = src->is_secure;

  string_copy(&dst->pname, src->pname.data, src->pname.len);
  string_copy(&dst->name, src->name.data, src->name.len);
  string_copy(&dst->rack, src->rack.data, src->rack.len);
  string_copy(&dst->dc, src->dc.data, src->dc.len);

  copy_dyn_token(&src->token, &dst->token);
  return DN_OK;
}

```

### Core Architecture Module: `src/dyn_ring_queue.h`
```
/*
 * Dynomite - A thin, distributed replication layer for multi non-distributed
 * storages. Copyright (C) 2014 Netflix, Inc.
 */

#include "dyn_gossip.h"

#ifndef _DYN_RING_QUEUE_
#define _DYN_RING_QUEUE_

#define C2G_InQ_SIZE 256
#define C2G_OutQ_SIZE 256

struct gossip_node;

typedef rstatus_t (*callback_t)(void *msg);
typedef void (*data_func_t)(void *);

volatile struct {
  long m_getIdx;
  long m_putIdx;
  void *m_entry[C2G_InQ_SIZE];
} C2G_InQ;

volatile struct {
  long m_getIdx;
  long m_putIdx;
  void *m_entry[C2G_OutQ_SIZE];
} C2G_OutQ;

struct ring_msg {
  callback_t cb;
  uint8_t *data;     /* place holder for a msg */
  uint32_t capacity; /* max capacity */
  uint32_t len;      /* # of useful bytes in data (len =< capacity) */
  struct array nodes;
  struct server_pool *sp;
};

struct ring_msg *create_ring_msg(void);
struct ring_msg *create_ring_msg_with_data(uint32_t capacity);
struct ring_msg *create_ring_msg_with_size(uint32_t size, bool init_node);
rstatus_t ring_msg_init(struct ring_msg *msg, uint32_t size, bool init_node);
rstatus_t ring_msg_deinit(struct ring_msg *msg);

struct gossip_node *create_node(void);
rstatus_t node_init(struct gossip_node *node);
rstatus_t node_deinit(struct gossip_node *node);
rstatus_t node_copy(const struct gossip_node *src, struct gossip_node *dst);

#endif

```

### Core Architecture Module: `src/dyn_util.c`
```
/*
 * Dynomite - A thin, distributed replication layer for multi non-distributed
 * storages. Copyright (C) 2014 Netflix, Inc.
 */

/*
 * twemproxy - A fast and lightweight proxy for memcached protocol.
 * Copyright (C) 2011 Twitter, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

#include <fcntl.h>
#include <netdb.h>
#include <stdarg.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

#include <sys/ioctl.h>
#include <sys/socket.h>
#include <sys/time.h>
#include <sys/types.h>

#include <netinet/in.h>
#include <netinet/tcp.h>

#include "dyn_core.h"

#ifdef DN_HAVE_BACKTRACE
#include <execinfo.h>
#endif

int dn_set_blocking(int sd) {
  int flags;

  flags = fcntl(sd, F_GETFL, 0);
  if (flags < 0) {
    return flags;
  }

  return fcntl(sd, F_SETFL, flags & ~O_NONBLOCK);
}

int dn_set_nonblocking(int sd) {
  int flags;

  flags = fcntl(sd, F_GETFL, 0);
  if (flags < 0) {
    return flags;
  }

  return fcntl(sd, F_SETFL, flags | O_NONBLOCK);
}

int dn_set_reuseaddr(int sd) {
  int reuse;
  socklen_t len;

  reuse = 1;
  len = sizeof(reuse);

  return setsockopt(sd, SOL_SOCKET, SO_REUSEADDR, &reuse, len);
}

int dn_set_keepalive(int sd, int val) {
  return setsockopt(sd, SOL_SOCKET, SO_KEEPALIVE, &val, sizeof(val));
}

/*
 * Disable Nagle algorithm on TCP socket.
 *
 * This option helps to minimize transmit latency by disabling coalescing
 * of data to fill up a TCP segment inside the kernel. Sockets with this
 * option must use readv() or writev() to do data transfer in bulk and
 * hence avoid the overhead of small packets.
 */
int dn_set_tcpnodelay(int sd) {
  int nodelay;
  socklen_t len;

  nodelay = 1;
  len = sizeof(nodelay);

  return setsockopt(sd, IPPROTO_TCP, TCP_NODELAY, &nodelay, len);
}

int dn_set_linger(int sd, int timeout) {
  struct linger linger;
  socklen_t len;

  linger.l_onoff = 1;
  linger.l_linger = timeout;

  len = sizeof(linger);

  return setsockopt(sd, SOL_SOCKET, SO_LINGER, &linger, len);
}

int dn_set_sndbuf(int sd, int size) {
  socklen_t len;

  len = sizeof(size);

  return setsockopt(sd, SOL_SOCKET, SO_SNDBUF, &size, len);
}

int dn_set_rcvbuf(int sd, int size) {
  socklen_t len;

  len = sizeof(size);

  return setsockopt(sd, SOL_SOCKET, SO_RCVBUF, &size, len);
}

int dn_get_soerror(int sd) {
  int status, err;
  socklen_t len;

  err = 0;
  len = sizeof(err);

  status = getsockopt(sd, SOL_SOCKET, SO_ERROR, &err, &len);
  if (status == 0) {
    errno = err;
  }

  return status;
}

int dn_get_sndbuf(int sd) {
  int status, size;
  socklen_t len;

  size = 0;
  len = sizeof(size);

  status = getsockopt(sd, SOL_SOCKET, SO_SNDBUF, &size, &len);
  if (status < 0) {
    return status;
  }

  return size;
}

int dn_get_rcvbuf(int sd) {
  int status, size;
  socklen_t len;

  size = 0;
  len = sizeof(size);

  status = getsockopt(sd, SOL_SOCKET, SO_RCVBUF, &size, &len);
  if (status < 0) {
    return status;
  }

  return size;
}

int _dn_atoi(uint8_t *line, size_t n) {
  int value;

  if (n == 0) {
    return -1;
  }

  for (value = 0; n--; line++) {
    if (*line < '0' || *line > '9') {
      return -1;
    }

    value = value * 10 + (*line - '0');
  }

  if (value < 0) {
    return -1;
  }

  return value;
}

uint32_t _dn_atoui(uint8_t *line, size_t n) {
  uint32_t value;

  if (n == 0) {
    return 0;
  }

  for (value = 0; n--; line++) {
    if (*line < '0' || *line > '9') {
      return 0;
    }

    value = value * 10 + (uint32_t)(*line - '0');
  }

  return value;
}

bool dn_valid_port(int n) {
  if (n < 1 || n > UINT16_MAX) {
    return false;
  }

  return true;
}

void *_dn_alloc(size_t size, const char *name, int line) {
  void *p;

  ASSERT(size != 0);

  p = malloc(size);
  if (p == NULL) {
    log_error("malloc(%zu) failed @ %s:%d", size, name, line);
  } else {
    log_debug(LOG_VVERB, "malloc(%zu) at %p @ %s:%d", size, p, name, line);
  }

  return p;
}

void *_dn_zalloc(size_t size, const char *name, int line) {
  void *p;

  p = _dn_alloc(size, name, line);
  if (p != NULL) {
    memset(p, 0, size);
  }

  return p;
}

void *_dn_calloc(size_t nmemb, size_t size, const char *name, int line) {
  return _dn_zalloc(nmemb * size, name, line);
}

void *_dn_realloc(void *ptr, size_t size, const char *name, int line) {
  void *p;

  ASSERT(size != 0);

  p = realloc(ptr, size);
  if (p == NULL) {
    log_error("realloc(%zu) failed @ %s:%d", size, name, line);
  } else {
    log_debug(LOG_VVERB, "realloc(%zu) at %p @ %s:%d", size, p, name, line);
  }

  return p;
}

void _dn_free(void *ptr, const char *name, int line) {
  ASSERT(ptr != NULL);
  log_debug(LOG_VVERB, "free(%p) @ %s:%d", ptr, name, line);
  free(ptr);
}

void dn_stacktrace(int skip_count) {
#ifdef DN_HAVE_BACKTRACE
  void *stack[64];
  char **symbols;
  int size, i, j;

  size = backtrace(stack, 64);
  symbols = backtrace_symbols(stack, size);
  if (symbols == NULL) {
    return;
  }

  skip_count++; /* skip the current frame also */

  for (i = skip_count, j = 0; i < size; i++, j++) {
    loga("[%d] %s", j, symbols[i]);

    char syscom[256];
    snprintf(syscom, sizeof(syscom), "addr2line %p -e /proc/%d/exe >&2",
             stack[i], getpid());
    if (system(syscom) < 0) {
      loga("system command did not succeed to print filename");
    }
  }

  free(symbols);
#endif
}

void dn_assert(const char *cond, const char *file, int line, int panic) {
  log_error("assert '%s' failed @ (%s, %d)", cond, file, line);
  if (panic) {
    dn_stacktrace(1);
    abort();
  }
}

int _vscnprintf(char *buf, size_t size, const char *fmt, va_list args) {
  int n;

  n = vsnprintf(buf, size, fmt, args);

  /*
   * The return value is the number of characters which would be written
   * into buf not including the trailing '\0'. If size is == 0 the
   * function returns 0.
   *
   * On error, the function also returns 0. This is to allow idiom such
   * as len += _vscnprintf(...)
   *
   * See: http://lwn.net/Articles/69419/
   */
  if (n <= 0) {
    return 0;
  }

  if (n < (int)size) {
    return n;
  }

  return (int)(size - 1);
}

int _scnprintf(char *buf, size_t size, const char *fmt, ...) {
  va_list args;
  int n;

  va_start(args, fmt);
  n = _vscnprintf(buf, size, fmt, args);
  va_end(args);

  return n;
}

/*
 * Send n bytes on a blocking descriptor
 */
ssize_t _dn_sendn(int sd, const void *vptr, size_t n) {
  size_t nleft;
  ssize_t nsend;
  const char *ptr;

  ptr = vptr;
  nleft = n;
  while (nleft > 0) {
    nsend = send(sd, ptr, nleft, 0);
    if (nsend < 0) {
      if (errno == EINTR) {
        continue;
      }
      return nsend;
    }
    if (nsend == 0) {
      return -1;
    }

    nleft -= (size_t)nsend;
    ptr += nsend;
  }

  return (ssize_t)n;
}

/*
 * Recv n bytes from a blocking descriptor
 */
ssize_t _dn_recvn(int sd, void *vptr, size_t n) {
  size_t nleft;
  ssize_t nrecv;
  char *ptr;

  ptr = vptr;
  nleft = n;
  while (nleft > 0) {
    nrecv = recv(sd, ptr, nleft, 0);
    if (nrecv < 0) {
      if (errno == EINTR) {
        continue;
      }
      return nrecv;
    }
    if (nrecv == 0) {
      break;
    }

    nleft -= (size_t)nrecv;
    ptr += nrecv;
  }

  return (ssize_t)(n - nleft);
}

/*
 * Return the current time in microseconds since Epoch
 */
usec_t dn_usec_now(void) {
  struct timeval now;
  uint64_t usec;
  int status;

  status = gettimeofday(&now, NULL);
  if (status < 0) {
    log_error("gettimeofday failed: %s", strerror(errno));
    return 0;
  }

  usec = (uint64_t)now.tv_sec * 1000000ULL + (uint64_t)now.tv_usec;

  return usec;
}

/*
 * Return the current time in milliseconds since Epoch
 */
msec_t dn_msec_now(void) { return dn_usec_now() / 1000ULL; }

static int dn_resolve_inet(struct string *name, int port, struct sockinfo *si) {
  int status;
  struct addrinfo *ai, *cai; /* head and current addrinfo */
  struct addrinfo hints;
  char *node, service[DN_UINTMAX_MAXLEN];
  bool found;

  ASSERT(dn_valid_port(port));

  memset(&hints, 0, sizeof(hints));
  hints.ai_flags = AI_NUMERICSERV;
  hints.ai_family = AF_UNSPEC; /* AF_INET or AF_INET6 */
  hints.ai_socktype = SOCK_STREAM;
  hints.ai_protocol = 0;
  hints.ai_addrlen = 0;
  hints.ai_addr = NULL;
  hints.ai_canonname = NULL;

  if (name != NULL) {
    node = (char *)name->data;
  } else {
    /*
     * If AI_PASSIVE flag is specified in hints.ai_flags, and node is
     * NULL, then the returned socket addresses will be suitable for
     * bind(2)ing a socket that will accept(2) connections. The returned
     * socket address will contain the wildcard IP address.
     */
    node = NULL;
    hints.ai_flags |= AI_PASSIVE;
  }

  dn_snprintf(service, DN_UINTMAX_MAXLEN, "%d", port);

  status = getaddrinfo(node, service, &hints, &ai);
  if (status < 0) {
    log_error("address resolution of node '%s' service '%s' failed: %s", node,
              service, gai_strerror(status));
    return -1;
  }

  /*
   * getaddrinfo() can return a linked list of more than one addrinfo,
   * since we requested for both AF_INET and AF_INET6 addresses and the
   * host itself can be multi-homed. Since we don't care whether we are
   * using ipv4 or ipv6, we just use the first address from this collection
   * in the order in which it was returned.
   *
   * The sorting function used within getaddrinfo() is defined in RFC 3484;
   * the order can be tweaked for a particular system by editing
   * /etc/gai.conf
   */
  for (cai = ai, found = false; cai != NULL; cai = cai->ai_next) {
    si->family = cai->ai_f
```

### Core Architecture Module: `src/dyn_util.h`
```
/*
 * Dynomite - A thin, distributed replication layer for multi non-distributed
 * storages. Copyright (C) 2014 Netflix, Inc.
 */

/*
 * twemproxy - A fast and lightweight proxy for memcached protocol.
 * Copyright (C) 2011 Twitter, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

#ifndef _DYN_UTIL_H_
#define _DYN_UTIL_H_

#include <netinet/in.h>
#include <stdarg.h>
#include <stdbool.h>
#include <sys/un.h>
#include <unistd.h>

#define LF (uint8_t)10
#define CR (uint8_t)13
#define CRLF "\x0d\x0a"
#define CRLF_LEN (sizeof("\x0d\x0a") - 1)

#define NELEMS(a) ((sizeof(a)) / sizeof((a)[0]))

#define MIN(a, b) ((a) < (b) ? (a) : (b))
#define MAX(a, b) ((a) > (b) ? (a) : (b))

#define SQUARE(d) ((d) * (d))
#define VAR(s, s2, n) (((n) < 2) ? 0.0 : ((s2)-SQUARE(s) / (n)) / ((n)-1))
#define STDDEV(s, s2, n) (((n) < 2) ? 0.0 : sqrt(VAR((s), (s2), (n))))

#define DN_INET4_ADDRSTRLEN (sizeof("255.255.255.255") - 1)
#define DN_INET6_ADDRSTRLEN \
  (sizeof("ffff:ffff:ffff:ffff:ffff:ffff:255.255.255.255") - 1)
#define DN_INET_ADDRSTRLEN MAX(DN_INET4_ADDRSTRLEN, DN_INET6_ADDRSTRLEN)
#define DN_UNIX_ADDRSTRLEN \
  (sizeof(struct sockaddr_un) - offsetof(struct sockaddr_un, sun_path))

#define DN_MAXHOSTNAMELEN 256

/*
 * Length of 1 byte, 2 bytes, 4 bytes, 8 bytes and largest integral
 * type (uintmax_t) in ascii, including the null terminator '\0'
 *
 * From stdint.h, we have:
 * # define UINT8_MAX	(255)
 * # define UINT16_MAX	(65535)
 * # define UINT32_MAX	(4294967295U)
 * # define UINT64_MAX	(__UINT64_C(18446744073709551615))
 */
#define DN_UINT8_MAXLEN (3 + 1)
#define DN_UINT16_MAXLEN (5 + 1)
#define DN_UINT32_MAXLEN (10 + 1)
#define DN_UINT64_MAXLEN (20 + 1)
#define DN_UINTMAX_MAXLEN DN_UINT64_MAXLEN

/*
 * Make data 'd' or pointer 'p', n-byte aligned, where n is a power of 2
 * of 2.
 */
#define DN_ALIGNMENT sizeof(unsigned long) /* platform word */
#define DN_ALIGN(d, n) (((d) + (n - 1)) & ~(n - 1))
#define DN_ALIGN_PTR(p, n) \
  (void *)(((uintptr_t)(p) + ((uintptr_t)n - 1)) & ~((uintptr_t)n - 1))

/*
 * Wrapper to workaround well known, safe, implicit type conversion when
 * invoking system calls.
 */
#define dn_gethostname(_name, _len) gethostname((char *)_name, (size_t)_len)

#define dn_atoi(_line, _n) _dn_atoi((uint8_t *)_line, (size_t)_n)
#define dn_atoui(_line, _n) _dn_atoui((uint8_t *)_line, (size_t)_n)

// Forward declarations.
struct keypos;
struct argpos;

int dn_set_blocking(int sd);
int dn_set_nonblocking(int sd);
int dn_set_reuseaddr(int sd);
int dn_set_keepalive(int sd, int val);
int dn_set_tcpnodelay(int sd);
int dn_set_linger(int sd, int timeout);
int dn_set_sndbuf(int sd, int size);
int dn_set_rcvbuf(int sd, int size);
int dn_get_soerror(int sd);
int dn_get_sndbuf(int sd);
int dn_get_rcvbuf(int sd);

int _dn_atoi(uint8_t *line, size_t n);
uint32_t _dn_atoui(uint8_t *line, size_t n);
bool dn_valid_port(int n);

/*
 * Memory allocation and free wrappers.
 *
 * These wrappers enables us to loosely detect double free, dangling
 * pointer access and zero-byte alloc.
 */
#define dn_alloc(_s) _dn_alloc((size_t)(_s), __FILE__, __LINE__)

#define dn_zalloc(_s) _dn_zalloc((size_t)(_s), __FILE__, __LINE__)

#define dn_calloc(_n, _s) \
  _dn_calloc((size_t)(_n), (size_t)(_s), __FILE__, __LINE__)

#define dn_realloc(_p, _s) _dn_realloc(_p, (size_t)(_s), __FILE__, __LINE__)

#define dn_free(_p)                   \
  do {                                \
    _dn_free(_p, __FILE__, __LINE__); \
    (_p) = NULL;                      \
  } while (0)

void *_dn_alloc(size_t size, const char *name, int line);
void *_dn_zalloc(size_t size, const char *name, int line);
void *_dn_calloc(size_t nmemb, size_t size, const char *name, int line);
void *_dn_realloc(void *ptr, size_t size, const char *name, int line);
void _dn_free(void *ptr, const char *name, int line);

/*
 * Wrappers to send or receive n byte message on a blocking
 * socket descriptor.
 */
#define dn_sendn(_s, _b, _n) _dn_sendn(_s, _b, (size_t)(_n))

#define dn_recvn(_s, _b, _n) _dn_recvn(_s, _b, (size_t)(_n))

/*
 * Wrappers to read or write data to/from (multiple) buffers
 * to a file or socket descriptor.
 */
#define dn_read(_d, _b, _n) read(_d, _b, (size_t)(_n))

#define dn_readv(_d, _b, _n) readv(_d, _b, (int)(_n))

#define dn_write(_d, _b, _n) write(_d, _b, (size_t)(_n))

#define dn_writev(_d, _b, _n) writev(_d, _b, (int)(_n))

ssize_t _dn_sendn(int sd, const void *vptr, size_t n);
ssize_t _dn_recvn(int sd, void *vptr, size_t n);

/*
 * Wrappers for defining custom assert based on whether macro
 * DN_ASSERT_PANIC or DN_ASSERT_LOG was defined at the moment
 * ASSERT was called.
 */

// http://www.pixelbeat.org/programming/gcc/static_assert.html
#define ASSERT_CONCAT_(a, b) a##b
#define ASSERT_CONCAT(a, b) ASSERT_CONCAT_(a, b)
#ifdef __COUNTER__
#define STATIC_ASSERT(e, m) \
  ;                         \
  enum { ASSERT_CONCAT(static_assert_, __COUNTER__) = 1 / (!!(e)) }
#else
/* This can't be used twice on the same line so ensure if using in headers
 * that the headers are not included twice (by wrapping in #ifndef...#endif)
 * Note it doesn't cause an issue when used on same line of separate modules
 * compiled with gcc -combine -fwhole-program.  */
#define STATIC_ASSERT(e, m) \
  ;                         \
  enum { ASSERT_CONCAT(assert_line_, __LINE__) = 1 / (!!(e)) }
#endif

#ifdef DN_ASSERT_PANIC

#define ASSERT(_x)                           \
  do {                                       \
    if (!(_x)) {                             \
      dn_assert(#_x, __FILE__, __LINE__, 1); \
    }                                        \
  } while (0)

#define ASSERT_LOG(_x, _M, ...)                         \
  do {                                                  \
    if (!(_x)) {                                        \
      log_error("Assertion Failed: "_M, ##__VA_ARGS__); \
      dn_assert(#_x, __FILE__, __LINE__, 1);            \
    }                                                   \
  } while (0)

#define NOT_REACHED() ASSERT(0)

#elif DN_ASSERT_LOG

#define ASSERT(_x)                           \
  do {                                       \
    if (!(_x)) {                             \
      dn_assert(#_x, __FILE__, __LINE__, 0); \
    }                                        \
  } while (0)

#define ASSERT_LOG(_x, _M, ...)                         \
  do {                                                  \
    if (!(_x)) {                                        \
      log_error("ASSERTION FAILED: "_M, ##__VA_ARGS__); \
      dn_assert(#_x, __FILE__, __LINE__, 0);            \
    }                                                   \
  } while (0)

#define NOT_REACHED() ASSERT(0)

#else

#define ASSERT(_x)
#define ASSERT_LOG(_x, _M, ...)

#define NOT_REACHED()

#endif

#ifdef DN_LITTLE_ENDIAN

#define str4cmp(m, c0, c1, c2, c3) \
  (*(uint32_t *)m == ((c3 << 24) | (c2 << 16) | (c1 << 8) | c0))

#define str5cmp(m, c0, c1, c2, c3, c4) \
  (str4cmp(m, c0, c1, c2, c3) && (m[4] == c4))

#define str6cmp(m, c0, c1, c2, c3, c4, c5) \
  (str4cmp(m, c0, c1, c2, c3) &&           \
   (((uint32_t *)m)[1] & 0xffff) == ((c5 << 8) | c4))

#define str7cmp(m, c0, c1, c2, c3, c4, c5, c6) \
  (str6cmp(m, c0, c1, c2, c3, c4, c5) && (m[6] == c6))

#define str8cmp(m, c0, c1, c2, c3, c4, c5, c6, c7) \
  (str4cmp(m, c0, c1, c2, c3) &&                   \
   (((uint32_t *)m)[1] == ((c7 << 24) | (c6 << 16) | (c5 << 8) | c4)))

#define str9cmp(m, c0, c1, c2, c3, c4, c5, c6, c7, c8) \
  (str8cmp(m, c0, c1, c2, c3, c4, c5, c6, c7) && m[8] == c8)

#define str10cmp(m, c0, c1, c2, c3, c4, c5, c6, c7, c8, c9) \
  (str8cmp(m, c0, c1, c2, c3, c4, c5, c6, c7) &&            \
   (((uint32_t *)m)[2] & 0xffff) == ((c9 << 8) | c8))

#define str11cmp(m, c0, c1, c2, c3, c4, c5, c6, c7, c8, c9, c10) \
  (str10cmp(m, c0, c1, c2, c3, c4, c5, c6, c7, c8, c9) && (m[10] == c10))

#define str12cmp(m, c0, c1, c2, c3, c4, c5, c6, c7, c8, c9, c10, c11) \
  (str8cmp(m, c0, c1, c2, c3, c4, c5, c6, c7) &&                      \
   (((uint32_t *)m)[2] == ((c11 << 24) | (c10 << 16) | (c9 << 8) | c8)))

#else

#define str4cmp(m, c0, c1, c2, c3) \
  (m[0] == c0 && m[1] == c1 && m[2] == c2 && m[3] == c3)

#define str5cmp(m, c0, c1, c2, c3, c4) \
  (str4cmp(m, c0, c1, c2, c3) && (m[4] == c4))

#define str6cmp(m, c0, c1, c2, c3, c4, c5) \
  (str5cmp(m, c0, c1, c2, c3, c4) && m[5] == c5)

#define str7cmp(m, c0, c1, c2, c3, c4, c5, c6) \
  (str6cmp(m, c0, c1, c2, c3, c4, c5) && m[6] == c6)

#define str8cmp(m, c0, c1, c2, c3, c4, c5, c6, c7) \
  (str7cmp(m, c0, c1, c2, c3, c4, c5, c6) && m[7] == c7)

#define str9cmp(m, c0, c1, c2, c3, c4, c5, c6, c7, c8) \
  (str8cmp(m, c0, c1, c2, c3, c4, c5, c6, c7) && m[8] == c8)

#define str10cmp(m, c0, c1, c2, c3, c4, c5, c6, c7, c8, c9) \
  (str9cmp(m, c0, c1, c2, c3, c4, c5, c6, c7, c8) && m[9] == c9)

#define str11cmp(m, c0, c1, c2, c3, c4, c5, c6, c7, c8, c9, c10) \
  (str10cmp(m, c0, c1, c2, c3, c4, c5, c6, c7, c8, c9) && m[10] == c10)

#define str12cmp(m, c0, c1, c2, c3, c4, c5, c6, c7, c8, c9, c10, c11) \
  (str11cmp(m, c0, c1, c2, c3, c4, c5, c6, c7, c8, c9, c10) && m[11] == c11)

#endif

#define str3icmp(m, c0, c1, c2)           \
  ((m[0] == c0 || m[0] == (c0 ^ 0x20)) && \
   (m[1] == c1 || m[1] == (c1 ^ 0x20)) && (m[2] == c2 || m[2] == (c2 ^ 0x20)))

#define str4icmp(m, c0, c1, c2, c3) \
  (str3icmp(m, c0, c1, c2) && (m[3] == c3 || m[3] == (c3 ^ 0x20)))

#define str5icmp(m, c0, c1, c2, c3, c4) \
  (str4icmp(m, c0, c1, c2, c3) && (m[4] == c4 || m[4] == (c4 ^ 
```

### Core Architecture Module: `src/entropy/dyn_entropy_util.c`
```
/*
 * Dynomite - A thin, distributed replication layer for multi non-distributed
 *storages. Copyright (C) 2016 Netflix, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *_stats_pool_set_ts
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

#include <fcntl.h>  // for open
#include <math.h>   // to do ceil for number of chunks
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>  //for close

#include <openssl/conf.h>
#include <openssl/err.h>
#include <openssl/evp.h>

#include <netinet/in.h>
#include <sys/socket.h>
#include <sys/stat.h>
#include <sys/types.h>

#include "dyn_core.h"

/**
 * Anti - Entropy
 * ------------
 *
 * The entropy utility requires an external cluster that receives
 * the data and performs the reconciliation among nodes that contain
 * the same token. The communication between the external cluster
 * and Dynomite is performed through port 8105. Dynomite sends the snapshot
 * in chunks and encrypts each chunk independently using AES CBC 128.
 * The use of encryption is configurable.
 *
 * All socket connections are initialized
 * by the external cluster. Dynomite processes the following header:
 *
 * 1. Dynomite entropy receives a header with the following information
 *    a. 4 Bytes: Magic number which consists of 64640000 + 000X, where X is the
 * version b. 4 Bytes: Dynomite to send the snapshot (1) or to receive
 * reconciled data (2) c. 4 Bytes: size of the header d. 4 Bytes: size of
 * each chunk size (or else referred to as buffer_size) e. 4 Bytes: size of
 * the cipher
 *
 *    //TODO: need to add the IV in the header from Spark ---> Dynomite
 *
 * 2. Based on the fist byte the "dyn_entropy_snd.c" or "dyn_entropy_rcv.c" is
 * invoked.
 *
 * Dynomite Sender
 * ---------------
 * The sender works as follows:
 * 3. Dynomite invokes a Redis background AOF
 *
 * 4. Dynomite sends a header that contains
 *    a. 4 Bytes: Version number
 *    b. 4 Bytes: File size to stream
 *    c. 4 Bytes: Encryption enabled or disabled
 *
 * 5. Dynomite streams the snapshot in chunks. Evidently the last
 *    chunk size may be smaller than the rest.
 *
 * Stream of a snapshot is also throttled. By default set to 10 Mbps.
 *
 * Dynomite Receiver
 * ---------------
 * The receiver first opens a connection with the Redis server to talk through
 * RESP.
 * 3. Dynomite receiver receives
 *    a. 4 Bytes: key length
 *    b. key length Bytes : key
 *    c. 4 Bytes: old value length
 *    d. old value length Bytes: old value
 *    e. 4 Bytes: new value length
 *    f  new value length Bytes: new value
 *
 * 4. Data are flushed to Redis.
 */

/* Magic number for the protocol*/
#define MAGIC_NUMBER 64640001

/* Define max values so that Dynomite operates under limits */
#define MAX_HEADER_SIZE 1024
#define MAX_BUFFER_SIZE 5120000  // 5MB
#define MAX_CIPHER_SIZE 5120000  // 5MB

/* A 128 bit key  */
static unsigned char *theKey = (unsigned char *)"0123456789012345";

/* A 128 bit IV  */
static unsigned char *theIv = (unsigned char *)"0123456789012345";

/*
 * Function:  entropy_crypto_init
 * --------------------
 *
 * Initialize crypto libraries per connection
 */
void entropy_crypto_init() {
#if OPENSSL_VERSION_NUMBER < 0x10100000L
  ERR_load_crypto_strings();
  OpenSSL_add_all_algorithms();
#endif
  OPENSSL_config(NULL);
}

/*
 * Function:  entropy_crypto_deinit()
 * --------------------
 *
 * Clean crypto libraries per connection
 */
void entropy_crypto_deinit() {
#if OPENSSL_VERSION_NUMBER < 0x10100000L
  EVP_cleanup();
  ERR_free_strings();
#endif
}

/*
 * Function: entropy_decrypt
 * --------------------
 *  Decrypt the input data using the key and the Initialization Vector (IV).
 *  Uses AES_128_CBC
 *
 *  returns: the length of the ciphertext if it has ended successfully,
 *  or the DN_ERROR status.
 *
 */

int entropy_decrypt(unsigned char *ciphertext, int ciphertext_len,
                    unsigned char *plaintext) {
  EVP_CIPHER_CTX *ctx;

  int len;

  int plaintext_len = 0;

  /* Create and initialize the context */
  if (!(ctx = EVP_CIPHER_CTX_new())) goto error;

  /* Initialize the decryption operation with 128 bit AES */
  if (1 != EVP_DecryptInit_ex(ctx, EVP_aes_128_cbc(), NULL, theKey, theIv))
    goto error;

  /* Provide the message to be decrypted, and obtain the encrypted output.
   * EVP_EncryptUpdate can be called multiple times if necessary
   */
  if (1 != EVP_DecryptUpdate(ctx, plaintext, &len, ciphertext, ciphertext_len))
    goto error;

  plaintext_len = len;

  /* Finalize the decryption. Further ciphertext bytes may be written at
   * this stage.
   */
  if (1 != EVP_DecryptFinal_ex(ctx, ciphertext + len, &len)) goto error;

  plaintext_len += len;

  /* Clean up */
  EVP_CIPHER_CTX_free(ctx);

  return plaintext_len;

error:

  if (ctx != NULL) EVP_CIPHER_CTX_free(ctx);

  return DN_ERROR;
}

/*
 * Function: entropy_encrypt
 * --------------------
 *  Encrypts the input data using the key and the Initialization Vector (IV).
 *  Uses AES_256_CBC
 *
 *  returns: the length of the ciphertext if it has ended successfully,
 *  or the DN_ERROR status.
 *
 */

int entropy_encrypt(unsigned char *plaintext, int plaintext_len,
                    unsigned char *ciphertext) {
  EVP_CIPHER_CTX *ctx;

  int len;

  int ciphertext_len = 0;

  /* Create and initialize the context */
  if (!(ctx = EVP_CIPHER_CTX_new())) return DN_ERROR;

  /* Padding */
  if (1 != EVP_CIPHER_CTX_set_padding(ctx, 0)) goto error;

  /* Initialize the encryption operation with 256 bit AES */
  if (1 != EVP_EncryptInit_ex(ctx, EVP_aes_128_cbc(), NULL, theKey, theIv))
    goto error;

  /* Provide the message to be encrypted, and obtain the encrypted output.
   * EVP_EncryptUpdate can be called multiple times if necessary
   */
  if (1 != EVP_EncryptUpdate(ctx, ciphertext, &len, plaintext, plaintext_len))
    goto error;

  ciphertext_len = len;

  /* Finalize the encryption. Further ciphertext bytes may be written at
   * this stage.
   */
  if (1 != EVP_EncryptFinal_ex(ctx, ciphertext + len, &len)) goto error;
  ciphertext_len += len;

  /* Clean up */
  EVP_CIPHER_CTX_free(ctx);

  // loga("Block size: %d", EVP_CIPHER_block_size(ctx) );

  return ciphertext_len;

error:

  if (ctx != NULL) EVP_CIPHER_CTX_free(ctx);

  return DN_ERROR;
}

/*
 * Function: entropy_conn_stop
 * --------------------
 * closes the socket connection
 */

static void entropy_conn_stop(struct entropy *cn) { close(cn->sd); }

/*
 * Function:  entropy_conn_destroy
 * --------------------
 * Frees up the memory pointer for the connection
 */

void entropy_conn_destroy(struct entropy *cn) {
  entropy_conn_stop(cn);
  dn_free(cn);
}

/*
 * Function:  entropy_listen
 * --------------------
 *  returns: r_status for the status of the new socket and
 *  corresponding phases, e.g. socket, bind, listen etc.
 */

rstatus_t entropy_listen(struct entropy *cn) {
  rstatus_t status;
  struct sockinfo si;

  status = dn_resolve(&cn->addr, cn->port, &si);
  if (status < 0) {
    return status;
  }

  cn->sd = socket(si.family, SOCK_STREAM, 0);
  if (cn->sd < 0) {
    log_error("anti-entropy socket failed: %s", strerror(errno));
    return DN_ERROR;
  }

  status = dn_set_reuseaddr(cn->sd);
  if (status < 0) {
    log_error("anti-entropy set reuseaddr on m %d failed: %s", cn->sd,
              strerror(errno));
    return DN_ERROR;
  }

  status = bind(cn->sd, (struct sockaddr *)&si.addr, si.addrlen);
  if (status < 0) {
    log_error(" anti-entropy bind on m %d to addr '%.*s:%u' failed: %s", cn->sd,
              cn->addr.len, cn->addr.data, cn->port, strerror(errno));
    return DN_ERROR;
  }

  status = listen(cn->sd, SOMAXCONN);
  if (status < 0) {
    log_error("anti-entropy listen on m %d failed: %s", cn->sd,
              strerror(errno));
    return DN_ERROR;
  }

  log_debug(LOG_NOTICE, "anti-entropy m %d listening on '%.*s:%u'", cn->sd,
            cn->addr.len, cn->addr.data, cn->port);

  return DN_OK;
}

/*
 * Function:  entropy_iv_load
 * --------------------
 *
 * Loads the send IV from a file
 */
rstatus_t entropy_key_iv_load(struct context *ctx) {
  int fd;
  struct stat file_stat;
  unsigned char buff[BUFFER_SIZE];

  struct server_pool *pool = &ctx->pool;

  /* 1. Check if the String array of the file names has been allocated */
  if (string_empty(&pool->recon_key_file) ||
      string_empty(&pool->recon_iv_file)) {
    log_error("Could NOT read entropy key or iv file");
    return DN_ERROR;
  }

  /* 2. allocate char based on the length in the string arrays */
  char key_file_name[pool->recon_key_file.len + 1];
  char iv_file_name[pool->recon_iv_file.len + 1];

  /* copy the content to the allocated array */
  memcpy(key_file_name, pool->recon_key_file.data, pool->recon_key_file.len);
  key_file_name[pool->recon_key_file.len] = '\0';
  memcpy(iv_file_name, pool->recon_iv_file.data, pool->recon_iv_file.len);
  iv_file_name[pool->recon_iv_file.len] = '\0';

  loga("Key File name: %s - IV File name: %s", key_file_name, iv_file_name);

  /* 3. checking if the key and iv files exist using access */
  if (access(key_file_name, F_OK) < 0) {
    log_error("Error: file %s does not exist", key_file_name);
    return DN_ERROR;
  } else if (access(iv_file_name, F_OK) < 0) {
    log_error("Error: file %s does not exist", iv_file_name);
    return DN_ERROR;
  }

  /* 4. loading the .pem files */
  FILE *key_file = fopen(key_file_name, "r");
  if (key_file == NULL) {
    log_error("opening key.pem file failed %s", pool->recon_key_file);
    return DN_ERROR;
  }
  FILE *iv_file = fopen(iv_
```

### Core Architecture Module: `src/event/dyn_kqueue.c`
```
/*
 * Dynomite - A thin, distributed replication layer for multi non-distributed
 * storages. Copyright (C) 2014 Netflix, Inc.
 */

/*
 * twemproxy - A fast and lightweight proxy for memcached protocol.
 * Copyright (C) 2011 Twitter, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

#include <dyn_core.h>

#ifdef DN_HAVE_KQUEUE

#include <dyn_event.h>
#include <sys/event.h>

struct event_base *event_base_create(int nevent, event_cb_t cb) {
  struct event_base *evb;
  int status, kq;
  struct kevent *change, *event;

  ASSERT(nevent > 0);

  kq = kqueue();
  if (kq < 0) {
    log_error("kqueue failed: %s", strerror(errno));
    return NULL;
  }

  change = dn_calloc(nevent, sizeof(*change));
  if (change == NULL) {
    status = close(kq);
    if (status < 0) {
      log_error("close kq %d failed, ignored: %s", kq, strerror(errno));
    }
    return NULL;
  }

  event = dn_calloc(nevent, sizeof(*event));
  if (event == NULL) {
    dn_free(change);
    status = close(kq);
    if (status < 0) {
      log_error("close kq %d failed, ignored: %s", kq, strerror(errno));
    }
    return NULL;
  }

  evb = dn_alloc(sizeof(*evb));
  if (evb == NULL) {
    dn_free(change);
    dn_free(event);
    status = close(kq);
    if (status < 0) {
      log_error("close kq %d failed, ignored: %s", kq, strerror(errno));
    }
    return NULL;
  }

  evb->kq = kq;
  evb->change = change;
  evb->nchange = 0;
  evb->event = event;
  evb->nevent = nevent;
  evb->nreturned = 0;
  evb->nprocessed = 0;
  evb->cb = cb;

  log_debug(LOG_INFO, "kq %d with nevent %d", evb->kq, evb->nevent);

  return evb;
}

void event_base_destroy(struct event_base *evb) {
  int status;

  if (evb == NULL) {
    return;
  }

  ASSERT(evb->kq > 0);

  dn_free(evb->change);
  dn_free(evb->event);

  status = close(evb->kq);
  if (status < 0) {
    log_error("close kq %d failed, ignored: %s", evb->kq, strerror(errno));
  }
  evb->kq = -1;

  dn_free(evb);
}

int event_add_in(struct event_base *evb, struct conn *c) {
  struct kevent *event;

  ASSERT(evb->kq > 0);
  ASSERT(c != NULL);
  ASSERT(c->sd > 0);
  ASSERT(evb->nchange < evb->nevent);

  if (c->recv_active) {
    return 0;
  }

  event = &evb->change[evb->nchange++];
  EV_SET(event, c->sd, EVFILT_READ, EV_ADD | EV_CLEAR, 0, 0, c);

  c->recv_active = 1;

  return 0;
}

int event_del_in(struct event_base *evb, struct conn *c) {
  struct kevent *event;

  ASSERT(evb->kq > 0);
  ASSERT(c != NULL);
  ASSERT(c->sd > 0);
  ASSERT(evb->nchange < evb->nevent);

  if (!c->recv_active) {
    return 0;
  }

  event = &evb->change[evb->nchange++];
  EV_SET(event, c->sd, EVFILT_READ, EV_DELETE, 0, 0, c);

  c->recv_active = 0;

  return 0;
}

int event_add_out(struct event_base *evb, struct conn *c) {
  struct kevent *event;

  ASSERT(evb->kq > 0);
  ASSERT(c != NULL);
  ASSERT(c->sd > 0);
  ASSERT(c->recv_active);
  ASSERT(evb->nchange < evb->nevent);

  if (c->send_active) {
    return 0;
  }

  event = &evb->change[evb->nchange++];
  EV_SET(event, c->sd, EVFILT_WRITE, EV_ADD | EV_CLEAR, 0, 0, c);

  c->send_active = 1;

  return 0;
}

int event_del_out(struct event_base *evb, struct conn *c) {
  struct kevent *event;

  ASSERT(evb->kq > 0);
  ASSERT(c != NULL);
  ASSERT(c->sd > 0);
  ASSERT(c->recv_active);
  ASSERT(evb->nchange < evb->nevent);

  if (!c->send_active) {
    return 0;
  }

  event = &evb->change[evb->nchange++];
  EV_SET(event, c->sd, EVFILT_WRITE, EV_DELETE, 0, 0, c);

  c->send_active = 0;

  return 0;
}

int event_add_conn(struct event_base *evb, struct conn *c) {
  ASSERT(evb->kq > 0);
  ASSERT(c != NULL);
  ASSERT(c->sd > 0);
  ASSERT(!c->recv_active);
  ASSERT(!c->send_active);
  ASSERT(evb->nchange < evb->nevent);

  event_add_in(evb, c);
  event_add_out(evb, c);

  return 0;
}

int event_del_conn(struct event_base *evb, struct conn *c) {
  int i;

  ASSERT(evb->kq > 0);
  ASSERT(c != NULL);
  ASSERT(c->sd > 0);
  ASSERT(evb->nchange < evb->nevent);

  event_del_out(evb, c);
  event_del_in(evb, c);

  /*
   * Now, eliminate pending events for c->sd (there should be at most one
   * other event). This is important because we will close c->sd and free
   * c when we return.
   */
  for (i = evb->nprocessed + 1; i < evb->nreturned; i++) {
    struct kevent *ev = &evb->event[i];
    if (ev->ident == (uintptr_t)c->sd) {
      ev->flags = 0;
      ev->filter = 0;
      break;
    }
  }

  return 0;
}

int event_wait(struct event_base *evb, int timeout) {
  int kq = evb->kq;
  struct timespec ts, *tsp;

  ASSERT(kq > 0);

  /* kevent should block indefinitely if timeout < 0 */
  if (timeout < 0) {
    tsp = NULL;
  } else {
    tsp = &ts;
    tsp->tv_sec = timeout / 1000LL;
    tsp->tv_nsec = (timeout % 1000LL) * 1000000LL;
  }

  for (;;) {
    /*
     * kevent() is used both to register new events with kqueue, and to
     * retrieve any pending events. Changes that should be applied to the
     * kqueue are given in the change[] and any returned events are placed
     * in event[], up to the maximum sized allowed by nevent. The number
     * of entries actually placed in event[] is returned by the kevent()
     * call and saved in nreturned.
     *
     * Events are registered with the system by the application via a
     * struct kevent, and an event is uniquely identified with the system
     * by a (kq, ident, filter) tuple. This means that there can be only
     * one (ident, filter) pair for a given kqueue.
     */
    evb->nreturned =
        kevent(kq, evb->change, evb->nchange, evb->event, evb->nevent, tsp);
    evb->nchange = 0;
    if (evb->nreturned > 0) {
      for (evb->nprocessed = 0; evb->nprocessed < evb->nreturned;
           evb->nprocessed++) {
        struct kevent *ev = &evb->event[evb->nprocessed];
        uint32_t events = 0;

        log_debug(LOG_VVERB,
                  "kevent %04" PRIX32
                  " with filter %d "
                  "triggered on sd %d",
                  ev->flags, ev->filter, ev->ident);

        /*
         * If an error occurs while processing an element of the
         * change[] and there is enough room in the event[], then the
         * event event will be placed in the eventlist with EV_ERROR
         * set in flags and the system error(errno) in data.
         */
        if (ev->flags & EV_ERROR) {
          /*
           * Error messages that can happen, when a delete fails.
           *   EBADF happens when the file descriptor has been closed
           *   ENOENT when the file descriptor was closed and then
           *   reopened.
           *   EINVAL for some reasons not understood; EINVAL
           *   should not be returned ever; but FreeBSD does :-\
           * An error is also indicated when a callback deletes an
           * event we are still processing. In that case the data
           * field is set to ENOENT.
           */
          if (ev->data == EBADF || ev->data == EINVAL || ev->data == ENOENT ||
              ev->data == EINTR) {
            continue;
          }
          events |= EVENT_ERR;
        }

        if (ev->filter == EVFILT_READ) {
          events |= EVENT_READ;
        }

        if (ev->filter == EVFILT_WRITE) {
          events |= EVENT_WRITE;
        }

        if (evb->cb != NULL && events != 0) {
          evb->cb(ev->udata, events);
        }
      }
      return evb->nreturned;
    }

    if (evb->nreturned == 0) {
      if (timeout == -1) {
        log_error(
            "kevent on kq %d with %d events and %d timeout "
            "returned no events",
            kq, evb->nevent, timeout);
        return -1;
      }

      return 0;
    }

    if (errno == EINTR) {
      continue;
    }

    log_error("kevent on kq %d with %d events failed: %s", kq, evb->nevent,
              strerror(errno));
    return -1;
  }

  NOT_REACHED();
}

void event_loop_stats(event_stats_cb_t cb, void *arg) {
  struct stats *st = arg;
  int status, kq;
  struct kevent change, event;
  struct timespec ts, *tsp;

  kq = kqueue();
  if (kq < 0) {
    log_error("kqueue failed: %s", strerror(errno));
    return;
  }

  EV_SET(&change, st->sd, EVFILT_READ, EV_ADD | EV_CLEAR, 0, 0, NULL);

  /* kevent should block indefinitely if st->interval < 0 */
  if (st->interval < 0) {
    tsp = NULL;
  } else {
    tsp = &ts;
    tsp->tv_sec = st->interval / 1000LL;
    tsp->tv_nsec = (st->interval % 1000LL) * 1000000LL;
  }

  for (;;) {
    int nreturned;

    nreturned = kevent(kq, &change, 1, &event, 1, tsp);
    if (nreturned < 0) {
      if (errno == EINTR) {
        continue;
      }
      log_error("kevent on kq %d with m %d failed: %s", kq, st->sd,
                strerror(errno));
      goto error;
    }

    ASSERT(nreturned <= 1);

    if (nreturned == 1) {
      struct kevent *ev = &event;

      if (ev->flags & EV_ERROR) {
        if (ev->data == EINTR) {
          continue;
        }
        log_error("kevent on kq %d with m %d failed: %s", kq, st->sd,
                  strerror(ev->data));
        goto error;
      }
    }

    cb(st, &nreturned);
  }

error:
  status = close(kq);
  if (status < 0) {
    log_error("close kq %d failed, ignored: %s", kq, strerror(errno));
  }
  kq = -1;
}

void event_loop_entropy(event_entropy_cb_t cb, void *arg) {
  struct entropy *ent = arg;
  int status, kq;
  struct kevent change, event;
  struct timespec ts, *tsp;

  kq = kqueue();
  if (kq < 0) {
    log_error("entropy kqueue failed: %s", strerror(errno));
    return;
  }

  EV_SET(&change, ent->sd, EVFILT_READ, EV_ADD 
```

### Core Architecture Module: `contrib/fmemopen.c`
```
//
// Copyright 2011-2014 NimbusKit
// Originally ported from https://github.com/ingenuitas/python-tesseract/blob/master/fmemopen.c
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/mman.h>

struct fmem {
  size_t pos;
  size_t size;
  char *buffer;
};
typedef struct fmem fmem_t;

static int readfn(void *handler, char *buf, int size) {
  fmem_t *mem = handler;
  size_t available = mem->size - mem->pos;
  
  if (size > available) {
    size = available;
  }
  memcpy(buf, mem->buffer + mem->pos, sizeof(char) * size);
  mem->pos += size;
  
  return size;
}

static int writefn(void *handler, const char *buf, int size) {
  fmem_t *mem = handler;
  size_t available = mem->size - mem->pos;

  if (size > available) {
    size = available;
  }
  memcpy(mem->buffer + mem->pos, buf, sizeof(char) * size);
  mem->pos += size;

  return size;
}

static fpos_t seekfn(void *handler, fpos_t offset, int whence) {
  size_t pos;
  fmem_t *mem = handler;

  switch (whence) {
    case SEEK_SET: {
      if (offset >= 0) {
        pos = (size_t)offset;
      } else {
        pos = 0;
      }
      break;
    }
    case SEEK_CUR: {
      if (offset >= 0 || (size_t)(-offset) <= mem->pos) {
        pos = mem->pos + (size_t)offset;
      } else {
        pos = 0;
      }
      break;
    }
    case SEEK_END: pos = mem->size + (size_t)offset; break;
    default: return -1;
  }

  if (pos > mem->size) {
    return -1;
  }

  mem->pos = pos;
  return (fpos_t)pos;
}

static int closefn(void *handler) {
  free(handler);
  return 0;
}

FILE *fmemopen(void *buf, size_t size, const char *mode) {
  // This data is released on fclose.
  fmem_t* mem = (fmem_t *) malloc(sizeof(fmem_t));

  // Zero-out the structure.
  memset(mem, 0, sizeof(fmem_t));

  mem->size = size;
  mem->buffer = buf;

  // funopen's man page: https://developer.apple.com/library/mac/#documentation/Darwin/Reference/ManPages/man3/funopen.3.html
  return funopen(mem, readfn, writefn, seekfn, closefn);
}

```

### Core Architecture Module: `contrib/fmemopen.h`
```
//
// Copyright 2011-2014 NimbusKit
// Originally ported from https://github.com/ingenuitas/python-tesseract/blob/master/fmemopen.c
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//

#ifndef FMEMOPEN_H_
#define FMEMOPEN_H_

#if defined __cplusplus
extern "C" {
#endif

/**
 * A BSD port of the fmemopen Linux method using funopen.
 *
 * man docs for fmemopen:
 * http://linux.die.net/man/3/fmemopen
 *
 * man docs for funopen:
 * https://developer.apple.com/library/mac/#documentation/Darwin/Reference/ManPages/man3/funopen.3.html
 *
 * This method is ported from ingenuitas' python-tesseract project.
 *
 * You must call fclose on the returned file pointer or memory will be leaked.
 *
 * @param buf The data that will be used to back the FILE* methods. Must be at least
 *            @c size bytes.
 * @param size The size of the @c buf data.
 * @param mode The permitted stream operation modes.
 * @return A pointer that can be used in the fread/fwrite/fseek/fclose family of methods.
 *         If a failure occurred NULL will be returned.
 * @ingroup NimbusMemoryMappping
 */
FILE *fmemopen(void *buf, size_t size, const char *mode);

#ifdef __cplusplus
}
#endif

#endif // #ifndef FMEMOPEN_H_

```

### Core Architecture Module: `contrib/murmur3/murmur3.c`
```
//-----------------------------------------------------------------------------
// MurmurHash3 was written by Austin Appleby, and is placed in the public
// domain. The author hereby disclaims copyright to this source code.

// Note - The x86 and x64 versions do _not_ produce the same results, as the
// algorithms are optimized for their respective platforms. You can still
// compile and run any of them on any platform, but your performance with the
// non-native version will be less than optimal.

#include "murmur3.h"

//-----------------------------------------------------------------------------
// Platform-specific functions and macros

#ifdef __GNUC__
#define FORCE_INLINE __attribute__((always_inline)) inline
#else
#define FORCE_INLINE
#endif

static inline FORCE_INLINE uint32_t rotl32 ( uint32_t x, int8_t r )
{
  return (x << r) | (x >> (32 - r));
}

static inline FORCE_INLINE uint64_t rotl64 ( uint64_t x, int8_t r )
{
  return (x << r) | (x >> (64 - r));
}

#define	ROTL32(x,y)	rotl32(x,y)
#define ROTL64(x,y)	rotl64(x,y)

#define BIG_CONSTANT(x) (x##LLU)

//-----------------------------------------------------------------------------
// Block read - if your platform needs to do endian-swapping or can only
// handle aligned reads, do the conversion here

#define getblock(p, i) (p[i])

//-----------------------------------------------------------------------------
// Finalization mix - force all bits of a hash block to avalanche

static inline FORCE_INLINE uint32_t fmix32 ( uint32_t h )
{
  h ^= h >> 16;
  h *= 0x85ebca6b;
  h ^= h >> 13;
  h *= 0xc2b2ae35;
  h ^= h >> 16;

  return h;
}

//----------

static inline FORCE_INLINE uint64_t fmix64 ( uint64_t k )
{
  k ^= k >> 33;
  k *= BIG_CONSTANT(0xff51afd7ed558ccd);
  k ^= k >> 33;
  k *= BIG_CONSTANT(0xc4ceb9fe1a85ec53);
  k ^= k >> 33;

  return k;
}

//-----------------------------------------------------------------------------

void MurmurHash3_x86_32 ( const void * key, int len,
                          uint32_t seed, void * out )
{
  const uint8_t * data = (const uint8_t*)key;
  const int nblocks = len / 4;
  int i;

  uint32_t h1 = seed;

  uint32_t c1 = 0xcc9e2d51;
  uint32_t c2 = 0x1b873593;

  //----------
  // body

  const uint32_t * blocks = (const uint32_t *)(data + nblocks*4);

  for(i = -nblocks; i; i++)
  {
    uint32_t k1 = getblock(blocks,i);

    k1 *= c1;
    k1 = ROTL32(k1,15);
    k1 *= c2;
    
    h1 ^= k1;
    h1 = ROTL32(h1,13); 
    h1 = h1*5+0xe6546b64;
  }

  //----------
  // tail

  const uint8_t * tail = (const uint8_t*)(data + nblocks*4);

  uint32_t k1 = 0;

  switch(len & 3)
  {
  case 3: k1 ^= tail[2] << 16;
  case 2: k1 ^= tail[1] << 8;
  case 1: k1 ^= tail[0];
          k1 *= c1; k1 = ROTL32(k1,15); k1 *= c2; h1 ^= k1;
  };

  //----------
  // finalization

  h1 ^= len;

  h1 = fmix32(h1);

  *(uint32_t*)out = h1;
} 

//-----------------------------------------------------------------------------

void MurmurHash3_x86_128 ( const void * key, const int len,
                           uint32_t seed, void * out )
{
  const uint8_t * data = (const uint8_t*)key;
  const int nblocks = len / 16;
  int i;

  uint32_t h1 = seed;
  uint32_t h2 = seed;
  uint32_t h3 = seed;
  uint32_t h4 = seed;

  uint32_t c1 = 0x239b961b; 
  uint32_t c2 = 0xab0e9789;
  uint32_t c3 = 0x38b34ae5; 
  uint32_t c4 = 0xa1e38b93;

  //----------
  // body

  const uint32_t * blocks = (const uint32_t *)(data + nblocks*16);

  for(i = -nblocks; i; i++)
  {
    uint32_t k1 = getblock(blocks,i*4+0);
    uint32_t k2 = getblock(blocks,i*4+1);
    uint32_t k3 = getblock(blocks,i*4+2);
    uint32_t k4 = getblock(blocks,i*4+3);

    k1 *= c1; k1  = ROTL32(k1,15); k1 *= c2; h1 ^= k1;

    h1 = ROTL32(h1,19); h1 += h2; h1 = h1*5+0x561ccd1b;

    k2 *= c2; k2  = ROTL32(k2,16); k2 *= c3; h2 ^= k2;

    h2 = ROTL32(h2,17); h2 += h3; h2 = h2*5+0x0bcaa747;

    k3 *= c3; k3  = ROTL32(k3,17); k3 *= c4; h3 ^= k3;

    h3 = ROTL32(h3,15); h3 += h4; h3 = h3*5+0x96cd1c35;

    k4 *= c4; k4  = ROTL32(k4,18); k4 *= c1; h4 ^= k4;

    h4 = ROTL32(h4,13); h4 += h1; h4 = h4*5+0x32ac3b17;
  }

  //----------
  // tail

  const uint8_t * tail = (const uint8_t*)(data + nblocks*16);

  uint32_t k1 = 0;
  uint32_t k2 = 0;
  uint32_t k3 = 0;
  uint32_t k4 = 0;

  switch(len & 15)
  {
  case 15: k4 ^= tail[14] << 16;
  case 14: k4 ^= tail[13] << 8;
  case 13: k4 ^= tail[12] << 0;
           k4 *= c4; k4  = ROTL32(k4,18); k4 *= c1; h4 ^= k4;

  case 12: k3 ^= tail[11] << 24;
  case 11: k3 ^= tail[10] << 16;
  case 10: k3 ^= tail[ 9] << 8;
  case  9: k3 ^= tail[ 8] << 0;
           k3 *= c3; k3  = ROTL32(k3,17); k3 *= c4; h3 ^= k3;

  case  8: k2 ^= tail[ 7] << 24;
  case  7: k2 ^= tail[ 6] << 16;
  case  6: k2 ^= tail[ 5] << 8;
  case  5: k2 ^= tail[ 4] << 0;
           k2 *= c2; k2  = ROTL32(k2,16); k2 *= c3; h2 ^= k2;

  case  4: k1 ^= tail[ 3] << 24;
  case  3: k1 ^= tail[ 2] << 16;
  case  2: k1 ^= tail[ 1] << 8;
  case  1: k1 ^= tail[ 0] << 0;
           k1 *= c1; k1  = ROTL32(k1,15); k1 *= c2; h1 ^= k1;
  };

  //----------
  // finalization

  h1 ^= len; h2 ^= len; h3 ^= len; h4 ^= len;

  h1 += h2; h1 += h3; h1 += h4;
  h2 += h1; h3 += h1; h4 += h1;

  h1 = fmix32(h1);
  h2 = fmix32(h2);
  h3 = fmix32(h3);
  h4 = fmix32(h4);

  h1 += h2; h1 += h3; h1 += h4;
  h2 += h1; h3 += h1; h4 += h1;

  ((uint32_t*)out)[0] = h1;
  ((uint32_t*)out)[1] = h2;
  ((uint32_t*)out)[2] = h3;
  ((uint32_t*)out)[3] = h4;
}

//-----------------------------------------------------------------------------

void MurmurHash3_x64_128 ( const void * key, const int len,
                           const uint32_t seed, void * out )
{
  const uint8_t * data = (const uint8_t*)key;
  const int nblocks = len / 16;
  int i;

  uint64_t h1 = seed;
  uint64_t h2 = seed;

  uint64_t c1 = BIG_CONSTANT(0x87c37b91114253d5);
  uint64_t c2 = BIG_CONSTANT(0x4cf5ad432745937f);

  //----------
  // body

  const uint64_t * blocks = (const uint64_t *)(data);

  for(i = 0; i < nblocks; i++)
  {
    uint64_t k1 = getblock(blocks,i*2+0);
    uint64_t k2 = getblock(blocks,i*2+1);

    k1 *= c1; k1  = ROTL64(k1,31); k1 *= c2; h1 ^= k1;

    h1 = ROTL64(h1,27); h1 += h2; h1 = h1*5+0x52dce729;

    k2 *= c2; k2  = ROTL64(k2,33); k2 *= c1; h2 ^= k2;

    h2 = ROTL64(h2,31); h2 += h1; h2 = h2*5+0x38495ab5;
  }

  //----------
  // tail

  const uint8_t * tail = (const uint8_t*)(data + nblocks*16);

  uint64_t k1 = 0;
  uint64_t k2 = 0;

  switch(len & 15)
  {
  case 15: k2 ^= (uint64_t)(tail[14]) << 48;
  case 14: k2 ^= (uint64_t)(tail[13]) << 40;
  case 13: k2 ^= (uint64_t)(tail[12]) << 32;
  case 12: k2 ^= (uint64_t)(tail[11]) << 24;
  case 11: k2 ^= (uint64_t)(tail[10]) << 16;
  case 10: k2 ^= (uint64_t)(tail[ 9]) << 8;
  case  9: k2 ^= (uint64_t)(tail[ 8]) << 0;
           k2 *= c2; k2  = ROTL64(k2,33); k2 *= c1; h2 ^= k2;

  case  8: k1 ^= (uint64_t)(tail[ 7]) << 56;
  case  7: k1 ^= (uint64_t)(tail[ 6]) << 48;
  case  6: k1 ^= (uint64_t)(tail[ 5]) << 40;
  case  5: k1 ^= (uint64_t)(tail[ 4]) << 32;
  case  4: k1 ^= (uint64_t)(tail[ 3]) << 24;
  case  3: k1 ^= (uint64_t)(tail[ 2]) << 16;
  case  2: k1 ^= (uint64_t)(tail[ 1]) << 8;
  case  1: k1 ^= (uint64_t)(tail[ 0]) << 0;
           k1 *= c1; k1  = ROTL64(k1,31); k1 *= c2; h1 ^= k1;
  };

  //----------
  // finalization

  h1 ^= len; h2 ^= len;

  h1 += h2;
  h2 += h1;

  h1 = fmix64(h1);
  h2 = fmix64(h2);

  h1 += h2;
  h2 += h1;

  ((uint64_t*)out)[0] = h1;
  ((uint64_t*)out)[1] = h2;
}

//-----------------------------------------------------------------------------


```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #777** (2021-01-19): **Fragmented queries silently fail cross-region replication**
  *Symptoms*: 1. redis_fragment_argx() is in charge of fragmenting multi commands    (like mset, mget, etc.) as they may belong to different dyno    servers. As part of this, it cuts out multiple small mbufs and    links them to cumulatively make a single node request.     Eg: Assume 2 nodes (NODE1, NODE2)        Query: "MGET key1 key2 key3"        If 'key1' and 'key3' belong to NODE1, there will be 3 mbufs under        the fragmented request sent to NODE1.         MBUF1: *3\r\n$4\r\nMGET\r\n        MBUF2: $4\r\nkey1        MBUF3: $4\r\nkey2         Similarly, the frag'd request for NODE2 will have 2 linked mbufs.         The mbufs are cut from the original request and linked to the        fragmented ones for efficiency, and hence multiple MBUFs.         Now to the problem. Since dynomite has this behavior of encrypting        each individual mbuf, we also need to symmetrically decrypt one        mbuf at a time. However, since the fragmented mbufs are small, they        will be received into one large mbuf which will fail to decrypt        as a whole.         This patch fixes this by making sure all fragmented queries fit into        a single mbuf unless it really needs 2.        TODO: This is less efficient because of copying data around. Switch              back to multiple small MBUFs if the crypto scheme is fixed.  2. Since the fragmented query could also carry with it a key exchange, it    could permanently disable cross-region communication between regi

- **Issue #745** (2019-11-20): **Replicas shouldn't update top level rem-set on final field delete**
  *Symptoms*: This applies to hashmaps, sorted sets and sets.  Consider the following example: If a sorted set in Dynomite has 2 or more items across replicas, but if one of the replicas has a missed update(s) and therefore has only 1 item, removing that item using dynomite previously updated the top level REM set in that replica.  This is incorrect because now trying to read the other (non-deleted) field, would cause read repairs to compare its timestamp against the TS in the top level REM set in the inconsistent replica, and delete the item incorrectly thinking that someone removed the entire map/set/set in that broken replica.  This patch fixes it by not updating the top level REM set for field deletes. Only a DEL will update the top level REM set for maps/sets/zsets.  This was noticed in a TEST cluster.

- **Issue #741** (2019-11-20): **Read-repair enabled messages should update read/write metrics correctly**
  *Symptoms*: The rewritten messages all got tracked as write messages since we didn't adopt the 'is_read' parameter from the original 'msg' object.  Confirmed that reads/writes are correct with this patch.

- **Issue #740** (2019-11-04): **Turning on repairs shouldn't invoke repairs for in-flight queries**
  *Symptoms*: Turning on repairs with constant traffic runs the risk of in-flight queries trying to be repaired. This is incorrect and we should make sure to not take the repair path for these queries.  This was found in a TEST cluster and I confirmed that this patch fixes it.

- **Issue #739** (2019-11-04): **Make scripts auto-cleanup stale metadata if detected**
  *Symptoms*: If we have metadata that exists for a key, but the key itself does not exist, we would previously get an ambiguous response with the status code 'E' but a (nul) value.  This patchset deletes the metadata if this case is detected and returns status code 'X' to denote that the value does not exist.  In normal operation, this ambiguous case should never happen, however, it can happen if read repairs had been disabled and then reenabled with live traffic between them. In this case, we don't want it to crash. This was found in a TEST cluster and I've confirmed that this fixes it.

- **Issue #738** (2019-11-03): **Setup/cleanup (struct msg)->msg_info correctly**
  *Symptoms*: Without proper cleanup, we risk leaking memory and having multiple owners overwriting the same memory.

- **Issue #736** (2019-10-31): **Multiple rspmgrs get assigned the same DC name under DC_EACH_SAFE_QUORUM**
  *Symptoms*: This bug caused some DCs to be ignored, also leading to non-deterministic crashes. This fixes the bug by assuring each rspmgr is assigned the correct name under a request msg.

- **Issue #731** (2019-10-22): **Add ownership information for dnode_peer/server errors and fix cross-…**
  *Symptoms*: …DC checksum logic  When we hit an error trying to connect to a dnode peer or a server, we create an appropriate error message but don't link the respective connection to the error response 'msg'. This is necessary at least for processing DC_EACH_SAFE_QUORUM responses.  Also, checksums for cross-DC messages were not done properly since msg_payload_crc32() only accounted for intra-DC messages. More explained in code comments.

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

### Incident Patch 1: `2046b05e` (2022-10-03)
**Commit Message**: Merge pull request #809 from Netflix/fix/large-payload-crash

Fixes crash on large payloads for MGET/MSET/SCAN

**File**: `.travis.yml` (modified, +8/-2)
```diff
@@ -1,8 +1,14 @@
 language: c
 script: bash ./travis.sh
 
+before_install:
+  - sudo apt remove --purge python3-pip
+  - curl -O https://bootstrap.pypa.io/pip/3.5/get-pip.py
+  - sudo -E python3 get-pip.py
+  - sudo -E python3 -m pip install --upgrade "pip < 22.3"
+  
 addons:
   apt:
+   update: true
    packages:
-   - python3
-   - python3-pip
+   - python3.9
```

**File**: `src/dyn_client.c` (modified, +6/-0)
```diff
@@ -1099,6 +1099,12 @@ void req_recv_done(struct context *ctx, struct conn *conn, struct msg *req,
   if (status != DN_OK) goto error;
 
   status = fragment_query_if_necessary(req, conn, &frag_msgq);
+  if (status == DYNOMITE_PAYLOAD_TOO_LARGE) {
+    dictAdd(conn->outstanding_msgs_dict, &req->id, req);
+    req->nfrag = 0; // Since we failed to fragment the payload, we don't have any fragments for this request
+    goto error;
+  }
+
   if (status != DN_OK) goto error;
 
   status = rewrite_query_with_timestamp_md(&req, ctx);
```

**File**: `src/dyn_message.h` (modified, +4/-0)
```diff
@@ -294,6 +294,7 @@ typedef enum dyn_error {
   BAD_FORMAT,
   DYNOMITE_NO_QUORUM_ACHIEVED,
   DYNOMITE_SCRIPT_SPANS_NODES,
+  DYNOMITE_PAYLOAD_TOO_LARGE,
 } dyn_error_t;
 
 static inline char *dn_strerror(dyn_error_t err) {
@@ -318,6 +319,8 @@ static inline char *dn_strerror(dyn_error_t err) {
       return "Failed to achieve Quorum";
     case DYNOMITE_SCRIPT_SPANS_NODES:
       return "Keys in the script cannot span multiple nodes";
+    case DYNOMITE_PAYLOAD_TOO_LARGE:
+      return "MSET/MGET/SCAN payload too large";
     default:
       return strerror(err);
   }
@@ -329,6 +332,7 @@ static inline char *dyn_error_source(dyn_error_t err) {
     case DYNOMITE_INVALID_STATE:
     case DYNOMITE_NO_QUORUM_ACHIEVED:
     case DYNOMITE_SCRIPT_SPANS_NODES:
+    case DYNOMITE_PAYLOAD_TOO_LARGE:
       return "Dynomite:";
     case PEER_CONNECTION_REFUSE:
     case PEER_HOST_DOWN:
```

**File**: `src/proto/dyn_redis.c` (modified, +8/-6)
```diff
@@ -3030,7 +3030,9 @@ static rstatus_t redis_copy_bulk(struct msg *dst, struct msg *src, bool log) {
   }
 
   p = mbuf->pos;
-  ASSERT(*p == '$');
+  if (*p != '$') {
+    return DYNOMITE_PAYLOAD_TOO_LARGE;
+  }
   p++;
 
   if (p[0] == '-' && p[1] == '1') {
@@ -3044,7 +3046,7 @@ static rstatus_t redis_copy_bulk(struct msg *dst, struct msg *src, bool log) {
     }
     len += CRLF_LEN * 2;
     len += (p - mbuf->pos);
-  }
+  } 
   bytes = len;
 
   /* copy len bytes to dst */
@@ -3378,7 +3380,7 @@ static rstatus_t redis_append_key(struct msg *r, struct keypos *kpos_src) {
  *   +--------------------+     +---------------------+ +----+----------------+
  *   |   frag_id = 10     |     |   frag_id = 10      |     |   frag_id = 10 |
  *   |     nfrag = 3      |     |      nfrag = 0      |     |      nfrag = 0 |
- *   | frag_seq = x x x   |     |     key1, key3      |     |         key2 |
+ *   | frag_seq = x x x   |     |     key1, key3      |     |         key2   |
  *   +------------|-|-|---+     +---------------------+ +---------------------+
  *                | | |          ^    ^                          ^
  *                | \ \          |    |                          |
@@ -3506,21 +3508,21 @@ static rstatus_t redis_fragment_argx(struct msg *r, struct server_pool *pool,
       TAILQ_INSERT_TAIL(frag_msgq, sub_msg, m_tqe);
     }
 
-    status = redis_append_key(sub_msg, kpos);
+    status = redis_append_key(sub_msg, kpos); // Adds key to the sub_msg
     if (status != DN_OK) {
       dn_free(sub_msgs);
       return status;
     }
     if (key_step == 1) { // mget,del
       continue;
     } else {                                    // mset
-      status = redis_copy_bulk(NULL, r, false); // eat key
+      status = redis_copy_bulk(NULL, r, false); // Consumes key portion of the payload
       if (status != DN_OK) {
         dn_free(sub_msgs);
         return status;
       }
 
-      status = redis_copy_bulk(sub_msg, r, false);
+      status = redis_copy_bulk(sub_msg, r, false); // Consumes and copies value to the sub_msg fragment
       if (status != DN_OK) {
         dn_free(sub_msgs);
         return status;
```

---

### Incident Patch 2: `9042cde6` (2022-07-31)
**Commit Message**: Fix pip version

**File**: `.travis.yml` (modified, +4/-2)
```diff
@@ -2,11 +2,13 @@ language: c
 script: bash ./travis.sh
 
 before_install:
-  - sudo pip3 install --upgrade pip
+  - sudo apt remove --purge python3-pip
+  - curl -O https://bootstrap.pypa.io/pip/3.5/get-pip.py
+  - sudo -E python3 get-pip.py
+  - sudo -E python3 -m pip install --upgrade "pip < 22.3"
   
 addons:
   apt:
    update: true
    packages:
    - python3.9
-   - python3-pip
```

---

### Incident Patch 3: `bc78f1f9` (2022-07-19)
**Commit Message**: Fixes crash on large payloads for MGET/MSET/SCAN

Updates python version to 3.9

Updates pip version

Update travis.sh

Adds apt update before package installation

Force pip upgrade

**File**: `.travis.yml` (modified, +5/-1)
```diff
@@ -1,8 +1,12 @@
 language: c
 script: bash ./travis.sh
 
+before_install:
+  - sudo pip3 install --upgrade pip
+  
 addons:
   apt:
+   update: true
    packages:
-   - python3
+   - python3.9
    - python3-pip
```

**File**: `src/dyn_client.c` (modified, +6/-0)
```diff
@@ -1099,6 +1099,12 @@ void req_recv_done(struct context *ctx, struct conn *conn, struct msg *req,
   if (status != DN_OK) goto error;
 
   status = fragment_query_if_necessary(req, conn, &frag_msgq);
+  if (status == DYNOMITE_PAYLOAD_TOO_LARGE) {
+    dictAdd(conn->outstanding_msgs_dict, &req->id, req);
+    req->nfrag = 0; // Since we failed to fragment the payload, we don't have any fragments for this request
+    goto error;
+  }
+
   if (status != DN_OK) goto error;
 
   status = rewrite_query_with_timestamp_md(&req, ctx);
```

**File**: `src/dyn_message.h` (modified, +4/-0)
```diff
@@ -294,6 +294,7 @@ typedef enum dyn_error {
   BAD_FORMAT,
   DYNOMITE_NO_QUORUM_ACHIEVED,
   DYNOMITE_SCRIPT_SPANS_NODES,
+  DYNOMITE_PAYLOAD_TOO_LARGE,
 } dyn_error_t;
 
 static inline char *dn_strerror(dyn_error_t err) {
@@ -318,6 +319,8 @@ static inline char *dn_strerror(dyn_error_t err) {
       return "Failed to achieve Quorum";
     case DYNOMITE_SCRIPT_SPANS_NODES:
       return "Keys in the script cannot span multiple nodes";
+    case DYNOMITE_PAYLOAD_TOO_LARGE:
+      return "MSET/MGET/SCAN payload too large";
     default:
       return strerror(err);
   }
@@ -329,6 +332,7 @@ static inline char *dyn_error_source(dyn_error_t err) {
     case DYNOMITE_INVALID_STATE:
     case DYNOMITE_NO_QUORUM_ACHIEVED:
     case DYNOMITE_SCRIPT_SPANS_NODES:
+    case DYNOMITE_PAYLOAD_TOO_LARGE:
       return "Dynomite:";
     case PEER_CONNECTION_REFUSE:
     case PEER_HOST_DOWN:
```

**File**: `src/proto/dyn_redis.c` (modified, +8/-6)
```diff
@@ -3030,7 +3030,9 @@ static rstatus_t redis_copy_bulk(struct msg *dst, struct msg *src, bool log) {
   }
 
   p = mbuf->pos;
-  ASSERT(*p == '$');
+  if (*p != '$') {
+    return DYNOMITE_PAYLOAD_TOO_LARGE;
+  }
   p++;
 
   if (p[0] == '-' && p[1] == '1') {
@@ -3044,7 +3046,7 @@ static rstatus_t redis_copy_bulk(struct msg *dst, struct msg *src, bool log) {
     }
     len += CRLF_LEN * 2;
     len += (p - mbuf->pos);
-  }
+  } 
   bytes = len;
 
   /* copy len bytes to dst */
@@ -3378,7 +3380,7 @@ static rstatus_t redis_append_key(struct msg *r, struct keypos *kpos_src) {
  *   +--------------------+     +---------------------+ +----+----------------+
  *   |   frag_id = 10     |     |   frag_id = 10      |     |   frag_id = 10 |
  *   |     nfrag = 3      |     |      nfrag = 0      |     |      nfrag = 0 |
- *   | frag_seq = x x x   |     |     key1, key3      |     |         key2 |
+ *   | frag_seq = x x x   |     |     key1, key3      |     |         key2   |
  *   +------------|-|-|---+     +---------------------+ +---------------------+
  *                | | |          ^    ^                          ^
  *                | \ \          |    |                          |
@@ -3506,21 +3508,21 @@ static rstatus_t redis_fragment_argx(struct msg *r, struct server_pool *pool,
       TAILQ_INSERT_TAIL(frag_msgq, sub_msg, m_tqe);
     }
 
-    status = redis_append_key(sub_msg, kpos);
+    status = redis_append_key(sub_msg, kpos); // Adds key to the sub_msg
     if (status != DN_OK) {
       dn_free(sub_msgs);
       return status;
     }
     if (key_step == 1) { // mget,del
       continue;
     } else {                                    // mset
-      status = redis_copy_bulk(NULL, r, false); // eat key
+      status = redis_copy_bulk(NULL, r, false); // Consumes key portion of the payload
       if (status != DN_OK) {
         dn_free(sub_msgs);
         return status;
       }
 
-      status = redis_copy_bulk(sub_msg, r, false);
+      status = redis_copy_bulk(sub_msg, r, false); // Consumes and copies value to the sub_msg fragment
       if (status != DN_OK) {
         dn_free(sub_msgs);
         return status;
```

---

### Incident Patch 4: `6ff2ddd6` (2021-01-19)
**Commit Message**: Merge pull request #777 from smukil/fix_frag_cmds

Fragmented queries silently fail cross-region replication

**File**: `src/dyn_client.c` (modified, +2/-0)
```diff
@@ -235,6 +235,8 @@ static void client_close(struct context *ctx, struct conn *conn) {
  */
 static rstatus_t client_handle_response(struct context *ctx, struct conn *conn, msgid_t reqid,
                                         struct msg *rsp) {
+
+
   // now the handler owns the response.
   ASSERT(conn->type == CONN_CLIENT);
   // Fetch the original request
```

**File**: `src/dyn_mbuf.c` (modified, +2/-0)
```diff
@@ -35,6 +35,8 @@ static uint64_t mbuf_alloc_count = 0;
 
 uint64_t mbuf_alloc_get_count(void) { return mbuf_alloc_count; }
 
+size_t mbuf_chunk_sz() { return mbuf_chunk_size; }
+
 static struct mbuf *_mbuf_get(void) {
   struct mbuf *mbuf;
   uint8_t *buf;
```

**File**: `src/dyn_mbuf.h` (modified, +2/-0)
```diff
@@ -65,6 +65,8 @@ static inline bool mbuf_full(struct mbuf *mbuf) {
   return mbuf->last == mbuf->end ? true : false;
 }
 
+size_t mbuf_chunk_sz();
+
 void mbuf_init(size_t mbuf_chunk_size);
 void mbuf_deinit(void);
 struct mbuf *mbuf_get(void);
```

**File**: `src/proto/dyn_redis.c` (modified, +79/-49)
```diff
@@ -3053,7 +3053,19 @@ static rstatus_t redis_copy_bulk(struct msg *dst, struct msg *src, bool log) {
       log_notice("dumping mbuf");
       mbuf_dump(mbuf);
     }
-    if (mbuf_length(mbuf) <= len) { /* steal this buf from src to dst */
+
+    size_t remaining_mbuf_len = mbuf_length(mbuf);
+    if (remaining_mbuf_len <= len &&
+        remaining_mbuf_len == mbuf_chunk_sz()) {
+      // Steal the entire buffer from src to dst if we need the whole buffer
+      //
+      // We only copy if it's the entire buffer because of the way our
+      // encryption/decryption works. Sending out multiple partially filled
+      // mbufs will fail to decrypt on the receiving side. This is because
+      // in the source side we encrypt each mbuf seperately but if all the
+      // partial mbufs can fit into one full mbuf on the receiving side,
+      // it will do so and hence fail to decrypt.
+      // TODO: Change this when the whole broken crypto scheme is changed.
       nbuf = STAILQ_NEXT(mbuf, next);
       mbuf_remove(&src->mhdr, mbuf);
       if (dst != NULL) {
@@ -3419,33 +3431,90 @@ static rstatus_t redis_fragment_argx(struct msg *r, struct server_pool *pool,
   r->nfrag = 0;
   r->frag_owner = r;
 
-  for (i = 0; i < array_n(r->keys); i++) { /* for each key */
-    struct msg *sub_msg;
+  // Calculate number of tokens per participating peer.
+  // We need to know the total number of tokens before proceeding with
+  // crafting each peer's command since we're trying to fit as much as
+  // possible into one MBUF and not split them for convenience.
+  // TODO: This is the case because of our broken crypto scheme. Change once
+  // that is fixed.
+  for (i = 0; i < array_n(r->keys); i++) {
     struct keypos *kpos = array_get(r->keys, i);
     // use hash-tagged start and end for forwarding.
     uint32_t idx = dnode_peer_idx_for_key_on_rack(
         pool, rack, kpos->tag_start, kpos->tag_end - kpos->tag_start);
-
     if (sub_msgs[idx] == NULL) {
       sub_msgs[idx] = msg_get(r->owner, r->is_request, __FUNCTION__);
       if (sub_msgs[idx] == NULL) {
         dn_free(sub_msgs);
         return DN_ENOMEM;
       }
+
+      // Every 'sub_msg' is counted as one fragment.
+      r->nfrag++;
+    }
+
+    // One token for the key
+    sub_msgs[idx]->ntokens++;
+
+    // One token for the value (eg: for MSET)
+    if (key_step != 1) sub_msgs[idx]->ntokens++;
+    r->frag_seq[i] = sub_msgs[idx];
+
+    loga("frag_seq[%d]: %x   ||  idx: %d sub_msgs[idx]: %x", i,
+        r->frag_seq[i], idx, sub_msgs[idx]);
+
+  }
+
+  for (i = 0; i < array_n(r->keys); i++) { /* for each key */
+    struct msg *sub_msg;
+    struct keypos *kpos = array_get(r->keys, i);
+    // use hash-tagged start and end for forwarding.
+    uint32_t idx = dnode_peer_idx_for_key_on_rack(
+        pool, rack, kpos->tag_start, kpos->tag_end - kpos->tag_start);
+
+    // We already created the 'sub_msg' in the previous loop.
+    ASSERT(sub_msgs[idx] != NULL);
+    sub_msg = sub_msgs[idx];
+
+    if (STAILQ_EMPTY(&sub_msg->mhdr)) {
+      if (r->type == MSG_REQ_REDIS_MGET) {
+        status = msg_prepend_format(sub_msg, "*%d\r\n$4\r\nmget\r\n",
+                                    sub_msg->ntokens + 1);
+      } else if (r->type == MSG_REQ_REDIS_DEL) {
+        status = msg_prepend_format(sub_msg, "*%d\r\n$3\r\ndel\r\n",
+                                    sub_msg->ntokens + 1);
+      } else if (r->type == MSG_REQ_REDIS_EXISTS) {
+        status = msg_prepend_format(sub_msg, "*%d\r\n$6\r\nexists\r\n",
+                                    sub_msg->ntokens + 1);
+      } else if (r->type == MSG_REQ_REDIS_MSET) {
+        status = msg_prepend_format(sub_msg, "*%d\r\n$4\r\nmset\r\n",
+                                    sub_msg->ntokens + 1);
+      } else {
+        NOT_REACHED();
+      }
+      if (status != DN_OK) {
+        dn_free(sub_msgs);
+        return status;
+      }
+
+      sub_msg->type = r->type;
+      sub_msg->frag_id = r->frag_id;
+      sub_msg->frag_owner = r->frag_owner;
+      sub_msg->is_read = r->is_read;
+
+      log_info("Fragment %d) %s", i, print_obj(sub_msg));
+      TAILQ_INSERT_TAIL(frag_msgq, sub_msg, m_tqe);
     }
-    r->frag_seq[i] = sub_msg = sub_msgs[idx];
 
-    sub_msg->ntokens++;
     status = redis_append_key(sub_msg, kpos);
     if (status != DN_OK) {
       dn_free(sub_msgs);
       return status;
     }
-
-    if (key_step == 1) { /* mget,del */
+    if (key_step == 1) { // mget,del
       continue;
-    } else {                                    /* mset */
-      status = redis_copy_bulk(NULL, r, false); /* eat key */
+    } else {                                    // mset
+      status = redis_copy_bulk(NULL, r, false); // eat key
       if (status != DN_OK) {
         dn_free(sub_msgs);
         return status;
@@ -3456,47 +3525,8 @@ static rstatus_t redis_fragment_argx(struct msg *r, struct server_pool *pool,
         dn_free(sub_msgs);
         return status;
       }
-
-      sub_msg->ntokens++;

```

---

### Incident Patch 5: `3f5c823a` (2021-01-19)
**Commit Message**: Merge branch 'dev' into fix_frag_cmds

**File**: `README.md` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@
 
 # Dynomite 
 
-[![Build Status](https://secure.travis-ci.org/Netflix/dynomite.png)](http://travis-ci.org/Netflix/dynomite)
+[![Build Status](https://travis-ci.com/Netflix/dynomite.svg)](http://travis-ci.com/Netflix/dynomite)
 [![Dev chat at https://gitter.im/Netflix/dynomite](https://badges.gitter.im/Netflix/dynomite.svg)](https://gitter.im/Netflix/dynomite?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)
 [![Apache V2 License](http://img.shields.io/badge/license-Apache%20V2-blue.svg)](https://github.com/Netflix/dynomite/blob/dev/LICENSE)
 
```

---

### Incident Patch 6: `c3aa5bae` (2020-11-02)
**Commit Message**: Update build status location

**File**: `README.md` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@
 
 # Dynomite 
 
-[![Build Status](https://secure.travis-ci.org/Netflix/dynomite.svg)](http://travis-ci.org/Netflix/dynomite)
+[![Build Status](https://travis-ci.com/Netflix/dynomite.svg)](http://travis-ci.com/Netflix/dynomite)
 [![Dev chat at https://gitter.im/Netflix/dynomite](https://badges.gitter.im/Netflix/dynomite.svg)](https://gitter.im/Netflix/dynomite?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)
 [![Apache V2 License](http://img.shields.io/badge/license-Apache%20V2-blue.svg)](https://github.com/Netflix/dynomite/blob/dev/LICENSE)
 
```

---

### Incident Patch 7: `5398600d` (2019-11-20)
**Commit Message**: Merge pull request #745 from smukil/fix_hdel_repair_script

Replicas shouldn't update top level rem-set on final field delete

**File**: `src/proto/dyn_proto_repair.h` (modified, +1/-2)
```diff
@@ -211,7 +211,7 @@
   "  return ret\n"\
   "end\n\r\n"
 
-#define HDEL_SCRIPT "$4\r\nEVAL\r\n$1175\r\n"\
+#define HDEL_SCRIPT "$4\r\nEVAL\r\n$1122\r\n"\
   "local key = KEYS[1]\n"\
   "local top_level_add_set = KEYS[2]\n"\
   "local top_level_rem_set = KEYS[3]\n"\
@@ -248,7 +248,6 @@
   "end\n\n"\
   "local card = redis.call('ZCARD', rem_set)\n"\
   "if (card == 0) then\n"\
-  "  redis.call('ZADD', top_level_add_set, cur_ts, key)\n"\
   "  redis.call('ZREM', top_level_rem_set, key)\n"\
   "end\n\n"\
   "return ret\n\r\n"
```

---

### Incident Patch 8: `8464a609` (2019-11-04)
**Commit Message**: Merge pull request #740 from smukil/in_flight_nonrepairable_crash_fix

Turning on repairs shouldn't invoke repairs for in-flight queries

**File**: `src/proto/dyn_redis_repair.c` (modified, +4/-0)
```diff
@@ -867,6 +867,10 @@ rstatus_t redis_make_repair_query(struct context *ctx, struct response_mgr *rspm
   bool repair_by_add = false;
   uint32_t num_values = 0;
 
+  // If we enabled read repairs halfway, in flight commands will not be
+  // repairable.
+  if (rspmgr->msg->orig_msg == NULL) return DN_OK;
+
   // Redis commands either lookup keys or fields (secondary keys), so the number of
   // expected values would be based on either one of them.
   if (rspmgr->msg->orig_msg->msg_info.num_fields > 0) {
```

---

### Incident Patch 9: `b394564f` (2019-10-31)
**Commit Message**: Merge pull request #736 from smukil/fix_bad_return_each_quorum

Multiple rspmgrs get assigned the same DC name under DC_EACH_SAFE_QUORUM

**File**: `src/dyn_response_mgr.c` (modified, +1/-1)
```diff
@@ -24,13 +24,13 @@ rstatus_t init_response_mgr_all_dcs(struct context *ctx, struct msg *req,
   // Initialize the response managers for all remote DCs. (The 0th idx in the
   // 'additional_each_rspmgrs' array is reserved for the local DC).
   int i;
+  uint32_t dc_idx = 0;
   for (i = 1; i < num_dcs_in_quorum; ++i) {
     req->additional_each_rspmgrs[i] = (struct rspmgr*) dn_alloc(sizeof(struct response_mgr));
     if (req->additional_each_rspmgrs[i] == NULL) {
       goto enomem;
     }
 
-    uint32_t dc_idx = 0;
     struct datacenter *remote_dc = NULL;
     do {
       remote_dc = (struct datacenter*) array_get(&ctx->pool.datacenters, dc_idx);
```

---

### Incident Patch 10: `1687c38c` (2019-10-22)
**Commit Message**: Add ownership information for dnode_peer/server errors and fix cross-DC checksum logic

When we hit an error trying to connect to a dnode peer or a server,
we create an appropriate error message but don't link the respective
connection to the error response 'msg'. This is necessary at least for
processing DC_EACH_SAFE_QUORUM responses.

Also, checksums for cross-DC messages were not done properly since
msg_payload_crc32() only accounted for intra-DC messages. More explained
in code comments.

**File**: `src/dyn_client.c` (modified, +5/-1)
```diff
@@ -1230,6 +1230,7 @@ static struct msg *all_rspmgrs_get_response(struct context *ctx, struct msg *req
       continue;
     } else {
       ASSERT(rsp->is_error == false);
+
       // If the DCs we've processed so far have not seen errors, we need to
       // make sure that the remaining DCs don't have errors too.
       dc_rsp = rspmgr_get_response(ctx, rspmgr);
@@ -1259,11 +1260,14 @@ static struct msg *all_rspmgrs_get_response(struct context *ctx, struct msg *req
 static rstatus_t msg_each_quorum_rsp_handler(struct context *ctx, struct msg *req,
     struct msg *rsp) {
 
-  if (all_rspmgrs_done(ctx, req->additional_each_rspmgrs)) return swallow_extra_rsp(req, rsp);
+  if (all_rspmgrs_done(ctx, req->additional_each_rspmgrs)) {
+    return swallow_extra_rsp(req, rsp);
+  }
 
   int rspmgr_idx = -1;
   struct conn *rsp_conn = rsp->owner;
   if (rsp_conn == NULL) {
+    // TODO: We should remove this case. Test and confirm.
     rspmgr_idx = 0;
   } else if (rsp_conn->type == CONN_DNODE_PEER_SERVER) {
     struct node *peer_instance = (struct node*) rsp_conn->owner;
```

**File**: `src/dyn_dnode_peer.c` (modified, +1/-0)
```diff
@@ -316,6 +316,7 @@ static void dnode_peer_ack_err(struct context *ctx, struct conn *conn,
   rsp->dyn_error_code = req->dyn_error_code = PEER_CONNECTION_REFUSE;
   rsp->dmsg = dmsg_get();
   rsp->dmsg->id = req->id;
+  rsp->owner = conn;
 
   log_info("%s Closing req %u:%u len %" PRIu32 " type %d %c %s",
            print_obj(conn), req->id, req->parent_id, req->mlen, req->type,
```

**File**: `src/dyn_message.c` (modified, +5/-0)
```diff
@@ -833,6 +833,11 @@ uint32_t msg_payload_crc32(struct msg *rsp) {
      the beginning of the first mbuf */
   bool start_found = rsp->dmsg ? false : true;
 
+  // If the message is from another DC, the mbufs will have the decrypted
+  // payload without the Dynomite header, so we do have the start.
+  // rsp->dmsg->payload for cross DC msgs will have the encrypted payload.
+  if (rsp->dmsg && !rsp->owner->same_dc) start_found = true;
+
   STAILQ_FOREACH(mbuf, &rsp->mhdr, next) {
     uint8_t *start = mbuf->start;
     uint8_t *end = mbuf->last;
```

**File**: `src/dyn_server.c` (modified, +1/-0)
```diff
@@ -197,6 +197,7 @@ static void server_ack_err(struct context *ctx, struct conn *conn,
   rsp->error_code = req->error_code = conn->err;
   rsp->dyn_error_code = req->dyn_error_code = STORAGE_CONNECTION_REFUSE;
   rsp->dmsg = NULL;
+  rsp->owner = conn;
   log_debug(LOG_DEBUG, "%s <-> %s", print_obj(req), print_obj(rsp));
 
   log_info("close %s req %s len %" PRIu32 " from %s %c %s", print_obj(conn),
```

---

### Incident Patch 11: `46c73f71` (2019-10-20)
**Commit Message**: Merge pull request #729 from smukil/proper_quit_cmd_support

Support the Redis "QUIT" command properly

**File**: `src/dyn_client.c` (modified, +5/-1)
```diff
@@ -365,9 +365,13 @@ static bool req_filter(struct context *ctx, struct conn *conn,
   if (req->quit) {
     ASSERT(conn->rmsg == NULL);
     log_debug(LOG_VERB, "%s filter quit %s", print_obj(conn), print_obj(req));
+
+    // The client expects to receive an "+OK\r\n" response, so make sure
+    // to do that.
+    IGNORE_RET_VAL(simulate_ok_rsp(ctx, conn, req));
+
     conn->eof = 1;
     conn->recv_ready = 0;
-    req_put(req);
     return true;
   }
 
```

**File**: `src/dyn_message.c` (modified, +20/-14)
```diff
@@ -923,7 +923,7 @@ static rstatus_t msg_repair(struct context *ctx, struct conn *conn,
  *
  * Returns a 'msg' with the expected success response.
  */
-static struct msg *simulate_ok_rsp(struct context *ctx, struct conn *conn,
+static struct msg *craft_ok_rsp(struct context *ctx, struct conn *conn,
     struct msg *req) {
 
   ASSERT(req->is_request);
@@ -951,6 +951,24 @@ static struct msg *simulate_ok_rsp(struct context *ctx, struct conn *conn,
   return rsp;
 }
 
+rstatus_t simulate_ok_rsp(struct context *ctx, struct conn *conn,
+    struct msg *msg) {
+  // Create an OK response.
+  struct msg *ok_rsp = craft_ok_rsp(ctx, conn, msg);
+
+  // Add it to the outstanding messages dictionary, so that 'conn_handle_response'
+  // can process it appropriately.
+  dictAdd(conn->outstanding_msgs_dict, &msg->id, msg);
+
+  // Enqueue the message in the outbound queue so that the code on the response
+  // path can find it.
+  conn_enqueue_outq(ctx, conn, msg);
+
+  THROW_STATUS(conn_handle_response(ctx, conn,
+      msg->parent_id ? msg->parent_id : msg->id, ok_rsp));
+
+  return DN_OK;
+}
 
 /*
  * If the command sent to Dynomite was a special Dynomite configuration
@@ -979,19 +997,7 @@ static rstatus_t msg_apply_config(struct context *ctx, struct conn *conn,
   // Set the consistency to DC_ONE, since this is just a configuration setting.
   msg->consistency = DC_ONE;
 
-  // Create an OK response.
-  struct msg *ok_rsp = simulate_ok_rsp(ctx, conn, msg);
-
-  // Add it to the outstanding messages dictionary, so that 'conn_handle_response'
-  // can process it appropriately.
-  dictAdd(conn->outstanding_msgs_dict, &msg->id, msg);
-
-  // Enqueue the message in the outbound queue so that the code on the response
-  // path can find it.
-  conn_enqueue_outq(ctx, conn, msg);
-
-  THROW_STATUS(conn_handle_response(ctx, conn,
-      msg->parent_id ? msg->parent_id : msg->id, ok_rsp));
+  THROW_STATUS(simulate_ok_rsp(ctx, conn, msg));
 
   return DN_OK;
 }
```

**File**: `src/dyn_message.h` (modified, +10/-0)
```diff
@@ -641,6 +641,16 @@ rstatus_t dnode_peer_req_forward(struct context *ctx, struct conn *c_conn,
 void dnode_peer_gossip_forward(struct context *ctx, struct conn *conn,
                                struct mbuf *data);
 
+/*
+ * Simulates a successful response as though the datastore sent it.
+ * Also, does the necessary to make sure that the response path is
+ * able to send this response back to the client.
+ *
+ * Returns DN_OK on success and an appropriate error otherwise.
+ */
+rstatus_t simulate_ok_rsp(struct context *ctx, struct conn *conn,
+    struct msg *msg);
+
 // Returns 'true' if 'msg_type' is a Dynomite configuration command.
 bool is_msg_type_dyno_config(msg_type_t msg_type);
 
```

---

### Incident Patch 12: `24f32547` (2019-10-20)
**Commit Message**: Support the Redis "QUIT" command properly

The QUIT command so far was handled by just closing the connection on
the server side and did not respect the contract of the QUIT command.

The Redis documentation states that the QUIT command must return
"+OK\r\n" back to the client so that the client can close the connection
on its side.

This patch takes advantage of simulating a datastore response from the
previous patch to achieve this.

**File**: `src/dyn_client.c` (modified, +5/-1)
```diff
@@ -365,9 +365,13 @@ static bool req_filter(struct context *ctx, struct conn *conn,
   if (req->quit) {
     ASSERT(conn->rmsg == NULL);
     log_debug(LOG_VERB, "%s filter quit %s", print_obj(conn), print_obj(req));
+
+    // The client expects to receive an "+OK\r\n" response, so make sure
+    // to do that.
+    IGNORE_RET_VAL(simulate_ok_rsp(ctx, conn, req));
+
     conn->eof = 1;
     conn->recv_ready = 0;
-    req_put(req);
     return true;
   }
 
```

**File**: `src/dyn_message.c` (modified, +20/-14)
```diff
@@ -923,7 +923,7 @@ static rstatus_t msg_repair(struct context *ctx, struct conn *conn,
  *
  * Returns a 'msg' with the expected success response.
  */
-static struct msg *simulate_ok_rsp(struct context *ctx, struct conn *conn,
+static struct msg *craft_ok_rsp(struct context *ctx, struct conn *conn,
     struct msg *req) {
 
   ASSERT(req->is_request);
@@ -951,6 +951,24 @@ static struct msg *simulate_ok_rsp(struct context *ctx, struct conn *conn,
   return rsp;
 }
 
+rstatus_t simulate_ok_rsp(struct context *ctx, struct conn *conn,
+    struct msg *msg) {
+  // Create an OK response.
+  struct msg *ok_rsp = craft_ok_rsp(ctx, conn, msg);
+
+  // Add it to the outstanding messages dictionary, so that 'conn_handle_response'
+  // can process it appropriately.
+  dictAdd(conn->outstanding_msgs_dict, &msg->id, msg);
+
+  // Enqueue the message in the outbound queue so that the code on the response
+  // path can find it.
+  conn_enqueue_outq(ctx, conn, msg);
+
+  THROW_STATUS(conn_handle_response(ctx, conn,
+      msg->parent_id ? msg->parent_id : msg->id, ok_rsp));
+
+  return DN_OK;
+}
 
 /*
  * If the command sent to Dynomite was a special Dynomite configuration
@@ -979,19 +997,7 @@ static rstatus_t msg_apply_config(struct context *ctx, struct conn *conn,
   // Set the consistency to DC_ONE, since this is just a configuration setting.
   msg->consistency = DC_ONE;
 
-  // Create an OK response.
-  struct msg *ok_rsp = simulate_ok_rsp(ctx, conn, msg);
-
-  // Add it to the outstanding messages dictionary, so that 'conn_handle_response'
-  // can process it appropriately.
-  dictAdd(conn->outstanding_msgs_dict, &msg->id, msg);
-
-  // Enqueue the message in the outbound queue so that the code on the response
-  // path can find it.
-  conn_enqueue_outq(ctx, conn, msg);
-
-  THROW_STATUS(conn_handle_response(ctx, conn,
-      msg->parent_id ? msg->parent_id : msg->id, ok_rsp));
+  THROW_STATUS(simulate_ok_rsp(ctx, conn, msg));
 
   return DN_OK;
 }
```

**File**: `src/dyn_message.h` (modified, +10/-0)
```diff
@@ -641,6 +641,16 @@ rstatus_t dnode_peer_req_forward(struct context *ctx, struct conn *c_conn,
 void dnode_peer_gossip_forward(struct context *ctx, struct conn *conn,
                                struct mbuf *data);
 
+/*
+ * Simulates a successful response as though the datastore sent it.
+ * Also, does the necessary to make sure that the response path is
+ * able to send this response back to the client.
+ *
+ * Returns DN_OK on success and an appropriate error otherwise.
+ */
+rstatus_t simulate_ok_rsp(struct context *ctx, struct conn *conn,
+    struct msg *msg);
+
 // Returns 'true' if 'msg_type' is a Dynomite configuration command.
 bool is_msg_type_dyno_config(msg_type_t msg_type);
 
```

---

### Incident Patch 13: `7747c05c` (2019-10-16)
**Commit Message**: Merge pull request #721 from smukil/fix_msg_leak_for_each_safe_quorum

Fix msg leak with DC_EACH_SAFE_QUORUM

**File**: `src/dyn_client.c` (modified, +2/-4)
```diff
@@ -655,10 +655,8 @@ rstatus_t req_forward_to_peer(struct context *ctx, struct conn *c_conn,
   }
 
   if (!(same_dc && same_rack) || force_swallow) {
-    if (req->consistency != DC_EACH_SAFE_QUORUM || force_swallow) {
-      // Swallow responses from remote racks or DCs.
-      rack_msg->swallow = true;
-    }
+    // Swallow responses from remote racks or DCs.
+    rack_msg->swallow = true;
   }
 
   // Get a connection to the node.
```

---

### Incident Patch 14: `4997f265` (2019-10-16)
**Commit Message**: Fix msg leak with DC_EACH_SAFE_QUORUM

It turns out that the 'swallow' field in 'struct msg' is used in
more ways than just swallowing. It also is required to basically
free any cross rack and cross DC message even though we don't want
to swallow it. And alternate methods are used to check if we should
swallow a 'msg' or not. For example, checking in multiple places if
the response is from the same DC or not and swallowing accordingly
which attributes multiple purposes to the 'swallow' field and gets
very confusing.

This incorrect use of 'swallow' has made it hard to create any new
reasonable feature without breaking a bunch of things. This fix makes
sure we don't leak msgs while using DC_EACH_SAFE_QUORUM. Even
though we don't want to swallow the responses across DCs under
DC_EACH_SAFE_QUORUM, we have to mark it as 'swallow = true' just to
have it freed in the response path.

All of this needs to be rewritten since the codebase is basically a
house of cards.

**File**: `src/dyn_client.c` (modified, +2/-4)
```diff
@@ -655,10 +655,8 @@ rstatus_t req_forward_to_peer(struct context *ctx, struct conn *c_conn,
   }
 
   if (!(same_dc && same_rack) || force_swallow) {
-    if (req->consistency != DC_EACH_SAFE_QUORUM || force_swallow) {
-      // Swallow responses from remote racks or DCs.
-      rack_msg->swallow = true;
-    }
+    // Swallow responses from remote racks or DCs.
+    rack_msg->swallow = true;
   }
 
   // Get a connection to the node.
```

---

### Incident Patch 15: `f2a4f23d` (2019-10-09)
**Commit Message**: Merge pull request #710 from kjlaw89/memleakFix

Fixes msg memory leak

**File**: `src/dyn_message.c` (modified, +5/-0)
```diff
@@ -632,6 +632,11 @@ void msg_put(struct msg *msg) {
     msg->keys = NULL;
   }
 
+  if (msg->args) {
+    array_destroy(msg->args);
+    msg->args = NULL;
+  }
+
   if (msg->orig_msg) {
     msg_put(msg->orig_msg);
     msg->orig_msg = NULL;
```

#### Recent Merged Pull Requests:
- **PR #832** (closed): dyn_client: fix 'occured' -> 'occurred' typos in rewrite helper comments (@SAY-5)
- **PR #811** (closed): Fixes crash on large payloads for MGET/MSET/SCAN (@akashdeepgoel)
- **PR #809** (2022-10-03): Fixes crash on large payloads for MGET/MSET/SCAN (@akashdeepgoel)
- **PR #787** (2021-01-20): Update v0.6 branch with latest fixes/improvements (@smukil)
- **PR #786** (2021-01-20): Allow logs to be read by others (@smukil)
- **PR #785** (2021-01-19): Add log level for dyn_crypto hex dumps (@bryanck)
- **PR #783** (2020-11-17): Update build status location (@sghill)
- **PR #777** (2021-01-19): Fragmented queries silently fail cross-region replication (@smukil)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

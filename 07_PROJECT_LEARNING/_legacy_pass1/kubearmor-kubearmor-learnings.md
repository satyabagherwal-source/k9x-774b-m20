# Forensic Learning Record (Deep Inspection): kubearmor/KubeArmor

> **Canonical Artifact**: `07_PROJECT_LEARNING/kubearmor-kubearmor-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/kubearmor/KubeArmor](https://github.com/kubearmor/KubeArmor))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:30:01.099Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `kubearmor/KubeArmor`
- **Description**: Runtime Security Enforcement System. Workload hardening/sandboxing and implementing least-permissive policies made easy leveraging LSMs (LSM-BPF, AppArmor).
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: README.md, Dockerfile
- **Stars / Engagement**: 2623 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `KubeArmor/BPF/anonmapexec.bpf.c`
```
// +build ignore
/* SPDX-License-Identifier: GPL-2.0 */
/* Copyright 2026 Authors of KubeArmor */

#include "shared.h"

#define PROT_EXEC 0x4  /* page can be executed */
#define MAP_ANONYMOUS 0x20
#define MAP_ANON MAP_ANONYMOUS

#define S_IFIFO 0010000

struct {
  __uint(type, BPF_MAP_TYPE_RINGBUF);
  __uint(max_entries, 1 << 24);
} events SEC(".maps");

typedef struct {
  u64 ts;

  u32 pid_id;
  u32 mnt_id;

  u32 host_ppid;
  u32 host_pid;

  u32 ppid;
  u32 pid;
  u32 uid;

  u32 event_id;
  s64 retval;

  u8 comm[TASK_COMM_LEN];

  unsigned long args[6];
} mmap_event;

static __always_inline u32 init_mmap_context(mmap_event *event_data) {
  struct task_struct *task = (struct task_struct *)bpf_get_current_task();

  event_data->ts = bpf_ktime_get_ns();

  event_data->host_ppid = get_task_ppid(task);
  event_data->host_pid = bpf_get_current_pid_tgid() >> 32;

  u32 pid = get_task_ns_tgid(task);
  if (event_data->host_pid == pid) { // host
    event_data->pid_id = 0;
    event_data->mnt_id = 0;

    event_data->ppid = get_task_ppid(task);
    event_data->pid = bpf_get_current_pid_tgid() >> 32;
  } else { // container
    event_data->pid_id = get_task_pid_ns_id(task);
    event_data->mnt_id = get_task_mnt_ns_id(task);

    event_data->ppid = get_task_ns_ppid(task);
    event_data->pid = pid;
  }

  event_data->uid = bpf_get_current_uid_gid();

  // Clearing array to avoid garbage values
  __builtin_memset(event_data->comm, 0, sizeof(event_data->comm));
  bpf_get_current_comm(&event_data->comm, sizeof(event_data->comm));

  return 0;
}


// Force emitting struct mmap_event into the ELF.
const mmap_event *unused __attribute__((unused));

struct preset_map kubearmor_anon_map_exec_preset_containers SEC(".maps");


SEC("lsm/mmap_file")
int BPF_PROG(enforce_mmap_file, struct file *file, unsigned long reqprot,
	 unsigned long prot, unsigned long flags){

  struct task_struct *t = (struct task_struct *)bpf_get_current_task();

  struct outer_key okey;
  get_outer_key(&okey, t);

  u32 *present = bpf_map_lookup_elem(&kubearmor_anon_map_exec_preset_containers, &okey);

  if (!present) {
    return 0;
  }

  // only if PROT_EXEC is assigned
  if (prot & PROT_EXEC) {
    if (flags & MAP_ANONYMOUS) {
      mmap_event *event_data;
      event_data = bpf_ringbuf_reserve(&events, sizeof(mmap_event), 0);

      if (!event_data) {
      return 0;
      }

      init_mmap_context(event_data);

      __builtin_memset(event_data->args, 0, sizeof(event_data->args));

      event_data->args[0] = reqprot;
      event_data->args[1] = prot;
      event_data->args[2] = flags;
      event_data->event_id = ANON_MAP_EXEC;
      if (*present == BLOCK) {
        event_data->retval = -EPERM;
      } else {
        event_data->retval = 0;
      }
      bpf_ringbuf_submit(event_data, 0);
      // mapping not backed by any file with executable permission, denying mapping
      if (*present == BLOCK) {
        return -EPERM;
      } else {
        return 0;
      }
    }
  }
  return 0;
}
```

### Core Architecture Module: `KubeArmor/BPF/arg_matching_helpers.h`
```
/* SPDX-License-Identifier: GPL-2.0 */
/* Copyright 2024 Authors of KubeArmor */
/* This module contains the common structures shared by lsm and system monitor*/
#include "common_types.h"
#ifndef __ARG_MATCHING_HELPERS_H
#define __ARG_MATCHING_HELPERS_H
#define MAX_ENTRIES 10240
#define MAX_ARGUMENT_SIZE 104
// #define MAX_PATH_SIZE 256

// struct for argument string
struct argVal
{
    char argsArray[MAX_ARGUMENT_SIZE];
};

// key for kubearmor_args_store map (tgid + argument index)
struct cmd_args_key
{
    u64 tgid;
    u64 ind;
};

// map to store arguments for a process
struct
{
    __uint(type, BPF_MAP_TYPE_LRU_HASH);
    __uint(max_entries, MAX_ENTRIES);
    __type(key, struct cmd_args_key);
    __type(value, struct argVal);
    __uint(pinning, LIBBPF_PIN_BY_NAME);
} kubearmor_args_store SEC(".maps");

// map to store argument string -- created to avoid memory overflow in verifier
struct
{
    __uint(type, BPF_MAP_TYPE_PERCPU_ARRAY);
    __uint(max_entries, 1);
    __type(key, u32);
    __type(value, struct argVal); // Store the args in this struct
} cmd_args_buf SEC(".maps");

#endif /* __ARG_MATCHING_HELPERS_H */
```

### Core Architecture Module: `KubeArmor/BPF/common_types.h`
```
#ifndef _COMMON_TYPES_H
#define _COMMON_TYPES_H

struct outer_key
{
    u32 pid_ns;
    u32 mnt_ns;
};

#endif // _COMMON_TYPES_H
```

### Core Architecture Module: `KubeArmor/BPF/enforcer.bpf.c`
```
// +build ignore
/* SPDX-License-Identifier: GPL-2.0    */
/* Copyright 2026 Authors of KubeArmor */

#include "shared.h"
#include "syscalls.h"
#include "arg_matching_helpers.h"
#include <bpf/bpf_endian.h>

SEC("lsm/bprm_check_security")
int BPF_PROG(enforce_proc, struct linux_binprm *bprm, int ret)
{
  struct task_struct *t = (struct task_struct *)bpf_get_current_task();
  event *task_info;
  int retval = ret;

  // no of arguments
  unsigned int num_of_args = BPF_CORE_READ(bprm, argc);
  bool argmatch = false;

  bool match = false;

  struct outer_key okey;
  get_outer_key(&okey, t);

  u32 *inner = bpf_map_lookup_elem(&kubearmor_containers, &okey);

  if (!inner)
  {
    return 0;
  }

  u32 zero = 0;
  bufs_k *z = bpf_map_lookup_elem(&bufk, &zero);
  if (z == NULL)
    return 0;

  u32 one = 1;
  bufs_k *store = bpf_map_lookup_elem(&bufk, &one);
  if (store == NULL)
    return 0;

  bpf_map_update_elem(&bufk, &one, z, BPF_ANY);

  u32 two = 2;
  bufs_k *pk = bpf_map_lookup_elem(&bufk, &two);
  if (pk == NULL)
    return 0;

  // Extract full path from file structure provided by LSM Hook
  bufs_t *path_buf = get_buf(PATH_BUFFER);
  if (path_buf == NULL)
    return 0;
  struct path f_path = BPF_CORE_READ(bprm->file, f_path);
  if (!prepend_path(&f_path, path_buf))
    return 0;

  u32 *path_offset = get_buf_off(PATH_BUFFER);
  if (path_offset == NULL)
    return 0;

  u32 path_off = 0;
  if (!valid_buf_and_off(path_buf, path_offset, &path_off))
    return 0;

  void *path_ptr = &path_buf->buf[path_off];
  if (!path_ptr)
    return 0;

  bpf_probe_read_str(store->path, MAX_STRING_SIZE, path_ptr);

  struct data_t *val = bpf_map_lookup_elem(inner, store);
  struct data_t *dirval = NULL;
  bool recursivebuthint = false;
  bool fromSourceCheck = true;
  bool goToDecision = false;

  // Extract full path of the source binary from the parent task structure
  struct task_struct *parent_task = BPF_CORE_READ(t, parent);
  struct file *file_p = get_task_file(parent_task);
  if (file_p == NULL)
    fromSourceCheck = false;
  bufs_t *src_buf = get_buf(PATH_BUFFER);
  if (src_buf == NULL)
    fromSourceCheck = false;
  if (fromSourceCheck)
  {
    struct path f_src = BPF_CORE_READ(file_p, f_path);
    if (!prepend_path(&f_src, src_buf))
      fromSourceCheck = false;
  }

  u32 *src_offset = get_buf_off(PATH_BUFFER);
  if (src_offset == NULL)
    fromSourceCheck = false;

  void *src_ptr = NULL;

  if (fromSourceCheck)
  {
    u32 src_off = 0;

    if (!valid_buf_and_off(src_buf, src_offset, &src_off))
    {
      fromSourceCheck = false;
    }
    else
    {
      src_ptr = &src_buf->buf[src_off];
      if (!src_ptr)
        fromSourceCheck = false;
    }
  }

  if (fromSourceCheck)
  {
    bpf_probe_read_str(store->source, MAX_STRING_SIZE, src_ptr);

    val = bpf_map_lookup_elem(inner, store);
    if (val && (val->processmask & RULE_EXEC))
    {
      match = true;
      goto decision;
    }

#pragma unroll
    for (int i = 0; i < 64; i++)
    {
      if (store->path[i] == '\0')
        break;

      if (store->path[i] == '/')
      {
        bpf_map_update_elem(&bufk, &two, z, BPF_ANY);

        match = false;

        u32 len = i + 2;
        if (len > MAX_STRING_SIZE)
          len = MAX_STRING_SIZE;

        // Check Subdir with From Source
        bpf_probe_read_str(pk->path, len, store->path);
        bpf_probe_read_str(pk->source, MAX_STRING_SIZE, store->source);
        dirval = bpf_map_lookup_elem(inner, pk);
        if (dirval)
        {
          if ((dirval->processmask & RULE_DIR) &&
              (dirval->processmask & RULE_EXEC))
          {
            match = true;
            if ((dirval->processmask & RULE_RECURSIVE) &&
                (~dirval->processmask & RULE_HINT))
            { // true directory match and not a hint suggests
              // there are no possibility of child dir
              val = dirval;
              goToDecision = true; // to please the holy verifier
              break;
            }
            else if (dirval->processmask & RULE_RECURSIVE)
            { // It's a directory match but also a
              // hint, it's possible that a
              // subdirectory exists that can also
              // match so we continue the loop to look
              // for a true match in subdirectories
              recursivebuthint = true;
              val = dirval;
            }
            else
            {
              continue; // We continue the loop to see if we have more nested
                        // directories and set match to false
            }
          }
        }
        else
        {
          break;
        }
      }
    }

    if (recursivebuthint || goToDecision)
    {
      match = true;
      goto decision;
    }
    if (match && dirval)
    { // to please the holy verifier
      val = dirval;
      goto decision;
    }
  }
  bpf_map_update_elem(&bufk, &two, z, BPF_ANY);
  bpf_probe_read_str(pk->path, MAX_STRING_SIZE, store->path);

  val = bpf_map_lookup_elem(inner, pk);

  if (val && (val->processmask & RULE_EXEC))
  {
    match = true;
    goto decision;
  }

  // match exec name (with and without fromSource)
  struct qstr d_name;
  d_name = BPF_CORE_READ(f_path.dentry, d_name);
  if (fromSourceCheck)
  {
    bpf_map_update_elem(&bufk, &two, z, BPF_ANY);
    bpf_probe_read_str(pk->path, MAX_STRING_SIZE, d_name.name);
    bpf_probe_read_str(pk->source, MAX_STRING_SIZE, store->source);

    val = bpf_map_lookup_elem(inner, pk);

    if (val && (val->processmask & RULE_EXEC))
    {
      match = true;
      goto decision;
    }
  }
  // match exec name without fromSource
  bpf_map_update_elem(&bufk, &two, z, BPF_ANY);
  bpf_probe_read_str(pk->path, MAX_STRING_SIZE, d_name.name);

  val = bpf_map_lookup_elem(inner, pk);

  if (val && (val->processmask & RULE_EXEC))
  {
    match = true;
    goto decision;
  }

  recursivebuthint = false;

#pragma unroll
  for (int i = 0; i < 64; i++)
  {
    if (store->path[i] == '\0')
      break;

    if (store->path[i] == '/')
    {
      bpf_map_update_elem(&bufk, &two, z, BPF_ANY);

      match = false;

      u32 len = i + 2;
      if (len > MAX_STRING_SIZE)
        len = MAX_STRING_SIZE;

      bpf_probe_read_str(pk->path, len, store->path);
      dirval = bpf_map_lookup_elem(inner, pk);
      if (dirval)
      {
        if ((dirval->processmask & RULE_DIR) &&
            (dirval->processmask & RULE_EXEC))
        {
          match = true;
          if ((dirval->processmask & RULE_RECURSIVE) &&
              (~dirval->processmask & RULE_HINT))
          { // true directory match and not a hint suggests
            // there are no possibility of child dir match
            val = dirval;
            goto decision;
          }
          else if (dirval->processmask & RULE_RECURSIVE)
          {
            recursivebuthint = true;
            val = dirval;
          }
          else
          {
            continue; // We continue the loop to see if we have more nested
                      // directories and set match to false
          }
        }
        if (~dirval->processmask & RULE_HINT)
        {
          break;
        }
      }
      else
      {
        break;
      }
    }
  }

  if (recursivebuthint)
  {
    match = true;
    goto decision;
  }
  else
  {
    if (match && dirval)
    {
      val = dirval;
      goto decision;
    }
  }

decision:

  if (match)
  {
    if (val && (val->processmask & RULE_ARGSET) && get_kubearmor_config(_MATCH_ARGS))
    {
      argmatch = matchArguments(num_of_args, &okey, store, pk);
      if (argmatch)
      {
        // if arguments matches allow the process to be executed
        return 0;
      }
    }
    if (val && (val->processmask & RULE_PTS))
    {
      if (is_pts(t))
      {
        retval = -EPERM;
      }
    }
    if (val && (val->processmask & RULE_OWNER))
    {
      if (!is_owner(bprm->file))
      {
        // not owner
        retval = -EPERM;
      }
      else
      {
        // argument 
```

### Core Architecture Module: `KubeArmor/BPF/enforcer_path.bpf.c`
```
// +build ignore
/* SPDX-License-Identifier: GPL-2.0 */
/* Copyright 2026 Authors of KubeArmor */

#include "shared.h"
#include "syscalls.h"

#define PATH_SEC_CALL(NAME , ID)                                                    \
  SEC("lsm/path_" #NAME)                                                       \
  int BPF_PROG(enforce_##NAME, struct path *dir, struct dentry *dentry) {      \
    struct path f_path;                                                        \
    f_path.dentry = dentry;                                                    \
    f_path.mnt = BPF_CORE_READ(dir, mnt);                                      \
    return match_and_enforce_path_hooks(&f_path, dpath, ID);                       \
  }

PATH_SEC_CALL(mknod , _FILE_MKNOD)
PATH_SEC_CALL(rmdir , _FILE_RMDIR)
PATH_SEC_CALL(unlink , _FILE_UNLINK)
PATH_SEC_CALL(symlink , _FILE_SYMLINK)
PATH_SEC_CALL(mkdir , _FILE_MKDIR)

SEC("lsm/path_link")
int BPF_PROG(enforce_link_src, struct dentry *old_dentry, struct path *dir,
             struct dentry *new_dentry) {
  struct path f_path;
  f_path.dentry = old_dentry;
  f_path.mnt = BPF_CORE_READ(dir, mnt);
  return match_and_enforce_path_hooks(&f_path, dpath, _FILE_LINK );
}

SEC("lsm/path_link")
int BPF_PROG(enforce_link_dst, struct dentry *old_dentry, struct path *dir,
             struct dentry *new_dentry) {
  struct path f_path;
  f_path.dentry = new_dentry;
  f_path.mnt = BPF_CORE_READ(dir, mnt);
  return match_and_enforce_path_hooks(&f_path, dpath, _FILE_LINK);
}

SEC("lsm/path_rename")
int BPF_PROG(enforce_rename_old, struct path *old_dir,
             struct dentry *old_dentry) {
  struct path f_path;
  f_path.dentry = old_dentry;
  f_path.mnt = BPF_CORE_READ(old_dir, mnt);
  return match_and_enforce_path_hooks(&f_path, dpath , _FILE_RENAME);
}

SEC("lsm/path_rename")
int BPF_PROG(enforce_rename_new, struct path *old_dir,
             struct dentry *old_dentry, struct path *new_dir,
             struct dentry *new_dentry) {
  struct path f_path;
  f_path.dentry = new_dentry;
  f_path.mnt = BPF_CORE_READ(new_dir, mnt);
  return match_and_enforce_path_hooks(&f_path, dpath ,_FILE_RENAME);
}

SEC("lsm/path_chmod")
int BPF_PROG(enforce_chmod, struct path *p) {
  return match_and_enforce_path_hooks(p, dpath , _FILE_CHMOD);
}

// SEC("lsm/path_chown")
// int BPF_PROG(enforce_chown, struct path *p) {
//   return match_and_enforce_path_hooks(p, dpath);
// }

SEC("lsm/path_truncate")
int BPF_PROG(enforce_truncate, struct path *p) {
  return match_and_enforce_path_hooks(p, dpath, _FILE_TRUNCATE);
}

```

### Core Architecture Module: `KubeArmor/BPF/exec.bpf.c`
```
// +build ignore
/* SPDX-License-Identifier: GPL-2.0 */
/* Copyright 2026 Authors of KubeArmor */

#include "shared.h"

struct {
  __uint(type, BPF_MAP_TYPE_RINGBUF);
  __uint(max_entries, 1 << 24);
} events SEC(".maps");

// Force emitting struct mmap_event into the ELF.
const event *unused __attribute__((unused));

struct preset_map kubearmor_exec_preset_containers SEC(".maps");

struct pathname {
    char path[256];
    char source[256];
};

SEC("lsm/bprm_check_security")
int BPF_PROG(exec_preset_bprm_check_security, struct linux_binprm *bprm){

  struct task_struct *t = (struct task_struct *)bpf_get_current_task();

  struct outer_key okey;
  get_outer_key(&okey, t);

  u32 *present = bpf_map_lookup_elem(&kubearmor_exec_preset_containers, &okey);

  if (!present) {
    return 0;
  }

  // currently exec preset only target execution with tty attached
  // check if tty is attached
  struct signal_struct *signal; 
  bpf_probe_read(&signal, sizeof(signal), &t->signal);
  if (signal != NULL){
      struct tty_struct *tty;
      bpf_probe_read(&tty, sizeof(tty), &signal->tty);
      if (tty == NULL){
          return 0;
      }
  } else {
    return 0;
  }

  u32 host_pid = bpf_get_current_pid_tgid() >> 32;
  u64 *exec_id = bpf_map_lookup_elem(&kubearmor_exec_pids, &host_pid);
  if (!exec_id) {
    return 0;
  }


  u32 zero = 0;
  bufs_k *z = bpf_map_lookup_elem(&bufk, &zero);
  if (z == NULL)
    return 0;

  u32 one = 1;
  bufs_k *store = bpf_map_lookup_elem(&bufk, &one);
  if (store == NULL)
    return 0;

  bpf_map_update_elem(&bufk, &one, z, BPF_ANY);

  u32 two = 2;
  bufs_k *pk = bpf_map_lookup_elem(&bufk, &two);
  if (pk == NULL)
    return 0;

  struct file *file = BPF_CORE_READ(bprm, file);
  if (file == NULL)
    return 0;

  bufs_t *path_buf = get_buf(PATH_BUFFER);
  if (path_buf == NULL)
    return 0;

  if (!prepend_path(&(file->f_path), path_buf)){
    return 0;
  } else {
    u32 *path_offset = get_buf_off(PATH_BUFFER);
    if (path_offset == NULL)
      return 0;

    void *path_ptr = &path_buf->buf[*path_offset];
    bpf_probe_read_str(store->path, MAX_STRING_SIZE, path_ptr);
  }

  struct task_struct *parent_task = BPF_CORE_READ(t, parent);
  struct file *file_p = get_task_file(parent_task);
  if (file_p == NULL)
    return 0;
  bufs_t *src_buf = get_buf(PATH_BUFFER);
  if (src_buf == NULL)
    return 0;
  struct path f_src = BPF_CORE_READ(file_p, f_path);
  if (!prepend_path(&f_src, src_buf))
    return 0;
  u32 *src_offset = get_buf_off(PATH_BUFFER);
  if (src_offset == NULL)
    return 0;
  void *src_ptr;
  if (src_buf->buf[*src_offset]) {
    src_ptr = &src_buf->buf[*src_offset];
  }
  if (src_ptr == NULL)
    return 0;
  bpf_probe_read_str(store->source, MAX_STRING_SIZE, src_ptr);

  const char *filename = BPF_CORE_READ(bprm, filename);

  event *event_data;
  event_data = bpf_ringbuf_reserve(&events, sizeof(event), 0);

  if (!event_data) {
      return 0;
  }

  __builtin_memset(event_data->data.path, 0, sizeof(event_data->data.path));
  __builtin_memset(event_data->data.source, 0, sizeof(event_data->data.source));

  bpf_probe_read_str(event_data->data.path, MAX_STRING_SIZE, store->path);
  bpf_probe_read_str(event_data->data.source, MAX_STRING_SIZE, store->source);

  init_context(event_data);
    
  event_data->event_id = EXEC;

  if (*present == BLOCK) {
      event_data->retval = -EPERM;
      bpf_ringbuf_submit(event_data, 0);
      return -EPERM;
  } 
  event_data->retval = 0;
  bpf_ringbuf_submit(event_data, 0);
  return 0;
}


```

### Core Architecture Module: `KubeArmor/BPF/filelessexec.bpf.c`
```
// +build ignore
/* SPDX-License-Identifier: GPL-2.0 */
/* Copyright 2026 Authors of KubeArmor */

#include "shared.h"

struct
{
  __uint(type, BPF_MAP_TYPE_RINGBUF);
  __uint(max_entries, 1 << 24);
} events SEC(".maps");

// Force emitting struct mmap_event into the ELF.
const event *unused __attribute__((unused));

struct preset_map kubearmor_fileless_exec_preset_containers SEC(".maps");

#define MEMFD "memfd:"
#define RUN_SHM "/run/shm/"
#define DEV_SHM "/dev/shm/"

static __always_inline int is_memfd(char *name)
{
  return string_prefix_match(name, MEMFD, sizeof(MEMFD));
}

static __always_inline int is_run_shm(char *name)
{
  return string_prefix_match(name, RUN_SHM, sizeof(RUN_SHM));
}

static __always_inline int is_dev_shm(char *name)
{
  return string_prefix_match(name, DEV_SHM, sizeof(DEV_SHM));
}

struct pathname
{
  char path[256];
};

SEC("lsm/bprm_check_security")
int BPF_PROG(fileless_preset_bprm_check_security, struct linux_binprm *bprm)
{

  struct task_struct *t = (struct task_struct *)bpf_get_current_task();

  struct outer_key okey;
  get_outer_key(&okey, t);

  u32 *present = bpf_map_lookup_elem(&kubearmor_fileless_exec_preset_containers, &okey);

  if (!present)
  {
    return 0;
  }

  struct pathname path_data = {};

  struct file *file = BPF_CORE_READ(bprm, file);
  if (file == NULL)
    return 0;

  bufs_t *path_buf = get_buf(PATH_BUFFER);
  if (path_buf == NULL)
    return 0;

  // prepend path is needed to capture /dev/shm and /run/shm paths
  if (!prepend_path(&(file->f_path), path_buf))
  {
    // memfd files have no path in the filesystem -> extract their name
    struct dentry *dentry = BPF_CORE_READ(&file->f_path, dentry);
    struct qstr d_name = BPF_CORE_READ(dentry, d_name);
    bpf_probe_read_kernel_str(path_data.path, MAX_STRING_SIZE, (void *)d_name.name);
  }
  else
  {
    u32 *path_offset = get_buf_off(PATH_BUFFER);
    if (path_offset == NULL)
      return 0;

    void *path_ptr = &path_buf->buf[*path_offset];
    bpf_probe_read_str(path_data.path, MAX_STRING_SIZE, path_ptr);
  }

  const char *filename = BPF_CORE_READ(bprm, filename);

  if (is_memfd(path_data.path) || is_run_shm(path_data.path) || is_dev_shm(path_data.path))
  {
    event *event_data;
    event_data = bpf_ringbuf_reserve(&events, sizeof(event), 0);

    if (!event_data)
    {
      return 0;
    }

    __builtin_memset(event_data->data.path, 0, sizeof(event_data->data.path));
    __builtin_memset(event_data->data.source, 0, sizeof(event_data->data.source));

    bpf_probe_read_str(event_data->data.path, MAX_STRING_SIZE, path_data.path);
    bpf_probe_read_str(event_data->data.source, MAX_STRING_SIZE, filename);

    init_context(event_data);
    event_data->event_id = FILELESS_EXEC;

    // mapping not backed by any file with executable permission, denying mapping
    if (*present == BLOCK)
    {
      event_data->retval = -EPERM;
      bpf_ringbuf_submit(event_data, 0);
      return -EPERM;
    }
    else
    {
      event_data->retval = 0;
      bpf_ringbuf_submit(event_data, 0);
      return 0;
    }
  }

  return 0;
}
```

### Core Architecture Module: `KubeArmor/BPF/ima_hash.bpf.c`
```
// +build ignore
/* SPDX-License-Identifier: GPL-2.0    */
/* Copyright 2026 Authors of KubeArmor */

#include "vmlinux.h"
#include "vmlinux_macro.h"
#include <bpf/bpf_core_read.h>
#include <bpf/bpf_helpers.h>
#include <bpf/bpf_tracing.h>
#include "ima_hash.h"
#include "visibility.h"
#include "kubearmor_config.h"

SEC("lsm.s/bprm_check_security")
int BPF_PROG(ima_bprm_check_security, struct linux_binprm *bprm)
{

    if (drop_syscall(_IMA_PROBE))
        return 0;

    u32 pid = bpf_get_current_pid_tgid() >> 32;

    void *hash_exists = bpf_map_lookup_elem(&kubearmor_ima_hash_map, &pid);
    if (hash_exists)
        return 0;

    ima_hash_t hash = {0};
    u32 algo = bpf_ima_file_hash(bprm->file, hash.digest, sizeof(hash.digest));

    if (algo > 0)
    {
        bpf_map_update_elem(&kubearmor_ima_hash_map, &pid, &hash, BPF_ANY);
    }

    return 0;
}

/*
SEC("lsm.s/file_open")
int BPF_PROG(ima_file_open, struct file *file) {

    // bpf_ima_file_hash() leading to performance bottleneck for the system,
    // it appears as a high latency operation and due to frequency of the file events
    // every file operation becomes a potential bottleneck


    // ima_hash_t hash = {0};
    // u32 algo = bpf_ima_file_hash(file, hash.digest, sizeof(hash.digest));

    // u32 pid = bpf_get_current_pid_tgid() >> 32;
    // pid |= FILE_HASH_MASK;
    // if (algo > 0){
    //     bpf_map_update_elem(&kubearmor_ima_hash_map, &pid, &hash, BPF_ANY);
    // }
    return 0;
}
*/

char LICENSE[] SEC("license") = "Dual BSD/GPL";
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2828** (2026-09-07): **pass OCI hooks flag consistently from operator to snitch**
  *Symptoms*: ## Bug Report  <!-- If you have usage questions, please try the [Discussions](https://github.com/kubearmor/KubeArmor/discussions) or [KubeArmor Slack](https://kubearmor.slack.com/) first. Please check the [Kubearmor issue](https://github.com/kubearmor/KubeArmor/issues) list to check if there is an issue already in the context. -->  When OCI hooks are enabled through the Helm chart, the KubeArmor Operator correctly receives:  ``` KUBEARMOR_OCI_HOOKS=yes ```  However, the Operator creates Snitch Jobs with:  ```text KUBEARMOR_OCI_HOOKS=true ```  KubeArmor v1.7.4's GetOCIHooks() implementation only accepts `yes` and `no`. As a result, the Snitch interprets true as disabled and skips OCI hook installation.  This prevents KubeArmor OCI hooks from being installed on containerd nodes, even though enableOCIHooks: true is configured.  **General Information**  - Environment description: Cluster API-managed VM-based Kubernetes cluster - Kernel version: 6.8.0-106-generic - Orchestration system version in use: v1.34.9 - Link to relevant artifacts (policies, deployments scripts, ...)   - KubeArmor v1.7.4 Helm template:     - https://github.com/kubearmor/KubeArmor/blob/v1.7.4/deployments/helm/KubeArmorOperator/templates/deployment.yaml   - KubeArmor v1.7.4 Operator Snitch Job generation:     - https://github.com/kubearmor/KubeArmor/blob/v1.7.4/pkg/KubeArmorOperator/internal/controller/resources.go   - KubeArmor v1.7.4 OCI hooks parser:     - https://github.com/kubearmor/KubeArmor/blob/1504ee

- **Issue #2803** (2026-07-29): **Trivy Scan vulnerabilities**
  *Symptoms*: ## Bug Report ``` KubeArmor/kubearmor (gobinary) ============================== Total: 1 (HIGH: 1, CRITICAL: 0)  ┌────────────────────────┬─────────────────────┬──────────┬────────┬───────────────────┬───────────────┬───────────────────────────────────────────────────┐ │        Library         │    Vulnerability    │ Severity │ Status │ Installed Version │ Fixed Version │                       Title                       │ ├────────────────────────┼─────────────────────┼──────────┼────────┼───────────────────┼───────────────┼───────────────────────────────────────────────────┤ │ google.golang.org/grpc │ GHSA-hrxh-6v49-42gf │ HIGH     │ fixed  │ v1.81.1           │ 1.82.1        │ gRPC-Go: xDS RBAC and HTTP/2 Vulnerabilities      │ │                        │                     │          │        │                   │               │ https://github.com/advisories/GHSA-hrxh-6v49-42gf │ └────────────────────────┴─────────────────────┴──────────┴────────┴───────────────────┴───────────────┴───────────────────────────────────────────────────┘``` <!-- If you have usage questions, please try the [Discussions](https://github.com/kubearmor/KubeArmor/discussions) or [KubeArmor Slack](https://kubearmor.slack.com/) first. Please check the [Kubearmor issue](https://github.com/kubearmor/KubeArmor/issues) list to check if there is an issue already in the context. -->  **General Information**  - Environment description (GKE, VM-Kubeadm, vagrant-dev-env, minikube, microk8s, ...) - Kernel ver
  **Post-Mortem & Fix Analysis**:
  > @Aryan-sharma11 I would like to work on this and I'll submit a PR regarding fix soon.
  > @Aryan-sharma11 i would like to work on this

- **Issue #2796** (2026-09-08): **Data race in writing ContainerMap in anonmapexec**
  *Symptoms*:  **General Information**  - Component: `KubeArmor/presets/anonmapexec` - Environment: Reproduces with concurrent policy updates when presets are active - Kernel version: N/A - Orchestration system: N/A - Target containers/pods: any workloads using the AnonMapExec preset  **Description**  In `UpdateSecurityPolicies`, `anonmapexec` acquires `ContainerMapLock.RLock()` (read lock) and then **writes** `p.ContainerMap[cid] = ckv` before `RUnlock()`.  The `RWMutex` allows multiple concurrent read lock holders. Writing a Go map under a read lock is a data race. Concurrent policy updates or a concurrent exclusive `Lock` writer can corrupt the map or panic.  All other presets (`exec`, `filelessexec`, etc) handle this correctly:  1. `RLock` → read map → `RUnlock` 2. mutate a local copy 3. `Lock` → write map → `Unlock`  **To Reproduce**  This uses a sample test script with the same code to demonstrate the race condition.  1. Create a small module  ```bash mkdir -p /tmp/anonmapexec_race_demo && cd /tmp/anonmapexec_race_demo go mod init anonmapexec_race_demo ```  2. Save [this test](https://gist.github.com/vee1e/97f8af0642350456a30f2621aac5c475) as race_test.go  3. Run with the race detector  ```bash go test -race -count=1 -run TestAnonMapExec_ContainerMapWriteUnderRLock_DataRace . ```  Expected output (excerpt from local testing):  ``` ================== WARNING: DATA RACE ...   anonmapexec_race_demo.updateBuggy()       .../race_test.go:24 +0x7c ... Found 3 data race(s) FAIL    anonmapexe

- **Issue #2792** (2026-07-24): **Duplicate generate directive in filelessexec**
  *Symptoms*: **General Information**  - Component: `KubeArmor/presets/filelessexec` - Environment: N/A (buil tooling only, not runtime) - Kernel version: N/A - Orchestration system: N/A - Target containers/pods: N/A  **Description**  The `filelessexec/preset.go` file contains two identical `//go:generate` directives that invoke the same `bpf2go` command:  1. After the package declaration (line 7) 2. After the import block (line ~31, before the `var` block)  Every other preset package only has a **single** `//go:generate` line.  **To Reproduce**   1. From `KubeArmor/`, run:     ```bash    go generate -n ./presets/filelessexec    ```  3. Observe the same `bpf2go` command printed twice.  **Expected behavior**  - Exactly one `//go:generate` directive per preset package. - `go generate ./presets/filelessexec` runs bpf2go once.  **Actual behavior**  - Two identical directives. - Runs bpf2go twice, rewriting the same generated files.  **Impact**  - Redundant work during `go generate` (including paths that run `go generate ./...`). - Easy to diverge if only one line is edited later.  **Suggested fix**  Remove the duplicate directive; keep a single line (aligned with `exec` and the other presets).

- **Issue #2701** (2026-06-24): **fix trivy scan vulnerabilities**
  *Symptoms*: <img width="1735" height="471" alt="Image" src="https://github.com/user-attachments/assets/571de5e2-c4b8-49d6-afc5-da54dee19438" /> 
  **Post-Mortem & Fix Analysis**:
  > @Aryan-sharma11 I would like to work on this please assign this to me ! 

- **Issue #2698** (2026-06-25): **Incorrect expression syntax in workflow if conditions causes literal truthy evaluation**
  *Symptoms*: ## Bug Report  **General Information** - Environment description: GitHub Actions CI workflows (not a runtime/cluster issue) - Affected workflows: `.github/workflows/ci-latest-release.yml`, `.github/workflows/ci-latest-ubi-release.yml` - Affected jobs: `build` and `kubearmor-controller-release` in both files - Link to relevant artifacts: noticed while working on #2585  **To Reproduce** 1. Open `.github/workflows/ci-latest-release.yml` or `.github/workflows/ci-latest-ubi-release.yml` 2. Look at the `if:` condition on the `build` job or the `kubearmor-controller-release` job 3. Observe that `github.ref` is wrapped in `${{ }}` even though it sits inside an `if:` field that is already evaluated as an expression context, for example: ```yaml    if: github.repository == 'kubearmor/kubearmor' && (needs.check.outputs.kubearmor == 'true' || ${{ github.ref }} != 'refs/heads/main') ``` 4. Run a workflow linter (e.g. actionlint) against the file, it flags: "Conditional expression contains literal text outside replacement tokens. This will cause the expression to always evaluate to truthy."  **Expected behavior** The `if:` condition should not nest `${{ }}` inside itself since the entire field is already evaluated as an expression. The correct form is: ```yaml if: github.repository == 'kubearmor/kubearmor' && (needs.check.outputs.kubearmor == 'true' || github.ref != 'refs/heads/main') ``` Without this fix, the right side of the `||` always evaluates as truthy text, meaning the job conditio

- **Issue #2659** (2026-06-11): **KA Posture fails to update on VM mode without restart**
  *Symptoms*:  **General Information**  - Environment description (VM) - Kernel version (run `uname -a`)  **To Reproduce**  1. Deploy kubearmor in VM mode.  2. Now observe the default posture set for file and process in the config.  3. Modify the default posture in the config.  4. Now observe KubeArmor logs. The posture change is not identified.  5. Now restart the KA service and observe the logs. Posture is updated.   **Expected behavior**  The posture change should reflect without needing to restart the KA service running in the VM.  

- **Issue #2634** (2026-07-21): **test(blockposture): KarmorGetLogs 10s timeout causes intermittent CI failures on loaded runners**
  *Symptoms*: ## Bug Report  **General Information**  - Environment: `oracle-vm-16cpu-64gb-x86-64` self-hosted GitHub Actions runner - Orchestration: k3s with containerd runtime - Affected test: `tests/k8s_env/blockposture/block_test.go:89` - Affected suite: `Auto-testing Framework / oracle-vm-16cpu-64gb-x86-64 / containerd`  **To Reproduce**  1. Raise any PR that triggers `ci-test-ginkgo` workflow 2. Wait for the `Auto-testing Framework / oracle-vm-16cpu-64gb-x86-64 / containerd` matrix job to run 3. Observe the `Test KubeArmor using Ginkgo` step failing in the `blockposture` suite with `event timeout`  **Expected behavior**  The test `can whitelist certain files accessed by a package while blocking all other sensitive content` should pass. The block itself works correctly as seen in the logs: `cat: can't open 'docker-entrypoint.sh': Permission denied`. KubeArmor is enforcing the policy but `KarmorGetLogs(10*time.Second, 1)` times out before the policy violation alert arrives over gRPC, returning 0 alerts. The assertion `Expect(len(alerts)).To(BeNumerically(">=", 1))` then fails with `Expected <int>: 0 to be >= <int>: 1`.  The test retries 9 times and fails on every attempt totalling 322 seconds before giving up. The failure is intermittent and runner-load-dependent. The same test passes on other CI runs when the runner is less loaded, confirming this is a timing issue in the eBPF event delivery pipeline rather than a functional KubeArmor bug.  The fix is to increase the `KarmorGetLogs` t
  **Post-Mortem & Fix Analysis**:
  > A useful next step might be to separate the repro into input, state/cache update, and final output for `oracle-vm-16cpu-64gb-x86-64`. That would make it clearer whether “test(blockposture): KarmorGetLogs 10s timeout causes intermittent CI failures on loaded runners” is failing during parsing/configuration, during internal state updates, or only at the user-visible result. 

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

### Incident Patch 1: `74d732ec` (2026-09-15)
**Commit Message**: chore: fix vulnerabilities in Go module dependencies (#2899)

Bump golang.org/x/crypto to v0.56.0 to resolve DoS vulnerabilities in
x/crypto/ssh (GO-2026-6354, GO-2026-6355), bump google.golang.org/grpc
to v1.83.2 to resolve xDS server DoS, xDS RBAC filter bypass, and
HTTP/2 DATA frame memory exhaustion issues (GHSA-2v4p-qf9q-27wj,
GHSA-qc2q-p7wx-3px3, GHSA-vp52-pcj8-j9qc), bump
github.com/containerd/containerd/v2 to v2.3.5 to resolve the CRI
ExecSync goroutine leak (GHSA-7jxh-36q5-gcqv), and bump
github.com/cilium/cilium to v1.19.5 to resolve a NetworkPolicy ipBlock
ingress bypass (GO-2026-6367).

Applied across every go.mod that resolves these modules directly or
indirectly (KubeArmor, deployments, deployments/podman,
pkg/KubeArmorController, pkg/KubeArmorOperator, protobuf, tests).
k8s.io/api, k8s.io/apimachinery, k8s.io/client-go and k8s.io/cri-api
move from v0.36.1 to v0.36.3 only because containerd/v2 v2.3.5's own
go.mod requires that floor; no Kubernetes dependency was upgraded
beyond what module resolution required.

Signed-off-by: Vanshika <pahalvanshikaa@gmail.com>

**File**: `KubeArmor/go.mod` (modified, +9/-9)
```diff
@@ -24,10 +24,10 @@ replace (
 
 require (
 	github.com/Masterminds/sprig/v3 v3.3.0
-	github.com/cilium/cilium v1.19.4
+	github.com/cilium/cilium v1.19.5
 	github.com/cilium/ebpf v0.22.0
 	github.com/containerd/containerd/api v1.11.1
-	github.com/containerd/containerd/v2 v2.3.2
+	github.com/containerd/containerd/v2 v2.3.5
 	github.com/containerd/nri v0.12.0
 	github.com/containerd/typeurl/v2 v2.2.3
 	github.com/florianl/go-nflog/v2 v2.3.0
@@ -44,12 +44,12 @@ require (
 	go.uber.org/zap v1.28.0
 	golang.org/x/exp v0.0.0-20260508232706-74f9aab9d74a
 	golang.org/x/sys v0.47.0
-	google.golang.org/grpc v1.82.1
+	google.golang.org/grpc v1.83.2
 	google.golang.org/protobuf v1.36.12-0.20260120151049-f2248ac996af
-	k8s.io/api v0.36.1
-	k8s.io/apimachinery v0.36.1
-	k8s.io/client-go v0.36.1
-	k8s.io/cri-api v0.36.1
+	k8s.io/api v0.36.3
+	k8s.io/apimachinery v0.36.3
+	k8s.io/client-go v0.36.3
+	k8s.io/cri-api v0.36.3
 	k8s.io/klog/v2 v2.140.0
 	k8s.io/utils v0.0.0-20260507154919-ff6756f316d2
 	sigs.k8s.io/controller-runtime v0.24.1
@@ -69,7 +69,7 @@ require (
 	github.com/containerd/errdefs/pkg v0.3.0 // indirect
 	github.com/containerd/fifo v1.1.0 // indirect
 	github.com/containerd/log v0.1.0 // indirect
-	github.com/containerd/platforms v1.0.0-rc.4 // indirect
+	github.com/containerd/platforms v1.0.0-rc.5 // indirect
 	github.com/containerd/plugin v1.1.0 // indirect
 	github.com/containerd/ttrpc v1.2.8 // indirect
 	github.com/davecgh/go-spew v1.1.2-0.20180830191138-d8f796af33cc // indirect
@@ -145,7 +145,7 @@ require (
 	go.uber.org/multierr v1.11.0 // indirect
 	go.yaml.in/yaml/v2 v2.4.4 // indirect
 	go.yaml.in/yaml/v3 v3.0.4 // indirect
-	golang.org/x/crypto v0.55.0 // indirect
+	golang.org/x/crypto v0.56.0 // indirect
 	golang.org/x/mod v0.40.0 // indirect
 	golang.org/x/net v0.58.0 // indirect
 	golang.org/x/oauth2 v0.36.0 // indirect
```

**File**: `KubeArmor/go.sum` (modified, +20/-20)
```diff
@@ -23,8 +23,8 @@ github.com/brianvoe/gofakeit/v7 v7.12.1/go.mod h1:QXuPeBw164PJCzCUZVmgpgHJ3Llj49
 github.com/census-instrumentation/opencensus-proto v0.2.1/go.mod h1:f6KPmirojxKA12rnyqOA5BBL4O983OfeGPqjHWSTneU=
 github.com/cespare/xxhash/v2 v2.3.0 h1:UL815xU9SqsFlibzuggzjXhog7bL6oX9BbNZnL2UFvs=
 github.com/cespare/xxhash/v2 v2.3.0/go.mod h1:VGX0DQ3Q6kWi7AoAeZDth3/j3BFtOZR5XLFGgcrjCOs=
-github.com/cilium/cilium v1.19.4 h1:TxDZW+27NqLbuenPlWd8y8cnAmDNFga/FCMM8zP1qLQ=
-github.com/cilium/cilium v1.19.4/go.mod h1:9j8LLVACyWe8bbtlUPCjPSARbmOS+tqo9GRNh5SHjJc=
+github.com/cilium/cilium v1.19.5 h1:R4tqIO3wwjzr5TnPw5cSbUhdMIjMAoHhtjNvO/hIZ+Q=
+github.com/cilium/cilium v1.19.5/go.mod h1:E6p9yfdG9g4aDq1D5cvcY7eqzdbVxXy3wyaYETCwZ1U=
 github.com/cilium/ebpf v0.22.0 h1:v2ktp0roffpMOj2MMf3idtCQZOsAoC4BJbAJN+ke2bY=
 github.com/cilium/ebpf v0.22.0/go.mod h1:CDzZbe2hC5JjlDC+CY3KFCzlYwN4gbxppYM+Z10bQt4=
 github.com/cilium/hive v0.0.0-20260108104938-97756f6ff54c h1:mP/Z+oVplgbg3oV1lwsAC86NPLWioN/TqlmZ6+BI2I0=
@@ -35,8 +35,8 @@ github.com/containerd/cgroups/v3 v3.1.3 h1:eUNflyMddm18+yrDmZPn3jI7C5hJ9ahABE5q6
 github.com/containerd/cgroups/v3 v3.1.3/go.mod h1:PKZ2AcWmSBsY/tJUVhtS/rluX0b1uq1GmPO1ElCmbOw=
 github.com/containerd/containerd/api v1.11.1 h1:h8nfoDW9+fNsC/9TwiAHj8B1GzXKtR4eFtkhi/X5RLU=
 github.com/containerd/containerd/api v1.11.1/go.mod h1:CaQFRu+N1MtbgL6JDOJLUB1hCKESU1lD6MuTJhgtdlw=
-github.com/containerd/containerd/v2 v2.3.2 h1:eLven1YxRMkeiKu7IcMrPKE+gn8sGR1DqHbbshMEvWM=
-github.com/containerd/containerd/v2 v2.3.2/go.mod h1:rHKGm3VW6wNrINb3x8mNT+w7qYXFVElTt/8HTuxVhD4=
+github.com/containerd/containerd/v2 v2.3.5 h1:9MYlI81gUcOZ0WsCkSMtvOU7rTR3hqAoa2eCzhoLlkA=
+github.com/containerd/containerd/v2 v2.3.5/go.mod h1:RXDyLPaI3zoO7dFdAW9/54W4cix+z3A6larieufC9mg=
 github.com/containerd/continuity v0.5.0 h1:7a85HZpCSs+1Zps0Ee3DPSuAWY+0SJM1JNM51nlEVDg=
 github.com/containerd/continuity v0.5.0/go.mod h1:/lNJvtJKUQStBzpVQ1+rasXO1LAWtUQssk28EZvJ3nE=
 github.com/containerd/errdefs v1.0.0 h1:tg5yIfIlQIrxYtu9ajqY42W3lpS19XqdxRQeEwYG8PI=
@@ -49,8 +49,8 @@ github.com/containerd/log v0.1.0 h1:TCJt7ioM2cr/tfR8GPbGf9/VRAX8D2B4PjzCpfX540I=
 github.com/containerd/log v0.1.0/go.mod h1:VRRf09a7mHDIRezVKTRCrOq78v577GXq3bSa3EhrzVo=
 github.com/containerd/nri v0.12.0 h1:RvZtyCM64XOB1UmMAFOlfReTTwCd+hE2IEQ5XEpkKA0=
 github.com/containerd/nri v0.12.0/go.mod h1:TGAfPLH4a+qwbv0PxsefPiR+PobYecDj2aXMtz7GQcg=
-github.com/containerd/platforms v1.0.0-rc.4 h1:M42JrUT4zfZTqtkUwkr0GzmUWbfyO5VO0Q5b3op97T4=
-github.com/containerd/platforms v1.0.0-rc.4/go.mod h1:lKlMXyLybmBedS/JJm11uDofzI8L2v0J2ZbYvNsbq1A=
+github.com/containerd/platforms v1.0.0-rc.5 h1:vXd569rDrz8LeMXzAnBsy6LADV5YtsD8oyaRarxdmSU=
+github.com/containerd/platforms v1.0.0-rc.5/go.mod h1:lKlMXyLybmBedS/JJm11uDofzI8L2v0J2ZbYvNsbq1A=
 github.com/containerd/plugin v1.1.0 h1:O+7lczNJVMy8rz0YNx3xGB8tTf5qY4i5abF041Ew19U=
 github.com/containerd/plugin v1.1.0/go.mod h1:qBTum+A8lJ6lO44A19Eo7y1OlcLj4OWFH1DA/vnHmcc=
 github.com/containerd/ttrpc v1.2.8 h1:xbVu6D4qF2jihdh9rDVOKqUMiFBQk6YctTdo1zk087Y=
@@ -332,8 +332,8 @@ go.opentelemetry.io/otel/metric v1.44.0 h1:1w0gILTcHdr3YI+ixLyjemwrVnsMURbTZFrSY
 go.opentelemetry.io/otel/metric v1.44.0/go.mod h1:8O7hanEPBNgEMmybD3s2VBKcgWOCsA6tzHBPODAiquo=
 go.opentelemetry.io/otel/sdk v1.44.0 h1:nHYwb9lK+fJPU/dnT6s7W7Z8itMWyqrnVfbheVYrZ58=
 go.opentelemetry.io/otel/sdk v1.44.0/go.mod h1:Osuydd3Se74nqjAKxid74N5eC+jfEqfTegHRnq58oK0=
-go.opentelemetry.io/otel/sdk/metric v1.43.0 h1:S88dyqXjJkuBNLeMcVPRFXpRw2fuwdvfCGLEo89fDkw=
-go.opentelemetry.io/otel/sdk/metric v1.43.0/go.mod h1:C/RJtwSEJ5hzTiUz5pXF1kILHStzb9zFlIEe85bhj6A=
+go.opentelemetry.io/otel/sdk/metric v1.44.0 h1:3LlKgI+VjbVsjNRFZJZAJ30WjXC5VkNRks6si09iEfI=
+go.opentelemetry.io/otel/sdk/metric v1.44.0/go.mod h1:5B5pMARnXxKhltooO4xUuCBorl65a4EpnTalObqOigA=
 go.opentelemetry.io/otel/trace v1.44.0 h1:jxF5CsGYCe74MCRx2X4g7WsY/VBKRqqpNvXlX/6gtIk=
 go.opentelemetry.io/otel/trace v1.44.0/go.mod h1:oLl1jrMQAVo6v3GAggN+1VH9VIz9iUSvW53sW1Q8PIE
```

**File**: `deployments/go.mod` (modified, +2/-2)
```diff
@@ -12,8 +12,8 @@ require (
 	github.com/clarketm/json v1.17.1
 	github.com/kubearmor/KubeArmor/KubeArmor v0.0.0-20260406102335-87edc770f8bf
 	github.com/kubearmor/KubeArmor/pkg/KubeArmorController v0.0.0-20260406102335-87edc770f8bf
-	k8s.io/api v0.36.1
-	k8s.io/apimachinery v0.36.1
+	k8s.io/api v0.36.3
+	k8s.io/apimachinery v0.36.3
 	sigs.k8s.io/yaml v1.6.0
 )
 
```

**File**: `deployments/go.sum` (modified, +4/-4)
```diff
@@ -77,12 +77,12 @@ gopkg.in/inf.v0 v0.9.1 h1:73M5CoZyi3ZLMOyDlQh031Cx6N9NDJ2Vvfl76EDAgDc=
 gopkg.in/inf.v0 v0.9.1/go.mod h1:cWUDdTG/fYaXco+Dcufb5Vnc6Gp2YChqWtbxRZE0mXw=
 gopkg.in/yaml.v3 v3.0.1 h1:fxVm/GzAzEWqLHuvctI91KS9hhNmmWOoWu0XTYJS7CA=
 gopkg.in/yaml.v3 v3.0.1/go.mod h1:K4uyk7z7BCEPqu6E+C64Yfv1cQ7kz7rIZviUmN+EgEM=
-k8s.io/api v0.36.1 h1:XbL/EMj8K2aJpJtePmqUyQMsM0D4QI2pvl7YKJ20FTY=
-k8s.io/api v0.36.1/go.mod h1:KOWo4ey3TINlXjeHVuwB3i+tXXnu+UcwFBHlI/9dvEo=
+k8s.io/api v0.36.3 h1:NxB+05W2UGqXWFXcLO0RB5cnqnUPP5v5sVlaOH0Iz4w=
+k8s.io/api v0.36.3/go.mod h1:JzLQKqRHC5+I8RVj/lS3lCg0mg6nWI9Fo/Sk3ElxHzg=
 k8s.io/apiextensions-apiserver v0.36.1 h1:6JfYmPUsuUIHuN+3QxutXYWj492RqF5fBSx67GYK5Ks=
 k8s.io/apiextensions-apiserver v0.36.1/go.mod h1:pLzZin90riwisdzKwv/GoTwENooytoIx5zWJb4Hkby8=
-k8s.io/apimachinery v0.36.1 h1:G63Gjx2W+q0YD+72Vo8oY0nDnePVwnuzTmmy5ENrVSA=
-k8s.io/apimachinery v0.36.1/go.mod h1:ibYOR00vW/I1kzvi5SF0dRuJ52BvKtfvRdOn35GPQ+8=
+k8s.io/apimachinery v0.36.3 h1:PkzMRBRG8joFD8EhCuQAtNPvJlxb82FwplP26HIzvAM=
+k8s.io/apimachinery v0.36.3/go.mod h1:cTSjBWgPe/6CQyBKzY/hDIRWCQQQeK0mfLbml0UYFHE=
 k8s.io/klog/v2 v2.140.0 h1:Tf+J3AH7xnUzZyVVXhTgGhEKnFqye14aadWv7bzXdzc=
 k8s.io/klog/v2 v2.140.0/go.mod h1:o+/RWfJ6PwpnFn7OyAG3QnO47BFsymfEfrz6XyYSSp0=
 k8s.io/kube-openapi v0.0.0-20260520065146-aa012df4f4af h1:zLXA2Irn14q2/06WMkxViyr7YCPUO2lJ0QYE9Juy5vA=
```

**File**: `deployments/podman/go.mod` (modified, +2/-2)
```diff
@@ -120,7 +120,7 @@ require (
 	go.podman.io/image/v5 v5.40.0 // indirect
 	go.podman.io/storage v1.63.1-0.20260519201413-7e9ee2072844 // indirect
 	go.yaml.in/yaml/v2 v2.4.4 // indirect
-	golang.org/x/crypto v0.55.0 // indirect
+	golang.org/x/crypto v0.56.0 // indirect
 	golang.org/x/mod v0.40.0 // indirect
 	golang.org/x/net v0.58.0 // indirect
 	golang.org/x/sync v0.22.0 // indirect
@@ -130,7 +130,7 @@ require (
 	golang.org/x/tools v0.49.0 // indirect
 	google.golang.org/genproto/googleapis/api v0.0.0-20260526163538-3dc84a4a5aaa // indirect
 	google.golang.org/genproto/googleapis/rpc v0.0.0-20260526163538-3dc84a4a5aaa // indirect
-	google.golang.org/grpc v1.82.1 // indirect
+	google.golang.org/grpc v1.83.2 // indirect
 	google.golang.org/protobuf v1.36.12-0.20260120151049-f2248ac996af // indirect
 	gopkg.in/inf.v0 v0.9.1 // indirect
 	gopkg.in/tomb.v1 v1.0.0-20141024135613-dd632973f1e7 // indirect
```

---

### Incident Patch 2: `fcdb0652` (2026-09-11)
**Commit Message**: fix missing vmlinux.h in ci (#2897)

Signed-off-by: Aryan-sharma11 <aryan1126.sharma@gmail.com>

**File**: `.github/workflows/ci-latest-release.yml` (modified, +11/-0)
```diff
@@ -73,6 +73,17 @@ jobs:
       - name: Compile libbpf
         run: ./.github/workflows/install-libbpf.sh
 
+      - name: Install bpftool
+        run: ./.github/workflows/install-bpftool.sh
+
+      - name: Generate vmlinux.h
+        run: make -C BPF kernel_headers
+        working-directory: KubeArmor
+
+      - name: Generate BPF files
+        run: go generate ./...
+        working-directory: KubeArmor
+
       - name: Get release tag
         id: vars
         uses: actions/github-script@f28e40c7f34bde8b3046d885e986cb6290c5673b # v7
```

**File**: `.github/workflows/ci-latest-ubi-release.yml` (modified, +11/-0)
```diff
@@ -67,6 +67,17 @@ jobs:
       - name: Compile libbpf
         run: ./.github/workflows/install-libbpf.sh
 
+      - name: Install bpftool
+        run: ./.github/workflows/install-bpftool.sh
+
+      - name: Generate vmlinux.h
+        run: make -C BPF kernel_headers
+        working-directory: KubeArmor
+
+      - name: Generate BPF files
+        run: go generate ./...
+        working-directory: KubeArmor
+
       - name: Get release tag
         id: vars
         uses: actions/github-script@f28e40c7f34bde8b3046d885e986cb6290c5673b # v7
```

**File**: `.github/workflows/ci-test-systemd.yml` (modified, +11/-0)
```diff
@@ -39,6 +39,17 @@ jobs:
           go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@v1.6.1
           echo "$(go env GOPATH)/bin" >> "$GITHUB_PATH"
 
+      - name: Install bpftool
+        run: ./.github/workflows/install-bpftool.sh
+
+      - name: Generate vmlinux.h
+        run: make -C BPF kernel_headers
+        working-directory: KubeArmor
+
+      - name: Generate BPF files
+        run: go generate ./...
+        working-directory: KubeArmor
+
       - name: Build Systemd Release
         run: make local-release
         working-directory: KubeArmor
```

---

### Incident Patch 3: `2a03082c` (2026-09-11)
**Commit Message**: fix: add fromSource support for execname in BPF-LSM enforcement (#2163)

* fix: add fromSource support for execname in BPF-LSM enforcement

Signed-off-by: Saurav Teli <telisaurav44@gmail.com>

* fix: resolve eBPF variable redeclaration in enforcer.bpf.c

Signed-off-by: Saurav Teli <telisaurav44@gmail.com>

* refactor & update test

Signed-off-by: Aryan-sharma11 <aryan1126.sharma@gmail.com>

---------

Signed-off-by: Saurav Teli <telisaurav44@gmail.com>
Signed-off-by: Aryan-sharma11 <aryan1126.sharma@gmail.com>
Co-authored-by: Aryan-sharma11 <aryan1126.sharma@gmail.com>
Co-authored-by: Aryan Sharma <54109867+Aryan-sharma11@users.noreply.github.com>

**File**: `KubeArmor/BPF/enforcer.bpf.c` (modified, +17/-2)
```diff
@@ -202,9 +202,24 @@ int BPF_PROG(enforce_proc, struct linux_binprm *bprm, int ret)
     goto decision;
   }
 
-  // match exec name
-  struct qstr d_name = BPF_CORE_READ(f_path.dentry, d_name);
+  // match exec name (with and without fromSource)
+  struct qstr d_name;
+  d_name = BPF_CORE_READ(f_path.dentry, d_name);
+  if (fromSourceCheck)
+  {
+    bpf_map_update_elem(&bufk, &two, z, BPF_ANY);
+    bpf_probe_read_str(pk->path, MAX_STRING_SIZE, d_name.name);
+    bpf_probe_read_str(pk->source, MAX_STRING_SIZE, store->source);
+
+    val = bpf_map_lookup_elem(inner, pk);
 
+    if (val && (val->processmask & RULE_EXEC))
+    {
+      match = true;
+      goto decision;
+    }
+  }
+  // match exec name without fromSource
   bpf_map_update_elem(&bufk, &two, z, BPF_ANY);
   bpf_probe_read_str(pk->path, MAX_STRING_SIZE, d_name.name);
 
```

**File**: `tests/k8s_env/ksp/ksp_test.go` (modified, +47/-2)
```diff
@@ -602,8 +602,6 @@ var _ = Describe("Ksp", func() {
 			res, err := KarmorGetTargetAlert(5*time.Second, &expect)
 			Expect(err).To(BeNil())
 			Expect(res.Found).To(BeTrue())
-
-			//ksp-group-1-allow-proc-args
 		})
 
 		It("it can block and allow process execution based on pts", func() {
@@ -650,6 +648,53 @@ var _ = Describe("Ksp", func() {
 			Expect(err).To(BeNil())
 			Expect(resLog.Found).To(BeTrue())
 		})
+		It("it can block process execution with execname and fromSource", func() {
+			if strings.Contains(K8sRuntimeEnforcer(), "apparmor") {
+				Skip("Skipping due to args rule only supported by BPFLSM")
+			}
+
+			// Apply Policy
+			err := K8sApplyFile("multiubuntu/ksp-ubuntu-1-block-proc-execname-from-source.yaml")
+			Expect(err).To(BeNil())
+
+			// Test 2: curl from another source (not bash) should be allowed
+			// Start KubeArmor Logs
+			err = KarmorLogStart("system", "multiubuntu", "Process", ub1)
+			Expect(err).To(BeNil())
+
+			// Execute curl from dash (blocked since fromSource is /bin/dash)
+			AssertCommand(ub1, "multiubuntu", []string{"bash", "-c", "curl --version"},
+				MatchRegexp("curl"), false,
+			)
+			expectLog := protobuf.Log{
+				Resource: "/usr/bin/curl",
+				Result:   "Passed",
+			}
+			res, err := KarmorGetTargetLogs(5*time.Second, &expectLog)
+			Expect(err).To(BeNil())
+			Expect(res.Found).To(BeTrue())
+
+			// Start KubeArmor Logs
+			err = KarmorLogStart("policy", "multiubuntu", "Process", ub1)
+			Expect(err).To(BeNil())
+
+			// Test 1: curl from bash should be blocked (execname + fromSource match)
+
+			AssertCommand(ub1, "multiubuntu", []string{"bash", "-c", "/bin/dash -c 'curl --version'"},
+				MatchRegexp("curl.*Permission denied"), true,
+			)
+			expect := protobuf.Alert{
+				PolicyName: "ksp-ubuntu-1-block-proc-execname-from-source",
+				Severity:   "5",
+				Action:     "Block",
+				Result:     "Permission denied",
+			}
+
+			res, err = KarmorGetTargetAlert(5*time.Second, &expect)
+			Expect(err).To(BeNil())
+			Expect(res.Found).To(BeTrue())
+		})
+
 	})
 
 	Describe("Apply Files Policies", func() {
```

**File**: `tests/k8s_env/ksp/multiubuntu/ksp-ubuntu-1-block-proc-execname-from-source.yaml` (added, +23/-0)
```diff
@@ -0,0 +1,23 @@
+apiVersion: security.kubearmor.com/v1
+kind: KubeArmorPolicy
+metadata:
+  name: ksp-ubuntu-1-block-proc-execname-from-source
+  namespace: multiubuntu
+spec:
+  severity: 5
+  message: "block executing curl from bash using execname"
+  selector:
+    matchLabels:
+      container: ubuntu-1
+  process:
+    matchPaths:
+    - execname: curl
+      fromSource:
+      - path: /bin/dash
+  action:
+    Block
+
+# Test for issue #1899 fix: execname + fromSource support in BPF-LSM
+# This policy blocks curl execution when called from /bin/dash
+# Before the fix, this would fail - the fromSource check was not implemented for execname
+# After the fix, this should properly block: Dash -c "curl http://example.com"
```

**File**: `tests/util/karmorlog.go` (modified, +0/-1)
```diff
@@ -67,7 +67,6 @@ func KarmorGetTargetLogs(timeout time.Duration, target *pb.Log) (EventResult, er
 			if evtin.Type == "Log" {
 				protojson.Unmarshal(evtin.Data, &logItem)
 				res.Logs = append(res.Logs, &logItem)
-				// fmt.Printf("Log: %s\n", &logItem)
 			} else if evtin.Type != "Alert" {
 				log.Errorf("UNKNOWN EVT type %s", evtin.Type)
 			}
```

---

### Incident Patch 4: `66edf455` (2026-09-09)
**Commit Message**: cert: fix GenerateCA returning nil error on self-signed cert failure (#2802)

* cert: fix GenerateCA returning nil error on self-signed cert failure

When GenerateSelfSignedCert failed inside GenerateCA, the error was logged
and discarded, returning &CertBytes{} with a nil error. This caused callers to
mistakenly treat CA generation failures as successful.

Propagate the error returned by GenerateSelfSignedCert when self-signed certificate
generation fails, ensuring calling code receives error notifications.

Signed-off-by: bhuvan-somisetty <somisettybhuvan5@gmail.com>

* cert: log self-signed ca cert failure and avoid mutating default CA config in tests

Address review feedback:

- GenerateCA now logs the self-signed cert failure before returning the
  error, matching the logging style used elsewhere in the file.
- cert tests take a value copy of DefaultKubeArmorCAConfig instead of
  taking its address, so the package-level default is not mutated for
  the rest of the test process.

Signed-off-by: bhuvan-somisetty <somisettybhuvan5@gmail.com>

---------

Signed-off-by: bhuvan-somisetty <somisettybhuvan5@gmail.com>

**File**: `KubeArmor/cert/cert.go` (modified, +6/-1)
```diff
@@ -208,7 +208,8 @@ func GenerateCA(cfg *CertConfig) (*CertBytes, error) {
 	}
 	crtBytes, err := GenerateSelfSignedCert(crtTemp, cfg)
 	if err != nil {
-		return &CertBytes{}, nil
+		klog.Errorf("error generating self-signed ca cert: %s\n", err)
+		return &CertBytes{}, err
 	}
 	return &CertBytes{
 		Crt: crtBytes.Crt,
@@ -246,6 +247,10 @@ func GenerateCert(cfg *CertConfig) (*CertKeyPair, error) {
 
 // GenerateSelfSignedCert func generates cert and key signed by provided CA
 func GenerateSelfSignedCert(ca *CertKeyPair, cfg *CertConfig) (*CertBytes, error) {
+	if ca == nil || ca.Crt == nil || ca.Key == nil {
+		return nil, fmt.Errorf("invalid CA certificate or key")
+	}
+
 	certKeyPair, err := GenerateCert(cfg)
 	if err != nil {
 		return nil, err
```

**File**: `KubeArmor/cert/cert_test.go` (added, +68/-0)
```diff
@@ -0,0 +1,68 @@
+// SPDX-License-Identifier: Apache-2.0
+// Copyright 2026 Authors of KubeArmor
+
+package cert
+
+import (
+	"testing"
+	"time"
+)
+
+func TestGenerateCA_Success(t *testing.T) {
+	// take a value copy so the package-level default stays untouched
+	cfg := DefaultKubeArmorCAConfig
+	cfg.NotAfter = time.Now().Add(24 * time.Hour)
+
+	caBytes, err := GenerateCA(&cfg)
+	if err != nil {
+		t.Fatalf("expected no error generating CA, got: %v", err)
+	}
+
+	if len(caBytes.Crt) == 0 {
+		t.Errorf("expected non-empty CA certificate bytes")
+	}
+
+	if len(caBytes.Key) == 0 {
+		t.Errorf("expected non-empty CA key bytes")
+	}
+}
+
+func TestGenerateCA_ErrorPropagationOnSelfSignedCertFailure(t *testing.T) {
+	// take a value copy so the package-level default stays untouched
+	cfg := DefaultKubeArmorCAConfig
+
+	// 1. Test GenerateSelfSignedCert with invalid/nil CA struct returns error
+	_, err := GenerateSelfSignedCert(nil, &cfg)
+	if err == nil {
+		t.Errorf("expected error when generating self-signed cert with nil CA, got nil")
+	}
+
+	_, err = GenerateSelfSignedCert(&CertKeyPair{}, &cfg)
+	if err == nil {
+		t.Errorf("expected error when generating self-signed cert with empty CertKeyPair, got nil")
+	}
+
+	// 2. Test GenerateCA error propagation when inner GenerateSelfSignedCert fails with uninitialized CA key
+	invalidCA := &CertKeyPair{}
+	_, err = GenerateSelfSignedCert(invalidCA, &cfg)
+	if err == nil {
+		t.Errorf("expected error from GenerateSelfSignedCert with uninitialized CA key, got nil")
+	}
+}
+
+func TestGetCertPaths(t *testing.T) {
+	caPath := GetCACertPath("/etc/kubearmor")
+	if caPath.CertFile != "ca.crt" || caPath.KeyFile != "ca.key" {
+		t.Errorf("unexpected CA cert paths: %+v", caPath)
+	}
+
+	clientPath := GetClientCertPath("/etc/kubearmor")
+	if clientPath.CertFile != "client.crt" || clientPath.KeyFile != "client.key" {
+		t.Errorf("unexpected client cert paths: %+v", clientPath)
+	}
+
+	serverPath := GetServerCertPath("/etc/kubearmor")
+	if serverPath.CertFile != "server.crt" || serverPath.KeyFile != "server.key" {
+		t.Errorf("unexpected server cert paths: %+v", serverPath)
+	}
+}
```

---

### Incident Patch 5: `a3887c17` (2026-09-08)
**Commit Message**: fix(presets): stop writing ContainerMap under RLock in anonmapexec (#2797)

UpdateSecurityPolicies wrote ContainerMap while holding RLock, allowing concurrent writers and racing with other lock holders. Match the other presets: read under RLock, then write under Lock.

Signed-off-by: lakshit verma <vermalucky2004@gmail.com>

**File**: `KubeArmor/presets/anonmapexec/preset.go` (modified, +3/-2)
```diff
@@ -285,19 +285,20 @@ func (p *Preset) UpdateSecurityPolicies(endPoint tp.EndPoint) {
 					p.ContainerMapLock.RLock()
 					// Check if Container ID is registered in Map or not
 					ckv, ok := p.ContainerMap[cid]
+					p.ContainerMapLock.RUnlock()
 					if !ok {
 						// It maybe possible that CRI has unregistered the containers but K8s construct still has not sent this update while the policy was being applied,
 						// so the need to check if the container is present in the map before we apply policy.
-						p.ContainerMapLock.RUnlock()
 						return
 					}
 					base.UpdateMatchPolicy(&ckv, &secPolicy)
+					p.ContainerMapLock.Lock()
 					p.ContainerMap[cid] = ckv
 					err := p.AddContainerIDToMap(cid, ckv.NsKey, preset.Action)
 					if err != nil {
 						p.Logger.Warnf("Updating policy for container %s :%s ", cid, err)
 					}
-					p.ContainerMapLock.RUnlock()
+					p.ContainerMapLock.Unlock()
 				}
 			}
 		}
```

---

### Incident Patch 6: `3ff6389c` (2026-09-08)
**Commit Message**: ci: fix controller test (#2882)

Signed-off-by: Aryan Bakliwal <aryanbakliwal12345@gmail.com>

**File**: `.github/workflows/ci-test-controllers.yml` (modified, +11/-2)
```diff
@@ -41,13 +41,22 @@ jobs:
         run: ./.github/workflows/install-k3s.sh
 
       - name: Install the latest LLVM toolchain
-        if: steps.filter.outputs.kubearmor == 'true'
         run: ./.github/workflows/install-llvm.sh
 
       - name: Compile libbpf
-        if: steps.filter.outputs.kubearmor == 'true'
         run: ./.github/workflows/install-libbpf.sh
 
+      - name: Install bpftool
+        run: ./.github/workflows/install-bpftool.sh
+
+      - name: Generate vmlinux.h
+        run: make -C BPF kernel_headers
+        working-directory: KubeArmor
+
+      - name: Generate BPF files
+        run: go generate ./...
+        working-directory: KubeArmor
+
       - name: Generate KubeArmor artifacts
         if: steps.filter.outputs.kubearmor == 'true'
         run: GITHUB_SHA=$GITHUB_SHA ./KubeArmor/build/build_kubearmor.sh
```

---

### Incident Patch 7: `d2b74de4` (2026-08-01)
**Commit Message**: fix: accept boolean OCI hooks values

Signed-off-by: wattmto <dev@wattmto.dev>

**File**: `pkg/KubeArmorOperator/common/defaults.go` (modified, +2/-2)
```diff
@@ -603,9 +603,9 @@ func GetOCIHooks() bool {
 	val := os.Getenv("KUBEARMOR_OCI_HOOKS")
 	if val != "" {
 		switch val {
-		case "yes":
+		case "yes", "true":
 			return true
-		case "no":
+		case "no", "false":
 			return false
 		default:
 			return false
```

**File**: `pkg/KubeArmorOperator/common/defaults_test.go` (added, +27/-0)
```diff
@@ -0,0 +1,27 @@
+// SPDX-License-Identifier: Apache-2.0
+// Copyright 2026 Authors of KubeArmor
+
+package common
+
+import "testing"
+
+func TestGetOCIHooks(t *testing.T) {
+	tests := []struct {
+		name     string
+		value    string
+		expected bool
+	}{
+		{name: "operator", value: "yes", expected: true},
+		{name: "snitch", value: "true", expected: true},
+	}
+
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			t.Setenv("KUBEARMOR_OCI_HOOKS", tt.value)
+
+			if got := GetOCIHooks(); got != tt.expected {
+				t.Errorf("GetOCIHooks() = %v, want %v", got, tt.expected)
+			}
+		})
+	}
+}
```

---

### Incident Patch 8: `1f4f6fb8` (2026-09-02)
**Commit Message**: fix node version and add skip-validate flag (#2859)

Signed-off-by: Aryan-sharma11 <aryan1126.sharma@gmail.com>

**File**: `.github/workflows/ci-systemd-release.yml` (modified, +2/-2)
```diff
@@ -109,11 +109,11 @@ jobs:
           yq -i '.builds[0].goarch = ["${{ matrix.arch }}"]' /tmp/.goreleaser.yaml
 
       - name: Run GoReleaser
-        uses: goreleaser/goreleaser-action@9c156ee8a17a598857849441385a2041ef570552
+        uses: goreleaser/goreleaser-action@5daf1e915a5f0af01ddbcd89a43b8061ff4f1a89 # v7.2.2
         with:
           distribution: goreleaser
           version: v1.25.0
-          args: release --config=/tmp/.goreleaser.yaml
+          args: release --config=/tmp/.goreleaser.yaml --skip-validate --clean
           workdir: KubeArmor
         env:
           GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**File**: `.github/workflows/ci-test-systemd.yml` (modified, +1/-1)
```diff
@@ -26,7 +26,7 @@ jobs:
         run: ./.github/workflows/install-libbpf.sh
 
       - name: Install GoReleaser
-        uses: goreleaser/goreleaser-action@b953231f81b8dfd023c58e0854a721e35037f28b # v2
+        uses: goreleaser/goreleaser-action@5daf1e915a5f0af01ddbcd89a43b8061ff4f1a89 # v7.2.2
         with:
           install-only: true
           version: v1.25.0
```

---

### Incident Patch 9: `9832b415` (2026-09-01)
**Commit Message**: fix(ci): fix cd path in systemd release and update scorecard-action to v2.4.4 (#2858)

Signed-off-by: asmit27rai <raiasmit10@gmail.com>

**File**: `.github/workflows/ci-systemd-release.yml` (modified, +1/-1)
```diff
@@ -93,7 +93,7 @@ jobs:
       - name: Build KubeArmor object files
         run: |
           make
-          cd ../KubeArmor
+          cd ..
           go generate ./...
         working-directory: KubeArmor/BPF
 
```

**File**: `.github/workflows/scorecard.yml` (modified, +1/-1)
```diff
@@ -37,7 +37,7 @@ jobs:
           persist-credentials: false
 
       - name: "Run analysis"
-        uses: ossf/scorecard-action@62b2cac7ed8198b15735ed49ab1e5cf35480ba46 # v2.4.0
+        uses: ossf/scorecard-action@2d1146689b8cda280b9bc96326124645441f03bc # v2.4.4
         with:
           results_file: results.sarif
           results_format: sarif
```

---

### Incident Patch 10: `eae0c964` (2026-08-31)
**Commit Message**: chore: fix compiler warning in system monitor (#2848)

* fix compilation warning

Signed-off-by: Aryan-sharma11 <aryan1126.sharma@gmail.com>

* fix build status badge

Signed-off-by: Aryan-sharma11 <aryan1126.sharma@gmail.com>

---------

Signed-off-by: Aryan-sharma11 <aryan1126.sharma@gmail.com>

**File**: `KubeArmor/BPF/system_monitor.c` (modified, +8/-7)
```diff
@@ -126,11 +126,13 @@
 #define PT_REGS_PARM6(x) ((x)->regs[5])
 #endif
 
+#ifndef ntohs
 #if __BYTE_ORDER__ == __ORDER_LITTLE_ENDIAN__
 #define ntohs(x) __builtin_bswap16(x)
 #else
 #define ntohs(x) (x)
 #endif
+#endif
 
 #define UNDEFINED_SYSCALL 1000
 
@@ -2530,11 +2532,11 @@ int kretprobe__inet_csk_accept(struct pt_regs *ctx)
     return 0;
 }
 
-
 #define UDPHDR_LEN 8
 
 SEC("kprobe/udp_send_skb")
-int kprobe__udp_send_skb(struct pt_regs *ctx){
+int kprobe__udp_send_skb(struct pt_regs *ctx)
+{
 
     if (skip_syscall())
         return 0;
@@ -2543,15 +2545,15 @@ int kprobe__udp_send_skb(struct pt_regs *ctx){
         return 0;
 
     struct sk_buff *skb = (struct sk_buff *)PT_REGS_PARM1(ctx);
-    struct flowi4  *fl4 = (struct flowi4 *)PT_REGS_PARM2(ctx);
+    struct flowi4 *fl4 = (struct flowi4 *)PT_REGS_PARM2(ctx);
     if (skb == NULL || fl4 == NULL)
         return 0;
 
     struct sock *sk = NULL;
     bpf_probe_read(&sk, sizeof(sk), &skb->sk);
     if (sk == NULL)
         return 0;
-    
+
     __u16 dport = 0;
     bpf_probe_read(&dport, sizeof(dport), &fl4->uli.ports.dport);
     dport = ntohs(dport);
@@ -2580,18 +2582,17 @@ int kprobe__udp_send_skb(struct pt_regs *ctx){
     if (context.retval >= 0 && drop_syscall(_DNS_PROBE))
         return 0;
 
-     if (context.retval < 0 && !get_kubearmor_config(_ENFORCER_BPFLSM) &&
+    if (context.retval < 0 && !get_kubearmor_config(_ENFORCER_BPFLSM) &&
         get_kubearmor_config(_ALERT_THROTTLING) &&
         should_drop_alerts_per_container(&context, ctx, types, &args))
         return 0;
-    
+
     set_buffer_offset(DNS_BUF_TYPE, sizeof(sys_context_t));
     bufs_t *bufs_p = get_buffer(DNS_BUF_TYPE);
     if (bufs_p == NULL)
         return 0;
     save_context_to_buffer(bufs_p, (void *)&context);
 
-
     struct sock_common conn = READ_KERN(sk->__sk_common);
     struct sockaddr_in sockv4 = {};
     sockv4.sin_family = conn.skc_family;
```

**File**: `README.md` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 ![](.gitbook/assets/logo.png)
 
-[![Build Status](https://github.com/kubearmor/KubeArmor/actions/workflows/ci-test-ginkgo.yml/badge.svg)](https://github.com/kubearmor/KubeArmor/actions/workflows/ci-test-ginkgo.yml/)
+[![Build Status](https://github.com/kubearmor/KubeArmor/actions/workflows/ci-test-suite.yml/badge.svg)](https://github.com/kubearmor/KubeArmor/actions/workflows/ci-test-suite.yml/)
 [![CII Best Practices](https://bestpractices.coreinfrastructure.org/projects/5401/badge)](https://bestpractices.coreinfrastructure.org/projects/5401)
 [![CLOMonitor](https://img.shields.io/endpoint?url=https://clomonitor.io/api/projects/cncf/kubearmor/badge)](https://clomonitor.io/projects/cncf/kubearmor)
 [![OpenSSF Scorecard](https://api.securityscorecards.dev/projects/github.com/kubearmor/kubearmor/badge)](https://securityscorecards.dev/viewer/?uri=github.com/kubearmor/KubeArmor)
```

#### Recent Merged Pull Requests:
- **PR #2908** (closed): build(deps): bump go.opentelemetry.io/otel/sdk from 1.44.0 to 1.45.0 in /pkg/KubeArmorController (@dependabot[bot])
- **PR #2905** (2026-09-23): feat: Group dependency updates into one PR (@Abhayanthk)
- **PR #2899** (2026-09-15): chore(deps): fix vulnerabilities (@vanshika2720)
- **PR #2897** (2026-09-11): fix missing vmlinux.h in ci (@Aryan-sharma11)
- **PR #2894** (2026-09-11): use hostname as namespace for containers instead of `container_namespace` (@Aryan-sharma11)
- **PR #2893** (2026-09-11): chore: prepare charts for v1.7.5 release (@Aryan-sharma11)
- **PR #2892** (2026-09-11): improve policy matching for execname events (@Aryan-sharma11)
- **PR #2889** (closed): build(deps): bump github.com/containerd/containerd/v2 from 2.3.2 to 2.3.5 in /pkg/KubeArmorOperator (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

# Verification Protocol: Verification Protocol: Empirical Defect Shield for clickhouse-clickhouse-learnings

<!-- PROVENANCE_START
{
  "source_repository": "clickhouse-clickhouse-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-17T14:58:11.931Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-clickhouse-clickhouse-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [clickhouse-clickhouse-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-17T14:58:11.931Z`  
> **Learning ID**: `LEARN-EVO-clickhouse-clickhouse-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `clickhouse-clickhouse-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/clickhouse-clickhouse-learnings.md`  
> **Source**: github ([https://github.com/ClickHouse/ClickHouse](https://github.com/ClickHouse/ClickHouse))  
> **Source Version**: `67804652`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-17T14:58:06.860Z  
> **Learning ID**: `learn-github-clickhouse-clickhouse`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): ClickHouse/ClickHouse

> **Canonical Artifact**: `07_PROJECT_LEARNING/clickhouse-clickhouse-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/ClickHouse/ClickHouse](https://github.com/ClickHouse/ClickHouse))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-17T14:58:06.855Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `ClickHouse/ClickHouse`
- **Description**: ClickHouse® is a real-time analytics database management system
- **Primary Language / Ecosystem**: C++
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 50971 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.claude/hooks/allow_investigate_cmds.py`
```
#!/usr/bin/env python3
"""PreToolUse hook for the investigate-ci reduced-prompt profile.

Auto-approves ONLY the exact safe command shapes the skill runs every time, so
they need no allow-list entry (whose wildcard tail cannot be constrained) and no
prompt. Three families:

  1. The play.clickhouse.com read-only SELECT history query.
  2. node .claude/tools/fetch_ci_report.js against known CI-report hosts, with
     only read/report flags (NO file-writing forms).
  3. mkdir -p tmp/investigate/<sha> where <sha> is 7-40 lowercase hex chars only
     (no path separators, no traversal, no shell composition).

The hook never auto-approves a write: --download-logs and stdout redirection are
deliberately excluded, because a string-pinned path cannot be made symlink-safe
(a planted tmp/investigate symlink would redirect the write outside). Those write
forms, and everything else, fall through to the normal permission prompt -- this
is an allowlist (default-deny). Both families also reject shell composition/
substitution, so the dangerous variants (curl --data-binary @<file>, $(...), a
second piped command, an arbitrary URL/host) prompt instead of running.

Output contract: print a PreToolUse "allow" decision only on a match; otherwise
print nothing and exit 0 so normal handling (the prompt) runs. Never emits "deny".
"""
import json
import re
import sys

# --- Family 1: the play.clickhouse.com read-only SELECT query -----------------
# Quote-delimited body that must start with SELECT and contain no " $ ` -- so
# @file, a second --data-binary, and $(...)/backtick substitution all fail.
PLAY = re.compile(
    r"""curl -sS 'https://play\.clickhouse\.com/\?user=play' --data-binary "\s*SELECT[^"$`]*\""""
)

# --- Family 2: fetch_ci_report.js against known CI-report hosts ---------------
# Full-match allowlist. The URL is quote-delimited and excludes " $ ` so it
# cannot break out or inject substitution, even though it may contain & ? = (a
# query string). Flags are an allowlist; --download-logs and stdout redirect are
# pinned to tmp/investigate. Anything outside this exact structure -- chaining,
# pipes, extra redirects, other hosts/flags -- fails to match and prompts.
FETCH = re.compile(
    r"node \.claude/tools/fetch_ci_report\.js "
    r'"(?:https://s3\.amazonaws\.com/clickhouse-test-reports/'
    r"|https://d1k2gkhrlfqv31\.cloudfront\.net/clickhouse-test-reports-private/"
    r'|https://github\.com/ClickHouse/ClickHouse/(?:pull|issues)/)[^"$`]*"'
    r"(?: (?:--failed|--cidb|--all|--links|--binary"
    r"|--report [0-9]+"
    r"|--credentials [^\s\"$`;|&<>]+))*"
    r"(?: 2>&1| 2>/dev/null)?"
)


def play_ok(command: str) -> bool:
    return bool(PLAY.fullmatch(command))


def fetch_ok(command: str) -> bool:
    # Reject path traversal: the tmp/investigate path class permits '.', so '..'
    # would otherwise let --download-logs / > escape the scratch dir. Legit fetch
    # commands (URL + flags + tmp paths) never contain '..'.
    if ".." in command:
        return False
    return bool(FETCH.fullmatch(command))


# --- Family 3: mkdir for SHA working subdirectory ---
# Accepts only mkdir -p tmp/investigate/<7-40 lowercase hex chars>. The hex
# character class structurally excludes '/' and '.', so path traversal and nested
# subdirs are impossible to match. The end anchor blocks shell composition.
MKDIR_SHA = re.compile(r"mkdir -p tmp/investigate/[0-9a-f]{7,40}$")


def mkdir_sha_ok(command: str) -> bool:
    return bool(MKDIR_SHA.fullmatch(command))


def main() -> None:
    try:
        data = json.load(sys.stdin)
    except Exception:
        return  # malformed input -> no decision -> prompt

    if data.get("tool_name") != "Bash":
        return

    command = data.get("tool_input", {}).get("command", "").strip()
    if play_ok(command) or fetch_ok(command) or mkdir_sha_ok(command):
        print(
            json.dumps(
                {
                    "hookSpecificOutput": {
                        "hookEventName": "PreToolUse",
                        "permissionDecision": "allow",
                        "permissionDecisionReason": "exact read-only investigate-ci command shape",
                    }
                }
            )
        )


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `base/poco/Foundation/include/Poco/DigestEngine.h`
```
//
// DigestEngine.h
//
// Library: Foundation
// Package: Crypt
// Module:  DigestEngine
//
// Definition of class DigestEngine.
//
// Copyright (c) 2004-2006, Applied Informatics Software Engineering GmbH.
// and Contributors.
//
// SPDX-License-Identifier:	BSL-1.0
//


#ifndef Foundation_DigestEngine_INCLUDED
#define Foundation_DigestEngine_INCLUDED


#include <vector>
#include "Poco/Foundation.h"


namespace Poco
{


class Foundation_API DigestEngine
/// This class is an abstract base class
/// for all classes implementing a message
/// digest algorithm, like MD5Engine
/// and SHA1Engine.
/// Call update() repeatedly with data to
/// compute the digest from. When done,
/// call digest() to obtain the message
/// digest.
{
public:
    typedef std::vector<unsigned char> Digest;

    DigestEngine();
    virtual ~DigestEngine();

    void update(const void * data, std::size_t length);
    void update(char data);
    void update(const std::string & data);
    /// Updates the digest with the given data.

    virtual std::size_t digestLength() const = 0;
    /// Returns the length of the digest in bytes.

    virtual void reset() = 0;
    /// Resets the engine so that a new
    /// digest can be computed.

    virtual const Digest & digest() = 0;
    /// Finishes the computation of the digest and
    /// returns the message digest. Resets the engine
    /// and can thus only be called once for every digest.
    /// The returned reference is valid until the next
    /// time digest() is called, or the engine object is destroyed.

    static std::string digestToHex(const Digest & bytes);
    /// Converts a message digest into a string of hexadecimal numbers.

    static Digest digestFromHex(const std::string & digest);
    /// Converts a string created by digestToHex back to its Digest presentation

    static bool constantTimeEquals(const Digest & d1, const Digest & d2);
    /// Compares two Digest values using a constant-time comparison
    /// algorithm. This can be used to prevent timing attacks
    /// (as discussed in <https://web.archive.org/web/20090901005747/http://codahale.com/a-lesson-in-timing-attacks/>).

protected:
    virtual void updateImpl(const void * data, std::size_t length) = 0;
    /// Updates the digest with the given data. Must be implemented
    /// by subclasses.

private:
    DigestEngine(const DigestEngine &);
    DigestEngine & operator=(const DigestEngine &);
};


//
// inlines
//


inline void DigestEngine::update(const void * data, std::size_t length)
{
    updateImpl(data, length);
}


inline void DigestEngine::update(char data)
{
    updateImpl(&data, 1);
}


inline void DigestEngine::update(const std::string & data)
{
    updateImpl(data.data(), data.size());
}


} // namespace Poco


#endif // Foundation_DigestEngine_INCLUDED

```

### Core Architecture Module: `base/poco/Foundation/include/Poco/HMACEngine.h`
```
//
// HMACEngine.h
//
// Library: Foundation
// Package: Crypt
// Module:  HMACEngine
//
// Definition of the HMACEngine class.
//
// Copyright (c) 2004-2006, Applied Informatics Software Engineering GmbH.
// and Contributors.
//
// SPDX-License-Identifier:	BSL-1.0
//


#ifndef Foundation_HMACEngine_INCLUDED
#define Foundation_HMACEngine_INCLUDED


#include <cstring>
#include "Poco/DigestEngine.h"
#include "Poco/Foundation.h"


namespace Poco
{


template <class Engine>
class HMACEngine : public DigestEngine
/// This class implements the HMAC message
/// authentication code algorithm, as specified
/// in RFC 2104. The underlying DigestEngine
/// (MD5Engine, SHA1Engine, etc.) must be given as
/// template argument.
/// Since the HMACEngine is a DigestEngine, it can
/// be used with the DigestStream class to create
/// a HMAC for a stream.
{
public:
    enum
    {
        BLOCK_SIZE = Engine::BLOCK_SIZE,
        DIGEST_SIZE = Engine::DIGEST_SIZE
    };

    HMACEngine(const std::string & passphrase) { init(passphrase.data(), passphrase.length()); }

    HMACEngine(const char * passphrase, std::size_t length)
    {
        poco_check_ptr(passphrase);

        init(passphrase, length);
    }

    ~HMACEngine()
    {
        std::memset(_ipad, 0, BLOCK_SIZE);
        std::memset(_opad, 0, BLOCK_SIZE);
        delete[] _ipad;
        delete[] _opad;
    }

    std::size_t digestLength() const { return DIGEST_SIZE; }

    void reset()
    {
        _engine.reset();
        _engine.update(_ipad, BLOCK_SIZE);
    }

    const DigestEngine::Digest & digest()
    {
        const DigestEngine::Digest & d = _engine.digest();
        char db[DIGEST_SIZE];
        char * pdb = db;
        for (DigestEngine::Digest::const_iterator it = d.begin(); it != d.end(); ++it)
            *pdb++ = *it;
        _engine.reset();
        _engine.update(_opad, BLOCK_SIZE);
        _engine.update(db, DIGEST_SIZE);
        const DigestEngine::Digest & result = _engine.digest();
        reset();
        return result;
    }

protected:
    void init(const char * passphrase, std::size_t length)
    {
        _ipad = new char[BLOCK_SIZE];
        _opad = new char[BLOCK_SIZE];
        std::memset(_ipad, 0, BLOCK_SIZE);
        std::memset(_opad, 0, BLOCK_SIZE);
        if (length > BLOCK_SIZE)
        {
            _engine.reset();
            _engine.update(passphrase, length);
            const DigestEngine::Digest & d = _engine.digest();
            char * ipad = _ipad;
            char * opad = _opad;
            int n = BLOCK_SIZE;
            for (DigestEngine::Digest::const_iterator it = d.begin(); it != d.end() && n-- > 0; ++it)
            {
                *ipad++ = *it;
                *opad++ = *it;
            }
        }
        else
        {
            std::memcpy(_ipad, passphrase, length);
            std::memcpy(_opad, passphrase, length);
        }
        for (int i = 0; i < BLOCK_SIZE; ++i)
        {
            _ipad[i] ^= 0x36;
            _opad[i] ^= 0x5c;
        }
        reset();
    }

    void updateImpl(const void * data, std::size_t length) { _engine.update(data, length); }

private:
    HMACEngine();
    HMACEngine(const HMACEngine &);
    HMACEngine & operator=(const HMACEngine &);

    Engine _engine;
    char * _ipad;
    char * _opad;
};


} // namespace Poco


#endif // Foundation_HMACEngine_INCLUDED

```

### Core Architecture Module: `base/poco/Foundation/include/Poco/MD5Engine.h`
```
//
// MD5Engine.h
//
// Library: Foundation
// Package: Crypt
// Module:  MD5Engine
//
// Definition of class MD5Engine.
//
// Copyright (c) 2004-2006, Applied Informatics Software Engineering GmbH.
// and Contributors.
//
// SPDX-License-Identifier:	BSL-1.0
//
//
// MD5 (RFC 1321) algorithm:
// Copyright (C) 1991-2, RSA Data Security, Inc. Created 1991. All
// rights reserved.
//
// License to copy and use this software is granted provided that it
// is identified as the "RSA Data Security, Inc. MD5 Message-Digest
// Algorithm" in all material mentioning or referencing this software
// or this function.
//
// License is also granted to make and use derivative works provided
// that such works are identified as "derived from the RSA Data
// Security, Inc. MD5 Message-Digest Algorithm" in all material
// mentioning or referencing the derived work.
//
// RSA Data Security, Inc. makes no representations concerning either
// the merchantability of this software or the suitability of this
// software for any particular purpose. It is provided "as is"
// without express or implied warranty of any kind.
//
// These notices must be retained in any copies of any part of this
// documentation and/or software.
//


#ifndef Foundation_MD5Engine_INCLUDED
#define Foundation_MD5Engine_INCLUDED


#include "Poco/DigestEngine.h"
#include "Poco/Foundation.h"


namespace Poco
{


class Foundation_API MD5Engine : public DigestEngine
/// This class implements the MD5 message digest algorithm,
/// described in RFC 1321.
{
public:
    enum
    {
        BLOCK_SIZE = 64,
        DIGEST_SIZE = 16
    };

    MD5Engine();
    ~MD5Engine();

    std::size_t digestLength() const;
    void reset();
    const DigestEngine::Digest & digest();

protected:
    void updateImpl(const void * data, std::size_t length);

private:
    static void transform(UInt32 state[4], const unsigned char block[64]);
    static void encode(unsigned char * output, const UInt32 * input, std::size_t len);
    static void decode(UInt32 * output, const unsigned char * input, std::size_t len);

    struct Context
    {
        UInt32 state[4]; // state (ABCD)
        UInt32 count[2]; // number of bits, modulo 2^64 (lsb first)
        unsigned char buffer[64]; // input buffer
    };

    Context _context;
    DigestEngine::Digest _digest;

    MD5Engine(const MD5Engine &);
    MD5Engine & operator=(const MD5Engine &);
};


} // namespace Poco


#endif // Foundation_MD5Engine_INCLUDED

```

### Core Architecture Module: `base/poco/Foundation/include/Poco/NotificationQueue.h`
```
//
// NotificationQueue.h
//
// Library: Foundation
// Package: Notifications
// Module:  NotificationQueue
//
// Definition of the NotificationQueue class.
//
// Copyright (c) 2004-2006, Applied Informatics Software Engineering GmbH.
// and Contributors.
//
// SPDX-License-Identifier:	BSL-1.0
//


#ifndef Foundation_NotificationQueue_INCLUDED
#define Foundation_NotificationQueue_INCLUDED


#include <deque>
#include "Poco/Event.h"
#include "Poco/Foundation.h"
#include "Poco/Mutex.h"
#include "Poco/Notification.h"


namespace Poco
{


class NotificationCenter;


class Foundation_API NotificationQueue
/// A NotificationQueue object provides a way to implement asynchronous
/// notifications. This is especially useful for sending notifications
/// from one thread to another, for example from a background thread to
/// the main (user interface) thread.
///
/// The NotificationQueue can also be used to distribute work from
/// a controlling thread to one or more worker threads. Each worker thread
/// repeatedly calls waitDequeueNotification() and processes the
/// returned notification. Special care must be taken when shutting
/// down a queue with worker threads waiting for notifications.
/// The recommended sequence to shut down and destroy the queue is to
///   1. set a termination flag for every worker thread
///   2. call the wakeUpAll() method
///   3. join each worker thread
///   4. destroy the notification queue.
{
public:
    using NfQueue = std::deque<Notification::Ptr>;

    NotificationQueue();
    /// Creates the NotificationQueue.

    ~NotificationQueue();
    /// Destroys the NotificationQueue.

    void enqueueNotification(Notification::Ptr pNotification);
    /// Enqueues the given notification by adding it to
    /// the end of the queue (FIFO).
    /// The queue takes ownership of the notification, thus
    /// a call like
    ///     notificationQueue.enqueueNotification(new MyNotification);
    /// does not result in a memory leak.

    void enqueueUrgentNotification(Notification::Ptr pNotification);
    /// Enqueues the given notification by adding it to
    /// the front of the queue (LIFO). The event therefore gets processed
    /// before all other events already in the queue.
    /// The queue takes ownership of the notification, thus
    /// a call like
    ///     notificationQueue.enqueueUrgentNotification(new MyNotification);
    /// does not result in a memory leak.

    Notification * dequeueNotification();
    /// Dequeues the next pending notification.
    /// Returns 0 (null) if no notification is available.
    /// The caller gains ownership of the notification and
    /// is expected to release it when done with it.
    ///
    /// It is highly recommended that the result is immediately
    /// assigned to a Notification::Ptr, to avoid potential
    /// memory management issues.

    Notification * waitDequeueNotification();
    /// Dequeues the next pending notification.
    /// If no notification is available, waits for a notification
    /// to be enqueued.
    /// The caller gains ownership of the notification and
    /// is expected to release it when done with it.
    /// This method returns 0 (null) if wakeUpWaitingThreads()
    /// has been called by another thread.
    ///
    /// It is highly recommended that the result is immediately
    /// assigned to a Notification::Ptr, to avoid potential
    /// memory management issues.

    Notification * waitDequeueNotification(long milliseconds);
    /// Dequeues the next pending notification.
    /// If no notification is available, waits for a notification
    /// to be enqueued up to the specified time.
    /// Returns 0 (null) if no notification is available.
    /// The caller gains ownership of the notification and
    /// is expected to release it when done with it.
    ///
    /// It is highly recommended that the result is immediately
    /// assigned to a Notification::Ptr, to avoid potential
    /// memory management issues.

    void dispatch(NotificationCenter & notificationCenter);
    /// Dispatches all queued notifications to the given
    /// notification center.

    void wakeUpAll();
    /// Wakes up all threads that wait for a notification.

    bool empty() const;
    /// Returns true iff the queue is empty.

    int size() const;
    /// Returns the number of notifications in the queue.

    void clear();
    /// Removes all notifications from the queue.

    NfQueue getCurrentQueueAndClear();

    bool hasIdleThreads() const;
    /// Returns true if the queue has at least one thread waiting
    /// for a notification.

    static NotificationQueue & defaultQueue();
    /// Returns a reference to the default
    /// NotificationQueue.

protected:
    Notification::Ptr dequeueOne();

private:
    struct WaitInfo
    {
        Notification::Ptr pNf;
        Event nfAvailable;
    };
    typedef std::deque<WaitInfo *> WaitQueue;

    NfQueue _nfQueue;
    WaitQueue _waitQueue;
    mutable FastMutex _mutex;
};


} // namespace Poco


#endif // Foundation_NotificationQueue_INCLUDED

```

### Core Architecture Module: `base/poco/Foundation/include/Poco/PBKDF2Engine.h`
```
//
// PBKDF2Engine.h
//
// Library: Foundation
// Package: Crypt
// Module:  PBKDF2Engine
//
// Definition of the PBKDF2Engine class.
//
// Copyright (c) 2014, Applied Informatics Software Engineering GmbH.
// and Contributors.
//
// SPDX-License-Identifier:	BSL-1.0
//


#ifndef Foundation_PBKDF2Engine_INCLUDED
#define Foundation_PBKDF2Engine_INCLUDED


#include <algorithm>
#include "Poco/ByteOrder.h"
#include "Poco/DigestEngine.h"
#include "Poco/Foundation.h"


namespace Poco
{


template <class PRF>
class PBKDF2Engine : public DigestEngine
/// This class implements the Password-Based Key Derivation Function 2,
/// as specified in RFC 2898. The underlying DigestEngine (HMACEngine, etc.),
/// which must accept the passphrase as constructor argument (std::string),
/// must be given as template argument.
///
/// PBKDF2 (Password-Based Key Derivation Function 2) is a key derivation function
/// that is part of RSA Laboratories' Public-Key Cryptography Standards (PKCS) series,
/// specifically PKCS #5 v2.0, also published as Internet Engineering Task Force's
/// RFC 2898. It replaces an earlier standard, PBKDF1, which could only produce
/// derived keys up to 160 bits long.
///
/// PBKDF2 applies a pseudorandom function, such as a cryptographic hash, cipher, or
/// HMAC to the input password or passphrase along with a salt value and repeats the
/// process many times to produce a derived key, which can then be used as a
/// cryptographic key in subsequent operations. The added computational work makes
/// password cracking much more difficult, and is known as key stretching.
/// When the standard was written in 2000, the recommended minimum number of
/// iterations was 1000, but the parameter is intended to be increased over time as
/// CPU speeds increase. Having a salt added to the password reduces the ability to
/// use precomputed hashes (rainbow tables) for attacks, and means that multiple
/// passwords have to be tested individually, not all at once. The standard
/// recommends a salt length of at least 64 bits. [Wikipedia]
///
/// The PBKDF2 algorithm is implemented as a DigestEngine. The passphrase is specified
/// by calling update().
///
/// Example (WPA2):
///     PBKDF2Engine<HMACEngine<SHA1Engine> > pbkdf2(ssid, 4096, 256);
///     pbkdf2.update(passphrase);
///     DigestEngine::Digest d = pbkdf2.digest();
{
public:
    enum
    {
        PRF_DIGEST_SIZE = PRF::DIGEST_SIZE
    };

    PBKDF2Engine(const std::string & salt, unsigned c = 4096, Poco::UInt32 dkLen = PRF_DIGEST_SIZE) : _s(salt), _c(c), _dkLen(dkLen)
    {
        _result.reserve(_dkLen + PRF_DIGEST_SIZE);
    }

    ~PBKDF2Engine() { }

    std::size_t digestLength() const { return _dkLen; }

    void reset()
    {
        _p.clear();
        _result.clear();
    }

    const DigestEngine::Digest & digest()
    {
        Poco::UInt32 i = 1;
        while (_result.size() < _dkLen)
        {
            f(i++);
        }
        _result.resize(_dkLen);
        return _result;
    }

protected:
    void updateImpl(const void * data, std::size_t length) { _p.append(reinterpret_cast<const char *>(data), length); }

    void f(Poco::UInt32 i)
    {
        PRF prf(_p);
        prf.update(_s);
        Poco::UInt32 iBE = Poco::ByteOrder::toBigEndian(i);
        prf.update(&iBE, sizeof(iBE));
        Poco::DigestEngine::Digest up = prf.digest();
        Poco::DigestEngine::Digest ux = up;
        poco_assert_dbg(ux.size() == PRF_DIGEST_SIZE);
        for (unsigned k = 1; k < _c; k++)
        {
            prf.reset();
            prf.update(&up[0], up.size());
            Poco::DigestEngine::Digest u = prf.digest();
            poco_assert_dbg(u.size() == PRF_DIGEST_SIZE);
            for (int ui = 0; ui < PRF_DIGEST_SIZE; ui++)
            {
                ux[ui] ^= u[ui];
            }
            std::swap(up, u);
        }
        _result.insert(_result.end(), ux.begin(), ux.end());
    }

private:
    PBKDF2Engine();
    PBKDF2Engine(const PBKDF2Engine &);
    PBKDF2Engine & operator=(const PBKDF2Engine &);

    std::string _p;
    std::string _s;
    unsigned _c;
    Poco::UInt32 _dkLen;
    DigestEngine::Digest _result;
};


} // namespace Poco


#endif // Foundation_PBKDF2Engine_INCLUDED

```

### Core Architecture Module: `base/poco/Foundation/include/Poco/PriorityNotificationQueue.h`
```
//
// PriorityNotificationQueue.h
//
// Library: Foundation
// Package: Notifications
// Module:  PriorityNotificationQueue
//
// Definition of the PriorityNotificationQueue class.
//
// Copyright (c) 2009, Applied Informatics Software Engineering GmbH.
// and Contributors.
//
// SPDX-License-Identifier:	BSL-1.0
//


#ifndef Foundation_PriorityNotificationQueue_INCLUDED
#define Foundation_PriorityNotificationQueue_INCLUDED


#include <deque>
#include <map>
#include "Poco/Event.h"
#include "Poco/Foundation.h"
#include "Poco/Mutex.h"
#include "Poco/Notification.h"


namespace Poco
{


class NotificationCenter;


class Foundation_API PriorityNotificationQueue
/// A PriorityNotificationQueue object provides a way to implement asynchronous
/// notifications. This is especially useful for sending notifications
/// from one thread to another, for example from a background thread to
/// the main (user interface) thread.
///
/// The PriorityNotificationQueue is quite similar to the NotificationQueue class.
/// The only difference to NotificationQueue is that each Notification is tagged
/// with a priority value. When inserting a Notification into the queue, the
/// Notification is inserted according to the given priority value, with
/// lower priority values being inserted before higher priority
/// values. Therefore, the lower the numerical priority value, the higher
/// the actual notification priority.
///
/// Notifications are dequeued in order of their priority.
///
/// The PriorityNotificationQueue can also be used to distribute work from
/// a controlling thread to one or more worker threads. Each worker thread
/// repeatedly calls waitDequeueNotification() and processes the
/// returned notification. Special care must be taken when shutting
/// down a queue with worker threads waiting for notifications.
/// The recommended sequence to shut down and destroy the queue is to
///   1. set a termination flag for every worker thread
///   2. call the wakeUpAll() method
///   3. join each worker thread
///   4. destroy the notification queue.
{
public:
    PriorityNotificationQueue();
    /// Creates the PriorityNotificationQueue.

    ~PriorityNotificationQueue();
    /// Destroys the PriorityNotificationQueue.

    void enqueueNotification(Notification::Ptr pNotification, int priority);
    /// Enqueues the given notification by adding it to
    /// the queue according to the given priority.
    /// Lower priority values are inserted before higher priority values.
    /// The queue takes ownership of the notification, thus
    /// a call like
    ///     notificationQueue.enqueueNotification(new MyNotification, 1);
    /// does not result in a memory leak.

    Notification * dequeueNotification();
    /// Dequeues the next pending notification.
    /// Returns 0 (null) if no notification is available.
    /// The caller gains ownership of the notification and
    /// is expected to release it when done with it.
    ///
    /// It is highly recommended that the result is immediately
    /// assigned to a Notification::Ptr, to avoid potential
    /// memory management issues.

    Notification * waitDequeueNotification();
    /// Dequeues the next pending notification.
    /// If no notification is available, waits for a notification
    /// to be enqueued.
    /// The caller gains ownership of the notification and
    /// is expected to release it when done with it.
    /// This method returns 0 (null) if wakeUpAll()
    /// has been called by another thread.
    ///
    /// It is highly recommended that the result is immediately
    /// assigned to a Notification::Ptr, to avoid potential
    /// memory management issues.

    Notification * waitDequeueNotification(long milliseconds);
    /// Dequeues the next pending notification.
    /// If no notification is available, waits for a notification
    /// to be enqueued up to the specified time.
    /// Returns 0 (null) if no notification is available.
    /// The caller gains ownership of the notification and
    /// is expected to release it when done with it.
    ///
    /// It is highly recommended that the result is immediately
    /// assigned to a Notification::Ptr, to avoid potential
    /// memory management issues.

    void dispatch(NotificationCenter & notificationCenter);
    /// Dispatches all queued notifications to the given
    /// notification center.

    void wakeUpAll();
    /// Wakes up all threads that wait for a notification.

    bool empty() const;
    /// Returns true iff the queue is empty.

    int size() const;
    /// Returns the number of notifications in the queue.

    void clear();
    /// Removes all notifications from the queue.

    bool hasIdleThreads() const;
    /// Returns true if the queue has at least one thread waiting
    /// for a notification.

    static PriorityNotificationQueue & defaultQueue();
    /// Returns a reference to the default
    /// PriorityNotificationQueue.

protected:
    Notification::Ptr dequeueOne();

private:
    typedef std::multimap<int, Notification::Ptr> NfQueue;
    struct WaitInfo
    {
        Notification::Ptr pNf;
        Event nfAvailable;
    };
    typedef std::deque<WaitInfo *> WaitQueue;

    NfQueue _nfQueue;
    WaitQueue _waitQueue;
    mutable FastMutex _mutex;
};


} // namespace Poco


#endif // Foundation_PriorityNotificationQueue_INCLUDED

```

### Core Architecture Module: `base/poco/Foundation/include/Poco/SHA1Engine.h`
```
//
// SHA1Engine.h
//
// Library: Foundation
// Package: Crypt
// Module:  SHA1Engine
//
// Definition of class SHA1Engine.
//
// Secure Hash Standard SHA-1 algorithm
// (FIPS 180-1, see http://www.itl.nist.gov/fipspubs/fip180-1.htm)
//
// Based on the public domain implementation by Peter C. Gutmann
// on 2 Sep 1992, modified by Carl Ellison to be SHA-1.
//
// Copyright (c) 2004-2006, Applied Informatics Software Engineering GmbH.
// and Contributors.
//
// SPDX-License-Identifier:	BSL-1.0
//


#ifndef Foundation_SHA1Engine_INCLUDED
#define Foundation_SHA1Engine_INCLUDED


#include "Poco/DigestEngine.h"
#include "Poco/Foundation.h"


namespace Poco
{


class Foundation_API SHA1Engine : public DigestEngine
/// This class implements the SHA-1 message digest algorithm.
/// (FIPS 180-1, see http://www.itl.nist.gov/fipspubs/fip180-1.htm)
{
public:
    enum
    {
        BLOCK_SIZE = 64,
        DIGEST_SIZE = 20
    };

    SHA1Engine();
    ~SHA1Engine();

    std::size_t digestLength() const;
    void reset();
    const DigestEngine::Digest & digest();

protected:
    void updateImpl(const void * data, std::size_t length);

private:
    void transform();
    static void byteReverse(UInt32 * buffer, int byteCount);

    typedef UInt8 BYTE;

    struct Context
    {
        UInt32 digest[5]; // Message digest
        UInt32 countLo; // 64-bit bit count
        UInt32 countHi;
        UInt32 data[16]; // SHA data buffer
        UInt32 slop; // # of bytes saved in data[]
    };

    Context _context;
    DigestEngine::Digest _digest;

    SHA1Engine(const SHA1Engine &);
    SHA1Engine & operator=(const SHA1Engine &);
};


} // namespace Poco


#endif // Foundation_SHA1Engine_INCLUDED

```

### Core Architecture Module: `base/poco/Foundation/include/Poco/StreamUtil.h`
```
//
// StreamUtil.h
//
// Library: Foundation
// Package: Streams
// Module:  StreamUtil
//
// Stream implementation support.
//
// Copyright (c) 2005-2006, Applied Informatics Software Engineering GmbH.
// and Contributors.
//
// SPDX-License-Identifier:	BSL-1.0
//


#ifndef Foundation_StreamUtil_INCLUDED
#define Foundation_StreamUtil_INCLUDED


#include "Poco/Foundation.h"


// poco_ios_init
//
// This is a workaround for a bug in the Dinkumware
// implementation of iostreams.
//
// Calling basic_ios::init() multiple times for the
// same basic_ios instance results in a memory leak
// caused by the ios' locale being allocated more than
// once, each time overwriting the old pointer.
// This usually occurs in the following scenario:
//
// class MyStreamBuf: public std::streambuf
// {
//     ...
// };
//
// class MyIOS: public virtual std::ios
// {
// public:
//     MyIOS()
//     {
//         init(&_buf);
//     }
// protected:
//     MyStreamBuf _buf;
// };
//
// class MyIStream: public MyIOS, public std::istream
// {
//     ...
// };
//
// In this scenario, std::ios::init() is called twice
// (the first time by the MyIOS constructor, the second
// time by the std::istream constructor), resulting in
// two locale objects being allocated, the pointer second
// one overwriting the pointer to the first one and thus
// causing a memory leak.
//
// The workaround is to call init() only once for each
// stream object - by the istream, ostream or iostream
// constructor, and not calling init() in ios-derived
// base classes.
//
// Some stream implementations, however, require that
// init() is called in the MyIOS constructor.
// Therefore we replace each call to init() with
// the poco_ios_init macro defined below.
//
// Also this macro will adjust exceptions() flags, since by default std::ios
// will hide exceptions, while in ClickHouse it is better to pass them through.


#if !defined(POCO_IOS_INIT_HACK)
// Microsoft Visual Studio with Dinkumware STL (but not STLport)
#endif


#if defined(POCO_IOS_INIT_HACK)
#    define poco_ios_init(buf)
#else
#    define poco_ios_init(buf) do {                         \
    init(buf);                                              \
    this->exceptions(std::ios::badbit);                     \
} while (0)
#endif


#endif // Foundation_StreamUtil_INCLUDED

```

### Core Architecture Module: `base/poco/Foundation/include/Poco/TimedNotificationQueue.h`
```
//
// TimedNotificationQueue.h
//
// Library: Foundation
// Package: Notifications
// Module:  TimedNotificationQueue
//
// Definition of the TimedNotificationQueue class.
//
// Copyright (c) 2009, Applied Informatics Software Engineering GmbH.
// and Contributors.
//
// SPDX-License-Identifier:	BSL-1.0
//


#ifndef Foundation_TimedNotificationQueue_INCLUDED
#define Foundation_TimedNotificationQueue_INCLUDED


#include <map>
#include "Poco/Clock.h"
#include "Poco/Event.h"
#include "Poco/Foundation.h"
#include "Poco/Mutex.h"
#include "Poco/Notification.h"
#include "Poco/Timestamp.h"


namespace Poco
{


class Foundation_API TimedNotificationQueue
/// A TimedNotificationQueue object provides a way to implement timed, asynchronous
/// notifications. This is especially useful for sending notifications
/// from one thread to another, for example from a background thread to
/// the main (user interface) thread.
///
/// The TimedNotificationQueue is quite similar to the NotificationQueue class.
/// The only difference to NotificationQueue is that each Notification is tagged
/// with a Timestamp. When inserting a Notification into the queue, the
/// Notification is inserted according to the given Timestamp, with
/// lower Timestamp values being inserted before higher ones.
///
/// Notifications are dequeued in order of their timestamps.
///
/// TimedNotificationQueue has some restrictions regarding multithreaded use.
/// While multiple threads may enqueue notifications, only one thread at a
/// time may dequeue notifications from the queue.
///
/// If two threads try to dequeue a notification simultaneously, the results
/// are undefined.
{
public:
    TimedNotificationQueue();
    /// Creates the TimedNotificationQueue.

    ~TimedNotificationQueue();
    /// Destroys the TimedNotificationQueue.

    void enqueueNotification(Notification::Ptr pNotification, Timestamp timestamp);
    /// Enqueues the given notification by adding it to
    /// the queue according to the given timestamp.
    /// Lower timestamp values are inserted before higher ones.
    /// The queue takes ownership of the notification, thus
    /// a call like
    ///     notificationQueue.enqueueNotification(new MyNotification, someTime);
    /// does not result in a memory leak.
    ///
    /// The Timestamp is converted to an equivalent Clock value.

    void enqueueNotification(Notification::Ptr pNotification, Clock clock);
    /// Enqueues the given notification by adding it to
    /// the queue according to the given clock value.
    /// Lower clock values are inserted before higher ones.
    /// The queue takes ownership of the notification, thus
    /// a call like
    ///     notificationQueue.enqueueNotification(new MyNotification, someTime);
    /// does not result in a memory leak.

    Notification * dequeueNotification();
    /// Dequeues the next pending notification with a timestamp
    /// less than or equal to the current time.
    /// Returns 0 (null) if no notification is available.
    /// The caller gains ownership of the notification and
    /// is expected to release it when done with it.
    ///
    /// It is highly recommended that the result is immediately
    /// assigned to a Notification::Ptr, to avoid potential
    /// memory management issues.

    Notification * waitDequeueNotification();
    /// Dequeues the next pending notification.
    /// If no notification is available, waits for a notification
    /// to be enqueued.
    /// The caller gains ownership of the notification and
    /// is expected to release it when done with it.
    ///
    /// It is highly recommended that the result is immediately
    /// assigned to a Notification::Ptr, to avoid potential
    /// memory management issues.

    Notification * waitDequeueNotification(long milliseconds);
    /// Dequeues the next pending notification.
    /// If no notification is available, waits for a notification
    /// to be enqueued up to the specified time.
    /// Returns 0 (null) if no notification is available.
    /// The caller gains ownership of the notification and
    /// is expected to release it when done with it.
    ///
    /// It is highly recommended that the result is immediately
    /// assigned to a Notification::Ptr, to avoid potential
    /// memory management issues.

    bool empty() const;
    /// Returns true iff the queue is empty.

    int size() const;
    /// Returns the number of notifications in the queue.

    void clear();
    /// Removes all notifications from the queue.
    ///
    /// Calling clear() while another thread executes one of
    /// the dequeue member functions will result in undefined
    /// behavior.

protected:
    typedef std::multimap<Clock, Notification::Ptr> NfQueue;
    Notification::Ptr dequeueOne(NfQueue::iterator & it);
    bool wait(Clock::ClockDiff interval);

private:
    NfQueue _nfQueue;
    Event _nfAvailable;
    mutable FastMutex _mutex;
};


} // namespace Poco


#endif // Foundation_TimedNotificationQueue_INCLUDED

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #132004** (2026-11-17): **`CREATE TEMPORARY VIEW` is allowed with `readonly = 1` while `CREATE TEMPORARY TABLE` is refused**
  *Symptoms*: **Describe the bug**  With `readonly = 1`, `CREATE TEMPORARY TABLE` is refused, but `CREATE TEMPORARY VIEW` is accepted. The two are session-local objects of the same kind, and the documentation of `readonly` lists temporary tables as needing `readonly = 2`.  **How to reproduce**  ```sql -- as an administrator CREATE USER u IDENTIFIED WITH no_password; GRANT CREATE TEMPORARY TABLE, CREATE TEMPORARY VIEW ON *.* TO u;  -- as u, in one session, with readonly = 1 SET readonly = 1; CREATE TEMPORARY TABLE tt (x UInt8);         -- Code: 164. Cannot execute query in readonly mode. (READONLY) CREATE TEMPORARY VIEW tv AS SELECT 1 AS x;   -- succeeds SELECT * FROM tv;                            -- 1 ```  **Observed** (26.11.1.1, master build)  The temporary view is created in read-only mode.  **Expected**  Either both are refused under `readonly = 1`, or the documentation says temporary views are allowed. The first seems intended.  **Where**  `ContextAccess::checkAccessImplHelper` (`src/Access/ContextAccess.cpp`) builds `not_readonly_1_flags = AccessType::CREATE_TEMPORARY_TABLE` only. `InterpreterCreateQuery::getRequiredAccess` asks for `CREATE_TEMPORARY_VIEW` for a temporary view, and that access type is in neither `not_readonly_flags` nor `not_readonly_1_flags`.  The effect is limited to the session's own scratch objects; I am reporting it as an inconsistency, not as a security problem.   <!-- ch-version-info:start --> ### Version info - Resolved by: #132016 - Merged into: `26.11.1.25

- **Issue #131875** (2026-11-17): **`SYSTEM SYNC DATABASE REPLICA` does not check its privilege on local execution**
  *Symptoms*: **Describe the bug**  `SYSTEM SYNC DATABASE REPLICA db` (the local form, without `ON CLUSTER`) runs for a user who has no grants at all.  The privilege exists (`M(SYSTEM_SYNC_DATABASE_REPLICA, "SYNC DATABASE REPLICA", DATABASE, SYSTEM)` in `src/Access/Common/AccessType.h`), and the `ON CLUSTER` form requires it through `getRequiredAccessForDDLOnCluster`. The local handler, `InterpreterSystemQuery::syncReplicatedDatabase`, never calls `checkAccess`. Its sibling `syncReplica` does (`checkAccess(AccessType::SYSTEM_SYNC_REPLICA, table_id)`).  This is the same kind of problem as #112439 (`SYSTEM SYNC TRANSACTION LOG`), fixed by #112441. That issue lists `syncReplicatedDatabase` among the handlers that already check access, but it does not. A review comment on #120661 pointed this out, and that pull request added the check and a test (`05258_system_local_access_checks`), but it was closed without being merged, so `master` still has no check.  **How to reproduce**  ```sql -- as an administrator CREATE DATABASE r ENGINE = Replicated('/clickhouse/databases/r', '{shard}', '{replica}'); CREATE TABLE r.t (x UInt8) ENGINE = ReplicatedMergeTree ORDER BY x; CREATE DATABASE a; CREATE USER u IDENTIFIED WITH no_password;   -- no grants  -- as u SYSTEM SYNC REPLICA r.t;                      -- ACCESS_DENIED (expected) SYSTEM SYNC DATABASE REPLICA r;               -- succeeds SYSTEM SYNC DATABASE REPLICA a;               -- BAD_ARGUMENTS: ... intended to work only with Replicated engine SYSTEM S

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

### Incident Patch 1: `42a270d5` (2026-11-17)
**Commit Message**: Merge pull request #119183 from nihalzp/fix-nullable-tuple-set-semantics

Fix exceptions and wrong results of `IN` when the keys and the set have different types

**File**: `src/Analyzer/Resolve/resolveFunction.cpp` (modified, +68/-46)
```diff
@@ -1212,6 +1212,52 @@ static void validateInColumnsCountMatch(const QueryTreeNodePtr & in_first_argume
     }
 }
 
+/// Returns whether the `rewrite_in_to_join` rewrite of `x IN (subquery)` into
+/// `EXISTS (SELECT 1 FROM (subquery) WHERE x = <row> LIMIT 1)` keeps the semantics of regular `IN`: the
+/// same result or the same error. The left operand has the type `left_type`, and the subquery has the
+/// columns `subquery_columns`. The caller guarantees that `left_type` is not null and that
+/// `validateInColumnsCountMatch` accepted both sides.
+///
+/// Regular `IN` rejects a left operand with dynamic structure before it builds the set. With
+/// `transform_null_in = 0`, which the rewrite requires, it returns NULL for a NULL left operand, while
+/// `NOT EXISTS` returns 1.
+///
+/// For any other operand, the set has one key per subquery column. `FunctionIn` compares the whole left
+/// operand with the only column of a subquery, even when the operand is a tuple. Otherwise it compares
+/// each element of the left tuple with its own column. `Set::execute` converts each key to the type of
+/// its column, and a value that the column cannot hold is not a member. For example,
+/// `(t, 1) IN (SELECT toFloat64(1767225600), 1)` returns 0 for
+/// `t = fromUnixTimestamp64Nano(1767225600000000001, 'UTC')` because `Float64` cannot hold the nanosecond,
+/// while `equals` compares in a common supertype and matches. The conversion also parses text as a number,
+/// where `equals` finds no common type. A key of a `Bool` column is converted even when it has the column's
+/// type, which turns every byte other than 0 into `true`, while `equals` compares the bytes. The set holds
+/// NULL as a value of a `Variant` key and NULL fields as values of a tuple key, while `equals` returns NULL
+/// for them. And the set compares floating-point values by their bits, also inside `Array` and `Map`: a NaN
+/// is a member of a set that holds it, and `-0.0` is not a member of a set of `0.0`, while `equals` compares
+/// the numbers. So the rewrite keeps the semantics only when every key has the type of its column, is
+/// neither a tuple nor a `Variant`, holds no floating-point type, and its column is not `Bool`. A `Nullable`
+/// element of the left tuple is fine, unlike a `Nullable` left operand: the set never matches a NULL element,
+/// neither does `equals`, and `IN` of a plain tuple returns 0 rather than NULL.
+static bool existsRewriteKeepsInSemantics(const DataTypePtr & left_type, const NamesAndTypes & subquery_columns)
+{
+    if (left_type->hasDynamicStructure() || isNullableOrLowCardinalityNullable(left_type))
+        return false;
+
+    /// `validateInColumnsCountMatch` made a left operand without dynamic structure a tuple as wide as a
+    /// subquery with several columns.
+    const DataTypes key_types = subquery_columns.size() == 1 ? DataTypes{left_type} : getInKeyColumnTypes(left_type);
+    chassert(key_types.size() == subquery_columns.size());
+    for (size_t i = 0; i < key_types.size(); ++i)
+    {
+        const auto key_type_without_nullable = removeNullable(key_types[i]);
+        const DataTypePtr & column_type = subquery_columns[i].type;
+        if (isTuple(key_type_without_nullable) || isVariant(key_type_without_nullable) || !key_types[i]->equals(*column_type)
+            || hasTypeThatCanContainFloat(column_type) || isBool(removeNullable(removeLowCardinality(column_type))))
+            return false;
+    }
+    return true;
+}
+
 /// Builds and resolves `IF(isNull(element), NULL, has(array, element))`
 QueryTreeNodePtr QueryAnalyzer::makeNullSafeHas(
     QueryTreeNodePtr array_arg,    // [1,2,number]
@@ -1226,16 +1272,16 @@ QueryTreeNodePtr QueryAnalyzer::makeNullSafeHas(
     has_fn->getArguments().getNodes().push_back(element_arg);
 
     QueryTreeNodePtr in_result = has_fn;
-    /// `has` treats tuple values with equal `NULL` elements as a match, while `IN`
-    /// with `transform_null_in = 0` skips such tuple values. Guard tuple LHS
-    /// elements to preserve `IN` semantics in the row-wise rewrite.
-    if (const auto * tuple_type = typeid_cast<const DataTypeTuple *>(removeNullable(element_arg->getResultType()).get());
-        tuple_type && !tuple_type->getElements().empty())
+    /// `IN` compares the columns of a multi-column key separately, and with `transform_null_in = 0` a NULL
+    /// element never matches, while `has` compares the tuples as values, where equal NULL elements match.
+    /// Guard the elements to preserve the `IN` semantics; a single key needs no guard, its NULL fields are
+    /// values.
+    if (const size_t key_column_count = getInKeyColumnTypes(element_arg->getResultType()).size(); key_column_count > 1)
     {
         auto and_fn = std::make_shared<FunctionNode>("and");
         and_fn->getArguments().getNodes() =
         {
-            makeTupleHasNoNullElementsPredicate(element_arg, tuple_type->getElements().size()),
+            makeTupleHasNoNullElemen
```

**File**: `src/Analyzer/SetUtils.cpp` (modified, +33/-43)
```diff
@@ -18,6 +18,8 @@
 
 #include <Common/assert_cast.h>
 
+#include <algorithm>
+
 namespace DB
 {
 
@@ -204,7 +206,8 @@ ColumnsWithTypeAndName createBlockFromCollection(
 
         /// For `Nullable(Tuple(...))` we process tuple members element-by-element:
         /// - to correctly skip unknown enum literals when `validate_enum_literals_in_operators = 0`
-        /// - to implement `transform_null_in = 0` semantics for NULLs inside tuple elements (skip such tuple values)
+        /// - to skip members with a NULL field that the key's non-nullable field cannot hold; a NULL field
+        ///   that the key can hold is part of the key value in either `transform_null_in` mode, as in `Set`
         const auto * lhs_nullable = typeid_cast<const DataTypeNullable *>(lhs_type.get());
         const auto * lhs_tuple = lhs_nullable ? typeid_cast<const DataTypeTuple *>(lhs_nullable->getNestedType().get()) : nullptr;
 
@@ -255,19 +258,14 @@ ColumnsWithTypeAndName createBlockFromCollection(
                         lhs_tuple_element_types[i],
                         params.forbid_unknown_enum_values);
 
+                    /// `convertColumnToTypeCheckEnum` reports a value that the field cannot hold,
+                    /// including a NULL in a non-nullable field, as not representable.
                     if (!converted)
                     {
                         skip_tuple_value = true;
                         break;
                     }
 
-                    bool need_insert_null = params.transform_null_in && lhs_tuple_element_types[i]->isNullable();
-                    if ((*converted)->isNullAt(0) && !need_insert_null)
-                    {
-                        skip_tuple_value = true;
-                        break;
-                    }
-
                     converted_elements.push_back(std::move(*converted));
                 }
 
@@ -643,35 +641,41 @@ bool columnCollectionHasTuple(const ColumnPtr & rhs_column, const DataTypePtr &
 
 }
 
+DataTypes getInKeyColumnTypes(const DataTypePtr & lhs_type)
+{
+    if (const auto * tuple_type = typeid_cast<const DataTypeTuple *>(lhs_type.get()); tuple_type && tuple_type->getElements().size() > 1)
+        return tuple_type->getElements();
+    return {lhs_type};
+}
+
+bool nullableTupleKeyCanHoldAllNullTuple(const DataTypeTuple & key_tuple_type, size_t rhs_tuple_size)
+{
+    const auto & elements = key_tuple_type.getElements();
+    return elements.size() == rhs_tuple_size
+        && std::ranges::all_of(elements, [](const auto & element) { return canContainNull(*element); });
+}
+
 /// Format: lhs IN rhs
 /// Explanation of the setting: `transform_null_in`. First of all, it is only applicable if the lhs is nullable.
 /// Then if lhs is nullable and `transform_null_in` is true, then NULLs from rhs are inserted into the result set as well.
-/// Whereas, if `transform_null_in` is false, we pretend NULLs are not present in rhs at all (at level 1 or at level 2 for Tuple).
+/// Whereas, if `transform_null_in` is false, we pretend NULLs are not present in rhs at all: a NULL member,
+/// or a NULL element of a member of a multi-column key (a plain `Tuple` lhs with several elements is
+/// unpacked into one key column per element). A NULL field of a `Nullable(Tuple)` or single-element tuple
+/// key is part of the key value.
 /// If `transform_null_in` is false, then `SELECT NULL IN (NULL, 1)` returns NULL, otherwise it returns true.
 
 ColumnsWithTypeAndName getSetElementsForConstantValue(
     const DataTypePtr & lhs_expression_type, const ColumnPtr & rhs_column, const DataTypePtr & rhs_type, GetSetElementParams params)
 {
-    DataTypes lhs_unpacked_types = {lhs_expression_type};
+    /// A `Nullable(Tuple(...))` stays a single value and is handled in the createBlockFromCollection() fast
+    /// path.
+    DataTypes lhs_unpacked_types = getInKeyColumnTypes(lhs_expression_type);
 
-    /// Unpack `Tuple(...)` into tuple elements.
-    /// For `Nullable(Tuple(...))` we keep it as a single value and handle it in createBlockFromCollection() fast-path.
-    bool lhs_is_tuple = false;
     const auto * lhs_nullable_type = typeid_cast<const DataTypeNullable *>(lhs_expression_type.get());
     const auto * lhs_tuple_type
         = typeid_cast<const DataTypeTuple *>(lhs_nullable_type ? lhs_nullable_type->getNestedType().get() : lhs_expression_type.get());
-
-    if (lhs_tuple_type)
-    {
-        lhs_is_tuple = true;
-
-        /// Do not unpack empty tuple or single element tuple.
-        /// Do not unpack `Nullable(Tuple(...))` because in the end we build a single `Nullable(Tuple(...))` column anyway.
-        if (!lhs_nullable_type && lhs_tuple_type->getElements().size() > 1)
-            lhs_unpacked_types = lhs_tuple_type->getElements();
-    }
-
-    bool lhs_is_nullable = (lhs_nullable_type != nullptr);
+    const bool lhs_is_tuple = lhs_tuple_type != nullptr;
+    const bool lhs_is_nullable = lhs_nullable_type != nullptr;
 
     for (auto & lhs_element_
```

**File**: `src/Analyzer/SetUtils.h` (modified, +18/-2)
```diff
@@ -2,23 +2,39 @@
 
 #include <Core/ColumnsWithTypeAndName.h>
 #include <Columns/IColumn_fwd.h>
+#include <DataTypes/IDataType_fwd.h>
 
 #include <memory>
 
 namespace DB
 {
 
-class IDataType;
-using DataTypePtr = std::shared_ptr<const IDataType>;
 class Set;
 using SetPtr = std::shared_ptr<Set>;
+class DataTypeTuple;
 
 struct GetSetElementParams
 {
     bool transform_null_in = true;
     bool forbid_unknown_enum_values = false;
 };
 
+/// The key columns that `IN` compares separately for a left operand of this type. A plain `Tuple` with more
+/// than one element is unpacked into one key column per element, so a NULL element of a member never matches
+/// with `transform_null_in = 0`. Anything else is one key whose NULL fields are ordinary values: an empty or
+/// single-element tuple, and a `Nullable(Tuple(...))`, because the set is built as a single
+/// `Nullable(Tuple(...))` column anyway.
+DataTypes getInKeyColumnTypes(const DataTypePtr & lhs_type);
+
+/// Whether a `Nullable(Tuple(...))` key with the tuple type `key_tuple_type` can hold the tuple value of an explicit
+/// all-NULL right-hand tuple of `rhs_tuple_size` elements: the sizes match and every element can hold NULL (see
+/// `canContainNull`). For example, `Nullable(Tuple(Nullable(UInt8), Nullable(UInt8)))` and
+/// `Nullable(Tuple(LowCardinality(Nullable(String)), Variant(UInt8, String)))` can hold `(NULL, NULL)`, and
+/// `Nullable(Tuple(UInt8, Nullable(UInt8)))` cannot. Every form of `IN` then reads such a right-hand tuple both as
+/// top-level NULL members and as that tuple value, in either `transform_null_in` mode, because the key is a single key
+/// column whose NULL fields are values (see `getInKeyColumnTypes`).
+bool nullableTupleKeyCanHoldAllNullTuple(const DataTypeTuple & key_tuple_type, size_t rhs_tuple_size);
+
 /** Get set elements for constant part of IN subquery.
   * Throws exception if parameters are not valid for IN function.
   *
```

**File**: `src/Core/DecimalFunctions.h` (modified, +18/-0)
```diff
@@ -1,10 +1,12 @@
 #pragma once
 
 #include <Core/Types.h>
+#include <Core/AccurateComparison.h>
 #include <Common/Exception.h>
 #include <Common/intExp.h>
 #include <base/arithmeticOverflow.h>
 
+#include <cmath>
 #include <limits>
 #include <type_traits>
 
@@ -436,6 +438,22 @@ bool tryConvertTo(const DecimalType & decimal, UInt32 scale, To & result)
     return convertToImpl<To, DecimalType, bool>(decimal, scale, result);
 }
 
+/// Whether the conversion of `decimal` to the floating-point type `To` is exact: rounding the converted value
+/// back to the nearest tick of `scale` restores `decimal`. All decimals within the resolution of `To` convert
+/// to the same value, and this holds for exactly one of them. The ticks are restored by rounding rather than
+/// by the truncation of `convertToDecimal`: the nearest double to `0.29` lies below it, so truncating its
+/// product with the multiplier would restore `0.28` and reject a conversion that `To` represents as well as
+/// it can.
+template <is_floating_point To, typename DecimalType>
+bool convertsToFloatExactly(const DecimalType & decimal, UInt32 scale)
+{
+    using NativeType = typename DecimalType::NativeType;
+    const Float64 multiplier = static_cast<Float64>(scaleMultiplier<NativeType>(scale));
+    const Float64 restored_ticks = std::round(static_cast<Float64>(convertTo<To>(decimal, scale)) * multiplier);
+    NativeType restored{};
+    return accurate::convertNumeric(restored_ticks, restored) && restored == decimal.value;
+}
+
 /// Converts a decimal to another decimal.
 template <is_decimal To, typename DecimalType>
 To convertTo(UInt32 to_scale, const DecimalType & decimal, UInt32 scale)
```

**File**: `src/DataTypes/NullableUtils.cpp` (modified, +48/-32)
```diff
@@ -62,53 +62,69 @@ DataTypePtr makeExtractedSubcolumnsNullableOrLowCardinalityNullableSafe(const Da
     return makeNullableOrLowCardinalityNullableSafe(type);
 }
 
-ColumnPtr extractNestedColumnsAndNullMap(ColumnRawPtrs & key_columns, ConstNullMapPtr & null_map)
+ColumnPtr mergeNullMaps(ColumnPtr lhs, const ColumnPtr & rhs)
 {
-    ColumnPtr null_map_holder;
+    if (!lhs)
+        return rhs;
+    if (!rhs)
+        return lhs;
 
-    auto addNullMap = [&](const ColumnNullable * column_nullable)
-    {
-        if (!null_map_holder)
-        {
-            /// First nullable column: just take its null map as the base
-            null_map_holder = column_nullable->getNullMapColumnPtr();
-        }
-        else
-        {
-            /// Subsequent nullable columns: OR their null maps into the accumulated one
-            MutableColumnPtr mutable_null_map_holder = IColumn::mutate(std::move(null_map_holder));
+    if (lhs->size() != rhs->size())
+        throw Exception(ErrorCodes::LOGICAL_ERROR, "Cannot merge null maps with different sizes: {} and {}", lhs->size(), rhs->size());
 
-            PaddedPODArray<UInt8> & mutable_null_map = assert_cast<ColumnUInt8 &>(*mutable_null_map_holder).getData();
-            const PaddedPODArray<UInt8> & other_null_map = column_nullable->getNullMapData();
+    MutableColumnPtr result = IColumn::mutate(std::move(lhs));
+    auto & result_null_map = assert_cast<ColumnUInt8 &>(*result).getData();
+    const auto & rhs_null_map = assert_cast<const ColumnUInt8 &>(*rhs).getData();
 
-            for (size_t i = 0, size = mutable_null_map.size(); i < size; ++i)
-                mutable_null_map[i] |= other_null_map[i];
+    for (size_t i = 0, size = result_null_map.size(); i < size; ++i)
+        result_null_map[i] |= rhs_null_map[i];
 
-            null_map_holder = std::move(mutable_null_map_holder);
-        }
-    };
+    return result;
+}
 
+ColumnPtr getOuterNullMap(const IColumn & column)
+{
+    if (const auto * column_nullable = checkAndGetColumn<ColumnNullable>(&column))
+        return column_nullable->getNullMapColumnPtr();
+    if (const auto * column_dynamic = checkAndGetColumn<ColumnDynamic>(&column))
+        return column_dynamic->getVariantColumn().createNullMap();
+    if (const auto * column_variant = checkAndGetColumn<ColumnVariant>(&column))
+        return column_variant->createNullMap();
+    if (const auto * column_low_cardinality = checkAndGetColumn<ColumnLowCardinality>(&column);
+        column_low_cardinality && column_low_cardinality->nestedIsNullable())
+    {
+        const size_t null_index = column_low_cardinality->getDictionary().getNullValueIndex();
+        auto null_map = ColumnUInt8::create(column_low_cardinality->size());
+        auto & null_map_data = null_map->getData();
+        for (size_t row = 0; row < null_map_data.size(); ++row)
+            null_map_data[row] = column_low_cardinality->getIndexAt(row) == null_index;
+        return null_map;
+    }
+    return nullptr;
+}
+
+ColumnPtr extractNestedColumnsAndNullMap(ColumnRawPtrs & key_columns, ConstNullMapPtr & null_map)
+{
+    ColumnPtr null_map_holder;
     for (auto & column : key_columns)
     {
-        if (const auto * column_nullable = checkAndGetColumn<ColumnNullable>(&*column))
+        if (const auto * column_nullable = checkAndGetColumn<ColumnNullable>(column))
         {
-            /// Top-level Nullable(...) always contributes to the combined null map
-            addNullMap(column_nullable);
-
-            /** Only the top-level null map says whether the key of a row is NULL. The null maps of the
-              * elements of a `Nullable(Tuple(Nullable(T), ...))` used to be folded in as well, which
-              * made a row whose tuple merely *contains* a NULL a NULL key: the hash-family joins
-              * dropped it, while the merge algorithms - which compare the nested tuples - kept it, so
-              * the result of a join depended on `join_algorithm`, and `IN` never matched such a row.
-              * The NULLs of the elements are part of the key and are compared as any other value,
-              * exactly as they are for a `Tuple(Nullable(T), ...)` that is not wrapped in `Nullable`.
+            null_map_holder = mergeNullMaps(std::move(null_map_holder), column_nullable->getNullMapColumnPtr());
+
+            /** Only the top-level null map says whether the key of a row is NULL. Folding in the null
+              * maps of the elements of a `Nullable(Tuple(Nullable(T), ...))` would make a row whose tuple
+              * merely *contains* a NULL a NULL key: the hash-family joins would drop it, while the merge
+              * algorithms - which compare the nested tuples - keep it, so the result of a join would depend
+              * on `join_algorithm`, and `IN` would never match such a row. The NULLs of the elements are
+              * part of the key and are compared as any other value, exactly as they are for a
+              * `Tuple(Null
```

**File**: `src/DataTypes/NullableUtils.h` (modified, +13/-3)
```diff
@@ -8,9 +8,19 @@
 namespace DB
 {
 
-/** Replace Nullable key_columns to corresponding nested columns.
-  * In 'null_map' return a map of positions where at least one column was NULL.
-  * @returns ownership column of null_map.
+/// Combine two `ColumnUInt8` null maps of equal size. A null pointer represents a map with no NULLs.
+/// Reuse the first column when it is exclusively owned, or share the other column when one map is absent.
+ColumnPtr mergeNullMaps(ColumnPtr lhs, const ColumnPtr & rhs);
+
+/// The outer null map of a column that can hold NULLs (`ColumnUInt8`, 1 = the value is NULL), or a null
+/// pointer for a column that cannot. A NULL inside a value, such as a NULL field of a tuple, is not an outer
+/// NULL. `Variant` and `Dynamic` encode NULLs with the `NULL` discriminator, and `LowCardinality` with the
+/// index of the NULL in its dictionary, rather than a separate null map, so theirs is reconstructed.
+ColumnPtr getOuterNullMap(const IColumn & column);
+
+/** Replace `Nullable` key columns with their nested columns and combine their outer null maps.
+  * A NULL field inside a non-null tuple is part of the key value and does not make the key NULL.
+  * Set `null_map` to the combined map and return the column that owns it.
   */
 ColumnPtr extractNestedColumnsAndNullMap(ColumnRawPtrs & key_columns, ConstNullMapPtr & null_map);
 
```

**File**: `src/Functions/CastOverloadResolver.cpp` (modified, +53/-0)
```diff
@@ -10,6 +10,7 @@
 #include <DataTypes/DataTypeString.h>
 #include <DataTypes/DataTypeTuple.h>
 #include <Columns/ColumnString.h>
+#include <Common/UnorderedMapWithMemoryTracking.h>
 #include <Core/Settings.h>
 #include <Interpreters/parseColumnsListForTableFunction.h>
 #include <Interpreters/Context.h>
@@ -25,6 +26,7 @@ namespace Setting
 namespace ErrorCodes
 {
     extern const int ILLEGAL_TYPE_OF_ARGUMENT;
+    extern const int TYPE_MISMATCH;
 }
 
 /// accurateCastOrNull wraps the result in Nullable to represent conversion failures.
@@ -65,6 +67,57 @@ bool canBeAccurateCastOrNullTarget(const DataTypePtr & type)
     return findUnsupportedTypeForAccurateCastOrNull(type) == nullptr;
 }
 
+std::optional<VectorWithMemoryTracking<std::optional<size_t>>> tryGetTupleCastElementPositions(
+    const DataTypeTuple & from, const DataTypeTuple & to)
+{
+    VectorWithMemoryTracking<std::optional<size_t>> positions;
+    positions.reserve(to.getElements().size());
+
+    if (from.hasExplicitNames() && to.hasExplicitNames())
+    {
+        const auto & from_names = from.getElementNames();
+        const auto & to_names = to.getElementNames();
+        UnorderedMapWithMemoryTracking<String, size_t> from_positions;
+        from_positions.reserve(from_names.size());
+        for (size_t i = 0; i < from_names.size(); ++i)
+            from_positions.emplace(from_names[i], i);
+
+        bool has_common_name = false;
+        for (const auto & name : to_names)
+        {
+            auto it = from_positions.find(name);
+            if (it == from_positions.end())
+                positions.emplace_back();
+            else
+            {
+                positions.emplace_back(it->second);
+                has_common_name = true;
+            }
+        }
+
+        if (has_common_name)
+            return positions;
+        positions.clear();
+    }
+
+    if (from.getElements().size() != to.getElements().size())
+        return std::nullopt;
+
+    for (size_t i = 0; i < to.getElements().size(); ++i)
+        positions.emplace_back(i);
+    return positions;
+}
+
+VectorWithMemoryTracking<std::optional<size_t>> getTupleCastElementPositions(const DataTypeTuple & from, const DataTypeTuple & to)
+{
+    auto positions = tryGetTupleCastElementPositions(from, to);
+    if (!positions)
+        throw Exception(ErrorCodes::TYPE_MISMATCH, "CAST AS Tuple can only be performed between tuple types "
+                        "with the same number of elements or from String.\nLeft type: {}, right type: {}",
+                        from.getName(), to.getName());
+    return std::move(*positions);
+}
+
 static void validateNestedTypesForAccurateCastOrNull(const DataTypePtr & type)
 {
     if (auto unsupported = findUnsupportedTypeForAccurateCastOrNull(type))
```

**File**: `src/Functions/CastOverloadResolver.h` (modified, +17/-0)
```diff
@@ -4,11 +4,13 @@
 #include <optional>
 #include <Interpreters/Context_fwd.h>
 #include <Core/ColumnWithTypeAndName.h>
+#include <Common/VectorWithMemoryTracking.h>
 
 
 namespace DB
 {
 
+class DataTypeTuple;
 class IFunctionOverloadResolver;
 using FunctionOverloadResolverPtr = std::shared_ptr<IFunctionOverloadResolver>;
 
@@ -35,6 +37,21 @@ FunctionBasePtr createInternalCast(ColumnWithTypeAndName from, DataTypePtr to, C
 /// when it can carry a NULL of its own, as Dynamic and Variant do.
 bool canBeAccurateCastOrNullTarget(const DataTypePtr & type);
 
+/// Map each destination tuple element to its source position, or no position for a defaulted field. For named
+/// tuples with at least one element name in common, elements are matched by name: source elements without a
+/// counterpart are dropped, and target elements without a counterpart are filled by default values (schema
+/// evolution: adding, dropping and renaming elements of a `Tuple` or a `Nested` column with `ALTER`). For
+/// named tuples with disjoint sets of element names, matching by name cannot be meant, because it would fill
+/// the whole result by default values and lose all the data, so elements are matched by position, as for
+/// unnamed tuples (e.g. the result of function `tuple` with `enable_named_columns_in_function_tuple` inserted
+/// into a column whose tuple elements are named differently).
+VectorWithMemoryTracking<std::optional<size_t>> getTupleCastElementPositions(const DataTypeTuple & from, const DataTypeTuple & to);
+
+/// The same mapping, or no mapping when the tuples are matched by position and have different numbers of
+/// elements, where `getTupleCastElementPositions` throws `TYPE_MISMATCH` because `CAST` cannot convert them.
+std::optional<VectorWithMemoryTracking<std::optional<size_t>>> tryGetTupleCastElementPositions(
+    const DataTypeTuple & from, const DataTypeTuple & to);
+
 FunctionOverloadResolverPtr createCastOverloadResolver(ContextPtr context, CastType cast_type, std::optional<CastDiagnostic> diagnostic);
 
 }
```

---

### Incident Patch 2: `d5024cf1` (2026-11-17)
**Commit Message**: Merge pull request #132118 from groeneai/fix-broken-local-disk-skip-130044

Skip broken disks when looking for a table's files on every disk

**File**: `src/Databases/DatabaseOnDisk.cpp` (modified, +1/-1)
```diff
@@ -446,7 +446,7 @@ void DatabaseOnDisk::dropTable(ContextPtr local_context, const String & table_na
 
     for (const auto & [disk_name, disk] : getContext()->getDisksMap())
     {
-        if (disk->isReadOnly() || !disk->existsDirectory(table_data_path_relative))
+        if (disk->isBroken() || disk->isReadOnly() || !disk->existsDirectory(table_data_path_relative))
             continue;
 
         LOG_INFO(log, "Removing data directory from disk {} with path {} for dropped table {} ", disk_name, table_data_path_relative, table_name);
```

**File**: `src/Interpreters/DatabaseCatalog.cpp` (modified, +1/-1)
```diff
@@ -1921,7 +1921,7 @@ void DatabaseCatalog::dropTableFinally(const TableMarkedAsDropped & table)
     ///   or it is better to bypass it e.g. to avoid interactions with a remote storage
     auto is_disk_eligible_for_search = [](DiskPtr disk, std::shared_ptr<MergeTreeData> storage)
     {
-        bool is_disk_eligible = !disk->isReadOnly();
+        bool is_disk_eligible = !disk->isBroken() && !disk->isReadOnly();
 
         /// Disk is not actually used by MergeTree table
         if (is_disk_eligible && storage && !storage->getStoragePolicy()->tryGetVolumeIndexByDiskName(disk->getName()).has_value())
```

**File**: `src/Storages/Freeze.cpp` (modified, +2/-2)
```diff
@@ -147,7 +147,7 @@ BlockIO Unfreezer::systemUnfreeze(const String & backup_name)
     auto disks_map = local_context->getDisksMap();
     for (auto & [_, disk] : disks_map)
     {
-        if (disk->isReadOnly() || disk->isWriteOnce())
+        if (disk->isBroken() || disk->isReadOnly() || disk->isWriteOnce())
             continue;
 
         for (const auto & store_path : store_paths)
@@ -211,7 +211,7 @@ PartitionCommandsResultInfo Unfreezer::unfreezePartitionsFromTableDirectory(Merg
 
     for (const auto & disk : disks)
     {
-        if (!disk->existsDirectory(table_directory))
+        if (disk->isBroken() || !disk->existsDirectory(table_directory))
             continue;
 
         for (auto it = disk->iterateDirectory(table_directory); it->isValid(); it->next())
```

**File**: `src/Storages/MergeTree/MergeTreeData.cpp` (modified, +2/-2)
```diff
@@ -12229,7 +12229,7 @@ DetachedPartsInfo MergeTreeData::getDetachedParts() const
         /// While it is possible to have detached parts on readonly/write-once disks
         /// (if they were produced on another machine, where it wasn't readonly)
         /// to avoid wasting resources for slow disks, avoid trying to enumerate them.
-        if (disk->isReadOnly() || disk->isWriteOnce())
+        if (disk->isBroken() || disk->isReadOnly() || disk->isWriteOnce())
             continue;
 
         String detached_path = fs::path(relative_data_path) / DETACHED_DIR_NAME;
@@ -14047,7 +14047,7 @@ DiskPtr MergeTreeData::tryGetDiskForDetachedPart(const String & part_name) const
     const auto disks = getStoragePolicy()->getDisks();
 
     for (const DiskPtr & disk : disks)
-        if (disk->existsDirectory(fs::path(relative_data_path) / DETACHED_DIR_NAME / part_name))
+        if (!disk->isBroken() && disk->existsDirectory(fs::path(relative_data_path) / DETACHED_DIR_NAME / part_name))
             return disk;
 
     return nullptr;
```

**File**: `tests/integration/test_disk_checker/test.py` (modified, +87/-0)
```diff
@@ -204,3 +204,90 @@ def test_server_starts_with_unusable_local_disk_path(started_cluster):
 
     assert node.query("SELECT is_broken FROM system.disks WHERE name = 'unusable'") == "1\n"
     assert node.contains_in_log("Skip access check for disk unusable (disk is broken)")
+
+
+def test_broken_local_disk_is_skipped(started_cluster):
+    """Operations that look for a table's files on every disk must skip a broken disk."""
+    node = cluster.instances["test_disk_checker_unusable_path"]
+
+    node.exec_in_container(
+        [
+            "bash",
+            "-c",
+            "ln -sfn loop_b /var/lib/clickhouse/loop_a && ln -sfn loop_a /var/lib/clickhouse/loop_b",
+        ]
+    )
+    node.exec_in_container(
+        [
+            "bash",
+            "-c",
+            """cat > /etc/clickhouse-server/config.d/looped_disk.xml << 'EOF'
+<clickhouse>
+    <enable_system_unfreeze>true</enable_system_unfreeze>
+    <storage_configuration>
+        <disks>
+            <looped>
+                <type>local</type>
+                <path>/var/lib/clickhouse/loop_a/disk/</path>
+            </looped>
+            <spare>
+                <type>local</type>
+                <path>/var/lib/clickhouse/spare_disk/</path>
+            </spare>
+        </disks>
+        <policies>
+            <with_looped>
+                <volumes>
+                    <main><disk>default</disk></main>
+                    <broken><disk>looped</disk></broken>
+                    <last><disk>spare</disk></last>
+                </volumes>
+                <move_factor>0</move_factor>
+            </with_looped>
+        </policies>
+    </storage_configuration>
+</clickhouse>
+EOF""",
+        ]
+    )
+
+    node.restart_clickhouse()
+    assert node.query("SELECT is_broken FROM system.disks WHERE name = 'looped'") == "1\n"
+
+    node.query("CREATE TABLE t (x UInt8) ENGINE = MergeTree ORDER BY x")
+    t_uuid = node.query("SELECT uuid FROM system.tables WHERE database = 'default' AND name = 't'").strip()
+    t_spare = f"/var/lib/clickhouse/spare_disk/store/{t_uuid[:3]}/{t_uuid}"
+    node.exec_in_container(["bash", "-c", f"mkdir -p {t_spare}/sentinel"])
+    node.query("DROP TABLE t SYNC", settings={"max_execution_time": 30})
+    assert node.exec_in_container(["bash", "-c", f"[ -e {t_spare} ] && echo present || echo absent"]) == "absent\n"
+
+    node.query(
+        "CREATE DATABASE ordinary_db ENGINE = Ordinary",
+        settings={"allow_deprecated_database_ordinary": 1},
+    )
+    node.query("CREATE TABLE ordinary_db.t (x UInt8) ENGINE = MergeTree ORDER BY x")
+    ordinary_spare = "/var/lib/clickhouse/spare_disk/data/ordinary_db/t"
+    node.exec_in_container(["bash", "-c", f"mkdir -p {ordinary_spare}/sentinel"])
+    node.query("DROP TABLE ordinary_db.t")
+    assert node.exec_in_container(["bash", "-c", f"[ -e {ordinary_spare} ] && echo present || echo absent"]) == "absent\n"
+    node.query("DROP DATABASE ordinary_db")
+
+    node.query(
+        "CREATE TABLE t2 (x UInt8) ENGINE = MergeTree ORDER BY x SETTINGS storage_policy = 'with_looped'"
+    )
+    node.query("INSERT INTO t2 VALUES (1)")
+    part = node.query("SELECT name FROM system.parts WHERE table = 't2' AND active").strip()
+    node.query(f"ALTER TABLE t2 MOVE PART '{part}' TO DISK 'spare'")
+    node.query(f"ALTER TABLE t2 DETACH PART '{part}'")
+    assert node.query("SELECT count() FROM system.detached_parts WHERE table = 't2'") == "1\n"
+    node.query(f"ALTER TABLE t2 ATTACH PART '{part}'")
+    assert node.query("SELECT count() FROM t2") == "1\n"
+
+    frozen = node.query("SELECT name FROM system.parts WHERE table = 't2' AND active").strip()
+    node.query("ALTER TABLE t2 FREEZE WITH NAME 'looped_backup'")
+    node.query("ALTER TABLE t2 FREEZE WITH NAME 'looped_backup_2'")
+    assert frozen in node.query(
+        "ALTER TABLE t2 UNFREEZE WITH NAME 'looped_backup'", settings={"alter_partition_verbose_result": 1}
+    )
+    assert frozen in node.query("SYSTEM UNFREEZE WITH NAME 'looped_backup_2'")
+    node.query("DROP TABLE t2 SYNC", settings={"max_execution_time": 30})
```

---

### Incident Patch 3: `ab23bdd4` (2026-11-17)
**Commit Message**: Merge pull request #132058 from groeneai/fix-scheduler-resourcetest-odr

Fix ODR violation between the two ResourceTest fixtures of the scheduler unit tests

**File**: `src/Common/Scheduler/Nodes/tests/gtest_time_shared_scheduler.cpp` (modified, +5/-0)
```diff
@@ -14,6 +14,9 @@
 
 using namespace DB;
 
+namespace
+{
+
 struct ResourceTest : public ResourceTestBase
 {
     TimeSharedScheduler scheduler;
@@ -40,6 +43,8 @@ struct ResourceTest : public ResourceTestBase
     }
 };
 
+}
+
 struct ResourceHolder
 {
     ResourceTest & t;
```

**File**: `src/Common/Scheduler/Nodes/tests/gtest_workload_resource_manager.cpp` (modified, +5/-0)
```diff
@@ -219,6 +219,9 @@ class WorkloadEntityTestStorage : public WorkloadEntityStorageBase
     }
 };
 
+namespace
+{
+
 struct ResourceTest : ResourceTestManager<WorkloadResourceManager>
 {
     WorkloadEntityTestStorage storage;
@@ -343,6 +346,8 @@ struct ResourceTest : ResourceTestManager<WorkloadResourceManager>
     }
 };
 
+}
+
 using TestGuard = ResourceTest::Guard;
 
 TEST(SchedulerWorkloadResourceManager, Smoke)
```

#### Recent Merged Pull Requests:
- **PR #132370** (2026-11-17): Cherry pick #131893 to 26.3: Check the `SYSTEM SYNC DATABASE REPLICA` grant on local execution (@robot-ch-test-poll4)
- **PR #132329** (2026-11-17): Backport #126385 to 26.10: Estimate range conditions from all parts of `tdigest` statistics (@robot-clickhouse-ci-1)
- **PR #132304** (2026-11-17): Backport #129818 to 26.9: Merge tables report rows and sizes only of the tables the user can see (@robot-clickhouse)
- **PR #132303** (2026-11-17): Backport #129818 to 26.8: Merge tables report rows and sizes only of the tables the user can see (@robot-clickhouse)
- **PR #132302** (2026-11-17): Backport #129818 to 26.3: Merge tables report rows and sizes only of the tables the user can see (@robot-clickhouse)
- **PR #132298** (2026-11-17): Backport #132195 to 26.10: Read `system.query_log` in default-size blocks in `05620_read_in_order_virtual_row_fixed_key` (@robot-ch-test-poll2)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.


---

## 6. Net-New Universal Engineering Rules (Candidates for Master Brain)

## X. Empirical Invariant Guard in resolveFunction.cpp

**RULE**:
When implementing operations in `src/Analyzer/Resolve/resolveFunction.cpp`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in ClickHouse/ClickHouse. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `42a270d5`: . Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing C++ data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/Analyzer/Resolve/resolveFunction.cpp`.

**VERIFIED IMPLEMENTATION PATTERN**:
```c++
// Verified production-grade fix pattern:
/// Returns whether the `rewrite_in_to_join` rewrite of `x IN (subquery)` into
/// `EXISTS (SELECT 1 FROM (subquery) WHERE x = <row> LIMIT 1)` keeps the semantics of regular `IN`: the
/// same result or the same error. The left operand has the type `left_type`, and the subquery has the
/// columns `subquery_columns`. The caller guarantees that `left_type` is not null and that
/// `validateInColumnsCountMatch` accepted both sides.
///
/// Regular `IN` rejects a left operand with dynamic structure before it builds the set. With
/// `transform_null_in = 0`, which the rewrite requires, it returns NULL for a NULL left operand, while
/// `NOT EXISTS` returns 1.
///
/// For any other operand, the set has one key per subquery column. `FunctionIn` compares the whole left
/// operand with the only column of a subquery, even when the operand is a tuple. Otherwise it compares
/// each element of the left tuple with its own column. `Set::execute` converts each key to the type of
/// its column, and a value that the column cannot hold is not a member. For example,
/// `(t, 1) IN (SELECT toFloat64(1767225600), 1)` returns 0 for
/// `t = fromUnixTimestamp64Nano(1767225600000000001, 'UTC')` because
```

**NEGATIVE CONSTRAINT**:
```c++
// Induced defect failure mode:
    /// `has` treats tuple values with equal `NULL` elements as a match, while `IN`
    /// with `transform_null_in = 0` skips such tuple values. Guard tuple LHS
    /// elements to preserve `IN` semantics in the row-wise rewrite.
    if (const auto * tuple_type = typeid_cast<const DataTypeTuple *>(removeNullable(element_arg->getResultType()).get());
        tuple_type && !tuple_type->getElements().empty())
            makeTupleHasNoNullElementsPredicate(element_arg, tuple_type->getElements().size()),
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `42a270d5` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.

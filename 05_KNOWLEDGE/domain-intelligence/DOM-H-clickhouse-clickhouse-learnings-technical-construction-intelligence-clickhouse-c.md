# Domain H — Technical Construction Intelligence: Technical Construction Intelligence: clickhouse-clickhouse-learnings Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "clickhouse-clickhouse-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-22T19:18:52.510Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-clickhouse-clickhouse-learnings",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [clickhouse-clickhouse-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-22T19:18:52.510Z`  
> **Learning ID**: `LEARN-EVO-clickhouse-clickhouse-learnings`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain H (Technical Construction Intelligence)
- **Secondary Corroborating Domains**: G (Architecture Intelligence), D (Research & Knowledge Intelligence), M (Feedback & Evolution Intelligence), I (Content & Information Intelligence), K (Quality & Verification Intelligence), A (Human & Need Intelligence), L (Deployment & Operations Intelligence), B (Product Intelligence), J (Search & Distribution Intelligence)
- **Confidence Rating**: 58%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from clickhouse-clickhouse-learnings:

> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/clickhouse-clickhouse-learnings.md`  
> **Source**: github ([https://github.com/ClickHouse/ClickHouse](https://github.com/ClickHouse/ClickHouse))  
> **Source Version**: `841a49be`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-22T19:18:46.619Z  
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
> **Harvest Timestamp**: 2026-11-22T19:18:46.612Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `ClickHouse/ClickHouse`
- **Description**: ClickHouse® is a real-time analytics database management system
- **Primary Language / Ecosystem**: C++
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 51063 stars

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
- **Issue #132739** (2026-11-19): **ColumnObject::deserializeDynamicPathsAndSharedDataFromArena does not validate unique/sorted paths invariant, allowing corrupted subcolumn sizes and LOGICAL_ERROR exceptions**
  *Symptoms*: ### Company or project name  IBM  ### Describe what's wrong  Found during review of https://github.com/ClickHouse/ClickHouse/pull/128069  When serializing dynamic paths and shared data into an arena in ColumnObject::serializeDynamicPathsAndSharedDataIntoArena, paths are guaranteed to be serialized in strictly increasing, sorted, and unique order.  However, the matching deserializer ColumnObject::deserializeDynamicPathsAndSharedDataFromArena does not enforce this invariant. If a serialized payload contains duplicate path entries (e.g., num_paths = 2 with two entries for path a in the same row):  1. The reader processes the first entry for a, deserializing a value and appending it to dynamic subcolumn a (increasing its size from current_size to current_size + 1). 2. The reader processes the second entry for a, appending another value to dynamic subcolumn a (increasing its size to current_size + 2). 3. After the path loop finishes, shared_data offsets advance by only 1 row.  Because deserialization consumes all bytes, end-of-buffer checks pass and deserialization returns successfully, but leaves the resulting ColumnObject in an invalid state where individual subcolumns disagree on their row count.  Attempting to read or extract the corrupted subcolumn later throws a LOGICAL_ERROR exception.   ### Does it reproduce on the most recent release?  Yes  ### How to reproduce  A record with num_paths = 2 and two entries for a appends twice to that dynamic subcolumn but only once to shar

- **Issue #132436** (2026-11-19): **clickhouse-client prints secrets of a failed query to stderr in non-interactive mode, while the server hides them**
  *Symptoms*: ### Company or project name  Running ClickHouse in production on Kubernetes (LLM trace store), with native BACKUP to S3 from a CronJob.  ### Describe what's wrong  In non-interactive mode (`--query`, stdin, `--queries-file`, `--ignore-error`), when a query fails, `clickhouse-client` appends the original query text to the error on stderr as `(query: ...)`. Secrets in the query are printed in clear. The server hides the same values in `system.query_log` and in its own logs.  Affected, when the statement fails: `CREATE USER` / `ALTER USER ... IDENTIFIED BY '...'`, `CREATE NAMED COLLECTION`, `BACKUP`/`RESTORE ... S3(url, key, secret)`, and the `s3()` and `mysql()` table functions. `clickhouse-local --ignore-error` does the same.  Non-interactive use is how backup jobs and migrations run, and their stderr usually goes to a log store. I found it when a failed nightly `BACKUP ... TO S3(...)` put the S3 secret key into our central logs while the server logs were clean.  `--echo` printing the query is requested by the user and is not part of this report.  ### Does it reproduce on the most recent release?  Yes  ### How to reproduce  ClickHouse 26.10.4.207 and master 26.11.1.2601 (official Docker images), default config:  ```bash clickhouse-client --query "ALTER USER no_such_user IDENTIFIED WITH plaintext_password BY 'MySecretPassword123'" ```  ``` Received exception from server (version 26.11.1): Code: 192. DB::Exception: Received from localhost:9000. DB::Exception: There is no user `n

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

### Incident Patch 1: `657a223e` (2026-11-22)
**Commit Message**: Address review: check the sum of file counts of an Iceberg manifest list entry for overflow

The types of `added_files_count` and `existing_files_count` are taken from
the schema of the manifest list, so a malformed manifest list can have
arbitrary `long` values in them, and their sum in `getManifestList` could
overflow, which is undefined behaviour. The sum is now calculated with
`common::addOverflow`, and `ICEBERG_SPECIFICATION_VIOLATION` is thrown on
overflow.

The test manifest list is the manifest list of
`void_partition_dropped_column` with these fields of the type `long` and
the values 9223372036854775807 and 1 in the first entry.

Co-Authored-By: Claude Fable 5.2 <[REDACTED_EMAIL]>

**File**: `src/Storages/ObjectStorage/DataLakes/Iceberg/StatelessMetadataFileGetter.cpp` (modified, +11/-2)
```diff
@@ -11,6 +11,7 @@
 #include <Poco/JSON/Object.h>
 #include <Poco/JSON/Stringifier.h>
 #include <Common/Exception.h>
+#include <base/arithmeticOverflow.h>
 #include <Common/FailPoint.h>
 
 
@@ -335,8 +336,16 @@ ManifestFileCacheKeys getManifestList(
                 if (!manifest_list_deserializer.hasPath(count_field))
                     continue;
                 auto count = manifest_list_deserializer.getValueFromRowByName(i, count_field);
-                if (!count.isNull())
-                    live_files_count += std::max<Int64>(0, count.safeGet<Int64>());
+                if (count.isNull())
+                    continue;
+                /// The counts are `int` in the specification, but the type is taken from the schema of the file,
+                /// so the values can be arbitrary `long`s and their sum can overflow.
+                if (common::addOverflow(live_files_count, std::max<Int64>(0, count.safeGet<Int64>()), live_files_count))
+                    throw Exception(
+                        ErrorCodes::ICEBERG_SPECIFICATION_VIOLATION,
+                        "Manifest list entry at index {} has too large value of the field '{}'",
+                        i,
+                        count_field);
             }
 
             std::optional<UInt64> first_row_id;
```

**File**: `tests/queries/0_stateless/05843_iceberg_manifest_list_files_count_overflow.reference` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+ICEBERG_SPECIFICATION_VIOLATION
```

**File**: `tests/queries/0_stateless/05843_iceberg_manifest_list_files_count_overflow.sh` (added, +24/-0)
```diff
@@ -0,0 +1,24 @@
+#!/usr/bin/env bash
+# Tags: no-fasttest
+# Tag no-fasttest: `icebergLocal` needs the USE_AVRO build option.
+
+# The file counts of a manifest in an Iceberg manifest list are `int` in the specification, but their type is taken
+# from the schema of the manifest list, so a malformed manifest list can have arbitrary `long` values in them.
+# The sum of `added_files_count` and `existing_files_count` must be checked for overflow instead of being undefined behaviour.
+# The manifest list in `data_iceberg/void_partition_malformed_manifest_list` is the manifest list of
+# `void_partition_dropped_column` with these fields of the type `long` and the values 9223372036854775807 and 1 in the first entry.
+
+CUR_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
+# shellcheck source=../shell_config.sh
+. "$CUR_DIR"/../shell_config.sh
+
+SRC="$CUR_DIR/data_iceberg/void_partition_dropped_column"
+BAD="$CUR_DIR/data_iceberg/void_partition_malformed_manifest_list"
+MANIFEST_LIST="snap-2011348865913312671-1-6a6f19d7-4d29-4fe1-9f6f-4cbaf3a20785.avro"
+
+T="${CLICKHOUSE_TMP}/${CLICKHOUSE_DATABASE}_files_count_overflow"
+rm -rf "$T"
+cp -r "$SRC" "$T"
+cp "$BAD/files_count_overflow.avro" "$T/metadata/$MANIFEST_LIST"
+$CLICKHOUSE_LOCAL --query "SELECT id FROM icebergLocal('$T') ORDER BY id" 2>&1 | grep -o -m1 'ICEBERG_SPECIFICATION_VIOLATION'
+rm -rf "$T"
```

---

### Incident Patch 2: `841a49be` (2026-11-22)
**Commit Message**: Merge pull request #133482 from groeneai/build-hash-section-in-place

Write the binary hash of official builds in place instead of rewriting `clickhouse` with `llvm-objcopy`

**File**: `CMakeLists.txt` (modified, +1/-3)
```diff
@@ -271,9 +271,7 @@ if (LINKER_NAME MATCHES "lld" AND NOT LINKER_NAME MATCHES "ld64")
     set (CMAKE_EXE_LINKER_FLAGS "${CMAKE_EXE_LINKER_FLAGS} -Wl,--build-id=sha1")
 endif ()
 
-# Add a section with the hash of the compiled machine code for integrity checks.
-# Only for official builds, because adding a section can be time consuming (rewrite of several GB).
-# And cross compiled binaries are not supported (since you cannot execute clickhouse hash-binary)
+# Add a section with the hash of the compiled machine code for integrity checks. Only for official builds.
 if (CLICKHOUSE_OFFICIAL_BUILD AND OS_LINUX AND (ARCH_AMD64 OR ARCH_AARCH64) AND NOT ENABLE_CLANG_TIDY)
     message(STATUS "Official build: A checksum hash will be added to the clickhouse executable")
     set (USE_BINARY_HASH 1 CACHE STRING "Calculate binary hash and store it in the separate section")
```

**File**: `programs/CMakeLists.txt` (modified, +4/-6)
```diff
@@ -229,6 +229,8 @@ add_custom_target (clickhouse-bundle ALL DEPENDS ${CLICKHOUSE_BUNDLE})
 
 if (USE_BINARY_HASH)
     add_dependencies(clickhouse hash-binary)
+    # The section for the hash is reserved at link time and filled in place by `hash-binary --write-section`.
+    target_sources(clickhouse PRIVATE binary_hash_section.S)
 
     # When cross-compiling, use the native-built hash-binary; otherwise use the regular build output
     if (CMAKE_CROSSCOMPILING)
@@ -238,8 +240,8 @@ if (USE_BINARY_HASH)
     endif()
 
     add_custom_command(TARGET clickhouse POST_BUILD
-        COMMAND ${HASH_BINARY_PATH} clickhouse > hash 2> /dev/null
-        COMMENT "Computing hash of clickhouse binary" VERBATIM)
+        COMMAND ${HASH_BINARY_PATH} --write-section clickhouse > hash 2> /dev/null
+        COMMENT "Writing hash of clickhouse binary to section '.clickhouse.hash'" VERBATIM)
 
     if (NOT CMAKE_CROSSCOMPILING)
         add_custom_command(TARGET clickhouse POST_BUILD
@@ -248,10 +250,6 @@ if (USE_BINARY_HASH)
             COMMAND ${CMAKE_COMMAND} -E rm hash.verify
             COMMENT "Verifying hash-binary output matches clickhouse hash-binary" VERBATIM)
     endif()
-
-    add_custom_command(TARGET clickhouse POST_BUILD
-        COMMAND ${OBJCOPY_PATH} --add-section .clickhouse.hash=hash clickhouse
-        COMMENT "Adding section '.clickhouse.hash' to clickhouse binary" VERBATIM)
 endif()
 
 if (CHECK_LARGE_OBJECT_SIZES)
```

**File**: `programs/binary_hash_section.S` (added, +4/-0)
```diff
@@ -0,0 +1,4 @@
+/* The section for the hash of the executable segments (USE_BINARY_HASH), filled in place by `hash-binary --write-section`.
+   It is not allocated, so it is not a part of the hashed segments. */
+.section .clickhouse.hash,"",%progbits
+.fill 32, 1, 0x30
```

**File**: `utils/hash-binary/hash-binary.cpp` (modified, +124/-7)
```diff
@@ -1,5 +1,6 @@
 /// Tool to compute the same hash as ClickHouse's getHashOfLoadedBinary() from a file.
 /// Useful for cross-compilation when you can't execute the target binary.
+/// With --write-section, also writes the hash in place into the section '.clickhouse.hash' reserved at link time.
 ///
 /// NOTE: This file is intentionally standalone with no ClickHouse dependencies.
 /// We cannot reuse src/Common/SipHash.h because it depends on ClickHouse-specific
@@ -13,10 +14,14 @@
 #include <fstream>
 #include <iomanip>
 #include <iostream>
+#include <sstream>
 #include <stdexcept>
+#include <string>
 #include <vector>
 
 #include <elf.h>
+#include <fcntl.h>
+#include <unistd.h>
 
 
 namespace
@@ -195,6 +200,80 @@ bool hashExecutableSegments(std::istream & in, SipHash & hash)
 }
 
 
+/// Writes `value` into the existing non-allocated section `name` of the same size, without changing anything else in the file.
+template <typename Ehdr, typename Shdr>
+bool writeSectionInPlace(std::fstream & file, const std::string & name, const std::string & value)
+{
+    Ehdr ehdr;
+    file.seekg(0);
+    if (!file.read(reinterpret_cast<char *>(&ehdr), sizeof(ehdr)) || ehdr.e_shoff == 0 || ehdr.e_shentsize != sizeof(Shdr))
+    {
+        std::cerr << "Failed to read section headers\n";
+        return false;
+    }
+
+    auto read_section_header = [&](uint64_t index, Shdr & shdr)
+    {
+        file.seekg(static_cast<std::streamoff>(ehdr.e_shoff + index * sizeof(Shdr)));
+        return static_cast<bool>(file.read(reinterpret_cast<char *>(&shdr), sizeof(shdr)));
+    };
+
+    /// With 0xff00 sections or more, the counts are stored in the first section header.
+    Shdr first;
+    if (!read_section_header(0, first))
+    {
+        std::cerr << "Failed to read section headers\n";
+        return false;
+    }
+    const uint64_t section_count = ehdr.e_shnum ? ehdr.e_shnum : first.sh_size;
+    const uint64_t names_index = ehdr.e_shstrndx == SHN_XINDEX ? first.sh_link : ehdr.e_shstrndx;
+
+    Shdr names_header;
+    if (names_index >= section_count || !read_section_header(names_index, names_header))
+    {
+        std::cerr << "Failed to read section names\n";
+        return false;
+    }
+    std::string names(names_header.sh_size, '\0');
+    file.seekg(static_cast<std::streamoff>(names_header.sh_offset));
+    if (!file.read(names.data(), static_cast<std::streamsize>(names.size())))
+    {
+        std::cerr << "Failed to read section names\n";
+        return false;
+    }
+
+    for (uint64_t i = 0; i < section_count; ++i)
+    {
+        Shdr shdr;
+        if (!read_section_header(i, shdr))
+        {
+            std::cerr << "Failed to read section header\n";
+            return false;
+        }
+        if (shdr.sh_name >= names.size() || std::strcmp(names.c_str() + shdr.sh_name, name.c_str()) != 0)
+            continue;
+
+        /// The hash covers only the executable segments: a non-allocated section is not part of any segment.
+        if (shdr.sh_type != SHT_PROGBITS || (shdr.sh_flags & SHF_ALLOC) || shdr.sh_size != value.size())
+        {
+            std::cerr << "Section " << name << " must be non-allocated PROGBITS of " << value.size() << " bytes\n";
+            return false;
+        }
+
+        file.seekp(static_cast<std::streamoff>(shdr.sh_offset));
+        if (!file.write(value.data(), static_cast<std::streamsize>(value.size())) || !file.flush())
+        {
+            std::cerr << "Failed to write section " << name << "\n";
+            return false;
+        }
+        return true;
+    }
+
+    std::cerr << "Section " << name << " not found\n";
+    return false;
+}
+
+
 bool hashElfFile(std::istream & in, SipHash & hash)
 {
     unsigned char e_ident[EI_NIDENT];
@@ -223,18 +302,28 @@ int main(int argc, char ** argv)
 {
     try
     {
-        if (argc != 2)
+        const bool write_section = argc == 3 && std::string(argv[1]) == "--write-section";
+        if (argc != 2 && !write_section)
         {
-            std::cerr << "Usage: " << argv[0] << " <elf-file>\n"
+            std::cerr << "Usage: " << argv[0] << " [--write-section] <elf-file>\n"
                       << "\nComputes the same hash as 'clickhouse hash-binary' but from a file.\n"
-                      << "Useful for cross-compilation when you can't execute the target binary.\n";
+                      << "Useful for cross-compilation when you can't execute the target binary.\n"
+                      << "--write-section also writes the hash into the section '.clickhouse.hash' of the file, in place.\n";
             return 1;
         }
+        const char * path = argv[argc - 1];
 
-        std::ifstream file(argv[1], std::ios::binary);
+        /// With stdout or stderr closed, the file could get that descriptor, and the output would be written into the file.
+        if (fcntl(STDOUT_FILENO, F_GETFD) == -1 || fcntl(STDERR_FILENO, F_GETFD) == -1)
+        {
+            std::cerr << "stdout and stderr must be ope
```

---

### Incident Patch 3: `1afd2c94` (2026-11-22)
**Commit Message**: Merge pull request #133523 from siddharthapal8240/fix/external-limit-pushdown-int64

Do not push down a `LIMIT` above the signed 64-bit range to `PostgreSQL` and `SQLite` tables

**File**: `src/Storages/transformQueryForExternalDatabase.cpp` (modified, +6/-1)
```diff
@@ -31,6 +31,7 @@
 #include <Storages/transformQueryForExternalDatabaseAnalyzer.h>
 
 #include <cmath>
+#include <limits>
 #include <queue>
 
 
@@ -1189,7 +1190,11 @@ String transformQueryForExternalDatabaseImpl(
         }
     }
 
-    if (limit)
+    /// A `LIMIT` in ClickHouse is any `UInt64` (for example MySQL's "all rows" idiom,
+    /// `LIMIT 18446744073709551615`), while PostgreSQL and SQLite accept only a signed 64-bit value and
+    /// fail on a larger one (`bigint out of range`, `datatype mismatch`). A limit that large does not
+    /// cut off the rows of any table, so it is not sent to the external database at all.
+    if (limit && *limit <= static_cast<UInt64>(std::numeric_limits<Int64>::max()))
         select->setExpression(ASTSelectQuery::Expression::LIMIT_LENGTH, make_intrusive<ASTLiteral>(*limit));
 
     ASTPtr select_ptr = select;
```

**File**: `tests/integration/test_storage_postgresql/test.py` (modified, +9/-0)
```diff
@@ -969,6 +969,15 @@ def run(query, **settings):
     assert result == "99"
     assert len(queries) == 1 and "LIMIT" not in queries[0]
 
+    # A `LIMIT` above the signed 64-bit range is valid in ClickHouse, while the `LIMIT` of PostgreSQL
+    # is a `bigint`. Such a limit cuts off nothing, so it is not sent, instead of failing the query
+    # with `bigint out of range`.
+    result, queries = run(
+        "SELECT count() FROM (SELECT * FROM pg_limit_pushdown LIMIT 9223372036854775808)"
+    )
+    assert result == "100"
+    assert len(queries) == 1 and "LIMIT" not in queries[0]
+
     # A real `LIMIT 0` returns nothing and never asks PostgreSQL for a single row.
     result, _ = run("SELECT count() FROM (SELECT * FROM pg_limit_pushdown LIMIT 0)")
     assert result == "0"
```

**File**: `tests/queries/0_stateless/05843_external_table_limit_above_int64.reference` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+3
+3
+2
+2
+3
+2
```

**File**: `tests/queries/0_stateless/05843_external_table_limit_above_int64.sh` (added, +33/-0)
```diff
@@ -0,0 +1,33 @@
+#!/usr/bin/env bash
+# Tags: no-fasttest
+# Tag no-fasttest: needs the `sqlite` table function and the `sqlite3` tool
+
+# A `LIMIT` of a query is pushed down to an external database, where it is safe. A `LIMIT` in ClickHouse
+# is any `UInt64`, while SQLite (and PostgreSQL) accept only a signed 64-bit value, so a `LIMIT` above
+# that range - such as `LIMIT 18446744073709551615`, MySQL's idiom for "all rows" - made the query fail
+# with `datatype mismatch`. Such a limit does not cut off anything and is not sent.
+
+CUR_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
+# shellcheck source=../shell_config.sh
+. "$CUR_DIR"/../shell_config.sh
+
+DB_PATH="${USER_FILES_PATH}/${CLICKHOUSE_DATABASE}_limit_above_int64.db"
+rm -f "${DB_PATH}"
+
+sqlite3 "${DB_PATH}" 'CREATE TABLE t (id INTEGER); INSERT INTO t VALUES (1), (2), (3);'
+chmod ugo+r "${DB_PATH}"
+
+SOURCE="sqlite('${DB_PATH}', 't')"
+
+${CLICKHOUSE_CLIENT} --query "
+SELECT count() FROM (SELECT id FROM ${SOURCE} LIMIT 9223372036854775808);
+SELECT count() FROM (SELECT id FROM ${SOURCE} LIMIT 18446744073709551615);
+SELECT count() FROM (SELECT id FROM ${SOURCE} LIMIT 9223372036854775807 OFFSET 1);
+SELECT count() FROM (SELECT id FROM ${SOURCE} WHERE id > 1 LIMIT 18446744073709551615);
+
+-- The largest limit that SQLite accepts, and an ordinary one.
+SELECT count() FROM (SELECT id FROM ${SOURCE} LIMIT 9223372036854775807);
+SELECT count() FROM (SELECT id FROM ${SOURCE} LIMIT 2);
+"
+
+rm -f "${DB_PATH}"
```

#### Recent Merged Pull Requests:
- **PR #133562** (2026-11-22): Backport #131636 to 26.9: Skip a setting value from the server's Hello that this version rejects instead of failing the connection (@robot-ch-test-poll)
- **PR #133561** (2026-11-22): Backport #131636 to 26.8: Skip a setting value from the server's Hello that this version rejects instead of failing the connection (@robot-ch-test-poll)
- **PR #133555** (2026-11-22): Backport #131636 to 26.10: Skip a setting value from the server's Hello that this version rejects instead of failing the connection (@robot-ch-test-poll2)
- **PR #133550** (2026-11-22): Backport #130143 to 26.10: Fix `LOGICAL_ERROR` on `INSERT` into a table whose projection has a subquery in its `SELECT` list or `GROUP BY` (@robot-ch-test-poll2)
- **PR #133548** (2026-11-22): Backport #133464 to 26.11: Remove the background cleanup of unused directories in `store/` (@robot-ch-test-poll2)
- **PR #133543** (2026-11-22): Backport #133506 to 26.11: Fix JSON schema inference applying the mark of a freed type to an unrelated value (@robot-ch-test-poll2)

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

## X. Address review: check the sum of file counts of an Iceberg manifest list entry f

**RULE**:
When implementing operations in `src/Storages/ObjectStorage/DataLakes/Iceberg/StatelessMetadataFileGetter.cpp`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in ClickHouse/ClickHouse. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `657a223e`: Address review: check the sum of file counts of an Iceberg manifest list entry for overflow. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing C++ data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/Storages/ObjectStorage/DataLakes/Iceberg/StatelessMetadataFileGetter.cpp`.

**VERIFIED IMPLEMENTATION PATTERN**:
```c++
// Verified production-grade fix pattern:
#include <base/arithmeticOverflow.h>
                if (count.isNull())
                    continue;
                /// The counts are `int` in the specification, but the type is taken from the schema of the file,
                /// so the values can be arbitrary `long`s and their sum can overflow.
                if (common::addOverflow(live_files_count, std::max<Int64>(0, count.safeGet<Int64>()), live_files_count))
                    throw Exception(
                        ErrorCodes::ICEBERG_SPECIFICATION_VIOLATION,
                        "Manifest list entry at index {} has too large value of the field '{}'",
                        i,
                        count_field);
```

**NEGATIVE CONSTRAINT**:
```c++
// Induced defect failure mode:
                if (!count.isNull())
                    live_files_count += std::max<Int64>(0, count.safeGet<Int64>());
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `657a223e` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.

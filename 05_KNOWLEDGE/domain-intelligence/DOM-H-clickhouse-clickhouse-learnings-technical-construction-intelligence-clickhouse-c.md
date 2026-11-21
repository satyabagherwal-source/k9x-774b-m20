# Domain H — Technical Construction Intelligence: Technical Construction Intelligence: clickhouse-clickhouse-learnings Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "clickhouse-clickhouse-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-21T18:23:11.550Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-clickhouse-clickhouse-learnings",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [clickhouse-clickhouse-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-21T18:23:11.550Z`  
> **Learning ID**: `LEARN-EVO-clickhouse-clickhouse-learnings`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain H (Technical Construction Intelligence)
- **Secondary Corroborating Domains**: G (Architecture Intelligence), K (Quality & Verification Intelligence), A (Human & Need Intelligence), D (Research & Knowledge Intelligence), M (Feedback & Evolution Intelligence), I (Content & Information Intelligence), L (Deployment & Operations Intelligence), F (Design Intelligence), B (Product Intelligence), J (Search & Distribution Intelligence)
- **Confidence Rating**: 57%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from clickhouse-clickhouse-learnings:

> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/clickhouse-clickhouse-learnings.md`  
> **Source**: github ([https://github.com/ClickHouse/ClickHouse](https://github.com/ClickHouse/ClickHouse))  
> **Source Version**: `a2126dbc`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-21T18:23:04.509Z  
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
> **Harvest Timestamp**: 2026-11-21T18:23:04.504Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `ClickHouse/ClickHouse`
- **Description**: ClickHouse® is a real-time analytics database management system
- **Primary Language / Ecosystem**: C++
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 51055 stars

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

### Incident Patch 1: `b9d4d482` (2026-11-21)
**Commit Message**: Fix flaky test IOTestAwsS3Client.AssumeRoleRefreshInConcurrentFibers

The data-plane mock of the test had the default 16 server threads for
4 * hardware_concurrency + 1 concurrent GET requests (129 on a 32-CPU CI
host). Poco's TCPServerDispatcher::enqueue does not queue a connection
when no dispatcher thread waits on the queue and fewer than maxThreads
dispatcher threads run: it asks the pool for a new thread, and when the
pool has no idle PooledThread (a dispatcher thread that has just left
run() is not idle yet) it closes the connection unread and counts it in
refusedConnections(). Both attempts a GetObject gets in this test
(s3_slow_all_threads_after_retryable_error -> SDK max_retries = 1,
max_single_read_retries = 1) can be refused about 1 ms apart, so the
fiber fails with "No message received" / "Connection reset by peer",
returns EIO (5) from FiberContext::main, and its request is never
counted: the CI failure "futures[i].wait() Which is: 5" and
"127 vs 129", with exactly one AssumeRole and no request signed with
other credentials.

Give the mock a thread per fiber, as the sibling test
RequestsFromConcurrentFibersDoNotBlockSchedulerThreads already does:
with as many pool thre

**File**: `src/IO/S3/tests/gtest_aws_s3_client.cpp` (modified, +4/-3)
```diff
@@ -1940,7 +1940,7 @@ class FunctionHTTPServer
 public:
     explicit FunctionHTTPServer(HTTPHandlerFunction handler, int max_threads = 16)
         : thread_pool(std::make_unique<Poco::ThreadPool>(/* minCapacity = */ 2, max_threads))
-        , server_socket(std::make_unique<Poco::Net::ServerSocket>(0))
+        , server_socket(std::make_unique<Poco::Net::ServerSocket>(/* port = */ 0, /* backlog = */ std::max(64, max_threads)))
         , server(std::make_unique<Poco::Net::HTTPServer>(
               new Factory(std::move(handler)), *thread_pool, *server_socket, makeServerParams(max_threads)))
     {
@@ -2532,16 +2532,18 @@ TEST(IOTestAwsS3Client, AssumeRoleRefreshInConcurrentFibers)
         MockStsRequestHandler(request_info, role_access_key, "role_secret_key").handleRequest(request, response);
     });
 
+    const size_t fiber_count = getFiberCountAboveSchedulerThreads();
     std::atomic<size_t> requests_signed_with_refreshed_credentials = 0;
     std::atomic<size_t> other_requests = 0;
+    /// A thread per fiber: the server closes, instead of queueing, a connection that finds no idle thread in its pool.
     FunctionHTTPServer http([&](Poco::Net::HTTPServerRequest & request, Poco::Net::HTTPServerResponse & response)
     {
         if (getCredentialString(request).starts_with("Credential=refreshed_role_access_key/"))
             ++requests_signed_with_refreshed_credentials;
         else
             ++other_requests;
         sendHTTPBody(response, Poco::Net::HTTPResponse::HTTP_OK, "");
-    });
+    }, /* max_threads = */ static_cast<int>(fiber_count));
 
     const DB::S3::URI uri(http.getUrl() + "/IOTestAwsS3ClientAssumeRoleRefreshInConcurrentFibers/test.txt");
     /// The role is unique, so the provider is not shared with other tests through the credentials cache.
@@ -2561,7 +2563,6 @@ TEST(IOTestAwsS3Client, AssumeRoleRefreshInConcurrentFibers)
     release.reset();
     const size_t sts_requests_before = sts_requests;
 
-    const size_t fiber_count = getFiberCountAboveSchedulerThreads();
     runFibersAndReleaseWhenAllStarted(fiber_count, release, [&](size_t) { doReadRequest(client, uri); });
 
     EXPECT_EQ(sts_requests, sts_requests_before + 1);
```

---

### Incident Patch 2: `d01926b3` (2026-11-21)
**Commit Message**: Address review: introspection does not reveal the memory layout

The "Multi-user scenarios" section of the `clickhouse-local` documentation
said that the introspection functions reveal the memory layout of the process.
This is wrong: `StackTrace::resolveAddressForStorage` stores the addresses of
stack traces as offsets inside the executable, and `addressToSymbol` and
`addressToLine` accept only such offsets, in `clickhouse-local` as well.

Say what is exposed instead: the stack traces of the process, such as the ones
in `system.stack_trace`, can be resolved to symbol names and source locations.

Checked on a running `clickhouse-local`: the values in `system.stack_trace` are
below the runtime base of the executable, `addressToSymbol` returns an empty
string for a runtime address, and both functions resolve the stored offsets.

Review: https://github.com/ClickHouse/ClickHouse/pull/133407#pullrequestreview-6006243429
Related: https://github.com/ClickHouse/ClickHouse/pull/133407

Co-Authored-By: Claude Fable 5.2 <[REDACTED_EMAIL]>

**File**: `docs/concepts/features/tools-and-utilities/clickhouse-local.mdx` (modified, +1/-1)
```diff
@@ -451,7 +451,7 @@ The listeners of `clickhouse-local` are meant for a single user: the one who sta
 - **Run commands.** `clickhouse-server` accepts dictionaries with the [`EXECUTABLE`](/reference/statements/create/dictionary/sources/executable-file) and [`EXECUTABLE_POOL`](/reference/statements/create/dictionary/sources/executable-pool) sources only from the configuration files written by the administrator, and refuses to create them with a query. `clickhouse-local` allows `CREATE DICTIONARY ... SOURCE(EXECUTABLE(COMMAND '...'))`, and the command is run by the shell, so a query can run an arbitrary program.
 - **Act as the administrator.** Unless users are configured with `users_config`, the only user is `default`: it has no password, is allowed to connect from any address, and has the privileges of an administrator, including access management. Every connection can read, change, and delete all the data of the instance, change any setting (there are no settings constraints or quotas), see the queries of other sessions in `system.processes` and kill them, close the listeners, and terminate the process with `SYSTEM SHUTDOWN`. It can also create users, which are saved in the data directory, when it is persistent, and remain after a restart.
 - **Connect to any host.** The [`remote_url_allow_hosts`](/reference/settings/server-settings/settings/remote#remote_url_allow_hosts) restriction is not applied in `clickhouse-local`, so the table functions and engines for external sources, such as `url`, `s3`, `remote`, `mysql`, and `postgresql`, can send requests from your machine to any address, including the services on the loopback interface and in the internal network.
-- **Inspect the process.** The [introspection functions](/reference/functions/regular-functions/introspection) are enabled by default (see [`allow_introspection_functions`](/reference/settings/session-settings/allow#allow_introspection_functions)), which reveals the stack traces and the memory layout of the process.
+- **Use the introspection functions.** The [introspection functions](/reference/functions/regular-functions/introspection) are enabled by default (see [`allow_introspection_functions`](/reference/settings/session-settings/allow#allow_introspection_functions)), so a client can resolve the stack traces of the process, such as the ones in `system.stack_trace`, to symbol names and source locations.
 
 Configuring users with passwords and limited privileges adds authentication, but does not bring these restrictions back. A user granted the access to files (`READ` and `WRITE` on `FILE`) gets the whole filesystem instead of a dedicated directory and, together with the `CREATE DICTIONARY` grant, the ability to run commands. The `file` function does not check the grants at all, so even a user without any grant on files can read every file.
 
```

---

### Incident Patch 3: `1baff789` (2026-11-21)
**Commit Message**: Merge pull request #132720 from Algunenano/read-by-layers-prefix-columns

Read only the used sorting key prefix in a read split into layers

**File**: `src/Processors/QueryPlan/ReadFromMergeTree.cpp` (modified, +24/-28)
```diff
@@ -39,11 +39,9 @@
 #include <Interpreters/DatabaseCatalog.h>
 #include <Storages/StorageProxy.h>
 #include <Interpreters/ExpressionActions.h>
-#include <Interpreters/ExpressionAnalyzer.h>
 #include <Interpreters/extractStringValueFilters.h>
 #include <Interpreters/InterpreterSelectQuery.h>
 #include <Interpreters/PredicateStatisticsLog.h>
-#include <Interpreters/TreeRewriter.h>
 #include <Interpreters/ClusterProxy/executeQuery.h>
 #include <Parsers/ASTFunction.h>
 #include <Parsers/ASTIdentifier.h>
@@ -1461,6 +1459,19 @@ struct PartRangesReadInfo
 
 }
 
+/// The expression of the first `prefix_size` sorting key columns. It keeps its input columns.
+/// It is cut from the analyzed sorting key, whose column names the sort descriptions use: analyzing the key again in
+/// the query context can name them differently, e.g. `nullIn` instead of `in` with `transform_null_in`.
+static ExpressionActionsPtr getSortingKeyPrefixExpression(const StorageMetadataPtr & metadata, size_t prefix_size)
+{
+    const auto & sorting_key = metadata->getSortingKey();
+    auto dag = sorting_key.expression->getActionsDAG().clone();
+    dag.removeUnusedActions(Names(sorting_key.column_names.begin(), sorting_key.column_names.begin() + prefix_size));
+    for (const auto * input : dag.getInputs())
+        dag.addOrReplaceInOutputs(*input);
+    return std::make_shared<ExpressionActions>(std::move(dag), sorting_key.expression->getSettings());
+}
+
 Pipe ReadFromMergeTree::readByLayers(
     const RangesInDataParts & parts_with_ranges,
     SplitPartsByRanges split_parts,
@@ -1482,38 +1493,29 @@ Pipe ReadFromMergeTree::readByLayers(
 
     if (reader_settings.read_in_order)
     {
+        /// Only the prefix of the sorting key that the streams of a layer are merged by and the layers are filtered by
+        /// is computed, so that the other sorting key columns are not read.
+        size_t prefix_size = input_order_info->used_prefix_of_sorting_key_size;
+        for (const auto & border : split_parts.borders)
+            prefix_size = std::max(prefix_size, border.size());
+        auto sorting_expr = getSortingKeyPrefixExpression(storage_snapshot->metadata, prefix_size);
+        const auto sorting_key_prefix_columns = sorting_expr->getRequiredColumns();
+
         /// `PREWHERE` runs before the sorting expression added below and may have removed an input
         /// column that the sorting key needs. Prohibit removing those inputs; the sorting expression
         /// keeps them, and they are dropped when the pipe header is converted to the step header.
         /// Same reasoning as in `spreadMarkRangesAmongStreamsWithOrder`.
         if (query_info.prewhere_info || query_info.row_level_filter)
         {
-            NameSet sorting_key_columns;
-            for (const auto & column : storage_snapshot->metadata->getSortingKey().expression->getRequiredColumnsWithTypes())
-                sorting_key_columns.insert(column.name);
-
+            NameSet sorting_key_columns(sorting_key_prefix_columns.begin(), sorting_key_prefix_columns.end());
             restorePrewhereInputs(query_info.row_level_filter.get(), query_info.prewhere_info.get(), sorting_key_columns);
         }
 
         NameSet column_names_set(column_names.begin(), column_names.end());
         in_order_column_names_to_read = column_names;
 
-        /// Only the prefix of the sorting key that the merge of a layer and the range filters of the layers use
-        /// has to be computed: reading the rest of the key would read and decode columns the query does not need.
-        size_t sorting_key_prefix_size = input_order_info->used_prefix_of_sorting_key_size;
-        if (!split_parts.borders.empty())
-            sorting_key_prefix_size = std::max(sorting_key_prefix_size, split_parts.borders.front().size());
-
-        auto sorting_key_prefix_ast = storage_snapshot->metadata->getSortingKey().expression_list_ast->clone();
-        sorting_key_prefix_ast->children.resize(sorting_key_prefix_size);
-        auto syntax_result = TreeRewriter(context).analyze(
-            sorting_key_prefix_ast,
-            storage_snapshot->metadata->getColumns().get(GetColumnsOptions(GetColumnsOptions::AllPhysical).withSubcolumns()));
-        auto sorting_expr = std::make_shared<ExpressionActions>(
-            ExpressionAnalyzer(sorting_key_prefix_ast, syntax_result, context).getActionsDAG(false));
-
         /// Add columns needed to calculate the sorting expression
-        for (const auto & column_name : sorting_expr->getRequiredColumns())
+        for (const auto & column_name : sorting_key_prefix_columns)
         {
             if (column_names_set.contains(column_name))
                 continue;
@@ -2511,11 +2513,7 @@ Pipe ReadFromMergeTree::spreadMarkRangesAmongStreamsWithOrder(
     if (need_preliminary_merge || output_each_partition_through_separate_port)
     {
         size_t prefix_size = input_order_info->used_prefix_of_sorting_key_size;
-        auto order_key_prefix
```

**File**: `tests/queries/0_stateless/05829_read_by_layers_reads_only_key_prefix.reference` (added, +10/-0)
```diff
@@ -0,0 +1,10 @@
+1
+100000
+1
+400000
+05829_join	1
+05829_uniq_exact	1
+500
+500
+0	40
+0
```

**File**: `tests/queries/0_stateless/05829_read_by_layers_reads_only_key_prefix.sql` (added, +50/-0)
```diff
@@ -0,0 +1,50 @@
+-- A read in order split into layers by a prefix of the sorting key reads only the columns of that prefix and of the query,
+-- not the other columns of the sorting key.
+
+DROP TABLE IF EXISTS t_layers_prefix;
+CREATE TABLE t_layers_prefix (k UInt32 CODEC(Delta, LZ4), s String) ENGINE = MergeTree ORDER BY (k, s)
+SETTINGS index_granularity = 1024, min_bytes_for_wide_part = 0;
+
+SYSTEM STOP MERGES t_layers_prefix;
+INSERT INTO t_layers_prefix SELECT number, hex(sipHash128(toString(number))) FROM numbers(100000);
+INSERT INTO t_layers_prefix SELECT number, hex(sipHash128(toString(number + 1000000))) FROM numbers(100000);
+
+-- Without the caches that skip the read of compressed data, which `ReadCompressedBytes` counts.
+SET max_threads = 4, enable_parallel_replicas = 0, use_uncompressed_cache = 0, use_columns_cache = 0;
+
+-- A single `uniqExact` of the first sorting key column, counted in order.
+SET optimize_aggregation_in_order = 1;
+SELECT count() > 0 FROM (EXPLAIN PIPELINE SELECT count(DISTINCT k) FROM t_layers_prefix) WHERE explain LIKE '%FilterSortedStreamByRange%';
+SELECT count(DISTINCT k) FROM t_layers_prefix SETTINGS log_comment = '05829_uniq_exact';
+
+-- A merge join of reads in order, joined by ranges of the primary key.
+SET join_algorithm = 'full_sorting_merge', query_plan_join_shard_by_pk_ranges = 1, optimize_read_in_order = 1;
+SELECT count() > 0 FROM (EXPLAIN PIPELINE SELECT count() FROM t_layers_prefix AS l JOIN t_layers_prefix AS r ON l.k = r.k) WHERE explain LIKE '%FilterSortedStreamByRange%';
+SELECT count() FROM t_layers_prefix AS l JOIN t_layers_prefix AS r ON l.k = r.k SETTINGS log_comment = '05829_join';
+
+SYSTEM FLUSH LOGS query_log;
+SELECT log_comment, ProfileEvents['ReadCompressedBytes'] < (SELECT data_compressed_bytes FROM system.columns WHERE database = currentDatabase() AND table = 't_layers_prefix' AND name = 's') / 10
+FROM system.query_log
+WHERE current_database = currentDatabase() AND log_comment IN ('05829_uniq_exact', '05829_join') AND type = 'QueryFinish' AND event_date >= yesterday()
+ORDER BY log_comment;
+
+DROP TABLE t_layers_prefix;
+
+-- The sorting key keeps its own names when the query settings would name its expressions differently: `IN` is `nullIn`
+-- with `transform_null_in`. The first key column is fixed by the condition, so the read is in order of `k`, in layers
+-- with several threads and by merging the parts with one.
+DROP TABLE IF EXISTS t_layers_prefix_in;
+CREATE TABLE t_layers_prefix_in (a UInt32, k UInt32, s String) ENGINE = MergeTree ORDER BY (a IN (1, 2), k, s)
+SETTINGS index_granularity = 128;
+
+SYSTEM STOP MERGES t_layers_prefix_in;
+INSERT INTO t_layers_prefix_in SELECT 1, number % 500, toString(number) FROM numbers(10000);
+INSERT INTO t_layers_prefix_in SELECT 1, number % 500, toString(number) FROM numbers(10000);
+
+SET transform_null_in = 1, read_in_order_two_level_merge_threshold = 1;
+SELECT uniqExact(k) FROM t_layers_prefix_in WHERE a = 1 SETTINGS max_threads = 4;
+SELECT uniqExact(k) FROM t_layers_prefix_in WHERE a = 1 SETTINGS max_threads = 1;
+SELECT k, count() FROM t_layers_prefix_in WHERE a = 1 GROUP BY k ORDER BY k LIMIT 1 SETTINGS max_threads = 1;
+SELECT k FROM t_layers_prefix_in WHERE a = 1 ORDER BY k LIMIT 1 SETTINGS max_threads = 1;
+
+DROP TABLE t_layers_prefix_in;
```

#### Recent Merged Pull Requests:
- **PR #133407** (2026-11-21): Document that `clickhouse-local` is not for multi-user scenarios (@alexey-milovidov)
- **PR #133396** (2026-11-21): Do not install the Rust documentation in the fasttest image (@groeneai)
- **PR #133389** (2026-11-21): Fix flaky test IOTestAwsS3Client.AssumeRoleRefreshInConcurrentFibers (@groeneai)
- **PR #133386** (2026-11-21): Docs: regenerate reference documentation from source (@clickhouse-gh[bot])
- **PR #133352** (2026-11-21): Backport #113397 to 26.3: Fix a table permanently stuck in the drop queue after a failed materialized-CTE query (@robot-ch-test-poll)
- **PR #133328** (2026-11-21): Fix flaky test 05045_query_plan_json_in_query_log (@groeneai)

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

## X. flaky test IOTestAwsS3Client.AssumeRoleRefreshInConcurrentFibers

**RULE**:
When implementing operations in `src/IO/S3/tests/gtest_aws_s3_client.cpp`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in ClickHouse/ClickHouse. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `b9d4d482`: flaky test IOTestAwsS3Client.AssumeRoleRefreshInConcurrentFibers. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing C++ data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/IO/S3/tests/gtest_aws_s3_client.cpp`.

**VERIFIED IMPLEMENTATION PATTERN**:
```c++
// Verified production-grade fix pattern:
        , server_socket(std::make_unique<Poco::Net::ServerSocket>(/* port = */ 0, /* backlog = */ std::max(64, max_threads)))
    const size_t fiber_count = getFiberCountAboveSchedulerThreads();
    /// A thread per fiber: the server closes, instead of queueing, a connection that finds no idle thread in its pool.
    }, /* max_threads = */ static_cast<int>(fiber_count));
```

**NEGATIVE CONSTRAINT**:
```c++
// Induced defect failure mode:
        , server_socket(std::make_unique<Poco::Net::ServerSocket>(0))
    });
    const size_t fiber_count = getFiberCountAboveSchedulerThreads();
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `b9d4d482` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.

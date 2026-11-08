> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/clickhouse-clickhouse-learnings.md`  
> **Source**: github ([https://github.com/ClickHouse/ClickHouse](https://github.com/ClickHouse/ClickHouse))  
> **Source Version**: `c847f42e`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-08T22:10:52.143Z  
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
> **Harvest Timestamp**: 2026-11-08T22:10:52.137Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `ClickHouse/ClickHouse`
- **Description**: ClickHouse® is a real-time analytics database management system
- **Primary Language / Ecosystem**: C++
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 50825 stars

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
- **Issue #129586** (2026-11-07): **toDecimalString(Decimal, 0) leaves a trailing decimal point when the scale is above 0**
  *Symptoms*: ### Describe what's wrong  `toDecimalString(x, 0)` on a `Decimal` with a scale above 0 returns the whole part followed by a bare `.`, for example `1.` instead of `1`. The same call on an integer, a `Float`, or a `Decimal` with scale 0 returns no point. The documentation says the result has exactly the specified number of fractional digits, so with 0 there should be no point.  ### Does it reproduce on the most recent release?  Yes. Reproduces on master, version 26.11.1.1436.  ### How to reproduce  ```sql SELECT     toDecimalString(toDecimal32(1.2, 1), 0),     toDecimalString(toDecimal32(1.5, 1), 0),     toDecimalString(toDecimal32(-1.2, 1), 0),     toDecimalString(toDecimal64(-0.4, 1), 0),     toDecimalString(toDecimal32(5, 0), 0),     toDecimalString(1.5, 0); ```  Output on 26.11.1.1436:  ``` 1.	2.	-1.	-0.	5	2 ```  It happens for every `Decimal` width (`Decimal32`, `Decimal64`, `Decimal128`, `Decimal256`).  ### Expected behavior  ``` 1	2	-1	-0	5	2 ```  The `-0` for `-0.4` is a separate question. `toDecimalString(-0.4, 0)` on a `Float` also returns `-0`, so it is left as is here.  ### Additional context  In `src/IO/WriteHelpers.h`, `writeText(Decimal<T>, ...)` rounds the value to `fractional_length` digits and sets `rounded_scale = fractional_length`, which is 0 here. The check that decides whether to write the fractional part still tests the original `scale` instead of `rounded_scale`, so `writeDecimalFractional` is called with zero digits and writes only the point.   <!-- ch

- **Issue #129521** (2026-11-06): **A `DataLakeCatalog` (Iceberg REST) catalog that returns an empty namespace entry aborts the ClickHouse server with `LOGICAL_ERROR`**
  *Symptoms*: :detective: When a `DataLakeCatalog` database with `catalog_type = 'rest'` lists namespaces, `RestCatalog::parseNamespaces` throws `LOGICAL_ERROR` if any entry in the catalog's `namespaces` array is an empty array:  ```cpp // src/Databases/DataLake/RestCatalog.cpp:1519-1521 auto current_namespace_array = namespaces_object->get(static_cast<int>(i)).extract<Poco::JSON::Array::Ptr>(); if (current_namespace_array->size() == 0)     throw DB::Exception(DB::ErrorCodes::LOGICAL_ERROR, "Expected namespace array to be non-empty"); ```  `LOGICAL_ERROR` aborts debug and sanitizer builds (and is a critical error on release). The catalog HTTP endpoint is an external, often untrusted input, so a malformed or malicious REST catalog can crash the server with a one-line response. `SHOW TABLES`, and any operation that lists namespaces, triggers it.  **How to reproduce**  Point a `DataLakeCatalog` at any REST catalog whose `GET /v1/namespaces` returns an entry that is an empty array, e.g.:  ```json {"namespaces": [["good_ns"], []]} ```  ```sql CREATE DATABASE c ENGINE = DataLakeCatalog('http://<rest-catalog>/v1') SETTINGS catalog_type = 'rest', warehouse = 's3://wh', storage_endpoint = 'http://<minio>/wh';  SHOW TABLES FROM c; -- <Fatal> : Logical error: 'Expected namespace array to be non-empty'.  -> server aborts (debug/sanitizer) ```  Reproduced deterministically (2/2) on master `26.11.1.1406` against a mock REST catalog returning `{"namespaces": [[""], [], ["a", ""]]}`.  **Root cause / fix**

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

### Incident Patch 1: `1aaec54f` (2026-11-08)
**Commit Message**: Merge pull request #112650 from ClickHouse/fix-with-fill-bounds-out-of-column-type-range

Reject WITH FILL bounds that do not fit the ORDER BY column type

**File**: `src/Core/SortDescription.h` (modified, +7/-0)
```diff
@@ -37,6 +37,13 @@ struct FillColumnDescription
     std::optional<IntervalKind> step_kind;
     Field fill_staleness;   /// Default = Null - should not be considered
     std::optional<IntervalKind> staleness_kind;
+    DataTypePtr fill_column_type;
+    /// The inclusive range of the values a fill column of `fill_column_type` can hold - the range of the storage
+    /// type intersected with the calendar window for `Date32`/`DateTime64` - precomputed once so that the per-row
+    /// representability check is two comparisons. Null bounds mean the type is not checked (see
+    /// `fillRepresentableRangeOfColumnType`).
+    Field fill_representable_min;
+    Field fill_representable_max;
 
     using StepFunction = std::function<void(Field &, Int64 jumps_count)>;
     StepFunction step_func;
```

**File**: `src/Interpreters/FillingRow.cpp` (modified, +274/-2)
```diff
@@ -1,16 +1,27 @@
+#include <algorithm>
 #include <cstddef>
+#include <limits>
+#include <optional>
 
 #include <Columns/IColumn.h>
+#include <DataTypes/DataTypeDateTime64.h>
+#include <DataTypes/DataTypesNumber.h>
 #include <IO/Operators.h>
 #include <Interpreters/FillingRow.h>
 #include <Common/FieldAccurateComparison.h>
+#include <Common/FieldVisitorToString.h>
 #include <Common/Logger.h>
 #include <Common/logger_useful.h>
 
 
 namespace DB
 {
 
+namespace ErrorCodes
+{
+    extern const int INVALID_WITH_FILL_EXPRESSION;
+}
+
 constexpr static bool debug_logging_enabled = false;
 
 template <class... Args>
@@ -37,11 +48,102 @@ bool equals(const Field & lhs, const Field & rhs)
     return accurateEquals(lhs, rhs);
 }
 
+bool fillValueFitsColumnType(const Field & value, const IDataType & type)
+{
+    const auto [min, max] = fillRepresentableRangeOfColumnType(type);
+
+    /// Null bounds - a type whose every value is representable (or saturates instead of wrapping around,
+    /// like Float and Decimal), nothing to check.
+    if (min.isNull())
+        return true;
+
+    return !accurateLess(value, min) && !accurateLess(max, value);
+}
+
+std::pair<Field, Field> fillRepresentableRangeOfColumnType(const IDataType & type)
+{
+    WhichDataType which(type);
+
+    if (which.isDate())
+        return {Field(static_cast<UInt64>(0)), Field(static_cast<UInt64>(std::numeric_limits<UInt16>::max()))};
+
+    if (which.isDateTime())
+        return {Field(static_cast<UInt64>(0)), Field(static_cast<UInt64>(std::numeric_limits<UInt32>::max()))};
+
+    if (which.isDate32())
+        return {Field(static_cast<Int64>(DATE_LUT_MIN_EXTEND_DAY_NUM)), Field(static_cast<Int64>(DATE_LUT_MAX_EXTEND_DAY_NUM))};
+
+    if (which.isDateTime64())
+    {
+        /// For Date32 and DateTime64 the boundaries of the representable calendar lie strictly inside the range of
+        /// the storage type, and the values between the two are invalid: nothing else produces them (conversions
+        /// clamp at the calendar boundary) and the serializers render them as the clamped boundary date.
+        /// The calendar clamps in the local civil calendar of the column's time zone (the local year is clamped to
+        /// [0000, 9999], see e.g. DateLUTImpl::addYearsOutOfRange), so the boundary expressed in raw ticks is
+        /// shifted by the UTC offset of the time zone, and the last representable time point has all its
+        /// sub-second digits set. For a high enough scale the calendar window in ticks is wider than the Int64
+        /// storage of the column, so the window is clamped to the storage range.
+        const auto & date_time_type = static_cast<const DataTypeDateTime64 &>(type);
+        const auto & time_zone = date_time_type.getTimeZone();
+        const UInt32 scale = date_time_type.getScale();
+        const Int64 max_seconds = time_zone.makeDateTime(DATE_LUT_MAX_REPRESENTABLE_YEAR, 12, 31, 23, 59, 59);
+        const Int64 min_seconds = time_zone.makeDateTime(DATE_LUT_MIN_REPRESENTABLE_YEAR, 1, 1, 0, 0, 0);
+        const Int128 scale_multiplier = DecimalUtils::scaleMultiplier<Int128>(scale);
+        const Int128 max_ticks = std::min(
+            static_cast<Int128>(max_seconds) * scale_multiplier + (scale_multiplier - 1),
+            static_cast<Int128>(std::numeric_limits<Int64>::max()));
+        const Int128 min_ticks = std::max(
+            static_cast<Int128>(min_seconds) * scale_multiplier,
+            static_cast<Int128>(std::numeric_limits<Int64>::min()));
+        return {
+            Field(DecimalField<Decimal64>(static_cast<Int64>(min_ticks), scale)),
+            Field(DecimalField<Decimal64>(static_cast<Int64>(max_ticks), scale))};
+    }
+
+    if (isInteger(type))
+    {
+        switch (which.idx)
+        {
+            case TypeIndex::UInt8:
+                return {Field(static_cast<UInt64>(0)), Field(static_cast<UInt64>(std::numeric_limits<UInt8>::max()))};
+            case TypeIndex::UInt16:
+                return {Field(static_cast<UInt64>(0)), Field(static_cast<UInt64>(std::numeric_limits<UInt16>::max()))};
+            case TypeIndex::UInt32:
+                return {Field(static_cast<UInt64>(0)), Field(static_cast<UInt64>(std::numeric_limits<UInt32>::max()))};
+            case TypeIndex::UInt64:
+                return {Field(static_cast<UInt64>(0)), Field(std::numeric_limits<UInt64>::max())};
+            case TypeIndex::UInt128:
+                return {Field(static_cast<UInt128>(0)), Field(std::numeric_limits<UInt128>::max())};
+            case TypeIndex::UInt256:
+                return {Field(static_cast<UInt256>(0)), Field(std::numeric_limits<UInt256>::max())};
+            case TypeIndex::Int8:
+                return {Field(static_cast<Int64>(std::numeric_limits<Int8>::min())), Field(static_cast<Int64>(std::numeric_limits<Int8>::max()))};
+            case TypeIndex::Int16:
+                return {Field(static_cast<Int64>(std::numeric_limits<Int16>::min())), Field(s
```

**File**: `src/Interpreters/FillingRow.h` (modified, +23/-0)
```diff
@@ -9,6 +9,16 @@ namespace DB
 bool less(const Field & lhs, const Field & rhs, int direction);
 bool equals(const Field & lhs, const Field & rhs);
 
+/// Whether `value` is a valid value of a fill column of type `type`: it fits the range of the storage type and,
+/// for the calendar-backed `Date32` and `DateTime64`, the representable calendar window as well. Types that
+/// saturate instead of wrapping around (`Float`, `Decimal`) are not checked and always pass.
+bool fillValueFitsColumnType(const Field & value, const IDataType & type);
+
+/// The inclusive `[min, max]` range that `fillValueFitsColumnType` checks against, as `Field`s comparable with
+/// the values the filling generates, so that the per-generated-value check does not have to redo the type
+/// dispatch. Null bounds mean the type is not checked and every value passes.
+std::pair<Field, Field> fillRepresentableRangeOfColumnType(const IDataType & type);
+
 /** Helps to implement modifier WITH FILL for ORDER BY clause.
  *  Stores row as array of fields and provides functions to generate next row for filling gaps and for comparing rows.
  *  Used in FillingTransform.
@@ -18,6 +28,9 @@ class FillingRow
     /// finds last value <= to
     Field doLongJump(const FillColumnDescription & descr, size_t column_ind, const Field & to);
 
+    void checkGeneratedValueFitsColumnType(const Field & value, size_t column_ind) const;
+    void checkFillingTowardsConstraintFitsColumnType(size_t column_ind);
+
     bool hasSomeConstraints(size_t pos) const;
     bool isConstraintsSatisfied(size_t pos) const;
 
@@ -38,6 +51,12 @@ class FillingRow
     void initUsingTo(size_t from_pos = 0);
     void updateConstraintsWithStalenessRow(const Columns& base_row, size_t row_ind);
 
+    /// Throws when filling from the current row towards a constraint past the range of a column type would
+    /// generate a value the column cannot hold. The per-value check in `next` rejects such a value too, but only
+    /// after generating every value up to the boundary of the type - 2^32 rows for `DateTime` - so this is checked
+    /// up front once the anchor of the filling is known.
+    void checkFillingTowardsConstraintsFitsColumnTypes();
+
     Field & operator[](size_t index) { return row[index]; }
     const Field & operator[](size_t index) const { return row[index]; }
     size_t size() const { return row.size(); }
@@ -55,6 +74,10 @@ class FillingRow
 private:
     Row row;
     Row constraints;
+    /// The value and the constraint of each column whose walk towards its constraint in `next` was last checked
+    /// by `checkFillingTowardsConstraintFitsColumnType`, so that the check runs once per walk, not once per step.
+    Row checked_walk_cursor;
+    Row checked_walk_constraint;
     SortDescription sort_description;
 };
 
```

**File**: `src/Processors/Transforms/FillingTransform.cpp` (modified, +480/-12)
```diff
@@ -13,12 +13,17 @@
 #include <DataTypes/DataTypeNullable.h>
 #include <Functions/FunctionDateOrDateTimeAddInterval.h>
 #include <Functions/IFunction.h>
+#include <Common/FieldAccurateComparison.h>
 #include <Common/FieldVisitorScale.h>
 #include <Common/FieldVisitorSum.h>
 #include <Common/FieldVisitorToString.h>
 #include <Common/logger_useful.h>
 #include <IO/Operators.h>
 #include <base/arithmeticOverflow.h>
+#include <algorithm>
+#include <limits>
+#include <optional>
+#include <tuple>
 
 
 namespace DB
@@ -61,32 +66,184 @@ Block FillingTransform::transformHeader(Block header, const SortDescription & so
     return header;
 }
 
-/// Multiply through UInt64 so the result wraps by construction (FillingRow::doLongJump relies on
-/// well-defined wraparound to detect the overflowed jump). A signed Int64 multiply is UB on overflow.
-static Int64 mulStepWrapping(Int64 step, Int64 jumps_count)
+/** Returns `value + step * jumps_count * unit_length`, computed exactly in Int128, so that an intermediate product
+  * that does not fit Int64 is not mistaken for a result that does not fit it: an opposite-signed `value` can bring the
+  * sum back into range. Past 2^65 units the number of units is clamped, which keeps the result out of the range of
+  * Int64 in the direction of the step whatever `value` is, and keeps the product with `unit_length` within Int128.
+  * `unit_length` is positive and below 2^42 (an hour in nanoseconds is 3.6 * 10^12).
+  */
+static Int128 addStepExact(Int64 value, Int64 step, Int64 jumps_count, Int64 unit_length)
 {
-    return static_cast<Int64>(static_cast<UInt64>(step) * static_cast<UInt64>(jumps_count));
+    static constexpr Int128 max_units = static_cast<Int128>(1) << 65;
+    const Int128 units = std::clamp(static_cast<Int128>(step) * jumps_count, -max_units, max_units);
+    return value + units * unit_length;
+}
+
+/// `addStepExact` saturated to the range of Int64. A saturated result lies past the range of the column in the
+/// direction of the step, which holds for every column type using it (`Date`, `Date32`, `DateTime`): none of them
+/// can hold the boundaries of Int64.
+static Int64 addStepSaturating(Int64 value, Int64 step, Int64 jumps_count, Int64 unit_length)
+{
+    const Int128 res = addStepExact(value, step, jumps_count, unit_length);
+    if (res > std::numeric_limits<Int64>::max())
+        return std::numeric_limits<Int64>::max();
+    if (res < std::numeric_limits<Int64>::min())
+        return std::numeric_limits<Int64>::min();
+    return static_cast<Int64>(res);
+}
+
+/** Wraps the ticks a step over DateTime64 lands on into a field. A result past the Int64 storage of the column is
+  * kept exactly in a wider `Decimal128` of the same scale instead of being saturated to the boundary of Int64: at
+  * scale 9 that boundary (`2262-04-11 23:47:16.854775807`) is itself a valid value of the column, so a saturated
+  * exclusive bound (e.g. of `STALENESS`) would exclude it, and a saturated step would land on it. Such a field only
+  * takes part in comparisons: `FillingRow` stops the filling at it or rejects it as a value the column cannot hold.
+  */
+static Field dateTime64StepResult(Int128 ticks, UInt32 scale)
+{
+    if (ticks >= std::numeric_limits<Int64>::min() && ticks <= std::numeric_limits<Int64>::max())
+        return DecimalField<DateTime64>(DateTime64(static_cast<Int64>(ticks)), scale);
+    return DecimalField<Decimal128>(Decimal128(ticks), scale);
+}
+
+/** The calendar arithmetic of `Date` and `DateTime` returns the column's own storage type (`UInt16` / `UInt32`), so a
+  * step whose result does not fit it wraps around: `toDateTime('2100-01-01', 'UTC') + INTERVAL 10 YEAR` lands in
+  * 1973, and a step longer than the span of the type (`INTERVAL 150 YEAR` over `DateTime`) even wraps forward, to a
+  * value that is still ahead of the current one. Redo such a step in the wider calendar of `Date32` (day numbers)
+  * or `DateTime64(0)` (whole seconds), which agrees with the narrow one wherever the result fits, and return the
+  * result when it does not fit the storage type, so that the sequence stays monotonic: a border within the range of
+  * the type stops the filling there, and `FillingRow` rejects a value the column cannot hold instead of writing a
+  * wrapped-around one. Kinds whose result is not of the storage type (e.g. an hour step over `Date`) are left as is.
+  */
+template <typename Impl, typename T>
+static std::optional<Int64> calendarStepOutOfStorageType(T value, Int64 delta, const DateLUTImpl & date_lut, const DateLUTImpl & utc_time_zone)
+{
+    using NativeResult = decltype(Impl::execute(value, delta, date_lut, utc_time_zone, UInt16{}));
+
+    Int64 result = 0;
+    if constexpr (std::is_same_v<T, UInt16> && std::is_same_v<NativeResult, UInt16>)
+        result = Impl::execute(static_cast<Int32>(value), delta, date_lut, utc_time_zone, 0);
+    else if constexpr (std::is_same_v<T, UInt32> && std::is_same_v<NativeResult, UInt32>)
```

**File**: `tests/queries/0_stateless/04657_with_fill_bounds_out_of_column_type_range.reference` (added, +181/-0)
```diff
@@ -0,0 +1,181 @@
+out of range bounds are rejected
+the exclusive TO bound may be one step outside of the range
+256	0	255
+129	-128	0
+1	5	5
+a TO bound out of range is fine when STEP stops before it
+87	0	255
+87	-128	127
+[5,250]
+without FROM the query is rejected only when the fill actually wraps
+84	5	254
+25	-125	-5
+[5]
+0
+0
+STALENESS caps the sequence before TO, so the TO bound is not rejected
+20	5	24
+20	-24	-5
+7	5	23
+[250,251,252,253,254]
+[250]
+an INTERVAL step over Date and DateTime is rejected when it leaves the column type before reaching a TO out of range in the fill direction
+['1970-01-01','2070-01-01']
+['1970-01-01 00:00:00','2020-01-01 00:00:00','2070-01-01 00:00:00']
+2	1970-03-05	2070-03-05
+51	1970-01-01	2020-01-01
+1	2020-01-01	2020-01-01
+1	2020-01-01	2020-01-01
+3	2026-03-05	2028-03-05
+an INTERVAL step clamps at the calendar boundary of Date32 and DateTime64, so any TO is accepted
+1	9999-12-31	9999-12-31
+1	9999-06-01	9999-06-01
+2	0000-06-01	0001-06-01
+1	9999-06-01 00:00:00	9999-06-01 00:00:00
+1	9999-06-01 00:00:00.123	9999-06-01 00:00:00.123
+2	0000-06-01 00:00:00	0001-06-01 00:00:00
+9	2000-01-01 00:00:00	9999-01-01 00:00:00
+2	9998-06-01 00:00:00	9999-06-01 00:00:00
+1
+7	2020-01-01	2026-01-01
+4	2020-01-01 00:00:00	2020-01-04 00:00:00
+3	2026-03-05	2028-03-05
+bounds between the calendar boundary and the storage boundary of Date32 and DateTime64 are invalid
+2	0000-01-01 00:00:00	2000-01-01 00:00:00
+100	2000-01-01 00:00:00	9999-12-31 23:59:59
+2
+1
+2
+3
+a numeric step over DateTime64 must not generate ticks beyond the calendar
+1	9999-12-31 23:59:58	9999-12-31 23:59:58
+1	0000-01-01 00:00:01	0000-01-01 00:00:01
+1	9999-12-31 23:59:59.998	9999-12-31 23:59:59.998
+1	9999-12-31 23:59:58	9999-12-31 23:59:58
+1	9999-12-31 23:59:58	9999-12-31 23:59:58
+1	9999-12-31 23:59:59.998	9999-12-31 23:59:59.998
+1	9999-12-31 23:59:58	9999-12-31 23:59:58
+an INTERVAL step that stagnates at the calendar boundary before an in-range TO stops there
+1	9999-06-01 00:00:00	9999-06-01 00:00:00
+3	9995-06-01 00:00:00	9999-06-01 00:00:00
+3	2000-01-01	9999-12-01
+10	9990-01-01 00:00:00	9999-01-01 00:00:00
+1	9998-06-01 00:00:00	9998-06-01 00:00:00
+5
+an INTERVAL step that would leave the column type before an in-range TO stops at TO
+['2106-01-01 00:00:00']
+['2000-01-01 00:00:00','2050-01-01 00:00:00','2100-01-01 00:00:00']
+['2100-01-01 00:00:00']
+['1970-01-01 00:00:00']
+['1970-01-01 00:00:00']
+['2148-01-01']
+4	2106-01-01 00:00:00	2106-01-04 00:00:00
+['1970-01-01 00:00:00']
+['1970-01-01 00:00:00']
+['1970-01-01 02:46:40']
+a numeric step that overflows the Int64 arithmetic carrier stops at TO
+[9223372036854775806]
+[-9223372036854775807]
+[9223372036854775800,9223372036854775805]
+[9223372036854775806,9223372036854775807]
+a generated value out of range of the column type is rejected at runtime
+[11,14,17,20,23,26,29,32,35,38,41,44,47,50,53,56,59,62,65,68,71,74,77,80,83,86,89,92,95,98,101,104,107,110,113,116,119,122,125,128,131,134,137,140,143,146,149,152,155,158,161,164,167,170,173,176,179,182,185,188,191,194,197,200,203,206,209,212,215,218,221,224,227,230,233,236,239,242,245,248,251,254]
+[127]
+a fill towards a STALENESS border out of range of the column type is rejected
+10	9999-12-31 23:59:58
+10	2020-01-01 00:00:09
+in-range filling is unchanged
+[1,2,3,4,5,6,7,8,9]
+[-1,-2,-3,-4,-5,-6,-7]
+4	2025-12-30	2026-01-02
+7	2020-01-01	2026-01-01
+4	2025-12-30	2026-01-02
+20	2020-06-16 00:00:00	2020-06-16 09:30:00
+[5,5.25,5.5,5.75]
+DISTINCT in order over a filled stream
+256
+256
+NaN and infinity in a float fill column stay accepted
+1	nan
+2	0
+3	100
+1	inf
+2	0
+3	100
+0
+1
+5
+nan
+1e300
+the runtime check covers a trailing fill column as well
+162	254
+a fixed-length INTERVAL step over DateTime64 saturates at the boundary of the storage type
+2262-04-11 23:47:14.000000000
+2262-04-11 23:47:15.000000000
+2262-04-11 23:47:16.000000000
+2262-04-11 23:47:14.000000000
+1700-01-01 00:00:00.000000000
+1700-01-01 00:00:01.000000000
+2262-04-11 23:47:14.000000000
+2262-04-11 23:47:15.000000000
+an INTERVAL step finer than the scale of DateTime64 is converted to whole ticks of the column
+2000-01-01 00:00:00.00
+2000-01-01 00:00:00.01
+2000-01-01 00:00:00.02
+2000-01-01 00:00:00.03
+2000-01-01 00:00:00.04
+2000-01-01 00:00:00
+2000-01-01 00:00:01
+2000-01-01 00:00:02
+a step whose ticks overflow Int64 but whose result fits is not saturated
+1700-01-01 00:00:00.000000000
+2080-04-06 21:20:00.000000000
+2200-01-01 00:00:00.000000000
+1819-09-27 02:40:00.000000000
+1700-01-01 00:00:00.000000000
+1800-01-01 00:00:00.000000000
+1890-02-18 10:40:00.000000000
+2080-04-06 21:20:00.000000000
+a calendar step does not wrap around before it is compared
+1700-01-01 00:00:00.000000000
+1
+1
+a numeric step truncated to zero ticks does not advance
+9999-12-31 23:59:58.00
+a quarter step whose number of months overflows Int64 does not wrap around
+['2000-01-01 00:00:00']
+['2001-01-01 00:00:00']
+
```

**File**: `tests/queries/0_stateless/04657_with_fill_bounds_out_of_column_type_range.sql` (added, +401/-0)
```diff
@@ -0,0 +1,401 @@
+-- WITH FILL bound values that do not fit the type of the ORDER BY column used to be silently truncated when the
+-- generated values were written into the column, so the filled stream wrapped around and was not sorted anymore,
+-- while the query plan kept claiming it was. DISTINCT in order then deduplicated within wrong ranges.
+-- A fill with FROM generates the same sequence for any data, so it is checked up front; a fill anchored at a data
+-- value is checked value by value as it is generated.
+
+SELECT 'out of range bounds are rejected';
+
+SELECT * FROM (SELECT 5 AS x ORDER BY x ASC WITH FILL FROM 1 TO 1025) FORMAT Null; -- { serverError INVALID_WITH_FILL_EXPRESSION }
+SELECT * FROM (SELECT toUInt8(5) AS x ORDER BY x ASC WITH FILL FROM 1000 TO 1010) FORMAT Null; -- { serverError INVALID_WITH_FILL_EXPRESSION }
+SELECT * FROM (SELECT toUInt8(5) AS x ORDER BY x DESC WITH FILL FROM 300 TO 250) FORMAT Null; -- { serverError INVALID_WITH_FILL_EXPRESSION }
+SELECT * FROM (SELECT toInt8(5) AS x ORDER BY x ASC WITH FILL FROM 120 TO 140) FORMAT Null; -- { serverError INVALID_WITH_FILL_EXPRESSION }
+SELECT * FROM (SELECT toDate(0) AS d ORDER BY d ASC WITH FILL FROM 0 TO 100000) FORMAT Null; -- { serverError INVALID_WITH_FILL_EXPRESSION }
+SELECT * FROM (SELECT toDate32('2020-01-01') AS d ORDER BY d ASC WITH FILL FROM 0 TO 3000000000) FORMAT Null; -- { serverError INVALID_WITH_FILL_EXPRESSION }
+SELECT * FROM (SELECT toDateTime(5, 'UTC') AS t ORDER BY t ASC WITH FILL FROM 0 TO 4294967297) FORMAT Null; -- { serverError INVALID_WITH_FILL_EXPRESSION }
+SELECT * FROM (SELECT toUInt8(5) AS x ORDER BY x ASC WITH FILL FROM 0 TO 260 STEP 3) FORMAT Null; -- { serverError INVALID_WITH_FILL_EXPRESSION }
+
+SELECT 'the exclusive TO bound may be one step outside of the range';
+
+SELECT count(), min(x), max(x) FROM (SELECT toUInt8(5) AS x ORDER BY x ASC WITH FILL FROM 0 TO 256);
+SELECT count(), min(x), max(x) FROM (SELECT toInt8(-5) AS x ORDER BY x DESC WITH FILL FROM 0 TO -129);
+SELECT count(), min(x), max(x) FROM (SELECT toUInt8(5) AS x ORDER BY x ASC WITH FILL TO 0);
+
+SELECT 'a TO bound out of range is fine when STEP stops before it';
+
+SELECT count(), min(x), max(x) FROM (SELECT toUInt8(5) AS x ORDER BY x ASC WITH FILL FROM 0 TO 257 STEP 3);
+SELECT count(), min(x), max(x) FROM (SELECT toInt8(5) AS x ORDER BY x DESC WITH FILL FROM 127 TO -130 STEP -3);
+SELECT groupArray(x) FROM (SELECT toUInt8(5) AS x ORDER BY x ASC WITH FILL FROM 250 TO 300 STEP 100);
+SELECT * FROM (SELECT toInt8(5) AS x ORDER BY x DESC WITH FILL FROM 127 TO -130 STEP -4) FORMAT Null; -- { serverError INVALID_WITH_FILL_EXPRESSION }
+
+SELECT 'without FROM the query is rejected only when the fill actually wraps';
+
+-- The sequence is anchored at a data value, so which values are generated is known only at execution time:
+-- from 5 this fill stops at 254, while from 6 it would reach 256.
+SELECT count(), min(x), max(x) FROM (SELECT toUInt8(5) AS x ORDER BY x ASC WITH FILL TO 257 STEP 3);
+SELECT count(), min(x), max(x) FROM (SELECT toInt8(-5) AS x ORDER BY x DESC WITH FILL TO -130 STEP -5);
+-- A step so large that filling generates nothing at all is fine too.
+SELECT groupArray(x) FROM (SELECT toUInt8(5) AS x ORDER BY x ASC WITH FILL TO 1000 STEP 5000);
+-- The last generated value always lands within one step before TO, so these wrap from every possible anchor...
+SELECT * FROM (SELECT toUInt8(5) AS x ORDER BY x ASC WITH FILL TO 1025) FORMAT Null; -- { serverError INVALID_WITH_FILL_EXPRESSION }
+SELECT * FROM (SELECT toUInt8(5) AS x ORDER BY x ASC WITH FILL TO 1000 STEP 3) FORMAT Null; -- { serverError INVALID_WITH_FILL_EXPRESSION }
+SELECT * FROM (SELECT toInt8(-5) AS x ORDER BY x DESC WITH FILL TO -300 STEP -5) FORMAT Null; -- { serverError INVALID_WITH_FILL_EXPRESSION }
+-- ...but without any anchor nothing is generated at all, so nothing wraps and the bound is harmless.
+SELECT count() FROM (SELECT x FROM (SELECT toUInt8(1) AS x WHERE 0) ORDER BY x WITH FILL TO 1025);
+SELECT count() FROM (SELECT d FROM (SELECT toDate(0) AS d WHERE 0) ORDER BY d WITH FILL TO 70000 STEP INTERVAL 100 YEAR);
+-- With FROM the sequence is generated even without data, so an empty input does not help.
+SELECT count() FROM (SELECT x FROM (SELECT toUInt8(1) AS x WHERE 0) ORDER BY x WITH FILL FROM 0 TO 1025); -- { serverError INVALID_WITH_FILL_EXPRESSION }
+
+SELECT 'STALENESS caps the sequence before TO, so the TO bound is not rejected';
+
+-- STALENESS is allowed only without FROM, and it replaces TO as the effective bound whenever it comes first,
+-- so the sequence stops at the last data value plus the staleness and stays far below an out of range TO.
+SELECT count(), min(x), max(x) FROM (SELECT toUInt8(5) AS x ORDER BY x ASC WITH FILL TO 1025 STALENESS 20);
+SELECT count(), min(x), max(x) FROM (SELECT toInt8(-5) AS x ORDER BY x DESC WITH FILL TO -300 STALENESS -20);
+SELECT count(), min(x), max(x) FROM (SELECT toUInt8(5) AS x ORDER BY x ASC W
```

**File**: `tests/queries/0_stateless/05045_with_fill_serialized_query_plan.reference` (modified, +1/-0)
```diff
@@ -23,6 +23,7 @@
 3
 2
 1
+0
 -- FROM 0 TO 6 INTERPOLATE, two shards
 0	1
 1	10
```

---

### Incident Patch 2: `0034fb32` (2026-11-08)
**Commit Message**: Merge pull request #129971 from groeneai/groeneai/correlated-subquery-null-outer-value

Fix correlated scalar and EXISTS subqueries ignoring the rows produced for a NULL outer value

**File**: `src/Planner/PlannerCorrelatedSubqueries.cpp` (modified, +15/-4)
```diff
@@ -199,6 +199,9 @@ struct DecorrelationContext
     /// Whether the optimizer will turn the referenced input subplan into an in-memory ChunkBuffer.
     /// Decided once here (see decorrelateQueryPlan); buildLogicalJoin uses it to pick the join kind.
     bool uses_in_memory_buffer = false;
+    /// Whether the correlated columns of the decorrelated plan may come from the distinct outer values, where `NULL`
+    /// is a value. Otherwise they are equal inner columns, which the retained `equals` filter never lets be `NULL`.
+    bool uses_correlated_domain = false;
 };
 
 /// How to convert an equivalent column to exactly the correlated column type.
@@ -415,6 +418,7 @@ bool referencedInputUsesInMemoryBuffer(const DecorrelationContext & context)
 QueryPlan buildCorrelatedDomainPlan(DecorrelationContext & context)
 {
     context.uses_in_memory_buffer = referencedInputUsesInMemoryBuffer(context);
+    context.uses_correlated_domain = true;
     context.query_plan.addStep(std::make_unique<CommonSubplanStep>(context.query_plan.getCurrentHeader()));
 
     auto buffer_header = std::make_shared<Block>();
@@ -1601,7 +1605,8 @@ QueryPlan buildLogicalJoin(
     QueryPlan input_stream_plan,
     QueryPlan decorrelated_plan,
     const CorrelatedSubquery & correlated_subquery,
-    bool uses_in_memory_buffer
+    bool uses_in_memory_buffer,
+    bool uses_correlated_domain
 )
 {
     auto lhs_plan_header = decorrelated_plan.getCurrentHeader();
@@ -1664,7 +1669,11 @@ QueryPlan buildLogicalJoin(
         std::vector<JoinActionRef> eq_arguments;
         eq_arguments.push_back(join_expression_actions.findNode(get_lhs_column_name(column_name), /* is_input= */ true));
         eq_arguments.push_back(join_expression_actions.findNode(get_rhs_column_name(column_name), /* is_input= */ true));
-        auto eq_node = JoinActionRef::transform(eq_arguments, JoinActionRef::AddFunction(JoinConditionOperator::Equals));
+        /// A `NULL` domain value has its own evaluation of the subquery, which must match the outer rows with `NULL`.
+        auto key_operator = uses_correlated_domain && isNullableOrLowCardinalityNullable(eq_arguments.front().getType())
+            ? JoinConditionOperator::NullSafeEquals
+            : JoinConditionOperator::Equals;
+        auto eq_node = JoinActionRef::transform(eq_arguments, JoinActionRef::AddFunction(key_operator));
         predicates.push_back(std::move(eq_node));
     }
 
@@ -1856,7 +1865,8 @@ void buildQueryPlanForCorrelatedSubquery(
                 std::move(context.query_plan),
                 std::move(decorrelated_plan),
                 correlated_subquery,
-                context.uses_in_memory_buffer);
+                context.uses_in_memory_buffer,
+                context.uses_correlated_domain);
             break;
         }
         case CorrelatedSubqueryKind::EXISTS:
@@ -1906,7 +1916,8 @@ void buildQueryPlanForCorrelatedSubquery(
                 std::move(context.query_plan),
                 std::move(decorrelated_plan),
                 correlated_subquery,
-                context.uses_in_memory_buffer);
+                context.uses_in_memory_buffer,
+                context.uses_correlated_domain);
             break;
         }
         case CorrelatedSubqueryKind::LATERAL_JOIN:
```

**File**: `tests/queries/0_stateless/04053_correlated_subquery_group_by_use_nulls.reference` (modified, +3/-3)
```diff
@@ -86,17 +86,17 @@
 3	5	3
 4	5	4
 5	5	5
-\N	\N
+\N	0
 0	0
 1	0
 2	0
 3	3
-\N	\N
+\N	0
 0	100
 1	0
 2	0
 3	3
-\N	\N
+\N	(NULL,NULL)
 0	(0,0)
 1	(1,0)
 2	(2,0)
```

**File**: `tests/queries/0_stateless/04370_distinct_combinator_correlated_subquery_group_by_use_nulls.reference` (modified, +1/-1)
```diff
@@ -7,7 +7,7 @@
 0	1
 1	1
 2	1
-\N	\N
+\N	0
 0	0
 1	1
 2	2
```

**File**: `tests/queries/0_stateless/04516_correlated_subquery_return_type_group_by_use_nulls.reference` (modified, +1/-1)
```diff
@@ -19,7 +19,7 @@
 7	(7)
 8	(8)
 9	(9)
-\N	\N
+\N	(NULL)
 0	0
 1	1
 2	2
```

**File**: `tests/queries/0_stateless/05567_correlated_subquery_null_outer_value.reference` (added, +63/-0)
```diff
@@ -0,0 +1,63 @@
+-- { echo }
+
+-- Scalar subqueries
+SELECT d.c2, (SELECT count() FROM n_t n WHERE d.c2 IS NOT NULL OR d.c2 IS NULL) FROM d_t d ORDER BY d.c2 NULLS LAST;
+1	1
+\N	1
+SELECT d.c2, (SELECT sum(n.x) FROM n_t n WHERE d.c2 IS NOT NULL OR d.c2 IS NULL), (SELECT groupArray(n.x) FROM n_t n WHERE d.c2 IS NOT NULL OR d.c2 IS NULL), (SELECT any(n.x) FROM n_t n WHERE d.c2 IS NOT NULL OR d.c2 IS NULL) FROM d_t d ORDER BY d.c2 NULLS LAST;
+1	7	[7]	7
+\N	7	[7]	7
+SELECT d.c2, (SELECT groupArray(n.x) FROM n_t n WHERE d.c2 IS NULL) FROM d_t d ORDER BY d.c2 NULLS LAST;
+1	[]
+\N	[7]
+SELECT d.c2, (SELECT n.x FROM n_t n WHERE d.c2 IS NULL) FROM d_t d ORDER BY d.c2 NULLS LAST;
+1	\N
+\N	7
+-- EXISTS in the projection
+SELECT r.v, EXISTS (SELECT 1 FROM values('a Nullable(Int32)', (NULL), (1)) t WHERE isNotDistinctFrom(t.a, r.v)) FROM values('v Nullable(Int32)', (NULL), (1), (2)) r ORDER BY r.v NULLS LAST;
+1	1
+2	0
+\N	1
+SELECT r.v, EXISTS (SELECT 1 FROM values('a Nullable(Int32)', (NULL), (1)) t WHERE r.v IS NULL) FROM values('v Nullable(Int32)', (NULL), (1), (2)) r ORDER BY r.v NULLS LAST;
+1	0
+2	0
+\N	1
+-- [NOT] EXISTS in WHERE
+SELECT d.c2 FROM d_t d WHERE EXISTS (SELECT 1 FROM n_t n WHERE d.c2 IS NULL) ORDER BY d.c2 NULLS LAST;
+\N
+SELECT d.c2 FROM d_t d WHERE NOT EXISTS (SELECT 1 FROM n_t n WHERE d.c2 IS NULL) ORDER BY d.c2 NULLS LAST;
+1
+-- `NULL = NULL` is not true, so the NULL row has no match here
+SELECT r.v, EXISTS (SELECT 1 FROM values('a Nullable(Int32)', (NULL), (1)) t WHERE t.a = r.v) FROM values('v Nullable(Int32)', (NULL), (1), (2)) r ORDER BY r.v NULLS LAST SETTINGS correlated_subqueries_substitute_equivalent_expressions = 1;
+1	1
+2	0
+\N	0
+SELECT r.v, EXISTS (SELECT 1 FROM values('a Nullable(Int32)', (NULL), (1)) t WHERE t.a = r.v) FROM values('v Nullable(Int32)', (NULL), (1), (2)) r ORDER BY r.v NULLS LAST SETTINGS correlated_subqueries_substitute_equivalent_expressions = 0;
+1	1
+2	0
+\N	0
+-- Type wrappers and several correlated columns
+SELECT r.v, (SELECT groupArray(n.x) FROM n_t n WHERE r.v IS NULL) FROM values('v LowCardinality(Nullable(String))', ('a'), (NULL)) r ORDER BY r.v NULLS LAST;
+a	[]
+\N	[7]
+SELECT r.v, (SELECT groupArray(n.x) FROM n_t n WHERE r.v IS NULL) FROM (SELECT NULL AS v) r;
+\N	[7]
+SELECT m.a, m.b, (SELECT groupArray(n.x) FROM n_t n WHERE m.a IS NULL AND m.b > 0) FROM m_t m ORDER BY m.a NULLS LAST, m.b;
+1	1	[]
+\N	0	[]
+\N	1	[7]
+-- Join layouts and algorithms
+SELECT d.c2, (SELECT groupArray(n.x) FROM n_t n WHERE d.c2 IS NULL) FROM d_t d ORDER BY d.c2 NULLS LAST SETTINGS correlated_subqueries_default_join_kind = 'left', correlated_subqueries_use_in_memory_buffer = 0;
+1	[]
+\N	[7]
+SELECT d.c2, (SELECT groupArray(n.x) FROM n_t n WHERE d.c2 IS NULL) FROM d_t d ORDER BY d.c2 NULLS LAST SETTINGS correlated_subqueries_default_join_kind = 'left', correlated_subqueries_use_in_memory_buffer = 0, join_algorithm = 'partial_merge';
+1	[]
+\N	[7]
+SELECT d.c2, (SELECT groupArray(n.x) FROM n_t n WHERE d.c2 IS NULL) FROM d_t d ORDER BY d.c2 NULLS LAST SETTINGS correlated_subqueries_default_join_kind = 'left', correlated_subqueries_use_in_memory_buffer = 0, join_algorithm = 'full_sorting_merge';
+1	[]
+\N	[7]
+-- The substituted equality keeps a plain key; the evaluation over the outer values compares null-safely
+SELECT countIf(explain ILIKE '%Join conditions:%IS NULL%') FROM (EXPLAIN SELECT r.v, EXISTS (SELECT 1 FROM values('a Nullable(Int32)', (NULL), (1)) t WHERE t.a = r.v) FROM values('v Nullable(Int32)', (NULL), (1), (2)) r SETTINGS correlated_subqueries_substitute_equivalent_expressions = 1, explain_query_plan_default = 'pretty', query_plan_join_swap_table = 'false', query_plan_optimize_join_order_randomize = 0, join_algorithm = 'hash', correlated_subqueries_default_join_kind = 'right', correlated_subqueries_use_in_memory_buffer = 1);
+0
+SELECT countIf(explain ILIKE '%Join conditions:%IS NULL%') > 0 FROM (EXPLAIN SELECT r.v, EXISTS (SELECT 1 FROM values('a Nullable(Int32)', (NULL), (1)) t WHERE t.a = r.v) FROM values('v Nullable(Int32)', (NULL), (1), (2)) r SETTINGS correlated_subqueries_substitute_equivalent_expressions = 0, explain_query_plan_default = 'pretty', query_plan_join_swap_table = 'false', query_plan_optimize_join_order_randomize = 0, join_algorithm = 'hash', correlated_subqueries_default_join_kind = 'right', correlated_subqueries_use_in_memory_buffer = 1);
+1
```

**File**: `tests/queries/0_stateless/05567_correlated_subquery_null_outer_value.sql` (added, +53/-0)
```diff
@@ -0,0 +1,53 @@
+-- An outer row whose correlated column is NULL must get the result of the correlated subquery evaluated for NULL
+-- (https://github.com/ClickHouse/ClickHouse/issues/112576).
+
+DROP TABLE IF EXISTS d_t;
+DROP TABLE IF EXISTS n_t;
+DROP TABLE IF EXISTS m_t;
+
+CREATE TABLE d_t (c2 Nullable(Int32)) ENGINE = Memory;
+CREATE TABLE n_t (x Nullable(Int32)) ENGINE = Memory;
+CREATE TABLE m_t (a Nullable(Int32), b Int32) ENGINE = Memory;
+INSERT INTO d_t VALUES (1), (NULL);
+INSERT INTO n_t VALUES (7);
+INSERT INTO m_t VALUES (NULL, 1), (NULL, 0), (1, 1);
+
+-- { echo }
+
+-- Scalar subqueries
+SELECT d.c2, (SELECT count() FROM n_t n WHERE d.c2 IS NOT NULL OR d.c2 IS NULL) FROM d_t d ORDER BY d.c2 NULLS LAST;
+SELECT d.c2, (SELECT sum(n.x) FROM n_t n WHERE d.c2 IS NOT NULL OR d.c2 IS NULL), (SELECT groupArray(n.x) FROM n_t n WHERE d.c2 IS NOT NULL OR d.c2 IS NULL), (SELECT any(n.x) FROM n_t n WHERE d.c2 IS NOT NULL OR d.c2 IS NULL) FROM d_t d ORDER BY d.c2 NULLS LAST;
+SELECT d.c2, (SELECT groupArray(n.x) FROM n_t n WHERE d.c2 IS NULL) FROM d_t d ORDER BY d.c2 NULLS LAST;
+SELECT d.c2, (SELECT n.x FROM n_t n WHERE d.c2 IS NULL) FROM d_t d ORDER BY d.c2 NULLS LAST;
+
+-- EXISTS in the projection
+SELECT r.v, EXISTS (SELECT 1 FROM values('a Nullable(Int32)', (NULL), (1)) t WHERE isNotDistinctFrom(t.a, r.v)) FROM values('v Nullable(Int32)', (NULL), (1), (2)) r ORDER BY r.v NULLS LAST;
+SELECT r.v, EXISTS (SELECT 1 FROM values('a Nullable(Int32)', (NULL), (1)) t WHERE r.v IS NULL) FROM values('v Nullable(Int32)', (NULL), (1), (2)) r ORDER BY r.v NULLS LAST;
+
+-- [NOT] EXISTS in WHERE
+SELECT d.c2 FROM d_t d WHERE EXISTS (SELECT 1 FROM n_t n WHERE d.c2 IS NULL) ORDER BY d.c2 NULLS LAST;
+SELECT d.c2 FROM d_t d WHERE NOT EXISTS (SELECT 1 FROM n_t n WHERE d.c2 IS NULL) ORDER BY d.c2 NULLS LAST;
+
+-- `NULL = NULL` is not true, so the NULL row has no match here
+SELECT r.v, EXISTS (SELECT 1 FROM values('a Nullable(Int32)', (NULL), (1)) t WHERE t.a = r.v) FROM values('v Nullable(Int32)', (NULL), (1), (2)) r ORDER BY r.v NULLS LAST SETTINGS correlated_subqueries_substitute_equivalent_expressions = 1;
+SELECT r.v, EXISTS (SELECT 1 FROM values('a Nullable(Int32)', (NULL), (1)) t WHERE t.a = r.v) FROM values('v Nullable(Int32)', (NULL), (1), (2)) r ORDER BY r.v NULLS LAST SETTINGS correlated_subqueries_substitute_equivalent_expressions = 0;
+
+-- Type wrappers and several correlated columns
+SELECT r.v, (SELECT groupArray(n.x) FROM n_t n WHERE r.v IS NULL) FROM values('v LowCardinality(Nullable(String))', ('a'), (NULL)) r ORDER BY r.v NULLS LAST;
+SELECT r.v, (SELECT groupArray(n.x) FROM n_t n WHERE r.v IS NULL) FROM (SELECT NULL AS v) r;
+SELECT m.a, m.b, (SELECT groupArray(n.x) FROM n_t n WHERE m.a IS NULL AND m.b > 0) FROM m_t m ORDER BY m.a NULLS LAST, m.b;
+
+-- Join layouts and algorithms
+SELECT d.c2, (SELECT groupArray(n.x) FROM n_t n WHERE d.c2 IS NULL) FROM d_t d ORDER BY d.c2 NULLS LAST SETTINGS correlated_subqueries_default_join_kind = 'left', correlated_subqueries_use_in_memory_buffer = 0;
+SELECT d.c2, (SELECT groupArray(n.x) FROM n_t n WHERE d.c2 IS NULL) FROM d_t d ORDER BY d.c2 NULLS LAST SETTINGS correlated_subqueries_default_join_kind = 'left', correlated_subqueries_use_in_memory_buffer = 0, join_algorithm = 'partial_merge';
+SELECT d.c2, (SELECT groupArray(n.x) FROM n_t n WHERE d.c2 IS NULL) FROM d_t d ORDER BY d.c2 NULLS LAST SETTINGS correlated_subqueries_default_join_kind = 'left', correlated_subqueries_use_in_memory_buffer = 0, join_algorithm = 'full_sorting_merge';
+
+-- The substituted equality keeps a plain key; the evaluation over the outer values compares null-safely
+SELECT countIf(explain ILIKE '%Join conditions:%IS NULL%') FROM (EXPLAIN SELECT r.v, EXISTS (SELECT 1 FROM values('a Nullable(Int32)', (NULL), (1)) t WHERE t.a = r.v) FROM values('v Nullable(Int32)', (NULL), (1), (2)) r SETTINGS correlated_subqueries_substitute_equivalent_expressions = 1, explain_query_plan_default = 'pretty', query_plan_join_swap_table = 'false', query_plan_optimize_join_order_randomize = 0, join_algorithm = 'hash', correlated_subqueries_default_join_kind = 'right', correlated_subqueries_use_in_memory_buffer = 1);
+SELECT countIf(explain ILIKE '%Join conditions:%IS NULL%') > 0 FROM (EXPLAIN SELECT r.v, EXISTS (SELECT 1 FROM values('a Nullable(Int32)', (NULL), (1)) t WHERE t.a = r.v) FROM values('v Nullable(Int32)', (NULL), (1), (2)) r SETTINGS correlated_subqueries_substitute_equivalent_expressions = 0, explain_query_plan_default = 'pretty', query_plan_join_swap_table = 'false', query_plan_optimize_join_order_randomize = 0, join_algorithm = 'hash', correlated_subqueries_default_join_kind = 'right', correlated_subqueries_use_in_memory_buffer = 1);
+
+-- { echoOff }
+
+DROP TABLE d_t;
+DROP TABLE n_t;
+DROP TABLE m_t;
```

---

### Incident Patch 3: `6ba1cd98` (2026-11-08)
**Commit Message**: Merge pull request #130108 from groeneai/iceberg-equality-delete-null-key

Fix Iceberg equality deletes dropping rows whose equality key is NULL

**File**: `src/Storages/ObjectStorage/DataLakes/Iceberg/IcebergMetadata.cpp` (modified, +3/-2)
```diff
@@ -2152,8 +2152,9 @@ void IcebergMetadata::addDeleteTransformers(
                 = std::make_unique<FunctionToOverloadResolverAdaptor>(std::make_shared<FunctionTuple>());
             const ActionsDAG::Node * in_lhs_arg
                 = left_columns.size() == 1 ? left_columns.front() : &dag.addFunction(func_tuple_builder, std::move(left_columns), {});
-            /// we got the NOT IN function
-            auto func_not_in = FunctionFactory::instance().get("notIn", nullptr);
+            /// Iceberg compares equality-delete keys null-safely: a NULL key matches only a NULL delete value.
+            /// The set above keeps NULLs (transform_null_in), and `notNullIn` looks NULL keys up in it.
+            auto func_not_in = FunctionFactory::instance().get("notNullIn", nullptr);
             const auto & not_in_node = dag.addFunction(func_not_in, {in_lhs_arg, in_rhs_arg}, "notInResult");
             dag.getOutputs().push_back(&not_in_node);
             LOG_DEBUG(log, "Use expression {} in equality deletes", dag.dumpDAG());
```

**File**: `tests/queries/0_stateless/05570_iceberg_equality_delete_null_key.reference` (added, +8/-0)
```diff
@@ -0,0 +1,8 @@
+\N	toy	Ghost	t
+3	\N	Grizzly	t
+1	marsupial	Koala	t
+4	bear	Kodiak	t
+\N	\N	Phantom	t
+5
+Ghost
+Phantom
```

**File**: `tests/queries/0_stateless/05570_iceberg_equality_delete_null_key.sh` (added, +23/-0)
```diff
@@ -0,0 +1,23 @@
+#!/usr/bin/env bash
+# Tags: no-fasttest, no-replicated-database
+# Tag no-replicated-database: IcebergLocal is non-replicated.
+
+# Iceberg equality deletes compare keys null-safely: "A null value in a delete column matches a row
+# if the row's value is null, equivalent to col IS NULL". Rows with a NULL key must survive a delete
+# file without NULLs, and a NULL in a delete file must delete only NULL keys.
+# The fixture is described in data_minio/deletes_db/README.md (`eq_deletes_null_key_table`).
+
+CUR_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
+# shellcheck source=../shell_config.sh
+. "$CUR_DIR"/../shell_config.sh
+
+LAKE_DIR="${CLICKHOUSE_USER_FILES_UNIQUE}/eq_deletes_null_key_table"
+rm -rf "${CLICKHOUSE_USER_FILES_UNIQUE}"
+mkdir -p "${CLICKHOUSE_USER_FILES_UNIQUE}"
+cp -r "${CUR_DIR}/data_minio/deletes_db/eq_deletes_null_key_table" "${LAKE_DIR}"
+
+${CLICKHOUSE_CLIENT} --query "SELECT id, category, name, tag FROM icebergLocal('${LAKE_DIR}/') ORDER BY name"
+${CLICKHOUSE_CLIENT} --query "SELECT count() FROM icebergLocal('${LAKE_DIR}/')"
+${CLICKHOUSE_CLIENT} --query "SELECT name FROM icebergLocal('${LAKE_DIR}/') WHERE id IS NULL ORDER BY name"
+
+rm -rf "${CLICKHOUSE_USER_FILES_UNIQUE}"
```

**File**: `tests/queries/0_stateless/data_minio/deletes_db/README.md` (modified, +120/-0)
```diff
@@ -285,3 +285,123 @@ spark.stop()
 
 The resulting `/out/warehouse/default/eq_deletes_required_table` directory is copied here
 as is, except for the `.*.crc` files.
+
+## How is `eq_deletes_null_key_table` generated?
+
+The table has four optional columns `id INT, category STRING, name STRING, tag STRING` and one
+Parquet data file:
+
+| id | category | name | tag |
+|---|---|---|---|
+| 1 | marsupial | Koala | t |
+| 2 | toy | Teddy | t |
+| 3 | NULL | Grizzly | t |
+| 4 | NULL | Polar | t |
+| 4 | bear | Kodiak | t |
+| NULL | toy | Ghost | t |
+| NULL | NULL | Phantom | t |
+| 5 | toy | Doomed | NULL |
+
+Three Parquet equality delete files follow, one commit each: on `id` deleting `id = 2` (Teddy), on
+`(id, category)` deleting `(4, NULL)` (Polar only), and on `tag` deleting `tag = NULL` (Doomed). The
+Iceberg Java reader returns Ghost, Grizzly, Koala, Kodiak and Phantom.
+
+Generated with the Iceberg Java API (`iceberg-spark-runtime-4.1_2.13-1.11.0`) through the PySpark JVM
+gateway (Spark SQL cannot write equality deletes):
+
+``` python
+import glob
+import os
+
+from pyspark.sql import SparkSession
+
+WAREHOUSE = "/tmp/iceberg_warehouse"
+TABLE = "eq_deletes_null_key_table"
+
+jar = glob.glob(os.path.expanduser("~/.ivy2.5.2/jars/org.apache.iceberg_iceberg-spark-runtime-4.1_2.13-1.11.0.jar"))[0]
+spark = SparkSession.builder.master("local[1]").config("spark.jars", jar).getOrCreate()
+jvm = spark._jvm
+gateway = spark.sparkContext._gateway
+ice = jvm.org.apache.iceberg
+NestedField = getattr(ice.types, "Types$NestedField")
+IntegerType = getattr(ice.types, "Types$IntegerType")
+StringType = getattr(ice.types, "Types$StringType")
+PARQUET = getattr(ice.FileFormat, "PARQUET")
+
+catalog = ice.hadoop.HadoopCatalog(spark._jsc.hadoopConfiguration(), WAREHOUSE)
+names = gateway.new_array(jvm.String, 2)
+names[0] = "default"
+names[1] = TABLE
+ident = ice.catalog.TableIdentifier.of(names)
+
+fields = jvm.java.util.ArrayList()
+fields.add(NestedField.optional(1, "id", IntegerType.get()))
+fields.add(NestedField.optional(2, "category", StringType.get()))
+fields.add(NestedField.optional(3, "name", StringType.get()))
+fields.add(NestedField.optional(4, "tag", StringType.get()))
+props = jvm.java.util.HashMap()
+props.put("format-version", "2")
+table = catalog.createTable(ident, ice.Schema(fields), ice.PartitionSpec.unpartitioned(), props)
+
+
+def out(name):
+    path = table.locationProvider().newDataLocation(name)
+    return ice.encryption.EncryptedFiles.plainAsEncryptedOutput(table.io().newOutputFile(path))
+
+
+rows = [
+    (1, "marsupial", "Koala", "t"),
+    (2, "toy", "Teddy", "t"),
+    (3, None, "Grizzly", "t"),
+    (4, None, "Polar", "t"),
+    (4, "bear", "Kodiak", "t"),
+    (None, "toy", "Ghost", "t"),
+    (None, None, "Phantom", "t"),
+    (5, "toy", "Doomed", None),
+]
+data_writer = ice.data.GenericAppenderFactory(table.schema(), table.spec()).newDataWriter(out("data-0.parquet"), PARQUET, None)
+for i, c, n, t in rows:
+    record = ice.data.GenericRecord.create(table.schema())
+    record.setField("id", i)
+    record.setField("category", c)
+    record.setField("name", n)
+    record.setField("tag", t)
+    data_writer.write(record)
+data_writer.close()
+table.newAppend().appendFile(data_writer.toDataFile()).commit()
+
+# One RowDelta commit per equality delete file: (equality columns, file name, delete rows).
+deletes = [
+    (["id"], "eq-delete-id.parquet", [{"id": 2}]),
+    (["id", "category"], "eq-delete-id-category.parquet", [{"id": 4, "category": None}]),
+    (["tag"], "eq-delete-tag-null.parquet", [{"tag": None}]),
+]
+for cols, file_name, delete_rows in deletes:
+    table.refresh()
+    col_list = jvm.java.util.ArrayList()
+    for c in cols:
+        col_list.add(c)
+    delete_schema = table.schema().select(col_list)
+    equality_ids = gateway.new_array(jvm.int, len(cols))
+    for k, c in enumerate(cols):
+        equality_ids[k] = table.schema().findField(c).fieldId()
+    factory = ice.data.GenericAppenderFactory(table.schema(), table.spec(), equality_ids, delete_schema, None)
+    writer = factory.newEqDeleteWriter(out(file_name), PARQUET, None)
+    for delete_row in delete_rows:
+        record = ice.data.GenericRecord.create(delete_schema)
+        for k, v in delete_row.items():
+            record.setField(k, v)
+        writer.write(record)
+    writer.close()
+    table.newRowDelta().addDeletes(writer.toDeleteFile()).commit()
+
+# The rows the Iceberg Java reader returns after applying the deletes (the test reference).
+it = ice.data.IcebergGenerics.read(catalog.loadTable(ident)).build().iterator()
+while it.hasNext():
+    r = it.next()
+    print(r.getField("id"), r.getField("category"), r.getField("name"), r.getField("tag"))
+spark.stop()
+```
+
+The resulting `/tmp/iceberg_warehouse/default/eq_deletes_null_key_table` directory is copied here
+as is, except for the `.*.crc` files.
```

**File**: `tests/queries/0_stateless/data_minio/deletes_db/eq_deletes_null_key_table/metadata/v1.metadata.json` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+{"format-version":2,"table-uuid":"c3d08e22-715d-4f33-a48d-2fcc16f0f65b","location":"/tmp/iceberg_warehouse/default/eq_deletes_null_key_table","last-sequence-number":0,"last-updated-ms":1794127071723,"last-column-id":4,"current-schema-id":0,"schemas":[{"type":"struct","schema-id":0,"fields":[{"id":1,"name":"id","required":false,"type":"int"},{"id":2,"name":"category","required":false,"type":"string"},{"id":3,"name":"name","required":false,"type":"string"},{"id":4,"name":"tag","required":false,"type":"string"}]}],"default-spec-id":0,"partition-specs":[{"spec-id":0,"fields":[]}],"last-partition-id":999,"default-sort-order-id":0,"sort-orders":[{"order-id":0,"fields":[]}],"properties":{"write.parquet.compression-codec":"zstd"},"current-snapshot-id":-1,"refs":{},"snapshots":[],"statistics":[],"partition-statistics":[],"snapshot-log":[],"metadata-log":[]}
\ No newline at end of file
```

**File**: `tests/queries/0_stateless/data_minio/deletes_db/eq_deletes_null_key_table/metadata/v2.metadata.json` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+{"format-version":2,"table-uuid":"c3d08e22-715d-4f33-a48d-2fcc16f0f65b","location":"/tmp/iceberg_warehouse/default/eq_deletes_null_key_table","last-sequence-number":1,"last-updated-ms":1794127072483,"last-column-id":4,"current-schema-id":0,"schemas":[{"type":"struct","schema-id":0,"fields":[{"id":1,"name":"id","required":false,"type":"int"},{"id":2,"name":"category","required":false,"type":"string"},{"id":3,"name":"name","required":false,"type":"string"},{"id":4,"name":"tag","required":false,"type":"string"}]}],"default-spec-id":0,"partition-specs":[{"spec-id":0,"fields":[]}],"last-partition-id":999,"default-sort-order-id":0,"sort-orders":[{"order-id":0,"fields":[]}],"properties":{"write.parquet.compression-codec":"zstd"},"current-snapshot-id":5223466979151337498,"refs":{"main":{"snapshot-id":5223466979151337498,"type":"branch"}},"snapshots":[{"sequence-number":1,"snapshot-id":5223466979151337498,"timestamp-ms":1794127072475,"summary":{"operation":"append","manifests-created":"1","manifests-kept":"0","manifests-replaced":"0","added-data-files":"1","added-records":"8","added-files-size":"1332","changed-partition-count":"1","total-records":"8","total-files-size":"1332","total-data-files":"1","total-delete-files":"0","total-position-deletes":"0","total-equality-deletes":"0","iceberg-version":"Apache Iceberg 1.11.0 (commit 6976e020b894f6a6777704df2b8c4458cb291ae9)"},"manifest-list":"/tmp/iceberg_warehouse/default/eq_deletes_null_key_table/metadata/snap-5223466979151337498-1-b479b8a3-a3a2-48cf-8f6c-f1186a88fecf.avro","schema-id":0}],"statistics":[],"partition-statistics":[],"snapshot-log":[{"timestamp-ms":1794127072475,"snapshot-id":5223466979151337498}],"metadata-log":[{"timestamp-ms":1794127071723,"metadata-file":"/tmp/iceberg_warehouse/default/eq_deletes_null_key_table/metadata/v1.metadata.json"}]}
\ No newline at end of file
```

**File**: `tests/queries/0_stateless/data_minio/deletes_db/eq_deletes_null_key_table/metadata/v3.metadata.json` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+{"format-version":2,"table-uuid":"c3d08e22-715d-4f33-a48d-2fcc16f0f65b","location":"/tmp/iceberg_warehouse/default/eq_deletes_null_key_table","last-sequence-number":2,"last-updated-ms":1794127072659,"last-column-id":4,"current-schema-id":0,"schemas":[{"type":"struct","schema-id":0,"fields":[{"id":1,"name":"id","required":false,"type":"int"},{"id":2,"name":"category","required":false,"type":"string"},{"id":3,"name":"name","required":false,"type":"string"},{"id":4,"name":"tag","required":false,"type":"string"}]}],"default-spec-id":0,"partition-specs":[{"spec-id":0,"fields":[]}],"last-partition-id":999,"default-sort-order-id":0,"sort-orders":[{"order-id":0,"fields":[]}],"properties":{"write.parquet.compression-codec":"zstd"},"current-snapshot-id":4441976820507217000,"refs":{"main":{"snapshot-id":4441976820507217000,"type":"branch"}},"snapshots":[{"sequence-number":1,"snapshot-id":5223466979151337498,"timestamp-ms":1794127072475,"summary":{"operation":"append","manifests-created":"1","manifests-kept":"0","manifests-replaced":"0","added-data-files":"1","added-records":"8","added-files-size":"1332","changed-partition-count":"1","total-records":"8","total-files-size":"1332","total-data-files":"1","total-delete-files":"0","total-position-deletes":"0","total-equality-deletes":"0","iceberg-version":"Apache Iceberg 1.11.0 (commit 6976e020b894f6a6777704df2b8c4458cb291ae9)"},"manifest-list":"/tmp/iceberg_warehouse/default/eq_deletes_null_key_table/metadata/snap-5223466979151337498-1-b479b8a3-a3a2-48cf-8f6c-f1186a88fecf.avro","schema-id":0},{"sequence-number":2,"snapshot-id":4441976820507217000,"parent-snapshot-id":5223466979151337498,"timestamp-ms":1794127072659,"summary":{"operation":"delete","manifests-created":"1","manifests-kept":"1","manifests-replaced":"0","added-equality-delete-files":"1","added-delete-files":"1","added-files-size":"455","added-equality-deletes":"1","changed-partition-count":"1","total-records":"8","total-files-size":"1787","total-data-files":"1","total-delete-files":"1","total-position-deletes":"0","total-equality-deletes":"1","iceberg-version":"Apache Iceberg 1.11.0 (commit 6976e020b894f6a6777704df2b8c4458cb291ae9)"},"manifest-list":"/tmp/iceberg_warehouse/default/eq_deletes_null_key_table/metadata/snap-4441976820507217000-1-3210d438-3e3c-45ad-87bc-9227e3b42b3e.avro","schema-id":0}],"statistics":[],"partition-statistics":[],"snapshot-log":[{"timestamp-ms":1794127072475,"snapshot-id":5223466979151337498},{"timestamp-ms":1794127072659,"snapshot-id":4441976820507217000}],"metadata-log":[{"timestamp-ms":1794127071723,"metadata-file":"/tmp/iceberg_warehouse/default/eq_deletes_null_key_table/metadata/v1.metadata.json"},{"timestamp-ms":1794127072483,"metadata-file":"/tmp/iceberg_warehouse/default/eq_deletes_null_key_table/metadata/v2.metadata.json"}]}
\ No newline at end of file
```

**File**: `tests/queries/0_stateless/data_minio/deletes_db/eq_deletes_null_key_table/metadata/v4.metadata.json` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+{"format-version":2,"table-uuid":"c3d08e22-715d-4f33-a48d-2fcc16f0f65b","location":"/tmp/iceberg_warehouse/default/eq_deletes_null_key_table","last-sequence-number":3,"last-updated-ms":1794127072797,"last-column-id":4,"current-schema-id":0,"schemas":[{"type":"struct","schema-id":0,"fields":[{"id":1,"name":"id","required":false,"type":"int"},{"id":2,"name":"category","required":false,"type":"string"},{"id":3,"name":"name","required":false,"type":"string"},{"id":4,"name":"tag","required":false,"type":"string"}]}],"default-spec-id":0,"partition-specs":[{"spec-id":0,"fields":[]}],"last-partition-id":999,"default-sort-order-id":0,"sort-orders":[{"order-id":0,"fields":[]}],"properties":{"write.parquet.compression-codec":"zstd"},"current-snapshot-id":7381694820472045609,"refs":{"main":{"snapshot-id":7381694820472045609,"type":"branch"}},"snapshots":[{"sequence-number":1,"snapshot-id":5223466979151337498,"timestamp-ms":1794127072475,"summary":{"operation":"append","manifests-created":"1","manifests-kept":"0","manifests-replaced":"0","added-data-files":"1","added-records":"8","added-files-size":"1332","changed-partition-count":"1","total-records":"8","total-files-size":"1332","total-data-files":"1","total-delete-files":"0","total-position-deletes":"0","total-equality-deletes":"0","iceberg-version":"Apache Iceberg 1.11.0 (commit 6976e020b894f6a6777704df2b8c4458cb291ae9)"},"manifest-list":"/tmp/iceberg_warehouse/default/eq_deletes_null_key_table/metadata/snap-5223466979151337498-1-b479b8a3-a3a2-48cf-8f6c-f1186a88fecf.avro","schema-id":0},{"sequence-number":2,"snapshot-id":4441976820507217000,"parent-snapshot-id":5223466979151337498,"timestamp-ms":1794127072659,"summary":{"operation":"delete","manifests-created":"1","manifests-kept":"1","manifests-replaced":"0","added-equality-delete-files":"1","added-delete-files":"1","added-files-size":"455","added-equality-deletes":"1","changed-partition-count":"1","total-records":"8","total-files-size":"1787","total-data-files":"1","total-delete-files":"1","total-position-deletes":"0","total-equality-deletes":"1","iceberg-version":"Apache Iceberg 1.11.0 (commit 6976e020b894f6a6777704df2b8c4458cb291ae9)"},"manifest-list":"/tmp/iceberg_warehouse/default/eq_deletes_null_key_table/metadata/snap-4441976820507217000-1-3210d438-3e3c-45ad-87bc-9227e3b42b3e.avro","schema-id":0},{"sequence-number":3,"snapshot-id":7381694820472045609,"parent-snapshot-id":4441976820507217000,"timestamp-ms":1794127072797,"summary":{"operation":"delete","manifests-created":"1","manifests-kept":"2","manifests-replaced":"0","added-equality-delete-files":"1","added-delete-files":"1","added-files-size":"684","added-equality-deletes":"1","changed-partition-count":"1","total-records":"8","total-files-size":"2471","total-data-files":"1","total-delete-files":"2","total-position-deletes":"0","total-equality-deletes":"2","iceberg-version":"Apache Iceberg 1.11.0 (commit 6976e020b894f6a6777704df2b8c4458cb291ae9)"},"manifest-list":"/tmp/iceberg_warehouse/default/eq_deletes_null_key_table/metadata/snap-7381694820472045609-1-d7235c14-eef5-4fa4-a20c-7ba335a0967d.avro","schema-id":0}],"statistics":[],"partition-statistics":[],"snapshot-log":[{"timestamp-ms":1794127072475,"snapshot-id":5223466979151337498},{"timestamp-ms":1794127072659,"snapshot-id":4441976820507217000},{"timestamp-ms":1794127072797,"snapshot-id":7381694820472045609}],"metadata-log":[{"timestamp-ms":1794127071723,"metadata-file":"/tmp/iceberg_warehouse/default/eq_deletes_null_key_table/metadata/v1.metadata.json"},{"timestamp-ms":1794127072483,"metadata-file":"/tmp/iceberg_warehouse/default/eq_deletes_null_key_table/metadata/v2.metadata.json"},{"timestamp-ms":1794127072659,"metadata-file":"/tmp/iceberg_warehouse/default/eq_deletes_null_key_table/metadata/v3.metadata.json"}]}
\ No newline at end of file
```

#### Recent Merged Pull Requests:
- **PR #130204** (2026-11-08): Backport #125901 to 26.8: Start executor threads for CPU slots granted after the request (@robot-clickhouse-ci-2)
- **PR #130190** (2026-11-08): Backport #127478 to 26.9: Bump jemalloc for the fiber-safe TLS rework (upstream solution) (@azat)
- **PR #130188** (2026-11-08): Backport #127478 to 26.8: Bump jemalloc for the fiber-safe TLS rework (upstream solution) (@azat)
- **PR #130187** (2026-11-08): Backport #127478 to 26.10: Bump jemalloc for the fiber-safe TLS rework (upstream solution) (@azat)
- **PR #130181** (2026-11-08): Upgrade check: download previous-release packages from packages.clickhouse.com when GitHub cannot serve them (@groeneai)
- **PR #130175** (2026-11-08): Fix flaky `test_load_balancing_default` (@alexey-milovidov)

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

## X. Merge pull request #112650 from ClickHouse/fix-with-fill-bounds-out-of-column-ty

**RULE**:
When implementing operations in `src/Core/SortDescription.h`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in ClickHouse/ClickHouse. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `1aaec54f`: Merge pull request #112650 from ClickHouse/fix-with-fill-bounds-out-of-column-type-range. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing C++ data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/Core/SortDescription.h`.

**VERIFIED IMPLEMENTATION PATTERN**:
```c++
// Verified production-grade fix pattern:
    DataTypePtr fill_column_type;
    /// The inclusive range of the values a fill column of `fill_column_type` can hold - the range of the storage
    /// type intersected with the calendar window for `Date32`/`DateTime64` - precomputed once so that the per-row
    /// representability check is two comparisons. Null bounds mean the type is not checked (see
    /// `fillRepresentableRangeOfColumnType`).
    Field fill_representable_min;
    Field fill_representable_max;
```

**NEGATIVE CONSTRAINT**:
```c++
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `1aaec54f` are properly handled with clean fallback behavior.

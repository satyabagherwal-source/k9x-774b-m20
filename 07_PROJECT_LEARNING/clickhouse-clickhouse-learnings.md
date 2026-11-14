> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/clickhouse-clickhouse-learnings.md`  
> **Source**: github ([https://github.com/ClickHouse/ClickHouse](https://github.com/ClickHouse/ClickHouse))  
> **Source Version**: `e6256de9`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-14T22:11:32.132Z  
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
> **Harvest Timestamp**: 2026-11-14T22:11:31.992Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `ClickHouse/ClickHouse`
- **Description**: ClickHouse® is a real-time analytics database management system
- **Primary Language / Ecosystem**: C++
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 50928 stars

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
- **Issue #131292** (2026-11-13): **DataLakeCatalog OneLake: tables with `abfs://` locations fail with `Unsupported storage type: abfs://`**
  *Symptoms*: **Describe what's wrong**  Reading tables of a `DataLakeCatalog` database with `catalog_type = 'onelake'` fails when the catalog reports the table location with the `abfs://` scheme:  ``` Code: 48. DB::Exception: Unsupported storage type: abfs://. (NOT_IMPLEMENTED) 5. src/Databases/DataLake/ICatalog.cpp: DataLake::parseStorageTypeFromString(String const&) 6. src/Databases/DataLake/DatabaseDataLake.cpp: DB::DatabaseDataLake::buildTableEngineArgs(...) 7. src/Databases/DataLake/DatabaseDataLake.cpp: DB::DatabaseDataLake::tryGetTableImpl(...) 8. src/Databases/DataLake/DatabaseDataLake.cpp: DB::DatabaseDataLake::tryGetTable(...) ```  Since 2026-11-13 (between 02:18 and 06:54 UTC) the OneLake Iceberg REST catalog (`https://onelake.table.fabric.microsoft.com/iceberg`) returns `abfs://` locations for Delta tables that Fabric exposes as Iceberg, for example:  ``` "location": "abfs://<workspace>@onelake.dfs.fabric.microsoft.com/<lakehouse>/Tables/dbo/<table>" "metadata-location": "abfs://<workspace>@onelake.dfs.fabric.microsoft.com/<lakehouse>/Tables/dbo/<table>/metadata/v3.metadata.json" ```  Before, the same tables had `abfss://` locations, and they read fine. `tryParseStorageTypeFromString` (`src/Databases/DataLake/ICatalog.cpp`) maps only `abfss` (Azure Blob File System Secure) to `Azure`; `abfs` is the same Azure Data Lake Storage Gen2 scheme without the TLS requirement in the Hadoop ABFS driver, and nothing in `src` accepts it. Every such table in a OneLake database is now unread

- **Issue #131194** (2026-11-13): **Negative values of `Seconds` settings bypass settings constraints**
  *Symptoms*: **Describe the bug**  A setting of type `Seconds` (e.g. `max_execution_time`) accepts a negative value, and a `MAX` settings constraint does not stop it. A negative timeout then means "no limit", so a user restricted by a constraint can run past the limit set by the administrator.  There is also a float→integer overflow in the seconds→microseconds conversion: a value just below `2^63` microseconds passes the range check and is stored as a large negative value, which bypasses the constraint the same way.  **How to reproduce**  Verified on master (26.11, release build). Profile with `max_execution_time = 5` and a constraint `<max_execution_time><max>60</max></max_execution_time>` (or the equivalent `CREATE SETTINGS PROFILE ... SETTINGS max_execution_time = 5 MAX 60`):  ```sql SET max_execution_time = 100;                 -- Code: 452 SETTING_CONSTRAINT_VIOLATION, as expected SET max_execution_time = -1;                  -- accepted SET max_execution_time = 9223372036854.775;   -- accepted, getSetting('max_execution_time') = -9223372036854.775 ```  A query that takes ~8 s is killed at 5 s without the `SET`, but completes after either of the two accepted `SET`s.  **Root cause**  - `float64AsSecondsToTimespan` in `src/Core/SettingsFields.cpp` does not reject negative values. - Its overflow check `d * 1000000 > std::numeric_limits<Int64>::max()` compares with `Int64::max()` converted to `Float64`, i.e. `2^63`, so a product equal to `2^63` passes and `static_cast<Int64>` overflows (

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

### Incident Patch 1: `4eb5bd00` (2026-11-14)
**Commit Message**: Merge pull request #125616 from groeneai/fix-pr-insert-select-local-pipeline-select-settings

Fix a crash in parallel replicas INSERT SELECT when the SELECT's own SETTINGS rule out the local plan

**File**: `src/Interpreters/ClusterProxy/executeQuery.cpp` (modified, +5/-1)
```diff
@@ -1595,7 +1595,7 @@ bool isSuitableForInsertSelectWithParallelReplicas(const ASTPtr & select, const
 /// find and remove ReadFromParallelRemoteReplicasStep in query plan,
 /// also returns the parallel replicas coordinator, connection pools and local replica index
 /// stored in ReadFromParallelRemoteReplicasStep, so the remote-pool pass can reuse them.
-LocalPlanParallelReplicasInfo dropReadFromRemoteInPlan(QueryPlan & query_plan)
+std::optional<LocalPlanParallelReplicasInfo> dropReadFromRemoteInPlan(QueryPlan & query_plan)
 {
     struct Frame
     {
@@ -1618,6 +1618,10 @@ LocalPlanParallelReplicasInfo dropReadFromRemoteInPlan(QueryPlan & query_plan)
             const auto * step = frame.node->step.get();
             if (const auto * read_from_remote = typeid_cast<const ReadFromParallelRemoteReplicasStep *>(step))
             {
+                /// Without a local replica this step is the plan's only reading step.
+                if (!read_from_remote->getExcludePoolIndex())
+                    return {};
+
                 auto & children = frame.parent->children;
                 for (auto it = begin(children); it != end(children); ++it)
                 {
```

**File**: `src/Interpreters/ClusterProxy/executeQuery.h` (modified, +2/-1)
```diff
@@ -171,7 +171,8 @@ struct LocalPlanParallelReplicasInfo
 /// Predicate gating the local-plan branch of `executeQueryWithParallelReplicas`. Also evaluated
 /// on followers in `ReadFromMergeTree` so they take the same topology decision as the initiator.
 bool canUseLocalPlanForParallelReplicas(const ContextPtr & context);
-LocalPlanParallelReplicasInfo dropReadFromRemoteInPlan(QueryPlan & query_plan);
+/// Returns nothing and leaves the plan intact unless the plan has both a local part and a remote reading step.
+std::optional<LocalPlanParallelReplicasInfo> dropReadFromRemoteInPlan(QueryPlan & query_plan);
 
 /// Execute a distributed query, creating a query plan, from which the query pipeline can be built.
 /// `stream_factory` object encapsulates the logic of creating plans for a different type of query
```

**File**: `src/Interpreters/InterpreterInsertQuery.cpp` (modified, +20/-8)
```diff
@@ -368,7 +368,8 @@ bool InterpreterInsertQuery::shouldAddSquashingForStorage(const StoragePtr & tab
     return !(settings[Setting::distributed_foreground_insert] && table->isRemote());
 }
 
-static std::pair<QueryPipelineBuilder, ClusterProxy::LocalPlanParallelReplicasInfo> getLocalSelectPipelineForInserSelectWithParallelReplicas(const ASTPtr & select, const ContextPtr & context)
+static std::optional<std::pair<QueryPipelineBuilder, ClusterProxy::LocalPlanParallelReplicasInfo>>
+getLocalSelectPipelineForInserSelectWithParallelReplicas(const ASTPtr & select, const ContextPtr & context)
 {
     auto select_query_options = SelectQueryOptions(QueryProcessingStage::Complete, /*subquery_depth_=*/1);
 
@@ -382,7 +383,10 @@ static std::pair<QueryPipelineBuilder, ClusterProxy::LocalPlanParallelReplicasIn
     /// The connection pools and local replica index decided here are returned too, so the remote pass
     /// reuses the exact same replica set rather than recomputing liveness from a fresh snapshot.
     auto parallel_replicas_info = ClusterProxy::dropReadFromRemoteInPlan(plan);
-    return {interpreter.buildQueryPipeline(), std::move(parallel_replicas_info)};
+    if (!parallel_replicas_info)
+        return {};
+
+    return std::make_pair(interpreter.buildQueryPipeline(), std::move(*parallel_replicas_info));
 }
 
 
@@ -799,18 +803,22 @@ QueryPipeline InterpreterInsertQuery::buildInsertSelectPipeline(
 }
 
 
-std::pair<QueryPipeline, ClusterProxy::LocalPlanParallelReplicasInfo> InterpreterInsertQuery::buildLocalInsertSelectPipelineForParallelReplicas(
+std::optional<std::pair<QueryPipeline, ClusterProxy::LocalPlanParallelReplicasInfo>>
+InterpreterInsertQuery::buildLocalInsertSelectPipelineForParallelReplicas(
     ASTInsertQuery & query, const StoragePtr & table, ContextPtr select_context)
 {
     applyTrivialInsertSelectOptimization(query, table->prefersLargeBlocks(), max_insert_threads, select_context);
 
-    auto [pipeline_builder, parallel_replicas_info]
-        = getLocalSelectPipelineForInserSelectWithParallelReplicas(query.select, select_context);
+    auto local_select = getLocalSelectPipelineForInserSelectWithParallelReplicas(query.select, select_context);
+    if (!local_select)
+        return {};
+
+    auto & [pipeline_builder, parallel_replicas_info] = *local_select;
     /// Parallel replicas builds its own local pipeline and never routes through the async insert queue,
     /// so it hands over no lock and the caller keeps it for the whole pipeline.
     auto local_pipeline = addInsertToSelectPipeline(
         query, table, pipeline_builder, /* add_async_insert_queue_transform */ false, /* destination_lock */ nullptr);
-    return {std::move(local_pipeline), std::move(parallel_replicas_info)};
+    return std::make_pair(std::move(local_pipeline), std::move(parallel_replicas_info));
 }
 
 
@@ -918,9 +926,9 @@ std::optional<QueryPipeline> InterpreterInsertQuery::buildInsertSelectPipelinePa
                 "initiator's: the local pipeline shares the initiator's query status and cannot use the leaf "
                 "timeout separately");
         }
-        else
+        else if (auto local = buildLocalInsertSelectPipelineForParallelReplicas(query, table, context))
         {
-            auto [local_pipeline, parallel_replicas_info] = buildLocalInsertSelectPipelineForParallelReplicas(query, table, context);
+            auto & [local_pipeline, parallel_replicas_info] = *local;
             auto coordinator = parallel_replicas_info.coordinator;
             auto local_replica_index = parallel_replicas_info.local_replica_index;
             return ClusterProxy::executeInsertSelectWithParallelReplicas(
@@ -931,6 +939,10 @@ std::optional<QueryPipeline> InterpreterInsertQuery::buildInsertSelectPipelinePa
                 std::move(parallel_replicas_info.connection_pools),
                 local_replica_index);
         }
+        else
+        {
+            LOG_TRACE(logger, "Not using the local insert select pipeline because the SELECT plan has no local part");
+        }
     }
 
     return ClusterProxy::executeInsertSelectWithParallelReplicas(query, context);
```

**File**: `src/Interpreters/InterpreterInsertQuery.h` (modified, +1/-1)
```diff
@@ -143,7 +143,7 @@ class InterpreterInsertQuery : public IInterpreter, WithMutableContext
     QueryPipeline buildInsertPipeline(ASTInsertQuery & query, StoragePtr table);
 
     std::optional<QueryPipeline> buildInsertSelectPipelineParallelReplicas(ASTInsertQuery & query, StoragePtr table);
-    std::pair<QueryPipeline, ClusterProxy::LocalPlanParallelReplicasInfo>
+    std::optional<std::pair<QueryPipeline, ClusterProxy::LocalPlanParallelReplicasInfo>>
     buildLocalInsertSelectPipelineForParallelReplicas(ASTInsertQuery & query, const StoragePtr & table, ContextPtr select_context);
 
     // if applicable, build pipeline for replicated MergeTree from cluster storage
```

**File**: `tests/queries/0_stateless/05394_parallel_replicas_insert_select_select_level_settings.reference` (added, +12/-0)
```diff
@@ -0,0 +1,12 @@
+-- parallel_replicas_local_plan = 0 in the SELECT
+100000
+-- parallel_replicas_prefer_local_replica = 0 in the SELECT
+100000
+-- max_execution_time_leaf = 0 in the INSERT, 100 in the SELECT
+100000
+-- agreeing settings use the local pipeline
+100000
+05394_control	3
+05394_leaf_timeout	4
+05394_local_plan	4
+05394_prefer_local	4
```

**File**: `tests/queries/0_stateless/05394_parallel_replicas_insert_select_select_level_settings.sql` (added, +52/-0)
```diff
@@ -0,0 +1,52 @@
+-- The SELECT's own SETTINGS can rule out the local plan that the INSERT-level settings allow (issue #122729).
+SET enable_analyzer = 1; -- parallel distributed insert select for replicated tables works only with analyzer
+SET parallel_distributed_insert_select = 2;
+
+DROP TABLE IF EXISTS t_mt_source;
+DROP TABLE IF EXISTS t_rmt_target SYNC;
+
+CREATE TABLE t_mt_source (k UInt64, v String) ENGINE = MergeTree() ORDER BY k;
+CREATE TABLE t_rmt_target (k UInt64, v String) ENGINE = ReplicatedMergeTree('/clickhouse/tables/{database}/t_rmt_target', 'r1') ORDER BY ();
+
+INSERT INTO t_mt_source SELECT number AS k, toString(number) AS v FROM system.numbers LIMIT 1e5;
+
+SET enable_parallel_replicas = 1, cluster_for_parallel_replicas = 'test_cluster_one_shard_three_replicas_localhost', max_parallel_replicas = 3;
+SET parallel_replicas_for_non_replicated_merge_tree = 1;
+
+SELECT '-- parallel_replicas_local_plan = 0 in the SELECT';
+TRUNCATE TABLE t_rmt_target;
+INSERT INTO t_rmt_target SETTINGS parallel_replicas_local_plan = 1, log_comment = '05394_local_plan'
+SELECT * FROM t_mt_source SETTINGS parallel_replicas_local_plan = 0;
+SELECT count() FROM t_rmt_target;
+SELECT * FROM t_rmt_target EXCEPT SELECT * FROM t_mt_source;
+
+SELECT '-- parallel_replicas_prefer_local_replica = 0 in the SELECT';
+TRUNCATE TABLE t_rmt_target;
+INSERT INTO t_rmt_target SETTINGS parallel_replicas_local_plan = 1, parallel_replicas_prefer_local_replica = 1, log_comment = '05394_prefer_local'
+SELECT * FROM t_mt_source SETTINGS parallel_replicas_prefer_local_replica = 0;
+SELECT count() FROM t_rmt_target;
+SELECT * FROM t_rmt_target EXCEPT SELECT * FROM t_mt_source;
+
+SELECT '-- max_execution_time_leaf = 0 in the INSERT, 100 in the SELECT';
+TRUNCATE TABLE t_rmt_target;
+INSERT INTO t_rmt_target SETTINGS parallel_replicas_local_plan = 1, max_execution_time = 300, max_execution_time_leaf = 0, log_comment = '05394_leaf_timeout'
+SELECT * FROM t_mt_source SETTINGS max_execution_time_leaf = 100;
+SELECT count() FROM t_rmt_target;
+SELECT * FROM t_rmt_target EXCEPT SELECT * FROM t_mt_source;
+
+SELECT '-- agreeing settings use the local pipeline';
+TRUNCATE TABLE t_rmt_target;
+INSERT INTO t_rmt_target SETTINGS parallel_replicas_local_plan = 1, log_comment = '05394_control'
+SELECT * FROM t_mt_source;
+SELECT count() FROM t_rmt_target;
+SELECT * FROM t_rmt_target EXCEPT SELECT * FROM t_mt_source;
+
+-- Executed INSERTs: the initiator plus one per remote replica, so 4 without the local pipeline and 3 with it.
+SYSTEM FLUSH LOGS query_log;
+SELECT log_comment, count() FROM system.query_log
+WHERE (current_database = currentDatabase() OR has(databases, currentDatabase())) AND type = 'QueryFinish' AND query_kind = 'Insert'
+    AND log_comment IN ('05394_local_plan', '05394_prefer_local', '05394_leaf_timeout', '05394_control') AND event_date >= yesterday() AND event_time >= now() - 600
+GROUP BY log_comment ORDER BY log_comment;
+
+DROP TABLE t_mt_source;
+DROP TABLE t_rmt_target SYNC;
```

---

### Incident Patch 2: `daec22af` (2026-11-14)
**Commit Message**: Merge pull request #131278 from raphplt/docs-add-qoredb-gui

Docs: add QoreDB to third-party visual interfaces

**File**: `docs/integrations/connectors/tools/gui.mdx` (modified, +15/-0)
```diff
@@ -595,6 +595,21 @@ Features:
 
 </Accordion>
 
+<Accordion title="QoreDB">
+
+[QoreDB](https://github.com/QoreDB/QoreDB) is an open-core desktop database client built with Rust and Tauri, with native ClickHouse support.
+
+Features:
+
+- Connects over the HTTP (8123) and HTTPS (8443) interfaces.
+- SQL editor with syntax highlighting, autocompletion and a virtualized result grid.
+- Classifies statements before execution and asks for confirmation before destructive queries on production connections.
+- Cancels running queries with `KILL QUERY`.
+- Read-only mode per connection.
+- Runs on macOS, Windows and Linux. The core is licensed under Apache 2.0.
+
+</Accordion>
+
 ## Commercial {#commercial}
 
 <Accordion title="ADQM Notebook">
```

---

### Incident Patch 3: `89b0921b` (2026-11-14)
**Commit Message**: Merge pull request #131238 from groeneai/fix-131164-namespace-location-not-a-uri

Treat a namespace location that is not a URI as no location in `DataLakeCatalog` `CREATE TABLE`

**File**: `src/Databases/DataLake/DatabaseDataLake.cpp` (modified, +7/-0)
```diff
@@ -1009,6 +1009,13 @@ std::optional<DataLake::TableMetadata> DatabaseDataLake::tryGetNewTableMetadata(
     if (!location)
         return std::nullopt;
 
+    /// A catalog can report a placeholder instead of a location, e.g. Databricks reports `not_used` for a schema of managed tables.
+    if (!location->contains("://"))
+    {
+        LOG_DEBUG(log, "Ignoring location {} reported by the catalog for new table {}: it is not a URI", *location, name);
+        return std::nullopt;
+    }
+
     LOG_DEBUG(log, "Location assigned by the catalog for new table {}: {}", name, *location);
 
     auto table_metadata = DataLake::TableMetadata().withLocation();
```

**File**: `tests/integration/test_database_iceberg/test.py` (modified, +39/-0)
```diff
@@ -1545,6 +1545,45 @@ def test_create_without_engine_arguments(started_cluster, engine_clause):
     assert node.query(f"SELECT * FROM {CATALOG_NAME}.`{root_namespace}.{table_name}`") == "AAPL\n"
 
 
+def test_create_without_engine_arguments_namespace_location_not_a_uri(started_cluster):
+    # Databricks reports `not_used` as the location of a schema with managed tables.
+    node = started_cluster.instances["node1"]
+
+    test_ref = f"test_create_namespace_location_not_a_uri_{uuid.uuid4()}"
+    table_name = f"{test_ref}_table"
+    root_namespace = f"{test_ref}_namespace"
+    table_ref = f"{CATALOG_NAME}.`{root_namespace}.{table_name}`"
+
+    catalog = load_catalog_impl(started_cluster)
+    catalog.create_namespace(root_namespace, properties={"location": "not_used"})
+    assert catalog.load_namespace_properties(root_namespace)["location"] == "not_used"
+
+    create_clickhouse_iceberg_database(
+        started_cluster, node, CATALOG_NAME, additional_settings={"storage_endpoint": "http://minio1:9001"}
+    )
+
+    # Without a table engine nothing tells the storage type.
+    error = node.query_and_get_error(
+        f"CREATE TABLE {CATALOG_NAME}.`{root_namespace}.{table_name}_default` (x String)",
+        settings={"allow_experimental_database_iceberg": 1},
+    )
+    assert "cannot tell where table" in error, error
+
+    node.query(
+        f"CREATE TABLE {table_ref} (x String) ENGINE = IcebergS3",
+        settings={"allow_experimental_database_iceberg": 1, "write_full_path_in_iceberg_metadata": 1},
+    )
+    node.query(
+        f"INSERT INTO {table_ref} VALUES ('AAPL')",
+        settings={"allow_insert_into_iceberg": 1, "write_full_path_in_iceberg_metadata": 1},
+    )
+    assert node.query(f"SELECT * FROM {table_ref}") == "AAPL\n"
+
+    # The catalog chose the location.
+    metadata_location = catalog.load_table(f"{root_namespace}.{table_name}").metadata_location
+    assert f"/{root_namespace}/{table_name}/metadata/" in metadata_location, metadata_location
+
+
 @pytest.mark.parametrize("namespace_exists", [False, True])
 def test_create_without_engine_arguments_storage_mismatch(started_cluster, namespace_exists):
     node = started_cluster.instances["node1"]
```

#### Recent Merged Pull Requests:
- **PR #131682** (closed): Use flat hash maps for per-block and per-granule name lookups (@nickitat)
- **PR #131666** (2026-11-14): Do not run 02810 with parallel replicas (@devcrafter)
- **PR #131658** (2026-11-14): Backport #128005 to 26.10: Cast a column received from a shard only once when a distributed query selects it twice (@robot-ch-test-poll)
- **PR #131657** (2026-11-14): Backport #129012 to 26.10: Fix `replaceRegexpAll` rewrite when pattern starts with `^(?)?` (@robot-ch-test-poll)
- **PR #131656** (2026-11-14): Backport #129146 to 26.10: Fix `NOT_FOUND_COLUMN_IN_BLOCK` in `optimize_injective_functions_in_limit_by` when the `LIMIT BY` key carries an alias (@robot-ch-test-poll)
- **PR #131650** (2026-11-14): Backport #130814 to 26.9: Fix `bloom_filter` index mistaking a column named `mapKeys(m)` for the `Map` index (@robot-clickhouse)

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

## X. Empirical Invariant Guard in executeQuery.cpp

**RULE**:
When implementing operations in `src/Interpreters/ClusterProxy/executeQuery.cpp`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in ClickHouse/ClickHouse. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `4eb5bd00`: . Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing C++ data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/Interpreters/ClusterProxy/executeQuery.cpp`.

**VERIFIED IMPLEMENTATION PATTERN**:
```c++
// Verified production-grade fix pattern:
std::optional<LocalPlanParallelReplicasInfo> dropReadFromRemoteInPlan(QueryPlan & query_plan)
                /// Without a local replica this step is the plan's only reading step.
                if (!read_from_remote->getExcludePoolIndex())
                    return {};

```

**NEGATIVE CONSTRAINT**:
```c++
// Induced defect failure mode:
LocalPlanParallelReplicasInfo dropReadFromRemoteInPlan(QueryPlan & query_plan)
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `4eb5bd00` are properly handled with clean fallback behavior.

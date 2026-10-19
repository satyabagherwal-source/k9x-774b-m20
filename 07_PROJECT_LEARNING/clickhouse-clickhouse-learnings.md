> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/clickhouse-clickhouse-learnings.md`  
> **Source**: github ([https://github.com/ClickHouse/ClickHouse](https://github.com/ClickHouse/ClickHouse))  
> **Source Version**: `8c0552d4`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-19T18:10:27.014Z  
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
> **Harvest Timestamp**: 2026-10-19T18:10:27.006Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `ClickHouse/ClickHouse`
- **Description**: ClickHouse® is a real-time analytics database management system
- **Primary Language / Ecosystem**: C++
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 50489 stars

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
- **Issue #126739** (2026-10-19): **Bad cast from type DB::ColumnBLOB to DB::ColumnAggregateFunction. (LOGICAL_ERROR) due to dictionary creating**
  *Symptoms*: ### Company or project name  XWAY   ### Describe what's wrong  Query: ```SQL SELECT entity_id,        argMaxIf(bucket, date, warehouse_type = 'FBS') as col1,        argMaxIf(bucket, date, warehouse_type = 'FBO') as col2 FROM distributed_table WHERE date >= yesterday() GROUP BY entity_id; ``` works fine but if you use it as query in dictionary you gonna get an error `DB::Exception: Bad cast from type DB::ColumnBLOB to DB::ColumnAggregateFunction. (LOGICAL_ERROR) (version 26.3.12.3 (official))` TABLE IS DISTRIBUTED tmp fix is to add SETTINGS enable_parallel_blocks_marshalling=0 @nickitat   ### Does it reproduce on the most recent release?  Yes  ### How to reproduce  use query from subj all fields are UInt32 try to create dictionary out of it  ### Expected behavior  dictionary creates without additional settings  ### Error message and/or stacktrace  _No response_  ### Related issues and pull requests  _No response_  ### Additional context  _No response_

- **Issue #126053** (2026-10-19): **Iceberg REST catalog: a namespace level with `\x1f` is created but cannot be addressed, and breaks `SHOW TABLES` of every `DataLakeCatalog` database on the catalog**
  *Symptoms*: 🕵️   Two halves:  1. **Embedded catalog server.** `CreateNamespace` accepts a level that contains `\x1f`, the unit separator the Iceberg REST spec uses between namespace levels. `validateNamespace` (`src/Server/IcebergRESTCatalog/IcebergRESTCatalogHandler.cpp`) only rejects empty and over-long levels. Every later request for that namespace splits its name on `\x1f`, so it answers 404 (`Namespace does not exist: a.b`). The namespace can never be loaded or dropped through the API. 2. **ClickHouse REST client.** `encodeNamespaceForURI` (`src/Databases/DataLake/RestCatalog.cpp`) only turns `.` into `%1F` and copies every other byte into the URL unencoded. A namespace with a control character gives a raw `Poco::Exception` `Bad URI syntax` (Code 1000). Because the client lists the whole catalog, `SHOW TABLES` on the `DataLakeCatalog` database fails as a whole, not only for that namespace. Levels with `?`, `#`, `%` or spaces would also corrupt the request URL instead of being percent-encoded.  ### Does it reproduce on the most recent release?  The server half: no, the embedded catalog is not released yet. The client half (`encodeNamespaceForURI`, since 2025-12) affects released versions against any REST catalog that allows such names. Reproduced on master 26.10.1.1. The decoding change in #125791 does not change it: the decoded segment is still split on `\x1f`.  ### How to reproduce  Embedded catalog with warehouse `fuzz_wh`:  ```bash W=http://localhost:8182/v1/fuzz_wh curl -s -X P

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

### Incident Patch 1: `8c0552d4` (2026-10-19)
**Commit Message**: Merge pull request #124480 from groeneai/fix-or-like-chain-shared-alias

Fix `NOT_FOUND_COLUMN_IN_BLOCK` when an alias of an `OR` chain of `LIKE` conditions is reused by `GROUP BY` and other clauses

**File**: `src/Analyzer/Passes/ConvertOrLikeChainPass.cpp` (modified, +6/-16)
```diff
@@ -595,22 +595,12 @@ class ConvertOrLikeChainVisitor : public InDepthQueryTreeVisitorWithContext<Conv
         /// Clone the optimized OR node
         auto optimized_or_clone = node->clone();
 
-        /// Create AND of the optimized OR with indexHint:
-        /// optimized_or AND indexHint(original_like_chain)
-        auto and_node = std::make_shared<FunctionNode>("and");
-        and_node->getArguments().getNodes().push_back(std::move(optimized_or_clone));
-        and_node->getArguments().getNodes().push_back(std::move(index_hint_node));
-        and_node->resolveAsFunction(and_function_resolver);
-
-        /// Mark the AND node as processed to prevent re-visiting
-        processed_nodes.insert(and_node.get());
-
-        /// Also mark the cloned OR inside AND as processed
-        if (auto * or_child = and_node->getArguments().getNodes()[0]->as<FunctionNode>())
-            processed_nodes.insert(or_child);
-
-        /// Replace the original node with the AND expression
-        node = std::move(and_node);
+        /// Mark the cloned OR as processed to prevent re-visiting
+        processed_nodes.insert(optimized_or_clone->as<FunctionNode>());
+
+        /// Rewrite the node in place to optimized_or AND indexHint(original_like_chain), as it may be shared by several references.
+        function_node->getArguments().getNodes() = {std::move(optimized_or_clone), std::move(index_hint_node)};
+        function_node->resolveAsFunction(and_function_resolver);
     }
 private:
     const FunctionOverloadResolverPtr or_function_resolver;
```

**File**: `tests/queries/0_stateless/05346_optimize_or_like_chain_shared_alias.reference` (added, +23/-0)
```diff
@@ -0,0 +1,23 @@
+0
+1
+1	4
+0
+1
+0
+1
+0
+1
+\N
+0
+1
+0
+1
+0	8
+0	12
+1	4
+0
+1
+0	1
+1	1
+0	8
+1	4
```

**File**: `tests/queries/0_stateless/05346_optimize_or_like_chain_shared_alias.sql` (added, +21/-0)
```diff
@@ -0,0 +1,21 @@
+-- Random settings limits: optimize_or_like_chain=(1, None)
+
+SET enable_identifier_resolve_cache = 1;
+
+DROP TABLE IF EXISTS t_or_like_shared;
+CREATE TABLE t_or_like_shared (s String, ns Nullable(String), ls LowCardinality(String), n UInt64) ENGINE = MergeTree ORDER BY n;
+INSERT INTO t_or_like_shared SELECT toString(number % 3), if(number = 5, NULL, toString(number % 3)), toString(number % 3), number FROM numbers(12);
+
+SELECT (s LIKE '%a%' OR s LIKE '%b%' OR s LIKE '%c%' OR s LIKE '%1%') AS r FROM t_or_like_shared GROUP BY r ORDER BY r;
+SELECT (s LIKE '%a%' OR s LIKE '%b%' OR s LIKE '%c%' OR s LIKE '%1%') AS r, count() FROM t_or_like_shared GROUP BY r HAVING r;
+SELECT (s ILIKE '%A%' OR s ILIKE '%B%' OR s ILIKE '%C%' OR s ILIKE '%1%') AS r FROM t_or_like_shared GROUP BY r ORDER BY r;
+SELECT (s LIKE 'a%' OR s LIKE 'b%' OR s LIKE 'c%' OR s LIKE 'd%' OR s LIKE 'e%' OR s LIKE 'f%' OR s LIKE 'g%' OR s LIKE 'h%' OR s LIKE 'i%' OR s LIKE '1%') AS r FROM t_or_like_shared GROUP BY r ORDER BY r;
+SELECT (ns LIKE '%a%' OR ns LIKE '%b%' OR ns LIKE '%c%' OR ns LIKE '%1%') AS r FROM t_or_like_shared GROUP BY r ORDER BY r;
+SELECT (ls LIKE '%a%' OR ls LIKE '%b%' OR ls LIKE '%c%' OR ls LIKE '%1%') AS r FROM t_or_like_shared GROUP BY r ORDER BY r;
+SELECT (s LIKE '%a%' OR s LIKE '%b%' OR s LIKE '%c%' OR s LIKE '%1%' OR ls LIKE '%a%' OR ls LIKE '%b%' OR ls LIKE '%c%' OR ls LIKE '%2%') AS r FROM t_or_like_shared GROUP BY r ORDER BY r;
+SELECT (s LIKE '%a%' OR s LIKE '%b%' OR s LIKE '%c%' OR s LIKE '%1%') AS r, count() FROM t_or_like_shared GROUP BY r WITH ROLLUP ORDER BY r, count();
+WITH if(s LIKE '%a%' OR s LIKE '%b%' OR s LIKE '%c%' OR s LIKE '%1%', s, 'z') AS h SELECT (h LIKE '%a%' OR h LIKE '%b%' OR h LIKE '%c%' OR h LIKE '%1%') AS r FROM t_or_like_shared GROUP BY r ORDER BY r;
+SELECT (s LIKE '%a%' OR s LIKE '%b%' OR s LIKE '%c%' OR s LIKE '%1%') AS r, indexHint(r) FROM t_or_like_shared GROUP BY r ORDER BY r;
+SELECT (s LIKE '%a%' OR s LIKE '%b%' OR s LIKE '%c%' OR s LIKE '%1%') AS r, count() FROM t_or_like_shared GROUP BY r ORDER BY ALL SETTINGS enable_identifier_resolve_cache = 0;
+
+DROP TABLE t_or_like_shared;
```

---

### Incident Patch 2: `2134b447` (2026-10-19)
**Commit Message**: Merge pull request #125828 from groeneai/fix-group-by-key-in-if-chain-and-order-by-tuple

Fix wrong results and `NOT_FOUND_COLUMN_IN_BLOCK` for a `GROUP BY` key inside an `if` chain or an `ORDER BY` tuple

**File**: `src/Analyzer/FunctionNode.h` (modified, +3/-0)
```diff
@@ -209,6 +209,9 @@ class FunctionNode final : public IQueryTreeNode
             wrap_with_nullable = true;
     }
 
+    /// Whether `convertToNullable` was called, also when the result type cannot be `Nullable` and did not change.
+    bool isConvertedToNullable() const { return wrap_with_nullable; }
+
     void dumpTreeImpl(WriteBuffer & buffer, FormatState & format_state, size_t indent) const override;
 
 protected:
```

**File**: `src/Analyzer/Passes/IfChainToMultiIfPass.cpp` (modified, +61/-2)
```diff
@@ -3,9 +3,13 @@
 
 #include <Analyzer/InDepthQueryTreeVisitor.h>
 #include <Analyzer/FunctionNode.h>
+#include <Analyzer/Passes/OptimizeKeyExpressionsUtils.h>
+#include <Analyzer/QueryNode.h>
 #include <Core/Settings.h>
 #include <Functions/multiIf.h>
 
+#include <unordered_set>
+
 namespace DB
 {
 namespace Setting
@@ -19,6 +23,39 @@ namespace Setting
 namespace
 {
 
+/// The `if` nodes of the query, outside of its subqueries, that are `GROUP BY` keys, collected before any of them is rewritten.
+std::unordered_set<QueryTreeNodePtr> collectGroupByKeyIfNodes(const QueryNode & query_node)
+{
+    auto is_if = [](const QueryTreeNodePtr & node)
+    {
+        const auto * function_node = node->as<FunctionNode>();
+        return function_node && function_node->getFunctionName() == "if" && function_node->getArguments().getNodes().size() == 3;
+    };
+
+    auto if_keys = getGroupByKeys(query_node);
+    std::erase_if(if_keys, [&](const auto & key) { return !is_if(key); });
+
+    std::unordered_set<QueryTreeNodePtr> result;
+    if (if_keys.empty())
+        return result;
+
+    std::vector<const IQueryTreeNode *> nodes{&query_node};
+    while (!nodes.empty())
+    {
+        const auto * node = nodes.back();
+        nodes.pop_back();
+        for (const auto & child : node->getChildren())
+        {
+            if (!child || child->getNodeType() == QueryTreeNodeType::QUERY || child->getNodeType() == QueryTreeNodeType::UNION)
+                continue;
+            if (is_if(child) && isGroupByKeyAfterAggregation(child, if_keys))
+                result.insert(child);
+            nodes.push_back(child.get());
+        }
+    }
+    return result;
+}
+
 class IfChainToMultiIfPassVisitor : public InDepthQueryTreeVisitorWithContext<IfChainToMultiIfPassVisitor>
 {
 public:
@@ -28,10 +65,19 @@ class IfChainToMultiIfPassVisitor : public InDepthQueryTreeVisitorWithContext<If
     explicit IfChainToMultiIfPassVisitor(FunctionOverloadResolverPtr multi_if_function_ptr_, ContextPtr context)
         : Base(std::move(context))
         , multi_if_function_ptr(std::move(multi_if_function_ptr_))
-    {}
+    {
+        group_by_key_if_nodes_stack.emplace_back();
+    }
 
     void enterImpl(QueryTreeNodePtr & node)
     {
+        if (const auto * query_node = node->as<QueryNode>())
+        {
+            group_by_key_if_nodes_stack.push_back(
+                getSettings()[Setting::optimize_if_chain_to_multiif] ? collectGroupByKeyIfNodes(*query_node) : std::unordered_set<QueryTreeNodePtr>{});
+            return;
+        }
+
         if (!getSettings()[Setting::optimize_if_chain_to_multiif])
             return;
 
@@ -53,6 +99,10 @@ class IfChainToMultiIfPassVisitor : public InDepthQueryTreeVisitorWithContext<If
             if (!if_chain_function_node || if_chain_function_node->getFunctionName() != "if" || if_chain_function_node->getArguments().getNodes().size() != 3)
                 break;
 
+            /// A `GROUP BY` key is read from the aggregation result, so it is not spliced into the chain.
+            if (if_chain_function_node->isConvertedToNullable() || group_by_key_if_nodes_stack.back().contains(if_chain_node))
+                break;
+
             /// Replace last `multiIf` argument with `if` function arguments
 
             multi_if_arguments.pop_back();
@@ -78,14 +128,23 @@ class IfChainToMultiIfPassVisitor : public InDepthQueryTreeVisitorWithContext<If
             return;
 
         /// A `group_by_use_nulls` copy of a GROUP BY key is the key made Nullable: rewrite it like the key and keep it Nullable.
-        if (!multi_if_function->getResultType()->equals(*function_node->getResultType()))
+        if (function_node->isConvertedToNullable())
             multi_if_function->convertToNullable();
 
         node = std::move(multi_if_function);
     }
 
+    void leaveImpl(QueryTreeNodePtr & node)
+    {
+        if (node->getNodeType() == QueryTreeNodeType::QUERY)
+            group_by_key_if_nodes_stack.pop_back();
+    }
+
 private:
     FunctionOverloadResolverPtr multi_if_function_ptr;
+
+    /// For each enclosing query, its `if` nodes that are `GROUP BY` keys; the first set is for an expression outside of any query.
+    std::vector<std::unordered_set<QueryTreeNodePtr>> group_by_key_if_nodes_stack;
 };
 
 }
```

**File**: `src/Analyzer/Passes/OptimizeKeyExpressionsUtils.cpp` (modified, +32/-0)
```diff
@@ -1,9 +1,13 @@
 #include <Analyzer/Passes/OptimizeKeyExpressionsUtils.h>
 
+#include <algorithm>
 #include <queue>
 #include <vector>
 
 #include <Analyzer/FunctionNode.h>
+#include <Analyzer/ListNode.h>
+#include <Analyzer/QueryNode.h>
+#include <Analyzer/ValidationUtils.h>
 #include <Core/ColumnsWithTypeAndName.h>
 #include <DataTypes/IDataType.h>
 #include <DataTypes/TypeTree.h>
@@ -174,4 +178,32 @@ QueryTreeNodes unwrapInjectiveFunctionsInKeys(
     return new_keys;
 }
 
+QueryTreeNodes getGroupByKeys(const QueryNode & query_node)
+{
+    QueryTreeNodes keys;
+    if (!query_node.hasGroupBy())
+        return keys;
+
+    for (const auto & node : query_node.getGroupBy().getNodes())
+    {
+        if (query_node.isGroupByWithGroupingSets())
+        {
+            const auto & grouping_set_keys = node->as<ListNode &>().getNodes();
+            keys.insert(keys.end(), grouping_set_keys.begin(), grouping_set_keys.end());
+        }
+        else
+        {
+            keys.push_back(node);
+        }
+    }
+    return keys;
+}
+
+bool isGroupByKeyAfterAggregation(const QueryTreeNodePtr & node, const QueryTreeNodes & group_by_keys)
+{
+    if (const auto * function_node = node->as<FunctionNode>(); function_node && function_node->isConvertedToNullable())
+        return true;
+    return std::ranges::any_of(group_by_keys, [&](const auto & key) { return compareGroupByKeys(node, key); });
+}
+
 }
```

**File**: `src/Analyzer/Passes/OptimizeKeyExpressionsUtils.h` (modified, +9/-0)
```diff
@@ -6,6 +6,8 @@
 namespace DB
 {
 
+class QueryNode;
+
 /** Shared helpers for cleaning up the key list of `GROUP BY` and `LIMIT BY`. Both group rows by
   * the distinct combinations of their key values. A key is dropped or rewritten only when this
   * grouping stays the same and the old value can still be computed from the keys that remain, so
@@ -29,4 +31,11 @@ void removeKeysThatAreFunctionsOfOtherKeys(QueryTreeNodes & keys);
 QueryTreeNodes unwrapInjectiveFunctionsInKeys(
     const QueryTreeNodes & keys, bool allow_suspicious_types, const QueryTreeNodePtrWithHashSet * keys_to_keep = nullptr);
 
+/// The `GROUP BY` keys of `query_node`, of all grouping sets.
+QueryTreeNodes getGroupByKeys(const QueryNode & query_node);
+
+/// Returns true if `node`, in an expression computed after `GROUP BY`, is a key, read from the aggregation result.
+/// Under `group_by_use_nulls` the analyzer replaces a key there with a copy converted to `Nullable`, not equal to the key.
+bool isGroupByKeyAfterAggregation(const QueryTreeNodePtr & node, const QueryTreeNodes & group_by_keys);
+
 }
```

**File**: `src/Analyzer/Passes/OrderByTupleEliminationPass.cpp` (modified, +6/-1)
```diff
@@ -2,6 +2,7 @@
 
 #include <Analyzer/InDepthQueryTreeVisitor.h>
 #include <Analyzer/FunctionNode.h>
+#include <Analyzer/Passes/OptimizeKeyExpressionsUtils.h>
 #include <Analyzer/QueryNode.h>
 #include <Analyzer/SortNode.h>
 #include <Functions/FunctionFactory.h>
@@ -21,13 +22,17 @@ class OrderByTupleEliminationVisitor : public InDepthQueryTreeVisitor<OrderByTup
         if (!query_node || !query_node->hasOrderBy())
             return;
 
+        const auto group_by_keys = getGroupByKeys(*query_node);
+
         QueryTreeNodes result_nodes;
 
         for (auto & sort_node : query_node->getOrderBy().getNodes())
         {
             auto & sort_node_typed = sort_node->as<SortNode &>();
             auto * function_expression = sort_node_typed.getExpression()->as<FunctionNode>();
-            if (sort_node_typed.withFill() || !function_expression || function_expression->getFunctionName() != "tuple")
+            /// Splitting a key would read its arguments, which do not exist after aggregation.
+            if (sort_node_typed.withFill() || !function_expression || function_expression->getFunctionName() != "tuple"
+                || isGroupByKeyAfterAggregation(sort_node_typed.getExpression(), group_by_keys))
             {
                 result_nodes.push_back(sort_node);
                 continue;
```

**File**: `tests/queries/0_stateless/05397_group_by_key_in_if_chain_and_order_by_tuple.reference` (added, +70/-0)
```diff
@@ -0,0 +1,70 @@
+1	q	1
+1	\N	1
+2	p	1
+2	\N	1
+\N	\N	2
+3
+1	q	1
+1	\N	1
+2	p	1
+2	\N	1
+\N	\N	2
+1	[]	1
+1	[3]	1
+2	[]	1
+2	[2]	1
+\N	[]	2
+0	q	1
+0	\N	1
+1	q	1
+1	\N	1
+2	p	1
+2	\N	1
+3	q	1
+3	\N	1
+\N	\N	4
+0	q
+1	q
+2	p
+3	q
+1
+3
+5
+0
+2
+4
+1	u
+3	w
+5	w
+0	y
+2	y
+4	y
+1
+(0)	4
+(1)	3
+(2)	3
+\N	10
+0	(0)
+1	(1)
+0	\N
+1	\N
+\N	\N
+(0)	4
+(1)	3
+(2)	3
+(0)	4
+(0)	10
+(1)	3
+(2)	3
+(0)	4
+(1)	3
+(2)	3
+\N	10
+(0,0)	2
+(0,1)	2
+(0,2)	2
+(1,0)	2
+(1,1)	2
+(1,2)	2
+\N	12
+0
```

**File**: `tests/queries/0_stateless/05397_group_by_key_in_if_chain_and_order_by_tuple.sql` (added, +31/-0)
```diff
@@ -0,0 +1,31 @@
+-- An if chain or an ORDER BY tuple that contains a GROUP BY key reads the key from the aggregation result.
+
+SET optimize_if_transform_strings_to_enum = 0;
+
+-- A constant-condition `if` key nested in an `if` chain (#125803).
+SELECT n, if(n = 5, toString(n), if(1, if(n > 1, 'p', 'q'), 'z')) AS e, count() FROM (SELECT arrayJoin([1, 2]) AS n) GROUP BY ROLLUP(n, if(1, if(n > 1, 'p', 'q'), 'z')) ORDER BY ALL SETTINGS group_by_use_nulls = 1, optimize_if_chain_to_multiif = 1;
+SELECT count() FROM (SELECT n, if(n = 5, toString(n), if(1, if(n > 1, 'p', 'q'), 'z')) AS e FROM (SELECT arrayJoin([1, 2]) AS n) GROUP BY ROLLUP(n, if(1, if(n > 1, 'p', 'q'), 'z')) HAVING e IS NULL SETTINGS group_by_use_nulls = 1, optimize_if_chain_to_multiif = 1);
+
+-- A plain `if` key nested in an `if` chain.
+SELECT n, if(n = 5, toString(n), if(n > 1, 'p', 'q')) AS e, count() FROM (SELECT arrayJoin([1, 2]) AS n) GROUP BY ROLLUP(n, if(n > 1, 'p', 'q')) ORDER BY ALL SETTINGS group_by_use_nulls = 1, optimize_if_chain_to_multiif = 1;
+SELECT n, if(n = 5, [toUInt8(n)], if(n > 1, [2], [3])) AS e, count() FROM (SELECT arrayJoin([1, 2]) AS n) GROUP BY ROLLUP(n, if(n > 1, [2], [3])) ORDER BY ALL SETTINGS group_by_use_nulls = 1, optimize_if_chain_to_multiif = 1;
+SELECT n, if(n = 5, toString(n), if(m > 1, 'p', 'q')) AS e, count() FROM (SELECT number AS n, number % 3 AS m FROM numbers(4)) GROUP BY ROLLUP(n, if(m > 1, 'p', 'q')) ORDER BY ALL SETTINGS group_by_use_nulls = 1, optimize_if_chain_to_multiif = 1;
+SELECT n, if(n = 5, toString(n), if(m > 1, 'p', 'q')) AS e FROM (SELECT number AS n, number % 3 AS m FROM numbers(4)) GROUP BY n, if(m > 1, 'p', 'q') ORDER BY n SETTINGS group_by_use_nulls = 0, optimize_if_chain_to_multiif = 1;
+
+-- A key whose `then` branch is itself a chain.
+SELECT n FROM (SELECT number AS n, number % 2 = 1 AS a, number % 3 = 1 AS p, number % 5 = 1 AS q FROM numbers(6)) GROUP BY n, if(a, if(p, 'u', if(q, 'v', 'w')), 'y') ORDER BY if(n = 5, 'x', if(a, if(p, 'u', if(q, 'v', 'w')), 'y')), n SETTINGS group_by_use_nulls = 0, optimize_if_chain_to_multiif = 1;
+SELECT n, if(a, if(p, 'u', if(q, 'v', 'w')), 'y') AS k FROM (SELECT number AS n, number % 2 = 1 AS a, number % 3 = 1 AS p, number % 5 = 1 AS q FROM numbers(6)) GROUP BY n, k ORDER BY if(n = 5, 'x', k), n SETTINGS group_by_use_nulls = 0, optimize_if_chain_to_multiif = 1, enable_identifier_resolve_cache = 1;
+
+-- A chain without a key is still rewritten.
+SELECT count() FROM (EXPLAIN QUERY TREE SELECT n, if(n = 1, 'a', if(n = 2, 'b', 'c')) FROM (SELECT arrayJoin([1, 2]) AS n) GROUP BY ROLLUP(n) SETTINGS group_by_use_nulls = 1, optimize_if_chain_to_multiif = 1) WHERE explain ILIKE '%function_name: multiIf%';
+
+-- A tuple key in ORDER BY (#125804).
+SELECT if(1, tuple(a), tuple(0)) AS k, count() FROM (SELECT number % 3 AS a FROM numbers(10)) GROUP BY ROLLUP(k) ORDER BY k SETTINGS group_by_use_nulls = 1, optimize_if_chain_to_multiif = 0;
+SELECT a, if(1, tuple(a), tuple(0)) AS k FROM (SELECT number % 2 AS a FROM numbers(4)) GROUP BY ROLLUP(a, k) ORDER BY k, a SETTINGS group_by_use_nulls = 1, optimize_if_chain_to_multiif = 0;
+SELECT if(1, tuple(a), tuple(0)) AS k, count() FROM (SELECT number % 3 AS a FROM numbers(10)) GROUP BY k ORDER BY k SETTINGS group_by_use_nulls = 0, optimize_if_chain_to_multiif = 0;
+SELECT if(1, tuple(a), tuple(0)) AS k, count() FROM (SELECT number % 3 AS a FROM numbers(10)) GROUP BY ROLLUP(k) ORDER BY k SETTINGS group_by_use_nulls = 0, optimize_if_chain_to_multiif = 0;
+SELECT if(1, tuple(a), tuple(0)) AS k, count() FROM (SELECT number % 3 AS a FROM numbers(10)) GROUP BY CUBE(k) ORDER BY ALL SETTINGS group_by_use_nulls = 1, optimize_if_chain_to_multiif = 0;
+SELECT if(1, tuple(a, b), tuple(0, 0)) AS k, count() FROM (SELECT number % 2 AS a, number % 3 AS b FROM numbers(12)) GROUP BY GROUPING SETS ((k), ()) ORDER BY k SETTINGS group_by_use_nulls = 1, optimize_if_chain_to_multiif = 0;
+
+-- A tuple of keys that is not itself a key is still split.
+SELECT count() FROM (EXPLAIN QUERY TREE SELECT a, b FROM (SELECT number % 2 AS a, number % 3 AS b FROM numbers(12)) GROUP BY ROLLUP(a, b) ORDER BY tuple(a, b) SETTINGS group_by_use_nulls = 1, optimize_if_chain_to_multiif = 0) WHERE explain ILIKE '%function_name: tuple%';
```

---

### Incident Patch 3: `74d99c64` (2026-10-18)
**Commit Message**: Merge pull request #125735 from groeneai/fix-and-compare-chain-budget-alias-copies

Fix `NOT_FOUND_COLUMN_IN_BLOCK` when the `optimize_and_compare_chain` budget runs out between copies of an alias

**File**: `src/Analyzer/Passes/LogicalExpressionOptimizerPass.cpp` (modified, +58/-16)
```diff
@@ -1735,20 +1735,22 @@ class LogicalExpressionOptimizerVisitor : public InDepthQueryTreeVisitorWithCont
 public:
     using Base = InDepthQueryTreeVisitorWithContext<LogicalExpressionOptimizerVisitor>;
 
-    explicit LogicalExpressionOptimizerVisitor(ContextPtr context)
+    enum class Mode : uint8_t
+    {
+        JOIN_ON_AND_COMPARE_CHAIN,
+        OTHER_REWRITES,
+    };
+
+    LogicalExpressionOptimizerVisitor(ContextPtr context, Mode mode_)
         : Base(std::move(context))
+        , mode(mode_)
         , and_compare_chain_max_hash_work(getSettings()[Setting::optimize_and_compare_chain_max_hash_work])
         , and_compare_chain_hash_work_start(getTreeHashWorkCounter())
     {}
 
-    /// Work budget for tryOptimizeAndCompareChain, measured directly in nodes hashed by getTreeHash
-    /// (its dominant cost). We snapshot the global counter when the visitor starts and stop the
-    /// optimization once it has hashed more than `and_compare_chain_max_hash_work` nodes for this
-    /// query. On queries with very many / very large AND-comparison chains this caps a cost that
-    /// otherwise dominates analysis while folding nothing (e.g. a 16x16 SQL ray-trace: ~72s -> ~3s),
-    /// while normal queries hash only thousands of nodes and never approach the budget. Stopping
-    /// early is always safe -- it only forgoes an optimization, never changes results.
-    /// The budget is the `optimize_and_compare_chain_max_hash_work` setting (0 disables it).
+    const Mode mode;
+
+    /// Work budget of the compare-chain traversal, in nodes hashed by getTreeHash (its dominant cost).
     const size_t and_compare_chain_max_hash_work = 0;
     const size_t and_compare_chain_hash_work_start = 0;
 
@@ -1761,6 +1763,28 @@ class LogicalExpressionOptimizerVisitor : public InDepthQueryTreeVisitorWithCont
             && getTreeHashWorkCounter() - and_compare_chain_hash_work_start > and_compare_chain_max_hash_work;
     }
 
+    /// `and` nodes the compare chain appended conjuncts to, with their state before the first append.
+    struct AndNodeBeforeCompareChain
+    {
+        size_t arguments_size;
+        FunctionBasePtr function;
+    };
+    std::unordered_map<QueryTreeNodePtr, AndNodeBeforeCompareChain> and_nodes_before_compare_chain;
+
+    /// All or nothing per query: equal copies of an expression (a SELECT alias and its GROUP BY key) must be rewritten alike.
+    void revertAndCompareChainIfBudgetExceeded()
+    {
+        if (!andCompareChainHashBudgetExceeded())
+            return;
+        for (const auto & [node, before] : and_nodes_before_compare_chain)
+        {
+            auto & function_node = node->as<FunctionNode &>();
+            function_node.getArguments().getNodes().resize(before.arguments_size);
+            function_node.resolveAsFunction(before.function);
+        }
+        and_nodes_before_compare_chain.clear();
+    }
+
     /// Memoized "this subtree contains a correlated subquery" bit, keyed by node identity.
     /// tryOptimizeAndCompareChain runs for every `and` node, and skipping a chain that holds a
     /// correlated subquery requires walking its subtree; without memoization a deeply nested AND
@@ -1881,14 +1905,22 @@ class LogicalExpressionOptimizerVisitor : public InDepthQueryTreeVisitorWithCont
         if (auto * join_node = node->as<JoinNode>())
         {
             /// Operator <=> is not supported outside of JOIN ON section
-            if (join_node->hasJoinExpression())
+            if (mode == Mode::JOIN_ON_AND_COMPARE_CHAIN && join_node->hasJoinExpression())
             {
                 JoinOnLogicalExpressionOptimizerVisitor join_on_visitor(*join_node, getContext());
                 join_on_visitor.visit(join_node->getJoinExpression());
             }
             return;
         }
 
+        if (mode == Mode::JOIN_ON_AND_COMPARE_CHAIN)
+        {
+            auto * function_node = node->as<FunctionNode>();
+            if (function_node && function_node->getFunctionName() == "and" && getSettings()[Setting::optimize_and_compare_chain])
+                tryOptimizeAndCompareChain(node);
+            return;
+        }
+
         auto * function_node = node->as<FunctionNode>();
 
         if (!function_node)
@@ -1902,11 +1934,6 @@ class LogicalExpressionOptimizerVisitor : public InDepthQueryTreeVisitorWithCont
 
         if (function_node->getFunctionName() == "and")
         {
-            /// Run transitive inference first so that the conflict detector can see inferred equalities.
-            /// E.g. `x = 3 AND x = y AND y = 5` — the compare-chain pass infers `x = 5`,
-            /// then the equals-chain pass detects `x = 3` vs `x = 5` and collapses to FALSE.
-            if (getSettings()[Setting::optimize_and_compare_chain])
-                tryOptimizeAndCompareChain(node);
             tryOptimizeAndCompareNotEqualsChain(node);
             return;
         }
@@ -1920,6 +1947,9 @@ class LogicalExpressionOptimizerVisitor : public InDepth
```

**File**: `src/Core/Settings.cpp` (modified, +1/-1)
```diff
@@ -10090,7 +10090,7 @@ Detect conflicting and redundant comparison conditions on the same expression wi
 )", 0, \
         {"26.7", false, true, "New setting to detect conflicting and redundant comparison conditions on the same expression within AND chains."}) \
     DECLARE(UInt64, optimize_and_compare_chain_max_hash_work, 5'000'000, R"(
-Work budget for the `optimize_and_compare_chain` optimization during query analysis, measured in the number of query-tree nodes hashed by `getTreeHash` (the dominant cost of this optimization). Once a query has hashed more than this many nodes while applying the optimization, it stops applying it for the rest of the query. This bounds analysis time for queries with very many or very large `AND`-chains of comparisons, where the optimization can otherwise dominate analysis while folding nothing. Stopping early is always safe: it only forgoes an optimization and never changes results. Set to `0` to disable the budget (unlimited).
+Work budget for the `optimize_and_compare_chain` optimization during query analysis, measured in the number of query-tree nodes hashed by `getTreeHash` (the dominant cost of this optimization). If applying the optimization to a query hashes more than this many nodes, the optimization is not applied to that query. This bounds analysis time for queries with very many or very large `AND`-chains of comparisons, where the optimization can otherwise dominate analysis while folding nothing. Stopping early is always safe: it only forgoes an optimization and never changes results. Set to `0` to disable the budget (unlimited).
 )", 0, \
         {"26.7", 0, 5'000'000, "New setting that bounds the work of the `optimize_and_compare_chain` optimization (measured in query-tree nodes hashed) so it cannot dominate analysis of queries with very many or very large `AND`-chains of comparisons. The previous value `0` (unlimited) reproduces the pre-26.7 behavior where the optimization was uncapped, so `compatibility` set to an earlier version keeps deriving transitive predicates without a budget. Set to `0` to disable the budget."}) \
     DECLARE(Bool, push_external_roles_in_interserver_queries, true, R"(
```

**File**: `tests/queries/0_stateless/05394_optimize_and_compare_chain_budget_alias_copies.reference` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+122 0
+122 1
+122 0
+122 1
+122 1
+2
```

**File**: `tests/queries/0_stateless/05394_optimize_and_compare_chain_budget_alias_copies.sh` (added, +26/-0)
```diff
@@ -0,0 +1,26 @@
+#!/usr/bin/env bash
+
+CUR_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
+# shellcheck source=../shell_config.sh
+. "$CUR_DIR"/../shell_config.sh
+
+# The `optimize_and_compare_chain_max_hash_work` budget must never make two copies of an expression (a SELECT alias and its GROUP BY key) be rewritten differently.
+
+# Runs the statement once per budget and `enable_identifier_resolve_cache` value; SETTINGS_PLACEHOLDER marks where the settings go.
+function sweep()
+{
+    for budget in $(seq 0 10 600); do
+        for cache in 0 1; do
+            echo "${1/SETTINGS_PLACEHOLDER/SETTINGS optimize_and_compare_chain = 1, optimize_and_compare_chain_max_hash_work = $budget, enable_identifier_resolve_cache = $cache} FORMAT TSV;"
+        done
+    done | $CLICKHOUSE_CLIENT | sort | uniq -c | sed 's/^ *//'
+}
+
+query="SELECT (number < (number + 1)) AND ((number + 1) < 3) AS r FROM numbers(5) GROUP BY r"
+
+sweep "$query ORDER BY r SETTINGS_PLACEHOLDER"
+sweep "$query SETTINGS_PLACEHOLDER"
+# The derivation is applied to both copies or to none.
+sweep "SELECT count() IN (0, 2) FROM (EXPLAIN QUERY TREE $query SETTINGS_PLACEHOLDER) WHERE explain ILIKE '%function_name: indexHint%'"
+
+$CLICKHOUSE_CLIENT -q "SELECT count() FROM (EXPLAIN QUERY TREE $query SETTINGS optimize_and_compare_chain = 1, optimize_and_compare_chain_max_hash_work = 5000000) WHERE explain ILIKE '%function_name: indexHint%'"
```

#### Recent Merged Pull Requests:
- **PR #126734** (2026-10-19): Backport #126039 to 26.9: Do not print runtime addresses in fatal error reports (@robot-ch-test-poll3)
- **PR #126732** (2026-10-19): Backport #125893 to 26.9: Fix a crash and lost rows on INSERT when a row policy of a table read by a materialized view uses `IN <source table>` (@robot-ch-test-poll3)
- **PR #126727** (2026-10-19): Backport #113877 to 26.7: Fix out-of-bounds write on a long codec chain (@robot-clickhouse)
- **PR #126720** (2026-10-19): Backport #126120 to 26.7: Fix out-of-bounds accesses in the replxx line editor (@robot-clickhouse)
- **PR #126719** (2026-10-19): Backport #126120 to 26.3: Fix out-of-bounds accesses in the replxx line editor (@robot-clickhouse)
- **PR #126718** (2026-10-19): Backport #125785 to 26.7: Use constant-time comparison for TOTP codes and plaintext passwords (@robot-ch-test-poll2)

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

## X. Merge pull request #124480 from groeneai/fix-or-like-chain-shared-alias

**RULE**:
When implementing operations in `src/Analyzer/Passes/ConvertOrLikeChainPass.cpp`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in ClickHouse/ClickHouse. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `8c0552d4`: Merge pull request #124480 from groeneai/fix-or-like-chain-shared-alias. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing C++ data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/Analyzer/Passes/ConvertOrLikeChainPass.cpp`.

**VERIFIED IMPLEMENTATION PATTERN**:
```c++
// Verified production-grade fix pattern:
        /// Mark the cloned OR as processed to prevent re-visiting
        processed_nodes.insert(optimized_or_clone->as<FunctionNode>());

        /// Rewrite the node in place to optimized_or AND indexHint(original_like_chain), as it may be shared by several references.
        function_node->getArguments().getNodes() = {std::move(optimized_or_clone), std::move(index_hint_node)};
        function_node->resolveAsFunction(and_function_resolver);
```

**NEGATIVE CONSTRAINT**:
```c++
// Anti-pattern to NEVER write (induced failure mode):
        /// Create AND of the optimized OR with indexHint:
        /// optimized_or AND indexHint(original_like_chain)
        auto and_node = std::make_shared<FunctionNode>("and");
        and_node->getArguments().getNodes().push_back(std::move(optimized_or_clone));
        and_node->getArguments().getNodes().push_back(std::move(index_hint_node));
        and_node->resolveAsFunction(and_function_resolver);

        /// Mark the AND node as processed to prevent re-visiting
        processed_nodes.insert(and_node.get());

        /// Also mark the cloned OR inside AND as processed
        if (auto * or_child = and_node->getArguments().getNodes()[0]->as<FunctionNode>())
            processed_nodes.insert(or_child);

        /// Replace the original node with the AND expression
        node = std::move(and_node);
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `8c0552d4` are properly handled with clean fallback behavior.

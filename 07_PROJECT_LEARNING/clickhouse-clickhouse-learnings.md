# Forensic Learning Record (Deep Inspection): ClickHouse/ClickHouse

> **Canonical Artifact**: `07_PROJECT_LEARNING/clickhouse-clickhouse-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/ClickHouse/ClickHouse](https://github.com/ClickHouse/ClickHouse))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-07T21:26:16.909Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `ClickHouse/ClickHouse`
- **Description**: ClickHouse® is a real-time analytics database management system
- **Primary Language / Ecosystem**: C++
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 50286 stars

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
    /// (as discussed in <https://codahale.com/a-lesson-in-timing-attacks/>).

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

### Core Architecture Module: `base/poco/Foundation/src/DigestEngine.cpp`
```
//
// DigestEngine.cpp
//
// Library: Foundation
// Package: Crypt
// Module:  DigestEngine
//
// Copyright (c) 2004-2006, Applied Informatics Software Engineering GmbH.
// and Contributors.
//
// SPDX-License-Identifier:	BSL-1.0
//


#include "Poco/DigestEngine.h"
#include "Poco/Exception.h"


namespace Poco
{

DigestEngine::DigestEngine()
{
}


DigestEngine::~DigestEngine()
{
}


std::string DigestEngine::digestToHex(const Digest& bytes)
{
	static const char digits[] = "0123456789abcdef";
	std::string result;
	result.reserve(bytes.size() * 2);
	for (Digest::const_iterator it = bytes.begin(); it != bytes.end(); ++it)
	{
		unsigned char c = *it;
		result += digits[(c >> 4) & 0xF];
		result += digits[c & 0xF];
	}
	return result;
}


DigestEngine::Digest DigestEngine::digestFromHex(const std::string& digest)
{
	if (digest.size() % 2 != 0)
		throw DataFormatException();
	Digest result;
	result.reserve(digest.size() / 2);
	for (std::size_t i = 0; i < digest.size(); ++i)
	{
		int c = 0;
		// first upper 4 bits
		if (digest[i] >= '0' && digest[i] <= '9')
			c = digest[i] - '0';
		else if (digest[i] >= 'a' && digest[i] <= 'f')
			c = digest[i] - 'a' + 10;
		else if (digest[i] >= 'A' && digest[i] <= 'F')
			c = digest[i] - 'A' + 10;
		else
			throw DataFormatException();
		c <<= 4;
		++i;
		if (digest[i] >= '0' && digest[i] <= '9')
			c += digest[i] - '0';
		else if (digest[i] >= 'a' && digest[i] <= 'f')
			c += digest[i] - 'a' + 10;
		else if (digest[i] >= 'A' && digest[i] <= 'F')
			c += digest[i] - 'A' + 10;
		else
			throw DataFormatException();

		result.push_back(static_cast<unsigned char>(c));
	}
	return result;
}


bool DigestEngine::constantTimeEquals(const Digest& d1, const Digest& d2)
{
	if (d1.size() != d2.size()) return false;

	int result = 0;
	Digest::const_iterator it1 = d1.begin();
	Digest::const_iterator it2 = d2.begin();
	Digest::const_iterator end1 = d1.end();
	while (it1 != end1)
	{
		result |= *it1++ ^ *it2++;
	}
	return result == 0;
}


} // namespace Poco


```

### Core Architecture Module: `base/poco/Foundation/src/MD5Engine.cpp`
```
//
// MD5Engine.cpp
//
// Library: Foundation
// Package: Crypt
// Module:  MD5Engine
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


#include "Poco/MD5Engine.h"
#include <cstring>


namespace Poco {


MD5Engine::MD5Engine()
{
	_digest.reserve(16);
	reset();
}


MD5Engine::~MD5Engine()
{
	reset();
}

	
void MD5Engine::updateImpl(const void* input_, std::size_t inputLen)
{
	const unsigned char* input = (const unsigned char*) input_;
	unsigned int i, index, partLen;

	/* Compute number of bytes mod 64 */
	index = (unsigned int)((_context.count[0] >> 3) & 0x3F);

	/* Update number of bits */
	if ((_context.count[0] += ((UInt32) inputLen << 3)) < ((UInt32) inputLen << 3))
		_context.count[1]++;
	_context.count[1] += ((UInt32) inputLen >> 29);

	partLen = 64 - index;

	/* Transform as many times as possible. */
	if (inputLen >= partLen) 
	{
		std::memcpy(&_context.buffer[index], input, partLen);
		transform(_context.state, _context.buffer);

		for (i = partLen; i + 63 < inputLen; i += 64)
			transform(_context.state, &input[i]);

		index = 0;
	}
	else i = 0;

	/* Buffer remaining input */
	std::memcpy(&_context.buffer[index], &input[i],inputLen-i);
}


std::size_t MD5Engine::digestLength() const
{
	return DIGEST_SIZE;
}


void MD5Engine::reset()
{
	std::memset(&_context, 0, sizeof(_context));
	_context.count[0] = _context.count[1] = 0;
	_context.state[0] = 0x67452301;
	_context.state[1] = 0xefcdab89;
	_context.state[2] = 0x98badcfe;
	_context.state[3] = 0x10325476;
}


const DigestEngine::Digest& MD5Engine::digest()
{
	static const unsigned char PADDING[64] = 
	{
		0x80, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
		0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
		0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0
	};
	unsigned char bits[8];
	unsigned int index, padLen;

	/* Save number of bits */
	encode(bits, _context.count, 8);

	/* Pad out to 56 mod 64. */
	index = (unsigned int)((_context.count[0] >> 3) & 0x3f);
	padLen = (index < 56) ? (56 - index) : (120 - index);
	update(PADDING, padLen);

	/* Append length (before padding) */
	update(bits, 8);

	/* Store state in digest */
	unsigned char digest[16];
	encode(digest, _context.state, 16);
	_digest.clear();
	_digest.insert(_digest.begin(), digest, digest + sizeof(digest));

	/* Zeroize sensitive information. */
	std::memset(&_context, 0, sizeof (_context));
	reset();
	return _digest;
}


/* Constants for MD5Transform routine. */
#define S11 7
#define S12 12
#define S13 17
#define S14 22
#define S21 5
#define S22 9
#define S23 14
#define S24 20
#define S31 4
#define S32 11
#define S33 16
#define S34 23
#define S41 6
#define S42 10
#define S43 15
#define S44 21


/* F, G, H and I are basic MD5 functions. */
#define F(x, y, z) (((x) & (y)) | ((~x) & (z)))
#define G(x, y, z) (((x) & (z)) | ((y) & (~z)))
#define H(x, y, z) ((x) ^ (y) ^ (z))
#define I(x, y, z) ((y) ^ ((x) | (~z)))


/* ROTATE_LEFT rotates x left n bits. */
#define ROTATE_LEFT(x, n) (((x) << (n)) | ((x) >> (32-(n))))


/* FF, GG, HH, and II transformations for rounds 1, 2, 3, and 4.
   Rotation is separate from addition to prevent recomputation. */
#define FF(a, b, c, d, x, s, ac) { \
 (a) += F ((b), (c), (d)) + (x) + (UInt32)(ac); \
 (a) = ROTATE_LEFT ((a), (s)); \
 (a) += (b); \
  }
#define GG(a, b, c, d, x, s, ac) { \
 (a) += G ((b), (c), (d)) + (x) + (UInt32)(ac); \
 (a) = ROTATE_LEFT ((a), (s)); \
 (a) += (b); \
  }
#define HH(a, b, c, d, x, s, ac) { \
 (a) += H ((b), (c), (d)) + (x) + (UInt32)(ac); \
 (a) = ROTATE_LEFT ((a), (s)); \
 (a) += (b); \
  }
#define II(a, b, c, d, x, s, ac) { \
 (a) += I ((b), (c), (d)) + (x) + (UInt32)(ac); \
 (a) = ROTATE_LEFT ((a), (s)); \
 (a) += (b); \
  }


void MD5Engine::transform (UInt32 state[4], const unsigned char block[64])
{
	UInt32 a = state[0], b = state[1], c = state[2], d = state[3], x[16];

	decode(x, block, 64);

	/* Round 1 */
	FF (a, b, c, d, x[ 0], S11, 0xd76aa478); /* 1 */
	FF (d, a, b, c, x[ 1], S12, 0xe8c7b756); /* 2 */
	FF (c, d, a, b, x[ 2], S13, 0x242070db); /* 3 */
	FF (b, c, d, a, x[ 3], S14, 0xc1bdceee); /* 4 */
	FF (a, b, c, d, x[ 4], S11, 0xf57c0faf); /* 5 */
	FF (d, a, b, c, x[ 5], S12, 0x4787c62a); /* 6 */
	FF (c, d, a, b, x[ 6], S13, 0xa8304613); /* 7 */
	FF (b, c, d, a, x[ 7], S14, 0xfd469501); /* 8 */
	FF (a, b, c, d, x[ 8], S11, 0x698098d8); /* 9 */
	FF (d, a, b, c, x[ 9], S12, 0x8b44f7af); /* 10 */
	FF (c, d, a, b, x[10], S13, 0xffff5bb1); /* 11 */
	FF (b, c, d, a, x[11], S14, 0x895cd7be); /* 12 */
	FF (a, b, c, d, x[12], S11, 0x6b901122); /* 13 */
	FF (d, a, b, c, x[13], S12, 0xfd987193); /* 14 */
	FF (c, d, a, b, x[14], S13, 0xa679438e); /* 15 */
	FF (b, c, d, a, x[15], S14, 0x49b40821); /* 16 */

	/* Round 2 */
	GG (a, b, c, d, x[ 1], S21, 0xf61e2562); /* 17 */
	GG (d, a, b, c, x[ 6], S22, 0xc040b340); /* 18 */
	GG (c, d, a, b, x[11], S23, 0x265e5a51); /* 19 */
	GG (b, c, d, a, x[ 0], S24, 0xe9b6c7aa); /* 20 */
	GG (a, b, c, d, x[ 5], S21, 0xd62f105d); /* 21 */
	GG (d, a, b, c, x[10], S22, 0x2441453); /* 22 */
	GG (c, d, a, b, x[15], S23, 0xd8a1e681); /* 23 */
	GG (b, c, d, a, x[ 4], S24, 0xe7d3fbc8); /* 24 */
	GG (a, b, c, d, x[ 9], S21, 0x21e1cde6); /* 25 */
	GG (d, a, b, c, x[14], S22, 0xc33707d6); /* 26 */
	GG (c, d, a, b, x[ 3], S23, 0xf4d50d87); /* 27 */
	GG (b, c, d, a, x[ 8], S24, 0x455a14ed); /* 28 */
	GG (a, b, c, d, x[13], S21, 0xa9e3e905); /* 29 */
	GG (d, a, b, c, x[ 2], S22, 0xfcefa3f8); /* 30 */
	GG (c, d, a, b, x[ 7], S23, 0x676f02d9); /* 31 */
	GG (b, c, d, a, x[12], S24, 0x8d2a4c8a); /* 32 */

	/* Round 3 */
	HH (a, b, c, d, x[ 5], S31, 0xfffa3942); /* 33 */
	HH (d, a, b, c, x[ 8], S32, 0x8771f681); /* 34 */
	HH (c, d, a, b, x[11], S33, 0x6d9d6122); /* 35 */
	HH (b, c, d, a, x[14], S34, 0xfde5380c); /* 36 */
	HH (a, b, c, d, x[ 1], S31, 0xa4beea44); /* 37 */
	HH (d, a, b, c, x[ 4], S32, 0x4bdecfa9); /* 38 */
	HH (c, d, a, b, x[ 7], S33, 0xf6bb4b60); /* 39 */
	HH (b, c, d, a, x[10], S34, 0xbebfbc70); /* 40 */
	HH (a, b, c, d, x[13], S31, 0x289b7ec6); /* 41 */
	HH (d, a, b, c, x[ 0], S32, 0xeaa127fa); /* 42 */
	HH (c, d, a, b, x[ 3], S33, 0xd4ef3085); /* 43 */
	HH (b, c, d, a, x[ 6], S34, 0x4881d05); /* 44 */
	HH (a, b, c, d, x[ 9], S31, 0xd9d4d039); /* 45 */
	HH (d, a, b, c, x[12], S32, 0xe6db99e5); /* 46 */
	HH (c, d, a, b, x[15], S33, 0x1fa27cf8); /* 47 */
	HH (b, c, d, a, x[ 2], S34, 0xc4ac5665); /* 48 */

	/* Round 4 */
	II (a, b, c, d, x[ 0], S41, 0xf4292244); /* 49 */
	II (d, a, b, c, x[ 7], S42, 0x432aff97); /* 50 */
	II (c, d, a, b, x[14], S43, 0xab9423a7); /* 51 */
	II (b, c, d, a, x[ 5], S44, 0xfc93a039); /* 52 */
	II (a, b, c, d, x[12], S41, 0x655b59c3); /* 53 */
	II (d, a, b, c, x[ 3], S42, 0x8f0ccc92); /* 54 */
	II (c, d, a, b, x[10], S43, 0xffeff47d); /* 55 */
	II (b, c, d, a, x[ 1], S44, 0x85845dd1); /* 56 */
	II (a, b, c, d, x[ 8], S41, 0x6fa87e4f); /* 57 */
	II (d, a, b, c, x[15], S42, 0xfe2ce6e0); /* 58 */
	II (c, d, a, b, x[ 6], S43, 0xa3014314); /* 59 */
	II (b, c, d, a, x[13], S44, 0x4e0811a1); /* 60 */
	II (a, b, c, d, x[ 4], S41, 0xf7537e82); /* 61 */
	II (d, a, b, c, x[11], S42, 0xbd3af235); /* 62 */
	II (c, d, a, b, x[ 2], S43, 0x2ad7d2bb); /* 63 */
	II (b, c, d, a, x[ 9], S44, 0xeb86d391); /* 64 */

	state[0] += a;
	state[1] += b;
	state[2] += c;
	state[3] += d;

	/* Zeroize sensitive information. */
	std::memset(x, 0, sizeof(x));
}


void MD5Engine::encode(unsigned char* output, const UInt32* input, std::size_t len)
{
	unsigned int i, j;

	for (i = 0, j = 0; j < len; i++, j += 4) 
	{
		output[j]   = (unsigned char)(input[i] & 0xff);
		output[j+1] = (unsigned char)((input[i] >> 8) & 0xff);
		output[j+2] = (unsigned char)((input[i] >> 16) & 0xff);
		output[j+3] = (unsigned char)((input[i] >> 24) & 0xff);
	}
}


void MD5Engine::decode(UInt32* output, const unsigned char* input, std::size_t len)
{
	unsigned int i, j;

	for (i = 0, j = 0; j < len; i++, j += 4)
		output[i] = ((UInt32)input[j]) | (((UInt32)input[j+1]) << 8) |
		            (((UInt32)input[j+2]) << 16) | (((UInt32)input[j+3]) << 24);
}


} // namespace Poco

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #123963** (2026-10-05): **GraphiteMergeTree: part minmax index is built from the rows before the insert-time rollup, so queries on the time column silently skip the part**
  *Symptoms*: **TL;DR:** With `optimize_on_insert` (the default), an `INSERT` into a `GraphiteMergeTree` computes the part's minmax index from the rows *before* the insert-time rollup rewrites `Time` downward, so the written part's minmax range excludes the rows the part actually stores. Read-time partition pruning by the part minmax index (`use_partition_pruning = 1`, the default) then skips the part: a query filtering on `Time` at the rolled-up timestamps silently returns no rows.  ### Describe what's wrong  1. `MergeTreeDataWriter::writeTempPartImpl` updates the part minmax index before the insert-time merge (`minmax_idx->update(block, ...)` at `src/Storages/MergeTree/MergeTreeDataWriter.cpp:807`, `mergeBlock` at line 902) and never refreshes it from the merged rows (`setMinMaxIndex` at line 1042). The Graphite rollup floors `Time` to the matching retention precision (`roundTimeToPrecision`, `src/Processors/Merges/Algorithms/GraphiteRollupSortedAlgorithm.cpp:102`), so with a partition key over `Time` the stored rows fall below the recorded minimum. 2. The reproduction below stores a single row with `Time = 2026-01-01 00:00:00`, but `system.parts` records `min_time = 00:05:07`, `max_time = 00:07:07`. `SELECT count() FROM g WHERE Time = '2026-01-01 00:00:00'` returns 0 instead of 1; the same query with `use_partition_pruning = 0` returns 1, isolating the stale part minmax (partition pruning) as the mechanism. 3. Background merges are not affected: `MergeTask` recomputes minmax from the ou

- **Issue #123510** (2026-10-03): **Iceberg: a position-delete file without a `pos` column gives `LOGICAL_ERROR: Could not find column pos in chunk`**
  *Symptoms*: If a position-delete file of an Iceberg table has no column named `pos`, every scan of the table fails with `LOGICAL_ERROR`, and debug/sanitizer builds abort. The input is corrupt or written outside the spec, so this should be an ordinary data error.  ``` Code: 49. DB::Exception: Could not find column pos in chunk: While executing ReadFromObjectStorage. (LOGICAL_ERROR) ```  ``` 5. src/Storages/ObjectStorage/DataLakes/Iceberg/PositionDeleteTransform.cpp:146: IcebergPositionDeleteTransform::getColumnIndex(...) 6. src/Storages/ObjectStorage/DataLakes/Iceberg/PositionDeleteTransform.cpp:234: IcebergStreamingPositionDeleteTransform::initialize() 7. src/Storages/ObjectStorage/DataLakes/Iceberg/PositionDeleteTransform.h:110: IcebergStreamingPositionDeleteTransform::IcebergStreamingPositionDeleteTransform(...) 9. IcebergDataObjectInfo::getPositionDeleteTransformer(...) 10. src/Storages/ObjectStorage/DataLakes/Iceberg/IcebergMetadata.cpp:1495 ```  `getColumnIndex` looks the column up by name in the header of the delete file and throws `LOGICAL_ERROR` when the name is absent. The same lookup is in `IcebergBitmapPositionDeleteTransform::initialize` (line 210), which is used when the data file also has a deletion vector.  A missing `file_path` column already gives an ordinary error, because the pushed-down `file_path = ...` filter fails first: `UNKNOWN_IDENTIFIER: Missing columns: 'file_path' ... maybe you meant: 'file_patx'`. Only `pos` reaches the `LOGICAL_ERROR`.  `count()` alone is n
  **Post-Mortem & Fix Analysis**:
  > @groeneai you have to fix and I have to review the PR
  > Acknowledged. I am working on a fix for both `pos` lookups (`IcebergPositionDeleteTransform::getColumnIndex` and the bitmap path in `IcebergBitmapPositionDeleteTransform::initialize`); I will follow up here with the PR for your review.
  > The fix is in https://github.com/ClickHouse/ClickHouse/pull/123583: a position delete file without `pos` or `file_path` now fails with `ICEBERG_SPECIFICATION_VIOLATION` naming the file and the missing column, on both the streaming and the roaring bitmap path. I requested your review there.

- **Issue #123450** (2026-10-02): **A 569-byte ORC file read from object storage aborts the server (libc++ hardening, `orc::extractReadRangesForStripe`)**
  *Symptoms*: 🕵️ Reading the ORC file below through any object-storage path (`s3`, `paimon*`, `iceberg*`, ...) terminates the whole server process, on release builds as well:  ``` contrib/llvm-project/libcxx/include/__vector/vector_bool.h:302: libc++ Hardening assertion __n < size() failed: vector<bool>::operator[] index out of bounds ```  ``` orc::extractReadRangesForStripe         contrib/orc/c++/src/Reader.cc:295 orc::ReaderImpl::preBufferRange         contrib/orc/c++/src/Reader.cc:1835 orc::ReaderImpl::preBuffer              contrib/orc/c++/src/Reader.cc:1845 DB::NativeORCBlockInputFormat::prefetchStripes     src/Processors/Formats/Impl/NativeORCBlockInputFormat.cpp:1335 DB::NativeORCBlockInputFormat::prepareFileReader   NativeORCBlockInputFormat.cpp:1315 ```  The file is a valid Spark/Paimon-written ORC file with **one byte changed** (offset 203, `0x04` -> `0x14`, inside a stripe footer). The stripe prefetch only runs for remote filesystems (`use_prefetch` requires `is_remote_fs`, `NativeORCBlockInputFormat.cpp:3124`), so `file()` on the same bytes returns a normal result and the crash needs `s3()` or a lake table function. Any user who can make ClickHouse read an untrusted ORC object can kill the server.  ### Does it reproduce on the most recent release?  Reproduced on master 26.10.1.1149 (`4e72b6503bb`), RelWithDebInfo and Debug: `clickhouse local` and a running server both abort.  ### How to reproduce  ```bash base64 -d > orc_prebuffer_oob.orc <<'B64' T1JDEQAACgYSBAgBUAArAAAKEwoDA

- **Issue #123308** (2026-10-03): **Custom Executable UDF - Unknown element 'functions' found in config  UNKNOWN_ELEMENT_IN_CONFIG**
  *Symptoms*: ### Company or project name  _No response_  ### Describe what's wrong  Beta functionality that was previously working on ClickHouse version 26.3.3.20 is now broken on 26.8.11.7. The configuration we had added to enable custom functions:  In `chop-generated-settings.xml` `<user_defined_executable_functions_config>config.d/*_function.xml</user_defined_executable_functions_config>`  In functions file `/etc/clickhouse-server/config.d/udf_function.xml` ``` <clickhouse>   <function>     <type>executable_pool</type>     <name>extract_all_values</name>     <return_type>Array(String)</return_type>     <return_name>result_name</return_name>     <argument>       <name>list</name>       <type>String</type>     </argument>     <format>JSONEachRow</format>     <command>extract_all_values_into_array.py</command>     <command_read_timeout>600000</command_read_timeout>     <command_write_timeout>600000</command_write_timeout>     <max_command_execution_time>600000</max_command_execution_time>   </function>   <function>     <type>executable_pool</type>     <name>convert_to_valid_json_hex</name>     <return_type>Array(JSON)</return_type>     <return_name>json_decoded</return_name>     <argument>       <name>json_string</name>       <type>String</type>     </argument>     <format>JSONEachRow</format>     <command>convert_to_valid_json_hex.py</command>     <command_read_timeout>10000</command_read_timeout>     <command_write_timeout>10000</command_write_timeout>     <max_command_execution_time>10
  **Post-Mortem & Fix Analysis**:
  > The fix for this seems trivial, @groeneai can you do it? I can try to review
  > Acknowledged. I'm investigating the `UNKNOWN_ELEMENT_IN_CONFIG` startup failure for executable UDF definitions merged from `config.d`; I'll follow up here with a PR (or my findings) shortly.
  > I opened https://github.com/ClickHouse/ClickHouse/pull/123586. It adds `function`, `functions` and `driver` to the config sections the unknown-element check accepts (next to `dictionary`, which was already allowed for the same placement), so definition files placed in `config.d` no longer stop the server.  With the fix, your original shape (`<function>` elements directly under `<clickhouse>`) starts and loads the functions. The `<clickhouse><functions><function>` wrapper is not a shape the XML loader reads (the server starts, but that file's functions are not loaded), so keep the original one. 

- **Issue #123274** (2026-10-02): **Parquet page with a short `compressed_page_size` makes the reader spin forever, ignoring `max_execution_time`**
  *Symptoms*: 🕵️  ### Describe what's wrong  If a page's compressed data ends before the decompressor has produced `uncompressed_page_size` bytes, the native Parquet reader loops forever at 100% CPU. The query can't be stopped: `max_execution_time` doesn't fire and the loop has no cancellation check, so it also ignores `KILL QUERY`.  `Parquet::decompress` (`src/Processors/Formats/Impl/Parquet/Reader.cpp`, ~line 200):  ```cpp size_t pos = 0; while (pos < uncompressed_size) {     decompressor->set(out + pos, uncompressed_size - pos);     decompressor->next();                 // return value ignored     size_t n = decompressor->available(); // 0 once the input is exhausted     pos += n;                             // never advances -> infinite loop } ```  The stack is `DB::ZstdInflatingReadBuffer::nextImpl` <- `DB::Parquet::decompress` <- `Reader::decodeDictionaryPageImpl` <- `ReadManager::runTask`. Every codec routed through `wrapReadBufferWithCompressionMethod` (ZSTD, GZIP, BROTLI) is affected; SNAPPY and LZ4 are special-cased.  ### Does it reproduce on the most recent release?  Master 26.10.1.1149 (`4e72b6503bb`), RelWithDebInfo and Debug.  ### How to reproduce  A 512-byte file: one string column, zstd, dictionary-encoded, written by pyarrow, with the dictionary page header's `compressed_page_size` decremented by one (82 -> 81):  ```python import pyarrow as pa, pyarrow.parquet as pq pq.write_table(pa.table({"s": [f"v{i % 20}" for i in range(200)]}), "ok.parquet",                compressio
  **Post-Mortem & Fix Analysis**:
  > Acknowledged. I'm investigating the `Parquet::decompress` loop that ignores the result of `next()` on a short compressed page; I'll follow up here with a PR (or my findings) shortly.
  > I opened https://github.com/ClickHouse/ClickHouse/pull/123298 with the fix (throw `INCORRECT_DATA` when `next()` returns false) and a test with truncated ZSTD and over-declared Brotli pages. Data pages hit the same loop and are covered too.

- **Issue #122744** (2026-10-06): **Dropping a replica makes a concurrent mutation abort with "Part ... has empty header and does not have columns and checksums"**
  *Symptoms*: ## Describe what's wrong  With `use_minimalistic_part_header_in_zookeeper = 0`, a part's ZooKeeper node `/replicas/<r>/parts/<part>` is an empty node with two children, `columns` and `checksums`. `StorageReplicatedMergeTree::dropReplica` deletes that subtree in a way that leaves the part node behind for a moment with both children already gone, and a concurrent `checkPartChecksumsAndAddCommitOps` on another replica treats exactly that state as impossible and throws `LOGICAL_ERROR`, which aborts a debug or sanitizer build.  ## Does it reproduce on the most recent release?  Observed on `master` (26.10) in CI. The default `use_minimalistic_part_header_in_zookeeper = 1` hides it, because then the part node is a leaf.  ## How to reproduce  `02962_system_sync_replica_lightweight_from_modifier` with `--use_minimalistic_part_header_in_zookeeper 0`. The test runs inserts, mutations and `DROP TABLE` of seven replicas of the same table concurrently, which is the collision this needs.  ## Error message and/or stacktrace  ``` Logical error: 'Part /clickhouse/tables/.../test_table/replicas/2/parts/all_0_54_25_58 has empty header and does not have columns and checksums. Looks like a bug.'.  src/Storages/StorageReplicatedMergeTree.cpp:2316: DB::StorageReplicatedMergeTree::checkPartChecksumsAndAddCommitOps(...) src/Storages/StorageReplicatedMergeTree.cpp:2384: DB::StorageReplicatedMergeTree::getOpsToCheckPartChecksumsAndCommit(...) src/Storages/StorageReplicatedMergeTree.cpp:2436: DB::Storage
  **Post-Mortem & Fix Analysis**:
  > @groeneai the fix seems small
  > Acknowledged. I'm working on a fix for the window in which `dropReplica` leaves a part node without `columns`/`checksums`; I'll follow up here with a PR (or my findings) shortly.
  > The fix is in #122790. `dropReplica` now removes each old-format part node in one request together with its `columns` and `checksums`. The CI run went through the generic recursive removal (the table had the setting at 0 when it was dropped), not the `probably_flat` fallback, so both paths are changed. The `LOGICAL_ERROR` check itself is unchanged. 

- **Issue #122687** (2026-09-30): **Query sometimes fails at planning time with `CANNOT_READ_ALL_DATA` when its table has an active Wide part**
  *Symptoms*: ### Company or project name  https://noemata.sh, Observability based on ClickHouse.  ### Describe what's wrong  [empty_part_subcolumn_size.sql](https://github.com/user-attachments/files/32754388/empty_part_subcolumn_size.sql)  A query fails at planning time with `CANNOT_READ_ALL_DATA` when its table has an active Wide part with 0 rows and the query reads a subcolumn whose serialization has a prefix (for example a `Map(LowCardinality(String), String)` key subcolumn, a LowCardinality Tuple element, a JSON path, or a Variant subcolumn) and has a `WHERE` clause.  ClickHouse creates such parts itself. A TTL drop of an expired part (`TTLDropMerge`, with or without `ttl_only_drop_parts`) and a mutation that deletes every row of a part both leave an active part with `rows = 0`. Its column `.bin` files are 0 bytes. The part stays active until the cleanup thread removes it. In production we see bursts of failures in the minute or two after each TTL drop, several times a day, on OpenTelemetry tables with `Map(LowCardinality(String), String)` attribute columns.  The query plan optimization `optimizePrewhere` calls `MergeTreeData::getColumnSizes`, which calls `IMergeTreeDataPart::getSubcolumnSize` for every active part. For a Wide part, `MergeTreeDataPartWide::calculateSubcolumnSize` calls `getListOfStreamsForColumn`, which creates a reader and deserializes the column's serialization prefixes. The empty part has no prefix to read, so `SerializationLowCardinality::deserializeBinaryBulkStat
  **Post-Mortem & Fix Analysis**:
  > @groeneai can you fix this? The fix seems to be one line at `MergeTreeDataPartWide::calculateSubcolumnSize`
  > Acknowledged. I'm investigating the 0-row Wide part case in `MergeTreeDataPartWide::calculateSubcolumnSize`; I'll follow up here with a PR (or my findings) shortly.
  > I opened https://github.com/ClickHouse/ClickHouse/pull/122756 with the one-line fix: `MergeTreeDataPartWide::calculateSubcolumnSize` now also returns the empty size for a part without rows. Its test covers both planning routes that still reach this on master: the default path when only Compact parts are left after pruning, and automatic parallel replicas. 

- **Issue #122511** (2026-09-28): **Join reordering without column statistics moves a join ahead of the tables its key depends on: near cross product, 15 ms to 3.8 s**
  *Symptoms*: Join reordering (`query_plan_optimize_join_order_limit=10`) moves a join ahead of a table its key expression depends on when the tables have no column statistics. That join then keeps only a low-cardinality equi-key and becomes a near cross product: 15 ms becomes 3.8 s on master, and 12 ms becomes 5.5 s on 26.6.1.2246.  ### Description  The query joins a small paged CTE `a2` to a link table `a3` (ON condition with an OR of two key alternatives), then joins `a4` on a key expression that uses columns of both `a2` and `a3` (`a4.c1 = if(a2.c7 = 1, a3.c2, a3.c3)`). With join reordering on, `a4` is joined before one of the tables its key expression depends on. That join's only usable equi-key is then the low-cardinality `c2` column (one distinct value here), and the next join (the OR condition) is keyed on the same column. Both become near-cartesian products that are filtered afterwards. With `query_plan_optimize_join_order_limit=0` the query keeps the written order.  The bad order is chosen only when the tables have no column statistics. On master, tables created at stock defaults get `auto_statistics_types = 'basic, uniq_v2'` statistics and the query is fast. Tables created while an older `compatibility` is pinned in the user's profile get `auto_statistics_types = ''` and no statistics, and the query is slow. This is the normal state on ClickHouse Cloud, where the default profile pins the service's `compatibility`, and it also applies to tables created before the new default. Set
  **Post-Mortem & Fix Analysis**:
  > @groeneai fix it
  > Acknowledged. I'm investigating why join reordering places the `a4` join ahead of a table its key expression `if(a2.c7 = 1, a3.c2, a3.c3)` depends on; I'll follow up here with a PR (or my findings) shortly.
  > I opened #122554. The join order cost model estimated the keyed `OR` in `a3`'s `JOIN ON` as a cross product, so `a4` was joined first on the one-valued `a4.c2 = a3.c1`, and the next join, holding that `OR` plus `a4.c1 = if(...)`, fell back to a cross join. The PR estimates such an `OR` from its branch equalities where the hash join runs on them, and plans the `OR` plus other conditions as one hash clause per branch. On the reproducer (debug build), `use_statistics = 0` goes from 20.2 s to 0.015 s and `compatibility = '25.10'`, `query_plan_optimize_join_order_limit = 10`, `use_statistics = 0` from 9.9 s to 0.013 s, with the same results. 

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

### Incident Patch 1: `22a3449b` (2026-10-07)
**Commit Message**: Merge pull request #122452 from groeneai/fix-122403-runtime-filter-prewhere-order

Order join runtime filters after the other PREWHERE conditions when there are no statistics

**File**: `src/Storages/MergeTree/MergeTreeWhereOptimizer.cpp` (modified, +25/-0)
```diff
@@ -331,6 +331,27 @@ static bool isConditionGood(const RPNBuilderTreeNode & condition, const NameSet
     return false;
 }
 
+/// A join runtime filter, alone or in the `OR isNull(key)` that an ANTI join adds.
+static bool isJoinRuntimeFilter(const RPNBuilderTreeNode & node)
+{
+    auto function_node = node.toFunctionNodeOrNull();
+    if (!function_node)
+        return false;
+
+    const auto function_name = function_node->getFunctionName();
+    if (function_name == "__applyFilter")
+        return true;
+
+    if (function_name == "or")
+    {
+        for (size_t i = 0; i < function_node->getArgumentsSize(); ++i)
+            if (isJoinRuntimeFilter(function_node->getArgumentAt(i)))
+                return true;
+    }
+
+    return false;
+}
+
 static void collectConjuncts(const RPNBuilderTreeNode & node, std::vector<RPNBuilderTreeNode> & conjuncts)
 {
     auto fn = node.toFunctionNodeOrNull();
@@ -479,6 +500,7 @@ void MergeTreeWhereOptimizer::analyzeImpl(Conditions & res, const RPNBuilderTree
             NameSet group_columns;
             bool group_may_use_primary_index = true;
             bool group_good = false;
+            bool group_is_runtime_filter = true;
 
             for (size_t idx : group.indices)
             {
@@ -487,13 +509,15 @@ void MergeTreeWhereOptimizer::analyzeImpl(Conditions & res, const RPNBuilderTree
                 group_may_use_primary_index = group_may_use_primary_index && infos[idx].may_use_primary_index;
                 if (!where_optimizer_context.use_statistics && !where_optimizer_context.move_primary_key_columns_to_end_of_prewhere)
                     group_good = group_good || isConditionGood(infos[idx].node, table_columns);
+                group_is_runtime_filter = group_is_runtime_filter && isJoinRuntimeFilter(infos[idx].node);
             }
 
             Condition cond(std::move(group_nodes));
             cond.table_columns = group_columns;
             cond.columns_size = getColumnsSize(group_columns);
             cond.viable = true;
             cond.good = group_good;
+            cond.is_runtime_filter = group_is_runtime_filter;
 
             if (where_optimizer_context.use_statistics)
             {
@@ -553,6 +577,7 @@ MergeTreeWhereOptimizer::Conditions MergeTreeWhereOptimizer::analyze(const RPNBu
             cond.table_columns = columns;
             cond.columns_size = getColumnsSize(columns);
             cond.bytes_per_rejected_row = static_cast<double>(cond.columns_size);
+            cond.is_runtime_filter = isJoinRuntimeFilter(conjunct);
             cond.viable =
                 !has_invalid_column
                 && !columns.empty()
```

**File**: `src/Storages/MergeTree/MergeTreeWhereOptimizer.h` (modified, +7/-2)
```diff
@@ -84,6 +84,9 @@ class MergeTreeWhereOptimizer : private boost::noncopyable
         /// hence a column of unknown size is charged an estimated per-row size, never a row count.
         double bytes_per_rejected_row = 0;
 
+        /// Every conjunct is a join runtime filter, which is estimated to pass every row.
+        bool is_runtime_filter = false;
+
         /// Does the condition contain primary key column?
         /// If so, it is better to move it further to the end of PREWHERE chain depending on minimal position in PK of any
         /// column in this condition because this condition have bigger chances to be already satisfied by PK analysis.
@@ -101,20 +104,22 @@ class MergeTreeWhereOptimizer : private boost::noncopyable
             }
             return fmt::format(
                 "Condition(exp:{} viable: {}, good: {}, min_position_in_primary_key: {}, estimated_row_count: {}, "
-                "columns_size: {}, bytes_per_rejected_row: {}, table_columns.size: {})",
+                "columns_size: {}, is_runtime_filter: {}, bytes_per_rejected_row: {}, table_columns.size: {})",
                 names,
                 viable,
                 good,
                 min_position_in_primary_key,
                 estimated_row_count,
                 columns_size,
+                is_runtime_filter,
                 bytes_per_rejected_row,
                 table_columns.size());
         }
 
         auto tuple() const
         {
-            return std::make_tuple(!viable, !good, -min_position_in_primary_key, bytes_per_rejected_row, table_columns.size());
+            return std::make_tuple(
+                !viable, !good, -min_position_in_primary_key, is_runtime_filter, bytes_per_rejected_row, table_columns.size());
         }
 
         /// Is condition a better candidate for moving to PREWHERE?
```

**File**: `tests/queries/0_stateless/05267_join_runtime_filter_prewhere_order_without_statistics.reference` (added, +15/-0)
```diff
@@ -0,0 +1,15 @@
+15B16CF1AA29A55A67EEEB7DC6E5F686	2026-08-07 08:47:00	727	767
+2EA6241CF767C279CF1E80A790DF1885	2026-08-09 16:32:00	72	98
+3147DA8AB4A0437C15EF51A5CC7F2DC4	2026-08-08 12:04:00	244	652
+66705064B387572428517E38AE23E019	2026-08-09 16:32:00	672	446
+6E4621AF9A4DA94A7C85D7ECD19B1271	2026-08-09 11:03:00	983	699
+7AB6ACC5BBF252028D5FFA1B92E6BEB1	2026-08-08 20:04:00	724	100
+7CD11CB8EAEA5E557DD3C47454690632	2026-08-07 08:35:00	235	92
+89F03F7D02720160F1B04CF5B27F5CCB	2026-08-08 12:04:00	644	304
+8AF95FE2AB1A54B488EF8EFB3F3B0797	2026-08-07 09:40:00	900	52
+9465CE9A7904BA9FA5A354804734CBC4	2026-08-08 20:04:00	124	529
+95D8F6FF68222377D570A652EB96F082	2026-08-07 08:47:00	327	338
+CA22348465708ADE49CC72519C0BF212	2026-08-07 08:35:00	635	521
+EC04E8EBBA7E132043E5B4832E54F070	2026-08-09 11:03:00	583	270
+0
+Ok
```

**File**: `tests/queries/0_stateless/05267_join_runtime_filter_prewhere_order_without_statistics.sql` (added, +58/-0)
```diff
@@ -0,0 +1,58 @@
+-- Tags: no-openssl-fips
+-- no-openssl-fips: `MD5`
+
+-- Enabling join runtime filters must not make a query read more than it reads without them: the runtime filter
+-- runs after the query's own PREWHERE conditions also when the table has no statistics (#122403).
+
+SET session_timezone = 'UTC';
+SET enable_parallel_replicas = 0, automatic_parallel_replicas_mode = 0;
+SET query_plan_join_swap_table = 'false', query_plan_optimize_join_order_randomize = 0, join_runtime_filter_min_probe_rows = 0;
+SET enable_join_runtime_filters_index_analysis = 0, use_query_condition_cache = 0;
+SET optimize_move_to_prewhere = 1, query_plan_optimize_prewhere = 1, allow_reorder_prewhere_conditions = 1, enable_multiple_prewhere_read_steps = 1;
+
+DROP TABLE IF EXISTS t41;
+DROP TABLE IF EXISTS t42;
+
+-- No statistics, so PREWHERE conditions are ordered by their size on disk, where the sorted `c1` is smaller than `time`.
+CREATE TABLE t41 (`time` DateTime, `c1` String, `s1` AggregateFunction(avg, Decimal(15, 4)), `s2` AggregateFunction(avg, Decimal(15, 4)))
+ENGINE = AggregatingMergeTree ORDER BY (c1, time)
+SETTINGS min_bytes_for_wide_part = 0, auto_statistics_types = '', index_granularity = 8192, index_granularity_bytes = 10485760;
+INSERT INTO t41 SELECT toDateTime('2026-01-01 00:00:00') + 60 * ((number * 2654435761) % 525600) AS time, hex(MD5(toString(number % 25000))) AS c1, arrayReduce('avgState', [CAST(number % 1000 AS Decimal(15, 4))]), arrayReduce('avgState', [CAST(number % 777 AS Decimal(15, 4))]) FROM numbers(1000000);
+CREATE TABLE t42 (`m` DateTime, `c1` String) ENGINE = MergeTree ORDER BY c1;
+INSERT INTO t42 SELECT time, c1 FROM t41 WHERE time IN ('2026-08-07 08:35:00', '2026-08-07 08:47:00', '2026-08-07 09:40:00', '2026-08-08 12:04:00', '2026-08-08 20:04:00', '2026-08-09 11:03:00', '2026-08-09 16:32:00');
+
+-- The reporter's two queries: the limit is met without runtime filters ...
+SELECT a.c1, b.m, avgMerge(a.s1), avgMerge(a.s2) FROM t41 AS a INNER JOIN t42 AS b ON (a.time = b.m) AND (a.c1 = b.c1) WHERE a.time IN ('2026-08-07 08:35:00', '2026-08-07 08:47:00', '2026-08-07 09:40:00', '2026-08-08 12:04:00', '2026-08-08 20:04:00', '2026-08-09 11:03:00', '2026-08-09 16:32:00') GROUP BY a.c1, b.m ORDER BY a.c1, b.m
+SETTINGS join_algorithm = 'grace_hash', max_bytes_to_read = '22500000', enable_join_runtime_filters = 0, log_comment = 'rf_off' FORMAT Null;
+-- ... and with them.
+SELECT a.c1, b.m, avgMerge(a.s1), avgMerge(a.s2) FROM t41 AS a INNER JOIN t42 AS b ON (a.time = b.m) AND (a.c1 = b.c1) WHERE a.time IN ('2026-08-07 08:35:00', '2026-08-07 08:47:00', '2026-08-07 09:40:00', '2026-08-08 12:04:00', '2026-08-08 20:04:00', '2026-08-09 11:03:00', '2026-08-09 16:32:00') GROUP BY a.c1, b.m ORDER BY a.c1, b.m
+SETTINGS join_algorithm = 'grace_hash', max_bytes_to_read = '22500000', enable_join_runtime_filters = 1, log_comment = 'rf_on';
+
+-- With reordering disabled, the runtime filter must not be the one condition moved to PREWHERE.
+SELECT a.c1, b.m, avgMerge(a.s1), avgMerge(a.s2) FROM t41 AS a INNER JOIN t42 AS b ON (a.time = b.m) AND (a.c1 = b.c1) WHERE a.time IN ('2026-08-07 08:35:00', '2026-08-07 08:47:00', '2026-08-07 09:40:00', '2026-08-08 12:04:00', '2026-08-08 20:04:00', '2026-08-09 11:03:00', '2026-08-09 16:32:00') GROUP BY a.c1, b.m ORDER BY a.c1, b.m
+SETTINGS join_algorithm = 'grace_hash', max_bytes_to_read = '22500000', enable_join_runtime_filters = 1, allow_reorder_prewhere_conditions = 0, move_all_conditions_to_prewhere = 0, log_comment = 'rf_c' FORMAT Null;
+
+-- LEFT ANTI JOIN on a Nullable key, whose runtime filter also passes NULL keys.
+SELECT count() FROM t41 AS a LEFT ANTI JOIN t42 AS b ON toNullable(a.c1) = b.c1 WHERE a.time IN ('2026-08-07 08:35:00', '2026-08-07 08:47:00', '2026-08-07 09:40:00', '2026-08-08 12:04:00', '2026-08-08 20:04:00', '2026-08-09 11:03:00', '2026-08-09 16:32:00')
+SETTINGS join_algorithm = 'hash', max_bytes_to_read = '22500000', enable_join_runtime_filters = 1, log_comment = 'rf_d';
+
+SYSTEM FLUSH LOGS query_log;
+-- Every query that enables runtime filters must have checked rows with them, and the one that disables them must not.
+SELECT if(countIf(log_comment = 'rf_off') = 1 AND countIf(log_comment = 'rf_on') = 1
+        AND countIf(log_comment = 'rf_c') = 1 AND countIf(log_comment = 'rf_d') = 1
+        AND maxIf(read_bytes, log_comment = 'rf_on') <= maxIf(read_bytes, log_comment = 'rf_off') * 1.1
+        AND maxIf(ProfileEvents['RuntimeFilterRowsChecked'], log_comment = 'rf_off') = 0
+        AND minIf(ProfileEvents['RuntimeFilterRowsChecked'], log_comment IN ('rf_on', 'rf_c', 'rf_d')) > 0,
+    'Ok',
+    format('read_bytes with runtime filters {}, without {}; RuntimeFilterRowsChecked off {}, on {}, arm C {}, arm D {}',
+        maxIf(read_bytes, log_comment = 'rf_on'), maxIf(read_bytes, log_comment = 'rf_off'),
+        maxIf(ProfileEvents['RuntimeFilterRowsChecked'], log_comment = 'rf_off'),
+        maxIf(ProfileEvents['RuntimeFilterRowsC
```

---

### Incident Patch 2: `8710ea80` (2026-10-07)
**Commit Message**: Merge pull request #114865 from artbeglaryan/fix-inverse-dict-lookup-single-key-tuple

Fix `optimize_inverse_dictionary_lookup` for single-column complex keys wrapped in `tuple`

**File**: `src/Analyzer/Passes/FuseFunctionsPass.cpp` (modified, +1/-17)
```diff
@@ -7,14 +7,13 @@
 #include <DataTypes/DataTypeArray.h>
 #include <DataTypes/DataTypeTuple.h>
 
-#include <Functions/FunctionFactory.h>
-
 #include <AggregateFunctions/AggregateFunctionFactory.h>
 #include <AggregateFunctions/IAggregateFunction.h>
 
 #include <Analyzer/InDepthQueryTreeVisitor.h>
 #include <Analyzer/ConstantNode.h>
 #include <Analyzer/FunctionNode.h>
+#include <Analyzer/Utils.h>
 #include <Analyzer/HashUtils.h>
 #include <Analyzer/ColumnNode.h>
 #include <Analyzer/TableNode.h>
@@ -146,16 +145,6 @@ class FuseFunctionsVisitor : public InDepthQueryTreeVisitorWithContext<FuseFunct
     std::unordered_set<String> names_to_collect;
 };
 
-QueryTreeNodePtr createResolvedFunction(const ContextPtr & context, const String & name, QueryTreeNodes arguments)
-{
-    auto function_node = std::make_shared<FunctionNode>(name);
-
-    auto function = FunctionFactory::instance().get(name, context);
-    function_node->getArguments().getNodes() = std::move(arguments);
-    function_node->resolveAsFunction(function->build(function_node->getArgumentColumns()));
-    return function_node;
-}
-
 FunctionNodePtr createResolvedAggregateFunction(
     const String & name, const QueryTreeNodePtr & argument, const Array & parameters = {})
 {
@@ -177,11 +166,6 @@ FunctionNodePtr createResolvedAggregateFunction(
     return function_node;
 }
 
-QueryTreeNodePtr createTupleElementFunction(const ContextPtr & context, QueryTreeNodePtr argument, UInt64 index)
-{
-    return createResolvedFunction(context, "tupleElement", {argument, std::make_shared<ConstantNode>(index)});
-}
-
 QueryTreeNodePtr createArrayElementFunction(const ContextPtr & context, QueryTreeNodePtr argument, UInt64 index)
 {
     return createResolvedFunction(context, "arrayElement", {argument, std::make_shared<ConstantNode>(index)});
```

**File**: `src/Analyzer/Passes/InverseDictionaryLookupPass.cpp` (modified, +240/-3)
```diff
@@ -1,3 +1,5 @@
+#include <algorithm>
+#include <cmath>
 #include <optional>
 
 #include <Analyzer/ColumnNode.h>
@@ -15,7 +17,9 @@
 
 #include <DataTypes/DataTypeLowCardinality.h>
 #include <DataTypes/DataTypeNullable.h>
+#include <DataTypes/DataTypeString.h>
 #include <DataTypes/DataTypeTuple.h>
+#include <DataTypes/DataTypesNumber.h>
 #include <DataTypes/getLeastSupertype.h>
 
 #include <Functions/FunctionFactory.h>
@@ -169,6 +173,194 @@ bool keyTypeBreaksInverseLookupEquivalence(const IDataType & key_type)
     return anyInTypeTree(key_type, [](const IDataType & nested) { return isVariant(nested); });
 }
 
+/// Check whether `dictGet` accepts this key expression shape for the dictionary's key columns.
+/// It mirrors what `dictGet` does with its third argument: the outer `Nullable` is stripped
+/// (`columnGetNested`), a `Tuple` supplies one lookup column per element, and a non-tuple
+/// expression is the bare form that only a single key column accepts. `IDictionary::convertKeyColumns`
+/// then rejects any other shape - but it does so when the query executes, not when it is
+/// analyzed, so a mismatched probe reaches this pass. Rewriting it would replace the
+/// `TYPE_MISMATCH` (or `ILLEGAL_TYPE_OF_ARGUMENT`) that `dictGet` throws with a result, so the
+/// caller skips the rewrite entirely and leaves such a query unoptimized.
+bool keyExpressionMatchesDictionaryStructure(
+    const QueryTreeNodePtr & key_expr_node, const DictionaryStructure & dict_structure)
+{
+    const DataTypePtr key_expr_type = removeNullable(key_expr_node->getResultType());
+    const auto * key_expr_tuple_type = typeid_cast<const DataTypeTuple *>(key_expr_type.get());
+
+    /// A simple-key dictionary takes the key value itself; `convertKeyColumns` cannot cast a
+    /// `Tuple` to the key type. Complex keys accept the tuple form with one element per key
+    /// column, and the bare form only when there is a single key column.
+    if (!dict_structure.key)
+        return !key_expr_tuple_type;
+
+    if (key_expr_tuple_type)
+        return key_expr_tuple_type->getElements().size() == dict_structure.key->size();
+
+    return dict_structure.key->size() == 1;
+}
+
+/// A complex-key dictionary with a single key column accepts both the bare key expression
+/// (`dictGet(..., k)`) and its one-element tuple wrapper (`dictGet(..., tuple(k))`). The
+/// rewrites compare the key expression with bare key values: scalar constants produced by
+/// `dictGetKeys` or a single-column `SELECT` from `dictionary(...)`. Unwrap the tuple,
+/// otherwise the rewrite pits `Tuple(T)` against `T` and fails with `ILLEGAL_TYPE_OF_ARGUMENT`.
+/// The tuple can also be `Nullable` (e.g. produced by `if(cond, tuple(k), NULL)`):
+/// `tupleElement` propagates the `NULL` to the extracted element, and a `NULL` key behaves
+/// the same on both sides of the rewrite (`dictGet` returns `NULL`, so the comparison is
+/// `NULL`; `NULL IN (...)` is `NULL` as well).
+/// Simple-key dictionaries are intentionally not affected: for them `dictGet` rejects the
+/// tuple form even without this optimization.
+void unwrapSingleColumnTupleKey(QueryTreeNodePtr & key_expr_node, const ContextPtr & context)
+{
+    const DataTypePtr key_expr_type = removeNullable(key_expr_node->getResultType());
+    const auto * key_expr_tuple_type = typeid_cast<const DataTypeTuple *>(key_expr_type.get());
+    if (!key_expr_tuple_type)
+        return;
+
+    chassert(key_expr_tuple_type->getElements().size() == 1);
+
+    /// Unwrap a syntactic `tuple(k)` expression to `k`. `tuple` produces one element per argument
+    /// and never returns `Nullable`, so a one-element tuple result means exactly one argument.
+    if (const auto * key_expr_function = key_expr_node->as<FunctionNode>();
+        key_expr_function && key_expr_function->getFunctionName() == "tuple")
+    {
+        chassert(key_expr_function->getArguments().getNodes().size() == 1);
+        key_expr_node = key_expr_function->getArguments().getNodes().front();
+        return;
+    }
+
+    /// Extract the element from other expressions with a possibly `Nullable` one-element tuple
+    /// type, such as a column of type `Tuple(UUID)`.
+    key_expr_node = createTupleElementFunction(context, key_expr_node, 1);
+}
+
+/// Check whether the key column type is the common supertype, so that the rewrite needs no explicit
+/// cast of the probe. For numeric types, this permits only total widening, such as a narrow integer
+/// expression against a wide key type. `getLeastSupertype` also checks floating-point precision:
+/// it refuses `Int64` with `Float64` because there are not enough mantissa bits, so an integer
+/// expression passes only when the float key type represents every input value exactly.
+/// `canReplaceWithDictGetKeys` uses the same common-supertype criterion for the attribute side.
+/// The caller checks nullable lookup semantics separately from this type comparison.
+bool canCompareKeyWithoutCast(const DataTypePt
```

**File**: `src/Analyzer/Utils.cpp` (modified, +13/-9)
```diff
@@ -1101,19 +1101,23 @@ NameSet collectIdentifiersFullNames(const QueryTreeNodePtr & node)
     return out;
 }
 
-QueryTreeNodePtr createCastFunction(QueryTreeNodePtr node, DataTypePtr result_type, ContextPtr context)
+QueryTreeNodePtr createResolvedFunction(const ContextPtr & context, const String & name, QueryTreeNodes arguments)
 {
-    auto enum_literal_node = std::make_shared<ConstantNode>(result_type->getName(), std::make_shared<DataTypeString>());
-
-    auto cast_function = FunctionFactory::instance().get("_CAST", std::move(context));
-    QueryTreeNodes arguments{ std::move(node), std::move(enum_literal_node) };
-
-    auto function_node = std::make_shared<FunctionNode>("_CAST");
+    auto function_node = std::make_shared<FunctionNode>(name);
     function_node->getArguments().getNodes() = std::move(arguments);
+    resolveOrdinaryFunctionNodeByName(*function_node, name, context);
+    return function_node;
+}
 
-    function_node->resolveAsFunction(cast_function->build(function_node->getArgumentColumns()));
+QueryTreeNodePtr createTupleElementFunction(const ContextPtr & context, QueryTreeNodePtr argument, UInt64 index)
+{
+    return createResolvedFunction(context, "tupleElement", {std::move(argument), std::make_shared<ConstantNode>(index)});
+}
 
-    return function_node;
+QueryTreeNodePtr createCastFunction(QueryTreeNodePtr node, DataTypePtr result_type, ContextPtr context)
+{
+    auto type_name_node = std::make_shared<ConstantNode>(result_type->getName(), std::make_shared<DataTypeString>());
+    return createResolvedFunction(context, "_CAST", {std::move(node), std::move(type_name_node)});
 }
 
 QueryTreeNodePtr foldConstantCast(const QueryTreeNodePtr & cast_node)
```

**File**: `src/Analyzer/Utils.h` (modified, +6/-0)
```diff
@@ -162,6 +162,12 @@ void rerunFunctionResolve(FunctionNode * function_node, ContextPtr context);
 /// Just collect all identifiers from query tree
 NameSet collectIdentifiersFullNames(const QueryTreeNodePtr & node);
 
+/// Create and resolve an ordinary function node from already-resolved argument expressions.
+QueryTreeNodePtr createResolvedFunction(const ContextPtr & context, const String & name, QueryTreeNodes arguments);
+
+/// Create a resolved `tupleElement` expression using a one-based element index.
+QueryTreeNodePtr createTupleElementFunction(const ContextPtr & context, QueryTreeNodePtr argument, UInt64 index);
+
 /// Wrap node into `_CAST` function
 QueryTreeNodePtr createCastFunction(QueryTreeNodePtr node, DataTypePtr result_type, ContextPtr context);
 
```

**File**: `tests/queries/0_stateless/04891_optimize_inverse_dictionary_lookup_single_key_tuple.reference` (added, +165/-0)
```diff
@@ -0,0 +1,165 @@
+tuple(k), equals, one match - plan
+SELECT count() AS `count()`\nFROM default.data AS __table1\nWHERE equals(__table1.k, \'22222222-2222-2222-2222-222222222222\')
+tuple(k), equals, one match
+1
+tuple(k), equals, one match, opt off
+1
+tuple(k), equals, two matches - plan
+SELECT count() AS `count()`\nFROM default.data AS __table1\nWHERE in(__table1.k, _CAST([\'44444444-4444-4444-4444-444444444444\', \'11111111-1111-1111-1111-111111111111\'], \'Array(UUID)\'))
+tuple(k), equals, two matches
+2
+tuple(k), equals, two matches, opt off
+2
+tuple(k), equals, no matches - plan
+SELECT count() AS `count()`\nFROM default.data AS __table1\nWHERE 0
+tuple(k), equals, no matches
+0
+tuple(k), equals, no matches, opt off
+0
+tuple(k), notEquals - plan
+SELECT count() AS `count()`\nFROM default.data AS __table1\nWHERE in(__table1.k, (\n    SELECT k AS k\n    FROM dictionary(\'default.dict_single_key\')\n    WHERE notEquals(attr, \'none\')\n))
+tuple(k), notEquals
+3
+tuple(k), notEquals, opt off
+3
+tuple(k), like - plan
+SELECT count() AS `count()`\nFROM default.data AS __table1\nWHERE in(__table1.k, (\n    SELECT k AS k\n    FROM dictionary(\'default.dict_single_key\')\n    WHERE like(attr, \'pay%\')\n))
+tuple(k), like
+2
+tuple(k), like, opt off
+2
+tuple-typed column, equals - plan
+SELECT count() AS `count()`\nFROM default.data AS __table1\nWHERE equals(tupleElement(__table1.kt, 1), \'22222222-2222-2222-2222-222222222222\')
+tuple-typed column, equals
+1
+tuple-typed column, equals, opt off
+1
+tuple-typed column, like - plan
+SELECT count() AS `count()`\nFROM default.data AS __table1\nWHERE in(tupleElement(__table1.kt, 1), (\n    SELECT k AS k\n    FROM dictionary(\'default.dict_single_key\')\n    WHERE like(attr, \'pay%\')\n))
+tuple-typed column, like
+2
+tuple-typed column, like, opt off
+2
+nullable tuple expr, equals - plan
+SELECT count() AS `count()`\nFROM default.data AS __table1\nWHERE equals(tupleElement(if(notEquals(__table1.k, \'33333333-3333-3333-3333-333333333333\'), tuple(__table1.k), _CAST(NULL, \'Nullable(Nothing)\')), 1), \'22222222-2222-2222-2222-222222222222\')
+nullable tuple expr, equals
+1
+nullable tuple expr, equals, opt off
+1
+nullable tuple expr, like - plan
+SELECT count() AS `count()`\nFROM default.data AS __table1\nWHERE in(tupleElement(if(notEquals(__table1.k, \'33333333-3333-3333-3333-333333333333\'), tuple(__table1.k), _CAST(NULL, \'Nullable(Nothing)\')), 1), (\n    SELECT k AS k\n    FROM dictionary(\'default.dict_single_key\')\n    WHERE like(attr, \'pay%\')\n))
+nullable tuple expr, like
+2
+nullable tuple expr, like, opt off
+2
+implicit key conversion, wrapped, equals - plan
+SELECT count() AS `count()`\nFROM default.data AS __table1\nWHERE equals(dictGet(\'default.dict_single_key\', \'attr\', tuple(toString(__table1.k))), \'onboarding\')
+implicit key conversion, wrapped, equals
+1
+implicit key conversion, wrapped, equals, opt off
+1
+implicit key conversion, wrapped, like - plan
+SELECT count() AS `count()`\nFROM default.data AS __table1\nWHERE like(dictGet(\'default.dict_single_key\', \'attr\', tuple(toString(__table1.k))), \'pay%\')
+implicit key conversion, wrapped, like
+2
+implicit key conversion, wrapped, like, opt off
+2
+implicit key conversion, bare, equals
+1
+implicit key conversion, bare, equals, opt off
+1
+implicit key conversion, simple key, equals - plan
+SELECT count() AS `count()`\nFROM default.data_n AS __table1\nWHERE equals(dictGet(\'default.dict_simple_key\', \'attr\', toString(__table1.n)), \'paywall\')
+implicit key conversion, simple key, equals
+2
+implicit key conversion, simple key, equals, opt off
+2
+implicit key conversion, numeric widening, equals - plan
+SELECT count() AS `count()`\nFROM default.data_n AS __table1\nWHERE equals(toUInt8(__table1.n), _CAST(2, \'UInt64\'))
+implicit key conversion, numeric widening, equals
+1
+implicit key conversion, numeric widening, equals, opt off
+1
+lossy key conversion, in-range values - plan
+SELECT count() AS `count()`\nFROM default.data_wide AS __table1\nWHERE equals(dictGet(\'default.dict_narrow_key\', \'attr\', __table1.w), \'paywall\')
+lossy key conversion, in-range values
+2
+lossy key conversion, in-range values, opt off
+2
+lossy key conversion, wrapped, in-range values
+2
+lossy key conversion, wrapped, in-range values, opt off
+2
+lossy key conversion, no matching attribute
+NULL-keyed row match, tuple carrier - plan
+SELECT count() AS `count()`\nFROM default.data_nk AS __table1\nWHERE in(tupleElement(if(notEquals(__table1.id, 0), tuple(__table1.id), _CAST(NULL, \'Nullable(Nothing)\')), 1), _CAST([NULL], \'Array(Nullable(UInt64))\'))
+NULL-keyed row match, tuple carrier, projected
+0
+0
+NULL-keyed row match, tuple carrier, projected, opt off
+0
+0
+NULL-keyed row match, tuple carrier, NOT pred
+2
+NULL-keyed row match, tuple carrier, NOT pred, opt off
+2
+NULL-keyed row match, tuple carrier, isNull pred
+0
+NULL-keyed row match, tuple carrier, isNull pred, opt off
+0
+
```

**File**: `tests/queries/0_stateless/04891_optimize_inverse_dictionary_lookup_single_key_tuple.sql` (added, +584/-0)
```diff
@@ -0,0 +1,584 @@
+-- Tags: no-replicated-database, no-parallel-replicas
+-- no-replicated-database: EXPLAIN output differs for replicated database.
+-- no-parallel-replicas: Dictionary is not available on parallel-replica workers.
+
+SET enable_analyzer = 1;
+SET optimize_inverse_dictionary_lookup = 1;
+-- Keep `LIKE` as `like` in `EXPLAIN` output regardless of settings randomization.
+SET optimize_rewrite_like_perfect_affix = 0;
+
+DROP DICTIONARY IF EXISTS dict_single_key;
+DROP DICTIONARY IF EXISTS dict_two_keys;
+DROP TABLE IF EXISTS ref_source;
+DROP TABLE IF EXISTS data;
+
+CREATE TABLE ref_source
+(
+    k UUID,
+    k2 String,
+    attr String
+)
+ENGINE = MergeTree
+ORDER BY k;
+
+INSERT INTO ref_source VALUES
+    ('11111111-1111-1111-1111-111111111111', 'a', 'paywall'),
+    ('22222222-2222-2222-2222-222222222222', 'b', 'onboarding'),
+    ('44444444-4444-4444-4444-444444444444', 'd', 'paywall');
+
+-- For a complex-key dictionary with a single key column, `dictGet` accepts both the bare
+-- key expression (`dictGet(..., k)`) and its one-element tuple wrapper
+-- (`dictGet(..., tuple(k))`).
+CREATE DICTIONARY dict_single_key
+(
+    k UUID,
+    attr String DEFAULT 'none'
+)
+PRIMARY KEY k
+SOURCE(CLICKHOUSE(TABLE 'ref_source'))
+LAYOUT(COMPLEX_KEY_HASHED())
+LIFETIME(0);
+
+CREATE DICTIONARY dict_two_keys
+(
+    k UUID,
+    k2 String,
+    attr String DEFAULT ''
+)
+PRIMARY KEY k, k2
+SOURCE(CLICKHOUSE(TABLE 'ref_source'))
+LAYOUT(COMPLEX_KEY_HASHED())
+LIFETIME(0);
+
+CREATE TABLE data
+(
+    k UUID,
+    k2 String,
+    kt Tuple(UUID)
+)
+ENGINE = MergeTree
+ORDER BY k;
+
+INSERT INTO data VALUES
+    ('11111111-1111-1111-1111-111111111111', 'a', tuple('11111111-1111-1111-1111-111111111111')),
+    ('22222222-2222-2222-2222-222222222222', 'b', tuple('22222222-2222-2222-2222-222222222222')),
+    ('33333333-3333-3333-3333-333333333333', 'c', tuple('33333333-3333-3333-3333-333333333333')),
+    ('44444444-4444-4444-4444-444444444444', 'd', tuple('44444444-4444-4444-4444-444444444444'));
+
+-- A single-column complex key accepts a `tuple` wrapper.
+-- `equals` with one matching key constant-folds into `key = const`.
+SELECT 'tuple(k), equals, one match - plan';
+EXPLAIN SYNTAX run_query_tree_passes=1
+SELECT count() FROM data WHERE dictGet('dict_single_key', 'attr', tuple(k)) = 'onboarding';
+SELECT 'tuple(k), equals, one match';
+SELECT count() FROM data WHERE dictGet('dict_single_key', 'attr', tuple(k)) = 'onboarding';
+SELECT 'tuple(k), equals, one match, opt off';
+SELECT count() FROM data WHERE dictGet('dict_single_key', 'attr', tuple(k)) = 'onboarding'
+SETTINGS optimize_inverse_dictionary_lookup = 0;
+
+-- `equals` with several matching keys constant-folds into `key IN [consts]`.
+SELECT 'tuple(k), equals, two matches - plan';
+EXPLAIN SYNTAX run_query_tree_passes=1
+SELECT count() FROM data WHERE dictGet('dict_single_key', 'attr', tuple(k)) = 'paywall';
+SELECT 'tuple(k), equals, two matches';
+SELECT count() FROM data WHERE dictGet('dict_single_key', 'attr', tuple(k)) = 'paywall';
+SELECT 'tuple(k), equals, two matches, opt off';
+SELECT count() FROM data WHERE dictGet('dict_single_key', 'attr', tuple(k)) = 'paywall'
+SETTINGS optimize_inverse_dictionary_lookup = 0;
+
+-- `equals` with no matching keys constant-folds into `0`.
+SELECT 'tuple(k), equals, no matches - plan';
+EXPLAIN SYNTAX run_query_tree_passes=1
+SELECT count() FROM data WHERE dictGet('dict_single_key', 'attr', tuple(k)) = 'missing';
+SELECT 'tuple(k), equals, no matches';
+SELECT count() FROM data WHERE dictGet('dict_single_key', 'attr', tuple(k)) = 'missing';
+SELECT 'tuple(k), equals, no matches, opt off';
+SELECT count() FROM data WHERE dictGet('dict_single_key', 'attr', tuple(k)) = 'missing'
+SETTINGS optimize_inverse_dictionary_lookup = 0;
+
+-- `notEquals` against the attribute default rewrites into
+-- `key IN (SELECT key FROM dictionary(...) WHERE ...)`.
+SELECT 'tuple(k), notEquals - plan';
+EXPLAIN SYNTAX run_query_tree_passes=1
+SELECT count() FROM data WHERE dictGet('dict_single_key', 'attr', tuple(k)) != 'none';
+SELECT 'tuple(k), notEquals';
+SELECT count() FROM data WHERE dictGet('dict_single_key', 'attr', tuple(k)) != 'none';
+SELECT 'tuple(k), notEquals, opt off';
+SELECT count() FROM data WHERE dictGet('dict_single_key', 'attr', tuple(k)) != 'none'
+SETTINGS optimize_inverse_dictionary_lookup = 0;
+
+-- `like` also rewrites into the `IN` subquery form.
+SELECT 'tuple(k), like - plan';
+EXPLAIN SYNTAX run_query_tree_passes=1
+SELECT count() FROM data WHERE dictGet('dict_single_key', 'attr', tuple(k)) LIKE 'pay%';
+SELECT 'tuple(k), like';
+SELECT count() FROM data WHERE dictGet('dict_single_key', 'attr', tuple(k)) LIKE 'pay%';
+SELECT 'tuple(k), like, opt off';
+SELECT count() FROM data WHERE dictGet('dict_single_key', 'attr', tuple(k)) LIKE 'pay%'
+SETTINGS optimize_inverse_dictionary_lookup = 0;
+
+-- The key expression can have a one-element tuple type without being a literal
+-- `tuple(...)` cal
```

**File**: `tests/queries/0_stateless/05217_inverse_dictionary_lookup_conversion_semantics.reference` (added, +89/-0)
```diff
@@ -0,0 +1,89 @@
+date conversion
+1	1	0	0
+2	0	1	1
+3	0	0	0
+1	1	0	0
+2	0	1	1
+3	0	0	0
+IP conversion settings
+date parsing settings
+nullable conversion, unparsable string
+nullable conversion results
+2	0	0	0	0	0	0	0
+3	0	1	0	0	0	0	0
+2	0	0	0	0	0	0	0
+3	0	1	0	0	0	0	0
+composite null key, transform_null_in=0
+1	0	1	0
+2	0	1	0
+3	\N	\N	1
+1	0	1	0
+2	0	1	0
+3	\N	\N	1
+2	1
+2	1
+1	0	1	0
+2	0	1	0
+3	\N	\N	1
+1	0	1	0
+2	0	1	0
+3	\N	\N	1
+2	1
+2	1
+composite null key, transform_null_in=1
+1	0	1	0
+2	0	1	0
+3	\N	\N	1
+1	0	1	0
+2	0	1	0
+3	\N	\N	1
+2	1
+2	1
+1	0	1	0
+2	0	1	0
+3	\N	\N	1
+1	0	1	0
+2	0	1	0
+3	\N	\N	1
+2	1
+2	1
+non-null composite probe
+1	0
+2	0
+3	0
+1	0
+2	0
+3	0
+empty input
+0
+0
+0
+0
+0
+0
+unselected lookup branches
+1
+1
+1
+1
+1
+1
+1
+1
+1
+1
+1
+1
+1
+1
+1
+1
+1
+1
+1
+1
+1
+1
+1
+1
+evaluated unsupported conversion
```

**File**: `tests/queries/0_stateless/05217_inverse_dictionary_lookup_conversion_semantics.sql` (added, +283/-0)
```diff
@@ -0,0 +1,283 @@
+SET enable_analyzer = 1;
+SET optimize_rewrite_like_perfect_affix = 0;
+SET short_circuit_function_evaluation = 'enable';
+
+-- Dictionary key conversions saturate timestamps outside the range of `DateTime`.
+CREATE TABLE conversion_dates_source (k DateTime('UTC'), attr String) ENGINE = Memory;
+INSERT INTO conversion_dates_source VALUES
+    ('1970-01-01 00:00:00', 'single'),
+    ('1970-01-01 00:00:01', 'many'),
+    ('1970-01-01 00:00:02', 'many');
+CREATE DICTIONARY conversion_dates (k DateTime('UTC'), attr String DEFAULT '')
+PRIMARY KEY k SOURCE(CLICKHOUSE(TABLE 'conversion_dates_source')) LAYOUT(COMPLEX_KEY_HASHED()) LIFETIME(0);
+CREATE TABLE conversion_dates_data (id UInt8, t DateTime64(0, 'UTC'), kt Tuple(DateTime64(0, 'UTC'))) ENGINE = Memory;
+INSERT INTO conversion_dates_data VALUES
+    (1, '1969-12-31 23:59:59', ('1969-12-31 23:59:59',)),
+    (2, '1970-01-01 00:00:01', ('1970-01-01 00:00:01',)),
+    (3, '2106-02-07 06:28:17', ('2106-02-07 06:28:17',));
+SELECT 'date conversion';
+
+SELECT id,
+    dictGet('conversion_dates', 'attr', t) = 'single',
+    dictGet('conversion_dates', 'attr', tuple(t)) = 'many',
+    dictGet('conversion_dates', 'attr', kt) LIKE 'ma%'
+FROM conversion_dates_data ORDER BY id SETTINGS optimize_inverse_dictionary_lookup = 0;
+
+SELECT id,
+    dictGet('conversion_dates', 'attr', t) = 'single',
+    dictGet('conversion_dates', 'attr', tuple(t)) = 'many',
+    dictGet('conversion_dates', 'attr', kt) LIKE 'ma%'
+FROM conversion_dates_data ORDER BY id SETTINGS optimize_inverse_dictionary_lookup = 1;
+
+-- Query conversion settings do not change the internal conversion of dictionary keys.
+CREATE TABLE conversion_ip_source (ip4 IPv4, ip6 IPv6, attr String) ENGINE = Memory;
+INSERT INTO conversion_ip_source VALUES ('0.0.0.0', '::', 'hit');
+CREATE DICTIONARY conversion_ip4 (ip4 IPv4, attr String DEFAULT '')
+PRIMARY KEY ip4 SOURCE(CLICKHOUSE(TABLE 'conversion_ip_source')) LAYOUT(COMPLEX_KEY_HASHED()) LIFETIME(0);
+CREATE DICTIONARY conversion_ip6 (ip6 IPv6, attr String DEFAULT '')
+PRIMARY KEY ip6 SOURCE(CLICKHOUSE(TABLE 'conversion_ip_source')) LAYOUT(COMPLEX_KEY_HASHED()) LIFETIME(0);
+CREATE TABLE conversion_strings (id UInt8, s String, kt Tuple(String, String)) ENGINE = Memory;
+INSERT INTO conversion_strings VALUES (1, 'bad', ('bad', 'a'));
+SET cast_ipv4_ipv6_default_on_conversion_error = 1;
+SET input_format_ipv4_default_on_conversion_error = 1;
+SET input_format_ipv6_default_on_conversion_error = 1;
+SELECT 'IP conversion settings';
+
+SELECT dictGet('conversion_ip4', 'attr', tuple(s)) = 'hit' FROM conversion_strings SETTINGS optimize_inverse_dictionary_lookup = 0; -- { serverError CANNOT_PARSE_IPV4 }
+
+SELECT dictGet('conversion_ip4', 'attr', tuple(s)) = 'hit' FROM conversion_strings SETTINGS optimize_inverse_dictionary_lookup = 1; -- { serverError CANNOT_PARSE_IPV4 }
+
+SELECT dictGet('conversion_ip4', 'attr', tuple(s)) LIKE 'hi%' FROM conversion_strings SETTINGS optimize_inverse_dictionary_lookup = 0; -- { serverError CANNOT_PARSE_IPV4 }
+
+SELECT dictGet('conversion_ip4', 'attr', tuple(s)) LIKE 'hi%' FROM conversion_strings SETTINGS optimize_inverse_dictionary_lookup = 1; -- { serverError CANNOT_PARSE_IPV4 }
+
+SELECT dictGet('conversion_ip6', 'attr', tuple(s)) = 'hit' FROM conversion_strings SETTINGS optimize_inverse_dictionary_lookup = 0; -- { serverError CANNOT_PARSE_IPV6 }
+
+SELECT dictGet('conversion_ip6', 'attr', tuple(s)) = 'hit' FROM conversion_strings SETTINGS optimize_inverse_dictionary_lookup = 1; -- { serverError CANNOT_PARSE_IPV6 }
+
+SELECT dictGet('conversion_ip6', 'attr', tuple(s)) LIKE 'hi%' FROM conversion_strings SETTINGS optimize_inverse_dictionary_lookup = 0; -- { serverError CANNOT_PARSE_IPV6 }
+
+SELECT dictGet('conversion_ip6', 'attr', tuple(s)) LIKE 'hi%' FROM conversion_strings SETTINGS optimize_inverse_dictionary_lookup = 1; -- { serverError CANNOT_PARSE_IPV6 }
+
+SET cast_ipv4_ipv6_default_on_conversion_error = 0;
+SET input_format_ipv4_default_on_conversion_error = 0;
+SET input_format_ipv6_default_on_conversion_error = 0;
+TRUNCATE TABLE conversion_strings;
+INSERT INTO conversion_strings VALUES (1, '01 Jan 2026 00:00:00', ('01 Jan 2026 00:00:00', 'a'));
+SET cast_string_to_date_time_mode = 'best_effort';
+SELECT 'date parsing settings';
+
+SELECT dictGet('conversion_dates', 'attr', s) = 'single' FROM conversion_strings SETTINGS optimize_inverse_dictionary_lookup = 0; -- { serverError CANNOT_PARSE_TEXT }
+
+SELECT dictGet('conversion_dates', 'attr', s) = 'single' FROM conversion_strings SETTINGS optimize_inverse_dictionary_lookup = 1; -- { serverError CANNOT_PARSE_TEXT }
+
+SELECT dictGet('conversion_dates', 'attr', s) LIKE 'si%' FROM conversion_strings SETTINGS optimize_inverse_dictionary_lookup = 0; -- { serverError CANNOT_PARSE_TEXT }
+
+SELECT dictGet('conversion_dates', 'attr', s) LIKE 'si%' FROM conversion_strings SETTINGS optimize_inverse_dictionary_lookup = 1; -- { serverError CANNOT_PARSE_TEXT }
+
+SE
```

---

### Incident Patch 3: `52448389` (2026-10-07)
**Commit Message**: Merge pull request #116933 from groeneai/fix-set-default-respects-compatibility

Make `SET <setting> = DEFAULT` respect an active `compatibility` setting

**File**: `src/Access/SettingsConstraints.cpp` (modified, +6/-1)
```diff
@@ -397,7 +397,7 @@ void SettingsConstraints::check(const Settings & current_settings, SettingsChang
     checkOrClamp(current_settings, changes, THROW_ON_VIOLATION, source);
 }
 
-void SettingsConstraints::checkResetToDefault(const Settings & current_settings, const std::vector<String> & names, SettingSource source) const
+void SettingsConstraints::checkResetToDefault(const Settings & current_settings, const Settings & after_reset, const std::vector<String> & names, SettingSource source) const
 {
     /// A reset of a built-in setting is equivalent to assigning its declared default. The regular
     /// check also deliberately permits a reset that does not change the value.
@@ -411,6 +411,11 @@ void SettingsConstraints::checkResetToDefault(const Settings & current_settings,
         if (settingIsBuiltin(name))
         {
             check(current_settings, SettingChange{name, settingDefaultValue(name)}, source);
+            /// A `Settings` setting can land on a value `compatibility` gives it instead, and a later change of
+            /// `compatibility` moves it back to the declared default, so both values have to be allowed.
+            /// `Settings` also owns some `merge_tree_`-prefixed names, so the prefix does not identify the class.
+            if (Settings::hasBuiltin(name))
+                check(current_settings, SettingChange{name, after_reset.get(name)}, source);
             continue;
         }
 
```

**File**: `src/Access/SettingsConstraints.h` (modified, +2/-1)
```diff
@@ -117,7 +117,8 @@ class SettingsConstraints
     void checkRemovedSettings(const SettingsProfileElements & old_elements, const SettingsProfileElements & new_elements) const;
 
     /// Checks whether resetting the specified settings to their defaults violates these constraints.
-    void checkResetToDefault(const Settings & current_settings, const std::vector<String> & names, SettingSource source) const;
+    /// `after_reset` holds the values the resets land on, which `compatibility` may have derived.
+    void checkResetToDefault(const Settings & current_settings, const Settings & after_reset, const std::vector<String> & names, SettingSource source) const;
 
     /// Checks whether `change` violates these constraints and throws an exception if so. (setting short name is expected inside `changes`)
     void check(const MergeTreeSettings & current_settings, const SettingChange & change) const;
```

**File**: `src/Interpreters/Context.cpp` (modified, +19/-1)
```diff
@@ -3935,8 +3935,14 @@ void Context::checkSettingsConstraints(const SettingsChanges & changes, SettingS
 
 void Context::checkSettingsConstraintsForSettingsReset(const std::vector<String> & names, SettingSource source)
 {
+    if (names.empty())
+        return;
+    /// Under `compatibility` a reset lands on the value of that version, so perform it on a copy to learn the value.
+    auto after_reset = Context::createCopy(shared_from_this());
+    after_reset->resetSettingsToDefaultValue(names);
     SharedLockGuard lock(mutex);
-    getSettingsConstraintsAndCurrentProfilesWithLock()->constraints.checkResetToDefault(*settings, names, source);
+    getSettingsConstraintsAndCurrentProfilesWithLock()->constraints.checkResetToDefault(
+        *settings, after_reset->getSettingsRef(), names, source);
 }
 
 void Context::checkSettingsConstraintsForSettingsReset(
@@ -3991,6 +3997,8 @@ void Context::checkMergeTreeSettingsConstraints(const MergeTreeSettings & merge_
 
 void Context::resetSettingsToDefaultValue(const std::vector<String> & names)
 {
+    if (names.empty())
+        return;
     std::lock_guard lock(mutex);
     for (const String & name : names)
     {
@@ -4000,6 +4008,16 @@ void Context::resetSettingsToDefaultValue(const std::vector<String> & names)
         for (const auto & equivalent_name : settingEquivalentNames(name))
             settings->setDefaultValue(equivalent_name);
     }
+    /// A setting nothing assigned holds what the active `compatibility` gives it.
+    if ((*settings)[Setting::compatibility].value.empty())
+        settings->resetSettingsChangedByCompatibility();
+    else
+    {
+        settings->set(COMPATIBILITY_SETTING_NAME, (*settings)[Setting::compatibility].value);
+        restrictSettingsChangedByCompatibilityWithLock(lock);
+    }
+    applySettingsQuirks(*settings);
+    adjustSettingsForMakeDistributedPlan(*settings);
 }
 
 std::shared_ptr<const SettingsConstraintsAndProfileIDs> Context::getSettingsConstraintsAndCurrentProfilesWithLock() const
```

**File**: `src/Interpreters/Context.h` (modified, +1/-1)
```diff
@@ -1324,7 +1324,7 @@ class Context: public ContextData, public std::enable_shared_from_this<Context>
     void clampToSettingsConstraints(SettingsChanges & changes, SettingSource source);
     void checkMergeTreeSettingsConstraints(const MergeTreeSettings & merge_tree_settings, const SettingsChanges & changes) const;
 
-    /// Reset settings to default value
+    /// Reset settings to the default in effect for them, which under an active `compatibility` is the value of that version.
     void resetSettingsToDefaultValue(const std::vector<String> & names);
 
     /// Returns the current constraints (can return null).
```

**File**: `tests/queries/0_stateless/05047_set_default_respects_compatibility.reference` (added, +26/-0)
```diff
@@ -0,0 +1,26 @@
+the probes differ from their declared defaults under compatibility 26.7
+enable_group_by_top_k_optimization	1
+input_format_read_datetime_number_as_raw_value	1
+merge_tree_min_bytes_per_read_stream	1
+SET name = DEFAULT
+1
+0
+SET compatibility and the reset in one statement
+1
+SETTINGS name = DEFAULT in a query
+1
+SET compatibility = DEFAULT reverts what it derived
+0
+a reset does not take a value from compatibility that the constraints forbid
+1
+a reset that would change a setting is refused in readonly mode
+Code: 164
+0
+a merge_tree_-prefixed name that Settings owns is checked against the value it lands on
+Code: 164
+65536
+a reset is refused when the declared default is forbidden, as compatibility can move the setting back to it
+SETTING_CONSTRAINT_VIOLATION
+1
+resetting compatibility keeps what make_distributed_plan adjusts
+0
```

**File**: `tests/queries/0_stateless/05047_set_default_respects_compatibility.sh` (added, +100/-0)
```diff
@@ -0,0 +1,100 @@
+#!/usr/bin/env bash
+
+# `SET <name> = DEFAULT` restores the default that is in effect for the setting, which under an active
+# `compatibility` is the value of that version rather than the declared default.
+#
+# Values are read back over HTTP with a persistent session and a bare URL: a client session resends the
+# settings it believes are changed, which re-applies `compatibility` and hides the reset.
+
+CUR_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
+# shellcheck source=../shell_config.sh
+. "$CUR_DIR"/../shell_config.sh
+
+# All changed in 26.8. `P`: declared default 0, under 26.7 1. `Q`: declared default 1, under 26.7 0.
+# `R`: a `Settings` setting despite the prefix, declared default 65536, under 26.7 0.
+P=input_format_read_datetime_number_as_raw_value
+Q=enable_group_by_top_k_optimization
+R=merge_tree_min_bytes_per_read_stream
+
+USER_MIN="u_min_05047_${CLICKHOUSE_DATABASE}"
+USER_RO="u_ro_05047_${CLICKHOUSE_DATABASE}"
+USER_P="u_p_05047_${CLICKHOUSE_DATABASE}"
+PROFILE_MIN="p_min_05047_${CLICKHOUSE_DATABASE}"
+PROFILE_RO="p_ro_05047_${CLICKHOUSE_DATABASE}"
+PROFILE_P="p_p_05047_${CLICKHOUSE_DATABASE}"
+
+BASE_URL="${CLICKHOUSE_URL%%\?*}"
+session_url() { echo "${BASE_URL}?session_id=s_05047_${CLICKHOUSE_DATABASE}_$$_$1${2:+&user=$2}"; }
+read_setting() { ${CLICKHOUSE_CURL} -sS "$1" -d "SELECT value FROM system.settings WHERE name = '$2'"; }
+
+${CLICKHOUSE_CLIENT} -q "DROP USER IF EXISTS ${USER_MIN}, ${USER_RO}, ${USER_P}"
+${CLICKHOUSE_CLIENT} -q "DROP PROFILE IF EXISTS ${PROFILE_MIN}, ${PROFILE_RO}, ${PROFILE_P}"
+${CLICKHOUSE_CLIENT} -q "CREATE SETTINGS PROFILE ${PROFILE_MIN} SETTINGS ${Q} = 1 MIN 1"
+${CLICKHOUSE_CLIENT} -q "CREATE SETTINGS PROFILE ${PROFILE_RO} SETTINGS compatibility = '26.7', ${P} = 0, ${R} = 65536, readonly = 1"
+${CLICKHOUSE_CLIENT} -q "CREATE USER ${USER_MIN} SETTINGS PROFILE '${PROFILE_MIN}'"
+${CLICKHOUSE_CLIENT} -q "CREATE USER ${USER_RO} SETTINGS PROFILE '${PROFILE_RO}'"
+# Allows the 26.7 value of `P` and forbids its declared default.
+${CLICKHOUSE_CLIENT} -q "CREATE SETTINGS PROFILE ${PROFILE_P} SETTINGS ${P} = 1 MIN 1"
+${CLICKHOUSE_CLIENT} -q "CREATE USER ${USER_P} SETTINGS PROFILE '${PROFILE_P}'"
+
+echo 'the probes differ from their declared defaults under compatibility 26.7'
+U=$(session_url a0)
+${CLICKHOUSE_CURL} -sS "$U" -d "SET compatibility = '26.7'"
+${CLICKHOUSE_CURL} -sS "$U" -d "SELECT name, value != default FROM system.settings WHERE name IN ('${P}', '${Q}', '${R}') ORDER BY name"
+
+echo 'SET name = DEFAULT'
+U=$(session_url a1)
+${CLICKHOUSE_CURL} -sS "$U" -d "SET compatibility = '26.7'"
+${CLICKHOUSE_CURL} -sS "$U" -d "SET ${P} = 0"
+${CLICKHOUSE_CURL} -sS "$U" -d "SET ${P} = DEFAULT"
+read_setting "$U" "${P}"
+# The reset leaves the setting to `compatibility`, so clearing `compatibility` moves it too.
+${CLICKHOUSE_CURL} -sS "$U" -d "SET compatibility = DEFAULT"
+read_setting "$U" "${P}"
+
+echo 'SET compatibility and the reset in one statement'
+U=$(session_url a2)
+${CLICKHOUSE_CURL} -sS "$U" -d "SET compatibility = '26.7', ${P} = DEFAULT"
+read_setting "$U" "${P}"
+
+echo 'SETTINGS name = DEFAULT in a query'
+U=$(session_url a3)
+${CLICKHOUSE_CURL} -sS "$U" -d "SET compatibility = '26.7'"
+${CLICKHOUSE_CURL} -sS "$U" -d "SET ${P} = 0"
+${CLICKHOUSE_CURL} -sS "$U" -d "SELECT value FROM system.settings WHERE name = '${P}' SETTINGS ${P} = DEFAULT"
+
+echo 'SET compatibility = DEFAULT reverts what it derived'
+U=$(session_url a4)
+${CLICKHOUSE_CURL} -sS "$U" -d "SET compatibility = '26.7'"
+${CLICKHOUSE_CURL} -sS "$U" -d "SET compatibility = DEFAULT"
+read_setting "$U" "${P}"
+
+echo 'a reset does not take a value from compatibility that the constraints forbid'
+U=$(session_url a5 "${USER_MIN}")
+${CLICKHOUSE_CURL} -sS "$U" -d "SET compatibility = '26.7'"
+${CLICKHOUSE_CURL} -sS "$U" -d "SET ${Q} = DEFAULT"
+read_setting "$U" "${Q}"
+
+echo 'a reset that would change a setting is refused in readonly mode'
+U=$(session_url a6 "${USER_RO}")
+${CLICKHOUSE_CURL} -sS "$U" -d "SET ${P} = DEFAULT" | grep -o 'Code: 164' | head -1
+read_setting "$U" "${P}"
+
+echo 'a merge_tree_-prefixed name that Settings owns is checked against the value it lands on'
+U=$(session_url a7 "${USER_RO}")
+${CLICKHOUSE_CURL} -sS "$U" -d "SET ${R} = DEFAULT" | grep -o 'Code: 164' | head -1
+read_setting "$U" "${R}"
+
+echo 'a reset is refused when the declared default is forbidden, as compatibility can move the setting back to it'
+U=$(session_url a8 "${USER_P}")
+${CLICKHOUSE_CURL} -sS "$U" -d "SET compatibility = '26.7'"
+${CLICKHOUSE_CURL} -sS "$U" -d "SET ${P} = DEFAULT" | grep -o 'SETTING_CONSTRAINT_VIOLATION' | head -1
+read_setting "$U" "${P}"
+
+echo 'resetting compatibility keeps what make_distributed_plan adjusts'
+# `compile_expressions` is 0 under 25.4 and declared 1, and `make_distributed_plan` requires 0. A server
+# query applies its own settings and adjusts them again, so read it where nothing does.
+${CLICKHOUSE_LOCAL} -q "SET compati
```

---

### Incident Patch 4: `af71dec0` (2026-10-07)
**Commit Message**: Merge pull request #122975 from ClickHouse/yarik/fix-index-hint-pushdown-deps

Fix wrong window function result when `indexHint` is pushed below the window

**File**: `src/Interpreters/ActionsDAG.cpp` (modified, +37/-7)
```diff
@@ -3505,16 +3505,44 @@ struct ConjunctionNodes
     ActionsDAG::NodeRawConstPtrs rejected;
 };
 
+/// indexHint keeps its arguments in its own dag, so they are not children of the node, and hints may nest
+template <typename Predicate>
+bool allIndexHintInputs(const ActionsDAG::Node & node, const Predicate & predicate)
+{
+    if (node.type != ActionsDAG::ActionType::FUNCTION || node.function_base->getName() != "indexHint")
+        return true;
+
+    const auto & adaptor = assert_cast<const FunctionToFunctionBaseAdaptor &>(*node.function_base);
+    const auto & dag = assert_cast<const FunctionIndexHint &>(*adaptor.getFunction()).getActions();
+    return std::ranges::all_of(dag.getInputs(), predicate)
+        && std::ranges::all_of(dag.getNodes(), [&](const auto & inner) { return allIndexHintInputs(inner, predicate); });
+}
+
 /// Take a node which result is a predicate.
 /// Assuming predicate is a conjunction (probably, trivial).
 /// Find separate conjunctions nodes. Split nodes into allowed and rejected sets.
 /// Allowed predicate is a predicate which can be calculated using only nodes from the allowed_nodes set.
-ConjunctionNodes getConjunctionNodes(ActionsDAG::Node * predicate, std::unordered_set<const ActionsDAG::Node *> allowed_nodes, bool allow_non_deterministic_functions)
+ConjunctionNodes getConjunctionNodes(
+    ActionsDAG::Node * predicate,
+    const ActionsDAG::NodeRawConstPtrs & inputs,
+    std::unordered_set<const ActionsDAG::Node *> allowed_nodes,
+    bool allow_non_deterministic_functions,
+    bool allow_index_hints = true)
 {
     ConjunctionNodes conjunction;
     std::unordered_set<const ActionsDAG::Node *> allowed;
     std::unordered_set<const ActionsDAG::Node *> rejected;
 
+    std::unordered_set<std::string_view> rejected_input_names;
+    for (const auto * input : inputs)
+        if (!allowed_nodes.contains(input))
+            rejected_input_names.insert(input->result_name);
+
+    auto is_index_hint_input_allowed = [&](const ActionsDAG::Node * input)
+    {
+        return allow_index_hints && !rejected_input_names.contains(input->result_name);
+    };
+
     /// Parts of predicate in case predicate is conjunction (or just predicate itself).
     std::unordered_set<const ActionsDAG::Node *> predicates;
     {
@@ -3586,7 +3614,8 @@ ConjunctionNodes getConjunctionNodes(ActionsDAG::Node * predicate, std::unordere
 
                 if (cur.node->type != ActionsDAG::ActionType::ARRAY_JOIN
                     && cur.node->type != ActionsDAG::ActionType::INPUT
-                    && !is_deprecated_function)
+                    && !is_deprecated_function
+                    && allIndexHintInputs(*cur.node, is_index_hint_input_allowed))
                     allowed_nodes.emplace(cur.node);
             }
 
@@ -3793,7 +3822,8 @@ std::optional<ActionsDAG::ActionsForFilterPushDown> ActionsDAG::splitActionsForF
     bool removes_filter,
     const Names & available_inputs,
     const ColumnsWithTypeAndName & all_inputs,
-    bool allow_non_deterministic_functions)
+    bool allow_non_deterministic_functions,
+    bool allow_index_hints)
 {
     Node * predicate = const_cast<Node *>(tryFindInOutputs(filter_name));
     if (!predicate)
@@ -3826,7 +3856,7 @@ std::optional<ActionsDAG::ActionsForFilterPushDown> ActionsDAG::splitActionsForF
         }
     }
 
-    auto conjunction = getConjunctionNodes(predicate, allowed_nodes, allow_non_deterministic_functions);
+    auto conjunction = getConjunctionNodes(predicate, inputs, allowed_nodes, allow_non_deterministic_functions, allow_index_hints);
 
     if (conjunction.allowed.empty())
         return {};
@@ -3893,9 +3923,9 @@ ActionsDAG::ActionsForJOINFilterPushDown ActionsDAG::splitActionsForJOINFilterPu
     auto right_stream_allowed_nodes = get_input_nodes(right_stream_available_columns_to_push_down);
     auto both_streams_allowed_nodes = get_input_nodes(equivalent_columns_to_push_down);
 
-    auto left_stream_push_down_conjunctions = getConjunctionNodes(predicate, left_stream_allowed_nodes, false);
-    auto right_stream_push_down_conjunctions = getConjunctionNodes(predicate, right_stream_allowed_nodes, false);
-    auto both_streams_push_down_conjunctions = getConjunctionNodes(predicate, both_streams_allowed_nodes, false);
+    auto left_stream_push_down_conjunctions = getConjunctionNodes(predicate, inputs, left_stream_allowed_nodes, false);
+    auto right_stream_push_down_conjunctions = getConjunctionNodes(predicate, inputs, right_stream_allowed_nodes, false);
+    auto both_streams_push_down_conjunctions = getConjunctionNodes(predicate, inputs, both_streams_allowed_nodes, false);
 
     /// A cross-type equivalent input is replaced below by a cast of the opposite side's key rather than
     /// renamed to an equal-typed column, so it can be constant where the input is not and is computed a
```

**File**: `src/Interpreters/ActionsDAG.h` (modified, +4/-1)
```diff
@@ -507,12 +507,15 @@ class ActionsDAG
     /// columns will be transformed like `x, y, z` -> `z > 0, z, x, y` -(remove filter)-> `z, x, y`.
     /// To avoid it, add inputs from `all_inputs` list,
     /// so actions `x, y, z -> z > 0, x, y, z` -(remove filter)-> `x, y, z` will not change columns order.
+    ///
+    /// @param allow_index_hints - false for key steps like window: a hint prunes whole granules, which can leave a key with part of its rows
     std::optional<ActionsForFilterPushDown> splitActionsForFilterPushDown(
         const std::string & filter_name,
         bool removes_filter,
         const Names & available_inputs,
         const ColumnsWithTypeAndName & all_inputs,
-        bool allow_non_deterministic_functions);
+        bool allow_non_deterministic_functions,
+        bool allow_index_hints = true);
 
     struct ActionsForJOINFilterPushDown;
 
```

**File**: `src/Processors/QueryPlan/Optimizations/filterPushDown.cpp` (modified, +12/-6)
```diff
@@ -148,7 +148,12 @@ bool constifyFilterColumnAfterPushDown(ActionsDAG & expression, const String & f
 }
 }
 
-static std::optional<ActionsDAG::ActionsForFilterPushDown> splitFilter(QueryPlan::Node * parent_node, bool step_changes_the_number_of_rows, const Names & available_inputs, size_t child_idx = 0)
+static std::optional<ActionsDAG::ActionsForFilterPushDown> splitFilter(
+    QueryPlan::Node * parent_node,
+    bool step_changes_the_number_of_rows,
+    const Names & available_inputs,
+    bool allow_index_hints,
+    size_t child_idx = 0)
 {
     QueryPlan::Node * child_node = parent_node->children.front();
     checkChildrenSize(child_node, child_idx + 1);
@@ -171,7 +176,7 @@ static std::optional<ActionsDAG::ActionsForFilterPushDown> splitFilter(QueryPlan
         original_filter_const_column = filter->getOutputHeader()->getByName(filter_column_name).column;
 
     auto result = expression.splitActionsForFilterPushDown(
-        filter_column_name, removes_filter, available_inputs, all_inputs, allow_deterministic_functions);
+        filter_column_name, removes_filter, available_inputs, all_inputs, allow_deterministic_functions, allow_index_hints);
     if (result)
     {
         if (is_filter_column_const_before && !result->is_filter_const_after_push_down)
@@ -268,9 +273,10 @@ static size_t tryAddNewFilterStep(
     bool step_changes_the_number_of_rows,
     QueryPlan::Nodes & nodes,
     const Names & allowed_inputs,
+    bool allow_index_hints = true,
     size_t child_idx = 0)
 {
-    if (auto split_filter = splitFilter(parent_node, step_changes_the_number_of_rows, allowed_inputs, child_idx))
+    if (auto split_filter = splitFilter(parent_node, step_changes_the_number_of_rows, allowed_inputs, allow_index_hints, child_idx))
         return addNewFilterStepOrThrow(parent_node, nodes, std::move(*split_filter), child_idx);
     return 0;
 }
@@ -1211,7 +1217,7 @@ size_t tryPushDownFilter(QueryPlan::Node * parent_node, QueryPlan::Nodes & nodes
         if (keys.empty())
             return 0;
 
-        if (auto updated_steps = tryAddNewFilterStep(parent_node, true, nodes, keys))
+        if (auto updated_steps = tryAddNewFilterStep(parent_node, true, nodes, keys, /*allow_index_hints=*/false))
             return updated_steps;
     }
 
@@ -1234,7 +1240,7 @@ size_t tryPushDownFilter(QueryPlan::Node * parent_node, QueryPlan::Nodes & nodes
         /// inside a surviving partition before the window runs, which can change which row
         /// becomes row_number() = 1. Unlike SortingStep, the window value depends on the set of
         /// rows in the partition, so non-deterministic filters are not safe to move below it.
-        if (auto updated_steps = tryAddNewFilterStep(parent_node, true, nodes, partition_keys))
+        if (auto updated_steps = tryAddNewFilterStep(parent_node, true, nodes, partition_keys, /*allow_index_hints=*/false))
             return updated_steps;
     }
 
@@ -1258,7 +1264,7 @@ size_t tryPushDownFilter(QueryPlan::Node * parent_node, QueryPlan::Nodes & nodes
         if (keys.empty() || limit_by->getGroupOffset() != 0 || limit_by->getGroupLength() == 0)
             return 0;
 
-        if (auto updated_steps = tryAddNewFilterStep(parent_node, true, nodes, keys))
+        if (auto updated_steps = tryAddNewFilterStep(parent_node, true, nodes, keys, /*allow_index_hints=*/false))
             return updated_steps;
     }
 
```

**File**: `tests/queries/0_stateless/03836_tpch_join_order_plans.reference` (modified, +1/-1)
```diff
@@ -271,7 +271,7 @@ Expression (Project names)
           Aggregating
             Expression ((Before GROUP BY + ))
               JoinLogical (Shuffle HashJoin )
-                Filter ((WHERE + Change column names to column identifiers))
+                Expression (Change column names to column identifiers)
                   ShuffleExchange
                     ReadFromMergeTree (ParallelRead default.orders)
                 Filter ((WHERE + Change column names to column identifiers))
```

**File**: `tests/queries/0_stateless/05291_index_hint_below_window.reference` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+31155
+31155
+148395
+148395
+100	1000
+10	100
```

**File**: `tests/queries/0_stateless/05291_index_hint_below_window.sql` (added, +26/-0)
```diff
@@ -0,0 +1,26 @@
+-- https://github.com/ClickHouse/ClickHouse/issues/121177: an indexHint must not prune rows below a window or GROUP BY
+
+SET optimize_and_compare_chain = 1;
+
+DROP TABLE IF EXISTS t_hint_window;
+CREATE TABLE t_hint_window (k UInt32, v UInt32, w UInt32) ENGINE = MergeTree ORDER BY v SETTINGS index_granularity = 1;
+INSERT INTO t_hint_window SELECT number % 10, 50 + number, 60 + number FROM numbers(100);
+INSERT INTO t_hint_window SELECT number % 10, number, number + 1 FROM numbers(30);
+
+SELECT sum(s) FROM (SELECT k, v, w, sum(v) OVER (PARTITION BY k) AS s FROM t_hint_window QUALIFY v <= w AND w < 41);
+SELECT sum(s) FROM (SELECT k, v, sum(v) OVER (PARTITION BY k) AS s FROM t_hint_window QUALIFY indexHint(v < 41) AND v < 41);
+-- the hinted column is not read anywhere else
+SELECT sum(s) FROM (SELECT k, sum(w) OVER (PARTITION BY k) AS s FROM t_hint_window QUALIFY indexHint(v < 41));
+SELECT sum(s) FROM (SELECT k, sum(w) OVER (PARTITION BY k) AS s FROM t_hint_window QUALIFY indexHint(k < 100 AND indexHint(v < 41)));
+
+DROP TABLE t_hint_window;
+
+-- granules hold rows of two keys, so pruning by a key hint leaves a key with part of its rows
+DROP TABLE IF EXISTS t_hint_key;
+CREATE TABLE t_hint_key (k UInt32, v UInt32) ENGINE = MergeTree ORDER BY k SETTINGS index_granularity = 4;
+INSERT INTO t_hint_key SELECT intDiv(number, 10), number FROM numbers(100);
+
+SELECT count(), sum(s) FROM (SELECT k, count() OVER (PARTITION BY k) AS s FROM t_hint_key QUALIFY indexHint(k = 1));
+SELECT count(), sum(c) FROM (SELECT k, count() AS c FROM t_hint_key GROUP BY k HAVING indexHint(k = 1));
+
+DROP TABLE t_hint_key;
```

---

### Incident Patch 5: `921ad591` (2026-10-07)
**Commit Message**: Merge pull request #123540 from ClickHouse/yarik/whatif-projection-follow-up-fixes

WhatIf projection follow up fixes

**File**: `src/Common/FailPoint.cpp` (modified, +2/-1)
```diff
@@ -455,7 +455,8 @@ static struct InitFiu
     PAUSEABLE_ONCE(intersect_or_except_transform_counts_pause) \
     REGULAR(aggregate_function_state_transfer_throw) \
     REGULAR(aggregate_function_state_transfer_throw_after_child) \
-    REGULAR(marks_loader_hold_task_until_canceled)
+    REGULAR(marks_loader_hold_task_until_canceled) \
+    REGULAR(whatif_projection_scan_cut_short)
 
 namespace FailPoints
 {
```

**File**: `src/Interpreters/Context.cpp` (modified, +1/-0)
```diff
@@ -1522,6 +1522,7 @@ ContextData::ContextData(const ContextData &o) :
     is_background_operation(o.is_background_operation),
     is_ddl_or_on_cluster_internal(o.is_ddl_or_on_cluster_internal),
     is_recovery_from_stored_metadata(o.is_recovery_from_stored_metadata),
+    skip_forced_projection_check(o.skip_forced_projection_check),
     is_view_inner_query(o.is_view_inner_query),
     positional_arguments_already_resolved(o.positional_arguments_already_resolved),
     join_analyze_mode(o.join_analyze_mode),
```

**File**: `src/Interpreters/Context.h` (modified, +5/-0)
```diff
@@ -634,6 +634,8 @@ class ContextData
     /// Set for CREATE queries a Replicated database replays from a definition it already stored.
     /// Such a definition describes existing state, so validation that may reject a new one must not run.
     bool is_recovery_from_stored_metadata = false;
+    /// `EXPLAIN WHATIF` plans the query without the projections that it weighs, so its plans skip the forced projection check
+    bool skip_forced_projection_check = false;
     /// True when this context belongs to the inner query of an expanded view.
     /// Positional arguments inside views must be resolved even on remote/secondary nodes where
     /// enable_positional_arguments would otherwise be skipped (views are expanded on remote nodes,
@@ -1951,6 +1953,9 @@ class Context: public ContextData, public std::enable_shared_from_this<Context>
     void setDDLOrOnClusterInternal(bool value) { is_ddl_or_on_cluster_internal = value; }
 
     bool isRecoveryFromStoredMetadata() const { return is_recovery_from_stored_metadata; }
+
+    bool skipsForcedProjectionCheck() const { return skip_forced_projection_check; }
+    void setSkipForcedProjectionCheck() { skip_forced_projection_check = true; }
     void setRecoveryFromStoredMetadata(bool value) { is_recovery_from_stored_metadata = value; }
 
     bool isViewInnerQuery() const { return is_view_inner_query; }
```

**File**: `src/Processors/QueryPlan/Optimizations/QueryPlanOptimizationSettings.cpp` (modified, +1/-0)
```diff
@@ -416,6 +416,7 @@ QueryPlanOptimizationSettings::QueryPlanOptimizationSettings(ContextPtr from)
             && from->getSettingsRef()[Setting::parallel_replicas_local_plan]
             && from->getSettingsRef()[Setting::parallel_replicas_support_projection])
 {
+    skip_forced_projection_check = from->skipsForcedProjectionCheck();
     distributed_plan_local_object = from->getDistributedPlanLocalObject();
     max_parallel_replicas = from->getSettingsRef()[Setting::max_parallel_replicas];
     if (auto cluster_name = from->getSettingsRef()[Setting::cluster_for_parallel_replicas].value; !cluster_name.empty())
```

**File**: `src/Processors/QueryPlan/Optimizations/QueryPlanOptimizationSettings.h` (modified, +2/-0)
```diff
@@ -173,6 +173,8 @@ struct QueryPlanOptimizationSettings
 
     bool optimize_use_implicit_projections;
     bool force_use_projection;
+    /// `EXPLAIN WHATIF` plans cannot see the projections that it weighs, so a forced projection must not fail them
+    bool skip_forced_projection_check = false;
     String force_projection_name;
 
     /// Bounds the cost of content-hashing IN-clause sets in projection matchers (today: aggregate
```

**File**: `src/Processors/QueryPlan/Optimizations/optimizeTree.cpp` (modified, +2/-1)
```diff
@@ -908,7 +908,8 @@ void optimizeTreeSecondPass(
         }
     }
 
-    if (optimization_settings.force_use_projection && has_reading_from_mt && applied_projection_names.empty())
+    if (optimization_settings.force_use_projection && !optimization_settings.skip_forced_projection_check && has_reading_from_mt
+        && applied_projection_names.empty())
         throw Exception(
             ErrorCodes::PROJECTION_NOT_USED,
             "No projection is used when optimize_use_projections = 1 and force_optimize_projection = 1: {}",
```

**File**: `src/Storages/MergeTree/WhatIfIndexEstimator.cpp` (modified, +22/-10)
```diff
@@ -9,6 +9,7 @@
 #include <Parsers/ASTSelectWithUnionQuery.h>
 #include <Parsers/ASTSetQuery.h>
 #include <Interpreters/parseIdentifiersOrStringLiteralsWithSettings.h>
+#include <Processors/QueryPlan/CreatingSetsStep.h>
 #include <Processors/QueryPlan/QueryPlan.h>
 #include <Processors/QueryPlan/Optimizations/QueryPlanOptimizationSettings.h>
 #include <Processors/QueryPlan/ReadFromMergeTree.h>
@@ -26,6 +27,7 @@
 
 #include <Common/Exception.h>
 #include <Common/quoteString.h>
+#include <Common/typeid_cast.h>
 #include <Core/Settings.h>
 
 namespace DB
@@ -49,16 +51,26 @@ namespace ErrorCodes
 namespace
 {
 
-void collectReadSteps(const QueryPlan::Node * node, std::vector<ReadFromMergeTree *> & steps)
+void collectReadSteps(const QueryPlan::Node * node, std::vector<ReadFromMergeTree *> & steps, bool skip_sets)
 {
-    if (!node)
+    if (!node || (skip_sets && typeid_cast<const CreatingSetStep *>(node->step.get())))
         return;
 
     if (auto * read_step = dynamic_cast<ReadFromMergeTree *>(node->step.get()))
         steps.push_back(read_step);
 
     for (const auto & child : node->children)
-        collectReadSteps(child, steps);
+        collectReadSteps(child, steps, skip_sets);
+}
+
+/// a subquery that only builds a set for `IN` holds the read to estimate only when the query reads no other table
+std::vector<ReadFromMergeTree *> collectReadSteps(const QueryPlan::Node * root)
+{
+    std::vector<ReadFromMergeTree *> steps;
+    collectReadSteps(root, steps, /* skip_sets */ true);
+    if (steps.empty())
+        collectReadSteps(root, steps, /* skip_sets */ false);
+    return steps;
 }
 
 /// Resolve the source table from the query
@@ -325,6 +337,9 @@ WhatIfResult estimateHypotheticalIndexes(
     std::vector<String> forced_strings;
     stripWhatIfControlledSettings(select_query_copy.get(), forced_strings);
 
+    /// the plans of the statement cannot see hypothetical projections, so a forced projection must not fail them
+    local_context->setSkipForcedProjectionCheck();
+
     if (forced_strings.empty() && context->getSettingsRef()[Setting::force_data_skipping_indexes].changed)
         forced_strings.push_back(context->getSettingsRef()[Setting::force_data_skipping_indexes]);
 
@@ -340,13 +355,9 @@ WhatIfResult estimateHypotheticalIndexes(
         plan = std::move(interpreter).extractQueryPlan();
     }
 
-    /// plan as the query would, but a forced projection that is not used must not fail the statement
-    QueryPlanOptimizationSettings optimization_settings(plan_context);
-    optimization_settings.force_use_projection = false;
-    plan.optimize(optimization_settings);
+    plan.optimize(QueryPlanOptimizationSettings(plan_context));
 
-    std::vector<ReadFromMergeTree *> read_steps;
-    collectReadSteps(plan.getRootNode(), read_steps);
+    const auto read_steps = collectReadSteps(plan.getRootNode());
 
     if (read_steps.empty())
     {
@@ -552,7 +563,8 @@ WhatIfResult estimateHypotheticalIndexes(
 
     for (const auto & projection : store.getProjectionsForTable(data.getStorageID()))
         result.candidates.push_back(
-            evaluateProjection(projection, read_step, analysis, baseline_parts, settings, plan.getRootNode(), plan_context));
+            evaluateProjection(
+                projection, read_step, analysis, baseline_parts, settings, plan.getRootNode(), plan_context));
 
     if (result.candidates.empty())
         appendNoCandidatesRow(result);
```

**File**: `src/Storages/MergeTree/WhatIfProjectionEstimator.cpp` (modified, +27/-6)
```diff
@@ -3,6 +3,7 @@
 #include <Access/Common/AccessFlags.h>
 #include <Access/ContextAccess.h>
 #include <Columns/ColumnSparse.h>
+#include <Common/FailPoint.h>
 #include <Common/HashTable/Hash.h>
 #include <Common/SipHash.h>
 #include <Common/Stopwatch.h>
@@ -45,6 +46,11 @@
 namespace DB
 {
 
+namespace FailPoints
+{
+    extern const char whatif_projection_scan_cut_short[];
+}
+
 namespace Setting
 {
     extern const SettingsUInt64 max_rows_to_read;
@@ -280,6 +286,12 @@ bool buildProjectionPart(
     Block block;
     while (executor.pull(block))
     {
+        /// a test stops the read here, as a time limit in `break` mode does
+        bool cut_short = false;
+        fiu_do_on(FailPoints::whatif_projection_scan_cut_short, { cut_short = true; });
+        if (cut_short)
+            break;
+
         if (!block.rows())
             continue;
 
@@ -643,7 +655,7 @@ bool tryEstimateProjection(
     const ConditionTemplate<KeyCondition>::Ptr & part_offset_condition,
     const ConditionTemplate<KeyCondition>::Ptr & total_offset_condition,
     SortOrderHelp sort_help,
-    bool has_filter,
+    bool nothing_to_serve,
     std::string_view relaxing_setting,
     ReadFromMergeTree * read_step,
     const RangesInDataParts & baseline_parts,
@@ -739,6 +751,14 @@ bool tryEstimateProjection(
                 = "The projection scan hit the read limit of the query (max_rows_to_read / max_bytes_to_read)";
             return false;
         }
+        /// a time limit in `break` mode or a cancelled query stops the read without an error
+        if (part_data.rows != part->index_granularity->getRowsCountInRanges(ranges))
+        {
+            result.empirical_unsupported_reason = "The projection scan was cut short by a time limit in `break` mode or a cancelled query";
+            /// the same time limit also stops the output, so only the log shows why the estimate is missing
+            LOG_DEBUG(log, "{}", result.empirical_unsupported_reason);
+            return false;
+        }
 
         ++scanned_parts;
         scanned_marks += ranges.getNumberOfMarks();
@@ -839,7 +859,6 @@ bool tryEstimateProjection(
     }
 
     /// with `relaxing_setting` the optimizer takes any usable projection
-    const bool nothing_to_serve = !has_filter && sort_help != SortOrderHelp::Helps;
     if (!relaxing_setting.empty() && (result.verdict != "chosen" || nothing_to_serve))
     {
         String cost;
@@ -1069,13 +1088,15 @@ WhatIfCandidateResult evaluateProjection(
             key_condition.reset();
     }
 
-    /// both lift the gate below; read from the read's own context, as the optimizer does
+    /// read the setting from the context of the read, as the optimizer does
     const auto & read_settings = read_step->getContext()->getSettingsRef();
     const std::string_view relaxing_setting = read_settings[Setting::force_optimize_projection] ? "force_optimize_projection"
         : read_settings[Setting::prefer_optimize_projection] ? "prefer_optimize_projection" : "";
 
-    /// same gate as the optimizer: needs a filter or a useful sort order
-    if (!filter_dag && sort_help != SortOrderHelp::Helps && relaxing_setting.empty())
+    /// as the optimizer does: without a filter, any `ORDER BY` passes if `optimize_read_in_order` is on
+    const bool nothing_to_serve
+        = !filter_dag && (sort_help == SortOrderHelp::NoOrderBy || sort_help == SortOrderHelp::ReadInOrderDisabled);
+    if (nothing_to_serve && relaxing_setting.empty())
     {
         result.not_applicable_reason = fmt::format("Query has no filter predicate, and {}", describe(sort_help));
         return result;
@@ -1087,7 +1108,7 @@ WhatIfCandidateResult evaluateProjection(
     {
         if (tryEstimateProjection(
                 result, *projection, key_condition ? &*key_condition : nullptr, part_offset_condition, total_offset_condition,
-                sort_help, filter_dag != nullptr, relaxing_setting, read_step, baseline_parts, analysis.selected_marks,
+                sort_help, nothing_to_serve, relaxing_setting, read_step, baseline_parts, analysis.selected_marks,
                 settings.projection_scan_budget_rows, context))
             return result;
         result.empirical_status = WhatIfCandidateResult::Unsupported;
```

---

### Incident Patch 6: `8e63bd03` (2026-10-07)
**Commit Message**: Merge pull request #122017 from groeneai/fix-identifier-cache-quoted-dotted-alias

Fix the identifier resolution cache conflating a quoted dotted identifier with a qualified one

**File**: `src/Analyzer/Resolve/IdentifierLookup.h` (modified, +7/-2)
```diff
@@ -42,6 +42,7 @@ inline const char * toStringLowercase(IdentifierLookupContext identifier_lookup_
   */
 struct IdentifierLookup
 {
+    /// Part boundaries are part of a lookup's identity: quoted `a.b` is one part, `a`.`b` is two.
     Identifier identifier;
     IdentifierLookupContext lookup_context;
     ASTPtr original_ast_node = nullptr;
@@ -85,7 +86,7 @@ struct IdentifierLookup
 
 inline bool operator==(const IdentifierLookup & lhs, const IdentifierLookup & rhs)
 {
-    return lhs.identifier.getFullName() == rhs.identifier.getFullName()
+    return lhs.identifier.getParts() == rhs.identifier.getParts()
         && lhs.lookup_context == rhs.lookup_context
         && lhs.is_matcher_qualifier == rhs.is_matcher_qualifier
         && lhs.allow_ambiguous_join_tree_identifier == rhs.allow_ambiguous_join_tree_identifier;
@@ -100,7 +101,11 @@ struct IdentifierLookupHash
 {
     size_t operator()(const IdentifierLookup & identifier_lookup) const
     {
-        return std::hash<std::string>()(identifier_lookup.identifier.getFullName())
+        size_t hash = std::hash<std::string>()(identifier_lookup.identifier.getFullName());
+        for (const auto & part : identifier_lookup.identifier.getParts())
+            hash = hash * 31 + part.size();
+
+        return hash
             ^ static_cast<uint8_t>(identifier_lookup.lookup_context)
             ^ (static_cast<size_t>(identifier_lookup.is_matcher_qualifier) << 8)
             ^ (static_cast<size_t>(identifier_lookup.allow_ambiguous_join_tree_identifier) << 9);
```

**File**: `tests/queries/0_stateless/05255_analyzer_identifier_cache_quoted_dotted_alias.reference` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+-- quoted dotted alias in HAVING --
+11.25
+11.25
+-- equal part count, different boundaries --
+1	2
+1	2
```

**File**: `tests/queries/0_stateless/05255_analyzer_identifier_cache_quoted_dotted_alias.sql` (added, +24/-0)
```diff
@@ -0,0 +1,24 @@
+-- A quoted identifier whose name contains a dot is one identifier, not a qualified reference, so
+-- HAVING on the quoted alias `t1.c1` binds to the projection alias and not to column `c1` of the
+-- table aliased `t1`. Enabling the identifier resolution cache must not change that.
+-- The second case is the same rule with the dot in different places: `a.b`.c and a.`b.c` read the
+-- same dotted name, both are qualified, and they denote different columns.
+-- https://github.com/ClickHouse/ClickHouse/issues/121911
+
+DROP TABLE IF EXISTS t1;
+CREATE TABLE t1 (c0 String, c1 Nullable(Float64)) ENGINE = MergeTree ORDER BY c0;
+INSERT INTO t1 SELECT toString(number), number / 4 FROM numbers(10);
+
+SELECT '-- quoted dotted alias in HAVING --';
+SELECT sum(t1.c1) AS `t1.c1` FROM t1 AS t1 HAVING `t1.c1` > 0
+SETTINGS enable_identifier_resolve_cache = 0;
+SELECT sum(t1.c1) AS `t1.c1` FROM t1 AS t1 HAVING `t1.c1` > 0
+SETTINGS enable_identifier_resolve_cache = 1;
+
+SELECT '-- equal part count, different boundaries --';
+SELECT `a.b`.c, a.`b.c` FROM (SELECT 1 AS c) AS `a.b`, (SELECT 2 AS `b.c`) AS a
+SETTINGS enable_identifier_resolve_cache = 0;
+SELECT `a.b`.c, a.`b.c` FROM (SELECT 1 AS c) AS `a.b`, (SELECT 2 AS `b.c`) AS a
+SETTINGS enable_identifier_resolve_cache = 1;
+
+DROP TABLE t1;
```

---

### Incident Patch 7: `0c6aafd6` (2026-10-07)
**Commit Message**: Revert sampling and event-loss documentation caveat

**File**: `docs/products/managed-postgres/monitoring/metrics.mdx` (modified, +0/-2)
```diff
@@ -95,8 +95,6 @@ turn them into per-second values.
 ## Query performance {#query-performance}
 
 Counters from recorded Query Insights events, excluding `UTILITY` operations.
-These counters may undercount the actual workload when events are sampled or
-dropped under pressure.
 
 | Metric                                     | Type    | Unit         | Description |
 | ------------------------------------------ | ------- | ------------ | ----------- |
```

---

### Incident Patch 8: `b7ce5f8e` (2026-10-07)
**Commit Message**: Merge pull request #123834 from aschoube/fix-bloom-filter-signed-zero

Look up both signed zeros in a bloom_filter index

**File**: `src/Storages/MergeTree/MergeTreeIndexBloomFilter.cpp` (modified, +68/-7)
```diff
@@ -30,6 +30,7 @@
 #include <Storages/MergeTree/MergeTreeData.h>
 #include <Storages/MergeTree/MergeTreeIndexJSONSubcolumnHelper.h>
 #include <Storages/MergeTree/RPNBuilder.h>
+#include <cmath>
 
 
 namespace DB
@@ -624,6 +625,58 @@ bool MergeTreeIndexConditionBloomFilter::traverseFunction(const RPNBuilderTreeNo
     return false;
 }
 
+/// `-0.0 = 0.0`, but the index holds the hash of each value's bits, and the bits of the two zeros differ.
+static bool isFloatZero(const DataTypePtr & type, const Field & field)
+{
+    return isFloat(removeLowCardinalityAndNullable(type)) && field.getType() == Field::Types::Float64 && field.safeGet<Float64>() == 0;
+}
+
+static Field otherFloatZero(const Field & zero)
+{
+    return std::signbit(zero.safeGet<Float64>()) ? Field(0.0) : Field(-0.0);
+}
+
+/// The hash of `field`, and for a float zero also the hash of the other zero. A predicate with several
+/// hashes matches a granule that may hold any of them, except for `FUNCTION_HAS_ALL`.
+static ColumnPtr hashWithFieldAndOtherZero(const DataTypePtr & type, const Field & field)
+{
+    ColumnPtr hash = BloomFilterHash::hashWithField(type.get(), field);
+    if (!isFloatZero(type, field))
+        return hash;
+
+    auto hashes = ColumnUInt64::create();
+    hashes->insertValue(hash->getUInt(0));
+    hashes->insertValue(BloomFilterHash::hashWithField(type.get(), otherFloatZero(field))->getUInt(0));
+    return hashes;
+}
+
+/// The hashes of the values in `column`, and for each float zero also the hash of the other zero.
+/// Sets `has_float_zero` if there is one, which `FUNCTION_HAS_ALL` cannot express.
+static ColumnPtr hashWithColumnAndOtherZeros(const DataTypePtr & type, const ColumnPtr & column, bool & has_float_zero)
+{
+    has_float_zero = false;
+    ColumnPtr hashes = BloomFilterHash::hashWithColumn(type, column, 0, column->size());
+    if (!isFloat(removeLowCardinalityAndNullable(type)))
+        return hashes;
+
+    MutableColumnPtr result;
+    for (size_t i = 0; i < column->size(); ++i)
+    {
+        Field value = (*column)[i];
+        if (!isFloatZero(type, value))
+            continue;
+
+        if (!result)
+            result = IColumn::mutate(hashes->convertToFullColumnIfConst());
+        has_float_zero = true;
+        assert_cast<ColumnUInt64 &>(*result).insertValue(BloomFilterHash::hashWithField(type.get(), otherFloatZero(value))->getUInt(0));
+    }
+
+    if (result)
+        return result;
+    return hashes;
+}
+
 /// True when converting the constant to the element type yields the exact bytes the index holds, so
 /// hashing it is equivalent to the comparison. Floats are excluded: `-0.0` equals but hashes apart.
 static bool bloomFilterHashDomainMatches(const DataTypePtr & value_type, const DataTypePtr & nested_type)
@@ -774,7 +827,7 @@ bool MergeTreeIndexConditionBloomFilter::traverseTreeIn(
             size_t position = map_info->keys_index_position;
             const DataTypePtr & index_type = header.getByPosition(position).type;
             const DataTypePtr actual_type = BloomFilter::getPrimitiveType(index_type);
-            out.predicate.emplace_back(std::make_pair(position, BloomFilterHash::hashWithField(actual_type.get(), map_info->key_field)));
+            out.predicate.emplace_back(std::make_pair(position, hashWithFieldAndOtherZero(actual_type, map_info->key_field)));
         }
         else if (map_info->has_values_index)
         {
@@ -1127,7 +1180,7 @@ bool MergeTreeIndexConditionBloomFilter::traverseTreeEquals(
                     if (converted_field.isNull())
                         return false;
 
-                    out.predicate.emplace_back(std::make_pair(position, BloomFilterHash::hashWithField(actual_type.get(), converted_field)));
+                    out.predicate.emplace_back(std::make_pair(position, hashWithFieldAndOtherZero(actual_type, converted_field)));
                 }
             }
             else if (function_name == "has")
@@ -1141,7 +1194,8 @@ bool MergeTreeIndexConditionBloomFilter::traverseTreeEquals(
                     return false;
 
                 out.function = RPNElement::FUNCTION_HAS_ANY;
-                out.predicate.emplace_back(std::make_pair(position, BloomFilterHash::hashWithColumn(actual_type, column, 0, column->size())));
+                bool has_float_zero = false;
+                out.predicate.emplace_back(std::make_pair(position, hashWithColumnAndOtherZeros(actual_type, column, has_float_zero)));
             }
         }
         else if (function_name == "hasAny" || function_name == "hasAll")
@@ -1155,10 +1209,17 @@ bool MergeTreeIndexConditionBloomFilter::traverseTreeEquals(
             if (!column)
                 return false;
 
+            bool has_float_zero = false;
+            ColumnPtr hashes = hashWithColumnAndOtherZeros(actual_type, column, has_float_zero);
+
+            /// `hasAll` needs one of the two zeros in the granule, while `FUNCTION_HAS_ALL` needs every hash.
+            if (function_na
```

**File**: `tests/queries/0_stateless/05325_bloom_filter_signed_zero.reference` (added, +16/-0)
```diff
@@ -0,0 +1,16 @@
+f = 0	[1,3]	[1,3]
+f = -0.0	[1,3]	[1,3]
+g = 0	[1,3]	[1,3]
+has([0.0, 0.5], f)	[1,2,3]	[1,2,3]
+has(a, 0)	[1,3]	[1,3]
+hasAny(a, [0.0])	[1,3]	[1,3]
+hasAll(a, [-0.0])	[1,3]	[1,3]
+mapContainsKey(m, 0.0)	[1,3]	[1,3]
+m[0.0] = \'x\'	[1,3]	[1,3]
+m[0.0] IN (\'x\')	[1,3]	[1,3]
+f IN (0.0)	[3]	[3]
+f = 0.5	[2]	[2]
+mapContainsValue(mv, 0.0)	[1,3]	[1,3]
+mv[\'a\'] IN (0.0)	[3]	[3]
+pruned for 0	1
+pruned for 42	1
```

**File**: `tests/queries/0_stateless/05325_bloom_filter_signed_zero.sql` (added, +70/-0)
```diff
@@ -0,0 +1,70 @@
+-- `-0.0 = 0.0`, but a `bloom_filter` index holds the hash of each value's bits, which differ for the two
+-- zeros. A lookup of a zero must not skip the granule holding the other zero. Each query compares the
+-- result with the index against the result without it.
+-- https://github.com/ClickHouse/ClickHouse/issues/123744
+
+SET use_query_condition_cache = 0;
+
+DROP TABLE IF EXISTS t_bf_signed_zero;
+CREATE TABLE t_bf_signed_zero
+(
+    id UInt64,
+    f Float64,
+    g Float32,
+    a Array(Float64),
+    m Map(Float64, String),
+    INDEX idx_f f TYPE bloom_filter GRANULARITY 1,
+    INDEX idx_g g TYPE bloom_filter GRANULARITY 1,
+    INDEX idx_a a TYPE bloom_filter GRANULARITY 1,
+    INDEX idx_m mapKeys(m) TYPE bloom_filter GRANULARITY 1
+)
+ENGINE = MergeTree ORDER BY id SETTINGS index_granularity = 1;
+
+INSERT INTO t_bf_signed_zero VALUES (1, -0.0, -0.0, [-0.0], map(-0.0, 'x')), (2, 0.5, 0.5, [0.5], map(0.5, 'x')), (3, 0.0, 0.0, [0.0], map(0.0, 'x'));
+
+SELECT 'f = 0', arraySort(groupArray(id)), (SELECT arraySort(groupArray(id)) FROM t_bf_signed_zero WHERE f = 0 SETTINGS use_skip_indexes = 0) FROM t_bf_signed_zero WHERE f = 0;
+SELECT 'f = -0.0', arraySort(groupArray(id)), (SELECT arraySort(groupArray(id)) FROM t_bf_signed_zero WHERE f = -0.0 SETTINGS use_skip_indexes = 0) FROM t_bf_signed_zero WHERE f = -0.0;
+SELECT 'g = 0', arraySort(groupArray(id)), (SELECT arraySort(groupArray(id)) FROM t_bf_signed_zero WHERE g = 0 SETTINGS use_skip_indexes = 0) FROM t_bf_signed_zero WHERE g = 0;
+SELECT 'has([0.0, 0.5], f)', arraySort(groupArray(id)), (SELECT arraySort(groupArray(id)) FROM t_bf_signed_zero WHERE has([0.0, 0.5], f) SETTINGS use_skip_indexes = 0) FROM t_bf_signed_zero WHERE has([0.0, 0.5], f);
+SELECT 'has(a, 0)', arraySort(groupArray(id)), (SELECT arraySort(groupArray(id)) FROM t_bf_signed_zero WHERE has(a, 0) SETTINGS use_skip_indexes = 0) FROM t_bf_signed_zero WHERE has(a, 0);
+SELECT 'hasAny(a, [0.0])', arraySort(groupArray(id)), (SELECT arraySort(groupArray(id)) FROM t_bf_signed_zero WHERE hasAny(a, [0.0]) SETTINGS use_skip_indexes = 0) FROM t_bf_signed_zero WHERE hasAny(a, [0.0]);
+SELECT 'hasAll(a, [-0.0])', arraySort(groupArray(id)), (SELECT arraySort(groupArray(id)) FROM t_bf_signed_zero WHERE hasAll(a, [-0.0]) SETTINGS use_skip_indexes = 0) FROM t_bf_signed_zero WHERE hasAll(a, [-0.0]);
+SELECT 'mapContainsKey(m, 0.0)', arraySort(groupArray(id)), (SELECT arraySort(groupArray(id)) FROM t_bf_signed_zero WHERE mapContainsKey(m, 0.0) SETTINGS use_skip_indexes = 0) FROM t_bf_signed_zero WHERE mapContainsKey(m, 0.0);
+-- With `optimize_functions_to_subcolumns = 0`, `m[0.0]` on a `Map(Float64, String)` throws `ILLEGAL_TYPE_OF_ARGUMENT`
+-- even without an index, so the setting is pinned for the queries that use it.
+SET optimize_functions_to_subcolumns = 1;
+SELECT 'm[0.0] = \'x\'', arraySort(groupArray(id)), (SELECT arraySort(groupArray(id)) FROM t_bf_signed_zero WHERE m[0.0] = 'x' SETTINGS use_skip_indexes = 0) FROM t_bf_signed_zero WHERE m[0.0] = 'x';
+-- The key of `m[k]` is looked up by equality, also when the value is compared with `IN`.
+SELECT 'm[0.0] IN (\'x\')', arraySort(groupArray(id)), (SELECT arraySort(groupArray(id)) FROM t_bf_signed_zero WHERE m[0.0] IN ('x') SETTINGS use_skip_indexes = 0) FROM t_bf_signed_zero WHERE m[0.0] IN ('x');
+-- `IN` compares bits, with and without the index.
+SELECT 'f IN (0.0)', arraySort(groupArray(id)), (SELECT arraySort(groupArray(id)) FROM t_bf_signed_zero WHERE f IN (0.0) SETTINGS use_skip_indexes = 0) FROM t_bf_signed_zero WHERE f IN (0.0);
+SELECT 'f = 0.5', arraySort(groupArray(id)), (SELECT arraySort(groupArray(id)) FROM t_bf_signed_zero WHERE f = 0.5 SETTINGS use_skip_indexes = 0) FROM t_bf_signed_zero WHERE f = 0.5;
+
+SET optimize_functions_to_subcolumns = DEFAULT;
+
+DROP TABLE t_bf_signed_zero;
+
+-- A `mapValues` index: `mapContainsValue` looks up both zeros, `IN` on the value compares bits.
+DROP TABLE IF EXISTS t_bf_signed_zero_map_values;
+CREATE TABLE t_bf_signed_zero_map_values (id UInt64, mv Map(String, Float64), INDEX idx_mv mapValues(mv) TYPE bloom_filter GRANULARITY 1)
+ENGINE = MergeTree ORDER BY id SETTINGS index_granularity = 1;
+INSERT INTO t_bf_signed_zero_map_values VALUES (1, map('a', -0.0)), (2, map('a', 0.5)), (3, map('a', 0.0));
+
+SELECT 'mapContainsValue(mv, 0.0)', arraySort(groupArray(id)), (SELECT arraySort(groupArray(id)) FROM t_bf_signed_zero_map_values WHERE mapContainsValue(mv, 0.0) SETTINGS use_skip_indexes = 0) FROM t_bf_signed_zero_map_values WHERE mapContainsValue(mv, 0.0);
+SET optimize_functions_to_subcolumns = 1;
+SELECT 'mv[\'a\'] IN (0.0)', arraySort(groupArray(id)), (SELECT arraySort(groupArray(id)) FROM t_bf_signed_zero_map_values WHERE mv['a'] IN (0.0) SETTINGS use_skip_indexes = 0) FROM t_bf_signed_zero_map_values WHERE mv['a'] IN (0.0);
+
+SET optimize_functions_to_subcolumns = DEFAULT;
+
+DROP TABLE t_bf_signed_zero_map_values;
+
+-- A zero is looked up as two hashes, so 
```

---

### Incident Patch 9: `8423e00a` (2026-10-07)
**Commit Message**: Merge pull request #124291 from ClickHouse/clang-format-fix

Allow short functions on a single line outside class bodies

**File**: `.clang-format` (modified, +1/-1)
```diff
@@ -25,7 +25,7 @@ Standard: Cpp11
 PointerAlignment: Middle
 MaxEmptyLinesToKeep: 2
 KeepEmptyLinesAtTheStartOfBlocks: false
-AllowShortFunctionsOnASingleLine: InlineOnly
+AllowShortFunctionsOnASingleLine: All
 AlwaysBreakTemplateDeclarations: true
 IndentCaseLabels: true
 SpaceAfterTemplateKeyword: true
```

---

### Incident Patch 10: `49ffde58` (2026-10-07)
**Commit Message**: Merge pull request #121672 from ClickHouse/fix-replicated-merge-tree-startup-shutdown-race

Fix `StorageReplicatedMergeTree` `startup`/`shutdown` races

**File**: `src/Storages/MergeTree/MergeTreeData.cpp` (modified, +10/-2)
```diff
@@ -3487,6 +3487,7 @@ void MergeTreeData::startStatisticsCache()
 {
     const auto settings = getSettings();
     UInt64 refresh_statistics_seconds = (*settings)[MergeTreeSetting::refresh_statistics_interval].totalSeconds();
+    std::lock_guard lock(refresh_stats_task_mutex);
     if (refresh_stats_task)
         refresh_stats_task->deactivate();
     if (refresh_statistics_seconds)
@@ -3500,6 +3501,14 @@ void MergeTreeData::startStatisticsCache()
     }
 }
 
+void MergeTreeData::stopStatisticsCache()
+{
+    /// The task itself does not take the mutex, so waiting for it in `deactivate` under the lock is safe.
+    std::lock_guard lock(refresh_stats_task_mutex);
+    if (refresh_stats_task)
+        refresh_stats_task->deactivate();
+}
+
 void MergeTreeData::refreshDataParts(UInt64 interval_milliseconds)
 try
 {
@@ -3714,8 +3723,7 @@ MergeTreeData::~MergeTreeData()
         stopOutdatedAndUnexpectedDataPartsLoadingTask();
         if (refresh_parts_task)
             refresh_parts_task->deactivate();
-        if (refresh_stats_task)
-            refresh_stats_task->deactivate();
+        stopStatisticsCache();
     }
     catch (...)
     {
```

**File**: `src/Storages/MergeTree/MergeTreeData.h` (modified, +5/-0)
```diff
@@ -2225,12 +2225,17 @@ class MergeTreeData : public WithMutableContext, public IStorage, public IBackgr
     /// not done under a single lock).
     std::mutex refresh_parts_mutex;
 
+    /// Protects `refresh_stats_task` itself: `startStatisticsCache` re-assigns the holder (on startup and
+    /// on `ALTER` of `refresh_statistics_interval`), which may race with `stopStatisticsCache` called from
+    /// a concurrent `shutdown`. Declared before the holder, so it outlives it.
+    std::mutex refresh_stats_task_mutex;
     BackgroundSchedulePoolTaskHolder refresh_stats_task;
 
     mutable std::mutex stats_mutex;
     ConditionSelectivityEstimatorPtr cached_estimator;
 
     void startStatisticsCache();
+    void stopStatisticsCache();
     void refreshStatistics(UInt64 interval_seconds);
 
     static void incrementInsertedPartsProfileEvent(MergeTreeDataPartType type);
```

**File**: `src/Storages/MergeTree/ReplicatedMergeTreeAttachThread.cpp` (modified, +43/-4)
```diff
@@ -44,16 +44,54 @@ ReplicatedMergeTreeAttachThread::~ReplicatedMergeTreeAttachThread()
 
 void ReplicatedMergeTreeAttachThread::start()
 {
+    /// A `startup()` racing with a `DETACH` can get here after `shutdown()` has already run;
+    /// don't re-arm the task in that case (it would pointlessly re-run the initialization).
+    /// If `shutdown()` runs between this check and `activateAndSchedule`, the repeated
+    /// `shutdown()` call from `StorageReplicatedMergeTree::shutdown` deactivates the task again.
+    if (shutdown_called)
+    {
+        /// There will be no first try — unblock `waitFirstTry`.
+        if (!first_try_done.exchange(true))
+            first_try_done.notify_one();
+        return;
+    }
+
     task->activateAndSchedule();
+
+    /// Close the check-then-act race with `shutdown()`: if `shutdown()` ran entirely between the
+    /// `shutdown_called` check above and `activateAndSchedule()`, its `task->deactivate()` observed the
+    /// task still inactive and was a no-op, so the task we just re-armed would run its first try after
+    /// shutdown. Re-check and deactivate here. `shutdown()` deactivates unconditionally, so whichever
+    /// ordering wins, the task ends up deactivated:
+    ///   - `shutdown()` observed before this re-check: we deactivate the task we armed;
+    ///   - `shutdown()` observed after this re-check: its own `deactivate()` cancels the armed task.
+    /// `deactivate()` is idempotent, so a concurrent deactivate from both sides is safe. Unblock
+    /// `waitFirstTry` here too, so the waiter always wakes even if it observes our deactivation.
+    if (shutdown_called)
+    {
+        task->deactivate();
+        if (!first_try_done.exchange(true))
+            first_try_done.notify_one();
+    }
 }
 
 void ReplicatedMergeTreeAttachThread::shutdown()
 {
     if (!shutdown_called.exchange(true))
-    {
-        task->deactivate();
         LOG_INFO(log, "Attach thread finished");
-    }
+
+    /// Deactivate unconditionally, not only on the first call: a racing `start()` can re-activate
+    /// the task after the first `shutdown()` already deactivated it. Deactivation is idempotent.
+    task->deactivate();
+
+    /// After `deactivate()` returns, the task is guaranteed to be neither running nor scheduled, so the
+    /// first try will never run again. If `start()` had scheduled the first attempt but a racing
+    /// `shutdown()` cancelled it before the pool ever executed `run()`, `first_try_done` would still be
+    /// `false` and `StorageReplicatedMergeTree::startup`'s `waitFirstTry()` would block forever, turning
+    /// the `DETACH`-vs-startup race this class handles into a hang. Publish and notify `first_try_done`
+    /// here so the waiter always wakes on shutdown (this is a no-op if `run()` already set it).
+    if (!first_try_done.exchange(true))
+        first_try_done.notify_one();
 }
 
 void ReplicatedMergeTreeAttachThread::run()
@@ -97,7 +135,8 @@ void ReplicatedMergeTreeAttachThread::run()
     if (!first_try_done.exchange(true))
         first_try_done.notify_one();
 
-    if (shutdown_called)
+    /// Also stop retrying once the storage itself is being shut down: there is nothing to start up anymore.
+    if (shutdown_called || storage.shutdown_prepared_called || storage.shutdown_called)
     {
         if (std::exchange(storage.is_readonly_metric_set, false))
         {
```

**File**: `src/Storages/StorageMergeTree.cpp` (modified, +1/-2)
```diff
@@ -340,8 +340,7 @@ void StorageMergeTree::shutdown(bool)
     if (refresh_parts_task)
         refresh_parts_task->deactivate();
 
-    if (refresh_stats_task)
-        refresh_stats_task->deactivate();
+    stopStatisticsCache();
 
     stopOutdatedAndUnexpectedDataPartsLoadingTask();
 
```

**File**: `src/Storages/StorageReplicatedMergeTree.cpp` (modified, +120/-28)
```diff
@@ -5960,6 +5960,30 @@ void StorageReplicatedMergeTree::startup()
     auto component_guard = Coordination::setCurrentComponent("StorageReplicatedMergeTree::startup");
     startOutdatedAndUnexpectedDataPartsLoadingTask();
     startStatisticsCache();
+
+    /// A concurrent `shutdown()` (e.g. a `DETACH` racing with this async startup) may have already set
+    /// `shutdown_called`. `shutdown()` publishes that flag before deactivating the periodic tasks, so if
+    /// we observe it here — after arming — we must deactivate the tasks we just re-armed; otherwise a
+    /// logically shut-down table would keep doing periodic work until some later `shutdown()` stops it.
+    /// Also stop right here: continuing into `attach_thread->start()` / `startupImpl` would pointlessly
+    /// re-arm the attach/restarting threads that `flushAndPrepareForShutdown()` has already shut down.
+    /// The same applies when only `flushAndPrepareForShutdown()` has run so far (server or database
+    /// shutdown calls it for all tables before `shutdown()`): it has already stopped the attach and
+    /// restarting threads, and a late startup must not restart background work after that.
+    /// Neither `shutdown_called` nor `shutdown_prepared_called` is ever reset, so this storage object is
+    /// only going to be shut down and destroyed — there is nothing to start up. This check is best-effort
+    /// (the flags can flip right after it); whatever a startup that slipped past it re-arms is torn down
+    /// again by the `already_called` branch of `shutdown`, either via the cleanup path of `startupImpl` or
+    /// at the latest by the destructor.
+    if (shutdown_called.load() || shutdown_prepared_called.load())
+    {
+        if (refresh_parts_task)
+            refresh_parts_task->deactivate();
+        stopStatisticsCache();
+        stopOutdatedAndUnexpectedDataPartsLoadingTask();
+        return;
+    }
+
     if (attach_thread)
     {
         attach_thread->start();
@@ -5985,19 +6009,26 @@ void StorageReplicatedMergeTree::startupImpl(bool from_attach_thread, const ZooK
     try
     {
         auto zookeeper = getZooKeeper();
-        InterserverIOEndpointPtr data_parts_exchange_ptr = std::make_shared<DataPartsExchange::Service>(*this);
-        [[maybe_unused]] auto prev_ptr = std::atomic_exchange(&data_parts_exchange_endpoint, data_parts_exchange_ptr);
-        chassert(prev_ptr == nullptr);
-
-        /// The endpoint id:
-        ///     old format: DataPartsExchange:/clickhouse/tables/default/t1/{shard}/{replica}
-        ///     new format: DataPartsExchange:{zookeeper_name}:/clickhouse/tables/default/t1/{shard}/{replica}
-        /// Notice:
-        ///     They are incompatible and the default is the old format.
-        ///     If you want to use the new format, please ensure that 'enable_the_endpoint_id_with_zookeeper_name_prefix' of all nodes is true .
-        ///
-        getContext()->getInterserverIOHandler().addEndpoint(
-            data_parts_exchange_ptr->getId(getEndpointName()), data_parts_exchange_ptr);
+
+        /// A failed previous attempt of the attach thread leaves the endpoint registered (see the cleanup below),
+        /// so a retry reuses it. The endpoint is published only after it has been registered successfully.
+        if (!std::atomic_load(&data_parts_exchange_endpoint))
+        {
+            InterserverIOEndpointPtr data_parts_exchange_ptr = std::make_shared<DataPartsExchange::Service>(*this);
+
+            /// The endpoint id:
+            ///     old format: DataPartsExchange:/clickhouse/tables/default/t1/{shard}/{replica}
+            ///     new format: DataPartsExchange:{zookeeper_name}:/clickhouse/tables/default/t1/{shard}/{replica}
+            /// Notice:
+            ///     They are incompatible and the default is the old format.
+            ///     If you want to use the new format, please ensure that 'enable_the_endpoint_id_with_zookeeper_name_prefix' of all nodes is true .
+            ///
+            getContext()->getInterserverIOHandler().addEndpoint(
+                data_parts_exchange_ptr->getId(getEndpointName()), data_parts_exchange_ptr);
+
+            [[maybe_unused]] auto prev_ptr = std::atomic_exchange(&data_parts_exchange_endpoint, data_parts_exchange_ptr);
+            chassert(prev_ptr == nullptr);
+        }
 
         startBeingLeader(zookeeper_retries_info);
 
@@ -6055,15 +6086,10 @@ void StorageReplicatedMergeTree::startupImpl(bool from_attach_thread, const ZooK
             {
                 restarting_thread.shutdown(/* part_of_full_shutdown */false);
 
-                auto data_parts_exchange_ptr = std::atomic_exchange(&data_parts_exchange_endpoint, InterserverIOEndpointPtr{});
-                if (data_parts_exchange_ptr)
-                {
-                    getContext()->getInterserverIOHandler().removeEndpointIfExists(data_parts_exchange_ptr->getId(getEndpointName()));
-                    /// Ask all parts exchange handlers to f
```

**File**: `src/Storages/StorageReplicatedMergeTree.h` (modified, +5/-0)
```diff
@@ -484,6 +484,11 @@ class StorageReplicatedMergeTree final : public MergeTreeData
     std::atomic<bool> shutdown_prepared_called {false};
     std::optional<ShutdownDeadline> shutdown_deadline;
 
+    /// Serializes concurrent calls to shutdown(). A repeated call (e.g. from the failure path of
+    /// startupImpl racing with the first, full shutdown) tears down whatever a concurrent startup()
+    /// re-armed, and some of the members it touches are not atomic.
+    std::mutex shutdown_mutex;
+
     /// We call flushAndPrepareForShutdown before acquiring DDLGuard, so we can shutdown a table that is being created right now
     mutable std::mutex flush_and_shutdown_mutex;
 
```

---

### Incident Patch 11: `59b3ac7d` (2026-10-07)
**Commit Message**: Merge pull request #124327 from groeneai/fix-keeper-lock-timeout-background-callers

Report the Keeper client lock timeout to background callers as a retryable Keeper error

**File**: `src/Core/Settings.cpp` (modified, +1/-1)
```diff
@@ -6001,7 +6001,7 @@ Possible values:
 Defines how many milliseconds a Keeper client waits to acquire the corresponding `Context` mutex before failing.
 
 The value is taken from the `Context` that performs the acquisition. A per-query override applies only when the operation uses the query context, such as reads from `system.zookeeper`, `zookeeperSessionUptime`, `SYSTEM RECONNECT ZOOKEEPER`, and query-context auxiliary Keeper access.
-Operations that use a global or background context, including `BACKUP` and `RESTORE` coordination and `Replicated` database activity, use that context's value instead.
+Operations that use a global or background context, including `BACKUP` and `RESTORE` coordination and `Replicated` database activity, use that context's value instead, and get the timeout as a Keeper error (`ZOPERATIONTIMEOUT`) that they handle like other Keeper errors.
 `SYSTEM RELOAD CONFIG` and `SYSTEM RELOAD ASYNCHRONOUS METRICS` are not covered because they use independently serialized reload paths.
 
 Possible values:
```

**File**: `src/Interpreters/Context.cpp` (modified, +11/-1)
```diff
@@ -6500,19 +6500,29 @@ void recordZooKeeperConnectionLoss()
 std::unique_lock<std::timed_mutex> acquireZooKeeperLock(
     const Context & context, std::timed_mutex & mutex, const char * lock_name)
 {
+    const bool has_query_context = context.hasQueryContext();
     auto lock_acquire_timeout = context.getSettingsRef()[Setting::get_zookeeper_lock_acquire_timeout_ms];
-    if (context.hasQueryContext())
+    if (has_query_context)
         lock_acquire_timeout = context.getQueryContext()->getSettingsRef()[Setting::get_zookeeper_lock_acquire_timeout_ms];
 
     std::unique_lock lock(mutex, std::defer_lock);
     if (lock_acquire_timeout.totalMilliseconds() == 0)
         lock.lock();
     else if (!lock.try_lock_for(std::chrono::milliseconds(lock_acquire_timeout.totalMilliseconds())))
+    {
+        /// Without a query context, report a Keeper error, handled like a lost connection; a query fails fast instead.
+        if (!has_query_context)
+            throw Coordination::Exception(
+                Coordination::Error::ZOPERATIONTIMEOUT,
+                "Timeout exceeded while acquiring {} ({} ms)",
+                lock_name,
+                lock_acquire_timeout.totalMilliseconds());
         throw Exception(
             ErrorCodes::TIMEOUT_EXCEEDED,
             "Timeout exceeded while acquiring {} ({} ms)",
             lock_name,
             lock_acquire_timeout.totalMilliseconds());
+    }
 
     return lock;
 }
```

**File**: `tests/integration/test_zookeeper_lock_acquire_timeout/configs/background_lock_timeout.xml` (added, +12/-0)
```diff
@@ -0,0 +1,12 @@
+<clickhouse>
+    <profiles>
+        <default>
+            <!-- The global context takes its settings from this profile, so background Keeper users stop waiting for a busy client lock after 1 s. -->
+            <get_zookeeper_lock_acquire_timeout_ms>1000</get_zookeeper_lock_acquire_timeout_ms>
+            <!-- S3Queue reads Keeper under these retries: one retry without backoff keeps the test short. -->
+            <keeper_max_retries>1</keeper_max_retries>
+            <keeper_retry_initial_backoff_ms>0</keeper_retry_initial_backoff_ms>
+            <keeper_retry_max_backoff_ms>0</keeper_retry_max_backoff_ms>
+        </default>
+    </profiles>
+</clickhouse>
```

**File**: `tests/integration/test_zookeeper_lock_acquire_timeout/test.py` (modified, +119/-0)
```diff
@@ -9,7 +9,10 @@
 import pytest
 import time
 import concurrent.futures
+import contextlib
+import uuid
 from helpers.cluster import ClickHouseCluster, QueryRuntimeException
+from helpers.s3_queue_common import create_table
 
 cluster = ClickHouseCluster(__file__, zookeeper_config_path="configs/zookeeper.xml")
 
@@ -21,6 +24,16 @@
     stay_alive=True,
 )
 
+# Background (global context) Keeper users of this node wait at most 1 s for a busy client lock.
+node_background = cluster.add_instance(
+    "node_background",
+    with_zookeeper=True,
+    with_minio=True,
+    main_configs=["configs/zookeeper.xml", "configs/disable_ddl.xml", "configs/auxiliary_zookeepers.xml"],
+    user_configs=["configs/users.xml", "configs/background_lock_timeout.xml"],
+    stay_alive=True,
+)
+
 
 @pytest.fixture(scope="module")
 def started_cluster():
@@ -166,3 +179,109 @@ def test_zookeeper_lock_acquire_timeout_success_when_no_contention(started_clust
         settings={"get_zookeeper_lock_acquire_timeout_ms": 100},
     )
     assert int(result.strip()) > 0
+
+
+AUX_LOCK_FAILPOINT = "context_auxiliary_zookeeper_lock_acquired_pause"
+
+
+@contextlib.contextmanager
+def hold_auxiliary_keeper_lock(instance, attempts=5):
+    """Pause a `SYSTEM DROP REPLICA ... FROM ZKPATH` query in `Context::getAuxiliaryZooKeeper` while it holds
+    the auxiliary Keeper mutex; that query takes the Keeper client outside a query pipeline.
+
+    The fail point pauses whichever thread takes the mutex first. If a background thread wins,
+    the holder query times out instead: release the fail point and try again."""
+    pool = concurrent.futures.ThreadPoolExecutor(max_workers=1)
+    holder = None
+    try:
+        for _ in range(attempts):
+            query_id = f"aux_keeper_lock_holder_{uuid.uuid4().hex}"
+            # One client call, so the holder reaches the mutex right after the fail point is armed.
+            holder = pool.submit(
+                instance.query,
+                f"SYSTEM ENABLE FAILPOINT {AUX_LOCK_FAILPOINT}; "
+                f"SYSTEM DROP REPLICA 'lock_holder' FROM ZKPATH 'zookeeper2:/clickhouse/{query_id}'",
+                settings={"get_zookeeper_lock_acquire_timeout_ms": 500},
+                query_id=query_id,
+            )
+            # `SYSTEM WAIT FAILPOINT` returns at once while the fail point is not enabled yet,
+            # so wait for the holder's DROP REPLICA, which starts after it is enabled.
+            for _ in range(300):
+                if holder.done() or int(instance.query(
+                    f"SELECT count() FROM system.processes WHERE query_id = '{query_id}' AND query ILIKE '%DROP REPLICA%'"
+                )):
+                    break
+                time.sleep(0.1)
+            else:
+                raise AssertionError("The holder query did not start")
+            instance.query(f"SYSTEM WAIT FAILPOINT {AUX_LOCK_FAILPOINT} PAUSE", timeout=30)
+            try:
+                holder.result(timeout=3)
+            except concurrent.futures.TimeoutError:
+                break
+            except QueryRuntimeException as e:
+                if "TIMEOUT_EXCEEDED" not in str(e):
+                    raise
+            instance.query(f"SYSTEM DISABLE FAILPOINT {AUX_LOCK_FAILPOINT}")
+            holder = None
+        else:
+            raise AssertionError(f"Could not hold the auxiliary Keeper lock in {attempts} attempts")
+        yield
+    finally:
+        instance.query(f"SYSTEM DISABLE FAILPOINT {AUX_LOCK_FAILPOINT}")
+        pool.shutdown(wait=False)
+    with pytest.raises(QueryRuntimeException) as e:
+        holder.result(timeout=60)
+    assert "does not look like a table path" in str(e.value)
+
+
+def test_s3queue_registry_survives_lock_timeout(started_cluster):
+    """The S3Queue registry thread retries a Keeper client lock timeout instead of treating it as a bug."""
+    table = f"s3queue_registry_{uuid.uuid4().hex[:8]}"
+    keeper_path = f"/clickhouse/test_{table}"
+    try:
+        create_table(
+            started_cluster,
+            node_background,
+            table,
+            "unordered",
+            f"{table}_data",
+            additional_settings={"keeper_path": f"zookeeper2:{keeper_path}"},
+        )
+        with hold_auxiliary_keeper_lock(node_background):
+            node_background.wait_for_log_line(
+                rf"StorageObjectStorageQueue\(zookeeper2:{keeper_path}\).*will try to connect again: .*Timeout exceeded while acquiring auxiliary ZooKeeper lock",
+                timeout=30,
+            )
+        assert node_background.query("SELECT 1") == "1\n"
+        assert not node_background.contains_in_log("Logical error")
+    finally:
+        node_background.query(f"DROP TABLE IF EXISTS {table} SYNC")
+
+
+def test_replicated_table_attach_survives_lock_timeout(started_cluster):
+    """A ReplicatedMergeTree table attached while the Keeper client lock is busy stops being read-only once it is free."""
+    table = f"r_{uuid.u
```

---

### Incident Patch 12: `049e5569` (2026-10-07)
**Commit Message**: Merge pull request #124304 from groeneai/fix-parallel-join-squash-max-joined-block-size

Do not merge `parallel_hash` and `grace_hash` join output blocks past `max_joined_block_size_rows`/`bytes`

**File**: `src/Interpreters/Squashing.h` (modified, +2/-0)
```diff
@@ -72,6 +72,8 @@ class Squashing
     Chunk flush();
 
     bool empty() const { return !accumulated; }
+    /// Rows added but not yet generated.
+    size_t getRows() const { return accumulated.getRows() + pending.getRows(); }
     void setHeader(const Block & header_) { header = std::make_shared<const Block>(header_); }
     const SharedHeader & getHeader() const { return header; }
 
```

**File**: `src/Processors/QueryPlan/JoinStep.cpp` (modified, +7/-1)
```diff
@@ -238,9 +238,15 @@ QueryPipelineBuilderPtr JoinStep::updatePipeline(QueryPipelineBuilders pipelines
 
     if (join->supportParallelJoin() && (min_block_size_rows > 0 || min_block_size_bytes > 0))
     {
+        const auto & table_join = join->getTableJoin();
+        const size_t max_rows = table_join.maxJoinedBlockRows();
+        const size_t max_bytes = table_join.maxJoinedBlockBytes();
         joined_pipeline->addSimpleTransform(
             [&](const SharedHeader & header)
-            { return tag_tail(std::make_shared<SimpleSquashingChunksTransform>(header, min_block_size_rows, min_block_size_bytes)); });
+            {
+                return tag_tail(std::make_shared<SimpleSquashingChunksTransform>(
+                    header, min_block_size_rows, min_block_size_bytes, max_rows, max_bytes));
+            });
     }
 
     const auto & pipeline_output_header = joined_pipeline->getHeader();
```

**File**: `src/Processors/Transforms/SquashingTransform.cpp` (modified, +41/-2)
```diff
@@ -1,5 +1,6 @@
 #include <utility>
 #include <Processors/Transforms/SquashingTransform.h>
+#include <Columns/IColumn.h>
 #include <Interpreters/Squashing.h>
 #include <Processors/Chunk.h>
 
@@ -63,20 +64,57 @@ void SquashingTransform::work()
     }
 }
 
+namespace
+{
+
+/// `Chunk::bytes` with constant columns at their materialized size, as `Squashing::squash` materializes them.
+size_t squashedBytes(const Chunk & chunk)
+{
+    size_t bytes = 0;
+    for (const auto & column : chunk.getColumns())
+        bytes += isColumnConst(*column) ? column->byteSizeAt(0) * column->size() : column->byteSize();
+    return bytes;
+}
+
+}
+
 SimpleSquashingChunksTransform::SimpleSquashingChunksTransform(
-    SharedHeader header, size_t min_block_size_rows, size_t min_block_size_bytes)
+    SharedHeader header, size_t min_block_size_rows, size_t min_block_size_bytes,
+    size_t max_block_size_rows_, size_t max_block_size_bytes_)
     : IInflatingTransform(header, header)
     , squashing(header, min_block_size_rows, min_block_size_bytes)
+    , max_block_size_rows(max_block_size_rows_)
+    , max_block_size_bytes(max_block_size_bytes_)
 {
 }
 
 void SimpleSquashingChunksTransform::consume(Chunk chunk)
 {
+    const size_t chunk_bytes = max_block_size_bytes && chunk.getNumRows() ? squashedBytes(chunk) : 0;
+    const size_t buffered_rows = squashing.getRows();
+    /// A generation round always empties `squashing`, so the buffered bytes are those added since it was last empty.
+    if (!buffered_rows)
+        buffered_bytes = 0;
+    else if ((max_block_size_rows && buffered_rows + chunk.getNumRows() > max_block_size_rows)
+             || (max_block_size_bytes && buffered_bytes + chunk_bytes > max_block_size_bytes))
+    {
+        flushed_chunk = Squashing::squash(squashing.flush(), getOutputPort().getSharedHeader());
+        buffered_bytes = 0;
+    }
+
+    buffered_bytes += chunk_bytes;
     squashing.add(std::move(chunk));
 }
 
 Chunk SimpleSquashingChunksTransform::generate()
 {
+    if (flushed_chunk)
+    {
+        Chunk result;
+        result.swap(flushed_chunk);
+        return result;
+    }
+
     squashed_chunk = Squashing::squash(squashing.generate(), getOutputPort().getSharedHeader());
 
     if (squashed_chunk.empty())
@@ -89,11 +127,12 @@ Chunk SimpleSquashingChunksTransform::generate()
 
 bool SimpleSquashingChunksTransform::canGenerate()
 {
-    return squashing.canGenerate();
+    return static_cast<bool>(flushed_chunk) || squashing.canGenerate();
 }
 
 Chunk SimpleSquashingChunksTransform::getRemaining()
 {
+    chassert(!flushed_chunk);
     return Squashing::squash(squashing.flush(), getOutputPort().getSharedHeader());
 }
 
```

**File**: `src/Processors/Transforms/SquashingTransform.h` (modified, +12/-1)
```diff
@@ -35,7 +35,11 @@ class SquashingTransform final : public ExceptionKeepingTransform
 class SimpleSquashingChunksTransform final : public IInflatingTransform
 {
 public:
-    explicit SimpleSquashingChunksTransform(SharedHeader header, size_t min_block_size_rows, size_t min_block_size_bytes);
+    /// Non-zero max bounds stop merging before the merged chunks' total rows or bytes would exceed them; a single chunk is never split.
+    /// The byte bound is an estimate: it sums the input chunks, and concatenation can change a column's representation.
+    explicit SimpleSquashingChunksTransform(
+        SharedHeader header, size_t min_block_size_rows, size_t min_block_size_bytes,
+        size_t max_block_size_rows_ = 0, size_t max_block_size_bytes_ = 0);
 
     String getName() const override { return "SimpleSquashingTransform"; }
 
@@ -48,6 +52,13 @@ class SimpleSquashingChunksTransform final : public IInflatingTransform
 private:
     Squashing squashing;
     Chunk squashed_chunk;
+
+    const size_t max_block_size_rows;
+    const size_t max_block_size_bytes;
+    /// `squashedBytes` of the chunks buffered in `squashing`; valid only while it is non-empty.
+    size_t buffered_bytes = 0;
+    /// Buffered data emitted ahead of a chunk that would overflow a max bound.
+    Chunk flushed_chunk;
 };
 
 }
```

**File**: `tests/queries/0_stateless/05337_parallel_join_max_joined_block_size.reference` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+1	2000
+1	2000
+1	2000
+1	1999000	2000
+1	14000	2000
+[3,12,12,8,11,5]
+[3,12,12,8,11,5]
```

**File**: `tests/queries/0_stateless/05337_parallel_join_max_joined_block_size.sql` (added, +61/-0)
```diff
@@ -0,0 +1,61 @@
+-- Squashing of parallel_hash and grace_hash output merges blocks only up to max_joined_block_size_rows/bytes.
+
+DROP TABLE IF EXISTS t_l;
+DROP TABLE IF EXISTS t_r;
+DROP TABLE IF EXISTS t_l2;
+DROP TABLE IF EXISTS t_r2;
+DROP TABLE IF EXISTS t_r3;
+
+CREATE TABLE t_l (k UInt64) ENGINE = MergeTree ORDER BY k;
+CREATE TABLE t_r (k UInt64, v UInt64) ENGINE = MergeTree ORDER BY k;
+CREATE TABLE t_l2 (k UInt64) ENGINE = MergeTree ORDER BY k;
+CREATE TABLE t_r2 (k UInt64) ENGINE = MergeTree ORDER BY k;
+CREATE TABLE t_r3 (k UInt64, s String) ENGINE = MergeTree ORDER BY k;
+
+INSERT INTO t_l SELECT number FROM numbers(20);
+INSERT INTO t_r SELECT number % 20, number FROM numbers(2000);
+INSERT INTO t_l2 SELECT number FROM numbers(400);
+INSERT INTO t_r2 SELECT number % 400 FROM numbers(2000);
+INSERT INTO t_r3 SELECT number, repeat('x', 1000) FROM numbers(180)
+WHERE number % 20 < [3, 12, 4, 4, 4, 8, 9, 2, 5][intDiv(number, 20) + 1];
+
+SET max_threads = 4, parallel_hash_join_threshold = 0, query_plan_join_swap_table = 0, joined_block_split_single_row = 1,
+    min_joined_block_size_rows = 65409, min_joined_block_size_bytes = 524288, query_plan_join_shard_by_pk_ranges = 0,
+    max_bytes_before_external_join = 0, query_plan_optimize_join_order_randomize = 0, enable_parallel_replicas = 0;
+
+SELECT max(blockSize()) <= 9, count() FROM t_l JOIN t_r ON t_l.k = t_r.k
+SETTINGS join_algorithm = 'parallel_hash', max_joined_block_size_rows = 9;
+
+SELECT max(blockSize()) <= 9, count() FROM t_l2 JOIN t_r2 ON t_l2.k = t_r2.k
+SETTINGS join_algorithm = 'parallel_hash', max_joined_block_size_rows = 9;
+
+SELECT max(blockSize()) <= 9, count() FROM t_l JOIN t_r ON t_l.k = t_r.k
+SETTINGS join_algorithm = 'grace_hash', max_joined_block_size_rows = 9;
+
+SELECT max(blockSize()) BETWEEN 101 AND 200, sum(t_r.v), count() FROM t_l JOIN t_r ON t_l.k = t_r.k
+SETTINGS join_algorithm = 'parallel_hash', max_joined_block_size_rows = 65409, max_joined_block_size_bytes = 1600,
+    enable_lazy_columns_replication = 0;
+
+SELECT max(blockSize()) BETWEEN 101 AND 200, sum(c), count() FROM (SELECT k, toUInt64(7) AS c FROM t_l) AS l JOIN t_r ON l.k = t_r.k
+SETTINGS join_algorithm = 'parallel_hash', max_joined_block_size_rows = 65409, max_joined_block_size_bytes = 1600;
+
+-- One stream of joined chunks of 3, 12, 4, 4, 4, 8, 9, 2, 5 rows (about 1 KB per row) and a 10-row minimum:
+-- chunks merge until the minimum is reached, but not past 15 rows or 16000 bytes.
+SELECT groupArray(b) FROM (SELECT blockSize() AS b, rowNumberInBlock() AS n FROM numbers(180) AS l JOIN t_r3 ON l.number = t_r3.k)
+WHERE n = 0
+SETTINGS join_algorithm = 'parallel_hash', max_threads = 1, max_block_size = 20, enable_join_runtime_filters = 0,
+    min_joined_block_size_rows = 10, min_joined_block_size_bytes = 0,
+    max_joined_block_size_rows = 15, max_joined_block_size_bytes = 0;
+
+SELECT groupArray(b) FROM (
+    SELECT blockSize() AS b, rowNumberInBlock() AS n, t_r3.s AS s FROM numbers(180) AS l JOIN t_r3 ON l.number = t_r3.k)
+WHERE n = 0 AND length(s) = 1000
+SETTINGS join_algorithm = 'parallel_hash', max_threads = 1, max_block_size = 20, enable_join_runtime_filters = 0,
+    min_joined_block_size_rows = 10, min_joined_block_size_bytes = 0,
+    max_joined_block_size_rows = 65409, max_joined_block_size_bytes = 16000;
+
+DROP TABLE t_l;
+DROP TABLE t_r;
+DROP TABLE t_l2;
+DROP TABLE t_r2;
+DROP TABLE t_r3;
```

---

### Incident Patch 13: `6be68fd9` (2026-10-07)
**Commit Message**: Merge pull request #124303 from groeneai/fix-skip-index-disjunction-position-119528

Fix wrong results when skip indexes evaluate a predicate with OR

**File**: `src/Storages/MergeTree/KeyCondition.cpp` (modified, +5/-5)
```diff
@@ -6831,9 +6831,12 @@ BoolMask KeyCondition::checkInHyperrectangle(
         return SpaceFillingCurveType::Unknown;
     };
 
-    size_t element_idx = 0;
-    for (const auto & element : rpn)
+    /// The reported position is the element's index in `rpn`: the disjunction bitset is read positionally
+    /// against the template RPN. A position that is never reported keeps the bitset's all-true default.
+    for (size_t element_idx = 0; element_idx < rpn.size(); ++element_idx)
     {
+        const auto & element = rpn[element_idx];
+
         if (element.argument_num_of_space_filling_curve.has_value())
         {
             /// If a condition on argument of a space filling curve wasn't collapsed into FUNCTION_ARGS_IN_HYPERRECTANGLE,
@@ -7252,10 +7255,7 @@ BoolMask KeyCondition::checkInHyperrectangle(
             throw Exception(ErrorCodes::LOGICAL_ERROR, "Unexpected function type in KeyCondition::RPNElement");
 
         if (update_partial_disjunction_result_fn)
-        {
             update_partial_disjunction_result_fn(element_idx, rpn_stack.back().can_be_true, (element.function == RPNElement::FUNCTION_UNKNOWN));
-            ++element_idx;
-        }
     }
 
     if (rpn_stack.size() != 1)
```

**File**: `tests/queries/0_stateless/05331_skip_index_disjunction_rpn_position.reference` (added, +8/-0)
```diff
@@ -0,0 +1,8 @@
+1
+1
+1
+0
+667
+667
+667
+100
```

**File**: `tests/queries/0_stateless/05331_skip_index_disjunction_rpn_position.sql` (added, +76/-0)
```diff
@@ -0,0 +1,76 @@
+DROP TABLE IF EXISTS t_rpn_pos;
+
+CREATE TABLE t_rpn_pos
+(
+    id UInt32,
+    a UInt8,
+    x UInt8,
+    y UInt8,
+    INDEX iax (a, x) TYPE minmax GRANULARITY 2,
+    INDEX iy y TYPE minmax GRANULARITY 2
+)
+ENGINE = MergeTree ORDER BY id SETTINGS index_granularity = 1;
+
+INSERT INTO t_rpn_pos VALUES (0, 0, 1, 1), (1, 200, 1, 1), (2, 0, 1, 7), (3, 200, 1, 1);
+
+-- `intDiv(a, toInt8(-1))` reinterprets `a` through a signed cast, so it is not monotonic over an `a`
+-- range that crosses 128, and the minmax index on (a, x) cannot decide that atom for either index
+-- granule here. Row 2 matches only through the `y = 7` arm, which the index on y does decide.
+SELECT count() FROM t_rpn_pos WHERE intDiv(a, toInt8(-1)) < 1 AND (x = 5 OR y = 7)
+SETTINGS use_skip_indexes = 0;
+
+SELECT count() FROM t_rpn_pos WHERE intDiv(a, toInt8(-1)) < 1 AND (x = 5 OR y = 7)
+SETTINGS use_skip_indexes = 1, use_skip_indexes_for_disjunctions = 1;
+
+-- The counts above are only meaningful if the merged-disjunction path actually ran: with it off no
+-- granule is pruned and row-level filtering returns the same 1. `<Combined skip indexes>` appears in
+-- EXPLAIN only while that path is on, so these two probes are its positive and negative control.
+SELECT count() > 0 FROM (
+    EXPLAIN indexes = 1
+    SELECT count() FROM t_rpn_pos WHERE intDiv(a, toInt8(-1)) < 1 AND (x = 5 OR y = 7)
+    SETTINGS use_skip_indexes = 1, use_skip_indexes_for_disjunctions = 1,
+             use_skip_indexes_on_data_read = 0, use_query_condition_cache = 0,
+             parallel_replicas_local_plan = 1, explain_query_plan_default = 'legacy'
+) WHERE explain ILIKE '%<Combined skip indexes>%';
+
+SELECT count() > 0 FROM (
+    EXPLAIN indexes = 1
+    SELECT count() FROM t_rpn_pos WHERE intDiv(a, toInt8(-1)) < 1 AND (x = 5 OR y = 7)
+    SETTINGS use_skip_indexes = 1, use_skip_indexes_for_disjunctions = 0,
+             use_skip_indexes_on_data_read = 0, use_query_condition_cache = 0,
+             parallel_replicas_local_plan = 1, explain_query_plan_default = 'legacy'
+) WHERE explain ILIKE '%<Combined skip indexes>%';
+
+DROP TABLE t_rpn_pos;
+
+-- An atom the index cannot evaluate (a function of the column), followed by a constant disjunct that
+-- the next index reports as false.
+DROP TABLE IF EXISTS t_skip_or0;
+CREATE TABLE t_skip_or0
+(
+    id UInt32,
+    e Enum8('a' = 1, 'b' = 2, 'c' = 3),
+    INDEX ie e TYPE minmax GRANULARITY 1,
+    INDEX ii id TYPE minmax GRANULARITY 1,
+    INDEX ise e TYPE set(10) GRANULARITY 1
+)
+ENGINE = MergeTree ORDER BY tuple();
+INSERT INTO t_skip_or0 SELECT number, ['a', 'b', 'c'][number % 3 + 1] FROM numbers(1000);
+
+SELECT count() FROM t_skip_or0 WHERE toString(e) < 'c' AND (0 OR id != 5)
+SETTINGS use_skip_indexes = 1, use_skip_indexes_for_disjunctions = 1;
+SELECT count() FROM t_skip_or0 WHERE e < 'c' AND (toString(id) != '5' OR 0)
+SETTINGS use_skip_indexes = 1, use_skip_indexes_for_disjunctions = 1;
+-- The same through a set index on e.
+SELECT count() FROM t_skip_or0 WHERE toString(e) < 'c' AND (0 OR id != 5)
+SETTINGS use_skip_indexes = 1, use_skip_indexes_for_disjunctions = 1, ignore_data_skipping_indices = 'ie';
+DROP TABLE t_skip_or0;
+
+-- Implicit minmax indexes; the comparison of a UInt128 column with a Nullable(Int256) constant.
+DROP TABLE IF EXISTS t_rpn_implicit;
+CREATE TABLE t_rpn_implicit (v UInt128, w UInt8) ENGINE = MergeTree ORDER BY tuple()
+SETTINGS index_granularity = 1, add_minmax_index_for_numeric_columns = 1;
+INSERT INTO t_rpn_implicit SELECT number, number % 3 + 1 FROM numbers(100);
+SELECT count() FROM t_rpn_implicit WHERE w > 0 AND (toNullable(toInt256(-1)) < v OR 0)
+SETTINGS use_skip_indexes = 1, use_skip_indexes_for_disjunctions = 1;
+DROP TABLE t_rpn_implicit;
```

---

### Incident Patch 14: `2b42b93a` (2026-10-07)
**Commit Message**: Merge pull request #120213 from ClickHouse/vdimir/fix-iejoin-frechet

Fix IEJoin key pair choice for band-shaped conditions on unrelated columns

**File**: `src/Processors/QueryPlan/JoinStepLogical.cpp` (modified, +53/-30)
```diff
@@ -1086,6 +1086,19 @@ static std::optional<Float64> statisticsFieldToFloat64(const Field & value)
     }
 }
 
+static std::optional<IEJoinOperandRange> getIEJoinOperandRange(
+    const std::unordered_map<String, ColumnStats> & column_stats, const JoinActionRef & operand)
+{
+    auto it = column_stats.find(operand.getColumnName());
+    if (it == column_stats.end() || !it->second.min_value || !it->second.max_value)
+        return {};
+    auto min_value = statisticsFieldToFloat64(*it->second.min_value);
+    auto max_value = statisticsFieldToFloat64(*it->second.max_value);
+    if (!min_value || !max_value || !std::isfinite(*min_value) || !std::isfinite(*max_value))
+        return {};
+    return IEJoinOperandRange{.min = *min_value, .max = *max_value, .null_fraction = it->second.null_fraction};
+}
+
 /// The fraction of row pairs satisfying the condition, estimated from per-column min/max
 /// statistics under a uniformity assumption, or std::nullopt when the statistics do not cover
 /// the operands.
@@ -1102,21 +1115,8 @@ static std::optional<Float64> estimateIEJoinConditionSelectivity(
     if (!left_type->equals(*right_type) && !(isNumber(left_type) && isNumber(right_type)))
         return {};
 
-    auto get_range = [](const std::unordered_map<String, ColumnStats> & column_stats, const JoinActionRef & operand)
-        -> std::optional<IEJoinOperandRange>
-    {
-        auto it = column_stats.find(operand.getColumnName());
-        if (it == column_stats.end() || !it->second.min_value || !it->second.max_value)
-            return {};
-        auto min_value = statisticsFieldToFloat64(*it->second.min_value);
-        auto max_value = statisticsFieldToFloat64(*it->second.max_value);
-        if (!min_value || !max_value || !std::isfinite(*min_value) || !std::isfinite(*max_value))
-            return {};
-        return IEJoinOperandRange{.min = *min_value, .max = *max_value, .null_fraction = it->second.null_fraction};
-    };
-
-    auto left_range = get_range(planning_context.left_column_stats, lhs);
-    auto right_range = get_range(planning_context.right_column_stats, rhs);
+    auto left_range = getIEJoinOperandRange(planning_context.left_column_stats, lhs);
+    auto right_range = getIEJoinOperandRange(planning_context.right_column_stats, rhs);
     if (!left_range || !right_range)
         return {};
 
@@ -1137,27 +1137,50 @@ static bool isLessFamily(JoinConditionOperator op)
     return op == JoinConditionOperator::Less || op == JoinConditionOperator::LessOrEquals;
 }
 
-/// Joint selectivity of a pair of key conditions. Independence is assumed for unrelated
-/// conditions. For two conditions reading the same column on one side independence is grossly
-/// wrong, and sharp Frechet bounds are used instead: with opposite directions
-/// (`lo < x AND x < hi`, the band shape) failing both requires the reversed band `hi <= x <= lo`,
-/// which is empty for a genuine band, so P(A and B) = P(A) + P(B) - 1; with the same direction
-/// one condition mostly implies the other, so P(A and B) = min(P(A), P(B)).
+/// Joint selectivity of a pair of key conditions. Unrelated conditions are treated as
+/// independent: P(A) * P(B). Two conditions on the same column `x` are not independent:
+/// - same direction (`x < lo AND x < hi`): one mostly implies the other, so min(P(A), P(B));
+/// - opposite directions (`lo < x AND x < hi`): if `lo <= hi` on every row, no row pair fails
+///   both conditions, so exactly P(A) + P(B) - 1.
+/// When `lo` and `hi` are unrelated columns the last formula counts the pairs failing both
+/// conditions twice and can reach 0 for a pair that passes plenty. Statistics cannot prove
+/// `lo <= hi`, but they refute it when the marginals sum to at most 1 or when the min or max
+/// of `lo` exceeds that of `hi`; a refuted pair is scored as independent.
 static Float64 estimateIEJoinKeyPairSelectivity(
     const IEJoinKeyCandidate & first, Float64 first_selectivity,
-    const IEJoinKeyCandidate & second, Float64 second_selectivity)
+    const IEJoinKeyCandidate & second, Float64 second_selectivity,
+    const JoinPlanningContext & planning_context)
 {
     const auto & [first_op, first_lhs, first_rhs] = first;
     const auto & [second_op, second_lhs, second_rhs] = second;
 
-    bool same_column_on_one_side = first_lhs.getColumnName() == second_lhs.getColumnName()
-        || first_rhs.getColumnName() == second_rhs.getColumnName();
-    if (same_column_on_one_side)
-    {
-        if (isLessFamily(first_op) != isLessFamily(second_op))
-            return std::max(0.0, first_selectivity + second_selectivity - 1.0);
+    bool shared_column_on_left = first_lhs.getColumnName() == second_lhs.getColumnName();
+    bool shared_column_on_right = first_rhs.getColumnName() == second_rhs.getColumnName();
+    if (!shared_column_on_left && !shared_column_on_right)
+        return first_selectivity * second_selectivity;
+
+    /// Candidates are oriented `left op right`, so the directions c
```

**File**: `tests/queries/0_stateless/05218_ie_join_selectivity_pseudo_band.reference` (added, +16/-0)
```diff
@@ -0,0 +1,16 @@
+-- row pairs passing each candidate key pair
+c < d AND a > x	1260
+a > x AND a < y	2462480
+-- chosen key conditions
+Conditions: __table1.c < __table2.d AND __table1.a > __table2.x
+-- result does not depend on the choice
+420
+420
+-- ends out of order: row pairs passing each candidate key pair
+c < d AND a > x	1440
+a > x AND a < y	2750252
+-- chosen key conditions
+Conditions: __table1.c < __table2.d AND __table1.a > __table2.x
+-- result does not depend on the choice
+1440
+1440
```

**File**: `tests/queries/0_stateless/05218_ie_join_selectivity_pseudo_band.sql` (added, +80/-0)
```diff
@@ -0,0 +1,80 @@
+-- Tags: no-old-analyzer
+
+-- Two conditions comparing the same column to two unrelated columns in opposite directions
+-- (`r.x < l.a AND l.a < r.y`) look like a band, but `x` and `y` are not the ends of an interval,
+-- so the pair is not selective. Their marginals sum to exactly 1, and the band estimate
+-- P(A) + P(B) - 1 collapses to 0; that must not make the pair win over a genuinely selective one.
+-- https://github.com/ClickHouse/ClickHouse/issues/120092
+
+SET join_algorithm = 'ie_join';
+SET enable_parallel_replicas = 0;
+SET use_statistics = 1;
+SET materialize_statistics_on_insert = 1;
+SET query_plan_optimize_join_order_limit = 0;
+SET query_plan_join_swap_table = 0;
+
+DROP TABLE IF EXISTS t_pb_l;
+DROP TABLE IF EXISTS t_pb_r;
+
+CREATE TABLE t_pb_l (a UInt32, c UInt32)
+ENGINE = MergeTree ORDER BY tuple()
+SETTINGS auto_statistics_types = 'basic, uniq_v2';
+
+CREATE TABLE t_pb_r (x UInt32, y UInt32, d UInt32)
+ENGINE = MergeTree ORDER BY tuple()
+SETTINGS auto_statistics_types = 'basic, uniq_v2';
+
+INSERT INTO t_pb_l SELECT number % 1000, 500 + number % 500 FROM numbers(4000);
+INSERT INTO t_pb_r SELECT number % 1000, (number * 7) % 1000, number % 515 FROM numbers(4000);
+
+SELECT '-- row pairs passing each candidate key pair';
+SELECT 'c < d AND a > x', count() FROM t_pb_l AS l JOIN t_pb_r AS r ON l.c < r.d AND l.a > r.x;
+SELECT 'a > x AND a < y', count() FROM t_pb_l AS l JOIN t_pb_r AS r ON l.a > r.x AND l.a < r.y;
+
+SELECT '-- chosen key conditions';
+SELECT extract(explain, 'Conditions: .*') FROM (
+    EXPLAIN actions = 1
+    SELECT count() FROM t_pb_l AS l JOIN t_pb_r AS r
+    ON l.c < r.d AND r.x < l.a AND l.a < r.y
+) WHERE explain LIKE '%Conditions:%';
+
+SELECT '-- result does not depend on the choice';
+SELECT count() FROM t_pb_l AS l JOIN t_pb_r AS r ON l.c < r.d AND r.x < l.a AND l.a < r.y;
+SELECT count() FROM t_pb_l AS l, t_pb_r AS r WHERE l.c < r.d AND r.x < l.a AND l.a < r.y
+SETTINGS join_algorithm = 'hash';
+
+DROP TABLE t_pb_l;
+DROP TABLE t_pb_r;
+
+-- Here the marginals sum to slightly more than 1 (`y` reaches above `a`), so the band estimate
+-- is small but positive; only the order of the ends refutes the band: min(x) = 10 > min(y) = 0,
+-- impossible for `x <= y` on every row.
+CREATE TABLE t_pb_l (a UInt32, c UInt32)
+ENGINE = MergeTree ORDER BY tuple()
+SETTINGS auto_statistics_types = 'basic, uniq_v2';
+
+CREATE TABLE t_pb_r (x UInt32, y UInt32, d UInt32)
+ENGINE = MergeTree ORDER BY tuple()
+SETTINGS auto_statistics_types = 'basic, uniq_v2';
+
+INSERT INTO t_pb_l SELECT number % 1000, number % 1000 FROM numbers(4000);
+INSERT INTO t_pb_r SELECT 10 + number % 980, (number * 7) % 1010, number % 40 FROM numbers(4000);
+
+SELECT '-- ends out of order: row pairs passing each candidate key pair';
+SELECT 'c < d AND a > x', count() FROM t_pb_l AS l JOIN t_pb_r AS r ON l.c < r.d AND l.a > r.x;
+SELECT 'a > x AND a < y', count() FROM t_pb_l AS l JOIN t_pb_r AS r ON l.a > r.x AND l.a < r.y;
+
+SELECT '-- chosen key conditions';
+SELECT extract(explain, 'Conditions: .*') FROM (
+    EXPLAIN actions = 1
+    SELECT count() FROM t_pb_l AS l JOIN t_pb_r AS r
+    ON l.c < r.d AND r.x < l.a AND l.a < r.y
+) WHERE explain LIKE '%Conditions:%';
+
+SELECT '-- result does not depend on the choice';
+SELECT count() FROM t_pb_l AS l JOIN t_pb_r AS r ON l.c < r.d AND r.x < l.a AND l.a < r.y;
+SELECT count() FROM t_pb_l AS l, t_pb_r AS r WHERE l.c < r.d AND r.x < l.a AND l.a < r.y
+SETTINGS join_algorithm = 'hash';
+
+DROP TABLE t_pb_l;
+DROP TABLE t_pb_r;
```

---

### Incident Patch 15: `2963d7f2` (2026-10-07)
**Commit Message**: Merge pull request #124272 from ClickHouse/revert-120371-vdimir/fix-explain-secret-mask-across-steps

Revert "Hide secret function arguments in EXPLAIN when the value comes from another plan step"

**File**: `src/Analyzer/FunctionSecretArgumentsFinderTreeNode.cpp` (modified, +2/-1)
```diff
@@ -61,7 +61,8 @@ void forEachSecretArgumentNode(
             continue;
         }
 
-        if (secret_arguments.isSecretArgument(n))
+        const bool in_span = secret_arguments.start <= n && n < secret_arguments.start + secret_arguments.count;
+        if (in_span || secret_arguments.masked_arguments.contains(n) || secret_arguments.replaced_arguments.contains(n))
             on_secret(n, secretValueSlot(arguments[n]));
     }
 }
```

**File**: `src/Interpreters/InterpreterExplainQuery.cpp` (modified, +1/-3)
```diff
@@ -1011,7 +1011,6 @@ InterpreterExplainQuery::AnalyzedInnerQuery & InterpreterExplainQuery::getAnalyz
 
     const auto analyze_settings = checkAndGetSettings<QueryAnalyzeSettings>(ast.getSettings());
     result->query_plan_options = analyze_settings.query_plan_options;
-    result->query_plan_options.show_secrets = canDisplaySecrets(getContext());
     result->time = analyze_settings.query_plan_options.time;
 
     /// This is the only place that turns join statistics on, and it must happen before any interpreter
@@ -1176,7 +1175,6 @@ QueryPipeline InterpreterExplainQuery::executeImpl()
                 }
 
             auto settings = checkAndGetSettings<QueryPlanSettings>(ast_settings, pretty_version);
-            settings.query_plan_options.show_secrets = canDisplaySecrets(query_context);
 
             QueryPlan plan;
 
@@ -1413,7 +1411,7 @@ QueryPipeline InterpreterExplainQuery::executeImpl()
             /// Build the per-plan pretty-names registry now: buildQueryPipeline below moves the ActionsDAGs
             /// out of the plan steps, so the names must be snapshotted before the pipeline consumes the plan.
             /// EXPLAIN ANALYZE rejects distributed plans above, so this covers the whole plan tree.
-            PrettyNamesPerPlan precomputed_pretty_names = QueryPlanFormat::buildPrettyNamesPerPlan(plan, analyzed.query_plan_options.show_secrets);
+            PrettyNamesPerPlan precomputed_pretty_names = QueryPlanFormat::buildPrettyNamesPerPlan(plan);
 
             plan.setConcurrencyControl(context->getSettingsRef()[Setting::use_concurrency_control]);
 
```

**File**: `src/Parsers/FunctionSecretArgumentsFinder.h` (modified, +0/-7)
```diff
@@ -84,13 +84,6 @@ class FunctionSecretArgumentsFinder
         {
             return count != 0 || !nested_maps.empty() || !replaced_arguments.empty() || !masked_arguments.empty();
         }
-
-        /// Whether the argument at raw index `n` is hidden: by the span, individually or by a partial
-        /// replacement. The nested maps are not positional: their entries are matched by name.
-        bool isSecretArgument(size_t n) const
-        {
-            return (n >= start && n - start < count) || masked_arguments.contains(n) || replaced_arguments.contains(n);
-        }
     };
 
     explicit FunctionSecretArgumentsFinder(std::unique_ptr<AbstractFunction> && function_) : function(std::move(function_)) {}
```

**File**: `src/Planner/PlannerActionsVisitor.cpp` (modified, +12/-5)
```diff
@@ -1272,17 +1272,24 @@ PlannerActionsVisitorImpl::NodeNameAndNodeMinLevel PlannerActionsVisitorImpl::vi
 /// gates on the setting).
 void markFoldedSecretConstants(const FunctionNode & function_node, const ActionsDAG::NodeRawConstPtrs & children)
 {
-    const auto secret_arguments = FunctionSecretArgumentsFinderTreeNode(function_node).getResult();
+    auto secret_arguments = FunctionSecretArgumentsFinderTreeNode(function_node).getResult();
     if (!secret_arguments.hasSecrets())
         return;
 
-    for (size_t i = 0; i < children.size(); ++i)
+    auto mark = [&](size_t index)
     {
         /// Any node carrying a constant column is a folded secret value, whether it is a plain COLUMN
         /// node or a FUNCTION node folded to a constant (e.g. `concat(k1, k2)`); flag either.
-        if (secret_arguments.isSecretArgument(i) && children[i]->column && !children[i]->is_masked_secret)
-            const_cast<ActionsDAG::Node *>(children[i])->is_masked_secret = true;
-    }
+        if (index < children.size() && children[index]->column && !children[index]->is_masked_secret)
+            const_cast<ActionsDAG::Node *>(children[index])->is_masked_secret = true;
+    };
+
+    for (size_t i = secret_arguments.start; i < secret_arguments.start + secret_arguments.count; ++i)
+        mark(i);
+    for (const auto & [index, _] : secret_arguments.masked_arguments)
+        mark(index);
+    for (const auto & [index, _] : secret_arguments.replaced_arguments)
+        mark(index);
 }
 
 PlannerActionsVisitorImpl::NodeNameAndNodeMinLevel PlannerActionsVisitorImpl::visitFunction(const QueryTreeNodePtr & node)
```

**File**: `src/Processors/QueryPlan/BlockNestedLoopJoinStep.cpp` (modified, +4/-1)
```diff
@@ -309,7 +309,10 @@ void BlockNestedLoopJoinStep::describeActions(FormatSettings & settings) const
         /// pretty-name map; render the sub-DAG the way an `Expression` step's outputs are rendered.
         PrettySetNameMap subquery_set_names;
         settings.out << QueryPlanFormat::formatNodePretty(
-            predicate.actions->getActionsDAG().getOutputs().front(), settings, subquery_set_names);
+            predicate.actions->getActionsDAG().getOutputs().front(),
+            settings.pretty_names,
+            settings.runtime_filter_names,
+            subquery_set_names);
     }
     else
     {
```

**File**: `src/Processors/QueryPlan/QueryPlan.cpp` (modified, +1/-2)
```diff
@@ -654,7 +654,7 @@ void QueryPlan::explainPlan(
     PrettyNamesPerPlan local_pretty_names;
     if (options.pretty && !precomputed_pretty_names)
     {
-        local_pretty_names = QueryPlanFormat::buildPrettyNamesPerPlan(*this, options.show_secrets);
+        local_pretty_names = QueryPlanFormat::buildPrettyNamesPerPlan(*this);
         precomputed_pretty_names = &local_pretty_names;
     }
 
@@ -674,7 +674,6 @@ void QueryPlan::explainPlan(
         .compact = options.compact,
         .pretty = options.pretty,
         .inside_explain_analyze = steps_to_stats != nullptr,
-        .show_secrets = options.show_secrets,
         .pretty_names = plan_pretty_names ? plan_pretty_names->pretty_names : empty_pretty_names.pretty_names,
         .runtime_filter_names = plan_pretty_names ? plan_pretty_names->runtime_filter_names : empty_pretty_names.runtime_filter_names
     };
```

**File**: `src/Processors/QueryPlan/QueryPlan.h` (modified, +0/-3)
```diff
@@ -82,9 +82,6 @@ struct ExplainPlanOptions
     bool compact = false;
     /// Print query plan with pretty formatting
     bool pretty = false;
-    /// Print the values of secret function arguments (keys, passwords) in pretty expressions instead of
-    /// `[HIDDEN]`. Not a user-facing EXPLAIN option: set from `canDisplaySecrets` by the interpreter.
-    bool show_secrets = false;
     /// Show estimates
     bool estimates = false;
     /// For EXPLAIN ANALYZE: print the per-processor elapsed time distribution (min/median/max/sum).
```

**File**: `src/Processors/QueryPlan/QueryPlanFormat.cpp` (modified, +33/-74)
```diff
@@ -7,7 +7,6 @@
 #include <IO/Operators.h>
 #include <IO/WriteBufferFromString.h>
 #include <Interpreters/ActionsDAG.h>
-#include <Interpreters/FunctionSecretArgumentsFinderActionsDAG.h>
 #include <Interpreters/Aggregator.h>
 #include <Interpreters/PreparedSets.h>
 #include <Functions/FunctionHelpers.h>
@@ -143,34 +142,12 @@ namespace QueryPlanFormat
         out << '\n';
     }
 
-    /// Whether secret function arguments (keys, passwords) render as `[HIDDEN]` or as written.
-    enum class SecretRendering
-    {
-        ShowAll,
-        HideSecrets,
-    };
-
-    static String formatNodePretty(
-        const ActionsDAG::Node * node,
-        const PrettyColumnNameMap & pretty_names,
-        const PrettyRuntimeFilterNameMap & runtime_filter_names,
-        PrettySetNameMap & subquery_set_names,
-        SecretRendering secrets,
-        int parent_precedence = 0);
-
-    String formatNodePretty(const ActionsDAG::Node * node, const ExplainFormatSettings & settings, PrettySetNameMap & subquery_set_names)
-    {
-        const auto secrets = settings.show_secrets ? SecretRendering::ShowAll : SecretRendering::HideSecrets;
-        return formatNodePretty(node, settings.pretty_names, settings.runtime_filter_names, subquery_set_names, secrets);
-    }
-
     static PrettyColumnName formatFilterPretty(
         const ActionsDAG & dag,
         const String & column_name,
         const std::unordered_map<String, PrettyColumnName> & pretty_names,
         const std::unordered_map<String, RuntimeFilterInfo> & runtime_filter_names,
-        std::unordered_map<FutureSet::Hash, String, PreparedSets::Hashing> & subquery_set_names,
-        SecretRendering secrets)
+        std::unordered_map<FutureSet::Hash, String, PreparedSets::Hashing> & subquery_set_names)
     {
         const auto * root = dag.tryFindInOutputs(column_name);
         if (!root)
@@ -185,9 +162,9 @@ namespace QueryPlanFormat
             if (atom->type == ActionsDAG::ActionType::FUNCTION
                 && atom->function_base
                 && atom->function_base->getName() == "__applyFilter")
-                rf_parts.push_back(formatNodePretty(atom, pretty_names, runtime_filter_names, subquery_set_names, secrets, 4));
+                rf_parts.push_back(formatNodePretty(atom, pretty_names, runtime_filter_names, subquery_set_names, 4));
             else
-                user_parts.push_back(formatNodePretty(atom, pretty_names, runtime_filter_names, subquery_set_names, secrets, 4));
+                user_parts.push_back(formatNodePretty(atom, pretty_names, runtime_filter_names, subquery_set_names, 4));
         }
 
         String expression;
@@ -332,12 +309,11 @@ namespace QueryPlanFormat
         }
     }
 
-    static String formatNodePretty(
+    String formatNodePretty(
         const ActionsDAG::Node * node,
         const std::unordered_map<String, PrettyColumnName> & pretty_names,
         const std::unordered_map<String, RuntimeFilterInfo> & runtime_filter_names,
         std::unordered_map<FutureSet::Hash, String, PreparedSets::Hashing> & subquery_set_names,
-        SecretRendering secrets,
         int parent_precedence)
     {
         using ActionType = ActionsDAG::ActionType;
@@ -360,10 +336,10 @@ namespace QueryPlanFormat
             case ActionType::COLUMN:
                 return formatConstant(node);
             case ActionType::ALIAS:
-                return formatNodePretty(node->children.front(), pretty_names, runtime_filter_names, subquery_set_names, secrets, parent_precedence);
+                return formatNodePretty(node->children.front(), pretty_names, runtime_filter_names, subquery_set_names, parent_precedence);
 
             case ActionType::ARRAY_JOIN:
-                return "arrayJoin(" + formatNodePretty(node->children.front(), pretty_names, runtime_filter_names, subquery_set_names, secrets, 0) + ")";
+                return "arrayJoin(" + formatNodePretty(node->children.front(), pretty_names, runtime_filter_names, subquery_set_names) + ")";
 
             case ActionType::FUNCTION:
             {
@@ -393,7 +369,7 @@ namespace QueryPlanFormat
 
                 if ((func_name == "_CAST" || func_name == "CAST") && node->children.size() == 2)
                 {
-                    auto inner = formatNodePretty(node->children[0], pretty_names, runtime_filter_names, subquery_set_names, secrets, 0);
+                    auto inner = formatNodePretty(node->children[0], pretty_names, runtime_filter_names, subquery_set_names);
                     Field type_field;
                     node->children[1]->column->get(0, type_field);
                     return "CAST(" + inner + " AS " + type_field.safeGet<String>() + ")";
@@ -403,33 +379,33 @@ namespace QueryPlanFormat
 
                 if (func_name == "not" && node->children.size() == 1)
                 {
-                    String result = "NOT " + formatNodePretty(node->children[0], pretty_names, runtime_filter_names, subquery_set_names, secrets, op_info->
```

#### Recent Merged Pull Requests:
- **PR #124460** (2026-10-07): Backport #124303 to 26.9: Fix wrong results when skip indexes evaluate a predicate with OR (@robot-clickhouse)
- **PR #124458** (2026-10-07): Backport #124303 to 26.7: Fix wrong results when skip indexes evaluate a predicate with OR (@robot-clickhouse)
- **PR #124435** (2026-10-07): Backport #120931 to 26.9: Revert "Revert "Do not allocate from peer-declared sizes when reading settings from the Native protocol"" (@robot-clickhouse)
- **PR #124429** (2026-10-07): Backport #123900 to 26.9: Faster short `LowCardinality` range inserts from a different dictionary (@robot-ch-test-poll)
- **PR #124423** (closed): Backport #106240 to 26.3: Increase the rows count limit for system tables limit in scraping (@robot-ch-test-poll4)
- **PR #124416** (2026-10-07): Backport #118978 to 26.9: Query log secret masking for QueryRunner engine and startup scripts (@robot-clickhouse-ci-1)
- **PR #124415** (2026-10-07): Backport #118978 to 26.8: Query log secret masking for QueryRunner engine and startup scripts (@robot-clickhouse-ci-1)
- **PR #124407** (closed): Docs: Improve Docs AI entry points and appearance (@Blargian)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

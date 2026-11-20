# Verification Protocol: Verification Protocol: Empirical Defect Shield for ClickHouse/ClickHouse

<!-- PROVENANCE_START
{
  "source_repository": "ClickHouse/ClickHouse",
  "source_url": "https://github.com/ClickHouse/ClickHouse",
  "source_version": "9c89de48",
  "license": "Apache-2.0",
  "timestamp": "2026-11-20T13:08:32.790Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-clickhouse-clickhouse",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [ClickHouse/ClickHouse](https://github.com/ClickHouse/ClickHouse) (Revision: `9c89de48`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-20T13:08:32.790Z`  
> **Learning ID**: `learn-github-clickhouse-clickhouse`


## 1. Scope & Verification Target
- **Target Repository**: `ClickHouse/ClickHouse` (Commit: `9c89de48`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
# Forensic Learning Record (Deep Inspection): ClickHouse/ClickHouse

> **Canonical Artifact**: `07_PROJECT_LEARNING/clickhouse-clickhouse-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/ClickHouse/ClickHouse](https://github.com/ClickHouse/ClickHouse))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-20T13:08:31.523Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `ClickHouse/ClickHouse`
- **Description**: ClickHouse® is a real-time analytics database management system
- **Primary Language / Ecosystem**: C++
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 51038 stars

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

### Incident Patch 1: `9a8a1a79` (2026-11-20)
**Commit Message**: Merge pull request #127107 from JayPokale/pretty-truncate-name-overflow

Fix overflow in truncateName for a huge output_format_pretty_max_column_name_width_cut_to

**File**: `src/Formats/PrettyFormatHelpers.cpp` (modified, +2/-1)
```diff
@@ -264,7 +264,8 @@ std::pair<String, size_t> truncateName(String name, size_t cut_to, size_t hyster
 {
     size_t length = UTF8::computeWidth(reinterpret_cast<const UInt8 *>(name.data()), name.size());
 
-    if (!cut_to || length <= cut_to + hysteresis || isValidIdentifier(name))
+    /// `cut_to + hysteresis` could overflow for a huge `cut_to`, turning short names into names "cut" to that width.
+    if (!cut_to || length <= cut_to || length - cut_to <= hysteresis || isValidIdentifier(name))
         return {name, length};
 
     /// We cut characters in the middle and insert filler there.
```

**File**: `tests/queries/0_stateless/05442_pretty_name_cut_to_overflow.reference` (added, +18/-0)
```diff
@@ -0,0 +1,18 @@
+   ┌─'hello world'─┐
+1. │ hello world   │
+   └───────────────┘
+Row 1:
+──────
+x:             1
+'hello world': hello world
+Row 1:
+──────
+x:             1
+'hello world': hello world
+   ┌─t t────────────────────────────┐
+   ├─first element─┬─second element─┤
+1. │             1 │ a              │
+   └───────────────┴────────────────┘
+   ┌─a lo⋯cut─┐
+1. │        1 │
+   └──────────┘
```

**File**: `tests/queries/0_stateless/05442_pretty_name_cut_to_overflow.sql` (added, +10/-0)
```diff
@@ -0,0 +1,10 @@
+-- `output_format_pretty_max_column_name_width_cut_to` near the `UInt64` maximum used to overflow `cut_to + hysteresis`
+-- in `truncateName`: short names were reported as that wide, which broke `Pretty*` and `Vertical` output.
+
+SET output_format_pretty_color = 0;
+
+SELECT 'hello world' FORMAT PrettyCompact SETTINGS output_format_pretty_max_column_name_width_cut_to = 18446744073709551615;
+SELECT 1 AS x, 'hello world' FORMAT Vertical SETTINGS output_format_pretty_max_column_name_width_cut_to = 18446744073709551615;
+SELECT 1 AS x, 'hello world' FORMAT Vertical SETTINGS output_format_pretty_max_column_name_width_cut_to = 18446744073709551612;
+SELECT tuple(1, 'a')::Tuple(`first element` UInt8, `second element` String) AS `t t` FORMAT PrettyCompact SETTINGS output_format_pretty_max_column_name_width_cut_to = 18446744073709551615;
+SELECT 1 AS `a long name that gets cut` FORMAT PrettyCompact SETTINGS output_format_pretty_max_column_name_width_cut_to = 8, output_format_pretty_max_column_name_width_min_chars_to_cut = 4;
```

---

### Incident Patch 2: `a5b4d1a6` (2026-11-20)
**Commit Message**: Merge pull request #124032 from groeneai/fix-hung-check-dead-server-verdict

Report a crashed server as `Server died` in functional tests

**File**: `ci/jobs/fast_test.py` (modified, +11/-1)
```diff
@@ -12,7 +12,10 @@
 from ci.defs.defs import ToolSet
 from ci.jobs.scripts.clickhouse_proc import ClickHouseProc
 from ci.jobs.scripts.find_tests import Targeting
-from ci.jobs.scripts.functional_tests_results import FTResultsProcessor
+from ci.jobs.scripts.functional_tests_results import (
+    ABORTED_RUN_EXIT_CODES,
+    FTResultsProcessor,
+)
 from ci.praktika.info import Info
 from ci.praktika.result import Result
 from ci.praktika.settings import Settings
@@ -433,6 +436,13 @@ def main():
         test_results = FTResultsProcessor(wd=Settings.OUTPUT_DIR).run(
             runner_exit_code=test_exit_code,
         )
+        if test_exit_code in ABORTED_RUN_EXIT_CODES:
+            # The crash that aborted the run is only in the server logs.
+            crash_results = [
+                r for r in CH.check_fatal_messages_in_logs() if r.is_failure()
+            ]
+            if crash_results:
+                test_results.extend_sub_results(crash_results)
         fail_slow_new_tests(test_results, info.get_kv_data("new_stateless_test_files"))
         if test_exit_code != 0:
             attach_debug = True
```

**File**: `tests/clickhouse-test` (modified, +50/-40)
```diff
@@ -136,10 +136,12 @@ def forget_test_process_group(pgid: int) -> None:
 
 # Exit code returned by `clickhouse-test` when the run was aborted early via
 # `stop_testing` and no more specific cause was claimed - an observed server death
-# or a generic catastrophic abort; a failed liveness probe uses
-# `HUNG_CHECK_EXIT_CODE` instead. Distinct from the generic failure code 1 so the
-# job side can populate the synthetic "Server died" leaf without fragile log-line
-# matching. Kept in sync with `ci/jobs/scripts/functional_tests_results.py`.
+# (a `<Fatal>` line, or a failed liveness probe with nothing listening on the
+# probed port any more) or a generic catastrophic abort; any other failed
+# liveness probe uses `HUNG_CHECK_EXIT_CODE`. Distinct from the generic failure
+# code 1 so the job side can populate the synthetic "Server died" leaf without
+# fragile log-line matching. Kept in sync with
+# `ci/jobs/scripts/functional_tests_results.py`.
 STOP_TESTING_EXIT_CODE = 2
 
 # Exit code returned when the run stopped *gracefully* because the global time
@@ -160,7 +162,8 @@ GLOBAL_TIME_LIMIT_EXIT_CODE = 3
 MAX_FAILURES_EXIT_CODE = 4
 
 # Exit code returned when the run stopped because a `check_server_liveness`
-# probe failed. The probe establishes only that the check failed - it also fails
+# probe failed while the probed listener was still held or its state could not
+# be told. The probe establishes only that the check failed - it also fails
 # on a non-200 *response* - so this must NOT be conflated with
 # `STOP_TESTING_EXIT_CODE`, which the job side reports as "Server died". Kept in
 # sync with `HUNG_CHECK_EXIT_CODE` in
@@ -4137,11 +4140,10 @@ class TestCase:
                         or "Attempt to read after eof" in stderr
                     )
                     and "Received exception from server" not in stderr
+                ):
                     # Only a server that is really gone stops the whole run: a
                     # stalled but live server keeps the plain exit-code failure.
-                    and probed_server_is_gone(self.args)
-                ):
-                    reason = FailureReason.LIVENESS_CHECK_FAILED
+                    reason = probed_server_failure(self.args) or reason
 
                 if os.path.isfile(self.stdout_file):
                     description += ", result:\n\n"
@@ -4664,13 +4666,16 @@ class TestCase:
                     # A server that is unresponsive but still holds its
                     # listening socket is stalled, not dead - do not stop the
                     # run for it; the parent hung check owns that verdict.
-                    if probed_server_is_gone(self.args):
+                    reason = probed_server_failure(self.args)
+                    if reason is not None:
                         return TestResult(
                             self.name,
                             TestStatus.FAIL,
-                            FailureReason.LIVENESS_CHECK_FAILED,
+                            reason,
                             0.0,
-                            "\nServer liveness check failed\n",
+                            "\nServer died\n"
+                            if reason == FailureReason.SERVER_DIED
+                            else "\nServer liveness check failed\n",
                         )
 
             self.runs_count += 1
@@ -4811,20 +4816,13 @@ class TestCase:
             exc_description = self.add_info_about_settings(
                 self.get_description_from_exception_info(sys.exc_info())
             )
-            if probed_server_is_gone(self.args):
-                return TestResult(
-                    self.name,
-                    TestStatus.FAIL,
-                    FailureReason.LIVENESS_CHECK_FAILED,
-                    total_time,
-                    exc_description,
-                )
-            # Server is alive (answering, or silent but still holding its
-            # listening socket) - this was a transient network error or a stall.
+            reason = probed_server_failure(self.args)
             return TestResult(
                 self.name,
                 TestStatus.FAIL,
-                FailureReason.CONNECTION_ERROR,
+                # Server is alive (answering, or silent but still holding its
+                # listening socket) - this was a transient network error or a stall.
+                reason or FailureReason.CONNECTION_ERROR,
                 total_time,
                 exc_description,
             )
@@ -4865,7 +4863,7 @@ class TestCase:
             # outer handler in run() classifies it as CONNECTION_ERROR — a
             # silent swallow would let a test stay OK while leaving its
             # database behind, hiding the bug.
-            if not probed_server_is_gone(args):
+            if probed_server_failure(args) is None:
                 raise
             # Server died between the test finishing and cleanup running.
             # The test's database is moot
```

---

### Incident Patch 3: `9c91e34a` (2026-11-20)
**Commit Message**: Merge pull request #133124 from nihalzp/top-k-pruning-nullable-keys

Top-K pruning of `GROUP BY` over `Nullable` keys

**File**: `src/Interpreters/AdaptiveAggregation/AdaptiveAggregation.cpp` (modified, +25/-0)
```diff
@@ -340,6 +340,17 @@ void Aggregator::finishAdaptiveProducer(AggregatedDataVariants & local_variants,
         estimated_merge_work += collectAdaptiveTableStatistics(
             local_variants, count_bins, max_count_per_bucket, table_threshold ? &*table_threshold : nullptr);
 
+    /// The NULL key of a method that keeps it in a slot of its own is a group outside the cells, which the
+    /// count bins and the table's floor do not rank (see `keeps_null_key_slot`). The statistics above rank
+    /// the groups only for a descending top-K with the pruning, while the session needs the NULL key's rank
+    /// for every top-K (see `AdaptiveTopKNullKey`), so the producer reads it here. The rank joins the table's
+    /// floor like the rank of a cell, and goes to the session.
+    std::optional<UInt64> null_key_rank;
+    if (params.bucket_top_k)
+        null_key_rank = adaptiveNullKeyRank(local_variants);
+    if (null_key_rank && table_threshold)
+        table_threshold->offer({&*null_key_rank, 1});
+
     const UInt64 top_k_floor = table_threshold ? table_threshold->current() : 0;
 
     std::optional<AdaptiveTopKPruning::ProducerBins> bins;
@@ -368,6 +379,8 @@ void Aggregator::finishAdaptiveProducer(AggregatedDataVariants & local_variants,
     ++shared.finished_producers;
     shared.table_cells += local_variants.sizeWithoutOverflowRow();
     shared.top_k_floor = std::max(shared.top_k_floor, top_k_floor);
+    if (null_key_rank)
+        shared.top_k_null_key.addProducerRank(*null_key_rank);
     if (froze)
     {
         ++shared.frozen_producers;
@@ -390,7 +403,12 @@ void Aggregator::prepareAdaptiveTopK(
     if (pruning)
     {
         if (mergePrunesByTopK(shared, *pruning, producers, external_merge, collects_statistics))
+        {
+            /// Bucket 0 holds the NULL key outside the bins. Every producer counted, so its upper bound
+            /// holds.
+            pruning->raiseBucketBound(0, shared.top_k_null_key.upperBound());
             pruning->orderBuckets();
+        }
         else
             pruning.reset();
     }
@@ -411,6 +429,13 @@ void Aggregator::prepareAdaptiveTopK(
         best_possible_rank = bucket_top_k_min_rank;
     shared.top_k_threshold = std::make_unique<AdaptiveTopKThreshold>(
         params.bucket_top_k, params.bucket_top_k_ascending, best_possible_rank, shared.top_k_floor);
+
+    /// The producers' tables bound the NULL key's rank, so the threshold takes it before the merge.
+    shared.top_k_null_key.offerBeforeMerge(
+        *shared.top_k_threshold,
+        params.bucket_top_k_ascending,
+        /*exact_ranks=*/bucket_top_k_rank != BucketTopKRank::FinalizedResult,
+        /*every_producer_finished=*/shared.finished_producers == producers);
 }
 
 bool Aggregator::mergePrunesByTopK(
```

**File**: `src/Interpreters/AdaptiveAggregation/AdaptiveAggregationImpl.h` (modified, +7/-0)
```diff
@@ -17,6 +17,7 @@
 #include <DataTypes/IDataType.h>
 #include <Interpreters/AdaptiveAggregation/AdaptiveAggregation.h>
 #include <Interpreters/AdaptiveAggregation/AdaptivePartitionLayout.h>
+#include <Interpreters/AdaptiveAggregation/AdaptiveTopKNullKey.h>
 #include <Interpreters/AdaptiveAggregation/AdaptiveTopKPruning.h>
 #include <Interpreters/AdaptiveAggregation/AdaptiveTopKThreshold.h>
 #include <Interpreters/AdaptiveAggregation/StagedRecords.h>
@@ -244,6 +245,12 @@ struct AdaptiveAggregationSession
     /// mutex.
     UInt64 top_k_floor = 0;
 
+    /// The NULL key of a top-K over a method that keeps it in a slot of its own (see `AdaptiveTopKNullKey`).
+    /// The producers that hold the NULL key add their ranks under the same mutex (see
+    /// `Aggregator::finishAdaptiveProducer`), and `Aggregator::prepareAdaptiveTopK` offers it to
+    /// `top_k_threshold`.
+    AdaptiveTopKNullKey top_k_null_key;
+
     /// The staged records the producers spilled over the external-aggregation threshold (see
     /// `Aggregator::spillAdaptivePartitions`): one raw stream per partition, shared by the producers and created by the
     /// first spill into it, so that a merge unit reads back the records of its own partitions only. A stream is a
```

**File**: `src/Interpreters/AdaptiveAggregation/AdaptiveTopKNullKey.cpp` (added, +40/-0)
```diff
@@ -0,0 +1,40 @@
+#include <Interpreters/AdaptiveAggregation/AdaptiveTopKNullKey.h>
+
+#include <Interpreters/AdaptiveAggregation/AdaptiveTopKThreshold.h>
+
+namespace DB
+{
+
+void AdaptiveTopKNullKey::offerBeforeMerge(
+    AdaptiveTopKThreshold & threshold, bool ascending_, bool exact_ranks, bool every_producer_finished)
+{
+    ascending = ascending_;
+    if (!held)
+        return;
+    if (!ascending)
+        offered = exact_ranks ? rank_sum : rank_max;
+    else if (exact_ranks && every_producer_finished)
+        offered = rank_sum;
+    if (offered)
+        threshold.offer({&*offered, 1});
+}
+
+bool AdaptiveTopKNullKey::canReachTop(const AdaptiveTopKThreshold & threshold, bool pruned) const
+{
+    if (pruned)
+        return rank_sum >= threshold.current();
+    if (ascending && offered)
+        return *offered <= threshold.current();
+    return !threshold.settled();
+}
+
+bool AdaptiveTopKNullKey::replaceOffer(AdaptiveTopKThreshold & threshold, UInt64 rank) const
+{
+    if (!offered)
+        return false;
+    if (rank != *offered)
+        threshold.replaceOffer(*offered, rank);
+    return true;
+}
+
+}
```

**File**: `src/Interpreters/AdaptiveAggregation/AdaptiveTopKNullKey.h` (added, +72/-0)
```diff
@@ -0,0 +1,72 @@
+#pragma once
+
+#include <algorithm>
+#include <optional>
+
+#include <base/types.h>
+
+namespace DB
+{
+
+class AdaptiveTopKThreshold;
+
+/// The NULL key of a top-K (see `Aggregator::Params::bucket_top_k`) over a method that keeps the NULL key in
+/// a slot of its own (see `keeps_null_key_slot`). The NULL key is a group outside the cells of the table, and
+/// it has no hash, so no count bin bounds it (see `AdaptiveTopKPruning`). Its ranks in the producers' tables
+/// bound its final rank instead: the final rank of a `count` is the sum of these ranks once every producer
+/// finished, and a `uniqExact` merges to at least the largest and at most the sum of them, because a union
+/// has no more elements than its parts together. By these bounds, the merge takes the NULL key into the top-K
+/// like a group of the bins: the threshold takes a rank of it before any unit is converted
+/// (`offerBeforeMerge`), the unit that holds it merges it only while it can reach the top (`canReachTop`),
+/// and its exact rank replaces the offered one once its unit is converted (`replaceOffer`). The rules of the
+/// three share one invariant: the threshold counts the offered rank only while the unit would still merge the
+/// NULL key.
+class AdaptiveTopKNullKey
+{
+public:
+    /// Adds the rank of the NULL key in a producer's table. The caller holds the session's
+    /// `producer_buffers_mutex`.
+    void addProducerRank(UInt64 rank)
+    {
+        held = true;
+        rank_sum += rank;
+        rank_max = std::max(rank_max, rank);
+    }
+
+    /// A rank that the NULL key does not exceed once every producer finished: the sum of its ranks in the
+    /// producers' tables, 0 when no producer held it.
+    [[nodiscard]] UInt64 upperBound() const { return rank_sum; }
+
+    /// Offers `threshold` a rank of the NULL key before the merge, so the threshold rises before any unit is
+    /// converted, and a large NULL key drops more of the units that the merge tasks merge first. A descending
+    /// order takes a bound from below: the sum of the counts, which is the exact count once every producer
+    /// finished, or the largest distinct count in one table. An ascending order takes only the exact count,
+    /// the sum of the counts once every producer finished, because `canReachTop` judges an ascending NULL key
+    /// by its offered rank. A producer without the adaptive context, another aggregator of a mixed projection
+    /// pipeline, does not add its NULL key. The caller calls it once, after the finish barrier and before the
+    /// merge starts.
+    void offerBeforeMerge(AdaptiveTopKThreshold & threshold, bool ascending_, bool exact_ranks, bool every_producer_finished);
+
+    /// Whether the unit that holds the NULL key merges it, at the threshold of the moment. With the count
+    /// bins of a descending order (`pruned`), it can reach the top while its upper bound reaches the
+    /// threshold. The threshold counts the exact rank that an ascending order offered, so the NULL key must
+    /// reach the output while that rank is not worse than the threshold, even once the threshold settled.
+    /// Otherwise it is merged unless a settled threshold skips every unit left.
+    [[nodiscard]] bool canReachTop(const AdaptiveTopKThreshold & threshold, bool pruned) const;
+
+    /// Replaces the rank offered before the merge by `rank`, the exact rank of the NULL key in the output of
+    /// its unit (see `AdaptiveTopKThreshold::replaceOffer`). Returns whether the NULL key had an offered
+    /// rank: the caller then leaves the NULL key out of the unit's offer, because an offer counts a group
+    /// once.
+    bool replaceOffer(AdaptiveTopKThreshold & threshold, UInt64 rank) const;
+
+private:
+    bool held = false;
+    bool ascending = false;
+    UInt64 rank_sum = 0;
+    UInt64 rank_max = 0;
+    /// The rank that `offerBeforeMerge` offered.
+    std::optional<UInt64> offered;
+};
+
+}
```

**File**: `src/Interpreters/AdaptiveAggregation/AdaptiveTopKPruning.h` (modified, +12/-3)
```diff
@@ -166,6 +166,14 @@ class AdaptiveTopKPruning
     /// merge starts.
     [[nodiscard]] bool countsEveryProducer(size_t producers) const { return producer_bins.size() + merge_counted_tables.size() == producers; }
 
+    /// Raises the bound of `bucket` to `bound`, a rank that a group of the bucket outside the bins does not
+    /// exceed, such as the NULL key that bucket 0 holds for a method that keeps it in a slot of its own (see
+    /// `AdaptiveTopKNullKey`). Called after the finish barrier, before `orderBuckets`.
+    void raiseBucketBound(size_t bucket, UInt64 bound)
+    {
+        count_bound_per_bucket[bucket] = std::max(count_bound_per_bucket[bucket], bound);
+    }
+
     /// Orders the buckets for the merge by their bounds, `count_bound_per_bucket`. A table without the
     /// largest counts of its buckets is not in this order, which only lets the threshold rise later. Called
     /// once, after the finish barrier and before the merge starts.
@@ -210,9 +218,10 @@ class AdaptiveTopKPruning
     /// `boundsForBucket`).
     std::vector<AdaptiveTopKCountBins> producer_bins;
     std::vector<const AggregatedDataVariants *> merge_counted_tables;
-    /// The sum of every producer's largest bin in each bucket and of the bucket's largest count in every table
-    /// that the merge counts and that brought it. It orders the buckets for the merge (see `orderBuckets`), and it
-    /// bounds the ranks of the groups of every bucket but those of `bucket_is_unbounded` (see `bucketBound`).
+    /// The sum of every producer's largest bin in each bucket and of the bucket's largest count in every
+    /// table that the merge counts and that brought it, raised by `raiseBucketBound`. It orders the buckets
+    /// for the merge (see `orderBuckets`), and it bounds the ranks of the groups of every bucket but those of
+    /// `bucket_is_unbounded` (see `bucketBound`).
     std::array<UInt64, ADAPTIVE_AGGREGATION_NUM_BUCKETS> count_bound_per_bucket{};
     std::array<bool, ADAPTIVE_AGGREGATION_NUM_BUCKETS> bucket_is_unbounded{};
     std::array<UInt8, ADAPTIVE_AGGREGATION_NUM_BUCKETS> bucket_order{};
```

**File**: `src/Interpreters/AdaptiveAggregation/AdaptiveTopKThreshold.cpp` (modified, +13/-0)
```diff
@@ -29,6 +29,19 @@ void AdaptiveTopKThreshold::offer(std::span<const UInt64> ranks)
         offerImpl<std::greater<>>(ranks);
 }
 
+void AdaptiveTopKThreshold::replaceOffer(UInt64 offered, UInt64 rank)
+{
+    {
+        std::lock_guard lock(mutex);
+        if (const auto kept_offered = std::ranges::find(kept, offered); kept_offered != kept.end())
+        {
+            *kept_offered = rank;
+            return;
+        }
+    }
+    offer({&rank, 1});
+}
+
 template <typename Better>
 void AdaptiveTopKThreshold::offerImpl(std::span<const UInt64> ranks)
 {
```

**File**: `src/Interpreters/AdaptiveAggregation/AdaptiveTopKThreshold.h` (modified, +20/-5)
```diff
@@ -64,13 +64,28 @@ class AdaptiveTopKThreshold
     /// Whether the threshold reached `best_possible_rank`, so that the merge can skip every unit left.
     [[nodiscard]] bool settled() const { return best_possible_rank && current() == *best_possible_rank; }
 
-    /// Offers the ranks of groups, each group at most once: the threshold is the worst of the `limit` best ranks
-    /// offered. The merge offers the ranks of the groups that a converted unit output, and guarantees that each is
-    /// the final rank of its group, merged from every source, and that the group reaches the output: that is what
-    /// lets it drop the groups ranked worse than the threshold. A producer offers the ranks that the groups have in
-    /// its own table, which only bound the final ranks from below.
+    /// Offers the ranks of groups, each group at most once: the threshold is the worst of the `limit` best
+    /// ranks offered. The merge offers the ranks of the groups that a converted unit output, and guarantees
+    /// that each is the final rank of its group, merged from every source, and that the group reaches the
+    /// output: that is what lets it drop the groups ranked worse than the threshold. A producer offers the
+    /// ranks that the groups have in its own table, which only bound the final ranks from below. Before any
+    /// unit is converted, the merge also offers the NULL key of a method that keeps it in a slot of its own
+    /// (see `AdaptiveTopKNullKey`), with a rank no better than its final one, which the conversion of its
+    /// unit replaces later (see `replaceOffer`). While the threshold keeps that rank, the threshold is no
+    /// better than the NULL key's final rank, so neither the bound check of its unit nor a conversion drops
+    /// the NULL key, and the selection of its unit drops it only behind `limit` output groups that rank at
+    /// least as well. Once a selection drops the offered rank, the threshold no longer counts the NULL key.
     void offer(std::span<const UInt64> ranks);
 
+    /// Replaces `offered`, the rank with which `offer` took a group before its final rank was known, with
+    /// `rank`, the final rank. The caller guarantees that `offered` is no better than `rank`, so the group
+    /// stays counted once, with a rank at least as good. For example, the merge offers the NULL key of a
+    /// descending top-K by `uniqExact` with its largest distinct count in one table before any unit is
+    /// converted, and replaces it with the merged distinct count when its unit is converted. A kept `offered`
+    /// is replaced in place: every kept rank is at least as good as the threshold, so `rank` is too. When a
+    /// selection has already dropped `offered`, `rank` is offered as a new rank.
+    void replaceOffer(UInt64 offered, UInt64 rank);
+
 private:
     template <typename Better>
     void offerImpl(std::span<const UInt64> ranks);
```

**File**: `src/Interpreters/AdaptiveAggregation/Merge.cpp` (modified, +143/-30)
```diff
@@ -570,6 +570,10 @@ namespace
             }
         }
 
+        /// Whether some source holds the NULL key in its slot for `unit` (see
+        /// `forEachSourceTableWithNullKey`).
+        [[nodiscard]] bool hasNullKeys(size_t unit) const { return unit == 0 && !null_key_sources.empty(); }
+
         /// How many source cells `unit` has, counting the NULL key of every source that holds it as one.
         [[nodiscard]] size_t count(size_t unit) const
         {
@@ -895,27 +899,40 @@ void Aggregator::adoptSourceNullKeys(Table & table, const ForEachSourceTable & f
     });
 }
 
+template <typename Method, typename ForEachSourceTable>
+void Aggregator::discardSourceNullKeys(const ForEachSourceTable & for_each_source_table) const
+{
+    for_each_source_table([&](auto & source)
+    {
+        if constexpr (MapAggregationMethod<Method>)
+            discardAdaptiveSourceState(source.getNullKeyData());
+        source.hasNullKeyData() = false;
+    });
+}
+
 template <
     typename Method,
     typename Table,
     typename ForEachCell,
     typename TopK,
     typename ForEachInMemoryPartition,
     typename ForEachSpilledBlock>
-size_t Aggregator::selectCountFirstBestGroups(
+Aggregator::CountFirstSelection Aggregator::selectCountFirstBestGroups(
     Table & counting_table,
     const ForEachCell & for_each_cell,
     const bool * alive_bins,
     TopK * top_k,
     const AdaptiveTopKThreshold & threshold,
     const ForEachInMemoryPartition & for_each_in_memory_partition,
     const ForEachSpilledBlock & for_each_spilled_block,
+    std::optional<UInt64> null_key_count,
     Arena * arena,
     AdaptiveMergeTask & task,
     size_t & pruned_records) const
 {
     using Key = AdaptiveRecordKey<Method>;
     const size_t rank_offset = offsets_of_aggregate_states[params.bucket_top_k_rank_index];
+    CountFirstSelection selection;
 
     /// The groups are counted in the table, each count kept in the mapped value as a lone `count()` keeps it: a source
     /// cell adds its count state, a record one row. With a descending order, the top takes every grown count and keeps
@@ -970,9 +987,28 @@ size_t Aggregator::selectCountFirstBestGroups(
     {
         /// A group counted below the threshold, a floor, cannot reach the top.
         const UInt64 min_count = threshold.current();
-        for (const auto & group : top_k->getGroups())
+        const auto & groups = top_k->getGroups();
+        for (const auto & group : groups)
             if (group.count >= min_count)
                 best_hashes.push_back(group.hash);
+        /// The NULL key, which the counting table does not hold, joins the best groups by its count. A full
+        /// top gives up its group of the smallest count when the NULL key's count beats it.
+        if (null_key_count && *null_key_count >= min_count)
+        {
+            if (best_hashes.size() < params.bucket_top_k)
+            {
+                selection.keeps_null_key = true;
+            }
+            else
+            {
+                const auto worst = std::ranges::min_element(groups, {}, [](const auto & group) { return group.count; });
+                if (*null_key_count > worst->count)
+                {
+                    selection.keeps_null_key = true;
+                    best_hashes.erase(std::ranges::find(best_hashes, worst->hash));
+                }
+            }
+        }
     }
     else
     {
@@ -1002,10 +1038,25 @@ size_t Aggregator::selectCountFirstBestGroups(
                     std::push_heap(best.begin(), best.end(), by_count);
                 }
             });
+        /// The NULL key joins the smallest counts as a group would.
+        if (null_key_count && *null_key_count <= max_count)
+        {
+            if (best.size() < params.bucket_top_k)
+            {
+                selection.keeps_null_key = true;
+            }
+            else if (*null_key_count < best.front().first)
+            {
+                selection.keeps_null_key = true;
+                std::pop_heap(best.begin(), best.end(), by_count);
+                best.pop_back();
+            }
+        }
         for (const auto & [count, hash] : best)
             best_hashes.push_back(hash);
     }
-    return counting_table.size();
+    selection.groups = counting_table.size() + null_key_count.has_value();
+    return selection;
 }
 
 template <typename Record>
@@ -1085,19 +1136,6 @@ void Aggregator::executeStagedArguments(
         use_compiled_functions);
 }
 
-ALWAYS_INLINE UInt64 Aggregator::adaptiveRankCount(AggregateDataPtr & mapped, IColumn * scratch, Arena * arena) const
-{
-    switch (bucket_top_k_rank)
-    {
-        case BucketTopKRank::InlineCount:
-            return getInlineCountState(mapped);
-        case BucketTopKRank::CountState:
-            return getCountState(mapped + offsets_of_aggregate_states[params.bucket_top_k_rank_index]);
-        case BucketTopKRank::FinalizedResult:
-            return finalizeBucketTopKRank(mapped, *scratch, are
```

#### Recent Merged Pull Requests:
- **PR #133205** (2026-11-20): Backport #125828 to 26.10: Fix wrong results and `NOT_FOUND_COLUMN_IN_BLOCK` for a `GROUP BY` key inside an `if` chain or an `ORDER BY` tuple (@robot-clickhouse-ci-2)
- **PR #133204** (2026-11-20): Backport #125828 to 26.9: Fix wrong results and `NOT_FOUND_COLUMN_IN_BLOCK` for a `GROUP BY` key inside an `if` chain or an `ORDER BY` tuple (@robot-clickhouse-ci-2)
- **PR #133199** (2026-11-20): Backport #132755 to 26.10: Fix double destroy of aggregate states when `create` throws after `destroy` (@robot-clickhouse-ci-2)
- **PR #133198** (2026-11-20): Backport #132755 to 26.9: Fix double destroy of aggregate states when `create` throws after `destroy` (@robot-clickhouse-ci-2)
- **PR #133197** (2026-11-20): Backport #132755 to 26.8: Fix double destroy of aggregate states when `create` throws after `destroy` (@robot-clickhouse-ci-2)
- **PR #133192** (2026-11-20): Backport #131928 to 26.11: Fix `Merge` over `Distributed` dropping a column that the query selects twice (@robot-ch-test-poll2)

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

## X. Empirical Invariant Guard in PrettyFormatHelpers.cpp

**RULE**:
When implementing operations in `src/Formats/PrettyFormatHelpers.cpp`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in ClickHouse/ClickHouse. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `9a8a1a79`: . Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing C++ data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/Formats/PrettyFormatHelpers.cpp`.

**VERIFIED IMPLEMENTATION PATTERN**:
```c++
// Verified production-grade fix pattern:
    /// `cut_to + hysteresis` could overflow for a huge `cut_to`, turning short names into names "cut" to that width.
    if (!cut_to || length <= cut_to || length - cut_to <= hysteresis || isValidIdentifier(name))
```

**NEGATIVE CONSTRAINT**:
```c++
// Induced defect failure mode:
    if (!cut_to || length <= cut_to + hysteresis || isValidIdentifier(name))
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `9a8a1a79` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.

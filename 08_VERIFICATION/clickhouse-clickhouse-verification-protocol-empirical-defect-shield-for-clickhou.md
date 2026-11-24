# Verification Protocol: Verification Protocol: Empirical Defect Shield for ClickHouse/ClickHouse

<!-- PROVENANCE_START
{
  "source_repository": "ClickHouse/ClickHouse",
  "source_url": "https://github.com/ClickHouse/ClickHouse",
  "source_version": "b6467a3e",
  "license": "Apache-2.0",
  "timestamp": "2026-11-24T17:42:52.165Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-clickhouse-clickhouse",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [ClickHouse/ClickHouse](https://github.com/ClickHouse/ClickHouse) (Revision: `b6467a3e`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-24T17:42:52.165Z`  
> **Learning ID**: `learn-github-clickhouse-clickhouse`


## 1. Scope & Verification Target
- **Target Repository**: `ClickHouse/ClickHouse` (Commit: `b6467a3e`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
# Forensic Learning Record (Deep Inspection): ClickHouse/ClickHouse

> **Canonical Artifact**: `07_PROJECT_LEARNING/clickhouse-clickhouse-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/ClickHouse/ClickHouse](https://github.com/ClickHouse/ClickHouse))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-24T17:42:50.921Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `ClickHouse/ClickHouse`
- **Description**: ClickHouse® is a real-time analytics database management system
- **Primary Language / Ecosystem**: C++
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 51103 stars

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
- **Issue #133698** (2026-11-24): **SHOW CREATE ROLES bypasses max_result_rows**
  *Symptoms*: ### Describe what's wrong  On ClickHouse 26.11.1.2508, `SHOW CREATE ROLES` returns two rows successfully when `max_result_rows = 1` and `result_overflow_mode = 'throw'`. An equivalent query against `system.roles` correctly fails with `TOO_MANY_ROWS_OR_BYTES`.  ### Does it reproduce on the most recent release?  No  ### How to reproduce  Run as a user allowed to create and inspect roles:  ```sql CREATE ROLE role_a; CREATE ROLE role_b;  SET max_result_rows = 1; SET result_overflow_mode = 'throw';  SHOW CREATE ROLES role_a, role_b; -- Succeeds and returns: -- CREATE ROLE role_a -- CREATE ROLE role_b  SELECT name FROM system.roles WHERE name IN ('role_a', 'role_b') ORDER BY name; -- Fails with TOO_MANY_ROWS_OR_BYTES. ```  ### Expected behavior  `SHOW CREATE ROLES` should enforce `max_result_rows` and fail because it produces two rows while the limit is one. The `max_result_rows` documentation states: “Limits the number of rows in the result. Also checked for subqueries, and on remote servers when running parts of a distributed query. No limit is applied when the value is `0`.”  ### Error message and/or stacktrace  ```text Received exception from server (version 26.11.1): Code: 396. DB::Exception: Received from localhost:9000. DB::Exception: Limit for result exceeded, max rows: 1.00, current rows: 2.00. (TOO_MANY_ROWS_OR_BYTES) (query: SELECT name FROM system.roles WHERE name IN ('role_a', 'role_b') ORDER BY name;) ``` 

- **Issue #133671** (2026-11-24): **Keeper/NuRaft: use-after-free `SIGSEGV` in `auto_fwd_resp_handler` on follower shutdown because `raft_instance` is destroyed before `asio_service->stop`**
  *Symptoms*: ### Description  Shutting down a ClickHouse Keeper follower while an auto-forwarded write (`auto_forwarding = true`) is in flight triggers a use-after-free `SIGSEGV` in NuRaft's `raft_server::auto_fwd_resp_handler` / `raft_server::auto_fwd_release_rpc_cli`.  ### Root Cause  1. In NuRaft (`contrib/NuRaft/src/handle_user_cmd.cxx:320-327` and `:371-377`), `auto_fwd_resp_handler` is registered onto `rpc_cli->send` using `std::bind` with a **raw `this` pointer** (`raft_server *`), not `shared_from_this` / `weak_ptr`:    ```cpp    rpc_handler handler = std::bind( &raft_server::auto_fwd_resp_handler,                                     this,                                     presult,                                     cur_pkg,                                     rpc_cli,                                     std::placeholders::_1,                                     std::placeholders::_2 );    rpc_cli->send(req, handler, params->auto_forwarding_req_timeout_);    ``` 2. During `raft_server::shutdown` (`contrib/NuRaft/src/raft_server.cxx:595`), `cleanup_auto_fwd_pkgs` (`contrib/NuRaft/src/handle_user_cmd.cxx:417-437`) logs `srv 3, in-use 1, idle 0` and clears `pkg->rpc_client_in_use_` and `auto_fwd_pkgs_` **without stopping/cancelling in-flight `rpc_client` instances or waiting for their callbacks to drain**. 3. In ClickHouse Keeper, `KeeperServer::shutdownRaftServer` (`src/Coordination/KeeperServer.cpp:876-907`) calls `raft_instance->shutdown` and **`raft_instance.reset`** (destroyi

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

### Incident Patch 1: `8a27da1e` (2026-11-24)
**Commit Message**: Merge pull request #133804 from ahaanlimaye/ahaanlimaye/merge-size-overflow

Fix overflow in merge size estimates after lightweight deletes

**File**: `src/Storages/MergeTree/IMergeTreeDataPart.cpp` (modified, +1/-1)
```diff
@@ -1321,7 +1321,7 @@ UInt64 IMergeTreeDataPart::getExistingBytesOnDisk() const
 {
     if ((*storage.getSettings())[MergeTreeSetting::exclude_deleted_rows_for_part_size_in_merge] && supportLightweightDeleteMutate() && hasLightweightDelete()
         && existing_rows_count.has_value() && existing_rows_count.value() < rows_count && rows_count > 0)
-        return bytes_on_disk * existing_rows_count.value() / rows_count;
+        return static_cast<UInt64>(UInt128(bytes_on_disk) * existing_rows_count.value() / rows_count);
     return bytes_on_disk;
 }
 
```

**File**: `src/Storages/MergeTree/tests/gtest_existing_bytes_on_disk.cpp` (added, +72/-0)
```diff
@@ -0,0 +1,72 @@
+#include <gtest/gtest.h>
+
+#include <Common/ThreadStatus.h>
+#include <Common/tests/gtest_global_context.h>
+#include <Common/tests/gtest_global_register.h>
+#include <DataTypes/DataTypesNumber.h>
+#include <IO/SharedThreadPools.h>
+#include <Parsers/ASTFunction.h>
+#include <Storages/MergeTree/IMergeTreeDataPart.h>
+#include <Storages/MergeTree/MergeTreeDataPartBuilder.h>
+#include <Storages/MergeTree/MergeTreeSettings.h>
+#include <Storages/MergeTree/MergeTreeVirtualColumns.h>
+#include <Storages/StorageMergeTree.h>
+
+#include <Poco/TemporaryFile.h>
+
+TEST(MergeTreeDataPart, ExistingBytesOnDiskAfterLightweightDelete)
+{
+    using namespace DB;
+
+    MainThreadStatus::getInstance();
+    tryRegisterFunctions();
+    tryRegisterAggregateFunctions();
+    getActivePartsLoadingThreadPool().initializeWithDefaultSettingsIfNotInitialized();
+    getOutdatedPartsLoadingThreadPool().initializeWithDefaultSettingsIfNotInitialized();
+    getUnexpectedPartsLoadingThreadPool().initializeWithDefaultSettingsIfNotInitialized();
+    getPartsCleaningThreadPool().initializeWithDefaultSettingsIfNotInitialized();
+
+    auto context = Context::createCopy(getContext().context);
+    StorageInMemoryMetadata metadata;
+    metadata.setColumns({{"id", std::make_shared<DataTypeUInt64>()}});
+    metadata.sorting_key = KeyDescription::getKeyFromAST(makeASTFunction("tuple"), metadata.columns, {}, context);
+    metadata.primary_key = metadata.sorting_key;
+    metadata.primary_key.definition_ast = nullptr;
+    metadata.partition_key = KeyDescription::getKeyFromAST(nullptr, metadata.columns, {}, context);
+
+    auto settings = std::make_unique<MergeTreeSettings>(context->getMergeTreeSettings());
+    settings->set("exclude_deleted_rows_for_part_size_in_merge", true);
+    Poco::TemporaryFile table_dir(".");
+    auto storage = std::make_shared<StorageMergeTree>(
+        StorageID("test_db", "existing_bytes_on_disk"), table_dir.path() + "/", metadata, LoadingStrictnessLevel::ATTACH,
+        context, "", MergeTreeData::MergingParams{}, std::move(settings));
+
+    const String part_name = "all_1_1_0";
+    auto part = MergeTreeDataPartBuilder(
+        *storage, part_name, storage->getStoragePolicy()->getVolume(0), storage->getRelativeDataPath(),
+        part_name, context->getReadSettings(), PartDirIntent::CreateFresh)
+        .withPartFormat({MergeTreeDataPartType::Wide, MergeTreeDataPartStorageType::Full})
+        .build();
+    auto columns = metadata.getColumns().getAllPhysical();
+    columns.emplace_back(RowExistsColumn::name, RowExistsColumn::type);
+    part->setColumns(columns, SerializationInfoByName(SerializationInfoSettings{}), 0);
+
+    auto existing_bytes = [&](UInt64 bytes, size_t total_rows, std::optional<size_t> existing_rows)
+    {
+        part->setBytesOnDisk(bytes);
+        part->rows_count = total_rows;
+        part->existing_rows_count = existing_rows;
+        return part->getExistingBytesOnDisk();
+    };
+
+    EXPECT_EQ(existing_bytes(100ULL << 30, 40'000'000'000, 39'999'999'999), 107'374'182'397ULL);
+    constexpr auto max = std::numeric_limits<UInt64>::max();
+    EXPECT_EQ(existing_bytes(max, max, max - 1), max - 1);
+    EXPECT_EQ(existing_bytes(11, 3, 2), 7u);
+    EXPECT_EQ(existing_bytes(11, 3, 0), 0u);
+    EXPECT_EQ(existing_bytes(11, 3, 3), 11u);
+    EXPECT_EQ(existing_bytes(11, 0, 0), 11u);
+    EXPECT_EQ(existing_bytes(11, 3, std::nullopt), 11u);
+
+    storage->flushAndShutdown();
+}
```

---

### Incident Patch 2: `ce39b030` (2026-11-24)
**Commit Message**: Pad an empty Protobuf wrapper into Nullable with the type default only

An empty google wrapper read into `Nullable(T)` went through the `value`
field serializer, so an empty `StringValue` into `Nullable(Date)`,
`Nullable(Int32)`, `Nullable(UUID)`, ... failed to parse `''` instead of
storing the type default as master does (review on #134040).

Keep master's borrowed default insertion and pass it the nested type, so
only a scalar whose type default differs from the column zero changes:
`Enum`, also inside `Nullable(Tuple(...))`. Calling
`nested_type->insertDefaultInto` directly is not possible there: for
`Nullable(Tuple(...))` it dereferences the tuple elements, which the element
serializers also hold, and aborts on the `use_count() == 1` assertion.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `src/Formats/ProtobufSerializer.cpp` (modified, +13/-6)
```diff
@@ -151,7 +151,8 @@ namespace
     /// of a composite column would reach sub-columns that are also held by the serializers
     /// of its nested fields through the non-const `WrappedPtr` dereference.
     /// Exception-safe: on failure, the already appended sub-columns are rolled back.
-    void insertDefaultBorrowed(IColumn & column)
+    /// With `type`, a scalar gets the default of its type (e.g. the first element of an `Enum`), not the column's.
+    void insertDefaultBorrowed(IColumn & column, const IDataType * type = nullptr)
     {
         if (auto * column_array = typeid_cast<ColumnArray *>(&column))
         {
@@ -169,11 +170,12 @@ namespace
                 return;
             }
             const auto & elements = std::as_const(*column_tuple).getColumns();
+            const auto * tuple_type = typeid_cast<const DataTypeTuple *>(type);
             size_t i = 0;
             try
             {
                 for (; i < elements.size(); ++i)
-                    insertDefaultBorrowed(borrowColumnRef(elements[i]));
+                    insertDefaultBorrowed(borrowColumnRef(elements[i]), tuple_type ? tuple_type->getElement(i).get() : nullptr);
             }
             catch (...)
             {
@@ -201,6 +203,10 @@ namespace
                 throw;
             }
         }
+        else if (type)
+        {
+            type->insertDefaultInto(column);
+        }
         else
         {
             column.insertDefault();
@@ -2258,8 +2264,8 @@ namespace
     class ProtobufSerializerNullable : public ProtobufSerializer
     {
     public:
-        explicit ProtobufSerializerNullable(std::unique_ptr<ProtobufSerializer> nested_serializer_)
-            : nested_serializer(std::move(nested_serializer_))
+        ProtobufSerializerNullable(DataTypePtr nested_type_, std::unique_ptr<ProtobufSerializer> nested_serializer_)
+            : nested_type(std::move(nested_type_)), nested_serializer(std::move(nested_serializer_))
         {
         }
 
@@ -2354,7 +2360,7 @@ namespace
             if (row_num < column_nullable.size())
                 return;
             auto & nested_column = borrowColumnRef(column_nullable.getNestedColumnPtr());
-            nested_serializer->insertDefaults(row_num);
+            insertDefaultBorrowed(nested_column, nested_type.get());
             /// Same rollback contract as in `insertDefaults` above.
             try
             {
@@ -2379,6 +2385,7 @@ namespace
         }
 
     private:
+        const DataTypePtr nested_type;
         const std::unique_ptr<ProtobufSerializer> nested_serializer;
         ColumnPtr column;
     };
@@ -4186,7 +4193,7 @@ namespace
                         oneof_presence);
                     if (!nested_serializer)
                         return nullptr;
-                    return std::make_unique<ProtobufSerializerNullable>(std::move(nested_serializer));
+                    return std::make_unique<ProtobufSerializerNullable>(nullable_data_type.getNestedType(), std::move(nested_serializer));
                 }
 
                 case TypeIndex::LowCardinality:
```

**File**: `tests/queries/0_stateless/05872_input_formats_streaming_enum_type_default.reference` (modified, +5/-2)
```diff
@@ -7,10 +7,13 @@ Protobuf, a column missing from the message
 ProtobufList, a column missing from the message
 7	a	('','x')	\N
 Protobuf, a google wrapper without value
-zero	1
+a	1
+neg	1
+('a')	1
 0	1
 \N	1
-	1
+1970-01-01	1
+00000000-0000-0000-0000-000000000000	1
 FileLog, handle_error_mode = stream
 0	a	('','x')	\N	1
 1	b	('p','y')	b	0
```

**File**: `tests/queries/0_stateless/05872_input_formats_streaming_enum_type_default.sql` (modified, +6/-6)
```diff
@@ -27,19 +27,19 @@ SELECT 'ProtobufList, a column missing from the message';
 SET format_schema = 'syntax = "proto3"; message Envelope { message M { int32 x = 1; } repeated M row = 1; }';
 SELECT * FROM format(ProtobufList, 'x Int32, e Enum8(\'a\' = 1, \'b\' = 2), t Tuple(s String, e Enum16(\'x\' = 5, \'y\' = 7)), ne Nullable(Enum8(\'a\' = 1, \'b\' = 2))', '\x04\x0a\x02\x08\x07');
 
--- A wrapper message without `value` holds the default of `value` (0, or '' for a StringValue), read like the same
--- wrapper into the type without Nullable. An absent wrapper is NULL.
+-- A wrapper message without `value` gives the default of the column type, also for a StringValue read into a
+-- non-string type. An absent wrapper is NULL.
 SELECT 'Protobuf, a google wrapper without value';
 SET input_format_protobuf_flatten_google_wrappers = 1;
 SET format_schema = 'syntax = "proto3"; import "google/protobuf/wrappers.proto"; message W { google.protobuf.Int32Value w = 1; int32 k = 2; google.protobuf.StringValue s = 3; }';
 SET format_schema_message_name = 'W';
-SELECT * FROM format(ProtobufSingle, 'w Enum8(\'a\' = 1, \'b\' = 2), k Int32', '\x0a\x00\x10\x01'); -- { serverError UNKNOWN_ELEMENT_OF_ENUM }
-SELECT * FROM format(ProtobufSingle, 'w Nullable(Enum8(\'a\' = 1, \'b\' = 2)), k Int32', '\x0a\x00\x10\x01'); -- { serverError UNKNOWN_ELEMENT_OF_ENUM }
+SELECT * FROM format(ProtobufSingle, 'w Nullable(Enum8(\'a\' = 1, \'b\' = 2)), k Int32', '\x0a\x00\x10\x01');
 SELECT * FROM format(ProtobufSingle, 'w Nullable(Enum8(\'neg\' = -1, \'zero\' = 0)), k Int32', '\x0a\x00\x10\x01');
+SELECT * FROM format(ProtobufSingle, 'w Nullable(Tuple(Enum8(\'a\' = 1, \'b\' = 2))), k Int32', '\x0a\x00\x10\x01');
 SELECT * FROM format(ProtobufSingle, 'w Nullable(Int32), k Int32', '\x0a\x00\x10\x01');
 SELECT * FROM format(ProtobufSingle, 'w Nullable(Enum8(\'a\' = 1, \'b\' = 2)), k Int32', '\x10\x01');
-SELECT * FROM format(ProtobufSingle, 's Nullable(Enum8(\'\' = 3, \'b\' = 2)), k Int32', '\x1a\x00\x10\x01');
-SELECT * FROM format(ProtobufSingle, 's Nullable(Date), k Int32', '\x1a\x00\x10\x01'); -- { serverError CANNOT_PARSE_DATE }
+SELECT * FROM format(ProtobufSingle, 's Nullable(Date), k Int32', '\x1a\x00\x10\x01');
+SELECT * FROM format(ProtobufSingle, 's Nullable(UUID), k Int32', '\x1a\x00\x10\x01');
 
 SELECT 'FileLog, handle_error_mode = stream';
 DROP TABLE IF EXISTS file_log;
```

---

### Incident Patch 3: `3fe8314f` (2026-11-24)
**Commit Message**: feat: add `USE_VORTEX` and `VORTEX_VERSION` to `system.build_options`

`build.rs` reads the version of `vortex` from `Cargo.lock`. `vortex_ffi_version()` returns it.

Signed-off-by: Maksim Dergousov <[REDACTED_EMAIL]>

**File**: `contrib/rust-contrib-workspace/Cargo.lock` (modified, +2/-0)
```diff
@@ -52,6 +52,8 @@ dependencies = [
  "futures",
  "kanal",
  "parking",
+ "serde",
+ "toml",
  "vortex",
 ]
 
```

**File**: `contrib/vortex-cmake/Cargo.toml` (modified, +3/-0)
```diff
@@ -28,3 +28,6 @@ vortex = { version = "0.84.0", default-features = false, features = ["files", "z
 # between patch versions, and the version has to be one `contrib/rust_vendor` carries. Its default
 # features are only needed by the command-line tool.
 cbindgen = { version = "=0.29.2", default-features = false }
+# Read `Cargo.lock`. The same versions and features as in `cbindgen`, so they are vendored already.
+serde = { version = "1", default-features = false, features = ["derive", "std"] }
+toml = { version = "0.9", default-features = false, features = ["parse", "serde", "std"] }
```

**File**: `contrib/vortex-cmake/build.rs` (modified, +54/-1)
```diff
@@ -9,11 +9,27 @@
 
 use std::env;
 use std::fs;
-use std::path::Path;
+use std::path::{Path, PathBuf};
+use std::process::Command;
+
+use serde::Deserialize;
 
 const UPDATE_VAR: &str = "VORTEX_FFI_HEADER_UPDATE";
 
+#[derive(Deserialize)]
+struct Lock {
+    package: Vec<Package>,
+}
+
+#[derive(Deserialize)]
+struct Package {
+    name: String,
+    version: String,
+}
+
 fn main() {
+    emit_vortex_version();
+
     let crate_dir = env::var("CARGO_MANIFEST_DIR").expect("CARGO_MANIFEST_DIR should be set");
     let crate_dir = Path::new(&crate_dir);
     let header_path = crate_dir.join("include/vortex_ffi.h");
@@ -56,3 +72,40 @@ fn main() {
          Run `{UPDATE_VAR}=1 cargo check -p _ch_rust_vortex` and commit the result."
     );
 }
+
+fn emit_vortex_version() {
+    let lock_path = workspace_dir().join("Cargo.lock");
+    println!("cargo::rerun-if-changed={}", lock_path.display());
+
+    let lock = fs::read_to_string(&lock_path)
+        .unwrap_or_else(|error| panic!("cannot read {}: {error}", lock_path.display()));
+    let lock: Lock = toml::from_str(&lock)
+        .unwrap_or_else(|error| panic!("cannot parse {}: {error}", lock_path.display()));
+
+    let versions: Vec<&str> = lock
+        .package
+        .iter()
+        .filter(|package| package.name == "vortex")
+        .map(|package| package.version.as_str())
+        .collect();
+    let [version] = versions[..] else {
+        panic!("expected one version of `vortex` in {}, found {versions:?}", lock_path.display());
+    };
+    println!("cargo::rustc-env=VORTEX_CRATE_VERSION={version}");
+}
+
+fn workspace_dir() -> PathBuf {
+    let cargo = env::var_os("CARGO").expect("CARGO should be set");
+    let output = Command::new(cargo)
+        .args(["locate-project", "--workspace", "--message-format", "plain"])
+        .output()
+        .expect("cannot run `cargo locate-project`");
+    assert!(
+        output.status.success(),
+        "`cargo locate-project` failed: {}",
+        String::from_utf8_lossy(&output.stderr)
+    );
+
+    let manifest = String::from_utf8(output.stdout).expect("the path should be UTF-8");
+    Path::new(manifest.trim()).parent().expect("the path should have a parent").to_owned()
+}
```

**File**: `contrib/vortex-cmake/include/vortex_ffi.h` (modified, +2/-0)
```diff
@@ -362,4 +362,6 @@ void vortex_ffi_writer_free(FFI_VortexWriter *writer);
 /// Frees a string returned by this library, such as an error message.
 void vortex_ffi_free_string(char *string);
 
+const char *vortex_ffi_version();
+
 }  // extern "C"
```

**File**: `contrib/vortex-cmake/src/lib.rs` (modified, +5/-0)
```diff
@@ -1635,6 +1635,11 @@ pub unsafe extern "C" fn vortex_ffi_free_string(string: *mut c_char) {
     }
 }
 
+#[no_mangle]
+pub extern "C" fn vortex_ffi_version() -> *const c_char {
+    concat!(env!("VORTEX_CRATE_VERSION"), "\0").as_ptr().cast()
+}
+
 #[cfg(test)]
 mod tests {
     use super::*;
```

**File**: `src/Storages/System/CMakeLists.txt` (modified, +4/-0)
```diff
@@ -93,3 +93,7 @@ if (TARGET ch_contrib::icu)
     target_link_libraries(clickhouse_storages_system PRIVATE ch_contrib::icu)
     target_compile_definitions(clickhouse_storages_system PRIVATE U_HIDE_DEPRECATED_API)
 endif()
+
+if (TARGET ch_rust::vortex)
+    target_include_directories(clickhouse_storages_system PRIVATE $<TARGET_PROPERTY:ch_rust::vortex,INTERFACE_INCLUDE_DIRECTORIES>)
+endif()
```

**File**: `src/Storages/System/StorageSystemBuildOptions.cpp` (modified, +11/-0)
```diff
@@ -5,6 +5,12 @@
 #include <DataTypes/DataTypeString.h>
 #include <Core/Settings.h>
 
+#include "config.h"
+
+#if USE_VORTEX
+#include <vortex_ffi.h>
+#endif
+
 extern const char * auto_config_build[];
 
 namespace DB
@@ -26,6 +32,11 @@ void StorageSystemBuildOptions::fillData(MutableColumns & res_columns, ContextPt
         res_columns[0]->insert(it[0]);
         res_columns[1]->insert(it[1]);
     }
+
+#if USE_VORTEX
+    res_columns[0]->insert("VORTEX_VERSION");
+    res_columns[1]->insert(vortex_ffi_version());
+#endif
 }
 
 }
```

**File**: `src/Storages/System/StorageSystemBuildOptions.cpp.in` (modified, +1/-0)
```diff
@@ -72,6 +72,7 @@ const char * auto_config_build[]
     "USE_ORC", "@USE_ORC@",
     "USE_MSGPACK", "@USE_MSGPACK@",
     "USE_DELTA_KERNEL_RS", "@USE_DELTA_KERNEL_RS@",
+    "USE_VORTEX", "@USE_VORTEX@",
     "USE_XRAY", "@USE_XRAY@",
     "USE_WASMTIME", "@USE_WASMTIME@",
     "WITH_COVERAGE", "@WITH_COVERAGE@",
```

#### Recent Merged Pull Requests:
- **PR #134198** (2026-11-24): Cherry pick #116550 to 26.10: Apply `SORT + LIMIT` before `ARRAY JOIN` (@robot-clickhouse)
- **PR #134168** (2026-11-24): Backport #133420 to 26.10: Require `READ` and `WRITE ON FILE` to create a table as `filesystem(...)` (@robot-clickhouse)
- **PR #134167** (2026-11-24): Backport #133420 to 26.9: Require `READ` and `WRITE ON FILE` to create a table as `filesystem(...)` (@robot-clickhouse)
- **PR #134163** (closed): Do not read the manifests again when `expireSnapshots` retries after a commit conflict (@scanhex12)
- **PR #134151** (2026-11-24): Backport #129544 to 26.10: Skip the probe plan when a correlated subquery rules out parallel replicas (@robot-ch-test-poll2)
- **PR #134149** (closed): Backport #133724 to 26.11: Bound the source before reading the encryption header (@robot-ch-test-poll2)

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

## X. Empirical Invariant Guard in IMergeTreeDataPart.cpp

**RULE**:
When implementing operations in `src/Storages/MergeTree/IMergeTreeDataPart.cpp`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in ClickHouse/ClickHouse. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `8a27da1e`: . Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing C++ data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/Storages/MergeTree/IMergeTreeDataPart.cpp`.

**VERIFIED IMPLEMENTATION PATTERN**:
```c++
// Verified production-grade fix pattern:
        return static_cast<UInt64>(UInt128(bytes_on_disk) * existing_rows_count.value() / rows_count);
```

**NEGATIVE CONSTRAINT**:
```c++
// Induced defect failure mode:
        return bytes_on_disk * existing_rows_count.value() / rows_count;
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `8a27da1e` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.

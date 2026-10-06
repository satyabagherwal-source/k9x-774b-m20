# Forensic Learning Record (Deep Inspection): ytsaurus/ytsaurus

> **Canonical Artifact**: `07_PROJECT_LEARNING/ytsaurus-ytsaurus-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/ytsaurus/ytsaurus](https://github.com/ytsaurus/ytsaurus))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:22:56.929Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `ytsaurus/ytsaurus`
- **Description**: YTsaurus is a scalable and fault-tolerant open-source big data platform.
- **Primary Language / Ecosystem**: C++
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 2213 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `contrib/clickhouse/base/poco/Crypto/include/DBPoco/Crypto/DigestEngine.h`
```
//
// DigestEngine.h
//
// Library: Crypto
// Package: Digest
// Module:  DigestEngine
//
// Definition of the DigestEngine class.
//
// Copyright (c) 2012, Applied Informatics Software Engineering GmbH.
// and Contributors.
//
// SPDX-License-Identifier:	BSL-1.0
//


#ifndef DB_Crypto_DigestEngine_INCLUDED
#define DB_Crypto_DigestEngine_INCLUDED


#include <openssl/evp.h>
#include "DBPoco/Crypto/Crypto.h"
#include "DBPoco/Crypto/OpenSSLInitializer.h"
#include "DBPoco/DigestEngine.h"


namespace DBPoco
{
namespace Crypto
{


    class Crypto_API DigestEngine : public DBPoco::DigestEngine
    /// This class implements a DBPoco::DigestEngine for all
    /// digest algorithms supported by OpenSSL.
    {
    public:
        DigestEngine(const std::string & name);
        /// Creates a DigestEngine using the digest with the given name
        /// (e.g., "MD5", "SHA1", "SHA256", "SHA512", etc.).
        /// See the OpenSSL documentation for a list of supported digest algorithms.
        ///
        /// Throws a DBPoco::NotFoundException if no algorithm with the given name exists.

        ~DigestEngine();
        /// Destroys the DigestEngine.

        const std::string & algorithm() const;
        /// Returns the name of the digest algorithm.

        int nid() const;
        /// Returns the NID (OpenSSL object identifier) of the digest algorithm.

        // DigestEngine
        std::size_t digestLength() const;
        void reset();
        const DBPoco::DigestEngine::Digest & digest();

    protected:
        void updateImpl(const void * data, std::size_t length);

    private:
        std::string _name;
        EVP_MD_CTX * _pContext;
        DBPoco::DigestEngine::Digest _digest;
        OpenSSLInitializer _openSSLInitializer;
    };


    //
    // inlines
    //
    inline const std::string & DigestEngine::algorithm() const
    {
        return _name;
    }


}
} // namespace DBPoco::Crypto


#endif // DB_Crypto_DigestEngine_INCLUDED

```

### Core Architecture Module: `contrib/clickhouse/base/poco/Crypto/include/DBPoco/Crypto/ECDSADigestEngine.h`
```
//
// ECDSADigestEngine.h
//
//
// Library: Crypto
// Package: ECDSA
// Module:  ECDSADigestEngine
//
// Definition of the ECDSADigestEngine class.
//
// Copyright (c) 2008, Applied Informatics Software Engineering GmbH.
// and Contributors.
//
// SPDX-License-Identifier:	BSL-1.0
//


#ifndef DB_Crypto_ECDSADigestEngine_INCLUDED
#define DB_Crypto_ECDSADigestEngine_INCLUDED


#include <istream>
#include <ostream>
#include "DBPoco/Crypto/Crypto.h"
#include "DBPoco/Crypto/DigestEngine.h"
#include "DBPoco/Crypto/ECKey.h"
#include "DBPoco/DigestEngine.h"


namespace DBPoco
{
namespace Crypto
{


    class Crypto_API ECDSADigestEngine : public DBPoco::DigestEngine
    /// This class implements a DBPoco::DigestEngine that can be
    /// used to compute a secure digital signature.
    ///
    /// First another DBPoco::Crypto::DigestEngine is created and
    /// used to compute a cryptographic hash of the data to be
    /// signed. Then, the hash value is encrypted, using
    /// the ECDSA private key.
    ///
    /// To verify a signature, pass it to the verify()
    /// member function. It will decrypt the signature
    /// using the ECDSA public key and compare the resulting
    /// hash with the actual hash of the data.
    {
    public:
        ECDSADigestEngine(const ECKey & key, const std::string & name);
        /// Creates the ECDSADigestEngine with the given ECDSA key,
        /// using the hash algorithm with the given name
        /// (e.g., "SHA1", "SHA256", "SHA512", etc.).
        /// See the OpenSSL documentation for a list of supported digest algorithms.
        ///
        /// Throws a DBPoco::NotFoundException if no algorithm with the given name exists.

        ~ECDSADigestEngine();
        /// Destroys the ECDSADigestEngine.

        std::size_t digestLength() const;
        /// Returns the length of the digest in bytes.

        void reset();
        /// Resets the engine so that a new
        /// digest can be computed.

        const DigestEngine::Digest & digest();
        /// Finishes the computation of the digest
        /// (the first time it's called) and
        /// returns the message digest.
        ///
        /// Can be called multiple times.

        const DigestEngine::Digest & signature();
        /// Signs the digest using the ECDSADSA algorithm
        /// and the private key (the first time it's
        /// called) and returns the result.
        ///
        /// Can be called multiple times.

        bool verify(const DigestEngine::Digest & signature);
        /// Verifies the data against the signature.
        ///
        /// Returns true if the signature can be verified, false otherwise.

    protected:
        void updateImpl(const void * data, std::size_t length);

    private:
        ECKey _key;
        DBPoco::Crypto::DigestEngine _engine;
        DBPoco::DigestEngine::Digest _digest;
        DBPoco::DigestEngine::Digest _signature;
    };


}
} // namespace DBPoco::Crypto


#endif // DB_Crypto_ECDSADigestEngine_INCLUDED

```

### Core Architecture Module: `contrib/clickhouse/base/poco/Crypto/include/DBPoco/Crypto/RSADigestEngine.h`
```
//
// RSADigestEngine.h
//
// Library: Crypto
// Package: RSA
// Module:  RSADigestEngine
//
// Definition of the RSADigestEngine class.
//
// Copyright (c) 2008, Applied Informatics Software Engineering GmbH.
// and Contributors.
//
// SPDX-License-Identifier:	BSL-1.0
//


#ifndef DB_Crypto_RSADigestEngine_INCLUDED
#define DB_Crypto_RSADigestEngine_INCLUDED


#include <istream>
#include <ostream>
#include "DBPoco/Crypto/Crypto.h"
#include "DBPoco/Crypto/DigestEngine.h"
#include "DBPoco/Crypto/RSAKey.h"
#include "DBPoco/DigestEngine.h"


namespace DBPoco
{
namespace Crypto
{


    class Crypto_API RSADigestEngine : public DBPoco::DigestEngine
    /// This class implements a DBPoco::DigestEngine that can be
    /// used to compute a secure digital signature.
    ///
    /// First another DBPoco::Crypto::DigestEngine is created and
    /// used to compute a cryptographic hash of the data to be
    /// signed. Then, the hash value is encrypted, using
    /// the RSA private key.
    ///
    /// To verify a signature, pass it to the verify()
    /// member function. It will decrypt the signature
    /// using the RSA public key and compare the resulting
    /// hash with the actual hash of the data.
    {
    public:
        enum DigestType
        {
            DIGEST_MD5,
            DIGEST_SHA1
        };

        //@ deprecated
        RSADigestEngine(const RSAKey & key, DigestType digestType = DIGEST_SHA1);
        /// Creates the RSADigestEngine with the given RSA key,
        /// using the MD5 or SHA-1 hash algorithm.
        /// Kept for backward compatibility

        RSADigestEngine(const RSAKey & key, const std::string & name);
        /// Creates the RSADigestEngine with the given RSA key,
        /// using the hash algorithm with the given name
        /// (e.g., "MD5", "SHA1", "SHA256", "SHA512", etc.).
        /// See the OpenSSL documentation for a list of supported digest algorithms.
        ///
        /// Throws a DBPoco::NotFoundException if no algorithm with the given name exists.

        ~RSADigestEngine();
        /// Destroys the RSADigestEngine.

        std::size_t digestLength() const;
        /// Returns the length of the digest in bytes.

        void reset();
        /// Resets the engine so that a new
        /// digest can be computed.

        const DigestEngine::Digest & digest();
        /// Finishes the computation of the digest
        /// (the first time it's called) and
        /// returns the message digest.
        ///
        /// Can be called multiple times.

        const DigestEngine::Digest & signature();
        /// Signs the digest using the RSA algorithm
        /// and the private key (the first time it's
        /// called) and returns the result.
        ///
        /// Can be called multiple times.

        bool verify(const DigestEngine::Digest & signature);
        /// Verifies the data against the signature.
        ///
        /// Returns true if the signature can be verified, false otherwise.

    protected:
        void updateImpl(const void * data, std::size_t length);

    private:
        RSAKey _key;
        DBPoco::Crypto::DigestEngine _engine;
        DBPoco::DigestEngine::Digest _digest;
        DBPoco::DigestEngine::Digest _signature;
    };


}
} // namespace DBPoco::Crypto


#endif // DB_Crypto_RSADigestEngine_INCLUDED

```

### Core Architecture Module: `contrib/clickhouse/base/poco/Crypto/src/DigestEngine.cpp`
```
//
// DigestEngine.cpp
//
// Library: Crypto
// Package: Digest
// Module:  DigestEngine
//
// Copyright (c) 2012, Applied Informatics Software Engineering GmbH.
// and Contributors.
//
// SPDX-License-Identifier:	BSL-1.0
//


#include "DBPoco/Crypto/DigestEngine.h"
#include "DBPoco/Exception.h"


namespace DBPoco {
namespace Crypto {


DigestEngine::DigestEngine(const std::string& name):
	_name(name),
	_pContext(EVP_MD_CTX_create())
{
	const EVP_MD* md = EVP_get_digestbyname(_name.c_str());
	if (!md) throw DBPoco::NotFoundException(_name);
	EVP_DigestInit_ex(_pContext, md, NULL);
}


DigestEngine::~DigestEngine()
{
	EVP_MD_CTX_destroy(_pContext);
}

int DigestEngine::nid() const
{
	return EVP_MD_type(EVP_MD_CTX_md(_pContext));
}

std::size_t DigestEngine::digestLength() const
{
	return EVP_MD_CTX_size(_pContext);
}


void DigestEngine::reset()
{
#if OPENSSL_VERSION_NUMBER >= 0x10100000L && !defined(LIBRESSL_VERSION_NUMBER)
	EVP_MD_CTX_free(_pContext);
	_pContext = EVP_MD_CTX_create();
#else
	EVP_MD_CTX_cleanup(_pContext);
#endif
	const EVP_MD* md = EVP_get_digestbyname(_name.c_str());
	if (!md) throw DBPoco::NotFoundException(_name);
	EVP_DigestInit_ex(_pContext, md, NULL);
}


const DBPoco::DigestEngine::Digest& DigestEngine::digest()
{
	_digest.clear();
	unsigned len = EVP_MD_CTX_size(_pContext);
	_digest.resize(len);
	EVP_DigestFinal_ex(_pContext, &_digest[0], &len);
	reset();
	return _digest;
}


void DigestEngine::updateImpl(const void* data, std::size_t length)
{
	EVP_DigestUpdate(_pContext, data, length);
}


} } // namespace DBPoco::Crypto

```

### Core Architecture Module: `contrib/clickhouse/base/poco/Crypto/src/ECDSADigestEngine.cpp`
```
//
// ECDSADigestEngine.cpp
//
//
// Library: Crypto
// Package: ECDSA
// Module:  ECDSADigestEngine
//
// Copyright (c) 2008, Applied Informatics Software Engineering GmbH.
// and Contributors.
//
// SPDX-License-Identifier:	BSL-1.0
//


#include "DBPoco/Crypto/ECDSADigestEngine.h"
#include <openssl/ecdsa.h>


namespace DBPoco {
namespace Crypto {


ECDSADigestEngine::ECDSADigestEngine(const ECKey& key, const std::string &name):
	_key(key),
	_engine(name)
{
}


ECDSADigestEngine::~ECDSADigestEngine()
{
}


std::size_t ECDSADigestEngine::digestLength() const
{
	return _engine.digestLength();
}


void ECDSADigestEngine::reset()
{
	_engine.reset();
	_digest.clear();
	_signature.clear();
}

	
const DigestEngine::Digest& ECDSADigestEngine::digest()
{
	if (_digest.empty())
	{
		_digest = _engine.digest();
	}
	return _digest;
}


const DigestEngine::Digest& ECDSADigestEngine::signature()
{
	if (_signature.empty())
	{
		digest();
		_signature.resize(_key.size());
		unsigned sigLen = static_cast<unsigned>(_signature.size());
		if (!ECDSA_sign(0, &_digest[0], static_cast<unsigned>(_digest.size()),
			&_signature[0], &sigLen, _key.impl()->getECKey()))
		{
			throw OpenSSLException();
		}
		if (sigLen < _signature.size()) _signature.resize(sigLen);
	}
	return _signature;
}


bool ECDSADigestEngine::verify(const DigestEngine::Digest& sig)
{
	digest();
	EC_KEY* pKey = _key.impl()->getECKey();
	if (pKey)
	{
		int ret = ECDSA_verify(0, &_digest[0], static_cast<unsigned>(_digest.size()),
			&sig[0], static_cast<unsigned>(sig.size()),
			pKey);
		if (1 == ret) return true;
		else if (0 == ret) return false;
	}
	throw OpenSSLException();
}


void ECDSADigestEngine::updateImpl(const void* data, std::size_t length)
{
	_engine.update(data, length);
}


} } // namespace DBPoco::Crypto

```

### Core Architecture Module: `contrib/clickhouse/base/poco/Crypto/src/RSADigestEngine.cpp`
```
//
// RSADigestEngine.cpp
//
// Library: Crypto
// Package: RSA
// Module:  RSADigestEngine
//
// Copyright (c) 2008, Applied Informatics Software Engineering GmbH.
// and Contributors.
//
// SPDX-License-Identifier:	BSL-1.0
//


#include "DBPoco/Crypto/RSADigestEngine.h"
#include <openssl/rsa.h>


namespace DBPoco {
namespace Crypto {


RSADigestEngine::RSADigestEngine(const RSAKey& key, DigestType digestType):
	_key(key),
	_engine(digestType == DIGEST_MD5 ? "MD5" : "SHA1")
{
}

RSADigestEngine::RSADigestEngine(const RSAKey& key, const std::string &name):
	_key(key),
	_engine(name)
{
}


RSADigestEngine::~RSADigestEngine()
{
}


std::size_t RSADigestEngine::digestLength() const
{
	return _engine.digestLength();
}


void RSADigestEngine::reset()
{
	_engine.reset();
	_digest.clear();
	_signature.clear();
}

	
const DigestEngine::Digest& RSADigestEngine::digest()
{
	if (_digest.empty())
	{
		_digest = _engine.digest();
	}
	return _digest;
}


const DigestEngine::Digest& RSADigestEngine::signature()
{
	if (_signature.empty())
	{
		digest();
		_signature.resize(_key.size());
		unsigned sigLen = static_cast<unsigned>(_signature.size());
		RSA_sign(_engine.nid(), &_digest[0], static_cast<unsigned>(_digest.size()), &_signature[0], &sigLen, _key.impl()->getRSA());
		// truncate _sig to sigLen
		if (sigLen < _signature.size())
			_signature.resize(sigLen);
	}
    return _signature;
}

	
bool RSADigestEngine::verify(const DigestEngine::Digest& sig)
{
	digest();
	DigestEngine::Digest sigCpy = sig; // copy becausse RSA_verify can modify sigCpy
	int ret = RSA_verify(_engine.nid(), &_digest[0], static_cast<unsigned>(_digest.size()), &sigCpy[0], static_cast<unsigned>(sigCpy.size()), _key.impl()->getRSA());
	return ret != 0;
}


void RSADigestEngine::updateImpl(const void* data, std::size_t length)
{
	_engine.update(data, length);
}


} } // namespace DBPoco::Crypto

```

### Core Architecture Module: `contrib/clickhouse/base/poco/Foundation/include/DBPoco/DigestEngine.h`
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


#ifndef DB_Foundation_DigestEngine_INCLUDED
#define DB_Foundation_DigestEngine_INCLUDED


#include <vector>
#include "DBPoco/Foundation.h"


namespace DBPoco
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


} // namespace DBPoco


#endif // DB_Foundation_DigestEngine_INCLUDED

```

### Core Architecture Module: `contrib/clickhouse/base/poco/Foundation/include/DBPoco/HMACEngine.h`
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


#ifndef DB_Foundation_HMACEngine_INCLUDED
#define DB_Foundation_HMACEngine_INCLUDED


#include <cstring>
#include "DBPoco/DigestEngine.h"
#include "DBPoco/Foundation.h"


namespace DBPoco
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
        DB_poco_check_ptr(passphrase);

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


} // namespace DBPoco


#endif // DB_Foundation_HMACEngine_INCLUDED

```

### Core Architecture Module: `contrib/clickhouse/base/poco/Foundation/include/DBPoco/MD5Engine.h`
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


#ifndef DB_Foundation_MD5Engine_INCLUDED
#define DB_Foundation_MD5Engine_INCLUDED


#include "DBPoco/DigestEngine.h"
#include "DBPoco/Foundation.h"


namespace DBPoco
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


} // namespace DBPoco


#endif // DB_Foundation_MD5Engine_INCLUDED

```

### Core Architecture Module: `contrib/clickhouse/base/poco/Foundation/include/DBPoco/NotificationQueue.h`
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


#ifndef DB_Foundation_NotificationQueue_INCLUDED
#define DB_Foundation_NotificationQueue_INCLUDED


#include <deque>
#include "DBPoco/Event.h"
#include "DBPoco/Foundation.h"
#include "DBPoco/Mutex.h"
#include "DBPoco/Notification.h"


namespace DBPoco
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

    bool hasIdleThreads() const;
    /// Returns true if the queue has at least one thread waiting
    /// for a notification.

    static NotificationQueue & defaultQueue();
    /// Returns a reference to the default
    /// NotificationQueue.

protected:
    Notification::Ptr dequeueOne();

private:
    typedef std::deque<Notification::Ptr> NfQueue;
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


} // namespace DBPoco


#endif // DB_Foundation_NotificationQueue_INCLUDED

```

### Core Architecture Module: `contrib/clickhouse/base/poco/Foundation/include/DBPoco/PriorityNotificationQueue.h`
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


#ifndef DB_Foundation_PriorityNotificationQueue_INCLUDED
#define DB_Foundation_PriorityNotificationQueue_INCLUDED


#include <deque>
#include <map>
#include "DBPoco/Event.h"
#include "DBPoco/Foundation.h"
#include "DBPoco/Mutex.h"
#include "DBPoco/Notification.h"


namespace DBPoco
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


} // namespace DBPoco


#endif // DB_Foundation_PriorityNotificationQueue_INCLUDED

```

### Core Architecture Module: `contrib/clickhouse/base/poco/Foundation/include/DBPoco/SHA1Engine.h`
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


#ifndef DB_Foundation_SHA1Engine_INCLUDED
#define DB_Foundation_SHA1Engine_INCLUDED


#include "DBPoco/DigestEngine.h"
#include "DBPoco/Foundation.h"


namespace DBPoco
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


} // namespace DBPoco


#endif // DB_Foundation_SHA1Engine_INCLUDED

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1769** (2026-07-08): **YQL query cache for remote mr-operations doesn't work.**
  *Symptoms*: If you run yql's cross-cluster query and then immediately re-run it without changing the source tables, local mr-operations will be taken from the cache but remote ones will be executed again.
  **Post-Mortem & Fix Analysis**:
  > Hi! Can you provide any query example that reproduces this problem?
  > The query from tutorial but with second table from the remote cluster: ``` -- This example demonstrates working with tables from multiple clusters in a single query. -- All you need to do is specify the cluster name before the dot and the table: cluster.`//path/to/table` -- Below tables from different clusters are joined. SELECT     Max_by(p.price, p.date) as last_price    ,n.name FROM dirac.`//home/tutorial/price` p JOIN (         SELECT             id, name         FROM tundra.`//home/tutorial/nomenclature`     ) n on n.id = p.nomenclature_id GROUP BY n.name ORDER BY n.name; ``` Executed twice without any changes in SQL or tables, and the remote YtMap recalculated without using the cache.  <img width="3233" height="1735" alt="Image" src="https://github.com/user-attachments/assets/6519bb8a-261e-462a-a2d9-2d963e2b270e" />    
  > I was unable to reproduce the problem In provided example - query cache is not used because nomenclature from the tutorial is a dynamic table, so this does not seem to be related to cross-cluster mode

- **Issue #1766** (2026-07-09): **Security issue: YTsaurus client leaks token in exception trace**
  *Symptoms*: # Description  YTsaurus client leaks the authorization token into the exception trace if an error occurs.  # Reproduce  Execute this short script: ```py from yt import wrapper as yt  yt_client = yt.YtClient(     token="REAL_YTSAURUS_TOKEN",     proxy="PROXY", )  print(yt_client.get_user_name("LEAKING_TOKEN")) ```  If the token provided in `get_user_name`'s argument is correct, nothing is leaked. If it's incorrect, a long exception shall appear: ``` ... ***** Details: Your request 81365c69-da1a4427-17bafca0-ae6fe7aa has failed to authenticate at None. Make sure that you have provided an OAuth token with the request. In case you do not have a valid token, please refer to  for obtaining one. If the error persists and system keeps rejecting your token, please kindly submit a request to https://ytsaurus.tech/#contact         origin          dev0.nebius.yt on 2026-06-26T15:54:02.685687Z Received HTTP response with error         origin          dev0.nebius.yt on 2026-06-26T15:54:02.685566Z         url             http://tundra.yt.nebius.yt/auth/whoami         request_headers {                       "Authorization": "OAuth LEAKING_TOKEN", <<<<<<<<<<<<<<<<<<<<<<<<<                       "X-YT-Correlation-Id": "341bba3f-bc16a0a0-27686208-4d5b2505"                     }         response_headers {                       "Date": "Fri, 26 Jun 2026 15:54:02 GMT", ... ```  # Reason  I believe there's a bug in the current version of the client: [this line](https://github.com/ytsaurus/ytsaurus/
  **Post-Mortem & Fix Analysis**:
  > Fix is on the way
  > Fixed in 6f9fde83692386df25e285223ff0d625c1a0e040

- **Issue #1750** (2026-07-09): **YT CLI shell competion does not work paths if YT_PREFIX is set**
  *Symptoms*: https://ytsaurus.tech/docs/en/api/cli/install#autocompletion  ``` export YT_PREFIX=//home/${USER}/ yt list <TAB> yt list //home/{USER}/<TAB> ```
  **Post-Mortem & Fix Analysis**:
  > Fixed in 1ca058a74d91dc21991d6d125f629f6c5609f60f

- **Issue #1692** (2026-05-13): **yt/yt/core/http: throw TransportError at reusing stale connection**
  *Symptoms*: Root Cause: A classic race condition in yt/yt/core/http/connection_pool.cpp. When the client extracts a connection from the pool:  TConnectionPool::Connect() calls CheckPooledConnection() → IsValid() → Connection->IsIdle() IsIdle() checks !PeerDisconnectedList_.IsFired() — but this is asynchronous and depends on the poller detecting the peer's TCP FIN. There's a window where the server has already sent FIN to close the connection, but the poller hasn't processed it yet. The connection appears valid, but when the client writes the request and tries to read the response, it gets immediate EOF.  This triggers: "Connection was closed before the first byte of HTTP message".  Proper fix should be retrying request using different connection when connection was taken from the pool and requires is safe to retry. For example this logic is implemented inside golang http client.  Here we could simply throw error code NRpc::EErrorCode::TransportError. And as a result request will be retried by high-level retrying logic in yt/cpp/mapreduce/common/retry_lib.cpp  Link: https://github.com/ytsaurus/ytsaurus/issues/1691 Signed-off-by: Konstantin Khlebnikov <khlebnikov@nebius.com>  ---  * Changelog entry Type: fix Component: cpp-sdk  Handle error and retry request if HTTP(s) connection picked from pool is stale. 
  **Post-Mortem & Fix Analysis**:
  > `16.04.2026, 15:20:43` PR autocheck started. Watch workflow progress [here](https://github.com/ytsaurus/ytsaurus/actions/runs/24518551049). `16.04.2026, 15:22:30` PR autocheck finished. Statuses: Strawberry controller: skipped CMake build: skipped Ya-make build: skipped Tests: skipped 
  > `16.04.2026, 15:24:20` PR autocheck started. Watch workflow progress [here](https://github.com/ytsaurus/ytsaurus/actions/runs/24518621598). `16.04.2026, 15:33:55` PR autocheck finished. Statuses: Strawberry controller: failure CMake build: skipped Ya-make build: failure Tests: skipped 
  > @dim-an any news?

- **Issue #1625** (2026-03-04): **Go SDK RevokeToken must provide revoke by token hash**
  *Symptoms*: https://github.com/ytsaurus/ytsaurus/blob/9b3ffc81f9df2c8ab8f689393a0310c527e62697/yt/go/yt/internal/encoder.go#L305  Otherwise it is impossible to revoke tokens from ListUserTokens result  This method needs second argument for token hash, i.e. allow caller specify token itself or hash.
  **Post-Mortem & Fix Analysis**:
  > Hello, there are the TokenIsHash and PasswordIsHash options in [RevokeTokenOptions](https://github.com/ytsaurus/ytsaurus/blob/main/yt/go/yt/interface.go#L877).

- **Issue #1622** (2026-04-09): **Python CLI/SDK: debug logs spamming with tracebacks.**
  *Symptoms*: Running a simple `list /` produces "bad" logs ``` YT_LOG_LEVEL=debug yt list / --- Logging error --- Traceback (most recent call last):   File "/opt/homebrew/lib/python3.14/site-packages/yt/logger.py", line 68, in emit     msg = self._colorize(msg)   File "/opt/homebrew/lib/python3.14/site-packages/yt/logger.py", line 57, in _colorize     msg = self.RE_KW(msg) TypeError: SimpleColorizedStreamHandler.<lambda>() takes 3 positional arguments but 4 were given Call stack:   File "/opt/homebrew/bin/yt", line 7, in <module>     sys.exit(main())   File "/opt/homebrew/lib/python3.14/site-packages/yt/cli/yt_binary.py", line 3315, in main     run_main(main_func)   File "/opt/homebrew/lib/python3.14/site-packages/yt/wrapper/cli_helpers.py", line 70, in run_main     main_func()   File "/opt/homebrew/lib/python3.14/site-packages/yt/cli/yt_binary.py", line 3304, in main_func     args.func(**func_args)   File "/opt/homebrew/lib/python3.14/site-packages/yt/cli/yt_binary.py", line 363, in list     list = yt.list(**list_args)   File "/opt/homebrew/lib/python3.14/site-packages/yt/wrapper/cypress_commands.py", line 462, in list     result = make_formatted_request(   File "/opt/homebrew/lib/python3.14/site-packages/yt/wrapper/driver.py", line 190, in make_formatted_request     result = make_request(command_name, params,   File "/opt/homebrew/lib/python3.14/site-packages/yt/wrapper/driver.py", line 125, in make_request     result = http_driver.make_request(   File "<decorator-gen-3>", line 2, in ma
  **Post-Mortem & Fix Analysis**:
  > This bug occurs in python 3.14+ (functools.partial becomes a method descriptor) As workaround you can use `YT_LOG_LEVEL=Debug` (case sensitive) or downgrade python. (Fx is on the way) 
  > Fixed - 93d89672ca44353644e68bed805cc9c9613d3eae

- **Issue #1572** (2026-02-16): **yt/server/http_proxy: hide content at creating document**
  *Symptoms*: Initial document content is passed as attribute "value", which should not be logged.  It seems RPC proxy is not affected.  Signed-off-by: Konstantin Khlebnikov <khlebnikov@tracto.ai>  ---  * Changelog entry Type: bug Component: http-proxy  Do not log initial document content. 
  **Post-Mortem & Fix Analysis**:
  > `21.01.2026, 09:58:32` PR autocheck started. Watch workflow progress [here](https://github.com/ytsaurus/ytsaurus/actions/runs/21205125020). `21.01.2026, 10:03:24` PR autocheck finished. Statuses: Strawberry controller: cancelled CMake build: skipped Ya-make build: cancelled Tests: skipped 
  > `21.01.2026, 10:05:04` PR autocheck started. Watch workflow progress [here](https://github.com/ytsaurus/ytsaurus/actions/runs/21205281778). `21.01.2026, 14:51:14` Integration tests are started. `21.01.2026, 15:41:18` Tests finished. #### Total | Total | Failed | Ok | Skipped | Not launched | |-------|--------|----|---------|--------------| | 2783 | 18 | 2539 | 226 | 0 | #### [ci-viewer/21205281778/size_s](https://storage.yandexcloud.net/files.ytsaurus.tech/ci-viewer/21205281778/size_s/index.html) (returncode 10) | Total | Failed | Ok | Skipped | Not launched | |-------|--------|----|---------|--------------| | 2783 | 18 | 2539 | 226 | 0 | ### [Failed suites](http://ci-viewer.dev.ytsaurus.tech/build/21205281778)  `21.01.2026, 15:41:28` PR autocheck finished. Statuses: Strawberry controller: success CMake build: success Ya-make build: success Tests: success 
  > `08.02.2026, 17:19:26` PR autocheck started. Watch workflow progress [here](https://github.com/ytsaurus/ytsaurus/actions/runs/21802162938). `08.02.2026, 21:11:28` Integration tests are started. `08.02.2026, 22:25:47` Tests finished. #### Total | Total | Failed | Ok | Skipped | Not launched | |-------|--------|----|---------|--------------| | 2869 | 9 | 2604 | 256 | 0 | #### [ci-viewer/21802162938/size_s](https://storage.yandexcloud.net/files.ytsaurus.tech/ci-viewer/21802162938/size_s/index.html) (returncode 10) | Total | Failed | Ok | Skipped | Not launched | |-------|--------|----|---------|--------------| | 2869 | 9 | 2604 | 256 | 0 | ### [Failed suites](http://ci-viewer.dev.ytsaurus.tech/build/21802162938)  `08.02.2026, 22:25:57` PR autocheck finished. Statuses: Strawberry controller: success CMake build: success Ya-make build: success Tests: success 

- **Issue #1542** (2025-12-16): **yt/chyt/controller: handle https schema yt http proxy url**
  *Symptoms*: Use for logging normalized address generated by go sdk yt config.  Signed-off-by: Konstantin Khlebnikov <khlebnikov@tracto.ai>  ---  * Changelog entry Type: fix Component: strawberry  Fix logging for https cluster proxy urls. 
  **Post-Mortem & Fix Analysis**:
  > `15.12.2025, 16:32:32` PR autocheck started. Watch workflow progress [here](https://github.com/ytsaurus/ytsaurus/actions/runs/20239755633). `15.12.2025, 16:33:14` PR autocheck finished. Statuses: Strawberry controller: skipped CMake build: skipped Ya-make build: skipped Tests: skipped 
  > `15.12.2025, 16:33:47` PR autocheck started. Watch workflow progress [here](https://github.com/ytsaurus/ytsaurus/actions/runs/20239781834). `15.12.2025, 19:38:52` Integration tests are started. `15.12.2025, 20:30:58` Tests finished. #### Total | Total | Failed | Ok | Skipped | Not launched | |-------|--------|----|---------|--------------| | 2763 | 3 | 2539 | 221 | 0 | #### [ci-viewer/20239781834/size_s](https://storage.yandexcloud.net/files.ytsaurus.tech/ci-viewer/20239781834/size_s/index.html) (returncode 10) | Total | Failed | Ok | Skipped | Not launched | |-------|--------|----|---------|--------------| | 2763 | 3 | 2539 | 221 | 0 | ### [Failed suites](http://ci-viewer.dev.ytsaurus.tech/build/20239781834)  `15.12.2025, 20:34:11` PR autocheck finished. Statuses: Strawberry controller: success CMake build: success Ya-make build: success Tests: success 
  > @buyval01 has imported your pull request. If you are a member of YTsaurus team, you can view [this diff](https://ytsaurus.tech/internal/QHBuqgUq7PyVom).

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

### Incident Patch 1: `b68aa240` (2026-10-05)
**Commit Message**: Fix grammar
commit_hash:3f5a049e6a9fcf82e974015593ad70d84fcf0a5a

**File**: `util/system/sem.h` (modified, +3/-3)
```diff
@@ -4,7 +4,7 @@
 
 #include <util/generic/ptr.h>
 
-// named sempahore
+// named semaphore
 class TSemaphore {
 public:
     TSemaphore(const char* name, ui32 maxFreeCount);
@@ -13,7 +13,7 @@ class TSemaphore {
     // Increase the semaphore counter.
     void Release() noexcept;
 
-    // Keep a thread held while the semaphore counter is equal 0.
+    // Keep a thread held while the semaphore counter is equal to 0.
     void Acquire() noexcept;
 
     // Try to enter the semaphore gate. A non-blocking variant of Acquire.
@@ -25,7 +25,7 @@ class TSemaphore {
     THolder<TImpl> Impl_;
 };
 
-// unnamed semaphore, faster, than previous
+// unnamed semaphore, faster than previous
 class TFastSemaphore {
 public:
     TFastSemaphore(ui32 maxFreeCount);
```

---

### Incident Patch 2: `e2cd2232` (2026-10-05)
**Commit Message**: Support Clang 22 profile runtime in coverage builds

Add Clang 22 to the profile-runtime version whitelist. Without it, Clang 22 coverage builds fail with "No clang runtime profile library found in command arguments" when copying the runtime library.
commit_hash:befd53419abdcbb2bdbe39df982adc1a60e5444c

**File**: `build/scripts/copy_clang_profile_rt.py` (modified, +1/-1)
```diff
@@ -9,7 +9,7 @@
 
 # List is a temporary thing to ensure that nothing breaks before and after switching to newer clang
 # Remove after DTCC-1902
-CLANG_RT_VERSIONS = [16, 18, 20, 21]
+CLANG_RT_VERSIONS = [16, 18, 20, 21, 22]
 
 
 def copy_clang_rt_profile(cmd, build_root, arch):
```

---

### Incident Patch 3: `d944eb95` (2026-10-05)
**Commit Message**: YTFLOW: Fix Kafka sink refusing to restart before its first commit
commit_hash:c8c3cbc89509224e6a89e3356540a115c5ae61ba

**File**: `yt/yt/flow/extensions/kafka/sink.cpp` (modified, +23/-5)
```diff
@@ -610,8 +610,12 @@ TFuture<void> TKafkaSink::DoDistribute(const TOutputMessageConstPtr& message, i6
     if (TransactionalWriter_) {
         // The recovery check relies on it: a message reaches the writer only after an epoch persisting a
         // bound that covers it commits.
-        YT_VERIFY(seqNo <= MaxDistributedSeqNo_);
-        return TransactionalWriter_->Write(MakeRecord(message, seqNo));
+        if (seqNo <= MaxDistributedSeqNo_) {
+            return TransactionalWriter_->Write(MakeRecord(message, seqNo));
+        }
+        // Released by #Commit().
+        auto& withheld = WithheldWrites_.emplace_back(MakeRecord(message, seqNo), NewPromise<void>());
+        return withheld.Promise.ToFuture();
     }
     return Write(message, seqNo);
 }
@@ -626,13 +630,27 @@ void TKafkaSink::Sync(NApi::IDynamicTableTransactionPtr transaction)
     }
     TOrderedAsyncSinkBase::Sync(std::move(transaction));
     if (TransactionalWriter_) {
-        // Everything registered so far is distributed once this epoch commits. The bound never shrinks:
-        // after a restart, an epoch may commit before the replay registers what it covers.
-        MaxDistributedSeqNo_ = std::max(MaxDistributedSeqNo_, GetLastDistributedSeqNo());
+        // Once the writer has its marker, everything registered so far is distributed when this epoch
+        // commits; a bound raised earlier would look like one whose marker is lost. The bound never
+        // shrinks: after a restart, an epoch may commit before the replay registers what it covers.
+        if (auto started = TransactionalWriter_->GetStarted().TryGet(); started && started->IsOK()) {
+            MaxDistributedSeqNo_ = std::max(MaxDistributedSeqNo_, GetLastDistributedSeqNo());
+        }
         TransactionalState_->MaxDistributedSeqNo = MaxDistributedSeqNo_;
     }
 }
 
+void TKafkaSink::Commit()
+{
+    // The bound is persisted now; the writes it covers go ahead of the newly registered ones.
+    while (!WithheldWrites_.empty() && WithheldWrites_.front().Record.SeqNo <= MaxDistributedSeqNo_) {
+        auto& withheld = WithheldWrites_.front();
+        withheld.Promise.SetFrom(TransactionalWriter_->Write(std::move(withheld.Record)));
+        WithheldWrites_.pop_front();
+    }
+    TOrderedAsyncSinkBase::Commit();
+}
+
 ////////////////////////////////////////////////////////////////////////////////
 
 TAtLeastOnceKafkaSink::TAtLeastOnceKafkaSink(
```

**File**: `yt/yt/flow/extensions/kafka/sink.h` (modified, +12/-3)
```diff
@@ -174,9 +174,8 @@ DEFINE_REFCOUNTED_TYPE(TRetryableKafkaWriter);
 struct TKafkaSinkState
     : public NYTree::TYsonStruct
 {
-    //! The seqNo of the last message any persisted epoch registered. Messages are handed to the writer
-    //! only after the epoch registering them commits, so earlier sessions may have committed messages up
-    //! to this one, but none past it.
+    //! The seqNo up to which messages may have been handed to the writer: earlier sessions may have
+    //! committed messages up to this one, but none past it.
     i64 MaxDistributedSeqNo = 0;
 
     REGISTER_YSON_STRUCT(TKafkaSinkState);
@@ -254,15 +253,25 @@ class TKafkaSink
 
     void Init(IInitContextPtr initContext) override;
     void Sync(NApi::IDynamicTableTransactionPtr transaction) override;
+    void Commit() override;
 
 private:
     using TCommonKafkaSink::Logger;
 
+    //! A message kept from the writer until a persisted bound covers it.
+    struct TWithheldWrite
+    {
+        TKafkaMessageToWrite Record;
+        TPromise<void> Promise;
+    };
+
     //! Set with #EKafkaDeliveryGuarantee::ExactlyOnce, in place of the writer of #TCommonKafkaSink.
     TTransactionalKafkaWriterPtr TransactionalWriter_;
     TMutableStateClient<TKafkaSinkState> TransactionalState_;
     //! What the last Sync recorded as #TKafkaSinkState::MaxDistributedSeqNo.
     i64 MaxDistributedSeqNo_ = 0;
+    //! The writes past #MaxDistributedSeqNo_, in seqNo order.
+    std::deque<TWithheldWrite> WithheldWrites_;
 
     void DoInit(const std::string& producerId) final;
     TFuture<void> DoDistribute(const TOutputMessageConstPtr& message, i64 seqNo) final;
```

**File**: `yt/yt/flow/extensions/kafka/transactional_writer.cpp` (modified, +87/-13)
```diff
@@ -10,7 +10,9 @@
 #include <contrib/libs/cppkafka/include/cppkafka/configuration.h>
 #include <contrib/libs/cppkafka/include/cppkafka/consumer.h>
 #include <contrib/libs/cppkafka/include/cppkafka/exceptions.h>
+#include <contrib/libs/cppkafka/include/cppkafka/metadata.h>
 #include <contrib/libs/cppkafka/include/cppkafka/producer.h>
+#include <contrib/libs/cppkafka/include/cppkafka/topic.h>
 
 #include <librdkafka/rdkafka.h>
 
@@ -169,6 +171,11 @@ void TTransactionalKafkaWriter::Terminate()
     }
 }
 
+TFuture<void> TTransactionalKafkaWriter::GetStarted() const
+{
+    return StartedFuture_;
+}
+
 TFuture<void> TTransactionalKafkaWriter::Write(TKafkaMessageToWrite&& message)
 {
     return Queue_.Enqueue(std::move(message));
@@ -185,6 +192,8 @@ void TTransactionalKafkaWriter::Fail(const TError& error)
         .With(error);
     ErrorState_->SetError(error);
     Queue_.Fail(error);
+    // A no-op unless the writer is still starting.
+    StartedPromise_.TrySet(error);
 }
 
 void TTransactionalKafkaWriter::Run()
@@ -202,20 +211,22 @@ void TTransactionalKafkaWriter::Run()
         return;
     }
 
-    auto markerOrError = Initialize(*producer);
+    std::unique_ptr<rd_kafka_consumer_group_metadata_t, decltype(&rd_kafka_consumer_group_metadata_destroy)> groupMetadata(
+        rd_kafka_consumer_group_metadata_new(Options_.TransactionalId.c_str()),
+        &rd_kafka_consumer_group_metadata_destroy);
+
+    auto markerOrError = Initialize(*producer, groupMetadata.get());
     if (!markerOrError.IsOK()) {
         if (!Terminated_.load()) {
             Fail(TError("Kafka transactional writer failed to start").With(markerOrError));
         } else {
             Queue_.Fail(markerOrError);
+            StartedPromise_.TrySet(TError(markerOrError));
         }
         return;
     }
     const auto marker = markerOrError.Value();
-
-    std::unique_ptr<rd_kafka_consumer_group_metadata_t, decltype(&rd_kafka_consumer_group_metadata_destroy)> groupMetadata(
-        rd_kafka_consumer_group_metadata_new(Options_.TransactionalId.c_str()),
-        &rd_kafka_consumer_group_metadata_destroy);
+    StartedPromise_.Set();
 
     // The records taken from the queue; those before |nextIndex| are committed.
     std::vector<TKafkaMessageToWrite> backlog;
@@ -230,7 +241,7 @@ void TTransactionalKafkaWriter::Run()
             for (auto& record : Queue_.TakePending(Options_.MaxTransactionRecordCount, Options_.MaxTransactionByteSize)) {
                 // The replay numbers messages from the persisted frontier as the earlier sessions did, so the
                 // records the marker covers are committed already.
-                if (marker && record.SeqNo <= *marker) {
+                if (record.SeqNo <= marker) {
                     Queue_.Complete(record.SeqNo, TError());
                     ++skippedCount;
                 } else {
@@ -240,7 +251,7 @@ void TTransactionalKafkaWriter::Run()
             if (skippedCount > 0) {
                 YT_TLOG_INFO("Skipping replayed messages already committed to Kafka")
                     .With("Count", skippedCount)
-                    .With("MarkerSeqNo", *marker);
+                    .With("MarkerSeqNo", marker);
             }
             if (backlog.empty()) {
                 // Waits for more records.
@@ -253,7 +264,7 @@ void TTransactionalKafkaWriter::Run()
             nextIndex,
             std::min<size_t>(batchLimit, backlog.size() - nextIndex));
         auto startTime = TInstant::Now();
-        auto result = TryCommitTransaction(*producer, groupMetadata.get(), batch);
+        auto result = TryCommitTransaction(*producer, groupMetadata.get(), batch, batch.back().SeqNo);
         if (Terminated_.load()) {
             break;
         }
@@ -298,7 +309,9 @@ void TTransactionalKafkaWriter::Run()
     Queue_.Fail(TError("Kafka writer terminated before the message was committed"));
 }
 
-TErrorOr<std::optional<i64>> TTransactionalKafkaWriter::Initialize(cppkafka::Producer& producer)
+TErrorOr<i64> TTransactionalKafkaWriter::Initialize(
+    cppkafka::Producer& producer,
+    const rd_kafka_consumer_group_metadata_t* groupMetadata)
 {
     // Fences the producers of earlier sessions with this transactional id and completes a transaction one
     // of them left open, so the marker read next is final.
@@ -340,12 +353,72 @@ TErrorOr<std::optional<i64>> TTransactionalKafkaWriter::Initialize(cppkafka::Pro
         return TError(markerOrError).With("group_id", Options_.TransactionalId);
     }
 
+    if (!marker) {
+        // The marker must exist before any message is handed over: otherwise a restart could not tell a
+        // writer that has never committed from one whose marker is lost.
+        if (auto error = CommitInitialMarker(producer, groupMetadata); !error.IsOK()) {
+            return error;
+        }
+        marker = Recovery_.MaxPersistedSeqNo;
+    }
+
     YT_TLOG_INFO("Kafka transactional writer initialized")
-        .With("MarkerSeqNo", marker
```

**File**: `yt/yt/flow/extensions/kafka/transactional_writer.h` (modified, +28/-8)
```diff
@@ -67,9 +67,10 @@ struct TTransactionalKafkaWriterOptions
 //! Writes records in Kafka transactions under a transactional id that survives restarts; starting fences
 //! the writers of earlier sessions. Each transaction also commits the seqNo of its last record as the progress
 //! marker (see #KafkaProgressMarkerMetadata), and a restarted writer acknowledges the replayed messages the
-//! marker covers without writing them. Promises resolve in seqNo order once their transaction commits. Any
-//! error the writer cannot retry within its budget fails every write for good (see #GetFatalError()); a
-//! restart then recovers from the marker.
+//! marker covers without writing them. A writer that starts without a marker commits one at the persisted
+//! frontier. Promises resolve in seqNo order once their transaction commits. Any error the writer cannot
+//! retry within its budget fails every write for good (see #GetFatalError()); a restart then recovers from
+//! the marker.
 class TTransactionalKafkaWriter
     : public TRefCounted
 {
@@ -84,6 +85,10 @@ class TTransactionalKafkaWriter
     void Start();
     void Terminate();
 
+    //! Set once the writer has fenced earlier sessions and its progress marker is in Kafka, or with the
+    //! error it failed to start with. Canceling it has no effect.
+    TFuture<void> GetStarted() const;
+
     TFuture<void> Write(TKafkaMessageToWrite&& message);
 
     //! The error the writer failed with, or OK while it works.
@@ -98,6 +103,10 @@ class TTransactionalKafkaWriter
     const NLogging::TLogger Logger;
     const IStatusErrorStatePtr ErrorState_;
 
+    const TPromise<void> StartedPromise_ = NewPromise<void>();
+    //! A waiter that cancels it would otherwise set the promise for everyone else.
+    const TFuture<void> StartedFuture_ = StartedPromise_.ToFuture().ToUncancelable();
+
     NConcurrency::TActionQueuePtr WriteQueue_;
     std::atomic<bool> Terminated_ = false;
 
@@ -106,20 +115,31 @@ class TTransactionalKafkaWriter
     void Run();
     void Fail(const TError& error);
 
-    //! Fences earlier sessions and resolves the marker; returns an error if the writer cannot start.
-    TErrorOr<std::optional<i64>> Initialize(cppkafka::Producer& producer);
+    //! Fences earlier sessions and returns the seqNo of the marker, committing one if none can be trusted;
+    //! returns an error if the writer cannot start.
+    TErrorOr<i64> Initialize(
+        cppkafka::Producer& producer,
+        const rd_kafka_consumer_group_metadata_s* groupMetadata);
     TErrorOr<std::optional<TKafkaCommittedOffset>> ReadCommittedOffset();
+    //! Commits the marker at the persisted frontier, retrying within the failure budget.
+    TError CommitInitialMarker(
+        cppkafka::Producer& producer,
+        const rd_kafka_consumer_group_metadata_s* groupMetadata);
+    //! Requests the topic metadata, which creates a missing topic where the broker allows; returns an
+    //! error while the topic is unavailable.
+    TError ResolveTopic(cppkafka::Producer& producer);
 
     //! Takes ownership of |error|, which is null on success.
     static TCallResult ClassifyTransactionError(rd_kafka_error_s* error, TStringBuf operation);
     //! Repeats |call| while it fails retriably, within the failure budget.
     TCallResult CallRetrying(const std::function<rd_kafka_error_s*()>& call, TStringBuf operation);
-    //! Writes |records| and the marker for the last of them in one transaction, aborting it on an abortable
-    //! error.
+    //! Commits |records|, possibly none, and the marker at |markerSeqNo| in one transaction, aborting it on
+    //! an abortable error.
     TCallResult TryCommitTransaction(
         cppkafka::Producer& producer,
         const rd_kafka_consumer_group_metadata_s* groupMetadata,
-        std::span<const TKafkaMessageToWrite> records);
+        std::span<const TKafkaMessageToWrite> records,
+        i64 markerSeqNo);
 };
 
 DEFINE_REFCOUNTED_TYPE(TTransactionalKafkaWriter);
```

---

### Incident Patch 4: `b10746ad` (2026-10-05)
**Commit Message**: YT-29806 Fix shared-write prepare timestamp recalculation

Use the timestamp stored in the shared-write lock entry when recalculating a row lock. An active transaction has a null global prepare timestamp while its lock entry carries the not-prepared sentinel, so using the global value could turn an active lock into a false blocker after unrelated prepare or abort activity.

Gate the changed mutation behavior with a new tablet reign and retain the previous calculation for older mutations. Add a focused regression that reads before and after another lock group is prepared and aborted.
commit_hash:8cc7585fd80cf3d8529b26dd6e0ddfe6005c55ce

**File**: `yt/yt/server/node/tablet_node/serialize.h` (modified, +1/-0)
```diff
@@ -90,6 +90,7 @@ DEFINE_ENUM(ETabletReign,
     ((NewHunkDataWeightComputation)                (101601)) // akozhikhov
     ((RawIOConfigNodes)                            (101602)) // ifsmirnov
     ((DelayedWrite)                                (101603)) // kvk1920
+    ((FixSharedWriteLockPrepareTimestamp)          (101604)) // savrus
 );
 
 static_assert(TEnumTraits<ETabletReign>::IsMonotonic, "Tablet reign enum is not monotonic");
```

**File**: `yt/yt/server/node/tablet_node/sorted_dynamic_store.cpp` (modified, +17/-3)
```diff
@@ -116,16 +116,30 @@ void RecalculatePrepareTimestamp(TLockDescriptor* lock)
         ? nullptr
         : lock->SharedWriteTransactions.front().Transaction;
 
+    auto sharedWritePrepareTimestamp = sharedWritePrepareTransaction
+        ? sharedWritePrepareTransaction->GetPrepareTimestamp()
+        : NotPreparedTimestamp;
+
+    // COMPAT(savrus): An active transaction has NullTimestamp while its lock entry has NotPreparedTimestamp.
+    if (auto* context = TryGetCurrentMutationContext();
+        context == nullptr ||
+        GetCurrentMutationEffectiveReign() >= ETabletReign::FixSharedWriteLockPrepareTimestamp)
+    {
+        sharedWritePrepareTimestamp = lock->SharedWriteTransactions.empty()
+            ? NotPreparedTimestamp
+            : lock->SharedWriteTransactions.front().PrepareTimestamp;
+    }
+
     YT_ASSERT(writePrepareTimestamp <= NotPreparedTimestamp);
-    YT_ASSERT(sharedWritePrepareTransaction == nullptr || sharedWritePrepareTransaction->GetPrepareTimestamp() <= NotPreparedTimestamp);
+    YT_ASSERT(sharedWritePrepareTimestamp <= NotPreparedTimestamp);
     YT_ASSERT(writePrepareTimestamp == NotPreparedTimestamp || sharedWritePrepareTransaction == nullptr);
 
-    if (sharedWritePrepareTransaction == nullptr || writePrepareTimestamp <= sharedWritePrepareTransaction->GetPrepareTimestamp()) {
+    if (writePrepareTimestamp <= sharedWritePrepareTimestamp) {
         lock->PreparedTransaction = lock->WriteTransaction;
         lock->PrepareTimestamp.store(writePrepareTimestamp);
     } else {
         lock->PreparedTransaction = sharedWritePrepareTransaction;
-        lock->PrepareTimestamp.store(sharedWritePrepareTransaction->GetPrepareTimestamp());
+        lock->PrepareTimestamp.store(sharedWritePrepareTimestamp);
     }
 }
 
```

**File**: `yt/yt/server/node/tablet_node/unittests/sorted_dynamic_store_ut.cpp` (modified, +35/-0)
```diff
@@ -1874,6 +1874,41 @@ TEST_F(TMultiLockSortedDynamicStoreTest, DeleteWriteConflict2)
     EXPECT_EQ(NullTimestamp, WriteRow(BuildRow("key=1;a=1", false), LockMask1));
 }
 
+TEST_F(TMultiLockSortedDynamicStoreTest, UnpreparedSharedWriterDoesNotBlockReads)
+{
+    auto key = BuildKey("1");
+    WriteRow(BuildRow("key=1;a=1", false));
+
+    TLockMask sharedWriteMask;
+    sharedWriteMask.Set(1, ELockType::SharedWrite);
+    auto sharedWriter = StartTransaction();
+    auto sharedRow = LockRow(sharedWriter.get(), key, false, sharedWriteMask);
+
+    EXPECT_NO_THROW({
+        EXPECT_TRUE(AreRowsEqual(LookupRow(key, SyncLastCommittedTimestamp), "key=1;a=1"));
+    });
+
+    auto otherWriter = StartTransaction();
+    auto otherRow = WriteRow(otherWriter.get(), BuildRow("key=1;b=2.0", false), false, LockMask2);
+    PrepareTransaction(otherWriter.get());
+
+    // Preparing another lock recalculates prepare timestamps for the whole row.
+    PrepareRow(otherWriter.get(), otherRow);
+
+    EXPECT_EQ(NullTimestamp, sharedWriter->GetPrepareTimestamp());
+    EXPECT_EQ(NotPreparedTimestamp, GetLock(sharedRow, 1).PrepareTimestamp.load());
+
+    AbortTransaction(otherWriter.get());
+    AbortRow(otherWriter.get(), otherRow);
+
+    EXPECT_NO_THROW({
+        EXPECT_TRUE(AreRowsEqual(LookupRow(key, SyncLastCommittedTimestamp), "key=1;a=1"));
+    });
+
+    AbortTransaction(sharedWriter.get());
+    AbortRow(sharedWriter.get(), sharedRow);
+}
+
 TEST_F(TMultiLockSortedDynamicStoreTest, WriteNotBlocked)
 {
     auto transaction1 = StartTransaction();
```

---

### Incident Patch 5: `0e26bbe7` (2026-10-05)
**Commit Message**: Revert "Better wait for nodes in local YT"

This reverts commit 8ec6c0ffb6fce96ae1227871e15977e5362c938e, reversing
changes made to d5dacc7d9a48ee04c2e905cd6ab10c7e414a3575.
commit_hash:58779a6ab9d8a3b2a845503bd6815071f0741440

**File**: `yt/python/yt/environment/yt_env.py` (modified, +0/-13)
```diff
@@ -1936,8 +1936,6 @@ def start_nodes(self, indexes=None, addresses=None, sync=True):
 
         self._run_builtin_yt_component("node", indexes=indexes)
 
-        client = self._create_cluster_client()
-
         def nodes_ready():
             self._validate_processes_are_running("node")
 
@@ -1963,17 +1961,6 @@ def check_node(node):
                     not_ready_nodes[str(node)] = description
             if not_ready_nodes:
                 return False, f"Nodes are not ready: {not_ready_nodes}"
-
-            # Nodes may become online before their RPC servers start listening.
-            for node in nodes:
-                if node.attributes["banned"]:
-                    continue
-                try:
-                    client.get(f"//sys/cluster_nodes/{node}/orchid/service")
-                except YtResponseError as err:
-                    if not err.is_rpc_unavailable() and not err.is_transport_error():
-                        raise
-                    return False, err
             return True
 
         self._wait_for_component(
```

**File**: `yt/yt/tests/integration/master/test_chunk_server.py` (modified, +6/-12)
```diff
@@ -1185,8 +1185,7 @@ def test_restarted_state(self):
 
         assert get("//sys/cluster_nodes/{}/@state".format(node)) == "online"
 
-        # Observe the intermediate state before waiting for node readiness.
-        self.Env.start_nodes(sync=False)
+        self.Env.start_nodes()
 
         wait(lambda: get("//sys/cluster_nodes/{}/@state".format(node)) == "restarted")
         assert node not in get(f"#{chunk_id}/@stored_replicas")
@@ -1233,8 +1232,7 @@ def test_table_removed_during_restart(self):
 
         self.Env.kill_service("node", indexes=[node_index])
 
-        # Observe the intermediate state before waiting for node readiness.
-        self.Env.start_nodes(sync=False)
+        self.Env.start_nodes()
         wait(lambda: get("//sys/cluster_nodes/{}/@state".format(node)) == "restarted")
         remove("//tmp/t")
         assert get("//sys/cluster_nodes/{}/@state".format(node)) == "restarted"
@@ -1723,20 +1721,16 @@ class TestPendingRestartNodeDisposal(TestNodePendingRestartBase):
     ENABLE_MULTIDAEMON = False  # There are specific component kills.
     DELTA_NODE_CONFIG = {
         "data_node": {
+            "master_connector": {
+                "delay_before_full_heartbeat_report": 4000,
+            },
             "lease_transaction_timeout": 2000,
             "lease_transaction_ping_period": 1000,
         },
     }
 
     @authors("danilalexeev")
     def test_no_missing_replicas_erasure(self):
-        update_nodes_dynamic_config({
-            "data_node": {
-                "testing_options": {
-                    "full_heartbeat_session_sleep_duration": 4000,
-                },
-            },
-        })
         set("//sys/@config/chunk_manager/disposed_pending_restart_node_chunk_refresh_delay", 10000)
 
         create("table", "//tmp/t", attributes={"erasure_codec": "reed_solomon_3_3"})
@@ -1763,7 +1757,7 @@ def test_no_missing_replicas_erasure(self):
         assert not status["parity_missing"]
 
         self.Env.kill_service("node", indexes=node_indexes)
-        self.Env.start_nodes(sync=False)
+        self.Env.start_nodes()
 
         # explicit statistics
         def check1():
```

---

### Incident Patch 6: `fb8dc2ef` (2026-10-05)
**Commit Message**: Fix crash when detaching replication card with collocation options
commit_hash:dfa5c3a123283b87d8ec187215129c08c5c5bc74

**File**: `yt/yt/server/node/chaos_node/chaos_manager.cpp` (modified, +12/-3)
```diff
@@ -945,9 +945,16 @@ class TChaosManager
                     .With("collocation_id", *collocationId);
             }
             collocation->ValidateNotMigrating();
-        } else if (collocationOptions && !replicationCard->GetCollocation()) {
-            THROW_ERROR_EXCEPTION("Replication card %v is not a member of any collocation",
-                replicationCardId);
+        } else if (collocationOptions) {
+            if (!replicationCard->GetCollocation()) {
+                THROW_ERROR_EXCEPTION("Replication card %v is not a member of any collocation",
+                    replicationCardId);
+            }
+
+            if (collocationId && !*collocationId) {
+                THROW_ERROR_EXCEPTION("Cannot set collocation options while detaching replication card %v from collocation",
+                    replicationCardId);
+            }
         }
 
         YT_TLOG_DEBUG("Alter replication card")
@@ -978,13 +985,15 @@ class TChaosManager
                 replicationCard,
                 collocation);
         }
+
         if (collocationOptions) {
             auto* collocation = replicationCard->GetCollocation();
             collocation->ValidateNotMigrating();
 
             collocation->Options() = std::move(*collocationOptions);
             FireReplicationCardCollocationUpdated(collocation);
         }
+
         if (createSecondaryIndex) {
             CreateSecondaryIndex(replicationCard, createSecondaryIndex.Get());
         }
```

**File**: `yt/yt/tests/integration/dynamic_tables/test_chaos.py` (modified, +26/-0)
```diff
@@ -7207,6 +7207,32 @@ def test_trim_chaos_queue_with_holes(self):
         wait(lambda: len(get("//tmp/q0/@chunk_ids")) == 1)
         trim_rows("//tmp/q0", 0, 1)
 
+    @authors("osidorkin")
+    def test_detach_replication_card_from_collocation_with_collocation_options(self):
+        cell_id = self._sync_create_chaos_bundle_and_cell()
+        set("//sys/chaos_cell_bundles/c/@metadata_cell_id", cell_id)
+
+        create("chaos_replicated_table", "//tmp/crt", attributes={"chaos_cell_bundle": "c"})
+        card_id = get("//tmp/crt/@replication_card_id")
+        collocation_id = create("replication_card_collocation", None, attributes={
+            "type": "replication",
+            "table_paths": ["//tmp/crt"],
+        })
+
+        collocation_path = f"/chaos_manager/replication_card_collocations/{collocation_id}"
+        collocation = self._get_chaos_cell_orchid(cell_id, collocation_path)
+        assert collocation["replication_card_ids"] == [card_id]
+
+        with raises_yt_error("Cannot set collocation options while detaching replication card"):
+            alter_replication_card(
+                card_id,
+                replication_card_collocation_id="0-0-0-0",
+                collocation_options={"preferred_sync_replica_clusters": ["primary"]},
+            )
+
+        assert get(f"#{card_id}/@replication_card_collocation_id") == collocation_id
+        assert self._get_chaos_cell_orchid(cell_id, collocation_path) == collocation
+
     @authors("osidorkin")
     def test_alter_replication_card_collocation_abort(self):
         cell_id = self._sync_create_chaos_bundle_and_cell()
```

---

### Incident Patch 7: `e49ac185` (2026-10-05)
**Commit Message**: Do not build FormatValue(fs::path) against libstdc++
commit_hash:eb9352f102ba3605580a26f82e2a1ce4e06c11e0

**File**: `library/cpp/yt/string/format-inl.h` (modified, +3/-4)
```diff
@@ -21,12 +21,10 @@
 #include <util/system/platform.h>
 
 #include <cctype>
+#include <filesystem>
 #include <optional>
 #include <span>
 
-#if __cplusplus >= 202302L
-    #include <filesystem>
-#endif
 
 #ifdef __cpp_lib_source_location
 #include <source_location>
@@ -599,7 +597,8 @@ inline void FormatValue(TStringBuilderBase* builder, const std::string_view& val
     FormatValue(builder, TStringBuf(value), spec);
 }
 
-#if __cplusplus >= 202302L
+#ifdef _LIBCPP_VERSION
+// This branch can not be built against libstdc++ 10, see YT-29941 regarding this gate removal.
 // std::filesystem::path
 inline void FormatValue(TStringBuilderBase* builder, const std::filesystem::path& value, TStringBuf spec)
 {
```

---

### Incident Patch 8: `e4f57464` (2026-10-05)
**Commit Message**: Automatic release build for os_test_tool, test_tool, os_ya, ya_bin

Update tools: os_test_tool, test_tool, os_ya, ya_bin
commit_hash:a5fae66abc69e100315b5a2fd62c25cbf124af6c

**File**: `build/mapping.conf.json` (modified, +2/-0)
```diff
@@ -650,6 +650,7 @@
         "13801937940": "{registry_endpoint}/13801937940",
         "13866538307": "{registry_endpoint}/13866538307",
         "13904401743": "{registry_endpoint}/13904401743",
+        "13945860998": "{registry_endpoint}/13945860998",
         "5486713852": "{registry_endpoint}/5486713852",
         "5514352253": "{registry_endpoint}/5514352253",
         "5523579199": "{registry_endpoint}/5523579199",
@@ -3323,6 +3324,7 @@
         "13801937940": "devtools/ya/test/programs/test_tool/bin/test_tool for linux",
         "13866538307": "devtools/ya/test/programs/test_tool/bin/test_tool for linux",
         "13904401743": "devtools/ya/test/programs/test_tool/bin/test_tool for linux",
+        "13945860998": "devtools/ya/test/programs/test_tool/bin/test_tool for linux",
         "5486713852": "devtools/ya/test/programs/test_tool/bin/test_tool for linux",
         "5514352253": "devtools/ya/test/programs/test_tool/bin/test_tool for linux",
         "5523579199": "devtools/ya/test/programs/test_tool/bin/test_tool for linux",
```

**File**: `build/platform/test_tool/host.ya.make.inc` (modified, +5/-5)
```diff
@@ -1,12 +1,12 @@
 IF (HOST_OS_DARWIN AND HOST_ARCH_X86_64)
-    DECLARE_EXTERNAL_RESOURCE(TEST_TOOL_HOST sbr:13904388591)
+    DECLARE_EXTERNAL_RESOURCE(TEST_TOOL_HOST sbr:13945875759)
 ELSEIF (HOST_OS_DARWIN AND HOST_ARCH_ARM64)
-    DECLARE_EXTERNAL_RESOURCE(TEST_TOOL_HOST sbr:13904385271)
+    DECLARE_EXTERNAL_RESOURCE(TEST_TOOL_HOST sbr:13945874320)
 ELSEIF (HOST_OS_LINUX AND HOST_ARCH_X86_64)
-    DECLARE_EXTERNAL_RESOURCE(TEST_TOOL_HOST sbr:13904399371)
+    DECLARE_EXTERNAL_RESOURCE(TEST_TOOL_HOST sbr:13945878837)
 ELSEIF (HOST_OS_LINUX AND HOST_ARCH_AARCH64)
-    DECLARE_EXTERNAL_RESOURCE(TEST_TOOL_HOST sbr:13904382507)
+    DECLARE_EXTERNAL_RESOURCE(TEST_TOOL_HOST sbr:13945873055)
 ELSEIF (HOST_OS_WINDOWS AND HOST_ARCH_X86_64)
-    DECLARE_EXTERNAL_RESOURCE(TEST_TOOL_HOST sbr:13904393140)
+    DECLARE_EXTERNAL_RESOURCE(TEST_TOOL_HOST sbr:13945877495)
 
 ENDIF()
```

**File**: `build/platform/test_tool/host_os.ya.make.inc` (modified, +5/-5)
```diff
@@ -1,12 +1,12 @@
 IF (HOST_OS_DARWIN AND HOST_ARCH_X86_64)
-    DECLARE_EXTERNAL_RESOURCE(TEST_TOOL_HOST sbr:13904394663)
+    DECLARE_EXTERNAL_RESOURCE(TEST_TOOL_HOST sbr:13945858354)
 ELSEIF (HOST_OS_DARWIN AND HOST_ARCH_ARM64)
-    DECLARE_EXTERNAL_RESOURCE(TEST_TOOL_HOST sbr:13904391356)
+    DECLARE_EXTERNAL_RESOURCE(TEST_TOOL_HOST sbr:13945857237)
 ELSEIF (HOST_OS_LINUX AND HOST_ARCH_X86_64)
-    DECLARE_EXTERNAL_RESOURCE(TEST_TOOL_HOST sbr:13904401743)
+    DECLARE_EXTERNAL_RESOURCE(TEST_TOOL_HOST sbr:13945860998)
 ELSEIF (HOST_OS_LINUX AND HOST_ARCH_AARCH64)
-    DECLARE_EXTERNAL_RESOURCE(TEST_TOOL_HOST sbr:13904388269)
+    DECLARE_EXTERNAL_RESOURCE(TEST_TOOL_HOST sbr:13945856083)
 ELSEIF (HOST_OS_WINDOWS AND HOST_ARCH_X86_64)
-    DECLARE_EXTERNAL_RESOURCE(TEST_TOOL_HOST sbr:13904398297)
+    DECLARE_EXTERNAL_RESOURCE(TEST_TOOL_HOST sbr:13945859556)
 
 ENDIF()
```

**File**: `ya` (modified, +10/-10)
```diff
@@ -46,33 +46,33 @@ REGISTRY_ENDPOINT = os.environ.get("YA_REGISTRY_ENDPOINT", "https://devtools-reg
 PLATFORM_MAP = {
     "data": {
         "win32": {
-            "md5": "61fd5aad83ad944ee554ab2befc9346c",
+            "md5": "72d693e0178ccadff56a4ce00819c58c",
             "urls": [
-                f"{REGISTRY_ENDPOINT}/13904429248"
+                f"{REGISTRY_ENDPOINT}/13945881580"
             ]
         },
         "darwin": {
-            "md5": "f8c4ff010882b68ab59d637665fb54a6",
+            "md5": "45bc2cda1051001bf9fcebedd73549d7",
             "urls": [
-                f"{REGISTRY_ENDPOINT}/13904426184"
+                f"{REGISTRY_ENDPOINT}/13945879781"
             ]
         },
         "darwin-arm64": {
-            "md5": "e7871292da121ddb28658506615d07e1",
+            "md5": "b2daeca04879f587843b4978d40e38bd",
             "urls": [
-                f"{REGISTRY_ENDPOINT}/13904422593"
+                f"{REGISTRY_ENDPOINT}/13945878396"
             ]
         },
         "linux-aarch64": {
-            "md5": "f9f2afa7c0e516cd5bcbe25f4a0d373a",
+            "md5": "d7af3e3f5b6817b8d44e3e2ec16a316a",
             "urls": [
-                f"{REGISTRY_ENDPOINT}/13904419724"
+                f"{REGISTRY_ENDPOINT}/13945877150"
             ]
         },
         "linux": {
-            "md5": "02bc3e778fa1ebcecd3fce3c0cbc70db",
+            "md5": "e9bd23d72ab8f20c56ee3ceb2b18ed27",
             "urls": [
-                f"{REGISTRY_ENDPOINT}/13904432191"
+                f"{REGISTRY_ENDPOINT}/13945882988"
             ]
         }
     }
```

---

### Incident Patch 9: `4e742ed2` (2026-10-05)
**Commit Message**: Set empty requisition index as default for imported chunks
commit_hash:1c5f866978fbbf282422638519fc6d3d8d8765d9

**File**: `yt/yt/server/master/cell_master/serialize.h` (modified, +1/-0)
```diff
@@ -230,6 +230,7 @@ DEFINE_ENUM(EMasterReign,
     ((ChunkListRefactoring)                                         (3355))  // grphil
     ((SecondaryIndexMoveWithinCell)                                 (3356))  // sabdenovch
     ((TwoPhaseAlterTable)                                           (3357))  // ifsmirnov
+    ((SetEmptyRequisitionIndexOnImportByDefault)                    (3358))  // theevilbird
 );
 
 static_assert(TEnumTraits<EMasterReign>::IsMonotonic, "Master reign enum is not monotonic");
```

**File**: `yt/yt/server/master/chunk_server/config.cpp` (modified, +1/-2)
```diff
@@ -1095,8 +1095,7 @@ void TDynamicChunkManagerConfig::Register(TRegistrar registrar)
         .Default(TDuration::Days(1));
 
     registrar.Parameter("set_empty_requisition_index_on_import", &TThis::SetEmptyRequisitionIndexOnImport)
-        .Default(false)
-        .DontSerializeDefault();
+        .Default(true);
 
     registrar.Postprocessor([] (TThis* config) {
         for (const auto& dataCenter : config->BannedStorageDataCenters) {
```

---

### Incident Patch 10: `c5d456be` (2026-10-05)
**Commit Message**: Automatic release build for os_ymake, ymake

Update tools: os_ymake, ymake
commit_hash:d4c6f7c7a74337a9781cafd80569812c9ae23030

**File**: `build/external_resources/ymake/public.resources.json` (modified, +5/-5)
```diff
@@ -1,19 +1,19 @@
 {
     "by_platform": {
         "darwin": {
-            "uri": "sbr:13863429569"
+            "uri": "sbr:13939305385"
         },
         "darwin-arm64": {
-            "uri": "sbr:13863425147"
+            "uri": "sbr:13939302697"
         },
         "linux": {
-            "uri": "sbr:13863436992"
+            "uri": "sbr:13939310156"
         },
         "linux-aarch64": {
-            "uri": "sbr:13863420864"
+            "uri": "sbr:13939300437"
         },
         "win32": {
-            "uri": "sbr:13863433450"
+            "uri": "sbr:13939307810"
         }
     }
 }
```

**File**: `build/external_resources/ymake/resources.json` (modified, +5/-5)
```diff
@@ -1,19 +1,19 @@
 {
     "by_platform": {
         "darwin": {
-            "uri": "sbr:13863424263"
+            "uri": "sbr:13939277962"
         },
         "darwin-arm64": {
-            "uri": "sbr:13863418658"
+            "uri": "sbr:13939274799"
         },
         "linux": {
-            "uri": "sbr:13863433679"
+            "uri": "sbr:13939283341"
         },
         "linux-aarch64": {
-            "uri": "sbr:13863413490"
+            "uri": "sbr:13939272556"
         },
         "win32": {
-            "uri": "sbr:13863429387"
+            "uri": "sbr:13939280915"
         }
     }
 }
```

**File**: `build/mapping.conf.json` (modified, +10/-0)
```diff
@@ -1063,6 +1063,7 @@
         "13785966487": "{registry_endpoint}/13785966487",
         "13836867980": "{registry_endpoint}/13836867980",
         "13863429569": "{registry_endpoint}/13863429569",
+        "13939305385": "{registry_endpoint}/13939305385",
         "5766172292": "{registry_endpoint}/5766172292",
         "5805431504": "{registry_endpoint}/5805431504",
         "5829027626": "{registry_endpoint}/5829027626",
@@ -1222,6 +1223,7 @@
         "13785964230": "{registry_endpoint}/13785964230",
         "13836865822": "{registry_endpoint}/13836865822",
         "13863425147": "{registry_endpoint}/13863425147",
+        "13939302697": "{registry_endpoint}/13939302697",
         "5766171800": "{registry_endpoint}/5766171800",
         "5805430761": "{registry_endpoint}/5805430761",
         "5829025456": "{registry_endpoint}/5829025456",
@@ -1381,6 +1383,7 @@
         "13785970849": "{registry_endpoint}/13785970849",
         "13836872872": "{registry_endpoint}/13836872872",
         "13863436992": "{registry_endpoint}/13863436992",
+        "13939310156": "{registry_endpoint}/13939310156",
         "5766173070": "{registry_endpoint}/5766173070",
         "5805432830": "{registry_endpoint}/5805432830",
         "5829031598": "{registry_endpoint}/5829031598",
@@ -1540,6 +1543,7 @@
         "13785961843": "{registry_endpoint}/13785961843",
         "13836863715": "{registry_endpoint}/13836863715",
         "13863420864": "{registry_endpoint}/13863420864",
+        "13939300437": "{registry_endpoint}/13939300437",
         "5766171341": "{registry_endpoint}/5766171341",
         "5805430188": "{registry_endpoint}/5805430188",
         "5829023352": "{registry_endpoint}/5829023352",
@@ -1699,6 +1703,7 @@
         "13785968576": "{registry_endpoint}/13785968576",
         "13836870282": "{registry_endpoint}/13836870282",
         "13863433450": "{registry_endpoint}/13863433450",
+        "13939307810": "{registry_endpoint}/13939307810",
         "8270821739": "{registry_endpoint}/8270821739",
         "8295446553": "{registry_endpoint}/8295446553",
         "8326170338": "{registry_endpoint}/8326170338",
@@ -3726,6 +3731,7 @@
         "13785966487": "devtools/ymake/bin/ymake for darwin",
         "13836867980": "devtools/ymake/bin/ymake for darwin",
         "13863429569": "devtools/ymake/bin/ymake for darwin",
+        "13939305385": "devtools/ymake/bin/ymake for darwin",
         "5766172292": "devtools/ymake/bin/ymake for darwin",
         "5805431504": "devtools/ymake/bin/ymake for darwin",
         "5829027626": "devtools/ymake/bin/ymake for darwin",
@@ -3885,6 +3891,7 @@
         "13785964230": "devtools/ymake/bin/ymake for darwin-arm64",
         "13836865822": "devtools/ymake/bin/ymake for darwin-arm64",
         "13863425147": "devtools/ymake/bin/ymake for darwin-arm64",
+        "13939302697": "devtools/ymake/bin/ymake for darwin-arm64",
         "5766171800": "devtools/ymake/bin/ymake for darwin-arm64",
         "5805430761": "devtools/ymake/bin/ymake for darwin-arm64",
         "5829025456": "devtools/ymake/bin/ymake for darwin-arm64",
@@ -4044,6 +4051,7 @@
         "13785970849": "devtools/ymake/bin/ymake for linux",
         "13836872872": "devtools/ymake/bin/ymake for linux",
         "13863436992": "devtools/ymake/bin/ymake for linux",
+        "13939310156": "devtools/ymake/bin/ymake for linux",
         "5766173070": "devtools/ymake/bin/ymake for linux",
         "5805432830": "devtools/ymake/bin/ymake for linux",
         "5829031598": "devtools/ymake/bin/ymake for linux",
@@ -4203,6 +4211,7 @@
         "13785961843": "devtools/ymake/bin/ymake for linux-aarch64",
         "13836863715": "devtools/ymake/bin/ymake for linux-aarch64",
         "13863420864": "devtools/ymake/bin/ymake for linux-aarch64",
+        "13939300437": "devtools/ymake/bin/ymake for linux-aarch64",
         "5766171341": "devtools/ymake/bin/ymake for linux-aarch64",
         "5805430188": "devtools/ymake/bin/ymake for linux-aarch64",
         "5829023352": "devtools/ymake/bin/ymake for linux-aarch64",
@@ -4362,6 +4371,7 @@
         "13785968576": "devtools/ymake/bin/ymake for win32",
         "13836870282": "devtools/ymake/bin/ymake for win32",
         "13863433450": "devtools/ymake/bin/ymake for win32",
+        "13939307810": "devtools/ymake/bin/ymake for win32",
         "8270821739": "devtools/ymake/bin/ymake for win32",
         "8295446553": "devtools/ymake/bin/ymake for win32",
         "8326170338": "devtools/ymake/bin/ymake for win32",
```

---

### Incident Patch 11: `103bfae4` (2026-10-04)
**Commit Message**: YT-26495: Preload whole chunk for in-memory chunk views

* Changelog entry
  Type: fix
  Component: dynamic-tables

  An in-memory chunk view used to preload only the blocks it covers. This
  worked for row formats only, and the scan format is much more common now,
  so the heuristic gave little and made the code harder to follow. Now the
  whole chunk is preloaded.
commit_hash:af500e68d91e4845bfd6369334c15c7a331bbec6

**File**: `yt/yt/server/node/tablet_node/in_memory_manager.cpp` (modified, +6/-81)
```diff
@@ -7,7 +7,6 @@
 #include "private.h"
 #include "slot_manager.h"
 #include "smooth_movement_tracker.h"
-#include "sorted_chunk_store.h"
 #include "store_manager.h"
 #include "structured_logger.h"
 #include "tablet.h"
@@ -43,8 +42,6 @@
 
 #include <yt/yt_proto/yt/client/table_chunk_format/proto/chunk_meta.pb.h>
 
-#include <yt/yt/library/numeric/algorithm_helpers.h>
-
 #include <yt/yt/core/compression/codec.h>
 
 #include <yt/yt/core/concurrency/async_semaphore.h>
@@ -475,33 +472,6 @@ IInMemoryManagerPtr CreateInMemoryManager(IBootstrap* bootstrap)
 
 ////////////////////////////////////////////////////////////////////////////////
 
-std::optional<i64> GetEstimatedBlockRangeSize(
-    bool enablePreliminaryNetworkThrottling,
-    const TCachedVersionedChunkMetaPtr& meta,
-    int startBlockIndex,
-    int blocksCount)
-{
-    if (!enablePreliminaryNetworkThrottling) {
-        return {};
-    }
-
-    const auto& metaMisc = meta->Misc();
-    if (metaMisc.compressed_data_size() == 0 || metaMisc.uncompressed_data_size() == 0) {
-        return {};
-    }
-
-    i64 uncompressedSize = 0;
-    const auto& dataBlockMeta = meta->DataBlockMeta();
-    for (int index = startBlockIndex; index < startBlockIndex + blocksCount; ++index) {
-        uncompressedSize += dataBlockMeta->data_blocks(index).uncompressed_size();
-    }
-
-    auto compressionRatio = static_cast<double>(metaMisc.compressed_data_size()) / metaMisc.uncompressed_data_size();
-    return uncompressedSize * compressionRatio;
-}
-
-////////////////////////////////////////////////////////////////////////////////
-
 TInMemoryChunkDataPtr PreloadInMemoryStore(
     const TTabletSnapshotPtr& tabletSnapshot,
     const IChunkStorePtr& store,
@@ -569,52 +539,8 @@ TInMemoryChunkDataPtr PreloadInMemoryStore(
 
     auto dataBlockCount = versionedChunkMeta->DataBlockMeta()->data_blocks_size();
 
-    int commonKeyPrefix = GetCommonKeyPrefix(
-        versionedChunkMeta->ChunkSchema()->GetKeyColumns(),
-        tabletSnapshot->PhysicalSchema->GetKeyColumns());
-
-    // Expected to be equal for dynamic tables.
-    YT_VERIFY(commonKeyPrefix == versionedChunkMeta->ChunkSchema()->GetKeyColumnCount());
-
-    auto sortOrders = GetSortOrders(tabletSnapshot->PhysicalSchema->GetSortColumns());
-
-    int startBlockIndex;
-    int endBlockIndex;
-
-    // TODO(ifsmirnov): support columnar chunks (YT-11707).
-    bool canDeduceBlockRange =
-        format == EChunkFormat::TableUnversionedSchemalessHorizontal ||
-        format == EChunkFormat::TableVersionedSimple;
-
-    if (store->IsSorted() && canDeduceBlockRange) {
-        auto sortedStore = store->AsSortedChunk();
-        auto lowerBound = std::max(tabletSnapshot->PivotKey, sortedStore->GetMinKey());
-        auto upperBound = std::min(tabletSnapshot->NextPivotKey, sortedStore->GetUpperBoundKey());
-
-        const auto& blockLastKeys = versionedChunkMeta->BlockLastKeys();
-
-        YT_VERIFY(dataBlockCount == std::ssize(blockLastKeys));
-
-        startBlockIndex = BinarySearch(0, dataBlockCount, [&] (int index) {
-            return !TestKeyWithWidening(
-                ToKeyRef(blockLastKeys[index], commonKeyPrefix),
-                ToKeyBoundRef(lowerBound, /*upper*/ false, sortOrders.size()),
-                sortOrders);
-        });
-
-        endBlockIndex = BinarySearch(0, dataBlockCount, [&] (int index) {
-            return TestKeyWithWidening(
-                ToKeyRef(blockLastKeys[index], commonKeyPrefix),
-                ToKeyBoundRef(upperBound, /*upper*/ true, sortOrders.size()),
-                sortOrders);
-        });
-        if (endBlockIndex < dataBlockCount) {
-            ++endBlockIndex;
-        }
-    } else {
-        startBlockIndex = 0;
-        endBlockIndex = dataBlockCount;
-    }
+    int startBlockIndex = 0;
+    int endBlockIndex = dataBlockCount;
 
     i64 preallocatedMemory = 0;
     i64 compressedDataSize = 0;
@@ -658,11 +584,10 @@ TInMemoryChunkDataPtr PreloadInMemoryStore(
     std::vector<NChunkClient::TBlock> blocks;
     blocks.reserve(endBlockIndex - startBlockIndex);
 
-    auto preThrottledBytes = GetEstimatedBlockRangeSize(
-        enablePreliminaryNetworkThrottling,
-        versionedChunkMeta,
-        startBlockIndex,
-        endBlockIndex - startBlockIndex);
+    std::optional<i64> preThrottledBytes;
+    if (enablePreliminaryNetworkThrottling && miscExt.compressed_data_size() > 0) {
+        preThrottledBytes = miscExt.compressed_data_size();
+    }
 
     if (preThrottledBytes) {
         YT_TLOG_DEBUG("Preliminary throttling of network bandwidth for preload")
```

**File**: `yt/yt/server/node/tablet_node/store_manager_detail.cpp` (modified, +2/-8)
```diff
@@ -371,14 +371,8 @@ bool TStoreManagerBase::TryPreloadStoreFromInterceptedData(
         return false;
     }
 
-    if (chunkData->StartBlockIndex != 0 ||
-        std::ssize(chunkData->Blocks) != chunkData->ChunkMeta->DataBlockMeta()->data_blocks_size())
-    {
-        YT_TLOG_DEBUG("Intercepted chunk data does not contain all chunk blocks")
-            .With("StoreId", store->GetId())
-            .With("ChunkId", store->GetChunkId());
-        return false;
-    }
+    YT_VERIFY(chunkData->StartBlockIndex == 0);
+    YT_VERIFY(ssize(chunkData->Blocks) >= chunkData->ChunkMeta->DataBlockMeta()->data_blocks_size());
 
     store->Preload(chunkData);
     store->SetPreloadState(EStorePreloadState::Complete);
```

**File**: `yt/yt/tests/integration/dynamic_tables/test_sorted_dynamic_tables.py` (modified, +0/-52)
```diff
@@ -796,58 +796,6 @@ def _check():
                 cell_statistics["preload_pending_store_count"] == 0
         wait(_check)
 
-    @authors("ifsmirnov")
-    @pytest.mark.parametrize("enable_lookup_hash_table", [True, False])
-    @pytest.mark.parametrize("optimize_for", ["scan", "lookup"])
-    def test_preload_block_range(self, enable_lookup_hash_table, optimize_for):
-        create_tablet_cell_bundle("b", attributes={"options": {"peer_count": 3}})
-        sync_create_cells(1, tablet_cell_bundle="b")
-        set("//sys/tablet_cell_bundles/b/@resource_limits/tablet_static_memory", 2**30)
-        self._create_simple_table(
-            "//tmp/t",
-            tablet_cell_bundle="b",
-            optimize_for=optimize_for,
-            in_memory_mode="uncompressed",
-            enable_lookup_hash_table=enable_lookup_hash_table,
-            chunk_writer={"block_size": 1024})
-        sync_mount_table("//tmp/t")
-
-        rows = [{"key": i, "value": str(i)} for i in range(10000)]
-        insert_rows("//tmp/t", rows)
-
-        sync_unmount_table("//tmp/t")
-        memory_size = get("//tmp/t/@tablet_statistics/uncompressed_data_size")
-        # Allowance for the active store lookup hash table now charged to tablet static category.
-        lht_tax = 16_000_000 if enable_lookup_hash_table else 0
-
-        lower_bound = 3800
-        upper_bound = 5200
-        expected = rows[lower_bound:upper_bound]
-
-        sync_reshard_table("//tmp/t", [[], [lower_bound], [upper_bound]])
-        sync_mount_table("//tmp/t", first_tablet_index=1, last_tablet_index=1)
-        self._wait_for_in_memory_stores_preload("//tmp/t", first_tablet_index=1, last_tablet_index=1)
-
-        node = get_tablet_leader_address(get("//tmp/t/@tablets/1/tablet_id"))
-
-        def _check_memory_usage():
-            memory_usage = get("//sys/cluster_nodes/{}/@statistics/memory/tablet_static/used".format(node))
-            return 0 < memory_usage - lht_tax < memory_size
-        if optimize_for == "lookup":
-            wait(_check_memory_usage)
-
-        assert lookup_rows("//tmp/t", [{"key": i} for i in range(lower_bound, upper_bound)]) == expected
-        wait(lambda: lookup_rows(
-            "//tmp/t",
-            [{"key": i} for i in range(lower_bound, upper_bound)],
-            read_from="follower",
-            timestamp=AsyncLastCommittedTimestamp
-        ) == expected)
-
-        assert_items_equal(
-            select_rows("* from [//tmp/t] where key >= {} and key < {}".format(lower_bound, upper_bound)),
-            expected)
-
     @authors("savrus", "sandello")
     @pytest.mark.parametrize("chunk_format", [
         "table_versioned_simple",
```

**File**: `yt/yt/tests/integration/dynamic_tables/test_tablet_actions.py` (modified, +61/-0)
```diff
@@ -444,6 +444,67 @@ def test_data_retention_in_memory_shared_chunk(self):
 
         assert lookup_rows("//tmp/t", [{"key": i} for i in range(30)]) == rows
 
+    @authors("atalmenev")
+    @pytest.mark.parametrize("mode", ["compressed", "uncompressed"])
+    def test_data_retention_in_memory_shared_chunk_merge(self, mode):
+        sync_create_cells(1)
+        self._create_sorted_table(
+            "//tmp/t",
+            mount_config={
+                "enable_compaction_and_partitioning": False,
+                "testing": {
+                    "simulated_store_preload_delay": 10**9,
+                },
+            },
+            tablet_balancer_config={
+                "enable_auto_reshard": False,
+            },
+            chunk_writer={
+                "block_size": 1,
+                "key_filter": {"enable": True},
+            },
+            optimize_for="lookup",
+            in_memory_mode=mode)
+
+        def get_preload_pending_store_count():
+            return sum(
+                tablet["statistics"]["preload_pending_store_count"]
+                for tablet in get("//tmp/t/@tablets"))
+
+        rows = [{"key": i, "value": "FF"} for i in range(30)]
+        sync_mount_table("//tmp/t")
+        insert_rows("//tmp/t", rows)
+        sync_flush_table("//tmp/t")
+        assert get_preload_pending_store_count() == 0
+        wait(lambda: get("//tmp/t/@preload_state") == "complete")
+
+        set("//tmp/t/@mount_config/testing/simulated_store_preload_delay", 0)
+        sync_unmount_table("//tmp/t")
+        sync_reshard_table("//tmp/t", [[], [15]])
+        sync_mount_table("//tmp/t")
+
+        chunk_ids = get("//tmp/t/@chunk_ids")
+        assert len(chunk_ids) == 2
+        assert len(builtins.set(chunk_ids)) == 1
+        wait(lambda: get("//tmp/t/@preload_state") == "complete")
+
+        set("//tmp/t/@mount_config/testing/simulated_store_preload_delay", 10**9)
+        tablet_ids = [tablet["tablet_id"] for tablet in get("//tmp/t/@tablets")]
+        action = create(
+            "tablet_action",
+            "",
+            attributes={
+                "kind": "reshard",
+                "keep_finished": True,
+                "tablet_ids": tablet_ids,
+                "pivot_keys": [[]],
+                "inplace_reshard": True,
+            },
+        )
+        wait(lambda: get(f"#{action}/@state") == "completed")
+        assert get_preload_pending_store_count() == 0
+        assert lookup_rows("//tmp/t", [{"key": i} for i in range(30)]) == rows
+
     @authors("atalmenev")
     def test_provisional_flush(self):
         sync_create_cells(1)
```

---

### Incident Patch 12: `b2909d49` (2026-10-04)
**Commit Message**: YT-29948: Fix ordering check race in TBoundedConcurrencyInvokerParametrizedReconfigureTest

`TBoundedConcurrencyInvokerParametrizedReconfigureTest.SetMaxConcurrentInvocations` flakes (seen on `/1` = `(5, 3, true)`).

At the end of each callback with `callbackIndex > max`, the test asserted `finishedCallbacks > max`, i.e. that callbacks `0..max` had already finished. The bounded concurrency invoker only guarantees FIFO admission and the concurrency bound; it does not order completions. Callback `max + 1` is admitted after any two releases, and its `WaitFor(firstFuture)` returns as soon as it is rescheduled. Meanwhile `secondPromise.Set()` on the test thread posts the resumes for callbacks `0..max-1` to the single-threaded queue one by one. If the queue drains faster than the test thread posts them, callback `max + 1` reaches the check while some earlier callback is still suspended, and the test throws `"<max+2>-th callback was executed before first <max>"`.

The fix checks the bound that FIFO admission plus the concurrency limit actually imply. When callback `i` starts, `finishedCallbacks > i - max` must hold. This is strictly stronger than the old check with respect to early admiss

**File**: `yt/yt/core/concurrency/unittests/bounded_concurrency_invoker_ut.cpp` (modified, +11/-12)
```diff
@@ -135,7 +135,7 @@ TEST_P(TBoundedConcurrencyInvokerParametrizedReconfigureTest, SetMaxConcurrentIn
     auto secondFuture = secondPromise.ToFuture();
 
     YT_DECLARE_SPIN_LOCK(NThreading::TSpinLock, lock);
-    int runnedCallbacks = 0;
+    int ranCallbacks = 0;
     int finishedCallbacks = 0;
 
     std::vector<std::vector<TFuture<void>>> callbacks;
@@ -154,26 +154,25 @@ TEST_P(TBoundedConcurrencyInvokerParametrizedReconfigureTest, SetMaxConcurrentIn
 
                 {
                     auto guard = Guard(lock);
-                    runnedCallbacks += 1;
+                    ranCallbacks += 1;
+                    if (finishedCallbacks <= callbackIndex - maxConcurrentInvocations) {
+                        THROW_ERROR_EXCEPTION("%v-th callback was executed before %v callbacks finished",
+                            callbackIndex + 1,
+                            callbackIndex + 1 - maxConcurrentInvocations);
+                    }
                 }
 
-                // Later callbacks wait for the first future to set to check that
-                // they are not scheduled before first MaxConcurrentInvocations callbacks.
                 WaitFor((callbackIndex > maxConcurrentInvocations)
                     ? firstFuture
                     : secondFuture)
                     .ThrowOnError();
 
                 auto guard = Guard(lock);
 
-                auto concurrentInvocations = runnedCallbacks - finishedCallbacks;
+                auto concurrentInvocations = ranCallbacks - finishedCallbacks;
                 THROW_ERROR_EXCEPTION_UNLESS(concurrentInvocations <= maxConcurrentInvocations, "Number of concurrent invocations %v exceeds maximum %v",
                     concurrentInvocations,
                     maxConcurrentInvocations);
-                if (callbackIndex > maxConcurrentInvocations) {
-                    THROW_ERROR_EXCEPTION_UNLESS(finishedCallbacks > maxConcurrentInvocations, "%v-th callback was executed before first %v",
-                        callbackIndex + 1, maxConcurrentInvocations);
-                }
 
                 finishedCallbacks += 1;
             }).AsyncVia(invoker).Run());
@@ -187,7 +186,7 @@ TEST_P(TBoundedConcurrencyInvokerParametrizedReconfigureTest, SetMaxConcurrentIn
         firstFuture = firstPromise.ToFuture();
         secondFuture = secondPromise.ToFuture();
 
-        runnedCallbacks = 0;
+        ranCallbacks = 0;
         finishedCallbacks = 0;
     };
 
@@ -229,7 +228,7 @@ TEST_P(TBoundedConcurrencyInvokerParametrizedReconfigureTest, SetMaxConcurrentIn
 
     WaitFor(AllSucceeded(callbacks[0]))
         .ThrowOnError();
-    EXPECT_EQ(runnedCallbacks, 10);
+    EXPECT_EQ(ranCallbacks, 10);
     EXPECT_EQ(finishedCallbacks, 10);
 
     resetState();
@@ -258,7 +257,7 @@ TEST_P(TBoundedConcurrencyInvokerParametrizedReconfigureTest, SetMaxConcurrentIn
 
     WaitFor(AllSucceeded(callbacks[1]))
         .ThrowOnError();
-    EXPECT_EQ(runnedCallbacks, 10);
+    EXPECT_EQ(ranCallbacks, 10);
     EXPECT_EQ(finishedCallbacks, 10);
 }
 
```

---

### Incident Patch 13: `1c1a1c27` (2026-10-04)
**Commit Message**: YT-29486: Do not check DetailedMasterMemory on account removal
commit_hash:e3d434feddd757c31cb7fb0d82cfab43cf1ae16f

**File**: `yt/yt/server/master/security_server/account.cpp` (modified, +5/-1)
```diff
@@ -44,6 +44,11 @@ void TAccountStatistics::Persist(const NCellMaster::TPersistenceContext& context
     Persist(context, CommittedResourceUsage);
 }
 
+bool TAccountStatistics::IsPersistentlyEmpty() const
+{
+    return ResourceUsage.IsPersistentlyEmpty() && CommittedResourceUsage.IsPersistentlyEmpty();
+}
+
 void ToProto(NProto::TAccountStatistics* protoStatistics, const TAccountStatistics& statistics)
 {
     ToProto(protoStatistics->mutable_resource_usage(), statistics.ResourceUsage);
@@ -137,7 +142,6 @@ void SubtractFromAccountMulticellStatistics(
     }
 }
 
-
 TAccountMulticellStatistics AddAccountMulticellStatistics(
     const TAccountMulticellStatistics& lhs,
     const TAccountMulticellStatistics& rhs)
```

**File**: `yt/yt/server/master/security_server/account.h` (modified, +2/-0)
```diff
@@ -30,6 +30,8 @@ struct TAccountStatistics
 
     bool operator==(const TAccountStatistics&) const = default;
 
+    bool IsPersistentlyEmpty() const;
+
     static const TAccountStatistics Empty;
 };
 
```

**File**: `yt/yt/server/master/security_server/account_proxy.cpp` (modified, +2/-1)
```diff
@@ -145,7 +145,8 @@ class TAccountProxy
                 account->GetName());
         }
 
-        if (account->ClusterStatistics() != TAccountStatistics::Empty) {
+        // Master memory usage is eventually consistent and may be stale, so do not check it here.
+        if (!account->ClusterStatistics().IsPersistentlyEmpty()) {
             THROW_ERROR_EXCEPTION("Cannot remove account %Qv because its usage is not zero",
                 account->GetName())
                 .With("current_usage", ToString(account->ClusterStatistics()));
```

**File**: `yt/yt/server/master/security_server/cluster_resources.cpp` (modified, +14/-2)
```diff
@@ -115,8 +115,6 @@ i64 TClusterResources::GetTotalMasterMemory() const
     return DetailedMasterMemory_.GetTotal();
 }
 
-
-
 TClusterResources::TMediaDiskSpace TClusterResources::GetPatchedDiskSpace(
     const IChunkManagerPtr& chunkManager,
     const TCompactVector<int, 4>& additionalMediumIndexes) const
@@ -216,6 +214,20 @@ void TClusterResources::Load(NCypressServer::TMaterializeNodeContext& context)
     Load(context, DetailedMasterMemory_.DetailedMasterMemory());
 }
 
+bool TClusterResources::IsPersistentlyEmpty() const
+{
+    for (const auto& [_, mediumDiskSpace] : DiskSpace_) {
+        if (mediumDiskSpace > 0) {
+            return false;
+        }
+    }
+    return
+        NodeCount_ == 0 &&
+        ChunkCount_ == 0 &&
+        TabletCount_ == 0 &&
+        TabletStaticMemory_ == 0;
+}
+
 TClusterResources& TClusterResources::operator+=(const TClusterResources& other)
 {
     for (const auto& [mediumIndex, diskSpace] : other.DiskSpace()) {
```

**File**: `yt/yt/server/master/security_server/cluster_resources.h` (modified, +2/-0)
```diff
@@ -94,6 +94,8 @@ class TClusterResources
     void Save(NCypressServer::TSerializeNodeContext& context) const;
     void Load(NCypressServer::TMaterializeNodeContext& context);
 
+    bool IsPersistentlyEmpty() const;
+
 private:
     //! Space occupied on data nodes in bytes per medium.
     /*!
```

---

### Incident Patch 14: `714710b0` (2026-10-04)
**Commit Message**: Trivial: Fix style
commit_hash:727a8a754976550fa17239250698e93c6cae6099

**File**: `yt/yt/server/master/chaos_server/chaos_manager_cell_directory_synchronizer.cpp` (modified, +1/-1)
```diff
@@ -142,7 +142,7 @@ class TChaosManagerCellDirectorySynchronizer
     {
         YT_TLOG_DEBUG("Start chaos manager cell directory synchronizer iteration");
 
-        int previousIterationCellCount = cellDescriptorsMap->size();
+        int previousIterationCellCount = std::ssize(*cellDescriptorsMap);
         int incomingCellCount = -1;
 
         {
```

---

### Incident Patch 15: `4d046404` (2026-10-03)
**Commit Message**: Fix undefined double-to-integer casts in TJsonValue

`TJsonValue::IsInteger()` and `IsUInteger()` cast `double` values to integers before checking whether they were in range. For out-of-range values, these casts invoked undefined behavior. With Clang 22, this caused logfeller's `JsonFailIntCastTest` and `JsonFailUIntCastTest` to stop receiving the expected `TCastException`.

The fix checks the exact bounds before casting. It accepts integral values within range and rejects out-of-range values, fractions, NaN, and infinities. Boundary tests cover both predicates and their corresponding getters, using type limits and adjacent representable `double` values.

Validation:
- The new boundary tests fail with Clang 22 before the fix and pass afterward.
- Clang 22: JSON writer and `logfeller/lib/parsing/support` tests pass (97/97).
- Clang 20: JSON writer tests pass (46/46).
- Clang 22 with UBSan and `float-cast-overflow`: boundary tests pass (2/2).
- `ya style --check --smart-staged` passes.
commit_hash:0025e7e3840cdd5ff2f7e58fd9c925c0ddc36254

**File**: `library/cpp/json/writer/json_value.cpp` (modified, +6/-2)
```diff
@@ -776,7 +776,9 @@ namespace NJson {
             case JSON_UINTEGER:
                 return (Value.UInteger <= static_cast<unsigned long long>(Max<long long>()));
             case JSON_DOUBLE:
-                return ((long long)Value.Double == Value.Double);
+                return Value.Double >= static_cast<double>(Min<long long>()) &&
+                       Value.Double < static_cast<double>(Max<long long>()) &&
+                       static_cast<long long>(Value.Double) == Value.Double;
             default:
                 return false;
         }
@@ -789,7 +791,9 @@ namespace NJson {
             case JSON_INTEGER:
                 return (Value.Integer >= 0);
             case JSON_DOUBLE:
-                return ((unsigned long long)Value.Double == Value.Double);
+                return Value.Double >= 0 &&
+                       Value.Double < static_cast<double>(Max<unsigned long long>()) &&
+                       static_cast<unsigned long long>(Value.Double) == Value.Double;
             default:
                 return false;
         }
```

**File**: `library/cpp/json/writer/json_value_ut.cpp` (modified, +45/-0)
```diff
@@ -4,9 +4,54 @@
 
 #include <util/stream/input.h>
 
+#include <cmath>
+#include <limits>
+
 using namespace NJson;
 
 Y_UNIT_TEST_SUITE(TJsonValueTest) {
+    Y_UNIT_TEST(DoubleIntegerBoundaries) {
+        const double min = static_cast<double>(std::numeric_limits<long long>::min());
+        const double max = static_cast<double>(std::numeric_limits<long long>::max());
+        for (double value : {min, std::nextafter(min, 0.0),
+                             std::nextafter(max, 0.0), -1.0, -0.0, 0.0, 1.0}) {
+            const TJsonValue json(value);
+            UNIT_ASSERT(json.IsInteger());
+            UNIT_ASSERT_VALUES_EQUAL(json.GetIntegerSafe(), static_cast<long long>(value));
+        }
+        for (double value : {std::nextafter(min, -std::numeric_limits<double>::infinity()),
+                             max, std::nextafter(max, std::numeric_limits<double>::infinity()),
+                             -0.5, 0.5,
+                             std::numeric_limits<double>::lowest(), std::numeric_limits<double>::max(),
+                             -std::numeric_limits<double>::infinity(), std::numeric_limits<double>::infinity(),
+                             std::numeric_limits<double>::quiet_NaN()}) {
+            const TJsonValue json(value);
+            UNIT_ASSERT(!json.IsInteger());
+            UNIT_ASSERT_VALUES_EQUAL(json.GetInteger(), 0);
+            UNIT_ASSERT_EXCEPTION(json.GetIntegerSafe(), TJsonException);
+        }
+    }
+
+    Y_UNIT_TEST(DoubleUIntegerBoundaries) {
+        const double max = static_cast<double>(std::numeric_limits<unsigned long long>::max());
+        const double signedMax = static_cast<double>(std::numeric_limits<long long>::max());
+        for (double value : {-0.0, 0.0, 1.0, signedMax, std::nextafter(max, 0.0)}) {
+            const TJsonValue json(value);
+            UNIT_ASSERT(json.IsUInteger());
+            UNIT_ASSERT_VALUES_EQUAL(json.GetUIntegerSafe(), static_cast<unsigned long long>(value));
+        }
+        for (double value : {-1.0, -0.5, std::nextafter(0.0, -1.0), std::nextafter(0.0, 1.0), 0.5,
+                             max, std::nextafter(max, std::numeric_limits<double>::infinity()),
+                             std::numeric_limits<double>::lowest(), std::numeric_limits<double>::max(),
+                             -std::numeric_limits<double>::infinity(), std::numeric_limits<double>::infinity(),
+                             std::numeric_limits<double>::quiet_NaN()}) {
+            const TJsonValue json(value);
+            UNIT_ASSERT(!json.IsUInteger());
+            UNIT_ASSERT_VALUES_EQUAL(json.GetUInteger(), 0);
+            UNIT_ASSERT_EXCEPTION(json.GetUIntegerSafe(), TJsonException);
+        }
+    }
+
     Y_UNIT_TEST(Equal) {
         UNIT_ASSERT(1 == TJsonValue(1));
         UNIT_ASSERT(TJsonValue(1) == 1);
```

#### Recent Merged Pull Requests:
- **PR #1860** (closed): feat(CHYT): describe clique creation options [CHYT-1471] (@sesho96)
- **PR #1858** (closed): Fix links to images after the directory with them has been moved (@andrey-khropov)
- **PR #1852** (closed): Dump args count for builtin functions. (@Tony-Romanov)
- **PR #1848** (closed): YQL-21471: Release YQL Language Server for Unix (@vityaman)
- **PR #1840** (closed): [docs] Update Release Notes (@ytsaurus-actions[bot])
- **PR #1839** (closed): Validate DQ settings and add more logs. (@Tony-Romanov)
- **PR #1838** (closed): [docs] Update Release Notes (@ytsaurus-actions[bot])
- **PR #1837** (closed): [docs] Update Release Notes (@ytsaurus-actions[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

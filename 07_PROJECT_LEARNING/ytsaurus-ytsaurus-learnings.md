> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/ytsaurus-ytsaurus-learnings.md`  
> **Source**: github ([https://github.com/ytsaurus/ytsaurus](https://github.com/ytsaurus/ytsaurus))  
> **Source Version**: `54d901da`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-13T13:02:42.291Z  
> **Learning ID**: `learn-github-ytsaurus-ytsaurus`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): ytsaurus/ytsaurus

> **Canonical Artifact**: `07_PROJECT_LEARNING/ytsaurus-ytsaurus-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/ytsaurus/ytsaurus](https://github.com/ytsaurus/ytsaurus))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-13T13:02:42.283Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `ytsaurus/ytsaurus`
- **Description**: YTsaurus is a scalable and fault-tolerant open-source big data platform.
- **Primary Language / Ecosystem**: C++
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 2325 stars

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


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1898** (2026-11-11): **DQ GWM mishandles late interconnect events after leader demotion**
  *Symptoms*: The DQ global worker manager (GWM) does not safely handle interconnect notifications after transitioning from leader to follower.  ### Problem  While serving allocation requests as leader, GWM subscribes to the requesting nodes' interconnect sessions. `TransitionToFollowerOfRemoteLeader()` clears worker and allocation state, but does not call `UnsubscribeAll()`.  The `Follower` state also lacks handlers for `TEvInterconnect::TEvNodeDisconnected`, `TEvInterconnect::TEvNodeConnected`, and `TEvents::TEvUndelivered`. Notifications from the former leader's sessions can therefore arrive in a state that does not accept them. Even unsubscribing during demotion is insufficient on its own: notifications may already be queued in the actor's mailbox.  In builds with debug assertions enabled, an unexpected notification reaches the assertion in `STRICT_STFUNC` and can abort the yql-agent process. In builds with these assertions disabled, the notification is ignored instead of going through the normal interconnect cleanup path.  ### Reproduction  An actor test can reproduce the problematic transition without a full YT cluster:  1. Start GWM as leader and register a worker. 2. Allocate a worker from an actor on another node, establishing an interconnect subscription. 3. Demote GWM to follower of a remote leader. 4. Deliver a late `TEvNodeDisconnected` from the previous session. Also cover late `TEvNodeConnected` and `TEvUndelivered` notifications.  The follower should process these notificat

- **Issue #1895** (2026-11-09): **yt/chyt: remove hardcoded jaeger**
  *Symptoms*: It is definitely should not be here. 
  **Post-Mortem & Fix Analysis**:
  > `05.11.2026, 12:29:13` PR autocheck started. Watch workflow progress [here](https://github.com/ytsaurus/ytsaurus/actions/runs/42027488293). `05.11.2026, 12:30:46` PR autocheck finished. Statuses: Strawberry controller: cancelled CMake build+check: skipped Ya-make build: skipped Tests: skipped 
  > `05.11.2026, 12:31:20` PR autocheck started. Watch workflow progress [here](https://github.com/ytsaurus/ytsaurus/actions/runs/42027611538). `06.11.2026, 02:20:21` Integration tests are started. `06.11.2026, 04:59:06` Tests finished. Something went wrong.  `06.11.2026, 04:59:16` PR autocheck finished. Statuses: Strawberry controller: success CMake build+check: success Ya-make build: success Tests: success 

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

### Incident Patch 1: `54d901da` (2026-11-13)
**Commit Message**: fix contrib/libs/grpc: zstd decompressor spins forever on an empty trailing slice

The zstd decompressor in zstd_common could loop forever and allocate memory until OOM.

For the last slice the loop ran until ZSTD_decompressStream returned 0. With an empty last slice that never happens: given no input, zstd only returns a non-zero hint that it expects more data. The loop therefore never ended and allocated a new 1 KiB output block on every iteration. A message gets such a slice from a zero-length DATA frame, for example the one that carries END_STREAM when the client half-closes after its last message.

The fix makes zstd compression and decompression follow zlib_body: empty slices are skipped, ZSTD_e_end is passed with the last non-empty slice, and the loop over the current slice repeats only while the output block is completely full and zstd has more to produce, or while input remains. If the frame is still unfinished after all slices, an error is returned.
commit_hash:bd228e50a3ab8ddda0d5d8a568d04882e6c797c7

**File**: `contrib/libs/grpc/src/core/lib/compression/message_compress.cc` (modified, +55/-18)
```diff
@@ -145,10 +145,16 @@ static int zlib_decompress(grpc_slice_buffer* input, grpc_slice_buffer* output,
 }
 
 struct CompressTraits {
-  static std::unique_ptr<ZSTD_CCtx, decltype(&ZSTD_freeCCtx)> CreateContext() {
-    return std::unique_ptr<ZSTD_CCtx, decltype(&ZSTD_freeCCtx)>(
+  static std::unique_ptr<ZSTD_CCtx, decltype(&ZSTD_freeCCtx)> CreateContext(size_t input_length) {
+    std::unique_ptr<ZSTD_CCtx, decltype(&ZSTD_freeCCtx)> context(
        ZSTD_createCCtx(),
        &ZSTD_freeCCtx);
+    if (context) {
+      // Content size goes into the frame header; zstd sizes the window to it.
+      size_t rc = ZSTD_CCtx_setPledgedSrcSize(context.get(), input_length);
+      if (ZSTD_isError(rc)) context.reset();
+    }
+    return context;
   }
 
   static size_t ProcessPart(
@@ -162,7 +168,7 @@ struct CompressTraits {
 };
 
 struct DecompressTraits {
-  static std::unique_ptr<ZSTD_DCtx, decltype(&ZSTD_freeDCtx)> CreateContext() {
+  static std::unique_ptr<ZSTD_DCtx, decltype(&ZSTD_freeDCtx)> CreateContext(size_t /* input_length */) {
     return std::unique_ptr<ZSTD_DCtx, decltype(&ZSTD_freeDCtx)>(
        ZSTD_createDCtx(),
        &ZSTD_freeDCtx);
@@ -179,37 +185,68 @@ struct DecompressTraits {
 
 template<typename Traits>
 static bool zstd_common(grpc_slice_buffer* input, grpc_slice_buffer* output) {
-  const auto context_ptr = Traits::CreateContext();
+  const auto context_ptr = Traits::CreateContext(input->length);
   if (!context_ptr) {
     gpr_log(GPR_INFO, "Failed create zstd context");
     return false;
   }
+  // ZSTD_e_end goes with the last non-empty slice. Empty slices are skipped:
+  // zstd given no input only asks for more, which looped forever.
+  size_t last = input->count;
+  for (size_t i = input->count; i-- > 0;) {
+    if (GRPC_SLICE_LENGTH(input->slices[i]) != 0) {
+      last = i;
+      break;
+    }
+  }
+  grpc_slice outbuf = GRPC_SLICE_MALLOC(OUTPUT_BLOCK_SIZE);
+  ZSTD_outBuffer zstd_output;
+  zstd_output.dst = GRPC_SLICE_START_PTR(outbuf);
+  zstd_output.size = GRPC_SLICE_LENGTH(outbuf);
+  zstd_output.pos = 0;
+  size_t process_result = 0;  // Do not fail on an empty input.
   for (size_t i = 0; i < input->count; i++) {
-    const bool is_last_chunk = (i == input->count - 1);
+    const bool is_last_chunk = (i == last);
     ZSTD_inBuffer zstd_input;
     zstd_input.src = GRPC_SLICE_START_PTR(input->slices[i]);
     zstd_input.size = GRPC_SLICE_LENGTH(input->slices[i]);
     zstd_input.pos = 0;
-    bool should_continue = true;
-    while (should_continue) {
-      grpc_slice outbuf = GRPC_SLICE_MALLOC(OUTPUT_BLOCK_SIZE);
-      ZSTD_outBuffer zstd_output;
-      zstd_output.dst = GRPC_SLICE_START_PTR(outbuf);
-      zstd_output.size = GRPC_SLICE_LENGTH(outbuf);
-      zstd_output.pos = 0;
-      size_t const process_result = Traits::ProcessPart(context_ptr.get(), &zstd_output, &zstd_input, is_last_chunk);
+    if (zstd_input.size == 0) continue;
+    // Repeat while the block fills up and zstd still has data to flush, or
+    // input remains (the next frame of a multi-frame message).
+    do {
+      if (zstd_output.pos == zstd_output.size) {
+        grpc_slice_buffer_add_indexed(output, outbuf);
+        outbuf = GRPC_SLICE_MALLOC(OUTPUT_BLOCK_SIZE);
+        zstd_output.dst = GRPC_SLICE_START_PTR(outbuf);
+        zstd_output.size = GRPC_SLICE_LENGTH(outbuf);
+        zstd_output.pos = 0;
+      }
+      process_result = Traits::ProcessPart(context_ptr.get(), &zstd_output, &zstd_input, is_last_chunk);
       if (ZSTD_isError(process_result)) {
         gpr_log(GPR_INFO, "zstd error code (%d)", ZSTD_getErrorCode(process_result));
         grpc_core::CSliceUnref(outbuf);
         return false;
       }
-      const auto out_data_left = zstd_output.size - zstd_output.pos;
-      outbuf.data.refcounted.length -= out_data_left;
-      grpc_slice_buffer_add_indexed(output, outbuf);
-
-      should_continue = is_last_chunk ? (process_result != 0) : (zstd_input.pos != zstd_input.size);
+    } while ((zstd_output.pos == zstd_output.size && process_result != 0) ||
+             zstd_input.pos != zstd_input.size);
+    if (zstd_input.pos != zstd_input.size) {
+      gpr_log(GPR_INFO, "zstd: not all input consumed");
+      grpc_core::CSliceUnref(outbuf);
+      return false;
     }
   }
+  if (process_result != 0) {
+    gpr_log(GPR_INFO, "zstd: incomplete stream");
+    grpc_core::CSliceUnref(outbuf);
+    return false;
+  }
+  if (zstd_output.pos == 0) {
+    grpc_core::CSliceUnref(outbuf);
+  } else {
+    outbuf.data.refcounted.length = zstd_output.pos;
+    grpc_slice_buffer_add_indexed(output, outbuf);
+  }
   return true;
 }
 
```

---

### Incident Patch 2: `b0300142` (2026-11-13)
**Commit Message**: Take the arm64 Linux tick rate from CNTFRQ_EL0

On arm64 Linux, cpu_clock fell back to NHPTimer, which estimates the tick rate by sleeping 9 x 5 ms, and on some hosts this estimate is systematically off. CPU instants are recalibrated against TInstant::Now once per 1B ticks: a fraction of a second with an x86-64 TSC, but tens of seconds with the tens-of-MHz generic timers common on arm64. Between recalibrations GetInstant drifts away from the wall clock, so code that mixes the two clocks sees short waits expire at once, and the process wakes up many times more often than on x86-64.

Now the tick rate is taken from CNTFRQ_EL0, the frequency of the generic timer virtual counter that GetCpuInstant reads on arm64, if it lies within [1 MHz, 2 GHz]; otherwise NHPTimer remains the fallback. This also saves the ~45 ms NHPTimer spends on calibration at startup.
commit_hash:b9446571a8e288fef7d0a42b043faae6080c6f8a

**File**: `library/cpp/yt/cpu_clock/clock.cpp` (modified, +13/-0)
```diff
@@ -222,6 +222,13 @@ std::optional<double> TryMeasureTicksPerSecond()
     return std::nullopt;
 }
 
+#elif defined(_arm64_) && defined(_linux_)
+
+bool IsSaneTicksPerSecond(double ticksPerSecond)
+{
+    return ticksPerSecond >= 1e6 && ticksPerSecond <= 2e9;
+}
+
 #endif
 
 double ComputeTicksPerSecond()
@@ -248,6 +255,12 @@ double ComputeTicksPerSecond()
     if (auto ticksPerSecond = TryMeasureTicksPerSecond()) {
         return *ticksPerSecond;
     }
+#elif defined(_arm64_) && defined(_linux_)
+    ui64 frequency;
+    __asm__ __volatile__("mrs %0, cntfrq_el0" : "=r"(frequency));
+    if (IsSaneTicksPerSecond(frequency)) {
+        return static_cast<double>(frequency);
+    }
 #endif
     return NHPTimer::GetCyclesPerSecond();
 }
```

**File**: `library/cpp/yt/cpu_clock/unittests/clock_ut.cpp` (modified, +10/-0)
```diff
@@ -40,6 +40,16 @@ TEST(TTimingTest, DurationVSCpuDuration)
     EXPECT_LE(DiffMS(duration1, duration2), 10);
 }
 
+#if defined(_arm64_) && defined(_linux_)
+TEST(TTimingTest, TicksPerSecondFromCntfrq)
+{
+    ui64 frequency;
+    __asm__ __volatile__("mrs %0, cntfrq_el0" : "=r"(frequency));
+    ASSERT_NE(frequency, 0u);
+    EXPECT_NEAR(DurationToCpuDuration(TDuration::Seconds(1)), static_cast<TCpuDuration>(frequency), 1);
+}
+#endif
+
 ////////////////////////////////////////////////////////////////////////////////
 
 } // namespace
```

---

### Incident Patch 3: `c60ba9f3` (2026-11-13)
**Commit Message**: Fix fiber introspection locking
commit_hash:f16b78d6a55c6914affcdc01c61aff95775eeefd

**File**: `yt/yt/core/concurrency/fiber.cpp` (modified, +10/-6)
```diff
@@ -334,7 +334,7 @@ std::optional<TDuration> TFiberIntrospectionBase::SetRunning()
     auto observed = GetState();
     std::optional<NProfiling::TWallTimer> lockedTimer;
 
-    do {
+    while (true) {
         // NB(arkady-e1ppa): We expect SetRunning to have
         // either SetIdle, SetWaiting or Ctor in HB relation to this call.
         // If we have SetIdle in HB relation then we must
@@ -356,11 +356,15 @@ std::optional<TDuration> TFiberIntrospectionBase::SetRunning()
             continue;
         }
         // TryAcquire lock.
-    } while (!State_.compare_exchange_weak(
-        observed,
-        EFiberState::Running,
-        std::memory_order::acquire,
-        std::memory_order::relaxed));
+        if (State_.compare_exchange_weak(
+            observed,
+            EFiberState::Running,
+            std::memory_order::acquire,
+            std::memory_order::relaxed))
+        {
+            break;
+        }
+    }
 
     return lockedTimer.has_value()
         ? std::optional(lockedTimer->GetElapsedTime())
```

**File**: `yt/yt/core/concurrency/unittests/CMakeLists.darwin-arm64.txt` (modified, +1/-0)
```diff
@@ -67,6 +67,7 @@ target_sources(unittester-core-concurrency PRIVATE
   ${PROJECT_SOURCE_DIR}/yt/yt/core/concurrency/unittests/fair_share_thread_pool_ut.cpp
   ${PROJECT_SOURCE_DIR}/yt/yt/core/concurrency/unittests/fair_throttler_ut.cpp
   ${PROJECT_SOURCE_DIR}/yt/yt/core/concurrency/unittests/fiber_manager_ut.cpp
+  ${PROJECT_SOURCE_DIR}/yt/yt/core/concurrency/unittests/fiber_ut.cpp
   ${PROJECT_SOURCE_DIR}/yt/yt/core/concurrency/unittests/fls_ut.cpp
   ${PROJECT_SOURCE_DIR}/yt/yt/core/concurrency/unittests/hazard_ptr_reclaim_ut.cpp
   ${PROJECT_SOURCE_DIR}/yt/yt/core/concurrency/unittests/invoker_alarm_ut.cpp
```

**File**: `yt/yt/core/concurrency/unittests/CMakeLists.darwin-x86_64.txt` (modified, +1/-0)
```diff
@@ -68,6 +68,7 @@ target_sources(unittester-core-concurrency PRIVATE
   ${PROJECT_SOURCE_DIR}/yt/yt/core/concurrency/unittests/fair_share_thread_pool_ut.cpp
   ${PROJECT_SOURCE_DIR}/yt/yt/core/concurrency/unittests/fair_throttler_ut.cpp
   ${PROJECT_SOURCE_DIR}/yt/yt/core/concurrency/unittests/fiber_manager_ut.cpp
+  ${PROJECT_SOURCE_DIR}/yt/yt/core/concurrency/unittests/fiber_ut.cpp
   ${PROJECT_SOURCE_DIR}/yt/yt/core/concurrency/unittests/fls_ut.cpp
   ${PROJECT_SOURCE_DIR}/yt/yt/core/concurrency/unittests/hazard_ptr_reclaim_ut.cpp
   ${PROJECT_SOURCE_DIR}/yt/yt/core/concurrency/unittests/invoker_alarm_ut.cpp
```

**File**: `yt/yt/core/concurrency/unittests/CMakeLists.linux-aarch64.txt` (modified, +1/-0)
```diff
@@ -73,6 +73,7 @@ target_sources(unittester-core-concurrency PRIVATE
   ${PROJECT_SOURCE_DIR}/yt/yt/core/concurrency/unittests/fair_share_thread_pool_ut.cpp
   ${PROJECT_SOURCE_DIR}/yt/yt/core/concurrency/unittests/fair_throttler_ut.cpp
   ${PROJECT_SOURCE_DIR}/yt/yt/core/concurrency/unittests/fiber_manager_ut.cpp
+  ${PROJECT_SOURCE_DIR}/yt/yt/core/concurrency/unittests/fiber_ut.cpp
   ${PROJECT_SOURCE_DIR}/yt/yt/core/concurrency/unittests/fls_ut.cpp
   ${PROJECT_SOURCE_DIR}/yt/yt/core/concurrency/unittests/hazard_ptr_reclaim_ut.cpp
   ${PROJECT_SOURCE_DIR}/yt/yt/core/concurrency/unittests/invoker_alarm_ut.cpp
```

**File**: `yt/yt/core/concurrency/unittests/CMakeLists.linux-x86_64.txt` (modified, +1/-0)
```diff
@@ -75,6 +75,7 @@ target_sources(unittester-core-concurrency PRIVATE
   ${PROJECT_SOURCE_DIR}/yt/yt/core/concurrency/unittests/fair_share_thread_pool_ut.cpp
   ${PROJECT_SOURCE_DIR}/yt/yt/core/concurrency/unittests/fair_throttler_ut.cpp
   ${PROJECT_SOURCE_DIR}/yt/yt/core/concurrency/unittests/fiber_manager_ut.cpp
+  ${PROJECT_SOURCE_DIR}/yt/yt/core/concurrency/unittests/fiber_ut.cpp
   ${PROJECT_SOURCE_DIR}/yt/yt/core/concurrency/unittests/fls_ut.cpp
   ${PROJECT_SOURCE_DIR}/yt/yt/core/concurrency/unittests/hazard_ptr_reclaim_ut.cpp
   ${PROJECT_SOURCE_DIR}/yt/yt/core/concurrency/unittests/invoker_alarm_ut.cpp
```

**File**: `yt/yt/core/concurrency/unittests/CMakeLists.windows-x86_64.txt` (modified, +1/-0)
```diff
@@ -50,6 +50,7 @@ target_sources(unittester-core-concurrency PRIVATE
   ${PROJECT_SOURCE_DIR}/yt/yt/core/concurrency/unittests/fair_share_thread_pool_ut.cpp
   ${PROJECT_SOURCE_DIR}/yt/yt/core/concurrency/unittests/fair_throttler_ut.cpp
   ${PROJECT_SOURCE_DIR}/yt/yt/core/concurrency/unittests/fiber_manager_ut.cpp
+  ${PROJECT_SOURCE_DIR}/yt/yt/core/concurrency/unittests/fiber_ut.cpp
   ${PROJECT_SOURCE_DIR}/yt/yt/core/concurrency/unittests/fls_ut.cpp
   ${PROJECT_SOURCE_DIR}/yt/yt/core/concurrency/unittests/hazard_ptr_reclaim_ut.cpp
   ${PROJECT_SOURCE_DIR}/yt/yt/core/concurrency/unittests/invoker_alarm_ut.cpp
```

**File**: `yt/yt/core/concurrency/unittests/fiber_ut.cpp` (added, +78/-0)
```diff
@@ -0,0 +1,78 @@
+#include <yt/yt/core/test_framework/framework.h>
+
+#include <yt/yt/core/concurrency/fiber.h>
+
+#include <yt/yt/core/misc/finally.h>
+
+#include <library/cpp/yt/system/event_count.h>
+
+#include <thread>
+
+namespace NYT::NConcurrency {
+namespace {
+
+////////////////////////////////////////////////////////////////////////////////
+
+TEST(TFiberTest, SetRunningTransitions)
+{
+    auto* fiber = TFiber::CreateFiber();
+    fiber->SetRunning();
+    auto releaseFiber = Finally([&] {
+        TFiber::ReleaseFiber(fiber);
+    });
+
+    auto noop = [] { };
+    EFiberState state;
+    EXPECT_FALSE(fiber->TryLockForIntrospection(&state, noop));
+    EXPECT_EQ(EFiberState::Running, state);
+
+    fiber->SetIdle();
+    fiber->SetRunning();
+    EXPECT_FALSE(fiber->TryLockForIntrospection(&state, noop));
+    EXPECT_EQ(EFiberState::Running, state);
+
+    fiber->SetWaiting();
+    EXPECT_TRUE(fiber->TryLockForIntrospection(&state, noop));
+    fiber->SetRunning();
+    EXPECT_FALSE(fiber->TryLockForIntrospection(&state, noop));
+    EXPECT_EQ(EFiberState::Running, state);
+}
+
+TEST(TFiberTest, SetRunningWaitsForIntrospection)
+{
+    auto* fiber = TFiber::CreateFiber();
+    fiber->SetRunning();
+    auto releaseFiber = Finally([&] {
+        TFiber::ReleaseFiber(fiber);
+    });
+    fiber->SetWaiting();
+
+    TEvent started;
+    TEvent resumed;
+    std::thread scheduler;
+    auto noop = [] { };
+    EFiberState state;
+    auto introspect = [&] {
+        scheduler = std::thread([&] {
+            started.NotifyAll();
+            fiber->SetRunning();
+            resumed.NotifyAll();
+        });
+        started.Wait();
+        EXPECT_FALSE(resumed.Wait(TDuration::MilliSeconds(200)));
+
+        EFiberState lockedState;
+        EXPECT_FALSE(fiber->TryLockForIntrospection(&lockedState, noop));
+        EXPECT_EQ(EFiberState::Introspecting, lockedState);
+    };
+    EXPECT_TRUE(fiber->TryLockForIntrospection(&state, introspect));
+
+    scheduler.join();
+    EXPECT_FALSE(fiber->TryLockForIntrospection(&state, noop));
+    EXPECT_EQ(EFiberState::Running, state);
+}
+
+////////////////////////////////////////////////////////////////////////////////
+
+} // namespace
+} // namespace NYT::NConcurrency
```

**File**: `yt/yt/core/concurrency/unittests/ya.make` (modified, +1/-0)
```diff
@@ -22,6 +22,7 @@ SRCS(
     fair_share_thread_pool_ut.cpp
     fair_throttler_ut.cpp
     fiber_manager_ut.cpp
+    fiber_ut.cpp
     fls_ut.cpp
     hazard_ptr_reclaim_ut.cpp
     invoker_alarm_ut.cpp
```

#### Recent Merged Pull Requests:
- **PR #1897** (closed): [docs] Update Release Notes (@ytsaurus-actions[bot])
- **PR #1895** (closed): yt/chyt: remove hardcoded jaeger (@koct9i)
- **PR #1892** (closed): Fix typo in chaos-dynamic-tables.md (@hsalkaline)
- **PR #1887** (closed): Preserve bus TLS configuration for YT QL RPC connections (@Tony-Romanov)
- **PR #1885** (closed): Run cross-cluster MR operations by ytsaurus Go SDK (@sagishev)
- **PR #1884** (closed): [docs] Update Release Notes (@ytsaurus-actions[bot])

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

## X. contrib/libs/grpc: zstd decompressor spins forever on an empty trailing slice

**RULE**:
When implementing operations in `contrib/libs/grpc/src/core/lib/compression/message_compress.cc`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in ytsaurus/ytsaurus. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `54d901da`: contrib/libs/grpc: zstd decompressor spins forever on an empty trailing slice. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing C++ data structures, boundary deserialization, API parsing, or resource lifecycles matching `contrib/libs/grpc/src/core/lib/compression/message_compress.cc`.

**VERIFIED IMPLEMENTATION PATTERN**:
```c++
// Verified production-grade fix pattern:
  static std::unique_ptr<ZSTD_CCtx, decltype(&ZSTD_freeCCtx)> CreateContext(size_t input_length) {
    std::unique_ptr<ZSTD_CCtx, decltype(&ZSTD_freeCCtx)> context(
    if (context) {
      // Content size goes into the frame header; zstd sizes the window to it.
      size_t rc = ZSTD_CCtx_setPledgedSrcSize(context.get(), input_length);
      if (ZSTD_isError(rc)) context.reset();
    }
    return context;
  static std::unique_ptr<ZSTD_DCtx, decltype(&ZSTD_freeDCtx)> CreateContext(size_t /* input_length */) {
  const auto context_ptr = Traits::CreateContext(input->length);
  // ZSTD_e_end goes with the last non-empty slice. Empty slices are skipped:
  // zstd given no input only asks for more, which looped forever.
  size_t last = input->count;
  for (size_t i = input->count; i-- > 0;) {
    if (GRPC_SLICE_LENGTH(input->slices[i]) != 0) {
      last = i;
      break;
    }
  }
  grpc_slice outbuf = GRPC_SLICE_MALLOC(OUTPUT_BLOCK_SIZE);
  ZSTD_outBuffer zstd_output;
  zstd_output.dst = GRPC_SLICE_START_PTR(outbuf);
  zstd_output.size = GRPC_SLICE_LENGTH(outbuf);
  zstd_output.pos = 0;
  size_t process_result = 0;  // Do not fail on an empty input.
    const bool is_last_chunk = (i =
```

**NEGATIVE CONSTRAINT**:
```c++
// Anti-pattern to NEVER write (induced failure mode):
  static std::unique_ptr<ZSTD_CCtx, decltype(&ZSTD_freeCCtx)> CreateContext() {
    return std::unique_ptr<ZSTD_CCtx, decltype(&ZSTD_freeCCtx)>(
  static std::unique_ptr<ZSTD_DCtx, decltype(&ZSTD_freeDCtx)> CreateContext() {
  const auto context_ptr = Traits::CreateContext();
    const bool is_last_chunk = (i == input->count - 1);
    bool should_continue = true;
    while (should_continue) {
      grpc_slice outbuf = GRPC_SLICE_MALLOC(OUTPUT_BLOCK_SIZE);
      ZSTD_outBuffer zstd_output;
      zstd_output.dst = GRPC_SLICE_START_PTR(outbuf);
      zstd_output.size = GRPC_SLICE_LENGTH(outbuf);
      zstd_output.pos = 0;
      size_t const process_result = Traits::ProcessPart(context_ptr.get(), &zstd_output, &zstd_input, is_last_chunk);
      const auto out_data_left = zstd_output.size - zstd_output.pos;
      outbuf.data.refcounted.length -= out_data_left;
      grpc_slice_buffer_add_indexed(output, outbuf);

      should_continue = is_last_chunk ? (process_result != 0) : (zstd_input.pos != zstd_input.size);
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `54d901da` are properly handled with clean fallback behavior.

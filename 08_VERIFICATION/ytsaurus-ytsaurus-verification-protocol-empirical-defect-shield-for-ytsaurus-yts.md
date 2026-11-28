# Verification Protocol: Verification Protocol: Empirical Defect Shield for ytsaurus/ytsaurus

<!-- PROVENANCE_START
{
  "source_repository": "ytsaurus/ytsaurus",
  "source_url": "https://github.com/ytsaurus/ytsaurus",
  "source_version": "a0a5c188",
  "license": "Apache-2.0",
  "timestamp": "2026-11-28T01:35:40.284Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-ytsaurus-ytsaurus",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [ytsaurus/ytsaurus](https://github.com/ytsaurus/ytsaurus) (Revision: `a0a5c188`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-28T01:35:40.284Z`  
> **Learning ID**: `learn-github-ytsaurus-ytsaurus`


## 1. Scope & Verification Target
- **Target Repository**: `ytsaurus/ytsaurus` (Commit: `a0a5c188`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
# Forensic Learning Record (Deep Inspection): ytsaurus/ytsaurus

> **Canonical Artifact**: `07_PROJECT_LEARNING/ytsaurus-ytsaurus-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/ytsaurus/ytsaurus](https://github.com/ytsaurus/ytsaurus))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-28T01:35:38.796Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `ytsaurus/ytsaurus`
- **Description**: YTsaurus is a scalable and fault-tolerant open-source big data platform.
- **Primary Language / Ecosystem**: C++
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 2328 stars

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

### Incident Patch 1: `0a66f47a` (2026-11-27)
**Commit Message**: [yt/java] Fix HttpClient selector thread leak

Fixes #1845.

Close the HTTP client used for proxy discovery together with `ClientPoolService`.

On Java 21 and newer, the client is closed explicitly. On Java 11–20, the strong reference to the internal HTTP client facade is released, allowing the selector thread to terminate after garbage collection.

Tested on Java 17 and Java 21.

* Changelog entry
Type: fix
Component: java-sdk

Closing `YTsaurusClient` no longer leaks the HTTP proxy discovery thread.

---

Pull Request resolved: https://github.com/ytsaurus/ytsaurus/pull/1847

Co-authored-by: tinarsky <[REDACTED_EMAIL]>
commit_hash:5fb759514704d0d9a3283c8897a667a5611227a1

**File**: `yt/java/ytsaurus-client/src/main/java/tech/ytsaurus/client/ClientPool.java` (modified, +33/-4)
```diff
@@ -29,6 +29,7 @@
 import java.util.concurrent.TimeUnit;
 import java.util.concurrent.TimeoutException;
 import java.util.concurrent.atomic.AtomicInteger;
+import java.util.concurrent.atomic.AtomicReference;
 import java.util.function.Predicate;
 import java.util.stream.Collectors;
 
@@ -292,10 +293,12 @@ private ClientPoolService(HttpBuilder httpBuilder) {
         }
         HttpClient httpClient = httpClientBuilder.build();
 
-        proxyGetter = new HttpProxyGetter(
+        HttpProxyGetter httpProxyGetter = new HttpProxyGetter(
                 httpClient,
                 httpBuilder
         );
+        proxyGetter = httpProxyGetter;
+        toClose.add(httpProxyGetter);
 
         executorService = httpBuilder.eventLoop;
         updatePeriodMs = httpBuilder.options.getProxyUpdateTimeout().toMillis();
@@ -946,7 +949,7 @@ interface ProxyGetter {
 
 @NonNullApi
 @NonNullFields
-class HttpProxyGetter implements ProxyGetter {
+class HttpProxyGetter implements ProxyGetter, AutoCloseable {
     private static final int HTTP_PROXY_PORT = 80;
     private static final int HTTPS_PROXY_PORT = 443;
 
@@ -956,7 +959,7 @@ class HttpProxyGetter implements ProxyGetter {
     private static final String HTTP_SCHEME = "http";
     private static final String HTTPS_SCHEME = "https";
 
-    private final HttpClient httpClient;
+    private final AtomicReference<HttpClient> httpClientRef;
     private final String balancerFqdn;
     private final Duration discoverProxiesTimeout;
     @Nullable
@@ -972,7 +975,7 @@ class HttpProxyGetter implements ProxyGetter {
     String proxyNetworkName;
 
     HttpProxyGetter(HttpClient httpClient, ClientPoolService.HttpBuilder httpBuilder) {
-        this.httpClient = httpClient;
+        this.httpClientRef = new AtomicReference<>(httpClient);
         this.balancerFqdn = Objects.requireNonNull(httpBuilder.balancerFqdn);
         this.balancerPort = httpBuilder.balancerPort;
         this.discoverProxiesTimeout = Objects.requireNonNull(httpBuilder.options).getProxyUpdateTimeout();
@@ -986,6 +989,11 @@ class HttpProxyGetter implements ProxyGetter {
 
     @Override
     public CompletableFuture<List<HostPort>> getProxies() {
+        HttpClient httpClient = httpClientRef.get();
+        if (httpClient == null) {
+            return CompletableFuture.failedFuture(new IllegalStateException("HTTP proxy getter is closed"));
+        }
+
         var discoverProxiesUrl = String.format(
                 "%s://%s/api/v4/discover_proxies?type=rpc", createScheme(), createFqdnWithPort()
         );
@@ -1062,6 +1070,27 @@ public CompletableFuture<List<HostPort>> getProxies() {
         });
     }
 
+    /**
+     * Shuts down the HTTP client used for proxy discovery without waiting for in-flight requests.
+     * On Java 11-20 the client has no shutdown API, so its selector thread stops only after
+     * the client is garbage collected.
+     */
+    @Override
+    public void close() {
+        HttpClient httpClient = httpClientRef.getAndSet(null);
+        if (httpClient == null) {
+            return;
+        }
+
+        try {
+            HttpClient.class.getMethod("shutdownNow").invoke(httpClient);
+        } catch (NoSuchMethodException ignored) {
+            // HttpClient has no explicit shutdown API before Java 21.
+        } catch (ReflectiveOperationException e) {
+            throw new RuntimeException("Failed to shut down HTTP proxy discovery client", e);
+        }
+    }
+
     private String createScheme() {
         if (useTLS) {
             return HTTPS_SCHEME;
```

**File**: `yt/java/ytsaurus-client/src/test/java/tech/ytsaurus/client/HttpProxyGetterCloseTest.java` (added, +57/-0)
```diff
@@ -0,0 +1,57 @@
+package tech.ytsaurus.client;
+
+import java.net.http.HttpClient;
+import java.time.Duration;
+import java.util.Random;
+
+import io.netty.channel.nio.NioEventLoopGroup;
+import org.junit.Assume;
+import org.junit.Test;
+import tech.ytsaurus.client.rpc.RpcOptions;
+
+import static org.junit.Assert.assertTrue;
+
+public class HttpProxyGetterCloseTest {
+    @Test
+    public void testCloseTerminatesSelectorManagerOnJava21() throws Exception {
+        HttpClient httpClient = HttpClient.newHttpClient();
+        Assume.assumeTrue(httpClient instanceof AutoCloseable);
+
+        HttpProxyGetter getter = new HttpProxyGetter(
+                httpClient,
+                ClientPoolService.httpBuilder()
+                        .setBalancerFqdn("localhost")
+                        .setOptions(new RpcOptions())
+        );
+
+        getter.close();
+
+        Object isTerminated = HttpClient.class
+                .getMethod("awaitTermination", Duration.class)
+                .invoke(httpClient, Duration.ofSeconds(30));
+        assertTrue(isTerminated instanceof Boolean);
+        assertTrue(
+                "HttpClient did not terminate within 30 seconds",
+                (Boolean) isTerminated
+        );
+    }
+
+    @Test
+    public void testClientPoolServiceClosesHttpProxyGetter() {
+        NioEventLoopGroup eventLoopGroup = new NioEventLoopGroup(1);
+        HttpProxyGetter getter;
+        try (ClientPoolService clientPoolService = ClientPoolService.httpBuilder()
+                .setDataCenterName("test")
+                .setBalancerFqdn("localhost")
+                .setOptions(new RpcOptions())
+                .setClientFactory(new MockRpcClientFactory())
+                .setEventLoop(eventLoopGroup)
+                .setRandom(new Random())
+                .build()) {
+            getter = (HttpProxyGetter) clientPoolService.proxyGetter;
+        } finally {
+            eventLoopGroup.shutdownGracefully().syncUninterruptibly();
+        }
+        assertTrue(getter.getProxies().isCompletedExceptionally());
+    }
+}
```

---

### Incident Patch 2: `532026b1` (2026-11-27)
**Commit Message**: Fix Strawberry resource authorization and configuration validation

The shared Strawberry API now checks resource permissions for the values actually stored in a speclet. Creating or replacing a clique configuration with an unauthorized disk account, or switching to it through a nested option edit, returns an authorization error and leaves the speclet unchanged.

The changes fix two groups of defects found in the existing controller code:

- Malformed user configurations could panic the controller while reporting a type error, including `pool=#`, `pool_trees=[#]`, `secrets=#`, null secret values, and null `state` / `health` filters. The affected validators return errors with type attributes instead of calling `.String()` on `reflect.TypeOf(nil)`.
- Resource permission checks were incomplete: `disk_request.account` was not authorized, and nested or escaped option edits and removals could bypass validation. The API checks the requesting user's and configured service robot's `use` permissions for affected explicit pools, network projects and disk accounts. Pool checks still respect `validate_pool_access`.

Creation and full speclet replacement validate all explicit resources. Option e

**File**: `yt/chyt/controller/internal/api/api.go` (modified, +119/-36)
```diff
@@ -3,7 +3,6 @@ package api
 import (
 	"context"
 	"fmt"
-	"reflect"
 	"strconv"
 	"time"
 
@@ -260,7 +259,7 @@ func (a *API) CheckPermissionToNetworkProject(ctx context.Context, networkProjec
 func (a *API) validatePoolOption(ctx context.Context, poolValue any, poolTreesValue any) error {
 	pool, ok := poolValue.(string)
 	if !ok {
-		typeName := reflect.TypeOf(poolValue).String()
+		typeName := fmt.Sprintf("%T", poolValue)
 		return yterrors.Err(
 			fmt.Sprintf("pool option has unexpected value type %v", typeName),
 			yterrors.Attr("type", typeName))
@@ -269,7 +268,7 @@ func (a *API) validatePoolOption(ctx context.Context, poolValue any, poolTreesVa
 	if poolTreesValue != nil {
 		poolTreeValues, ok := poolTreesValue.([]any)
 		if !ok {
-			typeName := reflect.TypeOf(poolTreesValue).String()
+			typeName := fmt.Sprintf("%T", poolTreesValue)
 			return yterrors.Err(
 				fmt.Sprintf("pool_trees option has unexpected value type %v", typeName),
 				yterrors.Attr("type", typeName))
@@ -278,7 +277,7 @@ func (a *API) validatePoolOption(ctx context.Context, poolValue any, poolTreesVa
 		for _, poolTreeValue := range poolTreeValues {
 			poolTree, ok := poolTreeValue.(string)
 			if !ok {
-				typeName := reflect.TypeOf(poolTreeValue).String()
+				typeName := fmt.Sprintf("%T", poolTreeValue)
 				return yterrors.Err(
 					fmt.Sprintf("element of pool_trees option has unexpected value type %v", typeName),
 					yterrors.Attr("type", typeName))
@@ -293,6 +292,81 @@ func (a *API) validatePoolOption(ctx context.Context, poolValue any, poolTreesVa
 
 }
 
+// An empty changedOptions set checks every explicit resource.
+func (a *API) checkPermissionToResources(ctx context.Context, speclet map[string]any, changedOptions map[string]struct{}) error {
+	checkAll := len(changedOptions) == 0
+	_, checkPool := changedOptions["pool"]
+	_, checkPoolTrees := changedOptions["pool_trees"]
+	_, checkNetworkProject := changedOptions["network_project"]
+	_, checkDiskRequest := changedOptions["disk_request"]
+	checkPool = checkAll || checkPool || checkPoolTrees
+	checkNetworkProject = checkAll || checkNetworkProject
+	checkDiskRequest = checkAll || checkDiskRequest
+
+	if pool, poolIsSet := speclet["pool"]; poolIsSet && checkPool {
+		if err := a.validatePoolOption(ctx, pool, speclet["pool_trees"]); err != nil {
+			return err
+		}
+	}
+	if networkProject, networkProjectIsSet := speclet["network_project"]; networkProjectIsSet && checkNetworkProject {
+		if err := validateString(networkProject); err != nil {
+			return err
+		}
+		if err := a.CheckPermissionToNetworkProject(ctx, networkProject.(string)); err != nil {
+			return err
+		}
+	}
+	if diskRequest, diskRequestIsSet := speclet["disk_request"]; diskRequestIsSet && checkDiskRequest {
+		return a.validateDiskRequestOption(ctx, diskRequest)
+	}
+	return nil
+}
+
+func (a *API) validateDiskRequestOption(ctx context.Context, value any) error {
+	if value == nil {
+		return nil
+	}
+	request, ok := value.(map[string]any)
+	if !ok {
+		typeName := fmt.Sprintf("%T", value)
+		return yterrors.Err(
+			fmt.Sprintf("disk_request option has unexpected value type %v", typeName),
+			yterrors.Attr("type", typeName))
+	}
+	if value := request["account"]; value != nil {
+		if err := validateString(value); err != nil {
+			return err
+		}
+		return a.CheckPermissionToAccount(ctx, value.(string))
+	}
+	return nil
+}
+
+func (a *API) CheckPermissionToAccount(ctx context.Context, account string) error {
+	if account == "" {
+		return fmt.Errorf("account must not be empty")
+	}
+	user, err := getUser(ctx)
+	if err != nil {
+		return err
+	}
+	path := ypath.Path("//sys/accounts").Child(account)
+	users := []string{user}
+	if a.cfg.RobotUsername != "" && a.cfg.RobotUsername != user {
+		users = append(users, a.cfg.RobotUsername)
+	}
+	for _, subject := range users {
+		response, err := a.Ytc.CheckPermission(ctx, subject, yt.PermissionUse, path, nil)
+		if err != nil {
+			return err
+		}
+		if response.Action != yt.ActionAllow {
+			return yterrors.Err(fmt.Sprintf("use permission to account %q denied for user %q", account, subject), yterrors.CodeAuthorizationError)
+		}
+	}
+	return nil
+}
+
 func (a *API) newOplet(
 	alias string,
 	userClient yt.Client,
@@ -436,6 +510,12 @@ func (a *API) Create(
 		}
 	}
 
+	if diskRequest, diskRequestIsSet := specletOptions["disk_request"]; diskRequestIsSet {
+		if err := a.validateDiskRequestOption(ctx, diskRequest); err != nil {
+			return err
+		}
+	}
+
 	user, err := getUser(ctx)
 	if err != nil {
 		a.l.Error("failed to get user", log.Error(err))
@@ -628,17 +708,20 @@ func (a *API) setOption(
 	value any,
 	options *yt.SetNodeOptions,
 ) error {
-	if key == "active" {
+	parts, err := parseSpecletOptionPath(key)
+	if err != nil {
+		return err
+	}
+	// Resource edits need permission checks against the resulting speclet.
+	switch parts[0] {
+	case "pool", "pool_trees", "network_project", "disk_request":
+		return a.EditOptions(ctx, alias, map[string]any{ke
```

**File**: `yt/chyt/controller/internal/api/helpers.go` (modified, +44/-11)
```diff
@@ -3,12 +3,13 @@ package api
 import (
 	"fmt"
 	"math/rand"
-	"reflect"
 	"regexp"
+	"strings"
 
 	"golang.org/x/exp/slices"
 
 	"go.ytsaurus.tech/yt/chyt/controller/internal/strawberry"
+	"go.ytsaurus.tech/yt/go/ypath"
 	"go.ytsaurus.tech/yt/go/yt"
 	"go.ytsaurus.tech/yt/go/yterrors"
 )
@@ -41,7 +42,7 @@ func unexpectedTypeError(typeName string) error {
 func validateSpecletOptions(speclet any) error {
 	_, ok := speclet.(map[string]any)
 	if !ok {
-		typeName := reflect.TypeOf(speclet).String()
+		typeName := fmt.Sprintf("%T", speclet)
 		return unexpectedTypeError(typeName)
 	}
 	return nil
@@ -50,12 +51,12 @@ func validateSpecletOptions(speclet any) error {
 func validateSecrets(secrets any) error {
 	secretsMap, ok := secrets.(map[string]any)
 	if !ok {
-		typeName := reflect.TypeOf(secrets).String()
+		typeName := fmt.Sprintf("%T", secrets)
 		return unexpectedTypeError(typeName)
 	}
 	allowedTypes := []string{"string", "int64", "uint64", "bool", "float64"}
 	for _, v := range secretsMap {
-		if vType := reflect.TypeOf(v).String(); !slices.Contains(allowedTypes, vType) {
+		if vType := fmt.Sprintf("%T", v); !slices.Contains(allowedTypes, vType) {
 			return unexpectedTypeError(vType)
 		}
 	}
@@ -65,7 +66,7 @@ func validateSecrets(secrets any) error {
 func validateBool(value any) error {
 	_, ok := value.(bool)
 	if !ok {
-		typeName := reflect.TypeOf(value).String()
+		typeName := fmt.Sprintf("%T", value)
 		return unexpectedTypeError(typeName)
 	}
 	return nil
@@ -74,7 +75,7 @@ func validateBool(value any) error {
 func validateString(value any) error {
 	_, ok := value.(string)
 	if !ok {
-		typeName := reflect.TypeOf(value).String()
+		typeName := fmt.Sprintf("%T", value)
 		return unexpectedTypeError(typeName)
 	}
 	return nil
@@ -87,14 +88,14 @@ func transformToStringSlice(value any) (any, error) {
 
 	array, ok := value.([]any)
 	if !ok {
-		typeName := reflect.TypeOf(value).String()
+		typeName := fmt.Sprintf("%T", value)
 		return nil, unexpectedTypeError(typeName)
 	}
 
 	transformedAttributes := []string{}
 	for _, element := range array {
 		if _, ok = element.(string); !ok {
-			typeName := reflect.TypeOf(value).String()
+			typeName := fmt.Sprintf("%T", value)
 			return nil, unexpectedTypeError(typeName)
 		}
 		transformedAttributes = append(transformedAttributes, element.(string))
@@ -110,7 +111,7 @@ func transformFilterValues(value any) (any, error) {
 
 	filterVals, ok := value.(map[string]any)
 	if !ok {
-		typeName := reflect.TypeOf(value).String()
+		typeName := fmt.Sprintf("%T", value)
 		return nil, unexpectedTypeError(typeName)
 	}
 
@@ -120,14 +121,14 @@ func transformFilterValues(value any) (any, error) {
 			if stringV, ok := v.(string); ok {
 				newMap[k] = strawberry.OpletState(stringV)
 			} else {
-				typeName := reflect.TypeOf(v).String()
+				typeName := fmt.Sprintf("%T", v)
 				return nil, unexpectedTypeError(typeName)
 			}
 		} else if k == "health" {
 			if stringV, ok := v.(string); ok {
 				newMap[k] = strawberry.OpletHealth(stringV)
 			} else {
-				typeName := reflect.TypeOf(v).String()
+				typeName := fmt.Sprintf("%T", v)
 				return nil, unexpectedTypeError(typeName)
 			}
 		} else {
@@ -168,3 +169,35 @@ func getRandomString(length int) string {
 	}
 	return string(b)
 }
+
+func parseSpecletOptionPath(key string) ([]string, error) {
+	tokens, err := ypath.SplitTokens("//" + key)
+	if err != nil || len(tokens) < 2 || strings.Join(tokens, "") != "//"+key {
+		return nil, fmt.Errorf("invalid option path %q", key)
+	}
+	parts := make([]string, 0, len(tokens)-1)
+	for _, token := range tokens[1:] {
+		part, err := ypath.UnescapeLiteral(strings.TrimPrefix(token, "/"))
+		if err != nil || part == "" {
+			return nil, fmt.Errorf("invalid option path %q", key)
+		}
+		parts = append(parts, part)
+	}
+	return parts, nil
+}
+
+// Apply path-based edits to the actual final map so permission checks see the
+// same values that SetNode stores. This includes disk_request/account edits.
+func editSpecletOption(speclet map[string]any, key string, value any, remove bool) (string, error) {
+	parts, err := parseSpecletOptionPath(key)
+	if err != nil {
+		return "", err
+	}
+	path := ypath.Path("/" + key)
+	if remove {
+		_, err = ypath.RemoveMapValue(speclet, path)
+	} else {
+		err = ypath.SetMapValue(speclet, path, value, true)
+	}
+	return parts[0], err
+}
```

**File**: `yt/chyt/controller/internal/api/ya.make` (modified, +2/-0)
```diff
@@ -10,6 +10,8 @@ SRCS(
 
 GO_TEST_SRCS(
     default_options_test.go
+    helpers_test.go
+    speclet_validation_test.go
 )
 
 END()
```

**File**: `yt/chyt/controller/internal/strawberry/speclet.go` (modified, +8/-0)
```diff
@@ -5,6 +5,13 @@ import (
 	"go.ytsaurus.tech/yt/go/yt"
 )
 
+type DiskRequest struct {
+	DiskSpace  *uint64 `yson:"disk_space,omitempty"`
+	InodeCount *uint64 `yson:"inode_count,omitempty"`
+	Account    *string `yson:"account,omitempty"`
+	MediumName *string `yson:"medium_name,omitempty"`
+}
+
 // Change of these parameters leads to operation restart.
 type RestartRequiredOptions struct {
 	Stage            *string      `yson:"stage"`
@@ -13,6 +20,7 @@ type RestartRequiredOptions struct {
 	LayerPaths       []ypath.Path `yson:"layer_paths"`
 	EnableCPUReclaim *bool        `yson:"enable_cpu_reclaim"`
 	PoolTrees        []string     `yson:"pool_trees"`
+	DiskRequest      *DiskRequest `yson:"disk_request"`
 }
 
 type Speclet struct {
```

**File**: `yt/chyt/controller/test/integration/api_test.go` (modified, +231/-3)
```diff
@@ -16,6 +16,7 @@ import (
 	"go.ytsaurus.tech/yt/chyt/controller/internal/strawberry"
 	"go.ytsaurus.tech/yt/chyt/controller/test/helpers"
 	"go.ytsaurus.tech/yt/go/guid"
+	"go.ytsaurus.tech/yt/go/ypath"
 	"go.ytsaurus.tech/yt/go/yson"
 	"go.ytsaurus.tech/yt/go/yt"
 )
@@ -88,6 +89,50 @@ func TestHTTPAPICreateAndRemove(t *testing.T) {
 	require.True(t, ok)
 }
 
+func TestHTTPAPINetworkProjectAccessOnCreation(t *testing.T) {
+	t.Parallel()
+
+	env, c := helpers.PrepareSleepAPI(t)
+	c.User = helpers.GenerateAlias()
+	_, err := env.YT.CreateObject(env.Ctx, yt.NodeUser, &yt.CreateObjectOptions{
+		Attributes: map[string]any{"name": c.User},
+	})
+	require.NoError(t, err)
+
+	project := helpers.GenerateAlias()
+	_, err = env.YT.CreateObject(env.Ctx, yt.NodeNetworkProject, &yt.CreateObjectOptions{
+		Attributes: map[string]any{
+			"name": project,
+			"acl": []yt.ACE{{
+				Action:      yt.ActionDeny,
+				Subjects:    []string{c.User},
+				Permissions: []yt.Permission{yt.PermissionUse},
+			}},
+		},
+	})
+	require.NoError(t, err)
+
+	alias := helpers.GenerateAlias()
+	r := c.MakePostRequest("create", api.RequestParams{
+		Params: map[string]any{
+			"alias":           alias,
+			"speclet_options": map[string]any{"network_project": project},
+		},
+	})
+	require.Equal(t, http.StatusBadRequest, r.StatusCode, string(r.Body))
+	require.Contains(t, string(r.Body), "use permission to network_project "+project+" denied for user "+c.User)
+
+	for _, path := range []ypath.Path{
+		env.StrawberryRoot.Child(alias),
+		env.StrawberryRoot.JoinChild(alias, "speclet"),
+		strawberry.AccessControlNamespacesPath.JoinChild("sleep", alias),
+	} {
+		exists, err := env.YT.NodeExists(env.Ctx, path, nil)
+		require.NoError(t, err)
+		require.False(t, exists, "rejected creation must not leave %s", path)
+	}
+}
+
 func TestHTTPAPILivyIsDeprecated(t *testing.T) {
 	t.Parallel()
 
@@ -351,6 +396,111 @@ func TestHTTPAPIParseParams(t *testing.T) {
 	}
 }
 
+func preparePoolAccessAPI(t *testing.T) (*helpers.Env, *helpers.RequestClient, string, string) {
+	t.Helper()
+
+	env, c := helpers.PrepareSleepAPI(t)
+	c.User = helpers.GenerateAlias()
+	_, err := env.YT.CreateObject(env.Ctx, yt.NodeUser, &yt.CreateObjectOptions{
+		Attributes: map[string]any{"name": c.User},
+	})
+	require.NoError(t, err)
+
+	allowedPool, deniedPool := helpers.GenerateAlias(), helpers.GenerateAlias()
+	for _, pool := range []string{allowedPool, deniedPool} {
+		action := yt.ActionAllow
+		if pool == deniedPool {
+			action = yt.ActionDeny
+		}
+		_, err := env.YT.CreateObject(env.Ctx, yt.NodeSchedulerPool, &yt.CreateObjectOptions{
+			Attributes: map[string]any{
+				"name":      pool,
+				"pool_tree": "default",
+				"acl": []yt.ACE{{
+					Action:      action,
+					Subjects:    []string{c.User},
+					Permissions: []yt.Permission{yt.PermissionUse},
+				}},
+			},
+		})
+		require.NoError(t, err)
+	}
+	return env, c, allowedPool, deniedPool
+}
+
+func TestHTTPAPIPoolAccessOnCreation(t *testing.T) {
+	t.Parallel()
+
+	env, c, _, deniedPool := preparePoolAccessAPI(t)
+	alias := helpers.GenerateAlias()
+	r := c.MakePostRequest("create", api.RequestParams{
+		Params: map[string]any{
+			"alias":           alias,
+			"speclet_options": map[string]any{"pool": deniedPool},
+		},
+	})
+	require.Equal(t, http.StatusBadRequest, r.StatusCode, string(r.Body))
+	require.Contains(t, string(r.Body), "use permission to pool "+deniedPool+" in pool_tree default denied for user "+c.User)
+
+	for _, path := range []ypath.Path{
+		env.StrawberryRoot.Child(alias),
+		env.StrawberryRoot.JoinChild(alias, "speclet"),
+		strawberry.AccessControlNamespacesPath.JoinChild("sleep", alias),
+	} {
+		exists, err := env.YT.NodeExists(env.Ctx, path, nil)
+		require.NoError(t, err)
+		require.False(t, exists, "rejected creation must not leave %s", path)
+	}
+}
+
+func TestHTTPAPIPoolAccessOnModification(t *testing.T) {
+	t.Parallel()
+
+	env, c, allowedPool, deniedPool := preparePoolAccessAPI(t)
+	for _, command := range []string{"set_option", "set_options", "edit_options", "set_speclet"} {
+		t.Run(command, func(t *testing.T) {
+			alias := helpers.GenerateAlias()
+			r := c.MakePostRequest("create", api.RequestParams{
+				Params: map[string]any{
+					"alias": alias,
+					"speclet_options": map[string]any{
+						"pool":        allowedPool,
+						"test_option": int64(1),
+					},
+				},
+			})
+			require.Equal(t, http.StatusOK, r.StatusCode, string(r.Body))
+
+			specletPath := env.StrawberryRoot.JoinChild(alias, "speclet")
+			getOptions := &yt.GetNodeOptions{Attributes: []string{"value", "revision"}}
+			var before, after map[string]any
+			require.NoError(t, env.YT.GetNode(env.Ctx, specletPath.Attrs(), &before, getOptions))
+
+			options := map[string]any{"pool": deniedPool}
+			params := map[string]any{"alias": alias}
+			switch command {
+			case "set_option":
+				params["key"] = "pool"
+				params["value"] = deniedPool
+			case "set_options":
+				options["test_option"] = int64(2)

```

**File**: `yt/chyt/controller/test/integration/resource_access_test.go` (added, +298/-0)
```diff
@@ -0,0 +1,298 @@
+package integration
+
+import (
+	"fmt"
+	"net/http"
+	"testing"
+
+	"github.com/stretchr/testify/require"
+
+	"go.ytsaurus.tech/yt/chyt/controller/internal/api"
+	"go.ytsaurus.tech/yt/chyt/controller/internal/strawberry"
+	"go.ytsaurus.tech/yt/chyt/controller/test/helpers"
+	"go.ytsaurus.tech/yt/go/ypath"
+	"go.ytsaurus.tech/yt/go/yson"
+	"go.ytsaurus.tech/yt/go/yt"
+)
+
+func prepareResourceAccessAPI(t *testing.T) (*helpers.Env, *helpers.RequestClient) {
+	t.Helper()
+	env, c := helpers.PrepareSleepAPI(t)
+	c.User = helpers.GenerateAlias()
+	_, err := env.YT.CreateObject(env.Ctx, yt.NodeUser, &yt.CreateObjectOptions{
+		Attributes: map[string]any{"name": c.User},
+	})
+	require.NoError(t, err)
+	return env, c
+}
+
+func resourceUseACL(user string, allowed bool) []yt.ACE {
+	action := yt.ActionDeny
+	if allowed {
+		action = yt.ActionAllow
+	}
+	return []yt.ACE{{Action: action, Subjects: []string{user}, Permissions: []yt.Permission{yt.PermissionUse}}}
+}
+
+func prepareDiskAccountAccessAPI(t *testing.T) (*helpers.Env, *helpers.RequestClient, string, string) {
+	t.Helper()
+	env, c := prepareResourceAccessAPI(t)
+	allowedAccount, deniedAccount := helpers.GenerateAlias(), helpers.GenerateAlias()
+	for _, account := range []string{allowedAccount, deniedAccount} {
+		_, err := env.YT.CreateObject(env.Ctx, yt.NodeAccount, &yt.CreateObjectOptions{
+			Attributes: map[string]any{
+				"name": account,
+				"acl":  resourceUseACL(c.User, account == allowedAccount),
+			},
+		})
+		require.NoError(t, err)
+	}
+	return env, c, allowedAccount, deniedAccount
+}
+
+func preparePoolTreesAccessAPI(t *testing.T) (*helpers.Env, *helpers.RequestClient, string, string, string) {
+	t.Helper()
+	env, c := prepareResourceAccessAPI(t)
+	pool := helpers.GenerateAlias()
+	allowedTree, deniedTree := helpers.GenerateAlias(), helpers.GenerateAlias()
+	for _, tree := range []string{allowedTree, deniedTree} {
+		_, err := env.YT.CreateObject(env.Ctx, yt.NodeSchedulerPoolTree, &yt.CreateObjectOptions{
+			Attributes: map[string]any{
+				"name":   tree,
+				"config": map[string]any{"node_tag_filter": tree},
+			},
+		})
+		require.NoError(t, err)
+		_, err = env.YT.CreateObject(env.Ctx, yt.NodeSchedulerPool, &yt.CreateObjectOptions{
+			Attributes: map[string]any{
+				"name":      pool,
+				"pool_tree": tree,
+				"acl":       resourceUseACL(c.User, tree == allowedTree),
+			},
+		})
+		require.NoError(t, err)
+	}
+	return env, c, pool, allowedTree, deniedTree
+}
+
+func requireResourceAccessDenied(t *testing.T, r helpers.Response, message string) {
+	t.Helper()
+	require.Equal(t, http.StatusBadRequest, r.StatusCode, string(r.Body))
+	var response struct {
+		Message string `yson:"message"`
+	}
+	require.NoError(t, yson.Unmarshal(r.Body, &response))
+	require.Equal(t, message, response.Message)
+}
+
+func requireRejectedResourceCreation(t *testing.T, env *helpers.Env, c *helpers.RequestClient, options map[string]any, message string) string {
+	t.Helper()
+	alias := helpers.GenerateAlias()
+	r := c.MakePostRequest("create", api.RequestParams{
+		Params: map[string]any{"alias": alias, "speclet_options": options},
+	})
+	requireResourceAccessDenied(t, r, message)
+	for _, path := range []ypath.Path{
+		env.StrawberryRoot.Child(alias),
+		env.StrawberryRoot.JoinChild(alias, "speclet"),
+		strawberry.AccessControlNamespacesPath.JoinChild("sleep", alias),
+	} {
+		exists, err := env.YT.NodeExists(env.Ctx, path, nil)
+		require.NoError(t, err)
+		require.False(t, exists, "rejected creation must not leave %s", path)
+	}
+	return alias
+}
+
+func requireRejectedResourceEdit(t *testing.T, env *helpers.Env, c *helpers.RequestClient, alias, command string, params map[string]any, message string) {
+	t.Helper()
+	specletPath := env.StrawberryRoot.JoinChild(alias, "speclet")
+	getOptions := &yt.GetNodeOptions{Attributes: []string{"value", "revision"}}
+	var before, after map[string]any
+	require.NoError(t, env.YT.GetNode(env.Ctx, specletPath.Attrs(), &before, getOptions))
+	r := c.MakePostRequest(command, api.RequestParams{Params: params})
+	requireResourceAccessDenied(t, r, message)
+	require.NoError(t, env.YT.GetNode(env.Ctx, specletPath.Attrs(), &after, getOptions))
+	require.Equal(t, before, after, "rejected edits must preserve both speclet contents and revision")
+}
+
+func TestHTTPAPIDiskAccountAccessOnCreation(t *testing.T) {
+	t.Parallel()
+	env, c, allowedAccount, deniedAccount := prepareDiskAccountAccessAPI(t)
+	message := fmt.Sprintf("Use permission to account %q denied for user %q", deniedAccount, c.User)
+	alias := requireRejectedResourceCreation(t, env, c, map[string]any{
+		"disk_request": map[string]any{"account": deniedAccount, "disk_space": int64(1024)},
+	}, message)
+	r := c.MakePostRequest("create", api.RequestParams{
+		Params: map[string]any{
+			"alias": alias,
+			"speclet_options": map[string]any{
+				"disk_request": map[string]any{"account": allowedAccount, "disk_space": int64(1024)},
+			},
+		},
+	})
```

**File**: `yt/chyt/controller/test/integration/ya.make` (modified, +1/-0)
```diff
@@ -11,6 +11,7 @@ ENDIF()
 GO_TEST_SRCS(
     api_test.go
     monitoring_test.go
+    resource_access_test.go
     strawberry_test.go
 )
 
```

---

### Incident Patch 3: `49aa4254` (2026-11-27)
**Commit Message**: YT-29411: Bump CPU requirement for chyt server tests

The suite runs a full YT cluster (4 master cells plus a ground cluster in the
Sequoia variants), 5 nodes and a CHYT clique per test, but inherits cpu:10 from
YaMakeBoilerplateForTests.txt, the lowest of all large YT suites (size_l asks
cpu:28, size_xl cpu:38). The starved slot shows up as timeouts rather than
assertion failures: tests hit the 90 s pytest-timeout inside Clique enter/exit
and whole chunks get killed at the 1800 s suite timeout with tests NOT_LAUNCHED.

Bumping ram to 24 in https://nda.ya.ru/t/XUMeh69b7xYd2K did not help, so RAM was not the binding constraint.
commit_hash:87c2a82c8be70c4b411bc64cfc566fec60239046

**File**: `yt/chyt/tests/server/ya.make` (modified, +3/-0)
```diff
@@ -14,7 +14,10 @@ IF (SANITIZER_TYPE)
         ram:48
     )
 ELSE()
+    # A clique on top of a full (Sequoia: 4-cell + ground) cluster does not fit the
+    # boilerplate default of cpu:10; cf. cpu:28 in yt/yt/tests/integration/size_l.
     REQUIREMENTS(
+        cpu:28
         ram:24
     )
 ENDIF()
```

#### Recent Merged Pull Requests:
- **PR #1919** (closed): yt/go/yson: do not allocate when writing binary varints and floats (@orloffv)
- **PR #1908** (closed): [docs] Update Release Notes (@ytsaurus-actions[bot])
- **PR #1903** (closed): Go SDK: Serialization of Composite types. #1902 (@psk-nebi)
- **PR #1897** (closed): [docs] Update Release Notes (@ytsaurus-actions[bot])
- **PR #1895** (closed): yt/chyt: remove hardcoded jaeger (@koct9i)
- **PR #1892** (closed): Fix typo in chaos-dynamic-tables.md (@hsalkaline)

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

## X. [yt/java] Fix HttpClient selector thread leak

**RULE**:
When implementing operations in `yt/java/ytsaurus-client/src/main/java/tech/ytsaurus/client/ClientPool.java`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in ytsaurus/ytsaurus. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `0a66f47a`: [yt/java] Fix HttpClient selector thread leak. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing C++ data structures, boundary deserialization, API parsing, or resource lifecycles matching `yt/java/ytsaurus-client/src/main/java/tech/ytsaurus/client/ClientPool.java`.

**VERIFIED IMPLEMENTATION PATTERN**:
```c++
// Verified production-grade fix pattern:
import java.util.concurrent.atomic.AtomicReference;
        HttpProxyGetter httpProxyGetter = new HttpProxyGetter(
        proxyGetter = httpProxyGetter;
        toClose.add(httpProxyGetter);
class HttpProxyGetter implements ProxyGetter, AutoCloseable {
    private final AtomicReference<HttpClient> httpClientRef;
        this.httpClientRef = new AtomicReference<>(httpClient);
        HttpClient httpClient = httpClientRef.get();
        if (httpClient == null) {
            return CompletableFuture.failedFuture(new IllegalStateException("HTTP proxy getter is closed"));
        }

    /**
     * Shuts down the HTTP client used for proxy discovery without waiting for in-flight requests.
     * On Java 11-20 the client has no shutdown API, so its selector thread stops only after
     * the client is garbage collected.
     */
    @Override
    public void close() {
        HttpClient httpClient = httpClientRef.getAndSet(null);
        if (httpClient == null) {
            return;
        }

        try {
            HttpClient.class.getMethod("shutdownNow").invoke(httpClient);
        } catch (NoSuchMethodException ignored) {
            // HttpClient has no explicit shutdown API befor
```

**NEGATIVE CONSTRAINT**:
```c++
// Induced defect failure mode:
        proxyGetter = new HttpProxyGetter(
class HttpProxyGetter implements ProxyGetter {
    private final HttpClient httpClient;
        this.httpClient = httpClient;
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `0a66f47a` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.

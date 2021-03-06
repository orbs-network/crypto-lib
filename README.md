# Crypto Lib

Crypto Lib is a cross-platform C++ library (with ANSI C exported interfaces) that implements all the necessary cryptographic functions for Orbs clients.

In order to implement some of the functionality, we have elected to use libgcrypt, since it's:

1. Licensed under GNU LGPL v2.1+.
2. FIPS 140 validated.
3. Support FIPS 140-2 mode.

## Functionality

### Build System

Complete cmake setup to build both the crypto-sdk library and its tests (support for both release and debug builds). Prerequisites are defined as `ExternalProject` with either specific git tag clone (`gtest`, and `gmock`) or downloaded from URL with SHA256 verification (`libgpg_error`, and `libgcrypt`).

## Address Scheme

Addressing in the Orbs platform are based on a universal signature and addressing scheme. This method allows applications and users to use a range of addressing schemes side by side, specifying the type of the address next to the address itself.

Every public address in Orbs platform has the form of {Network ID, Address Scheme, Address}. *Network ID* is a 1-byte field that determines that network type. *Address Scheme* is a 1-byte that determines the signature scheme and the address format.

### Network ID Encoding

| Network  | Value | Value (hex) |
| :------: | :---: | :---------: |
| Main net | M     | 4d          |
| Test net | T     | 54          |

### Address Scheme Encoding

| Address Scheme | Value (hex) |
| :------------: | :---------- |
| Rev1           | 00          |

### Address Scheme: 0

1. Start with a 32-byte Ed25519 public key:

    Public key: `8d41d055d00459be37f749da2caf87bd4ced6fafa335b1f2142e0f44501b2c65`

2. Set the 3-byte Virtual Chain ID:

    Virtual Chain ID: `640ed3`

    Note: The Virtual Chain ID MSB value should be > `07` in order to obtain a BASE58 encoded address with a leading non-zero value.

3. Calculate the Account ID by calculating the RIPEMD160 hash of the SHA256 of the public key:

    SHA256 of the public key: `40784b5b15e6bb364263dbb598f262bc5c5b4c18a34806ca70be180c3d995e0d`

    RIPEMD160 of the SHA256: `c13052d8208230a58ab363708c08e78f1125f488`

4. Prepend the Network ID, Address Scheme and Virtual Chain ID to the Account ID:

    Network ID + Address Scheme + Virtual Chain ID + Account ID: `4d00640ed3c13052d8208230a58ab363708c08e78f1125f488`

5. Calculate the CRC32 checksum of the result:

    Checksum: `8113211c`

    Raw public address: `4d00640ed3c13052d8208230a58ab363708c08e78f1125f4888113211c`

6. Encode the raw public address to Base58:

    Each of the following address parts is encoded separately:

    a. Network ID: `M`

    b. Address Scheme: `00`

    c. Virtual Chain ID + Account ID + Checksum: `EXMPnnaWFqRyVxWdhYCgGzpnaL4qBy4R42dE3`

    Public address: `M00EXMPnnaWFqRyVxWdhYCgGzpnaL4qBy4R42dE3`

### Algorithms

#### Hashing

* SHA256
* SHA512
* RIPEMD160

#### Encoding

* BASE58

#### Checksum

* CRC32

#### Public Key Cryptography

* ED25519 key pair support

#### Digital Signature Schemes

* EdDSA signature support. As a convention, the signature is encoded as:

| bytes  |       |
| :----: | :---: |
| 0 - 32 | R     |
| 0 - 64 | S     |


### External Dependencies

* Google Test (`gtest`): Google Test is a unit testing library for the C++ programming language, based on the xUnit architecture.
  * Source: [https://github.com/google/googletest.git](https://github.com/google/googletest.git)
  * Version: `release-1.8.0` git tag.
* Google Mock (`gmock`): Google Mock is an extension to Google Test for writing and using C++ mock classes.
  * Source: [https://github.com/google/googletest.git](https://github.com/google/googletest.git)
  * Version: `release-1.8.0` git tag.
* Libgpg-error (`libgpg_error`): Libgpg-error is a small library that originally defined common error values for all GnuPG components.
  * Source: [https://www.gnupg.org/ftp/gcrypt/libgpg-error/libgpg-error-1.28.tar.bz2](https://www.gnupg.org/ftp/gcrypt/libgpg-error/libgpg-error-1.28.tar.bz2)
  * Version: 1.28.
* Libgcrypt (`libgcrypt`): Libgcrypt is a general purpose cryptographic library originally based on code from GnuPG.
  * Source: [https://www.gnupg.org/ftp/gcrypt/libgcrypt/libgcrypt-1.8.2.tar.bz2](https://www.gnupg.org/ftp/gcrypt/libgcrypt/libgcrypt-1.8.2.tar.bz2)
  * Version: 1.8.2.

## Prerequisites

### General

1. [CMake](https://cmake.org)

### iOS

1. [Xcode](https://developer.apple.com/xcode/)
2. iPhone Simulator (64bit)

### Android

1. [Android Studio](https://developer.android.com/studio/index.html) (3.1 or higher)
2. [Android SDK](https://developer.android.com/studio/intro/update.html). Please install these plugins via Android Studio's SDK Manager.
    * Install the LLDB plug-in.
    * Install the CMake plug-in.
    * Install Build Tools 27.0.3.
3. [Android NDK](https://developer.android.com/ndk/downloads/index.html). For development, you can also install the NDK as an Android Studio plug-in.
4. JDK 1.8+.
5. Gradle 4+.

Note: in order to build using Android Studio, please make sure to have `local.properties` files (next to `build.gradle`), specifying both `sdk.dir` and `ndk.dir` (usually, these are generated automatically for you).

```bash
brew install cmake boost-python
```

## Build

> You'd need to run the `build.sh` script. It will configure the release build by default, but if you require a debug build, make sure to run it with the `DEBUG` environment variable set:

Release:

```bash
./build.sh
```

Debug:

```bash
DEBUG=1 ./build.sh
```

> If you want to configure the build from scratch, make sure to run the `clean.sh` script before:

```bash
./clean.sh
```

> If you only want to clean CMake cache and generated files, you can set the `CMAKE_ONLY` environment variable like so:

```bash
CMAKE_ONLY=1 ./clean.sh
```
## Test

> In order to run the tests, you'd need to run the `test.sh` script:

```bash
./test.sh
```

## Libgcrypt

Libgcrypt is a general purpose cryptographic library originally based on code from GnuPG. It provides
functions for all cryptographic building blocks: symmetric cipher algorithms (AES, Arcfour, Blowfish, Camellia,
CAST5, ChaCha20 DES, GOST28147, Salsa20, SEED, Serpent, Twofish) and modes (ECB,CFB,CBC,OFB,CTR,CCM,GCM,OCB,
POLY1305, AESWRAP), hash algorithms (MD2, MD4, MD5, GOST R 34.11, RIPE-MD160, SHA-1, SHA2-224, SHA2-256,
SHA2-384, SHA2-512, SHA3-224, SHA3-256, SHA3-384, SHA3-512, SHAKE-128, SHAKE-256, TIGER-192, Whirlpool), MACs
(HMAC for all hash algorithms, CMAC for all cipher algorithms, GMAC-AES, GMAC-CAMELLIA, GMAC-TWOFISH,
GMAC-SERPENT, GMAC-SEED, Poly1305, Poly1305-AES, Poly1305-CAMELLIA, Poly1305-TWOFISH, Poly1305-SERPENT,
Poly1305-SEED), public key algorithms (RSA, Elgamal, DSA, ECDSA, EdDSA, ECDH), large integer functions, random
numbers and a lot of supporting functions.
Libgcrypt works on most POSIX systems and many pre-POSIX systems. It can also be built using a cross-compiler
system for Microsoft Windows.
Libgcrypt can be used independently of GnuPG, but depends on its error-reporting library Libgpg-error.

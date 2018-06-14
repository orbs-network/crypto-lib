#!/bin/bash -xe

export MD5=md5sum

if [[ $(uname) == 'Darwin' ]]; then
   export MD5="md5 -r"
fi


export ORBS_LIBS="mac linux android/armv8-a android/westmere android/i686 android/armv7-a"

for ORBS_LIB in $ORBS_LIBS; do
    rm -rf artifacts/$ORBS_LIB
    mkdir -p artifacts/$ORBS_LIB

    if [ -d "build/$ORBS_LIB" ]; then
        cp build/$ORBS_LIB/lib/libcryptosdk* artifacts/$ORBS_LIB

        cd artifacts/$ORBS_LIB
        $MD5 libcryptosdk* > $(ls libcryptosdk*).md5
        cd -
    fi
done

cd lib
    tar cvf ../artifacts/headers.tgz *.h
cd -

cd artifacts
    $MD5 headers.tgz > headers.tgz.md5
cd -

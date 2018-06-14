#!/bin/bash -xe

docker run -d --name sdk orbs:sdk sleep 120
sleep 5

export MD5=md5sum

if [[ $(uname) == 'Darwin' ]]; then
   export MD5="md5 -r"
fi

export ORBS_LIBS="linux android/armv8-a android/westmere android/i686 android/armv7-a"

for ORBS_LIB in $ORBS_LIBS; do
    mkdir -p artifacts/$ORBS_LIB

    docker cp sdk:/opt/crypto-sdk/build/$ORBS_LIB/lib/libcryptosdk.so artifacts/$ORBS_LIB

    cd artifacts/$ORBS_LIB

    $MD5 libcryptosdk.so > libcryptosdk.so.md5

    cd -
done

export S3_PATH=s3://orbs-client-sdk/lib/$(git rev-parse HEAD)

aws s3 cp --recursive --acl public-read artifacts/ $S3_PATH

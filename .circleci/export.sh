#!/bin/bash -xe

docker run -d --name sdk orbs:sdk sleep 120
sleep 5

docker cp sdk:/opt/crypto-sdk/artifacts artifacts

export S3_PATH=s3://orbs-client-sdk/lib/$(git rev-parse HEAD)

aws s3 cp --recursive --acl public-read artifacts/ $S3_PATH

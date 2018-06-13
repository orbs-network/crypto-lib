#!/bin/bash -xe

apt-get update && apt-get install -y rng-tools
rngd -o /dev/random -r /dev/urandom

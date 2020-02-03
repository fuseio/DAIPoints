#!/usr/bin/env bash

if [ -d abis ]; then
  rm -rf abis
fi

mkdir abis

./node_modules/node-jq/bin/jq '.abi' build/contracts/DAIPointsToken.json > abis/DAIPointsToken_abi.json
./node_modules/node-jq/bin/jq '.abi' build/contracts/Pool.json > abis/Pool_abi.json
./node_modules/node-jq/bin/jq '.abi' build/contracts/CompoundManager.json > abis/CompoundManager_abi.json

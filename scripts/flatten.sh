#!/usr/bin/env bash

if [ -d flats ]; then
  rm -rf flats
fi

mkdir flats

./node_modules/.bin/truffle-flattener contracts/DAIPointsToken.sol > flats/DAIPointsToken_flat.sol
./node_modules/.bin/truffle-flattener contracts/Pooltogether/Pool.sol > flats/Pool_flat.sol
./node_modules/.bin/truffle-flattener contracts/Pooltogether/CompoundManager.sol > flats/CompoundManager_flat.sol

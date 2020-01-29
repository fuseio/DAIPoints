#!/usr/bin/env bash

if [ -d flats ]; then
  rm -rf flats
fi

mkdir flats

./node_modules/.bin/truffle-flattener contracts/DAIPointsToken.sol > flats/DAIPointsToken_flat.sol

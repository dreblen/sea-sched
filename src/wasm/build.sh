#!/bin/sh

emcc -O3 \
    -lembind \
    -s WASM=1 \
    -s MODULARIZE=1 \
    -s EXPORT_ES6=1 \
    -s ALLOW_MEMORY_GROWTH=1 \
    -fwasm-exceptions \
    generation-worker.cpp util/*.cpp \
    -o gw.js \
    --emit-tsd gw.d.ts

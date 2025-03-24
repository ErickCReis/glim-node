#!/bin/bash

npm i -g pnpm
pnpm i

pnpm gn migrate:up

pnpm dev

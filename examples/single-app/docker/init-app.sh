#!/bin/bash

bun install --frozen-lockfile

bunx gn migrate:up

bun dev

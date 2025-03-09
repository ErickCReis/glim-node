import { defineConfig } from "tsup";

import pkg from "./package.json";

const external = Object.keys(pkg.peerDependencies);

export default defineConfig([
  {
    entry: {
      index: "./src/index.ts",
      server: "./src/server/index.ts",
      helpers: "./src/helpers/index.ts",
      middleware: "./src/middleware/index.ts",
    },
    outDir: "./dist",
    format: "esm",
    sourcemap: true,
    splitting: true,
    dts: true,
    clean: true,
    external,
  },
  {
    entry: {
      bin: "./src/bin/index.ts",
    },
    outDir: "./dist",
    format: "esm",
    minify: true,
    clean: true,
    external,
    banner: {
      js: "#!/usr/bin/env node",
    },
  },
]);

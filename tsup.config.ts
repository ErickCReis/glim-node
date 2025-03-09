import fs from "node:fs/promises";
import path from "node:path";
import { type Options, defineConfig } from "tsup";

import pkg from "./package.json";

const external = Object.keys(pkg.peerDependencies);

async function copyDirectory(
  source: string,
  target: string,
  exclude: string[] = [],
) {
  await fs.mkdir(target, { recursive: true });
  const entries = await fs.readdir(source, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);

    if (exclude.includes(entry.name)) {
      continue;
    }

    if (entry.isDirectory()) {
      await copyDirectory(sourcePath, targetPath, exclude);
    } else {
      await fs.copyFile(sourcePath, targetPath);
    }
  }
}

export default defineConfig((options) => {
  const cli = {
    entry: {
      bin: "./src/bin/index.ts",
    },
    outDir: "./dist",
    onSuccess: async () => {
      const source = path.join(import.meta.dirname, "examples");
      const target = path.join(import.meta.dirname, "dist", "templates");
      const exclude = ["node_modules", ".env", "dist"];
      await copyDirectory(source, target, exclude);
    },
    format: "esm",
    minify: true,
    clean: true,
    external,
    banner: {
      js: "#!/usr/bin/env node",
    },
  } satisfies Options;

  if (options.watch) return cli;

  const lib = {
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
  } satisfies Options;

  return [lib, cli];
});

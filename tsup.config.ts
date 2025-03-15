import fs from "node:fs/promises";
import path from "node:path";
import { defineConfig } from "tsup";
import YAML from "yaml";

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

    if (exclude.includes(entry.name) || entry.name.endsWith(".log")) {
      continue;
    }

    if (entry.isDirectory()) {
      await copyDirectory(sourcePath, targetPath, exclude);
      continue;
    }

    if (entry.name === "package.json") {
      const data = JSON.parse(await fs.readFile(sourcePath, "utf-8"));
      data.dependencies["glim-node"] =
        `npm:@ErickCReis/glim-node@^${pkg.version}`;
      await fs.writeFile(targetPath, JSON.stringify(data, null, 2));
      continue;
    }

    if (entry.name === "docker-compose.yml") {
      const data = await fs.readFile(sourcePath, "utf-8");
      const yml = YAML.parse(data);

      yml.services.app.working_dir = ".";
      yml.services.app.volumes = [".pnpm-store", "node_modules"];

      await fs.writeFile(targetPath, YAML.stringify(yml));
      continue;
    }

    await fs.copyFile(sourcePath, targetPath);
  }
}

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
    onSuccess: async () => {
      const source = path.join(import.meta.dirname, "examples");
      const target = path.join(import.meta.dirname, "dist", "templates");
      const exclude = ["node_modules", "pnpm-lock.yaml", ".env", "dist"];
      await copyDirectory(source, target, exclude);
    },
    format: "esm",
    minify: true,
    clean: true,
    external,
    banner: {
      js: "#!/usr/bin/env node",
    },
  },
]);

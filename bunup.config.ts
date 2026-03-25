import fs from "node:fs/promises";
import path from "node:path";
import type { BunupPlugin, DefineConfigItem } from "bunup";

import pkg from "./package.json";

const rootDir = import.meta.dirname;
const oxlintConfigPath = path.join(rootDir, "oxlint.config.ts");
const oxfmtConfigPath = path.join(rootDir, "oxfmt.config.ts");

const markCliExecutable = {
  name: "mark-cli-executable",
  hooks: {
    onBuildDone: async ({ options }) => {
      const cliPath = path.join(rootDir, options.outDir, "bin", "index.js");
      await fs.chmod(cliPath, 0o755);
    },
  },
} satisfies BunupPlugin;

const copyTemplates = {
  name: "copy-templates",
  hooks: {
    onBuildDone: async ({ options }) => {
      const templatesSourceDir = path.join(rootDir, "examples");
      const templatesTargetDir = path.join(rootDir, options.outDir, "templates");
      await copyDirectory(templatesSourceDir, templatesTargetDir, [
        ".DS_Store",
        "node_modules",
        ".env",
        "dist",
        "bun.lock",
      ]);
    },
  },
} satisfies BunupPlugin;

async function copyDirectory(source: string, target: string, exclude: string[] = []) {
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
      data.dependencies["glim-node"] = `^${pkg.version}`;
      await fs.writeFile(targetPath, `${JSON.stringify(data, null, 2)}\n`);

      // Copy oxlint.config.ts and oxfmt.config.ts
      const parentDir = path.dirname(targetPath);
      await fs.copyFile(oxlintConfigPath, path.join(parentDir, "oxlint.config.ts"));
      await fs.copyFile(oxfmtConfigPath, path.join(parentDir, "oxfmt.config.ts"));
      continue;
    }

    if (entry.name === ".gitignore") {
      const newTargetPath = path.join(target, "_gitignore");
      await fs.copyFile(sourcePath, newTargetPath);
      continue;
    }

    if (entry.name === "docker-compose.yml") {
      const data = await fs.readFile(sourcePath, "utf-8");
      const yml = Bun.YAML.parse(data) as {
        services: {
          app: {
            volumes: string[];
            working_dir: string;
          };
        };
        volumes: Record<string, unknown>;
      };

      yml.services.app.working_dir = "/app";
      yml.services.app.volumes = [
        ".:/app",
        "app_data:/app/node_modules",
        "bun_cache:/root/.bun/install/cache",
      ];

      if (yml.volumes.app_data && !yml.volumes.bun_cache) {
        yml.volumes.bun_cache = null;
      }

      await fs.writeFile(targetPath, Bun.YAML.stringify(yml, null, 2));
      continue;
    }

    await fs.copyFile(sourcePath, targetPath);
  }
}
export default [
  {
    name: "library",
    entry: [
      "./src/index.ts",
      "./src/server/index.ts",
      "./src/helpers/index.ts",
      "./src/middleware/index.ts",
    ],
    outDir: "./dist",
    sourceBase: "./src",
    target: "node",
    format: "esm",
    sourcemap: "external",
    splitting: true,
    dts: true,
    clean: true,
    plugins: [copyTemplates],
  },
  {
    name: "cli",
    entry: "./src/bin/index.ts",
    outDir: "./dist",
    sourceBase: "./src",
    target: "node",
    format: "esm",
    splitting: false,
    dts: false,
    packages: "bundle",
    banner: "#!/usr/bin/env node",
    minify: true,
    clean: false,
    plugins: [markCliExecutable],
  },
] satisfies DefineConfigItem[];

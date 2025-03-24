import { type SpawnOptions, spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { Config } from "drizzle-kit";

export async function createTempDrizzleConfig(config: Config) {
  const content = `
import { defineConfig } from "drizzle-kit";
export default defineConfig(${JSON.stringify(config)});
`;

  const tempFilePath = path.join(
    os.tmpdir(),
    `drizzle.config.${Date.now()}.ts`,
  );
  await fs.writeFile(tempFilePath, content);

  return tempFilePath;
}

export async function execCommand(
  command: string,
  args: string[],
  options: SpawnOptions = {},
) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      ...options,
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Process exited with code ${code}`));
      }
    });
  });
}

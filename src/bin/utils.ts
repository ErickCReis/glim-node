import { type SpawnOptions, spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { Config } from "drizzle-kit";

/**
 * Verifica se o projeto está usando a estrutura de app (GnApp)
 * em vez da estrutura de módulo (GnModule)
 */
export async function isAppStructure(): Promise<boolean> {
  try {
    // Verifica se existe o diretório src/db/models que é característico da estrutura de app
    await fs.access("./src/db/models");
    return true;
  } catch {
    // Se não existir, estamos na estrutura de módulo
    return false;
  }
}

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

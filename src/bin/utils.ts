import { type SpawnOptions, spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { Config } from "drizzle-kit";

/**
 * Verifica se o projeto está usando a estrutura de app (GnApp)
 * em vez da estrutura de módulo (GnModule)
 */
export async function isAppStructure(
  cwd = process.cwd(),
  fileSystem: Pick<typeof fs, "access"> = fs,
): Promise<boolean> {
  try {
    // Verifica se existe o diretório src/db/models que é característico da estrutura de app
    await fileSystem.access(path.join(cwd, "src", "db", "models"));
    return true;
  } catch {
    // Se não existir, estamos na estrutura de módulo
    return false;
  }
}

type TempDrizzleConfigRuntime = {
  now?: () => number;
  tmpdir?: () => string;
  writeFile?: typeof fs.writeFile;
};

export async function createTempDrizzleConfig(
  config: Config,
  runtime: TempDrizzleConfigRuntime = {},
) {
  const content = `
import { defineConfig } from "drizzle-kit";
export default defineConfig(${JSON.stringify(config)});
`;
  const writeFile = runtime.writeFile ?? fs.writeFile;
  const tmpdir = runtime.tmpdir ?? os.tmpdir;
  const now = runtime.now ?? Date.now;

  const tempFilePath = path.join(tmpdir(), `drizzle.config.${now()}.ts`);
  await writeFile(tempFilePath, content);

  return tempFilePath;
}

type ExecCommandRuntime = {
  spawn?: typeof spawn;
};

export async function execCommand(
  command: string,
  args: string[],
  options: SpawnOptions = {},
  runtime: ExecCommandRuntime = {},
) {
  const spawnCommand = runtime.spawn ?? spawn;
  return new Promise<void>((resolve, reject) => {
    const child = spawnCommand(command, args, {
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

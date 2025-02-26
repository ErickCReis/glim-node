import type { Config } from "drizzle-kit";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

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

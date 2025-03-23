import "dotenv/config";

import { log } from "@clack/prompts";
import { createTempDrizzleConfig, execCommand } from "@core/bin/utils";
import { getPostgresEnv } from "@core/helpers/postgres";

export async function runMigrations(moduleInput: string) {
  log.step("Aplicando migrations");

  const dbEnv = getPostgresEnv(moduleInput);
  const drizzleConfigPath = await createTempDrizzleConfig({
    dialect: "postgresql",
    dbCredentials: {
      url: dbEnv.url,
    },
    out: `./modules/${moduleInput}/db/migrations`,
  });

  try {
    await execCommand("pnpm", [
      "drizzle-kit",
      "migrate",
      `--config=${drizzleConfigPath}`,
    ]);
    log.info("Migrations aplicadas com sucesso!");
  } catch (error) {
    throw new Error("Não foi possível aplicar as migrations");
  }
}

import "dotenv/config";

import { log } from "@clack/prompts";
import {
  createTempDrizzleConfig,
  execCommand,
  isAppStructure,
} from "@core/bin/utils";
import { getPostgresEnv } from "@core/helpers/postgres";

export async function runMigrations(moduleInput: string) {
  log.step("Aplicando migrations");

  // Verificar se estamos trabalhando com a nova estrutura de app
  const isApp = await isAppStructure();

  // Na estrutura de app, não precisamos passar o namespace para getPostgresEnv
  const dbEnv = isApp ? getPostgresEnv() : getPostgresEnv(moduleInput);
  const outPath = isApp
    ? "./src/db/migrations"
    : `./modules/${moduleInput}/db/migrations`;

  const drizzleConfigPath = await createTempDrizzleConfig({
    dialect: "postgresql",
    dbCredentials: {
      url: dbEnv.url,
    },
    out: outPath,
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

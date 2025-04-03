import { log } from "@clack/prompts";
import {
  createTempDrizzleConfig,
  execCommand,
  isAppStructure,
} from "@core/bin/utils";

export async function generateMigration(moduleInput: string) {
  log.step("Gerando migrations");

  // Verificar se estamos trabalhando com a nova estrutura de app
  const isApp = await isAppStructure();

  const schemaPath = isApp
    ? "./src/db/models/"
    : `./modules/${moduleInput}/db/models/`;
  const outPath = isApp
    ? "./src/db/migrations"
    : `./modules/${moduleInput}/db/migrations`;

  const drizzleConfigPath = await createTempDrizzleConfig({
    dialect: "postgresql",
    schema: schemaPath,
    out: outPath,
  });

  try {
    await execCommand("pnpm", [
      "drizzle-kit",
      "generate",
      `--config=${drizzleConfigPath}`,
    ]);
    log.info("Migrations geradas com sucesso!");
  } catch (error) {
    throw new Error("Não foi possível gerar as migrations");
  }
}

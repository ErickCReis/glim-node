import { log } from "@clack/prompts";
import { createTempDrizzleConfig, execCommand } from "@core/bin/utils";

export async function generateMigration(moduleInput: string) {
  log.step("Gerando migrations");

  const drizzleConfigPath = await createTempDrizzleConfig({
    dialect: "postgresql",
    schema: `./modules/${moduleInput}/db/models/`,
    out: `./modules/${moduleInput}/db/migrations`,
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

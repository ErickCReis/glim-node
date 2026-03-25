import { log } from "@clack/prompts";
import {
  createTempDrizzleConfig,
  execCommand,
  isAppStructure,
} from "@core/bin/utils";

type GenerateMigrationRuntime = {
  createTempDrizzleConfig?: typeof createTempDrizzleConfig;
  execCommand?: typeof execCommand;
  isAppStructure?: typeof isAppStructure;
  log?: Pick<typeof log, "info" | "step">;
};

function resolveRuntime(runtime: GenerateMigrationRuntime = {}) {
  return {
    createTempDrizzleConfig:
      runtime.createTempDrizzleConfig ?? createTempDrizzleConfig,
    execCommand: runtime.execCommand ?? execCommand,
    isAppStructure: runtime.isAppStructure ?? isAppStructure,
    log: runtime.log ?? log,
  };
}

export async function generateMigration(moduleInput: string) {
  return generateMigrationWithRuntime(moduleInput);
}

export async function generateMigrationWithRuntime(
  moduleInput: string,
  runtime: GenerateMigrationRuntime = {},
) {
  const resolvedRuntime = resolveRuntime(runtime);
  resolvedRuntime.log.step("Gerando migrations");

  const isApp = await resolvedRuntime.isAppStructure();
  const schemaPath = isApp
    ? "./src/db/models/"
    : `./modules/${moduleInput}/db/models/`;
  const outPath = isApp
    ? "./src/db/migrations"
    : `./modules/${moduleInput}/db/migrations`;

  const drizzleConfigPath = await resolvedRuntime.createTempDrizzleConfig({
    dialect: "postgresql",
    schema: schemaPath,
    out: outPath,
  });

  try {
    await resolvedRuntime.execCommand("bun", [
      "x",
      "drizzle-kit",
      "generate",
      `--config=${drizzleConfigPath}`,
    ]);
    resolvedRuntime.log.info("Migrations geradas com sucesso!");
  } catch {
    throw new Error("Não foi possível gerar as migrations");
  }
}

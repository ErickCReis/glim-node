import "dotenv/config";

import { log } from "@clack/prompts";
import {
  createTempDrizzleConfig,
  execCommand,
  isAppStructure,
} from "@core/bin/utils";
import { getPostgresEnv } from "@core/helpers/postgres";

type RunMigrationsRuntime = {
  createTempDrizzleConfig?: typeof createTempDrizzleConfig;
  execCommand?: typeof execCommand;
  getPostgresEnv?: typeof getPostgresEnv;
  isAppStructure?: typeof isAppStructure;
  log?: Pick<typeof log, "info" | "step">;
};

function resolveRuntime(runtime: RunMigrationsRuntime = {}) {
  return {
    createTempDrizzleConfig:
      runtime.createTempDrizzleConfig ?? createTempDrizzleConfig,
    execCommand: runtime.execCommand ?? execCommand,
    getPostgresEnv: runtime.getPostgresEnv ?? getPostgresEnv,
    isAppStructure: runtime.isAppStructure ?? isAppStructure,
    log: runtime.log ?? log,
  };
}

export async function runMigrations(moduleInput: string) {
  return runMigrationsWithRuntime(moduleInput);
}

export async function runMigrationsWithRuntime(
  moduleInput: string,
  runtime: RunMigrationsRuntime = {},
) {
  const resolvedRuntime = resolveRuntime(runtime);
  resolvedRuntime.log.step("Aplicando migrations");

  const isApp = await resolvedRuntime.isAppStructure();
  const dbEnv = isApp
    ? resolvedRuntime.getPostgresEnv()
    : resolvedRuntime.getPostgresEnv(moduleInput);
  const outPath = isApp
    ? "./src/db/migrations"
    : `./modules/${moduleInput}/db/migrations`;

  const drizzleConfigPath = await resolvedRuntime.createTempDrizzleConfig({
    dialect: "postgresql",
    dbCredentials: {
      url: dbEnv.url,
    },
    out: outPath,
  });

  try {
    await resolvedRuntime.execCommand("bun", [
      "x",
      "drizzle-kit",
      "migrate",
      `--config=${drizzleConfigPath}`,
    ]);
    resolvedRuntime.log.info("Migrations aplicadas com sucesso!");
  } catch {
    throw new Error("Não foi possível aplicar as migrations");
  }
}

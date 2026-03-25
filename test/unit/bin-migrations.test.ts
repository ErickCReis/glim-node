import { describe, expect, it, mock } from "bun:test";
import { generateMigrationWithRuntime } from "../../src/bin/commands/migrate-gen";
import { runMigrationsWithRuntime } from "../../src/bin/commands/migrate-up";

describe("migration commands", () => {
  it("generates migrations using module paths when the project is modular", async () => {
    const createTempDrizzleConfig = mock(async () => "/tmp/drizzle.generate.ts");
    const execCommand = mock(async () => undefined);

    await generateMigrationWithRuntime("billing", {
      createTempDrizzleConfig,
      execCommand: execCommand as never,
      isAppStructure: async () => false,
      log: {
        info: mock(() => undefined),
        step: mock(() => undefined),
      },
    });

    expect(createTempDrizzleConfig).toHaveBeenCalledWith({
      dialect: "postgresql",
      schema: "./modules/billing/db/models/",
      out: "./modules/billing/db/migrations",
    });
    expect(execCommand).toHaveBeenCalledWith("bun", [
      "x",
      "drizzle-kit",
      "generate",
      "--config=/tmp/drizzle.generate.ts",
    ]);
  });

  it("runs migrations using app paths when the project is an app", async () => {
    const createTempDrizzleConfig = mock(async () => "/tmp/drizzle.migrate.ts");
    const execCommand = mock(async () => undefined);

    await runMigrationsWithRuntime("ignored", {
      createTempDrizzleConfig,
      execCommand: execCommand as never,
      getPostgresEnv: (() => ({
        url: "postgresql://user:pw@db.local/app",
      })) as never,
      isAppStructure: async () => true,
      log: {
        info: mock(() => undefined),
        step: mock(() => undefined),
      },
    });

    expect(createTempDrizzleConfig).toHaveBeenCalledWith({
      dialect: "postgresql",
      dbCredentials: {
        url: "postgresql://user:pw@db.local/app",
      },
      out: "./src/db/migrations",
    });
    expect(execCommand).toHaveBeenCalledWith("bun", [
      "x",
      "drizzle-kit",
      "migrate",
      "--config=/tmp/drizzle.migrate.ts",
    ]);
  });

  it("wraps command failures with stable error messages", async () => {
    expect(
      generateMigrationWithRuntime("billing", {
        createTempDrizzleConfig: async () => "/tmp/drizzle.generate.ts",
        execCommand: mock(async () => {
          throw new Error("boom");
        }) as never,
        isAppStructure: async () => false,
        log: {
          info: mock(() => undefined),
          step: mock(() => undefined),
        },
      }),
    ).rejects.toThrow("Não foi possível gerar as migrations");

    expect(
      runMigrationsWithRuntime("billing", {
        createTempDrizzleConfig: async () => "/tmp/drizzle.migrate.ts",
        execCommand: mock(async () => {
          throw new Error("boom");
        }) as never,
        getPostgresEnv: (() => ({
          url: "postgresql://user:pw@db.local/billing",
        })) as never,
        isAppStructure: async () => false,
        log: {
          info: mock(() => undefined),
          step: mock(() => undefined),
        },
      }),
    ).rejects.toThrow("Não foi possível aplicar as migrations");
  });
});

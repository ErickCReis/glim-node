import { parse } from "@bomb.sh/args";
import { cancel, intro, isCancel, log, outro, select } from "@clack/prompts";
import { createTempDrizzleConfig } from "@core/commands/utils.js";
import "dotenv/config";
import { spawn } from "node:child_process";
import { readdir } from "node:fs/promises";

intro("Migrate Up");

log.step("Verificando módulos");
const modules = (await readdir("./modules", { withFileTypes: true }))
  .filter((d) => d.isDirectory())
  .map((d) => d.name);

const args = parse(process.argv.slice(2), { string: ["module"] });

let moduleInput = args.module;
if (moduleInput && !modules.includes(moduleInput)) {
  log.warn(`Módulo "${moduleInput}" não encontrado`);
}

if (!moduleInput || !modules.includes(moduleInput)) {
  const moduleSelected = await select({
    message: "Selecione um módulo",
    options: modules.map((m) => ({ label: m, value: m })),
  });

  if (isCancel(moduleSelected)) {
    cancel("Operation cancelled.");
    process.exit(0);
  }

  moduleInput = moduleSelected;
}

log.step("Aplicando migrations");

const drizzleConfigPath = await createTempDrizzleConfig({
  dialect: "postgresql",
  dbCredentials: {
    // biome-ignore lint/style/noNonNullAssertion: <explanation>
    url: process.env.DB_MS_CRONOGRAMA!,
  },
  out: `./modules/${moduleInput}/db/migrations`,
});

await new Promise<void>((resolve, reject) => {
  const child = spawn(
    "pnpm",
    ["drizzle-kit", "migrate", `--config=${drizzleConfigPath}`],
    { stdio: "inherit" },
  );

  child.on("error", reject);
  child.on("close", (data) => {
    if (data === 1) {
      reject();
    } else {
      resolve();
    }
  });
}).catch(() => {
  log.error("Não foi possível aplicar as migrations");
  process.exit(1);
});

outro("Migrate Up");

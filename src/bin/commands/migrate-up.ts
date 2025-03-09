import "dotenv/config";

import { spawn } from "node:child_process";
import { readdir } from "node:fs/promises";
import { parse } from "@bomb.sh/args";
import { cancel, isCancel, log, select } from "@clack/prompts";
import { createTempDrizzleConfig } from "@core/bin/utils";
import { getPostgresEnv } from "@core/helpers/env.js";

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

const dbEnv = getPostgresEnv(moduleInput);

const drizzleConfigPath = await createTempDrizzleConfig({
  dialect: "postgresql",
  dbCredentials: {
    url: dbEnv.url,
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

import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { cancel, intro, isCancel, log, select, text } from "@clack/prompts";
import { isAppStructure } from "@core/bin/utils";

async function getSelectedModule(moduleArg?: string, folderPath = "") {
  log.step("Verificando módulos");

  // Verifica se estamos usando a estrutura de app
  const isApp = await isAppStructure();

  if (isApp) {
    // Na estrutura de app, não há seleção de módulo
    log.info("Utilizando estrutura de aplicativo sem namespace");
    return "app";
  }

  // Estrutura de módulos tradicional
  const modules = (await readdir("./modules", { withFileTypes: true }))
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((name) => {
      const fullPath = path.join("./modules", name, folderPath);
      return existsSync(fullPath);
    });

  if (modules.length === 0) {
    throw new Error(
      `Nenhum módulo encontrado com a pasta '${folderPath}' válida`,
    );
  }

  if (modules.length === 1) {
    log.info(`Utilizando o único módulo disponível: ${modules[0]}`);
    return modules[0] as string;
  }

  if (moduleArg && !modules.includes(moduleArg)) {
    log.warn(
      `Módulo "${moduleArg}" não encontrado ou não possui pasta '${folderPath}'`,
    );
  }

  if (!moduleArg || !modules.includes(moduleArg)) {
    const moduleSelected = await select({
      message: "Selecione um módulo",
      options: modules.map((m) => ({ label: m, value: m })),
    });

    if (isCancel(moduleSelected)) {
      cancel("Operação cancelada.");
      process.exit(1);
    }

    return moduleSelected;
  }

  return moduleArg;
}

async function handleCommand(command: string, args: Record<string, string>) {
  switch (command) {
    case "create": {
      const projectName = await validateAndGetProjectName(args.name);
      const { createProject } = await import("./commands/create");
      await createProject(projectName);
      break;
    }
    case "migrate:gen": {
      const moduleForGen = await getSelectedModule(args.module, "db/models");
      const { generateMigration } = await import("./commands/migrate-gen");
      await generateMigration(moduleForGen);
      break;
    }
    case "migrate:up": {
      const moduleForUp = await getSelectedModule(args.module, "db/migrations");
      const { runMigrations } = await import("./commands/migrate-up");
      await runMigrations(moduleForUp);
      break;
    }
    default:
      throw new Error(`Comando desconhecido: "${command}"`);
  }
}

async function selectCommand(directCommand: string | undefined) {
  if (directCommand) return directCommand;

  const selectedCommand = await select({
    message: "Escolha um comando:",
    options: [
      { value: "create", label: "Criar um novo projeto" },
      { value: "migrate:gen", label: "Gerar migrations" },
      { value: "migrate:up", label: "Executar migrations" },
    ],
  });

  if (isCancel(selectedCommand)) {
    cancel("Operação cancelada.");
    process.exit(1);
  }

  return selectedCommand;
}

async function validateAndGetProjectName(initialName?: string) {
  let projectName = initialName;

  if (projectName && !/^[a-z0-9-]+$/.test(projectName)) {
    log.warn(
      "O nome do projeto deve conter apenas letras minúsculas, números e hífens",
    );
    projectName = undefined;
  }

  if (!projectName) {
    const nameInput = await text({
      message: "Qual é o nome do projeto?",
      validate: (value) => {
        if (!value) return "O nome do projeto é obrigatório";
        if (!/^[a-z0-9-]+$/.test(value)) {
          return "O nome do projeto deve conter apenas letras minúsculas, números e hífens";
        }
      },
    });

    if (isCancel(nameInput)) {
      cancel("Operação cancelada.");
      process.exit(1);
    }

    projectName = nameInput;
  }

  return projectName;
}

function handleError(error: unknown, command?: string) {
  if (error instanceof Error) {
    const message = command
      ? `Erro ao executar o comando "${command}": ${error.message}`
      : error.message;
    log.error(message);
  } else {
    log.error(`Erro inesperado: ${error}`);
  }
  process.exit(1);
}

async function main() {
  intro("Glim Node");

  const {
    positionals: [directCommand],
    values: args,
  } = parseArgs({
    args: process.argv.slice(2),
    allowPositionals: true,
    options: {
      module: { type: "string" },
      name: { type: "string" },
    },
  });

  try {
    const command = await selectCommand(directCommand);
    await handleCommand(command, args);
    log.success(`Comando "${command}" executado com sucesso!`);
  } catch (error) {
    handleError(error, directCommand);
  }
}

main().catch((error) => {
  handleError(error);
  process.exit(1);
});

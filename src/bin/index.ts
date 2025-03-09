import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { parse } from "@bomb.sh/args";
import {
  cancel,
  intro,
  isCancel,
  log,
  outro,
  select,
  text,
} from "@clack/prompts";

async function getSelectedModule(moduleArg?: string, folderPath = "") {
  log.step("Verificando módulos");
  const modules = (await readdir("./modules", { withFileTypes: true }))
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((name) => {
      const fullPath = path.join("./modules", name, folderPath);
      return existsSync(fullPath);
    });

  if (modules.length === 0) {
    log.error(`Nenhum módulo encontrado com a pasta '${folderPath}' válida`);
    process.exit(1);
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
      process.exit(0);
    }

    return moduleSelected;
  }

  return moduleArg;
}

async function main() {
  intro("Glim Node");

  const args = parse(process.argv.slice(2), { string: ["module", "name"] });
  const [directCommand] = args._;

  let command = directCommand;
  if (!command) {
    const selectedCommand = await select({
      message: "Escolha um comando:",
      options: [
        { value: "create", label: "Criar um novo projeto" },
        { value: "migrate:gen", label: "Gerar migrations" },
        { value: "migrate:up", label: "Executar migrations" },
      ],
    });

    if (isCancel(selectedCommand)) {
      outro("Saindo...");
      process.exit(0);
    }

    command = selectedCommand;
  }

  try {
    switch (command) {
      case "create": {
        let projectName = args.name;

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
            process.exit(0);
          }

          projectName = nameInput;
        }

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
        const moduleForUp = await getSelectedModule(
          args.module,
          "db/migrations",
        );
        const { runMigrations } = await import("./commands/migrate-up");
        await runMigrations(moduleForUp);
        break;
      }

      default:
        log.error(`Comando desconhecido: "${command}"`);
        process.exit(1);
    }
    outro(`Comando "${command}" executado com sucesso!`);
  } catch (error) {
    log.error(
      `Erro ao executar o comando "${command}": ${(error as Error).message}`,
    );
    outro("Glim Node falhou.");
  }
}

main().catch((error) => {
  log.error(`Erro inesperado: ${error}`);
  process.exit(1);
});

import { log, tasks } from "@clack/prompts";
import { execCommand } from "@core/bin/utils";
import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";

export async function createProject(projectName: string) {
  log.step("Criando novo projeto");

  const templatePath = path.join(import.meta.dirname, "templates", "task-api");
  const targetPath = path.join(process.cwd(), projectName);

  if (existsSync(targetPath)) {
    throw new Error(`Diretório "${projectName}" já existe`);
  }

  try {
    await tasks([
      {
        title: "Copiando template",
        task: async () => {
          // Copy template files
          await copyDirectory(templatePath, targetPath, [
            "node_modules",
            ".env",
            "dist",
          ]);

          // Update package.json
          const packageJsonPath = path.join(targetPath, "package.json");
          const packageJson = JSON.parse(
            await fs.readFile(packageJsonPath, "utf-8"),
          );
          packageJson.name = projectName;
          await fs.writeFile(
            packageJsonPath,
            JSON.stringify(packageJson, null, 2),
          );

          // Copy .env.example to .env
          await fs.copyFile(
            path.join(targetPath, ".env.example"),
            path.join(targetPath, ".env"),
          );

          return "Template copiado com sucesso!";
        },
      },
      {
        title: "Configurando permissões dos scripts",
        task: async () => {
          const dockerPath = path.join(targetPath, "docker");
          const scripts = ["init-app.sh", "init-localstack.sh"];

          for (const script of scripts) {
            await execCommand("chmod", ["+x", script], { cwd: dockerPath });
          }

          return "Permissões configuradas com sucesso!";
        },
      },
      {
        title: "Instalando dependências",
        task: async () => {
          await execCommand("pnpm", ["install", "--lockfile-only"], {
            cwd: targetPath,
            stdio: "ignore",
          });
          return "Dependências instaladas com sucesso!";
        },
      },
      {
        title: "Iniciando git",
        task: async () => {
          await execCommand("git", ["init"], {
            cwd: targetPath,
            stdio: "ignore",
          });
          await execCommand("git", ["add", "."], {
            cwd: targetPath,
            stdio: "ignore",
          });
          await execCommand("git", ["commit", "-m", "initial commit"], {
            cwd: targetPath,
            stdio: "ignore",
          });

          return "Git iniciado com sucesso!";
        },
      },
    ]);

    log.info(`Próximos passos:
  1. cd ${projectName}
  2. docker compose up`);
  } catch (error) {
    throw new Error(`Falha ao criar projeto: ${(error as Error).message}`);
  }
}

async function copyDirectory(
  source: string,
  target: string,
  exclude: string[] = [],
) {
  await fs.mkdir(target, { recursive: true });
  const entries = await fs.readdir(source, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);

    if (exclude.includes(entry.name)) {
      continue;
    }

    if (entry.name === "_gitignore") {
      const newTargetPath = path.join(target, ".gitignore");
      await fs.copyFile(sourcePath, newTargetPath);
      continue;
    }

    if (entry.isDirectory()) {
      await copyDirectory(sourcePath, targetPath, exclude);
    } else {
      await fs.copyFile(sourcePath, targetPath);
    }
  }
}

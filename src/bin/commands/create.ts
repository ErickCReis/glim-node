import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { log } from "@clack/prompts";

export async function createProject(projectName: string) {
  log.step("Criando novo projeto");

  const templatePath = path.join(
    import.meta.dirname,
    "templates",
    "cronograma-api",
  );
  const targetPath = path.join(process.cwd(), projectName);

  if (existsSync(targetPath)) {
    throw new Error(`Diretório "${projectName}" já existe`);
  }

  try {
    // Copy template files
    await copyDirectory(templatePath, targetPath, [
      "node_modules",
      ".env",
      "dist",
    ]);

    // Update package.json
    const packageJsonPath = path.join(targetPath, "package.json");
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, "utf-8"));
    packageJson.name = projectName;
    await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));

    // Copy .env.example to .env
    await fs.copyFile(
      path.join(targetPath, ".env.example"),
      path.join(targetPath, ".env"),
    );

    log.info("Projeto criado com sucesso!");
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

    if (entry.isDirectory()) {
      await copyDirectory(sourcePath, targetPath, exclude);
    } else {
      await fs.copyFile(sourcePath, targetPath);
    }
  }
}

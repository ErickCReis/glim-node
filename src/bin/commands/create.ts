import fs from "node:fs/promises";
import path from "node:path";
import { log } from "@clack/prompts";

export async function createProject(projectName: string) {
  log.step("Creating new project");

  const templatePath = path.join(
    import.meta.dirname,
    "templates",
    "cronograma-api",
  );
  const targetPath = path.join(process.cwd(), projectName);

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

    log.info("Project created successfully!");
    log.info("Next steps:");
    log.step(`1. cd ${projectName}`);
    log.step("2. pnpm install");
    log.step("3. docker compose up");
  } catch (error) {
    throw new Error(`Failed to scaffold project: ${(error as Error).message}`);
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

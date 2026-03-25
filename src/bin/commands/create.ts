import fs from "node:fs/promises";
import path from "node:path";
import { cancel, isCancel, log, select, tasks } from "@clack/prompts";
import { execCommand } from "@core/bin/utils";

type TaskDefinition = {
  title: string;
  task: () => Promise<string> | string;
};

type CreateProjectRuntime = {
  cancel: typeof cancel;
  cwd: () => string;
  execCommand: typeof execCommand;
  exit: typeof process.exit;
  fs: typeof fs;
  getTemplatesDir: () => string;
  isCancel: typeof isCancel;
  log: Pick<typeof log, "info" | "step">;
  path: typeof path;
  select: typeof select;
  tasks: (tasks: TaskDefinition[]) => Promise<unknown>;
};

function getDefaultTemplatesDir() {
  return (
    process.env.GLIM_TEMPLATES_DIR ??
    path.join(import.meta.dirname, "templates")
  );
}

function resolveRuntime(
  runtime: Partial<CreateProjectRuntime> = {},
): CreateProjectRuntime {
  return {
    cancel: runtime.cancel ?? cancel,
    cwd: runtime.cwd ?? (() => process.cwd()),
    execCommand: runtime.execCommand ?? execCommand,
    exit: runtime.exit ?? process.exit,
    fs: runtime.fs ?? fs,
    getTemplatesDir: runtime.getTemplatesDir ?? getDefaultTemplatesDir,
    isCancel: runtime.isCancel ?? isCancel,
    log: runtime.log ?? log,
    path: runtime.path ?? path,
    select: runtime.select ?? select,
    tasks: runtime.tasks ?? tasks,
  };
}

async function getAvailableTemplates(runtime: CreateProjectRuntime) {
  const entries = await runtime.fs.readdir(runtime.getTemplatesDir(), {
    withFileTypes: true,
  });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

async function selectTemplate(
  runtime: CreateProjectRuntime,
  templates: string[],
) {
  if (templates.length === 1) {
    runtime.log.info(`Utilizando o único template disponível: ${templates[0]}`);
    return templates[0] as string;
  }

  const templateSelected = await runtime.select({
    message: "Selecione um template para o projeto",
    options: templates.map((template) => ({
      label: template,
      value: template,
    })),
  });

  if (runtime.isCancel(templateSelected)) {
    runtime.cancel("Operação cancelada.");
    runtime.exit(1);
  }

  return templateSelected as string;
}

export async function createProject(projectName: string) {
  return createProjectWithRuntime(projectName);
}

export async function createProjectWithRuntime(
  projectName: string,
  runtime: Partial<CreateProjectRuntime> = {},
) {
  const resolvedRuntime = resolveRuntime(runtime);
  resolvedRuntime.log.step("Criando novo projeto");

  const templates = await getAvailableTemplates(resolvedRuntime);
  const selectedTemplate = await selectTemplate(resolvedRuntime, templates);

  resolvedRuntime.log.info(`Utilizando template: ${selectedTemplate}`);

  const templatePath = resolvedRuntime.path.join(
    resolvedRuntime.getTemplatesDir(),
    selectedTemplate,
  );
  const targetPath = resolvedRuntime.path.join(
    resolvedRuntime.cwd(),
    projectName,
  );

  try {
    await resolvedRuntime.fs.access(targetPath);
    throw new Error(`Diretório "${projectName}" já existe`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }

  try {
    await resolvedRuntime.tasks([
      {
        title: "Copiando template",
        task: async () => {
          await copyDirectory(resolvedRuntime, templatePath, targetPath, [
            "node_modules",
            ".env",
            "dist",
            "bun.lock",
            "bun.lockb",
          ]);

          const packageJsonPath = resolvedRuntime.path.join(
            targetPath,
            "package.json",
          );
          const packageJson = JSON.parse(
            await resolvedRuntime.fs.readFile(packageJsonPath, "utf-8"),
          );
          packageJson.name = projectName;
          await resolvedRuntime.fs.writeFile(
            packageJsonPath,
            JSON.stringify(packageJson, null, 2),
          );

          await resolvedRuntime.fs.copyFile(
            resolvedRuntime.path.join(targetPath, ".env.example"),
            resolvedRuntime.path.join(targetPath, ".env"),
          );

          return "Template copiado com sucesso!";
        },
      },
      {
        title: "Configurando permissões dos scripts",
        task: async () => {
          const dockerPath = resolvedRuntime.path.join(targetPath, "docker");
          const scripts = ["init-app.sh", "init-localstack.sh"];

          for (const script of scripts) {
            await resolvedRuntime.execCommand("chmod", ["+x", script], {
              cwd: dockerPath,
            });
          }

          return "Permissões configuradas com sucesso!";
        },
      },
      {
        title: "Instalando dependências",
        task: async () => {
          await resolvedRuntime.execCommand(
            "bun",
            ["install", "--save-text-lockfile", "--lockfile-only"],
            {
              cwd: targetPath,
              stdio: "ignore",
            },
          );
          return "Dependências instaladas com sucesso!";
        },
      },
      {
        title: "Iniciando git",
        task: async () => {
          await resolvedRuntime.execCommand("git", ["init"], {
            cwd: targetPath,
            stdio: "ignore",
          });
          await resolvedRuntime.execCommand("git", ["add", "."], {
            cwd: targetPath,
            stdio: "ignore",
          });
          await resolvedRuntime.execCommand(
            "git",
            ["commit", "-m", "initial commit"],
            {
              cwd: targetPath,
              stdio: "ignore",
            },
          );

          return "Git iniciado com sucesso!";
        },
      },
    ]);

    resolvedRuntime.log.info(`Próximos passos:
  1. cd ${projectName}
  2. docker compose up`);
  } catch (error) {
    throw new Error(`Falha ao criar projeto: ${(error as Error).message}`);
  }
}

async function copyDirectory(
  runtime: CreateProjectRuntime,
  source: string,
  target: string,
  exclude: string[] = [],
) {
  await runtime.fs.mkdir(target, { recursive: true });
  const entries = await runtime.fs.readdir(source, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = runtime.path.join(source, entry.name);
    const targetPath = runtime.path.join(target, entry.name);

    if (exclude.includes(entry.name)) {
      continue;
    }

    if (entry.name === "_gitignore") {
      await runtime.fs.copyFile(
        sourcePath,
        runtime.path.join(target, ".gitignore"),
      );
      continue;
    }

    if (entry.isDirectory()) {
      await copyDirectory(runtime, sourcePath, targetPath, exclude);
      continue;
    }

    await runtime.fs.copyFile(sourcePath, targetPath);
  }
}

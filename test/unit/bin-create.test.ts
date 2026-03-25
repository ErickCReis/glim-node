import { describe, expect, it, mock } from "bun:test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createProjectWithRuntime } from "../../src/bin/commands/create";
import { withTempDir } from "../support";

describe("createProjectWithRuntime", () => {
  it("creates a project using injected command execution", async () => {
    await withTempDir("glim-create-template", async (templateRoot) => {
      const templatesDir = path.join(templateRoot, "templates");
      const templateDir = path.join(templatesDir, "single-app");
      await mkdir(path.join(templateDir, "docker"), { recursive: true });
      await writeFile(
        path.join(templateDir, "package.json"),
        JSON.stringify({ name: "template-name", version: "1.0.0" }, null, 2),
      );
      await writeFile(path.join(templateDir, ".env.example"), "APP_NAME=test\n");
      await writeFile(path.join(templateDir, "_gitignore"), "node_modules\n");
      await writeFile(path.join(templateDir, "docker", "init-app.sh"), "#!/bin/sh\n");
      await writeFile(path.join(templateDir, "docker", "init-localstack.sh"), "#!/bin/sh\n");

      await withTempDir("glim-create-target", async (targetRoot) => {
        const execCommand = mock(async () => undefined);

        await createProjectWithRuntime("acme-app", {
          cwd: () => targetRoot,
          execCommand: execCommand as never,
          getTemplatesDir: () => templatesDir,
          log: {
            info: mock(() => undefined),
            step: mock(() => undefined),
          },
          tasks: async (entries) => {
            for (const entry of entries) {
              await entry.task();
            }
          },
        });

        const packageJson = JSON.parse(
          await readFile(path.join(targetRoot, "acme-app", "package.json"), "utf8"),
        );
        expect(packageJson.name).toBe("acme-app");
        expect(await readFile(path.join(targetRoot, "acme-app", ".env"), "utf8")).toBe(
          "APP_NAME=test\n",
        );
        expect(await readFile(path.join(targetRoot, "acme-app", ".gitignore"), "utf8")).toBe(
          "node_modules\n",
        );
        expect(
          (
            execCommand.mock.calls as unknown as Array<
              [string, string[], { cwd?: string } | undefined]
            >
          ).map(([command, args, options]) => ({
            args,
            command,
            cwd: options?.cwd,
          })),
        ).toEqual([
          {
            command: "chmod",
            args: ["+x", "init-app.sh"],
            cwd: path.join(targetRoot, "acme-app", "docker"),
          },
          {
            command: "chmod",
            args: ["+x", "init-localstack.sh"],
            cwd: path.join(targetRoot, "acme-app", "docker"),
          },
          {
            command: "bun",
            args: ["install", "--save-text-lockfile", "--lockfile-only"],
            cwd: path.join(targetRoot, "acme-app"),
          },
          {
            command: "git",
            args: ["init"],
            cwd: path.join(targetRoot, "acme-app"),
          },
          {
            command: "git",
            args: ["add", "."],
            cwd: path.join(targetRoot, "acme-app"),
          },
          {
            command: "git",
            args: ["commit", "-m", "initial commit"],
            cwd: path.join(targetRoot, "acme-app"),
          },
        ]);
      });
    });
  });

  it("fails when the target directory already exists", async () => {
    await withTempDir("glim-create-existing", async (targetRoot) => {
      const templatesDir = path.join(targetRoot, "templates");
      await mkdir(path.join(templatesDir, "single-app"), { recursive: true });
      await mkdir(path.join(targetRoot, "acme-app"));

      await expect(
        createProjectWithRuntime("acme-app", {
          cwd: () => targetRoot,
          getTemplatesDir: () => templatesDir,
          log: {
            info: mock(() => undefined),
            step: mock(() => undefined),
          },
          tasks: async (entries) => {
            for (const entry of entries) {
              await entry.task();
            }
          },
        }),
      ).rejects.toThrow('Diretório "acme-app" já existe');
    });
  });
});

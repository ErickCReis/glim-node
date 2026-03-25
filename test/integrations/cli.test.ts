import { describe, expect, it } from "bun:test";
import { spawn } from "node:child_process";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createProject } from "../../src/bin/commands/create";
import { generateMigration } from "../../src/bin/commands/migrate-gen";
import { runMigrations } from "../../src/bin/commands/migrate-up";
import {
  withCwd,
  withEnv,
  withSuppressedOutput,
  withTempDir,
} from "../support";

async function writeExecutable(filePath: string, source: string) {
  await writeFile(filePath, source);
  await chmod(filePath, 0o755);
}

describe("cli integrations", () => {
  it("creates a project from a temp template directory", async () => {
    await withTempDir("glim-create-template", async (templateRoot) => {
      const templatesDir = path.join(templateRoot, "templates");
      const templateDir = path.join(templatesDir, "single-app");
      const binDir = path.join(templateRoot, "bin");
      await mkdir(path.join(templateDir, "docker"), { recursive: true });
      await mkdir(binDir, { recursive: true });
      await writeFile(
        path.join(templateDir, "package.json"),
        JSON.stringify({ name: "template-name", version: "1.0.0" }, null, 2),
      );
      await writeFile(
        path.join(templateDir, ".env.example"),
        "APP_NAME=test\n",
      );
      await writeFile(path.join(templateDir, "_gitignore"), "node_modules\n");
      await writeFile(
        path.join(templateDir, "docker", "init-app.sh"),
        "#!/bin/sh\n",
      );
      await writeFile(
        path.join(templateDir, "docker", "init-localstack.sh"),
        "#!/bin/sh\n",
      );
      const commandsLog = path.join(templateRoot, "commands.log");
      await writeFile(commandsLog, "");
      await writeExecutable(
        path.join(binDir, "bun"),
        `#!/bin/sh
echo "bun:$@" >> "${commandsLog}"
exit 0
`,
      );
      await writeExecutable(
        path.join(binDir, "git"),
        `#!/bin/sh
echo "git:$@" >> "${commandsLog}"
exit 0
`,
      );
      await writeExecutable(
        path.join(binDir, "chmod"),
        `#!/bin/sh
echo "chmod:$@" >> "${commandsLog}"
exit 0
`,
      );

      await withTempDir("glim-create-target", async (targetRoot) => {
        await withCwd(targetRoot, async () => {
          await withEnv(
            {
              GLIM_TEMPLATES_DIR: templatesDir,
              PATH: `${binDir}:${process.env.PATH ?? ""}`,
            },
            async () => {
              await withSuppressedOutput(() => createProject("acme-app"));
            },
          );

          const packageJson = JSON.parse(
            await readFile(
              path.join(targetRoot, "acme-app", "package.json"),
              "utf8",
            ),
          );
          expect(packageJson.name).toBe("acme-app");
          expect(
            await readFile(path.join(targetRoot, "acme-app", ".env"), "utf8"),
          ).toBe("APP_NAME=test\n");
          expect(
            await readFile(
              path.join(targetRoot, "acme-app", ".gitignore"),
              "utf8",
            ),
          ).toBe("node_modules\n");
          const commands = (await readFile(commandsLog, "utf8"))
            .trim()
            .split("\n");
          expect(commands).toEqual([
            "chmod:+x init-app.sh",
            "chmod:+x init-localstack.sh",
            "bun:install --save-text-lockfile --lockfile-only",
            "git:init",
            "git:add .",
            "git:commit -m initial commit",
          ]);
        });
      });
    });
  });

  it("generates and applies migrations with the expected drizzle config", async () => {
    await withTempDir("glim-migrate", async (cwd) => {
      const binDir = path.join(cwd, "bin");
      const commandsLog = path.join(cwd, "commands.log");

      await mkdir(path.join(cwd, "modules", "billing", "db", "models"), {
        recursive: true,
      });
      await mkdir(binDir, { recursive: true });
      await writeFile(commandsLog, "");
      await writeExecutable(
        path.join(binDir, "bun"),
        `#!/bin/sh
echo "bun:$@" >> "${commandsLog}"
exit 0
`,
      );

      await withCwd(cwd, async () => {
        await withEnv(
          {
            PATH: `${binDir}:${process.env.PATH ?? ""}`,
            DB_BILLING_HOST: "db.local",
            DB_BILLING_DATABASE: "billing",
            DB_BILLING_USERNAME: "user",
            DB_BILLING_PASSWORD: "pw",
          },
          async () => {
            await withSuppressedOutput(async () => {
              await generateMigration("billing");
              await runMigrations("billing");
            });
          },
        );
      });

      const commands = (await readFile(commandsLog, "utf8")).trim().split("\n");
      expect(commands).toHaveLength(2);
      expect(commands[0]).toContain("bun:x drizzle-kit generate");
      expect(commands[1]).toContain("bun:x drizzle-kit migrate");

      const generateConfigPath = commands[0]?.split("--config=")[1];
      const migrateConfigPath = commands[1]?.split("--config=")[1];
      expect(generateConfigPath).toBeTruthy();
      expect(migrateConfigPath).toBeTruthy();

      const generateConfig = await readFile(
        generateConfigPath as string,
        "utf8",
      );
      const migrateConfig = await readFile(migrateConfigPath as string, "utf8");

      expect(generateConfig).toContain(
        '"schema":"./modules/billing/db/models/"',
      );
      expect(generateConfig).toContain(
        '"out":"./modules/billing/db/migrations"',
      );
      expect(migrateConfig).toContain(
        '"url":"postgresql://user:pw@db.local/billing"',
      );
      expect(migrateConfig).toContain(
        '"out":"./modules/billing/db/migrations"',
      );
    });
  });
});

describe("cli entrypoint", () => {
  it("reports unknown commands from the built binary and exits with code 1", async () => {
    await new Promise<void>((resolve, reject) => {
      const child = spawn("./dist/bin/index.js", ["wat"], {
        cwd: process.cwd(),
        stdio: ["ignore", "pipe", "pipe"],
      });

      let stdout = "";
      child.stdout.on("data", (chunk) => {
        stdout += chunk.toString();
      });
      child.stderr.on("data", () => undefined);
      child.on("error", reject);
      child.on("close", (code) => {
        try {
          expect(code).toBe(1);
          expect(stdout).toContain("Glim Node");
          expect(stdout).toContain(
            'Erro ao executar o comando "wat": Comando desconhecido: "wat"',
          );
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    });
  });
});

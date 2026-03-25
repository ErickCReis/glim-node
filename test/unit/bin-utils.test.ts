import { describe, expect, it, mock } from "bun:test";
import { EventEmitter } from "node:events";
import { createTempDrizzleConfig, execCommand, isAppStructure } from "../../src/bin/utils";

describe("bin utils", () => {
  it("detects app structure from the provided cwd", async () => {
    expect(
      await isAppStructure("/tmp/app", {
        access: async (target) => {
          expect(target).toBe("/tmp/app/src/db/models");
        },
      }),
    ).toBe(true);
  });

  it("returns false when the app structure is missing", async () => {
    expect(
      await isAppStructure("/tmp/module", {
        access: async () => {
          throw new Error("missing");
        },
      }),
    ).toBe(false);
  });

  it("writes drizzle configs using the injected runtime", async () => {
    const writeFile = mock(async () => undefined);

    const filePath = await createTempDrizzleConfig(
      {
        dialect: "postgresql",
        schema: "./src/db/models",
        out: "./src/db/migrations",
      } as never,
      {
        now: () => 123,
        tmpdir: () => "/tmp/glim",
        writeFile,
      },
    );

    expect(filePath).toBe("/tmp/glim/drizzle.config.123.ts");
    expect(writeFile).toHaveBeenCalledWith(
      "/tmp/glim/drizzle.config.123.ts",
      expect.stringContaining('defineConfig({"dialect":"postgresql"'),
    );
  });

  it("resolves successful commands through the injected spawn implementation", async () => {
    const spawn = mock(() => {
      const child = new EventEmitter() as EventEmitter & {
        on: (event: string, listener: (...args: unknown[]) => void) => typeof child;
      };
      queueMicrotask(() => child.emit("close", 0));
      return child as never;
    });

    expect(execCommand("bun", ["test"], {}, { spawn: spawn as never })).resolves.toBeUndefined();
    expect(spawn).toHaveBeenCalledWith("bun", ["test"], {
      stdio: "inherit",
    });
  });

  it("rejects failed commands through the injected spawn implementation", async () => {
    const spawn = mock(() => {
      const child = new EventEmitter() as EventEmitter & {
        on: (event: string, listener: (...args: unknown[]) => void) => typeof child;
      };
      queueMicrotask(() => child.emit("close", 2));
      return child as never;
    });

    expect(execCommand("bun", ["test"], {}, { spawn: spawn as never })).rejects.toThrow(
      "Process exited with code 2",
    );
  });
});

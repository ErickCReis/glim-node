import { describe, expect, it, mock } from "bun:test";
import { createImAlive } from "../../src/_internal/im-alive";

describe("createImAlive", () => {
  it("returns OK when a recent log file already exists", async () => {
    const execute = mock(async () => ({ rowCount: 1 }));
    const appendFileSync = mock(() => undefined);
    const imAlive = createImAlive(
      "billing",
      {
        db: {
          type: "db.postgres",
          driver: { execute } as never,
        },
      },
      {
        appendFileSync,
        existsSync: () => true,
        getCwd: () => "/tmp/glim",
        now: () => 42,
      },
    );

    expect(await imAlive("all", false)).toEqual(["OK"]);
    expect(execute).not.toHaveBeenCalled();
    expect(appendFileSync).toHaveBeenCalledWith("/tmp/glim/im-alive.log", "42\n");
  });

  it("checks feature drivers and writes the log when everything is alive", async () => {
    const appendFileSync = mock(() => undefined);
    const imAlive = createImAlive(
      "billing",
      {
        db: {
          type: "db.postgres",
          driver: {
            execute: mock(async () => ({ rowCount: 1 })),
          } as never,
        },
        cache: {
          type: "cache.redis",
          driver: {
            ping: mock(async () => "PONG"),
          } as never,
        },
      },
      {
        appendFileSync,
        existsSync: () => false,
        getCwd: () => "/tmp/glim",
        hrtime: Object.assign(
          ((previous?: [number, number]) =>
            previous ? [0, 50_000_000] : [0, 0]) as typeof process.hrtime,
          { bigint: () => process.hrtime.bigint() },
        ),
        now: () => 99,
      },
    );

    const result = await imAlive("all", true);

    expect(result).toMatchObject({
      "db.billing": { status: "alive", latency: expect.any(String) },
      "cache.billing": { status: "alive", latency: expect.any(String) },
    });
    expect(appendFileSync).toHaveBeenCalledWith("/tmp/glim/im-alive.log", "99\n");
  });

  it("does not write the log when a feature is dead", async () => {
    const appendFileSync = mock(() => undefined);
    const imAlive = createImAlive(
      "billing",
      {
        notifications: {
          type: "notification.sns",
          driver: {
            listTopics: mock(async () => ({ Topics: [] })),
          } as never,
        },
      },
      {
        appendFileSync,
        existsSync: () => false,
        getCwd: () => "/tmp/glim",
      },
    );

    const result = await imAlive("all", true);

    expect(result).toMatchObject({
      "notification.billing.s": { status: "dead" },
    });
    expect(appendFileSync).not.toHaveBeenCalled();
  });
});

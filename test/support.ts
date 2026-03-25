import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export async function makeTempDir(prefix: string) {
  return mkdtemp(path.join(os.tmpdir(), `${prefix}-`));
}

export async function withTempDir<T>(prefix: string, run: (dir: string) => Promise<T>) {
  const dir = await makeTempDir(prefix);
  try {
    return await run(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export async function withCwd<T>(cwd: string, run: () => Promise<T> | T) {
  const previousCwd = process.cwd();
  process.chdir(cwd);

  try {
    return await run();
  } finally {
    process.chdir(previousCwd);
  }
}

export async function withEnv<T>(
  entries: Record<string, string | undefined>,
  run: () => Promise<T> | T,
) {
  const previous = new Map<string, string | undefined>();

  for (const [key, value] of Object.entries(entries)) {
    previous.set(key, process.env[key]);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    return await run();
  } finally {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

export async function withSuppressedOutput<T>(
  run: () => Promise<T> | T,
  options: { stdout?: boolean; stderr?: boolean } = {},
) {
  const suppressStdout = options.stdout ?? true;
  const suppressStderr = options.stderr ?? true;
  const stdoutWrite = process.stdout.write.bind(process.stdout);
  const stderrWrite = process.stderr.write.bind(process.stderr);
  const noop = (() => true) as typeof process.stdout.write;

  if (suppressStdout) {
    process.stdout.write = noop;
  }

  if (suppressStderr) {
    process.stderr.write = noop;
  }

  try {
    return await run();
  } finally {
    process.stdout.write = stdoutWrite;
    process.stderr.write = stderrWrite;
  }
}

import "dotenv/config";

import { createServerAppWithRuntime, startWithRuntime } from "@core/_internal/server-runtime";
import type { GnApp } from "@core/gn-app";
import type { GnModule } from "@core/gn-module";
import type { Logger } from "@core/helpers/logger";

type ServerOptions = {
  mainLogger?: Logger;
};

export async function createServerApp(
  modules: Array<GnModule> | GnApp,
  options: ServerOptions = {},
) {
  return createServerAppWithRuntime(modules, options);
}

export async function start(modules: Array<GnModule> | GnApp) {
  return startWithRuntime(modules);
}

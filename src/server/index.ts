import "dotenv/config";

import { createServerAppWithRuntime, startWithRuntime } from "@core/_internal/server-runtime";
import type { AnyGnApp } from "@core/gn-app";
import type { AnyGnModule } from "@core/gn-module";
import type { Logger } from "@core/helpers/logger";
import type { Hono } from "hono";

type ServerOptions = {
  mainLogger?: Logger;
};

type ServerModule = AnyGnModule | AnyGnApp;
type ServerModulesInput = ReadonlyArray<ServerModule> | ServerModule;

export async function createServerApp(
  modules: ServerModulesInput,
  options: ServerOptions = {},
): Promise<Hono<any, any, any>> {
  return createServerAppWithRuntime(modules, options);
}

export async function start(modules: ServerModulesInput): Promise<void> {
  return startWithRuntime(modules);
}

import { createModule } from "@core/gn-module.js";
import { env } from "@ms-cronograma/env.js";
import { router } from "@ms-cronograma/router.js";

export const mscronograma = createModule("ms-cronograma")({
  middleware: [],
  router,
  env,
});

export type Client = NonNullable<(typeof router)["v1"]>;

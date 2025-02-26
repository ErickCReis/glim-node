import { hc } from "hono/client";

import type { Client as MSCronogramaClient } from "@ms-cronograma/index.js";

const cronograma = hc<MSCronogramaClient>("http://localhost:3000");
console.log(await cronograma["ms-cronograma"].v1.$get().then((r) => r.json()));

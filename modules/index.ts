import { start } from "@core/index.js";
import { mscronograma as MSCronograma } from "@ms-cronograma/index.js";

start([MSCronograma]);

// test-only
import("./clients.js");

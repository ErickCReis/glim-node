import { database } from "@ms-cronograma/db/index.js";
import { cronogramas } from "@ms-cronograma/db/models/cronograma.js";

export async function getCronogramas() {
  return await database.select().from(cronogramas);
}

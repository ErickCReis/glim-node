import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { mscronograma } from "../index.js";

import * as cronogramas from "./models/cronograma.js";

const pool = new pg.Pool({
  connectionString: mscronograma.env.DB_MS_CRONOGRAMA,
});

export const database = drizzle(pool, {
  schema: { ...cronogramas },
});

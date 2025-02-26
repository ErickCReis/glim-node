import { z } from "zod";

export const env = z.object({
  DB_MS_CRONOGRAMA: z.string(),
});

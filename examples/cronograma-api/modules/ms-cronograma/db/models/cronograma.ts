import { pgTable, serial, text } from "drizzle-orm/pg-core";

export const cronogramas = pgTable("cronogramas", {
  id: serial("id").primaryKey(),
  nome: text().notNull(),
});

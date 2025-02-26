import { pgTable, serial, text } from "drizzle-orm/pg-core";

export const cronogramas = pgTable("cronogramas", {
  id: serial("ids1as").primaryKey(),
  nome: text().notNull(),
});

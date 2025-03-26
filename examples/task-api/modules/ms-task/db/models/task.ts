import { pgTable, serial, text } from "drizzle-orm/pg-core";

export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  nome: text().notNull(),
});

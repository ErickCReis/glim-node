import { eq } from "drizzle-orm";
import { app } from "../app";
import { models } from "../db/models";

export async function getTasks() {
  return await app.db.select().from(models.tasks);
}

export async function getTask(id: number) {
  return await app.db
    .select()
    .from(models.tasks)
    .where(eq(models.tasks.id, id))
    .limit(1)
    .then((r) => r[0]);
}

export async function createTask({ nome }: { nome: string }) {
  const [task] = await app.db.insert(models.tasks).values({ nome }).returning();
  return task;
}

export async function deleteTask(id: number) {
  await app.db.delete(models.tasks).where(eq(models.tasks.id, id));
}

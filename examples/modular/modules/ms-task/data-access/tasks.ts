import { mstask } from "@ms-task";
import { models } from "@ms-task/db";
import { eq } from "drizzle-orm";

export async function getTasks() {
  return await mstask.db.select().from(models.tasks);
}

export async function getTask(id: number) {
  return await mstask.db
    .select()
    .from(models.tasks)
    .where(eq(models.tasks.id, id))
    .limit(1)
    .then((r) => r[0]);
}

export async function createTask({ nome }: { nome: string }) {
  const [task] = await mstask.db
    .insert(models.tasks)
    .values({ nome })
    .returning();
  return task;
}

export async function deleteTask(id: number) {
  await mstask.db.delete(models.tasks).where(eq(models.tasks.id, id));
}

import { models } from "@ms-cronograma/db/index.js";
import { mscronograma } from "@ms-cronograma/index.js";
import { eq } from "drizzle-orm";

export async function getCronogramas(): Promise<any[]> {
  return await mscronograma.db.select().from(models.cronogramas);
}

export async function createCronograma({
  nome,
}: { nome: string }): Promise<any> {
  const [cronograma] = await mscronograma.db
    .insert(models.cronogramas)
    .values({ nome })
    .returning();
  return cronograma;
}

export async function deleteCronograma(id: number): Promise<void> {
  await mscronograma.db
    .delete(models.cronogramas)
    .where(eq(models.cronogramas.id, id));
}

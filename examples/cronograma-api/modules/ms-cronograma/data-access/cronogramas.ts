import { mscronograma } from "@ms-cronograma";
import { models } from "@ms-cronograma/db";
import { eq } from "drizzle-orm";

export async function getCronogramas() {
  return await mscronograma.db.select().from(models.cronogramas);
}

export async function createCronograma({ nome }: { nome: string }) {
  const [cronograma] = await mscronograma.db
    .insert(models.cronogramas)
    .values({ nome })
    .returning();
  return cronograma;
}

export async function deleteCronograma(id: number) {
  await mscronograma.db
    .delete(models.cronogramas)
    .where(eq(models.cronogramas.id, id));
}

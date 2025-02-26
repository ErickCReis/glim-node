import { getCronogramas } from "@ms-cronograma/data-access/cronogramas.js";

export async function getCronogramasUseCase() {
  return await getCronogramas();
}

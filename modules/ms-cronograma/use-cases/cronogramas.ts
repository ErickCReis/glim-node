import {
  createCronograma,
  deleteCronograma,
  getCronogramas,
} from "@ms-cronograma/data-access/cronogramas.js";

export async function getCronogramasUseCase() {
  return await getCronogramas();
}

export async function createCronogramaUseCase(data: { nome: string }) {
  return await createCronograma(data);
}

export async function deleteCronogramaUseCase(id: number) {
  return await deleteCronograma(id);
}

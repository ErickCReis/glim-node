import {
  createCronograma,
  deleteCronograma,
  getCronograma,
  getCronogramas,
} from "@ms-cronograma/data-access/cronogramas";

export async function getCronogramasUseCase() {
  return await getCronogramas();
}

export async function getCronogramaUseCase(id: number) {
  return await getCronograma(id);
}

export async function createCronogramaUseCase(data: { nome: string }) {
  return await createCronograma(data);
}

export async function deleteCronogramaUseCase(id: number) {
  return await deleteCronograma(id);
}

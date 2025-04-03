import {
  createTask,
  deleteTask,
  getTask,
  getTasks,
} from "@ms-task/data-access/tasks";

export async function getTasksUseCase() {
  return await getTasks();
}

export async function getTaskUseCase(id: number) {
  return await getTask(id);
}

export async function createTaskUseCase(data: { nome: string }) {
  return await createTask(data);
}

export async function deleteTaskUseCase(id: number) {
  return await deleteTask(id);
}

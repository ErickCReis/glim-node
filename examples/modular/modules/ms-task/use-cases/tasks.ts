import { mstask } from "@ms-task";
import { createTask, deleteTask, getTask, getTasks } from "@ms-task/data-access/tasks";

export async function getTasksUseCase() {
  return await getTasks();
}

export async function getTaskUseCase(id: number) {
  return await getTask(id);
}

export async function createTaskUseCase(data: { nome: string }) {
  const task = await createTask(data);
  await mstask.notification.publish("criacao-task", JSON.stringify(task));
  await mstask.httpMsStatistic.post({ path: "/task", body: { id: task?.id } });
  return task;
}

export async function deleteTaskUseCase(id: number) {
  return await deleteTask(id);
}

'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  getColumns, getTasks, createColumn, createTask,
  updateTaskColumn, deleteTask, deleteColumn,
  KanbanColumn, KanbanTask
} from '@/lib/kanban';
import KanbanBoard from '@/components/kanban/KanbanBoard';
import styles from './Board.module.css';

export default function BoardPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [columns, setColumns] = useState<KanbanColumn[]>([]);
  const [tasks, setTasks] = useState<KanbanTask[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [cols, tsks] = await Promise.all([
        getColumns(projectId),
        getTasks(projectId),
      ]);
      setColumns(cols);
      setTasks(tsks);
      setLoading(false);
    }
    load();
  }, [projectId]);

  async function handleAddColumn(title: string, emoji: string) {
    const col = await createColumn(projectId, title, emoji);
    setColumns((prev) => [...prev, col]);
  }

  // ← returns the new task so KanbanBoard can sync localTasks
  async function handleAddTask(
    columnId: string,
    title: string,
    description: string,
    tags: string[]
  ): Promise<KanbanTask> {
    const task = await createTask(columnId, projectId, title, description, tags);
    setTasks((prev) => [...prev, task]);
    return task;
  }

  async function handleMoveTask(taskId: string, newColumnId: string, newPosition: number) {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId ? { ...t, column_id: newColumnId, position: newPosition } : t
      )
    );
    await updateTaskColumn(taskId, newColumnId, newPosition);
  }

  async function handleDeleteTask(taskId: string) {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    await deleteTask(taskId);
  }

  async function handleDeleteColumn(colId: string) {
    setColumns((prev) => prev.filter((c) => c.id !== colId));
    setTasks((prev) => prev.filter((t) => t.column_id !== colId));
    await deleteColumn(colId);
  }

  if (loading) return <div className={styles.loading}>Loading board...</div>;

  return (
    <KanbanBoard
      columns={columns}
      tasks={tasks}
      onAddColumn={handleAddColumn}
      onAddTask={handleAddTask}
      onMoveTask={handleMoveTask}
      onDeleteTask={handleDeleteTask}
      onDeleteColumn={handleDeleteColumn}
    />
  );
}
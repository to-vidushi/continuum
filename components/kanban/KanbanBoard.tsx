'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
  closestCorners,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { KanbanColumn, KanbanTask } from '@/lib/kanban';
import BoardColumn from './BoardColumn';
import TaskCard from './TaskCard';
import styles from './KanbanBoard.module.css';

type Props = {
  columns: KanbanColumn[];
  tasks: KanbanTask[];
  onAddColumn: (title: string, emoji: string) => Promise<void>;
  onAddTask: (columnId: string, title: string, description: string, tags: string[]) => Promise<KanbanTask>;
  onMoveTask: (taskId: string, newColumnId: string, newPosition: number) => Promise<void>;
  onDeleteTask: (taskId: string) => Promise<void>;
  onDeleteColumn: (colId: string) => Promise<void>;
};

export default function KanbanBoard({
  columns,
  tasks,
  onAddColumn,
  onAddTask,
  onMoveTask,
  onDeleteTask,
  onDeleteColumn,
}: Props) {
  const [activeTask, setActiveTask] = useState<KanbanTask | null>(null);
  const [localTasks, setLocalTasks] = useState<KanbanTask[]>(tasks);
  const [addingCol, setAddingCol] = useState(false);
  const [newColTitle, setNewColTitle] = useState('');
  const [newColEmoji, setNewColEmoji] = useState('');

  // Prevent syncing from props while dragging or doing local mutations
  const isDraggingRef = useRef(false);
  const prevTaskIdsRef = useRef(tasks.map((t) => t.id).join(','));

  // Only sync localTasks from props when the set of task IDs actually changes
  // (e.g. initial load, external delete) — not on every parent render
  useEffect(() => {
    if (isDraggingRef.current) return;
    const nextIds = tasks.map((t) => t.id).join(',');
    if (prevTaskIdsRef.current !== nextIds) {
      prevTaskIdsRef.current = nextIds;
      setLocalTasks(tasks);
    }
  }, [tasks]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  async function handleAddTask(
    columnId: string,
    title: string,
    description: string,
    tags: string[]
  ) {
    const newTask = await onAddTask(columnId, title, description, tags);
    setLocalTasks((prev) => [...prev, newTask]);
  }

  async function handleDeleteTask(taskId: string) {
    setLocalTasks((prev) => prev.filter((t) => t.id !== taskId));
    await onDeleteTask(taskId);
  }

  async function handleDeleteColumn(colId: string) {
    setLocalTasks((prev) => prev.filter((t) => t.column_id !== colId));
    await onDeleteColumn(colId);
  }

  function onDragStart(event: DragStartEvent) {
    isDraggingRef.current = true;
    const task = localTasks.find((t) => t.id === event.active.id);
    if (task) setActiveTask(task);
  }

  function onDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const draggedTask = localTasks.find((t) => t.id === active.id);
    if (!draggedTask) return;

    // Dropped directly onto a column
    const overColumn = columns.find((c) => c.id === over.id);
    if (overColumn && draggedTask.column_id !== overColumn.id) {
      setLocalTasks((prev) =>
        prev.map((t) =>
          t.id === draggedTask.id ? { ...t, column_id: overColumn.id } : t
        )
      );
      return;
    }

    // Dropped onto another task in a different column
    const overTask = localTasks.find((t) => t.id === over.id);
    if (overTask && draggedTask.column_id !== overTask.column_id) {
      setLocalTasks((prev) =>
        prev.map((t) =>
          t.id === draggedTask.id ? { ...t, column_id: overTask.column_id } : t
        )
      );
    }
  }

  async function onDragEnd(event: DragEndEvent) {
    isDraggingRef.current = false;
    const { active, over } = event;
    setActiveTask(null);
    if (!over) return;

    const draggedTask = localTasks.find((t) => t.id === active.id);
    if (!draggedTask) return;

    const colTasks = localTasks
      .filter((t) => t.column_id === draggedTask.column_id)
      .sort((a, b) => a.position - b.position);

    const oldIndex = colTasks.findIndex((t) => t.id === active.id);
    const newIndex = colTasks.findIndex((t) => t.id === over.id);

    let finalPosition = draggedTask.position;

    if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
      const reordered = arrayMove(colTasks, oldIndex, newIndex);
      const updated = reordered.map((t, i) => ({ ...t, position: i }));
      finalPosition = updated.find((t) => t.id === draggedTask.id)?.position ?? finalPosition;
      setLocalTasks((prev) => {
        const others = prev.filter((t) => t.column_id !== draggedTask.column_id);
        return [...others, ...updated];
      });
    }

    await onMoveTask(draggedTask.id, draggedTask.column_id, finalPosition);
  }

  async function handleAddColumn(e: React.FormEvent) {
    e.preventDefault();
    if (!newColTitle.trim()) return;
    await onAddColumn(newColTitle.trim(), newColEmoji.trim());
    setNewColTitle('');
    setNewColEmoji('');
    setAddingCol(false);
  }

  // Memoize per-column task lists to prevent new array refs on every render
  // which was the root cause of the infinite re-render loop in SortableContext
  const tasksByColumn = useMemo(() => {
    const map: Record<string, KanbanTask[]> = {};
    for (const col of columns) {
      map[col.id] = localTasks
        .filter((t) => t.column_id === col.id)
        .sort((a, b) => a.position - b.position);
    }
    return map;
  }, [localTasks, columns]);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
    >
      <div className={styles.board}>
        {columns.map((col) => (
          <BoardColumn
            key={col.id}
            column={col}
            tasks={tasksByColumn[col.id] ?? []}
            onAddTask={handleAddTask}
            onDeleteTask={handleDeleteTask}
            onDeleteColumn={handleDeleteColumn}
          />
        ))}

        <div className={styles.addColSection}>
          {addingCol ? (
            <form onSubmit={handleAddColumn} className={styles.addColForm}>
              <input
                className={styles.addColEmoji}
                placeholder="😀"
                value={newColEmoji}
                onChange={(e) => setNewColEmoji(e.target.value)}
                maxLength={2}
              />
              <input
                className={styles.addColInput}
                placeholder="Column name"
                value={newColTitle}
                onChange={(e) => setNewColTitle(e.target.value)}
                autoFocus
              />
              <div className={styles.addColActions}>
                <button type="submit" className={styles.addColSubmit}>Add</button>
                <button type="button" onClick={() => setAddingCol(false)} className={styles.addColCancel}>
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <button className={styles.addColBtn} onClick={() => setAddingCol(true)}>
              + Add column
            </button>
          )}
        </div>
      </div>

      <DragOverlay>
        {activeTask && <TaskCard task={activeTask} onDelete={() => {}} isDragging />}
      </DragOverlay>
    </DndContext>
  );
}
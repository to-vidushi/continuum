'use client';

import { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { KanbanColumn, KanbanTask } from '@/lib/kanban';
import TaskCard from './TaskCard';
import CreateTaskModal from './CreateTaskModal';
import styles from './BoardColumn.module.css';

type Props = {
  column: KanbanColumn;
  tasks: KanbanTask[];
  onAddTask: (columnId: string, title: string, description: string, tags: string[]) => Promise<void>;
  onDeleteTask: (taskId: string) => Promise<void>;
  onDeleteColumn: (colId: string) => Promise<void>;
};

export default function BoardColumn({ column, tasks, onAddTask, onDeleteTask, onDeleteColumn }: Props) {
  const [showModal, setShowModal] = useState(false);
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  async function handleAddTask(title: string, description: string, tags: string[]) {
    await onAddTask(column.id, title, description, tags);
    setShowModal(false);
  }

  return (
    <>
      <div className={`${styles.column} ${isOver ? styles.over : ''}`}>
        <div className={styles.header}>
          <div className={styles.titleRow}>
            {column.emoji && <span className={styles.emoji}>{column.emoji}</span>}
            <span className={styles.title}>{column.title}</span>
            <span className={styles.count}>{tasks.length}</span>
          </div>
          <button
            className={styles.deleteColBtn}
            onClick={() => {
              if (confirm(`Delete column "${column.title}" and all its tasks?`)) {
                onDeleteColumn(column.id);
              }
            }}
          >
            ×
          </button>
        </div>

        <div ref={setNodeRef} className={styles.taskList}>
          <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
            {tasks.map((task) => (
              <TaskCard key={task.id} task={task} onDelete={onDeleteTask} />
            ))}
          </SortableContext>
        </div>

        <button className={styles.addTaskBtn} onClick={() => setShowModal(true)}>
          + New Task
        </button>
      </div>

      {showModal && (
        <CreateTaskModal
          onClose={() => setShowModal(false)}
          onAdd={handleAddTask}
        />
      )}
    </>
  );
}
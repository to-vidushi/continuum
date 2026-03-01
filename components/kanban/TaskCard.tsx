'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { KanbanTask } from '@/lib/kanban';
import styles from './TaskCard.module.css';

const TAG_COLORS: Record<string, string> = {
  API: '#dbeafe',
  SEO: '#fef3c7',
  DevOps: '#ede9fe',
  Design: '#fce7f3',
  Frontend: '#d1fae5',
  Backend: '#e0e7ff',
  Security: '#fee2e2',
};

type Props = {
  task: KanbanTask;
  onDelete: (id: string) => void;
  isDragging?: boolean;
};

export default function TaskCard({ task, onDelete, isDragging }: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortableDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${styles.card} ${isDragging ? styles.dragging : ''}`}
      {...attributes}
      {...listeners}
    >
      {task.tags && task.tags.length > 0 && (
        <div className={styles.tags}>
          {task.tags.map((tag) => (
            <span
              key={tag}
              className={styles.tag}
              style={{ background: TAG_COLORS[tag] || '#f3f4f6' }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      <p className={styles.title}>{task.title}</p>

      {task.description && (
        <p className={styles.desc}>{task.description}</p>
      )}

      <div className={styles.footer}>
        <span className={styles.avatar}>
          {(task.assignee_name || 'U').charAt(0).toUpperCase()}
        </span>
        <span className={styles.date}>
          {new Date(task.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </span>
        <button
          className={styles.deleteBtn}
          onClick={(e) => {
            e.stopPropagation();
            onDelete(task.id);
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          ×
        </button>
      </div>
    </div>
  );
}
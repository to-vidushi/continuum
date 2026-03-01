'use client';

import { KanbanProject } from '@/lib/kanban';
import { useRouter } from 'next/navigation';
import styles from './ProjectCard.module.css';

type Props = {
  project: KanbanProject;
  onDelete: (id: string) => void;
};

// Mini thumbnail preview — decorative columns
function MiniBoard() {
  return (
    <div className={styles.mini}>
      {[3, 2, 4, 2].map((rows, ci) => (
        <div key={ci} className={styles.miniCol}>
          {Array.from({ length: rows }).map((_, ri) => (
            <div key={ri} className={styles.miniCard} />
          ))}
        </div>
      ))}
    </div>
  );
}

export default function ProjectCard({ project, onDelete }: Props) {
  const router = useRouter();

  return (
    <div className={styles.card} onClick={() => router.push(`/kanban/${project.id}`)}>
      <MiniBoard />
      <div className={styles.info}>
        <span className={styles.name}>{project.name}</span>
        {project.description && (
          <span className={styles.desc}>{project.description}</span>
        )}
      </div>
      <button
        className={styles.deleteBtn}
        onClick={(e) => {
          e.stopPropagation();
          if (confirm('Delete this project?')) onDelete(project.id);
        }}
      >
        ×
      </button>
    </div>
  );
}
'use client';

import { useEffect, useState } from 'react';
import { getProjects, createProject, deleteProject, KanbanProject } from '@/lib/kanban';
import ProjectCard from '@/components/kanban/ProjectCard';
import CreateProjectModal from '@/components/kanban/CreateProjectModal';
import styles from './KanbanHome.module.css';

export default function KanbanPage() {
  const [projects, setProjects] = useState<KanbanProject[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProjects();
  }, []);

  async function fetchProjects() {
    try {
      const data = await getProjects();
      setProjects(data);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(name: string, description: string) {
    const project = await createProject(name, description);
    setProjects((prev) => [project, ...prev]);
    setShowModal(false);
  }

  async function handleDelete(id: string) {
    await deleteProject(id);
    setProjects((prev) => prev.filter((p) => p.id !== id));
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.heading}>Kanban</h1>
        <button className={styles.newProjectBtn} onClick={() => setShowModal(true)}>
          + New project
        </button>
      </div>

      {loading ? (
        <p className={styles.emptyState}>Loading...</p>
      ) : projects.length === 0 ? (
        <div className={styles.grid}>
          <p className={styles.emptyState}>No projects yet. Create one to get started.</p>
        </div>
      ) : (
        <div className={styles.grid}>
          {projects.map((p) => (
            <ProjectCard key={p.id} project={p} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {showModal && (
        <CreateProjectModal onClose={() => setShowModal(false)} onCreate={handleCreate} />
      )}
    </div>
  );
}
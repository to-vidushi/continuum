'use client';

import { useState } from 'react';
import styles from './Modal.module.css';

const AVAILABLE_TAGS = ['API', 'SEO', 'DevOps', 'Design', 'Frontend', 'Backend', 'Security'];

type Props = {
  onClose: () => void;
  onAdd: (title: string, description: string, tags: string[]) => Promise<void>;
};

export default function CreateTaskModal({ onClose, onAdd }: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  function toggleTag(tag: string) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setLoading(true);
    await onAdd(title.trim(), description.trim(), selectedTags);
    setLoading(false);
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.title}>New Task</h2>
        <form onSubmit={handleSubmit} className={styles.form}>
          <input
            className={styles.input}
            placeholder="Task title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
          />
          <textarea
            className={styles.textarea}
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
          <div className={styles.tagsRow}>
            {AVAILABLE_TAGS.map((tag) => (
              <button
                type="button"
                key={tag}
                className={`${styles.tagOption} ${selectedTags.includes(tag) ? styles.tagSelected : ''}`}
                onClick={() => toggleTag(tag)}
              >
                {tag}
              </button>
            ))}
          </div>
          <div className={styles.actions}>
            <button type="button" className={styles.cancel} onClick={onClose}>Cancel</button>
            <button type="submit" className={styles.submit} disabled={loading || !title.trim()}>
              {loading ? 'Adding...' : 'Add Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
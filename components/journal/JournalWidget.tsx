'use client';

import { useState, useEffect, useRef } from 'react';
import { getTodayEntry, upsertTodayEntry, JournalEntry } from '@/lib/journal';
import { supabase } from '@/lib/supabaseClient';
import styles from './JournalWidget.module.css';

const MAX_CHARS = 500;

export default function JournalWidget() {
  const [isOpen, setIsOpen]           = useState(false);
  const [isLoggedIn, setIsLoggedIn]   = useState(false);
  const [entry, setEntry]             = useState<JournalEntry | null>(null);
  const [text, setText]               = useState('');
  const [loading, setLoading]         = useState(false);
  const [saved, setSaved]             = useState(false);
  const [initialLoading, setInitialLoading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Check auth state — only show widget to logged-in users
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsLoggedIn(!!session);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setIsLoggedIn(!!session);
    });
    return () => subscription.unsubscribe();
  }, []);

  // When modal opens, fetch today's entry
  useEffect(() => {
    if (!isOpen || !isLoggedIn) return;
    setInitialLoading(true);
    getTodayEntry()
      .then((e) => {
        setEntry(e);
        setText(e?.content ?? '');
      })
      .catch(console.error)
      .finally(() => setInitialLoading(false));
  }, [isOpen, isLoggedIn]);

  // Focus textarea when modal opens and no existing entry
  useEffect(() => {
    if (isOpen && !initialLoading && !entry) {
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, [isOpen, initialLoading, entry]);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  async function handleSave() {
    if (!text.trim()) return;
    setLoading(true);
    try {
      const saved = await upsertTodayEntry(text.trim());
      setEntry(saved);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  if (!isLoggedIn) return null;

  const todayFormatted = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });

  const alreadyLogged = !!entry;
  const hasEdits      = entry ? text !== entry.content : text.trim().length > 0;

  return (
    <>
      {/* ── Floating trigger button ── */}
      <button
        className={`${styles.fab} ${isOpen ? styles.fabOpen : ''} ${alreadyLogged ? styles.fabDone : ''}`}
        onClick={() => setIsOpen((p) => !p)}
        title="Daily journal"
        aria-label="Open daily journal"
      >
        {isOpen ? (
          <span className={styles.fabIcon}>✕</span>
        ) : alreadyLogged ? (
          <span className={styles.fabIcon}>✓</span>
        ) : (
          <span className={styles.fabIcon}>📝</span>
        )}
        {!isOpen && (
          <span className={styles.fabPulse} />
        )}
      </button>

      {/* ── Backdrop ── */}
      {isOpen && (
        <div
          className={styles.backdrop}
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* ── Modal panel ── */}
      <div className={`${styles.panel} ${isOpen ? styles.panelOpen : ''}`}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <span className={styles.headerIcon}>📝</span>
            <div>
              <div className={styles.headerTitle}>Daily Journal</div>
              <div className={styles.headerDate}>{todayFormatted}</div>
            </div>
          </div>
          <button className={styles.closeBtn} onClick={() => setIsOpen(false)}>✕</button>
        </div>

        {/* Body */}
        <div className={styles.body}>
          {initialLoading ? (
            <div className={styles.loadingState}>
              <div className={styles.loadingDots}>
                <span /><span /><span />
              </div>
            </div>
          ) : (
            <>
              <p className={styles.prompt}>
                {alreadyLogged
                  ? "You've logged today. Edit anytime below."
                  : 'What actually happened today? No structure needed.'}
              </p>

              <div className={styles.textareaWrap}>
                <textarea
                  ref={textareaRef}
                  className={styles.textarea}
                  placeholder="Just 2–3 sentences. How did it go?"
                  value={text}
                  onChange={(e) => setText(e.target.value.slice(0, MAX_CHARS))}
                  rows={6}
                />
                <div className={`${styles.charCount} ${text.length > MAX_CHARS * 0.9 ? styles.charCountWarn : ''}`}>
                  {text.length} / {MAX_CHARS}
                </div>
              </div>

              {/* Already logged banner */}
              {alreadyLogged && !hasEdits && (
                <div className={styles.loggedBanner}>
                  <span>✓</span>
                  <span>Logged for today</span>
                </div>
              )}

              <button
                className={`${styles.saveBtn} ${saved ? styles.saveBtnSuccess : ''}`}
                onClick={handleSave}
                disabled={loading || !hasEdits || !text.trim()}
              >
                {loading ? 'Saving…' : saved ? '✓ Saved!' : alreadyLogged ? 'Update entry' : 'Save entry'}
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
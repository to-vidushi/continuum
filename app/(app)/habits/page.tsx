'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import styles from './Habits.module.css'

// ── Types ──────────────────────────────────────────────────────────────────
type Habit = {
  id: string
  name: string
  category: string
  frequency: string
  color: string
  icon: string
  created_at: string
}

type Completion = {
  habit_id: string
  completed_date: string
}

// ── Constants ──────────────────────────────────────────────────────────────
const HABIT_ICONS = ['🔁', '💪', '📚', '🧘', '🏃', '💧', '🥗', '😴', '✍️', '🎯', '🧠', '🌿']
const HABIT_COLORS = ['#4a9e6b', '#e8736c', '#5b7fe8', '#d4a017', '#e08c3a', '#9b6ed4', '#e84393', '#00b4d8']
const CATEGORIES = ['General', 'Health', 'Mind', 'Body', 'Spirit', 'Work', 'Social']
const FREQUENCIES = ['daily', 'weekly', 'monthly']

const FREQ_COLORS: Record<string, { bg: string; color: string }> = {
  daily:   { bg: '#f2fbf5', color: '#4a9e6b' },
  weekly:  { bg: '#f2f5ff', color: '#5b7fe8' },
  monthly: { bg: '#fffbf0', color: '#d4a017' },
}

// Maps habit category → daily wins category
// Daily wins uses: 'Mind' | 'Body' | 'Spirit' | 'Health' | 'Learning' | 'Other'
const CATEGORY_MAP: Record<string, string> = {
  Health:  'Health',
  Mind:    'Mind',
  Body:    'Body',
  Spirit:  'Spirit',
  Work:    'Other',
  Social:  'Other',
  General: 'Other',
}

// ── Helpers ────────────────────────────────────────────────────────────────
function getLast7Days(): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    return d.toISOString().split('T')[0]
  })
}

function getDayAbbr(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 1)
}

function getTodayStr(): string {
  return new Date().toISOString().split('T')[0]
}

function computeStreak(completions: string[]): { current: number; longest: number } {
  if (!completions.length) return { current: 0, longest: 0 }

  const sorted = [...new Set(completions)].sort().reverse()
  let current = 0
  let longest = 0
  let streak = 0
  let prev: Date | null = null

  const today = new Date(getTodayStr())
  for (let i = 0; i < 365; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    const s = d.toISOString().split('T')[0]
    if (completions.includes(s)) current++
    else break
  }

  for (const dateStr of sorted) {
    const date = new Date(dateStr)
    if (!prev) {
      streak = 1
    } else {
      const diff = (prev.getTime() - date.getTime()) / 86400000
      streak = diff === 1 ? streak + 1 : 1
    }
    longest = Math.max(longest, streak)
    prev = date
  }

  return { current, longest }
}

// ── Component ──────────────────────────────────────────────────────────────
export default function HabitsPage() {
  const router = useRouter()

  const [habits, setHabits]           = useState<Habit[]>([])
  const [completions, setCompletions] = useState<Completion[]>([])
  const [loading, setLoading]         = useState(true)
  const [filter, setFilter]           = useState<'all' | 'daily' | 'weekly' | 'monthly'>('all')
  const [showModal, setShowModal]     = useState(false)
  const [syncMsg, setSyncMsg]         = useState<string | null>(null)

  // New habit form state
  const [newName, setNewName]           = useState('')
  const [newCategory, setNewCategory]   = useState('General')
  const [newFrequency, setNewFrequency] = useState('daily')
  const [newColor, setNewColor]         = useState(HABIT_COLORS[0])
  const [newIcon, setNewIcon]           = useState(HABIT_ICONS[0])
  const [saving, setSaving]             = useState(false)

  const today = getTodayStr()
  const last7 = getLast7Days()

  // ── Load data ─────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth'); return }

    const [{ data: habitsData }, { data: compData }] = await Promise.all([
      supabase.from('habits').select('*').eq('user_id', user.id).order('created_at'),
      supabase.from('habit_completions').select('habit_id, completed_date').eq('user_id', user.id),
    ])

    if (habitsData) setHabits(habitsData)
    if (compData)   setCompletions(compData)
    setLoading(false)
  }, [router])

  useEffect(() => { load() }, [load])

  // ── Show toast notification ───────────────────────────────────────────
  const showSync = (msg: string) => {
    setSyncMsg(msg)
    setTimeout(() => setSyncMsg(null), 2500)
  }

  // ── Toggle completion + sync to Daily Wins ────────────────────────────
  const toggleCompletion = async (habit: Habit) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const isCompleted = completions.some(
      c => c.habit_id === habit.id && c.completed_date === today
    )

    const dailyWinsCategory = CATEGORY_MAP[habit.category] ?? 'Other'
    const winTitle = `${habit.icon} ${habit.name}`

    if (isCompleted) {
      // ── UNMARK ──
      await supabase
        .from('habit_completions')
        .delete()
        .eq('habit_id', habit.id)
        .eq('completed_date', today)

      setCompletions(prev =>
        prev.filter(c => !(c.habit_id === habit.id && c.completed_date === today))
      )

      // Remove the linked daily win
      await supabase
        .from('daily_wins')
        .delete()
        .eq('user_id', user.id)
        .eq('win_date', today)
        .eq('title', winTitle)
        .eq('category', dailyWinsCategory)

      showSync(`Removed "${habit.name}" from Daily Wins`)

    } else {
      // ── MARK DONE ──
      const { data } = await supabase
        .from('habit_completions')
        .insert({ habit_id: habit.id, user_id: user.id, completed_date: today })
        .select()

      if (data) setCompletions(prev => [...prev, ...data])

      // Avoid duplicates — check if win already exists
      const { data: existing } = await supabase
        .from('daily_wins')
        .select('id')
        .eq('user_id', user.id)
        .eq('win_date', today)
        .eq('title', winTitle)
        .maybeSingle()

      if (!existing) {
        await supabase.from('daily_wins').insert({
          user_id: user.id,
          title: winTitle,
          category: dailyWinsCategory,
          win_date: today,
          completed: true,
        })
        showSync(`✅ "${habit.name}" added to Daily Wins!`)
      }
    }
  }

  // ── Add a new habit ───────────────────────────────────────────────────
  const addHabit = async () => {
    if (!newName.trim()) return
    setSaving(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('habits')
      .insert({
        name: newName.trim(),
        category: newCategory,
        frequency: newFrequency,
        color: newColor,
        icon: newIcon,
        user_id: user.id,
      })
      .select()

    if (data) {
      setHabits(prev => [...prev, data[0]])
      setNewName('')
      setNewCategory('General')
      setNewFrequency('daily')
      setNewColor(HABIT_COLORS[0])
      setNewIcon(HABIT_ICONS[0])
      setShowModal(false)
    }
    setSaving(false)
  }

  // ── Delete a habit ────────────────────────────────────────────────────
  const deleteHabit = async (id: string) => {
    await supabase.from('habits').delete().eq('id', id)
    setHabits(prev => prev.filter(h => h.id !== id))
    setCompletions(prev => prev.filter(c => c.habit_id !== id))
  }

  // ── Computed stats ────────────────────────────────────────────────────
  const todayCompleted = completions.filter(c => c.completed_date === today).length
  const totalHabits    = habits.length
  const allStreaks      = habits.map(h => {
    const hComps = completions.filter(c => c.habit_id === h.id).map(c => c.completed_date)
    return computeStreak(hComps).current
  })
  const bestStreak = allStreaks.length ? Math.max(...allStreaks) : 0
  const weekScore  = getLast7Days().filter(d =>
    habits.length > 0 &&
    habits.filter(h => h.frequency === 'daily').every(h =>
      completions.some(c => c.habit_id === h.id && c.completed_date === d)
    )
  ).length

  const filteredHabits = filter === 'all' ? habits : habits.filter(h => h.frequency === filter)

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#faf8f5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 32, opacity: 0.3 }}>🔁</div>
      </div>
    )
  }

  return (
    <div className={styles.page}>

      {/* ── Toast notification ── */}
      {syncMsg && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: '#1a1a18', color: '#fff', padding: '12px 24px',
          borderRadius: 12, fontSize: 14, fontWeight: 500, zIndex: 999,
          boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
        }}>
          {syncMsg}
        </div>
      )}

      {/* ── Add Habit Modal ── */}
      {showModal && (
        <div className={styles.modalOverlay} onClick={() => setShowModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <button className={styles.modalClose} onClick={() => setShowModal(false)}>×</button>
            <h2 className={styles.modalTitle}>New Habit</h2>

            <div className={styles.fieldGroup}>
              <label className={styles.label}>Habit Name</label>
              <input
                className={styles.input}
                placeholder="e.g. Morning run, Read 20 pages…"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addHabit()}
                autoFocus
              />
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.label}>Category</label>
              <select className={styles.select} value={newCategory} onChange={e => setNewCategory(e.target.value)}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.label}>Frequency</label>
              <select className={styles.select} value={newFrequency} onChange={e => setNewFrequency(e.target.value)}>
                {FREQUENCIES.map(f => <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</option>)}
              </select>
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.label}>Icon</label>
              <div className={styles.pickerRow}>
                {HABIT_ICONS.map(icon => (
                  <button
                    key={icon}
                    className={`${styles.iconOption} ${newIcon === icon ? styles.iconOptionActive : ''}`}
                    onClick={() => setNewIcon(icon)}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.label}>Color</label>
              <div className={styles.pickerRow}>
                {HABIT_COLORS.map(color => (
                  <button
                    key={color}
                    className={`${styles.colorOption} ${newColor === color ? styles.colorOptionActive : ''}`}
                    style={{ background: color }}
                    onClick={() => setNewColor(color)}
                    title={color}
                  />
                ))}
              </div>
            </div>

            <button className={styles.submitBtn} onClick={addHabit} disabled={!newName.trim() || saving}>
              {saving ? 'Saving…' : 'Add Habit'}
            </button>
          </div>
        </div>
      )}

      {/* ── Page Header ── */}
      <div className={styles.pageHeader}>
        <h1 className={styles.heading}>Habit Tracking</h1>
        <button className={styles.addHabitBtn} onClick={() => setShowModal(true)}>
          + New Habit
        </button>
      </div>

      {/* ── Info banner ── */}
      <div style={{
        margin: '12px 32px 0',
        padding: '10px 16px',
        background: '#f2fbf5',
        border: '1px solid #c3e6cc',
        borderRadius: 10,
        fontSize: 13,
        color: '#4a9e6b',
        fontWeight: 500,
      }}>
        🔗 Completing a habit today automatically adds it as a ✅ win in your Daily Wins!
      </div>

      {/* ── Stats Strip ── */}
      <div className={styles.statsStrip}>
        {[
          { icon: '✅', value: `${todayCompleted} / ${totalHabits}`, label: 'Done today' },
          { icon: '🔥', value: bestStreak,                            label: 'Best streak' },
          { icon: '📅', value: `${weekScore} / 7`,                   label: 'Perfect days this week' },
          { icon: '🔁', value: totalHabits,                          label: 'Total habits' },
        ].map(s => (
          <div key={s.label} className={styles.statCard}>
            <span className={styles.statIcon}>{s.icon}</span>
            <div>
              <div className={styles.statValue}>{s.value}</div>
              <div className={styles.statLabel}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Filter Bar ── */}
      <div className={styles.filterBar}>
        {(['all', 'daily', 'weekly', 'monthly'] as const).map(f => (
          <button
            key={f}
            className={`${styles.filterBtn} ${filter === f ? styles.filterBtnActive : ''}`}
            onClick={() => setFilter(f)}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {f !== 'all' && (
              <span style={{ marginLeft: 6, color: '#ccc', fontWeight: 400 }}>
                ({habits.filter(h => h.frequency === f).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Habits Grid ── */}
      <div className={styles.grid}>
        {filteredHabits.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>🔁</div>
            <div className={styles.emptyText}>No habits yet</div>
            <div className={styles.emptySub}>Click "New Habit" to start building your streaks</div>
          </div>
        ) : (
          filteredHabits.map(habit => {
            const hCompletions = completions
              .filter(c => c.habit_id === habit.id)
              .map(c => c.completed_date)

            const { current, longest } = computeStreak(hCompletions)
            const isDoneToday = hCompletions.includes(today)
            const freqStyle   = FREQ_COLORS[habit.frequency] ?? FREQ_COLORS.daily

            return (
              <div key={habit.id} className={styles.card}>

                {/* Card Header */}
                <div className={styles.cardHeader}>
                  <div className={styles.cardLeft}>
                    <div className={styles.habitIcon} style={{ background: habit.color + '20' }}>
                      {habit.icon}
                    </div>
                    <div>
                      <div className={styles.habitName}>{habit.name}</div>
                      <div className={styles.habitCategory}>{habit.category}</div>
                    </div>
                  </div>
                  <button className={styles.deleteBtn} onClick={() => deleteHabit(habit.id)}>×</button>
                </div>

                {/* Streak numbers */}
                <div className={styles.streakRow}>
                  <div className={styles.streakItem}>
                    <span className={styles.streakNum} style={{ color: habit.color }}>{current}</span>
                    <span className={styles.streakLabel}>Current</span>
                  </div>
                  <div className={styles.streakDivider} />
                  <div className={styles.streakItem}>
                    <span className={styles.streakNum}>{longest}</span>
                    <span className={styles.streakLabel}>Longest</span>
                  </div>
                  <div style={{ flex: 1 }} />
                  <span className={styles.freqBadge} style={{ background: freqStyle.bg, color: freqStyle.color }}>
                    {habit.frequency}
                  </span>
                </div>

                {/* Mini 7-day heatmap */}
                <div className={styles.miniHeatmap}>
                  {last7.map(day => {
                    const done = hCompletions.includes(day)
                    const isT  = day === today
                    return (
                      <div key={day} className={styles.heatDay}>
                        <span className={styles.heatDayLabel}>{getDayAbbr(day)}</span>
                        <div
                          className={styles.heatDot}
                          style={{
                            background: done ? habit.color : '#f0ede8',
                            borderColor: isT ? habit.color : 'transparent',
                            opacity: done ? 1 : 0.6,
                          }}
                          title={day}
                        />
                      </div>
                    )
                  })}
                </div>

                {/* Mark today button */}
                <div className={styles.checkRow}>
                  <button
                    className={`${styles.checkBtn} ${isDoneToday ? styles.checkBtnDone : ''}`}
                    style={{
                      borderColor: habit.color,
                      background: isDoneToday ? habit.color : 'transparent',
                      color: isDoneToday ? '#fff' : habit.color,
                    }}
                    onClick={() => toggleCompletion(habit)}
                  >
                    {isDoneToday ? '✓ Done today!' : '○ Mark today'}
                  </button>

                  {isDoneToday && (
                    <span style={{ fontSize: 11, color: '#4a9e6b', fontWeight: 600 }}>
                      🏆 In Daily Wins
                    </span>
                  )}
                </div>

              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
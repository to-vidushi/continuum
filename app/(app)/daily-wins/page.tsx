'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import styles from './DailyWins.module.css'

const CATEGORIES = ['Mind', 'Body', 'Spirit', 'Health', 'Learning', 'Other'] as const
type Category = typeof CATEGORIES[number]

const CATEGORY_CONFIG: Record<Category, { icon: string; color: string }> = {
  Mind:     { icon: '🧠', color: '#d4a017' },
  Body:     { icon: '🏃‍♀️', color: '#4a9e6b' },
  Spirit:   { icon: '✨', color: '#e08c3a' },
  Health:   { icon: '❤️', color: '#e8736c' },
  Learning: { icon: '📚', color: '#6b7cff' },
  Other:    { icon: '🧩', color: '#8b8b8b' },
}

type Win = {
  id: string
  title: string
  category: Category
  completed: boolean
}

type DayOffset = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7

function getDate(offset = 0) {
  const d = new Date()
  d.setDate(d.getDate() - offset)
  return d.toISOString().split('T')[0]
}

function getDayLabel(offset: DayOffset) {
  if (offset === 0) return 'Today'
  if (offset === 1) return 'Yesterday'
  const d = new Date()
  d.setDate(d.getDate() - offset)
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
}

function getStars(pct: number) {
  if (pct === 100) return 5
  if (pct >= 80) return 4
  if (pct >= 60) return 3
  if (pct >= 40) return 2
  if (pct >= 20) return 1
  return 0
}

function getMessage(pct: number) {
  if (pct === 100) return "Perfect day! You crushed every single win. 🏆"
  if (pct >= 80) return "Amazing effort! Almost a perfect day. 🔥"
  if (pct >= 60) return "Solid day! More than halfway there. 💪"
  if (pct >= 40) return "Good start! Keep building momentum. 🌱"
  if (pct >= 20) return "Every win counts. Tomorrow is a new chance. 🌅"
  return "The day isn't over yet — go get some wins! ⚡"
}

function getBarColor(pct: number) {
  if (pct === 100) return '#4a9e6b'
  if (pct >= 60) return '#d4a017'
  return '#e8736c'
}

const PAST_DAYS: DayOffset[] = [2, 3, 4, 5, 6, 7]

export default function DailyWinsPage() {
  const [wins, setWins] = useState<Win[]>([])
  const [activeOffset, setActiveOffset] = useState<DayOffset>(0)
  const [inputs, setInputs] = useState<Record<Category, string>>({
    Mind: '', Body: '', Spirit: '', Health: '', Learning: '', Other: '',
  })
  const [addingTo, setAddingTo] = useState<Category | null>(null)
  const [showScore, setShowScore] = useState(false)
  const [showPastMenu, setShowPastMenu] = useState(false)

  const router = useRouter()
  const isToday = activeOffset === 0
  const targetDate = getDate(activeOffset)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth'); return }
      const { data } = await supabase
        .from('daily_wins')
        .select('*')
        .eq('win_date', targetDate)
        .order('created_at')
      if (data) setWins(data)
    }
    load()
  }, [targetDate, router])

  const addWin = async (category: Category) => {
    if (!isToday) return
    const title = inputs[category].trim()
    if (!title) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('daily_wins')
      .insert({ title, category, win_date: targetDate, user_id: user.id })
      .select()
    if (data) {
      setWins(prev => [...prev, data[0]])
      setInputs(prev => ({ ...prev, [category]: '' }))
      setAddingTo(null)
    }
  }

  const toggleDone = async (win: Win) => {
    if (!isToday) return
    const { data } = await supabase
      .from('daily_wins').update({ completed: !win.completed }).eq('id', win.id).select()
    if (data) setWins(prev => prev.map(w => w.id === win.id ? data[0] : w))
  }

  const deleteWin = async (id: string) => {
    if (!isToday) return
    await supabase.from('daily_wins').delete().eq('id', id)
    setWins(prev => prev.filter(w => w.id !== id))
  }

  const total = wins.length
  const completed = wins.filter(w => w.completed).length
  const pct = total === 0 ? 0 : Math.round((completed / total) * 100)

  return (
    <div className={styles.page}>
      {showScore && (
        <div className={styles.modalOverlay} onClick={() => setShowScore(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <button className={styles.modalClose} onClick={() => setShowScore(false)}>×</button>
            <div className={styles.modalTitle}>
              {isToday ? "Today's Score" : `Score — ${getDayLabel(activeOffset)}`}
            </div>
            <div className={styles.starsRow}>
              {[1,2,3,4,5].map(s => (
                <span key={s} style={{ fontSize: 36, color: s <= getStars(pct) ? '#f5a623' : '#e0ddd8' }}>★</span>
              ))}
            </div>
            <div className={styles.scoreXY}>
              <span className={styles.scoreNum}>{completed}</span>
              <span className={styles.scoreDivider}>/</span>
              <span className={styles.scoreTotal}>{total}</span>
              <span className={styles.scoreLabel}>wins completed</span>
            </div>
            <div className={styles.barBg}>
              <div className={styles.barFill} style={{ width: `${pct}%`, background: getBarColor(pct) }} />
            </div>
            <div className={styles.pctText}>{pct}%</div>
            <div className={styles.scoreMessage}>{getMessage(pct)}</div>
            <div className={styles.breakdown}>
              {CATEGORIES.map(cat => {
                const catWins = wins.filter(w => w.category === cat)
                const catDone = catWins.filter(w => w.completed).length
                const { icon, color } = CATEGORY_CONFIG[cat]
                return (
                  <div key={cat} className={styles.breakdownRow}>
                    <span className={styles.breakdownIcon}>{icon}</span>
                    <span className={styles.breakdownCat} style={{ color }}>{cat}</span>
                    <span className={styles.breakdownScore}>{catDone}/{catWins.length}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      <div className={styles.pageHeader}>
        <h1 className={styles.heading}>Daily Wins</h1>
      </div>

      <div className={styles.header}>
        <div className={styles.tabs}>
          <button className={`${styles.tab} ${activeOffset === 0 ? styles.tabActive : ''}`}
            onClick={() => { setActiveOffset(0); setShowPastMenu(false) }}>
            ↓ Today
          </button>
          <button className={`${styles.tab} ${activeOffset === 1 ? styles.tabActive : ''}`}
            onClick={() => { setActiveOffset(1); setShowPastMenu(false) }}>
            ↺ Yesterday
          </button>
          <div className={styles.dropdownWrapper}>
            <button className={`${styles.tab} ${activeOffset >= 2 ? styles.tabActive : ''}`}
              onClick={() => setShowPastMenu(prev => !prev)}>
              📅 Past Week {activeOffset >= 2 ? `(${getDayLabel(activeOffset)})` : ''} ▾
            </button>
            {showPastMenu && (
              <div className={styles.dropdown}>
                {PAST_DAYS.map(offset => (
                  <button key={offset}
                    className={`${styles.dropdownItem} ${activeOffset === offset ? styles.dropdownItemActive : ''}`}
                    onClick={() => { setActiveOffset(offset); setShowPastMenu(false) }}>
                    {getDayLabel(offset)}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <button className={styles.scoreBtn} onClick={() => setShowScore(true)}>
          {total === 0 ? '📋 No wins yet' : `⭐ View Score — ${completed}/${total}`}
        </button>
      </div>

      {!isToday && (
        <div className={styles.viewOnlyBanner}>
          👀 Viewing {getDayLabel(activeOffset)} — read only
        </div>
      )}

      <div className={styles.board}>
        {CATEGORIES.map(category => {
          const { icon, color } = CATEGORY_CONFIG[category]
          const catWins = wins.filter(w => w.category === category)
          const catDone = catWins.filter(w => w.completed).length
          return (
            <div key={category} className={styles.column}>
              <div className={styles.colHeader}>
                <span className={styles.colIcon}>{icon}</span>
                <span className={styles.colTitle} style={{ color }}>{category} Wins</span>
                <span className={styles.colCount}>{catDone}/{catWins.length}</span>
              </div>
              {catWins.map(win => (
                <div key={win.id} className={`${styles.card} ${win.completed ? styles.cardCompleted : styles.cardDefault}`}>
                  <div className={styles.cardTop}>
                    <span className={`${styles.cardLabel} ${win.completed ? styles.cardLabelDone : styles.cardLabelPending}`}>
                      {win.title}
                    </span>
                    {isToday && <button className={styles.deleteBtn} onClick={() => deleteWin(win.id)}>×</button>}
                  </div>
                  <div className={styles.cardBottom}>
                    <input type="checkbox" checked={win.completed} onChange={() => toggleDone(win)}
                      disabled={!isToday} className={`${styles.checkbox} ${!isToday ? styles.checkboxDisabled : ''}`} />
                    <span className={styles.doneLabel} style={{ color: win.completed ? color : '#bbb' }}>
                      {win.completed ? 'Done! ✓' : 'Done?'}
                    </span>
                  </div>
                </div>
              ))}
              {catWins.length === 0 && (
                <div className={styles.emptyState}>
                  {isToday ? `Plan your ${category.toLowerCase()} wins for today ✍️` : 'No wins recorded'}
                </div>
              )}
              {isToday && (
                addingTo === category ? (
                  <div className={styles.addRow}>
                    <input autoFocus className={styles.addInput} value={inputs[category]}
                      onChange={e => setInputs(prev => ({ ...prev, [category]: e.target.value }))}
                      onKeyDown={e => { if (e.key === 'Enter') addWin(category); if (e.key === 'Escape') setAddingTo(null) }}
                      placeholder="What do you plan to win today?" />
                    <button className={styles.addBtn} style={{ background: color }} onClick={() => addWin(category)}>Add</button>
                    <button className={styles.cancelBtn} onClick={() => setAddingTo(null)}>✕</button>
                  </div>
                ) : (
                  <button className={styles.newWinBtn} style={{ color, borderColor: color + '50' }}
                    onClick={() => setAddingTo(category)}>
                    + Add a win
                  </button>
                )
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}